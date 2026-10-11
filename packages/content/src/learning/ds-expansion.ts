/**
 * 数据结构扩容内容包（算法与数据结构课程 · DS 十章）。
 *
 * 由 `scripts/ds-bank/generate.mjs` 生成，请勿手改。知识点独有内容来自 scripts/ds-bank/stages-*.mjs，
 * 学法脚手架由生成器补齐；动图 key 见 `algorithm-animations.ts`。
 */
import { judgeQuestion, singleQuestion } from "./question-builders";
import type { LearningQuestion, LearningStage } from "./types";

export const dsExpansionQuestions: LearningQuestion[] = [
  singleQuestion({
    key: "ds-sequence-list-single",
    stageKey: "ds-linear-list",
    topicKey: "ds-sequence-list",
    stem: "长度为 n 的顺序表，在等概率下任意位置插入一个元素，平均需要移动多少个元素？",
    options: ["n","n/2","n/3","1"],
    answer: "B",
    explanation: "共有 n+1 个可插入位置，第 i 个位置需移动 n-i 个元素，求和后平均为 n/2。",
    difficulty: "medium",
    tags: ["顺序表","复杂度"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-sequence-list-judge",
    stageKey: "ds-linear-list",
    topicKey: "ds-sequence-list",
    stem: "顺序表按下标随机访问的时间复杂度是 O(1)，与表长无关。",
    answer: true,
    explanation: "地址由「首地址 + 下标 × 元素大小」直接算出，不需要遍历，所以是常数时间。",
    difficulty: "easy",
    tags: ["顺序表","随机访问"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-singly-linked-single",
    stageKey: "ds-linear-list",
    topicKey: "ds-singly-linked",
    stem: "在单链表中，已知结点 p，要在 p 之后插入结点 s，正确的语句顺序是？",
    options: ["p->next = s; s->next = p->next;","s->next = p->next; p->next = s;","s->next = p; p->next = s;","p->next = s->next; s->next = p;"],
    answer: "B",
    explanation: "必须先把 s 指向 p 原来的后继，再让 p 指向 s，否则 p 原来的后继会丢失。",
    difficulty: "easy",
    tags: ["单链表","插入"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-singly-linked-judge",
    stageKey: "ds-linear-list",
    topicKey: "ds-singly-linked",
    stem: "单链表按序号查找第 i 个结点，时间复杂度为 O(n)。",
    answer: true,
    explanation: "链表不支持随机访问，只能从头指针沿 next 逐个走 i 步，最坏代价与表长成正比。",
    difficulty: "easy",
    tags: ["单链表","查找"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-double-linked-single",
    stageKey: "ds-linear-list",
    topicKey: "ds-double-linked",
    stem: "在双向链表中删除已知结点 p，需要修改的指针有？",
    options: ["1 个","2 个","4 个","不需要修改指针"],
    answer: "B",
    explanation: "只需让 p 的前驱指向 p 的后继、p 的后继指回 p 的前驱，共两条指针。",
    difficulty: "easy",
    tags: ["双向链表","删除"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-double-linked-judge",
    stageKey: "ds-linear-list",
    topicKey: "ds-double-linked",
    stem: "带头结点的循环双链表为空表的判断条件是 head->next == head。",
    answer: true,
    explanation: "循环链表中没有 NULL 结尾，空表的标志是头结点的 next（与 prior）都指回自己。",
    difficulty: "medium",
    tags: ["循环链表","判空"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-static-linked-single",
    stageKey: "ds-linear-list",
    topicKey: "ds-static-linked",
    stem: "静态链表中的 next 域存放的是？",
    options: ["下一个结点的地址","下一个结点在数组中的下标","结点个数","元素值"],
    answer: "B",
    explanation: "静态链表没有真实指针，用数组下标（游标）表示下一个结点的位置。",
    difficulty: "easy",
    tags: ["静态链表"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-static-linked-judge",
    stageKey: "ds-linear-list",
    topicKey: "ds-static-linked",
    stem: "静态链表相比动态链表的主要限制是容量固定、需要预先分配数组。",
    answer: true,
    explanation: "它复用数组空间，因此最大长度在定义时就确定了，不能像动态链表那样按需申请结点。",
    difficulty: "easy",
    tags: ["静态链表","容量"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-stack-basic-single",
    stageKey: "ds-stack-queue",
    topicKey: "ds-stack-basic",
    stem: "元素按 a, b, c, d 依次进栈，则下列哪个出栈序列是不可能的？",
    options: ["d, c, b, a","a, b, c, d","c, d, b, a","d, b, c, a"],
    answer: "D",
    explanation: "d 先出栈说明 a,b,c 都已在栈中，此时栈内自顶向下为 c,b,a，出到 b 之后栈顶是 a，不可能接着出 c。",
    difficulty: "medium",
    tags: ["栈","出栈序列"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-stack-basic-judge",
    stageKey: "ds-stack-queue",
    topicKey: "ds-stack-basic",
    stem: "栈的插入和删除操作都只允许在同一端进行，因此 push 和 pop 的时间复杂度都是 O(1)。",
    answer: true,
    explanation: "栈顶位置由 top 直接指示，进栈出栈都只改 top 与一个元素，与元素个数无关。",
    difficulty: "easy",
    tags: ["栈","复杂度"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-stack-application-single",
    stageKey: "ds-stack-queue",
    topicKey: "ds-stack-application",
    stem: "用栈检查括号匹配，扫描结束后判断「合法」的条件是？",
    options: ["栈为空","栈非空","栈中元素个数为 1","任意情况都合法"],
    answer: "A",
    explanation: "每个左括号都要有对应的右括号弹出，因此扫描结束后栈必须为空才说明完全配对。",
    difficulty: "easy",
    tags: ["栈","括号匹配"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-stack-application-judge",
    stageKey: "ds-stack-queue",
    topicKey: "ds-stack-application",
    stem: "后缀表达式（逆波兰式）求值时不需要考虑运算符优先级，直接用一个操作数栈即可。",
    answer: true,
    explanation: "后缀式已经把运算次序编码进了序列顺序，求值只会遇到「遇到运算符就取栈顶两个操作数」。",
    difficulty: "medium",
    tags: ["表达式求值","后缀式"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-queue-basic-single",
    stageKey: "ds-stack-queue",
    topicKey: "ds-queue-basic",
    stem: "容量为 M 的循环队列，采用「牺牲一个单元」的方式判满，条件是？",
    options: ["rear == front","(rear + 1) % M == front","rear == M - 1","front == 0"],
    answer: "B",
    explanation: "队尾再前进一格就会与队头重合时即认为满，用取模保证环状判断的正确性。",
    difficulty: "medium",
    tags: ["循环队列","判满"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-queue-basic-judge",
    stageKey: "ds-stack-queue",
    topicKey: "ds-queue-basic",
    stem: "顺序队列出现「假溢出」是因为出队后空出的单元无法被再次利用。",
    answer: true,
    explanation: "front 单向后移会留下前面已空出的位置，看起来队列满实际上前面有空位，用循环队列即可复用。",
    difficulty: "medium",
    tags: ["队列","假溢出"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-deque-application-single",
    stageKey: "ds-stack-queue",
    topicKey: "ds-deque-application",
    stem: "长度为 n 的数组求每个长度为 k 的滑动窗口最大值，用单调队列的时间复杂度是？",
    options: ["O(nk)","O(n log k)","O(n)","O(k²)"],
    answer: "C",
    explanation: "每个下标最多进出队一次，总操作次数与 n 成正比，所以是 O(n)。",
    difficulty: "medium",
    tags: ["单调队列","滑动窗口"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-deque-application-judge",
    stageKey: "ds-stack-queue",
    topicKey: "ds-deque-application",
    stem: "BFS 在结点入队时就标记「已访问」，可以避免同一结点被重复入队。",
    answer: true,
    explanation: "出队时才标记会让结点在入队到出队之间被多次加入队列，导致队列膨胀与复杂度退化。",
    difficulty: "easy",
    tags: ["BFS","标记"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-string-basic-single",
    stageKey: "ds-string",
    topicKey: "ds-string-basic",
    stem: "关于串，下列说法正确的是？",
    options: ["空串就是空格串","串是字符的有限序列","串的长度由存储空间决定","串无法比较大小"],
    answer: "B",
    explanation: "串是有限字符序列；空串长度为 0，与由一个空格组成的空格串不是同一个串。",
    difficulty: "easy",
    tags: ["串","基本概念"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-string-basic-judge",
    stageKey: "ds-string",
    topicKey: "ds-string-basic",
    stem: "堆分配存储的串，其长度可以随内容变化，不会像定长顺序存储那样被截断。",
    answer: true,
    explanation: "堆分配按实际长度申请空间，长度变化时重新分配即可，因此更灵活。",
    difficulty: "easy",
    tags: ["串","存储结构"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-bf-kmp-single",
    stageKey: "ds-string",
    topicKey: "ds-bf-kmp",
    stem: "朴素模式匹配（BF）算法的最坏时间复杂度是？",
    options: ["O(n)","O(m)","O(n + m)","O(n × m)"],
    answer: "D",
    explanation: "每次失配主串指针都要回退，最坏情况（如主串全 a、模式串形如 aaab）每轮都几乎比完，总量与 n×m 成正比。",
    difficulty: "medium",
    tags: ["BF","模式匹配"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-bf-kmp-judge",
    stageKey: "ds-string",
    topicKey: "ds-bf-kmp",
    stem: "KMP 算法在匹配过程中，主串的扫描指针不需要回退。",
    answer: true,
    explanation: "KMP 利用 next 数组把回退放在模式串一侧，主串指针始终单向前进，因此总代价是 O(n+m)。",
    difficulty: "easy",
    tags: ["KMP","指针回退"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-kmp-next-single",
    stageKey: "ds-string",
    topicKey: "ds-kmp-next",
    stem: "模式串为 \"ababaa\" 时，其第 5 个字符（下标从 1 计）之前的子串 \"abab\" 的最长相等前后缀长度是？",
    options: ["0","1","2","3"],
    answer: "C",
    explanation: "\"abab\" 的前缀 {a, ab, aba} 与后缀 {b, ab, bab} 中相同的只有 \"ab\"，长度为 2。",
    difficulty: "medium",
    tags: ["KMP","next"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-kmp-next-judge",
    stageKey: "ds-string",
    topicKey: "ds-kmp-next",
    stem: "next 数组只取决于模式串本身，与主串内容无关。",
    answer: true,
    explanation: "它刻画的是模式串自身的相等前后缀结构，因此可以预处理一次，在主串上反复使用。",
    difficulty: "easy",
    tags: ["KMP","预处理"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-tree-concept-single",
    stageKey: "ds-tree-basic",
    topicKey: "ds-tree-concept",
    stem: "一棵有 n 个结点的树，其边的条数是？",
    options: ["n","n - 1","n + 1","2n"],
    answer: "B",
    explanation: "除根结点外每个结点恰有一条连向双亲的边，所以边数 = n - 1。",
    difficulty: "easy",
    tags: ["树","边数"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-tree-concept-judge",
    stageKey: "ds-tree-basic",
    topicKey: "ds-tree-concept",
    stem: "度为 3 的树中，第 3 层最多有 9 个结点。",
    answer: true,
    explanation: "第 i 层最多 k^(i-1) 个结点，k=3、i=3 时为 3² = 9。",
    difficulty: "medium",
    tags: ["树","层次"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-binary-tree-props-single",
    stageKey: "ds-tree-basic",
    topicKey: "ds-binary-tree-props",
    stem: "一棵二叉树中叶子结点数为 n0、度为 2 的结点数为 n2，则三者关系是？",
    options: ["n0 = n2","n0 = n2 + 1","n2 = n0 + 1","无法确定"],
    answer: "B",
    explanation: "由边数关系 n0 + n1 + n2 - 1 = n1 + 2·n2 可推出 n0 = n2 + 1。",
    difficulty: "medium",
    tags: ["二叉树","性质"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-binary-tree-props-judge",
    stageKey: "ds-tree-basic",
    topicKey: "ds-binary-tree-props",
    stem: "n 个结点的完全二叉树用顺序存储时，结点 i 的右孩子下标为 2i + 1。",
    answer: true,
    explanation: "完全二叉树按层序编号后，左右孩子分别是 2i 与 2i+1，双亲是 ⌊i/2⌋。",
    difficulty: "easy",
    tags: ["完全二叉树","顺序存储"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-binary-tree-traverse-single",
    stageKey: "ds-tree-basic",
    topicKey: "ds-binary-tree-traverse",
    stem: "已知一棵二叉树的先序序列与中序序列，能否唯一确定这棵二叉树？",
    options: ["不能","能","只有满二叉树能","只有完全二叉树能"],
    answer: "B",
    explanation: "先序提供根、中序划分左右子树，递归即可唯一还原；但先序加后序无法区分左右子树。",
    difficulty: "medium",
    tags: ["二叉树","遍历还原"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-binary-tree-traverse-judge",
    stageKey: "ds-tree-basic",
    topicKey: "ds-binary-tree-traverse",
    stem: "二叉排序树的中序遍历序列是递增有序的。",
    answer: true,
    explanation: "BST 满足左子树 < 根 < 右子树，中序恰好「左—根—右」，因此输出天然有序。",
    difficulty: "easy",
    tags: ["二叉排序树","中序"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-threaded-tree-single",
    stageKey: "ds-tree-basic",
    topicKey: "ds-threaded-tree",
    stem: "n 个结点的二叉链表中，空指针域的个数是？",
    options: ["n","n + 1","2n","n - 1"],
    answer: "B",
    explanation: "每个结点有两个指针域共 2n 个，其中 n-1 个用于连边（除根外每个结点被指一次），故空域为 2n-(n-1)=n+1。",
    difficulty: "medium",
    tags: ["线索二叉树","空指针域"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-threaded-tree-judge",
    stageKey: "ds-tree-basic",
    topicKey: "ds-threaded-tree",
    stem: "中序线索二叉树可以在 O(1) 额外空间下完成中序遍历，无需栈或递归。",
    answer: true,
    explanation: "后继信息已经被写进右空域（或由右子树最左结点直接算出），因此遍历只需一个当前指针。",
    difficulty: "medium",
    tags: ["线索二叉树","遍历"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-bst-single",
    stageKey: "ds-tree-search",
    topicKey: "ds-bst",
    stem: "对二叉排序树进行哪种遍历可以得到递增有序序列？",
    options: ["先序","中序","后序","层序"],
    answer: "B",
    explanation: "BST 满足左子树 < 根 < 右子树，中序遍历按「左—根—右」访问即得递增序列。",
    difficulty: "easy",
    tags: ["BST","中序"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-bst-judge",
    stageKey: "ds-tree-search",
    topicKey: "ds-bst",
    stem: "按 1,2,3,4,5 的顺序依次插入构造二叉排序树，得到的树高是 5（单支树）。",
    answer: true,
    explanation: "有序输入下每次都插到最右，树退化为一条链，高度为 n，此时查找退化到 O(n)。",
    difficulty: "medium",
    tags: ["BST","退化"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-avl-single",
    stageKey: "ds-tree-search",
    topicKey: "ds-avl",
    stem: "在任意结点的平衡因子绝对值都不超过 1 的平衡二叉树中，查找一个元素的时间复杂度是？",
    options: ["O(1)","O(log n)","O(n)","O(n log n)"],
    answer: "B",
    explanation: "AVL 树高被限制在 O(log n)，查找沿一条路径下降，因此代价为 O(log n)。",
    difficulty: "easy",
    tags: ["AVL","复杂度"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-avl-judge",
    stageKey: "ds-tree-search",
    topicKey: "ds-avl",
    stem: "LR 型失衡只需要一次右旋就能恢复平衡。",
    answer: false,
    explanation: "LR 型（左孩子的右子树过高）必须先对左孩子左旋、再对根右旋，共两次旋转。",
    difficulty: "medium",
    tags: ["AVL","旋转"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-huffman-single",
    stageKey: "ds-tree-search",
    topicKey: "ds-huffman",
    stem: "构造哈夫曼树时，每次应合并哪两个结点？",
    options: ["权值最大的两个","权值最小的两个","任意两个","深度最大的两个"],
    answer: "B",
    explanation: "贪心策略是每次取权值最小的两棵树合并，这样才能得到带权路径长度最小的树。",
    difficulty: "easy",
    tags: ["哈夫曼树","贪心"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-huffman-judge",
    stageKey: "ds-tree-search",
    topicKey: "ds-huffman",
    stem: "n 个叶子的哈夫曼树共有 2n - 1 个结点，且不存在度为 1 的结点。",
    answer: true,
    explanation: "合并 n-1 次每次新增一个内部结点，共 n + (n-1) = 2n-1 个结点，且每个内部结点都有两个孩子。",
    difficulty: "medium",
    tags: ["哈夫曼树","结点数"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-btree-single",
    stageKey: "ds-tree-search",
    topicKey: "ds-btree",
    stem: "m 阶 B 树的非根非叶结点最少有多少个孩子？",
    options: ["1","2","⌈m/2⌉","m"],
    answer: "C",
    explanation: "B 树要求除根外的非叶结点至少有 ⌈m/2⌉ 个孩子，以保证树的平衡与高度下界。",
    difficulty: "medium",
    tags: ["B树","阶"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-btree-judge",
    stageKey: "ds-tree-search",
    topicKey: "ds-btree",
    stem: "B+ 树把所有数据记录都存放在叶子结点，并用链表把叶子串起来，因此范围查询效率很高。",
    answer: true,
    explanation: "叶子链表让范围扫描顺序读取即可，内部结点只做路由，这也是数据库索引选 B+ 树的原因。",
    difficulty: "medium",
    tags: ["B+树","范围查询"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-heap-basic-single",
    stageKey: "ds-heap",
    topicKey: "ds-heap-basic",
    stem: "用自底向上（Floyd）方法把 n 个元素的数组建成堆，时间复杂度是？",
    options: ["O(n)","O(n log n)","O(log n)","O(n²)"],
    answer: "A",
    explanation: "越靠下的结点下沉高度越小，加权求和后总代价与 n 成线性，因此是 O(n)。",
    difficulty: "medium",
    tags: ["堆","建堆"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-heap-basic-judge",
    stageKey: "ds-heap",
    topicKey: "ds-heap-basic",
    stem: "在大根堆中，任意结点的关键字都不小于其左右孩子的关键字。",
    answer: true,
    explanation: "这正是大根堆的定义；但堆不保证同层或跨子树的顺序，也不保证数组整体有序。",
    difficulty: "easy",
    tags: ["堆","定义"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-heap-sort-single",
    stageKey: "ds-heap",
    topicKey: "ds-heap-sort",
    stem: "堆排序在最坏情况下的时间复杂度是？",
    options: ["O(n)","O(n log n)","O(n²)","O(log n)"],
    answer: "B",
    explanation: "建堆 O(n)，其后 n-1 次下沉每次 O(log n)，合计 O(n log n)，且不存在像快排那样的退化输入。",
    difficulty: "easy",
    tags: ["堆排序","复杂度"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-heap-sort-judge",
    stageKey: "ds-heap",
    topicKey: "ds-heap-sort",
    stem: "堆排序是一种稳定的排序算法。",
    answer: false,
    explanation: "堆排序在交换堆顶与末尾元素时会跨过多个元素，相同关键字可能改变相对次序，因此不稳定。",
    difficulty: "medium",
    tags: ["堆排序","稳定性"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-priority-queue-single",
    stageKey: "ds-heap",
    topicKey: "ds-priority-queue",
    stem: "从 n 个数中取最大的 k 个数（k 远小于 n），较优做法是维护一个大小为 k 的？",
    options: ["大根堆","小根堆","有序数组","哈希表"],
    answer: "B",
    explanation: "小根堆的堆顶是当前 k 个中的最小值，用它做门槛即可 O(n log k) 完成，空间只需 O(k)。",
    difficulty: "medium",
    tags: ["优先队列","Top-K"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-priority-queue-judge",
    stageKey: "ds-heap",
    topicKey: "ds-priority-queue",
    stem: "用两个堆（一个大根堆、一个小根堆）可以实时维护数据流的中位数。",
    answer: true,
    explanation: "较小的一半放最大堆、较大的一半放最小堆，保持两堆大小差不超过 1，堆顶即可给出中位数。",
    difficulty: "medium",
    tags: ["优先队列","中位数"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-graph-store-single",
    stageKey: "ds-graph",
    topicKey: "ds-graph-store",
    stem: "含有 n 个顶点、e 条边的图用邻接表存储，所需空间是？",
    options: ["O(n)","O(e)","O(n + e)","O(n × e)"],
    answer: "C",
    explanation: "需要 n 个顶点表结点与 2e（无向）或 e（有向）个边表结点，故为 O(n+e)。",
    difficulty: "easy",
    tags: ["邻接表","复杂度"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-graph-store-judge",
    stageKey: "ds-graph",
    topicKey: "ds-graph-store",
    stem: "无向图中所有顶点的度数之和等于边数的 2 倍。",
    answer: true,
    explanation: "每条边对两个端点各贡献 1 度，因此度数和是边数的两倍（握手定理）。",
    difficulty: "easy",
    tags: ["图","度"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-graph-traverse-single",
    stageKey: "ds-graph",
    topicKey: "ds-graph-traverse",
    stem: "在无权图中求两点间的最少边数（最短跳数），应使用？",
    options: ["DFS","BFS","Dijkstra","拓扑排序"],
    answer: "B",
    explanation: "BFS 按层扩展，第一次到达目标时的层数就是最少边数；DFS 找到的路径不一定最短。",
    difficulty: "easy",
    tags: ["BFS","最短路径"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-graph-traverse-judge",
    stageKey: "ds-graph",
    topicKey: "ds-graph-traverse",
    stem: "对含 n 个顶点 e 条边的连通图进行 DFS，若采用邻接表存储，时间复杂度为 O(n + e)。",
    answer: true,
    explanation: "每个顶点访问一次、每条边检查一次，因此是 O(n+e)；邻接矩阵实现则是 O(n²)。",
    difficulty: "medium",
    tags: ["DFS","复杂度"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-mst-single",
    stageKey: "ds-graph",
    topicKey: "ds-mst",
    stem: "Kruskal 算法中用来判断「加入某条边是否形成回路」的常用结构是？",
    options: ["栈","队列","并查集","哈希表"],
    answer: "C",
    explanation: "并查集能在近 O(1) 时间内判断两端点是否已连通，从而判断加入该边是否成环。",
    difficulty: "easy",
    tags: ["Kruskal","并查集"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-mst-judge",
    stageKey: "ds-graph",
    topicKey: "ds-mst",
    stem: "含 n 个顶点的连通图，其最小生成树一定恰好有 n-1 条边。",
    answer: true,
    explanation: "生成树必须连通且无环，这两个条件在有 n 个顶点的图上恰好等价于 n-1 条边。",
    difficulty: "easy",
    tags: ["最小生成树","边数"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-shortest-path-single",
    stageKey: "ds-graph",
    topicKey: "ds-shortest-path",
    stem: "Dijkstra 算法要求图中所有边的权值满足？",
    options: ["可以任意","必须非负","必须为整数","必须小于顶点数"],
    answer: "B",
    explanation: "若存在负权边，已确定的最短距离可能被后续路径改小，贪心选点不再成立，应改用 Bellman-Ford。",
    difficulty: "easy",
    tags: ["Dijkstra","负权"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-shortest-path-judge",
    stageKey: "ds-graph",
    topicKey: "ds-shortest-path",
    stem: "Floyd 算法的时间复杂度为 O(n³)，可以求任意两点间的最短路径。",
    answer: true,
    explanation: "三重循环枚举中转点 k 与两端点 i、j，得到全源最短路矩阵，代价 O(n³)。",
    difficulty: "easy",
    tags: ["Floyd","全源最短路"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-topo-critical-single",
    stageKey: "ds-graph",
    topicKey: "ds-topo-critical",
    stem: "对 AOV 网进行拓扑排序，若输出的顶点数少于顶点总数，说明该图？",
    options: ["不连通","存在环","边太多","一定是树"],
    answer: "B",
    explanation: "有环时环上所有顶点入度永远不为 0，无法被输出，因此输出数少于 n 即表明存在回路。",
    difficulty: "medium",
    tags: ["拓扑排序","环检测"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-topo-critical-judge",
    stageKey: "ds-graph",
    topicKey: "ds-topo-critical",
    stem: "AOE 网的关键路径是源点到汇点的最长路径，其长度等于完成整个工程所需的最短时间。",
    answer: true,
    explanation: "总工期由最长的那条依赖链决定，缩短任何非关键活动都不会提前完工。",
    difficulty: "medium",
    tags: ["关键路径","AOE"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-sequential-search-single",
    stageKey: "ds-search",
    topicKey: "ds-sequential-search",
    stem: "对长度为 n 的顺序表做等概率顺序查找，查找成功的平均查找长度是？",
    options: ["n","(n+1)/2","n/2","log₂n"],
    answer: "B",
    explanation: "第 i 个元素需比较 i 次，等概率下 (1+2+…+n)/n = (n+1)/2。",
    difficulty: "easy",
    tags: ["顺序查找","ASL"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-sequential-search-judge",
    stageKey: "ds-search",
    topicKey: "ds-sequential-search",
    stem: "分块查找要求「块间有序」，即后一块的所有元素都大于前一块的所有元素。",
    answer: true,
    explanation: "只有这样才可能先用索引定位块，再在块内查找；块内本身允许无序。",
    difficulty: "medium",
    tags: ["分块查找"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-binary-search-tree-find-single",
    stageKey: "ds-search",
    topicKey: "ds-binary-search-tree-find",
    stem: "对长度为 n 的有序顺序表做折半查找，最坏情况下的比较次数约为？",
    options: ["n/2","⌈log₂(n+1)⌉","n","√n"],
    answer: "B",
    explanation: "折半查找的判定树是一棵近似满二叉树，高度为 ⌈log₂(n+1)⌉，即最坏比较次数。",
    difficulty: "medium",
    tags: ["折半查找","判定树"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-binary-search-tree-find-judge",
    stageKey: "ds-search",
    topicKey: "ds-binary-search-tree-find",
    stem: "折半查找既适用于顺序存储的有序表，也适用于有序链表。",
    answer: false,
    explanation: "折半查找需要随机访问中点，链表取中点是 O(n)，因此链表上无法实现高效的折半查找。",
    difficulty: "medium",
    tags: ["折半查找","存储结构"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-hash-search-single",
    stageKey: "ds-search",
    topicKey: "ds-hash-search",
    stem: "哈希表的平均查找长度主要取决于？",
    options: ["表长","装填因子","关键字的数量级","哈希函数的代码长度"],
    answer: "B",
    explanation: "装填因子 α 直接决定冲突频率，α 越大冲突越多、平均查找长度越长。",
    difficulty: "medium",
    tags: ["哈希表","装填因子"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-hash-search-judge",
    stageKey: "ds-search",
    topicKey: "ds-hash-search",
    stem: "采用链地址法处理冲突时，装填因子可以大于 1。",
    answer: true,
    explanation: "链地址法把同址元素挂在表外，因此记录数可以超过表长，α > 1 是允许的。",
    difficulty: "medium",
    tags: ["哈希表","链地址法"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-insertion-sort-single",
    stageKey: "ds-sort",
    topicKey: "ds-insertion-sort",
    stem: "直接插入排序在最好情况（数据已有序）下的时间复杂度是？",
    options: ["O(1)","O(n)","O(n log n)","O(n²)"],
    answer: "B",
    explanation: "已有序时每个元素只需与前一个比较一次、不搬移，因此总代价与 n 成正比。",
    difficulty: "easy",
    tags: ["插入排序","复杂度"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-insertion-sort-judge",
    stageKey: "ds-sort",
    topicKey: "ds-insertion-sort",
    stem: "希尔排序是不稳定的排序算法。",
    answer: true,
    explanation: "按增量分组会跨组交换相距较远的元素，相同关键字的相对次序可能被打乱，因此不稳定。",
    difficulty: "medium",
    tags: ["希尔排序","稳定性"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-exchange-sort-single",
    stageKey: "ds-sort",
    topicKey: "ds-exchange-sort",
    stem: "快速排序在什么情况下会退化到 O(n²)？",
    options: ["数据随机时","每次划分的基准都是当前区间的最值","数据量很小时","存在大量重复元素时"],
    answer: "B",
    explanation: "基准为最值时每次只减少一个元素，递归深度达到 n，总代价退化为 O(n²)。",
    difficulty: "medium",
    tags: ["快速排序","退化"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-exchange-sort-judge",
    stageKey: "ds-sort",
    topicKey: "ds-exchange-sort",
    stem: "冒泡排序如果在某一趟中没有发生任何交换，说明序列已经有序，可以提前结束。",
    answer: true,
    explanation: "没有交换意味着所有相邻对都已满足顺序要求，整体已有序，可提前终止。",
    difficulty: "easy",
    tags: ["冒泡排序","优化"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-selection-sort-single",
    stageKey: "ds-sort",
    topicKey: "ds-selection-sort",
    stem: "简单选择排序在排序过程中，元素交换次数最多为？",
    options: ["n/2","n - 1","n(n-1)/2","n²"],
    answer: "B",
    explanation: "每轮最多交换一次，共 n-1 轮，因此交换次数不超过 n-1 次（比较次数才是 n(n-1)/2）。",
    difficulty: "medium",
    tags: ["选择排序","交换次数"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-selection-sort-judge",
    stageKey: "ds-sort",
    topicKey: "ds-selection-sort",
    stem: "堆排序与简单选择排序都属于选择类排序，但堆排序的时间复杂度为 O(n log n)。",
    answer: true,
    explanation: "堆排序用堆结构把「选最值」的代价从 O(n) 降到 O(log n)，因此整体提升到 O(n log n)。",
    difficulty: "easy",
    tags: ["选择排序","堆排序"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-merge-radix-single",
    stageKey: "ds-sort",
    topicKey: "ds-merge-radix",
    stem: "归并排序相比快速排序，最主要的额外代价是？",
    options: ["比较次数更多","需要 O(n) 的额外空间","不能处理重复元素","最坏情况更慢"],
    answer: "B",
    explanation: "合并需要一块与待排区间等长的缓冲数组，因此空间是 O(n)；快排可原地完成。",
    difficulty: "easy",
    tags: ["归并排序","空间"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-merge-radix-judge",
    stageKey: "ds-sort",
    topicKey: "ds-merge-radix",
    stem: "基数排序是一种基于比较的排序算法。",
    answer: false,
    explanation: "基数排序按关键字各位的值做分配与收集，全程不比较元素大小，因此不受比较排序 Ω(n log n) 下界约束。",
    difficulty: "medium",
    tags: ["基数排序","比较排序下界"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-sort-compare-single",
    stageKey: "ds-sort",
    topicKey: "ds-sort-compare",
    stem: "下列排序算法中，稳定的是？",
    options: ["快速排序","堆排序","归并排序","简单选择排序"],
    answer: "C",
    explanation: "归并排序合并时对相等元素保持原有先后次序，因此稳定；快排、堆排、简单选择都不稳定。",
    difficulty: "medium",
    tags: ["排序","稳定性"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-sort-compare-judge",
    stageKey: "ds-sort",
    topicKey: "ds-sort-compare",
    stem: "任何基于比较的排序算法，最坏情况下至少需要 Ω(n log n) 次比较。",
    answer: true,
    explanation: "n 个元素共 n! 种排列，比较决策树的叶子数决定了高度下界 log(n!) = Ω(n log n)。",
    difficulty: "medium",
    tags: ["排序","下界"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-divide-conquer-single",
    stageKey: "ds-algo-strategy",
    topicKey: "ds-divide-conquer",
    stem: "分治法要求子问题满足的关键性质是？",
    options: ["子问题必须互相重叠","子问题与原问题同型且相互独立","子问题必须比原问题简单很多","子问题必须可并行"],
    answer: "B",
    explanation: "同型才能递归求解，独立才能各自算一次；若重叠则应改用动态规划避免重复计算。",
    difficulty: "easy",
    tags: ["分治","适用条件"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-divide-conquer-judge",
    stageKey: "ds-algo-strategy",
    topicKey: "ds-divide-conquer",
    stem: "快速选择（quickselect）求第 k 小元素的平均时间复杂度是 O(n)。",
    answer: true,
    explanation: "每次分区后只递归目标所在的一侧，规模按比例缩减，平均代价是线性的。",
    difficulty: "medium",
    tags: ["分治","快速选择"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-greedy-single",
    stageKey: "ds-algo-strategy",
    topicKey: "ds-greedy",
    stem: "「选出最多互不重叠的区间」问题，贪心策略应该按什么排序？",
    options: ["区间左端点升序","区间右端点升序","区间长度升序","区间长度降序"],
    answer: "B",
    explanation: "按右端点升序，每次选最早结束的区间，能给剩余区间留出最大空间，可证最优。",
    difficulty: "medium",
    tags: ["贪心","区间调度"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-greedy-judge",
    stageKey: "ds-algo-strategy",
    topicKey: "ds-greedy",
    stem: "0-1 背包问题可以用「单位价值最高的物品优先」的贪心策略求得最优解。",
    answer: false,
    explanation: "0-1 背包不能拆物品，贪心会被反例击破（如容量 10、物品 (6,6.5) 与 (5,5.4)）；分数背包才可以贪心。",
    difficulty: "medium",
    tags: ["贪心","背包"],
    sourceKey: "algorithms-java",
  }),
  singleQuestion({
    key: "ds-dp-basic-single",
    stageKey: "ds-algo-strategy",
    topicKey: "ds-dp-basic",
    stem: "用一维数组实现 0-1 背包时，容量必须采用什么顺序枚举？",
    options: ["正序","倒序","任意顺序","按物品价值排序"],
    answer: "B",
    explanation: "倒序能保证 dp[v-w] 仍是「未考虑当前物品」的旧值，从而每件物品只被使用一次。",
    difficulty: "medium",
    tags: ["动态规划","背包"],
    sourceKey: "algorithms-go",
  }),
  judgeQuestion({
    key: "ds-dp-basic-judge",
    stageKey: "ds-algo-strategy",
    topicKey: "ds-dp-basic",
    stem: "动态规划能成立的前提之一是子问题具有重叠性，否则用分治即可。",
    answer: true,
    explanation: "DP 的价值在于缓存重复子问题；若子问题互不重叠，缓存没有收益，分治就够了。",
    difficulty: "medium",
    tags: ["动态规划","适用条件"],
    sourceKey: "algorithms-javascript",
  }),
  singleQuestion({
    key: "ds-backtracking-single",
    stageKey: "ds-algo-strategy",
    topicKey: "ds-backtracking",
    stem: "回溯算法中，递归返回后必须执行的关键步骤是？",
    options: ["重新排序","撤销本次选择（恢复状态）","输出结果","增加深度"],
    answer: "B",
    explanation: "不撤销选择会把本次分支的状态带入兄弟分支，导致结果错误；撤销后状态才能被复用。",
    difficulty: "easy",
    tags: ["回溯","撤销"],
    sourceKey: "algorithms-python",
  }),
  judgeQuestion({
    key: "ds-backtracking-judge",
    stageKey: "ds-algo-strategy",
    topicKey: "ds-backtracking",
    stem: "回溯法通过剪枝可以把最坏时间复杂度从指数级降到多项式级。",
    answer: false,
    explanation: "剪枝只跳过不可能的分支，解空间仍可能是指数级的，最坏复杂度依旧是指数函数。",
    difficulty: "medium",
    tags: ["回溯","复杂度"],
    sourceKey: "algorithms-java",
  }),
];

export const dsExpansionStages: LearningStage[] = [
  {
    key: "ds-linear-list",
    title: "线性表",
    weeks: "第 3-4 周",
    goal: "把「顺序存储」与「链式存储」两套表示讲透，能在插入/删除/查找的代价上做取舍。",
    outcome: "给定读写模式（按位随机访问 / 频繁插删 / 内存受限），能选对存储结构并说出代价。",
    lesson: {
      "overview": [
        "把「顺序存储」与「链式存储」两套表示讲透，能在插入/删除/查找的代价上做取舍。",
        "给定读写模式（按位随机访问 / 频繁插删 / 内存受限），能选对存储结构并说出代价。"
      ],
      "studyLoop": [
        "先读「顺序表与数组存储」，在纸上手推一个最小样例",
        "按顺序实现本阶段核心代码，跑通后再补边界用例",
        "故意破坏一个前提，观察失败现象并定位原因",
        "把本阶段的易错点整理成自己的清单"
      ],
      "milestones": [
        {
          "title": "掌握：顺序表与数组存储",
          "evidence": "能独立完成「顺序表与数组存储」的示例与配套自测题。"
        },
        {
          "title": "掌握：单链表的实现与操作",
          "evidence": "能独立完成「单链表的实现与操作」的示例与配套自测题。"
        },
        {
          "title": "掌握：双向链表与循环链表",
          "evidence": "能独立完成「双向链表与循环链表」的示例与配套自测题。"
        },
        {
          "title": "掌握：静态链表与链表应用",
          "evidence": "能独立完成「静态链表与链表应用」的示例与配套自测题。"
        }
      ],
      "completionCriteria": [
        "能独立完成本阶段全部 4 个知识点的示例与自测。",
        "能用文字说清每个知识点的时间/空间复杂度与适用场景。",
        "给定读写模式（按位随机访问 / 频繁插删 / 内存受限），能选对存储结构并说出代价。"
      ]
    },
    topics: [
      {
        key: "ds-sequence-list",
        title: "顺序表与数组存储",
        summary: "用一段连续空间存线性表：随机访问 O(1)，但插删要搬元素。",
        concepts: ["连续存储与逻辑相邻","随机访问 O(1)","插删的平均移动次数","动态扩容（倍增）"],
        principles: ["下标 i 的地址 = 首地址 + i × 元素大小，所以按下标访问与表长无关，是 O(1)","在长为 n 的顺序表第 i 位插入需移动 n-i 个元素；等概率下平均移动 n/2 个，故插入平均 O(n)","删除同理：删除第 i 个需移动 n-i-1 个元素，平均 O(n)","动态数组扩容按倍数增长（常见 1.5×/2×）把 n 次追加的均摊代价摊成 O(1)"],
        applications: ["需要按下标随机访问且很少插删","作为栈/堆/哈希表的底层存储","批量读多写少的场景"],
        pitfalls: ["把「顺序表插入」当成 O(1)：只有表尾插入才是 O(1)","扩容时按固定长度 +1 增长，导致追加均摊退化为 O(n)","用顺序表频繁做头部插入/删除"],
        method: "先抓住「连续存储与逻辑相邻」与「随机访问 O(1)」两个抓手，再用「下标 i 的地址 = 首地址 + i × 元素大小」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「顺序表与数组存储」做一次闭环练习：在「需要按下标随机访问且很少插删」的场景下，把示例「顺序表插入与均摊扩容」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：把「顺序表插入」当成 O(1)：只有表尾插入才是 O(1)为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "用一段连续空间存线性表：随机访问 O(1)，但插删要搬元素。",
            "核心结论：下标 i 的地址 = 首地址 + i × 元素大小，所以按下标访问与表长无关，是 O(1)"
          ],
          "mechanism": [
            "在长为 n 的顺序表第 i 位插入需移动 n-i 个元素；等概率下平均移动 n/2 个，故插入平均 O(n)",
            "删除同理：删除第 i 个需移动 n-i-1 个元素，平均 O(n)"
          ],
          "example": {
            "title": "顺序表插入与均摊扩容",
            "language": "c",
            "code": "#define CAP 4\ntypedef struct { int *data; int len; int cap; } SeqList;\nvoid insert(SeqList *L, int i, int x) {   // 第 i 位插入\n    if (L->len == L->cap) { L->cap *= 2; L->data = realloc(L->data, L->cap * sizeof(int)); }\n    for (int j = L->len; j > i; j--) L->data[j] = L->data[j - 1];  // 后移\n    L->data[i] = x; L->len++;\n}",
            "explanation": "先保证容量（倍增扩容），再从后往前搬元素腾出第 i 位，避免覆盖未搬走的元素。"
          },
          "practiceSteps": [
            "用自己的话写出「连续存储与逻辑相邻」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「顺序表插入与均摊扩容」，跑通后故意改错一处，观察失败现象。",
            "在「需要按下标随机访问且很少插删」场景里构造一个边界用例，确认不会踩到「把「顺序表插入」当成 O(1)：只有表尾插入才是」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「顺序表与数组存储」的核心机制，并说明复杂度或代价。",
            "能指出「把「顺序表插入」当成 O(1)：只有表尾插入才是」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
      {
        key: "ds-singly-linked",
        title: "单链表的实现与操作",
        summary: "用指针把散落的结点串起来：插删 O(1)（已知前驱），但访问要顺着找。",
        concepts: ["结点与指针域","头指针与头结点","按位查找 O(n)","插删的指针改写顺序"],
        principles: ["单链表只能单向推进，按位查找必须从头走 i 步，因此是 O(n)","已知前驱 p 时插入/删除只改常数个指针，代价 O(1)","带头结点可统一「在表头插入」与「在中间插入」的代码，省掉对空表的特判","删除结点 q 必须先找到 q 的前驱：p->next = q->next; free(q)"],
        applications: ["频繁插删、表长变化大","实现栈/队列/邻接表","内存不连续、无法预分配的场景"],
        pitfalls: ["先断开 next 再保存后继，导致链表断裂、后继结点丢失","忘记释放被删结点造成内存泄漏","不带头结点时遗漏空表/表头删除的边界处理"],
        method: "先抓住「结点与指针域」与「头指针与头结点」两个抓手，再用「单链表只能单向推进」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「单链表的实现与操作」做一次闭环练习：在「频繁插删、表长变化大」的场景下，把示例「单链表在 p 之后插入 s」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：先断开 next 再保存后继为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "用指针把散落的结点串起来：插删 O(1)（已知前驱），但访问要顺着找。",
            "核心结论：单链表只能单向推进，按位查找必须从头走 i 步，因此是 O(n)"
          ],
          "mechanism": [
            "已知前驱 p 时插入/删除只改常数个指针，代价 O(1)",
            "带头结点可统一「在表头插入」与「在中间插入」的代码，省掉对空表的特判"
          ],
          "example": {
            "title": "单链表在 p 之后插入 s",
            "language": "c",
            "code": "// p 为已知前驱结点，s 为待插入结点\ns->next = p->next;   // ① 先接上后继\np->next = s;         // ② 再让前驱指向 s\n// 顺序不能反：反了会先丢掉原来的 p->next，链断在 s 后面",
            "explanation": "指针改写必须先保存后继再改前驱；反过来会把 p 原来的后继整个丢掉。"
          },
          "practiceSteps": [
            "用自己的话写出「结点与指针域」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「单链表在 p 之后插入 s」，跑通后故意改错一处，观察失败现象。",
            "在「频繁插删、表长变化大」场景里构造一个边界用例，确认不会踩到「先断开 next 再保存后继」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「单链表的实现与操作」的核心机制，并说明复杂度或代价。",
            "能指出「先断开 next 再保存后继」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
        animations: ["anim-list-insert"],
      },
      {
        key: "ds-double-linked",
        title: "双向链表与循环链表",
        summary: "加一个 prior 指针换来双向可走；循环链表让表尾回到表头。",
        concepts: ["prior/next 双指针","双向链表的插入与删除","循环链表","循环双链表的判空"],
        principles: ["双向链表每个结点两个指针域，代价是空间换来了「已知结点即可删除自己」的能力","双向链表插入 s 到 p 之后要改四条指针：s->prior=p、s->next=p->next、p->next->prior=s、p->next=s","循环链表中尾结点的 next 指回头结点，判空条件是 head->next == head","带尾指针的循环链表可以 O(1) 同时取到表头和表尾，适合做队列"],
        applications: ["需要双向遍历（如浏览记录/文本编辑器的撤销）","需要 O(1) 删除给定结点（LRU 缓存）","循环队列/轮转调度"],
        pitfalls: ["改指针时漏改 p->next->prior，导致反向链断裂","循环链表用 NULL 判空而不是判回到头结点","删除最后一个结点时忘记处理前驱/后继为空的情况"],
        method: "先抓住「prior/next 双指针」与「双向链表的插入与删除」两个抓手，再用「双向链表每个结点两个指针域」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「双向链表与循环链表」做一次闭环练习：在「需要双向遍历（如浏览记录/文本编辑器的撤销）」的场景下，把示例「双向链表删除结点 p」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：改指针时漏改 p->next->prior为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "加一个 prior 指针换来双向可走；循环链表让表尾回到表头。",
            "核心结论：双向链表每个结点两个指针域，代价是空间换来了「已知结点即可删除自己」的能力"
          ],
          "mechanism": [
            "双向链表插入 s 到 p 之后要改四条指针：s->prior=p、s->next=p->next、p->next->prior=s、p->next=s",
            "循环链表中尾结点的 next 指回头结点，判空条件是 head->next == head"
          ],
          "example": {
            "title": "双向链表删除结点 p",
            "language": "c",
            "code": "p->prior->next = p->next;   // 前驱跨过 p\np->next->prior = p->prior;   // 后继跨过 p\nfree(p);                      // 释放 p",
            "explanation": "双向链表删除要同时维护正向和反向两条链，两条都接好之后再释放结点。"
          },
          "practiceSteps": [
            "用自己的话写出「prior/next 双指针」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「双向链表删除结点 p」，跑通后故意改错一处，观察失败现象。",
            "在「需要双向遍历（如浏览记录/文本编辑器的撤销）」场景里构造一个边界用例，确认不会踩到「改指针时漏改 p->next->prior」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「双向链表与循环链表」的核心机制，并说明复杂度或代价。",
            "能指出「改指针时漏改 p->next->prior」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
      {
        key: "ds-static-linked",
        title: "静态链表与链表应用",
        summary: "用数组模拟链表：以游标代替指针，兼顾连续存放与链式插删。",
        concepts: ["游标（cursor）代替指针","备用链表","静态链表的插删","链表典型应用"],
        principles: ["静态链表用数组下标当「指针」，next 存的是下一个结点的下标（0 表示结束）","未被使用的数组单元串成备用链表，插入时从备用链表取结点","静态链表插删仍是 O(1)（已知前驱），但不支持无限增长，需要预先定容","链表适合做「长度不定、插删频繁」的表，如多项式相加、邻接表、LRU"],
        applications: ["无指针的语言（早期 BASIC/Fortran）实现链表","固定容量下的链式结构","多项式的表示与相加"],
        pitfalls: ["把静态链表的 0 当成有效下标（0 是结束标记）","忘记把释放的结点交还备用链表","误以为静态链表也能 O(1) 随机访问"],
        method: "先抓住「游标（cursor）代替指针」与「备用链表」两个抓手，再用「静态链表用数组下标当「指针」」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「静态链表与链表应用」做一次闭环练习：在「无指针的语言（早期 BASIC/Fortran）实现链表」的场景下，把示例「静态链表结点定义」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：把静态链表的 0 当成有效下标（0 是结束标记）为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "用数组模拟链表：以游标代替指针，兼顾连续存放与链式插删。",
            "核心结论：静态链表用数组下标当「指针」，next 存的是下一个结点的下标（0 表示结束）"
          ],
          "mechanism": [
            "未被使用的数组单元串成备用链表，插入时从备用链表取结点",
            "静态链表插删仍是 O(1)（已知前驱），但不支持无限增长，需要预先定容"
          ],
          "example": {
            "title": "静态链表结点定义",
            "language": "c",
            "code": "#define MAXSIZE 100\ntypedef struct { int data; int next; } SLinkList[MAXSIZE];\n// 0 号单元可作头结点；next == 0 表示链表结束\n// 未被使用的结点用 next 串成备用链表，插入时先 from spare 再改链",
            "explanation": "数组下标即「指针」，用 0 表示空；备用链表让插入删除能在数组内部完成。"
          },
          "practiceSteps": [
            "用自己的话写出「游标（cursor）代替指针」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「静态链表结点定义」，跑通后故意改错一处，观察失败现象。",
            "在「无指针的语言（早期 BASIC/Fortran）实现链表」场景里构造一个边界用例，确认不会踩到「把静态链表的 0 当成有效下标（0 是结束标记）」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「静态链表与链表应用」的核心机制，并说明复杂度或代价。",
            "能指出「把静态链表的 0 当成有效下标（0 是结束标记）」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
    ],
    questionKeys: ["ds-sequence-list-single","ds-sequence-list-judge","ds-singly-linked-single","ds-singly-linked-judge","ds-double-linked-single","ds-double-linked-judge","ds-static-linked-single","ds-static-linked-judge"],
  },
  {
    key: "ds-stack-queue",
    title: "栈与队列",
    weeks: "第 5 周",
    goal: "分清「后进先出」与「先进先出」，并掌握循环队列的判空判满。",
    outcome: "能写出循环队列的入队出队与判满条件，并能用栈解释递归与表达式求值。",
    lesson: {
      "overview": [
        "分清「后进先出」与「先进先出」，并掌握循环队列的判空判满。",
        "能写出循环队列的入队出队与判满条件，并能用栈解释递归与表达式求值。"
      ],
      "studyLoop": [
        "先读「栈的定义与实现」，在纸上手推一个最小样例",
        "按顺序实现本阶段核心代码，跑通后再补边界用例",
        "故意破坏一个前提，观察失败现象并定位原因",
        "把本阶段的易错点整理成自己的清单"
      ],
      "milestones": [
        {
          "title": "掌握：栈的定义与实现",
          "evidence": "能独立完成「栈的定义与实现」的示例与配套自测题。"
        },
        {
          "title": "掌握：栈的应用：括号匹配与表达式求值",
          "evidence": "能独立完成「栈的应用：括号匹配与表达式求值」的示例与配套自测题。"
        },
        {
          "title": "掌握：队列与循环队列",
          "evidence": "能独立完成「队列与循环队列」的示例与配套自测题。"
        },
        {
          "title": "掌握：双端队列与队列应用",
          "evidence": "能独立完成「双端队列与队列应用」的示例与配套自测题。"
        }
      ],
      "completionCriteria": [
        "能独立完成本阶段全部 4 个知识点的示例与自测。",
        "能用文字说清每个知识点的时间/空间复杂度与适用场景。",
        "能写出循环队列的入队出队与判满条件，并能用栈解释递归与表达式求值。"
      ]
    },
    topics: [
      {
        key: "ds-stack-basic",
        title: "栈的定义与实现",
        summary: "只能在栈顶进出的线性表：后进先出（LIFO）。",
        concepts: ["栈顶与栈底","入栈 push / 出栈 pop","顺序栈与链栈","O(1) 的栈操作"],
        principles: ["栈的插入与删除都被限制在同一端（栈顶），因此 push/pop 都是 O(1)","顺序栈用 top 指示栈顶下标：top == -1 为空，top == MAXSIZE-1 为满","链栈用「头插」实现，栈顶就是链表头，不需要判满","栈的合法出栈序列个数是卡特兰数 C(2n,n)/(n+1)，可用于判断出栈序列是否合法"],
        applications: ["函数调用栈与递归","表达式求值与中缀转后缀","括号匹配与语法检查"],
        pitfalls: ["顺序栈上溢/下溢没检查就操作","把栈当成队列用，混淆进出顺序","判断出栈序列合法性时只比较相邻元素"],
        method: "先抓住「栈顶与栈底」与「入栈 push / 出栈 pop」两个抓手，再用「栈的插入与删除都被限制在同一端（栈顶）」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「栈的定义与实现」做一次闭环练习：在「函数调用栈与递归」的场景下，把示例「顺序栈的入栈出栈」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：顺序栈上溢/下溢没检查就操作为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "只能在栈顶进出的线性表：后进先出（LIFO）。",
            "核心结论：栈的插入与删除都被限制在同一端（栈顶），因此 push/pop 都是 O(1)"
          ],
          "mechanism": [
            "顺序栈用 top 指示栈顶下标：top == -1 为空，top == MAXSIZE-1 为满",
            "链栈用「头插」实现，栈顶就是链表头，不需要判满"
          ],
          "example": {
            "title": "顺序栈的入栈出栈",
            "language": "c",
            "code": "#define MAXSIZE 50\ntypedef struct { int data[MAXSIZE]; int top; } SqStack;\nint push(SqStack *S, int x) { if (S->top == MAXSIZE - 1) return 0; S->data[++S->top] = x; return 1; }\nint pop(SqStack *S, int *x)  { if (S->top == -1) return 0; *x = S->data[S->top--]; return 1; }",
            "explanation": "先判满/判空再操作；top 指向当前栈顶元素，入栈先加下标再写值。"
          },
          "practiceSteps": [
            "用自己的话写出「栈顶与栈底」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「顺序栈的入栈出栈」，跑通后故意改错一处，观察失败现象。",
            "在「函数调用栈与递归」场景里构造一个边界用例，确认不会踩到「顺序栈上溢/下溢没检查就操作」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「栈的定义与实现」的核心机制，并说明复杂度或代价。",
            "能指出「顺序栈上溢/下溢没检查就操作」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
        animations: ["anim-stack-ops"],
      },
      {
        key: "ds-stack-application",
        title: "栈的应用：括号匹配与表达式求值",
        summary: "把「先遇到的未闭合结构」压栈，遇闭合再弹出配对。",
        concepts: ["括号/标签配对","中缀表达式","后缀表达式（逆波兰）","运算符栈与优先级"],
        principles: ["括号匹配：遇左括号入栈，遇右括号与栈顶比较并弹出，结束后栈必须为空","中缀转后缀要用运算符栈：当前运算符优先级不高于栈顶时先弹栈输出","后缀表达式求值用一个操作数栈：遇操作数入栈、遇运算符弹出两个操作数计算后回压","递归的本质是系统栈：把递归改写成显式栈即可消除递归深度限制"],
        applications: ["编译器/编辑器语法与括号检查","计算器实现","HTML/XML 标签配平校验"],
        pitfalls: ["匹配结束时忘记检查栈是否为空，漏掉多余左括号","多位数与负号解析错误（把负号当二元减号）","中缀转后缀时忽略了同优先级运算符的左结合性"],
        method: "先抓住「括号/标签配对」与「中缀表达式」两个抓手，再用「括号匹配：遇左括号入栈」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「栈的应用：括号匹配与表达式求值」做一次闭环练习：在「编译器/编辑器语法与括号检查」的场景下，把示例「括号匹配的核心循环」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：匹配结束时忘记检查栈是否为空为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "把「先遇到的未闭合结构」压栈，遇闭合再弹出配对。",
            "核心结论：括号匹配：遇左括号入栈，遇右括号与栈顶比较并弹出，结束后栈必须为空"
          ],
          "mechanism": [
            "中缀转后缀要用运算符栈：当前运算符优先级不高于栈顶时先弹栈输出",
            "后缀表达式求值用一个操作数栈：遇操作数入栈、遇运算符弹出两个操作数计算后回压"
          ],
          "example": {
            "title": "括号匹配的核心循环",
            "language": "c",
            "code": "for (char *p = s; *p; p++) {\n    if (*p == '(' || *p == '[' || *p == '{') push(&st, *p);\n    else {\n        if (is_empty(&st)) return 0;              // 右括号多余\n        char top = pop(&st);\n        if (!match(top, *p)) return 0;            // 类型不匹配\n    }\n}\nreturn is_empty(&st);                              // 左括号必须全部配对",
            "explanation": "两条收尾判断最关键：遇到右括号时栈不能空，全部扫描完后栈必须为空。"
          },
          "practiceSteps": [
            "用自己的话写出「括号/标签配对」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「括号匹配的核心循环」，跑通后故意改错一处，观察失败现象。",
            "在「编译器/编辑器语法与括号检查」场景里构造一个边界用例，确认不会踩到「匹配结束时忘记检查栈是否为空」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「栈的应用：括号匹配与表达式求值」的核心机制，并说明复杂度或代价。",
            "能指出「匹配结束时忘记检查栈是否为空」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
      {
        key: "ds-queue-basic",
        title: "队列与循环队列",
        summary: "只能在队尾入、队头出的线性表：先进先出（FIFO）。",
        concepts: ["队头与队尾","假溢出","循环队列取模","判满的两种做法"],
        principles: ["队列的入队与出队分别在两端，都是 O(1)","顺序队列出队后 front 后移会留下无法复用的空洞（假溢出），用取模把数组首尾接起来","循环队列判空：front == rear；判满：牺牲一个单元时 (rear+1)%M == front","不牺牲单元就用计数器 size 或标志位记录当前元素个数来判满"],
        applications: ["BFS 逐层扩展","任务/打印/消息队列","缓冲与流量削峰"],
        pitfalls: ["循环队列直接用 rear == front 判满，导致与判空冲突","出队/入队忘取模，指针越界","以为数组实现的队列天然没有容量上限"],
        method: "先抓住「队头与队尾」与「假溢出」两个抓手，再用「队列的入队与出队分别在两端」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「队列与循环队列」做一次闭环练习：在「BFS 逐层扩展」的场景下，把示例「循环队列入队出队」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：循环队列直接用 rear == front 判满为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "只能在队尾入、队头出的线性表：先进先出（FIFO）。",
            "核心结论：队列的入队与出队分别在两端，都是 O(1)"
          ],
          "mechanism": [
            "顺序队列出队后 front 后移会留下无法复用的空洞（假溢出），用取模把数组首尾接起来",
            "循环队列判空：front == rear；判满：牺牲一个单元时 (rear+1)%M == front"
          ],
          "example": {
            "title": "循环队列入队出队",
            "language": "c",
            "code": "#define M 8\ntypedef struct { int data[M]; int front, rear; } SqQueue;   // 牺牲一个单元判满\nint enqueue(SqQueue *q, int x) { if ((q->rear + 1) % M == q->front) return 0; q->data[q->rear] = x; q->rear = (q->rear + 1) % M; return 1; }\nint dequeue(SqQueue *q, int *x) { if (q->front == q->rear) return 0; *x = q->data[q->front]; q->front = (q->front + 1) % M; return 1; }",
            "explanation": "所有移动都取模形成环；判满是「尾指针再进一步就撞上队头」，判空是两指针相等。"
          },
          "practiceSteps": [
            "用自己的话写出「队头与队尾」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「循环队列入队出队」，跑通后故意改错一处，观察失败现象。",
            "在「BFS 逐层扩展」场景里构造一个边界用例，确认不会踩到「循环队列直接用 rear == front 判满」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「队列与循环队列」的核心机制，并说明复杂度或代价。",
            "能指出「循环队列直接用 rear == front 判满」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
        animations: ["anim-queue-ops"],
      },
      {
        key: "ds-deque-application",
        title: "双端队列与队列应用",
        summary: "两端都能进出；滑动窗口最值与 BFS 都靠它把代价降到线性。",
        concepts: ["双端队列 deque","单调队列","BFS 的分层扩展","队列与栈的相互实现"],
        principles: ["双端队列两端都能 O(1) 进出，输入受限/输出受限只是它的两个特例","单调队列维护「下标递增、值单调」的序列，求滑动窗口最值可做到 O(n)","BFS 用队列保证按层扩展，首次到达某点时的层数就是最短跳数","用两个栈可以模拟队列（入栈一个、出栈另一个），反之两个队列也能模拟栈"],
        applications: ["滑动窗口最大值/最小值","BFS 最短路与层序输出","任务调度与撤销缓冲区"],
        pitfalls: ["单调队列出队时忘了同步移除过期下标","BFS 在入队时不打标记，同一结点被重复入队导致复杂度退化","用两个栈模拟队列时把元素在两个栈之间来回倒"],
        method: "先抓住「双端队列 deque」与「单调队列」两个抓手，再用「双端队列两端都能 O(1) 进出」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「双端队列与队列应用」做一次闭环练习：在「滑动窗口最大值/最小值」的场景下，把示例「单调队列求滑动窗口最大值」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：单调队列出队时忘了同步移除过期下标为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "两端都能进出；滑动窗口最值与 BFS 都靠它把代价降到线性。",
            "核心结论：双端队列两端都能 O(1) 进出，输入受限/输出受限只是它的两个特例"
          ],
          "mechanism": [
            "单调队列维护「下标递增、值单调」的序列，求滑动窗口最值可做到 O(n)",
            "BFS 用队列保证按层扩展，首次到达某点时的层数就是最短跳数"
          ],
          "example": {
            "title": "单调队列求滑动窗口最大值",
            "language": "c",
            "code": "// deque 存下标，维护值单调递减\nfor (int i = 0; i < n; i++) {\n    while (!empty(&dq) && a[back(&dq)] <= a[i]) pop_back(&dq);  // 比当前小的都不可能成为最大值\n    push_back(&dq, i);\n    if (front(&dq) <= i - k) pop_front(&dq);                     // 踢掉滑出窗口的下标\n    if (i >= k - 1) printf(\"%d \", a[front(&dq)]);\n}",
            "explanation": "每个下标最多进队出队一次，所以整体是 O(n)；关键是同时做「单调维护」与「过期剔除」。"
          },
          "practiceSteps": [
            "用自己的话写出「双端队列 deque」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「单调队列求滑动窗口最大值」，跑通后故意改错一处，观察失败现象。",
            "在「滑动窗口最大值/最小值」场景里构造一个边界用例，确认不会踩到「单调队列出队时忘了同步移除过期下标」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「双端队列与队列应用」的核心机制，并说明复杂度或代价。",
            "能指出「单调队列出队时忘了同步移除过期下标」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
    ],
    questionKeys: ["ds-stack-basic-single","ds-stack-basic-judge","ds-stack-application-single","ds-stack-application-judge","ds-queue-basic-single","ds-queue-basic-judge","ds-deque-application-single","ds-deque-application-judge"],
  },
  {
    key: "ds-string",
    title: "串与模式匹配",
    weeks: "第 6 周",
    goal: "把「串的存储」与「模式匹配」讲清，重点是 KMP 的 next 数组为什么能省掉回溯。",
    outcome: "能手算 next 数组，并说明朴素匹配最坏为什么会退化到 O(nm)。",
    lesson: {
      "overview": [
        "把「串的存储」与「模式匹配」讲清，重点是 KMP 的 next 数组为什么能省掉回溯。",
        "能手算 next 数组，并说明朴素匹配最坏为什么会退化到 O(nm)。"
      ],
      "studyLoop": [
        "先读「串的存储与基本运算」，在纸上手推一个最小样例",
        "按顺序实现本阶段核心代码，跑通后再补边界用例",
        "故意破坏一个前提，观察失败现象并定位原因",
        "把本阶段的易错点整理成自己的清单"
      ],
      "milestones": [
        {
          "title": "掌握：串的存储与基本运算",
          "evidence": "能独立完成「串的存储与基本运算」的示例与配套自测题。"
        },
        {
          "title": "掌握：朴素模式匹配与 KMP",
          "evidence": "能独立完成「朴素模式匹配与 KMP」的示例与配套自测题。"
        },
        {
          "title": "掌握：next 数组的构造与手算",
          "evidence": "能独立完成「next 数组的构造与手算」的示例与配套自测题。"
        }
      ],
      "completionCriteria": [
        "能独立完成本阶段全部 3 个知识点的示例与自测。",
        "能用文字说清每个知识点的时间/空间复杂度与适用场景。",
        "能手算 next 数组，并说明朴素匹配最坏为什么会退化到 O(nm)。"
      ]
    },
    topics: [
      {
        key: "ds-string-basic",
        title: "串的存储与基本运算",
        summary: "串是字符的有限序列；定长顺序存储、堆分配存储与块链存储各有取舍。",
        concepts: ["串长与空串","定长顺序存储","堆分配存储","子串与主串"],
        principles: ["定长顺序存储用「长度 + 字符数组」表示，实现简单但超出 maxSize 会被截断","堆分配存储按实际长度 malloc，长度变化灵活，是工程中最常用的表示","块链存储每个结点放多个字符，牺牲随机访问换取零碎空间的利用","串比较按字典序逐字符比较，第一个不同字符决定大小"],
        applications: ["文本处理与分词","配置/日志的字段切分","作为 KMP、AC 自动机等匹配算法的输入表示"],
        pitfalls: ["把空串与空格串混为一谈（空串长度为 0）","定长存储拼接时不检查是否需要截断","用 strcmp 比较带非 ASCII 字符的串而不指定编码"],
        method: "先抓住「串长与空串」与「定长顺序存储」两个抓手，再用「定长顺序存储用「长度 + 字符数组」表示」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「串的存储与基本运算」做一次闭环练习：在「文本处理与分词」的场景下，把示例「堆分配串的表示」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：把空串与空格串混为一谈（空串长度为 0）为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "串是字符的有限序列；定长顺序存储、堆分配存储与块链存储各有取舍。",
            "核心结论：定长顺序存储用「长度 + 字符数组」表示，实现简单但超出 maxSize 会被截断"
          ],
          "mechanism": [
            "堆分配存储按实际长度 malloc，长度变化灵活，是工程中最常用的表示",
            "块链存储每个结点放多个字符，牺牲随机访问换取零碎空间的利用"
          ],
          "example": {
            "title": "堆分配串的表示",
            "language": "c",
            "code": "typedef struct { char *ch; int length; } HString;\n// 赋值时按实际长度分配，而不是固定 maxSize\nvoid assign(HString *s, const char *t) {\n    int n = strlen(t);\n    s->ch = realloc(s->ch, n + 1);\n    memcpy(s->ch, t, n + 1);\n    s->length = n;\n}",
            "explanation": "堆分配串的长度与内容都按需分配，因此没有定长截断问题，代价是需要自己管理释放。"
          },
          "practiceSteps": [
            "用自己的话写出「串长与空串」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「堆分配串的表示」，跑通后故意改错一处，观察失败现象。",
            "在「文本处理与分词」场景里构造一个边界用例，确认不会踩到「把空串与空格串混为一谈（空串长度为 0）」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「串的存储与基本运算」的核心机制，并说明复杂度或代价。",
            "能指出「把空串与空格串混为一谈（空串长度为 0）」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
      {
        key: "ds-bf-kmp",
        title: "朴素模式匹配与 KMP",
        summary: "BF 每次失配主串指针回退；KMP 用已知信息让主串指针永不回退。",
        concepts: ["模式串与主串","BF 的回退代价","KMP 的主串指针不回退","最长相等前后缀"],
        principles: ["BF 失配时主串指针回到本次匹配起点的下一位、模式串指针归零，最坏 O(nm)","KMP 的核心观察：失配前已经比较过的字符是已知的，可以利用模式串自身的结构直接滑动","滑动的距离由「失配位置之前的子串的最长相等前后缀长度」决定，即 next 数组","KMP 主串指针只前进不回退，因此总比较次数 O(n+m)"],
        applications: ["文本编辑器查找","日志/代码扫描与关键字定位","作为 AC 自动机（多模式）的单模式基础"],
        pitfalls: ["以为 KMP 在任何输入上都比 BF 快很多（随机文本上两者接近）","把 next 数组与「最长相等前后缀长度」的下标口径搞混（差一）","模式串为空或长度大于主串时没有特判"],
        method: "先抓住「模式串与主串」与「BF 的回退代价」两个抓手，再用「BF 失配时主串指针回到本次匹配起点的下一位」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「朴素模式匹配与 KMP」做一次闭环练习：在「文本编辑器查找」的场景下，把示例「KMP 匹配主循环」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：以为 KMP 在任何输入上都比 BF 快很多（随机文本上两者为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "BF 每次失配主串指针回退；KMP 用已知信息让主串指针永不回退。",
            "核心结论：BF 失配时主串指针回到本次匹配起点的下一位、模式串指针归零，最坏 O(nm)"
          ],
          "mechanism": [
            "KMP 的核心观察：失配前已经比较过的字符是已知的，可以利用模式串自身的结构直接滑动",
            "滑动的距离由「失配位置之前的子串的最长相等前后缀长度」决定，即 next 数组"
          ],
          "example": {
            "title": "KMP 匹配主循环",
            "language": "c",
            "code": "int i = 0, j = 0;                       // i 主串、j 模式串\nwhile (i < n && j < m) {\n    if (j == -1 || s[i] == p[j]) { i++; j++; }\n    else j = next[j];                    // 主串指针 i 不回退\n}\nreturn j == m ? i - m : -1;              // 返回首次出现的位置",
            "explanation": "失配时只把模式串指针按 next 回退，主串指针继续前进，这是 KMP 优于 BF 的关键。"
          },
          "practiceSteps": [
            "用自己的话写出「模式串与主串」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「KMP 匹配主循环」，跑通后故意改错一处，观察失败现象。",
            "在「文本编辑器查找」场景里构造一个边界用例，确认不会踩到「以为 KMP 在任何输入上都比 BF 快很多（随」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「朴素模式匹配与 KMP」的核心机制，并说明复杂度或代价。",
            "能指出「以为 KMP 在任何输入上都比 BF 快很多（随」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
      {
        key: "ds-kmp-next",
        title: "next 数组的构造与手算",
        summary: "next[j] 表示模式串第 j 位失配时该退到哪一位，本质是求最长相等前后缀。",
        concepts: ["最长相等前后缀","next 的递推求法","nextval 优化","失配后滑动的含义"],
        principles: ["next[j] = 模式串前 j 个字符组成的子串中「最长相等前后缀」的长度","递推求 next：next[1]=0；若 p[k]==p[j] 则 next[j+1]=k+1，否则 k 继续回退","nextval 在 p[next[j]] == p[j] 时继续回退，避免相同的失配再做无用比较","next 只与模式串本身有关，与主串无关，因此可以预处理一次反复使用"],
        applications: ["KMP 预处理","字符串周期与循环节判断","前缀函数在竞赛/工程中的各种变体"],
        pitfalls: ["把 1 起始与 0 起始的 next 数组混用","求 next 时把「前后缀」理解成子串而不是真前缀/真后缀","忘记 next 与模式串下标口径必须一致"],
        method: "先抓住「最长相等前后缀」与「next 的递推求法」两个抓手，再用「next[j] = 模式串前 j 个字符组成的子串中「最长相等前后缀」的长度」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「next 数组的构造与手算」做一次闭环练习：在「KMP 预处理」的场景下，把示例「递推求 next 数组」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：把 1 起始与 0 起始的 next 数组混用为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "next[j] 表示模式串第 j 位失配时该退到哪一位，本质是求最长相等前后缀。",
            "核心结论：next[j] = 模式串前 j 个字符组成的子串中「最长相等前后缀」的长度"
          ],
          "mechanism": [
            "递推求 next：next[1]=0；若 p[k]==p[j] 则 next[j+1]=k+1，否则 k 继续回退",
            "nextval 在 p[next[j]] == p[j] 时继续回退，避免相同的失配再做无用比较"
          ],
          "example": {
            "title": "递推求 next 数组",
            "language": "c",
            "code": "void get_next(const char *p, int m, int *next) {\n    int i = 0, k = -1; next[0] = -1;            // 0 起始口径\n    while (i < m - 1) {\n        if (k == -1 || p[i] == p[k]) next[++i] = ++k;\n        else k = next[k];                       // 回退继续找更短的相等前后缀\n    }\n}",
            "explanation": "k 始终代表当前最长相等前后缀的长度；失配时让 k 退到 next[k] 继续尝试匹配。"
          },
          "practiceSteps": [
            "用自己的话写出「最长相等前后缀」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「递推求 next 数组」，跑通后故意改错一处，观察失败现象。",
            "在「KMP 预处理」场景里构造一个边界用例，确认不会踩到「把 1 起始与 0 起始的 next 数组混用」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「next 数组的构造与手算」的核心机制，并说明复杂度或代价。",
            "能指出「把 1 起始与 0 起始的 next 数组混用」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
    ],
    questionKeys: ["ds-string-basic-single","ds-string-basic-judge","ds-bf-kmp-single","ds-bf-kmp-judge","ds-kmp-next-single","ds-kmp-next-judge"],
  },
  {
    key: "ds-tree-basic",
    title: "树与二叉树",
    weeks: "第 7-8 周",
    goal: "掌握二叉树的五条性质、四种遍历与两种存储，并能把递归改写成显式栈。",
    outcome: "给定任意二叉树能写出三种遍历序列，并由两种序列唯一还原树形。",
    lesson: {
      "overview": [
        "掌握二叉树的五条性质、四种遍历与两种存储，并能把递归改写成显式栈。",
        "给定任意二叉树能写出三种遍历序列，并由两种序列唯一还原树形。"
      ],
      "studyLoop": [
        "先读「树的定义与基本术语」，在纸上手推一个最小样例",
        "按顺序实现本阶段核心代码，跑通后再补边界用例",
        "故意破坏一个前提，观察失败现象并定位原因",
        "把本阶段的易错点整理成自己的清单"
      ],
      "milestones": [
        {
          "title": "掌握：树的定义与基本术语",
          "evidence": "能独立完成「树的定义与基本术语」的示例与配套自测题。"
        },
        {
          "title": "掌握：二叉树的性质与存储",
          "evidence": "能独立完成「二叉树的性质与存储」的示例与配套自测题。"
        },
        {
          "title": "掌握：二叉树的四种遍历",
          "evidence": "能独立完成「二叉树的四种遍历」的示例与配套自测题。"
        },
        {
          "title": "掌握：线索二叉树",
          "evidence": "能独立完成「线索二叉树」的示例与配套自测题。"
        }
      ],
      "completionCriteria": [
        "能独立完成本阶段全部 4 个知识点的示例与自测。",
        "能用文字说清每个知识点的时间/空间复杂度与适用场景。",
        "给定任意二叉树能写出三种遍历序列，并由两种序列唯一还原树形。"
      ]
    },
    topics: [
      {
        key: "ds-tree-concept",
        title: "树的定义与基本术语",
        summary: "树是 n 个结点的有限集合，只有唯一根；度、层次、高度各有精确定义。",
        concepts: ["根与子树","结点的度与树的度","层次、深度与高度","森林"],
        principles: ["除根外每个结点有且仅有一个前驱（双亲），因此 n 个结点的树恰有 n-1 条边","结点的度是孩子个数；树的度是所有结点度的最大值","根的层次为 1，结点深度即根到它的路径长度加一；树的高度是结点最大层次","度为 k 的树中第 i 层最多有 k^(i-1) 个结点"],
        applications: ["文件系统目录结构","组织架构与分类体系","DOM/语法树等层次数据建模"],
        pitfalls: ["把「深度」与「高度」混用（一个自上而下、一个自下而上）","误以为树中可以有多个根","忽略「n-1 条边」这一约束去构造不可能存在的树"],
        method: "先抓住「根与子树」与「结点的度与树的度」两个抓手，再用「除根外每个结点有且仅有一个前驱（双亲）」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「树的定义与基本术语」做一次闭环练习：在「文件系统目录结构」的场景下，把示例「树的基本量统计」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：把「深度」与「高度」混用（一个自上而下为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "树是 n 个结点的有限集合，只有唯一根；度、层次、高度各有精确定义。",
            "核心结论：除根外每个结点有且仅有一个前驱（双亲），因此 n 个结点的树恰有 n-1 条边"
          ],
          "mechanism": [
            "结点的度是孩子个数；树的度是所有结点度的最大值",
            "根的层次为 1，结点深度即根到它的路径长度加一；树的高度是结点最大层次"
          ],
          "example": {
            "title": "树的基本量统计",
            "language": "c",
            "code": "typedef struct TreeNode {\n    int data;\n    struct TreeNode *first_child, *next_sibling;   // 孩子—兄弟表示法\n} TreeNode;\n// 结点数 n 与边数 e 恒满足 e = n - 1；用该式可快速判断输入是否成树",
            "explanation": "孩子—兄弟表示法把任意树转成二叉树形式，是「树转二叉树」的基础。"
          },
          "practiceSteps": [
            "用自己的话写出「根与子树」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「树的基本量统计」，跑通后故意改错一处，观察失败现象。",
            "在「文件系统目录结构」场景里构造一个边界用例，确认不会踩到「把「深度」与「高度」混用（一个自上而下」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「树的定义与基本术语」的核心机制，并说明复杂度或代价。",
            "能指出「把「深度」与「高度」混用（一个自上而下」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
      {
        key: "ds-binary-tree-props",
        title: "二叉树的性质与存储",
        summary: "每个结点最多两个孩子；五条性质是几乎所有二叉树题的解题工具。",
        concepts: ["满二叉树与完全二叉树","第 i 层结点数上界","n0 = n2 + 1","顺序存储与链式存储"],
        principles: ["二叉树第 i 层最多 2^(i-1) 个结点，深度为 h 的二叉树最多 2^h - 1 个结点","叶子数 n0 与度为 2 的结点数 n2 恒满足 n0 = n2 + 1","完全二叉树按层序编号后，结点 i 的左孩子为 2i、右孩子为 2i+1、双亲为 ⌊i/2⌋","n 个结点的完全二叉树高度为 ⌈log2(n+1)⌉；顺序存储浪费少，适合完全二叉树"],
        applications: ["堆（完全二叉树的顺序存储）","线段树/树状数组的下标设计","表达式树与语法分析"],
        pitfalls: ["把完全二叉树当满二叉树用（前者最后一层可以不满）","在非完全二叉树上使用 2i/2i+1 的孩子下标公式","用 n0 = n2 + 1 时把度为 1 的结点数也算进去"],
        method: "先抓住「满二叉树与完全二叉树」与「第 i 层结点数上界」两个抓手，再用「二叉树第 i 层最多 2^(i-1) 个结点」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「二叉树的性质与存储」做一次闭环练习：在「堆（完全二叉树的顺序存储）」的场景下，把示例「顺序存储下的父子下标」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：把完全二叉树当满二叉树用（前者最后一层可以不满）为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "每个结点最多两个孩子；五条性质是几乎所有二叉树题的解题工具。",
            "核心结论：二叉树第 i 层最多 2^(i-1) 个结点，深度为 h 的二叉树最多 2^h - 1 个结点"
          ],
          "mechanism": [
            "叶子数 n0 与度为 2 的结点数 n2 恒满足 n0 = n2 + 1",
            "完全二叉树按层序编号后，结点 i 的左孩子为 2i、右孩子为 2i+1、双亲为 ⌊i/2⌋"
          ],
          "example": {
            "title": "顺序存储下的父子下标",
            "language": "c",
            "code": "// 完全二叉树按层序存入 1..n（下标 0 不用）\nint left(int i)  { return 2 * i; }\nint right(int i) { return 2 * i + 1; }\nint parent(int i) { return i / 2; }\n// 结论：n 个结点的完全二叉树高度 = ceil(log2(n + 1))",
            "explanation": "顺序存储让「找孩子/双亲」变成算术运算，这正是堆能用数组实现的原因。"
          },
          "practiceSteps": [
            "用自己的话写出「满二叉树与完全二叉树」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「顺序存储下的父子下标」，跑通后故意改错一处，观察失败现象。",
            "在「堆（完全二叉树的顺序存储）」场景里构造一个边界用例，确认不会踩到「把完全二叉树当满二叉树用（前者最后一层可以不满）」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「二叉树的性质与存储」的核心机制，并说明复杂度或代价。",
            "能指出「把完全二叉树当满二叉树用（前者最后一层可以不满）」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
      {
        key: "ds-binary-tree-traverse",
        title: "二叉树的四种遍历",
        summary: "先序/中序/后序按根的位置命名，层序用队列；递归与显式栈两种写法都要会。",
        concepts: ["先序/中序/后序","层序遍历（BFS）","递归与显式栈","由两种遍历还原树"],
        principles: ["三种深度优先遍历的区别只是「访问根」发生在左右子树之前/之间/之后","中序 + 先序（或中序 + 后序）可以唯一确定一棵二叉树；只有先序 + 后序不行","层序遍历用队列：出队时访问，并把左右孩子依次入队","递归转非递归：先序用栈直接模拟，中序需沿左链一路压栈"],
        applications: ["表达式树求值（后序）","BST 中序得到有序序列","序列化/反序列化与目录遍历"],
        pitfalls: ["用先序 + 后序去还原二叉树（不唯一）","层序遍历时把访问放在入队前，导致顺序错乱","中序非递归忘记在弹栈后再转向右子树"],
        method: "先抓住「先序/中序/后序」与「层序遍历（BFS）」两个抓手，再用「三种深度优先遍历的区别只是「访问根」发生在左右子树之前/之间/之后」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「二叉树的四种遍历」做一次闭环练习：在「表达式树求值（后序）」的场景下，把示例「先序/中序/后序的递归骨架」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：用先序 + 后序去还原二叉树（不唯一）为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "先序/中序/后序按根的位置命名，层序用队列；递归与显式栈两种写法都要会。",
            "核心结论：三种深度优先遍历的区别只是「访问根」发生在左右子树之前/之间/之后"
          ],
          "mechanism": [
            "中序 + 先序（或中序 + 后序）可以唯一确定一棵二叉树；只有先序 + 后序不行",
            "层序遍历用队列：出队时访问，并把左右孩子依次入队"
          ],
          "example": {
            "title": "先序/中序/后序的递归骨架",
            "language": "c",
            "code": "void preorder(Node *t)  { if (!t) return; visit(t); preorder(t->l); preorder(t->r); }\nvoid inorder(Node *t)   { if (!t) return; inorder(t->l); visit(t); inorder(t->r); }\nvoid postorder(Node *t) { if (!t) return; postorder(t->l); postorder(t->r); visit(t); }",
            "explanation": "三个函数只有 visit 的位置不同，把 visit 当成「在什么时候处理根」来记即可。"
          },
          "practiceSteps": [
            "用自己的话写出「先序/中序/后序」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「先序/中序/后序的递归骨架」，跑通后故意改错一处，观察失败现象。",
            "在「表达式树求值（后序）」场景里构造一个边界用例，确认不会踩到「用先序 + 后序去还原二叉树（不唯一）」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「二叉树的四种遍历」的核心机制，并说明复杂度或代价。",
            "能指出「用先序 + 后序去还原二叉树（不唯一）」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
        animations: ["anim-tree-traversal"],
      },
      {
        key: "ds-threaded-tree",
        title: "线索二叉树",
        summary: "把空指针域改成指向前驱/后继的线索，遍历不再需要栈。",
        concepts: ["空指针域的浪费","前驱与后继线索","ltag/rtag 标志位","线索化与线索遍历"],
        principles: ["n 个结点的二叉树有 n+1 个空指针域，线索化就是把这些空域利用起来","左空域指向前驱、右空域指向后继，并用 ltag/rtag 区分「孩子」与「线索」","中序线索化后可以在 O(1) 空间、O(n) 时间完成遍历，不需要递归或栈","在中序线索二叉树中找后继：有右孩子就找右子树最左结点，否则 rtag 直接给出后继"],
        applications: ["内存受限的嵌入式遍历","需要频繁取前驱/后继的有序结构","教学与考研高频考点"],
        pitfalls: ["忘记维护 tag 标志位，把线索当成孩子指针","线索化时前驱指针（pre）没有正确更新","以为线索化后不能再插删结点（可以，但需要同步修线索）"],
        method: "先抓住「空指针域的浪费」与「前驱与后继线索」两个抓手，再用「n 个结点的二叉树有 n+1 个空指针域」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「线索二叉树」做一次闭环练习：在「内存受限的嵌入式遍历」的场景下，把示例「中序线索化的递归骨架」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：忘记维护 tag 标志位为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "把空指针域改成指向前驱/后继的线索，遍历不再需要栈。",
            "核心结论：n 个结点的二叉树有 n+1 个空指针域，线索化就是把这些空域利用起来"
          ],
          "mechanism": [
            "左空域指向前驱、右空域指向后继，并用 ltag/rtag 区分「孩子」与「线索」",
            "中序线索化后可以在 O(1) 空间、O(n) 时间完成遍历，不需要递归或栈"
          ],
          "example": {
            "title": "中序线索化的递归骨架",
            "language": "c",
            "code": "Node *pre = NULL;\nvoid thread(Node *p) {\n    if (!p) return;\n    thread(p->l);\n    if (!p->l) { p->l = pre;  p->ltag = 1; }   // 左空 -> 前驱\n    if (pre && !pre->r) { pre->r = p; pre->rtag = 1; }   // 前驱的右空 -> 后继\n    pre = p;\n    thread(p->r);\n}",
            "explanation": "在中序位置处理线索：左空指向前驱，同时回填前驱的右空指向当前结点。"
          },
          "practiceSteps": [
            "用自己的话写出「空指针域的浪费」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「中序线索化的递归骨架」，跑通后故意改错一处，观察失败现象。",
            "在「内存受限的嵌入式遍历」场景里构造一个边界用例，确认不会踩到「忘记维护 tag 标志位」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「线索二叉树」的核心机制，并说明复杂度或代价。",
            "能指出「忘记维护 tag 标志位」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
    ],
    questionKeys: ["ds-tree-concept-single","ds-tree-concept-judge","ds-binary-tree-props-single","ds-binary-tree-props-judge","ds-binary-tree-traverse-single","ds-binary-tree-traverse-judge","ds-threaded-tree-single","ds-threaded-tree-judge"],
  },
  {
    key: "ds-tree-search",
    title: "查找树与平衡树",
    weeks: "第 9-10 周",
    goal: "掌握 BST/AVL/哈夫曼/B 树四类结构的组织方式与各自的代价边界。",
    outcome: "能解释「为什么有序数组不够、为什么需要平衡」，并算出各结构的高度与操作代价。",
    lesson: {
      "overview": [
        "掌握 BST/AVL/哈夫曼/B 树四类结构的组织方式与各自的代价边界。",
        "能解释「为什么有序数组不够、为什么需要平衡」，并算出各结构的高度与操作代价。"
      ],
      "studyLoop": [
        "先读「二叉排序树（BST）」，在纸上手推一个最小样例",
        "按顺序实现本阶段核心代码，跑通后再补边界用例",
        "故意破坏一个前提，观察失败现象并定位原因",
        "把本阶段的易错点整理成自己的清单"
      ],
      "milestones": [
        {
          "title": "掌握：二叉排序树（BST）",
          "evidence": "能独立完成「二叉排序树（BST）」的示例与配套自测题。"
        },
        {
          "title": "掌握：平衡二叉树（AVL）与旋转",
          "evidence": "能独立完成「平衡二叉树（AVL）与旋转」的示例与配套自测题。"
        },
        {
          "title": "掌握：哈夫曼树与哈夫曼编码",
          "evidence": "能独立完成「哈夫曼树与哈夫曼编码」的示例与配套自测题。"
        },
        {
          "title": "掌握：B 树与 B+ 树",
          "evidence": "能独立完成「B 树与 B+ 树」的示例与配套自测题。"
        }
      ],
      "completionCriteria": [
        "能独立完成本阶段全部 4 个知识点的示例与自测。",
        "能用文字说清每个知识点的时间/空间复杂度与适用场景。",
        "能解释「为什么有序数组不够、为什么需要平衡」，并算出各结构的高度与操作代价。"
      ]
    },
    topics: [
      {
        key: "ds-bst",
        title: "二叉排序树（BST）",
        summary: "左小右大的二叉树，查找/插入/删除都沿一条路径下降。",
        concepts: ["BST 的定义","查找路径长度","插入与构造","删除的三种情形"],
        principles: ["BST 的查找沿根向下比较，路径长度取决于树高，平均 O(log n)、最坏 O(n)","中序遍历 BST 得到递增序列，这是判断一棵树是否为 BST 的可靠方法","删除分三种：叶子直接删；只有一个孩子用孩子顶替；有两个孩子用中序前驱/后继顶替","按有序序列依次插入会退化成单支树，这是 BST 需要平衡的根本原因"],
        applications: ["有序集合/映射（map/set）的朴素实现","范围查询与排名","作为 AVL、红黑树的语义基础"],
        pitfalls: ["只比较父结点就判断 BST（必须满足整棵左右子树的区间约束）","删除双孩子结点时直接删掉，导致中序序列被破坏","以为插入顺序不影响树高"],
        method: "先抓住「BST 的定义」与「查找路径长度」两个抓手，再用「BST 的查找沿根向下比较」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「二叉排序树（BST）」做一次闭环练习：在「有序集合/映射（map/set）的朴素实现」的场景下，把示例「BST 查找（迭代版）」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：只比较父结点就判断 BST（必须满足整棵左右子树的区间约束）为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "左小右大的二叉树，查找/插入/删除都沿一条路径下降。",
            "核心结论：BST 的查找沿根向下比较，路径长度取决于树高，平均 O(log n)、最坏 O(n)"
          ],
          "mechanism": [
            "中序遍历 BST 得到递增序列，这是判断一棵树是否为 BST 的可靠方法",
            "删除分三种：叶子直接删；只有一个孩子用孩子顶替；有两个孩子用中序前驱/后继顶替"
          ],
          "example": {
            "title": "BST 查找（迭代版）",
            "language": "c",
            "code": "Node *find(Node *t, int key) {\n    while (t && t->data != key)\n        t = key < t->data ? t->l : t->r;   // 小往左、大往右\n    return t;                              // 找不到时 t 为 NULL\n}",
            "explanation": "每步排除一整棵子树，代价等于走过的路径长度，因此是 O(树高)。"
          },
          "practiceSteps": [
            "用自己的话写出「BST 的定义」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「BST 查找（迭代版）」，跑通后故意改错一处，观察失败现象。",
            "在「有序集合/映射（map/set）的朴素实现」场景里构造一个边界用例，确认不会踩到「只比较父结点就判断 BST（必须满足整棵左右子树」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「二叉排序树（BST）」的核心机制，并说明复杂度或代价。",
            "能指出「只比较父结点就判断 BST（必须满足整棵左右子树」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
        animations: ["anim-bst-search"],
      },
      {
        key: "ds-avl",
        title: "平衡二叉树（AVL）与旋转",
        summary: "任意结点左右子树高度差不超过 1，用旋转在插入/删除后恢复平衡。",
        concepts: ["平衡因子","最小不平衡子树","LL/RR/LR/RL 四种旋转","AVL 的高度上界"],
        principles: ["平衡因子 = 左子树高 - 右子树高，AVL 要求所有结点平衡因子 ∈ {-1,0,1}","插入后从新结点向上找到第一个失衡结点，只调整以它为根的「最小不平衡子树」即可","四种旋转按失衡类型命名：LL 右旋、RR 左旋、LR 先左后右、RL 先右后左","含 n 个结点的 AVL 树高不超过约 1.44·log₂n，因此查找/插入/删除都是 O(log n)"],
        applications: ["需要稳定 O(log n) 的有序索引","内存数据库/索引结构（工程多用红黑树，思想同源）","教学与考研高频"],
        pitfalls: ["旋转后忘记更新相关结点的高度/平衡因子","把 LR/RL 当成一次旋转处理（必须两次）","以为 AVL 比红黑树更适合频繁插删（AVL 旋转更频繁）"],
        method: "先抓住「平衡因子」与「最小不平衡子树」两个抓手，再用「平衡因子 = 左子树高 - 右子树高」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「平衡二叉树（AVL）与旋转」做一次闭环练习：在「需要稳定 O(log n) 的有序索引」的场景下，把示例「LL 型失衡的右旋」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：旋转后忘记更新相关结点的高度/平衡因子为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "任意结点左右子树高度差不超过 1，用旋转在插入/删除后恢复平衡。",
            "核心结论：平衡因子 = 左子树高 - 右子树高，AVL 要求所有结点平衡因子 ∈ {-1,0,1}"
          ],
          "mechanism": [
            "插入后从新结点向上找到第一个失衡结点，只调整以它为根的「最小不平衡子树」即可",
            "四种旋转按失衡类型命名：LL 右旋、RR 左旋、LR 先左后右、RL 先右后左"
          ],
          "example": {
            "title": "LL 型失衡的右旋",
            "language": "c",
            "code": "Node *rightRotate(Node *y) {\n    Node *x = y->l;\n    y->l = x->r;      // x 的右子树挂到 y 的左边\n    x->r = y;         // y 成为 x 的右孩子\n    updateHeight(y);  // 先更新 y，再更新 x\n    updateHeight(x);\n    return x;         // 新的子树根\n}",
            "explanation": "右旋把「左重」的结构抬起来；只要顺序正确，BST 的中序有序性不会破坏。"
          },
          "practiceSteps": [
            "用自己的话写出「平衡因子」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「LL 型失衡的右旋」，跑通后故意改错一处，观察失败现象。",
            "在「需要稳定 O(log n) 的有序索引」场景里构造一个边界用例，确认不会踩到「旋转后忘记更新相关结点的高度/平衡因子」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「平衡二叉树（AVL）与旋转」的核心机制，并说明复杂度或代价。",
            "能指出「旋转后忘记更新相关结点的高度/平衡因子」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
      {
        key: "ds-huffman",
        title: "哈夫曼树与哈夫曼编码",
        summary: "每次合并权值最小的两棵树；带权路径长度最短，编码是前缀码。",
        concepts: ["带权路径长度 WPL","贪心建树","前缀编码","哈夫曼编码的长度"],
        principles: ["哈夫曼树是 WPL 最小的二叉树；构造用贪心：反复取权值最小的两棵树合并","n 个叶子的哈夫曼树共有 2n-1 个结点，没有度为 1 的结点","编码时左 0 右 1，字符都在叶子上，因此任意编码都不是另一个的前缀（前缀码，可唯一解码）","权值越大的字符路径越短，这正是压缩的原理"],
        applications: ["无损压缩（ZIP/JPEG 的熵编码思想）","变长编码设计","带权最优判定树"],
        pitfalls: ["把权值最大的先合并（必须合并最小的）","以为哈夫曼编码唯一（相同权值可有多种合并顺序，编码不唯一但长度最优）","把字符放在内部结点导致无法解码"],
        method: "先抓住「带权路径长度 WPL」与「贪心建树」两个抓手，再用「哈夫曼树是 WPL 最小的二叉树」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「哈夫曼树与哈夫曼编码」做一次闭环练习：在「无损压缩（ZIP/JPEG 的熵编码思想）」的场景下，把示例「哈夫曼树的贪心构造」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：把权值最大的先合并（必须合并最小的）为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "每次合并权值最小的两棵树；带权路径长度最短，编码是前缀码。",
            "核心结论：哈夫曼树是 WPL 最小的二叉树；构造用贪心：反复取权值最小的两棵树合并"
          ],
          "mechanism": [
            "n 个叶子的哈夫曼树共有 2n-1 个结点，没有度为 1 的结点",
            "编码时左 0 右 1，字符都在叶子上，因此任意编码都不是另一个的前缀（前缀码，可唯一解码）"
          ],
          "example": {
            "title": "哈夫曼树的贪心构造",
            "language": "c",
            "code": "// 权值集合 {2,3,4,5}\n// 1) 取 2,3 合并成 5     2) 取 4,5 合并成 9\n// 3) 取 5,9 合并成 14   -> WPL = (2+3)*3 + 4*2 + 5*1 = 28\n// 每次都用最小堆取两个最小权值，复杂度 O(n log n)",
            "explanation": "反复合并最小权值即可得到 WPL 最小的树；用最小堆实现合并过程是 O(n log n)。"
          },
          "practiceSteps": [
            "用自己的话写出「带权路径长度 WPL」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「哈夫曼树的贪心构造」，跑通后故意改错一处，观察失败现象。",
            "在「无损压缩（ZIP/JPEG 的熵编码思想）」场景里构造一个边界用例，确认不会踩到「把权值最大的先合并（必须合并最小的）」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「哈夫曼树与哈夫曼编码」的核心机制，并说明复杂度或代价。",
            "能指出「把权值最大的先合并（必须合并最小的）」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
      {
        key: "ds-btree",
        title: "B 树与 B+ 树",
        summary: "多路平衡查找树：一个结点存多个关键字、多个孩子，把树高压到很低。",
        concepts: ["m 阶 B 树的定义","结点分裂与合并","B+ 树的叶子链表","磁盘 I/O 与树高"],
        principles: ["m 阶 B 树每个结点最多 m 个孩子、m-1 个关键字；根至少 2 个孩子，其余非叶结点至少 ⌈m/2⌉ 个孩子","插入导致关键字数超过上限时分裂结点并把中间关键字上移到双亲","B+ 树只在叶子存数据、叶子用链表串起来，因此范围查询只需顺序扫叶子","降低树高的意义在于减少磁盘 I/O：一次结点访问约等于一次页读取"],
        applications: ["数据库索引（InnoDB 用 B+ 树）","文件系统目录索引","海量键值的磁盘友好索引"],
        pitfalls: ["把 B 树与二叉排序树混淆（B 树是多路而非二叉）","以为 B+ 树内部结点也存数据记录","忽略「所有叶子在同一层」这一硬性约束"],
        method: "先抓住「m 阶 B 树的定义」与「结点分裂与合并」两个抓手，再用「m 阶 B 树每个结点最多 m 个孩子」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「B 树与 B+ 树」做一次闭环练习：在「数据库索引（InnoDB 用 B+ 树）」的场景下，把示例「3 阶 B 树的插入分裂」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：把 B 树与二叉排序树混淆（B 树是多路而非二叉）为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "多路平衡查找树：一个结点存多个关键字、多个孩子，把树高压到很低。",
            "核心结论：m 阶 B 树每个结点最多 m 个孩子、m-1 个关键字；根至少 2 个孩子，其余非叶结点至少 ⌈m/2⌉ 个孩子"
          ],
          "mechanism": [
            "插入导致关键字数超过上限时分裂结点并把中间关键字上移到双亲",
            "B+ 树只在叶子存数据、叶子用链表串起来，因此范围查询只需顺序扫叶子"
          ],
          "example": {
            "title": "3 阶 B 树的插入分裂",
            "language": "text",
            "code": "# 3 阶 B 树：每个结点最多 2 个关键字\n插入 1,2 -> [1,2]\n插入 3 -> 溢出 [1,2,3] -> 中间关键字 2 上移\n           [2]\n          /   \\\n       [1]     [3]\n# 结果：一次分裂把长链变成两层，树高不再随插入线性增长",
            "explanation": "分裂把中间关键字交给双亲，保证所有叶子同层，从而把树高控制在 O(log n)。"
          },
          "practiceSteps": [
            "用自己的话写出「m 阶 B 树的定义」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「3 阶 B 树的插入分裂」，跑通后故意改错一处，观察失败现象。",
            "在「数据库索引（InnoDB 用 B+ 树）」场景里构造一个边界用例，确认不会踩到「把 B 树与二叉排序树混淆（B 树是多路而非二叉」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「B 树与 B+ 树」的核心机制，并说明复杂度或代价。",
            "能指出「把 B 树与二叉排序树混淆（B 树是多路而非二叉」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
    ],
    questionKeys: ["ds-bst-single","ds-bst-judge","ds-avl-single","ds-avl-judge","ds-huffman-single","ds-huffman-judge","ds-btree-single","ds-btree-judge"],
  },
  {
    key: "ds-heap",
    title: "堆与优先队列",
    weeks: "第 11 周",
    goal: "掌握堆的数组表示、上浮下沉与建堆的线性代价，并理解堆排序与优先队列。",
    outcome: "能手写 sift_down，并说明为什么自底向上建堆是 O(n) 而不是 O(n log n)。",
    lesson: {
      "overview": [
        "掌握堆的数组表示、上浮下沉与建堆的线性代价，并理解堆排序与优先队列。",
        "能手写 sift_down，并说明为什么自底向上建堆是 O(n) 而不是 O(n log n)。"
      ],
      "studyLoop": [
        "先读「堆的定义、建堆与调整」，在纸上手推一个最小样例",
        "按顺序实现本阶段核心代码，跑通后再补边界用例",
        "故意破坏一个前提，观察失败现象并定位原因",
        "把本阶段的易错点整理成自己的清单"
      ],
      "milestones": [
        {
          "title": "掌握：堆的定义、建堆与调整",
          "evidence": "能独立完成「堆的定义、建堆与调整」的示例与配套自测题。"
        },
        {
          "title": "掌握：堆排序",
          "evidence": "能独立完成「堆排序」的示例与配套自测题。"
        },
        {
          "title": "掌握：优先队列与堆的工程应用",
          "evidence": "能独立完成「优先队列与堆的工程应用」的示例与配套自测题。"
        }
      ],
      "completionCriteria": [
        "能独立完成本阶段全部 3 个知识点的示例与自测。",
        "能用文字说清每个知识点的时间/空间复杂度与适用场景。",
        "能手写 sift_down，并说明为什么自底向上建堆是 O(n) 而不是 O(n log n)。"
      ]
    },
    topics: [
      {
        key: "ds-heap-basic",
        title: "堆的定义、建堆与调整",
        summary: "堆是完全二叉树，且每个结点都不大于（或不小于）其孩子。",
        concepts: ["大根堆与小根堆","数组表示","上浮与下沉","自底向上建堆 O(n)"],
        principles: ["堆用数组顺序存储完全二叉树，父下标 i/2、子下标 2i 与 2i+1","插入新元素放在末尾再上浮；删除堆顶把末尾元素换到根再下沉，两者都是 O(log n)","自底向上建堆从最后一个非叶结点 i=⌊n/2⌋ 起依次下沉，总代价是 O(n)","堆只保证「父子有序」，不保证兄弟或整棵树有序；同层元素无固定顺序"],
        applications: ["优先队列","Top-K 与流式中位数","Dijkstra/Prim/哈夫曼的高效取最小实现"],
        pitfalls: ["以为堆数组整体有序（堆只保证局部父子关系）","用逐个插入的方式建堆（那是 O(n log n)）","下沉时只比较一次就结束，没有继续向下维持堆序"],
        method: "先抓住「大根堆与小根堆」与「数组表示」两个抓手，再用「堆用数组顺序存储完全二叉树」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「堆的定义、建堆与调整」做一次闭环练习：在「优先队列」的场景下，把示例「下沉（sift down）」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：以为堆数组整体有序（堆只保证局部父子关系）为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "堆是完全二叉树，且每个结点都不大于（或不小于）其孩子。",
            "核心结论：堆用数组顺序存储完全二叉树，父下标 i/2、子下标 2i 与 2i+1"
          ],
          "mechanism": [
            "插入新元素放在末尾再上浮；删除堆顶把末尾元素换到根再下沉，两者都是 O(log n)",
            "自底向上建堆从最后一个非叶结点 i=⌊n/2⌋ 起依次下沉，总代价是 O(n)"
          ],
          "example": {
            "title": "下沉（sift down）",
            "language": "c",
            "code": "void siftDown(int a[], int n, int i) {\n    while (2 * i <= n) {\n        int c = 2 * i;                              // 左孩子\n        if (c + 1 <= n && a[c + 1] > a[c]) c++;     // 选较大的孩子\n        if (a[i] >= a[c]) break;                    // 已满足堆序\n        swap(&a[i], &a[c]); i = c;                  // 换下去继续\n    }\n}\n// 建堆：for (int i = n / 2; i >= 1; i--) siftDown(a, n, i);",
            "explanation": "每次和「较大的那个孩子」交换才能保证换上去后仍满足堆序；建堆从 n/2 倒着做。"
          },
          "practiceSteps": [
            "用自己的话写出「大根堆与小根堆」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「下沉（sift down）」，跑通后故意改错一处，观察失败现象。",
            "在「优先队列」场景里构造一个边界用例，确认不会踩到「以为堆数组整体有序（堆只保证局部父子关系）」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「堆的定义、建堆与调整」的核心机制，并说明复杂度或代价。",
            "能指出「以为堆数组整体有序（堆只保证局部父子关系）」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
        animations: ["anim-heap-sift"],
      },
      {
        key: "ds-heap-sort",
        title: "堆排序",
        summary: "建堆后反复把堆顶与末尾交换再缩小堆，原地且 O(n log n)。",
        concepts: ["堆排序两阶段","原地排序","不稳定性","与快排的对比"],
        principles: ["堆排序分两步：先 O(n) 建大根堆，再 n-1 次「换堆顶到末尾 + 堆缩小后下沉」","每次把当前最大值放到数组末尾，因此最终得到递增序列（大根堆）","堆排序是原地排序，额外空间 O(1)；总时间 O(n log n)，最坏也是 O(n log n)","堆排序不稳定，且跳跃访问对缓存不友好，因此工程中常不如快排快"],
        applications: ["要求最坏 O(n log n) 且空间 O(1) 的场合","只要 Top-K 时用「只建 k 个元素的小根堆」","嵌入式/内存紧张的排序"],
        pitfalls: ["把「堆缩小」忘了，导致已排好的尾部又被参与调整","以为堆排序稳定","每次都用 sift_up 去找最大值而不是直接取堆顶"],
        method: "先抓住「堆排序两阶段」与「原地排序」两个抓手，再用「堆排序分两步：先 O(n) 建大根堆」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「堆排序」做一次闭环练习：在「要求最坏 O(n log n) 且空间 O(1) 的场合」的场景下，把示例「堆排序主体」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：把「堆缩小」忘了为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "建堆后反复把堆顶与末尾交换再缩小堆，原地且 O(n log n)。",
            "核心结论：堆排序分两步：先 O(n) 建大根堆，再 n-1 次「换堆顶到末尾 + 堆缩小后下沉」"
          ],
          "mechanism": [
            "每次把当前最大值放到数组末尾，因此最终得到递增序列（大根堆）",
            "堆排序是原地排序，额外空间 O(1)；总时间 O(n log n)，最坏也是 O(n log n)"
          ],
          "example": {
            "title": "堆排序主体",
            "language": "c",
            "code": "for (int i = n / 2; i >= 1; i--) siftDown(a, n, i);   // 建大根堆 O(n)\nfor (int end = n; end > 1; end--) {\n    swap(&a[1], &a[end]);        // 最大值换到末尾\n    siftDown(a, end - 1, 1);     // 堆缩小到 end-1 后恢复到堆序\n}",
            "explanation": "每轮把堆顶（当前最大）固定到尾部，再对缩小后的前缀恢复堆序，直到只剩一个元素。"
          },
          "practiceSteps": [
            "用自己的话写出「堆排序两阶段」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「堆排序主体」，跑通后故意改错一处，观察失败现象。",
            "在「要求最坏 O(n log n) 且空间 O(1) 的场合」场景里构造一个边界用例，确认不会踩到「把「堆缩小」忘了」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「堆排序」的核心机制，并说明复杂度或代价。",
            "能指出「把「堆缩小」忘了」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
      {
        key: "ds-priority-queue",
        title: "优先队列与堆的工程应用",
        summary: "按优先级而非到达顺序出队；堆是实现优先队列的标准结构。",
        concepts: ["优先队列语义","Top-K 的小根堆","流式中位数（双堆）","延迟删除"],
        principles: ["优先队列每次弹出优先级最高（或最低）的元素，堆把它实现为 O(log n) 的入队出队","求「最大的 k 个」时维护大小为 k 的小根堆：新元素比堆顶大才替换，总代价 O(n log k)","求流式数据中位数用两个堆：大根堆存较小一半、小根堆存较大一半，并保持大小差不超过 1","需要按 key 更新优先级时，常见做法是「延迟删除」：旧记录留在堆里，弹出时判断是否过期"],
        applications: ["任务调度与定时器","Top-K 榜单与热搜","图算法（Dijkstra/Prim）的取最小边"],
        pitfalls: ["求 Top-K 最大值时用了大根堆，导致要多存 n 个元素","延迟删除时忘记记录「最新优先级」而拿旧值比较","双堆法忘记在插入后平衡两堆大小"],
        method: "先抓住「优先队列语义」与「Top-K 的小根堆」两个抓手，再用「优先队列每次弹出优先级最高（或最低）的元素」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「优先队列与堆的工程应用」做一次闭环练习：在「任务调度与定时器」的场景下，把示例「Top-K：大小固定为 k 的小根堆」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：求 Top-K 最大值时用了大根堆为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "按优先级而非到达顺序出队；堆是实现优先队列的标准结构。",
            "核心结论：优先队列每次弹出优先级最高（或最低）的元素，堆把它实现为 O(log n) 的入队出队"
          ],
          "mechanism": [
            "求「最大的 k 个」时维护大小为 k 的小根堆：新元素比堆顶大才替换，总代价 O(n log k)",
            "求流式数据中位数用两个堆：大根堆存较小一半、小根堆存较大一半，并保持大小差不超过 1"
          ],
          "example": {
            "title": "Top-K：大小固定为 k 的小根堆",
            "language": "c",
            "code": "// 求数组里最大的 k 个数：维护大小为 k 的小根堆\nfor (int i = 0; i < n; i++) {\n    if (size(&h) < k) push_min(&h, a[i]);\n    else if (a[i] > top_min(&h)) { pop_min(&h); push_min(&h, a[i]); }\n}\n// 结束时堆里就是最大的 k 个；复杂度 O(n log k)，空间 O(k)",
            "explanation": "小根堆的堆顶是当前 k 个里的最小值，只有更大的元素才值得挤掉它，因此空间只需 O(k)。"
          },
          "practiceSteps": [
            "用自己的话写出「优先队列语义」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「Top-K：大小固定为 k 的小根堆」，跑通后故意改错一处，观察失败现象。",
            "在「任务调度与定时器」场景里构造一个边界用例，确认不会踩到「求 Top-K 最大值时用了大根堆」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「优先队列与堆的工程应用」的核心机制，并说明复杂度或代价。",
            "能指出「求 Top-K 最大值时用了大根堆」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
    ],
    questionKeys: ["ds-heap-basic-single","ds-heap-basic-judge","ds-heap-sort-single","ds-heap-sort-judge","ds-priority-queue-single","ds-priority-queue-judge"],
  },
  {
    key: "ds-graph",
    title: "图",
    weeks: "第 12-13 周",
    goal: "掌握图的两种存储、两种遍历与四类经典问题（生成树/最短路/拓扑/关键路径）。",
    outcome: "给定问题约束（有权无权、有向无向、负权与否）能选对算法并说出复杂度。",
    lesson: {
      "overview": [
        "掌握图的两种存储、两种遍历与四类经典问题（生成树/最短路/拓扑/关键路径）。",
        "给定问题约束（有权无权、有向无向、负权与否）能选对算法并说出复杂度。"
      ],
      "studyLoop": [
        "先读「图的定义与存储结构」，在纸上手推一个最小样例",
        "按顺序实现本阶段核心代码，跑通后再补边界用例",
        "故意破坏一个前提，观察失败现象并定位原因",
        "把本阶段的易错点整理成自己的清单"
      ],
      "milestones": [
        {
          "title": "掌握：图的定义与存储结构",
          "evidence": "能独立完成「图的定义与存储结构」的示例与配套自测题。"
        },
        {
          "title": "掌握：图的遍历：BFS 与 DFS",
          "evidence": "能独立完成「图的遍历：BFS 与 DFS」的示例与配套自测题。"
        },
        {
          "title": "掌握：最小生成树：Prim 与 Kruskal",
          "evidence": "能独立完成「最小生成树：Prim 与 Kruskal」的示例与配套自测题。"
        },
        {
          "title": "掌握：最短路径：Dijkstra 与 Floyd",
          "evidence": "能独立完成「最短路径：Dijkstra 与 Floyd」的示例与配套自测题。"
        },
        {
          "title": "掌握：拓扑排序与关键路径",
          "evidence": "能独立完成「拓扑排序与关键路径」的示例与配套自测题。"
        }
      ],
      "completionCriteria": [
        "能独立完成本阶段全部 5 个知识点的示例与自测。",
        "能用文字说清每个知识点的时间/空间复杂度与适用场景。",
        "给定问题约束（有权无权、有向无向、负权与否）能选对算法并说出复杂度。"
      ]
    },
    topics: [
      {
        key: "ds-graph-store",
        title: "图的定义与存储结构",
        summary: "顶点与边；邻接矩阵看两点是否相邻，邻接表看一个点连向谁。",
        concepts: ["有向/无向与度","邻接矩阵","邻接表与逆邻接表","十字链表与邻接多重表"],
        principles: ["无向图所有顶点度数之和等于边数的 2 倍；有向图入度之和 = 出度之和 = 边数","邻接矩阵空间 O(n²)，判断两点是否相邻 O(1)，适合稠密图","邻接表空间 O(n+e)，遍历某点的所有邻居 O(度)，适合稀疏图；求入度需逆邻接表","连通图至少有 n-1 条边；有 n-1 条边的连通图必是树"],
        applications: ["社交网络关系建模","地图/网络拓扑","依赖图与编译顺序"],
        pitfalls: ["在邻接矩阵上求稀疏图的入度时做全表扫描","无向图邻接表里忘记对称插入两条边","把顶点数与边数搞混去估计复杂度（应为 O(n+e)）"],
        method: "先抓住「有向/无向与度」与「邻接矩阵」两个抓手，再用「无向图所有顶点度数之和等于边数的 2 倍」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「图的定义与存储结构」做一次闭环练习：在「社交网络关系建模」的场景下，把示例「邻接表的定义」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：在邻接矩阵上求稀疏图的入度时做全表扫描为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "顶点与边；邻接矩阵看两点是否相邻，邻接表看一个点连向谁。",
            "核心结论：无向图所有顶点度数之和等于边数的 2 倍；有向图入度之和 = 出度之和 = 边数"
          ],
          "mechanism": [
            "邻接矩阵空间 O(n²)，判断两点是否相邻 O(1)，适合稠密图",
            "邻接表空间 O(n+e)，遍历某点的所有邻居 O(度)，适合稀疏图；求入度需逆邻接表"
          ],
          "example": {
            "title": "邻接表的定义",
            "language": "c",
            "code": "typedef struct ArcNode { int adjvex; struct ArcNode *next; } ArcNode;\ntypedef struct VNode { int data; ArcNode *first; } VNode, AdjList[MAXV];\ntypedef struct { AdjList vertices; int vexnum, arcnum; } ALGraph;\n// 空间 O(n + e)：稀疏图上比邻接矩阵的 O(n^2) 省得多",
            "explanation": "每条边只存一次（无向图两次），因此空间与边数成正比，适合稀疏图。"
          },
          "practiceSteps": [
            "用自己的话写出「有向/无向与度」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「邻接表的定义」，跑通后故意改错一处，观察失败现象。",
            "在「社交网络关系建模」场景里构造一个边界用例，确认不会踩到「在邻接矩阵上求稀疏图的入度时做全表扫描」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「图的定义与存储结构」的核心机制，并说明复杂度或代价。",
            "能指出「在邻接矩阵上求稀疏图的入度时做全表扫描」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
      {
        key: "ds-graph-traverse",
        title: "图的遍历：BFS 与 DFS",
        summary: "BFS 按层扩展、DFS 一路深入；两者都要用 visited 防止绕圈。",
        concepts: ["visited 标记","BFS 与队列","DFS 与递归栈","生成树与连通分量"],
        principles: ["BFS 从起点按距离分层扩展，无权图中首次到达即最短跳数","DFS 沿一条路走到底再回溯，天然适合求连通分量、判环与路径枚举","邻接表下两种遍历都是 O(n+e)；邻接矩阵下都是 O(n²)","遍历过程中记录「来向」即可得到生成树（BFS 生成树 / DFS 生成树），非连通图得到森林"],
        applications: ["迷宫/网格最短路","连通分量与岛屿计数","依赖环检测与路径枚举"],
        pitfalls: ["忘记 visited 导致环上死循环","BFS 在出队时才标记 visited，导致重复入队","用 DFS 求无权最短路（结果不一定最短）"],
        method: "先抓住「visited 标记」与「BFS 与队列」两个抓手，再用「BFS 从起点按距离分层扩展」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「图的遍历：BFS 与 DFS」做一次闭环练习：在「迷宫/网格最短路」的场景下，把示例「BFS 骨架（邻接表）」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：忘记 visited 导致环上死循环为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "BFS 按层扩展、DFS 一路深入；两者都要用 visited 防止绕圈。",
            "核心结论：BFS 从起点按距离分层扩展，无权图中首次到达即最短跳数"
          ],
          "mechanism": [
            "DFS 沿一条路走到底再回溯，天然适合求连通分量、判环与路径枚举",
            "邻接表下两种遍历都是 O(n+e)；邻接矩阵下都是 O(n²)"
          ],
          "example": {
            "title": "BFS 骨架（邻接表）",
            "language": "c",
            "code": "void bfs(ALGraph *g, int s) {\n    int vis[MAXV] = {0}; SqQueue q; init(&q);\n    vis[s] = 1; enqueue(&q, s);            // 入队即标记\n    while (!empty(&q)) {\n        int u; dequeue(&q, &u); visit(u);\n        for (ArcNode *p = g->vertices[u].first; p; p = p->next)\n            if (!vis[p->adjvex]) { vis[p->adjvex] = 1; enqueue(&q, p->adjvex); }\n    }\n}",
            "explanation": "「入队就标记」是避免重复入队的关键；每层结束后队列里正好是下一层全部顶点。"
          },
          "practiceSteps": [
            "用自己的话写出「visited 标记」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「BFS 骨架（邻接表）」，跑通后故意改错一处，观察失败现象。",
            "在「迷宫/网格最短路」场景里构造一个边界用例，确认不会踩到「忘记 visited 导致环上死循环」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「图的遍历：BFS 与 DFS」的核心机制，并说明复杂度或代价。",
            "能指出「忘记 visited 导致环上死循环」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
        animations: ["anim-graph-bfs","anim-graph-dfs"],
      },
      {
        key: "ds-mst",
        title: "最小生成树：Prim 与 Kruskal",
        summary: "在带权连通无向图里选 n-1 条边，让总权值最小且不成环。",
        concepts: ["生成树与权值","Prim 点扩展","Kruskal 边排序 + 并查集","两者适用场景"],
        principles: ["最小生成树的边数固定为 n-1，且不成环；割性质与回路性质是其正确性基础","Prim 从任一顶点出发，每次把「连到树上的最小边」加入，复杂度 O(n²)（堆优化 O(e log n)），适合稠密图","Kruskal 把所有边按权值排序，依次加入不成环的边，用并查集判环，复杂度 O(e log e)，适合稀疏图","当图中存在等权边时最小生成树可能不唯一，但最小总权值唯一"],
        applications: ["布线/铺路最低成本","网络设计（避免环路的冗余链路）","聚类中的最小生成树切割"],
        pitfalls: ["选边时只看当前最小而不判环，导致出现回路","对非连通图求「生成树」（应改求最小生成森林）","Kruskal 忘记并查集把两端合并"],
        method: "先抓住「生成树与权值」与「Prim 点扩展」两个抓手，再用「最小生成树的边数固定为 n-1」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「最小生成树：Prim 与 Kruskal」做一次闭环练习：在「布线/铺路最低成本」的场景下，把示例「Kruskal 主体」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：选边时只看当前最小而不判环为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "在带权连通无向图里选 n-1 条边，让总权值最小且不成环。",
            "核心结论：最小生成树的边数固定为 n-1，且不成环；割性质与回路性质是其正确性基础"
          ],
          "mechanism": [
            "Prim 从任一顶点出发，每次把「连到树上的最小边」加入，复杂度 O(n²)（堆优化 O(e log n)），适合稠密图",
            "Kruskal 把所有边按权值排序，依次加入不成环的边，用并查集判环，复杂度 O(e log e)，适合稀疏图"
          ],
          "example": {
            "title": "Kruskal 主体",
            "language": "c",
            "code": "sortEdgesByWeight(edges, e);              // 按权值升序\nint used = 0, total = 0;\nfor (int i = 0; i < e && used < n - 1; i++) {\n    int u = find(edges[i].u), v = find(edges[i].v);   // 并查集\n    if (u == v) continue;                              // 成环，跳过\n    unite(u, v); total += edges[i].w; used++;\n}\n// 结束后 used == n - 1 才说明连通；否则图不连通",
            "explanation": "排序保证每次拿到的都是当前最小边，并查集保证不成环，两者结合即得最小生成树。"
          },
          "practiceSteps": [
            "用自己的话写出「生成树与权值」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「Kruskal 主体」，跑通后故意改错一处，观察失败现象。",
            "在「布线/铺路最低成本」场景里构造一个边界用例，确认不会踩到「选边时只看当前最小而不判环」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「最小生成树：Prim 与 Kruskal」的核心机制，并说明复杂度或代价。",
            "能指出「选边时只看当前最小而不判环」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
      {
        key: "ds-shortest-path",
        title: "最短路径：Dijkstra 与 Floyd",
        summary: "单源非负权用 Dijkstra，任意两点用 Floyd；负权要用 Bellman-Ford/SPFA。",
        concepts: ["单源最短路","Dijkstra 的贪心选点","Floyd 的三重循环","负权边"],
        principles: ["Dijkstra 每轮从未确定集合中选 dist 最小的点并「松弛」它的邻边，要求边权非负","Dijkstra 朴素实现 O(n²)、堆优化 O(e log n)；负权边会让贪心选点失效","Floyd 用三重循环做动态规划，dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])，复杂度 O(n³)","含负权边时用 Bellman-Ford 做 n-1 轮松弛，还能检测负环"],
        applications: ["地图导航与路由","网络延迟/成本最小化","任意两点距离矩阵（Floyd 常用于小规模全源）"],
        pitfalls: ["在含负权边的图上用 Dijkstra","Floyd 循环顺序写错（k 必须在最外层）","忘记把 dist 初始化为无穷并处理不连通（保持无穷）"],
        method: "先抓住「单源最短路」与「Dijkstra 的贪心选点」两个抓手，再用「Dijkstra 每轮从未确定集合中选 dist 最小的点并「松弛」它的邻边」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「最短路径：Dijkstra 与 Floyd」做一次闭环练习：在「地图导航与路由」的场景下，把示例「Dijkstra 主体」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：在含负权边的图上用 Dijkstra为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "单源非负权用 Dijkstra，任意两点用 Floyd；负权要用 Bellman-Ford/SPFA。",
            "核心结论：Dijkstra 每轮从未确定集合中选 dist 最小的点并「松弛」它的邻边，要求边权非负"
          ],
          "mechanism": [
            "Dijkstra 朴素实现 O(n²)、堆优化 O(e log n)；负权边会让贪心选点失效",
            "Floyd 用三重循环做动态规划，dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])，复杂度 O(n³)"
          ],
          "example": {
            "title": "Dijkstra 主体",
            "language": "c",
            "code": "for (int i = 1; i <= n; i++) dist[i] = INF;  dist[s] = 0;\nfor (int round = 0; round < n; round++) {\n    int u = -1;\n    for (int i = 1; i <= n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;\n    if (dist[u] == INF) break;                    // 剩余顶点不可达\n    done[u] = 1;\n    for (ArcNode *p = g->vertices[u].first; p; p = p->next)   // 松弛\n        if (dist[u] + p->w < dist[p->adjvex]) dist[p->adjvex] = dist[u] + p->w;\n}",
            "explanation": "每轮取当前最近的未确定点并松弛出边；边权非负保证「最优点一旦确定就不会再被改进」。"
          },
          "practiceSteps": [
            "用自己的话写出「单源最短路」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「Dijkstra 主体」，跑通后故意改错一处，观察失败现象。",
            "在「地图导航与路由」场景里构造一个边界用例，确认不会踩到「在含负权边的图上用 Dijkstra」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「最短路径：Dijkstra 与 Floyd」的核心机制，并说明复杂度或代价。",
            "能指出「在含负权边的图上用 Dijkstra」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
      {
        key: "ds-topo-critical",
        title: "拓扑排序与关键路径",
        summary: "AOV 网定次序，AOE 网定工期；前者判环，后者找最长路径。",
        concepts: ["AOV 网与入度","拓扑排序（Kahn）","AOE 网与关键路径","最早/最迟开始时间"],
        principles: ["拓扑排序反复输出入度为 0 的顶点并删除其出边；若无法输出全部顶点，图中有环","Kahn 算法复杂度 O(n+e)；DFS 后序的逆序也是一种拓扑序","AOE 网中关键路径是源点到汇点的最长路径，其长度即整个工程的最短工期","关键活动满足 e(i)=l(i)（最早开始 = 最迟开始），缩短非关键活动不会缩短总工期"],
        applications: ["编译/构建依赖顺序","课程与项目排期","死锁检测（等待图找环）"],
        pitfalls: ["拓扑排序只看入度为 0 而不更新邻点入度，导致结果不全","把关键路径当成最短路径去求","有环时仍继续输出，结果长度对不上却当作正确"],
        method: "先抓住「AOV 网与入度」与「拓扑排序（Kahn）」两个抓手，再用「拓扑排序反复输出入度为 0 的顶点并删除其出边」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「拓扑排序与关键路径」做一次闭环练习：在「编译/构建依赖顺序」的场景下，把示例「Kahn：入度 + 队列」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：拓扑排序只看入度为 0 而不更新邻点入度为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "AOV 网定次序，AOE 网定工期；前者判环，后者找最长路径。",
            "核心结论：拓扑排序反复输出入度为 0 的顶点并删除其出边；若无法输出全部顶点，图中有环"
          ],
          "mechanism": [
            "Kahn 算法复杂度 O(n+e)；DFS 后序的逆序也是一种拓扑序",
            "AOE 网中关键路径是源点到汇点的最长路径，其长度即整个工程的最短工期"
          ],
          "example": {
            "title": "Kahn：入度 + 队列",
            "language": "c",
            "code": "for (int i = 1; i <= n; i++) if (indeg[i] == 0) enqueue(&q, i);\nint cnt = 0;\nwhile (!empty(&q)) {\n    int u; dequeue(&q, &u); printf(\"%d \", u); cnt++;\n    for (ArcNode *p = g->vertices[u].first; p; p = p->next)\n        if (--indeg[p->adjvex] == 0) enqueue(&q, p->adjvex);   // 入度归零才入队\n}\n// cnt < n 说明存在环，拓扑序不存在",
            "explanation": "入度归零才入队保证每次输出的都是「前置已全部完成」的顶点；输出不足 n 个即检测到环。"
          },
          "practiceSteps": [
            "用自己的话写出「AOV 网与入度」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「Kahn：入度 + 队列」，跑通后故意改错一处，观察失败现象。",
            "在「编译/构建依赖顺序」场景里构造一个边界用例，确认不会踩到「拓扑排序只看入度为 0 而不更新邻点入度」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「拓扑排序与关键路径」的核心机制，并说明复杂度或代价。",
            "能指出「拓扑排序只看入度为 0 而不更新邻点入度」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
    ],
    questionKeys: ["ds-graph-store-single","ds-graph-store-judge","ds-graph-traverse-single","ds-graph-traverse-judge","ds-mst-single","ds-mst-judge","ds-shortest-path-single","ds-shortest-path-judge","ds-topo-critical-single","ds-topo-critical-judge"],
  },
  {
    key: "ds-search",
    title: "查找",
    weeks: "第 14 周",
    goal: "掌握顺序/折半/分块/哈希四类查找的适用条件与平均查找长度。",
    outcome: "能算出折半查找的判定树高度，并说明哈希表冲突处理对 ASL 的影响。",
    lesson: {
      "overview": [
        "掌握顺序/折半/分块/哈希四类查找的适用条件与平均查找长度。",
        "能算出折半查找的判定树高度，并说明哈希表冲突处理对 ASL 的影响。"
      ],
      "studyLoop": [
        "先读「顺序查找与分块查找」，在纸上手推一个最小样例",
        "按顺序实现本阶段核心代码，跑通后再补边界用例",
        "故意破坏一个前提，观察失败现象并定位原因",
        "把本阶段的易错点整理成自己的清单"
      ],
      "milestones": [
        {
          "title": "掌握：顺序查找与分块查找",
          "evidence": "能独立完成「顺序查找与分块查找」的示例与配套自测题。"
        },
        {
          "title": "掌握：折半查找与判定树",
          "evidence": "能独立完成「折半查找与判定树」的示例与配套自测题。"
        },
        {
          "title": "掌握：哈希查找与冲突解决",
          "evidence": "能独立完成「哈希查找与冲突解决」的示例与配套自测题。"
        }
      ],
      "completionCriteria": [
        "能独立完成本阶段全部 3 个知识点的示例与自测。",
        "能用文字说清每个知识点的时间/空间复杂度与适用场景。",
        "能算出折半查找的判定树高度，并说明哈希表冲突处理对 ASL 的影响。"
      ]
    },
    topics: [
      {
        key: "ds-sequential-search",
        title: "顺序查找与分块查找",
        summary: "逐个比较是无序表的兜底；分块查找用「块间有序、块内无序」折中。",
        concepts: ["平均查找长度 ASL","哨兵","分块查找（索引顺序表）","块长与索引的最佳比例"],
        principles: ["顺序查找等概率下成功 ASL = (n+1)/2，失败需比较 n 次（无哨兵）","设置哨兵（把待查值放在 0 号位）可以省掉「下标是否越界」的判断","分块查找要求块间有序（第 i 块的最大值小于第 i+1 块的最小值），块内可无序","分块查找先把待查值与各块最大值比较定位块（可用折半），再在块内顺序查找；最优块长约 √n"],
        applications: ["小规模/无序数据的兜底查找","索引顺序文件","硬件线性扫描（内存中短数组）"],
        pitfalls: ["在有序表上仍用顺序查找（浪费了有序性）","分块查找要求块内也有序（不必要，会增加维护成本）","ASL 计算时把失败情况也算进成功 ASL"],
        method: "先抓住「平均查找长度 ASL」与「哨兵」两个抓手，再用「顺序查找等概率下成功 ASL = (n+1)/2」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「顺序查找与分块查找」做一次闭环练习：在「小规模/无序数据的兜底查找」的场景下，把示例「带哨兵的顺序查找」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：在有序表上仍用顺序查找（浪费了有序性）为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "逐个比较是无序表的兜底；分块查找用「块间有序、块内无序」折中。",
            "核心结论：顺序查找等概率下成功 ASL = (n+1)/2，失败需比较 n 次（无哨兵）"
          ],
          "mechanism": [
            "设置哨兵（把待查值放在 0 号位）可以省掉「下标是否越界」的判断",
            "分块查找要求块间有序（第 i 块的最大值小于第 i+1 块的最小值），块内可无序"
          ],
          "example": {
            "title": "带哨兵的顺序查找",
            "language": "c",
            "code": "int seqSearch(int a[], int n, int key) {\n    a[0] = key;                     // 0 号位作哨兵\n    int i = n;\n    while (a[i] != key) i--;        // 不必判断 i >= 0\n    return i;                       // 返回 0 表示没找到\n}",
            "explanation": "哨兵把「越界判断」和「相等判断」合并，减少了一半比较开销。"
          },
          "practiceSteps": [
            "用自己的话写出「平均查找长度 ASL」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「带哨兵的顺序查找」，跑通后故意改错一处，观察失败现象。",
            "在「小规模/无序数据的兜底查找」场景里构造一个边界用例，确认不会踩到「在有序表上仍用顺序查找（浪费了有序性）」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「顺序查找与分块查找」的核心机制，并说明复杂度或代价。",
            "能指出「在有序表上仍用顺序查找（浪费了有序性）」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
      {
        key: "ds-binary-search-tree-find",
        title: "折半查找与判定树",
        summary: "有序表上每次砍一半，用判定树可以把比较次数看成一棵树高。",
        concepts: ["折半查找过程","判定树与比较次数","⌈log₂(n+1)⌉ 的由来","只适用于顺序存储"],
        principles: ["折半查找每次把区间缩半，因此查找成功的比较次数不超过判定树高度","n 个结点的判定树高度为 ⌈log₂(n+1)⌉，因此折半查找是 O(log n)","折半查找要求「顺序存储 + 有序」，因为要用下标直接跳到中点","链表上无法折半（无法 O(1) 取中点），要想有序链式查找需用跳表等结构"],
        applications: ["静态有序表的快速查找","查找第一个/最后一个满足条件的位置（边界二分）","答案单调时的二分答案"],
        pitfalls: ["循环条件与 mid 更新不匹配导致死循环或漏元素","在链表上直接折半查找","以为折半查找在最坏情况下也只需 1 次比较"],
        method: "先抓住「折半查找过程」与「判定树与比较次数」两个抓手，再用「折半查找每次把区间缩半」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「折半查找与判定树」做一次闭环练习：在「静态有序表的快速查找」的场景下，把示例「闭区间折半查找」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：循环条件与 mid 更新不匹配导致死循环或漏元素为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "有序表上每次砍一半，用判定树可以把比较次数看成一棵树高。",
            "核心结论：折半查找每次把区间缩半，因此查找成功的比较次数不超过判定树高度"
          ],
          "mechanism": [
            "n 个结点的判定树高度为 ⌈log₂(n+1)⌉，因此折半查找是 O(log n)",
            "折半查找要求「顺序存储 + 有序」，因为要用下标直接跳到中点"
          ],
          "example": {
            "title": "闭区间折半查找",
            "language": "c",
            "code": "int bsearch(int a[], int n, int key) {\n    int lo = 0, hi = n - 1;\n    while (lo <= hi) {\n        int mid = lo + (hi - lo) / 2;    // 防溢出写法\n        if (a[mid] == key) return mid;\n        if (a[mid] < key) lo = mid + 1;  // 闭区间，必须 ±1\n        else hi = mid - 1;\n    }\n    return -1;\n}",
            "explanation": "闭区间写法下两端都要 ±1，否则区间不收缩会死循环；mid 用 lo+(hi-lo)/2 避免相加溢出。"
          },
          "practiceSteps": [
            "用自己的话写出「折半查找过程」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「闭区间折半查找」，跑通后故意改错一处，观察失败现象。",
            "在「静态有序表的快速查找」场景里构造一个边界用例，确认不会踩到「循环条件与 mid 更新不匹配导致死循环或漏元素」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「折半查找与判定树」的核心机制，并说明复杂度或代价。",
            "能指出「循环条件与 mid 更新不匹配导致死循环或漏元素」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
      {
        key: "ds-hash-search",
        title: "哈希查找与冲突解决",
        summary: "用哈希函数把关键字直接映射到地址；冲突用开放定址或链地址法处理。",
        concepts: ["哈希函数","装填因子","开放定址（线性探测/二次探测）","链地址法"],
        principles: ["装填因子 α = 表中记录数 / 表长，α 越大冲突越多、ASL 越长","开放定址法把冲突元素放到同表的其他空位（线性探测会形成「堆积」）","链地址法把同址元素串成链表，删除方便，α 可以大于 1","在哈希表上查找的期望代价是 O(1)，但最坏仍是 O(n)（退化成一条链）"],
        applications: ["字典/集合（map/set）","缓存与去重","数据库索引与一致性哈希"],
        pitfalls: ["把哈希表当成「查找一定 O(1)」而不考虑冲突","开放定址法删除时直接置空（会切断探测链，应做墓碑标记）","哈希函数分布不均导致大量聚集"],
        method: "先抓住「哈希函数」与「装填因子」两个抓手，再用「装填因子 α = 表中记录数 / 表长」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「哈希查找与冲突解决」做一次闭环练习：在「字典/集合（map/set）」的场景下，把示例「除留余数与链地址法」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：把哈希表当成「查找一定 O(1)」而不考虑冲突为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "用哈希函数把关键字直接映射到地址；冲突用开放定址或链地址法处理。",
            "核心结论：装填因子 α = 表中记录数 / 表长，α 越大冲突越多、ASL 越长"
          ],
          "mechanism": [
            "开放定址法把冲突元素放到同表的其他空位（线性探测会形成「堆积」）",
            "链地址法把同址元素串成链表，删除方便，α 可以大于 1"
          ],
          "example": {
            "title": "除留余数与链地址法",
            "language": "c",
            "code": "#define P 13                     // 通常取小于表长的最大素数\nint h(int key) { return key % P; }\n// 链地址法：table[h(key)] 是一条链表，插入用头插 O(1)\n// 查找：先算 h(key)，再在链上线性找；链越长代价越高",
            "explanation": "取素数模能减少规律性聚集；链地址法把冲突元素挂成链表，删除与扩容都更好处理。"
          },
          "practiceSteps": [
            "用自己的话写出「哈希函数」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「除留余数与链地址法」，跑通后故意改错一处，观察失败现象。",
            "在「字典/集合（map/set）」场景里构造一个边界用例，确认不会踩到「把哈希表当成「查找一定 O(1)」而不考虑冲突」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「哈希查找与冲突解决」的核心机制，并说明复杂度或代价。",
            "能指出「把哈希表当成「查找一定 O(1)」而不考虑冲突」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
        animations: ["anim-hash-chain"],
      },
    ],
    questionKeys: ["ds-sequential-search-single","ds-sequential-search-judge","ds-binary-search-tree-find-single","ds-binary-search-tree-find-judge","ds-hash-search-single","ds-hash-search-judge"],
  },
  {
    key: "ds-sort",
    title: "排序",
    weeks: "第 15-16 周",
    goal: "把插入/交换/选择/归并/基数五类排序的实现、复杂度与稳定性一次理清。",
    outcome: "给定「要不要稳定、数据规模、是否近乎有序」能直接选排序并说明理由。",
    lesson: {
      "overview": [
        "把插入/交换/选择/归并/基数五类排序的实现、复杂度与稳定性一次理清。",
        "给定「要不要稳定、数据规模、是否近乎有序」能直接选排序并说明理由。"
      ],
      "studyLoop": [
        "先读「插入类排序：直接插入与希尔」，在纸上手推一个最小样例",
        "按顺序实现本阶段核心代码，跑通后再补边界用例",
        "故意破坏一个前提，观察失败现象并定位原因",
        "把本阶段的易错点整理成自己的清单"
      ],
      "milestones": [
        {
          "title": "掌握：插入类排序：直接插入与希尔",
          "evidence": "能独立完成「插入类排序：直接插入与希尔」的示例与配套自测题。"
        },
        {
          "title": "掌握：交换类排序：冒泡与快速",
          "evidence": "能独立完成「交换类排序：冒泡与快速」的示例与配套自测题。"
        },
        {
          "title": "掌握：选择类排序：简单选择与堆排序",
          "evidence": "能独立完成「选择类排序：简单选择与堆排序」的示例与配套自测题。"
        },
        {
          "title": "掌握：归并排序与基数排序",
          "evidence": "能独立完成「归并排序与基数排序」的示例与配套自测题。"
        },
        {
          "title": "掌握：排序算法对比与选择策略",
          "evidence": "能独立完成「排序算法对比与选择策略」的示例与配套自测题。"
        }
      ],
      "completionCriteria": [
        "能独立完成本阶段全部 5 个知识点的示例与自测。",
        "能用文字说清每个知识点的时间/空间复杂度与适用场景。",
        "给定「要不要稳定、数据规模、是否近乎有序」能直接选排序并说明理由。"
      ]
    },
    topics: [
      {
        key: "ds-insertion-sort",
        title: "插入类排序：直接插入与希尔",
        summary: "把待排序元素逐个插入已排好的前缀；希尔用增量分组让插入更快。",
        concepts: ["有序前缀","直接插入 O(n²)","希尔排序与增量","近乎有序时的优势"],
        principles: ["直接插入排序每轮把 a[i] 插入前 i 个已排好的元素中，最好 O(n)（已有序）、最坏 O(n²)","它是稳定的原地排序；在数据近乎有序时几乎只做比较不做搬移，因此常数极小","希尔排序按增量 g 把序列分成 g 组分别插入排序，逐步缩小 g 到 1","希尔排序打破了 O(n²) 的直觉：增量序列合适时可达约 O(n^1.3)，但不稳定"],
        applications: ["小规模数组排序","作为快排/归并的「小区间收尾」（工程常见）","近乎有序的数据"],
        pitfalls: ["认为直接插入排序最坏也是 O(n)","以为希尔排序稳定（跨组移动会打乱相同元素次序）","增量序列最后没有归到 1，导致整体未真正有序"],
        method: "先抓住「有序前缀」与「直接插入 O(n²)」两个抓手，再用「直接插入排序每轮把 a[i] 插入前 i 个已排好的元素中」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「插入类排序：直接插入与希尔」做一次闭环练习：在「小规模数组排序」的场景下，把示例「直接插入排序」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：认为直接插入排序最坏也是 O(n)为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "把待排序元素逐个插入已排好的前缀；希尔用增量分组让插入更快。",
            "核心结论：直接插入排序每轮把 a[i] 插入前 i 个已排好的元素中，最好 O(n)（已有序）、最坏 O(n²)"
          ],
          "mechanism": [
            "它是稳定的原地排序；在数据近乎有序时几乎只做比较不做搬移，因此常数极小",
            "希尔排序按增量 g 把序列分成 g 组分别插入排序，逐步缩小 g 到 1"
          ],
          "example": {
            "title": "直接插入排序",
            "language": "c",
            "code": "for (int i = 1; i < n; i++) {\n    int key = a[i], j = i - 1;\n    while (j >= 0 && a[j] > key) { a[j + 1] = a[j]; j--; }  // 大的往后挪\n    a[j + 1] = key;                                          // 落在正确位置\n}\n// 稳定：相等时不移位（条件是 a[j] > key 而不是 >=）",
            "explanation": "比较条件写成严格大于才能保持稳定；«近乎有序» 时内层 while 几乎不执行，接近 O(n)。"
          },
          "practiceSteps": [
            "用自己的话写出「有序前缀」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「直接插入排序」，跑通后故意改错一处，观察失败现象。",
            "在「小规模数组排序」场景里构造一个边界用例，确认不会踩到「认为直接插入排序最坏也是 O(n)」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「插入类排序：直接插入与希尔」的核心机制，并说明复杂度或代价。",
            "能指出「认为直接插入排序最坏也是 O(n)」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
        animations: ["anim-insertion-sort"],
      },
      {
        key: "ds-exchange-sort",
        title: "交换类排序：冒泡与快速",
        summary: "相邻交换是冒泡；分区分治是快排，平均最快但最坏会退化。",
        concepts: ["冒泡与提前终止","快排的分区","基准选择与退化","平均 O(n log n) 的来历"],
        principles: ["冒泡每轮把最大元素「浮」到末尾；若某轮没有发生交换说明已有序，可提前结束","快速排序选一个基准把数组分成「小于基准」和「大于基准」两段，再递归处理（分治）","快排平均 O(n log n)，但基准总取到最值时退化为 O(n²)（如对已有序数组取首元素）","随机化基准或三数取中可把退化概率降到极低；快排不稳定，且递归深度最坏 O(n)（用尾递归优化可降到 O(log n) 栈深）"],
        applications: ["通用内存排序（标准库主要算法）","求第 k 大（快速选择）","需要原地且平均最快"],
        pitfalls: ["基准固定取首/尾元素，遇到已有序输入直接退化","分区循环里的边界写法不对称，导致元素被漏掉或死循环","以为快排稳定（分区会打乱相等元素次序）"],
        method: "先抓住「冒泡与提前终止」与「快排的分区」两个抓手，再用「冒泡每轮把最大元素「浮」到末尾」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「交换类排序：冒泡与快速」做一次闭环练习：在「通用内存排序（标准库主要算法）」的场景下，把示例「快排分区（Hoare 思路）」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：基准固定取首/尾元素为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "相邻交换是冒泡；分区分治是快排，平均最快但最坏会退化。",
            "核心结论：冒泡每轮把最大元素「浮」到末尾；若某轮没有发生交换说明已有序，可提前结束"
          ],
          "mechanism": [
            "快速排序选一个基准把数组分成「小于基准」和「大于基准」两段，再递归处理（分治）",
            "快排平均 O(n log n)，但基准总取到最值时退化为 O(n²)（如对已有序数组取首元素）"
          ],
          "example": {
            "title": "快排分区（Hoare 思路）",
            "language": "c",
            "code": "int partition(int a[], int lo, int hi) {\n    int pivot = a[hi];                 // 这里简化为取尾元素\n    int i = lo - 1;\n    for (int j = lo; j < hi; j++)\n        if (a[j] < pivot) swap(&a[++i], &a[j]);   // 小于基准的往左挪\n    swap(&a[i + 1], &a[hi]);           // 基准放到正确位置\n    return i + 1;\n}",
            "explanation": "分区结束后基准左边全小于它、右边全不小于它，因此基准位置就此确定，再递归两侧。"
          },
          "practiceSteps": [
            "用自己的话写出「冒泡与提前终止」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「快排分区（Hoare 思路）」，跑通后故意改错一处，观察失败现象。",
            "在「通用内存排序（标准库主要算法）」场景里构造一个边界用例，确认不会踩到「基准固定取首/尾元素」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「交换类排序：冒泡与快速」的核心机制，并说明复杂度或代价。",
            "能指出「基准固定取首/尾元素」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
        animations: ["anim-bubble-sort","anim-quick-sort"],
      },
      {
        key: "ds-selection-sort",
        title: "选择类排序：简单选择与堆排序",
        summary: "每轮选出最小（大）放到位置上；堆排序把它加速到 O(n log n)。",
        concepts: ["简单选择排序","交换次数","堆选择","与插入排序的对比"],
        principles: ["简单选择每轮在剩余元素里找最小，与第 i 位交换，比较次数恒为 n(n-1)/2，即 O(n²)","简单选择排序的交换次数最多 n-1 次，因此适合「移动代价高」的记录","堆排序用堆把「找最小/最大」从 O(n) 降到 O(log n)，整体 O(n log n)","简单选择排序不稳定（交换会把相同元素跨过去）"],
        applications: ["记录很大、移动昂贵时的排序","只要前 k 小（选择而非全排）","对最坏情况有硬要求的排序"],
        pitfalls: ["以为简单选择排序比较次数少","把选择排序与堆排序的复杂度混为一谈","以为选择排序稳定"],
        method: "先抓住「简单选择排序」与「交换次数」两个抓手，再用「简单选择每轮在剩余元素里找最小」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「选择类排序：简单选择与堆排序」做一次闭环练习：在「记录很大、移动昂贵时的排序」的场景下，把示例「简单选择排序」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：以为简单选择排序比较次数少为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "每轮选出最小（大）放到位置上；堆排序把它加速到 O(n log n)。",
            "核心结论：简单选择每轮在剩余元素里找最小，与第 i 位交换，比较次数恒为 n(n-1)/2，即 O(n²)"
          ],
          "mechanism": [
            "简单选择排序的交换次数最多 n-1 次，因此适合「移动代价高」的记录",
            "堆排序用堆把「找最小/最大」从 O(n) 降到 O(log n)，整体 O(n log n)"
          ],
          "example": {
            "title": "简单选择排序",
            "language": "c",
            "code": "for (int i = 0; i < n - 1; i++) {\n    int min = i;\n    for (int j = i + 1; j < n; j++) if (a[j] < a[min]) min = j;\n    if (min != i) swap(&a[i], &a[min]);   // 每轮只交换一次\n}",
            "explanation": "比较次数与输入无关（恒为 n(n-1)/2），但交换很少，适合移动成本高的场景。"
          },
          "practiceSteps": [
            "用自己的话写出「简单选择排序」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「简单选择排序」，跑通后故意改错一处，观察失败现象。",
            "在「记录很大、移动昂贵时的排序」场景里构造一个边界用例，确认不会踩到「以为简单选择排序比较次数少」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「选择类排序：简单选择与堆排序」的核心机制，并说明复杂度或代价。",
            "能指出「以为简单选择排序比较次数少」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
        animations: ["anim-selection-sort","anim-heap-sort"],
      },
      {
        key: "ds-merge-radix",
        title: "归并排序与基数排序",
        summary: "归并是稳定的分治 O(n log n) 但需要额外空间；基数按位分配不做比较。",
        concepts: ["二路归并","分治与合并","归并的空间代价","基数排序（LSD）"],
        principles: ["归并排序把数组二分递归排好，再线性合并两个有序段，总时间恒为 O(n log n)","归并需要 O(n) 额外空间（合并缓冲），这是它相比快排的主要代价","归并排序稳定，且对链表排序特别自然（合并链表不需要额外数组）","基数排序按位从低位到高位做稳定分配与收集（LSD），时间复杂度 O(d(n+r))，不做关键字比较"],
        applications: ["需要稳定且最坏 O(n log n)","外部排序的第一阶段（生成归并段）","整数/定长字符串的大规模排序"],
        pitfalls: ["以为归并排序原地（需要 O(n) 缓冲）","外部排序忘记多路归并要配合败者树/堆选最小","基数排序的中间分配步骤不稳定，导致高位排序失效"],
        method: "先抓住「二路归并」与「分治与合并」两个抓手，再用「归并排序把数组二分递归排好」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「归并排序与基数排序」做一次闭环练习：在「需要稳定且最坏 O(n log n)」的场景下，把示例「合并两个有序段」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：以为归并排序原地（需要 O(n) 缓冲）为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "归并是稳定的分治 O(n log n) 但需要额外空间；基数按位分配不做比较。",
            "核心结论：归并排序把数组二分递归排好，再线性合并两个有序段，总时间恒为 O(n log n)"
          ],
          "mechanism": [
            "归并需要 O(n) 额外空间（合并缓冲），这是它相比快排的主要代价",
            "归并排序稳定，且对链表排序特别自然（合并链表不需要额外数组）"
          ],
          "example": {
            "title": "合并两个有序段",
            "language": "c",
            "code": "void merge(int a[], int lo, int mid, int hi, int tmp[]) {\n    int i = lo, j = mid + 1, k = lo;\n    while (i <= mid && j <= hi) tmp[k++] = (a[i] <= a[j]) ? a[i++] : a[j++];  // <= 保持稳定\n    while (i <= mid) tmp[k++] = a[i++];\n    while (j <= hi)  tmp[k++] = a[j++];\n    for (k = lo; k <= hi; k++) a[k] = tmp[k];\n}",
            "explanation": "比较用 <= 才能保持稳定；合并本身是线性的，整体复杂度来自递归的 log n 层。"
          },
          "practiceSteps": [
            "用自己的话写出「二路归并」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「合并两个有序段」，跑通后故意改错一处，观察失败现象。",
            "在「需要稳定且最坏 O(n log n)」场景里构造一个边界用例，确认不会踩到「以为归并排序原地（需要 O(n) 缓冲）」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「归并排序与基数排序」的核心机制，并说明复杂度或代价。",
            "能指出「以为归并排序原地（需要 O(n) 缓冲）」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
        animations: ["anim-merge-sort"],
      },
      {
        key: "ds-sort-compare",
        title: "排序算法对比与选择策略",
        summary: "把时间、空间、稳定性、适用规模放一张表里，按约束选算法。",
        concepts: ["比较排序下界 Ω(n log n)","稳定性对比","原地与非原地","工程混合策略"],
        principles: ["任何基于比较的排序最坏至少 Ω(n log n)，想突破必须利用键的分布（计数/基数/桶）","稳定：插入、冒泡、归并、基数；不稳定：选择、希尔、快排、堆","原地（O(1) 额外空间）：插入、冒泡、选择、希尔、快排、堆；非原地：归并、基数","工程实现常混合：小规模切插入排序、大规模用快排，对最坏情况敏感则用 introsort（快排+堆排+插入）"],
        applications: ["选择标准库排序的替代实现","面试/考试中的对比题","对稳定性有要求的业务排序"],
        pitfalls: ["以为快排「总是最快」（最坏会退化，且不稳定）","对需要稳定的多关键字排序用了不稳定算法","忽略比较排序的 Ω(n log n) 下界，以为能普遍做到 O(n)"],
        method: "先抓住「比较排序下界 Ω(n log n)」与「稳定性对比」两个抓手，再用「任何基于比较的排序最坏至少 Ω(n log n)」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「排序算法对比与选择策略」做一次闭环练习：在「选择标准库排序的替代实现」的场景下，把示例「按约束选排序的决策顺序」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：以为快排「总是最快」（最坏会退化为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "把时间、空间、稳定性、适用规模放一张表里，按约束选算法。",
            "核心结论：任何基于比较的排序最坏至少 Ω(n log n)，想突破必须利用键的分布（计数/基数/桶）"
          ],
          "mechanism": [
            "稳定：插入、冒泡、归并、基数；不稳定：选择、希尔、快排、堆",
            "原地（O(1) 额外空间）：插入、冒泡、选择、希尔、快排、堆；非原地：归并、基数"
          ],
          "example": {
            "title": "按约束选排序的决策顺序",
            "language": "text",
            "code": "# 1) 要求稳定？           -> 归并 / 插入（小规模）\n# 2) 内存紧张、要原地？     -> 快排 / 堆排\n# 3) 对最坏情况有硬要求？   -> 堆排 / 归并\n# 4) 数据近乎有序？         -> 插入排序\n# 5) 键是小范围整数？       -> 计数 / 基数排序（突破 n log n）\n# 6) 通用场合               -> 快排（随机基准）或标准库 introsort",
            "explanation": "把「稳定性、空间、最坏界、数据特征」依次过一遍，就能在几分钟内做出可辩护的选择。"
          },
          "practiceSteps": [
            "用自己的话写出「比较排序下界 Ω(n log n)」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「按约束选排序的决策顺序」，跑通后故意改错一处，观察失败现象。",
            "在「选择标准库排序的替代实现」场景里构造一个边界用例，确认不会踩到「以为快排「总是最快」（最坏会退化」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「排序算法对比与选择策略」的核心机制，并说明复杂度或代价。",
            "能指出「以为快排「总是最快」（最坏会退化」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
    ],
    questionKeys: ["ds-insertion-sort-single","ds-insertion-sort-judge","ds-exchange-sort-single","ds-exchange-sort-judge","ds-selection-sort-single","ds-selection-sort-judge","ds-merge-radix-single","ds-merge-radix-judge","ds-sort-compare-single","ds-sort-compare-judge"],
  },
  {
    key: "ds-algo-strategy",
    title: "算法策略进阶",
    weeks: "第 17-18 周",
    goal: "把分治、贪心、动态规划、回溯四类策略的适用条件与代价讲清并用得上。",
    outcome: "遇到新问题能先判断它属于哪类策略，写出状态或剪枝条件而不是直接暴力。",
    lesson: {
      "overview": [
        "把分治、贪心、动态规划、回溯四类策略的适用条件与代价讲清并用得上。",
        "遇到新问题能先判断它属于哪类策略，写出状态或剪枝条件而不是直接暴力。"
      ],
      "studyLoop": [
        "先读「分治」，在纸上手推一个最小样例",
        "按顺序实现本阶段核心代码，跑通后再补边界用例",
        "故意破坏一个前提，观察失败现象并定位原因",
        "把本阶段的易错点整理成自己的清单"
      ],
      "milestones": [
        {
          "title": "掌握：分治",
          "evidence": "能独立完成「分治」的示例与配套自测题。"
        },
        {
          "title": "掌握：贪心",
          "evidence": "能独立完成「贪心」的示例与配套自测题。"
        },
        {
          "title": "掌握：动态规划：状态与转移",
          "evidence": "能独立完成「动态规划：状态与转移」的示例与配套自测题。"
        },
        {
          "title": "掌握：回溯与剪枝",
          "evidence": "能独立完成「回溯与剪枝」的示例与配套自测题。"
        }
      ],
      "completionCriteria": [
        "能独立完成本阶段全部 4 个知识点的示例与自测。",
        "能用文字说清每个知识点的时间/空间复杂度与适用场景。",
        "遇到新问题能先判断它属于哪类策略，写出状态或剪枝条件而不是直接暴力。"
      ]
    },
    topics: [
      {
        key: "ds-divide-conquer",
        title: "分治",
        summary: "把问题拆成同类子问题、递归求解、再合并答案。",
        concepts: ["分解—求解—合并","分治复杂度（主定理直觉）","二分与归并","大整数乘法/快选"],
        principles: ["分治三要素：子问题与原问题同型、子问题互相独立、子问题答案能合并","若每次规模减半且合并代价 O(n)，则总代价 O(n log n)（归并、快排的平均情形）","快速选择只在一边递归，平均 O(n) 即可找出第 k 大，不需要全排","分治不一定更快：合并代价过高（如每层 O(n²)）会退化"],
        applications: ["排序与查找","最近点对","大整数乘法（Karatsuba）与矩阵乘法的分块"],
        pitfalls: ["子问题不独立（有重叠）时仍用分治，重复计算导致退化","只在一边递归的问题误套「n log n」结论","递归出口写错导致无限递归"],
        method: "先抓住「分解—求解—合并」与「分治复杂度（主定理直觉）」两个抓手，再用「分治三要素：子问题与原问题同型」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「分治」做一次闭环练习：在「排序与查找」的场景下，把示例「快速选择求第 k 小」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：子问题不独立（有重叠）时仍用分治为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "把问题拆成同类子问题、递归求解、再合并答案。",
            "核心结论：分治三要素：子问题与原问题同型、子问题互相独立、子问题答案能合并"
          ],
          "mechanism": [
            "若每次规模减半且合并代价 O(n)，则总代价 O(n log n)（归并、快排的平均情形）",
            "快速选择只在一边递归，平均 O(n) 即可找出第 k 大，不需要全排"
          ],
          "example": {
            "title": "快速选择求第 k 小",
            "language": "c",
            "code": "int selectKth(int a[], int lo, int hi, int k) {   // k 从 0 计\n    int p = partition(a, lo, hi);\n    if (p == k) return a[p];\n    return p > k ? selectKth(a, lo, p - 1, k)          // 只递归一边\n                 : selectKth(a, p + 1, hi, k);\n}\n// 每次只处理一半 -> 平均 O(n)，而不是 O(n log n)",
            "explanation": "只递归包含目标的一侧，规模每次减半且只做一次分区，因此平均是线性时间。"
          },
          "practiceSteps": [
            "用自己的话写出「分解—求解—合并」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「快速选择求第 k 小」，跑通后故意改错一处，观察失败现象。",
            "在「排序与查找」场景里构造一个边界用例，确认不会踩到「子问题不独立（有重叠）时仍用分治」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「分治」的核心机制，并说明复杂度或代价。",
            "能指出「子问题不独立（有重叠）时仍用分治」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
      {
        key: "ds-greedy",
        title: "贪心",
        summary: "每步都选当前最优，前提是「局部最优能推出全局最优」。",
        concepts: ["贪心选择性质","最优子结构","交换论证","贪心 vs 动态规划"],
        principles: ["贪心可行需要两个条件：贪心选择性质（局部最优可扩展为全局最优）与最优子结构","证明贪心常用交换论证：把最优解的第一步换成贪心选择，答案不会变差","区间调度按右端点排序贪心可选最多不重叠区间；按左端点或区间长度贪心都不对","0-1 背包不能用单位价值贪心（反例易构造），但分数背包可以；这说明贪心的成立需要证明"],
        applications: ["区间调度与会议室安排","哈夫曼编码与最小生成树","找零（面额特殊时）、活动选择"],
        pitfalls: ["对不满足贪心性质的问题硬用贪心","排序键选错（区间调度应排右端点）","用「感觉对」代替交换论证，留下反例"],
        method: "先抓住「贪心选择性质」与「最优子结构」两个抓手，再用「贪心可行需要两个条件：贪心选择性质（局部最优可扩展为全局最优）与最优子结构」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「贪心」做一次闭环练习：在「区间调度与会议室安排」的场景下，把示例「区间调度贪心」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：对不满足贪心性质的问题硬用贪心为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "每步都选当前最优，前提是「局部最优能推出全局最优」。",
            "核心结论：贪心可行需要两个条件：贪心选择性质（局部最优可扩展为全局最优）与最优子结构"
          ],
          "mechanism": [
            "证明贪心常用交换论证：把最优解的第一步换成贪心选择，答案不会变差",
            "区间调度按右端点排序贪心可选最多不重叠区间；按左端点或区间长度贪心都不对"
          ],
          "example": {
            "title": "区间调度贪心",
            "language": "c",
            "code": "// 目标：选最多互不重叠的区间\nsortByRightEndpoint(intervals, n);       // 按右端点升序\nint last = -INF, count = 0;\nfor (int i = 0; i < n; i++)\n    if (intervals[i].l >= last) { last = intervals[i].r; count++; }\n// 按右端点排序是关键：越早结束，留给后面的空间越多",
            "explanation": "按右端点排序后，每次选最早结束且不冲突的区间，可用交换论证证明其最优性。"
          },
          "practiceSteps": [
            "用自己的话写出「贪心选择性质」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「区间调度贪心」，跑通后故意改错一处，观察失败现象。",
            "在「区间调度与会议室安排」场景里构造一个边界用例，确认不会踩到「对不满足贪心性质的问题硬用贪心」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「贪心」的核心机制，并说明复杂度或代价。",
            "能指出「对不满足贪心性质的问题硬用贪心」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
      {
        key: "ds-dp-basic",
        title: "动态规划：状态与转移",
        summary: "用表格缓存重叠子问题；难点全在状态定义与转移方程。",
        concepts: ["重叠子问题","无后效性","状态转移方程","记忆化与递推"],
        principles: ["能用 DP 的前提：子问题重叠（否则分治即可）且状态无后效性（当前状态包含后续所需的全部信息）","状态定义决定转移难度：把「到这一步的全部必要信息」写进状态，才不会漏解","记忆化搜索（自顶向下）与填表（自底向上）等价，前者更好写、后者更好控空间","滚动数组/一维倒序等技巧把空间从 O(n²) 压到 O(n)，但必须保证依赖顺序正确"],
        applications: ["0-1 背包与完全背包","最长公共子序列/最长上升子序列","编辑距离与路径计数"],
        pitfalls: ["状态定义有后效性，导致答案依赖未记录的过去信息","忘记初始化边界（如 dp[0] 与不可达状态）","0-1 背包用一维数组时正序遍历（元素被重复选取）"],
        method: "先抓住「重叠子问题」与「无后效性」两个抓手，再用「能用 DP 的前提：子问题重叠（否则分治即可）且状态无后效性（当前状态包含后续所需的全部」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「动态规划：状态与转移」做一次闭环练习：在「0-1 背包与完全背包」的场景下，把示例「0-1 背包（一维滚动）」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：状态定义有后效性为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "用表格缓存重叠子问题；难点全在状态定义与转移方程。",
            "核心结论：能用 DP 的前提：子问题重叠（否则分治即可）且状态无后效性（当前状态包含后续所需的全部信息）"
          ],
          "mechanism": [
            "状态定义决定转移难度：把「到这一步的全部必要信息」写进状态，才不会漏解",
            "记忆化搜索（自顶向下）与填表（自底向上）等价，前者更好写、后者更好控空间"
          ],
          "example": {
            "title": "0-1 背包（一维滚动）",
            "language": "c",
            "code": "for (int i = 0; i < n; i++)\n    for (int v = V; v >= w[i]; v--)            // 倒序：保证每件物品只用一次\n        dp[v] = max(dp[v], dp[v - w[i]] + value[i]);\n// dp[v] 表示容量 v 下能取得的最大价值；倒序是关键，正序会退化成完全背包",
            "explanation": "倒序枚举容量才能保证转移只用到「上一件物品」的结果，这正是 0-1 与完全背包的唯一差别。"
          },
          "practiceSteps": [
            "用自己的话写出「重叠子问题」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「0-1 背包（一维滚动）」，跑通后故意改错一处，观察失败现象。",
            "在「0-1 背包与完全背包」场景里构造一个边界用例，确认不会踩到「状态定义有后效性」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「动态规划：状态与转移」的核心机制，并说明复杂度或代价。",
            "能指出「状态定义有后效性」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
      {
        key: "ds-backtracking",
        title: "回溯与剪枝",
        summary: "在解空间树上深度优先试探，走不通就撤销选择回退一步。",
        concepts: ["解空间树","选择—递归—撤销","剪枝","约束函数与限界函数"],
        principles: ["回溯的本质是带回退的 DFS：做选择 → 递归 → 撤销选择，保证状态可复用","剪枝是回溯的效率命门：提前用约束/限界判断子树不可能有解，直接跳过","N 皇后、全排列、子集和都是典型解空间树问题；搜索顺序会影响剪枝效果","最坏复杂度仍是指数级：回溯只是把「不可能的分支」剪掉，不能改变指数下界"],
        applications: ["N 皇后/数独","全排列与组合枚举","子集和、装箱与约束满足问题"],
        pitfalls: ["忘记撤销选择，导致后续分支状态被污染","剪枝条件写得太弱（无效），或太强（误剪掉可行解）","对同一结果重复枚举（未按顺序去重，产生重复解）"],
        method: "先抓住「解空间树」与「选择—递归—撤销」两个抓手，再用「回溯的本质是带回退的 DFS：做选择 → 递归 → 撤销选择」这条主线推导，最后写代码验证并记录代价。",
        exercise: "围绕「回溯与剪枝」做一次闭环练习：在「N 皇后/数独」的场景下，把示例「全排列回溯骨架」亲手实现或演算一遍，并写出时间/空间复杂度。",
        checkpoint: "不看笔记能回答：忘记撤销选择为什么会出错？并能用最小样例复现与纠正。",
        lesson: {
          "overview": [
            "在解空间树上深度优先试探，走不通就撤销选择回退一步。",
            "核心结论：回溯的本质是带回退的 DFS：做选择 → 递归 → 撤销选择，保证状态可复用"
          ],
          "mechanism": [
            "剪枝是回溯的效率命门：提前用约束/限界判断子树不可能有解，直接跳过",
            "N 皇后、全排列、子集和都是典型解空间树问题；搜索顺序会影响剪枝效果"
          ],
          "example": {
            "title": "全排列回溯骨架",
            "language": "c",
            "code": "void dfs(int depth) {\n    if (depth == n) { output(path); return; }\n    for (int i = 0; i < n; i++) {\n        if (used[i]) continue;          // 剪枝：已选过\n        used[i] = 1; path[depth] = a[i];   // 做选择\n        dfs(depth + 1);\n        used[i] = 0;                       // 撤销选择（关键）\n    }\n}",
            "explanation": "「做选择 → 递归 → 撤销选择」三步必须成对出现，撤销那一步是回溯的灵魂。"
          },
          "practiceSteps": [
            "用自己的话写出「解空间树」的定义，并各举一个正例与一个反例。",
            "亲手实现或演算示例「全排列回溯骨架」，跑通后故意改错一处，观察失败现象。",
            "在「N 皇后/数独」场景里构造一个边界用例，确认不会踩到「忘记撤销选择」。"
          ],
          "masteryChecklist": [
            "能不看示例复述「回溯与剪枝」的核心机制，并说明复杂度或代价。",
            "能指出「忘记撤销选择」为什么错，并给出正确做法。",
            "能独立完成示例并逐行解释它在做什么。"
          ]
        },
      },
    ],
    questionKeys: ["ds-divide-conquer-single","ds-divide-conquer-judge","ds-greedy-single","ds-greedy-judge","ds-dp-basic-single","ds-dp-basic-judge","ds-backtracking-single","ds-backtracking-judge"],
  },
];
