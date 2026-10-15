/**
 * 数据库 · 知识点扩容（2026-10-15）。
 *
 * 沿用 topic-expansion-backend-engineering.ts 的追加式样板：每条 expansion = 1 个知识点 + 2 道配套题。
 * 内容口径：讲透、讲准、给细节；术语必须配白话解释；每章要有可复述的小结。
 */
import type { TopicExpansion } from "./topic-expansions";

export const databaseTopicExpansions: TopicExpansion[] = [
  {
    trackSlug: "database",
    stageKey: "db-relational",
    topic: {
      key: "db-null-three-valued",
      title: "NULL 与三值逻辑",
      summary:
        "NULL 表示未知而不是空；任何与 NULL 的比较都得到 UNKNOWN，WHERE 只保留 TRUE 的行。这是 NOT IN、外连接与统计口径出错的头号原因。",
      concepts: ["NULL 语义", "三值逻辑", "IS NULL 与 IS DISTINCT FROM", "聚合忽略 NULL"],
      principles: [
        "NULL 表示未知或不存在，不等于 0、也不等于空字符串；两个 NULL 之间既不相等也不不等。",
        "比较运算遇到 NULL 得到 UNKNOWN，WHERE 只保留结果为 TRUE 的行，UNKNOWN 会像 FALSE 一样被丢掉。",
        "多数聚合函数（COUNT(列)/SUM/AVG）会跳过 NULL，只有 COUNT(*) 计的是行数本身。",
        "NOT IN 的子查询里只要出现一个 NULL，整个条件就可能恒为 UNKNOWN，导致一行都查不出来。",
      ],
      applications: ["用外连接找没有匹配的行", "报表区分未知与零值两种口径", "过滤条件里安全地处理空值"],
      pitfalls: [
        "用 = NULL 或 <> NULL 判断空值，结果永远是 UNKNOWN。",
        "把 NULL 当 0 参与算术或比较，统计结果悄悄偏小。",
        "NOT IN 撞上含 NULL 的子查询，查询返回零行却不报错。",
      ],
      method: "先问清这个字段是未知还是零值，再用 IS NULL / COALESCE 明确表达；凡是可能为空的列，每个比较都要过一遍三值逻辑。",
      exercise: "造一张含 NULL 的订单表：分别用 = NULL 与 IS NULL 过滤，再写一条 NOT IN 子查询并观察 NULL 带来的差异。",
      checkpoint: "能解释为什么 NOT IN 在子查询含 NULL 时返回零行，并给出两种可用的改写。",
      lesson: {
        overview: [
          "很多初学者以为 NULL 就是空字符串或 0，其实它表示这个值未知或根本不存在。正因为数据库不知道它是什么，才不敢说它和别的值相等或不相等，于是判断结果出现了第三种：UNKNOWN。",
          "三值逻辑的后果很具体：WHERE 只放行 TRUE 的行，FALSE 与 UNKNOWN 都会被过滤掉。所以像 '找出所有不等于某值的用户' 这类查询会悄悄漏掉该字段为 NULL 的用户——它不报错，只是少数据。",
          "统计口径同样受影响：COUNT(*) 数行数，COUNT(列) 只数非空值，SUM 与 AVG 也跳过 NULL。同一个报表换一种写法可能得出不同数字，必须提前说清分母到底是谁。",
        ],
        mechanism: [
          "SQL 的真值集合是 TRUE、FALSE、UNKNOWN。任何与 NULL 的比较（=、<>、>、<）都返回 UNKNOWN，因为数据库无法判断一个未知值是否等于另一个值。",
          "WHERE、ON、HAVING 的过滤规则是只保留结果恰好为 TRUE 的行，因此 UNKNOWN 与 FALSE 一样被排除；而 NOT UNKNOWN 仍然是 UNKNOWN，这就是 NOT IN 行为反常的根源。",
          "外连接会为没有匹配的右表列补上 NULL，所以 LEFT JOIN 之后对右表列做的过滤写在 WHERE 里会把整行滤掉，写在 ON 里才能保留左表全部行。",
          "聚合函数一般忽略 NULL：COUNT(列) 只数非空值，SUM 与 AVG 跳过空值。只有 COUNT(*) 计的是行数，不受列是否为空影响。",
        ],
        example: {
          title: "NOT IN 遇到 NULL 会一行都查不出",
          language: "sql",
          code: "-- 若子查询结果里含一个 NULL，NOT IN 恒为 UNKNOWN，返回 0 行\nSELECT *\nFROM orders\nWHERE user_id NOT IN (SELECT id FROM some_users);\n\n-- 改写一：先排除 NULL 再比较\nSELECT *\nFROM orders\nWHERE user_id NOT IN (SELECT id FROM some_users WHERE id IS NOT NULL);\n\n-- 改写二：用 NOT EXISTS，不受 NULL 影响\nSELECT *\nFROM orders o\nWHERE NOT EXISTS (\n  SELECT 1 FROM some_users u WHERE u.id = o.user_id\n);",
          explanation:
            "NOT IN 会被展开成 '与子查询里每一个值都不相等' 的 AND 链。只要其中一个值是 NULL，其中一项就是 UNKNOWN，而 UNKNOWN AND TRUE 仍是 UNKNOWN，最终 WHERE 认为整行不成立，于是返回零行。改写一先把 NULL 从子查询里剔除；改写二用 NOT EXISTS 逐行判断是否存在匹配，它只有成立与不成立两种结果，不会整体变成 UNKNOWN，因此更稳。",
        },
        practiceSteps: [
          "列出表里哪些列允许为 NULL，把未知与零值当成两种业务含义分别确认。",
          "把所有等于与不等于的比较过一遍：可能为空的列一律用 IS NULL / IS NOT NULL 判断，不用 = NULL。",
          "把 NOT IN 子查询改写成 NOT EXISTS 或先过滤 NULL，再对比改写前后的返回行数。",
        ],
        masteryChecklist: [
          "能说出 WHERE 为什么把 UNKNOWN 也过滤掉。",
          "能解释 COUNT(*) 与 COUNT(列) 在同一张表上的差异。",
          "能用手算预测 NOT IN 含 NULL 时返回几行。",
        ],
        summary: [
          "NULL 表示未知，不是 0 也不是空字符串，两个 NULL 之间不相等。",
          "与 NULL 的比较得到 UNKNOWN；WHERE 只保留 TRUE，UNKNOWN 被丢掉。",
          "判断空值用 IS NULL / IS NOT NULL，永远不要写 = NULL。",
          "NOT IN 遇到含 NULL 的子查询会返回零行，用 NOT EXISTS 或先过滤 NULL 改写。",
          "COUNT(*) 数行，COUNT(列) 数非空值，统计前先说清分母。",
        ],
        terms: [
          {
            term: "三值逻辑（Three-Valued Logic）",
            plain: "判断结果除了对和错，还有第三种：不知道。",
            detail:
              "SQL 的比较碰到 NULL 时返回 UNKNOWN。WHERE 只放行 TRUE，所以不知道与错在过滤时效果一样，但取 NOT 之后它仍是 UNKNOWN，这正是 NOT IN 出错的根源。",
          },
          {
            term: "NULL",
            plain: "这格是空的，因为值未知或根本不存在。",
            detail:
              "它不代表 0、空字符串或 false。用 = 比较它会得到 UNKNOWN，必须用 IS NULL 判断。常见误解是把它当默认值，导致统计口径与数据含义混乱。",
          },
          {
            term: "COALESCE",
            plain: "取第一个不是空的参数，全都空就返回最后一个。",
            detail:
              "常用于给 NULL 兜底成默认值，例如 COALESCE(discount, 0)。注意它改变的是计算与展示结果，并不改变存储里的 NULL，做等值判断时仍要小心。",
          },
          {
            term: "NOT EXISTS",
            plain: "不存在这样的行，比 NOT IN 更安全。",
            detail:
              "它按相关子查询逐行判断是否存在匹配，NULL 不会让它整体变成 UNKNOWN，因此是替代 NOT IN 的常用写法。",
          },
        ],
      },
    },
    questions: [
      {
        key: "database-sup-db-null-three-valued-s1",
        stageKey: "db-relational",
        topicKey: "db-null-three-valued",
        type: "single",
        stem: "orders.user_id 允许为 NULL。执行 SELECT * FROM orders WHERE user_id NOT IN (SELECT id FROM users)，而 users.id 中含一行 NULL，结果最可能是什么？",
        options: [
          { key: "A", text: "只返回 user_id 为 NULL 的订单" },
          { key: "B", text: "返回 orders 的全部行" },
          { key: "C", text: "返回 0 行" },
          { key: "D", text: "报语法错误" },
        ],
        answer: ["C"],
        explanation:
          "NOT IN 被展开成 '与子查询每个值都不相等' 的 AND 链。只要其中一个值是 NULL，对应比较就是 UNKNOWN，而 UNKNOWN AND TRUE 仍是 UNKNOWN，WHERE 只保留 TRUE，于是所有行都被过滤掉，返回 0 行且不报错。正确做法是排除子查询里的 NULL（加 WHERE id IS NOT NULL）或改用 NOT EXISTS。",
        difficulty: "hard",
        tags: ["NULL", "三值逻辑", "NOT IN"],
        sourceKey: "postgresql",
        level: "综合",
      },
      {
        key: "database-sup-db-null-three-valued-j1",
        stageKey: "db-relational",
        topicKey: "db-null-three-valued",
        type: "judge",
        stem: "判断空值应该写 WHERE col = NULL，它与 WHERE col IS NULL 等价。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "= NULL 是与 NULL 做比较，结果永远是 UNKNOWN，因此 WHERE col = NULL 一行都查不出来。判断空值必须用 IS NULL / IS NOT NULL，它们是专门处理空值的谓词，只有它们能返回 TRUE 或 FALSE。",
        difficulty: "easy",
        tags: ["NULL", "IS NULL"],
        sourceKey: "cmu-bustub",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "database",
    stageKey: "db-relational",
    topic: {
      key: "db-numeric-precision",
      title: "数值类型与精度",
      summary:
        "整数、精确小数、近似浮点是三类不同的数。金额必须用精确的 numeric/decimal，用浮点存钱迟早会对不上账。",
      concepts: ["整数类型", "精确小数 numeric/decimal", "近似浮点 float/real", "隐式类型转换"],
      principles: [
        "二进制浮点无法精确表示 0.1 这类十进制小数，反复累加与比较会产生误差。",
        "numeric/decimal 按十进制保存精度与标度，例如 numeric(12,2)，适合金额、汇率等不能出错的场景。",
        "列类型与参数类型不一致会发生隐式转换，既可能损失精度，也可能让列上的索引失效。",
        "整数类型有取值范围，位宽与上限要按业务量级选择，选得太小会在增长后被迫迁移。",
      ],
      applications: ["金额与账单", "汇率与百分比", "自增主键与计数"],
      pitfalls: [
        "用 float/double 存金额，累加后差几分钱。",
        "用浮点做等值比较判断两个数是否相等。",
        "依赖隐式类型转换，既丢精度又让索引失效。",
      ],
      method: "按业务对精度的要求选类型：计数用整数，金额用 numeric(p,s)，只有明确接受误差的科学计算才用浮点。",
      exercise: "建一张账单表用 numeric(12,2) 保存金额并 SUM；再建一张 float 版对照表，对比两次求和结果。",
      checkpoint: "能说清 numeric(12,2) 两个数字的含义，并解释为什么金额不该用 float。",
      lesson: {
        overview: [
          "数据库里的数分三类：整数、精确小数、近似浮点。日常写代码不区分也能跑，但它们表示数字的方式完全不同，选错类型往往要到对账或比较时才暴露出来，而那时排查成本已经很高，还可能已经写坏了一批历史数据。",
          "浮点用二进制近似表示十进制小数，像 0.1 这样的常见数值根本无法被精确表示。单次运算误差极小，肉眼几乎看不出，但反复累加或做等值比较时误差就会显现，所以金额场景绝不能用它。",
          "精确小数用 numeric/decimal 按十进制存储，numeric(12,2) 表示总共 12 位有效数字、其中 2 位是小数，能精确到分。它比浮点稍慢、稍占空间，换来的是账目可以核对。",
        ],
        mechanism: [
          "浮点（float/real）遵循 IEEE 754，用符号、指数、尾数表示，尾数位数有限，因此像 0.1 这样十进制有限小数在二进制里是无限循环，只能存近似值。",
          "numeric/decimal 按十进制存储，声明时给出精度与标度，运算按十进制规则进位，因此 0.1 + 0.2 可以精确等于 0.3。",
          "当比较或连接两侧类型不一致时，数据库会做隐式类型转换。转换方向由类型优先级决定，可能把字符串转成数字，也可能把数字转成浮点：前者常让索引失效，后者引入精度损失。",
          "整数类型有不同的位宽与范围，超出范围会报错而不是静默截断，但选得过小会在业务增长后被迫做一次数据迁移。",
        ],
        example: {
          title: "金额用 numeric，别用 float",
          language: "sql",
          code: "-- 正确：精确到分\nCREATE TABLE invoices (\n  id       bigserial PRIMARY KEY,\n  amount   numeric(12, 2) NOT NULL,\n  currency char(3) NOT NULL\n);\n\nINSERT INTO invoices (amount, currency) VALUES\n  (0.10, 'CNY'),\n  (0.20, 'CNY');\n\nSELECT SUM(amount) AS total FROM invoices;  -- 0.30，精确\n\n-- 对照：近似的浮点类型\nCREATE TABLE bad_invoices (amount double precision);\nINSERT INTO bad_invoices VALUES (0.1), (0.2);\nSELECT SUM(amount) FROM bad_invoices;        -- 0.30000000000000004",
          explanation:
            "numeric(12,2) 明确声明了总共 12 位、小数 2 位，数据库按十进制存，SUM 得到精确的 0.30。double precision 用二进制近似，0.1 和 0.2 存进去时就已经不准，求和后露出 0.30000000000000004 的尾巴。单笔看不出问题，成千上万笔累加后账目就对不平了。",
        },
        practiceSteps: [
          "把现有表里涉及金额、汇率、比例的列找出来，确认它们是不是精确类型。",
          "按业务精度声明 numeric(p, s)，并想清楚 p、s 各自代表什么、最大能存多少。",
          "对可能发生隐式转换的比较与连接显式写成同类型，再用执行计划确认索引仍被使用。",
        ],
        masteryChecklist: [
          "能说出 numeric(12,2) 的精度与标度各是多少。",
          "能解释为什么浮点做等值比较不可靠。",
          "能判断一条 SQL 是否发生了隐式类型转换。",
        ],
        summary: [
          "整数用于计数与标识，精确小数用于金额，浮点只用于允许误差的计算。",
          "二进制浮点表示不了 0.1，累加会累积误差。",
          "numeric(p,s) 中 p 是总位数、s 是小数位数，金额用它能精确到分。",
          "类型不一致会触发隐式转换，可能丢精度，也可能让索引失效。",
        ],
        terms: [
          {
            term: "精确小数（Numeric / Decimal）",
            plain: "按十进制存的小数，算钱不会差一分。",
            detail:
              "声明成 numeric(12,2) 表示最多 12 位数字、其中 2 位小数。它比浮点稍慢、稍占空间，但运算结果精确，是金额字段的标准选择。",
          },
          {
            term: "浮点（Float / Double）",
            plain: "用二进制近似表示的实数，快但会有一丁点误差。",
            detail:
              "遵循 IEEE 754，像 0.1 这种十进制小数在二进制里是无限循环，只能存近似值。适合科学计算与统计，不适合金额，也不要用 = 比较两个浮点数。",
          },
          {
            term: "精度与标度（Precision & Scale）",
            plain: "这个数一共几位、小数点后几位。",
            detail:
              "numeric(12,2) 的精度是 12、标度是 2。标度决定能精确到哪一位，超出部分会按规则舍入，所以要先想清楚业务最小单位再定标度。",
          },
          {
            term: "隐式类型转换（Implicit Cast）",
            plain: "两边类型不一样时，数据库自动帮你转一下。",
            detail:
              "转换可能改变数值精度，也可能让列上的索引失效，因为比较的是转换后的值而不是列的原值。把参数显式写成与列相同的类型，既安全又利于优化。",
          },
        ],
      },
    },
    questions: [
      {
        key: "database-sup-db-numeric-precision-s1",
        stageKey: "db-relational",
        topicKey: "db-numeric-precision",
        type: "single",
        stem: "要存人民币金额并精确到分，下面哪种列类型最合适？",
        options: [
          { key: "A", text: "double precision" },
          { key: "B", text: "numeric(12, 2)" },
          { key: "C", text: "real" },
          { key: "D", text: "text" },
        ],
        answer: ["B"],
        explanation:
          "金额不能带误差，必须用精确的十进制类型。numeric(12,2) 表示共 12 位数字、其中 2 位小数，刚好精确到分。double precision 与 real 都是二进制浮点，无法精确表示 0.1 这样的十进制小数，累加后会偏差；text 则无法参与数值运算与正确的排序比较。",
        difficulty: "medium",
        tags: ["数值类型", "精度", "金额"],
        sourceKey: "postgresql",
        level: "进阶",
      },
      {
        key: "database-sup-db-numeric-precision-j1",
        stageKey: "db-relational",
        topicKey: "db-numeric-precision",
        type: "judge",
        stem: "用浮点类型把 0.1 与 0.2 相加，结果一定精确等于 0.3。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "二进制浮点无法精确表示 0.1 和 0.2，它们存进去时就已经是近似值，相加得到的是近似 0.3，例如 0.30000000000000004。要得到精确结果必须使用 numeric/decimal 这类十进制精确类型；用 = 判断两个浮点数是否相等同样不可靠。",
        difficulty: "easy",
        tags: ["浮点", "精度"],
        sourceKey: "sqlite",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "database",
    stageKey: "db-index",
    topic: {
      key: "db-join-algorithms",
      title: "连接算法与代价选择",
      summary:
        "嵌套循环、哈希连接、归并连接是三种连接算法；用哪一种由数据量、索引和排序决定，而不是由 SQL 写法决定。",
      concepts: ["嵌套循环连接", "哈希连接", "归并连接", "驱动表与代价估算"],
      principles: [
        "嵌套循环连接用外层每一行去内层查找，内层有可用索引时非常高效，适合小结果集驱动大表。",
        "哈希连接先为较小的一侧建哈希表再扫描另一侧，适合没有索引的大表等值连接，但不支持非等值条件。",
        "归并连接要求两侧在连接键上有序，各自扫一遍即可合并，常在已有排序或索引可用时出现。",
        "优化器按统计信息估算每种方案的代价，最终选哪一种取决于估算结果，而不是语法规定。",
      ],
      applications: ["大表报表关联", "读执行计划判断连接瓶颈", "决定是否为外键列建索引"],
      pitfalls: [
        "以为 JOIN 一定比子查询快，其实真正的变量是算法与数据量。",
        "连接键缺索引，导致大表被反复全表扫描。",
        "连接条件写错或漏写，产生笛卡尔积把结果放大。",
      ],
      method: "先在计划里看清用的是哪种连接算法与两侧的估算行数，再决定补索引、改写法，还是先把中间结果变小。",
      exercise: "对同一条两表连接查询，分别在连接键有索引与无索引时看执行计划，记录连接算法与代价的变化。",
      checkpoint: "能指认执行计划里用的连接算法，并说明它为什么适合或不适合当前数据量。",
      lesson: {
        overview: [
          "同一条 JOIN 语句，数据库可以有好几种执行方式。你写的是要什么，执行计划决定的是怎么拿，两种写法语义相同、跑起来可能相差几十倍，理解这三种算法才能在计划里看懂数据库的取舍。",
          "嵌套循环最直观：外层每取一行，就去内层找匹配。内层连接键上有索引时每次查找都很快；一旦没有索引，内层就要被完整扫描很多遍，总代价随两边行数相乘增长，很快就会慢到不可接受。",
          "哈希连接与归并连接是为大表准备的：前者先为较小一侧建哈希表，把查找变成一次定位；后者利用两侧已经有序，只需各扫一遍。它们在计划里出现，通常意味着优化器判断索引帮不上忙。",
        ],
        mechanism: [
          "嵌套循环连接（Nested Loop）对外层每一行按连接条件在内层查找匹配。代价约等于外层行数乘以内层每次查找的成本：内层走索引时是对数级，没有索引就是内层全表行数。",
          "哈希连接（Hash Join）选择较小的一侧，把连接键建成内存哈希表，再扫描另一侧逐行探测。每行只需一次哈希定位，适合大表等值连接，但只能处理等值条件；哈希表放不下时会落盘分片。",
          "归并连接（Merge Join）先保证两侧都按连接键有序，然后像拉链一样同步前进，各扫一遍即可，代价与总行数大致线性相关。",
          "优化器依据统计信息估算各方案的行数与代价，选出最低的一个。因此数据量增长、索引增删或统计信息更新后，同一句 SQL 可能换用另一种算法，性能随之改变。",
        ],
        example: {
          title: "用 EXPLAIN 观察连接算法",
          language: "sql",
          code: "-- 小表驱动大表：orders.user_id 上有索引时常走 Nested Loop\nEXPLAIN (ANALYZE, BUFFERS)\nSELECT u.id, o.amount_cents\nFROM users u\nJOIN orders o ON o.user_id = u.id\nWHERE u.id = 42;\n\n-- 大表之间无过滤条件：更可能走 Hash Join\nEXPLAIN (ANALYZE, BUFFERS)\nSELECT u.country, count(*)\nFROM users u\nJOIN orders o ON o.user_id = u.id\nGROUP BY u.country;",
          explanation:
            "第一条只取一个用户：外层 1 行，内层按 user_id 索引取匹配行，嵌套循环是自然选择。第二条要连接全表并分组，若还按单行去内层反复查找，次数会接近两表行数的乘积，于是优化器先为较小一侧建哈希表再顺序探测更划算。两条 SQL 写法类似却选了不同算法，说明决定因素不是 JOIN 的书写形式，而是数据量与索引。",
        },
        practiceSteps: [
          "对慢连接查询输出执行计划，找出实际使用的连接算法与两侧的估算、实际行数。",
          "检查连接键上是否有可用索引；没有索引的等值连接常会退化为哈希连接或全表扫描。",
          "先过滤再连接，把能提前缩小的结果集放在驱动侧，减少进入连接的行数。",
          "改完再看一次计划，确认算法与行数确实变了，而不是只凭感觉。",
        ],
        masteryChecklist: [
          "能说出三种连接算法各自适合的数据形态。",
          "能在计划里认出连接算法，并解释优化器为什么选它。",
          "能判断连接键缺索引时连接会退化成什么。",
        ],
        summary: [
          "嵌套循环适合小结果集驱动大表，内层有索引才划算。",
          "哈希连接适合大表等值连接，不支持非等值条件。",
          "归并连接要求两侧有序，各扫一遍即可合并。",
          "选哪种算法由优化器按统计信息估算代价决定，不是 SQL 写法决定的。",
        ],
        terms: [
          {
            term: "嵌套循环连接（Nested Loop Join）",
            plain: "外层每取一行，就去内层找一遍匹配。",
            detail:
              "内层连接键有索引时每次查找很快，非常适合外层很小、内层很大的场景；没有索引时内层会被反复全扫，代价急剧上升。",
          },
          {
            term: "哈希连接（Hash Join）",
            plain: "把小的一侧做成一张快速查询的哈希表，再扫另一侧逐个对号。",
            detail:
              "只适用于等值连接。它把查找变成近似一次定位，是大表无索引关联的主力算法；哈希表超出内存时会落盘，性能明显下降。",
          },
          {
            term: "归并连接（Merge Join）",
            plain: "两边都排好序，然后像拉链一样对齐着走一遍。",
            detail:
              "前提是两侧在连接键上有序，由索引或显式排序提供。数据已经有序时它很便宜；若为了它额外排序，排序成本也要算进总代价。",
          },
          {
            term: "驱动表（Driving Table）",
            plain: "连接时先被扫描、用来逐行去另一张表找匹配的那张表。",
            detail:
              "驱动表通常是被过滤后更小的一侧。把它选小能显著减少内层查找次数，这正是先过滤再连接之所以有效的原理。",
          },
        ],
      },
    },
    questions: [
      {
        key: "database-sup-db-join-algorithms-s1",
        stageKey: "db-index",
        topicKey: "db-join-algorithms",
        type: "single",
        stem: "关于连接算法，下面哪项说法是正确的？",
        options: [
          { key: "A", text: "哈希连接既能处理等值连接，也能处理非等值连接" },
          { key: "B", text: "嵌套循环连接在内层连接键有索引时通常很高效" },
          { key: "C", text: "归并连接不要求两侧在连接键上有序" },
          { key: "D", text: "用哪种连接算法由 SQL 里写的 JOIN 关键字决定" },
        ],
        answer: ["B"],
        explanation:
          "嵌套循环是外层逐行到内层查找，内层走索引时每次查找只需对数级定位，因此小结果集驱动大表非常高效。哈希连接依赖对连接键做哈希，只支持等值条件；归并连接要求两侧在连接键上有序；选哪种算法由优化器按统计信息估算代价决定，与写的是 JOIN 还是逗号连接无关。",
        difficulty: "medium",
        tags: ["连接算法", "执行计划"],
        sourceKey: "postgresql",
        level: "进阶",
      },
      {
        key: "database-sup-db-join-algorithms-j1",
        stageKey: "db-index",
        topicKey: "db-join-algorithms",
        type: "judge",
        stem: "同一个连接查询，在数据量或统计信息变化后，执行计划可能改用另一种连接算法。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "优化器依据统计信息估算各方案的行数与代价，并选择估算代价最低者。数据增长、索引增删或统计信息更新都会改变估算结果，从而切换连接算法，查询性能也随之变化。所以要基于真实执行计划做判断，而不是背下某句 SQL 应该走哪种连接。",
        difficulty: "medium",
        tags: ["优化器", "统计信息", "连接算法"],
        sourceKey: "cmu-bustub",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "database",
    stageKey: "db-transaction",
    topic: {
      key: "db-optimistic-locking",
      title: "乐观锁与版本号",
      summary:
        "乐观锁读时不加锁，写入时用版本号有没有变来检测冲突；它靠影响行数判断成功，适合冲突不激烈的场景。",
      concepts: ["丢失更新", "版本号与时间戳", "条件更新与影响行数", "悲观锁"],
      principles: [
        "乐观锁假设冲突很少发生，读时不加锁，提交时用 WHERE version = 旧值 检测期间是否被改过。",
        "判断冲突的依据是 UPDATE 的影响行数：返回 0 表示版本已变，本次更新失败，需要重新读取再决定。",
        "悲观锁（如 SELECT ... FOR UPDATE）在读时就锁住行，适合冲突频繁或必须串行化的场景。",
        "乐观锁的失败路径必须配重试与提示策略，否则冲突一多就会大量失败。",
      ],
      applications: ["表单编辑覆盖保护", "库存与余额扣减", "并发状态流转"],
      pitfalls: [
        "执行 UPDATE 后不检查影响行数，冲突被静默忽略。",
        "冲突频繁的场景硬用乐观锁，造成重试风暴。",
        "在事务外读取版本号后再更新，把冲突窗口放大。",
      ],
      method: "先判断冲突概率与业务能否容忍失败：冲突少用版本号加条件更新并检查影响行数，冲突多或要求强一致就用悲观锁或串行化。",
      exercise: "给商品表加 version 列，用条件更新实现扣库存，并在两个会话里并发执行，观察其中一个返回 0 行。",
      checkpoint: "能写出带版本号的 UPDATE，并说明影响行数为 0 时程序应该做什么。",
      lesson: {
        overview: [
          "两个人同时编辑同一条记录，各自读到旧数据后各自保存，后保存的会把前一个人的修改直接盖掉，这叫丢失更新。乐观锁就是用来发现并阻止这种覆盖，而不是指望用户自己小心。",
          "它的思路很朴素：读的时候什么都不管，写的时候问一句 '我读到的版本还是最新的吗'。是就写，不是就报冲突，让调用方重新读取、合并、再提交，而不是把旧值硬盖上去，从而把冲突挡在写入那一刻。",
          "因为读不加锁，乐观锁在冲突少的场景几乎不付出额外成本，也不会阻塞别人；代价是把并发控制的一部分责任交给应用层，必须检查更新结果，必须处理失败重试，并在重试前重新读取最新数据。",
        ],
        mechanism: [
          "表上加一个 version 整数列。读取时连同 version 一起取出；更新时写 UPDATE ... SET ..., version = version + 1 WHERE id = ? AND version = 之前读到的值。",
          "若期间没人改过，WHERE 命中，影响 1 行，更新成功且版本前进。若别人已经改过，version 不再等于旧值，WHERE 不命中，影响 0 行，这就是冲突信号。",
          "冲突判断完全落在数据库的一次原子更新里，不需要应用层先查再比，因此不存在检查与写入之间的竞态窗口。",
          "悲观锁则相反：SELECT ... FOR UPDATE 在读时就持有行锁，其他事务写同一行会等待。它避免重试，但持锁期间占资源，事务越长影响越大。",
        ],
        example: {
          title: "用版本号做条件更新",
          language: "sql",
          code: "-- 1) 读取当前值与版本\nSELECT id, stock, version FROM products WHERE id = 7;\n-- 假设读到 stock = 10, version = 3\n\n-- 2) 带版本条件扣减：只有版本仍为 3 才生效\nUPDATE products\nSET stock = stock - 1,\n    version = version + 1\nWHERE id = 7\n  AND version = 3\n  AND stock >= 1;\n\n-- 3) 检查影响行数：1 = 成功；0 = 冲突或库存不足，需要重新读取",
          explanation:
            "把版本没变这个条件写进 WHERE 后，检查与写入成为同一条原子语句，数据库内部保证不会出现检查通过后又被别人改掉的窗口。stock >= 1 顺带做了库存下限保护。应用层必须接收影响行数：返回 1 才算成功，返回 0 就要重新读取最新数据，再决定是重试还是提示用户。",
        },
        practiceSteps: [
          "找出存在读改写并发覆盖风险的表，为它们加上 version 或 updated_at 列。",
          "把所有更新改写成带版本条件的语句，并在代码里强制检查影响行数。",
          "为失败设计处理路径：有限次重试并加退避，超过次数就提示用户重新操作。",
          "若实测冲突频繁、重试代价高，评估改用 SELECT ... FOR UPDATE 的悲观方案。",
        ],
        masteryChecklist: [
          "能解释丢失更新是怎么发生的，以及版本号为什么能挡住它。",
          "能写出带版本条件的 UPDATE，并说明返回 0 行意味着什么。",
          "能比较乐观锁与悲观锁的适用场景。",
        ],
        summary: [
          "乐观锁读不加锁，写入时用版本条件检测冲突。",
          "冲突信号是影响行数返回 0，必须检查，不能忽略。",
          "条件更新把检查与写入合成一条原子语句，消除了竞态窗口。",
          "冲突少用乐观锁，冲突多或需强一致用悲观锁。",
          "失败必须有重试与提示策略，否则高冲突下不可用。",
        ],
        terms: [
          {
            term: "乐观锁（Optimistic Locking）",
            plain: "先假设没人跟我抢，写的时候再确认数据没被改过。",
            detail:
              "它不是数据库的锁，而是一种应用层约定：用版本号或时间戳做条件更新。冲突少时开销近乎零；冲突多时会频繁失败重试，那时该换成悲观锁。",
          },
          {
            term: "丢失更新（Lost Update）",
            plain: "两个人的修改互相覆盖，只剩后一个人的。",
            detail:
              "典型过程是两人都读到同一条旧数据，先后保存，后保存者覆盖前者。加版本条件后，后提交者的更新会命中 0 行而失败，覆盖被阻止。",
          },
          {
            term: "悲观锁（Pessimistic Locking）",
            plain: "读的时候就把这行锁住，不让别人改。",
            detail:
              "例如 SELECT ... FOR UPDATE。它不会失败重试，但持锁期间其他事务要等待，长事务会放大阻塞，所以事务要尽量短。",
          },
          {
            term: "影响行数（Affected Rows）",
            plain: "这条语句实际改到了几行。",
            detail:
              "在乐观锁里它是冲突判据：1 表示版本匹配、更新成功，0 表示版本已变或条件不满足。代码必须读取并分支处理，忽略它等于没有乐观锁。",
          },
        ],
      },
    },
    questions: [
      {
        key: "database-sup-db-optimistic-locking-s1",
        stageKey: "db-transaction",
        topicKey: "db-optimistic-locking",
        type: "single",
        stem: "用版本号实现乐观锁时，UPDATE 返回的影响行数为 0，说明什么？",
        options: [
          { key: "A", text: "SQL 语法有误" },
          { key: "B", text: "目标行的版本已被别的事务改过或条件不满足，本次更新没有生效" },
          { key: "C", text: "数据库连接已经断开" },
          { key: "D", text: "更新成功但尚未提交" },
        ],
        answer: ["B"],
        explanation:
          "带版本的 UPDATE 把 version = 旧值 写在 WHERE 里。若期间有别人更新过，version 已经前进，条件不命中，影响行数为 0，代表本次更新没有生效。此时应用层应重新读取最新数据，评估后决定重试还是提示用户，绝不能把它当成成功继续往下走。",
        difficulty: "medium",
        tags: ["乐观锁", "影响行数", "并发"],
        sourceKey: "postgresql",
        level: "进阶",
      },
      {
        key: "database-sup-db-optimistic-locking-j1",
        stageKey: "db-transaction",
        topicKey: "db-optimistic-locking",
        type: "judge",
        stem: "乐观锁在读数据时就需要对行加排他锁，否则无法防止丢失更新。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "乐观锁的特点恰恰是读时不加锁，它在 UPDATE 里用版本条件原子地检测冲突，因此不需要读锁。如果读时就加排他锁，例如 SELECT ... FOR UPDATE，那是悲观锁的思路。两种方案都能防丢失更新，区别在于把冲突成本花在读取还是写入阶段。",
        difficulty: "medium",
        tags: ["乐观锁", "悲观锁"],
        sourceKey: "cmu-bustub",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "database",
    stageKey: "db-transaction",
    topic: {
      key: "db-wal-durability",
      title: "预写日志与崩溃恢复",
      summary:
        "数据库先把改动写进日志，再改数据页；提交时把日志刷盘，崩溃后靠日志重放。这就是 WAL 与持久性的由来。",
      concepts: ["预写日志 WAL", "顺序写与随机写", "刷盘 fsync 与提交", "崩溃恢复重放"],
      principles: [
        "WAL 规则是先写日志、再写数据页：任何数据页的修改，对应日志必须先持久化。",
        "日志是顺序追加写，比随机写数据页便宜得多，因此 WAL 把随机写转成顺序写。",
        "事务提交时需要把日志刷到持久存储才算持久；关闭同步提交会更快，但崩溃可能丢掉已提交的事务。",
        "崩溃恢复从最近的检查点开始重放日志：已提交的事务重做，未提交的事务不会保留。",
      ],
      applications: ["崩溃后重启的自动恢复", "主从复制的日志传输", "在吞吐与持久性之间取舍"],
      pitfalls: [
        "以为提交返回成功在任何配置下都等于已经落盘。",
        "把 WAL 当作业务操作日志去查询。",
        "为压测性能关掉同步提交，却忘记评估丢数据的风险。",
      ],
      method: "先明确业务能接受多大的数据丢失，再决定同步提交相关配置；把提交成功的含义写进设计说明，而不是默认它等于落盘。",
      exercise: "在测试库对比同步提交开关两种配置下批量写入的耗时，并说明它们在断电场景下的差异。",
      checkpoint: "能讲清一次提交从写日志到落盘的顺序，并说明崩溃后数据库如何恢复到一致状态。",
      lesson: {
        overview: [
          "数据库要保证提交了就不能丢，但直接把改动写到数据文件很慢，因为数据页散落在磁盘各处，属于随机写。WAL 的思路是先把改动按顺序追加到一份日志里，再慢慢把数据页刷回去。",
          "为什么先写日志就安全？因为只要日志落了盘，即使数据页还没更新就断电，重启后也能照着日志把改动重新做一遍。日志是恢复的唯一依据，所以它必须先于数据页持久化，顺序不能颠倒。",
          "这条规则也解释了提交为什么可能变慢：为确保持久，提交时要等日志真正刷到存储设备才返回。把同步提交关掉能大幅提速，但要接受崩溃时可能丢掉最近若干已提交事务的代价。",
        ],
        mechanism: [
          "WAL 的核心规则是 write-ahead：数据页的任何修改，对应日志记录必须先落到持久存储。这样无论在哪一刻崩溃，日志里至少包含所有可能已经生效的改动。",
          "日志按顺序追加，磁盘顺序写的吞吐远高于随机写；事务提交只需等日志刷盘一次，而不是等所有被改的数据页都写回，数据页由后台进程择机刷。",
          "提交时的 fsync 把日志缓冲区真正写到设备。若关闭同步提交，提交只写到操作系统缓存就返回：进程崩溃通常不丢，但整机断电可能丢。",
          "崩溃恢复从最近的检查点开始重放日志：已提交事务的改动被重做，未提交事务的改动被回滚，最终把数据库带回一致状态。",
        ],
        example: {
          title: "提交的顺序：先日志，后数据页",
          language: "sql",
          code: "-- 一次转账：两行更新属于同一个事务\nBEGIN;\nUPDATE accounts SET balance = balance - 100 WHERE id = 1;\nUPDATE accounts SET balance = balance + 100 WHERE id = 2;\nCOMMIT;  -- 日志刷盘成功，事务才算真正持久\n\n-- 查看当前持久性相关配置（PostgreSQL）\nSHOW synchronous_commit;  -- on：提交等待日志刷盘；off：提交不等刷盘\n\n-- 崩溃后重启会自动重放 WAL，无需手工干预。",
          explanation:
            "COMMIT 返回成功的前提是这份事务的日志已经按顺序写入并刷盘；数据页可以晚一些再写回，因为重启后能靠日志重放补齐。synchronous_commit 设为 off 时提交不等刷盘，吞吐更高，但整机断电可能丢掉最近已提交的事务。这是用持久性换性能的显式取舍，必须结合业务能容忍的丢失窗口来决定。",
        },
        practiceSteps: [
          "写下业务能接受的数据丢失窗口，例如能否接受丢失最近几秒已提交的数据。",
          "据此检查数据库的持久性配置，而不是照搬默认值或压测最优值。",
          "在测试环境做一次写入后立即强杀进程再重启的演练，确认已提交数据仍在。",
          "把结论写进设计说明：哪些写入是持久承诺，哪些不是。",
        ],
        masteryChecklist: [
          "能复述 WAL 的先写日志、再写数据页规则。",
          "能解释提交为什么要等日志刷盘，以及关闭同步提交的代价。",
          "能说明崩溃恢复大致做了什么。",
        ],
        summary: [
          "WAL 规则：先写日志，再改数据页。",
          "日志顺序追加，把随机写变成顺序写，兼顾性能与可靠。",
          "提交是否需要 fsync 决定提交成功是否等于已落盘。",
          "崩溃后从检查点重放日志，把数据库恢复到一致状态。",
          "关闭同步提交更快，代价是断电可能丢最近已提交的事务。",
        ],
        terms: [
          {
            term: "预写日志（WAL, Write-Ahead Log）",
            plain: "先把要做的改动记在本子上，再动真正的数据。",
            detail:
              "规则是日志先于数据页落盘。这样崩溃后能照日志把没写完的改动补上，它是持久性与崩溃恢复的基础机制，也是很多数据库复制功能的载体。",
          },
          {
            term: "顺序写与随机写（Sequential vs Random I/O）",
            plain: "挨着往后写很快，到处跳着写很慢。",
            detail:
              "磁盘和固态硬盘都更擅长顺序访问。WAL 把分散的随机更新聚合成一条顺序追加的日志流，这是它比直接改数据页快得多的根本原因。",
          },
          {
            term: "刷盘（fsync）",
            plain: "把数据真正写到硬盘上，而不是停在内存缓存里。",
            detail:
              "写进操作系统缓存不等于落盘，断电就没了。fsync 是确认持久的动作，提交等待它才安全，但每次提交都要付出一次磁盘往返成本。",
          },
          {
            term: "崩溃恢复（Crash Recovery）",
            plain: "断电重启后，数据库照着日志把自己修回一致状态。",
            detail:
              "恢复从最近的检查点开始重放日志：已提交的事务重做，未提交的事务回滚。它是自动的，但恢复时长与崩溃前的写入量、检查点频率有关。",
          },
        ],
      },
    },
    questions: [
      {
        key: "database-sup-db-wal-durability-s1",
        stageKey: "db-transaction",
        topicKey: "db-wal-durability",
        type: "single",
        stem: "预写日志（WAL）要求的基本顺序是什么？",
        options: [
          { key: "A", text: "先修改数据页，再写日志" },
          { key: "B", text: "先把日志写到持久存储，数据页可以稍后再刷" },
          { key: "C", text: "日志与数据页必须同时写入" },
          { key: "D", text: "只在崩溃发生时才写日志" },
        ],
        answer: ["B"],
        explanation:
          "WAL 的规则是 write-ahead：数据页的修改，其日志必须先持久化。数据页可以延后由后台刷盘，因为崩溃后能靠日志重放补齐。若先改数据页再写日志，就会出现数据已改但无日志可恢复的窗口，持久性被破坏。",
        difficulty: "medium",
        tags: ["WAL", "持久性", "崩溃恢复"],
        sourceKey: "postgresql",
        level: "进阶",
      },
      {
        key: "database-sup-db-wal-durability-j1",
        stageKey: "db-transaction",
        topicKey: "db-wal-durability",
        type: "judge",
        stem: "把同步提交设为 off 后，提交返回成功，即使整机断电也一定不会丢失该事务。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "关闭同步提交后，提交只写到操作系统缓存就返回，不再等待日志 fsync 到存储设备。进程崩溃通常不丢，但整机断电会让尚未落盘的日志一起消失，从而丢掉最近已提交的事务。它用持久性换吞吐，必须按业务能容忍的丢失窗口来决定是否使用。",
        difficulty: "hard",
        tags: ["同步提交", "fsync", "持久性"],
        sourceKey: "cmu-bustub",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "database",
    stageKey: "db-modeling-ops",
    topic: {
      key: "db-connection-pool",
      title: "连接池与连接数管理",
      summary:
        "建立数据库连接很贵，应用靠连接池复用；池的大小要与数据库承受能力匹配，连接泄漏和长事务会把池耗光。",
      concepts: ["连接建立成本", "连接池与复用", "连接泄漏", "排队与超时"],
      principles: [
        "每个数据库连接在服务端都占用内存与进程资源，连接数上限是硬约束。",
        "连接池复用的价值是避开反复握手与认证的开销，而不是让并发无限增长。",
        "池上限应结合数据库上限与每个请求的持有时长来定；池大于数据库上限只会把等待变成报错。",
        "借出的连接必须在 finally 一类的位置归还，泄漏会让池逐步耗尽，表现为请求排队直到超时。",
      ],
      applications: ["Web 服务复用连接", "批处理任务控制并发", "排查连接数告警"],
      pitfalls: [
        "把池上限设得比数据库连接上限还大。",
        "异常路径忘记归还连接，造成连接泄漏。",
        "在借出的连接上等待外部接口，长时间占用连接。",
      ],
      method: "先算清数据库能接受多少连接、单个请求平均占用多久，再设池大小与等待超时；把归还连接写进统一封装，避免散落各处。",
      exercise: "为一个小型 Web 服务配置连接池：设定最大连接数与等待超时，写一个归还连接的封装，并用压测观察排队现象。",
      checkpoint: "能说明池大小、数据库上限与请求持有时长三者之间的关系，并给出一个不超配的取值。",
      lesson: {
        overview: [
          "每次打开数据库连接都要经历网络握手与身份认证，服务端还要为它分配内存等资源。请求量一大，反复建连的开销会超过查询本身，连接池就是为省下这笔开销、同时把并发连接数量控制在可控范围内而生的。",
          "池的思路是借出与归还：启动时先建好一批连接，请求来了从池里借一个，用完再还回去。这样既省下建连成本，也能用池的大小把并发限制在数据库能承受的范围内，因此服务端框架几乎都会内置连接池。",
          "难点不在建池，而在配多大、会不会漏。池太小请求排队，池太大数据库被压垮；借了不还的连接会慢慢把池吃光，最终表现为看似随机、实则必然的请求超时，所以池的配置与泄漏排查同样重要。",
        ],
        mechanism: [
          "数据库的连接数有硬上限。每个连接在服务端对应一个进程或线程并占用内存，连接数越高，上下文切换与内存压力越大，整体吞吐反而可能下降。",
          "连接池维护一批已建立的连接，请求从池中借出、用完归还，避免每次请求都做 TCP 握手与认证，同时限制了并发使用连接的数量。",
          "当池内连接都被借出，新请求进入等待队列；若等待超过配置的超时，请求直接失败。这是保护机制，避免请求无限堆积拖垮服务。",
          "连接泄漏指借出后没有归还，常见原因是异常路径没有归还，或把连接层层传递而遗漏释放。泄漏是累积的：每漏一个，可用连接就少一个，直到池空。",
        ],
        example: {
          title: "统一的借还封装，避免连接泄漏",
          language: "typescript",
          code: "import { Pool } from 'pg';\n\n// max 不超过数据库能承受的连接数，并为其它客户端留出余量\nconst pool = new Pool({\n  connectionString: process.env.DATABASE_URL,\n  max: 10,\n  idleTimeoutMillis: 30000,\n  connectionTimeoutMillis: 5000,\n});\n\nasync function withConnection(fn) {\n  const client = await pool.connect();\n  try {\n    return await fn(client);\n  } finally {\n    client.release(); // 无论成功还是抛异常，都归还连接\n  }\n}\n\nexport async function findUser(id) {\n  return withConnection((client) =>\n    client.query('SELECT id, name FROM users WHERE id = $1', [id])\n  );\n}",
          explanation:
            "把借连接与归还收进一个 helper：释放动作写在 finally 里，即使查询抛异常也不会漏还。池上限设为 10 并给数据库留出余量，而不是贴着连接上限设满；connectionTimeoutMillis 保证借不到连接时快速失败，而不是无限等待。注意归还发生在查询完成之后，所以不要在借出的连接上做长时间的外部等待。",
        },
        practiceSteps: [
          "查清数据库当前的连接上限与已用连接数，再定义应用侧的池上限，并留出管理端余量。",
          "把所有直接建连的代码统一到连接池的借还封装里。",
          "设置连接获取超时，并监控等待时长与池占用，作为扩容或收窄的依据。",
          "排查泄漏：对比压测前后数据库侧连接数是否持续增长。",
        ],
        masteryChecklist: [
          "能解释连接池省下的是什么开销。",
          "能说明池上限、数据库上限与获取超时三者的关系。",
          "能指出一段代码里可能导致连接泄漏的地方。",
        ],
        summary: [
          "建连很贵，连接池用复用省下握手与认证开销。",
          "池上限不能超过数据库能承受的连接数，否则等待变报错。",
          "连接必须在 finally 一类的位置归还，泄漏会耗尽池。",
          "借不到连接应超时快速失败，防止请求无限堆积。",
          "长事务与外部等待会长时间占用连接，缩短持有时间同样重要。",
        ],
        terms: [
          {
            term: "连接池（Connection Pool）",
            plain: "提前建好一批数据库连接，循环借出去，用完还回来。",
            detail:
              "目的是复用连接、省下反复建连的开销，同时把并发连接数限制在数据库能承受的范围内。池大小、数据库上限与请求持有时长共同决定实际表现。",
          },
          {
            term: "连接泄漏（Connection Leak）",
            plain: "借了连接忘了还，池里的连接越来越少。",
            detail:
              "最常发生在异常路径：出错提前返回却没归还。它是累积的，短时间看不出问题，高峰时突然全部请求排队超时，所以要靠 finally 与统一封装从源头杜绝。",
          },
          {
            term: "连接数上限（max_connections）",
            plain: "数据库最多允许同时接多少个连接。",
            detail:
              "每个连接在服务端都要占资源，超过上限的新连接会被拒绝。应用池上限应低于它并留出管理余量，否则流量一上来就是直接报错而不是排队。",
          },
          {
            term: "连接获取超时（Connection Timeout）",
            plain: "等连接最多等多久，超了就报错。",
            detail:
              "它是保护机制：池被占满时让请求快速失败，而不是无限堆积拖垮整个服务。超时值要结合正常请求耗时设置，过短会误伤慢查询。",
          },
        ],
      },
    },
    questions: [
      {
        key: "database-sup-db-connection-pool-s1",
        stageKey: "db-modeling-ops",
        topicKey: "db-connection-pool",
        type: "single",
        stem: "关于连接池配置，下面哪项做法是正确的？",
        options: [
          { key: "A", text: "池的最大连接数应设得比数据库连接上限更大，以免请求排队" },
          { key: "B", text: "池上限应低于数据库能承受的连接数并留出余量，同时在 finally 中归还连接" },
          { key: "C", text: "借出的连接可以由垃圾回收自动归还，不必显式释放" },
          { key: "D", text: "连接池越大，查询一定越快" },
        ],
        answer: ["B"],
        explanation:
          "数据库连接数是硬上限，池上限超过它只会让新请求被拒绝，给管理端与其它客户端留出余量才安全。连接必须在 finally 一类的位置显式归还，否则泄漏会逐步耗尽池。池也不是越大越快：连接过多会加重服务端的上下文切换与内存压力，整体吞吐反而可能下降。",
        difficulty: "medium",
        tags: ["连接池", "运维", "超时"],
        sourceKey: "postgresql",
        level: "进阶",
      },
      {
        key: "database-sup-db-connection-pool-j1",
        stageKey: "db-modeling-ops",
        topicKey: "db-connection-pool",
        type: "judge",
        stem: "在异常路径中忘记归还连接，会导致连接池可用连接逐渐减少，最终请求排队或超时。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "连接池复用有限个连接，借出后未归还就永久占用一个名额。异常路径最容易被忽略，泄漏随时间累积，可用连接越来越少，直到新请求只能排队并最终超时。因此释放动作要放在 finally 等一定会执行的位置，而不是只在正常流程末尾。",
        difficulty: "easy",
        tags: ["连接泄漏", "连接池"],
        sourceKey: "cmu-bustub",
        level: "入门",
      },
    ],
  },
];
