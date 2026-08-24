import { test, expect } from "../helpers/fixture";
import { hasAuth } from "../helpers/auth";

test.describe("学习 × 招聘打通：市场需求缺口", () => {
  test("技能树页展示市场需求缺口区块（缺口列表或已覆盖空态）", async ({ app }) => {
    test.skip(!hasAuth(), "未配置 E2E_USERNAME/E2E_PASSWORD");
    const { page, collector } = app!;
    await page.goto("/career/skills");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    await expect(page.getByText("市场需求缺口")).toBeVisible();
    const gapRows = await page.getByRole("button", { name: "加入学习" }).count();
    const covered = await page.getByText("技能已覆盖市场高频需求").count();
    expect(gapRows + covered).toBeGreaterThan(0);
    expect(collector.errors).toEqual([]);
  });

  test("首页展示能力缺口入口卡（有缺口时）", async ({ app }) => {
    test.skip(!hasAuth(), "未配置 E2E_USERNAME/E2E_PASSWORD");
    const { page, collector } = app!;
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    const cardCount = await page.getByText("市场需要、你还缺").count();
    if (cardCount > 0) {
      await expect(page.getByText("去补齐")).toBeVisible();
    }
    expect(collector.errors).toEqual([]);
  });
});
