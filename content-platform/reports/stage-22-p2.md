# 阶段 22 汇报：P2 408 入口与知识体系 UI

- **ADR**：ADR-001（内容模型与稳定 ID）
- **日期**：2026-10-13
- **执行前提交**：`b6a46b7`（P0/P1，已推送 `origin/main`）
- **范围**：408 专区 Web / 移动端入口、章节知识点浏览、历年真题入口与顶部安全区；不新增数据库迁移，不改 408 数据权威层

## 结论

- 移动端 408 知识体系已从 `packages/content` 的粗粒度课程 Track 切到 `exam_408_*` 权威总览。
- 章节点击不再跳 `/quiz/chapter`，改为打开底部章节面板，直接列出该章知识点、题量和进入真题知识点的入口。
- 408 专项题库仍保留在「章节题库」页，用于继续使用现有技术课程配套题；章节真题浏览使用数据库知识点页。
- 历年真题继续按 `exam_408_papers` 读取，移动端可从 408 专区直接进入年份试卷。
- Web 章节弹窗在小屏改为底部抽屉，统计网格和章节可访问性同步收口。

## 数据事实

本地 Web API 实测：

```text
subjects=4
chapters=25
points=99
papers=18
questions=846
```

四个科目章节/知识点分布：

| 科目 | 章节 | 知识点 | 关联题 |
|---|---:|---:|---:|
| 数据结构 | 7 | 31 | 254 |
| 计算机组成原理 | 7 | 27 | 297 |
| 操作系统 | 5 | 17 | 240 |
| 计算机网络 | 6 | 24 | 184 |

## 改动

### 移动端

- `apps/mobile/src/app/exam-408.tsx`
  - 使用 `getExam408Overview()` 渲染四科、25 章、99 个知识点和题量。
  - 章节卡打开 `BottomSheet`，面板内展示章节知识点、标签和关联真题数量。
  - 知识点点击经面板关闭动画后进入 `/quiz/408-point`，避免 Modal 与新页面叠加。
  - 保留「408 专项强化」，继续复用原 Track 题库与本轮算法动图内容。
  - 历年真题按数据库试卷列表渲染，年份倒序并保留题量、分值。
- `apps/mobile/src/lib/exam-408-view.ts`
  - 抽出科目回退、空统计、章节预览和内部标签过滤逻辑。
- `apps/mobile/src/lib/exam-408-view.test.ts`
  - 覆盖科目回退、零值统计、章节预览和内部标签过滤。
- `apps/mobile/src/components/screen-header.tsx`
  - 顶部安全区增加 Android `StatusBar.currentHeight` 兜底；修复试卷页状态栏可能压住顶部导航的问题。

### Web

- `apps/web/components/exam/exam-408-hub.tsx`
  - 总览统计小屏改为两列，避免 5 项在三列网格中失衡。
  - 科目按钮显示完整科目名并增加 `aria-pressed`。
  - 章节按钮增加可读的 `aria-label`。
  - 小屏章节弹窗改为底部抽屉；使用不透明卡片底，避免底部导航透过弹窗影响阅读。

## 验证

- `pnpm -F mobile typecheck`：通过
- `pnpm -F web typecheck`：通过
- `pnpm typecheck`：7/7 通过
- `pnpm -F mobile test`：65 个测试文件，614 项通过
- `pnpm -F web test`：209 个测试文件通过（3 个跳过），1401 项通过（15 个跳过）
- `pnpm test:scripts`：90 项通过，内容质量 0 警告，迁移/索引/API/worklet 门槛通过
- `pnpm -F mobile lint`：0 error，66 个历史 warning
- `pnpm -F web lint`：0 error，56 个历史 warning
- Playwright 移动端截图核验：统计、科目横滑、章节卡与章节底部抽屉正常；截图存于本机 `e2e/.local/p2/`

## 未做与边界

- 没有新增 `exam_408_*` 到统一 `knowledge_points` 的迁移。99 个 408 索引点与当前统一 `LearningTopic` 粒度不同，贸然合并会污染阅读进度和掌握度语义。
- 没有新增「按章节直接开一场计分练习」的 API。当前章节面板进入知识点后，可直接浏览该知识点关联真题；整卷训练继续走年份试卷运行器。
- 顶部安全区已做代码级修复；仍需在下一版 Android 真机上检查状态栏、三键导航和手势导航三种环境。

## 下一阶段建议

1. 为章节增加一个真正的 `chapter practice session` 查询：一次拉取该章全部关联题，复用现有判分与错题记录。
2. 建立 408 索引点到统一知识点/学习进度的稳定映射表，再接入阅读完成、收藏和掌握度。
3. 发布前做 Android 真机验收：408 首页、章节底部面板、知识点页、试卷页、试卷刷题页各检查浅色/深色和系统字体放大。
