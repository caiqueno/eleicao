/**
 * Contatos do acompanhevotos. Para trocar o destino dos botões, mude só aqui.
 *
 * O botão "Siga para a próxima eleição" usa provisoriamente o WhatsApp do
 * projeto. Quando houver um perfil no Instagram ou um canal do WhatsApp,
 * troque SEGUIR_URL pelo link (ex.: "https://instagram.com/<perfil>" ou
 * "https://whatsapp.com/channel/<id>").
 */

/** WhatsApp do projeto, só dígitos com DDI e DDD. */
export const WHATSAPP_NUMERO = "5511944650268";
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMERO}`;

const comTexto = (texto: string) => `${WHATSAPP_URL}?text=${encodeURIComponent(texto)}`;

export const SEGUIR_URL = comTexto("Oi! Quero ser avisado quando o acompanhevotos abrir a próxima eleição.");

/** Valor do patrocínio exibido no topo. null mostra "valor a combinar". Ex.: "R$ 500 por dia". */
export const PATROCINIO_VALOR: string | null = null;
export const PATROCINIO_URL = comTexto("Oi! Quero saber como patrocinar o acompanhevotos.");
