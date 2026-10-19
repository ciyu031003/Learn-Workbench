import { test, expect } from "../helpers/fixture";

/** 与 store/ui-store.ts 的 persist name 一致（防闪脚本读同一个 key） */
const UI_STORE_KEY = "lwb-web-ui";

type FrameProbeWindow = Window & { __lwbFirstFrameClass?: string | null };

test.describe("深色主题 + 中文 404（S5-7a 回归）", () => {
  test("localStorage 已存 dark 时首帧即为深色（防闪），刷新后保持", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // 在任何页面脚本之前写入持久化主题，并记录首帧时 <html> 的 class
    await page.addInitScript((key) => {
      try {
        window.localStorage.setItem(key, JSON.stringify({ state: { theme: "dark" }, version: 1 }));
      } catch {
        // about:blank 等无源文档忽略
      }
      const w = window as FrameProbeWindow;
      w.__lwbFirstFrameClass = null;
      requestAnimationFrame(() => {
        w.__lwbFirstFrameClass = document.documentElement.className;
      });
    }, UI_STORE_KEY);

    await page.goto("/login");
    await page.waitForFunction(() => (window as FrameProbeWindow).__lwbFirstFrameClass !== null, undefined, { timeout: 10_000 });
    const firstFrameClass = await page.evaluate(() => (window as FrameProbeWindow).__lwbFirstFrameClass ?? "");
    // 首帧就带 dark：内联防闪脚本已生效，没有"先浅后深"的闪动
    expect(firstFrameClass).toContain("dark");
    await expect.poll(async () => page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);

    // 刷新（同一 context 保留 localStorage）后仍为深色
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect.poll(async () => page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);
    await context.close();
  });

  test("未知路径返回中文 404（不是 Next 内置英文页）", async ({ page }) => {
    const res = await page.goto("/s5-7a-not-found-" + Date.now());
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "这个页面不存在" })).toBeVisible();
    await expect(page.getByRole("link", { name: "回到首页" })).toBeVisible();
  });
});
