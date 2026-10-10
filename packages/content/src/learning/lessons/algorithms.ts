import type { LearningTopicLesson } from "../types";

export const algorithmsTopicLessons: Record<string, LearningTopicLesson> = {
  "algo-complexity-basics": {
    overview: [
      "复杂度不是「跑得快不快」，而是「数据量翻倍时代价涨多少」。把运行毫秒数当结论，换个机器就会得出相反判断。",
      "分析顺序固定：先找出主导操作（比较、访问、写入），数清它对 n 的执行次数，再只保留最高阶项。",
    ],
    mechanism: [
      "嵌套循环相乘、顺序循环相加；递归要看「每层做了多少工作」乘以「层数」。",
      "均摊分析把偶发的高开销分摊到多次操作上：动态数组扩容是 O(n)，但均摊到每次追加仍是 O(1)。",
    ],
    example: {
      title: "同一个「去重」的两种代价",
      language: "python",
      code: `# O(n^2)：每个元素都和已选结果比较
def dedup_slow(items):
    out = []
    for item in items:
        if item not in out:      # 列表查找是线性扫描
            out.append(item)
    return out

# O(n)：用集合记录已出现元素
def dedup_fast(items):
    seen = set()
    out = []
    for item in items:
        if item not in seen:     # 哈希查找期望 O(1)
            seen.add(item)
            out.append(item)
    return out`,
      explanation: "两段代码结果相同，但前者每次 `in` 都是线性扫描，总量与 n² 成正比；后者用集合把单次判断降为常数，代价是 O(n) 额外空间。",
    },
    practiceSteps: [
      "写出两版去重并给定 n = 20000 的输入，记录耗时拐点出现的规模。",
      "为每段代码标注主导操作，再独立推导一次复杂度，与实测拐点对照。",
      "把 reproducer 简化到最小规模，说明常数因子在多大 n 后才可忽略。",
    ],
    masteryChecklist: [
      "能不看代码、只看循环结构写出复杂度。",
      "能解释「同一算法在不同 n 区间谁更快」的原因。",
    ],
  },
  "algo-space-tradeoff": {
    overview: [
      "空间复杂度只统计额外申请的空间。输入数组本身不算，但为它新建的结构、递归栈、缓存都算。",
      "时空权衡的判断标准是资源瓶颈：内存紧张就压空间，延迟敏感就换空间。",
    ],
    mechanism: [
      "递归的空间开销等于最大栈深度：树退化成链时深度为 n，会同时吃掉 O(n) 栈空间。",
      "原地算法通过复用输入区域（如交换）省掉额外数组，代价是通常会破坏稳定性。",
    ],
    example: {
      title: "递归复制 vs 传下标区间",
      language: "python",
      code: `# 每层都切片 -> 额外 O(n) 空间，总空间 O(n^2)（深度 n）
def max_slice(nums):
    if len(nums) == 1:
        return nums[0]
    return max(nums[0], max_slice(nums[1:]))

# 只传下标 -> 额外 O(1) 空间（栈深度仍为 O(n)）
def max_range(nums, start=0):
    if start == len(nums) - 1:
        return nums[start]
    return max(nums[start], max_range(nums, start + 1))`,
      explanation: "第一版每层 `nums[1:]` 都新建列表，累计产生 O(n²) 的临时空间；第二版只传递下标，除调用栈外没有额外分配。",
    },
    practiceSteps: [
      "把一段使用切片的递归改成传下标，并对比内存峰值。",
      "给同一个需求写出「多花钱省时间」和「省空间多花时间」两版，标注取舍。",
      "测量递归深度上限（如 Python 的默认限制）与实测栈空间的关系。",
    ],
    masteryChecklist: [
      "能指出实现里每一处额外分配的来源。",
      "能判断一次缓存是否值得（命中率与收益）。",
    ],
  },
  "algo-correctness-invariants": {
    overview: [
      "正确性需要理由，而不是「跑通了几个样例」。循环不变式是把理由写下来的标准工具。",
      "不变式写好后，边界用例自然浮现：空输入、单元素、全部相同、极值都会逼你检查初始条件。",
    ],
    mechanism: [
      "三步验证：初始化成立 → 每轮保持 → 终止时推出结论；任一环节断裂就说明实现有洞。",
      "终止性需要一个单调递减的正度量（如剩余区间长度），否则循环可能永不退出。",
    ],
    example: {
      title: "带不变式的二分查找",
      language: "python",
      code: `def first_ge(nums, target):
    # 不变式：答案（若存在）始终落在 [left, right] 内
    left, right, ans = 0, len(nums), -1
    while left < right:                 # right 是开区间边界
        mid = left + (right - left) // 2
        if nums[mid] >= target:
            ans = mid                   # 记录候选，继续向左收缩
            right = mid
        else:
            left = mid + 1
    return ans`,
      explanation: "`left + (right - left) // 2` 避免溢出；命中时不立即返回而是继续收缩，保证拿到「第一个」；区间每次至少缩 1，故必然终止。",
    },
    practiceSteps: [
      "为上面的函数写明初始/保持/终止三句话。",
      "构造「目标小于所有元素」「大于所有元素」「正好等于首尾元素」三类用例验证。",
      "故意把 `right = mid` 改成 `right = mid - 1`，观察在哪个输入下开始出错。",
    ],
    masteryChecklist: [
      "能说出实现里每一行维护了不变式的哪部分。",
      "能用反例指出一个「看起来对」的实现错在哪里。",
    ],
  },
  "algo-array-two-pointer": {
    overview: [
      "数组的随机访问是 O(1)、中间插入是 O(n)，这个不对称决定了大多数数组技巧围绕「扫描与移动」展开。",
      "双指针与滑动窗口的共同点是：用一次线性扫描替代嵌套扫描，前提是存在可安全排除的单调性。",
    ],
    mechanism: [
      "夹逼依赖有序：和偏大只能通过减小较大者来改善，于是每步排除一整列候选。",
      "滑动窗口维护一个可增量更新的窗口性质，扩张右边界、必要时收缩左边界，两端各只前进一次，故总代价 O(n)。",
    ],
    example: {
      title: "最长无重复子串（滑动窗口）",
      language: "python",
      code: `def longest_unique(s: str) -> int:
    last = {}          # 字符 -> 最近一次出现的下标
    start = 0
    best = 0
    for i, ch in enumerate(s):
        if ch in last and last[ch] >= start:
            start = last[ch] + 1        # 收缩到重复字符之后
        last[ch] = i
        best = max(best, i - start + 1)
    return best`,
      explanation: "窗口内始终没有重复字符；发现重复时把左边界跳到重复字符的下一位，而不是逐格移动，因此每个字符只被处理常数次。",
    },
    practiceSteps: [
      "用「abcabcbb」「bbbbb」「空串」三组输入验证实现。",
      "把实现改成逐格收缩左边界，比较复杂度并说明差异原因。",
      "把同一模板迁移到「和不超过 K 的最长子数组」。",
    ],
    masteryChecklist: [
      "能说明右指针为什么不需要回退。",
      "能为滑动窗口写出它的不变式。",
    ],
  },
  "algo-linked-list": {
    overview: [
      "链表用指针换取插入删除的灵活性，代价是失去随机访问。所有链表 bug 几乎都来自「指针改写顺序」。",
      "虚拟头节点是消除首元素特判的标准手法：让「首元素」也变成「某个节点的 next」。",
    ],
    mechanism: [
      "反转需要三个指针：prev、curr、next。必须先把 curr.next 存入 next，再改 curr.next 指向 prev，最后整体前移。",
      "快慢指针利用相对速度：慢走一格、快走两格，无环时快指针先到尾部，有环时两者必在环内相遇。",
    ],
    example: {
      title: "单链表原地反转",
      language: "go",
      code: `type Node struct {
    Val  int
    Next *Node
}

func Reverse(head *Node) *Node {
    var prev *Node
    curr := head
    for curr != nil {
        next := curr.Next // 先保存后继
        curr.Next = prev  // 再改指向
        prev = curr       // 前移
        curr = next
    }
    return prev
}`,
      explanation: "循环结束时 prev 指向原尾节点，即新头。顺序颠倒（先改 curr.Next）会丢失剩余链表，是最常见的链表错误。",
    },
    practiceSteps: [
      "在纸上对 1→2→3 逐步演算三个指针的位置。",
      "实现环检测，并说明相遇后如何求环入口。",
      "实现「删除倒数第 k 个节点」，用虚拟头节点避免特判。",
    ],
    masteryChecklist: [
      "能在不运行代码的情况下说明指针变化。",
      "能解释虚拟头节点消除了哪一类特殊分支。",
    ],
  },
  "algo-stack-queue": {
    overview: [
      "栈和队列是对访问顺序加约束的结构：一旦确定了「只能取最近的」或「只能取最早的」，很多嵌套匹配问题就有了统一解法。",
      "单调栈/单调队列把「两两比较」压成线性，因为每个元素最多进出一次。",
    ],
    mechanism: [
      "括号匹配、表达式求值都依赖「最近未匹配」语义，这正是 LIFO 的定义。",
      "单调栈在入栈前弹出所有不可能再成为答案的元素：被弹出的元素，其答案已由当前元素确定。",
    ],
    example: {
      title: "下一个更大元素（单调栈）",
      language: "javascript",
      code: `function nextGreater(nums) {
  const res = new Array(nums.length).fill(-1);
  const stack = []; // 存下标，对应值单调递减
  for (let i = 0; i < nums.length; i++) {
    while (stack.length && nums[stack[stack.length - 1]] < nums[i]) {
      const idx = stack.pop();     // 当前元素就是 idx 的答案
      res[idx] = nums[i];
    }
    stack.push(i);
  }
  return res;
}`,
      explanation: "每个下标最多入栈一次、出栈一次，总代价 O(n)；栈内保持递减，保证弹出的都是「遇到更大值」的元素。",
    },
    practiceSteps: [
      "用 [2,1,2,4,3] 手工演算栈的变化。",
      "用两个栈实现队列，并说明均摊 O(1) 的推导。",
      "把单调栈改成单调队列，解决滑动窗口最大值。",
    ],
    masteryChecklist: [
      "能说明被弹出元素为什么不可能再有更优答案。",
      "能判断一个问题该用栈还是队列。",
    ],
  },
  "algo-hash-table": {
    overview: [
      "哈希表用「空间换常数时间」，把查找从按序比较变成一次定位。它的平均性能依赖哈希均匀与负载因子受控。",
      "选择哈希表的前提是「不需要有序或范围查询」；一旦需要按序遍历，就该换成有序结构。",
    ],
    mechanism: [
      "冲突策略：链地址法把同桶元素串起来，删除简单；开放寻址在表内探测空位，缓存友好但删除要打墓碑标记。",
      "负载因子 = 元素数 / 桶数。超过阈值就扩容并重新散列，这次 O(n) 操作被均摊到后续插入上。",
    ],
    example: {
      title: "词频统计与 Top-K",
      language: "python",
      code: `from collections import Counter

def top_k_words(text: str, k: int):
    counts = Counter(text.split())          # 哈希计数：平均 O(n)
    return sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:k]`,
      explanation: "计数用哈希表把「查找已有计数」降为常数；排序只在去重后的键上做，规模远小于原文长度。",
    },
    practiceSteps: [
      "实现一个简易哈希表（数组 + 链地址法），并测量不同负载因子下的查找长度。",
      "用同一份数据比较哈希去重与排序去重的耗时差异。",
      "构造一个哈希函数，使给定输入全部落进同一个桶，观察退化行为。",
    ],
    masteryChecklist: [
      "能解释负载因子与查找代价的关系。",
      "能判断某需求是否适合用哈希表。",
    ],
  },
  "algo-binary-search": {
    overview: [
      "二分不是「猜中点」，而是「每次排除一半候选」。前提是能构造单调判定。",
      "绝大多数二分 bug 来自区间定义（开/闭）与指针更新不一致，而不是中点计算。",
    ],
    mechanism: [
      "把区间统一成半开 [left, right)：循环条件 left < right，命中时收敛 right = mid，未命中时 left = mid + 1。",
      "答案二分：当问题问「最小的可行值」时，把判定函数当谓词，二分搜索它的翻转点。",
    ],
    example: {
      title: "答案二分：最小可行容量",
      language: "python",
      code: `def min_capacity(weights, days):
    def feasible(cap):                 # 单调谓词：容量越大越可行
        used, cur = 1, 0
        for w in weights:
            if cur + w > cap:
                used += 1
                cur = 0
            cur += w
        return used <= days

    left, right = max(weights), sum(weights)
    while left < right:
        mid = left + (right - left) // 2
        if feasible(mid):
            right = mid
        else:
            left = mid + 1
    return left`,
      explanation: "把「能否在 days 天内运完」写成关于容量的单调谓词，再二分翻转点，避免猜测具体容量。",
    },
    practiceSteps: [
      "用 1 个元素、2 个元素、目标不存在三类输入验证二分实现。",
      "把「第一个 >= target」改写成「最后一个 <= target」，只调整两行。",
      "为答案二分写一个单调谓词并证明单调性。",
    ],
    masteryChecklist: [
      "能说明区间每次收缩后答案仍在区间内。",
      "能区分「值二分」与「答案二分」的差别。",
    ],
  },
  "algo-tree-traversal": {
    overview: [
      "树是递归结构：一棵树 = 根 + 若干子树。递归写法最能体现结构，迭代写法最能体现代价控制。",
      "遍历顺序决定用途：中序给 BST 有序序列，前序用于序列化，后序用于自底向上汇总，层序用于最短层数。",
    ],
    mechanism: [
      "递归深度等于树高；退化链式树深度为 n，可能触发栈溢出，需要改成迭代或显式栈。",
      "BST 校验必须携带上下界：只比较父子会漏掉「右子树中出现小于祖先的值」这类错误。",
    ],
    example: {
      title: "BST 校验（携带上下界）",
      language: "java",
      code: `static boolean isBst(TreeNode node, long low, long high) {
    if (node == null) return true;
    if (node.val <= low || node.val >= high) return false;
    return isBst(node.left, low, node.val)
        && isBst(node.right, node.val, high);
}

static boolean isBst(TreeNode root) {
    return isBst(root, Long.MIN_VALUE, Long.MAX_VALUE);
}`,
      explanation: "递归时把根的值作为子树的界传递下去，任何节点都必须落在自己的开区间内，因此能发现跨层违约。",
    },
    practiceSteps: [
      "用递归与显式栈两种方式实现前序遍历，比较代码结构。",
      "构造一棵「局部满足父子大小关系但不是 BST」的树，验证校验函数能识别。",
      "实现层序遍历并输出每层节点列表。",
    ],
    masteryChecklist: [
      "能说出四种遍历各自的典型用途。",
      "能解释 BST 校验为什么需要上下界。",
    ],
  },
  "algo-sorting": {
    overview: [
      "排序是所有算法的公共基础设施：先排序往往能让后续步骤变成线性扫描。",
      "选择排序算法要看三点：数据规模、是否要求稳定、键的取值范围。",
    ],
    mechanism: [
      "比较排序的下界是 Ω(n log n)：n! 种排列每次比较最多对半分，需要 log(n!) 次比较。",
      "稳定性意味着相等元素的相对次序不变，因此多关键字排序可以「先按次关键字排，再按主关键字稳定排」。",
    ],
    example: {
      title: "多关键字排序依赖稳定性",
      language: "python",
      code: `records = [
    {"dept": "B", "score": 90},
    {"dept": "A", "score": 90},
    {"dept": "A", "score": 95},
]

# 先按次关键字（分数）降序，再按主关键字（部门）升序稳定排序
step1 = sorted(records, key=lambda r: -r["score"])
step2 = sorted(step1, key=lambda r: r["dept"])   # Python 的 sorted 稳定
for r in step2:
    print(r["dept"], r["score"])`,
      explanation: "第二趟排序不会打乱第一趟建立的分数次序，最终得到「部门升序、部门内分数降序」的结果。",
    },
    practiceSteps: [
      "手写快排与归并，用同一组数据比较耗时。",
      "构造使快排固定取首元素退化为 O(n²) 的输入。",
      "用计数排序处理一组范围已知的整数，并说明它为什么不受下界限制。",
    ],
    masteryChecklist: [
      "能说明哪些排序稳定、哪些不稳定。",
      "能判断某场景是否值得改用非比较排序。",
    ],
  },
  "algo-graph-search": {
    overview: [
      "图把「关系」显式建模成节点与边。建图方式（邻接表/矩阵）直接决定遍历代价。",
      "选择遍历算法的第一问是：边权是否相等？有向还是无向？",
    ],
    mechanism: [
      "BFS 用队列按层扩展，第一次到达某节点时的层数即最少边数。",
      "DFS 用栈（或递归）深入到底再回溯，适合连通分量、路径枚举与拓扑排序。",
    ],
    example: {
      title: "BFS 求无权图最短跳数",
      language: "python",
      code: `from collections import deque

def bfs_dist(graph, start):
    dist = {start: 0}
    queue = deque([start])
    while queue:
        node = queue.popleft()
        for nxt in graph.get(node, []):
            if nxt not in dist:          # 首次到达即最短
                dist[nxt] = dist[node] + 1
                queue.append(nxt)
    return dist`,
      explanation: "因为 BFS 按层推进，节点首次被访问时的层数必然最小；把 `dist` 当已访问集还能避免重复入队。",
    },
    practiceSteps: [
      "用邻接表建一个有向图，分别跑 BFS 与 DFS 并对比访问顺序。",
      "实现拓扑排序，并对含环图给出检测结论。",
      "把无权最短路改成 Dijkstra（用优先队列），说明多出来的代价换来什么。",
    ],
    masteryChecklist: [
      "能根据图的性质选择遍历算法。",
      "能解释为什么 BFS 首次到达即最短。",
    ],
  },
  "algo-dp-greedy": {
    overview: [
      "动态规划处理「重叠子问题 + 最优子结构」；贪心处理「局部最优能推出全局最优」这一更强的前提。",
      "写 DP 的起点是暴力递归：先确认正确性，再观察重复子问题，最后补缓存或改成表格。",
    ],
    mechanism: [
      "状态必须无后效：一旦确定某状态的取值，后续决策不再依赖到达它的路径细节。",
      "转移方程与初始化同样重要：边界状态写错，整张表都会偏。",
    ],
    example: {
      title: "0-1 背包（一维滚动数组）",
      language: "python",
      code: `def knapsack(weights, values, capacity):
    dp = [0] * (capacity + 1)            # dp[c] = 容量 c 时的最大价值
    for i, w in enumerate(weights):
        # 逆序遍历：保证每件物品最多用一次
        for c in range(capacity, w - 1, -1):
            dp[c] = max(dp[c], dp[c - w] + values[i])
    return dp[capacity]`,
      explanation: "逆序遍历容量维避免同一物品被重复使用；如果把内层改成正序，就变成了完全背包的语义。",
    },
    practiceSteps: [
      "写出 0-1 背包的二维版本，再压成一维并解释逆序的原因。",
      "用单位价值贪心解同一组数据，找出它失败的反例。",
      "为「编辑距离」写出状态定义与转移方程，并说明边界初始化。",
    ],
    masteryChecklist: [
      "能说明一个状态定义为什么无后效。",
      "能判断一个问题该用贪心还是 DP。",
    ],
  },
};
