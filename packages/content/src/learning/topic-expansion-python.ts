/**
 * Python · 知识点扩容（追加式，2026-10-15）。
 *
 * 口径与 topic-expansion-backend-engineering.ts 一致：每条 expansion = 1 个知识点 + 它的 2 道配套题。
 * 术语必须配「人话」解释（terms.plain），小结要能合上书复述。
 * 全部 topic.key 以 python- 前缀追加，且不与 python.ts 既有 key 重复。
 */
import type { TopicExpansion } from "./topic-expansions";

export const pythonTopicExpansions: TopicExpansion[] = [
  {
    trackSlug: "python",
    stageKey: "python-foundation",
    topic: {
      key: "python-strings-format",
      title: "字符串与格式化输出",
      summary:
        "字符串是不可变序列：所有「修改」其实都在生成新对象。f-string 是当前最好的拼装方式，但拼接本身要尽量少——循环里 += 拼字符串是新手最常见的性能坑。",
      concepts: ["不可变字符串", "f-string 格式规范", "切片与常用方法", "join 拼接"],
      principles: [
        "字符串不可变：拼接、替换、大小写转换都返回新字符串，原对象不会被改动。",
        "f-string 在运行时求值：大括号里可以放表达式，但求值发生在那一刻，之后变量再变不会影响已经生成的字符串。",
        "格式化只负责「怎么显示」；为了显示而把数据本身改成字符串（例如把数字转成字符串再参与计算）是方向性错误。",
      ],
      applications: [
        "把数字、日期按业务要求显示成金额、百分比或报表列宽。",
        "日志与提示信息拼装：循环内先用 list 收集片段，最后 join 一次写出去。",
      ],
      pitfalls: [
        "在循环里用 += 反复拼字符串：每次都会新建对象，数据量大时开销明显，应改用列表 + join。",
        "混淆自动转字符串与必须显式转换：1 + \"2\" 会报 TypeError，而 f-string 里的 1 会被正常显示。",
      ],
      method:
        "先问这段文本是给人看的还是给程序用的：给人看的用 f-string 一次成形，给程序用的留在数据结构里，最后统一 join。",
      exercise: "写一个报表函数：接收一组商品名与价格，输出对齐的文本表格，金额保留两位小数并加千分位。",
      checkpoint: "能说清为什么循环里拼接字符串慢，并给出列表 + join 的改写。",
      lesson: {
        overview: [
          "字符串是 Python 里使用频率最高的类型，也是最容易被当成普通文本而忽视的类型。它其实是**不可变序列**：可以按下标和切片访问其中的字符，但任何看起来像修改的操作都会返回一个新对象。理解这一点，后面所有关于拼接与性能的讨论才有落脚点。",
          "格式化解决的是「数据到人」的最后一公里：同一个浮点数，给机器看是 0.1234，给人看可能是 12.34% 或 1,234.00 元。f-string 把这件事压缩到最短的语法里，同时让代码的阅读顺序和实际输出顺序一致，可读性最好。",
          "第三层是拼接策略。新手常把文本显示和数据组装混在一起，一边循环一边拼字符串，结果代码既慢又难测试。更稳妥的默认写法是：让片段留在列表里，等真正要输出时再 join 一次，把显示逻辑与业务逻辑分开。",
        ],
        mechanism: [
          "因为字符串不可变，s += x 并不是在原字符串后面追加，而是新建一个包含旧内容加新内容的对象，再让 s 指向它。旧对象若还被别处引用就继续存在；在循环里这样做会不断产生中间对象。",
          "f-string 的大括号部分在运行时求值，可以带格式规范：冒号后面写 .2f 表示保留两位小数，逗号表示千分位，>10 表示右对齐占十列。格式规范只影响显示，不改变变量本身的值。",
          "str.join(可迭代对象) 会先算好总长度再一次性分配空间，所以列表收集 + 一次 join 比循环 += 少做很多次内存分配。前提是列表里每个元素都必须是字符串，数字要先转换或先格式化。",
        ],
        example: {
          title: "报表输出：f-string 格式化 + join 组装",
          language: "python",
          code: "items = [(\"键盘\", 129.5), (\"显示器\", 1899.0), (\"HDMI 线\", 39.9)]\n\n# 1) 每行用 f-string 一次成形：对齐、千分位、两位小数\nlines = [f\"{name:<8}\" + f\"{price:>12,.2f}\" for name, price in items]\n\n# 2) 需要拼装多段文本时，先收集再 join，而不是循环里 +=\nheader = \" | \".join([\"商品\", \"价格\"])\nbody = \"\\n\".join(lines)\nprint(header)\nprint(body)\n\n# 3) 数字本身仍然是数字，格式化不改变数据\ntotal = sum(price for _, price in items)\nprint(f\"合计: {total:,.2f} 元\")",
          explanation:
            "name:<8 表示左对齐占 8 列，price:>12,.2f 表示右对齐占 12 列、带千分位、保留两位小数——这样不用手工数空格就能对齐。join 只在最后执行一次，避免了循环内反复新建字符串。注意 items 里的价格始终是 float，f-string 只是把它显示成这样，total 仍然可以做数值求和。",
        },
        practiceSteps: [
          "把一段手工用 + 和 str() 拼出来的提示信息，改写成一条 f-string，并逐步加上格式规范（对齐、小数位、千分位）。",
          "找出代码里在 for 循环内部做字符串 += 的位置，改成列表收集 + 一次 join。",
          "写一个函数接收数字并返回显示文本，确认它只做格式化，没有把数据本身变成字符串。",
        ],
        masteryChecklist: [
          "能解释为什么字符串不可变会导致循环拼接变慢。",
          "能默写常用的 f-string 格式规范（.2f、千分位逗号、左对齐、右对齐）。",
        ],
        summary: [
          "字符串不可变，所有看似修改的操作都产生新对象。",
          "f-string 在运行时求值，是目前最可读的格式化方式；格式规范只影响显示，不改变值。",
          "循环里不要用 += 拼字符串；用列表收集，最后 join 一次。",
          "join 要求元素都是字符串，数字要先转换或先格式化。",
        ],
        terms: [
          {
            term: "不可变（Immutable）",
            plain: "对象一旦创建就不能改，所谓修改其实是造了个新的。",
            detail:
              "字符串、数字、元组都不可变。好处是可以安全地被多处共享、能当字典的键；代价是每次修改都有创建新对象的开销，所以别在循环里反复拼接。",
          },
          {
            term: "f-string",
            plain: "在字符串前面加 f，用大括号把变量直接嵌进去的写法。",
            detail:
              "Python 3.6 起可用，是现在推荐的格式化方式。大括号里写表达式，冒号后写格式规范。真要显示大括号本身时写两次，如 {{ 与 }}。",
          },
          {
            term: "join",
            plain: "用一个分隔符把一堆字符串一次拼成一条。",
            detail:
              "写法是 分隔符.join(列表)，注意分隔符在前、列表在后。它比循环 += 高效，因为能一次性算好长度；同时也强制你确认列表里都是字符串，否则会报 TypeError。",
          },
          {
            term: "切片（Slice）",
            plain: "用 [起:止] 从序列里取一段，含起点不含终点。",
            detail:
              "s[1:4] 取的是下标 1、2、3，不含 4。省略起点表示从头开始，省略终点表示到末尾。切片永远返回新对象，不会改动原字符串。",
          },
        ],
      },
    },
    questions: [
      {
        key: "python-sup-python-strings-format-s1",
        stageKey: "python-foundation",
        topicKey: "python-strings-format",
        type: "single",
        stem: "要在循环里把很多片段拼成一大段文本，下面哪种写法通常最合适？",
        options: [
          { key: "A", text: "在循环里反复 result += piece" },
          { key: "B", text: "先把片段放进列表，循环结束后用空字符串 join 拼一次" },
          { key: "C", text: "每拼一次就 print 一次" },
          { key: "D", text: "把片段都存成数字再相加" },
        ],
        answer: ["B"],
        explanation:
          "Python 的字符串不可变，result += piece 每次都会新建一个字符串对象并复制已有内容，循环 N 次就有 N 次分配与复制。把片段先收集进列表、最后用 join 拼一次，只需要一次长度计算和一次内存分配，既快又便于把拼接逻辑与业务逻辑分开测试。",
        difficulty: "medium",
        tags: ["字符串", "性能", "f-string"],
        sourceKey: "exercism-python",
        level: "进阶",
      },
      {
        key: "python-sup-python-strings-format-j1",
        stageKey: "python-foundation",
        topicKey: "python-strings-format",
        type: "judge",
        stem: "用 f-string 把数字格式化输出后，原来的数字变量本身也被改成了字符串。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "f-string 只负责生成一段新的显示文本，不会改动被引用的变量。数字变量在格式化之后仍然是原来的数值类型，可以继续参与求和、比较等运算。反过来，如果先手工用 str() 把数值转成字符串再去计算，才会遇到类型错误或字符串拼接的诡异结果。",
        difficulty: "easy",
        tags: ["字符串", "格式化", "类型"],
        sourceKey: "exercism-python",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "python",
    stageKey: "python-foundation",
    topic: {
      key: "python-comprehension",
      title: "推导式与迭代惯用法",
      summary:
        "推导式把「新建一个容器」的循环压成一行，通常更好读也更快；但它只适合纯粹的变换与筛选，带复杂分支或副作用时应该退回普通 for 循环。",
      concepts: ["列表推导式", "条件过滤", "字典与集合推导式", "enumerate 与 zip"],
      principles: [
        "推导式的读法是「我要的表达式 + 从哪里取 + 什么条件下取」，执行顺序与普通循环一致，只是把结果表达式提到了前面。",
        "推导式适合纯粹的变换与过滤；一旦包含打印、写文件等副作用，可读性反而不如普通循环。",
        "推导式与生成器表达式语法几乎一样，区别在中括号：列表推导式立即算出全部结果，生成器表达式按需产出。",
      ],
      applications: [
        "批量数据清洗：从原始记录里筛出有效行并转换格式。",
        "用 zip 把两个列表按位置配对，用 enumerate 同时拿到下标和值。",
      ],
      pitfalls: [
        "在推导式里塞多层嵌套条件或副作用，写成一行谁都看不懂的「密码」。",
        "忘记推导式会立即生成完整列表，对很大的数据源应改用生成器表达式。",
      ],
      method:
        "先写成普通循环跑通并测试，再把只做变换或筛选的那部分折叠成推导式；一次只折一层。",
      exercise:
        "读入一份用户记录，用推导式筛出活跃用户并转成「用户 ID 到邮箱」的字典，再用 zip 生成两份列表的对照表。",
      checkpoint: "能把一段普通循环改写成推导式，并说明什么时候不该改。",
      lesson: {
        overview: [
          "推导式是 Python 最有辨识度的语法之一：用一个表达式描述生成一个新容器的完整规则。它不新增能力，只是把「新建空容器、逐个循环、追加结果」这三件事压缩到一起，减少样板代码。",
          "它的可读性优势并非绝对。表达式部分足够简单时，一行读完比读四行循环更快；一旦出现嵌套循环、多重判断或副作用，压缩反而会让人失去执行顺序的线索，此时普通循环更专业。",
          "同一族里还有 enumerate 和 zip 这类惯用法：前者让循环同时拿到下标与元素，后者把多个序列按位置配对。它们和推导式一起，构成了 Python 处理序列的日常语感。",
        ],
        mechanism: [
          "列表推导式等价于「建空列表、遍历、条件通过就 append 表达式的结果」。它是普通循环的语法糖，不涉及任何新的求值规则。",
          "求值顺序是先遍历、后判断、最后算表达式，所以条件里可以引用当前元素，表达式里也可以再加工通过筛选的值。多个 for 子句按书写顺序从左到右嵌套，写在前面的先循环。",
          "生成器表达式把中括号换成小括号，返回的是惰性对象：只有在迭代时才逐个计算，因此适合数据量大或只需走一遍的场景，但它只能被消费一次。",
        ],
        example: {
          title: "从原始记录到干净的字典",
          language: "python",
          code: "raw = [\n    {\"id\": 1, \"name\": \" Ada \", \"active\": True},\n    {\"id\": 2, \"name\": \"Bob\", \"active\": False},\n    {\"id\": 3, \"name\": \"Cy\", \"active\": True},\n]\n\n# 筛选 + 变换：只做纯计算，适合推导式\nactive_names = [r[\"name\"].strip() for r in raw if r[\"active\"]]\nprint(active_names)  # ['Ada', 'Cy']\n\n# 字典推导式：直接用记录建索引\nname_by_id = {r[\"id\"]: r[\"name\"].strip() for r in raw}\nprint(name_by_id)    # {1: 'Ada', 2: 'Bob', 3: 'Cy'}\n\n# enumerate 同时拿下标和值\nfor i, name in enumerate(active_names, start=1):\n    print(i, name)\n\n# zip 按位置配对两个序列\npairs = list(zip([\"a\", \"b\"], [1, 2]))\nprint(pairs)  # [('a', 1), ('b', 2)]",
          explanation:
            "推导式里只做了 strip 变换与 active 筛选，没有任何副作用，所以一行比四行循环更清楚。字典推导式把 id 当键、名字当值，适合后续按 id 查名字。zip 在长度不一致时会以短的为准，用之前要确认两个序列长度一致，或确认截断是可接受的。",
        },
        practiceSteps: [
          "找一段「建空列表 + for + append」的代码，判断其中的操作是否纯粹，纯粹则改写成推导式。",
          "把同一段逻辑改写成生成器表达式，用 sum 或 for 消费它，观察是否还需要完整列表。",
          "用 enumerate 替换手写下标计数的循环，用 zip 替换按下标同时访问两个列表的循环。",
        ],
        masteryChecklist: [
          "能写出带条件过滤的列表推导式，并说清它的求值顺序。",
          "能判断什么情况下应该保留普通 for 循环，而不是硬套推导式。",
        ],
        summary: [
          "推导式是「建容器 + 循环 + 追加」的语法糖，不新增语义。",
          "只做变换与筛选时用它；带副作用或复杂嵌套时用普通循环。",
          "小括号版本是惰性的生成器表达式，只能消费一次。",
          "enumerate 拿下标，zip 按位置配对，长度不等时以短为准。",
        ],
        terms: [
          {
            term: "推导式（Comprehension）",
            plain: "用一行表达式直接算出一个新列表、字典或集合。",
            detail:
              "列表用中括号、字典用大括号加冒号、集合用大括号。它总是生成新对象，不会修改原来的容器，这一点常被误解为就地修改。",
          },
          {
            term: "生成器表达式（Generator Expression）",
            plain: "长得像推导式但用圆括号，值算到用的时候才产生。",
            detail:
              "适合数据量大或只需走一遍的场景，内存占用小。代价是只能迭代一次，第二次遍历会得到空结果；需要重复遍历就先 list() 落成列表。",
          },
          {
            term: "enumerate",
            plain: "循环时同时给你下标和元素，不用自己维护计数器。",
            detail:
              "默认从 0 开始，可以用 start=1 改成从 1 开始。它比 range(len(列表)) 更安全，因为不会出现下标越界，也不会因为忘记加一而数错。",
          },
          {
            term: "zip",
            plain: "把几个序列按位置配成一组一组。",
            detail:
              "结果是个迭代器，长度以最短的序列为准，多余部分直接被忽略且不会报错——这正是它的常见陷阱，使用前应确认两个序列长度一致。",
          },
        ],
      },
    },
    questions: [
      {
        key: "python-sup-python-comprehension-s1",
        stageKey: "python-foundation",
        topicKey: "python-comprehension",
        type: "single",
        stem: "下面哪一段最适合改写成列表推导式？",
        options: [
          { key: "A", text: "遍历列表，对每个元素做纯变换后放进新列表" },
          { key: "B", text: "遍历列表，每处理一个元素就写一行日志并更新数据库" },
          { key: "C", text: "带四层嵌套判断和异常处理的复杂流程" },
          { key: "D", text: "边遍历边删除原列表中的元素" },
        ],
        answer: ["A"],
        explanation:
          "推导式的强项是对每个元素做纯变换或筛选、收集成新容器：没有副作用、逻辑单线，压成一行后反而更容易一眼读懂。B 有日志与数据库这类副作用，出错时很难定位是第几次循环；C 的嵌套与异常处理需要多行表达才清楚；D 在遍历中修改原容器本身就会打乱迭代，应改成构建新列表。",
        difficulty: "medium",
        tags: ["推导式", "可读性"],
        sourceKey: "exercism-python",
        level: "进阶",
      },
      {
        key: "python-sup-python-comprehension-j1",
        stageKey: "python-foundation",
        topicKey: "python-comprehension",
        type: "judge",
        stem: "生成器表达式算出的结果对象可以被反复遍历多次，每次都能拿到全部元素。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "生成器表达式返回的是迭代器，它记录了当前走到哪里，遍历完就耗尽；再遍历一次得到的是空结果，而且不会报错，容易让人误以为数据丢了。需要重复使用时应先用 list() 把它落成列表，或干脆用列表推导式；只有确实要省内存、且只消费一遍时才保留惰性写法。",
        difficulty: "medium",
        tags: ["生成器", "迭代", "推导式"],
        sourceKey: "algorithms-python",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "python",
    stageKey: "python-data-structures",
    topic: {
      key: "python-collections-advanced",
      title: "元组、命名元组与解包",
      summary:
        "元组是不可变的记录：适合表达一条字段固定的数据，还能当字典的键。命名元组给字段起了名字，避免用下标 0、1、2 去猜含义。",
      concepts: ["元组不可变", "解包与星号收集", "命名元组", "可哈希性"],
      principles: [
        "元组的不可变使它可哈希，因此能作为字典的键或放进集合；列表做不到。",
        "解包按位置一一对应，数量不符会抛 ValueError；加星号的变量可以把剩余元素收集成一个列表。",
        "命名元组是带字段名的元组：读取方式更像对象，但仍保留元组的不可变性与可解包特性。",
      ],
      applications: [
        "用（纬度, 经度）或（用户 ID, 商品 ID）这种元组作为字典键做聚合计数。",
        "函数返回多个值（实际返回的是元组），调用方直接解包；用命名元组让返回值的字段自解释。",
      ],
      pitfalls: [
        "误以为元组内容绝对不会变：元组里如果放了列表，那个列表的内容仍可以被修改。",
        "一直用下标访问元素（record[3]），几个月后没人知道 3 到底代表什么。",
      ],
      method:
        "先问这是不是一条字段固定的记录：是就用命名元组或 dataclass；只是临时把几个值捆在一起，普通元组加解包就够了。",
      exercise:
        "用命名元组表示学生记录，按（班级, 姓名）元组排序，并统计每个学生选了几门课。",
      checkpoint: "能解释为什么元组能当字典键而列表不能，并说出命名元组比普通元组好在哪。",
      lesson: {
        overview: [
          "元组常被当成不可变的列表，但它真正的定位是**记录**：字段数量与含义固定，位置本身就携带语义。比如坐标 (x, y)，把两个值调换顺序就变成了另一件事；而列表更像同一类东西的集合，长度可变、顺序可变。",
          "不可变带来一个很实用的副作用：元组可哈希，于是它能当字典的键。凡是需要用多个字段的组合去索引数据时，比如按「用户加商品」统计访问次数，或者按「日期加渠道」汇总报表，元组都是天然的选择，不必自己拼字符串。",
          "解包让元组的取值变得顺滑：a, b = point 一行就能拿到两个字段，加星号还能把剩下的收成一个列表。命名元组再往前一步，给每个位置起了名字，读写都不必依赖对下标的记忆。",
        ],
        mechanism: [
          "元组创建后长度和元素引用都不能改，因此它的哈希值可以稳定计算，满足字典键必须可哈希的要求。注意前提是元组内每个元素本身也可哈希，元组里塞了列表再当键就会报错。",
          "解包的本质是把右侧可迭代对象逐个取出并按位置赋给左侧变量。左侧多一个带星号的变量时，Python 先把能一一对应的位置分好，剩余元素作为一个列表交给它。",
          "命名元组由 collections.namedtuple 或 typing.NamedTuple 创建，本质仍是元组，只是额外提供了按字段名访问的属性。它不可变、可解包、可哈希，因此常被用作轻量的数据记录。",
        ],
        example: {
          title: "用元组做复合键，用命名元组做记录",
          language: "python",
          code: "from collections import namedtuple, defaultdict\n\nPoint = namedtuple(\"Point\", [\"x\", \"y\"])\np = Point(3, 4)\nprint(p.x, p.y)   # 3 4，按字段名读，不用猜下标\nx, y = p          # 仍然可以解包\n\n# 元组可哈希，能当字典的键：按（用户, 商品）统计次数\nviews = defaultdict(int)\nviews[(\"u1\", \"item-a\")] += 1\nviews[(\"u1\", \"item-a\")] += 1\nprint(views[(\"u1\", \"item-a\")])   # 2\n\n# 星号解包：第一个元素单独拿，剩下的收成列表\nfirst, *rest = [10, 20, 30, 40]\nprint(first, rest)   # 10 [20, 30, 40]\n\n# 排序按字段从左到右依次比较\nstudents = [Point(2, 5), Point(1, 9), Point(2, 1)]\nprint(sorted(students))   # Point(1, 9) 在最前",
          explanation:
            "命名元组保留了元组的全部能力（解包、哈希、可比较），只是把下标换成字段名，读起来自解释。元组作为字典键之所以可行，是因为它不可变、哈希值稳定；换成列表会直接抛 TypeError。defaultdict(int) 让计数这个模式不用先判断键是否存在。sorted 对元组默认按位置逐项比较，先比第一个字段、相等再比第二个，所以倒序只需要加 reverse=True。",
        },
        practiceSteps: [
          "把代码里用下标访问记录的地方改写成命名元组的字段访问，确认行为不变。",
          "找一个函数返回多个值、调用方按位置取用的地方，改成命名元组并补上字段名。",
          "用元组键的字典替代嵌套字典做二维聚合，感受取值方式的变化。",
        ],
        masteryChecklist: [
          "能解释元组可哈希、列表不可哈希的原因，并说出后果。",
          "能正确使用星号解包与多字段排序。",
        ],
        summary: [
          "元组是记录，列表是集合；前者位置即语义，后者顺序可变。",
          "不可变让元组可哈希，所以能当字典键或放进集合，前提是内部元素也可哈希。",
          "解包按位置对应，数量不符报 ValueError，星号变量可收集剩余元素。",
          "命名元组等于可读性更好的元组，仍然不可变、可解包、可比较。",
        ],
        terms: [
          {
            term: "可哈希（Hashable）",
            plain: "能算出一个稳定的编号，因此可以当字典的键。",
            detail:
              "列表、字典、集合不可哈希，因为它们内容会变，编号就会失效；元组、字符串、数字可哈希。但元组里若含列表，整个元组也不可哈希，放进字典会立刻报 TypeError。",
          },
          {
            term: "命名元组（Namedtuple）",
            plain: "给元组的每个位置起了名字，可以用点号取字段。",
            detail:
              "它还是元组，因此不会变、能解包、能比较，适合字段少而固定的轻量记录。一旦需要默认值、方法或多个记录类，就该换成 dataclass。",
          },
          {
            term: "解包（Unpacking）",
            plain: "一行把序列里的元素分别赋给几个变量。",
            detail:
              "写法是 a, b = pair。变量个数必须与元素个数一致，否则报 ValueError；加星号的变量负责收集多余部分。这是 Python 里读取元组最推荐的写法。",
          },
          {
            term: "defaultdict",
            plain: "字典取值时若键不存在，自动帮你造一个默认值。",
            detail:
              "从 collections 导入，传 int 就是默认 0，传 list 就是默认空列表。常用于计数与分组，省掉先判断键在不在的分支。",
          },
        ],
      },
    },
    questions: [
      {
        key: "python-sup-python-collections-advanced-s1",
        stageKey: "python-data-structures",
        topicKey: "python-collections-advanced",
        type: "single",
        stem: "需要按（用户 ID, 商品 ID）这个组合统计访问次数，用哪种键最合适？",
        options: [
          { key: "A", text: "把两个 ID 用字符串拼接成一个键" },
          { key: "B", text: "用（用户 ID, 商品 ID）元组作为字典的键" },
          { key: "C", text: "用两个 ID 组成的列表作为字典的键" },
          { key: "D", text: "用两个 ID 组成的集合作为字典的键" },
        ],
        answer: ["B"],
        explanation:
          "字典的键必须可哈希。元组不可变，哈希值稳定，因此可以直接作为复合键，而且两个字段各自保持原类型、比较时按位置逐项判断。列表和集合都是可变容器、不可哈希，直接当键会抛 TypeError。用字符串拼接也能工作，但要自己处理分隔符冲突与类型转换，数字 1 和字符串 1 混在一起时容易出错，可读性与安全性都不如元组。",
        difficulty: "medium",
        tags: ["元组", "字典", "可哈希"],
        sourceKey: "algorithms-python",
        level: "进阶",
      },
      {
        key: "python-sup-python-collections-advanced-j1",
        stageKey: "python-data-structures",
        topicKey: "python-collections-advanced",
        type: "judge",
        stem: "元组是不可变的，所以只要元素放进了元组，就绝对不可能再被修改。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "元组的不可变指的是它引用的那几个元素不能再被替换，而不是元素内部不能变。如果元组里放了一个列表，仍然可以通过该列表做 append 或修改元素，元组本身看起来没变，内容却变了。这也正是含列表的元组不可哈希的原因。真正想要深度只读，需要使用不可变元素，并且保证内部也不留可变容器。",
        difficulty: "hard",
        tags: ["元组", "不可变", "可变对象"],
        sourceKey: "algorithms-python",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "python",
    stageKey: "python-data-structures",
    topic: {
      key: "python-exceptions",
      title: "异常处理与错误传播",
      summary:
        "异常是程序表达「这一步没法继续」的正式机制。合格的处理只有一种：你确实知道该怎么办。其余情况应该让它带着原始信息继续往上抛。",
      concepts: ["异常层次与传播", "try/except/else/finally", "raise from 链式异常", "自定义异常"],
      principles: [
        "Python 的异常沿调用栈向上传播，直到被匹配的 except 捕获；没有捕获就打印 traceback 并终止程序。",
        "except 要写具体类型：捕获范围越大，越容易把真正的程序缺陷当成正常错误吞掉。",
        "finally 无论是否发生异常都会执行；用 with 管理文件、连接等资源比手写 finally 更不容易漏。",
      ],
      applications: [
        "读取配置文件：文件不存在就使用默认值，JSON 格式错误则明确报错给用户。",
        "为库定义自己的异常类型，让调用方能区分「输入不合法」和「内部故障」。",
      ],
      pitfalls: [
        "用 except 加 pass 静默吞掉一切，包括拼写错误这类本该暴露的缺陷。",
        "捕获后只打印一句「出错了」就继续走，丢失异常类型与调用链，排障成本大幅上升。",
      ],
      method:
        "先判断这个错误属于可以恢复还是必须暴露：可恢复的捕获并给出明确后续，必须暴露的加 raise 或让它自然上抛，同时用 raise ... from ... 保留原因。",
      exercise:
        "实现 load_config 函数：文件缺失返回默认配置，JSON 解析失败抛出带原始原因的异常，并补三个测试。",
      checkpoint: "能说清 except、else、finally 各自的执行时机，并指出代码里哪些捕获范围过宽。",
      lesson: {
        overview: [
          "异常不只是错误提示，它是 Python 里最正式的错误传递机制：函数发现问题时不必层层返回错误码，只要抛出，就能由真正有处理能力的上层接住。理解这条传播路径，是写出可维护程序的分水岭。",
          "很多新手把 try/except 当成防崩开关，包住一大段代码然后什么都不做。结果是缺陷被吞掉，问题延后到更难定位的地方才爆发。正确的思路刚好相反：只捕获你能处理的那一种，其余的统统放它上抛。",
          "资源释放是另一个独立议题。无论代码正常结束还是中途异常，文件、数据库连接都必须关闭。finally 能保证这一点，而 with 语句把「进入时获取、退出时释放」固定成模板，进一步降低了写漏的概率。",
        ],
        mechanism: [
          "异常对象携带类型与信息，沿调用栈逐层向上传。except 按书写顺序匹配类型，匹配成功就先执行该块再继续往下；一个异常只会被一个 except 处理。捕获后若不重新抛出，调用栈深处的事实就到此为止，上层再也看不到。",
          "try 语句的完整结构由四部分组成：try 是受保护代码，except 处理特定异常，else 只在 try 没有抛异常时执行（适合放成功之后的逻辑，避免被自己的 except 误捕），finally 无论成功失败都执行（适合释放资源）。",
          "raise ... from ... 会把原始异常挂在 __cause__ 上，traceback 会显示这个错误由哪个底层异常直接引发，排障时能一眼看到根因。如果在 except 里处理完仍想上抛，直接写一个不带参数的 raise 即可重新抛出当前异常。",
        ],
        example: {
          title: "区分可以恢复与必须暴露的错误",
          language: "python",
          code: "import json\nfrom pathlib import Path\n\n\nclass ConfigError(Exception):\n    \"\"\"配置文件存在但内容不合法。\"\"\"\n\n\ndef load_config(path: str) -> dict:\n    file = Path(path)\n    try:\n        text = file.read_text(encoding=\"utf-8\")\n    except FileNotFoundError:\n        return {}          # 文件不存在属于可恢复：给默认值\n\n    try:\n        return json.loads(text)\n    except json.JSONDecodeError as exc:\n        # 不吞掉原因：把原始异常挂上去，调用方能拿到行列信息\n        raise ConfigError(f\"配置格式错误: {path}\") from exc\n\n\nconfig = load_config(\"config.json\")\nprint(config.get(\"retries\", 3))",
          explanation:
            "这里把两类错误分开处理：文件不存在是预期内的情况，返回空字典让程序带默认值继续；JSON 语法错误说明文件内容坏了，吞掉它只会让问题在后面以更奇怪的方式出现，所以包装成自定义的 ConfigError 并抛出去。raise ... from exc 保留了原始的 JSONDecodeError，traceback 里能看到具体是第几行第几列出错。另外自定义异常继承 Exception 就够了，不要继承 BaseException。",
        },
        practiceSteps: [
          "搜索代码库里的裸 except 与 except Exception，逐个判断是否真的能处理，不能处理的删掉或改成具体类型。",
          "给 try 块补上 else 与 finally，把成功后的动作和必须释放的资源分开放。",
          "为模块定义一组最小自定义异常，并在 raise 时用 from 保留原始原因。",
        ],
        masteryChecklist: [
          "能说出 except、else、finally 各自的执行时机。",
          "能判断一处捕获是过宽、过窄，还是恰当。",
        ],
        summary: [
          "异常沿调用栈向上传播，只应被真正能处理它的那一层接住。",
          "捕捉具体类型；裸 except 会吞掉 KeyboardInterrupt 这类不该忽略的异常。",
          "else 只在没有异常时执行，finally 无论如何都执行。",
          "抛新异常时用 raise ... from ... 保留原始原因，否则根因会在 traceback 里消失。",
          "自定义异常继承 Exception，用来让调用方区分错误类别。",
        ],
        terms: [
          {
            term: "异常（Exception）",
            plain: "程序遇到做不下去的情况时抛出的对象，不靠返回值直接向上跳。",
            detail:
              "它比返回错误码更可靠：中间层即使不处理也会自动向上传递，不会被忘记检查。BaseException 是总根，KeyboardInterrupt 与 SystemExit 不属于 Exception，因此不该被普通错误处理接住。",
          },
          {
            term: "traceback",
            plain: "报错时打印的那一串调用路径，告诉你错误从哪一层冒出来。",
            detail:
              "从上往下是调用链，最后一行是真正的抛出点与异常类型，排查时应从最后一行往上看。如果捕获时用 raise NewError(...) 却没有写 from，原始 traceback 会被替换掉，根因就看不到了。",
          },
          {
            term: "finally",
            plain: "不管前面成功还是出错，都一定会执行的收尾代码。",
            detail:
              "常用于释放资源。注意即使 try 里有 return，finally 也会先执行；所以不要在 finally 里写 return，那会覆盖掉原来的返回值，让行为变得难以理解。",
          },
          {
            term: "链式异常（Exception Chaining）",
            plain: "抛出新错误时，把原来那个错误的来龙去脉一起带上。",
            detail:
              "写法是 raise NewError(...) from exc，原始异常会记录在 __cause__ 上。这样对外暴露的是业务语义清晰的错误类型，对内又保留了根因，是库代码的常见做法。",
          },
        ],
      },
    },
    questions: [
      {
        key: "python-sup-python-exceptions-s1",
        stageKey: "python-data-structures",
        topicKey: "python-exceptions",
        type: "single",
        stem: "在 except 块里把捕获到的异常包装成自定义异常再抛出，为什么通常要写 raise NewError(...) from exc？",
        options: [
          { key: "A", text: "这是语法要求，不写会报语法错误" },
          { key: "B", text: "保留原始异常作为原因，traceback 里能看到真正的出错点" },
          { key: "C", text: "可以自动把新异常降级成警告" },
          { key: "D", text: "能让程序不再终止" },
        ],
        answer: ["B"],
        explanation:
          "from exc 会把原始异常挂在 __cause__ 上，traceback 会同时显示新异常和它由哪个底层异常引发，排障时能直接定位到真正的根因，比如 JSON 的第几行出错。不写 from 也不是语法错误，但原始信息会丢失，或者被显示成处理此异常时又发生了另一个异常，语义混乱。它也不会改变错误的严重程度，或者阻止程序终止。",
        difficulty: "medium",
        tags: ["异常", "raise from", "调试"],
        sourceKey: "exercism-python",
        level: "进阶",
      },
      {
        key: "python-sup-python-exceptions-j1",
        stageKey: "python-data-structures",
        topicKey: "python-exceptions",
        type: "judge",
        stem: "把整段程序包在 try/except 里并忽略异常，可以让程序更健壮，避免崩溃。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "捕获所有异常后什么都不做，会把拼写错误、类型错误这类真正的缺陷一起吞掉，程序带着错误的中间状态继续运行，问题往往在更远的地方以更奇怪的形式爆发，排障成本反而更高。裸 except 还会捕获 KeyboardInterrupt 这类不该被忽略的异常。正确做法是只捕获明确知道如何处理的异常类型，无法处理的让它带原始信息上抛。",
        difficulty: "easy",
        tags: ["异常", "反模式"],
        sourceKey: "exercism-python",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "python",
    stageKey: "python-oop-typing",
    topic: {
      key: "python-dataclass",
      title: "dataclass 与数据模型",
      summary:
        "dataclass 用声明字段的方式自动生成初始化、比较和显示方法，把只装数据的类里成堆的样板代码删掉；代价是要理解默认值与可变字段的规则。",
      concepts: ["dataclass 装饰器", "frozen 不可变", "field 与 default_factory", "asdict 转换"],
      principles: [
        "dataclass 是在定义类时生成代码的工具：字段声明等价于生成 __init__、__repr__、__eq__。",
        "可变默认值必须用 field(default_factory=list)：直接写空列表会让所有实例共享同一个对象。",
        "frozen=True 让实例不可变、可哈希；默认的 dataclass 可变且不可哈希，不能直接当字典键。",
      ],
      applications: [
        "领域模型：订单、用户、任务这类字段固定、行为很少的记录对象。",
        "接口边界的数据转换：用 asdict 转成字典做序列化，用 frozen 做不可变的值对象。",
      ],
      pitfalls: [
        "直接给列表字段写默认值会报错（dataclass 禁止可变默认值），或误以为每个实例会各自得到一份。",
        "默认的 dataclass 不可哈希，直接放进 set 或当字典键会抛 TypeError，需要显式设置 frozen=True 或 eq=False。",
      ],
      method:
        "先判断这个类是不是只有字段没有行为：是就用 dataclass 声明字段；需要每个实例各自持有一份的可变集合用 default_factory；要求不可变与可哈希就加 frozen=True。",
      exercise:
        "用 dataclass 定义订单与订单明细，实现按金额排序、按用户分组统计，并确保明细列表不会在实例之间串用。",
      checkpoint:
        "能解释 default_factory 解决的是什么问题，以及 frozen=True 带来哪些能力与限制。",
      lesson: {
        overview: [
          "写 Python 类时，大量代码花在重复劳动上：__init__ 里逐个赋值、写 __repr__ 方便调试、写 __eq__ 让两个对象能比较。这些代码模式固定、容易写错，却和业务毫无关系。dataclass 就是把这段机械工作交给装饰器生成。",
          "但自动生成有个前提：字段的默认值必须有明确规则。可变对象（列表、字典）作为默认值会带来共享陷阱，因此 dataclass 直接禁止裸的可变默认值，要求改用 field(default_factory=...)。这是它把坑提前暴露给使用者的设计。",
          "另一个常被忽视的属性是可变性。默认的 dataclass 是可变对象，因此不可哈希、不能当字典键、放进集合会报错。要把它当值对象使用（做缓存键、放进集合、依赖内容相等的语义），就需要 frozen=True。",
        ],
        mechanism: [
          "@dataclass 在类定义时读取类型标注，按字段顺序生成 __init__、__repr__、__eq__ 等方法。字段的默认值写在赋值位置；没有默认值的字段必须排在有默认值的字段前面，否则会直接报错。",
          "默认值在类定义时只求值一次，并被绑定为类属性。若默认值是列表，所有实例会读到同一个列表——这正是需要 default_factory 的原因：它接收一个可调用对象，每次创建实例时调用一次，各自得到新对象。",
          "frozen=True 会在赋值时拦截属性写入，使实例不可变，同时基于字段生成 __hash__，于是实例可哈希。相对地，默认配置会定义按字段比较的 __eq__，而一旦定义了 __eq__，Python 就把 __hash__ 置空，避免出现内容变了却还留在哈希表里的对象。",
        ],
        example: {
          title: "订单模型：可变字段与不可变值对象",
          language: "python",
          code: "from dataclasses import dataclass, field, asdict\n\n\n@dataclass(frozen=True)\nclass OrderId:\n    value: str\n\n\n@dataclass\nclass OrderLine:\n    sku: str\n    price: float\n    qty: int = 1\n\n    def subtotal(self) -> float:\n        return self.price * self.qty\n\n\n@dataclass\nclass Order:\n    order_id: OrderId\n    user: str\n    # 可变字段必须用 default_factory，否则所有订单会共享同一个列表\n    lines: list[OrderLine] = field(default_factory=list)\n\n    def total(self) -> float:\n        return sum(line.subtotal() for line in self.lines)\n\n\no = Order(OrderId(\"A-1001\"), \"u1\")\no.lines.append(OrderLine(\"sku-1\", 19.9, 3))\nprint(o)                  # __repr__ 自动生成，调试时看得清字段\nprint(o.total())          # 59.699999999999996\n\n# frozen=True 的 OrderId 可哈希，能当字典键\ncache = {OrderId(\"A-1001\"): o.total()}\nprint(cache[OrderId(\"A-1001\")])\n\n# 需要字典时用 asdict 一次性展开\nprint(asdict(o)[\"user\"])  # u1",
          explanation:
            "OrderId 用 frozen=True 声明成值对象：内容相同即相等、可哈希、能当字典键，适合表达订单号这种不含行为的标识。Order 里的 lines 用 default_factory=list，保证每个订单实例拿到各自的新列表，而不是共享同一个。__repr__ 与 __eq__ 都由装饰器生成，所以 print 能看到完整字段，两个订单也能按字段比较。注意浮点数相加会出现 59.699999999999996，这是二进制浮点的固有现象；金额若要精确比较，应使用 decimal.Decimal 或按分为单位存整数。",
        },
        practiceSteps: [
          "找一个手写 __init__ 逐字段赋值的类，改写成 dataclass，确认打印与比较行为一致。",
          "检查所有 dataclass 里有没有裸的可变默认值，改成 field(default_factory=...)。",
          "把需要当字典键或放进集合的 dataclass 加上 frozen=True，并验证比较与哈希行为。",
        ],
        masteryChecklist: [
          "能解释 default_factory 与普通默认值的区别，以及为什么可变默认值是坑。",
          "能说出 frozen=True 带来的能力变化（可哈希、不可改）和相关限制。",
        ],
        summary: [
          "dataclass 替你生成 __init__、__repr__、__eq__，让数据类只声明字段。",
          "可变默认值必须用 field(default_factory=...)，否则实例之间会共享同一个对象。",
          "默认的 dataclass 可变、不可哈希；frozen=True 才可哈希、可当字典键。",
          "没有默认值的字段必须排在有默认值的字段前面。",
          "asdict 适合做序列化，但它是递归转换，遇到自定义类型仍需自行处理。",
        ],
        terms: [
          {
            term: "dataclass",
            plain: "给类加个装饰器，就不用手写初始化、打印和比较方法了。",
            detail:
              "写法是 @dataclass 加上带类型标注的字段。它只在类定义时生成代码，运行时没有额外开销，也不改变继承与普通方法的写法。",
          },
          {
            term: "default_factory",
            plain: "给字段指定一个每次新建实例时现造默认值的函数。",
            detail:
              "主要解决可变默认值被所有实例共享的问题，常用写法是 field(default_factory=list)。传的是函数（如 list、dict），不是调用结果——写成 field(default_factory=list()) 是常见错误。",
          },
          {
            term: "frozen=True",
            plain: "让这个类的实例不可改，内容相同就相等，还能当字典键。",
            detail:
              "适合值对象（金额、订单号、坐标）。代价是不能再用 obj.x = 1 赋值，需要修改时用 dataclasses.replace(obj, x=1) 生成新对象。注意它只拦住最外层属性的赋值，字段内部的列表仍可被修改。",
          },
          {
            term: "值对象（Value Object）",
            plain: "只按内容判断相不相等、不关心是哪个具体对象的数据。",
            detail:
              "比如两笔金额都是 100 元就应当相等。值对象应当是只读的，这样作为字典键才稳定；可变对象一旦内容改变，它在哈希表里的位置就失效了。",
          },
        ],
      },
    },
    questions: [
      {
        key: "python-sup-python-dataclass-s1",
        stageKey: "python-oop-typing",
        topicKey: "python-dataclass",
        type: "single",
        stem: "在 dataclass 里给一个列表字段设置默认值，正确写法是什么？",
        options: [
          { key: "A", text: "直接把字段默认值写成空列表 []" },
          { key: "B", text: "写成 field(default_factory=list)" },
          { key: "C", text: "把默认值写成 None，之后不再处理" },
          { key: "D", text: "写成 field(default_factory=list())" },
        ],
        answer: ["B"],
        explanation:
          "可变默认值在类定义时只求值一次并被绑定为类属性，直接写空列表会让所有实例共享同一个列表，一个实例 append 之后其他实例也看到了内容，dataclass 因此直接禁止裸可变默认值。default_factory 接收可调用对象，每次创建实例时调用一次，各自得到新列表。A 会直接报错；D 把调用结果传了进去，属于错误用法；C 只是把默认值设成 None，仍需在每个方法里处理 None 分支。",
        difficulty: "medium",
        tags: ["dataclass", "可变默认值"],
        sourceKey: "exercism-python",
        level: "进阶",
      },
      {
        key: "python-sup-python-dataclass-j1",
        stageKey: "python-oop-typing",
        topicKey: "python-dataclass",
        type: "judge",
        stem: "默认（没有设置 frozen=True）的 dataclass 实例可以直接放进 set 或作为字典的键。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "dataclass 默认会生成按字段比较的 __eq__，而一旦定义了 __eq__，Python 就把 __hash__ 置空，使实例不可哈希，放进 set 或当字典键会抛 TypeError。这是刻意设计：可变对象的内容改变后哈希值也会变，会让它从哈希表里消失。要让实例可哈希，可以设置 frozen=True（同时获得不可变语义），或显式设置 eq=False 使用继承自 object 的默认哈希。",
        difficulty: "hard",
        tags: ["dataclass", "哈希", "类型系统"],
        sourceKey: "algorithms-python",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "python",
    stageKey: "python-data-project",
    topic: {
      key: "python-numpy-basics",
      title: "NumPy 数组与向量化",
      summary:
        "NumPy 把一列数字存成连续的定长数组，整段数据一次算完，而不是在 Python 里一个个循环。它是 Pandas 的底座，也是数据分析提速的第一步。",
      concepts: ["ndarray 与 dtype", "形状 shape", "向量化运算", "广播"],
      principles: [
        "ndarray 是同类型、定长的连续内存块，运算时不必逐个解释 Python 对象的类型，速度远高于列表循环。",
        "向量化写法（数组乘 2）作用于整段数据，语义上是逐元素，但执行发生在编译好的底层循环里。",
        "广播让不同形状的数组按规则自动对齐后再运算，形状不兼容时会报错而不是静默出错。",
      ],
      applications: [
        "对整列数值做统一变换（单位换算、标准化、裁剪到指定区间）。",
        "用布尔掩码做条件筛选与替换，替代多次遍历。",
      ],
      pitfalls: [
        "整数数组做除法会截断：dtype 为 int 时 1 除以 2 的结果是 0.0，数值计算前要先把 dtype 转成浮点。",
        "把切片得到的视图当成副本：修改视图会连带改动原数组，需要独立数据时要显式调用 copy。",
      ],
      method:
        "先确认 dtype 与 shape，再用布尔掩码或向量化表达式替换循环；需要保留原数据时先复制一份。",
      exercise:
        "读入一列销售额，用 NumPy 完成单位换算、异常值裁剪与分位数统计，并和纯 Python 循环版本对比耗时。",
      checkpoint: "能解释视图与副本的区别，并说明广播为什么要求形状兼容。",
      lesson: {
        overview: [
          "在纯 Python 里处理一万个数字，你写的是 for 循环，每次迭代都要做类型解释、属性查找和函数调用。NumPy 换了一条路：把数字按同一种类型紧密排在一块内存里，循环交给底层编译好的代码执行。同样一件事，写法更短，速度往往快得多。",
          "这就是向量化的含义——不是没有循环，而是循环不再由 Python 逐次驱动。你写下的数组乘 2 在语义上仍是逐元素相乘，但驱动这件事的成本从 Python 解释器转移到了编译代码上。",
          "代价是约束：数组必须同类型、长度固定，形状还必须互相对得上。理解 dtype 与 shape 这两个概念，几乎就理解了 NumPy 一半的报错信息，也能解释为什么同样的计算换成列表就慢下来。",
        ],
        mechanism: [
          "ndarray 由三部分描述：一块连续内存、一个 dtype（每个元素占多少字节、怎么解释）、一个 shape（各维度长度）。同类型定长使得按下标定位只需做偏移量计算，这是它快于列表的根本原因。",
          "向量化运算按元素进行：两边形状相同就一一对应；形状不同则尝试广播——从最右侧维度开始对齐，把长度为 1 的维度拉伸到对方的长度。无法对齐时直接抛形状错误，而不是猜你的意图。",
          "很多切片操作返回的是视图而非副本：它不复制数据，只是换了个看内存的方式。因此对视图赋值会改变原数组。需要独立数据时用 copy 明确复制，这也是排查「明明没动原数组」这类问题的关键线索。",
        ],
        example: {
          title: "从列表循环到向量化：单位换算与异常值裁剪",
          language: "python",
          code: "import numpy as np\n\nraw = [12.5, 3.0, 9999.0, 48.2, 7.5]\narr = np.array(raw, dtype=np.float64)\nprint(arr.shape, arr.dtype)   # (5,) float64\n\n# 1) 向量化变换：整段数据一次乘同一个系数\nyuan = arr * 7.2\n\n# 2) 布尔掩码：条件筛选与替换都不需要写循环\ntoo_big = yuan > 10000\nprint(yuan[too_big])          # 超出阈值的元素\nclipped = np.where(too_big, 10000.0, yuan)\n\n# 3) 统计量直接作用在整段数据上\nprint(np.median(clipped), clipped.max())\n\n# 4) 视图与副本：切片默认是视图\nsub = clipped[0:3]            # 视图，改它会改到 clipped\nsub[0] = 0.0\nprint(clipped[0])             # 0.0，原数组被改了\nsafe = clipped[0:3].copy()    # 副本，独立数据\nsafe[0] = -1.0\nprint(clipped[0])             # 仍然是 0.0",
          explanation:
            "dtype=np.float64 让数组一开始就是浮点，避免整数除法截断。数组乘系数与大于比较都是整段运算，没有 Python 层的循环。np.where 用掩码一次性完成「满足条件取新值、否则保留原值」。最后一段演示视图与副本的区别：切片得到的是视图，对它的赋值会写回原数组；需要独立数据必须调用 copy。这也是数据分析里「我明明只改了子集，原始数据却变了」的最常见原因。",
        },
        practiceSteps: [
          "把一段对列表做逐元素数学运算的循环改写成 NumPy 向量化表达式，比较结果与耗时。",
          "用布尔掩码完成一次条件筛选和一次条件替换，确认没有出现 Python 层循环。",
          "故意对一个切片赋值，观察原数组是否被改动；再用 copy 重做一遍，确认差异。",
        ],
        masteryChecklist: [
          "能读出一个数组的 shape 与 dtype，并说明它们如何影响运算结果。",
          "能解释视图与副本的区别，并知道什么时候必须复制。",
        ],
        summary: [
          "ndarray 是同类型、定长的连续内存，快在不用逐个解释 Python 对象。",
          "向量化不是没有循环，而是循环交给编译好的底层代码。",
          "广播从最右侧维度对齐，把长度为 1 的维度拉伸；无法对齐就报错。",
          "切片常是视图，改视图会改原数组；要独立数据就显式复制。",
          "整数 dtype 的除法会截断，数值计算前先确认 dtype。",
        ],
        terms: [
          {
            term: "ndarray",
            plain: "NumPy 的多维数字数组，所有元素是同一种类型。",
            detail:
              "它比列表多两个关键属性：dtype 决定每个元素怎么存，shape 决定每个维度有多长。绝大多数 NumPy 报错都能从这两个属性找到线索。",
          },
          {
            term: "向量化（Vectorization）",
            plain: "写一行对整段数据生效的运算，而不是自己写循环。",
            detail:
              "例如数组乘 2。底层仍然逐元素计算，但循环由编译代码执行，省掉了 Python 层每次迭代的开销，这也是它比 for 循环快的主要原因。",
          },
          {
            term: "广播（Broadcasting）",
            plain: "形状不同的两个数组，按规则自动对齐后一起运算。",
            detail:
              "规则是从最后一个维度往前对齐，长度相等或其中一个是 1 才兼容；长度为 1 的维度会被拉伸。不兼容时直接报错——这是好事，避免了你以为在对齐、实际错位的情况。",
          },
          {
            term: "dtype",
            plain: "数组里每个元素是什么类型、占多少字节。",
            detail:
              "常见有 int64、float64、bool。dtype 决定精度与溢出行为：整数除法会截断，整数溢出会环绕。做统计前先确认 dtype，必要时用 astype 转换。",
          },
          {
            term: "视图（View）",
            plain: "不复制数据，只是换个方式看同一块内存的对象。",
            detail:
              "基础切片通常返回视图，因此对它赋值会影响原数组。要独立数据就调用 copy。判断不准时可以用 np.shares_memory 检查两个数组是否共享内存。",
          },
        ],
      },
    },
    questions: [
      {
        key: "python-sup-python-numpy-basics-s1",
        stageKey: "python-data-project",
        topicKey: "python-numpy-basics",
        type: "single",
        stem: "为什么要用 NumPy 数组代替 Python 列表做大规模数值计算？",
        options: [
          { key: "A", text: "NumPy 数组可以混装任意类型的元素，比列表更灵活" },
          { key: "B", text: "NumPy 数组是同类型连续内存，运算由底层编译代码执行，省掉 Python 层逐元素循环的开销" },
          { key: "C", text: "NumPy 会自动帮你校验业务逻辑" },
          { key: "D", text: "NumPy 数组不需要考虑形状" },
        ],
        answer: ["B"],
        explanation:
          "ndarray 的元素类型统一、内存连续，因此定位元素只需偏移量计算，整段运算可以由底层编译好的循环执行，不必每个元素都走一遍 Python 解释器，这是速度差距的来源。A 说反了：数组要求同类型（这正是它快的前提），列表才能混装类型。C 与事实无关，NumPy 不校验业务逻辑。D 也相反，NumPy 对形状的要求比列表严格得多。",
        difficulty: "easy",
        tags: ["NumPy", "向量化", "性能"],
        sourceKey: "ms-data-science",
        level: "入门",
      },
      {
        key: "python-sup-python-numpy-basics-j1",
        stageKey: "python-data-project",
        topicKey: "python-numpy-basics",
        type: "judge",
        stem: "对 NumPy 数组做基础切片得到的通常是视图，修改这个切片的内容会改变原数组。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "基础切片不复制数据，只生成一个指向同一块内存的新视图，因此对切片赋值会写回原数组，这也是「我只改了子集，原始数据却变了」这类问题的根源。需要独立数据时应显式调用 copy；如果只是不确定，可以用 np.shares_memory 检查两者是否共享内存。注意用数组下标做花式索引得到的是副本，行为与切片不同。",
        difficulty: "medium",
        tags: ["NumPy", "视图", "副本"],
        sourceKey: "ms-data-science",
        level: "进阶",
      },
    ],
  },
];
