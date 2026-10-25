"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CargoId } from "@/config/eleicao";
import { UFS } from "@/config/eleicao";
import { capitalizar, horaBrasilia, INICIO_DIVULGACAO_MS, type CandidatoBase } from "./util";
import type { PontoHistorico } from "./hooks";
import { PATROCINIO_URL, PATROCINIO_VALOR, SEGUIR_URL } from "@/config/contato";


function Icone({ nome }: { nome: "busca" | "globo" | "compartilhar" | "sol" | "lua" | "tela" | "whats" }) {
  const p = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (nome) {
    case "busca":
      return (
        <svg {...p}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "globo":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
        </svg>
      );
    case "compartilhar":
      return (
        <svg {...p}>
          <path d="M12 15V3m0 0-4 4m4-4 4 4" />
          <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        </svg>
      );
    case "sol":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case "lua":
      return (
        <svg {...p}>
          <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
        </svg>
      );
    case "tela":
      return (
        <svg {...p}>
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      );
    case "whats":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.13c-.24.68-1.42 1.3-1.95 1.34-.5.05-.97.23-3.27-.68-2.77-1.09-4.52-3.92-4.66-4.1-.13-.18-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27.25-.27.54-.34.72-.34h.52c.17 0 .4-.06.62.48.24.56.8 1.94.87 2.08.07.14.12.3.02.48-.09.18-.14.3-.27.46l-.41.48c-.14.14-.28.29-.12.56.16.27.71 1.17 1.52 1.9 1.05.93 1.93 1.22 2.2 1.36.27.14.43.11.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.23.61-.14.25.09 1.59.75 1.86.89.27.14.45.2.52.32.07.11.07.66-.17 1.33Z" />
        </svg>
      );
  }
}

export function Anuncio({ compacto = false }: { compacto?: boolean }) {
  return (
    <a
      className={`patrocinio${compacto ? " patrocinio--compacto" : ""}`}
      href={PATROCINIO_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="anuncio-whatsapp"
      aria-label={`Patrocine o acompanhevotos: ${PATROCINIO_VALOR ?? "valor a combinar"}. Fale pelo WhatsApp`}
    >
      <span className="patrocinio__rotulo">
        Patrocine este espaço · <b data-testid="patrocinio-valor">{PATROCINIO_VALOR ?? "valor a combinar"}</b>
      </span>
      <span className="patrocinio__acao">
        <Icone nome="whats" /> Fale com a gente
      </span>
    </a>
  );
}

/** Convite para acompanhar a próxima eleição. O destino fica em src/config/contato.ts. */
export function Seguir({ className }: { className?: string }) {
  return (
    <a className={`seguir${className ? ` ${className}` : ""}`} href={SEGUIR_URL} target="_blank" rel="noopener noreferrer" data-testid="seguir">
      <Icone nome="whats" /> Siga para a próxima eleição
    </a>
  );
}

interface PropsCab {
  cargo: CargoId;
  aoCargo: (c: CargoId) => void;
  aoExterior: () => void;
  exteriorAtivo: boolean;
  aoBuscar: () => void;
  tema: "escuro" | "claro";
  aoTema: () => void;
  aoCompartilhar: () => void;
  aviso: string | null;
  presenca?: ReactNode;
}

export function Cabecalho(p: PropsCab) {
  const telaCheia = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  return (
    <header className="topo">
      <a className="logo" href="#presidente" aria-label="acompanhevotos, início">
        <svg className="logo__marca" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
          <rect x="1" y="1" width="24" height="24" rx="7" fill="var(--marca)" />
          <path d="M7.5 13.5l3.6 3.6L18.8 9" fill="none" stroke="var(--marca-tinta)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="logo__nome">
          acompanhe<b>votos</b>
        </span>
      </a>
      <div className="abas" role="tablist" aria-label="Cargo">
        {(["presidente", "governador"] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={p.cargo === c}
            className={`aba${p.cargo === c ? " aba--ativa" : ""}`}
            onClick={() => p.aoCargo(c)}
            data-testid={`aba-${c}`}
          >
            {c === "presidente" ? "Presidente" : "Governadores"}
          </button>
        ))}
      </div>
      {p.presenca}
      <div className="topo__anuncio">
        <Anuncio />
      </div>
      <nav className="icones" aria-label="Ações">
        <button type="button" className="busca-topo" onClick={p.aoBuscar} aria-label="Buscar município" data-testid="botao-busca">
          <Icone nome="busca" /> <span className="busca-topo__texto">Buscar sua cidade</span>
        </button>
        {p.cargo === "presidente" && (
          <button
            type="button"
            className={`icone${p.exteriorAtivo ? " icone--ativo" : ""}`}
            onClick={p.aoExterior}
            aria-label="Votos no exterior"
            aria-pressed={p.exteriorAtivo}
            data-testid="botao-exterior"
          >
            <Icone nome="globo" />
          </button>
        )}
        <button type="button" className="icone" onClick={p.aoCompartilhar} aria-label="Compartilhar" data-testid="botao-compartilhar">
          <Icone nome="compartilhar" />
        </button>
        <button type="button" className="icone" onClick={p.aoTema} aria-label={p.tema === "escuro" ? "Usar tema claro" : "Usar tema escuro"}>
          <Icone nome={p.tema === "escuro" ? "sol" : "lua"} />
        </button>
        <button type="button" className="icone icone--desk" onClick={telaCheia} aria-label="Tela cheia">
          <Icone nome="tela" />
        </button>
      </nav>
      {p.aviso && (
        <p className="topo__aviso" role="status">
          {p.aviso}
        </p>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------------ */

type Item = [uf: string, cd: string, ibge: string, nome: string];
let indice: Promise<Item[]> | null = null;

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

export function Busca({ aberta, aoFechar, aoEscolher }: { aberta: boolean; aoFechar: () => void; aoEscolher: (uf: string, cd: string) => void }) {
  const [lista, setLista] = useState<Item[] | null>(null);
  const [erro, setErro] = useState(false);
  const [termo, setTermo] = useState("");
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aberta) return;
    campo.current?.focus();
    indice ??= fetch("/api/municipios")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { municipios: Item[] }) => j.municipios.map((m) => [m[0], m[1], m[2], m[3]] as Item));
    indice.then(setLista).catch(() => {
      indice = null;
      setErro(true);
    });
    const esc = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberta, aoFechar]);

  const achados = useMemo(() => {
    const t = normalizar(termo.trim());
    if (!lista || t.length < 2) return [];
    return lista.filter((m) => normalizar(m[3]).includes(t)).slice(0, 30);
  }, [lista, termo]);

  if (!aberta) return null;
  return (
    <div className="busca" role="dialog" aria-modal="true" aria-label="Buscar município" onClick={aoFechar}>
      <div className="busca__caixa" onClick={(e) => e.stopPropagation()}>
        <input
          ref={campo}
          className="busca__campo"
          type="search"
          placeholder="Buscar município ou cidade no exterior"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          aria-label="Nome do município"
        />
        <ul className="busca__lista">
          {erro && <li className="busca__vazio">A lista de municípios do TSE não está disponível agora.</li>}
          {!erro && !lista && <li className="busca__vazio">Carregando lista de municípios do TSE…</li>}
          {lista && termo.trim().length >= 2 && achados.length === 0 && <li className="busca__vazio">Nenhum município encontrado.</li>}
          {achados.map((m) => (
            <li key={`${m[0]}${m[1]}`}>
              <button type="button" onClick={() => aoEscolher(m[0], m[1])}>
                <b>{capitalizar(m[3])}</b>
                <span>{m[0] === "zz" ? "Exterior" : UFS[m[0]]}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

const FIM_MS = Date.parse("2026-10-25T23:00:00-03:00");

export function LinhaDoTempo({ agora, apurando, historico }: { agora: number; apurando: boolean; historico: PontoHistorico[]; candidatos?: CandidatoBase[] }) {
  const total = FIM_MS - INICIO_DIVULGACAO_MS;
  const pos = (t: number) => Math.min(100, Math.max(0, ((t - INICIO_DIVULGACAO_MS) / total) * 100));
  const horas = [17, 18, 19, 20, 21, 22];
  const aoVivo = agora >= INICIO_DIVULGACAO_MS;
  return (
    <div className="tempo" data-testid="linha-do-tempo">
      <span className="tempo__hora">{aoVivo ? horaBrasilia(agora) : horaBrasilia(INICIO_DIVULGACAO_MS)}</span>
      <div className="tempo__trilho" role="img" aria-label={`Linha do tempo da apuração, das 17h às 23h. Agora: ${horaBrasilia(agora)}`}>
        <span className="tempo__feito" style={{ width: `${pos(agora)}%` }} />
        {historico.map((h) => (
          <span key={h.t} className="tempo__marca" style={{ left: `${pos(h.t)}%` }} />
        ))}
        <span className="tempo__cursor" style={{ left: `${pos(agora)}%` }} />
        {horas.map((h) => (
          <span key={h} className="tempo__tique" style={{ left: `${pos(Date.parse(`2026-10-25T${h}:00:00-03:00`))}%` }}>
            {h}
          </span>
        ))}
      </div>
      <span className={`tempo__vivo${aoVivo && apurando ? " tempo__vivo--on" : ""}`}>
        <span className="ponto" /> {aoVivo && apurando ? "Em andamento" : aoVivo ? "Aguardando TSE" : "Em breve"}
      </span>
    </div>
  );
}
