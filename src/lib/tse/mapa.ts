import { after } from "next/server";
import { CARGOS, ELEICAO_CONFIG, TSE_AMBIENTE, UFS, type CargoId } from "@/config/eleicao";
import type { ResultadoSegundoTurno } from "@/lib/tipos";
import { obterArquivo } from "./cache";
import { decodificarArquivoTse } from "./decodificar";
import { ErroFonte, urlTse, type OpcoesBusca } from "./http";
import { inteiroOuNulo, percentualOuNulo, dataHoraTse } from "./numeros";
import { normalizarResultado, RespostaInvalida } from "./resultado";
import { CACHE_RESULTADO_MS, consultarResultado, eUfValida, ufsGovernador } from "./servico";

/**
 * Dados do mapa: uma linha por UF (visão Brasil) ou por município (visão UF).
 *
 * Arquivos do TSE usados (todos conferidos no feed real em 25/10/2026):
 * - `<uf>-c<cargo>-e<ele>-u.jws`: resultado da UF ou do município;
 * - `<uf>-e<ele>-ab.jws`: andamento por município (seções totalizadas, eleitorado);
 * - `config/mun-e<ele>-cm.json`: nomes e códigos IBGE dos municípios.
 *
 * Para não sobrecarregar o TSE, o resultado de um município só é baixado
 * quando o andamento mostra seções novas nele (mesma estratégia do app oficial).
 */

export interface CandidatoMapa {
  numero: string;
  nome: string;
  partido: string | null;
  sqcand: string | null;
}

export interface AreaMapa {
  /** Sigla da UF (visão Brasil) ou código TSE do município. */
  cd: string;
  nome: string;
  /** Código IBGE do município (liga ao desenho do mapa); null para UFs e exterior. */
  ibge: string | null;
  secoesTotal: number | null;
  secoesTotalizadas: number | null;
  percentualSecoes: number | null;
  eleitorado: number | null;
  eleitoradoFaltando: number | null;
  /** Votos por número de candidato; null enquanto não há seção apurada ou o arquivo não foi lido. */
  votos: Record<string, number> | null;
  validos: number | null;
  atualizadoEmFonte: string | null;
  finalizada: boolean;
  /** Candidatos da própria área (visão Brasil de Governador: cada UF tem os seus). */
  candidatos?: CandidatoMapa[];
}

export interface RespostaMapa {
  estado: "ok" | "erro-fonte" | "nao-suportado";
  mensagem: string | null;
  consultadoEm: string;
  cargo: CargoId;
  uf: string;
  candidatos: CandidatoMapa[];
  areas: AreaMapa[];
  /** Municípios com seções apuradas cujos votos ainda estão sendo baixados. */
  pendentes: number;
}

const CACHE_MUNICIPIOS_MS = 6 * 60 * 60_000;
/** Quantos resultados municipais baixar dentro da própria requisição; o resto segue em segundo plano. */
const LIMITE_SINCRONO = 40;

const pad = (n: string, tam: number) => n.padStart(tam, "0");
const e6 = (ele: string) => `e${pad(ele, 6)}`;

type Obj = Record<string, unknown>;
const eObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export function urlResultadoArea(ele: string, cargo: string, uf: string, municipio = ""): string {
  return urlTse(TSE_AMBIENTE, ELEICAO_CONFIG.ciclo, ele, "dados", uf, `${uf}${municipio}-c${pad(cargo, 4)}-${e6(ele)}-u.jws`);
}
export function urlAndamento(ele: string, uf: string): string {
  return urlTse(TSE_AMBIENTE, ELEICAO_CONFIG.ciclo, ele, "dados", uf, `${uf}-${e6(ele)}-ab.jws`);
}
/** Lista de municípios da eleição de Presidente: cobre todos os municípios e o exterior. */
export const URL_MUNICIPIOS = urlTse(
  TSE_AMBIENTE,
  ELEICAO_CONFIG.ciclo,
  CARGOS.presidente.codigoEleicao,
  "config",
  `mun-${e6(CARGOS.presidente.codigoEleicao)}-cm.json`,
);

export interface Municipio {
  uf: string;
  cd: string;
  ibge: string | null;
  nome: string;
}

/** Lê o arquivo de municípios (EA12): abr[]{cd, mu[]{cd, cdi, nm}}. */
export function lerMunicipios(dados: unknown): Municipio[] {
  if (!eObj(dados) || !Array.isArray(dados.abr)) throw new RespostaInvalida("Arquivo de municípios sem abr");
  const lista: Municipio[] = [];
  for (const abr of dados.abr.filter(eObj)) {
    const uf = String(abr.cd ?? "").toLowerCase();
    if (!eUfValida(uf) || uf === "br") continue;
    for (const mu of (Array.isArray(abr.mu) ? abr.mu : []).filter(eObj)) {
      const cd = String(mu.cd ?? "");
      const nome = String(mu.nm ?? "").trim();
      if (!/^\d{1,6}$/.test(cd) || !nome) continue;
      const cdi = String(mu.cdi ?? "");
      lista.push({ uf, cd: pad(cd, 5), ibge: /^\d{7}$/.test(cdi) ? cdi : null, nome });
    }
  }
  return lista;
}

export async function listarMunicipios(opcoes: OpcoesBusca = {}): Promise<Municipio[]> {
  const { texto } = await obterArquivo(URL_MUNICIPIOS, CACHE_MUNICIPIOS_MS, opcoes);
  return lerMunicipios(decodificarArquivoTse(texto));
}

/** Andamento por município (EA15): abr[]{cdabr, s{ts,st,pstn}, e{te,esnt}, dt, ht, and}. */
export interface AndamentoMunicipio {
  cd: string;
  secoesTotal: number | null;
  secoesTotalizadas: number | null;
  percentualSecoes: number | null;
  eleitorado: number | null;
  eleitoradoFaltando: number | null;
  atualizadoEmFonte: string | null;
  versao: string;
  finalizada: boolean;
}

export function lerAndamento(dados: unknown, eleEsperada: string): AndamentoMunicipio[] {
  if (!eObj(dados) || !Array.isArray(dados.abr)) throw new RespostaInvalida("Andamento sem abr");
  if (dados.ele !== undefined && Number(dados.ele) !== Number(eleEsperada)) {
    throw new RespostaInvalida(`Andamento de outra eleição: ${String(dados.ele)}`);
  }
  if (dados.t !== undefined && String(dados.t) !== "2") throw new RespostaInvalida("Andamento não é do 2º turno");
  return dados.abr.filter(eObj).flatMap((a) => {
    const cd = String(a.cdabr ?? "");
    if (!/^\d{1,6}$/.test(cd)) return [];
    const s = eObj(a.s) ? a.s : {};
    const e = eObj(a.e) ? a.e : {};
    const st = inteiroOuNulo(s.st);
    const pct = percentualOuNulo(s.pstn);
    return [
      {
        cd: pad(cd, 5),
        secoesTotal: inteiroOuNulo(s.ts),
        secoesTotalizadas: st,
        percentualSecoes: pct,
        eleitorado: inteiroOuNulo(e.te),
        eleitoradoFaltando: inteiroOuNulo(e.esnt),
        atualizadoEmFonte: dataHoraTse(a.dt, a.ht),
        versao: `${String(a.dt ?? "")}|${String(a.ht ?? "")}|${st ?? ""}`,
        finalizada: a.and === "f" && pct === 100,
      },
    ];
  });
}

function votosDe(r: ResultadoSegundoTurno): Record<string, number> | null {
  if (r.candidatos.some((c) => c.votos === null)) return null;
  return Object.fromEntries(r.candidatos.map((c) => [c.numero, c.votos as number]));
}

function candidatosDe(r: ResultadoSegundoTurno): CandidatoMapa[] {
  return [...r.candidatos]
    .sort((a, b) => Number(a.numero) - Number(b.numero))
    .map((c) => ({ numero: c.numero, nome: c.nome, partido: c.partido, sqcand: c.sqcand }));
}

function areaDeResultado(cd: string, nome: string, ibge: string | null, r: ResultadoSegundoTurno): AreaMapa {
  const t = r.totalizacao;
  return {
    cd,
    nome,
    ibge,
    secoesTotal: t.secoesTotal,
    secoesTotalizadas: t.secoesTotalizadas,
    percentualSecoes: t.percentualSecoesTotalizadas,
    eleitorado: r.votos.eleitorado,
    eleitoradoFaltando: r.votos.eleitoradoFaltando,
    votos: (t.secoesTotalizadas ?? 0) > 0 ? votosDe(r) : null,
    validos: r.votos.validos,
    atualizadoEmFonte: t.atualizadoEmFonte,
    finalizada: t.finalizada,
  };
}

function mensagemErro(erro: unknown): string {
  if (erro instanceof ErroFonte) return erro.message;
  if (erro instanceof RespostaInvalida) return `Resposta do TSE não passou na validação: ${erro.message}`;
  return "Falha ao consultar o TSE";
}

/** Visão Brasil: uma área por UF (e exterior, para Presidente). */
export async function mapaBrasil(cargoId: CargoId, opcoes: OpcoesBusca = {}): Promise<RespostaMapa> {
  const cargo = CARGOS[cargoId];
  const vazio = (estado: RespostaMapa["estado"], mensagem: string | null): RespostaMapa => ({
    estado,
    mensagem,
    consultadoEm: new Date().toISOString(),
    cargo: cargoId,
    uf: "br",
    candidatos: [],
    areas: [],
    pendentes: 0,
  });
  let candidatos: CandidatoMapa[] = [];
  let ufs: string[];
  if (cargoId === "presidente") {
    const base = await consultarResultado(cargoId, "br", opcoes);
    if (base.estado === "nao-suportado") return vazio("nao-suportado", base.mensagem);
    if (base.estado !== "ok" || !base.resultado) return vazio("erro-fonte", base.mensagem);
    candidatos = candidatosDe(base.resultado);
    ufs = Object.keys(UFS).filter((u) => u !== "br");
  } else {
    try {
      ufs = await ufsGovernador(opcoes);
    } catch (erro) {
      return vazio("erro-fonte", mensagemErro(erro));
    }
    if (ufs.length === 0) return vazio("nao-suportado", "O TSE não lista 2º turno para Governador.");
  }

  let maisAntigo: string | null = null;
  const areas: AreaMapa[] = [];
  let falhas = 0;
  await Promise.all(
    ufs.map(async (uf) => {
      const url = urlResultadoArea(cargo.codigoEleicao, cargo.codigoCargo, uf);
      try {
        const arq = await obterArquivo(url, CACHE_RESULTADO_MS, opcoes);
        const r = normalizarResultado(decodificarArquivoTse(arq.texto), cargo, uf, url);
        const area = areaDeResultado(uf, UFS[uf], null, r);
        if (cargoId === "governador") area.candidatos = candidatosDe(r);
        areas.push(area);
        if (!maisAntigo || arq.obtidoEm < maisAntigo) maisAntigo = arq.obtidoEm;
      } catch {
        falhas++;
      }
    }),
  );
  areas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return {
    estado: areas.length > 0 ? "ok" : "erro-fonte",
    mensagem: falhas > 0 ? `${falhas} área(s) não responderam nesta consulta ao TSE.` : null,
    consultadoEm: maisAntigo ?? new Date().toISOString(),
    cargo: cargoId,
    uf: "br",
    candidatos,
    areas,
    pendentes: 0,
  };
}

/** Resultados municipais já baixados, por versão do andamento. */
const municipais = new Map<string, { versao: string; area: AreaMapa }>();
const preenchendo = new Set<string>();

/** Só para testes. */
export function limparMunicipais() {
  municipais.clear();
  preenchendo.clear();
}

async function baixarMunicipio(
  cargoId: CargoId,
  uf: string,
  and: AndamentoMunicipio,
  info: Municipio | undefined,
  opcoes: OpcoesBusca,
) {
  const cargo = CARGOS[cargoId];
  const url = urlResultadoArea(cargo.codigoEleicao, cargo.codigoCargo, uf, and.cd);
  // O andamento já diz quando o município mudou: o arquivo pode ficar em cache por mais tempo.
  const arq = await obterArquivo(url, 10 * 60_000, opcoes);
  const r = normalizarResultado(decodificarArquivoTse(arq.texto), cargo, and.cd, url, info?.nome);
  const area = areaDeResultado(and.cd, info?.nome ?? and.cd, info?.ibge ?? null, r);
  municipais.set(`${cargo.codigoEleicao}:${uf}:${and.cd}`, { versao: and.versao, area });
}

/** Visão UF: uma área por município (ou por cidade do exterior, em "zz"). */
export async function mapaUf(cargoId: CargoId, uf: string, opcoes: OpcoesBusca = {}): Promise<RespostaMapa> {
  const cargo = CARGOS[cargoId];
  const ufResultado = cargoId === "presidente" ? "br" : uf;
  const base = await consultarResultado(cargoId, ufResultado, opcoes);
  const resposta = (estado: RespostaMapa["estado"], mensagem: string | null, extra: Partial<RespostaMapa> = {}): RespostaMapa => ({
    estado,
    mensagem,
    consultadoEm: new Date().toISOString(),
    cargo: cargoId,
    uf,
    candidatos: [],
    areas: [],
    pendentes: 0,
    ...extra,
  });
  if (base.estado === "nao-suportado") return resposta("nao-suportado", base.mensagem);
  if (base.estado !== "ok" || !base.resultado) return resposta("erro-fonte", base.mensagem);

  let andamento: AndamentoMunicipio[];
  let consultadoEm: string;
  let municipios: Municipio[];
  try {
    const arq = await obterArquivo(urlAndamento(cargo.codigoEleicao, uf), CACHE_RESULTADO_MS, opcoes);
    andamento = lerAndamento(decodificarArquivoTse(arq.texto), cargo.codigoEleicao);
    consultadoEm = arq.obtidoEm;
    municipios = (await listarMunicipios(opcoes)).filter((m) => m.uf === uf);
  } catch (erro) {
    return resposta("erro-fonte", mensagemErro(erro));
  }
  const porCodigo = new Map(municipios.map((m) => [m.cd, m]));

  const chave = (cd: string) => `${cargo.codigoEleicao}:${uf}:${cd}`;
  const desatualizados = andamento.filter(
    (a) => (a.secoesTotalizadas ?? 0) > 0 && municipais.get(chave(a.cd))?.versao !== a.versao,
  );
  // Os maiores primeiro: aparecem antes no mapa e pesam mais no total.
  desatualizados.sort((a, b) => (b.eleitorado ?? 0) - (a.eleitorado ?? 0));
  const agora = desatualizados.slice(0, LIMITE_SINCRONO);
  const depois = desatualizados.slice(LIMITE_SINCRONO);
  await Promise.allSettled(agora.map((a) => baixarMunicipio(cargoId, uf, a, porCodigo.get(a.cd), opcoes)));
  if (depois.length > 0 && !preenchendo.has(chave("*"))) {
    preenchendo.add(chave("*"));
    const tarefa = async () => {
      try {
        await Promise.allSettled(depois.map((a) => baixarMunicipio(cargoId, uf, a, porCodigo.get(a.cd), opcoes)));
      } finally {
        preenchendo.delete(chave("*"));
      }
    };
    try {
      after(tarefa);
    } catch {
      void tarefa(); // fora de uma requisição (testes)
    }
  }

  let pendentes = 0;
  const areas: AreaMapa[] = andamento.map((a) => {
    const info = porCodigo.get(a.cd);
    const salvo = municipais.get(chave(a.cd));
    const atual = salvo && salvo.versao === a.versao;
    if ((a.secoesTotalizadas ?? 0) > 0 && !atual) pendentes++;
    return {
      cd: a.cd,
      nome: info?.nome ?? a.cd,
      ibge: info?.ibge ?? null,
      secoesTotal: a.secoesTotal,
      secoesTotalizadas: a.secoesTotalizadas,
      percentualSecoes: a.percentualSecoes,
      eleitorado: a.eleitorado,
      eleitoradoFaltando: a.eleitoradoFaltando,
      // Só mostra votos da mesma versão do andamento: nada vencido aparece como atual.
      votos: atual ? salvo.area.votos : null,
      validos: atual ? salvo.area.validos : null,
      atualizadoEmFonte: a.atualizadoEmFonte,
      finalizada: a.finalizada,
    };
  });
  areas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return resposta("ok", null, {
    consultadoEm,
    candidatos: candidatosDe(base.resultado),
    areas,
    pendentes,
  });
}
