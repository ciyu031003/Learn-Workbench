import { test, expect } from "../helpers/fixture";
import { credentials, newAuthedApi, NO_CREDENTIALS_REASON } from "../helpers/api";
import { gotoWithRetry } from "../helpers/ui";
import { probeServer } from "../helpers/server";

/**
 * S6-9：公开分享页的“有数据”分支（对照已有的空态用例）。
 *
 * 流程：
 *  1. 用登录态 API 写入一份公开运动档案（badminton，含战绩/绝技，幂等 upsert）；
 *  2. 匿名浏览器访问 /share/sport/<shareSlug>：应渲染数据分支（不是“档案不存在或未公开”）；
 *  3. 对照：随机 slug → 空态；
 *  4. 取消公开 → 同一 slug 回到空态（同时完成清理，避免测试污染）。
 */
interface SportProfile {
  id?: number;
  shareSlug?: string | null;
  isPublic?: boolean;
}

test.describe("S6-9 分享页（有数据 vs 空态）", () => {
  test("公开档案匿名可见并渲染战绩；取消公开后回到空态", async ({ browser, request }) => {
    const probe = await probeServer(request);
    test.skip(!probe.ok, probe.reason);

    test.setTimeout(150_000);
    const creds = credentials();
    if (!creds) {
      console.warn("[e2e][skip] " + NO_CREDENTIALS_REASON);
      test.skip(true, NO_CREDENTIALS_REASON);
      return;
    }

    const api = await newAuthedApi();
    try {
      // 1) 建/更新一份公开档案（同 sportKey 幂等，不会跨用例堆数据）
      const base = {
        sportKey: "badminton",
        identity: "S6-9 分享回归",
        levelText: "业余 4 级",
        matchesPlayed: 10,
        wins: 6,
        losses: 4,
        signatureMove: "滑板吊球",
      };
      const up = await api.post("/api/sports/profiles", { data: { ...base, isPublic: true } });
      expect(up.status(), await up.text()).toBe(201);
      const profile = (await up.json()).profile as SportProfile;
      expect(profile.shareSlug, "公开档案应返回 shareSlug（分享短链）").toBeTruthy();
      const slug = String(profile.shareSlug);

      const context = await browser.newContext();
      try {
        const page = await context.newPage();

        // 2) 匿名访问：数据分支
        const identityHeading = page.getByRole("heading", { name: "S6-9 分享回归" });
        await gotoWithRetry(page, "/share/sport/" + encodeURIComponent(slug), identityHeading, { attempts: 3, timeoutPerTry: 40_000 });
        await expect(page.getByText("Public", { exact: false })).toBeVisible();
        await expect(identityHeading).toBeVisible();
        await expect(page.getByText("羽毛球档案", { exact: true })).toBeVisible();
        await expect(page.getByText("10 场", { exact: true })).toBeVisible();
        await expect(page.getByText("6 / 4", { exact: true })).toBeVisible();
        await expect(page.getByText("滑板吊球", { exact: true })).toBeVisible();
        await expect(page.getByText("档案不存在或未公开")).toHaveCount(0);

        // 3) 对照：随机 slug → 空态
        await page.goto("/share/sport/s6-9-missing-" + Date.now());
        await expect(page.getByText("档案不存在或未公开")).toBeVisible();

        // 4) 取消公开 → 同一 slug 回到空态
        const off = await api.post("/api/sports/profiles", { data: { sportKey: "badminton", identity: "S6-9 分享回归", isPublic: false } });
        expect(off.status()).toBe(201);
        await page.goto("/share/sport/" + encodeURIComponent(slug));
        await expect(page.getByText("档案不存在或未公开")).toBeVisible();
      } finally {
        // 兜底清理：即使断言失败也把档案设为私密
        await api.post("/api/sports/profiles", { data: { sportKey: "badminton", identity: "S6-9 分享回归", isPublic: false } }).catch(() => undefined);
        await context.close();
      }
    } finally {
      await api.dispose();
    }
  });
});
