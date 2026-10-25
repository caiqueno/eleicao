"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

export interface EstadoJson<T> {
  dados: T | null;
  erro: string | null;
  carregando: boolean;
  /** Hora (relógio local) da última resposta bem-sucedida. */
  okEm: number | null;
}

/**
 * Busca um JSON da própria API e repete a cada `intervaloS` segundos com a aba visível.
 * Em erro, mantém o último dado válido e espaça as tentativas (até 5 min).
 */
export function useJsonPeriodico<T>(url: string | null, intervaloS = 60): EstadoJson<T> & { atualizar: () => void } {
  const [estado, setEstado] = useState<EstadoJson<T> & { url: string | null }>({
    url,
    dados: null,
    erro: null,
    carregando: url !== null,
    okEm: null,
  });
  const [gatilho, setGatilho] = useState(0);
  const falhas = useRef(0);

  if (estado.url !== url) setEstado({ url, dados: null, erro: null, carregando: url !== null, okEm: null });

  useEffect(() => {
    if (!url) return;
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controle: AbortController | null = null;

    const buscar = async () => {
      if (document.visibilityState === "hidden") {
        agendar();
        return;
      }
      controle = new AbortController();
      const limite = setTimeout(() => controle?.abort(), 25_000);
      try {
        const r = await fetch(url, { cache: "no-store", signal: controle.signal });
        const corpo = (await r.json()) as T & { erro?: string };
        if (!vivo) return;
        if (!r.ok && !(corpo && typeof corpo === "object" && "estado" in corpo)) throw new Error(corpo?.erro ?? `HTTP ${r.status}`);
        falhas.current = r.ok ? 0 : falhas.current + 1;
        setEstado((e) => ({
          ...e,
          dados: r.ok || !e.dados ? corpo : e.dados,
          erro: r.ok ? null : "O TSE não respondeu agora; mostrando a última informação válida.",
          carregando: false,
          okEm: r.ok ? Date.now() : e.okEm,
        }));
      } catch {
        if (!vivo) return;
        falhas.current++;
        setEstado((e) => ({ ...e, erro: "Sem conexão com o servidor. Tentando de novo…", carregando: false }));
      } finally {
        clearTimeout(limite);
      }
      agendar();
    };
    const agendar = () => {
      if (!vivo) return;
      const s = Math.min(intervaloS * 2 ** falhas.current, 300);
      timer = setTimeout(buscar, s * 1000);
    };
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && timer) {
        clearTimeout(timer);
        void buscar();
      }
    };
    document.addEventListener("visibilitychange", aoVoltar);
    void buscar();
    return () => {
      vivo = false;
      controle?.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [url, intervaloS, gatilho]);

  return { ...estado, atualizar: () => setGatilho((g) => g + 1) };
}

/* Relógio compartilhado: 0 no servidor e na hidratação, para não divergir do HTML estático. */
let relogioAtual = 0;
const ouvintesRelogio = new Set<() => void>();
let intervaloRelogio: ReturnType<typeof setInterval> | null = null;

function inscreverRelogio(o: () => void) {
  ouvintesRelogio.add(o);
  if (!intervaloRelogio) {
    relogioAtual = Date.now();
    intervaloRelogio = setInterval(() => {
      relogioAtual = Date.now();
      ouvintesRelogio.forEach((f) => f());
    }, 1000);
    queueMicrotask(() => ouvintesRelogio.forEach((f) => f()));
  }
  return () => {
    ouvintesRelogio.delete(o);
    if (ouvintesRelogio.size === 0 && intervaloRelogio) {
      clearInterval(intervaloRelogio);
      intervaloRelogio = null;
    }
  };
}

/** Hora atual (ms), atualizada a cada segundo; 0 antes da hidratação. */
export function useAgora(): number {
  return useSyncExternalStore(inscreverRelogio, () => relogioAtual, () => 0);
}

export interface PontoHistorico {
  /** Hora local em que o ponto foi observado. */
  t: number;
  /** % de seções totalizadas. */
  pst: number;
  /** Parcela (%) do primeiro candidato (menor número) entre os votos dos dois. */
  a: number;
  /** Projeção (%) do primeiro candidato, quando calculada. */
  p: number | null;
}

/*
 * Pontos da apuração registrados por este navegador (localStorage). O TSE só
 * publica o momento atual; o histórico aqui é o que esta tela observou.
 */
const VAZIO: PontoHistorico[] = [];
const listas = new Map<string, PontoHistorico[]>();
const ouvintes = new Set<() => void>();

function obterLista(chave: string): PontoHistorico[] {
  let l = listas.get(chave);
  if (!l) {
    try {
      const salvo = JSON.parse(localStorage.getItem(`av:hist:${chave}`) ?? "[]") as unknown;
      l = Array.isArray(salvo) ? (salvo as PontoHistorico[]) : [];
    } catch {
      l = [];
    }
    listas.set(chave, l);
  }
  return l;
}

export function registrarPonto(chave: string, ponto: Omit<PontoHistorico, "t">) {
  const lista = obterLista(chave);
  const ultimo = lista[lista.length - 1];
  if (ultimo && ((ultimo.pst === ponto.pst && ultimo.a === ponto.a) || ponto.pst < ultimo.pst)) return;
  const nova = [...lista, { ...ponto, t: Date.now() }].slice(-600);
  listas.set(chave, nova);
  try {
    localStorage.setItem(`av:hist:${chave}`, JSON.stringify(nova));
  } catch {
    /* armazenamento indisponível: segue só em memória */
  }
  ouvintes.forEach((o) => o());
}

const inscrever = (o: () => void) => {
  ouvintes.add(o);
  return () => {
    ouvintes.delete(o);
  };
};

export function useHistorico(chave: string, pst: number | null, a: number | null, p: number | null): PontoHistorico[] {
  const pontos = useSyncExternalStore(inscrever, () => obterLista(chave), () => VAZIO);
  useEffect(() => {
    if (pst !== null && a !== null) registrarPonto(chave, { pst, a, p });
  }, [chave, pst, a, p]);
  return pontos;
}

/* Valor guardado no navegador (tema), sem setState em efeito. */
const ouvintesPref = new Set<() => void>();
export function usePreferencia(nome: string, padrao: string): [string, (v: string) => void] {
  const valor = useSyncExternalStore(
    (o) => {
      ouvintesPref.add(o);
      return () => {
        ouvintesPref.delete(o);
      };
    },
    () => {
      try {
        return localStorage.getItem(nome) ?? padrao;
      } catch {
        return padrao;
      }
    },
    () => padrao,
  );
  const definir = (v: string) => {
    try {
      localStorage.setItem(nome, v);
    } catch {
      /* sem armazenamento */
    }
    ouvintesPref.forEach((o) => o());
  };
  return [valor, definir];
}

/* Endereço (hash) como fonte do estado da seleção. */
const ouvintesHash = new Set<() => void>();
export function useHash(): [string, (h: string) => void] {
  const hash = useSyncExternalStore(
    (o) => {
      ouvintesHash.add(o);
      window.addEventListener("hashchange", o);
      return () => {
        ouvintesHash.delete(o);
        window.removeEventListener("hashchange", o);
      };
    },
    () => window.location.hash + "|" + window.location.search,
    () => "|",
  );
  const definir = (h: string) => {
    if (window.location.hash !== h) window.history.replaceState(null, "", `${window.location.pathname}${h}`);
    ouvintesHash.forEach((o) => o());
  };
  return [hash, definir];
}

/* Pessoas com a página aberta agora: sinal a cada 45 s enquanto a aba está visível. */
function idDoNavegador(): string {
  try {
    const salvo = localStorage.getItem("av:id");
    if (salvo && /^[a-f0-9]{32}$/.test(salvo)) return salvo;
  } catch {
    /* sem armazenamento: id só desta aba */
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  try {
    localStorage.setItem("av:id", id);
  } catch {
    /* idem */
  }
  return id;
}

export interface ContagemPresenca {
  agora: number | null;
  hoje: number | null;
}

const numero = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null);

export function usePresenca(intervaloS = 45): ContagemPresenca {
  const [contagem, setContagem] = useState<ContagemPresenca>({ agora: null, hoje: null });
  useEffect(() => {
    const id = idDoNavegador();
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const enviar = async () => {
      if (timer) clearTimeout(timer);
      if (document.visibilityState === "visible") {
        try {
          const r = await fetch("/api/presenca", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
            cache: "no-store",
          });
          const j = (await r.json()) as { agora?: unknown; hoje?: unknown };
          if (vivo && r.ok) setContagem({ agora: numero(j.agora), hoje: numero(j.hoje) });
        } catch {
          /* sem conexão: mantém o último número */
        }
      }
      if (vivo) timer = setTimeout(enviar, intervaloS * 1000);
    };
    const aoVoltar = () => document.visibilityState === "visible" && void enviar();
    document.addEventListener("visibilitychange", aoVoltar);
    void enviar();
    return () => {
      vivo = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [intervaloS]);
  return contagem;
}
