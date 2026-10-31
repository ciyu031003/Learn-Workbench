import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * 三端设计 tokens 一致性棘轮（评审 2026-10-31 P3-18）。
 *
 * 背景：packages/ui 自称「单一事实源」，但 mobile tokens.ts / web globals.css 都是手工
 * 同步，且已经发生漂移却无人知晓。本测试做三件事：
 *  1. web globals.css 必须与 ui tokens 一致（web 是照着 ui 抄的，漂移=抄错）；
 *  2. mobile 的 primary 必须与 ui 一致（品牌主色不允许分叉）；
 *  3. mobile 的已知刻意漂移项进入显式例外清单——**新增漂移会让本测试红**，
 *     届时要么改回，要么有意识地往清单里加并写明原因。
 *
 * 实现按文本正则取值（不 import mobile 模块，避免拉 react-native 进 web 测试环境）。
 */

const REPO = path.resolve(__dirname, "../../..");

/** 十六进制色值归一（大写、#开头） */
const norm = (v: string) => v.trim().toUpperCase().replace(/^#?/, "#");

function readJsonLikeHex(source: string, key: string): string | null {
  const m = new RegExp(`${key}\\s*:\\s*["'](#?[0-9a-fA-F]{6})["']`).exec(source);
  return m ? norm(m[1]) : null;
}

function readCssVar(source: string, name: string): string | null {
  const m = new RegExp(`--color-${name}\\s*:\\s*(#?[0-9a-fA-F]{6})\\s*;`).exec(source);
  return m ? norm(m[1]) : null;
}

const uiSource = readFileSync(path.join(REPO, "packages/ui/src/index.ts"), "utf8");
const cssSource = readFileSync(path.join(REPO, "apps/web/app/globals.css"), "utf8");
const mobileSource = readFileSync(path.join(REPO, "apps/mobile/src/theme/tokens.ts"), "utf8");

/**
 * mobile 刻意漂移的键（浅色档）：v1.x「暖柔象牙白」系列在移动端单独调过色。
 * 往这里加条目必须有理由（写在该键后面）。
 */
const MOBILE_INTENTIONAL_DRIFT = new Set([
  "accent", // 移动端 #F28C28：比 ui 的 #e1781c 更亮，深色底上对比度更好（v1.36 调色）
  "accentStrong", // #D97411：随 accent 调整
  "primaryStrong", // #255FA8：移动端按压态更深
  "canvas", // #F7F5F2：移动端画布比 ui oilPainting.canvas #fdf8ef 更中性
]);

describe("三端 tokens 一致性（棘轮）", () => {
  const ui = {
    primary: readJsonLikeHex(uiSource, "primary"),
    accent: readJsonLikeHex(uiSource, "accent"),
  };
  const web = {
    primary: readCssVar(cssSource, "primary"),
    accent: readCssVar(cssSource, "accent"),
  };
  // mobile tokens.ts 浅色档（正则取首个匹配 = lightColors 段；暗色档在文件更后）
  const mobile = {
    primary: readJsonLikeHex(mobileSource, "primary"),
    accent: readJsonLikeHex(mobileSource, "accent"),
    primaryStrong: readJsonLikeHex(mobileSource, "primaryStrong"),
    accentStrong: readJsonLikeHex(mobileSource, "accentStrong"),
    canvas: readJsonLikeHex(mobileSource, "canvas"),
  };

  it("web globals.css 与 ui tokens 一致（primary/accent）", () => {
    expect(web.primary).toBe(ui.primary);
    expect(web.accent).toBe(ui.accent);
  });

  it("mobile 品牌主色与 ui 一致（primary 不分叉）", () => {
    expect(mobile.primary).toBe(ui.primary);
  });

  it("mobile 已知刻意漂移键必须在例外清单内；未漂移键必须与 ui 一致", () => {
    // 当前实际漂移的键
    const drifted = Object.entries(mobile)
      .filter(([, v]) => v !== null)
      .filter(([k, v]) => (ui as Record<string, string | null>)[k] !== v)
      .map(([k]) => k);
    const unknown = drifted.filter((k) => !MOBILE_INTENTIONAL_DRIFT.has(k));
    expect(
      unknown,
      `mobile 出现未登记的 tokens 漂移：${unknown.join(", ")}。要么改回与 ui 一致，` +
        `要么在 MOBILE_INTENTIONAL_DRIFT 登记并写明原因`
    ).toEqual([]);
    // 例外清单里的键必须真的在漂移（清单失效了就删掉条目）
    const stale = [...MOBILE_INTENTIONAL_DRIFT].filter((k) => !drifted.includes(k));
    expect(stale, `例外清单已失效（这些键已与 ui 一致）：${stale.join(", ")}`).toEqual([]);
  });
});
