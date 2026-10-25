import { buscarTexto, ErroFonte, type OpcoesBusca } from "./http";

/**
 * Cache em memória das consultas ao TSE, por instância da função.
 *
 * - Guarda a hora real do download (`obtidoEm`), que é a hora mostrada como
 *   "consultado às". Nada é servido vencido como se fosse novo.
 * - Deduplica requisições simultâneas para a mesma URL.
 * - Guarda também 404 e erros por pouco tempo, para não insistir no TSE.
 * - Depois de HTTP 403 ou 429 (bloqueio por excesso de requisições, segundo o
 *   TSE), para de consultar por 10 minutos: tentar durante o bloqueio o renova.
 */

export const TTL_OK_MS = 30_000;
export const TTL_404_MS = 30_000;
export const TTL_ERRO_MS = 15_000;
export const PAUSA_BLOQUEIO_MS = 10 * 60_000;

export interface ArquivoTse {
  texto: string;
  /** Hora (ISO 8601 UTC) em que o arquivo foi de fato baixado do TSE. */
  obtidoEm: string;
}

type Entrada =
  | { tipo: "ok"; arquivo: ArquivoTse; expira: number }
  | { tipo: "erro"; erro: ErroFonte; expira: number };

const entradas = new Map<string, Entrada>();
const emAndamento = new Map<string, Promise<ArquivoTse>>();
let bloqueadoAte = 0;

export function limparCacheTse() {
  entradas.clear();
  emAndamento.clear();
  bloqueadoAte = 0;
}

export async function obterArquivo(
  url: string,
  ttlOkMs: number = TTL_OK_MS,
  opcoes: OpcoesBusca = {},
  agora: () => number = Date.now,
): Promise<ArquivoTse> {
  const t = agora();
  const entrada = entradas.get(url);
  if (entrada && entrada.expira > t) {
    if (entrada.tipo === "ok") return entrada.arquivo;
    throw entrada.erro;
  }
  if (bloqueadoAte > t) {
    throw new ErroFonte("Consultas ao TSE pausadas após bloqueio temporário da fonte", "http", 429);
  }
  const pendente = emAndamento.get(url);
  if (pendente) return pendente;

  const promessa = buscarTexto(url, opcoes)
    .then((texto) => {
      const arquivo = { texto, obtidoEm: new Date(agora()).toISOString() };
      entradas.set(url, { tipo: "ok", arquivo, expira: agora() + ttlOkMs });
      return arquivo;
    })
    .catch((erro: unknown) => {
      const e = erro instanceof ErroFonte ? erro : new ErroFonte("Falha ao consultar o TSE", "conexao");
      if (e.status === 403 || e.status === 429) bloqueadoAte = agora() + PAUSA_BLOQUEIO_MS;
      const ttl = e.tipo === "nao-encontrado" ? TTL_404_MS : TTL_ERRO_MS;
      entradas.set(url, { tipo: "erro", erro: e, expira: agora() + ttl });
      throw e;
    })
    .finally(() => emAndamento.delete(url));
  emAndamento.set(url, promessa);
  return promessa;
}
