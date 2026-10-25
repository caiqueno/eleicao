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

/** Limite de segurança: os arquivos usados têm dezenas de KB. */
const TAMANHO_MAXIMO = 5 * 1024 * 1024;
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
  fetchImpl?: typeof fetch;
}

/**
 * Limite de requisições simultâneas ao TSE por instância. Com arquivos de
 * dezenas de KB isso fica bem abaixo de 100 req/s, o limite que o TSE pune
 * com bloqueio de 10 minutos.
 */
export const MAXIMO_SIMULTANEAS = 6;
let emUso = 0;
const fila: (() => void)[] = [];

async function comVaga<T>(tarefa: () => Promise<T>): Promise<T> {
  if (emUso >= MAXIMO_SIMULTANEAS) await new Promise<void>((liberar) => fila.push(liberar));
  emUso++;
  try {
    return await tarefa();
  } finally {
    emUso--;
    fila.shift()?.();
  }
}

/** Busca texto de um arquivo do TSE com tempo limite e erros tipados. */
export function buscarTexto(url: string, opcoes: OpcoesBusca = {}): Promise<string> {
  return comVaga(() => buscar(url, opcoes, "texto")) as Promise<string>;
}

/** Busca um arquivo binário do TSE (fotos oficiais), com as mesmas regras. */
export function buscarBytes(url: string, opcoes: OpcoesBusca = {}): Promise<ArrayBuffer> {
  return comVaga(() => buscar(url, opcoes, "bytes")) as Promise<ArrayBuffer>;
}

async function buscar(url: string, opcoes: OpcoesBusca, formato: "texto" | "bytes"): Promise<string | ArrayBuffer> {
  const destino = new URL(url);
  if (destino.host !== HOST_PERMITIDO || destino.protocol !== "https:") {
    throw new Error("Destino não permitido");
  }
  const { timeoutMs = 8000, fetchImpl = fetch } = opcoes;
  let resposta: Response;
  try {
    resposta = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json, text/plain, */*" },
      // Sem o Data Cache do Next: o cache fica em cache.ts, que sabe a hora real do download.
      cache: "no-store",
    });
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
  const tamanho = Number(resposta.headers.get("content-length") ?? 0);
  if (tamanho > TAMANHO_MAXIMO) throw new ErroFonte("Arquivo do TSE maior que o esperado", "formato");
  if (formato === "bytes") {
    const bytes = await resposta.arrayBuffer();
    if (bytes.byteLength > TAMANHO_MAXIMO) throw new ErroFonte("Arquivo do TSE maior que o esperado", "formato");
    return bytes;
  }
  const texto = await resposta.text();
  if (texto.length > TAMANHO_MAXIMO) throw new ErroFonte("Arquivo do TSE maior que o esperado", "formato");
  return texto;
}
