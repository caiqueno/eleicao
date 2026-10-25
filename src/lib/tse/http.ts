import { TSE_BASE_URL } from "@/config/eleicao";

export class ErroFonte extends Error {
  constructor(
    message: string,
    readonly tipo: "tempo-limite" | "conexao" | "http" | "nao-encontrado" | "formato",
    readonly status?: number,
  ) {
    super(message);
    this.name = "ErroFonte";
  }
}

const HOST_PERMITIDO = new URL(TSE_BASE_URL).host;
/** Segmentos de caminho aceitos: só letras minúsculas, dígitos, hífen, ponto e sublinhado. */
const SEGMENTO_SEGURO = /^[a-z0-9._-]+$/;

/**
 * Monta uma URL do TSE a partir de segmentos já validados. Impede que
 * parâmetros do usuário apontem a consulta para outro host ou caminho.
 */
export function urlTse(...segmentos: string[]): string {
  for (const s of segmentos) {
    if (!SEGMENTO_SEGURO.test(s) || s === "." || s === "..") {
      throw new Error(`Segmento de caminho inválido: ${s}`);
    }
  }
  const url = new URL(`/${segmentos.join("/")}`, TSE_BASE_URL);
  if (url.host !== HOST_PERMITIDO || url.protocol !== "https:") {
    throw new Error("Destino não permitido");
  }
  return url.toString();
}

export interface OpcoesBusca {
  timeoutMs?: number;
  /** Segundos de cache no Data Cache do Next.js. */
  revalidar?: number;
  fetchImpl?: typeof fetch;
}

/** Busca texto de um arquivo do TSE com tempo limite e erros tipados. */
export async function buscarTexto(url: string, opcoes: OpcoesBusca = {}): Promise<string> {
  const destino = new URL(url);
  if (destino.host !== HOST_PERMITIDO || destino.protocol !== "https:") {
    throw new Error("Destino não permitido");
  }
  const { timeoutMs = 8000, revalidar = 30, fetchImpl = fetch } = opcoes;
  let resposta: Response;
  try {
    resposta = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json, text/plain, */*" },
      next: { revalidate: revalidar },
    } as RequestInit);
  } catch (erro) {
    const nome = (erro as { name?: string })?.name;
    if (nome === "TimeoutError" || nome === "AbortError") {
      throw new ErroFonte("Tempo limite excedido ao consultar o TSE", "tempo-limite");
    }
    throw new ErroFonte("Falha de conexão com o TSE", "conexao");
  }
  if (resposta.status === 404) {
    throw new ErroFonte("Arquivo ainda não publicado pelo TSE", "nao-encontrado", resposta.status);
  }
  if (!resposta.ok) {
    throw new ErroFonte(`TSE respondeu HTTP ${resposta.status}`, "http", resposta.status);
  }
  return resposta.text();
}
