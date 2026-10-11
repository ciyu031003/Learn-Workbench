# -*- coding: utf-8 -*-
"""结构化解析：把抽取文本解析成带答案的选择题 / 判断题 / 问答 / 知识点卡。

用法：py parse2.py <raw.jsonl> <items.jsonl>
"""
import hashlib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dirty_filter as df  # noqa: E402

NOISE = [
    re.compile(r"^各个学校计算机"),
    re.compile(r"^免费分享"),
    re.compile(r"^获取\s*考研经验"),
    re.compile(r"^微信公众号"),
    re.compile(r"^关注微信公众号"),
    re.compile(r"^第?\s*\d{1,4}\s*页\s*$"),
    re.compile(r"^\s*\d{1,4}\s*$"),
]

NUM = r"(\d{1,3})"
Q_RE = re.compile(r"^\s*" + NUM + r"\s*[.．、]\s*(.+)$")
OPT_RE = re.compile(r"^\s*[（(]?([A-Da-d])[）)]?\s*[.．、:：)）]\s*(.*)$")
ANS_RE = re.compile(r"^\s*" + NUM + r"\s*[.．、]?\s*[（(]?([A-Da-d])[）)]?\s*$")
ANS2_RE = re.compile(r"^\s*" + NUM + r"\s*[.．、]?\s*[（(]?([A-Da-d])[）)]?\s*(?:解析|分析|【解析】)\s*[:：]?\s*(.*)$")
EXPL_RE = re.compile(r"^\s*(?:解析|分析|【解析】|答案解析)\s*[:：]?\s*(.*)$")
ANS_INLINE = re.compile(r"(?:正确答案|参考答案|答案)\s*[:：]?\s*[（(]?([A-Da-d]{1,4})")
QA_Q = re.compile(r"^\s*(?:问|Q|问题)\s*[:：]\s*(.+)$")
QA_A = re.compile(r"^\s*(?:答|A|答案|解析|参考答案)\s*[:：]\s*(.+)$")


def has_noise(s):
    return any(p.search(s) for p in NOISE)


def normalize(text):
    out = []
    for ln in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        s = ln.rstrip()
        if has_noise(s):
            continue
        # 目录行（行尾引导点 / 纯点号填充）直接丢弃，避免被当成题干或正文
        if df.is_toc_line(s):
            continue
        out.append(s)
    return out


def dedupe_join(lines):
    keep = []
    for ln in lines:
        s = ln.strip()
        if s:
            keep.append(s)
    return keep


def blocks(lines, start_re):
    idx = [i for i, ln in enumerate(lines) if start_re.match(ln)]
    out = []
    for k, i in enumerate(idx):
        end = idx[k + 1] if k + 1 < len(idx) else len(lines)
        out.append((i, lines[i:end]))
    return out


def split_mcq(block):
    """块 -> (stem, [(letter, text)])。"""
    stem_parts = []
    opts = []
    cur = None
    seen = set()
    for ln in block:
        m = OPT_RE.match(ln)
        if m and m.group(1).upper() not in seen:
            letter = m.group(1).upper()
            seen.add(letter)
            opts.append([letter, m.group(2).strip()])
            cur = opts[-1]
            continue
        if opts and cur is not None:
            cur[1] += " " + ln
        else:
            stem_parts.append(ln)
    stem = re.sub(r"^\s*" + NUM + r"\s*[.．、]\s*", "", " ".join(stem_parts)).strip()
    cleaned = []
    for a, b in opts:
        b = re.sub(r"\s*(?:正确答案|参考答案|答案)\s*[:：]?\s*[（(]?[A-Da-d]{1,4}[）)]?\s*$", "", b.strip()).strip()
        cleaned.append((a, b))
    return stem, cleaned


def parse_answers(text_lines):
    """兼容三种答案表：`1. D`、`1．A  2．B`、`1-5 BAABC`，并尽量挂上「解析」。"""
    ans = {}
    expl_acc = {}
    last = None
    keyline = re.compile(r"^[\d\s．.、\-–~—A-Da-d:：]+$")
    pair = re.compile(r"(\d{1,3})\s*[．.、]?\s*([A-Da-d])(?![A-Za-z])")
    rng = re.compile(r"(\d{1,3})\s*[-–~—]\s*(\d{1,3})\s*[:：]?\s*([A-Da-d]{2,})")
    for ln in text_lines:
        s = ln.strip()
        if not s:
            continue
        em = EXPL_RE.match(s)
        if em and last is not None:
            expl_acc[last] = (expl_acc.get(last, "") + " " + em.group(1).strip()).strip()
            continue
        if keyline.match(s):
            for m in rng.finditer(s):
                a, b, letters = int(m.group(1)), int(m.group(2)), m.group(3).upper()
                if 0 < b - a + 1 == len(letters):
                    for off, ch in enumerate(letters):
                        ans.setdefault(str(a + off), ch)
                        last = str(a + off)
            for m in pair.finditer(s):
                num, letter = m.group(1), m.group(2).upper()
                ans.setdefault(num, letter)
                last = num
    return {k: (v, expl_acc.get(k, "")) for k, v in ans.items()}


def parse_paper(text, subject, source):
    """真题/题库：切「题目区 / 答案区」，按题号把答案并回题目。"""
    lines = dedupe_join(normalize(text))
    cut = len(lines)
    for i, ln in enumerate(lines):
        if re.search(r"(参考答案|答案及解析|答案与解析|试题答案)", ln):
            cut = i
            break
    q_lines, a_lines = lines[:cut], lines[cut:]
    answers = parse_answers(a_lines)
    items = []
    for _i, blk in blocks(q_lines, Q_RE):
        num = Q_RE.match(blk[0]).group(1)
        stem, opts = split_mcq(blk)
        if df.is_dirty_question(stem):
            continue
        if len(opts) == 4 and len(stem) >= 6:
            letter, expl = answers.get(num, ("", ""))
            if not letter:
                mm = ANS_INLINE.search(" ".join(blk))
                if mm:
                    letter = mm.group(1).upper()
            items.append({"type": "mcq", "subject": subject, "question": stem,
                          "options": opts, "correct": letter, "explanation": expl,
                          "answer_text": "", "source": source, "num": num})
        elif len(stem) >= 12:
            items.append({"type": "qa", "subject": subject, "question": stem,
                          "options": [], "correct": "",
                          "explanation": answers.get(num, ("", ""))[1],
                          "answer_text": "", "source": source, "num": num})
    return items


def parse_generic_mcq(text, subject, source):
    """无独立答案区：题目区内就地找「答案：X」。"""
    lines = dedupe_join(normalize(text))
    items = []
    for _i, blk in blocks(lines, Q_RE):
        stem, opts = split_mcq(blk)
        if df.is_dirty_question(stem):
            continue
        if len(opts) == 4 and len(stem) >= 6:
            letter = ""
            expl = ""
            mm = ANS_INLINE.search(" ".join(blk))
            if mm:
                letter = mm.group(1).upper()
                em = EXPL_RE.match(blk[-1])
                if em:
                    expl = em.group(1).strip()
            items.append({"type": "mcq", "subject": subject, "question": stem,
                          "options": opts, "correct": letter, "explanation": expl,
                          "answer_text": "", "source": source, "num": ""})
    return items


def parse_qa(text, subject, source):
    """问/答成对。"""
    lines = dedupe_join(normalize(text))
    items = []
    i, n = 0, len(lines)
    while i < n:
        qm = QA_Q.match(lines[i])
        if qm:
            q = qm.group(1).strip()
            body = []
            j = i + 1
            while j < n and not QA_Q.match(lines[j]):
                am = QA_A.match(lines[j])
                body.append(am.group(1).strip() if am else lines[j].strip())
                j += 1
            ans = "\n".join(x for x in body if x)
            if df.is_dirty_question(q) or df.is_dirty_answer(ans):
                i = j
                continue
            if len(q) >= 6 and len(ans) >= 20:
                items.append({"type": "qa", "subject": subject, "question": q[:380],
                              "options": [], "correct": "", "explanation": ans[:7000],
                              "answer_text": ans[:7000], "source": source, "num": ""})
            i = j
        else:
            i += 1
    return items


HEAD_RE = re.compile(r"^\s*(\d+(?:[.．]\d+)*|[一二三四五六七八九十]+[、.．])\s*(.+)$")
HEAD_KW = re.compile(r"(是什么|有哪些|区别|原理|机制|如何|为什么|简述|介绍)")


def parse_headings(text, subject, source, min_body=40):
    """编号标题（问句或以「X 是什么/区别/原理」收尾）+ 正文 -> 知识点卡。"""
    lines = dedupe_join(normalize(text))
    heads = []
    for i, ln in enumerate(lines):
        s = ln.strip()
        if len(s) < 5 or len(s) > 70:
            continue
        # 目录行（如 '1.1 算法的复杂度.......'）不是标题，直接跳过
        if df.is_toc_line(s):
            continue
        m = HEAD_RE.match(s)
        if not m:
            continue
        num = m.group(1)
        title = m.group(2).strip()
        if df.is_toc_line(title):
            continue
        multi_level = ("." in num) or ("．" in num)
        is_question = s.endswith(("？", "?")) or HEAD_KW.search(title)
        if (is_question or multi_level) and 2 <= len(title) <= 50 and not title.endswith(("。", "，", "、", "；")):
            heads.append((i, re.sub(r"^\s*(\d+(?:[.．]\d+)*|[一二三四五六七八九十]+[、.．])\s*", "", s)))
    items = []
    for k, (i, q) in enumerate(heads):
        end = heads[k + 1][0] if k + 1 < len(heads) else len(lines)
        body = "\n".join(lines[i + 1:end]).strip()
        if df.is_dirty_question(q) or df.is_dirty_answer(body):
            continue
        if len(body) >= min_body:
            items.append({"type": "qa", "subject": subject, "question": q[:380],
                          "options": [], "correct": "", "explanation": body[:7000],
                          "answer_text": body[:7000], "source": source, "num": ""})
    return items


def subject_of(root, relpath):
    r = relpath.replace("\\", "/")
    parts = r.split("/")
    if root == "kaoyan_real":
        return "408统考真题" if r.startswith("联考408") else "考研真题·" + parts[0]
    if root == "kaoyan_mock":
        return "408·数据结构模拟题"
    if root == "interview":
        name = parts[-1]
        if "JS" in name:
            return "面试·前端JavaScript"
        if "Java" in name:
            return "面试·Java"
        if "CyC" in name:
            return "面试·计算机基础"
        return "面试·综合"
    if root == "book":
        m = {"algorithm": "书库·算法与数据结构", "backstage": "书库·后端与Linux",
             "database": "书库·数据库", "go": "书库·Go", "html2css": "书库·HTML与CSS",
             "http": "书库·HTTP与网络", "js": "书库·JavaScript", "node": "书库·Node.js",
             "other": "书库·综合", "react": "书库·React", "ts": "书库·TypeScript"}
        return m.get(parts[0], "书库·综合")
    if root == "grade":
        return "等级考试·" + parts[0]
    return "未分类"


def main():
    raw_path, out_path = sys.argv[1], sys.argv[2]
    total = 0
    stats = {}
    with open(raw_path, encoding="utf-8") as f, open(out_path, "w", encoding="utf-8") as out:
        for line in f:
            r = json.loads(line)
            if len(r["text"]) < 200:
                continue
            subject = subject_of(r["root"], r["relpath"])
            source = {"site": "local:" + r["root"], "note": r["relpath"]}
            text = r["text"]
            paper_roots = {"kaoyan_real", "kaoyan_mock", "grade"}
            is_paper = r["root"] in paper_roots and bool(
                re.search(r"(参考答案|答案及解析|答案与解析|试题答案)", text)
            )
            if is_paper:
                items = parse_paper(text, subject, source)
            else:
                items = parse_generic_mcq(text, subject, source)
            items += parse_qa(text, subject, source)
            items += parse_headings(text, subject, source)
            for it in items:
                it["file"] = r["id"]
                it["sig"] = hashlib.sha1(re.sub(r"\s+", "", it["question"]).encode("utf-8")).hexdigest()[:16]
                out.write(json.dumps(it, ensure_ascii=False) + "\n")
                total += 1
                stats[it["type"]] = stats.get(it["type"], 0) + 1
    print("items:", total, stats)


if __name__ == "__main__":
    main()
