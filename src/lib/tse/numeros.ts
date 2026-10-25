/** Converte números do TSE (texto ou número) sem transformar ausência em zero. */
export function inteiroOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return Number.isInteger(valor) && valor >= 0 ? valor : null;
  if (typeof valor !== "string" || !/^\d+$/.test(valor.trim())) return null;
  const n = Number(valor.trim());
  return Number.isSafeInteger(n) ? n : null;
}

/** Percentuais do TSE vêm como texto com vírgula decimal ("47,027772356"). */
export function percentualOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  let n: number;
  if (typeof valor === "number") n = valor;
  else if (typeof valor === "string" && /^\d+([.,]\d+)?$/.test(valor.trim())) {
    n = Number(valor.trim().replace(",", "."));
  } else return null;
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

/** "25/10/2026" + "20:15:32" → ISO 8601 no horário de Brasília (UTC−3, sem horário de verão desde 2019). */
export function dataHoraTse(data: unknown, hora: unknown): string | null {
  if (typeof data !== "string" || typeof hora !== "string") return null;
  const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data.trim());
  const h = /^(\d{2}):(\d{2}):(\d{2})$/.exec(hora.trim());
  if (!d || !h) return null;
  const [dia, mes, ano] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [hh, mm, ss] = [Number(h[1]), Number(h[2]), Number(h[3])];
  const calendario = new Date(Date.UTC(ano, mes - 1, dia));
  if (calendario.getUTCDate() !== dia || calendario.getUTCMonth() !== mes - 1) return null;
  if (hh > 23 || mm > 59 || ss > 59) return null;
  return `${d[3]}-${d[2]}-${d[1]}T${h[1]}:${h[2]}:${h[3]}-03:00`;
}
