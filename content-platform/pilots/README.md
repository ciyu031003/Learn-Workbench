# 内容生产试点

Phase 3 的 408 试点不把站点正文复制进 git。标准做法是：

```bash
node scripts/beokayy-408/export-package.mjs \
  --subject=data-structure \
  --chapter=ds-02

node scripts/validate-content-package.mjs \
  --file .local/beokayy-408/pilots/data-structure-ds-02.package.json \
  --strict
```

`ds-02`（线性表）的实测结果由命令输出和阶段报告记录：

- chapters: 1
- points: 3
- questions: 5
- links: 5
- package fingerprint: `beb753551dd5...`

生成物固定在 `.local/`，不纳入 git。这样既能复跑真实章节试点，也不会把来源站
正文误当成可再分发内容。
