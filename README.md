# Acompanhe Votos

Aplicação web para acompanhar o **2º turno das Eleições Gerais 2026** (25/10/2026) com dados oficiais do
Tribunal Superior Eleitoral (TSE). Mostra Presidente (Brasil e por UF) e Governador nas UFs que têm 2º turno
segundo o próprio TSE. Feita primeiro para o celular.

> Projeto independente, sem vínculo com o TSE. Não faz projeções e só indica eleito quando o TSE informa.

## Tecnologias

- Next.js 16 (App Router) + React 19 + TypeScript
- CSS puro (sem framework de CSS), sem fontes ou imagens externas
- Vitest (unitários e integração) e Playwright (ponta a ponta)
- Vercel (hospedagem, funções em `gru1`/São Paulo, Web Analytics sem cookies)

## Pré-requisitos

- Node.js 20 ou superior (testado com 22) e npm

## Instalação e execução local

```bash
npm install
npm run dev          # http://localhost:3000
```

Não há variáveis de ambiente obrigatórias. A aplicação consulta apenas `https://resultados.tse.jus.br`.
O endereço é fixo no código (`src/config/eleicao.ts`) para impedir consultas a destinos arbitrários.

Alguns ambientes (redes corporativas, servidores fora do Brasil, proxies) não alcançam o TSE. Nesse caso a tela
mostra "erro na fonte" em vez de inventar dados.

## Testes e qualidade

```bash
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm test             # Vitest (unitários e integração, sem rede)
npm run build        # build de produção
npm run test:e2e     # Playwright (sobe `next start`; rode `npm run build` antes)
```

Os testes usam **dados simulados** (pasta `tests/fixtures`, candidatos "CANDIDATO SIMULADO"). Eles nunca são
usados pela aplicação. Para rodar os testes E2E contra um endereço publicado:
`E2E_BASE_URL=https://endereco npm run test:e2e`.

## Deploy

O projeto Vercel `www.acompanhevotos` está ligado ao repositório `caiqueno/eleicao`. Cada push na `main` gera um
deploy de produção; PRs geram deploys de pré-visualização. Configuração: framework Next.js, Node 22, funções em
`gru1`. Não há segredos nem variáveis de ambiente.

## Fonte dos dados

- Configuração das eleições: `https://resultados.tse.jus.br/oficial/comum/config/ele-c.json`
- Resultado por abrangência:
  `https://resultados.tse.jus.br/oficial/ele2026/<eleição>/dados/<uf>/<uf>-c<cargo>-e<eleição>-u.jws`
  (com tentativa em `.json` se o `.jws` não existir). Eleição 6258 = Presidente 2º turno; 6260 = Governador
  2º turno; cargo 0001 = Presidente; 0003 = Governador.

Detalhes, grau de confiança e o que foi verificado: [docs/FONTE_TSE.md](docs/FONTE_TSE.md).

## Contagem de acessos

A página carrega o Vercel Web Analytics (sem cookies e sem dados pessoais) só quando roda na Vercel.
Para ver os números: Vercel → projeto `www.acompanhevotos` → aba **Analytics** (clicar em **Enable** uma vez).
Lá aparecem visitantes, visualizações, páginas, países, navegadores e tipo de dispositivo (celular/desktop).

## Pessoas acompanhando agora

O contador do topo conta os navegadores que mandaram um sinal nos últimos 100 segundos (um sinal a cada 45 s com a aba visível). Cada navegador usa um id aleatório; o servidor não grava IP nem dados pessoais. A contagem fica num Redis do Upstash, criado pela Vercel em **Storage → Create Database → Upstash for Redis** e conectado ao projeto. A integração cria `KV_REST_API_URL` e `KV_REST_API_TOKEN` (ou `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`). Sem essas variáveis o contador some da tela, sem número inventado. Só hosts `*.upstash.io` por HTTPS são aceitos.

## Manutenção

- Para outra eleição, atualize `src/config/eleicao.ts` (ciclo, pleito, códigos de eleição e cargo) com valores
  lidos do `ele-c.json` do TSE. A aplicação confere em tempo de execução se a eleição é de 2º turno.
- O formato do arquivo de resultado está em `src/lib/tse/resultado.ts`; os testes com dados simulados ficam em
  `tests/unit/tse/`.

## Documentação

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): arquitetura, fluxo de atualização e componentes
- [docs/FONTE_TSE.md](docs/FONTE_TSE.md): investigação da fonte oficial
- [docs/ANALISE_REFERENCIAS.md](docs/ANALISE_REFERENCIAS.md): engenharia reversa das referências
- [docs/RELATORIO_TESTES.md](docs/RELATORIO_TESTES.md): testes executados e resultados
