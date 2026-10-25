import type { CandidatoResultado } from "@/lib/tipos";

export interface PercentualExibido {
  valor: number | null;
  calculado: boolean;
}

/** Prefere o percentual da fonte; se ausente, usa o calculado pela aplicação. */
export function percentualExibido(c: CandidatoResultado): PercentualExibido {
  if (typeof c.percentualFonte === "number") return { valor: c.percentualFonte, calculado: false };
  if (typeof c.percentualCalculado === "number") return { valor: c.percentualCalculado, calculado: true };
  return { valor: null, calculado: false };
}

/** Ordena por votos (desc); candidatos sem votos informados vão para o fim. */
export function ordenarPorVotos(candidatos: CandidatoResultado[]): CandidatoResultado[] {
  return [...candidatos].sort((a, b) => {
    const va = a.votos;
    const vb = b.votos;
    if (va === null && vb === null) return a.nome.localeCompare(b.nome, "pt-BR");
    if (va === null) return 1;
    if (vb === null) return -1;
    if (vb !== va) return vb - va;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}
