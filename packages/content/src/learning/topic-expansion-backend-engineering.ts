/**
 * 后端工程 · 知识点扩容（试点，2026-10-15）。
 *
 * 这是"追加式知识点"的**样板**：每条 expansion = 1 个知识点 + 它的 ≥2 道配套题。
 * 内容口径（用户要求）：讲透、讲准、给细节；术语必须配"人话"解释；每章要有可复述的小结。
 */
import type { TopicExpansion } from "./topic-expansions";

export const backendEngineeringTopicExpansions: TopicExpansion[] = [
  {
    trackSlug: "backend-engineering",
    stageKey: "be-api-design",
    topic: {
      key: "be-http-method-idempotency",
      title: "HTTP 方法与幂等语义",
      summary:
        "GET/PUT/DELETE 天生幂等、POST 不是；幂等性是**协议语义**而不是实现细节，它决定了重试、网关重放、断线续传能不能安全发生。",
      concepts: ["幂等", "安全方法", "条件请求", "重试语义"],
      principles: [
        "「安全」方法不改变服务端状态（GET/HEAD/OPTIONS）；「幂等」方法重复执行结果与执行一次相同（GET/PUT/DELETE）。",
        "幂等 ≠ 无副作用：DELETE 第二次会返回 404，但**资源状态**与第一次之后一致，这不破坏幂等。",
        "POST 每次调用都可能创建新资源，因此客户端重试、网关超时重放都可能造成重复下单——必须靠幂等键补救。",
      ],
      applications: [
        "支付/下单接口把「可能重试的写操作」设计成 PUT + 客户端生成的幂等键，而不是裸 POST。",
        "网关与 SDK 的自动重试只对幂等方法默认开启，非幂等方法必须由业务显式同意重试。",
      ],
      pitfalls: [
        "把「接口能被调用两次不报错」当成幂等——真正的判据是**最终状态一致**，不是不报错。",
        "用 GET 做写操作（如 /delete?id=1），被浏览器预取或爬虫命中就会误删数据。",
      ],
      method: "先给每个接口标上「安全/幂等」两列，再决定哪些允许自动重试；写接口优先用幂等键 + 去重表落地。",
      exercise: "把「创建订单」重构成幂等接口：客户端生成 requestId，服务端用唯一索引去重，重复请求返回同一订单号。",
      checkpoint: "能说清 PUT 与 POST 的语义差别，并解释为什么网关重试对 POST 是危险的。",
      lesson: {
        overview: [
          "HTTP 把方法分成了两类性质：**安全（safe）** 与 **幂等（idempotent）**。理解这两列，直接决定你的接口能不能被安全地重试、缓存、并发调用。",
          "现实里超时是常态：客户端没收到响应并不代表服务端没执行。于是「要不要重试」成了每个写接口都要回答的问题，而答案就藏在方法的幂等语义里。",
        ],
        mechanism: [
          "安全方法（GET/HEAD）：只读，不改变服务端状态。缓存、预取、爬虫都可以放心调用。",
          "幂等方法（GET/PUT/DELETE）：执行 N 次与执行 1 次的**最终资源状态**相同。注意判据是状态，不是响应码——DELETE 第二次返回 404 依然幂等。",
          "POST：每次调用都语义上「创建一次」，因此不幂等。要让它可重试，必须引入业务级幂等键：客户端生成唯一 ID，服务端用唯一索引/去重表保证同一 ID 只生效一次。",
        ],
        example: {
          title: "用唯一索引把 POST 变成「可重试」",
          language: "sql",
          code: "CREATE TABLE orders (\n  id           bigserial PRIMARY KEY,\n  request_id   text NOT NULL,\n  user_id      uuid NOT NULL,\n  amount_cents int  NOT NULL,\n  created_at   timestamptz NOT NULL DEFAULT now()\n);\n\n-- 同一个 request_id 只允许落一单：重试会撞唯一索引而不是重复下单\nCREATE UNIQUE INDEX uq_orders_request ON orders(user_id, request_id);",
          explanation:
            "把「去重」交给数据库的唯一索引：并发的两个重复请求里，只有一个能插入成功，另一个捕获唯一冲突后返回已存在的订单。这比「先 SELECT 再 INSERT」可靠得多——后者在并发下会双写。",
        },
        practiceSteps: [
          "给手头每个写接口标注是否幂等，列出允许自动重试的清单。",
          "为不能天然幂等的写接口引入客户端幂等键。",
          "在数据库层用唯一索引兜住重复，而不是只在应用层查一遍。",
        ],
        masteryChecklist: [
          "能区分「安全」与「幂等」，并举出反例。",
          "能解释为什么 DELETE 第二次返回 404 仍算幂等。",
        ],
        summary: [
          "安全方法不改状态；幂等方法重复执行状态一致。",
          "判据是**最终状态**，不是响应码。",
          "POST 想可重试，就得有幂等键 + 数据库唯一约束兜底。",
        ],
        terms: [
          {
            term: "幂等（Idempotent）",
            plain: "同一个请求做十次，结果和做一次一样。",
            detail:
              "注意它约束的是**服务端最终状态**，不是返回值。所以「第二次返回 404」不违反幂等；反过来「每次都返回 200 但多建了一条数据」才是真的不幂等。",
          },
          {
            term: "安全方法（Safe Method）",
            plain: "只读、不改数据的方法，随便调都不会出事。",
            detail: "GET/HEAD/OPTIONS 属于安全方法。安全的都幂等，但幂等的不一定安全——DELETE 会改状态，却仍是幂等的。",
          },
          {
            term: "幂等键（Idempotency Key）",
            plain: "客户端给每次「意图」发的唯一编号，服务端凭它去重。",
            detail:
              "要点是编号由**客户端生成且跨重试不变**（通常放 header 或请求体）。用服务端时间戳之类每次都会变的字段做键，等于没有去重。",
          },
        ],
      },
    },
    questions: [
      {
        key: "be-sup-http-method-idempotency-s1",
        stageKey: "be-api-design",
        topicKey: "be-http-method-idempotency",
        type: "single",
        stem: "下面关于 HTTP 方法幂等性的说法，哪一项是正确的？",
        options: [
          { key: "A", text: "DELETE 第二次返回 404，说明它不是幂等方法" },
          { key: "B", text: "判据是服务端最终状态：DELETE 重复执行后资源状态与执行一次相同，因此仍是幂等的" },
          { key: "C", text: "POST 只要接口不抛异常就是幂等的" },
          { key: "D", text: "PUT 会创建资源，所以天生不幂等" },
        ],
        answer: ["B"],
        explanation:
          "幂等约束的是服务端**最终状态**，不是返回码。DELETE 第一次删掉资源、第二次发现资源不存在返回 404，但两次执行后资源状态相同，所以 DELETE 是幂等的。POST 每次语义上都会创建一次，不幂等；PUT 的目标是由客户端指定的完整替换，重复执行结果一致，因此幂等。",
        difficulty: "medium",
        tags: ["HTTP", "幂等", "接口设计"],
        sourceKey: "system-design-primer",
        level: "进阶",
      },
      {
        key: "be-sup-http-method-idempotency-j1",
        stageKey: "be-api-design",
        topicKey: "be-http-method-idempotency",
        type: "judge",
        stem: "把创建订单接口设计成可重试时，只在应用层「先查询是否已存在、再插入」就能避免重复下单。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "「先查后插」在并发下有竞态：两个重复请求可能同时查到「不存在」，然后各插一条。可靠做法是把去重下沉到数据库——对幂等键建唯一索引，让并发的第二个请求撞唯一约束失败，再捕获冲突返回已存在的记录。",
        difficulty: "hard",
        tags: ["幂等", "并发", "唯一索引"],
        sourceKey: "system-design-primer",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "backend-engineering",
    stageKey: "be-data-access",
    topic: {
      key: "be-btree-leftmost-prefix",
      title: "B+ 树索引与最左前缀",
      summary:
        "联合索引像电话簿按「姓+名」排序：跳过姓直接找名用不上索引。这就是最左前缀原则，也是「索引建了却没用上」的头号原因。",
      concepts: ["联合索引", "最左前缀", "回表", "覆盖索引"],
      principles: [
        "B+ 树把索引列按顺序拼成一个可比较的键，只有从最左列开始连续匹配，才能借用这棵树的定位能力。",
        "范围条件会「截断」后续列的可用性：WHERE a = 1 AND b > 2 AND c = 3 中，c 通常无法再用于定位。",
        "普通二级索引找到的是主键，还要再回主键索引取整行（回表）；若查询所需列都在索引里，就是覆盖索引，可以免回表。",
      ],
      applications: [
        "高频组合查询按「等值列在前、范围列在后」的顺序建联合索引。",
        "列表页只查少量字段时，把这几列放进索引做成覆盖索引，避免大量回表。",
      ],
      pitfalls: [
        "对列做函数或隐式类型转换（如 WHERE date(created_at) = '2026-01-01'、字符串列传数字）会让索引失效。",
        "把范围列放在联合索引最前面，等于让后面的等值列全部失去定位能力。",
      ],
      method: "先用 EXPLAIN 看真实执行计划，再按「等值→范围→排序」的顺序调整联合索引列序，最后用覆盖索引收尾。",
      exercise: "给「按用户查最近订单」写一条 SQL，建出能同时服务过滤与排序的联合索引，并用 EXPLAIN 验证 type=range 且没有额外排序。",
      checkpoint: "能解释为什么联合索引 (a,b,c) 用不上 WHERE b = 1，并给出可用的改写或索引方案。",
      lesson: {
        overview: [
          "索引不是「给列加个开关」，而是一棵**有序**的数据结构。既然有序，就必须回答一个问题：你要找的东西，在这套排序规则下的位置能不能被确定？",
          "联合索引的排序规则是「先按第一列排，第一列相同再按第二列排」。所以跳过第一列直接查第二列，就像在一本按姓氏排好的电话簿里只按名字找——只能全表翻。",
        ],
        mechanism: [
          "B+ 树的所有数据都在叶子层且按索引键有序，非叶子层只存路标。查询从根出发逐层比较，复杂度是对数级。",
          "联合索引 (a,b,c) 的键是 (a,b,c) 的字典序。WHERE a=? 能定位；WHERE a=? AND b=? 能进一步定位；WHERE a=? AND b>? 之后 c 无法再用于缩小范围（但可能用于索引内过滤或排序）。",
          "二级索引的叶子存的是主键值。要拿整行还得回主键索引查一次——这就是回表。如果 SELECT 的列都在索引里，引擎直接从索引返回，称为覆盖索引。",
        ],
        example: {
          title: "联合索引列序：等值在前、范围在后",
          language: "sql",
          code: "-- 典型列表查询：固定用户 + 时间范围 + 倒序取最新几条\nCREATE INDEX idx_orders_user_created\n  ON orders(user_id, created_at DESC);\n\nEXPLAIN ANALYZE\nSELECT id, amount_cents, created_at\nFROM orders\nWHERE user_id = '...' AND created_at >= now() - interval '30 days'\nORDER BY created_at DESC\nLIMIT 20;",
          explanation:
            "user_id 是等值条件放在最左，created_at 是范围+排序放在其后：这样既能用 user_id 定位，又能直接沿索引的有序方向取最新的 20 行，省掉额外排序。若把 created_at 放在最左，user_id 的等值过滤就用不上了。",
        },
        practiceSteps: [
          "用 EXPLAIN 找出全表扫描或 filesort 的慢查询。",
          "按「等值列 → 范围列 → 排序列」重排联合索引列序。",
          "把 SELECT 需要的列补进索引，尝试做成覆盖索引。",
        ],
        masteryChecklist: [
          "能解释最左前缀原则，并说明范围条件为什么截断后续列。",
          "能判断一条查询是否走了覆盖索引。",
        ],
        summary: [
          "联合索引按列序构成字典序键，必须从最左列连续匹配。",
          "范围条件之后的列通常失去定位能力。",
          "回表是二级索引的常态；覆盖索引能免掉它。",
        ],
        terms: [
          {
            term: "联合索引（Composite Index）",
            plain: "把好几列拼在一起建的一个索引。",
            detail: "拼接顺序决定了它能服务哪些查询：索引 (a,b) 能服务按 a、或按 a+b 的查询，但服务不了只按 b 的查询。",
          },
          {
            term: "最左前缀（Leftmost Prefix）",
            plain: "用联合索引时必须从最左边那列开始用，不能跳。",
            detail: "因为索引是按这个顺序排序的。跳过第一列，剩下的列在整棵树里是乱序的，没法二分定位。",
          },
          {
            term: "回表（Bookmark Lookup）",
            plain: "先在索引里找到位置，再回主表取这一行的其它列。",
            detail: "一次查询可能回表很多次，这是慢查询的常见来源。把要查的列都放进索引（覆盖索引）就能免掉。",
          },
          {
            term: "覆盖索引（Covering Index）",
            plain: "查询要的列全在索引里，不用回主表。",
            detail: "判断标准是查询涉及的所有列是否都被该索引包含。它能把「随机回表」变成「顺序读索引」，在高并发列表页上收益很明显。",
          },
        ],
      },
    },
    questions: [
      {
        key: "be-sup-btree-leftmost-prefix-s1",
        stageKey: "be-data-access",
        topicKey: "be-btree-leftmost-prefix",
        type: "single",
        stem: "表上有联合索引 (user_id, created_at, status)。下面哪条查询最可能用不上这个索引的定位能力？",
        options: [
          { key: "A", text: "WHERE user_id = ? AND created_at > ?" },
          { key: "B", text: "WHERE created_at > ?" },
          { key: "C", text: "WHERE user_id = ? AND status = ?" },
          { key: "D", text: "WHERE user_id = ? ORDER BY created_at DESC" },
        ],
        answer: ["B"],
        explanation:
          "联合索引按 (user_id, created_at, status) 字典序排列。B 只给了第二列 created_at 的范围条件，跳过了最左列 user_id，无法借用这棵树做定位（只能全索引扫描或全表扫描）。A、D 都从最左列等值匹配开始；C 用了最左列 user_id 定位（status 虽在范围上不连续，但仍可在索引内过滤）。",
        difficulty: "hard",
        tags: ["索引", "最左前缀", "SQL"],
        sourceKey: "system-design-primer",
        level: "综合",
      },
      {
        key: "be-sup-btree-leftmost-prefix-j1",
        stageKey: "be-data-access",
        topicKey: "be-btree-leftmost-prefix",
        type: "judge",
        stem: "给索引列加函数（例如 WHERE date(created_at) = '2026-01-01'）通常会让该索引无法用于定位。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "索引里存的是列的原值，比较的是「原值的有序性」。一旦对列施加函数（或发生隐式类型转换），引擎必须对每一行先算函数值再比较，无法利用索引的顺序定位，退化为逐行计算。改写为 created_at >= '2026-01-01' AND created_at < '2026-01-02' 即可重新用上索引（或建函数索引）。",
        difficulty: "medium",
        tags: ["索引失效", "SQL", "性能"],
        sourceKey: "system-design-primer",
        level: "进阶",
      },
    ],
  },
];
