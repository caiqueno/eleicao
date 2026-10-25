import { CARGOS, ELEICAO_CONFIG, TSE_AMBIENTE, UFS, type CargoId } from "@/config/eleicao";
import type { OpcaoAbrangencia, RespostaApi } from "@/lib/tipos";
import { eleicoesSegundoTurno, opcoesAbrangencia } from "./configuracao";
import { decodificarArquivoTse } from "./decodificar";
import { obterArquivo } from "./cache";
import { ErroFonte, urlTse, type OpcoesBusca } from "./http";
import { normalizarResultado, RespostaInvalida } from "./resultado";

/** Cache no servidor (cache.ts): config muda raramente; resultado no máximo a cada 30 s por instância. */
export const CACHE_CONFIG_MS = 300_000;
export const CACHE_RESULTADO_MS = 30_000;

export const URL_CONFIG = urlTse(TSE_AMBIENTE, "comum", "config", "ele-c.json");

const pad = (n: string, tam: number) => n.padStart(tam, "0");

/** Caminho do arquivo de resultado (tipo "u") — diretório conforme `arq` do ele-c.json. */
export function urlResultado(
  codigoEleicao: string,
  codigoCargo: string,
  uf: string,
  extensao: "jws" | "json" = "jws",
): string {
  const arquivo = `${uf}-c${pad(codigoCargo, 4)}-e${pad(codigoEleicao, 6)}-u.${extensao}`;
  return urlTse(TSE_AMBIENTE, ELEICAO_CONFIG.ciclo, codigoEleicao, "dados", uf, arquivo);
}

export function eCargoValido(v: unknown): v is CargoId {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(CARGOS, v);
}
export function eUfValida(v: unknown): v is string {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(UFS, v);
}

async function carregarEleicoes(opcoes: OpcoesBusca) {
  const { texto } = await obterArquivo(URL_CONFIG, CACHE_CONFIG_MS, opcoes);
  return eleicoesSegundoTurno(decodificarArquivoTse(texto));
}

export async function listarAbrangencias(opcoes: OpcoesBusca = {}): Promise<OpcaoAbrangencia[]> {
  return opcoesAbrangencia(await carregarEleicoes(opcoes));
}

function resposta(
  estado: RespostaApi["estado"],
  mensagem: string | null,
  resultado: RespostaApi["resultado"] = null,
  consultadoEm: string = new Date().toISOString(),
): RespostaApi {
  return { estado, mensagem, consultadoEm, resultado };
}

/**
 * Extensão em que o TSE publicou o resultado (2026: JWS). Lembrada após o
 * primeiro sucesso para não gerar 404 desnecessários na outra extensão.
 */
let extensaoConfirmada: "jws" | "json" | null = null;

/** Só para testes: esquece a extensão confirmada. */
export function reiniciarExtensao() {
  extensaoConfirmada = null;
}

export async function consultarResultado(
  cargoId: CargoId,
  uf: string,
  opcoes: OpcoesBusca = {},
): Promise<RespostaApi> {
  const cargo = CARGOS[cargoId];
  let eleicoes;
  try {
    eleicoes = await carregarEleicoes(opcoes);
  } catch (erro) {
    return resposta("erro-fonte", mensagemErro(erro, "configuração das eleições"));
  }

  const eleicao = eleicoes.find((e) => e.cargo === cargoId);
  if (!eleicao) {
    return resposta("nao-suportado", `O TSE não lista eleição de 2º turno para ${cargo.nome} neste pleito.`);
  }
  const permitidas = opcoesAbrangencia([eleicao]).map((o) => o.uf);
  if (!permitidas.includes(uf)) {
    return resposta("nao-suportado", `Não há 2º turno para ${cargo.nome} em ${UFS[uf] ?? uf.toUpperCase()}.`);
  }

  const extensoes: ("jws" | "json")[] = extensaoConfirmada ? [extensaoConfirmada] : ["jws", "json"];
  let url = "";
  let arquivo;
  try {
    for (const [i, ext] of extensoes.entries()) {
      url = urlResultado(eleicao.codigoEleicao, cargo.codigoCargo, uf, ext);
      try {
        arquivo = await obterArquivo(url, CACHE_RESULTADO_MS, opcoes);
        extensaoConfirmada = ext;
        break;
      } catch (erro) {
        const ultimo = i === extensoes.length - 1;
        if (ultimo || !(erro instanceof ErroFonte && erro.tipo === "nao-encontrado")) throw erro;
      }
    }
  } catch (erro) {
    if (erro instanceof ErroFonte && erro.tipo === "nao-encontrado") {
      return resposta(
        "sem-dados",
        "O TSE ainda não divulgou resultados do 2º turno para esta seleção.",
      );
    }
    return resposta("erro-fonte", mensagemErro(erro, "resultado"));
  }
  if (!arquivo) return resposta("erro-fonte", "Não foi possível consultar o resultado do TSE.");

  try {
    const resultado = normalizarResultado(decodificarArquivoTse(arquivo.texto), cargo, uf, url);
    return resposta("ok", null, resultado, arquivo.obtidoEm);
  } catch (erro) {
    const motivo = erro instanceof RespostaInvalida ? erro.message : "estrutura não reconhecida";
    return resposta("invalido", `A resposta do TSE não passou na validação (${motivo}).`);
  }
}

function mensagemErro(erro: unknown, oque: string): string {
  if (erro instanceof ErroFonte) return `${erro.message} (${oque}).`;
  return `Não foi possível interpretar a ${oque} do TSE.`;
}

/** UFs com 2º turno para Governador, segundo o ele-c.json do TSE. */
export async function ufsGovernador(opcoes: OpcoesBusca = {}): Promise<string[]> {
  const eleicao = (await carregarEleicoes(opcoes)).find((e) => e.cargo === "governador");
  return eleicao ? eleicao.abrangencias.filter((u) => u !== "br" && eUfValida(u)) : [];
}
