import type { Totalizacao as DadosTotalizacao, VotosGerais } from "@/lib/tipos";
import { formatarHora, formatarNumero, formatarPercentual, limitarPercentual } from "@/lib/formatacao";

interface Props {
  totalizacao: DadosTotalizacao;
  votos: VotosGerais;
}

function percentualSecoes(t: DadosTotalizacao): { valor: number | null; calculado: boolean } {
  if (typeof t.percentualSecoesTotalizadas === "number") return { valor: t.percentualSecoesTotalizadas, calculado: false };
  if (typeof t.secoesTotalizadas === "number" && typeof t.secoesTotal === "number" && t.secoesTotal > 0) {
    return { valor: (t.secoesTotalizadas / t.secoesTotal) * 100, calculado: true };
  }
  return { valor: null, calculado: false };
}

export function Totalizacao({ totalizacao, votos }: Props) {
  const pct = percentualSecoes(totalizacao);
  const itens: { rotulo: string; valor: number | null }[] = [
    { rotulo: "Eleitorado", valor: votos.eleitorado },
    { rotulo: "Comparecimento", valor: votos.comparecimento },
    { rotulo: "Abstenção", valor: votos.abstencao },
    { rotulo: "Válidos", valor: votos.validos },
    { rotulo: "Brancos", valor: votos.brancos },
    { rotulo: "Nulos", valor: votos.nulos },
  ];
  const disponiveis = itens.filter((i) => i.valor !== null);

  return (
    <section className="painel-bloco totalizacao" aria-labelledby="totalizacao-titulo">
      <div className="totalizacao__cabeca">
        <h2 id="totalizacao-titulo" className="bloco-titulo">
          Seções totalizadas
        </h2>
        <p className="totalizacao__pct num">
          {formatarPercentual(pct.valor)}
          {pct.calculado && <span className="rotulo-calc"> calculado</span>}
        </p>
      </div>
      <div
        className="barra barra--secoes"
        role="progressbar"
        aria-label="Seções totalizadas"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct.valor === null ? undefined : Number(pct.valor.toFixed(2))}
        aria-valuetext={pct.valor === null ? "não informado" : formatarPercentual(pct.valor)}
      >
        <div className="barra__preenchimento" style={{ width: `${limitarPercentual(pct.valor)}%` }} />
      </div>
      <p className="totalizacao__secoes" data-testid="secoes-totalizadas">
        <span className="num">{formatarNumero(totalizacao.secoesTotalizadas)}</span> de{" "}
        <span className="num">{formatarNumero(totalizacao.secoesTotal)}</span> seções
      </p>
      <p className="totalizacao__fonte" data-testid="atualizado-fonte">
        {totalizacao.atualizadoEmFonte
          ? `Atualizado pelo TSE às ${formatarHora(totalizacao.atualizadoEmFonte)}`
          : "Horário da totalização não informado pelo TSE"}
      </p>
      {totalizacao.finalizada && (
        <p className="selo selo--final" data-testid="totalizacao-encerrada">
          Totalização encerrada
        </p>
      )}

      {disponiveis.length > 0 && (
        <dl className="kpis">
          {disponiveis.map((i) => (
            <div key={i.rotulo} className="kpi">
              <dt>{i.rotulo}</dt>
              <dd className="num">{formatarNumero(i.valor)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
