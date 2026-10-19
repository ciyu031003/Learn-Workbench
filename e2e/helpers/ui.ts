import type { Locator, Page } from "@playwright/test";

/**
 * S6-9 本地 dev 服务器兼容：Next dev 首次访问每个路由要现场编译客户端 chunk，
 * 并行开发时可能 10-30s 才可交互（生产构建没有这个问题）。
 *
 * 这层“导航 + 就绪等待 + 失败重载”只增加稳定性，不放宽断言：
 * 每次尝试都必须真正看到就绪元素，重试仍失败就照常 fail。
 */
export interface GotoRetryOptions {
  attempts?: number;
  timeoutPerTry?: number;
  waitUntil?: "domcontentloaded" | "load" | "networkidle";
}

export async function gotoWithRetry(
  page: Page,
  path: string,
  ready: Locator,
  opts: GotoRetryOptions = {}
): Promise<void> {
  const attempts = opts.attempts ?? 3;
  const timeoutPerTry = opts.timeoutPerTry ?? 30_000;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: opts.waitUntil ?? "domcontentloaded" });
      await ready.waitFor({ state: "visible", timeout: timeoutPerTry });
      return;
    } catch (e) {
      lastError = e;
      console.warn("[e2e][retry] " + path + " 第 " + attempt + "/" + attempts + " 次未就绪（dev 编译慢？）：" + (e instanceof Error ? e.message.split("\n")[0] : String(e)));
      if (attempt < attempts) await page.waitForTimeout(1500);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
