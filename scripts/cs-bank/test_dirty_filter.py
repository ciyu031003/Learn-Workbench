# -*- coding: utf-8 -*-
"""dirty_filter + parse.py 目录页过滤回归验证（可复现，无需生产库）。

用法：py scripts/cs-bank/test_dirty_filter.py

验证点：
  1. dirty_filter 单元口径：目录行命中、数学省略号/正常题干不命中
  2. 端到端：构造一段含 PDF 目录页的样本文本，跑 parse.py，证明不再产出目录行
  3. 防误杀：真实业务样本（Photoshop 真题、习题卡小节号、A[0...m-1]）必须保留
"""
import json
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dirty_filter as df  # noqa: E402

FAIL = []


def check(name, got, want):
    ok = got == want
    print(("  PASS " if ok else "  FAIL ") + name + "  got=%r want=%r" % (got, want))
    if not ok:
        FAIL.append(name)


def section(t):
    print("\n== " + t + " ==")


# ---------- 1. 单元口径 ----------
section("1. dirty_filter 单元口径")

TOC_LINES = [
    "算法的复杂度.......................................",
    "线性结构和非线性结构.........",
    "二叉树的遍历............................",
    "数据模型的基本概念.........................",
    "上机考试流程……………………………",
    "9 参考资源..............................................305",
    "1.2 数据结构...............................................",
    "........................................",
]
for ln in TOC_LINES:
    check("is_toc_line(toc %r)" % ln[:22], df.is_toc_line(ln), True)

CLEAN_LINES = [
    "算法的复杂度",
    "Photoshop中使用魔棒工具单击图像，选中色彩范围的大小与哪些选项有密切关系?",
    "循环队列存储在数组A[0...m-1]，则出队时的操作为（ ）。",
    "已知一个栈的进栈序列为p1, p2, p3, ..., pn，其输出序列是1, 2, 3, ..., n。",
    "一个10 阶对称矩阵A[1...10,1...10]采用压缩存储方式。",
    "int fun(int n, ...) 可变参数的写法是怎样的？",
    "Promise.all([ .. ]) 和 Promise.race([ .. ]) 有什么区别？",
]
for ln in CLEAN_LINES:
    check("is_toc_line(clean %r)" % ln[:22], df.is_toc_line(ln), False)

check("is_dot_filler(pure dots)", df.is_dot_filler("........"), True)
check("is_dot_filler(real)", df.is_dot_filler("算法的复杂度"), False)

# ---------- 2. 整页目录判定 ----------
section("2. is_toc_page")
TOC_PAGE = "\n".join([
    "目  录",
    "第1章 算法.......................................1",
    "1.1 算法的复杂度.......................................2",
    "1.2 数据结构...............................................5",
    "1.3 栈...........................................................9",
])
check("is_toc_page(toc page)", df.is_toc_page(TOC_PAGE), True)
BODY_PAGE = "\n".join([
    "1.1 算法的复杂度",
    "利用计算机算法为计算机解题的过程实际上是在实施某种算法。",
    "算法一般具有4 个基本特征：可行性、确定性、有穷性、拥有足够的情报。",
    "（1）算法的基本特征",
])
check("is_toc_page(body page)", df.is_toc_page(BODY_PAGE), False)

# ---------- 3. 端到端 parse.py ----------
section("3. 端到端 parse.py（构造含目录页的样本）")

SAMPLE = "\n".join([
    "1.1 算法的复杂度.......................................",
    "1.2 数据结构...............................................",
    "1.3 栈...........................................................",
    "1.4 队列.......................................................",
    "1.5 链表......................................................",
    "2.1 线性结构和非线性结构",
    "根据数据结构中各数据元素之间前后件关系的复杂程度，一般将数据结构分为两大类型：",
    "线性结构与非线性结构。如果一个非空的数据结构满足下列两个条件：有且只有一个根结点；",
    "每一个结点最多有一个前件，也最多有一个后件，则称为线性结构，否则称为非线性结构。",
    "3.1 二叉树的遍历",
    "在遍历二叉树的过程中，一般先遍历左子树，再遍历右子树。在先左后右的原则下，",
    "根据访问根结点的次序，二叉树的遍历分为三类：前序遍历、中序遍历和后序遍历。",
    "前序遍历先访问根结点，然后遍历左子树，最后遍历右子树，这是最常用的遍历方式之一。",
])

tmpdir = tempfile.mkdtemp(prefix="csbank-toc-")
raw_path = os.path.join(tmpdir, "raw.jsonl")
items_path = os.path.join(tmpdir, "items.jsonl")
rec = {"id": "grade_sample", "root": "grade",
       "relpath": "二级 公共基础知识/sample.pdf",
       "ext": ".pdf", "chars": len(SAMPLE), "text": SAMPLE}
with open(raw_path, "w", encoding="utf-8") as f:
    f.write(json.dumps(rec, ensure_ascii=False) + "\n")

parse_py = os.path.join(os.path.dirname(os.path.abspath(__file__)), "parse.py")
r = subprocess.run([sys.executable, parse_py, raw_path, items_path],
                   capture_output=True, text=True, encoding="utf-8")
print("  parse.py:", (r.stdout or "").strip(), (r.stderr or "").strip()[:300])
check("parse.py exit", r.returncode, 0)

items = [json.loads(l) for l in open(items_path, encoding="utf-8")]
print("  produced %d items:" % len(items))
for it in items:
    print("    - [%s] %r" % (it["type"], it["question"][:60]))

leaked = [it for it in items if df.is_dirty_question(it["question"])]
check("目录行未泄漏进 items", len(leaked), 0)
for it in leaked:
    print("    LEAK:", repr(it["question"][:80]))

leaked_ans = [it for it in items if df.is_dirty_answer(it.get("explanation") or "")]
check("目录行未泄漏进 answer", len(leaked_ans), 0)

check("仍保留了正常知识点卡", len(items) >= 2, True)
check("题干不含目录引导点", all(not df.has_toc_leader(it["question"]) for it in items), True)

section("结果")
if FAIL:
    print("FAILED %d checks: %s" % (len(FAIL), ", ".join(FAIL)))
    sys.exit(1)
print("ALL CHECKS PASSED")
