import { test, expect } from "../helpers/fixture";
import { probeServer } from "../helpers/server";

/**
 * S6-9：深色主题切换 → 刷新保持 + 首帧无白闪（扩展 S5-7a 的“预置 dark”用例）。
 *
 * 现状说明：Web 端当前没有主题切换 UI（store 里 setTheme 无调用点），
 * 因此“切换”动作通过写入持久化 key（与 store/ui-store.ts 的 persist name 一致）模拟，
 * 重点验证：切换后刷新仍深色，且**首帧** <html> 就带 dark（内联防闪脚本生效，无先浅后深）。
 */
const UI_STORE_KEY = "lwb-web-ui";

type ProbeWindow = Window & { __lwbFirstFrameClass?: string | null };

async function readFirstFrameClass(page: import("@playwright/test").Page): Promise<string> {
  await page.waitForFunction(() => (window as ProbeWindow).__lwbFirstFrameClass !== null, undefined, {
    timeout: 10_000,
  });
  return (await page.evaluate(() => (window as ProbeWindow).__lwbFirstFrameClass ?? "")) as string;
}

async function persistTheme(page: import("@playwright/test").Page, theme: "light" | "dark"): Promise<void> {
  await page.evaluate(
    ([key, value]) => {
      window.localStorage.setItem(String(key), JSON.stringify({ state: { theme: value }, version: 1 }));
    },
    [UI_STORE_KEY, theme] as const
  );
}

test.describe("S6-9 深色主题切换", () => {
  test("浅色 → 深色 → 刷新保持（首帧即 dark），再切回浅色也保持", async ({ browser, request }) => {
    const probe = await probeServer(request);
    test.skip(!probe.ok, probe.reason);

    const context = await browser.newContext();
    const page = await context.newPage();
    // 每次导航（含 reload）记录首帧 <html> class：用于断言“刷新后首帧就是深色”
    await page.addInitScript(() => {
      const w = window as ProbeWindow;
      w.__lwbFirstFrameClass = null;
      requestAnimationFrame(() => {
        w.__lwbFirstFrameClass = document.documentElement.className;
      });
    });

    try {
      // 1) 默认浅色：首帧不带 dark
      await page.goto("/login");
      expect(await readFirstFrameClass(page)).not.toContain("dark");

      // 2) 切到深色（持久化）→ 刷新：首帧必须已经是 dark（无白闪）
      await persistTheme(page, "dark");
      await page.reload();
      expect(await readFirstFrameClass(page)).toContain("dark");
      await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);
      // 注：theme-color 是 media 两套 meta（light/dark 都常驻），不能用来判断当前主题；
      // 首帧 class + html.dark 才是“无白闪”的判据。

      // 3) 再切回浅色 → 刷新仍保持浅色
      await persistTheme(page, "light");
      await page.reload();
      expect(await readFirstFrameClass(page)).not.toContain("dark");
      await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(false);
    } finally {
      await context.close();
    }
  });
});
