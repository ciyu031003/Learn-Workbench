import type { LearningDifficulty, LearningQuestion, LearningLevel } from "./types";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function singleQuestion(input: {
  key: string; stageKey: string; topicKey: string;
  stem: string; options: [string, string, string, string];
  answer: "A" | "B" | "C" | "D"; explanation: string;
  difficulty: LearningDifficulty; tags: string[]; sourceKey: string; level: LearningLevel;
}): LearningQuestion {
  return { key: input.key, stageKey: input.stageKey, topicKey: input.topicKey, type: "single",
    stem: input.stem, options: input.options.map((text, i) => ({ key: OPTION_KEYS[i], text })),
    answer: [input.answer], explanation: input.explanation, difficulty: input.difficulty,
    tags: input.tags, sourceKey: input.sourceKey, level: input.level };
}

function judgeQuestion(input: {
  key: string; stageKey: string; topicKey: string;
  stem: string; answer: boolean; explanation: string;
  difficulty: LearningDifficulty; tags: string[]; sourceKey: string; level: LearningLevel;
}): LearningQuestion {
  return { key: input.key, stageKey: input.stageKey, topicKey: input.topicKey, type: "judge",
    stem: input.stem, options: [{ key: "A", text: "正确" }, { key: "B", text: "错误" }],
    answer: [input.answer ? "A" : "B"], explanation: input.explanation, difficulty: input.difficulty,
    tags: input.tags, sourceKey: input.sourceKey, level: input.level };
}

/** Java 补充题库（按知识点细分，2 题/知识点）。 */
export const javaSupplementQuestions: LearningQuestion[] = [
  // ===== java-types-control =====
  singleQuestion({ key: "java-sup-java-types-control-s1", stageKey: "java-foundation", topicKey: "java-types-control",
    stem: "关于 Java 中基本类型与包装类型的自动装箱（autoboxing）和拆箱（unboxing），下列描述正确的是？",
    options: [
      "自动装箱会把 int 转为 Integer，但在表达式中 int 与 Integer 参与比较时总是用 == 比较二者的引用地址",
      "Integer.valueOf(127) 与 Integer.valueOf(127) 在缓存范围内返回同一对象，但 new Integer(127) 每次都新建对象，对其使用 == 比较可能返回 false",
      "自动装箱不会改变数值范围，Integer 在 -128 到 127 之外的对象也使用同一缓存实例",
      "包装类型 Double 与基本类型 double 使用 == 比较时总是比较值相等而非引用地址"
    ],
    answer: "B",
    explanation: "正确。Java 对 Integer 在 -128 到 127（含）之间使用整数缓存 IntegerCache，调用 Integer.valueOf 会复用缓存对象，所以两个 valueOf(127) 用 == 比较为 true；但 new Integer(127) 强制创建新对象，其 == 比较引用地址会返回 false。A 错误，表达式中 Integer 会先拆箱为 int 再用值比较；C 错误，超出缓存范围会新建对象；D 错误，== 对 Double 包装类型比较的是引用而非值，需 equals 或拆箱后比较。",
    difficulty: "easy", tags: ["自动装箱", "包装类型"], sourceKey: "tech-interview-handbook", level: "入门" }),
  judgeQuestion({ key: "java-sup-java-types-control-j1", stageKey: "java-foundation", topicKey: "java-types-control",
    stem: "在 Java 14 引入的 switch 表达式（switch expression）中，每个 case 分支都必须通过 yield 或箭头语法产生一个值，且表达式必须涵盖所有可能输入（或使用 default），否则编译报错。",
    answer: true,
    explanation: "正确。switch 表达式是穷尽的：它要求处理所有可能分支并提供返回值（通过 yield 或 -> 箭头），若缺少分支又无 default，编译器会报“必须为 switch 表达式提供默认值”的错误。相较之下传统的 switch 语句并不强制穷尽。这一设计保证了表达式在编译期就能确定返回值，避免遗漏分支造成逻辑错误。",
    difficulty: "easy", tags: ["switch表达式", "控制流"], sourceKey: "tech-interview-handbook", level: "入门" }),

  // ===== java-oop =====
  singleQuestion({ key: "java-sup-java-oop-s1", stageKey: "java-foundation", topicKey: "java-oop",
    stem: "关于 Java 中子类重写（override）父类方法时必须遵守的规则，下列描述正确的是？",
    options: [
      "子类重写方法的访问修饰符可以比父类更严格（例如父类 public 子类改为 private），只要方法签名一致即可",
      "子类重写方法的返回类型必须与父类完全一致，不能使用协变返回类型（covariant return type）",
      "子类重写方法抛出的受检异常不能比父类方法声明的异常更宽泛（可以更少或不抛），且不能降低访问可见性",
      "使用 @Override 注解是强制性的，缺少该注解的方法一定不是重写"
    ],
    answer: "C",
    explanation: "正确。重写规则要求：方法签名一致；访问修饰符不能比父类更严格（只能更宽松或相等）；返回类型可以是父类返回类型的子类（协变返回）；抛出的受检异常范围不能扩大；@Override 仅用于编译期校验，非强制但推荐。A 错在不能更严格；B 错在支持协变返回类型；D 错在注解并非强制。",
    difficulty: "easy", tags: ["继承", "重写"], sourceKey: "tech-interview-handbook", level: "入门" }),
  judgeQuestion({ key: "java-sup-java-oop-j1", stageKey: "java-foundation", topicKey: "java-oop",
    stem: "在 Java 8 及之后，接口（interface）中除了抽象方法外，还可以定义带 default 修饰的默认方法（提供方法体）以及带 static 修饰的静态方法，且默认方法允许被子接口或实现类重写。",
    answer: true,
    explanation: "正确。Java 8 引入接口默认方法（default method）与静态方法：默认方法带有方法体，允许实现类继承或重写，也允许子接口重写或重新声明为抽象；静态方法属于接口本身。这解决了在既有接口中新增方法时破坏所有实现类的问题，是接口演进的重要机制，也是后续 Stream API 等得以落地的基础。",
    difficulty: "medium", tags: ["接口", "默认方法"], sourceKey: "tech-interview-handbook", level: "进阶" }),

  // ===== java-exceptions =====
  singleQuestion({ key: "java-sup-java-exceptions-s1", stageKey: "java-foundation", topicKey: "java-exceptions",
    stem: "关于 Java 的 try-with-resources 与资源管理，下列描述正确的是？",
    options: [
      "try-with-resources 只能用于实现 AutoCloseable 接口的资源，且无论是否发生异常都会在块结束时自动调用 close()，close 抛出的异常会屏蔽原异常",
      "当 try 块与 close() 都抛出异常时，try 块的异常会被抑制（suppressed）并可通过 getSuppressed() 获取，close 的异常向上抛出",
      "finally 块中的 return 语句会保留 try 块中已计算的返回值",
      "受检异常（checked exception）必须在方法签名 throws 或 catch，但 RuntimeException 也必须在编译期显式处理"
    ],
    answer: "B",
    explanation: "正确。try-with-resources 中若 try 块和 close() 都抛异常，try 块的异常被抛出，close() 的异常作为被抑制异常附加到主异常，可通过 Throwable.getSuppressed() 获取，从而保证资源异常不丢失。A 错在描述方向反了（close 异常被抑制，原异常抛出）；C 错在 finally 的 return 会覆盖 try 的返回值；D 错在 RuntimeException 是未受检异常，不必显式处理。",
    difficulty: "medium", tags: ["异常处理", "资源管理"], sourceKey: "advanced-java-reference", level: "进阶" }),
  judgeQuestion({ key: "java-sup-java-exceptions-j1", stageKey: "java-foundation", topicKey: "java-exceptions",
    stem: "在 Java 中捕获异常时，应尽量捕获具体的子类型异常（如 IOException）而非宽泛的 Exception，且不应“吞掉”异常（空 catch 块），否则会掩盖错误并阻碍问题排查。",
    answer: true,
    explanation: "正确。过于宽泛的 catch(Exception) 会捕获包括 RuntimeException 在内的所有异常，可能掩盖编程错误（如 NullPointerException）并破坏异常处理语义；空的 catch 块丢弃了异常堆栈，使问题难以定位。最佳实践是按具体异常类型分别处理，必要时将异常包装后重新抛出或记录日志，保证错误信息可追溯。",
    difficulty: "medium", tags: ["异常处理", "最佳实践"], sourceKey: "advanced-java-reference", level: "进阶" }),

  // ===== java-collections =====
  singleQuestion({ key: "java-sup-java-collections-s1", stageKey: "java-collections", topicKey: "java-collections",
    stem: "关于 Java 集合框架中的 HashMap，下列描述正确的是？",
    options: [
      "HashMap 允许键（key）为 null 且允许多个 null 键共存，但 value 不能为 null",
      "HashMap 在 JDK 8 中采用“数组 + 链表 + 红黑树”结构，当某桶链表长度达到 8 且数组容量不小于 64 时会树化为红黑树，查找复杂度由 O(n) 降为 O(log n)",
      "HashMap 是线程安全的，多个线程并发 put 不会产生数据不一致",
      "HashMap 的迭代器是 fail-safe 的，并发修改时会复制底层数组，不会抛出 ConcurrentModificationException"
    ],
    answer: "B",
    explanation: "正确。JDK 8 的 HashMap 底层为数组 + 链表 + 红黑树：当链表长度 >= 8 且 table 容量 >= 64 时链表转为红黑树，提升极端哈希冲突下的查询效率。A 错在 HashMap 只允许一个 null 键；C 错在 HashMap 非线程安全，并发修改可能导致数据覆盖（JDK 8 已修复死循环隐患但仍非安全）；D 错在 HashMap 迭代器是 fail-fast 而非 fail-safe，并发结构性修改会抛 ConcurrentModificationException。",
    difficulty: "medium", tags: ["集合", "HashMap"], sourceKey: "algorithms-java", level: "进阶" }),
  judgeQuestion({ key: "java-sup-java-collections-j1", stageKey: "java-collections", topicKey: "java-collections",
    stem: "两个 ArrayList 实例使用 equals 比较时，只要它们包含的元素数量相同且对应位置的元素分别 equals 相等，即认为两个列表相等，与引用的具体实现类无关。",
    answer: true,
    explanation: "正确。List 接口约定 equals 基于“顺序与元素相等”：两个列表长度相同且每个索引处元素通过 equals 相等即判等，不要求同为 ArrayList（例如 ArrayList 与 LinkedList 也可相等）。这是 List 契约的一部分，区别于基于引用地址的 == 比较，也区别于 Set（不关心顺序）。",
    difficulty: "medium", tags: ["集合", "相等性"], sourceKey: "algorithms-java", level: "进阶" }),

  // ===== java-generics =====
  singleQuestion({ key: "java-sup-java-generics-s1", stageKey: "java-collections", topicKey: "java-generics",
    stem: "关于 Java 泛型与通配符，下列描述正确的是？",
    options: [
      "List<String> 是 List<Object> 的子类型，因此可以把 List<String> 赋值给 List<Object> 变量",
      "通配符上界 List<? extends Number> 表示“某种 Number 子类型的列表”，可以安全地向其添加任意 Number 子类型元素",
      "通配符下界 List<? super Integer> 表示“Integer 或其父类型的列表”，可以安全地添加 Integer 对象，但读取时只能当作 Object",
      "泛型类型参数可以使用基本类型（如 List<int>）作为类型实参"
    ],
    answer: "C",
    explanation: "正确。下界通配符 <? super Integer> 接受 Integer 及其祖先类型（如 Number、Object）的列表，由于写入 Integer 一定兼容所有下限类型，因此可以安全地 add(Integer)；但读取时编译器只知道元素至少是 Object，故只能按 Object 读取。A 错在泛型不支持协变，List<String> 不是 List<Object> 子类型；B 错在上界列表只能读取为 Number 而不能安全写入（除 null）；D 错在泛型只能使用引用类型，不能用 int。",
    difficulty: "medium", tags: ["泛型", "通配符"], sourceKey: "advanced-java-reference", level: "进阶" }),
  judgeQuestion({ key: "java-sup-java-generics-j1", stageKey: "java-collections", topicKey: "java-generics",
    stem: "Java 的泛型是通过类型擦除（type erasure）实现的，运行时泛型类型参数信息被擦除，因此无法在运行时通过 instanceof 判断泛型容器的具体类型参数（如 new ArrayList<String>() 与 new ArrayList<Integer>() 在运行时表现为同一原始类型），且不能创建泛型数组 T[]。",
    answer: true,
    explanation: "正确。Java 泛型采用编译期类型擦除，字节码中 List<String> 与 List<Integer> 都被擦为原始类型 List，运行时无法区分其类型参数，故 instanceof 仅能针对原始类型判断，对类型参数的检查被擦除；同时由于数组的运行时类型必须具体，虚拟机禁止创建泛型数组 T[]（只能 (T[]) new Object[n] 并伴随未受检警告）。这是 Java 泛型与 C++ 模板在运行时行为的根本差异。",
    difficulty: "hard", tags: ["泛型", "类型擦除"], sourceKey: "advanced-java-reference", level: "综合" }),

  // ===== java-stream =====
  singleQuestion({ key: "java-sup-java-stream-s1", stageKey: "java-collections", topicKey: "java-stream",
    stem: "关于 Java 8 的 Stream 与 Optional，下列描述正确的是？",
    options: [
      "Stream 的中间操作（如 filter、map）会立即执行并遍历数据，终端操作（如 collect、forEach）只是声明",
      "对一个 Stream 只能调用一次终端操作，再次调用会抛出 IllegalStateException，因为 Stream 一旦消费即不可复用",
      "Optional.of(null) 可以正常创建包含 null 值的 Optional，而 Optional.ofNullable(null) 会抛出 NullPointerException",
      "使用 Collectors.groupingBy 进行分组时，若分组函数返回 null 键会抛出 NullPointerException"
    ],
    answer: "B",
    explanation: "正确。Stream 设计为“一次性消费”：中间操作是惰性的（仅构建流水线），终端操作触发实际计算并消耗流，再次调用终端操作会抛 IllegalStateException（stream has already been operated upon or closed）。A 错在中间操作惰性、终端操作才触发；C 错在 of(null) 直接抛 NPE，ofNullable(null) 返回空 Optional；D 错在 groupingBy 允许 null 键（结果映射中存在 null 键条目）。",
    difficulty: "medium", tags: ["Stream", "Optional"], sourceKey: "advanced-java-reference", level: "进阶" }),
  judgeQuestion({ key: "java-sup-java-stream-j1", stageKey: "java-collections", topicKey: "java-stream",
    stem: "Optional 的设计目的是显式表示一个“可能为空”的值，应避免直接调用 get()（可能抛 NoSuchElementException），而应优先使用 orElse、orElseGet、ifPresent 或将其转换为流（stream()）等安全方式消费。",
    answer: true,
    explanation: "正确。Optional 用类型系统强制调用方处理“无值”情形，但直接 get() 在空值时会抛 NoSuchElementException，违背其安全性初衷；推荐用 orElse(default) 提供默认值、orElseGet(Supplier) 惰性求值、ifPresent 仅在存在时执行，或用 stream() 把空 Optional 融入流式处理，从而消除散落的 null 检查并减少 NPE。",
    difficulty: "medium", tags: ["Optional", "函数式"], sourceKey: "advanced-java-reference", level: "进阶" }),

  // ===== java-concurrency =====
  singleQuestion({ key: "java-sup-java-concurrency-s1", stageKey: "java-concurrency", topicKey: "java-threads",
    stem: "关于 Java 内存模型（JMM）中的 volatile 与 synchronized，下列描述正确的是？",
    options: [
      "volatile 能保证复合操作（如 i++）的原子性，因此多线程自增用 volatile 即可保证线程安全",
      "volatile 保证可见性与禁止指令重排序（建立 happens-before 关系），但不保证原子性；synchronized 同时保证原子性、可见性与有序性",
      "synchronized 块仅保证同一时刻只有一个线程进入，对变量可见性没有作用",
      "将共享变量声明为 volatile 后，线程对该变量的读取一定能看到其他线程最近一次写入的旧值而不是最新值"
    ],
    answer: "B",
    explanation: "正确。volatile 提供可见性（写立即刷新主存、读从主存取）和有序性（禁止相关指令重排序，建立 happens-before），但不保证复合读写（如 i++ 的读-改-写）的原子性；synchronized 通过监视器锁同时保证原子性、可见性与有序性。A 错在 volatile 不保证 i++ 原子性（需 AtomicInteger 或锁）；C 错在 synchronized 解锁前刷新主存，也保证可见性；D 错在 volatile 读看到的是最新写入值。",
    difficulty: "hard", tags: ["并发", "JMM"], sourceKey: "advanced-java-reference", level: "综合" }),
  judgeQuestion({ key: "java-sup-java-concurrency-j1", stageKey: "java-concurrency", topicKey: "java-threads",
    stem: "调用 Thread.sleep(long) 会让当前线程暂停执行指定时间，但 sleep 期间线程并不会释放它已经持有的任何对象监视器锁（synchronized 锁），因此持有锁时 sleep 会阻塞其他需要该锁的线程。",
    answer: true,
    explanation: "正确。Thread.sleep 仅挂起当前线程、让出 CPU 时间片，但保持已获得的监视器锁不释放；这与 Object.wait 不同——wait 会释放锁并进入等待集。因此在 synchronized 块内调用 sleep 会导致锁长时间不释放，降低并发度，这也是为什么等待条件时应使用 wait/await 而非 sleep。",
    difficulty: "medium", tags: ["并发", "线程"], sourceKey: "advanced-java-reference", level: "进阶" }),

  // ===== java-threads =====
  singleQuestion({ key: "java-sup-java-threads-s1", stageKey: "java-concurrency", topicKey: "java-threads",
    stem: "关于 Java 并发工具类，下列描述正确的是？",
    options: [
      "ExecutorService 的 submit(Callable) 返回 Future，调用 Future.get() 会阻塞直到任务完成并返回计算结果，任务抛出的异常会被包装为 ExecutionException 抛出",
      "CompletableFuture 只能用于单线程顺序任务，不能进行异步组合（如 thenApply、thenCombine）",
      "Thread 类的 run() 方法直接启动新线程，而 start() 只是在当前线程同步执行 run 体",
      "调用 ExecutorService.shutdown() 会立即中断正在执行的任务并返回"
    ],
    answer: "A",
    explanation: "正确。ExecutorService.submit 提交 Callable 返回 Future，Future.get 阻塞等待结果，若任务异常则被封装为 ExecutionException（可通过 getCause 取根因）。B 错在 CompletableFuture 专为异步组合设计，支持 thenApply、thenCombine、thenCompose 等；C 错在 start() 才启动新线程，run() 只是普通方法调用（不创建线程）；D 错在 shutdown() 只阻止新任务提交并等待已提交任务完成，不强制中断。",
    difficulty: "medium", tags: ["线程池", "Future"], sourceKey: "advanced-java-reference", level: "进阶" }),
  judgeQuestion({ key: "java-sup-java-threads-j1", stageKey: "java-concurrency", topicKey: "java-threads",
    stem: "在 Java 中调用 Object.wait()、wait(long) 或 notify()/notifyAll() 时，调用线程必须持有该对象的监视器锁（即在 synchronized 块/方法内），否则会抛出 IllegalMonitorStateException。",
    answer: true,
    explanation: "正确。wait/notify 机制依赖对象监视器：线程只有在进入 synchronized(obj) 获得 obj 的锁后才能调用 obj.wait/notify，否则 JVM 抛 IllegalMonitorStateException；进入 wait 后线程释放锁并等待，被 notify 唤醒后需重新竞争锁才能继续。这一约束保证了等待-通知的原子性与可见性，避免丢失唤醒（lost wakeup）问题。",
    difficulty: "medium", tags: ["线程", "等待通知"], sourceKey: "advanced-java-reference", level: "进阶" }),

  // ===== java-jvm =====
  singleQuestion({ key: "java-sup-java-jvm-s1", stageKey: "java-concurrency", topicKey: "java-jvm",
    stem: "关于 JVM 内存区域与垃圾回收，下列描述正确的是？",
    options: [
      "Java 堆（Heap）用于存放局部变量与方法调用栈帧，线程私有；方法区（元空间）存放对象实例",
      "在 HotSpot JVM 中，堆通常分为新生代（Eden + 两个 Survivor）与老年代，绝大多数对象“朝生夕死”，新生对象在 Eden 分配，Minor GC 后存活对象进入 Survivor 并最终晋升老年代",
      "元空间（Metaspace）位于 JVM 堆内，使用堆内存存储类元数据，受 -Xmx 限制",
      "垃圾回收的可达性分析以“引用计数”为主要判定依据，当引用计数为 0 时立即回收"
    ],
    answer: "B",
    explanation: "正确。HotSpot 堆分代：新生代含 Eden 与两个 Survivor（From/To），新对象在 Eden 分配，Minor GC 把存活对象复制到 Survivor，年龄达到阈值后晋升老年代，符合“弱分代假说”（多数对象短命）。A 错在栈帧/局部变量在栈（线程私有），对象实例在堆；C 错在元空间使用本地内存（Native Memory），不受 -Xmx 限制（受 -XX:MaxMetaspaceSize 限制）；D 错在 HotSpot 用可达性分析（GC Roots 引用链）而非引用计数，引用计数无法处理循环引用。",
    difficulty: "hard", tags: ["JVM", "垃圾回收"], sourceKey: "advanced-java-reference", level: "综合" }),
  judgeQuestion({ key: "java-sup-java-jvm-j1", stageKey: "java-concurrency", topicKey: "java-jvm",
    stem: "在 Java 中，基本数据类型（如 int、double）的局部变量存储在栈（虚拟机栈的栈帧）中，而通过 new 创建的对象实例存储在堆（Heap）中，栈中的局部变量只保存指向堆中对象的引用。",
    answer: true,
    explanation: "正确。Java 内存模型将基本类型局部变量直接放在虚拟机栈的栈帧局部变量表中，随方法结束出栈；而 new 出来的对象实例分配在堆上，栈帧中仅保存一个引用（指针）指向该对象。这种“栈存引用、堆存对象”的划分是理解内存占用、参数传递（值传递引用）和垃圾回收的基础。",
    difficulty: "easy", tags: ["JVM", "内存模型"], sourceKey: "advanced-java-reference", level: "入门" }),

  // ===== java-performance =====
  singleQuestion({ key: "java-sup-java-performance-s1", stageKey: "java-concurrency", topicKey: "java-performance",
    stem: "关于 Java 性能优化与可观测性，下列描述正确的是？",
    options: [
      "使用 System.currentTimeMillis() 之差即可写出准确可靠的微基准测试，无需考虑 JVM 预热与 JIT 编译",
      "应使用 JMH（Java Microbenchmark Harness）编写微基准，它通过多轮预热（warmup）、充分迭代与统计处理消除 JVM 预热、死代码消除等干扰，得到可信的纳秒级度量",
      "生产环境排查 CPU 飙高，第一步应直接重启服务，无需保留线程栈（jstack）或堆转储（jmap）证据",
      "GC 日志对性能调优没有帮助，应始终保持关闭以节省 I/O"
    ],
    answer: "B",
    explanation: "正确。JMH 是 OpenJDK 官方微基准框架，通过 @Warmup 预热让 JIT 完成编译、@Measurement 多次测量、Fork 隔离进程、Blackhole 防止死代码消除，给出稳定统计结果，远比手写 currentTimeMillis 差值可靠。A 错在未预热/未消除死代码会得出失真数据；C 错在重启会丢失现场，应先 jstack/jmap 取证；D 错在 GC 日志是调优关键证据，现代 JVM 下开销很小应开启。",
    difficulty: "hard", tags: ["性能", "基准测试"], sourceKey: "advanced-java-reference", level: "综合" }),
  judgeQuestion({ key: "java-sup-java-performance-j1", stageKey: "java-concurrency", topicKey: "java-performance",
    stem: "在 Java 中进行性能优化时，应“先度量、后优化”，基于 profiling（如火焰图、JFR 飞行记录）定位真正的瓶颈，避免仅凭直觉对“看起来慢”的代码做局部微调。",
    answer: true,
    explanation: "正确。性能优化遵循“度量优先”原则：通过 JFR（Java Flight Recorder）、Async Profiler 火焰图等工具获得真实热点数据，才能识别是 CPU、锁竞争、GC 还是 I/O 成为瓶颈。凭直觉优化常落入“把不热的代码改快”的陷阱，既浪费精力又可能引入复杂度与缺陷。",
    difficulty: "medium", tags: ["性能", "可观测性"], sourceKey: "advanced-java-reference", level: "进阶" }),

  // ===== java-engineering =====
  singleQuestion({ key: "java-sup-java-engineering-s1", stageKey: "java-engineering", topicKey: "java-build",
    stem: "关于软件工程实践与设计原则，下列描述正确的是？",
    options: [
      "单一职责原则（SRP）要求一个类只承担一个引起它变化的原因，即一个类应只负责一类功能",
      "依赖倒置原则（DIP）要求高层模块直接依赖低层模块的具体实现，以降低耦合",
      "开闭原则（OCP）主张对修改开放、对扩展关闭，即应频繁修改已有类来适应新需求",
      "在项目中使用大量静态工具类（static util）是降低耦合、提高可测试性的最佳实践"
    ],
    answer: "A",
    explanation: "正确。单一职责原则指出一个类/模块应只有一个导致其变化的原因，职责过多会使修改相互影响、难以维护与测试。B 错在 DIP 主张高层与低层都依赖抽象（接口）而非具体实现；C 错在 OCP 是“对扩展开放、对修改关闭”，通过抽象与多态扩展而非改动已有代码；D 错在静态工具类难以 mock、不利于单元测试，应通过依赖注入管理协作。",
    difficulty: "medium", tags: ["设计原则", "工程实践"], sourceKey: "tech-interview-handbook", level: "进阶" }),
  judgeQuestion({ key: "java-sup-java-engineering-j1", stageKey: "java-engineering", topicKey: "java-build",
    stem: "持续集成（CI）的核心思想是开发者频繁（如每天多次）将代码合并到主干，并自动触发构建与测试，以便尽早发现集成错误，而不是等到发布前才集中合并。",
    answer: true,
    explanation: "正确。持续集成强调“小步快跑、频繁集成”：每次提交都自动执行编译、单元测试、静态检查等，使冲突与缺陷在最早、最小范围内暴露并修复，避免“集成地狱”。它配合自动化测试与可重复的构建流水线，是现代工程实践（DevOps）的基石。",
    difficulty: "easy", tags: ["工程实践", "CI"], sourceKey: "tech-interview-handbook", level: "入门" }),

  // ===== java-build =====
  singleQuestion({ key: "java-sup-java-build-s1", stageKey: "java-engineering", topicKey: "java-build",
    stem: "关于 Java 构建与依赖管理（Maven/Gradle），下列描述正确的是？",
    options: [
      "Maven 的 provided 范围表示依赖在编译和测试期可用，但运行期由 JDK 或容器（如 Servlet API 由应用服务器）提供，因此不会被打包进最终产物",
      "Maven 的 compile 范围表示依赖仅在编译期可用，运行期不可见也不会被打包",
      "Gradle 使用与 Maven 完全相同的 XML 构建脚本，二者配置方式一致",
      "传递性依赖（transitive dependency）无法被排除，必须全部进入最终包，否则构建报错"
    ],
    answer: "A",
    explanation: "正确。Maven 中 provided 表示编译/测试期需要但运行期由容器（如 Tomcat 提供 Servlet API）提供，不打包，避免与容器实现冲突；compile 是默认范围，编译、测试、运行都可用并打包。B 错在 compile 会被打包；C 错在 Gradle 默认用 Groovy/Kotlin DSL 而非 XML；D 错在可用 <exclusions> 排除传递依赖。",
    difficulty: "easy", tags: ["构建", "依赖管理"], sourceKey: "tech-interview-handbook", level: "入门" }),
  judgeQuestion({ key: "java-sup-java-build-j1", stageKey: "java-engineering", topicKey: "java-build",
    stem: "Maven 的“依赖调解”（dependency mediation）在出现依赖版本冲突时，默认采用“最短路径优先”（nearest definition）策略，即依赖树中离项目最近的版本被选中，路径长度相同时按声明顺序取先声明者。",
    answer: true,
    explanation: "正确。Maven 2.0+ 默认真近优先：当同一构件多个版本出现在依赖树不同深度时，选择离项目根最近的版本；若深度相同，则取 pom 中先声明的依赖版本。这能避免隐式升级带来的不兼容，但也可能意外选中旧版本，必要时可用 <dependencyManagement> 显式锁定版本。",
    difficulty: "medium", tags: ["构建", "依赖调解"], sourceKey: "tech-interview-handbook", level: "进阶" }),

  // ===== java-patterns =====
  singleQuestion({ key: "java-sup-java-patterns-s1", stageKey: "java-engineering", topicKey: "java-patterns",
    stem: "关于设计模式中的单例（Singleton）与工厂（Factory），下列描述正确的是？",
    options: [
      "饿汉式单例在类加载时就创建实例，天然线程安全，但可能造成启动期不必要的资源占用；懒汉式若不加同步则存在多线程下创建多个实例的风险",
      "单例模式应尽量提供 public 静态实例字段并暴露可写 setter 以便运行时替换实现",
      "工厂方法模式要求调用方直接 new 具体产品类，从而解耦创建与使用",
      "双重检查锁定（double-checked locking）在 Java 中无需将实例字段声明为 volatile 也能保证线程安全"
    ],
    answer: "A",
    explanation: "正确。饿汉式（静态字段直接初始化）借助类加载机制天然线程安全但提前占用资源；懒汉式延迟创建，若 getInstance 未加 synchronized/锁，多线程可能同时进入并创建多个实例破坏单例。B 错在单例应防止外部替换；C 错在工厂模式正是不让调用方直接 new，而由工厂封装创建逻辑；D 错在双重检查锁定必须把实例声明为 volatile，否则可能因指令重排序读到未构造完成的对象。",
    difficulty: "medium", tags: ["设计模式", "单例"], sourceKey: "java-patterns", level: "进阶" }),
  judgeQuestion({ key: "java-sup-java-patterns-j1", stageKey: "java-engineering", topicKey: "java-patterns",
    stem: "在 Java 中实现线程安全的延迟初始化单例时，除了传统的“双重检查锁定 + volatile”外，还可利用“静态内部类持有实例”的写法（Initialization-on-demand holder idiom），它借助类加载的线程安全语义实现懒加载且无需显式加锁。",
    answer: true,
    explanation: "正确。静态内部类方式：外部类加载时并不初始化内部类的 INSTANCE，只有首次调用 getInstance 触发内部类加载时才创建实例；而 JVM 保证类的初始化（<clinit>）是线程安全的，因此该写法既实现懒加载又无需 volatile 或 synchronized，且无饿汉式的提前占用，是推荐的线程安全单例实现之一。",
    difficulty: "hard", tags: ["设计模式", "线程安全"], sourceKey: "java-patterns", level: "综合" }),

  // ===== java-service =====
  singleQuestion({ key: "java-sup-java-service-s1", stageKey: "java-engineering", topicKey: "java-service",
    stem: "关于服务分层架构与事务管理，下列描述正确的是？",
    options: [
      "在典型的分层架构（Controller→Service→Repository）中，事务边界通常声明在 Service 层，Controller 层应尽量避免直接操作事务，以保证业务一致性与职责清晰",
      "Spring 的 @Transactional 标注在 private 方法上也能正常开启事务代理",
      "数据库事务的隔离级别“可重复读”（REPEATABLE READ）允许同一事务内两次读取看到其他事务已提交的新插入行（幻读）",
      "声明式事务中，方法抛出受检异常（checked exception）时 Spring 默认一定会回滚"
    ],
    answer: "A",
    explanation: "正确。事务边界放在 Service 层是分层架构共识：一个业务用例常跨多个 Repository 操作，应在 Service 内以事务包裹以保证 ACID 一致性；Controller 只负责协议与参数，不应掺杂事务。B 错在 Spring AOP 基于代理，private 方法无法被代理，@Transactional 不生效；C 错在可重复读通过 MVCC/间隙锁避免幻读（MySQL InnoDB 下）；D 错在 Spring 默认仅对未受检异常（RuntimeException/Error）回滚，受检异常默认提交。",
    difficulty: "hard", tags: ["分层架构", "事务"], sourceKey: "tech-interview-handbook", level: "综合" }),
  judgeQuestion({ key: "java-sup-java-service-j1", stageKey: "java-engineering", topicKey: "java-service",
    stem: "在 Spring 声明式事务中，若 Service 方法 A 调用同一类中的另一个 @Transactional 方法 B，由于调用发生在对象内部（this 调用）未经过代理，B 上的事务注解默认不会生效，即“自调用”会导致事务增强失效。",
    answer: true,
    explanation: "正确。Spring 事务通过 AOP 代理实现，当方法 A 内部直接调用同类方法 B 时，使用的是 this（目标对象）而非代理对象，绕过了事务拦截器，因此 B 的 @Transactional 设置（如新的传播行为、隔离级别）不会应用。解决方式包括：将 B 移到另一 Bean、通过注入自身代理（@Lazy self）或用 AspectJ 编译/加载期织入来启用自调用增强。",
    difficulty: "medium", tags: ["事务", "自调用"], sourceKey: "tech-interview-handbook", level: "进阶" })
];
