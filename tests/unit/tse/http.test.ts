// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { buscarTexto, ErroFonte, urlTse } from "@/lib/tse/http";
import { proibirRedeReal, travar } from "./auxiliares";

proibirRedeReal();

const URL_OK = "https://resultados.tse.jus.br/oficial/comum/config/ele-c.json";

describe("urlTse", () => {
  it("monta URL https no host do TSE", () => {
    expect(urlTse("oficial", "comum", "config", "ele-c.json")).toBe(URL_OK);
  });

  it.each([[".."], ["."], ["/"], ["a/b"], ["../x"], ["br?x"], ["br#x"], ["%2e%2e"], [""], ["BR"], ["a b"], ["@evil.com"], ["\\evil"], ["https:"]])(
    "rejeita segmento %j",
    (s) => {
      expect(() => urlTse("oficial", s)).toThrow(/Segmento de caminho inválido/);
    },
  );

  it("um 'host externo' como segmento vira só caminho no host do TSE", () => {
    const url = new URL(urlTse("evil.com", "x"));
    expect(url.host).toBe("resultados.tse.jus.br");
    expect(url.pathname).toBe("/evil.com/x");
  });
});

describe("buscarTexto", () => {
  it("devolve o corpo e manda tempo limite, Accept e revalidate", async () => {
    const f = vi.fn(async () => new Response("conteúdo", { status: 200 }));
    await expect(buscarTexto(URL_OK, { fetchImpl: f, revalidar: 7 })).resolves.toBe("conteúdo");
    const init = (f.mock.calls[0] as unknown[])[1] as RequestInit & { next: { revalidate: number } };
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.next.revalidate).toBe(7);
    expect((init.headers as Record<string, string>).Accept).toContain("application/json");
  });

  it("rejeita host externo sem chamar o fetch", async () => {
    const f = vi.fn();
    await expect(buscarTexto("https://evil.example.com/x", { fetchImpl: f })).rejects.toThrow(/Destino não permitido/);
    await expect(buscarTexto("https://resultados.tse.jus.br.evil.com/x", { fetchImpl: f })).rejects.toThrow(/Destino não permitido/);
    expect(f).not.toHaveBeenCalled();
  });

  // BUG (baixo): buscarTexto confere só o host, não o protocolo; urlTse confere os dois.
  it("rejeita http:// (sem TLS) no host do TSE (bug corrigido)", async () => {
    const f = vi.fn(async () => new Response("x"));
    await expect(buscarTexto("http://resultados.tse.jus.br/oficial/x", { fetchImpl: f })).rejects.toThrow();
  });

  it("tempo limite real (sinal abortado) → ErroFonte tempo-limite", async () => {
    const erro = await buscarTexto(URL_OK, { fetchImpl: vi.fn((_u: unknown, init?: RequestInit) => travar(init)) as unknown as typeof fetch, timeoutMs: 20 }).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroFonte);
    expect(erro.tipo).toBe("tempo-limite");
  });

  it.each([["TimeoutError"], ["AbortError"]])("%s → tempo-limite", async (nome) => {
    const f = vi.fn(async () => {
      throw new DOMException("x", nome);
    });
    await expect(buscarTexto(URL_OK, { fetchImpl: f })).rejects.toMatchObject({ name: "ErroFonte", tipo: "tempo-limite" });
  });

  it("erro de rede → ErroFonte conexao", async () => {
    const f = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(buscarTexto(URL_OK, { fetchImpl: f })).rejects.toMatchObject({ name: "ErroFonte", tipo: "conexao" });
  });

  it("404 → ErroFonte nao-encontrado", async () => {
    const f = vi.fn(async () => new Response("", { status: 404 }));
    await expect(buscarTexto(URL_OK, { fetchImpl: f })).rejects.toMatchObject({ tipo: "nao-encontrado", status: 404 });
  });

  it.each([[500], [403], [503], [429]])("%i → ErroFonte http", async (status) => {
    const f = vi.fn(async () => new Response("", { status }));
    await expect(buscarTexto(URL_OK, { fetchImpl: f })).rejects.toMatchObject({ tipo: "http", status });
  });
});
