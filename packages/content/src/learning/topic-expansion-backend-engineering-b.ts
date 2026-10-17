/**
 * 后端工程 · 知识点扩容 B 批（2026-10-17）。
 *
 * 与 A 批同口径：每条 expansion = 1 个知识点 + 恰好 2 道配套题（1 single + 1 judge）。
 * 知识点 key 统一 be- 前缀，题 key 用 backend-engineering-exp-<topicKey>-s1/-j1。
 */
import type { TopicExpansion } from "./topic-expansions";

export const backendEngineeringTopicExpansionsB: TopicExpansion[] = [
  {
    trackSlug: "backend-engineering",
    stageKey: "be-api-design",
    topic: {
      key: "be-api-cursor-pagination",
      title: "分页设计与游标分页",
      summary: "OFFSET 深分页要先把前面 N 行数出来再丢掉，越翻越慢；游标分页用上一页最后一行的排序键定位，代价与翻页深度无关。",
      concepts: [
        "OFFSET 深分页",
        "游标（keyset）分页",
        "稳定排序与 tie-breaker",
        "跳页与总数取舍",
      ],
      principles: [
        "OFFSET n 的语义要求数据库先产生前 n 行，再从中丢弃，代价随页码线性增长，加索引也跳不过这一步。",
        "游标分页把条件写成第 n 行之后，直接沿索引定位，翻到第几页都是读一页的量。",
        "排序键必须唯一，或者补一个唯一列（通常是 id）做 tie-breaker，否则同值行在页边界会重复或漏掉。",
      ],
      applications: [
        "信息流与评论列表",
        "大数据量导出分批拉取",
        "管理后台表格分页",
      ],
      pitfalls: [
        "在大表上用 OFFSET 翻到几千页，还配合一个没索引的排序列。",
        "只按创建时间排序而时间不唯一，翻页时数据重复或丢失。",
        "把页码当游标，翻页期间有新数据插入，整页内容整体位移。",
      ],
      method: "先确定稳定排序键（时间 + 唯一 ID），再给这个组合建索引，接口返回 nextCursor 而不是页码。",
      exercise: "给按时间倒序的订单列表实现游标分页接口：写出 SQL、联合索引与 nextCursor 的编码方式。",
      checkpoint: "能解释为什么 OFFSET 100000 很慢，而游标分页翻到同样深度代价不变。",
      lesson: {
        overview: [
          "列表接口几乎一定会遇到翻页，最常见的写法是 LIMIT 加 OFFSET。第 1 页很快，翻到第 5000 页时数据库要先把前面 10 万行读出来再丢掉，这些行全是白读的。分页方案不是代码风格问题，数据量一大就会变成接口事故，所以要在设计阶段就想清楚三件事：列表会被翻多深、排序键上有没有索引、前端要不要支持跳页。",
          "游标分页（也叫 keyset 或 seek 分页）换了个思路：不记第几页，而记上一页最后一行是谁。下一页从这一行之后接着取，数据库可以直接沿索引定位，翻到多深代价都一样。代价是失去跳页和精确总数，需要在前端交互上做取舍，比如只保留上一页和下一页两个按钮，总数用估算值代替。",
          "什么时候还可以用 OFFSET：数据量小、只需要前几十页、或者后台导出这类一次性任务。判断标准有两条：排序键有没有索引，用户会不会翻到很深。只要这两条都不乐观，就应该换上游标分页，不要等到慢查询告警出现再改，那时候接口已经被大量调用方依赖，改动成本会高得多。",
        ],
        mechanism: [
          "OFFSET 的代价来自它的语义：数据库必须先产生前 n 行，才知道第 n+1 行从哪开始。即使排序键上有索引，也要沿索引走 n 步；没有合适索引时还要先排序整表，代价更高。所以 OFFSET 的耗时随页码线性增长，换数据库或者优化 SQL 写法都绕不开这一点。",
          "游标分页把条件写成 WHERE (created_at, id) < (上一页的 created_at, 上一页的 id)，再按同样顺序 ORDER BY 并 LIMIT 20。索引 (created_at DESC, id DESC) 上的行本身就是这个顺序，引擎定位到起点后顺序读 20 行就能停，完全不用关心它前面已经有多少行数据，这也是它和 OFFSET 最本质的区别。",
          "行值比较 (a, b) < (x, y) 按字典序进行：先比 a，a 相等再比 b，这正是联合索引的排序方式。如果只按 created_at 排序而它不唯一，同值行的先后顺序由执行计划决定，翻页时可能重复或漏行，所以要补一个唯一列当 tie-breaker，让排序变成全序。",
        ],
        example: {
          title: "游标分页：用上一页最后一行定位",
          language: "sql",
          code: "-- 排序键 = created_at 倒序 + id 倒序（id 保证唯一，翻页才稳定）\nCREATE INDEX idx_orders_created_id\n  ON orders(created_at DESC, id DESC);\n\n-- 第一页：不带游标条件\nSELECT id, user_id, amount_cents, created_at\nFROM orders\nORDER BY created_at DESC, id DESC\nLIMIT 20;\n\n-- 后续页：把上一页最后一行的 (created_at, id) 原样带回来\nSELECT id, user_id, amount_cents, created_at\nFROM orders\nWHERE (created_at, id) < ('2026-10-01 12:00:00+08', 987654)\nORDER BY created_at DESC, id DESC\nLIMIT 20;\n\n-- 对比：深分页必须先数过前 10 万行\nSELECT id\nFROM orders\nORDER BY created_at DESC, id DESC\nOFFSET 100000\nLIMIT 20;",
          explanation: "行值比较 (created_at, id) < (?, ?) 与索引的字典序完全一致，数据库可以在索引上直接跳到这一行之后；OFFSET 版本则必须沿索引走完前 10 万行。游标里必须带上唯一的 id，否则同一秒创建的多行顺序不稳定，翻页会重复或漏数据。客户端不需要理解游标内容，服务端把排序键编码成不透明字符串返回即可。",
        },
        practiceSteps: [
          "列出所有分页接口，标出排序键与用户可能翻到的最大深度。",
          "给排序键建联合索引（排序列 + 唯一 ID），用 EXPLAIN 确认没有额外排序节点。",
          "接口返回 nextCursor（把排序键编码成不透明字符串），客户端只传 cursor，不再传 page。",
          "需要总数时单独缓存或做估算，不要在每页查询里跑一次 COUNT(*)。",
        ],
        masteryChecklist: [
          "能解释 OFFSET 越翻越慢的根因，而不是只说索引没建好。",
          "能说明为什么游标必须带一个唯一的 tie-breaker。",
        ],
        summary: [
          "OFFSET 要数过前 N 行，代价随页码线性增长。",
          "游标分页用上一页末行的排序键定位，翻多深都一样快。",
          "排序键要唯一，否则页边界会重复或漏行。",
          "游标牺牲跳页与精确总数，换的是稳定性能。",
        ],
        terms: [
          {
            term: "OFFSET",
            plain: "跳过前 N 行再取，N 越大越慢。",
            detail: "它表达的是第几页这种位置语义，所以数据库必须真的产生前 N 行。页码越深，丢弃的行越多，这也是深分页最容易被忽略的成本。",
          },
          {
            term: "游标（Cursor）",
            plain: "指向上一页最后一行的位置标记，下一页从它之后取。",
            detail: "游标不是页码，而是排序键的具体值。它可以被编码成不透明字符串，避免客户端依赖内部字段顺序；服务端换排序键时也不必改接口形态。",
          },
          {
            term: "tie-breaker（决胜列）",
            plain: "排序键重复时用来定先后顺序的额外列，通常用唯一 ID。",
            detail: "只按时间排序时，同一秒的多行谁先谁后不确定，两次查询顺序可能不同，翻页就会重复或漏行。加上唯一列后排序全序确定，游标才可靠。",
          },
          {
            term: "深分页（Deep Pagination）",
            plain: "页码很大时的翻页，OFFSET 会越来越慢。",
            detail: "深分页慢的根源是扫描量而不是网络传输量。判断一个列表会不会被翻很深，可以看分页控件的形态：只给下一页的列表通常不会，带页码输入的列表很可能会。",
          },
        ],
      },
    },
    questions: [
      {
        key: "backend-engineering-exp-be-api-cursor-pagination-s1",
        stageKey: "be-api-design",
        topicKey: "be-api-cursor-pagination",
        type: "single",
        stem: "订单列表按 created_at 倒序分页，数据量到千万级后 OFFSET 翻页越来越慢。下面哪种改法能从根上解决？",
        options: [
          {
            key: "A",
            text: "给 created_at 加一个普通索引，OFFSET 就会变快",
          },
          {
            key: "B",
            text: "改成游标分页：用上一页最后一行的 (created_at, id) 作为下一页的起点",
          },
          {
            key: "C",
            text: "把 OFFSET 换成更大的 LIMIT，一次多取一些",
          },
          {
            key: "D",
            text: "去掉 ORDER BY，让数据库按物理顺序返回",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "OFFSET 的耗时随页码线性增长，因为它必须先产生并丢弃前 n 行，加索引也无法跳过这个步骤。游标分页用 WHERE (created_at, id) < (?, ?) 直接定位到上一页末尾之后，沿联合索引顺序读 20 行就停，代价与翻页深度无关。去掉排序会让分页结果不稳定，加大 LIMIT 只是把问题往后推。",
        difficulty: "medium",
        tags: [
          "分页",
          "索引",
          "接口设计",
        ],
        sourceKey: "postgresql",
        level: "进阶",
      },
      {
        key: "backend-engineering-exp-be-api-cursor-pagination-j1",
        stageKey: "be-api-design",
        topicKey: "be-api-cursor-pagination",
        type: "judge",
        stem: "游标分页只要按 created_at 排序就足够稳定，不需要再加 id 作为第二排序键。",
        options: [
          {
            key: "A",
            text: "正确",
          },
          {
            key: "B",
            text: "错误",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "created_at 通常不唯一，同一时间创建的行的先后由执行计划决定，两次查询可能不同。翻页时上一页末尾的行位置不确定，就会出现重复或漏行。补一个唯一列（如 id）作为第二排序键，排序变成全序，游标才能精确定位。",
        difficulty: "hard",
        tags: [
          "分页",
          "稳定排序",
          "游标",
        ],
        sourceKey: "postgresql",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "backend-engineering",
    stageKey: "be-api-design",
    topic: {
      key: "be-api-versioning",
      title: "接口版本演进与向后兼容",
      summary: "先判断改动是兼容还是破坏，再决定要不要升版本；新增可选字段可以直接上线，删字段、改类型、改语义必须走兼容过渡。",
      concepts: [
        "破坏性变更",
        "向后兼容",
        "expand-contract",
        "弃用与下线",
      ],
      principles: [
        "新增可选字段、新增接口、放宽校验通常兼容；删字段、改类型、改语义、收紧校验都是破坏性的。",
        "加字段对多数 JSON 客户端安全，但开启严格反序列化的强类型客户端会直接报错，要按消费方实现判断。",
        "版本号只解决新旧并存，淘汰旧版本要靠调用量数据、弃用期和迁移文档，而不是发一封公告。",
      ],
      applications: [
        "对外 OpenAPI 接口",
        "无法强制升级的移动端",
        "多团队共用的内部服务",
      ],
      pitfalls: [
        "在同一个版本里悄悄改字段含义，版本号形同虚设。",
        "把新增必填字段当成兼容改动，老客户端立刻全部失败。",
        "没有调用量数据就宣布下线旧版本。",
      ],
      method: "先列清消费方与升级能力，再给每次改动打兼容或破坏标签；破坏性改动走 expand-contract 加新版本。",
      exercise: "把 status 从字符串改成对象拆成若干次兼容发布，写出每一步的读写兼容策略与过渡期。",
      checkpoint: "能给一组改动逐条判定是否破坏性，并说明依据。",
      lesson: {
        overview: [
          "接口一旦发布，就有你控制不了的消费者：别人家的服务、已经装在用户手机上的旧版本 App、几个月没升级的脚本。它们不会因为你改了个字段就跟着改，所以接口演进的核心问题不是怎么发版本，而是怎么在不破坏现有调用方的前提下把新能力交付出去。想清楚这一点，很多争论就没有了。",
          "绝大多数改动其实是兼容的：新增一个可选字段、新增一个接口、放宽取值范围。这类改动可以直接上线，不需要新版本号。真正需要谨慎的是破坏性变更：删字段、改字段类型、改字段含义、把可选改成必填、收紧校验规则。它们会让老代码在今天立刻出错，而老代码可能根本没人维护。",
          "版本号只解决新旧并存，不解决下线。真要淘汰旧版本，得先有数据：每个版本的调用量、调用方是谁、他们多久升级一次。没有这些数据就宣布停机下线，等于赌运气。弃用期、Deprecation 与 Sunset 响应头、迁移文档，都是配套动作，缺一样都会让下线变成一次事故，这三样都不能省。",
        ],
        mechanism: [
          "判断兼容性要看消费方的解析方式。JSON 客户端多数会忽略未知字段，所以加字段通常安全；但强类型语言里开启严格反序列化的客户端遇到未知字段会直接崩。同理，把数字改成字符串在弱类型语言里可能静默算出错误结果，比直接报错更难排查。",
          "expand-contract（扩展再收缩）是处理破坏性变更的标准手法：先让新旧两种形态同时存在，新字段写双份、读取同时兼容两种；等所有消费方迁完，再删掉旧的。整个过程拆成三次发布，每一步都只做兼容改动，任何一步出问题也都能独立回滚。",
          "版本放在路径（如 /v1/...）最直观，缓存和排查都方便；放在 header 或 query 更省 URL，但容易被网关和日志忽略。选哪种影响不大，关键是同一版本内的语义不能悄悄改，否则版本号就失去了意义，调用方也无法通过版本判断兼容性，只能靠猜。",
        ],
        example: {
          title: "一次响应的兼容改动与破坏改动",
          language: "text",
          code: "GET /v1/orders/ord_123  ->  200\n{\n  \"id\": \"ord_123\",\n  \"status\": \"paid\",\n  \"paid_at\": \"2026-10-01T12:00:00+08:00\"\n}\n\n兼容改动：只新增可选字段，老客户端忽略未知字段即可\n{\n  \"id\": \"ord_123\",\n  \"status\": \"paid\",\n  \"paid_at\": \"2026-10-01T12:00:00+08:00\",\n  \"payment\": { \"method\": \"card\", \"last4\": \"4242\" }\n}\n\n破坏改动：status 由字符串变成对象，老客户端按字符串解析会直接失败\n{\n  \"id\": \"ord_123\",\n  \"status\": { \"code\": \"paid\", \"label\": \"已支付\" }\n}\n\n破坏改动必须先发 /v2，并在 /v1 上给出弃用信号\nDeprecation: true\nSunset: Sat, 01 Aug 2026 00:00:00 GMT",
          explanation: "第一段是已经发布的契约。第二段只增加新字段，老客户端读到不认识的键会忽略，属于兼容改动。第三段改变了 status 的类型，任何按字符串处理它的代码都会报错，必须开新版本。最后两行是弃用信号：Deprecation 告诉调用方该迁移了，Sunset 给出明确的下线时间，配合每个版本的调用量数据，才能安全下线。",
        },
        practiceSteps: [
          "列出接口的所有消费方，标注哪些能强制升级、哪些只能等用户更新。",
          "给每次改动打上兼容或破坏标签，破坏性改动一律不允许原地修改。",
          "破坏性改动按 expand-contract 拆成三步发布，先双写后双读，最后删除旧字段。",
          "下线前统计各版本调用量，设置弃用期并返回 Deprecation 与 Sunset 头。",
        ],
        masteryChecklist: [
          "能对一组改动逐条判断兼容性，并说出依据是消费方如何解析。",
          "能解释为什么版本号不能替代兼容性设计。",
        ],
        summary: [
          "兼容改动直接上线，破坏性改动才需要新版本。",
          "删字段、改类型、改含义、收紧校验都是破坏性的。",
          "破坏性变更用 expand-contract 分三步走完。",
          "下线旧版本靠调用量数据与弃用期，不靠公告。",
        ],
        terms: [
          {
            term: "破坏性变更（Breaking Change）",
            plain: "会让已有调用方解析失败或行为改变的改动。",
            detail: "判断标准是消费方会不会坏，而不是你改得大不大。加一个字段可能没事，改一个字段的类型一定会坏。评审时逐条问：老代码读到这个响应还能正常工作吗。",
          },
          {
            term: "向后兼容（Backward Compatible）",
            plain: "新版本能接住旧调用方的请求，旧代码不用改也能跑。",
            detail: "注意兼容是双向的：新服务要容忍旧请求，旧服务也要能容忍新请求（滚动发布期间两种版本会同时在线）。所以新增字段在过渡期必须是可选的。",
          },
          {
            term: "弃用（Deprecation）",
            plain: "宣告某个字段或版本将来会删，但现在仍然保留。",
            detail: "弃用要给出替代方案和明确时间点，否则调用方没有动力迁移。HTTP 里用 Deprecation 与 Sunset 响应头表达，比写在文档里更容易被发现。",
          },
          {
            term: "expand-contract",
            plain: "先让新旧两种形态并存，迁完再删旧的。",
            detail: "名字来自数据库迁移：先扩展（加新列、双写），再收缩（删旧列）。它把一次破坏性变更拆成几次兼容变更，每一步都能单独回滚，是兼容演进的核心套路。",
          },
        ],
      },
    },
    questions: [
      {
        key: "backend-engineering-exp-be-api-versioning-s1",
        stageKey: "be-api-design",
        topicKey: "be-api-versioning",
        type: "single",
        stem: "下面哪种改动属于破坏性变更，必须升版本或走兼容过渡？",
        options: [
          {
            key: "A",
            text: "在订单响应里新增一个可选字段 payment",
          },
          {
            key: "B",
            text: "新增一个 GET /v1/orders/{id}/items 接口",
          },
          {
            key: "C",
            text: "把响应里的 status 字段从字符串改成对象",
          },
          {
            key: "D",
            text: "放宽 amount 的取值范围，允许更大的整数",
          },
        ],
        answer: [
          "C",
        ],
        explanation: "改字段类型是典型的破坏性变更：老客户端按字符串解析 status，收到对象会直接失败或得到错误结果。新增可选字段与新增接口都是纯增量，老客户端不受影响；放宽取值范围只会让原本合法的请求更多，不会破坏已有调用。",
        difficulty: "medium",
        tags: [
          "接口版本",
          "兼容性",
          "契约",
        ],
        sourceKey: "system-design-primer",
        level: "进阶",
      },
      {
        key: "backend-engineering-exp-be-api-versioning-j1",
        stageKey: "be-api-design",
        topicKey: "be-api-versioning",
        type: "judge",
        stem: "给响应新增一个可选字段对老客户端没有任何影响，因此任何情况下都不需要评估兼容性。",
        options: [
          {
            key: "A",
            text: "正确",
          },
          {
            key: "B",
            text: "错误",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "多数 JSON 客户端会忽略未知字段，但开启严格反序列化的强类型客户端遇到未知字段会直接抛错，部分代码生成工具也会因此失败。新增字段总体上是低风险改动，但仍要按消费方的解析方式评估，必要时先在测试环境验证，而不是默认它绝对安全。",
        difficulty: "hard",
        tags: [
          "兼容性",
          "反序列化",
          "接口演进",
        ],
        sourceKey: "system-design-primer",
        level: "综合",
      },
    ],
  },
{
    trackSlug: "backend-engineering",
    stageKey: "be-data-access",
    topic: {
      key: "be-lock-optimistic-pessimistic",
      title: "乐观锁与悲观锁",
      summary: "悲观锁先锁住行再改，乐观锁用版本号做比较并交换；选哪个取决于同一行的并发冲突概率与持锁代价。",
      concepts: [
        "丢失更新",
        "行锁（SELECT FOR UPDATE）",
        "版本号 CAS",
        "加锁顺序与死锁",
      ],
      principles: [
        "检查与写入必须原子化：先读后写之间隔着窗口，并发下必然丢失更新。",
        "悲观锁在事务里锁行，行为可预测但持锁期间请求排队；事务越长，锁被占用越久。",
        "乐观锁不锁行，UPDATE 带版本条件，影响行数为 0 就是冲突，需要重读重试。",
      ],
      applications: [
        "库存扣减",
        "余额与积分变更",
        "工单状态流转",
      ],
      pitfalls: [
        "在事务外先 SELECT 再 UPDATE，读到的值到写时已经过期。",
        "乐观锁失败后无限立即重试，把冲突放大成重试风暴。",
        "SELECT FOR UPDATE 的条件没走索引，锁住大量行甚至全表。",
      ],
      method: "先估算同一行的并发写频率，再选锁；无论哪种方案，检查与写入都要落在同一条原子语句或同一个短事务里。",
      exercise: "给账户余额扣减写两版实现：悲观锁版与版本号乐观锁版，说明 10 个并发请求到达时各自的行为。",
      checkpoint: "能说清 UPDATE 带版本条件返回 0 行代表什么，以及应用层下一步该做什么。",
      lesson: {
        overview: [
          "两个请求同时把余额从 100 扣 10，各自读到 100，各自写回 90，最终只少了 10 元而不是 20 元。这类问题叫丢失更新，根因是读和写之间有一段窗口，后写的把先写的结果覆盖了。只要存在并发写同一行，就必须回答一个问题：怎么让检查和写入变成一个原子动作，这是并发编程绕不开的门槛。",
          "悲观锁的思路是先占住再改：进事务后 SELECT FOR UPDATE 把这行锁住，别的事务只能排队等待。它简单、行为好预测，但持锁期间所有后续请求都在等；事务里一旦混进网络调用，锁就被拖得很长，吞吐会明显下降。所以用悲观锁的前提是事务足够短，且加锁顺序固定，否则排队的代价会吃掉它带来的确定性。",
          "乐观锁的思路是不加锁，写的时候带上版本条件：UPDATE 时要求 version 还等于刚才读到的值。数据库保证这条语句的检查和写入是原子的，影响行数为 0 就说明被人抢先，应用层重读再试。冲突少时它省掉了锁开销，冲突多时重试会放大压力，反而更慢，所以要看真实争用程度来选。",
        ],
        mechanism: [
          "SELECT FOR UPDATE 加的是行级排他锁。第二个事务执行同样的语句会阻塞，直到第一个事务提交或回滚；在 READ COMMITTED 隔离级别下，它拿到的是最新已提交的版本。锁的粒度取决于 WHERE 命中的行，所以条件列走不走索引很关键，否则可能锁住大量行甚至全表。",
          "乐观锁的 CAS 依赖一条 UPDATE：SET version = version + 1 WHERE id = ? AND version = ?。并发的两条语句在行锁上串行化，第二条发现 version 已被改，匹配不到任何行，返回 0 行。应用层看到 0 行要重新读取最新值再重试，而不是把它当成记录不存在，否则会把冲突误报成数据丢失。",
          "还有一种更简单的写法：UPDATE accounts SET balance = balance - 100 WHERE id = ? AND balance >= 100。把判断直接塞进 WHERE，数据库在行锁内完成读改写，天然不会丢失更新，也不需要版本列。它适合扣减、累加这类单行单条件的场景，用起来最省事，不过它只适用于能把判断写进 WHERE 的场景。",
          "死锁是两个事务以相反顺序锁多行，各自等对方释放。规避办法是统一加锁顺序（比如永远按 id 升序锁），并且让事务尽量短。数据库检测到死锁会主动杀掉其中一个事务，应用层要能识别这个错误并重试，否则用户看到的就是莫名其妙的失败。",
        ],
        example: {
          title: "同一笔扣款：悲观锁、乐观锁与原子 UPDATE",
          language: "sql",
          code: "-- 悲观锁：先锁行再改，必须放在一个短事务里\nBEGIN;\nSELECT balance FROM accounts WHERE id = 42 FOR UPDATE;\n-- 应用层确认余额足够后执行\nUPDATE accounts SET balance = balance - 100 WHERE id = 42;\nCOMMIT;\n\n-- 乐观锁：版本号 CAS，影响行数为 0 说明被抢先\nUPDATE accounts\nSET balance = balance - 100, version = version + 1\nWHERE id = 42 AND version = 7 AND balance >= 100;\n-- 返回 0 行 -> 重新读 version 再试（有上限、有退避）\n\n-- 原子扣减：把判断放进 WHERE，交给行锁保证读改写原子\nUPDATE accounts\nSET balance = balance - 100\nWHERE id = 42 AND balance >= 100;",
          explanation: "悲观锁版本靠 SELECT FOR UPDATE 抢占行锁，读到的余额在事务结束前不会被别人改，代价是后面的请求都在排队。乐观锁版本不占锁，把刚才读到的 version 写进条件，冲突时返回 0 行。第三条最容易写错也最实用：balance = balance - 100 是数据库内部在行锁下完成读改写，不会丢失更新，但仍然需要 balance >= 100 兜住余额不足。",
        },
        practiceSteps: [
          "找出所有并发写同一行的代码路径，确认检查与写入是否在同一条语句或同一个短事务里。",
          "冲突少的场景改成版本号乐观锁，并设置重试次数上限与退避。",
          "冲突高或必须立刻得到结果的场景用 SELECT FOR UPDATE，确保条件列有索引。",
          "多行更新统一加锁顺序，并用并发测试压一遍验证没有死锁或超卖。",
        ],
        masteryChecklist: [
          "能说清丢失更新的发生窗口，并指出代码里哪一句该改。",
          "能判断一个场景该用悲观锁还是乐观锁，并给出理由。",
        ],
        summary: [
          "丢失更新来自读与写之间的窗口，必须原子化。",
          "悲观锁先占行，简单但排队，事务要短。",
          "乐观锁靠版本条件，返回 0 行就是冲突，要重试。",
          "单行扣减可以直接把判断写进 WHERE，最省事。",
        ],
        terms: [
          {
            term: "丢失更新（Lost Update）",
            plain: "两个并发写互相覆盖，后写的把先写的结果冲掉了。",
            detail: "典型特征是最终值只比初始值变了一次，而不是两次。它不会报错，所以很难被发现，只能靠并发测试或对账暴露。",
          },
          {
            term: "悲观锁（Pessimistic Lock）",
            plain: "先锁住数据再改，别人只能排队等。",
            detail: "数据库里通常就是 SELECT FOR UPDATE。它假设冲突经常发生，所以先付出排队成本换确定性；锁被长时间持有是它最大的风险。",
          },
          {
            term: "乐观锁（Optimistic Lock）",
            plain: "不锁，写入时校验版本号，冲突就重试。",
            detail: "它假设冲突很少，把冲突检测推迟到写入那一刻。冲突率高时会频繁重试，性能可能比悲观锁更差，所以要看真实争用程度选。",
          },
          {
            term: "CAS（Compare And Swap）",
            plain: "值还是我读到的那个才写入，否则失败。",
            detail: "乐观锁的 UPDATE ... WHERE version = ? 就是数据库版的 CAS。关键在于比较和写入由数据库在同一条语句里完成，应用层自己比较是没用的。",
          },
        ],
      },
    },
    questions: [
      {
        key: "backend-engineering-exp-be-lock-optimistic-pessimistic-s1",
        stageKey: "be-data-access",
        topicKey: "be-lock-optimistic-pessimistic",
        type: "single",
        stem: "两个并发事务都执行 UPDATE accounts SET balance = balance - 100 WHERE id = 42 AND balance >= 100。关于这种写法，下面哪项正确？",
        options: [
          {
            key: "A",
            text: "仍然会丢失更新，因为应用层先读过余额",
          },
          {
            key: "B",
            text: "数据库在行锁内完成读改写，不会丢失更新；两个事务会先后串行执行",
          },
          {
            key: "C",
            text: "必须额外加 version 版本列才安全",
          },
          {
            key: "D",
            text: "两个事务一定会死锁",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "这条 UPDATE 把读取、判断和写入放在同一条语句里，数据库在对该行加排他锁的前提下完成，第二个事务会等第一个提交后重新读取最新值并重新判断 balance >= 100。因此不需要应用层先读，也不需要版本列。死锁需要两个事务以相反顺序争抢多把锁，这里只涉及一行，不会死锁。",
        difficulty: "medium",
        tags: [
          "并发",
          "行锁",
          "原子更新",
        ],
        sourceKey: "postgresql",
        level: "进阶",
      },
      {
        key: "backend-engineering-exp-be-lock-optimistic-pessimistic-j1",
        stageKey: "be-data-access",
        topicKey: "be-lock-optimistic-pessimistic",
        type: "judge",
        stem: "执行 UPDATE ... SET balance = balance - 100, version = version + 1 WHERE id = 42 AND version = 7 后返回 0 行，说明 id 为 42 的记录一定不存在。",
        options: [
          {
            key: "A",
            text: "正确",
          },
          {
            key: "B",
            text: "错误",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "返回 0 行有两种可能：记录不存在，或者记录存在但 version 已经不是 7，也就是被别的事务抢先改过。乐观锁场景下后者更常见。应用层应该重新读取该行，若读到就带新版本重试，若确实读不到才返回不存在，直接报 404 会把并发冲突误判成数据丢失。",
        difficulty: "hard",
        tags: [
          "乐观锁",
          "CAS",
          "并发",
        ],
        sourceKey: "postgresql",
        level: "综合",
      },
    ],
  },
{
    trackSlug: "backend-engineering",
    stageKey: "be-data-access",
    topic: {
      key: "be-db-connection-pool",
      title: "数据库连接池与连接泄漏",
      summary: "连接是昂贵的长连接，池子大小要按数据库上限和副本数反推；连接不归还，服务最终会卡在获取连接的超时上。",
      concepts: [
        "连接池",
        "池大小与排队",
        "连接泄漏",
        "最大存活与空闲回收",
      ],
      principles: [
        "建连接要握手与认证，成本远高于一次简单查询，所以必须复用；但连接数不是越多越好。",
        "总连接数等于单实例池大小乘副本数，必须低于数据库上限并留出运维余量。",
        "连接必须成对借还，任何异常路径都要归还；泄漏的表现是活跃连接数只增不减。",
      ],
      applications: [
        "多副本服务的容量规划",
        "批处理与在线业务隔离",
        "短生命周期进程接入数据库",
      ],
      pitfalls: [
        "每个副本都把池设成几百，一起上线把数据库连接数打满。",
        "查询或事务抛异常后没归还连接，慢慢泄漏。",
        "在池外自己新建连接，绕过池的管理和上限。",
      ],
      method: "先算实例数乘池大小不超过数据库上限的七成，再按等待时间与活跃连接数调参，而不是凭感觉设数字。",
      exercise: "为 4 个副本的服务规划连接池：写出数据库上限、每副本池大小、获取连接超时，并给出保证归还的代码骨架。",
      checkpoint: "能解释为什么池子越大吞吐不一定越高，以及连接泄漏会表现成什么现象。",
      lesson: {
        overview: [
          "在后端，一条数据库连接是昂贵的长连接：建立它要 TCP 握手、身份认证、初始化会话。如果每个请求都新建连接，光是握手就把延迟吃掉了，数据库也扛不住这种连接风暴。连接池的作用就是预先建好一批连接反复复用，把建立成本摊薄到很多次请求上，这是它最朴素的价值。",
          "池子不是越大越好。数据库每个连接都要占内存、占调度资源，PostgreSQL 甚至是一个连接对应一个后端进程。连接数超过数据库能舒服处理的量之后，吞吐不升反降。所以池大小的上限必须和数据库上限、服务副本数一起算，而不是看单机并发高了就调大，那只是把压力推给数据库。",
          "连接泄漏比池子小更常见也更隐蔽：代码在异常路径上没把连接还回去，活跃连接数只增不减，最后池子耗尽，所有请求卡在获取连接的超时上。表面看是服务整体变慢，实际原因是一条条没归还的连接，只能靠监控池的指标和数据库侧的连接数才能提前发现。",
        ],
        mechanism: [
          "池里维护空闲连接和使用中连接两个集合。取连接时先看空闲队列，有就直接给；没有且未达上限就新建；达到上限就排队等待，等到超时抛错。归还时放回空闲队列，超过空闲上限的连接会被真正关闭，这也是池能自动缩容的方式。",
          "总连接数等于单实例池大小乘副本数。规划时先拿数据库上限乘 0.7 留出余量，再除以副本数。比如上限 100、4 个副本，每实例设 17 左右，而不是每个都设 50。发布扩缩容时副本数会变，池大小最好做成可配置而不是写死。",
          "连接还和事务绑定：一个事务的所有语句必须在同一条连接上执行，否则就不是一个事务。使用框架时，事务边界就是连接借出的边界；跨协程共享同一个连接会互相干扰，甚至把别人的事务提交掉，所以连接不能跨并发单元传递。",
          "空闲连接也有寿命问题：网络中间设备会静默断开长时间不用的连接，池却以为它还活着。所以池要配置最大存活时间与心跳检测，否则业务拿到的是一条已经失效的连接，第一条查询就报错。这个问题在云环境和 NAT 后面尤其常见。",
        ],
        example: {
          title: "按副本数反推池大小，并保证连接归还",
          language: "go",
          code: "package main\n\nimport (\n\t\"context\"\n\t\"database/sql\"\n\t\"time\"\n\n\t_ \"github.com/lib/pq\"\n)\n\nfunc newPool(dsn string) (*sql.DB, error) {\n\tdb, err := sql.Open(\"postgres\", dsn)\n\tif err != nil {\n\t\treturn nil, err\n\t}\n\t// 4 个副本 x 每实例 17 条，总数约 68，低于 max_connections 的 70%\n\tdb.SetMaxOpenConns(17)\n\tdb.SetMaxIdleConns(17)\n\t// 连接存活上限：避开中间设备静默断开的空闲连接\n\tdb.SetConnMaxLifetime(30 * time.Minute)\n\treturn db, nil\n}\n\nfunc transfer(ctx context.Context, db *sql.DB, from, to int64, cents int64) error {\n\ttx, err := db.BeginTx(ctx, nil)\n\tif err != nil {\n\t\treturn err\n\t}\n\t// 任何路径退出都要归还连接；Commit 之后再 Rollback 是安全的空操作\n\tdefer tx.Rollback()\n\n\tif _, err := tx.ExecContext(ctx,\n\t\t\"UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1\",\n\t\tcents, from); err != nil {\n\t\treturn err\n\t}\n\tif _, err := tx.ExecContext(ctx,\n\t\t\"UPDATE accounts SET balance = balance + $1 WHERE id = $2\",\n\t\tcents, to); err != nil {\n\t\treturn err\n\t}\n\treturn tx.Commit()\n}",
          explanation: "SetMaxOpenConns 限制的是同时打开的连接总数（使用中加空闲），17 这个数字来自上限 100 乘 0.7 再除以 4 个副本，而不是随手写。defer tx.Rollback() 保证每条退出路径都会结束事务并归还连接，Commit 成功后再 Rollback 只会返回 ErrTxDone，不会报错。真实项目里还要给获取连接加超时，让池耗尽时快速失败而不是无限等待。",
        },
        practiceSteps: [
          "查出数据库的 max_connections 与当前副本数，算出每实例可用的连接预算。",
          "按预算设置池上限与空闲上限，并给获取连接设置超时。",
          "所有事务用 defer 或 try-with-resources 保证归还，异常路径也要覆盖。",
          "监控池的活跃连接数、等待时间与数据库侧的连接数，出现单调上升就查泄漏。",
        ],
        masteryChecklist: [
          "能根据副本数与数据库上限算出合理的池大小。",
          "能说出连接泄漏在监控上会呈现什么曲线。",
        ],
        summary: [
          "连接是昂贵资源，必须复用，但总数受数据库上限约束。",
          "池大小乘副本数要留余量，七成是常用的经验上限。",
          "事务必须跑在同一条连接上，退出路径都要归还。",
          "泄漏的表现是活跃连接数单调上升，最终卡在获取超时。",
        ],
        terms: [
          {
            term: "连接池（Connection Pool）",
            plain: "预先建好一批数据库连接反复借还，避免每次重连。",
            detail: "池的价值不只是省握手时间，更是给并发加了一个上限。没有上限的连接会直接把数据库压死，而有上限时最多是排队变慢。",
          },
          {
            term: "连接泄漏（Connection Leak）",
            plain: "借出的连接没还回去，池子被慢慢耗光。",
            detail: "常见于异常分支提前 return、忘了 defer、或者回调里抛错。它不会立刻报错，而是几小时后突然全部超时，所以要在监控上看活跃连接数的趋势。",
          },
          {
            term: "max_connections",
            plain: "数据库允许同时存在的连接总数上限。",
            detail: "这是数据库侧的硬上限，超过就直接拒绝新连接。它要覆盖应用池、迁移脚本、运维客户端等所有来源，所以不能把全部额度都给业务。",
          },
          {
            term: "事务（Transaction）",
            plain: "一组要么全成功要么全失败的操作。",
            detail: "事务与连接是绑定的：BEGIN 到 COMMIT 之间的语句必须走同一条连接。跨连接就不再是同一个事务，失败时无法一起回滚。",
          },
        ],
      },
    },
    questions: [
      {
        key: "backend-engineering-exp-be-db-connection-pool-s1",
        stageKey: "be-data-access",
        topicKey: "be-db-connection-pool",
        type: "single",
        stem: "数据库 max_connections 是 100，服务部署 4 个副本。每个副本的连接池上限怎么定更合理？",
        options: [
          {
            key: "A",
            text: "每个副本都设 100，保证单副本有足够连接",
          },
          {
            key: "B",
            text: "每个副本设 15 到 17，使总数不超过上限的七成，留出运维余量",
          },
          {
            key: "C",
            text: "每个副本设 1，避免占满数据库",
          },
          {
            key: "D",
            text: "连接池大小与数据库上限无关，按 CPU 核数设就行",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "总连接数是单实例池大小乘副本数，4 个副本各设 100 会直接申请 400 条连接，远超上限。按上限的七成再除以副本数，每实例大约 17 条，既能支撑并发又给迁移脚本和运维客户端留了空间。设成 1 会让请求大量排队，连接池大小也不能脱离数据库上限单独按 CPU 推算。",
        difficulty: "medium",
        tags: [
          "连接池",
          "容量规划",
          "数据库",
        ],
        sourceKey: "postgresql",
        level: "进阶",
      },
      {
        key: "backend-engineering-exp-be-db-connection-pool-j1",
        stageKey: "be-data-access",
        topicKey: "be-db-connection-pool",
        type: "judge",
        stem: "连接池上限调得越大，数据库能同时处理的查询就越多，所以应该尽量调大。",
        options: [
          {
            key: "A",
            text: "正确",
          },
          {
            key: "B",
            text: "错误",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "数据库的并发处理能力受 CPU、内存与锁竞争限制，连接数超过这个量之后只会增加上下文切换和内存占用，吞吐反而下降。PostgreSQL 每个连接对应一个后端进程，代价尤其明显。池的作用是给并发一个上限，让排队发生在应用侧而不是把数据库压垮。",
        difficulty: "easy",
        tags: [
          "连接池",
          "容量",
          "数据库",
        ],
        sourceKey: "postgresql",
        level: "入门",
      },
    ],
  },
{
    trackSlug: "backend-engineering",
    stageKey: "be-runtime",
    topic: {
      key: "be-async-queue",
      title: "异步任务队列与幂等消费",
      summary: "把耗时操作挪出请求链路，就要接受消息至少投递一次：消费端必须幂等，失败要能重试，重试到头要进死信队列。",
      concepts: [
        "生产者与消费者",
        "至少一次投递",
        "幂等消费",
        "重试与死信队列",
      ],
      principles: [
        "队列承诺的是至少一次，重复是正常现象：消费端按业务键去重，而不是指望只投一次。",
        "消息要在业务处理成功后才确认；处理失败就让它超时重投，把可见性超时当作重试机制。",
        "重试必须有上限与退避，超过上限进死信队列保留现场，避免毒消息无限循环。",
      ],
      applications: [
        "发邮件与短信通知",
        "订单超时关闭",
        "报表生成与视频转码",
      ],
      pitfalls: [
        "先确认再处理，进程崩溃就永久丢消息。",
        "消费逻辑不幂等，重复投递导致重复发货或重复扣款。",
        "无限重试且没有退避，下游故障时被反复打。",
      ],
      method: "先给每条消息定义业务唯一键与去重方式，再决定重试次数、退避曲线与死信处理流程。",
      exercise: "为订单支付成功后发通知设计消息结构、去重键、重试策略与死信处理流程。",
      checkpoint: "能解释为什么消息只消费一次在工程上做不到，以及如何让重复无害。",
      lesson: {
        overview: [
          "请求链路里做重活会直接拖垮响应时间：发邮件、生成报表、转码视频这些操作慢且容易失败，放在同步链路里，用户要一直等，失败了也没法重来。把它们挪到队列后面异步执行，请求可以先返回，任务可以重试，高峰期还能削峰，这是异步最直接的收益。",
          "异步带来的第一个现实问题是不再只有一次。生产者投递、消费者处理、确认这三步之间任何一步崩溃，broker 都只能选择重投，于是重复消费成了常态。这就是至少一次投递的含义，它不是实现缺陷，而是为了不丢消息付出的代价，任何声称恰好一次的方案，端到端也仍然要自己做幂等。",
          "所以消费端必须幂等：同一条消息处理两次，业务结果要和一次一样。判断标准不是代码没报错，而是数据库里的最终状态一致。做法通常是用事件自带的业务唯一键建唯一索引或去重表，把重复挡在写入这一层；发现已经处理过就直接确认，不要再执行一遍副作用。",
        ],
        mechanism: [
          "可见性超时是队列的核心机制：消费者取走消息后，消息被隐藏一段时间，期间别人看不到；处理成功就确认删除，超时没确认就重新可见，被另一个消费者取走。因此处理耗时必须短于可见性超时，长任务要周期性续期，否则会在处理途中被重复投递。",
          "确认时机决定会不会丢消息。处理完成后才确认，崩溃最多导致重复；先确认再处理，崩溃就永久丢消息。宁可重复也不要丢，这是大多数业务的选择，重复再用幂等消化。注意确认动作本身也可能失败，失败时消息会被重投，仍然回到重复这一侧。",
          "重试要有上限和退避。失败立即重投会让下游在故障时被反复打，退避给下游恢复的时间；超过上限的消息转入死信队列保留现场，由人工或补偿任务处理。没有死信队列，一条毒消息就能被无限重投，把整条队列的消费能力拖慢。",
          "多个消费者并行时全局顺序无法保证，只能按分区键保证同键有序：同一个订单的消息进同一个分区，消费者按分区顺序处理。要求全局有序，就等于放弃水平扩展，这个取舍必须在设计消息结构时就明确，而不是等到出现乱序再补。",
        ],
        example: {
          title: "幂等消费：把重复挡在业务键上",
          language: "python",
          code: "def handle(msg):\n    event_id = msg[\"event_id\"]\n\n    # 1) 已经处理过就直接确认，重复投递到此为止\n    if already_done(event_id):\n        ack(msg)\n        return\n\n    # 2) 把事件 ID 作为下游的幂等键：重复调用不会重复发送\n    send_email(msg[\"to\"], msg[\"subject\"], idempotency_key=event_id)\n\n    # 3) 发送成功后才记账，最后才确认\n    with db.transaction():\n        db.execute(\n            \"INSERT INTO notify_done (event_id) VALUES (%s) \"\n            \"ON CONFLICT (event_id) DO NOTHING\",\n            [event_id],\n        )\n    ack(msg)",
          explanation: "顺序很关键。如果先写去重记录再发送，一旦发送失败，重投时会被误判成已完成而永久跳过，消息就丢了；所以这里先发送、成功后再记账，代价是崩溃窗口内可能重复发送一次，重复由下游的幂等键吸收。这条消息既不会因为崩溃而丢失，也不会因为重投而重复产生副作用。",
        },
        practiceSteps: [
          "为每类消息定义业务唯一键，写清重投时它为什么不变。",
          "消费逻辑改成可重入：先查是否已完成，再执行副作用，最后确认。",
          "设置最大重试次数与指数退避，并配置死信队列与告警。",
          "构造重复投递与中途崩溃两种测试，验证最终状态与只消费一次一致。",
        ],
        masteryChecklist: [
          "能说清为什么至少一次投递下重复无法避免。",
          "能指出消费代码里先记账还是先发送会导致什么后果。",
        ],
        summary: [
          "异步把耗时操作移出请求链路，代价是重复投递。",
          "至少一次意味着消费端必须幂等。",
          "先确认再处理会丢消息，处理成功再确认才安全。",
          "重试有上限、有退避，超限进死信队列。",
        ],
        terms: [
          {
            term: "至少一次（At-least-once）",
            plain: "消息保证不丢，但可能被投递多次。",
            detail: "这是不丢消息与重复投递之间的取舍。要做到不丢，broker 只能在没收到确认时重投，而确认本身可能丢，所以重复无法根除。",
          },
          {
            term: "幂等消费（Idempotent Consumer）",
            plain: "同一条消息消费两次，业务结果和一次一样。",
            detail: "判断标准是数据库最终状态，而不是消费过程没报错。常见实现是用事件 ID 建唯一索引，或用状态机把重复操作变成空操作。",
          },
          {
            term: "可见性超时（Visibility Timeout）",
            plain: "消息被取走后隐藏的时间，超时没确认就重新可见。",
            detail: "它是队列实现重试的方式，也是重复消费的来源。处理时间必须短于它，长任务要定期续期，否则消息会在你还在处理时被第二个消费者取走。",
          },
          {
            term: "死信队列（DLQ）",
            plain: "重试到头的消息转存到这里，留待人工处理。",
            detail: "它把无法处理的消息隔离出来，避免毒消息反复占用消费能力。没有 DLQ 的队列，一条格式错误的消息就能让整个消费组卡住。",
          },
        ],
      },
    },
    questions: [
      {
        key: "backend-engineering-exp-be-async-queue-s1",
        stageKey: "be-runtime",
        topicKey: "be-async-queue",
        type: "single",
        stem: "消息队列只保证至少一次投递。下面哪种消费端设计是正确的？",
        options: [
          {
            key: "A",
            text: "处理前先确认消息，避免重复消费",
          },
          {
            key: "B",
            text: "用事件里的业务唯一键去重，重复消费时结果与消费一次相同",
          },
          {
            key: "C",
            text: "在消费端记录消息序号，靠序号保证只消费一次",
          },
          {
            key: "D",
            text: "把重试次数设为无限，确保消息最终被处理",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "至少一次意味着重复一定会发生，唯一可靠的办法是让重复无害：用事件自带的业务唯一键做去重，重复消费时最终状态不变。先确认再处理会在崩溃时永久丢消息；本地序号在多实例部署下无法全局一致；无限重试会让毒消息反复占用消费能力。",
        difficulty: "medium",
        tags: [
          "消息队列",
          "幂等",
          "异步",
        ],
        sourceKey: "system-design-primer",
        level: "进阶",
      },
      {
        key: "backend-engineering-exp-be-async-queue-j1",
        stageKey: "be-runtime",
        topicKey: "be-async-queue",
        type: "judge",
        stem: "先确认消息再处理业务，可以提升吞吐，而且不会造成数据丢失。",
        options: [
          {
            key: "A",
            text: "正确",
          },
          {
            key: "B",
            text: "错误",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "先确认等于告诉队列这条消息已经处理完，一旦进程在处理途中崩溃，消息不会再被投递，业务就永久丢失了。正确顺序是处理成功后再确认，崩溃最多造成重复，而重复可以由幂等逻辑吸收。吞吐的收益不能拿数据丢失来换。",
        difficulty: "easy",
        tags: [
          "消息队列",
          "确认时机",
          "可靠性",
        ],
        sourceKey: "system-design-primer",
        level: "入门",
      },
    ],
  },
{
    trackSlug: "backend-engineering",
    stageKey: "be-runtime",
    topic: {
      key: "be-graceful-shutdown",
      title: "优雅停机与健康检查",
      summary: "收到终止信号后要先摘流量、再排空在途请求、最后关资源；健康检查要分清活着和能接流量这两种状态。",
      concepts: [
        "SIGTERM 与信号处理",
        "排空（drain）",
        "readiness 与 liveness",
        "终止宽限期",
      ],
      principles: [
        "停机分三步：先摘流量，再等在途请求结束，最后关闭连接池与后台任务。",
        "liveness 失败会重启进程，readiness 失败只是摘流量，两者混用会把小故障放大成重启风暴。",
        "终止宽限期必须大于摘流延迟加排空超时，否则进程会在排空途中被强杀。",
      ],
      applications: [
        "滚动发布",
        "Kubernetes 滚动更新",
        "缩容与机器迁移",
      ],
      pitfalls: [
        "收到 SIGTERM 立刻退出，正在写的请求被腰斩。",
        "readiness 检查里连数据库，数据库抖动就把全部实例摘流。",
        "终止宽限期短于最长请求耗时。",
      ],
      method: "先测出 P99 请求耗时，再定摘流延迟、排空超时与宽限期三段时间，保证排空能跑完。",
      exercise: "为 HTTP 服务实现 SIGTERM 处理：先置 readiness 为 false，等待数秒，再 Shutdown 并关闭连接池。",
      checkpoint: "能说明 readiness 与 liveness 失败分别导致什么动作，以及宽限期怎么算。",
      lesson: {
        overview: [
          "滚动发布、缩容、迁移都会杀掉正在运行的进程。如果进程收到终止信号就立刻退出，手上正在处理的请求会被腰斩：调用方收到连接重置，写了一半的数据可能只落了一半。优雅停机就是给进程一段时间，把手上的活干完再走，让发布对用户无感。",
          "停机不是一瞬间的事，而是一个顺序：先让负载均衡别再往这里送新流量，再等存量的在途请求结束，最后关闭连接池、队列消费者这些资源。顺序错了，比如先关连接池，正在跑的请求会在半路失败，排空就失去意义，所以停机顺序要写进代码，而不是靠运维手动操作。",
          "健康检查要分成两个：存活检查只回答进程有没有卡死，失败就重启；就绪检查回答现在能不能接流量，失败只是从负载均衡摘掉。把两者混成一个，数据库抖一下就会把所有实例同时重启，小故障被放大成全面不可用，这种自伤在故障复盘里反复出现。",
        ],
        mechanism: [
          "以 Kubernetes 为例，删除 Pod 时它会同时做两件事：给容器发 SIGTERM，并从 Service 的 endpoints 里摘除。摘除是异步的，各个节点上的转发规则更新有延迟，所以进程如果立刻退出，仍会有请求打进来，需要先等几秒再停服务，这几秒通常被称为摘流延迟，必须留出来。",
          "HTTP 服务的标准做法是调用 Server.Shutdown(ctx)：它先停止接受新连接，再等待活跃请求完成，ctx 到期则强制关闭。注意它不会关闭你自己持有的数据库连接池，那部分要单独收尾，否则连接会在进程退出时被硬断开，还可能留下未提交的事务。",
          "终止宽限期必须大于摘流延迟加排空超时。如果宽限期只有 10 秒而最长请求要 30 秒，进程会在排空途中被强杀，优雅停机就失效了。反过来说，排空超时也不能设得比宽限期还长，否则代码等得到结果，进程已经被杀。",
          "后台任务也要接同一个信号：消费循环收到取消后应停止取新消息、把手上这条消息处理完再退出，否则每次发布都会留下处理到一半的任务，只能靠重投和幂等兜底。长期任务还要检查取消信号，不能一口气跑完再退出。",
        ],
        example: {
          title: "收到 SIGTERM 后：摘流量、排空、关资源",
          language: "go",
          code: "srv := &http.Server{Addr: \":8080\", Handler: mux}\n\ngo func() {\n\tif err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {\n\t\tlog.Fatalf(\"listen: %v\", err)\n\t}\n}()\n\nstop := make(chan os.Signal, 1)\nsignal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)\n<-stop\n\n// 1) 先让 readiness 探针返回 503，等负载均衡把流量摘掉\natomic.StoreInt32(&ready, 0)\ntime.Sleep(5 * time.Second)\n\n// 2) 停止接受新连接，等待在途请求完成\nctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)\ndefer cancel()\nif err := srv.Shutdown(ctx); err != nil {\n\tlog.Printf(\"forced shutdown: %v\", err)\n}\n\n// 3) 关闭数据库连接池等资源\ndb.Close()",
          explanation: "三段顺序对应停机的三个动作。先置 readiness 为 0 并睡 5 秒，是给负载均衡和转发规则留出摘流时间，否则新请求还会打进来。Shutdown 会停止接受新连接并等待在途请求，20 秒的超时必须小于 Kubernetes 的 terminationGracePeriodSeconds，否则进程会被强杀。最后关闭连接池，因为此时已经没有请求在使用它。",
        },
        practiceSteps: [
          "统计服务的最长请求耗时，定出排空超时。",
          "实现 SIGTERM 处理：先关 readiness 开关，等摘流延迟，再调用 Shutdown。",
          "把 terminationGracePeriodSeconds 设为摘流延迟加排空超时再加缓冲。",
          "用滚动发布演练一次，观察发布期间是否出现 502 或连接重置。",
        ],
        masteryChecklist: [
          "能说清 readiness 与 liveness 的区别，以及失败后的不同动作。",
          "能算出宽限期与排空超时的关系，并指出配错会怎样。",
        ],
        summary: [
          "停机顺序：摘流量、排空在途请求、关闭资源。",
          "readiness 控制接不接流量，liveness 控制要不要重启。",
          "宽限期要覆盖摘流延迟加排空超时。",
          "后台任务也要响应取消信号，把手上的消息处理完。",
        ],
        terms: [
          {
            term: "优雅停机（Graceful Shutdown）",
            plain: "先停止接新请求，等手上的请求做完再退出。",
            detail: "它解决的是发布瞬间的连接重置和数据写一半问题。没有它，每次发布都会有一小批请求失败，量大时就是可见的错误率尖峰。",
          },
          {
            term: "排空（Drain）",
            plain: "把已经在处理的请求等完的过程。",
            detail: "排空需要时间预算，超出预算就只能强杀。排空期间不能再接新请求，否则永远排不空，所以顺序一定是先摘流量再排空。",
          },
          {
            term: "readiness 探针",
            plain: "回答这个实例现在能不能接流量，失败只摘流量不重启。",
            detail: "它适合表达依赖是否就绪、是否正在停机这类临时状态。把耗时操作或数据库查询塞进去，会让数据库抖动直接演变成全量摘流。",
          },
          {
            term: "liveness 探针",
            plain: "回答进程是否卡死，失败会被重启。",
            detail: "它应该只检查进程自身，比如事件循环是否还能响应，不要依赖外部服务。liveness 配得太敏感，会把慢请求误判成死锁，引发重启风暴。",
          },
        ],
      },
    },
    questions: [
      {
        key: "backend-engineering-exp-be-graceful-shutdown-s1",
        stageKey: "be-runtime",
        topicKey: "be-graceful-shutdown",
        type: "single",
        stem: "在 Kubernetes 里 readiness 探针失败会发生什么？",
        options: [
          {
            key: "A",
            text: "容器被重启",
          },
          {
            key: "B",
            text: "Pod 从 Service 的 endpoints 摘除，不再接收新流量，但不会被重启",
          },
          {
            key: "C",
            text: "节点被驱逐，Pod 被调度到别的机器",
          },
          {
            key: "D",
            text: "什么都不发生，探针结果只写进日志",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "readiness 表达的是现在能不能接流量，失败时 kubelet 把 Pod 从 Service 的 endpoints 里移除，已有连接不受影响，进程也不会重启。触发重启的是 liveness 探针。把两者混用，依赖抖动就会导致所有实例同时重启，把小故障放大。",
        difficulty: "medium",
        tags: [
          "健康检查",
          "Kubernetes",
          "停机",
        ],
        sourceKey: "gin",
        level: "进阶",
      },
      {
        key: "backend-engineering-exp-be-graceful-shutdown-j1",
        stageKey: "be-runtime",
        topicKey: "be-graceful-shutdown",
        type: "judge",
        stem: "收到 SIGTERM 后立刻退出进程是最佳实践，剩下的请求交给负载均衡重试即可。",
        options: [
          {
            key: "A",
            text: "正确",
          },
          {
            key: "B",
            text: "错误",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "立刻退出会中断在途请求，而且负载均衡摘除 endpoints 是异步的，退出瞬间仍有新请求打进来。正确的做法是先关闭 readiness 等待摘流，再停止接受新连接并等待在途请求完成，最后关闭连接池等资源。让调用方重试会把成本转嫁给上游，还可能造成重复写入。",
        difficulty: "medium",
        tags: [
          "SIGTERM",
          "停机",
          "发布",
        ],
        sourceKey: "gin",
        level: "进阶",
      },
    ],
  },
{
    trackSlug: "backend-engineering",
    stageKey: "be-delivery",
    topic: {
      key: "be-docker-image",
      title: "容器镜像构建与分层缓存",
      summary: "镜像按 Dockerfile 指令分层，层内容不变就复用缓存；把变化慢的依赖放前面、变化快的源码放后面，构建才会快。",
      concepts: [
        "镜像分层与缓存",
        "多阶段构建",
        "构建上下文",
        "非 root 与固定版本",
      ],
      principles: [
        "每层缓存键由指令、输入文件哈希与父层决定，一旦某层失效，它之后的层全部重建。",
        "多阶段构建把编译工具链留在构建段，运行镜像只拷产物，体积与攻击面同时变小。",
        "构建上下文默认整个目录，必须用 .dockerignore 排除依赖目录、版本库与密钥。",
      ],
      applications: [
        "CI 构建加速",
        "减小生产镜像体积",
        "统一本地与线上运行环境",
      ],
      pitfalls: [
        "COPY . . 放在依赖安装之前，改一行代码就重装全部依赖。",
        "镜像里塞进 .env、.git 或构建缓存。",
        "基础镜像用 latest，构建结果不可复现。",
      ],
      method: "先排 Dockerfile 指令顺序（系统依赖、语言依赖、源码），再用多阶段与非 root 收尾，最后固定基础镜像版本。",
      exercise: "为一个服务写多阶段 Dockerfile，并指出只改业务代码时哪几层能命中缓存。",
      checkpoint: "能指出一个 Dockerfile 里哪些写法会让缓存失效或让镜像变大。",
      lesson: {
        overview: [
          "镜像不是一个大文件，而是一串只读层叠加起来的，Dockerfile 里每条指令基本对应一层。构建时只要某一层的输入没变，这一层以及它前面的层都能直接复用缓存，构建时间能从几分钟降到几秒。理解分层，是写出快构建的第一步，也是控制镜像体积的前提。",
          "最常见的缓存失效是 COPY . . 放得太早：改一行源码，整个源码层的哈希就变了，后面所有层都要重建，连依赖安装也重跑一遍。正确顺序是把变化慢的放前面（系统包、依赖清单），变化快的放后面（业务源码），让依赖层的缓存尽量命中，这是 CI 上最划算的优化，通常能把构建从几分钟压到几十秒。",
          "多阶段构建解决体积问题：编译工具链、测试依赖只留在构建阶段，运行镜像只拷产物。最终镜像能小一个数量级，攻击面也更小。再配一个非 root 用户和固定的基础镜像版本，就是一个可以上生产的镜像，而不是把开发机环境整个打包进去，体积和漏洞都会少很多。",
        ],
        mechanism: [
          "每层有自己的缓存键，通常由指令文本、输入文件内容哈希、父层 ID 一起算出来。命中缓存就复用，否则这一层重建，并且它之后的所有层缓存都失效，因为父层 ID 变了。这就是层顺序如此重要的原因，顺序错了就要全量重建，哪怕只改了一个空格。",
          "构建开始时，客户端会把构建上下文整个目录打包发给 daemon，除非被 .dockerignore 排除。上下文里有 node_modules 或 .git 时，打包本身就慢，还可能把密钥带进镜像。这是构建慢的最常见原因，也是泄密的常见入口，所以 .dockerignore 要和 Dockerfile 一起维护，否则构建会又慢又危险。",
          "多阶段构建里，前面的构建段装编译器并产出二进制，后面的运行段用 COPY --from=build 只拷贝产物。运行镜像里没有编译器、没有源码、没有包管理器，体积和漏洞都少。代价是调试时不能进容器里编译，要接受不可变镜像的约束。",
          "latest 标签指向会变，同一份 Dockerfile 在不同时间构建可能拿到不同基础镜像，出问题无法复现。固定到精确版本或镜像 digest，并定期有计划地升级，才能兼顾可复现与安全。这也是为什么生产构建通常禁用 latest，因为它不可审计。",
        ],
        example: {
          title: "多阶段 Dockerfile：缓存顺序与最小运行镜像",
          language: "text",
          code: "# 阶段一：构建（编译器只留在这里）\nFROM golang:1.23-alpine AS build\nWORKDIR /src\n\n# 先只拷依赖清单：依赖没变时这一层直接命中缓存\nCOPY go.mod go.sum ./\nRUN go mod download\n\n# 源码放最后：改代码只会重建这一层及其之后\nCOPY . .\nRUN CGO_ENABLED=0 go build -trimpath -o /out/app ./cmd/server\n\n# 阶段二：运行（没有编译器、没有源码、非 root）\nFROM gcr.io/distroless/static-debian12:nonroot\nCOPY --from=build /out/app /app\nUSER nonroot:nonroot\nEXPOSE 8080\nENTRYPOINT [\"/app\"]",
          explanation: "关键在于 COPY go.mod go.sum 与 COPY . . 的先后：依赖清单很少变，放在前面能让 go mod download 这一层长期命中缓存；源码放在最后，改业务代码时只重建最后两层。运行阶段从零开始，用 COPY --from=build 只拿编译好的二进制，基础镜像里没有 shell 和包管理器，体积和可攻击面都大幅缩小。镜像 tag 固定到具体版本，换版本要显式改这一行。",
        },
        practiceSteps: [
          "写 .dockerignore，排除 node_modules、.git、构建产物与本地密钥。",
          "把 Dockerfile 指令按变化频率排序：系统依赖、语言依赖、源码。",
          "用多阶段构建，运行段只拷产物，并切换到非 root 用户。",
          "把基础镜像固定到精确版本或 digest，并用 docker history 检查每层大小。",
        ],
        masteryChecklist: [
          "能解释为什么调整 COPY 的顺序就能大幅提速 CI。",
          "能说出多阶段构建与固定基础镜像版本各自解决什么问题。",
        ],
        summary: [
          "镜像是只读层的叠加，层输入不变就能复用缓存。",
          "变化慢的放前面，变化快的放后面，缓存才不会被源码改动击穿。",
          "多阶段构建只把产物带进运行镜像，体积和攻击面都小。",
          "基础镜像要固定版本，latest 会让构建不可复现。",
        ],
        terms: [
          {
            term: "镜像层（Layer）",
            plain: "镜像里一层只读的文件改动，可以被缓存复用。",
            detail: "层一旦生成就不再修改，新指令只是在上面叠加。所以删除文件不会让镜像变小，敏感信息写进某一层后即使下一层删掉，也仍然能从历史层里取出来。",
          },
          {
            term: "多阶段构建（Multi-stage Build）",
            plain: "在构建阶段编译，只把产物拷进最终镜像。",
            detail: "它让你可以放心在构建段装各种工具，而不用担心污染运行镜像。运行镜像里没有编译器，也就没有对应的漏洞和体积。",
          },
          {
            term: "构建上下文（Build Context）",
            plain: "构建时发给构建引擎的目录，默认是 Dockerfile 所在目录。",
            detail: "COPY 只能引用上下文里的文件，上下文越大传输越慢。忘记写 .dockerignore 时，整个 node_modules 和 .git 都会被打包发送。",
          },
          {
            term: "基础镜像（Base Image）",
            plain: "你的镜像叠在它上面的那个起点镜像。",
            detail: "选基础镜像就是选运行环境与漏洞基线。固定精确版本或 digest 才能复现构建；用 latest 时，同样的 Dockerfile 明天可能构建出不同的东西。",
          },
        ],
      },
    },
    questions: [
      {
        key: "backend-engineering-exp-be-docker-image-s1",
        stageKey: "be-delivery",
        topicKey: "be-docker-image",
        type: "single",
        stem: "下面哪种 Dockerfile 写法，在只修改业务源码时能最大程度复用构建缓存？",
        options: [
          {
            key: "A",
            text: "先 COPY . .，再 RUN 安装依赖",
          },
          {
            key: "B",
            text: "先 COPY 依赖清单（如 go.mod、package.json），安装依赖，再 COPY 源码",
          },
          {
            key: "C",
            text: "把所有步骤合并成一条 RUN 指令",
          },
          {
            key: "D",
            text: "每次构建都加 --no-cache，保证结果最新",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "缓存键包含该层的输入文件哈希。先拷依赖清单再安装依赖，源码改动不会影响依赖层，这一层能长期命中；反过来先 COPY . . 会让源码改动直接击穿依赖层，每次都要重装。合并成一条 RUN 并不会减少重建，加 --no-cache 更是主动放弃缓存。",
        difficulty: "medium",
        tags: [
          "Docker",
          "构建缓存",
          "CI",
        ],
        sourceKey: "system-design-primer",
        level: "进阶",
      },
      {
        key: "backend-engineering-exp-be-docker-image-j1",
        stageKey: "be-delivery",
        topicKey: "be-docker-image",
        type: "judge",
        stem: "基础镜像使用 latest 标签，可以保证不同时间构建出的镜像完全一致。",
        options: [
          {
            key: "A",
            text: "正确",
          },
          {
            key: "B",
            text: "错误",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "latest 是一个会移动的标签，它指向的镜像会随上游发布而变化。同一份 Dockerfile 在不同时间构建可能拿到不同基础镜像，出问题时无法复现。要固定到精确版本或镜像 digest，并定期有计划地升级，才能兼顾可复现与安全。",
        difficulty: "easy",
        tags: [
          "Docker",
          "可复现",
          "基础镜像",
        ],
        sourceKey: "system-design-primer",
        level: "入门",
      },
    ],
  },
{
    trackSlug: "backend-engineering",
    stageKey: "be-delivery",
    topic: {
      key: "be-feature-flag",
      title: "特性开关与灰度发布",
      summary: "发布与放量分开：代码以关闭状态上线，再用开关按用户稳定分桶逐步打开，出问题改配置即可回滚。",
      concepts: [
        "发布与放量分离",
        "开关求值",
        "稳定分桶",
        "开关生命周期",
      ],
      principles: [
        "开关把部署与启用解耦，回滚从重新发布变成改一个配置。",
        "灰度分桶必须稳定：用用户标识加开关名做哈希，同一用户每次落在同一桶。",
        "开关是临时设施，全量稳定后必须清理，否则会积累成组合爆炸的分支。",
      ],
      applications: [
        "新功能灰度",
        "付费与权限实验",
        "故障时一键关停",
      ],
      pitfalls: [
        "用随机数分桶，同一用户反复进出实验组。",
        "开关默认值设成开启，代码一上线就等于全量。",
        "开关嵌套太多，谁也说不清当前行为。",
      ],
      method: "先明确开关的负责人与清理时间，再定默认值（生产默认关闭）、放量阶梯与观测指标。",
      exercise: "为新的结算页写一个灰度开关：按 user_id 稳定分桶到 5%、50%、100%，并写出回滚步骤。",
      checkpoint: "能解释为什么用随机数做灰度分桶是错的。",
      lesson: {
        overview: [
          "发布和放量是两件事。传统做法是代码一上线就等于功能全量，出问题只能回滚整个部署，几分钟到几十分钟。特性开关把两者拆开：代码以关闭状态上线，功能是否可见由配置决定，出问题改配置秒级回滚，不用重新构建和部署，这就是它的核心价值。",
          "灰度是开关最典型的用法：先给内部账号，再 1%、10%、50%，最后全量。每一步都盯着错误率和耗时，指标不对就退回上一档。分桶必须稳定，同一个用户每次都该落在同一组，否则体验会来回跳，实验数据也不可信，所以分桶函数一旦上线就不能随便改，改了就相当于换了一批人。",
          "开关不是免费的。每个开关都是一个长期存在的分支，没人清理就会越积越多，几个开关叠在一起，组合起来谁也说不清当前行为，也没人敢删。所以开关从创建那天起就该有负责人和清理时间，全量稳定后第一时间删掉代码里的旧分支，否则它就是技术债。",
        ],
        mechanism: [
          "求值过程必须快且不能失败：请求进来时读本地缓存的开关配置，按规则算出布尔值。配置由配置中心定期同步或推送。求值异常时要回退到默认值，绝不能因为配置服务挂了就让业务请求全部失败。",
          "稳定分桶的做法是对用户标识加开关名做哈希，再对 100 取模。加开关名是为了让不同开关的桶互相独立，否则同一个 10% 用户群会永远同时命中所有实验。哈希结果必须固定，不能每次请求重新随机，否则同一个人会反复进出。",
          "回滚速度取决于配置推送和本地缓存的过期时间。如果本地缓存 TTL 设成十分钟，那么关掉开关也要十分钟才生效，紧急止损就来不及了。关键开关要支持主动推送，或者把 TTL 设得很短，这两者只能选一个，不能都没有。",
          "开关的默认值在生产环境必须是关闭，并且代码要同时兼容开和关两条路径。这听起来理所当然，但把默认值写成开启、测试只覆盖了新路径，恰恰是灰度事故最常见的起因，默认开启等于跳过灰度直接全量。",
        ],
        example: {
          title: "稳定分桶与开关求值",
          language: "typescript",
          code: "type FlagRule = { key: string; percentage: number; enabled: boolean };\n\n// FNV-1a：同一用户 + 同一开关永远落在同一个桶\nfunction bucket(userId: string, flagKey: string): number {\n  const seed = flagKey + ':' + userId;\n  let hash = 2166136261;\n  for (let i = 0; i < seed.length; i += 1) {\n    hash ^= seed.charCodeAt(i);\n    hash = Math.imul(hash, 16777619);\n  }\n  return (hash >>> 0) % 100;\n}\n\nfunction isEnabled(flag: FlagRule, userId: string): boolean {\n  if (!flag.enabled) return false;              // 总开关，关掉立即全量回滚\n  if (flag.percentage >= 100) return true;\n  return bucket(userId, flag.key) < flag.percentage;\n}",
          explanation: "用固定的哈希函数而不是随机数，保证同一个 userId 在任何实例、任何时间都得到同一个桶号，用户不会反复进出灰度。把 flagKey 拼进种子，是为了让不同开关的分桶互相独立，否则所有实验都会命中同一批人。Math.imul 保证 32 位整数乘法不丢精度，>>> 0 转成无符号，最后对 100 取模。总开关放在最前面，故障时可以直接关掉，不依赖比例配置。",
        },
        practiceSteps: [
          "为功能定义开关 key、生产默认值（关闭）与负责人、清理时间。",
          "用 user_id 加 flag_key 哈希分桶，按 1%、10%、50%、100% 分档放量。",
          "每档观察错误率与 P99，指标恶化就退回上一档。",
          "全量稳定后删除开关与旧代码分支，避免长期分支堆积。",
        ],
        masteryChecklist: [
          "能解释稳定分桶与随机分桶的区别，以及后者为什么错。",
          "能说出开关默认值与清理时间为什么必须在创建时定好。",
        ],
        summary: [
          "发布是代码上线，放量是功能可见，开关把两者分开。",
          "分桶要稳定：哈希用户标识加开关名，同一用户始终同组。",
          "生产默认关闭，故障时关开关就是秒级回滚。",
          "开关有生命周期，全量后要删，否则变成技术债。",
        ],
        terms: [
          {
            term: "特性开关（Feature Flag）",
            plain: "一个配置项，用来在不发版的情况下打开或关闭功能。",
            detail: "它把部署与启用解耦，所以能秒级止损。代价是代码里多了一条分支，两条路径都要测试，否则关掉时反而出错。",
          },
          {
            term: "灰度发布（Canary Release）",
            plain: "先让小部分用户用新版本，观察没问题再扩大。",
            detail: "关键不是分批，而是每批都有明确的观测指标和回退动作。没有指标的分批只是推迟了事故发现时间。",
          },
          {
            term: "分桶（Bucketing）",
            plain: "按哈希把用户稳定地分到某个百分比组里。",
            detail: "稳定是它的核心要求：同一用户每次都要落在同一桶。用随机数分桶会让用户反复进出，既影响体验，也让实验数据失去意义。",
          },
          {
            term: "kill switch",
            plain: "出故障时一键关掉某功能的开关。",
            detail: "它要求开关求值足够快、配置能迅速生效，并且关掉后代码走的是经过验证的旧路径。平时不演练，真到故障时往往发现关不掉。",
          },
        ],
      },
    },
    questions: [
      {
        key: "backend-engineering-exp-be-feature-flag-s1",
        stageKey: "be-delivery",
        topicKey: "be-feature-flag",
        type: "single",
        stem: "做 10% 灰度时，下面哪种分桶方式能保证同一用户每次都看到一致的结果？",
        options: [
          {
            key: "A",
            text: "每次请求用 Math.random() < 0.1 判断",
          },
          {
            key: "B",
            text: "对 user_id 加开关名做哈希后对 100 取模，结果小于 10 则命中",
          },
          {
            key: "C",
            text: "按请求来源 IP 的最后一段取模",
          },
          {
            key: "D",
            text: "由负载均衡按实例轮询决定",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "哈希用户标识能得到稳定且均匀的分布，同一用户每次求值都落在同一个桶；加入开关名可以让不同实验的分桶互相独立。随机数会让用户每次请求都重新抽签，体验反复横跳。IP 会随网络环境变化，同一个用户可能被分到不同组；按实例轮询更是与用户无关。",
        difficulty: "medium",
        tags: [
          "灰度",
          "分桶",
          "开关",
        ],
        sourceKey: "spring-boot",
        level: "进阶",
      },
      {
        key: "backend-engineering-exp-be-feature-flag-j1",
        stageKey: "be-delivery",
        topicKey: "be-feature-flag",
        type: "judge",
        stem: "特性开关全量之后应当尽快删除开关和相关旧代码分支，否则会积累成难以维护的分支组合。",
        options: [
          {
            key: "A",
            text: "正确",
          },
          {
            key: "B",
            text: "错误",
          },
        ],
        answer: [
          "A",
        ],
        explanation: "开关是临时设施，功能全量后它只剩一条永远为真的分支。留在代码里会形成长期分支，几个开关叠加就产生组合爆炸，测试覆盖不到，也没人敢删。正确做法是在创建时就约定负责人与清理时间，全量稳定后删除开关和旧路径。",
        difficulty: "easy",
        tags: [
          "开关",
          "技术债",
          "发布",
        ],
        sourceKey: "spring-boot",
        level: "入门",
      },
    ],
  },
];
