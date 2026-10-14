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

/** 算法与数据结构 补充题库（按知识点细分，2 题/知识点）。 */
export const algorithmsSupplementQuestions: LearningQuestion[] = [
  // ===== algo-complexity-basics =====
  singleQuestion({ key: "algorithms-sup-algo-complexity-basics-s1", stageKey: "algo-complexity", topicKey: "algo-complexity-basics",
    stem: "设某算法在输入规模为 n 时，其最内层基本操作的执行次数精确为 3n^2 + 5n + 2。关于该算法时间复杂度的大 O 表示，下列哪项正确？",
    options: ["T(n) 属于 O(n^2)，因为大 O 只保留最高阶项并忽略常数系数", "T(n) 属于 O(3n^2)，常数系数 3 必须保留在记号中", "T(n) 属于 O(n^3)，因为多项式求和要取最高次数加一", "T(n) 属于 O(n)，线性项 5n 决定增长趋势"],
    answer: "A",
    explanation: "大 O 记号描述的是当 n 趋于无穷时的渐近上界，定义要求存在常数 c 与 n0，使对所有 n≥n0 有 T(n)≤c·g(n)。因此只保留增长最快的最高阶项 n^2，并吸收常数系数 3 与低阶项 5n+2，最终记为 O(n^2)。保留系数或取更高阶都是对大 O 定义理解错误。",
    difficulty: "easy", tags: ["复杂度", "大O"], sourceKey: "coding-interview-university", level: "入门" }),
  judgeQuestion({ key: "algorithms-sup-algo-complexity-basics-j1", stageKey: "algo-complexity", topicKey: "algo-complexity-basics",
    stem: "若一个算法的时间复杂度是 O(n^2)，当输入规模 n 翻倍时，运行时间必然恰好变为原来的 4 倍。",
    answer: false,
    explanation: "O(n^2) 只说明存在常数 c 使得实际运行时间 T(n) ≤ c·n^2 在 n 充分大时成立，它给出的是渐近上界而非精确表达式。实际时间常包含低阶项与常数因子，且大 O 不约束具体比例，因此 n 翻倍时运行时间可能小于、等于或大于 4 倍，不能断言必然恰好变为 4 倍。",
    difficulty: "easy", tags: ["复杂度", "大O"], sourceKey: "coding-interview-university", level: "入门" }),

  // ===== algo-space-tradeoff =====
  singleQuestion({ key: "algorithms-sup-algo-space-tradeoff-s1", stageKey: "algo-complexity", topicKey: "algo-space-tradeoff",
    stem: "为了将判断一个整数数组中是否存在重复元素的时间从 O(n^2) 优化到 O(n)，常见做法是额外使用一个哈希表记录已出现的值。这体现了下列哪种算法设计思想？",
    options: ["用增加 O(n) 的额外空间换取时间复杂度的降低，即时空权衡", "用增加时间开销换取代码可读性，与空间无关", "通过减少输入规模来实现线性时间，无需额外空间", "通过降低算法正确性的要求来提升速度"],
    answer: "A",
    explanation: "时空权衡（time-space tradeoff）指通过消耗更多内存（此处为 O(n) 的哈希表）来换取更优的时间复杂度（从 O(n^2) 降到 O(n)）。这是算法设计中典型的以空间换时间策略，核心在于用额外的存储避免重复扫描，而非改变规模或牺牲正确性。",
    difficulty: "medium", tags: ["空间复杂度", "时空权衡"], sourceKey: "coding-interview-university", level: "进阶" }),
  judgeQuestion({ key: "algorithms-sup-algo-space-tradeoff-j1", stageKey: "algo-complexity", topicKey: "algo-space-tradeoff",
    stem: "在算法分析中，原地（in-place）算法意味着其空间复杂度为 O(1)，即完全不使用任何额外的辅助空间。",
    answer: false,
    explanation: "原地算法通常指额外使用的辅助空间为 O(1)（不随输入规模增长），但允许使用固定数量的临时变量或指针等常数级空间，并非绝对零额外空间。像堆排序虽是原地排序，仍会用到常数个临时存储，所以'完全不使用任何额外空间'的说法过于绝对，不符合 O(1) 的渐近定义。",
    difficulty: "medium", tags: ["空间复杂度", "时空权衡"], sourceKey: "coding-interview-university", level: "进阶" }),

  // ===== algo-correctness-invariants =====
  singleQuestion({ key: "algorithms-sup-algo-correctness-invariants-s1", stageKey: "algo-complexity", topicKey: "algo-correctness-invariants",
    stem: "在证明插入排序的循环正确性时，通常将'子数组 arr[0..i-1] 始终是有序的'作为循环不变式。循环不变式需要在循环执行的哪几个关键时刻被验证？",
    options: ["初始化（循环开始前成立）、保持（每轮迭代后保持成立）、终止（循环结束时推导出最终正确性）", "只需要在循环第一次迭代前成立即可", "只需要在循环正常结束时成立即可", "只需要在每次 i 自增的瞬间成立"],
    answer: "A",
    explanation: "根据 Hoare 逻辑，循环不变式正确性证明包含三步：初始化证明循环首轮前不变式成立；保持证明若某轮迭代前成立则迭代后仍成立；终止证明循环结束（终止条件满足）时结合不变式可推出算法的整体正确性。缺任一步都无法严谨保证算法对所有输入正确。",
    difficulty: "medium", tags: ["正确性", "循环不变式"], sourceKey: "algorithms-python", level: "进阶" }),
  judgeQuestion({ key: "algorithms-sup-algo-correctness-invariants-j1", stageKey: "algo-complexity", topicKey: "algo-correctness-invariants",
    stem: "只要一个算法在若干组随机测试用例上都能得到正确结果，就可以从数学上证明该算法对所有可能的输入都正确。",
    answer: false,
    explanation: "有限个测试用例通过只能说明算法在这几个具体输入上行为正确，无法覆盖无穷的输入空间，更不能排除边界或特殊情形下的错误。要严格证明正确性必须使用形式化方法（如循环不变式、数学归纳法或终止性分析），经验性测试不能替代证明。",
    difficulty: "easy", tags: ["正确性", "循环不变式"], sourceKey: "algorithms-python", level: "入门" }),

  // ===== algo-linear =====
  singleQuestion({ key: "algorithms-sup-algo-linear-s1", stageKey: "algo-linear", topicKey: "algo-array-two-pointer",
    stem: "关于数组与链表的线性结构特性，下列哪种描述最符合二者在随机访问与插入删除上的权衡？",
    options: ["数组支持 O(1) 随机访问但中间插入为 O(n)，链表插入删除为 O(1) 但随机访问为 O(n)", "数组与链表随机访问均为 O(1)，差异仅在语言实现", "链表支持 O(1) 随机访问而数组不支持", "数组中间插入为 O(1) 而链表为 O(n)"],
    answer: "A",
    explanation: "数组在内存中连续存放，可由基地址加下标偏移在 O(1) 时间直接定位元素，但在中间插入或删除需移动后续元素，平均 O(n)。链表节点通过指针串联，找到位置后改指针即可 O(1) 插入删除，但访问第 k 个元素须从头遍历，故随机访问为 O(n)。两者特性差异源于存储方式而非语言。",
    difficulty: "easy", tags: ["线性结构", "数组", "链表"], sourceKey: "algorithms-javascript", level: "入门" }),
  judgeQuestion({ key: "algorithms-sup-algo-linear-j1", stageKey: "algo-linear", topicKey: "algo-array-two-pointer",
    stem: "在单链表中，若已知某节点 cur 的指针（且该节点不是尾节点），则在 cur 之后插入一个新节点的时间复杂度是 O(1)。",
    answer: true,
    explanation: "已知节点 cur 时，插入只需令新节点的 next 指向 cur.next，再令 cur.next 指向新节点，仅涉及常数次指针赋值，与链表长度无关，因此时间复杂度为 O(1)。注意这依赖于已经持有目标节点的引用；若要从头查找位置则另需 O(n)。",
    difficulty: "easy", tags: ["线性结构", "链表"], sourceKey: "algorithms-javascript", level: "入门" }),

  // ===== algo-array-two-pointer =====
  singleQuestion({ key: "algorithms-sup-algo-array-two-pointer-s1", stageKey: "algo-linear", topicKey: "algo-array-two-pointer",
    stem: "给定一个已按升序排序的数组 nums 与一个目标值 target，要求找出两个数使其和为 target。使用双指针（左指针 i 从头部、右指针 j 从尾部向中间靠拢）的方法，其时间复杂度与空间复杂度分别为？",
    options: ["时间 O(n)、空间 O(1)，因为只需一次线性扫描且常数额外空间", "时间 O(n log n)、空间 O(n)，因为要先排序", "时间 O(n^2)、空间 O(1)，因为需要双重循环", "时间 O(1)、空间 O(n)，因为要缓存所有元素"],
    answer: "A",
    explanation: "数组已排序，左指针 i 与右指针 j 根据当前和与 target 的大小决定移动方向：和偏大则 j 左移，偏小则 i 右移，每步至少缩小一个区间，最多 n 次移动即收敛，故时间 O(n)。全程只用两个指针变量，额外空间 O(1)。该方法优于哈希法的 O(n) 空间，前提正是输入有序。",
    difficulty: "medium", tags: ["数组", "双指针", "滑动窗口"], sourceKey: "algorithms-python", level: "进阶" }),
  judgeQuestion({ key: "algorithms-sup-algo-array-two-pointer-j1", stageKey: "algo-linear", topicKey: "algo-array-two-pointer",
    stem: "滑动窗口技术只能用于解决子数组的最大/最小和问题，无法处理涉及字符或元素的出现频率类问题。",
    answer: false,
    explanation: "滑动窗口是维护一个随左右边界移动而动态更新的区间的通用技术，既可处理数值型子数组和，也广泛用于子串问题，例如求包含所有字符的最小覆盖子串、无重复字符的最长子串等，这类问题正是通过窗口内频率表的状态变化来判定的。因此'只能用于和'的表述明显错误。",
    difficulty: "medium", tags: ["数组", "滑动窗口"], sourceKey: "algorithms-python", level: "进阶" }),

  // ===== algo-linked-list =====
  singleQuestion({ key: "algorithms-sup-algo-linked-list-s1", stageKey: "algo-linear", topicKey: "algo-linked-list",
    stem: "在单链表中检测是否存在环（cycle），Floyd 判圈算法（快慢指针）的核心思想是？",
    options: ["慢指针每次走 1 步、快指针每次走 2 步，若存在环则二者必在环内相遇，否则快指针先到达尾部", "同时用两个慢指针从两端遍历并在中间汇合", "先反转链表再与原表比较是否一致", "用哈希表记录每个节点地址，遇到重复即说明有环"],
    answer: "A",
    explanation: "Floyd 判圈法让快指针速度为慢指针两倍。若无环，快指针会先抵达 null 结尾；若有环，快指针进入环后会在环内以相对速度 1 追上慢指针，二者必然相遇。该方法空间复杂度 O(1)，优于用哈希表记录访问节点的 O(n) 解法，是链表环检测的经典方案。",
    difficulty: "medium", tags: ["链表", "指针操作"], sourceKey: "algorithms-java", level: "进阶" }),
  judgeQuestion({ key: "algorithms-sup-algo-linked-list-j1", stageKey: "algo-linear", topicKey: "algo-linked-list",
    stem: "反转单链表时，若在遍历中直接执行 cur.next = prev 而不先用临时变量保存 cur.next 原值，会导致后续节点丢失、链表断裂。",
    answer: true,
    explanation: "反转需要将当前节点 cur 的 next 指向其前驱 prev，但此操作会覆盖 cur.next 中原本指向下一个节点的引用。若不事先用 next = cur.next 暂存，下一步就无法继续前进到原后继，整个链表自该处起断裂。因此标准迭代反转必须先保存后继指针再改接。",
    difficulty: "medium", tags: ["链表", "指针操作"], sourceKey: "algorithms-java", level: "进阶" }),

  // ===== algo-stack-queue =====
  singleQuestion({ key: "algorithms-sup-algo-stack-queue-s1", stageKey: "algo-linear", topicKey: "algo-stack-queue",
    stem: "表达式求值中，判断一个字符串里的括号是否配对正确（如 '({[]})' 合法、'(]' 非法），最适合使用下列哪种数据结构？",
    options: ["栈，遇到左括号入栈、遇到右括号时与栈顶左括号匹配并出栈", "队列，按到达顺序依次比较", "散列表，记录括号出现次数", "堆，按优先级排序括号"],
    answer: "A",
    explanation: "括号匹配具有最近嵌套、后进先出的特性：最新遇到的未匹配左括号必须最先被对应右括号闭合。栈恰好满足 LIFO，遇到左括号压栈，遇到右括号则检查栈顶是否为其配对左括号，是则弹出，否则不合法；结束后栈空才说明完全匹配。队列的 FIFO 特性无法表达这种嵌套关系。",
    difficulty: "easy", tags: ["栈", "队列"], sourceKey: "algorithms-go", level: "入门" }),
  judgeQuestion({ key: "algorithms-sup-algo-stack-queue-j1", stageKey: "algo-linear", topicKey: "algo-stack-queue",
    stem: "单调栈（monotonic stack）常用于在线性时间内求解'每个元素左边/右边第一个比它大/小的元素'类问题。",
    answer: true,
    explanation: "单调栈在遍历时始终保持栈内元素单调递增或递减。以找右侧第一个更大元素为例，遇到更小元素压栈，遇到更大元素则不断弹出栈顶（这些被弹元素找到了它们的'第一个更大右元素'）。每个元素最多入栈出栈一次，整体 O(n)，是此类最近极值问题的标准高效解法。",
    difficulty: "medium", tags: ["栈", "单调结构"], sourceKey: "algorithms-go", level: "进阶" }),

  // ===== algo-hash-tree =====
  singleQuestion({ key: "algorithms-sup-algo-hash-tree-s1", stageKey: "algo-hash-tree", topicKey: "algo-hash-table",
    stem: "关于散列（hashing）与树（tree）两类查找结构，下列关于其平均性能的对比哪项正确？",
    options: ["理想哈希表平均查找为 O(1)，而平衡二叉搜索树查找为 O(log n)，但哈希无法维持有序遍历", "平衡树查找为 O(1) 而哈希为 O(log n)", "二者平均查找都是 O(n)", "哈希表能天然支持范围查询与有序中序遍历"],
    answer: "A",
    explanation: "在均匀散列、冲突可控时，哈希表通过哈希函数直接定位桶，平均查找与插入为 O(1)。平衡二叉搜索树（如红黑树、AVL）依赖树高维持有序性，查找、插入、删除均为 O(log n)。代价是哈希表丢失了元素间的序关系，难以高效做范围查询与有序遍历，而树结构天然支持中序遍历得到有序序列。",
    difficulty: "medium", tags: ["散列", "树"], sourceKey: "algorithms-python", level: "进阶" }),
  judgeQuestion({ key: "algorithms-sup-algo-hash-tree-j1", stageKey: "algo-hash-tree", topicKey: "algo-hash-table",
    stem: "二叉搜索树（BST）的中序遍历结果一定是严格递增的序列，无论该 BST 是否平衡。",
    answer: true,
    explanation: "二叉搜索树的定义即对任意节点，其左子树所有节点值小于该节点值、右子树所有节点值大于该节点值。中序遍历顺序为'左—根—右'，按此定义递归展开后，遍历到的键值必然从小到大单调递增（假设无重复键）。该性质只依赖 BST 的序定义，与树是否平衡、高度如何无关。",
    difficulty: "easy", tags: ["树", "遍历"], sourceKey: "algorithms-python", level: "入门" }),

  // ===== algo-hash-table =====
  singleQuestion({ key: "algorithms-sup-algo-hash-table-s1", stageKey: "algo-hash-tree", topicKey: "algo-hash-table",
    stem: "开放寻址（open addressing）与链地址（separate chaining）是哈希表处理冲突的两种主要策略。关于装载因子 α（已存元素数/桶数）对平均查找长度的影响，下列哪项正确？",
    options: ["链地址法平均查找约为 1 + α/2；开放寻址（线性探测）平均查找随 α 增大显著上升，接近 1 时急剧恶化", "二者平均查找都恒为 O(1) 且与 α 无关", "开放寻址性能优于链地址且不受 α 影响", "链地址法要求 α 必须小于 0.5 否则无法工作"],
    answer: "A",
    explanation: "在均匀哈希假设下，链地址法成功查找平均约需 1+α/2 次比较。开放寻址（如线性探测）因聚集效应，平均探查次数约为 (1/2)(1+1/(1-α))，当 α 接近 1 时分母趋于 0，探查次数趋于无穷，性能急剧下降。因此开放寻址对装载因子更敏感，实践中常需扩容以维持低 α。",
    difficulty: "hard", tags: ["哈希表", "冲突处理"], sourceKey: "algorithms-javascript", level: "综合" }),
  judgeQuestion({ key: "algorithms-sup-algo-hash-table-j1", stageKey: "algo-hash-tree", topicKey: "algo-hash-table",
    stem: "使用链地址法解决冲突的哈希表，即使所有元素都被哈希到同一个桶中，查找操作也至多退化为 O(n) 的链表遍历，而不会发生数据丢失。",
    answer: true,
    explanation: "链地址法把冲突元素挂在同一桶的链表（或树）上，而非覆盖原有数据。最坏情况下所有键都映射到同一桶，该桶退化为长度 n 的链表，查找需遍历全部元素，时间 O(n)，但每个元素都被保留、不会丢失。这与开放寻址中节点被覆盖或需探测不同，因此表述正确。",
    difficulty: "medium", tags: ["哈希表", "冲突处理"], sourceKey: "algorithms-javascript", level: "进阶" }),

  // ===== algo-binary-search =====
  singleQuestion({ key: "algorithms-sup-algo-binary-search-s1", stageKey: "algo-hash-tree", topicKey: "algo-binary-search",
    stem: "在一个升序数组中使用二分查找目标值 x，循环不变量常设定为'答案一定落在闭区间 [left, right] 内'。若采用 left=0, right=n-1 且循环条件为 left<=right、mid=(left+right)/2，当 nums[mid]<x 时应如何更新？",
    options: ["令 left = mid + 1，因为 mid 已确认小于 x，答案必在右侧", "令 right = mid - 1，因为要向左收缩", "令 left = mid，保留 mid 再次判断", "令 right = mid，保留 mid 再次判断"],
    answer: "A",
    explanation: "由于数组升序且 nums[mid] < x，mid 及其左侧都不可能等于 x，故可安全地将搜索区间收缩到 [mid+1, right]，即 left = mid+1。若写成 left = mid 在 left==right-1 且仍不满足时会陷入死循环；写成向右收缩更与逻辑相反。该更新方式配合 left<=right 能正确收敛到目标或返回未找到。",
    difficulty: "medium", tags: ["二分查找", "边界"], sourceKey: "coding-interview-university", level: "进阶" }),
  judgeQuestion({ key: "algorithms-sup-algo-binary-search-j1", stageKey: "algo-hash-tree", topicKey: "algo-binary-search",
    stem: "二分查找只能用于查找某个具体值是否存在，不能用来在一个单调函数或有序数组中寻找'第一个满足条件的位置'等边界问题。",
    answer: false,
    explanation: "二分查找的本质是在满足某种单调性的判定函数上缩小区间，因此不仅可查具体值，也能求解'第一个≥x 的位置''最后一个≤x 的位置''满足某条件的最小下标'等边界问题。关键是把'条件成立'作为单调性判据，通过调整左右边界（如 left=mid+1 或 right=mid）在循环结束后得到边界，这是二分的标准拓展用法。",
    difficulty: "medium", tags: ["二分查找", "边界"], sourceKey: "coding-interview-university", level: "进阶" }),

  // ===== algo-tree-traversal =====
  singleQuestion({ key: "algorithms-sup-algo-tree-traversal-s1", stageKey: "algo-hash-tree", topicKey: "algo-tree-traversal",
    stem: "对二叉树进行前序（根左右）、中序（左根右）、后序（左右根）三种递归遍历，它们的主要区别在于？",
    options: ["仅在于访问根节点的时机不同，左、右子树的递归顺序一致", "三种遍历访问左右子树的顺序完全不同", "只有迭代写法才需要栈，递归写法不需要", "前序遍历不需要递归而中序后序必须递归"],
    answer: "A",
    explanation: "三种遍历对左子树和右子树的递归调用顺序始终相同（先左后右），区别仅在于'何时访问（打印/处理）根节点'：前序在递归左右之前访问根，中序在左右之间访问，后序在左右之后访问。因此递归实现结构高度相似，仅语句排列不同；栈只是递归隐式调用栈的显式化，并非迭代独有。",
    difficulty: "easy", tags: ["二叉树", "递归", "遍历"], sourceKey: "algorithms-python", level: "入门" }),
  judgeQuestion({ key: "algorithms-sup-algo-tree-traversal-j1", stageKey: "algo-hash-tree", topicKey: "algo-tree-traversal",
    stem: "给定一棵二叉树的中序遍历序列和前序遍历序列，就能唯一确定这棵二叉树的结构（假设节点值互不相同）。",
    answer: true,
    explanation: "前序序列的第一个元素即为根节点；在中序序列中找到该根，其左侧为左子树、右侧为右子树，由此可递归地用对应的前序子段与中序子段继续划分左右子树，从而唯一重建整棵树。类似地，中序加后序也能唯一确定。但若仅有前序与后序（缺中序）则一般无法唯一确定结构。",
    difficulty: "medium", tags: ["二叉树", "遍历"], sourceKey: "algorithms-python", level: "进阶" }),

  // ===== algo-sort-graph =====
  singleQuestion({ key: "algorithms-sup-algo-sort-graph-s1", stageKey: "algo-sort-graph", topicKey: "algo-sorting",
    stem: "拓扑排序（topological sort）用于有向无环图（DAG），常借助队列按入度逐步剥离节点。下列哪种情形会导致拓扑排序无法得到完整序列？",
    options: ["图中存在有向环，因为环内节点入度永远无法降为零", "图中节点数超过 1000 个", "图是连通的", "边是用邻接表而非邻接矩阵存储"],
    answer: "A",
    explanation: "拓扑排序要求图中无环：算法反复选取入度为 0 的节点输出并将其出边指向的节点入度减一。若图中存在有向环，环上每个节点的入度始终被环内其他节点维持，永远不会降到 0，最终剩余未输出节点，排序失败。节点规模、连通性、存储结构都不影响能否完成，只有环会导致无解。",
    difficulty: "medium", tags: ["图", "拓扑排序", "策略"], sourceKey: "algorithms-go", level: "进阶" }),
  judgeQuestion({ key: "algorithms-sup-algo-sort-graph-j1", stageKey: "algo-sort-graph", topicKey: "algo-sorting",
    stem: "贪心策略在求解所有最优化问题时都能保证得到全局最优解，因此遇到'求最大/最小'类问题应优先一律使用贪心。",
    answer: false,
    explanation: "贪心只在问题具备贪心选择性质与最优子结构时才能保证全局最优（如活动选择、最小生成树的 Kruskal/Prim、霍夫曼编码）。许多问题（如 0-1 背包、最长子序列相关最优化）局部最优并不导致全局最优，必须用动态规划或回溯。盲目使用贪心会得到错误结果，应先用反例验证贪心性质是否成立。",
    difficulty: "medium", tags: ["图", "策略", "贪心"], sourceKey: "algorithms-go", level: "进阶" }),

  // ===== algo-sorting =====
  singleQuestion({ key: "algorithms-sup-algo-sorting-s1", stageKey: "algo-sort-graph", topicKey: "algo-sorting",
    stem: "关于排序算法的稳定性（相等元素在排序后保持原有相对次序），下列哪种说法正确？",
    options: ["归并排序是稳定的，而快速排序通常不稳定", "快速排序是稳定的，而归并排序不稳定", "堆排序是稳定的", "所有时间复杂度为 O(n log n) 的比较排序都必然是稳定的"],
    answer: "A",
    explanation: "稳定性取决于相等元素是否可能被交换到彼此前面。归并排序在合并两个有序段时，遇到相等元素先取左段（原序列靠前）的元素，故保持相对次序，是稳定的。快速排序的 partition 通过交换把元素跨区挪动，容易破坏相等元素的原有次序，通常不稳定；堆排序的堆调整同样会跨层交换，也不稳定。可见 O(n log n) 与稳定性并无必然联系。",
    difficulty: "medium", tags: ["排序", "稳定性"], sourceKey: "algorithms-java", level: "进阶" }),
  judgeQuestion({ key: "algorithms-sup-algo-sorting-j1", stageKey: "algo-sort-graph", topicKey: "algo-sorting",
    stem: "计数排序、桶排序、基数排序属于非比较排序，其时间复杂度可以低于 O(n log n) 的下界，因为它们利用了键值的分布特征而非仅做两两比较。",
    answer: true,
    explanation: "基于比较的排序在最坏情况下存在 Ω(n log n) 的信息论下界。计数/桶/基数排序不依赖元素间比较，而是借助键值的范围、分布或位数等额外信息直接定位，因而可达 O(n+k) 或 O(n) 级别线性时间。代价是需要整数键或有限值域等前提，且可能消耗额外空间，这正是它们突破比较排序下界的原因。",
    difficulty: "hard", tags: ["排序", "非比较排序"], sourceKey: "algorithms-java", level: "综合" }),

  // ===== algo-graph-search =====
  singleQuestion({ key: "algorithms-sup-algo-graph-search-s1", stageKey: "algo-sort-graph", topicKey: "algo-graph-search",
    stem: "在带非负权重的图中求单源最短路径，Dijkstra 算法与广度优先搜索（BFS）的关系是？",
    options: ["Dijkstra 是 BFS 在加权图上的推广：当所有边权均为 1 时，Dijkstra 退化为 BFS", "BFS 总能求出带权图最短路径，Dijkstra 仅用于无权图", "二者毫无关系，Dijkstra 基于队列而 BFS 基于优先队列", "Dijkstra 只能处理负权边而 BFS 不能"],
    answer: "A",
    explanation: "BFS 按层扩展，每步代价恰为 1，适合无权图的最短路径。Dijkstra 用优先队列每次取出当前距离最小的节点并松弛邻居，本质是依'距离'而非'层数'扩展。当所有边权为 1 时，距离最小的顺序与 BFS 的层序一致，Dijkstra 即退化为 BFS。需要强调的是 Dijkstra 要求非负权，负权需用 Bellman-Ford。",
    difficulty: "medium", tags: ["图", "最短路", "遍历"], sourceKey: "system-design-primer", level: "进阶" }),
  judgeQuestion({ key: "algorithms-sup-algo-graph-search-j1", stageKey: "algo-sort-graph", topicKey: "algo-graph-search",
    stem: "深度优先搜索（DFS）使用栈（显式或递归调用栈）推进，而广度优先搜索（BFS）使用队列，因此 DFS 适合探索图的深度方向、BFS 适合求无权图的最短路径。",
    answer: true,
    explanation: "DFS 沿一条分支尽可能深入再回溯，适合连通性、环检测、拓扑排序、路径存在性等问题；BFS 借助队列按距离逐层扩展，第一次到达某节点时经过的边数最少，因此天然适合求无权（或单位权）图的最短路径。二者核心差异正在于所用容器（栈 vs 队列）带来的扩展顺序不同。",
    difficulty: "easy", tags: ["图", "DFS", "BFS"], sourceKey: "system-design-primer", level: "入门" }),

  // ===== algo-dp-greedy =====
  singleQuestion({ key: "algorithms-sup-algo-dp-greedy-s1", stageKey: "algo-sort-graph", topicKey: "algo-dp-greedy",
    stem: "动态规划（DP）与分治（divide and conquer）都通过子问题求解原问题，但二者的关键区别在于？",
    options: ["DP 的子问题之间存在重叠，且通过记忆化/表格避免重复计算；分治的子问题通常相互独立、不重叠", "分治使用递归而 DP 只能使用迭代", "DP 只能解最优化问题，分治不能", "二者没有任何区别，只是叫法不同"],
    answer: "A",
    explanation: "动态规划适用于具有重叠子问题与最优子结构的问题：同一子问题会被反复求解，因此用数组或哈希表记忆结果以避免指数级重复计算（如斐波那契、最长公共子序列）。分治（如归并排序、快速排序）将问题拆成互不相交的子问题，分别求解后合并，子问题间一般不重叠，故无需记忆化。是否重叠是二者本质区别，与递归/迭代实现方式无关。",
    difficulty: "hard", tags: ["动态规划", "贪心", "分治"], sourceKey: "algorithms-python", level: "综合" }),
  judgeQuestion({ key: "algorithms-sup-algo-dp-greedy-j1", stageKey: "algo-sort-graph", topicKey: "algo-dp-greedy",
    stem: "在 0-1 背包问题中，若用'单位重量价值最高者优先装入'的贪心策略，必然能得到总重量不超过容量限制下的最大总价值。",
    answer: false,
    explanation: "0-1 背包要求整件物品取舍，不能分割。贪心按单位价值优先装填可能在容量剩余不足一件高价值物品时，被迫装入大量低价值小件，而最优解也许是放弃该高价值件、改用几件中等件组合出更高总值。经典反例说明 0-1 背包不具备单纯贪心选择性质，必须用动态规划才能保证全局最优。",
    difficulty: "medium", tags: ["动态规划", "贪心", "背包"], sourceKey: "algorithms-python", level: "进阶" })
];
