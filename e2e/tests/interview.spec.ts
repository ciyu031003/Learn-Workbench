import { test, expect } from "../helpers/fixture";
import { hasAuth } from "../helpers/auth";

test.describe("P3 面试题库与模拟面试", () => {
  test("面试页展示题库刷题 / 答题统计 / 记录面试 / 复盘区块且无报错", async ({ app }) => {
    test.skip(!hasAuth(), "未配置 E2E_USERNAME/E2E_PASSWORD");
    const { page, collector } = app!;
    await page.goto("/career/interview");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2500);

    await expect(page.getByRole("heading", { name: "题库刷题" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "答题统计" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "记录一场面试" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "复盘记录" })).toBeVisible();
    expect(collector.errors).toEqual([]);
  });

  test("题库为空时显示空态引导（无种子数据场景）", async ({ app }) => {
    test.skip(!hasAuth(), "未配置 E2E_USERNAME/E2E_PASSWORD");
    const { page, collector } = app!;
    await page.goto("/career/interview");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2500);

    // 有题目则走刷题；无题目则空态。两者都接受，核心是页面可用。
    const hasQuiz = (await page.getByRole("button", { name: "提交作答" }).count()) > 0;
    const empty = (await page.getByText("题库为空或筛选无结果").count()) > 0;
    expect(hasQuiz || empty).toBe(true);
    expect(collector.errors).toEqual([]);
  });
});
