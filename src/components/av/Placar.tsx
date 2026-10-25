"use client";

import { useState } from "react";

import type { CargoId } from "@/config/eleicao";
import type { ResultadoSegundoTurno } from "@/lib/tipos";
import type { AreaMapa } from "@/lib/tse/mapa";
import { PLANOS, PLANOS_FONTE_URL, urlPlano } from "@/config/planos";
import { compacto, coresDe, fotoUrl, horaBrasilia, INICIO_DIVULGACAO_MS, inteiro, nomeCurto, parcelas, pct1, pct2, relogio, type CandidatoBase } from "./util";

/** Plano de governo registrado no TSE: o mesmo formato para os dois candidatos. */
export function PlanoDeGoverno({ sq }: { sq: string | null }) {
  const plano = sq ? PLANOS[sq] : undefined;
  if (!sq || !plano) {
    return (
      <a className="plano" href={PLANOS_FONTE_URL} target="_blank" rel="noopener noreferrer" data-testid="plano-governo">
        Plano de governo no TSE
      </a>
    );
  }
  if (plano.partes.length === 1) {
    return (
      <a className="plano" href={urlPlano(sq, 1)} target="_blank" rel="noopener" data-testid="plano-governo">
        Plano de governo (PDF do TSE)
      </a>
    );
  }
  return (
    <span className="plano" data-testid="plano-governo">
      Plano de governo (PDF do TSE), partes:{" "}
      {plano.partes.map((_, i) => (
        <a key={i} href={urlPlano(sq, i + 1)} target="_blank" rel="noopener" aria-label={`Parte ${i + 1} de ${plano.partes.length}`}>
          {i + 1}
        </a>
      ))}
    </span>
  );
}

export function Foto({ cargo, uf, c, cor, tam = 72 }: { cargo: CargoId; uf: string; c: CandidatoBase; cor: string; tam?: number }) {
  const url = fotoUrl(cargo, uf, c.sqcand);
  const [falhou, setFalhou] = useState<string | null>(null);
  return (
    <span className="foto" style={{ background: cor, width: tam, height: tam }}>
      {url && falhou !== url ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto oficial servida pela própria API
        <img src={url} alt={`Foto de ${nomeCurto(c.nome, true)}`} width={tam} height={tam} onError={() => setFalhou(url)} />
      ) : (
        <span className="foto__inicial">{c.nome[0]}</span>
      )}
    </span>
  );
}

interface Props {
  cargo: CargoId;
  uf: string;
  resultado: ResultadoSegundoTurno | null;
  agora: number;
  carregando: boolean;
}

/** Ordem fixa por número do candidato: a posição não sugere quem lidera. */
export function ordenarPorNumero<T extends { numero: string }>(l: T[]): T[] {
  return [...l].sort((a, b) => Number(a.numero) - Number(b.numero));
}

export function Placar({ cargo, uf, resultado, agora, carregando }: Props) {
  if (!resultado) {
    return (
      <section className="placar placar--vazio" data-testid="placar" aria-busy={carregando}>
        <p>{carregando ? "Carregando dados do TSE…" : "Resultado indisponível no momento."}</p>
      </section>
    );
  }
  const cands = ordenarPorNumero(resultado.candidatos);
  const cores = coresDe(cands);
  const t = resultado.totalizacao;
  const apurando = (t.secoesTotalizadas ?? 0) > 0;
  const votos = Object.fromEntries(cands.map((c) => [c.numero, c.votos ?? 0]));
  const p = apurando ? parcelas(votos, cands.map((c) => c.numero)) : null;
  const antes = agora < INICIO_DIVULGACAO_MS;

  let titulo: string;
  if (t.finalizada) titulo = "Totalização encerrada pelo TSE";
  else if (apurando) titulo = `${pct2(t.percentualSecoesTotalizadas)} das seções apuradas`;
  else if (agora === 0) titulo = "Carregando…";
  else if (antes) titulo = `A apuração começa em ${relogio(INICIO_DIVULGACAO_MS - agora)}`;
  else titulo = "Aguardando os primeiros números do TSE";

  return (
    <section className="placar" data-testid="placar" aria-label={`Placar de ${resultado.cargoNome}, ${resultado.abrangenciaNome}`}>
      <div className="placar__linha">
        {cands.map((c, i) => (
          <div key={c.numero} className={`placar__cand placar__cand--${i === 0 ? "esq" : "dir"}`} data-testid="candidato">
            <Foto cargo={cargo} uf={uf} c={c} cor={cores[i]} />
            <div className="placar__nome">
              <span className="placar__nomeLinha">
                <strong>{nomeCurto(c.nome, true)}</strong>
                <span className="placar__num" style={{ color: cores[i] }}>
                  {c.partido ? `${c.partido} ` : ""}
                  {c.numero}
                </span>
                {c.eleito && (
                  <span className="selo-eleito" data-testid="selo-eleito">
                    Eleito
                  </span>
                )}
              </span>
              <PlanoDeGoverno sq={c.sqcand} />
              {p && (
                <span className="placar__pct">
                  <b style={{ color: cores[i] }}>{pct2(c.percentualFonte ?? p[i])}</b>
                  <small>{inteiro(c.votos)} votos</small>
                </span>
              )}
            </div>
          </div>
        ))}
        <div className="placar__centro">
          <h2 className="placar__titulo" data-testid="estado">
            {titulo}
          </h2>
          <div className="barra" role="img" aria-label={p ? `${nomeCurto(cands[0].nome)} ${pct1(p[0])}, ${nomeCurto(cands[1].nome)} ${pct1(p[1])}` : "Sem votos apurados"}>
            <span className="barra__lado" style={{ width: `${p ? p[0] : 1}%`, background: cores[0] }} />
            <span className="barra__lado barra__lado--dir" style={{ width: `${p ? p[1] : 1}%`, background: cores[1] }} />
            <span className="barra__meio" aria-hidden="true">
              <span>50%</span>
            </span>
          </div>
        </div>
      </div>
      <p className="placar__rodape">
        {/* O percentual de seções apuradas aparece uma vez só: no título durante a apuração, aqui quando ela termina. */}
        {[
          t.finalizada && (
            <span key="apurado" className="placar__apurado" data-testid="secoes-totalizadas">
              <b>{pct2(t.percentualSecoesTotalizadas)}</b> das seções apuradas
            </span>
          ),
          resultado.votos.eleitoradoFaltando !== null && <span key="faltam">faltam {compacto(resultado.votos.eleitoradoFaltando)} de eleitores</span>,
          t.atualizadoEmFonte && (
            <span key="fonte" className="placar__fonte" data-testid="atualizado-fonte">
              dados oficiais do TSE, atualizados às {horaBrasilia(Date.parse(t.atualizadoEmFonte))} · a página confere a cada 10 s
            </span>
          ),
        ]
          .filter(Boolean)
          .flatMap((parte, n) => (n ? [" · ", parte] : [parte]))}
      </p>
    </section>
  );
}

/** Governadores (visão Brasil): uma faixa por UF com 2º turno. */
export function PlacarGovernadores({ areas, aoEscolher, agora }: { areas: AreaMapa[]; aoEscolher: (uf: string) => void; agora: number }) {
  const antes = agora < INICIO_DIVULGACAO_MS;
  return (
    <section className="placar placar--multi" data-testid="placar">
      <h2 className="placar__titulo">
        {antes ? `A apuração começa em ${relogio(INICIO_DIVULGACAO_MS - agora)}` : "Governadores · 2º turno"}
        <small> · {areas.length} estados · escolha um</small>
      </h2>
      <div className="multi">
        {areas.map((a) => {
          const cands = ordenarPorNumero(a.candidatos ?? []);
          const cores = coresDe(cands);
          const p = parcelas(a.votos, cands.map((c) => c.numero));
          return (
            <button key={a.cd} type="button" className="multi__item" onClick={() => aoEscolher(a.cd)}>
              <span className="multi__uf">{a.nome}</span>
              <span className="multi__nomes">
                {cands.map((c, i) => (
                  <span key={c.numero} style={{ color: cores[i] }}>
                    {nomeCurto(c.nome)} {p ? pct1(p[i]) : ""}
                  </span>
                ))}
              </span>
              <span className="barra barra--fina">
                <span className="barra__lado" style={{ width: `${p ? p[0] : 1}%`, background: cores[0] }} />
                <span className="barra__lado barra__lado--dir" style={{ width: `${p ? p[1] : 1}%`, background: cores[1] }} />
                <span className="barra__meio" aria-hidden="true" />
              </span>
              <span className="multi__apurado">{pct1(a.percentualSecoes ?? 0)} apurado</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export { horaBrasilia };
