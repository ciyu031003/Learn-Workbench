/**
 * Python 开发 · 知识点扩容 B（追加式扩容，2026-10-17）。
 *
 * 口径与 topic-expansion-backend-engineering.ts 一致：每条 expansion = 1 个知识点 + 它的 2 道配套题。
 * 全部 topic.key 以 python- 前缀追加，且不与 python.ts、topic-expansion-python.ts 既有 key 重复。
 * 术语必须配人话解释（terms.plain），小结要能合上书复述。
 */
import type { TopicExpansion } from "./topic-expansions";

export const pythonTopicExpansionsB: TopicExpansion[] = [
  {
    trackSlug: "python",
    stageKey: "python-foundation",
    topic: {
      key: "python-numbers-precision",
      title: "整数、浮点数与取整方向",
      summary: "int 是任意精度整数，float 是二进制近似值。// 向下取整、% 的符号跟随除数、0.1 + 0.2 不等于 0.3，这三件事决定了数值代码的正确性。",
      concepts: [
        "int 与 float 的表示差异",
        "// 与 % 的取整方向",
        "二进制浮点误差",
        "Decimal 与舍入模式"
      ],
      principles: [
        "/ 永远返回 float，只有 // 保留整数并向下取整（向负无穷方向），不是向零截断。",
        "余数满足 a == (a // b) * b + a % b，所以 % 的符号跟着除数走，而不是跟着被除数。",
        "float 用二进制近似十进制小数，0.1 + 0.2 == 0.3 为假；金额必须用 Decimal 从字符串构造。"
      ],
      applications: [
        "金额、税费、折扣的精确计算与展示：Decimal 配合 quantize 指定舍入模式。",
        "分页、分桶、按周对齐时处理负数，用 // 与 % 保证边界不差一格。"
      ],
      pitfalls: [
        "用 == 比较两个浮点结果，或把浮点计算结果直接当作 0 判断。",
        "用 int(a / b) 代替 a // b 处理负数：截断与向下取整差一格，页码会整体错位。"
      ],
      method: "先判断这个数需不需要精确：测量统计用 float，金额与计数用 int 或 Decimal；取整语义用 // 与 % 表达，不要用截断函数凑。",
      exercise: "写一个分页函数：给定总数和每页条数，返回总页数；再写一个金额汇总函数，用 Decimal 计算并保留两位小数。",
      checkpoint: "能说出 -7 // 2 与 -7 % 2 的结果并解释方向，能说明为什么金额不能用 float 判断相等。",
      lesson: {
        overview: [
          "数值是 Python 里最安静的一课：几乎所有教程都在演示加减乘除，却很少提醒你 int 和 float 的差别。int 是任意精度整数，有多大就能表示多大；float 是 64 位二进制浮点数，只有约 15 到 17 位十进制有效数字。只要涉及金额、比例、坐标或科学计数，选错类型就会在某一刻突然冒出 0.30000000000000004 这样的尾巴。",
          "整除和取模是第二个容易想当然的地方。Python 的 // 取的是向下取整（floor），不是向零截断：-7 // 2 得到 -4 而不是 -3。余数跟着除数的符号走，所以 -7 % 2 是 1，而不是 -1。分页、分桶、按周对齐这类计算里，只要数据可能出现负数，就必须先确认这个方向，否则边界会整体错一格。",
          "金额场景要换一套工具：decimal.Decimal 用十进制表示，能精确表示 0.1；再配合 quantize 指定舍入模式，账目才能对得上。float 只适合做测量和统计，不适合做必须分毫不差的结算。判断两个浮点结果是否相等时，用 math.isclose 而不是 ==。"
        ],
        mechanism: [
          "int 在 CPython 里是任意精度的：内部按 30 位一组存数字，需要就继续扩组，所以不会像 C 的 int 那样溢出。这也是大整数运算比定长整数慢的原因：位数越多，参与的组越多。",
          "float 遵循 IEEE 754 双精度：1 位符号、11 位指数、52 位尾数。像 0.1 这样的十进制小数在二进制里是无限循环小数，只能存成最接近的近似值；两个近似值相加，误差会累积并显形，于是 0.1 + 0.2 得到 0.30000000000000004。",
          "// 与 % 的关系由恒等式 a == (a // b) * b + a % b 保证。配合 floor 的定义就能推出余数符号：b 为正时余数非负，b 为负时余数非正。所以 -7 // 2 是 -4、-7 % 2 是 1，两者加起来正好还原 -7。",
          "round() 用的是半偶舍入：恰好落在中间时取偶数，所以 round(2.5) 是 2、round(3.5) 是 4。而且它作用在已经存下来的二进制近似值上，round(2.675, 2) 得到 2.67，是因为 2.675 实际存得略小于 2.675。要按人的习惯四舍五入，用 Decimal 配合 ROUND_HALF_UP。"
        ],
        example: {
          title: "金额用 Decimal、取整用 //：把数值语义写对",
          language: "python",
          code: "from decimal import Decimal, ROUND_HALF_UP\nimport math\n\n# 1) 浮点误差：不要用 == 判断两个计算结果相同\nprint(0.1 + 0.2)                      # 0.30000000000000004\nprint(0.1 + 0.2 == 0.3)               # False\nprint(math.isclose(0.1 + 0.2, 0.3))   # True\n\n# 2) 金额用 Decimal，并且从字符串构造\nprice = Decimal(\"19.99\")\ntotal = price * 3\nprint(total)                                                      # 59.97\nprint(total.quantize(Decimal(\"0.01\"), rounding=ROUND_HALF_UP))    # 59.97\n\n# 3) 整除与取模：向下取整，余数符号跟随除数\na, b = -7, 2\nprint(a // b, a % b)     # -4 1\nprint(int(a / b))        # -3，截断，语义不同\n\n# 4) round 是半偶舍入，不是四舍五入\nprint(round(2.5), round(3.5), round(2.675, 2))   # 2 4 2.67",
          explanation: "Decimal 必须从字符串构造：直接写 Decimal(0.1) 会把二进制的近似值原样带进来，等于没换类型。quantize(Decimal('0.01')) 把结果收敛到分，ROUND_HALF_UP 才是日常说的四舍五入。第三段演示负数下的方向：分页公式若写成 int(a / b)，-7 条记录会被算成 -3 条，而 // 给出 -4，与余数 1 一起才能还原原值。第四段提醒 round 的两层反直觉：半偶舍入，加上作用在二进制近似值上。"
        },
        practiceSteps: [
          "在解释器里依次执行 0.1 + 0.2、0.1 + 0.2 == 0.3、math.isclose(0.1 + 0.2, 0.3)，比较三行结果。",
          "把一段用 float 算金额的代码改成 Decimal：字面量用字符串构造，最后统一 quantize 到分。",
          "用 -7、-1、0、1、7 分别做被除数，打印 // 与 %，总结余数符号与除数的关系。"
        ],
        masteryChecklist: [
          "能不看资料说出 -7 // 2 与 -7 % 2 的结果，并解释为什么是这个方向。",
          "能说清 0.1 + 0.2 为什么不等于 0.3，以及两种正确的比较方式。"
        ],
        summary: [
          "int 是任意精度整数；float 是 64 位二进制浮点，只有约 15 到 17 位十进制有效数字。",
          "// 向下取整，% 的符号跟随除数，两者满足 a == (a // b) * b + a % b。",
          "十进制小数在二进制里存不准，比较浮点结果要用 math.isclose。",
          "金额用 Decimal 从字符串构造，配 quantize 与 ROUND_HALF_UP。",
          "round() 是半偶舍入，且作用在二进制近似值上，不要拿它做金额舍入。"
        ],
        terms: [
          {
            term: "浮点数（Float）",
            plain: "带小数点的数字，用二进制近似存储，不是精确值。",
            detail: "float 只能精确表示分母为 2 的幂的分数，0.1、0.2 这类十进制小数都是近似。它适合测量与统计，不适合金额结算，也不该直接用 == 比较。"
          },
          {
            term: "向下取整（Floor）",
            plain: "往数轴上更小的方向取最近的整数，-3.5 变成 -4。",
            detail: "Python 的 // 就是 floor，与 C 语言的整数除法（向零截断）不同。正数时两者结果一样，所以很多人在负数上才发现差别。"
          },
          {
            term: "十进制类型（Decimal）",
            plain: "按十进制精确存储的小数，适合算钱。",
            detail: "构造时必须用字符串，Decimal('0.1') 才是准确的 0.1，Decimal(0.1) 会带上浮点误差。它比 float 慢，所以只用在需要精确的场合。"
          },
          {
            term: "半偶舍入（Banker's Rounding）",
            plain: "正好卡在中间时，舍入到最近的偶数。",
            detail: "这是 Python round() 的规则，也是 IEEE 754 的默认。它的好处是大量舍入时误差不偏向一边；代价是与日常说的四舍五入不同，2.5 舍成 2。"
          }
        ]
      }
    },
    questions: [
      {
        key: "python-exp-python-numbers-precision-s1",
        stageKey: "python-foundation",
        topicKey: "python-numbers-precision",
        type: "single",
        stem: "表达式 -7 // 2 和 -7 % 2 的结果分别是？",
        options: [
          {
            key: "A",
            text: "-4 和 1"
          },
          {
            key: "B",
            text: "-3 和 -1"
          },
          {
            key: "C",
            text: "-3.5 和 -0.5"
          },
          {
            key: "D",
            text: "3 和 1"
          }
        ],
        answer: [
          "A"
        ],
        explanation: "Python 的 // 是向下取整，向数轴更小的方向取，所以 -7 // 2 是 -4，而不是向零截断得到的 -3。余数由恒等式 a == (a // b) * b + a % b 决定：-7 = (-4) * 2 + 1，因此 -7 % 2 是 1，符号与除数一致。B 是把 // 当成截断、把 % 的符号当成跟随被除数的直觉结果，这正是最常见的误解。",
        difficulty: "medium",
        tags: [
          "数值",
          "取整",
          "取模"
        ],
        sourceKey: "exercism-python",
        level: "进阶"
      },
      {
        key: "python-exp-python-numbers-precision-j1",
        stageKey: "python-foundation",
        topicKey: "python-numbers-precision",
        type: "judge",
        stem: "在 Python 中，round(2.5) 的返回值是 3。",
        options: [
          {
            key: "A",
            text: "正确"
          },
          {
            key: "B",
            text: "错误"
          }
        ],
        answer: [
          "B"
        ],
        explanation: "round() 采用半偶舍入：恰好落在两个整数中间时，舍入到偶数一侧，所以 round(2.5) 是 2、round(3.5) 是 4。它不是四舍五入，而且作用在二进制近似值上，round(2.675, 2) 会得到 2.67。金额要按四舍五入处理，应使用 Decimal 配合 ROUND_HALF_UP 明确指定舍入模式。",
        difficulty: "medium",
        tags: [
          "round",
          "舍入",
          "数值"
        ],
        sourceKey: "exercism-python",
        level: "进阶"
      }
    ]
  },
  {
    trackSlug: "python",
    stageKey: "python-foundation",
    topic: {
      key: "python-truthiness-compare",
      title: "真值判断与 == / is",
      summary: "if 会先把对象转成真假：None、0、空字符串、空容器都是假。== 比的是值，is 比的是身份；and/or 短路并返回操作数本身。",
      concepts: [
        "真值测试（truthiness）",
        "== 与 is",
        "短路求值",
        "链式比较"
      ],
      principles: [
        "if/while/and/or 都按真值判断：None、False、0、空字符串与空容器为假，其余为真。",
        "== 比较值是否相等，is 比较是不是同一个对象；判断 None 应该用 is None。",
        "and/or 返回的是操作数本身而不是布尔值，并且短路：左边已能决定结果时右边不求值。"
      ],
      applications: [
        "用 if not items 同时覆盖 None 与空列表，写判空时少一层分支。",
        "用 x is None 区分没有传参和传了 0 或空字符串，避免把合法值当成缺失。"
      ],
      pitfalls: [
        "用 if value 判断缺失，把合法的 0、空字符串、空列表一并当成没值。",
        "用 is 比较整数或字符串的值：小整数缓存与字符串驻留让它偶尔为真，换环境就失效。"
      ],
      method: "先问这个判断要区分的是有没有值还是值是多少：只关心有没有，用 is None；关心具体内容，用 == 或真值判断，并把 0 和空串当合法数据。",
      exercise: "写一个成绩单打印函数：0 分要显示 0 分，缺失要显示未提交；再写一段用 and/or 提供默认值的配置读取代码。",
      checkpoint: "能说明 if not value 与 if value is None 的区别，并解释 is 为什么不能比较数值。",
      lesson: {
        overview: [
          "if 后面可以跟任何对象，Python 会先把它转成真假再决定走哪条分支。None、False、数值 0、空字符串、空列表、空字典、空集合都被视为假，其余为真。这个设计让判空可以写成 if not items，比 len(items) == 0 更短，也顺带覆盖了 None 的情况。",
          "但更短不等于更准确。当 0 或空字符串本身是合法数据时，把 if value 当成没传值，会把真实的 0 当成缺失。需要区分没有值和值是零时，必须显式写 value is None。这是新手代码里最常见的一类静默错误，它不报错，只是悄悄算错。",
          "另一组常被混用的是 == 和 is。== 比较值，is 比较是不是同一个对象。两个空列表 == 为真但 is 为假；None 在进程里只有一个实例，所以判断有没有值用 is None 既准确又快。理解两者的判据不同，才能解释为什么有些代码在本地对、在别处错。"
        ],
        mechanism: [
          "bool(x) 的判断顺序是：先找 __bool__，没有再找 __len__，两个都没有就当 True。所以自定义类可以实现 __bool__ 来表达空；而 numpy 数组的 __bool__ 在多元素时直接抛异常，因为真值本身有歧义。",
          "is 比较的是 id()，也就是对象在内存里的身份。CPython 会缓存 -5 到 256 的小整数，短字符串也可能被驻留复用，于是 a is b 偶尔为真。这属于实现细节，不能作为比较值的依据。",
          "and 与 or 是短路求值：and 先算左边，若为假直接返回左操作数；or 若左边为真直接返回它。返回值是操作数本身，不是布尔值，所以 name = user or '匿名' 能直接当默认值用。",
          "链式比较 0 < x < 10 等价于 0 < x and x < 10，但 x 只求值一次。这既省一次调用，也避免了 x 是函数调用时两次结果不一致。条件表达式 a if cond else b 也用同一套真值规则。"
        ],
        example: {
          title: "区分缺失和零：is None 与真值判断的分工",
          language: "python",
          code: "records = [\n    {\"name\": \"A\", \"score\": 0},\n    {\"name\": \"B\", \"score\": None},\n]\n\ndef describe(rec):\n    score = rec.get(\"score\")\n    if score is None:              # 只有 None 表示未提交，0 分是合法成绩\n        return f'{rec[\"name\"]}: 未提交'\n    return f'{rec[\"name\"]}: {score} 分'\n\nfor rec in records:\n    print(describe(rec))\n\n# == 比值，is 比身份：两个空列表内容相同，但不是同一个对象\nleft, right = [], []\nprint(left == right, left is right)     # True False\n\n# None 是单例，用 is 判断最准确\nnone_a = none_b = None\nprint(none_a is none_b)                 # True\n\n# and/or 返回操作数本身，并短路\nuser = {\"name\": \"A\", \"active\": False}\nlabel = (user and user.get(\"name\")) or \"匿名\"\nprint(label)                            # A\nprint(False and 1 / 0)                  # False，右边不会求值",
          explanation: "describe 用 is None 而不是 if not score：0 分是真实成绩，写成 if not score 会把 A 误判成未提交。f-string 外层用单引号，内部才能安全地写双引号取值。第二段对比 == 与 is：两个空列表的值相等，但对象不同。第三段说明 None 是单例，身份比较等于值比较。最后两行演示 or 的默认值惯用法，以及 and 的短路：右边是 1 / 0 也不会执行，所以不会抛 ZeroDivisionError。"
        },
        practiceSteps: [
          "在解释器里对 None、0、0.0、空字符串、空列表、空字典、空集合、字符串 '0' 依次调用 bool()，把它们分成真假两组。",
          "找一个用 if value 判空的函数，问自己 0 或空字符串是不是合法取值，需要区分就改成 is None。",
          "写两行代码分别用 == 和 is 比较两个内容相同的列表，观察结果差异并解释原因。"
        ],
        masteryChecklist: [
          "能列出至少五种假值，并说明自定义类怎么控制自己的真值。",
          "能解释 is 为什么不能用来比较数值或字符串。"
        ],
        summary: [
          "None、False、0、空字符串、空容器都是假值，其余对象默认为真。",
          "if value 会把 0 和空字符串当成缺失；要区分没值和值为零，写 value is None。",
          "== 比值，is 比身份；只有 None 这类单例才推荐用 is。",
          "and/or 短路并返回操作数本身，可以直接当默认值用。"
        ],
        terms: [
          {
            term: "真值（Truthiness）",
            plain: "一个对象在 if 里会被当成真还是假。",
            detail: "Python 用 bool() 决定：先看 __bool__，再看 __len__，都没有就当真。所以空容器为假、自定义对象默认恒真。"
          },
          {
            term: "标识（Identity）",
            plain: "两个名字是不是指向内存里的同一个对象。",
            detail: "is 比较的是 id()，与内容无关。它只适合判断单例（None、True、False）；比较值请用 ==，否则会被小整数缓存之类的实现细节误导。"
          },
          {
            term: "短路求值（Short-circuit）",
            plain: "左边已经能定结果，右边就不算了。",
            detail: "and 遇到假值立即返回它，or 遇到真值立即返回它。这个特性既能做默认值，也能用来保护危险操作，例如 if user and user.name。"
          },
          {
            term: "驻留（Interning）",
            plain: "解释器复用同一个字符串或小整数对象，省内存。",
            detail: "属于 CPython 的实现优化：-5 到 256 的整数、部分短字符串会被复用。所以 a is b 有时为真，这不能当作语言保证。"
          }
        ]
      }
    },
    questions: [
      {
        key: "python-exp-python-truthiness-compare-s1",
        stageKey: "python-foundation",
        topicKey: "python-truthiness-compare",
        type: "single",
        stem: "参数 value 可能是 None（没传），也可能是 0 或空字符串这类合法取值。要判断它是否没传，哪种写法正确？",
        options: [
          {
            key: "A",
            text: "if not value:"
          },
          {
            key: "B",
            text: "if value is None:"
          },
          {
            key: "C",
            text: "if value is 0 or value is '':"
          },
          {
            key: "D",
            text: "if value is not True:"
          }
        ],
        answer: [
          "B"
        ],
        explanation: "if not value 会把 0、空字符串、空列表一并当成假，于是合法的 0 被误判成没传参；value is None 只认 None 这一个对象，身份比较不经过 __eq__，不会被自定义相等逻辑干扰。C 漏掉了 None 的情况，D 也会放过 0 和空字符串。要区分没有值和值是零，只有显式比较 None 才准确。",
        difficulty: "medium",
        tags: [
          "真值",
          "None",
          "判空"
        ],
        sourceKey: "exercism-python",
        level: "进阶"
      },
      {
        key: "python-exp-python-truthiness-compare-j1",
        stageKey: "python-foundation",
        topicKey: "python-truthiness-compare",
        type: "judge",
        stem: "在 Python 中，and 与 or 的返回值一定是 True 或 False。",
        options: [
          {
            key: "A",
            text: "正确"
          },
          {
            key: "B",
            text: "错误"
          }
        ],
        answer: [
          "B"
        ],
        explanation: "and 与 or 采用短路求值，返回的是操作数本身而不是布尔值：1 and 2 返回 2，'' or 'default' 返回 'default'，None or 0 返回 0。这正是不用写 if 三元也能给默认值的原因。只有套了 bool()，或者仅用于 if 条件时，你看到的才是真假。",
        difficulty: "easy",
        tags: [
          "布尔",
          "短路求值"
        ],
        sourceKey: "exercism-python",
        level: "入门"
      }
    ]
  },
  {
    trackSlug: "python",
    stageKey: "python-data-structures",
    topic: {
      key: "python-modules-import",
      title: "模块、包与导入机制",
      summary: "import 会执行模块顶层代码一次并缓存进 sys.modules；脚本运行时脚本目录排在 sys.path 第一位，所以起名和运行方式会直接决定导入成败。",
      concepts: [
        "模块与包",
        "sys.path 查找顺序",
        "sys.modules 缓存",
        "__main__ 入口守卫"
      ],
      principles: [
        "import 执行模块顶层代码一次，结果以模块名为键缓存在 sys.modules，后续导入复用同一个对象。",
        "导入查找先内置模块、再按 sys.path 依次搜索；脚本运行时 sys.path 首位是脚本所在目录。",
        "from m import x 在导入那一刻绑定值；之后 m.x 被重新赋值，本地 x 不会跟着变。"
      ],
      applications: [
        "把单文件脚本拆成 config、service、main 三个模块，用 python -m 从项目根运行。",
        "给库代码补 if __name__ == '__main__' 守卫，让它可以被安全导入。"
      ],
      pitfalls: [
        "把可执行代码写在模块顶层，一被 import 就打印、连数据库、启动服务。",
        "给文件起名 random.py 或 json.py，脚本目录排在搜索路径首位，直接遮蔽标准库。"
      ],
      method: "先规划包的边界，再用绝对导入；入口统一写守卫，运行统一用 python -m；遇到导入失败先打印 sys.path 看它在找哪里。",
      exercise: "把一段单文件脚本拆成包，补上 __init__.py 与 __main__ 守卫，并让它在项目根目录用 python -m 正常启动。",
      checkpoint: "能解释 python app/main.py 与 python -m app.main 的导入结果为什么不同，并能说出循环导入的两种解法。",
      lesson: {
        overview: [
          "一个 .py 文件就是一个模块；一个带 __init__.py 的目录就是一个常规包。把代码拆成模块的目的不只是文件别太长，而是让每个文件有清楚的职责边界：谁能导入谁、初始化在什么时候发生、入口在哪里。这些边界一旦模糊，项目就会退化成互相导入的一团。",
          "import 不是把文件内容复制进来，而是让解释器找到模块、执行一次它的顶层代码、把得到的模块对象放进 sys.modules 缓存。理解这一点，就能解释为什么模块顶层的 print 只出现一次、为什么改了模块文件后同一次运行看不到变化、为什么循环导入会报某个属性不存在。",
          "导入路径的查找顺序决定了很多在我机器上能跑的问题。内置模块优先，然后按 sys.path 依次找；直接运行脚本时，脚本所在目录排在第一位。于是给文件起名 random.py、json.py 会遮蔽标准库，而用 python app/main.py 运行又会让项目根不在搜索路径里，包导入随之失败。"
        ],
        mechanism: [
          "导入分两步：先找模块（内置模块、已安装的包、sys.path 里的目录），再执行它。执行结果以模块名为键存进 sys.modules；之后再导入同一个名字时直接取缓存，不会重复执行，也不会重新读文件。",
          "sys.path 的第一项含义取决于启动方式：python script.py 时是脚本所在目录，python -m pkg.mod 时是当前工作目录，交互式环境里是空字符串。这就是同一个包直接跑脚本失败、用 -m 跑成功的根因。",
          "from m import x 会在导入那一刻把 m.x 的当前值绑定到本地名字上。之后即使改了 m.x，本地 x 也不会跟着变；而先 import m 再访问 m.x，拿到的总是最新值。两种写法语义不同，改配置时要留意。",
          "循环导入时，A 导入 B、B 又导入 A：B 拿到的是尚未执行完的 A 模块对象，里面可能还没有定义需要的属性，于是抛 ImportError 或 AttributeError。常见解法是把导入移到函数内部，或把共享部分抽到第三个模块。"
        ],
        example: {
          title: "包内绝对导入与入口守卫",
          language: "python",
          code: "# 目录结构\n# project/\n#   app/__init__.py\n#   app/config.py\n#   app/main.py\n# 运行方式：cd project && python -m app.main\n\n# app/config.py\nDEFAULT_TIMEOUT = 5\n\ndef load_settings():\n    return {\"timeout\": DEFAULT_TIMEOUT}\n\n# app/main.py\nfrom app.config import load_settings\n\ndef main():\n    settings = load_settings()\n    print(f'超时: {settings[\"timeout\"]} 秒')\n\nif __name__ == \"__main__\":      # 只有直接运行才执行，被 import 时跳过\n    main()",
          explanation: "包内导入统一写绝对导入 app.config，前提是项目根目录在 sys.path 上；python -m app.main 会把当前工作目录放进去，所以要在 project 目录下执行。改成直接写 python app/main.py，sys.path 第一位就变成 app 目录，解释器找不到名为 app 的包，直接报 ModuleNotFoundError。守卫把被导入和被运行分开：被 import 时 __name__ 是模块名，main() 不会执行，因此这个文件可以安全地被测试或别的模块引用。"
        },
        practiceSteps: [
          "把一段单文件脚本拆成 config.py、service.py、main.py，用 python -m 的方式从项目根目录运行。",
          "在 main.py 里打印 sys.path 的前三项，分别用 python main.py 和 python -m 方式运行，对比差异。",
          "给模块加 if __name__ == '__main__' 守卫，再从另一个文件 import 它，确认顶层副作用不再发生。"
        ],
        masteryChecklist: [
          "能解释 import m 与 from m import x 在名字绑定上的区别。",
          "能说出脚本运行时 sys.path 第一项是什么，以及它带来的两个常见问题。"
        ],
        summary: [
          ".py 是模块，带 __init__.py 的目录是包；包内导入优先用绝对导入。",
          "import 会执行模块顶层代码一次，结果缓存在 sys.modules。",
          "脚本运行时 sys.path 第一位是脚本目录，容易遮蔽标准库或找不到包。",
          "用 if __name__ == '__main__' 把入口和可导入模块分开。",
          "循环导入的常见解法：把导入移进函数，或抽出公共模块。"
        ],
        terms: [
          {
            term: "模块（Module）",
            plain: "一个 .py 文件，里面是变量、函数和类。",
            detail: "模块名就是文件名去掉后缀。它既是代码组织单位，也是命名空间：不同模块里可以有同名函数，互不冲突。"
          },
          {
            term: "包（Package）",
            plain: "装了多个模块的目录，常规包里有一个 __init__.py。",
            detail: "包的导入名是点分路径，如 app.config。__init__.py 在包被导入时执行，通常留空或只放公开接口。"
          },
          {
            term: "sys.path",
            plain: "解释器找模块时依次搜索的目录列表。",
            detail: "第一项随启动方式变化：跑脚本时是脚本目录，用 -m 时是当前目录。临时加目录用 sys.path.insert，但更稳的是把项目装成包或设 PYTHONPATH。"
          },
          {
            term: "导入缓存（sys.modules）",
            plain: "已经导入过的模块都存在这里，再次导入直接复用。",
            detail: "所以同一次运行里改文件不会生效，模块顶层代码也只执行一次。测试里要重载模块，得用 importlib.reload。"
          }
        ]
      }
    },
    questions: [
      {
        key: "python-exp-python-modules-import-s1",
        stageKey: "python-data-structures",
        topicKey: "python-modules-import",
        type: "single",
        stem: "项目结构为 project/app/{__init__.py, config.py, main.py}，main.py 里写 from app.config import load_settings。在 project 目录下执行 python app/main.py，最可能发生什么？",
        options: [
          {
            key: "A",
            text: "正常导入并顺利运行"
          },
          {
            key: "B",
            text: "报 ModuleNotFoundError: No module named 'app'"
          },
          {
            key: "C",
            text: "报 SyntaxError，因为包内不能用绝对导入"
          },
          {
            key: "D",
            text: "报 ImportError，因为 __init__.py 不能被导入"
          }
        ],
        answer: [
          "B"
        ],
        explanation: "直接运行脚本时，sys.path 的第一项是脚本所在的 app 目录，而不是当前工作目录 project，所以解释器找不到名为 app 的包，from app.config 会抛 ModuleNotFoundError。改用 python -m app.main 时第一项变成当前工作目录，包导入就能成立。这也是包内代码推荐用 -m 方式运行的原因。",
        difficulty: "medium",
        tags: [
          "导入",
          "包",
          "sys.path"
        ],
        sourceKey: "algorithms-python",
        level: "进阶"
      },
      {
        key: "python-exp-python-modules-import-j1",
        stageKey: "python-data-structures",
        topicKey: "python-modules-import",
        type: "judge",
        stem: "模块被别的文件 import 时，模块里 if __name__ == '__main__': 下面的代码不会执行。",
        options: [
          {
            key: "A",
            text: "正确"
          },
          {
            key: "B",
            text: "错误"
          }
        ],
        answer: [
          "A"
        ],
        explanation: "import 时模块的 __name__ 被设成模块自己的名字，例如 app.config；只有用 python 直接运行该文件时 __name__ 才是 __main__。所以这个守卫能把当脚本跑和当模块用两种场景隔开，避免 import 触发打印、启动服务、读写文件这类副作用。",
        difficulty: "easy",
        tags: [
          "入口",
          "__main__",
          "导入"
        ],
        sourceKey: "algorithms-python",
        level: "入门"
      }
    ]
  },
  {
    trackSlug: "python",
    stageKey: "python-data-structures",
    topic: {
      key: "python-unicode-encoding",
      title: "文本、编码与 UTF-8",
      summary: "str 是字符序列，bytes 是字节序列，转换必须显式 encode/decode；文件读写不写 encoding 就用系统默认编码，中文 Windows 上通常是 GBK。",
      concepts: [
        "str 与 bytes",
        "UTF-8 变长编码",
        "编码错误与 errors 参数",
        "BOM 与换行"
      ],
      principles: [
        "str 存 Unicode 码点，bytes 存 0 到 255 的字节，两者之间没有隐式转换。",
        "UTF-8 是变长编码：ASCII 占 1 字节，常用汉字占 3 字节，所以字符数与字节数不是一回事。",
        "打开文件必须显式写 encoding='utf-8'，不能依赖系统区域设置的默认编码。"
      ],
      applications: [
        "读取 Excel 导出的带 BOM 的 CSV，用 utf-8-sig 打开避免列名被污染。",
        "处理网络响应与本地文件之间的文本转换，统一在边界处编码或解码。"
      ],
      pitfalls: [
        "用 UTF-8 去解码 GBK 的字节，抛 UnicodeDecodeError；反过来改 errors='ignore' 会静默丢数据。",
        "用默认编码打开文件，在 Mac 上正常、在中文 Windows 上乱码。"
      ],
      method: "先确定这份数据是文本还是字节，再在边界处显式指定编码；读写文件一律写 encoding='utf-8'，遇到带 BOM 的文件换 utf-8-sig。",
      exercise: "写一个 CSV 读取函数：兼容带 BOM 与不带 BOM 两种文件，输出每个字段的字符数与字节数。",
      checkpoint: "能解释 len('你好') 与 len('你好'.encode('utf-8')) 为什么不同，能说出 BOM 造成列名多字符的原因。",
      lesson: {
        overview: [
          "Python 3 把文本和字节分得很干净：str 是字符序列，存的是 Unicode 码点；bytes 是字节序列，存的是 0 到 255 的整数。两者之间没有隐式转换，想互转必须显式调用 encode 或 decode。这个严格是好事，它把编码问题逼到你面前，而不是在某个下游系统里悄悄变成乱码。",
          "UTF-8 是一种变长编码：ASCII 字符占 1 字节，常用汉字占 3 字节，部分表情占 4 字节。所以 len('你好') 是 2，而 len('你好'.encode('utf-8')) 是 6。做字段长度校验、计算分页或截断字符串时，必须清楚自己数的是字符还是字节，否则会在数据库列宽或接口限制上踩坑。",
          "文件读写是编码问题最常爆的地方。Python 的 open() 在不指定 encoding 时用的是系统区域设置的默认编码，中文 Windows 上通常是 GBK。同一份 UTF-8 文件在 Mac 上读得好好的，在 Windows 上就 UnicodeDecodeError。养成显式写 encoding='utf-8' 的习惯，这类问题基本消失。"
        ],
        mechanism: [
          "encode 把码点按指定编码转成字节，例如 '中'.encode('utf-8') 得到三个字节；decode 反过来把字节按编码解释成字符。编码和解码必须用同一套规则，用 UTF-8 去解 GBK 的字节，就会在某个字节位置抛 UnicodeDecodeError。",
          "错误处理由 errors 参数决定：strict 是默认值，遇到非法字节直接抛异常；replace 用替代字符占位；ignore 直接丢掉非法字节。ignore 会让数据静默变短，除了一次性清洗，一般不建议使用。",
          "文件开头的 BOM 是 UTF-8 的三字节 EF BB BF，Excel 导出的 CSV 常带。用 utf-8 打开时它会被当成一个普通字符留在第一行开头，读出来的第一个列名就多了不可见字符；用 utf-8-sig 打开则会自动跳过。",
          "csv 模块要求用 newline='' 打开文件：若用默认的换行转换，写入时行尾的 CRLF 会被再次转换，Windows 上就会多出空行。这是文档明确写出的要求，不是可选项。"
        ],
        example: {
          title: "显式编码：读带 BOM 的 CSV，并看清字符与字节",
          language: "python",
          code: "import csv\nfrom pathlib import Path\n\npath = Path(\"orders.csv\")\n\n# 1) 显式编码：utf-8-sig 兼容 BOM，newline='' 交给 csv 处理换行\nwith path.open(\"r\", encoding=\"utf-8-sig\", newline=\"\") as f:\n    rows = list(csv.reader(f))\nprint(rows[0])\n\n# 2) str 与 bytes 是两种东西，转换必须显式\ntext = \"你好\"\nraw = text.encode(\"utf-8\")\nprint(len(text), len(raw))      # 2 6\nprint(raw.decode(\"utf-8\"))      # 你好\n\n# 3) 编码不匹配会抛异常，出错位置就在报错信息里\ngbk_bytes = text.encode(\"gbk\")\ntry:\n    gbk_bytes.decode(\"utf-8\")\nexcept UnicodeDecodeError as exc:\n    print(\"解码失败:\", exc)",
          explanation: "utf-8-sig 专治 Excel 导出的带 BOM 文件：它会把开头那三个字节当成标记吃掉，而普通 utf-8 会把它留成第一行的不可见字符，导致列名对不上。newline='' 是 csv 文档要求的写法，否则 Windows 上写出的文件会出现空行。第二段用一次编码一次解码演示边界：同一个字符串是 2 个字符、6 个字节。第三段故意用错编码，说明 UnicodeDecodeError 的成因是字节序列不合法，报错里的 position 就是第一个出问题的字节位置。"
        },
        practiceSteps: [
          "用 Excel 另存一份 CSV UTF-8（带 BOM），分别用 utf-8 与 utf-8-sig 读取，对比第一个列名的区别。",
          "对同一段中英混排文本，打印 len(text)、len(text.encode('utf-8'))、len(text.encode('gbk')) 三个数字。",
          "故意用 UTF-8 解码 GBK 字节，读一遍 UnicodeDecodeError 的信息，指出 position 对应哪个字节。"
        ],
        masteryChecklist: [
          "能解释 str 与 bytes 的区别，并说明什么时候必须显式转换。",
          "能说出 BOM 是什么、为什么会弄脏 CSV 的第一个列名。"
        ],
        summary: [
          "str 是 Unicode 字符序列，bytes 是字节序列，互转必须显式 encode/decode。",
          "UTF-8 变长：ASCII 1 字节、常用汉字 3 字节，len 数字符不数字节。",
          "open() 不写 encoding 就用系统默认编码，务必显式写 utf-8。",
          "带 BOM 的文件用 utf-8-sig 读；csv 用 newline='' 打开。",
          "编码用错抛 UnicodeDecodeError，errors='ignore' 会静默丢数据。"
        ],
        terms: [
          {
            term: "Unicode",
            plain: "给世界上每个字符编一个号的字符集。",
            detail: "它只是编号表，不规定怎么存成字节。同一个字符可以有多种编码（UTF-8、GBK），所以文本与字节之间必须约定编码。"
          },
          {
            term: "UTF-8",
            plain: "把 Unicode 编号存成字节的一种变长编码。",
            detail: "ASCII 占 1 字节、汉字占 3 字节，兼容 ASCII，是网络与文件的事实标准。变长意味着一字节不等于一字符，长度计算要小心。"
          },
          {
            term: "BOM",
            plain: "文件开头的几个标记字节，用来说明编码。",
            detail: "UTF-8 的 BOM 是 EF BB BF。不少 Windows 工具（Excel）会写它；用不带 sig 的编码读取时，它会变成第一个字符，害得列名匹配失败。"
          },
          {
            term: "乱码（Mojibake）",
            plain: "用错编码解释字节后看到的一堆无意义字符。",
            detail: "典型原因是写的时候用 UTF-8、读的时候用 GBK。数据本身没坏，只是解释规则错了；能救的前提是知道原始编码。"
          }
        ]
      }
    },
    questions: [
      {
        key: "python-exp-python-unicode-encoding-s1",
        stageKey: "python-data-structures",
        topicKey: "python-unicode-encoding",
        type: "single",
        stem: "表达式 len('你好') 与 len('你好'.encode('utf-8')) 的结果分别是？",
        options: [
          {
            key: "A",
            text: "2 和 6"
          },
          {
            key: "B",
            text: "2 和 2"
          },
          {
            key: "C",
            text: "6 和 6"
          },
          {
            key: "D",
            text: "6 和 2"
          }
        ],
        answer: [
          "A"
        ],
        explanation: "len() 对 str 数的是字符数，你好 是两个字，所以是 2；encode('utf-8') 得到的是 bytes，len() 数的是字节数，常用汉字在 UTF-8 里各占 3 字节，两个字共 6 字节。D 把两个结果弄反了：UTF-8 是变长编码，字节数不会比字符数少。字段长度校验和截断必须说清数的是哪一种。",
        difficulty: "medium",
        tags: [
          "编码",
          "UTF-8",
          "bytes"
        ],
        sourceKey: "exercism-python",
        level: "进阶"
      },
      {
        key: "python-exp-python-unicode-encoding-j1",
        stageKey: "python-data-structures",
        topicKey: "python-unicode-encoding",
        type: "judge",
        stem: "用 encoding='utf-8' 打开 Excel 导出的 CSV 时，第一列列名可能多出一个不可见字符；改用 encoding='utf-8-sig' 可以去掉它。",
        options: [
          {
            key: "A",
            text: "正确"
          },
          {
            key: "B",
            text: "错误"
          }
        ],
        answer: [
          "A"
        ],
        explanation: "Excel 导出的 CSV 常在文件开头写 UTF-8 BOM（三字节 EF BB BF）。用 utf-8 解码时，BOM 会被当成一个普通字符留在第一行开头，于是第一个列名对不上；utf-8-sig 会在解码时识别并跳过它。这不是数据错了，而是编码约定不同，按文件是否带 BOM 选对编码即可。",
        difficulty: "medium",
        tags: [
          "BOM",
          "CSV",
          "编码"
        ],
        sourceKey: "exercism-python",
        level: "进阶"
      }
    ]
  },
  {
    trackSlug: "python",
    stageKey: "python-oop-typing",
    topic: {
      key: "python-properties",
      title: "property、属性校验与派生值",
      summary: "property 让属性读写执行代码：写入走 setter 校验，派生值用只读 getter 保证永远和当前状态一致。它是数据描述符，所以能压过实例字典。",
      concepts: [
        "property 与数据描述符",
        "getter 与 setter 校验",
        "只读派生值",
        "cached_property"
      ],
      principles: [
        "property 是数据描述符，属性查找时优先于实例 __dict__，因此能接管读写。",
        "只定义 getter 的 property 是只读的，赋值会抛 AttributeError 而不是静默失败。",
        "校验放在 setter 里，所有写入路径都经过同一套规则，比在调用点重复检查可靠。"
      ],
      applications: [
        "把公开字段升级成带校验的属性，调用方代码不用改。",
        "把总价、年龄这类派生值做成只读属性，消除两份状态不同步。"
      ],
      pitfalls: [
        "在 property 里查数据库或读文件，循环访问时被放大成 N 次 IO。",
        "以为单下划线是访问控制：_balance 只是约定，外部仍能直接赋值。"
      ],
      method: "先问这个值是独立状态还是算出来的：独立状态存字段并用 setter 校验，算出来的用只读 property；访问频繁且计算昂贵时再换 cached_property。",
      exercise: "给订单类加 quantity 的 setter 校验和只读 subtotal，并补两个测试：设成 0 抛 ValueError、给 subtotal 赋值抛 AttributeError。",
      checkpoint: "能解释 property 为什么优先于实例字典，能判断哪些属性该缓存、缓存何时失效。",
      lesson: {
        overview: [
          "把属性直接暴露出去，是类设计里最省事也最脆弱的做法：任何代码都能把 quantity 改成 -1，而对象没有任何机会拒绝。property 提供的正是看起来还是普通属性、读写时却能执行代码的能力，因此可以在不改变调用方写法的前提下补上校验、换算和日志。",
          "property 的第二个用途是派生值。总价、年龄、是否逾期这类值完全由已有字段决定，存成字段就有不一致的风险：改了单价忘了改总价。把它们做成只读 property，每次访问都按当前状态重新计算，等于从结构上消灭两份真相。代价是每次访问都要算一遍，所以重活要配缓存。",
          "第三层是成本意识。property 是函数调用，放在循环里被访问几十万次时开销不可忽略；如果在里面查数据库或读文件，还会把一次访问放大成 N 次 IO。判断标准很简单：访问是否频繁、计算是否昂贵。频繁又昂贵，就换 cached_property 或提前算好。"
        ],
        mechanism: [
          "属性查找的顺序是：先看类型上的数据描述符（定义了 __set__ 或 __delete__），再找实例字典，最后才看普通类属性。property 实现了 __get__ 和 __set__，属于数据描述符，所以它能优先于实例 __dict__，这也是它能接管属性访问的原因。",
          "写法上，@property 装饰 getter，产生一个 property 对象；再用 @quantity.setter 注册 setter，返回新的 property 对象并覆盖类属性上的旧名字。只定义 getter 时，赋值会抛 AttributeError，因为找不到对应的 __set__ 实现。",
          "cached_property 在第一次访问时计算结果，并把值写进实例的 __dict__；之后属性查找直接命中实例字典，跳过描述符。因此它要求实例有 __dict__（用 __slots__ 的类不适用），也不会在源数据变化时自动失效，需要手动删除该属性或重建对象。",
          "下划线不是访问控制：_balance 只是内部使用的约定，__balance 会被名称改写为 _ClassName__balance，外部依然能访问。真正的边界靠 property、只读视图和团队约定共同维持。"
        ],
        example: {
          title: "setter 校验 + 只读派生值",
          language: "python",
          code: "from decimal import Decimal\n\nclass Order:\n    def __init__(self, unit_price: Decimal, quantity: int) -> None:\n        self.unit_price = unit_price\n        self.quantity = quantity          # 走 setter，构造时也受校验\n\n    @property\n    def quantity(self) -> int:\n        return self._quantity\n\n    @quantity.setter\n    def quantity(self, value: int) -> None:\n        if not isinstance(value, int) or value <= 0:\n            raise ValueError(\"quantity 必须是正整数\")\n        self._quantity = value\n\n    @property\n    def subtotal(self) -> Decimal:        # 只读派生值，永远与当前状态一致\n        return self.unit_price * self.quantity\n\norder = Order(Decimal(\"19.90\"), 3)\nprint(order.subtotal)                     # 59.70\norder.quantity = 5\nprint(order.subtotal)                     # 99.50\n\ntry:\n    order.subtotal = Decimal(\"0\")          # 没有 setter\nexcept AttributeError as exc:\n    print(\"只读属性:\", exc)\n\ntry:\n    order.quantity = 0                     # setter 校验\nexcept ValueError as exc:\n    print(\"校验失败:\", exc)",
          explanation: "quantity 的公开名是属性，真实值存在 _quantity 里；构造时赋 quantity 同样经过 setter，所以校验没有漏口（若在 __init__ 里直接写 _quantity 就绕过了校验）。subtotal 是只读派生值：每次访问都按当前单价与数量重算，改数量后自动正确。给 subtotal 赋值会抛 AttributeError，因为 property 只有 getter；把 quantity 设成 0 则被 setter 拦下，抛 ValueError。这正是把校验集中到入口的好处：任何写入途径都逃不掉。"
        },
        practiceSteps: [
          "找一个直接把字段暴露出去的类，把其中一个字段改成 property 加 setter，并加上范围校验。",
          "给一个由其它字段算出的值（总价、年龄）加只读 property，验证给它赋值会抛 AttributeError。",
          "在一个被循环大量访问的 property 里加计数器，确认每次访问都执行，再换 cached_property 对比次数。"
        ],
        masteryChecklist: [
          "能解释 property 为什么能优先于实例 __dict__ 生效。",
          "能判断一个 property 该不该缓存，并说出 cached_property 的失效条件。"
        ],
        summary: [
          "property 让属性读写执行代码，调用方写法不变。",
          "只有 getter 的 property 是只读的，赋值抛 AttributeError。",
          "派生值用只读 property，避免两份状态不一致。",
          "property 每次访问都执行，重活要用 cached_property，失效要手动处理。",
          "单下划线只是约定，不是访问控制。"
        ],
        terms: [
          {
            term: "property",
            plain: "让方法以属性形式访问的装饰器。",
            detail: "用 @property 定义读，@x.setter 定义写。它的价值在于先按普通属性写代码，等需要校验或换算时再换成 property，调用方无需修改。"
          },
          {
            term: "描述符（Descriptor）",
            plain: "实现了 __get__/__set__，能接管属性访问的类属性。",
            detail: "property、函数、cached_property 都是描述符。定义了 __set__ 的叫数据描述符，优先级高于实例字典，这就是 property 能生效的原因。"
          },
          {
            term: "派生值（Computed Value）",
            plain: "不单独存，由其它字段算出来的值。",
            detail: "总价、年龄、是否逾期都属于派生值。存成字段会带来两份状态不同步的风险；用只读 property 每次现算，代价是每次都要计算。"
          },
          {
            term: "cached_property",
            plain: "第一次算完就存进实例字典，之后直接取。",
            detail: "来自 functools。它没有失效机制，源数据变了要手动 del 或重建对象；也因为写入实例字典，使用 __slots__ 的类不能用它。"
          }
        ]
      }
    },
    questions: [
      {
        key: "python-exp-python-properties-s1",
        stageKey: "python-oop-typing",
        topicKey: "python-properties",
        type: "single",
        stem: "一个 property 只写了 getter，没有写 setter。执行 order.subtotal = 0 会发生什么？",
        options: [
          {
            key: "A",
            text: "正常写入，下次读到 0"
          },
          {
            key: "B",
            text: "抛 AttributeError，因为没有 __set__ 实现"
          },
          {
            key: "C",
            text: "抛 ValueError，因为类型不匹配"
          },
          {
            key: "D",
            text: "静默忽略，值保持不变"
          }
        ],
        answer: [
          "B"
        ],
        explanation: "property 是数据描述符，读走 __get__，写走 __set__；只定义 getter 时没有 __set__，赋值就会抛 AttributeError，3.11 起的提示是 property has no setter。这正好实现只读属性：派生值由其它字段算出来，不允许外部直接写，避免两份状态不一致。ValueError 是 setter 内部校验失败时抛的，两者不要混淆。",
        difficulty: "medium",
        tags: [
          "property",
          "只读属性",
          "描述符"
        ],
        sourceKey: "algorithms-python",
        level: "进阶"
      },
      {
        key: "python-exp-python-properties-j1",
        stageKey: "python-oop-typing",
        topicKey: "python-properties",
        type: "judge",
        stem: "用 cached_property 缓存的值，在源数据改变后会自动重新计算。",
        options: [
          {
            key: "A",
            text: "正确"
          },
          {
            key: "B",
            text: "错误"
          }
        ],
        answer: [
          "B"
        ],
        explanation: "cached_property 只在第一次访问时计算，然后把结果写进实例的 __dict__，之后属性查找直接命中实例字典，不再执行函数。它没有任何失效机制：源数据变了，缓存仍是旧值。需要更新时得手动 del 掉该属性（再访问会重算）或重建对象。也因为它依赖 __dict__，使用 __slots__ 的类不能直接用。",
        difficulty: "medium",
        tags: [
          "cached_property",
          "缓存",
          "失效"
        ],
        sourceKey: "algorithms-python",
        level: "进阶"
      }
    ]
  },
  {
    trackSlug: "python",
    stageKey: "python-data-project",
    topic: {
      key: "python-datetime-timezone",
      title: "日期、时间与时区处理",
      summary: "naive 时间不带时区、aware 时间带时区，两者不能比较。工程口径是库里存 UTC、展示时 astimezone 到用户时区，解析用 ISO 8601。",
      concepts: [
        "datetime 与 timedelta",
        "naive 与 aware",
        "UTC 存储与本地展示",
        "ISO 8601 解析与格式化"
      ],
      principles: [
        "datetime.now() 返回 naive 的本地时间，now(timezone.utc) 才是 aware 的 UTC 时间。",
        "naive 与 aware 时间不能直接比较或相减，会抛 TypeError，必须先统一时区。",
        "存储与传输用 UTC，展示时再转本地时区；时区规则用 ZoneInfo，不要手写固定偏移。"
      ],
      applications: [
        "订单时间统一以 UTC 入库，前端按用户时区显示。",
        "日报按本地时区切分自然日，跨时区用户各自看到自己的当天。"
      ],
      pitfalls: [
        "混淆 strftime 的 %m（月）与 %M（分）、%Y（四位年）与 %y（两位年）。",
        "把用户本地时间当 UTC 存库，换时区或做跨天统计时整体偏移。"
      ],
      method: "先确定这个时间是记录还是展示：记录用 aware 的 UTC，展示再 astimezone；解析走 fromisoformat，格式化只用在显示层。",
      exercise: "写一个函数：接收 ISO 8601 字符串，返回北京时间与 UTC 时间戳，并处理不带时区的输入。",
      checkpoint: "能解释 naive 与 aware 的区别，能说出为什么库里存 UTC、展示才转本地。",
      lesson: {
        overview: [
          "时间有三层：时间点（某一瞬间）、时区（这个瞬间在本地是几点）、显示格式（给人看的字符串）。数据库该存时间点，界面该显示本地时间，日志该用统一格式。把三层混成一层，比如直接把本地时间字符串存库，在换时区、做跨天统计、比对先后顺序时会一起出问题。",
          "Python 的 datetime 分 naive 和 aware：naive 不带时区信息，aware 的 tzinfo 不为 None。datetime.now() 返回 naive 的本地时间，datetime.now(timezone.utc) 才是 aware 的 UTC 时间。两者不能直接比较或相减，会抛 TypeError。这个报错其实是保护，它逼你说清这个时间到底是哪个时区的几点。",
          "工程上的通行做法是：入库与传输统一用 UTC（或带偏移的 ISO 8601），展示时再转到用户时区。这样服务器换机房、用户出国、统计口径变化，都不需要改历史数据。解析和格式化分别交给 fromisoformat 与 strftime，前者负责读标准写法，后者只负责给人看。"
        ],
        mechanism: [
          "datetime 是不可变对象，内部记录年月日时分秒微秒，外加一个可选的 tzinfo。timedelta 表示一段时长，支持加减和乘除；aware 时间做加减时，具体行为取决于 tzinfo 的实现，所以跨夏令时的计算要用 ZoneInfo 而不是手工加偏移。",
          "时区不要用手写的 +8 小时表示：timezone(timedelta(hours=8)) 只能表达固定偏移，遇到有夏令时的地区就会错。ZoneInfo('Asia/Shanghai') 用的是 IANA 时区数据库，包含历史偏移调整，astimezone 转换时才会算对。",
          "timestamp() 返回 Unix 时间戳，即从 1970-01-01 UTC 起的秒数。对 aware 时间它直接换算；对 naive 时间，Python 会按本机时区解释，于是同一个 naive 值在不同机器上得到的戳可能不同，这也是不要用 naive 时间的具体理由。",
          "fromisoformat 在 Python 3.11 起才支持 Z 后缀；3.10 及更早只能解析 isoformat 自己输出的格式。需要兼容旧版本时，先 replace('Z', '+00:00') 再解析，这也是处理第三方接口时间字段的常用写法。"
        ],
        example: {
          title: "记录用 UTC，展示转本地，解析走 ISO 8601",
          language: "python",
          code: "from datetime import datetime, timedelta, timezone\nfrom zoneinfo import ZoneInfo\n\nshanghai = ZoneInfo(\"Asia/Shanghai\")\n\n# 1) 记录：用 aware 的 UTC 时间\ncreated = datetime.now(timezone.utc)\nprint(created.isoformat())              # 2026-10-17T10:11:12.345678+00:00\n\n# 2) 展示：转成用户时区再格式化\nprint(created.astimezone(shanghai).strftime(\"%Y-%m-%d %H:%M:%S\"))\n\n# 3) 解析：兼容带 Z 的 ISO 8601 字符串\nts = datetime.fromisoformat(\"2026-10-17T10:11:12Z\".replace(\"Z\", \"+00:00\"))\nprint(ts.timestamp())                   # 秒级时间戳，适合入库与比较\n\n# 4) 计算：timedelta 表示时长\nprint((ts + timedelta(days=7)).isoformat())\n\n# 5) naive 与 aware 不能直接比较，先显式补时区\nnaive = datetime(2026, 10, 17, 10, 11, 12)\nprint(naive.replace(tzinfo=timezone.utc) == ts)   # True",
          explanation: "记录用 now(timezone.utc)，拿到的是 aware 时间，isoformat 输出带 +00:00 的标准写法，谁读都不会歧义。展示才做时区转换，astimezone 按 Asia/Shanghai 的规则换算并保留正确偏移。解析用 fromisoformat，Z 后缀在 3.11 才原生支持，所以先换成 +00:00，兼容 3.10 及更早。最后一行演示 replace(tzinfo=...)：它只是贴上时区标签，不做换算；如果那个 naive 值本来就代表北京时间，贴 UTC 就会差 8 小时。另外，Windows 上的 Python 若报 ZoneInfoNotFoundError，是系统缺少时区数据库，执行 pip install tzdata 即可。"
        },
        practiceSteps: [
          "打印 datetime.now() 与 datetime.now(timezone.utc).isoformat()，指出哪个带时区。",
          "把一个 UTC 时间用 astimezone(ZoneInfo('Asia/Shanghai')) 转成本地时间并格式化输出。",
          "故意比较 naive 与 aware 时间，读一遍 TypeError 的信息，再用 replace(tzinfo=...) 修正后比较。"
        ],
        masteryChecklist: [
          "能说出 naive 与 aware 的差别，以及为什么入库要用 UTC。",
          "能分清 strftime 的 %m 与 %M、%Y 与 %y。"
        ],
        summary: [
          "datetime 分 naive 与 aware，两者不能直接比较或相减。",
          "记录用 aware 的 UTC，展示用 astimezone 转本地时区。",
          "时区用 ZoneInfo，不要手写固定偏移。",
          "解析优先 fromisoformat，注意 3.11 之前不支持 Z 后缀。",
          "strftime 只负责显示；%m 是月、%M 是分。"
        ],
        terms: [
          {
            term: "naive / aware",
            plain: "不带时区信息的时间 / 带时区信息的时间。",
            detail: "判据是 tzinfo 是否为 None。naive 只能靠上下文猜时区，所以不能和 aware 比较；工程上尽量让时间从产生那一刻就是 aware 的 UTC。"
          },
          {
            term: "时区数据库（IANA tz database）",
            plain: "记录各地历史偏移和夏令时规则的数据。",
            detail: "zoneinfo 读的就是它，键名形如 Asia/Shanghai。它比手写 +8 小时可靠，因为同一地区的历史偏移并不唯一，有夏令时的地区还会变。"
          },
          {
            term: "Unix 时间戳（Epoch）",
            plain: "从 1970-01-01 UTC 起算的秒数。",
            detail: "一个整数就能表示某个瞬间，与时区无关，适合入库和比较。展示时再转成 datetime；注意毫秒与秒差 1000 倍，很多接口踩这个坑。"
          },
          {
            term: "ISO 8601",
            plain: "像 2026-10-17T10:11:12+08:00 这样的标准时间写法。",
            detail: "带 T 分隔日期与时间，末尾的 +08:00 表示偏移，Z 等价于 +00:00。它是交换格式的首选，因为既有顺序性又自解释。"
          }
        ]
      }
    },
    questions: [
      {
        key: "python-exp-python-datetime-timezone-s1",
        stageKey: "python-data-project",
        topicKey: "python-datetime-timezone",
        type: "single",
        stem: "下面哪个表达式得到的是带时区的 aware datetime？",
        options: [
          {
            key: "A",
            text: "datetime.now()"
          },
          {
            key: "B",
            text: "datetime.utcnow()"
          },
          {
            key: "C",
            text: "datetime.now(timezone.utc)"
          },
          {
            key: "D",
            text: "datetime(2026, 10, 17, 10, 11, 12)"
          }
        ],
        answer: [
          "C"
        ],
        explanation: "aware 的判据是 tzinfo 不为 None。now() 返回本地时间的 naive 值；utcnow() 虽然取的是 UTC，但返回的同样是不带时区的 naive 值，3.12 起已被标记弃用；datetime(...) 直接构造出来的也是 naive。只有 now(timezone.utc) 显式带上 tzinfo，才能安全地比较、相减和换算，也不会被本机时区悄悄影响。",
        difficulty: "medium",
        tags: [
          "datetime",
          "时区",
          "aware"
        ],
        sourceKey: "ms-data-science",
        level: "进阶"
      },
      {
        key: "python-exp-python-datetime-timezone-j1",
        stageKey: "python-data-project",
        topicKey: "python-datetime-timezone",
        type: "judge",
        stem: "naive datetime 与 aware datetime 可以直接比较大小。",
        options: [
          {
            key: "A",
            text: "正确"
          },
          {
            key: "B",
            text: "错误"
          }
        ],
        answer: [
          "B"
        ],
        explanation: "两者相差的正是属于哪个时区这一信息，Python 无法判断谁更早，因此比较或相减会抛 TypeError，提示 can't compare offset-naive and offset-aware datetimes。正确做法是先把它们统一：给 naive 值补上它实际所属的时区，或者全部换成 aware 的 UTC 时间再比较。",
        difficulty: "medium",
        tags: [
          "datetime",
          "比较",
          "时区"
        ],
        sourceKey: "ms-data-science",
        level: "进阶"
      }
    ]
  },
];
