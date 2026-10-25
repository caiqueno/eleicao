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
- **Abrangência e cargo conferidos:** `cdabr` é obrigatório e precisa bater com a UF pedida; `ele` e `carg[].cd`, quando
  presentes, precisam bater com a eleição e o cargo. O arquivo precisa ter **exatamente 2 candidatos**.
- **Sem dados inventados:** campo ausente fica `null` e aparece como "—". 404 vira "o TSE ainda não divulgou".
- **Eleito:** só quando o candidato vem com `e = "s"`. **Totalização encerrada:** só com `and = "f"` e 100% das seções.
- **Percentuais:** usa o percentual do TSE (`pvapn`). O calculado (votos ÷ soma dos votos dos candidatos) só aparece,
  rotulado "calculado", quando o TSE não informa.
- **Ordenação:** por votos, decrescente; empate em ordem alfabética do nome (o que acontece antes do início da apuração, com todos em 0 votos).

## Atualização e cache

O cache do servidor fica em `src/lib/tse/cache.ts` (memória da instância da função), e não no Data Cache do Next,
porque é preciso saber a hora real em que cada arquivo foi baixado do TSE.

| Onde | Duração | Motivo |
|---|---|---|
| Servidor, arquivo `-u` | 30 s | Limita as consultas ao TSE por instância, qualquer que seja o número de visitantes |
| Servidor, `ele-c.json` | 300 s | Muda raramente |
| Servidor, 404 | 30 s | O TSE pode bloquear IPs com muitos 404 |
| Servidor, outros erros | 15 s | Não insistir numa fonte instável |
| Servidor, após HTTP 403/429 | pausa de 10 min em todas as consultas | Tentar durante o bloqueio o renova (regra do TSE) |
| Servidor, requisições simultâneas | deduplicadas por URL | Picos de acesso viram uma consulta |
| CDN da Vercel (`/api/resultados`) | 15 s + 15 s stale | Absorve picos; só aceita `cargo` e `uf` em minúsculas, outros parâmetros dão 400 |
| Navegador | a cada 60 s com a aba visível; recuo 60→120→240→300 s em erro | Evita requisições excessivas |

Nenhum dado vencido é servido como novo: o campo `consultadoEm` da API é a **hora real do download no TSE**, e é
essa hora que a tela mostra como "Consultado no TSE às …". Se o TSE falhar depois do vencimento do cache, a API
responde `erro-fonte`; a tela mantém a última informação válida com aviso. A tela também mostra o horário da
totalização informado pelo próprio TSE (`dt`/`ht`), com data e "horário de Brasília". O app nunca diz "tempo real".
Depois de 3 minutos sem dado novo (descontada a idade do dado no servidor), a tela marca "desatualizado".
Se o TSE deixar de responder um arquivo que já tinha dados (404 passageiro), a tela mantém os dados com aviso.

Observação: com várias instâncias da função, cada uma tem seu cache. O limite efetivo é de ~2 consultas por minuto
por arquivo **por instância**; a CDN de 15 s reduz bastante o número de instâncias acionadas.

## Segurança

- Sem segredos, banco de dados ou autenticação. Nenhuma variável de ambiente obrigatória.
- `cargo` e `uf` são validados contra listas fechadas; o caminho é montado no servidor com segmentos `[a-z0-9._-]`,
  e host e protocolo são verificados antes de cada requisição (sem SSRF).
- Cabeçalhos: Content-Security-Policy (só mesma origem), `Permissions-Policy`, HSTS, `X-Content-Type-Options`,
  `Referrer-Policy`, `X-Frame-Options`; `poweredByHeader` desligado. Arquivos do TSE acima de 5 MB são recusados.
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
