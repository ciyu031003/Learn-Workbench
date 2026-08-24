import type { Page } from "@playwright/test";

export interface Collector {
  errors: string[];
  failed: string[];
  clear(): void;
}

// 收集 console error / pageerror / 请求失败 / 4xx 文档响应
export function attachConsole(page: Page): Collector {
  const state: Collector = {
    errors: [],
    failed: [],
    clear() {
      this.errors.length = 0;
      this.failed.length = 0;
    },
  };
  page.on("console", (m) => {
    if (m.type() === "error") state.errors.push(m.text());
  });
  page.on("pageerror", (e) => state.errors.push("PAGEERROR: " + e.message));
  page.on("requestfailed", (r) => state.failed.push("FAILED: " + r.url()));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.request().resourceType() === "document") {
      state.failed.push("HTTP" + r.status() + ": " + r.url());
    }
  });
  return state;
}

export function hasHydrationError(errors: string[]): boolean {
  return errors.some((e) => /hydration|Text content does not match|did not match/i.test(e));
}
