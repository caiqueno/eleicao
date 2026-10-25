import type { CargoId } from "@/config/eleicao";

/** Início previsto da divulgação dos votos pelo TSE (17h de Brasília). */
export const INICIO_DIVULGACAO_MS = Date.parse("2026-10-25T17:00:00-03:00");

/** Sigla da UF → código IBGE de 2 dígitos (nome dos arquivos de malha). */
export const UF_IBGE: Record<string, string> = {
  ro: "11", ac: "12", am: "13", rr: "14", pa: "15", ap: "16", to: "17", ma: "21", pi: "22", ce: "23", rn: "24",
  pb: "25", pe: "26", al: "27", se: "28", ba: "29", mg: "31", es: "32", rj: "33", sp: "35", pr: "41", sc: "42",
  rs: "43", ms: "50", mt: "51", go: "52", df: "53",
};
export const IBGE_UF: Record<string, string> = Object.fromEntries(Object.entries(UF_IBGE).map(([u, c]) => [c, u]));

/** Cores por número de partido (os dois primeiros dígitos do número do candidato). */
const CORES_PARTIDO: Record<string, string> = {
  "13": "#e5302f", "22": "#2f6be4", "11": "#38a8e8", "55": "#f0a020", "15": "#26a65b", "10": "#1f9e8f",
  "44": "#3557d6", "40": "#f2c230", "12": "#d9534f", "45": "#3d7be0", "50": "#f7b500", "77": "#e67e22",
  "20": "#4f6fd8", "65": "#b52626", "43": "#2fb36b", "30": "#f47a20", "18": "#22a6a0", "70": "#e04b6f",
  "14": "#8e6be0", "25": "#c08a2d", "27": "#5b8def", "35": "#9b59b6", "36": "#c0392b",
};
const CORES_RESERVA = ["#e5302f", "#2f6be4"];

export function corCandidato(numero: string, indice: number, outros: string[] = []): string {
  const cor = CORES_PARTIDO[numero.slice(0, 2)];
  if (cor && !outros.includes(cor)) return cor;
  return CORES_RESERVA[indice % 2] === outros[0] ? "#f0a020" : CORES_RESERVA[indice % 2];
}

export interface CandidatoBase {
  numero: string;
  nome: string;
  partido: string | null;
  sqcand: string | null;
}

/** Cores dos dois candidatos (sempre distintas). */
export function coresDe(cands: CandidatoBase[]): string[] {
  const a = corCandidato(cands[0]?.numero ?? "", 0);
  const b = corCandidato(cands[1]?.numero ?? "", 1, [a]);
  return [a, b];
}

/** Nome curto para o placar: "LULA" → "Lula", "FLAVIO BOLSONARO" → "Flávio". */
const ACENTOS: Record<string, string> = { flavio: "Flávio", celina: "Celina", leao: "Leão", omar: "Omar" };
export function nomeCurto(nome: string, completo = false): string {
  const partes = nome
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => ACENTOS[p] ?? (["de", "da", "do", "dos", "das", "e"].includes(p) ? p : p[0].toUpperCase() + p.slice(1)));
  if (completo) return partes.join(" ");
  return partes[0] === "Professora" || partes[0] === "Professor" || partes[0] === "Delegado" || partes[0] === "Coronel"
    ? partes.slice(0, 2).join(" ")
    : partes[0];
}

/** Capitaliza nomes do TSE em maiúsculas ("SÃO PAULO" → "São Paulo"). */
export function capitalizar(nome: string): string {
  return nome
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((p, i) => (i > 0 && ["de", "da", "do", "dos", "das", "e", "d'"].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join("");
}

const fmtInt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const inteiro = (n: number | null | undefined) => (typeof n === "number" ? fmtInt.format(n) : "—");
export const pct1 = (n: number | null | undefined) => (typeof n === "number" ? `${fmt1.format(n)}%` : "—");
export const pct2 = (n: number | null | undefined) => (typeof n === "number" ? `${fmt2.format(n)}%` : "—");

/** 158745502 → "158,7 milhões"; 917000 → "917 mil". */
export function compacto(n: number | null | undefined, longo = true): string {
  if (typeof n !== "number") return "—";
  if (n >= 1e6) return `${fmt1.format(n / 1e6)} ${longo ? (n >= 2e6 ? "milhões" : "milhão") : "mi"}`;
  if (n >= 1e3) return `${fmtInt.format(Math.round(n / 1e3))} mil`;
  return fmtInt.format(n);
}

/** Percentual de cada candidato entre os votos dos dois (= votos válidos no 2º turno). */
export function parcelas(votos: Record<string, number> | null | undefined, numeros: string[]): number[] | null {
  if (!votos) return null;
  const v = numeros.map((n) => votos[n] ?? 0);
  const soma = v[0] + v[1];
  return soma > 0 ? v.map((x) => (x / soma) * 100) : null;
}

export function fotoUrl(cargo: CargoId, uf: string, sqcand: string | null): string | null {
  if (!sqcand) return null;
  return `/api/foto?cargo=${cargo}&uf=${cargo === "presidente" ? "br" : uf}&sq=${sqcand}`;
}

export function relogio(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const horaBrasilia = (ms: number) => fmtHora.format(new Date(ms));
