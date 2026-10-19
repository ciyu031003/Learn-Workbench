import { test, expect } from "../helpers/fixture";
import { loadEnv } from "../helpers/env";

test.describe("匿名分享页 + 登录写日志（S5-7a 回归）", () => {
  test("分享页匿名可访问：不跳登录，渲染分享页空态", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const res = await page.goto("/share/sport/s5-7a-missing-profile");
    // 关键回归：公开分享页不能被会话校验踢到 /login
    expect(page.url()).not.toContain("/login");
    expect(res?.status()).toBe(200);
    await expect(page.getByText("档案不存在或未公开")).toBeVisible({ timeout: 15_000 });
    await context.close();
  });

  test("匿名访问受保护页 → 登录 → 写日志 → 刷新仍在", async ({ browser }) => {
    const env = loadEnv();
    const username = env.E2E_USERNAME;
    const password = env.E2E_PASSWORD;
    test.skip(!username || !password, "未配置 E2E_USERNAME/E2E_PASSWORD，跳过登录写入链路");

    const context = await browser.newContext();
    const page = await context.newPage();

    // 1) 匿名访问受保护页 → 被服务端守卫送到 /login
    await page.goto("/logs");
    await expect(page).toHaveURL(/\/login/);

    // 2) 登录：直接点表单的 submit 按钮（页面里还有「登录/注册」模式切换按钮，按名字会点错）
    await page.getByPlaceholder(/账号/).fill(username!);
    await page.getByPlaceholder(/密码/).fill(password!);
    await page.locator('form button[type="submit"]').first().click();

    // 首次登录会弹「选择职业」弹窗（此时 URL 仍是 /login?from=...），先处理弹窗再判断跳转
    await page.waitForTimeout(2500);
    const skip = page.getByRole("button", { name: /跳过/ }).first();
    if (await skip.isVisible().catch(() => false)) {
      await skip.click().catch(() => {});
    }
    // 登录失败时会停在 /login?from=...（不以 /login 结尾），所以用"包含"判断
    await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 30_000 });

    // 3) 写一篇日志（标题带时间戳，避免与历史数据冲突）
    const title = "S5-7a 双端一致 " + Date.now();
    await page.goto("/logs");
    await page.getByPlaceholder("标题").fill(title);
    await page.getByPlaceholder(/写下你的理解/).fill("S5-7a 双端一致性回归：登录后写入，刷新仍在。");
    await page.getByRole("button", { name: "保存日志" }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });

    // 4) 刷新后仍在（落库，不是内存状态）
    await page.reload();
    await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
    await context.close();
  });
});
