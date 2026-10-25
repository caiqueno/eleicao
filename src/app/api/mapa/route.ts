import { NextResponse, type NextRequest } from "next/server";
import { mapaBrasil, mapaUf } from "@/lib/tse/mapa";
import { eCargoValido, eUfValida } from "@/lib/tse/servico";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const desconhecidos = [...params.keys()].some((k) => k !== "cargo" && k !== "uf");
  const cargo = params.get("cargo") ?? "presidente";
  const uf = params.get("uf") ?? "br";
  if (desconhecidos || !eCargoValido(cargo) || !eUfValida(uf)) {
    return NextResponse.json({ erro: "Parâmetros inválidos" }, { status: 400 });
  }
  const resposta = uf === "br" ? await mapaBrasil(cargo) : await mapaUf(cargo, uf);
  return NextResponse.json(resposta, {
    status: resposta.estado === "erro-fonte" ? 502 : 200,
    headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=20" },
  });
}
