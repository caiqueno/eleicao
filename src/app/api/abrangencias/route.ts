import { NextResponse } from "next/server";
import { listarAbrangencias } from "@/lib/tse/servico";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const opcoes = await listarAbrangencias();
    return NextResponse.json(
      { consultadoEm: new Date().toISOString(), opcoes },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json(
      { consultadoEm: new Date().toISOString(), opcoes: [], erro: "Configuração do TSE indisponível" },
      { status: 502 },
    );
  }
}
