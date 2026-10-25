import type { CandidatoResultado } from "@/lib/tipos";
import { formatarNumero, formatarPercentual } from "@/lib/formatacao";
import { percentualExibido } from "./candidatos";

interface Props {
  /** Exatamente dois candidatos, já ordenados por votos. */
  candidatos: [CandidatoResultado, CandidatoResultado];
}

/** Placar compacto do 2º turno: barra dividida com marca de 50%. */
export function Placar({ candidatos }: Props) {
  const [a, b] = candidatos;
  const pa = percentualExibido(a);
  const pb = percentualExibido(b);
  const soma = (pa.valor ?? 0) + (pb.valor ?? 0);
  const temBarra = pa.valor !== null && pb.valor !== null && soma > 0;
  const larguraA = temBarra ? ((pa.valor as number) / soma) * 100 : 50;
  const algumCalculado = pa.calculado || pb.calculado;

  return (
    <section className="placar" aria-labelledby="placar-titulo" data-testid="placar">
      <h2 id="placar-titulo" className="sr-only">
        Placar
      </h2>
      <div className="placar__lados">
        {[a, b].map((c, i) => {
          const p = i === 0 ? pa : pb;
          return (
            <div key={c.numero} className={`placar__lado placar__lado--${i === 0 ? "a" : "b"}`}>
              <p className="placar__nome">
                <span className="placar__marca" aria-hidden="true" />
                {c.nome}
                {c.eleito === true && <span className="selo selo--eleito selo--mini">{c.situacao ?? "Eleito"}</span>}
              </p>
              <p className="placar__pct num">{formatarPercentual(p.valor)}</p>
              <p className="placar__votos">
                <span className="num">{formatarNumero(c.votos)}</span> votos
              </p>
            </div>
          );
        })}
      </div>
      <div
        className={`placar__barra${temBarra ? "" : " placar__barra--vazia"}`}
        role="img"
        aria-label={
          temBarra
            ? `${a.nome} ${formatarPercentual(pa.valor)}, ${b.nome} ${formatarPercentual(pb.valor)}`
            : "Percentuais ainda não informados"
        }
      >
        {temBarra && (
          <>
            <div className="placar__seg placar__seg--a" style={{ width: `${larguraA}%` }} />
            <div className="placar__seg placar__seg--b" style={{ width: `${100 - larguraA}%` }} />
          </>
        )}
        <span className="placar__meio" aria-hidden="true" />
      </div>
      <p className="placar__legenda">
        <span>Marca central: 50% dos votos válidos</span>
        {algumCalculado && <span> · percentual calculado pela aplicação</span>}
      </p>
    </section>
  );
}
