/**
 * GIFs do bate-papo, pelo GIPHY.
 *
 * A chave (GIPHY_API_KEY) fica só no servidor. O navegador recebe apenas ids de GIF,
 * e as imagens são montadas sempre com o endereço fixo do GIPHY (media.giphy.com),
 * então nenhuma URL arbitrária entra no chat. A busca e a checagem do GIF enviado
 * usam a classificação "pg" do GIPHY (conteúdo livre e leve).
 */
import { GIF_ID } from "./chat";

const API = "https://api.giphy.com/v1/gifs";
const CLASSIFICACOES_OK = new Set(["g", "pg"]);
export const MAX_BUSCA = 50;

export interface Gif {
  id: string;
  /** Proporção largura/altura, para reservar o espaço antes de a imagem chegar. */
  r: number;
}

/** Imagem de 200 px de largura em WebP, servida pelo próprio GIPHY. */
export const urlGif = (id: string) => `https://media.giphy.com/media/${id}/200w.webp`;

export const chaveGiphy = (env: Record<string, string | undefined> = process.env) => {
  const k = env.GIPHY_API_KEY?.trim();
  return k && /^[A-Za-z0-9]{16,64}$/.test(k) ? k : null;
};

interface ItemGiphy {
  id?: unknown;
  rating?: unknown;
  images?: { fixed_width?: { width?: unknown; height?: unknown } };
}

function paraGif(it: ItemGiphy): Gif[] {
  if (typeof it.id !== "string" || !GIF_ID.test(it.id)) return [];
  if (typeof it.rating !== "string" || !CLASSIFICACOES_OK.has(it.rating)) return [];
  const w = Number(it.images?.fixed_width?.width);
  const h = Number(it.images?.fixed_width?.height);
  return [{ id: it.id, r: w > 0 && h > 0 ? Math.round((w / h) * 100) / 100 : 1 }];
}

/** Busca (ou, sem termo, os GIFs em alta). Devolve null se o GIPHY não estiver configurado ou falhar. */
export async function buscarGifs(termo: string, opcoes: { chave?: string | null; fetchImpl?: typeof fetch } = {}): Promise<Gif[] | null> {
  const chave = opcoes.chave === undefined ? chaveGiphy() : opcoes.chave;
  if (!chave) return null;
  const q = termo.replace(/\s+/g, " ").trim().slice(0, MAX_BUSCA);
  const u = new URL(q ? `${API}/search` : `${API}/trending`);
  u.searchParams.set("api_key", chave);
  if (q) {
    u.searchParams.set("q", q);
    u.searchParams.set("lang", "pt");
  }
  u.searchParams.set("limit", "24");
  u.searchParams.set("rating", "pg");
  try {
    const r = await (opcoes.fetchImpl ?? fetch)(u, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: ItemGiphy[] };
    return Array.isArray(j.data) ? j.data.flatMap(paraGif) : [];
  } catch {
    return null;
  }
}

/** Confere no GIPHY se o id existe e tem classificação g ou pg (o navegador pode mandar qualquer id). */
export async function gifPermitido(id: string, opcoes: { chave?: string | null; fetchImpl?: typeof fetch } = {}): Promise<boolean> {
  const chave = opcoes.chave === undefined ? chaveGiphy() : opcoes.chave;
  if (!chave || !GIF_ID.test(id)) return false;
  const u = new URL(`${API}/${id}`);
  u.searchParams.set("api_key", chave);
  try {
    const r = await (opcoes.fetchImpl ?? fetch)(u, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!r.ok) return false;
    const j = (await r.json()) as { data?: ItemGiphy };
    return !!j.data && paraGif(j.data).length === 1;
  } catch {
    return false;
  }
}
