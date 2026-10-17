/**
 * Power BI · 知识点扩容（追加式，2026-10-17）。
 *
 * 6 个新知识点，全部落在 power-bi 课程已有的真实阶段上：
 *   powerbi-ingest  - 增量刷新与分区策略
 *   powerbi-model   - 星型与雪花：维度拆分与关系方向
 *   powerbi-dax     - 行上下文与筛选上下文 / 度量值与计算列的选用 / 时间智能的日期表前提
 *   powerbi-report  - 动态行级安全与角色测试
 *
 * 口径：与 backend-engineering 样板一致——讲透、讲准、给细节；术语配人话解释；每章有可复述的小结。
 * 由 expandLearningTrack 在运行时按 stageKey 追加到对应阶段，题目与本条 expansion 的 topicKey 对齐。
 */
import type { TopicExpansion } from "./topic-expansions";

export const powerBiTopicExpansions: TopicExpansion[] = [
  {
    trackSlug: "power-bi",
    stageKey: "powerbi-model",
    topic: {
      key: "powerbi-star-snowflake-direction",
      title: "星型与雪花：维度拆分与关系方向",
      summary:
        "星型只保留两层，雪花把维度再拆一层；每多一跳关系，筛选就要多传一次。关系方向决定筛选走不走得通，双向则让路径变多、数字变得可疑。",
      concepts: ["星型模型", "雪花模型", "关系方向", "筛选传播", "桥接表"],
      principles: [
        "事实表只存业务事件的键与度量，描述性字段全部下沉到维度表，这是星型模型的两条纪律。",
        "关系默认从一对多的一端筛向多端；需要反向筛选时先用桥接表或显式 DAX，不要随手开双向。",
        "关系链上每一跳都要付出一次传播成本，链路越长，视觉对象刷新越慢、出错点也越多。",
      ],
      applications: [
        "把 ERP 里产品、子类、类目三层雪花压成一张产品维度，切片器才能一次筛到底。",
        "订单与标签这类多对多用桥接表承载，避免在两张表之间直接建多对多关系。",
      ],
      pitfalls: [
        "为了看起来规范把维度一路拆下去，结果每张视觉对象都要跨三跳关系才能筛到事实。",
        "关系键类型不一致或带多余空格，关系静默失效，报表不报错但数字偏小。",
      ],
      method: "先在关系图上数清每条链的跳数，判断哪一层维度值得合并；能用单向解决就不开双向。",
      exercise: "把三层雪花的产品维度压平成一张，在不改任何 DAX 的前提下验证销售总额与压平前完全一致。",
      checkpoint: "能对着关系图说出任一视觉对象的筛选从维度出发走了几跳、在哪一跳被切断。",
      lesson: {
        overview: [
          "星型模型只有两层：一张窄事实表，加上若干只与事实表直接相连的维度表。雪花模型允许维度表再挂维度表，看上去更符合范式，但每一次筛选都要多跨一跳关系。Power BI 的存储与计算引擎是为星型优化的，先接受这条前提，很多性能问题会自己消失。",
          "关系方向是第二个决策点。一对多关系默认从一端筛向多端，这正是维度筛事实的日常工作方式。一旦打开双向，筛选会沿事实表回流到别的维度，路径一多，同一份数据就可能被不同路径重复计数，排查成本极高。",
        ],
        mechanism: [
          "VertiPaq 以列为单位压缩存储，事实表越窄、维度表越独立，压缩率与扫描效率越高。雪花把属性拆成多张表，单表虽然更小，但查询时要多做好几次关系跳转与哈希连接，整体反而更慢。",
          "筛选沿关系有方向地流动：一对多关系里，筛选从一端的维度流向多端的事实表。多对多必须经过桥接表，否则引擎只能在两张表之间做歧义处理，很多聚合会返回偏大的总计。",
          "关系链上任意一跳失效，比如键类型不一致、空值、双向造成的路径冲突，筛选就在那一跳断裂。报表不会报错，只是数字偏小，这类缺陷最难发现，必须用对照度量值主动验证。",
          "桥接表的作用是把多对多拆成两条一对多：桥接表放两侧的唯一键组合，两条关系都设为单向，必要时只对桥接表开双向，影响范围就可控了。",
        ],
        example: {
          title: "用对照度量值验证关系是否真的接通",
          language: "dax",
          code: "-- 1) 基线：不加任何维度筛选\nSales Baseline = SUM ( 'Sales'[Amount] )\n\n-- 2) 加一层维度筛选（子类代理键 1-3）\nSales Subset =\nCALCULATE (\n    [Sales Baseline],\n    KEEPFILTERS ( 'Product'[SubcategoryKey] IN { 1, 2, 3 } )\n)\n\n-- 3) 差值：恒为 0 就说明这一跳没通\nSales Delta = [Sales Baseline] - [Sales Subset]\n\n-- 4) 桥接表口径：按标签统计订单数，不要直接从事实表数\nOrders With Tag = DISTINCTCOUNT ( 'OrderTag'[OrderId] )",
          explanation:
            "三条对照度量值把关系到底通不通变成可读的数字：基线、加一层维度筛选、以及两者差值。差值恒为 0 时要先怀疑关系键的类型与取值，而不是去改 DAX；差值出现负数，通常是双向关系让筛选从事实回流，把维度之间互相放大了。",
        },
        practiceSteps: [
          "在模型视图里数出每张维度表到事实表的关系跳数，标出超过一跳的链路。",
          "把只服务于切片器的雪花层级合并进上一级维度表，保留一条一对多关系。",
          "用基线与加筛选两个度量值对照，确认每一跳关系都在工作，再决定是否保留双向。",
        ],
        masteryChecklist: [
          "能解释雪花模型为什么会让同一张报表变慢。",
          "能判断一个双向关系是否真的必要，并说出替代方案。",
        ],
        summary: [
          "星型两层、雪花多层，Power BI 为星型优化，能压平就压平。",
          "关系默认单向：维度筛事实。",
          "双向筛选制造多条路径，重复计数与性能问题随之而来。",
          "桥接表把多对多拆成两条一对多，影响面可控。",
          "关系键类型不一致会让关系静默失效，必须用对照度量值验证。",
        ],
        terms: [
          {
            term: "星型模型",
            plain: "一张事实表周围直接挂一圈维度表，只有两层。",
            detail:
              "星型的关键不是形状好看，而是维度与事实之间只隔一跳，筛选传播最短。代价是维度表里会有冗余描述，比如产品名和类目名放在同一张表里。",
          },
          {
            term: "雪花模型",
            plain: "维度表再挂维度表，层级像雪花一样向外分叉。",
            detail:
              "它来自数据库范式，能减少维度表内的重复。但在 Power BI 里每多一层就要多一跳关系，查询与 DAX 都更贵，通常只在层级确实需要独立维护时才保留。",
          },
          {
            term: "关系方向",
            plain: "筛选能往哪边流，默认从维度流向事实。",
            detail:
              "一对多关系的箭头从一端指向多端。单向时筛选只沿箭头走；开启双向后筛选可回流，多条路径并存就容易产生歧义与重复计数。",
          },
          {
            term: "桥接表",
            plain: "专门用来把多对多拆成两个一对多的中间表。",
            detail:
              "桥接表里一行代表一次关联，比如订单与标签的组合。它与两侧各建一条一对多关系，既保留多对多语义，又让筛选路径唯一、可解释。",
          },
        ],
      },
    },
    questions: [
      {
        key: "power-bi-exp-powerbi-star-snowflake-direction-s1",
        stageKey: "powerbi-model",
        topicKey: "powerbi-star-snowflake-direction",
        type: "single",
        stem: "关于星型模型、雪花模型与关系方向，下面哪一项说法正确？",
        options: [
          { key: "A", text: "雪花模型把维度拆得更细，所以同一张报表一定比星型更快" },
          {
            key: "B",
            text: "筛选默认从一对多的一端流向多端，双向关系会让路径变多、结果更容易重复计数",
          },
          { key: "C", text: "只要关系画出来了，键类型不一致也不影响筛选传播" },
          { key: "D", text: "桥接表的作用是让事实表与维度表直接建立多对多关系" },
        ],
        answer: ["B"],
        explanation:
          "星型只保留一层维度，雪花把维度再拆一层，每多一跳就要多传一次筛选，查询反而更慢，所以 A 错。关系键类型或取值不一致会让这一跳静默失效，筛选根本传不过去，C 错。桥接表的用途是把多对多拆成两条一对多，而不是保留多对多，D 错。",
        difficulty: "medium",
        level: "进阶",
        tags: ["星型模型", "关系方向", "模型设计"],
        sourceKey: "pl300",
      },
      {
        key: "power-bi-exp-powerbi-star-snowflake-direction-j1",
        stageKey: "powerbi-model",
        topicKey: "powerbi-star-snowflake-direction",
        type: "judge",
        stem: "为了让筛选更灵活，应该把语义模型里的关系全部设置为双向筛选。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "全部双向会让筛选沿事实表回流，同一个维度可能被多条路径筛选，聚合结果被重复计数；同时每条双向关系都要在查询时多做一次传播，模型越大越慢。正确做法是保持默认单向，确实需要反向筛选时用桥接表或显式 DAX 把影响限制在局部。",
        difficulty: "medium",
        level: "进阶",
        tags: ["双向筛选", "筛选传播", "性能"],
        sourceKey: "pl300",
      },
    ],
  },
  {
    trackSlug: "power-bi",
    stageKey: "powerbi-dax",
    topic: {
      key: "powerbi-row-filter-context",
      title: "行上下文与筛选上下文",
      summary:
        "行上下文回答正在算哪一行，筛选上下文回答这次查询被哪些列值限定了。DAX 里大多数看起来不讲道理的结果，都源于把两者当成了一回事。",
      concepts: ["行上下文", "筛选上下文", "上下文转换", "迭代函数", "ALLSELECTED"],
      principles: [
        "行上下文只由迭代函数和计算列提供，它逐行给出当前行，不会自动过滤整张表。",
        "度量值在查询时由视觉对象、切片器与 CALCULATE 共同构造筛选上下文，换一片筛选就换一个数字。",
        "在行上下文里调用度量值会触发行上下文转换，引擎把当前行的列值翻译成等效筛选器，这也是性能热点。",
      ],
      applications: [
        "用 SUMX 逐行计算数量乘单价再求和，处理折扣、退货这类逐行规则。",
        "用 AVERAGEX 先算每单客单价再取平均，避免直接对总额求平均造成的失真。",
      ],
      pitfalls: [
        "在计算列里直接写 SUM 并期望它只算当前行，结果拿到的是当前上下文下的整列合计。",
        "在 SUMX 里重复调用代价高的度量值，上下文转换被放大成逐行生成筛选器，报表瞬间变慢。",
      ],
      method: "先问这段表达式在哪一行上执行、又被哪些列值限定，再决定用列引用还是用聚合。",
      exercise: "分别用 SUMX 与 CALCULATE 实现只统计有折扣订单的销售额，并解释两者的上下文差异。",
      checkpoint: "能在一条 FILTER 表达式里指出哪一层是行上下文、哪一层是筛选上下文。",
      lesson: {
        overview: [
          "DAX 只有两种上下文，但它们决定了每个数字的含义。行上下文是逐行迭代时提供的当前行指针，只存在于迭代函数和计算列里；筛选上下文是查询时作用在整张表上的列值限定，来自视觉对象、切片器、筛选器窗格和 CALCULATE。",
          "两者最容易混淆的地方是聚合函数。SUM 在行上下文里并不会自动只看当前行，它看到的仍是当前筛选上下文下的整列；想让当前行的值参与筛选，必须靠 CALCULATE，或者依赖引擎自动完成的上下文转换。",
        ],
        mechanism: [
          "迭代函数打开行上下文：SUMX 对每一行求值表达式，再把结果累加。此时列引用取的是当前行的值，而不是整列的聚合结果。",
          "筛选上下文由外部决定：切片器、视觉对象的行列、筛选器窗格都会生成筛选器，CALCULATE 则可以在计算前增删改这些筛选器。",
          "上下文转换是两者的桥：在行上下文里引用度量值，引擎会把当前行每一列的值变成等效筛选器，再交给度量值求值。它很方便，但每行都要生成一次筛选，成本随行数线性增长。",
          "ALLSELECTED 与 ALL 的区别在于尊不尊重外部切片：前者保留用户在页面上已选的筛选，后者一律清空，选错会让占比类指标回到全量口径。",
        ],
        example: {
          title: "同一段逻辑的三种写法与各自上下文",
          language: "dax",
          code: "-- 纯行上下文：逐行相乘后累加，不涉及任何筛选改动\nLine Revenue =\nSUMX (\n    'OrderLine',\n    'OrderLine'[Qty] * 'OrderLine'[UnitPrice] * ( 1 - 'OrderLine'[Discount] )\n)\n\n-- 上下文转换：FILTER 内调用度量值，当前订单行会被自动变成筛选器\nOrders Above Avg =\nCOUNTROWS (\n    FILTER (\n        'Order',\n        [Line Revenue]\n            > DIVIDE (\n                CALCULATE ( [Line Revenue], ALL ( 'Order' ) ),\n                COUNTROWS ( ALL ( 'Order' ) )\n            )\n    )\n)\n\n-- 筛选上下文：CALCULATE 显式加筛选，不依赖隐式转换\nDiscounted Revenue =\nCALCULATE ( [Line Revenue], 'OrderLine'[Discount] > 0 )",
          explanation:
            "第一段完全是行上下文，只做逐行乘法与累加。第二段是上下文转换的典型场景：FILTER 内部的 [Line Revenue] 每迭代一行都会被翻译成对该订单的筛选，所以它比较的是这一单金额与整体均值。第三段用 CALCULATE 显式加筛选器，不依赖隐式转换，通常更便宜也更好读。",
        },
        practiceSteps: [
          "把现有度量值按行上下文与筛选上下文分别标注，指出哪些列引用依赖当前行。",
          "把依赖隐式上下文转换的写法改成显式 CALCULATE，或用变量先算好再比较。",
          "在报表里切换两三个切片器，逐一核对每个度量值的变化是否符合筛选上下文预期。",
        ],
        masteryChecklist: [
          "能说明行上下文为什么不会自动筛选整张表。",
          "能解释上下文转换的代价，并在必要时改写。",
        ],
        summary: [
          "行上下文来自迭代，筛选上下文来自查询。",
          "SUM 在行上下文里仍然作用于整列，需要 CALCULATE 才会收窄。",
          "上下文转换把当前行变成筛选器，方便但按行计费。",
          "ALL 清空筛选，ALLSELECTED 尊重用户已选的筛选。",
        ],
        terms: [
          {
            term: "行上下文",
            plain: "正在逐行计算时，指向当前这一行的那根指针。",
            detail:
              "它由迭代函数或计算列提供，只影响列引用取哪一行的值，不会过滤表里的其它行。所以行上下文里的 SUM 依旧是在整列上聚合。",
          },
          {
            term: "筛选上下文",
            plain: "这次查询被哪些列值限定了范围。",
            detail:
              "来源包括切片器、视觉对象的行列、筛选器窗格和 CALCULATE。同一个度量值在不同单元格里数值不同，正是因为筛选上下文不同。",
          },
          {
            term: "上下文转换",
            plain: "在行上下文里调用度量值，当前行被自动变成筛选器。",
            detail:
              "引擎按当前行每一列的值构造等效筛选，再交给度量值。它让逐行计算能复用度量值，但每行一次筛选的成本在大表上非常可观。",
          },
          {
            term: "迭代函数",
            plain: "逐行跑一遍表达式再汇总，比如 SUMX、AVERAGEX。",
            detail:
              "迭代函数是行上下文的来源。它接受一张表和一个表达式，对每一行求值后按规则聚合，因此能表达逐行规则，代价是比纯聚合慢。",
          },
        ],
      },
    },
    questions: [
      {
        key: "power-bi-exp-powerbi-row-filter-context-s1",
        stageKey: "powerbi-dax",
        topicKey: "powerbi-row-filter-context",
        type: "single",
        stem: "下面关于行上下文与筛选上下文的说法，哪一项正确？",
        options: [
          { key: "A", text: "行上下文会自动对整张表施加筛选，所以在迭代里 SUM 只算当前行" },
          {
            key: "B",
            text: "行上下文由迭代函数或计算列提供，SUM 在其中仍作用于当前筛选上下文下的整列",
          },
          { key: "C", text: "筛选上下文只存在于计算列里，度量值没有筛选上下文" },
          { key: "D", text: "上下文转换不会带来任何性能开销，可以随意使用" },
        ],
        answer: ["B"],
        explanation:
          "行上下文只解决当前行取值的问题，不会过滤整张表，因此迭代函数内部的 SUM 仍然是整列聚合，A 错。筛选上下文恰恰是度量值的工作环境，由视觉对象、切片器和 CALCULATE 构造，C 错。上下文转换每行都要生成一次筛选器，在大表上是明确的性能热点，D 错。",
        difficulty: "medium",
        level: "进阶",
        tags: ["DAX", "行上下文", "筛选上下文"],
        sourceKey: "pl300",
      },
      {
        key: "power-bi-exp-powerbi-row-filter-context-j1",
        stageKey: "powerbi-dax",
        topicKey: "powerbi-row-filter-context",
        type: "judge",
        stem: "在 FILTER 中调用一个度量值会触发上下文转换，因此每迭代一行都要生成一次对应的筛选器。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "FILTER 为每一行提供行上下文，而在其中引用度量值会触发上下文转换：引擎按当前行各列的值构造筛选器，再在该筛选下求值。这也解释了为什么 FILTER 里调用复杂度量值会明显变慢，行数越大，构造筛选器的次数越多。",
        difficulty: "hard",
        level: "综合",
        tags: ["DAX", "上下文转换", "性能"],
        sourceKey: "powerbi-samples",
      },
    ],
  },
  {
    trackSlug: "power-bi",
    stageKey: "powerbi-dax",
    topic: {
      key: "powerbi-measure-vs-column",
      title: "度量值与计算列的选用",
      summary:
        "计算列在刷新时算好、存进模型、占内存；度量值在查询时按上下文算、不入库。选错不只是快慢问题，而是这个指标到底会不会跟着切片器变化。",
      concepts: ["计算列", "度量值", "物化与查询时计算", "基数与压缩", "显式度量值"],
      principles: [
        "计算列是行级、刷新时物化、结果参与压缩存储；度量值在查询时求值，模型里只存定义。",
        "需要随用户筛选变化的业务指标必须做成度量值；需要参与切片、分组、排序的分类字段才做成计算列。",
        "计算列会把每一行的结果写进模型，高基数文本列会显著抬高内存占用与刷新时长。",
      ],
      applications: [
        "占比、同比、排名这类随筛选变化的指标一律用度量值。",
        "客户分群、价格带、是否新客这类分类字段用计算列，才能在切片器里出现。",
      ],
      pitfalls: [
        "用计算列算占比，切片器怎么切数字都不变，因为刷新时就已经定死了。",
        "把每行金额算成计算列再求和，模型体积翻倍，刷新时长也跟着涨。",
      ],
      method: "先判断结果是按行固定还是随筛选变化，再决定物化到列还是留在度量值里。",
      exercise: "把现有的三个计算列指标改写为度量值，对比切片切换时的数值与模型大小变化。",
      checkpoint: "能对任一需求判断该做计算列还是度量值，并说明判断依据。",
      lesson: {
        overview: [
          "Power BI 里同一个数字可以有两种实现路径：计算列在数据刷新时逐行算完，把结果存进模型；度量值只在报表查询时按当前上下文求值，模型里存的是公式而不是结果。两者的差别不是写法，而是计算发生在什么时刻。",
          "时刻决定了行为。计算列在刷新后就是一份静态数据，切片器怎么切它都不会重算；度量值每次查询都重新执行，所以能随筛选、行、列、切片器一起变化。业务指标要动态，就必须走度量值这条路。",
        ],
        mechanism: [
          "刷新阶段，引擎逐行执行计算列表达式，结果写回表并参与列式压缩。列越多、基数越高，刷新越慢，模型越大。",
          "查询阶段，视觉对象把筛选上下文交给度量值，引擎按公式求值，不读取任何预先存好的结果，因此同一度量值在不同单元格可以是不同数字。",
          "计算列可以当作筛选器、切片器字段、关系键和排序依据，度量值不能；反过来度量值能引用计算列，计算列引用度量值时会触发行上下文转换，代价更高。",
          "显式度量值优先于隐式聚合：把字段直接拖到视觉对象上生成的隐式聚合无法复用、无法统一格式，也难以统一口径。",
        ],
        example: {
          title: "同一个占比，计算列与度量值的结果差异",
          language: "dax",
          code: "-- 反例：计算列，刷新时定死，切片后仍是全量占比\nShare Of Total Column =\nDIVIDE ( 'Sales'[Amount], SUM ( 'Sales'[Amount] ) )\n\n-- 正例：显式度量值，随筛选上下文变化\nSales Amount = SUM ( 'Sales'[Amount] )\n\nSales Share =\nDIVIDE (\n    [Sales Amount],\n    CALCULATE ( [Sales Amount], ALLSELECTED ( 'Product'[Category] ) )\n)\n\n-- 该做计算列的场合：分类字段，供切片器与分组使用\nPrice Band =\nSWITCH (\n    TRUE (),\n    'Product'[ListPrice] >= 1000, \"High\",\n    'Product'[ListPrice] >= 300, \"Mid\",\n    \"Low\"\n)",
          explanation:
            "上半段是典型误用：计算列在刷新时把每行金额除以全表合计，结果写死在模型里，切片到某个类目后仍是全量占比。下半段用显式度量值，分母用 ALLSELECTED 尊重页面已选筛选，占比才随切片变化。最后一段是计算列的正当用途：价格带这种分类字段必须物化成列，才能作为切片器与分组依据。",
        },
        practiceSteps: [
          "列出所有计算列，逐个标注它承担的是分类字段还是业务指标。",
          "把承担指标的列改写成显式度量值，并检查切片切换后的数值。",
          "对保留的计算列评估基数，把高基数文本换成更粗的粒度。",
        ],
        masteryChecklist: [
          "能判断一个需求该用计算列还是度量值。",
          "能解释计算列为什么会拖慢刷新、增大模型。",
        ],
        summary: [
          "计算列刷新时算、存进模型；度量值查询时算、只存公式。",
          "要随筛选变化的指标必须用度量值。",
          "要参与切片与分组的分类字段才用计算列。",
          "显式度量值优于隐式聚合，口径与格式都更可控。",
        ],
        terms: [
          {
            term: "计算列",
            plain: "刷新时逐行算好、存进表里的一列新数据。",
            detail:
              "结果物化在模型中，可以当切片器字段、关系键或排序依据。代价是占内存、拖慢刷新，而且数值不随用户筛选变化。",
          },
          {
            term: "度量值",
            plain: "只存公式、查询时才算的动态指标。",
            detail:
              "不占存储，随筛选上下文变化，适合占比、同比、排名这类业务指标。它必须被视觉对象或其它表达式引用才会真正执行。",
          },
          {
            term: "基数",
            plain: "一列里有多少个不同的值。",
            detail:
              "基数越高，压缩越难、内存越大。ID 类高基数列做成计算列尤其昂贵，大表上常是模型膨胀的主因。",
          },
          {
            term: "隐式度量值",
            plain: "把字段拖进视觉对象时自动生成的聚合。",
            detail:
              "它没有名字、无法复用、格式难以统一，口径也容易在不同页面漂移。规范做法是先写显式度量值，再到报表里引用。",
          },
        ],
      },
    },
    questions: [
      {
        key: "power-bi-exp-powerbi-measure-vs-column-s1",
        stageKey: "powerbi-dax",
        topicKey: "powerbi-measure-vs-column",
        type: "single",
        stem: "关于度量值与计算列的选用，下面哪一项正确？",
        options: [
          { key: "A", text: "计算列在查询时逐行计算，所以比度量值更灵活" },
          {
            key: "B",
            text: "需要随用户筛选变化的指标应做成度量值，它在查询时按筛选上下文求值",
          },
          { key: "C", text: "度量值会在刷新时把结果存进模型，因此不能用于切片器" },
          { key: "D", text: "计算列与度量值在模型里的存储代价完全相同" },
        ],
        answer: ["B"],
        explanation:
          "计算列是在刷新时物化的，不是查询时逐行计算，A 错。度量值不落库，模型里只有公式，刷新时不会写入结果，C 错。计算列的结果要存进模型并参与压缩，度量值不占存储，两者代价完全不同，D 错。只有 B 描述了正确的分工：动态指标走度量值。",
        difficulty: "medium",
        level: "进阶",
        tags: ["DAX", "度量值", "计算列"],
        sourceKey: "pl300",
      },
      {
        key: "power-bi-exp-powerbi-measure-vs-column-j1",
        stageKey: "powerbi-dax",
        topicKey: "powerbi-measure-vs-column",
        type: "judge",
        stem: "为了让切片器能按价格带分组，应该把价格带做成度量值。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "切片器与分组需要的是一个可枚举的字段，必须物化成计算列；度量值是查询时求值的标量结果，无法作为切片器字段或分组依据。价格带属于分类字段，应做成计算列；随筛选变化的金额、占比才是度量值。",
        difficulty: "medium",
        level: "进阶",
        tags: ["计算列", "切片器", "模型设计"],
        sourceKey: "pl300",
      },
    ],
  },
  {
    trackSlug: "power-bi",
    stageKey: "powerbi-dax",
    topic: {
      key: "powerbi-date-table-marking",
      title: "时间智能的日期表前提",
      summary:
        "时间智能函数不认识你的日期列，只认一张连续、已标记为日期表、且与事实表正确关联的日期表。缺任何一环，结果往往是空值而不是报错。",
      concepts: ["标记为日期表", "连续日期", "自动日期时间", "日期表关系", "YTD 与同比"],
      principles: [
        "DATEADD、SAMEPERIODLASTYEAR 等函数按整段连续日期平移，日期表有断档就会平移到空白区，返回空值。",
        "未标记日期表时引擎会退回自动日期时间生成的隐藏表，模型体积膨胀且行为不可预期。",
        "日期表必须与事实表建立一对多关系，并由日期列而不是事实表上的日期列承担筛选。",
      ],
      applications: [
        "同比、环比、YTD 等标准时间对比报表。",
        "按年月层次切换的销售趋势页。",
      ],
      pitfalls: [
        "日期表缺了几天，同比整段为空，却以为是 DAX 公式写错了。",
        "直接用事实表日期列做切片器，时间智能在缺少完整日期上下文时给出意外结果。",
      ],
      method: "先确认日期表连续、已标记、关系正确，再按基线、上期、累计三层逐个验证。",
      exercise: "用三个月的明细手工核对 YTD 与同比，定位并修复日期表里的一处断档。",
      checkpoint: "能让同比与 YTD 在任意月份切片下返回可手工复算的数字。",
      lesson: {
        overview: [
          "时间智能函数看似聪明，其实非常挑剔：它们默认你提供了一张覆盖完整时间、每天都不缺、并且已经标记为日期表的日期维度。只要有一处不满足，函数不会报错，而是安静地返回空值或错误的区间。",
          "标记日期表这个动作不是形式主义。它告诉引擎这张表的日期列就是时间轴，时间智能可以据此生成完整区间，同时关掉该表上的自动日期时间，避免隐藏的日期表把模型体积翻倍。",
        ],
        mechanism: [
          "SAMEPERIODLASTYEAR 会把当前筛选的日期区间整体平移一年，再回原表求交集。日期表缺那一天，交集就是空，度量值返回空值而不是 0。",
          "标记为日期表后，引擎知道日期列的唯一性与连续性，可以为每个查询补全区间，也让自动日期时间不再为这张表生成隐藏表。",
          "关系决定筛选路径：日期表与事实表之间必须是一对多，且由日期表一侧筛选。若改用事实表的日期列直接切片，时间智能拿到的上下文并不完整。",
          "多层验证是最省时的排错顺序：先看基线总额，再看上期，最后看累计。哪一层开始为空，问题就在那一层依赖的日期连续性或关系上。",
        ],
        example: {
          title: "从基线到 YTD 的分层验证",
          language: "dax",
          code: "-- 1) 基线：先确认总额本身正确\nSales Amount = SUM ( 'Sales'[Amount] )\n\n-- 2) 上期：依赖日期表连续才能整段平移\nSales LY =\nCALCULATE (\n    [Sales Amount],\n    SAMEPERIODLASTYEAR ( 'Date'[Date] )\n)\n\n-- 3) 同比：把两层结果拼成比率\nSales YoY % = DIVIDE ( [Sales Amount] - [Sales LY], [Sales LY] )\n\n-- 4) 累计：YTD 需要完整年份区间\nSales YTD = TOTALYTD ( [Sales Amount], 'Date'[Date] )\n\n-- 5) 排错：数一数当前筛选下日期表有几行，断档会直接显形\nDate Rows In Context = COUNTROWS ( 'Date' )",
          explanation:
            "这五个式子构成一条排错链：基线错了说明是数据或关系问题；基线对而上期为空，几乎总是日期表断档或未标记；上期对而同比异常，看分母是否为零；累计与手工核算不符，检查年份区间是否被其它筛选截断。最后一行 COUNTROWS 是把隐藏问题显形的最快手段。",
        },
        practiceSteps: [
          "用 CALENDAR 或 Power Query 生成覆盖首末业务日的连续日期表，并在模型里标记为日期表。",
          "建立日期表与各事实表的一对多关系，移除事实表上的日期切片用法。",
          "按基线、上期、累计三层各取一个月手工核对，确认断档已修复。",
        ],
        masteryChecklist: [
          "能说清标记日期表这一步改变了什么。",
          "能定位时间智能返回空值的三类常见原因。",
        ],
        summary: [
          "时间智能依赖连续、已标记、关系正确的日期表。",
          "日期断档不会报错，只会让结果变空。",
          "标记日期表同时关掉自动日期时间，避免模型膨胀。",
          "排错按基线、上期、累计三层走，先定位再改公式。",
        ],
        terms: [
          {
            term: "标记为日期表",
            plain: "告诉引擎这张表的日期列就是时间轴。",
            detail:
              "标记后时间智能可以为查询补全连续区间，同时该表不再生成自动日期时间隐藏表。前提是日期列唯一、连续、不含空值。",
          },
          {
            term: "自动日期时间",
            plain: "Power BI 为每个日期列悄悄生成的一整套隐藏表。",
            detail:
              "它方便但会让模型变大、刷新变慢，且行为依赖文件设置。日期表标记好之后通常应当整体关掉，避免同一时间轴出现两份来源。",
          },
          {
            term: "时间智能",
            plain: "一组按日期平移和累计的函数，比如同比与 YTD。",
            detail:
              "它们不读事实表的日期值，而是读日期维度上的筛选，再平移成新区间。所以日期表不连续、未标记或关系不对，函数都会失效。",
          },
          {
            term: "YTD",
            plain: "从年初累计到今天或到当前月份的合计。",
            detail:
              "TOTALYTD 会把当前筛选的日期截到年初至当期。它依赖完整年份区间，日期表缺月初或年末会导致累计起点偏移。",
          },
        ],
      },
    },
    questions: [
      {
        key: "power-bi-exp-powerbi-date-table-marking-s1",
        stageKey: "powerbi-dax",
        topicKey: "powerbi-date-table-marking",
        type: "single",
        stem: "在 Power BI 中把一张日期维度标记为日期表，主要带来什么效果？",
        options: [
          { key: "A", text: "把日期列自动转换成文本，方便排序" },
          {
            key: "B",
            text: "让引擎以该表的日期列作为时间轴生成连续区间，并停用这张表的自动日期时间",
          },
          { key: "C", text: "自动为所有事实表补上缺失的日期" },
          { key: "D", text: "强制所有时间智能函数忽略切片器" },
        ],
        answer: ["B"],
        explanation:
          "标记日期表是给引擎一个明确的时间轴声明：日期列唯一且连续，时间智能可据此补全区间；同时该表不再生成自动日期时间的隐藏表，模型体积与行为都更可控。它不会改数据类型，不会给事实表补行，也不会让时间智能忽略切片器，其余选项都错。",
        difficulty: "medium",
        level: "进阶",
        tags: ["日期表", "时间智能", "模型"],
        sourceKey: "pl300",
      },
      {
        key: "power-bi-exp-powerbi-date-table-marking-j1",
        stageKey: "powerbi-dax",
        topicKey: "powerbi-date-table-marking",
        type: "judge",
        stem: "日期表中间缺了几天，只要日期列是日期类型，同比计算仍然准确。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "同比靠整段平移再求交集，缺日期会让平移后的区间与日期表对不上，交集为空，度量值返回空值而不是报错。类型正确只保证比较能进行，并不保证区间连续，所以缺日期必须补齐后重新标记。",
        difficulty: "medium",
        level: "进阶",
        tags: ["日期表", "同比", "排错"],
        sourceKey: "powerbi-samples",
      },
    ],
  },
  {
    trackSlug: "power-bi",
    stageKey: "powerbi-ingest",
    topic: {
      key: "powerbi-incremental-refresh",
      title: "增量刷新与分区策略",
      summary:
        "增量刷新把一张大事实表切成历史归档与近期滚动两类分区，每次只重刷最近一段。前提是 RangeStart 与 RangeEnd 的筛选能被数据源折叠，否则每次照样拉全量。",
      concepts: ["RangeStart 与 RangeEnd", "分区", "查询折叠", "滚动窗口", "归档窗口"],
      principles: [
        "增量刷新靠两个日期参数切分区间，筛选必须能下推到数据源，折叠断了就退化成全量刷新。",
        "历史分区刷一次就不再重建，滚动分区每次刷新都重新拉取，窗口长度要与数据迟到时间匹配。",
        "窗口参数一旦调整，引擎会按新边界重建对应分区，第一次刷新往往明显变慢。",
      ],
      applications: [
        "千万行订单事实表每日刷新，只重拉最近十四天。",
        "按年归档的历史销售数据，只保留三年明细。",
      ],
      pitfalls: [
        "在 RangeStart 筛选之后又加会打断折叠的步骤，增量刷新形同虚设。",
        "滚动窗口比数据最大迟到时间还短，每天都会漏掉迟到的订单。",
      ],
      method: "先用查询诊断确认折叠，再定窗口参数与分区边界，最后在服务端配置计划刷新与失败告警。",
      exercise: "为订单事实表设计增量策略，说明滚动窗口为什么必须比最大迟到时间多留几天。",
      checkpoint: "能说明一次增量刷新重建了哪些分区、为什么本次耗时与首次不同。",
      lesson: {
        overview: [
          "数据量上到千万行以后，全量刷新会从几分钟变成几小时，而且每次都在重复搬运没有变化的历史数据。增量刷新的思路很简单：按时间把表切成若干分区，历史部分刷一次就冻结，只有最近一段每天重建。",
          "但它有一个硬前提：告诉 Power Query 只取某个日期区间的筛选，必须真的被推给数据源执行。这就是查询折叠。折叠一旦断裂，引擎仍会把整表拉到本地再筛，增量刷新只剩下配置的形式。",
        ],
        mechanism: [
          "发布到服务后，刷新策略用 RangeStart 与 RangeEnd 两个参数把数据切成若干分区：按年或按月归档，最后一段是滚动窗口。",
          "每次刷新只请求滚动窗口内的数据，其余分区直接复用上次结果，因此刷新耗时与数据总量脱钩，主要取决于窗口大小。",
          "查询折叠是前提：M 里的筛选要能翻译成数据源 SQL 的 WHERE。若中途做了源不支持的自定义列或类型转换，折叠在这里断掉，后续步骤全部在本地执行。",
          "窗口参数是交付契约：归档年数决定历史深度，滚动天数决定能容忍多晚到达的数据。参数改动会触发对应分区重建，必须安排在低峰期。",
        ],
        example: {
          title: "可折叠的增量刷新查询骨架",
          language: "powerquery",
          code: "let\n    // ServerName 与 DatabaseName 用参数维护，切换环境只改参数\n    Source = Sql.Database ( ServerName, DatabaseName ),\n    Sales = Source{[Schema = \"dbo\", Item = \"FactSales\"]}[Data],\n    // 只保留这一步筛选：RangeStart 与 RangeEnd 由刷新策略注入\n    Filtered = Table.SelectRows (\n        Sales,\n        each [OrderDate] >= RangeStart and [OrderDate] < RangeEnd\n    )\n    // 此处不要再加自定义列或类型转换，否则折叠会在这里断开\nin\n    Filtered",
          explanation:
            "整段查询只有一次筛选动作，且直接作用在源表的日期列上，因此能被折叠成数据源的 WHERE 语句，服务端才会真的只取窗口内的数据。若在筛选之后追加自定义列、合并或类型转换，折叠链会在这里断掉，增量刷新退化为全量拉取，配置看起来仍然正确。",
        },
        practiceSteps: [
          "在 Power Query 里右键查询查看折叠指示，确认筛选步骤仍被下推。",
          "设定归档年数与滚动天数，用历史最大迟到时间校验窗口是否够长。",
          "发布后在刷新历史里对比首次与增量刷新的耗时和分区数量。",
        ],
        masteryChecklist: [
          "能判断一条查询是否还能折叠。",
          "能解释滚动窗口与数据迟到时间的关系。",
        ],
        summary: [
          "增量刷新按时间分区，历史冻结、近期滚动。",
          "查询折叠是前提，断了就退化为全量。",
          "窗口参数是交付契约，改动会触发分区重建。",
          "滚动窗口必须覆盖最大迟到时间。",
        ],
        terms: [
          {
            term: "增量刷新",
            plain: "只重刷最近一段数据，历史部分不再重复搬运。",
            detail:
              "它把事实表切成多个时间分区，每次刷新只重建滚动窗口。收益来自少读少传，前提是筛选能折叠到数据源。",
          },
          {
            term: "查询折叠",
            plain: "把 Power Query 的步骤翻译成数据源能执行的语句。",
            detail:
              "折叠成功时筛选在数据源执行，只回传需要的行；一旦遇到源不支持的步骤，后续计算全部在本地进行，数据量立刻变成全表。",
          },
          {
            term: "RangeStart 与 RangeEnd",
            plain: "增量刷新用来圈定时间窗口的两个日期参数。",
            detail:
              "由刷新策略在服务端注入，不能在 Desktop 里手动赋值测试。查询必须用它们筛选日期列，且范围是左闭右开，避免边界日重复。",
          },
          {
            term: "滚动窗口",
            plain: "每次刷新都重新拉取的那一段时间范围。",
            detail:
              "它要覆盖数据可能迟到的最长时间，通常取最长延迟再加几天缓冲。窗口太短会漏数据，太长则每次刷新都在做无用功。",
          },
        ],
      },
    },
    questions: [
      {
        key: "power-bi-exp-powerbi-incremental-refresh-s1",
        stageKey: "powerbi-ingest",
        topicKey: "powerbi-incremental-refresh",
        type: "single",
        stem: "增量刷新已经配置好，但每次刷新仍然很慢，最可能的原因是什么？",
        options: [
          { key: "A", text: "报表页面的主题颜色设置不当" },
          {
            key: "B",
            text: "RangeStart 筛选之后有打断折叠的步骤，数据仍被整表拉取到本地再筛",
          },
          { key: "C", text: "切片器数量太多，导致刷新变慢" },
          { key: "D", text: "日期表没有标记为日期表" },
        ],
        answer: ["B"],
        explanation:
          "增量刷新的全部收益来自把时间窗口推给数据源执行。若筛选之后出现源不支持的自定义列、合并或类型转换，折叠在这里断开，刷新依旧整表拉取，耗时自然和全量一样。主题颜色影响渲染，切片器影响查询，日期表标记影响时间智能，都不会让刷新变慢。",
        difficulty: "medium",
        level: "进阶",
        tags: ["增量刷新", "查询折叠", "性能"],
        sourceKey: "pl300",
      },
      {
        key: "power-bi-exp-powerbi-incremental-refresh-j1",
        stageKey: "powerbi-ingest",
        topicKey: "powerbi-incremental-refresh",
        type: "judge",
        stem: "只要在 Power Query 里加了 RangeStart 与 RangeEnd 参数，增量刷新就一定会只拉取窗口内的数据。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "参数只是把时间边界交给查询，能不能只拉窗口内的数据，取决于这一步筛选能否折叠到数据源。若折叠断裂，本地仍要先拿到整表再过滤，服务端请求的行数一点没少。因此必须用折叠指示或查询计划确认下推。",
        difficulty: "medium",
        level: "进阶",
        tags: ["增量刷新", "查询折叠", "刷新策略"],
        sourceKey: "pl300",
      },
    ],
  },
  {
    trackSlug: "power-bi",
    stageKey: "powerbi-report",
    topic: {
      key: "powerbi-rls-dynamic",
      title: "动态行级安全与角色测试",
      summary:
        "静态 RLS 把用户锁在固定区域，动态 RLS 用一张用户与范围的映射表把授权交给数据维护。表达式只是开始，真正的功夫在角色测试与管理员绕过。",
      concepts: ["角色与表筛选器", "USERPRINCIPALNAME", "映射表", "以角色身份查看", "最小权限"],
      principles: [
        "角色里的 DAX 是一个附加筛选器，只在查询时生效，不改变模型里存的数据。",
        "动态 RLS 依赖映射表：按登录邮箱匹配范围，再沿关系把范围传播到事实表。",
        "RLS 只在服务端生效，Desktop 中必须用查看角色功能显式验证，管理员与成员身份可能绕过它。",
      ],
      applications: [
        "区域销售只能看本区域的订单与目标。",
        "多租户交付中按客户隔离数据。",
      ],
      pitfalls: [
        "只建角色不做测试，映射表缺行时用户看到空白却查不出原因。",
        "把使用者加成工作区管理员，RLS 对其不生效，等于没有安全。",
      ],
      method: "先定义数据范围，再建映射表与关系，最后按每个角色逐一验证并保留测试记录。",
      exercise: "为三个区域各建一个测试账号，用查看角色功能验证跨区数据不可见，并记录证据。",
      checkpoint: "任一角色的用户登录后只能看到授权范围内的行，且跨区查询返回空白。",
      lesson: {
        overview: [
          "行级安全的目标不是把报表藏起来，而是让同一条报表对每个人显示不同的行。角色里写的 DAX 本质是一个表筛选器，引擎在查询时把它叠加到用户请求上，模型里并不存任何按人切分的数据副本。",
          "静态写法把区域写死在表达式里，新增区域就要改模型。动态写法把用户与范围放进一张映射表，授权变成数据维护动作，模型不必再发版。代价是这张表必须长期保持准确，否则用户会莫名其妙地看到空白页。",
        ],
        mechanism: [
          "创建角色并为某张表写 DAX 筛选表达式，发布后把用户或安全组分配到角色，服务在每次查询时附加该筛选。",
          "动态写法用 USERPRINCIPALNAME 取登录邮箱，在映射表里查对应范围，再靠关系把范围传到维度与事实表，因此映射表必须与范围维度建立关系。",
          "映射表里没有该用户时，结果为空集，用户看不到任何数据。这是安全默认值，但也常被误判为报表损坏，需要提前约定排查路径。",
          "权限边界不止 RLS：工作区管理员、数据集生成者等身份可以绕过行级安全，交付时必须做身份盘点，坚持最小权限。",
        ],
        example: {
          title: "动态角色表达式与三层验证",
          language: "dax",
          code: "-- 角色 Region Sales，筛选器写在 Region 维度表上\n[RegionCode] IN\nCALCULATETABLE (\n    VALUES ( 'UserRegion'[RegionCode] ),\n    'UserRegion'[UserEmail] = USERPRINCIPALNAME ()\n)\n\n-- 验证 1：以角色身份查看，勾选 Other user 并输入测试邮箱\n-- 验证 2：临时加一个度量值，检查映射表是否命中\nMapping Hits =\nCALCULATE (\n    COUNTROWS ( 'UserRegion' ),\n    'UserRegion'[UserEmail] = USERPRINCIPALNAME ()\n)\n\n-- 验证 3：确认 Region 与 FactSales 之间是一对多且方向正确\n-- 关系断了，筛选不会传播，表达式写得再对也无效",
          explanation:
            "角色表达式不直接引用事实表，而是在 Region 维度上限定取值：只要映射表命中某个 RegionCode，关系就会把这个范围传到事实表。验证 1 确认最终用户视角，验证 2 把映射命中情况变成数字，验证 3 检查传播路径。三层都通过，RLS 才算真正交付。",
        },
        practiceSteps: [
          "梳理用户与数据范围的对应关系，落到映射表并建立与范围维度的关系。",
          "为每个角色写筛选表达式，用查看角色功能逐个测试，覆盖有权限与无权限两种账号。",
          "盘点工作区成员与管理员，移除不必要的提权，并记录每次测试的证据。",
        ],
        masteryChecklist: [
          "能写出动态 RLS 表达式并说明它依赖哪张映射表。",
          "能列出至少两种会让 RLS 失效的配置错误。",
        ],
        summary: [
          "RLS 是查询时附加的表筛选器，不改模型数据。",
          "动态 RLS 把授权挪到映射表，按邮箱匹配。",
          "映射表缺行时用户看到空白，这是安全默认值。",
          "管理员身份可能绕过 RLS，必须做最小权限盘点。",
        ],
        terms: [
          {
            term: "行级安全",
            plain: "同一条报表，不同的人只能看到自己那几行。",
            detail:
              "RLS 用角色里的 DAX 筛选器实现，在查询时附加。它不影响模型里存的数据，也不改变报表布局，只限制可见行。",
          },
          {
            term: "动态 RLS",
            plain: "权限范围不写死，而是从一张映射表里查出来。",
            detail:
              "表达式用登录邮箱去映射表匹配范围，再沿关系传播。新增区域或人员只需改数据，不必改模型和报表。",
          },
          {
            term: "USERPRINCIPALNAME",
            plain: "返回当前登录用户的邮箱地址。",
            detail:
              "它是动态 RLS 的入口。服务端返回完整 UPN，Desktop 里测试时要输入同一个邮箱，否则会命中不到映射表。",
          },
          {
            term: "以角色身份查看",
            plain: "在 Desktop 里模拟某个角色或某个用户看报表。",
            detail:
              "这是验证 RLS 的唯一可靠方式，因为 Desktop 里打开报表的默认身份是作者本身。测试要覆盖有权限与无权限两种账号。",
          },
        ],
      },
    },
    questions: [
      {
        key: "power-bi-exp-powerbi-rls-dynamic-s1",
        stageKey: "powerbi-report",
        topicKey: "powerbi-rls-dynamic",
        type: "single",
        stem: "关于 Power BI 的行级安全，下面哪一项正确？",
        options: [
          { key: "A", text: "RLS 会把数据按用户复制成多份存进模型" },
          {
            key: "B",
            text: "角色里的 DAX 是查询时附加的表筛选器，动态写法靠映射表按登录邮箱匹配范围",
          },
          { key: "C", text: "在 Desktop 里打开报表看到全部数据，说明 RLS 已经生效" },
          { key: "D", text: "工作区管理员同样会被 RLS 限制可见数据" },
        ],
        answer: ["B"],
        explanation:
          "RLS 不复制数据，只在查询时叠加筛选器，A 错。Desktop 默认以作者身份打开，看到全部数据恰恰说明还没做角色测试，C 错。工作区管理员可以绕过行级安全，D 错。动态 RLS 的正确形态是映射表加登录邮箱匹配，再沿关系传播范围。",
        difficulty: "medium",
        level: "进阶",
        tags: ["RLS", "动态权限", "安全"],
        sourceKey: "pl300",
      },
      {
        key: "power-bi-exp-powerbi-rls-dynamic-j1",
        stageKey: "powerbi-report",
        topicKey: "powerbi-rls-dynamic",
        type: "judge",
        stem: "把使用者加入工作区管理员后，行级安全仍然会限制其可见数据。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "工作区管理员拥有对数据集与工作区的管理权限，可以绕开行级安全看到全部数据。所以交付时必须做身份盘点：普通使用者用查看者或成员身份加角色，管理员数量压到最少，并说明这一层权限边界不受 RLS 保护。",
        difficulty: "hard",
        level: "综合",
        tags: ["RLS", "权限边界", "最小权限"],
        sourceKey: "pl300",
      },
    ],
  },
];
