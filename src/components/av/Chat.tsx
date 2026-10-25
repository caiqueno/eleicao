"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { idDoNavegador } from "./hooks";

const MAX_TEXTO = 280;
const MAX_APELIDO = 24;
const INTERVALO_ABERTO_MS = 15_000;
const INTERVALO_FECHADO_MS = 60_000;

interface MensagemChat {
  id: string;
  em: string;
  apelido: string;
  texto: string;
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Cor fixa por apelido, como os nomes coloridos do MSN. */
const CORES_APELIDO = ["#2f80ed", "#9b51e0", "#27ae60", "#e67e22", "#eb5757", "#00a3a3", "#c0399f", "#7a8a00"];
const corDe = (s: string) => CORES_APELIDO[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % CORES_APELIDO.length];

function lerLocal<T>(chave: string, padrao: T): T {
  if (typeof window === "undefined") return padrao;
  try {
    const v = localStorage.getItem(chave);
    return v === null ? padrao : (JSON.parse(v) as T);
  } catch {
    return padrao;
  }
}
function gravarLocal(chave: string, v: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(v));
  } catch {
    /* sem armazenamento */
  }
}

/**
 * Bate-papo no estilo janela de MSN: uma aba no canto abre a janela com as mensagens.
 * Regras visíveis, denúncia e moderação no /inbox. Tudo é mostrado como texto, nunca como HTML.
 */
export function Chat({ online }: { online: number | null }) {
  const [aberta, setAberta] = useState(false);
  const [lista, setLista] = useState<MensagemChat[] | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const [texto, setTexto] = useState("");
  const [apelido, setApelido] = useState(() => lerLocal("av:apelido", ""));
  const [editandoApelido, setEditandoApelido] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [denunciadas, setDenunciadas] = useState<Set<string>>(new Set());
  const [regras, setRegras] = useState(false);
  /** Ids que este navegador mandou: aparecem à direita, como no MSN. */
  const [meus, setMeus] = useState<string[]>(() => lerLocal<string[]>("av:chat:meus", []));
  /** As minhas, enquanto a lista da CDN (guardada por alguns segundos) ainda não as traz. */
  const [pendentes, setPendentes] = useState<MensagemChat[]>([]);
  const [vistoAte, setVistoAte] = useState<string>(() => lerLocal("av:chat:visto", ""));
  const fundo = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  // Busca ao abrir a página e depois a cada 15 s (janela aberta) ou 60 s (minimizada), só com a aba visível.
  useEffect(() => {
    let vivo = true;
    const buscar = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch("/api/chat");
        const j = (await r.json()) as { mensagens?: MensagemChat[] };
        if (!r.ok || !Array.isArray(j.mensagens)) throw new Error();
        if (!vivo) return;
        setLista(j.mensagens);
        setIndisponivel(false);
      } catch {
        if (vivo) setIndisponivel(true);
      }
    };
    const primeira = setTimeout(() => void buscar(), aberta ? 0 : 300);
    const t = setInterval(() => void buscar(), aberta ? INTERVALO_ABERTO_MS : INTERVALO_FECHADO_MS);
    return () => {
      vivo = false;
      clearTimeout(primeira);
      clearInterval(t);
    };
  }, [aberta]);

  // A API manda as mais novas primeiro; a janela mostra como conversa (as mais novas embaixo).
  const ids = new Set((lista ?? []).map((m) => m.id));
  const conversa = [...pendentes.filter((m) => !ids.has(m.id)), ...(lista ?? [])].reverse();
  const ultima = conversa.at(-1)?.em ?? "";
  const novas = aberta ? 0 : conversa.filter((m) => m.em > vistoAte && !meus.includes(m.id)).length;

  const fechar = useRef(() => {});
  /** Abrir ou minimizar marca tudo o que está na conversa como visto. */
  const alternar = (abrir: boolean) => {
    if (ultima) {
      setVistoAte(ultima);
      gravarLocal("av:chat:visto", ultima);
    }
    setAberta(abrir);
  };
  useEffect(() => {
    fechar.current = () => alternar(false);
  });

  useLayoutEffect(() => {
    if (aberta && fundo.current) fundo.current.scrollTop = fundo.current.scrollHeight;
  }, [aberta, conversa.length]);

  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar.current();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberta]);

  const enviar = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (enviando || texto.trim().length < 2) return;
    setErro(null);
    setEnviando(true);
    const site = (document.querySelector<HTMLInputElement>(".chat-janela input[name=site]")?.value ?? "").trim();
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apelido, texto, aparelho: idDoNavegador(), site }),
      });
      const j = (await r.json().catch(() => ({}))) as { mensagem?: MensagemChat; erro?: string };
      if (!r.ok || !j.mensagem) throw new Error(j.erro ?? "Não foi possível enviar agora");
      const m = j.mensagem;
      setPendentes((p) => [m, ...p]);
      setMeus((x) => {
        const n = [m.id, ...x].slice(0, 50);
        gravarLocal("av:chat:meus", n);
        return n;
      });
      setTexto("");
      gravarLocal("av:apelido", apelido);
      campo.current?.focus();
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Não foi possível enviar agora");
    } finally {
      setEnviando(false);
    }
  };

  const denunciar = async (id: string) => {
    setDenunciadas((d) => new Set(d).add(id));
    await fetch("/api/chat/denuncia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
  };

  const status = online && online > 0 ? `${online.toLocaleString("pt-BR")} online` : "online";

  if (!aberta) {
    return (
      <button type="button" className="chat-aba" onClick={() => alternar(true)} data-testid="chat-aba" aria-label={`Abrir bate-papo${novas ? `, ${novas} mensagens novas` : ""}`}>
        <span className="chat-aba__icone" aria-hidden="true">
          💬
        </span>
        <span className="chat-aba__texto">
          <b>Bate-papo</b>
          <small>
            <i className="chat-ponto" aria-hidden="true" /> {status}
          </small>
        </span>
        {novas > 0 && (
          <span className="chat-aba__novas" data-testid="chat-novas">
            {novas > 99 ? "99+" : novas}
          </span>
        )}
      </button>
    );
  }

  return (
    <section className="chat-janela" role="dialog" aria-label="Bate-papo da apuração" data-testid="chat">
      <header className="chat-janela__titulo">
        <span className="chat-janela__icone" aria-hidden="true">
          💬
        </span>
        <span className="chat-janela__nome">
          <b>Bate-papo da apuração</b>
          <small>
            <i className="chat-ponto" aria-hidden="true" /> {status}
          </small>
        </span>
        <button type="button" className="chat-janela__btn" onClick={() => alternar(false)} aria-label="Minimizar bate-papo" data-testid="chat-minimizar">
          –
        </button>
      </header>

      <div className="chat-janela__regras" data-testid="chat-regras">
        <p>
          Opinião de quem escreve, não do acompanhevotos nem do TSE. O site não apoia nenhum candidato.{" "}
          {!regras && (
            <button type="button" onClick={() => setRegras(true)}>
              Regras
            </button>
          )}
        </p>
        {regras && (
          <p>
            Não são permitidos pedido de voto, propaganda, ofensas, links ou dados pessoais (telefone, e-mail, documentos). Mensagens fora das regras
            são removidas. Para denúncia eleitoral, use o Pardal do TSE.
          </p>
        )}
      </div>

      <div className="chat-janela__conversa" ref={fundo} data-testid="chat-lista" aria-live="polite">
        {indisponivel && !lista && <p className="chat-janela__aviso">O bate-papo está indisponível agora.</p>}
        {lista && conversa.length === 0 && <p className="chat-janela__aviso">Ninguém falou ainda. Comece a conversa!</p>}
        {conversa.map((m) => {
          const meu = meus.includes(m.id);
          return (
            <div key={m.id} className={`chat-msg${meu ? " chat-msg--meu" : ""}`} data-testid="chat-msg">
              <div className="chat-msg__meta">
                <b style={meu ? undefined : { color: corDe(m.apelido) }}>{meu ? "Você" : m.apelido}</b> diz
                <time dateTime={m.em}>{hora(m.em)}</time>
                {!meu && (
                  <button
                    type="button"
                    className="chat-msg__denunciar"
                    onClick={() => void denunciar(m.id)}
                    disabled={denunciadas.has(m.id)}
                    aria-label={denunciadas.has(m.id) ? "Denunciado" : "Denunciar"}
                    title={denunciadas.has(m.id) ? "Denunciado" : "Denunciar"}
                  >
                    {denunciadas.has(m.id) ? "denunciado" : "⚑"}
                  </button>
                )}
              </div>
              <p className="chat-msg__balao">{m.texto}</p>
            </div>
          );
        })}
      </div>

      <form className="chat-janela__envio" onSubmit={enviar}>
        <div className="chat-janela__eu">
          {editandoApelido ? (
            <input
              className="chat-janela__apelido"
              aria-label="Apelido (opcional)"
              placeholder="Seu apelido"
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
              onBlur={() => setEditandoApelido(false)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), setEditandoApelido(false))}
              maxLength={MAX_APELIDO}
              autoComplete="nickname"
              autoFocus
            />
          ) : (
            <button type="button" className="chat-janela__mudar" onClick={() => setEditandoApelido(true)} data-testid="chat-apelido">
              <i className="chat-ponto" aria-hidden="true" /> {apelido.trim() || "Visitante"} <span aria-hidden="true">✎</span>
            </button>
          )}
          <small>
            {texto.length}/{MAX_TEXTO}
          </small>
        </div>
        <div className="chat-janela__linha">
          <textarea
            ref={campo}
            aria-label="Mensagem do bate-papo"
            placeholder="Digite uma mensagem…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void enviar();
              }
            }}
            maxLength={MAX_TEXTO}
            rows={2}
          />
          <button type="submit" className="chat-janela__enviar" disabled={enviando || texto.trim().length < 2} data-testid="chat-enviar">
            {enviando ? "…" : "Enviar"}
          </button>
        </div>
        {/* Campo para robôs: escondido de pessoas. */}
        <input type="text" name="site" tabIndex={-1} autoComplete="off" className="fale__isca" aria-hidden="true" />
        {erro && (
          <p className="fale__erro" role="alert">
            {erro}
          </p>
        )}
      </form>
    </section>
  );
}
