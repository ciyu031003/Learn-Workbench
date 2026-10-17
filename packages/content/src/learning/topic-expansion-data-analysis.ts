/**
 * SQL 与数据分析 · 知识点扩容（追加式，2026-10-17）。
 *
 * 一处新增 = 1 个知识点 + 2 道配套题（1 single + 1 judge）。
 * 只新增不改既有知识点；stageKey 全部取自 data-analysis.ts 的真实阶段：
 *   data-relational / data-analysis-sql / data-cleaning / data-visual-delivery
 */
import type { TopicExpansion } from "./topic-expansions";

export const dataAnalysisTopicExpansions: TopicExpansion[] = [
  {
    trackSlug: "data-analysis",
    stageKey: "data-cleaning",
    topic: {
      key: "data-metric-system",
      title: "指标体系与口径",
      summary:
        "指标体系是「一个北极星 + 一棵指标树」，不是一张越列越长的清单；口径则是把指标写成分子、分母、时间窗、过滤条件、去重键五段，缺一段就无法复算。",
      concepts: ["北极星指标", "指标树", "五段式口径", "去重键", "护栏指标"],
      principles: [
        "任何指标都必须能被复算：分子、分母、时间窗、过滤条件、去重键五段齐全，换一个人写 SQL 也应得到同一个数。",
        "指标树从结果指标往下拆到可以被动作影响的过程指标，否则只能看见结论、找不到抓手。",
        "同一指标只能有一个定义源（指标字典），页面引用定义而不是各自复制 SQL。",
      ],
      applications: [
        "课程业务：以周活跃付费完课学员为北极星，向下拆成访问、试听、报名、开课、完课五层过程指标，逐层看流失。",
        "指标字典评审：把日报与看板里的活跃用户口径对齐成同一段 SQL，避免两个页面报出两个数。",
      ],
      pitfalls: [
        "用只增不减的累计注册数当健康度指标，掩盖了新增放缓与流失加速。",
        "分母随手取（全量用户还是新用户），导致转化率与留存率互相解释不通。",
      ],
      method:
        "先写清一句业务问题，再把候选指标写成五段式口径，然后画指标树，标注每个指标的负责人、更新频率与告警阈值。",
      exercise:
        "为课程完课率写出五段式口径，再给出两种都合理但结果不同的分母，并说明它们各自回答什么业务问题。",
      checkpoint:
        "能把看板上任意一个指标复述成分子、分母、时间窗、过滤条件、去重键五段，并指出它挂在指标树的第几层。",
      lesson: {
        overview: [
          "很多团队以为做指标体系就是列一张指标清单，于是清单越来越长，问题却一个也没回答。真正有用的是结构：把最关心的结果放在树根，把能被团队动作影响的中间量当作树枝。这样结果变差时，你可以顺着树往下走，而不是围着一堆数字猜原因。",
          "比指标清单更隐蔽的坑是口径。同一个「活跃用户」，有人按登录去重、有人按有事件去重、有人算当天、有人滚动三十天，四个数都能叫日活。口径不写死，讨论就会退化成互相质疑数据，而不是讨论业务；把口径写成五段式，是让数据可以被复算、被审计的最小成本。",
          "指标树还要区分三类角色：结果指标告诉你整体好不好，过程指标告诉你卡在哪一环，护栏指标告诉你有没有为了变好而伤到别处。例如完课率上升的同时退款率也涨，那多半是难度被调低换来的虚假繁荣，需要立刻回看入课人群质量，并检查是不是把难度压到了学得动却学不深的地步，这类虚假繁荣最难在单看一个指标时被发现。",
        ],
        mechanism: [
          "五段式口径：分子算的是什么、分母在谁身上算、时间窗按事件时间还是入库时间且是开区间还是闭区间、过滤条件是否排除测试号与内部账号、去重键按用户还是按订单。五段里最容易漏的是时间窗与去重键，它们也是同名指标对不上的头号原因。",
          "指标树分三层：结果层看经营健康度，过程层看转化与留存环节，护栏层守住质量与成本约束。每往下一层，指标就要更贴近可执行动作，例如完课率往下拆成首次开课率与中途放弃率，前者靠提醒、后者靠内容节奏。",
          "口径落地要靠指标字典而不是口头共识：字典里存指标名、五段定义、负责人、更新频率和数据源表，看板只引用字典条目、不各自写 SQL。这才是「同一指标只有一个可信口径」的技术保证，也让口径变更可追溯。",
        ],
        example: {
          title: "把五段口径写进 SQL 注释与查询骨架",
          language: "sql",
          code:
            "-- 指标：近 7 日活跃付费完课学员数\n-- 分子：窗口内至少完成 1 节课的学员\n-- 分母：同一窗口内处于付费有效期的学员\n-- 时间窗：[today - 6, today] 闭区间，按事件时间（UTC）\n-- 过滤：排除内部账号 is_internal = false\n-- 去重：按 user_id 去重，不按课程或订单\nwith active_paid as (\n  select distinct e.user_id\n  from lesson_events e\n  join paid_periods p\n    on p.user_id = e.user_id\n   and e.event_at >= p.starts_at\n   and e.event_at <  p.ends_at\n  where e.event_at >= current_date - interval '6 day'\n    and e.event_name = 'lesson_complete'\n    and e.is_internal = false\n)\nselect count(*) as active_paid_complete\nfrom active_paid;",
          explanation:
            "这段查询把五段口径直接写进注释与结构里：时间窗用闭区间明确到天，过滤条件排除内部账号，去重键明写 user_id。任何人拿到它都能复算出同一个数；口径变了，改的是这里的注释与条件，而不是某个人脑子里的默认值。",
        },
        practiceSteps: [
          "挑一个看板上最常被引用的指标，把它拆成五段式写下来。",
          "找出至少两个页面里同名指标的 SQL 差异，判断哪个才是权威口径。",
          "为北极星指标画出三层指标树，给每个节点标注负责人与更新频率。",
          "给一个过程指标补上护栏指标，避免只看单边收益。",
        ],
        masteryChecklist: [
          "能独立写出一个五段式口径，并让同事照着复算出同一个数。",
          "能解释结果指标、过程指标、护栏指标的差别，并各举一例。",
        ],
        summary: [
          "指标体系是树，不是清单。",
          "口径必须写成五段：分子、分母、时间窗、过滤条件、去重键。",
          "结果看健康度、过程看卡点、护栏看代价，三层缺一不可。",
          "指标字典是单一事实来源，页面只引用不复制。",
        ],
        terms: [
          {
            term: "北极星指标（North Star Metric）",
            plain: "最能代表产品给用户创造价值的那一个数。",
            detail:
              "它要同时满足三点：反映真实价值、能被团队动作影响、无法靠短期手段刷高。用收入当北极星常见但滞后；用注册数只增不减，容易掩盖真实问题。",
          },
          {
            term: "指标树（Metric Tree）",
            plain: "把一个结果指标一层层拆成能动手改的小指标。",
            detail:
              "拆分要满足近似可加或可乘的关系，例如完课率可拆成开课率乘以开课后完课率。子指标与父指标在数学上无关，那只是标签分类，不是指标树。",
          },
          {
            term: "口径（Metric Definition）",
            plain: "这个数到底怎么算的，写清楚别人才能复算。",
            detail:
              "五段式是常见做法：分子、分母、时间窗、过滤条件、去重键。时间窗与去重键最容易被忽略，也是同名指标对不上的主要原因。",
          },
          {
            term: "护栏指标（Guardrail Metric）",
            plain: "防止你为了拔高主指标而伤害别处的监控项。",
            detail:
              "例如提升完课率时同时盯退款率与投诉率。护栏指标不追求变好，只要求不变坏；一旦越界，就该怀疑主指标的提升是掺水的。",
          },
        ],
      },
    },
    questions: [
      {
        key: "data-analysis-exp-data-metric-system-s1",
        stageKey: "data-cleaning",
        topicKey: "data-metric-system",
        type: "single",
        stem: "关于指标口径，下面哪种做法最能让两个团队报出同一个数？",
        options: [
          { key: "A", text: "各自在自己的看板 SQL 里写活跃定义，只要指标名字一样就行" },
          { key: "B", text: "把指标写成分子、分母、时间窗、过滤条件、去重键五段，存进指标字典，看板引用同一条定义" },
          { key: "C", text: "只统计有登录事件的用户，因为登录最客观" },
          { key: "D", text: "统一改用累计注册用户数，避免口径分歧" },
        ],
        answer: ["B"],
        explanation:
          "口径分歧的根源是定义散落在各自的 SQL 里。五段式把分子、分母、时间窗、过滤条件和去重键固定下来，再存进指标字典作为唯一来源，看板只引用不复制，才能保证两边复算出同一个数。只统一指标名没有用，定义还是各写各的；换成累计注册数也不是解决口径，而是换了一个更钝的指标。",
        difficulty: "medium",
        tags: ["指标体系", "口径", "指标字典"],
        sourceKey: "ms-data-science",
        level: "进阶",
      },
      {
        key: "data-analysis-exp-data-metric-system-j1",
        stageKey: "data-cleaning",
        topicKey: "data-metric-system",
        type: "judge",
        stem: "只要指标名称相同，两个页面的数字不一致就一定是数据管道出错。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "同名指标不一致，更常见的原因是口径不同：时间窗按事件时间还是入库时间、分母是全量用户还是新用户、是否按用户去重、有没有排除内部账号，任何一项不同都会让数字差出可观幅度。正确顺序是先对齐五段式定义再查管道，否则会花大量时间在一个定义问题上游荡。",
        difficulty: "hard",
        tags: ["口径", "指标", "数据质量"],
        sourceKey: "ms-data-science",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "data-analysis",
    stageKey: "data-analysis-sql",
    topic: {
      key: "data-funnel-attribution-window",
      title: "漏斗的严格时序与归因窗口",
      summary:
        "漏斗不是把几个步骤的独立人数相除，而是要求同一批用户在限定窗口内按顺序走完；分母必须是进入第一步的全量用户，否则算出来的转化率会系统性偏高。",
      concepts: ["严格时序", "归因窗口", "步骤互斥", "漏斗倒挂", "幸存者偏差"],
      principles: [
        "步骤必须按时间先后发生在同一个归因窗口内，否则只是几个截面人数相除，不是漏斗。",
        "分母永远是进入第一步的全量用户，中途流失的人也要留在分母里。",
        "归因窗口长度直接改变转化率的绝对值，跨不同窗口比较两个漏斗没有意义。",
      ],
      applications: [
        "注册到首单漏斗：注册、完善资料、加购、下单，窗口设 7 天。",
        "课程试听到报名漏斗：试听、领取资料、报名、开课，按 14 天窗口归因。",
      ],
      pitfalls: [
        "用 count distinct 分别算各步骤人数再相除，会出现后一步人数多于前一步的漏斗倒挂。",
        "把窗口调长以提高转化率，于是不同团队用不同窗口比成绩。",
      ],
      method:
        "先固定用户、事件、顺序、窗口四要素，再用 CTE 为每步取窗口内首次发生时间，最后用条件计数得到每层人数与转化率。",
      exercise:
        "用 CTE 写出注册到首单的四步漏斗，要求每步都发生在注册后 7 天内，并输出每层人数、相对上一层与相对第一步的转化率。",
      checkpoint:
        "能解释漏斗为什么必须带时间窗口，以及把窗口从 7 天改成 30 天后每一层人数会怎么变。",
      lesson: {
        overview: [
          "漏斗回答的是有多少人从起点走到了终点，而它成立的前提是这条路真的被同一批人走过。如果把四步的独立人数直接相除，你算的是四个截面的比例，不是一段旅程，结论甚至可能和真实情况相反，看起来每层都还行，实际几乎没人走完，而团队会据此误判某个环节做得不错，继续往那里加码。",
          "第二个容易忽略的是分母。只统计走到第 N 步的人再去算下一步转化，看起来每层都很高，实际上把中途流失的人藏了起来。漏斗的分母只能是进入第一步的全量用户，只有把走掉的人留在分母里，流失率才是它真正想告诉你的东西，也才对得起转化这个词。",
          "第三个是窗口。用户注册后第 40 天才下单，算不算这次注册的功劳？7 天窗口说不算，30 天窗口说算，两个答案都自洽，但它们不是同一个指标。窗口必须和业务决策周期绑定，并写进报表标题，否则跨期比较会变成一场没有共识的争论，谁也说不清两个数字到底差在哪里、该不该照着它做决策。",
        ],
        mechanism: [
          "严格时序意味着第 k 步的事件时间必须晚于第 k-1 步。实现上通常对每个用户取每一步在窗口内的首次发生时间，再用条件聚合把顺序写成可比较的列，例如要求 t2 不早于 t1，只有满足比较关系的行才计入该层人数。",
          "归因窗口是在严格时序上加一条时间上限：最后一步与第一步的时间差不得超过 N 天。它决定哪些旅程被计入分子。窗口太短会漏掉长决策周期的业务，太长则把复购混进首单转化，两种偏差都难以事后察觉。",
          "步骤互斥与倒挂检查是自检手段：如果第 3 步人数大于第 2 步，说明口径不是同一批人的顺序旅程，或者事件定义有重叠，例如加购事件里混进了下单日志。倒挂往往不是数据脏，而是口径错，先对齐事件定义再回头查管道，能省掉大量对数的时间。",
        ],
        example: {
          title: "带严格时序与 7 天窗口的 CTE 漏斗",
          language: "sql",
          code:
            "-- 注册 → 完善资料 → 加购 → 下单（7 天归因窗口）\nwith base as (\n  select user_id, min(registered_at) as t0\n  from users\n  group by user_id\n),\nsteps as (\n  select b.user_id,\n         b.t0,\n         min(e.event_at) filter (where e.event_name = 'profile_done') as t1,\n         min(e.event_at) filter (where e.event_name = 'add_cart')     as t2,\n         min(e.event_at) filter (where e.event_name = 'place_order')  as t3\n  from base b\n  left join events e\n    on e.user_id = b.user_id\n   and e.event_at >= b.t0\n   and e.event_at <  b.t0 + interval '7 day'\n  group by b.user_id, b.t0\n)\nselect\n  count(*) as step0_users,\n  count(*) filter (where t1 is not null and t1 >= t0) as step1_users,\n  count(*) filter (where t2 is not null and t2 >= t1) as step2_users,\n  count(*) filter (where t3 is not null and t3 >= t2) as step3_users\nfrom steps;",
          explanation:
            "三件事撑起这个漏斗：base 固定了分母，每个注册用户一行；left join 里的事件时间条件把窗口外的行为排除；条件聚合里的 t2 不早于 t1 把顺序约束写进了筛选。某层人数反而变多时，先查事件定义和窗口，再谈报数。",
        },
        practiceSteps: [
          "写下漏斗四要素：用户口径、事件定义、步骤顺序、归因窗口。",
          "用 base CTE 固定分母，保证流失用户在后续层里是 0 而不是消失。",
          "把每层人数与转化率并排输出，检查是否出现倒挂。",
          "把窗口从 7 天换成 30 天，观察每层变化并解释差异来源。",
        ],
        masteryChecklist: [
          "能说明漏斗分母为什么不能只包含走到该步的人。",
          "能手写带严格时序和窗口约束的 CTE 漏斗，并读出每层人数。",
        ],
        summary: [
          "漏斗等于同一批用户、严格顺序、限定窗口三件套。",
          "分母是进入第一步的全量用户，不是走到当前步的人。",
          "窗口长度改变绝对值，必须写进报表标题。",
          "出现倒挂先查口径，不要急着报数。",
        ],
        terms: [
          {
            term: "归因窗口（Attribution Window）",
            plain: "从第一步算起，多久之内走完才算这次转化。",
            detail:
              "窗口按第一步时间起算，而不是从最后一步回溯；闭区间还是半开区间也会差一天，建议统一写成从 t0 到 t0 加 N 天的半开区间。",
          },
          {
            term: "漏斗倒挂",
            plain: "后一步的人数比前一步还多，说明算法有问题。",
            detail:
              "常见原因是各步骤独立统计、事件定义重叠、或没有加时序约束。倒挂不是数据脏，而是口径错，应该先修定义再看数。",
          },
          {
            term: "幸存者偏差（Survivorship Bias）",
            plain: "只看到留下来的人，忽略了已经走掉的人。",
            detail:
              "漏斗里把分母换成走到当前步的人，等于只统计留下来的用户，转化率会系统性偏高，且越往后的步骤偏得越多。",
          },
          {
            term: "严格时序",
            plain: "后一步必须真的在前一步之后发生。",
            detail:
              "实现上要比较事件时间而不是表里的自增 id，补录与回刷数据都可能让 id 顺序与业务时间顺序相反。",
          },
        ],
      },
    },
    questions: [
      {
        key: "data-analysis-exp-data-funnel-attribution-window-s1",
        stageKey: "data-analysis-sql",
        topicKey: "data-funnel-attribution-window",
        type: "single",
        stem: "某个四步漏斗算出来第 3 步人数比第 2 步还多，最可能的原因是什么？",
        options: [
          { key: "A", text: "用户量太少，纯属统计噪声" },
          { key: "B", text: "各步骤是独立人数相除，没有要求同一用户按时间顺序走完" },
          { key: "C", text: "数据库时区设置有误" },
          { key: "D", text: "应该把分母改成第一步的人数" },
        ],
        answer: ["B"],
        explanation:
          "倒挂的典型原因是把每一步的人数当成独立截面统计再相除，这样根本没有同一批人按顺序走的约束，后一步人数完全可以多于前一步。正确做法是用 CTE 固定分母用户，为每步取窗口内首次发生时间，再用后一步时间不早于前一步的条件把顺序写进筛选。时区问题会整体平移日期但不会系统性造成倒挂，改分母只能修正比率、不能消除倒挂本身。",
        difficulty: "medium",
        tags: ["漏斗", "时序", "归因窗口"],
        sourceKey: "ms-data-science",
        level: "进阶",
      },
      {
        key: "data-analysis-exp-data-funnel-attribution-window-j1",
        stageKey: "data-analysis-sql",
        topicKey: "data-funnel-attribution-window",
        type: "judge",
        stem: "把漏斗的归因窗口从 7 天放宽到 30 天，只要窗口内的转化都被算作有效，两个漏斗的转化率就可以直接比较。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "窗口一变，分子覆盖的旅程范围就变了：7 天窗口只统计短决策周期的用户，30 天窗口把长决策周期的用户也算了进来，分母相同而分子口径不同，两个转化率没有可比性。比较时必须固定窗口，或者在报表标题里明确标注窗口长度，再分别看各自的趋势。",
        difficulty: "medium",
        tags: ["归因窗口", "漏斗", "指标可比性"],
        sourceKey: "ms-data-science",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "data-analysis",
    stageKey: "data-cleaning",
    topic: {
      key: "data-ab-significance",
      title: "A/B 实验的显著性与统计功效",
      summary:
        "p 值回答的是「两组其实没差别时，看到这么大差异的概率有多大」，不是「实验组更好的概率」；样本量、最小可检测效应和多重比较一起决定结论能不能信。",
      concepts: ["p 值", "置信区间", "统计功效", "最小可检测效应", "多重比较"],
      principles: [
        "p 值是在原假设成立时观察到当前或更极端结果的概率，不是实验组优于对照组的概率。",
        "不显著不等于没有差异，可能只是样本量不足以检出这个量级的效应。",
        "先定主指标、样本量与停止规则，再看数据；边跑边看并随时停止会显著抬高假阳性。",
      ],
      applications: [
        "课程练习功能上线前，用两比例检验判断完课率提升是否超出随机波动。",
        "推荐策略实验同时看二十个指标时，用 Bonferroni 或 FDR 校正控制假阳性。",
      ],
      pitfalls: [
        "只报 p 值不报效应量与置信区间，把零点一个百分点的显著提升当成大胜利。",
        "一组实验反复观察十几次，第一次显著的那天就宣布胜利。",
      ],
      method:
        "先写假设、主指标与最小可检测效应，再估算所需样本量；实验结束看效应量与置信区间，多指标做多重比较校正。",
      exercise:
        "给一个基线转化率 10%、希望检出绝对 1 个百分点提升的实验估算样本量，并说明为什么不能只看 p 值下结论。",
      checkpoint:
        "能解释 p 值、功效、最小可检测效应三者的关系，并说出反复偷看为什么危险。",
      lesson: {
        overview: [
          "A/B 实验最容易犯的错，是把 p 值当成实验组更好的概率。它其实是反过来的条件概率：假设两组真的没有差别，出现当前这种或更极端结果的概率。小于 0.05 只说明这种结果在无差别世界里不常见，既不说明提升一定真实，更不说明这点提升值得上线，甚至不保证方向一定是对的。",
          "第二个错是只看显著性不看效应量。样本足够大时，任何微小差异都会显著：零点一个百分点的转化提升在百万级样本下也能拿到极小的 p 值。这时真正该问的是这点提升够不够覆盖改动与维护成本，而置信区间比 p 值更能回答这个问题，它直接把提升幅度的可能范围摊开给你看。",
          "第三个错是实验节奏。每天看一次数据、看到显著就停，会让假阳性率从百分之五涨到百分之二三十。样本量和停止规则必须在实验开始前定好，这不是流程洁癖，而是让结论有意义的前提，也是事后能说清为什么停、以及这次结论只覆盖哪一段时间和人群的唯一依据。",
        ],
        mechanism: [
          "两比例检验把两组转化率之差标准化：差值除以合并比例下的标准误得到 z 值，再换算成 p 值。直觉上就是把观测到的差异换算成多少个标准误，差异越大、样本越多，z 就越大，极端结果越不可能是噪声。",
          "统计功效是真有差异时能检出它的概率，通常要求八成。功效由样本量、基线水平和最小可检测效应共同决定：想检出更小的提升就需要更多样本，粗略地说样本量与效应量的平方成反比，这也是小效应实验动辄要几十万样本的原因。",
          "多重比较是隐形的通胀：同时检验二十个互相独立的指标，至少一个碰巧显著的概率接近六成五。所以主指标必须事先指定，其余指标要么做校正，要么只当探索线索，不能用来宣布胜利，否则二十个指标里总能挑出一个好看的来交差。",
        ],
        example: {
          title: "同时输出 z、p 值与差值的置信区间",
          language: "python",
          code:
            "import math\n\ndef two_proportion_test(n_a, x_a, n_b, x_b):\n    p_a, p_b = x_a / n_a, x_b / n_b\n    p_pool = (x_a + x_b) / (n_a + n_b)\n    se = math.sqrt(p_pool * (1 - p_pool) * (1 / n_a + 1 / n_b))\n    z = (p_b - p_a) / se\n    # 双侧 p 值：正态近似\n    p_value = 2 * (1 - 0.5 * (1 + math.erf(abs(z) / math.sqrt(2))))\n    # 差值的 95% 置信区间，用不合并的标准误\n    se_diff = math.sqrt(p_a * (1 - p_a) / n_a + p_b * (1 - p_b) / n_b)\n    low = (p_b - p_a) - 1.96 * se_diff\n    high = (p_b - p_a) + 1.96 * se_diff\n    return round(z, 3), round(p_value, 5), (round(low, 4), round(high, 4))\n\nz, p, ci = two_proportion_test(10000, 1000, 10000, 1100)\nprint(z, p, ci)",
          explanation:
            "这段代码刻意同时输出 z、p 值和差值的置信区间。只报 p 值会丢掉效应大小：置信区间跨过 0 说明差异方向都不确定；下限只比 0 高一点点，说明即使显著，提升幅度也可能不足以支撑上线决策。",
        },
        practiceSteps: [
          "写下实验假设、主指标与最小可检测效应。",
          "按基线水平和效应量估算所需样本量，并写进实验方案。",
          "实验结束后同时报告效应量、置信区间与 p 值。",
          "多指标场景先定主指标，其余指标做多重比较校正。",
        ],
        masteryChecklist: [
          "能用自己的话说清 p 值的条件概率含义。",
          "能解释为什么样本量足够大时微小差异也会显著。",
        ],
        summary: [
          "p 值是无差别时看到这种结果的概率，不是更好的概率。",
          "不显著可能是样本不够，显著也可能小到不值得做。",
          "功效由样本量、基线、最小可检测效应共同决定。",
          "同时看二十个指标等于给自己发一张假阳性彩票，主指标必须事先定。",
        ],
        terms: [
          {
            term: "p 值（p-value）",
            plain: "假设两组没差别，出现这么大差距的概率。",
            detail:
              "它不对差异有多大、是否重要作任何承诺。p 值小只说明结果在无差别假设下少见，仍可能来自随机波动、口径问题或多重比较。",
          },
          {
            term: "统计功效（Power）",
            plain: "真有提升时，实验能把它检出来的把握。",
            detail:
              "常取八成，意味着真有差异时仍有两成概率漏掉。功效不足的实验得到不显著结论，不能反过来说证明了没效果。",
          },
          {
            term: "最小可检测效应（MDE）",
            plain: "这次样本量下，能可靠看到的最小提升幅度。",
            detail:
              "先定最小可检测效应再算样本量。业务只关心两个点以上的提升，就不该用只为检出五个点设计的样本量去做实验。",
          },
          {
            term: "多重比较（Multiple Comparison）",
            plain: "同时看好几个指标，总有一个碰巧显著。",
            detail:
              "检验次数越多，至少一次假阳性的概率越高。对策是事先指定主指标，或对次要指标做 Bonferroni、FDR 之类的校正。",
          },
          {
            term: "偷看（Peeking）",
            plain: "实验没跑完就反复看结果，看到显著就停。",
            detail:
              "每多看一次就多一次抽奖机会，假阳性率会远超名义的百分之五。要提前判断就得用序贯检验，而不是随手多刷几次报表。",
          },
        ],
      },
    },
    questions: [
      {
        key: "data-analysis-exp-data-ab-significance-s1",
        stageKey: "data-cleaning",
        topicKey: "data-ab-significance",
        type: "single",
        stem: "某实验实验组转化率 11.0%、对照组 10.0%，两万人级别样本下 p 值为 0.04。下面哪个结论最站得住？",
        options: [
          { key: "A", text: "实验组更好的概率是 96%" },
          { key: "B", text: "无差别假设下出现这种差异的概率约 4%，方向可信，但仍要看置信区间判断幅度是否有业务意义" },
          { key: "C", text: "p 小于 0.05 说明提升一定真实且值得上线" },
          { key: "D", text: "样本太小，结论无效" },
        ],
        answer: ["B"],
        explanation:
          "p 值 0.04 的含义是：如果两组真的没有差别，出现当前或更极端差异的概率约 4%，它并不表示实验组更好的概率是 96%。显著只说明差异不太可能纯属随机波动，是否值得上线还要看效应量和置信区间：绝对一个百分点的提升在不同业务里的价值差别很大，也可能被改动的维护成本吃掉。",
        difficulty: "medium",
        tags: ["A/B", "p 值", "置信区间"],
        sourceKey: "ms-data-science",
        level: "进阶",
      },
      {
        key: "data-analysis-exp-data-ab-significance-j1",
        stageKey: "data-cleaning",
        topicKey: "data-ab-significance",
        type: "judge",
        stem: "实验进行到第 5 天主指标已经显著，此时立刻停止实验并宣布胜利是统计上安全的做法。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "中途反复查看并在第一次显著时停止，会大幅抬高假阳性率，因为每一次查看都是一次额外的检验机会，而实验早期的数据波动最大。正确做法是实验前定好样本量与停止规则；确实需要提前判断时，应使用序贯检验之类的专门方法，并把停止规则写进实验方案。",
        difficulty: "hard",
        tags: ["实验设计", "偷看", "假阳性"],
        sourceKey: "ms-data-science",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "data-analysis",
    stageKey: "data-cleaning",
    topic: {
      key: "data-missing-outlier-treatment",
      title: "缺失机制与异常值处理",
      summary:
        "缺失分三类：完全随机、与已观测变量相关、与缺失值本身相关；异常值也分两类：录入错误与真实极端。先分清类型，再谈填补还是删除，否则清洗本身就是偏差来源。",
      concepts: ["MCAR/MAR/MNAR", "缺失指示变量", "IQR 与稳健 z 分数", "缩尾处理", "敏感度对比"],
      principles: [
        "缺失机制决定处理方式：随机缺失可以填补，依赖未观测原因的缺失填补后会引入系统性偏差。",
        "任何填补都会压缩方差、制造虚假确定性，必须同时保留缺失标记并做敏感度对比。",
        "异常值先判断是错误值还是真实极端值；强偏态分布上用均值加减三倍标准差，会把长尾业务当成脏数据。",
      ],
      applications: [
        "设备日志缺失：按设备与日期统计缺失率，区分离线、采集失败与确实没有数据。",
        "订单金额异常：先用分位数与业务上限识别，再决定回查、缩尾还是单列分析。",
      ],
      pitfalls: [
        "无差别用均值填补数值列，把缺失比例高的分组整体拉向均值。",
        "直接删掉所有含缺失的行，样本从一万条掉到三千条却不比较分布变化。",
      ],
      method:
        "先量化缺失率与缺失模式判断机制，再选择标记、填补或排除；用删前删后的分布与指标差异做敏感度对比，异常值同样先定性再定量。",
      exercise:
        "对一份含缺失与极端值的设备日志，输出缺失率表、异常值清单和处理方案，并说明每种处理对关键指标的影响方向。",
      checkpoint:
        "能对任一缺失列判断机制类型，并说明所选处理方式会怎样影响最终结论。",
      lesson: {
        overview: [
          "缺失值处理的第一步不是填什么，而是为什么缺。同样是空值，用户没填手机号、系统没采集到、和用户故意不填，背后是完全不同的机制。机制不同，处理方式也不同：随机缺失可以放心填补，而依赖未观测原因的缺失，填补只会把偏差藏得更深，让人误以为数据齐了。",
          "异常值也是同理。销售数据里突然冒出一单十倍金额，可能是录入错误，也可能是大促或者团购，把两者一律当噪声删掉，等于删掉了最有信息量的样本。所以处理顺序永远是先定性这是什么，再定量怎么处理，最后留痕说明处理了什么、影响了哪些行，让结论可以被追溯和复现。",
          "还有一个常被忽略的代价：填补会压缩方差。把缺失的金额填成均值，等于告诉后续的分析这些用户和平均值一模一样，不确定性被抹平，置信区间变窄、显著性检验偏乐观，结论会显得比证据更强。这不是统计学细节，而是最容易在汇报里被放大的隐患之一。",
        ],
        mechanism: [
          "缺失机制分三类：完全随机缺失与任何变量无关；随机缺失与已观测变量有关，例如新用户更常留空；非随机缺失与缺失值本身有关，例如高收入者更不愿填收入。判断方式主要是比较缺失组与非缺失组在其它列上的分布差异。",
          "处理手段有四档：保留并加缺失指示变量、按分组统计量填补、用模型预测填补、直接排除。越往后对假设的依赖越强，所以高缺失率列优先保留标记，低缺失率才考虑填补，并且始终报告填补比例与受影响分组。",
          "异常值检测常用分位数法与稳健 z 分数：分位数法把超出上四分位加一点五倍四分位距、下四分位减一点五倍四分位距的点标为离群；稳健 z 分数用中位数与绝对偏差中位数代替均值与标准差，避免极端值自己把阈值抬高。",
        ],
        example: {
          title: "缺失率、IQR 边界与稳健 z 分数",
          language: "python",
          code:
            "from statistics import median\n\ndef missing_rate(rows, col):\n    empty = sum(1 for r in rows if r.get(col) in (None, ''))\n    return round(empty / len(rows), 4)\n\ndef iqr_bounds(values):\n    s = sorted(values)\n    q1 = s[len(s) // 4]\n    q3 = s[(3 * len(s)) // 4]\n    iqr = q3 - q1\n    return q1 - 1.5 * iqr, q3 + 1.5 * iqr\n\ndef robust_z(value, values):\n    med = median(values)\n    mad = median([abs(v - med) for v in values]) or 1\n    return round(0.6745 * (value - med) / mad, 2)\n\namounts = [120, 130, 125, 9000, 128, 122]\nlow, high = iqr_bounds(amounts)\nprint('missing', missing_rate([{'a': None}, {'a': 1}], 'a'))\nprint('outliers', [v for v in amounts if v < low or v > high])",
          explanation:
            "三件小事：缺失只看比例不够，还要按分组看差异；IQR 用四分位数而不是均值，天然抗极端值；稳健 z 分数里的零点六七四五是把绝对偏差中位数折算成正态标准差的一致性系数。实际处理时先把异常值标出来，再决定回查、缩尾还是单独分析。",
        },
        practiceSteps: [
          "统计每一列的缺失率，并按关键分组比较缺失组与非缺失组的分布。",
          "判断缺失机制属于完全随机、随机还是非随机，并记录判断依据。",
          "用分位数法或稳健 z 分数标出异常候选，再逐条定性。",
          "处理前后各算一遍核心指标，把差异与处理规则写进清洗日志。",
        ],
        masteryChecklist: [
          "能对一列缺失说出机制类型和相应处理理由。",
          "能解释为什么均值填补会低估方差、抬高显著性。",
        ],
        summary: [
          "先问为什么缺，再决定填什么。",
          "填补会压缩方差，必须保留缺失标记并做敏感度对比。",
          "异常值先定性：错误值修，真实极端值留。",
          "强偏态分布上用 IQR 或稳健 z 分数，别用三倍标准差。",
        ],
        terms: [
          {
            term: "完全随机缺失（MCAR）",
            plain: "缺不缺跟谁都没关系，纯属运气。",
            detail:
              "只有这种情况下，直接删除缺失行才不会引入偏差。现实中真正的完全随机缺失很少，多数缺失都和用户特征或采集时段有关。",
          },
          {
            term: "非随机缺失（MNAR）",
            plain: "缺不缺，取决于这个值本身有多大。",
            detail:
              "例如高收入者更不愿填收入。这类缺失无法靠已观测变量修正，只能做敏感性分析，或者换一种采集方式。",
          },
          {
            term: "四分位距（IQR）",
            plain: "中间一半数据的跨度，用来看多远算离谱。",
            detail:
              "把上四分位减去下四分位作为尺度，超出一点五倍四分位距的点标为离群。它不假设正态分布，在订单金额这类长尾数据上比三倍标准差稳。",
          },
          {
            term: "缩尾（Winsorize）",
            plain: "把极端值压到分位数边界上，而不是删掉。",
            detail:
              "例如超过九十九分位的值统设为该分位值，既保留样本量又削弱极端值影响。代价是改变了原始分布，必须在清洗日志里写明用了哪个分位点。",
          },
        ],
      },
    },
    questions: [
      {
        key: "data-analysis-exp-data-missing-outlier-treatment-s1",
        stageKey: "data-cleaning",
        topicKey: "data-missing-outlier-treatment",
        type: "single",
        stem: "某列收入字段缺失率 30%，且缺失者中有八成是刚注册的新用户。最合理的初步处理是？",
        options: [
          { key: "A", text: "直接删除所有缺失行" },
          { key: "B", text: "判断为与已观测变量相关的缺失，按用户类型分层填补并保留缺失指示变量" },
          { key: "C", text: "用全体均值填补，因为均值无偏" },
          { key: "D", text: "把缺失值填成 0，表示没有收入" },
        ],
        answer: ["B"],
        explanation:
          "缺失集中在特定人群，说明缺失与已观测变量相关。直接删除会让样本严重偏向老用户，用全体均值填补又会抹掉分层差异。合理做法是按分层统计量填补，同时加缺失指示变量保留信息，并在报告里说明填补比例与影响。填 0 等于把缺失当成真实的零收入，会把均值与分位数一起带偏。",
        difficulty: "medium",
        tags: ["缺失值", "分层", "数据清洗"],
        sourceKey: "ms-data-science",
        level: "进阶",
      },
      {
        key: "data-analysis-exp-data-missing-outlier-treatment-j1",
        stageKey: "data-cleaning",
        topicKey: "data-missing-outlier-treatment",
        type: "judge",
        stem: "用均值填补数值列的缺失值，会让该列的方差变小，并可能让后续的显著性检验显得比实际更显著。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "把所有缺失位置都填成同一个均值，等于人为制造了一批恰好等于中心的观测，列内波动被压缩、方差变小，标准误也随之变小。在同样的均值差下，标准误变小会让检验统计量变大、p 值变小，于是结果看起来更显著。这也是为什么填补后要报告填补比例并做敏感度对比。",
        difficulty: "hard",
        tags: ["填补", "方差", "统计推断"],
        sourceKey: "ms-data-science",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "data-analysis",
    stageKey: "data-visual-delivery",
    topic: {
      key: "data-visual-encoding-choice",
      title: "视觉编码与图表选型",
      summary:
        "人眼对位置和长度的判断远准于角度和面积，所以比较类问题几乎都该用条形图；选图的实质是给问题挑一条合适的编码通道，而不是给数据挑一个好看的形状。",
      concepts: ["视觉编码通道", "位置与长度", "颜色映射", "双轴陷阱", "基准线与排序"],
      principles: [
        "编码通道的精度有排序：位置和长度最好，角度与面积差得多，所以精确比较不要用饼图。",
        "一张图只回答一个问题，问题结构决定图形；先写结论句再选图。",
        "颜色是辅助通道，不能承担唯一区分职责；分类超过五六种就该换图形或分面。",
      ],
      applications: [
        "周报趋势：折线图配同比基准线，重点标拐点而不是每个点。",
        "分类对比：排序后的水平条形图，直接读排名与差距。",
      ],
      pitfalls: [
        "双轴折线把两条无关曲线放到一起，制造虚假相关。",
        "Y 轴不从 0 开始又未标注截断，夸大微小差异。",
      ],
      method:
        "先写出要回答的一句话，判断问题属于比较、趋势、构成、分布还是关系，再按编码精度挑图形并做减法：去网格、去渐变、排序、加基准线。",
      exercise:
        "给四个问题（哪类课程最受欢迎、完课率三个月走势、用户活跃时段分布、投入与产出的关系）各选一种图，并写出图标题与一句结论。",
      checkpoint:
        "能说明为什么分类多时条形图优于饼图，并指出一张图里多余的编码通道。",
      lesson: {
        overview: [
          "选图不是审美问题，而是精度问题。人眼比较两个元素时判断谁更长几乎不出错，判断谁的角度更大却经常差几个百分点。既然编码通道的精度不同，用饼图表达十二个类别的构成，就是在用最差的通道做最需要精度的那件事，读者只能凭感觉给类别排序。",
          "第二层是问题结构。同一个数据集，问哪类最多要排序条形图，问怎么变要折线图，问集中在哪要直方图或热力图。先有一句明确的问题，图才有唯一正确的答案；没有问题，任何图都只是把数据重画了一遍，读者看完仍然不知道该做什么，只是又复习了一遍数据长什么样。",
          "第三层是减法。大多数图的信息密度被装饰稀释：网格线、渐变、三维效果、十种颜色。删掉它们不会丢信息，反而让差异更快被看到。排序、加基准线、把结论写进标题，这三件小事的收益远大于换一个更花哨的图表库，也更容易在评审现场被接受，因为它们降低的是读者的判断成本，而不是增加展示技巧。",
        ],
        mechanism: [
          "视觉编码通道的精度大致排序为位置、长度、角度、面积、颜色明度、颜色色相。所以精确比较用条形图与散点图，表达构成可以用堆叠条形，尽量不用饼图与环形图，因为它们的差别只体现在角度上，而角度恰恰是误差最大的那种比较，读者很难判断到底谁多几个百分点。",
          "颜色有三个用途：分类、定量、强调。分类色相超过五种就很难区分，此时应改用分面或直接标注；定量要用连续色阶而不是彩虹色阶；强调只需要一个高亮色，其余灰掉，读者视线会自动被拉过去，不需要图例再解释一遍。",
          "双轴图的危险在于它允许你自由选择两条曲线的尺度，从而让任意两条数据都看起来同步。除非两条曲线的单位确实相关并明确标注了各自的轴，否则应拆成两张上下对齐、共享横轴的图，让读者自己比较形状。",
        ],
        example: {
          title: "把选图规则写成可讨论的代码",
          language: "python",
          code:
            "# 先判断问题类型，再看分类数量\n# compare 比较 / trend 趋势 / composition 构成 / distribution 分布 / relation 关系\ndef pick_chart(question, categories=None, time_axis=False):\n    if question == 'compare':\n        return 'sorted_bar' if (categories or 0) <= 12 else 'sorted_bar_top10_plus_other'\n    if question == 'trend':\n        return 'line_with_baseline' if time_axis else 'line'\n    if question == 'composition':\n        return 'stacked_bar' if (categories or 0) > 4 else 'bar'\n    if question == 'distribution':\n        return 'heatmap' if time_axis else 'histogram'\n    return 'scatter'\n\nprint(pick_chart('composition', categories=12))\nprint(pick_chart('trend', time_axis=True))\nprint(pick_chart('compare', categories=6))",
          explanation:
            "这个小函数把选图规则写成可以评审的代码：比较类永远落到排序条形图，构成类在分类超过四个时就换成堆叠条形，而不是继续用饼图。规则写下来之后，团队评审图表时讨论的是问题类型判断得对不对，而不是我更喜欢哪种图。",
        },
        practiceSteps: [
          "给每张图写一句它要回答的问题，写不出来的图就删掉。",
          "按比较、趋势、构成、分布、关系五类选择图形，并按编码精度取舍。",
          "做减法：去掉网格与渐变，分类排序，加一条基准线。",
          "检查是否用了双轴、截断轴或超过五种分类色，逐项修正。",
        ],
        masteryChecklist: [
          "能说出三种视觉编码通道并排出精度顺序。",
          "能指出一张图里多余的编码通道，并给出简化方案。",
        ],
        summary: [
          "选图是给问题挑编码通道，不是给数据挑形状。",
          "位置和长度最准，角度和面积最差，精确比较用条形图。",
          "分类超过五个就换图形，颜色不承担唯一区分职责。",
          "双轴、截断轴、彩虹色阶是三个高频误导源。",
        ],
        terms: [
          {
            term: "视觉编码（Visual Encoding）",
            plain: "把数字变成位置、长度、颜色这些看得见的东西。",
            detail:
              "同一份数据可以用不同通道表达，通道精度不同。选图本质上就是选通道，而不是选装饰风格。",
          },
          {
            term: "双轴图（Dual Axis）",
            plain: "一张图里左右两个纵轴，各画一条线。",
            detail:
              "最大的问题是两个轴的尺度可以随意调，从而制造出并不存在的同步关系。要用就必须标明单位，并说明为什么把这两条线放在一起。",
          },
          {
            term: "分面（Small Multiples）",
            plain: "同一个图按类别拆成好几张小图并排看。",
            detail:
              "分类多、颜色不够用时，分面比堆在一张图里更清晰，因为每张小图共享同样的坐标尺度，仍然可以横向比较。",
          },
          {
            term: "基准线（Baseline）",
            plain: "图上那条用来对比的参考线，比如目标或去年同期。",
            detail:
              "没有基准线的趋势图只能看出在动，看不出算好还是算坏。基准线通常来自目标值、历史同期或对照组。",
          },
        ],
      },
    },
    questions: [
      {
        key: "data-analysis-exp-data-visual-encoding-choice-s1",
        stageKey: "data-visual-delivery",
        topicKey: "data-visual-encoding-choice",
        type: "single",
        stem: "要在周报里展示 12 个课程类别的报名人数对比，最合适的图形是？",
        options: [
          { key: "A", text: "12 个扇区的饼图" },
          { key: "B", text: "按人数排序的水平条形图" },
          { key: "C", text: "带两条纵轴的双轴折线图" },
          { key: "D", text: "三维环形图" },
        ],
        answer: ["B"],
        explanation:
          "比较类问题的核心是判断谁多谁少、差多少，而人对长度的判断精度远高于角度和面积。排序后的条形图让排名一眼可见，标签也好读。十二个扇区的饼图既难比较角度又难放标签；双轴折线与三维环形图引入了与问题无关的编码，只会增加误读。",
        difficulty: "easy",
        tags: ["可视化", "图表选型", "视觉编码"],
        sourceKey: "ms-data-science",
        level: "入门",
      },
      {
        key: "data-analysis-exp-data-visual-encoding-choice-j1",
        stageKey: "data-visual-delivery",
        topicKey: "data-visual-encoding-choice",
        type: "judge",
        stem: "把两条单位不同的曲线放进双轴图，只要标注了左右轴的单位，就不会造成误导。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "标注单位只能说明数量级，不能消除尺度自由带来的误导：左右轴的范围可以随意设定，从而让任意两条曲线看起来同步或背离。真正的问题是读者无法从图上判断这种相关是否真实存在。稳妥做法是拆成两张共享横轴、上下对齐的图，或者先做标准化再同轴比较。",
        difficulty: "medium",
        tags: ["双轴图", "图表误导", "可视化"],
        sourceKey: "ms-data-science",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "data-analysis",
    stageKey: "data-analysis-sql",
    topic: {
      key: "data-window-frame-rolling",
      title: "窗口帧与滚动指标",
      summary:
        "窗口函数默认帧是从分区开头到当前行，算累计很方便、算滚动就容易错；滚动 7 日应该按日期范围取帧而不是数 7 行，否则一旦有断档就会把更早的数据算进来。",
      concepts: ["ROWS 与 RANGE", "默认窗口帧", "滚动平均", "分区边界", "并列值"],
      principles: [
        "ROWS 按物理行数取帧，RANGE 按排序值取帧；日期有断档时两者结果完全不同。",
        "不写帧子句时默认是从分区开头到当前行，且会把排序值相同的行一起算进来。",
        "滚动指标在数据边界处不完整，前几行与最后几行不能直接和中间段比较。",
      ],
      applications: [
        "日成交额的 7 日移动平均，用于削峰并观察趋势。",
        "用户最近三次下单的平均金额与相邻订单间隔。",
      ],
      pitfalls: [
        "用 ROWS BETWEEN 6 PRECEDING 当七天，中间缺了日期就会跨月。",
        "写了 ORDER BY 却用了排名函数又没指定稳定排序，取最新一条变成随机取。",
      ],
      method:
        "先确认数据是否存在日期断档，再决定用 ROWS 还是 RANGE；用 RANGE 时写明数值间隔；最后检查首尾不完整窗口是否影响结论。",
      exercise:
        "计算每个城市每日成交额的 7 日移动平均，要求按日历日而不是行数，并说明如何处理缺失的日期。",
      checkpoint:
        "能解释同一条查询把 ROWS 换成 RANGE 后结果为什么不同，并说出默认帧包含哪些行。",
      lesson: {
        overview: [
          "窗口函数最大的好处是不压缩行：每一行都能看到与它相关的一组行算出来的值。而相关的一组行怎么界定，就是窗口帧。同一份数据，帧写错一个词，算出来的可能是七个日历日的平均，也可能是最近七条记录的平均，两者在有断档的业务数据里差别很大。",
          "默认帧是个隐藏的坑。只要写了排序却没写帧子句，帧就默认从分区第一行到当前行，并且对排序值相同的行一视同仁。算累计求和时这正好符合预期，算移动平均时就会把并列日期的数据全部卷进来，结果比预期多算了几行，而这一点从最终数字上几乎看不出来。",
          "边界处理是第三课。滚动窗口在序列开头和结尾天然不完整：第一天只有一天数据，最后一天之后没有数据。如果不做标记，图上开头会人为下探、结尾会人为走平，看起来像业务波动，其实是算法边界造成的假波动。这一点在复盘归因时特别容易被误读成业务本身的变化。",
        ],
        mechanism: [
          "ROWS 按行号取帧，前六行加当前行表示物理上的七行；RANGE 按排序值取帧，同样的写法放在日期列上表示排序值不早于当前值减去六天的所有行，因此能跨过缺失日期，覆盖真实的七个日历日，这一点在有断档的数据上尤其关键。",
          "排序值并列时，RANGE 会把所有并列行一起纳入帧，而 ROWS 按实际行序逐行推进。排名函数里也藏着同一个区别：并列名次与强行唯一序号不同，选错会让取最新一条这类操作变成随机取，同一条查询每次跑都可能给出不同的行。",
          "滚动指标的正确性还依赖分区边界：按城市分区意味着每个城市各算各的；漏写分区，全国数据会串成一条序列，七日平均直接失真。检查方法是先看每个分区的行数与日期范围，再看帧内的行数。",
        ],
        example: {
          title: "同一条查询里对照 RANGE 与 ROWS 两种帧",
          language: "sql",
          code:
            "-- 每个城市按日历日的 7 日滚动成交额（RANGE 版，可跨断档）\nwith daily as (\n  select city, order_date, sum(amount) as gmv\n  from orders\n  group by city, order_date\n)\nselect\n  city,\n  order_date,\n  gmv,\n  sum(gmv) over (\n    partition by city\n    order by order_date\n    range between interval '6 day' preceding and current row\n  ) as gmv_7d,\n  avg(gmv) over (\n    partition by city\n    order by order_date\n    rows between 6 preceding and current row\n  ) as gmv_7rows\nfrom daily\norder by city, order_date;",
          explanation:
            "同一条查询里放了两种帧，方便对照：range 按日期回看六天，缺了哪一天也仍覆盖真实的七个日历日；rows 只数物理行，一旦有断档就会滑到更早的日期。生产上通常用 range 算日历口径，用 rows 算最近 N 次记录这类以记录数为准的指标，两者不能混用。",
        },
        practiceSteps: [
          "确认序列是否存在日期断档，决定用 RANGE 还是 ROWS。",
          "显式写出帧子句，不要依赖默认帧。",
          "先验证分区边界（行数与日期范围），再验证帧内的行数。",
          "标记不完整窗口（前六天与最后六天），避免在图上误读。",
          "把结果与手工核算的一两天样例对照，确认帧取对了。",
        ],
        masteryChecklist: [
          "能说清 ROWS 与 RANGE 的取帧差别，并举一个会出错的例子。",
          "能指出默认帧包含哪些行，以及并列排序值会带来什么影响。",
        ],
        summary: [
          "窗口帧决定每行看哪一组行，是窗口函数的核心参数。",
          "ROWS 数行，RANGE 数取值范围，日期有断档时结果不同。",
          "不写帧就用默认帧，并列值会被一起纳入。",
          "首尾窗口不完整，必须标记后再解读。",
        ],
        terms: [
          {
            term: "窗口帧（Window Frame）",
            plain: "当前行计算时，往前看多少行、往后看多少行。",
            detail:
              "用 BETWEEN 与 AND 描述。排名类函数不需要帧，聚合类函数必须想清楚帧，否则默认帧会给你一个从分区开头累计的结果。",
          },
          {
            term: "RANGE 帧",
            plain: "按排序值的大小范围取行，不是按行数。",
            detail:
              "在日期列上写 interval 六天 preceding，表示排序值不早于当前值减六天的所有行，所以能跨过缺失日期，得到真正的日历窗口。",
          },
          {
            term: "分区（PARTITION BY）",
            plain: "先把数据按某个维度分组，再在每组内分别算。",
            detail:
              "分区不减少行数，只限定每行参与计算的范围。漏写分区会让不同维度的数据串在一起，是窗口函数最常见的错误。",
          },
          {
            term: "并列值（Ties）",
            plain: "排序值一样大的几行，谁先谁后没有规定。",
            detail:
              "RANGE 帧会把并列行同时纳入，强行编号的排名也建立在不确定的行序上。需要稳定结果时，在排序里再加一个唯一键。",
          },
        ],
      },
    },
    questions: [
      {
        key: "data-analysis-exp-data-window-frame-rolling-s1",
        stageKey: "data-analysis-sql",
        topicKey: "data-window-frame-rolling",
        type: "single",
        stem: "日粒度订单表在某些日期没有数据，计算 7 日滚动成交额时，哪种写法能保证覆盖真实的七个日历日？",
        options: [
          { key: "A", text: "sum(gmv) over (order by order_date rows between 6 preceding and current row)" },
          { key: "B", text: "sum(gmv) over (partition by city order by order_date range between interval '6 day' preceding and current row)" },
          { key: "C", text: "sum(gmv) over (order by order_date rows between unbounded preceding and current row)" },
          { key: "D", text: "sum(gmv) over (partition by city order by order_date rows between 6 preceding and current row)" },
        ],
        answer: ["B"],
        explanation:
          "只有 RANGE 帧按排序值的范围取行，写 interval 六天 preceding 才表示不早于当前日期减六天，即使中间缺了几天也仍然覆盖真实的七个日历日。ROWS 6 PRECEDING 只数物理行，断档时会滑到更早的日期；不写分区还会把不同城市的数据串在一起；从分区开头累计则根本不是滚动指标。",
        difficulty: "hard",
        tags: ["窗口函数", "窗口帧", "滚动指标"],
        sourceKey: "ms-data-science",
        level: "综合",
      },
      {
        key: "data-analysis-exp-data-window-frame-rolling-j1",
        stageKey: "data-analysis-sql",
        topicKey: "data-window-frame-rolling",
        type: "judge",
        stem: "在窗口函数里写了 ORDER BY 但没有写窗口帧时，默认帧只包含当前行。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "默认帧是从分区开头到当前行，并且会把排序值相同的行一起纳入。所以只写排序的 sum 得到的是累计值，不是当前行的值。想要只看当前行，必须显式写 ROWS BETWEEN CURRENT ROW AND CURRENT ROW，这也是算滚动指标时最容易漏掉的一步。",
        difficulty: "medium",
        tags: ["窗口帧", "默认帧", "SQL"],
        sourceKey: "ms-data-science",
        level: "进阶",
      },
    ],
  },
];
