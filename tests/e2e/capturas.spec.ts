/** Capturas de tela para revisão visual (só roda com CAPTURAS=1). Dados SIMULADOS. */
import { test } from "@playwright/test";
import { simularApi } from "./simulacao";

test.skip(!process.env.CAPTURAS, "capturas só sob demanda");

const PASTA = process.env.CAPTURAS ?? "capturas";

for (const [nome, apurando, hash, hora] of [
  ["antes", false, "#presidente", "2026-10-25T11:30:00-03:00"],
  ["apurando", true, "#presidente", "2026-10-25T19:30:00-03:00"],
  ["uf", true, "#presidente-sp", "2026-10-25T19:30:00-03:00"],
  ["exterior", true, "#presidente-zz", "2026-10-25T19:30:00-03:00"],
  ["governador", false, "#governador", "2026-10-25T11:30:00-03:00"],
] as const) {
  test(`captura ${nome}`, async ({ page }, info) => {
    await page.clock.setFixedTime(new Date(hora));
    await simularApi(page, apurando);
    await page.goto(`/${hash}`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${PASTA}/${info.project.name}-${nome}.png`, fullPage: info.project.name !== "desktop" });
  });
}
