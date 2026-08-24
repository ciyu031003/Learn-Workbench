import { test, expect } from "../helpers/fixture";
import { hasAuth } from "../helpers/auth";

test.describe("岗位学习计划（整包规划）", () => {
  test("计划 API 返回结构化数据（job + phases + totalHours）", async ({ app }) => {
    test.skip(!hasAuth(), "未配置 E2E_USERNAME/E2E_PASSWORD");
    const { page, collector } = app!;
    await page.goto("/jobs");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    const plan = await page.evaluate(async () => {
      const lr = await fetch("/api/jobs?page=1&pageSize=1").then((r) => r.json());
      const id = lr?.jobs?.[0]?.id as number | undefined;
      if (!id) return null;
      const r = await fetch("/api/jobs/" + id + "/plan");
      if (!r.ok) return null;
      return await r.json();
    });
    expect(plan).toBeTruthy();
    expect(Number(plan.job.id)).toBeGreaterThan(0);
    expect(Array.isArray(plan.phases)).toBe(true);
    expect(typeof plan.totalHours).toBe("number");
    expect(collector.errors).toEqual([]);
  });

  test("职位详情面板展示匹配度与学习计划区块", async ({ app }) => {
    test.skip(!hasAuth(), "未配置 E2E_USERNAME/E2E_PASSWORD");
    const { page, collector } = app!;
    await page.goto("/jobs");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2500);

    await page.locator("main .job-card").first().click();
    await page.waitForTimeout(3000);

    // 视口 1489px 下 JobDetailPanel 为 2xl-only（hidden），可见的是 JobModal → 取 DOM 最后一个
    await expect(page.getByText("我的匹配度").last()).toBeVisible();
    // admin 无技能画像时通常有缺口 → 展示学习计划（无缺口时跳过 UI 断言）
    const planCount = await page.getByText("岗位学习计划").count();
    if (planCount > 0) {
      await expect(page.getByText(/补完约/).last()).toBeVisible();
    }
    expect(collector.errors).toEqual([]);
  });
});
