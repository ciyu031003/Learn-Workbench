import type { LearningDifficulty, LearningQuestion, LearningLevel } from "./types";
const OPTION_KEYS = ["A","B","C","D"] as const;
function singleQuestion(input:{key:string;stageKey:string;topicKey:string;stem:string;options:[string,string,string,string];answer:"A"|"B"|"C"|"D";explanation:string;difficulty:LearningDifficulty;tags:string[];sourceKey:string;level:LearningLevel;}):LearningQuestion{
  return {key:input.key,stageKey:input.stageKey,topicKey:input.topicKey,type:"single",stem:input.stem,options:input.options.map((t,i)=>({key:OPTION_KEYS[i],text:t})),answer:[input.answer],explanation:input.explanation,difficulty:input.difficulty,tags:input.tags,sourceKey:input.sourceKey,level:input.level};
}
function judgeQuestion(input:{key:string;stageKey:string;topicKey:string;stem:string;answer:boolean;explanation:string;difficulty:LearningDifficulty;tags:string[];sourceKey:string;level:LearningLevel;}):LearningQuestion{
  return {key:input.key,stageKey:input.stageKey,topicKey:input.topicKey,type:"judge",stem:input.stem,options:[{key:"A",text:"正确"},{key:"B",text:"错误"}],answer:[input.answer?"A":"B"],explanation:input.explanation,difficulty:input.difficulty,tags:input.tags,sourceKey:input.sourceKey,level:input.level};
}
export const powerbiSupplementQuestions: LearningQuestion[] = [
  // ----- powerbi-connect (powerbi-ingest) -----
  singleQuestion({
    key: "power-bi-sup-powerbi-connect-s1",
    stageKey: "powerbi-ingest",
    topicKey: "powerbi-connect",
    stem: "关于 Power BI 的数据连接模式，以下说法正确的是？",
    options: [
      "导入模式会把数据压缩后存入 Power BI 的数据集，查询时不依赖源系统",
      "DirectQuery 模式会把全部数据复制到 Power BI 数据集",
      "实时连接（Live Connection）不支持在 Power BI 中建模",
      "复合模型不允许同一报表同时使用导入和 DirectQuery"
    ],
    answer: "A",
    explanation: "导入模式在首次刷新时把数据从源系统抽取、压缩并存储到 Power BI 数据集的内存中（VertiPaq 引擎），之后所有可视化查询都直接读取本地模型，不再访问源系统，因此性能高但数据并非实时。DirectQuery 不复制数据，查询时实时发往源。实时连接把模型建在外部（如 Analysis Services），Power BI 只做展示。复合模型正是为混合导入与 DirectQuery 而设计。",
    difficulty: "medium",
    tags: ["连接模式","导入模式","DirectQuery"],
    sourceKey: "pl300",
    level: "进阶"
  }),
  judgeQuestion({
    key: "power-bi-sup-powerbi-connect-j1",
    stageKey: "powerbi-ingest",
    topicKey: "powerbi-connect",
    stem: "在导入模式下，报表每次交互刷新可视化时都会实时向源数据库发起查询。",
    answer: false,
    explanation: "导入模式的数据在刷新时已经加载并压缩存储到 Power BI 数据集的内存中，之后的所有可视化和切片交互都直接查询本地内存模型，不会再访问源系统，因此响应快且不占用源系统资源；只有手动或计划刷新才会重新连接源并更新数据。",
    difficulty: "easy",
    tags: ["导入模式","刷新"],
    sourceKey: "powerbi-samples",
    level: "入门"
  }),
  // ----- powerbi-power-query (powerbi-ingest) -----
  singleQuestion({
    key: "power-bi-sup-powerbi-power-query-s1",
    stageKey: "powerbi-ingest",
    topicKey: "powerbi-power-query",
    stem: "在 Power Query 编辑器中，以下哪种操作属于'转换'而非'添加列'？",
    options: [
      "用'拆分列'根据分隔符把一列拆成多列",
      "用'条件列'基于现有列计算生成新列",
      "用'自定义列'编写 M 公式得到新列",
      "用'索引列'添加从 1 开始的序号列"
    ],
    answer: "A",
    explanation: "'拆分列'作用于已有列，把一列按分隔符、字符数或位置拆分为多列，属于对现有数据的转换，位于'转换'选项卡。而条件列、自定义列、索引列都是生成新列，属于'添加列'选项卡。Power Query 的步骤会按应用顺序记录在'应用的步骤'中，可随时调整或删除。",
    difficulty: "medium",
    tags: ["Power Query","转换","步骤"],
    sourceKey: "pl300",
    level: "进阶"
  }),
  judgeQuestion({
    key: "power-bi-sup-powerbi-power-query-j1",
    stageKey: "powerbi-ingest",
    topicKey: "powerbi-power-query",
    stem: "Power Query 中每一步转换都会生成一个新的查询步骤，这些步骤按执行顺序记录且可重新排序或删除。",
    answer: true,
    explanation: "Power Query 采用函数式、不可变的查询架构，每一次转换（如更改类型、筛选行、合并查询）都会以 M 语言步骤的形式追加到'应用的步骤'列表中。步骤按从上到下的顺序依次应用到数据，用户可以右键删除、上移下移或重命名步骤，所有修改会即时重新计算，保证结果可复现。",
    difficulty: "easy",
    tags: ["Power Query","步骤"],
    sourceKey: "powerbi-samples",
    level: "入门"
  }),
  // ----- powerbi-parameters (powerbi-ingest) -----
  singleQuestion({
    key: "power-bi-sup-powerbi-parameters-s1",
    stageKey: "powerbi-ingest",
    topicKey: "powerbi-parameters",
    stem: "关于 Power Query 参数，以下说法正确的是？",
    options: [
      "参数只能存放文本和数字，不能用于动态改变数据源路径",
      "参数可以在 Power Query 中定义，并在查询引用它，从而实现一处修改、多处生效",
      "参数必须每次手动输入，无法与'选择函数'绑定下拉列表",
      "参数仅在报表视图可见，无法在 Power Query 中使用"
    ],
    answer: "B",
    explanation: "Power Query 的'管理参数'可以定义一个参数（文本、数字、日期、逻辑值等），并在查询的 M 公式、数据源路径、筛选条件中引用该参数。修改参数值后，所有引用它的查询都会随之更新，实现可复用查询和动态数据源。参数还可以与'选择函数'或列表绑定，提供下拉选择，便于在 Power BI Service 中设定新取值。",
    difficulty: "medium",
    tags: ["参数","可复用查询"],
    sourceKey: "pl300",
    level: "进阶"
  }),
  judgeQuestion({
    key: "power-bi-sup-powerbi-parameters-j1",
    stageKey: "powerbi-ingest",
    topicKey: "powerbi-parameters",
    stem: "使用 Power Query 参数可以把数据库服务器地址、文件路径等做成可配置项，从而实现查询的复用与动态切换。",
    answer: true,
    explanation: "参数将经常变化的连接信息（服务器名、数据库、文件路径、筛选日期等）抽象为单一可配置值。查询通过引用参数来获取这些值，当环境切换或需要改变筛选范围时，只需修改参数，无需逐个改写每个查询，显著提升可维护性与可移植性。",
    difficulty: "easy",
    tags: ["参数","动态数据源"],
    sourceKey: "powerbi-samples",
    level: "入门"
  }),
  // ----- powerbi-model (powerbi-ingest) -----
  singleQuestion({
    key: "power-bi-sup-powerbi-model-s1",
    stageKey: "powerbi-model", topicKey: "powerbi-star-schema",
    stem: "在 Power BI 中，关于语义模型（数据模型），以下说法正确的是？",
    options: [
      "语义模型只是原始数据的简单复制，没有任何结构",
      "语义模型定义了表、列、度量值、关系以及业务术语，是报表分析的统一基础",
      "一个 Power BI 报表只能使用 Excel 文件作为唯一数据源",
      "语义模型无法在多个报表之间共享复用"
    ],
    answer: "B",
    explanation: "语义模型（原'数据集'）是 Power BI 的核心，它把来自多个数据源的表、列、层次结构、计算列、度量值以及表间关系组织成面向业务的统一数据视图，并定义清晰的名称与术语。基于同一语义模型可以构建多个报表，并可在 Power BI Service 中集中管理与权限控制，实现'一次建模、多处复用'。",
    difficulty: "easy",
    tags: ["语义模型","数据建模"],
    sourceKey: "pl300",
    level: "入门"
  }),
  judgeQuestion({
    key: "power-bi-sup-powerbi-model-j1",
    stageKey: "powerbi-model", topicKey: "powerbi-star-schema",
    stem: "在 Power BI Service 中，同一个语义模型可以被多个不同报表共享使用，从而实现统一的指标口径。",
    answer: true,
    explanation: "语义模型支持'共享数据集'模式：一份模型发布到 Power BI Service 后，多个报表 (.pbix) 可以基于该语义模型建立实时连接。这样所有报表使用相同的表、关系和度量值定义，保证关键业务指标计算口径一致，也减少了重复建模和维护成本。",
    difficulty: "easy",
    tags: ["语义模型","共享数据集"],
    sourceKey: "powerbi-samples",
    level: "入门"
  }),
  // ----- powerbi-star-schema (powerbi-ingest) -----
  singleQuestion({
    key: "power-bi-sup-powerbi-star-schema-s1",
    stageKey: "powerbi-model", topicKey: "powerbi-star-schema",
    stem: "关于星型模式（Star Schema），以下说法正确的是？",
    options: [
      "星型模式用一个庞大的宽表代替所有维度，以避免使用关系",
      "星型模式由一张事实表连接多个维度表组成，维度表围绕事实表呈星形分布",
      "维度表应当与事实表一样包含大量业务交易明细",
      "星型模型不支持对数据进行多维度分析"
    ],
    answer: "B",
    explanation: "星型模式是数据仓库建模的经典方法：中心是一张事实表（存储可度量的业务事件，如销售金额、数量，并通过外键关联维度），周围是多个维度表（描述业务角度，如时间、产品、客户、地区）。表间通过关系连接形成星形结构。它既减少了冗余又支持灵活的多维分析，是 Power BI 性能最佳的实践模型。",
    difficulty: "medium",
    tags: ["星型模型","事实表","维度表"],
    sourceKey: "pl300",
    level: "进阶"
  }),
  judgeQuestion({
    key: "power-bi-sup-powerbi-star-schema-j1",
    stageKey: "powerbi-model", topicKey: "powerbi-star-schema",
    stem: "在星型模型中，事实表的粒度应当被明确确定，粒度指的是事实表中每一行所代表的业务含义（如每笔订单每行商品）。",
    answer: true,
    explanation: "粒度（granularity）定义了事实表一行记录的具体业务事件级别。明确粒度（例如'每个订单的每一件商品一行'）是建模的第一步，它决定了维度如何关联以及度量值如何聚合。粒度过粗会丢失分析细节，过细则导致数据膨胀与重复计算，必须在建模初期就清晰定义。",
    difficulty: "medium",
    tags: ["星型模型","粒度"],
    sourceKey: "powerbi-samples",
    level: "进阶"
  }),
  // ----- powerbi-relationships (powerbi-ingest) -----
  singleQuestion({
    key: "power-bi-sup-powerbi-relationships-s1",
    stageKey: "powerbi-model", topicKey: "powerbi-relationships",
    stem: "关于 Power BI 中表间关系的筛选传播方向，以下说法正确的是？",
    options: [
      "所有关系都只能单向筛选，无法实现双向",
      "在星型模型中通常采用'单向'筛选（从维度到事实），以避免歧义循环",
      "双向筛选一定比单向筛选性能更好",
      "关系筛选方向不会影响度量值的计算结果"
    ],
    answer: "B",
    explanation: "关系默认是单向筛选（一端维度筛选多端事实）。在星型模型中推荐保持单向，因为双向筛选可能引发多对多歧义、Ambiguity 以及意外的上下文传播，还会拖慢计算。只有在必要时（如反向切片或特定桥接表）才启用双向，并且要小心避免出现循环依赖。",
    difficulty: "medium",
    tags: ["关系","筛选传播","双向筛选"],
    sourceKey: "pl300",
    level: "进阶"
  }),
  judgeQuestion({
    key: "power-bi-sup-powerbi-relationships-j1",
    stageKey: "powerbi-model", topicKey: "powerbi-relationships",
    stem: "把两个事实表通过维度表间接相连时，若对多条关系启用双向筛选，可能产生歧义循环并导致计算结果不可预期。",
    answer: true,
    explanation: "当模型中存在多条可能互相筛选的路径（例如两个事实表各自连到同一维度表，又启用双向筛选），Power BI 会形成循环筛选路径，造成'ambiguous paths'，使筛选上下文不确定、度量值结果随路径不同而变化。因此一般保持维度到事实的单向筛选，仅在明确必要时谨慎启用双向。",
    difficulty: "medium",
    tags: ["关系","双向筛选","歧义"],
    sourceKey: "powerbi-samples",
    level: "进阶"
  }),
  // ----- powerbi-date-table (powerbi-ingest) -----
  singleQuestion({
    key: "power-bi-sup-powerbi-date-table-s1",
    stageKey: "powerbi-model", topicKey: "powerbi-date-table",
    stem: "关于 Power BI 中的日期表（Date Table），以下说法正确的是？",
    options: [
      "只有事实表包含的日期才需要出现在日期表中，缺失日期无影响",
      "把一张连续的、无重复日期的表标记为日期表后，时间智能函数才能正确工作",
      "日期表必须由用户手动输入每一天的日期，不能用 DAX 生成",
      "标记日期表只是为了显示美观，对计算没有影响"
    ],
    answer: "B",
    explanation: "时间智能（如 YTD、同比）依赖连续且唯一的日期序列。把规范生成的日期表（包含模型涉及的全部日期范围、无重复、含年/季/月/周等列）标记为'日期表'后，Power BI 才会以它为时间基准，确保 DATEADD、SAMEPERIODLASTYEAR 等函数返回正确结果。日期表可用 CALENDAR 或 CALENDARAUTO 以 DAX 自动生成，无需手工录入。",
    difficulty: "medium",
    tags: ["日期表","时间智能"],
    sourceKey: "pl300",
    level: "进阶"
  }),
  judgeQuestion({
    key: "power-bi-sup-powerbi-date-table-j1",
    stageKey: "powerbi-model", topicKey: "powerbi-date-table",
    stem: "在 Power BI 中，若要让同比、环比、年初至今等时间智能计算正确，必须把一张连续唯一的日期表标记为日期表。",
    answer: true,
    explanation: "时间智能函数按固定的日期间隔对数据移位与聚合，要求日期轴完整连续且无重复。将规范日期表标记为日期表后，引擎会识别其日期列为时间基准，从而保证同比、环比、YTD/QTD/MTD 等计算得到准确结果；否则会因日期缺失或重复而导致结果错误或空白。",
    difficulty: "easy",
    tags: ["日期表","时间智能"],
    sourceKey: "powerbi-samples",
    level: "入门"
  }),
  // ----- powerbi-dax (powerbi-ingest) -----
  singleQuestion({
    key: "power-bi-sup-powerbi-dax-s1",
    stageKey: "powerbi-dax", topicKey: "powerbi-dax-basics",
    stem: "关于 DAX 中的筛选上下文，以下说法正确的是？",
    options: [
      "筛选上下文只由 DAX 公式本身决定，与报表中的切片器和行列无关",
      "筛选上下文由报表的切片器、行列标签、筛选器以及公式中的筛选函数共同构成，决定每行计算可见的数据",
      "度量值的计算结果在所有视觉对象中永远相同，不受筛选影响",
      "行上下文与筛选上下文是同一个概念"
    ],
    answer: "B",
    explanation: "筛选上下文是 DAX 计算时'当前可见的数据集合'，它由视觉对象中的切片器选择、行列标签、报表级/页面级/视觉级筛选器，以及 CALCULATE 等函数施加的筛选共同决定。度量值是在该上下文中动态聚合求值的，因此同一个度量值在不同切片条件下会返回不同结果。行上下文（迭代逐行）与筛选上下文是两个不同概念。",
    difficulty: "medium",
    tags: ["DAX","筛选上下文"],
    sourceKey: "pl300",
    level: "进阶"
  }),
  judgeQuestion({
    key: "power-bi-sup-powerbi-dax-j1",
    stageKey: "powerbi-dax", topicKey: "powerbi-dax-basics",
    stem: "DAX 的度量值在被切片器或行列筛选时，会基于当前的筛选上下文动态计算并返回不同结果。",
    answer: true,
    explanation: "度量值是动态计算的聚合表达式，不占用存储。每当视觉对象渲染时，引擎先确定当前筛选上下文（来自切片器、筛选器、行列），再把该上下文应用于度量值的底层表并求和/计数等。因此同一个度量值在不同筛选条件下结果不同，这正是 Power BI 交互分析的核心机制。",
    difficulty: "easy",
    tags: ["DAX","度量值","筛选上下文"],
    sourceKey: "powerbi-samples",
    level: "入门"
  }),
  // ----- powerbi-dax-basics (powerbi-ingest) -----
  singleQuestion({
    key: "power-bi-sup-powerbi-dax-basics-s1",
    stageKey: "powerbi-dax", topicKey: "powerbi-dax-basics",
    stem: "关于 DAX 中的行上下文（Row Context），以下说法正确的是？",
    options: [
      "行上下文只在计算列中存在，负责指示当前正在计算的单行",
      "行上下文由 CALCULATE 创建，用于筛选数据",
      "度量值默认在计算列中逐行计算",
      "行上下文会自动转换为筛选上下文，无需任何函数"
    ],
    answer: "A",
    explanation: "行上下文是迭代函数（如 SUMX、FILTER、计算列）逐行遍历表时生成的'当前行指针'，指示公式正在计算哪一行，使如 [单价]*[数量] 这样的逐行运算得以进行。它来自计算列或用 X 系列聚合函数。行上下文本身不会筛选数据，要变成筛选上下文需借助 CALCULATE（上下文转换），度量值默认没有行上下文。",
    difficulty: "medium",
    tags: ["DAX","行上下文"],
    sourceKey: "pl300",
    level: "进阶"
  }),
  judgeQuestion({
    key: "power-bi-sup-powerbi-dax-basics-j1",
    stageKey: "powerbi-dax", topicKey: "powerbi-dax-basics",
    stem: "计算列在模型刷新时按行上下文逐行计算并存储结果，而度量值在查询时基于筛选上下文动态计算。",
    answer: true,
    explanation: "计算列在数据集刷新时，利用行上下文对每一行求值，并像普通列一样把结果物化存储到磁盘，占用内存但查询快。度量值不存储，仅在视觉对象查询时根据当时的筛选上下文实时聚合计算。理解二者差异有助于正确选择存储计算还是动态计算，避免模型膨胀或性能问题。",
    difficulty: "medium",
    tags: ["DAX","计算列","度量值"],
    sourceKey: "powerbi-samples",
    level: "进阶"
  }),
  // ----- powerbi-calculate (powerbi-ingest) -----
  singleQuestion({
    key: "power-bi-sup-powerbi-calculate-s1",
    stageKey: "powerbi-dax", topicKey: "powerbi-calculate",
    stem: "关于 CALCULATE 函数，以下说法正确的是？",
    options: [
      "CALCULATE 只能改变度量值的显示格式，不能修改筛选",
      "CALCULATE 通过在新的筛选上下文中计算表达式，并触发上下文转换把行上下文变为筛选上下文",
      "CALCULATE 不能在度量值内部再调用其它度量值",
      "上下文转换是指把筛选上下文转换为行上下文"
    ],
    answer: "B",
    explanation: "CALCULATE 是 DAX 中最强大的函数，其语法为 CALCULATE(<表达式>, <筛选1>, ...)。它先应用参数中的筛选条件修改（或新增）筛选上下文，然后在该上下文中对表达式求值。当 CALCULATE 出现在拥有行上下文的环境（如计算列、SUMX）时，会执行'上下文转换'，把当前行上下文转成对等的筛选上下文，这是理解高级 DAX 的关键。",
    difficulty: "hard",
    tags: ["DAX","CALCULATE","上下文转换"],
    sourceKey: "pl300",
    level: "综合"
  }),
  judgeQuestion({
    key: "power-bi-sup-powerbi-calculate-j1",
    stageKey: "powerbi-dax", topicKey: "powerbi-calculate",
    stem: "在含有行上下文的环境（如计算列或迭代函数）中使用 CALCULATE，会触发'上下文转换'，把行上下文转换为筛选上下文。",
    answer: true,
    explanation: "上下文转换（context transition）是 CALCULATE 的核心行为：当它在行上下文（计算列或 SUMX/FILTER 等迭代函数内部）中被求值时，会先把当前行上下文'投影'为等效的筛选上下文，再套用自身筛选参数计算表达式。忽略这一机制常导致度量值在逐行场景中返回意料之外的结果，是 DAX 高级学习的重点。",
    difficulty: "medium",
    tags: ["DAX","CALCULATE","上下文转换"],
    sourceKey: "powerbi-samples",
    level: "进阶"
  }),
  // ----- powerbi-time-intelligence (powerbi-ingest) -----
  singleQuestion({
    key: "power-bi-sup-powerbi-time-intelligence-s1",
    stageKey: "powerbi-dax", topicKey: "powerbi-time-intelligence",
    stem: "要计算'去年同期'的销售额，以下 DAX 写法最合适的是？",
    options: [
      "SAMEPERIODLASTYEAR('Date'[Date]) 配合 CALCULATE 使用",
      "直接把年份减一的列相加",
      "EARLIER(SUM(Sales[Amount]))",
      "用 FILTER 删除所有今年数据"
    ],
    answer: "A",
    explanation: "时间智能函数 SAMEPERIODLASTYEAR 会基于已标记的日期表，返回与当前筛选上下文相同时间段的上一年对应日期区间，再配合 CALCULATE 在'去年同期'的筛选上下文中重新计算销售额度量值，即可轻松实现同比。它自动处理闰年与跨年边界，比手工拼接日期列更稳健准确。",
    difficulty: "medium",
    tags: ["DAX","时间智能","同比"],
    sourceKey: "pl300",
    level: "进阶"
  }),
  judgeQuestion({
    key: "power-bi-sup-powerbi-time-intelligence-j1",
    stageKey: "powerbi-dax", topicKey: "powerbi-time-intelligence",
    stem: "使用时间智能函数（如 DATEADD、SAMEPERIODLASTYEAR）实现同比环比时，必须基于已标记为日期表的连续日期列。",
    answer: true,
    explanation: "时间智能函数依赖连续、唯一的日期序列来按固定间隔平移或比较时间段。只有把规范的日期表标记为日期表，这些函数才能正确识别年/季/月层级并执行移位。若日期不连续或表未标记，函数会返回错误或空白，导致同比环比分析失败。",
    difficulty: "easy",
    tags: ["DAX","时间智能","日期表"],
    sourceKey: "powerbi-samples",
    level: "入门"
  }),
  // ----- powerbi-report (powerbi-model) -----
  singleQuestion({
    key: "power-bi-sup-powerbi-report-s1",
    stageKey: "powerbi-report", topicKey: "powerbi-report-design",
    stem: "关于 Power BI 报表的发布与刷新，以下说法正确的是？",
    options: [
      "报表发布到 Power BI Service 后无法配置自动刷新",
      "数据源网关（On-premises Data Gateway）用于让云端服务访问本地数据源以执行计划刷新",
      "发布报表时会把本地数据库密码一同上传到云端永久保存",
      "只有 Pro 用户无法把报表发布到工作区"
    ],
    answer: "B",
    explanation: "当语义模型的数据源位于本地（如本地 SQL Server、文件）时，需要在本地服务器安装并配置本地数据网关（On-premises Data Gateway），由它建立云端 Power BI Service 与本地数据源之间的安全通道，从而执行计划刷新。刷新凭据由网关加密保管，并不会以明文形式'上传密码'。Power BI Service 支持配置定时刷新（取决于许可证类型）。",
    difficulty: "medium",
    tags: ["发布","刷新","网关"],
    sourceKey: "pl300",
    level: "进阶"
  }),
  judgeQuestion({
    key: "power-bi-sup-powerbi-report-j1",
    stageKey: "powerbi-report", topicKey: "powerbi-report-design",
    stem: "将 Power BI 报表发布到云端后，可以配置计划刷新，使语义模型按设定周期自动从数据源更新数据。",
    answer: true,
    explanation: "发布到 Power BI Service 的语义模型可在工作区设置中配置计划刷新（如每天凌晨刷新），由服务在指定时间通过数据源凭据或网关连接源系统拉取最新数据。这保证了云端报表与业务系统数据保持同步，而无需人工每次手动刷新和重新上传。",
    difficulty: "easy",
    tags: ["发布","计划刷新"],
    sourceKey: "powerbi-samples",
    level: "入门"
  }),
  // ----- powerbi-report-design (powerbi-model) -----
  singleQuestion({
    key: "power-bi-sup-powerbi-report-design-s1",
    stageKey: "powerbi-report", topicKey: "powerbi-report-design",
    stem: "关于 Power BI 报表的交互设计，以下说法正确的是？",
    options: [
      "视觉对象之间的'编辑交互'只能设置为高亮，不能设置为筛选或不可见",
      "通过'编辑交互'可以设置点击一个视觉对象时对其它视觉对象进行筛选、高亮或不起作用",
      "书签（Bookmark）无法保存当前的筛选和视觉状态",
      "切片器只能基于日期字段，不能用于其它维度"
    ],
    answer: "B",
    explanation: "'编辑交互'（Format → Edit interactions）允许设计者定义当前视觉对象被点击或悬停时，对报表页上其它视觉对象产生的影响：可设为筛选（Filter）、高亮（Highlight）或不可见/无影响（None）。此外，书签能保存当前页面筛选、视觉选择与显示状态，切片器支持任意维度字段（文本、数字、日期等），用于灵活探索数据。",
    difficulty: "medium",
    tags: ["报表设计","交互","书签"],
    sourceKey: "pl300",
    level: "进阶"
  }),
  judgeQuestion({
    key: "power-bi-sup-powerbi-report-design-j1",
    stageKey: "powerbi-report", topicKey: "powerbi-report-design",
    stem: "通过'编辑交互'设置，可以让用户在点击某个图表时，对页面上其它视觉对象进行筛选、高亮或使其不受影响。",
    answer: true,
    explanation: "Power BI 默认的视觉交互是交叉筛选，但设计者可用'编辑交互'为每个视觉对象定制行为：对该视觉对象点击后，目标视觉可筛选、仅高亮或以无反应（None）呈现。配合书签和按钮，还能构建向导式、故事化的交互报表，显著提升用户体验与数据探索效率。",
    difficulty: "easy",
    tags: ["报表设计","交互"],
    sourceKey: "powerbi-samples",
    level: "入门"
  }),
  // ----- powerbi-analytics (powerbi-model) -----
  singleQuestion({
    key: "power-bi-sup-powerbi-analytics-s1",
    stageKey: "powerbi-report", topicKey: "powerbi-analytics",
    stem: "关于 Power BI 中的高级分析功能，以下说法正确的是？",
    options: [
      "快速洞察（Quick Insights）只能对单一列做描述统计，无法发现关系",
      "分解树（Decomposition Tree）可让用户按多个维度逐层向下钻取，定位数值变化的来源",
      "关键影响因素（Key Influencers）用于预测未来每一天的精确数值",
      "分析功能仅限 Python 脚本实现，DAX 无法参与"
    ],
    answer: "B",
    explanation: "分解树是一种人工智能驱动的可视化，用户可选择一个指标（如销售额），然后依次按任意维度（地区、产品、渠道）向下钻取，系统自动按影响力排序展示各层级贡献，帮助快速定位异常波动的根因。关键影响因素用于解释'什么因素驱动了某个结果'（分类/回归解释），而非精确逐日预测；Quick Insights 能自动发现相关性与异常。",
    difficulty: "medium",
    tags: ["高级分析","分解树","关键影响因素"],
    sourceKey: "pl300",
    level: "进阶"
  }),
  judgeQuestion({
    key: "power-bi-sup-powerbi-analytics-j1",
    stageKey: "powerbi-report", topicKey: "powerbi-analytics",
    stem: "Power BI 的'关键影响因素'视觉对象用于分析哪些因素最可能影响某个目标结果，而不是用于精确预测未来数值。",
    answer: true,
    explanation: "关键影响因素（Key Influencers）基于统计与机器学习，解释在当前数据中哪些字段值更可能推动目标结果（例如'什么因素让客户流失概率升高'），它提供的是影响因素排序与解释，属于描述性/解释性分析，并不等价于时间序列预测的精确数值输出。",
    difficulty: "medium",
    tags: ["高级分析","关键影响因素"],
    sourceKey: "powerbi-samples",
    level: "进阶"
  }),
  // ----- powerbi-security-service (powerbi-model) -----
  singleQuestion({
    key: "power-bi-sup-powerbi-security-service-s1",
    stageKey: "powerbi-report", topicKey: "powerbi-security-service",
    stem: "关于 Power BI 的行级安全性（RLS），以下说法正确的是？",
    options: [
      "RLS 在报表视图层隐藏视觉对象，但不限制底层数据访问",
      "RLS 通过在语义模型定义角色与筛选规则，使不同用户只能看到自己被授权的数据行",
      "RLS 只能在 Power BI Desktop 中临时启用，发布后自动失效",
      "一个模型最多只能定义一个安全角色"
    ],
    answer: "B",
    explanation: "行级安全性（Row-Level Security）在语义模型层通过'管理角色'定义角色，并用 DAX 筛选表达式（如 [Region] = '华东'）限定每个角色可见的数据行。发布到 Power BI Service 后，把用户/组映射到角色，引擎会在查询时自动附加对应筛选，确保用户只能读取授权数据，且角色可定义多个、可叠加。",
    difficulty: "medium",
    tags: ["RLS","安全性","角色"],
    sourceKey: "pl300",
    level: "进阶"
  }),
  judgeQuestion({
    key: "power-bi-sup-powerbi-security-service-j1",
    stageKey: "powerbi-report", topicKey: "powerbi-security-service",
    stem: "行级安全性（RLS）通过在语义模型中定义角色及其 DAX 筛选规则，使用户登录后只能看到被授权的数据行。",
    answer: true,
    explanation: "RLS 把数据权限前置到模型查询层：管理员在 Power BI Desktop 定义角色并编写筛选表达式，发布后在 Service 中将成员分配到角色。用户访问报表时，引擎自动把其角色对应的筛选施加到所有查询，从而在不创建多份模型的前提下，安全地向不同人群展示各自的数据范围。",
    difficulty: "medium",
    tags: ["RLS","安全性"],
    sourceKey: "powerbi-samples",
    level: "进阶"
  })
];
