import { Suspense } from "react";
import { ELEICAO_CONFIG } from "@/config/eleicao";
import { Painel } from "@/components/Painel";
import { Esqueleto } from "@/components/Esqueleto";

export default function Pagina() {
  return (
    <div className="pagina">
      <header className="cabecalho">
        <h1 className="cabecalho__titulo">Acompanhe Votos</h1>
        <p className="cabecalho__sub">
          Eleições Gerais {ELEICAO_CONFIG.ano} · {ELEICAO_CONFIG.turno}º turno
          <span className="cabecalho__data"> · votação em {ELEICAO_CONFIG.dataPleito}</span>
        </p>
      </header>
      <Suspense
        fallback={
          <main id="conteudo" className="conteudo">
            <p className="sr-only" role="status">
              Carregando…
            </p>
            <Esqueleto />
          </main>
        }
      >
        <Painel />
      </Suspense>
    </div>
  );
}
