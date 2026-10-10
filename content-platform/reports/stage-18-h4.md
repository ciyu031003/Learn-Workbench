# 阶段 18 汇报：CI/CD 交付补强（组三 · H4）

- **ADR**：无（沿用 ADR-003/ADR-004 的门禁口径）
- **日期**：2026-10-11
- **提交**：`d12256c`

## 发现

- `.github/workflows/ci.yml` 的 quality job 只有 lint/typecheck/test/build + Playwright E2E；
- **覆盖率阈值早就写在 `vitest.config.ts` 里，但从未被执行**：
  `pnpm test` 不带 `--coverage`，而根 `test:coverage`（`vitest run --coverage`）在工作区模式下解析 `@` 别名失败（99 个测试文件报 `Cannot find package '@/config'`）；
- 实测覆盖率远低于配置阈值：web 79.85/68.22/74.77/82.65，mobile 64.84/60.05/64.04/65.89；
- `pnpm audit` 现状 53 条（4 critical / 33 high / 15 moderate / 1 low）——硬门禁会长期红着。

## 改动

- `ci.yml`：quality job 加 Postgres service，新增四步
  `check-schema-fresh` / `migration-drill` / `check-deps-audit` / `test:coverage`（timeout 20→35 分钟）；
- 覆盖率阈值改为**棘轮**（web 79/68/74/82、mobile 64/60/64/65 = 实测下取整再降 1 点），根 `test:coverage` 改为 `pnpm -r test:coverage`；
- `scripts/check-deps-audit.mjs` + `content-platform/security/deps-baseline.json`：口径改为「只许变少」，新增漏洞按指纹列出；
- `apps/web/lib/flags.ts` + `ai_tip` / `internal_content_web` 两个 kill switch；
- `deploy/ENVIRONMENTS.md`（环境矩阵 + 变量清单 + 灰度流程）、`deploy/RELEASE-CHECKLIST.md`（发布/回滚清单）。

## 验证

```bash
node scripts/check-deps-audit.mjs     # 未超过基线 ✔（{info:0,low:1,moderate:15,high:33,critical:4}）
pnpm -r test:coverage                 # web / mobile 均通过棘轮阈值
pnpm --filter web exec vitest run lib/flags.test.ts
```

## 风险

- 棘轮阈值只拦"往回退"，不驱动提升；覆盖率的真实提升要靠后续阶段专门补测试；
- 依赖漏洞 4 critical/33 high 仍是**未偿债务**，只是被登记为基线（升级 next/sharp 等属独立工作量）；
- `ci.yml` 的 Postgres service 让 quality job 变慢（+DB 步骤），但换来"门禁真的会跑"。

## 下阶段

H5：可观测与备份。
