# E2E 回归基线（Playwright）

针对 Web 端关键路径的无头回归测试，覆盖历史修复点，防止回归：

| 用例 | 覆盖 |
|---|---|
| `dashboard.spec.ts` | SSR 水合 #418（console 0 error）、顶栏日期、问候语 |
| `roadmap-ict.spec.ts` | ICT 学习规划解锁（自定义入口 + 主题添加/删除闭环） |
| `shell-ui.spec.ts` | 职业下拉不被裁切、添加弹窗视口居中（历史 UI 修复） |
| `tasks-focus.spec.ts` | 专注页加载无 console 错误 / 404 |

## 前置

- 目标站点可用（本地 dev 或已部署服务器）
- 登录凭据：管理员账号（默认 admin），密码通过环境变量提供

## 运行

```bash
cd e2e
cp .env.example .env   # 填入 E2E_BASE_URL / E2E_USERNAME / E2E_PASSWORD
pnpm install
pnpm test:e2e          # 无头
pnpm test:e2e:headed   # 有头调试
```

或从仓库根目录：

```bash
pnpm test:e2e
```

> 未配置凭据时，登录相关用例自动跳过（跳过登录测试无需凭据）。
> 浏览器使用系统 Chrome（channel: chrome），无需下载 Playwright 浏览器；可用 `E2E_CHROME_PATH` 指定可执行文件。

## 服务器实测示例

```bash
E2E_BASE_URL=http://106.55.2.197 E2E_USERNAME=admin E2E_PASSWORD=<密码> \
  E2E_CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" \
  pnpm --filter @learn-workbench/e2e test:e2e
```

## CI（GitHub Actions）

`.github/workflows/ci.yml` 的 `e2e` 作业：docker compose 起全栈（db+init+web，监听
`localhost:3001`）→ `create-admin.mjs` 建测试管理员 → 用 **Playwright 自带 chromium**
（`E2E_BROWSER=chromium`，避免依赖 runner 是否预装 Chrome）跑全部用例 →
失败时上传 `playwright-report` 产物。

- 浏览器下载：install 阶段用 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` 跳过自动下载，
  `playwright install --with-deps chromium` 显式安装（该 env 不影响显式 install）。
- 管理员密码：仓库 Secret `E2E_PASSWORD`，未设置时回退 `ci-e2e-password`（测试环境）。
- 本地/服务器跑 E2E 用系统 Chrome（`E2E_CHROME_PATH` 或 `E2E_CHANNEL=chrome`）。

## 产物

- `test-results/` / `playwright-report/`：失败 trace / 报告（已 gitignore）
- `.auth/user.json`：全局登录 storageState（已 gitignore）
