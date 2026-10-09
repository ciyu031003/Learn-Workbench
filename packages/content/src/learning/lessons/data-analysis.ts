import type { LearningTopicLesson } from "../types";

export const dataAnalysisTopicLessons: Record<string, LearningTopicLesson> = {
  "data-relational-model": {
    overview: [
      "关系模型用表表达业务对象和事件。主键唯一标识一行，外键表达引用，一对多和多对多通过关系和桥接表表达。",
      "建模前先定义粒度：一行是用户、订单还是订单明细？粒度不清会让聚合、连接和权限都产生歧义。",
    ],
    mechanism: [
      "主键可为一列或多列组合，外键约束帮助保护引用完整性；连接键必须表达同一个业务身份。",
      "事实表记录可度量事件，维度表描述对象属性；日期、用户和产品等维度通常被多个事实共享。",
    ],
    example: {
      title: "课程报名模型",
      language: "sql",
      code: `CREATE TABLE users (
  user_id BIGINT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE courses (
  course_id BIGINT PRIMARY KEY,
  title TEXT NOT NULL
);

CREATE TABLE enrollments (
  user_id BIGINT NOT NULL REFERENCES users(user_id),
  course_id BIGINT NOT NULL REFERENCES courses(course_id),
  enrolled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  PRIMARY KEY (user_id, course_id)
);`,
      explanation: "报名表一行代表用户与课程的报名关系，复合主键防止重复报名。用户和课程通过外键保持引用一致性。",
    },
    practiceSteps: [
      "写出用户、课程、报名表的粒度句子。",
      "为每个外键注明删除和更新策略。",
      "插入重复报名，验证主键约束会阻止。",
    ],
    masteryChecklist: [
      "能用一句话说明每张表中一行代表什么。",
      "能区分主键、外键和业务唯一键。",
    ],
  },
  "data-select-filter": {
    overview: [
      "SELECT 查询先确定数据集合，再过滤、计算、分组和排序。SQL 的书写顺序不必等于逻辑执行顺序。",
      "NULL 表示未知，不是空字符串或零。普通等值比较无法命中 NULL，需要使用 `IS NULL`，聚合和连接也要考虑 NULL 行为。",
    ],
    mechanism: [
      "WHERE 在分组前过滤行，ORDER BY 在结果生成后排序，LIMIT 截取排序后的结果。",
      "CASE WHEN 可以在查询中表达业务分类，COALESCE 可以选择第一个非 NULL 值，但都应在指标口径中明确说明。",
    ],
    example: {
      title: "过滤空值并计算订单等级",
      language: "sql",
      code: `SELECT
  order_id,
  COALESCE(amount, 0) AS amount,
  CASE
    WHEN amount >= 1000 THEN 'high'
    WHEN amount >= 300 THEN 'medium'
    ELSE 'low'
  END AS tier
FROM orders
WHERE paid_at IS NOT NULL
  AND created_at >= now() - interval '30 days'
ORDER BY created_at DESC;`,
      explanation: "未支付订单用 `IS NOT NULL` 排除，空金额在结果中显示为 0，分类规则与时间窗口都写在查询里。",
    },
    practiceSteps: [
      "分别统计 `amount = NULL` 和 `amount IS NULL` 的结果。",
      "用 CASE 增加一个退货分类。",
      "检查时间过滤使用 UTC 还是业务时区。",
    ],
    masteryChecklist: [
      "能说明 NULL 在过滤、连接和聚合中的行为。",
      "能按逻辑执行顺序解释查询结果。",
    ],
  },
  "data-joins": {
    overview: [
      "JOIN 把多个数据集按关系组合。连接前要确认双方粒度、连接键唯一性和期望的匹配数量，否则行数可能膨胀。",
      "聚合把多行压缩成组，WHERE 过滤输入行，HAVING 过滤分组结果。LEFT JOIN 保留左表全部行，右表无匹配时补 NULL。",
    ],
    mechanism: [
      "内连接只保留匹配行，左连接保留左表；如果连接键重复，一行左表可能匹配多行右表，导致指标被重复求和。",
      "聚合函数的输入是分组内的行，COUNT(*) 统计行数，COUNT(column) 忽略 NULL；不同口径必须区分。",
    ],
    example: {
      title: "按地区计算净收入",
      language: "sql",
      code: `WITH refunded AS (
  SELECT order_id, sum(amount) AS refund_amount
  FROM refunds
  GROUP BY order_id
)
SELECT
  o.region,
  sum(o.amount) - coalesce(sum(r.refund_amount), 0) AS net_revenue
FROM orders o
LEFT JOIN refunded r ON r.order_id = o.order_id
WHERE o.status = 'paid'
GROUP BY o.region
HAVING sum(o.amount) > 0;`,
      explanation: "退款先按订单聚合到唯一粒度，再与订单左连接，避免一个订单有多条退款导致收入膨胀。",
    },
    practiceSteps: [
      "连接前后分别统计行数和订单金额。",
      "把 GROUP BY 加入地区后比较结果。",
      "用同一查询比较 COUNT(*) 和 COUNT(customer_id)。",
    ],
    masteryChecklist: [
      "能预测 JOIN 后的行数范围。",
      "能区分 WHERE 与 HAVING 的过滤时机。",
    ],
  },
  "data-window": {
    overview: [
      "窗口函数在保留明细行的同时增加分析列，常用于排名、前后值、累计和移动平均。PARTITION BY 定义窗口组，ORDER BY 定义组内顺序。",
      "窗口函数不会自动去重，若同一顺序上有并列排名，ROW_NUMBER、RANK 和 DENSE_RANK 会产生不同结果。",
    ],
    mechanism: [
      "ROW_NUMBER 总是产生唯一连续序号，RANK 并列后跳号，DENSE_RANK 并列后不跳号。",
      "LAG/LEAD 读取同一分区的前后行，累计求和可以使用默认窗口框架或显式 ROWS BETWEEN。",
    ],
    example: {
      title: "计算用户每月消费排名和环比",
      language: "sql",
      code: `WITH monthly AS (
  SELECT
    user_id,
    date_trunc('month', paid_at) AS month,
    sum(amount) AS revenue
  FROM orders
  GROUP BY user_id, date_trunc('month', paid_at)
)
SELECT
  user_id,
  month,
  revenue,
  rank() OVER (PARTITION BY month ORDER BY revenue DESC) AS month_rank,
  revenue - lag(revenue) OVER (
    PARTITION BY user_id ORDER BY month
  ) AS month_over_month
FROM monthly;`,
      explanation: "先聚合到用户月粒度，再用窗口函数增加月内排名和用户时间序列环比。每个窗口的 PARTITION 和 ORDER 都对应一个明确问题。",
    },
    practiceSteps: [
      "用 ROW_NUMBER、RANK、DENSE_RANK 处理并列金额。",
      "计算每个用户的累计消费。",
      "将 LAG 改成 LEAD，比较方向差异。",
    ],
    masteryChecklist: [
      "能解释窗口分组、排序和默认框架。",
      "能在明细保留与聚合结果之间选择正确结构。",
    ],
  },
  "data-cte": {
    overview: [
      "CTE 用 WITH 给中间结果命名，让复杂分析拆成可读、可验证的步骤。它既可以是筛选后的明细，也可以是已聚合的指标。",
      "每个 CTE 都应有稳定粒度和一个明确问题。不要为了减少嵌套而把所有逻辑塞进一层巨大的 CTE。",
    ],
    mechanism: [
      "CTE 在逻辑上先产生一个结果集，后续查询可以引用它；某些数据库会物化，某些会内联优化，不能把它当成性能魔法。",
      "递归 CTE 适合树和路径问题，但必须设置终止条件，否则会无限展开。",
    ],
    example: {
      title: "注册到首单的四步漏斗",
      language: "sql",
      code: `WITH signups AS (
  SELECT user_id, min(created_at) AS signed_at
  FROM users
  GROUP BY user_id
),
first_orders AS (
  SELECT user_id, min(paid_at) AS first_paid_at
  FROM orders
  WHERE status = 'paid'
  GROUP BY user_id
),
converted AS (
  SELECT s.user_id
  FROM signups s
  JOIN first_orders o USING (user_id)
  WHERE o.first_paid_at <= s.signed_at + interval '7 days'
)
SELECT count(*) AS converted_users FROM converted;`,
      explanation: "每一步都只有一个粒度：注册用户、首单用户、七日内转化用户。可以单独运行前两个 CTE 检查数据。",
    },
    practiceSteps: [
      "为每个 CTE 写一行粒度说明。",
      "逐步运行 CTE 并检查行数变化。",
      "把时间窗口改成 1 天和 30 天比较结果。",
    ],
    masteryChecklist: [
      "能解释每个 CTE 的输入、输出和粒度。",
      "能判断 CTE 是否改善可读性而非制造隐藏逻辑。",
    ],
  },
  "data-funnel-retention": {
    overview: [
      "漏斗描述用户完成一系列有序事件的转化，留存描述初始同期群在后续时间仍活跃。两者都要求固定用户、事件和时间窗口口径。",
      "事件去重和顺序很关键：同一用户多次触发不能重复计数，步骤顺序错误会把不可能的用户算入漏斗。",
    ],
    mechanism: [
      "留存分子的条件一般包括首次注册/首访时间和后续活跃时间，分母是初始同期群；不同活跃事件会得到不同留存曲线。",
      "漏斗可以按用户首次事件到后续事件的时间窗口计算，也可以按会话或订单计算，必须先声明分析单位。",
    ],
    example: {
      title: "次日留存的最小数据模型",
      language: "sql",
      code: `WITH cohort AS (
  SELECT user_id, min(created_at::date) AS cohort_date
  FROM users
  GROUP BY user_id
),
activity AS (
  SELECT DISTINCT user_id, created_at::date AS active_date
  FROM events
  WHERE event_name IN ('open', 'study', 'review')
)
SELECT
  c.cohort_date,
  count(DISTINCT c.user_id) AS cohort_size,
  count(DISTINCT a.user_id) AS next_day_active
FROM cohort c
LEFT JOIN activity a
  ON a.user_id = c.user_id
 AND a.active_date = c.cohort_date + 1
GROUP BY c.cohort_date;`,
      explanation: "先固定用户同期群，再用活动日期左连接，分母不会被没有活动的人过滤掉。实际留存率还要除以 cohort_size。",
    },
    practiceSteps: [
      "明确留存分母、分子和活跃事件。",
      "分别计算次日和 7 日留存。",
      "按渠道比较留存并检查样本量。",
    ],
    masteryChecklist: [
      "能说明留存口径和同期群定义。",
      "能处理重复事件与有序漏斗。",
    ],
  },
  "data-quality": {
    overview: [
      "数据质量包括完整性、准确性、一致性、时效性和唯一性。问题不一定都需要删除，有些代表真实业务状态，有些则来自采集错误。",
      "清洗规则要可追溯：谁定义了规则、影响哪些行、如何处理、处理后指标变化多少。",
    ],
    mechanism: [
      "缺失值可能是未知、未发生或不适用，删除、填充、保留 NULL 和建模插补分别对应不同问题。",
      "重复记录要按业务唯一键判断，不能只看整行一致；有时同一用户多次事件是合法的。",
    ],
    example: {
      title: "先量化缺失再决定处理",
      language: "sql",
      code: `SELECT
  count(*) AS total_rows,
  count(*) FILTER (WHERE amount IS NULL) AS missing_amount,
  count(*) FILTER (WHERE user_id IS NULL) AS missing_user,
  count(DISTINCT order_id) AS unique_orders,
  count(*) - count(DISTINCT order_id) AS duplicate_orders
FROM raw_orders;`,
      explanation: "查询先量化缺失和重复的规模，再决定清洗策略。若缺失集中在某个渠道，还可以按渠道继续分组比较。",
    },
    practiceSteps: [
      "为每个字段定义可接受的缺失范围。",
      "按渠道和日期检查缺失是否集中。",
      "记录清洗前后行数、金额和分组占比。",
    ],
    masteryChecklist: [
      "能区分不同缺失语义并选择处理策略。",
      "能为清洗规则提供影响范围证据。",
    ],
  },
  "data-exploration": {
    overview: [
      "探索性分析先看分布、样本量和异常，再看均值。均值会被极端值拉动，中位数和分位数更接近典型值。",
      "相关不等于因果，散点图和相关指标只能提示关系。探索阶段的目标是提出更好的问题和检查数据，而不是提前下结论。",
    ],
    mechanism: [
      "箱线图、直方图和分位数帮助看出长尾、双峰和分组差异；时间序列要检查趋势、季节和缺失日期。",
      "异常值可能来自输入错误、系统事件或真实高价值样本，处理前应回到业务和原始记录。",
    ],
    example: {
      title: "比较样本量、中位数和 P90",
      language: "sql",
      code: `SELECT
  channel,
  count(*) AS samples,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY amount) AS median,
  percentile_cont(0.9) WITHIN GROUP (ORDER BY amount) AS p90
FROM orders
GROUP BY channel
ORDER BY median DESC;`,
      explanation: "同一张表同时展示样本量、中位数和高分位，避免小样本或长尾造成误导。异常渠道再回到明细检查。",
    },
    practiceSteps: [
      "为每个分组统计样本量、中位数和 P90。",
      "画出一个分布图并写出两个可能解释。",
      "检查异常值是错误、事件还是真实长尾。",
    ],
    masteryChecklist: [
      "能解释均值、中位数和分位数的适用差异。",
      "能避免把相关性直接表达为因果关系。",
    ],
  },
  "data-experiment": {
    overview: [
      "实验通过随机分配和对照比较策略效果。指标必须在实验前定义，包含主指标、护栏指标、样本单位和停止规则。",
      "统计显著不等于业务重要，选择偏差、样本污染、多重比较和短期效应都会影响结论。",
    ],
    mechanism: [
      "对照组提供反事实基线，实验组接受新策略；随机化让已知和未知混杂因素在组间近似平衡。",
      "指标变化要检查分布而不是只看平均，还要看不同用户群和长期影响。",
    ],
    example: {
      title: "实验方案最小字段",
      language: "yaml",
      code: `experiment: course-practice-reminder
unit: user_id
assignment: random-hash
primary_metric: 7_day_practice_rate
guardrails:
  - notification_opt_out_rate
  - app_crash_rate
window: 14_days
stop_rule: sequential_test_with_min_sample`,
      explanation: "方案明确分析单位、随机方式、主指标、护栏和停止规则。任何指标口径变化都应在实验前记录。",
    },
    practiceSteps: [
      "为一个新功能写主指标和两个护栏指标。",
      "定义样本单位和随机化方式。",
      "检查实验组和对照组的基线分布是否接近。",
    ],
    masteryChecklist: [
      "能说明实验为什么需要对照和随机分配。",
      "能从统计、业务和偏差三层解释结果。",
    ],
  },
  "data-chart-choice": {
    overview: [
      "图型选择由问题结构决定：比较类别看长度，观察趋势看时间位置，构成看整体部分关系，分布看形态，关系看两个变量的共同变化。",
      "图表的目标是降低理解成本，不是增加装饰。坐标轴、排序、标签、单位和基准线会直接影响结论。",
    ],
    mechanism: [
      "人眼比较长度的准确度高于比较面积或角度，所以类别比较通常用条形图而不是饼图。",
      "时间序列应保持等间隔和完整刻度；分类过多时先排序或分组，避免颜色和标签互相干扰。",
    ],
    example: {
      title: "比较问题对应图形",
      language: "text",
      code: `问题：哪个渠道转化率最高？
图形：横向条形图，按转化率降序

问题：注册到首单在哪一步流失？
图形：漏斗图或分步条形图

问题：消费金额是否存在双峰？
图形：直方图 + 分组中位数`,
      explanation: "先写问题，再选图形。每个图形都保留统一口径、样本量和标题说明。",
    },
    practiceSteps: [
      "为五个业务问题写出图型和为什么。",
      "把一张饼图改成条形图并比较可读性。",
      "检查每张图的坐标轴和基准线是否诚实。",
    ],
    masteryChecklist: [
      "能把问题结构与图形编码对应起来。",
      "能识别截断、双轴和面积误导。",
    ],
  },
  "data-dashboard": {
    overview: [
      "仪表板围绕决策路径组织：先看总体状态，再看异常和原因，最后提供行动入口。指标越多不等于信息越充分。",
      "同一指标必须有唯一口径、刷新时间和权限范围。筛选器要说明作用范围，避免用户误以为只影响部分页面。",
    ],
    mechanism: [
      "信息层级通常从左上开始，关键指标突出，辅助指标按需展开；颜色只用于表达状态或分组，不承担无意义装饰。",
      "刷新失败、权限过滤和数据延迟都会影响仪表板可信度，运营页面应展示数据截止时间和异常提示。",
    ],
    example: {
      title: "一页运营仪表板的信息架构",
      language: "text",
      code: `第一层：今日练习人数、完成率、异常率
第二层：趋势、渠道对比、异常原因
第三层：待复练用户、推荐岗位、行动按钮
全局：日期范围、课程范围、数据更新时间`,
      explanation: "页面从状态到原因再到行动逐层展开，全局筛选和数据新鲜度不会被藏在角落。",
    },
    practiceSteps: [
      "写出一页仪表板的三个决策问题和对应指标。",
      "为每个指标注明口径、来源和更新时间。",
      "从手机宽度检查布局是否仍能扫描。",
    ],
    masteryChecklist: [
      "能按决策路径组织指标层级。",
      "能说明筛选、刷新和权限的边界。",
    ],
  },
  "data-story": {
    overview: [
      "分析叙事由结论、证据、限制和建议组成。结论应直接回答业务问题，证据要可追溯，限制要说明结论不能延伸到哪里。",
      "建议必须指向具体动作、负责人、预期影响和验证方式。没有行动入口的报告只是在展示数据。",
    ],
    mechanism: [
      "先给结论再给方法适合决策者快速理解；附录保留数据来源、口径、处理步骤和复现命令。",
      "不同受众需要不同层次：业务方关注行动和影响，分析师关注口径和可复现性，工程方关注数据链路和稳定性。",
    ],
    example: {
      title: "五页汇报结构",
      language: "text",
      code: `1. 结论：练习提醒使 7 日复练率提升 X%
2. 证据：实验对照、样本量和趋势
3. 限制：仅覆盖主动开启通知的用户
4. 风险：通知退出率和长期疲劳
5. 行动：分阶段扩量、监控护栏、两周复盘`,
      explanation: "先讲结论，再补证据和边界，最后给出可执行动作。限制和风险不会被隐藏，便于决策者判断是否行动。",
    },
    practiceSteps: [
      "把一次分析压缩成一页结论和三条证据。",
      "写出至少两个限制条件。",
      "为建议补充负责人和验证指标。",
    ],
    masteryChecklist: [
      "结论强度不超过数据支持范围。",
      "建议包含动作、负责人、影响和验证方式。",
    ],
  },
};
