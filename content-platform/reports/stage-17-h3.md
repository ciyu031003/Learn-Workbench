# 阶段 17 汇报：安全纵深与权限（组三 · H3）

- **ADR**：ADR-004
- **日期**：2026-10-11
- **提交**：`47a89db`

## 发现

- 权限只有一个布尔 `users.is_admin`（`apps/web/lib/auth.ts:23`），受限操作无审计留痕；
- **命令执行级风险**（`scripts/crawl_content_source.mjs`）：
  `execFileSync("git", ["clone", url, …])` 的 `url` 来自 `content_source.url`，
  git 支持 `ext::` 传输 → 诱饵 URL 可直接转成命令执行；`--ref` 可传 `--upload-pack=/tmp/evil.sh` 被当选项；
- 读文件走 `path.join(repoDir, rel)`，`rel` 来自客户端可控的 `items[].path`，无穿越校验。

## 改动

- `db/migrations/065_roles_and_audit.sql`（+ `down/`）：`users.role`（learner/editor/reviewer/admin，
  `is_admin=true` 回填 admin 并继续被 `roleOf` 视为 admin）+ `audit_log` 表（4 个索引）；
- `apps/web/lib/roles.ts`（未知用户/脏数据 → learner）、`apps/web/lib/audit.ts`（best-effort，`required` 可硬失败）；
- `internal-guard` 增加 `allowRoles` + 会话通道，`content.import` / `content.import.rollback` / `content.sync` 全部写审计；
- `scripts/lib/content-source.mjs`：`assertSafeRepoUrl`（https + GitHub 宿主白名单、拒内网与内嵌凭据）、
  `assertSafeGitRef`（拒 `-` 开头、`..`、空格）、`assertSafeRelativePath`（拒穿越/绝对路径）；
  `runGit` 统一加 `GIT_ALLOW_PROTOCOL=https` + `GIT_TERMINAL_PROMPT=0`；
- `content-platform/security/checklist.md`、ADR-004。

## 验证

```bash
node --test scripts/lib/content-source-security.test.mjs   # 6 例：ext:: / file:// / 内网 IP / 选项注入 / 穿越
pnpm --filter web exec vitest run lib/roles.test.ts lib/audit.test.ts lib/internal-guard.test.ts
```

共 29 例通过（roles 9 / audit 6 / guard 5 / source-security 6 / audit-wiring 3）。

## 风险

- 生产库需手动补跑 065；`role` 与 `is_admin` 双轨期要保证写入方都维护 `role`（当前只有 `create-admin.mjs` 与 SQL）；
- 审计 best-effort：审计表故障时业务仍成功，此时审计只存在于 ERROR 日志（可用性优先的取舍，已在 ADR 记录）；
- 会话通道的 kill switch 是环境变量（需重启），不是热开关。

## 下阶段

H4：CI/CD 门禁补强。
