import { topicQuestionPair } from "../topic-question-builders";
import type { LearningQuestion } from "../types";

export const dataAnalysisTopicQuestions: LearningQuestion[] = [
  ...topicQuestionPair(
    "data-relational-model",
    "data-relational",
    {
      stem: "报名表使用 `(user_id, course_id)` 复合主键，主要保证什么？",
      options: ["金额唯一", "同一用户不能重复报名同一课程", "课程标题唯一", "用户姓名唯一"],
      answer: "B",
      explanation: "复合主键唯一标识报名关系，防止同一组合出现重复记录。",
      difficulty: "easy",
      tags: ["主键", "关系模型"],
      sourceKey: "ms-data-science",
    },
    {
      stem: "事实表一行代表什么粒度，可以不用在建模时刻意定义。",
      answer: false,
      explanation: "事实粒度决定聚合含义和关系有效性，必须明确并保持同表一致。",
      difficulty: "medium",
      tags: ["事实表", "粒度"],
      sourceKey: "ms-data-science",
    }
  ),
  ...topicQuestionPair(
    "data-select-filter",
    "data-relational",
    {
      stem: "筛选金额字段为空的行，正确条件是什么？",
      options: ["amount = NULL", "amount IS NULL", "amount == ''", "NOT amount"],
      answer: "B",
      explanation: "NULL 表示未知，普通等值比较无法命中，必须使用 IS NULL。",
      difficulty: "easy",
      tags: ["NULL", "WHERE"],
      sourceKey: "ms-data-science",
    },
    {
      stem: "SQL 的逻辑执行顺序通常先过滤行，再进行分组和聚合。",
      answer: true,
      explanation: "WHERE 在分组前过滤输入行，HAVING 在聚合后过滤结果组。",
      difficulty: "medium",
      tags: ["执行顺序", "HAVING"],
      sourceKey: "ms-data-science",
    }
  ),
  ...topicQuestionPair(
    "data-joins",
    "data-relational",
    {
      stem: "连接退款表后订单金额膨胀，最优先检查什么？",
      options: ["退款表连接键是否重复", "字段颜色", "数据库版本", "列排列顺序"],
      answer: "A",
      explanation: "一个订单对应多条退款会产生多行匹配，聚合前应先按订单压缩到唯一粒度。",
      difficulty: "medium",
      tags: ["JOIN", "膨胀"],
      sourceKey: "ms-data-science",
    },
    {
      stem: "LEFT JOIN 会保留左表全部行，即使右表没有匹配记录。",
      answer: true,
      explanation: "未匹配的右表字段为 NULL，左表行不会因为缺少匹配而消失。",
      difficulty: "easy",
      tags: ["LEFT JOIN", "基数"],
      sourceKey: "ms-data-science",
    }
  ),
  ...topicQuestionPair(
    "data-window",
    "data-analysis-sql",
    {
      stem: "同一金额出现并列时，哪种排名会跳过后续序号？",
      options: ["ROW_NUMBER", "RANK", "DENSE_RANK", "COUNT"],
      answer: "B",
      explanation: "RANK 给并列值相同名次并跳过后续序号，例如 1、2、2、4。",
      difficulty: "medium",
      tags: ["RANK", "窗口函数"],
      sourceKey: "ms-data-science",
    },
    {
      stem: "窗口函数默认会压缩明细行，只保留每个分区的聚合结果。",
      answer: false,
      explanation: "窗口函数保留原有行数，在每行上增加分析列；GROUP BY 才会压缩行。",
      difficulty: "medium",
      tags: ["窗口函数", "明细"],
      sourceKey: "ms-data-science",
    }
  ),
  ...topicQuestionPair(
    "data-cte",
    "data-analysis-sql",
    {
      stem: "为了让复杂漏斗查询可验证，每个 CTE 最应保证什么？",
      options: ["行数越多越好", "粒度稳定且可独立检查", "不命名", "完全不聚合"],
      answer: "B",
      explanation: "稳定粒度让每步行数和指标可解释，也能单独运行定位错误。",
      difficulty: "medium",
      tags: ["CTE", "粒度"],
      sourceKey: "ms-data-science",
    },
    {
      stem: "递归 CTE 没有明确终止条件也可能持续展开。",
      answer: true,
      explanation: "递归 CTE 必须有终止条件或最大深度保护，否则可能消耗大量资源。",
      difficulty: "hard",
      tags: ["递归 CTE", "终止"],
      sourceKey: "ms-data-science",
    }
  ),
  ...topicQuestionPair(
    "data-funnel-retention",
    "data-analysis-sql",
    {
      stem: "留存分析的分母通常是什么？",
      options: ["所有活跃用户", "指定同期群的初始用户", "事件总数", "所有订单"],
      answer: "B",
      explanation: "留存先固定初始同期群作为分母，再统计其中在后续窗口活跃的用户。",
      difficulty: "medium",
      tags: ["留存", "同期群"],
      sourceKey: "ms-data-science",
    },
    {
      stem: "漏斗步骤的顺序不重要，只要用户都发生过这些事件就算转化。",
      answer: false,
      explanation: "漏斗必须遵守事件顺序和时间窗口，否则会把不符合流程的用户误算为转化。",
      difficulty: "medium",
      tags: ["漏斗", "事件顺序"],
      sourceKey: "ms-data-science",
    }
  ),
  ...topicQuestionPair(
    "data-quality",
    "data-cleaning",
    {
      stem: "删除缺失值前最应该先做什么？",
      options: ["立即删除", "检查缺失分布和样本影响", "替换为随机数", "隐藏字段"],
      answer: "B",
      explanation: "缺失集中在某些分组时删除会引入偏差，应先量化并判断缺失语义。",
      difficulty: "medium",
      tags: ["缺失值", "偏差"],
      sourceKey: "ms-data-science",
    },
    {
      stem: "数据清洗规则只需要执行，不需要记录影响范围和决策依据。",
      answer: false,
      explanation: "规则需要可追溯，才能复现、审计并评估清洗对指标和样本的影响。",
      difficulty: "easy",
      tags: ["清洗", "可追溯"],
      sourceKey: "ms-data-science",
    }
  ),
  ...topicQuestionPair(
    "data-exploration",
    "data-cleaning",
    {
      stem: "金额分布明显长尾时，哪种统计量更能代表典型值？",
      options: ["均值", "中位数", "最大值", "总和"],
      answer: "B",
      explanation: "中位数对极端值不敏感，长尾分布下通常比均值更接近典型用户。",
      difficulty: "medium",
      tags: ["中位数", "长尾"],
      sourceKey: "ms-data-science",
    },
    {
      stem: "发现相关关系后，可以直接断定一个变量导致另一个变量变化。",
      answer: false,
      explanation: "相关不等于因果，还需要实验、时间顺序和混杂因素控制。",
      difficulty: "easy",
      tags: ["相关", "因果"],
      sourceKey: "ms-data-science",
    }
  ),
  ...topicQuestionPair(
    "data-experiment",
    "data-cleaning",
    {
      stem: "A/B 实验中对照组的核心作用是什么？",
      options: ["接受新策略", "提供随机分配后的基线比较", "删除异常值", "增加样本量"],
      answer: "B",
      explanation: "对照组保持原策略，与实验组在随机分配下比较才能估计策略效果。",
      difficulty: "easy",
      tags: ["A/B", "对照组"],
      sourceKey: "ms-data-science",
    },
    {
      stem: "只要结果统计显著，即使护栏指标恶化也可以直接全量上线。",
      answer: false,
      explanation: "统计显著不等于业务可接受，必须检查护栏指标、样本偏差和长期副作用。",
      difficulty: "medium",
      tags: ["实验", "护栏指标"],
      sourceKey: "ms-data-science",
    }
  ),
  ...topicQuestionPair(
    "data-chart-choice",
    "data-visual-delivery",
    {
      stem: "比较多个类别数值大小，通常优先选择什么图？",
      options: ["饼图", "条形图", "3D 饼图", "雷达图"],
      answer: "B",
      explanation: "长度比面积或角度更容易精确比较，条形图适合排序和标注。",
      difficulty: "easy",
      tags: ["图表选择", "条形图"],
      sourceKey: "ms-data-science",
    },
    {
      stem: "图表标题只需要写图型，不需要说明时间范围和比较对象。",
      answer: false,
      explanation: "标题应让读者明确比较对象、时间范围和结论，减少误读。",
      difficulty: "easy",
      tags: ["图表", "标题"],
      sourceKey: "ms-data-science",
    }
  ),
  ...topicQuestionPair(
    "data-dashboard",
    "data-visual-delivery",
    {
      stem: "好的仪表板首先应该围绕什么组织？",
      options: ["所有可用字段", "用户决策路径", "颜色数量", "图表数量"],
      answer: "B",
      explanation: "按状态、原因和行动组织信息，用户才能快速从异常走向决策。",
      difficulty: "easy",
      tags: ["仪表板", "决策"],
      sourceKey: "ms-data-science",
    },
    {
      stem: "同一指标在不同页面上可以使用不同口径，只要名称相同即可。",
      answer: false,
      explanation: "同名指标必须使用唯一可信口径，否则比较和决策会失真。",
      difficulty: "medium",
      tags: ["指标口径", "仪表板"],
      sourceKey: "ms-data-science",
    }
  ),
  ...topicQuestionPair(
    "data-story",
    "data-visual-delivery",
    {
      stem: "给业务方的行动建议最少应包含什么？",
      options: ["算法公式", "动作、负责人、影响和验证方式", "更多图表", "数据库表名"],
      answer: "B",
      explanation: "建议必须可执行、可负责、可衡量，并能验证是否有效。",
      difficulty: "medium",
      tags: ["行动建议", "交付"],
      sourceKey: "ms-data-science",
    },
    {
      stem: "数据结论可以省略限制条件，只要结论更简洁。",
      answer: false,
      explanation: "限制条件决定结论适用范围，省略会让读者误以为结论可以无限推广。",
      difficulty: "easy",
      tags: ["结论", "限制"],
      sourceKey: "ms-data-science",
    }
  ),
];
