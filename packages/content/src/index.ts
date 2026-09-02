import type { Phase } from "@learn-workbench/shared";

/**
 * ICT 学习工作台 · 内置路线图内容
 * 与数据库 Learn-Workbench 中 db/seed_content.sql 保持一致（移动端/离线使用本地副本）。
 * 内容来源：《新疆ICT学习规划优化方案》
 */
export const roadmapPhases: Phase[] = [
  {
    id: 1, phaseKey: "phase-1", title: "学习机制 + Agent 启蒙", weeks: "第 0-2 周", track: "main",
    summary: "搭建 Anki/笔记/复盘/费曼模板，学习 LLM 基础，完成最小 Agent。", sortOrder: 0,
    topics: [
      { id: 101, topicKey: "p0-mechanism", title: "学习方法机制搭建", summary: "Anki 卡片库、笔记模板、每周复盘模板、费曼讲稿模板。", agentTask: null, sortOrder: 0, resources: [], practices: [{ id: 1, text: "搭建 Anki 卡片库、笔记模板、每周复盘模板、费曼讲稿模板", sortOrder: 0 }], projects: [], checkpoints: [{ id: 1, text: "1 页学习机制说明（能讲清自己的学习方法）", sortOrder: 0 }] },
      { id: 102, topicKey: "p0-llm-basics", title: "LLM 基础概念", summary: "token、上下文窗口、temperature、结构化 JSON 输出。", agentTask: null, sortOrder: 1, resources: [], practices: [], projects: [], checkpoints: [] },
      { id: 103, topicKey: "p0-minimal-agent", title: "最小 Agent 实现", summary: "50-150 行最小 Agent：LLM API + 工具函数 + 循环 + 超时/错误处理。", agentTask: "完成一个最小可运行 Agent（LLM API + 工具函数 + 循环 + 超时/错误处理）", sortOrder: 2, resources: [], practices: [{ id: 2, text: "动手写一个 50-150 行最小 Agent（LLM API + 工具函数 + 循环 + 超时/错误处理）", sortOrder: 0 }], projects: [{ id: 1, name: "最小 Agent Demo", description: "LLM API + 工具函数 + 循环的 50-150 行最小 Agent", repoUrl: null, deliverable: "1 个最小可运行 Agent", sortOrder: 0 }], checkpoints: [{ id: 2, text: "1 个最小可运行 Agent（能演示）", sortOrder: 0 }] },
    ],
  },
  {
    id: 2, phaseKey: "phase-2", title: "通信网络进阶", weeks: "第 3-8 周", track: "main",
    summary: "HCIP 理论 + 园区 5G/等保 + eNSP/Wireshark + 网络自动化巡检。", sortOrder: 1,
    topics: [
      { id: 201, topicKey: "p1-hcip", title: "HCIP-Datacom 理论", summary: "数据通信方向核心理论。", agentTask: null, sortOrder: 0, resources: [{ id: 1, name: "HCIP-Datacom 官方认证", url: "https://support.huawei.com/enterprise/zh/certification", kind: "course", sortOrder: 0 }], practices: [], projects: [], checkpoints: [] },
      { id: 202, topicKey: "p1-5g-grading", title: "园区 5G 与等保 2.0", summary: "园区网络场景 + 等级保护 2.0 合规。", agentTask: null, sortOrder: 1, resources: [], practices: [], projects: [], checkpoints: [] },
      { id: 203, topicKey: "p1-ensp-wireshark", title: "eNSP 网络仿真与 Wireshark", summary: "eNSP 组网仿真 + Wireshark 抓包分析。", agentTask: null, sortOrder: 2, resources: [], practices: [{ id: 3, text: "eNSP 搭建三层园区网拓扑并用 Wireshark 抓包", sortOrder: 0 }], projects: [], checkpoints: [] },
      { id: 204, topicKey: "p1-netauto", title: "网络自动化巡检", summary: "ensp-cli 批量配置、netmiko 设备巡检与配置备份。", agentTask: "网络巡检助手：读取配置/日志 → 判断故障 → 生成处置建议", sortOrder: 3, resources: [{ id: 2, name: "ensp-cli", url: "https://github.com/", kind: "tool", sortOrder: 0 }, { id: 3, name: "netmiko", url: "https://github.com/ktbyers/netmiko", kind: "tool", sortOrder: 1 }], practices: [{ id: 4, text: "用 ensp-cli 批量配置、netmiko 巡检并备份设备配置", sortOrder: 0 }], projects: [{ id: 2, name: "网络巡检助手 MVP", description: "读取设备配置/日志 → 判断故障 → 生成处置建议", repoUrl: null, deliverable: "三层园区网拓扑 + 自动化脚本 + 巡检助手 MVP + 1 篇复盘", sortOrder: 0 }], checkpoints: [{ id: 3, text: "三层园区网拓扑 + 自动化脚本 + 网络巡检助手 MVP + 1 篇复盘", sortOrder: 0 }] },
    ],
  },
  {
    id: 3, phaseKey: "phase-3", title: "ETL 数据仓库开发", weeks: "第 9-14 周", track: "main",
    summary: "数仓分层 + SQL 高阶 + Shell/Kettle 调度 + Pandas/DataEase 可视化。", sortOrder: 2,
    topics: [
      { id: 301, topicKey: "p2-dw-layers", title: "数仓分层与数据质量", summary: "ODS/DWD/DWS 分层、数据质量治理。", agentTask: null, sortOrder: 0, resources: [], practices: [{ id: 5, text: "按 ODS/DWD/DWS 设计一个分层数仓模型", sortOrder: 0 }], projects: [], checkpoints: [] },
      { id: 302, topicKey: "p2-sql-advanced", title: "SQL 高阶", summary: "复杂查询、窗口函数、性能优化。", agentTask: null, sortOrder: 1, resources: [], practices: [{ id: 6, text: "练习窗口函数与复杂 SQL 查询", sortOrder: 0 }], projects: [], checkpoints: [] },
      { id: 303, topicKey: "p2-etl-schedule", title: "Shell 调度与 Kettle", summary: "Shell 调度、pentaho-kettle / easy_kettle。", agentTask: null, sortOrder: 2, resources: [{ id: 4, name: "pentaho-kettle", url: "https://github.com/pentaho/pentaho-kettle", kind: "tool", sortOrder: 0 }, { id: 5, name: "easy_kettle", url: "https://github.com/", kind: "tool", sortOrder: 1 }], practices: [{ id: 7, text: "用 Kettle/easy_kettle + Shell 完成定时 ETL 任务", sortOrder: 0 }], projects: [], checkpoints: [] },
      { id: 304, topicKey: "p2-viz", title: "数据分析与可视化", summary: "Pandas/Matplotlib + DataEase 可视化大屏。", agentTask: "数据问答/报表生成助手：输入问题 → 检索数据 → 生成图表（RAG 接入政务/教学数据）", sortOrder: 3, resources: [{ id: 6, name: "DataEase", url: "https://github.com/dataease/dataease", kind: "tool", sortOrder: 0 }], practices: [{ id: 8, text: "用 Pandas/Matplotlib/DataEase 制作可视化大屏", sortOrder: 0 }], projects: [{ id: 3, name: "数据问答/报表助手", description: "RAG 接入政务或教学数据：输入问题 → 检索数据 → 生成图表", repoUrl: null, deliverable: "分层数仓 + 自动化 ETL + 可视化大屏 + 数据 Agent + 评测表格", sortOrder: 0 }], checkpoints: [{ id: 4, text: "分层数仓 + 自动化 ETL + 可视化大屏 + 数据 Agent + 评测表格", sortOrder: 0 }] },
    ],
  },
  {
    id: 4, phaseKey: "phase-4", title: "云 & 虚拟化自动化运维", weeks: "第 15-20 周", track: "main",
    summary: "VDI/KVM/VPC + 天翼云政企 + Shell + Spug/proxmox-utils 批量运维。", sortOrder: 3,
    topics: [
      { id: 401, topicKey: "p3-cloud-products", title: "云与虚拟化基础", summary: "VDI、KVM、VPC、天翼云政企产品。", agentTask: null, sortOrder: 0, resources: [], practices: [], projects: [], checkpoints: [] },
      { id: 402, topicKey: "p3-linux-ops", title: "Linux 运维基础", summary: "CentOS、Xshell、Shell 脚本。", agentTask: null, sortOrder: 1, resources: [], practices: [], projects: [], checkpoints: [] },
      { id: 403, topicKey: "p3-batch-ops", title: "批量运维工具", summary: "Spug 批量主机管理、proxmox-utils 云桌面批量创建。", agentTask: "运维值班助手：日志分析、备份巡检、告警分级（LangGraph 状态流）", sortOrder: 2, resources: [{ id: 7, name: "Spug", url: "https://github.com/openspug/spug", kind: "tool", sortOrder: 0 }, { id: 8, name: "proxmox-utils", url: "https://github.com/", kind: "tool", sortOrder: 1 }], practices: [{ id: 9, text: "用 Spug 管理批量主机、proxmox-utils 批量创建云桌面", sortOrder: 0 }], projects: [{ id: 4, name: "运维值班助手", description: "日志分析、备份巡检、告警分级（LangGraph 状态流）", repoUrl: null, deliverable: "云桌面自动化脚本集 + 运维助手 + 监控大屏", sortOrder: 0 }], checkpoints: [{ id: 5, text: "云桌面自动化脚本集 + 运维助手 + 监控大屏", sortOrder: 0 }] },
    ],
  },
  {
    id: 5, phaseKey: "phase-5", title: "售前解决方案撰写", weeks: "第 21-24 周", track: "main",
    summary: "新疆政企投标方案框架 + 需求调研 + 验收流程 + Visio/PPT/Word。", sortOrder: 4,
    topics: [
      { id: 501, topicKey: "p4-bid-framework", title: "投标方案框架", summary: "新疆政企投标方案框架与要点。", agentTask: null, sortOrder: 0, resources: [], practices: [], projects: [], checkpoints: [] },
      { id: 502, topicKey: "p4-survey", title: "需求调研与设备清单", summary: "需求调研方法、设备清单编制。", agentTask: null, sortOrder: 1, resources: [], practices: [{ id: 10, text: "编写一份需求调研问卷与设备清单", sortOrder: 0 }], projects: [], checkpoints: [] },
      { id: 503, topicKey: "p4-acceptance", title: "验收与方案输出", summary: "验收流程 + Visio/PPT/Word 方案输出。", agentTask: "售前方案助手：planner → writer → reviewer 多 Agent 协作，接入 MCP 数据源", sortOrder: 2, resources: [], practices: [{ id: 11, text: "输出 Visio 拓扑 + PPT 方案 + Word 投标文档", sortOrder: 0 }], projects: [{ id: 5, name: "售前方案助手", description: "planner → writer → reviewer 多 Agent + MCP 数据源", repoUrl: null, deliverable: "2 套投标方案 + 方案撰写 Agent + 标准化需求问卷", sortOrder: 0 }], checkpoints: [{ id: 6, text: "2 套投标方案 + 方案撰写 Agent + 标准化需求问卷", sortOrder: 0 }] },
    ],
  },
  {
    id: 6, phaseKey: "phase-6", title: "综合实战 + 证书冲刺", weeks: "第 25-30 周", track: "main",
    summary: "HCIP/ACP 取证 + smart-campus 平台 + ICT 交付助手整合 + 工程化评测。", sortOrder: 5,
    topics: [
      { id: 601, topicKey: "p5-hcip-exam", title: "HCIP-Datacom 取证冲刺", summary: "考试报名、题库刷题、模拟。", agentTask: null, sortOrder: 0, resources: [], practices: [], projects: [], checkpoints: [] },
      { id: 602, topicKey: "p5-acp-exam", title: "天翼云 ACP 取证冲刺", summary: "ACP 认证学习与考试。", agentTask: null, sortOrder: 1, resources: [], practices: [], projects: [], checkpoints: [] },
      { id: 603, topicKey: "p5-smart-campus", title: "smart-campus 三合一平台", summary: "通信+数据+运维三合一综合项目。", agentTask: null, sortOrder: 2, resources: [], practices: [{ id: 12, text: "开发 smart-campus 三合一平台", sortOrder: 0 }], projects: [{ id: 6, name: "smart-campus 三合一平台", description: "通信 + 数据 + 运维三合一综合项目", repoUrl: null, deliverable: "可演示综合项目", sortOrder: 0 }], checkpoints: [{ id: 7, text: "smart-campus 平台可演示", sortOrder: 0 }] },
      { id: 604, topicKey: "p5-integration", title: "ICT 交付助手整合", summary: "整合网络巡检、数据问答、运维助手、售前方案助手。", agentTask: null, sortOrder: 3, resources: [], practices: [{ id: 13, text: "把 4 个助手整合为一个 ICT 交付助手并做工程化", sortOrder: 0 }], projects: [{ id: 7, name: "ICT 交付助手", description: "整合网络巡检、数据问答、运维、售前方案 4 个助手", repoUrl: null, deliverable: "可 clone 项目 + 演示视频 + 技术博客 + 简历项目描述", sortOrder: 0 }], checkpoints: [{ id: 8, text: "可 clone 项目 + 演示视频 + 技术博客 + 简历项目描述", sortOrder: 0 }] },
      { id: 605, topicKey: "p5-engineering", title: "工程化与评测", summary: "权限边界、人工确认、日志/trace、至少 20 条评测用例。", agentTask: null, sortOrder: 4, resources: [], practices: [{ id: 14, text: "编写至少 20 条评测用例，记录成功率和失败归因", sortOrder: 0 }], projects: [], checkpoints: [{ id: 9, text: "至少 20 条评测用例 + 成功率与失败归因记录", sortOrder: 0 }] },
    ],
  },
  {
    id: 7, phaseKey: "phase-7", title: "面试冲刺 + 新疆求职落地", weeks: "第 31-36 周", track: "main",
    summary: "三模块题库 + Agent 专项面试 + 行业知识 + 批量投递。", sortOrder: 6,
    topics: [
      { id: 701, topicKey: "p6-question-bank", title: "三模块题库", summary: "通信、ETL、Linux 云运维三模块面试题库。", agentTask: null, sortOrder: 0, resources: [], practices: [], projects: [], checkpoints: [{ id: 10, text: "通信/ETL/Linux 云运维三模块题库刷完并自测通过", sortOrder: 0 }] },
      { id: 702, topicKey: "p6-agent-interview", title: "Agent 专项面试", summary: "Agent Loop、工具调用、RAG、MCP、多 Agent、评测、安全。", agentTask: null, sortOrder: 1, resources: [], practices: [], projects: [], checkpoints: [{ id: 11, text: "Agent 专项面试题能口头作答", sortOrder: 0 }] },
      { id: 703, topicKey: "p6-industry", title: "行业知识", summary: "数字新疆、教育数字化、石油信息化。", agentTask: null, sortOrder: 2, resources: [], practices: [], projects: [], checkpoints: [{ id: 12, text: "能讲清数字新疆/教育数字化/石油信息化", sortOrder: 0 }] },
      { id: 704, topicKey: "p6-interview-method", title: "面试方式演练", summary: "技术问答 + 售前客户沟通 + 综合项目 5 分钟费曼讲解。", agentTask: null, sortOrder: 3, resources: [], practices: [], projects: [], checkpoints: [{ id: 13, text: "5 分钟费曼讲解综合项目", sortOrder: 0 }] },
      { id: 705, topicKey: "p6-job-apply", title: "求职落地", summary: "乌鲁木齐/克拉玛依企业批量投递，兼顾 ICT 交付 + AI 应用复合岗位。", agentTask: null, sortOrder: 4, resources: [], practices: [{ id: 15, text: "制作简历项目描述并批量投递乌鲁木齐/克拉玛依岗位", sortOrder: 0 }], projects: [], checkpoints: [{ id: 14, text: "完成批量投递并跟踪反馈", sortOrder: 0 }] },
    ],
  },
  {
    id: 8, phaseKey: "agent-track", title: "Agent 应用专项（副线）", weeks: "全程", track: "agent",
    summary: "从认知到工程化的 Agent 专项能力：Prompt → 工具 → RAG → 编排 → MCP → 多 Agent → 工程化。", sortOrder: 0,
    topics: [
      { id: 801, topicKey: "ag-cognition", title: "认知层", summary: "区分 chatbot / workflow / agent / multi-agent；observe → think → act 循环。", agentTask: null, sortOrder: 0, resources: [], practices: [], projects: [], checkpoints: [] },
      { id: 802, topicKey: "ag-minimal", title: "最小实现", summary: "LLM API、结构化输出、function calling、工具注册、最大步数与错误恢复。", agentTask: null, sortOrder: 1, resources: [], practices: [], projects: [], checkpoints: [] },
      { id: 803, topicKey: "ag-tools-rag", title: "工具与 RAG", summary: "工具 dispatch 表、chunk → embed → retrieve → answer、短期/会话/长期记忆。", agentTask: null, sortOrder: 2, resources: [], practices: [], projects: [], checkpoints: [] },
      { id: 804, topicKey: "ag-orchestration", title: "编排层", summary: "LangGraph（有状态单 Agent）、CrewAI/AutoGen（多角色多 Agent）。", agentTask: null, sortOrder: 3, resources: [{ id: 9, name: "LangGraph", url: "https://github.com/langchain-ai/langgraph", kind: "tool", sortOrder: 0 }, { id: 10, name: "CrewAI", url: "https://github.com/crewAIInc/crewAI", kind: "tool", sortOrder: 1 }, { id: 11, name: "AutoGen", url: "https://github.com/microsoft/autogen", kind: "tool", sortOrder: 2 }], practices: [], projects: [], checkpoints: [] },
      { id: 805, topicKey: "ag-protocol", title: "协议与工程化", summary: "MCP、A2A、ACP、Skills；上下文压缩、权限边界、eval、trace、日志。", agentTask: null, sortOrder: 4, resources: [{ id: 12, name: "MCP SDK", url: "https://github.com/modelcontextprotocol", kind: "tool", sortOrder: 0 }], practices: [], projects: [], checkpoints: [] },
      { id: 806, topicKey: "ag-project", title: "场景化项目", summary: "结合通信/数据/运维/售前，最终交付 ICT 交付助手。", agentTask: null, sortOrder: 5, resources: [], practices: [], projects: [], checkpoints: [] },
    ],
  },
];

export const mainPhases = roadmapPhases.filter((p) => p.track === "main");
export const agentPhase = roadmapPhases.find((p) => p.track === "agent") ?? null;
export * from "./domain-templates";
