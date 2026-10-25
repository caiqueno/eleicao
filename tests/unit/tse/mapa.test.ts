// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { lerAndamento, lerMunicipios, mapaBrasil, mapaUf, urlAndamento, urlResultadoArea, URL_MUNICIPIOS } from "@/lib/tse/mapa";
import { consultarPrimeiroTurno, lerPrimeiroTurno } from "@/lib/tse/primeiroTurno";
import { projetar } from "@/components/av/Laterais";
import { fetchFalso, fixture, gerarJws, proibirRedeReal, responder, textoFixture, URL_CONFIG_TSE } from "./auxiliares";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (f: () => unknown) => void f() }));

proibirRedeReal();

const CONFIG = textoFixture("ele-c.trecho-real.json");

/** Resultado SIMULADO no formato real do arquivo -u. */
function resultado(cdabr: string, st: number, a: number, b: number, extra: Record<string, unknown> = {}) {
  const d = fixture("simulado-parcial.json");
  Object.assign(d, { cdabr, s: { ts: "100", st: String(st), pstn: String(st) }, e: { te: "1000", esnt: String(1000 - st * 10) }, ...extra });
  d.carg[0].agr[0].par[0].cand[0].vap = String(a);
  d.carg[0].agr[1].par[0].cand[0].vap = String(b);
  return d;
}

const ANDAMENTO = {
  ele: "6258",
  t: "2",
  abr: [
    { tpabr: "mun", cdabr: "38490", dt: "25/10/2026", ht: "18:00:00", and: "p", s: { ts: "100", st: "50", pstn: "50" }, e: { te: "5000", esnt: "2500" } },
    { tpabr: "mun", cdabr: "30007", dt: "", ht: "", and: "n", s: { ts: "10", st: "0", pstn: "0" }, e: { te: "800", esnt: "800" } },
  ],
};
const MUNICIPIOS = {
  abr: [
    { cd: "ba", ds: "BAHIA", mu: [{ cd: "38490", cdi: "2927408", nm: "SALVADOR" }, { cd: "30007", cdi: "2900108", nm: "ABAÍRA" }] },
    { cd: "zz", ds: "EXTERIOR", mu: [{ cd: "29416", cdi: "", nm: "BOSTON" }] },
    { cd: "xx", ds: "INVÁLIDA", mu: [{ cd: "1", cdi: "", nm: "X" }] },
  ],
};

describe("leitura dos arquivos de andamento e municípios", () => {
  it("lerMunicipios guarda UF, código TSE com 5 dígitos e IBGE só quando válido", () => {
    expect(lerMunicipios(MUNICIPIOS)).toEqual([
      { uf: "ba", cd: "38490", ibge: "2927408", nome: "SALVADOR" },
      { uf: "ba", cd: "30007", ibge: "2900108", nome: "ABAÍRA" },
      { uf: "zz", cd: "29416", ibge: null, nome: "BOSTON" },
    ]);
  });

  it("lerAndamento rejeita outra eleição ou turno", () => {
    expect(() => lerAndamento({ ...ANDAMENTO, ele: "6257" }, "6258")).toThrow();
    expect(() => lerAndamento({ ...ANDAMENTO, t: "1" }, "6258")).toThrow();
    const r = lerAndamento(ANDAMENTO, "6258");
    expect(r[0]).toMatchObject({ cd: "38490", secoesTotalizadas: 50, eleitorado: 5000, eleitoradoFaltando: 2500 });
    expect(r[1].atualizadoEmFonte).toBeNull();
  });
});

describe("mapaUf", () => {
  it("baixa só municípios com seções apuradas e liga ao código IBGE", async () => {
    const urlMun = urlResultadoArea("6258", "1", "ba", "38490");
    const f = fetchFalso({
      [URL_CONFIG_TSE]: responder(CONFIG),
      [urlResultadoArea("6258", "1", "br")]: responder(gerarJws(resultado("br", 0, 0, 0))),
      [urlAndamento("6258", "ba")]: responder(gerarJws(ANDAMENTO)),
      [URL_MUNICIPIOS]: responder(JSON.stringify(MUNICIPIOS)),
      [urlMun]: responder(gerarJws(resultado("38490", 50, 300, 700))),
    });
    const r = await mapaUf("presidente", "ba", { fetchImpl: f });
    expect(r.estado).toBe("ok");
    const salvador = r.areas.find((a) => a.cd === "38490")!;
    expect(salvador).toMatchObject({ ibge: "2927408", nome: "SALVADOR", votos: { "11": 300, "22": 700 } });
    expect(r.areas.find((a) => a.cd === "30007")!.votos).toBeNull();
    expect(r.pendentes).toBe(0);
    expect(f.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("ba30007"))).toHaveLength(0);
  });

  it("município com abrangência divergente fica sem votos (pendente)", async () => {
    const f = fetchFalso({
      [URL_CONFIG_TSE]: responder(CONFIG),
      [urlResultadoArea("6258", "1", "br")]: responder(gerarJws(resultado("br", 0, 0, 0))),
      [urlAndamento("6258", "ba")]: responder(gerarJws(ANDAMENTO)),
      [URL_MUNICIPIOS]: responder(JSON.stringify(MUNICIPIOS)),
      [urlResultadoArea("6258", "1", "ba", "38490")]: responder(gerarJws(resultado("99999", 50, 1, 2))),
    });
    const r = await mapaUf("presidente", "ba", { fetchImpl: f });
    expect(r.areas.find((a) => a.cd === "38490")!.votos).toBeNull();
    expect(r.pendentes).toBe(1);
  });

  it("andamento indisponível → erro-fonte", async () => {
    const f = fetchFalso({
      [URL_CONFIG_TSE]: responder(CONFIG),
      [urlResultadoArea("6258", "1", "br")]: responder(gerarJws(resultado("br", 0, 0, 0))),
    });
    const r = await mapaUf("presidente", "ba", { fetchImpl: f });
    expect(r.estado).toBe("erro-fonte");
  });
});

describe("mapaBrasil", () => {
  it("presidente: uma área por UF que respondeu, com aviso das que falharam", async () => {
    const f = fetchFalso({
      [URL_CONFIG_TSE]: responder(CONFIG),
      [urlResultadoArea("6258", "1", "br")]: responder(gerarJws(resultado("br", 10, 10, 20))),
      [urlResultadoArea("6258", "1", "sp")]: responder(gerarJws(resultado("sp", 10, 10, 20))),
    });
    const r = await mapaBrasil("presidente", { fetchImpl: f });
    expect(r.estado).toBe("ok");
    expect(r.areas.map((a) => a.cd)).toEqual(["sp"]);
    expect(r.mensagem).toMatch(/27 área/);
  });
});

describe("1º turno", () => {
  const pt = (cdabr: string, extra: Record<string, unknown> = {}) => {
    const d = resultado(cdabr, 100, 600, 400, { ele: "6257", t: "1", and: "f", ...extra });
    d.carg[0].agr.push({ par: [{ sg: "X", cand: [{ n: "30", nm: "OUTRO", vap: "50" }] }] });
    return d;
  };
  it("lê só os dois do 2º turno e exige arquivo final do 1º turno", () => {
    expect(lerPrimeiroTurno(pt("br"), "presidente", "br", ["11", "22"])).toEqual({ cd: "br", votos: { "11": 600, "22": 400 }, validos: 75000 });
    expect(() => lerPrimeiroTurno(pt("br", { ele: "6258" }), "presidente", "br", ["11", "22"])).toThrow();
    expect(() => lerPrimeiroTurno(pt("br", { and: "p" }), "presidente", "br", ["11", "22"])).toThrow();
    expect(() => lerPrimeiroTurno(pt("sp"), "presidente", "br", ["11", "22"])).toThrow();
  });
  it("consulta município específico", async () => {
    const f = fetchFalso({
      [URL_CONFIG_TSE]: responder(CONFIG),
      [urlResultadoArea("6258", "1", "br")]: responder(gerarJws(resultado("br", 0, 0, 0))),
      [urlResultadoArea("6257", "1", "ba", "38490")]: responder(gerarJws(pt("38490"))),
    });
    const r = await consultarPrimeiroTurno("presidente", "ba", "38490", { fetchImpl: f });
    expect(r).toMatchObject({ estado: "ok", areas: [{ cd: "38490", votos: { "11": 600, "22": 400 } }] });
  });
});

describe("projeção", () => {
  const area = (cd: string, st: number, votos: Record<string, number> | null) => ({
    cd, nome: cd, ibge: null, secoesTotal: 100, secoesTotalizadas: st, percentualSecoes: st, eleitorado: 1, eleitoradoFaltando: 0,
    votos, validos: null, atualizadoEmFonte: null, finalizada: false,
  });
  const pt1 = [
    { cd: "sp", votos: { "11": 40, "22": 60 }, validos: 300 },
    { cd: "ba", votos: { "11": 70, "22": 30 }, validos: 100 },
  ];
  it("sem nenhuma UF apurada não projeta", () => {
    expect(projetar([area("sp", 0, null), area("ba", 0, null)], pt1, ["11", "22"])).toBeNull();
  });
  it("pondera pelos votos válidos do 1º turno", () => {
    const r = projetar([area("sp", 50, { "11": 50, "22": 50 }), area("ba", 0, null)], pt1, ["11", "22"])!;
    // SP 50% (peso 300) + BA 70% do 1º turno (peso 100) = 55%
    expect(r.a).toBeCloseTo(55);
    expect(r.cobertura).toBeCloseTo(37.5);
  });
});

describe("validação das rotas novas", () => {
  const req = (u: string) => new NextRequest(`http://localhost${u}`);
  it.each([
    ["/api/mapa?cargo=senador&uf=br"],
    ["/api/mapa?cargo=presidente&uf=BR"],
    ["/api/mapa?cargo=presidente&uf=br&x=1"],
  ])("mapa rejeita %s", async (u) => {
    const { GET } = await import("@/app/api/mapa/route");
    expect((await GET(req(u))).status).toBe(400);
  });
  it.each([
    ["/api/primeiro-turno?cargo=presidente&uf=br&mun=12345"],
    ["/api/primeiro-turno?cargo=presidente&uf=sp&mun=../x"],
  ])("primeiro-turno rejeita %s", async (u) => {
    const { GET } = await import("@/app/api/primeiro-turno/route");
    expect((await GET(req(u))).status).toBe(400);
  });
  it.each([
    ["/api/foto?cargo=presidente&uf=br&sq=abc"],
    ["/api/foto?cargo=presidente&uf=br&sq=123456&url=http://x"],
  ])("foto rejeita %s", async (u) => {
    const { GET } = await import("@/app/api/foto/route");
    expect((await GET(req(u))).status).toBe(400);
  });
});
