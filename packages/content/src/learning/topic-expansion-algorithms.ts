/**
 * 算法与数据结构 · 知识点扩容（追加式）。
 *
 * 沿用 topic-expansion-backend-engineering.ts 的样板：一条 expansion = 1 个新知识点 + 2 道配套题。
 * 选题只覆盖既有 12 个知识点与 DS 十章都没展开的部分：随机化、LRU、布隆过滤器、Trie、外部排序、位运算。
 */
import type { TopicExpansion } from "./topic-expansions";

export const algorithmsTopicExpansions: TopicExpansion[] = [
  {
    trackSlug: "algorithms",
    stageKey: "algo-complexity",
    topic: {
      key: "algo-randomized-expected",
      title: "随机化算法与期望复杂度",
      summary:
        "随机化不消除最坏情况，只把它的发生概率压到可接受：随机快排期望 O(n log n)、Fisher-Yates 让 n! 种排列等概率、蓄水池抽样一遍扫描得到均匀样本。",
      concepts: ["期望复杂度", "随机化快速排序", "Fisher-Yates 洗牌", "蓄水池抽样"],
      principles: [
        "随机化的价值在于让坏的输入不再由对手决定：随机选枢轴后，任何固定输入退化为 O(n^2) 的概率都可以做到极低。",
        "期望复杂度是对随机选择取平均的结果，不是最坏保证；写文档时必须同时给出期望与最坏两个数字。",
        "Fisher-Yates 从末尾往前，第 i 步只在 [0, i] 里等概率挑一个位置交换，才能让 n! 种排列等概率出现。",
        "蓄水池抽样只保留 k 个样本：读到第 i 个元素时以 k/i 的概率决定是否替换，一遍扫描即可得到均匀样本。",
      ],
      applications: ["线上日志与埋点的随机抽样排查", "推荐与 A/B 实验的用户分流", "随机化快排、随机哈希种子以防对抗性输入"],
      pitfalls: [
        "把期望 O(n log n) 当成最坏保证写进 SLA，真遇到退化时毫无准备。",
        "洗牌写成每一步都与 [0, n-1] 全区间随机交换，方案数 n^n 不能整除 n!，分布有偏。",
        "用固定种子或时间戳当随机源，抽样结果可预测，抽奖与分流场景会出事故。",
      ],
      method:
        "先用期望而不是最坏来描述随机算法，再检查随机源是否均匀、是否独立；抽样类算法必须用小规模穷举验证分布，而不是只看一次结果。",
      exercise:
        "实现 Fisher-Yates 洗牌并对 n=3 跑 10 万次，统计 6 种排列的频次；再实现蓄水池抽样，验证每个元素被选中的概率都是 k/n。",
      checkpoint:
        "能说清随机化快排的最坏与期望分别是多少，并解释洗牌为什么必须从后往前、上界为什么是 i。",
      lesson: {
        overview: [
          "随机化算法把随机数当成一种资源：它不改变要解决的问题，只改变遇到坏输入的概率。快速排序固定取首元素时，对手只要构造一个有序数组就能让它退化成 O(n^2)；把枢轴改成随机选取后，同一个数组退化的概率只剩极低的一点。这类思路的价值在于把最坏情况由输入决定变成由掷骰子决定，让性能不再被数据分布牵着走。",
          "期望复杂度说的是对随机选择取平均之后的代价。它回答的是多跑几次平均有多快，而不是每一次都不超过多少。所以要同时给出两个数字：期望 O(n log n)、最坏 O(n^2)。做容量规划时按最坏估，看日常体验时看期望，这两件事不能混为一谈。另一个常见混淆是把期望当成输入平均：期望是对算法内部的随机数取的，输入仍然可以是任意构造的。",
          "抽样是随机化最常见的落地场景。日志几百万行、内存只够放几千条，你需要一份均匀样本而不是前一千行。蓄水池抽样解决的就是这个问题：一遍扫描、O(k) 空间，读到第 i 条时以 k/i 的概率替换，最后每个元素被留下的概率都恰好是 k/n。注意它对数据流只读一遍，且不需要预先知道总量，因此特别适合日志、事件流这类边产生边处理的数据。",
        ],
        mechanism: [
          "随机化快排每轮在当前区间里均匀随机挑一个下标做枢轴，与首元素交换后再分区。对任意固定输入，递归深度超过 c·log n 的概率随 n 增大迅速变小，因此期望比较次数是 O(n log n)；但最坏情况依然存在，只是概率极低。",
          "Fisher-Yates 的正确性靠不变量：处理到下标 i 时，i 之后的位置已经是最终结果且每种后缀排列等概率。第 i 步在 [0, i] 里等概率选 j 并交换 a[i] 与 a[j]，共 i+1 种选择，连乘得到 n! 种等概率结果。若每步都在 [0, n-1] 全区间里选，方案数变成 n^n，不能整除 n!，分布必然有偏。",
          "蓄水池抽样先把前 k 个元素放进池子；第 i 个（i > k）以 k/i 的概率入选，入选后随机替换池中一个。归纳可证每个元素最终留在池中的概率都是 k/n。关键是概率 k/i 必须随 i 变化；若把它写成固定比例，越靠后的元素被选中的概率越偏离 k/n，样本会系统性偏向早期数据。",
        ],
        example: {
          title: "Python 里的 Fisher-Yates 与蓄水池抽样",
          language: "python",
          code: "import random\n\n\ndef shuffle(items):\n    # 从末尾往前：第 i 步只在 [0, i] 里挑，才能保证 n! 种排列等概率\n    for i in range(len(items) - 1, 0, -1):\n        j = random.randrange(i + 1)   # 闭区间 [0, i]\n        items[i], items[j] = items[j], items[i]\n    return items\n\n\ndef reservoir_sample(stream, k):\n    pool = []\n    for i, item in enumerate(stream, start=1):\n        if i <= k:\n            pool.append(item)\n        elif random.randrange(i) < k:     # 恰好以 k / i 的概率成立\n            pool[random.randrange(k)] = item\n    return pool",
          explanation:
            "洗牌循环用的是 randrange(i + 1)，上界随 i 收缩，第 i 步恰好有 i+1 种等可能选择，连乘即 n!。蓄水池抽样里 randrange(i) < k 正好以 k/i 的概率成立，成立后再随机替换池中一个位置。两段代码都不额外申请与 n 同规模的数组，空间分别是 O(1) 与 O(k)。",
        },
        practiceSteps: [
          "把项目里所有随机抽样点列出来，检查概率是否随样本序号变化，而不是写死一个比例。",
          "用小规模穷举验证随机算法：n=3 跑十万次统计 6 种排列频次，偏差超过 1% 就说明写错了。",
          "给随机化算法补上最坏情况的说明，并把抽奖、令牌一类场景的随机源换成密码学安全的实现。",
        ],
        masteryChecklist: [
          "能写出 Fisher-Yates 并解释为什么上界必须是 i 而不是 n-1。",
          "能推导蓄水池抽样的 k/i 概率，并说明它为什么均匀。",
          "能区分期望复杂度与最坏复杂度，并在文档里同时写出两者。",
        ],
        summary: [
          "随机化不消除最坏情况，只把它的发生概率压到可接受。",
          "期望 O(n log n) 必须与最坏 O(n^2) 一起说。",
          "Fisher-Yates：从后往前、第 i 步在 [0, i] 中选，才能做到 n! 等概率。",
          "蓄水池抽样：第 i 个元素以 k/i 概率入选，一遍扫描得到均匀样本。",
        ],
        terms: [
          {
            term: "Randomized Algorithm",
            plain: "算法内部自己掷骰子，用随机选择决定下一步。",
            detail:
              "它不改变正确性，只改变代价的分布。常见形式有两种：拉斯维加斯型总是给正确答案、运行时间随机（如随机快排）；蒙特卡洛型运行时间固定、答案有极小概率错（如某些素数判定）。",
          },
          {
            term: "Expected Complexity",
            plain: "把随机选择平均掉之后的复杂度。",
            detail:
              "它是对随机数取期望的结果，不是对输入取平均。说期望 O(n log n) 时，最坏仍可能是 O(n^2)。排期与容量按最坏算，体验按期望算。",
          },
          {
            term: "Fisher-Yates Shuffle",
            plain: "从后往前逐个换位置的洗牌法，结果等概率。",
            detail:
              "每一步在剩余未定区间里随机挑一个换到当前末尾，n! 种排列等概率。常见错误是每一步都与整个数组的随机位置交换，这会让分布有偏。",
          },
          {
            term: "Reservoir Sampling",
            plain: "流式数据里随机留 k 个，每个被留概率相同。",
            detail:
              "适用于不知道总量、只能读一遍的数据流。第 i 个元素以 k/i 概率入选并随机替换池中一个，空间只要 O(k)。把概率写死成 k/n 就退化成偏向早期元素。",
          },
        ],
      },
    },
    questions: [
      {
        key: "algorithms-exp-algo-randomized-expected-s1",
        stageKey: "algo-complexity",
        topicKey: "algo-randomized-expected",
        type: "single",
        stem: "用 Fisher-Yates 洗牌时，从末尾往前处理到下标 i，应当与哪个范围内的随机位置交换？",
        options: [
          { key: "A", text: "固定在 [0, n-1] 整个区间里挑" },
          { key: "B", text: "在闭区间 [0, i] 里等概率挑" },
          { key: "C", text: "在区间 [i, n-1] 里挑" },
          { key: "D", text: "只与 i-1 交换" },
        ],
        answer: ["B"],
        explanation:
          "要让 n! 种排列等概率，第 i 步必须恰好有 i+1 种等可能选择，所以随机下标取自闭区间 [0, i]；各步选择数连乘为 n·(n-1)·...·1 即 n!。若每步都在 [0, n-1] 里挑，总方案数是 n^n，不能整除 n!，某些排列出现得更频繁，分布就有偏。",
        difficulty: "medium",
        tags: ["随机化", "洗牌", "概率"],
        sourceKey: "algorithms-python",
        level: "进阶",
      },
      {
        key: "algorithms-exp-algo-randomized-expected-j1",
        stageKey: "algo-complexity",
        topicKey: "algo-randomized-expected",
        type: "judge",
        stem: "随机化快速排序随机选取枢轴后，最坏情况 O(n^2) 就消失了，任何输入都能保证 O(n log n)。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "随机选枢轴只是把遇到坏划分的概率降到极低，最坏情况依然存在：极端情况下仍可能每次都抽到最大或最小元素做枢轴，退化为 O(n^2)。准确说法是期望 O(n log n)、最坏 O(n^2)，随机化改变的是概率分布而不是最坏上界。",
        difficulty: "easy",
        tags: ["随机化", "快速排序", "复杂度"],
        sourceKey: "algorithms-python",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "algorithms",
    stageKey: "algo-linear",
    topic: {
      key: "algo-lru-cache",
      title: "LRU 缓存：哈希表 + 双向链表",
      summary:
        "让 get 与 put 都是 O(1) 的关键不是用了哈希，而是分工：哈希负责键到节点的定位，双向链表负责最近使用顺序，命中移到表头、满了拆表尾。",
      concepts: ["哈希索引", "双向链表", "淘汰顺序", "哨兵节点"],
      principles: [
        "哈希表只解决键在哪里，链表只解决谁最久没用；两者配合才能让 get 与 put 同时 O(1)。",
        "被访问的节点必须立即移到表头，否则淘汰顺序退化成插入顺序，LRU 变成 FIFO。",
        "淘汰尾节点要能在 O(1) 内摘下它，所以链表必须双向，并用头尾哨兵消除空表特判。",
        "更新已有键时只改值并移到表头，不能再插入新节点，否则容量计数与链表都会错。",
      ],
      applications: ["接口与页面结果缓存", "数据库 buffer pool 的近似 LRU 淘汰", "浏览器与 CDN 的对象缓存"],
      pitfalls: [
        "命中后忘记移动节点，缓存实际退化成 FIFO，热点键照样被淘汰。",
        "用单链表或数组删尾，单次淘汰从 O(1) 退化为 O(n)。",
        "put 已存在的键时重复插入，链表里出现同一键的两个节点，删一个还剩一个。",
      ],
      method:
        "先写清三个动作：定位（哈希）、移动（从链表摘下再插表头）、淘汰（拆表尾并从哈希删除）；再用哨兵节点把边界情况统一掉，最后用固定序列手推一遍。",
      exercise:
        "实现容量为 2 的 LRU，依次执行 put(1,1)、put(2,2)、get(1)、put(3,3)，写出每一步之后的键序列，并解释被淘汰的为什么是 2。",
      checkpoint:
        "能手推 get 命中与 put 溢出两类操作的指针变化，并说清为什么必须用双向链表而不是单链表。",
      lesson: {
        overview: [
          "LRU（Least Recently Used，最近最少使用）是最常见的缓存淘汰策略：容量满了就丢掉最久没被访问的那条。听起来简单，要让 get 与 put 都是 O(1) 却不平凡——哈希表查得快，但它不知道谁最久没用；链表知道顺序，但按下标找要 O(n)。标准答案是把两者拼起来，让它们各管一件事。这也是它常被拿来当组合数据结构的入门题的原因，考的是分工而不是算法。",
          "这个结构是少见的组合数据结构范例：它没有发明新算法，只是把哈希的定位能力与链表的顺序维护能力叠在一起。理解它比背下代码更有价值的，是学会问一句：这个操作慢在哪一步，能不能换一个结构专门负责那一步。很多看起来需要新算法的需求，拆开之后只是两个熟悉结构的拼接，比如 LFU 是哈希加频次桶，跳表是有序链表加多级索引。",
          "真实系统里几乎都有它的影子：数据库缓冲池、CDN 边缘缓存、浏览器 HTTP 缓存、Redis 的 allkeys-lru 策略。它们未必逐字用双向链表，但思想一致：把最近性记录成可以 O(1) 更新的顺序。理解这一点，你在读这些系统的淘汰参数时才不会只看名字，而会去问它的时间戳精度、采样方式与写回时机。",
        ],
        mechanism: [
          "哈希表存键到节点引用的映射，所以 get 一步就能拿到节点；链表按访问时间从新到旧排列，表头最新、表尾最旧。命中后把该节点从当前位置摘下、插到表头，只改常数条指针，是 O(1)。未命中时不做任何结构调整，缓存只在真的命中时才更新顺序。",
          "插入新键时：键已存在就只更新值并移到表头；键不存在且容量已满，先摘掉表尾节点并从哈希表删除它的键，再把新节点插到表头。删除必须同时在两个结构里做，漏掉一边就会留下链表里有、哈希里没有的僵尸节点。",
          "为什么必须双向：淘汰要摘表尾，单链表摘下尾节点需要它的前驱，只能从头遍历 O(n)。头尾各放一个哨兵节点能让摘表头、摘表尾、空表插入都走同一段代码，少掉大量 if，也更难写错。同理，若用数组实现，删除中间元素要搬移后续元素，同样是 O(n)。",
          "语言自带的有序字典常能省掉手写链表：JavaScript 的 Map 保证按插入顺序迭代，delete 之后再 set 就等于把键移到最新一端；Python 的 OrderedDict 提供 move_to_end。但要清楚这只在语言保证顺序时才成立，Go 与 C++ 的 map 无序，必须自己维护链表。用库之前要读清它的复杂度承诺，否则换语言或换版本时性能会悄悄退化。",
        ],
        example: {
          title: "JavaScript：用 Map 的插入顺序实现 O(1) 的 LRU",
          language: "javascript",
          code: "class LRUCache {\n  constructor(capacity) {\n    this.capacity = capacity;\n    this.map = new Map();      // Map 按插入顺序迭代：最早的在前，最新的在后\n  }\n\n  get(key) {\n    if (!this.map.has(key)) return -1;\n    const value = this.map.get(key);\n    this.map.delete(key);\n    this.map.set(key, value);  // 删了再插 = 移到最新一端\n    return value;\n  }\n\n  put(key, value) {\n    if (this.capacity <= 0) return;\n    if (this.map.has(key)) {\n      this.map.delete(key);    // 已有键：先删，避免容量被重复计数\n    } else if (this.map.size >= this.capacity) {\n      const oldest = this.map.keys().next().value;\n      this.map.delete(oldest); // 淘汰最久未使用的键\n    }\n    this.map.set(key, value);\n  }\n}",
          explanation:
            "Map 的迭代顺序由规范保证是插入顺序，因此 keys() 的第一个就是最久没被访问的键，delete 再 set 等价于在双向链表里摘下节点插到表头，两个动作都是 O(1)。put 对已存在的键先删再插，是为了不让 size 被重复计数；淘汰发生在插入之前，保证 size 永远不会超过 capacity。若换成 Go 或 C++ 的无序 map，就必须手写双向链表来维护这个顺序。",
        },
        practiceSteps: [
          "先画出 head 与 tail 两个哨兵，把 get 命中、put 新增、put 溢出三种情况各走一遍指针变化。",
          "实现后每次操作都打印整条链表与哈希表的键集合，确认两者始终一致、没有僵尸节点。",
          "用固定序列回归：容量 2 时跑 put(1,1)、put(2,2)、get(1)、put(3,3)，核对淘汰的是 2 而不是 1。",
          "补一组边界用例：容量为 1、反复 put 同一个键、get 不存在的键。",
        ],
        masteryChecklist: [
          "能说清哈希与链表各自负责哪一半，以及为什么单链表不行。",
          "能手推 put 溢出时的四步：摘尾、删索引、建节点、插表头。",
          "能解释命中后不移动节点为什么会让 LRU 退化成 FIFO。",
        ],
        summary: [
          "LRU = 哈希定位 + 双向链表排序，两个 O(1) 拼出整体的 O(1)。",
          "表头最新、表尾最旧；每次命中都要移到表头。",
          "淘汰尾节点必须双向链表，否则摘尾是 O(n)。",
          "哨兵节点消除空表与边界特判，代码更难写错。",
          "有序字典能省掉手写链表，但依赖语言对迭代顺序的保证。",
        ],
        terms: [
          {
            term: "LRU (Least Recently Used)",
            plain: "缓存满了先扔掉最久没被用过的那条。",
            detail:
              "判据是最近一次访问时间，不是插入时间，所以每次 get 命中都要更新顺序。它的近似版本 LRU-K、2Q 在数据库与 CDN 里更常见，因为精确 LRU 对扫描型访问很脆弱。",
          },
          {
            term: "Sentinel Node",
            plain: "不存数据的假节点，专门用来消除边界判断。",
            detail:
              "头尾各放一个，链表永远不为空，摘节点与插节点时不必判断前驱后继是否存在。代价是多两个节点，换来的是少一半的 if 分支与更低的写错概率。",
          },
          {
            term: "Doubly Linked List",
            plain: "每个节点同时记着前一个和后一个节点。",
            detail:
              "只有双向链表才能在已知节点时 O(1) 摘下它，这也是 LRU 淘汰尾节点能 O(1) 的前提。代价是每个节点多一个指针，内存开销比单链表大。",
          },
          {
            term: "Cache Hit",
            plain: "要的数据正好在缓存里，不用回源查询。",
            detail:
              "命中率决定缓存的收益。LRU 的前提是访问有局部性；如果访问模式是均匀随机的大范围扫描，LRU 命中率会很低，此时该考虑分段或计数型策略。",
          },
        ],
      },
    },
    questions: [
      {
        key: "algorithms-exp-algo-lru-cache-s1",
        stageKey: "algo-linear",
        topicKey: "algo-lru-cache",
        type: "single",
        stem: "要让 LRU 缓存的 get 与 put 都是 O(1)，必须组合使用哪两个结构？",
        options: [
          { key: "A", text: "哈希表 + 数组" },
          { key: "B", text: "哈希表 + 双向链表" },
          { key: "C", text: "二叉搜索树 + 队列" },
          { key: "D", text: "哈希表 + 单链表" },
        ],
        answer: ["B"],
        explanation:
          "哈希表负责键到节点的 O(1) 定位，双向链表负责维护最近使用顺序。淘汰要摘表尾，单链表摘下尾节点需要它的前驱，只能从头遍历 O(n)；数组在中间删除或移动元素同样是 O(n)。只有双向链表能在已知节点时 O(1) 摘下并插到表头，两者合起来才满足 get 与 put 都 O(1)。",
        difficulty: "medium",
        tags: ["LRU", "哈希表", "链表"],
        sourceKey: "algorithms-java",
        level: "进阶",
      },
      {
        key: "algorithms-exp-algo-lru-cache-j1",
        stageKey: "algo-linear",
        topicKey: "algo-lru-cache",
        type: "judge",
        stem: "LRU 缓存中 get 命中后不必调整链表顺序，只要 put 新键时把节点插到表头，淘汰顺序就是正确的。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "淘汰顺序必须反映最近一次访问，而 get 命中本身就是一次访问。如果命中不移动节点，链表顺序只剩插入时间，缓存实际退化成 FIFO：一个刚被反复读取的热点键可能因为插入得早而被淘汰。因此命中后必须把节点摘下并插到表头。",
        difficulty: "medium",
        tags: ["LRU", "淘汰策略"],
        sourceKey: "algorithms-java",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "algorithms",
    stageKey: "algo-hash-tree",
    topic: {
      key: "algo-bloom-filter",
      title: "布隆过滤器：用位数组做概率判重",
      summary:
        "k 个哈希把元素撒进 m 位的位数组：查询出现 0 就一定没插过，全为 1 只能说可能存在。它用可控的误判率换取极小的空间。",
      concepts: ["位数组", "多哈希函数", "假阳性", "误判率与容量"],
      principles: [
        "插入把 k 个位置置 1；查询时只要有一位是 0，元素一定没插过，因此不存在假阴性。",
        "所有位都是 1 只能说明可能插过：别的元素可能把这些位置一起置了 1，这就是假阳性。",
        "位数组越小、元素越多，位被占满的比例越高，误判率随 (1 - e^(-kn/m))^k 上升。",
        "标准布隆过滤器不支持删除：清掉一位会连累其它共享该位的元素，反而制造假阴性。",
      ],
      applications: ["缓存穿透防护：先挡掉一定不存在的键", "爬虫 URL 去重", "大数据集存在性预筛，减少磁盘与网络查询"],
      pitfalls: [
        "把可能存在当成一定存在，直接返回业务数据，等于把误判变成脏数据。",
        "用删除或清位来修正，引入本来不存在的假阴性。",
        "容量按当前数据量规划，数据增长后位被占满，误判率迅速升高。",
      ],
      method:
        "先定误判率目标 p 与预期元素数 n，再反推位数 m 与哈希个数 k；查询结果一律按可能处理，后面必须还有一次真正的校验。",
      exercise:
        "用 m=1000 位、k=3 的布隆过滤器插入 100 个随机字符串，再测 1000 个没插过的字符串，统计假阳性比例，并与公式估算值对比。",
      checkpoint:
        "能说明为什么它没有假阴性却有假阳性，并解释为什么不能删除元素。",
      lesson: {
        overview: [
          "判断一个元素在不在集合里，最直接的办法是存下整个集合，但元素上亿时内存撑不住。布隆过滤器换了个问法：不要求 100% 准确，只要求说不在时一定对。它用一个位数组和几个哈希函数，把空间压到原来的几十分之一，代价是说在的时候可能是错的。",
          "这种允许单向误差的设计在工程里很实用：缓存前面挡一层布隆过滤器，绝大多数不存在的键在第一层就被拦掉，不会打到数据库；爬虫用它判断 URL 是否抓过，几十 GB 的 URL 集合能压到几 GB 内存。它还能和磁盘索引配合：先用极小的内存排除掉大部分不可能命中的查询，再去碰昂贵的存储。",
          "它的误差方向是固定的：没有假阴性，只有假阳性。理解这一点才知道怎么用它——凡是误判为存在的代价可接受、而漏判不可接受的场景都合适；反过来，一旦需要精确答案或删除操作，就该换哈希集合或计数布隆过滤器。选型时先问一句：错判成存在时业务会多付多少代价，能接受才谈得上用它。",
        ],
        mechanism: [
          "位数组初始全 0。插入元素 x 时，用 k 个独立哈希算出 k 个下标，把对应位都置 1。查询时算出同样的 k 个下标：若有一位是 0，说明 x 从未被插入，因为插入时它一定被置 1；若全是 1，则 x 可能被插入过，也可能是别的元素恰好把这些位置都置了 1。",
          "误判率由位被占用的比例决定。插入 n 个元素、每个用 k 个哈希后，某一位仍为 0 的概率约为 e^(-kn/m)，因此任取一个未插入元素、它的 k 位恰好全为 1 的概率约为 (1 - e^(-kn/m))^k。m 越大误判率越低但内存越大；k 太大又会让位被过快填满，常见最优约 k = (m/n)·ln2。",
          "删除之难来自共享：多个元素可能把同一位设为 1，清掉这一位就等于把其它元素也删了，于是出现本该没有的假阴性，而假阴性会直接破坏说不在一定对这个唯一可靠的承诺。需要删除时要改用计数布隆过滤器（每位换成计数器，删除即减一）或定期重建。",
        ],
        example: {
          title: "Python：用 bytearray 实现位数组与多哈希",
          language: "python",
          code: "import hashlib\n\n\nclass BloomFilter:\n    def __init__(self, bits, hashes):\n        self.bits = bytearray((bits + 7) // 8)\n        self.m = bits\n        self.k = hashes\n\n    def _indexes(self, item):\n        digest = hashlib.sha256(item.encode('utf-8')).digest()\n        # 一次哈希切成多段，模拟多个独立哈希（k 不能超过 8，因为 sha256 只有 256 位）\n        for i in range(self.k):\n            chunk = digest[i * 4 : i * 4 + 4]\n            yield int.from_bytes(chunk, 'big') % self.m\n\n    def add(self, item):\n        for idx in self._indexes(item):\n            self.bits[idx // 8] |= 1 << (idx % 8)\n\n    def might_contain(self, item):\n        return all(self.bits[idx // 8] & (1 << (idx % 8)) for idx in self._indexes(item))",
          explanation:
            "位数组用 bytearray 表示，第 idx 位落在第 idx // 8 个字节的第 idx % 8 位，置位用或、检查用与。哈希只算一次 SHA-256 再切成 k 段，避免调用 k 次哈希函数；但这 k 段并不严格独立，真实实现常用双哈希 h1 + i·h2 或 MurmurHash。方法名故意写成 might_contain 而不是 contains，就是在提醒调用方：True 只代表可能。",
        },
        practiceSteps: [
          "先确定可接受误判率 p 与预期元素数 n，用 m = -n·ln(p)/(ln2)^2 估位数，再取 k = round(m/n·ln2)。",
          "查询结果一律先按可能处理，命中后再做一次真正的存在性校验（查库或查集合）。",
          "在插入量接近容量上限时重建：新建更大的过滤器，把现网数据重新灌一遍，再原子切换。",
        ],
        masteryChecklist: [
          "能解释为什么没有假阴性、为什么会有假阳性。",
          "能说出 m、n、k 分别变化时误判率往哪个方向走。",
          "能说清删除为什么会引入假阴性，以及计数布隆过滤器怎么补救。",
        ],
        summary: [
          "布隆过滤器用位数组加 k 个哈希，空间远小于存下整个集合。",
          "查询为 0 一定不在；全为 1 只是可能存在。",
          "误判率随 n/m 上升，可按 (1 - e^(-kn/m))^k 估算。",
          "不支持删除，删一位会连累共享该位的其它元素。",
        ],
        terms: [
          {
            term: "Bloom Filter",
            plain: "用几个哈希把元素记在位数组里，只能说可能在。",
            detail:
              "它把空间压到每个元素几个比特，代价是假阳性。适合放在昂贵查询之前做预筛，不能当作精确集合使用。",
          },
          {
            term: "False Positive",
            plain: "它说在，其实不在，这是布隆过滤器唯一会犯的错。",
            detail:
              "误判率由位数 m、元素数 n、哈希数 k 共同决定。业务上通常可以接受多查一次库，但不能接受漏判，所以这个误差方向是可用的。",
          },
          {
            term: "False Negative",
            plain: "它说不在，其实在，布隆过滤器保证不会发生。",
            detail:
              "前提是只增不删、位只从 0 变 1。一旦手动清位或改用不支持删除的变体，这个保证就被破坏了，整个方案的立身之本也就没了。",
          },
          {
            term: "Bit Array",
            plain: "每个元素只占一位的数组，只能存 0 或 1。",
            detail:
              "m 位的位数组只占 m/8 字节，比布尔数组省 8 倍空间。代价是访问要自己做除法与取模拆位，且并发写入时要注意原子性。",
          },
        ],
      },
    },
    questions: [
      {
        key: "algorithms-exp-algo-bloom-filter-s1",
        stageKey: "algo-hash-tree",
        topicKey: "algo-bloom-filter",
        type: "single",
        stem: "布隆过滤器对某个元素查询时发现 k 个位置中有一位是 0，可以得出的结论是？",
        options: [
          { key: "A", text: "该元素一定没被插入过" },
          { key: "B", text: "该元素可能被插入过" },
          { key: "C", text: "该元素一定被插入过" },
          { key: "D", text: "过滤器已损坏，结果不可用" },
        ],
        answer: ["A"],
        explanation:
          "插入时一定会把该元素对应的 k 个位置全部置 1，而且标准实现的位只会从 0 变成 1，不会回退。所以只要查询中有一位是 0，就能反推出这个元素从未被插入，不存在假阴性。反过来全为 1 时只能推出可能存在，因为别的元素可能恰好把这些位都置了 1。",
        difficulty: "medium",
        tags: ["布隆过滤器", "假阳性", "位数组"],
        sourceKey: "algorithms-python",
        level: "进阶",
      },
      {
        key: "algorithms-exp-algo-bloom-filter-j1",
        stageKey: "algo-hash-tree",
        topicKey: "algo-bloom-filter",
        type: "judge",
        stem: "布隆过滤器支持删除元素，只要把该元素对应的 k 个位重新置 0 即可。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "多个元素可能共享同一位，把这一位置 0 会同时抹掉其它元素的信息，从而产生假阴性，破坏它说不在一定对这个唯一可靠的承诺。确需删除时要用计数布隆过滤器（每位换成计数器，删除即减一），或者定期用现网数据整体重建。",
        difficulty: "medium",
        tags: ["布隆过滤器", "删除", "假阴性"],
        sourceKey: "coding-interview-university",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "algorithms",
    stageKey: "ds-tree-search",
    topic: {
      key: "algo-trie",
      title: "Trie 前缀树",
      summary:
        "把字符串拆成字符路径存进多叉树：查询代价只与词长有关、与词表大小无关，相同前缀共享一条路径，天然支持前缀检索。",
      concepts: ["字符节点", "路径即前缀", "词尾标记", "空间换时间"],
      principles: [
        "从根到某个节点的一条路径就是一个前缀；查长度为 L 的串只需走 L 步，代价与词表里有多少词无关。",
        "必须在词尾节点打标记 isEnd，否则无法区分完整单词与别人的前缀。",
        "共享前缀是它省空间的原因，但每个节点要存子节点表；字符集小用定长数组，字符集大用哈希表。",
        "删除要先确认该词存在，去掉词尾标记后，若路径上节点已无子节点且不是别的词尾，再自底向上回收。",
      ],
      applications: ["搜索框自动补全与联想", "拼写检查与敏感词过滤", "IP 路由的最长前缀匹配"],
      pitfalls: [
        "忘记 isEnd，把前缀当成完整单词，search 与 startsWith 混为一谈。",
        "把中文等 Unicode 字符往 26 个槽里塞，直接越界或丢字符。",
        "删除时只去掉标记不回收节点，长时间运行后内存只涨不降。",
      ],
      method:
        "先判断问题是不是按前缀找一批词；是的话用 Trie，并在设计节点时就定好子节点存法（定长数组或哈希表），同时明确 isEnd 的语义。",
      exercise:
        "实现 insert、search、startsWith 三个方法，插入 app、apple、apply 后验证 search(app) 为真、search(ap) 为假、startsWith(ap) 为真。",
      checkpoint:
        "能说清 search 与 startsWith 的差别只在于是否检查 isEnd，并解释查询为什么是 O(L)。",
      lesson: {
        overview: [
          "Trie 又叫前缀树、字典树，它把词拆成字符，沿树的边一个一个走。根节点是空串，任意节点到根的路径拼起来就是一个前缀。这样存的好处是：查一个词不需要和词表里的每个词比，只要按字符走 L 步，走完再看词尾标记就知道在不在。名字来自 retrieval，念作 tree 或 try 都可以，重点是理解它的形状而不是记住名字。",
          "形状上它像一棵多叉树，兄弟节点之间没有顺序要求，能走通就说明前缀存在。正因为前缀是显式存在的一条路径，Trie 天然支持以某串开头的所有词这类查询——哈希表做不到，因为它把整个字符串压成一个桶位置，前缀信息丢失了。反过来，它也不擅长模糊匹配，除非你在树上额外做回溯与剪枝。",
          "代价是空间。每个节点都要维护一张子节点表，词越长、字符集越大，节点越多。所以工程里常把子节点做成哈希表，或把只有一个孩子的长链压缩成一条边（Radix Tree），在查询快与占内存少之间取平衡。经验是：词条少而短时朴素 Trie 就够，词条上百万且前缀分散时才值得做压缩。",
        ],
        mechanism: [
          "insert 从根开始，对每个字符查当前节点的子节点：有就往下走，没有就新建一个挂上去。走完最后一个字符后把当前节点标记为词尾。search 走同样的路径，路径断了返回 false，走通了还要看词尾标记，这一步是区分词与前缀的唯一依据。",
          "查询复杂度 O(L)：每条边对应一个字符，与词表规模 n 无关。作为对比，在 n 个词里逐个比较前缀最坏是 O(n·L)。这正是自动补全能在毫秒级返回的原因——先走到前缀节点，再对它的子树做一次 DFS 就能列出所有候选。列出候选的代价正比于子树里的词数，因此候选很多时还要配合打分与截断。",
          "子节点表的实现决定空间与常数：字符集固定且小（如只允许 a-z）时用 26 槽定长数组，访问最快但每节点固定开销大；字符集大或含 Unicode 时用哈希表，省空间但多一次哈希。压缩前缀树把只有一个子节点的链合并成带字符串的边，能显著减少节点数。",
        ],
        example: {
          title: "TypeScript：哈希表子节点 + isEnd 标记",
          language: "typescript",
          code: "type TrieNode = {\n  children: Map<string, TrieNode>;\n  isEnd: boolean;\n};\n\nclass Trie {\n  private root: TrieNode = { children: new Map(), isEnd: false };\n\n  insert(word: string): void {\n    let node = this.root;\n    for (const ch of word) {\n      let next = node.children.get(ch);\n      if (!next) {\n        next = { children: new Map(), isEnd: false };\n        node.children.set(ch, next);\n      }\n      node = next;\n    }\n    node.isEnd = true;          // 只有这里标记，才是完整单词\n  }\n\n  private walk(prefix: string): TrieNode | null {\n    let node: TrieNode | null = this.root;\n    for (const ch of prefix) {\n      node = node.children.get(ch) ?? null;\n      if (!node) return null;\n    }\n    return node;\n  }\n\n  search(word: string): boolean {\n    const node = this.walk(word);\n    return node !== null && node.isEnd;   // 必须是完整单词\n  }\n\n  startsWith(prefix: string): boolean {\n    return this.walk(prefix) !== null;    // 只要路径存在\n  }\n}",
          explanation:
            "children 用 Map 而不是 26 槽数组，因此中文、数字、符号都能存，不必为字符集预设大小。insert 把有就走、没有就建写在同一个分支里，walk 封装了 search 与 startsWith 共用的走路径逻辑，两者的差别只剩要不要检查 isEnd。这样写让是词与是前缀在代码层面就不会被混淆。",
        },
        practiceSteps: [
          "先想清楚字符集：只处理 a-z 可用定长数组，含中文或任意字符就用哈希表。",
          "给节点加 isEnd，并写两个方法分别验证是词与是前缀，用 app、apple、ap 三个输入做交叉测试。",
          "实现前缀搜索：走到前缀节点后对子树做 DFS，按遍历顺序返回所有 isEnd 的词。",
          "实现删除：去掉 isEnd 后自底向上回收没有子节点的节点，并用内存统计确认没有泄漏。",
        ],
        masteryChecklist: [
          "能写出 insert、search、startsWith 并解释三者差异。",
          "能说明查询为什么是 O(L) 而不是 O(n)。",
          "能对比定长数组与哈希表两种子节点实现的取舍。",
        ],
        summary: [
          "Trie 把字符串拆成字符路径，路径即前缀。",
          "查询 O(L)，与词表规模无关。",
          "isEnd 区分完整单词与前缀，漏了它 search 就会误判。",
          "共享前缀省空间，但节点表有额外开销，必要时用压缩前缀树。",
        ],
        terms: [
          {
            term: "Trie",
            plain: "按字符一层层往下走的前缀树，走通就说明前缀存在。",
            detail:
              "名字来自 retrieval。它牺牲空间换取与前缀相关的高效查询，常用于自动补全、拼写检查与路由表。",
          },
          {
            term: "Prefix",
            plain: "一个词从开头截下来的部分，比如 app 是 apple 的前缀。",
            detail:
              "在 Trie 里前缀就是一条从根出发的路径，所以判断前缀存在与否只取决于路径是否走得通，与是否为完整单词无关。",
          },
          {
            term: "isEnd",
            plain: "节点上的标记：这里正好是一个完整单词的结尾。",
            detail:
              "没有它，hello 与 helloworld 的前缀关系会让 search 把 hell 也当成词。插入时在最后一步置真，删除时在最后一步置假。",
          },
          {
            term: "Compressed Trie (Radix Tree)",
            plain: "把只有一个孩子的长链压成一条边的 Trie，省节点。",
            detail:
              "节点数从字符数级别降到分支数级别，适合长公共前缀少、词条多的词库。代价是边上要存字符串片段，插入与删除要拆分或合并边。",
          },
        ],
      },
    },
    questions: [
      {
        key: "algorithms-exp-algo-trie-s1",
        stageKey: "ds-tree-search",
        topicKey: "algo-trie",
        type: "single",
        stem: "Trie 中 search(word) 与 startsWith(prefix) 的核心差别是？",
        options: [
          { key: "A", text: "search 要检查词尾标记 isEnd，startsWith 只需路径存在" },
          { key: "B", text: "search 用深度优先，startsWith 用广度优先" },
          { key: "C", text: "startsWith 只能查询单个字符" },
          { key: "D", text: "两者完全等价，只是命名不同" },
        ],
        answer: ["A"],
        explanation:
          "两者走的是同一条路径，唯一区别是结束条件：search 要求走完之后当前节点被标记为词尾，才算这个词真的插入过；startsWith 只要求路径能走通，因为它问的是有没有以这个前缀开头的词。漏掉 isEnd 检查，就会把别人的前缀当成完整单词。",
        difficulty: "easy",
        tags: ["Trie", "前缀树", "isEnd"],
        sourceKey: "algorithms-javascript",
        level: "入门",
      },
      {
        key: "algorithms-exp-algo-trie-j1",
        stageKey: "ds-tree-search",
        topicKey: "algo-trie",
        type: "judge",
        stem: "Trie 查询一个长度为 L 的字符串的时间复杂度是 O(L)，与词表中词的数量无关。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "Trie 按字符逐层下降，每一步只查当前节点的子节点表，走的步数恰好等于串长 L，所以代价只与 L 和子节点表的查找方式有关，与词表里存了一千个还是一百万个词无关。这也是自动补全能在海量词库里毫秒级响应的原因。",
        difficulty: "medium",
        tags: ["Trie", "复杂度"],
        sourceKey: "algorithms-javascript",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "algorithms",
    stageKey: "ds-sort",
    topic: {
      key: "algo-external-sort",
      title: "外部排序与多路归并",
      summary:
        "数据比内存大时，排序被拆成两段：先在内存里排出一批有序归并段，再做 k 路归并。真正的瓶颈是磁盘 I/O 次数，不是比较次数。",
      concepts: ["归并段", "k 路归并", "归并趟数", "I/O 与缓冲区"],
      principles: [
        "内存装不下时，排序等于生成初始归并段（内部排序）加多趟归并，最后一遍得到全局有序。",
        "k 路归并的趟数是 ceil(log_k N)，把 k 从 2 提到 8 能把趟数砍掉约三分之二，I/O 随之下降。",
        "k 路归并每次要在 k 个候选里取最小，用最小堆或败者树把单次选择从 O(k) 降到 O(log k)。",
        "k 不能无限大：每路都要一个输入缓冲区，缓冲区太小会引发频繁的碎读写，反而更慢。",
      ],
      applications: ["超出内存的大文件排序", "数据库 ORDER BY、建索引时的磁盘溢写", "多路日志按时间戳合并成全局时间线"],
      pitfalls: [
        "以为多开内存就能解决，忽略数据量还会继续增长。",
        "k 取得很大但缓冲区不够，页换入换出把趟数减少的收益吃掉。",
        "归并段长度相差悬殊却不做归并树优化，总读写量变多。",
      ],
      method:
        "先算内存一次能排多少（归并段长度），再按趟数等于 ceil(log_k 段数) 选 k，最后确认 k 路缓冲区放得下、文件句柄够用。",
      exercise:
        "把 10 GB 数据、1 GB 内存的排序拆成步骤：写清归并段大小、段数、k 取多少、共几趟、每趟读写多少数据。",
      checkpoint:
        "能解释为什么 k 路归并的趟数是 log_k N，以及为什么 k 不是越大越好。",
      lesson: {
        overview: [
          "内存排序的前提是所有数据都能装进内存。一旦数据是 10 GB 而内存只有 1 GB，就必须换思路：先把数据切成能装下的块，每块在内存里排好写回磁盘，得到若干有序的归并段；再把这些有序段多路合并，最终得到一个全局有序的文件。这就是外部排序。它不追求少比较，而追求少读写磁盘，这个目标差异决定了后面所有设计。",
          "它的代价模型和内排序完全不同。内排序数比较次数，外部排序数磁盘读写次数——一次随机 I/O 可能比几万次比较还慢。所以优化的方向是减少趟数：一次能合并的路数越多，需要的趟数越少，读写的总数据量也就越少。另外顺序读写远快于随机读写，所以缓冲区要成块读，而不是一条一条地取。",
          "工程里它无处不在：数据库执行大表的 ORDER BY、建索引、GROUP BY 时，如果内存不够就会把中间结果溢写到临时文件再归并；日志系统也常把多个已按时间排好序的分片做多路归并，得到全局时间线。理解它，你在看到排序溢出告警时才知道是该调内存参数，还是该补索引。",
        ],
        mechanism: [
          "第一阶段：按内存容量把文件切成若干块，每块读进内存用内排序排好，写成一个归并段。若内存能放 M 条记录，10 GB 除以 M 就得到相应数量的初始归并段，每个段内部有序、段间无序。归并段长度就是内存能容纳的记录数，这个参数直接决定段数与后续趟数。",
          "第二阶段：对这些段做 k 路归并。每趟同时打开 k 个段，各读一小块进缓冲区，每次从 k 个当前元素里取最小的写出，某路缓冲空了就续读。一趟把段数缩小 k 倍，所以总共需要 ceil(log_k N) 趟，最后只剩一个段即全局有序。",
          "k 路归并每次要选出 k 个候选里的最小值，线性扫描是 O(k)，用最小堆是 O(log k)，总代价从 O(N·k) 降到 O(N·log k)。但 k 增大也意味着要同时开 k 个输入缓冲区加一个输出缓冲区，缓冲区总量受内存限制：k 太大时每个缓冲区变小，读写变碎，随机 I/O 增加，可能抵消趟数减少带来的收益。",
          "当初始归并段长度不等时，合并的先后顺序会影响总读写量。按 Huffman 思路每次合并最短的两段（最佳归并树），能让总 I/O 最小；段长相等时顺序无所谓。原因是每段在后续每一轮里都会被重新读一遍，越长的段越应该晚合并，减少它被重复读写的次数。",
        ],
        example: {
          title: "Python：heapq.merge 就是惰性的 k 路归并",
          language: "python",
          code: "import heapq\n\n\ndef external_sort(input_path, output_path, chunk_size=100_000):\n    runs = []\n    with open(input_path, encoding='utf-8') as src:\n        while True:                                     # 第一阶段：生成初始归并段\n            chunk = [src.readline() for _ in range(chunk_size)]\n            chunk = [line for line in chunk if line]     # 去掉末尾的空串\n            if not chunk:\n                break\n            chunk.sort()                                 # 内存里排好\n            run_path = f'{output_path}.run{len(runs)}'\n            with open(run_path, 'w', encoding='utf-8') as out:\n                out.writelines(chunk)\n            runs.append(run_path)\n\n    # 第二阶段：heapq.merge 维护大小为 k 的堆，每次弹最小并从对应文件续读一行\n    with open(output_path, 'w', encoding='utf-8') as out:\n        streams = [open(path, encoding='utf-8') for path in runs]\n        try:\n            out.writelines(heapq.merge(*streams))\n        finally:\n            for stream in streams:\n                stream.close()",
          explanation:
            "chunk_size 控制每次读入内存的行数，排序后写成 .run 文件，这就是初始归并段。第二阶段直接用标准库的 heapq.merge：它内部维护一个大小为 k 的堆，每次弹出当前最小行并从对应文件续读一行，所以选最小的代价是 O(log k)，内存只占 k 个缓冲区。真实实现还要处理 k 超过文件句柄上限的情况（分批归并），并给每路配固定大小的缓冲区做顺序读写。",
        },
        practiceSteps: [
          "先测一条记录多大、能给多少内存，算出一次能排多少条，从而定下归并段长度。",
          "按 ceil(log_k 段数) 估趟数，在文件句柄与缓冲区允许的范围内选 k，一般从 8 到 64 起步。",
          "给每路配固定缓冲区（如 1 MB），坚持顺序读写而不是逐条随机读写，并用实测耗时验证 k 的取值。",
          "段长不等时按最佳归并树安排合并顺序，比较总读写量是否下降。",
        ],
        masteryChecklist: [
          "能写出外部排序的两个阶段并估算段数与趟数。",
          "能解释 k 路归并为什么要用最小堆或败者树。",
          "能说明 k 取得太大反而变慢的原因。",
        ],
        summary: [
          "外部排序 = 内存内排出归并段 + 多路归并，瓶颈是 I/O。",
          "k 路归并的趟数是 ceil(log_k N)，k 越大趟数越少。",
          "k 路选最小用最小堆，O(log k)；k 受缓冲区与文件句柄限制。",
          "段长不等时按最佳归并树（Huffman）安排合并顺序，可减少总读写。",
        ],
        terms: [
          {
            term: "External Sort",
            plain: "数据放不进内存时，分段排好再合并的排序方法。",
            detail:
              "核心是把随机访问变成顺序访问，把比较次数换成 I/O 次数。评价它好坏看的是读写量，而不是 CPU 时间。",
          },
          {
            term: "Run",
            plain: "一次内存排序产出的有序片段，外部排序的基本单位。",
            detail:
              "初始归并段的长度通常等于内存容量。段越多，后续归并趟数越多，所以提高内存利用率或做置换选择都能减少初始段数。",
          },
          {
            term: "k-way Merge",
            plain: "同时合并 k 个有序段，每次取其中最小的一个。",
            detail:
              "用最小堆或败者树把每取一个元素的代价从 O(k) 降到 O(log k)。k 的选择要在趟数与缓冲区之间平衡。",
          },
          {
            term: "Loser Tree",
            plain: "多路归并里选最小的专用结构，比堆常数更小。",
            detail:
              "败者树记录每场比赛的败者，更新时只需沿一条路径比较，适合 k 固定且很大的归并。堆实现更通用，败者树更快。",
          },
        ],
      },
    },
    questions: [
      {
        key: "algorithms-exp-algo-external-sort-s1",
        stageKey: "ds-sort",
        topicKey: "algo-external-sort",
        type: "single",
        stem: "对 N 个初始归并段做 k 路归并，需要的归并趟数大约是？",
        options: [
          { key: "A", text: "N / k" },
          { key: "B", text: "ceil(log_k N)" },
          { key: "C", text: "始终是 ceil(log_2 N)，与 k 无关" },
          { key: "D", text: "k" },
        ],
        answer: ["B"],
        explanation:
          "每做一趟 k 路归并，段数就缩小为原来的 1/k，因此从 N 段降到 1 段需要满足 k^t 大于等于 N 的最小 t，即 ceil(log_k N)。这也解释了为什么增大 k 能减少趟数：k=2 时约需 log2 N 趟，k=8 时只需约 log8 N 趟，磁盘读写总量随之下降。",
        difficulty: "medium",
        tags: ["外部排序", "多路归并", "复杂度"],
        sourceKey: "algorithms-python",
        level: "进阶",
      },
      {
        key: "algorithms-exp-algo-external-sort-j1",
        stageKey: "ds-sort",
        topicKey: "algo-external-sort",
        type: "judge",
        stem: "多路归并时 k 取得越大越好，因为趟数会随之减少。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "趟数确实随 k 增大而减少，但 k 路归并需要同时开 k 个输入缓冲区和一个输出缓冲区，缓冲区总量受内存限制。k 太大时每路缓冲区变小，读写变得零碎、随机 I/O 增加，还会撞上文件句柄上限。所以 k 要在趟数与缓冲区之间取平衡，通常从 8 到 64 试起。",
        difficulty: "medium",
        tags: ["外部排序", "缓冲区", "I/O"],
        sourceKey: "algorithms-python",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "algorithms",
    stageKey: "ds-algo-strategy",
    topic: {
      key: "algo-bitmask",
      title: "位运算与状态压缩",
      summary:
        "一个整数就是一排布尔位：x & (x-1) 清掉最低位的 1，x & -x 取出它；把集合压进掩码后，交并差与子集枚举都只用几条机器指令。",
      concepts: ["补码", "lowbit", "位掩码集合", "子集枚举"],
      principles: [
        "补码下 -x 等于 ~x + 1，因此 x & -x 恰好取出最低位的 1，x & (x-1) 恰好清掉它。",
        "一个 64 位整数能表示 64 个元素的集合，交并差补对应 & | ^ ~，都是 O(1) 机器指令。",
        "枚举 mask 的所有子集用 s = (s - 1) & mask，从 s = mask 减到 0，不重不漏。",
        "字长是硬约束：移位位数达到或超过字长在 C、Java、Go 里是未定义或取模行为，不能假设结果是 0。",
      ],
      applications: ["权限与状态位标记", "状态压缩 DP（旅行商、棋盘覆盖）", "位图与大规模布尔集合"],
      pitfalls: [
        "把 1 << 32 当成 2 的 32 次方，在 32 位整型上实际是未定义或绕回 1。",
        "混淆算术右移与逻辑右移，负数高位补 1 导致结果错。",
        "枚举子集时只递减一却不与 mask 相与，枚举到根本不属于 mask 的位。",
      ],
      method:
        "先确认元素个数不超过字长，再把集合写成掩码；凡涉及移位先检查位数会不会溢出字长，负数右移优先用无符号版本。",
      exercise:
        "用位运算写三个函数：判断 x 是否为 2 的幂、统计二进制中 1 的个数、枚举 mask 的全部子集，并各给一组边界输入（0、负数、全 1）。",
      checkpoint:
        "能解释 x & (x-1) 为什么能清掉最低位的 1，以及子集枚举为什么不会重复。",
      lesson: {
        overview: [
          "位运算看起来是底层技巧，实际是用一个整数表示一个集合的建模工具。n 个元素是否被选中，正好是 n 个布尔值；把它们塞进一个整数的二进制位里，集合的交并差就变成了与、或、异或，一次机器指令完成，比数组或哈希表快一个量级。而且它天然按位并行：一个 64 位整数的一次运算，等于同时处理 64 个布尔值。",
          "这种表示在状态压缩动态规划里是关键前提：当状态本身就是哪些元素已经访问过，用掩码当下标，DP 表从指数个数组变成一个大小为 2^n 的数组，转移写成位运算，代码短且常数小。n 不超过 20 左右时，这往往是唯一现实的做法。即便不做 DP，掩码也常用来表示权限、开关与小集合，比字符串拼接更省也更稳。",
          "代价是字长限制与可读性。32 位整型最多表示 32 个元素，64 位最多 64 个，超出就得换 bitset 或分段。位运算表达式也容易写错，尤其是移位位数、负数右移与运算符优先级，所以能用具名常量表达时不要直接写魔数。调试时把掩码按二进制打印出来，比盯着十进制数猜位快得多。",
        ],
        mechanism: [
          "补码把减法变成加法：-x 的位模式就是 ~x + 1。于是 x & -x 只在最低位的 1 处同时为 1，其余位都被清掉，得到 lowbit；而 x & (x-1) 会把最低位的 1 变成 0、它右边的 0 全变成 1，再与 x 相与，结果是去掉最低位 1 的 x。反复做这一步，循环次数就等于 1 的个数。",
          "集合运算直接对应位运算：并集 a | b、交集 a & b、差集 a & ~b、对称差 a ^ b；判断元素 i 是否在集合里用 (mask >> i) & 1 或 mask & (1 << i)。因为都是单条指令，位掩码集合的常数比布尔数组小得多，缓存也更友好。注意 & 的优先级低于 ==，写判断时一定要加括号，否则 mask & (1 << i) == 0 会先算等号。",
          "枚举 mask 的所有子集时，s = (s - 1) & mask 的意义是把 s 减一，再裁掉 mask 之外的位。从 s = mask 出发一路递减到 0，每次得到的都是 mask 的子集且严格递减，所以不重不漏。所有 mask 的子集总数是 3^n（每个元素三种状态：不在 mask、在 mask 不在子集、在子集），这也是子集 DP 的复杂度来源。",
        ],
        example: {
          title: "C：用无符号整数做位运算与子集枚举",
          language: "c",
          code: "#include <stdio.h>\n\nint is_power_of_two(unsigned x) {\n    return x != 0 && (x & (x - 1)) == 0;   /* 2 的幂只有一个 1；0 要单独排除 */\n}\n\nint count_ones(unsigned x) {\n    int count = 0;\n    while (x) {\n        x &= x - 1;      /* 每轮清掉最低位的 1，循环次数等于 1 的个数 */\n        count++;\n    }\n    return count;\n}\n\nvoid print_submasks(unsigned mask) {\n    unsigned s = mask;\n    for (;;) {\n        printf(\"%u\\n\", s);\n        if (s == 0) break;\n        s = (s - 1) & mask;   /* 减一后裁掉 mask 之外的位 */\n    }\n}\n\nint main(void) {\n    printf(\"%d %d\\n\", is_power_of_two(1024u), is_power_of_two(0u));  /* 1 0 */\n    printf(\"%d\\n\", count_ones(0xb4u));                             /* 4 */\n    print_submasks(0x5u);                                            /* 5 4 1 0 */\n    return 0;\n}",
          explanation:
            "用 unsigned 而不是 int，是因为负数右移与溢出在有符号类型上是实现定义或未定义行为，无符号的取模语义更可预测。is_power_of_two 用 x & (x-1) == 0 判断只有一个 1，同时必须用 x != 0 排除 0——0 与任何数相与都是 0，会被误判成 2 的幂。count_ones 的循环次数等于 1 的个数而不是位数。print_submasks 在 s 变成 0 之后立刻 break，否则 (0 - 1) & mask 会绕回 mask，陷入死循环。",
        },
        practiceSteps: [
          "把代码里的布尔数组标记改成整型掩码，先写好置位、清位、判断三个小函数再替换。",
          "凡是写 1 << k 的地方，确认 k 的上界小于字长；跨语言时尤其要检查默认是 32 位还是 64 位。",
          "用 0、负数、全 1 三个边界输入验证每个位运算函数，并对照暴力实现比较结果。",
        ],
        masteryChecklist: [
          "能解释 x & -x 与 x & (x-1) 的差别，并各举一个用途。",
          "能写出子集枚举模板并说明总复杂度为什么是 3^n。",
          "能说清移位位数超过字长时会发生什么。",
        ],
        summary: [
          "补码让 -x 等于 ~x + 1，于是 x & -x 取最低位 1、x & (x-1) 清最低位 1。",
          "一个整型就是一个集合，与或异或对应交并差。",
          "子集枚举 s = (s-1) & mask，遍历所有 mask 子集的总代价是 3^n。",
          "字长是硬上限：移位位数必须小于字长，负数右移要用无符号版本。",
        ],
        terms: [
          {
            term: "Bitmask",
            plain: "用一个整数的二进制位表示一堆是否选中。",
            detail:
              "第 i 位为 1 就表示元素 i 在集合里。它把集合运算压成一条指令，代价是集合大小受字长限制，且可读性不如数组，需要具名常量辅助。",
          },
          {
            term: "Two's Complement",
            plain: "负数用取反加一表示，让减法可以按加法算。",
            detail:
              "正因为补码，-x 恰好等于 ~x + 1，x & -x 才能取出最低位的 1。注意这是定长整数的性质，Python 的无限精度整数需要额外掩码才等价。",
          },
          {
            term: "lowbit",
            plain: "x & -x 取出的最低位的 1，常用来做树状数组的跳跃。",
            detail:
              "它同时是树状数组下标跳转的核心：i += i & -i 向上更新，i -= i & -i 向下查询，两行代码就完成了区间维护。",
          },
          {
            term: "Bitmask DP",
            plain: "把哪些元素已选压成整数当下标的动态规划。",
            detail:
              "状态数 2^n，适合 n 不超过 20 左右的问题，如旅行商、棋盘覆盖。n 再大就要换搜索剪枝或近似算法。",
          },
        ],
      },
    },
    questions: [
      {
        key: "algorithms-exp-algo-bitmask-s1",
        stageKey: "ds-algo-strategy",
        topicKey: "algo-bitmask",
        type: "single",
        stem: "对非负整数 x，表达式 x & (x - 1) 的作用是？",
        options: [
          { key: "A", text: "取出 x 最低位的 1" },
          { key: "B", text: "把 x 最低位的 1 清零" },
          { key: "C", text: "把 x 左移一位" },
          { key: "D", text: "判断 x 是否为偶数" },
        ],
        answer: ["B"],
        explanation:
          "x - 1 会把最低位的 1 变成 0，并把它右边的 0 全部变成 1，更高位不变；再与 x 相与，最低位那个 1 就消失了，其余位保持原样。所以反复执行这一步的次数恰好等于二进制中 1 的个数。取出最低位 1 的是 x & -x，两者常一起用于位计数与树状数组。",
        difficulty: "medium",
        tags: ["位运算", "lowbit", "位计数"],
        sourceKey: "algorithms-javascript",
        level: "进阶",
      },
      {
        key: "algorithms-exp-algo-bitmask-j1",
        stageKey: "ds-algo-strategy",
        topicKey: "algo-bitmask",
        type: "judge",
        stem: "枚举 mask 的所有子集时，循环写成 s = (s - 1) & mask，可以从 mask 一路递减到 0，既不重复也不遗漏。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "s - 1 把 s 减一，再与 mask 相与，会清掉 mask 之外的位，得到的一定是 mask 的子集且严格小于 s。因此从 mask 出发沿这个序列必然单调递减到 0，既不会重复也不会漏。若只写 s = s - 1 而不与 mask 相与，就会枚举到 mask 之外的位，得到根本不是子集的数。",
        difficulty: "hard",
        tags: ["位运算", "子集枚举", "状态压缩"],
        sourceKey: "coding-interview-university",
        level: "综合",
      },
    ],
  },
];
