import { NextResponse, type NextRequest } from "next/server";
import { buscarGifs, MAX_BUSCA } from "@/lib/giphy";

export const dynamic = "force-dynamic";

/** Busca de GIFs para o bate-papo. A CDN guarda cada busca por 5 minutos. */
export async function GET(req: NextRequest) {
  const termo = (req.nextUrl.searchParams.get("q") ?? "").slice(0, MAX_BUSCA);
  const gifs = await buscarGifs(termo);
  if (gifs === null) return NextResponse.json({ erro: "GIFs indisponíveis" }, { status: 503, headers: { "Cache-Control": "public, s-maxage=60" } });
  return NextResponse.json({ gifs }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
}
