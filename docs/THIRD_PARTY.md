# THIRD_PARTY — 第三方资源与许可记录

> 规则：**任何**从外部仓库/站点实际复制的代码、SVG、图片、数据、字体、文案，都必须在此登记
> `source / license / version-commit / modified / attribution`。
> 仅「阅读参考、未复制」的项目单独列在文末的「参考未复制」区，便于后续追溯。
>
> 最后更新：2026-09-14（下一阶段 V3 各 Phase 完成后）

---

## 1. 实际复制的资源

| 资源 | 来源 | 许可 | 版本/提交 | 是否修改 | 需署名 |
|---|---|---|---|---|---|
| （无） | — | — | — | — | — |

**结论：V3 各阶段（Phase 1–9）未从任何外部仓库复制代码、图片、字体或数据。**
新增能力均为本项目自行实现：

- 简历渲染（A4 预览 / 多模板 / 分节拖拽 / 打印导出）：自研，未引入 PDF 渲染库；导出走浏览器 `window.print()` + `@media print`。
- 分节拖拽：使用浏览器原生 HTML5 `draggable` + `onDragStart/onDragOver/onDrop`，**未引入 dnd-kit 等第三方拖拽库**。
- 图表/环形进度（Match Ring、营养环、习惯热力图）：项目内自研 SVG/CSS。
- 食物营养种子数据（`db/migrations/041_nutrition.sql` 的 12 项）：常见中式食物的**公开常识性估算值**，非从任何数据库复制。

---

## 2. 参考未复制（仅阅读其领域模型 / 交互思路）

以下项目仅作为**领域与交互参考**，未复制其代码。若将来需要移植任何片段，须先在此登记并完成许可评估。

| 项目 | 用途 | 许可 | 本项目处理 |
|---|---|---|---|
| [Reactive Resume](https://github.com/AmruthPillai/Reactive-Resume) | 简历数据模型（Section 有序化）、实时预览布局、模板注册思路 | MIT | 仅参考设计；渲染器与模板注册表为自研 |
| [wger](https://github.com/wger-project/wger) | Workout / Exercise / Set 三层训练模型、身体数据与饮食领域划分 | AGPL-3.0-or-later（应用代码） | **未复制任何核心代码**；本期只落地「轻量 Workout 记录」（动作/组/次/重量），完整三层编排列为下一阶段 |
| [JobSync](https://github.com/Gsync/jobsync) | 求职流程信息架构（Application → Status → Timeline → Analytics） | — | 仅参考信息架构；本项目求职流程早在迁移 015 已自行实现 |
| Job Tracker 类项目 | Pipeline / 状态筛选 / 看板视图 | — | 仅参考交互；看板与时间线为自研 |
| [BeHabit](https://github.com/) / Ritual | streak、weekly strip、heatmap、One-Tap 打卡交互 | — | 仅参考交互；`habits`/`habit_logs` 表结构与 streak 算法为自研（`computeHabitStats`） |

---

## 3. 依赖清单（由包管理器引入，非复制源码）

| 依赖 | 版本 | 用途 | 许可 | 引入阶段 |
|---|---|---|---|---|
| `@shopify/flash-list` | ^2.3.2 | 移动端长列表回收式虚拟化（职位列表） | MIT | APP P0-4（2026-09-14） |

> 除上表外，V3 与 APP P0 未新增其它运行时依赖；其余能力均在既有依赖（Next 16 / React 19 / Tailwind 4 / zod / pg / lucide-react / expo / reanimated / react-native-gesture-handler 等）范围内实现。
> 新增依赖的许可策略：只接受 MIT / Apache-2.0 / BSD；GPL / AGPL / SSPL 类需先评估，不直接引入。

---

## 4. 复核触发条件

出现以下任一情况时，必须回到本文档登记：

1. 从外部仓库复制代码/SVG/图片/字体/文案；
2. 新增运行时依赖（尤其是 GPL / AGPL / SSPL 类）；
3. 使用外部数据集（职位数据、运动数据、食材营养库等）；
4. 引入字体文件（本仓库当前仅使用系统字体栈，无外部字体 CDN）。