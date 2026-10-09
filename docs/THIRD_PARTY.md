# THIRD_PARTY — 第三方资源与许可记录

> 规则：**任何**从外部仓库/站点实际复制的代码、SVG、图片、数据、字体、文案，都必须在此登记
> `source / license / version-commit / modified / attribution`。
> 仅「阅读参考、未复制」的项目单独列在文末的「参考未复制」区，便于后续追溯。
>
> 最后更新：2026-09-18（APP 端 v6：崩溃修复 / 食物营养库 / MD 导入）

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
- 自建食物营养库（`scripts/data/food-builtin.json`，v6 P1-3）：108 条常见中餐/食材的**每 100g 参考值**，本项目自行整理（license 标记为 `own`），非从任何受版权保护的数据库复制。

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

## 2.5 外部数据集（**运行时导入，不进仓库**）

v6 P1-3 的食物营养库支持从公开数据源导入（`scripts/import_food_db.mjs`）。
**导入的数据落在数据库 `food_items` 表，不进入 git 仓库**；下表登记许可与义务：

| 数据源 | 导入方式 | 许可 | 义务 | 本项目处理 |
|---|---|---|---|---|
| [Open Food Facts](https://world.openfoodfacts.org/) | `--source=off`（搜索 API） | **ODbL 1.0**（开放数据库许可） | 署名 + 衍生数据库同许可开放 | 导入行在 `food_items.license` 标 `ODbL-1.0`；App/文档标注来源与许可；用户自建数据（`foods` 表）不受影响 |
| [USDA FoodData Central](https://fdc.nal.usda.gov/) | `--source=usda`（需 `USDA_API_KEY`） | **CC0 1.0**（公有领域） | 无（建议标注来源） | `food_items.license = 'CC0-1.0'` |
| 自建中餐库（本仓库 `scripts/data/food-builtin.json`） | `--source=builtin`（默认） | 自有 | 无 | `license = 'own'` |

**明确不采用**：《中国食物成分表（第6版）》及其社区 OCR 衍生 JSON（如 `Sanotsu/china-food-composition-data`，仓库无 license，原书版权属中国 CDC 营养与健康所）——**版权风险，不进仓库、不入库**。
（2026-09-18 用户决策：只使用公开/可商用数据源。）

---

## 2.6 第一方素材与代码（sports-cards → 运动闪光卡 v10）

来源：`E:\Codex_output_files\sports-cards`（**用户自己的 AI 生成工程**，7 个球类的全息卡牌 demo）。

| 内容 | 用途 | 许可 | 本项目处理 |
|---|---|---|---|
| `app.js` 的 three.js 镭射着色器与交互（front/edge/back 三段） | Web 三维闪光卡 | 第一方（自有） | 移植进 `apps/web/components/holo/holo-sport-card.tsx`；**卡面文字层重写**（源 `text.png` 是印死的 demo 数据，未采用） |
| `<sport>/web/assets/card.glb` | 卡体模型 | 第一方 | 7 项运动 MD5 相同 → 只留一份 `apps/web/public/holo/card.glb` |
| `<sport>/web/assets/{subject,background,lineart}.png`（1728×2368） | 双端卡面贴图 | 第一方 | `scripts/build-holo-assets.mjs` 压成 WebP 入库：Web 1152 宽 5.12MB / 移动端 896 宽 3.32MB |
| gallery（`index.html`/`gallery-*`/`sports.json`）、`build_*.py`、`server.mjs`、`validate_glb.mjs`、`node_modules` | — | — | **未采用**（只取闪光卡片本体） |

> 素材与代码均为第一方生成内容，无第三方版权义务；运行时依赖 `three`（MIT）是 v8 已引入的既有依赖。

---

## 2.7 学习 2.0 技术题库 v1（2026-10-09）

首版固定收录 Python、Java、SQL 与数据分析、Power BI 四个技术方向；v1.38 起扩充 JavaScript、Linux 运维和 AI 应用工程，并为已有路线补充题库。路线、题目、解释、练习和验收标准均按本项目数据结构重新编写；第三方仓库只用于确认学习范围、知识主题和学习方法，不整段复制 README、课程正文或题库文本。

| 资源 | 来源 | 许可证 | 使用方式 | 本项目处理 |
|---|---|---|---|---|
| Exercism Python | https://github.com/exercism/python | MIT | 结构化导入 | 参考测试驱动练习与概念学习顺序；题目为二次编写 |
| TheAlgorithms/Python | https://github.com/TheAlgorithms/Python | MIT | 结构化导入 | 参考数据结构、算法与代码示例范围 |
| Microsoft Data Science for Beginners | https://github.com/microsoft/Data-Science-For-Beginners | MIT | 结构化导入 | 参考 Pandas、数据清洗、可视化与项目学习路径 |
| TheAlgorithms/Java | https://github.com/TheAlgorithms/Java | MIT | 结构化导入 | 参考集合、算法和数据结构主题 |
| Java Design Patterns | https://github.com/iluwatar/java-design-patterns | MIT | 结构化导入 | 参考设计模式、重构和对象协作主题 |
| Tech Interview Handbook | https://github.com/yangshun/tech-interview-handbook | MIT | 结构化导入 | 参考算法、工程实践和面试知识组织方式 |
| Microsoft PL-300 Power BI Data Analyst | https://github.com/MicrosoftLearning/PL-300-Microsoft-Power-BI-Data-Analyst | MIT | 结构化导入 | 参考 Power BI 学习阶段与能力目标 |
| Power BI Desktop Samples | https://github.com/microsoft/powerbi-desktop-samples | MIT | 结构化导入 | 参考语义模型、DAX、报表与项目练习范围 |
| freeCodeCamp | https://github.com/freeCodeCamp/freeCodeCamp | BSD-3-Clause | 结构化导入 | 参考 JavaScript 练习顺序、测试驱动和项目组织方式 |
| TheAlgorithms/JavaScript | https://github.com/TheAlgorithms/JavaScript | MIT | 结构化导入 | 参考 JavaScript 算法、数据结构与示例范围 |
| MDN Web Docs | https://github.com/mdn/content | CC BY-SA 2.5 | 仅外链参考 | 参考浏览器 API 与 JavaScript 语义，不复制正文，避免 ShareAlike 传染 |
| TheAlgorithms/Shell | https://github.com/TheAlgorithms/Shell | MIT | 结构化导入 | 参考 Shell 文本处理与自动化练习主题 |
| The Art of Command Line | https://github.com/jlevy/the-art-of-command-line | CC BY-NC-SA 4.0 | 仅外链参考 | 只参考命令行学习和排障方法，不复制正文 |
| Generative AI for Beginners | https://github.com/microsoft/generative-ai-for-beginners | MIT | 结构化导入 | 参考生成式 AI、RAG 与安全主题的学习顺序 |
| OpenAI Cookbook | https://github.com/openai/openai-cookbook | MIT | 结构化导入 | 参考结构化输出、检索、评测与工程实践 |
| LangGraph | https://github.com/langchain-ai/langgraph | MIT | 结构化导入 | 参考有状态 Agent、工作流与人工确认设计 |
| advanced-java | https://github.com/doocs/advanced-java | CC BY-SA 4.0 | 仅外链参考 | 不复制正文或题库，避免 ShareAlike 传染到本项目内容 |
| Data Engineering Zoomcamp | https://github.com/DataTalksClub/data-engineering-zoomcamp | 未识别 | 仅外链参考 | 未确认可再分发许可证，不导入内容 |
| System Design Primer | https://github.com/donnemartin/system-design-primer | CC BY 4.0 | 仅外链参考 | 首版保持保守处理，只做延伸阅读入口 |

**内容事实源**：`packages/content/src/learning/`。每条路线包含分类、阶段目标、验收标准、学习方法、核心概念、原理、应用、误区、练习、掌握标准、题目、答案、解释和逐题 `sourceKey`。

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
---

## 5. 外部 UI 元素参考（只借技法，不复制源码）

| 来源 | 许可 | 用途 | 引入阶段 |
|---|---|---|---|
| [Uiverse.io](https://uiverse.io/) / 归档仓 [uiverse-io/galaxy](https://github.com/uiverse-io/galaxy) | MIT（README 明确 "available under the MIT License"） | 交互技法参考：骨架扫光、conic 进度环、按钮按压/长按确认、浮动标签输入、上传卡、勾选描边动画、日夜开关、成就卡、Toast 倒计时条、几何底纹 | v13（2026-09-21 方案，待确认后动工） |

- 逐条作者与落点：`docs/第三方UI来源与署名.md`；改造项与批次：`docs/Web与移动端优化方案-v13-Uiverse参考.md`。
- 约定：**不整段拷贝元素源码**；只用其技法（缓动曲线、遮罩/描边画法、构图），颜色/圆角/字体一律走本项目 token；对应代码注释保留 `// 技法参考: uiverse.io/<作者>/<元素> (MIT)`。
