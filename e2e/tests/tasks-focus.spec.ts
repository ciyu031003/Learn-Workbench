import { test, expect } from "../helpers/fixture";
import { hasAuth } from "../helpers/auth";

test.describe("/tasks 专注页", () => {
  test("页面加载无 console 错误与 404 资源", async ({ app }) => {
    test.skip(!hasAuth(), "未配置 E2E_USERNAME/E2E_PASSWORD");
    const { page, collector } = app!;
    await page.goto("/tasks");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    await expect(page.getByText("每日任务")).toBeVisible();
    expect(collector.errors).toEqual([]);
    expect(collector.failed).toEqual([]);
  });
});
