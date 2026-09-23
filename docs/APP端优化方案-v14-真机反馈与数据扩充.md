# APP 端优化方案 v14 · 真机反馈修复与数据扩充

> 状态：**已实施**（2026-09-23）。触发：v1.21.0 真机试用反馈 7 条（1 个观感 + 3 个数据/图表 + 1 个导航 + 1 个分享形态 + 1 个数据量）。
> 版本：**一次性做完，只出一个版本 v1.22.0 / versionCode 35**。

---

## 1. 用户反馈 → 根因 → 修法

| # | 反馈（原话要点） | 根因 | 修法 | 落点 |
| --- | --- | --- | --- | --- |
| F1 | 「下方的 tab 栏，字体都到了 tab 栏底部，摸到边了，没有居中。要么去掉字体，留图标就行」 | 悬空胶囊 + 文字标签 + `marginVertical/paddingVertical` 挤压，10pt 文字被顶到底边 | 按用户选择**去掉文字只留图标**：`tabBarShowLabel: false`，item 居中（`alignItems/justifyContent: center`、竖向 margin 4），图标 22 → 24 | `apps/mobile/src/app/_layout.tsx` |
| F2 | 「1.21 版本会显示"数据没有加载出来"」 | 首屏一次请求失败就进失败态；且服务端按 **UTC** 日期聚合，东八区凌晨会算成"前一天" | ① 失败先**自动重试两次**（1.2s / 3s）再提示；② 请求带**客户端本地日期** `?date=`；③ 保留手动重试与"上次数据"条 | `daily-os-summary.tsx`、`wellness.tsx`、`apps/web/app/api/daily/route.ts`、`lib/daily-os.ts` |
| F3 | 「健康主页上饮食的热量数据没有显示（饮食页有）」 | **两个 bug 叠加**：① `/api/nutrition/summary` 返回的是**数组**，健康页却当 `map[todayKey]` 用（恒 undefined，回落到可能滞后的聚合值）；② 同 F2 的 UTC 日期错位 | ① 统一用 `toDaySummaryMap()` 解析，当天无记录时明确置 0；② 见 F2 | `apps/mobile/src/app/wellness.tsx` |
| F4 | 「柱状图周一到周日固定不变；点周六时不要往前变化，直接固定这一周，一周一周固定」 | 迷你柱是"以所选日期为终点往前滚 7 天"，点周内任一天整条柱就往前挪一格 | 改为**自然周（周一→周日）固定**：新增 `weekKeysOf/weekEndKey/weekRangeLabel/isCurrentWeek` 纯函数；窗口 `end` 取本周周日（周内切天不再重新拉数）；加**上一周 / 下一周**导航（不能翻到未来周） | `apps/mobile/src/lib/nutrition-views.ts`、`components/meal-card-grid.tsx`、`app/nutrition.tsx` |
| F5 | 「进一步补充食物和各种伙食的数据量，选择量太少了」 | 线上全局 `foods` 只有 **12** 条、营养基准库 `food_items` 只有 **108** 条 | ① 迁移 **056** 追加 **401** 条全局常用食物（每份口径：份/个/碗/杯…）；② `food-builtin.json` 108 → **660** 条（每 100g/100ml，含别名、分类、餐次标签） | `db/migrations/056_foods_expand.sql`、`scripts/data/food-builtin.json` |
| F6 | 「职业证书页点"面试"/"证书"的返回，都回到今日首页了，应该回"职业"首页」 | Tab 结构下子页调 `router.back()` 走的是"上一个 Tab"，而不是"这个子页属于哪个模块" | 引入**模块感知返回**：记录上一个展示过的页面，**同模块**才 `back()`（保留"从哪来回哪去"，如路线图→阶段详情），**跨模块**则 `replace(所属 Hub)`（今日→面试 ⇒ 回职业） | `apps/mobile/src/lib/back-target.ts`、`components/screen-header.tsx`、`app/_layout.tsx` |
| F7 | 「专注点击分享时，参考闪光卡片，以卡片图片类型分享数据，不要几个文字分享」 | 旧实现只有 `Share.share({ message })` 文字 | 新增**卡片图片分享**：弹层预览一张固定版式卡片（今日分钟 / 连续天数 / 14 天分布 / 三项统计 / 励志语）→ `react-native-view-shot` 截图 PNG → `expo-sharing` 系统分享面板；截图或分享不可用时**自动退回文字**，绝不让"分享"点了没反应 | `components/focus-share-card.tsx`、`lib/focus-share.ts`、`app/tasks.tsx`、`components/focus-timer.tsx` |

---

## 2. 顺带修掉的既有问题

- **`db/schema.sql` 漂移**：`set_updated_at()` 定义在文件后段，却在上百行的触发器里先用 → `check-schema-fresh` 一直报 `function set_updated_at() does not exist`。已把函数定义上移到文件顶部「0. updated_at 自动更新函数」，原位置留指针注释。
- **`store/toast-store.test.ts` / 路由测试**：`GET /api/daily` 现在接受 `Request` 与 `?date=`，测试同步补齐（含畸形日期的兜底断言）。

---

## 3. 新增/改动清单

**移动端**
- 新增：`components/focus-share-card.tsx`（卡片 + 分享弹层）、`lib/focus-share.ts`（纯数据层）、`lib/focus-share.test.ts`。
- 改造：`app/_layout.tsx`（去标签 + 路径记忆）、`lib/back-target.ts`（模块感知）、`components/screen-header.tsx`（返回规则）、`components/daily-os-summary.tsx`（重试 + 本地日期）、`app/wellness.tsx`（summary 解析 + 本地日期）、`app/nutrition.tsx` + `components/meal-card-grid.tsx` + `lib/nutrition-views.ts`（自然周 + 翻周）、`app/tasks.tsx` + `components/focus-timer.tsx`（分享改卡片）。
- 新增依赖（Expo 兼容版本，自动链接）：`react-native-view-shot@5.1.0`、`expo-sharing@~57.0.21`。

**Web / 数据**
- `app/api/daily/route.ts` + `lib/daily-os.ts`：`?date=` 客户端本地日期；`app/today/page.tsx`、`components/wellbeing/readiness-hero.tsx` 带日期请求。
- 迁移 **056** + `scripts/data/food-builtin.json`（660 条）。
- `db/schema.sql`：`set_updated_at()` 上移。

---

## 4. 校验（实跑）

| 项 | 命令 | 结果 |
| --- | --- | --- |
| 移动端类型 | `node node_modules/typescript/bin/tsc --noEmit`（apps/mobile） | 0 错误 |
| 移动端测试 | `vitest run --root apps/mobile` | **38 文件 / 350 用例全绿**（v13 的 343 + 新增自然周 4 + 分享 3） |
| Web 类型 | `tsc -p apps/web --noEmit` | 0 错误 |
| Web 测试 | `vitest run --root apps/web` | **170 文件 / 1156 用例全绿**（新增 `?date=` 相关 2 例） |
| 迁移 | `node scripts/verify-migrations.mjs` | 56 个迁移 1..56 无跳号无重复 ✅ |
| Schema | `node scripts/check-schema-fresh.mjs` | 全量执行 schema.sql + 56 迁移 ✅（漂移已修） |
| 数据自检 | `node scripts/import_food_db.mjs --dry-run` | 待写入 **660** 条；sourceId/name 唯一；能量一致性（Atwater ±20%）新增 552 条**无超差** |
| APK | `scripts/build-android-release.ps1 -VersionName 1.22.0 -VersionCode 35` | BUILD SUCCESSFUL；签名 MD5 `3057105285981cc18597a95c1370c147` ✅ |

---

## 5. 发布记录（v1.22.0 / 35）

| 项 | 值 |
| --- | --- |
| APK 大小 | 70,505,375 B |
| MD5 / SHA256 | `326789335bc5c730bc7fd8d982a4ecef` / `fb5c8bf271f6ad2756631ee9aef55b650c8c11b0cfd20d47f0d8ec9a349ea33f` |
| 签名 MD5 | `3057105285981cc18597a95c1370c147` |
| 下载 | https://learn.yuanabd.cn/download.html → `/download/learn-workbench-v1.22.0.apk` |
| 数据 | 全局常用食物 12 → **413** 条；营养基准库 108 → **660** 条 |

> 真机复测建议：① 底栏只留图标是否够直观；② 健康主页饮食热量与饮食页一致；③ 柱状图固定本周、点周六不再滚动、能翻上一周；④ 职业 → 面试/证书返回是否回职业；⑤ 分享是否出图片卡片（微信/QQ 预览）；⑥ 食物搜索选择量。
