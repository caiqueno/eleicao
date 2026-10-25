"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { CargoId } from "@/config/eleicao";
import type { EstadoConsulta, RespostaApi } from "@/lib/tipos";

/** Intervalo normal entre consultas (s). */
export const INTERVALO_SEGUNDOS = 60;
/** Teto do backoff em caso de erro (s). */
export const INTERVALO_MAXIMO_SEGUNDOS = 300;
/** Depois deste tempo sem consulta bem-sucedida, os dados são "desatualizados". */
export const LIMITE_DESATUALIZADO_MS = 3 * 60 * 1000;
const TEMPO_LIMITE_REQUISICAO_MS = 20_000;
const INTERVALO_RELOGIO_MS = 15_000;

export interface SnapshotResultados {
  chave: string;
  /** Última resposta recebida da API (qualquer estado). */
  resposta: RespostaApi | null;
  /** Última resposta com estado "ok" e resultado presente. */
  ultimaValida: RespostaApi | null;
  /** Instante (relógio do navegador) da última consulta bem-sucedida. */
  ultimaConsultaOkMs: number | null;
  /** Horário (ISO) informado pelo servidor na última consulta bem-sucedida. */
  consultadoEm: string | null;
  /** Ainda não houve nenhuma resposta para esta seleção. */
  carregando: boolean;
  /** Há uma requisição em andamento. */
  atualizando: boolean;
  /** Falha de rede ou resposta ilegível (sem RespostaApi). */
  erroRede: string | null;
  /** Estado da última tentativa (inclui falhas de rede como "erro-fonte"). */
  estadoUltimaTentativa: EstadoConsulta | null;
  falhasConsecutivas: number;
  /** Segundos até a próxima consulta automática agendada. */
  proximaEmSegundos: number;
  desatualizado: boolean;
}

function snapshotInicial(chave: string): SnapshotResultados {
  return {
    chave,
    resposta: null,
    ultimaValida: null,
    ultimaConsultaOkMs: null,
    consultadoEm: null,
    carregando: true,
    atualizando: false,
    erroRede: null,
    estadoUltimaTentativa: null,
    falhasConsecutivas: 0,
    proximaEmSegundos: INTERVALO_SEGUNDOS,
    desatualizado: false,
  };
}

const SNAPSHOT_SERVIDOR = snapshotInicial("");

export function intervaloComBackoff(falhas: number): number {
  if (falhas <= 0) return INTERVALO_SEGUNDOS;
  return Math.min(INTERVALO_SEGUNDOS * 2 ** falhas, INTERVALO_MAXIMO_SEGUNDOS);
}

function ehRespostaApi(valor: unknown): valor is RespostaApi {
  if (!valor || typeof valor !== "object") return false;
  const v = valor as Record<string, unknown>;
  return typeof v.estado === "string" && typeof v.consultadoEm === "string" && "resultado" in v;
}

/**
 * Controla consultas a /api/resultados fora do React: agenda, pausa com a
 * aba oculta, evita requisições duplicadas e aplica backoff em erros.
 */
class MonitorResultados {
  private snapshot: SnapshotResultados = SNAPSHOT_SERVIDOR;
  private ouvintes = new Set<() => void>();
  private cargo: CargoId = "presidente";
  private uf = "br";
  private ativo = false;
  private emVoo: AbortController | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private relogio: ReturnType<typeof setInterval> | null = null;
  private pendente = false;
  private ultimaTentativaMs = 0;

  subscribe = (ouvinte: () => void) => {
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  };

  getSnapshot = () => this.snapshot;

  private atualizarSnapshot(parcial: Partial<SnapshotResultados>) {
    this.snapshot = { ...this.snapshot, ...parcial };
    this.ouvintes.forEach((o) => o());
  }

  iniciar(cargo: CargoId, uf: string) {
    this.parar();
    this.cargo = cargo;
    this.uf = uf;
    this.ativo = true;
    this.pendente = false;
    this.atualizarSnapshot(snapshotInicial(`${cargo}:${uf}`));
    document.addEventListener("visibilitychange", this.aoMudarVisibilidade);
    this.relogio = setInterval(this.verificarDesatualizado, INTERVALO_RELOGIO_MS);
    void this.consultar(true);
  }

  parar() {
    this.ativo = false;
    this.emVoo?.abort();
    this.emVoo = null;
    if (this.temporizador) clearTimeout(this.temporizador);
    if (this.relogio) clearInterval(this.relogio);
    this.temporizador = null;
    this.relogio = null;
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.aoMudarVisibilidade);
    }
  }

  /** Atualização manual (botão). Ignorada se já houver requisição em voo. */
  atualizarAgora = () => {
    if (!this.ativo || this.emVoo) return;
    void this.consultar(true);
  };

  private verificarDesatualizado = () => {
    const { ultimaConsultaOkMs, desatualizado } = this.snapshot;
    const agora = Date.now();
    const novo = ultimaConsultaOkMs !== null && agora - ultimaConsultaOkMs > LIMITE_DESATUALIZADO_MS;
    if (novo !== desatualizado) this.atualizarSnapshot({ desatualizado: novo });
  };

  private aoMudarVisibilidade = () => {
    if (document.visibilityState !== "visible" || !this.ativo) return;
    this.verificarDesatualizado();
    const intervaloMs = intervaloComBackoff(this.snapshot.falhasConsecutivas) * 1000;
    if (this.pendente || Date.now() - this.ultimaTentativaMs >= intervaloMs) {
      this.pendente = false;
      if (!this.emVoo) void this.consultar(true);
    }
  };

  private agendar() {
    if (!this.ativo) return;
    if (this.temporizador) clearTimeout(this.temporizador);
    const segundos = intervaloComBackoff(this.snapshot.falhasConsecutivas);
    this.atualizarSnapshot({ proximaEmSegundos: segundos });
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      if (document.visibilityState === "hidden") {
        // Aba oculta: não consulta; ao voltar, aoMudarVisibilidade retoma.
        this.pendente = true;
        return;
      }
      void this.consultar(false);
    }, segundos * 1000);
  }

  private async consultar(forcar: boolean) {
    if (!this.ativo || this.emVoo) return;
    if (!forcar && document.visibilityState === "hidden") {
      this.pendente = true;
      return;
    }
    if (this.temporizador) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }

    const controle = new AbortController();
    this.emVoo = controle;
    this.ultimaTentativaMs = Date.now();
    const limite = setTimeout(() => controle.abort(), TEMPO_LIMITE_REQUISICAO_MS);
    this.atualizarSnapshot({ atualizando: true });

    const parametros = new URLSearchParams({ cargo: this.cargo, uf: this.uf });
    let resposta: RespostaApi | null = null;
    let erroRede: string | null = null;
    /** Idade dos dados ao sair do servidor: hora da resposta − hora do download no TSE. */
    let idadeServidorMs = 0;

    try {
      const r = await fetch(`/api/resultados?${parametros.toString()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controle.signal,
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (ehRespostaApi(corpo)) {
        resposta = corpo;
        const horaResposta = Date.parse(r.headers.get("date") ?? "");
        const horaDownload = Date.parse(corpo.consultadoEm);
        if (Number.isFinite(horaResposta) && Number.isFinite(horaDownload)) {
          idadeServidorMs = Math.max(0, horaResposta - horaDownload);
        }
      } else {
        erroRede = `Resposta inesperada do servidor (HTTP ${r.status}).`;
      }
    } catch {
      if (!this.ativo || this.emVoo !== controle) return;
      erroRede = controle.signal.aborted
        ? "A consulta demorou demais e foi cancelada."
        : "Sem conexão com o servidor. Verifique sua internet.";
    } finally {
      clearTimeout(limite);
    }

    // Seleção trocada ou monitor parado durante a requisição: descarta.
    if (!this.ativo || this.emVoo !== controle) return;
    this.emVoo = null;

    const anteriorValida = this.snapshot.ultimaValida;
    // Depois de já haver resultado, um "sem dados" é tratado como falha passageira da fonte
    // (arquivo sendo regravado, CDN): mantém os dados na tela com aviso.
    if (resposta && resposta.estado === "sem-dados" && anteriorValida) {
      resposta = {
        ...resposta,
        estado: "erro-fonte",
        mensagem: "O TSE deixou de responder o arquivo desta seleção temporariamente.",
      };
    }
    const estado: EstadoConsulta = resposta ? resposta.estado : "erro-fonte";
    const sucesso = resposta !== null && (estado === "ok" || estado === "sem-dados" || estado === "nao-suportado");
    const anterior = this.snapshot;
    const okComResultado = resposta !== null && estado === "ok" && resposta.resultado !== null;

    this.atualizarSnapshot({
      resposta: resposta ?? anterior.resposta,
      ultimaValida: okComResultado
        ? resposta
        : sucesso
          ? null // o TSE informou que não há dados para esta seleção
          : anterior.ultimaValida,
      ultimaConsultaOkMs: sucesso ? Date.now() - idadeServidorMs : anterior.ultimaConsultaOkMs,
      consultadoEm: sucesso && resposta ? resposta.consultadoEm : anterior.consultadoEm,
      carregando: false,
      atualizando: false,
      erroRede,
      estadoUltimaTentativa: estado,
      falhasConsecutivas: sucesso ? 0 : anterior.falhasConsecutivas + 1,
    });
    this.verificarDesatualizado();
    this.agendar();
  }
}

export interface UseResultados extends SnapshotResultados {
  atualizar: () => void;
}

/** Busca e atualiza automaticamente os resultados da seleção cargo/UF. */
export function useResultados(cargo: CargoId, uf: string): UseResultados {
  const [monitor] = useState(() => new MonitorResultados());

  useEffect(() => {
    monitor.iniciar(cargo, uf);
    return () => monitor.parar();
  }, [monitor, cargo, uf]);

  const snapshot = useSyncExternalStore(monitor.subscribe, monitor.getSnapshot, () => SNAPSHOT_SERVIDOR);
  const atualizar = useCallback(() => monitor.atualizarAgora(), [monitor]);
  const chave = `${cargo}:${uf}`;

  // Enquanto o efeito da nova seleção não roda, não exibe dados da anterior.
  if (snapshot.chave !== chave) return { ...snapshotInicial(chave), atualizar };
  return { ...snapshot, atualizar };
}
