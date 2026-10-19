import { test, expect } from "../helpers/fixture";
import { gotoWithRetry } from "../helpers/ui";
import { probeServer } from "../helpers/server";

/**
 * S6-9：/wellbeing 页面加载 + 关键数字块。
 *
 * 只断言“结构与关键数字块出现”，不依赖具体数值（数据库里可 0 可非 0）：
 *  - 今日饮水（含 +250ml 快捷按钮）；
 *  - 状态分 hero（今日状态分 / 完成度分解）；
 *  - 精力状态 / 今日运动（Card 标题）。
 * 未登录（app fixture 为 null）时 skip。
 */
test.describe("S6-9 /wellbeing 健康页", () => {
  test("登录后加载：饮水 / 状态分 / 精力 / 运动四块可见", async ({ app, request }) => {
    const probe = await probeServer(request);
    test.skip(!probe.ok, probe.reason);

    test.setTimeout(150_000);
    if (!app) {
      console.warn("[e2e][skip] 无登录态（global-setup 未生成 .auth/user.json），跳过热健康页");
      test.skip(true, "无登录态：配置 E2E_USERNAME/E2E_PASSWORD 后重跑");
      return;
    }
    const { page, collector } = app;

    const hydrationCard = page.getByText("今日饮水", { exact: true });
    await gotoWithRetry(page, "/wellbeing", hydrationCard, { attempts: 3, timeoutPerTry: 40_000 });
    await expect.poll(() => new URL(page.url()).pathname).toBe("/wellbeing");

    // 1) 今日饮水卡 + 快捷数字按钮（不依赖接口返回的具体毫升数）
    await expect(hydrationCard).toBeVisible();
    await expect(page.getByRole("button", { name: "+250ml" })).toBeVisible();

    // 2) 状态分 hero 的关键数字块（数据接口返回后出现）
    await expect(page.getByText(/今日状态分/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("完成度分解", { exact: true })).toBeVisible();

    // 3) 精力 / 运动两个 Card 标题
    await expect(page.getByText("精力状态", { exact: true })).toBeVisible();
    await expect(page.getByText("今日运动", { exact: true })).toBeVisible();

    // 文档级 4xx 不应出现（接口 4xx 不计入 collector.failed，只收 document 响应）
    expect(collector.failed.filter((f) => f.startsWith("HTTP4")).length, collector.failed.join("\n")).toBe(0);
  });
});
