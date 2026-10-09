import { topicQuestionPair } from "../topic-question-builders";
import type { LearningQuestion } from "../types";

export const pythonTopicQuestions: LearningQuestion[] = [
  ...topicQuestionPair(
    "python-values-control",
    "python-foundation",
    {
      stem: "执行 `a = [1]; b = a; b.append(2)` 后，`a` 的值是什么？",
      options: ["[1]", "[1, 2]", "报错", "None"],
      answer: "B",
      explanation: "a 和 b 绑定到同一个可变列表对象，通过 b 修改会反映到 a。",
      difficulty: "easy",
      tags: ["名称绑定", "可变对象"],
      sourceKey: "exercism-python",
    },
    {
      stem: "Python 中变量名本身保存对象的完整拷贝，而不是对象引用。",
      answer: false,
      explanation: "名称绑定到对象；多个名称可以引用同一个对象，尤其是列表、字典等可变对象。",
      difficulty: "easy",
      tags: ["对象", "引用"],
      sourceKey: "exercism-python",
    }
  ),
  ...topicQuestionPair(
    "python-functions",
    "python-foundation",
    {
      stem: "函数默认参数为什么不应直接使用 `[]`？",
      options: ["列表不能作为参数", "默认列表会在调用之间共享修改", "会触发语法错误", "只能接收字符串"],
      answer: "B",
      explanation: "默认值在函数定义时创建一次，可变默认对象可能保留上一次调用的修改。",
      difficulty: "medium",
      tags: ["默认参数", "可变对象"],
      sourceKey: "exercism-python",
    },
    {
      stem: "函数返回值和打印到终端是同一个行为。",
      answer: false,
      explanation: "打印只产生输出，返回值才能被调用方继续赋值、组合和测试。",
      difficulty: "easy",
      tags: ["返回值", "print"],
      sourceKey: "exercism-python",
    }
  ),
  ...topicQuestionPair(
    "python-debug",
    "python-foundation",
    {
      stem: "捕获异常后，哪种做法最有利于后续排障？",
      options: ["只写 pass", "保留异常链并记录上下文", "改成返回空字符串", "删除 traceback"],
      answer: "B",
      explanation: "保留原始异常和必要上下文，能让上层或日志还原失败发生在哪里。",
      difficulty: "medium",
      tags: ["异常", "日志"],
      sourceKey: "exercism-python",
    },
    {
      stem: "`finally` 代码块通常用于释放必须清理的资源。",
      answer: true,
      explanation: "finally 在正常和异常路径都会执行，适合关闭连接、文件或恢复临时状态。",
      difficulty: "easy",
      tags: ["finally", "资源"],
      sourceKey: "exercism-python",
    }
  ),
  ...topicQuestionPair(
    "python-collections",
    "python-data-structures",
    {
      stem: "需要在遍历日志时统计每个用户的操作次数，首选什么结构？",
      options: ["tuple", "dict", "set", "字符串"],
      answer: "B",
      explanation: "字典能把用户 ID 映射到计数，每次读取旧值并加一，查找接近常数时间。",
      difficulty: "easy",
      tags: ["dict", "统计"],
      sourceKey: "algorithms-python",
    },
    {
      stem: "集合可以保存重复元素，并通过索引访问第 n 个元素。",
      answer: false,
      explanation: "集合只保存唯一元素，没有可靠顺序和索引访问。",
      difficulty: "easy",
      tags: ["set", "唯一性"],
      sourceKey: "algorithms-python",
    }
  ),
  ...topicQuestionPair(
    "python-files",
    "python-data-structures",
    {
      stem: "跨平台读取 UTF-8 文本文件时，哪种做法更可靠？",
      options: ["依赖系统默认编码", "显式指定 encoding='utf-8'", "用二进制模式直接解析 JSON", "只捕获所有异常"],
      answer: "B",
      explanation: "显式编码避免不同操作系统默认编码差异导致乱码或解析失败。",
      difficulty: "easy",
      tags: ["文件", "UTF-8"],
      sourceKey: "exercism-python",
    },
    {
      stem: "JSON 解析成功后，就可以假设所有必需字段和类型都正确。",
      answer: false,
      explanation: "JSON 合法只说明文本格式正确，业务字段、类型和值域仍需程序校验。",
      difficulty: "medium",
      tags: ["JSON", "校验"],
      sourceKey: "exercism-python",
    }
  ),
  ...topicQuestionPair(
    "python-testing",
    "python-data-structures",
    {
      stem: "测试日期相关逻辑时，哪种做法最稳定？",
      options: ["读取真实当前时间", "把时钟作为依赖注入", "每次等待一分钟", "只测试成功路径"],
      answer: "B",
      explanation: "注入可控时钟可以让边界时间、跨日和时间差测试可重复，不受运行时刻影响。",
      difficulty: "medium",
      tags: ["pytest", "时间"],
      sourceKey: "exercism-python",
    },
    {
      stem: "测试覆盖率 100% 就一定代表程序行为完全正确。",
      answer: false,
      explanation: "覆盖率只说明代码被执行过，不能证明断言充分、边界正确或需求无误。",
      difficulty: "easy",
      tags: ["覆盖率", "测试质量"],
      sourceKey: "exercism-python",
    }
  ),
  ...topicQuestionPair(
    "python-classes",
    "python-oop-typing",
    {
      stem: "多个实例意外共享同一可变列表，最可能的原因是什么？",
      options: ["方法名重复", "列表定义在类属性上", "没有继承", "没有使用 None"],
      answer: "B",
      explanation: "类属性在实例之间共享，可变类属性被修改时会互相影响；需要独立状态应在 `__init__` 创建。",
      difficulty: "medium",
      tags: ["类属性", "实例属性"],
      sourceKey: "algorithms-python",
    },
    {
      stem: "组合通常比加深继承层级更容易控制耦合。",
      answer: true,
      explanation: "组合依赖明确对象协作，能减少脆弱基类和层级变化带来的连锁影响。",
      difficulty: "easy",
      tags: ["组合", "继承"],
      sourceKey: "algorithms-python",
    }
  ),
  ...topicQuestionPair(
    "python-typing",
    "python-oop-typing",
    {
      stem: "`Protocol` 最适合解决什么问题？",
      options: ["运行时强制类型转换", "按行为定义可替换接口", "自动生成数据库表", "替代所有测试"],
      answer: "B",
      explanation: "Protocol 让调用方依赖所需方法，而不是强迫实现类继承某个具体基类。",
      difficulty: "medium",
      tags: ["Protocol", "结构化类型"],
      sourceKey: "algorithms-python",
    },
    {
      stem: "`Any` 使用越多，静态类型检查通常越容易发现接口错误。",
      answer: false,
      explanation: "Any 会关闭大量类型检查，应尽量限制在无法描述或不信任的第三方边界。",
      difficulty: "easy",
      tags: ["Any", "类型检查"],
      sourceKey: "algorithms-python",
    }
  ),
  ...topicQuestionPair(
    "python-context",
    "python-oop-typing",
    {
      stem: "读取一个超大日志文件并逐行处理，哪种方案内存峰值最低？",
      options: ["一次性 readlines", "生成器逐行产出", "把每行拼成字符串", "全部读进列表后排序"],
      answer: "B",
      explanation: "生成器按需读取一行并处理，不需要把全部内容同时保存在内存。",
      difficulty: "medium",
      tags: ["生成器", "内存"],
      sourceKey: "algorithms-python",
    },
    {
      stem: "生成器对象被完整消费后，通常不能原地重新从第一个值开始迭代。",
      answer: true,
      explanation: "生成器保持单向迭代状态，重复遍历需要重新创建生成器或保存结果。",
      difficulty: "easy",
      tags: ["生成器", "迭代"],
      sourceKey: "algorithms-python",
    }
  ),
  ...topicQuestionPair(
    "python-pandas",
    "python-data-project",
    {
      stem: "两份表合并后金额明显膨胀，最优先检查什么？",
      options: ["列字体", "连接键的唯一性和匹配数量", "Python 版本", "图表颜色"],
      answer: "B",
      explanation: "重复连接键会产生多对多组合，必须先检查双方粒度和唯一性。",
      difficulty: "medium",
      tags: ["merge", "粒度"],
      sourceKey: "ms-data-science",
    },
    {
      stem: "处理缺失值前应比较不同分组的缺失比例和样本结构。",
      answer: true,
      explanation: "缺失集中在特定分组时直接删除会引入样本偏差，影响后续结论。",
      difficulty: "medium",
      tags: ["缺失值", "偏差"],
      sourceKey: "ms-data-science",
    }
  ),
  ...topicQuestionPair(
    "python-visualization",
    "python-data-project",
    {
      stem: "要比较 12 个渠道的订单量，哪种图通常最容易精确比较？",
      options: ["饼图", "横向条形图", "三维散点图", "雷达图"],
      answer: "B",
      explanation: "长度比扇形角度更容易精确比较，渠道较多时横向条形图也更易排序和标注。",
      difficulty: "easy",
      tags: ["可视化", "条形图"],
      sourceKey: "ms-data-science",
    },
    {
      stem: "只要图表美观，纵轴从非零值开始也不会影响读者判断。",
      answer: false,
      explanation: "截断纵轴会放大视觉差异，可能误导读者，必须谨慎使用并明确说明。",
      difficulty: "easy",
      tags: ["坐标轴", "误导"],
      sourceKey: "ms-data-science",
    }
  ),
  ...topicQuestionPair(
    "python-capstone",
    "python-data-project",
    {
      stem: "数据项目计划中，哪项最适合作为最小可演示版本的验收标准？",
      options: ["完成所有可能的扩展功能", "按文档运行得到一份可检查结果", "代码行数超过 1000", "使用最多第三方库"],
      answer: "B",
      explanation: "最小版本应先证明输入、处理和输出闭环可运行，再逐步扩展范围和性能。",
      difficulty: "easy",
      tags: ["项目", "验收"],
      sourceKey: "ms-data-science",
    },
    {
      stem: "README 只需写项目简介，不需要记录数据来源和运行命令。",
      answer: false,
      explanation: "数据来源、依赖、运行命令和限制是复现结果的关键，属于交付质量的一部分。",
      difficulty: "easy",
      tags: ["README", "复现"],
      sourceKey: "ms-data-science",
    }
  ),
];
