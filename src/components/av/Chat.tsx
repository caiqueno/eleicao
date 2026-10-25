"use client";

import { useCallback, useEffect, useState } from "react";
import { idDoNavegador } from "./hooks";

const MAX_TEXTO = 280;
const MAX_APELIDO = 24;
const INTERVALO_MS = 20_000;

interface MensagemChat {
  id: string;
  em: string;
  apelido: string;
  texto: string;
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** "Comentários do público": chat aberto, com regras visíveis, denúncia e moderação no /inbox. Tudo é mostrado como texto. */
export function Chat() {
  const [lista, setLista] = useState<MensagemChat[] | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const [texto, setTexto] = useState("");
  const [apelido, setApelido] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [denunciadas, setDenunciadas] = useState<Set<string>>(new Set());
  /** As minhas, enquanto a lista da CDN (guardada por alguns segundos) ainda não as traz. */
  const [minhas, setMinhas] = useState<MensagemChat[]>([]);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/chat");
      const j = (await r.json()) as { mensagens?: MensagemChat[] };
      if (!r.ok || !Array.isArray(j.mensagens)) throw new Error();
      setLista(j.mensagens);
      setIndisponivel(false);
    } catch {
      setIndisponivel(true);
    }
  }, []);

  useEffect(() => {
    try {
      setApelido(localStorage.getItem("av:apelido") ?? "");
    } catch {
      /* sem armazenamento */
    }
    void carregar();
    const t = setInterval(() => document.visibilityState === "visible" && void carregar(), INTERVALO_MS);
    return () => clearInterval(t);
  }, [carregar]);

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const site = (new FormData(e.currentTarget).get("site") as string | null) ?? "";
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apelido, texto, aparelho: idDoNavegador(), site }),
      });
      const j = (await r.json().catch(() => ({}))) as { mensagem?: MensagemChat; erro?: string };
      if (!r.ok || !j.mensagem) throw new Error(j.erro ?? "Não foi possível enviar agora");
      setMinhas((m) => [j.mensagem!, ...m]);
      setTexto("");
      try {
        localStorage.setItem("av:apelido", apelido);
      } catch {
        /* idem */
      }
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

  const ids = new Set((lista ?? []).map((m) => m.id));
  const todas = [...minhas.filter((m) => !ids.has(m.id)), ...(lista ?? [])];

  return (
    <section className="chat" aria-labelledby="chat-titulo" data-testid="chat">
      <h2 id="chat-titulo">Comentários do público</h2>
      <p className="chat__regras" data-testid="chat-regras">
        As mensagens são a opinião de quem escreveu, não do acompanhevotos nem do TSE. O site não apoia nenhum candidato. Não são permitidos pedido de
        voto, propaganda, ofensas, links ou dados pessoais (telefone, e-mail, documentos). Comentários fora das regras são removidos. Para denúncia
        eleitoral, use o Pardal do TSE.
      </p>
      <form className="chat__form" onSubmit={enviar}>
        <input
          className="chat__apelido"
          aria-label="Apelido (opcional)"
          placeholder="Apelido (opcional)"
          value={apelido}
          onChange={(e) => setApelido(e.target.value)}
          maxLength={MAX_APELIDO}
          autoComplete="nickname"
        />
        <textarea
          aria-label="Comentário"
          placeholder="Comente a apuração"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={MAX_TEXTO}
          rows={2}
          required
        />
        {/* Campo para robôs: escondido de pessoas. */}
        <input type="text" name="site" tabIndex={-1} autoComplete="off" className="fale__isca" aria-hidden="true" />
        <div className="chat__envio">
          <small>
            {texto.length}/{MAX_TEXTO}
          </small>
          <button type="submit" className="fale__enviar chat__enviar" disabled={enviando || texto.trim().length < 2} data-testid="chat-enviar">
            {enviando ? "Enviando…" : "Comentar"}
          </button>
        </div>
        {erro && (
          <p className="fale__erro" role="alert">
            {erro}
          </p>
        )}
      </form>
      {indisponivel && !lista && <p className="chat__vazio">O chat está indisponível agora.</p>}
      {lista && todas.length === 0 && <p className="chat__vazio">Nenhum comentário ainda. Seja o primeiro.</p>}
      <ul className="chat__lista" data-testid="chat-lista" aria-live="polite">
        {todas.map((m) => (
          <li key={m.id}>
            <div className="chat__meta">
              <b>{m.apelido}</b>
              <time dateTime={m.em}>{hora(m.em)}</time>
              <button type="button" className="chat__denunciar" onClick={() => void denunciar(m.id)} disabled={denunciadas.has(m.id)}>
                {denunciadas.has(m.id) ? "Denunciado" : "Denunciar"}
              </button>
            </div>
            <p>{m.texto}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
