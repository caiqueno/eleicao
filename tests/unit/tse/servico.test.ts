// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { consultarResultado, eCargoValido, eUfValida, listarAbrangencias, urlResultado, URL_CONFIG } from "@/lib/tse/servico";
import {
  fetchFalso,
  fixture,
  gerarJws,
  proibirRedeReal,
  responder,
  textoFixture,
  travar,
  URL_CONFIG_TSE,
  urlResultadoTse,
} from "./auxiliares";

proibirRedeReal();

const CONFIG = textoFixture("ele-c.trecho-real.json");
const URL_PRES_BR = urlResultadoTse("6258", "1", "br");

describe("URLs e validadores", () => {
  it("URL_CONFIG e urlResultado seguem o padrão do TSE", () => {
    expect(URL_CONFIG).toBe(URL_CONFIG_TSE);
    expect(urlResultado("6258", "1", "br")).toBe(URL_PRES_BR);
    expect(urlResultado("6260", "3", "am")).toBe(
      "https://resultados.tse.jus.br/oficial/ele2026/6260/dados/am/am-c0003-e006260-u.jws",
    );
  });

  it("urlResultado rejeita UF maliciosa", () => {
    expect(() => urlResultado("6258", "1", "../x")).toThrow();
  });

  it.each([["presidente", true], ["governador", true], ["senador", false], ["constructor", false], ["__proto__", false], [1, false]])(
    "eCargoValido(%j) = %j",
    (v, ok) => expect(eCargoValido(v)).toBe(ok),
  );

  it.each([["br", true], ["sp", true], ["zz", true], ["BR", false], ["../x", false], ["toString", false], ["__proto__", false], [null, false]])(
    "eUfValida(%j) = %j",
    (v, ok) => expect(eUfValida(v)).toBe(ok),
  );
});

describe("consultarResultado", () => {
  it("ok: config real + resultado simulado em JWS", async () => {
    const f = fetchFalso({
      [URL_CONFIG_TSE]: responder(CONFIG),
      [URL_PRES_BR]: responder(gerarJws(fixture("simulado-parcial.json"))),
    });
    const r = await consultarResultado("presidente", "br", { fetchImpl: f });
    expect(r.estado).toBe("ok");
    expect(r.mensagem).toBeNull();
    expect(r.resultado?.candidatos.map((c) => c.numero)).toEqual(["22", "11"]);
    expect(r.resultado?.fonteUrl).toBe(URL_PRES_BR);
    expect(Number.isNaN(Date.parse(r.consultadoEm))).toBe(false);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("ok: resultado em JSON simples também é aceito", async () => {
    const f = fetchFalso({
      [URL_CONFIG_TSE]: responder(CONFIG),
      [URL_PRES_BR]: responder(textoFixture("simulado-finalizado.json")),
    });
    const r = await consultarResultado("presidente", "br", { fetchImpl: f });
    expect(r.estado).toBe("ok");
    expect(r.resultado?.totalizacao.finalizada).toBe(true);
  });

  it("ok: sem .jws publicado, usa o mesmo arquivo em .json", async () => {
    const urlJson = URL_PRES_BR.replace(/\.jws$/, ".json");
    const f = fetchFalso({
      [URL_CONFIG_TSE]: responder(CONFIG),
      [urlJson]: responder(textoFixture("simulado-parcial.json")),
    });
    const r = await consultarResultado("presidente", "br", { fetchImpl: f });
    expect(r.estado).toBe("ok");
    expect(r.resultado?.fonteUrl).toBe(urlJson);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("erro 500 no .jws não tenta .json", async () => {
    const f = fetchFalso({ [URL_CONFIG_TSE]: responder(CONFIG), [URL_PRES_BR]: responder("", 500) });
    const r = await consultarResultado("presidente", "br", { fetchImpl: f });
    expect(r.estado).toBe("erro-fonte");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("ok: governador no AM", async () => {
    const d = fixture("simulado-parcial.json");
    Object.assign(d, { cdabr: "am", ele: "6260" });
    d.carg[0].cd = "3";
    const f = fetchFalso({ [URL_CONFIG_TSE]: responder(CONFIG), [urlResultadoTse("6260", "3", "am")]: responder(gerarJws(d)) });
    const r = await consultarResultado("governador", "am", { fetchImpl: f });
    expect(r.estado).toBe("ok");
    expect(r.resultado?.abrangenciaNome).toBe("Amazonas");
  });

  it("404 no resultado → sem-dados", async () => {
    const f = fetchFalso({ [URL_CONFIG_TSE]: responder(CONFIG) });
    const r = await consultarResultado("presidente", "br", { fetchImpl: f });
    expect(r).toMatchObject({ estado: "sem-dados", resultado: null });
    expect(r.mensagem).toMatch(/ainda não divulgou/);
  });

  it("500 no resultado → erro-fonte", async () => {
    const f = fetchFalso({ [URL_CONFIG_TSE]: responder(CONFIG), [URL_PRES_BR]: responder("", 500) });
    const r = await consultarResultado("presidente", "br", { fetchImpl: f });
    expect(r.estado).toBe("erro-fonte");
    expect(r.mensagem).toMatch(/HTTP 500/);
  });

  it.each([
    ["HTTP 500", responder("", 500)],
    ["404", responder("", 404)],
    ["JSON quebrado", responder("<html>manutenção</html>")],
    ["estrutura sem pl", responder('{"x":1}')],
  ])("config indisponível (%s) → erro-fonte, sem buscar resultado", async (_, rota) => {
    const f = fetchFalso({ [URL_CONFIG_TSE]: rota });
    const r = await consultarResultado("presidente", "br", { fetchImpl: f });
    expect(r).toMatchObject({ estado: "erro-fonte", resultado: null });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("governador em SP → nao-suportado, sem buscar resultado", async () => {
    const f = fetchFalso({ [URL_CONFIG_TSE]: responder(CONFIG) });
    const r = await consultarResultado("governador", "sp", { fetchImpl: f });
    expect(r.estado).toBe("nao-suportado");
    expect(r.mensagem).toMatch(/São Paulo/);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("cargo ausente do ele-c.json → nao-suportado", async () => {
    const cfg = fixture("ele-c.trecho-real.json");
    cfg.pl[1].e = cfg.pl[1].e.filter((e: { cd: string }) => e.cd !== "6258");
    const f = fetchFalso({ [URL_CONFIG_TSE]: responder(JSON.stringify(cfg)) });
    const r = await consultarResultado("presidente", "br", { fetchImpl: f });
    expect(r.estado).toBe("nao-suportado");
  });

  it.each([
    ["1º turno", () => gerarJws(fixture("simulado-primeiro-turno.json"))],
    ["cdabr divergente", () => gerarJws(fixture("simulado-cdabr-divergente.json"))],
    ["JWS malformado", () => "abc.def"],
    ["payload não-JSON", () => "eyJhIjoxfQ.bGl4bw.sig"],
  ])("resposta inválida (%s) → invalido", async (_, corpo) => {
    const f = fetchFalso({ [URL_CONFIG_TSE]: responder(CONFIG), [URL_PRES_BR]: responder(corpo()) });
    const r = await consultarResultado("presidente", "br", { fetchImpl: f });
    expect(r).toMatchObject({ estado: "invalido", resultado: null });
    expect(r.mensagem).toMatch(/não passou na validação/);
  });

  it("tempo limite no resultado → erro-fonte", async () => {
    const f = fetchFalso({ [URL_CONFIG_TSE]: responder(CONFIG), [URL_PRES_BR]: travar });
    const r = await consultarResultado("presidente", "br", { fetchImpl: f, timeoutMs: 20 });
    expect(r.estado).toBe("erro-fonte");
    expect(r.mensagem).toMatch(/Tempo limite/);
  });

  it("tempo limite na configuração → erro-fonte", async () => {
    const f = fetchFalso({ [URL_CONFIG_TSE]: travar });
    const r = await consultarResultado("presidente", "br", { fetchImpl: f, timeoutMs: 20 });
    expect(r.estado).toBe("erro-fonte");
    expect(r.mensagem).toMatch(/Tempo limite.*configuração/);
  });

  it("erro de rede → erro-fonte", async () => {
    const f = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const r = await consultarResultado("presidente", "br", { fetchImpl: f });
    expect(r.estado).toBe("erro-fonte");
    expect(r.mensagem).toMatch(/conexão/);
  });
});

describe("listarAbrangencias", () => {
  it("lista presidente (28 opções) e governador (6 UFs)", async () => {
    const opcoes = await listarAbrangencias({ fetchImpl: fetchFalso({ [URL_CONFIG_TSE]: responder(CONFIG) }) });
    expect(opcoes.filter((o) => o.cargo === "presidente")).toHaveLength(29);
    expect(opcoes.filter((o) => o.cargo === "governador").map((o) => o.uf)).toEqual(["am", "rn", "df", "es", "ac", "to"]);
  });
});
