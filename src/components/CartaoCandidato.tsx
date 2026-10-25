import type { CandidatoResultado } from "@/lib/tipos";
import { formatarNumero, formatarPercentual, limitarPercentual } from "@/lib/formatacao";
import { percentualExibido } from "./candidatos";

interface Props {
  candidato: CandidatoResultado;
  posicao: number;
}

export function CartaoCandidato({ candidato, posicao }: Props) {
  const pct = percentualExibido(candidato);
  const eleito = candidato.eleito === true;
  const idTitulo = `cand-${candidato.numero}`;

  return (
    <article
      className={`cartao${eleito ? " cartao--eleito" : ""}`}
      data-testid="candidato"
      data-numero={candidato.numero}
      aria-labelledby={idTitulo}
    >
      <div className="cartao__topo">
        <span className="cartao__numero" aria-label={`Número ${candidato.numero}`}>
          {candidato.numero}
        </span>
        <div className="cartao__ident">
          <h3 id={idTitulo} className="cartao__nome">
            <span className="sr-only">{posicao}º: </span>
            {candidato.nome}
          </h3>
          <p className="cartao__partido">{candidato.partido ?? "Partido não informado"}</p>
        </div>
        {eleito && (
          <span className="selo selo--eleito" data-testid="selo-eleito">
            {candidato.situacao ?? "Eleito"}
          </span>
        )}
      </div>

      <div className="cartao__numeros">
        <p className="cartao__pct">
          <span className="num">{formatarPercentual(pct.valor)}</span>
          {pct.calculado && <span className="rotulo-calc"> calculado</span>}
        </p>
        <p className="cartao__votos">
          <span className="num">{formatarNumero(candidato.votos)}</span>{" "}
          {candidato.votos === null ? "(votos não informados)" : candidato.votos === 1 ? "voto" : "votos"}
        </p>
      </div>

      <div
        className="barra"
        role="img"
        aria-label={
          pct.valor === null
            ? "Percentual não informado"
            : `${formatarPercentual(pct.valor)} dos votos válidos${pct.calculado ? " (calculado pela aplicação)" : ""}`
        }
      >
        <div className="barra__preenchimento" style={{ width: `${limitarPercentual(pct.valor)}%` }} />
      </div>

      {candidato.situacao && !eleito && <p className="cartao__situacao">Situação: {candidato.situacao}</p>}
    </article>
  );
}
