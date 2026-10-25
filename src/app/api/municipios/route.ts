import { NextResponse } from "next/server";
import { listarMunicipios } from "@/lib/tse/mapa";

export const dynamic = "force-dynamic";

/** Índice para a busca: [uf, código TSE, código IBGE, nome]. */
export async function GET() {
  try {
    const lista = await listarMunicipios();
    return NextResponse.json(
      { municipios: lista.map((m) => [m.uf, m.cd, m.ibge ?? "", m.nome]) },
      { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=3600" } },
    );
  } catch {
    return NextResponse.json({ erro: "Lista de municípios indisponível no TSE" }, { status: 502 });
  }
}
