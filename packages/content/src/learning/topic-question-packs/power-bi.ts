import { topicQuestionPair } from "../topic-question-builders";
import type { LearningQuestion } from "../types";

export const powerBiTopicQuestions: LearningQuestion[] = [
  ...topicQuestionPair(
    "powerbi-connect",
    "powerbi-ingest",
    {
      stem: "需要秒级新鲜度且源系统能承受查询时，哪种连接模式更合适？",
      options: ["Import", "DirectQuery", "手动 Excel", "静态 CSV"],
      answer: "B",
      explanation: "DirectQuery 把查询下推到数据源，新鲜度更高，但性能和并发受源系统限制。",
      difficulty: "medium",
      tags: ["DirectQuery", "连接模式"],
      sourceKey: "pl300",
    },
    {
      stem: "Import 通常比 DirectQuery 支持更完整的 DAX 和更快的交互。",
      answer: true,
      explanation: "Import 数据已在模型中，交互通常更快且功能限制较少，但刷新新鲜度取决于计划。",
      difficulty: "easy",
      tags: ["Import", "性能"],
      sourceKey: "pl300",
    }
  ),
  ...topicQuestionPair(
    "powerbi-power-query",
    "powerbi-ingest",
    {
      stem: "Power Query 查询折叠的主要收益是什么？",
      options: ["图表更漂亮", "把支持的转换下推到源执行", "自动建立关系", "跳过类型检查"],
      answer: "B",
      explanation: "折叠让源系统执行过滤和转换，减少本地数据传输和处理量。",
      difficulty: "hard",
      tags: ["查询折叠", "Power Query"],
      sourceKey: "pl300",
    },
    {
      stem: "Power Query 步骤是线性的，修改早期步骤可能影响全部后续转换。",
      answer: true,
      explanation: "后续步骤依赖前一步输出，修改类型、过滤或字段结构会改变整条依赖链。",
      difficulty: "medium",
      tags: ["步骤", "依赖"],
      sourceKey: "pl300",
    }
  ),
  ...topicQuestionPair(
    "powerbi-parameters",
    "powerbi-ingest",
    {
      stem: "数据库密码应该优先保存在哪里？",
      options: ["查询文本", "参数默认值", "Power BI 凭据管理或网关", "报表标题"],
      answer: "C",
      explanation: "凭据应通过安全凭据管理或网关配置，不能写入可共享的查询和参数。",
      difficulty: "easy",
      tags: ["参数", "凭据"],
      sourceKey: "pl300",
    },
    {
      stem: "参数化环境后，发布到生产前不需要检查参数绑定。",
      answer: false,
      explanation: "环境参数绑定错误会让生产报表连接测试源，发布前必须核对。",
      difficulty: "medium",
      tags: ["环境参数", "发布"],
      sourceKey: "pl300",
    }
  ),
  ...topicQuestionPair(
    "powerbi-star-schema",
    "powerbi-model",
    {
      stem: "订单事实表最适合保存下面哪类字段？",
      options: ["日期所有属性", "订单行粒度外键和度量", "用户全部描述", "产品长文本"],
      answer: "B",
      explanation: "事实表保存事件粒度外键和可度量数值，描述属性应放入维度表。",
      difficulty: "medium",
      tags: ["事实表", "星型模型"],
      sourceKey: "pl300",
    },
    {
      stem: "同一张事实表可以混合订单事务粒度和每日库存快照粒度。",
      answer: false,
      explanation: "不同粒度混在一张事实表会让求和、计数和时间比较产生歧义。",
      difficulty: "hard",
      tags: ["粒度", "事实表"],
      sourceKey: "pl300",
    }
  ),
  ...topicQuestionPair(
    "powerbi-relationships",
    "powerbi-model",
    {
      stem: "建立一对多关系前，维度表键必须满足什么条件？",
      options: ["键必须为文本", "键在一侧应唯一", "事实表键必须为空", "必须双向筛选"],
      answer: "B",
      explanation: "一对多要求一侧键唯一，多侧键可重复，否则关系无效或产生歧义。",
      difficulty: "medium",
      tags: ["关系", "唯一键"],
      sourceKey: "pl300",
    },
    {
      stem: "双向筛选越多，模型筛选路径通常越清晰。",
      answer: false,
      explanation: "双向筛选会扩大传播路径并引入循环或歧义，应只在明确需求下使用。",
      difficulty: "hard",
      tags: ["双向筛选", "关系"],
      sourceKey: "pl300",
    }
  ),
  ...topicQuestionPair(
    "powerbi-date-table",
    "powerbi-model",
    {
      stem: "日期表最重要的结构要求之一是什么？",
      options: ["只含工作日", "连续且覆盖事实日期", "每个月份只有一行", "与事实表合并"],
      answer: "B",
      explanation: "连续完整日期才能稳定支持时间智能，并避免同比和累计出现缺口。",
      difficulty: "medium",
      tags: ["日期表", "连续性"],
      sourceKey: "pl300",
    },
    {
      stem: "时间智能依赖日期表和事实表之间的正确关系与当前筛选。",
      answer: true,
      explanation: "日期关系、连续性和筛选上下文共同决定同比、累计等结果。",
      difficulty: "medium",
      tags: ["时间智能", "日期关系"],
      sourceKey: "pl300",
    }
  ),
  ...topicQuestionPair(
    "powerbi-dax-basics",
    "powerbi-dax",
    {
      stem: "度量值通常在什么时机计算？",
      options: ["刷新模型时", "查询时根据筛选上下文计算", "打开文件时", "导出 PDF 时"],
      answer: "B",
      explanation: "度量值在查询时按当前筛选上下文计算，不会像计算列一样预先物化。",
      difficulty: "medium",
      tags: ["度量值", "筛选上下文"],
      sourceKey: "pl300",
    },
    {
      stem: "行上下文和筛选上下文是 DAX 中两个需要区分的概念。",
      answer: true,
      explanation: "行上下文用于逐行计算，筛选上下文决定聚合可见行；CALCULATE 会触发转换。",
      difficulty: "medium",
      tags: ["DAX", "上下文"],
      sourceKey: "pl300",
    }
  ),
  ...topicQuestionPair(
    "powerbi-calculate",
    "powerbi-dax",
    {
      stem: "计算某地区收入占全部地区收入时，ALL/REMOVEFILTERS 通常用于什么？",
      options: ["锁定日期", "移除地区筛选得到全量分母", "增加颜色", "建立关系"],
      answer: "B",
      explanation: "先移除地区筛选得到全量收入，再与当前地区收入相除即可得到占比。",
      difficulty: "hard",
      tags: ["CALCULATE", "占比"],
      sourceKey: "pl300",
    },
    {
      stem: "KEEPFILTERS 会保留已有筛选，并与新筛选取交集。",
      answer: true,
      explanation: "默认筛选器可能覆盖已有上下文，KEEPFILTERS 改为交集行为。",
      difficulty: "hard",
      tags: ["KEEPFILTERS", "CALCULATE"],
      sourceKey: "pl300",
    }
  ),
  ...topicQuestionPair(
    "powerbi-time-intelligence",
    "powerbi-dax",
    {
      stem: "同比指标比较的是哪两个时间窗口？",
      options: ["当前与上一行", "当前与去年同期", "当前与全部历史", "当前与下一年"],
      answer: "B",
      explanation: "同比通常比较当前时间段与上年相同时间段，保持窗口长度一致。",
      difficulty: "easy",
      tags: ["同比", "时间智能"],
      sourceKey: "pl300",
    },
    {
      stem: "累计指标只要日期表连续，就不需要考虑年初和月末边界。",
      answer: false,
      explanation: "累计仍要明确自然年、财政年和当前上下文，边界日期可能影响结果。",
      difficulty: "medium",
      tags: ["累计", "边界"],
      sourceKey: "pl300",
    }
  ),
  ...topicQuestionPair(
    "powerbi-report-design",
    "powerbi-report",
    {
      stem: "报表页面最重要的指标应该放在哪里？",
      options: ["视觉层级最高的位置", "页面底部并隐藏", "仅工具提示", "多个重复位置"],
      answer: "A",
      explanation: "关键指标应在首要视觉区域形成焦点，减少用户寻找成本。",
      difficulty: "easy",
      tags: ["报表设计", "视觉层级"],
      sourceKey: "pl300",
    },
    {
      stem: "钻取交互应提供清晰上下文和返回上一级的路径。",
      answer: true,
      explanation: "用户需要知道自己看到了什么层级，并能回到全局视图继续分析。",
      difficulty: "medium",
      tags: ["钻取", "交互"],
      sourceKey: "pl300",
    }
  ),
  ...topicQuestionPair(
    "powerbi-analytics",
    "powerbi-report",
    {
      stem: "What-if 参数最适合用来做什么？",
      options: ["修改源数据库", "探索假设输入对指标的影响", "替代权限", "自动调度刷新"],
      answer: "B",
      explanation: "What-if 参数提供交互输入，度量值基于选择计算模拟结果，不会自动改变源数据。",
      difficulty: "medium",
      tags: ["What-if", "高级分析"],
      sourceKey: "pl300",
    },
    {
      stem: "异常检测发现的值一定代表数据错误。",
      answer: false,
      explanation: "异常可能是真实业务事件或长尾，需要结合时间线和业务上下文调查。",
      difficulty: "medium",
      tags: ["异常检测", "解释"],
      sourceKey: "pl300",
    }
  ),
  ...topicQuestionPair(
    "powerbi-security-service",
    "powerbi-report",
    {
      stem: "RLS 权限不应只依靠什么实现？",
      options: ["模型角色", "隐藏视觉对象", "数据源权限", "用户安全组"],
      answer: "B",
      explanation: "隐藏视觉对象不能阻止数据访问，RLS 必须在模型或数据源层执行。",
      difficulty: "medium",
      tags: ["RLS", "安全"],
      sourceKey: "pl300",
    },
    {
      stem: "发布后只需确认报表能打开，不需要监控刷新和网关状态。",
      answer: false,
      explanation: "刷新失败、凭据过期和网关离线会让报表数据过期，需要持续运维监控。",
      difficulty: "easy",
      tags: ["刷新", "网关"],
      sourceKey: "pl300",
    }
  ),
];
