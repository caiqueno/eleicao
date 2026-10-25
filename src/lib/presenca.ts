/**
 * Contador de pessoas com a página aberta agora.
 *
 * Cada navegador manda um sinal (id aleatório gerado no próprio navegador) a
 * cada ~45 s. O servidor guarda id → horário do último sinal num conjunto
 * ordenado do Redis (Upstash, pela API REST) e conta quantos sinais chegaram
 * nos últimos JANELA_MS. Também guarda o mesmo id num conjunto do dia (horário de
 * Brasília) para contar quantos aparelhos diferentes abriram o site hoje; esse
 * conjunto expira sozinho em 3 dias. Não guarda IP, nome nem nada que identifique a pessoa.
 *
 * Sem as variáveis do Upstash configuradas na Vercel, o contador fica
 * indisponível e a tela não mostra número nenhum.
 */

export const JANELA_MS = 100_000;
export const INTERVALO_SINAL_S = 45;
const CHAVE = "av:presenca";
const PREFIXO_DIA = "av:dia:";
const EXPIRA_DIA_S = 3 * 24 * 3600;
/** Limpeza dos sinais vencidos e leitura da contagem: no máximo uma vez a cada 5 s por instância. */
const INTERVALO_CONTAGEM_MS = 5_000;
/** Ids novos aceitos por IP por minuto, por instância (evita inflar o número com ids inventados). */
const MAXIMO_IDS_POR_IP = 30;
const ID_VALIDO = /^[a-f0-9]{32}$/;

export interface ConfigRedis {
  url: string;
  token: string;
}

/** Lê a configuração do Upstash criada pela integração da Vercel. Só aceita hosts do Upstash por HTTPS. */
export function configRedis(env: Record<string, string | undefined> = process.env): ConfigRedis | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !u.hostname.endsWith(".upstash.io")) return null;
    return { url: u.origin, token };
  } catch {
    return null;
  }
}

export const idValido = (id: unknown): id is string => typeof id === "string" && ID_VALIDO.test(id);

/** Data de hoje em Brasília (AAAA-MM-DD), que dá nome ao conjunto do dia. */
export function diaBrasilia(agora: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

export interface Contagem {
  /** Aparelhos com a página aberta nos últimos JANELA_MS. */
  agora: number | null;
  /** Aparelhos diferentes que abriram o site hoje (horário de Brasília). */
  hoje: number | null;
}

const VAZIA: Contagem = { agora: null, hoje: null };
const contagemValida = (n: unknown): number | null => {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : null;
};

let ultimaContagem: { em: number; valor: Contagem } | null = null;
const idsPorIp = new Map<string, { inicio: number; ids: Set<string> }>();

/** Limite simples por IP mantido só na memória da instância (o IP não é gravado em lugar nenhum). */
export function aceitarId(ip: string, id: string, agora = Date.now()): boolean {
  let r = idsPorIp.get(ip);
  if (!r || agora - r.inicio > 60_000) {
    r = { inicio: agora, ids: new Set() };
    idsPorIp.set(ip, r);
    if (idsPorIp.size > 5_000) idsPorIp.clear();
  }
  if (r.ids.has(id)) return true;
  if (r.ids.size >= MAXIMO_IDS_POR_IP) return false;
  r.ids.add(id);
  return true;
}

async function pipeline(cfg: ConfigRedis, comandos: (string | number)[][], fetchImpl: typeof fetch): Promise<unknown[]> {
  const r = await fetchImpl(`${cfg.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(comandos),
    cache: "no-store",
    signal: AbortSignal.timeout(4_000),
  });
  if (!r.ok) throw new Error(`Redis HTTP ${r.status}`);
  const corpo = (await r.json()) as { result?: unknown; error?: string }[];
  if (!Array.isArray(corpo) || corpo.some((c) => c.error)) throw new Error("Resposta inválida do Redis");
  return corpo.map((c) => c.result);
}

/** Registra o sinal e devolve as contagens de agora e de hoje (null onde estiver indisponível). */
export async function registrarSinal(
  id: string,
  opcoes: { cfg?: ConfigRedis | null; agora?: number; fetchImpl?: typeof fetch } = {},
): Promise<Contagem> {
  const cfg = opcoes.cfg === undefined ? configRedis() : opcoes.cfg;
  if (!cfg) return VAZIA;
  const agora = opcoes.agora ?? Date.now();
  const dia = PREFIXO_DIA + diaBrasilia(agora);
  const contar = !ultimaContagem || agora - ultimaContagem.em >= INTERVALO_CONTAGEM_MS;
  const comandos: (string | number)[][] = [
    ["ZADD", CHAVE, agora, id],
    ["SADD", dia, id],
  ];
  if (contar) {
    comandos.push(
      ["ZREMRANGEBYSCORE", CHAVE, "-inf", agora - JANELA_MS],
      ["ZCARD", CHAVE],
      ["PEXPIRE", CHAVE, JANELA_MS * 3],
      ["SCARD", dia],
      ["EXPIRE", dia, EXPIRA_DIA_S],
    );
  }
  try {
    const res = await pipeline(cfg, comandos, opcoes.fetchImpl ?? fetch);
    if (contar) {
      const valor = { agora: contagemValida(res[3]), hoje: contagemValida(res[5]) };
      if (valor.agora === null) return VAZIA;
      // Quem está aqui agora também abriu hoje: "hoje" nunca fica abaixo de "agora".
      if (valor.hoje !== null && valor.hoje < valor.agora) valor.hoje = valor.agora;
      ultimaContagem = { em: agora, valor };
    }
    return ultimaContagem?.valor ?? VAZIA;
  } catch {
    return VAZIA;
  }
}

export function limparPresenca(): void {
  ultimaContagem = null;
  idsPorIp.clear();
}
