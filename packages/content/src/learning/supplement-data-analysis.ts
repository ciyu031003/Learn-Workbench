import type { LearningDifficulty, LearningQuestion, LearningLevel } from "./types";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function singleQuestion(input: {
  key: string; stageKey: string; topicKey: string;
  stem: string; options: [string, string, string, string];
  answer: "A" | "B" | "C" | "D"; explanation: string;
  difficulty: LearningDifficulty; tags: string[]; sourceKey: string; level: LearningLevel;
}): LearningQuestion {
  return { key: input.key, stageKey: input.stageKey, topicKey: input.topicKey, type: "single",
    stem: input.stem, options: input.options.map((text, i) => ({ key: OPTION_KEYS[i], text })),
    answer: [input.answer], explanation: input.explanation, difficulty: input.difficulty,
    tags: input.tags, sourceKey: input.sourceKey, level: input.level };
}

function judgeQuestion(input: {
  key: string; stageKey: string; topicKey: string;
  stem: string; answer: boolean; explanation: string;
  difficulty: LearningDifficulty; tags: string[]; sourceKey: string; level: LearningLevel;
}): LearningQuestion {
  return { key: input.key, stageKey: input.stageKey, topicKey: input.topicKey, type: "judge",
    stem: input.stem, options: [{ key: "A", text: "正确" }, { key: "B", text: "错误" }],
    answer: [input.answer ? "A" : "B"], explanation: input.explanation, difficulty: input.difficulty,
    tags: input.tags, sourceKey: input.sourceKey, level: input.level };
}

/** SQL 与数据分析 补充题库（按知识点细分，2 题/知识点）。 */
export const dataanalysisSupplementQuestions: LearningQuestion[] = [
  // ---- data-relational-model ----
  singleQuestion({ key: "data-analysis-sup-data-relational-model-s1", stageKey: "data-relational", topicKey: "data-relational-model",
    stem: "在关系模型中，表（relation）的“粒度（grain）”指的是什么？以下对粒度的描述最准确的是？",
    options: [
      "粒度指一张表中列的数量，列越多粒度越细。",
      "粒度指表中每一行所描述的最小业务实体或事件单位，即一行代表什么。",
      "粒度指表的总行数，行数越多粒度越粗。",
      "粒度指主键的长度，主键字段越长粒度越细。"
    ],
    answer: "B",
    explanation: "在维度建模与关系模型里，粒度（grain）定义为事实表每一行所表示的业务过程的最小单位，例如“一笔订单中的一个商品行”或“一次页面浏览”。明确粒度是设计表结构的第一步：粒度越细，行越能表达原子事件但数据量更大；粒度越粗，行越聚合但丢失细节。列数量、行总数、主键长度都不是粒度的定义，故只有 B 正确。",
    difficulty: "easy", tags: ["关系模型", "粒度"], sourceKey: "data-engineering-reference", level: "入门" }),
  judgeQuestion({ key: "data-analysis-sup-data-relational-model-j1", stageKey: "data-relational", topicKey: "data-relational-model",
    stem: "在关系模型中，表结构（列定义）描述实体的属性，而表中的每一行代表该属性的一个具体实例（一条记录）；粒度越细，同样业务范围内表的行数通常越多。",
    answer: true,
    explanation: "关系模型把现实世界抽象为二维表：列（字段）定义实体属性，行（元组）是该属性的一个个具体实例。所谓粒度越细，是指每行描述的业务单位越小、越原子化（如从“按天汇总”细化到“按次点击”），在相同业务范围内自然会产生更多行。该命题符合关系模型与维度建模的基本约定，因此正确。",
    difficulty: "easy", tags: ["关系模型", "粒度"], sourceKey: "data-engineering-reference", level: "入门" }),

  // ---- data-select-filter ----
  singleQuestion({ key: "data-analysis-sup-data-select-filter-s1", stageKey: "data-relational", topicKey: "data-select-filter",
    stem: "关于 SQL 中 WHERE 与 HAVING 子句的区别，下列说法正确的是？",
    options: [
      "WHERE 和 HAVING 都只能在分组之后过滤数据，二者可互换。",
      "WHERE 在分组与聚合之前对原始行进行过滤，HAVING 在分组与聚合之后对分组结果进行过滤。",
      "HAVING 只能在 SELECT 列表不包含任何聚合函数时使用。",
      "WHERE 子句中可以直接使用聚合函数如 COUNT(*) 来过滤。"
    ],
    answer: "B",
    explanation: "SQL 执行顺序中，WHERE 在 FROM/JOIN 之后、GROUP BY 之前生效，用于筛选参与聚合的源行，因此不能引用聚合结果；HAVING 位于 GROUP BY 之后，专门对聚合后的分组进行筛选，常与 COUNT/SUM/AVG 等配合。A、C、D 均与这一执行顺序相反或错误，故 B 正确。",
    difficulty: "easy", tags: ["SQL", "过滤", "排序"], sourceKey: "data-engineering-reference", level: "入门" }),
  judgeQuestion({ key: "data-analysis-sup-data-select-filter-j1", stageKey: "data-relational", topicKey: "data-select-filter",
    stem: "在包含 GROUP BY 的查询中，WHERE 子句用于分组前过滤行，HAVING 子句用于分组后过滤组；因此要对“订单总额大于 1000 的客群”进行筛选时应使用 HAVING 而非 WHERE。",
    answer: true,
    explanation: "当过滤条件依赖聚合结果（如 SUM(amount) > 1000）时，必须在分组完成后才能计算，因此只能放在 HAVING 中。WHERE 在聚合前执行，此时尚不存在“订单总额”这一分组级指标，无法用于该过滤。命题准确描述了二者分工，因此正确。",
    difficulty: "easy", tags: ["SQL", "过滤"], sourceKey: "data-engineering-reference", level: "入门" }),

  // ---- data-joins ----
  singleQuestion({ key: "data-analysis-sup-data-joins-s1", stageKey: "data-relational", topicKey: "data-joins",
    stem: "设左表 A 有 100 行、右表 B 有 50 行，二者通过外键连接。执行 LEFT JOIN 时，关于结果行数的下列哪种说法正确？",
    options: [
      "结果一定恰好 100 行，因为左表每行至少保留一条。",
      "结果行数一定等于 100 且不会超过 100。",
      "结果至少 100 行，若左表某行在右表匹配到多行，则结果会超过 100 行。",
      "结果最多 100 行，且当右表无匹配时该行被完全丢弃。"
    ],
    answer: "C",
    explanation: "LEFT JOIN 保证左表 A 的每一行至少出现一次（无匹配时右表字段补 NULL），因此结果不少于 100 行；但如果 A 的某一行在 B 中匹配到多行（一对多关系未先做聚合），该行会被复制成多行，使结果超过 100 行。A、B 忽略了“一对多膨胀”，D 描述的是 INNER/普通连接的行为，故 C 正确。",
    difficulty: "medium", tags: ["SQL", "连接", "多表"], sourceKey: "data-engineering-reference", level: "进阶" }),
  judgeQuestion({ key: "data-analysis-sup-data-joins-j1", stageKey: "data-relational", topicKey: "data-joins",
    stem: "INNER JOIN 只返回左右两表连接键都能匹配上的行；如果左表的某一行在右表中找不到任何匹配键，这一行不会出现在 INNER JOIN 的结果中。",
    answer: true,
    explanation: "INNER JOIN 的语义是取两表连接键的交集，仅保留双方都匹配成功的组合。左表中找不到右表匹配的行因不满足连接条件而被排除，这正是它与 LEFT JOIN 的关键区别。命题描述准确，因此正确。",
    difficulty: "medium", tags: ["SQL", "连接"], sourceKey: "data-engineering-reference", level: "进阶" }),

  // ---- data-analysis-sql ----
  singleQuestion({ key: "data-analysis-sup-data-analysis-sql-s1", stageKey: "data-analysis-sql", topicKey: "data-window",
    stem: "某查询为 SELECT user_id, region, SUM(amount) FROM orders GROUP BY user_id, region。关于 GROUP BY 列与 SELECT 列的关系，下列说法正确的是？",
    options: [
      "SELECT 中任何列都可以不出现在 GROUP BY 中，只要加上别名即可。",
      "SELECT 列表里所有非聚合列（user_id、region）都必须出现在 GROUP BY 中，否则标准 SQL 会报错。",
      "GROUP BY 必须包含所有 SELECT 列，包括 SUM(amount) 这种聚合列。",
      "只要使用了聚合函数，GROUP BY 就可以省略。"
    ],
    answer: "B",
    explanation: "在严格 SQL 语义下，SELECT 中出现的非聚合表达式必须全部纳入 GROUP BY，因为它们的值在每个分组内必须是确定且一致的；user_id 与 region 均为分组维度，必须出现在 GROUP BY 中。聚合列（SUM(amount)）不应再放进 GROUP BY，否则失去分组意义；某些数据库对“函数依赖”宽松但标准仍要求显式列出。因此 B 正确。",
    difficulty: "medium", tags: ["SQL", "聚合", "分组"], sourceKey: "ms-data-science", level: "进阶" }),
  judgeQuestion({ key: "data-analysis-sup-data-analysis-sql-j1", stageKey: "data-analysis-sql", topicKey: "data-window",
    stem: "在 GROUP BY 查询中，SELECT 列表里出现的每一个非聚合列都必须同时出现在 GROUP BY 子句中，否则在标准 SQL 中属于语法错误。",
    answer: true,
    explanation: "GROUP BY 定义了“按哪些维度聚合”，每个分组内非聚合列的取值应当唯一确定。若 SELECT 引用了未分组的列，数据库无法决定取该组内的哪一行值，因此标准 SQL 会拒绝此类查询（部分数据库因函数依赖放松限制，但属于方言而非标准）。命题符合标准语义，故正确。",
    difficulty: "medium", tags: ["SQL", "聚合"], sourceKey: "ms-data-science", level: "进阶" }),

  // ---- data-window ----
  singleQuestion({ key: "data-analysis-sup-data-window-s1", stageKey: "data-analysis-sql", topicKey: "data-window",
    stem: "以下关于窗口函数（如 ROW_NUMBER()、SUM() OVER (...)）与普通聚合函数的区别，正确的是？",
    options: [
      "窗口函数会把多行压缩成一行汇总，普通聚合不会。",
      "窗口函数在 OVER 子句定义的窗口上计算，但保留每一行的独立输出，不折叠行数。",
      "窗口函数只能在 GROUP BY 之后使用，且必须配合 HAVING。",
      "窗口函数不能在同一查询中既计算排名又计算累计和。"
    ],
    answer: "B",
    explanation: "窗口函数的核心特征是“在不合并行的前提下为每行附加一个基于相邻行的计算结果”：OVER (PARTITION BY ... ORDER BY ...) 划定窗口，查询输出的行数与输入一致，只是每行多出一列窗口值。普通聚合（无 OVER）在 GROUP BY 下会把多行压缩成一行。A 说反了，C、D 均为错误限制，故 B 正确。",
    difficulty: "hard", tags: ["SQL", "窗口函数"], sourceKey: "ms-data-science", level: "综合" }),
  judgeQuestion({ key: "data-analysis-sup-data-window-j1", stageKey: "data-analysis-sql", topicKey: "data-window",
    stem: "窗口函数使用 OVER 子句计算时，不会改变结果集的行数，即输入 N 行、输出仍然是 N 行，只是为每行附加了基于窗口的聚合或排名值。",
    answer: true,
    explanation: "窗口函数与普通 GROUP BY 聚合的根本区别在于“非折叠性”：它按 OVER 指定的分区与排序在行级计算（如累计和、排名、前后行差值），但每一原始行都保留，因此输出行数等于输入行数。命题准确刻画了这一特性，因此正确。",
    difficulty: "hard", tags: ["SQL", "窗口函数"], sourceKey: "ms-data-science", level: "综合" }),

  // ---- data-cte ----
  singleQuestion({ key: "data-analysis-sup-data-cte-s1", stageKey: "data-analysis-sql", topicKey: "data-cte",
    stem: "关于公用表表达式（CTE，即 WITH 子句），下列说法正确的是？",
    options: [
      "CTE 必须被物化为物理临时表，因此总是比子查询慢。",
      "CTE 只是一次性的命名子查询，提升可读性，可被后续主查询多次引用，也支持递归（WITH RECURSIVE）。",
      "CTE 只能在 SELECT 中使用，且每个查询最多只能定义一个 CTE。",
      "CTE 的结果会自动写入磁盘并跨多个独立查询共享。"
    ],
    answer: "B",
    explanation: "CTE 通过 WITH name AS (subquery) 把复杂查询拆成有名字的步骤，主要价值在于可读性与模块化，可在同一语句中被多次引用；标准 SQL 还支持 WITH RECURSIVE 处理层级/树形数据。它通常是逻辑上的临时结果（优化器可能内联），并非必须物化或落盘，也不限数量。A、C、D 均为错误认知，故 B 正确。",
    difficulty: "medium", tags: ["SQL", "CTE", "查询拆解"], sourceKey: "data-engineering-reference", level: "进阶" }),
  judgeQuestion({ key: "data-analysis-sup-data-cte-j1", stageKey: "data-analysis-sql", topicKey: "data-cte",
    stem: "公用表表达式（CTE）可以将复杂查询拆解成可读性更高的命名步骤，并在同一语句中被多次引用；此外，使用 WITH RECURSIVE 的 CTE 还能表达层级或树形结构的递归遍历。",
    answer: true,
    explanation: "CTE 的两大用途正是“查询拆解/复用”和“递归”。WITH RECURSIVE 通过锚点查询加递归项不断迭代，非常适合处理组织层级、物料清单、路径可达等树图问题。命题完整且准确地描述了 CTE 能力，因此正确。",
    difficulty: "medium", tags: ["SQL", "CTE", "递归"], sourceKey: "data-engineering-reference", level: "进阶" }),

  // ---- data-funnel-retention ----
  singleQuestion({ key: "data-analysis-sup-data-funnel-retention-s1", stageKey: "data-analysis-sql", topicKey: "data-funnel-retention",
    stem: "在分析用户行为时，“漏斗分析”与“留存分析（同期群/cohort）”的核心区别是什么？",
    options: [
      "二者完全相同，只是叫法不同。",
      "漏斗关注用户在一系列有序步骤中的逐步转化与流失；留存关注同一批（按时间分群的）用户在后续多个时间周期中是否持续回来。",
      "漏斗只能用于付费用户，留存只能用于免费用户。",
      "漏斗衡量的是金额，留存衡量的是点击量。"
    ],
    answer: "B",
    explanation: "漏斗分析（funnel）刻画一条有序转化路径（如浏览→加购→下单）各步的通过率与流失点，定位体验瓶颈；留存/同期群分析（cohort）按首次行为时间把用户分群，再观察这些群在随后第 1、7、30 天等周期的活跃比例，衡量产品黏性与价值持续。二者对象与方法都不同，故 B 正确。",
    difficulty: "hard", tags: ["漏斗", "留存", "同期群"], sourceKey: "ms-data-science", level: "综合" }),
  judgeQuestion({ key: "data-analysis-sup-data-funnel-retention-j1", stageKey: "data-analysis-sql", topicKey: "data-funnel-retention",
    stem: "同期群分析（cohort analysis）通常按用户首次发生某关键行为的时间（如注册周）将用户分群，再比较不同群在后续相同时间窗口内的留存或活跃表现，从而区分“整体增长”与“真实留存”。",
    answer: true,
    explanation: "同期群分析的本质是按起始时间切片，使不同人群在“注册后第 N 天”这一可比口径下对照，避免把新用户涌入带来的总量上升误认为留存改善。命题准确说明了分群依据与对比目的，因此正确。",
    difficulty: "hard", tags: ["留存", "同期群"], sourceKey: "ms-data-science", level: "综合" }),

  // ---- data-cleaning ----
  singleQuestion({ key: "data-analysis-sup-data-cleaning-s1", stageKey: "data-cleaning", topicKey: "data-quality",
    stem: "在对用户表的姓名字段做清洗时，发现同一人存在“ 张伟 ”“张伟”“张 伟”三种写法。针对这类问题的首选处理步骤是？",
    options: [
      "直接删除所有带空格的记录。",
      "先做标准化（去除首尾与中间多余空格、统一大小写/全半角），再基于标准化后的值做去重与匹配。",
      "把空格替换为逗号以避免删除。",
      "无需处理，因为空格不影响聚合结果。"
    ],
    answer: "B",
    explanation: "数据清洗强调“先标准化再整合”：用 TRIM 去首尾空格、用正则或 REPLACE 压缩中间多余空格、统一全角半角与大小写，使同一实体的不同书写形式归一成同一键值，随后才能正确去重、关联与聚合。盲目删除或与逗号替换都会破坏或丢失信息，忽略则导致重复计数，故 B 正确。",
    difficulty: "easy", tags: ["数据清洗", "标准化"], sourceKey: "ms-data-science", level: "入门" }),
  judgeQuestion({ key: "data-analysis-sup-data-cleaning-j1", stageKey: "data-cleaning", topicKey: "data-quality",
    stem: "在数据清洗中，TRIM 类函数用于去除字符串首尾的空白字符；但若姓名中间夹杂多余空格（如“张 伟”），仅做首尾 TRIM 不足以合并为标准形式，还需进一步替换中间空格。",
    answer: true,
    explanation: "TRIM 仅作用于字符串两端的空白，对“张 伟”中间的空格无能为力。要将其与“张伟”视为同一实体，必须再做中间空格压缩（如 REPLACE 或正则）并统一编码/大小写。命题正确指出了 TRIM 的局限与补充手段，因此正确。",
    difficulty: "easy", tags: ["数据清洗", "TRIM"], sourceKey: "ms-data-science", level: "入门" }),

  // ---- data-quality ----
  singleQuestion({ key: "data-analysis-sup-data-quality-s1", stageKey: "data-cleaning", topicKey: "data-quality",
    stem: "评价一份数据集的“数据质量”时，下列哪个维度描述的是“同一实体在多条记录中是否被重复记录、主键是否唯一”？",
    options: [
      "完整性（completeness）",
      "准确性（accuracy）",
      "唯一性（uniqueness）",
      "及时性（timeliness）"
    ],
    answer: "C",
    explanation: "数据质量常用六个维度：完整性（字段是否缺失）、准确性（值是否真实正确）、一致性（跨表口径是否一致）、唯一性（无重复记录、主键不冲突）、及时性（是否最新）、有效性（是否符合格式/域约束）。题干强调“重复记录、主键唯一”，正对应唯一性维度，故 C 正确。",
    difficulty: "medium", tags: ["数据质量", "唯一性"], sourceKey: "data-engineering-reference", level: "进阶" }),
  judgeQuestion({ key: "data-analysis-sup-data-quality-j1", stageKey: "data-cleaning", topicKey: "data-quality",
    stem: "在关系表中，主键（primary key）约束保证了每一行记录的唯一性与非空性；若同一业务实体被重复插入，会违反主键唯一性，属于数据质量中的“唯一性”问题。",
    answer: true,
    explanation: "主键约束同时要求 NOT NULL 与 UNIQUE：它既防止空标识，也防止同一标识出现多行，从而保障实体不被重复记录。重复插入触发唯一性冲突，正是数据质量“唯一性”维度要治理的问题。命题描述准确，故正确。",
    difficulty: "medium", tags: ["数据质量", "主键"], sourceKey: "data-engineering-reference", level: "进阶" }),

  // ---- data-exploration ----
  singleQuestion({ key: "data-analysis-sup-data-exploration-s1", stageKey: "data-cleaning", topicKey: "data-exploration",
    stem: "在描述统计与异常发现阶段，若要快速识别“某数值列中偏离中心趋势极远”的潜在异常值，最合适的初步手段组合是？",
    options: [
      "仅看最大值与最小值即可，无需其他统计量。",
      "计算均值、标准差与四分位距（IQR），并结合箱线图观察超出 1.5×IQR 边界或 ±3 倍标准差的点。",
      "只统计该列的字符长度。",
      "直接删除所有大于均值的记录。"
    ],
    answer: "B",
    explanation: "异常发现依赖分布描述：均值与标准差刻画集中与离散，IQR（Q3−Q1）给出稳健的离群边界。经验法则中，超出 [Q1−1.5·IQR, Q3+1.5·IQR] 或偏离均值超过约 3 倍标准差的点常被标记为可疑异常，箱线图能直观呈现。仅看极值易漏判，字符长度与删除大于均值都属错误做法，故 B 正确。",
    difficulty: "medium", tags: ["描述统计", "异常值"], sourceKey: "ms-data-science", level: "进阶" }),
  judgeQuestion({ key: "data-analysis-sup-data-exploration-j1", stageKey: "data-cleaning", topicKey: "data-exploration",
    stem: "在探索性数据分析中，箱线图通过四分位距（IQR）识别异常值，通常将小于 Q1−1.5×IQR 或大于 Q3+1.5×IQR 的点视为潜在离群点，这是一种基于分布而非主观阈值的异常发现方法。",
    answer: true,
    explanation: "箱线图以中位数和四分位数为基准，用 1.5×IQR 规则界定“须”的范围，超出者作为离群候选。该方法不依赖人为拍定的固定数值，而是数据自身分布驱动，适合初步异常筛查。命题准确，因此正确。",
    difficulty: "medium", tags: ["描述统计", "箱线图"], sourceKey: "ms-data-science", level: "进阶" }),

  // ---- data-experiment ----
  singleQuestion({ key: "data-analysis-sup-data-experiment-s1", stageKey: "data-cleaning", topicKey: "data-experiment",
    stem: "在 A/B 实验中，关于 p 值与统计显著性的下列理解，正确的是？",
    options: [
      "p 值表示实验组比对照组好的概率。",
      "p 值是在“原假设（两组无差异）成立”的前提下，观察到当前及更极端结果的概率；p 值小于显著性水平（如 0.05）时，我们拒绝原假设，认为差异不太可能仅由随机波动造成。",
      "p 值越小说明实验组提升幅度一定越大。",
      "只要样本量足够大，p 值就一定会小于 0.05。"
    ],
    answer: "B",
    explanation: "p 值是“原假设为真时看到当前及更极端数据”的概率，用于衡量证据强度：p 小意味着在原假设下出现如此结果很罕见，从而提供拒绝原假设的依据。但 p 值≠效应大小（提升幅度），也不因样本大就必然显著（若真无差异仍可能不显著）。A、C、D 都是常见误解，故 B 正确。",
    difficulty: "hard", tags: ["实验", "p值", "显著性"], sourceKey: "ms-data-science", level: "综合" }),
  judgeQuestion({ key: "data-analysis-sup-data-experiment-j1", stageKey: "data-cleaning", topicKey: "data-experiment",
    stem: "在线上 A/B 实验中，随机分流的核心目的是使实验组与对照组在可观测与不可观测的混淆变量上尽可能均衡，从而把指标差异更可信地归因于实验改动本身，而非人群差异。",
    answer: true,
    explanation: "随机化是因果推断的基石：通过随机分配，已知与未知的混杂因素在两组间期望上平衡，组间差异才可归因于处理（treatment）。命题正确说明了随机分流的作用与因果识别前提，因此正确。",
    difficulty: "hard", tags: ["实验", "随机化", "因果"], sourceKey: "ms-data-science", level: "综合" }),

  // ---- data-visual-delivery ----
  singleQuestion({ key: "data-analysis-sup-data-visual-delivery-s1", stageKey: "data-visual-delivery", topicKey: "data-chart-choice",
    stem: "在将 SQL 分析结果交付为业务图表时，下列哪种做法最有助于提升交付的可信度与可复用性？",
    options: [
      "只给出一张漂亮的趋势图，不附任何文字说明。",
      "标注数据来源、统计口径与更新时间，并用简要结论说明图表明什么、支撑了哪个业务决策。",
      "把原始 SQL 全文直接贴在图旁，不做任何解读。",
      "为追求美观，隐藏坐标轴刻度与单位。"
    ],
    answer: "B",
    explanation: "业务交付的目标是让非技术读者“看得懂、敢用、能复核”。标注来源/口径/时间保证可追溯与可复算，简要结论把数据翻译成决策语言。仅有图、纯贴 SQL、或隐藏坐标轴都会降低可信度与可读性，故 B 正确。",
    difficulty: "easy", tags: ["可视化", "交付"], sourceKey: "ms-data-science", level: "入门" }),
  judgeQuestion({ key: "data-analysis-sup-data-visual-delivery-j1", stageKey: "data-visual-delivery", topicKey: "data-chart-choice",
    stem: "在向业务方交付分析图表时，应同时注明数据来源、统计口径（如“口径：已支付订单，剔除测试账号”）与图表所支撑的结论，以便他人复核与后续复用。",
    answer: true,
    explanation: "可追溯（来源与口径）与可理解（结论）是分析交付的基本要求：缺失口径会导致不同人对同一指标理解不一，缺失结论则把解读成本转嫁给读者。命题符合良好交付规范，因此正确。",
    difficulty: "easy", tags: ["可视化", "交付规范"], sourceKey: "ms-data-science", level: "入门" }),

  // ---- data-chart-choice ----
  singleQuestion({ key: "data-analysis-sup-data-chart-choice-s1", stageKey: "data-visual-delivery", topicKey: "data-chart-choice",
    stem: "若要展示“过去 12 个月公司销售额随时间的变化趋势”，并希望读者一眼看出增减走势，最合适的图表类型是？",
    options: [
      "饼图",
      "折线图",
      "散点图（无时间连线）",
      "雷达图"
    ],
    answer: "B",
    explanation: "折线图以横轴为连续时间、纵轴为指标值，最擅长时间序列的趋势、拐点与周期表达；饼图适合静态占比、散点图强调变量间相关而非时序、雷达图用于多维对比，均不突出“随时间走势”。故展示销售额趋势首选折线图，B 正确。",
    difficulty: "medium", tags: ["图表选择", "趋势"], sourceKey: "ms-data-science", level: "进阶" }),
  judgeQuestion({ key: "data-analysis-sup-data-chart-choice-j1", stageKey: "data-visual-delivery", topicKey: "data-chart-choice",
    stem: "展示各部分占整体比例时，饼图或环形图是合适选择；但若类别超过约 7 个，扇区过小会难以分辨，此时应改用条形图按数值排序呈现占比更为清晰。",
    answer: true,
    explanation: "饼图适用于少量类别的占比对比；当类别过多时，人眼难以比较相近角度的扇区。条形图（尤其按值降序）能清晰呈现各类别大小与占比，是比例类多类别数据的更优表达。命题符合图表选型原则，因此正确。",
    difficulty: "medium", tags: ["图表选择", "占比"], sourceKey: "ms-data-science", level: "进阶" }),

  // ---- data-dashboard ----
  singleQuestion({ key: "data-analysis-sup-data-dashboard-s1", stageKey: "data-visual-delivery", topicKey: "data-dashboard",
    stem: "在设计面向管理层的仪表板（dashboard）信息架构时，下列哪种原则最关键？",
    options: [
      "把数据库里所有可用指标都罗列到一屏，信息越全越好。",
      "先明确核心业务问题与受众，再自上而下组织“概览指标→细分下钻→明细”的层级，并固定更新频率与口径。",
      "每个图表都使用最炫酷的 3D 动画以吸引注意。",
      "仪表板只需技术人员能看懂，无需考虑业务语言。"
    ],
    answer: "B",
    explanation: "优秀仪表板从“问题/受众”出发做信息架构：顶部放北极星与核心 KPI 概览，向下提供维度下钻与明细溯源，并固化口径与刷新节奏，保证一致性与可行动性。堆砌全部指标会造成信息过载，炫酷动画与忽视业务语言都会削弱决策价值，故 B 正确。",
    difficulty: "hard", tags: ["仪表板", "信息架构"], sourceKey: "system-design-primer", level: "综合" }),
  judgeQuestion({ key: "data-analysis-sup-data-dashboard-j1", stageKey: "data-visual-delivery", topicKey: "data-dashboard",
    stem: "仪表板应聚焦少数核心指标并支持从概览到明细的下钻，而不是把所有可获取的指标无差别地堆砌在一屏，否则会造成信息过载、稀释关键决策信息。",
    answer: true,
    explanation: "仪表板的目的是服务于快速决策，信息架构需做“减法”：以核心 KPI 为锚，按需下钻。无差别堆砌会让读者难以定位重点，违背仪表板的设计初衷。命题准确表达了聚焦与层级下钻原则，因此正确。",
    difficulty: "hard", tags: ["仪表板", "聚焦"], sourceKey: "system-design-primer", level: "综合" }),

  // ---- data-story ----
  singleQuestion({ key: "data-analysis-sup-data-story-s1", stageKey: "data-visual-delivery", topicKey: "data-story",
    stem: "在撰写数据分析叙事（data story）向业务方交付时，下列哪种结构最能驱动行动？",
    options: [
      "先展示全部 SQL 代码，再让听众自行得出结论。",
      "以“结论先行（核心发现）→ 支撑证据（关键图表/数据）→ 业务含义与建议行动”的金字塔结构组织。",
      "从头罗列每一张探索性图表，不给出任何结论。",
      "只给结论，不提供任何数据支撑以避免冗长。"
    ],
    answer: "B",
    explanation: "分析叙事强调“用数据讲故事、以结论驱动行动”。金字塔结构先把最重要结论摆在最前，契合管理层有限的注意力；随后用关键证据（图表、对比、显著性）支撑结论，最后落到可执行的业务建议。纯代码、纯罗列或只有结论都没法有效说服与驱动决策，故 B 正确。",
    difficulty: "hard", tags: ["分析叙事", "交付"], sourceKey: "system-design-primer", level: "综合" }),
  judgeQuestion({ key: "data-analysis-sup-data-story-j1", stageKey: "data-visual-delivery", topicKey: "data-story",
    stem: "好的数据分析叙事应先抛出核心结论与业务建议，再用证据（数据与图表）支撑，而不是让读者在大量原始图表中自行归纳，这样才能高效驱动业务决策。",
    answer: true,
    explanation: "叙事交付的关键在于“结论先行、证据支撑”：先给受众最关心的结论与行动建议，再用精选证据建立可信度，避免信息淹没。命题符合分析叙事（data storytelling）的基本方法论，因此正确。",
    difficulty: "hard", tags: ["分析叙事", "结论先行"], sourceKey: "system-design-primer", level: "综合" })
];
