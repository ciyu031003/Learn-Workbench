-- ============================================================================
-- 003：职业功能（多职业学习路线）
-- ICT 学习规划（career_key='ict'）严格固定不可修改；其余职业路线来自公开学习路线整理
-- ============================================================================

CREATE TABLE IF NOT EXISTS careers (
  id          serial PRIMARY KEY,
  career_key  text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  is_locked   boolean NOT NULL DEFAULT false,
  sort_order  int NOT NULL DEFAULT 0
);

ALTER TABLE content_phases ADD COLUMN IF NOT EXISTS career_key text NOT NULL DEFAULT 'ict';
-- 放宽唯一约束：按 (career_key, track, sort_order) 唯一，允许各职业各自排序
ALTER TABLE content_phases DROP CONSTRAINT IF EXISTS content_phases_track_sort_order_key;
ALTER TABLE content_phases ADD CONSTRAINT content_phases_career_track_sort UNIQUE (career_key, track, sort_order);
CREATE INDEX IF NOT EXISTS idx_phases_career ON content_phases(career_key);

INSERT INTO careers (career_key, name, description, is_locked, sort_order) VALUES
('ict', 'ICT 学习规划', '新疆 ICT 就业导向：网络/数据/云运维/售前/Agent 综合路线，严格规定不可修改', true, 0),
('frontend', '前端开发工程师', 'HTML/CSS/JavaScript → 框架 → 工程化 → 跨端 → 性能与架构', false, 1),
('java-backend', 'Java 后端工程师', 'Java 基础 → JavaWeb → 框架 → 中间件 → 微服务 → 项目实战', false, 2),
('data-analysis', '数据分析师', 'Excel/SQL → Python → 统计学 → 可视化 → 业务分析实战', false, 3),
('ai-engineer', '人工智能工程师', 'Python → 机器学习 → 深度学习 → 大模型与 Agent 工程化', false, 4),
('cyber-security', '网络安全工程师', '网络系统基础 → Web 安全 → 渗透测试 → 安全运维与应急响应', false, 5)
ON CONFLICT (career_key) DO NOTHING;

-- 修正既有 ICT 阶段归属
UPDATE content_phases SET career_key = 'ict' WHERE career_key IS NULL OR career_key = '';

-- ============================================================================
-- 前端开发工程师（phase id 101-105）
-- ============================================================================
INSERT INTO content_phases (id, career_key, phase_key, title, weeks, track, summary, sort_order) VALUES
(101, 'frontend', 'fe-phase-1', '前端基础：HTML / CSS / JavaScript', '第 1-4 周', 'main', '网页结构、样式布局与 JS 语法，打牢三件套', 0),
(102, 'frontend', 'fe-phase-2', '工程化与框架：Git / 构建 / Vue / React', '第 5-10 周', 'main', '版本管理与构建工具，掌握一个主流框架', 1),
(103, 'frontend', 'fe-phase-3', '进阶：TypeScript / 状态管理 / 性能优化', '第 11-16 周', 'main', '类型安全、组件状态与页面性能优化', 2),
(104, 'frontend', 'fe-phase-4', '跨端与全栈：小程序 / React Native / Node 基础', '第 17-22 周', 'main', '多端开发能力与轻后端接口联调', 3),
(105, 'frontend', 'fe-phase-5', '实战与求职：项目 / 简历 / 面试', '第 23-28 周', 'main', '完整项目沉淀、简历包装与面试冲刺', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO content_topics (phase_id, topic_key, title, summary, sort_order) VALUES
(101, 'fe-p1-t1', 'HTML5 语义化与表单', '语义化标签、表单校验、可访问性基础', 0),
(101, 'fe-p1-t2', 'CSS 布局体系', 'Flexbox / Grid、盒模型、响应式与媒体查询', 1),
(101, 'fe-p1-t3', 'JavaScript 核心语法', '变量/函数/作用域/闭包/DOM 操作', 2),
(101, 'fe-p1-t4', 'ES6+ 与异步编程', '解构/模块/Promise/async-await', 3),
(102, 'fe-p2-t1', 'Git 与团队协作', '分支管理、PR 流程、冲突解决', 0),
(102, 'fe-p2-t2', '构建工具与工程化', 'npm/pnpm、Vite、打包配置', 1),
(102, 'fe-p2-t3', 'Vue 3 或 React 框架', '组件化、路由、生命周期、组合式/函数式开发', 2),
(102, 'fe-p2-t4', 'UI 组件与样式方案', 'Tailwind / 组件库、设计系统基础', 3),
(103, 'fe-p3-t1', 'TypeScript 进阶', '类型体操、泛型、工程类型实践', 0),
(103, 'fe-p3-t2', '状态管理', 'Pinia / Redux / Zustand、数据流设计', 1),
(103, 'fe-p3-t3', '浏览器原理与性能优化', '渲染流程、重排重绘、缓存、懒加载', 2),
(103, 'fe-p3-t4', '工程规范与测试', 'ESLint / 单元测试 / 端到端测试基础', 3),
(104, 'fe-p4-t1', '小程序开发', '原生小程序或 uni-app 跨端', 0),
(104, 'fe-p4-t2', 'React Native 基础', '组件、导航、状态与原生模块', 1),
(104, 'fe-p4-t3', 'Node.js 与接口联调', 'Express 基础、REST API、鉴权', 2),
(104, 'fe-p4-t4', '部署与监控', 'Nginx / 静态托管、埋点与错误监控', 3),
(105, 'fe-p5-t1', '综合实战项目', '从 0 到 1 完成可上线项目并开源', 0),
(105, 'fe-p5-t2', '简历与作品集', '项目亮点提炼、GitHub 整理', 1),
(105, 'fe-p5-t3', '面试冲刺', '八股、手写题、项目深挖与算法基础', 2);

-- ============================================================================
-- Java 后端工程师（phase id 111-115）
-- ============================================================================
INSERT INTO content_phases (id, career_key, phase_key, title, weeks, track, summary, sort_order) VALUES
(111, 'java-backend', 'jb-phase-1', 'Java 基础', '第 1-4 周', 'main', '语法、集合、面向对象与 JVM 初步', 0),
(112, 'java-backend', 'jb-phase-2', 'JavaWeb 与数据库', '第 5-10 周', 'main', 'Servlet、MySQL、JDBC 与事务', 1),
(113, 'java-backend', 'jb-phase-3', '主流框架', '第 11-16 周', 'main', 'Spring / Spring Boot / MyBatis', 2),
(114, 'java-backend', 'jb-phase-4', '中间件与微服务', '第 17-24 周', 'main', 'Redis、消息队列、Spring Cloud', 3),
(115, 'java-backend', 'jb-phase-5', '实战与求职', '第 25-32 周', 'main', '分布式项目、部署、面试', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO content_topics (phase_id, topic_key, title, summary, sort_order) VALUES
(111, 'jb-p1-t1', 'Java 语法与面向对象', '基本语法、类与对象、封装继承多态', 0),
(111, 'jb-p1-t2', '集合与泛型', 'List/Map/Set、泛型、迭代器', 1),
(111, 'jb-p1-t3', '异常与 IO', '异常体系、文件 IO、序列化', 2),
(111, 'jb-p1-t4', 'JVM 初步与多线程', '内存模型、GC 概念、线程与锁', 3),
(112, 'jb-p2-t1', 'MySQL 与 SQL 优化', '索引、事务隔离、慢查询优化', 0),
(112, 'jb-p2-t2', 'JDBC 与连接池', 'JDBC、HikariCP、预编译防注入', 1),
(112, 'jb-p2-t3', 'Servlet 与 HTTP', '请求响应、会话、过滤器', 2),
(112, 'jb-p2-t4', 'Maven 与工程规范', '依赖管理、多模块、规范', 3),
(113, 'jb-p3-t1', 'Spring 核心', 'IOC/AOP、Bean 生命周期', 0),
(113, 'jb-p3-t2', 'Spring Boot', '自动配置、Starter、配置文件', 1),
(113, 'jb-p3-t3', 'MyBatis / MyBatis-Plus', 'ORM、动态 SQL、分页', 2),
(113, 'jb-p3-t4', 'RESTful 接口开发', '参数校验、统一异常、Swagger', 3),
(114, 'jb-p4-t1', 'Redis', '数据结构、缓存、分布式锁', 0),
(114, 'jb-p4-t2', '消息队列', 'RabbitMQ/Kafka 基础与场景', 1),
(114, 'jb-p4-t3', 'Spring Cloud 微服务', '注册中心、网关、配置中心、熔断', 2),
(114, 'jb-p4-t4', '容器与部署', 'Docker、CI/CD、Linux 运维基础', 3),
(115, 'jb-p5-t1', '分布式项目实战', '电商/后台管理完整项目', 0),
(115, 'jb-p5-t2', '高并发与调优', 'JVM 调优、数据库优化、压测', 1),
(115, 'jb-p5-t3', '简历与面试冲刺', '项目深挖、八股、算法基础', 2);

-- ============================================================================
-- 数据分析师（phase id 121-125）
-- ============================================================================
INSERT INTO content_phases (id, career_key, phase_key, title, weeks, track, summary, sort_order) VALUES
(121, 'data-analysis', 'da-phase-1', '业务与工具基础', '第 1-3 周', 'main', '分析思维、Excel、基础统计概念', 0),
(122, 'data-analysis', 'da-phase-2', 'SQL 与数据库', '第 4-7 周', 'main', '查询、聚合、窗口函数与取数', 1),
(123, 'data-analysis', 'da-phase-3', 'Python 数据分析', '第 8-13 周', 'main', 'Pandas / NumPy 数据清洗与处理', 2),
(124, 'data-analysis', 'da-phase-4', '可视化与统计方法', '第 14-19 周', 'main', 'Matplotlib/Seaborn、假设检验、AB 测试', 3),
(125, 'data-analysis', 'da-phase-5', '实战与业务分析', '第 20-26 周', 'main', '业务指标体系、报表与报告、项目', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO content_topics (phase_id, topic_key, title, summary, sort_order) VALUES
(121, 'da-p1-t1', '分析思维与流程', '问题定义、指标拆解、结论输出', 0),
(121, 'da-p1-t2', 'Excel 数据分析', '透视表、函数、条件格式', 1),
(121, 'da-p1-t3', '基础统计学', '均值/方差/分布/相关', 2),
(122, 'da-p2-t1', 'SQL 基础查询', 'SELECT/JOIN/GROUP BY/子查询', 0),
(122, 'da-p2-t2', 'SQL 进阶', '窗口函数、CASE、去重与去脏', 1),
(122, 'da-p2-t3', '取数与业务表设计', '理解数仓分层、业务口径', 2),
(123, 'da-p3-t1', 'Python 基础', '语法、数据结构、函数', 0),
(123, 'da-p3-t2', 'NumPy 与 Pandas', '数组运算、DataFrame 清洗', 1),
(123, 'da-p3-t3', '数据清洗实战', '缺失值、重复值、异常值处理', 2),
(124, 'da-p4-t1', '数据可视化', 'Matplotlib/Seaborn 图表规范', 0),
(124, 'da-p4-t2', '假设检验', 't 检验、卡方检验、显著性', 1),
(124, 'da-p4-t3', 'AB 测试与归因', '实验设计、指标显著性、因果推断基础', 2),
(125, 'da-p5-t1', '业务指标体系', '北极星指标、漏斗、留存、RFM', 0),
(125, 'da-p5-t2', '分析报告与仪表盘', 'PPT 报告、BI 工具（Tableau/PowerBI）', 1),
(125, 'da-p5-t3', '综合实战项目', '完整取数-分析-报告项目', 2);

-- ============================================================================
-- 人工智能工程师（phase id 131-135）
-- ============================================================================
INSERT INTO content_phases (id, career_key, phase_key, title, weeks, track, summary, sort_order) VALUES
(131, 'ai-engineer', 'ai-phase-1', 'Python 与数学基础', '第 1-5 周', 'main', 'Python、线性代数、概率统计', 0),
(132, 'ai-engineer', 'ai-phase-2', '机器学习', '第 6-12 周', 'main', '经典算法、sklearn、模型评估', 1),
(133, 'ai-engineer', 'ai-phase-3', '深度学习', '第 13-19 周', 'main', '神经网络、PyTorch、CV/NLP 入门', 2),
(134, 'ai-engineer', 'ai-phase-4', '大模型与 Agent 工程化', '第 20-27 周', 'main', 'Transformer、Prompt、RAG、Agent', 3),
(135, 'ai-engineer', 'ai-phase-5', '实战与求职', '第 28-34 周', 'main', 'AI 项目、论文阅读、面试', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO content_topics (phase_id, topic_key, title, summary, sort_order) VALUES
(131, 'ai-p1-t1', 'Python 编程', '语法、NumPy、面向对象', 0),
(131, 'ai-p1-t2', '线性代数与微积分', '矩阵、导数、梯度', 1),
(131, 'ai-p1-t3', '概率与统计', '分布、贝叶斯、极大似然', 2),
(132, 'ai-p2-t1', '监督学习', '线性回归、逻辑回归、决策树/集成', 0),
(132, 'ai-p2-t2', '无监督与降维', '聚类、PCA、关联规则', 1),
(132, 'ai-p2-t3', '模型评估与调优', '交叉验证、过拟合、特征工程', 2),
(133, 'ai-p3-t1', '神经网络基础', '反向传播、激活函数、优化器', 0),
(133, 'ai-p3-t2', 'PyTorch 实战', '张量、DataLoader、训练流程', 1),
(133, 'ai-p3-t3', 'CNN 与视觉入门', '卷积、经典网络、图像分类', 2),
(133, 'ai-p3-t4', 'RNN/Transformer 与 NLP 入门', '序列建模、注意力机制', 3),
(134, 'ai-p4-t1', '大模型原理', 'GPT 架构、微调、RLHF 概念', 0),
(134, 'ai-p4-t2', 'Prompt 工程', '提示词设计、上下文、工具调用', 1),
(134, 'ai-p4-t3', 'RAG 应用开发', '向量检索、Embedding、知识库问答', 2),
(134, 'ai-p4-t4', 'AI Agent 工程化', '规划、记忆、多智能体、LangChain', 3),
(135, 'ai-p5-t1', 'AI 综合项目', '从数据到部署的完整 AI 应用', 0),
(135, 'ai-p5-t2', '论文与方法阅读', '顶会论文、技术博客复盘', 1),
(135, 'ai-p5-t3', '简历与面试冲刺', '算法题、项目深挖、AI 八股', 2);

-- ============================================================================
-- 网络安全工程师（phase id 141-145）
-- ============================================================================
INSERT INTO content_phases (id, career_key, phase_key, title, weeks, track, summary, sort_order) VALUES
(141, 'cyber-security', 'cs-phase-1', '网络与系统基础', '第 1-5 周', 'main', '网络协议、Linux、虚拟化基础', 0),
(142, 'cyber-security', 'cs-phase-2', 'Web 与系统安全基础', '第 6-11 周', 'main', 'Web 漏洞原理、系统加固、日志', 1),
(143, 'cyber-security', 'cs-phase-3', '渗透测试', '第 12-19 周', 'main', '信息收集、漏洞利用、内网渗透', 2),
(144, 'cyber-security', 'cs-phase-4', '安全运维与应急响应', '第 20-26 周', 'main', 'SIEM、溯源、加固、合规等保', 3),
(145, 'cyber-security', 'cs-phase-5', '证书与求职', '第 27-34 周', 'main', 'CISP-PTE/OSCP 备考、项目与面试', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO content_topics (phase_id, topic_key, title, summary, sort_order) VALUES
(141, 'cs-p1-t1', '网络协议', 'TCP/IP、HTTP(S)、DNS、抓包分析', 0),
(141, 'cs-p1-t2', 'Linux 基础与安全', '用户权限、进程、防火墙、SELinux', 1),
(141, 'cs-p1-t3', '虚拟化与靶场环境', 'VMware/Docker、搭建渗透靶场', 2),
(142, 'cs-p2-t1', 'Web 安全漏洞', 'SQL 注入、XSS、SSRF、文件上传', 0),
(142, 'cs-p2-t2', '系统加固', '基线检查、补丁、账号与口令策略', 1),
(142, 'cs-p2-t3', '日志与流量分析', '系统日志、Wireshark 流量分析', 2),
(143, 'cs-p3-t1', '信息收集', '子域名、指纹、目录扫描', 0),
(143, 'cs-p3-t2', '漏洞扫描与利用', 'Nessus/OpenVAS、Burp Suite 使用', 1),
(143, 'cs-p3-t3', '权限提升与内网渗透', '提权、横向移动、隧道', 2),
(143, 'cs-p3-t4', '渗透测试报告', '报告编写、修复建议', 3),
(144, 'cs-p4-t1', '安全监控与 SIEM', 'ELK/Splunk、告警规则', 0),
(144, 'cs-p4-t2', '应急响应与溯源', '入侵排查、样本分析、取证', 1),
(144, 'cs-p4-t3', '等级保护与合规', '等保 2.0、数据安全法', 2),
(145, 'cs-p5-t1', '证书备考', 'CISP-PTE / OSCP 学习路径', 0),
(145, 'cs-p5-t2', '安全项目实战', 'SRC 漏洞挖掘、CTF、实习项目', 1),
(145, 'cs-p5-t3', '简历与面试冲刺', '安全面试题、项目复盘', 2);
