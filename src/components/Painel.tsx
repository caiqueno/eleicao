"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CARGOS, ELEICAO_CONFIG, UFS, type CargoId } from "@/config/eleicao";
import type { CandidatoResultado, RespostaApi } from "@/lib/tipos";
import { formatarHora, formatarPercentual } from "@/lib/formatacao";
import { useResultados, INTERVALO_SEGUNDOS, type UseResultados } from "@/hooks/useResultados";
import { useAbrangencias, type OpcoesPorCargo } from "@/hooks/useAbrangencias";
import { CartaoCandidato } from "./CartaoCandidato";
import { Placar } from "./Placar";
import { Totalizacao } from "./Totalizacao";
import { Esqueleto } from "./Esqueleto";
import { Anuncio } from "./Anuncio";
import { ordenarPorVotos } from "./candidatos";

type EstadoTela =
  | "carregando"
  | "ok"
  | "finalizada"
  | "desatualizado"
  | "sem-dados"
  | "nao-suportado"
  | "erro-fonte"
  | "invalido";

const LISTA_CARGOS: CargoId[] = ["presidente", "governador"];

function cargoDaUrl(valor: string | null): CargoId {
  return valor === "governador" ? "governador" : "presidente";
}

function ufDaUrl(cargo: CargoId, valor: string | null, opcoes: OpcoesPorCargo): string {
  const uf = (valor ?? "").toLowerCase();
  const lista = opcoes[cargo];
  if (cargo === "presidente") {
    return uf && uf in UFS ? uf : "br";
  }
  if (uf && uf !== "br" && uf in UFS) return uf;
  return lista[0]?.uf ?? "ac";
}

function nomeAbrangencia(uf: string): string {
  return UFS[uf] ?? uf.toUpperCase();
}

function definirEstado(r: UseResultados): EstadoTela {
  if (r.carregando) return "carregando";
  const tentativa = r.estadoUltimaTentativa;
  if (tentativa === "erro-fonte") return "erro-fonte";
  if (tentativa === "invalido") return "invalido";
  if (tentativa === "sem-dados") return "sem-dados";
  if (tentativa === "nao-suportado") return "nao-suportado";
  const res = r.ultimaValida?.resultado;
  if (!res) return "invalido";
  if (res.totalizacao.finalizada) return "finalizada";
  if (r.desatualizado) return "desatualizado";
  return "ok";
}

interface Aviso {
  tipo: "info" | "alerta" | "erro" | "sucesso";
  titulo: string;
  texto?: string;
}

function avisoDoEstado(
  estado: EstadoTela,
  r: UseResultados,
  cargoNome: string,
  abrangencia: string,
): Aviso | null {
  const detalhe = r.resposta?.mensagem ?? undefined;
  const horaValida = r.consultadoEm ? formatarHora(r.consultadoEm) : null;
  const proxima = `Nova tentativa automática em ${r.proximaEmSegundos} s.`;
  switch (estado) {
    case "carregando":
      return { tipo: "info", titulo: "Carregando resultados do TSE…" };
    case "sem-dados":
      return {
        tipo: "info",
        titulo: "Aguardando divulgação",
        texto:
          "O TSE ainda não divulgou resultados do 2º turno para esta seleção. A divulgação começa após o encerramento da votação.",
      };
    case "nao-suportado":
      return {
        tipo: "info",
        titulo: "Sem 2º turno nesta seleção",
        texto: `Segundo o TSE, não há 2º turno para ${cargoNome} em ${abrangencia}. Escolha outra opção acima.`,
      };
    case "erro-fonte":
      return {
        tipo: "erro",
        titulo: "Não foi possível consultar o TSE agora",
        texto: r.ultimaValida
          ? `Os dados podem estar desatualizados. Exibindo a última informação válida, consultada às ${horaValida ?? "—"}. ${proxima}`
          : `${r.erroRede ?? detalhe ?? "A fonte oficial não respondeu."} ${proxima}`,
      };
    case "invalido":
      return {
        tipo: "erro",
        titulo: "Resposta não validada",
        texto: r.ultimaValida
          ? `A resposta mais recente não passou na validação e foi descartada. Os dados podem estar desatualizados (última informação válida consultada às ${horaValida ?? "—"}).`
          : `${detalhe ?? "A resposta recebida não passou na validação de turno, cargo ou estrutura."} Por segurança, nada foi exibido.`,
      };
    case "desatualizado":
      return {
        tipo: "alerta",
        titulo: "Dados podem estar desatualizados",
        texto: `A última consulta bem-sucedida foi às ${horaValida ?? "—"}, há mais de 3 minutos.`,
      };
    case "finalizada":
      return { tipo: "sucesso", titulo: "Totalização encerrada", texto: "O TSE indica que a totalização desta seleção foi concluída." };
    case "ok":
      if (r.resposta?.resultado?.totalizacao.secoesTotalizadas === 0) {
        return {
          tipo: "info",
          titulo: "Apuração ainda não começou",
          texto:
            "O TSE já publicou o arquivo desta seleção, mas nenhuma seção foi totalizada. Os votos aparecem aqui conforme o TSE divulga, após o encerramento da votação.",
        };
      }
      return null;
  }
}

function textoCompartilhar(cargoNome: string, abrangencia: string, resposta: RespostaApi | null): string {
  const base = `${ELEICAO_CONFIG.descricao} · ${cargoNome} · ${abrangencia}`;
  const t = resposta?.resultado?.totalizacao;
  if (!t) return `${base}. Resultados oficiais do TSE no Acompanhe Votos.`;
  const pct =
    typeof t.percentualSecoesTotalizadas === "number"
      ? `${formatarPercentual(t.percentualSecoesTotalizadas)} das seções totalizadas`
      : "seções totalizadas não informadas";
  const hora = t.atualizadoEmFonte ? ` (TSE, ${formatarHora(t.atualizadoEmFonte)})` : "";
  const fim = t.finalizada ? " Totalização encerrada." : "";
  return `${base}: ${pct}${hora}.${fim} Fonte: TSE.`;
}

export function Painel() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { opcoes } = useAbrangencias();

  const cargo = cargoDaUrl(params.get("cargo"));
  const uf = ufDaUrl(cargo, params.get("uf"), opcoes);
  const cargoNome = CARGOS[cargo].nome;
  const abrangencia = nomeAbrangencia(uf);

  const r = useResultados(cargo, uf);
  const estado = definirEstado(r);
  const aviso = avisoDoEstado(estado, r, cargoNome, abrangencia);
  const resultado = r.ultimaValida?.resultado ?? null;
  const exibirDados = resultado !== null && estado !== "sem-dados" && estado !== "nao-suportado";

  const candidatos = useMemo<CandidatoResultado[]>(
    () => (resultado ? ordenarPorVotos(resultado.candidatos) : []),
    [resultado],
  );

  const navegar = useCallback(
    (novoCargo: CargoId, novaUf: string) => {
      const q = new URLSearchParams({ cargo: novoCargo, uf: novaUf });
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [router, pathname],
  );

  const trocarCargo = (novo: CargoId) => {
    if (novo === cargo) return;
    if (novo === "presidente") navegar("presidente", "br");
    else {
      const lista = opcoes.governador;
      navegar("governador", lista.some((o) => o.uf === uf) ? uf : (lista[0]?.uf ?? "ac"));
    }
  };

  // Opções do select: lista oficial + a UF atual (se veio por link e não consta).
  const opcoesUf = useMemo(() => {
    const lista = opcoes[cargo].map((o) => ({ uf: o.uf, nome: o.nome }));
    if (!lista.some((o) => o.uf === uf)) lista.push({ uf, nome: `${abrangencia} (sem 2º turno informado)` });
    return lista;
  }, [opcoes, cargo, uf, abrangencia]);

  // Aviso temporário (compartilhar/copiar).
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mostrarToast = useCallback((texto: string) => {
    setToast(texto);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const compartilhar = async () => {
    const url = `${window.location.origin}${pathname}?${new URLSearchParams({ cargo, uf }).toString()}`;
    const texto = textoCompartilhar(cargoNome, abrangencia, r.ultimaValida);
    const dados = { title: "Acompanhe Votos", text: texto, url };
    if (typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(dados))) {
      try {
        await navigator.share(dados);
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return; // usuário cancelou
      }
    }
    try {
      await navigator.clipboard.writeText(`${texto} ${url}`);
      mostrarToast("Link copiado para a área de transferência.");
    } catch {
      mostrarToast(`Não foi possível copiar. Copie este link: ${url}`);
    }
  };

  const mostrarPlacar = exibirDados && candidatos.length === 2;

  return (
    <>
      <main id="conteudo" className="conteudo">
      <div className="controles" role="group" aria-label="Seleção de cargo e abrangência">
        <div className="segmentado" role="group" aria-label="Cargo" data-testid="seletor-cargo">
          {LISTA_CARGOS.map((id) => (
            <button
              key={id}
              type="button"
              className="segmentado__opcao"
              aria-pressed={cargo === id}
              data-cargo={id}
              onClick={() => trocarCargo(id)}
            >
              {CARGOS[id].nome}
            </button>
          ))}
        </div>
        <div className="campo">
          <label htmlFor="seletor-uf" className="campo__rotulo">
            {cargo === "presidente" ? "Abrangência" : "Estado"}
          </label>
          <select
            id="seletor-uf"
            className="campo__select"
            data-testid="seletor-uf"
            value={uf}
            onChange={(e) => navegar(cargo, e.target.value)}
          >
            {opcoesUf.map((o) => (
              <option key={o.uf} value={o.uf}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <h2 className="selecao-titulo">
        {cargoNome} · {abrangencia}
      </h2>

      <div
        className="estado"
        data-testid="estado"
        data-estado={estado}
        data-atualizando={r.atualizando ? "true" : "false"}
        data-desatualizado={r.desatualizado ? "true" : "false"}
        aria-live="polite"
        aria-busy={r.atualizando}
      >
        {aviso && (
          <div className={`aviso aviso--${aviso.tipo}`} role={aviso.tipo === "erro" ? "alert" : "status"}>
            <p className="aviso__titulo">{aviso.titulo}</p>
            {aviso.texto && <p className="aviso__texto">{aviso.texto}</p>}
          </div>
        )}
        {r.atualizando && !r.carregando && (
          <p className="atualizando" role="status">
            <span className="atualizando__ponto" aria-hidden="true" /> Atualizando…
          </p>
        )}
        {mostrarPlacar && <Placar candidatos={[candidatos[0], candidatos[1]]} />}
      </div>

      {r.carregando && <Esqueleto />}

      {exibirDados && resultado && (
        <>
          <Totalizacao totalizacao={resultado.totalizacao} votos={resultado.votos} />

          <section className="painel-bloco" aria-labelledby="candidatos-titulo">
            <div className="bloco-cabeca">
              <h2 id="candidatos-titulo" className="bloco-titulo">
                Candidatos
              </h2>
              <p className="bloco-nota">ordenado por votos (empate: ordem alfabética)</p>
            </div>
            {candidatos.length === 0 ? (
              <p className="vazio">A fonte não informou candidatos para esta seleção.</p>
            ) : (
              <div className="grade-cartoes">
                {candidatos.map((c, i) => (
                  <CartaoCandidato key={c.numero} candidato={c} posicao={i + 1} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <p className="consulta" data-testid="consultado-em">
        {r.consultadoEm ? `Consultado às ${formatarHora(r.consultadoEm)}` : "Nenhuma consulta bem-sucedida ainda"}
        <span className="consulta__auto">
          {" "}
          · atualização automática a cada {INTERVALO_SEGUNDOS} s com a página aberta
        </span>
      </p>
      </main>

      <Anuncio />

      <footer className="rodape">
        <p>
          Fonte: Tribunal Superior Eleitoral (TSE) —{" "}
          <a href={resultado?.fonteUrl || "https://resultados.tse.jus.br"} target="_blank" rel="noopener noreferrer">
            resultados.tse.jus.br
          </a>
        </p>
        <p>
          Percentuais marcados como “calculado” são calculados por esta aplicação a partir dos votos informados pelo TSE.
          Este site não é oficial, não faz projeções e só indica eleito quando o TSE informa.
        </p>
        <p className="rodape__credito">Acompanhe Votos · feito por caiqueno</p>
      </footer>

      <nav className="acoes" aria-label="Ações">
        <div className="acoes__interno">
          <button
            type="button"
            className="botao botao--primario"
            data-testid="botao-atualizar"
            onClick={r.atualizar}
            disabled={r.atualizando}
            aria-label={r.atualizando ? "Atualizando" : "Atualizar agora"}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className={`icone${r.atualizando ? " icone--girando" : ""}`}>
              <path
                d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {r.atualizando ? "Atualizando…" : "Atualizar"}
          </button>
          <button type="button" className="botao" data-testid="botao-compartilhar" onClick={compartilhar}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="icone">
              <path
                d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Compartilhar
          </button>
        </div>
      </nav>

      <div className="toast" role="status" aria-live="polite">
        {toast && <p className="toast__texto">{toast}</p>}
      </div>
    </>
  );
}
