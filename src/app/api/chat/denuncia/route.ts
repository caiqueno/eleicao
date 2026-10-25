import { NextResponse, type NextRequest } from "next/server";
import { denunciarChat } from "@/lib/chat";

export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "no-store" };

/** Denúncia de um comentário. Três denúncias de IPs diferentes ocultam o comentário até a moderação olhar. */
export async function POST(req: NextRequest) {
  let corpo: { id?: unknown } = {};
  try {
    corpo = (await req.json()) as { id?: unknown };
  } catch {
    /* corpo inválido */
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  const r = await denunciarChat(corpo?.id, ip);
  if (r === "invalido") return NextResponse.json({ erro: "Pedido inválido" }, { status: 400, headers: SEM_CACHE });
  if (r === "limite") return NextResponse.json({ erro: "Muitas denúncias seguidas" }, { status: 429, headers: SEM_CACHE });
  if (r === "indisponivel") return NextResponse.json({ erro: "Não foi possível denunciar agora" }, { status: 503, headers: SEM_CACHE });
  return NextResponse.json({ ok: true }, { headers: SEM_CACHE });
}
