/**
 * Configuração explícita da eleição acompanhada.
 *
 * Valores obtidos do arquivo oficial de configuração do TSE
 * (https://resultados.tse.jus.br/oficial/comum/config/ele-c.json), lido em
 * 25/10/2026: pleito 3221 (25/10/2026, ciclo ele2026) contém as eleições de
 * 2º turno 6258 (Federal, Presidente, abrangência BR) e 6260 (Estadual,
 * Governador, nas UFs listadas pelo TSE). Em tempo de execução a aplicação
 * relê esse arquivo e confere turno, cargo e UF antes de exibir qualquer dado.
 */

export const TSE_BASE_URL = "https://resultados.tse.jus.br";
export const TSE_AMBIENTE = "oficial";

export const ELEICAO_CONFIG = {
  ano: 2026,
  ciclo: "ele2026",
  pleito: "3221",
  dataPleito: "25/10/2026",
  turno: 2,
  descricao: "Eleições Gerais 2026 — 2º turno",
} as const;

export type CargoId = "presidente" | "governador";

export interface CargoConfig {
  id: CargoId;
  /** Código do cargo no TSE (campo `cp[].cd` do ele-c.json). */
  codigoCargo: string;
  nome: string;
  /** Código da eleição de 2º turno (campo `e[].cd`, com `t` = "2"). */
  codigoEleicao: string;
  /** Código da eleição de 1º turno correspondente (só para referência, nunca exibida). */
  codigoEleicaoPrimeiroTurno: string;
}

export const CARGOS: Record<CargoId, CargoConfig> = {
  presidente: {
    id: "presidente",
    codigoCargo: "1",
    nome: "Presidente",
    codigoEleicao: "6258",
    codigoEleicaoPrimeiroTurno: "6257",
  },
  governador: {
    id: "governador",
    codigoCargo: "3",
    nome: "Governador",
    codigoEleicao: "6260",
    codigoEleicaoPrimeiroTurno: "6259",
  },
};

export const UFS: Record<string, string> = {
  br: "Brasil",
  ac: "Acre", al: "Alagoas", ap: "Amapá", am: "Amazonas", ba: "Bahia",
  ce: "Ceará", df: "Distrito Federal", es: "Espírito Santo", go: "Goiás",
  ma: "Maranhão", mt: "Mato Grosso", ms: "Mato Grosso do Sul", mg: "Minas Gerais",
  pa: "Pará", pb: "Paraíba", pr: "Paraná", pe: "Pernambuco", pi: "Piauí",
  rj: "Rio de Janeiro", rn: "Rio Grande do Norte", rs: "Rio Grande do Sul",
  ro: "Rondônia", rr: "Roraima", sc: "Santa Catarina", sp: "São Paulo",
  se: "Sergipe", to: "Tocantins", zz: "Exterior",
};

/**
 * UFs com 2º turno para governador segundo o ele-c.json (25/10/2026).
 * Usado apenas como valor inicial; a lista efetiva vem do arquivo oficial.
 */
export const UFS_GOVERNADOR_SEGUNDO_TURNO = ["ac", "am", "df", "es", "rn", "to"];
