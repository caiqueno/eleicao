import { CARGOS, ELEICAO_CONFIG, UFS, type CargoId } from "@/config/eleicao";
import type { OpcaoAbrangencia } from "@/lib/tipos";

/** Estrutura mínima do ele-c.json usada pela aplicação (campos reais do TSE). */
interface CargoCfg { cd: string; ds: string }
interface AbrCfg { cd: string; cp: CargoCfg[] }
interface EleicaoCfg { cd: string; t: string; nm: string; abr: AbrCfg[] }
interface PleitoCfg { cd: string; c: string; dt: string; e: EleicaoCfg[] }

function eObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Valida e extrai os pleitos do ele-c.json. Lança erro se a estrutura não for a esperada. */
export function lerPleitos(dados: unknown): PleitoCfg[] {
  if (!eObjeto(dados) || !Array.isArray(dados.pl)) {
    throw new Error("ele-c.json sem lista de pleitos (pl)");
  }
  return dados.pl.filter(eObjeto).map((p) => ({
    cd: String(p.cd ?? ""),
    c: String(p.c ?? ""),
    dt: String(p.dt ?? ""),
    e: (Array.isArray(p.e) ? p.e : []).filter(eObjeto).map((e) => ({
      cd: String(e.cd ?? ""),
      t: String(e.t ?? ""),
      nm: String(e.nm ?? ""),
      abr: (Array.isArray(e.abr) ? e.abr : []).filter(eObjeto).map((a) => ({
        cd: String(a.cd ?? "").toLowerCase(),
        cp: (Array.isArray(a.cp) ? a.cp : []).filter(eObjeto).map((c) => ({
          cd: String(c.cd ?? ""),
          ds: String(c.ds ?? ""),
        })),
      })),
    })),
  }));
}

export interface EleicaoSegundoTurno {
  cargo: CargoId;
  codigoEleicao: string;
  nome: string;
  /** Abrangências declaradas pelo TSE para o cargo nesta eleição ("br" ou siglas de UF). */
  abrangencias: string[];
}

/**
 * Localiza no ele-c.json as eleições configuradas, exigindo:
 * mesmo pleito e ciclo, turno "2" e o cargo esperado.
 */
export function eleicoesSegundoTurno(dados: unknown): EleicaoSegundoTurno[] {
  const pleito = lerPleitos(dados).find(
    (p) => p.cd === ELEICAO_CONFIG.pleito && p.c === ELEICAO_CONFIG.ciclo,
  );
  if (!pleito) return [];
  const resultado: EleicaoSegundoTurno[] = [];
  for (const cargo of Object.values(CARGOS)) {
    const eleicao = pleito.e.find((e) => e.cd === cargo.codigoEleicao);
    if (!eleicao || eleicao.t !== "2") continue;
    const abrangencias = eleicao.abr
      .filter((a) => a.cp.some((c) => c.cd === cargo.codigoCargo))
      .map((a) => a.cd)
      .filter((uf) => uf in UFS);
    if (abrangencias.length) {
      resultado.push({ cargo: cargo.id, codigoEleicao: eleicao.cd, nome: eleicao.nm, abrangencias });
    }
  }
  return resultado;
}

/** UFs (sem "br" e sem exterior) — presidente também é totalizado por UF. */
const UFS_ESTADOS = Object.keys(UFS).filter((uf) => uf !== "br" && uf !== "zz");

export function opcoesAbrangencia(eleicoes: EleicaoSegundoTurno[]): OpcaoAbrangencia[] {
  const opcoes: OpcaoAbrangencia[] = [];
  for (const e of eleicoes) {
    const ufs = e.abrangencias.includes("br") && e.cargo === "presidente"
      ? ["br", ...UFS_ESTADOS, "zz"]
      : e.abrangencias;
    for (const uf of ufs) opcoes.push({ cargo: e.cargo, uf, nome: UFS[uf] ?? uf.toUpperCase() });
  }
  return opcoes;
}
