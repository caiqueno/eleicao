/**
 * Modelo normalizado consumido pela interface. A interface nunca conhece os
 * arquivos do TSE: ela recebe este formato da rota /api/resultados.
 *
 * Regra geral: `null` significa "a fonte não informou". Nunca é convertido em 0.
 */

import type { CargoId } from "@/config/eleicao";

export interface CandidatoResultado {
  numero: string;
  nome: string;
  /** Partido ou federação/coligação, como informado pela fonte. */
  partido: string | null;
  votos: number | null;
  /** Percentual de votos válidos informado pela fonte (0–100). */
  percentualFonte: number | null;
  /** Percentual calculado pela aplicação: votos / soma dos votos dos candidatos. */
  percentualCalculado: number | null;
  /** Situação oficial (ex.: "Eleito"), só quando informada pela fonte. */
  situacao: string | null;
  eleito: boolean;
}

export interface Totalizacao {
  secoesTotalizadas: number | null;
  secoesTotal: number | null;
  /** Percentual de seções totalizadas informado pela fonte (0–100). */
  percentualSecoesTotalizadas: number | null;
  /** Data/hora da última totalização informada pelo TSE (ISO 8601, horário de Brasília). */
  atualizadoEmFonte: string | null;
  /** true só quando a fonte indica totalização encerrada. */
  finalizada: boolean;
}

export interface VotosGerais {
  eleitorado: number | null;
  comparecimento: number | null;
  abstencao: number | null;
  validos: number | null;
  brancos: number | null;
  nulos: number | null;
}

export interface ResultadoSegundoTurno {
  cargo: CargoId;
  cargoNome: string;
  abrangencia: string;
  abrangenciaNome: string;
  codigoEleicao: string;
  turno: 2;
  candidatos: CandidatoResultado[];
  totalizacao: Totalizacao;
  votos: VotosGerais;
  fonteUrl: string;
}

export type EstadoConsulta =
  | "ok"
  | "sem-dados" // eleição existe, mas o TSE ainda não publicou resultado
  | "nao-suportado" // cargo/UF sem 2º turno
  | "erro-fonte" // TSE fora do ar, tempo limite, resposta inválida
  | "invalido"; // resposta não passou na validação (turno/cargo/estrutura)

export interface RespostaApi {
  estado: EstadoConsulta;
  mensagem: string | null;
  /** Horário em que o servidor consultou o TSE com sucesso (ISO 8601 UTC). */
  consultadoEm: string;
  resultado: ResultadoSegundoTurno | null;
}

export interface OpcaoAbrangencia {
  cargo: CargoId;
  uf: string;
  nome: string;
}
