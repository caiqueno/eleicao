/**
 * Planos de governo registrados no TSE pelos candidatos do 2º turno de 2026.
 *
 * Fonte: Portal de Dados Abertos do TSE, conjunto "Candidatos 2026", arquivos
 * "Proposta de governo" por UF (proposta_governo_2026_<UF>.zip, licença CC BY,
 * publicados em 25/10/2026 06:45–06:48 UTC). Os PDFs vêm guardados sem compressão
 * dentro do zip; `ini` e `tam` são a posição e o tamanho de cada PDF no zip, lidos
 * em 25/10/2026. A rota /api/plano baixa só esses bytes do TSE e entrega o PDF
 * como está, sem alteração. Se o TSE trocar o zip (tamanho diferente), a rota
 * recusa e a tela leva ao portal de dados abertos.
 */

export const PLANOS_FONTE_URL = "https://dadosabertos.tse.jus.br/dataset/candidatos-2026";
export const PLANOS_BASE_URL = "https://cdn.tse.jus.br/estatistica/sead/odsele/proposta_governo/";

export interface ParteDoPlano {
  ini: number;
  tam: number;
}

export interface PlanoDeGoverno {
  /** Zip do TSE onde o plano está. */
  zip: string;
  zipTam: number;
  partes: ParteDoPlano[];
}

const BR = { zip: "proposta_governo_2026_BR.zip", zipTam: 18275613 };
const AC = { zip: "proposta_governo_2026_AC.zip", zipTam: 8122316 };
const AM = { zip: "proposta_governo_2026_AM.zip", zipTam: 77038196 };
const DF = { zip: "proposta_governo_2026_DF.zip", zipTam: 10994146 };
const ES = { zip: "proposta_governo_2026_ES.zip", zipTam: 8397110 };
const RN = { zip: "proposta_governo_2026_RN.zip", zipTam: 6584538 };
const TO = { zip: "proposta_governo_2026_TO.zip", zipTam: 7994276 };

/** Por sequencial do candidato no TSE (sqcand). */
export const PLANOS: Record<string, PlanoDeGoverno> = {
  // Presidente
  "280002542548": { ...BR, partes: [{ ini: 4744305, tam: 1189907 }] },
  "280002551544": { ...BR, partes: [{ ini: 7547024, tam: 1940855 }] },
  // Governador · AC
  "10002532492": { ...AC, partes: [{ ini: 57, tam: 5313228 }] },
  "10002544107": { ...AC, partes: [{ ini: 6349383, tam: 656073 }] },
  // Governador · AM
  "40002532272": {
    ...AM,
    partes: [
      { ini: 57, tam: 10203763 },
      { ini: 10203877, tam: 10170299 },
      { ini: 20374233, tam: 10285667 },
      { ini: 30659957, tam: 8459864 },
      { ini: 39119878, tam: 1145980 },
      { ini: 40265915, tam: 10162707 },
      { ini: 50428679, tam: 10195164 },
      { ini: 60623900, tam: 10167090 },
    ],
  },
  "40002541626": { ...AM, partes: [{ ini: 73220165, tam: 128481 }] },
  // Governador · DF
  "70002552496": { ...DF, partes: [{ ini: 4772400, tam: 1271697 }] },
  "70002553055": { ...DF, partes: [{ ini: 9626194, tam: 433241 }] },
  // Governador · ES
  "80002552172": { ...ES, partes: [{ ini: 5008185, tam: 2258861 }] },
  "80002552682": { ...ES, partes: [{ ini: 7267103, tam: 966686 }] },
  // Governador · RN
  "200002534001": { ...RN, partes: [{ ini: 58, tam: 819488 }] },
  "200002535255": { ...RN, partes: [{ ini: 1389096, tam: 1526455 }] },
  // Governador · TO
  "270002544544": { ...TO, partes: [{ ini: 2127433, tam: 1002369 }] },
  "270002544599": { ...TO, partes: [{ ini: 3129860, tam: 3129796 }] },
};

export const urlPlano = (sq: string, parte: number) => `/api/plano?sq=${sq}&parte=${parte}`;
