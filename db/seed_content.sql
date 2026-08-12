-- ============================================================================
-- ICT 学习工作台 · 初始内容种子
-- 内容来源：《新疆ICT学习规划优化方案》（阶段 0-6 主轨 + Agent 副线）
-- 说明：显式 ID 便于外键引用；重复执行安全（ON CONFLICT DO NOTHING）
-- ============================================================================

-- ---------- 阶段 ----------
INSERT INTO content_phases (id, phase_key, title, weeks, track, summary, sort_order) VALUES
  (1, 'phase-0', '学习机制 + Agent 启蒙', '第 0-2 周', 'main', '搭建 Anki/笔记/复盘/费曼模板，学习 LLM 基础，完成最小 Agent。', 0),
  (2, 'phase-1', '通信网络进阶', '第 3-8 周', 'main', 'HCIP 理论 + 园区 5G/等保 + eNSP/Wireshark + 网络自动化巡检。', 1),
  (3, 'phase-2', 'ETL 数据仓库开发', '第 9-14 周', 'main', '数仓分层 + SQL 高阶 + Shell/Kettle 调度 + Pandas/DataEase 可视化。', 2),
  (4, 'phase-3', '云 & 虚拟化自动化运维', '第 15-20 周', 'main', 'VDI/KVM/VPC + 天翼云政企 + Shell + Spug/proxmox-utils 批量运维。', 3),
  (5, 'phase-4', '售前解决方案撰写', '第 21-24 周', 'main', '新疆政企投标方案框架 + 需求调研 + 验收流程 + Visio/PPT/Word。', 4),
  (6, 'phase-5', '综合实战 + 证书冲刺', '第 25-30 周', 'main', 'HCIP/ACP 取证 + smart-campus 平台 + ICT 交付助手整合 + 工程化评测。', 5),
  (7, 'phase-6', '面试冲刺 + 新疆求职落地', '第 31-36 周', 'main', '三模块题库 + Agent 专项面试 + 行业知识 + 批量投递。', 6),
  (8, 'agent-track', 'Agent 应用专项（副线）', '全程', 'agent', '从认知到工程化的 Agent 专项能力：Prompt → 工具 → RAG → 编排 → MCP → 多 Agent → 工程化。', 0)
ON CONFLICT (phase_key) DO NOTHING;

-- ---------- 主题 ----------
INSERT INTO content_topics (id, phase_id, topic_key, title, summary, agent_task, sort_order) VALUES
  -- 阶段 0
  (101, 1, 'p0-mechanism', '学习方法机制搭建', 'Anki 卡片库、笔记模板、每周复盘模板、费曼讲稿模板。', NULL, 0),
  (102, 1, 'p0-llm-basics', 'LLM 基础概念', 'token、上下文窗口、temperature、结构化 JSON 输出。', NULL, 1),
  (103, 1, 'p0-minimal-agent', '最小 Agent 实现', '50-150 行最小 Agent：LLM API + 工具函数 + 循环 + 超时/错误处理。', '完成一个最小可运行 Agent（LLM API + 工具函数 + 循环 + 超时/错误处理）', 2),
  -- 阶段 1
  (201, 2, 'p1-hcip', 'HCIP-Datacom 理论', '数据通信方向核心理论。', NULL, 0),
  (202, 2, 'p1-5g-grading', '园区 5G 与等保 2.0', '园区网络场景 + 等级保护 2.0 合规。', NULL, 1),
  (203, 2, 'p1-ensp-wireshark', 'eNSP 网络仿真与 Wireshark', 'eNSP 组网仿真 + Wireshark 抓包分析。', NULL, 2),
  (204, 2, 'p1-netauto', '网络自动化巡检', 'ensp-cli 批量配置、netmiko 设备巡检与配置备份。', '网络巡检助手：读取配置/日志 → 判断故障 → 生成处置建议', 3),
  -- 阶段 2
  (301, 3, 'p2-dw-layers', '数仓分层与数据质量', 'ODS/DWD/DWS 分层、数据质量治理。', NULL, 0),
  (302, 3, 'p2-sql-advanced', 'SQL 高阶', '复杂查询、窗口函数、性能优化。', NULL, 1),
  (303, 3, 'p2-etl-schedule', 'Shell 调度与 Kettle', 'Shell 调度、pentaho-kettle / easy_kettle。', NULL, 2),
  (304, 3, 'p2-viz', '数据分析与可视化', 'Pandas/Matplotlib + DataEase 可视化大屏。', '数据问答/报表生成助手：输入问题 → 检索数据 → 生成图表（RAG 接入政务/教学数据）', 3),
  -- 阶段 3
  (401, 4, 'p3-cloud-products', '云与虚拟化基础', 'VDI、KVM、VPC、天翼云政企产品。', NULL, 0),
  (402, 4, 'p3-linux-ops', 'Linux 运维基础', 'CentOS、Xshell、Shell 脚本。', NULL, 1),
  (403, 4, 'p3-batch-ops', '批量运维工具', 'Spug 批量主机管理、proxmox-utils 云桌面批量创建。', '运维值班助手：日志分析、备份巡检、告警分级（LangGraph 状态流）', 2),
  -- 阶段 4
  (501, 5, 'p4-bid-framework', '投标方案框架', '新疆政企投标方案框架与要点。', NULL, 0),
  (502, 5, 'p4-survey', '需求调研与设备清单', '需求调研方法、设备清单编制。', NULL, 1),
  (503, 5, 'p4-acceptance', '验收与方案输出', '验收流程 + Visio/PPT/Word 方案输出。', '售前方案助手：planner → writer → reviewer 多 Agent 协作，接入 MCP 数据源', 2),
  -- 阶段 5
  (601, 6, 'p5-hcip-exam', 'HCIP-Datacom 取证冲刺', '考试报名、题库刷题、模拟。', NULL, 0),
  (602, 6, 'p5-acp-exam', '天翼云 ACP 取证冲刺', 'ACP 认证学习与考试。', NULL, 1),
  (603, 6, 'p5-smart-campus', 'smart-campus 三合一平台', '通信+数据+运维三合一综合项目。', NULL, 2),
  (604, 6, 'p5-integration', 'ICT 交付助手整合', '整合网络巡检、数据问答、运维助手、售前方案助手。', NULL, 3),
  (605, 6, 'p5-engineering', '工程化与评测', '权限边界、人工确认、日志/trace、至少 20 条评测用例、成功率与失败归因。', NULL, 4),
  -- 阶段 6
  (701, 7, 'p6-question-bank', '三模块题库', '通信、ETL、Linux 云运维三模块面试题库。', NULL, 0),
  (702, 7, 'p6-agent-interview', 'Agent 专项面试', 'Agent Loop、工具调用、RAG、MCP、多 Agent、评测、安全。', NULL, 1),
  (703, 7, 'p6-industry', '行业知识', '数字新疆、教育数字化、石油信息化。', NULL, 2),
  (704, 7, 'p6-interview-method', '面试方式演练', '技术问答 + 售前客户沟通 + 综合项目 5 分钟费曼讲解。', NULL, 3),
  (705, 7, 'p6-job-apply', '求职落地', '乌鲁木齐/克拉玛依企业批量投递，兼顾 ICT 交付 + AI 应用复合岗位。', NULL, 4),
  -- Agent 副线
  (801, 8, 'ag-cognition', '认知层', '区分 chatbot / workflow / agent / multi-agent；observe → think → act 循环。', NULL, 0),
  (802, 8, 'ag-minimal', '最小实现', 'LLM API、结构化输出、function calling、工具注册、最大步数与错误恢复。', NULL, 1),
  (803, 8, 'ag-tools-rag', '工具与 RAG', '工具 dispatch 表、chunk → embed → retrieve → answer、短期/会话/长期记忆。', NULL, 2),
  (804, 8, 'ag-orchestration', '编排层', 'LangGraph（有状态单 Agent）、CrewAI/AutoGen（多角色多 Agent）；何时单 Agent 更优。', NULL, 3),
  (805, 8, 'ag-protocol', '协议与工程化', 'MCP、A2A、ACP、Skills；上下文压缩、权限边界、eval、trace、日志。', NULL, 4),
  (806, 8, 'ag-project', '场景化项目', '结合通信/数据/运维/售前，最终交付 ICT 交付助手。', NULL, 5)
ON CONFLICT (topic_key) DO NOTHING;

-- ---------- 资源 ----------
INSERT INTO content_resources (topic_id, name, url, kind, sort_order) VALUES
  (201, 'HCIP-Datacom 官方认证', 'https://support.huawei.com/enterprise/zh/certification', 'course', 0),
  (204, 'ensp-cli', 'https://github.com/', 'tool', 0),
  (204, 'netmiko', 'https://github.com/ktbyers/netmiko', 'tool', 1),
  (303, 'pentaho-kettle', 'https://github.com/pentaho/pentaho-kettle', 'tool', 0),
  (303, 'easy_kettle', 'https://github.com/', 'tool', 1),
  (304, 'DataEase', 'https://github.com/dataease/dataease', 'tool', 0),
  (403, 'Spug', 'https://github.com/openspug/spug', 'tool', 0),
  (403, 'proxmox-utils', 'https://github.com/', 'tool', 1),
  (804, 'LangGraph', 'https://github.com/langchain-ai/langgraph', 'tool', 0),
  (804, 'CrewAI', 'https://github.com/crewAIInc/crewAI', 'tool', 1),
  (804, 'AutoGen', 'https://github.com/microsoft/autogen', 'tool', 2),
  (805, 'MCP SDK', 'https://github.com/modelcontextprotocol', 'tool', 0);

-- ---------- 实操项 ----------
INSERT INTO content_practices (topic_id, text, sort_order) VALUES
  (101, '搭建 Anki 卡片库、笔记模板、每周复盘模板、费曼讲稿模板', 0),
  (103, '动手写一个 50-150 行最小 Agent（LLM API + 工具函数 + 循环 + 超时/错误处理）', 0),
  (203, 'eNSP 搭建三层园区网拓扑并用 Wireshark 抓包', 0),
  (204, '用 ensp-cli 批量配置、netmiko 巡检并备份设备配置', 1),
  (301, '按 ODS/DWD/DWS 设计一个分层数仓模型', 0),
  (302, '练习窗口函数与复杂 SQL 查询', 0),
  (303, '用 Kettle/easy_kettle + Shell 完成定时 ETL 任务', 0),
  (304, '用 Pandas/Matplotlib/DataEase 制作可视化大屏', 1),
  (403, '用 Spug 管理批量主机、proxmox-utils 批量创建云桌面', 0),
  (502, '编写一份需求调研问卷与设备清单', 0),
  (503, '输出 Visio 拓扑 + PPT 方案 + Word 投标文档', 0),
  (603, '开发 smart-campus 三合一平台', 0),
  (604, '把 4 个助手整合为一个 ICT 交付助手并做工程化', 0),
  (605, '编写至少 20 条评测用例，记录成功率和失败归因', 0),
  (705, '制作简历项目描述并批量投递乌鲁木齐/克拉玛依岗位', 0);

-- ---------- 项目/产出 ----------
INSERT INTO content_projects (topic_id, name, description, deliverable, sort_order) VALUES
  (103, '最小 Agent Demo', 'LLM API + 工具函数 + 循环的 50-150 行最小 Agent', '1 个最小可运行 Agent', 0),
  (204, '网络巡检助手 MVP', '读取设备配置/日志 → 判断故障 → 生成处置建议', '三层园区网拓扑 + 自动化脚本 + 巡检助手 MVP + 1 篇复盘', 0),
  (304, '数据问答/报表助手', 'RAG 接入政务或教学数据：输入问题 → 检索数据 → 生成图表', '分层数仓 + 自动化 ETL + 可视化大屏 + 数据 Agent + 评测表格', 0),
  (403, '运维值班助手', '日志分析、备份巡检、告警分级（LangGraph 状态流）', '云桌面自动化脚本集 + 运维助手 + 监控大屏', 0),
  (503, '售前方案助手', 'planner → writer → reviewer 多 Agent + MCP 数据源', '2 套投标方案 + 方案撰写 Agent + 标准化需求问卷', 0),
  (603, 'smart-campus 三合一平台', '通信 + 数据 + 运维三合一综合项目', '可演示综合项目', 0),
  (604, 'ICT 交付助手', '整合网络巡检、数据问答、运维、售前方案 4 个助手', '可 clone 项目 + 演示视频 + 技术博客 + 简历项目描述', 0);

-- ---------- 验收检查点 ----------
INSERT INTO content_checkpoints (topic_id, text, sort_order) VALUES
  (101, '1 页学习机制说明（能讲清自己的学习方法）', 0),
  (103, '1 个最小可运行 Agent（能演示）', 0),
  (204, '三层园区网拓扑 + 自动化脚本 + 网络巡检助手 MVP + 1 篇复盘', 0),
  (304, '分层数仓 + 自动化 ETL + 可视化大屏 + 数据 Agent + 评测表格', 0),
  (403, '云桌面自动化脚本集 + 运维助手 + 监控大屏', 0),
  (503, '2 套投标方案 + 方案撰写 Agent + 标准化需求问卷', 0),
  (603, 'smart-campus 平台可演示', 0),
  (604, '可 clone 项目 + 演示视频 + 技术博客 + 简历项目描述', 0),
  (605, '至少 20 条评测用例 + 成功率与失败归因记录', 0),
  (701, '通信/ETL/Linux 云运维三模块题库刷完并自测通过', 0),
  (702, 'Agent 专项面试题能口头作答', 0),
  (703, '能讲清数字新疆/教育数字化/石油信息化', 0),
  (704, '5 分钟费曼讲解综合项目', 0),
  (705, '完成批量投递并跟踪反馈', 0);

-- ---------- 默认设置 ----------
INSERT INTO settings (user_id, key, value) VALUES
  (NULL, 'theme', '{"mode":"light","accent":"indigo"}'),
  (NULL, 'background', '{"enabled":true,"source":"bing","daily":true,"fallback_pool":"xinjiang"}'),
  (NULL, 'sync', '{"enabled":false}')
ON CONFLICT (user_id, key) DO NOTHING;

-- ---------- 应用元信息 ----------
INSERT INTO app_meta (key, value) VALUES
  ('schema_version', '"0.1.0"'),
  ('content_version', '"2026-08-12"'),
  ('db_note', '"ICT 学习工作台本地数据库（PostgreSQL 18.4, .pgdata 集群）"')
ON CONFLICT (key) DO NOTHING;

-- ---------- 修正序列 ----------
SELECT setval(pg_get_serial_sequence('content_phases', 'id'), (SELECT max(id) FROM content_phases));
SELECT setval(pg_get_serial_sequence('content_topics', 'id'), (SELECT max(id) FROM content_topics));
SELECT setval(pg_get_serial_sequence('content_resources', 'id'), (SELECT max(id) FROM content_resources));
SELECT setval(pg_get_serial_sequence('content_practices', 'id'), (SELECT max(id) FROM content_practices));
SELECT setval(pg_get_serial_sequence('content_projects', 'id'), (SELECT max(id) FROM content_projects));
SELECT setval(pg_get_serial_sequence('content_checkpoints', 'id'), (SELECT max(id) FROM content_checkpoints));
