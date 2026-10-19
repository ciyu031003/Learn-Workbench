import { test, expect } from "../helpers/fixture";
import { newAnonApi, newAuthedApi } from "../helpers/api";
import { probeServer } from "../helpers/server";

/**
 * S6-9：RSC / 服务端首屏（不依赖客户端 JS 也能拿到正确结果）。
 *
 * 断言三件事：
 *  1. 未登录 GET /dashboard：服务端守卫直接 307 → /login（不是先渲染壳再客户端弹走）；
 *  2. 登录态 GET /dashboard：200，HTML 里已有服务端 shell + 真实“今日任务”（S6-2 起 dashboard 已改 RSC）；
 *  3. 真实数据的 RSC：/learn 首屏 HTML 必须包含 /api/learning/catalog 里的**真实课程标题**
 *     （服务端从数据库读到并渲染，不执行任何客户端 JS）。
 *
 * 注：dashboard 的 RSC 化由 S6-2 并行流完成；若该改动被回滚（dashboard 退回纯客户端），
 * 第 2 步的“今日任务出现在 HTML”会失败——这正是本用例要防的回归。
 */
interface TrackItem {
  title?: string;
  name?: string;
  slug?: string;
}

test.describe("S6-9 RSC 首屏数据", () => {
  test("dashboard 服务端守卫 + /learn 首屏含数据库课程", async ({ request }) => {
    const probe = await probeServer(request);
    test.skip(!probe.ok, probe.reason);

    // 1) 未登录：服务端 307
    const anon = await newAnonApi();
    try {
      const res = await anon.get("/dashboard", { maxRedirects: 0 });
      expect([307, 308]).toContain(res.status());
      expect(res.headers()["location"] ?? "").toContain("/login");
    } finally {
      await anon.dispose();
    }

    // 2) 登录态：200 且 HTML 已含服务端 shell + 真实“今日任务”数据（S6-2 起 dashboard 为 RSC）
    const authed = await newAuthedApi();
    const taskTitle = "S6-9 RSC 任务 " + Date.now();
    let createdTaskId: number | null = null;
    try {
      const created = await authed.post("/api/tasks", { data: { title: taskTitle }, failOnStatusCode: false });
      if (created.status() === 201) {
        const task = ((await created.json()) as { task?: { id?: number } }).task;
        createdTaskId = typeof task?.id === "number" ? task.id : null;
      } else {
        console.warn("[e2e][warn] 建今日任务失败 HTTP " + created.status() + "，dashboard RSC 真实数据断言降级为 shell 断言");
      }

      const dash = await authed.get("/dashboard", { maxRedirects: 0 });
      expect(dash.status()).toBe(200);
      const html = await dash.text();
      expect(html).toContain("学习工作台");
      expect(html.toLowerCase()).toContain("<html");
      expect(html).not.toContain("请先登录"); // 不是登录页被误当成 dashboard
      if (createdTaskId !== null) {
        // 关键：服务端直出 HTML 里就该有这条今日任务（不执行客户端 JS 也能看到）
        expect(html, "dashboard RSC HTML 应包含今日任务「" + taskTitle + "」").toContain(taskTitle);
      }
    } finally {
      // 清理：标记完成（当前 API 无 DELETE；标记 done 让仪表盘不再显示为待办）
      if (createdTaskId !== null) {
        await authed.patch("/api/tasks", { data: { id: createdTaskId, done: true } }).catch(() => undefined);
      }
      await authed.dispose();
    }

    // 3) 真实数据的 RSC：课程目录 API → /learn HTML 必含其标题
    const catalogRes = await request.get("/api/learning/catalog", { timeout: 60_000 });
    expect(catalogRes.status()).toBe(200);
    const tracks = (((await catalogRes.json()) as { tracks?: TrackItem[] }).tracks ?? []) as TrackItem[];
    const expectedTitle = tracks.map((t) => t.title ?? t.name ?? "").find((t) => t.length > 1) || "";
    if (!expectedTitle) {
      test.skip(true, "数据库暂无学习课程（迁移 075 未应用/新库）：跳过 RSC 真实数据断言");
      return;
    }
    const learn = await request.get("/learn", { timeout: 60_000 });
    expect(learn.status()).toBe(200);
    const learnHtml = await learn.text();
    expect(learnHtml, "首屏 HTML 应包含数据库课程「" + expectedTitle + "」").toContain(expectedTitle);
  });
});
