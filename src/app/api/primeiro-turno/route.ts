import { NextResponse, type NextRequest } from "next/server";
import { consultarPrimeiroTurno } from "@/lib/tse/primeiroTurno";
import { eCargoValido, eUfValida } from "@/lib/tse/servico";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const desconhecidos = [...params.keys()].some((k) => !["cargo", "uf", "mun"].includes(k));
  const cargo = params.get("cargo") ?? "presidente";
  const uf = params.get("uf") ?? "br";
  const mun = params.get("mun");
  const munValido = mun === null || (/^\d{5}$/.test(mun) && uf !== "br");
  if (desconhecidos || !eCargoValido(cargo) || !eUfValida(uf) || !munValido) {
    return NextResponse.json({ erro: "Parâmetros inválidos" }, { status: 400 });
  }
  const resposta = await consultarPrimeiroTurno(cargo, uf, mun);
  return NextResponse.json(resposta, {
    status: resposta.estado === "erro-fonte" ? 502 : 200,
    // Resultado final do 1º turno: não muda mais.
    headers: { "Cache-Control": resposta.estado === "ok" ? "public, s-maxage=3600, stale-while-revalidate=3600" : "no-store" },
  });
}
