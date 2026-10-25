import { afterEach, describe, expect, it, vi } from "vitest";
import { PLANOS } from "@/config/planos";
import { nomeCurto } from "@/components/av/util";

describe("planos de governo", () => {
  it("cada disputa tem os dois candidatos na lista, com partes válidas", () => {
    expect(Object.keys(PLANOS)).toHaveLength(14);
    for (const p of Object.values(PLANOS)) {
      expect(p.partes.length).toBeGreaterThan(0);
      for (const parte of p.partes) expect(parte.ini + parte.tam).toBeLessThanOrEqual(p.zipTam);
    }
  });
});

describe("rota /api/plano", () => {
  afterEach(() => vi.unstubAllGlobals());
  const pedir = async (qs: string) => {
    const { GET } = await import("@/app/api/plano/route");
    const { NextRequest } = await import("next/server");
    return GET(new NextRequest(`http://localhost/api/plano?${qs}`));
  };

  it("recusa candidato fora da lista, parte inexistente e parâmetro extra", async () => {
    expect((await pedir("sq=123")).status).toBe(400);
    expect((await pedir("sq=280002542548&parte=2")).status).toBe(400);
    expect((await pedir("sq=280002542548&url=x")).status).toBe(400);
    expect((await pedir("sq=__proto__")).status).toBe(400);
  });

  it("pede ao TSE só o trecho do PDF e recusa se o zip mudou", async () => {
    const { ini, tam } = PLANOS["280002542548"].partes[0];
    const chamadas: [string, RequestInit | undefined][] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      chamadas.push([url, init]);
      return new Response("%PDF-1.7", { status: 206, headers: { "content-range": `bytes ${ini}-${ini + tam - 1}/18275613` } });
    }));
    const ok = await pedir("sq=280002542548");
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/pdf");
    expect(chamadas[0][0]).toBe("https://cdn.tse.jus.br/estatistica/sead/odsele/proposta_governo/proposta_governo_2026_BR.zip");
    expect((chamadas[0][1]?.headers as Record<string, string>).Range).toBe(`bytes=${ini}-${ini + tam - 1}`);

    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 206, headers: { "content-range": `bytes ${ini}-${ini + tam - 1}/999` } })));
    expect((await pedir("sq=280002542548")).status).toBe(502);
  });
});

describe("nome dos candidatos", () => {
  it("usa o nome de urna inteiro para não confundir", () => {
    expect(nomeCurto("FLAVIO BOLSONARO", true)).toBe("Flávio Bolsonaro");
    expect(nomeCurto("LULA", true)).toBe("Lula");
    expect(nomeCurto("PROFESSORA MARIA DO CARMO", true)).toBe("Professora Maria do Carmo");
  });
});
