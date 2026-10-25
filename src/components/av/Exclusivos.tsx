"use client";

import type { ResultadoSegundoTurno } from "@/lib/tipos";
import type { AreaMapa } from "@/lib/tse/mapa";
import type { PrimeiroTurnoArea } from "@/lib/tse/primeiroTurno";
import { UFS } from "@/config/eleicao";
import { IconeApp } from "./IconesApps";
import { capitalizar, compacto, horaBrasilia, INICIO_DIVULGACAO_MS, inteiro, nomeCurto, parcelas, pct2, relogio, type CandidatoBase } from "./util";

/** Quem está à frente em cada área com votos (índice 0 ou 1), sem empates. */
export function liderancas(areas: AreaMapa[], numeros: string[]): [number, number] {
  const n: [number, number] = [0, 0];
  for (const a of areas) {
    if ((a.secoesTotalizadas ?? 0) === 0 || !a.votos) continue;
    const va = a.votos[numeros[0]] ?? 0;
    const vb = a.votos[numeros[1]] ?? 0;
    if (va > vb) n[0]++;
    else if (vb > va) n[1]++;
  }
  return n;
}

export interface Virada {
  cd: string;
  nome: string;
  /** Índice de quem liderava no 1º turno entre os dois. */
  antes: number;
  agora: number;
}

/** Áreas em que o líder entre os dois mudou do 1º turno (final) para a apuração atual do 2º. */
export function viradas(areas: AreaMapa[], pt: PrimeiroTurnoArea[], numeros: string[]): Virada[] {
  return areas.flatMap((a) => {
    if ((a.secoesTotalizadas ?? 0) === 0) return [];
    const agoraP = parcelas(a.votos, numeros);
    const antesP = parcelas(pt.find((x) => x.cd === a.cd)?.votos, numeros);
    if (!agoraP || !antesP || agoraP[0] === 50 || antesP[0] === 50) return [];
    const antes = antesP[0] > 50 ? 0 : 1;
    const agora = agoraP[0] > 50 ? 0 : 1;
    return antes === agora ? [] : [{ cd: a.cd, nome: UFS[a.cd] ?? capitalizar(a.nome), antes, agora }];
  });
}

/** Texto para mandar no WhatsApp: só números oficiais do TSE, com a hora e o percentual apurado. */
export function textoWhatsapp(r: ResultadoSegundoTurno | null, agora: number, url: string): string {
  if (!r) return `Acompanhe o 2º turno com os dados oficiais do TSE: ${url}`;
  const t = r.totalizacao;
  const cargo = r.cargo === "presidente" ? "Presidente" : `Governador · ${r.abrangenciaNome}`;
  if ((t.secoesTotalizadas ?? 0) === 0) {
    const quando = agora && agora < INICIO_DIVULGACAO_MS ? `começa em ${relogio(INICIO_DIVULGACAO_MS - agora)}` : "aguardando os primeiros números";
    return `2º turno · ${cargo}: a apuração ${quando}. Acompanhe com os dados oficiais do TSE: ${url}`;
  }
  const cands = [...r.candidatos].sort((a, b) => Number(a.numero) - Number(b.numero));
  const p = parcelas(Object.fromEntries(cands.map((c) => [c.numero, c.votos ?? 0])), cands.map((c) => c.numero));
  const linha = cands.map((c, i) => `${nomeCurto(c.nome)} ${pct2(c.percentualFonte ?? p?.[i])}`).join(" × ");
  const hora = t.atualizadoEmFonte ? ` (TSE, ${horaBrasilia(Date.parse(t.atualizadoEmFonte))})` : "";
  return `2º turno · ${cargo} · ${pct2(t.percentualSecoesTotalizadas)} das seções apuradas: ${linha}${hora}. Resultado parcial. Acompanhe: ${url}`;
}

interface PropsBoletim {
  resultado: ResultadoSegundoTurno | null;
  candidatos: CandidatoBase[];
  cores: string[];
  areas: AreaMapa[];
  nomeAreas: string;
  viradas: Virada[] | null;
  agora: number;
  aoWhatsapp: () => void;
}

/**
 * "Boletim do momento": o resumo em formato de boletim de urna — diferença em
 * votos, quantos eleitores ainda faltam, onde cada um lidera e quem virou.
 */
export function Boletim(p: PropsBoletim) {
  const r = p.resultado;
  const t = r?.totalizacao;
  const apurando = (t?.secoesTotalizadas ?? 0) > 0;
  const votos = r ? Object.fromEntries(r.candidatos.map((c) => [c.numero, c.votos ?? 0])) : {};
  const [na, nb] = p.candidatos.map((c) => c.numero);
  const diferenca = apurando ? Math.abs((votos[na] ?? 0) - (votos[nb] ?? 0)) : null;
  const frente = apurando && diferenca ? ((votos[na] ?? 0) > (votos[nb] ?? 0) ? 0 : 1) : null;
  const lid = liderancas(p.areas, [na, nb]);
  const antes = p.agora > 0 && p.agora < INICIO_DIVULGACAO_MS;

  return (
    <section className="boletim" data-testid="boletim" aria-label="Boletim do momento">
      <header className="boletim__cab">
        <span className="boletim__selo">BOLETIM</span>
        <span className="boletim__hora">{p.agora ? horaBrasilia(p.agora) : "--:--"}</span>
      </header>
      <dl className="boletim__linhas">
        <div>
          <dt>Seções apuradas</dt>
          <dd>{apurando ? pct2(t?.percentualSecoesTotalizadas) : "0%"}</dd>
        </div>
        <div>
          <dt>Diferença</dt>
          <dd>
            {diferenca === null ? (
              antes ? `começa em ${relogio(INICIO_DIVULGACAO_MS - p.agora)}` : "—"
            ) : (
              <>
                <span style={{ color: frente === null ? undefined : p.cores[frente] }}>{inteiro(diferenca)}</span> votos
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>Eleitores que faltam</dt>
          <dd>{compacto(r?.votos.eleitoradoFaltando ?? r?.votos.eleitorado ?? null)}</dd>
        </div>
        {apurando && r && r.votos.brancos !== null && r.votos.nulos !== null ? (
          <div>
            <dt>Brancos e nulos</dt>
            <dd>{inteiro(r.votos.brancos + r.votos.nulos)}</dd>
          </div>
        ) : null}
      </dl>
      <div className="boletim__corte" aria-hidden="true" />
      <h4 className="boletim__rotulo">À frente em</h4>
      <ul className="boletim__lid">
        {p.candidatos.map((c, i) => (
          <li key={c.numero}>
            <i style={{ background: p.cores[i] }} />
            <span>{nomeCurto(c.nome)}</span>
            <b>{lid[i]}</b>
          </li>
        ))}
        <li className="boletim__lidTotal">de {p.areas.length} {p.nomeAreas}</li>
      </ul>
      {p.viradas && (
        <>
          <h4 className="boletim__rotulo">Viradas desde o 1º turno</h4>
          {p.viradas.length === 0 ? (
            <p className="boletim__vazio">{apurando ? "Nenhum estado mudou de lado até agora." : "Aparece quando os votos chegarem."}</p>
          ) : (
            <ul className="boletim__viradas" data-testid="viradas">
              {p.viradas.slice(0, 6).map((v) => (
                <li key={v.cd}>
                  <span>{v.nome}</span>
                  <span>
                    <i style={{ background: p.cores[v.antes] }} /> → <i style={{ background: p.cores[v.agora] }} />{" "}
                    {nomeCurto(p.candidatos[v.agora]?.nome ?? "")}
                  </span>
                </li>
              ))}
              {p.viradas.length > 6 && <li className="boletim__lidTotal">e mais {p.viradas.length - 6}</li>}
            </ul>
          )}
        </>
      )}
      <button type="button" className="boletim__whats" onClick={p.aoWhatsapp} data-testid="mandar-whatsapp">
        <IconeApp app="whatsapp" tam={20} /> Mandar no WhatsApp
      </button>
      <p className="boletim__nota">“À frente” e “virada” usam só os votos já apurados pelo TSE e podem mudar. Não é resultado final.</p>
    </section>
  );
}

/** Pessoas com a página aberta agora (só aparece quando o contador está configurado). */
export function Presenca({ n }: { n: number | null }) {
  if (n === null) return null;
  return (
    <span className="presenca" data-testid="presenca" title="Aparelhos com esta página aberta nos últimos 100 segundos">
      <span className="presenca__ponto" aria-hidden="true" />
      <b>{inteiro(n)}</b> {n === 1 ? "pessoa acompanhando" : "pessoas acompanhando"}
    </span>
  );
}
