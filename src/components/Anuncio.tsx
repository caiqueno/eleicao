const LINK_WHATSAPP = "https://wa.me/5511944650268";

/** Bloco de anúncio/contato, separado dos resultados. */
export function Anuncio() {
  return (
    <aside className="anuncio" aria-labelledby="anuncio-rotulo" data-testid="anuncio-whatsapp">
      <p id="anuncio-rotulo" className="anuncio__rotulo">
        Anúncio
      </p>
      <p className="anuncio__texto">Fale com a gente pelo WhatsApp.</p>
      <a
        className="botao anuncio__botao"
        href={LINK_WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar no WhatsApp"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="icone">
          <path
            d="M4 20l1.2-3.6A8 8 0 1 1 8.4 19L4 20z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M9.2 8.6c.3-.6.6-.6.9-.6h.5c.2 0 .4.1.5.4l.6 1.5c.1.2 0 .4-.1.6l-.5.6c.6 1.2 1.5 2.1 2.7 2.7l.6-.5c.2-.1.4-.2.6-.1l1.5.6c.3.1.4.3.4.5v.5c0 .3 0 .6-.6.9-.6.3-1.6.4-3-.3-1.5-.8-2.7-2-3.5-3.5-.7-1.4-.6-2.4-.3-3z"
            fill="currentColor"
          />
        </svg>
        Clique aqui
      </a>
    </aside>
  );
}
