/**
 * 「菜鸟教程 · 编程语言」——来源：菜鸟教程 https://www.runoob.com/ 。
 *
 * 由 `scripts/runoob/crawl.mjs` + `scripts/runoob/generate.mjs` 自动生成 —— **请勿手改**，
 * 要改请改 `scripts/runoob/topics.mjs` 的标题目录（或抓取/解析层）后重跑。
 *
 * 阶段 7 个 · 知识点 38 个 · 题目 161 道。
 */
import type { LearningTrack } from "./types";

export const runoobLangTrack: LearningTrack = {
  slug: "rn-lang",
  title: "菜鸟教程 · 编程语言",
  category: "编程语言",
  level: "入门",
  accent: "#3C7DD9",
  softAccent: "#E8F1FC",
  icon: "code-slash-outline",
  summary: "菜鸟教程（runoob.com）Python 3 教程 / Java 教程 / C++ 教程 / C# 教程 / Go 教程 / PHP 教程 / ASP 教程 的系统整理：7 个教程、38 个知识点、161 道官方测验题。知识点保持站内阅读顺序，题按内容相似度归属到对应知识点。",
  whyLearn: "Python 3 教程、Java 教程、C++ 教程、C# 教程、Go 教程、PHP 教程、ASP 教程 是上手这些技术最常用的入门路径；菜鸟教程的示例短、能直接跑。本课程把它们按知识点重新编排，并为每个知识点配上官方测验题，形成「读一节 → 做这一节的题 → 回读错题」的闭环。",
  prerequisites: ["会使用浏览器或命令行", "能读写基本的代码片段", "愿意动手敲示例并跑通"],
  studyMethod: ["按知识点顺序读原文，先看示例再看结论。", "每读完一个知识点立刻做它的配套题，用正确率判断是否读懂。", "错题回到对应知识点复述一遍，并写下错因。"],
  estimatedHours: 37,
  featured: false,
  stages: [
    {
      key: "rn-python-stage",
      title: "Python 3 教程",
      weeks: "第 1 阶段",
      goal: "把「Python 3 教程」的 83 页内容按 7 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出Python 3 教程的典型用法，并把 30 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-python-1",
          title: "Python 简介、环境与基础语法",
          summary: "Python 简介、环境与基础语法（Python 3 教程）：Python 的 3.0 版本，常被称为 Python 3000，或简称 Py3k 本节含 8 页、4 道配套题。",
          concepts: [
            "Python 3 教程",
            "查看 Python 版本",
            "第一个Python3.x程序",
            "Python3 简介",
            "Python 发展历史",
            "Python 特点",
            "Python 应用",
            "Python 版本进度",
            "Python3 环境搭建",
            "Python3 下载"
          ],
          principles: [
            "Python 的 3.0 版本，常被称为 Python 3000，或简称 Py3k",
            "相对于 Python 的早期版本，这是一个较大的升级",
            "我们可以在命令窗口(Windows 使用 win+R 调出 cmd 运行框)使用以下命令查看我们使用的 Python 版本：",
            "对于大多数程序语言，第一个入门编程代码便是 \"Hello World",
            "\"，以下代码为使用 Python 输出 \"Hello World",
            "Python 是一个高层次的结合了解释性、编译性、互动性和面向对象的脚本语言",
            "Python 的设计具有很强的可读性，相比其他语言经常使用英文关键字，其他语言的一些标点符号，它具有比其他语言更有特色语法结构",
            "Python 是由 Guido van Rossum 在八十年代末和九十年代初，在荷兰国家数学和计算机科学研究所设计出来的"
          ],
          applications: [
            "示例：python -V",
            "示例：#!/usr/bin/python3",
            "示例：print(\"Runoob\")",
            "示例：brew install python3",
            "示例：python --version",
            "示例：sudo snap install pycharm-community --classic"
          ],
          pitfalls: [
            "注意：如果没有勾选 Add Python3.6 to PATH」，会导致命令行无法识别 python/python3 命令，需手动配置环境变量",
            "禁止 Python 运行时生成 .pyc / .pyo 字节码缓存文件",
            "当遇到字节串（bytes）与字符串（str）不兼容的比较操作时，发出警告信息",
            "当遇到字节串（bytes）与字符串（str）不兼容的比较操作时，直接抛出错误，终止程序运行",
            "禁用标准输出（stdout）和标准错误（stderr）的缓冲机制，实现日志或输出内容的实时打印"
          ],
          method: "按站内顺序读「Python 3 教程 → Python3 简介 → Python3 环境搭建 → Python VScode 配置 → Python PyCharm 安装使用 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 4 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Python 3 教程、查看 Python 版本、第一个Python3.x程序」的用法，并把 4 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Python 3 教程】Python 3 教程：Python 的 3.0 版本，常被称为 Python 3000，或简称 Py3k",
              "【Python 3 教程】查看 Python 版本：我们可以在命令窗口(Windows 使用 win+R 调出 cmd 运行框)使用以下命令查看我们使用的 Python 版本：",
              "【Python 3 教程】第一个Python3.x程序：对于大多数程序语言，第一个入门编程代码便是 \"Hello World",
              "【Python3 简介】Python3 简介：Python 是一个高层次的结合了解释性、编译性、互动性和面向对象的脚本语言",
              "【Python3 简介】Python 发展历史：Python 是由 Guido van Rossum 在八十年代末和九十年代初，在荷兰国家数学和计算机科学研究所设计出来的",
              "【Python3 简介】Python 特点：1.易于学习：Python有相对较少的关键字，结构简单，和一个明确定义的语法，学习起来更加简单"
            ],
            mechanism: [
              "Python 的 3.0 版本，常被称为 Python 3000，或简称 Py3k",
              "相对于 Python 的早期版本，这是一个较大的升级",
              "为了不带入过多的累赘，Python 3.0 在设计的时候没有考虑向下兼容",
              "Python 介绍及安装教程我们在Python 2.X 版本的教程中已有介绍，这里就不再赘述",
              "你也可以点击 Python2.x与3​​.x版本区别来查看两者的不同",
              "本教程主要针对 Python 3.x 版本的学习，如果你使用的是 Python 2.x 版本请移步至 Python 2.X 版本的教程",
              "官方宣布，2020 年 1 月 1 日，停止 Python 2 的更新",
              "我们可以在命令窗口(Windows 使用 win+R 调出 cmd 运行框)使用以下命令查看我们使用的 Python 版本：",
              "你也可以进入Python的交互式编程模式，查看版本：",
              "对于大多数程序语言，第一个入门编程代码便是 \"Hello World"
            ],
            example: {
              title: "Python3 基本数据类型 · bool（布尔类型）",
              language: "python",
              code: "# 布尔类型的值和类型\n\na = True\n\nb = False\n\nprint(type(a)) # <class 'bool'>\n\nprint(type(b)) # <class 'bool'>\n\n# 布尔类型的整数表现\n\nprint(int(True)) # 1\n\nprint(int(False)) # 0\n\n# 使用 bool() 函数进行转换\n\nprint(bool(0)) # False\n\nprint(bool(42)) # True\n\nprint(bool('')) # False\n\nprint(bool('Python')) # True\n\nprint(bool([])) # False\n\nprint(bool([1, 2, 3])) # True\n\n# 布尔逻辑运算\n\nprint(True and False) # False\n\nprint(True or False) # True\n\nprint(not True) # False\n\n# 布尔比较运算\n\nprint(5 > 3) # True\n\nprint(2 == 2) # True\n\nprint(7 < 4) # False\n\n# 布尔值在控制流中的应用\n\nif True:\n\nprint(\"This will always print\")\n\nif not False:\n\nprint(\"This will also always print\")\n\nx = 10\n\nif x:\n\nprint(\"x 是非零值，在布尔上下文中为 True\")",
              explanation: "布尔类型即 True 或 False"
            },
            practiceSteps: [
              "先通读本节 8 页：Python 3 教程、Python3 简介、Python3 环境搭建、Python VScode 配置 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 4 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Python 简介、环境与基础语法」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 4 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-python-2",
          title: "Python 基本数据类型与运算符",
          summary: "Python 基本数据类型与运算符（Python 3 教程）：Linux/Unix的系统上，一般默认的 python 版本为 2.x，我们可以将 python3.x 安装在 /usr/local/python3 目录中 本节含 12 页、5 道配套题。",
          concepts: [
            "Python3 解释器",
            "Python3 注释",
            "单行注释",
            "多行注释",
            "1、使用三个单引号",
            "2、使用三个双引号",
            "多行注释注意事项",
            "Docstring 文档字符串",
            "基本语法",
            "使用 help() 查看文档"
          ],
          principles: [
            "Linux/Unix的系统上，一般默认的 python 版本为 2.x，我们可以将 python3.x 安装在 /usr/local/python3 目录中",
            "安装完成后，我们可以将路径 /usr/local/python3/bin 添加到您的 Linux/Unix 操作系统的环境变量中，这样您就可以通过 shell 终端输入下面的命令来启动 Python3",
            "在 Python 中，注释不会影响程序的执行，但是会使代码更易于阅读和理解",
            "Python 中的注释有单行注释和多行注释",
            "Python 中单行注释以 # 开头，# 符号后面的所有文本都被视为注释，不会被解释器执行",
            "在 Python 中，多行字符串（由三个单引号 ''' 或三个双引号 \"\"\" 包围的文本块）可以用作多行注释",
            "注意：虽然多行字符串在这里被当作多行注释使用，但它实际上是一个字符串，我们只要不使用它，它不会影响程序的运行",
            "这些字符串在代码中可以被放置在一些位置，而不引起实际的执行，从而达到注释的效果"
          ],
          applications: [
            "示例：# 这是一个注释",
            "示例：#!/usr/bin/python3",
            "示例：'''",
            "示例：def add(a, b):",
            "示例：import inspect",
            "示例：def calculate(a, b, operation=\"add\"):"
          ],
          pitfalls: [
            "当键入一个多行结构时，续行是必须的",
            "注意：虽然多行字符串在这里被当作多行注释使用，但它实际上是一个字符串，我们只要不使用它，它不会影响程序的运行",
            "在 Python 中，多行注释是由三个单引号 ''' 或三个双引号 \"\"\" 来定义的，这种注释方式不能嵌套使用",
            "嵌套多行注释会导致语法错误：",
            "实例（错误示例）"
          ],
          method: "按站内顺序读「Python3 解释器 → Python3 注释 → Python3 运算符 → Python3 数字(Number) → Python3 列表 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 5 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Python3 解释器、Python3 注释、单行注释」的用法，并把 5 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Python3 解释器】Python3 解释器：Linux/Unix的系统上，一般默认的 python 版本为 2.x，我们可以将 python3.x 安装在 /usr/local/python3 目录中",
              "【Python3 注释】Python3 注释：在 Python 中，注释不会影响程序的执行，但是会使代码更易于阅读和理解",
              "【Python3 注释】单行注释：Python 中单行注释以 # 开头，# 符号后面的所有文本都被视为注释，不会被解释器执行",
              "【Python3 注释】多行注释：在 Python 中，多行字符串（由三个单引号 ''' 或三个双引号 \"\"\" 包围的文本块）可以用作多行注释",
              "【Python3 注释】1、使用三个单引号：实例",
              "【Python3 注释】2、使用三个双引号：注意：虽然多行字符串在这里被当作多行注释使用，但它实际上是一个字符串，我们只要不使用它，它不会影响程序的运行"
            ],
            mechanism: [
              "Linux/Unix的系统上，一般默认的 python 版本为 2.x，我们可以将 python3.x 安装在 /usr/local/python3 目录中",
              "安装完成后，我们可以将路径 /usr/local/python3/bin 添加到您的 Linux/Unix 操作系统的环境变量中，这样您就可以通过 shell 终端输入下面的命令来启动 Python3",
              "$ PATH=$PATH:/usr/local/python3/bin/python3 # 设置环境变量",
              "$ python3 --version",
              "在Window系统下你可以通过以下命令来设置Python的环境变量，假设你的Python安装在 C:\\Python34 下:",
              "set path=%path%;C:\\python34",
              "我们可以在命令提示符中输入\"Python\"命令来启动Python解释器：",
              "执行以上命令后，出现如下窗口信息：",
              "Python 3.4.0 (default, Apr 11 2014, 13:05:11)",
              "[GCC 4.8.2] on linux"
            ],
            example: {
              title: "Python3 字符串 · Python 转义字符",
              language: "python",
              code: "print('\\'Hello, world!\\'') # 输出：'Hello, world!'\n\nprint(\"Hello, world!\\nHow are you?\") # 输出：Hello, world!\n\n# How are you?\n\nprint(\"Hello, world!\\tHow are you?\") # 输出：Hello, world! How are you?\n\nprint(\"Hello,\\b world!\") # 输出：Hello world!\n\nprint(\"Hello,\\f world!\") # 输出：\n\n# Hello,\n\n# world!\n\nprint(\"A 对应的 ASCII 值为：\", ord('A')) # 输出：A 对应的 ASCII 值为： 65\n\nprint(\"\\x41 为 A 的 ASCII 代码\") # 输出：A 为 A 的 ASCII 代码\n\ndecimal_number = 42\n\nbinary_number = bin(decimal_number) # 十进制转换为二进制\n\nprint('转换为二进制:', binary_number) # 转换为二进制: 0b101010\n\noctal_number = oct(decimal_number) # 十进制转换为八进制\n\nprint('转换为八进制:', octal_number) # 转换为八进制: 0o52\n\nhexadecimal_number = hex(decimal_number) # 十进制转换为十六进制\n\nprint('转换为十六进制:', hexadecimal_number) # 转换为十六进制: 0x2a",
              explanation: "在需要在字符中使用特殊字符时，python 用反斜杠 \\ 转义字符"
            },
            practiceSteps: [
              "先通读本节 12 页：Python3 解释器、Python3 注释、Python3 运算符、Python3 数字(Number) 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 5 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Python 基本数据类型与运算符」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 5 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-python-3",
          title: "Python 流程控制与推导式",
          summary: "Python 流程控制与推导式（Python 3 教程）：Python 推导式是一种独特的数据处理方式，可以从一个数据序列构建另一个新的数据序列的结构体 本节含 15 页、5 道配套题。",
          concepts: [
            "Python 推导式",
            "列表推导式",
            "字典推导式",
            "集合推导式",
            "元组推导式（生成器表达式）",
            "Python3 迭代器与生成器",
            "迭代器",
            "创建一个迭代器",
            "StopIteration",
            "生成器"
          ],
          principles: [
            "Python 推导式是一种独特的数据处理方式，可以从一个数据序列构建另一个新的数据序列的结构体",
            "Python 推导式是一种强大且简洁的语法，适用于生成列表、字典、集合和生成器",
            "out_exp_res：列表生成元素表达式，可以是有返回值的函数",
            "使用字符串及其长度创建字典：",
            "计算数字 1,2,3 的平方数：",
            "元组推导式可以利用 range 区间、元组、列表、字典和集合等数据类型，快速生成一个满足指定需求的元组",
            "迭代是 Python 最强大的功能之一，是访问集合元素的一种方式",
            "迭代器是一个可以记住遍历的位置的对象"
          ],
          applications: [
            "示例：[表达式 for 变量 in 列表]",
            "示例：{ key_expr: value_expr for value in collection }",
            "示例：{ expression for item in Sequence }",
            "示例：(expression for item in Sequence )",
            "示例：>>> list=[1,2,3,4]",
            "示例：class MyNumbers:"
          ],
          pitfalls: [
            "在使用推导式时，需要注意可读性，尽量保持表达式简洁，以免影响代码的可读性和可维护性",
            "生成器函数的优势是它们可以按需生成值，避免一次性生成大量数据并占用大量内存",
            "1、错误地认为 with 只能用于文件：",
            "任何传入参数和自变量必须放在圆括号中间，圆括号之间可以用于定义参数",
            "python 中一切都是对象，严格意义我们不能说值传递还是引用传递，我们应该说传不可变对象和传可变对象"
          ],
          method: "按站内顺序读「Python 推导式 → Python3 迭代器与生成器 → Python with 关键字 → Python3 函数 → Python lambda（匿名函数） → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 5 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Python 推导式、列表推导式、字典推导式」的用法，并把 5 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Python 推导式】Python 推导式：Python 推导式是一种独特的数据处理方式，可以从一个数据序列构建另一个新的数据序列的结构体",
              "【Python 推导式】列表推导式：out_exp_res：列表生成元素表达式，可以是有返回值的函数",
              "【Python 推导式】字典推导式：使用字符串及其长度创建字典：",
              "【Python 推导式】集合推导式：计算数字 1,2,3 的平方数：",
              "【Python 推导式】元组推导式（生成器表达式）：元组推导式可以利用 range 区间、元组、列表、字典和集合等数据类型，快速生成一个满足指定需求的元组",
              "【Python3 迭代器与生成器】迭代器：迭代是 Python 最强大的功能之一，是访问集合元素的一种方式"
            ],
            mechanism: [
              "Python 推导式是一种独特的数据处理方式，可以从一个数据序列构建另一个新的数据序列的结构体",
              "Python 推导式是一种强大且简洁的语法，适用于生成列表、字典、集合和生成器",
              "在使用推导式时，需要注意可读性，尽量保持表达式简洁，以免影响代码的可读性和可维护性",
              "Python 支持各种数据结构的推导式：",
              "out_exp_res：列表生成元素表达式，可以是有返回值的函数",
              "for out_exp in input_list：迭代 input_list 将 out_exp 传入到 out_exp_res 表达式中",
              "if condition：条件语句，可以过滤列表中不符合条件的值",
              "过滤掉长度小于或等于3的字符串列表，并将剩下的转换成大写字母：",
              "计算 30 以内可以被 3 整除的整数：",
              "使用字符串及其长度创建字典："
            ],
            example: {
              title: "Python3 模块 · dir() 函数",
              language: "python",
              code: ">>> import fibo, sys\n>>> dir(fibo)\n['__name__', 'fib', 'fib2']\n>>> dir(sys)\n['__displayhook__', '__doc__', '__excepthook__', '__loader__', '__name__',\n'__package__', '__stderr__', '__stdin__', '__stdout__',\n'_clear_type_cache', '_current_frames', '_debugmallocstats', '_getframe',\n'_home', '_mercurial', '_xoptions', 'abiflags', 'api_version', 'argv',\n'base_exec_prefix', 'base_prefix', 'builtin_module_names', 'byteorder',\n'call_tracing', 'callstats', 'copyright', 'displayhook',\n'dont_write_bytecode', 'exc_info', 'excepthook', 'exec_prefix',\n'executable', 'exit', 'flags', 'float_info', 'float_repr_style',\n'getcheckinterval', 'getdefaultencoding', 'getdlopenflags',\n'getfilesystemencoding', 'getobjects', 'getprofile', 'getrecursionlimit',\n'getrefcount', 'getsizeof', 'getswitchinterval', 'gettotalrefcount',\n'gettrace', 'hash_info', 'hexversion', 'implementation', 'int_info',\n'intern', 'maxsize', 'maxunicode', 'meta_path', 'modules', 'path',\n'path_hooks', 'path_importer_cache', 'platform', 'prefix', 'ps1',\n'setcheckinterval', 'setdlopenflags', 'setprofile', 'setrecursionlimit',\n'setswitchinterval', 'settrace', 'stderr', 'stdin', 'stdout',\n'thread_info', 'version', 'version_info', 'warnoptions']",
              explanation: "内置的函数 dir() 可以找到模块内定义的所有名称"
            },
            practiceSteps: [
              "先通读本节 15 页：Python 推导式、Python3 迭代器与生成器、Python with 关键字、Python3 函数 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 5 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Python 流程控制与推导式」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 5 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-python-4",
          title: "Python 函数、迭代器与装饰器",
          summary: "Python 函数、迭代器与装饰器（Python 3 教程）：虚拟环境是一个独立的 Python 运行空间，拥有自己的解释器、安装包和配置，与系统全局环境完全隔离 本节含 7 页、4 道配套题。",
          concepts: [
            "Python 虚拟环境的创建（venv）",
            "Python 类型注解（Type Hints）",
            "为什么需要类型注解？",
            "基础语法详解",
            "变量注解",
            "函数注解",
            "参数默认值",
            "复杂类型注解",
            "列表、字典等容器类型",
            "可选类型（Optional）"
          ],
          principles: [
            "虚拟环境是一个独立的 Python 运行空间，拥有自己的解释器、安装包和配置，与系统全局环境完全隔离",
            "Python 虚拟环境（Virtual Environment）是一个独立的 Python 运行环境，它允许你在同一台机器上为不同的项目创建隔离的 Python 环境",
            "想象一下，你给朋友寄一个包裹",
            "如果你在包裹上写明\"易碎品\"和\"向上箭头\"，快递员就会知道要小心轻放、正确朝向",
            "Python 以其动态类型特性而闻名——你不需要提前声明变量的类型，解释器会在运行时自动推断",
            "这虽然灵活，但也带来了问题：",
            "从 Python 3.6 开始，你可以直接为变量添加类型注解：",
            "说明：name: str 读作\"变量 name 的类型是 str\""
          ],
          applications: [
            "示例：# 没有类型注解",
            "示例：# 没有类型注解的代码",
            "示例：# 没有类型注解的函数",
            "示例：def say_hello(name: str, times: int = 1) -> str:",
            "示例：from typing import List, Dict, Tuple, Set",
            "示例：from typing import Optional"
          ],
          pitfalls: [
            "避免污染：安装的包只影响当前环境，不污染全局 Python",
            "pip install virtualenv # 非必须，venv 通常够用",
            "注意：删除前请先执行 deactivate 退出环境，否则当前 Shell 会保留失效的环境变量",
            "虚拟环境内的脚本和配置文件中硬编码了绝对路径，移动后会失效",
            "每个项目独立一个环境：避免不同项目的依赖相互影响"
          ],
          method: "按站内顺序读「Python 虚拟环境的创建（venv） → Python 类型注解（Type Hints） → Python3 标准库概览 → Python3 实例 → Python3 正则表达式 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 4 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Python 虚拟环境的创建（venv）、Python 类型注解（Type Hints）、为什么需要类型注解？」的用法，并把 4 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Python 虚拟环境的创建（venv）】Python 虚拟环境的创建（venv）：虚拟环境是一个独立的 Python 运行空间，拥有自己的解释器、安装包和配置，与系统全局环境完全隔离",
              "【Python 类型注解（Type Hints）】Python 类型注解（Type Hints）：想象一下，你给朋友寄一个包裹",
              "【Python 类型注解（Type Hints）】为什么需要类型注解？：Python 以其动态类型特性而闻名——你不需要提前声明变量的类型，解释器会在运行时自动推断",
              "【Python 类型注解（Type Hints）】变量注解：从 Python 3.6 开始，你可以直接为变量添加类型注解：",
              "【Python 类型注解（Type Hints）】函数注解：在函数参数后加 : 类型",
              "【Python 类型注解（Type Hints）】参数默认值：你可以同时使用类型注解和默认值："
            ],
            mechanism: [
              "虚拟环境是一个独立的 Python 运行空间，拥有自己的解释器、安装包和配置，与系统全局环境完全隔离",
              "Python 虚拟环境（Virtual Environment）是一个独立的 Python 运行环境，它允许你在同一台机器上为不同的项目创建隔离的 Python 环境",
              "不同项目可以在各自的虚拟环境中并行运行，互不干扰",
              "全局安装（版本冲突）✓ 虚拟环境（完全隔离）全局 Python 环境site-packages（所有项目共享）项目 A需要 Django 3.2项目 B需要 Django 4.0版本冲突，无法共存项目 A.venv独立安装 Django 3.2项目 B.venv独立安装 Django 4.0",
              "虚拟环境让每个项目拥有独立的依赖空间，彻底消除版本冲突",
              "项目隔离：不同项目可使用不同版本的 Python 和第三方库",
              "避免污染：安装的包只影响当前环境，不污染全局 Python",
              "依赖可控：通过 requirements.txt 精确记录和复现环境",
              "安全测试：可以放心升级或试用新包，不影响其他项目",
              "项目 A 需要 Django 3.2 版本"
            ],
            example: {
              title: "Python3 正则表达式 · 实例",
              language: "python",
              code: ">>>import re\n>>> pattern = re.compile(r'([a-z]+) ([a-z]+)', re.I) # re.I 表示忽略大小写\n>>> m = pattern.match('Hello World Wide Web')\n>>> print( m ) # 匹配成功，返回一个 Match 对象\n<_sre.SRE_Match object at 0x10bea83e8>\n>>> m.group(0) # 返回匹配成功的整个子串\n'Hello World'\n>>> m.span(0) # 返回匹配成功的整个子串的索引\n(0, 11)\n>>> m.group(1) # 返回第一个分组匹配成功的子串\n'Hello'\n>>> m.span(1) # 返回第一个分组匹配成功的子串的索引\n(0, 5)\n>>> m.group(2) # 返回第二个分组匹配成功的子串\n'World'\n>>> m.span(2) # 返回第二个分组匹配成功的子串索引\n(6, 11)\n>>> m.groups() # 等价于 (m.group(1), m.group(2), ...)\n('Hello', 'World')\n>>> m.group(3) # 不存在第三个分组\nTraceback (most recent call last):\nFile \"<stdin>\", line 1, in <module>\nIndexError: no such group",
              explanation: "在上面，当匹配成功时返回一个 Match 对象，其中："
            },
            practiceSteps: [
              "先通读本节 7 页：Python 虚拟环境的创建（venv）、Python 类型注解（Type Hints）、Python3 标准库概览、Python3 实例 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 4 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Python 函数、迭代器与装饰器」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 4 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-python-5",
          title: "Python 数据结构与模块",
          summary: "Python 数据结构与模块（Python 3 教程）：Python 提供了两个级别访问的网络服务 本节含 12 页、5 道配套题。",
          concepts: [
            "Python3 网络编程",
            "什么是 Socket?",
            "socket()函数",
            "参数",
            "Socket 对象(内建)方法",
            "简单实例",
            "服务端",
            "客户端",
            "Python Internet 模块",
            "什么是 PyMySQL？"
          ],
          principles: [
            "Python 提供了两个级别访问的网络服务",
            "低级别的网络服务支持基本的 Socket，它提供了标准的 BSD Sockets API，可以访问底层操作系统Socket接口的全部方法",
            "Socket又称\"套接字\"，应用程序通常通过\"套接字\"向网络发出请求或者应答网络请求，使主机间或者一台计算机上的进程间可以通讯",
            "Python 中，我们用 socket() 函数来创建套接字，语法格式如下：",
            "family: 套接字家族可以是 AF_UNIX 或者 AF_INET",
            "type: 套接字类型可以根据是面向连接的还是非连接分为SOCK_STREAM或SOCK_DGRAM",
            "我们使用 socket 模块的 socket 函数来创建一个 socket 对象",
            "socket 对象可以通过调用其他函数来设置一个 socket 服务"
          ],
          applications: [
            "示例：socket.socket([family[, type[, proto]]])",
            "示例：#!/usr/bin/python3",
            "示例：$ pip3 install PyMySQL",
            "示例：# SQL删除记录语句",
            "示例：Exception",
            "示例：import smtplib"
          ],
          pitfalls: [
            "一般address的格式为元组（hostname,port），如果连接出错，返回socket.error错误",
            "如果 flag 为 False，则将套接字设为非阻塞模式，否则将套接字设为阻塞模式（默认值）",
            "注意：请确保您有root权限来安装上述模块",
            "安装的过程中可能会出现\"ImportError: No module named setuptools\"的错误提示，意思是你没有安装setuptools，你可以访问https://pypi.python.org/pypi/setuptools 找到各个系统的安装方法",
            "事务必须是使数据库从一个一致性状态变到另一个一致性状态"
          ],
          method: "按站内顺序读「Python3 网络编程 → Python3 MySQL 数据库连接 - PyMySQL 驱动 → Python3 SMTP发送邮件 → Python3 多线程 → Python3 XML 解析 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 5 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Python3 网络编程、什么是 Socket?、socket()函数」的用法，并把 5 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Python3 网络编程】Python3 网络编程：Python 提供了两个级别访问的网络服务",
              "【Python3 网络编程】什么是 Socket?：Socket又称\"套接字\"，应用程序通常通过\"套接字\"向网络发出请求或者应答网络请求，使主机间或者一台计算机上的进程间可以通讯",
              "【Python3 网络编程】socket()函数：Python 中，我们用 socket() 函数来创建套接字，语法格式如下：",
              "【Python3 网络编程】参数：family: 套接字家族可以是 AF_UNIX 或者 AF_INET",
              "【Python3 网络编程】Socket 对象(内建)方法：绑定地址（host,port）到套接字，在AF_INET下,以元组（host,port）的形式表示地址",
              "【Python3 网络编程】服务端：我们使用 socket 模块的 socket 函数来创建一个 socket 对象"
            ],
            mechanism: [
              "Python 提供了两个级别访问的网络服务",
              "低级别的网络服务支持基本的 Socket，它提供了标准的 BSD Sockets API，可以访问底层操作系统Socket接口的全部方法",
              "高级别的网络服务模块 SocketServer，它提供了服务器中心类，可以简化网络服务器的开发",
              "Socket又称\"套接字\"，应用程序通常通过\"套接字\"向网络发出请求或者应答网络请求，使主机间或者一台计算机上的进程间可以通讯",
              "Python 中，我们用 socket() 函数来创建套接字，语法格式如下：",
              "family: 套接字家族可以是 AF_UNIX 或者 AF_INET",
              "type: 套接字类型可以根据是面向连接的还是非连接分为SOCK_STREAM或SOCK_DGRAM",
              "proto: 一般不填默认为0.",
              "绑定地址（host,port）到套接字，在AF_INET下,以元组（host,port）的形式表示地址",
              "backlog指定在拒绝连接之前，操作系统可以挂起的最大连接数量"
            ],
            example: {
              title: "Python3 XML 解析 · Python 解析XML实例",
              language: "python",
              code: "#!/usr/bin/python3\n\nimport xml.sax\n\nclass MovieHandler( xml.sax.ContentHandler ):\n\ndef __init__(self):\n\nself.CurrentData = \"\"\n\nself.type = \"\"\n\nself.format = \"\"\n\nself.year = \"\"\n\nself.rating = \"\"\n\nself.stars = \"\"\n\nself.description = \"\"\n\n# 元素开始调用\n\ndef startElement(self, tag, attributes):\n\nself.CurrentData = tag\n\nif tag == \"movie\":\n\nprint (\"*****Movie*****\")\n\ntitle = attributes[\"title\"]\n\nprint (\"Title:\", title)\n\n# 元素结束调用\n\ndef endElement(self, tag):\n\nif self.CurrentData == \"type\":\n\nprint (\"Type:\", self.type)\n\nelif self.CurrentData == \"format\":\n\nprint (\"Format:\", self.format)\n\nelif self.CurrentData == \"year\":\n\nprint (\"Year:\", self.year)\n\nelif self.CurrentData == \"rating\":\n\nprint (\"Rating:\", self.rating)\n\nelif self.CurrentData == \"stars\":\n\nprint (\"Stars:\", self.stars)\n\nelif self.CurrentData == \"description\":\n\nprint (\"Description:\", self.description)\n\nself.CurrentData = \"\"\n\n# 读取字符时调用\n\ndef characters(self, content):\n\nif self.CurrentData == \"type\":\n\nself.type = content\n\nelif self.CurrentData == \"format\":\n\nself.format = content\n\nelif self.CurrentData == \"year\":\n\nself.year = content\n\nelif self.CurrentData == \"rating\":\n\nself.rating = content\n\nelif self.CurrentData == \"stars\":\n\nself.stars = content\n\nelif self.CurrentData == \"description\":\n\nself.description = content\n\nif ( __name__ == \"__main__\"):\n\n# 创建一个 XMLReader\n\nparser = xml.sax.make_parser()\n\n# 关闭命名空间\n\nparser.setFeature(xml.sax.handler.feature_namespaces, 0)\n\n# 重写 ContextHandler\n\nHandler = MovieHandler()\n\nparser.setContentHandler( Handler )\n\nparser.parse(\"movies.xml\")",
              explanation: "以上代码执行结果如下："
            },
            practiceSteps: [
              "先通读本节 12 页：Python3 网络编程、Python3 MySQL 数据库连接 - PyMySQL 驱动、Python3 SMTP发送邮件、Python3 多线程 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 5 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Python 数据结构与模块」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 5 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-python-6",
          title: "Python 面向对象、异常与文件",
          summary: "Python 面向对象、异常与文件（Python 3 教程）：Python math 模块提供了大量常用数学函数，可用于完成： 本节含 15 页、4 道配套题。",
          concepts: [
            "Python math 模块",
            "为什么使用 math 模块？",
            "Python math 模块使用示例",
            "math 模块常量",
            "math 模块函数",
            "版本兼容说明",
            "Python3 operator 模块",
            "运算符函数",
            "Python requests 模块",
            "requests 方法"
          ],
          principles: [
            "Python math 模块提供了大量常用数学函数，可用于完成：",
            "三角函数计算（sin / cos / tan）",
            "虽然 Python 自带许多基本运算符（如 +、-、*、/），但对于更复杂的数学计算，例如：",
            "返回欧拉数 (2.7182...)",
            "math.acos(x)",
            "返回 x 的反余弦，结果范围在 0 到 pi 之间",
            "以下函数为 Python 3.8+ / 3.9+ / 3.11+ 新增：",
            "math.comb()：Python 3.8+"
          ],
          applications: [
            "示例：import math",
            "示例：operator.lt(a, b)",
            "示例：# Python 实例",
            "示例：import requests",
            "示例：# 导入 requests 包",
            "示例：headers = {'User-Agent': 'Mozilla/5.0'} # 设置请求头"
          ],
          pitfalls: [
            "要使用 math 函数必须先导入：",
            "两个点必须具有相同的维度",
            "如果 x 为零，则返回 (0.0, 0) ，否则返回 0.5 <= abs(m) < 1",
            "检查两个值是否彼此接近，若 a 和 b 的值比较接近则返回 True，否则返回 False",
            "判断 x 是否有限，如果 x 既不是无穷大也不是 NaN，则返回 True ，否则返回 False"
          ],
          method: "按站内顺序读「Python math 模块 → Python3 operator 模块 → Python requests 模块 → Python random 模块 → Python OpenAI → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 4 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Python math 模块、为什么使用 math 模块？、Python math 模块使用示例」的用法，并把 4 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Python math 模块】Python math 模块：Python math 模块提供了大量常用数学函数，可用于完成：",
              "【Python math 模块】为什么使用 math 模块？：虽然 Python 自带许多基本运算符（如 +、-、*、/），但对于更复杂的数学计算，例如：",
              "【Python math 模块】Python math 模块使用示例：输出结果为：",
              "【Python math 模块】math 模块常量：返回欧拉数 (2.7182...)",
              "【Python math 模块】math 模块函数：math.acos(x)",
              "【Python math 模块】版本兼容说明：以下函数为 Python 3.8+ / 3.9+ / 3.11+ 新增："
            ],
            mechanism: [
              "Python math 模块提供了大量常用数学函数，可用于完成：",
              "三角函数计算（sin / cos / tan）",
              "对数与指数运算（log / exp / pow）",
              "取整与舍入（ceil / floor / trunc）",
              "组合排列与阶乘（comb / perm / factorial）",
              "距离与几何计算（dist / hypot / sqrt）",
              "它是 Python 进行数学运算最常用的标准库之一",
              "就需要借助 math 模块完成",
              "math 模块下的函数，返回值均为浮点数，除非另有明确说明",
              "如果你需要计算复数，请使用 cmath 模块中的同名函数"
            ],
            example: {
              title: "Python 量化 · 移动平均交叉策略回测",
              language: "python",
              code: "import yfinance as yf\n\nimport pandas as pd\n\nimport matplotlib.pyplot as plt\n\n# 获取股票数据\n\nsymbol = \"600519.SS\"\n\nstart_date = \"2021-01-01\"\n\nend_date = \"2023-01-01\"\n\ndata = yf.download(symbol, start=start_date, end=end_date)\n\n# 计算移动平均\n\ndata['SMA_50'] = data['Close'].rolling(window=50).mean()\n\ndata['SMA_200'] = data['Close'].rolling(window=200).mean()\n\n# 初始化交叉信号列\n\ndata['Signal'] = 0\n\n# 计算交叉信号\n\ndata.loc[data['SMA_50'] > data['SMA_200'], 'Signal'] = 1\n\ndata.loc[data['SMA_50'] < data['SMA_200'], 'Signal'] = -1\n\n# 计算每日收益率\n\ndata['Daily_Return'] = data['Close'].pct_change()\n\n# 计算策略信号的收益率（shift(1) 是为了避免未来数据的偏差）\n\ndata['Strategy_Return'] = data['Signal'].shift(1) * data['Daily_Return']\n\n# 计算累计收益\n\ndata['Cumulative_Return'] = (1 + data['Strategy_Return']).cumprod()\n\n# 输出策略表现\n\nstrategy_performance = {\n\n'Total Return': data['Cumulative_Return'].iloc[-1] - 1,\n\n'Annualized Return': (data['Cumulative_Return'].iloc[-1] ** (252 / len(data))) - 1,\n\n'Max Drawdown': (data['Cumulative_Return'] / data['Cumulative_Return'].cummax() - 1).min(),\n\n}\n\nprint(\"策略表现:\")\n\nfor key, value in strategy_performance.items():\n\nprint(f\"{key}: {value:.4f}\")\n\n# 绘制累计收益曲线\n\nplt.figure(figsize=(10, 6))\n\nplt.plot(data['Cumulative_Return'], label='Strategy Cumulative Return', color='b')\n\nplt.plot(data['Close'] / data['Close'].iloc[0], label='Stock Cumulative Return', color='g')\n\nplt.title(\"Cumulative Return of Strategy vs. Stock\")\n\nplt.xlabel(\"Date\")\n\nplt.ylabel(\"Cumulative Return\")\n\nplt.legend()\n\nplt.show()",
              explanation: "回测是在历史市场数据上模拟和评估一个交易策略的过程"
            },
            practiceSteps: [
              "先通读本节 15 页：Python math 模块、Python3 operator 模块、Python requests 模块、Python random 模块 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 4 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Python 面向对象、异常与文件」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 4 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-python-7",
          title: "Python 标准库与常用模块",
          summary: "Python 标准库与常用模块（Python 3 教程）：sys 是 Python 标准库中的一个模块，提供了与 Python 解释器及其环境交互的功能 本节含 14 页、3 道配套题。",
          concepts: [
            "Python sys 模块",
            "导入 sys 库",
            "sys 库的常用功能",
            "1. 命令行参数",
            "2. 程序退出",
            "3. 标准输入输出",
            "4. Python 版本信息",
            "5. 模块搜索路径",
            "sys 模块常用属性",
            "sys 模块常用方法"
          ],
          principles: [
            "sys 是 Python 标准库中的一个模块，提供了与 Python 解释器及其环境交互的功能",
            "通过 sys 库，你可以访问与 Python 解释器相关的变量和函数，例如命令行参数、标准输入输出、程序退出等",
            "在使用 sys 库之前，你需要先导入它",
            "sys.argv 是一个包含命令行参数的列表",
            "sys.argv[0] 是脚本的名称，后续元素是传递给脚本的参数",
            "sys.exit() 用于退出程序",
            "你可以传递一个整数作为退出状态码，通常 0 表示成功，非零值表示错误",
            "sys.stdin、sys.stdout 和 sys.stderr 分别代表标准输入、标准输出和标准错误流"
          ],
          applications: [
            "示例：import sys",
            "示例：import pickle",
            "示例：import subprocess",
            "示例：result = subprocess.run([\"echo\", \"Hello\"], capture_output=True, text=True)",
            "示例：from io import StringIO",
            "示例：# 创建一个 StringIO 对象"
          ],
          pitfalls: [
            "你可以传递一个整数作为退出状态码，通常 0 表示成功，非零值表示错误",
            "sys.stdin、sys.stdout 和 sys.stderr 分别代表标准输入、标准输出和标准错误流",
            "标准错误流（文件对象）",
            "将计算结果缓存到磁盘，避免重复计算",
            "安全性：pickle 模块在反序列化时会执行任意代码，因此不要加载来自不可信来源的 pickle 数据，以免遭受恶意攻击"
          ],
          method: "按站内顺序读「Python sys 模块 → Python Pickle 模块 → Python subprocess 模块 → Python StringIO 模块 → Python queue 模块 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Python sys 模块、导入 sys 库、sys 库的常用功能」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Python sys 模块】Python sys 模块：sys 是 Python 标准库中的一个模块，提供了与 Python 解释器及其环境交互的功能",
              "【Python sys 模块】导入 sys 库：在使用 sys 库之前，你需要先导入它",
              "【Python sys 模块】1. 命令行参数：sys.argv 是一个包含命令行参数的列表",
              "【Python sys 模块】2. 程序退出：sys.exit() 用于退出程序",
              "【Python sys 模块】3. 标准输入输出：sys.stdin、sys.stdout 和 sys.stderr 分别代表标准输入、标准输出和标准错误流",
              "【Python sys 模块】4. Python 版本信息：sys.version 和 sys.version_info 提供了当前 Python 解释器的版本信息"
            ],
            mechanism: [
              "sys 是 Python 标准库中的一个模块，提供了与 Python 解释器及其环境交互的功能",
              "通过 sys 库，你可以访问与 Python 解释器相关的变量和函数，例如命令行参数、标准输入输出、程序退出等",
              "在使用 sys 库之前，你需要先导入它",
              "sys.argv 是一个包含命令行参数的列表",
              "sys.argv[0] 是脚本的名称，后续元素是传递给脚本的参数",
              "sys.exit() 用于退出程序",
              "你可以传递一个整数作为退出状态码，通常 0 表示成功，非零值表示错误",
              "sys.stdin、sys.stdout 和 sys.stderr 分别代表标准输入、标准输出和标准错误流",
              "你可以重定向这些流以实现自定义的输入输出行为",
              "sys.version 和 sys.version_info 提供了当前 Python 解释器的版本信息"
            ],
            example: {
              title: "Python PyQt · 界面设计",
              language: "python",
              code: "import sys\n\nfrom PyQt5.QtWidgets import (QApplication, QMainWindow, QTextEdit,\n\nQAction, QFileDialog, QMessageBox)\n\nclass Notepad(QMainWindow):\n\ndef __init__(self):\n\nsuper().__init__()\n\nself.initUI()\n\ndef initUI(self):\n\nself.text_edit = QTextEdit(self)\n\nself.setCentralWidget(self.text_edit)\n\nself.create_actions()\n\nself.create_menus()\n\nself.setWindowTitle('简易记事本')\n\nself.setGeometry(100, 100, 800, 600)\n\ndef create_actions(self):\n\n# 文件菜单动作\n\nself.new_action = QAction('新建', self)\n\nself.new_action.setShortcut('Ctrl+N')\n\nself.new_action.triggered.connect(self.new_file)\n\nself.open_action = QAction('打开', self)\n\nself.open_action.setShortcut('Ctrl+O')\n\nself.open_action.triggered.connect(self.open_file)\n\nself.save_action = QAction('保存', self)\n\nself.save_action.setShortcut('Ctrl+S')\n\nself.save_action.triggered.connect(self.save_file)\n\nself.exit_action = QAction('退出', self)\n\nself.exit_action.setShortcut('Ctrl+Q')\n\nself.exit_action.triggered.connect(self.close)\n\n# 编辑菜单动作\n\nself.copy_action = QAction('复制', self)\n\nself.copy_action.setShortcut('Ctrl+C')\n\nself.copy_action.triggered.connect(self.text_edit.copy)\n\nself.paste_action = QAction('粘贴', self)\n\nself.paste_action.setShortcut('Ctrl+V')\n\nself.paste_action.triggered.connect(self.text_edit.paste)\n\nself.cut_action = QAction('剪切', self)\n\nself.cut_action.setShortcut('Ctrl+X')\n\nself.cut_action.triggered.connect(self.text_edit.cut)\n\ndef create_menus(self):\n\nmenubar = self.menuBar()\n\n# 文件菜单\n\nfile_menu = menubar.addMenu('文件')\n\nfile_menu.addAction(self.new_action)\n\nfile_menu.addAction(self.open_action)\n\nfile_menu.addAction(self.save_action)\n\nfile_me",
              explanation: "示例代码取自「Python PyQt」，可直接改参数观察输出差异。"
            },
            practiceSteps: [
              "先通读本节 14 页：Python sys 模块、Python Pickle 模块、Python subprocess 模块、Python StringIO 模块 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Python 标准库与常用模块」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-python-5",
        "rn-python-6",
        "rn-python-14",
        "rn-python-17",
        "rn-python-3",
        "rn-python-4",
        "rn-python-7",
        "rn-python-13",
        "rn-python-25",
        "rn-python-8",
        "rn-python-12",
        "rn-python-19",
        "rn-python-27",
        "rn-python-28",
        "rn-python-9",
        "rn-python-11",
        "rn-python-18",
        "rn-python-24",
        "rn-python-10",
        "rn-python-21",
        "rn-python-22",
        "rn-python-23",
        "rn-python-29",
        "rn-python-1",
        "rn-python-2",
        "rn-python-26",
        "rn-python-30",
        "rn-python-15",
        "rn-python-16",
        "rn-python-20"
      ],
      lesson: {
        overview: [
          "《Python 3 教程》取自菜鸟教程，共 83 页，整理为 7 个知识点、30 道配套测验题。",
          "知识点顺序保持站内阅读顺序：Python 简介、环境与基础语法 → Python 基本数据类型与运算符 → Python 流程控制与推导式 → Python 函数、迭代器与装饰器 → Python 数据结构与模块 → Python 面向对象、异常与文件 → Python 标准库与常用模块。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 30 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 Python 简介、环境与基础语法 并跑通示例",
            evidence: "本地示例输出与站点示例一致"
          },
          {
            title: "完成全部配套测验",
            evidence: "题正确率 ≥ 80%（共 30 道）"
          },
          {
            title: "能独立复述全部知识点",
            evidence: "不看文档说出每个知识点的用法与易错点"
          }
        ],
        completionCriteria: ["《Python 3 教程》7 个知识点全部读完。", "配套 30 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    },
    {
      key: "rn-java-stage",
      title: "Java 教程",
      weeks: "第 1 阶段",
      goal: "把「Java 教程」的 56 页内容按 5 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出Java 教程的典型用法，并把 20 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-java-1",
          title: "Java 入门、环境与基础语法",
          summary: "Java 入门、环境与基础语法（Java 教程）：Java 是由 Sun Microsystems 公司于 1995 年 5 月推出的 Java 面向对象程序设计语言和 Java 平台的总称 本节含 7 页、4 道配套题。",
          concepts: [
            "Java 简介",
            "主要特性",
            "发展历史",
            "Java 开发工具",
            "Java 开发环境配置",
            "window系统安装java",
            "下载JDK",
            "配置环境变量",
            "Java 教程",
            "我的第一个 JAVA 程序"
          ],
          principles: [
            "Java 是由 Sun Microsystems 公司于 1995 年 5 月推出的 Java 面向对象程序设计语言和 Java 平台的总称",
            "由 James Gosling和同事们共同研发，并在 1995 年正式推出",
            "Java 语言是简单的：",
            "Java 语言的语法与 C 语言和 C++ 语言很接近，使得大多数程序员很容易学习和使用",
            "1995 年 5 月 23 日，Java 语言诞生",
            "1996 年 1 月，第一个 JDK-JDK1.0 诞生",
            "Java 语言尽量保证系统内存在 1G 以上，其他工具如下所示：",
            "Linux 系统、Mac OS 系统、Windows 95/98/2000/XP，WIN 7/8系统"
          ],
          applications: [
            "示例：public class HelloWorld {",
            "示例：// 这是一个单行注释",
            "示例：/*",
            "示例：/**",
            "示例：class FreshJuice {",
            "示例：int myLocalVariable;"
          ],
          pitfalls: [
            "在 Java 语言中，线程是一种特殊的对象，它必须由 Thread 类或其子（孙）类来创建",
            "值得注意的是 Thread 类已经实现了 Runnable 接口，因此，任何一个线程均有它的 run 方法，而 run 方法中包含了线程所要运行的代码",
            "注意：如果使用 1.5 以上版本的 JDK，不用设置 CLASSPATH 环境变量，也可以正常编译和运行 Java 程序",
            "注意：在 Windows10 中，Path 变量里是分条显示的，我们需要将 %JAVA_HOME%\\bin;%JAVA_HOME%\\jre\\bin; 分开添加，否则无法识别：",
            "注：String args[] 与 String[] args 都可以执行，但推荐使用 String[] args，这样可以避免歧义和误读"
          ],
          method: "按站内顺序读「Java 简介 → Java 开发环境配置 → Java 教程 → Java 注释 → Java 对象和类 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 4 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Java 简介、主要特性、发展历史」的用法，并把 4 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Java 简介】Java 简介：Java 是由 Sun Microsystems 公司于 1995 年 5 月推出的 Java 面向对象程序设计语言和 Java 平台的总称",
              "【Java 简介】主要特性：Java 语言是简单的：",
              "【Java 简介】发展历史：1995 年 5 月 23 日，Java 语言诞生",
              "【Java 简介】Java 开发工具：Java 语言尽量保证系统内存在 1G 以上，其他工具如下所示：",
              "【Java 开发环境配置】Java 开发环境配置：在本章节中我们将为大家介绍如何搭建Java开发环境",
              "【Java 开发环境配置】下载JDK：首先我们需要下载 java 开发工具包 JDK，下载地址：https://www.oracle.com/java/technologies/downloads/，在下载页面中根据自己的系统选择对应的版本，本文以 Window 64位系统为例："
            ],
            mechanism: [
              "Java 是由 Sun Microsystems 公司于 1995 年 5 月推出的 Java 面向对象程序设计语言和 Java 平台的总称",
              "由 James Gosling和同事们共同研发，并在 1995 年正式推出",
              "后来 Sun 公司被 Oracle （甲骨文）公司收购，Java 也随之成为 Oracle 公司的产品",
              "JavaSE（J2SE）（Java2 Platform Standard Edition，java平台标准版）",
              "JavaEE(J2EE)(Java 2 Platform,Enterprise Edition，java平台企业版)",
              "JavaME(J2ME)(Java 2 Platform Micro Edition，java平台微型版)",
              "2005 年 6 月，JavaOne 大会召开，SUN 公司公开 Java SE 6",
              "此时，Java 的各种版本已经更名，以取消其中的数字 \"2\"：J2EE 更名为 Java EE，J2SE 更名为Java SE，J2ME 更名为 Java ME",
              "Java 语言的语法与 C 语言和 C++ 语言很接近，使得大多数程序员很容易学习和使用",
              "另一方面，Java 丢弃了 C++ 中很少使用的、很难理解的、令人迷惑的那些特性，如操作符重载、多继承、自动的强制类型转换"
            ],
            example: {
              title: "Java 基础语法 · 实例",
              language: "java",
              code: "class FreshJuice {\nenum FreshJuiceSize{ SMALL, MEDIUM , LARGE }\nFreshJuiceSize size;\n}\n\npublic class FreshJuiceTest {\npublic static void main(String[] args){\nFreshJuice juice = new FreshJuice();\njuice.size = FreshJuice.FreshJuiceSize.MEDIUM ;\n}\n}",
              explanation: "注意：枚举可以单独声明或者声明在类里面"
            },
            practiceSteps: [
              "先通读本节 7 页：Java 简介、Java 开发环境配置、Java 教程、Java 注释 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 4 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Java 入门、环境与基础语法」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 4 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-java-2",
          title: "Java 数据类型、运算符与流程控制",
          summary: "Java 数据类型、运算符与流程控制（Java 教程）：变量就是申请内存来存储值 本节含 13 页、3 道配套题。",
          concepts: [
            "Java 基本数据类型",
            "内置数据类型",
            "实例",
            "类型默认值",
            "引用类型",
            "Java 常量",
            "自动类型转换",
            "强制类型转换",
            "隐含强制类型转换",
            "Java 变量类型"
          ],
          principles: [
            "变量就是申请内存来存储值",
            "也就是说，当创建变量的时候，需要在内存中申请空间",
            "Java语言提供了八种基本类型",
            "六种数字类型（四个整数型，两个浮点型），一种字符类型，还有一种布尔型",
            "对于数值类型的基本类型的取值范围，我们无需强制去记忆，因为它们的值都已经以常量的形式定义在对应的包装类中了",
            "下表列出了 Java 各个类型的默认值：",
            "在Java中，引用类型的变量非常类似于C/C++的指针",
            "引用类型指向一个对象，指向对象的变量是引用变量"
          ],
          applications: [
            "示例：public class PrimitiveTypeTest {",
            "示例：public class Test {",
            "示例：final double PI = 3.1415927;",
            "示例：低 ------------------------------------> 高",
            "示例：public class ZiDongLeiZhuan{",
            "示例：type identifier [ = value][, identifier [= value] ...] ;"
          ],
          pitfalls: [
            "浮点数不能用来表示精确的值，如货币",
            "double类型同样不能表示精确的值，如货币",
            "变量一旦声明后，类型就不能被改变了",
            "常量在程序运行时是不能被修改的",
            "数据类型转换必须满足如下规则："
          ],
          method: "按站内顺序读「Java 基本数据类型 → Java 变量类型 → Java 修饰符 → Java 运算符 → Java 循环结构 - for, while 及 do...while → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Java 基本数据类型、内置数据类型、实例」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Java 基本数据类型】Java 基本数据类型：变量就是申请内存来存储值",
              "【Java 基本数据类型】内置数据类型：Java语言提供了八种基本类型",
              "【Java 基本数据类型】实例：对于数值类型的基本类型的取值范围，我们无需强制去记忆，因为它们的值都已经以常量的形式定义在对应的包装类中了",
              "【Java 基本数据类型】类型默认值：下表列出了 Java 各个类型的默认值：",
              "【Java 基本数据类型】引用类型：在Java中，引用类型的变量非常类似于C/C++的指针",
              "【Java 基本数据类型】Java 常量：常量在程序运行时是不能被修改的"
            ],
            mechanism: [
              "也就是说，当创建变量的时候，需要在内存中申请空间",
              "内存管理系统根据变量的类型为变量分配存储空间，分配的空间只能用来储存该类型数据",
              "因此，通过定义不同类型的变量，可以在内存中储存整数、小数或者字符",
              "Java语言提供了八种基本类型",
              "六种数字类型（四个整数型，两个浮点型），一种字符类型，还有一种布尔型",
              "byte 数据类型是8位、有符号的，以二进制补码表示的整数",
              "最小值是 -128（-2^7）",
              "最大值是 127（2^7-1）",
              "byte 类型用在大型数组中节约空间，主要代替整数，因为 byte 变量占用的空间只有 int 类型的四分之一",
              "例子：byte a = 100，byte b = -50"
            ],
            example: {
              title: "Java 基本数据类型 · 实例",
              language: "java",
              code: "public class PrimitiveTypeTest {\npublic static void main(String[] args) {\n// byte\nSystem.out.println(\"基本类型：byte 二进制位数：\" + Byte.SIZE);\nSystem.out.println(\"包装类：java.lang.Byte\");\nSystem.out.println(\"最小值：Byte.MIN_VALUE=\" + Byte.MIN_VALUE);\nSystem.out.println(\"最大值：Byte.MAX_VALUE=\" + Byte.MAX_VALUE);\nSystem.out.println();\n\n// short\nSystem.out.println(\"基本类型：short 二进制位数：\" + Short.SIZE);\nSystem.out.println(\"包装类：java.lang.Short\");\nSystem.out.println(\"最小值：Short.MIN_VALUE=\" + Short.MIN_VALUE);\nSystem.out.println(\"最大值：Short.MAX_VALUE=\" + Short.MAX_VALUE);\nSystem.out.println();\n\n// int\nSystem.out.println(\"基本类型：int 二进制位数：\" + Integer.SIZE);\nSystem.out.println(\"包装类：java.lang.Integer\");\nSystem.out.println(\"最小值：Integer.MIN_VALUE=\" + Integer.MIN_VALUE);\nSystem.out.println(\"最大值：Integer.MAX_VALUE=\" + Integer.MAX_VALUE);\nSystem.out.println();\n\n// long\nSystem.out.println(\"基本类型：long 二进制位数：\" + Long.SIZE);\nSystem.out.println(\"包装类：java.lang.Long\");\nSystem.out.println(\"最小值：Long.MIN_VALUE=\" + Long.MIN_VALUE);\nSystem.out.println(\"最大值：Long.MAX_VALUE=\" + Long.MAX_VALUE);\nSystem.out.println();\n\n// float\nSystem.out.println(\"基本类型：float 二进制位数：\" + Float.SIZE);\nSystem.out.println(\"包装类：java.lang.Float\");\nSystem.out.println(\"最小值：Float.MIN_VALUE=\" + Float.MIN_VALUE);\nSystem.out.println(\"最大值：Float.MAX_VALUE=\" + Float.MAX_VALUE);\nSystem.out.println();\n\n// double\nSystem.out.println(\"基本类型：double 二进制位数：\" + Double.SIZE);\nSystem.out.println(\"包装类：java.lang.Double\");\nSystem.out.println(\"最小值：Double.MIN_VALUE=\" + Double.MIN_VALUE);\nSystem.out.println(\"最大值：Double.MAX_VALUE=\" + Double.MAX_VALUE);\nSystem.out.println();\n\n// char\n",
              explanation: "对于数值类型的基本类型的取值范围，我们无需强制去记忆，因为它们的值都已经以常量的形式定义在对应的包装类中了"
            },
            practiceSteps: [
              "先通读本节 13 页：Java 基本数据类型、Java 变量类型、Java 修饰符、Java 运算符 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Java 数据类型、运算符与流程控制」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-java-3",
          title: "Java 面向对象与修饰符",
          summary: "Java 面向对象与修饰符（Java 教程）：正则表达式定义了字符串的模式 本节含 16 页、5 道配套题。",
          concepts: [
            "Java 正则表达式",
            "正则表达式实例",
            "java.util.regex 包",
            "捕获组",
            "实例",
            "正则表达式语法",
            "Matcher 类的方法",
            "索引方法",
            "查找方法",
            "替换方法"
          ],
          principles: [
            "正则表达式定义了字符串的模式",
            "正则表达式可以用来搜索、编辑或处理文本",
            "一个字符串其实就是一个简单的正则表达式，例如 Hello World 正则表达式匹配 \"Hello World\" 字符串",
            ".（点号）也是一个正则表达式，它匹配任何一个字符如：\"a\" 或 \"1\"",
            "java.util.regex 包是 Java 标准库中用于支持正则表达式操作的包",
            "java.util.regex 包主要包括以下三个类：",
            "捕获组是把多个字符当一个单独单元进行处理的方法，它通过对括号内的字符分组来创建",
            "例如，正则表达式 (dog) 创建了单一分组，组里包含\"d\"，\"o\"，和\"g\""
          ],
          applications: [
            "示例：import java.util.regex.*;",
            "示例：import java.util.regex.Matcher;",
            "示例：System.out.print(\"\\\\\"); // 输出为 \\",
            "示例：public class Person {",
            "示例：public Person(String name, int age) {",
            "示例：修饰符 返回值类型 方法名(参数类型 参数名){"
          ],
          pitfalls: [
            "注意字符串中的 \\s+",
            "要创建一个 Pattern 对象，你必须首先调用其公共静态编译方法，它返回一个 Pattern 对象",
            "PatternSyntaxException 是一个非强制异常类，它表示一个正则表达式模式中的语法错误",
            "在其他语言中，\\\\ 表示：我想要在正则表达式中插入一个普通的（字面上的）反斜杠，请不要给它任何特殊的意义",
            "注意：您不能将空格插入逗号和数字之间"
          ],
          method: "按站内顺序读「Java 正则表达式 → Java 构造方法 → Java 方法 → Java 流(Stream)、文件(File)和IO → Java Scanner 类 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 5 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Java 正则表达式、正则表达式实例、java.util.regex 包」的用法，并把 5 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Java 正则表达式】Java 正则表达式：正则表达式定义了字符串的模式",
              "【Java 正则表达式】正则表达式实例：一个字符串其实就是一个简单的正则表达式，例如 Hello World 正则表达式匹配 \"Hello World\" 字符串",
              "【Java 正则表达式】java.util.regex 包：java.util.regex 包是 Java 标准库中用于支持正则表达式操作的包",
              "【Java 正则表达式】捕获组：捕获组是把多个字符当一个单独单元进行处理的方法，它通过对括号内的字符分组来创建",
              "【Java 正则表达式】实例：下面的例子说明如何从一个给定的字符串中找到数字串：",
              "【Java 正则表达式】正则表达式语法：在其他语言中，\\\\ 表示：我想要在正则表达式中插入一个普通的（字面上的）反斜杠，请不要给它任何特殊的意义"
            ],
            mechanism: [
              "正则表达式定义了字符串的模式",
              "正则表达式可以用来搜索、编辑或处理文本",
              "正则表达式并不仅限于某一种语言，但是在每种语言中有细微的差别",
              "Java 提供了 java.util.regex 包，它包含了 Pattern 和 Matcher 类，用于处理正则表达式的匹配操作",
              "一个字符串其实就是一个简单的正则表达式，例如 Hello World 正则表达式匹配 \"Hello World\" 字符串",
              ".（点号）也是一个正则表达式，它匹配任何一个字符如：\"a\" 或 \"1\"",
              "下表列出了一些正则表达式的实例及描述：",
              "匹配字符串 \"this is text\"",
              "this\\s+is\\s+text",
              "匹配单词 \"this\" 后面的 \\s+ 可以匹配多个空格，之后匹配 is 字符串，再之后 \\s+ 匹配多个空格然后再跟上 text 字符串"
            ],
            example: {
              title: "Java 反射（Reflection） · 示例代码",
              language: "java",
              code: "import java.lang.reflect.Field;\n\nimport java.lang.reflect.Method;\n\nimport java.lang.reflect.Constructor;\n\npublic class ReflectionExample {\n\npublic static void main(String[] args) throws Exception {\n\n// 获取 Class 对象\n\nClass<?> clazz = Car.class;\n\n// 创建 Car 对象\n\nConstructor<?> constructor = clazz.getConstructor(String.class, int.class);\n\nObject car = constructor.newInstance(\"Toyota\", 2020);\n\n// 访问和修改字段\n\nField modelField = clazz.getDeclaredField(\"model\");\n\nField yearField = clazz.getDeclaredField(\"year\");\n\n// 设置字段为可访问（如果字段是私有的）\n\nmodelField.setAccessible(true);\n\nyearField.setAccessible(true);\n\n// 打印原始字段值\n\nSystem.out.println(\"Original Model: \" + modelField.get(car));\n\nSystem.out.println(\"Original Year: \" + yearField.get(car));\n\n// 修改字段值\n\nmodelField.set(car, \"Honda\");\n\nyearField.set(car, 2024);\n\n// 打印修改后的字段值\n\nSystem.out.println(\"Updated Model: \" + modelField.get(car));\n\nSystem.out.println(\"Updated Year: \" + yearField.get(car));\n\n// 调用方法\n\nMethod startMethod = clazz.getMethod(\"start\");\n\nstartMethod.invoke(car);\n\n}\n\n}\n\nclass Car {\n\nprivate String model;\n\nprivate int year;\n\npublic Car(String model, int year) {\n\nthis.model = model;\n\nthis.year = year;\n\n}\n\npublic void start() {\n\nSystem.out.println(\"The \" + model + \" car of year \" + year + \" is starting.\");\n\n}\n\n}",
              explanation: "以下是使用 java.lang.reflect 包进行反射操作的示例："
            },
            practiceSteps: [
              "先通读本节 16 页：Java 正则表达式、Java 构造方法、Java 方法、Java 流(Stream)、文件(File)和IO 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 5 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Java 面向对象与修饰符」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 5 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-java-4",
          title: "Java 常用类库与字符串处理",
          summary: "Java 常用类库与字符串处理（Java 教程）：早在 Java 2 中之前，Java 就提供了特设类 本节含 12 页、5 道配套题。",
          concepts: [
            "Java 集合框架",
            "集合框架体系如图所示",
            "集合接口",
            "Set和List的区别",
            "集合实现类（集合类）",
            "集合算法",
            "Java ArrayList",
            "添加元素",
            "访问元素",
            "修改元素"
          ],
          principles: [
            "早在 Java 2 中之前，Java 就提供了特设类",
            "比如：Dictionary, Vector, Stack, 和 Properties 这些类用来存储和操作对象组",
            "Java 集合框架提供了一套性能优良，使用方便的接口和类，java集合框架位于java.util包中，所以当使用集合框架的时候需要进行导包",
            "本节提供了每个接口的概述：",
            "1. Set 接口实例存储的是无序的，不重复的数据",
            "List 接口实例存储的是有序的，可以重复的元素",
            "Java提供了一套实现了Collection接口的标准集合类",
            "其中一些是具体类，这些类可以直接拿来使用，而另外一些是抽象类，提供了接口的部分实现"
          ],
          applications: [
            "示例：import java.util.ArrayList; // 引入 ArrayList 类",
            "示例：import java.util.ArrayList;",
            "示例：ArrayList<Integer> li=new ArrayList<>(); // 存放整数元素",
            "示例：// 引入 LinkedList 类",
            "示例：import java.util.HashSet; // 引入 HashSet 类",
            "示例：// 引入 HashSet 类"
          ],
          pitfalls: [
            "该框架必须是高性能的",
            "基本集合（动态数组，链表，树，哈希表）的实现也必须是高效的",
            "对一个集合的扩展和适应必须是简单的",
            "主要用于创建链表数据结构，该类没有同步方法，如果多个线程同时访问一个List，则必须自己实现访问同步，解决方法就是在创建List时候构造一个同步的List",
            "该类也是非同步的,在多线程的情况下不要使用"
          ],
          method: "按站内顺序读「Java 集合框架 → Java ArrayList → Java LinkedList → Java HashSet → Java HashMap → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 5 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Java 集合框架、集合框架体系如图所示、集合接口」的用法，并把 5 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Java 集合框架】Java 集合框架：早在 Java 2 中之前，Java 就提供了特设类",
              "【Java 集合框架】集合框架体系如图所示：Java 集合框架提供了一套性能优良，使用方便的接口和类，java集合框架位于java.util包中，所以当使用集合框架的时候需要进行导包",
              "【Java 集合框架】集合接口：本节提供了每个接口的概述：",
              "【Java 集合框架】Set和List的区别：1. Set 接口实例存储的是无序的，不重复的数据",
              "【Java 集合框架】集合实现类（集合类）：Java提供了一套实现了Collection接口的标准集合类",
              "【Java 集合框架】集合算法：集合框架定义了几种算法，可用于集合和映射"
            ],
            mechanism: [
              "早在 Java 2 中之前，Java 就提供了特设类",
              "比如：Dictionary, Vector, Stack, 和 Properties 这些类用来存储和操作对象组",
              "虽然这些类都非常有用，但是它们缺少一个核心的，统一的主题",
              "由于这个原因，使用 Vector 类的方式和使用 Properties 类的方式有着很大不同",
              "集合框架被设计成要满足以下几个目标",
              "基本集合（动态数组，链表，树，哈希表）的实现也必须是高效的",
              "该框架允许不同类型的集合，以类似的方式工作，具有高度的互操作性",
              "对一个集合的扩展和适应必须是简单的",
              "为此，整个集合框架就围绕一组标准接口而设计",
              "你可以直接使用这些接口的标准实现，诸如： LinkedList, HashSet, 和 TreeSet 等,除此之外你也可以通过这些接口实现自己的集合"
            ],
            example: {
              title: "Java 发送邮件 · 发送带有附件的 E-mail",
              language: "java",
              code: "// 文件名 SendFileEmail.java\n\nimport java.util.*;\nimport javax.mail.*;\nimport javax.mail.internet.*;\nimport javax.activation.*;\n\npublic class SendFileEmail\n{\npublic static void main(String [] args)\n{\n\n// 收件人电子邮箱\nString to = \"abcd@gmail.com\";\n\n// 发件人电子邮箱\nString from = \"web@gmail.com\";\n\n// 指定发送邮件的主机为 localhost\nString host = \"localhost\";\n\n// 获取系统属性\nProperties properties = System.getProperties();\n\n// 设置邮件服务器\nproperties.setProperty(\"mail.smtp.host\", host);\n\n// 获取默认的 Session 对象。\nSession session = Session.getDefaultInstance(properties);\n\ntry{\n// 创建默认的 MimeMessage 对象。\nMimeMessage message = new MimeMessage(session);\n\n// Set From: 头部头字段\nmessage.setFrom(new InternetAddress(from));\n\n// Set To: 头部头字段\nmessage.addRecipient(Message.RecipientType.TO,\nnew InternetAddress(to));\n\n// Set Subject: 头字段\nmessage.setSubject(\"This is the Subject Line!\");\n\n// 创建消息部分\nBodyPart messageBodyPart = new MimeBodyPart();\n\n// 消息\nmessageBodyPart.setText(\"This is message body\");\n\n// 创建多重消息\nMultipart multipart = new MimeMultipart();\n\n// 设置文本消息部分\nmultipart.addBodyPart(messageBodyPart);\n\n// 附件部分\nmessageBodyPart = new MimeBodyPart();\nString filename = \"file.txt\";\nDataSource source = new FileDataSource(filename);\nmessageBodyPart.setDataHandler(new DataHandler(source));\nmessageBodyPart.setFileName(filename);\nmultipart.addBodyPart(messageBodyPart);\n\n// 发送完整消息\nmessage.setContent(multipart );\n\n// 发送消息\nTransport.send(message);\nSystem.out.println(\"Sent message successfully....\");\n}catch (MessagingException mex) {\nmex.printStackTrace();\n}\n}\n}",
              explanation: "下面是一个发送带有附件的 E-mail的例子"
            },
            practiceSteps: [
              "先通读本节 12 页：Java 集合框架、Java ArrayList、Java LinkedList、Java HashSet 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 5 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Java 常用类库与字符串处理」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 5 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-java-5",
          title: "Java 集合框架、泛型与多线程",
          summary: "Java 集合框架、泛型与多线程（Java 教程）：Java 给多线程编程提供了内置的支持 本节含 8 页、3 道配套题。",
          concepts: [
            "Java 多线程编程",
            "一个线程的生命周期",
            "线程的优先级",
            "创建一个线程",
            "通过实现 Runnable 接口来创建线程",
            "Java Applet 基础",
            "Applet的生命周期",
            "\"Hello, World\" Applet:",
            "Applet 类",
            "Applet 的调用"
          ],
          principles: [
            "Java 给多线程编程提供了内置的支持",
            "一条线程指的是进程中一个单一顺序的控制流，一个进程中可以并发多个线程，每条线程并行执行不同的任务",
            "线程是一个动态执行的过程，它也有一个从产生到死亡的过程",
            "下图显示了一个线程完整的生命周期",
            "每一个 Java 线程都有一个优先级，这样有助于操作系统确定线程的调度顺序",
            "Java 线程的优先级是一个整数，其取值范围是 1 （Thread.MIN_PRIORITY ） - 10 （Thread.MAX_PRIORITY ）",
            "Java 提供了三种创建线程的方法：",
            "通过实现 Runnable 接口"
          ],
          applications: [
            "示例：import java.applet.*;",
            "示例：<html>",
            "示例：/*** 这个类绘制一个条形图",
            "示例：import java.io.*;",
            "示例：CREATE TABLE `websites` (",
            "示例：package com.runoob.test;"
          ],
          pitfalls: [
            "一个线程不能独立的存在，它必须是进程的一部分",
            "但是，线程优先级不能保证线程执行的顺序，而且非常依赖于平台",
            "继承类必须重写 run() 方法，该方法是新线程的入口点",
            "它也必须调用 start() 方法才能执行",
            "否则，该方法不执行任何操作并返回"
          ],
          method: "按站内顺序读「Java 多线程编程 → Java Applet 基础 → Java 文档注释 → Java 8 新特性 → Java 实例 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Java 多线程编程、一个线程的生命周期、线程的优先级」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Java 多线程编程】Java 多线程编程：Java 给多线程编程提供了内置的支持",
              "【Java 多线程编程】一个线程的生命周期：线程是一个动态执行的过程，它也有一个从产生到死亡的过程",
              "【Java 多线程编程】线程的优先级：每一个 Java 线程都有一个优先级，这样有助于操作系统确定线程的调度顺序",
              "【Java 多线程编程】创建一个线程：Java 提供了三种创建线程的方法：",
              "【Java 多线程编程】通过实现 Runnable 接口来创建线程：创建一个线程，最简单的方法是创建一个实现 Runnable 接口的类",
              "【Java Applet 基础】Java Applet 基础：Applet 是一种 Java 程序"
            ],
            mechanism: [
              "Java 给多线程编程提供了内置的支持",
              "一条线程指的是进程中一个单一顺序的控制流，一个进程中可以并发多个线程，每条线程并行执行不同的任务",
              "多线程是多任务的一种特别的形式，但多线程使用了更小的资源开销",
              "这里定义和线程相关的另一个术语 - 进程：一个进程包括由操作系统分配的内存空间，包含一个或多个线程",
              "一个线程不能独立的存在，它必须是进程的一部分",
              "一个进程一直运行，直到所有的非守护线程都结束运行后才能结束",
              "多线程能满足程序员编写高效率的程序来达到充分利用 CPU 的目的",
              "线程是一个动态执行的过程，它也有一个从产生到死亡的过程",
              "下图显示了一个线程完整的生命周期",
              "使用 new 关键字和 Thread 类或其子类建立一个线程对象后，该线程对象就处于新建状态"
            ],
            example: {
              title: "Java MySQL 连接 · 连接数据库",
              language: "java",
              code: "package com.runoob.test;\n\nimport java.sql.*;\n\npublic class MySQLDemo {\n\n// MySQL 8.0 以下版本 - JDBC 驱动名及数据库 URL\nstatic final String JDBC_DRIVER = \"com.mysql.jdbc.Driver\";\nstatic final String DB_URL = \"jdbc:mysql://localhost:3306/RUNOOB\";\n\n// MySQL 8.0 以上版本 - JDBC 驱动名及数据库 URL\n//static final String JDBC_DRIVER = \"com.mysql.cj.jdbc.Driver\";\n//static final String DB_URL = \"jdbc:mysql://localhost:3306/RUNOOB?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC\";\n\n// 数据库的用户名与密码，需要根据自己的设置\nstatic final String USER = \"root\";\nstatic final String PASS = \"123456\";\n\npublic static void main(String[] args) {\nConnection conn = null;\nStatement stmt = null;\ntry{\n// 注册 JDBC 驱动\nClass.forName(JDBC_DRIVER);\n\n// 打开链接\nSystem.out.println(\"连接数据库...\");\nconn = DriverManager.getConnection(DB_URL,USER,PASS);\n\n// 执行查询\nSystem.out.println(\" 实例化Statement对象...\");\nstmt = conn.createStatement();\nString sql;\nsql = \"SELECT id, name, url FROM websites\";\nResultSet rs = stmt.executeQuery(sql);\n\n// 展开结果集数据库\nwhile(rs.next()){\n// 通过字段检索\nint id = rs.getInt(\"id\");\nString name = rs.getString(\"name\");\nString url = rs.getString(\"url\");\n\n// 输出数据\nSystem.out.print(\"ID: \" + id);\nSystem.out.print(\", 站点名称: \" + name);\nSystem.out.print(\", 站点 URL: \" + url);\nSystem.out.print(\"\\n\");\n}\n// 完成后关闭\nrs.close();\nstmt.close();\nconn.close();\n}catch(SQLException se){\n// 处理 JDBC 错误\nse.printStackTrace();\n}catch(Exception e){\n// 处理 Class.forName 错误\ne.printStackTrace();\n}finally{\n// 关闭资源\ntry{\nif(stmt!=null) stmt.close();\n}catch(SQLException se2){\n}// 什么都不做\ntry{\nif(conn!=null) conn.close();\n}catch(SQLException se){\nse.printStackTrace();\n}\n}\nSy",
              explanation: "以下实例使用了 JDBC 连接 MySQL 数据库，注意一些数据如用户名，密码需要根据你的开发环境来配置："
            },
            practiceSteps: [
              "先通读本节 8 页：Java 多线程编程、Java Applet 基础、Java 文档注释、Java 8 新特性 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Java 集合框架、泛型与多线程」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-java-3",
        "rn-java-9",
        "rn-java-15",
        "rn-java-16",
        "rn-java-1",
        "rn-java-5",
        "rn-java-12",
        "rn-java-2",
        "rn-java-8",
        "rn-java-13",
        "rn-java-14",
        "rn-java-18",
        "rn-java-6",
        "rn-java-7",
        "rn-java-10",
        "rn-java-17",
        "rn-java-20",
        "rn-java-4",
        "rn-java-11",
        "rn-java-19"
      ],
      lesson: {
        overview: [
          "《Java 教程》取自菜鸟教程，共 56 页，整理为 5 个知识点、20 道配套测验题。",
          "知识点顺序保持站内阅读顺序：Java 入门、环境与基础语法 → Java 数据类型、运算符与流程控制 → Java 面向对象与修饰符 → Java 常用类库与字符串处理 → Java 集合框架、泛型与多线程。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 20 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 Java 入门、环境与基础语法 并跑通示例",
            evidence: "本地示例输出与站点示例一致"
          },
          {
            title: "完成全部配套测验",
            evidence: "题正确率 ≥ 80%（共 20 道）"
          },
          {
            title: "能独立复述全部知识点",
            evidence: "不看文档说出每个知识点的用法与易错点"
          }
        ],
        completionCriteria: ["《Java 教程》5 个知识点全部读完。", "配套 20 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    },
    {
      key: "rn-cpp-stage",
      title: "C++ 教程",
      weeks: "第 1 阶段",
      goal: "把「C++ 教程」的 99 页内容按 8 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出C++ 教程的典型用法，并把 20 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-cpp-1",
          title: "C++ 入门、环境与基本语法",
          summary: "C++ 入门、环境与基本语法（C++ 教程）：C++ 是一种静态类型的、编译式的、通用的、大小写敏感的、不规则的编程语言，支持过程化编程、面向对象编程和泛型编程 本节含 10 页、3 道配套题。",
          concepts: [
            "C++ 简介",
            "面向对象程序设计",
            "标准库",
            "ANSI 标准",
            "学习 C++",
            "C++ 的使用",
            "标准化",
            "C++ 环境设置",
            "文本编辑器",
            "更多相关工具"
          ],
          principles: [
            "C++ 是一种静态类型的、编译式的、通用的、大小写敏感的、不规则的编程语言，支持过程化编程、面向对象编程和泛型编程",
            "C++ 被认为是一种中级语言，它综合了高级语言和低级语言的特点",
            "C++ 完全支持面向对象的程序设计，包括面向对象开发的四大特性：",
            "封装（Encapsulation）：封装是将数据和方法组合在一起，对外部隐藏实现细节，只公开对外提供的接口",
            "标准的 C++ 由三个重要部分组成：",
            "核心语言，提供了所有构件块，包括变量、数据类型和常量，等等",
            "ANSI 标准是为了确保 C++ 的便携性 —— 您所编写的代码在 Mac、UNIX、Windows、Alpha 计算机上都能通过编译",
            "由于 ANSI 标准已稳定使用了很长的时间，所有主要的 C++ 编译器的制造商都支持 ANSI 标准"
          ],
          applications: [
            "示例：$ g++ -v",
            "示例：setup-x86_64.exe -q -P wget -P gcc-g++ -P make -P diffutils -P libmpfr-devel -P…",
            "示例：#include <iostream>",
            "示例：$ gcc main.cpp -lstdc++ -o main",
            "示例：$ g++ hello.cpp",
            "示例：x = y;"
          ],
          pitfalls: [
            "注意：使用静态类型的编程语言是在编译时执行类型检查，而不是在运行时执行类型检查",
            "这种安装，会碰到网络连接错误问题，所以我们可以直接下载 sjlj （稳定的，64 位和 32 位都支持）：",
            "这一选项将禁止 GNU C 的某些特色，",
            "禁止使用共享连接",
            "不生成任何警告信息"
          ],
          method: "按站内顺序读「C++ 简介 → C++ 环境设置 → C++ 教程 → C++ 基本语法 → C++ 注释 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「C++ 简介、面向对象程序设计、标准库」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【C++ 简介】C++ 简介：C++ 是一种静态类型的、编译式的、通用的、大小写敏感的、不规则的编程语言，支持过程化编程、面向对象编程和泛型编程",
              "【C++ 简介】面向对象程序设计：C++ 完全支持面向对象的程序设计，包括面向对象开发的四大特性：",
              "【C++ 简介】标准库：标准的 C++ 由三个重要部分组成：",
              "【C++ 简介】ANSI 标准：ANSI 标准是为了确保 C++ 的便携性 —— 您所编写的代码在 Mac、UNIX、Windows、Alpha 计算机上都能通过编译",
              "【C++ 简介】学习 C++：学习 C++，关键是要理解概念，而不应过于深究语言的技术细节",
              "【C++ 简介】C++ 的使用：C++ 语言在许多行业和领域都有广泛应用，包括："
            ],
            mechanism: [
              "C++ 是一种静态类型的、编译式的、通用的、大小写敏感的、不规则的编程语言，支持过程化编程、面向对象编程和泛型编程",
              "C++ 被认为是一种中级语言，它综合了高级语言和低级语言的特点",
              "C++ 是由 Bjarne Stroustrup 于 1979 年在新泽西州美利山贝尔实验室开始设计开发的，进一步扩充和完善了 C 语言，最初命名为带类的 C，后来在 1983 年更名为 C++",
              "C++ 是 C 的一个超集，事实上，任何合法的 C 程序都是合法的 C++ 程序",
              "注意：使用静态类型的编程语言是在编译时执行类型检查，而不是在运行时执行类型检查",
              "C++ 完全支持面向对象的程序设计，包括面向对象开发的四大特性：",
              "封装（Encapsulation）：封装是将数据和方法组合在一起，对外部隐藏实现细节，只公开对外提供的接口",
              "这样可以提高安全性、可靠性和灵活性",
              "继承（Inheritance）：继承是从已有类中派生出新类，新类具有已有类的属性和方法，并且可以扩展或修改这些属性和方法",
              "这样可以提高代码的复用性和可扩展性"
            ],
            example: {
              title: "C++ 数据类型 · C++11 新增类型",
              language: "cpp",
              code: "#include<iostream>\n#include <limits>\n\nusing namespace std;\n\nint main()\n{\ncout << \"type: \\t\\t\" << \"************size**************\"<< endl;\ncout << \"bool: \\t\\t\" << \"所占字节数：\" << sizeof(bool);\ncout << \"\\t最大值：\" << (numeric_limits<bool>::max)();\ncout << \"\\t\\t最小值：\" << (numeric_limits<bool>::min)() << endl;\ncout << \"char: \\t\\t\" << \"所占字节数：\" << sizeof(char);\ncout << \"\\t最大值：\" << (numeric_limits<char>::max)();\ncout << \"\\t\\t最小值：\" << (numeric_limits<char>::min)() << endl;\ncout << \"signed char: \\t\" << \"所占字节数：\" << sizeof(signed char);\ncout << \"\\t最大值：\" << (numeric_limits<signed char>::max)();\ncout << \"\\t\\t最小值：\" << (numeric_limits<signed char>::min)() << endl;\ncout << \"unsigned char: \\t\" << \"所占字节数：\" << sizeof(unsigned char);\ncout << \"\\t最大值：\" << (numeric_limits<unsigned char>::max)();\ncout << \"\\t\\t最小值：\" << (numeric_limits<unsigned char>::min)() << endl;\ncout << \"wchar_t: \\t\" << \"所占字节数：\" << sizeof(wchar_t);\ncout << \"\\t最大值：\" << (numeric_limits<wchar_t>::max)();\ncout << \"\\t\\t最小值：\" << (numeric_limits<wchar_t>::min)() << endl;\ncout << \"short: \\t\\t\" << \"所占字节数：\" << sizeof(short);\ncout << \"\\t最大值：\" << (numeric_limits<short>::max)();\ncout << \"\\t\\t最小值：\" << (numeric_limits<short>::min)() << endl;\ncout << \"int: \\t\\t\" << \"所占字节数：\" << sizeof(int);\ncout << \"\\t最大值：\" << (numeric_limits<int>::max)();\ncout << \"\\t最小值：\" << (numeric_limits<int>::min)() << endl;\ncout << \"unsigned: \\t\" << \"所占字节数：\" << sizeof(unsigned);\ncout << \"\\t最大值：\" << (numeric_limits<unsigned>::max)();\ncout << \"\\t最小值：\" << (numeric_limits<unsigned>::min)() << endl;\ncout << \"long: \\t\\t\" << \"所占字节数：\" << sizeof(long);\ncout << \"\\t最大值：\" << (numeric_limits<",
              explanation: "自动类型推断"
            },
            practiceSteps: [
              "先通读本节 10 页：C++ 简介、C++ 环境设置、C++ 教程、C++ 基本语法 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「C++ 入门、环境与基本语法」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-cpp-2",
          title: "C++ 数据类型、变量与运算符",
          summary: "C++ 数据类型、变量与运算符（C++ 教程）：存储类定义 C++ 程序中变量/函数的范围（可见性）和生命周期 本节含 12 页、3 道配套题。",
          concepts: [
            "C++ 存储类",
            "auto 存储类",
            "register 存储类",
            "static 存储类",
            "extern 存储类",
            "mutable 存储类",
            "thread_local 存储类",
            "C++ 运算符",
            "算术运算符",
            "实例"
          ],
          principles: [
            "存储类定义 C++ 程序中变量/函数的范围（可见性）和生命周期",
            "这些说明符放置在它们所修饰的类型之前",
            "自 C++ 11 以来，auto 关键字用于两种情况：声明变量时根据初始化表达式自动推断该变量的类型、声明函数时函数返回值的占位符",
            "C++98 标准中 auto 关键字用于自动变量的声明，但由于使用极少且多余，在 C++17 中已删除这一用法",
            "register 是一种存储类（storage class），用于声明变量，并提示编译器将这些变量存储在寄存器中，以便快速访问",
            "使用 register 关键字可以提高程序的执行速度，因为它减少了对内存的访问次数",
            "static 存储类指示编译器在程序的生命周期内保持局部变量的存在，而不需要在每次它进入和离开作用域时进行创建和销毁",
            "因此，使用 static 修饰局部变量可以在函数调用之间保持局部变量的值"
          ],
          applications: [
            "示例：#include <iostream>",
            "示例：auto f=3.14; //double",
            "示例：register data_type variable_name;",
            "示例：Exp1 ? Exp2 : Exp3;",
            "示例：return_type function_name( parameter list )",
            "示例：// 函数返回两个数中较大的那个数"
          ],
          pitfalls: [
            "然而，需要注意的是，register 存储类只是一种提示，编译器可以忽略它，因为现代的编译器通常会自动优化代码，选择合适的存储位置",
            "通常情况下，const 成员函数不能修改对象的状态，但如果某个成员变量被声明为 mutable，则可以在 const 函数中对其进行修改",
            "状态跟踪：如日志计数器，跟踪调用次数等信息，避免对类的逻辑进行侵入式修改",
            "thread_local 适合用于需要存储线程状态、缓存或者避免数据竞争的场景，如线程池、请求上下文等",
            "如果 Condition 为真 ? 则值为 X : 否则值为 Y"
          ],
          method: "按站内顺序读「C++ 存储类 → C++ 运算符 → C++ 循环 → C++ 判断 → C++ 函数 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「C++ 存储类、auto 存储类、register 存储类」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【C++ 存储类】C++ 存储类：存储类定义 C++ 程序中变量/函数的范围（可见性）和生命周期",
              "【C++ 存储类】auto 存储类：自 C++ 11 以来，auto 关键字用于两种情况：声明变量时根据初始化表达式自动推断该变量的类型、声明函数时函数返回值的占位符",
              "【C++ 存储类】register 存储类：register 是一种存储类（storage class），用于声明变量，并提示编译器将这些变量存储在寄存器中，以便快速访问",
              "【C++ 存储类】static 存储类：static 存储类指示编译器在程序的生命周期内保持局部变量的存在，而不需要在每次它进入和离开作用域时进行创建和销毁",
              "【C++ 存储类】extern 存储类：extern 存储类用于提供一个全局变量的引用，全局变量对所有的程序文件都是可见的",
              "【C++ 存储类】mutable 存储类：mutable 是一个关键字，用于修饰类的成员变量，使其能够在 const 成员函数中被修改"
            ],
            mechanism: [
              "存储类定义 C++ 程序中变量/函数的范围（可见性）和生命周期",
              "这些说明符放置在它们所修饰的类型之前",
              "下面列出 C++ 程序中可用的存储类：",
              "auto：这是默认的存储类说明符，通常可以省略不写",
              "auto 指定的变量具有自动存储期，即它们的生命周期仅限于定义它们的块（block）",
              "auto 变量通常在栈上分配",
              "register：用于建议编译器将变量存储在CPU寄存器中以提高访问速度",
              "在 C++11 及以后的版本中，register 已经是一个废弃的特性，不再具有实际作用",
              "static：用于定义具有静态存储期的变量或函数，它们的生命周期贯穿整个程序的运行期",
              "在函数内部，static变量的值在函数调用之间保持不变"
            ],
            example: {
              title: "C++ 运算符 · 实例",
              language: "cpp",
              code: "#include <iostream>\nusing namespace std;\n\nint main()\n{\nint a = 21;\nint c ;\n\nc = a;\ncout << \"Line 1 - = 运算符实例，c 的值 = : \" <<c<< endl ;\n\nc += a;\ncout << \"Line 2 - += 运算符实例，c 的值 = : \" <<c<< endl ;\n\nc -= a;\ncout << \"Line 3 - -= 运算符实例，c 的值 = : \" <<c<< endl ;\n\nc *= a;\ncout << \"Line 4 - *= 运算符实例，c 的值 = : \" <<c<< endl ;\n\nc /= a;\ncout << \"Line 5 - /= 运算符实例，c 的值 = : \" <<c<< endl ;\n\nc = 200;\nc %= a;\ncout << \"Line 6 - %= 运算符实例，c 的值 = : \" <<c<< endl ;\n\nc <<= 2;\ncout << \"Line 7 - <<= 运算符实例，c 的值 = : \" <<c<< endl ;\n\nc >>= 2;\ncout << \"Line 8 - >>= 运算符实例，c 的值 = : \" <<c<< endl ;\n\nc &= 2;\ncout << \"Line 9 - &= 运算符实例，c 的值 = : \" <<c<< endl ;\n\nc ^= 2;\ncout << \"Line 10 - ^= 运算符实例，c 的值 = : \" <<c<< endl ;\n\nc |= 2;\ncout << \"Line 11 - |= 运算符实例，c 的值 = : \" <<c<< endl ;\n\nreturn 0;\n}",
              explanation: "请看下面的实例，了解 C++ 中可用的赋值运算符"
            },
            practiceSteps: [
              "先通读本节 12 页：C++ 存储类、C++ 运算符、C++ 循环、C++ 判断 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「C++ 数据类型、变量与运算符」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-cpp-3",
          title: "C++ 流程控制、函数与数组",
          summary: "C++ 流程控制、函数与数组（C++ 教程）：C/C++ 数组允许定义可存储相同类型数据项的变量，但是结构是 C++ 中另一种用户自定义的可用的数据类型，它允许您存储不同类型的数据项 本节含 9 页、2 道配套题。",
          concepts: [
            "C++ 结构体(struct)",
            "定义结构",
            "访问结构成员",
            "结构作为函数参数",
            "结构体的各个部分详细介绍",
            "指向结构的指针",
            "typedef 关键字",
            "结构体与类的区别",
            "结构体与函数的结合",
            "C++ vector 容器"
          ],
          principles: [
            "C/C++ 数组允许定义可存储相同类型数据项的变量，但是结构是 C++ 中另一种用户自定义的可用的数据类型，它允许您存储不同类型的数据项",
            "结构用于表示一条记录，假设您想要跟踪图书馆中书本的动态，您可能需要跟踪每本书的下列属性：",
            "在 C++ 中，struct 语句用于定义结构体（structure）",
            "结构体是一种用户自定义的数据类型，用于将不同类型的数据组合在一起",
            "为了访问结构的成员，我们使用成员访问运算符（.）",
            "成员访问运算符是结构变量名称和我们要访问的结构成员之间的一个句号",
            "您可以把结构作为函数参数，传参方式与其他类型的变量或指针类似",
            "您可以使用上面实例中的方式来访问结构变量："
          ],
          applications: [
            "示例：struct type_name {",
            "示例：#include <iostream>",
            "示例：struct Books *struct_pointer;",
            "示例：typedef struct Books",
            "示例：struct Books {",
            "示例：[1][2][3][4][5]"
          ],
          pitfalls: [
            "为了定义结构，您必须使用 struct 语句",
            "为了使用指向该结构的指针访问结构的成员，您必须使用 -> 运算符，如下所示：",
            "你可以通过构造函数初始化结构体，还可以通过引用传递结构体来避免不必要的拷贝",
            "为了避免频繁扩容，可以提前分配内存：",
            "vector 扩容后，原来的内存地址可能失效"
          ],
          method: "按站内顺序读「C++ 结构体(struct) → C++ vector 容器 → C++ 数据结构 → C++ 类 & 对象 → C++ 继承 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 2 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「C++ 结构体(struct)、定义结构、访问结构成员」的用法，并把 2 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【C++ 结构体(struct)】C++ 结构体(struct)：C/C++ 数组允许定义可存储相同类型数据项的变量，但是结构是 C++ 中另一种用户自定义的可用的数据类型，它允许您存储不同类型的数据项",
              "【C++ 结构体(struct)】定义结构：在 C++ 中，struct 语句用于定义结构体（structure）",
              "【C++ 结构体(struct)】访问结构成员：为了访问结构的成员，我们使用成员访问运算符（.）",
              "【C++ 结构体(struct)】结构作为函数参数：您可以把结构作为函数参数，传参方式与其他类型的变量或指针类似",
              "【C++ 结构体(struct)】结构体的各个部分详细介绍：struct 关键字：用于定义结构体，它告诉编译器后面要定义的是一个自定义类型",
              "【C++ 结构体(struct)】指向结构的指针：您可以定义指向结构的指针，方式与定义指向其他类型变量的指针相似，如下所示："
            ],
            mechanism: [
              "C/C++ 数组允许定义可存储相同类型数据项的变量，但是结构是 C++ 中另一种用户自定义的可用的数据类型，它允许您存储不同类型的数据项",
              "结构用于表示一条记录，假设您想要跟踪图书馆中书本的动态，您可能需要跟踪每本书的下列属性：",
              "Book ID ：书的 ID",
              "在 C++ 中，struct 语句用于定义结构体（structure）",
              "结构体是一种用户自定义的数据类型，用于将不同类型的数据组合在一起",
              "与类（class）类似，结构体允许你定义成员变量和成员函数",
              "为了定义结构，您必须使用 struct 语句",
              "struct 语句定义了一个包含多个成员的新的数据类型，struct 语句的格式如下：",
              "type_name 是结构体类型的名称，member_type1 member_name1 是标准的变量定义，比如 int i; 或者 float f; 或者其他有效的变量定义",
              "在结构定义的末尾，最后一个分号之前，您可以指定一个或多个结构变量，这是可选的"
            ],
            example: {
              title: "C++ 重载运算符和重载函数 · C++ 中的运算符重载",
              language: "cpp",
              code: "#include <iostream>\nusing namespace std;\n\nclass Box\n{\npublic:\n\ndouble getVolume(void)\n{\nreturn length * breadth * height;\n}\nvoid setLength( double len )\n{\nlength = len;\n}\n\nvoid setBreadth( double bre )\n{\nbreadth = bre;\n}\n\nvoid setHeight( double hei )\n{\nheight = hei;\n}\n// 重载 + 运算符，用于把两个 Box 对象相加\nBox operator+(const Box& b)\n{\nBox box;\nbox.length = this->length + b.length;\nbox.breadth = this->breadth + b.breadth;\nbox.height = this->height + b.height;\nreturn box;\n}\nprivate:\ndouble length; // 长度\ndouble breadth; // 宽度\ndouble height; // 高度\n};\n// 程序的主函数\nint main( )\n{\nBox Box1; // 声明 Box1，类型为 Box\nBox Box2; // 声明 Box2，类型为 Box\nBox Box3; // 声明 Box3，类型为 Box\ndouble volume = 0.0; // 把体积存储在该变量中\n\n// Box1 详述\nBox1.setLength(6.0);\nBox1.setBreadth(7.0);\nBox1.setHeight(5.0);\n\n// Box2 详述\nBox2.setLength(12.0);\nBox2.setBreadth(13.0);\nBox2.setHeight(10.0);\n\n// Box1 的体积\nvolume = Box1.getVolume();\ncout << \"Volume of Box1 : \" << volume <<endl;\n\n// Box2 的体积\nvolume = Box2.getVolume();\ncout << \"Volume of Box2 : \" << volume <<endl;\n\n// 把两个对象相加，得到 Box3\nBox3 = Box1 + Box2;\n\n// Box3 的体积\nvolume = Box3.getVolume();\ncout << \"Volume of Box3 : \" << volume <<endl;\n\nreturn 0;\n}",
              explanation: "您可以重定义或重载大部分 C++ 内置的运算符"
            },
            practiceSteps: [
              "先通读本节 9 页：C++ 结构体(struct)、C++ vector 容器、C++ 数据结构、C++ 类 & 对象 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 2 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「C++ 流程控制、函数与数组」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 2 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-cpp-4",
          title: "C++ 指针、引用与字符串",
          summary: "C++ 指针、引用与字符串（C++ 教程）：接口描述了类的行为和功能，而不需要完成类的特定实现 本节含 18 页、3 道配套题。",
          concepts: [
            "C++ 接口（抽象类）",
            "抽象类的实例",
            "设计策略",
            "C++ 文件和流",
            "打开文件",
            "文件打开模式",
            "检查文件是否打开成功",
            "关闭文件",
            "写入文件",
            "追加写入文件"
          ],
          principles: [
            "接口描述了类的行为和功能，而不需要完成类的特定实现",
            "C++ 接口是使用抽象类来实现的，抽象类与数据抽象互不混淆，数据抽象是一个把实现细节与相关的数据分离开的概念",
            "请看下面的实例，基类 Shape 提供了一个接口 getArea()，在两个派生类 Rectangle 和 Triangle 中分别实现了 getArea()：",
            "当上面的代码被编译和执行时，它会产生下列结果：",
            "面向对象的系统可能会使用一个抽象基类为所有的外部应用程序提供一个适当的、通用的、标准化的接口",
            "然后，派生类通过继承抽象基类，就把所有类似的操作都继承下来",
            "在前面的章节中，我们使用过 C++ 标准库中的 cin 和 cout，分别从键盘读取数据和向屏幕输出内容",
            "除了标准输入输出，C++ 还支持文件操作，可以将数据保存到文件中，也可以从文件中读取已有的数据"
          ],
          applications: [
            "示例：class Box",
            "示例：#include <iostream>",
            "示例：#include &lt;fstream&gt;",
            "示例：std::ofstream outfile(\"example.txt\");",
            "示例：std::ofstream outfile;",
            "示例：outfile.close();"
          ],
          pitfalls: [
            "抽象类不能被用于实例化对象，它只能作为接口使用",
            "如果试图实例化一个抽象类的对象，会导致编译错误",
            "因此，如果一个 ABC 的子类需要被实例化，则必须实现每个纯虚函数，这也意味着 C++ 支持使用 ABC 声明接口",
            "如果没有在派生类中重写纯虚函数，就尝试实例化该类的对象，会导致编译错误",
            "以二进制模式打开文件，避免文本模式下的换行符等转换"
          ],
          method: "按站内顺序读「C++ 接口（抽象类） → C++ 文件和流 → C++ 异常处理 → C++ 动态内存 → C++ 命名空间 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「C++ 接口（抽象类）、抽象类的实例、设计策略」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【C++ 接口（抽象类）】C++ 接口（抽象类）：接口描述了类的行为和功能，而不需要完成类的特定实现",
              "【C++ 接口（抽象类）】抽象类的实例：请看下面的实例，基类 Shape 提供了一个接口 getArea()，在两个派生类 Rectangle 和 Triangle 中分别实现了 getArea()：",
              "【C++ 接口（抽象类）】设计策略：面向对象的系统可能会使用一个抽象基类为所有的外部应用程序提供一个适当的、通用的、标准化的接口",
              "【C++ 文件和流】C++ 文件和流：在前面的章节中，我们使用过 C++ 标准库中的 cin 和 cout，分别从键盘读取数据和向屏幕输出内容",
              "【C++ 文件和流】打开文件：在读取或写入文件之前，首先需要打开文件",
              "【C++ 文件和流】文件打开模式：C++ 提供了多种文件打开模式，可以根据需要进行选择"
            ],
            mechanism: [
              "接口描述了类的行为和功能，而不需要完成类的特定实现",
              "C++ 接口是使用抽象类来实现的，抽象类与数据抽象互不混淆，数据抽象是一个把实现细节与相关的数据分离开的概念",
              "如果类中至少有一个函数被声明为纯虚函数，则这个类就是抽象类",
              "纯虚函数是通过在声明中使用 \"= 0\" 来指定的，如下所示：",
              "设计抽象类（通常称为 ABC）的目的，是为了给其他类提供一个可以继承的适当的基类",
              "抽象类不能被用于实例化对象，它只能作为接口使用",
              "如果试图实例化一个抽象类的对象，会导致编译错误",
              "因此，如果一个 ABC 的子类需要被实例化，则必须实现每个纯虚函数，这也意味着 C++ 支持使用 ABC 声明接口",
              "如果没有在派生类中重写纯虚函数，就尝试实例化该类的对象，会导致编译错误",
              "可用于实例化对象的类被称为具体类"
            ],
            example: {
              title: "C++ 模板 · 类模板",
              language: "cpp",
              code: "#include <iostream>\n#include <vector>\n#include <cstdlib>\n#include <string>\n#include <stdexcept>\n\nusing namespace std;\n\ntemplate <class T>\nclass Stack {\nprivate:\nvector<T> elems; // 元素\n\npublic:\nvoid push(T const&); // 入栈\nvoid pop(); // 出栈\nT top() const; // 返回栈顶元素\nbool empty() const{ // 如果为空则返回真。\nreturn elems.empty();\n}\n};\n\ntemplate <class T>\nvoid Stack<T>::push (T const& elem)\n{\n// 追加传入元素的副本\nelems.push_back(elem);\n}\n\ntemplate <class T>\nvoid Stack<T>::pop ()\n{\nif (elems.empty()) {\nthrow out_of_range(\"Stack<>::pop(): empty stack\");\n}\n// 删除最后一个元素\nelems.pop_back();\n}\n\ntemplate <class T>\nT Stack<T>::top () const\n{\nif (elems.empty()) {\nthrow out_of_range(\"Stack<>::top(): empty stack\");\n}\n// 返回最后一个元素的副本\nreturn elems.back();\n}\n\nint main()\n{\ntry {\nStack<int> intStack; // int 类型的栈\nStack<string> stringStack; // string 类型的栈\n\n// 操作 int 类型的栈\nintStack.push(7);\ncout << intStack.top() <<endl;\n\n// 操作 string 类型的栈\nstringStack.push(\"hello\");\ncout << stringStack.top() << std::endl;\nstringStack.pop();\nstringStack.pop();\n}\ncatch (exception const& ex) {\ncerr << \"Exception: \" << ex.what() <<endl;\nreturn -1;\n}\n}",
              explanation: "正如我们定义函数模板一样，我们也可以定义类模板"
            },
            practiceSteps: [
              "先通读本节 18 页：C++ 接口（抽象类）、C++ 文件和流、C++ 异常处理、C++ 动态内存 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「C++ 指针、引用与字符串」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-cpp-5",
          title: "C++ 结构体、类与对象",
          summary: "C++ 结构体、类与对象（C++ 教程）：在 C++ 编程中，处理字符串和数字之间的转换是一项常见的任务 本节含 8 页、2 道配套题。",
          concepts: [
            "C++ 标准库 <sstream>",
            "定义",
            "语法",
            "实例",
            "从字符串读取数据",
            "向字符串写入数据",
            "使用stringstream进行读写操作",
            "总结",
            "C++ 标准库 <iomanip>",
            "1. 设置宽度"
          ],
          principles: [
            "在 C++ 编程中，处理字符串和数字之间的转换是一项常见的任务",
            "sstream 是 C++ 标准库中的一个组件，它提供了一种方便的方式来处理字符串流（可以像处理流一样处理字符串）",
            "sstream是 C++ 标准库中的一个命名空间，它包含了几个类，用于处理字符串流，这些类包括：",
            "istringstream：用于从字符串中读取数据",
            "使用sstream的基本语法如下：",
            "下面是一个使用 istringstream 从字符串中读取整数和浮点数的例子：",
            "下面是一个使用 ostringstream 将数据写入字符串的例子：",
            "下面是一个使用 stringstream 同时进行读取和写入操作的例子："
          ],
          applications: [
            "示例：#include <sstream>",
            "示例：#include <iostream>",
            "示例：#include <array>",
            "示例：#include <forward_list>"
          ],
          pitfalls: [
            "N 是数组的大小，必须是一个非负整数",
            "<array> 需要在编译时确定大小，不能动态改变",
            "类型安全：std::array 强制类型检查，避免了 C 语言数组的类型不安全问题",
            "固定大小：数组的大小在编译时确定，不能在运行时改变",
            "稳定，元素插入或删除不会失效"
          ],
          method: "按站内顺序读「C++ 标准库 <sstream> → C++ 标准库 <iomanip> → C++ 容器类 <array> → C++ 容器类 <vector> → C++ 容器类 <list> → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 2 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「C++ 标准库 <sstream>、定义、语法」的用法，并把 2 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【C++ 标准库 <sstream>】C++ 标准库 <sstream>：在 C++ 编程中，处理字符串和数字之间的转换是一项常见的任务",
              "【C++ 标准库 <sstream>】定义：sstream是 C++ 标准库中的一个命名空间，它包含了几个类，用于处理字符串流，这些类包括：",
              "【C++ 标准库 <sstream>】语法：使用sstream的基本语法如下：",
              "【C++ 标准库 <sstream>】从字符串读取数据：下面是一个使用 istringstream 从字符串中读取整数和浮点数的例子：",
              "【C++ 标准库 <sstream>】向字符串写入数据：下面是一个使用 ostringstream 将数据写入字符串的例子：",
              "【C++ 标准库 <sstream>】使用stringstream进行读写操作：下面是一个使用 stringstream 同时进行读取和写入操作的例子："
            ],
            mechanism: [
              "在 C++ 编程中，处理字符串和数字之间的转换是一项常见的任务",
              "sstream 是 C++ 标准库中的一个组件，它提供了一种方便的方式来处理字符串流（可以像处理流一样处理字符串）",
              "<sstream> 允许你将字符串当作输入/输出流来使用，这使得从字符串中读取数据或将数据写入字符串变得非常简单",
              "sstream是 C++ 标准库中的一个命名空间，它包含了几个类，用于处理字符串流，这些类包括：",
              "istringstream：用于从字符串中读取数据",
              "ostringstream：用于将数据写入字符串",
              "stringstream：是istringstream和ostringstream的组合，可以同时进行读取和写入操作",
              "使用sstream的基本语法如下：",
              "下面是一个使用 istringstream 从字符串中读取整数和浮点数的例子：",
              "下面是一个使用 ostringstream 将数据写入字符串的例子："
            ],
            example: {
              title: "C++ 容器类 <vector> · 实例",
              language: "cpp",
              code: "#include <iostream>\n\n#include <vector>\n\nint main() {\n\n// 声明一个存储整数的 vector\n\nstd::vector<int> numbers;\n\n// 添加元素\n\nnumbers.push_back(10);\n\nnumbers.push_back(20);\n\nnumbers.push_back(30);\n\n// 输出 vector 中的元素\n\nstd::cout << \"Vector contains: \";\n\nfor (int i = 0; i < numbers.size(); ++i) {\n\nstd::cout << numbers[i] << \" \";\n\n}\n\nstd::cout << std::endl;\n\n// 添加更多元素\n\nnumbers.push_back(40);\n\nnumbers.push_back(50);\n\n// 再次输出 vector 中的元素\n\nstd::cout << \"After adding more elements, vector contains: \";\n\nfor (int i = 0; i < numbers.size(); ++i) {\n\nstd::cout << numbers[i] << \" \";\n\n}\n\nstd::cout << std::endl;\n\n// 访问特定元素\n\nstd::cout << \"The first element is: \" << numbers[0] << std::endl;\n\n// 清空 vector\n\nnumbers.clear();\n\n// 检查 vector 是否为空\n\nif (numbers.empty()) {\n\nstd::cout << \"The vector is now empty.\" << std::endl;\n\n}\n\nreturn 0;\n\n}",
              explanation: "下面是一个使用 <vector> 的简单示例，包括输出结果"
            },
            practiceSteps: [
              "先通读本节 8 页：C++ 标准库 <sstream>、C++ 标准库 <iomanip>、C++ 容器类 <array>、C++ 容器类 <vector> 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 2 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「C++ 结构体、类与对象」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 2 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-cpp-6",
          title: "C++ 继承、多态与运算符重载",
          summary: "C++ 继承、多态与运算符重载（C++ 教程）：C++ 标准库中的 <queue> 头文件提供了队列（Queue）数据结构的实现 本节含 17 页、2 道配套题。",
          concepts: [
            "C++ 容器类 <queue>",
            "语法",
            "常用操作",
            "实例",
            "注意事项",
            "C++ 容器类 <priority_queue>",
            "自定义优先级",
            "C++ 容器类 <set>",
            "总结",
            "C++ 容器类 <unordered_set>"
          ],
          principles: [
            "C++ 标准库中的 <queue> 头文件提供了队列（Queue）数据结构的实现",
            "队列是一种先进先出（FIFO, First In First Out）的数据结构，它允许在一端添加元素（称为队尾），并在另一端移除元素（称为队首）",
            "在 C++ 中，队列的语法如下：",
            "这里 Type 是队列中存储元素的数据类型",
            "队列提供了以下常用操作：",
            "empty(): 检查队列是否为空",
            "下面是一个使用 C++ 标准库 <queue> 的简单实例：",
            "C++ 的 <queue> 标准库提供了一种方便的方式来实现队列数据结构"
          ],
          applications: [
            "示例：#include <queue>",
            "示例：#include <iostream>",
            "示例：#include <set>",
            "示例：#include <unordered_set>",
            "示例：#include <map>",
            "示例：#include <iostream>#include <map>"
          ],
          pitfalls: [
            "队列不允许随机访问元素，即不能直接通过索引访问队列中的元素",
            "<set> 容器中存储的元素类型必须满足以下条件：",
            "元素类型必须可以比较大小",
            "元素类型必须可以被复制和赋值",
            "哈希表的性能依赖于良好的哈希函数，以避免过多的哈希冲突"
          ],
          method: "按站内顺序读「C++ 容器类 <queue> → C++ 容器类 <priority_queue> → C++ 容器类 <set> → C++ 容器类 <unordered_set> → C++ 容器类 <map> → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 2 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「C++ 容器类 <queue>、语法、常用操作」的用法，并把 2 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【C++ 容器类 <queue>】C++ 容器类 <queue>：C++ 标准库中的 <queue> 头文件提供了队列（Queue）数据结构的实现",
              "【C++ 容器类 <queue>】语法：在 C++ 中，队列的语法如下：",
              "【C++ 容器类 <queue>】常用操作：队列提供了以下常用操作：",
              "【C++ 容器类 <queue>】实例：下面是一个使用 C++ 标准库 <queue> 的简单实例：",
              "【C++ 容器类 <queue>】注意事项：队列不允许随机访问元素，即不能直接通过索引访问队列中的元素",
              "【C++ 容器类 <priority_queue>】C++ 容器类 <priority_queue>：在 C++ 中，<priority_queue> 是标准模板库（STL）的一部分，用于实现优先队列"
            ],
            mechanism: [
              "C++ 标准库中的 <queue> 头文件提供了队列（Queue）数据结构的实现",
              "队列是一种先进先出（FIFO, First In First Out）的数据结构，它允许在一端添加元素（称为队尾），并在另一端移除元素（称为队首）",
              "队列是一种线性数据结构，它遵循以下规则：",
              "在 C++ 中，队列的语法如下：",
              "这里 Type 是队列中存储元素的数据类型",
              "empty(): 检查队列是否为空",
              "size(): 返回队列中的元素数量",
              "front(): 返回队首元素的引用",
              "back(): 返回队尾元素的引用",
              "push(): 在队尾添加一个元素"
            ],
            example: {
              title: "C++ 标准库 <string> · 实例",
              language: "cpp",
              code: "#include <iostream>\n\n#include <string>\n\nint main() {\n\nstd::string str = \"Hello, World!\";\n\n// size()\n\nstd::cout << \"Length: \" << str.size() << std::endl;\n\n// empty()\n\nstd::cout << \"Is empty? \" << (str.empty() ? \"Yes\" : \"No\") << std::endl;\n\n// operator[]\n\nstd::cout << \"First character: \" << str[0] << std::endl;\n\n// at()\n\nstd::cout << \"Character at position 7: \" << str.at(7) << std::endl;\n\n// substr()\n\nstd::string sub = str.substr(7, 5);\n\nstd::cout << \"Substring from position 7 with length 5: \" << sub << std::endl;\n\n// find()\n\nsize_t pos = str.find(\"World\");\n\nstd::cout << \"Position of 'World': \" << pos << std::endl;\n\n// replace()\n\nstr.replace(pos, 5, \"C++\");\n\nstd::cout << \"Modified string: \" << str << std::endl;\n\n// append()\n\nstr.append(\" How are you?\");\n\nstd::cout << \"Appended string: \" << str << std::endl;\n\n// insert()\n\nstr.insert(7, \" Beautiful\");\n\nstd::cout << \"String after insert: \" << str << std::endl;\n\n// erase()\n\nstr.erase(7, 10);\n\nstd::cout << \"String after erase: \" << str << std::endl;\n\n// clear()\n\nstr.clear();\n\nstd::cout << \"String after clear: \" << (str.empty() ? \"Empty\" : \"Not empty\") << std::endl;\n\n// c_str()\n\nstr = \"Hello, C++!\";\n\nconst char* cstr = str.c_str();\n\nstd::cout << \"C-style string: \" << cstr << std::endl;\n\n// compare()\n\nint cmp = str.compare(\"Hello, C++!\");\n\nstd::cout << \"Comparison result: \" << cmp << std::endl;\n\n// find_first_of()\n\nsize_t pos_first_vowel = str.find_first_of(\"aeiou\");\n\nstd::cout << \"First vowel at position: \" << pos_first_vowel << std::endl;\n\n// find_last_of()\n\nsize_t pos_last_vowel = str.find_last_of(\"aeiou\");\n\nstd::cout << \"Last vo",
              explanation: "下面是一个使用 <string> 库的简单实例，包括输出结果："
            },
            practiceSteps: [
              "先通读本节 17 页：C++ 容器类 <queue>、C++ 容器类 <priority_queue>、C++ 容器类 <set>、C++ 容器类 <unordered_set> 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 2 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「C++ 继承、多态与运算符重载」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 2 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-cpp-7",
          title: "C++ 模板、STL 与异常处理",
          summary: "C++ 模板、STL 与异常处理（C++ 教程）：C++11 引入了多线程支持，通过 <thread> 库，开发者可以轻松地在程序中实现并行处理 本节含 9 页、2 道配套题。",
          concepts: [
            "C++ 多线程库 <thread>",
            "C++ <thread> 库概述",
            "创建线程",
            "启动线程",
            "等待线程完成",
            "销毁线程",
            "实例：使用 <thread> 创建并行计算",
            "注意事项",
            "类和函数",
            "主要组件"
          ],
          principles: [
            "C++11 引入了多线程支持，通过 <thread> 库，开发者可以轻松地在程序中实现并行处理",
            "本文将将介绍 <thread> 库的基本概念、定义、语法以及如何使用它来创建和管理线程",
            "<thread> 库是 C++ 标准库的一部分，提供了创建和管理线程的基本功能，它包括以下几个关键组件：",
            "std::thread：表示一个线程，可以创建、启动、等待和销毁线程",
            "要创建一个线程，你需要实例化 std::thread 类，并传递一个可调用对象（函数、lambda 表达式或对象的成员函数）作为参数",
            "创建 std::thread 对象后，线程会立即开始执行，你可以调用 join() 方法来等待线程完成",
            "join() 方法会阻塞当前线程，直到被调用的线程完成执行",
            "当线程执行完毕后，你可以使用 detach() 方法来分离线程，或者让 std::thread 对象超出作用域自动销毁"
          ],
          applications: [
            "示例：#include <iostream>",
            "示例：t1.join();",
            "示例：t1.detach(); // 线程将继续运行，但无法再被 join 或 detach",
            "示例：#include <chrono>",
            "示例：auto now = std::chrono::system_clock::now();",
            "示例：auto duration = std::chrono::seconds(5);"
          ],
          pitfalls: [
            "线程安全：在多线程环境中，共享资源需要同步访问，以避免数据竞争",
            "线程生命周期：确保在线程执行完毕后正确地处理线程对象，避免资源泄露",
            "确保在每次锁定互斥锁后，都进行解锁操作，以避免死锁",
            "避免在持有互斥锁的情况下调用可能抛出异常的函数，因为这可能导致死锁",
            "通过使用互斥锁，我们可以确保对共享资源的访问是安全的，从而避免数据竞争和不一致的问题"
          ],
          method: "按站内顺序读「C++ 多线程库 <thread> → C++ 标准库 <chrono> → C++ 标准库 <mutex> → C++ 标准库 <condition_variable> → C++ 标准库 <future> → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 2 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「C++ 多线程库 <thread>、C++ <thread> 库概述、创建线程」的用法，并把 2 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【C++ 多线程库 <thread>】C++ 多线程库 <thread>：C++11 引入了多线程支持，通过 <thread> 库，开发者可以轻松地在程序中实现并行处理",
              "【C++ 多线程库 <thread>】C++ <thread> 库概述：<thread> 库是 C++ 标准库的一部分，提供了创建和管理线程的基本功能，它包括以下几个关键组件：",
              "【C++ 多线程库 <thread>】创建线程：要创建一个线程，你需要实例化 std::thread 类，并传递一个可调用对象（函数、lambda 表达式或对象的成员函数）作为参数",
              "【C++ 多线程库 <thread>】启动线程：创建 std::thread 对象后，线程会立即开始执行，你可以调用 join() 方法来等待线程完成",
              "【C++ 多线程库 <thread>】等待线程完成：join() 方法会阻塞当前线程，直到被调用的线程完成执行",
              "【C++ 多线程库 <thread>】销毁线程：当线程执行完毕后，你可以使用 detach() 方法来分离线程，或者让 std::thread 对象超出作用域自动销毁"
            ],
            mechanism: [
              "C++11 引入了多线程支持，通过 <thread> 库，开发者可以轻松地在程序中实现并行处理",
              "本文将将介绍 <thread> 库的基本概念、定义、语法以及如何使用它来创建和管理线程",
              "线程是程序执行的最小单元，是操作系统能够进行运算调度的最小单位",
              "在多线程程序中，多个线程可以并行执行，提高程序的执行效率",
              "<thread> 库是 C++ 标准库的一部分，提供了创建和管理线程的基本功能，它包括以下几个关键组件：",
              "std::thread：表示一个线程，可以创建、启动、等待和销毁线程",
              "std::this_thread：提供了一些静态成员函数，用于操作当前线程",
              "std::thread::id：线程的唯一标识符",
              "要创建一个线程，你需要实例化 std::thread 类，并传递一个可调用对象（函数、lambda 表达式或对象的成员函数）作为参数",
              "创建 std::thread 对象后，线程会立即开始执行，你可以调用 join() 方法来等待线程完成"
            ],
            example: {
              title: "C++ 标准库 <condition_variable> · 实例",
              language: "cpp",
              code: "#include <iostream>\n\n#include <condition_variable>\n\n#include <mutex>\n\n#include <queue>\n\n#include <thread>\n\nstd::mutex mtx;\n\nstd::condition_variable cv;\n\nstd::queue<int> product;\n\nvoid producer(int id) {\n\nfor (int i = 0; i < 5; ++i) {\n\nstd::unique_lock<std::mutex> lck(mtx);\n\nproduct.push(id * 100 + i);\n\nstd::cout << \"Producer \" << id << \" produced \" << product.back() << std::endl;\n\ncv.notify_one();\n\nlck.unlock();\n\nstd::this_thread::sleep_for(std::chrono::milliseconds(100));\n\n}\n\n}\n\nvoid consumer(int id) {\n\nwhile (true) {\n\nstd::unique_lock<std::mutex> lck(mtx);\n\ncv.wait(lck, []{ return !product.empty(); });\n\nif (!product.empty()) {\n\nint prod = product.front();\n\nproduct.pop();\n\nstd::cout << \"Consumer \" << id << \" consumed \" << prod << std::endl;\n\n}\n\nlck.unlock();\n\n}\n\n}\n\nint main() {\n\nstd::thread producers[2];\n\nstd::thread consumers[2];\n\nfor (int i = 0; i < 2; ++i) {\n\nproducers[i] = std::thread(producer, i + 1);\n\n}\n\nfor (int i = 0; i < 2; ++i) {\n\nconsumers[i] = std::thread(consumer, i + 1);\n\n}\n\nfor (int i = 0; i < 2; ++i) {\n\nproducers[i].join();\n\nconsumers[i].join();\n\n}\n\nreturn 0;\n\n}",
              explanation: "下面是一个使用condition_variable的简单示例，展示了生产者-消费者问题的基本实现"
            },
            practiceSteps: [
              "先通读本节 9 页：C++ 多线程库 <thread>、C++ 标准库 <chrono>、C++ 标准库 <mutex>、C++ 标准库 <condition_variable> 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 2 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「C++ 模板、STL 与异常处理」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 2 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-cpp-8",
          title: "C++ 标准库常用头文件",
          summary: "C++ 标准库常用头文件（C++ 教程）：<stdexcept> 是 C++ 标准库中的一个头文件，它定义了一组标准异常类，用于处理程序运行时的错误情况 本节含 16 页、3 道配套题。",
          concepts: [
            "C++ 异常处理库 <stdexcept>",
            "语法",
            "异常类",
            "实例",
            "标准异常类",
            "std::exception",
            "std::logic_error",
            "std::invalid_argument",
            "std::domain_error",
            "std::length_error"
          ],
          principles: [
            "<stdexcept> 是 C++ 标准库中的一个头文件，它定义了一组标准异常类，用于处理程序运行时的错误情况",
            "异常是程序运行时发生的错误，它们可以被捕获并处理，以避免程序的非正常终止",
            "要使用 <stdexcept> 中的异常类，首先需要包含这个头文件：",
            "然后，你可以使用这些异常类来抛出和捕获异常",
            "<stdexcept> 头文件定义了以下异常类：",
            "std::exception：所有标准异常类的基类",
            "下面是一个使用 <stdexcept> 的简单示例，演示了如何抛出和捕获异常：",
            "在这个示例中，riskyFunction 函数检查传入的参数是否为负数，如果是，则抛出 std::invalid_argument 异常"
          ],
          applications: [
            "示例：#include <stdexcept>",
            "示例：#include <iostream>",
            "示例：#include <cstdio>",
            "示例：#include <cstdint>",
            "示例：#include <memory>",
            "示例：<code class=\"language-cpp\">pointer new (type [, initializer]);</code>"
          ],
          pitfalls: [
            "<stdexcept> 是 C++ 标准库中的一个头文件，它定义了一组标准异常类，用于处理程序运行时的错误情况",
            "异常是程序运行时发生的错误，它们可以被捕获并处理，以避免程序的非正常终止",
            "<stdexcept> 头文件定义了一组从 std::exception 派生的异常类，这些类提供了一种标准的方式来报告和处理错误",
            "std::bad_exception：当异常处理过程中发生错误时抛出",
            "std::logic_error：当逻辑错误发生时抛出，例如无效的输入参数"
          ],
          method: "按站内顺序读「C++ 异常处理库 <stdexcept> → C++ 标准库 <cstdio> → C++ 标准库 <cstdint> → C++ 内存管理库 <memory> → C++ 内存管理库 <new> → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「C++ 异常处理库 <stdexcept>、语法、异常类」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【C++ 异常处理库 <stdexcept>】C++ 异常处理库 <stdexcept>：<stdexcept> 是 C++ 标准库中的一个头文件，它定义了一组标准异常类，用于处理程序运行时的错误情况",
              "【C++ 异常处理库 <stdexcept>】语法：要使用 <stdexcept> 中的异常类，首先需要包含这个头文件：",
              "【C++ 异常处理库 <stdexcept>】异常类：<stdexcept> 头文件定义了以下异常类：",
              "【C++ 异常处理库 <stdexcept>】实例：下面是一个使用 <stdexcept> 的简单示例，演示了如何抛出和捕获异常：",
              "【C++ 异常处理库 <stdexcept>】std::exception：std::exception 是所有标准异常类的基类",
              "【C++ 异常处理库 <stdexcept>】std::logic_error：std::logic_error 派生自 std::exception，表示程序逻辑错误"
            ],
            mechanism: [
              "<stdexcept> 是 C++ 标准库中的一个头文件，它定义了一组标准异常类，用于处理程序运行时的错误情况",
              "异常是程序运行时发生的错误，它们可以被捕获并处理，以避免程序的非正常终止",
              "<stdexcept> 头文件定义了一组从 std::exception 派生的异常类，这些类提供了一种标准的方式来报告和处理错误",
              "要使用 <stdexcept> 中的异常类，首先需要包含这个头文件：",
              "然后，你可以使用这些异常类来抛出和捕获异常",
              "<stdexcept> 头文件定义了以下异常类：",
              "std::exception：所有标准异常类的基类",
              "std::bad_exception：当异常处理过程中发生错误时抛出",
              "std::bad_alloc：当内存分配失败时抛出",
              "std::bad_cast：当类型转换失败时抛出"
            ],
            example: {
              title: "C++ 标准库 utility · 案例 3：实现简单的字典",
              language: "cpp",
              code: "#include <utility>\n\n#include <vector>\n\n#include <iostream>\n\n#include <algorithm>\n\nclass SimpleDictionary {\n\nprivate:\n\nstd::vector<std::pair<std::string, std::string>> entries;\n\npublic:\n\nvoid addWord(const std::string& word, const std::string& meaning) {\n\nentries.emplace_back(word, meaning);\n\n}\n\nstd::pair<bool, std::string> findMeaning(const std::string& word) {\n\nfor (const auto& [w, m] : entries) {\n\nif (w == word) {\n\nreturn std::make_pair(true, m);\n\n}\n\n}\n\nreturn std::make_pair(false, \"\");\n\n}\n\nvoid printAll() {\n\nfor (const auto& [word, meaning] : entries) {\n\nstd::cout << word << \": \" << meaning << std::endl;\n\n}\n\n}\n\n};\n\nvoid dictionaryExample() {\n\nSimpleDictionary dict;\n\ndict.addWord(\"apple\", \"一种水果\");\n\ndict.addWord(\"book\", \"用于阅读的物体\");\n\nauto result = dict.findMeaning(\"apple\");\n\nif (result.first) {\n\nstd::cout << \"含义: \" << result.second << std::endl;\n\n}\n\n}",
              explanation: "示例代码取自「C++ 标准库 utility」，可直接改参数观察输出差异。"
            },
            practiceSteps: [
              "先通读本节 16 页：C++ 异常处理库 <stdexcept>、C++ 标准库 <cstdio>、C++ 标准库 <cstdint>、C++ 内存管理库 <memory> 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「C++ 标准库常用头文件」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-cpp-1",
        "rn-cpp-6",
        "rn-cpp-9",
        "rn-cpp-5",
        "rn-cpp-17",
        "rn-cpp-18",
        "rn-cpp-10",
        "rn-cpp-20",
        "rn-cpp-2",
        "rn-cpp-13",
        "rn-cpp-19",
        "rn-cpp-11",
        "rn-cpp-15",
        "rn-cpp-3",
        "rn-cpp-4",
        "rn-cpp-14",
        "rn-cpp-16",
        "rn-cpp-7",
        "rn-cpp-8",
        "rn-cpp-12"
      ],
      lesson: {
        overview: [
          "《C++ 教程》取自菜鸟教程，共 99 页，整理为 8 个知识点、20 道配套测验题。",
          "知识点顺序保持站内阅读顺序：C++ 入门、环境与基本语法 → C++ 数据类型、变量与运算符 → C++ 流程控制、函数与数组 → C++ 指针、引用与字符串 → C++ 结构体、类与对象 → C++ 继承、多态与运算符重载 → C++ 模板、STL 与异常处理 → C++ 标准库常用头文件。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 20 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 C++ 入门、环境与基本语法 并跑通示例",
            evidence: "本地示例输出与站点示例一致"
          },
          {
            title: "完成全部配套测验",
            evidence: "题正确率 ≥ 80%（共 20 道）"
          },
          {
            title: "能独立复述全部知识点",
            evidence: "不看文档说出每个知识点的用法与易错点"
          }
        ],
        completionCriteria: ["《C++ 教程》8 个知识点全部读完。", "配套 20 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    },
    {
      key: "rn-csharp-stage",
      title: "C# 教程",
      weeks: "第 1 阶段",
      goal: "把「C# 教程」的 42 页内容按 4 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出C# 教程的典型用法，并把 30 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-csharp-1",
          title: "C# 入门、环境与程序结构",
          summary: "C# 入门、环境与程序结构（C# 教程）：C# 是一个简单的、现代的、通用的、面向对象的编程语言，它是由微软（Microsoft）开发的 本节含 8 页、8 道配套题。",
          concepts: [
            "C# 教程",
            "谁适合阅读本教程？",
            "阅读本教程前，您需要了解的知识：",
            "编译/执行 C# 程序",
            "C# 有用的网站",
            "C# 简介",
            "C# 能做什么？",
            "C# 和 .NET 是什么关系？",
            "C# 和其他语言相比怎么样？",
            "C# 适合初学者吗？"
          ],
          principles: [
            "C# 是一个简单的、现代的、通用的、面向对象的编程语言，它是由微软（Microsoft）开发的",
            "本教程将告诉您基础的 C# 编程，同时将向您讲解 C# 编程语言相关的各种先进理念",
            "本教程有助于初学者理解基础的 C# 编程",
            "在学习完本教程后，您将到达一个中级的 C# 编程水平",
            "C# 编程是基于 C 和 C++ 编程语言的，因此如果您对 C 和 C++ 编程有基本的了解，将有助于您学习 C# 编程语言",
            "菜鸟教程提供了在线的 C# 在线编译环境，您只需进行简单的点击动作，即可在高端的服务器上体验真实的编程经验",
            "C# Programming Guide - 介绍了有关关键的 C# 语言特征以及如何通过 .NET 框架访问 C# 的详细信息",
            "Visual Studio - 下载作为 C# 集成开发环境的 Visual Studio 的最新版本"
          ],
          applications: [
            "示例：using System;",
            "示例：dotnet --version",
            "示例：dotnet new console -n HelloWorld",
            "示例：/* 这个程序演示",
            "示例：object obj;",
            "示例：dynamic <variable_name> = value;"
          ],
          pitfalls: [
            "对比 C/C++：C# 语法上借鉴了 C 和 C++ 的风格（大括号、分号等），但屏蔽了指针操作和手动内存管理，入门更安全，不容易犯内存相关的低级错误",
            "语法清晰：代码结构工整，逻辑一目了然，不像 C++ 那样充满\"陷阱\"",
            "工具链完善：配合 Visual Studio 或 VS Code，代码补全、错误提示、调试工具一应俱全，写代码效率极高",
            "泛型（Generics）：编写类型安全、可复用的通用代码，避免重复劳动，使用方式简单直观",
            "你用 C# 写好的程序，必须依赖 .NET 才能在电脑上运行"
          ],
          method: "按站内顺序读「C# 教程 → C# 简介 → C# 开发环境 → C# 程序结构 → C# 基本语法 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 8 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「C# 教程、谁适合阅读本教程？、阅读本教程前，您需要了解的知识：」的用法，并把 8 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【C# 教程】C# 教程：C# 是一个简单的、现代的、通用的、面向对象的编程语言，它是由微软（Microsoft）开发的",
              "【C# 教程】谁适合阅读本教程？：本教程有助于初学者理解基础的 C# 编程",
              "【C# 教程】阅读本教程前，您需要了解的知识：：C# 编程是基于 C 和 C++ 编程语言的，因此如果您对 C 和 C++ 编程有基本的了解，将有助于您学习 C# 编程语言",
              "【C# 教程】编译/执行 C# 程序：菜鸟教程提供了在线的 C# 在线编译环境，您只需进行简单的点击动作，即可在高端的服务器上体验真实的编程经验",
              "【C# 教程】C# 有用的网站：C# Programming Guide - 介绍了有关关键的 C# 语言特征以及如何通过 .NET 框架访问 C# 的详细信息",
              "【C# 简介】C# 简介：C#（读作\"C Sharp\"）是一门由微软开发的编程语言"
            ],
            mechanism: [
              "C# 是一个简单的、现代的、通用的、面向对象的编程语言，它是由微软（Microsoft）开发的",
              "本教程将告诉您基础的 C# 编程，同时将向您讲解 C# 编程语言相关的各种先进理念",
              "本教程有助于初学者理解基础的 C# 编程",
              "在学习完本教程后，您将到达一个中级的 C# 编程水平",
              "C# 编程是基于 C 和 C++ 编程语言的，因此如果您对 C 和 C++ 编程有基本的了解，将有助于您学习 C# 编程语言",
              "菜鸟教程提供了在线的 C# 在线编译环境，您只需进行简单的点击动作，即可在高端的服务器上体验真实的编程经验",
              "C# Programming Guide - 介绍了有关关键的 C# 语言特征以及如何通过 .NET 框架访问 C# 的详细信息",
              "Visual Studio - 下载作为 C# 集成开发环境的 Visual Studio 的最新版本",
              "Go Mono - Mono 是一个允许开发人员简单地创建跨平台应用程序的软件平台",
              "C Sharp (programming language) - 维基百科解释 C#（编程语言）"
            ],
            example: {
              title: "C# 类型转换 · 自定义类型转换",
              language: "csharp",
              code: "using System;\n\npublic class Fahrenheit\n\n{\n\npublic double Degrees { get; set; }\n\npublic Fahrenheit(double degrees)\n\n{\n\nDegrees = degrees;\n\n}\n\n// 隐式转换从Fahrenheit到double\n\npublic static implicit operator double(Fahrenheit f)\n\n{\n\nreturn f.Degrees;\n\n}\n\n// 显式转换从double到Fahrenheit\n\npublic static explicit operator Fahrenheit(double d)\n\n{\n\nreturn new Fahrenheit(d);\n\n}\n\n}\n\npublic class Program\n\n{\n\npublic static void Main()\n\n{\n\nFahrenheit f = new Fahrenheit(98.6);\n\nConsole.WriteLine(\"Fahrenheit object: \" + f.Degrees + \" degrees\");\n\ndouble temp = f; // 隐式转换\n\nConsole.WriteLine(\"After implicit conversion to double: \" + temp + \" degrees\");\n\nFahrenheit newF = (Fahrenheit)temp; // 显式转换\n\nConsole.WriteLine(\"After explicit conversion back to Fahrenheit: \" + newF.Degrees + \" degrees\");\n\n}\n\n}",
              explanation: "C# 还允许你定义自定义类型转换操作，通过在类型中定义 implicit 或 explicit 关键字"
            },
            practiceSteps: [
              "先通读本节 8 页：C# 教程、C# 简介、C# 开发环境、C# 程序结构 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 8 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「C# 入门、环境与程序结构」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 8 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-csharp-2",
          title: "C# 数据类型、运算符与流程控制",
          summary: "C# 数据类型、运算符与流程控制（C# 教程）：在 C# 中，变量的作用域定义了变量的可见性和生命周期 本节含 16 页、8 道配套题。",
          concepts: ["C# 变量作用域", "局部变量", "块级作用域", "方法参数作用域", "全局变量", "静态变量作用域", "循环变量作用域", "C# 运算符", "算术运算符", "实例"],
          principles: [
            "在 C# 中，变量的作用域定义了变量的可见性和生命周期",
            "变量的作用域通常由花括号 {} 定义的代码块来确定",
            "在方法、循环、条件语句等代码块内声明的变量是局部变量，它们只在声明它们的代码块中可见",
            "在 C# 7及更高版本中，引入了块级作用域，即使用大括号 {} 创建的任何块都可以定义变量的作用域",
            "方法的参数也有其自己的作用域，它们在整个方法中都是可见的",
            "在类的成员级别定义的变量是成员变量，它们在整个类中可见，如果在命名空间级别定义，那么它们在整个命名空间中可见",
            "静态变量是在类级别上声明的，但它们的作用域也受限于其定义的类",
            "在 for 循环中声明的循环变量在循环体内可见"
          ],
          applications: [
            "示例：void MyMethod()",
            "示例：{",
            "示例：void MyMethod(int parameter)",
            "示例：class MyClass",
            "示例：for (int i = 0; i < 5; i++)",
            "示例：using System;"
          ],
          pitfalls: [
            "如果条件为真 ? 则为 X : 否则为 Y",
            "注意：由于括号可以改变运算符优先级，所以在实际应用中建议尽可能使用括号来明确运算顺序，提高代码的可读性和准确性",
            "请注意，冒号的使用和位置",
            "常量（Constant）是在程序中定义后不能重新赋值的值，通常用于表示固定不变的数据，例如圆周率、最大连接数、状态标识等",
            "注意：C# 不支持 C/C++ 中通过前导数字 0 表示八进制整数的写法"
          ],
          method: "按站内顺序读「C# 变量作用域 → C# 运算符 → C# 判断 → C# 常量 → C# 循环 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 8 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「C# 变量作用域、局部变量、块级作用域」的用法，并把 8 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【C# 变量作用域】C# 变量作用域：在 C# 中，变量的作用域定义了变量的可见性和生命周期",
              "【C# 变量作用域】局部变量：在方法、循环、条件语句等代码块内声明的变量是局部变量，它们只在声明它们的代码块中可见",
              "【C# 变量作用域】块级作用域：在 C# 7及更高版本中，引入了块级作用域，即使用大括号 {} 创建的任何块都可以定义变量的作用域",
              "【C# 变量作用域】方法参数作用域：方法的参数也有其自己的作用域，它们在整个方法中都是可见的",
              "【C# 变量作用域】全局变量：在类的成员级别定义的变量是成员变量，它们在整个类中可见，如果在命名空间级别定义，那么它们在整个命名空间中可见",
              "【C# 变量作用域】静态变量作用域：静态变量是在类级别上声明的，但它们的作用域也受限于其定义的类"
            ],
            mechanism: [
              "在 C# 中，变量的作用域定义了变量的可见性和生命周期",
              "变量的作用域通常由花括号 {} 定义的代码块来确定",
              "以下是关于C#变量作用域的一些基本规则：",
              "在方法、循环、条件语句等代码块内声明的变量是局部变量，它们只在声明它们的代码块中可见",
              "在 C# 7及更高版本中，引入了块级作用域，即使用大括号 {} 创建的任何块都可以定义变量的作用域",
              "方法的参数也有其自己的作用域，它们在整个方法中都是可见的",
              "在类的成员级别定义的变量是成员变量，它们在整个类中可见，如果在命名空间级别定义，那么它们在整个命名空间中可见",
              "静态变量是在类级别上声明的，但它们的作用域也受限于其定义的类",
              "在 for 循环中声明的循环变量在循环体内可见",
              "总体而言，变量的作用域有助于管理变量的可见性和生命周期，确保变量在其有效范围内使用，也有助于防止命名冲突"
            ],
            example: {
              title: "C# 运算符重载 · 实例",
              language: "csharp",
              code: "using System;\n\nnamespace OperatorOvlApplication\n\n{\n\nclass Box\n\n{\n\nprivate double length; // 长度\n\nprivate double breadth; // 宽度\n\nprivate double height; // 高度\n\npublic double getVolume()\n\n{\n\nreturn length * breadth * height;\n\n}\n\npublic void setLength( double len )\n\n{\n\nlength = len;\n\n}\n\npublic void setBreadth( double bre )\n\n{\n\nbreadth = bre;\n\n}\n\npublic void setHeight( double hei )\n\n{\n\nheight = hei;\n\n}\n\n// 重载 + 运算符来把两个 Box 对象相加\n\npublic static Box operator+ (Box b, Box c)\n\n{\n\nBox box = new Box();\n\nbox.length = b.length + c.length;\n\nbox.breadth = b.breadth + c.breadth;\n\nbox.height = b.height + c.height;\n\nreturn box;\n\n}\n\npublic static bool operator == (Box lhs, Box rhs)\n\n{\n\nbool status = false;\n\nif (lhs.length == rhs.length && lhs.height == rhs.height\n\n&& lhs.breadth == rhs.breadth)\n\n{\n\nstatus = true;\n\n}\n\nreturn status;\n\n}\n\npublic static bool operator !=(Box lhs, Box rhs)\n\n{\n\nbool status = false;\n\nif (lhs.length != rhs.length || lhs.height != rhs.height\n\n|| lhs.breadth != rhs.breadth)\n\n{\n\nstatus = true;\n\n}\n\nreturn status;\n\n}\n\npublic static bool operator <(Box lhs, Box rhs)\n\n{\n\nbool status = false;\n\nif (lhs.length < rhs.length && lhs.height\n\n< rhs.height && lhs.breadth < rhs.breadth)\n\n{\n\nstatus = true;\n\n}\n\nreturn status;\n\n}\n\npublic static bool operator >(Box lhs, Box rhs)\n\n{\n\nbool status = false;\n\nif (lhs.length > rhs.length && lhs.height\n\n> rhs.height && lhs.breadth > rhs.breadth)\n\n{\n\nstatus = true;\n\n}\n\nreturn status;\n\n}\n\npublic static bool operator <=(Box lhs, Box rhs)\n\n{\n\nbool status = false;\n\nif (lhs.length <= rhs.length && lhs.height\n\n<= rhs.height && lhs.breadth <= rhs.breadth)",
              explanation: "针对上述讨论，让我们扩展上面的实例，重载更多的运算符："
            },
            practiceSteps: [
              "先通读本节 16 页：C# 变量作用域、C# 运算符、C# 判断、C# 常量 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 8 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「C# 数据类型、运算符与流程控制」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 8 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-csharp-3",
          title: "C# 面向对象、可空类型与字符串",
          summary: "C# 面向对象、可空类型与字符串（C# 教程）：命名空间的设计目的是提供一种让一组名称与其他名称分隔开的方式 本节含 5 页、7 道配套题。",
          concepts: [
            "C# 命名空间（Namespace）",
            "定义命名空间",
            "using 关键字",
            "嵌套命名空间",
            "C# 接口（Interface）",
            "定义接口: MyInterface.cs",
            "C# 预处理器指令",
            "C# 预处理器指令列表",
            "#define 和 #undef 预处理器",
            "#warning 和 #error"
          ],
          principles: [
            "命名空间的设计目的是提供一种让一组名称与其他名称分隔开的方式",
            "在一个命名空间中声明的类的名称与另一个命名空间中声明的相同的类的名称不冲突",
            "命名空间的定义是以关键字 namespace 开始，后跟命名空间的名称，如下所示：",
            "为了调用支持命名空间版本的函数或变量，会把命名空间的名称置于前面，如下所示：",
            "using 关键字表明程序使用的是给定命名空间中的名称",
            "例如，我们在程序中使用 System 命名空间，其中定义了类 Console",
            "命名空间可以被嵌套，即您可以在一个命名空间内定义另一个命名空间，如下所示：",
            "您可以使用点（.）运算符访问嵌套的命名空间的成员，如下所示："
          ],
          applications: [
            "示例：namespace namespace_name",
            "示例：Console.WriteLine (\"Hello there\");",
            "示例：namespace namespace_name1",
            "示例：interface IMyInterface",
            "示例：using System;",
            "示例：#define DEBUG"
          ],
          pitfalls: [
            "我们举一个计算机系统中的例子，一个文件夹(目录)中可以包含多个文件夹，每个文件夹中不能有相同的文件名，但不同文件夹中的文件可以重名",
            "接口本身并不实现任何功能，它只是和声明实现该接口的对象订立一个必须实现哪些行为的契约",
            "抽象类不能直接实例化，但允许派生出具体的，具有实际功能的类",
            "值得注意的是，该方法并没有具体的实现",
            "继承接口后，我们需要实现接口的方法 MethodToImplement() , 方法名必须与接口定义的方法名一致"
          ],
          method: "按站内顺序读「C# 命名空间（Namespace） → C# 接口（Interface） → C# 预处理器指令 → C# 异常处理 → C# 文件的输入与输出」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 7 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「C# 命名空间（Namespace）、定义命名空间、using 关键字」的用法，并把 7 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【C# 命名空间（Namespace）】C# 命名空间（Namespace）：命名空间的设计目的是提供一种让一组名称与其他名称分隔开的方式",
              "【C# 命名空间（Namespace）】定义命名空间：命名空间的定义是以关键字 namespace 开始，后跟命名空间的名称，如下所示：",
              "【C# 命名空间（Namespace）】using 关键字：using 关键字表明程序使用的是给定命名空间中的名称",
              "【C# 命名空间（Namespace）】嵌套命名空间：命名空间可以被嵌套，即您可以在一个命名空间内定义另一个命名空间，如下所示：",
              "【C# 接口（Interface）】C# 接口（Interface）：接口定义了所有类继承接口时应遵循的语法合同",
              "【C# 接口（Interface）】定义接口: MyInterface.cs：接口使用 interface 关键字声明，它与类的声明类似"
            ],
            mechanism: [
              "命名空间的设计目的是提供一种让一组名称与其他名称分隔开的方式",
              "在一个命名空间中声明的类的名称与另一个命名空间中声明的相同的类的名称不冲突",
              "我们举一个计算机系统中的例子，一个文件夹(目录)中可以包含多个文件夹，每个文件夹中不能有相同的文件名，但不同文件夹中的文件可以重名",
              "命名空间的定义是以关键字 namespace 开始，后跟命名空间的名称，如下所示：",
              "为了调用支持命名空间版本的函数或变量，会把命名空间的名称置于前面，如下所示：",
              "下面的程序演示了命名空间的用法：",
              "当上面的代码被编译和执行时，它会产生下列结果：",
              "using 关键字表明程序使用的是给定命名空间中的名称",
              "例如，我们在程序中使用 System 命名空间，其中定义了类 Console",
              "我们可以写完全限定名称，如下："
            ],
            example: {
              title: "C# 异常处理 · 创建用户自定义异常",
              language: "csharp",
              code: "using System;\n\nnamespace UserDefinedException\n\n{\n\nclass TestTemperature\n\n{\n\nstatic void Main(string[] args)\n\n{\n\nTemperature temp = new Temperature();\n\ntry\n\n{\n\ntemp.showTemp();\n\n}\n\ncatch(TempIsZeroException e)\n\n{\n\nConsole.WriteLine(\"TempIsZeroException: {0}\", e.Message);\n\n}\n\nConsole.ReadKey();\n\n}\n\n}\n\n}\n\npublic class TempIsZeroException: ApplicationException\n\n{\n\npublic TempIsZeroException(string message): base(message)\n\n{\n\n}\n\n}\n\npublic class Temperature\n\n{\n\nint temperature = 0;\n\npublic void showTemp()\n\n{\n\nif(temperature == 0)\n\n{\n\nthrow (new TempIsZeroException(\"Zero Temperature found\"));\n\n}\n\nelse\n\n{\n\nConsole.WriteLine(\"Temperature: {0}\", temperature);\n\n}\n\n}\n\n}",
              explanation: "您也可以定义自己的异常"
            },
            practiceSteps: [
              "先通读本节 5 页：C# 命名空间（Namespace）、C# 接口（Interface）、C# 预处理器指令、C# 异常处理 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 7 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「C# 面向对象、可空类型与字符串」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 7 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-csharp-4",
          title: "C# 委托、事件、集合与泛型",
          summary: "C# 委托、事件、集合与泛型（C# 教程）：正则表达式是一种用来描述、匹配文本模式的搜索公式 本节含 13 页、7 道配套题。",
          concepts: ["C# 正则表达式", "定义正则表达式", "字符转义", "字符类", "定位点", "分组构造", "限定符", "反向引用构造", "备用构造", "替换"],
          principles: [
            "正则表达式是一种用来描述、匹配文本模式的搜索公式",
            "简单来说，你可以把它理解成一套特殊的通配符语言，用来精确地找到、验证或替换字符串中的内容",
            "正则表达式由以下几类构建块组成，每类负责不同的匹配功能：",
            "字符转义：让特殊字符被当作普通字符处理（如 \\. 匹配真正的句点）",
            "正则表达式中，反斜杠字符（\\）有两个作用：一是将其后的普通字符变成特殊含义（如 \\n 表示换行），二是将特殊字符转义为原义字符（如 \\. 匹配真实的点号而非\"任意字符\"）",
            "初学者常见误区：在 C# 字符串中，\\ 本身也是转义字符，所以正则中写 \\d，在 C# 字符串里要写 \"\\\\d\"，或者使用逐字字符串 @\"\\d\"（推荐）",
            "字符类用于匹配\"某一类\"字符中的任意一个",
            "例如 [aeiou] 匹配任意一个元音字母，\\d 匹配任意一个数字"
          ],
          applications: [
            "示例：using System;",
            "示例：using System.Text.RegularExpressions;",
            "示例：[attribute(positional_parameters, name_parameter = value, ...)]",
            "示例：[AttributeUsage(",
            "示例：[Conditional(",
            "示例：[Obsolete("
          ],
          pitfalls: [
            "（注意：在字符类外，\\b 表示单词边界，见\"定位点\"部分）",
            "若要匹配原意句点字符（. 或 \\u002E），您必须在该字符前面加上转义符 (\\.)",
            "匹配必须从字符串或一行的开头开始",
            "匹配必须出现在字符串的末尾或出现在行或字符串末尾的 \\n 之前",
            "匹配必须出现在字符串的开头（不受多行模式影响，始终是整个字符串的开头）"
          ],
          method: "按站内顺序读「C# 正则表达式 → C# 特性（Attribute） → C# 反射（Reflection） → C# 属性（Property） → C# 索引器（Indexer） → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 7 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「C# 正则表达式、定义正则表达式、字符转义」的用法，并把 7 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【C# 正则表达式】C# 正则表达式：正则表达式是一种用来描述、匹配文本模式的搜索公式",
              "【C# 正则表达式】定义正则表达式：正则表达式由以下几类构建块组成，每类负责不同的匹配功能：",
              "【C# 正则表达式】字符转义：正则表达式中，反斜杠字符（\\）有两个作用：一是将其后的普通字符变成特殊含义（如 \\n 表示换行），二是将特殊字符转义为原义字符（如 \\. 匹配真实的点号而非\"任意字符\"）",
              "【C# 正则表达式】字符类：字符类用于匹配\"某一类\"字符中的任意一个",
              "【C# 正则表达式】定位点：定位点（也叫\"锚点\"）不匹配任何具体字符，而是匹配字符串中的某个位置",
              "【C# 正则表达式】分组构造：分组构造使用圆括号 ( ) 将正则表达式的一部分括起来，形成一个子表达式"
            ],
            mechanism: [
              "正则表达式是一种用来描述、匹配文本模式的搜索公式",
              "简单来说，你可以把它理解成一套特殊的通配符语言，用来精确地找到、验证或替换字符串中的内容",
              "例如，想判断用户输入的是不是一个合法的邮箱地址、手机号，或者想从一段文本里提取所有日期——这些都是正则表达式的典型应用场景",
              ".NET 框架内置了功能完善的正则表达式引擎，通过 System.Text.RegularExpressions 命名空间提供支持",
              "一个正则表达式模式由一个或多个字符、运算符和结构组成，它们共同描述要匹配的文本规则",
              "如果你还不理解正则表达式可以先阅读我们的正则表达式 - 教程",
              "正则表达式由以下几类构建块组成，每类负责不同的匹配功能：",
              "字符转义：让特殊字符被当作普通字符处理（如 \\. 匹配真正的句点）",
              "字符类：匹配\"某一类\"字符（如 \\d 匹配任意数字）",
              "定位点：指定匹配发生的\"位置\"（如 ^ 表示行首）"
            ],
            example: {
              title: "C# 反射（Reflection） · 实例",
              language: "csharp",
              code: "using System;\n\nusing System.Reflection;\n\nnamespace BugFixApplication\n\n{\n\n// 一个自定义特性 BugFix 被赋给类及其成员\n\n[AttributeUsage(AttributeTargets.Class |\n\nAttributeTargets.Constructor |\n\nAttributeTargets.Field |\n\nAttributeTargets.Method |\n\nAttributeTargets.Property,\n\nAllowMultiple = true)]\n\npublic class DeBugInfo : System.Attribute\n\n{\n\nprivate int bugNo;\n\nprivate string developer;\n\nprivate string lastReview;\n\npublic string message;\n\npublic DeBugInfo(int bg, string dev, string d)\n\n{\n\nthis.bugNo = bg;\n\nthis.developer = dev;\n\nthis.lastReview = d;\n\n}\n\npublic int BugNo\n\n{\n\nget\n\n{\n\nreturn bugNo;\n\n}\n\n}\n\npublic string Developer\n\n{\n\nget\n\n{\n\nreturn developer;\n\n}\n\n}\n\npublic string LastReview\n\n{\n\nget\n\n{\n\nreturn lastReview;\n\n}\n\n}\n\npublic string Message\n\n{\n\nget\n\n{\n\nreturn message;\n\n}\n\nset\n\n{\n\nmessage = value;\n\n}\n\n}\n\n}\n\n[DeBugInfo(45, \"Zara Ali\", \"12/8/2012\",\n\nMessage = \"Return type mismatch\")]\n\n[DeBugInfo(49, \"Nuha Ali\", \"10/10/2012\",\n\nMessage = \"Unused variable\")]\n\nclass Rectangle\n\n{\n\n// 成员变量\n\nprotected double length;\n\nprotected double width;\n\npublic Rectangle(double l, double w)\n\n{\n\nlength = l;\n\nwidth = w;\n\n}\n\n[DeBugInfo(55, \"Zara Ali\", \"19/10/2012\",\n\nMessage = \"Return type mismatch\")]\n\npublic double GetArea()\n\n{\n\nreturn length * width;\n\n}\n\n[DeBugInfo(56, \"Zara Ali\", \"19/10/2012\")]\n\npublic void Display()\n\n{\n\nConsole.WriteLine(\"Length: {0}\", length);\n\nConsole.WriteLine(\"Width: {0}\", width);\n\nConsole.WriteLine(\"Area: {0}\", GetArea());\n\n}\n\n}//end class Rectangle\n\nclass ExecuteRectangle\n\n{\n\nstatic void Main(string[] args)\n\n{\n\nRectangle r = new Rectangle(4.5, 7.5);\n\nr.Display();\n\nType type = typeof(Rec",
              explanation: "在本实例中，我们将使用在上一章中创建的 DeBugInfo 特性，并使用反射（Reflection）来读取 Rectangle 类中的元数据"
            },
            practiceSteps: [
              "先通读本节 13 页：C# 正则表达式、C# 特性（Attribute）、C# 反射（Reflection）、C# 属性（Property） 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 7 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「C# 委托、事件、集合与泛型」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 7 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-csharp-1",
        "rn-csharp-2",
        "rn-csharp-4",
        "rn-csharp-5",
        "rn-csharp-6",
        "rn-csharp-10",
        "rn-csharp-12",
        "rn-csharp-18",
        "rn-csharp-3",
        "rn-csharp-7",
        "rn-csharp-19",
        "rn-csharp-24",
        "rn-csharp-25",
        "rn-csharp-27",
        "rn-csharp-28",
        "rn-csharp-30",
        "rn-csharp-15",
        "rn-csharp-16",
        "rn-csharp-20",
        "rn-csharp-21",
        "rn-csharp-22",
        "rn-csharp-23",
        "rn-csharp-29",
        "rn-csharp-8",
        "rn-csharp-9",
        "rn-csharp-11",
        "rn-csharp-13",
        "rn-csharp-14",
        "rn-csharp-17",
        "rn-csharp-26"
      ],
      lesson: {
        overview: [
          "《C# 教程》取自菜鸟教程，共 42 页，整理为 4 个知识点、30 道配套测验题。",
          "知识点顺序保持站内阅读顺序：C# 入门、环境与程序结构 → C# 数据类型、运算符与流程控制 → C# 面向对象、可空类型与字符串 → C# 委托、事件、集合与泛型。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 30 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 C# 入门、环境与程序结构 并跑通示例",
            evidence: "本地示例输出与站点示例一致"
          },
          {
            title: "完成全部配套测验",
            evidence: "题正确率 ≥ 80%（共 30 道）"
          },
          {
            title: "能独立复述全部知识点",
            evidence: "不看文档说出每个知识点的用法与易错点"
          }
        ],
        completionCriteria: ["《C# 教程》4 个知识点全部读完。", "配套 30 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    },
    {
      key: "rn-go-stage",
      title: "Go 教程",
      weeks: "第 1 阶段",
      goal: "把「Go 教程」的 33 页内容按 3 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出Go 教程的典型用法，并把 20 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-go-1",
          title: "Go 入门、环境与基础语法",
          summary: "Go 入门、环境与基础语法（Go 教程）：Go 是一个开源的编程语言，它能让构造简单、可靠且高效的软件变得容易 本节含 6 页、6 道配套题。",
          concepts: [
            "Go 语言教程",
            "Go 语言特色",
            "Go 语言用途",
            "第一个 Go 程序",
            "Go 语言环境安装",
            "Windows 系统下安装",
            "安装测试",
            "Go 简介",
            "Go 诞生要解决的三个核心问题",
            "Go 的核心设计哲学"
          ],
          principles: [
            "Go 是一个开源的编程语言，它能让构造简单、可靠且高效的软件变得容易",
            "Go是从2007年末由Robert Griesemer, Rob Pike, Ken Thompson主持开发，后来还加入了Ian Lance Taylor, Russ Cox等人，并最终于2009年11月开源，在2012年早些时候发布了Go 1稳定版本",
            "Go 语言被设计成一门应用于搭载 Web 服务器，存储集群或类似用途的巨型中央服务器的系统编程语言",
            "对于高性能分布式系统领域而言，Go 语言无疑比大多数其它语言有着更高的开发效率",
            "接下来我们来编写第一个 Go 程序 hello.go（Go 语言源文件的扩展是 .go），代码如下：",
            "Go 语言支持以下系统：",
            "以下介绍了在UNIX/Linux/Mac OS X, 和 FreeBSD系统下使用源码安装方法：",
            "1、下载二进制包：go1.4.linux-amd64.tar.gz"
          ],
          applications: [
            "示例：package main",
            "示例：tar -C /usr/local -xzf go1.4.linux-amd64.tar.gz",
            "示例：# 在 macOS 上编译 Linux 可执行文件",
            "示例：# macOS (Homebrew)",
            "示例：// 文件路径：main.go",
            "示例：# 初始化 Go Module"
          ],
          pitfalls: [
            "注意：MAC 系统下你可以使用 .pkg 结尾的安装包直接双击来完成安装，安装目录在 /usr/local/go/ 下",
            "自动垃圾回收（GC），避免手动内存管理的风险",
            "编译期类型检查，减少运行时错误",
            "不要通过共享内存来通信，而要通过通信来共享内存",
            "Go 函数使用 func 关键字声明，支持多返回值——这是 Go 错误处理机制的基础"
          ],
          method: "按站内顺序读「Go 语言教程 → Go 语言环境安装 → Go 简介 → Go 语言结构 → 使用 VSCode 开发 Go → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 6 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Go 语言教程、Go 语言特色、Go 语言用途」的用法，并把 6 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Go 语言教程】Go 语言教程：Go 是一个开源的编程语言，它能让构造简单、可靠且高效的软件变得容易",
              "【Go 语言教程】Go 语言特色：内存管理、数组安全、编译迅速",
              "【Go 语言教程】Go 语言用途：Go 语言被设计成一门应用于搭载 Web 服务器，存储集群或类似用途的巨型中央服务器的系统编程语言",
              "【Go 语言教程】第一个 Go 程序：接下来我们来编写第一个 Go 程序 hello.go（Go 语言源文件的扩展是 .go），代码如下：",
              "【Go 语言环境安装】Go 语言环境安装：Go 语言支持以下系统：",
              "【Go 语言环境安装】UNIX/Linux/Mac OS X, 和 FreeBSD 安装：以下介绍了在UNIX/Linux/Mac OS X, 和 FreeBSD系统下使用源码安装方法："
            ],
            mechanism: [
              "Go 是一个开源的编程语言，它能让构造简单、可靠且高效的软件变得容易",
              "Go是从2007年末由Robert Griesemer, Rob Pike, Ken Thompson主持开发，后来还加入了Ian Lance Taylor, Russ Cox等人，并最终于2009年11月开源，在2012年早些时候发布了Go 1稳定版本",
              "现在Go的开发已经是完全开放的，并且拥有一个活跃的社区",
              "内存管理、数组安全、编译迅速",
              "Go 语言被设计成一门应用于搭载 Web 服务器，存储集群或类似用途的巨型中央服务器的系统编程语言",
              "对于高性能分布式系统领域而言，Go 语言无疑比大多数其它语言有着更高的开发效率",
              "它提供了海量并行的支持，这对于游戏服务端的开发而言是再好不过了",
              "接下来我们来编写第一个 Go 程序 hello.go（Go 语言源文件的扩展是 .go），代码如下：",
              "要执行 Go 语言代码可以使用 go run 命令",
              "此外我们还可以使用 go build 命令来生成二进制文件："
            ],
            example: {
              title: "Go 简介 · 并发 Worker 池",
              language: "go",
              code: "// 文件路径：workerpool.go\n\npackage main\n\nimport (\n\n\"fmt\"\n\n\"sync\"\n\n\"time\"\n\n)\n\n// worker 从 jobs 通道读取任务，处理后将结果写入 results 通道\n\n// 任务处理完毕时调用 wg.Done() 通知 WaitGroup\n\nfunc worker(id int, jobs <-chan int, results chan<- int, wg *sync.WaitGroup) {\n\ndefer wg.Done() // 无论函数如何退出，都标记该 worker 完成\n\nfor job := range jobs {\n\nfmt.Printf(\"[Worker %d] 处理任务 %d\\n\", id, job)\n\ntime.Sleep(200 * time.Millisecond) // 模拟任务处理耗时\n\nresults <- job * job // 计算平方作为结果\n\n}\n\n}\n\nfunc main() {\n\nconst numJobs = 10 // 总任务数\n\nconst numWorkers = 3 // 并发 worker 数量\n\njobs := make(chan int, numJobs) // 带缓冲的任务通道\n\nresults := make(chan int, numJobs) // 带缓冲的结果通道\n\nvar wg sync.WaitGroup // 用于等待所有 worker 完成\n\nfmt.Println(\"=== RUNOOB Worker Pool 示例 ===\")\n\n// 启动固定数量的 worker goroutine\n\nfor w := 1; w <= numWorkers; w++ {\n\nwg.Add(1) // 每启动一个 worker，WaitGroup 计数加 1\n\ngo worker(w, jobs, results, &wg)\n\n}\n\n// 向通道发送所有任务\n\nfor j := 1; j <= numJobs; j++ {\n\njobs <- j\n\n}\n\nclose(jobs) // 关闭 jobs 通道，worker 的 range 循环会自行退出\n\n// 等待所有 worker 完成后，关闭结果通道\n\ngo func() {\n\nwg.Wait()\n\nclose(results)\n\n}()\n\n// 收集并打印所有结果\n\nfmt.Println(\"结果汇总:\")\n\nfor result := range results {\n\nfmt.Printf(\"%d \", result)\n\n}\n\nfmt.Println(\"\\n所有任务处理完成\")\n\n}",
              explanation: "这是 Go 并发的经典应用场景：使用限定数量的 goroutine 并行处理大批量任务"
            },
            practiceSteps: [
              "先通读本节 6 页：Go 语言教程、Go 语言环境安装、Go 简介、Go 语言结构 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 6 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Go 入门、环境与基础语法」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 6 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-go-2",
          title: "Go 数据类型、函数与流程控制",
          summary: "Go 数据类型、函数与流程控制（Go 教程）：在 Go 编程语言中，数据类型用于声明函数和变量 本节含 18 页、8 道配套题。",
          concepts: [
            "Go 语言数据类型",
            "数字类型",
            "浮点型",
            "其他数字类型",
            "Go 语言变量",
            "变量声明",
            "多变量声明",
            "值类型和引用类型",
            "简短形式，使用 := 赋值操作符",
            "注意事项"
          ],
          principles: [
            "在 Go 编程语言中，数据类型用于声明函数和变量",
            "数据类型的出现是为了把数据分成所需内存大小不同的数据，编程的时候需要用大数据的时候才需要申请大内存，就可以充分利用内存",
            "Go 也有基于架构的类型，例如：int、uint 和 uintptr",
            "无符号 8 位整型 (0 到 255)",
            "IEEE-754 32位浮点型数",
            "以下列出了其他更多的数字类型：",
            "变量来源于数学，是计算机语言中能储存计算结果或能表示值抽象概念",
            "第一种，指定变量类型，如果没有初始化，则变量默认为零值"
          ],
          applications: [
            "示例：var identifier type",
            "示例：var v_name v_type",
            "示例：//类型相同多个变量, 非全局变量",
            "示例：package main",
            "示例：const identifier [type] = value",
            "示例：A = 0011 1100"
          ],
          pitfalls: [
            "Go 语言变量名由字母、数字、下划线组成，其中首个字符不能为数字",
            "第三种，如果变量已经使用 var 声明过了，再使用 := 声明变量，就产生编译错误，格式：",
            "如果在相同的代码块中，我们不可以再次对于相同名称的变量使用初始化声明，例如：a := 20 就是不被允许的，编译器会提示错误 no new variables on left side of :=，但是 a = 20 是可以的，因为这是给相同的变量赋予一个新的值",
            "如果你在定义变量 a 之前使用它，则会得到编译错误 undefined: a",
            "如果你声明了一个局部变量却没有在相同的代码块中使用它，同样会得到编译错误，例如下面这个例子当中的变量 a："
          ],
          method: "按站内顺序读「Go 语言数据类型 → Go 语言变量 → Go 语言常量 → Go 语言运算符 → Go 语言条件语句 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 8 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Go 语言数据类型、数字类型、浮点型」的用法，并把 8 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Go 语言数据类型】Go 语言数据类型：在 Go 编程语言中，数据类型用于声明函数和变量",
              "【Go 语言数据类型】数字类型：Go 也有基于架构的类型，例如：int、uint 和 uintptr",
              "【Go 语言数据类型】浮点型：IEEE-754 32位浮点型数",
              "【Go 语言数据类型】其他数字类型：以下列出了其他更多的数字类型：",
              "【Go 语言变量】Go 语言变量：变量来源于数学，是计算机语言中能储存计算结果或能表示值抽象概念",
              "【Go 语言变量】变量声明：第一种，指定变量类型，如果没有初始化，则变量默认为零值"
            ],
            mechanism: [
              "在 Go 编程语言中，数据类型用于声明函数和变量",
              "数据类型的出现是为了把数据分成所需内存大小不同的数据，编程的时候需要用大数据的时候才需要申请大内存，就可以充分利用内存",
              "Go 语言按类别有以下几种数据类型：",
              "布尔型的值只可以是常量 true 或者 false",
              "一个简单的例子：var b bool = true",
              "整型 int 和浮点型 float32、float64，Go 语言支持整型和浮点型数字，并且支持复数，其中位的运算采用补码",
              "字符串就是一串固定长度的字符连接起来的字符序列",
              "Go 的字符串是由单个字节连接起来的",
              "Go 语言的字符串的字节使用 UTF-8 编码标识 Unicode 文本",
              "(a) 指针类型（Pointer）"
            ],
            example: {
              title: "Go 语言泛型 · 2. 泛型映射（Map）",
              language: "go",
              code: "// 线程安全的泛型映射\n\ntype SafeMap[K comparable, V any] struct {\n\ndata map[K]V\n\nmutex sync.RWMutex\n\n}\n\n// 创建新的 SafeMap\n\nfunc NewSafeMap[K comparable, V any]() *SafeMap[K, V] {\n\nreturn &SafeMap[K, V]{\n\ndata: make(map[K]V),\n\n}\n\n}\n\n// 设置键值对\n\nfunc (m *SafeMap[K, V]) Set(key K, value V) {\n\nm.mutex.Lock()\n\ndefer m.mutex.Unlock()\n\nm.data[key] = value\n\n}\n\n// 获取值\n\nfunc (m *SafeMap[K, V]) Get(key K) (V, bool) {\n\nm.mutex.RLock()\n\ndefer m.mutex.RUnlock()\n\nvalue, exists := m.data[key]\n\nreturn value, exists\n\n}\n\n// 删除键\n\nfunc (m *SafeMap[K, V]) Delete(key K) {\n\nm.mutex.Lock()\n\ndefer m.mutex.Unlock()\n\ndelete(m.data, key)\n\n}\n\n// 获取所有键\n\nfunc (m *SafeMap[K, V]) Keys() []K {\n\nm.mutex.RLock()\n\ndefer m.mutex.RUnlock()\n\nkeys := make([]K, 0, len(m.data))\n\nfor key := range m.data {\n\nkeys = append(keys, key)\n\n}\n\nreturn keys\n\n}\n\n// 使用示例\n\nfunc main() {\n\n// 创建字符串到整数的映射\n\nscores := NewSafeMap[string, int]()\n\nscores.Set(\"Alice\", 95)\n\nscores.Set(\"Bob\", 87)\n\nif score, exists := scores.Get(\"Alice\"); exists {\n\nfmt.Printf(\"Alice's score: %d\\n\", score) // 输出: Alice's score: 95\n\n}\n\nfmt.Println(\"Keys:\", scores.Keys()) // 输出: Keys: [Alice Bob]\n\n}",
              explanation: "示例代码取自「Go 语言泛型」，可直接改参数观察输出差异。"
            },
            practiceSteps: [
              "先通读本节 18 页：Go 语言数据类型、Go 语言变量、Go 语言常量、Go 语言运算符 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 8 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Go 数据类型、函数与流程控制」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 8 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-go-3",
          title: "Go 结构体、接口与并发",
          summary: "Go 结构体、接口与并发（Go 教程）：Go 语言通过内置的错误接口提供了非常简单的错误处理机制 本节含 9 页、6 道配套题。",
          concepts: [
            "Go 错误处理",
            "error 接口",
            "使用 errors 包创建错误",
            "显式返回错误",
            "自定义错误",
            "fmt 包与错误格式化",
            "使用 errors.Is 和 errors.As",
            "errors.Is",
            "errors.As",
            "panic 和 recover"
          ],
          principles: [
            "Go 语言通过内置的错误接口提供了非常简单的错误处理机制",
            "Go 语言的错误处理采用显式返回错误的方式，而非传统的异常处理机制",
            "Go 标准库定义了一个 error 接口，表示一个错误的抽象",
            "error 类型是一个接口类型，这是它的定义：",
            "我们可以在编码中通过实现 error 接口类型来生成错误信息",
            "Go 中，错误通常作为函数的返回值返回，开发者需要显式检查并处理",
            "通过定义自定义类型，可以扩展 error 接口",
            "fmt 包提供了对错误的格式化输出支持："
          ],
          applications: [
            "示例：type error interface {",
            "示例：package main",
            "示例：go 函数名( 参数列表 )",
            "示例：ch <- v // 把 v 发送到通道 ch",
            "示例：ch := make(chan int, 100)",
            "示例：v, ok := <-ch"
          ],
          pitfalls: [
            "Go 语言通过内置的错误接口提供了非常简单的错误处理机制",
            "Go 语言的错误处理采用显式返回错误的方式，而非传统的异常处理机制",
            "这种设计使代码逻辑更清晰，便于开发者在编译时或运行时明确处理错误",
            "Go 的错误处理主要围绕以下机制展开：",
            "error 接口：标准的错误表示"
          ],
          method: "按站内顺序读「Go 错误处理 → Go 并发 → Go 语言文件处理 → Go 语言正则表达式 → Go 类型断言 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 6 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Go 错误处理、error 接口、使用 errors 包创建错误」的用法，并把 6 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Go 错误处理】Go 错误处理：Go 语言通过内置的错误接口提供了非常简单的错误处理机制",
              "【Go 错误处理】error 接口：Go 标准库定义了一个 error 接口，表示一个错误的抽象",
              "【Go 错误处理】使用 errors 包创建错误：我们可以在编码中通过实现 error 接口类型来生成错误信息",
              "【Go 错误处理】显式返回错误：Go 中，错误通常作为函数的返回值返回，开发者需要显式检查并处理",
              "【Go 错误处理】自定义错误：通过定义自定义类型，可以扩展 error 接口",
              "【Go 错误处理】fmt 包与错误格式化：fmt 包提供了对错误的格式化输出支持："
            ],
            mechanism: [
              "Go 语言通过内置的错误接口提供了非常简单的错误处理机制",
              "Go 语言的错误处理采用显式返回错误的方式，而非传统的异常处理机制",
              "这种设计使代码逻辑更清晰，便于开发者在编译时或运行时明确处理错误",
              "Go 的错误处理主要围绕以下机制展开：",
              "error 接口：标准的错误表示",
              "显式返回值：通过函数的返回值返回错误",
              "自定义错误：可以通过标准库或自定义的方式创建错误",
              "panic 和 recover：处理不可恢复的严重错误",
              "Go 标准库定义了一个 error 接口，表示一个错误的抽象",
              "error 类型是一个接口类型，这是它的定义："
            ],
            example: {
              title: "Go 错误处理 · fmt 包与错误格式化",
              language: "go",
              code: "package main\n\nimport (\n\n\"fmt\"\n\n)\n\n// 定义一个 DivideError 结构\n\ntype DivideError struct {\n\ndividee int\n\ndivider int\n\n}\n\n// 实现 `error` 接口\n\nfunc (de *DivideError) Error() string {\n\nstrFormat := `\n\nCannot proceed, the divider is zero.\n\ndividee: %d\n\ndivider: 0\n\n`\n\nreturn fmt.Sprintf(strFormat, de.dividee)\n\n}\n\n// 定义 `int` 类型除法运算的函数\n\nfunc Divide(varDividee int, varDivider int) (result int, errorMsg string) {\n\nif varDivider == 0 {\n\ndData := DivideError{\n\ndividee: varDividee,\n\ndivider: varDivider,\n\n}\n\nerrorMsg = dData.Error()\n\nreturn\n\n} else {\n\nreturn varDividee / varDivider, \"\"\n\n}\n\n}\n\nfunc main() {\n\n// 正常情况\n\nif result, errorMsg := Divide(100, 10); errorMsg == \"\" {\n\nfmt.Println(\"100/10 = \", result)\n\n}\n\n// 当除数为零的时候会返回错误信息\n\nif _, errorMsg := Divide(100, 0); errorMsg != \"\" {\n\nfmt.Println(\"errorMsg is: \", errorMsg)\n\n}\n\n}",
              explanation: "fmt 包提供了对错误的格式化输出支持："
            },
            practiceSteps: [
              "先通读本节 9 页：Go 错误处理、Go 并发、Go 语言文件处理、Go 语言正则表达式 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 6 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Go 结构体、接口与并发」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 6 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-go-2",
        "rn-go-3",
        "rn-go-4",
        "rn-go-8",
        "rn-go-14",
        "rn-go-16",
        "rn-go-1",
        "rn-go-5",
        "rn-go-6",
        "rn-go-7",
        "rn-go-11",
        "rn-go-12",
        "rn-go-13",
        "rn-go-19",
        "rn-go-9",
        "rn-go-10",
        "rn-go-15",
        "rn-go-17",
        "rn-go-18",
        "rn-go-20"
      ],
      lesson: {
        overview: [
          "《Go 教程》取自菜鸟教程，共 33 页，整理为 3 个知识点、20 道配套测验题。",
          "知识点顺序保持站内阅读顺序：Go 入门、环境与基础语法 → Go 数据类型、函数与流程控制 → Go 结构体、接口与并发。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 20 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 Go 入门、环境与基础语法 并跑通示例",
            evidence: "本地示例输出与站点示例一致"
          },
          {
            title: "完成全部配套测验",
            evidence: "题正确率 ≥ 80%（共 20 道）"
          },
          {
            title: "能独立复述全部知识点",
            evidence: "不看文档说出每个知识点的用法与易错点"
          }
        ],
        completionCriteria: ["《Go 教程》3 个知识点全部读完。", "配套 20 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    },
    {
      key: "rn-php-stage",
      title: "PHP 教程",
      weeks: "第 1 阶段",
      goal: "把「PHP 教程」的 93 页内容按 8 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出PHP 教程的典型用法，并把 21 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-php-1",
          title: "PHP 入门、语法与变量",
          summary: "PHP 入门、语法与变量（PHP 教程）：PHP 是一种创建动态交互性站点的强有力的服务器端脚本语言 本节含 7 页、3 道配套题。",
          concepts: [
            "PHP 教程",
            "通过实例学习 PHP",
            "PHP 安装",
            "您需要做什么？",
            "使用支持 PHP 的 Web 主机",
            "在您自己的 PC 机上建立 PHP",
            "PHP 服务器组件",
            "WampServer",
            "XAMPP",
            "VS Code"
          ],
          principles: [
            "PHP 是一种创建动态交互性站点的强有力的服务器端脚本语言",
            "PHP 是免费的，并且使用非常广泛",
            "我们的 PHP 在线实例让您能够更简单的学习 PHP，实例中包含了 PHP 的源码及运行结果",
            "点击\"运行实例\"按钮查看在线实例运行结果",
            "为了开始使用 PHP，您可以：",
            "找一个支持 PHP 和 MySQL 的 Web 主机",
            "如果您的服务器支持 PHP，那么您不需要做任何事情",
            "只要在您的 web 目录中创建 .php 文件即可，服务器将自动为您解析这些文件"
          ],
          applications: ["示例：<!DOCTYPE html>", "示例：<?php"],
          pitfalls: [
            "然而，如果您的服务器不支持 PHP，您必须：",
            "PhpStorm是一个轻量级且便捷的PHP IDE，其旨在提供用户效率，可深刻理解用户的编码，提供智能代码补全，快速导航以及即时错误检查",
            "变量名必须以字母或者下划线字符开始",
            "变量名不能包含空格",
            "在上面的实例中，我们注意到，不必向 PHP 声明该变量的数据类型"
          ],
          method: "按站内顺序读「PHP 教程 → PHP 安装 → PHP 简介 → PHP 变量 → PHP 语法 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「PHP 教程、通过实例学习 PHP、PHP 安装」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【PHP 教程】PHP 教程：PHP 是一种创建动态交互性站点的强有力的服务器端脚本语言",
              "【PHP 教程】通过实例学习 PHP：我们的 PHP 在线实例让您能够更简单的学习 PHP，实例中包含了 PHP 的源码及运行结果",
              "【PHP 安装】您需要做什么？：为了开始使用 PHP，您可以：",
              "【PHP 安装】使用支持 PHP 的 Web 主机：如果您的服务器支持 PHP，那么您不需要做任何事情",
              "【PHP 安装】在您自己的 PC 机上建立 PHP：然而，如果您的服务器不支持 PHP，您必须：",
              "【PHP 安装】PHP 服务器组件：对于初学者建议使用集成的服务器组件，它已经包含了 PHP、Apache、Mysql 等服务,免去了开发人员将时间花费在繁琐的配置环境过程"
            ],
            mechanism: [
              "PHP 是一种创建动态交互性站点的强有力的服务器端脚本语言",
              "PHP 是免费的，并且使用非常广泛",
              "同时，对于像微软 ASP 这样的竞争者来说，PHP 无疑是另一种高效率的选项",
              "适用于PHP初学者的学习线路和建议",
              "我们的 PHP 在线实例让您能够更简单的学习 PHP，实例中包含了 PHP 的源码及运行结果",
              "点击\"运行实例\"按钮查看在线实例运行结果",
              "PHP 文件的默认文件扩展名是 .php",
              "为了开始使用 PHP，您可以：",
              "找一个支持 PHP 和 MySQL 的 Web 主机",
              "在您自己的 PC 机上安装 Web 服务器，然后安装 PHP 和 MySQL"
            ],
            example: {
              title: "PHP 变量 · 局部和全局作用域",
              language: "php",
              code: "<?php\n\n$x=5; // 全局变量\n\nfunction myTest()\n\n{\n\n$y=10; // 局部变量\n\necho \"<p>测试函数内变量:<p>\";\n\necho \"变量 x 为: $x\";\n\necho \"<br>\";\n\necho \"变量 y 为: $y\";\n\n}\n\nmyTest();\n\necho \"<p>测试函数外变量:<p>\";\n\necho \"变量 x 为: $x\";\n\necho \"<br>\";\n\necho \"变量 y 为: $y\";\n\n?>",
              explanation: "在所有函数外部定义的变量，拥有全局作用域"
            },
            practiceSteps: [
              "先通读本节 7 页：PHP 教程、PHP 安装、PHP 简介、PHP 变量 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「PHP 入门、语法与变量」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-php-2",
          title: "PHP 运算符、流程控制与数组",
          summary: "PHP 运算符、流程控制与数组（PHP 教程）：PHP 变量存储不同的类型的数据，不同的数据类型可以做不一样的事情 本节含 16 页、3 道配套题。",
          concepts: [
            "PHP 数据类型",
            "PHP 字符串",
            "PHP 整型",
            "PHP 浮点型",
            "PHP 布尔型",
            "PHP 数组",
            "PHP 对象",
            "PHP NULL 值",
            "PHP 资源类型",
            "PHP 类型比较"
          ],
          principles: [
            "PHP 变量存储不同的类型的数据，不同的数据类型可以做不一样的事情",
            "PHP 支持以下几种数据类型:",
            "一个字符串是一串字符的序列，就像 \"Hello world!\"",
            "你可以将任何文本放在单引号和双引号中：",
            "整数是一个没有小数的数字",
            "整数必须至少有一个数字 (0-9)",
            "浮点数是带小数部分的数字，或是指数形式",
            "在以下实例中我们将测试不同的数字"
          ],
          applications: [
            "示例：<?php",
            "示例：get_resource_type(resource $handle): string",
            "示例：bool define ( string $name , mixed $value [, bool $case_insensitive = false ] )",
            "示例：const CONSTANT_NAME = \"value\";",
            "示例：echo PHP_VERSION; // 输出 PHP 版本，例如 \"7.4.1\"",
            "示例：define(\"FRUITS\", ["
          ],
          pitfalls: [
            "整数必须至少有一个数字 (0-9)",
            "整数不能包含逗号或空格",
            "在 PHP 中，对象必须声明",
            "首先，你必须使用class关键字声明类对象",
            "如果参数不是合法的 resource，将产生错误"
          ],
          method: "按站内顺序读「PHP 数据类型 → PHP 类型比较 → PHP 常量 → PHP 字符串变量 → PHP 运算符 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「PHP 数据类型、PHP 字符串、PHP 整型」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【PHP 数据类型】PHP 数据类型：PHP 变量存储不同的类型的数据，不同的数据类型可以做不一样的事情",
              "【PHP 数据类型】PHP 字符串：一个字符串是一串字符的序列，就像 \"Hello world!\"",
              "【PHP 数据类型】PHP 整型：整数是一个没有小数的数字",
              "【PHP 数据类型】PHP 浮点型：浮点数是带小数部分的数字，或是指数形式",
              "【PHP 数据类型】PHP 布尔型：布尔型可以是 TRUE 或 FALSE",
              "【PHP 数据类型】PHP 数组：数组可以在一个变量中存储多个值"
            ],
            mechanism: [
              "PHP 变量存储不同的类型的数据，不同的数据类型可以做不一样的事情",
              "PHP 支持以下几种数据类型:",
              "Resource（资源类型）",
              "一个字符串是一串字符的序列，就像 \"Hello world!\"",
              "你可以将任何文本放在单引号和双引号中：",
              "整数必须至少有一个数字 (0-9)",
              "整型可以用三种格式来指定：十进制，",
              "十六进制（以 0x 为前缀）或八进制（前缀为 0）",
              "在以下实例中我们将测试不同的数字",
              "PHP var_dump()"
            ],
            example: {
              title: "PHP 面向对象 · 方法的访问控制",
              language: "php",
              code: "<?php\n/**\n* Define MyClass\n*/\nclass MyClass\n{\n// 声明一个公有的构造函数\npublic function __construct() { }\n\n// 声明一个公有的方法\npublic function MyPublic() { }\n\n// 声明一个受保护的方法\nprotected function MyProtected() { }\n\n// 声明一个私有的方法\nprivate function MyPrivate() { }\n\n// 此方法为公有\nfunction Foo()\n{\n$this->MyPublic();\n$this->MyProtected();\n$this->MyPrivate();\n}\n}\n\n$myclass = new MyClass;\n$myclass->MyPublic(); // 这行能被正常执行\n$myclass->MyProtected(); // 这行会产生一个致命错误\n$myclass->MyPrivate(); // 这行会产生一个致命错误\n$myclass->Foo(); // 公有，受保护，私有都可以执行\n\n/**\n* Define MyClass2\n*/\nclass MyClass2 extends MyClass\n{\n// 此方法为公有\nfunction Foo2()\n{\n$this->MyPublic();\n$this->MyProtected();\n$this->MyPrivate(); // 这行会产生一个致命错误\n}\n}\n\n$myclass2 = new MyClass2;\n$myclass2->MyPublic(); // 这行能被正常执行\n$myclass2->Foo2(); // 公有的和受保护的都可执行，但私有的不行\n\nclass Bar\n{\npublic function test() {\n$this->testPrivate();\n$this->testPublic();\n}\n\npublic function testPublic() {\necho \"Bar::testPublic\\n\";\n}\n\nprivate function testPrivate() {\necho \"Bar::testPrivate\\n\";\n}\n}\n\nclass Foo extends Bar\n{\npublic function testPublic() {\necho \"Foo::testPublic\\n\";\n}\n\nprivate function testPrivate() {\necho \"Foo::testPrivate\\n\";\n}\n}\n\n$myFoo = new foo();\n$myFoo->test(); // Bar::testPrivate\n// Foo::testPublic\n?>",
              explanation: "类中的方法可以被定义为公有，私有或受保护"
            },
            practiceSteps: [
              "先通读本节 16 页：PHP 数据类型、PHP 类型比较、PHP 常量、PHP 字符串变量 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「PHP 运算符、流程控制与数组」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-php-3",
          title: "PHP 函数、面向对象与命名空间",
          summary: "PHP 函数、面向对象与命名空间（PHP 教程）：PHP 中的 $_GET 和 $_POST 变量用于检索表单中的信息，比如用户输入 本节含 14 页、3 道配套题。",
          concepts: [
            "PHP 表单和用户输入",
            "PHP 表单处理",
            "实例",
            "PHP 获取下拉菜单的数据",
            "PHP 下拉菜单单选",
            "PHP 下拉菜单多选",
            "单选按钮表单",
            "checkbox 复选框",
            "表单验证",
            "PHP 表单 - 必需字段"
          ],
          principles: [
            "PHP 中的 $_GET 和 $_POST 变量用于检索表单中的信息，比如用户输入",
            "有一点很重要的事情值得注意，当处理 HTML 表单时，PHP 能把来自 HTML 页面中的表单元素自动变成可供 PHP 脚本使用",
            "下面的实例包含了一个 HTML 表单，带有两个输入框和一个提交按钮",
            "form.html 文件代码：",
            "以下实例我们设置了下拉菜单三个选项，表单使用 GET 方式获取数据，action 属性值为空表示提交到当前脚本，我们可以通过 select 的 name 属性获取下拉菜单的值：",
            "php_form_select.php 文件代码：",
            "如果下拉菜单是多选的（ multiple=\"multiple\"），我们可以通过将设置 select name=\"q[]\" 以数组的方式获取，以下使用 POST 方式提交，代码如下所示：",
            "php_form_select_mul.php 文件代码："
          ],
          applications: [
            "示例：<html>",
            "示例：<?php",
            "示例：<form method=\"post\" action=\"<?php echo htmlspecialchars($_SERVER['PHP_SELF']);?…",
            "示例：“名字”: <input type=\"text\" name=\"name\">",
            "示例：性别:",
            "示例：<form method=\"post\" action=\"<?php echo htmlspecialchars($_SERVER[\"PHP_SELF\"]);?…"
          ],
          pitfalls: [
            "有一点很重要的事情值得注意，当处理 HTML 表单时，PHP 能把来自 HTML 页面中的表单元素自动变成可供 PHP 脚本使用",
            "这样用户就可以在同一张表单页面得到错误信息",
            "用户也就更容易发现错误了",
            "本章节我们将介绍如何设置表单必需字段及错误信息",
            "\"性别\" 字段是必需的，各字段不能为空"
          ],
          method: "按站内顺序读「PHP 表单和用户输入 → PHP 表单 - 必需字段 → PHP 表单验证 → PHP 表单 - 验证邮件和URL → PHP $_GET 变量 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「PHP 表单和用户输入、PHP 表单处理、实例」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【PHP 表单和用户输入】PHP 表单和用户输入：PHP 中的 $_GET 和 $_POST 变量用于检索表单中的信息，比如用户输入",
              "【PHP 表单和用户输入】PHP 表单处理：有一点很重要的事情值得注意，当处理 HTML 表单时，PHP 能把来自 HTML 页面中的表单元素自动变成可供 PHP 脚本使用",
              "【PHP 表单和用户输入】实例：下面的实例包含了一个 HTML 表单，带有两个输入框和一个提交按钮",
              "【PHP 表单和用户输入】PHP 下拉菜单单选：以下实例我们设置了下拉菜单三个选项，表单使用 GET 方式获取数据，action 属性值为空表示提交到当前脚本，我们可以通过 select 的 name 属性获取下拉菜单的值：",
              "【PHP 表单和用户输入】PHP 下拉菜单多选：如果下拉菜单是多选的（ multiple=\"multiple\"），我们可以通过将设置 select name=\"q[]\" 以数组的方式获取，以下使用 POST 方式提交，代码如下所示：",
              "【PHP 表单和用户输入】单选按钮表单：PHP 单选按钮表单中 name 属性的值是一致的，value 值是不同的，代码如下所示："
            ],
            mechanism: [
              "PHP 中的 $_GET 和 $_POST 变量用于检索表单中的信息，比如用户输入",
              "有一点很重要的事情值得注意，当处理 HTML 表单时，PHP 能把来自 HTML 页面中的表单元素自动变成可供 PHP 脚本使用",
              "下面的实例包含了一个 HTML 表单，带有两个输入框和一个提交按钮",
              "form.html 文件代码：",
              "当用户填写完上面的表单并点击提交按钮时，表单的数据会被送往名为 \"welcome.php\" 的 PHP 文件：",
              "welcome.php 文件代码：",
              "我们将在下一章中讲解 PHP 中的 $_GET 和 $_POST 变量",
              "以下实例我们设置了下拉菜单三个选项，表单使用 GET 方式获取数据，action 属性值为空表示提交到当前脚本，我们可以通过 select 的 name 属性获取下拉菜单的值：",
              "php_form_select.php 文件代码：",
              "如果下拉菜单是多选的（ multiple=\"multiple\"），我们可以通过将设置 select name=\"q[]\" 以数组的方式获取，以下使用 POST 方式提交，代码如下所示："
            ],
            example: {
              title: "PHP 表单 - 验证邮件和URL · PHP - 验证 Name, E-mail, 和 URL",
              language: "php",
              code: "<?php\n// 定义变量并默认设置为空值\n$nameErr = $emailErr = $genderErr = $websiteErr = \"\";\n$name = $email = $gender = $comment = $website = \"\";\n\nif ($_SERVER[\"REQUEST_METHOD\"] == \"POST\") {\nif (empty($_POST[\"name\"])) {\n$nameErr = \"Name is required\";\n} else {\n$name = test_input($_POST[\"name\"]);\n// 检测名字是否只包含字母跟空格\nif (!preg_match(\"/^[a-zA-Z ]*$/\",$name)) {\n$nameErr = \"只允许字母和空格\";\n}\n}\n\nif (empty($_POST[\"email\"])) {\n$emailErr = \"Email is required\";\n} else {\n$email = test_input($_POST[\"email\"]);\n// 检测邮箱是否合法\nif (!preg_match(\"/([\\w\\-]+\\@[\\w\\-]+\\.[\\w\\-]+)/\",$email)) {\n$emailErr = \"非法邮箱格式\";\n}\n}\n\nif (empty($_POST[\"website\"])) {\n$website = \"\";\n} else {\n$website = test_input($_POST[\"website\"]);\n// 检测 URL 地址是否合法\nif (!preg_match(\"/\\b(?:(?:https?|ftp):\\/\\/|www\\.)[-a-z0-9+&@#\\/%?=~_|!:,.;]*[-a-z0-9+&@#\\/%=~_|]/i\",$website)) {\n$websiteErr = \"非法的 URL 的地址\";\n}\n}\n\nif (empty($_POST[\"comment\"])) {\n$comment = \"\";\n} else {\n$comment = test_input($_POST[\"comment\"]);\n}\n\nif (empty($_POST[\"gender\"])) {\n$genderErr = \"性别是必需的\";\n} else {\n$gender = test_input($_POST[\"gender\"]);\n}\n}\n?>",
              explanation: "代码如下所示:"
            },
            practiceSteps: [
              "先通读本节 14 页：PHP 表单和用户输入、PHP 表单 - 必需字段、PHP 表单验证、PHP 表单 - 验证邮件和URL 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「PHP 函数、面向对象与命名空间」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-php-4",
          title: "PHP 表单、Cookie 与 Session",
          summary: "PHP 表单、Cookie 与 Session（PHP 教程）：在上一节中的 PHP e-mail 脚本中，存在着一个漏洞 本节含 6 页、2 道配套题。",
          concepts: [
            "PHP Secure E-mails",
            "PHP E-mail 注入",
            "PHP 防止 E-mail 注入",
            "PHP Session",
            "PHP Session 变量",
            "开始 PHP Session",
            "存储 Session 变量",
            "销毁 Session",
            "PHP 错误处理",
            "基本的错误处理：使用 die() 函数"
          ],
          principles: [
            "在上一节中的 PHP e-mail 脚本中，存在着一个漏洞",
            "首先，请看上一章中的 PHP 代码：",
            "以上代码存在的问题是，未经授权的用户可通过输入表单在邮件头部插入数据",
            "防止 e-mail 注入的最好方法是对输入进行验证",
            "下面的代码与上一章中的类似，不过这里我们已经增加了检测表单中 email 字段的输入验证程序：",
            "PHP session 变量用于存储关于用户会话（session）的信息，或者更改用户会话（session）的设置",
            "Session 变量存储单一用户的信息，并且对于应用程序中的所有页面都是可用的",
            "您在计算机上操作某个应用程序时，您打开它，做些更改，然后关闭它"
          ],
          applications: [
            "示例：<html>",
            "示例：<?php session_start(); ?>",
            "示例：<?php",
            "示例：error_function(error_level,error_message,",
            "示例：function customError($errno, $errstr)",
            "示例：set_error_handler(\"customError\");"
          ],
          pitfalls: [
            "在您把用户信息存储到 PHP session 中之前，首先必须启动会话",
            "注释：session_start() 函数必须位于 <html> 标签之前：",
            "在 PHP 中，默认的错误处理很简单",
            "一条错误消息会被发送到浏览器，这条消息带有文件名、行号以及描述错误的消息",
            "在创建脚本和 Web 应用程序时，错误处理是一个重要的部分"
          ],
          method: "按站内顺序读「PHP Secure E-mails → PHP Session → PHP 错误处理 → PHP 异常处理 → PHP 过滤器 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 2 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「PHP Secure E-mails、PHP E-mail 注入、PHP 防止 E-mail 注入」的用法，并把 2 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【PHP Secure E-mails】PHP Secure E-mails：在上一节中的 PHP e-mail 脚本中，存在着一个漏洞",
              "【PHP Secure E-mails】PHP E-mail 注入：首先，请看上一章中的 PHP 代码：",
              "【PHP Secure E-mails】PHP 防止 E-mail 注入：防止 e-mail 注入的最好方法是对输入进行验证",
              "【PHP Session】PHP Session：PHP session 变量用于存储关于用户会话（session）的信息，或者更改用户会话（session）的设置",
              "【PHP Session】PHP Session 变量：您在计算机上操作某个应用程序时，您打开它，做些更改，然后关闭它",
              "【PHP Session】开始 PHP Session：在您把用户信息存储到 PHP session 中之前，首先必须启动会话"
            ],
            mechanism: [
              "在上一节中的 PHP e-mail 脚本中，存在着一个漏洞",
              "首先，请看上一章中的 PHP 代码：",
              "以上代码存在的问题是，未经授权的用户可通过输入表单在邮件头部插入数据",
              "假如用户在表单中的输入框内加入如下文本到电子邮件中，会出现什么情况呢",
              "与往常一样，mail() 函数把上面的文本放入邮件头部，那么现在头部有了额外的 Cc:、Bcc: 和 To: 字段",
              "当用户点击提交按钮时，这封 e-mail 会被发送到上面所有的地址",
              "防止 e-mail 注入的最好方法是对输入进行验证",
              "下面的代码与上一章中的类似，不过这里我们已经增加了检测表单中 email 字段的输入验证程序：",
              "在上面的代码中，我们使用了 PHP 过滤器来对输入进行验证：",
              "FILTER_SANITIZE_EMAIL 过滤器从字符串中删除电子邮件的非法字符"
            ],
            example: {
              title: "PHP Secure E-mails · PHP 防止 E-mail 注入",
              language: "php",
              code: "<html>\n<head>\n＜meta charset=\"utf-8\"＞\n<title>菜鸟教程(runoob.com)</title>\n</head>\n<body>\n<?php\nfunction spamcheck($field)\n{\n// filter_var() 过滤 e-mail\n// 使用 FILTER_SANITIZE_EMAIL\n$field=filter_var($field, FILTER_SANITIZE_EMAIL);\n\n//filter_var() 过滤 e-mail\n// 使用 FILTER_VALIDATE_EMAIL\nif(filter_var($field, FILTER_VALIDATE_EMAIL))\n{\nreturn TRUE;\n}\nelse\n{\nreturn FALSE;\n}\n}\n\nif (isset($_REQUEST['email']))\n{\n// 如果接收到邮箱参数则发送邮件\n\n// 判断邮箱是否合法\n$mailcheck = spamcheck($_REQUEST['email']);\nif ($mailcheck==FALSE)\n{\necho \"非法输入\";\n}\nelse\n{\n// 发送邮件\n$email = $_REQUEST['email'] ;\n$subject = $_REQUEST['subject'] ;\n$message = $_REQUEST['message'] ;\nmail(\"someone@example.com\", \"Subject: $subject\",\n$message, \"From: $email\" );\necho \"Thank you for using our mail form\";\n}\n}\nelse\n{\n// 如果没有邮箱参数则显示表单\necho \"<form method='post' action='mailform.php'>\nEmail: <input name='email' type='text'><br>\nSubject: <input name='subject' type='text'><br>\nMessage:<br>\n<textarea name='message' rows='15' cols='40'>\n</textarea><br>\n<input type='submit'>\n</form>\";\n}\n?>\n\n</body>\n</html>",
              explanation: "防止 e-mail 注入的最好方法是对输入进行验证"
            },
            practiceSteps: [
              "先通读本节 6 页：PHP Secure E-mails、PHP Session、PHP 错误处理、PHP 异常处理 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 2 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「PHP 表单、Cookie 与 Session」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 2 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-php-5",
          title: "PHP 文件、错误与异常处理",
          summary: "PHP 文件、错误与异常处理（PHP 教程）：本章节我们将为大家介绍如何使用 PHP 语言来编码和解码 JSON 对象 本节含 17 页、3 道配套题。",
          concepts: [
            "PHP JSON",
            "环境配置",
            "JSON 函数",
            "json_encode",
            "语法",
            "参数",
            "实例",
            "json_decode",
            "PHP 7 新特性",
            "PHP MySQL 简介"
          ],
          principles: [
            "本章节我们将为大家介绍如何使用 PHP 语言来编码和解码 JSON 对象",
            "在 php5.2.0 及以上版本已经内置 JSON 扩展",
            "对变量进行 JSON 编码",
            "PHP json_encode() 用于对变量进行 JSON 编码，该函数如果执行成功返回 JSON 数据，否则返回 FALSE",
            "value: 要编码的值",
            "该函数只对 UTF-8 编码的数据有效",
            "以下实例演示了如何将 PHP 数组转换为 JSON 格式数据：",
            "PHP json_decode() 函数用于对 JSON 格式的字符串进行解码，并转换为 PHP 变量"
          ],
          applications: [
            "示例：string json_encode ( $value [, $options = 0 ] )",
            "示例：<?php",
            "示例：mixed json_decode ($json_string [,$assoc = false [, $depth = 512 [, $options =…",
            "示例：mysql> set names utf8;",
            "示例：$conn->close();",
            "示例：use myDB;"
          ],
          pitfalls: [
            "返回最后发生的错误",
            "PHP json_encode() 用于对变量进行 JSON 编码，该函数如果执行成功返回 JSON 数据，否则返回 FALSE",
            "要注意的是 JSON_UNESCAPED_UNICODE 选项，如果我们不希望中文被编码，可以添加该选项",
            "json_string: 待解码的 JSON 字符串，必须是 UTF-8 编码数据",
            "PHP 7 错误处理"
          ],
          method: "按站内顺序读「PHP JSON → PHP 7 新特性 → PHP MySQL 简介 → PHP 连接 MySQL → PHP MySQL 创建数据库 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「PHP JSON、环境配置、JSON 函数」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【PHP JSON】PHP JSON：本章节我们将为大家介绍如何使用 PHP 语言来编码和解码 JSON 对象",
              "【PHP JSON】环境配置：在 php5.2.0 及以上版本已经内置 JSON 扩展",
              "【PHP JSON】JSON 函数：对变量进行 JSON 编码",
              "【PHP JSON】json_encode：PHP json_encode() 用于对变量进行 JSON 编码，该函数如果执行成功返回 JSON 数据，否则返回 FALSE",
              "【PHP JSON】参数：value: 要编码的值",
              "【PHP JSON】实例：以下实例演示了如何将 PHP 数组转换为 JSON 格式数据："
            ],
            mechanism: [
              "本章节我们将为大家介绍如何使用 PHP 语言来编码和解码 JSON 对象",
              "在 php5.2.0 及以上版本已经内置 JSON 扩展",
              "对 JSON 格式的字符串进行解码，转换为 PHP 变量",
              "json_last_error",
              "PHP json_encode() 用于对变量进行 JSON 编码，该函数如果执行成功返回 JSON 数据，否则返回 FALSE",
              "该函数只对 UTF-8 编码的数据有效",
              "要注意的是 JSON_UNESCAPED_UNICODE 选项，如果我们不希望中文被编码，可以添加该选项",
              "以下实例演示了如何将 PHP 数组转换为 JSON 格式数据：",
              "以下实例演示了如何将 PHP 对象转换为 JSON 格式数据：",
              "使用 JSON_UNESCAPED_UNICODE 选项"
            ],
            example: {
              title: "PHP MySQL 读取数据 · 使用 PDO (+ 预处理)",
              language: "php",
              code: "<?php\necho \"<table style='border: solid 1px black;'>\";\necho \"<tr><th>Id</th><th>Firstname</th><th>Lastname</th></tr>\";\n\nclass TableRows extends RecursiveIteratorIterator {\nfunction __construct($it) {\nparent::__construct($it, self::LEAVES_ONLY);\n}\n\nfunction current() {\nreturn \"<td style='width:150px;border:1px solid black;'>\" . parent::current(). \"</td>\";\n}\n\nfunction beginChildren() {\necho \"<tr>\";\n}\n\nfunction endChildren() {\necho \"</tr>\" . \"\\n\";\n}\n}\n\n$servername = \"localhost\";\n$username = \"username\";\n$password = \"password\";\n$dbname = \"myDBPDO\";\n\ntry {\n$conn = new PDO(\"mysql:host=$servername;dbname=$dbname\", $username, $password);\n$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);\n$stmt = $conn->prepare(\"SELECT id, firstname, lastname FROM MyGuests\");\n$stmt->execute();\n\n// 设置结果集为关联数组\n$result = $stmt->setFetchMode(PDO::FETCH_ASSOC);\nforeach(new TableRows(new RecursiveArrayIterator($stmt->fetchAll())) as $k=>$v) {\necho $v;\n}\n}\ncatch(PDOException $e) {\necho \"Error: \" . $e->getMessage();\n}\n$conn = null;\necho \"</table>\";\n?>",
              explanation: "以下实例使用了预处理语句"
            },
            practiceSteps: [
              "先通读本节 17 页：PHP JSON、PHP 7 新特性、PHP MySQL 简介、PHP 连接 MySQL 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「PHP 文件、错误与异常处理」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-php-6",
          title: "PHP 与 MySQL 数据库操作",
          summary: "PHP 与 MySQL 数据库操作（PHP 教程）：AJAX 是一种在无需重新加载整个网页的情况下，能够更新部分网页的技术 本节含 8 页、2 道配套题。",
          concepts: [
            "AJAX 简介",
            "AJAX 是什么？",
            "AJAX 如何工作",
            "AJAX 基于因特网标准",
            "谷歌搜索建议（Google Suggest）",
            "今天就开始使用 AJAX",
            "PHP SimpleXML",
            "什么是 PHP SimpleXML？",
            "安装",
            "PHP SimpleXML 实例"
          ],
          principles: [
            "AJAX 是一种在无需重新加载整个网页的情况下，能够更新部分网页的技术",
            "AJAX = Asynchronous JavaScript and XML.",
            "AJAX 是一种用于创建快速动态网页的技术",
            "AJAX 基于因特网标准，并使用以下技术组合：",
            "XMLHttpRequest 对象（与服务器异步交互数据）",
            "随着谷歌搜索建议功能在 2005 的发布，AJAX 开始流行起来",
            "谷歌搜索建议（Google Suggest）",
            "在我们的 PHP 教程中，我们将演示 AJAX 如何在不重载整个页面的情况下对网页的某些部分进行更新"
          ],
          applications: [
            "示例：<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?>",
            "示例：<!DOCTYPE html>",
            "示例：<html>",
            "示例：mysql> select * from websites;",
            "示例：<?php",
            "示例：3||4"
          ],
          pitfalls: [
            "传统的网页（不使用 AJAX）如果需要更新内容，必须重载整个页面",
            "请注意添加到 URL 末端的参数（q）（包含输入框的内容）",
            "请注意添加到 URL 末端的参数（q）（包含下拉列表的内容）",
            "不要让其他人获得访问权，除了 Web 服务器 (PHP)"
          ],
          method: "按站内顺序读「AJAX 简介 → PHP SimpleXML → PHP - AJAX 与 PHP → PHP - AJAX 与 MySQL → PHP 实例 - AJAX 与 XML → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 2 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「AJAX 简介、AJAX 是什么？、AJAX 如何工作」的用法，并把 2 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【AJAX 简介】AJAX 简介：AJAX 是一种在无需重新加载整个网页的情况下，能够更新部分网页的技术",
              "【AJAX 简介】AJAX 是什么？：AJAX = Asynchronous JavaScript and XML.",
              "【AJAX 简介】AJAX 基于因特网标准：AJAX 基于因特网标准，并使用以下技术组合：",
              "【AJAX 简介】谷歌搜索建议（Google Suggest）：随着谷歌搜索建议功能在 2005 的发布，AJAX 开始流行起来",
              "【AJAX 简介】今天就开始使用 AJAX：在我们的 PHP 教程中，我们将演示 AJAX 如何在不重载整个页面的情况下对网页的某些部分进行更新",
              "【PHP SimpleXML】PHP SimpleXML：PHP SimpleXML 处理最普通的 XML 任务，其余的任务则交由其它扩展处理"
            ],
            mechanism: [
              "AJAX 是一种在无需重新加载整个网页的情况下，能够更新部分网页的技术",
              "AJAX = Asynchronous JavaScript and XML.",
              "AJAX 是一种用于创建快速动态网页的技术",
              "AJAX 通过在后台与服务器进行少量数据交换，使网页实现异步更新",
              "这意味着可以在不重载整个页面的情况下，对网页的某些部分进行更新",
              "传统的网页（不使用 AJAX）如果需要更新内容，必须重载整个页面",
              "有很多使用 AJAX 的应用程序案例：Google Maps、Gmail、Youtube 和 Facebook",
              "AJAX 基于因特网标准，并使用以下技术组合：",
              "XMLHttpRequest 对象（与服务器异步交互数据）",
              "JavaScript/DOM（显示/取回信息）"
            ],
            example: {
              title: "PHP 实例 - AJAX RSS 阅读器 · PHP 文件",
              language: "php",
              code: "<?php\n// rss 文件\n$xml=\"rss_demo.xml\";\n\n$xmlDoc = new DOMDocument();\n$xmlDoc->load($xml);\n\n// 从 \"<channel>\" 中读取元素\n$channel=$xmlDoc->getElementsByTagName('channel')->item(0);\n$channel_title = $channel->getElementsByTagName('title')\n->item(0)->childNodes->item(0)->nodeValue;\n$channel_link = $channel->getElementsByTagName('link')\n->item(0)->childNodes->item(0)->nodeValue;\n$channel_desc = $channel->getElementsByTagName('description')\n->item(0)->childNodes->item(0)->nodeValue;\n\n// 输出 \"<channel>\" 中的元素\necho(\"<p><a href='\" . $channel_link\n. \"'>\" . $channel_title . \"</a>\");\necho(\"<br>\");\necho($channel_desc . \"</p>\");\n\n// 输出 \"<item>\" 中的元素\n$x=$xmlDoc->getElementsByTagName('item');\nfor ($i=0; $i<=1; $i++) {\n$item_title=$x->item($i)->getElementsByTagName('title')\n->item(0)->childNodes->item(0)->nodeValue;\n$item_link=$x->item($i)->getElementsByTagName('link')\n->item(0)->childNodes->item(0)->nodeValue;\n$item_desc=$x->item($i)->getElementsByTagName('description')\n->item(0)->childNodes->item(0)->nodeValue;\necho (\"<p><a href='\" . $item_link\n. \"'>\" . $item_title . \"</a>\");\necho (\"<br>\");\necho ($item_desc . \"</p>\");\n}\n?>",
              explanation: "文件 rss_demo.xml"
            },
            practiceSteps: [
              "先通读本节 8 页：AJAX 简介、PHP SimpleXML、PHP - AJAX 与 PHP、PHP - AJAX 与 MySQL 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 2 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「PHP 与 MySQL 数据库操作」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 2 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-php-7",
          title: "PHP XML、AJAX 与过滤器",
          summary: "PHP XML、AJAX 与过滤器（PHP 教程）：PHP Array 函数允许您访问并操作数组 本节含 13 页、2 道配套题。",
          concepts: [
            "PHP 5 Array 函数",
            "PHP Array 简介",
            "安装",
            "PHP 5 Calendar 函数",
            "PHP Calendar 简介",
            "PHP 5 预定义的 Calendar 常量",
            "PHP cURL 函数",
            "概述",
            "需求",
            "PHP 5 Date/Time 函数"
          ],
          principles: [
            "PHP Array 函数允许您访问并操作数组",
            "支持简单的数组和多维数组",
            "PHP Array 函数是 PHP 核心的组成部分",
            "无需安装即可使用这些函数",
            "array_change_key_case()",
            "日历扩展包含了简化不同日历格式间的转换的函数",
            "它是基于 Julian Day Count（儒略日计数），是从公元前 4713 年 1 月 1 日开始计算的",
            "为了让这些函数能够工作，您必须通过 --enable-calendar 编译 PHP"
          ],
          applications: ["配套练习：本节 2 道测验题覆盖了这些用法。"],
          pitfalls: [
            "注释：如需在日历格式之间转换，必须首先转换为 Julian Day Count，然后再转换为您需要的日历格式",
            "为了让这些函数能够工作，您必须通过 --enable-calendar 编译 PHP",
            "要使用PHP的cURL支持你必须在编译PHP时加上--with-curl[=DIR] 选项，DIR为包含lib和include的目录路径",
            "在include目录中必须有一个名为curl，包含了easy.h和curl.h的文件夹",
            "注意: Win32用户注意"
          ],
          method: "按站内顺序读「PHP 5 Array 函数 → PHP 5 Calendar 函数 → PHP cURL 函数 → PHP 5 Date/Time 函数 → PHP 5 Directory 函数 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 2 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「PHP 5 Array 函数、PHP Array 简介、安装」的用法，并把 2 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【PHP 5 Array 函数】PHP Array 简介：PHP Array 函数允许您访问并操作数组",
              "【PHP 5 Array 函数】安装：PHP Array 函数是 PHP 核心的组成部分",
              "【PHP 5 Array 函数】PHP 5 Array 函数：array_change_key_case()",
              "【PHP 5 Calendar 函数】PHP Calendar 简介：日历扩展包含了简化不同日历格式间的转换的函数",
              "【PHP 5 Calendar 函数】安装：为了让这些函数能够工作，您必须通过 --enable-calendar 编译 PHP",
              "【PHP 5 Calendar 函数】PHP 5 Calendar 函数：cal_days_in_month()"
            ],
            mechanism: [
              "PHP Array 函数允许您访问并操作数组",
              "PHP Array 函数是 PHP 核心的组成部分",
              "array_change_key_case()",
              "返回其键均为大写或小写的数组",
              "array_column()",
              "返回输入数组中某个单一列的值",
              "array_combine()",
              "通过合并两个数组（一个为键名数组，一个为键值数组）来创建一个新数组",
              "array_count_values()",
              "用于统计数组中所有值出现的次数"
            ],
            example: {
              title: "PHP 5 Array 函数 · 示例",
              language: "php",
              code: "PHP Array 函数允许您访问并操作数组。\n支持简单的数组和多维数组。",
              explanation: "本节以概念与用法为主，示例请对照「PHP 教程」站点原文动手验证。"
            },
            practiceSteps: [
              "先通读本节 13 页：PHP 5 Array 函数、PHP 5 Calendar 函数、PHP cURL 函数、PHP 5 Date/Time 函数 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 2 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「PHP XML、AJAX 与过滤器」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 2 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-php-8",
          title: "PHP 内置函数参考",
          summary: "PHP 内置函数参考（PHP 教程）：PHP 数据对象（PDO）扩展为PHP访问数据库定义了一个轻量级的一致接口 本节含 12 页、3 道配套题。",
          concepts: [
            "PHP PDO",
            "PDO 安装",
            "在 Unix 系统上安装 PDO",
            "Windows 用户",
            "PHP 杂项 函数",
            "PHP 杂项函数简介",
            "安装",
            "Runtime 配置",
            "PHP 杂项函数",
            "PHP 杂项常量"
          ],
          principles: [
            "PHP 数据对象（PDO）扩展为PHP访问数据库定义了一个轻量级的一致接口",
            "PDO 提供了一个数据访问抽象层，这意味着，不管使用哪种数据库，都可以用相同的函数（方法）来查询和获取数据",
            "你可以通过 PHP 的 phpinfo() 函数来查看是否安装了PDO扩展",
            "在Unix上或Linux上你需要添加以下扩展：",
            "PDO 和所有主要的驱动作为共享扩展随 PHP 一起发布，要激活它们只需简单地编辑 php.ini 文件，并添加以下扩展：",
            "在设定好这些配置后，我们需要重启PHP 或 Web服务器",
            "我们把不属于其他类别的函数归纳到杂项函数类别",
            "杂项函数是 PHP 核心的组成部分"
          ],
          applications: [
            "示例：extension=pdo.so",
            "示例：extension=php_pdo.dll",
            "示例：preg_match(pattern, subject, matches)",
            "示例：preg_match_all(pattern, subject, matches)",
            "示例：preg_replace(pattern, replacement, subject)",
            "示例：<?php"
          ],
          pitfalls: [
            "PHP PDO 错误与错误处理",
            "PDO::errorInfo — 返回最后一次操作数据库的错误信息",
            "PDOStatement::errorInfo — 获取跟上一次语句句柄操作相关的扩展错误信息",
            "为了能够顺利使用 MySQLi 函数，您必须在编译 PHP 时添加对 MySQLi 扩展的支持",
            "返回上一次连接错误的错误代码"
          ],
          method: "按站内顺序读「PHP PDO → PHP 杂项 函数 → PHP 5 MySQLi 函数 → PHP 5 SimpleXML 函数 → PHP 5 String 函数 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「PHP PDO、PDO 安装、在 Unix 系统上安装 PDO」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【PHP PDO】PHP PDO：PHP 数据对象（PDO）扩展为PHP访问数据库定义了一个轻量级的一致接口",
              "【PHP PDO】PDO 安装：你可以通过 PHP 的 phpinfo() 函数来查看是否安装了PDO扩展",
              "【PHP PDO】在 Unix 系统上安装 PDO：在Unix上或Linux上你需要添加以下扩展：",
              "【PHP PDO】Windows 用户：PDO 和所有主要的驱动作为共享扩展随 PHP 一起发布，要激活它们只需简单地编辑 php.ini 文件，并添加以下扩展：",
              "【PHP 杂项 函数】PHP 杂项函数简介：我们把不属于其他类别的函数归纳到杂项函数类别",
              "【PHP 杂项 函数】安装：杂项函数是 PHP 核心的组成部分"
            ],
            mechanism: [
              "PHP 数据对象（PDO）扩展为PHP访问数据库定义了一个轻量级的一致接口",
              "PDO 提供了一个数据访问抽象层，这意味着，不管使用哪种数据库，都可以用相同的函数（方法）来查询和获取数据",
              "PDO随PHP5.1发行，在PHP5.0的PECL扩展中也可以使用，无法运行于之前的PHP版本",
              "你可以通过 PHP 的 phpinfo() 函数来查看是否安装了PDO扩展",
              "在Unix上或Linux上你需要添加以下扩展：",
              "PDO 和所有主要的驱动作为共享扩展随 PHP 一起发布，要激活它们只需简单地编辑 php.ini 文件，并添加以下扩展：",
              "在设定好这些配置后，我们需要重启PHP 或 Web服务器",
              "接下来我们们来看下具体的实例，以下为使用PDO连接MySql数据库的实例：",
              "很简单吧，接下来就让我们来具体看下PHP PDO具体说明：",
              "PHP PDO 事务与自动提交"
            ],
            example: {
              title: "PHP PDO · Windows 用户",
              language: "php",
              code: "<?php\n\n$dbms='mysql'; //数据库类型\n\n$host='localhost'; //数据库主机名\n\n$dbName='test'; //使用的数据库\n\n$user='root'; //数据库连接用户名\n\n$pass=''; //对应的密码\n\n$dsn=\"$dbms:host=$host;dbname=$dbName\";\n\ntry {\n\n$dbh = new PDO($dsn, $user, $pass); //初始化一个PDO对象\n\necho \"连接成功<br/>\";\n\n/*你还可以进行一次搜索操作\n\nforeach ($dbh->query('SELECT * from FOO') as $row) {\n\nprint_r($row); //你可以用 echo($GLOBAL); 来看到这些值\n\n}\n\n*/\n\n$dbh = null;\n\n} catch (PDOException $e) {\n\ndie (\"Error!: \" . $e->getMessage() . \"<br/>\");\n\n}\n\n//默认这个不是长连接，如果需要数据库长连接，需要最后加一个参数：array(PDO::ATTR_PERSISTENT => true) 变成这样：\n\n$db = new PDO($dsn, $user, $pass, array(PDO::ATTR_PERSISTENT => true));\n\n?>",
              explanation: "PDO 和所有主要的驱动作为共享扩展随 PHP 一起发布，要激活它们只需简单地编辑 php.ini 文件，并添加以下扩展："
            },
            practiceSteps: [
              "先通读本节 12 页：PHP PDO、PHP 杂项 函数、PHP 5 MySQLi 函数、PHP 5 SimpleXML 函数 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「PHP 内置函数参考」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-php-1",
        "rn-php-2",
        "rn-php-3",
        "rn-php-10",
        "rn-php-14",
        "rn-php-15",
        "rn-php-6",
        "rn-php-17",
        "rn-php-20",
        "rn-php-9",
        "rn-php-21",
        "rn-php-4",
        "rn-php-5",
        "rn-php-12",
        "rn-php-16",
        "rn-php-18",
        "rn-php-11",
        "rn-php-19",
        "rn-php-7",
        "rn-php-8",
        "rn-php-13"
      ],
      lesson: {
        overview: [
          "《PHP 教程》取自菜鸟教程，共 93 页，整理为 8 个知识点、21 道配套测验题。",
          "知识点顺序保持站内阅读顺序：PHP 入门、语法与变量 → PHP 运算符、流程控制与数组 → PHP 函数、面向对象与命名空间 → PHP 表单、Cookie 与 Session → PHP 文件、错误与异常处理 → PHP 与 MySQL 数据库操作 → PHP XML、AJAX 与过滤器 → PHP 内置函数参考。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 21 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 PHP 入门、语法与变量 并跑通示例",
            evidence: "本地示例输出与站点示例一致"
          },
          {
            title: "完成全部配套测验",
            evidence: "题正确率 ≥ 80%（共 21 道）"
          },
          {
            title: "能独立复述全部知识点",
            evidence: "不看文档说出每个知识点的用法与易错点"
          }
        ],
        completionCriteria: ["《PHP 教程》8 个知识点全部读完。", "配套 21 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    },
    {
      key: "rn-asp-stage",
      title: "ASP 教程",
      weeks: "第 1 阶段",
      goal: "把「ASP 教程」的 36 页内容按 3 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出ASP 教程的典型用法，并把 20 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-asp-1",
          title: "ASP 入门与基础语法",
          summary: "ASP 入门与基础语法（ASP 教程）：ASP（Active Server Pages 动态服务器页面）是一种生成动态交互性网页的强有力工具 本节含 12 页、6 道配套题。",
          concepts: [
            "ASP 教程",
            "通过实例学习 ASP",
            "ASP 实例",
            "ASP 简介",
            "您应当具备的基础知识",
            "ASP 是什么？",
            "ASP 兼容性",
            "ASP 文件是什么？",
            "ASP 和 HTML 有何不同？",
            "ASP 能为您做什么？"
          ],
          principles: [
            "ASP（Active Server Pages 动态服务器页面）是一种生成动态交互性网页的强有力工具",
            "在我们的 ASP 教程中，您将学到 ASP 的相关知识，以及如何在服务器上执行脚本",
            "在本站的 ASP 教程中包含了 100 多个实例",
            "我们的 ASP 在线实例让您能够更简单的学习 ASP，实例中包含了 ASP 的源码及运行结果",
            "ASP 脚本只能在服务器端执行，所以无法在浏览器中查看 ASP 代码，只能看到由 ASP 输出的纯粹 HTML 代码",
            "ASP 文件可包含文本、HTML 标签和脚本",
            "ASP 文件中的脚本可在服务器上执行",
            "在继续学习之前，您需要对以下知识有基本的了解："
          ],
          applications: ["示例：<!DOCTYPE html>"],
          pitfalls: [
            "提供安全性保障 - •由于 ASP 代码不能从浏览器查看",
            "这里，您将看到 Active Server Pages 是被禁止的（这是 IIS 6 的默认配置）",
            "如果需要设置 JavaScript 为某个特定页面的默认脚本语言，您必须在页面的顶部插入一行语言说明：",
            "你必须根据 JavaScript 的需要使用不同的大小写字母编写您的 ASP 代码",
            "如果您想要使用其他语言编写脚本，比如 PERL、REXX 或者 Python，您必须安装相应的脚本引擎"
          ],
          method: "按站内顺序读「ASP 教程 → ASP 简介 → 在自己的 PC 上运行 ASP → ASP 基本语法规则 → ASP 变量 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 6 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「ASP 教程、通过实例学习 ASP、ASP 实例」的用法，并把 6 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【ASP 教程】ASP 教程：ASP（Active Server Pages 动态服务器页面）是一种生成动态交互性网页的强有力工具",
              "【ASP 教程】通过实例学习 ASP：在本站的 ASP 教程中包含了 100 多个实例",
              "【ASP 教程】ASP 实例：ASP 脚本只能在服务器端执行，所以无法在浏览器中查看 ASP 代码，只能看到由 ASP 输出的纯粹 HTML 代码",
              "【ASP 简介】ASP 简介：ASP 文件可包含文本、HTML 标签和脚本",
              "【ASP 简介】您应当具备的基础知识：在继续学习之前，您需要对以下知识有基本的了解：",
              "【ASP 简介】ASP 是什么？：ASP 代表 Active Server Pages （动态服务器页面）"
            ],
            mechanism: [
              "ASP（Active Server Pages 动态服务器页面）是一种生成动态交互性网页的强有力工具",
              "在我们的 ASP 教程中，您将学到 ASP 的相关知识，以及如何在服务器上执行脚本",
              "在本站的 ASP 教程中包含了 100 多个实例",
              "我们的 ASP 在线实例让您能够更简单的学习 ASP，实例中包含了 ASP 的源码及运行结果",
              "点击\"演示实例\"按钮查看在线实例运行结果",
              "ASP 脚本只能在服务器端执行，所以无法在浏览器中查看 ASP 代码，只能看到由 ASP 输出的纯粹 HTML 代码",
              "在菜鸟教程，每个实例均可显示出以往被隐藏的 ASP 代码",
              "这样，您就可以更容易地理解它们的工作原理",
              "ASP 文件可包含文本、HTML 标签和脚本",
              "ASP 文件中的脚本可在服务器上执行"
            ],
            example: {
              title: "ASP 子程序 · 子程序",
              language: "asp",
              code: "<%@ language=\"javascript\" %>\n\n<!DOCTYPE html>\n<html>\n\n<head>\n\n<%\n\nfunction jsproc(num1,num2)\n\n{\n\nResponse.Write(num1*num2)\n\n}\n\n%>\n\n</head>\n\n<body>\n\n<p>Result: <%jsproc(3,4)%></p>\n\n</body>\n\n</html>",
              explanation: "ASP 源代码可包含子程序和函数："
            },
            practiceSteps: [
              "先通读本节 12 页：ASP 教程、ASP 简介、在自己的 PC 上运行 ASP、ASP 基本语法规则 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 6 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「ASP 入门与基础语法」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 6 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-asp-2",
          title: "ASP 内置对象与表单处理",
          summary: "ASP 内置对象与表单处理（ASP 教程）：CDOSYS 是 ASP 中的内建组件 本节含 18 页、8 道配套题。",
          concepts: [
            "ASP 使用 CDOSYS发送电子邮件",
            "使用 CDOSYS 发送电子邮件",
            "CDONTs 怎么样？",
            "使用 CDOSYS 的实例",
            "ASP Response 对象",
            "尝试一下 - 实例",
            "Response 对象",
            "集合",
            "属性",
            "方法"
          ],
          principles: [
            "CDOSYS 是 ASP 中的内建组件",
            "此组件用于通过 ASP 发送电子邮件",
            "CDO (Collaboration Data Objects) 是一项微软的技术，设计目的是用来简化通讯应用程序的创建",
            "微软已经在 Windows 2000、Windows XP 和 Windows 2003 中淘汰了 CDONTs",
            "如果您已经在您的 ASP 应用程序中使用 CDONTs，那么您需要更新代码，并使用新的 CDO 技术",
            "发送带有 Bcc 和 CC 字段的文本电子邮件：",
            "ASP Response 对象用于从服务器向用户发送输出的结果",
            "本例演示如何使用 ASP 来写文本"
          ],
          applications: ["示例：<%", "示例：<!DOCTYPE html>", "示例：<html>"],
          pitfalls: [
            "设置页面在失效前在浏览器中缓存时间",
            "本例演示如何规定页面在失效前在浏览器中的缓存时间",
            "设置页面缓存在浏览器中的失效日期或时间",
            "本例演示如何规定页面缓存在浏览器中的失效时间日期或时间",
            "设置页面在失效前的浏览器缓存时间（分钟）"
          ],
          method: "按站内顺序读「ASP 使用 CDOSYS发送电子邮件 → ASP Response 对象 → ASP Request 对象 → ASP Session 对象 → ASP Server 对象 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 8 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「ASP 使用 CDOSYS发送电子邮件、使用 CDOSYS 发送电子邮件、CDONTs 怎么样？」的用法，并把 8 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【ASP 使用 CDOSYS发送电子邮件】ASP 使用 CDOSYS发送电子邮件：CDOSYS 是 ASP 中的内建组件",
              "【ASP 使用 CDOSYS发送电子邮件】使用 CDOSYS 发送电子邮件：CDO (Collaboration Data Objects) 是一项微软的技术，设计目的是用来简化通讯应用程序的创建",
              "【ASP 使用 CDOSYS发送电子邮件】CDONTs 怎么样？：微软已经在 Windows 2000、Windows XP 和 Windows 2003 中淘汰了 CDONTs",
              "【ASP 使用 CDOSYS发送电子邮件】使用 CDOSYS 的实例：发送带有 Bcc 和 CC 字段的文本电子邮件：",
              "【ASP Response 对象】ASP Response 对象：ASP Response 对象用于从服务器向用户发送输出的结果",
              "【ASP Response 对象】尝试一下 - 实例：本例演示如何使用 ASP 来写文本"
            ],
            mechanism: [
              "CDOSYS 是 ASP 中的内建组件",
              "此组件用于通过 ASP 发送电子邮件",
              "CDO (Collaboration Data Objects) 是一项微软的技术，设计目的是用来简化通讯应用程序的创建",
              "我们将向您演示如何通过 ASP 使用该组件来发送电子邮件",
              "微软已经在 Windows 2000、Windows XP 和 Windows 2003 中淘汰了 CDONTs",
              "如果您已经在您的 ASP 应用程序中使用 CDONTs，那么您需要更新代码，并使用新的 CDO 技术",
              "发送带有 Bcc 和 CC 字段的文本电子邮件：",
              "发送一封内容为某个网站的某个网页的 HTML 电子邮件：",
              "发送一封内容为您的计算机中某个文件的某个网页的 HTML 电子邮件：",
              "发送一封带有附件的文本电子邮件："
            ],
            example: {
              title: "ASP Browser Capabilities 组件 · ASP Browser Capabilities 实例",
              language: "asp",
              code: "<!DOCTYPE html>\n<html>\n\n<body>\n\n<%\n\nSet MyBrow=Server.CreateObject(\"MSWC.BrowserType\")\n\n%>\n\n<table border=\"0\" width=\"100%\">\n\n<tr>\n\n<th>Client OS</th><th><%=MyBrow.platform%></th>\n\n</tr><tr>\n\n<td >Web Browser</td><td ><%=MyBrow.browser%></td>\n\n</tr><tr>\n\n<td>Browser version</td><td><%=MyBrow.version%></td>\n\n</tr><tr>\n\n<td>Frame support?</td><td><%=MyBrow.frames%></td>\n\n</tr><tr>\n\n<td>Table support?</td><td><%=MyBrow.tables%></td>\n\n</tr><tr>\n\n<td>Sound support?</td><td><%=MyBrow.backgroundsounds%></td>\n\n</tr><tr>\n\n<td>Cookies support?</td><td><%=MyBrow.cookies%></td>\n\n</tr><tr>\n\n<td>VBScript support?</td><td><%=MyBrow.vbscript%></td>\n\n</tr><tr>\n\n<td>JavaScript support?</td><td><%=MyBrow.javascript%></td>\n\n</tr>\n\n</table>\n\n</body>\n\n</html>",
              explanation: "下面的实例会在 ASP 文件中创建一个 BrowserType 对象，并显示当前浏览器性能的一些信息："
            },
            practiceSteps: [
              "先通读本节 18 页：ASP 使用 CDOSYS发送电子邮件、ASP Response 对象、ASP Request 对象、ASP Session 对象 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 8 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「ASP 内置对象与表单处理」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 8 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-asp-3",
          title: "ASP 组件、会话与数据库访问",
          summary: "ASP 组件、会话与数据库访问（ASP 教程）：AJAX 可用来与数据库进行交互式通信 本节含 6 页、6 道配套题。",
          concepts: [
            "AJAX 数据库实例",
            "实例解释 - HTML 页面",
            "ASP 文件",
            "AJAX 简介",
            "AJAX 是什么？",
            "AJAX 如何工作",
            "AJAX 基于因特网标准",
            "谷歌搜索建议（Google Suggest）",
            "今天就开始使用 AJAX",
            "ASP - AJAX 与 ASP"
          ],
          principles: [
            "AJAX 可用来与数据库进行交互式通信",
            "下面的实例将演示网页如何通过 AJAX 从数据库读取信息：",
            "当用户在上面的下拉列表中选择某位客户时，会执行名为 \"showCustomer()\" 的函数",
            "该函数由 \"onchange\" 事件触发：",
            "上面这段通过 JavaScript 调用的服务器页面是名为 \"getcustomer.asp\" 的 ASP 文件",
            "\"getcustomer.asp\" 中的源代码会运行一次针对数据库的查询，然后在 HTML 表格中返回结果：",
            "AJAX 是一种在不重载整个页面的情况下对网页的某些部分进行更新的技术",
            "AJAX = Asynchronous JavaScript and XML."
          ],
          applications: ["配套练习：本节 6 道测验题覆盖了这些用法。"],
          pitfalls: [
            "请注意添加到 URL 末端的参数（q）（包含下拉列表的内容）",
            "传统的网页（不使用 AJAX）如果需要更新内容，必须重载整个页面",
            "请注意添加到 URL 末端的参数（q）（包含输入框的内容）",
            "注释：Response.Cookies 命令必须出现在 <html> 标签之前",
            "注释：Global.asa 文件必须存放在 ASP 应用程序的根目录中，而且每个应用程序只能有一个 Global.asa 文件"
          ],
          method: "按站内顺序读「AJAX 数据库实例 → AJAX 简介 → ASP - AJAX 与 ASP → 您已经学习了 ASP，下一步呢？ → ASP 快速参考 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 6 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「AJAX 数据库实例、实例解释 - HTML 页面、ASP 文件」的用法，并把 6 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【AJAX 数据库实例】AJAX 数据库实例：AJAX 可用来与数据库进行交互式通信",
              "【AJAX 数据库实例】AJAX 数据库实例：下面的实例将演示网页如何通过 AJAX 从数据库读取信息：",
              "【AJAX 数据库实例】实例解释 - HTML 页面：当用户在上面的下拉列表中选择某位客户时，会执行名为 \"showCustomer()\" 的函数",
              "【AJAX 数据库实例】ASP 文件：上面这段通过 JavaScript 调用的服务器页面是名为 \"getcustomer.asp\" 的 ASP 文件",
              "【AJAX 简介】AJAX 简介：AJAX 是一种在不重载整个页面的情况下对网页的某些部分进行更新的技术",
              "【AJAX 简介】AJAX 是什么？：AJAX = Asynchronous JavaScript and XML."
            ],
            mechanism: [
              "AJAX 可用来与数据库进行交互式通信",
              "下面的实例将演示网页如何通过 AJAX 从数据库读取信息：",
              "当用户在上面的下拉列表中选择某位客户时，会执行名为 \"showCustomer()\" 的函数",
              "该函数由 \"onchange\" 事件触发：",
              "如果没有选择客户（str.length==0），那么该函数会清空 txtHint 占位符，然后退出该函数",
              "如果已选择一位客户，则 showCustomer() 函数会执行以下步骤：",
              "创建 XMLHttpRequest 对象",
              "创建在服务器响应就绪时执行的函数",
              "请注意添加到 URL 末端的参数（q）（包含下拉列表的内容）",
              "上面这段通过 JavaScript 调用的服务器页面是名为 \"getcustomer.asp\" 的 ASP 文件"
            ],
            example: {
              title: "AJAX 数据库实例 · 示例",
              language: "asp",
              code: "AJAX 可用来与数据库进行交互式通信。",
              explanation: "本节以概念与用法为主，示例请对照「ASP 教程」站点原文动手验证。"
            },
            practiceSteps: [
              "先通读本节 6 页：AJAX 数据库实例、AJAX 简介、ASP - AJAX 与 ASP、您已经学习了 ASP，下一步呢？ 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 6 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「ASP 组件、会话与数据库访问」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 6 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-asp-2",
        "rn-asp-4",
        "rn-asp-8",
        "rn-asp-16",
        "rn-asp-17",
        "rn-asp-20",
        "rn-asp-1",
        "rn-asp-7",
        "rn-asp-9",
        "rn-asp-11",
        "rn-asp-12",
        "rn-asp-15",
        "rn-asp-18",
        "rn-asp-19",
        "rn-asp-3",
        "rn-asp-5",
        "rn-asp-6",
        "rn-asp-10",
        "rn-asp-13",
        "rn-asp-14"
      ],
      lesson: {
        overview: [
          "《ASP 教程》取自菜鸟教程，共 36 页，整理为 3 个知识点、20 道配套测验题。",
          "知识点顺序保持站内阅读顺序：ASP 入门与基础语法 → ASP 内置对象与表单处理 → ASP 组件、会话与数据库访问。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 20 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 ASP 入门与基础语法 并跑通示例",
            evidence: "本地示例输出与站点示例一致"
          },
          {
            title: "完成全部配套测验",
            evidence: "题正确率 ≥ 80%（共 20 道）"
          },
          {
            title: "能独立复述全部知识点",
            evidence: "不看文档说出每个知识点的用法与易错点"
          }
        ],
        completionCriteria: ["《ASP 教程》3 个知识点全部读完。", "配套 20 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    }
  ],
  questions: [
    {
      key: "rn-python-5",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-1",
      type: "single",
      stem: "Python 中，以下哪个变量的赋值是正确的？",
      options: [
        {
          key: "A",
          text: "var a = 2"
        },
        {
          key: "B",
          text: "int a = 2"
        },
        {
          key: "C",
          text: "a = 2"
        },
        {
          key: "D",
          text: "variable a = 2"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. a = 2\n\n回答错误，正确答案为 a = 2。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-6",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-1",
      type: "single",
      stem: "变量 a 的值为字符串类型的 \"2\"，如何将它转换为整型？",
      options: [
        {
          key: "A",
          text: "castToInt(a)"
        },
        {
          key: "B",
          text: "int(a)"
        },
        {
          key: "C",
          text: "integer(a)"
        },
        {
          key: "D",
          text: "castToInteger(a)"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. int(a)\n\n回答错误，正确答案为 int(a)。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-14",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-1",
      type: "single",
      stem: "以下代码中哪个是定义函数的语句是正确的？",
      options: [
        {
          key: "A",
          text: "def someFunction():"
        },
        {
          key: "B",
          text: "function someFunction()"
        },
        {
          key: "C",
          text: "def someFunction()"
        },
        {
          key: "D",
          text: "function someFunction():"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. def someFunction():\n\n回答错误，正确答案为 def someFunction():。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-17",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-1",
      type: "single",
      stem: "假设你有一个变量 \"example\"，如何判断它的类型？",
      options: [
        {
          key: "A",
          text: "getType(example)"
        },
        {
          key: "B",
          text: "Type(example)"
        },
        {
          key: "C",
          text: "type(example)"
        },
        {
          key: "D",
          text: "example.type:"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. type(example)\n\n回答错误，正确答案为 type(example)。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-3",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-2",
      type: "single",
      stem: "以下哪个符号是用作 Python 的注释？",
      options: [
        {
          key: "A",
          text: "*"
        },
        {
          key: "B",
          text: "(comment)"
        },
        {
          key: "C",
          text: "//"
        },
        {
          key: "D",
          text: "#"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. #\n\n回答错误，正确答案为 #。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-4",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-2",
      type: "single",
      stem: "以下哪个标记是用作 Python 的多行注释？",
      options: [
        {
          key: "A",
          text: "'''"
        },
        {
          key: "B",
          text: "///"
        },
        {
          key: "C",
          text: "###"
        },
        {
          key: "D",
          text: "(comment)"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. '''\n\n回答错误，正确答案为'''。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-7",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-2",
      type: "single",
      stem: "Python 中，以下哪个赋值操作符是错误的？",
      options: [
        {
          key: "A",
          text: "+="
        },
        {
          key: "B",
          text: "-="
        },
        {
          key: "C",
          text: "*="
        },
        {
          key: "D",
          text: "X="
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. X=\n\n回答错误，正确答案为 X=。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-13",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-2",
      type: "single",
      stem: "以下哪个关键字是用于给 if 语句添加其他条件语句的？",
      options: [
        {
          key: "A",
          text: "else if"
        },
        {
          key: "B",
          text: "elseif"
        },
        {
          key: "C",
          text: "elif"
        },
        {
          key: "D",
          text: "以上都不是"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. elif\n\n回答错误，正确答案为 elif。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-25",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-2",
      type: "single",
      stem: "Python 中，如何输出列表中的第二个元素？",
      options: [
        {
          key: "A",
          text: "print(example[2])"
        },
        {
          key: "B",
          text: "echo(example[2])"
        },
        {
          key: "C",
          text: "print(example[1])"
        },
        {
          key: "D",
          text: "print(example(2))"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. print(example[1])\n\n回答错误，正确答案为 print(example[1])。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-8",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-3",
      type: "single",
      stem: "下面哪一个不是 Python 的数据类型？",
      options: [
        {
          key: "A",
          text: "列表（List）"
        },
        {
          key: "B",
          text: "字典（Dictionary）"
        },
        {
          key: "C",
          text: "元组（Tuples）"
        },
        {
          key: "D",
          text: "类（Class）"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 类（Class）\n\n回答错误，类是用户自定义的类型。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-12",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-3",
      type: "single",
      stem: "以下哪个 if 语句是正确的？",
      options: [
        {
          key: "A",
          text: "if a >= 22:"
        },
        {
          key: "B",
          text: "if (a >= 22)"
        },
        {
          key: "C",
          text: "if (a => 22)"
        },
        {
          key: "D",
          text: "if a >= 22"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. if a >= 22:\n\n回答错误，正确答案为 if a >= 22:。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-19",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-3",
      type: "single",
      stem: "Python 中，以下哪个代码是正确的列表？",
      options: [
        {
          key: "A",
          text: "sampleList = {1,2,3,4,5}"
        },
        {
          key: "B",
          text: "sampleList = (1,2,3,4,5)"
        },
        {
          key: "C",
          text: "sampleList = /1,2,3,4,5/"
        },
        {
          key: "D",
          text: "sampleList = [1,2,3,4,5]"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. sampleList = [1,2,3,4,5]\n\n回答错误，正确答案为 sampleList = [1,2,3,4,5]。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-27",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-3",
      type: "single",
      stem: "代码 def a(b, c, d): pass 含义是？",
      options: [
        {
          key: "A",
          text: "定义一个列表，并初始化它。"
        },
        {
          key: "B",
          text: "定义一个函数，但什么都不做。"
        },
        {
          key: "C",
          text: "定义一个函数，并传递参数。"
        },
        {
          key: "D",
          text: "定义一个空的类。"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. 定义一个函数，但什么都不做。\n\n回答错误，def 用于定义一个函数，pass 语句表示什么都不做。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-28",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-3",
      type: "single",
      stem: "以下哪个关键字是与 try 语句一起使用来处理异常的？",
      options: [
        {
          key: "A",
          text: "catch"
        },
        {
          key: "B",
          text: "exception"
        },
        {
          key: "C",
          text: "catch(a)"
        },
        {
          key: "D",
          text: "except"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. except\n\n回答错误，正确答案为 except。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-9",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-4",
      type: "single",
      stem: "代码 L = [1, 23, \"runoob\", 1] 输出的数据类型是？",
      options: [
        {
          key: "A",
          text: "List"
        },
        {
          key: "B",
          text: "Dictionary"
        },
        {
          key: "C",
          text: "Tuple"
        },
        {
          key: "D",
          text: "Array"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. List\n\n回答错误，[] 用于定义一个列表。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-11",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-4",
      type: "single",
      stem: "以下哪个代码是将字符串转换为浮点数？",
      options: [
        {
          key: "A",
          text: "int(x [,base])"
        },
        {
          key: "B",
          text: "long(x [,base] )"
        },
        {
          key: "C",
          text: "float(x)"
        },
        {
          key: "D",
          text: "str(x)"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. float(x)\n\n回答错误，float(x) − 将 x 转换为浮点数。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-18",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-4",
      type: "single",
      stem: "将字符串 \"example\" 中的字母 a 替换为字母 b，以下代码正确的是？",
      options: [
        {
          key: "A",
          text: "example.swap('b', 'a')"
        },
        {
          key: "B",
          text: "example.replace('a','b')"
        },
        {
          key: "C",
          text: "example.match('b','a')"
        },
        {
          key: "D",
          text: "example.replace('b','a')"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. example.replace('a','b')\n\n回答错误，正确答案为 example.replace('a','b')。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-24",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-4",
      type: "single",
      stem: "<p>a = [1,2,3,None,(),[],]</p><p>print(len(a))</p><p>以上代码输出结果为？</p>",
      options: [
        {
          key: "A",
          text: "syntax error"
        },
        {
          key: "B",
          text: "4"
        },
        {
          key: "C",
          text: "5"
        },
        {
          key: "D",
          text: "6"
        },
        {
          key: "E",
          text: "7"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 6\n\n回答错误，都是合法元素。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-10",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-5",
      type: "single",
      stem: "代码 a = [ 1,2,3,4,5 ]，以下输出结果正确的是？",
      options: [
        {
          key: "A",
          text: "print(a[:]) => [1,2,3,4]"
        },
        {
          key: "B",
          text: "print(a[0:]) => [2,3,4,5]"
        },
        {
          key: "C",
          text: "print(a[:100]) => [1,2,3,4,5]"
        },
        {
          key: "D",
          text: "print(a[-1:]) => [1,2]"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. print(a[:100]) => [1,2,3,4,5]\n\n本题考查「代码 a = [ 1,2,3,4,5 ]，以下输出结果正确的是？」，正确答案是 print(a[:100]) => [1,2,3,4,5]。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-21",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-5",
      type: "single",
      stem: "Python 中，以下哪个代码是正确的字典？",
      options: [
        {
          key: "A",
          text: "myExample = {'someItem'=>2, 'otherItem'=>20}"
        },
        {
          key: "B",
          text: "myExample = {'someItem': 2, 'otherItem': 20}"
        },
        {
          key: "C",
          text: "myExample = ('someItem'=>2, 'otherItem'=>20)"
        },
        {
          key: "D",
          text: "myExample = ('someItem': 2, 'otherItem': 20)"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. myExample = {'someItem': 2, 'otherItem': 20}\n\n回答错误，正确答案为 myExample = {'someItem': 2, 'otherItem': 20}。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-22",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-5",
      type: "single",
      stem: "代码 print(type([1,2])) 输出结果为：",
      options: [
        {
          key: "A",
          text: "<class 'tuple'>"
        },
        {
          key: "B",
          text: "<class 'int'>"
        },
        {
          key: "C",
          text: "<class 'set'>"
        },
        {
          key: "D",
          text: "<class 'list'>"
        },
        {
          key: "E",
          text: "<class 'complex'>"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. <class 'list'>\n\n回答错误，正确为 list，列表的定义方式为使用中括号、元素使用逗号隔开。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-23",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-5",
      type: "single",
      stem: "<p>def f(): pass</p><p>print(type(f()))</p><p>以上代码输出结果为？</p>",
      options: [
        {
          key: "A",
          text: "<class 'function'>"
        },
        {
          key: "B",
          text: "<class 'tuple'>"
        },
        {
          key: "C",
          text: "<class 'NoneType'>"
        },
        {
          key: "D",
          text: "<class 'str'>"
        },
        {
          key: "E",
          text: "<class 'type'>"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. <class 'NoneType'>\n\n回答错误， type() 的参数是函数的返回值，该返回值为 None。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-29",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-5",
      type: "single",
      stem: "以下哪个代码是正确的读取一个文件？",
      options: [
        {
          key: "A",
          text: "f = open(\"test.txt\", \"read\")"
        },
        {
          key: "B",
          text: "f = open(\"r\",\"test.txt\")"
        },
        {
          key: "C",
          text: "f = open(\"test.txt\", \"r\")"
        },
        {
          key: "D",
          text: "f = open(\"read\",\"test.txt\")"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. f = open(\"test.txt\", \"r\")\n\n回答错误，正确答案为 f = open(\"test.txt\", \"r\")。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-1",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-6",
      type: "single",
      stem: "Python 中，以下哪个函数是用于输出内容到终端的？",
      options: [
        {
          key: "A",
          text: "echo"
        },
        {
          key: "B",
          text: "output"
        },
        {
          key: "C",
          text: "print"
        },
        {
          key: "D",
          text: "console.log"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. print\n\n回答错误，正确答案为 print。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-2",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-6",
      type: "single",
      stem: "以下关于 Python 的描述错误的是？",
      options: [
        {
          key: "A",
          text: "Python 的语法类似 PHP"
        },
        {
          key: "B",
          text: "Python 可用于 Web 开发"
        },
        {
          key: "C",
          text: "Python 是跨平台的"
        },
        {
          key: "D",
          text: "Python 可用于数据抓取（爬虫）"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. Python 的语法类似 PHP\n\n回答错误，Python 的语法与 PHP 有很大差异。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-26",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-6",
      type: "single",
      stem: "print('%.2f' % 123.444) 输出结果为？",
      options: [
        {
          key: "A",
          text: "123.44"
        },
        {
          key: "B",
          text: "12"
        },
        {
          key: "C",
          text: "123.444"
        },
        {
          key: "D",
          text: "44"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 123.44\n\n回答错误，正确答案为 123.44。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-30",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-6",
      type: "single",
      stem: "以下哪个代码是正确的打开文件并准备写入？",
      options: [
        {
          key: "A",
          text: "f = open(\"test.txt\",\"w\")"
        },
        {
          key: "B",
          text: "f = open(\"test.txt\",\"write\")"
        },
        {
          key: "C",
          text: "f = open(\"write\",\"test.txt\")"
        },
        {
          key: "D",
          text: "f = open(\"w\",\"test.txt\")"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. f = open(\"test.txt\",\"w\")\n\n回答错误，正确答案为 f = open(\"test.txt\",\"w\")。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-15",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-7",
      type: "single",
      stem: "以下代码中哪个是正确的 for 循环语句是？",
      options: [
        {
          key: "A",
          text: "for(a = 0; a < 3; a++)"
        },
        {
          key: "B",
          text: "for a in range(3)"
        },
        {
          key: "C",
          text: "for a loop 3:"
        },
        {
          key: "D",
          text: "for a in range(1,3):"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. for a in range(1,3):\n\n回答错误，正确答案为 for a in range(1,3):。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-16",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-7",
      type: "single",
      stem: "以下代码中哪个是正确的 while 循环语句是？",
      options: [
        {
          key: "A",
          text: "while loop a < 10"
        },
        {
          key: "B",
          text: "while a < 10:"
        },
        {
          key: "C",
          text: "while(a < 10)"
        },
        {
          key: "D",
          text: "while loop a < 10:"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. while a < 10:\n\n回答错误，正确答案为 while a < 10:。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-python-20",
      stageKey: "rn-python-stage",
      topicKey: "rn-python-7",
      type: "single",
      stem: "Python 中，以下哪个代码是正确的元组？",
      options: [
        {
          key: "A",
          text: "sampleTuple = (1,2,3,4,5)"
        },
        {
          key: "B",
          text: "sampleTuple = {1,2,3,4,5}"
        },
        {
          key: "C",
          text: "sampleTuple = [1,2,3,4,5]"
        },
        {
          key: "D",
          text: "sampleList = /1,2,3,4,5/"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. sampleTuple = (1,2,3,4,5)\n\n回答错误，正确答案为 sampleTuple = (1,2,3,4,5)。\n\n考点：Python 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Python 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-3",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-1",
      type: "single",
      stem: "Java 中，以下哪个是合法的变量名？",
      options: [
        {
          key: "A",
          text: "1variable"
        },
        {
          key: "B",
          text: "_variable"
        },
        {
          key: "C",
          text: "variable-name"
        },
        {
          key: "D",
          text: "variable name"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. _variable\n\n回答错误，正确答案为 _variable。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-9",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-1",
      type: "single",
      stem: "Java 中，以下哪个关键字用于实现接口？",
      options: [
        {
          key: "A",
          text: "implements"
        },
        {
          key: "B",
          text: "extends"
        },
        {
          key: "C",
          text: "interface"
        },
        {
          key: "D",
          text: "abstract"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. implements\n\n回答错误，正确答案为 implements。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-15",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-1",
      type: "single",
      stem: "Java 中，以下哪个是正确的接口定义？",
      options: [
        {
          key: "A",
          text: "public interface MyInterface {}"
        },
        {
          key: "B",
          text: "interface MyInterface {}"
        },
        {
          key: "C",
          text: "MyInterface interface {}"
        },
        {
          key: "D",
          text: "define interface MyInterface {}"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. public interface MyInterface {}\n\n回答错误，正确答案为 public interface MyInterface {}。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-16",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-1",
      type: "single",
      stem: "Java 中，以下哪个是正确的构造函数定义？",
      options: [
        {
          key: "A",
          text: "public MyClass() {}"
        },
        {
          key: "B",
          text: "public void MyClass() {}"
        },
        {
          key: "C",
          text: "public static MyClass() {}"
        },
        {
          key: "D",
          text: "public class MyClass() {}"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. public MyClass() {}\n\n回答错误，正确答案为 public MyClass() {}。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-1",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-2",
      type: "single",
      stem: "Java 中，以下哪个是正确的 main 方法定义？",
      options: [
        {
          key: "A",
          text: "public static void main(String args[])"
        },
        {
          key: "B",
          text: "public void main(String args[])"
        },
        {
          key: "C",
          text: "static void main(String args[])"
        },
        {
          key: "D",
          text: "void main(String args[])"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. public static void main(String args[])\n\n回答错误，正确答案为 public static void main(String args[])。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-5",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-2",
      type: "single",
      stem: "Java 中，以下哪个是正确的 if 语句？",
      options: [
        {
          key: "A",
          text: "if (a > 10) {}"
        },
        {
          key: "B",
          text: "if a > 10 {}"
        },
        {
          key: "C",
          text: "if (a > 10)"
        },
        {
          key: "D",
          text: "if a > 10"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. if (a > 10) {}\n\n回答错误，正确答案为 if (a > 10) {}。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-12",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-2",
      type: "single",
      stem: "Java 中，以下哪个关键字用于定义常量？",
      options: [
        {
          key: "A",
          text: "final"
        },
        {
          key: "B",
          text: "const"
        },
        {
          key: "C",
          text: "constant"
        },
        {
          key: "D",
          text: "static"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. final\n\n回答错误，正确答案为 final。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-2",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-3",
      type: "single",
      stem: "Java 中，以下哪个关键字用于定义类？",
      options: [
        {
          key: "A",
          text: "class"
        },
        {
          key: "B",
          text: "Class"
        },
        {
          key: "C",
          text: "define"
        },
        {
          key: "D",
          text: "struct"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. class\n\n回答错误，正确答案为 class。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-8",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-3",
      type: "single",
      stem: "Java 中，以下哪个关键字用于继承类？",
      options: [
        {
          key: "A",
          text: "extends"
        },
        {
          key: "B",
          text: "implements"
        },
        {
          key: "C",
          text: "inherits"
        },
        {
          key: "D",
          text: "super"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. extends\n\n回答错误，正确答案为 extends。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-13",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-3",
      type: "single",
      stem: "Java 中，以下哪个是正确的异常处理语法？",
      options: [
        {
          key: "A",
          text: "try { ... } catch (Exception e) { ... }"
        },
        {
          key: "B",
          text: "try { ... } except (Exception e) { ... }"
        },
        {
          key: "C",
          text: "try { ... } finally { ... }"
        },
        {
          key: "D",
          text: "try { ... } on (Exception e) { ... }"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. try { ... } catch (Exception e) { ... }\n\n回答错误，正确答案为 try { ... } catch (Exception e) { ... }。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-14",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-3",
      type: "single",
      stem: "Java 中，以下哪个是正确的类定义？",
      options: [
        {
          key: "A",
          text: "public class MyClass {}"
        },
        {
          key: "B",
          text: "class MyClass {}"
        },
        {
          key: "C",
          text: "MyClass class {}"
        },
        {
          key: "D",
          text: "define class MyClass {}"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. public class MyClass {}\n\n回答错误，正确答案为 public class MyClass {}。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-18",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-3",
      type: "single",
      stem: "Java 中，以下哪个是正确的包导入语法？",
      options: [
        {
          key: "A",
          text: "import java.util.*;"
        },
        {
          key: "B",
          text: "include java.util.*;"
        },
        {
          key: "C",
          text: "using java.util.*;"
        },
        {
          key: "D",
          text: "require java.util.*;"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. import java.util.*;\n\n回答错误，正确答案为 import java.util.*;。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-6",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-4",
      type: "single",
      stem: "Java 中，以下哪个是正确的 for 循环语法？",
      options: [
        {
          key: "A",
          text: "for (int i = 0; i < 10; i++) {}"
        },
        {
          key: "B",
          text: "for i in range(10) {}"
        },
        {
          key: "C",
          text: "for (i = 0; i < 10; i++) {}"
        },
        {
          key: "D",
          text: "for (int i = 0; i < 10) {}"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. for (int i = 0; i < 10; i++) {}\n\n回答错误，正确答案为 for (int i = 0; i < 10; i++) {}。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-7",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-4",
      type: "single",
      stem: "Java 中，以下哪个是正确的 while 循环语法？",
      options: [
        {
          key: "A",
          text: "while (a < 10) {}"
        },
        {
          key: "B",
          text: "while a < 10 {}"
        },
        {
          key: "C",
          text: "while (a < 10)"
        },
        {
          key: "D",
          text: "while a < 10"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. while (a < 10) {}\n\n回答错误，正确答案为 while (a < 10) {}。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-10",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-4",
      type: "single",
      stem: "Java 中，以下哪个是正确的数组声明？",
      options: [
        {
          key: "A",
          text: "int[] arr = new int[10];"
        },
        {
          key: "B",
          text: "int arr = new int[10];"
        },
        {
          key: "C",
          text: "int arr[10];"
        },
        {
          key: "D",
          text: "int arr = int[10];"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. int[] arr = new int[10];\n\n回答错误，正确答案为 int[] arr = new int[10];。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-17",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-4",
      type: "single",
      stem: "Java 中，以下哪个是正确的静态方法调用？",
      options: [
        {
          key: "A",
          text: "ClassName.methodName()"
        },
        {
          key: "B",
          text: "methodName()"
        },
        {
          key: "C",
          text: "object.methodName()"
        },
        {
          key: "D",
          text: "ClassName->methodName()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. ClassName.methodName()\n\n回答错误，正确答案为 ClassName.methodName()。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-20",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-4",
      type: "single",
      stem: "Java 中，以下哪个是正确的泛型定义？",
      options: [
        {
          key: "A",
          text: "ArrayList<String> list = new ArrayList<>();"
        },
        {
          key: "B",
          text: "ArrayList list = new ArrayList<String>();"
        },
        {
          key: "C",
          text: "ArrayList<String> list = new ArrayList<String>();"
        },
        {
          key: "D",
          text: "ArrayList<> list = new ArrayList<String>();"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. ArrayList<String> list = new ArrayList<String>();\n\n回答错误，正确答案为 ArrayList<String> list = new ArrayList<String>();。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-4",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-5",
      type: "single",
      stem: "Java 中，以下哪个是正确的注释语法？",
      options: [
        {
          key: "A",
          text: "// 单行注释"
        },
        {
          key: "B",
          text: "/* 单行注释 */"
        },
        {
          key: "C",
          text: "# 单行注释"
        },
        {
          key: "D",
          text: "<!-- 单行注释 -->"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. // 单行注释\n\n回答错误，正确答案为 // 单行注释。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-11",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-5",
      type: "single",
      stem: "Java 中，以下哪个是正确的字符串比较方法？",
      options: [
        {
          key: "A",
          text: "str1.equals(str2)"
        },
        {
          key: "B",
          text: "str1 == str2"
        },
        {
          key: "C",
          text: "str1.compare(str2)"
        },
        {
          key: "D",
          text: "str1.compareTo(str2)"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. str1.equals(str2)\n\n回答错误，正确答案为 str1.equals(str2)。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-java-19",
      stageKey: "rn-java-stage",
      topicKey: "rn-java-5",
      type: "single",
      stem: "Java 中，以下哪个是正确的多线程实现方式？",
      options: [
        {
          key: "A",
          text: "继承 Thread 类"
        },
        {
          key: "B",
          text: "实现 Runnable 接口"
        },
        {
          key: "C",
          text: "使用 Executor 框架"
        },
        {
          key: "D",
          text: "以上都正确"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 以上都正确\n\n回答错误，正确答案为以上都正确。\n\n考点：Java 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Java", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-1",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-1",
      type: "single",
      stem: "C++ 的文件扩展名通常是？",
      options: [
        {
          key: "A",
          text: ".c"
        },
        {
          key: "B",
          text: ".cc"
        },
        {
          key: "C",
          text: ".cpp"
        },
        {
          key: "D",
          text: ".cp"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. .cpp\n\n回答错误，正确答案是 .cpp。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-6",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-1",
      type: "single",
      stem: "C++ 中用于定义常量的关键字是？",
      options: [
        {
          key: "A",
          text: "const"
        },
        {
          key: "B",
          text: "define"
        },
        {
          key: "C",
          text: "static"
        },
        {
          key: "D",
          text: "constant"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. const\n\n回答错误，正确答案是 const。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-9",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-1",
      type: "single",
      stem: "C++ 中哪个符号用于作用域限定？",
      options: [
        {
          key: "A",
          text: "->"
        },
        {
          key: "B",
          text: "."
        },
        {
          key: "C",
          text: "::"
        },
        {
          key: "D",
          text: ":"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. ::\n\n回答错误，正确答案是 ::。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-5",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-2",
      type: "single",
      stem: "C++ 中字符串结尾的结束符是？",
      options: [
        {
          key: "A",
          text: "\\n"
        },
        {
          key: "B",
          text: "\\t"
        },
        {
          key: "C",
          text: "\\r"
        },
        {
          key: "D",
          text: "\\0"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. \\0\n\n回答错误，正确答案是 \\0。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-17",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-2",
      type: "single",
      stem: "C++ 中用于条件判断的语句是？",
      options: [
        {
          key: "A",
          text: "switch"
        },
        {
          key: "B",
          text: "if"
        },
        {
          key: "C",
          text: "case"
        },
        {
          key: "D",
          text: "for"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. if\n\n回答错误，正确答案是 if。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-18",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-2",
      type: "single",
      stem: "C++ 中用于循环的语句不包括？",
      options: [
        {
          key: "A",
          text: "repeat"
        },
        {
          key: "B",
          text: "for"
        },
        {
          key: "C",
          text: "while"
        },
        {
          key: "D",
          text: "do...while"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. repeat\n\n回答错误，repeat 不是 C++ 的循环语句。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-10",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-3",
      type: "single",
      stem: "C++ 中用于定义类的关键字是？",
      options: [
        {
          key: "A",
          text: "class"
        },
        {
          key: "B",
          text: "struct"
        },
        {
          key: "C",
          text: "object"
        },
        {
          key: "D",
          text: "define"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. class\n\n回答错误，正确答案是 class。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-20",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-3",
      type: "single",
      stem: "C++ 中用于函数重载的特性是？",
      options: [
        {
          key: "A",
          text: "同名同参数"
        },
        {
          key: "B",
          text: "同名不同参数"
        },
        {
          key: "C",
          text: "不同名同参数"
        },
        {
          key: "D",
          text: "不同名不同参数"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. 同名不同参数\n\n回答错误，正确答案是同名不同参数。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-2",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-4",
      type: "single",
      stem: "C++ 的标准输入输出头文件是？",
      options: [
        {
          key: "A",
          text: "<stdio.h>"
        },
        {
          key: "B",
          text: "<iostream>"
        },
        {
          key: "C",
          text: "<stdlib.h>"
        },
        {
          key: "D",
          text: "<conio.h>"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. <iostream>\n\n回答错误，正确答案是 <iostream>。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-13",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-4",
      type: "single",
      stem: "C++ 中用于继承的关键字是？",
      options: [
        {
          key: "A",
          text: "public"
        },
        {
          key: "B",
          text: "extends"
        },
        {
          key: "C",
          text: "inherit"
        },
        {
          key: "D",
          text: "base"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. public\n\n回答错误，正确答案是 public。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-19",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-4",
      type: "single",
      stem: "C++ 中用于输出换行的操作是？",
      options: [
        {
          key: "A",
          text: "\\n"
        },
        {
          key: "B",
          text: "linebreak"
        },
        {
          key: "C",
          text: "endl"
        },
        {
          key: "D",
          text: "break"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. endl\n\n回答错误，正确答案是 endl。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-11",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-5",
      type: "single",
      stem: "C++ 中构造函数的名称应为？",
      options: [
        {
          key: "A",
          text: "constructor"
        },
        {
          key: "B",
          text: "init"
        },
        {
          key: "C",
          text: "与类名相同"
        },
        {
          key: "D",
          text: "setup"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. 与类名相同\n\n回答错误，正确答案是与类名相同。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-15",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-5",
      type: "single",
      stem: "C++ 中用于命名空间的关键字是？",
      options: [
        {
          key: "A",
          text: "package"
        },
        {
          key: "B",
          text: "module"
        },
        {
          key: "C",
          text: "space"
        },
        {
          key: "D",
          text: "namespace"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. namespace\n\n回答错误，正确答案是 namespace。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-3",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-6",
      type: "single",
      stem: "C++ 中输出内容到屏幕用哪个对象？",
      options: [
        {
          key: "A",
          text: "cout"
        },
        {
          key: "B",
          text: "cin"
        },
        {
          key: "C",
          text: "printf"
        },
        {
          key: "D",
          text: "output"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. cout\n\n回答错误，正确答案是 cout。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-4",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-6",
      type: "single",
      stem: "C++ 中输入内容用哪个对象？",
      options: [
        {
          key: "A",
          text: "cin"
        },
        {
          key: "B",
          text: "cout"
        },
        {
          key: "C",
          text: "scanf"
        },
        {
          key: "D",
          text: "input"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. cin\n\n回答错误，正确答案是 cin。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-14",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-7",
      type: "single",
      stem: "C++ 中用于定义函数的关键字是？",
      options: [
        {
          key: "A",
          text: "无关键字，直接定义"
        },
        {
          key: "B",
          text: "function"
        },
        {
          key: "C",
          text: "def"
        },
        {
          key: "D",
          text: "func"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 无关键字，直接定义\n\n回答错误，C++ 定义函数无需关键字，直接定义。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-16",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-7",
      type: "single",
      stem: "C++ 中标准命名空间是？",
      options: [
        {
          key: "A",
          text: "std"
        },
        {
          key: "B",
          text: "standard"
        },
        {
          key: "C",
          text: "system"
        },
        {
          key: "D",
          text: "cpp"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. std\n\n回答错误，正确答案是 std。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-7",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-8",
      type: "single",
      stem: "C++ 中用于动态分配内存的关键字是？",
      options: [
        {
          key: "A",
          text: "malloc"
        },
        {
          key: "B",
          text: "new"
        },
        {
          key: "C",
          text: "alloc"
        },
        {
          key: "D",
          text: "create"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. new\n\n回答错误，正确答案是 new。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-8",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-8",
      type: "single",
      stem: "C++ 中释放动态内存用哪个关键字？",
      options: [
        {
          key: "A",
          text: "delete"
        },
        {
          key: "B",
          text: "free"
        },
        {
          key: "C",
          text: "remove"
        },
        {
          key: "D",
          text: "release"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. delete\n\n回答错误，正确答案是 delete。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-cpp-12",
      stageKey: "rn-cpp-stage",
      topicKey: "rn-cpp-8",
      type: "single",
      stem: "C++ 中析构函数的名称应为？",
      options: [
        {
          key: "A",
          text: "~类名"
        },
        {
          key: "B",
          text: "destructor"
        },
        {
          key: "C",
          text: "delete"
        },
        {
          key: "D",
          text: "destroy"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. ~类名\n\n回答错误，正确答案是 ~类名。\n\n考点：C++ 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C++", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-1",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-1",
      type: "single",
      stem: "关于 C# 下列哪项是正确的？",
      options: [
        {
          key: "A",
          text: "它可以在各种计算机平台上编译。"
        },
        {
          key: "B",
          text: "它是 .Net 框架的一部分。"
        },
        {
          key: "C",
          text: "它是面向对象的高级编程语言。"
        },
        {
          key: "D",
          text: "以上都是"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 以上都是\n\n回答错误，C#是微软推出的一种基于.NET框架的、面向对象的高级编程语言，可以跨平台。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-2",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-1",
      type: "single",
      stem: "C# .net 中 Long 数据类型存储是多少字节？",
      options: [
        {
          key: "A",
          text: "1"
        },
        {
          key: "B",
          text: "2"
        },
        {
          key: "C",
          text: "4"
        },
        {
          key: "D",
          text: "8"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 8\n\nLong 数据类型为 8 字节。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-4",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-1",
      type: "single",
      stem: "数据类型 sbyte、short、long、int 的大小顺序是？",
      options: [
        {
          key: "A",
          text: "short < int < sbyte < long"
        },
        {
          key: "B",
          text: "short < sbyte < int < long"
        },
        {
          key: "C",
          text: "sbyte < short < int < long"
        },
        {
          key: "D",
          text: "long < short < int < sbyte"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. sbyte < short < int < long\n\n本题考查「数据类型 sbyte、short、long、int 的大小顺序是？」，正确答案是 sbyte < short < int < long。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-5",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-1",
      type: "single",
      stem: "哪种数据类型适合存储 35 这样整型数字？",
      options: [
        {
          key: "A",
          text: "long"
        },
        {
          key: "B",
          text: "int"
        },
        {
          key: "C",
          text: "short"
        },
        {
          key: "D",
          text: "sbyte"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. sbyte\n\n本题考查「哪种数据类型适合存储 35 这样整型数字？」，正确答案是 sbyte。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-6",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-1",
      type: "single",
      stem: "int a=12, float b=3.5,int c，以下赋值运算正确的是？",
      options: [
        {
          key: "A",
          text: "c = int(a + b);"
        },
        {
          key: "B",
          text: "c = a + convert.ToInt32(b);"
        },
        {
          key: "C",
          text: "c = a + int(float(b));"
        },
        {
          key: "D",
          text: "c = a + b;"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. c = a + convert.ToInt32(b);\n\n本题考查「int a=12, float b=3.5,int c，以下赋值运算正确的是？」，正确答案是 c = a + convert.ToInt32(b);。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-10",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-1",
      type: "single",
      stem: "Char 数据类型的大小是多少？",
      options: [
        {
          key: "A",
          text: "20 位（bit）"
        },
        {
          key: "B",
          text: "16 位（bit）"
        },
        {
          key: "C",
          text: "12 位（bit）"
        },
        {
          key: "D",
          text: "8 位（bit）"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. 16 位（bit）\n\n本题考查「Char 数据类型的大小是多少？」，正确答案是 16 位（bit）。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-12",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-1",
      type: "single",
      stem: "C# 程序的入口方法是？",
      options: [
        {
          key: "A",
          text: "Start"
        },
        {
          key: "B",
          text: "Main"
        },
        {
          key: "C",
          text: "Begin"
        },
        {
          key: "D",
          text: "Init"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. Main\n\n回答错误，正确答案是 Main。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-18",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-1",
      type: "single",
      stem: "C# 中用于定义类的关键字是？",
      options: [
        {
          key: "A",
          text: "object"
        },
        {
          key: "B",
          text: "struct"
        },
        {
          key: "C",
          text: "define"
        },
        {
          key: "D",
          text: "class"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. class\n\n回答错误，正确答案是 class。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-3",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-2",
      type: "single",
      stem: "下列哪一项是 C# 正确声明变量 a 和 b 的值？",
      options: [
        {
          key: "A",
          text: "int a = b = 42;"
        },
        {
          key: "B",
          text: "int a = 32; int b = 40;"
        },
        {
          key: "C",
          text: "int a = 42; b = 40;"
        },
        {
          key: "D",
          text: "int a = 32, b = 40.6;"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. int a = 32; int b = 40;\n\n正确为：int a = 32; int b = 40;\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-7",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-2",
      type: "single",
      stem: "整数的默认类型为？",
      options: [
        {
          key: "A",
          text: "Long Int"
        },
        {
          key: "B",
          text: "Unsigned Long"
        },
        {
          key: "C",
          text: "Int"
        },
        {
          key: "D",
          text: "Unsigned Int"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. Int\n\n本题考查「整数的默认类型为？」，正确答案是 Int。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-19",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-2",
      type: "single",
      stem: "C# 中用于继承的关键字是？",
      options: [
        {
          key: "A",
          text: "extends"
        },
        {
          key: "B",
          text: "inherits"
        },
        {
          key: "C",
          text: "base"
        },
        {
          key: "D",
          text: ":"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. :\n\n回答错误，正确答案是冒号 :。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-24",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-2",
      type: "single",
      stem: "C# 中用于判断条件的语句是？",
      options: [
        {
          key: "A",
          text: "switch"
        },
        {
          key: "B",
          text: "case"
        },
        {
          key: "C",
          text: "for"
        },
        {
          key: "D",
          text: "if"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. if\n\n回答错误，正确答案是 if。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-25",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-2",
      type: "single",
      stem: "C# 中用于循环的语句不包括？",
      options: [
        {
          key: "A",
          text: "for"
        },
        {
          key: "B",
          text: "while"
        },
        {
          key: "C",
          text: "repeat"
        },
        {
          key: "D",
          text: "foreach"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. repeat\n\n回答错误，repeat 不是 C# 的循环语句。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-27",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-2",
      type: "single",
      stem: "C# 中用于释放资源的接口是？",
      options: [
        {
          key: "A",
          text: "IClosable"
        },
        {
          key: "B",
          text: "IDisposable"
        },
        {
          key: "C",
          text: "IDestroy"
        },
        {
          key: "D",
          text: "IRelease"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. IDisposable\n\n回答错误，正确答案是 IDisposable。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-28",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-2",
      type: "single",
      stem: "C# 中用于字符串拼接的运算符是？",
      options: [
        {
          key: "A",
          text: "&"
        },
        {
          key: "B",
          text: "+"
        },
        {
          key: "C",
          text: "."
        },
        {
          key: "D",
          text: "concat"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. +\n\n回答错误，正确答案是 +。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-30",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-2",
      type: "single",
      stem: "C# 中用于终止循环的关键字是？",
      options: [
        {
          key: "A",
          text: "continue"
        },
        {
          key: "B",
          text: "break"
        },
        {
          key: "C",
          text: "exit"
        },
        {
          key: "D",
          text: "stop"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. break\n\n回答错误，正确答案是 break。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-15",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-3",
      type: "single",
      stem: "C# 中定义常量的关键字是？",
      options: [
        {
          key: "A",
          text: "final"
        },
        {
          key: "B",
          text: "const"
        },
        {
          key: "C",
          text: "static"
        },
        {
          key: "D",
          text: "define"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. const\n\n回答错误，正确答案是 const。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-16",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-3",
      type: "single",
      stem: "C# 中用于声明变量的关键字是？",
      options: [
        {
          key: "A",
          text: "let"
        },
        {
          key: "B",
          text: "var"
        },
        {
          key: "C",
          text: "dim"
        },
        {
          key: "D",
          text: "define"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. var\n\n回答错误，正确答案是 var。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-20",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-3",
      type: "single",
      stem: "C# 中用于实现接口的关键字是？",
      options: [
        {
          key: "A",
          text: "interface"
        },
        {
          key: "B",
          text: "with"
        },
        {
          key: "C",
          text: "implements"
        },
        {
          key: "D",
          text: ":"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. :\n\n回答错误，正确答案是冒号 :。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-21",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-3",
      type: "single",
      stem: "C# 中用于定义接口的关键字是？",
      options: [
        {
          key: "A",
          text: "abstract"
        },
        {
          key: "B",
          text: "interface"
        },
        {
          key: "C",
          text: "implements"
        },
        {
          key: "D",
          text: "protocol"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. interface\n\n回答错误，正确答案是 interface。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-22",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-3",
      type: "single",
      stem: "C# 中用于定义命名空间的关键字是？",
      options: [
        {
          key: "A",
          text: "package"
        },
        {
          key: "B",
          text: "namespace"
        },
        {
          key: "C",
          text: "module"
        },
        {
          key: "D",
          text: "space"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. namespace\n\n回答错误，正确答案是 namespace。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-23",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-3",
      type: "single",
      stem: "C# 中用于异常处理的关键字是？",
      options: [
        {
          key: "A",
          text: "try-except"
        },
        {
          key: "B",
          text: "try-catch-finally"
        },
        {
          key: "C",
          text: "catch-try"
        },
        {
          key: "D",
          text: "try-catch"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. try-catch-finally\n\n回答错误，正确答案是 try-catch-finally。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-29",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-3",
      type: "single",
      stem: "C# 中用于注释单行代码的符号是？",
      options: [
        {
          key: "A",
          text: "#"
        },
        {
          key: "B",
          text: "--"
        },
        {
          key: "C",
          text: "//"
        },
        {
          key: "D",
          text: "/* */"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. //\n\n回答错误，正确答案是 //。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-8",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-4",
      type: "single",
      stem: "浮点数据类型 float 的大小是？",
      options: [
        {
          key: "A",
          text: "8 字节"
        },
        {
          key: "B",
          text: "4 字节"
        },
        {
          key: "C",
          text: "6 字节"
        },
        {
          key: "D",
          text: "10 字节"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. 4 字节\n\n本题考查「浮点数据类型 float 的大小是？」，正确答案是 4 字节。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-9",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-4",
      type: "single",
      stem: "布尔类型的默认值为？",
      options: [
        {
          key: "A",
          text: "0"
        },
        {
          key: "B",
          text: "1"
        },
        {
          key: "C",
          text: "False"
        },
        {
          key: "D",
          text: "True"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. False\n\n本题考查「布尔类型的默认值为？」，正确答案是 False。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-11",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-4",
      type: "single",
      stem: "C# 的文件扩展名通常是？",
      options: [
        {
          key: "A",
          text: ".cs"
        },
        {
          key: "B",
          text: ".c"
        },
        {
          key: "C",
          text: ".cpp"
        },
        {
          key: "D",
          text: ".csharp"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. .cs\n\n回答错误，正确答案是 .cs。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-13",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-4",
      type: "single",
      stem: "C# 中用于输出内容到控制台的方法是？",
      options: [
        {
          key: "A",
          text: "print()"
        },
        {
          key: "B",
          text: "echo()"
        },
        {
          key: "C",
          text: "Console.WriteLine()"
        },
        {
          key: "D",
          text: "System.out.println()"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. Console.WriteLine()\n\n回答错误，正确答案是 Console.WriteLine()。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-14",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-4",
      type: "single",
      stem: "C# 中用于输入内容的方法是？",
      options: [
        {
          key: "A",
          text: "input()"
        },
        {
          key: "B",
          text: "scanf()"
        },
        {
          key: "C",
          text: "Read()"
        },
        {
          key: "D",
          text: "Console.ReadLine()"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. Console.ReadLine()\n\n回答错误，正确答案是 Console.ReadLine()。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-17",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-4",
      type: "single",
      stem: "C# 中字符串类型是？",
      options: [
        {
          key: "A",
          text: "String"
        },
        {
          key: "B",
          text: "char[]"
        },
        {
          key: "C",
          text: "string"
        },
        {
          key: "D",
          text: "text"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. string\n\n回答错误，正确答案是 string。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-csharp-26",
      stageKey: "rn-csharp-stage",
      topicKey: "rn-csharp-4",
      type: "single",
      stem: "C# 中用于定义属性的关键字是？",
      options: [
        {
          key: "A",
          text: "property"
        },
        {
          key: "B",
          text: "get/set"
        },
        {
          key: "C",
          text: "attr"
        },
        {
          key: "D",
          text: "define"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. get/set\n\n回答错误，正确答案是 get/set。\n\n考点：C# 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["C#", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-2",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-1",
      type: "single",
      stem: "Go 语言中，以下哪个是正确的包导入方式？",
      options: [
        {
          key: "A",
          text: "import \"fmt\""
        },
        {
          key: "B",
          text: "include <fmt>"
        },
        {
          key: "C",
          text: "#import \"fmt\""
        },
        {
          key: "D",
          text: "using fmt"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. import \"fmt\"\n\n回答错误，正确答案为 import \"fmt\"。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-3",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-1",
      type: "single",
      stem: "Go 语言中，以下哪个是用来打印输出的函数？",
      options: [
        {
          key: "A",
          text: "print()"
        },
        {
          key: "B",
          text: "fmt.Println()"
        },
        {
          key: "C",
          text: "console.log()"
        },
        {
          key: "D",
          text: "System.out.println()"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. fmt.Println()\n\n回答错误，正确答案为 fmt.Println()。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-4",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-1",
      type: "single",
      stem: "Go 语言中，以下哪个是用来定义常量的关键字？",
      options: [
        {
          key: "A",
          text: "const"
        },
        {
          key: "B",
          text: "define"
        },
        {
          key: "C",
          text: "constant"
        },
        {
          key: "D",
          text: "final"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. const\n\n回答错误，正确答案为 const。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-8",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-1",
      type: "single",
      stem: "Go 语言中，以下哪个是用来声明 map 的语法？",
      options: [
        {
          key: "A",
          text: "var m map[string]int"
        },
        {
          key: "B",
          text: "m := map[string]int{\"a\": 1, \"b\": 2}"
        },
        {
          key: "C",
          text: "m := make(map[string]int)"
        },
        {
          key: "D",
          text: "以上都正确"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 以上都正确\n\n回答错误，正确答案为以上都正确。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-14",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-1",
      type: "single",
      stem: "Go 语言中，以下哪个是用来定义通道的语法？",
      options: [
        {
          key: "A",
          text: "var ch chan int"
        },
        {
          key: "B",
          text: "ch := make(chan int)"
        },
        {
          key: "C",
          text: "ch := chan int{}"
        },
        {
          key: "D",
          text: "以上两种都正确"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. ch := make(chan int)\n\n回答错误，正确答案为 ch := make(chan int)。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-16",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-1",
      type: "single",
      stem: "Go 语言中，以下哪个是用来格式化输出的函数？",
      options: [
        {
          key: "A",
          text: "fmt.Printf()"
        },
        {
          key: "B",
          text: "fmt.Println()"
        },
        {
          key: "C",
          text: "fmt.Sprintf()"
        },
        {
          key: "D",
          text: "以上都正确"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 以上都正确\n\n回答错误，正确答案为以上都正确。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-1",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-2",
      type: "single",
      stem: "Go 语言中，以下哪个是正确的变量声明方式？",
      options: [
        {
          key: "A",
          text: "var a int = 10"
        },
        {
          key: "B",
          text: "var a = 10"
        },
        {
          key: "C",
          text: "a := 10"
        },
        {
          key: "D",
          text: "以上都正确"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 以上都正确\n\n回答错误，正确答案为 var a int = 10 、var a = 10 或 a := 10。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-5",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-2",
      type: "single",
      stem: "Go 语言中，以下哪个是正确的 for 循环语法？",
      options: [
        {
          key: "A",
          text: "for i := 0; i < 10; i++ {}"
        },
        {
          key: "B",
          text: "for (i = 0; i < 10; i++) {}"
        },
        {
          key: "C",
          text: "for i in range(10) {}"
        },
        {
          key: "D",
          text: "for (i = 0; i < 10) {}"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. for i := 0; i < 10; i++ {}\n\n回答错误，正确答案为 for i := 0; i < 10; i++ {}。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-6",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-2",
      type: "single",
      stem: "Go 语言中，以下哪个是用来定义函数的关键字？",
      options: [
        {
          key: "A",
          text: "func"
        },
        {
          key: "B",
          text: "function"
        },
        {
          key: "C",
          text: "def"
        },
        {
          key: "D",
          text: "fn"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. func\n\n回答错误，正确答案为 func。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-7",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-2",
      type: "single",
      stem: "Go 语言中，以下哪个是用来声明切片的语法？",
      options: [
        {
          key: "A",
          text: "var s []int"
        },
        {
          key: "B",
          text: "s := []int{1, 2, 3}"
        },
        {
          key: "C",
          text: "s := make([]int, 5)"
        },
        {
          key: "D",
          text: "以上都正确"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 以上都正确\n\n回答错误，正确答案为以上都正确。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-11",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-2",
      type: "single",
      stem: "Go 语言中，以下哪个是用来定义接口的关键字？",
      options: [
        {
          key: "A",
          text: "interface"
        },
        {
          key: "B",
          text: "protocol"
        },
        {
          key: "C",
          text: "abstract"
        },
        {
          key: "D",
          text: "implements"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. interface\n\n回答错误，正确答案为 interface。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-12",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-2",
      type: "single",
      stem: "Go 语言中，以下哪个是用来启动 Goroutine 的关键字？",
      options: [
        {
          key: "A",
          text: "go"
        },
        {
          key: "B",
          text: "goroutine"
        },
        {
          key: "C",
          text: "thread"
        },
        {
          key: "D",
          text: "async"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. go\n\n回答错误，正确答案为 go。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-13",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-2",
      type: "single",
      stem: "Go 语言中，以下哪个是用来同步 Goroutine 的工具？",
      options: [
        {
          key: "A",
          text: "sync.Mutex"
        },
        {
          key: "B",
          text: "sync.WaitGroup"
        },
        {
          key: "C",
          text: "channel"
        },
        {
          key: "D",
          text: "以上都正确"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 以上都正确\n\n回答错误，正确答案为以上都正确。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-19",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-2",
      type: "single",
      stem: "Go 语言中，以下哪个是用来退出程序的函数？",
      options: [
        {
          key: "A",
          text: "os.Exit()"
        },
        {
          key: "B",
          text: "syscall.Exit()"
        },
        {
          key: "C",
          text: "exit()"
        },
        {
          key: "D",
          text: "以上都正确"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. os.Exit()\n\n回答错误，正确答案为 os.Exit()。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-9",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-3",
      type: "single",
      stem: "Go 语言中，以下哪个是用来处理错误的函数？",
      options: [
        {
          key: "A",
          text: "panic()"
        },
        {
          key: "B",
          text: "recover()"
        },
        {
          key: "C",
          text: "error()"
        },
        {
          key: "D",
          text: "以上都正确"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 以上都正确\n\n回答错误，正确答案为以上都正确。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-10",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-3",
      type: "single",
      stem: "Go 语言中，以下哪个是用来定义结构体的关键字？",
      options: [
        {
          key: "A",
          text: "struct"
        },
        {
          key: "B",
          text: "class"
        },
        {
          key: "C",
          text: "object"
        },
        {
          key: "D",
          text: "type"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. type\n\n回答错误，正确答案为 type。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-15",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-3",
      type: "single",
      stem: "Go 语言中，以下哪个是用来关闭通道的函数？",
      options: [
        {
          key: "A",
          text: "close()"
        },
        {
          key: "B",
          text: "shutdown()"
        },
        {
          key: "C",
          text: "stop()"
        },
        {
          key: "D",
          text: "end()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. close()\n\n回答错误，正确答案为 close()。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-17",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-3",
      type: "single",
      stem: "Go 语言中，以下哪个是用来读取文件的函数？",
      options: [
        {
          key: "A",
          text: "os.Open()"
        },
        {
          key: "B",
          text: "ioutil.ReadFile()"
        },
        {
          key: "C",
          text: "os.Read()"
        },
        {
          key: "D",
          text: "以上都正确"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 以上都正确\n\n回答错误，正确答案为以上都正确。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-18",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-3",
      type: "single",
      stem: "Go 语言中，以下哪个是用来写入文件的函数？",
      options: [
        {
          key: "A",
          text: "os.Write()"
        },
        {
          key: "B",
          text: "ioutil.WriteFile()"
        },
        {
          key: "C",
          text: "os.Create()"
        },
        {
          key: "D",
          text: "以上都正确"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 以上都正确\n\n回答错误，正确答案为以上都正确。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-go-20",
      stageKey: "rn-go-stage",
      topicKey: "rn-go-3",
      type: "single",
      stem: "Go 语言中，以下哪个是用来获取当前时间的函数？",
      options: [
        {
          key: "A",
          text: "time.Now()"
        },
        {
          key: "B",
          text: "datetime.Now()"
        },
        {
          key: "C",
          text: "clock.Now()"
        },
        {
          key: "D",
          text: "date.Now()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. time.Now()\n\n回答错误，正确答案为 time.Now()。\n\n考点：Go 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Go", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-1",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-1",
      type: "single",
      stem: "PHP 文件的默认扩展名是？",
      options: [
        {
          key: "A",
          text: ".php"
        },
        {
          key: "B",
          text: ".html"
        },
        {
          key: "C",
          text: ".js"
        },
        {
          key: "D",
          text: ".css"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. .php\n\n回答错误，正确答案是 .php。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-2",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-1",
      type: "single",
      stem: "PHP 代码块的起始标签是？",
      options: [
        {
          key: "A",
          text: "<?php"
        },
        {
          key: "B",
          text: "＜script＞"
        },
        {
          key: "C",
          text: "<php>"
        },
        {
          key: "D",
          text: "<?="
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <?php\n\n回答错误，正确答案是 <?php。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-3",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-1",
      type: "single",
      stem: "PHP 变量以什么符号开头？",
      options: [
        {
          key: "A",
          text: "$"
        },
        {
          key: "B",
          text: "#"
        },
        {
          key: "C",
          text: "&"
        },
        {
          key: "D",
          text: "%"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. $\n\n回答错误，正确答案是 $。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-10",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-2",
      type: "single",
      stem: "PHP 中用于连接字符串的运算符是？",
      options: [
        {
          key: "A",
          text: "."
        },
        {
          key: "B",
          text: "+"
        },
        {
          key: "C",
          text: "&"
        },
        {
          key: "D",
          text: "concat"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. .\n\n回答错误，正确答案是 .。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-14",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-2",
      type: "single",
      stem: "PHP 中用于获取数组长度的函数是？",
      options: [
        {
          key: "A",
          text: "count()"
        },
        {
          key: "B",
          text: "length()"
        },
        {
          key: "C",
          text: "size()"
        },
        {
          key: "D",
          text: "array_length()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. count()\n\n回答错误，正确答案是 count()。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-15",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-2",
      type: "single",
      stem: "PHP 中用于遍历数组的结构是？",
      options: [
        {
          key: "A",
          text: "foreach"
        },
        {
          key: "B",
          text: "for"
        },
        {
          key: "C",
          text: "while"
        },
        {
          key: "D",
          text: "do...while"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. foreach\n\n回答错误，正确答案是 foreach。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-6",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-3",
      type: "single",
      stem: "PHP 中用于获取表单提交数据的全局数组是？",
      options: [
        {
          key: "A",
          text: "$_POST"
        },
        {
          key: "B",
          text: "$_GET"
        },
        {
          key: "C",
          text: "$_REQUEST"
        },
        {
          key: "D",
          text: "以上都是"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 以上都是\n\n回答错误，正确答案是 以上都是。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-17",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-3",
      type: "single",
      stem: "PHP 中用于获取当前脚本文件名的变量是？",
      options: [
        {
          key: "A",
          text: "$_SERVER['PHP_SELF']"
        },
        {
          key: "B",
          text: "$_SERVER['SCRIPT_NAME']"
        },
        {
          key: "C",
          text: "$_SERVER['FILENAME']"
        },
        {
          key: "D",
          text: "$_SERVER['SELF']"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. $_SERVER['PHP_SELF']\n\n回答错误，正确答案是 $_SERVER['PHP_SELF']。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-20",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-3",
      type: "single",
      stem: "PHP 中用于格式化日期的函数是？",
      options: [
        {
          key: "A",
          text: "date()"
        },
        {
          key: "B",
          text: "format()"
        },
        {
          key: "C",
          text: "strftime()"
        },
        {
          key: "D",
          text: "strtotime()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. date()\n\n回答错误，正确答案是 date()。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-9",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-4",
      type: "single",
      stem: "PHP 中用于判断变量是否为 null 的函数是？",
      options: [
        {
          key: "A",
          text: "is_null()"
        },
        {
          key: "B",
          text: "isset()"
        },
        {
          key: "C",
          text: "empty()"
        },
        {
          key: "D",
          text: "is_empty()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. is_null()\n\n回答错误，正确答案是 is_null()。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-21",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-4",
      type: "single",
      stem: "PHP 中用于终止脚本执行的函数是？",
      options: [
        {
          key: "A",
          text: "exit()"
        },
        {
          key: "B",
          text: "stop()"
        },
        {
          key: "C",
          text: "end()"
        },
        {
          key: "D",
          text: "break"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. exit()\n\n回答错误，正确答案是 exit()。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-4",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-5",
      type: "single",
      stem: "PHP 中用于输出内容的语句是？",
      options: [
        {
          key: "A",
          text: "echo"
        },
        {
          key: "B",
          text: "print"
        },
        {
          key: "C",
          text: "write"
        },
        {
          key: "D",
          text: "以上都是"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 以上都是\n\n回答错误，正确答案是 以上都是。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-5",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-5",
      type: "single",
      stem: "PHP 语句结束时通常用什么符号？",
      options: [
        {
          key: "A",
          text: ";"
        },
        {
          key: "B",
          text: "."
        },
        {
          key: "C",
          text: ","
        },
        {
          key: "D",
          text: ":"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. ;\n\n回答错误，正确答案是 ;。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-12",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-5",
      type: "single",
      stem: "PHP 中用于包含并执行文件的语句是？",
      options: [
        {
          key: "A",
          text: "include"
        },
        {
          key: "B",
          text: "require"
        },
        {
          key: "C",
          text: "include_once"
        },
        {
          key: "D",
          text: "以上都是"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 以上都是\n\n回答错误，正确答案是 以上都是。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-16",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-6",
      type: "single",
      stem: "PHP 中用于判断文件是否存在的函数是？",
      options: [
        {
          key: "A",
          text: "file_exists()"
        },
        {
          key: "B",
          text: "is_file()"
        },
        {
          key: "C",
          text: "exists()"
        },
        {
          key: "D",
          text: "file_exist()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. file_exists()\n\n回答错误，正确答案是 file_exists()。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-18",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-6",
      type: "single",
      stem: "PHP 中用于重定向页面的函数是？",
      options: [
        {
          key: "A",
          text: "header()"
        },
        {
          key: "B",
          text: "redirect()"
        },
        {
          key: "C",
          text: "goto()"
        },
        {
          key: "D",
          text: "location()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. header()\n\n回答错误，正确答案是 header()。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-11",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-7",
      type: "single",
      stem: "PHP 中用于获取字符串长度的函数是？",
      options: [
        {
          key: "A",
          text: "strlen()"
        },
        {
          key: "B",
          text: "count()"
        },
        {
          key: "C",
          text: "size()"
        },
        {
          key: "D",
          text: "length()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. strlen()\n\n回答错误，正确答案是 strlen()。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-19",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-7",
      type: "single",
      stem: "PHP 中用于获取当前时间戳的函数是？",
      options: [
        {
          key: "A",
          text: "time()"
        },
        {
          key: "B",
          text: "now()"
        },
        {
          key: "C",
          text: "date()"
        },
        {
          key: "D",
          text: "current_time()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. time()\n\n回答错误，正确答案是 time()。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-7",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-8",
      type: "single",
      stem: "PHP 中用于判断变量是否已设置的函数是？",
      options: [
        {
          key: "A",
          text: "isset()"
        },
        {
          key: "B",
          text: "empty()"
        },
        {
          key: "C",
          text: "is_null()"
        },
        {
          key: "D",
          text: "defined()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. isset()\n\n回答错误，正确答案是 isset()。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-8",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-8",
      type: "single",
      stem: "PHP 中用于判断变量是否为空的函数是？",
      options: [
        {
          key: "A",
          text: "empty()"
        },
        {
          key: "B",
          text: "isset()"
        },
        {
          key: "C",
          text: "is_null()"
        },
        {
          key: "D",
          text: "is_empty()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. empty()\n\n回答错误，正确答案是 empty()。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-php-13",
      stageKey: "rn-php-stage",
      topicKey: "rn-php-8",
      type: "single",
      stem: "PHP 中用于定义常量的函数是？",
      options: [
        {
          key: "A",
          text: "define()"
        },
        {
          key: "B",
          text: "const"
        },
        {
          key: "C",
          text: "constant()"
        },
        {
          key: "D",
          text: "set()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. define()\n\n回答错误，正确答案是 define()。\n\n考点：PHP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["PHP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-2",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-1",
      type: "single",
      stem: "ASP 文件的默认扩展名是？",
      options: [
        {
          key: "A",
          text: ".asp"
        },
        {
          key: "B",
          text: ".aspx"
        },
        {
          key: "C",
          text: ".php"
        },
        {
          key: "D",
          text: ".html"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. .asp\n\n回答错误，正确答案是 .asp。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-4",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-1",
      type: "single",
      stem: "ASP 代码块的起始和结束标记是？",
      options: [
        {
          key: "A",
          text: "<% 和 %>"
        },
        {
          key: "B",
          text: "<?php 和 ?>"
        },
        {
          key: "C",
          text: "＜script＞ 和 ＜/script＞"
        },
        {
          key: "D",
          text: "<asp> 和 </asp>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <% 和 %>\n\n回答错误，正确答案是 <% 和 %>。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-8",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-1",
      type: "single",
      stem: "ASP 中用于存储全局应用程序变量的对象是？",
      options: [
        {
          key: "A",
          text: "Application"
        },
        {
          key: "B",
          text: "Session"
        },
        {
          key: "C",
          text: "Request"
        },
        {
          key: "D",
          text: "Response"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. Application\n\n回答错误，正确答案是 Application。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-16",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-1",
      type: "single",
      stem: "ASP 中用于包含其他文件的语句是？",
      options: [
        {
          key: "A",
          text: "#include"
        },
        {
          key: "B",
          text: "require"
        },
        {
          key: "C",
          text: "import"
        },
        {
          key: "D",
          text: "include_once"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. #include\n\n回答错误，正确答案是 #include。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-17",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-1",
      type: "single",
      stem: "ASP 中用于获取当前脚本文件名的服务器变量是？",
      options: [
        {
          key: "A",
          text: "SCRIPT_NAME"
        },
        {
          key: "B",
          text: "PHP_SELF"
        },
        {
          key: "C",
          text: "FILENAME"
        },
        {
          key: "D",
          text: "SELF"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. SCRIPT_NAME\n\n回答错误，正确答案是 SCRIPT_NAME。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-20",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-1",
      type: "single",
      stem: "ASP 中用于获取表单 GET 提交数据的方法是？",
      options: [
        {
          key: "A",
          text: "Request.QueryString"
        },
        {
          key: "B",
          text: "Request.Form"
        },
        {
          key: "C",
          text: "Request.Cookies"
        },
        {
          key: "D",
          text: "Request.ServerVariables"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. Request.QueryString\n\n回答错误，正确答案是 Request.QueryString。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-1",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-2",
      type: "single",
      stem: "ASP 的全称是什么？",
      options: [
        {
          key: "A",
          text: "Active Server Pages"
        },
        {
          key: "B",
          text: "Advanced Server Pages"
        },
        {
          key: "C",
          text: "Application Service Provider"
        },
        {
          key: "D",
          text: "Active Service Pages"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. Active Server Pages\n\n回答错误，正确答案是 Active Server Pages。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-7",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-2",
      type: "single",
      stem: "ASP 中用于管理用户会话的对象是？",
      options: [
        {
          key: "A",
          text: "Session"
        },
        {
          key: "B",
          text: "Application"
        },
        {
          key: "C",
          text: "Request"
        },
        {
          key: "D",
          text: "Response"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. Session\n\n回答错误，正确答案是 Session。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-9",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-2",
      type: "single",
      stem: "ASP 中用于连接数据库的对象是？",
      options: [
        {
          key: "A",
          text: "Connection"
        },
        {
          key: "B",
          text: "Recordset"
        },
        {
          key: "C",
          text: "Command"
        },
        {
          key: "D",
          text: "Database"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. Connection\n\n回答错误，正确答案是 Connection。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-11",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-2",
      type: "single",
      stem: "ASP 中用于重定向页面的方法是？",
      options: [
        {
          key: "A",
          text: "Response.Redirect"
        },
        {
          key: "B",
          text: "Server.Transfer"
        },
        {
          key: "C",
          text: "Request.Redirect"
        },
        {
          key: "D",
          text: "Session.Redirect"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. Response.Redirect\n\n回答错误，正确答案是 Response.Redirect。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-12",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-2",
      type: "single",
      stem: "ASP 中用于获取服务器变量的对象是？",
      options: [
        {
          key: "A",
          text: "Request.ServerVariables"
        },
        {
          key: "B",
          text: "Response.ServerVariables"
        },
        {
          key: "C",
          text: "Server.RequestVariables"
        },
        {
          key: "D",
          text: "Application.ServerVariables"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. Request.ServerVariables\n\n回答错误，正确答案是 Request.ServerVariables。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-15",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-2",
      type: "single",
      stem: "ASP 中用于终止脚本执行的方法是？",
      options: [
        {
          key: "A",
          text: "Response.End"
        },
        {
          key: "B",
          text: "Session.End"
        },
        {
          key: "C",
          text: "Server.End"
        },
        {
          key: "D",
          text: "Application.End"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. Response.End\n\n回答错误，正确答案是 Response.End。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-18",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-2",
      type: "single",
      stem: "ASP 中用于获取客户端 IP 地址的服务器变量是？",
      options: [
        {
          key: "A",
          text: "REMOTE_ADDR"
        },
        {
          key: "B",
          text: "HTTP_USER_AGENT"
        },
        {
          key: "C",
          text: "SERVER_NAME"
        },
        {
          key: "D",
          text: "HTTP_HOST"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. REMOTE_ADDR\n\n回答错误，正确答案是 REMOTE_ADDR。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-19",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-2",
      type: "single",
      stem: "ASP 中用于输出换行的 HTML 标签是？",
      options: [
        {
          key: "A",
          text: "<br>"
        },
        {
          key: "B",
          text: "<hr>"
        },
        {
          key: "C",
          text: "<p>"
        },
        {
          key: "D",
          text: "<div>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <br>\n\n回答错误，正确答案是 <br>。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-3",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-3",
      type: "single",
      stem: "ASP 主要运行在哪种服务器上？",
      options: [
        {
          key: "A",
          text: "IIS"
        },
        {
          key: "B",
          text: "Apache"
        },
        {
          key: "C",
          text: "Nginx"
        },
        {
          key: "D",
          text: "Tomcat"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. IIS\n\n回答错误，ASP 主要运行在 IIS 上。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-5",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-3",
      type: "single",
      stem: "ASP 中用于输出内容到页面的对象是？",
      options: [
        {
          key: "A",
          text: "Response"
        },
        {
          key: "B",
          text: "Request"
        },
        {
          key: "C",
          text: "Server"
        },
        {
          key: "D",
          text: "Session"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. Response\n\n回答错误，正确答案是 Response。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-6",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-3",
      type: "single",
      stem: "ASP 中用于接收表单提交数据的对象是？",
      options: [
        {
          key: "A",
          text: "Request"
        },
        {
          key: "B",
          text: "Response"
        },
        {
          key: "C",
          text: "Server"
        },
        {
          key: "D",
          text: "Application"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. Request\n\n回答错误，正确答案是 Request。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-10",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-3",
      type: "single",
      stem: "ASP 中用于执行 SQL 查询并返回结果集的对象是？",
      options: [
        {
          key: "A",
          text: "Recordset"
        },
        {
          key: "B",
          text: "Connection"
        },
        {
          key: "C",
          text: "Command"
        },
        {
          key: "D",
          text: "Query"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. Recordset\n\n回答错误，正确答案是 Recordset。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-13",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-3",
      type: "single",
      stem: "ASP 中用于设置 Cookie 的对象是？",
      options: [
        {
          key: "A",
          text: "Response.Cookies"
        },
        {
          key: "B",
          text: "Request.Cookies"
        },
        {
          key: "C",
          text: "Session.Cookies"
        },
        {
          key: "D",
          text: "Application.Cookies"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. Response.Cookies\n\n回答错误，正确答案是 Response.Cookies。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-asp-14",
      stageKey: "rn-asp-stage",
      topicKey: "rn-asp-3",
      type: "single",
      stem: "ASP 中用于读取 Cookie 的对象是？",
      options: [
        {
          key: "A",
          text: "Request.Cookies"
        },
        {
          key: "B",
          text: "Response.Cookies"
        },
        {
          key: "C",
          text: "Session.Cookies"
        },
        {
          key: "D",
          text: "Application.Cookies"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. Request.Cookies\n\n回答错误，正确答案是 Request.Cookies。\n\n考点：ASP 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["ASP", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    }
  ],
  sources: [
    {
      key: "runoob-com",
      name: "菜鸟教程（runoob.com）",
      url: "https://www.runoob.com",
      license: "站点声明 Copyright © 2013-2026（保留所有权利，未声明开源许可）· 个人自用不商用",
      usage: "import",
      note: "抓取口径：只抓有官方测验的 19 个教程的知识点与测验题；robots.txt 未禁止教程页（仅禁 /try/ 等），请求限并发并留间隔。"
    },
    {
      key: "runoob-quiz",
      name: "菜鸟教程 · 在线测验",
      url: "https://www.runoob.com/quiz/",
      license: "站点声明 Copyright © 2013-2026（保留所有权利，未声明开源许可）· 个人自用不商用",
      usage: "reference",
      note: "题目与答案来自测验页内嵌的 quizData（题干/选项/正确下标/解析）。"
    }
  ]
};
