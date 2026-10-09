import type { LearningTopicLesson } from "../types";

export const pythonTopicLessons: Record<string, LearningTopicLesson> = {
  "python-values-control": {
    overview: [
      "变量不是装值的盒子，而是名称到对象的绑定。整数、字符串和布尔值是不可变对象，重新赋值只是让名称指向另一个对象；变量类型由运行时对象决定。",
      "控制流把程序拆成路径。条件表达式产生布尔结果，循环在每次迭代前重新检查条件或从一个可迭代对象取下一项。写代码时先确定初始状态、更新动作和退出条件。",
    ],
    mechanism: [
      "`if/elif/else` 从上到下检查条件，第一个为真的分支执行后跳过其余分支；条件不是布尔值时按真值规则转换。",
      "`for` 依赖迭代协议逐个取值，`while` 依赖条件表达式；只要循环体没有改变状态或触发退出，就可能无限循环。",
    ],
    example: {
      title: "用循环和条件聚合数据",
      language: "python",
      code: `scores = [58, 76, 91, 83]
passed = 0
total = 0

for score in scores:
    total += score
    if score >= 60:
        passed += 1

print(total / len(scores), passed)`,
      explanation: "循环负责逐项处理，条件只改变通过人数，累加和计数都在循环体内更新。把每次迭代后的 total 和 passed 写出来，就能验证程序状态。",
    },
    practiceSteps: [
      "先写输入样例，手动列出前两次迭代后的变量值。",
      "运行程序，与手算结果比较；不一致时打印循环变量。",
      "增加空列表分数处理，思考为何不能直接除以 0。",
    ],
    masteryChecklist: [
      "能解释名称绑定与对象身份的区别。",
      "能给一段循环写出初始状态、更新动作和退出条件。",
    ],
  },
  "python-functions": {
    overview: [
      "函数把输入、处理和输出封装成稳定接口。调用者只依赖函数名、参数和返回值，不需要知道内部实现；这也是拆分脚本和测试行为的起点。",
      "作用域决定名称在哪里可见。局部变量不会自动出现在外部，函数修改可变外部对象时会产生副作用，应通过返回值或明确的对象职责表达。",
    ],
    mechanism: [
      "位置参数按顺序绑定，关键字参数按名称绑定，默认参数在函数定义时创建一次；可变的默认值会在调用间共享。",
      "`return` 结束函数并返回对象，没有 `return` 时隐式得到 `None`。`print` 只输出到终端，不能代替返回值。",
    ],
    example: {
      title: "把解析逻辑拆成纯函数",
      language: "python",
      code: `def parse_score(raw: str) -> int:
    value = int(raw)
    if not 0 <= value <= 100:
        raise ValueError("score out of range")
    return value

def average(values: list[int]) -> float:
    if not values:
        raise ValueError("values must not be empty")
    return sum(values) / len(values)`,
      explanation: "`parse_score` 只负责校验并返回整数，`average` 只负责聚合。边界错误由异常显式表达，调用方可以分别处理，而不是猜测打印结果。",
    },
    practiceSteps: [
      "为 `parse_score` 写 0、100、-1 和 `abc` 四个测试。",
      "把原来在一个函数里的解析与平均拆开，观察调用关系。",
      "尝试给列表参数添加默认值，并解释为什么不能用可变列表作为默认值。",
    ],
    masteryChecklist: [
      "能用一句话说清每个函数的输入、输出和失败条件。",
      "能区分返回值、打印和副作用。",
    ],
  },
  "python-debug": {
    overview: [
      "异常是表达“当前层无法继续”的正常控制流。不要用异常处理掩盖逻辑错误，也不要在没有恢复策略时捕获所有异常。",
      "traceback 是调用链证据：最后一行通常给出异常类型和直接触发点，向上一层层显示调用来源。排障顺序是复现、观察、提出最小假设、验证修复。",
    ],
    mechanism: [
      "`try` 中发生异常时，解释器寻找匹配的 `except`；`finally` 无论成功还是失败都会执行，适合释放资源。",
      "`raise ... from error` 保留原始异常链，`logging.exception` 能记录 traceback；只记录 `str(error)` 往往不够定位根因。",
    ],
    example: {
      title: "保留异常上下文并区分可恢复错误",
      language: "python",
      code: `import logging

def load_config(path):
    try:
        with open(path, encoding="utf-8") as file:
            return file.read()
    except FileNotFoundError as error:
        raise RuntimeError(f"config missing: {path}") from error

try:
    load_config("app.toml")
except RuntimeError:
    logging.exception("startup failed")`,
      explanation: "底层异常被转换成启动阶段的领域错误，同时通过 `from` 保留根因。日志记录完整 traceback，调用方仍能决定是否重试或退出。",
    },
    practiceSteps: [
      "制造一个 `FileNotFoundError`，从 traceback 找出第一处业务调用。",
      "删除 `from error` 再运行，比较异常链信息是否减少。",
      "为错误路径写一个不依赖真实文件系统的单元测试。",
    ],
    masteryChecklist: [
      "能从 traceback 指出错误类型、触发位置和调用来源。",
      "能说明捕获异常后是自己恢复还是继续向上抛出。",
    ],
  },
  "python-collections": {
    overview: [
      "容器选择来自访问模式。需要顺序和随机位置用列表，需要按键查找用字典，只需要唯一成员或集合运算用集合，不可变记录用元组。",
      "复杂度的直觉是操作增长趋势：列表按索引访问快，按值查找通常要扫描；字典和集合依赖哈希，平均查找接近常数时间，但键必须可哈希。",
    ],
    mechanism: [
      "字典保存键到值的映射，重复键覆盖旧值；集合保存唯一元素，适合去重、交集、并集和差集。",
      "遍历列表时删除元素会改变后续索引，容易漏项；应构建新列表，或先记录待删除项再统一处理。",
    ],
    example: {
      title: "用字典建立索引，用集合去重",
      language: "python",
      code: `events = [("u1", "login"), ("u2", "open"), ("u1", "pay")]

actions = {}
for user_id, action in events:
    actions.setdefault(user_id, []).append(action)

paying_users = {user_id for user_id, items in actions.items() if "pay" in items}
print(actions["u1"], len(paying_users))`,
      explanation: "字典把每个用户映射到动作列表，集合只保留满足条件的用户。`setdefault` 避免在每个用户上重复写初始化分支。",
    },
    practiceSteps: [
      "把日志解析成 `dict[user_id, list[action]]` 并统计独立用户。",
      "分别用列表和集合去重，比较代码和复杂度。",
      "尝试把字典作为键，验证其不可哈希并解释原因。",
    ],
    masteryChecklist: [
      "能根据访问模式选择 list、dict、set 或 tuple。",
      "能说明为什么遍历时删除列表元素容易出错。",
    ],
  },
  "python-files": {
    overview: [
      "文件和配置是程序与外部世界之间的持久化边界。路径不能依赖当前工作目录，读写必须明确编码，结构化数据应在进入业务逻辑前完成格式校验。",
      "虚拟环境把项目依赖与全局解释器隔离，依赖锁定让本地、CI 和部署环境得到可重复结果。",
    ],
    mechanism: [
      "`with open(...)` 使用上下文管理器，在正常退出和异常路径中都调用 `close()`。",
      "`pathlib.Path` 能组合目录、读取文本和判断存在，避免用字符串拼接路径；JSON 只是文本格式，解析后仍要检查字段和类型。",
    ],
    example: {
      title: "用 pathlib 读写 JSON 配置",
      language: "python",
      code: `import json
from pathlib import Path

path = Path(__file__).with_name("settings.json")
data = json.loads(path.read_text(encoding="utf-8"))

if data.get("retries") is None:
    raise ValueError("retries is required")

print(int(data["retries"]))`,
      explanation: "配置文件路径相对于模块位置，编码固定为 UTF-8，解析后检查必需字段。这样在不同工作目录下运行也能得到一致行为。",
    },
    practiceSteps: [
      "创建一个配置文件，读取并校验 `retries` 和 `timeout`。",
      "故意删除一个字段，让程序给出明确错误。",
      "在虚拟环境中安装依赖并记录到 `requirements.txt` 或项目配置。",
    ],
    masteryChecklist: [
      "能解释为什么不应依赖当前工作目录拼接路径。",
      "能说明虚拟环境和依赖锁定的作用。",
    ],
  },
  "python-testing": {
    overview: [
      "测试固定行为契约，而不是复制实现。一个好的测试会说明输入、预期结果和失败原因；重构不应让测试全部重写，除非公共契约发生变化。",
      "测试范围至少要覆盖正常路径、空值/边界、非法输入和资源失败。夹具负责准备可复用上下文，不应把测试隐藏在复杂继承链中。",
    ],
    mechanism: [
      "pytest 通过发现 `test_*.py` 和 `test_*` 函数执行测试，断言失败会报告具体位置。",
      "参数化可以用一组样例覆盖边界；`tmp_path` 等内置夹具让文件测试互不污染，外部网络和时钟应替换为可控依赖。",
    ],
    example: {
      title: "覆盖正常、边界和异常",
      language: "python",
      code: `import pytest

def parse_port(raw: str) -> int:
    port = int(raw)
    if not 1 <= port <= 65535:
        raise ValueError("invalid port")
    return port

@pytest.mark.parametrize("raw, expected", [("80", 80), ("65535", 65535)])
def test_parse_port(raw, expected):
    assert parse_port(raw) == expected

def test_parse_port_rejects_zero():
    with pytest.raises(ValueError):
        parse_port("0")`,
      explanation: "正常样例和上边界使用参数化，非法下边界单独测试异常类型。测试名称直接描述被保护的行为，失败时容易定位。",
    },
    practiceSteps: [
      "为解析器列出所有等价类和边界值。",
      "先写失败测试，再实现最小代码让它通过。",
      "使用 `tmp_path` 替换真实文件路径并验证资源清理。",
    ],
    masteryChecklist: [
      "能说明每个测试保护的具体行为。",
      "能识别测试中的时间、网络和全局状态依赖。",
    ],
  },
  "python-classes": {
    overview: [
      "类把状态和行为绑定在同一职责边界，实例属性属于对象，类属性属于类。继承表达“是什么”的稳定关系，组合表达“由什么组成”的灵活协作。",
      "`dataclass` 适合以数据为主的对象，`__eq__`、`__repr__` 等魔术方法应让对象行为更自然，而不是为了炫技实现所有运算符。",
    ],
    mechanism: [
      "普通方法第一个参数 `self` 指向实例；初始化发生在 `__init__`，对象比较和显示由魔术方法控制。",
      "多个实例共享可变类属性会相互影响，例如列表缓存；需要每实例独立状态时应放在 `__init__` 中创建。",
    ],
    example: {
      title: "组合优先于继承的订单模型",
      language: "python",
      code: `from dataclasses import dataclass

@dataclass(frozen=True)
class Money:
    amount: int
    currency: str = "CNY"

@dataclass
class Order:
    order_id: str
    total: Money

    def is_empty(self) -> bool:
        return self.total.amount == 0

order = Order("o-1", Money(199))
print(order.is_empty())`,
      explanation: "订单拥有一个金额对象，而不是继承金额；`Money` 冻结后可作为稳定值传递，职责和比较语义都更清楚。",
    },
    practiceSteps: [
      "为任务、标签和任务列表设计对象，画出依赖方向。",
      "为对象补 `__eq__` 或 `dataclass` 比较测试。",
      "把一个继承层级改成组合，比较调用方修改量。",
    ],
    masteryChecklist: [
      "能解释对象状态、职责和依赖边界。",
      "能判断何时使用继承，何时使用组合。",
    ],
  },
  "python-typing": {
    overview: [
      "类型标注描述接口契约，帮助静态检查器在运行前发现不一致；它不等于运行时校验，外部输入仍需验证。",
      "泛型表达容器和算法对元素类型的约束，`Protocol` 以行为建立可替换性，而不是强迫实现类继承某个基类。",
    ],
    mechanism: [
      "`list[str]` 表示字符串列表，`str | None` 表示可能为空；`Any` 会关闭大部分检查，应尽量留在第三方边界。",
      "协议类型只要求对象拥有指定方法和属性，结构化类型让内存仓库和文件仓库可以被同一调用方使用。",
    ],
    example: {
      title: "用 Protocol 描述能力",
      language: "python",
      code: `from typing import Protocol

class UserReader(Protocol):
    def get(self, user_id: str) -> dict[str, str] | None: ...

class InMemoryUsers:
    def __init__(self) -> None:
        self.items: dict[str, dict[str, str]] = {}

    def get(self, user_id: str) -> dict[str, str] | None:
        return self.items.get(user_id)

def display_name(reader: UserReader, user_id: str) -> str:
    user = reader.get(user_id)
    return user["name"] if user else "unknown"`,
      explanation: "`display_name` 只依赖 `get` 能力，任何满足协议的对象都能替换。调用方不需要知道数据来自内存、数据库还是文件。",
    },
    practiceSteps: [
      "为数据仓库写 Protocol，并实现内存和文件两个版本。",
      "运行静态检查，观察不兼容返回类型会在哪里报错。",
      "在函数入口对用户输入做一次运行时校验。",
    ],
    masteryChecklist: [
      "能区分静态类型标注与运行时校验。",
      "能解释 Protocol 为什么比强迫继承更灵活。",
    ],
  },
  "python-context": {
    overview: [
      "迭代协议让不同的数据源拥有统一遍历方式，生成器用 `yield` 按需产生值，降低大数据的峰值内存。",
      "上下文管理器把建立和清理成对封装，装饰器把横切逻辑包在函数外层。两者都应解决真实重复，而不是制造抽象层。",
    ],
    mechanism: [
      "生成器执行到 `yield` 时暂停，下一次迭代从暂停点继续；生成器只能被消费一次，重复遍历需要重新创建。",
      "`__enter__` 获取资源，`__exit__` 在正常或异常路径中释放；`contextlib.contextmanager` 可用 `try/finally` 把生成器写成上下文管理器。",
    ],
    example: {
      title: "流式读取并保证事务清理",
      language: "python",
      code: `from contextlib import contextmanager

def read_lines(path):
    with open(path, encoding="utf-8") as file:
        for line in file:
            yield line.strip()

@contextmanager
def transaction(connection):
    connection.begin()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise`,
      explanation: "日志文件一次只读取一行；事务在成功时提交、失败时回滚，并继续把异常交给上层，避免静默吞错。",
    },
    practiceSteps: [
      "用生成器统计大文件行数，观察是否比一次性读取更省内存。",
      "给文件读取器增加异常，验证生成器会正确传播错误。",
      "实现一个计时装饰器并保留原函数名称。",
    ],
    masteryChecklist: [
      "能说明生成器的惰性和一次性消费特点。",
      "能解释上下文管理器在异常时如何释放资源。",
    ],
  },
  "python-pandas": {
    overview: [
      "Pandas 处理的核心是索引、列和行粒度。合并、分组和透视之前，必须先确认每一行代表什么，否则数值可能被重复计算。",
      "每个转换步骤都应留下可验证证据：行数、唯一键数量、缺失率、聚合前后总额。链式调用可以简洁，但不能省略检查点。",
    ],
    mechanism: [
      "`merge` 按连接键组合行，键不唯一会发生多对多匹配并膨胀；`groupby` 把行压缩成组，`pivot` 把唯一值变成列。",
      "缺失值可能是未知、未发生或不适用，处理方式不同；直接删除可能让某个分组样本消失，影响偏差。",
    ],
    example: {
      title: "合并前验证键并计算日销售额",
      language: "python",
      code: `orders = orders.drop_duplicates(["order_id"])
products = products.drop_duplicates(["product_id"])

if orders["product_id"].duplicated().any():
    raise ValueError("orders must be unique by product for this join")

joined = orders.merge(products, on="product_id", how="left", validate="many_to_one")
joined["revenue"] = joined["quantity"] * joined["price"]
daily = joined.groupby("order_date", as_index=False)["revenue"].sum()

assert joined["price"].notna().all()`,
      explanation: "先去掉订单重复并按唯一键合并，`validate` 会在关系不符合预期时失败。只有确认价格完整后，才计算收入和日聚合。",
    },
    practiceSteps: [
      "查看每张表行数、主键唯一性和关键字段缺失率。",
      "用 `validate` 合并并故意制造重复键，观察异常。",
      "比较删除缺失值前后各分组样本数量。",
    ],
    masteryChecklist: [
      "能在合并前说明双方连接键的业务身份。",
      "能解释行数膨胀和指标膨胀的对应关系。",
    ],
  },
  "python-visualization": {
    overview: [
      "可视化的第一步是写问题：是在比较类别、观察趋势、分析分布还是寻找关系？图形选择由问题决定，不由审美偏好决定。",
      "均值、中位数和分位数回答不同问题；纵轴截断、缺失样本和极端值都会改变读者判断，图表必须与完整口径一起呈现。",
    ],
    mechanism: [
      "分布图帮助识别双峰和长尾，箱线图帮助比较分组离散程度，折线图适合有序时间，散点图适合观察两个数值变量的关系。",
      "标题应说明比较对象和时间范围，基准线应解释参照，结论要写明不能回答的问题。",
    ],
    example: {
      title: "先做分布再比较均值",
      language: "python",
      code: `import pandas as pd

summary = sales.groupby("channel")["amount"].agg(
    users="count",
    median="median",
    p90=lambda values: values.quantile(0.9),
)
print(summary.sort_values("median", ascending=False))

# 画图前先检查每个渠道的样本量，避免小样本均值造成误判。`,
      explanation: "统计表同时展示样本量、中位数和 P90，避免只看均值。后续图表可以使用同一口径，并标注样本量。",
    },
    practiceSteps: [
      "为四个业务问题分别写出合适的图型和比较对象。",
      "对同一数据画直方图和均值点，检查是否隐藏双峰。",
      "在图表标题中写明时间范围和数据限制。",
    ],
    masteryChecklist: [
      "能说明每张图回答什么问题，以及不能回答什么。",
      "能识别纵轴截断和平均掩盖分布的风险。",
    ],
  },
  "python-capstone": {
    overview: [
      "综合项目先从可演示结果和验收条件开始，而不是无限增加功能。最小版本应能读取真实数据、完成一次分析并输出可检查结果。",
      "项目结构、依赖、测试、README 和数据来源共同决定可复现性。复盘要记录偏差、风险和下一轮迭代，而不是只写“项目完成”。",
    ],
    mechanism: [
      "把需求拆成输入、转换、输出和失败路径；每个模块有单一职责，数据边界用校验保护。",
      "验收不是演示一张图，而是能在新环境按文档运行，并让结果追溯到原始数据和每个转换步骤。",
    ],
    example: {
      title: "README 中的最小运行契约",
      language: "text",
      code: `项目：课程报名分析
输入：data/orders.csv（订单号唯一，金额 >= 0）
运行：python -m course_analysis --input data/orders.csv
输出：output/summary.csv、output/chart.png
测试：pytest
限制：只覆盖 2026-01 至 2026-09，缺失金额按未支付处理`,
      explanation: "运行契约明确输入约束、命令、输出和限制。任何人按 README 执行都能得到相同类型的产物，失败也有明确输入边界。",
    },
    practiceSteps: [
      "写一个包含输入、输出和失败条件的验收清单。",
      "把项目拆成读取、清洗、分析、导出和命令行五个模块。",
      "在新目录按 README 重建环境并运行完整测试。",
    ],
    masteryChecklist: [
      "项目能在新环境按文档运行并产生可检查结果。",
      "能说明数据来源、处理版本、限制和下一步。",
    ],
  },
};
