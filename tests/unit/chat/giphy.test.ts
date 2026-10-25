import { describe, expect, it } from "vitest";
import { validarChat } from "@/lib/chat";
import { buscarGifs, chaveGiphy, gifPermitido } from "@/lib/giphy";

const CHAVE = "abcdefghijklmnop1234";
const AP = "a".repeat(32);

function giphyFalso(dados: unknown) {
  const pedidos: URL[] = [];
  const fetchImpl = (async (u: string | URL | Request) => {
    pedidos.push(new URL(String(u)));
    return new Response(JSON.stringify(dados));
  }) as unknown as typeof fetch;
  return { pedidos, fetchImpl };
}

describe("GIFs do GIPHY", () => {
  it("sem chave configurada fica desligado", async () => {
    expect(chaveGiphy({})).toBeNull();
    expect(chaveGiphy({ GIPHY_API_KEY: "curta" })).toBeNull();
    expect(await buscarGifs("gol", { chave: null })).toBeNull();
    expect(await gifPermitido("abcdef123", { chave: null })).toBe(false);
  });

  it("busca só no api.giphy.com, com classificação pg, e devolve só ids", async () => {
    const g = giphyFalso({
      data: [
        { id: "AbC123xyz", rating: "g", images: { fixed_width: { width: "200", height: "100" } } },
        { id: "Xyz987abc", rating: "r" },
        { id: "../../evil", rating: "g" },
      ],
    });
    const r = await buscarGifs("  festa   eleição ", { chave: CHAVE, fetchImpl: g.fetchImpl });
    expect(r).toEqual([{ id: "AbC123xyz", r: 2 }]);
    const u = g.pedidos[0];
    expect(u.origin).toBe("https://api.giphy.com");
    expect(u.pathname).toBe("/v1/gifs/search");
    expect(u.searchParams.get("rating")).toBe("pg");
    expect(u.searchParams.get("q")).toBe("festa eleição");
  });

  it("sem termo mostra os GIFs em alta", async () => {
    const g = giphyFalso({ data: [] });
    await buscarGifs("", { chave: CHAVE, fetchImpl: g.fetchImpl });
    expect(g.pedidos[0].pathname).toBe("/v1/gifs/trending");
  });

  it("confere a classificação do GIF enviado", async () => {
    expect(await gifPermitido("AbC123xyz", { chave: CHAVE, fetchImpl: giphyFalso({ data: { id: "AbC123xyz", rating: "pg" } }).fetchImpl })).toBe(true);
    expect(await gifPermitido("AbC123xyz", { chave: CHAVE, fetchImpl: giphyFalso({ data: { id: "AbC123xyz", rating: "r" } }).fetchImpl })).toBe(false);
    expect(await gifPermitido("https://x.io/a.gif", { chave: CHAVE, fetchImpl: giphyFalso({}).fetchImpl })).toBe(false);
  });

  it("mensagem pode ser só um GIF, mas o id tem de ser válido", () => {
    expect(validarChat({ texto: "", apelido: "Ana", aparelho: AP, gif: "AbC123xyz" })).toMatchObject({ ok: true, texto: "", gif: "AbC123xyz" });
    expect(validarChat({ texto: "", apelido: "Ana", aparelho: AP }).ok).toBe(false);
    expect(validarChat({ texto: "oi", apelido: "Ana", aparelho: AP, gif: "https://evil.com/x.gif" }).ok).toBe(false);
    expect(validarChat({ texto: "vote no 13", apelido: "Ana", aparelho: AP, gif: "AbC123xyz" }).ok).toBe(false);
  });
});
