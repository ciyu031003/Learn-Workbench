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

/** Python 补充题库（按知识点细分，2 题/知识点）。 */
export const pythonSupplementQuestions: LearningQuestion[] = [
  singleQuestion({ key: "python-sup-python-values-control-s1", stageKey: "python-foundation", topicKey: "python-values-control",
    stem: "在 Python 中，表达式 bool(0)、bool(\"\") 与 bool([]) 的求值结果分别是什么？请结合真值判定规则回答。", options: ["三者都为 True","三者都为 False","只有 bool(0) 为 True，其余为 False","只有 bool(\"\") 为 True，其余为 False"], answer: "B",
    explanation: "在 Python 中，数值 0、空字符串 \"\"、空列表 [] 都属于“假值”（falsy）：bool() 函数依据对象的真值测试协议 __bool__ 或 __len__ 进行判定，上述三个对象均被判定为假，因此 bool(0)、bool(\"\")、bool([]) 均返回 False。其余常见假值还包括 None、空元组与空字典等。", difficulty: "easy", tags: ["真值","布尔"], sourceKey: "exercism-python", level: "入门" }),
  singleQuestion({ key: "python-sup-python-functions-s1", stageKey: "python-foundation", topicKey: "python-functions",
    stem: "关于 Python 中函数的默认参数，下列描述正确的是？", options: ["默认参数的值在函数定义时被求值一次，因此可变默认参数会在多次调用间共享","默认参数必须在所有位置参数之后，但可以在 *args 之前任意位置","每次调用函数时，默认参数都会被重新计算","默认参数不能是可变对象，否则程序无法运行"], answer: "A",
    explanation: "Python 在“定义函数”时（def 执行时）就对默认参数表达式求值一次，并把结果绑定到函数对象的 __defaults__ 上。若默认参数是可变对象（如列表、字典），后续对该对象的就地修改会在多次调用之间持续存在，造成跨调用共享状态。因此推荐用 None 作为哨兵值，在函数体内再初始化可变对象，避免意外的状态累积。", difficulty: "easy", tags: ["函数","默认参数"], sourceKey: "exercism-python", level: "入门" }),
  singleQuestion({ key: "python-sup-python-debug-s1", stageKey: "python-foundation", topicKey: "python-debug",
    stem: "当 Python 抛出如下异常时，最合理的第一步排查方式是？\nTraceback (most recent call last):\n  File \"main.py\", line 12, in <module>\n    result = items[10]\nIndexError: list index out of range", options: ["随机修改代码直到不报错","从 traceback 最后一行（最内层）向上定位触发位置，检查索引取值的边界","删除所有异常处理","直接把所有代码包进 try/except 忽略报错"], answer: "B",
    explanation: "Traceback 的展示顺序是从外到内：最底部“最内层”的一行（本例的 IndexError: list index out of range 以及 main.py 的 line 12）是异常真正被触发的现场。合理的调试第一步是阅读最后一行确定异常类型，再沿栈向上找到对应的代码行，结合上下文检查索引是否越界或长度计算是否正确，而不是盲目改动或吞掉异常。", difficulty: "easy", tags: ["调试","异常"], sourceKey: "exercism-python", level: "入门" }),
  singleQuestion({ key: "python-sup-python-data-structures-s1", stageKey: "python-data-structures", topicKey: "python-collections",
    stem: "关于列表（list）与元组（tuple）的区别，下列描述正确的是？", options: ["列表和元组都不可变，只是语法不同","列表可变、元组不可变；因此元组可作为字典的键而列表不能","元组性能一定比列表差","列表只能存放同一类型元素，元组可混合类型"], answer: "B",
    explanation: "列表是可变序列（可增删改元素），元组是不可变序列（创建后元素不可更改）。由于字典的键要求对象可哈希（hashable），而可变对象（如 list）不可哈希，因此列表不能作字典键；不可变的元组在元素本身可哈希时可以作字典键。列表与元组对元素类型都没有同构限制，均可混合存放不同类型。", difficulty: "easy", tags: ["数据结构","可变性"], sourceKey: "exercism-python", level: "入门" }),
  singleQuestion({ key: "python-sup-python-collections-s1", stageKey: "python-data-structures", topicKey: "python-collections",
    stem: "给定 d = {\"a\": 1, \"b\": 2}，执行下列代码后，x 的值是？\n代码：x = {k: v * 2 for k, v in d.items() if v % 2 == 0}", options: ["{\"a\": 2, \"b\": 4}","{\"b\": 4}","{\"a\": 1, \"b\": 2}","{}"], answer: "B",
    explanation: "这是一个带过滤条件的字典推导式。d.items() 依次产生 (\"a\", 1) 与 (\"b\", 2)；过滤条件 v % 2 == 0 只保留值为偶数的项，因此 \"a\":1 被排除、\"b\":2 被保留，并映射为 \"b\": 4（值乘以 2）。最终 x = {\"b\": 4}。字典推导式与列表推导式共享相同的“表达式 + 循环 + 过滤”结构。", difficulty: "medium", tags: ["推导式","字典"], sourceKey: "exercism-python", level: "进阶" }),
  singleQuestion({ key: "python-sup-python-files-s1", stageKey: "python-data-structures", topicKey: "python-files",
    stem: "关于使用 with open(...) as f: 读取文件的优势，下列描述正确的是？", options: ["它会自动把文件内容全部加载进内存，速度最快","它会在代码块结束时自动调用 f.close()，即使中途发生异常也能正确释放文件句柄","它可以替代所有异常处理","它只在 Windows 上有效"], answer: "B",
    explanation: "with 语句基于上下文管理器协议（__enter__/__exit__）工作：进入时打开文件，离开 with 代码块时无论正常结束还是抛出异常，都会执行 __exit__ 确保文件被关闭，从而避免文件句柄泄漏。它并不负责把内容全部读入内存（read() 才决定），也不能替代业务逻辑中的异常处理，且跨平台通用。", difficulty: "easy", tags: ["文件","上下文"], sourceKey: "exercism-python", level: "入门" }),
  singleQuestion({ key: "python-sup-python-testing-s1", stageKey: "python-data-structures", topicKey: "python-testing",
    stem: "在 pytest 中，关于测试函数命名与断言的约定，下列描述正确的是？", options: ["测试函数名必须以 test_ 开头，断言使用 Python 原生的 assert 语句","测试函数名可以任意命名，pytest 会自动发现","必须使用特殊关键字 expect 来写断言","每个测试文件必须继承某个测试基类"], answer: "A",
    explanation: "pytest 默认通过“前缀约定”收集用例：测试文件、测试类、测试函数分别以 test_ 开头或以 _test 结尾；测试函数内直接使用 Python 原生 assert 表达式即可，pytest 会捕获断言失败并输出详细的上下文对比，无需引入额外断言 API，也无需继承测试基类。", difficulty: "easy", tags: ["测试","pytest"], sourceKey: "exercism-python", level: "入门" }),
  singleQuestion({ key: "python-sup-python-oop-typing-s1", stageKey: "python-oop-typing", topicKey: "python-classes",
    stem: "关于鸭子类型（duck typing）与显式类型检查，下列描述正确的是？", options: ["鸭子类型要求对象必须继承自特定基类才能调用方法","鸭子类型关注“对象能做什么（具备哪些方法/行为）”，而非它是什么类","显式使用 isinstance 一定比鸭子类型更优","Python 完全不支持任何类型检查"], answer: "B",
    explanation: "鸭子类型的核心是“如果它走起来像鸭子、叫起来像鸭子，那么它就是鸭子”：只要在运行时对象具备所需的方法或属性，即可被使用，而不要求它属于某个具体类。这带来了灵活性，但也可能让契约不够显式。isinstance 在需要严格约束或分支处理时很有用，但并非总是更优；Python 同时支持运行时 isinstance 与静态类型标注，二者互补而非互斥。", difficulty: "medium", tags: ["面向对象","鸭子类型"], sourceKey: "exercism-python", level: "进阶" }),
  singleQuestion({ key: "python-sup-python-classes-s1", stageKey: "python-oop-typing", topicKey: "python-classes",
    stem: "关于 Python 类中 __init__ 方法与实例属性，下列描述正确的是？", options: ["__init__ 在类被定义时执行，用于初始化类属性","__init__ 在创建实例时自动调用，用于初始化该实例的属性","每个实例共享同一个 __init__ 返回的对象","类中不能定义除 __init__ 之外的其他方法"], answer: "B",
    explanation: "__init__ 是实例构造钩子：当执行 ClassName(...) 创建实例时，Python 先创建空实例再自动调用 __init__(self, ...) 来设置实例属性（如 self.x = ...）。它作用于单个实例，而非类定义时刻，也不是构造函数本身（真正的构造由 __new__ 负责）。一个类当然可以定义任意多个方法。self 代表当前实例，用于绑定实例状态。", difficulty: "easy", tags: ["类","实例"], sourceKey: "exercism-python", level: "入门" }),
  singleQuestion({ key: "python-sup-python-typing-s1", stageKey: "python-oop-typing", topicKey: "python-typing",
    stem: "关于 typing 模块中的 Protocol 与抽象基类（ABC），下列描述正确的是？", options: ["Protocol 要求实现类显式继承它，才能被判定为子类型","Protocol 支持“结构化子类型”（静态鸭子类型）：只要对象具备协议要求的方法/属性，即被视为实现，无需显式继承","ABC 只能用于运行时检查，不能用于静态类型","Protocol 与 ABC 功能完全相同，可随意互换"], answer: "B",
    explanation: "typing.Protocol 实现的是结构化子类型（structural typing）：类型检查器在静态分析时，只要某类拥有协议所要求的方法签名与属性，就认为它“满足协议”，无需显式继承 Protocol。这与抽象基类（ABC，强调显式继承与运行时 isinstance 检查）形成互补。Protocol 主要用于静态类型系统的鸭子类型表达，不能直接用于运行时 isinstance 判定。", difficulty: "medium", tags: ["类型标注","Protocol"], sourceKey: "exercism-python", level: "进阶" }),
  singleQuestion({ key: "python-sup-python-context-s1", stageKey: "python-oop-typing", topicKey: "python-context",
    stem: "关于生成器（generator）与列表在内存与惰性求值上的区别，下列描述正确的是？", options: ["生成器会一次性把所有元素放进内存，因此处理大数据更慢","生成器按需（惰性）逐个产出元素，适合处理无法全部装入内存的流式数据","生成器不能使用 for 循环迭代","列表推导式与生成器表达式在内存占用上没有区别"], answer: "B",
    explanation: "生成器通过 yield 暂停/恢复执行，按需逐个产出值，不会一次性构建完整序列，因此内存占用稳定，特别适合读取超大文件、无限序列或流式处理。列表则会一次性物化全部元素。对应地，列表推导式 [...] 生成列表，而生成器表达式 (...) 返回生成器；二者在内存占用上差异显著。生成器完全支持 for 迭代。", difficulty: "medium", tags: ["生成器","惰性求值"], sourceKey: "exercism-python", level: "进阶" }),
  singleQuestion({ key: "python-sup-python-data-project-s1", stageKey: "python-data-project", topicKey: "python-pandas",
    stem: "在从原始数据到可交付数据分析报告的完整项目中，下列流程顺序最合理的是？", options: ["直接出图 → 收集数据 → 清洗 → 建模 → 撰写结论","明确问题 → 收集与接入数据 → 清洗与探索 → 分析与建模 → 可视化与撰写报告","先写报告 → 再补数据","只做建模，跳过清洗与可视化"], answer: "B",
    explanation: "一个稳健的数据分析项目应以“业务问题”为起点：先明确要回答的问题与成功标准，再收集/接入数据；随后进行数据清洗（处理缺失、异常、重复）与探索性分析（EDA），理解分布与相关性；在此基础上有针对性地分析与建模；最后用可视化与文字把结论讲清楚并给出可行动建议。跳过清洗或问题定义，结论往往不可靠。", difficulty: "hard", tags: ["项目流程","数据分析"], sourceKey: "ms-data-science", level: "综合" }),
  singleQuestion({ key: "python-sup-python-pandas-s1", stageKey: "python-data-project", topicKey: "python-pandas",
    stem: "使用 Pandas 合并两个 DataFrame 时，若左表连接键存在重复值，下列描述正确的是？", options: ["merge 会直接报错，无法进行任何合并","左表每行会与其在右表中匹配到的每一行组合，可能产生行数膨胀（一对多）","只会随机保留一条匹配结果","右表会被整体删除"], answer: "B",
    explanation: "Pandas 的 merge 基于关系代数执行连接：当一侧连接键出现重复时，会按“一对一 / 一对多 / 多对多”展开。若左表连接键有重复而右表匹配到多行，左表每一行都会与右表所有匹配行组合，导致结果行数增加（行数膨胀）。这是预期行为而非错误；分析时需注意重复键带来的聚合偏差，必要时先去重或聚合再合并。", difficulty: "hard", tags: ["Pandas","合并"], sourceKey: "ms-data-science", level: "综合" }),
  singleQuestion({ key: "python-sup-python-visualization-s1", stageKey: "python-data-project", topicKey: "python-visualization",
    stem: "在制作探索性数据可视化时，关于图表选择的原则，下列描述正确的是？", options: ["任何数据都应该先用饼图，因为它最直观","应依据“变量类型与对比目的”选择图表：类别对比用条形图、趋势随时间用折线图、分布用直方图/箱线图","颜色越多越好，能突出所有信息","图表越复杂越能体现专业性"], answer: "B",
    explanation: "可视化选型应服务于“要回答的问题”与“数据类型”：比较各类别数值大小适合条形图/柱状图；观察随时间变化的趋势适合折线图；理解单变量分布适合直方图或箱线图；展示两变量关系适合散点图。饼图在类别过多或需精确比较时并不直观；过度用色与过度复杂会增加认知负荷，反而削弱信息传达，应遵循“少即是多”。", difficulty: "medium", tags: ["可视化","图表选型"], sourceKey: "ms-data-science", level: "进阶" }),
  singleQuestion({ key: "python-sup-python-capstone-s1", stageKey: "python-data-project", topicKey: "python-capstone",
    stem: "在交付一个综合性的 Python 数据分析项目时，关于代码组织与文档，下列做法最专业的是？", options: ["把所有逻辑写进一个超长脚本，方便集中查看","按“数据接入 / 清洗 / 分析 / 可视化 / 报告”模块化拆分，并配套 README、环境依赖与运行说明","不写任何注释与文档，运行成功即可","仅在个人电脑上能跑，不关心依赖环境"], answer: "B",
    explanation: "专业交付强调可维护与可复现：将项目按职责拆分为清晰模块（如 etl、clean、analyze、visualize、report），各自职责单一、便于测试与复用；同时用 README 说明目标、目录结构与运行步骤，用依赖文件（requirements.txt / pyproject）锁定环境，并以示例数据与最小可运行入口降低他人接手成本。单文件巨脚本与无文档交付都不利于协作与长期维护。", difficulty: "hard", tags: ["项目交付","模块化"], sourceKey: "ms-data-science", level: "综合" }),
  judgeQuestion({ key: "python-sup-python-values-control-j1", stageKey: "python-foundation", topicKey: "python-values-control",
    stem: "在 Python 中，if 语句的条件表达式只要不是严格的布尔值 True，就一定会引发语法错误。", answer: false, explanation: "该命题错误。Python 的 if 条件并不要求必须是布尔类型，解释器会根据“真值测试”规则自动把任意对象转换为布尔值：非零数值、非空容器、非 None 对象都被视为真（True），只有 0、空容器、None 等假值被视为假（False）。因此 if x: 这样的写法完全合法，不会报错。",
    difficulty: "easy", tags: ["真值","控制流"], sourceKey: "exercism-python", level: "入门" }),
  judgeQuestion({ key: "python-sup-python-functions-j1", stageKey: "python-foundation", topicKey: "python-functions",
    stem: "使用 *args 接收可变位置参数时，args 在函数内部是一个元组（tuple），不能通过下标访问其中的元素。", answer: false, explanation: "该命题错误。*args 会把调用时多余的位置参数收集为一个普通的元组对象，而元组支持下标访问、迭代与 len() 等操作。例如 def f(*args): return args[0] 可以正确取回第一个传入的位置参数，因此“不能通过下标访问”的说法不成立。",
    difficulty: "easy", tags: ["函数","可变参数"], sourceKey: "exercism-python", level: "入门" }),
  judgeQuestion({ key: "python-sup-python-debug-j1", stageKey: "python-foundation", topicKey: "python-debug",
    stem: "在 except 块中捕获 Exception 等过于宽泛的异常类型，可以一次性解决所有错误，是值得推荐的健壮写法。", answer: false, explanation: "该命题错误。过宽地捕获 Exception（甚至 bare except）会掩盖包括 KeyboardInterrupt、SystemExit 在内的许多本应正常传播的信号，也会把真正的逻辑 bug 静默吞掉，使问题更难定位。工程上推荐只捕获“明确预期且能妥善处理”的具体异常类型，并在 finally 中释放资源。",
    difficulty: "easy", tags: ["异常","调试"], sourceKey: "exercism-python", level: "入门" }),
  judgeQuestion({ key: "python-sup-python-data-structures-j1", stageKey: "python-data-structures", topicKey: "python-collections",
    stem: "在工程实践中，选择数据结构时应优先考虑业务语义（如是否需要变更、是否用作映射键），而非单纯追求运行速度。", answer: true, explanation: "该命题正确。数据结构的选型首先要匹配语义：需要频繁增删且顺序不固定时宜用列表，需要键值映射时宜用字典，需要不可变或可哈希标识时宜用元组。单纯为微小幅度的性能差异而牺牲代码可读性与正确性，往往得不偿失；大多数场景下可读性优先，仅在性能剖析（profiling）确认瓶颈后才针对性优化。",
    difficulty: "easy", tags: ["数据结构","工程实践"], sourceKey: "exercism-python", level: "入门" }),
  judgeQuestion({ key: "python-sup-python-collections-j1", stageKey: "python-data-structures", topicKey: "python-collections",
    stem: "集合（set）中的元素必须是可哈希（hashable）的，因此集合内部不能包含另一个集合作为元素。", answer: true, explanation: "该命题正确。集合依靠元素的哈希值来去重与快速查找，因此集合元素本身必须可哈希（不可变）。而集合自身是可变对象、不可哈希，所以不能直接作为另一个集合的元素；若确实需要“集合的集合”，应使用 frozenset（不可变集合），它可哈希，能作为集合元素或字典键。",
    difficulty: "medium", tags: ["集合","可哈希"], sourceKey: "exercism-python", level: "进阶" }),
  judgeQuestion({ key: "python-sup-python-files-j1", stageKey: "python-data-structures", topicKey: "python-files",
    stem: "使用 json.load(f) 可以直接从一个已打开的文件对象读取 JSON，而 json.loads(s) 用于解析 JSON 格式字符串。", answer: true, explanation: "该命题正确。json 模块中，json.load(file_obj) 接收“文件对象”并从中读取并解析 JSON；json.loads(str) 的 “s” 代表 string，接收一个 JSON 文本字符串进行解析。二者职责分明：文件用 load、字符串用 loads，混用会触发类型错误。",
    difficulty: "easy", tags: ["JSON","文件"], sourceKey: "exercism-python", level: "入门" }),
  judgeQuestion({ key: "python-sup-python-testing-j1", stageKey: "python-data-structures", topicKey: "python-testing",
    stem: "编写单元测试时，把测试目标依赖的外部数据库替换为模拟对象（mock），有助于让测试稳定、快速且只验证被测逻辑。", answer: true, explanation: "该命题正确。单元测试应聚焦“被测单元自身的行为”，外部依赖（数据库、网络、时间等）会带来不确定性和速度下降。通过 mock/stub 替换这些依赖，可以让测试在隔离环境下确定地运行、快速失败并清晰暴露逻辑缺陷，是测试隔离（test isolation）的核心实践。",
    difficulty: "easy", tags: ["测试","mock"], sourceKey: "exercism-python", level: "入门" }),
  judgeQuestion({ key: "python-sup-python-oop-typing-j1", stageKey: "python-oop-typing", topicKey: "python-classes",
    stem: "类型标注（type hints）在 Python 运行时会强制校验变量类型，类型不符会直接抛出 TypeError。", answer: false, explanation: "该命题错误。Python 的类型标注（如 def f(x: int) -> str）在运行时仅作为注解存在，解释器不会据此强制校验或拒绝调用；类型不符不会在运行时报错，真正的类型检查需要借助静态分析工具（如 mypy、pyright）在开发阶段完成。因此类型标注主要服务于可读性、编辑器和静态检查，而非运行时强制约束。",
    difficulty: "medium", tags: ["类型系统","类型标注"], sourceKey: "exercism-python", level: "进阶" }),
  judgeQuestion({ key: "python-sup-python-classes-j1", stageKey: "python-oop-typing", topicKey: "python-classes",
    stem: "在 Python 中，类变量（定义在类作用域）被某个实例通过赋值修改后，会同步影响该类的所有其他实例。", answer: false, explanation: "该命题错误。当通过某个实例对属性赋值（如 inst.attr = 10）时，Python 会在“该实例自己的命名空间”中创建一个实例属性，从而遮蔽同名的类变量，而不会影响类变量本身，也不会改变其他实例所见的值。只有直接通过类（如 ClassName.attr = 10）修改类变量，才会让未遮蔽该属性的实例观察到变化。",
    difficulty: "easy", tags: ["类","类变量"], sourceKey: "exercism-python", level: "入门" }),
  judgeQuestion({ key: "python-sup-python-typing-j1", stageKey: "python-oop-typing", topicKey: "python-typing",
    stem: "使用 typing 中的 Optional[int] 表示该值可以是 int，也可以是 None；它等价于 Union[int, None]。", answer: true, explanation: "该命题正确。Optional[int] 是 Union[int, None] 的语义糖，表示该参数或返回值可能为 int，也可能为 None（典型场景是“查找未命中”或“可选配置”）。在编写函数签名（如 def find() -> Optional[int]）时，显式标注可空性能让调用方与类型检查器明确感知“空值”这一分支，减少漏判 None 导致的运行时错误。",
    difficulty: "medium", tags: ["类型标注","Optional"], sourceKey: "exercism-python", level: "进阶" }),
  judgeQuestion({ key: "python-sup-python-context-j1", stageKey: "python-oop-typing", topicKey: "python-context",
    stem: "自定义的 with 语句上下文管理器只需实现 __exit__ 方法即可，__enter__ 可有可无。", answer: false, explanation: "该命题错误。Python 的 with 语句依赖完整的上下文管理器协议：进入时调用 __enter__(self)（其返回值可被 as 绑定），退出时调用 __exit__(self, exc_type, exc, tb) 用于清理与异常传递。若只实现 __exit__ 而未实现 __enter__，该对象不满足上下文管理器协议，with 语句会抛出 AttributeError，无法正常工作。",
    difficulty: "medium", tags: ["上下文","生成器"], sourceKey: "exercism-python", level: "进阶" }),
  judgeQuestion({ key: "python-sup-python-data-project-j1", stageKey: "python-data-project", topicKey: "python-pandas",
    stem: "数据分析项目结束时，只要最终图表美观即可，无需记录数据来源、处理步骤与依赖版本等可复现信息。", answer: false, explanation: "该命题错误。可复现性（reproducibility）是数据分析交付的核心质量属性。仅追求图表美观而忽略数据来源、清洗规则、随机种子、依赖版本与运行环境，会导致他人（或未来的自己）无法复现结果，也无法审计结论。良好的项目应配套 README、环境锁定文件（如 requirements.txt）与清晰的步骤文档。",
    difficulty: "hard", tags: ["可复现","项目交付"], sourceKey: "ms-data-science", level: "综合" }),
  judgeQuestion({ key: "python-sup-python-pandas-j1", stageKey: "python-data-project", topicKey: "python-pandas",
    stem: "在 Pandas 中，对 DataFrame 做筛选时直接写 df[df[\"score\"] > 60] 这种布尔索引是合法且常用的写法。", answer: true, explanation: "该命题正确。Pandas 支持用“布尔 Series”作为行选择器进行向量化筛选：df[\"score\"] > 60 会产生一个与行对齐的真值 Series，df[布尔Series] 据此保留为 True 的行，返回新的 DataFrame。该写法无需逐行循环，既简洁又高效，是数据过滤的标准做法；注意比较结果需与 df 行索引对齐。",
    difficulty: "hard", tags: ["Pandas","布尔索引"], sourceKey: "ms-data-science", level: "综合" }),
  judgeQuestion({ key: "python-sup-python-visualization-j1", stageKey: "python-data-project", topicKey: "python-visualization",
    stem: "探索性可视化（EDA 阶段）的目标是快速发现数据模式、异常与变量关系，而非追求出版级精美的外观。", answer: true, explanation: "该命题正确。探索性数据分析（EDA）阶段的图表以“快速、低成本地发现结构、异常、缺失与相关性”为目的，应优先交互性与速度，外观可后续精炼。与之相对，解释性/交付可视化才需要兼顾美观、标注与叙事。把两者目标混淆，既拖慢探索又可能过度装饰掩盖问题。",
    difficulty: "medium", tags: ["可视化","EDA"], sourceKey: "ms-data-science", level: "进阶" }),
  judgeQuestion({ key: "python-sup-python-capstone-j1", stageKey: "python-data-project", topicKey: "python-capstone",
    stem: "综合项目交付时，只需保证代码在自己机器上能跑通即可，不必考虑可复现环境与结果可验证。", answer: false, explanation: "该命题错误。综合项目交付的价值在于“他人能复现并得到一致（或可解释差异）的结果”。仅本地能跑、缺乏依赖锁定与运行说明，意味着项目不可复现、不可审计，也无法作为协作或评估的有效交付物。负责任的交付应包含可复现环境、清晰入口、示例数据与验证方式，确保结论可信、过程可回溯。",
    difficulty: "hard", tags: ["项目交付","可复现"], sourceKey: "ms-data-science", level: "综合" }),];
