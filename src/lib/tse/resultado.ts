import type { CargoConfig } from "@/config/eleicao";
import { UFS } from "@/config/eleicao";
import type { CandidatoResultado, ResultadoSegundoTurno } from "@/lib/tipos";
import { dataHoraTse, inteiroOuNulo, percentualOuNulo } from "./numeros";

export class RespostaInvalida extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RespostaInvalida";
  }
}

type Obj = Record<string, unknown>;
const eObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const lista = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(eObj) : []);
const texto = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;
/** Códigos podem vir como texto ou número. */
const codigo = (v: unknown): string | null =>
  typeof v === "number" && Number.isFinite(v) ? String(v) : texto(v);

/**
 * Normaliza o conteúdo de um arquivo de resultado "-u" do TSE.
 * Campos usados (nomes reais do feed): cdabr, ele, dt/ht, and, s{ts,st,pstn},
 * e{te,c,a}, v{vv,vb,tvn}, carg[].agr[].par[].cand[]{n,nm,nmu,vap,pvapn,e,st}.
 *
 * Rejeita a resposta se a abrangência, a eleição ou o cargo informados no
 * arquivo não baterem com o que foi pedido.
 */
export function normalizarResultado(
  dados: unknown,
  cargo: CargoConfig,
  uf: string,
  fonteUrl: string,
): ResultadoSegundoTurno {
  if (!eObj(dados)) throw new RespostaInvalida("Conteúdo não é um objeto JSON");

  const cdabr = texto(dados.cdabr)?.toLowerCase();
  if (cdabr && cdabr !== uf) {
    throw new RespostaInvalida(`Abrangência divergente: esperado ${uf}, recebido ${cdabr}`);
  }
  const ele = codigo(dados.ele);
  if (ele && Number(ele) === Number(cargo.codigoEleicaoPrimeiroTurno)) {
    throw new RespostaInvalida("Arquivo de 1º turno recebido no lugar do 2º turno");
  }
  if (ele && Number(ele) !== Number(cargo.codigoEleicao)) {
    throw new RespostaInvalida(`Eleição divergente: esperado ${cargo.codigoEleicao}, recebido ${ele}`);
  }

  const cargos = lista(dados.carg);
  if (!Array.isArray(dados.carg)) throw new RespostaInvalida("Arquivo sem lista de cargos (carg)");
  const cargoDados = cargos.filter((c) => {
    const cd = codigo(c.cd);
    return cd === null || Number(cd) === Number(cargo.codigoCargo);
  });
  if (cargos.length > 0 && cargoDados.length === 0) {
    throw new RespostaInvalida(`Cargo ${cargo.codigoCargo} não encontrado no arquivo`);
  }

  const candidatos: CandidatoResultado[] = [];
  for (const c of cargoDados) {
    for (const agr of lista(c.agr)) {
      for (const par of lista(agr.par)) {
        for (const cand of lista(par.cand)) {
          const numero = texto(cand.n) ?? (typeof cand.n === "number" ? String(cand.n) : null);
          const nome = texto(cand.nmu) ?? texto(cand.nm);
          if (!numero || !nome) throw new RespostaInvalida("Candidato sem número ou nome");
          const situacao = texto(cand.st);
          candidatos.push({
            numero,
            nome,
            partido: texto(par.sg) ?? texto(agr.nm),
            votos: inteiroOuNulo(cand.vap),
            percentualFonte: percentualOuNulo(cand.pvapn),
            percentualCalculado: null,
            situacao,
            eleito: cand.e === "s" || cand.e === "S",
          });
        }
      }
    }
  }

  const somaVotos = candidatos.every((c) => c.votos !== null)
    ? candidatos.reduce((t, c) => t + (c.votos ?? 0), 0)
    : null;
  for (const c of candidatos) {
    c.percentualCalculado = somaVotos && c.votos !== null ? (c.votos / somaVotos) * 100 : null;
  }
  candidatos.sort((a, b) => (b.votos ?? -1) - (a.votos ?? -1) || a.nome.localeCompare(b.nome, "pt-BR"));

  const s = eObj(dados.s) ? dados.s : {};
  const e = eObj(dados.e) ? dados.e : {};
  const v = eObj(dados.v) ? dados.v : {};
  const secoesTotal = inteiroOuNulo(s.ts);
  const secoesTotalizadas = inteiroOuNulo(s.st);
  if (secoesTotal !== null && secoesTotalizadas !== null && secoesTotalizadas > secoesTotal) {
    throw new RespostaInvalida("Seções totalizadas maior que o total de seções");
  }
  const percentualSecoes = percentualOuNulo(s.pstn);

  return {
    cargo: cargo.id,
    cargoNome: cargo.nome,
    abrangencia: uf,
    abrangenciaNome: UFS[uf] ?? uf.toUpperCase(),
    codigoEleicao: cargo.codigoEleicao,
    turno: 2,
    candidatos,
    totalizacao: {
      secoesTotal,
      secoesTotalizadas,
      percentualSecoesTotalizadas: percentualSecoes,
      atualizadoEmFonte: dataHoraTse(dados.dt, dados.ht),
      // Só considera encerrada quando o TSE marca andamento final E 100% das seções.
      finalizada: dados.and === "f" && percentualSecoes === 100,
    },
    votos: {
      eleitorado: inteiroOuNulo(e.te),
      comparecimento: inteiroOuNulo(e.c),
      abstencao: inteiroOuNulo(e.a),
      validos: inteiroOuNulo(v.vv),
      brancos: inteiroOuNulo(v.vb),
      nulos: inteiroOuNulo(v.tvn),
    },
    fonteUrl,
  };
}
