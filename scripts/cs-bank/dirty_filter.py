# -*- coding: utf-8 -*-
"""PDF 目录页（TOC）噪声过滤 —— cs-bank 流水线的唯一判定口径。

背景
----
生产库 interview_questions 曾出现真机反馈的脏数据：
    id=1480 question='算法的复杂度.......................................'
              answer  ='1.2 数据结构...............................................'
这些是 PDF **目录页**行：question 是章标题、answer 是下一条目录行，纯噪声。

根因在 parse.py::parse_headings —— 目录行形如
    1.1 算法的复杂度.......................................
HEAD_RE 匹配后 num='1.1'、multi_level=True，再把行首 '1.1 ' 用 sub 剥掉，
于是 question 变成 算法的复杂度....... ，len 恰好 <= 50，被当成「知识点卡」收下；
而紧随其后的 1.2 数据结构... 因标题长度 > 50 未进 heads，被并进上一条的 body，
成为 answer。两条都是目录行。

判定口径
--------
**只匹配「题目本身就是目录行」的强特征，宁可漏杀不可误杀。**

采用（经生产库全量核对，命中 6 条、误杀 0 条）：

R1 has_toc_leader  question/标题以 >=4 个连续点号/省略号结尾（PDF 目录引导点）。
   点号字符集：. 。 … ．，允许其后跟页码数字与空白。
   这正是生产库软下架所用的谓词 question ~ '[.。…]{4,}\s*$'，保证库与流水线同口径。

R2 is_dot_filler   整行去掉点号/空白后为空（纯点号填充行）。

R3 is_toc_page     整页多数行都是目录行 -> 该页是目录页，整页丢弃。
   用于兜住「目录页里恰好没有引导点」的残留（如 id=7047 的附录目录）。

明确【不】采用（经生产库抽查证实会误杀，见 .local/interview-cleanup-2026-10-11.txt）：
  * answer ~ '^[0-9]+\.[0-9]' —— 上架 31 条里约 27 条是正常习题卡
    （answer 以 "5.3 ..."、"2.4.1.1." 等小节号开头），会误杀面试·Java / 书库习题。
  * question ~ '^[.。…．]' —— 上架 852 条，其中 709 条是等级考试一级 Photoshop 真题
    （题干被抽成 ". Photoshop中..."），只是行首多一个点，题干完整，不应下架。
  * '\.{4,}'（不限行尾）—— 会误杀数学区间写法 A[0...m-1]、L1, L2, ... , L8 等真题。
  * 「answer 含 >=3 行小节号」整页判目录 —— 上架 114 条误杀，故不采用。
"""

import re

# 点号/省略号字符集：半角点、中文句号、省略号、全角句点
DOT_CHARS = ".。…．"

# 行尾 >=4 个连续点号（可再跟页码/空白），即 PDF 目录引导点
TOC_LEADER_TAIL = re.compile(r"[" + re.escape(DOT_CHARS) + r"]{4,}[\s\d]*$")

# 纯点号填充行（去掉点号与空白后为空）
_ONLY_DOTS = re.compile(r"^[\s" + re.escape(DOT_CHARS) + r"]+$")

# 目录行里的「编号 + 标题」形态，用于整页目录判定
_TOC_ENTRY = re.compile(r"^\s*(?:\d+(?:[.．]\d+)*|[一二三四五六七八九十]+[、.．])\s*\S")


def has_toc_leader(s):
    """行尾是否为 PDF 目录引导点（>=4 个连续点号/省略号，允许后跟页码）。"""
    return bool(s) and bool(TOC_LEADER_TAIL.search(s))


def is_dot_filler(s):
    """整行是否为纯点号/省略号填充（无任何实义字符）。"""
    if not s:
        return False
    t = s.strip()
    return bool(t) and bool(_ONLY_DOTS.match(t))


def is_toc_line(s):
    """单行是否为目录行：行尾有引导点，或整行是纯点号填充。"""
    return has_toc_leader(s) or is_dot_filler(s)


def is_toc_page(text, min_lines=3, ratio=0.5):
    """整页是否为目录页。

    判据：非空行中「目录行」数量 >= min_lines 且占比 >= ratio。
    阈值取得保守（要求过半且至少 3 行），避免误伤正文页。
    """
    lines = [ln.strip() for ln in (text or "").split("\n")]
    lines = [ln for ln in lines if ln]
    if len(lines) < min_lines:
        return False
    toc = sum(1 for ln in lines if is_toc_line(ln))
    return toc >= min_lines and toc / len(lines) >= ratio


def is_dirty_question(q):
    """题目本身是否为目录噪声（流水线出口统一拦截用）。"""
    if not q:
        return True
    return is_toc_line(q)


def is_dirty_answer(a):
    """答案是否为纯目录噪声（整段都是目录行）。"""
    if not a:
        return False
    lines = [ln.strip() for ln in a.split("\n") if ln.strip()]
    if not lines:
        return False
    return all(is_toc_line(ln) for ln in lines)
