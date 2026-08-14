# 学习工作台前端设计改版方案

> 目标：从「液态玻璃 · 暖调黄昏」转向「简约大气 · 壁纸优先」
> 项目：Learn-Workbench (apps/web)
> 日期：2026-08-14

---

## 一、当前前端设计框架诊断

### 1.1 技术栈与架构

| 层 | 技术 | 关键文件 |
|---|---|---|
| 框架 | Next.js 16 (App Router) + React 19 + TypeScript | `app/layout.tsx`, `app/page.tsx` |
| 样式 | Tailwind CSS v4 + CSS Variables | `app/globals.css` |
| 组件 | 自建 UI（Radix UI + class-variance-authority） | `components/ui/*` |
| 状态 | Zustand (persist 中间件) | `store/ui-store.ts`, `store/focus-bg-store.ts` |
| Monorepo | pnpm + Turborepo | `packages/shared`(数据模型), `packages/ui`(跨端 tokens) |
| 图标 | lucide-react | — |

### 1.2 当前视觉风格：Liquid Glass（液态玻璃 · 暖调黄昏）

- **配色**：底色 `#f6f3ee` 暖米白 / 主色 `#e8930c` 琥珀橙 / 强调 `#ef6a5e` 珊瑚红
- **玻璃拟态**：`backdrop-filter: blur(24px) saturate(1.8)` + 135° 渐变高光边框 + 内高光 + 外阴影
- **环境光斑**：3 个大型模糊光斑（橙/红/黄），30–42s 缓慢漂移
- **每日壁纸**：Bing 壁纸全屏铺底 + `from-black/25 to-orange-950/35` 渐变遮罩 + 径向暖光 + 光斑叠加；canvas 采样亮度自动切换深浅字
- **布局**：桌面左侧栏 w-64 + 主区 max-w-6xl；移动端顶栏+底栏
- **动效**：页面错峰淡入、卡片 hover 上浮、路线图卡片悬浮摆动

### 1.3 核心问题（对照「简约大气」目标）

1. **视觉层数过载**：壁纸 + 渐变遮罩 + 径向暖光 + 3 个漂移光斑 + 玻璃高光边框 + 发光标题，6 层叠加，壁纸本身的美感被淹没
2. **配色偏暖偏艳**：琥珀橙+珊瑚红双强调色，活泼有余、沉稳不足
3. **两套 tokens 分裂**：`packages/ui` 是靛蓝 `#4f46e5` + 青 `#0ea5e9` 冷色调，`globals.css` 是暖橙调，Web 与 Mobile 视觉语言不统一
4. **动效分散注意力**：3 个光斑持续漂移 + 路线图卡片 hover 摆动，学习工具应克制
5. **玻璃边框过重**：`::before` 渐变描边 + 内高光 + 多层阴影，信息密度高时显脏
6. **字阶无断崖**：标题 text-2xl/3xl 与正文差距小，缺乏大气感的视觉层级

---

## 二、简约大气修改建议

### 设计原则：减法 · 留白 · 壁纸为主角 · 一色强调

### 2.1 配色体系重构（暖黄昏 → 极简中性）

```css
:root {
  /* 底色：近白，带极冷灰调，避免暖米白的"旧"感 */
  --color-background: #f8f9fb;
  /* 文字：炭黑，不碰纯黑 */
  --color-foreground: #1a1a1f;
  --color-muted-foreground: #8b8b95;
  /* 唯一强调色：深靛蓝，与 packages/ui 统一 */
  --color-primary: #4f46e5;
  --color-primary-foreground: #ffffff;
  /* 去掉珊瑚红 accent，状态色保留 */
  --color-success: #16a34a;
  --color-danger: #dc2626;
  /* 边框：极淡，靠留白分隔而非描边 */
  --color-border: rgba(26, 26, 31, 0.07);
}
```

- 强调色从 2 个（橙+红）砍到 **1 个**（靛蓝），只给 CTA 和激活态用
- 玻璃透明度从 `rgba(255,255,255,0.2)` 降到 `0.12`，更通透
- 深色模式：`#0d0d12` 底 + 白字，去掉暖橙发光标题

### 2.2 壁纸为绝对主角（每日壁纸保留并强化）

| 当前 | 改为 |
|---|---|
| 渐变遮罩 + 径向暖光 + 3 光斑 | 仅一层 `from-black/15 via-transparent to-black/45` 保证底部可读 |
| 3 个 ambient-blob 漂移 | **全部删除** |
| 无切换过渡 | 壁纸淡入 `opacity 0→1, 0.8s ease` |
| 静态铺满 | 可选 Ken Burns：`scale(1)→scale(1.08), 20s ease-in-out infinite alternate`（极慢，大气感来源） |
| 亮度阈值 132 | 保留自动深浅切换逻辑，阈值微调至 140 |

壁纸信息（版权/日期）可在右下角加一行 `text-[10px] text-white/50`，不抢视线。

### 2.3 玻璃拟态克制化

- **导航栏**保留毛玻璃（`blur(20px)`），这是它存在的意义
- **内容卡片**改为：`bg-white/70 backdrop-blur-sm` + `1px solid border` + 单层柔和阴影，去掉 `::before` 渐变描边和内高光
- hover 只保留 `shadow-lg` 微妙加深，去掉 `translateY(-4px) scale(1.005)` 上浮
- 圆角分层：卡片 `12px`，按钮 `10px`，导航项 `8px`（当前全是 16px，无层级）

### 2.4 排版升级（字阶断崖）

| 角色 | 字号 | 字重 | 用途 |
|---|---|---|---|
| display | 48px | 800 | 页面大标题（仪表盘问候语） |
| h1 | 32px | 700 | 卡片标题 |
| body | 15px | 400 | 正文 |
| caption | 12px | 400 | 辅助信息（日期、计数） |

- 问候语从 `text-2xl/3xl` 提升到 `text-4xl lg:text-5xl font-bold tracking-tight`
- 辅助信息（日期、"已完成/全部"）统一 `text-xs text-muted-foreground`，退到背景层
- 行高 `leading-tight`，字间距 `tracking-tight`

### 2.5 布局留白

- 主内容区 `max-w-5xl`（从 6xl 收窄），增加两侧呼吸感
- 卡片网格间距 `gap-6` → `gap-8`
- 卡片内边距 `p-5` → `p-7`
- 侧边栏 `w-64` → `w-72`，导航项 `py-2.5` → `py-3`，图标与文字间距 `gap-3` → `gap-3.5`

### 2.6 动效做减法

- **删除**：`ambient-blob` 光斑动画、`phase-bob` 路线图悬浮摆动
- **保留**：页面统一 `fade-in 0.5s ease`（去掉错峰 nth-child 延迟，太碎）
- **新增**：壁纸淡入 + 可选 Ken Burns
- 所有动效遵守 `prefers-reduced-motion`

### 2.7 统一跨端 tokens

以 `packages/ui/src/index.ts` 的靛蓝+青体系为基准，同步更新 `globals.css` 的 `@theme inline`，确保 Web 与 Mobile 共用一套视觉语言。

---

## 三、改版提示词（可直接用于驱动 AI 执行修改）

### 提示词 A：全局样式重构（globals.css）

```
将 apps/web/app/globals.css 从"液态玻璃·暖调黄昏"风格重构为"简约大气·壁纸优先"风格。

【配色】
- 底色改为 #f8f9fb（冷调近白），文字 #1a1a1f（炭黑）
- 强调色只保留一个：深靛蓝 #4f46e5，删除珊瑚红 #ef6a5e
- 主色按钮渐变改为 from-indigo-600 to-indigo-700
- 边框统一 rgba(26,26,31,0.07)，极淡
- 深色模式底色 #0d0d12，删除暖橙发光标题效果

【玻璃拟态】
- .glass 类：backdrop-blur 从 24px 降到 12px，saturate 从 1.8 降到 1.3
- background 透明度从 0.2 降到 0.12
- 删除 ::before 渐变高光描边
- 删除 inset 内高光
- box-shadow 简化为单层 0 4px 24px rgba(0,0,0,0.06)
- hover 删除 translateY 和 scale，只保留阴影加深

【删除项】
- 删除 .ambient-blob / .ambient-blob-1/2/3 全部样式和 @keyframes blob-drift
- 删除 .roadmap-phase-card 的 phase-bob 悬浮动画
- 删除 .page-enter 的 nth-child 错峰延迟，统一为 0.4s fade-in

【进度条】
- .progress-fill 渐变改为 from-indigo-500 to-indigo-600，删除发光 shadow
- 删除 .progress-fill-accent 变体

【圆角】
- .glass border-radius 从 16px 改为 12px
- 按钮圆角 10px，导航项 8px
```

### 提示词 B：每日壁纸组件优化（daily-background.tsx）

```
重构 apps/web/components/daily-background.tsx，让每日壁纸成为绝对视觉主角。

【遮罩简化】
- 删除三个 ambient-blob 光斑 div
- 删除径向暖光 div (bg-[radial-gradient(ellipse_at_top,...)])
- 渐变遮罩简化为单层：from-black/15 via-transparent to-black/45
- 无壁纸时的兜底渐变改为 from-slate-100 to-slate-200（冷调中性）

【壁纸动效】
- img 增加初始 opacity-0，加载完成后 transition-opacity duration-700 → opacity-100
- 可选：img 增加 animate-[kenburns_20s_ease-in-out_infinite_alternate]，
  @keyframes kenburns { from { transform: scale(1); } to { transform: scale(1.08); } }
- 尊重 prefers-reduced-motion：reduced 时禁用 kenburns

【壁纸信息】
- 在右下角绝对定位一行：版权信息 + 日期，text-[10px] text-white/50，
  仅在壁纸存在且非 reduced-motion 时显示

【亮度检测】
- 保留 applyBrightnessTone 逻辑，阈值从 132 微调至 140
```

### 提示词 C：应用外壳与排版（app-shell.tsx + dashboard）

```
优化 apps/web/components/app-shell.tsx 和 apps/web/app/dashboard/page.tsx 的布局与排版。

【侧边栏】
- 宽度 w-64 → w-72
- 导航项 py-2.5 → py-3，gap-3 → gap-3.5
- 激活态背景从 bg-primary/25 改为 bg-indigo-500/10，文字色保持 foreground
- 删除 logo 图标的 shadow 发光效果
- 底部日期卡片简化为 text-xs text-muted-foreground，删除边框和背景

【主内容区】
- max-w-6xl → max-w-5xl
- py-6/py-8 → py-10
- 卡片网格 gap-4/gap-6 → gap-6/gap-8

【Dashboard 排版】
- 问候语 h1：text-2xl/lg:text-3xl → text-3xl/lg:text-5xl，font-semibold → font-bold
- 统计卡片数值：text-2xl → text-3xl font-bold
- 卡片标题 CardTitle：text-base font-semibold → text-lg font-semibold
- 所有辅助文字统一 text-xs text-muted-foreground
- 统计卡片内边距 p-5 → p-6

【删除项】
- 删除 page-title 的 text-shadow 发光效果
- 删除 QuoteWidget 以外的装饰性元素
```

### 提示词 D：跨端 tokens 统一

```
同步 packages/ui/src/index.ts 与 apps/web/app/globals.css 的设计 tokens，确保 Web 与 Mobile 共用一套视觉语言。

以 packages/ui 的靛蓝(#4f46e5)+青(#0ea5e9)冷色调为基准：
- globals.css 的 @theme inline 中 --color-primary 改为 #4f46e5
- 新增 --color-accent: #0ea5e9（仅用于次要强调，如 Agent 副线进度条）
- --color-background 改为 #f8f9fb
- --color-foreground 改为 #1a1a1f
- --color-success 改为 #16a34a，--color-danger 改为 #dc2626
- 确保 packages/ui 的 radius/spacing/fontSize 与 globals.css 实际使用值对齐
```

---

## 四、修改优先级建议

| 优先级 | 改动 | 影响 |
|---|---|---|
| P0 | 删除 3 个环境光斑 + 简化壁纸遮罩 | 立刻让壁纸成为主角，视觉负担减半 |
| P0 | 配色从暖橙转冷靛蓝，强调色砍到 1 个 | 从「活泼」转向「大气」 |
| P1 | 玻璃拟态减重（删渐变描边+内高光+上浮） | 卡片更干净通透 |
| P1 | 字阶断崖（标题 48px / 辅助 12px） | 大气感的核心来源 |
| P2 | 布局留白（max-w-5xl + 增大间距） | 呼吸感提升 |
| P2 | 统一 packages/ui 与 web tokens | 跨端一致性 |
| P3 | 壁纸 Ken Burns 慢缩放 + 淡入 | 锦上添花的高级感 |

---

## 五、涉及文件清单

| 文件 | 改动类型 |
|---|---|
| `apps/web/app/globals.css` | 配色 / 玻璃拟态 / 删除光斑 / 动效 / 圆角 |
| `apps/web/components/daily-background.tsx` | 遮罩简化 / 壁纸动效 / 信息展示 |
| `apps/web/components/app-shell.tsx` | 侧边栏宽度 / 导航间距 / 激活态 |
| `apps/web/app/dashboard/page.tsx` | 排版字阶 / 内边距 / 间距 |
| `apps/web/components/ui/card.tsx` | 跟随 glass 类变化 |
| `apps/web/components/ui/button.tsx` | 配色 / 圆角 |
| `apps/web/components/ui/progress.tsx` | 渐变配色 |
| `packages/ui/src/index.ts` | tokens 对齐（如需微调） |
