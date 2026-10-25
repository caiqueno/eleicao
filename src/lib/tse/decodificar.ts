/**
 * Os arquivos de resultado de 2026 são publicados pelo TSE como JWS
 * (cabeçalho.conteúdo.assinatura, em base64url). O arquivo de configuração
 * comum (ele-c.json) é JSON simples. Este módulo aceita os dois formatos.
 *
 * A assinatura EdDSA NÃO é verificada aqui (ver docs/FONTE_TSE.md).
 */

function base64UrlParaTexto(parte: string): string {
  const b64 = parte.replace(/-/g, "+").replace(/_/g, "/");
  const preenchido = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Buffer.from(preenchido, "base64").toString("utf8");
}

export function decodificarArquivoTse(texto: string): unknown {
  const conteudo = texto.trim();
  if (conteudo.startsWith("{") || conteudo.startsWith("[")) {
    return JSON.parse(conteudo);
  }
  const partes = conteudo.split(".");
  if (partes.length !== 3 || partes.some((p) => !/^[A-Za-z0-9_-]*$/.test(p))) {
    throw new Error("Arquivo não é JSON nem JWS válido");
  }
  return JSON.parse(base64UrlParaTexto(partes[1]));
}
