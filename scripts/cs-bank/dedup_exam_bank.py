# -*- coding: utf-8 -*-
"""从 exam-bank.ts 里剔除与 csgraduates（ex-408-grad）重复的真题。

## 为什么需要
两条流水线从**不同本地资料**抓了同一批 408 统考真题：
  - `scripts/cs-graduates/` → `exam-408-grad-bank.ts`（csg-<年>-<题号>，717 道，带站点解析）
  - `scripts/cs-bank/`      → `exam-bank.ts`（exam-<sha1>，其中 ex-408 轨道 260 道，只有"参考答案：X"）
实测（2026-10-11）：**260 道里有 124 道与 csgraduates 是同一题**（题干归一化后前 40 字相同）。
它们同时计入 `learningTracks` 的题目总数与 `/learn/questions` 列表 → 同一道真题出现两次，
学习统计与"共 N 题"口径都被虚高。

## 保留策略（为什么保留 csgraduates 那一份）
同一道题两边的信息量不对等：
  - csgraduates 有**站点解析**（explanation 是真正的讲解），并挂了章级知识点 topicKey；
  - exam-bank 只有 `参考答案：X`，且是阶段级（无 topicKey）。
所以重复时**删 exam-bank 的那份**，保留 csgraduates。

## 判定口径
题干归一化（去空白与常见标点）后取前 40 字做键。取 40 字而不是全文，
是因为两份资料的 OCR/转写有轻微差异（如 `a, b, c` vs `a,b,c`、`下图` vs `右图`），
全文比较会漏判；40 字足以唯一确定一道 408 选择题，且不会把两道不同的题判成同一道。

用法：py scripts/cs-bank/dedup_exam_bank.py [--apply]
不带 --apply 时只报告，不写文件。
"""
import json
import re
import sys

BANK = "packages/content/src/learning/exam-408-grad-bank.ts"
EXAM = "packages/content/src/learning/exam-bank.ts"
PREFIX = 40

PUNCT = re.compile(r"[\s，。、；：（）()【】\[\]\"'“”‘’·—…]")


def norm(text):
    return PUNCT.sub("", text.replace("\\n", ""))


def csg_stems():
    src = open(BANK, encoding="utf-8").read()
    out = set()
    for m in re.finditer(r'key:\s*"csg-(\d{4})-(\d+)"[\s\S]{0,600}?stem:\s*"((?:[^"\\]|\\.)*)"', src):
        key = norm(m.group(3))[:PREFIX]
        if key:
            out.add(key)
    return out


def split_questions(src):
    """按 "    {" 切出每题块，返回 (前缀, [(块, key, stem), ...], 尾部)。

    尾部是最后一个题块之后的内容（形如 "  ],\n};\n"）—— 必须原样保留，
    否则重建出来的文件会缺掉数组与对象的收尾（第一次实现漏了它，文件语法直接不合法）。
    """
    parts = src.split("\n    {\n")
    head = parts[0]
    blocks = []
    for p in parts[1:]:
        km = re.search(r'key:\s*"([^"]+)"', p)
        sm = re.search(r'stem:\s*"((?:[^"\\]|\\.)*)"', p)
        blocks.append((p, km.group(1) if km else None, sm.group(1) if sm else None))
    tail = ""
    if blocks:
        last = blocks[-1][0]
        # 最后一个题块以 "    }," 结尾，其后就是收尾；把收尾切出来
        marker = "\n    },"
        idx = last.rfind(marker)
        if idx >= 0:
            tail = last[idx + len(marker):]
            blocks[-1] = (last[: idx + len(marker)], blocks[-1][1], blocks[-1][2])
    return head, blocks, tail


def main():
    apply = "--apply" in sys.argv
    csg = csg_stems()
    src = open(EXAM, encoding="utf-8").read()
    head, blocks, tail = split_questions(src)

    kept, dropped = [], []
    for block, key, stem in blocks:
        if stem is not None and norm(stem)[:PREFIX] in csg:
            dropped.append((key, stem))
        else:
            kept.append(block)

    print("csgraduates stems:", len(csg))
    print("exam-bank questions:", len(blocks))
    print("duplicates to drop:", len(dropped))
    print("remaining:", len(kept))
    for key, stem in dropped[:8]:
        print("  DROP", key, stem[:44])

    if not apply:
        print("(dry-run；加 --apply 才会写回 exam-bank.ts)")
        return

    rebuilt = head + "\n    {\n" + "\n    {\n".join(kept) + tail
    open(EXAM, "w", encoding="utf-8", newline="\n").write(rebuilt)
    # 写盘后立刻自检：文件必须以 "};" 收尾，否则语法不合法（第一次实现就漏了尾部）
    check = open(EXAM, encoding="utf-8").read()
    if not check.rstrip().endswith("};"):
        raise SystemExit("重建后文件未以 }; 收尾 —— 拒绝写出半截文件")
    print("wrote", EXAM, "| tail:", repr(check[-12:]))


if __name__ == "__main__":
    main()
