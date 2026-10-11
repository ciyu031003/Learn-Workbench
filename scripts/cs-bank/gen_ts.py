# -*- coding: utf-8 -*-
"""把 bundled.json 生成学习内容包的 TS 扩展文件。"""
import json

data = json.load(open(".local/csimport/bundled.json", encoding="utf-8"))
lines = []
lines.append('import type { LearningQuestion } from "./types";')
lines.append("")
lines.append("/**")
lines.append(" * 本地真题 / 题库整理（个人自用）。由 `scripts/cs-bank/` 流水线从本地资料抽取生成，")
lines.append(" * 来源见各题 `source` 与 track 的 `local-exam` 来源条目；**自动生成，勿手改**。")
lines.append(" */")
lines.append("export const examBankExpansions: Record<string, LearningQuestion[]> = {")
OPT = ["A", "B", "C", "D"]
total = 0
for slug, payload in sorted(data.items()):
    stage = payload["stage"]
    items = payload["items"]
    lines.append('  "%s": [' % slug)
    for it in items:
        total += 1
        opts = it["options"]
        opt_ts = ", ".join(
            '{ key: "%s", text: %s }' % (OPT[i], json.dumps(opts[i], ensure_ascii=False))
            for i in range(4)
        )
        stem = json.dumps(it["stem"], ensure_ascii=False)
        expl = json.dumps(it["explanation"] or ("参考答案：" + it["answer"]), ensure_ascii=False)
        tag = json.dumps(it["subject"], ensure_ascii=False)
        lines.append("    {")
        lines.append('      key: %s,' % json.dumps(it["key"], ensure_ascii=False))
        lines.append('      stageKey: "%s",' % stage)
        lines.append('      type: "single",')
        lines.append("      stem: %s," % stem)
        lines.append("      options: [%s]," % opt_ts)
        lines.append('      answer: ["%s"],' % it["answer"])
        lines.append("      explanation: %s," % expl)
        lines.append('      difficulty: "medium",')
        lines.append('      tags: ["真题", %s],' % tag)
        lines.append('      sourceKey: "local-exam",')
        lines.append("    },")
    lines.append("  ],")
lines.append("};")
lines.append("")
open("packages/content/src/learning/exam-bank.ts", "w", encoding="utf-8", newline="\n").write("\n".join(lines))
print("wrote exam-bank.ts, questions:", total)
