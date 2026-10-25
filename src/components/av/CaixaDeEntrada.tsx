"use client";

import { useState } from "react";

interface Mensagem {
  id: string;
  em: string;
  email: string;
  texto: string;
}

/** Página /inbox: lê as mensagens do "Fale com a gente" com a senha de INBOX_SENHA. Nada fica salvo no navegador. */
export function CaixaDeEntrada() {
  const [senha, setSenha] = useState("");
  const [lista, setLista] = useState<Mensagem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const abrir = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const r = await fetch("/api/inbox", { headers: { Authorization: `Bearer ${senha}` }, cache: "no-store" }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { mensagens?: Mensagem[]; erro?: string };
    if (!r?.ok || !j.mensagens) {
      setErro(j?.erro ?? "Não foi possível abrir");
      return;
    }
    setLista(j.mensagens);
  };

  return (
    <main className="inbox">
      <h1>Caixa de entrada</h1>
      <form onSubmit={abrir} className="inbox__form">
        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} aria-label="Senha" placeholder="Senha" autoComplete="current-password" />
        <button type="submit">{lista ? "Atualizar" : "Abrir"}</button>
      </form>
      {erro && <p role="alert">{erro}</p>}
      {lista && (
        <>
          <p>{lista.length === 0 ? "Nenhuma mensagem ainda." : `${lista.length} mensagens, as mais novas primeiro.`}</p>
          <ul className="inbox__lista" data-testid="inbox-lista">
            {lista.map((m) => (
              <li key={m.id}>
                <div className="inbox__meta">
                  <a href={`mailto:${encodeURIComponent(m.email)}`}>{m.email}</a>
                  <time dateTime={m.em}>{new Date(m.em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time>
                </div>
                <p>{m.texto}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
