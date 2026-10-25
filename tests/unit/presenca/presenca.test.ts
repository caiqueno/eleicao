import { beforeEach, describe, expect, it, vi } from "vitest";
import { aceitarId, configRedis, idValido, JANELA_MS, limparPresenca, registrarSinal } from "@/lib/presenca";
import { liderancas, textoWhatsapp, viradas } from "@/components/av/Exclusivos";
import type { AreaMapa } from "@/lib/tse/mapa";

const ID = "0123456789abcdef0123456789abcdef";
const CFG = { url: "https://exemplo.upstash.io", token: "t" };

beforeEach(() => limparPresenca());

describe("configuração do Redis", () => {
  it("sem variáveis, o contador fica desligado", () => {
    expect(configRedis({})).toBeNull();
  });
  it("aceita só HTTPS em host do Upstash", () => {
    expect(configRedis({ KV_REST_API_URL: "https://abc.upstash.io", KV_REST_API_TOKEN: "x" })).toEqual({ url: "https://abc.upstash.io", token: "x" });
    expect(configRedis({ KV_REST_API_URL: "http://abc.upstash.io", KV_REST_API_TOKEN: "x" })).toBeNull();
    expect(configRedis({ KV_REST_API_URL: "https://169.254.169.254", KV_REST_API_TOKEN: "x" })).toBeNull();
    expect(configRedis({ UPSTASH_REDIS_REST_URL: "https://upstash.io.mal.com", UPSTASH_REDIS_REST_TOKEN: "x" })).toBeNull();
  });
});

describe("sinal de presença", () => {
  it("valida o formato do id", () => {
    expect(idValido(ID)).toBe(true);
    expect(idValido("abc")).toBe(false);
    expect(idValido(`${ID}0`)).toBe(false);
    expect(idValido(42)).toBe(false);
  });

  it("limita ids novos por IP", () => {
    for (let i = 0; i < 30; i++) expect(aceitarId("1.1.1.1", i.toString(16).padStart(32, "0"), 0)).toBe(true);
    expect(aceitarId("1.1.1.1", "f".repeat(32), 0)).toBe(false);
    expect(aceitarId("1.1.1.1", "0".repeat(32), 0)).toBe(true);
    expect(aceitarId("2.2.2.2", "f".repeat(32), 0)).toBe(true);
    expect(aceitarId("1.1.1.1", "f".repeat(32), 61_000)).toBe(true);
  });

  it("grava o sinal, remove os vencidos e conta", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const cmds = JSON.parse(String(init?.body)) as unknown[][];
      return new Response(JSON.stringify(cmds.map((c) => ({ result: c[0] === "ZCARD" ? 7 : 1 }))));
    });
    const n = await registrarSinal(ID, { cfg: CFG, agora: 1_000_000, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(n).toBe(7);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://exemplo.upstash.io/pipeline");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer t");
    expect(JSON.parse(String(init?.body))).toEqual([
      ["ZADD", "av:presenca", 1_000_000, ID],
      ["ZREMRANGEBYSCORE", "av:presenca", "-inf", 1_000_000 - JANELA_MS],
      ["ZCARD", "av:presenca"],
      ["PEXPIRE", "av:presenca", JANELA_MS * 3],
    ]);
    // Dentro de 5 s, só grava e reaproveita a contagem.
    await registrarSinal(ID, { cfg: CFG, agora: 1_002_000, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toHaveLength(1);
  });

  it("sem configuração ou com erro do Redis, devolve null (nada inventado)", async () => {
    expect(await registrarSinal(ID, { cfg: null })).toBeNull();
    const falha = vi.fn(async () => new Response("x", { status: 500 }));
    expect(await registrarSinal(ID, { cfg: CFG, fetchImpl: falha as unknown as typeof fetch })).toBeNull();
  });
});

const area = (cd: string, a: number, b: number): AreaMapa => ({
  cd, nome: cd.toUpperCase(), ibge: null, secoesTotal: 10, secoesTotalizadas: a + b > 0 ? 5 : 0, percentualSecoes: 50,
  eleitorado: 100, eleitoradoFaltando: 50, votos: a + b > 0 ? { "13": a, "22": b } : null, validos: a + b, atualizadoEmFonte: null, finalizada: false,
});

describe("boletim", () => {
  it("conta onde cada um está à frente, ignorando empates e áreas sem votos", () => {
    expect(liderancas([area("sp", 10, 5), area("rj", 3, 9), area("mg", 4, 4), area("ba", 0, 0)], ["13", "22"])).toEqual([1, 1]);
  });

  it("lista as viradas em relação ao 1º turno", () => {
    const pt = [
      { cd: "sp", votos: { "13": 40, "22": 60 }, validos: 100 },
      { cd: "rj", votos: { "13": 40, "22": 60 }, validos: 100 },
    ];
    expect(viradas([area("sp", 10, 5), area("rj", 3, 9)], pt, ["13", "22"])).toEqual([{ cd: "sp", nome: "São Paulo", antes: 1, agora: 0 }]);
  });

  it("texto do WhatsApp antes da apuração não traz números", () => {
    expect(textoWhatsapp(null, 0, "https://x")).toContain("https://x");
  });
});

describe("rota /api/presenca", () => {
  it("recusa id inválido e responde null sem Redis configurado", async () => {
    const { POST } = await import("@/app/api/presenca/route");
    const { NextRequest } = await import("next/server");
    const req = (corpo: string) => new NextRequest("http://localhost/api/presenca", { method: "POST", body: corpo, headers: { "content-type": "application/json" } });
    expect((await POST(req('{"id":"x"}'))).status).toBe(400);
    expect((await POST(req("nao-json"))).status).toBe(400);
    const ok = await POST(req(JSON.stringify({ id: ID })));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ agora: null });
  });
});
