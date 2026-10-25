# Análise de referências: Acompanhe Votos

> Documento produzido pelo Agente de Engenharia Reversa em 25/10/2026 (dia do 2º turno).
> Escopo: estudar (A) `https://seuimposto.com/#presidente` como referência de interface e experiência e (B) `https://github.com/inematds/rea-engenharia-reversa` como metodologia.
> Convenção usada no documento inteiro (vem da própria referência B):
>
> - **[FATO]**: observado diretamente, com URL ou arquivo como evidência.
> - **[FATO DE TERCEIRO]**: afirmação feita por uma fonte de terceiros que foi lida, mas que não pôde ser conferida na referência original.
> - **[HIPÓTESE]**: dedução ainda sem prova direta.
> - **[DESCONHECIDO]**: fora do alcance desta análise. Vira decisão de projeto.

---

## 1. Metodologia aplicada

### 1.1 O que a referência B é

- **[FATO]** O repositório `inematds/rea-engenharia-reversa` (clonado com `--depth 1`) não traz uma ferramenta própria. É um guia em português sobre o **REA (Reverse Engineer Anything)**, de terceiros (`github.com/morluto/rea`), um servidor MCP/CLI que liga agentes de IA a descompiladores como Ghidra, Hopper e IDA e a um analisador estático de JavaScript/Electron. Evidência: `README.md` ("Este repo só organiza e explica").
- **[FATO]** Conteúdo do repositório: `README*.md` (PT/EN/ES), `guia/index.html` (guia em HTML, com a seção "Método · 5 passos" em `#metodo`), `pratica/RECONSTRUIR.md` (roteiro para reconstruir um app), `pratica/RESULTADOS-6.4.0.md` (resultados de testes), `pratica/rodar-isolado.sh`, `videos/` (legendas `.vtt`, pôsteres) e `.github/workflows/pages.yml`.
- **[FATO]** `pratica/rodar-isolado.sh` foi **lido e não executado**. Ele roda `npx -y rea-agents@<versão>` com HOME e cache do npm isolados, sob `systemd-run` com limite de memória e de tempo. Avaliação: o script baixa e executa um pacote npm de terceiros e serve para analisar binários e `app.asar` locais. Não tem utilidade para um **site** remoto, e executá-lo traria risco sem ganho. Nenhum outro script executável foi encontrado.

### 1.2 Método extraído (guia `#metodo` e `RECONSTRUIR.md`)

1. **Uma função por vez**, nunca "reverta o app inteiro".
2. **Do que o alvo é feito define a ferramenta.** Para "Site", o guia diz textualmente: "Ferramentas do navegador: só o que chega até você".
3. **Resumo primeiro**, depois um módulo, depois uma função.
4. **Classificar cada achado** como *visto*, *inferido* ou *desconhecido*. O desconhecido vira decisão de projeto.
5. **Reconstruir o comportamento com código próprio** e testar contra o original. Não copiar código, ícones, marca nem textos.
6. Separar o que é **local** (interface) do que é **nuvem/servidor**, que não vem junto.
7. Cuidados legais: só analisar o que se tem direito de examinar e não contornar proteções.

### 1.3 O que foi usado e o que não foi

| Item da metodologia | Uso |
|---|---|
| Classificação visto / inferido / desconhecido | **Usado** em todo o documento (FATO / HIPÓTESE / DESCONHECIDO) |
| "Site: só o que chega até você" | **Usado**: só conteúdo público, buscado com WebFetch e WebSearch |
| Uma função por vez | **Usado**: a análise foi dividida em placar, apuração, navegação, dados e estados |
| Separar local de servidor | **Usado** na seção 5 (Fontes de dados) |
| Reconstruir sem copiar | **Usado** como regra nas seções 7 e 9 |
| CLI REA (`analyze-javascript-application`), Ghidra, MCP | **Não usado**: são para binários e apps locais, e não há binário |
| `rodar-isolado.sh` | **Não executado** (lido apenas; motivo em 1.1) |
| Playwright para comparar lado a lado | **Não usado** nesta fase (sem acesso ao original). Recomendado para o nosso próprio app |

---

## 2. Funcionalidades observadas

> **Limitação central:** o WebFetch **não conseguiu ler** `https://seuimposto.com/#presidente`, `https://seuimposto.com/` nem `https://seuimposto.com/robots.txt`. As três tentativas voltaram com o erro `robots_disallowed`, ou seja, o site bloqueia agentes automatizados. Seguindo os limites da tarefa e do método ("não passar escondido pelo balcão"), **não tentei contornar** esse bloqueio com cópias em cache, arquivos da web ou proxies. Por isso, todo o conteúdo sobre a referência A vem de **fontes de terceiros públicas** e está marcado como tal.

Fontes indiretas encontradas por WebSearch:

- **F1**: `https://github.com/joanasampaio07/apuracao-seuimposto`. Repositório público de terceiros cujo `index.html` declara `canonical` e `og:url` = `https://seuimposto.com/` e usa a imagem social `https://seuimposto.com/assets/og.933bb11ba1.jpg`. **[HIPÓTESE]** É uma cópia ou espelho modificado do front-end do seuimposto, com acréscimos próprios (dados do DF, dossiê de candidata). Sem licença declarada.
- **F2**: `https://github.com/Filadelpho/apuracao-2026` e o site `https://apuracao-2026-iota.vercel.app`. Projeto independente que, no README, **credita o seuimposto.com como inspiração** ("painel ... que circulou muito no 1º turno") e declara não ter vínculo com ele nem com o TSE.

Funcionalidades:

- **[FATO DE TERCEIRO]** (F1, `<meta description>`): "A apuração das eleições de 2026 em tempo real: presidente, governadores e Senado, município por município". Título "Apuração 2026", alt da imagem social "Apuração 2026, 1º turno, 4 de outubro".
- **[FATO DE TERCEIRO]** (README de F1): painel geral em `/` e painel presidencial em `#presidente`. Isso combina com a URL de referência e indica **roteamento por hash**.
- **[HIPÓTESE]** A partir dos nomes de classes CSS de F1, que mostram componentes mas não o comportamento:
  - placar de líderes (`.hero`, `.leaders`) com uma frase-resumo (`.sent`) e indicadores numéricos (`.kpis`);
  - barras de votos com **marcador de 50%** (`.bar`, `.dual`, `.fifty`);
  - números em fonte serifada (`.fig`) e percentuais (`.pm`);
  - **mapa** com marcadores, legenda, zoom e trilha de navegação (`.maptop`, `.legend`, `.zoomctl`, `.crumbs`);
  - **linha do tempo da apuração** com replay e botão "voltar ao vivo" (`.tl`, `.tlbar`, `.livept`, `.thumb`, `.golive`);
  - indicador de estado ao vivo com variantes `replay`, `warn` e `wait` (`.live`);
  - feed de eventos, faixa rolante, notificações e cartão de evento (`.feed`, `.ev`, `.ticker`, `.toast`, `.evcard`);
  - busca (`.search`), seletor de candidato (`.candpick`, `.seg2`);
  - bancada/assentos para cargos legislativos (`.seats`, `.seatlegend`, `.hemi`, `.ideo`);
  - gráfico SVG (`.chart`);
  - preocupação com acessibilidade e toque: `prefers-reduced-motion` e `pointer:coarse` em media queries.
- **[FATO DE TERCEIRO]** (F2, inspirado no seuimposto): placar, mapa dos 5.570 municípios, mapa "Mudança vs. 1º turno", tema claro e escuro, layout para desktop e celular, curva "Ao longo da apuração", lista "Últimas atualizações", atalho `Ctrl K` (busca). **Não dá para afirmar quais dessas funções existem no seuimposto.**

## 3. Estrutura da interface

**[HIPÓTESE]** Baseada nas classes CSS de F1. A ordem e o markup reais são **[DESCONHECIDO]**, porque o `<body>` e os scripts não estavam no trecho que o GitHub entregou.

```
.hud (tela cheia)
├── .hudtop: marca · status ao vivo (.live) · alternância (tema/visão)
├── .col.l (coluna esquerda): cards (.card)
│   ├── .hero: líderes (.leaders) + frase-resumo (.sent) + KPIs (.kpis)
│   ├── barras de candidato (.bar/.dual com linha de 50%)
│   └── gráfico de evolução (.chart)
├── área central: mapa (.maptop, .legend, .zoomctl, .crumbs)
├── .col.r (coluna direita): feed de eventos (.feed/.ev), busca
├── linha do tempo (.tlbar/.tl + .golive)
└── rodapé: créditos (.byp) e redes sociais (.soc)
```

Hierarquia visual inferida: **líder e diferença** em destaque, depois os **KPIs de apuração**, depois **mapa e detalhes**. Os números ganham tipografia própria (serifada).

## 4. Fluxos de navegação

- **[FATO DE TERCEIRO]** Rotas por hash: `/` (geral) → `#presidente` (painel presidencial) (README de F1).
- **[HIPÓTESE]** Drill-down geográfico no mapa (Brasil → UF → município) com trilha (`.crumbs`) para voltar.
- **[HIPÓTESE]** Linha do tempo: arrastar o cursor (`.thumb`) faz *replay* da apuração, e `.golive` volta ao estado atual. O status `.live` muda para `replay`.
- **[HIPÓTESE]** Busca por município ou candidato (`.search`; em F2, `Ctrl K`).
- **[DESCONHECIDO]** Se existem rotas separadas por cargo (`#governador`, `#senado`) e como o estado da navegação se reflete na URL.

## 5. Fontes de dados identificadas

| Item | Classificação | Evidência |
|---|---|---|
| Os dados do seuimposto vêm do TSE | **[DESCONHECIDO]** | O site original não pôde ser lido. Nenhuma fonte primária confirma |
| O front-end do seuimposto busca dados **do próprio domínio**, não direto do TSE | **[HIPÓTESE]** forte | Em F1, a CSP do `index.html` com canonical do seuimposto permite só `connect-src 'self' https://cloudflareinsights.com`. O `server.js` de F1 redireciona para a pasta local `feed/` os caminhos `/agora.json`, `/municipios.json`, `/uf/...` e `/deputados/...`, o que sugere que esses são os caminhos que o front-end original pede |
| Um back-end próprio que agrega e reprocessa o feed do TSE | **[HIPÓTESE]** | Decorre da linha anterior. Não verificado |
| Cloudflare Web Analytics no original | **[HIPÓTESE]** | Domínio `cloudflareinsights.com` na CSP de F1 |
| Feed oficial do TSE | **[FATO DE TERCEIRO]** | O `server.js` de F1 (rota `/api/tse/live`, cache de 15 s, eleição padrão `6257`) e o README de F2 usam `resultados.tse.jus.br/oficial/ele2026/`. Segundo F2, em 2026 os arquivos são **JWS (JSON assinado com EdDSA)**. Códigos do cargo de presidente: `6257` (1º turno) e `6258` (2º turno). Padrões de arquivo: `config/mun-e<ele>-cm.jws` (municípios), `dados/<uf>/<uf>-e<ele>-ab.jws` (andamento por município), `dados/<uf>/<uf><mun>-c0001-e<ele>-u.jws` (resultado de presidente) |
| Malha municipal do IBGE | **[FATO DE TERCEIRO]** | F2: `servicodados.ibge.gov.br/api/v3/malhas` |
| Fotos de candidatos do TSE | **[FATO DE TERCEIRO]** | F2 |

**Alerta sobre F1:** a descrição do `server.js` mostra valores **fixos ou fabricados**: o texto "100,00% Apurado" é estático, o campo "apurado" recebe o valor do eleitorado e os votos do candidato 22 são copiados dos votos do candidato 11. **F1 não serve como fonte de dados** e só foi usado como pista da estrutura de interface do original.

## 6. Limitações encontradas

1. **seuimposto.com bloqueado** (`robots_disallowed`) para `/#presidente`, `/` e `/robots.txt`. Não houve contorno. Também não foi possível ver HTML, JS, JSON nem comportamento real.
2. `curl` para esse host já era bloqueado pelo proxy (premissa da tarefa).
3. WebSearch não encontrou nenhuma página que descreva o seuimposto diretamente. Só achou F1 e F2.
4. F1: o GitHub entregou só o `<head>` e o CSS do `index.html` (cerca de 74 mil caracteres). Body e scripts ficaram de fora. A pasta `feed/` também deu `robots_disallowed`. Os repositórios F1 e F2 não estão liberados no conector GitHub desta sessão.
5. F1 é cópia de terceiro sem licença, com dados adulterados. Não há garantia de fidelidade ao original.
6. Nada foi verificado sobre estados de carregamento, erro, responsividade ou intervalo de atualização **do seuimposto**. O que aparece aqui sobre esses pontos é inferido ou vem de F2.
7. As ferramentas REA (Ghidra, analisador de JS) não se aplicam a um site remoto (seção 1.3).

## 7. Comportamentos a reproduzir

Reproduzir o comportamento com código e textos próprios, sem copiar o original.

1. **Placar no topo:** os dois candidatos do 2º turno lado a lado, com nome, número, partido, foto oficial, **votos absolutos e % de votos válidos**, e uma barra única dividida com **marcador de 50%** (o limiar de vitória).
2. **Frase-resumo em linguagem simples:** por exemplo "X lidera por N votos com Y% das seções totalizadas". Só fatos, sem projeção.
3. **KPIs de apuração:** % de seções totalizadas, comparecimento e abstenção, brancos e nulos, e **horário da última totalização do TSE** (o horário do dado, não o do navegador).
4. **Indicador de estado ao vivo** com estados distintos: *aguardando início* (o TSE divulga a partir das 17h de Brasília, conforme F2), *ao vivo*, *dados atrasados/aviso*, *apuração encerrada*.
5. **Recorte geográfico:** Brasil → UF → município, com trilha para voltar e busca por município. O mapa é desejável. A tabela ou lista é o mínimo acessível.
6. **Rota na URL** (hash ou caminho) para cada recorte, de modo que o link compartilhado abra a mesma visão.
7. **Evolução da apuração:** curva da diferença ou do % ao longo das seções totalizadas. Exige gravar o histórico, porque o TSE só expõe o momento atual (F2).
8. **Tema claro e escuro**, `prefers-reduced-motion` e alvos de toque maiores com `pointer:coarse`.
9. **Estados de carregamento e dado indisponível** explícitos ("Carregando…", "Sem dados para este município ainda", "Falha ao atualizar; mostrando dados de HH:MM").
10. **Crédito visível da fonte** ("Fonte: TSE") e aviso de que o projeto é independente.

## 8. Diferenças em relação ao projeto novo

| Aspecto | seuimposto (referência, conforme inferido) | Acompanhe Votos |
|---|---|---|
| Turno | 1º turno (alt "4 de outubro") e possivelmente o 2º | **Só o 2º turno** (25/10/2026) |
| Cargos | Presidente, governadores, Senado, deputados | **Presidente** (e governadores no 2º turno, se o escopo incluir; a decidir) |
| Origem dos dados | **[DESCONHECIDO]**: provavelmente JSON próprio no mesmo domínio | **Somente dados oficiais do TSE** (`resultados.tse.jus.br`), com a origem citada |
| Projeções/estimativas | **[DESCONHECIDO]** | **Nenhuma**: só números totalizados. Nada de "chance de vitória" nem extrapolação |
| Bancadas, ideologia, deputados | Presente, a julgar pelas classes CSS | Fora do escopo |
| Feed de eventos e notificações | Presente, a julgar pelas classes CSS | Opcional, e só com eventos factuais derivados do TSE ("SP chegou a 90% das seções") |
| Comparação com o 1º turno | F2 tem; no seuimposto, desconhecido | Opcional, apresentada como dado oficial do 1º turno e nunca como projeção |

## 9. Decisões técnicas recomendadas para a interface

1. **Camada de dados no servidor ou na borda, nunca o navegador falando direto com o TSE.** Um backend (ou função serverless) busca o feed do TSE, **valida a assinatura JWS**, normaliza e publica JSON próprio com cache curto. É o padrão observado em F1 e F2, e reduz carga, problemas de CORS e falhas.
2. **Guardar os brutos do TSE** sem alteração, para auditoria (F2), e o histórico de totalizações para montar a curva de evolução.
3. **Atualização por polling** com intervalo de 30 a 60 s, `ETag`/`If-None-Match` ou comparação de horário de totalização, *backoff* em caso de erro e pausa quando a aba está oculta (`visibilitychange`). Sem WebSocket na primeira versão.
4. **Nunca exibir dados inventados:** se o campo não veio do TSE, mostrar "indisponível". Isso responde diretamente ao problema visto em F1.
5. **Hora oficial em destaque:** exibir a data e hora da totalização do próprio arquivo do TSE, em horário de Brasília, mais "atualizado há N s".
6. **Percentual sobre votos válidos**, com casas decimais fixas (2) e separadores pt-BR via `Intl.NumberFormat('pt-BR')`. Brancos e nulos vão à parte.
7. **Mobile-first:** placar e KPIs acima da dobra. O mapa vem depois e é opcional, com uma tabela acessível como alternativa. O mapa precisa de gestos que não "prendam" o rolar da página (F2: um dedo rola, dois dedos movem o mapa).
8. **Acessibilidade:** `aria-live="polite"` no placar para anunciar mudanças, contraste AA, cores dos candidatos que não dependam só da cor (rótulo e número junto), e respeito a `prefers-reduced-motion`.
9. **Estado na URL** (`#brasil`, `#uf/sp`, `#mun/<código>`) para compartilhamento e para o botão voltar.
10. **Tema claro e escuro** com tokens CSS (`prefers-color-scheme` mais alternância manual).
11. **Testes com simulador:** gerar apurações fictícias a partir de arquivos reais do TSE para testar estados (aguardando, parcial, encerrado, erro). F2 adota essa abordagem.
12. **Sem rastreamento invasivo** e sem anúncios. Crédito "Fonte: TSE" e aviso "projeto independente, sem vínculo com o TSE" no rodapé.

---

### Fontes consultadas

- `https://seuimposto.com/#presidente`, `https://seuimposto.com/`, `https://seuimposto.com/robots.txt`: bloqueados (`robots_disallowed`)
- `https://github.com/inematds/rea-engenharia-reversa` (clone local: `README.md`, `guia/index.html#metodo`, `pratica/RECONSTRUIR.md`, `pratica/RESULTADOS-6.4.0.md`, `pratica/rodar-isolado.sh`)
- `https://github.com/joanasampaio07/apuracao-seuimposto` (README, `index.html`, `server.js`, via página do GitHub)
- `https://github.com/Filadelpho/apuracao-2026` (README)
- `https://apuracao-2026-iota.vercel.app` (página inicial)
