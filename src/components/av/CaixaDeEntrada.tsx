"use client";

import { useState } from "react";

interface Mensagem {
  id: string;
  em: string;
  email: string;
  texto: string;
}

interface Comentario {
  id: string;
  em: string;
  apelido: string;
  texto: string;
  oculta: boolean;
  denuncias: number;
}

const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

/**
 * Página /inbox, com a senha de INBOX_SENHA: as mensagens do "Fale com a gente" e a moderação do chat
 * (ocultar, mostrar de novo, banir quem escreveu). Nada fica salvo no navegador.
 */
export function CaixaDeEntrada() {
  const [senha, setSenha] = useState("");
  const [lista, setLista] = useState<Mensagem[] | null>(null);
  const [chat, setChat] = useState<Comentario[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"mensagens" | "chat">("mensagens");

  const auth = { Authorization: `Bearer ${senha}` };

  const carregarChat = async () => {
    const r = await fetch("/api/chat/moderar", { headers: auth, cache: "no-store" }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { mensagens?: Comentario[] };
    setChat(r?.ok && j.mensagens ? j.mensagens : null);
  };

  const abrir = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const r = await fetch("/api/inbox", { headers: auth, cache: "no-store" }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { mensagens?: Mensagem[]; erro?: string };
    if (!r?.ok || !j.mensagens) {
      setErro(j?.erro ?? "Não foi possível abrir");
      return;
    }
    setLista(j.mensagens);
    await carregarChat();
  };

  const moderar = async (acao: "ocultar" | "mostrar" | "banir", id: string) => {
    if (acao === "banir" && !window.confirm("Banir quem escreveu? Todos os comentários dessa pessoa somem e ela não consegue mais comentar.")) return;
    const r = await fetch("/api/chat/moderar", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ acao, id }),
    }).catch(() => null);
    if (!r?.ok) setErro("Não foi possível moderar agora");
    await carregarChat();
  };

  const denunciados = chat?.filter((c) => c.denuncias > 0 && !c.oculta).length ?? 0;

  return (
    <main className="inbox">
      <h1>Caixa de entrada</h1>
      <form onSubmit={abrir} className="inbox__form">
        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} aria-label="Senha" placeholder="Senha" autoComplete="current-password" />
        <button type="submit">{lista ? "Atualizar" : "Abrir"}</button>
      </form>
      {erro && <p role="alert">{erro}</p>}
      {lista && (
        <div className="inbox__abas" role="tablist">
          <button type="button" role="tab" aria-selected={aba === "mensagens"} onClick={() => setAba("mensagens")}>
            Fale com a gente ({lista.length})
          </button>
          <button type="button" role="tab" aria-selected={aba === "chat"} onClick={() => setAba("chat")} data-testid="inbox-aba-chat">
            Chat ({chat?.length ?? 0}
            {denunciados ? `, ${denunciados} com denúncia` : ""})
          </button>
        </div>
      )}
      {lista && aba === "mensagens" && (
        <>
          <p>{lista.length === 0 ? "Nenhuma mensagem ainda." : `${lista.length} mensagens, as mais novas primeiro.`}</p>
          <ul className="inbox__lista" data-testid="inbox-lista">
            {lista.map((m) => (
              <li key={m.id}>
                <div className="inbox__meta">
                  <a href={`mailto:${encodeURIComponent(m.email)}`}>{m.email}</a>
                  <time dateTime={m.em}>{dataHora(m.em)}</time>
                </div>
                <p>{m.texto}</p>
              </li>
            ))}
          </ul>
        </>
      )}
      {lista && aba === "chat" && (
        <>
          <p>
            {chat === null
              ? "Chat indisponível."
              : chat.length === 0
                ? "Nenhum comentário ainda."
                : "Os mais novos primeiro. Ocultar tira do site; banir oculta tudo de quem escreveu e impede novos comentários por 30 dias."}
          </p>
          <ul className="inbox__lista" data-testid="inbox-chat">
            {chat?.map((c) => (
              <li key={c.id} className={c.oculta ? "inbox__oculta" : c.denuncias > 0 ? "inbox__denunciada" : undefined}>
                <div className="inbox__meta">
                  <b>{c.apelido}</b>
                  <time dateTime={c.em}>{dataHora(c.em)}</time>
                  <span>
                    {c.oculta ? "oculto" : "no site"}
                    {c.denuncias > 0 ? ` · ${c.denuncias} denúncia${c.denuncias > 1 ? "s" : ""}` : ""}
                  </span>
                </div>
                <p>{c.texto}</p>
                <div className="inbox__acoes">
                  {c.oculta ? (
                    <button type="button" onClick={() => void moderar("mostrar", c.id)}>
                      Mostrar de novo
                    </button>
                  ) : (
                    <button type="button" onClick={() => void moderar("ocultar", c.id)}>
                      Ocultar
                    </button>
                  )}
                  <button type="button" onClick={() => void moderar("banir", c.id)}>
                    Banir quem escreveu
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
