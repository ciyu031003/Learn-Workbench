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

test.describe("技能冷启动 + 路线图定位", () => {
  test("技能页展示按职业推荐技能（冷启动引导）", async ({ app }) => {
    test.skip(!hasAuth(), "未配置 E2E_USERNAME/E2E_PASSWORD");
    const { page, collector } = app!;
    await page.goto("/career/skills");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    const recCount = await page.getByText("按职业推荐技能").count();
    // 用户已有全部推荐技能时可能不显示，但至少页面无报错
    if (recCount > 0) {
      await expect(page.getByText("按职业推荐技能")).toBeVisible();
    }
    expect(collector.errors).toEqual([]);
  });

  test("缺口→路线图定位：#phase-<id> 展开对应阶段", async ({ app }) => {
    test.skip(!hasAuth(), "未配置 E2E_USERNAME/E2E_PASSWORD");
    const { page, collector } = app!;
    // 取 ICT 第 4 个主阶段（默认只展开前 2 个，用它验证 hash 定位展开）
    const phaseId = await page.evaluate(async () => {
      const r = await fetch("/api/roadmap?career=ict");
      const j = await r.json();
      const main = (j.phases || []).filter((p: { track: string }) => p.track === "main");
      return main[3]?.id as number | undefined;
    });
    expect(phaseId).toBeTruthy();

    await page.goto("/roadmap#phase-" + phaseId);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2500);

    const card = page.locator("#phase-" + phaseId);
    await expect(card).toBeVisible();
    // 展开态：内部有主题列表容器（border-t）
    await expect(card.locator(".border-t.border-border\/60")).toBeVisible();
    expect(collector.errors).toEqual([]);
  });
});
