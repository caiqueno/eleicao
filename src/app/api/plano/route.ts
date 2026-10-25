import { NextResponse, type NextRequest } from "next/server";
import { PLANOS, PLANOS_BASE_URL } from "@/config/planos";

export const dynamic = "force-dynamic";

/**
 * Plano de governo oficial (PDF) de um candidato do 2º turno.
 * Baixa do TSE só o trecho do zip onde o PDF está e o devolve sem alteração.
 * Só aceita os candidatos listados em src/config/planos.ts: não é proxy genérico.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const desconhecidos = [...params.keys()].some((k) => k !== "sq" && k !== "parte");
  const sq = params.get("sq") ?? "";
  const parte = Number(params.get("parte") ?? "1");
  const plano = Object.hasOwn(PLANOS, sq) ? PLANOS[sq] : undefined;
  if (desconhecidos || !plano || !Number.isInteger(parte) || parte < 1 || parte > plano.partes.length) {
    return NextResponse.json({ erro: "Parâmetros inválidos" }, { status: 400 });
  }
  const { ini, tam } = plano.partes[parte - 1];
  let r: Response;
  try {
    r = await fetch(PLANOS_BASE_URL + plano.zip, {
      headers: { Range: `bytes=${ini}-${ini + tam - 1}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return NextResponse.json({ erro: "TSE indisponível" }, { status: 502 });
  }
  // O trecho só vale para o mesmo zip lido ao montar a lista.
  const faixa = r.headers.get("content-range") ?? "";
  if (r.status !== 206 || faixa !== `bytes ${ini}-${ini + tam - 1}/${plano.zipTam}` || !r.body) {
    await r.body?.cancel();
    return NextResponse.json({ erro: "Arquivo do TSE mudou" }, { status: 502 });
  }
  const nome = plano.partes.length > 1 ? `plano-de-governo-${sq}-parte-${parte}.pdf` : `plano-de-governo-${sq}.pdf`;
  return new NextResponse(r.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(tam),
      "Content-Disposition": `inline; filename="${nome}"`,
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
