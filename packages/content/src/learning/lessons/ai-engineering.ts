import type { LearningTopicLesson } from "../types";

export const aiEngineeringTopicLessons: Record<string, LearningTopicLesson> = {
  "ai-model-basics": {
    overview: [
      "模型把输入 token 映射为下一步 token 的概率分布，生成结果通过采样形成。上下文窗口限制输入和输出总量，temperature、top_p 等参数改变采样分布。",
      "系统提示是约束，不是安全边界；模型没有天然事实数据库，也不保证输出可执行。工程系统需要超时、重试、预算和验证。",
    ],
    mechanism: [
      "温度越低通常越稳定，越高越多样但更容易偏离；重复惩罚和停止条件也会改变结果。",
      "上下文越长成本越高，并可能出现中间信息被忽略。正确做法是检索相关片段、压缩历史并保留结构化状态。",
    ],
    example: {
      title: "带超时和 token 统计的调用外壳",
      language: "typescript",
      code: `type ModelResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

async function callModel(prompt: string): Promise<ModelResult> {
  const response = await fetch("/api/model", {
    method: "POST",
    body: JSON.stringify({ prompt }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("model request failed");
  return response.json();
}`,
      explanation: "调用设置明确超时，HTTP 状态失败会抛出错误，结果携带 token 统计。上层可以据此重试、记录成本或降级。",
    },
    practiceSteps: [
      "比较低温和高温下同一提示的输出稳定性。",
      "统计一次请求的输入、输出 token 和延迟。",
      "为超时、限流和无效响应设计不同处理。",
    ],
    masteryChecklist: [
      "能解释 token、上下文窗口和采样参数。",
      "能把模型调用放进可观测、可降级的工程边界。",
    ],
  },
  "ai-prompt-output": {
    overview: [
      "提示词应明确角色、任务、输入、约束和输出格式。少样本示例可以提高一致性，但示例必须覆盖真实边界。",
      "结构化输出必须由程序校验。JSON Schema、类型检查、修复重试和人工兜底共同保证下游系统不会收到模糊格式。",
    ],
    mechanism: [
      "系统消息定义长期规则，用户消息提供当前任务；上下文中的示例会改变模型对格式和粒度的预期。",
      "校验失败通常要区分模型格式错误、业务字段缺失和输入本身不合法，不同错误对应不同重试策略。",
    ],
    example: {
      title: "验证工单分类输出",
      language: "typescript",
      code: `type Ticket = {
  category: "billing" | "technical" | "other";
  priority: "low" | "medium" | "high";
  reason: string;
};

function isTicket(value: unknown): value is Ticket {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return ["billing", "technical", "other"].includes(String(item.category))
    && ["low", "medium", "high"].includes(String(item.priority))
    && typeof item.reason === "string";
}`,
      explanation: "类型守卫把模型输出收敛为业务可处理对象。校验失败时可以重试一次，之后记录原文并进入人工队列。",
    },
    practiceSteps: [
      "为一个分类任务写出字段和枚举。",
      "保存一条模型原始输出并运行校验。",
      "为格式失败和业务失败设计不同恢复路径。",
    ],
    masteryChecklist: [
      "能区分提示约束和程序校验。",
      "能为结构输出设计明确失败处理。",
    ],
  },
  "ai-embeddings": {
    overview: [
      "嵌入把文本映射成向量，距离接近表示语义相似，但不保证业务相关。相似度受模型、语言、领域、维度和文本长度影响。",
      "向量索引负责近邻搜索，元数据过滤负责范围，重排负责提高最终相关性。三者不能混为一谈。",
    ],
    mechanism: [
      "余弦相似度比较向量方向，内积和欧氏距离也有不同假设；索引算法在召回率、延迟和内存之间取舍。",
      "语义相似不等于答案正确，技术文档中的否定、版本和条件可能在向量空间中接近错误内容。",
    ],
    example: {
      title: "先评估检索命中，再接生成",
      language: "typescript",
      code: `const query = "如何限制线程池队列";
const matches = await vectorIndex.search(query, { topK: 10 });

const accepted = matches.filter((item) =>
  item.score >= 0.72 && item.docVersion === "v3"
);

console.log(accepted.map((item) => item.title));`,
      explanation: "检索结果先按分数和版过滤，评估标题是否真正回答查询。只有检索质量可信后才进入回答生成。",
    },
    practiceSteps: [
      "用 20 条查询评估 Top 5 命中率。",
      "比较不同切分长度的检索质量。",
      "加入版本过滤，确认旧文档不会混入。",
    ],
    masteryChecklist: [
      "能解释向量相似度与业务相关性的差异。",
      "能评估索引、过滤和重排的作用。",
    ],
  },
  "ai-chunking": {
    overview: [
      "文档切分应保持完整语义单元，并保留标题路径、版本、来源和定位信息。片段过小会丢上下文，过大又会降低检索精度。",
      "索引与文档版本必须一致；增量更新需要识别新增、修改和删除，不能只追加新片段。",
    ],
    mechanism: [
      "Markdown 可以按标题层级切分，代码可以按函数或类切分，问答资料可以按问题切分。",
      "重叠窗口可以减少边界丢词，但会增加存储和重复召回；去重应保留最完整、最新版本的片段。",
    ],
    example: {
      title: "带标题路径的 Markdown 切片",
      language: "typescript",
      code: `type Chunk = {
  text: string;
  source: string;
  headingPath: string[];
  version: string;
};

function makeChunk(text: string, headingPath: string[]): Chunk {
  return {
    text: text.trim(),
    source: "docs/runtime.md",
    headingPath,
    version: "2026-10-09",
  };
}`,
      explanation: "每个片段携带来源、标题路径和版本，回答时可以生成可验证引用，也能在文档更新后替换旧片段。",
    },
    practiceSteps: [
      "把一篇长文档按标题路径切分。",
      "为每个片段保存来源和版本。",
      "删除旧文档后验证索引会同步删除。",
    ],
    masteryChecklist: [
      "能解释片段大小、重叠和上下文的关系。",
      "能设计可追踪、可更新的索引结构。",
    ],
  },
  "ai-retrieval-generation": {
    overview: [
      "检索负责找到证据，生成负责组织和表达证据。查询改写、混合检索、重排和上下文组装都是中间环节。",
      "回答范围应受上下文约束，关键结论要能引用原文。检索不到证据时应明确说明不确定，而不是编造。",
    ],
    mechanism: [
      "关键词检索擅长精确术语和代码，向量检索擅长语义改写，混合检索以分数融合兼顾两者。",
      "重排模型在较小候选集上重新排序，成本高于初排；上下文组装要控制 token 预算并保留来源编号。",
    ],
    example: {
      title: "带引用的回答协议",
      language: "json",
      code: `{
  "answer": "线程池应设置有限队列和拒绝策略。",
  "citations": [
    { "source": "java-concurrency.md", "heading": "线程池" }
  ],
  "insufficient_context": false
}`,
      explanation: "输出把答案、引用和证据不足标志分开。程序可以检查引用是否存在，并把无依据回答退回检索。",
    },
    practiceSteps: [
      "为一个查询比较关键词和向量召回。",
      "把 Top 20 候选重排后取 Top 5。",
      "要求回答带来源并验证引用。",
    ],
    masteryChecklist: [
      "能拆分检索失败和生成失败。",
      "能控制上下文预算并保留引用。",
    ],
  },
  "ai-rag-eval": {
    overview: [
      "RAG 评测集要覆盖真实问题、长尾问题、无答案问题和困难边界。指标应同时衡量检索和生成，而不是只看最终回答是否流畅。",
      "召回率、命中位置、忠实度、答案覆盖和引用有效性帮助定位失败环节。人工复核用于捕捉自动指标遗漏的问题。",
    ],
    mechanism: [
      "检索失败是正确证据没有进入候选集，生成失败是证据已提供但回答错误或不忠实；两者的修复手段不同。",
      "回归集固定后，修改切分、模型、提示和索引都应运行同一套评测，比较质量、延迟和成本。",
    ],
    example: {
      title: "评测样例应包含预期证据",
      language: "json",
      code: `{
  "question": "为什么只依赖 volatile 不能保护 count++？",
  "expectedSources": ["java-concurrency.md"],
  "expectedFacts": ["读改写不是原子操作", "需要锁或原子类"],
  "shouldAnswer": true
}`,
      explanation: "样例同时记录问题和预期证据，便于判断失败发生在检索还是生成。无答案问题应标注 shouldAnswer=false。",
    },
    practiceSteps: [
      "建立 30 条覆盖不同难度的评测样例。",
      "分别统计召回率和回答忠实度。",
      "对失败样例归类并只修复主要类别。",
    ],
    masteryChecklist: [
      "能按失败环节归因而不是只看总分。",
      "能用同一评测集比较多次变更。",
    ],
  },
  "ai-tools": {
    overview: [
      "工具是模型与外部世界之间的受控边界。参数 schema、权限、幂等、超时和错误模型必须由程序执行，不能依赖模型自觉。",
      "只读查询和写操作风险不同，高风险动作应要求确认或二次授权。工具结果也要校验，避免把外部错误当成事实。",
    ],
    mechanism: [
      "函数调用把工具描述和参数交给模型，模型只提出调用意图，真正执行由宿主程序完成。",
      "幂等键防止重试造成重复写入，审计日志记录谁、何时、用什么参数调用了工具。",
    ],
    example: {
      title: "区分只读与需确认写操作",
      language: "typescript",
      code: `const tools = {
  getOrder: {
    risk: "read",
    execute: async ({ orderId }: { orderId: string }) => db.getOrder(orderId),
  },
  cancelOrder: {
    risk: "write",
    requiresConfirmation: true,
    execute: async ({ orderId, idempotencyKey }: {
      orderId: string;
      idempotencyKey: string;
    }) => db.cancelOrder(orderId, idempotencyKey),
  },
};`,
      explanation: "取消订单需要确认和幂等键，读订单直接执行。权限策略跟随工具边界，而不是散落在提示词中。",
    },
    practiceSteps: [
      "为每个工具写参数 schema 和风险等级。",
      "让写操作重复调用并验证幂等。",
      "记录一次工具调用的输入、输出和审批。",
    ],
    masteryChecklist: [
      "能区分工具意图和宿主执行。",
      "能为高风险工具设计确认、幂等和审计。",
    ],
  },
  "ai-agent-loop": {
    overview: [
      "Agent 循环在观察、思考、行动和评估之间迭代。最大步数、时间预算、工具预算和终止条件决定系统是否会失控。",
      "状态应可序列化，才能恢复中断、回放和审计。每轮行动都应有明确目标，不能在同一个错误状态中循环。",
    ],
    mechanism: [
      "宿主保存消息、工具结果、计划、剩余预算和当前阶段；模型只负责提出下一步动作。",
      "失败恢复可根据状态重新执行，但危险动作要使用幂等键和已完成标记，避免重复提交。",
    ],
    example: {
      title: "带预算和终止条件的状态",
      language: "typescript",
      code: `type AgentState = {
  goal: string;
  step: number;
  maxSteps: number;
  status: "running" | "waiting_approval" | "done" | "failed";
  lastObservation?: string;
};

function canContinue(state: AgentState): boolean {
  return state.status === "running" && state.step < state.maxSteps;
}`,
      explanation: "状态保存目标、步数、预算和阶段，循环在执行前检查能否继续。人工确认状态可以暂停并恢复。",
    },
    practiceSteps: [
      "为一个工单任务定义最多五步的状态机。",
      "让工具失败后进入重试或人工接管。",
      "中断后从序列化状态恢复并避免重复写。",
    ],
    masteryChecklist: [
      "能说明 Agent 的停止条件和预算。",
      "能保证状态可恢复、行动可审计。",
    ],
  },
  "ai-multi-agent": {
    overview: [
      "多 Agent 用于明确分工，例如规划、检索、执行和审校。拆分应降低复杂度，而不是制造更多消息和权限漏洞。",
      "消息协议、共享上下文、工具权限和失败责任必须明确。不同 Agent 不应默认拥有同一套高风险工具。",
    ],
    mechanism: [
      "角色可以通过独立系统提示、工具集合和输出 schema 实现；宿主负责路由消息和持久化状态。",
      "共享上下文容易膨胀和污染，最好传递结构化摘要、事实和引用，而不是把全部对话无差别复制。",
    ],
    example: {
      title: "按权限拆分工具",
      language: "typescript",
      code: `const roles = {
  researcher: ["searchDocs", "readFile"],
  planner: ["readState"],
  executor: ["createTicket"],
  reviewer: ["readState", "readAuditLog"],
};`,
      explanation: "搜索角色只能读取资料，执行角色才能创建工单，审校角色查看状态和审计。权限与职责一一对应。",
    },
    practiceSteps: [
      "列出每个角色的输入、输出和允许工具。",
      "限制共享上下文只传递必要摘要。",
      "测试一个角色越权调用另一个工具。",
    ],
    masteryChecklist: [
      "能说明拆分解决的具体分工问题。",
      "能设计角色协议、权限和失败责任。",
    ],
  },
  "ai-observability": {
    overview: [
      "可观测性让线上问题可以还原：请求从哪来、用了什么模型和提示、检索了哪些文档、调用了哪些工具、耗时和成本多少。",
      "发布门禁同时约束质量、延迟、成本和错误率。没有 trace 和评测，模型变更只能靠感觉。",
    ],
    mechanism: [
      "trace 通常包含 request id、用户、模型版本、输入摘要、检索片段、工具调用、输出和反馈。",
      "指标要按模型版本、提示版本和知识库版本拆分，否则无法归因质量变化。",
    ],
    example: {
      title: "一次问答的 trace 字段",
      language: "json",
      code: `{
  "requestId": "req-1",
  "model": "model-a@2026-10",
  "promptVersion": "qa-v7",
  "retrieved": ["java-concurrency#线程池"],
  "toolCalls": [],
  "latencyMs": 1840,
  "inputTokens": 2200,
  "outputTokens": 180,
  "outcome": "answered"
}`,
      explanation: "字段覆盖模型、提示、检索、工具、延迟、成本和结果，能够回答“为什么这次变慢或变差”。",
    },
    practiceSteps: [
      "为一次请求记录完整 trace 字段。",
      "按模型版本比较延迟和错误率。",
      "为发布设置最小回归集和指标门禁。",
    ],
    masteryChecklist: [
      "能还原一次线上请求的关键链路。",
      "能用指标和回归集约束发布。",
    ],
  },
  "ai-safety": {
    overview: [
      "安全边界包括提示注入、数据泄露、越权工具、输出过滤和人工兜底。不可信文档不能获得系统指令级权限。",
      "安全控制必须在可执行边界实现：工具权限、数据访问、参数校验、网络出口和人工确认。",
    ],
    mechanism: [
      "提示注入通过文档或工具结果改变模型行为，防护重点是隔离指令、最小权限和输出校验。",
      "敏感数据需要脱敏、访问控制和审计；输出过滤只能作为补充，不能替代模型层和数据层权限。",
    ],
    example: {
      title: "最小权限工具网关",
      language: "typescript",
      code: `async function executeTool(call: ToolCall, user: User) {
  const tool = toolRegistry[call.name];
  if (!tool) throw new Error("unknown tool");
  if (!tool.allowedRoles.includes(user.role)) {
    throw new Error("forbidden");
  }
  return tool.execute(tool.schema.parse(call.arguments), user);
}`,
      explanation: "工具存在性、角色权限和参数 schema 在宿主端检查。模型无法通过提示词绕过网关进入未授权工具。",
    },
    practiceSteps: [
      "在文档中放入恶意指令，测试模型是否越权。",
      "用不同角色调用写工具验证拒绝。",
      "为高风险输出加入人工确认。",
    ],
    masteryChecklist: [
      "能说明提示注入的边界和防护位置。",
      "能让权限、参数和输出在可执行层受控。",
    ],
  },
  "ai-cost-reliability": {
    overview: [
      "成本和可靠性需要治理：缓存、模型路由、限流、降级、隐私和数据保留。不同任务可以使用不同能力等级。",
      "可靠系统不能假设模型永远可用，必须设计超时、重试上限、备用模型和人工接管。",
    ],
    mechanism: [
      "缓存要区分精确相同请求和语义相近请求，并设置失效和隐私边界；不安全的缓存可能泄露跨用户数据。",
      "模型路由按任务难度、时延、成本和风险选择；高可靠路径可以组合规则、检索和多模型校验。",
    ],
    example: {
      title: "三档执行路径",
      language: "typescript",
      code: `type Route = "low_cost" | "standard" | "high_reliability";

function chooseRoute(input: { risky: boolean; needsFreshData: boolean }): Route {
  if (input.risky) return "high_reliability";
  if (input.needsFreshData) return "standard";
  return "low_cost";
}`,
      explanation: "风险任务走高可靠路径，新数据任务走标准路径，普通问答走低成本路径。路由结果应记录并持续评估。",
    },
    practiceSteps: [
      "把请求分为低成本、标准和高可靠三类。",
      "为每类定义超时、重试和降级。",
      "检查缓存是否隔离用户和敏感数据。",
    ],
    masteryChecklist: [
      "能按任务价值选择成本与可靠性。",
      "能为超时、限流和模型失败设计接管路径。",
    ],
  },
};
