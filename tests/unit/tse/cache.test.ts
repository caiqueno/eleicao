// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { obterArquivo, PAUSA_BLOQUEIO_MS, TTL_404_MS, TTL_OK_MS } from "@/lib/tse/cache";
import { consultarResultado } from "@/lib/tse/servico";
import { fetchFalso, fixture, gerarJws, proibirRedeReal, responder, textoFixture, URL_CONFIG_TSE, urlResultadoTse } from "./auxiliares";

proibirRedeReal();

const URL = "https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.jws";

function relogio(inicio = Date.parse("2026-10-25T21:00:00Z")) {
  let t = inicio;
  return { agora: () => t, avancar: (ms: number) => (t += ms) };
}

describe("obterArquivo", () => {
  it("guarda a hora real do download e não refaz a consulta dentro do TTL", async () => {
    const r = relogio();
    const f = fetchFalso({ [URL]: responder("v1") });
    const a = await obterArquivo(URL, TTL_OK_MS, { fetchImpl: f }, r.agora);
    r.avancar(TTL_OK_MS - 1_000);
    const b = await obterArquivo(URL, TTL_OK_MS, { fetchImpl: f }, r.agora);
    expect(b).toBe(a);
    expect(a.obtidoEm).toBe("2026-10-25T21:00:00.000Z");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("depois do TTL baixa de novo e atualiza a hora", async () => {
    const r = relogio();
    const f = fetchFalso({ [URL]: responder("v1") });
    await obterArquivo(URL, TTL_OK_MS, { fetchImpl: f }, r.agora);
    r.avancar(TTL_OK_MS + 1);
    const b = await obterArquivo(URL, TTL_OK_MS, { fetchImpl: f }, r.agora);
    expect(b.obtidoEm).toBe(new Date(r.agora()).toISOString());
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("nunca serve dado vencido como novo quando o TSE falha", async () => {
    const r = relogio();
    let falhar = false;
    const f = fetchFalso({ [URL]: () => (falhar ? new Response("", { status: 500 }) : new Response("v1")) });
    await obterArquivo(URL, TTL_OK_MS, { fetchImpl: f }, r.agora);
    r.avancar(TTL_OK_MS + 1);
    falhar = true;
    await expect(obterArquivo(URL, TTL_OK_MS, { fetchImpl: f }, r.agora)).rejects.toMatchObject({ tipo: "http" });
  });

  it("deduplica requisições simultâneas", async () => {
    const f = fetchFalso({ [URL]: responder("v1") });
    const [a, b, c] = await Promise.all([1, 2, 3].map(() => obterArquivo(URL, TTL_OK_MS, { fetchImpl: f })));
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("guarda 404 por um tempo (não insiste no TSE)", async () => {
    const r = relogio();
    const f = fetchFalso({});
    await expect(obterArquivo(URL, TTL_OK_MS, { fetchImpl: f }, r.agora)).rejects.toMatchObject({ tipo: "nao-encontrado" });
    await expect(obterArquivo(URL, TTL_OK_MS, { fetchImpl: f }, r.agora)).rejects.toMatchObject({ tipo: "nao-encontrado" });
    expect(f).toHaveBeenCalledTimes(1);
    r.avancar(TTL_404_MS + 1);
    await expect(obterArquivo(URL, TTL_OK_MS, { fetchImpl: f }, r.agora)).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(2);
  });

  it.each([403, 429])("após HTTP %i pausa todas as consultas por 10 minutos", async (status) => {
    const r = relogio();
    const outra = URL.replace("/br/br-", "/sp/sp-");
    const f = fetchFalso({ [URL]: responder("", status), [outra]: responder("ok") });
    await expect(obterArquivo(URL, TTL_OK_MS, { fetchImpl: f }, r.agora)).rejects.toMatchObject({ status });
    r.avancar(60_000);
    await expect(obterArquivo(outra, TTL_OK_MS, { fetchImpl: f }, r.agora)).rejects.toMatchObject({ status: 429 });
    expect(f).toHaveBeenCalledTimes(1);
    r.avancar(PAUSA_BLOQUEIO_MS);
    await expect(obterArquivo(outra, TTL_OK_MS, { fetchImpl: f }, r.agora)).resolves.toMatchObject({ texto: "ok" });
  });
});

describe("consultarResultado com cache", () => {
  it("consultadoEm é a hora do download no TSE, não a hora da resposta", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-25T21:00:00Z"));
      const f = fetchFalso({
        [URL_CONFIG_TSE]: responder(textoFixture("ele-c.trecho-real.json")),
        [urlResultadoTse("6258", "1", "br")]: responder(gerarJws(fixture("simulado-parcial.json"))),
      });
      await consultarResultado("presidente", "br", { fetchImpl: f });
      vi.setSystemTime(new Date("2026-10-25T21:00:05Z"));
      const r = await consultarResultado("presidente", "br", { fetchImpl: f });
      expect(r.consultadoEm).toBe("2026-10-25T21:00:00.000Z");
      expect(f).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("depois de achar o .jws não tenta mais o .json", async () => {
    const f = fetchFalso({
      [URL_CONFIG_TSE]: responder(textoFixture("ele-c.trecho-real.json")),
      [urlResultadoTse("6258", "1", "br")]: responder(gerarJws(fixture("simulado-parcial.json"))),
    });
    await consultarResultado("presidente", "br", { fetchImpl: f });
    const r = await consultarResultado("presidente", "sp", { fetchImpl: f });
    expect(r.estado).toBe("sem-dados");
    const urls = f.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.endsWith(".json") && u.includes("/dados/"))).toBe(false);
  });
});
