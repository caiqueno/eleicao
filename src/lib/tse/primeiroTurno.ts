import { CARGOS, UFS, type CargoId } from "@/config/eleicao";
import { obterArquivo } from "./cache";
import { decodificarArquivoTse } from "./decodificar";
import { ErroFonte, type OpcoesBusca } from "./http";
import { urlResultadoArea } from "./mapa";
import { inteiroOuNulo } from "./numeros";
import { RespostaInvalida } from "./resultado";
import { consultarResultado } from "./servico";

/**
 * Resultado final do 1º turno (eleições 6257 e 6259) para os dois candidatos
 * que estão no 2º turno. Serve só para comparação e é sempre rotulado como 1º turno.
 */

export interface PrimeiroTurnoArea {
  cd: string;
  /** Votos no 1º turno, por número de candidato (só os dois do 2º turno). */
  votos: Record<string, number>;
  validos: number | null;
}

export interface RespostaPrimeiroTurno {
  estado: "ok" | "erro-fonte" | "nao-suportado";
  mensagem: string | null;
  areas: PrimeiroTurnoArea[];
}

/** O 1º turno já terminou: o arquivo não muda mais. */
const CACHE_PRIMEIRO_TURNO_MS = 6 * 60 * 60_000;

type Obj = Record<string, unknown>;
const eObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const lista = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(eObj) : []);

export function lerPrimeiroTurno(dados: unknown, cargoId: CargoId, cdabr: string, numeros: string[]): PrimeiroTurnoArea {
  const cargo = CARGOS[cargoId];
  if (!eObj(dados)) throw new RespostaInvalida("Conteúdo não é um objeto");
  if (Number(dados.ele) !== Number(cargo.codigoEleicaoPrimeiroTurno) || String(dados.t) !== "1") {
    throw new RespostaInvalida("Arquivo não é do 1º turno esperado");
  }
  if (String(dados.cdabr ?? "").toLowerCase() !== cdabr) throw new RespostaInvalida("Abrangência divergente");
  if (dados.and !== "f") throw new RespostaInvalida("Totalização do 1º turno não está encerrada");
  const votos: Record<string, number> = {};
  for (const c of lista(dados.carg)) {
    if (Number(c.cd) !== Number(cargo.codigoCargo)) continue;
    for (const agr of lista(c.agr))
      for (const par of lista(agr.par))
        for (const cand of lista(par.cand)) {
          const n = String(cand.n ?? "");
          const v = inteiroOuNulo(cand.vap);
          if (numeros.includes(n) && v !== null) votos[n] = v;
        }
  }
  if (Object.keys(votos).length !== numeros.length) throw new RespostaInvalida("Candidatos do 2º turno ausentes no 1º turno");
  const v = eObj(dados.v) ? dados.v : {};
  return { cd: cdabr, votos, validos: inteiroOuNulo(v.vv) };
}

export async function consultarPrimeiroTurno(
  cargoId: CargoId,
  uf: string,
  municipio: string | null,
  opcoes: OpcoesBusca = {},
): Promise<RespostaPrimeiroTurno> {
  const cargo = CARGOS[cargoId];
  const base = await consultarResultado(cargoId, cargoId === "presidente" ? "br" : uf, opcoes);
  if (base.estado === "nao-suportado") return { estado: "nao-suportado", mensagem: base.mensagem, areas: [] };
  if (base.estado !== "ok" || !base.resultado) return { estado: "erro-fonte", mensagem: base.mensagem, areas: [] };
  const numeros = base.resultado.candidatos.map((c) => c.numero);

  // Brasil (Presidente): o total e cada UF, para comparação e para a projeção.
  const alvos: { uf: string; mun: string }[] =
    municipio !== null
      ? [{ uf, mun: municipio }]
      : uf === "br"
        ? Object.keys(UFS).map((u) => ({ uf: u, mun: "" }))
        : [{ uf, mun: "" }];

  const areas: PrimeiroTurnoArea[] = [];
  let erro: string | null = null;
  await Promise.all(
    alvos.map(async ({ uf: u, mun }) => {
      const url = urlResultadoArea(cargo.codigoEleicaoPrimeiroTurno, cargo.codigoCargo, u, mun);
      try {
        const { texto } = await obterArquivo(url, CACHE_PRIMEIRO_TURNO_MS, opcoes);
        areas.push(lerPrimeiroTurno(decodificarArquivoTse(texto), cargoId, mun || u, numeros));
      } catch (e) {
        erro = e instanceof ErroFonte || e instanceof RespostaInvalida ? e.message : "Falha ao consultar o 1º turno";
      }
    }),
  );
  return { estado: areas.length > 0 ? "ok" : "erro-fonte", mensagem: erro, areas };
}
