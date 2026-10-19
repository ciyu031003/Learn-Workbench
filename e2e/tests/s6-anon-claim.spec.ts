import { test, expect } from "../helpers/fixture";
import { credentials, NO_CREDENTIALS_REASON } from "../helpers/api";
import { probeServer } from "../helpers/server";

/**
 * S6-9：匿名 → 登录 → 数据认领。
 *
 * 链路（与线上真实行为一致）：
 *  1. 匿名访问页面 → proxy 下发签名 lwb_anon 设备 cookie；
 *  2. 匿名写一条日志（POST /api/logs，归属 anon_id）；
 *  3. 同一“设备”（同一 cookie jar）登录 → 服务端 claimAnonData 把 anon_id 行并入账号；
 *  4. 登录后 /api/logs（user_id 作用域）能看到它；换设备的匿名客户端看不到。
 *
 * 无凭据时 skip 并打印原因（不静默跳过）。
 */
interface LogItem {
  title?: string;
}

test.describe("S6-9 匿名写 → 登录 → 数据认领", () => {
  test("匿名设备写的日志在登录后归属当前账号，且其他设备不可见", async ({ browser, request }) => {
    const probe = await probeServer(request);
    test.skip(!probe.ok, probe.reason);

    const creds = credentials();
    if (!creds) {
      console.warn("[e2e][skip] " + NO_CREDENTIALS_REASON);
      test.skip(true, NO_CREDENTIALS_REASON);
      return;
    }

    const context = await browser.newContext();
    try {
      const page = await context.newPage();

      // 1) 匿名访问页面：让 proxy 下发设备标识
      await page.goto("/login");
      const anonCookie = (await context.cookies()).find((c) => c.name === "lwb_anon");
      expect(anonCookie?.value, "匿名设备 cookie 未下发（proxy 未运行 / 被禁用？）").toBeTruthy();

      // 2) 匿名写日志
      const title = "S6-9 匿名日志 " + Date.now();
      const write = await context.request.post("/api/logs", {
        data: { kind: "review", title, content: "匿名写入 → 登录认领回归（S6-9）" },
        failOnStatusCode: false,
      });
      expect(write.status(), await write.text()).toBe(201);

      // 登录前：同一匿名设备能读到自己的行
      const anonList = await context.request.get("/api/logs?limit=50", { failOnStatusCode: false });
      expect(anonList.status()).toBe(200);
      const anonTitles = ((await anonList.json()).logs ?? []).map((l: LogItem) => l.title);
      expect(anonTitles).toContain(title);

      // 3) 同一 cookie jar 登录：请求会带上 lwb_anon → 服务端认领该设备匿名行
      const login = await context.request.post("/api/auth/login", {
        data: { username: creds.username, password: creds.password },
        failOnStatusCode: false,
      });
      expect(login.status(), await login.text()).toBe(200);

      // 4) 登录后：账号作用域能看到被认领的行
      const authedList = await context.request.get("/api/logs?limit=50", { failOnStatusCode: false });
      expect(authedList.status()).toBe(200);
      const authedTitles = ((await authedList.json()).logs ?? []).map((l: LogItem) => l.title);
      expect(authedTitles).toContain(title);

      // 5) 另一台“设备”（全新 context，无该用户 cookie）不应看到这条（已归属账号，不再在匿名池）
      const other = await browser.newContext();
      try {
        const otherPage = await other.newPage();
        await otherPage.goto("/login");
        const otherList = await other.request.get("/api/logs?limit=50", { failOnStatusCode: false });
        const otherTitles = ((await otherList.json()).logs ?? []).map((l: LogItem) => l.title);
        expect(otherTitles, "认领后的日志不应在另一台设备的匿名作用域可见").not.toContain(title);
      } finally {
        await other.close();
      }
    } finally {
      await context.close();
    }
  });
});
