import { NextResponse, type NextRequest } from "next/server";
import { aceitarId, idValido, registrarSinal } from "@/lib/presenca";

export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "no-store" };

/** Sinal de "estou com a página aberta". Corpo: {"id": "<32 hex>"}. Resposta: {"agora": n} ou {"agora": null}. */
export async function POST(req: NextRequest) {
  if (Number(req.headers.get("content-length") ?? 0) > 200) {
    return NextResponse.json({ erro: "Corpo grande demais" }, { status: 413, headers: SEM_CACHE });
  }
  let id: unknown;
  try {
    id = ((await req.json()) as { id?: unknown })?.id;
  } catch {
    id = null;
  }
  if (!idValido(id)) return NextResponse.json({ erro: "Parâmetros inválidos" }, { status: 400, headers: SEM_CACHE });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  if (!aceitarId(ip, id)) return NextResponse.json({ erro: "Muitos sinais" }, { status: 429, headers: SEM_CACHE });

  const agora = await registrarSinal(id);
  return NextResponse.json({ agora }, { headers: SEM_CACHE });
}
