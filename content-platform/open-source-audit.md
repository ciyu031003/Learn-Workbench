# Phase 3 开源项目准入结论

机读记录在 `content-platform/open-source-audit.json`，复核命令：

```bash
pnpm audit:sources
pnpm audit:sources -- --online
```

## 决策表

| 项目 | 许可证 | 活跃度（GitHub 最近 push） | 决策 | 复用边界 |
|---|---|---|---|---|
| learn-from-materials | MIT | 2026-10-07 | 适配小模块 | 来源定位、覆盖/质量报告、材料事实与生成内容分层 |
| Exameow | Apache-2.0 | 2026-10-06 | 适配小模块 | 题型状态机、导入/审核流程；不嵌入 Tauri/Vue 或 AI runtime |
| Aether | NOASSERTION | 2026-09-13 | 只借鉴 | 阅读/回忆分离和前置知识图的产品思路；不复制源码 |
| learning-platform | MIT | 2026-08-28 | 只借鉴 | 课程包 schema 思路；低维护信号 + 紧耦合 webapp，不直接抽取 |
| Moodle | GPL-3.0 | 2026-10-13 | 只借鉴 | Moodle XML/GIFT/question-engine 文档思路；不复制 GPL 代码 |
| Examination-System | MIT | 2026-10-09 | 适配小模块 | 零运行时依赖的考试进度、错题复习、导入导出校验 |

## 依赖与安全检查结论

- `learn-from-materials` 的运行时前提是 Python 3.10+，Node/Playwright 仅用于验证；它没有 npm 运行时依赖，适合只借流程。
- `Exameow` 体量最大，包含 Vue/Vite/Tauri、PDF/OCR 与 Rust 工作区；依赖面远大于当前题目导入需求，因此只适配独立模块。
- `Aether` 的许可证不是标准可再分发许可证，且使用 CDN 资源；不允许复制源码，只借鉴产品结构。
- `learning-platform` 带有 Prisma、SQLite、Next.js 和 `ts-fsrs`；技术栈相近但仓储维护信号弱，暂不引入。
- `Moodle` 是 PHP + 大量 Composer/npm 依赖的完整 LMS，GPL-3.0 复制会扩大分发义务；只引用公开文档和格式概念。
- `Examination-System` 没有运行时依赖，代码量最小；适合抽取小型纯函数和交互模式，仍须逐模块加测试后接入。

## 明确不采用

- 不把任何候选项目整体嵌入 Learn-Workbench。
- 不复制 408 站点的正文或题目到 git；来源站仍按 `personal-study`、不再分发处理。
- 不因“代码许可允许”就默认题库内容许可也允许。
