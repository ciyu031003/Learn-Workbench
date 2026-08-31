import { test, expect } from "../helpers/fixture";
import { hasAuth } from "../helpers/auth";

test.describe("/roadmap ICT 学习规划自定义", () => {
  test("ICT 不固定：显示自定义入口，可添加并删除自定义主题", async ({ app }) => {
    test.skip(!hasAuth(), "未配置 E2E_USERNAME/E2E_PASSWORD");
    const { page, collector } = app!;
    await page.goto("/roadmap");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1800);

    // 1) ICT 已解锁：副标题 + 按钮，无"固定"badge
    await expect(page.getByText("可自定义添加主题")).toBeVisible();
    await expect(page.getByRole("button", { name: "自定义主题" })).toBeVisible();
    await expect(page.getByText("ICT 规划固定")).toHaveCount(0);

    // 2) 取 ICT 第一个主阶段
    const phaseId = await page.evaluate(async () => {
      const r = await fetch("/api/roadmap?career=ict");
      const j = await r.json();
      const main = (j.phases || []).filter((p: { track: string }) => p.track === "main");
      return main[0]?.id as number | undefined;
    });
    expect(phaseId).toBeTruthy();

    // 3) 添加自定义主题（模拟表单提交）
    const title = "E2E自定义-" + Date.now();
    const add = await page.evaluate(
      async ({ pid, t }: { pid: number; t: string }) => {
        const r = await fetch("/api/roadmap/custom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phaseId: pid, title: t, summary: "e2e 回归验证" }),
        });
        return { status: r.status, body: await r.json().catch(() => null) };
      },
      { pid: phaseId!, t: title }
    );
    expect(add.status).toBe(201);
    const topicId = add.body?.topic?.id as number | undefined;
    expect(topicId).toBeTruthy();

    // 4) 刷新后出现
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1800);
    await expect(page.getByText(title)).toBeVisible();
    expect(collector.errors).toEqual([]);

    // 5) 删除后消失
    const del = await page.evaluate(async (id: number) => {
      const r = await fetch("/api/roadmap/custom?topicId=" + id, { method: "DELETE" });
      return { status: r.status };
    }, topicId!);
    expect(del.status).toBe(200);
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1800);
    await expect(page.getByText(title)).toHaveCount(0);
    expect(collector.errors).toEqual([]);
  });
});

test.describe("/roadmap 大阶段自定义（拖拽排序/增删）", () => {
  test("可新增、排序、编辑、删除大阶段（API 层面）", async ({ app }) => {
    test.skip(!hasAuth(), "未配置 E2E_USERNAME/E2E_PASSWORD");
    const { page } = app!;
    await page.goto("/roadmap");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1200);

    // 1) 新增自定义大阶段
    const created = await page.evaluate(async () => {
      const title = "E2E大阶段-" + Date.now();
      const r = await fetch("/api/roadmap/phases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ career: "ict", track: "main", title, summary: "e2e", weeks: "第 99-100 周" }),
      });
      const body = await r.json().catch(() => null);
      return { status: r.status, body };
    });
    expect(created.status).toBe(201);
    const phaseId = created.body?.phase?.id as number | undefined;
    expect(phaseId).toBeTruthy();

    // 2) 排序：把新阶段放到最前 → 应返回 ok
    const reorder = await page.evaluate(async (pid: number) => {
      const r0 = await fetch("/api/roadmap?career=ict");
      const j = await r0.json();
      const main = (j.phases || []).filter((p: { track: string }) => p.track === "main");
      const ids = main.map((p: { id: number }) => p.id);
      const order = [pid, ...ids.filter((x: number) => x !== pid)];
      const rr = await fetch("/api/roadmap/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ career: "ict", track: "main", order }),
      });
      return { status: rr.status, order };
    }, phaseId!);
    expect(reorder.status).toBe(200);

    // 3) 排序后该阶段应被自动更名（位于最前 → phase-1）
    const after = await page.evaluate(async (pid: number) => {
      const r = await fetch("/api/roadmap?career=ict");
      const j = await r.json();
      const main = (j.phases || []).filter((p: { track: string }) => p.track === "main");
      return main.find((p: { id: number }) => p.id === pid) ?? null;
    }, phaseId!);
    expect(after?.phase_key).toBe("phase-1");
    expect(after?.is_custom).toBe(true);

    // 4) 删除该大阶段
    const del = await page.evaluate(async (pid: number) => {
      const r = await fetch("/api/roadmap/phases?id=" + pid, { method: "DELETE" });
      return { status: r.status };
    }, phaseId!);
    expect(del.status).toBe(200);

    // 5) 刷新后不再出现
    const gone = await page.evaluate(async (pid: number) => {
      const r = await fetch("/api/roadmap?career=ict");
      const j = await r.json();
      return (j.phases || []).some((p: { id: number }) => p.id === pid);
    }, phaseId!);
    expect(gone).toBe(false);
  });
});