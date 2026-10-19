import { test, expect } from "../helpers/fixture";
import { probeServer } from "../helpers/server";

/**
 * S6-9：中文 404 的两个出口（扩展 S5-7a：不止“能显示”，还要“能走掉”）。
 *  - 「回到首页」→ 落地页 /（公开、未登录可看）；
 *  - 「进入工作台」→ 未登录会被服务端守卫送到 /login（不是白屏/死链）。
 */
test.describe("S6-9 中文 404 出口", () => {
  test("「回到首页」跳转落地页并可见主标题", async ({ page, request }) => {
    const probe = await probeServer(request);
    test.skip(!probe.ok, probe.reason);

    const res = await page.goto("/s6-9-not-found-" + Date.now());
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "这个页面不存在" })).toBeVisible();

    await page.getByRole("link", { name: "回到首页" }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
    await expect(page.getByText(/放进同一条成长曲线/)).toBeVisible();
  });

  test("「进入工作台」未登录 → 服务端送到 /login", async ({ page, request }) => {
    const probe = await probeServer(request);
    test.skip(!probe.ok, probe.reason);

    const res = await page.goto("/s6-9-not-found-" + Date.now());
    expect(res?.status()).toBe(404);
    await page.getByRole("link", { name: "进入工作台" }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/login");
    await expect(page.getByRole("button", { name: "登录", exact: true })).toBeVisible();
  });
});
