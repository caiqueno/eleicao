import { NextResponse, type NextRequest } from "next/server";
import { consultarResultado, eCargoValido, eUfValida } from "@/lib/tse/servico";

export const dynamic = "force-dynamic";

const STATUS = { ok: 200, "sem-dados": 200, "nao-suportado": 200, invalido: 502, "erro-fonte": 502 } as const;

export async function GET(req: NextRequest) {
  const cargo = req.nextUrl.searchParams.get("cargo") ?? "presidente";
  const uf = (req.nextUrl.searchParams.get("uf") ?? "br").toLowerCase();
  if (!eCargoValido(cargo) || !eUfValida(uf)) {
    return NextResponse.json({ erro: "Parâmetros inválidos" }, { status: 400 });
  }
  const resposta = await consultarResultado(cargo, uf);
  return NextResponse.json(resposta, {
    status: STATUS[resposta.estado],
    // Cache curto na CDN da Vercel; o horário real dos dados está no corpo.
    headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=15" },
  });
}
