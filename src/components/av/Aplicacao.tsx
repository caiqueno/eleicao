"use client";

import { useEffect, useMemo, useState } from "react";
import { UFS, type CargoId } from "@/config/eleicao";
import { useResultados } from "@/hooks/useResultados";
import type { ResultadoSegundoTurno } from "@/lib/tipos";
import type { AreaMapa, RespostaMapa } from "@/lib/tse/mapa";
import type { RespostaPrimeiroTurno } from "@/lib/tse/primeiroTurno";
import { Anuncio, Busca, Cabecalho, LinhaDoTempo } from "./Cabecalho";
import { Chat } from "./Chat";
import { Compartilhar } from "./Compartilhar";
import { FaleConosco } from "./FaleConosco";
import { IconeApp } from "./IconesApps";
import { Boletim, Presenca, ResumoBoletim, textoWhatsapp, viradas } from "./Exclusivos";
import { useAgora, useHash, useHistorico, useJsonPeriodico, usePreferencia, usePresenca } from "./hooks";
import { PainelDetalhe, PainelProjecao, projetar } from "./Laterais";
import { Mapa, type Vista } from "./Mapa";
import { ordenarPorNumero, Placar, PlacarGovernadores } from "./Placar";
import { capitalizar, coresDe, nomeCurto, parcelas, type CandidatoBase } from "./util";

interface Selecao {
  cargo: CargoId;
  uf: string;
  /** Município: código TSE (5 dígitos) ou, vindo de link, código IBGE (7 dígitos) ainda não resolvido. */
  mun: string | null;
}

/** Lê "#presidente-ba-2923902" (como links do tipo cargo-uf-município) ou ?cargo=&uf=. */
export function lerEndereco(hash: string, busca: string): Selecao {
  const h = hash.replace(/^#/, "").toLowerCase();
  const partes = h.split("-");
  const cargo: CargoId = partes[0] === "governador" || partes[0] === "governadores" ? "governador" : "presidente";
  let uf = partes[1] && UFS[partes[1]] ? partes[1] : "br";
  const mun = uf !== "br" && partes[2] && /^\d{5}$|^\d{7}$/.test(partes[2]) ? partes[2] : null;
  if (!h) {
    const q = new URLSearchParams(busca);
    const c = q.get("cargo") === "governador" ? "governador" : "presidente";
    uf = q.get("uf") && UFS[q.get("uf")!] ? q.get("uf")! : "br";
    return { cargo: c, uf, mun: null };
  }
  return { cargo, uf, mun };
}

function hashDe(s: Selecao): string {
  const partes: string[] = [s.cargo];
  if (s.uf !== "br") partes.push(s.uf);
  if (s.uf !== "br" && s.mun) partes.push(s.mun);
  return `#${partes.join("-")}`;
}

/** Converte o resultado completo no formato de área do mapa. */
function areaDoResultado(r: ResultadoSegundoTurno | null | undefined): AreaMapa | null {
  if (!r) return null;
  const t = r.totalizacao;
  return {
    cd: r.abrangencia,
    nome: r.abrangenciaNome,
    ibge: null,
    secoesTotal: t.secoesTotal,
    secoesTotalizadas: t.secoesTotalizadas,
    percentualSecoes: t.percentualSecoesTotalizadas,
    eleitorado: r.votos.eleitorado,
    eleitoradoFaltando: r.votos.eleitoradoFaltando,
    votos: (t.secoesTotalizadas ?? 0) > 0 ? Object.fromEntries(r.candidatos.map((c) => [c.numero, c.votos ?? 0])) : null,
    validos: r.votos.validos,
    atualizadoEmFonte: t.atualizadoEmFonte,
    finalizada: t.finalizada,
  };
}

export function Aplicacao() {
  const [endereco, definirHash] = useHash();
  const sel = useMemo(() => {
    const [h, q] = endereco.split("|");
    return lerEndereco(h ?? "", q ?? "");
  }, [endereco]);
  const [busca, setBusca] = useState(false);
  const [temaSalvo, definirTema] = usePreferencia("av:tema", "escuro");
  const tema = temaSalvo === "claro" ? "claro" : "escuro";
  const aviso = null;
  const agora = useAgora();
  const pessoas = usePresenca();

  useEffect(() => {
    document.documentElement.dataset.theme = tema === "claro" ? "light" : "dark";
  }, [tema]);

  const { cargo, uf, mun } = sel;
  const vista: Vista = uf === "br" ? "br" : uf === "zz" ? "zz" : "uf";
  const ufTopo = cargo === "presidente" ? "br" : uf === "br" ? "br" : uf;

  const res = useResultados(cargo, ufTopo);
  const resultado = res.ultimaValida?.resultado ?? null;
  const mapaBr = useJsonPeriodico<RespostaMapa>(`/api/mapa?cargo=${cargo}&uf=br`, 60);
  const mapaUf = useJsonPeriodico<RespostaMapa>(uf !== "br" ? `/api/mapa?cargo=${cargo}&uf=${uf}` : null, 60);
  const ptTopo = useJsonPeriodico<RespostaPrimeiroTurno>(
    cargo === "presidente" || uf !== "br" ? `/api/primeiro-turno?cargo=${cargo}&uf=${cargo === "presidente" ? "br" : uf}` : null,
    3600,
  );

  const areasUf = useMemo(() => mapaUf.dados?.areas ?? [], [mapaUf.dados]);
  // Link com código IBGE (7 dígitos): corresponde ao município do TSE quando a lista chega.
  const areaMun = mun ? (areasUf.find((a) => (mun.length === 7 ? a.ibge === mun : a.cd === mun)) ?? null) : null;
  const munTse = areaMun?.cd ?? (mun && mun.length === 5 ? mun : null);
  const ptMun = useJsonPeriodico<RespostaPrimeiroTurno>(
    munTse && uf !== "br" ? `/api/primeiro-turno?cargo=${cargo}&uf=${uf}&mun=${munTse}` : null,
    3600,
  );

  const candidatos: CandidatoBase[] = useMemo(
    () => (resultado ? ordenarPorNumero(resultado.candidatos).map((c) => ({ numero: c.numero, nome: c.nome, partido: c.partido, sqcand: c.sqcand })) : []),
    [resultado],
  );
  const cores = coresDe(candidatos);
  const numeros = candidatos.map((c) => c.numero);
  const chaveNumeros = numeros.join();
  const apurando = (resultado?.totalizacao.secoesTotalizadas ?? 0) > 0;

  const projecao = useMemo(
    () => (cargo === "presidente" && apurando && mapaBr.dados && ptTopo.dados ? projetar(mapaBr.dados.areas, ptTopo.dados.areas, numeros) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cargo, apurando, mapaBr.dados, ptTopo.dados, chaveNumeros],
  );

  const parcelaTopo = resultado && apurando ? parcelas(areaDoResultado(resultado)?.votos, numeros) : null;
  const historico = useHistorico(
    `${cargo}:${ufTopo}`,
    resultado?.totalizacao.percentualSecoesTotalizadas ?? null,
    parcelaTopo?.[0] ?? null,
    projecao?.a ?? null,
  );

  const ptAreaTopo = ptTopo.dados?.areas.find((a) => a.cd === (cargo === "presidente" ? "br" : uf)) ?? null;
  const mudancas = useMemo(() => {
    const pt = ptTopo.dados?.areas ?? [];
    const base = cargo === "presidente" ? (mapaBr.dados?.areas ?? []) : (areaDoResultado(resultado) ? [areaDoResultado(resultado)!] : []);
    return base
      .flatMap((a) => {
        const agoraP = (a.secoesTotalizadas ?? 0) > 0 ? parcelas(a.votos, numeros) : null;
        const antes = parcelas(pt.find((x) => x.cd === a.cd)?.votos, numeros);
        return agoraP && antes ? [{ cd: a.cd, nome: UFS[a.cd] ?? a.nome, delta: agoraP[0] - antes[0] }] : [];
      })
      .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ptTopo.dados, mapaBr.dados, resultado, cargo, chaveNumeros]);

  // --- navegação ------------------------------------------------------------
  const irPara = (s: Partial<Selecao>) => {
    const novo = { ...sel, ...s };
    // Município aparece no endereço pelo código IBGE quando existe (links compartilháveis).
    const ibge = novo.mun ? areasUf.find((a) => a.cd === novo.mun)?.ibge : null;
    definirHash(hashDe({ ...novo, mun: ibge ?? novo.mun }));
  };
  const escolherNoMapa = (cd: string) => {
    if (vista === "br") irPara({ uf: cd, mun: null });
    else irPara({ mun: cd === mun ? null : cd });
  };
  const ufsGov = cargo === "governador" ? (mapaBr.dados?.areas.map((a) => a.cd) ?? []) : undefined;

  const [compartilhando, setCompartilhando] = useState(false);
  const compartilhar = () => setCompartilhando(true);

  // --- painel da direita ----------------------------------------------------
  const mapaAtual = vista === "br" ? mapaBr : mapaUf;
  let detalhe: Parameters<typeof PainelDetalhe>[0];
  const comum = {
    cargo,
    uf,
    candidatos,
    cores,
    pendentes: mapaAtual.dados?.pendentes ?? 0,
    aoEscolher: escolherNoMapa,
    consultadoEm: mapaAtual.dados?.consultadoEm ?? res.consultadoEm,
    erro: mapaAtual.erro ?? mapaAtual.dados?.mensagem ?? null,
  };
  if (vista === "br") {
    detalhe = {
      ...comum,
      titulo: cargo === "presidente" ? "Brasil" : "Governadores",
      subtitulo: cargo === "governador" ? `${mapaBr.dados?.areas.length ?? "—"} estados com 2º turno` : undefined,
      sigla: "BR",
      area: cargo === "presidente" ? areaDoResultado(resultado) : null,
      filhas: mapaBr.dados?.areas ?? [],
      tipoFilhas: "estado",
      primeiroTurno: cargo === "presidente" ? ptAreaTopo : null,
      aoFechar: null,
    };
  } else if (areaMun) {
    detalhe = {
      ...comum,
      titulo: `${capitalizar(areaMun.nome)}${uf === "zz" ? "" : ` · ${uf.toUpperCase()}`}`,
      sigla: capitalizar(areaMun.nome).slice(0, 2).toUpperCase(),
      area: areaMun,
      filhas: [],
      tipoFilhas: null,
      primeiroTurno: ptMun.dados?.areas[0] ?? null,
      aoFechar: () => irPara({ mun: null }),
    };
  } else {
    const areaUf = cargo === "presidente" ? (mapaBr.dados?.areas.find((a) => a.cd === uf) ?? null) : areaDoResultado(resultado);
    detalhe = {
      ...comum,
      titulo: UFS[uf],
      sigla: uf.toUpperCase(),
      area: areaUf,
      filhas: areasUf,
      tipoFilhas: uf === "zz" ? "exterior" : "municipio",
      primeiroTurno: cargo === "presidente" ? (ptTopo.dados?.areas.find((a) => a.cd === uf) ?? null) : ptAreaTopo,
      aoFechar: () => irPara({ uf: "br", mun: null }),
    };
  }

  const areasMapa = vista === "br" ? (mapaBr.dados?.areas ?? null) : (mapaUf.dados?.areas ?? null);
  const comVotos = (areasMapa ?? []).filter((a) => (a.secoesTotalizadas ?? 0) > 0).length;
  const nomeFilhas = vista === "br" ? "estados" : vista === "zz" ? "cidades" : "municípios";
  const coresPorArea = useMemo(() => {
    if (cargo !== "governador" || vista !== "br") return undefined;
    return Object.fromEntries((mapaBr.dados?.areas ?? []).map((a) => [a.cd, coresDe(ordenarPorNumero(a.candidatos ?? []))]));
  }, [cargo, vista, mapaBr.dados]);
  const govBr = cargo === "governador" && uf === "br";
  const listaViradas = useMemo(
    () => (cargo === "presidente" && vista === "br" && mapaBr.dados && ptTopo.dados ? viradas(mapaBr.dados.areas, ptTopo.dados.areas, numeros) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cargo, vista, mapaBr.dados, ptTopo.dados, chaveNumeros],
  );
  const mandarWhatsapp = () => {
    const texto = textoWhatsapp(resultado, Date.now(), window.location.href);
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="app">
      <Cabecalho
        cargo={cargo}
        aoCargo={(c) => irPara({ cargo: c, uf: c === "governador" ? "br" : uf === "zz" ? "zz" : "br", mun: null })}
        aoExterior={() => irPara(uf === "zz" ? { uf: "br", mun: null } : { uf: "zz", mun: null })}
        exteriorAtivo={uf === "zz"}
        aoBuscar={() => setBusca(true)}
        tema={tema}
        aoTema={() => definirTema(tema === "escuro" ? "claro" : "escuro")}
        aoCompartilhar={compartilhar}
        aviso={aviso}
        presenca={<Presenca agora={pessoas.agora} hoje={pessoas.hoje} />}
      />
      <div className="faixa-anuncio">
        <Anuncio compacto />
      </div>
      <main id="conteudo" className="corpo">
        <div className="area-placar">
          {govBr ? (
            <PlacarGovernadores areas={mapaBr.dados?.areas ?? []} aoEscolher={(u) => irPara({ uf: u, mun: null })} agora={agora} />
          ) : (
            <>
              <Placar cargo={cargo} uf={ufTopo} resultado={resultado} agora={agora} carregando={res.carregando} />
              <ResumoBoletim resultado={resultado} candidatos={candidatos} cores={cores} areas={areasMapa ?? []} nomeAreas={nomeFilhas} />
              {/* No celular, as duas ações da noite ficam logo abaixo do placar. */}
              <div className="acoes-placar">
                <button type="button" className="acoes-placar__whats" onClick={mandarWhatsapp} data-testid="whatsapp-placar">
                  <IconeApp app="whatsapp" tam={20} /> Mandar no WhatsApp
                </button>
                <button type="button" className="acoes-placar__busca" onClick={() => setBusca(true)} data-testid="busca-placar">
                  <span aria-hidden="true">⌕</span> Veja sua cidade ou estado
                </button>
              </div>
            </>
          )}
          {res.desatualizado && <p className="alerta">Dados podem estar desatualizados: sem resposta nova do TSE há alguns minutos.</p>}
        </div>

        <section className="centro" aria-label="Mapa">
          <nav className="trilha" aria-label="Você está em">
            <button type="button" onClick={() => irPara({ uf: "br", mun: null })} disabled={vista === "br"}>
              Brasil
            </button>
            {uf !== "br" && (
              <>
                <span aria-hidden="true">›</span>
                <button type="button" onClick={() => irPara({ mun: null })} disabled={!mun}>
                  {UFS[uf]}
                </button>
              </>
            )}
            {areaMun && (
              <>
                <span aria-hidden="true">›</span>
                <b>{capitalizar(areaMun.nome)}</b>
              </>
            )}
          </nav>
          <Mapa
            vista={vista}
            uf={uf}
            areas={areasMapa}
            candidatos={candidatos}
            cores={cores}
            selecionado={vista === "br" ? null : (munTse ?? null)}
            aoSelecionar={escolherNoMapa}
            ufsAtivas={ufsGov}
            coresPorArea={coresPorArea}
          />
          <div className="legenda">
            <span>
              <span className="ponto ponto--cheio" /> com votos <b>{comVotos}</b>
            </span>
            <span>
              <span className="ponto" /> aguardando <b>{Math.max(0, (areasMapa?.length ?? 0) - comVotos)}</b> {nomeFilhas}
            </span>
            {!govBr &&
              candidatos.map((c, i) => (
                <span key={c.numero}>
                  <i className="legenda__cor" style={{ background: cores[i] }} /> {nomeCurto(c.nome)}
                </span>
              ))}
            {comVotos > 0 && <span className="legenda__nota">cor mais forte = vantagem maior</span>}
          </div>
          <LinhaDoTempo agora={agora} apurando={apurando} historico={historico} />
        </section>

        <PainelDetalhe key={`${cargo}:${uf}:${munTse ?? ""}`} {...detalhe} repeteOPlacar={!areaMun && !govBr} />

        {govBr ? null : (
          <PainelProjecao
            cargo={cargo}
            uf={ufTopo}
            candidatos={candidatos}
            cores={cores}
            apurando={apurando}
            projecao={projecao}
            historico={historico}
            agora={agora}
            mudancas={mudancas}
            primeiroTurno={parcelas(ptAreaTopo?.votos, numeros)}
            atual={parcelaTopo}
            topo={
              <Boletim
                resultado={resultado}
                candidatos={candidatos}
                cores={cores}
                areas={areasMapa ?? []}
                nomeAreas={nomeFilhas}
                viradas={listaViradas}
                agora={agora}
                aoWhatsapp={mandarWhatsapp}
              />
            }
          />
        )}
      </main>
      <footer className="rodape">
        <span>
          <b>acompanhevotos</b> · feito por caiqueno
        </span>
        <span>
          Dados oficiais do{" "}
          <a href="https://resultados.tse.jus.br/oficial/app/index.html" target="_blank" rel="noopener noreferrer">
            TSE
          </a>{" "}
          · mapas IBGE e Natural Earth · confira sempre no TSE
        </span>
      </footer>
      <FaleConosco />
      <Chat online={pessoas.agora} />
      <Compartilhar aberta={compartilhando} aoFechar={() => setCompartilhando(false)} resultado={resultado} />
      <Busca
        aberta={busca}
        aoFechar={() => setBusca(false)}
        aoEscolher={(u, cd) => {
          setBusca(false);
          const ok = cargo === "presidente" || (ufsGov ?? []).includes(u);
          irPara({ cargo: ok ? cargo : "presidente", uf: u, mun: cd });
        }}
      />
    </div>
  );
}
