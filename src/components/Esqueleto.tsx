/** Esqueleto exibido enquanto a primeira resposta não chega. */
export function Esqueleto() {
  return (
    <div className="esqueleto" aria-hidden="true">
      <div className="esq esq--placar" />
      <div className="esq esq--linha" />
      <div className="grade-cartoes">
        <div className="esq esq--cartao" />
        <div className="esq esq--cartao" />
      </div>
    </div>
  );
}
