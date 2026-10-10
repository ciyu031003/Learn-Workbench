# 稳定 ID 映射表（阶段 7 = V3 Phase A）

> **本文件由脚本生成，请勿手改**：`node scripts/generate-id-mapping.mjs`（读库中 `knowledge_points`）。
> 数据来源为同步后的真实库内容；手改会立刻与库不一致。

## 1. ID 规则

| 对象 | 稳定 ID | 规则来源 |
|---|---|---|
| 学习库知识点 | `<trackSlug>/<stageKey>/<topicKey>` | 三段都来自内容包（`packages/content`），不由数组下标推导 |
| 学习库题目 | `<questionKey>`（内容包内已全局唯一） | `learning_review_cards` 主键 (user_id, question_key) 已依赖它的全局唯一性 |
| 路线图阶段 | `content_phases.slug` = `phase_key` | 迁移 060 回填 + BEFORE INSERT 触发器兜底 |
| 路线图主题 | `content_topics.slug` = `topic_key` | 同上 |

**红线**：知识点 ID 一经发布不再修改（改 ID 会断掉用户作答与复习卡片）。
内容演进只能改正文（指纹变化 → 同步识别为 updated）或新增知识点（旧知识点软归档）。

## 2. 关联规模

- 知识点：120
- 知识点关系：next 110 · related 40
- 前置边：30
- 题 ↔ 知识点：explicit 400
- 作答统一视图行数（当前库）：0

## 3. 全量映射（按课程 → 阶段 → 知识点）

### AI 应用工程（`ai-engineering`）

**阶段 1 · 模型、提示与数据结构**（`ai-foundations`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 模型输入与上下文 (`ai-model-basics`) | `ai-engineering/ai-foundations/ai-model-basics` | L4 | medium | 11 | 4 | microsoft-generative-ai | published |
| 2 | 提示与结构化输出 (`ai-prompt-output`) | `ai-engineering/ai-foundations/ai-prompt-output` | L4 | medium | 10 | 3 | microsoft-generative-ai | published |
| 3 | 向量与语义表示 (`ai-embeddings`) | `ai-engineering/ai-foundations/ai-embeddings` | L4 | medium | 6 | 3 | microsoft-generative-ai | published |

**阶段 2 · RAG、检索与评测**（`ai-rag`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 文档切分与索引 (`ai-chunking`) | `ai-engineering/ai-rag/ai-chunking` | L4 | medium | 11 | 3 | microsoft-generative-ai | published |
| 2 | 检索与回答生成 (`ai-retrieval-generation`) | `ai-engineering/ai-rag/ai-retrieval-generation` | L4 | medium | 7 | 4 | microsoft-generative-ai | published |
| 3 | RAG 评测与失败归因 (`ai-rag-eval`) | `ai-engineering/ai-rag/ai-rag-eval` | L4 | medium | 6 | 3 | microsoft-generative-ai | published |

**阶段 3 · 工具调用、Agent 与协议**（`ai-agent`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 工具与函数调用 (`ai-tools`) | `ai-engineering/ai-agent/ai-tools` | L4 | medium | 11 | 3 | microsoft-generative-ai | published |
| 2 | Agent 循环与状态 (`ai-agent-loop`) | `ai-engineering/ai-agent/ai-agent-loop` | L4 | medium | 8 | 4 | microsoft-generative-ai | published |
| 3 | 多 Agent 与协议 (`ai-multi-agent`) | `ai-engineering/ai-agent/ai-multi-agent` | L4 | medium | 6 | 3 | microsoft-generative-ai | published |

**阶段 4 · 上线、评测、安全与成本**（`ai-production`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 可观测性与评测门禁 (`ai-observability`) | `ai-engineering/ai-production/ai-observability` | L4 | medium | 9 | 3 | microsoft-generative-ai | published |
| 2 | 安全、权限与内容边界 (`ai-safety`) | `ai-engineering/ai-production/ai-safety` | L4 | medium | 7 | 3 | microsoft-generative-ai | published |
| 3 | 成本、可靠性与治理 (`ai-cost-reliability`) | `ai-engineering/ai-production/ai-cost-reliability` | L4 | medium | 6 | 4 | microsoft-generative-ai | published |

### 云平台与容器（`cloud-platform`）

**阶段 1 · 云基础与责任边界**（`cloud-foundation`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 服务模型与责任边界 (`cloud-service-models`) | `cloud-platform/cloud-foundation/cloud-service-models` | L4 | medium | 10 | 2 | az104 | published |
| 2 | 计算与网络基础 (`cloud-compute-network`) | `cloud-platform/cloud-foundation/cloud-compute-network` | L4 | medium | 11 | 2 | az104 | published |
| 3 | 身份与最小权限 (`cloud-identity`) | `cloud-platform/cloud-foundation/cloud-identity` | L4 | medium | 12 | 2 | az104 | published |

**阶段 2 · 容器与编排**（`cloud-container`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 容器与镜像 (`cloud-container-basics`) | `cloud-platform/cloud-container/cloud-container-basics` | L4 | medium | 11 | 2 | az104 | published |
| 2 | 编排与工作负载 (`cloud-k8s-workloads`) | `cloud-platform/cloud-container/cloud-k8s-workloads` | L4 | medium | 13 | 2 | az104 | published |
| 3 | 发布、探针与回滚 (`cloud-k8s-ops`) | `cloud-platform/cloud-container/cloud-k8s-ops` | L4 | medium | 11 | 2 | az104 | published |

**阶段 3 · 存储与数据接入**（`cloud-storage-data`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 对象存储与块存储 (`cloud-object-block`) | `cloud-platform/cloud-storage-data/cloud-object-block` | L4 | medium | 10 | 2 | az104 | published |
| 2 | 托管数据库与缓存 (`cloud-db-cache`) | `cloud-platform/cloud-storage-data/cloud-db-cache` | L4 | medium | 8 | 2 | az104 | published |
| 3 | CDN 与 DNS 接入 (`cloud-cdn-dns`) | `cloud-platform/cloud-storage-data/cloud-cdn-dns` | L4 | medium | 8 | 2 | az104 | published |

**阶段 4 · 可观测性、IaC 与成本**（`cloud-reliability`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 可观测性与告警 (`cloud-observability`) | `cloud-platform/cloud-reliability/cloud-observability` | L4 | medium | 7 | 2 | az104 | published |
| 2 | 基础设施即代码 (`cloud-iac`) | `cloud-platform/cloud-reliability/cloud-iac` | L4 | medium | 7 | 2 | az104 | published |
| 3 | 成本与安全治理 (`cloud-cost-security`) | `cloud-platform/cloud-reliability/cloud-cost-security` | L4 | medium | 9 | 2 | az104 | published |

### SQL 与数据分析（`data-analysis`）

**阶段 1 · 关系模型与 SQL 查询**（`data-relational`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 关系模型与数据粒度 (`data-relational-model`) | `data-analysis/data-relational/data-relational-model` | L4 | medium | 11 | 4 | ms-data-science | published |
| 2 | 查询、过滤与排序 (`data-select-filter`) | `data-analysis/data-relational/data-select-filter` | L4 | medium | 10 | 3 | ms-data-science | published |
| 3 | 多表连接与聚合 (`data-joins`) | `data-analysis/data-relational/data-joins` | L4 | medium | 10 | 6 | ms-data-science | published |

**阶段 2 · SQL 分析与窗口函数**（`data-analysis-sql`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 窗口函数 (`data-window`) | `data-analysis/data-analysis-sql/data-window` | L4 | medium | 13 | 5 | ms-data-science | published |
| 2 | CTE 与查询拆解 (`data-cte`) | `data-analysis/data-analysis-sql/data-cte` | L4 | medium | 13 | 4 | ms-data-science | published |
| 3 | 漏斗、留存与同期群 (`data-funnel-retention`) | `data-analysis/data-analysis-sql/data-funnel-retention` | L4 | medium | 14 | 4 | ms-data-science | published |

**阶段 3 · 数据清洗与探索**（`data-cleaning`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 数据质量与缺失值 (`data-quality`) | `data-analysis/data-cleaning/data-quality` | L4 | medium | 7 | 4 | ms-data-science | published |
| 2 | 描述统计与异常发现 (`data-exploration`) | `data-analysis/data-cleaning/data-exploration` | L4 | medium | 7 | 3 | ms-data-science | published |
| 3 | 指标、实验与因果基础 (`data-experiment`) | `data-analysis/data-cleaning/data-experiment` | L4 | medium | 8 | 6 | ms-data-science | published |

**阶段 4 · 可视化与业务交付**（`data-visual-delivery`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 图表选择与表达 (`data-chart-choice`) | `data-analysis/data-visual-delivery/data-chart-choice` | L4 | medium | 6 | 4 | ms-data-science | published |
| 2 | 仪表板与信息架构 (`data-dashboard`) | `data-analysis/data-visual-delivery/data-dashboard` | L4 | medium | 5 | 4 | ms-data-science | published |
| 3 | 分析叙事与交付 (`data-story`) | `data-analysis/data-visual-delivery/data-story` | L4 | medium | 5 | 5 | ms-data-science | published |

### 数据库基础（`database`）

**阶段 1 · 关系模型与 SQL 基础**（`db-relational`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 表、键与约束 (`db-relational-model`) | `database/db-relational/db-relational-model` | L4 | easy | 13 | 2 | cmu-bustub | published |
| 2 | 查询与连接 (`db-select-join`) | `database/db-relational/db-select-join` | L4 | easy | 12 | 2 | cmu-bustub | published |
| 3 | 聚合与窗口函数 (`db-aggregate-window`) | `database/db-relational/db-aggregate-window` | L4 | easy | 6 | 2 | cmu-bustub | published |

**阶段 2 · 索引与查询性能**（`db-index`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 索引结构与选择性 (`db-index-basics`) | `database/db-index/db-index-basics` | L4 | easy | 8 | 2 | cmu-bustub | published |
| 2 | 执行计划与代价 (`db-explain`) | `database/db-index/db-explain` | L4 | easy | 7 | 2 | cmu-bustub | published |
| 3 | 查询改写与调优 (`db-query-tuning`) | `database/db-index/db-query-tuning` | L4 | easy | 8 | 2 | cmu-bustub | published |

**阶段 3 · 事务与并发**（`db-transaction`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 事务与 ACID (`db-acid`) | `database/db-transaction/db-acid` | L4 | easy | 8 | 2 | cmu-bustub | published |
| 2 | 隔离级别与异常 (`db-isolation`) | `database/db-transaction/db-isolation` | L4 | easy | 7 | 2 | cmu-bustub | published |
| 3 | 锁、死锁与重试 (`db-lock-deadlock`) | `database/db-transaction/db-lock-deadlock` | L4 | easy | 9 | 2 | cmu-bustub | published |

**阶段 4 · 建模、迁移与运维**（`db-modeling-ops`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 范式与建模取舍 (`db-normalization`) | `database/db-modeling-ops/db-normalization` | L4 | easy | 11 | 2 | cmu-bustub | published |
| 2 | 安全迁移与在线变更 (`db-migration-safe`) | `database/db-modeling-ops/db-migration-safe` | L4 | easy | 9 | 2 | cmu-bustub | published |
| 3 | 备份、恢复与容量 (`db-backup-recovery`) | `database/db-modeling-ops/db-backup-recovery` | L4 | easy | 6 | 2 | cmu-bustub | published |

### Java（`java`）

**阶段 1 · 语言基础与面向对象**（`java-foundation`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 类型与控制流 (`java-types-control`) | `java/java-foundation/java-types-control` | L4 | easy | 9 | 3 | algorithms-java | published |
| 2 | 类、接口与继承 (`java-oop`) | `java/java-foundation/java-oop` | L4 | easy | 10 | 5 | algorithms-java | published |
| 3 | 异常与资源管理 (`java-exceptions`) | `java/java-foundation/java-exceptions` | L4 | easy | 6 | 5 | algorithms-java | published |

**阶段 2 · 集合、泛型与函数式**（`java-collections`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 集合框架 (`java-collections`) | `java/java-collections/java-collections` | L4 | easy | 9 | 4 | algorithms-java | published |
| 2 | 泛型与类型边界 (`java-generics`) | `java/java-collections/java-generics` | L4 | easy | 8 | 4 | algorithms-java | published |
| 3 | Lambda、Stream 与 Optional (`java-stream`) | `java/java-collections/java-stream` | L4 | easy | 6 | 5 | algorithms-java | published |

**阶段 3 · 并发、JVM 与性能**（`java-concurrency`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 线程与并发工具 (`java-threads`) | `java/java-concurrency/java-threads` | L4 | easy | 10 | 5 | algorithms-java | published |
| 2 | JVM 内存与垃圾回收 (`java-jvm`) | `java/java-concurrency/java-jvm` | L4 | easy | 5 | 4 | algorithms-java | published |
| 3 | 性能与可观测性 (`java-performance`) | `java/java-concurrency/java-performance` | L4 | easy | 7 | 4 | algorithms-java | published |

**阶段 4 · 工程实践与设计模式**（`java-engineering`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 构建、依赖与测试 (`java-build`) | `java/java-engineering/java-build` | L4 | easy | 5 | 4 | algorithms-java | published |
| 2 | 常用设计模式 (`java-patterns`) | `java/java-engineering/java-patterns` | L4 | easy | 9 | 5 | algorithms-java | published |
| 3 | 服务分层与综合项目 (`java-service`) | `java/java-engineering/java-service` | L4 | easy | 6 | 4 | algorithms-java | published |

### JavaScript（`javascript`）

**阶段 1 · 语言核心与数据建模**（`js-language`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 值、类型与作用域 (`js-values-scope`) | `javascript/js-language/js-values-scope` | L4 | easy | 10 | 4 | freecodecamp-js | published |
| 2 | 函数、闭包与 this (`js-functions-closures`) | `javascript/js-language/js-functions-closures` | L4 | easy | 10 | 3 | freecodecamp-js | published |
| 3 | 数组、对象与现代集合 (`js-collections`) | `javascript/js-language/js-collections` | L4 | easy | 9 | 3 | freecodecamp-js | published |

**阶段 2 · 异步、浏览器与网络**（`js-async-browser`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 事件循环与任务队列 (`js-event-loop`) | `javascript/js-async-browser/js-event-loop` | L4 | easy | 7 | 3 | freecodecamp-js | published |
| 2 | Promise 与 async/await (`js-promises`) | `javascript/js-async-browser/js-promises` | L4 | easy | 10 | 4 | freecodecamp-js | published |
| 3 | DOM、事件与网络 (`js-dom-network`) | `javascript/js-async-browser/js-dom-network` | L4 | easy | 8 | 4 | freecodecamp-js | published |

**阶段 3 · 模块、测试与工程化**（`js-engineering`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 模块与依赖边界 (`js-modules`) | `javascript/js-engineering/js-modules` | L4 | easy | 6 | 3 | freecodecamp-js | published |
| 2 | 测试与调试 (`js-testing`) | `javascript/js-engineering/js-testing` | L4 | easy | 7 | 3 | freecodecamp-js | published |
| 3 | 存储、性能与可访问性 (`js-browser-data`) | `javascript/js-engineering/js-browser-data` | L4 | easy | 8 | 3 | freecodecamp-js | published |

**阶段 4 · 现代前端与综合项目**（`js-modern-frontend`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 组件与组合 (`js-components`) | `javascript/js-modern-frontend/js-components` | L4 | easy | 11 | 2 | freecodecamp-js | published |
| 2 | 状态、渲染与副作用 (`js-state-render`) | `javascript/js-modern-frontend/js-state-render` | L4 | easy | 5 | 5 | freecodecamp-js | published |
| 3 | 性能与交付质量 (`js-performance`) | `javascript/js-modern-frontend/js-performance` | L4 | easy | 5 | 3 | freecodecamp-js | published |

### Linux 运维（`linux`）

**阶段 1 · 命令行、文件与文本处理**（`linux-shell-files`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 文件系统与路径 (`linux-filesystem`) | `linux/linux-shell-files/linux-filesystem` | L4 | easy | 4 | 3 | algorithms-shell | published |
| 2 | 用户、组与权限 (`linux-permissions`) | `linux/linux-shell-files/linux-permissions` | L4 | easy | 5 | 3 | algorithms-shell | published |
| 3 | 文本与管道 (`linux-text-pipeline`) | `linux/linux-shell-files/linux-text-pipeline` | L4 | easy | 3 | 4 | algorithms-shell | published |

**阶段 2 · 进程、服务与日志**（`linux-process-system`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 进程与资源 (`linux-processes`) | `linux/linux-process-system/linux-processes` | L4 | easy | 5 | 4 | algorithms-shell | published |
| 2 | systemd 与服务管理 (`linux-systemd`) | `linux/linux-process-system/linux-systemd` | L4 | easy | 10 | 3 | algorithms-shell | published |
| 3 | 日志与故障证据 (`linux-logs`) | `linux/linux-process-system/linux-logs` | L4 | easy | 3 | 3 | algorithms-shell | published |

**阶段 3 · 网络、SSH 与存储**（`linux-network-storage`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 网络诊断 (`linux-network`) | `linux/linux-network-storage/linux-network` | L4 | easy | 6 | 3 | algorithms-shell | published |
| 2 | SSH 与访问安全 (`linux-ssh`) | `linux/linux-network-storage/linux-ssh` | L4 | easy | 4 | 3 | algorithms-shell | published |
| 3 | 磁盘与文件系统 (`linux-storage`) | `linux/linux-network-storage/linux-storage` | L4 | easy | 5 | 4 | algorithms-shell | published |

**阶段 4 · Shell 自动化与生产运维**（`linux-automation-ops`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 可靠 Shell 脚本 (`linux-bash`) | `linux/linux-automation-ops/linux-bash` | L4 | easy | 8 | 3 | algorithms-shell | published |
| 2 | 定时任务与编排 (`linux-scheduling`) | `linux/linux-automation-ops/linux-scheduling` | L4 | easy | 4 | 3 | algorithms-shell | published |
| 3 | 故障排查与备份恢复 (`linux-troubleshooting`) | `linux/linux-automation-ops/linux-troubleshooting` | L4 | easy | 6 | 4 | algorithms-shell | published |

### 网络工程（`network-engineering`）

**阶段 1 · 网络基础与模型**（`net-foundation`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 分层模型与封装 (`net-osi-tcpip`) | `network-engineering/net-foundation/net-osi-tcpip` | L4 | easy | 6 | 2 | tailscale | published |
| 2 | IP 编址与子网 (`net-ip-addressing`) | `network-engineering/net-foundation/net-ip-addressing` | L4 | easy | 6 | 2 | tailscale | published |
| 3 | TCP/UDP 与端口 (`net-tcp-udp`) | `network-engineering/net-foundation/net-tcp-udp` | L4 | easy | 8 | 2 | tailscale | published |

**阶段 2 · 交换与园区网**（`net-lan`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 以太网与 VLAN (`net-ethernet-vlan`) | `network-engineering/net-lan/net-ethernet-vlan` | L4 | easy | 7 | 2 | tailscale | published |
| 2 | 路由与网关 (`net-routing`) | `network-engineering/net-lan/net-routing` | L4 | easy | 7 | 2 | tailscale | published |
| 3 | NAT、DHCP 与地址服务 (`net-nat-dhcp`) | `network-engineering/net-lan/net-nat-dhcp` | L4 | easy | 8 | 2 | tailscale | published |

**阶段 3 · 安全与互联**（`net-security`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 防火墙与 ACL (`net-firewall-acl`) | `network-engineering/net-security/net-firewall-acl` | L4 | easy | 9 | 2 | tailscale | published |
| 2 | 站点互联与 VPN (`net-vpn-site`) | `network-engineering/net-security/net-vpn-site` | L4 | easy | 9 | 2 | tailscale | published |
| 3 | 无线与接入控制 (`net-wireless`) | `network-engineering/net-security/net-wireless` | L4 | easy | 7 | 2 | tailscale | published |

**阶段 4 · 自动化与排障**（`net-automation`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 抓包与流量分析 (`net-monitor-capture`) | `network-engineering/net-automation/net-monitor-capture` | L4 | easy | 9 | 2 | tailscale | published |
| 2 | 配置自动化与备份 (`net-config-automation`) | `network-engineering/net-automation/net-config-automation` | L4 | easy | 8 | 2 | tailscale | published |
| 3 | 分层排障方法 (`net-troubleshoot`) | `network-engineering/net-automation/net-troubleshoot` | L4 | easy | 8 | 2 | tailscale | published |

### Power BI（`power-bi`）

**阶段 1 · 数据获取与 Power Query**（`powerbi-ingest`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 数据源与连接模式 (`powerbi-connect`) | `power-bi/powerbi-ingest/powerbi-connect` | L4 | medium | 5 | 4 | pl300 | published |
| 2 | Power Query 转换 (`powerbi-power-query`) | `power-bi/powerbi-ingest/powerbi-power-query` | L4 | medium | 5 | 6 | pl300 | published |
| 3 | 参数与可复用查询 (`powerbi-parameters`) | `power-bi/powerbi-ingest/powerbi-parameters` | L4 | medium | 5 | 3 | pl300 | published |

**阶段 2 · 语义模型与关系**（`powerbi-model`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 星型模型与粒度 (`powerbi-star-schema`) | `power-bi/powerbi-model/powerbi-star-schema` | L4 | medium | 10 | 5 | pl300 | published |
| 2 | 关系与筛选传播 (`powerbi-relationships`) | `power-bi/powerbi-model/powerbi-relationships` | L4 | medium | 5 | 4 | pl300 | published |
| 3 | 日期表与模型可用性 (`powerbi-date-table`) | `power-bi/powerbi-model/powerbi-date-table` | L4 | medium | 7 | 4 | pl300 | published |

**阶段 3 · DAX、筛选上下文与时间智能**（`powerbi-dax`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | DAX 基础与上下文 (`powerbi-dax-basics`) | `power-bi/powerbi-dax/powerbi-dax-basics` | L4 | medium | 5 | 4 | pl300 | published |
| 2 | CALCULATE 与上下文转换 (`powerbi-calculate`) | `power-bi/powerbi-dax/powerbi-calculate` | L4 | medium | 6 | 5 | pl300 | published |
| 3 | 时间智能与时间对比 (`powerbi-time-intelligence`) | `power-bi/powerbi-dax/powerbi-time-intelligence` | L4 | medium | 6 | 4 | pl300 | published |

**阶段 4 · 报表、分析、安全与发布**（`powerbi-report`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 报表设计与交互 (`powerbi-report-design`) | `power-bi/powerbi-report/powerbi-report-design` | L4 | medium | 5 | 5 | pl300 | published |
| 2 | 分析功能与高级计算 (`powerbi-analytics`) | `power-bi/powerbi-report/powerbi-analytics` | L4 | medium | 7 | 3 | pl300 | published |
| 3 | RLS、发布与刷新 (`powerbi-security-service`) | `power-bi/powerbi-report/powerbi-security-service` | L4 | medium | 6 | 5 | pl300 | published |

### Python（`python`）

**阶段 1 · 语言基础与程序思维**（`python-foundation`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 值与控制流 (`python-values-control`) | `python/python-foundation/python-values-control` | L4 | easy | 8 | 4 | exercism-python | published |
| 2 | 函数与模块 (`python-functions`) | `python/python-foundation/python-functions` | L4 | easy | 8 | 4 | exercism-python | published |
| 3 | 错误与调试 (`python-debug`) | `python/python-foundation/python-debug` | L4 | easy | 10 | 5 | exercism-python | published |

**阶段 2 · 数据结构与工程基础**（`python-data-structures`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 列表、字典与集合 (`python-collections`) | `python/python-data-structures/python-collections` | L4 | easy | 6 | 5 | exercism-python | published |
| 2 | 文件、JSON 与环境 (`python-files`) | `python/python-data-structures/python-files` | L4 | easy | 7 | 5 | exercism-python | published |
| 3 | 测试与代码质量 (`python-testing`) | `python/python-data-structures/python-testing` | L4 | easy | 10 | 3 | exercism-python | published |

**阶段 3 · 面向对象与类型系统**（`python-oop-typing`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | 类与对象模型 (`python-classes`) | `python/python-oop-typing/python-classes` | L4 | easy | 10 | 4 | exercism-python | published |
| 2 | 类型标注与协议 (`python-typing`) | `python/python-oop-typing/python-typing` | L4 | easy | 9 | 4 | exercism-python | published |
| 3 | 迭代、生成器与上下文 (`python-context`) | `python/python-oop-typing/python-context` | L4 | easy | 11 | 5 | exercism-python | published |

**阶段 4 · 数据分析与综合项目**（`python-data-project`）

| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |
|---|---|---|---|---|---|---|---|---|
| 1 | Pandas 数据处理 (`python-pandas`) | `python/python-data-project/python-pandas` | L4 | easy | 7 | 5 | exercism-python | published |
| 2 | 探索与可视化 (`python-visualization`) | `python/python-data-project/python-visualization` | L4 | easy | 7 | 4 | exercism-python | published |
| 3 | 综合项目与交付 (`python-capstone`) | `python/python-data-project/python-capstone` | L4 | easy | 6 | 4 | exercism-python | published |

## 4. 待分类题

内容包里未绑定 `topicKey`、且所在阶段有多个知识点的题，会进"待分类"（同步接口的 `unlinkedQuestions` 计数），
由阶段 12（Phase D）的题库统一页面处理：要么人工绑定知识点（`link_source='curated'`），要么标记待分类。
