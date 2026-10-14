import type { LearningDifficulty, LearningQuestion, LearningLevel } from "./types";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function singleQuestion(input: {
  key: string; stageKey: string; topicKey: string;
  stem: string; options: [string, string, string, string];
  answer: "A" | "B" | "C" | "D"; explanation: string;
  difficulty: LearningDifficulty; tags: string[]; sourceKey: string; level: LearningLevel;
}): LearningQuestion {
  return { key: input.key, stageKey: input.stageKey, topicKey: input.topicKey, type: "single",
    stem: input.stem, options: input.options.map((text, i) => ({ key: OPTION_KEYS[i], text })),
    answer: [input.answer], explanation: input.explanation, difficulty: input.difficulty,
    tags: input.tags, sourceKey: input.sourceKey, level: input.level };
}

function judgeQuestion(input: {
  key: string; stageKey: string; topicKey: string;
  stem: string; answer: boolean; explanation: string;
  difficulty: LearningDifficulty; tags: string[]; sourceKey: string; level: LearningLevel;
}): LearningQuestion {
  return { key: input.key, stageKey: input.stageKey, topicKey: input.topicKey, type: "judge",
    stem: input.stem, options: [{ key: "A", text: "正确" }, { key: "B", text: "错误" }],
    answer: [input.answer ? "A" : "B"], explanation: input.explanation, difficulty: input.difficulty,
    tags: input.tags, sourceKey: input.sourceKey, level: input.level };
}

/** AI 应用工程补充题库（按知识点细分，每个知识点 2 题：1 单选 + 1 判断，共 15 个知识点 / 30 题）。 */
export const aiengineeringSupplementQuestions: LearningQuestion[] = [
  // ===== 1. ai-model-basics（模型输入与上下文；归属阶段 ai-foundations） =====
  singleQuestion({ key: "ai-engineering-sup-ai-model-basics-s1", stageKey: "ai-foundations", topicKey: "ai-model-basics",
    stem: "关于大模型的上下文窗口，下列说法正确的是哪一项？",
    options: ["上下文窗口只限制模型一次能输出的最大 token 数，与输入无关", "上下文窗口同时约束一次请求可送入的输入 token 与可生成的输出 token 总量", "上下文窗口越大，模型的事实准确率就一定越高", "上下文窗口只与训练数据规模有关，与单次请求无关"],
    answer: "B",
    explanation: "上下文窗口是单次请求能容纳的 token 上限，它同时限制输入、输出以及中间推理所占用的 token 总量；窗口大小并不直接决定事实准确性，越大的窗口也可能引入更多无关噪声，因此选 B。",
    difficulty: "easy", tags: ["上下文窗口", "token"], sourceKey: "openai-cookbook", level: "入门" }),
  judgeQuestion({ key: "ai-engineering-sup-ai-model-basics-j1", stageKey: "ai-foundations", topicKey: "ai-model-basics",
    stem: "把上下文窗口长度当作模型的“可靠长期记忆”是安全的，因为模型会完整记住窗口内所有信息。",
    answer: false,
    explanation: "上下文窗口只是模型在单次请求中可见的临时文本，模型并不具备跨请求的稳定记忆；而且长上下文中的远端信息可能被注意力稀释或忽略，不能等同于可靠记忆，因此命题错误。",
    difficulty: "medium", tags: ["上下文", "记忆边界"], sourceKey: "openai-cookbook", level: "进阶" }),

  // ===== 2. ai-prompt-output（提示与结构化输出；归属阶段 ai-foundations） =====
  singleQuestion({ key: "ai-engineering-sup-ai-prompt-output-s1", stageKey: "ai-foundations", topicKey: "ai-prompt-output",
    stem: "要求模型返回结构化 JSON 时，最稳妥的工程做法是哪一项？",
    options: ["直接把模型返回的字符串当 JSON 解析并写入业务库", "用 JSON Schema 约束生成，解析后再做类型与字段校验，失败则重试或转人工", "只要返回文本包含大括号就认为成功", "让模型自己保证格式，不需要程序校验"],
    answer: "B",
    explanation: "模型输出格式并不稳定，可能缺字段、类型错误或使用非法枚举；最稳妥做法是先用 Schema 约束生成，再用程序解析校验，对非法结果触发重试或降级，把不确定性挡在业务之外，故选 B。",
    difficulty: "medium", tags: ["结构化输出", "校验"], sourceKey: "openai-cookbook", level: "进阶" }),
  judgeQuestion({ key: "ai-engineering-sup-ai-prompt-output-j1", stageKey: "ai-foundations", topicKey: "ai-prompt-output",
    stem: "在提示中同时写入相互冲突的规则（例如“必须简洁”又“必须详尽”）通常会提升输出质量。",
    answer: false,
    explanation: "相互冲突的指令会让模型在两种目标间摇摆，反而产生犹豫、重复或自相矛盾的内容；清晰且不冲突的约束才是可预测输出的前提，因此该命题错误。",
    difficulty: "easy", tags: ["提示设计", "指令冲突"], sourceKey: "openai-cookbook", level: "入门" }),

  // ===== 3. ai-embeddings（向量与语义表示；归属阶段 ai-foundations） =====
  singleQuestion({ key: "ai-engineering-sup-ai-embeddings-s1", stageKey: "ai-foundations", topicKey: "ai-embeddings",
    stem: "关于文本向量（embedding）与余弦相似度，下列说法正确的是哪一项？",
    options: ["余弦相似度越高，两个文本的业务相关性就一定越强", "向量把文本映射为稠密数值，可用余弦等度量计算语义接近度，但相似度不等于业务相关", "不同嵌入模型生成的向量可以直接拼在同一索引里混合比较", "embedding 维度越高，检索召回率必然越高"],
    answer: "B",
    explanation: "向量表示能计算语义接近度，但语义相近并不等于业务相关，仍需要评测验证；不同模型的向量空间通常不兼容，混用会破坏相似度含义，维度高低也不与召回率直接正相关，故 B 正确。",
    difficulty: "medium", tags: ["向量", "语义表示"], sourceKey: "openai-cookbook", level: "进阶" }),
  judgeQuestion({ key: "ai-engineering-sup-ai-embeddings-j1", stageKey: "ai-foundations", topicKey: "ai-embeddings",
    stem: "用同一嵌入模型为文档和查询生成向量，并把相似度分数直接当作答案是否正确的最终依据是可靠的。",
    answer: false,
    explanation: "相似度只衡量向量空间内的接近程度，不能保证召回内容真正回答了问题；高分可能来自措辞相似而实质无关，低分也可能漏掉正确但表述不同的内容，因此不能直接当作答案正确性依据，命题错误。",
    difficulty: "medium", tags: ["相似度", "召回"], sourceKey: "openai-cookbook", level: "进阶" }),

  // ===== 4. ai-rag（RAG、检索与评测；归属阶段 ai-foundations） =====
  singleQuestion({ key: "ai-engineering-sup-ai-rag-s1", stageKey: "ai-rag", topicKey: "ai-chunking",
    stem: "RAG（检索增强生成）的核心思想是什么？",
    options: ["完全抛弃预训练模型，只用检索结果回答", "在生成前先从外部知识库检索相关证据，再把证据与问题一起送给模型组织答案", "只用模型参数里的记忆生成，不引入外部文档", "把全部知识库原文拼接进系统提示即可替代检索"],
    answer: "B",
    explanation: "RAG 的关键是在回答前用检索从知识库取回与问题相关的片段，作为上下文与问题一并送入模型，从而让答案有可核查的证据支撑，并缓解模型参数记忆过时或编造的问题，故选 B。",
    difficulty: "easy", tags: ["RAG", "检索增强"], sourceKey: "microsoft-generative-ai", level: "入门" }),
  judgeQuestion({ key: "ai-engineering-sup-ai-rag-j1", stageKey: "ai-rag", topicKey: "ai-chunking",
    stem: "只要知识库里存在正确答案，RAG 就一定能在回答中正确引用它。",
    answer: false,
    explanation: "RAG 的效果依赖切分、检索召回、重排和生成等多方面；片段切分不当、检索未召回正确答案或重排把它排到后面，都会导致答案无法引用到正确内容，因此“存在即可用”并不成立，命题错误。",
    difficulty: "medium", tags: ["RAG", "召回"], sourceKey: "microsoft-generative-ai", level: "进阶" }),

  // ===== 5. ai-chunking（文档切分与索引；归属阶段 ai-foundations） =====
  singleQuestion({ key: "ai-engineering-sup-ai-chunking-s1", stageKey: "ai-rag", topicKey: "ai-chunking",
    stem: "对表格、代码等结构化内容做 RAG 切分时，下列哪种做法风险最高？",
    options: ["按标题层级保持语义单元完整切分", "仅按固定字数盲目切断，导致表格行或代码块被拆散", "为每段保留来源标题路径与位置元数据", "在相邻片段间保留少量重叠窗口"],
    answer: "B",
    explanation: "固定字数切分会把表格的一行、代码的一个函数或句子从中间切断，使单个片段失去独立语义，检索召回后模型难以理解；应保持语义单元完整并保留来源定位，故 B 风险最高。",
    difficulty: "medium", tags: ["切分", "索引"], sourceKey: "microsoft-generative-ai", level: "进阶" }),
  judgeQuestion({ key: "ai-engineering-sup-ai-chunking-j1", stageKey: "ai-rag", topicKey: "ai-chunking",
    stem: "文档更新后，只要重新生成新片段并插入索引，无需删除旧片段，RAG 也不会返回过期内容。",
    answer: false,
    explanation: "若只追加新片段而不删除或标记旧片段，索引中会同时存在新旧版本，检索可能命中已废弃内容，导致答案引用过期信息；索引必须与文档版本保持一致并做增量同步，因此命题错误。",
    difficulty: "medium", tags: ["增量索引", "版本一致"], sourceKey: "microsoft-generative-ai", level: "进阶" }),

  // ===== 6. ai-retrieval-generation（检索与回答生成；归属阶段 ai-foundations） =====
  singleQuestion({ key: "ai-engineering-sup-ai-retrieval-generation-s1", stageKey: "ai-rag", topicKey: "ai-retrieval-generation",
    stem: "在 RAG 中引入查询改写与混合检索，主要目的是什么？",
    options: ["让模型少说话", "提升召回证据质量：用改写对齐用户问题与文档表述，用词加向量组合拓宽覆盖", "完全替代重排步骤", "把对向量索引的依赖降到零"],
    answer: "B",
    explanation: "用户问题的措辞常与文档不同，查询改写可拉近距离；关键词检索擅长精确术语、向量检索擅长语义，混合二者能更稳健地召回证据，再经重排筛选，从而提升最终答案质量，故 B 正确。",
    difficulty: "medium", tags: ["检索", "混合检索"], sourceKey: "microsoft-generative-ai", level: "进阶" }),
  judgeQuestion({ key: "ai-engineering-sup-ai-retrieval-generation-j1", stageKey: "ai-rag", topicKey: "ai-retrieval-generation",
    stem: "把所有检索召回的片段不加选择地全部塞进上下文，通常能显著提升答案准确率。",
    answer: false,
    explanation: "盲目塞入全部片段会带来无关噪声、超出上下文预算并稀释关键证据，还可能引入矛盾；应结合召回质量、重排与上下文预算做裁剪，因此该命题错误。",
    difficulty: "easy", tags: ["上下文组装", "噪声"], sourceKey: "microsoft-generative-ai", level: "入门" }),

  // ===== 7. ai-rag-eval（RAG 评测与失败归因；归属阶段 ai-foundations） =====
  singleQuestion({ key: "ai-engineering-sup-ai-rag-eval-s1", stageKey: "ai-rag", topicKey: "ai-rag-eval",
    stem: "建立 RAG 评测集时，下列哪种做法最能支持失败归因？",
    options: ["只用几条顺利通过的样例判断效果", "覆盖真实问题与困难边界，并分别统计检索失败与生成失败两类原因", "仅用自动评分替代全部人工复核", "每次变更都换一套新题目"],
    answer: "B",
    explanation: "有效的评测集应覆盖真实场景与困难边界，且要把检索失败（召回不到证据）和生成失败（证据在却答错）分开统计，才能定位该改切分、召回还是提示；固定题目保证可比，故 B 正确。",
    difficulty: "medium", tags: ["评测", "失败归因"], sourceKey: "openai-cookbook", level: "进阶" }),
  judgeQuestion({ key: "ai-engineering-sup-ai-rag-eval-j1", stageKey: "ai-rag", topicKey: "ai-rag-eval",
    stem: "RAG 回答错误时，把检索失败和生成失败合并统计成一个总分即可，不需要区分。",
    answer: false,
    explanation: "两类失败的根因与修复手段完全不同：检索失败要改切分、召回、重排，生成失败要改提示与证据组织；混在一起会掩盖问题，无法指导优化，因此必须分开统计，命题错误。",
    difficulty: "medium", tags: ["评测", "归因"], sourceKey: "openai-cookbook", level: "进阶" }),

  // ===== 8. ai-agent（工具调用、Agent 与协议；归属阶段 ai-foundations） =====
  singleQuestion({ key: "ai-engineering-sup-ai-agent-s1", stageKey: "ai-agent", topicKey: "ai-tools",
    stem: "关于 Agent 与单纯调用一次模型的区别，下列说法正确的是哪一项？",
    options: ["Agent 只是把提示写得更长的一次性调用", "Agent 能根据环境反馈决定下一步动作，可调用工具、循环决策直到达成目标或终止", "Agent 不需要任何终止条件也能安全运行", "Agent 不能访问外部工具，只能生成文本"],
    answer: "B",
    explanation: "Agent 的核心是在“观察—思考—行动”的循环中使用工具与外部交互，并根据结果决定后续步骤，直到完成任务或触发预算上限；它需要明确的终止条件以防失控，故选 B。",
    difficulty: "easy", tags: ["Agent", "工具调用"], sourceKey: "langgraph", level: "入门" }),
  judgeQuestion({ key: "ai-engineering-sup-ai-agent-j1", stageKey: "ai-agent", topicKey: "ai-tools",
    stem: "让大模型直接拼接并执行用户输入的 SQL 或 Shell 命令是安全的，只要提示里写了“请小心”。",
    answer: false,
    explanation: "不可信输入拼接进可执行命令会带来注入与越权风险；提示不是安全边界，必须在工具侧做参数校验、权限隔离和必要的人工确认，因此该做法不安全，命题错误。",
    difficulty: "medium", tags: ["安全", "注入"], sourceKey: "langgraph", level: "进阶" }),

  // ===== 9. ai-tools（工具与函数调用；归属阶段 ai-foundations） =====
  singleQuestion({ key: "ai-engineering-sup-ai-tools-s1", stageKey: "ai-agent", topicKey: "ai-tools",
    stem: "工具（function calling）调用的参数为什么必须在执行前校验？",
    options: ["为了增加动画效果", "模型生成的参数不可信，必须校验类型、范围、资源与权限，防止非法或越权操作", "为了让输出更短", "模型参数总是正确的，校验只是形式"],
    answer: "B",
    explanation: "模型可能产出类型错误、越界或越权的参数，工具是通往外部系统的边界；执行前校验能拦截非法输入、限制资源范围并要求高风险动作授权，把不确定性挡在系统之外，故 B 正确。",
    difficulty: "easy", tags: ["工具调用", "参数校验"], sourceKey: "openai-cookbook", level: "入门" }),
  judgeQuestion({ key: "ai-engineering-sup-ai-tools-j1", stageKey: "ai-agent", topicKey: "ai-tools",
    stem: "为只读查询工具和需确认的写操作工具设置统一的权限与确认策略即可，无需区分。",
    answer: false,
    explanation: "只读查询与会改变状态的写操作风险等级不同：写操作应要求显式授权与人工确认，并提供幂等键防重复副作用；统一策略会要么过度阻塞、要么放任越权，故命题错误。",
    difficulty: "medium", tags: ["权限", "幂等"], sourceKey: "openai-cookbook", level: "进阶" }),

  // ===== 10. ai-agent-loop（Agent 循环与状态；归属阶段 ai-foundations） =====
  singleQuestion({ key: "ai-engineering-sup-ai-agent-loop-s1", stageKey: "ai-agent", topicKey: "ai-agent-loop",
    stem: "有状态 Agent 适合用什么方式实现暂停、恢复与审计？",
    options: ["只把中间状态存在进程内存里", "把状态设计为可序列化，并在关键节点写检查点", "每次出错都直接重启整个服务", "关闭所有日志以保证性能"],
    answer: "B",
    explanation: "可序列化状态加检查点，使流程能在任意节点暂停、恢复、回放与审计，也便于崩溃后从最近节点重启而非从头再来；仅存内存会丢失且无法跨进程恢复，故 B 正确。",
    difficulty: "medium", tags: ["状态", "检查点"], sourceKey: "langgraph", level: "进阶" }),
  judgeQuestion({ key: "ai-engineering-sup-ai-agent-loop-j1", stageKey: "ai-agent", topicKey: "ai-agent-loop",
    stem: "Agent 循环可以不设置最大步数、超时或成本预算，因为模型总会自己停下来。",
    answer: false,
    explanation: "模型可能因错误规划、工具故障或循环依赖而不停调用，导致成本失控或资源耗尽；必须设置最大步数、超时或成本预算等终止条件来兜底，因此命题错误。",
    difficulty: "easy", tags: ["循环", "终止条件"], sourceKey: "langgraph", level: "入门" }),

  // ===== 11. ai-multi-agent（多 Agent 与协议；归属阶段 ai-foundations） =====
  singleQuestion({ key: "ai-engineering-sup-ai-multi-agent-s1", stageKey: "ai-agent", topicKey: "ai-multi-agent",
    stem: "什么情况下适合把一个 Agent 拆成多个 Agent？",
    options: ["只要能多创建几个角色就显得更高级", "存在明确的能力、权限或审校分工，且单 Agent 已到达复杂度或隔离边界", "为了让日志更长更详细", "为了减少测试用例"],
    answer: "B",
    explanation: "多 Agent 的价值来自清晰分工：不同能力、不同权限或需要独立审校的角色各自负责一块，并通过协议协作；若单 Agent 已能胜任，强行拆分只会增加通信与调试成本，故 B 正确。",
    difficulty: "medium", tags: ["多Agent", "架构"], sourceKey: "langgraph", level: "进阶" }),
  judgeQuestion({ key: "ai-engineering-sup-ai-multi-agent-j1", stageKey: "ai-agent", topicKey: "ai-multi-agent",
    stem: "多个 Agent 可以无限制地共享同一个写操作工具，由它们自己协调不会出问题。",
    answer: false,
    explanation: "多 Agent 共享写工具容易重复执行、相互覆盖或产生竞态；应通过协议、权限与幂等约束明确谁在何时能调用，并限制共享工具范围，因此命题错误。",
    difficulty: "medium", tags: ["协作", "竞态"], sourceKey: "langgraph", level: "进阶" }),

  // ===== 12. ai-production（上线、评测、安全与成本；归属阶段 ai-rag） =====
  singleQuestion({ key: "ai-engineering-sup-ai-production-s1", stageKey: "ai-production", topicKey: "ai-observability",
    stem: "把 AI 功能从原型推进到生产环境时，最应先补强的是哪一项？",
    options: ["更多花哨的界面动画", "评测门禁、trace、降级、安全与成本预算等工程化能力", "关闭所有日志以提速", "把全部请求都换成最贵模型"],
    answer: "B",
    explanation: "生产系统要在质量、延迟、成本、错误率之间保持稳定，需要评测门禁防止回归、trace 还原链路、降级保证可用、权限与成本控制保障安全可持续，这些比界面装饰更关键，故 B 正确。",
    difficulty: "medium", tags: ["生产化", "工程化"], sourceKey: "openai-cookbook", level: "进阶" }),
  judgeQuestion({ key: "ai-engineering-sup-ai-production-j1", stageKey: "ai-production", topicKey: "ai-observability",
    stem: "AI 服务上线后无需保留评测集，因为模型发布后效果不会再变化。",
    answer: false,
    explanation: "模型版本、提示、检索策略与数据源都会变化，效果可能悄然退化；保留固定评测集并定期回归，才能在发布前或上线后及时发现质量下滑，因此命题错误。",
    difficulty: "easy", tags: ["回归", "评测集"], sourceKey: "openai-cookbook", level: "入门" }),

  // ===== 13. ai-observability（可观测性与评测门禁；归属阶段 ai-rag） =====
  singleQuestion({ key: "ai-engineering-sup-ai-observability-s1", stageKey: "ai-production", topicKey: "ai-observability",
    stem: "AI 请求 trace 最应该串起哪些信息？",
    options: ["只记录最终输出文本即可", "模型版本、Prompt、检索片段、工具调用、成本与结果，以还原完整链路", "只记录用户头像与按钮颜色", "只记录响应延迟的平均值"],
    answer: "B",
    explanation: "完整 trace 记录请求所用的模型版本、提示、检索证据、工具调用与成本，才能在线下还原一次回答的数据与计算路径，支撑排障、评测与成本归因；只看平均延迟或最终文本会丢失关键上下文，故 B 正确。",
    difficulty: "medium", tags: ["可观测性", "trace"], sourceKey: "openai-cookbook", level: "进阶" }),
  judgeQuestion({ key: "ai-engineering-sup-ai-observability-j1", stageKey: "ai-production", topicKey: "ai-observability",
    stem: "只看平均延迟就能充分判断 AI 服务性能，分位数和错误率不重要。",
    answer: false,
    explanation: "平均延迟会掩盖长尾卡顿，P95/P99 分位数与错误率才能反映真实用户体验与稳定性；线上问题常出现在少数慢请求上，因此只看平均值是危险的，命题错误。",
    difficulty: "medium", tags: ["延迟", "分位数"], sourceKey: "openai-cookbook", level: "进阶" }),

  // ===== 14. ai-safety（安全、权限与内容边界；归属阶段 ai-rag） =====
  singleQuestion({ key: "ai-engineering-sup-ai-safety-s1", stageKey: "ai-production", topicKey: "ai-safety",
    stem: "关于提示注入（prompt injection）防御，下列说法正确的是哪一项？",
    options: ["在系统提示里写“不要执行恶意指令”就能彻底防止注入", "不可信内容不能获得系统指令级权限，安全控制应放在可执行边界做校验", "把用户上传文档直接拼接进系统提示是最省事且安全的做法", "依赖模型自己判断是否会越权即可"],
    answer: "B",
    explanation: "提示不是安全边界，攻击者可通过检索内容或用户输入注入指令；必须把不可信内容当作数据而非指令，并在工具参数、数据访问与输出环节做独立校验与最小权限控制，故 B 正确。",
    difficulty: "medium", tags: ["提示注入", "最小权限"], sourceKey: "microsoft-generative-ai", level: "进阶" }),
  judgeQuestion({ key: "ai-engineering-sup-ai-safety-j1", stageKey: "ai-production", topicKey: "ai-safety",
    stem: "只要系统提示写明了“不要泄露数据”，就不需要对工具调用做权限控制。",
    answer: false,
    explanation: "模型可能被注入或误导而尝试越权，提示无法强制约束行为；权限、参数校验、数据隔离与人工确认必须在工具侧强制执行，所以仅靠提示并不安全，命题错误。",
    difficulty: "easy", tags: ["安全", "权限控制"], sourceKey: "microsoft-generative-ai", level: "入门" }),

  // ===== 15. ai-cost-reliability（成本、可靠性与治理；归属阶段 ai-rag） =====
  singleQuestion({ key: "ai-engineering-sup-ai-cost-reliability-s1", stageKey: "ai-production", topicKey: "ai-cost-reliability",
    stem: "控制 AI 应用成本最合理的思路是哪一项？",
    options: ["所有请求都用最大、最贵模型以保证质量", "按任务价值与风险分层，用模型路由、缓存和降级在质量与成本间平衡", "关闭所有监控以省开销", "删除缓存让每次都重新计算"],
    answer: "B",
    explanation: "不同任务对能力与成本的敏感度不同：简单高频问题可用小模型与缓存，关键任务才用强模型；模型路由、缓存与降级共同构成成本治理，比无差别使用最贵模型更可持续，故 B 正确。",
    difficulty: "medium", tags: ["成本", "模型路由"], sourceKey: "openai-cookbook", level: "进阶" }),
  judgeQuestion({ key: "ai-engineering-sup-ai-cost-reliability-j1", stageKey: "ai-production", topicKey: "ai-cost-reliability",
    stem: "在依赖故障或高峰流量时，AI 服务设置限流、超时、缓存降级和人工接管是浪费资源。",
    answer: false,
    explanation: "限流与超时防止雪崩，缓存降级在依赖异常时仍能提供基本可用答案，人工接管兜底复杂失败；这些是可靠系统的必要设计，能避免整体不可用，因此命题错误。",
    difficulty: "medium", tags: ["可靠性", "降级"], sourceKey: "openai-cookbook", level: "进阶" }),
];
