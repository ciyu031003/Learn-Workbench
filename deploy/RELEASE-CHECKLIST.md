# 发布清单（每次发版照做）

> 起因：v1.32.0–v1.33.0 四个**已上线**版本的源码，在本地工作区躺了一周没进 git（HEAD 停在 v1.31.0/50）。
> 这份清单把"发完版就结束"改成"发完版必须落地"。
>
> 现在的主路径是**一条命令**：`pnpm release --version x.y.z --code N --notes <file> --publish`，
> 它内部依次做：版本一致性 → 构建 APK → 摘要与体积口径 → OTA 清单 → 门户（download.html / mobile-update.json / 二维码）
> → 上传（scp 按目标名落盘 + sha256 传输校验）→ 远端 `sudo cp` → 公网回读。
> 体积口径已从"70MB 硬阈值"改为"**记录 + 超 90MB 仅告警**"；只有"清单 ↔ APK 不一致"才阻断。

## 0. 发版前

- [ ] `pnpm check:release` 通过（版本号四处一致 / 最新 tag 之后没有"版本大于 tag 但工作区脏"）
- [ ] `pnpm typecheck`（7/7）
- [ ] `pnpm test`（web + mobile 全绿）
- [ ] `pnpm test:scripts`（迁移编号 / 内容校验 / 发布卫生 / 索引清单 / API 台账）
- [ ] `node scripts/check-schema-fresh.mjs`（空库收敛）
- [ ] `node scripts/migration-drill.mjs`（回滚演练）
- [ ] `node scripts/check-deps-audit.mjs`（依赖漏洞棘轮）
- [ ] 移动端三门槛：`pnpm -F mobile lint:fontscale && pnpm -F mobile lint:ui-matrix && pnpm -F mobile lint:motion`

## 1. 出包与发布

- [ ] 出包：`scripts/build-android-release.ps1 -VersionName x.y.z -VersionCode N`
      （脚本同步 `build.gradle` / `app.json` / `apps/mobile/package.json` / `ota.ts` 四处版本源）
- [ ] 核验签名：apksigner 签名 MD5 必须是 `3057105285981cc18597a95c1370c147`（与备案一致，不一致禁止发布）
- [ ] 记录 APK 体积 / MD5 / SHA256
- [ ] 发布：`pnpm release --version x.y.z --code N --notes .local/release-notes-vX.txt --skip-build --publish`
      - 已有 APK 就用 `--skip-build`；没构建过就去掉它
      - `--check-only` 只看不改（安全预演）
- [ ] Web 有改动时另走 Web 部署（见下）

## 2. 线上核验（缺一项不算发布完成）

- [ ] `curl -I https://learn.yuanabd.cn/download/learn-workbench-v<ver>.apk` → 200 + Content-Length 与本地一致
- [ ] `curl -s "https://learn.yuanabd.cn/mobile-update.json?t=$RANDOM"` → versionName / versionCode / sha256 / sizeBytes 正确
- [ ] `download.html` 线上含新版本、**旧版本残留 0**、二维码 `?v=` 已更新
- [ ] 二维码 jsQR 解码指向新 APK（`scripts/lib/qr-png.mjs` 的 `decodeQrPng`）
- [ ] 有 Web 改动时：关键接口自测（未登录 401、新路由 200/401 符合预期）

> 以上四条 `pnpm release` 已内置自动回读，但**发布人仍要眼看一遍输出**（脚本只会拦硬指标）。

## 3. 发版后必须落地（历史上就漏在这一步）

- [ ] `git add -A && git commit`（版本号 bump 与代码在同一条线，分批提交也要在推送前收口）
- [ ] `git tag -a v<x.y.z> -m "…"` 并 `git push origin main v<x.y.z>`
- [ ] 门户仓库（`F:\CodeFiles\YuanAbd-Web`）：`git fetch` → 有分叉先 merge/rebase → `git push`
- [ ] 追加 `docs/改动记录与任务看板.md` 的发布取证（APK 哈希 + 线上核验结果 + 回滚方式）
- [ ] `pnpm check:release` 再跑一次，确认"发布版已进 git、远端不落后"

## 4. Web 部署（有 Web 改动时）

- [ ] 打 tar（**排除** `.backup` / `.pnpm-store` / `prototype` / `playwright-report` / `android` / `node_modules` / `.local` / `.env*` / `job-hosts`）
- [ ] scp → 服务器解包 → `docker compose up -d --build`
- [ ] 先跑迁移与结构自检，再切流量（迁移只追加 + 已完成回滚演练）

## 5. 回滚

| 层 | 回滚动作 | 说明 |
|---|---|---|
| OTA | 把门户 `mobile-update.json` 换回上一版 | 停止推送；旧 APK 仍在 `releases/` 里，可直接回链 |
| 门户 | `git revert` 门户仓库的发布提交 | download.html / 二维码一起回退 |
| Web | 重新 scp 上一版 tar → `docker compose up -d --build` | 服务器上不是 git 工作区，只能按包回滚 |
| DB | `db/migrations/down/NNN_*.down.sql` | 已由 `pnpm db:drill` 验证过对象级回滚；数据级回滚需备份（见 RUNBOOK） |
| 功能 | `FEATURE_X=off` 重启 | 优先关开关，不要急着回滚代码（H4 特性开关） |
