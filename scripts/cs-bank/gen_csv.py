# -*- coding: utf-8 -*-
"""bank.jsonl -> 导入用 CSV（interview_questions）。"""
import csv
import json
import re

rows = [json.loads(l) for l in open(".local/csimport/bank.jsonl", encoding="utf-8")]


def difficulty(text, kind):
    if kind == "mcq":
        return "medium"
    if len(text) > 900:
        return "hard"
    if re.search(r"(手写|实现|设计|推导|证明|计算|综合)", text):
        return "hard"
    return "medium"


with open(".local/csimport/bank.csv", "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f, quoting=csv.QUOTE_ALL)
    for r in rows:
        q = r["question"].strip()[:400]
        if r["type"] == "mcq":
            opts = "  ".join("%s. %s" % (o[0], o[1]) for o in r["options"])
            q_full = (q + "  [" + opts + "]")[:400]
            if r["correct"]:
                ans = (r.get("explanation") or "").strip()
                ans = ("正确答案：%s；%s" % (r["correct"], ans)) if ans else ("正确答案：%s" % r["correct"])
            else:
                ans = "（真题回忆版，暂无参考答案）"
            q = q_full
        else:
            ans = (r.get("explanation") or "").strip() or "（暂无可参考解答）"
        tags = json.dumps(["本地整理", r["type"], r["source"]["note"].split("/")[-1][:20]], ensure_ascii=False)
        ext = "local-material#" + r["sig"]
        w.writerow([r["subject"][:40], q, ans[:8000], difficulty(r["question"], r["type"]),
                    tags, "", "local-material", "个人自用（本地资料整理）", ext])
print("csv rows:", len(rows))
