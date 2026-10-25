/**
 * Chat público "Comentários do público".
 *
 * As mensagens ficam numa lista do Redis (Upstash) com as 200 mais recentes, por
 * 3 dias. Cada uma guarda, além de data, apelido e texto, dois resumos (SHA-256):
 * um do id do aparelho e outro do IP. Eles servem só para o limite de envios e
 * para banir, e nunca saem na leitura pública. A moderação (página /inbox, com a
 * senha de INBOX_SENHA) oculta mensagens e bane aparelhos. Três denúncias de IPs
 * diferentes ocultam a mensagem até a moderação olhar.
 */
import { createHash, randomUUID } from "node:crypto";
import { configRedis, pipeline, type ConfigRedis } from "./presenca";

export const CHAVE_CHAT = "av:chat";
const CHAVE_OCULTAS = "av:chat:ocultas";
const CHAVE_BANIDOS = "av:chat:ban";
const PREFIXO_DENUNCIA = "av:chat:den:";
export const MAX_TEXTO_CHAT = 280;
export const MAX_APELIDO = 24;
const MAX_CHAT = 200;
/** Quantas a página pública mostra. */
export const MOSTRAR = 100;
const EXPIRA_CHAT_S = 3 * 24 * 3600;
const EXPIRA_BAN_S = 30 * 24 * 3600;
/** Uma mensagem a cada 10 s e no máximo 5 a cada 5 min, por IP. */
const INTERVALO_S = 10;
const JANELA_S = 300;
export const MAX_POR_JANELA = 5;
export const DENUNCIAS_PARA_OCULTAR = 3;
const ID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const APARELHO_VALIDO = /^[a-f0-9]{32}$/;

export interface MensagemChat {
  id: string;
  em: string;
  apelido: string;
  texto: string;
  /** Id de um GIF do GIPHY (só o id; a URL é montada com o endereço fixo do GIPHY). */
  gif?: string;
}

/** Como fica guardada: com os resumos de aparelho e IP, que só a moderação usa. */
interface Registro extends MensagemChat {
  ah: string;
  ih: string;
}

export interface MensagemModeracao extends MensagemChat {
  oculta: boolean;
  denuncias: number;
}

/** Tira acentos, troca números usados como letras e deixa só letras e espaços. */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[0134@5$]/g, (c) => ({ "0": "o", "1": "i", "3": "e", "4": "a", "@": "a", "5": "s", $: "s" })[c] ?? c)
    .replace(/[^a-z\s]+/g, "")
    .replace(/\s+/g, " ");
}

/** Começos de palavra barrados: palavrões, ofensas e insultos comuns. */
const PALAVROES = [
  "porra", "caralh", "buceta", "boceta", "puta", "puto", "merd", "foda", "fodid", "fodas", "fdp", "vtnc", "vsf", "pqp", "tnc",
  "cuzao", "arrombad", "viado", "veado", "bichona", "traveco", "cacete", "desgracad", "otario", "imbecil", "idiota",
  "retardad", "vagabund", "piranha", "corno", "babaca", "escrot", "canalha", "lazarent",
];
const RE_PALAVRAO = new RegExp(`(^| )(${PALAVROES.join("|")})`);
const RE_LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\s?\.\s?(com|br|net|org|io|ly|me|app|gg|tv|info|xyz|site|online|link|co)\b)/i;
const RE_EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
/** Telefone, CPF e afins: 10 dígitos ou mais seguidos (com ou sem pontuação). */
const RE_DOCUMENTO = /\d(?:[\s.\-()/]*\d){9,}/;
/** Pedido de voto ("vote no 13", "votem em fulano"): o chat não é lugar de propaganda. */
const RE_PEDIDO_VOTO = /(^| )(vote|votem|vota|votar)( n[oa]s?| em| \d)/;
const RE_APELIDO = /^[\p{L}\p{N} ._-]+$/u;
const APELIDO_RESERVADO = /(tse|acompanhevotos|moderad|admin|oficial|equipe|suporte|justica eleitoral|visitante|anonim)/;
const CONTROLE = /[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g;

export const GIF_ID = /^[A-Za-z0-9]{5,40}$/;

export type ValidacaoChat = { ok: true; apelido: string; texto: string; aparelho: string; gif?: string } | { ok: false; erro: string };

/** Regras de conteúdo valem para o texto e para o apelido. Devolve o erro ou null. */
function problemaDeConteudo(s: string): string | null {
  if (RE_LINK.test(s)) return "Links não são permitidos";
  if (RE_EMAIL.test(s) || RE_DOCUMENTO.test(s)) return "Não coloque e-mail, telefone ou documentos";
  const n = ` ${normalizar(s)}`;
  if (RE_PALAVRAO.test(n)) return "Sem palavrões nem ofensas, por favor";
  if (RE_PEDIDO_VOTO.test(n)) return "Pedido de voto e propaganda não são permitidos";
  return null;
}

export function validarChat(corpo: unknown): ValidacaoChat {
  if (!corpo || typeof corpo !== "object") return { ok: false, erro: "Pedido inválido" };
  const { apelido, texto, aparelho, site, gif } = corpo as Record<string, unknown>;
  if (site) return { ok: false, erro: "Pedido inválido" };
  if (typeof texto !== "string" || typeof aparelho !== "string" || !APARELHO_VALIDO.test(aparelho)) return { ok: false, erro: "Pedido inválido" };
  if (gif !== undefined && gif !== null && (typeof gif !== "string" || !GIF_ID.test(gif))) return { ok: false, erro: "GIF inválido" };
  const g = typeof gif === "string" ? gif : undefined;
  if (apelido !== undefined && typeof apelido !== "string") return { ok: false, erro: "Pedido inválido" };
  const t = texto.replace(CONTROLE, "").replace(/\s+/g, " ").trim();
  const a = (apelido ?? "").replace(CONTROLE, "").replace(/\s+/g, " ").trim();
  if (t.length < 2 && !(g && t.length === 0)) return { ok: false, erro: "Escreva seu comentário" };
  if (t.length > MAX_TEXTO_CHAT) return { ok: false, erro: `O comentário passa de ${MAX_TEXTO_CHAT} caracteres` };
  if (!a) return { ok: false, erro: "Informe seu nome para conversar" };
  if (a.length < 2 || a.length > MAX_APELIDO || !RE_APELIDO.test(a)) return { ok: false, erro: `Nome: de 2 a ${MAX_APELIDO} letras ou números` };
  if (APELIDO_RESERVADO.test(normalizar(a))) return { ok: false, erro: "Escolha outro nome" };
  const pa = problemaDeConteudo(a);
  if (pa) return { ok: false, erro: `Nome: ${pa.toLowerCase()}` };
  const p = t ? problemaDeConteudo(t) : null;
  if (p) return { ok: false, erro: p };
  return { ok: true, apelido: a, texto: t, aparelho, ...(g ? { gif: g } : {}) };
}

export const resumo = (tipo: string, valor: string) => createHash("sha256").update(`av-chat:${tipo}:${valor}`).digest("hex").slice(0, 32);

const publico = ({ id, em, apelido, texto, gif }: MensagemChat): MensagemChat => ({ id, em, apelido, texto, ...(gif && GIF_ID.test(gif) ? { gif } : {}) });

function lerRegistros(lista: unknown): Registro[] {
  if (!Array.isArray(lista)) return [];
  return lista.flatMap((s) => {
    try {
      const r = JSON.parse(String(s)) as Registro;
      return typeof r.id === "string" && typeof r.texto === "string" && typeof r.apelido === "string" ? [r] : [];
    } catch {
      return [];
    }
  });
}

interface Opcoes {
  cfg?: ConfigRedis | null;
  agora?: number;
  fetchImpl?: typeof fetch;
}
const cfgDe = (o: Opcoes) => (o.cfg === undefined ? configRedis() : o.cfg);

export type ResultadoChat = { ok: true; mensagem: MensagemChat } | { ok: false; motivo: "espere" | "limite" | "banido" | "indisponivel" };

export async function publicarChat(dados: { apelido: string; texto: string; aparelho: string; ip: string; gif?: string }, opcoes: Opcoes = {}): Promise<ResultadoChat> {
  const cfg = cfgDe(opcoes);
  if (!cfg) return { ok: false, motivo: "indisponivel" };
  const f = opcoes.fetchImpl ?? fetch;
  const ah = resumo("ap", dados.aparelho);
  const ih = resumo("ip", dados.ip);
  const k1 = `av:chat:lim1:${ih}`;
  const k2 = `av:chat:lim2:${ih}`;
  try {
    const [banA, banI, n1, , n2] = await pipeline(
      cfg,
      [["SISMEMBER", CHAVE_BANIDOS, ah], ["SISMEMBER", CHAVE_BANIDOS, ih], ["INCR", k1], ["EXPIRE", k1, INTERVALO_S, "NX"], ["INCR", k2], ["EXPIRE", k2, JANELA_S, "NX"]],
      f,
    );
    if (Number(banA) === 1 || Number(banI) === 1) return { ok: false, motivo: "banido" };
    if (Number(n1) > 1) return { ok: false, motivo: "espere" };
    if (Number(n2) > MAX_POR_JANELA) return { ok: false, motivo: "limite" };
    const r: Registro = { id: randomUUID(), em: new Date(opcoes.agora ?? Date.now()).toISOString(), apelido: dados.apelido, texto: dados.texto, ...(dados.gif ? { gif: dados.gif } : {}), ah, ih };
    await pipeline(cfg, [["LPUSH", CHAVE_CHAT, JSON.stringify(r)], ["LTRIM", CHAVE_CHAT, 0, MAX_CHAT - 1], ["EXPIRE", CHAVE_CHAT, EXPIRA_CHAT_S]], f);
    return { ok: true, mensagem: publico(r) };
  } catch {
    return { ok: false, motivo: "indisponivel" };
  }
}

/** Leitura pública: sem os resumos e sem as ocultas. As mais novas primeiro. */
export async function lerChat(opcoes: Opcoes = {}): Promise<MensagemChat[] | null> {
  const cfg = cfgDe(opcoes);
  if (!cfg) return null;
  try {
    const [lista, ocultas] = await pipeline(cfg, [["LRANGE", CHAVE_CHAT, 0, MOSTRAR - 1], ["SMEMBERS", CHAVE_OCULTAS]], opcoes.fetchImpl ?? fetch);
    const fora = new Set(Array.isArray(ocultas) ? ocultas.map(String) : []);
    return lerRegistros(lista)
      .filter((r) => !fora.has(r.id))
      .map(publico);
  } catch {
    return null;
  }
}

export type ResultadoDenuncia = "ok" | "invalido" | "limite" | "indisponivel";

export async function denunciarChat(id: unknown, ip: string, opcoes: Opcoes = {}): Promise<ResultadoDenuncia> {
  if (typeof id !== "string" || !ID_VALIDO.test(id)) return "invalido";
  const cfg = cfgDe(opcoes);
  if (!cfg) return "indisponivel";
  const f = opcoes.fetchImpl ?? fetch;
  const ih = resumo("ip", ip);
  const lim = `av:chat:limd:${ih}`;
  const chave = `${PREFIXO_DENUNCIA}${id}`;
  try {
    const [n, , , , total] = await pipeline(cfg, [["INCR", lim], ["EXPIRE", lim, 60, "NX"], ["SADD", chave, ih], ["EXPIRE", chave, EXPIRA_CHAT_S], ["SCARD", chave]], f);
    if (Number(n) > 10) return "limite";
    if (Number(total) >= DENUNCIAS_PARA_OCULTAR) await pipeline(cfg, [["SADD", CHAVE_OCULTAS, id], ["EXPIRE", CHAVE_OCULTAS, EXPIRA_CHAT_S]], f);
    return "ok";
  } catch {
    return "indisponivel";
  }
}

/** Lista completa para a moderação: inclui ocultas e o número de denúncias. */
export async function lerModeracao(opcoes: Opcoes = {}): Promise<MensagemModeracao[] | null> {
  const cfg = cfgDe(opcoes);
  if (!cfg) return null;
  const f = opcoes.fetchImpl ?? fetch;
  try {
    const [lista, ocultas] = await pipeline(cfg, [["LRANGE", CHAVE_CHAT, 0, MAX_CHAT - 1], ["SMEMBERS", CHAVE_OCULTAS]], f);
    const regs = lerRegistros(lista);
    const fora = new Set(Array.isArray(ocultas) ? ocultas.map(String) : []);
    const contagens = regs.length ? await pipeline(cfg, regs.map((r) => ["SCARD", `${PREFIXO_DENUNCIA}${r.id}`]), f) : [];
    return regs.map((r, i) => ({ ...publico(r), oculta: fora.has(r.id), denuncias: Number(contagens[i] ?? 0) }));
  } catch {
    return null;
  }
}

export type AcaoModeracao = "ocultar" | "mostrar" | "banir";
export type ResultadoModeracao = "ok" | "invalido" | "nao-encontrada" | "indisponivel";

/** Ocultar, mostrar de novo ou banir o aparelho e o IP de quem escreveu (oculta tudo o que eles mandaram). */
export async function moderarChat(acao: unknown, id: unknown, opcoes: Opcoes = {}): Promise<ResultadoModeracao> {
  if ((acao !== "ocultar" && acao !== "mostrar" && acao !== "banir") || typeof id !== "string" || !ID_VALIDO.test(id)) return "invalido";
  const cfg = cfgDe(opcoes);
  if (!cfg) return "indisponivel";
  const f = opcoes.fetchImpl ?? fetch;
  try {
    if (acao === "ocultar") await pipeline(cfg, [["SADD", CHAVE_OCULTAS, id], ["EXPIRE", CHAVE_OCULTAS, EXPIRA_CHAT_S]], f);
    else if (acao === "mostrar") await pipeline(cfg, [["SREM", CHAVE_OCULTAS, id], ["DEL", `${PREFIXO_DENUNCIA}${id}`]], f);
    else {
      const [lista] = await pipeline(cfg, [["LRANGE", CHAVE_CHAT, 0, MAX_CHAT - 1]], f);
      const regs = lerRegistros(lista);
      const alvo = regs.find((r) => r.id === id);
      if (!alvo) return "nao-encontrada";
      const dele = regs.filter((r) => r.ah === alvo.ah || r.ih === alvo.ih).map((r) => r.id);
      await pipeline(
        cfg,
        [["SADD", CHAVE_BANIDOS, alvo.ah, alvo.ih], ["EXPIRE", CHAVE_BANIDOS, EXPIRA_BAN_S], ["SADD", CHAVE_OCULTAS, ...dele], ["EXPIRE", CHAVE_OCULTAS, EXPIRA_CHAT_S]],
        f,
      );
    }
    return "ok";
  } catch {
    return "indisponivel";
  }
}
