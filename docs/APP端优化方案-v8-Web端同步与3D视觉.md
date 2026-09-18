# APP 端 v8 —— Web 端功能同步 + Web 更强的视觉表现（含 three.js 3D）

> 状态：**已执行（2026-09-18 深夜）**。本轮落地：Web 健康页 3D 状态球 hero + 四项分解 + 本周概览、3D 水杯、设置页分组快捷入口、饮食页食物营养库搜索 + 按克录入；并把「今日状态分」口径收敛到 `packages/shared`（Web/APP 同源）。
> 依赖：新增 `three@^0.186`（+ `@types/three` 开发依赖）；three 走 `useEffect` 内动态 import，构建后确认在**异步 chunk**（720KB 未压缩，不在 prerender HTML，也不在 `app-build-manifest.json`）。
> 验证：web typecheck 0 / lint 0 / **1064 测试** / `pnpm -F web build` 通过；mobile typecheck 0 / lint 0 / 281 测试（readiness 改为 shared 薄封装后仍全绿）。
> 前置：v6（食物营养库 / 训练 UI / MD 导入）、v7（我的页分组卡片 / 健康三层）。

---

## 0. 对账：APP 已有、Web 尚未落地的部分

| # | 功能 | APP 状态 | Web 现状 | 本轮 |
| --- | --- | --- | --- | --- |
| 1 | **食物营养库**：模糊搜索（字符覆盖率，`鸡旦→鸡蛋`）+ 模糊命中 + 按克录入（选食物 → 填 600g → 服务端按基准量换算） | v6 已上线 | **API 已有**（`GET /api/foods/search`、`POST /api/nutrition` 支持 `foodItemId+grams`），但 **Web 页面没接** | **P1** |
| 2 | **餐次感知的常用食物**（早餐先出早餐常吃的） | v6 已上线 | 服务端参数已支持，Web 未用 `meal=` | **P1** |
| 3 | **「我的」页分组卡片**（5 组 + 语义色图标 + 右侧值/箭头） | v7 已上线 | `/settings` 仍是平铺 Card 堆叠 | **P2** |
| 4 | **健康模块三层**（状态分解条 / 今日动作卡 / 趋势入口） | v7 已上线 | `/wellbeing` 是平铺 Card（饮水/精力/休息/运动/分布/建议…） | **P3** |
| 5 | 训练记录「分类大卡 + ± 分离」 | v6 已上线 | `/wellbeing/workout` 仍旧版表单 | P4（下批） |
| 6 | 学习页 MD 导入 | v6（Web 已同步） | ✅ 已具备 | — |

---

## 1. Web 端「更夸张」的视觉方案

Web 与手机端定位不同：屏幕更大、性能更足、可以承担更强的视觉表达。规则：**夸张只用在与「今天的状态/身体」直接相关的地方**，表单与配置页保持克制可读。

| 手段 | 落地位置 | 说明 |
| --- | --- | --- |
| **three.js 3D 状态球** | `/wellbeing` hero | 顶点扰动的二十面体：扰动幅度/主色随**今日状态分**变化（低分更皱、高分更圆润），缓慢自转；鼠标视差 |
| **three.js 3D 水杯** | `/wellbeing` 饮水卡 | 圆柱玻璃 + 液面圆盘 + 正弦波纹（液位=完成度），水位上升/下落有缓动 |
| CSS 渐变光斑 + 大字号 | 页面头部 | `page-title` 升级为渐变文字 + 呼吸光晕（复用 `globals.css` 的 Ambient Glow keyframes） |
| 卡片悬浮/玻璃 | 分组卡片 | `hover` 抬升 + 顶部 1px 高光 + `backdrop-blur`（沿用现有 `.glass` 体系） |
| 数字滚动 | 关键数值 | 复用 `d3-interpolate`（已在依赖里）做 400ms 计数动画 |
| 分解条 | 健康 hero | 四项（任务/习惯/训练/饮食）渐入 + 达标变绿 |

### 技术选型（为什么是「裸 three.js」而不是 R3F）

| 方案 | 依赖 | 取舍 |
| --- | --- | --- |
| **裸 `three`（采用）** | +1 依赖（^0.186，约 600KB gzip，**动态 import 懒加载**） | 不需要 react-reconciler；渲染循环完全可控；IntersectionObserver 暂停、reduced-motion 单帧、`dispose` 清理都好写；失败面最小 |
| `@react-three/fiber` + `drei` | +2~3 依赖（drei 体积大） | 声明式更省代码，但对 React 19 / Next 16 的版本匹配风险、首包更大；本轮收益不值 |

**工程约束（必须满足）**
1. 组件 `"use client"` + `next/dynamic`（`ssr: false`）挂载；three 本体在 `useEffect` 里 `await import("three")`，**不进首包**；
2. `prefers-reduced-motion` → 只渲染一帧静态图；
3. 离屏（IntersectionObserver）暂停 RAF；页面隐藏（`visibilitychange`）暂停；
4. 卸载时 `cancelAnimationFrame` + `geometry/material/renderer.dispose()`（StrictMode 双挂载安全）；
5. WebGL 不可用（`canvas.getContext('webgl2'||'webgl')` 为空）→ 回落**纯 CSS 渐变球**，不报错、不留白；
6. 任何 3D 组件都不阻塞首屏：先渲染 CSS 占位（同尺寸），3D 就绪后淡入。

---

## 2. 实施清单（文件级）

### P1 Web 饮食页接入营养库
- `apps/web/app/wellbeing/nutrition/page.tsx`：新增「搜索营养库」输入（300ms 防抖 + 请求序号守卫）→ 结果列表（`每 100g · N kcal`）→ 选中后输入**实际克数**（快捷 100/200/300/500）→ 实时预览（`scaleFoodByAmount`，shared）→ 提交 `{ foodItemId, grams }`；
- 常用食物列表带 `?meal=` 参数（按当前选中餐次推荐）；
- 与既有表单并存：手动录入保留为兜底。

### P2 Web「我的」页分组卡片
- `apps/web/app/settings/page.tsx`：把平铺 Card 收进 5 组（账号 / 学习与数据 / 外观与体验 / 支持 / 关于），新增 `components/ui/section-label.tsx`；
- 新增「快捷入口」行（领域管理 / 领域记录 / 习惯 / 饮食 / 训练 → 对应页面），与 APP 的我的页一致；
- 保留既有能力（专注页背景、外观、数据与备份、云同步、招聘爬虫配置）不动，只重排与套壳。

### P3 Web 健康 Hub 三层 + 3D
- `apps/web/components/three/state-orb.tsx`（3D 状态球）、`apps/web/components/three/water-glass-3d.tsx`（3D 水杯）；
- `apps/web/app/wellbeing/page.tsx`：hero（3D 球 + 状态分 + 四项分解条 + 本周概览）→ 今日动作（饮水 3D / 运动 / 精力 / 体重）→ 趋势与档案（分布 / 建议 / 历史）；
- 数据沿用现有接口（`/api/daily`、`/api/wellbeing/*`），不新增后端。

### 验证与发布
- `pnpm -F web typecheck / lint / test`；`pnpm -F web build`（确认 three 被拆成异步 chunk，首包不涨）；
- 部署：tar → scp → 解包 → `docker compose up -d --build`（无迁移）；线上自检 `/wellbeing`、`/settings`、`/api/foods/search`。

---

## 3. 风险与回退

| 风险 | 回退 |
| --- | --- |
| three 让首包变大 | three 只在 `useEffect` 里动态 import，构建后检查 `.next` chunk 列表，确认它不在 `app/wellbeing/page` 的首包 |
| 低端机/无 WebGL 白屏 | 组件级 `WEBGL` 探测 → CSS 渐变球占位；`prefers-reduced-motion` 单帧 |
| 3D 抢占主线程 | 限制 `devicePixelRatio ≤ 2`、几何体 ≤ 2 万三角面、离屏暂停 |
| 视觉过火影响可读性 | 夸张只用于 hero 与饮水卡；表单/列表保持现有克制样式 |

