/**
 * Testes de ponta a ponta com respostas SIMULADAS da API interna (ver simulacao.ts).
 * Nenhum dado aqui é resultado real.
 */
import { expect, test, type Page } from "@playwright/test";
import { simularApi } from "./simulacao";

const ANTES = "2026-10-25T11:30:00-03:00";
const DURANTE = "2026-10-25T19:30:00-03:00";

async function abrir(page: Page, hora: string, apurando: boolean, hash = "#presidente") {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  await page.clock.setFixedTime(new Date(hora));
  const chamadas = await simularApi(page, apurando);
  await page.goto(`/${hash}`);
  return { erros, chamadas };
}

test("antes das 17h: contagem regressiva, sem vencedor e sem 'tempo real'", async ({ page }) => {
  const { erros } = await abrir(page, ANTES, false);
  await expect(page.getByTestId("estado")).toContainText("A apuração começa em 5:30:00");
  await expect(page.getByTestId("candidato")).toHaveCount(2);
  await expect(page.getByTestId("selo-eleito")).toHaveCount(0);
  await expect(page.getByText(/tempo real/i)).toHaveCount(0);
  await expect(page.locator(".mapa__area")).toHaveCount(27);
  expect(erros).toEqual([]);
});

test("durante a apuração: percentuais, mapa colorido e horário do TSE", async ({ page }) => {
  const { erros } = await abrir(page, DURANTE, true);
  await expect(page.getByTestId("estado")).toContainText("41,37% das seções apuradas");
  await expect(page.getByTestId("candidato").first()).toContainText("50,62%");
  await expect(page.getByTestId("atualizado-fonte")).toContainText("19:28");
  await expect(page.getByTestId("consultado-em")).toBeVisible();
  const cores = await page.locator(".mapa__area").evaluateAll((els) => new Set(els.map((e) => e.getAttribute("fill"))).size);
  expect(cores).toBeGreaterThan(3);
  expect(erros).toEqual([]);
});

test("não tem rolagem horizontal", async ({ page }) => {
  await abrir(page, DURANTE, true);
  await expect(page.locator(".mapa__area").first()).toBeVisible();
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sobra).toBeLessThanOrEqual(0);
});

test("lista de estados leva ao mapa de municípios e ao município", async ({ page }) => {
  await abrir(page, DURANTE, true);
  await page.getByTestId("linha-area").filter({ hasText: "São Paulo" }).click();
  await expect(page).toHaveURL(/#presidente-sp$/);
  await expect(page.getByTestId("painel-detalhe")).toContainText("Por município");
  await expect(page.locator(".mapa__area")).toHaveCount(645);
  await page.getByTestId("linha-area").first().click();
  await expect(page).toHaveURL(/#presidente-sp-\d{7}$/);
  await page.getByRole("button", { name: "Voltar um nível" }).click();
  await expect(page).toHaveURL(/#presidente-sp$/);
});

test("link com código IBGE abre o município", async ({ page }) => {
  await abrir(page, DURANTE, true, "#presidente-sp-3500105");
  await expect(page.getByTestId("painel-detalhe")).toContainText("Adamantina");
});

test("exterior: mapa-múndi com nomes de países e lista por país", async ({ page }) => {
  await abrir(page, DURANTE, true);
  await page.getByTestId("botao-exterior").click();
  await expect(page).toHaveURL(/#presidente-zz$/);
  await expect(page.locator(".mapa__rotulo--pais").filter({ hasText: "Canadá" })).toHaveCount(1);
  await expect(page.locator(".mapa__cidade")).toHaveCount(186);
  await expect(page.getByTestId("painel-detalhe")).toContainText("Por país");
});

test("governadores: só as UFs com 2º turno", async ({ page }) => {
  await abrir(page, ANTES, false);
  await page.getByTestId("aba-governador").click();
  await expect(page).toHaveURL(/#governador$/);
  await expect(page.locator(".multi__item")).toHaveCount(6);
});

test("patrocínio: oferta clara, sem preço inventado, abre o WhatsApp em nova aba", async ({ page }) => {
  await abrir(page, ANTES, false);
  const link = page.getByTestId("anuncio-whatsapp").first();
  await expect(link).toHaveAttribute("href", /^https:\/\/wa\.me\/5511944650268\?text=/);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(link).toContainText("Espaço de patrocínio nesta página de apuração");
  await expect(link).not.toContainText("valor a combinar");
  await expect(link).toContainText("Clique aqui");
  // Patrocínio em cima, antes do placar, numa faixa baixa.
  await expect(page.getByTestId("anuncio-whatsapp")).toHaveCount(1);
  await expect(page.locator(".rodape").getByTestId("anuncio-whatsapp")).toHaveCount(0);
  const caixa = (await link.boundingBox())!;
  expect(caixa.y).toBeLessThan((await page.getByTestId("placar").boundingBox())!.y);
  expect(caixa.height).toBeLessThanOrEqual(48);
  await expect(page.getByTestId("candidato").first()).toBeInViewport();
});

test("aviso da próxima eleição: um botão só, abre o contato em nova aba", async ({ page }) => {
  await abrir(page, ANTES, false);
  await expect(page.getByTestId("seguir")).toHaveCount(1);
  const link = page.getByTestId("seguir");
  await expect(link).toHaveText(/Quero ser avisado na próxima eleição/);
  await expect(link).toHaveAttribute("href", /^https:\/\/wa\.me\/5511944650268\?text=/);
  await expect(link).toHaveAttribute("target", "_blank");
});

test("um só percentual de apuração e nenhuma projeção na tela", async ({ page }) => {
  await abrir(page, DURANTE, true);
  await expect(page.getByTestId("estado")).toContainText("41,37% das seções apuradas");
  await expect(page.getByTestId("placar")).not.toContainText("41,4%");
  await expect(page.getByTestId("secoes-totalizadas")).toHaveCount(0);
  await expect(page.getByText("Projeção (estimativa)")).toHaveCount(0);
  await expect(page.getByTestId("projecao-valor")).toHaveCount(0);
  // A simulação não traz brancos e nulos: a linha some em vez de mostrar 0.
  await expect(page.getByTestId("boletim")).not.toContainText("Brancos e nulos");
});

test("busca de município", async ({ page }) => {
  await abrir(page, DURANTE, true);
  await page.getByTestId("botao-busca").click();
  await page.getByRole("searchbox", { name: "Nome do município" }).fill("adaman");
  await page.getByRole("button", { name: /Adamantina/ }).click();
  await expect(page).toHaveURL(/#presidente-sp-/);
});

test("consulta a API periodicamente sem duplicar", async ({ page }) => {
  const { chamadas } = await abrir(page, DURANTE, true);
  await expect(page.locator(".mapa__area").first()).toBeVisible();
  const res = chamadas.filter((c) => c.startsWith("/api/resultados"));
  expect(res.length).toBeLessThanOrEqual(2);
});

test("contador de pessoas: aparece com número e some quando indisponível", async ({ page }) => {
  await page.clock.setFixedTime(new Date(DURANTE));
  await simularApi(page, true, 1234);
  await page.goto("/#presidente");
  const contador = page.getByTestId("presenca");
  await expect(contador).toBeVisible();
  await expect(page.getByTestId("presenca-agora")).toHaveText("1.234");
  await expect(contador).toContainText("pessoas acompanhando agora");
  await expect(page.getByTestId("presenca-hoje")).toHaveText("56.789");
  await expect(contador).toContainText("hoje");
  await expect(page.getByText(/tempo real/i)).toHaveCount(0);
});

test("contador sem total do dia mostra só quem está agora", async ({ page }) => {
  await page.clock.setFixedTime(new Date(DURANTE));
  await simularApi(page, true, 1, null);
  await page.goto("/#presidente");
  await expect(page.getByTestId("presenca")).toContainText("1 pessoa acompanhando agora");
  await expect(page.getByTestId("presenca-hoje")).toHaveCount(0);
});

test("contador de pessoas indisponível não mostra número inventado", async ({ page }) => {
  await page.clock.setFixedTime(new Date(DURANTE));
  await simularApi(page, true, null);
  await page.goto("/#presidente");
  await expect(page.getByTestId("placar")).toBeVisible();
  await expect(page.getByTestId("presenca")).toHaveCount(0);
});

test("boletim: diferença, viradas e texto para o WhatsApp com resultado parcial", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { abertos: string[] }).abertos = [];
    window.open = (u?: string | URL) => {
      (window as unknown as { abertos: string[] }).abertos.push(String(u));
      return null;
    };
  });
  await abrir(page, DURANTE, true);
  const boletim = page.getByTestId("boletim");
  await expect(boletim).toContainText("Diferença");
  await expect(boletim).toContainText("votos");
  await expect(boletim).toContainText("Viradas desde o 1º turno");
  await page.getByTestId("mandar-whatsapp").click();
  const abertos = await page.evaluate(() => (window as unknown as { abertos: string[] }).abertos);
  const alvo = new URL(abertos[0]);
  expect(alvo.hostname).toBe("wa.me");
  const texto = alvo.searchParams.get("text") ?? "";
  expect(texto).toContain("Resultado parcial");
  expect(texto).toContain("41,37%");
});

test("compartilhar: gera a imagem para Stories e feed com o placar parcial", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "geração da imagem testada uma vez");
  await abrir(page, DURANTE, true);
  await expect(page.getByTestId("candidato").first()).toContainText("50,62%");
  await page.getByTestId("botao-compartilhar").click();
  await expect(page.getByTestId("compartilhar")).toBeVisible();
  for (const [formato, w, h] of [["stories", 1080, 1920], ["feed", 1080, 1350]] as const) {
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId(`cartao-${formato}`).click()]);
    expect(download.suggestedFilename()).toBe(`acompanhevotos-${formato}.png`);
    const caminho = info.outputPath(`${formato}.png`);
    await download.saveAs(caminho);
    const png = (await import("node:fs")).readFileSync(caminho);
    expect(png.readUInt32BE(16)).toBe(w);
    expect(png.readUInt32BE(20)).toBe(h);
    if (process.env.CAPTURAS) (await import("node:fs")).copyFileSync(caminho, `${process.env.CAPTURAS}/cartao-${formato}.png`);
  }
  await expect(page.getByTestId("compartilhar")).toContainText("Imagem salva");
});

test("compartilhar: opções com os ícones dos aplicativos", async ({ page }, info) => {
  await abrir(page, DURANTE, true);
  await page.getByTestId("botao-compartilhar").click();
  const janela = page.getByTestId("compartilhar");
  await expect(janela).toBeVisible();
  await expect(janela.locator("svg.icone-app")).toHaveCount(await janela.locator("button").count() - 1);
  await expect(janela).toContainText("Instagram Stories");
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/${info.project.name}-compartilhar.png` });
});

test("resumo do boletim abaixo do placar só no celular, e seguir dentro do boletim", async ({ page }, info) => {
  await abrir(page, "2026-10-25T19:30:00-03:00", true);
  const resumo = page.getByTestId("resumo-boletim");
  if (info.project.name === "celular") {
    await expect(resumo).toBeVisible();
    await expect(resumo).toContainText("640.000");
  } else {
    await expect(resumo).toBeHidden();
  }
  await expect(page.getByTestId("boletim").getByTestId("seguir")).toBeVisible();
});

test("celular: WhatsApp e busca logo abaixo do placar, sem repetir o placar no painel", async ({ page }, info) => {
  await abrir(page, "2026-10-25T19:30:00-03:00", true);
  const whats = page.getByTestId("whatsapp-placar");
  const busca = page.getByTestId("busca-placar");
  const repetido = page.getByTestId("painel-detalhe").locator(".det__bloco");
  if (info.project.name === "celular") {
    await expect(whats).toBeInViewport();
    await expect(busca).toBeVisible();
    await expect(repetido).toBeHidden();
    await busca.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  } else {
    await expect(whats).toBeHidden();
    await expect(repetido).toBeVisible();
  }
});

test("plano de governo: link no mesmo formato para os dois candidatos", async ({ page }) => {
  await abrir(page, DURANTE, true);
  const planos = page.getByTestId("candidato").getByTestId("plano-governo");
  await expect(planos).toHaveCount(2);
  for (const i of [0, 1]) await expect(planos.nth(i)).toContainText("Plano de governo");
});

test("fale com a gente: manda mensagem com e-mail e aceite", async ({ page }) => {
  const { chamadas } = await abrir(page, DURANTE, true);
  await page.getByTestId("fale-botao").click();
  const caixa = page.getByTestId("fale-caixa");
  await expect(caixa).toContainText("Só a equipe do acompanhevotos lê");
  await caixa.getByLabel("Mensagem", { exact: true }).fill("Gostei do mapa");
  await caixa.getByLabel("Seu e-mail").fill("pessoa@exemplo.com");
  await caixa.getByLabel(/Concordo/).check();
  await page.getByTestId("fale-enviar").click();
  await expect(page.getByTestId("fale-ok")).toBeVisible();
  expect(chamadas).toContain("/api/mensagem");
});

test("bate-papo: aba estilo MSN abre a janela, regras visíveis, texto sem HTML, enviar e denunciar", async ({ page }) => {
  const { erros, chamadas } = await abrir(page, DURANTE, true);
  const aba = page.getByTestId("chat-aba");
  await expect(aba).toBeVisible();
  await expect(aba).toContainText("1.234 online");
  await expect(page.getByTestId("chat-novas")).toHaveText("1");
  await aba.click();
  const chat = page.getByTestId("chat");
  await expect(page.getByTestId("chat-regras")).toContainText("não do acompanhevotos nem do TSE");
  await expect(page.getByTestId("chat-regras")).toContainText("não apoia nenhum candidato");
  await chat.getByRole("button", { name: "Regras" }).click();
  await expect(page.getByTestId("chat-regras")).toContainText("Não são permitidos pedido de voto");
  const lista = page.getByTestId("chat-lista");
  await expect(lista).toContainText("<b>apuração</b> andando rápido");
  await expect(lista.locator("b", { hasText: /^apuração$/ })).toHaveCount(0);
  // Sem nome não dá para escrever: a janela pede o nome primeiro.
  await expect(chat.getByLabel("Mensagem do bate-papo")).toHaveCount(0);
  await expect(page.getByTestId("chat-entrar")).toBeDisabled();
  await chat.getByLabel("Para conversar, diga seu nome").fill(" ");
  await expect(page.getByTestId("chat-entrar")).toBeDisabled();
  await chat.getByLabel("Para conversar, diga seu nome").fill("Bia");
  await page.getByTestId("chat-entrar").click();
  await expect(page.getByTestId("chat-apelido")).toContainText("Bia");
  await chat.getByLabel("Mensagem do bate-papo").fill("Acompanhando daqui de Salvador");
  await chat.getByLabel("Mensagem do bate-papo").press("Enter");
  const msgs = page.getByTestId("chat-msg");
  await expect(msgs.last()).toContainText("Acompanhando daqui de Salvador");
  await expect(msgs.last()).toContainText("Você");
  await expect(msgs.last()).toHaveClass(/chat-msg--meu/);
  await msgs.first().getByRole("button", { name: "Denunciar" }).click();
  await expect(msgs.first().getByRole("button", { name: "Denunciado" })).toBeDisabled();
  expect(chamadas).toContain("/api/chat/denuncia");
  await page.getByTestId("chat-minimizar").click();
  await expect(page.getByTestId("chat-aba")).toBeVisible();
  await expect(page.getByTestId("chat-novas")).toHaveCount(0);
  // O nome fica salvo no aparelho: depois de recarregar não pede de novo.
  await page.reload();
  await page.getByTestId("chat-aba").click();
  await expect(page.getByTestId("chat-apelido")).toContainText("Bia");
  await expect(page.getByTestId("chat-nome")).toHaveCount(0);
  expect(erros).toEqual([]);
});

test("bate-papo: responder uma mensagem mostra a citação, como reply", async ({ page }) => {
  const { erros } = await abrir(page, DURANTE, true);
  const longa = { id: "00000000-0000-4000-8000-000000000007", em: "2026-10-25T22:21:00.000Z", apelido: "Site top", texto: "Vai pra SPA amanhã levando o bolo se não vou barrar lá kkkkkk e mais um tanto de texto comprido" };
  await page.route("**/api/chat", (rota) => {
    if (rota.request().method() !== "GET") return rota.fallback();
    return rota.fulfill({ json: { mensagens: [longa, { id: "00000000-0000-4000-8000-000000000001", em: "2026-10-25T22:20:00.000Z", apelido: "Ana", texto: "<b>apuração</b> andando rápido" }] } });
  });
  await page.getByTestId("chat-aba").click();
  const chat = page.getByTestId("chat");
  // Sem nome, não aparece o botão de responder.
  await expect(chat.getByTestId("chat-responder")).toHaveCount(0);
  await chat.getByLabel("Para conversar, diga seu nome").fill("Bia");
  await page.getByTestId("chat-entrar").click();
  const msgs = page.getByTestId("chat-msg");
  await msgs.first().getByTestId("chat-responder").click();
  await expect(page.getByTestId("chat-respondendo")).toContainText("Respondendo a Ana");
  await page.getByTestId("chat-cancelar-resposta").click();
  // Respondendo a uma mensagem longa: a faixa corta o texto e o botão Enviar continua dentro da janela.
  await msgs.last().getByTestId("chat-responder").click();
  await expect(page.getByTestId("chat-respondendo")).toContainText("Respondendo a Site top");
  await chat.getByLabel("Mensagem do bate-papo").fill("oi");
  const janela = (await chat.boundingBox())!;
  const botao = (await page.getByTestId("chat-enviar").boundingBox())!;
  expect(botao.x + botao.width).toBeLessThanOrEqual(janela.x + janela.width);
  const faixa = (await page.getByTestId("chat-respondendo").boundingBox())!;
  expect(faixa.x + faixa.width).toBeLessThanOrEqual(janela.x + janela.width);
  await page.getByTestId("chat-cancelar-resposta").click();
  await expect(page.getByTestId("chat-respondendo")).toHaveCount(0);
  await msgs.first().getByTestId("chat-responder").click();
  const enviado = page.waitForRequest((r) => r.url().endsWith("/api/chat") && r.method() === "POST");
  await chat.getByLabel("Mensagem do bate-papo").fill("Aqui também");
  await chat.getByLabel("Mensagem do bate-papo").press("Enter");
  expect((await enviado).postDataJSON()).toMatchObject({ resposta: "00000000-0000-4000-8000-000000000001" });
  const ultima = msgs.last();
  await expect(ultima).toContainText("Aqui também");
  await expect(ultima.getByTestId("chat-citacao")).toContainText("Ana");
  await expect(ultima.getByTestId("chat-citacao")).toContainText("<b>apuração</b> andando rápido");
  await expect(page.getByTestId("chat-respondendo")).toHaveCount(0);
  expect(erros).toEqual([]);
});

test("bate-papo: mensagens novas aparecem sozinhas e dá para mandar GIF", async ({ page }) => {
  const { erros } = await abrir(page, DURANTE, true);
  const base = { id: "00000000-0000-4000-8000-000000000001", em: "2026-10-25T22:20:00.000Z", apelido: "Ana", texto: "primeira" };
  let novas = false;
  await page.route("**/api/chat", (rota) => {
    if (rota.request().method() !== "GET") return rota.fallback();
    const extra = { id: "00000000-0000-4000-8000-000000000009", em: "2026-10-25T22:25:00.000Z", apelido: "Rui", texto: "chegou sem recarregar" };
    return rota.fulfill({ json: { mensagens: novas ? [extra, base] : [base] } });
  });
  await page.getByTestId("chat-aba").click();
  const lista = page.getByTestId("chat-lista");
  await expect(lista).toContainText("primeira");
  novas = true;
  await expect(lista).toContainText("chegou sem recarregar", { timeout: 8000 });
  await page.getByLabel("Para conversar, diga seu nome").fill("Rui SP");
  await page.getByLabel("Para conversar, diga seu nome").press("Enter");

  await page.getByTestId("chat-gif-botao").click();
  const painel = page.getByTestId("chat-gifs");
  await expect(painel).toContainText("Powered by GIPHY");
  const img = painel.locator("img").first();
  await expect(img).toHaveAttribute("src", "https://media.giphy.com/media/AbC123xyz/200w.webp");
  await painel.getByRole("button", { name: "Enviar este GIF" }).first().click();
  const gif = page.getByTestId("chat-gif").last();
  await expect(gif).toHaveAttribute("src", "https://media.giphy.com/media/AbC123xyz/200w.webp");
  await expect(page.getByTestId("chat-gifs")).toHaveCount(0);
  expect(erros).toEqual([]);
});
