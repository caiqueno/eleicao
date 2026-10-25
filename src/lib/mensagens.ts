/**
 * Caixa de entrada do "Fale com a gente".
 *
 * O visitante manda uma mensagem e o e-mail para resposta. Tudo fica numa lista
 * do Redis (Upstash) que só a página /inbox lê, com a senha da variável de
 * ambiente INBOX_SENHA. Guarda só data, e-mail e texto; nada de IP. O limite de
 * envios usa um resumo (SHA-256) do IP que expira em 10 minutos. As mensagens
 * expiram em 90 dias e a lista guarda no máximo as 2.000 mais recentes.
 */
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { configRedis, pipeline, type ConfigRedis } from "./presenca";

export const CHAVE_INBOX = "av:inbox";
export const MAX_TEXTO = 1000;
export const MAX_EMAIL = 254;
const MAX_MENSAGENS = 2000;
const EXPIRA_INBOX_S = 90 * 24 * 3600;
const JANELA_LIMITE_S = 600;
/** Envios por IP a cada 10 minutos. */
export const MAX_ENVIOS = 3;
const EMAIL_VALIDO = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

export interface Mensagem {
  id: string;
  em: string;
  email: string;
  texto: string;
}

export type Validacao = { ok: true; email: string; texto: string } | { ok: false; erro: string };

/** Confere o pedido do formulário. `site` é um campo escondido: se vier preenchido, é robô. */
export function validarMensagem(corpo: unknown): Validacao {
  if (!corpo || typeof corpo !== "object") return { ok: false, erro: "Pedido inválido" };
  const { email, texto, aceite, site } = corpo as Record<string, unknown>;
  if (site) return { ok: false, erro: "Pedido inválido" };
  if (aceite !== true) return { ok: false, erro: "Marque que concorda com o contato por e-mail" };
  if (typeof email !== "string" || typeof texto !== "string") return { ok: false, erro: "Pedido inválido" };
  const e = email.trim().toLowerCase();
  // Tira caracteres de controle; o texto é mostrado sempre como texto, nunca como HTML.
  const t = texto.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (e.length > MAX_EMAIL || !EMAIL_VALIDO.test(e)) return { ok: false, erro: "E-mail inválido" };
  if (t.length < 2) return { ok: false, erro: "Escreva sua mensagem" };
  if (t.length > MAX_TEXTO) return { ok: false, erro: `A mensagem passa de ${MAX_TEXTO} caracteres` };
  return { ok: true, email: e, texto: t };
}

const resumoIp = (ip: string) => createHash("sha256").update(`av-inbox:${ip}`).digest("hex").slice(0, 32);

export type ResultadoEnvio = "ok" | "limite" | "indisponivel";

export async function guardarMensagem(
  dados: { email: string; texto: string; ip: string },
  opcoes: { cfg?: ConfigRedis | null; agora?: number; fetchImpl?: typeof fetch } = {},
): Promise<ResultadoEnvio> {
  const cfg = opcoes.cfg === undefined ? configRedis() : opcoes.cfg;
  if (!cfg) return "indisponivel";
  const f = opcoes.fetchImpl ?? fetch;
  const lim = `av:inbox:lim:${resumoIp(dados.ip)}`;
  try {
    const [n] = await pipeline(cfg, [["INCR", lim], ["EXPIRE", lim, JANELA_LIMITE_S, "NX"]], f);
    if (Number(n) > MAX_ENVIOS) return "limite";
    const m: Mensagem = { id: randomUUID(), em: new Date(opcoes.agora ?? Date.now()).toISOString(), email: dados.email, texto: dados.texto };
    await pipeline(cfg, [["LPUSH", CHAVE_INBOX, JSON.stringify(m)], ["LTRIM", CHAVE_INBOX, 0, MAX_MENSAGENS - 1], ["EXPIRE", CHAVE_INBOX, EXPIRA_INBOX_S]], f);
    return "ok";
  } catch {
    return "indisponivel";
  }
}

export async function lerMensagens(opcoes: { cfg?: ConfigRedis | null; fetchImpl?: typeof fetch } = {}): Promise<Mensagem[] | null> {
  const cfg = opcoes.cfg === undefined ? configRedis() : opcoes.cfg;
  if (!cfg) return null;
  try {
    const [lista] = await pipeline(cfg, [["LRANGE", CHAVE_INBOX, 0, 499]], opcoes.fetchImpl ?? fetch);
    if (!Array.isArray(lista)) return [];
    return lista.flatMap((s) => {
      try {
        const m = JSON.parse(String(s)) as Mensagem;
        return typeof m.email === "string" && typeof m.texto === "string" ? [m] : [];
      } catch {
        return [];
      }
    });
  } catch {
    return null;
  }
}

/** Compara a senha em tempo constante. Sem INBOX_SENHA configurada (ou curta demais), ninguém entra. */
export function senhaConfere(recebida: string | null, esperada: string | undefined = process.env.INBOX_SENHA): boolean {
  if (!esperada || esperada.length < 16 || !recebida) return false;
  const a = createHash("sha256").update(recebida).digest();
  const b = createHash("sha256").update(esperada).digest();
  return timingSafeEqual(a, b);
}
