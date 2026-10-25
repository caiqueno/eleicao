import type { Metadata } from "next";
import { CaixaDeEntrada } from "@/components/av/CaixaDeEntrada";

export const metadata: Metadata = { title: "Caixa de entrada · acompanhevotos", robots: { index: false, follow: false } };

export default function Pagina() {
  return <CaixaDeEntrada />;
}
