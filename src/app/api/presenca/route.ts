import { NextResponse, type NextRequest } from "next/server";
import { aceitarId, idValido, registrarSinal } from "@/lib/presenca";

export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "no-store" };

/**
 * Sinal de "estou com a página aberta". Corpo: {"id": "<32 hex>", "visita"?: true}, com visita só no
 * primeiro sinal de cada abertura. Resposta: {"agora": n, "hoje": m, "total": t}, com null onde estiver indisponível.
 */
export async function POST(req: NextRequest) {
  if (Number(req.headers.get("content-length") ?? 0) > 200) {
    return NextResponse.json({ erro: "Corpo grande demais" }, { status: 413, headers: SEM_CACHE });
  }
  let id: unknown;
  let visita = false;
  try {
    const corpo = (await req.json()) as { id?: unknown; visita?: unknown };
    id = corpo?.id;
    visita = corpo?.visita === true;
  } catch {
    id = null;
  }
  if (!idValido(id)) return NextResponse.json({ erro: "Parâmetros inválidos" }, { status: 400, headers: SEM_CACHE });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  if (!aceitarId(ip, id)) return NextResponse.json({ erro: "Muitos sinais" }, { status: 429, headers: SEM_CACHE });

  return NextResponse.json(await registrarSinal(id, { visita }), { headers: SEM_CACHE });
}
