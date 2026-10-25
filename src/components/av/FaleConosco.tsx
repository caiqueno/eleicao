"use client";

import { useEffect, useRef, useState } from "react";

const MAX_TEXTO = 1000;

/** Botão "Fale com a gente" e a caixa de mensagem. Só a equipe lê, na página /inbox. */
export function FaleConosco() {
  const [aberta, setAberta] = useState(false);
  const [estado, setEstado] = useState<"livre" | "enviando" | "enviada">("livre");
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [email, setEmail] = useState("");
  const [aceite, setAceite] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!aberta) return;
    campo.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberta(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberta]);

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro(null);
    setEstado("enviando");
    const site = (new FormData(e.currentTarget).get("site") as string | null) ?? "";
    try {
      const r = await fetch("/api/mensagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, texto, aceite, site }),
      });
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) throw new Error(j.erro ?? "Não foi possível enviar agora");
      setEstado("enviada");
      setTexto("");
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Não foi possível enviar agora");
      setEstado("livre");
    }
  };

  return (
    <>
      <button type="button" className="fale" onClick={() => setAberta(true)} data-testid="fale-botao">
        Fale com a gente
      </button>
      {aberta && (
        <div className="busca" role="dialog" aria-modal="true" aria-label="Fale com a gente" onClick={() => setAberta(false)}>
          <div className="busca__caixa fale__caixa" onClick={(e) => e.stopPropagation()} data-testid="fale-caixa">
            <div className="fale__cab">
              <b>Fale com a gente</b>
              <button type="button" className="det__fechar" onClick={() => setAberta(false)} aria-label="Fechar">
                ×
              </button>
            </div>
            {estado === "enviada" ? (
              <p className="fale__ok" data-testid="fale-ok">
                Mensagem enviada. Obrigado! Se precisar, respondemos no seu e-mail.
              </p>
            ) : (
              <form onSubmit={enviar} className="fale__form">
                <label>
                  Mensagem
                  <textarea ref={campo} aria-label="Mensagem" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={MAX_TEXTO} rows={4} required />
                  <small>
                    {texto.length}/{MAX_TEXTO}
                  </small>
                </label>
                <label>
                  Seu e-mail
                  <input type="email" aria-label="Seu e-mail" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" required />
                </label>
                {/* Campo para robôs: escondido de pessoas. */}
                <input type="text" name="site" tabIndex={-1} autoComplete="off" className="fale__isca" aria-hidden="true" />
                <label className="fale__aceite">
                  <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} required />
                  Concordo em ser contatado por este e-mail sobre a minha mensagem.
                </label>
                <p className="fale__nota">
                  Só a equipe do acompanhevotos lê. Sua mensagem e seu e-mail não são publicados nem compartilhados e são apagados em até 90
                  dias. Não é canal de denúncia eleitoral: para isso, use o Pardal do TSE.
                </p>
                {erro && (
                  <p className="fale__erro" role="alert">
                    {erro}
                  </p>
                )}
                <button type="submit" className="acoes-placar__whats fale__enviar" disabled={estado === "enviando"} data-testid="fale-enviar">
                  {estado === "enviando" ? "Enviando…" : "Enviar"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
