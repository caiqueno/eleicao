"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { CargoId } from "@/config/eleicao";
import { UFS } from "@/config/eleicao";
import type { AreaMapa } from "@/lib/tse/mapa";
import type { PrimeiroTurnoArea } from "@/lib/tse/primeiroTurno";
import { CIDADES_EXTERIOR } from "@/data/exterior";
import type { PontoHistorico } from "./hooks";
import { Foto } from "./Placar";
import { capitalizar, compacto, horaBrasilia, INICIO_DIVULGACAO_MS, nomeCurto, parcelas, pct1, pct2, inteiro, type CandidatoBase } from "./util";

/* ------------------------------------------------------------------------ */
/* Projeção                                                                  */
/* ------------------------------------------------------------------------ */

/**
 * Estimativa do resultado final (Presidente): cada UF pesa pelos votos válidos
 * que teve no 1º turno; UFs com votos apurados entram com a parcela atual de
 * cada candidato, e as que ainda não têm, com a parcela dos dois no 1º turno.
 */
export function projetar(areasUf: AreaMapa[], pt: PrimeiroTurnoArea[], numeros: string[]): { a: number; cobertura: number } | null {
  let soma = 0;
  let pesoTotal = 0;
  let pesoApurado = 0;
  for (const area of areasUf) {
    const base = pt.find((x) => x.cd === area.cd);
    const peso = base?.validos;
    if (!base || !peso) continue;
    const atual = (area.secoesTotalizadas ?? 0) > 0 ? parcelas(area.votos, numeros) : null;
    const parcela = atual ?? parcelas(base.votos, numeros);
    if (!parcela) continue;
    soma += peso * parcela[0];
    pesoTotal += peso;
    if (atual) pesoApurado += peso * Math.min(1, (area.percentualSecoes ?? 0) / 100);
  }
  if (pesoTotal === 0 || pesoApurado === 0) return null;
  return { a: soma / pesoTotal, cobertura: (pesoApurado / pesoTotal) * 100 };
}

function Grafico({ pontos, cores }: { pontos: PontoHistorico[]; cores: string[] }) {
  const W = 260;
  const H = 140;
  const desvio = Math.max(1.5, ...pontos.flatMap((p) => [Math.abs(p.a - 50), p.p !== null ? Math.abs(p.p - 50) : 0])) + 0.3;
  const y = (v: number) => H / 2 - ((v - 50) / desvio) * (H / 2 - 6);
  const x = (pst: number) => 34 + (pst / 100) * (W - 40);
  const linha = (f: (p: PontoHistorico) => number | null) =>
    pontos
      .filter((p) => f(p) !== null)
      .map((p, i) => `${i ? "L" : "M"}${x(p.pst).toFixed(1)},${y(f(p) as number).toFixed(1)}`)
      .join("");
  const rot = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
  return (
    <svg className="grafico" viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label="Evolução da apuração por % de urnas apuradas">
      {[50 + desvio * 0.8, 50, 50 - desvio * 0.8].map((v) => (
        <g key={v}>
          <line x1={34} x2={W - 6} y1={y(v)} y2={y(v)} className={v === 50 ? "grafico__meio" : "grafico__grade"} />
          <text x={0} y={y(v) + 3} className="grafico__eixo">
            {rot(v)}
          </text>
        </g>
      ))}
      <path d={linha((p) => p.a)} stroke={cores[0]} className="grafico__linha" />
      <path d={linha((p) => 100 - p.a)} stroke={cores[1]} className="grafico__linha" />
      <path d={linha((p) => p.p)} stroke={cores[0]} className="grafico__linha grafico__linha--proj" />
      <path d={linha((p) => (p.p === null ? null : 100 - p.p))} stroke={cores[1]} className="grafico__linha grafico__linha--proj" />
      <text x={34} y={H + 14} className="grafico__eixo">
        0%
      </text>
      <text x={W / 2} y={H + 14} className="grafico__eixo" textAnchor="middle">
        urnas apuradas
      </text>
      <text x={W - 6} y={H + 14} className="grafico__eixo" textAnchor="end">
        100%
      </text>
    </svg>
  );
}

interface PropsProjecao {
  cargo: CargoId;
  uf: string;
  candidatos: CandidatoBase[];
  cores: string[];
  apurando: boolean;
  projecao: { a: number; cobertura: number } | null;
  historico: PontoHistorico[];
  agora: number;
  /** Comparação com o 1º turno por UF (Presidente) ou da UF (Governador). */
  mudancas: { cd: string; nome: string; delta: number }[];
  primeiroTurno: number[] | null;
  atual: number[] | null;
  /** Conteúdo exclusivo no topo da coluna (boletim do momento). */
  topo?: ReactNode;
}

export function PainelProjecao(p: PropsProjecao) {
  const antes = p.agora < INICIO_DIVULGACAO_MS;
  const aviso = antes ? `Começa às ${horaBrasilia(INICIO_DIVULGACAO_MS)}` : "Aguardando os primeiros números do TSE";
  const maxDelta = Math.max(1, ...p.mudancas.map((m) => Math.abs(m.delta)));
  return (
    <aside className="lateral lateral--esq" aria-label="Projeção e comparação com o 1º turno" data-testid="painel-projecao">
      {p.topo}
      <section className="bloco">
        <h3 className="bloco__titulo">Projeção</h3>
        <p className="bloco__sub">Como a apuração deve terminar · estimativa do acompanhevotos, não é resultado oficial</p>
        <div className="proj">
          {p.candidatos.map((c, i) => (
            <div key={c.numero} className={`proj__cand proj__cand--${i ? "dir" : "esq"}`}>
              <Foto cargo={p.cargo} uf={p.uf} c={c} cor={p.cores[i]} tam={36} />
              <span>
                <span className="proj__nome">{nomeCurto(c.nome)}</span>
                <b style={{ color: p.cores[i] }}>{p.projecao ? pct1(i === 0 ? p.projecao.a : 100 - p.projecao.a) : "—"}</b>
              </span>
            </div>
          ))}
        </div>
        {p.cargo !== "presidente" ? (
          <p className="bloco__status">A projeção é calculada só para Presidente.</p>
        ) : !p.apurando ? (
          <p className="bloco__status">
            <span className="ponto" /> {aviso}
          </p>
        ) : p.projecao ? (
          <p className="bloco__status">
            <span className="ponto ponto--vivo" /> Baseada em {pct1(p.projecao.cobertura)} dos votos esperados
          </p>
        ) : null}
        <Grafico pontos={p.historico} cores={p.cores} />
        <p className="bloco__nota">
          Linhas: parcela de cada candidato nos votos apurados (contínua) e projeção (tracejada), nos momentos em que esta tela
          consultou o TSE. Método: cada UF pesa pelos votos válidos do 1º turno; sem votos apurados, entra com o resultado do 1º turno
          entre os dois.
        </p>
      </section>
      <section className="bloco">
        <h3 className="bloco__titulo">O que mudou desde o 1º turno</h3>
        <p className="bloco__sub">Parcela de {nomeCurto(p.candidatos[0]?.nome ?? "")} entre os dois, em pontos</p>
        {p.primeiroTurno && (
          <p className="bloco__linha">
            1º turno (final):{" "}
            {p.candidatos.map((c, i) => (
              <span key={c.numero} style={{ color: p.cores[i] }}>
                {nomeCurto(c.nome)} {pct1(p.primeiroTurno![i])}{" "}
              </span>
            ))}
          </p>
        )}
        {p.mudancas.length === 0 ? (
          <p className="bloco__status">{p.apurando ? "Calculando…" : `${aviso}.`}</p>
        ) : (
          <ul className="mudancas">
            {p.mudancas.slice(0, 8).map((m) => (
              <li key={m.cd}>
                <span className="mudancas__nome">{m.nome}</span>
                <span className="mudancas__barra">
                  <span
                    style={{
                      width: `${(Math.abs(m.delta) / maxDelta) * 50}%`,
                      [m.delta >= 0 ? "right" : "left"]: "50%",
                      background: p.cores[m.delta >= 0 ? 0 : 1],
                    }}
                  />
                </span>
                <b style={{ color: p.cores[m.delta >= 0 ? 0 : 1] }}>
                  {m.delta >= 0 ? "+" : "−"}
                  {Math.abs(m.delta).toFixed(1).replace(".", ",")}
                </b>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

/* ------------------------------------------------------------------------ */
/* Detalhe (painel da direita)                                               */
/* ------------------------------------------------------------------------ */

interface PropsDetalhe {
  cargo: CargoId;
  uf: string;
  candidatos: CandidatoBase[];
  cores: string[];
  /** Área do cabeçalho (Brasil, UF, cidade). */
  titulo: string;
  sigla: string;
  area: AreaMapa | null;
  /** Lista de áreas filhas (UFs, municípios ou cidades). */
  filhas: AreaMapa[];
  tipoFilhas: "estado" | "municipio" | "exterior" | null;
  primeiroTurno: PrimeiroTurnoArea | null;
  pendentes: number;
  aoEscolher: (cd: string) => void;
  aoFechar: (() => void) | null;
  consultadoEm: string | null;
  erro: string | null;
  subtitulo?: string;
}

function Lider({ area, candidatos, cores }: { area: AreaMapa; candidatos: CandidatoBase[]; cores: string[] }) {
  const cands = area.candidatos ?? candidatos;
  const p = parcelas(area.votos, cands.map((c) => c.numero));
  if (!p) return <span className="linha__dir">{(area.secoesTotalizadas ?? 0) > 0 ? "carregando…" : "aguardando"}</span>;
  if (p[0] === p[1]) return <span className="linha__dir">empate</span>;
  const i = p[0] > p[1] ? 0 : 1;
  return (
    <span className="linha__dir" style={{ color: cores[i] }}>
      {nomeCurto(cands[i].nome)} {pct1(p[i])}
    </span>
  );
}

/** "Estados Unidos" → "EU", "Japão" → "JA". */
function siglaPais(nome: string): string {
  const partes = nome.split(/\s+/).filter((x) => x.length > 2);
  return (partes.length > 1 ? partes[0][0] + partes[1][0] : nome.slice(0, 2)).toUpperCase();
}

export function PainelDetalhe(p: PropsDetalhe) {
  const [filtro, setFiltro] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const a = p.area;
  const numeros = p.candidatos.map((c) => c.numero);
  const parc = a ? parcelas(a.votos, numeros) : null;
  const p1 = p.primeiroTurno ? parcelas(p.primeiroTurno.votos, numeros) : null;

  const filhas = useMemo(() => {
    const termo = filtro
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .trim();
    const lista = [...p.filhas].sort((x, y) => (y.eleitorado ?? 0) - (x.eleitorado ?? 0));
    if (!termo) return lista;
    return lista.filter((f) => f.nome.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().includes(termo));
  }, [p.filhas, filtro]);

  const paises = useMemo(() => {
    if (p.tipoFilhas !== "exterior") return [];
    const g = new Map<string, AreaMapa[]>();
    for (const f of filhas) {
      const pais = CIDADES_EXTERIOR[f.cd]?.[0] ?? "Outros";
      g.set(pais, [...(g.get(pais) ?? []), f]);
    }
    return [...g.entries()]
      .map(([pais, cidades]) => ({ pais, cidades, eleitores: cidades.reduce((s, c) => s + (c.eleitorado ?? 0), 0) }))
      .sort((x, y) => y.eleitores - x.eleitores);
  }, [filhas, p.tipoFilhas]);

  const apurando = a && (a.secoesTotalizadas ?? 0) > 0;
  const comVotos = p.filhas.filter((f) => (f.secoesTotalizadas ?? 0) > 0).length;

  return (
    <aside className="lateral lateral--dir" aria-label={`Detalhes: ${p.titulo}`} data-testid="painel-detalhe">
      <header className="det__cab">
        <span className="det__sigla">{p.sigla}</span>
        <div>
          <h2 className="det__titulo">{p.titulo}</h2>
          <p className="det__sub">
            {p.subtitulo ?? (a ? `${pct1(a.percentualSecoes ?? 0)} das seções · ${compacto(a.eleitorado, false)} de eleitores` : "carregando…")}
          </p>
        </div>
        {p.aoFechar && (
          <button type="button" className="det__fechar" onClick={p.aoFechar} aria-label="Voltar um nível">
            ×
          </button>
        )}
      </header>

      <section className="det__bloco">
        <h3 className="det__rotulo">
          {p.cargo === "presidente" ? "Presidente" : "Governador"}{" "}
          {p.tipoFilhas === "exterior" || p.sigla === "ZZ" ? "no exterior" : p.titulo === "Governadores" ? "· 2º turno nos estados" : `· ${p.titulo}`}
        </h3>
        {a && apurando && parc ? (
          <div className="det__res">
            {p.candidatos.map((c, i) => (
              <div key={c.numero} className="det__cand">
                <span className="det__candNome">
                  <i style={{ background: p.cores[i] }} /> {nomeCurto(c.nome, true)}
                </span>
                <b style={{ color: p.cores[i] }}>{pct2(parc[i])}</b>
                <span className="det__votos">{inteiro(a.votos?.[c.numero])} votos</span>
              </div>
            ))}
            <div className="barra barra--fina">
              <span className="barra__lado" style={{ width: `${parc[0]}%`, background: p.cores[0] }} />
              <span className="barra__lado barra__lado--dir" style={{ width: `${parc[1]}%`, background: p.cores[1] }} />
              <span className="barra__meio" aria-hidden="true" />
            </div>
            <p className="det__texto">
              {inteiro(a.secoesTotalizadas)} de {inteiro(a.secoesTotal)} seções totalizadas
              {a.eleitoradoFaltando !== null ? ` · faltam ${compacto(a.eleitoradoFaltando)} de eleitores` : ""}.
            </p>
          </div>
        ) : (
          <p className="det__texto">
            {a && apurando
              ? "Os votos deste local estão sendo baixados do TSE…"
              : `Nenhuma seção apurada ainda. O TSE divulga os votos a partir das ${horaBrasilia(INICIO_DIVULGACAO_MS)} (horário de Brasília)${
                  p.tipoFilhas === "exterior" ? ", junto com os do Brasil" : ""
                }.`}
          </p>
        )}
        {p1 && (
          <p className="det__primeiro">
            <span>2026 · 1º turno</span>
            {p.candidatos.map((c, i) => (
              <span key={c.numero}>
                <i style={{ background: p.cores[i] }} /> {nomeCurto(c.nome)} {pct1(p1[i])}
              </span>
            ))}
            <small>(entre os dois)</small>
          </p>
        )}
        {p.erro && <p className="det__erro">{p.erro}</p>}
      </section>

      {p.tipoFilhas && (
        <section className="det__lista">
          <div className="det__listaCab">
            <h3 className="det__rotulo">{p.tipoFilhas === "estado" ? "Por estado" : p.tipoFilhas === "exterior" ? "Por país" : "Por município"}</h3>
            <span className="det__conta">
              {p.tipoFilhas === "exterior" ? `${paises.length} países` : `${p.filhas.length} ${p.tipoFilhas === "estado" ? "áreas" : "municípios"}`}
              {comVotos > 0 ? ` · ${comVotos} com votos` : ""}
              {p.pendentes > 0 ? ` · ${p.pendentes} carregando` : ""}
            </span>
          </div>
          {p.tipoFilhas !== "estado" && (
            <input
              className="det__busca"
              type="search"
              placeholder={p.tipoFilhas === "exterior" ? "Buscar cidade" : "Buscar município"}
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              aria-label="Filtrar a lista"
            />
          )}
          <ul className="linhas">
            {p.tipoFilhas === "exterior"
              ? paises.map((g) => (
                  <li key={g.pais}>
                    <button type="button" className="linha" onClick={() => setAberto(aberto === g.pais ? null : g.pais)} aria-expanded={aberto === g.pais}>
                      <span className="linha__sigla">{siglaPais(g.pais)}</span>
                      <span className="linha__meio">
                        <b>{g.pais}</b>
                        <small>
                          {g.cidades.length} {g.cidades.length > 1 ? "cidades" : "cidade"} · {compacto(g.eleitores)} eleitores
                        </small>
                      </span>
                      <span className="linha__dir">{aberto === g.pais ? "▴" : "▾"}</span>
                    </button>
                    {aberto === g.pais && (
                      <ul className="linhas linhas--sub">
                        {g.cidades.map((c) => (
                          <li key={c.cd}>
                            <button type="button" className="linha" onClick={() => p.aoEscolher(c.cd)}>
                              <span className="linha__meio">
                                <b>{capitalizar(c.nome)}</b>
                                <small>
                                  {pct1(c.percentualSecoes ?? 0)} apurado · {compacto(c.eleitorado)} eleitores
                                </small>
                              </span>
                              <Lider area={c} candidatos={p.candidatos} cores={p.cores} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))
              : filhas.slice(0, filtro ? 80 : 60).map((f) => (
                  <li key={f.cd}>
                    <button type="button" className="linha" onClick={() => p.aoEscolher(f.cd)} data-testid="linha-area">
                      <span className="linha__sigla">{p.tipoFilhas === "estado" ? f.cd.toUpperCase() : capitalizar(f.nome).slice(0, 2).toUpperCase()}</span>
                      <span className="linha__meio">
                        <b>{p.tipoFilhas === "estado" ? (UFS[f.cd] ?? f.nome) : capitalizar(f.nome)}</b>
                        <small>
                          {pct1(f.percentualSecoes ?? 0)} apurado · {compacto(f.eleitorado)} eleitores
                        </small>
                      </span>
                      <Lider area={f} candidatos={p.candidatos} cores={p.cores} />
                    </button>
                  </li>
                ))}
          </ul>
          {!filtro && filhas.length > 60 && p.tipoFilhas === "municipio" && (
            <p className="det__nota">Mostrando os 60 maiores. Use a busca para achar outro município.</p>
          )}
        </section>
      )}
      {p.consultadoEm && (
        <p className="det__nota" data-testid="consultado-em">
          Consultado no TSE às {horaBrasilia(Date.parse(p.consultadoEm))} (horário de Brasília)
        </p>
      )}
    </aside>
  );
}
