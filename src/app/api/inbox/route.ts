import { NextResponse, type NextRequest } from "next/server";
import { lerMensagens, senhaConfere } from "@/lib/mensagens";

export const dynamic = "force-dynamic";

const CABECALHOS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

/** Caixa de entrada: só com a senha de INBOX_SENHA no cabeçalho Authorization (Bearer). */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const senha = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!senhaConfere(senha)) return NextResponse.json({ erro: "Senha incorreta" }, { status: 401, headers: CABECALHOS });
  const mensagens = await lerMensagens();
  if (mensagens === null) return NextResponse.json({ erro: "Caixa indisponível" }, { status: 503, headers: CABECALHOS });
  return NextResponse.json({ mensagens }, { headers: CABECALHOS });
}
