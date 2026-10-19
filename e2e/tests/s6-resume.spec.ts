import { test, expect } from "../helpers/fixture";
import { gotoWithRetry } from "../helpers/ui";
import { probeServer } from "../helpers/server";

/**
 * S6-9：/career/resume 简历编辑器。
 *
 * 覆盖两件事：
 *  - 编辑器可用（标题 / 文档切换列表 / 新建 / 打印导出）；
 *  - 上传区按 API 实际数据走「空态」或「文件列表」分支（不写死某一台环境的状态）。
 * 无登录态时 skip。
 */
interface ResumeFile {
  fileName?: string;
}

test.describe("S6-9 /career/resume 简历", () => {
  test("登录后渲染编辑器；上传区空态/列表与 API 一致", async ({ app, request }) => {
    const probe = await probeServer(request);
    test.skip(!probe.ok, probe.reason);

    test.setTimeout(150_000);
    if (!app) {
      console.warn("[e2e][skip] 无登录态（global-setup 未生成 .auth/user.json），跳过简历页");
      test.skip(true, "无登录态：配置 E2E_USERNAME/E2E_PASSWORD 后重跑");
      return;
    }
    const { page } = app;

    const editorHeading = page.getByRole("heading", { name: "简历编辑器" });
    const loadError = page.getByText("暂时无法加载简历", { exact: true });
    // dev 首次编译可能 >25s：导航重试 3 次，每次最多 40s（生产构建一次就绪）
    await gotoWithRetry(page, "/career/resume", editorHeading.or(loadError), { attempts: 3, timeoutPerTry: 40_000 });
    await expect(editorHeading.or(loadError)).toBeVisible();

    if (await loadError.isVisible().catch(() => false)) {
      // 接口/迁移未就绪时的显式空态（页面不会白屏）——这是可接受的降级，但记录原因并 skip 主体断言
      test.skip(true, "简历接口不可用，页面进入「暂时无法加载简历」空态（需要迁移 055 + /api/resumes 可用）");
      return;
    }

    // 文档切换下拉（列表来源 /api/resumes，页面首次进入会自动建一份默认简历）
    const docSelect = page.locator('select[aria-label="切换简历"]');
    await expect(docSelect).toBeVisible();
    expect(await docSelect.locator("option").count(), "文档切换列表应有至少 1 份简历").toBeGreaterThan(0);

    await expect(page.getByRole("button", { name: /新建/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /打印 \/ 导出 PDF/ })).toBeVisible();
    await expect(page.getByText("简历文件", { exact: true })).toBeVisible();

    // 上传区：按 API 实际文件数选择断言分支
    const filesRes = await page.request.get("/api/resume-files");
    expect(filesRes.status()).toBe(200);
    const files = ((await filesRes.json()).files ?? []) as ResumeFile[];
    if (files.length === 0) {
      await expect(page.getByText(/还没有上传简历/)).toBeVisible();
    } else {
      const first = String(files[0].fileName || "");
      expect(first.length, "上传列表的文件名不应为空").toBeGreaterThan(0);
      await expect(page.getByText(first, { exact: false }).first()).toBeVisible();
    }

    // 文档 API 也应是“列表”形状（不依赖前端缓存）
    const docsRes = await page.request.get("/api/resumes");
    expect(docsRes.status()).toBe(200);
    const docsBody = await docsRes.json();
    expect(Array.isArray(docsBody.documents)).toBe(true);
    expect(docsBody.documents.length, "页面应至少自动创建 1 份简历").toBeGreaterThan(0);
  });
});
