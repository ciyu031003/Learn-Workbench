# APP 端优化方案 v6 —— 崩溃修复 · 饮食数据库 · 训练与学习体验

> 状态：**已确认并执行到「阶段 E 完成」**（2026-09-18）。
> - 已完成：阶段 A 止血（三个 P0）、B 饮食体验、C 食物营养库、D 训练 UI、E 学习自建 + MD 导入；配套迁移 **047/048**。
> - 决策落定：**D1 = 只用公开/可商用数据源**（Open Food Facts ODbL / USDA CC0 / 自建中餐库），不使用有版权的《中国食物成分表》。
> - 待办：**阶段 F 出包与部署**（v1.5.0 热修或合并 v1.6.0）+ 看板订正（已随本轮完成）+ 真机复测。
> - 执行明细见 `docs/改动记录与任务看板.md` 的「APP 端 v6」小节。
> 输入来源：2026-09-18 用户真机反馈 3 组问题 + 看板 docs/改动记录与任务看板.md 里尚未完成的剩余任务。
> 相关文档：v4 / v5 方案、apps/mobile/CLAUDE.md、CLAUDE.md。

---

## 0. 一句话结论

| 编号 | 问题 | 结论 / 根因 | 类型 |
| --- | --- | --- | --- |
| P0-1 | 点击/拖动抽屉顶部横线 → 应用闪退 | bottom-sheet.tsx 的 pan worklet 引用了**声明在它之后**的 lift（worklet 定义处快照 → undefined → 读 .value 抛错） | **必修 · 崩溃** |
| P0-2 | 选完食物拖动份量滑杆 → 闪退 | portion-slider.tsx 的 onEnd worklet 里调用了**普通函数** snapPortion()（无 worklet 指令）→ UI 线程同步调用非 worklet 函数 | **必修 · 崩溃** |
| P0-3 | 手动添加饮食提示成功但页面没有、数据仍 0 | addManual() 在**没真正落库**（离线/5xx/401）时也执行 load()，服务端列表把乐观入账**覆盖掉**（quickAdd() 没有这问题，所以「鸡蛋」能显示） | **必修 · 数据丢失观感** |
| P1-1 | 食物列表「一食物一行」太占地方 | 现为单列行卡（styles.foodChip）；改为 2 列大图标网格 | 体验 |
| P1-2 | 常用食物不分餐次 | /api/nutrition/foods 只有 sort=recent，无 meal 维度 | 功能 |
| P1-3 | 需要食物营养库（热量/蛋白/脂肪/碳水）+ 模糊搜索 + 按克换算 | 新增营养基准库表 + 导入管线 + 模糊搜索（**字符覆盖率**，中文友好；pg_trgm 对纯中文失效，见踩坑 81）+ 按克录入；**数据源许可需先决策（D1）** | 功能 · 需迁移 |
| P2-1 | 训练记录动作明细的 ± 图标挨着、尺寸差 | workout.tsx 三个 MiniStepper 并排（每个 28×28、间隙 4/8），相邻字段的 + 与 − 贴在一起 | 体验 |
| P2-2 | 分类按钮太小、上下大片空白 | exercise-picker-sheet.tsx 用横向文字 pill（fontSize 12 / paddingVertical 6）；改为 2×2 大卡片 + 按压动效 | 体验 |
| P3-1 | 跳过职业/换领域后学习页空、无法自建 | 移动端 lib/roadmap.ts **硬编码 career=ict**；空态无引导；三级内容（H3）无存储 | 功能 · 需迁移 |
| P3-2 | 导入 MD：H1=阶段 / H2=主题 / H3=详细内容 | 前端纯函数解析 + 新增批量导入 API + 三级内容表 | 功能 · 需迁移 |

---

## 1. P0 崩溃根因（先修，全部有代码证据）

### 1.1 抽屉横线拖拽闪退 —— apps/mobile/src/components/bottom-sheet.tsx

**现象**：点击/长按上滑任意抽屉顶部的横线（grabber）想拉到全屏时，App 直接退出。

**根因**：

- panGesture 定义在 **L167-195**，其 onEnd 里读 lift.value（**L179**）：
  if (current - lift.value > 110 || e.velocityY > 900) { … }
- 但 lift 是 **L225-228** 的 useDerivedValue，声明在 panGesture **之后**；
- worklets/babel 插件会**在 worklet 定义处快照自由变量**（本项目看板**踩坑 71** 已记录同一坑：useAnimatedStyle 引用了后声明的局部量 → 拿到 undefined）；产物把 const 降级为 var，所以不报 TDZ、只是值为 undefined → worklet 里读 .value → **UI 线程 TypeError → 应用终止**。
- 影响面：全仓 grep expandable 只有 bottom-sheet.tsx 自己（**没有任何调用方传 expandable**），也就是说**所有抽屉**都走 !expandable 分支 → **拖任意抽屉横线必崩**。纯点击（手指不移动）时 Pan 不激活、可能不触发；一旦有位移就会走到 onEnd。
- 顺带发现：**「拖到全屏」这个功能目前并不存在** —— 所有抽屉都没传 expandable，即使修掉崩溃，上滑也只会停在原高度（非展开态的 onEnd 语义是「下滑关闭」）。是否要同时把高弹层（86%/94%）改成可上滑全屏，见 **决策 D12**。

**修复（P0）**：

1. 把 eatenByResize / lift / sheetHeight / maxSheetHeight 等**所有参与 worklet 计算的量**上移到 tapGesture/panGesture 之前（保持顺序约束并加注释锁死）；
2. 阈值判断不再经过 derived value：直接读 keyboardAnim.value 与 rootH 的共享值/常量；
3. 双保险：onEnd 里先判 !expandable 再触碰任何 lift 相关量（顺手把「非展开态不下拉关闭」的语义写清）；
4. 回归：真机拖拽/上滑 30 次不崩 + adb logcat 无 Worklets / FATAL 关键字；新增静态守护（见 1.4）。

### 1.2 份量滑杆闪退 —— apps/mobile/src/components/portion-slider.tsx

**现象**：健康页 → 今日饮食 → 添加午餐 → 点「鸡蛋」→ 拖动大圆钮调整份量时闪退。

**根因**：

- pan.onEnd（L75-83）里执行 const next = snapPortion(raw, min, max, step)（**L77**）；
- snapPortion 来自 apps/mobile/src/lib/portion.ts:7，是**普通 JS 函数**（文件里没有任何 worklet 指令；全仓 grep worklet 结果为 0）；
- UI 线程 worklet 里**同步调用非 worklet 函数** → Tried to synchronously call a non-worklet function on the UI thread → 崩溃；
- 为什么现在才炸：v1.4.1 之前 Modal 内的手势**收不到触摸**（看板**踩坑 72**），onEnd 从来没真正跑过；v1.4.2 补了 GestureHandlerRootView 后手势第一次真正生效 → 一拖就崩。

**修复（P0）**：

1. 首选：给 lib/portion.ts 的纯函数加 worklet 指令（无副作用、无闭包依赖，单测仍可跑）；
2. 双保险：把「吸附 + 回弹 + onChange」整体搬进 runOnJS 回调（UI 线程只写 pos/knob 共享值）；
3. 顺手检查 runOnJS(haptics.light)()（L82）在震动不可用时的行为（已 catch，安全）；
4. 回归：真机拖 20 次 + ± 按钮 + 松手吸附 + 中断滚动，均不崩且数值正确。

### 1.3 手动添加饮食不显示 —— apps/mobile/src/app/nutrition.tsx

**现象**：手动添加（名称 + 热量）提示成功，但饮食页没有这条记录，顶部数据仍是 0；有时还伴随闪退（闪退见 1.1/1.2）。

**根因（代码级）**：

- addManual()（L497-551）流程：提交 → 若 outcome.ok === false 且可重试（离线 / 5xx / 401）→ **乐观入账** setEntries([...prev, localEntry])（L523-529）→ 入发件箱；
- 但函数**末尾无条件**执行 haptics.success(); closeSheet(); await load();（**L545-547**）；
- load() 成功后执行 setEntries(Array.isArray(d.entries) ? d.entries : [])（**L305**）——服务端列表里当然没有这条还没上传的记录 → **乐观入账被覆盖** → 提示成功但页面什么都没有。
- 对照 quickAdd()（L397-438）：离线分支在 await load() **之前 return**，所以用户看到「鸡蛋能正常添加和显示」。→ 两个路径行为不一致正是这个 bug 的指纹。
- 二次因素（需真机日志确认走的是哪一支）：token 过期 401 / 接口 5xx / 确实离线。当前 UI 只在 kind === auth 时弹「已记在本机」，其余分支**静默**，用户无从判断。

**修复（P0）**：

1. load() 后**合并**发件箱里的 create 乐观条目：新增 mergePendingEntries(serverEntries, outbox)（放 lib/nutrition-outbox.ts，纯函数 + 单测）；
2. 只有 outcome.ok 才 await load()；未落库的分支直接把乐观条目留在列表里（带「待同步」标记）；
3. 顶部加一条**同步状态条**：「N 条待同步 · 点此重试」（调用 flushPending()），失败原因按四分类给文案（离线/服务端/未登录/参数）；
4. 手动与一点即记两条路径统一走同一个 submitEntry(body, opts)，杜绝再出现「一条路径会 load、另一条不会」的分叉；
5. 回归测试：① 离线手动添加 → 列表立即出现；② 恢复网络 → 自动补发并去掉标记；③ 4xx → 撤回并给出服务端原因。

### 1.4 同类隐患的系统性排查（已做）

全仓含手势的文件只有 6 个，逐个核对结果：

| 文件 | 手势 | 结论 |
| --- | --- | --- |
| components/bottom-sheet.tsx | Pan + Tap | **有问题**（1.1） |
| components/portion-slider.tsx | Pan | **有问题**（1.2） |
| components/live-log-sheet.tsx | Pan + Pinch | 只用共享值 + runOnJS，安全 |
| app/learn.tsx（阶段拖拽） | Pan | 只用共享值 + runOnJS，安全 |
| components/today-stack.tsx | Pan | 只用共享值 + withTiming，安全 |
| app/_layout.tsx（边缘横滑） | Pan | 只用 runOnJS，安全 |

**新增规范（写进 apps/mobile/CLAUDE.md 与看板踩坑）**：

1. worklet 里**禁止**调用外部普通函数；需要复用的纯逻辑必须抽成带 worklet 指令的模块函数并单测；
2. worklet 引用的**所有局部量必须声明在它之前**（保持看板踩坑 71 的约束）；
3. 新写手势必须真机验证「按下 / 拖动 / 松手 / 取消」四条路径，不能只看 dev 模式不报错（**release 包才崩**）。

---

## 2. 饮食模块 v6

### 2.1 常用食物网格重排（P1-1）

现状：nutrition.tsx 的「常用食物」是单列行卡（L1291-1309，styles.chipGrid + styles.foodChip：图标 34 + 名称 + kcal + ⊕，一食物一行）。

改法：

- 网格 **2 列**（flexWrap 48% 卡宽或 numColumns=2），卡高约 96-104；
- 图标放大到 **44-48**（FoodSticker 支持 size），名称最多 2 行（numberOfLines=2），kcal / 单位降为副行 11pt；
- 右上角 ⊕ 常显；点击整卡即「一点即记」，长按进入「按份量添加」；
- 触感 + PressableScale 缩放反馈；空态给「搜索 / 手动添加」双入口；
- 一屏可见数量从现在的约 5 行提升到 **6-8 个食物**（你说的「四横一竖 → 两横两竖」就是这个诉求）。

### 2.2 餐次感知的常用食物（P1-2）

后端：GET /api/nutrition/foods 增加 meal=breakfast|lunch|dinner|snack 参数，排序三级：

1. **本人该餐次的历史频次**（meal_entries WHERE meal = 参数 GROUP BY name，近 90 天）；
2. foods.meal_tags 命中该餐次（种子/导入数据补的标签）；
3. 全局使用频次 / 名称序。

前端：餐次 chip（早/午/晚/加餐）切换时**重新拉取**该餐次的列表（现在只在 sheetOpen 变化时拉一次，L338-350）；默认选中「按当前时间推断的餐次」（<10 点早、11-14 午、17-21 晚，其余加餐），可手动切。

迁移：foods 增加 meal_tags text[]（可用源数据类目推导 + 手工修正）。

### 2.3 食物营养数据库（P1-3，本方案重点）

#### 2.3.1 数据源与许可（**决策 D1**，先定这个再动表）

| 方案 | 数据量/覆盖 | 许可 | 可商用 | 备注 |
| --- | --- | --- | --- | --- |
| **Open Food Facts**（推荐主力） | 全球包装食品 + 条码，中文商品名不少 | **ODbL 1.0**（署名 + 衍生库同许可开放） | 可（需合规声明） | 有公开 dump/API，可增量；需在 App 关于/隐私页与 docs/THIRD_PARTY.md 署名 |
| **USDA FoodData Central**（推荐补充） | 约 38 万条，通用食材/生鲜 | **CC0 公有领域** | 可 | 需免费 API key；英文名，可只取生鲜/通用食材并配中文别名 |
| 《中国食物成分表（第6版）》社区 JSON（如 Sanotsu/china-food-composition-data，1677 条） | 最贴中餐 | **仓库无 license**（原书版权属中国 CDC 营养所） | ⚠️ **不建议商用** | 可作内部校对参考，不入库不入 git；要入库需自行承担版权风险 |
| 自建「中餐/外卖常见菜品」人工库 | 番茄鸡蛋面、兰州拉面、黄焖鸡… | 自有 | 可 | 100-300 条即可覆盖高频场景，配合用户自定义沉淀（现有 POST /api/nutrition/foods） |
| 第三方付费营养 API（聚合数据/天行） | 中餐较全 | 商业 API 条款 | 可 | 需 key + 费用；可作为兜底查询（不入库） |

**建议**：Open Food Facts（ODbL，署名 + 开放）+ USDA（CC0）筛选 + 自建中餐常见菜 200 条，三层合并入库；第三方 API 只做可选兜底。若你希望直接爬《中国食物成分表》，我会照做，但会把版权风险写进 docs/THIRD_PARTY.md 并标注「未解决许可」。

#### 2.3.2 数据模型（**决策 D2**：扩展现有 foods 还是新建基准库）

**推荐方案 B（新建基准库，不动现有语义）**——迁移 047 草案：

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;            -- 仅服务英文名/拼音；纯中文不生成 trigram（见踩坑 81）

CREATE TABLE food_items (                          -- 营养基准库（只读、可重建、可清空重导）
  id             bigserial PRIMARY KEY,
  source         text NOT NULL,                    -- off | usda | builtin
  source_id      text NOT NULL,                    -- 源侧主键（条码 / ndbno）
  name           text NOT NULL,                    -- 中文名（无中文时用英文名 + 中文别名）
  name_en        text,
  aliases        text[] NOT NULL DEFAULT '{}',     -- 别名/俗称（番茄炒蛋 = 西红柿炒鸡蛋）
  pinyin         text,                             -- 全拼/首字母（模糊搜索用）
  category       text,                             -- 谷物/蔬菜/肉类/菜肴/饮品…
  meal_tags      text[] NOT NULL DEFAULT '{}',     -- breakfast/lunch/dinner/snack
  basis_amount   numeric NOT NULL DEFAULT 100,     -- 参考基准量（默认每 100）
  basis_unit     text NOT NULL DEFAULT 'g',        -- g / ml / 份 / 碗
  kcal           numeric NOT NULL DEFAULT 0,       -- 每 basis_amount 的热量
  protein_g      numeric NOT NULL DEFAULT 0,
  carbs_g        numeric NOT NULL DEFAULT 0,
  fat_g          numeric NOT NULL DEFAULT 0,
  fiber_g        numeric, sodium_mg numeric,       -- 可选扩展
  license        text NOT NULL,                    -- ODbL-1.0 | CC0-1.0 | own
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);
CREATE INDEX idx_food_items_name_trgm ON food_items USING gin (name gin_trgm_ops);
CREATE INDEX idx_food_items_aliases   ON food_items USING gin (aliases);

CREATE TABLE food_import_runs (                    -- 导入批次审计（幂等/可回溯）
  id bigserial PRIMARY KEY, source text NOT NULL, license text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(), rows_in int NOT NULL DEFAULT 0,
  rows_upserted int NOT NULL DEFAULT 0, checksum text, note text
);

ALTER TABLE meal_entries ADD COLUMN IF NOT EXISTS grams numeric;        -- 按克录入时留档
ALTER TABLE meal_entries ADD COLUMN IF NOT EXISTS food_item_id bigint;  -- 指向基准库（可空）
```

- 现有 foods 表**保持不动**（继续当「我的常用 / 自定义」），导入的基准库进 food_items；
- 「一份 / 一碗」这类中餐口径用 basis_amount + basis_unit 表达（例如番茄鸡蛋面：basis_amount=500, basis_unit=g，用户吃 600g 就按 1.2 倍算）；
- 新表要**登记进 db/schema.sql**（否则 pnpm test:scripts 的 verify-migrations 会告警，见看板踩坑 4）。

**方案 A（备选，改动小）**：直接给 foods 加 basis_amount/basis_unit/source/aliases/meal_tags，把全局种子扩成基准库。缺点：全局基准（1700+ 条）与「我的常用食物」混在一张表，uq_foods_global_name 唯一键会被源数据撞名拖累，列表查询还得额外过滤。

#### 2.3.3 导入管线（爬取/落库）

沿用项目既有约定：**爬虫/导入只做批处理，用户端只读**（apps/web/lib/tasks/crawler.ts + scripts/*.mjs + task 锁 + job_crawler_runs）。

- 新增 scripts/import_food_db.mjs：读取源（OFF 官方 dump 或 API / USDA API / 自带 CSV）→ 归一化（字段名、单位、去重、中文名与别名）→ 写 food_import_runs + INSERT ... ON CONFLICT (source, source_id) DO UPDATE；
- 支持 --source=off|usda|builtin、--limit、--dry-run、--file=.local/food/xxx.jsonl（离线包不入 git）；
- 调度：新增 POST /api/internal/cron?job=food（或 job=all 里加一段，默认**关闭**，需显式开启），月频增量；管理员手动触发与现有 /api/jobs/run 同模式；
- 幂等：UNIQUE(source, source_id)；重跑只更新，不产生重复；
- 许可与来源写进 docs/THIRD_PARTY.md 与 App「关于」页（ODbL 要求署名）；
- 规模预估：3k-20k 条，磁盘 < 20MB，无缓存压力；搜索走 GIN 索引，不需要预聚合。

#### 2.3.4 模糊搜索（**决策 D3**）

- 端点：GET /api/foods/search?q=番茄鸡蛋面&meal=lunch&limit=20（或复用 /api/nutrition/foods 加 source=db）；
- SQL 排序：**字符覆盖率**（`|查询串字符 ∩ 名称字符| / 查询串长度`，阈值 ≥ 0.5，支持错别字「鸡旦 → 鸡蛋」）+ 子串命中（名称/英文名/拼音/别名）+ 本人使用频次；
  ⚠️ **不要用 pg_trgm 的 similarity()**：实测 `show_trgm('番茄鸡蛋面') = {}` —— pg_trgm 只把字母数字当词，纯中文不生成 trigram，similarity 恒为 0（见踩坑 81，已实测纠正）；
- 返回体：{ id, name, basisAmount, basisUnit, kcal, proteinG, carbsG, fatG, score }；
- 客户端：300ms 防抖 + 请求序号守卫（项目里 loadSeq 已有同款模式），离线时回退本地缓存（AsyncStorage，最近 200 条 + 常用）。

#### 2.3.5 按克/按份量换算录入（你的场景：吃了 600g 番茄鸡蛋面）

1. 选食物（搜索或常用）→ 卡片显示「每 100g：116 kcal · P… C… F…」或「每 500g（一份）」；
2. 输入实际摄入量（数字键盘 + 快捷 100/200/300/500g + 0.5/1/1.5 份），**实时预览**换算结果；
3. POST /api/nutrition 增加分支：{ foodItemId, grams } → 服务端按 kcal × grams / basis_amount 重算（**服务端算，不信客户端**），返回完整条目；
4. meal_entries 记录 food_item_id + grams，便于以后「按食物看摄入」；
5. shared 新增纯函数 scaleFoodByAmount(item, amount) + formatBasisLabel(item) + 单测（含 basis_unit 非 g、四舍五入、0/负数防护）。

### 2.4 饮食页其它顺手项

- 份量滑杆改为「克数优先」：常用食物保留 ± 份量，基准库食物走克数输入（避免 0.5 份 = 50g 的歧义）；
- 「我的饮食日记」贴纸墙与收集册复用新库名称归一（同名合并：lower(trim(name))）；
- 手动添加保留（数据库外的自研菜），但**写库成功后自动沉淀到 foods**（现在需手动开开关 saveAsCommon）。

---

## 3. 训练记录 v6

### 3.1 动作明细：± 分离 + 尺寸规范（P2-1）

现状（apps/mobile/src/app/workout.tsx）：

- MiniStepper（L408-450）：[−][输入][单位][+]，按钮 28×28（miniBtn），内部 gap: 4；
- 三个 stepper 并排（stepperRow 行 gap 8，每个 miniStepper flex:1）→ **组 的 + 与 次 的 − 只隔 8pt**，看起来就是「加号紧挨减号」；
- 动作明细行（L286-292）是纯文本行，无图标、无分隔。

改法：

- 每个字段一个**独立块**：左上小标签（组 / 次 / 重量）→ 下一行 − [值] 单位 +（按钮 **36×36**、图标 16-18、圆角 12、primarySoft 底），块间距 **12**；
- 或者三字段改为**竖排 3 行**（宽屏可 2 列），彻底消除相邻 ± 的歧义；
- 明细行加动作图标 + 肌群徽章 + 容量副行，行高 56；
- 触感反馈 + 长按连续加减（可选）。

### 3.2 分类大卡片（P2-2）

现状（apps/mobile/src/components/exercise-picker-sheet.tsx L170-188）：横向 ScrollView 的文字 pill（tab：paddingVertical 6 / fontSize 12），分类来自 exerciseTypeOptions（packages/shared/src/index.ts:605，5 项：全部 / 力量训练 / 有氧运动 / 拉伸放松 / 球类运动）。下方 list 用 flex:1，动作少时大片空白。

改法：

- 分类改为 **2×2 大卡片网格**（「全部」并入顶部搜索栏旁边作为清除筛选，或占第 5 格）：卡高 **84-96**、圆角 18、类目图标 26-30 + 名称 15/700 + 动作数量副行；
- 按压动效：PressableScale + withSpring 缩放 0.96 + 描边/渐变高亮（选中态品牌色描边 + 轻底色），符合你「点击时方框会动起来」的要求；
- 网格下方动作列表**撑满剩余高度**（flex:1），行高 52-56、名称 15-16；空态居中提示；
- 搜索时自动收窄到 1 列（或隐藏网格）以把空间让给结果；
- 键盘弹出时网格收起（Keyboard 监听或现有 keyboard-controller 的 hook），保证列表可滚。

---

## 4. 学习页 v6：空态 · 自建 · MD 导入

### 4.1 现状与根因

| 现象 | 证据 |
| --- | --- |
| 移动端学习页**不跟随用户所选领域** | apps/mobile/src/lib/roadmap.ts:36 硬编码 /api/roadmap?career=ict；:54 / :61 的 createPhase / reorderPhases 同样写死 career: ict；而 Web 端 /api/roadmap/route.ts:10 用的是「参数 → 用户设置 career → ict」 |
| 跳过职业选择 = 没有领域 | apps/web/app/login/page.tsx:122-139 的 pickCareer 只写 PUT /api/settings/career；L515 的「暂时跳过」什么都不写 → 后续各页回落到 ict |
| 首屏内容来自**打包内置** ICT 数据 | learn.tsx:335 用 useState(mainPhases.filter(...))（packages/content 的静态 ICT 路线），远端为空时保留内置 → 别的用户看到的是错的/空的 |
| 空态无引导 | learn.tsx:620-643 直接 roadmap.map，为空时页面上只剩区标题 + 「添加阶段」按钮，没有「导入 / 模板 / 去创建领域」 |
| 三级内容无存储 | content_topics 只有 title / summary / agent_task + 资源/实操/项目/检查点（db/schema.sql:26-34），**没有 H3 级「详细学习内容」** |
| 自建能力后端**已有** | POST /api/roadmap/phases（自建阶段，L40-79）、POST /api/roadmap/custom（自建主题，L23-44）；缺的是移动端跟随领域 + 批量导入 + 三级内容 |

### 4.2 学习页跟随领域（**决策 D4**）

- lib/roadmap.ts 的 fetchRoadmap / createPhase / reorderPhases / readCachedRoadmap 全部接受 careerKey 参数；默认取「当前领域」（store.careerKey / /api/domains 的当前域），无领域时回落到 ict（兼容老用户）；
- 缓存按 career 分键（lwb-roadmap-cache:<career>），切换领域时先展示缓存再刷新；
- learn.tsx 首屏不再直接用 mainPhases，改为「领域缓存 → 远端 → 内置（仅 ict）」；
- 「跳过职业」的用户：学习页空态引导创建领域（或直接在该页新建阶段，自动创建一个同名默认领域）。

### 4.3 空态与自建（**决策 D5**）

空态（无阶段）改为三入口卡片：

1. **导入 MD**（见 4.4）；
2. **手动新建阶段**（复用现有 sheet）+ 阶段下「添加主题」；
3. **从模板创建**（跳 /domain-manager 的模板克隆，已有能力）。

同时补齐：阶段列表为空时不再渲染空的统计区；主题为空时给「这个阶段还没有主题 · 添加 / 导入」；拖动排序/编辑/删除沿用现有实现。

### 4.4 MD 导入：H1=阶段 / H2=主题 / H3=学习内容（P3-2）

#### 解析规则

- # H1 → **阶段**（content_phases，career_key = 当前领域，is_custom = TRUE，owner_id = uid，track = main）；
- ## H2 → **该阶段下的主题**（content_topics，is_custom = TRUE + owner_id）；
- ### H3 → **主题内「学习内容」条目**（新表，见下）；H3 下的正文（段落/列表）作为该条目的 content_md；
- 容错：跳过正文开头到第一个标题之间的引言；缺 H2 的 H3 归到「默认主题」；H1 缺失时整篇归到「导入的学习内容」阶段；代码块内的 # 不计；标题超长截断（阶段 60 / 主题 80 / 条目 80）；连续空标题忽略；CRLF 归一（看板踩坑 1）。

#### 存储（**决策 D6**）

**推荐**：新增 content_topic_items（id, topic_id, title, content_md, sort_order, created_at, updated_at），主题详情页（apps/mobile/src/app/phase/[id].tsx 与 Web 对应页）新增「学习内容」折叠列表，支持勾选完成（复用 progress 或新增 topic_item_done 表）。

**备选**（改动最小）：把 H3 内容拼成 Markdown 存进 content_topics.summary 或新增 content_md 列 —— 缺点是无法逐条勾选/排序/搜索。

#### 入库 API

- POST /api/roadmap/import：body { career?, phases: [{ title, summary?, topics: [{ title, summary?, items: [{ title, contentMd }] }] }], dryRun? }；
- 事务写入（pgPool.connect() + BEGIN/COMMIT/ROLLBACK，见看板踩坑 38），逐级继承 owner_id；
- 限额：阶段 ≤ 50、主题 ≤ 500、条目 ≤ 2000、请求体 ≤ 512KB；超限 400；
- 幂等：每次导入生成 import_batch_id，content_phases/topics 记 client_id = md-<batch>-<n>，重试不重复插入；
- 返回 { created: { phases, topics, items }, skipped }，前端给导入报告。

#### 入口（**决策 D7**）

| 端 | 方案 | 依赖 |
| --- | --- | --- |
| Web /roadmap | input type=file accept=.md,.markdown,.txt + FileReader 读文本 → 预览树 → 确认导入 | **零新增依赖** |
| 移动端（推荐先做） | **粘贴文本** + 预览树 + 确认导入 | 零新增依赖 |
| 移动端（可选） | 系统文件选择 expo-document-picker + expo-file-system 读文件 | **新依赖**，需重新构建 APK（看板踩坑 69：首次编译开销） |

预览树：阶段 3 · 主题 12 · 内容条目 48 + 可展开核对，支持「取消某条」。

---

## 5. 看板剩余任务合并（本轮一起收口）

| # | 任务 | 状态/依赖 | 建议 |
| --- | --- | --- | --- |
| 1 | 真机复测（v4 8 项 / v5 5+1 项 / v5.1 一键开始） | 本轮反馈即复测结果 | v6 出包后一并回归 |
| 2 | 存量用户手动升级一次（旧 OTA 清单被强缓存） | 需发版说明 | v6 发布页附「手动下载」引导 |
| 3 | OPPO 内测复测（附录 A 五点触控自检） | 等用户回传 | 保持跟进 |
| 4 | **公安备案**（beian.mps.gov.cn） | ICP 后 30 日内义务 | 尽快，独立于代码 |
| 5 | 各大安卓市场送审（华为/小米/OPPO/vivo/荣耀） | 材料已备（docs/APP端上架素材与隐私说明.md） | v6 稳定版送审 |
| 6 | 微信登录上线 | 等开放平台资质 + WECHAT_STATE_SECRET | env 门控已在，配置即生效 |
| 7 | 邮箱找回密码 | 等 EMAIL_API_KEY / EMAIL_FROM | 同上 |
| 8 | 生产 schema_migrations 核验 024–028 | 未做 | 一次 SSH 核对 |
| 9 | OTA 启动静默检查 + 角标 | **实际已做**（v2 阶段 D），看板条目滞后 | 文档订正 |
| 10 | V3 可选增强：wger 式三层训练计划、简历导出 DOCX/JSON、雷达 What If/通知、习惯归档页与年度热力图 | 无阻塞 | 排到 v7 |
| 11 | 看板述滞后订正：HEAD 仍写 main@612fc21、迁移号仍写 042（实际 046）、Web 线上行只提 044/045、v5 段缺 v5.1 与 v1.4.2 记录、饮食 v3 误列为未完成、OTA 条目与实际不符 | 纯文档 | 随 v6 一并改（D11） |

---

## 6. 迁移与接口清单（确认后照着做）

| 编号 | 内容 | 备注 |
| --- | --- | --- |
| **047** | pg_trgm + food_items + food_import_runs + meal_entries.food_item_id / grams + foods.meal_tags | 一并登记 db/schema.sql |
| **048** | content_topic_items（含 sort_order / updated_at 触发器）+ content_phases / topics 的 import_batch_id（可选） | 若选备选方案 D6 则不需要 |

| 端点 | 变更 |
| --- | --- |
| GET /api/nutrition/foods | 新增 meal 参数与三级排序 |
| GET /api/foods/search（新） | 模糊搜索（字符覆盖率 + 别名 + 拼音 + 频次） |
| POST /api/nutrition | 新增 foodItemId + grams 分支，服务端换算 |
| POST /api/roadmap/import（新） | MD 解析结果批量入库（事务 + 限额 + 幂等） |
| GET /api/internal/cron?job=food（新） | 食物库增量导入（默认关闭，需显式启用） |
| GET /api/roadmap | 移动端改为传当前 career（服务端无需改） |

**测试要求**（项目铁律）：每个新 route.ts 配 route.test.ts；纯函数（MD 解析、份量换算、发件箱合并、食物搜索排序）全部进 packages/shared 或 apps/mobile/src/lib 做 Vitest 单测；移动端保持 typecheck / lint / test 全绿（当前 151+，web 830+）。

---

## 7. 执行顺序（确认后按此推进）

| 阶段 | 内容 | 产出 / 验收 |
| --- | --- | --- |
| **A · 止血**（0.5-1 天） | P0-1 / P0-2 / P0-3 三个 bug + 同类排查规范 | 出 **v1.5.0 / versionCode 18** 热修包；真机：抽屉拖拽不崩、份量滑杆不崩、飞行模式手动添加可见 |
| **B · 饮食体验**（1-2 天） | 2.1 网格重排 + 2.2 餐次感知 + 2.4 顺手项 | 真机截图对比（一屏 6-8 个食物） |
| **C · 食物数据库**（2-4 天） | D1 / D2 决策 → 迁移 047 → 导入脚本 → 搜索接口 → 克数录入 | 库内 ≥ 2000 条且模糊搜索命中「番茄鸡蛋面 / 鸡旦」；600g 换算正确 |
| **D · 训练 UI**（1 天） | 3.1 + 3.2 | 真机截图：分类大卡片 + ± 分离 |
| **E · 学习自建 + MD 导入**（2-3 天） | D4-D7 决策 → 迁移 048 → 解析器 + 导入 API + 入口 UI | 导入一份含 H1/H2/H3 的 .md，预览树正确、入库后可勾选 |
| **F · 收尾**（0.5 天） | 看板订正 + THIRD_PARTY 许可记录 + 出包 / 部署 / 门户与二维码 | 线上 OTA 清单指向新版本 |

> 每阶段结束**统一部署**（沿用看板既有约定：tar → scp → 解包（禁止 --delete）→ docker compose up -d --build；APK 用 scripts/build-android-release.ps1 并核对签名 MD5 3057105285981cc18597a95c1370c147）。

---

## 8. 待你确认的决策点

| 编号 | 决策 | 我的建议 |
| --- | --- | --- |
| **D1** | 食物数据源与许可 | OFF（ODbL，署名+开放）+ USDA（CC0）+ 自建中餐 200 条；**不使用**无 license 的《中国食物成分表》JSON（除非你接受版权风险） |
| **D2** | 表模型 | 新建 food_items 基准库（方案 B），现有 foods 当「我的常用」 |
| **D3** | 模糊搜索 | **字符覆盖率**（中文友好）+ 别名 + 拼音，服务端排序；客户端 300ms 防抖（pg_trgm 对纯中文失效） |
| **D4** | 学习页是否跟随领域 | 是（career 参数化，默认回落 ict）；跳过职业的用户给空态引导 |
| **D5** | 空态入口 | 导入 MD / 手动新建阶段 / 从模板创建 三入口 |
| **D6** | H3 内容存储 | 新建 content_topic_items（可勾选/排序）；备选塞 content_md |
| **D7** | MD 导入入口 | Web 选文件 + 移动端粘贴文本（零新依赖）；移动端文件选择作为可选增量 |
| **D8** | 份量交互 | 基准库食物按**克数**录入；foods 常用食物保留 ± 份量 |
| **D9** | 训练分类卡形态 | 2×2 大卡（84-96 高）+ 按压缩放动效；动作明细三字段竖排/分块 |
| **D10** | 版本与发布 | 阶段 A 出 v1.5.0 热修；B-E 合并 v1.6.0 |
| **D11** | 是否顺带订正看板滞后表述 | 是（纯文档，随本轮提交） |
| **D12** | 是否顺带实现「抽屉上滑全屏」 | 建议做：给 86%/94% 的高弹层（添加饮食、训练记录）传 expandable，上滑到 94% 且内容区可滚；其余小弹层保持不变 |

---

## 9. 风险与回滚

1. **食物库许可**：ODbL 有「衍生库同许可开放」的要求 —— 我们的立场是「导入部分保持开放署名，用户自建数据归用户」，会在 THIRD_PARTY.md 与 App 关于页写清；若你不接受，退回「自建 200 条 + 用户自定义」方案（功能一样，只是初始覆盖少）。
2. **pg_trgm 扩展**：迁移里 CREATE EXTENSION IF NOT EXISTS pg_trgm 在 PG16+ 属 trusted 扩展（库 owner 可建）；若生产账号权限不足，迁移会失败 → 备选：应用层 ILIKE + 别名表兜底（功能略弱）。
3. **MD 导入脏数据**：全部走预览 + 事务 + 限额；导入实体 is_custom = TRUE + owner_id = uid，与内置内容隔离，误导入可整批删除（删除阶段即级联删主题/条目）。
4. **灰度**：A 阶段热修先立即可用；C / E 涉及迁移，部署顺序为 **先 init 迁移 → 再 web → 再出包**（与 v3 同流程）。
5. **崩溃类改动无法靠单测覆盖**：验收依赖真机（release 包）+ adb logcat；模拟器缺硬件加速跑不起来（看板踩坑 65），需要你配合真机验证。

---

## 10. 需要你回传的信息（可选，能加速定位）

1. 闪退时能否顺手抓一份日志：adb logcat -d 输出（含 Worklets / FATAL EXCEPTION 那几行），能确认 1.1 / 1.2 的根因判断；
2. 手动添加那台设备是**已登录**还是**未登录 / 登录过期**（决定 P0-3 走的是哪条分支）；
3. D1 数据源倾向：只要能搜到中餐就行（自建为主），还是希望尽量大而全（OFF / USDA）。



