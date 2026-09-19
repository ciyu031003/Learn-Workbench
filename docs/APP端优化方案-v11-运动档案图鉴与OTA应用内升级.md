# APP 端优化方案 v11 —— 运动档案图鉴、闪光卡 v2 与 OTA 应用内升级

> 触发：2026-09-19 真机验收 v1.9.0 运动闪光卡后的反馈（原文要点）：
> ① 健康页点「运动闪光卡」跳过去的运动档案页**没做全屏优化，很烂**；
> ② 运动档案**在底部 tab 栏多了一个入口**（就在「我的」右边）—— 底部 tab 栏不要出现它，改成**只在健康页放一个「运动档案」入口**，点进去就是档案页；
> ③ 登录取档后点闪光卡，**卡背全黑没有任何内容**；
> ④ 正面的「林丹杯亚军」只在**一个小角落**里 —— 这是荣誉，要**着重放大**；
> ⑤ 卡下方的档案信息（球拍类型/型号等）不要只是个小框，**参考上传的第 5 张图**做整套档案图鉴，并支持用户**自己上传图片**（羽毛球拍 / 自己的照片 / 球鞋 / 拍线…）；
> ⑥ 健康页与饮食页**参考图 1 / 图 4 的设计**进一步优化；
> ⑦ OTA 每次都要**打开浏览器**才能下载 —— 改成**应用内弹窗下载 + 进度条 + 下载完直接安装**，且**安装后不用重新登录**。
> ⑧ （同日补充）**运动档案主要以图 5 这张图片的形式展现**；**闪光卡片放到右上角做入口**，点击后**卡片从小到大旋转弹出、全屏展示**，**卡片下方一个叉号**点击即可关闭。
> ⑨ （同日补充）**爬取运动装备商品图**（如「李宁雷霆 80 羽毛球拍」）：只留主体、白底，全量抓取后放 COS 桶；App 里能**从图库选择装备**并直接显示图片（见 §3.3）。

---

## 1. 问题清单与根因（先修「烂」，再谈「美」）

| # | 现象 | 根因（已定位到代码） | 处理 |
| --- | --- | --- | --- |
| P0-1 | 运动档案成了第 6 个 tab | `app/_layout.tsx` 用 expo-router `<Tabs>`：**目录下每个路由都会自动成为一个 tab**，次级页必须显式 `<Tabs.Screen name="X" options={{ href: null }} />`。v1.9.0 新增 `sports-card.tsx` 时**漏了这行**，于是它带着默认空标题排在了「我的」右边 | 补 `href: null`；并把「新增页面必须同步登记」写进踩坑清单 |
| P0-2 | 档案页不是全屏、观感差 | 该页沿用 Tab 内的普通列表页写法：有底栏占位、头部是一行 `ScreenHeader`、内容只有「卡 + 信息 Surface」两段，没有沉浸式头图与固定操作条 | 重做为**全屏沉浸页**（见 §3），页面主体＝图 5 的「球员卡式图鉴」；**闪光卡不再内嵌**，改为右上角入口 + 全屏弹出（§2.3/§2.4） |
| P0-3 | 卡背全黑、没有内容 | ① 卡背用 `rotateY(180deg) + backfaceVisibility: hidden` 的双面方案，**Android 上 backfaceVisibility 行为与 iOS 不一致**，翻过去后整面被判为「背面朝里」而不绘制；② 卡背内容本身也只有「幻 + 典藏号」两行，即使画出来也像空卡 | 卡背改用**不依赖 backfaceVisibility 的交叉淡入 + scaleX 收束**方案；卡背重新设计成**有内容的荣誉/装备背面**（见 §2.2） |
| P0-4 | 荣誉（林丹杯亚军）显示太小 | 荣誉目前是卡面信息面板底部的**小徽章**（9pt 胶囊），与「荣誉」的分量不匹配 | 卡面 v2 新增**荣誉区**：主荣誉大字（24–28pt）+ 奖杯/奖牌图形 + 金描边，最多 3 条按重要性排序（见 §2.1） |
| P0-5 | 档案信息只是一个小框 | v1.9.0 只是把 `gear` 渲染成几行 label/value | **整页按参考图 5 重做**（这是档案页的主视图）：头图 + 姓名/VIP 标 + 编号 + 地区生日 + 四宫格（身高/体重/鞋码/磅数）+ 大图装备卡（球拍/球鞋/拍线三段式）+ 底部「编辑档案」；卡片挪去右上角（§2.3） |
| P0-6 | OTA 必须跳浏览器 | `lib/ota.ts` 现在只做「检查清单」；`settings.tsx` 用 `Linking.openURL(apkUrl | DOWNLOAD_PAGE_URL)` 交给系统浏览器 | 新增**应用内升级**：弹窗 + 进度条 + 断点续传 + 直接调起安装器（见 §6） |
| P0-7 | 安装后是否要重新登录 | 登录令牌在 `expo-secure-store`（Keychain/Keystore），**同签名 + versionCode 递增的覆盖安装不会清数据** | 无需额外逻辑；升级流程里**不出现「卸载重装」引导**，并在验收清单里加「升级后 token 仍在」一条 |

> 结论：v11 = **一个必修（tab/全屏/卡背）+ 一个重构（图鉴式档案 + 图片上传）+ 两个设计升级（健康/饮食）+ 一条新链路（OTA 应用内升级）**。

---

## 2. 运动闪光卡 v2

### 2.1 正面：给「荣誉」应有的分量

版式（自上而下）：

1. **荣誉带**（新增，占卡面视觉重心上部）：
   - 主荣誉 = **大字**（如「林丹杯 · 亚军」），左侧奖杯图标，金色描边/渐变字；
   - 副荣誉最多 2 条，小一号列在下方，仍是**可读字号**（≥12pt）而不是 9pt 胶囊；
   - 数据来源：`highlights`（已有 label=赛事 / value=成绩），新增**排序与「主荣誉」标记**（见 §4）。
2. 标题区：英文小标 + `<运动名>档案` + 典藏年（沿用 v1.9.0，字号略放大）。
3. **数据带**（左栏 等级/装备摘要、右栏 战绩/胜率）：只在「有空间」时展示，宽度不够时优先保留战绩三项。
4. 底部：绝技大字 + `N 战 · M 胜 · 胜率 X%` + 编号。

> 交互不变（拖动倾斜 + 点按翻面），但**信息权重重排**：荣誉 > 绝技 > 战绩 > 装备。

### 2.2 背面：不再是一张黑卡

卡背重新设计为「荣誉背面」，必须**在任何机型上都画得出来**（不再依赖 backfaceVisibility）：

- 结构：暗底描金边框 + 中央「幻」印 + **荣誉清单（大字号 2–3 条）** + 装备剪影（球拍/球鞋小图，取自用户上传图） + 防伪编号（BN 编号）+ 二维码（指向该档案的公开分享页，未公开时指向 App 内页）；
- 翻面动效：正面 `opacity 1→0` + `rotateY 0→90deg`，背面 `rotateY -90deg→0` + `opacity 0→1`（两段串行 timing，**不用 backfaceVisibility**）；
- 卡背内容与正面共用同一份 `SportsCardModel`，Web 三维卡的背面同步升级（现在只有描金「幻」）。

### 2.3 展示方式：不内嵌，右上角入口 + 全屏弹出（**本轮用户明确要求**）

运动档案页**不再内嵌卡片**。页面主体就是图 5 的「档案图鉴」（§3），闪光卡只作为一个**右上角入口**：

- 入口形态：右上角一枚**小尺寸闪光卡缩略**（约 44×60，带极轻流光扫过）/ 兜底用 `sparkles` 图标 + 「闪光卡」文字；
  未建档或该运动无卡面素材时置灰不可点；
- 点击后：**卡片从小到大 + 旋转弹出，铺满全屏展示**（详见 §2.4）。

### 2.4 全屏弹出的动效与关闭

| 环节 | 规格 |
| --- | --- |
| 起始态 | 卡片起点 = 右上角入口按钮的位置与尺寸（`measureInWindow` 取按钮中心与宽高）→ `scale ≈ 0.08`、`rotateY ≈ -180°`、`opacity 0`；遮罩 opacity 0 |
| 入场 | 遮罩 `withTiming(0.72, 220ms)`；卡片 `rotateY → 0` + `scale → 1` + `opacity → 1`（`withTiming(..., { duration: 620, easing: Easing.out(Easing.cubic) })`）——**不收尾回弹**（沿用 v9「不要弹跳」的偏好） |
| 展开后 | 卡片居中、宽度 = 屏宽 − 32、保持 1728:2368 比例；背后是暗色遮罩（**点遮罩也能关**）；卡面仍可拖动倾斜、点按翻面 |
| **关闭** | 卡片**下方 24pt 处一枚圆形叉号按钮**（半透明底 + 白叉，触控 ≥44）；点击 → 反向动画（缩小 + 反向旋转 + 淡出回右上角按钮位置）→ 卸载卡组件 |
| 其它关闭路径 | Android 返回键（先关卡再退页）、遮罩点击、可选「下滑关闭」 |
| 性能 | 卡片**点击后才挂载**（three.js 那套不进首屏；移动端是拟态卡，也不预渲染）；关闭即卸载，扫光/视差动画随之停止 |
| 无障碍 | 弹出层 `accessibilityViewIsModal`，焦点锁在层内；叉号有 `accessibilityLabel="关闭闪光卡"` |

> 这样档案页的滚动与信息密度不被卡片占位拖累，卡片也拿到了它该有的「仪式感」（全屏、专属动效）。

---

## 3. 运动档案图鉴页（参考图 5）

### 3.1 页面结构：以图 5 为**主视图**（全屏沉浸）

> 用户要求：「运动档案主要以这张图片的形式展现」。即打开档案页看到的**就是**图 5 这张「球员卡式图鉴」，不再是「列表 + 卡片 + 小信息框」。

| 区块 | 内容 | 数据来源 |
| --- | --- | --- |
| 顶部条 | 返回 + 居中标题「我的羽球档案」（跟随当前运动）+ **右上角闪光卡入口**（§2.3）+ 更多菜单（分享/删除） | — |
| **Hero 头图** | 用户上传的**本人照片**（横向大图，点图即换图），**右上角压角 VIP 标**（= 等级 `level_text`，如「BADMINTON NERD · VIP」） | `sports_profiles.photo_url`（本次接上传） |
| 身份行 | 昵称/身份（`identity`，大字）+ **编号**（`BNxxxxxx`，创建时生成）+ 地区 · 生日（复用 `user_settings.current_city` / `birth_year`） | 已在库 / 迁移 050 补编号 |
| **四宫格** | 身高 / 体重 / 鞋码 / 磅数（图 5 的四格：数值大字 + 单位小字 + 中文标签） | 身高体重取 `user_settings`；鞋码、磅数新增字段（§4） |
| **装备图鉴** | 每件装备一张**独立大图白卡**：图片 + 型号文案（如 `YONEX 天斧 77 PRO 深橙色 4UG5`）；**球拍、球鞋各一张通栏大图**，**拍线/配件两张并排**（图 5 的三段式） | `gear[]` 增 `imageUrl`（§4） |
| 荣誉区 | 荣誉列表（与卡面同源，可编辑/排序，标注主荣誉；图 5 未展示，放在装备图鉴下方） | `highlights[]` / `honors`（§4） |
| 底部 | 通栏「**编辑羽球档案**」按钮（图 5 的紫字白底按钮），固定在安全区之上 | — |
| 多运动 | 若用户有多条档案：顶部标题下加一行**运动切换 chips**（羽毛球 / 网球 / 篮球…），切换即换整页内容；只有一条时不显示 | `SPORT_CATALOG` 过滤有档案的项目 |

**视觉基线（照图 5 抄）**：页面底色浅灰（`#F5F6F8` 一类）；所有内容块是**白色圆角卡**（radius ≈ 16–20）＋极轻投影；标题/数值走深色，标签走灰；图片卡内图按 `contain` 居中（球拍/球鞋是透明底商品图风格）。

### 3.2 图片上传能力（新增，v11 的基建）

目前**全仓没有上传接口**（`photoUrl`/`imageUrl` 都只是外链文本），所以要新建一条上传链路：

**服务端**

1. `POST /api/uploads`（Node runtime，登录用户，`multipart/form-data`）：
   - 限制：单张 ≤ 8MB、仅 `image/jpeg|png|webp|heic`；
   - `sharp` 统一转 WebP、长边 ≤ 1600px、质量 82（球拍/球鞋这类主体图可 2000px）；
   - 落盘 `/app/uploads/<userId>/<uuid>.webp`（容器内路径 = COS 桶挂载，见下）；
   - 返回 `{ url: "https://learn.yuanabd.cn/uploads/<userId>/<uuid>.webp", width, height, bytes }`；
   - 配额：每用户 ≤ 200 张 / 500MB，超限 429；`DELETE /api/uploads/<id>` 供换图时清理。
2. `docker-compose.yml`：web 服务新增卷 `- /data/learn-workbench/uploads:/app/uploads`（与 `bing` 同款 COS 桶挂载）。
3. nginx（`deploy/nginx/learn-workbench.conf`）：新增
   `location /uploads/ { alias /data/learn-workbench/uploads/; add_header Cache-Control "public, max-age=31536000, immutable"; }`
   （文件名是 uuid，可长缓存）。
4. 迁移 050 建 `uploads` 表登记（id / user_id / path / bytes / width / height / created_at / deleted_at），便于配额统计与清理。

**客户端**

5. 新依赖 `expo-image-picker`（相册选图 + 拍照，需要相机/相册权限文案）；
6. 统一封装 `lib/uploads.ts`：`pickAndUpload(kind)` → 选图（裁剪 3:4/1:1 可选）→ 压缩 → 上传（带进度）→ 返回 URL；
7. 档案页所有图片位（头图、球拍、球鞋、拍线、其他装备）都复用它；Web 端的档案页同步加「上传/换图」（同一接口）。

---

### 3.3 装备图库：爬取商品图（白底主体）→ COS → App 里选图

> 用户要求：像爬「李宁雷霆 80 羽毛球拍」这种商品图一样，**全量爬取各类运动装备图片**，只保留主体（球拍就只要球拍、球鞋就只要球鞋）、**白底**，放到 COS 桶；App 里能**从图库选择装备**，选中后直接显示图片。

#### 3.3.1 形态

- 新增**装备图库**（公共只读）+ **选图器**：档案编辑时点「从图库选择」→ 选类别 → 选品牌/型号 → 自动写入型号文字 **和** 商品图（不用自己拍照）。
- 与 §3.2 的「自己上传」**并存**：图库选不到就自己拍/传（同一套 `imageUrl` 字段，两种来源无差别）。
- 图库**不进 APK**：图片走 HTTPS（COS + nginx 长缓存），App 端按 `expo-image` 的磁盘缓存离线复用。

#### 3.3.2 爬取与图片规范化（关键：只留主体 + 白底）

脚本：`scripts/crawl_equipment.mjs`（本地跑，产出 staging 目录 + manifest，**不做每日 cron**，可重复运行、幂等）。

流程：

1. **采集**：优先品牌**官方商城/官网**的商品 JSON 接口与详情页（每品类维护一份「站点适配器」：列表页/搜索接口 → 型号名 + 主图 URL + 来源 URL），限速（≥1.5s/请求）、UA 正常、失败退避重试；
2. **筛选**：只要**白底/纯浅底**的商品主图（官方商品图基本都是）；背景是场景图/带人物的**直接丢弃**（宁缺毋滥）；
3. **规范化**（`sharp`）：
   - 去白边（`trim`）→ 主体居中 → 长边 ≤ 1000px → **铺白底**输出 WebP（q90），另存一份透明 PNG 备用（可选）；
   - 非白底但主体清晰时，走**可选**去背模块（`@imgly/background-removal-node`，本地 ONNX，不依赖外部 API）→ 白底；该模块只作为开发依赖，**不进运行时**；
   - 统一命名：`<category>/<brand>-<model-slug>.webp`（如 `badminton-racket/li-ning-leiting-80.webp`）；
4. **产出 manifest**：`{ category, brand, model, image, width, height, sourceUrl, sourceSite, crawledAt }[]`，落 `.local/equipment/`。

**可达性实测（2026-09-19，本地）**：`lining.com`、`yonex.cn` 直连 **200**（可直接抓）；`victorsport.com.cn`、`kawasaki-sports.com.cn`、`dhs-sports.com` 当前**不通**（需换正式域名，或改在腾讯云服务器侧抓）。
结论：**每个站点一个适配器**，先跑通 1–2 个（李宁 / YONEX）验证「抓取 → 白底规范化 → 入库 → App 选图」整条链路，再按品类扩站点；不把「全量」压在第一天。

#### 3.3.3 存储与入库

- **图片**：`scp` 到服务器 `/data/learn-workbench/equipment/`（COS 桶），nginx 加 `location /equipment/` 长缓存（同 §3.2 的 `/uploads/`）；
- **数据**：新表 `equipment_items`（§4），导入走 **`POST /api/internal/equipment/import`**（`x-cron-secret` 鉴权，批量 upsert，按 `(category, brand, model)` 唯一键幂等）——与食物库 `cron?job=food` 同款做法，不在本地直连生产库；
- **读取**：`GET /api/equipment?category=&q=&brand=&limit=` 只读公开（可匿名，走 nginx 短缓存/内存缓存），返回白底图 URL + 型号；
- 下架开关：`equipment_items.is_listed=false` 即整条（含图）从图库隐藏，用于合规响应。

#### 3.3.4 App / Web 选图交互

1. 档案编辑页的每行装备（球拍型号 / 球鞋类型 / 拍线…）右侧加「**图库**」按钮；
2. 打开 `EquipmentPickerSheet`：顶部**类别 chips**（球拍 / 球鞋 / 拍线 / 手胶 / 球…）→ 品牌筛选 + 搜索框（支持拼音/型号模糊）→ **三列白底图网格**（图 + 型号 + 品牌），点选即回填 `model` + `imageUrl` + `equipmentItemId`；
3. 选中后档案页/闪光卡直接显示该商品图（球拍、球鞋通栏大图卡就是图 5 的效果）；
4. Web 端档案页同样接入（复用同一 API 与网格组件），保证双端一致。

#### 3.3.5 首版覆盖范围（全量清单见下，分批抓）

| 运动 | 品类 | 首版目标量 |
| --- | --- | --- |
| 羽毛球 | 球拍 / 球鞋 / 拍线 / 手胶 / 羽毛球 | 各 30–50 条热门型号 |
| 网球 | 球拍 / 球鞋 / 拍线 / 网球 | 各 20–30 |
| 乒乓球 | 底板 / 正手胶皮 / 反手胶皮 / 球鞋 / 球 | 各 20–30 |
| 篮球 | 篮球鞋 / 篮球 / 护具 | 各 20–30 |
| 足球 | 足球鞋 / 足球 / 护腿板 | 各 20–30 |
| 排球 | 排球鞋 / 排球 / 护膝 | 各 15–25 |
| 棒球 | 手套 / 球棒 / 钉鞋 / 棒球 | 各 15–25 |

> 首版合计约 **500–800 条**（≈100–200MB，桶容量无压力）；跑通后再按品类增量。用户自己上传的图**永远优先**于图库图。

#### 3.3.6 合规与风控（必须在实现前定调）

| 风险 | 处理 |
| --- | --- |
| 商品图版权属品牌/店铺 | 只抓**官方**商品图、保留 `sourceUrl/sourceSite/crawledAt` 审计字段、图库页标注「图片来自品牌官方，仅用于个人装备记录」、支持一键下架（`is_listed`） |
| 公开分享页会构成「再分发」 | **默认分享页只展示型号文字**；品牌图是否进分享页做成用户开关（默认关），打开时展示来源标注 |
| 商标/肖像 | 丢弃带人物、带强营销文案的图；只保留商品本体 |
| 反爬 / 站点条款 | 只取公开页面与官方接口，限速 + 退避 + 可中断；不绕验证码、不登录抓取；站点若明确禁止则不做该站点（适配器可插拔） |
| 去背景质量 | 白底图直通；非白底低于阈值直接跳过，不做「糊图凑数」 |

---

## 4. 数据模型（迁移 050）

`sports_profiles` 扩展：

| 字段 | 类型 | 用途 |
| --- | --- | --- |
| `member_no` | text | 档案编号（`BN` + 6 位，创建时生成，唯一） |
| `shoe_size` | text | 鞋码（如 `40` / `255mm`） |
| `tension_lbs` | numeric(4,1) | 磅数（如 `27.5`） |
| `honors` | jsonb | 荣誉：`[{ title, event, year, featured, imageUrl }]`（从 `highlights` 平滑迁入，保留旧字段兼容） |
| `gear` 项扩展 | jsonb（无需 DDL） | 每项增 `imageUrl` / `kind`（racket/shoes/string/grip/ball/other）/ `equipmentItemId`（来自图库时记录来源条目） |

新表：

| 表 | 字段（要点） | 用途 |
| --- | --- | --- |
| `uploads` | id / user_id / path / bytes / width / height / created_at / deleted_at | 用户自己上传的图片登记（配额与清理，见 §3.2） |
| `equipment_items` | id / category / brand / model / image_path / width / height / source_url / source_site / crawled_at / is_listed / created_at，唯一键 `(category, brand, model)` | **装备图库**（爬取的商品图，见 §3.3）；`is_listed=false` 即下架隐藏 |

索引：`equipment_items(category)`、`equipment_items(is_listed)`、`lower(brand\|\|model)` 的 trgm 或前缀索引（搜索用）。`db/schema.sql` 同步登记，跑 `check-schema-fresh.mjs`。

API：

- `/api/sports/profiles`（+ `[id]`）透传新字段；
- `GET /api/equipment`（公开只读，图库列表/搜索）；`POST /api/internal/equipment/import`（`x-cron-secret`，批量导入）；
- 分享白名单（`toSportsShare`）加入 `honors` 与装备的**型号文字**；**品牌商品图默认不进公开分享页**（§3.3.6），需要时做用户开关。

---

## 5. 健康页 / 饮食页设计升级（参考图 1 与图 4）

### 5.1 健康页（参考图 1：大圆环 + 三指标 + 今日目标 + 建议卡 + 两张小图卡）

| 图 1 结构 | 我们的映射 | 说明 |
| --- | --- | --- |
| 顶部大圆环 + 「25% 已完成」 | 今日完成度环（复用 `readiness` 分数，RingProgress 放大到 180–200） | 中心显示 `NN%` + 「已完成」；环下方一句最短板提示 |
| 三个指标行（路程/步数/消耗） | **今日摄入 kcal · 今日训练 kcal · 饮水 ml** | 我们没有步数/路程数据源，用已有三维度替换（有数据、能点进模块） |
| 「今日目标」进度条（5000 Step） | 主目标进度条：饮水目标 or 训练目标（按当天最短板自动选） | 右侧箭头进对应模块 |
| 推广卡（U 守护） | 「今日建议」卡：AI 建议（`/api/ai/tip`）或连续打卡/本周概览 | 单卡、一句话、可点进详情 |
| 底部两张小图卡（运动 / 睡眠） | 「运动」本周分钟/次数折线 · 「饮食」剩余额度柱状 | 复用现有迷你图表组件（`charts.tsx`） |

> v7 的「四项分解条」不删，降级为圆环下方的可展开明细（点开看任务/习惯/训练/饮食四项）。

### 5.2 饮食页（参考图 4 的色彩语言 + 大加号卡片）

1. **餐次卡组**：早/午/晚/加餐各一张**语义色小卡**（粉/绿/橙/蓝，与图 4 一致），每张卡：本餐 kcal + 条目数 + **周进度小条** + 右下角**大加号**（一点即记，保留 v6 的餐次感知常用食物）；
2. **周视图**：页面下半部按图 4 底部那张周历卡做「7 天 kcal 迷你柱 + 达标勾选」；
3. 保留：热量环（剩余额度）、三大营养素微环、食物库搜索/按克录入、常吃列表、贴纸墙（v6/v7 成果不回退）；
4. 视觉：卡片圆角与投影沿用现有 token，但**引入图 4 的彩色卡片语言**（每类一个语义色 + 淡色底），与我们已有的 sticker/emoji 体系兼容。

---

## 6. OTA 应用内下载与安装（不再跳浏览器）

### 6.1 现状与依赖

现状：`lib/ota.ts` 只负责拉 `/mobile-update.json`；`settings.tsx` 用 `Linking.openURL(apkUrl)` 交给系统浏览器。

新增依赖（都以 SDK 57 对齐版本，`npx expo install` 安装）：

| 依赖 | 用途 | 关键 API（已核对 v57 文档） |
| --- | --- | --- |
| `expo-file-system` | 下载 APK 到应用缓存目录 | **进度回调只在 legacy 入口**：`import * as FileSystem from "expo-file-system/legacy"` 的 `FileSystem.createDownloadResumable(uri, fileUri, options, callback)`；新 API `File.downloadFileAsync()` 没有进度回调 |
| `expo-intent-launcher` | 调起系统安装器 / 引导授权 | `IntentLauncher.startActivityAsync("android.intent.action.VIEW", { data: contentUri, type: "application/vnd.android.package-archive", flags: 1 })`；`ActivityAction.MANAGE_UNKNOWN_APP_SOURCES` 用于引导「允许安装未知应用」 |
| `expo-image-picker` | §3.2 的图片上传 | `launchImageLibraryAsync` / `launchCameraAsync` |

`app.json` 变更：`android.permissions` 增加 `android.permission.REQUEST_INSTALL_PACKAGES`；相册/相机权限文案补中文说明。

### 6.2 交互流程

1. **发现新版本**：沿用启动后的静默检查；发现 `versionCode > 当前` 时弹 `UpdateSheet`（版本号 + 更新说明列表 + 「立即更新 / 稍后 / 忽略此版本」）。
2. **下载中**：进度条（百分比 + `已下载 / 总大小` MB + 速度）；按钮：暂停 / 继续 / 取消；**断点续传**（服务器 `Accept-Ranges: bytes` 已实测，`resumeData` 可复用）；网络切换/锁屏/退到后台不中断（前台服务非必需，`DownloadResumable` 走系统下载栈）。
3. **完成校验**：对比 `Content-Length` 与清单里的 `sizeBytes`（本次给 `/mobile-update.json` 增加 `sizeBytes`；可选 `sha256` 一并校验），避免半包。
4. **安装**：`getContentUriAsync(fileUri)` → `startActivityAsync(VIEW, { type: apk, flags: GRANT_READ })`。
   - 未授予「安装未知应用」→ 捕获后弹窗 → 跳 `MANAGE_UNKNOWN_APP_SOURCES`（`package:com.yuanabd.learnworkbench`）→ 返回后自动重试安装；
   - 系统安装器直接完成升级（同签名覆盖安装）。
5. **安装后**：不清理 SecureStore/AsyncStorage → **保持登录**；启动时现有 `secureToken.loadWithTimeout()` 回填会话（v11 只做验证，不改逻辑）。
6. **收尾**：安装成功后删除缓存 APK；失败保留以便续传；「忽略此版本」记录在本地（下次检查跳过该 versionCode）。
7. **兜底**：任何一步失败（ROM 拦截、安装器异常）都保留「用浏览器下载」按钮 —— 旧路径不删，作为 fallback。
8. **iOS/其他平台**：`Platform.OS !== "android"` 时维持原行为（提示到下载页 / TestFlight）。

### 6.3 流量与网络

- 用已有的 `expo-network` 判断网络类型：**Wi-Fi 自动开始**；蜂窝网络先询问「本次约 67MB，是否使用移动网络下载」；
- 支持暂停/继续，避免用户中断后从 0 重来。

---

## 7. 变更清单（依赖 / 部署 / 数据）

| 层 | 变更 |
| --- | --- |
| 移动端依赖 | + `expo-file-system`、`expo-intent-launcher`、`expo-image-picker`（SDK 57 对齐版本） |
| 移动端配置 | `app.json`：`REQUEST_INSTALL_PACKAGES`、相机/相册权限文案；`_layout.tsx`：`sports-card` 补 `href: null` |
| Web | 新增 `POST/DELETE /api/uploads`（sharp 已有，无新依赖）；档案页加图片上传 |
| 数据 | 迁移 **050**：`sports_profiles`（`member_no` / `shoe_size` / `tension_lbs` / `honors`）+ 新表 `uploads` + 新表 `equipment_items`；`db/schema.sql` 同步 + `check-schema-fresh.mjs` |
| 脚本 | 新增 `scripts/crawl_equipment.mjs`（爬取 + 白底规范化 + manifest）；去背可选依赖 `@imgly/background-removal-node`（**仅开发依赖**）；导入走 `/api/internal/equipment/import` |
| 部署 | `docker-compose.yml` web 加卷 `- /data/learn-workbench/uploads:/app/uploads`；nginx 加 `location /uploads/` 与 `location /equipment/`（均长缓存）；图片经 `scp` 进桶 `/data/learn-workbench/equipment/`；`/mobile-update.json` 增 `sizeBytes`（可选 `sha256`） |
| 门户 | `mobile-update.json` 生成脚本补 `sizeBytes`/`sha256`；下载页版本号随发版更新（沿用现流程） |

---

## 8. 验收清单（真机，逐条打勾）

1. 底部 tab 只有 **5** 个（今日/学习/职业/健康/我的），没有多余的「运动档案」；
2. 健康页「运动档案」入口 → 进入**全屏**档案页，观感与图 5 一致（沉浸头图 + 四宫格 + 大图装备卡 + 底部「编辑档案」，无底栏遮挡）；
2b. 右上角闪光卡入口 → 卡片**从小到大 + 旋转弹出铺满全屏**，卡片**下方有圆形叉号**，点叉号/遮罩/返回键都能干净收回；
3. 闪光卡**卡背有内容**（荣誉 + 编号 + 二维码），Android 真机（ColorOS + 一台其他品牌）都正常；
4. 正面荣誉**大字可读**，主荣誉明显压过其他元素；
5. 图片上传：头图（本人照片）/ 球拍 / 球鞋 / 拍线各上传一张，App 与 Web 分享页都能显示，换图后旧图被清理；
6. 四宫格（身高/体重/鞋码/磅数）与编号显示正确；
7. OTA：从 v1.9.0 起在**应用内**弹窗 → 进度条到 100% → 直接安装 → 打开后**仍是登录态**（不掉登录）；
8. 下载中断网/暂停后能**续传**；蜂窝网络有提示；
9. 健康页/饮食页新设计上线后，原有功能（任务/习惯/训练/饮水/食物库/贴纸墙/周视图）无回退；
10. 出包 v1.10.0 后门户/OTA/二维码三件套同步（含 `sizeBytes`）。
11. **装备图库**：爬取产物每张都是**白底主体图**（人工抽查 20 张：无人物、无场景、无营销文案）；
12. App 档案编辑里「图库」→ 搜索「雷霆 80」能选中并回填型号 + 图片，档案页与闪光卡都显示该图；自己上传的图能覆盖图库图；
13. 图库接口离线/失败时不阻塞建档（降级为纯文字型号），图片走 `expo-image` 磁盘缓存二次打开不重复下载。

---

## 9. 分批执行建议

| 批次 | 内容 | 预估 |
| --- | --- | --- |
| **P0 修「烂」** | tab 多入口修复 + 档案页改为图 5 主视图（图片位先用占位/已有链接）+ 右上角入口与**全屏弹出/叉号关闭** + 卡背重做 + 荣誉放大 | 1–1.5 天 |
| **P1 档案图鉴（接线）** | 迁移 050 + 上传链路（API/存储/nginx/compose）+ 头图/球拍/球鞋/拍线图片位接线 + 四宫格新字段 + Web 档案页同步 | 1.5–2 天 |
| **P1.5 装备图库** | `equipment_items` 表 + 爬虫脚本（白底规范化）+ 图片进桶 + 导入接口 + App/Web 选图器 | 1.5–2 天（取决于站点适配器数量） |
| **P2 设计升级** | 健康页（图 1）、饮食页（图 4）重排 | 1 天 |
| **P3 OTA** | 应用内下载/续传/校验/安装/保登录 + 权限引导 | 1 天 |
| **P4 发版** | 测试三件套（web/mobile/迁移）+ 出包 v1.10.0 + 门户/二维码/看板 | 0.5 天 |

> 建议顺序 P0 → P3 → P1 → P2 → P4：先把「不能用」的修掉并让升级链路可用（否则后面每轮都要靠浏览器装包），再做图鉴与设计升级。

---

## 10. 风险与备选

| 风险 | 备选 |
| --- | --- |
| 部分 ROM（ColorOS / HyperOS / 鸿蒙）对「安装未知应用」更严 | 保留浏览器下载兜底；授权引导文案按 ROM 分支提示；必要时引导到系统设置详情页 |
| Android 上 3D/双面卡兼容差异 | 卡背**不再用** `backfaceVisibility`，改为 opacity + scaleX 两段动画，低端机也稳 |
| cosfs 桶写入异常（踩坑 84：根盘空间不足时写挂载盘会 I/O error） | 上传接口捕获错误返回明确提示；单张 ≤8MB、并发 ≤1，远低于触发阈值；必要时改存系统盘再异步搬桶 |
| 上传图片的隐私 | 本人照片**默认不进入公开分享**（装备图可公开），分享页字段仍走白名单；删除档案时级联清理图片 |
| OTA 下载 70MB 失败率 | 断点续传 + 3 次自动重试 + sizeBytes 校验；失败不写入「已更新」状态 |
| 权限新增导致应用商店/备案复核 | `REQUEST_INSTALL_PACKAGES` 属常见自更新权限，隐私政策补一条「仅在应用内升级时用于安装更新包」 |
| **装备图库的商品图版权 / 站点条款** | 只抓官方商品图 + 保留来源审计 + 一键下架开关；**品牌图默认不进公开分享页**；站点适配器可插拔，明确禁止的直接不做（详见 §3.3.6） |
| 白底图产量不足（很多站点主图是场景图） | 优先扩站点（官方商城 + 品牌旗舰店），而不是放宽质量门槛；不足的型号允许用户自己上传 |

---

## 11. 待你确认的点

1. **优先级**：是否按「P0 修烂 → P3 OTA → P1 图鉴 → P2 设计」的顺序？还是先做 OTA（这样后面每轮都能应用内升级）？
2. **健康页三指标**用「摄入 kcal / 训练 kcal / 饮水 ml」替换图 1 的「路程 / 步数 / 消耗」是否 OK（我们暂无步数数据源）？
3. **本人照片**默认只在档案页与登录态可见、**不进公开分享页**，可以吗？（装备图可以公开）
4. **上传存储**放 COS 桶 `/data/learn-workbench/uploads/` + nginx 直出（推荐），还是只在容器卷里（不推荐，系统盘小）？
5. OTA 是否要加 **sha256 校验**（更稳，但门户清单生成要多一步）。
6. 档案页**以图 5 为唯一主视图**：只有一条档案时直接展示图鉴；**多条档案**时用顶部「运动 chips」切换（而不是回到列表页），这样处理可以吗？
7. 全屏弹出的节奏按「遮罩 220ms + 卡片 620ms 无回弹」定，是否合口味？（可以调更快/更慢，或改用轻微 spring）
8. 图 5 里的 **VIP 标**用「等级」文案上色（如「BADMINTON NERD · VIP」= 等级字段），可以吗？还是你希望另做一个「段位/星标」字段？
9. **装备图库的抓取范围**：按 §3.3.5 的品类清单全量抓（首版 ~500–800 条），还是先只抓**羽毛球**（球拍/球鞋/拍线/手胶/球）跑通再扩？
10. **品牌白名单**：只抓 YONEX / VICTOR / 李宁 / 川崎（羽毛球）+ 各运动主流品牌，还是不限品牌？
11. 图库商品图**默认不进公开分享页**（分享页只显示型号文字）——同意吗？还是允许用户自行开启「分享时展示装备图」？
12. 去背方案：优先只收官方白底图（零风险、可能少），在不够时再启用本地去背模型（`@imgly/background-removal-node`，多一个开发依赖、处理慢）——这个取舍可以吗？

> 你确认（或改哪几条）之后我再动手写代码；本轮不动代码。

---

## 12. 执行记录（按用户确认：先做 OTA）

> 2026-09-19：用户确认全部 12 条待确认项，并指定「先做 OTA，这样后面每轮都能应用内升级」。以下为 **P3 OTA 批次**的实施记录（其余批次按 §9 顺序继续）。

### 12.1 新增/改动文件

| 文件 | 作用 |
| --- | --- |
| `apps/mobile/src/lib/sha256.ts` + `sha256.test.ts` | **纯 TS 增量 SHA-256**（11 组 `node:crypto` 已知向量覆盖 padding 边界 0/1/55/56/63/64/65…，另加分片与一次性等价性） |
| `apps/mobile/src/lib/file-hash.ts` | 512KB 分片读（legacy `readAsStringAsync({ position, length })`）+ 增量哈希；自写 base64 解码（RN 无可靠 `atob`） |
| `apps/mobile/src/lib/update-manager.ts` + `update-manager.test.ts` | 下载（可暂停/续传）、校验（大小严格一致 + sha256，可降级）、安装（`content://` + IntentLauncher）、授权引导、清理 |
| `apps/mobile/src/store/update-store.ts` | 升级状态机：`idle → available → downloading ⇄ paused → verifying → ready → installing / error` |
| `apps/mobile/src/components/update-sheet.tsx` | 弹层：版本说明 + 进度条 + 百分比/已下载·总大小 + 暂停/继续/取消 + 立即安装 + 忽略此版本 + 「用浏览器下载」兜底 |
| `apps/mobile/src/lib/ota.ts` | 清单增 `sizeBytes` / `sha256` 的解析与校验（非法 sha256 丢弃）；「忽略此版本」本地记录 |
| `apps/mobile/src/app/_layout.tsx` | 启动静默检查 → 1.5s 后弹层（避开首屏）；壳层渲染 `<UpdateSheet />` |
| `apps/mobile/src/app/settings.tsx` | 「检查更新」改走 store（发现新版本直接弹应用内升级弹层）；旧的「发现新版本」Alert 流程删除 |
| `apps/mobile/app.json` + `android/.../AndroidManifest.xml` | 新增 `REQUEST_INSTALL_PACKAGES` 权限（Android 8+ 仍需用户授予「安装未知应用」，弹层会引导到设置页） |
| `scripts/build-ota-manifest.mjs` | 门户清单生成器：自动带 `sizeBytes` + `sha256`（流式哈希），以后发版不再手写清单 |
| `apps/mobile/src/app/_layout.tsx`（顺带） | **P0-1 修复**：`sports-card` 补 `<Tabs.Screen href={null} />`，不再是第 6 个 Tab（见踩坑 86） |

### 12.2 关键技术取舍

1. **进度回调只能用 legacy API**：SDK 57 的新 API（`File.downloadFileAsync`）没有进度回调，所以下载走 `expo-file-system/legacy` 的 `createDownloadResumable`（进度/暂停/续传齐全）；服务器 `Accept-Ranges: bytes` 已实测，续传可用。
2. **sha256 自己实现**：`expo-crypto` 只能哈希字符串、没有文件流式哈希；分片读 + 增量哈希内存恒定 512KB，67MB 包校验不会 OOM。
3. **校验降级策略**：**大小必须严格一致**（挡半包）；sha256 能算就算，读文件失败时不阻塞安装，但会把原因显示在弹层里。
4. **保登录**：同签名 + versionCode 递增的覆盖安装不会清数据，token 在 `expo-secure-store` 里自动保留 —— 无需改逻辑，只做真机验收（§8-7）。
5. **兜底全留**：`用浏览器下载` / `打开下载页` 两条旧路径不删；任何一步失败都能退回。

### 12.3 验证

- 移动端：typecheck 0 / lint 0 error / **309 测试**（新增 21：sha256 5 + update-manager 14 + ota 2）。
- 清单生成器烟测：对 v1.9.0 包跑 `scripts/build-ota-manifest.mjs` → `sizeBytes=70019264`、`sha256=6b821d0b…` 与手工哈希一致。
- **待你真机验收**（这是本批次唯一的验收口）：v1.10.0 装好后，下一次发版（v1.11.0）应当在 App 内弹窗 → 进度条 → 直接安装 → **仍是登录态**。

> 之后的批次按 §9：**P0 修「烂」→ P1 图鉴+上传 → P1.5 装备图库（先羽毛球）→ P2 健康/饮食设计 → P4 出包**。

### 12.4 P0 修「烂」批次 —— 已完成（v1.11.0）

| 需求（用户原话） | 落地 |
| --- | --- |
| 运动档案主要以图 5 的形式展现 | `apps/mobile/src/app/sports-card.tsx` 重做为**全屏沉浸图鉴**：英雄头图（无图时给占位与指引）+ 右上压角 VIP 标（取等级）+ 身份大字 + `BNxxxxxx` 编号 + 地区·生日 + **四宫格（身高/体重/鞋码/磅数）** + 装备大图卡 + 荣誉区 + 底部固定「编辑运动档案」；多运动用顶部 chips 切换 |
| 闪光卡片放右上角点击入口 | 头部右上角一枚 62×40 的**小卡缩略入口**（带卡面主体图 + 「闪光卡」字样），无卡面素材时置灰 |
| 点击后从小到大旋转弹出全屏展示 | `Modal` + `measureInWindow` 取按钮位置 → `translateX/Y` 从按钮中心回到屏幕中心、`scale 0.08 → 1`、`rotateY -180° → 0`（620ms `cubic-out`，无回弹） |
| 卡片下方一个叉号，点击取消 | 卡片下方 52pt 圆形叉号（`close` 图标）；点叉号 / 点遮罩 / Android 返回键三条路径都能反向收回（420ms） |
| 卡背全黑、要有内容 | 卡背重做「**荣誉背面**」：描金内框 + HONORS 荣誉清单（主荣誉大字 + 副荣誉）+ GEAR 装备清单（最多 5 行）+ 编号与 HOLOGRAPHIC 页脚；**翻面改成两段 `rotateY` + 交叉淡入，彻底不用 `backfaceVisibility`**（v1.9.0 全黑根因） |
| 荣誉要着重放大 | 正面版式重排为「荣誉 > 战绩 > 绝技」：主荣誉 26pt 金色粗体 + 🏆 图标 + 成绩副标 15pt，最多再列 2 条副荣誉 11pt；没有荣誉时给「去档案里加一条」的引导文案 |
| 战绩/装备数据自己填 | 迁移 **050** 增 `shoe_size` / `tension_lbs`，Web 与 App 的表单、展示、分享口径同步；身高体重复用「营养目标」资料，地区复用资料页设置 |

**顺带**：卡面数据结构扩展（`mainHonor` / `honors` / `memberNo` / `gear`）放在 shared，双端同源；移动端 `sports-client` 草稿同步新增鞋码/磅数。

**验证**：web 1095 测试 / mobile 309 测试；双端 typecheck、lint 全绿；迁移全新建库自检（50 个迁移）通过。

**仍未做（P1 起）**：图片上传（现在只能粘贴照片链接）、装备商品图、四宫格里的身高体重在 App 内编辑（当前去 Web 改）。

### 12.5 P1 图片上传批次 —— 已完成（v1.12.0）

| 层 | 改动 |
| --- | --- |
| 服务端 | `POST /api/uploads`（multipart：`file` + `kind`，≤8MB，JPG/PNG/WebP/HEIC）→ sharp `rotate()` 纠向 + 长边 ≤1600（头像 ≤1200）+ WebP(q84/86) → 写 `public/uploads/<uid>/<uuid>.webp`；写 `uploads` 表；配额 **200 张 / 500MB**；`DELETE /api/uploads?url=` 软删登记 + 清盘（校验越权与目录穿越） |
| 数据 | 迁移 **051** `uploads` 表（id / user_id / kind / path / mime / bytes / width / height / 时间戳与软删）；`gear` 项新增 `imageUrl`（jsonb，无需 DDL） |
| 存储 | compose 新增卷 `- /data/learn-workbench/uploads:/app/public/uploads`（COS 桶）；服务器建目录 + nginx 新增 `location /uploads/`（alias + 一年 immutable 缓存，已 reload）；本地开发 Next 直接当静态资源伺服 |
| 移动端 | 新依赖 `expo-image-picker`；`lib/uploads.ts`（相册选图 / 上传 / `absoluteMediaUrl` 补域名 / 换图删旧图 / 由装备标签猜 kind）；档案页**头图点击即换照片**、**装备卡点击即拍照选图**，列表与卡面展示缩略图 |
| Web | `lib/media.ts` + 档案页照片与装备图的统一上传入口（缩略图 + 上传按钮，替换旧图会清理），列表展示装备缩略图 |

**安全与边界**：只允许登录用户；路径格式强校验（`<uuid>/<name>.webp`）且必须以自己的 userId 开头；单张 ≤8MB、非图片格式直接拒绝；图片一律转 WebP 落盘，原图不留；失败返回可读文案。

**验证**：web **1112 测试** / mobile **311 测试**；双端 typecheck、lint 全绿；迁移 51 个全新建库自检通过；`pnpm -F web build` 通过（`/api/uploads` 已进产物）；线上 `/api/uploads` 未登录 401、`/uploads/<不存在>` 404（nginx alias 生效）。

**下一批（P1.5）**：装备图库 —— 先抓 YONEX / VICTOR / 李宁 / 川崎的羽毛球装备白底图（球拍/球鞋/拍线/手胶/球），入 COS + `equipment_items` 表，App 里「从图库选择」回填型号与图片。

### 12.6 P1.5 装备图库批次 —— 已完成（v1.13.0，首版羽毛球 40 款）

| 层 | 改动 |
| --- | --- |
| 爬虫 | `scripts/crawl_equipment.mjs`：**站点适配器**架构（当前 YONEX 中国官网，服务端渲染好抓）；只收**白底商品图**（边框近白 ≥86% + 中心有内容才要）；`sharp` 裁白边 → 居中铺白 → WebP（900×900，平均 38KB） |
| 数据 | 迁移 **052** `equipment_items`（唯一键 `(category, brand, model)`，`is_listed` 合规下架开关） |
| 导入 | `scripts/import_equipment.mjs`：图片 `scp` 进 COS 桶 `/data/learn-workbench/equipment`，元数据走 `POST /api/internal/equipment/import`（`x-cron-secret`，运行时从服务器 .env 读密钥，不落盘） |
| 读取 | `GET /api/equipment?category=&q=&brand=&limit=`（公开只读，10 分钟缓存）；nginx `^~ /equipment/` 一年 immutable 直出 |
| App | `lib/equipment.ts` + `EquipmentPicker`（类别 chips + 搜索 + 三列白底图网格，**内嵌在编辑弹层里**避免 Modal 套 Modal）；装备行右侧「图库」按钮，选中回填型号 + 商品图 |
| Web | `EquipmentPickerModal`（同一接口，同一套数据） |

**首版产出**：球拍 8（天斧 99 PRO/TOUR/GAME/PLAY、100 ZZ/TOUR/GAME/ZZ VA）、球鞋 8（SUBAXIA GT 系列、POWER CUSHION AERUS/Z2/ECLIPSION）、拍线 8（EXBOLT 68/65/63、AEROSONIC、BG66UM/80/80P/BGT）、羽毛球 8（AEROSENSA 02–50）、手胶/配件 8（AC102C/104EX/108EX/130/133/136/140）——**合计 40 条，全部白底主体图**。

**踩到的两个坑**：① `scp -r images/. remote/` 传完先后要确认桶里目录层级；② **nginx 的 `/uploads/`、`/equipment/` 必须写成 `^~`**，否则会被同 server 块里的 `.webp` 正则 location 抢走、落到 Next 变成 404（前端会看到 Next 的 404 页而不是 nginx 的）——已改服务器 + 回写模板。

**验证**：web **1121 测试** / mobile **311 测试**；双端 typecheck、lint 全绿；线上 `GET /api/equipment` 返回 40 条、`/equipment/**.webp` 200 且 `Cache-Control: immutable`。

**继续扩（下一轮可选）**：李宁（`store.lining.com` 是 SPA，需要 Playwright 渲染适配器）、VICTOR/川崎（域名待确认）、其余运动品类；App 里已预留 `sportKey` 过滤，扩品类只加数据不加代码。

### 12.8 装备图库扩品牌与品类（v1.15.0）

| 来源 | 适配器 | 产出 |
| --- | --- | --- |
| **YONEX 全球官网**（yonex.com，Magento） | 分类枚举 + `product_list_limit=36` 分页；列表页直接拿「型号 + 商品图」 | 羽毛球拍 85 / 鞋 40 / 球 30 / 配件 67 / 线 8；网球鞋 20 / 线 13 / 球 3 |
| **YONEX 中国官网**（yonex.cn，服务端渲染） | 分类页 → 详情页（中文型号） | 已并入上面的羽毛球库 |
| **VICTOR 全球官网**（victorsport.com，Next.js SSR） | `sitemap_products.xml`（4635 条）逐条取 `og:title`/`og:image`，**关键词判定品类**，扫到各类上限 | 首批 130+ 条（后台继续扫描） |

**关键修复**：白底判定必须**先 `flatten` 到白底再采样** —— Magento 商品图多为透明 PNG，`removeAlpha` 会把透明当黑，导致大量误杀（YONEX 球拍从 7 → **85** 条）。

**品类扩展**：品类白名单唯一事实源移到 `shared/EQUIPMENT_CATEGORIES`（图库接口从它派生），新增 **tennis-racket / tennis-shoes / tennis-string / tennis-ball** → App 装备选择器按 `sportKey` 自动出现网球品类，无需改 UI 代码。

**仍然打不通**：李宁商城（umi SPA，接口 `api.store.lining.com` 需渠道/签名头）、川崎/凯胜/红双喜（域名在本网络不可达）→ 下一轮：李宁改用 Playwright 渲染适配器。

### 12.9 李宁 + 多运动品类（v1.16.0）

**李宁（Playwright 渲染适配器）**：`scripts/crawl_lining.mjs` 用 chromium 渲染 `store.lining.com` 的搜索结果页（SPA + 接口需签名头，渲染最稳），抽取「商品名 + 腾讯 COS 图床主图」；把 `imageMogr2/thumbnail/130x130/pad/1/color/…` 换成 `thumbnail/1200x1200` 拿大图，再走同一套白底判定与规范化。带 `--dry` 预览与 `--resume` 续跑，排除包/服饰/袜帽等非装备。

**品类扩到 7 个项目**（shared 白名单，图库接口与之同源）：

| 项目 | 图库品类 |
| --- | --- |
| 羽毛球 | 球拍 / 球鞋 / 拍线 / 羽毛球 / 手胶配件 |
| 网球 | 球拍 / 球鞋 / 球线 / 网球 |
| 乒乓球 | 底板(拍) / 胶皮 / 球鞋 / 球 |
| 篮球 | 球鞋 / 篮球 |
| 足球 | 球鞋 / 足球 / 护腿板 |
| 排球 | 球鞋 / 排球 / 护膝 |
| 棒球 | 手套 / 球棒 / 钉鞋 / 棒球 |

**入库结果**：李宁 304 条；图库合计 **570 条**（YONEX 266 + 李宁 304）——羽毛球 327 / 网球 101 / 篮球 50 / 足球 50 / 乒乓球 36 / 排球 6。

**已知局限**：李宁不做排球/棒球装备（排球仅护膝与球少量）；乒乓球拍与胶皮的官方图多为非白底，被白底门槛挡掉；VICTOR 的长跑扫描按用户要求暂不入库。

### 12.7 P2 设计升级 + 档案页真机修复 —— 已完成（v1.14.0）

**触发（真机反馈）**：① 档案页最下面的「编辑档案」按钮被底部 tab 栏压住、点不到；② 装备一张图一个方框，页面太长要滑两屏；要求球拍横放、其余两列、把空白利用起来，整体压到 1–1.5 屏。

| 问题 | 处理 |
| --- | --- |
| 底部按钮被 tab 栏遮挡 | 固定栏 `bottom = TAB_BAR_HEIGHT + insets.bottom`（不再贴着屏幕底），滚动内容 `paddingBottom = TAB_BAR_HEIGHT + insets.bottom + 96` |
| 页面过长 | ① 头图（230→**168**）与身份信息**叠字**（省掉一整块）；② **球拍类横放通栏**：图片 `rotate 90°` 塞进 104pt 高的横条（长的拍子横过来正好铺满宽度）；③ 其余装备改**两列网格**（图片区 1.55:1） |
| 空白没利用 | 四宫格/战绩/装备卡的间距统一收到 10，装备卡去掉多余留白；整页约 1–1.2 屏 |

**健康页（参考图 1）**：大圆环 168（中心显示完成度 + 下方一句最短板）→ **三指标行**（今日摄入 kcal / 今日训练 min / 今日饮水 ml，点各自进模块）→ **「今日目标」进度条**（自动挑达标率最低的饮水或训练，点进对应模块）→ 本周概览压成一行 → 保留 v7 的四项分解条。

**饮食页（参考图 4）**：新增 `components/meal-card-grid.tsx` —— **餐次彩色卡组**（早/午/晚/加餐各一张语义色卡：本餐 kcal + 条数 + 右下角大加号一点即记）+ **近 7 天热量迷你柱**（当天高亮）；为支撑周视图条，日视图的 summary 取数窗口从 1 天放宽到 7 天。

**验证**：mobile typecheck 0 / lint 0 error / **311 测试**；APK v1.14.0（70,316,879 B，sha256 与线上清单一致）；门户/二维码/OTA 三件套同步。
### 12.10 羽毛球档案字段精简（v1.17.0）

**触发（真机反馈）**：球拍「型号」和「类型」是两个输入行，重复；「磅数」被当成一条装备，界面上给它留了图片框、编辑里还挂了「图库」按钮 —— 磅数只是一组数字，不该配图。用户定调：**个人档案只需要四张图 —— 证件照 / 羽毛球图 / 球鞋图 / 球拍图**，其余都不需要。

| 问题 | 处理 |
| --- | --- |
| 球拍型号 + 球拍类型两行 | shared 的 `SPORT_GEAR_TEMPLATES.badminton` 改成 `["球拍", "球鞋", "羽毛球", "拍线"]`（网球同构）；旧数据由 `normalizeSportGear()` 把「球拍型号 + 球拍类型」并成一行「球拍」（值用 ` · ` 拼，图片保留），「球鞋类型」并到「球鞋」 |
| 磅数占了一条装备行（还配图） | 「磅数」从装备模板移除，只保留图鉴四宫格的**数值输入**（`tensionLbs`）；老档案装备里残留的「磅数」行由 `normalizeSportGear()` 抽出数值落到四宫格，行本身丢弃 |
| 装备行无差别配图 | 新增 shared 判定 `gearRowWantsImage(label)` —— 只有 **球拍 / 球鞋 / 比赛用球** 三类配图（App 与 Web 同一份规则）；其余（拍线 / 手胶 / 球衣 / 护具 / 位置…）只填文字 |
| 证件照还是「填链接」 | 编辑表顶部改成**证件照上传行**（缩略图 + 点一下拍照 / 选图），与档案页头图上传同一套 `POST /api/uploads` |

**归一规则**（`packages/shared/src/index.ts`）：`normalizeSportGear(gear)` → `{ gear, tensionLbs }`；`mergeGearWithTemplate(sportKey, gear)` 在其之上按现模板排序补全（新增行即使空白也补上，方便填写），自定义行保留在末尾。App 档案页展示、Web 档案页展示与编辑、**闪光卡卡面**（`buildSportsCardModel`）三处都走同一份归一，所以老档案不用等用户重存也不会出现两个球拍块。

**验证**：web typecheck 0 / mobile typecheck 0 / lint 0 error；**web 1125 测试**、**mobile 312 测试**；APK v1.17.0（versionCode 29）。
### 12.11 公开页装备图开关 + App 内编辑身高体重 + 双鱼图源（v1.18.0）

**① 公开分享页的装备图开关（迁移 053）**

- 公开页此前**完全不展示装备图**（只有文字）。现在给档案加一个 `show_gear_images` 开关（默认 **false**）：用户在 App / 网页端主动打开后，公开页才展示装备图，且只展示**球拍 / 球鞋 / 比赛用球**这三类（与档案页同一份 `gearRowWantsImage` 规则）。
- 语义收敛：取消「公开分享」时服务端强制把开关置 false（PATCH 里 `show_gear_images = false`），避免下次重新公开时意外带图；POST 时 `showGearImages = 公开 && body.showGearImages`。
- 白名单出口仍是 `toSportsShare()` 一处：`showGearImages` 加进 `sportsShareSchema`，其余身体字段依旧不出门。

**② App 内编辑身高体重（图鉴四宫格补齐）**

- 四宫格 = 身高 / 体重 / 鞋码 / 磅数，此前身高体重只能在网页端改（App 里只读）。现在编辑表第一行就是身高、体重，保存时先 `PUT /api/nutrition/target` 再存档案。
- **坑**：该接口是「整组覆盖」语义 —— 没带的字段会被清空（体重还会回落 60）。所以客户端把 `sex / activityLevel / birthYear` 一起回传（`saveBodyMetrics`），并用 `bodyDirty` 标记**只在用户真的改过时才提交**，避免身体数据异步加载未完成时把已有值清掉。

**③ 双鱼图源（乒乓球拍/胶皮的空缺补上）**

- 新增 `scripts/crawl_equipment.mjs` 的 `doublefish` 适配器（`www.doublefish.com`，国产全品类）：分类页商品卡 `<a href="…_p<id>" title="…"><img src="…_thumb.jpg">` 直接给出型号 + 主图，把 `_thumb` 换成 `_medium` 拿大图。
- 覆盖 8 个分类：底板 / 成品拍 → `table-tennis-racket`，套胶 → `table-tennis-rubber`，乒乓球 → `table-tennis-ball`，羽毛球拍 → `badminton-racket`，长虹足球 / 篮球 / 排球 → `soccer-ball / basketball-ball / volleyball-ball`。
- **本轮入库 77 条**：乒乓球拍 20（原 0）+ 胶皮 12（原 0）+ 乒乓球 7 + 羽毛球拍 12 + 足球 12 + 篮球 12 + 排球 2。
- **顺手做了一次全库品类清洗**（新增 `scripts/lib/equipment-category.mjs` 守卫 + `.local/reclassify-equipment.mjs` 一次性脚本）：
  早期李宁爬虫按搜索词直接入库，导致「篮球鞋」进了篮球、「羽毛球拍」进了羽毛球 —— 清洗**移动 78 条**到正确品类目录、
  **下架 6 条服饰**（李宁乒乓球系列短袖文化衫 / 风衣）、并去掉 **78 条与正确品类重复**的行。
  清洗后图库 **564 条**、品类零错配；两个爬虫都加了守卫，后续不会再进错品类。
- **两个爬虫通用修复**：① 文件名兜底 —— 中文型号 `slugify` 后可能为空，末尾补 10 位 hash 防覆盖；② `Referer` 头必须是 ASCII，中文商品页 URL 先 `encodeURI`，否则 Node fetch 直接抛 ByteString 错误（本轮第一次跑全军覆没就是这个）。

**验证**：web **1131 测试** / mobile **316 测试** / `pnpm test:scripts` 全绿；双端 typecheck 0 / lint 0 error；迁移 053 全新建库自检通过；APK **v1.18.1（versionCode 31）**。

**线上冒烟（v1.18.0/v1.18.1）**：临时把测试档案设为公开 + 打开开关，`GET /api/sports/share/1` 返回 `showGearImages:true` 且装备带 `imageUrl`，随后**已还原**（is_public=false / 开关 false / 原 gear 5 行）；APK 与清单 sha256、二维码解码、图库图片 200 全部核对一致。
### 12.12 扩品牌：川崎 / 蝴蝶 / VICTOR + 红双喜现状（v11.3）

**① 川崎（`kawasaki-sport.eu`，欧洲官方店）**

- 新适配器 `kawasaki`：分类页 `/en/menu/rackets-178.html`、`shoes-182`、`strings-190`、`grips-189`、`accessories-187`；商品卡 `<a href="…/en/products/…" title="…"><img src="…eng_il_….jpg">` 直接给出型号与主图。
- 入库 **38 条**：球拍 19 / 球鞋 6 / 拍线 6 / 手胶配件 7。

**② 蝴蝶（`butterfly.co.jp`，日本官网）**

- 新适配器 `butterfly`：`/products/blade/`、`/products/rubber/`、`/products/shoes/`、`/products/ball/`；列表缩略图 600×600，详情图 `_01` 是 **1200×1200**（用 `_01` 拿大图）。
- 入库 **142 条**：底板 81 / 胶皮 44 / 球鞋 8 / 球 9 —— 乒乓球「拍 / 胶皮」两类从几乎为零变成 101 / 56（含双鱼）。

**③ 红双喜（DHS）：本轮抓不了，原因记录**

- 可达性：`www.dhs-sports.com` 提示「网站升级中」，`https` 不通，只有 **`http://dhs-sports.com`（裸域）** 返回 200（服务器侧 `www` 的 HTTP 也 200）。
- 结构：2015 年的自研 CMS + 前端渲染。Playwright 渲染 `/pingpang/` 能拿到分类（底板 / 纯木底板 / 复合底板 / 套胶 / 颗粒胶 / 乒乓球拍…），但**再进一层的列表页只有产品名与文案、没有商品图，也没有商品详情链接**（图片全是导航图标），因此拿不到「型号 → 图片」的对应关系。
- 结论：要抓需要逆向它的 AJAX 接口；**本轮先用双鱼 + 蝴蝶覆盖乒乓球**，DHS 留待后续（选项：找它的接口 / 用第三方图源 / 放弃）。

**④ VICTOR（`victorsport.com`）**

- 官网是 Next.js，分类页只给分类树、商品由前端拉取；`sitemap_products.xml` 有 **4635** 条商品，只能逐条读 `og:title`/`og:image` 后才能判定品类（URL 是 `cr-3099-c` 这类 SKU，看不出品类）。
- 适配器上限提到 球拍 80 / 球鞋 60 / 拍线 40 / 羽毛球 25 / 配件 40，后台长跑扫描（可 `--resume` 续跑）；**本轮入库 96 条**（球拍 27 / 配件 18 / 球鞋 15 / 羽毛球 11 / 拍线 2 等）。

**⑤ 顺带修的两个爬虫 bug**

- **无值开关**：`parseArgs` 按「成对」读参数，`--resume` 会把后面的 `--out` 当成自己的值吃掉，导致跑错目录、还因为 `manifest.length >= LIMIT` 直接空转。两个爬虫都改成「下一个 token 不是 `--` 开头才当值」。
- **品类守卫顺序**：「Racket grip / 毛巾胶」名字里带 RACKET，被误判成球拍而挡在配件之外；手胶判定提前到球拍之前，并把 `BAG/BACKPACK/CASE/COVER` 归入服饰（线上下架 1 条工具套）。


### 12.13 档案页真机反馈修复与设计精修（v1.19.0）

**真机反馈（v1.18.1）三件事 + 一个精修要求**：① 点「本人照片」传不上去；② 编辑档案时「羽毛球」的图库出的是球拍图；③ 深色模式下色差明显、看不清；④ 档案的图片与组件设计继续精修，尤其「公开成绩」太单调。

| 问题 | 根因 | 处理 |
| --- | --- | --- |
| 点证件照没反应 | Android 13+ 的系统相册选择器**本来不需要权限**，旧代码先 `requestMediaLibraryPermissionsAsync()`，而清单里没有 `READ_MEDIA_IMAGES` → 直接 denied → 静默返回（用户看到「点了没反应」） | 33+ 直接开选择器；≤32 才请求，被拒时**抛错并弹窗**提示去系统设置；清单与 `app.json` 同时补 `READ_MEDIA_IMAGES` / `READ_MEDIA_VISUAL_USER_SELECTED` |
| 上传成功也看不到照片 | 头图用相对路径 `current.photoUrl`（`/uploads/…`）直接喂给 `Image`，没有补 apiUrl | 统一走 `absoluteMediaUrl()` |
| 「羽毛球」图库出球拍图 | `equipmentCategoryForGearLabel` 的球类判定只认 `endsWith("ball")`，而羽毛球的分类键是 **badminton-shuttle** → `find` 落空 → 回落到第一个候选（球拍） | 球类判定加上 `shuttle`；补单测（羽毛球 / 比赛用球 / 球拍 / 球鞋 / 拍线 / 底板 / 胶皮） |
| 深色模式色差、看不清 | 档案页写死了浅色：`#f5f6f8` 底、`#fff8e8` 荣誉条、`#ffffff` 空态、金色深字 | 全部改走主题色（`canvas/surfaceStrong/border/text/accentSoft/accentStrong`）；空态改虚线随主题 |
| 公开成绩太单调 | 只有「🏆 + 一行文字」 | **荣誉墙**重做：第一条 = 金调主卡（🏆 + 标题 + 成绩 + `TOP` 角标 + 右上光斑），其余按名次配 🥈/🥉/🎖 卡片；只有一条时提示继续补充；没有成绩时是虚线引导卡（点一下直接进编辑） |

**顺带精修**：战绩从一行文字改成**三张小卡**（场次 / 胜负 / 胜率，胜率用主色底强调）；每个板块加**色条段标题 + 右侧说明**（图鉴 / 主力装备 / 荣誉墙）；装备卡空态改虚线 + 「点这里选一张装备图」，已有图时右上角出「换图」浮标；没有证件照时，占位里也显示身份与编号（原来身份只挂在照片上，没照片就看不到自己是谁）；`拍线 / 手胶` 这类非配图装备的历史图片在保存时一并清掉。

**验证**：web **1132 测试** / mobile **318 测试**；双端 typecheck 0 / lint 0 error；APK **v1.19.0（versionCode 32）**，签名与备案一致、服务器与线上清单 sha256 一致、二维码解码指向 v1.19.0。
**图库现状（本轮结束）**：**839 条 / 6 个品牌**（YONEX 265、LI-NING 221、蝴蝶 142、VICTOR 96、双鱼 77、川崎 38）；乒乓球类共 205 条（球拍 101 / 胶皮 56 / 球鞋 28 / 球 20）—— 品类零错配（`scripts/lib/equipment-category.mjs` 守卫逐条校验）。







