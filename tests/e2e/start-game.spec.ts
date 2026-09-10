import { expect, test } from "@playwright/test";

test("Retina環境でもゲーム開始から5秒以内にGameSceneへ遷移する", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.locator("#startGame")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-buffett-scene", "menu");

  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);
  await page.locator("#startGame").click();

  await expect(page.locator("html")).toHaveAttribute("data-buffett-scene", "game", { timeout: 5_000 });
  await expect(page.locator(".setup-form")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(pageErrors).toEqual([]);
});
