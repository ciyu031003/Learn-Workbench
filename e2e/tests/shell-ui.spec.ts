import { test, expect } from "../helpers/fixture";
import { hasAuth } from "../helpers/auth";

test.describe("AppShell UI 回归（下拉 / 弹窗）", () => {
  test("职业下拉在 header 下方展开且不被裁切", async ({ app }) => {
    test.skip(!hasAuth(), "未配置 E2E_USERNAME/E2E_PASSWORD");
    const { page } = app!;
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);

    await page.getByRole("button", { name: "职业" }).first().click();
    await expect(page.getByText("职业画像")).toBeVisible();

    const btnBox = await page.getByRole("button", { name: "职业" }).first().boundingBox();
    const ddBox = await page.locator("header").first().locator("div.glass.absolute").first().boundingBox();
    expect(btnBox).toBeTruthy();
    expect(ddBox).toBeTruthy();
    // 回归：下拉从职业按钮下方展开（原 bug 是被裁到负坐标），且完整可见
    expect(ddBox!.y).toBeGreaterThanOrEqual(btnBox!.y + btnBox!.height - 2);
    expect(ddBox!.y).toBeGreaterThanOrEqual(0);
    const vh = 911;
    expect(ddBox!.y + ddBox!.height).toBeLessThanOrEqual(vh + 2);
  });

  test("添加自定义弹窗相对视口居中", async ({ app }) => {
    test.skip(!hasAuth(), "未配置 E2E_USERNAME/E2E_PASSWORD");
    const { page } = app!;
    await page.goto("/roadmap");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);

    await page.getByRole("button", { name: "自定义主题" }).click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box).toBeTruthy();
    const vw = 1489;
    const vh = 911;
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    expect(Math.abs(cx - vw / 2)).toBeLessThanOrEqual(48);
    expect(Math.abs(cy - vh / 2)).toBeLessThanOrEqual(48);
    // 完全在视口内
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vh);
  });
});
