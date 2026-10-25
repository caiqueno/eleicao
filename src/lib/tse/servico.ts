import { CARGOS, ELEICAO_CONFIG, TSE_AMBIENTE, UFS, type CargoId } from "@/config/eleicao";
import type { OpcaoAbrangencia, RespostaApi } from "@/lib/tipos";
import { eleicoesSegundoTurno, opcoesAbrangencia } from "./configuracao";
import { decodificarArquivoTse } from "./decodificar";
import { buscarTexto, ErroFonte, urlTse, type OpcoesBusca } from "./http";
import { normalizarResultado, RespostaInvalida } from "./resultado";

/** Cache no servidor: config muda raramente; resultado é consultado no máximo a cada 30 s. */
export const CACHE_CONFIG_S = 300;
export const CACHE_RESULTADO_S = 30;

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
  const texto = await buscarTexto(URL_CONFIG, { revalidar: CACHE_CONFIG_S, ...opcoes });
  return eleicoesSegundoTurno(decodificarArquivoTse(texto));
}

export async function listarAbrangencias(opcoes: OpcoesBusca = {}): Promise<OpcaoAbrangencia[]> {
  return opcoesAbrangencia(await carregarEleicoes(opcoes));
}

function resposta(estado: RespostaApi["estado"], mensagem: string | null, resultado: RespostaApi["resultado"] = null): RespostaApi {
  return { estado, mensagem, consultadoEm: new Date().toISOString(), resultado };
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

  // Em 2026 o TSE publica o resultado como JWS; se não existir, tenta o mesmo arquivo em JSON simples.
  let url = urlResultado(eleicao.codigoEleicao, cargo.codigoCargo, uf, "jws");
  let texto: string;
  try {
    try {
      texto = await buscarTexto(url, { revalidar: CACHE_RESULTADO_S, ...opcoes });
    } catch (erro) {
      if (!(erro instanceof ErroFonte && erro.tipo === "nao-encontrado")) throw erro;
      url = urlResultado(eleicao.codigoEleicao, cargo.codigoCargo, uf, "json");
      texto = await buscarTexto(url, { revalidar: CACHE_RESULTADO_S, ...opcoes });
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

  try {
    return resposta("ok", null, normalizarResultado(decodificarArquivoTse(texto), cargo, uf, url));
  } catch (erro) {
    const motivo = erro instanceof RespostaInvalida ? erro.message : "estrutura não reconhecida";
    return resposta("invalido", `A resposta do TSE não passou na validação (${motivo}).`);
  }
}

function mensagemErro(erro: unknown, oque: string): string {
  if (erro instanceof ErroFonte) return `${erro.message} (${oque}).`;
  return `Não foi possível interpretar a ${oque} do TSE.`;
}
