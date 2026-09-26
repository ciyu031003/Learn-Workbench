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
