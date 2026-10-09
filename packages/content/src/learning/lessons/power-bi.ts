import type { LearningTopicLesson } from "../types";

export const powerBiTopicLessons: Record<string, LearningTopicLesson> = {
  "powerbi-connect": {
    overview: [
      "Power BI 接入层决定数据从哪里来、多久刷新一次、查询在哪里执行。文件、数据库和 Web 数据源各有凭据、网络和刷新限制。",
      "Import 把数据载入模型，交互通常更快且支持完整 DAX；DirectQuery 把查询下推给源系统，新鲜度更高，但性能、并发和部分建模能力受源限制。",
    ],
    mechanism: [
      "连接器负责认证和数据读取，Power Query 负责转换，模型负责关系和指标。",
      "数据源凭据会在本地和服务端分别配置，发布后刷新失败常见原因是网关、权限或源地址变化。",
    ],
    example: {
      title: "选择连接模式的判断表",
      language: "text",
      code: `需要秒级新鲜度？ -> DirectQuery 或混合模式
数据量在模型中可控且交互重要？ -> Import
事实很大、维度较小？ -> 可评估混合模式
源系统查询昂贵或并发低？ -> 谨慎使用 DirectQuery`,
      explanation: "连接模式不是偏好，而是数据规模、新鲜度、源系统成本和 DAX 能力的权衡。",
    },
    practiceSteps: [
      "为一个订单数据集写出新鲜度、规模和查询成本。",
      "分别用 Import 和 DirectQuery 连接并比较刷新。",
      "记录一次凭据或网关失败的原因。",
    ],
    masteryChecklist: [
      "能解释 Import 与 DirectQuery 的核心取舍。",
      "能定位连接、凭据和刷新问题的边界。",
    ],
  },
  "powerbi-power-query": {
    overview: [
      "Power Query 记录数据转换步骤，每一步应可命名、可复查。类型、字段名、列顺序和空值处理在进入模型前应稳定。",
      "合并、追加、透视和分组改变数据形状。转换越靠近源执行，越可能折叠为源查询；复杂自定义函数会降低折叠能力。",
    ],
    mechanism: [
      "Applied Steps 是依赖链，修改早期步骤会影响后续；删除步骤不会自动回滚模型关系或 DAX。",
      "查询折叠把支持的转换翻译为 SQL 等源操作，减少本地加载；无法折叠的步骤可能拉取大量明细。",
    ],
    example: {
      title: "锁定字段名、类型和过滤范围",
      language: "text",
      code: `步骤 1：Source = Orders
步骤 2：ChangedType = 金额 decimal、日期 date、状态 text
步骤 3：FilteredRows = 状态 <> "测试"
步骤 4：RenamedColumns = order_id -> OrderId
步骤 5：RemovedColumns = 删除内部审计字段`,
      explanation: "步骤按连接、类型、过滤、命名和裁剪排列。每一步名称描述结果，便于定位刷新失败和审计转换。",
    },
    practiceSteps: [
      "为每个步骤命名并写出输入输出。",
      "查看查询计划，确认过滤是否能折叠。",
      "故意改变源字段类型，观察错误在哪一步出现。",
    ],
    masteryChecklist: [
      "能说明 Power Query 步骤的依赖和可维护性。",
      "能判断查询折叠是否可能。",
    ],
  },
  "powerbi-parameters": {
    overview: [
      "参数让连接信息和业务范围可配置，函数让重复转换可复用。模板查询适合跨环境复制，但必须限制参数类型和默认值。",
      "参数不应保存明文密钥，凭据通过 Power BI 凭据管理器或网关安全配置。错误参数会让刷新失败或加载错误环境。",
    ],
    mechanism: [
      "Power Query 函数接收参数并返回查询结果，调用方只提供输入；参数值可在数据源设置或部署流程中替换。",
      "环境参数通常区分开发、测试和生产，但模型发布后要检查参数绑定，避免生产指向测试源。",
    ],
    example: {
      title: "环境参数和路径函数",
      language: "powerquery",
      code: `Environment = "production"

SourcePath = if Environment = "production"
    then "https://api.example.com/orders"
    else "https://staging-api.example.com/orders"

Orders = Json.Document(Web.Contents(SourcePath))`,
      explanation: "环境和路径集中在一个参数查询中，模型查询只引用 SourcePath。切换环境时不应散落修改多个查询。",
    },
    practiceSteps: [
      "把硬编码日期范围改成参数。",
      "创建一个提取订单的函数并用两个输入调用。",
      "检查发布后参数是否仍指向正确环境。",
    ],
    masteryChecklist: [
      "能判断哪些配置适合参数化。",
      "能避免把敏感凭据写进查询。",
    ],
  },
  "powerbi-star-schema": {
    overview: [
      "星型模型由事实表和一个或多个维度表组成。事实表记录事件或快照及其度量值，维度表描述业务对象和属性。",
      "代理键是模型内部的稳定键，业务键用于追踪来源。事实粒度在同一张表中必须一致，否则聚合和关系都会产生歧义。",
    ],
    mechanism: [
      "事实表通常包含外键、日期、增量和可加数值；维度表包含键和描述属性，不应把大量重复文本放入事实表。",
      "快照事实和事务事实粒度不同，不能直接混在一张表求和；需要统一粒度或建立独立事实表。",
    ],
    example: {
      title: "订单事实与日期维度",
      language: "text",
      code: `FactOrder
- DateKey
- CustomerKey
- ProductKey
- Quantity
- Revenue

DimDate
- DateKey
- Date
- Year
- Month
- IsWorkday`,
      explanation: "订单事实只保存订单行粒度和外键，日期属性放在日期维度。筛选日期时关系把条件传播到事实表。",
    },
    practiceSteps: [
      "写出事实表和维度表的粒度与主键。",
      "把一个宽表拆成事实和两个维度。",
      "检查事实表中的数值是否可在同粒度下相加。",
    ],
    masteryChecklist: [
      "能区分事实、维度、代理键和业务键。",
      "能解释事实粒度不一致造成的风险。",
    ],
  },
  "powerbi-relationships": {
    overview: [
      "关系定义筛选如何从维度传播到事实，以及两张表如何按键对应。最常见是一对多，多对多需要桥接或明确业务映射。",
      "双向筛选会扩大传播路径，可能引入循环和歧义。只有明确需要从事实反查维度或实现特定多对多时才使用。",
    ],
    mechanism: [
      "关系基数决定匹配范围和可选筛选方向；无效关系可能来自键类型不同、重复值或空值。",
      "传播路径应尽量从维度到事实单向流动，多个事实共享同一维度可避免筛选歧义。",
    ],
    example: {
      title: "先验证键再建立关系",
      language: "text",
      code: `DimProduct[ProductKey] 唯一 -> 1
FactSales[ProductKey] 可重复 -> *

关系：DimProduct[ProductKey] 1 -> * FactSales[ProductKey]
筛选方向：单向下游
空键：先检查并映射到 Unknown 维度`,
      explanation: "一对多关系只有在维度键唯一、事实键可重复时成立。空键提前处理，避免无匹配数据静默消失。",
    },
    practiceSteps: [
      "统计关系两侧键的唯一性和空值。",
      "用关系视图检查筛选传播。",
      "把双向筛选改为单向，比较指标变化。",
    ],
    masteryChecklist: [
      "能解释基数、筛选方向和歧义。",
      "能设计避免循环传播的关系。",
    ],
  },
  "powerbi-date-table": {
    overview: [
      "日期表必须覆盖所有事实日期，连续且每年完整，并被标记为日期表。它应独立于事实表，通过 DateKey 或日期列关联。",
      "时间智能函数依赖日期关系和当前筛选上下文。缺日期、重复日期或多个日期关系都会让同比和累计结果不可靠。",
    ],
    mechanism: [
      "日期维度提供 Year、Month、Day 和层次，事实表提供事件日期；关系把筛选从日期表传播到事实表。",
      "`CALENDAR` 或 `CALENDARAUTO` 可以生成连续日期，`MARK AS DATE TABLE` 告知模型哪些列是有效日期。",
    ],
    example: {
      title: "创建连续日期表",
      language: "dax",
      code: `DimDate =
ADDCOLUMNS(
    CALENDAR(DATE(2024, 1, 1), DATE(2026, 12, 31)),
    "Year", YEAR([Date]),
    "Month", FORMAT([Date], "YYYY-MM"),
    "YearMonth", YEAR([Date]) * 100 + MONTH([Date])
)`,
      explanation: "日期表覆盖报告所需年份并包含稳定排序字段。创建后在模型标记为日期表，并只保留一个活动日期关系。",
    },
    practiceSteps: [
      "验证日期表无缺口、无重复且覆盖事实范围。",
      "标记日期表并设置日期列。",
      "比较一个缺失月份前后的累计指标。",
    ],
    masteryChecklist: [
      "能解释日期表为什么必须连续。",
      "能定位时间智能失效的日期关系原因。",
    ],
  },
  "powerbi-dax-basics": {
    overview: [
      "DAX 有两类核心上下文：行上下文在计算列和迭代函数中逐行存在，筛选上下文决定度量值看到哪些行。",
      "计算列在刷新时物化并增加模型大小，度量值在查询时计算并随筛选变化。优先使用度量值表达业务指标。",
    ],
    mechanism: [
      "度量值在单元格筛选上下文中聚合，`SUM`、`COUNT`、`DISTINCTCOUNT` 等函数基于当前可见行。",
      "迭代函数如 SUMX 会逐行计算表达式再聚合，适合需要行级乘法或条件计算的场景。",
    ],
    example: {
      title: "用度量值计算收入与订单数",
      language: "dax",
      code: `Revenue = SUM(FactSales[Revenue])

Orders = DISTINCTCOUNT(FactSales[OrderId])

AverageOrderValue =
DIVIDE([Revenue], [Orders])`,
      explanation: "收入和订单数是基础度量值，平均客单价通过 `DIVIDE` 复用它们并自动处理除零。筛选条件变化时三个结果会一致变化。",
    },
    practiceSteps: [
      "为一个指标写出基础聚合和筛选条件。",
      "用 SUMX 计算数量乘单价。",
      "比较计算列和度量值在模型中大小与行为。",
    ],
    masteryChecklist: [
      "能区分行上下文和筛选上下文。",
      "能解释计算列与度量值的成本差异。",
    ],
  },
  "powerbi-calculate": {
    overview: [
      "CALCULATE 在现有筛选上下文上评估表达式，并可用筛选器参数修改上下文。它是占比、同比、目标和条件指标的核心。",
      "ALL 和 REMOVEFILTERS 可移除筛选，KEEPFILTERS 保留与新筛选的交集。修改上下文必须能对应业务问题。",
    ],
    mechanism: [
      "CALCULATE 会触发上下文转换，把行上下文转为筛选上下文；筛选器参数按列筛选表。",
      "变量在声明时计算并保存值，可以避免重复表达式和在错误上下文中重新求值。",
    ],
    example: {
      title: "计算地区收入占比",
      language: "dax",
      code: `RegionalShare =
VAR CurrentRevenue = [Revenue]
VAR AllRevenue =
    CALCULATE([Revenue], REMOVEFILTERS(DimRegion))
RETURN
    DIVIDE(CurrentRevenue, AllRevenue)`,
      explanation: "变量保存当前地区收入，CALCULATE 移除地区筛选得到全量收入，再计算占比。业务口径是“占全部地区收入的比例”。",
    },
    practiceSteps: [
      "在一个具体地区和月份手工计算占比分子分母。",
      "把 KEEPFILTERS 加入筛选参数比较结果。",
      "为指标写一行业务口径说明。",
    ],
    masteryChecklist: [
      "能说明 CALCULATE 修改了什么上下文。",
      "能正确选择 REMOVEFILTERS 与 KEEPFILTERS。",
    ],
  },
  "powerbi-time-intelligence": {
    overview: [
      "时间智能函数使用日期表和当前筛选生成同比、环比、累计和移动平均。正确日期关系是前提，指标可比性还依赖时间窗口。",
      "累计指标要处理年初和月末边界，移动平均要处理前几个不完整窗口。指标应明确是自然年、财政年还是滚动周期。",
    ],
    mechanism: [
      "`SAMEPERIODLASTYEAR`、`DATEADD`、`DATESYTD` 等函数返回日期表集合，CALCULATE 再用该集合筛选事实。",
      "同比和环比必须确保比较窗口长度一致，缺失日期或不同季节需要单独解释。",
    ],
    example: {
      title: "同比收入与年初累计",
      language: "dax",
      code: `Revenue YoY =
CALCULATE([Revenue], SAMEPERIODLASTYEAR(DimDate[Date]))

Revenue Growth % =
DIVIDE([Revenue] - [Revenue YoY], [Revenue YoY])

Revenue YTD =
TOTALYTD([Revenue], DimDate[Date])`,
      explanation: "先定义去年同期集合，再复用同比度量值计算增长率。YTD 依赖连续日期表并随着当前日期上下文变化。",
    },
    practiceSteps: [
      "选取一个月份手工核对去年同期收入。",
      "检查首月和第二月的 YTD 结果。",
      "比较自然年与财政年开始日期的差异。",
    ],
    masteryChecklist: [
      "能解释时间智能函数依赖的日期关系。",
      "能说明窗口不一致导致的可比性问题。",
    ],
  },
  "powerbi-report-design": {
    overview: [
      "报表设计从读者和决策开始。页面应有状态、原因和行动层级，关键指标在首要视觉区域，次要细节按需展开。",
      "书签、钻取、工具提示和筛选器要提供清晰上下文与返回路径。可访问性还包括颜色对比、键盘顺序和替代文本。",
    ],
    mechanism: [
      "视觉对象通过选择、筛选和交叉高亮互相作用，过强的交互会让读者失去全局状态。",
      "钻取分为页面钻取和层级钻取，必须显示当前上下文并提供返回按钮；工具提示只能补充信息，不能承载核心答案。",
    ],
    example: {
      title: "页面信息层级",
      language: "text",
      code: `顶部：日期、业务线、数据截止时间
主体左侧：收入、订单、转化率
主体右侧：趋势与异常原因
底部：明细钻取和行动入口`,
      explanation: "筛选范围在顶部，核心指标和原因在中部，明细与行动在底部。读者按从概览到细节的路径浏览。",
    },
    practiceSteps: [
      "画出页面的三层信息结构。",
      "为每个钻取添加清晰的返回操作。",
      "检查浅深色、色盲和键盘操作。",
    ],
    masteryChecklist: [
      "能说明页面视觉层级与决策顺序。",
      "能设计可返回、可解释的交互。",
    ],
  },
  "powerbi-analytics": {
    overview: [
      "分组、聚类、异常检测、AI 视觉对象和 What-if 参数是把分析能力嵌入报表的方式。只有服务具体决策时才有价值。",
      "高级视觉对象的输出仍是统计提示，需要业务解释和限制说明。What-if 参数适合探索假设，但不会自动改变数据源。",
    ],
    mechanism: [
      "What-if 参数生成一个可交互的值表，通过度量值读取参数并在计算中应用；它适合折扣、价格和目标模拟。",
      "异常检测通常结合时间序列、季节和置信区间，异常不等于错误，必须回到事件和业务上下文。",
    ],
    example: {
      title: "价格调整 What-if 参数",
      language: "dax",
      code: `Price Adjustment = GENERATESERIES(-0.2, 0.2, 0.05)

Adjusted Revenue =
SUMX(
    FactSales,
    FactSales[Quantity] *
    FactSales[UnitPrice] *
    (1 + SELECTEDVALUE('Price Adjustment'[Value], 0))
)`,
      explanation: "参数提供 -20% 到 +20% 的调整范围，度量值按当前选择计算模拟收入。实际决策还要考虑需求变化和成本。",
    },
    practiceSteps: [
      "为一个折扣参数设置范围和步长。",
      "让度量值读取参数并验证 0 值结果。",
      "写出模拟结果的业务限制。",
    ],
    masteryChecklist: [
      "能解释 What-if 参数的输入、计算和限制。",
      "能把异常检测结果转化为业务调查问题。",
    ],
  },
  "powerbi-security-service": {
    overview: [
      "RLS 在模型层限制用户可见数据，工作区负责协作发布，网关负责本地数据源访问，刷新负责保持数据新鲜。",
      "权限不能只靠前端隐藏视觉对象，必须在模型和数据源执行。发布后还要监控刷新、网关、容量和敏感标签。",
    ],
    mechanism: [
      "RLS 角色通过 DAX 筛选表，用户或安全组被分配到角色；动态 RLS 可以基于用户身份过滤。",
      "网关连接本地源并提供凭据，刷新失败可能来自网关离线、凭据过期、查询超时或源结构变化。",
    ],
    example: {
      title: "按用户所在地区做动态 RLS",
      language: "dax",
      code: `[Region] =
LOOKUPVALUE(
    UserSecurity[Region],
    UserSecurity[Email],
    USERPRINCIPALNAME()
)`,
      explanation: "用户的 UPN 映射到安全表中的地区，模型按地区筛选。发布后必须用测试账号验证无法越权查看。",
    },
    practiceSteps: [
      "创建一个测试地区角色并用两个账号验证。",
      "检查网关状态、凭据和刷新历史。",
      "为敏感报表添加敏感度标签和访问复核。",
    ],
    masteryChecklist: [
      "能说明 RLS 必须在模型或源层执行。",
      "能按凭据、网关和查询定位刷新失败。",
    ],
  },
};
