import { test, expect } from "../helpers/fixture";
import { hasAuth } from "../helpers/auth";
import { hasHydrationError } from "../helpers/collect";

test.describe("/dashboard 首页", () => {
  test("无水合错误，顶栏显示今日日期与问候", async ({ app }) => {
    test.skip(!hasAuth(), "未配置 E2E_USERNAME/E2E_PASSWORD");
    const { page, collector } = app!;
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // 1) 无水合 / console 错误
    expect(collector.errors).toEqual([]);
    expect(hasHydrationError(collector.errors)).toBe(false);

    // 2) 顶栏今日日期（桌面 header）
    const today = new Date().toISOString().slice(0, 10);
    await expect(page.locator("header").first().getByText(new RegExp(`今日\\s*${today}`))).toBeVisible();

    // 3) 主标题问候语渲染（S6-2 起由服务端/客户端按时间给出问候；文案随小时变化）
    await expect(page.locator("h1").first()).toContainText(/(夜深了|早上好|中午好|下午好|晚上好|你好)，/);
  });
});
