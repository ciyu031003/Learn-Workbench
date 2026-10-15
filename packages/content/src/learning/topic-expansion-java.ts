/**
 * Java · 知识点扩容（2026-10-15，追加式）。
 *
 * 1 条 expansion = 1 个新知识点 + 它的 2 道配套题。新知识点由 expandLearningTrack
 * 合并进对应阶段，因此 stageKey 必须是 java.ts 里真实存在的阶段 key。
 * 内容口径：讲透、讲准、给细节；术语必须配人话解释；每章要有可复述的小结。
 */
import type { TopicExpansion } from "./topic-expansions";

export const javaTopicExpansions: TopicExpansion[] = [
  {
    trackSlug: "java",
    stageKey: "java-foundation",
    topic: {
      key: "java-string-immutability",
      title: "String 不可变性与拼接",
      summary:
        "String 一旦创建就不能修改，所有看起来在修改的方法都返回新对象；循环里用 + 拼接会反复复制，应该改用 StringBuilder。",
      concepts: ["不可变性", "字符串常量池", "StringBuilder", "== 与 equals"],
      principles: [
        "String 是不可变对象：任何修改方法都返回新字符串，原对象内容不变。",
        "内容相同的字面量会复用字符串常量池里的同一个对象，所以 == 可能碰巧为 true；new String 一定创建新对象，内容比较必须用 equals。",
        "循环内用 + 拼接会在每轮创建新对象并复制已有内容，总代价接近 O(n^2)；StringBuilder 在同一个可扩容缓冲区追加，均摊代价接近常数。",
      ],
      applications: [
        "循环里大量拼接（生成 SQL、日志、报文）时用 StringBuilder 累积。",
        "理解常量池的行为，但代码里一律用 equals 比较字符串内容。",
      ],
      pitfalls: [
        "用 == 比较两个字符串的内容：内容相同但不是同一个对象时返回 false。",
        "把 String 当可变缓存反复 +=，数据量大时产生大量临时对象，增加 GC 压力。",
      ],
      method: "先判断是否真的要修改：只比较用 equals，循环拼接用 StringBuilder，只在需要不可变共享时保留 String。",
      exercise: "把一段在循环里用 + 拼接日志的代码改成 StringBuilder，并验证输出结果完全一致。",
      checkpoint: "能解释 String 为什么不可变，以及 == 与 equals 在字符串上的区别。",
      lesson: {
        overview: [
          "String 是 Java 里最常用的类，但它有一个容易被忽略的性质：不可变。也就是说，一个 String 对象一旦被创建，它内部的字符序列就不会再改变。像 replace、substring、toUpperCase 这些看起来在修改字符串的方法，其实都返回一个新的 String，原来的对象原封不动。理解这一点，是理解后面所有字符串行为和性能问题的起点。",
          "不可变带来两个直接后果。第一是可以安全共享：多个变量可以指向同一个 String 对象，谁都不会改坏别人的数据，所以字面量可以被放进常量池复用。第二是拼接有代价：每次修改都要新建对象，一旦写进循环，每轮都会把已有内容复制一遍，数据量大时性能会明显下滑，这也解释了为什么需要 StringBuilder。",
        ],
        mechanism: [
          "String 内部用 final 的字符数组（JDK 9 之后是 byte 数组加编码标记）保存内容，并且不对外提供任何修改该数组的方法，所以从外部无法改变它的字符。",
          "Java 会把源码里的字面量字符串放进字符串常量池：内容相同的字面量只保留一份，因此它们指向同一个对象，用 == 比较会得到 true；而 new String 会在堆上另建对象，== 就不再相等。",
          "用 + 拼接时，编译器和 JIT 只在单个表达式范围内做拼接优化；循环体每一轮都是一次独立求值，于是每轮都要新建缓冲区并复制之前累积的内容，总工作量随长度接近平方增长。",
          "StringBuilder 内部维护一个可扩容的字符数组，append 只在末尾写入，扩容按倍数进行，所以连续追加的均摊代价接近常数，最后调用 toString 复制一次得到结果。",
        ],
        example: {
          title: "循环拼接：+ 与 StringBuilder 的差别",
          language: "java",
          code: "String[] rows = {\"alice,90\", \"bob,85\", \"carol,78\"};\n\n// 反例：每轮都创建新的 String，并把之前累积的内容复制一遍\nString bad = \"\";\nfor (String row : rows) {\n    bad += row + \";\";\n}\n\n// 正例：在同一个可变缓冲区末尾追加，最后一次性转成 String\nStringBuilder sb = new StringBuilder();\nfor (String row : rows) {\n    sb.append(row).append(';');\n}\nString good = sb.toString();\n\nSystem.out.println(bad.equals(good)); // true，结果一样，过程开销不同",
          explanation:
            "两种写法输出完全一样，差别在过程。第一种每轮都新建一个 String，并把之前累积的所有字符重新复制一遍；第二种只在同一个可扩容数组末尾追加，最后调用 toString 复制一次成型。判断要不要改写，不看代码长短，而看拼接次数是否随数据增长：固定两三段的拼接用 + 更清楚，循环里的拼接才需要 StringBuilder。",
        },
        practiceSteps: [
          "写一个循环，把一万条记录用 + 拼成一个字符串，记录耗时。",
          "把同一段代码改成 StringBuilder，再跑一次，比较耗时以及结果是否一致。",
          "用 equals 比较两次的输出，确认改写没有改变语义。",
        ],
        masteryChecklist: [
          "能说出为什么 replace、substring 不会改变原字符串。",
          "能解释字面量用 == 可能为 true，而 new String 一定不相等。",
          "能判断一段拼接代码该不该换成 StringBuilder。",
        ],
        summary: [
          "String 不可变：所有修改方法都返回新对象。",
          "字面量进常量池会被复用，所以 == 可能碰巧为 true；比较内容必须用 equals。",
          "循环拼接用 StringBuilder，避免每轮复制已有内容。",
          "不可变换来安全共享，代价是每次修改都要新建对象。",
        ],
        terms: [
          {
            term: "不可变性（Immutability）",
            plain: "对象创建后，里面的内容就不能再改了。",
            detail:
              "看起来在修改的方法其实都是新建一个对象返回。好处是能被多个地方安全共享，也能放心当 Map 的键；代价是每次修改都要复制一份。",
          },
          {
            term: "字符串常量池（String Pool）",
            plain: "内容一样的字符串字面量，共用同一个对象。",
            detail:
              "只有字面量（以及显式 intern 的字符串）会进去，new String 不会。所以 == 有时为 true 有时为 false，程序里不能依赖这个行为。",
          },
          {
            term: "StringBuilder",
            plain: "可以反复追加内容的可变字符串缓冲区。",
            detail:
              "拼接前先用它累积，最后 toString 一次成型。它不保证线程安全；多线程共享同一个缓冲区时要用 StringBuffer（方法带同步，速度更慢）。",
          },
          {
            term: "均摊代价（Amortized Cost）",
            plain: "偶尔一次很慢，但平摊到每次操作就很便宜。",
            detail:
              "扩容时要复制数组，单次看是慢的；但每次扩容按倍数增长，平均到每次 append 就接近常数代价。这也是 StringBuilder 比 + 快的原因。",
          },
        ],
      },
    },
    questions: [
      {
        key: "java-sup-java-string-immutability-s1",
        stageKey: "java-foundation",
        topicKey: "java-string-immutability",
        type: "single",
        stem: "下面关于 Java 中 String 的说法，哪一项是正确的？",
        options: [
          { key: "A", text: "调用 s.toUpperCase() 会把 s 本身改成大写" },
          { key: "B", text: "String 不可变，toUpperCase 返回新对象，原对象内容不变" },
          { key: "C", text: "== 可以可靠地比较两个字符串的内容" },
          { key: "D", text: "循环里用 + 拼接与用 StringBuilder 的代价完全一样" },
        ],
        answer: ["B"],
        explanation:
          "String 是不可变类，所有看起来在修改的方法都返回新对象，原对象保持不变，所以 A 错 B 对。== 比较的是两个引用是否指向同一个对象，字面量可能因常量池复用而碰巧相等，但内容比较必须用 equals，C 错。循环里用 + 拼接每轮都会新建对象并复制已有内容，StringBuilder 则是在同一个缓冲区追加，两者代价差别很大，D 错。",
        difficulty: "easy",
        tags: ["String", "不可变", "性能"],
        sourceKey: "algorithms-java",
        level: "入门",
      },
      {
        key: "java-sup-java-string-immutability-j1",
        stageKey: "java-foundation",
        topicKey: "java-string-immutability",
        type: "judge",
        stem: "在循环中用 + 拼接字符串，编译器会把整个循环的拼接合并到同一个缓冲区，因此不会有额外开销。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "编译器对 + 的优化只作用在单个表达式内部，不会跨越循环的每一轮。循环体每轮都是一次独立求值，因此每轮都要新建缓冲区，并把之前累积的内容复制进去，总工作量随长度接近平方增长。要让同一个缓冲区被复用，必须像示例那样把它创建在循环外面，在循环里调用 append。",
        difficulty: "medium",
        tags: ["String", "拼接", "性能"],
        sourceKey: "algorithms-java",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "java",
    stageKey: "java-collections",
    topic: {
      key: "java-iterator-fail-fast",
      title: "集合遍历与安全删除",
      summary:
        "在增强 for 里删除元素会抛 ConcurrentModificationException，因为集合用修改计数做快速失败检查；正确做法是 Iterator.remove 或 removeIf。",
      concepts: ["快速失败", "modCount", "Iterator.remove", "removeIf"],
      principles: [
        "集合发生结构性修改（增删元素）时会改变内部修改计数，迭代器每次取元素都拿它和创建时记下的期望值比对，不一致就抛异常。",
        "增强 for 循环底层就是用迭代器，所以循环体内直接调用集合的 remove 会让实际计数和期望值错位。",
        "通过迭代器自己的 remove 删除，会同步更新那个期望值，因此不会触发快速失败。",
      ],
      applications: [
        "按条件清理列表中的无效元素，用 removeIf 一行表达。",
        "遍历过程中确实需要删除时，显式取出 Iterator 并在循环里使用它。",
      ],
      pitfalls: [
        "在 for-each 里调用 list.remove，运行到该行立刻抛异常。",
        "把 fail-fast 当成并发安全的保证：它只是尽力尽早暴露错误用法，不是线程安全机制。",
      ],
      method: "先判断是否需要在遍历中删除：能表达成条件就用 removeIf；否则显式取 Iterator，把删除交给 iterator.remove。",
      exercise: "把一段在 for-each 中删除元素的代码改成 removeIf，并写出原写法抛异常的原因。",
      checkpoint: "能解释修改计数与快速失败的关系，并写出两种安全的删除方式。",
      lesson: {
        overview: [
          "遍历集合的同时删除元素是新手最常踩的坑之一：循环里写下 list.remove(x)，程序立刻抛出 ConcurrentModificationException。这个异常名字里有 Concurrent，但和线程并发没有必然关系，单线程同样会抛，因为它检测的是遍历过程中集合结构被改动。理解它的检测方式，才能写出既安全又不容易出错的删除代码。",
          "集合类的做法是快速失败：与其让遍历在数据结构已经变化之后给出难以复现的怪结果，不如在发现改动的第一时间抛异常。理解它的检测方式，就能明白为什么改用迭代器自己的删除方法就没事，也更能看懂其它集合为什么也有类似限制。",
        ],
        mechanism: [
          "ArrayList 等集合内部维护一个修改计数，每次结构性修改（新增、删除元素）都会让它加一。",
          "创建迭代器时会记下当时的修改计数作为期望值；此后每次取元素之前都要比对两者，一旦不同就抛 ConcurrentModificationException。",
          "Iterator.remove 删除元素后会把这个期望值同步成最新的计数，所以后续的比对依然一致，遍历可以继续。",
          "removeIf 内部同样是用迭代器完成删除，因此既安全又省去手写循环，还避免了漏掉边界情况。",
        ],
        example: {
          title: "遍历中删除元素的错误写法与两种正确写法",
          language: "java",
          code: "List<String> names = new ArrayList<>(List.of(\"alice\", \"bob\", \"carol\"));\n\n// 反例：增强 for 底层是迭代器，这里却直接改集合\n// for (String name : names) {\n//     if (name.startsWith(\"b\")) {\n//         names.remove(name); // 抛 ConcurrentModificationException\n//     }\n// }\n\n// 正例一：显式使用迭代器，删除动作交给它\nIterator<String> it = names.iterator();\nwhile (it.hasNext()) {\n    if (it.next().startsWith(\"b\")) {\n        it.remove();\n    }\n}\n\n// 正例二：能表达成条件时，直接用 removeIf\nnames.removeIf(name -> name.startsWith(\"c\"));\n\nSystem.out.println(names); // [alice]",
          explanation:
            "反例被注释掉，是因为它一运行就抛异常，保留在注释里用于对照。正例一把删除动作交给迭代器：删除后它会同步内部的期望计数，因此不会触发快速失败。正例二用 removeIf 把条件直接交给集合，集合内部走的还是迭代器删除，代码更短也更不容易出错。如果只是读取元素、不修改结构，普通增强 for 依然是最清楚的选择。",
        },
        practiceSteps: [
          "写一个 for-each 循环删除元素，观察抛出的异常类型和消息。",
          "改成显式的 Iterator 删除，确认不再抛异常且剩余元素正确。",
          "用 removeIf 重写同一段逻辑，比较两种写法的可读性。",
        ],
        masteryChecklist: [
          "能说出 ConcurrentModificationException 在单线程下也会出现。",
          "能解释为什么迭代器自己的 remove 不会触发快速失败。",
        ],
        summary: [
          "增强 for 底层是迭代器，遍历中直接改集合会触发快速失败。",
          "检测方式是比较集合的修改计数与迭代器记下的期望值。",
          "安全删除用 Iterator.remove 或 removeIf。",
          "fail-fast 只是尽早暴露错误用法，不等于并发安全。",
        ],
        terms: [
          {
            term: "快速失败（fail-fast）",
            plain: "发现集合在遍历过程中被改动，就立刻抛异常。",
            detail:
              "目的是尽早暴露错误用法，而不是保证并发安全。它靠尽力检测，所以不能当成多线程下的保护。",
          },
          {
            term: "修改计数（modCount）",
            plain: "集合内部记录结构被改过多少次的计数器。",
            detail:
              "迭代器创建时记下它的值，之后每次取元素都比对，不一致就说明遍历期间结构被改过。只有增删这类结构性修改才算，改已有元素的值不算。",
          },
          {
            term: "迭代器（Iterator）",
            plain: "按顺序一个个取元素的游标对象。",
            detail:
              "增强 for 只是它的语法糖。它的 remove 方法在删除集合元素的同时同步修改计数，所以遍历中删除要交给它来做。",
          },
          {
            term: "removeIf",
            plain: "按条件一次性删掉集合里符合要求的元素。",
            detail:
              "Java 8 起 Collection 提供，内部用迭代器安全删除。比手写循环加删除更短，也更不容易漏掉边界情况。",
          },
        ],
      },
    },
    questions: [
      {
        key: "java-sup-java-iterator-fail-fast-s1",
        stageKey: "java-collections",
        topicKey: "java-iterator-fail-fast",
        type: "single",
        stem: "用增强 for 遍历 ArrayList 时，在循环体内直接调用 list.remove 删除当前元素，通常会出现什么结果？",
        options: [
          { key: "A", text: "正常删除，循环结束后集合变小" },
          { key: "B", text: "运行到该行抛出 ConcurrentModificationException" },
          { key: "C", text: "编译不通过，IDE 直接报错" },
          { key: "D", text: "集合被自动复制一份后再安全删除" },
        ],
        answer: ["B"],
        explanation:
          "增强 for 循环底层会编译成迭代器遍历，而直接调用集合的 remove 属于结构性修改，会改变集合的修改计数。迭代器下一次检查时发现实际计数与创建时记下的期望值不一致，就抛出 ConcurrentModificationException。它既不是编译错误，也不会自动复制集合。要安全删除，应使用 Iterator.remove 或 removeIf。",
        difficulty: "medium",
        tags: ["集合", "迭代器", "异常"],
        sourceKey: "algorithms-java",
        level: "进阶",
      },
      {
        key: "java-sup-java-iterator-fail-fast-j1",
        stageKey: "java-collections",
        topicKey: "java-iterator-fail-fast",
        type: "judge",
        stem: "ConcurrentModificationException 只在多个线程并发访问同一个集合时才会抛出。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "这个异常检测的是遍历期间集合结构被修改，与是否多线程无关。单线程下在 for-each 循环里直接删除元素同样会抛。它的名字容易让人误以为只和并发有关，实际上它是集合的快速失败检查，属于对错误用法的尽早报错，所以判断为错误。",
        difficulty: "easy",
        tags: ["集合", "快速失败"],
        sourceKey: "algorithms-java",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "java",
    stageKey: "java-collections",
    topic: {
      key: "java-comparable-comparator",
      title: "排序：Comparable 与 Comparator",
      summary:
        "Comparable 是类型自带的默认排序规则，Comparator 是从外部传入的临时规则；两者都必须满足一致性与传递性，否则排序可能抛契约异常。",
      concepts: ["Comparable", "Comparator", "自然顺序", "比较器传递性"],
      principles: [
        "Comparable 由被排序的类自己实现 compareTo，用来定义自然顺序；Comparator 由外部提供 compare，可以按不同字段随时替换。",
        "比较方法的返回值只有符号有意义：负数表示第一个参数排在前面，正数相反，0 表示在本次排序中相等。",
        "比较关系必须满足传递性：若 a 小于 b 且 b 小于 c，则必须 a 小于 c，否则排序算法可能抛出 Comparison method violates its general contract。",
      ],
      applications: [
        "实体类实现 Comparable 提供默认排序，列表页按不同字段排序时传入 Comparator。",
        "多级排序用 Comparator.comparing(...).thenComparing(...) 组合表达。",
      ],
      pitfalls: [
        "用 a - b 写整数比较，两个数相差很大时相减会溢出，符号翻转导致顺序错误。",
        "比较器里依赖随机值或不稳定字段，破坏传递性后排序抛契约异常。",
      ],
      method: "先确定默认顺序是否属于这个类型本身：属于就实现 Comparable，否则用 Comparator；整数比较大小时用 Integer.compare，不要相减。",
      exercise: "写一个按年龄升序、年龄相同时按姓名升序的 Comparator，并验证排序结果。",
      checkpoint: "能说明 Comparable 与 Comparator 的分工，并解释为什么整数比较不要写成 a - b。",
      lesson: {
        overview: [
          "排序在业务里几乎无处不在，Java 给了两种表达方式：让对象自己知道怎么比大小（Comparable），或者从外部临时给它一条比较规则（Comparator）。前者是类型自带的默认顺序，后者是可以随时替换的策略，同一个类型可以有很多套。",
          "很多人习惯用 a - b 来写整数比较，代码短，但存在溢出风险：当 a 是很大的正数、b 是很小的负数时，相减的结果超出 int 范围，符号翻转，排序结果就错了。正确写法是 Integer.compare(a, b)，它只关心大小关系，因此不会溢出。这类溢出错误只在特定数据下出现，测试时很容易被漏掉。",
        ],
        mechanism: [
          "排序方法在未传入比较器时调用元素的 compareTo，也就是自然顺序；传入了比较器则改调 compare，规则完全由外部决定。",
          "比较方法的返回值只在符号上有意义：负数表示第一个参数应排在前面，正数表示应排在后面，0 表示两者在本次排序中相等，返回 -1 还是 -100 没有区别。",
          "排序算法依赖比较关系自洽。如果比较器对不同元素给出自相矛盾的结论，例如 a 小于 b、b 小于 c 却 c 小于 a，算法的假设被破坏，就可能抛出 Comparison method violates its general contract。",
          "Comparator.comparing 把一个取键函数包装成比较器，thenComparing 在前一个键相等时继续比较下一个字段，从而把多级排序写成一条链。",
        ],
        example: {
          title: "多级排序与溢出安全的整数比较",
          language: "java",
          code: "record Person(String name, int age) {}\n\nList<Person> people = new ArrayList<>(List.of(\n    new Person(\"carol\", 30),\n    new Person(\"alice\", 25),\n    new Person(\"bob\", 25)\n));\n\n// 手工写两级比较：先比年龄，年龄相同再比姓名\npeople.sort((a, b) -> {\n    int byAge = Integer.compare(a.age(), b.age()); // 只比较大小，不做减法\n    return byAge != 0 ? byAge : a.name().compareTo(b.name());\n});\n\n// 等价的组合写法：取排序键，再声明并列时比什么\npeople.sort(Comparator.comparingInt(Person::age)\n                      .thenComparing(Person::name));\n\nSystem.out.println(people); // [alice 25, bob 25, carol 30]",
          explanation:
            "第一种写法手工处理两级比较：先比年龄，相等时再比姓名；关键在于用 Integer.compare 而不是相减，避免整数溢出把符号翻过来。第二种用 comparingInt 取出排序键，再用 thenComparing 声明并列时比什么，可读性更好。两种写法都满足传递性，所以排序结果稳定可靠；如果比较器写得自相矛盾，结果就无法预测。",
        },
        practiceSteps: [
          "给一个实体类实现 Comparable，定义它的自然顺序。",
          "写一个按两个字段排序的 Comparator，再用 thenComparing 改写它。",
          "构造两个相差很大的整数，比较相减与 Integer.compare 的结果差异。",
        ],
        masteryChecklist: [
          "能区分 Comparable 与 Comparator 各自适合的场景。",
          "能解释 compare 的返回值为什么只有符号有意义。",
          "能说出比较器破坏传递性时会出现什么后果。",
        ],
        summary: [
          "Comparable 定义类型自带的自然顺序，Comparator 是外部可替换的比较策略。",
          "compare 只要求返回值的符号正确。",
          "整数比较用 Integer.compare，避免 a - b 溢出。",
          "比较关系必须一致且传递，否则排序可能抛契约异常。",
        ],
        terms: [
          {
            term: "Comparable",
            plain: "对象自己实现的比较方法，用来定义默认排序。",
            detail:
              "实现它意味着这个类型有一个天然的大小顺序，比如数字、日期、按学号排的学生。一个类型通常只有一个自然顺序，需要别的排法时就改用 Comparator。",
          },
          {
            term: "Comparator",
            plain: "从外面传进去的临时比较规则，可以有很多套。",
            detail:
              "同一个类型可以按年龄排、按姓名排、按分数排，各写一个 Comparator 即可，不用去改类型本身。适合排序方式经常变化的场景。",
          },
          {
            term: "传递性（Transitivity）",
            plain: "a 比 b 小、b 比 c 小，那么 a 一定比 c 小。",
            detail:
              "排序算法默认比较关系满足这条规律。如果比较器自相矛盾，算法可能检测出来并抛出 Comparison method violates its general contract，而不是给出一个错误但看似正常的顺序。",
          },
          {
            term: "thenComparing",
            plain: "前一个排序字段相等时，改用下一个字段继续比。",
            detail:
              "用于多级排序，比如先按部门再按工号。它要跟在 comparing 之后使用；单独用没有意义，因为它需要前一个比较器的结果来判断是否并列。",
          },
        ],
      },
    },
    questions: [
      {
        key: "java-sup-java-comparable-comparator-s1",
        stageKey: "java-collections",
        topicKey: "java-comparable-comparator",
        type: "single",
        stem: "在 Java 中写整数比较逻辑时，通常不建议用 a - b，主要原因是什么？",
        options: [
          { key: "A", text: "a - b 的写法语法不合法" },
          { key: "B", text: "a 与 b 相差很大时相减会溢出，符号翻转导致顺序错误" },
          { key: "C", text: "只有基本类型之间才能用 a - b" },
          { key: "D", text: "a - b 会修改原集合的元素顺序" },
        ],
        answer: ["B"],
        explanation:
          "int 相减的结果必须落在 int 范围内，符号才与真实大小关系一致。当 a 是很大的正数、b 是很小的负数时相减会溢出，结果的符号翻转，排序就会排错，而且错误只在特定数据下出现，很难排查。正确写法是 Integer.compare(a, b)，它直接比较大小得出符号，不存在溢出问题。",
        difficulty: "medium",
        tags: ["排序", "Comparator", "溢出"],
        sourceKey: "algorithms-java",
        level: "进阶",
      },
      {
        key: "java-sup-java-comparable-comparator-j1",
        stageKey: "java-collections",
        topicKey: "java-comparable-comparator",
        type: "judge",
        stem: "比较器返回 0 表示两个元素相等；返回 -1 和返回 -100 对排序结果没有区别。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "排序算法只关心比较返回值的符号：负数表示第一个参数排在前面，正数表示排在后面，0 表示本次排序中视为并列。所以返回 -1 还是 -100 不会改变顺序。但符号必须自洽并满足传递性，否则比较器自相矛盾时算法会因假设被破坏而抛出契约异常。",
        difficulty: "medium",
        tags: ["Comparator", "排序"],
        sourceKey: "algorithms-java",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "java",
    stageKey: "java-concurrency",
    topic: {
      key: "java-deadlock-prevention",
      title: "死锁的成因与预防",
      summary:
        "死锁需要互斥、持有并等待、不可剥夺、循环等待四个条件同时成立；打破其中任意一个就能避免，最常用的做法是统一加锁顺序。",
      concepts: ["死锁四个必要条件", "循环等待", "加锁顺序", "超时尝试加锁"],
      principles: [
        "死锁的四个必要条件是互斥、持有并等待、不可剥夺、循环等待，四个同时满足才可能死锁。",
        "只要所有线程都按同一个全局顺序获取多把锁，循环等待就无法形成。",
        "带超时的 tryLock 拿不到锁就放弃并释放已持有的锁，可以避免无限等待。",
      ],
      applications: [
        "转账等多锁场景约定按账户 ID 从小到大加锁。",
        "无法约定顺序的外部调用，用带超时的 tryLock 并在失败时回退重试。",
      ],
      pitfalls: [
        "两个方法以相反顺序获取同一对锁，高并发下偶发卡死。",
        "死锁线程一直占着锁，表现为接口超时但 CPU 不高，只看监控很难定位。",
      ],
      method: "先找出同一时刻需要多把锁的代码，统一加锁顺序；无法统一时用带超时的 tryLock，失败后释放已持有的锁再重试。",
      exercise: "写出一个能稳定复现两把锁互等的程序，再用统一加锁顺序修复它。",
      checkpoint: "能写出死锁的四个必要条件，并说明如何用加锁顺序打破循环等待。",
      lesson: {
        overview: [
          "死锁是多个线程互相等待对方持有的锁，谁都走不下去。它的麻烦之处在于平时不出现，只在特定时序下偶发，上线后往往表现为某个接口卡住或请求超时，而且重启之后问题可能暂时消失，很难复现。",
          "死锁不是随机事件，它需要四个条件同时成立：资源互斥、持有并等待、不可剥夺、循环等待。反过来说，只要在设计上打破任意一个条件，死锁就不可能发生。这比等到线上卡死再靠线程转储去排查要省力得多。",
        ],
        mechanism: [
          "互斥：锁在同一时刻只能被一个线程持有，这是锁的定义，通常无法打破。",
          "持有并等待：线程拿着一把锁去申请另一把。打破方式是要求一次性申请全部资源，或者申请新锁之前先释放已持有的锁。",
          "不可剥夺：锁不能被强行抢走。打破方式是使用可中断或带超时的尝试加锁，超时后主动放弃并释放已持有的锁。",
          "循环等待：线程 A 等 B 手里的锁，B 又在等 A 手里的锁。最常用的做法是给所有锁规定一个全局顺序，所有线程都按同样的顺序获取，等待关系就形成不了环。",
        ],
        example: {
          title: "统一加锁顺序消除循环等待",
          language: "java",
          code: "// 约定：永远先锁 accountId 小的那个账户\nvoid transfer(Account from, Account to, long amount) {\n    Account first  = from.id() < to.id() ? from : to;\n    Account second = from.id() < to.id() ? to   : from;\n\n    synchronized (first) {\n        synchronized (second) {\n            from.withdraw(amount);\n            to.deposit(amount);\n        }\n    }\n}",
          explanation:
            "转账需要同时锁住两个账户。如果线程 A 按 from 到 to 的顺序加锁，线程 B 反向操作，就可能形成循环等待。这里先把两个账户按 id 排序，保证任意方向的转账都按同一个先后顺序加锁，环就不可能形成。代价几乎为零，只是多了一次比较；这也是多锁场景最值得首先采用的方案。",
        },
        practiceSteps: [
          "写两个线程，分别以相反顺序获取两把锁，复现死锁。",
          "用线程转储工具导出快照，找到 JVM 报告的互相等待的线程和锁。",
          "改成统一的加锁顺序，确认程序能正常结束且结果正确。",
        ],
        masteryChecklist: [
          "能背出死锁的四个必要条件。",
          "能解释为什么统一加锁顺序可以打破循环等待。",
          "知道排查卡死问题要看线程转储，而不是只看 CPU 使用率。",
        ],
        summary: [
          "死锁需要互斥、持有并等待、不可剥夺、循环等待四个条件同时成立。",
          "打破任意一个条件就能避免死锁，最常用的是统一加锁顺序。",
          "无法约定顺序时用带超时的尝试加锁，失败就释放并回退。",
          "死锁表现为卡住而不是 CPU 飙升，靠线程转储定位。",
        ],
        terms: [
          {
            term: "死锁（Deadlock）",
            plain: "两个线程各拿一把锁，又都在等对方那把，谁也走不了。",
            detail:
              "线程会一直阻塞，所以 CPU 反而不高，监控上容易误判成慢查询。排查方法是打印线程转储，看是否存在一组互相等待的线程。",
          },
          {
            term: "循环等待（Circular Wait）",
            plain: "A 等 B 手里的锁，B 又在等 A 手里的锁。",
            detail:
              "四个必要条件里最容易打破的一个。只要所有线程按同一个全局顺序获取锁，等待关系就形成不了环，死锁也就无从发生。",
          },
          {
            term: "尝试加锁（tryLock）",
            plain: "试着加锁，拿不到就立刻或超时后返回失败，不傻等。",
            detail:
              "ReentrantLock 提供，可以带超时。关键是要在失败时释放已经持有的锁并回退，否则只是把无限等待变成了部分等待，仍可能形成死锁。",
          },
          {
            term: "线程转储（Thread Dump）",
            plain: "把 JVM 里每个线程此刻正在做什么打印出来的快照。",
            detail:
              "用 jstack 或 jcmd 生成。JVM 能识别互相等待的锁并直接报告 deadlock，是定位卡死问题的第一手证据，比猜测更有说服力。",
          },
        ],
      },
    },
    questions: [
      {
        key: "java-sup-java-deadlock-prevention-s1",
        stageKey: "java-concurrency",
        topicKey: "java-deadlock-prevention",
        type: "single",
        stem: "在两个账户之间转账、需要同时持有两把账户锁的场景，下面哪种做法最能避免死锁？",
        options: [
          { key: "A", text: "两个方法分别按相反顺序加锁，谁先拿到算谁的" },
          { key: "B", text: "所有转账都按账户 ID 从小到大加锁，保证全局一致的加锁顺序" },
          { key: "C", text: "把 synchronized 换成普通方法调用，不再加锁" },
          { key: "D", text: "增加线程数量，让先拿到锁的线程更快执行完" },
        ],
        answer: ["B"],
        explanation:
          "死锁的循环等待条件只有在不同线程以不同顺序获取同一组锁时才可能形成。让所有线程按账户 ID 从小到大加锁，等待关系就形成不了环，任意方向的转账都不会互相等待。增加线程数只会提高死锁出现的概率；去掉锁则破坏了数据安全，可能出现金额对不上，所以都不是正确做法。",
        difficulty: "hard",
        tags: ["死锁", "锁顺序", "并发"],
        sourceKey: "advanced-java-reference",
        level: "综合",
      },
      {
        key: "java-sup-java-deadlock-prevention-j1",
        stageKey: "java-concurrency",
        topicKey: "java-deadlock-prevention",
        type: "judge",
        stem: "只要程序里使用了 synchronized，就一定会发生死锁。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "死锁需要互斥、持有并等待、不可剥夺、循环等待四个条件同时成立，缺一不可。大量程序正确使用 synchronized 并不会死锁，只有加锁顺序不一致、同时持有锁又继续申请等条件凑齐时才可能发生。所以使用了同步就一定死锁的说法是错误的。",
        difficulty: "easy",
        tags: ["死锁", "synchronized"],
        sourceKey: "advanced-java-reference",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "java",
    stageKey: "java-concurrency",
    topic: {
      key: "java-threadpool-parameters",
      title: "线程池参数与任务排队",
      summary:
        "线程池先用到核心线程，再入队，队列满才扩到最大线程；所以使用无界队列时 maximumPoolSize 永远不会生效。",
      concepts: ["corePoolSize", "maximumPoolSize", "工作队列", "拒绝策略"],
      principles: [
        "提交任务时，线程数未达核心线程数就新建线程；达到后先入队，只有队列满才创建非核心线程直到最大线程数。",
        "使用无界队列时队列永远不会满，maximumPoolSize 与拒绝策略因此都形同虚设。",
        "队列满且线程数已达上限时，由拒绝策略处理新任务，默认行为是直接抛 RejectedExecutionException。",
      ],
      applications: [
        "CPU 密集型任务把线程数与核数保持相当，队列容量给适度缓冲。",
        "等待型任务可适当增大线程数，但队列必须设容量并显式选一个拒绝策略。",
      ],
      pitfalls: [
        "以为设了 maximumPoolSize 就一定会扩容，实际却配了无界队列。",
        "用工厂方法创建固定线程池，默认队列无界，任务堆积时可能耗尽内存。",
      ],
      method: "先判断任务是计算密集还是等待型，再定核心线程数，给队列设明确容量，最后选一个可观测的拒绝策略。",
      exercise: "用 ThreadPoolExecutor 构造线程池，设置有限队列和拒绝策略，提交超过容量的任务并观察拒绝行为。",
      checkpoint: "能按顺序说出提交任务后线程池的处理流程，并解释无界队列带来的后果。",
      lesson: {
        overview: [
          "线程池的核心价值不只是省下创建线程的开销，更重要的是把并发量控制在可预期范围内。控制手段就是几个参数：核心线程数、最大线程数、队列容量和拒绝策略，它们共同决定任务什么时候等待、什么时候被拒绝。",
          "很多人以为线程数会一路涨到最大线程数再开始排队，事实正好相反：达到核心线程数之后任务先进队列，只有队列满了才继续创建线程。这个顺序决定了参数该怎么配，也解释了为什么配了最大线程数却从来没有生效。",
        ],
        mechanism: [
          "提交任务时的第一个判断是：当前线程数小于核心线程数，就直接新建核心线程来执行。",
          "否则把任务放进工作队列，入队成功后等待空闲线程来取，此时并不会新建任何线程。",
          "只有队列已满且线程数仍小于最大线程数时，才创建非核心线程；两者都到上限就交给拒绝策略。",
          "因此无界队列会让队列永远不满，最大线程数和拒绝策略都不会触发，任务会无限堆积直到内存耗尽。",
        ],
        example: {
          title: "有界队列加明确拒绝策略的线程池",
          language: "java",
          code: "ThreadPoolExecutor pool = new ThreadPoolExecutor(\n    4,                                        // corePoolSize：常驻线程数\n    8,                                        // maximumPoolSize：队列满后才用到\n    60L, TimeUnit.SECONDS,                    // 非核心线程空闲回收时间\n    new ArrayBlockingQueue<>(100),            // 有界队列，满了才会继续扩容\n    new ThreadPoolExecutor.CallerRunsPolicy() // 再满就拒绝，由提交线程自己执行\n);\n\npool.execute(() -> System.out.println(\"task-\" + Thread.currentThread().getName()));\npool.shutdown();",
          explanation:
            "队列用的是有容量的 ArrayBlockingQueue，因此当 100 个任务在排队、线程也已经扩到 8 个之后，再提交就会触发拒绝策略。这里选的 CallerRunsPolicy 让提交任务的线程自己执行，从而自然放慢提交速度，而不是悄悄丢弃任务。如果换成无界队列，最大线程数永远用不满，拒绝策略也永远不会执行。",
        },
        practiceSteps: [
          "用 ThreadPoolExecutor 显式构造线程池，不用默认的工厂方法。",
          "把队列容量改小，提交超过容量的任务，观察拒绝策略被触发。",
          "把队列换成无界队列再跑一次，对比最大线程数是否真正生效。",
        ],
        masteryChecklist: [
          "能按顺序复述任务提交后的处理流程。",
          "能解释无界队列为什么让最大线程数失效。",
          "能针对自己的任务类型选出一个合适的拒绝策略。",
        ],
        summary: [
          "线程池的扩缩顺序是：核心线程、入队、扩到最大线程、拒绝。",
          "无界队列会让最大线程数与拒绝策略永不生效。",
          "队列必须设容量，拒绝策略必须显式选择。",
          "生产环境建议直接用 ThreadPoolExecutor 构造，让参数可见可控。",
        ],
        terms: [
          {
            term: "核心线程数（corePoolSize）",
            plain: "线程池常备的线程数量，任务来了先由它们做。",
            detail:
              "达到这个数量后，新任务不会立刻新建线程，而是先进队列。核心线程默认即使空闲也会保留，除非显式允许它们超时回收。",
          },
          {
            term: "最大线程数（maximumPoolSize）",
            plain: "队列排满之后，最多还能临时加多少线程。",
            detail:
              "它只有在队列满时才起作用。如果队列是无界的，这个参数永远不会生效，配置它就成了摆设。",
          },
          {
            term: "工作队列（Work Queue）",
            plain: "线程都忙时，新任务在这里排队等着。",
            detail:
              "队列容量决定缓冲能力。无界队列把压力变成内存占用，最终可能耗尽内存；有界队列把压力交给拒绝策略，行为更可预期。",
          },
          {
            term: "拒绝策略（RejectedExecutionHandler）",
            plain: "线程忙、队列也满时，新任务该怎么处理。",
            detail:
              "JDK 提供四种：直接抛异常、直接丢弃、丢弃最老的、由提交线程自己执行。默认是抛 RejectedExecutionException。选哪种取决于业务能否丢任务。",
          },
        ],
      },
    },
    questions: [
      {
        key: "java-sup-java-threadpool-parameters-s1",
        stageKey: "java-concurrency",
        topicKey: "java-threadpool-parameters",
        type: "single",
        stem: "使用 ThreadPoolExecutor 时，提交一个任务后的处理顺序，下面哪一项是正确的？",
        options: [
          { key: "A", text: "先入队，队列满后再新建线程，直到 maximumPoolSize" },
          { key: "B", text: "线程数未达 corePoolSize 就新建线程，达到后先入队，队列满才继续创建线程直到 maximumPoolSize" },
          { key: "C", text: "直接创建线程直到 maximumPoolSize，再开始排队" },
          { key: "D", text: "总是先入队，队列满就立刻拒绝" },
        ],
        answer: ["B"],
        explanation:
          "ThreadPoolExecutor 的判断顺序是：线程数小于核心线程数时直接新建核心线程；否则把任务放进工作队列；只有当队列已满且线程数小于最大线程数时，才创建非核心线程；两者都到上限才交给拒绝策略。所以真正的顺序是先核心线程、再排队、再扩容、最后拒绝，其余选项描述都不对。",
        difficulty: "medium",
        tags: ["线程池", "并发", "队列"],
        sourceKey: "advanced-java-reference",
        level: "进阶",
      },
      {
        key: "java-sup-java-threadpool-parameters-j1",
        stageKey: "java-concurrency",
        topicKey: "java-threadpool-parameters",
        type: "judge",
        stem: "把线程池的工作队列设成无界队列后，maximumPoolSize 这个参数就不会再起作用。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "无界队列永远不会满，而最大线程数只有在队列已满时才会被用到，因此线程数会一直停留在核心线程数，maximumPoolSize 形同虚设，拒绝策略也永远不会被触发。代价是任务会无限堆积在队列里，内存压力持续上升，最终可能抛出内存溢出错误，所以生产环境应使用有界队列。",
        difficulty: "medium",
        tags: ["线程池", "无界队列"],
        sourceKey: "advanced-java-reference",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "java",
    stageKey: "java-engineering",
    topic: {
      key: "java-maven-dependency-scope",
      title: "Maven 依赖作用域与冲突调解",
      summary:
        "scope 决定依赖在编译、测试、运行时是否可见、要不要打包；同一依赖出现多个版本时，Maven 按路径最短优先、同深度先声明优先来选，不是选最新版。",
      concepts: ["依赖作用域 scope", "传递依赖", "依赖调解", "依赖排除"],
      principles: [
        "scope 控制依赖何时进入类路径：compile 全程可用，provided 由容器在运行时提供，runtime 编译时不需要，test 只在测试阶段可见。",
        "传递依赖会沿依赖树向下传播，但 test 与 provided 不会传递，也不会进入发布包。",
        "同一依赖出现多个版本时，Maven 按路径最短优先调解；路径长度相同时先声明的优先，因此它不会自动选择最高版本。",
      ],
      applications: [
        "JUnit 等只在测试中使用的依赖用 test scope，避免被打进发布包。",
        "Servlet API 等由运行容器提供的依赖用 provided scope。",
      ],
      pitfalls: [
        "遇到依赖冲突就随手排除，可能连其它必要的传递依赖一起切断。",
        "以为 Maven 会挑版本号最高的那个，结果运行时实际加载的是依赖树里更靠近项目的旧版本。",
      ],
      method: "先用依赖树命令看清依赖从哪来，再决定用 scope、排除项还是统一版本声明来处理。",
      exercise: "用 mvn dependency:tree 找出一个重复依赖的来源，用统一版本声明或排除项固定版本。",
      checkpoint: "能说明四个常用 scope 的区别，并解释最近优先的版本调解规则。",
      lesson: {
        overview: [
          "Maven 把依赖坐标、作用域和传递关系记录在一张依赖树里。scope 决定这个依赖在编译、测试、运行三个阶段的可见性。写错 scope 最常见的后果是：只在测试需要的库被打进了发布包，或者编译时一切正常、运行时却找不到类。",
          "当同一个依赖被间接引入多次、版本还不一致时，Maven 会做依赖调解挑出一个版本。它的规则不是取最新，而是取依赖树上离当前项目最近的那个，这一点经常和直觉相反，也是为什么必须查看依赖树而不是凭感觉改版本。",
        ],
        mechanism: [
          "compile 是默认作用域，编译、测试、运行都可用，并且会传递给依赖本项目的模块。",
          "provided 表示编译时需要、运行时由外部容器提供，例如 Servlet API；它不会被打进包，也不会向下传递。test 只在测试编译和测试运行时可用，同样不传递。",
          "runtime 表示编译时不需要、运行时才需要，典型例子是 JDBC 驱动：代码里只用到接口，运行时才需要具体实现。",
          "版本调解遵循两条规则：在依赖树上路径最短的版本优先；路径长度相同时，在 pom 中先声明的优先。统一版本声明只约束版本和范围，本身不引入依赖，常放在父模块里统一管理。",
        ],
        example: {
          title: "作用域声明与传递依赖排除",
          language: "xml",
          code: "<dependencies>\n  <!-- Servlet API 由容器提供：编译时要能引用，但不打进发布包 -->\n  <dependency>\n    <groupId>jakarta.servlet</groupId>\n    <artifactId>jakarta.servlet-api</artifactId>\n    <version>6.0.0</version>\n    <scope>provided</scope>\n  </dependency>\n\n  <!-- 只在测试阶段使用，不会进入发布包 -->\n  <dependency>\n    <groupId>org.junit.jupiter</groupId>\n    <artifactId>junit-jupiter</artifactId>\n    <version>5.10.2</version>\n    <scope>test</scope>\n  </dependency>\n\n  <!-- 切断某条传递依赖，避免版本被间接拉低 -->\n  <dependency>\n    <groupId>com.example</groupId>\n    <artifactId>shared-lib</artifactId>\n    <version>2.1.0</version>\n    <exclusions>\n      <exclusion>\n        <groupId>com.google.guava</groupId>\n        <artifactId>guava</artifactId>\n      </exclusion>\n    </exclusions>\n  </dependency>\n</dependencies>",
          explanation:
            "provided 告诉 Maven：编译时需要这个 API，但运行时由 Servlet 容器提供，因此不要打进发布包，也不要传递给下游。test 让 JUnit 只在测试阶段可见，避免污染生产依赖。排除项则是在某条传递依赖版本不合适时，切断它被间接引入的路径。三者的共同点是先明确这个依赖在哪个阶段需要，而不是看到报错就随手排除。",
        },
        practiceSteps: [
          "运行依赖树命令，找出同名依赖出现的多个版本。",
          "给只在测试中使用的依赖补上 test 作用域，确认发布包里不再包含它。",
          "对版本冲突用排除项或统一版本声明固定版本，然后重新构建验证。",
        ],
        masteryChecklist: [
          "能说出 compile、provided、runtime、test 四个作用域的区别。",
          "能解释为什么 Maven 不总是选择最高版本。",
          "知道用依赖树命令而不是猜测来确定冲突来源。",
        ],
        summary: [
          "scope 决定依赖在编译、测试、运行时是否可见，以及是否传递。",
          "provided 与 test 不会传递，也不会进入发布包。",
          "版本调解是最近优先，同深度先声明优先，不是取最新。",
          "排查依赖问题先看依赖树，再决定用作用域、排除项还是统一版本声明。",
        ],
        terms: [
          {
            term: "依赖作用域（Scope）",
            plain: "这套依赖在哪个阶段能用，要不要打进包里。",
            detail:
              "常见取值 compile、provided、runtime、test。其中 provided 与 test 不会向下传递，也不进入发布包，所以适合容器提供的 API 和测试库。",
          },
          {
            term: "传递依赖（Transitive Dependency）",
            plain: "你依赖的库，它自己也依赖的那些库。",
            detail:
              "Maven 会自动把它们加进类路径，方便也有风险：版本可能和你的期望不一致，冲突往往就来自这里，需要看依赖树才能看清来源。",
          },
          {
            term: "依赖调解（Dependency Mediation）",
            plain: "同一个库出现多个版本时，Maven 挑选其中一个的规则。",
            detail:
              "规则是路径最短优先，长度相同则先声明优先，不是选最新版本。所以必须用依赖树确认最终生效的到底是哪一个版本。",
          },
          {
            term: "统一版本声明（dependencyManagement）",
            plain: "只写版本号、不真正引入依赖的版本声明区。",
            detail:
              "常放在父模块里，子模块引用依赖时不写版本，从而让全项目版本一致。它本身不会替你添加依赖，只负责定版本和范围。",
          },
          {
            term: "provided",
            plain: "编译时要用，但运行时由服务器等外部环境提供。",
            detail:
              "典型例子是 Servlet API：把它打进应用反而可能和容器自带的版本冲突。它也不会传递给依赖本项目的模块。",
          },
        ],
      },
    },
    questions: [
      {
        key: "java-sup-java-maven-dependency-scope-s1",
        stageKey: "java-engineering",
        topicKey: "java-maven-dependency-scope",
        type: "single",
        stem: "关于 Maven 的依赖调解规则，下面哪一项是正确的？",
        options: [
          { key: "A", text: "自动选择版本号最高的那个依赖" },
          { key: "B", text: "路径最短优先；路径长度相同时，在 pom 中先声明的优先" },
          { key: "C", text: "总是选择在 pom 中最后声明的那个版本" },
          { key: "D", text: "只要出现版本冲突，构建就一定失败" },
        ],
        answer: ["B"],
        explanation:
          "Maven 的依赖调解遵循最近优先：依赖树中离当前项目路径最短的版本胜出；如果两个版本路径长度相同，就比较在 pom 中的声明顺序，先声明的优先。它不会自动选择最高版本，版本冲突通常也不会让构建失败，而是静默选中一个版本，因此必须查看依赖树才能确认实际结果。",
        difficulty: "hard",
        tags: ["Maven", "依赖", "版本冲突"],
        sourceKey: "tech-interview-handbook",
        level: "综合",
      },
      {
        key: "java-sup-java-maven-dependency-scope-j1",
        stageKey: "java-engineering",
        topicKey: "java-maven-dependency-scope",
        type: "judge",
        stem: "把只在测试中使用的依赖声明为 test 作用域，它就不会被打进发布包，也不会传递给依赖本项目的模块。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "test 作用域限定该依赖只在测试编译与测试运行阶段可用，因此不会进入最终的发布包；同时 Maven 规定 test 依赖不具备传递性，依赖本项目的模块不会因为它而间接获得这个库。这正是把 JUnit 一类依赖标记为 test 的意义，可以保持发布产物干净。",
        difficulty: "easy",
        tags: ["Maven", "scope", "测试"],
        sourceKey: "tech-interview-handbook",
        level: "入门",
      },
    ],
  },
];
