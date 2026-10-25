import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, vi } from "vitest";

const PASTA = path.resolve(__dirname, "../../fixtures");

/** Lê uma fixture como texto (cópia nova a cada chamada). */
export function textoFixture(nome: string): string {
  return readFileSync(path.join(PASTA, nome), "utf8");
}

/** Lê uma fixture como objeto (cópia nova a cada chamada; pode ser alterada no teste). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixtures são lidas e modificadas livremente nos testes
export function fixture<T = Record<string, any>>(nome: string): T {
  return JSON.parse(textoFixture(nome)) as T;
}

const b64url = (s: string) =>
  Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Gera um JWS (header.payload.assinatura) com assinatura qualquer — não verificada pela aplicação. */
export function gerarJws(payload: unknown): string {
  return [b64url(JSON.stringify({ alg: "EdDSA", typ: "JWT" })), b64url(JSON.stringify(payload)), "assinatura_falsa-123"].join(".");
}

export const URL_CONFIG_TSE = "https://resultados.tse.jus.br/oficial/comum/config/ele-c.json";
export const urlResultadoTse = (ele: string, cargo: string, uf: string) =>
  `https://resultados.tse.jus.br/oficial/ele2026/${ele}/dados/${uf}/${uf}-c${cargo.padStart(4, "0")}-e${ele.padStart(6, "0")}-u.jws`;

type Rota = (init?: RequestInit) => Response | Promise<Response>;

/** fetch falso: responde por URL exata (sem query); URL não mapeada → 404. Registra as chamadas. */
export function fetchFalso(rotas: Record<string, Rota>) {
  return vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada instanceof Request ? entrada.url : entrada).split("?")[0];
    const rota = rotas[url];
    if (!rota) return new Response("not found", { status: 404 });
    return rota(init);
  });
}

export const responder = (corpo: string, status = 200) => () => new Response(corpo, { status });

/** fetch que só termina quando o sinal é abortado (simula o TSE sem responder). */
export const travar: Rota = (init) =>
  new Promise<Response>((_, rejeitar) => {
    const sinal = init?.signal;
    sinal?.addEventListener("abort", () => rejeitar(sinal.reason));
  });

/** Garante que nenhum teste do arquivo faça rede real: o fetch global passa a lançar erro. */
export function proibirRedeReal() {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: unknown) => {
        throw new Error(`Rede real proibida nos testes: ${String(u)}`);
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
}
