import { test as base } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import { AUTH_FILE, hasAuth } from "./auth";
import { attachConsole, type Collector } from "./collect";

// app fixture：已登录上下文 + console 收集器；未配置凭据时返回 null（测试内 test.skip）
export const test = base.extend<{ app: { page: Page; collector: Collector } | null }>({
  app: async ({ browser }, use) => {
    if (!hasAuth()) {
      await use(null);
      return;
    }
    const context = await (browser as Browser).newContext({ storageState: AUTH_FILE });
    const page = await context.newPage();
    const collector = attachConsole(page);
    await use({ page, collector });
    await context.close();
  },
});
export { expect } from "@playwright/test";
