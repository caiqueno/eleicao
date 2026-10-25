"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { idDoNavegador } from "./hooks";

const MAX_TEXTO = 280;
const MAX_APELIDO = 24;
/** Janela aberta: consulta a cada 3 s (a lista vem da CDN, guardada por 2 s). Minimizada: a cada 20 s, para o contador de novas. */
const INTERVALO_ABERTO_MS = 3_000;
const INTERVALO_FECHADO_MS = 20_000;
const INTERVALO_MAX_ERRO_MS = 30_000;

interface MensagemChat {
  id: string;
  em: string;
  apelido: string;
  texto: string;
  gif?: string;
}

interface Gif {
  id: string;
  r: number;
}

/** Só ids do GIPHY chegam aqui; a imagem vem sempre do endereço fixo do GIPHY. */
const urlGif = (id: string) =>
  `https://media.giphy.com/media/${encodeURIComponent(id)}/200w.webp`;

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });

const RE_NOME = /^[\p{L}\p{N} ._-]+$/u;
const limparNome = (s: string) => s.replace(/\s+/g, " ").trim();
const nomeValido = (s: unknown) =>
  typeof s === "string" &&
  limparNome(s).length >= 2 &&
  limparNome(s).length <= MAX_APELIDO &&
  RE_NOME.test(limparNome(s));

/** Cor fixa por apelido, como os nomes coloridos do MSN. */
const CORES_APELIDO = [
  "#2f80ed",
  "#9b51e0",
  "#27ae60",
  "#e67e22",
  "#eb5757",
  "#00a3a3",
  "#c0399f",
  "#7a8a00",
];
const corDe = (s: string) =>
  CORES_APELIDO[
    [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) %
      CORES_APELIDO.length
  ];

/** Ids em ordem: se não mudou, a lista não é trocada (nada pisca nem rola à toa). */
const assinatura = (l: MensagemChat[]) => l.map((m) => m.id).join(",");

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
  const [apelido, setApelido] = useState(() =>
    limparNome(lerLocal("av:apelido", "")),
  );
  /** O nome é obrigatório: sem um nome guardado no aparelho, a janela pede o nome antes de liberar o envio. */
  const [nomeDefinido, setNomeDefinido] = useState(() =>
    nomeValido(lerLocal("av:apelido", "")),
  );
  const [nomeDigitado, setNomeDigitado] = useState(() =>
    lerLocal("av:apelido", ""),
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [denunciadas, setDenunciadas] = useState<Set<string>>(new Set());
  const [regras, setRegras] = useState(false);
  /** Ids que este navegador mandou: aparecem à direita, como no MSN. */
  const [meus, setMeus] = useState<string[]>(() =>
    lerLocal<string[]>("av:chat:meus", []),
  );
  /** As minhas, enquanto a lista da CDN (guardada por alguns segundos) ainda não as traz. */
  const [pendentes, setPendentes] = useState<MensagemChat[]>([]);
  const [vistoAte, setVistoAte] = useState<string>(() =>
    lerLocal("av:chat:visto", ""),
  );
  const fundo = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  // Mensagens novas aparecem sozinhas: consulta a cada 3 s com a janela aberta e 20 s minimizada,
  // só com a aba visível; em erro, espera cada vez mais (até 30 s). Voltar para a aba consulta na hora.
  const [rodada, setRodada] = useState(0);
  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let espera = aberta ? INTERVALO_ABERTO_MS : INTERVALO_FECHADO_MS;
    const base = espera;
    const buscar = async () => {
      if (document.visibilityState !== "hidden") {
        try {
          const r = await fetch("/api/chat");
          const j = (await r.json()) as { mensagens?: MensagemChat[] };
          if (!r.ok || !Array.isArray(j.mensagens)) throw new Error();
          if (!vivo) return;
          const novaLista = j.mensagens;
          setLista((antes) =>
            antes && assinatura(antes) === assinatura(novaLista)
              ? antes
              : novaLista,
          );
          setIndisponivel(false);
          espera = base;
        } catch {
          if (!vivo) return;
          setIndisponivel(true);
          espera = Math.min(espera * 2, INTERVALO_MAX_ERRO_MS);
        }
      }
      if (vivo) timer = setTimeout(() => void buscar(), espera);
    };
    timer = setTimeout(() => void buscar(), aberta ? 0 : 300);
    const aoVoltar = () => {
      if (document.visibilityState !== "visible" || !vivo) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void buscar(), 0);
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      vivo = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [aberta, rodada]);

  // GIFs: só aparecem se o servidor tiver o GIPHY configurado.
  const [gifsAtivos, setGifsAtivos] = useState(false);
  const [escolhendoGif, setEscolhendoGif] = useState(false);
  const [buscaGif, setBuscaGif] = useState("");
  const [gifs, setGifs] = useState<Gif[] | null>(null);
  useEffect(() => {
    if (!aberta) return;
    let vivo = true;
    const termo = escolhendoGif ? buscaGif.trim() : "";
    const t = setTimeout(
      async () => {
        try {
          const r = await fetch(`/api/gif?q=${encodeURIComponent(termo)}`);
          const j = (await r.json()) as { gifs?: Gif[] };
          if (!vivo) return;
          setGifsAtivos(r.ok && Array.isArray(j.gifs));
          if (Array.isArray(j.gifs)) setGifs(j.gifs);
        } catch {
          if (vivo) setGifsAtivos(false);
        }
      },
      termo ? 400 : 0,
    );
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [aberta, escolhendoGif, buscaGif]);

  // A API manda as mais novas primeiro; a janela mostra como conversa (as mais novas embaixo).
  const ids = new Set((lista ?? []).map((m) => m.id));
  const conversa = [
    ...pendentes.filter((m) => !ids.has(m.id)),
    ...(lista ?? []),
  ].reverse();
  const ultima = conversa.at(-1)?.em ?? "";
  const novas = aberta
    ? 0
    : conversa.filter((m) => m.em > vistoAte && !meus.includes(m.id)).length;

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
    if (aberta && fundo.current)
      fundo.current.scrollTop = fundo.current.scrollHeight;
  }, [aberta, conversa.length]);

  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar.current();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberta]);

  const enviar = async (e?: React.FormEvent<HTMLFormElement>, gif?: string) => {
    e?.preventDefault();
    if (enviando || !nomeDefinido || (!gif && texto.trim().length < 2)) return;
    setErro(null);
    setEnviando(true);
    const site = (
      document.querySelector<HTMLInputElement>(".chat-janela input[name=site]")
        ?.value ?? ""
    ).trim();
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apelido,
          texto: gif ? texto.trim() : texto,
          aparelho: idDoNavegador(),
          site,
          ...(gif ? { gif } : {}),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        mensagem?: MensagemChat;
        erro?: string;
      };
      if (!r.ok || !j.mensagem) {
        // Nome recusado pelo servidor (reservado, ofensivo...): volta para a tela do nome.
        if (
          j.erro &&
          /^(Nome|Informe seu nome|Escolha outro nome)/.test(j.erro)
        )
          setNomeDefinido(false);
        throw new Error(j.erro ?? "Não foi possível enviar agora");
      }
      const m = j.mensagem;
      setPendentes((p) => [m, ...p]);
      setMeus((x) => {
        const n = [m.id, ...x].slice(0, 50);
        gravarLocal("av:chat:meus", n);
        return n;
      });
      setTexto("");
      setEscolhendoGif(false);
      setBuscaGif("");
      setRodada((n) => n + 1);
      campo.current?.focus();
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Não foi possível enviar agora");
    } finally {
      setEnviando(false);
    }
  };

  const definirNome = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!nomeValido(nomeDigitado)) return;
    const n = limparNome(nomeDigitado);
    setApelido(n);
    setNomeDigitado(n);
    gravarLocal("av:apelido", n);
    setErro(null);
    setNomeDefinido(true);
  };

  const denunciar = async (id: string) => {
    setDenunciadas((d) => new Set(d).add(id));
    await fetch("/api/chat/denuncia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => null);
  };

  const status =
    online && online > 0
      ? `${online.toLocaleString("pt-BR")} online`
      : "online";

  if (!aberta) {
    return (
      <button
        type="button"
        className="chat-aba"
        onClick={() => alternar(true)}
        data-testid="chat-aba"
        aria-label={`Abrir bate-papo${novas ? `, ${novas} mensagens novas` : ""}`}
      >
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
    <section
      className="chat-janela"
      role="dialog"
      aria-label="Bate-papo da apuração"
      data-testid="chat"
    >
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
        <button
          type="button"
          className="chat-janela__btn"
          onClick={() => alternar(false)}
          aria-label="Minimizar bate-papo"
          data-testid="chat-minimizar"
        >
          –
        </button>
      </header>

      <div className="chat-janela__regras" data-testid="chat-regras">
        <p>
          Opinião de quem escreve, não do acompanhevotos nem do TSE. O site não
          apoia nenhum candidato.{" "}
          {!regras && (
            <button type="button" onClick={() => setRegras(true)}>
              Regras
            </button>
          )}
        </p>
        {regras && (
          <p>
            Não são permitidos pedido de voto, propaganda, ofensas, links ou
            dados pessoais (telefone, e-mail, documentos). Mensagens fora das
            regras são removidas. Para denúncia eleitoral, use o Pardal do TSE.
          </p>
        )}
      </div>

      <div
        className="chat-janela__conversa"
        ref={fundo}
        data-testid="chat-lista"
        aria-live="polite"
      >
        {indisponivel && !lista && (
          <p className="chat-janela__aviso">
            O bate-papo está indisponível agora.
          </p>
        )}
        {lista && conversa.length === 0 && (
          <p className="chat-janela__aviso">
            Ninguém falou ainda. Comece a conversa!
          </p>
        )}
        {conversa.map((m) => {
          const meu = meus.includes(m.id);
          return (
            <div
              key={m.id}
              className={`chat-msg${meu ? " chat-msg--meu" : ""}`}
              data-testid="chat-msg"
            >
              <div className="chat-msg__meta">
                <b style={meu ? undefined : { color: corDe(m.apelido) }}>
                  {meu ? "Você" : m.apelido}
                </b>{" "}
                diz
                <time dateTime={m.em}>{hora(m.em)}</time>
                {!meu && (
                  <button
                    type="button"
                    className="chat-msg__denunciar"
                    onClick={() => void denunciar(m.id)}
                    disabled={denunciadas.has(m.id)}
                    aria-label={
                      denunciadas.has(m.id) ? "Denunciado" : "Denunciar"
                    }
                    title={denunciadas.has(m.id) ? "Denunciado" : "Denunciar"}
                  >
                    {denunciadas.has(m.id) ? "denunciado" : "⚑"}
                  </button>
                )}
              </div>
              {m.texto && <p className="chat-msg__balao">{m.texto}</p>}
              {m.gif && /^[A-Za-z0-9]{5,40}$/.test(m.gif) && (
                // eslint-disable-next-line @next/next/no-img-element -- GIF animado servido pelo GIPHY
                <img
                  className="chat-msg__gif"
                  src={urlGif(m.gif)}
                  alt="GIF"
                  loading="lazy"
                  width={200}
                  referrerPolicy="no-referrer"
                  data-testid="chat-gif"
                />
              )}
            </div>
          );
        })}
      </div>

      {nomeDefinido && escolhendoGif && gifsAtivos && (
        <div className="chat-gifs" data-testid="chat-gifs">
          <input
            className="chat-gifs__busca"
            aria-label="Buscar GIF"
            placeholder="Buscar GIF…"
            value={buscaGif}
            onChange={(e) => setBuscaGif(e.target.value)}
            maxLength={50}
            autoFocus
          />
          <div className="chat-gifs__grade">
            {(gifs ?? []).map((g) => (
              <button
                key={g.id}
                type="button"
                className="chat-gifs__item"
                onClick={() => void enviar(undefined, g.id)}
                disabled={enviando}
                aria-label="Enviar este GIF"
                style={{ aspectRatio: String(g.r || 1) }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- GIF animado servido pelo GIPHY */}
                <img
                  src={urlGif(g.id)}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </button>
            ))}
            {gifs && gifs.length === 0 && (
              <p className="chat-janela__aviso">Nenhum GIF encontrado.</p>
            )}
          </div>
          <small className="chat-gifs__giphy">Powered by GIPHY</small>
        </div>
      )}

      {!nomeDefinido ? (
        <form
          className="chat-janela__envio chat-nome"
          onSubmit={definirNome}
          data-testid="chat-nome"
        >
          <label htmlFor="chat-nome">Para conversar, diga seu nome</label>
          <div className="chat-janela__linha">
            <input
              id="chat-nome"
              className="chat-nome__campo"
              placeholder="Seu nome"
              value={nomeDigitado}
              onChange={(e) => setNomeDigitado(e.target.value)}
              maxLength={MAX_APELIDO}
              autoComplete="nickname"
              autoFocus
            />
            <button
              type="submit"
              className="chat-janela__enviar"
              disabled={!nomeValido(nomeDigitado)}
              data-testid="chat-entrar"
            >
              Entrar
            </button>
          </div>
          <small className="chat-nome__dica">
            De 2 a {MAX_APELIDO} letras ou números. Fica salvo neste aparelho.
          </small>
          {erro && (
            <p className="fale__erro" role="alert">
              {erro}
            </p>
          )}
        </form>
      ) : (
        <form className="chat-janela__envio" onSubmit={enviar}>
          <div className="chat-janela__eu">
            <button
              type="button"
              className="chat-janela__mudar"
              onClick={() => (setNomeDigitado(apelido), setNomeDefinido(false))}
              data-testid="chat-apelido"
              aria-label={`Seu nome: ${apelido}. Trocar nome`}
            >
              <i className="chat-ponto" aria-hidden="true" /> {apelido}{" "}
              <span aria-hidden="true">✎</span>
            </button>
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
            {gifsAtivos && (
              <button
                type="button"
                className={`chat-janela__gifbtn${escolhendoGif ? " chat-janela__gifbtn--ativo" : ""}`}
                onClick={() => setEscolhendoGif((v) => !v)}
                aria-pressed={escolhendoGif}
                aria-label="Escolher GIF"
                data-testid="chat-gif-botao"
              >
                GIF
              </button>
            )}
            <button
              type="submit"
              className="chat-janela__enviar"
              disabled={enviando || texto.trim().length < 2}
              data-testid="chat-enviar"
            >
              {enviando ? "…" : "Enviar"}
            </button>
          </div>
          {/* Campo para robôs: escondido de pessoas. */}
          <input
            type="text"
            name="site"
            tabIndex={-1}
            autoComplete="off"
            className="fale__isca"
            aria-hidden="true"
          />
          {erro && (
            <p className="fale__erro" role="alert">
              {erro}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
