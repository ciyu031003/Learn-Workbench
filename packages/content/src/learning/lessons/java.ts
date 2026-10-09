import type { LearningTopicLesson } from "../types";

export const javaTopicLessons: Record<string, LearningTopicLesson> = {
  "java-types-control": {
    overview: [
      "Java 是静态类型语言，变量在编译期就有固定类型。基本类型直接保存数值，引用类型保存对象引用；方法重载根据编译期可见类型选择。",
      "控制流阶段要同时理解类型转换和边界。整数溢出、除零、浮点精度和字符串拼接都可能产生与直觉不同的结果。",
    ],
    mechanism: [
      "`if`、`switch`、`for` 和 `while` 控制执行路径；`switch` 的 case 值必须可比较，现代 switch 还可以返回值。",
      "自动装箱和拆箱允许基本类型与包装类型互相转换，但空包装类型拆箱会抛出 `NullPointerException`。",
    ],
    example: {
      title: "明确类型、边界和返回分支",
      language: "java",
      code: `public static int clampScore(int score) {
    if (score < 0) {
        return 0;
    }
    return Math.min(score, 100);
}

int total = 0;
for (int score : new int[] { 58, 76, 91 }) {
    total += clampScore(score);
}`,
      explanation: "方法先用条件处理下边界，再用 `Math.min` 处理上边界；调用者不需要知道内部判断，输入与输出契约清楚。",
    },
    practiceSteps: [
      "为 `clampScore` 写 -1、0、100、101 四个测试。",
      "用 `Integer value = null` 调用拆箱，观察并解释异常。",
      "把一个复杂分支重构成早返回，保持行为不变。",
    ],
    masteryChecklist: [
      "能区分基本类型、包装类型和引用身份。",
      "能解释重载、类型转换和整数溢出的基本规则。",
    ],
  },
  "java-oop": {
    overview: [
      "面向对象的核心是职责边界。封装隐藏内部不变量，多态让调用方依赖接口，继承只表达稳定的“是什么”关系，组合更适合灵活变更。",
      "接口定义可替换能力，抽象类可以共享部分实现和状态。设计时先识别变化点，再决定抽象，而不是为每个实体创建一个继承层级。",
    ],
    mechanism: [
      "方法调用在运行时根据对象实际类型分派，字段访问和重载则更依赖编译期类型。",
      "`equals` 与 `hashCode` 必须保持一致；如果两个对象相等，它们应具有相同哈希值，否则哈希集合会表现异常。",
    ],
    example: {
      title: "面向接口组织支付能力",
      language: "java",
      code: `interface PaymentGateway {
    Receipt pay(Money amount);
}

final class CheckoutService {
    private final PaymentGateway gateway;

    CheckoutService(PaymentGateway gateway) {
        this.gateway = gateway;
    }

    Receipt checkout(Money amount) {
        return gateway.pay(amount);
    }
}`,
      explanation: "`CheckoutService` 依赖支付能力而不是某一家支付实现。测试时可以注入假实现，新增渠道也不需要修改结算流程。",
    },
    practiceSteps: [
      "为支付接口写一个内存实现和失败实现。",
      "为值对象实现并测试 `equals` 与 `hashCode`。",
      "找出一个继承层级，判断能否改为组合。",
    ],
    masteryChecklist: [
      "能解释接口、抽象类和组合各自的适用场景。",
      "能说明 equals/hashCode 契约为何必须一致。",
    ],
  },
  "java-exceptions": {
    overview: [
      "异常把失败路径纳入类型系统。受检异常要求调用方显式处理或声明，非受检异常通常表示编程错误或无法恢复的状态。",
      "异常处理的目标是让能恢复的层恢复，让不能恢复的层保留上下文向上传递。资源使用 try-with-resources，避免手写 `finally` 漏掉关闭。",
    ],
    mechanism: [
      "异常沿调用栈向上传播，匹配第一个可捕获类型；更具体的 catch 应放在更宽泛类型之前。",
      "`try-with-resources` 会按声明的逆序关闭资源，并正确处理关闭阶段异常；自定义异常可以保留 cause 形成异常链。",
    ],
    example: {
      title: "资源关闭与领域异常转换",
      language: "java",
      code: `try (BufferedReader reader = Files.newBufferedReader(path, UTF_8)) {
    return reader.lines().toList();
} catch (IOException error) {
    throw new ConfigLoadException("cannot load " + path, error);
}`,
      explanation: "读取资源自动关闭，底层 IO 异常被转换为配置加载错误，同时保留原始 cause，调用方可以决定重试或展示配置问题。",
    },
    practiceSteps: [
      "创建受检异常路径，观察编译器是否要求处理。",
      "用 try-with-resources 替换手写 finally 并补失败测试。",
      "设计一个错误模型，区分校验、冲突和瞬时故障。",
    ],
    masteryChecklist: [
      "能判断异常应在当前层处理还是继续向上抛出。",
      "能说明资源关闭和异常链的作用。",
    ],
  },
  "java-collections": {
    overview: [
      "集合框架按访问模式选型：ArrayList 适合随机访问，LinkedList 适合频繁两端操作，HashSet 表达唯一性，HashMap 建立键值索引，TreeMap 提供有序键。",
      "迭代器负责遍历集合；在迭代过程中直接修改结构可能触发 `ConcurrentModificationException`，应使用迭代器方法或构建新集合。",
    ],
    mechanism: [
      "HashMap 根据键的哈希值定位桶，键相等且哈希一致才能稳定查找；可变对象作为键并被修改会导致无法找到原值。",
      "ArrayList 扩容会复制底层数组，随机中间插入成本较高；选择容器时要考虑读写比例、排序和内存占用。",
    ],
    example: {
      title: "用 Map 聚合并用迭代器安全删除",
      language: "java",
      code: `Map<String, Integer> counts = new HashMap<>();
for (String user : users) {
    counts.merge(user, 1, Integer::sum);
}

Iterator<Map.Entry<String, Integer>> iterator = counts.entrySet().iterator();
while (iterator.hasNext()) {
    if (iterator.next().getValue() == 0) {
        iterator.remove();
    }
}`,
      explanation: "`merge` 清楚地表达计数，删除通过迭代器完成，避免遍历时直接修改 Map 结构。",
    },
    practiceSteps: [
      "用 ArrayList、LinkedList 和 HashSet 完成同一个查找任务并比较代码。",
      "用可变对象作为 HashMap 键，修改后观察查找失败。",
      "统计一段文本的单词频率并输出 Top 10。",
    ],
    masteryChecklist: [
      "能根据操作模式解释容器选择。",
      "能说明迭代器删除和直接删除的区别。",
    ],
  },
  "java-generics": {
    overview: [
      "泛型让容器和算法在编译期保留元素类型信息，减少强制转换并提前发现错误。",
      "通配符表达读写边界：生产者可以读取，消费者可以写入。PECS 即 Producer Extends、Consumer Super，用来选择 `? extends T` 或 `? super T`。",
    ],
    mechanism: [
      "类型擦除会让泛型参数在运行时变成边界类型，`List<String>` 和 `List<Integer>` 的运行时类相同。",
      "不能创建泛型数组，也不能在静态上下文中直接使用类级类型参数；需要运行时类型时可通过 `Class<T>` token 传入。",
    ],
    example: {
      title: "使用 PECS 设计复制方法",
      language: "java",
      code: `static <T> void copy(
        List<? extends T> source,
        List<? super T> target
) {
    for (T item : source) {
        target.add(item);
    }
}`,
      explanation: "源列表只负责产出 T，使用 `extends`；目标列表负责消费 T，使用 `super`。方法可以接收不同类型的兼容集合。",
    },
    practiceSteps: [
      "实现一个接收 `List<Integer>` 并写入 `List<Number>` 的复制方法。",
      "尝试向 `List<? extends Number>` 写入数据并观察编译错误。",
      "用 `Class<T>` token 实现一个最小工厂方法。",
    ],
    masteryChecklist: [
      "能用 PECS 解释通配符方向。",
      "能说明类型擦除会限制哪些运行时操作。",
    ],
  },
  "java-stream": {
    overview: [
      "Stream 表达从数据源到结果的转换管道，中间操作惰性执行，终止操作才触发消费。它适合过滤、映射、分组和汇总，不适合隐藏复杂副作用。",
      "Optional 表达“可能没有值”，但不适合所有字段；在集合中大量使用 Optional 会增加包装和调用成本。",
    ],
    mechanism: [
      "流管道执行顺序会在可行时融合，短路操作可以在满足条件后提前结束；并行流并不自动更快，还受装箱、拆分和共享状态影响。",
      "流是一次性的，终止操作消费后不能再次使用；需要复用时应保存集合或重新创建流。",
    ],
    example: {
      title: "按状态分组并统计金额",
      language: "java",
      code: `Map<Status, Integer> amountByStatus = orders.stream()
    .filter(order -> order.amount() > 0)
    .collect(Collectors.groupingBy(
        Order::status,
        Collectors.summingInt(Order::amount)
    ));`,
      explanation: "过滤、分组和求和组成清晰的只读管道，没有修改外部状态。若需要调试中间结果，可先收集成集合再继续。",
    },
    practiceSteps: [
      "用 stream 完成分组、排序和 Top 3。",
      "故意重复使用同一个流，观察 IllegalStateException。",
      "把含副作用的 forEach 改成显式循环，比较可读性。",
    ],
    masteryChecklist: [
      "能解释中间操作和终止操作的区别。",
      "能判断什么时候显式循环比 Stream 更好。",
    ],
  },
  "java-threads": {
    overview: [
      "并发问题来自共享可变状态。可见性、原子性和有序性需要分别考虑；锁保护的是不变量，而不是某一行代码。",
      "线程池要设置队列、拒绝策略、超时和关闭流程。并发集合适合特定原子操作，但多个操作组成的事务仍可能需要外部同步。",
    ],
    mechanism: [
      "`volatile` 保证写入可见并限制部分重排，但不保证 `count++` 这种读改写操作原子。",
      "`synchronized` 或 `ReentrantLock` 保护临界区；线程等待资源时状态可能是 BLOCKED、WAITING 或 TIMED_WAITING，线程转储能帮助定位。",
    ],
    example: {
      title: "用原子变量保护计数",
      language: "java",
      code: `AtomicInteger processed = new AtomicInteger();
ExecutorService pool = Executors.newFixedThreadPool(4);

try {
    for (Task task : tasks) {
        pool.submit(() -> {
            process(task);
            processed.incrementAndGet();
        });
    }
} finally {
    pool.shutdown();
}`,
      explanation: "原子整数保证并发自增不会丢失更新，线程池在 finally 中关闭，避免任务结束后线程无法退出。",
    },
    practiceSteps: [
      "用多个线程增加普通 int，观察丢失更新，再改用 AtomicInteger。",
      "创建一个有限队列和拒绝策略的线程池。",
      "用 jstack 查看一次线程等待和锁竞争。",
    ],
    masteryChecklist: [
      "能说明 volatile 不能解决哪些并发问题。",
      "能为线程池定义容量、拒绝策略和关闭方式。",
    ],
  },
  "java-jvm": {
    overview: [
      "JVM 负责加载类、执行字节码、分配对象和回收不可达内存。对象是否可回收取决于从 GC Roots 是否可达，而不是引用计数。",
      "内存问题要结合堆、线程、元空间和本地内存观察。堆转储、线程转储、GC 日志和指标是比猜测更可靠的证据。",
    ],
    mechanism: [
      "类加载经历加载、链接和初始化；栈保存线程调用帧和局部变量，堆保存对象，元空间保存类元数据。",
      "GC 会回收不可达对象，但缓存、监听器或线程持有链可能让对象长期存活；持续增长应寻找支配树中的持有者。",
    ],
    example: {
      title: "用弱引用缓存避免强制持有",
      language: "java",
      code: `Map<Key, Value> cache = new WeakHashMap<>();
Value value = cache.computeIfAbsent(key, this::load);

// 生产环境仍应限制缓存条目和过期时间，
// WeakHashMap 不能替代容量治理。`,
      explanation: "弱引用可以让键在无其他强引用时被回收，但缓存仍需要容量和生命周期策略，否则可能变为全局状态。",
    },
    practiceSteps: [
      "写一个长生命周期集合不断添加对象的程序，观察堆增长。",
      "用 `jmap` 或 JFR 查看一次对象分布。",
      "根据支配树解释一个对象为何仍不可回收。",
    ],
    masteryChecklist: [
      "能区分堆、栈、元空间和本地内存。",
      "能用可达性解释内存泄漏而不只说“对象没被释放”。",
    ],
  },
  "java-performance": {
    overview: [
      "性能优化必须从测量开始。吞吐、平均延迟、P95/P99、错误率和资源使用是不同指标，优化前要定义目标。",
      "缓存、连接池和异步化都会引入一致性、容量和生命周期问题。没有相同输入和环境的复测，就无法判断收益是否真实。",
    ],
    mechanism: [
      "JMH 通过预热和统计减少 JIT 与测量噪声；线上性能还要看流量分布、GC、锁竞争和下游延迟。",
      "缓存命中需要键、失效、并发和内存策略；连接池需要最大连接、等待超时、泄漏检测和健康检查。",
    ],
    example: {
      title: "基准测试记录延迟分位数",
      language: "text",
      code: `Benchmark: order-query
Warmup: 5 x 1s
Measurement: 10 x 1s
Threads: 8
Report: throughput, average, p95, p99

Before: p99=420ms  p95=180ms
After:  p99=310ms  p95=170ms`,
      explanation: "基准报告明确方法、并发和分位数，避免只展示更漂亮的平均值。前后仍要在相同数据与硬件上比较。",
    },
    practiceSteps: [
      "为一个慢函数建立输入数据、基准命令和目标指标。",
      "记录优化前的 p95/P99 和吞吐。",
      "只改变一个变量后复测，并解释收益来源。",
    ],
    masteryChecklist: [
      "能说明为什么平均值会掩盖尾延迟。",
      "能为缓存或连接池定义容量、失效和超时。",
    ],
  },
  "java-build": {
    overview: [
      "构建工具负责依赖解析、编译、测试和打包。依赖树、版本锁定和构建缓存共同决定构建是否可重复。",
      "JUnit 验证行为契约，Mock 或 Stub 隔离外部副作用。测试替身应尽量靠近真实边界，避免把实现细节全部 mock 掉。",
    ],
    mechanism: [
      "Maven 使用坐标和依赖调解，Gradle 使用配置和任务图；传递依赖冲突会选中某版本并可能触发运行时缺方法。",
      "测试范围通常分为单元、集成和端到端；不同范围应有不同运行时间、依赖和失败处理策略。",
    ],
    example: {
      title: "用依赖树定位冲突",
      language: "text",
      code: `mvn dependency:tree -Dincludes=com.example:shared-lib

# 输出显示两个路径：
# app -> service -> shared-lib:2.0
# app -> legacy -> shared-lib:1.5
# 先统一调用方，再决定是否排除旧版本`,
      explanation: "依赖树显示冲突来源，不能直接盲目排除。应先确认 API 兼容性，再统一版本并跑集成测试。",
    },
    practiceSteps: [
      "为模块建立固定构建命令和测试命令。",
      "添加一个传递依赖并查看依赖树。",
      "用 Stub 替换外部服务，验证核心服务的失败和重试行为。",
    ],
    masteryChecklist: [
      "能从依赖树解释版本冲突。",
      "能区分单元测试、集成测试和测试替身。",
    ],
  },
  "java-patterns": {
    overview: [
      "设计模式是解决重复设计问题的共同语言，不是到处套模板。先识别变化点，再选择合适的隔离方式。",
      "策略隔离算法，工厂隔离创建，责任链隔离处理顺序，适配器隔离外部接口；过度抽象会让简单逻辑难以阅读。",
    ],
    mechanism: [
      "策略让调用方依赖行为接口，运行时选择实现；责任链让请求沿处理器顺序传递，直到被处理或到达末端。",
      "模式的价值来自边界和测试成本下降，不应只看类数量是否增加；简单条件分支在小范围内通常更清楚。",
    ],
    example: {
      title: "把变化规则抽成策略",
      language: "java",
      code: `interface DiscountRule {
    int discount(Order order);
}

final class OrderPricing {
    private final List<DiscountRule> rules;

    int price(Order order) {
        return rules.stream()
            .mapToInt(rule -> rule.discount(order))
            .sum();
    }
}`,
      explanation: "每个优惠规则独立实现，价格服务组合规则。新增规则不需要扩大条件分支，也更容易单独测试。",
    },
    practiceSteps: [
      "把一个复杂条件分支列出变化点和稳定点。",
      "用策略或责任链重构其中一部分并补测试。",
      "记录重构前后类数量、测试数量和可读性变化。",
    ],
    masteryChecklist: [
      "能说明模式解决的具体变化问题。",
      "能判断何时不应引入模式。",
    ],
  },
  "java-service": {
    overview: [
      "服务分层让控制器、应用服务、领域逻辑和基础设施边界清楚。业务规则不依赖 HTTP 或数据库细节，事务围绕业务不变量组织。",
      "错误模型要帮助调用方行动：校验失败可直接提示，冲突需要重新读取，瞬时故障可重试，永久错误需要人工处理。",
    ],
    mechanism: [
      "控制器负责协议转换，应用服务编排用例，领域对象保护不变量，仓库负责持久化。",
      "事务不应跨网络长期持有，也不应把多个不相关动作塞进同一个大事务；跨服务一致性更需要补偿、重试或事件方案。",
    ],
    example: {
      title: "服务层统一错误模型",
      language: "java",
      code: `sealed interface ServiceError
    permits ValidationError, ConflictError, TransientError {}

record ValidationError(String field) implements ServiceError {}
record ConflictError(String code) implements ServiceError {}
record TransientError(String reason) implements ServiceError {}

ServiceResult<Order> result = orderService.create(command);`,
      explanation: "错误类型明确表达恢复方式，控制器可以把它们映射为稳定的 HTTP 响应或消息提示，而不是暴露底层异常。",
    },
    practiceSteps: [
      "为一个任务服务画出控制器、应用服务和仓库边界。",
      "为创建、查询、更新状态定义错误模型。",
      "补一个事务回滚测试，确认业务不变量没有被部分更新。",
    ],
    masteryChecklist: [
      "能解释事务边界围绕哪个业务不变量。",
      "能从错误类型判断调用方应如何恢复。",
    ],
  },
};
