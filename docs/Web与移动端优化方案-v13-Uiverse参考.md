# Web 与移动端优化方案 v13 · Uiverse 组件参考

> 状态：**待确认**（确认后开工，不确认不动手）。方案生成日：2026-09-21。
> 参考来源：[uiverse.io](https://uiverse.io/) · 归档仓 [uiverse-io/galaxy](https://github.com/uiverse-io/galaxy)（13k star，3000+ 元素，**MIT 许可**，README 明确 "free to use"，署名非强制但建议保留）。
> 本地复现：`node scripts/uiverse/fetch-elements.mjs` → `node scripts/uiverse/build-sheets.mjs --picks scripts/uiverse/picks.json` → `node scripts/uiverse/screenshot-sheets.mjs --only picks`，产物在 `.local/uiverse/sheets/picks-*.png`。

---

## 0. 结论先说

Uiverse 上的元素**绝大多数是"炫技展示型"**（霓虹赛博、3D 水晶按钮、拟物开关、品牌卡片），直接搬会和我们"暖象牙纸感 + 晴空蓝 + 阳光橘"的安静语言打架，也会在低端机掉帧。

所以本轮的原则是 **只借"技法"，不搬"皮肤"**：从 3802 个元素里筛出 **20 个可用参考**，拆成 **12 个改造项（U1–U12）**，分 3 批，落在我们已有的组件与页面上，颜色/圆角/字体全部走现有 token。

---

## 1. 选型原则（评审时按这 5 条卡）

1. **技法优先**：只取"怎么实现"（缓动曲线、遮罩、描边动画、浮动标签、进度环画法），不取配色与插画。
2. **有明确落点**：每一项必须写出要改的具体文件 / 页面，写不出的不立项。
3. **双端可落地**：Web 用纯 CSS（不引第三方动效库）；移动端优先 `react-native-svg` + Reanimated（禁止 backdrop-filter / conic-gradient 这类 Web-only 特性硬搬）。
4. **不动 token 体系**：颜色一律用 `--color-*` / `packages/ui` 的 `oilPainting`；新增的只有"动效时长/缓动"这一组新 token。
5. **性能与可访问性**：只用 `transform` / `opacity` 做动画；统一 `prefers-reduced-motion`（Web）与 `MOTION_ENABLED`（移动端低端机降级）双开关。

---

## 2. 参考清单（20 个）

链接规则：`https://uiverse.io/<作者>/<元素名>`；GitHub 归档路径 `<分类>/<作者_元素>.html`。

### ① 骨架屏 / 加载 / 进度

| 参考 | 技法 | 落点 |
| --- | --- | --- |
| [zanina-yassine/dangerous-pug-69](https://uiverse.io/zanina-yassine/dangerous-pug-69)（Cards） | 卡片骨架行 + 顶部细进度条，缓动 `cubic-bezier(0.15,0.83,0.66,1)`；"Load more"实心胶囊按钮 | 全局 `components/ui/skeleton.tsx`（**新建**）、招花列表分页按钮 |
| [Praashoo7/stale-bat-2](https://uiverse.io/Praashoo7/stale-bat-2)（loaders） | 斜切高光 `linear-gradient(105deg, transparent, rgba(255,255,255,.75), transparent)` + `skewX(-18deg)` 扫光（我们 `.badge-new` 已有同款，抽成 `.shimmer` 复用） | 骨架块、正在同步的行、上传进度 |
| [VashonG/jolly-yak-23](https://uiverse.io/VashonG/jolly-yak-23)（loaders） | **conic-gradient + radial mask 画圆环**，`animation: spin`；无需 SVG | 健康 readiness 环、计时进度环、周目标环 |
| [Nawsome/kind-mole-87](https://uiverse.io/Nawsome/kind-mole-87)（loaders） | 分步骤"打字机/多段式"加载（多关键帧接力） | "正在生成学习计划"这类长任务的分段进度文案（可选） |

### ② 按钮与按压反馈

| 参考 | 技法 | 落点 |
| --- | --- | --- |
| [seyed-mohsen-mousavi/bitter-snail-5](https://uiverse.io/seyed-mohsen-mousavi/bitter-snail-5)（Buttons） | 3D 立体按压：`translateY` + 多层 box-shadow 收放 | `components/ui/button.tsx` 新增 `pressed` 表现（主 CTA） |
| [elijahgummer/friendly-wasp-61](https://uiverse.io/elijahgummer/friendly-wasp-61)（Buttons） | 图标位移动画 + 状态切换（发送中 → 已发送，含 `planeSlide/hideSending` 关键帧） | 提交类按钮的 `loading → success` 过渡（打卡、同步、上传） |
| [Sameer2244/friendly-wasp-57](https://uiverse.io/Sameer2244/friendly-wasp-57)（Buttons） | 长按填充（按住 0.X s 填满才触发） | 删除/清空等危险操作的二次确认 |
| [alessandrodesign/empty-rabbit-96](https://uiverse.io/alessandrodesign/empty-rabbit-96)（Buttons） | hover 时描边"游走"（伪元素边框绘制） | 大块卡片式入口（学习路线章节卡、下载页 CTA） |
| [ShadowShahriar/nervous-goat-3](https://uiverse.io/ShadowShahriar/nervous-goat-3)（Buttons） | 渐变描边 + 辉光（conic/linear 双色描边） | 与现有 `.glow-border` 合并为一套"重点按钮"样式 |
| [MuhammadHasann/tough-tiger-78](https://uiverse.io/MuhammadHasann/tough-tiger-78)（Buttons） | 深色胶囊 + 内阴影 + 轻 `backdrop-filter` 的"安静"按钮 | 次级按钮（我们的 `secondary` 变体精修） |

### ③ 输入 / 搜索 / 上传

| 参考 | 技法 | 落点 |
| --- | --- | --- |
| [Li-Deheng/tiny-chicken-50](https://uiverse.io/Li-Deheng/tiny-chicken-50)（Inputs） | 浮动标签（placeholder 上浮成 label）+ 圆角克制描边 | `components/ui/input.tsx`、设置页表单 |
| [PhanDangKhoa96/swift-warthog-78](https://uiverse.io/PhanDangKhoa96/swift-warthog-78)（Inputs） | 聚焦时 `conic-gradient` 旋转描边（`bg-spin 5s linear infinite`） | 与现有 `.glow-border` 统一：输入框聚焦态 = 慢速旋转描边（**只在聚焦时**） |
| [OnlyCodeChannel/ugly-penguin-43](https://uiverse.io/OnlyCodeChannel/ugly-penguin-43)（Inputs） | 胶囊搜索框 + 内嵌圆形提交按钮 | 招花/题库/装备库搜索栏 |
| [Jerome-W-90/shy-jellyfish-2](https://uiverse.io/Jerome-W-90/shy-jellyfish-2)（Forms） | 上传卡片：图标 + 说明文案 + 关闭按钮 + 悬浮反馈 | 简历上传（Web `components/resume/resume-files-card.tsx`、移动端 `src/components/resume-files-card.tsx`）、运动档案图片上传 |
| [sameer2malik/serious-duck-16](https://uiverse.io/sameer2malik/serious-duck-16)（Forms） | 登录卡：浮动标签 + 柔和多层阴影 + 底部大按钮 | 登录页、`settings` 账号卡 |
| [zanina-yassine/yellow-jellyfish-91](https://uiverse.io/zanina-yassine/yellow-jellyfish-91)（Forms） | 图标徽章 + 标题 + 说明 + 内嵌按钮的小卡 | 设置页"订阅/提醒"类开关卡、空状态引导 |

### ④ 清单 / 开关 / 卡片质感

| 参考 | 技法 | 落点 |
| --- | --- | --- |
| [JkHuger/warm-panther-74](https://uiverse.io/JkHuger/warm-panther-74)（Checkboxes） | 勾选时 SVG `stroke-dasharray` 描边动画 + 完成时的细"烟花"粒子 | 每日任务清单（Web `/today`、移动端今日页）勾选动画 |
| [JkHuger/itchy-turtle-45](https://uiverse.io/JkHuger/itchy-turtle-45)（Toggle-switches） | 日/月主题开关：`cubic-bezier(.8,.5,.2,1.4)` 过冲 + `inset` 阴影 + 日夜形变 | 设置页深色模式开关（Web + 移动端） |
| [Smit-Prajapati/funny-sloth-75](https://uiverse.io/Smit-Prajapati/funny-sloth-75)（Cards） | 商品卡：图片区 + 心形收藏角标 + 价格胶囊 + 悬停抬升 | 装备图鉴卡（839 款装备）、装备库列表 |
| [sohoning/ugly-horse-87](https://uiverse.io/sohoning/ugly-horse-87)（Cards） | "1st"奖杯卡：大图形 + 头像行 + `slide-in-top` 入场 | 证书页、学习里程碑、习惯连续打卡达成 |
| [roroland/heavy-horse-27](https://uiverse.io/roroland/heavy-horse-27)（Cards） | 头像卡：多层柔和阴影 + 圆形头像 + 简介 | "我的"页账号卡（现有玻璃卡再精修一档） |
| [VashonG/happy-insect-24](https://uiverse.io/VashonG/happy-insect-24)（Cards） | 磨砂浮层 + 底部图标行 | 专注页/计时页的玻璃浮层、TabBar 之上的操作条 |
| [david-mohseni/young-frog-89](https://uiverse.io/david-mohseni/young-frog-89)（Cards） | 秒表表盘（刻度 + 指针 + 中心轴） | 计时页"正计时"表盘视图（**待定，见 §5**） |

### ⑤ 通知 / 底纹

| 参考 | 技法 | 落点 |
| --- | --- | --- |
| [Yaya12085/smooth-seahorse-63](https://uiverse.io/Yaya12085/smooth-seahorse-63)（Notifications） | 图标徽章 + 标题 + 副标题 + 右侧主按钮的"成就通知"卡 | 全局 toaster（`components/ui/toaster.tsx`）成功态、升级/里程碑提示 |
| [WittyHydra/nervous-zebra-0](https://uiverse.io/WittyHydra/nervous-zebra-0)（Notifications） | 顶部细进度条 = 剩余停留时间（自动消失可视化） | toaster 自动关闭倒计时、同步进行中提示 |
| [csemszepp/old-hound-37](https://uiverse.io/csemszepp/old-hound-37)（Patterns） | 几何拼花（橙/红/青绿，恰好贴我们的暖色 + 点缀色） | 空状态插画底、hero 区 3%–6% 不透明度底纹 |
| [csemszepp/kind-frog-70](https://uiverse.io/csemszepp/kind-frog-70)（Patterns） | 3D 人字纹（`conic-gradient` 平铺，纯 CSS 无图） | "数据为空/未登录"页的灰阶底纹 |

---

## 3. 改造项（U1–U12）与批次

> 每批可独立发布；默认按 v12 的做法 **全部做完再发一个版本 v1.21.0**（移动端 versionCode 34）。

### 批次 1（P0 · 观感与"不假死"）

- **U1 统一骨架屏体系**：Web 新建 `components/ui/skeleton.tsx`（含 `.shimmer` 工具类，替换现有 5 处 `animate-pulse`：`today/page.tsx`、`jobs/page.tsx`、`wellbeing`、`focus-timer`、`job-modal`）；移动端新建 `src/components/skeleton.tsx`（Reanimated 平移渐变，低端机降级为透明度呼吸）。
- **U2 进度环技法统一**：Web 用 conic+mask 画环，替换 SVG 环里偏"工程感"的部分（`readiness-hero.tsx`、`focus-timer.tsx`、仪表盘周目标）；移动端同形态用 `react-native-svg` 实现，**参数（线宽/圆头/缓动）与 Web 对齐**。
- **U3 计时表盘（可选）**：计时页增加"表盘/圆环"视图切换，表盘借鉴 `david-mohseni/young-frog-89`。
- **U4 全局 Toast 统一**：重做 `components/ui/toaster.tsx`（图标徽章 + 副标题 + 自动关闭进度条），移动端 `src/components` 内轻提示同款；**只改样式，不改现有调用 API**。

### 批次 2（P1 · 交互手感）

- **U5 按钮三态**：`button.tsx` 增 `pressed`（按下 0.98 + 阴影收）与 `loading`（内嵌 spinner + 文案切换），补 `success` 瞬时态（提交成功 1.2s 后复位）；危险操作按钮用长按填充。
- **U6 表单/输入精修**：浮动标签、聚焦旋转描边（仅聚焦时，10s 一圈，尊重 reduced-motion）、胶囊搜索 + 内嵌圆形提交。
- **U7 上传卡**：简历与档案图片上传统一"上传卡"（拖拽/点击、进度、失败重试、删除），Web 与移动端样式同源。
- **U8 清单勾选动画**：任务勾选 = 对勾描边绘制 + 轻微 scale，达成当日全清时触发一次克制的庆祝动效。
- **U9 主题开关**：设置页深色模式换成日/月形变开关（过冲缓动），Web 与移动端一致。

### 批次 3（P2 · 质感与个性）

- **U10 装备图鉴卡**：装备卡统一为"图片区 + 收藏角标 + 型号/价格胶囊 + 悬停抬升"。
- **U11 成就/里程碑卡**：证书页与学习里程碑用奖杯卡形态，含入场动画与达成日期。
- **U12 空状态与底纹**：`components/ui/empty-state.tsx` 升级（几何底纹 + 一句可执行建议 + 主按钮），今日 hero 加 3%–6% 低透明度拼花底。

---

## 4. 明确**不采纳**的（负向清单）

| 不采纳 | 原因 |
| --- | --- |
| 霓虹/赛博/故障（glitch）风格按钮与卡片 | 与"安静纸感"语言冲突；深色下刺眼 |
| 3D 水晶、玻璃拟物、金属拉丝按钮 | 单一组件 CSS 体量大、低端机掉帧、与我们扁平静态 CTA 不一致 |
| 拟物开关（指纹、拨杆、双色胶囊） | 可用性差（状态不易读），且无对应业务语义 |
| 品牌展示卡（Tesla/GitHub/Netflix 等） | 无业务落点 |
| 拟物大插画 loader（警车、魔方、土星、打印机） | 与"加载要快要静"冲突，且多为位图/SVG 重资源 |
| 反色/荧光渐变文字卡 | 可读性与深色模式适配成本高 |

---

## 5. 需要你拍板的 3 个点（我给了建议值）

1. **计时表盘（U3）**：建议**做**，但作为"可选视图"（默认仍是圆环），正计时可切表盘。
2. **底纹 Pattern（U12）**：建议**做**，仅限"空状态 + hero"，不透明度 ≤6%，深色模式改用灰阶。
3. **批次发布**：建议 **3 批全部做完再发 v1.21.0 一个版本**（沿用 v12 做法）；若想早点看观感，也可先发批次 1 作为 v1.20.1。

---

## 6. 工程约束与验收

**必须遵守**
- 动画只用 `transform`/`opacity`（Web 侧 `box-shadow`/渐变仅限 hover，不参与逐帧）；时长 150–400ms；新增 `--motion-fast/base/slow` 与 `--ease-overshoot: cubic-bezier(.8,.5,.2,1.4)` 两个 token（Web `globals.css` + `packages/ui`）。
- Web **不引第三方动效库**；新技法集中在 `globals.css` 新增 §「Uiverse 借鉴技法」区，避免散落。
- 移动端 worklet 内**禁止调用外部普通函数**，新增共享函数必须带 `"worklet"` 指令并单测（看板踩坑 78/79）。
- 每个新组件/工具函数配套测试：Web `apps/web/components/ui/*.test.tsx`、移动端 `apps/mobile/src/**/*.test.ts`；不得让现有用例回归（web 1148 / mobile 323）。
- 署名：新增 `docs/第三方UI来源与署名.md`，逐条记录 Uiverse 作者 + 链接 + MIT；代码注释保留 `// 技法参考: uiverse.io/<作者>/<元素> (MIT)`。

**验收**
- `pnpm -F web typecheck` / `lint` / `test`；移动端 `tsc --noEmit` + vitest；两条迁移校验脚本不受影响。
- 真机复测：新动效在低端机（红米/OPPO A 系）是否掉帧；深色模式对比度；`prefers-reduced-motion` 与 `MOTION_ENABLED=false` 两条降级路径；勾选/上传/开关四条手势路径（按下/拖动/松手/取消）。
- 视觉对比截图留档到 `.local/uiverse/sheets/`（自动拼版可复现）。

---

## 7. 附：本轮筛选过程（可复现）

- 归档仓 `uiverse-io/galaxy`（MIT，13300+ star）：Buttons 1231 / Cards 726 / loaders 718 / Toggle-switches 260 / Inputs 226 / Forms 180 / Checkboxes 171 / Patterns 103 / Radio-buttons 102 / Tooltips 62 / Notifications 23，合计 3802 个元素，已全量拉到本地。
- 自动排序脚本按"技法分"（conic/backdrop/mask/keyframes/cubic-bezier/3D/内阴影 + 调色偏好）取每个分类前 16–48 名出拼版，再人工挑选：见 `scripts/uiverse/`（fetch / build / screenshot 三件套 + `picks.json` 精选清单）。
- 本文档 20 个参考的实拍拼版：`.local/uiverse/sheets/picks-1-loading.png` … `picks-5-toast-pattern.png`。

---

## 8. 实施进度（v13 执行记录，2026-09-21）

> 口径：只有"代码已落地 + 该端 typecheck/测试通过"才标 ✅；未做或待真机验证的单独注明。

| 项 | Web | 移动端 | 说明 / 落地文件 |
| --- | --- | --- | --- |
| U1 骨架屏体系 | ✅ | ✅ | Web：`components/ui/skeleton.tsx`（Skeleton/Text/Card/List）+ `globals.css` 的 `.shimmer`；已替换招花列表、今日/健康/状态球的 3D 懒加载占位 |
| U2 进度环（conic+mask） | ✅ | ✅ | Web：`components/ui/progress-ring.tsx`（`@property --ring-value` 过渡）；仪表盘整体进度环已换用；计时环参数对齐（厚度 12 / 圆头 / 1s linear） |
| U3 计时表盘 | ✅ | ✅ | Web：`components/ui/timer-dial.tsx`（刻度 + 指针 + 中心轴）+ 计时页「圆环 / 表盘」切换，选择写 localStorage，默认圆环 |
| U4 提示条（Toast） | ✅ | ✅ | Web：`components/ui/toaster.tsx` 重做（图标徽章 + 副标题 + 剩余时间进度条）；`store/toast-store.ts` 增 `detail`/`lifeMs`（调用方 API 不变） |
| U5 按压与长按确认 | ✅ | ✅ | Web：`Button` 增 `loading`（内嵌 spinner + 禁用）、全局 `.press`；新增 `components/ui/hold-button.tsx`，简历删除改为「按住删除」 |
| U6 输入 / 搜索 | ✅ | ✅ | Web：`input.tsx` 增 `FloatField`（浮动标签 + 聚焦旋转描边）与 `SearchInput`（胶囊 + 内嵌圆形提交）；已用于证书表单、装备图库、招花搜索 |
| U7 上传卡 | ✅ | ✅ | Web：`components/ui/upload-card.tsx`（拖拽 + 选择 + 进度 + 移除）；简历卡改用它 |
| U8 勾选动画 | ✅ | ✅ | Web：`.check-draw`（SVG 描边绘制）用于今日任务清单已完成的勾 |
| U9 主题开关 | ✅ | ✅ | Web：`components/ui/theme-segmented.tsx`（滑块过冲 + 图标形变），替换设置页三个按钮，仍保留浅色/深色/跟随系统三档 |
| U10 装备图鉴卡 | ✅ | ✅ | Web：装备图库弹层（悬停抬升 + 品牌胶囊 + 选它提示）、运动档案「主力装备」改两列图鉴卡 |
| U11 成就 / 里程碑卡 | ✅ | ✅ | Web：证书页已达成证书升级为奖杯卡（顶部色带 + 奖杯徽章 + 拼花角标 + 悬停抬升） |
| U12 空状态与底纹 | ✅ | ✅ | Web：`empty-state.tsx` 支持 `bauhaus`/`chevron` 低透明度底纹（默认人字纹）；今日 hero 加 3%–6% 拼花底 |

**Web 校验（2026-09-21）**
- `tsc -p apps/web --noEmit`：0 错误。
- `vitest run --root apps/web`：**170 文件 / 1152 用例全绿**（含新增 `lib/ui-kit.test.ts` 4 例）。
- `eslint apps/web`：**0 error**（51 条既有 warning），顺手修掉两处历史 error：`api/internal/interview/import/route.ts` 的 `module` 变量名、计时页 effect 内同步 setState。
- `next build` 生产构建通过（exit 0），产物 CSS 已确认包含全部新增类（`.shimmer`/`.ring-conic`/`.pattern-bauhaus`/`.pattern-chevron`/`.spin-border`/`.check-draw`/`.toast-progress`/`.press`/`.lift`）。
**移动端校验（2026-09-21）**
- `cd apps/mobile && node node_modules/typescript/bin/tsc --noEmit`：**0 错误**。
- `vitest run --root apps/mobile`：**37 文件 / 343 用例全绿**（原 323 全保留 + 新增 20：`theme/motion.test.ts` 7 / `components/skeleton.test.ts` 9 / `components/pattern-backdrop.test.ts` 4）。
- `npx eslint src`：**0 error**（69 条既有风格 warning）。
- 移动端落地要点：`theme/motion.ts`（含 `MOTION_ENABLED` 总开关，低端机可一键停掉全部装饰动画）；骨架屏用「呼吸 + 8% 白色高光条横扫 1.6s」替代 RN 不支持的 CSS 渐变；进度环保持 `react-native-svg` 并统一厚度 10 / 圆头 / 400ms 标准缓动；表盘/勾选/开关全部 `Pressable + Reanimated`，**未改任何 `Gesture.*`**，worklet 内只读写共享值。
- 与方案的两处诚实偏差：① 装备数据无价格字段，图鉴卡胶囊显示类别/标签而非价格；② Toast 的“副标题”能力已实现，但现网唯一调用点只有一句文案，未编造副标题。

**待真机验证（本机无设备，留给用户）**
- 新动效在低端机是否掉帧（掉帧就把 `theme/motion.ts` 的 `MOTION_ENABLED` 置 false）；
- 深色档对比度、`MOTION_ENABLED=false` 与系统「减弱动态」两条降级路径；
- 勾选 / 上传 / 日夜开关 / 表盘切换四条交互路径（按下 / 拖动 / 松手 / 取消）。

