// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getResultados } from "@/app/api/resultados/route";
import { GET as getAbrangencias } from "@/app/api/abrangencias/route";
import { fetchFalso, fixture, gerarJws, proibirRedeReal, responder, textoFixture, URL_CONFIG_TSE, urlResultadoTse } from "./auxiliares";

proibirRedeReal();

const req = (query: string) => new NextRequest(`http://localhost/api/resultados${query}`);
const CONFIG = textoFixture("ele-c.trecho-real.json");

describe("GET /api/resultados", () => {
  it.each([
    ["?cargo=senador"],
    ["?cargo=constructor"],
    ["?cargo=__proto__"],
    ["?uf=xx"],
    ["?uf=toString"],
    ["?uf=" + encodeURIComponent("../x")],
    ["?uf=../x"],
    ["?uf=" + encodeURIComponent("br?x")],
    ["?uf=br%2F..%2Fx"],
    ["?uf=" + encodeURIComponent("br/../../evil")],
    ["?uf=%00"],
    ["?uf="],
    ["?cargo=presidente&uf=" + encodeURIComponent("https://evil.com")],
  ])("parâmetros inválidos %s → 400 sem consultar o TSE", async (q) => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const res = await getResultados(req(q));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ erro: "Parâmetros inválidos" });
    expect(f).not.toHaveBeenCalled();
  });

  it("UF em maiúsculas e parâmetros desconhecidos → 400 (não furam o cache)", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect((await getResultados(req("?uf=BR"))).status).toBe(400);
    expect((await getResultados(req("?cargo=presidente&uf=br&x=1"))).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });

  it("padrão presidente/br; ok → 200 com cache curto", async () => {
    const f = fetchFalso({
      [URL_CONFIG_TSE]: responder(CONFIG),
      [urlResultadoTse("6258", "1", "br")]: responder(gerarJws(fixture("simulado-parcial.json"))),
    });
    vi.stubGlobal("fetch", f);
    const res = await getResultados(req(""));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=10");
    const corpo = await res.json();
    expect(corpo.estado).toBe("ok");
    expect(corpo.resultado.abrangencia).toBe("br");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("governador em SP → 200 nao-suportado", async () => {
    vi.stubGlobal("fetch", fetchFalso({ [URL_CONFIG_TSE]: responder(CONFIG) }));
    const res = await getResultados(req("?cargo=governador&uf=sp"));
    expect(res.status).toBe(200);
    expect((await res.json()).estado).toBe("nao-suportado");
  });

  it("TSE fora do ar → 502 erro-fonte", async () => {
    vi.stubGlobal("fetch", fetchFalso({ [URL_CONFIG_TSE]: responder("", 503) }));
    const res = await getResultados(req("?cargo=presidente&uf=br"));
    expect(res.status).toBe(502);
    expect((await res.json()).estado).toBe("erro-fonte");
  });

  it("resposta inválida → 502 invalido", async () => {
    vi.stubGlobal(
      "fetch",
      fetchFalso({
        [URL_CONFIG_TSE]: responder(CONFIG),
        [urlResultadoTse("6258", "1", "br")]: responder(gerarJws(fixture("simulado-primeiro-turno.json"))),
      }),
    );
    const res = await getResultados(req(""));
    expect(res.status).toBe(502);
    expect((await res.json()).estado).toBe("invalido");
  });
});

describe("GET /api/abrangencias", () => {
  it("ok → 200 com opções e cache", async () => {
    vi.stubGlobal("fetch", fetchFalso({ [URL_CONFIG_TSE]: responder(CONFIG) }));
    const res = await getAbrangencias();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=300");
    const corpo = await res.json();
    expect(corpo.opcoes).toContainEqual({ cargo: "governador", uf: "to", nome: "Tocantins" });
  });

  it("config indisponível → 502 com lista vazia", async () => {
    vi.stubGlobal("fetch", fetchFalso({ [URL_CONFIG_TSE]: responder("", 500) }));
    const res = await getAbrangencias();
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ opcoes: [], erro: "Configuração do TSE indisponível" });
  });
});
