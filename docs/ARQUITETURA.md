# Arquitetura

## Visão geral

```
Navegador (React)                       Vercel Function (gru1)                    TSE
┌──────────────────────┐  GET /api/..   ┌──────────────────────────┐  HTTPS      ┌───────────────────────────┐
│ Painel + hooks       │ ─────────────▶ │ route.ts → servico.ts    │ ──────────▶ │ comum/config/ele-c.json   │
│ useResultados (60 s) │ ◀───────────── │ http · decodificar ·     │ ◀────────── │ ele2026/<ele>/dados/<uf>/ │
│ useAbrangencias      │  JSON normaliz.│ configuracao · resultado │             │  <uf>-c<cg>-e<ele>-u.jws  │
└──────────────────────┘                └──────────────────────────┘             └───────────────────────────┘
```

A interface só conhece o formato normalizado de `src/lib/tipos.ts`. Os detalhes do TSE ficam em `src/lib/tse/`.

## Camadas

| Camada | Arquivos | Responsabilidade |
|---|---|---|
| Configuração da eleição | `src/config/eleicao.ts` | Ciclo `ele2026`, pleito `3221`, turno 2, eleições 6258/6260, códigos de cargo, UFs |
| Acesso HTTP | `src/lib/tse/http.ts` | URLs só para `https://resultados.tse.jus.br` com segmentos validados; tempo limite; erros tipados |
| Decodificação | `src/lib/tse/decodificar.ts` | Aceita JSON simples e JWS (lê o conteúdo; a assinatura EdDSA não é verificada) |
| Validação | `src/lib/tse/configuracao.ts`, `resultado.ts`, `numeros.ts` | Pleito, turno = 2, cargo, UF, eleição ≠ 1º turno; números e datas; `null` nunca vira 0 |
| Serviço | `src/lib/tse/servico.ts` | Config → resultado; devolve `ok`, `sem-dados`, `nao-suportado`, `erro-fonte` ou `invalido` |
| API | `src/app/api/resultados`, `src/app/api/abrangencias` | Parâmetros validados por lista fechada (400 se inválido); cache HTTP |
| Interface | `src/components/*`, `src/hooks/*`, `src/app/*` | Painel mobile-first, estados, atualização, compartilhamento, PWA, anúncio |

## Garantias de integridade

- **Só 2º turno:** a eleição só é aceita se o `ele-c.json` do TSE disser `t = "2"` dentro do pleito 3221.
  Um arquivo cujo campo `ele` não seja o código do 2º turno é rejeitado.
- **Abrangência e cargo conferidos:** `cdabr` e `carg[].cd` precisam bater com o pedido.
- **Sem dados inventados:** campo ausente fica `null` e aparece como "—". 404 vira "o TSE ainda não divulgou".
- **Eleito:** só quando o candidato vem com `e = "s"`. **Totalização encerrada:** só com `and = "f"` e 100% das seções.
- **Percentuais:** usa o percentual do TSE (`pvapn`). O calculado (votos ÷ soma dos votos dos candidatos) só aparece,
  rotulado "calculado", quando o TSE não informa.
- **Ordenação:** por votos, decrescente; empate pelo número do candidato.

## Atualização e cache

| Onde | Duração | Motivo |
|---|---|---|
| Data Cache do Next (arquivo `-u`) | 30 s | No máximo ~2 consultas por minuto ao TSE por arquivo, qualquer que seja o número de visitantes |
| Data Cache do Next (`ele-c.json`) | 300 s | Muda raramente |
| CDN da Vercel (`/api/resultados`) | 15 s + 15 s stale | Absorve picos |
| Navegador | a cada 60 s com a aba visível; recuo 60→120→240→300 s em erro | Evita requisições excessivas |

Pior caso de defasagem entre o TSE e a tela: cerca de 2 minutos. Por isso a interface mostra **dois horários**,
o da totalização informado pelo TSE (`dt`/`ht`) e o da última consulta bem-sucedida, e nunca diz "tempo real".
Se a consulta falhar, a última informação válida fica na tela com aviso e horário. Depois de 3 minutos sem
consulta bem-sucedida, os dados são marcados como desatualizados.

## Segurança

- Sem segredos, banco de dados ou autenticação. Nenhuma variável de ambiente obrigatória.
- `cargo` e `uf` são validados contra listas fechadas; o caminho é montado no servidor com segmentos `[a-z0-9._-]`,
  e host e protocolo são verificados antes de cada requisição (sem SSRF).
- Cabeçalhos `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`; `poweredByHeader` desligado.
- Link externo do anúncio com `rel="noopener noreferrer"`.

## Mobile-first

Barra de ação fixa (Atualizar e Compartilhar) com alvos de 48 px e `safe-area-inset`; seletores fixos no topo ao
rolar; placar compacto com barra dividida e marca de 50%; Web Share API com fallback para copiar o link; estado na
URL (`?cargo=&uf=`) para compartilhar; PWA instalável (`manifest.webmanifest`, ícone SVG); modo escuro automático;
`prefers-reduced-motion`; sem imagens ou fontes externas; `<select>` nativo com fonte de 16 px (evita zoom no iOS).

## Anúncio

Bloco rotulado "Anúncio", fora da área de resultados, com botão "Clique aqui" e ícone do WhatsApp que abre
`https://wa.me/5511944650268` em nova aba.

## Medição de acesso

Vercel Web Analytics carregado por `<script src="/_vercel/insights/script.js">` somente quando `VERCEL=1`.
Sem cookies e sem dados pessoais. Precisa ser ativado no painel da Vercel (aba Analytics).
