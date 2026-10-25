/**
 * Formatação pt-BR usada pela interface.
 *
 * Regra: valores ausentes (`null`/`undefined`/não finitos) viram "—",
 * nunca 0.
 */

export const FUSO_HORARIO = "America/Sao_Paulo";
export const SEM_VALOR = "—";

const formatoInteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const formatoPercentual = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatoHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_HORARIO,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_HORARIO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function valido(valor: number | null | undefined): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}

/** 1234567 → "1.234.567"; null → "—". */
export function formatarNumero(valor: number | null | undefined): string {
  return valido(valor) ? formatoInteiro.format(valor) : SEM_VALOR;
}

/** 52.3456 → "52,35%"; null → "—". O valor já está na escala 0–100. */
export function formatarPercentual(valor: number | null | undefined): string {
  return valido(valor) ? `${formatoPercentual.format(valor)}%` : SEM_VALOR;
}

/**
 * Interpreta uma data ISO 8601. Datas sem fuso (o TSE informa horário de
 * Brasília) recebem o deslocamento -03:00.
 */
export function interpretarData(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const texto = iso.trim();
  const temFuso = /([zZ]|[+-]\d{2}:?\d{2})$/.test(texto);
  const comHora = /T\d{2}:\d{2}/.test(texto);
  const normalizado = !temFuso && comHora ? `${texto}-03:00` : texto;
  const data = new Date(normalizado);
  return Number.isNaN(data.getTime()) ? null : data;
}

/** "19:42:05" no horário de Brasília; null → "—". */
export function formatarHora(iso: string | null | undefined): string {
  const data = interpretarData(iso);
  return data ? formatoHora.format(data) : SEM_VALOR;
}

/** "25/10/2026, 19:42" no horário de Brasília; null → "—". */
export function formatarDataHora(iso: string | null | undefined): string {
  const data = interpretarData(iso);
  return data ? formatoDataHora.format(data) : SEM_VALOR;
}

/** Limita um percentual a 0–100 para uso em larguras de barra. */
export function limitarPercentual(valor: number | null | undefined): number {
  if (!valido(valor)) return 0;
  return Math.min(100, Math.max(0, valor));
}
