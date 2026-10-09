import { topicQuestionPair } from "../topic-question-builders";
import type { LearningQuestion } from "../types";

export const javaTopicQuestions: LearningQuestion[] = [
  ...topicQuestionPair(
    "java-types-control",
    "java-foundation",
    {
      stem: "Java 中比较两个对象内容是否相等，通常应优先使用什么？",
      options: ["==", "equals", "hashCode", "toString"],
      answer: "B",
      explanation: "== 比较引用身份，equals 才是对象按内容相等表达的入口，前提是类实现了正确语义。",
      difficulty: "easy",
      tags: ["equals", "对象"],
      sourceKey: "algorithms-java",
    },
    {
      stem: "自动拆箱时，包装类型为 null 可能抛出 NullPointerException。",
      answer: true,
      explanation: "拆箱需要调用类似 intValue 的方法，null 无法提供值，因此会抛出运行时异常。",
      difficulty: "medium",
      tags: ["装箱", "NullPointerException"],
      sourceKey: "algorithms-java",
    }
  ),
  ...topicQuestionPair(
    "java-oop",
    "java-foundation",
    {
      stem: "要隔离可替换的多家支付渠道，哪种设计最合适？",
      options: ["继承所有渠道类", "定义支付接口并注入实现", "在服务中增加大量 if", "把渠道写成静态变量"],
      answer: "B",
      explanation: "接口定义统一能力，实现可替换；调用方只依赖支付契约，不依赖具体渠道。",
      difficulty: "medium",
      tags: ["接口", "多态"],
      sourceKey: "java-patterns",
    },
    {
      stem: "重写 equals 后即使不重写 hashCode，HashSet 也一定能按内容正确去重。",
      answer: false,
      explanation: "哈希集合先按 hashCode 定位桶，相等对象哈希不一致时可能无法找到彼此。",
      difficulty: "hard",
      tags: ["equals", "hashCode"],
      sourceKey: "algorithms-java",
    }
  ),
  ...topicQuestionPair(
    "java-exceptions",
    "java-foundation",
    {
      stem: "当前层无法恢复底层 IO 错误时，哪种做法更合适？",
      options: ["捕获后返回 null", "记录上下文并向上抛出领域异常", "忽略异常继续执行", "把异常改成 System.out"],
      answer: "B",
      explanation: "无法恢复时应保留 cause 并转换为上层能理解的错误，让具备恢复能力的调用方处理。",
      difficulty: "medium",
      tags: ["异常链", "恢复"],
      sourceKey: "java-patterns",
    },
    {
      stem: "try-with-resources 会在离开作用域时按资源声明的逆序关闭资源。",
      answer: true,
      explanation: "该语法保证资源关闭，并能在关闭阶段正确处理异常。",
      difficulty: "medium",
      tags: ["资源", "try-with-resources"],
      sourceKey: "algorithms-java",
    }
  ),
  ...topicQuestionPair(
    "java-collections",
    "java-collections",
    {
      stem: "需要频繁按用户 ID 查值，通常优先选择什么集合？",
      options: ["ArrayList", "HashMap", "LinkedList", "ArrayDeque"],
      answer: "B",
      explanation: "HashMap 按键查找，通常比在列表中线性扫描更适合建立索引。",
      difficulty: "easy",
      tags: ["HashMap", "查找"],
      sourceKey: "algorithms-java",
    },
    {
      stem: "在 for-each 遍历集合时直接 remove，通常比使用 Iterator.remove 更安全。",
      answer: false,
      explanation: "直接修改结构可能触发 ConcurrentModificationException，Iterator.remove 才是受支持的修改方式。",
      difficulty: "medium",
      tags: ["迭代器", "删除"],
      sourceKey: "algorithms-java",
    }
  ),
  ...topicQuestionPair(
    "java-generics",
    "java-collections",
    {
      stem: "`List<? extends Number>` 最适合作为哪种用途？",
      options: ["只读生产数据", "任意写入整数", "创建数组", "修改元素类型"],
      answer: "A",
      explanation: "extends 表达生产者，可以安全读取 Number，但不能确定具体子类型写入。",
      difficulty: "hard",
      tags: ["PECS", "通配符"],
      sourceKey: "algorithms-java",
    },
    {
      stem: "Java 运行时会完整保留所有泛型参数的具体类型。",
      answer: false,
      explanation: "泛型经历类型擦除，运行时通常只能获得边界类型，不能把所有泛型参数当真实类型使用。",
      difficulty: "medium",
      tags: ["类型擦除", "泛型"],
      sourceKey: "algorithms-java",
    }
  ),
  ...topicQuestionPair(
    "java-stream",
    "java-collections",
    {
      stem: "Stream 中间操作什么时候真正执行？",
      options: ["创建流时", "每个中间操作后立即执行", "遇到终止操作时", "垃圾回收时"],
      answer: "C",
      explanation: "中间操作构建惰性管道，只有终止操作触发数据消费并产生结果。",
      difficulty: "medium",
      tags: ["Stream", "惰性"],
      sourceKey: "algorithms-java",
    },
    {
      stem: "Stream 被一个终止操作消费后，可以再次使用同一个流对象。",
      answer: false,
      explanation: "Stream 是一次性管道，重复消费通常会抛出 IllegalStateException。",
      difficulty: "easy",
      tags: ["Stream", "生命周期"],
      sourceKey: "algorithms-java",
    }
  ),
  ...topicQuestionPair(
    "java-threads",
    "java-concurrency",
    {
      stem: "`volatile` 不能直接保证下面哪项？",
      options: ["变量可见性", "部分有序性", "count++ 的原子性", "读取最新写入"],
      answer: "C",
      explanation: "count++ 是读改写复合操作，volatile 不能让它整体原子化。",
      difficulty: "hard",
      tags: ["volatile", "原子性"],
      sourceKey: "advanced-java-reference",
    },
    {
      stem: "线程池只有核心线程和最大线程配置，不需要定义队列上限和拒绝策略。",
      answer: false,
      explanation: "无界队列或缺失拒绝策略可能导致任务无限积压和内存增长。",
      difficulty: "medium",
      tags: ["线程池", "容量"],
      sourceKey: "advanced-java-reference",
    }
  ),
  ...topicQuestionPair(
    "java-jvm",
    "java-concurrency",
    {
      stem: "定位对象为何无法被回收，最直接的证据通常是什么？",
      options: ["对象数量", "从 GC Roots 到对象的可达链", "源代码行数", "方法名称"],
      answer: "B",
      explanation: "可达链能说明哪个线程、缓存或监听器仍持有对象，是定位内存泄漏的关键。",
      difficulty: "hard",
      tags: ["GC Roots", "泄漏"],
      sourceKey: "advanced-java-reference",
    },
    {
      stem: "对象没有任何强引用时，是否回收仍完全由某种引用计数机制决定。",
      answer: false,
      explanation: "JVM 主要通过可达性分析判断对象是否仍从 GC Roots 可达，不是简单引用计数。",
      difficulty: "medium",
      tags: ["GC", "可达性"],
      sourceKey: "advanced-java-reference",
    }
  ),
  ...topicQuestionPair(
    "java-performance",
    "java-concurrency",
    {
      stem: "评估一次优化是否有效，哪种证据最可靠？",
      options: ["代码更短", "相同环境下的前后基准和分位数", "一次感觉更快", "日志更少"],
      answer: "B",
      explanation: "相同输入、并发和硬件下的前后对比，结合 p95/p99 才能判断收益和噪声。",
      difficulty: "medium",
      tags: ["基准", "尾延迟"],
      sourceKey: "tech-interview-handbook",
    },
    {
      stem: "连接池设置越大，数据库和下游服务的延迟就一定越低。",
      answer: false,
      explanation: "连接过多会增加数据库竞争和资源压力，连接池需要结合容量、超时和并发限制调优。",
      difficulty: "medium",
      tags: ["连接池", "容量"],
      sourceKey: "tech-interview-handbook",
    }
  ),
  ...topicQuestionPair(
    "java-build",
    "java-engineering",
    {
      stem: "处理 Maven 传递依赖冲突的第一步是什么？",
      options: ["删除所有测试", "查看依赖树并确认冲突来源", "盲目排除旧包", "升级全部依赖"],
      answer: "B",
      explanation: "依赖树显示版本来源和优先级，先定位冲突再决定统一版本或排除。",
      difficulty: "medium",
      tags: ["依赖树", "Maven"],
      sourceKey: "tech-interview-handbook",
    },
    {
      stem: "测试替身越多，集成测试就越能验证真实外部协议。",
      answer: false,
      explanation: "替身能隔离副作用，但不能替代协议、网络和数据库真实行为，需要保留集成测试。",
      difficulty: "medium",
      tags: ["测试替身", "集成测试"],
      sourceKey: "tech-interview-handbook",
    }
  ),
  ...topicQuestionPair(
    "java-patterns",
    "java-engineering",
    {
      stem: "策略模式最适合隔离什么变化？",
      options: ["可替换算法或规则", "字体大小", "CPU 核数", "日志时间"],
      answer: "A",
      explanation: "策略把变化算法封装在统一接口后，让调用方在运行时选择实现。",
      difficulty: "easy",
      tags: ["策略模式", "变化点"],
      sourceKey: "java-patterns",
    },
    {
      stem: "设计模式引入得越多，系统可维护性通常越高。",
      answer: false,
      explanation: "模式只在解决真实变化和重复问题时才有价值，过度抽象会增加阅读和测试成本。",
      difficulty: "easy",
      tags: ["设计模式", "过度设计"],
      sourceKey: "java-patterns",
    }
  ),
  ...topicQuestionPair(
    "java-service",
    "java-engineering",
    {
      stem: "服务层事务边界最应该围绕什么设计？",
      options: ["网络请求数量", "需要保持一致的业务不变量", "日志行数", "类数量"],
      answer: "B",
      explanation: "事务应覆盖一组不可分割的业务状态变化，避免范围过小导致部分更新或过大导致锁竞争。",
      difficulty: "medium",
      tags: ["事务", "业务不变量"],
      sourceKey: "java-patterns",
    },
    {
      stem: "稳定的错误模型应让调用方区分校验失败、冲突和瞬时故障。",
      answer: true,
      explanation: "不同错误对应不同恢复动作，例如提示用户、重新读取或有限重试。",
      difficulty: "medium",
      tags: ["错误模型", "恢复"],
      sourceKey: "tech-interview-handbook",
    }
  ),
];
