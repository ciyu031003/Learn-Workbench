# v17-A 字阶收敛待办（fontSize → typography）

> 生成时间：阶段 A（速效去土）。**当前未启用 eslint 护栏**，原因见下。
> 关联：`docs/APP端优化方案-v17-iOS质感与导航重构.md` §6 R7 / 阶段 A3。

## 现状

- `src/app/**` 里**裸写数字字面量的 `fontSize:` 共 430 处**（分布在 25 个页面文件）。
- 其中"hero 级"（≥20pt）**25 处**——这 25 处最显眼，也最容易与 `typography.display` 打架。
- 方案里写的"415 处"是当时的快照，实测已到 430（新增页面带入）。

## 为什么没有直接开护栏

`no-restricted-syntax` + `Property[key.name='fontSize'][value.type='Literal']` 是**精确规则、不会误报**
（它只命中对象字面量里的数字字面量，`fontSize: token.fontSize` 这类表达式不受影响），
但它是**真阳性 430 条** —— 启用即刻让 `npx eslint src` 由 0 error 变 430 error，
与阶段 A「eslint 0 error」的验收冲突。因此留开关 + 本清单，待收敛后一行启用：

```js
rules: {
  "no-restricted-syntax": ["error", {
    selector: "Property[key.name='fontSize'][value.type='Literal']",
    message: "请用 ...typography.x（见 theme/tokens.ts）；裸写数字字号会破坏字阶一致性",
  }],
}
```

启用时还要给 `src/theme/**` 加 ignores 覆盖（否则 `tokens.ts` 自己的 `typography` 会被判红）。

## 待收敛清单（按视觉收益 ÷ 风险排序）

| 顺序 | 文件 | 处数 | 备注 |
| --- | --- | --- | --- |
| 1 | `src/app/learn.tsx` | 59 | 学习页字阶最碎，且含 hero |
| 2 | `src/app/sports-card.tsx` | 46 | 档案卡 + 编辑弹层 |
| 3 | `src/app/jobs.tsx` | 35 | 同时要收离群色（A4） |
| 4 | `src/app/today.tsx` | 31 | 首屏，hero 4 种尺寸打架的重灾区 |
| 5 | `src/app/tasks.tsx` | 23 | |
| 6 | `src/app/habits.tsx` | 21 | |
| 7 | `src/app/market.tsx` | 20 | 图表刻度可保留小字号表达 |
| 8 | `src/app/radar.tsx` | 20 | |
| 9 | `src/app/interview.tsx` | 19 | |
| 10 | `src/app/roadmap.tsx` | 18 | |
| 11 | `src/app/domain-manager.tsx` | 16 | |
| 12 | `src/app/trackers.tsx` | 16 | |
| 13 | `src/app/phase/[id].tsx` | 15 | |
| 14 | `src/app/workout.tsx` | 15 | |
| 15 | `src/app/settings.tsx` | 14 | |
| 16 | `src/app/resume.tsx` | 12 | |
| 17 | `src/app/account-security.tsx` | 11 | |
| 18 | `src/app/certificates.tsx` | 11 | |
| 19 | `src/app/resume-preview.tsx` | 8 | |
| 20 | `src/app/diagnostics.tsx` | 6 | |
| 21 | `src/app/applications.tsx` | 5 | |
| 22 | `src/app/nutrition.tsx` | 4 | |
| 23 | `src/app/+not-found.tsx` | 3 | |
| 24 | `src/app/wellness.tsx` | 1 | |
| 25 | `src/app/_layout.tsx` | 1 | Tab 标签字号，与底栏几何联动 |

合计 **430**。

## 收敛时的注意事项（避免"机械就近替换"造成新的问题）

1. **不许全局 sed**：430 处里混着图标尺寸、图表刻度、`12.5` 这类分数字号，一刀切会破坏细节层次。
2. **先做 hero 级**：25 处 ≥20pt 的先统一到 `typography.display / title1`，视觉收益最大。
3. **保留例外**：图表刻度、徽标内的极小字号可保留（收敛后按需在 eslint 里开 `allow` 注释）。
4. **配合 A6**：任何"高度写死"的文本容器，收敛时用 `lib/text-scale.ts` 的 `fitsAtMaxScale()` 校验
   130% 放大不截断。
5. **验收**：每页收敛后跑 `npx tsc --noEmit` + 真机浅/深两套目检，再启用护栏。

---

## 收敛结果（v17 收尾批次）

| 轮次 | 范围 | 结果 |
| --- | --- | --- |
| 第一轮（阶段 A3） | hero/分区标题/卡片标题/正文四档 | 27 个样式块归并，全 App hero 标题统一到 typography.display |
| 第二轮（收尾批次，4 路并行） | 23 个页面逐页按语义归并 | 430 → 208 处（**降 52%**） |

### 剩余 208 处的性质（全部为**刻意保留**，非遗漏）

1. **图标/图形尺寸**：如 honorHeroTrophy 30、checkIcon 18、chevron 16 —— 它们是图形不是文字；
2. **KPI 大数字展示**：如 sportTotalNum 30、statValue 20-24、hVal 24、padCount 40 —— 归并到档位会压平视觉层级；
3. **≤13pt 的微信息**：徽标/时间戳/图例/图表刻度/胶囊内文字 —— 11→12 只涨 1pt、视觉收益低，却要动大量紧凑布局（会撑破胶囊）；
4. **分数字号**：12.5 / 13.5 / 14.5 —— typography 里没有对应档位。

### 护栏：为什么不用 eslint 规则，改用基线棘轮

eslint 的 no-restricted-syntax 规则本身精确不误报，但上面 208 处是**真阳性**——启用即 208 error，等于把护栏变成阻塞；逐处 disable 又会淹没真正的新增违规。

因此改为 **基线棘轮**：`scripts/check-font-scale.mjs` + `docs/font-scale-baseline.json`（当前基线 23 文件 / 208 处）。

- 任何文件的裸写数字 `fontSize` **超过基线**即失败（退出码 1）；
- 有意新增例外时用 `node scripts/check-font-scale.mjs --update` 刷新基线，并在提交信息里说明理由；
- 移动端可跑 `pnpm -F mobile lint:fontscale`。

### 仍未做的第三轮（可选）

≤13pt 微信息层若要继续收敛，建议按页推进并在真机确认胶囊/徽标不被撑破；不建议全量脚本替换。
