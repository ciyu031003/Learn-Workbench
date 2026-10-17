/**
 * AI 应用工程 · 知识点扩容（2026-10-17）。
 *
 * 与 topic-expansion-backend-engineering.ts 同款结构：一条 expansion = 1 个知识点 + 2 道配套题。
 * 本次新增 6 个知识点，分布在既有三个阶段：ai-foundations / ai-rag / ai-production。
 * 主题覆盖向量索引、结构化输出、父子块切分、幻觉与引用、自动评测回归、延迟与成本。
 */
import type { TopicExpansion } from "./topic-expansions";

export const aiEngineeringTopicExpansions: TopicExpansion[] = [
  {
    trackSlug: "ai-engineering",
    stageKey: "ai-foundations",
    topic: {
      key: "ai-ann-vector-index",
      title: "向量索引与近似最近邻",
      summary: "全量向量逐一比对是线性复杂度，向量规模一上来就撑不住；HNSW 与 IVF 这类近似最近邻索引用可控的召回损失换回毫秒级检索，而参数怎么调决定了你落在召回率、延迟与内存的哪一点上。",
      concepts: [
        "近似最近邻",
        "HNSW 分层图",
        "IVF 倒排与量化",
        "召回率与延迟的权衡",
      ],
      principles: [
        "精确最近邻必须与库中每条向量逐一计算距离，成本随规模线性上升，生产检索无法接受。",
        "近似索引先用图或聚类把候选范围缩小，再在候选里做精确比较，用有界的召回损失换取数量级的延迟下降。",
        "索引参数直接决定召回率、延迟与内存的落点：HNSW 看 M 与 efSearch，IVF 看 nlist 与 nprobe。",
        "归一化与距离度量必须与嵌入模型的训练口径一致，口径错位不会报错，只会安静地把排序质量拉低。",
      ],
      applications: [
        "百万级知识库的语义召回层：先用近似检索取回几十条候选，再交给重排模型精排。",
        "相似工单去重、以图搜图等要求毫秒级返回的在线检索场景。",
      ],
      pitfalls: [
        "直接沿用默认参数上线，从不测 recall@k，漏召回被误判成嵌入模型不行。",
        "向量没有做归一化就用内积检索，模长差异混进排序，结果与余弦排序不一致。",
        "写入删除频繁却不重建索引，墓碑标记越积越多，召回与延迟一起变差。",
      ],
      method: "先固定距离度量与归一化口径，再用标注查询跑出召回率与延迟的对应曲线，按业务能接受的召回损失选定索引参数，并留一个可在线调整的开关。",
      exercise: "对十万条向量分别跑暴力检索与 HNSW 检索同一批查询，输出 recall@10 与 p95 延迟的对照表，并解释拐点出现在哪里。",
      checkpoint: "能说清 efSearch 调大之后召回率、延迟、内存分别怎么变，并能用实测曲线支撑线上的默认取值。",
      lesson: {
        overview: [
          "向量检索最朴素的做法，是把查询向量与库里的每一条向量都算一次距离，再取最近的几条。数据量上万之后这条路的成本就开始咬人：一次查询要遍历全库，延迟随规模线性上涨，加机器也只是把曲线整体往下挪一点。近似最近邻换了个思路，先想办法把候选范围缩小，只在小范围里做精确比较，用一点召回损失换回数量级的延迟下降。",
          "工程上最常见的是两类结构：基于图的 HNSW 和基于聚类的 IVF。它们都不是某一个固定的算法，而是一组可以拧的旋钮，旋钮的位置决定了你在召回率、延迟和内存之间落在哪一点。不理解这些旋钮，就只能照抄默认参数，然后在上线之后靠玄学调参和背锅过日子。",
          "评估向量索引不要只看延迟。真正的判据是同一批标注查询下，近似检索的结果与暴力检索结果的交集比例，也就是 recall@k。延迟降下来了但 recall 从零点九五掉到零点六，用户体验是断崖式的，而你从监控面板上只会看到一切正常。",
        ],
        mechanism: [
          "HNSW 把向量组织成多层可导航的小世界图：上层稀疏，负责长距离跳跃；底层稠密，负责精确定位。查询从顶层入口点出发，每一层都贪心地走向离查询更近的邻居，逐层下降到底层，最后在底层做一次受限的候选扩展，取距离最近的 k 条作为结果。",
          "M 控制每个节点保留的连边数，efConstruction 控制建索引时的候选队列长度，efSearch 控制查询时的候选队列长度。M 越大图越稠，召回越高，但内存占用与建索引时间一起上升；efSearch 调大则召回上升、延迟上升，是上线后最常用的实时旋钮。",
          "IVF 先用聚类把向量分成 nlist 个簇，查询时只扫距离最近的 nprobe 个簇。nprobe 就是它的召回与延迟旋钮：取一很快但容易漏掉隔壁簇里的真正近邻，取到 nlist 就退化成了暴力检索。IVF 通常再配合乘积量化压缩向量，进一步省内存，代价是距离估计带误差。",
          "距离度量必须与嵌入模型保持一致。多数文本嵌入按余弦相似度训练，若要使用内积检索，先把向量做 L2 归一化，否则向量模长会污染排序。归一化写错是召回率异常最常见的原因之一，它不抛异常、不报错，只是让检索结果安静地变差。",
        ],
        example: {
          title: "用 HNSW 起一个可调召回的检索器",
          language: "python",
          code: "import numpy as np\n\ndef normalize(mat: np.ndarray) -> np.ndarray:\n    norms = np.linalg.norm(mat, axis=1, keepdims=True)\n    return mat / np.clip(norms, 1e-12, None)\n\ndef ann_search(vectors, queries, k=10, ef_search=64):\n    import hnswlib\n\n    index = hnswlib.Index(space='cosine', dim=vectors.shape[1])\n    index.init_index(max_elements=len(vectors), ef_construction=200, M=16)\n    index.add_items(normalize(vectors), np.arange(len(vectors)))\n    index.set_ef(ef_search)\n    labels, distances = index.knn_query(normalize(queries), k=k)\n    return labels, distances\n\ndef recall_at_k(ann_labels, exact_labels):\n    hits = 0\n    total = 0\n    for ann, exact in zip(ann_labels, exact_labels):\n        hits += len(set(ann.tolist()) & set(exact.tolist()))\n        total += len(exact)\n    return hits / total",
          explanation: "先把向量做 L2 归一化，再用 cosine 空间建 HNSW：M 与 ef_construction 决定图的质量，set_ef 决定查询时探多深。最后用同一批查询和暴力检索结果对比，算出 recall@k。没有这条对照，你无法知道自己为了延迟到底牺牲了多少召回。",
        },
        practiceSteps: [
          "取五万到五十万条真实数据先跑暴力检索，得到精确的 Top k 作为基线。",
          "用同一批查询跑近似检索，逐步调大 efSearch，记录 recall@k 与 p95 延迟的对应点。",
          "把曲线拐点作为线上默认值，并留一个可在故障时临时调大的配置开关。",
          "写入删除频繁时检查索引是否需要定期重建，以及删除是否只是打了墓碑标记。",
        ],
        masteryChecklist: [
          "能解释 HNSW 的 M、efConstruction、efSearch 各自影响什么。",
          "能说出归一化与距离度量口径不一致为什么会安静地降低召回。",
          "能用 recall@k 与 p95 延迟两个指标说明一次调参的得失。",
        ],
        summary: [
          "精确最近邻是线性复杂度，生产检索用近似索引换延迟。",
          "HNSW 靠多层图逐层下降，efSearch 是线上最常用的召回旋钮。",
          "IVF 靠聚类缩小扫描范围，nprobe 是它的等价旋钮。",
          "距离度量与归一化必须与嵌入模型口径一致。",
          "索引好不好要用 recall@k 的实测值判断，不能只看延迟。",
        ],
        terms: [
          {
            term: "近似最近邻（ANN）",
            plain: "不保证找到最像的，但保证很快找到足够像的几个。",
            detail: "它的价值在于把线性扫描降成亚线性。代价是召回率不再等于一，所以必须实测 recall@k，用业务能接受的范围来定参数，而不是拍一个数字。",
          },
          {
            term: "HNSW",
            plain: "把向量连成多层网络，查询时一层层往下找最近的点。",
            detail: "上层跳得远、下层找得准。M 决定每个点连几条边，efSearch 决定查询时看多少个候选，后者可以直接在线调整，适合作为应急旋钮。",
          },
          {
            term: "recall@k",
            plain: "近似检索的结果里，有多少条确实出现在精确结果的前 k 名中。",
            detail: "这是衡量近似索引值不值得的唯一硬指标。只测延迟会得到错误结论：把参数调到极小也能很快，但召回可能已经崩了。",
          },
          {
            term: "IVF",
            plain: "先把向量分堆，查询时只翻最像的那几堆。",
            detail: "分堆数 nlist 与查询时翻的堆数 nprobe 决定精度与速度。常配合乘积量化压缩向量，用一点距离误差换内存。",
          },
        ],
      },
    },
    questions: [
      {
        key: "ai-engineering-exp-ai-ann-vector-index-s1",
        stageKey: "ai-foundations",
        topicKey: "ai-ann-vector-index",
        type: "single",
        stem: "关于 HNSW 索引的 efSearch 参数，下面哪一项描述是准确的？",
        options: [
          {
            key: "A",
            text: "调大 efSearch 会提升召回率，同时增加查询延迟",
          },
          {
            key: "B",
            text: "调大 efSearch 只会降低内存占用，对召回没有影响",
          },
          {
            key: "C",
            text: "efSearch 决定建索引时每个节点保留几条连边",
          },
          {
            key: "D",
            text: "efSearch 越小，检索结果越接近暴力检索",
          },
        ],
        answer: [
          "A",
        ],
        explanation: "efSearch 是查询阶段的候选队列长度：队列越长，越有机会在图里绕到真正的近邻，召回率上升，但比较次数变多、延迟随之上升。它不影响建索引，那是 efConstruction 的职责；也不决定连边数，那是 M。把它调小只会让搜索更早停止，召回更低，而不是更接近暴力检索。",
        difficulty: "medium",
        tags: [
          "向量检索",
          "HNSW",
          "近似最近邻",
        ],
        sourceKey: "openai-cookbook",
        level: "进阶",
      },
      {
        key: "ai-engineering-exp-ai-ann-vector-index-j1",
        stageKey: "ai-foundations",
        topicKey: "ai-ann-vector-index",
        type: "judge",
        stem: "把按余弦相似度训练的嵌入向量直接用于内积检索、不做归一化，排序结果与余弦排序完全一致。",
        options: [
          {
            key: "A",
            text: "正确",
          },
          {
            key: "B",
            text: "错误",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "内积等于余弦相似度乘以两个向量的模长，模长不同就会把长度差异混进排序，结果与纯余弦排序不一致。只有当所有向量都被归一化到单位长度时两者才等价。工程上最稳的做法是入库与查询统一走同一套归一化，并把距离度量固定成余弦。",
        difficulty: "hard",
        tags: [
          "embedding",
          "归一化",
          "相似度",
        ],
        sourceKey: "openai-cookbook",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "ai-engineering",
    stageKey: "ai-foundations",
    topic: {
      key: "ai-structured-output-repair",
      title: "结构化输出的约束与修复",
      summary: "让模型稳定吐出可解析的结构，靠的不是反复叮嘱，而是 Schema 约束、失败分类与有限次修复重试组成的闭环，以及一条解析彻底失败时的降级出口。",
      concepts: [
        "JSON Schema",
        "约束解码",
        "失败分类",
        "修复重试",
      ],
      principles: [
        "结构化输出是契约问题：先定 Schema，再让模型填充，最后用同一份 Schema 校验，三方口径必须同源。",
        "失败要分类处理：截断、非 JSON、Schema 不符、语义不合法，这四类的修复手段完全不同。",
        "修复重试必须有限次，并且把具体错误回灌给模型，否则只是重掷一次骰子还多付一次钱。",
        "校验失败时的降级路径要在设计阶段就定好，别让坏输入变成线上未捕获的异常。",
      ],
      applications: [
        "工单分类与信息抽取服务，把自由文本转成固定字段供下游消费。",
        "模型输出直接接入建单、写库、调工具之前的那一层把关校验。",
      ],
      pitfalls: [
        "只在提示里写一句请返回 JSON，运行时不做任何解析校验。",
        "解析失败就无限重试，同一条坏输入把预算烧光。",
        "用宽松正则截取大括号，把嵌套结构截成看似合法的半截数据。",
      ],
      method: "先定 Schema 与枚举，再实现解析、校验、错误归类、带错误重试与降级五段管线，并为每一类失败单独打点统计。",
      exercise: "为工单抽取实现三层管线：Schema 校验、按错误类别重试、失败转人工队列，并统计各类错误在样本中的占比。",
      checkpoint: "任何一个非法输出都会被拦截，且能从日志看出失败属于哪一类、重试了几次、最终走了哪条降级路径。",
      lesson: {
        overview: [
          "结构化输出的目标不是让模型看起来像 JSON，而是让下游程序能安全地把它当数据用。这意味着三件事必须对齐：你要求的 Schema、模型实际返回的内容、以及你在代码里做的校验。三者只要有一处松动，线上就会出现解析异常，或者更糟，出现不报错但字段错位的静默故障。",
          "很多团队止步于在提示里加一句请只返回 JSON。这句话能提高格式正确的概率，但概率不是契约。只要有一次返回带了解释性前后缀、被长度截断、或者给枚举编了一个新词，解析就会失败。工程上要假设失败一定发生，并提前设计好它发生时的路径。",
          "还有一层容易漏掉：格式对了不等于内容对。字段齐全、类型正确的 JSON，里面的值仍然可能是模型猜的。所以校验要分两级，一级管结构，一级管业务语义，比如金额必须为正、日期必须在有效区间、枚举值必须在白名单里，引用必须指向真实存在的片段。",
        ],
        mechanism: [
          "约束解码在采样阶段就把不符合语法的 token 概率压到零，让输出在语法层面必然符合 Schema。它对格式类错误非常有效，但管不了语义：字段齐全、类型正确，值仍然可能是编的。所以它是必要手段，不是充分手段。",
          "没有约束解码时，靠解析加校验：先用严格解析器读成对象而不是用正则拼凑，再按 Schema 检查必填、类型、枚举与范围，任何一步失败都归入具体的错误类别，供后续决定怎么修。",
          "修复重试的价值全在错误信息上：要告诉模型第几个字段缺失、枚举允许哪些值、输出在什么位置被截断。不带具体错误的原样重试，等于让模型用完全相同的输入再掷一次骰子，成功率提升有限，成本却照付。",
          "重试要有上限。常见做法是两次修复后仍然失败就降级：写入人工队列，或者返回一个显式的不可用状态，让上层决定怎么处理。最差的做法是把异常直接抛出去，让一次格式抖动变成整条链路报错。",
        ],
        example: {
          title: "解析、校验、分类重试的闭环",
          language: "typescript",
          code: "type Call = (input: string, feedback: string) => Promise<string>;\n\ntype Failure = 'truncated' | 'invalid_json' | 'schema';\n\nfunction parseAndValidate(raw: string, isValid: (value: unknown) => boolean) {\n  const text = raw.trim();\n  if (!text.endsWith('}') && !text.endsWith(']')) {\n    return { ok: false as const, kind: 'truncated' as Failure };\n  }\n  let data: unknown;\n  try {\n    data = JSON.parse(text);\n  } catch {\n    return { ok: false as const, kind: 'invalid_json' as Failure };\n  }\n  if (!isValid(data)) return { ok: false as const, kind: 'schema' as Failure };\n  return { ok: true as const, data };\n}\n\nasync function extractWithRepair(\n  input: string,\n  callModel: Call,\n  isValid: (value: unknown) => boolean,\n) {\n  let feedback = '';\n  for (let attempt = 0; attempt < 3; attempt += 1) {\n    const raw = await callModel(input, feedback);\n    const parsed = parseAndValidate(raw, isValid);\n    if (parsed.ok) return parsed.data;\n    if (parsed.kind === 'truncated') {\n      feedback = 'output was cut off, keep the whole object under 300 tokens';\n    } else if (parsed.kind === 'invalid_json') {\n      feedback = 'return raw JSON only, no prose before or after';\n    } else {\n      feedback = 'some fields violate the schema, fix types and enum values';\n    }\n  }\n  return null;\n}",
          explanation: "先把失败分成截断、非 JSON、Schema 不符三类，每一类给出不同的修复指令，而不是笼统地让它再试一次。循环最多跑三轮，耗尽后返回 null 交给上层降级，避免坏输入反复烧钱。失败分类同时是排障信息：哪一类占比最高，就该改提示还是改 Schema 一目了然。",
        },
        practiceSteps: [
          "用 Schema 定义字段、类型、枚举与必填项，并让提示和运行时校验共用同一份定义。",
          "把解析失败按截断、非 JSON、Schema 不符、语义不合法四类分别打点。",
          "为每一类失败写一句具体的修复指令，带进下一轮请求。",
          "设定最大重试次数与预算，并为耗尽的情况准备人工队列或显式不可用状态。",
        ],
        masteryChecklist: [
          "能说明约束解码能解决哪类错误、为什么不能解决语义错误。",
          "能画出一个带错误分类和降级出口的重试流程。",
        ],
        summary: [
          "结构化输出是契约：提示、Schema、校验必须同源。",
          "约束解码管语法，管不了字段值是否真实。",
          "修复重试要带具体错误，并且有次数上限。",
          "一定要有降级路径，别让解析失败变成未捕获异常。",
        ],
        terms: [
          {
            term: "JSON Schema",
            plain: "一份描述数据长什么样的说明书，程序能拿它自动检查。",
            detail: "它同时是提示的一部分和校验的依据。两边用同一份，才不会出现模型按 A 格式返回、程序按 B 格式校验的错位。",
          },
          {
            term: "约束解码（Constrained Decoding）",
            plain: "生成时就把不合法的词挡掉，让输出只能符合格式。",
            detail: "它把格式正确率推到接近一，但字段值仍可能是编的。所以语义校验、范围断言和来源核对一样不能省。",
          },
          {
            term: "修复重试（Repair Retry）",
            plain: "失败了把错在哪告诉模型，让它改一版再交。",
            detail: "关键是把具体错误回灌，比如缺哪个字段、枚举允许哪些值。不带信息的重试只是换一次随机结果。",
          },
        ],
      },
    },
    questions: [
      {
        key: "ai-engineering-exp-ai-structured-output-repair-s1",
        stageKey: "ai-foundations",
        topicKey: "ai-structured-output-repair",
        type: "single",
        stem: "关于约束解码（constrained decoding），下面哪一项判断最准确？",
        options: [
          {
            key: "A",
            text: "它能让输出必然符合给定 Schema，因此不再需要语义校验",
          },
          {
            key: "B",
            text: "它能显著降低格式类错误，但字段值仍可能是编造的，仍需语义校验",
          },
          {
            key: "C",
            text: "它只能用于自然语言输出，不能用于 JSON 这类结构",
          },
          {
            key: "D",
            text: "开启后模型的响应延迟会降到接近零",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "约束解码在采样阶段屏蔽掉不符合语法的 token，所以格式错误率会大幅下降。但它约束的是结构而不是事实：字段齐全、类型正确，值仍然可能来自模型的猜测。因此业务层的语义校验、范围断言与来源核对依然要做，格式正确只是入场券。",
        difficulty: "medium",
        tags: [
          "结构化输出",
          "约束解码",
          "校验",
        ],
        sourceKey: "openai-cookbook",
        level: "进阶",
      },
      {
        key: "ai-engineering-exp-ai-structured-output-repair-j1",
        stageKey: "ai-foundations",
        topicKey: "ai-structured-output-repair",
        type: "judge",
        stem: "解析失败后原样重试、不把具体错误告诉模型，与带上错误信息重试，成功率提升是一样的。",
        options: [
          {
            key: "A",
            text: "正确",
          },
          {
            key: "B",
            text: "错误",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "带上具体错误等于把搜索空间收窄：模型知道是缺字段、类型错还是枚举越界，就能定向修正。原样重试只是重新采样一次，模型拿到完全相同的输入，很可能重复同样的错误，还要再付一次调用费用，是最不划算的修法。",
        difficulty: "medium",
        tags: [
          "修复重试",
          "结构化输出",
          "成本",
        ],
        sourceKey: "openai-cookbook",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "ai-engineering",
    stageKey: "ai-rag",
    topic: {
      key: "ai-parent-child-chunking",
      title: "父子块切分与检索粒度",
      summary: "用小块检索保证命中精度、用大块喂给模型保证上下文完整，父子块把检索粒度与生成粒度解耦，切分从调一个数字变成设计一套结构。",
      concepts: [
        "父子块",
        "切分粒度",
        "重叠窗口",
        "元数据定位",
      ],
      principles: [
        "检索精度与上下文完整性是一对矛盾：块越小向量越聚焦，但可能丢掉论证所需的前后文。",
        "父子块把两者拆开：子块建索引负责匹配，命中后回溯父块或邻域块作为生成上下文。",
        "切分必须尊重文档结构，标题、段落、表格、代码都有天然边界，硬切会制造无法回答的碎片。",
        "每个块都要带来源路径、版本与位置，否则引用、增量更新与删除都无从谈起。",
      ],
      applications: [
        "制度与手册类长文档问答：小块命中具体条款，父块补全适用范围与例外。",
        "技术文档与接口手册检索：按标题层级切分，保留章节路径用于引用。",
      ],
      pitfalls: [
        "只按固定字数切分，把表格或代码块拦腰截断。",
        "块之间不留任何重叠，跨段落的结论在两侧都不完整。",
        "只存子块文本、不存父块指针，命中之后无法还原上下文。",
      ],
      method: "先按文档结构切出父块，再在父块内切子块并记录父子指针，最后用跨段落问题验证命中块能否支撑完整答案。",
      exercise: "为一份带三级标题的 Markdown 文档实现切分器，产出父块与子块两套记录，并验证跨段落问题能回溯到完整上下文。",
      checkpoint: "每个片段都能定位回原文的具体位置，跨段落问题不会因为切分而丢失关键上下文。",
      lesson: {
        overview: [
          "切分决定了检索系统的信息单元。块太大，向量里混了多个主题，相似度被平均掉，命中不再精准；块太小，一句话被切成两半，模型拿到片段也拼不出答案。这是 RAG 里最典型的一对矛盾，靠反复调一个数字是解决不了的，必须从结构上动手。",
          "父子块的做法是把检索单元和生成单元分开：用小块建索引，让向量只表达一个聚焦的语义；命中之后不直接把小块塞给模型，而是顺着指针取回它所属的父块，或者把相邻块一起拼上。这样既保住了匹配精度，又补回了上下文完整性。",
          "结构感知是另一条主线。文档本来就有标题、段落、列表、表格这些边界，按边界切比按字数切更接近人的阅读方式。硬切表格和代码，等于制造了一批永远答不对的片段，而且这种损失在检索指标上看不出来，只有在最终答案里才暴露。",
        ],
        mechanism: [
          "建索引时对每个子块计算向量并写入索引，同时把父块 id、标题路径、原文偏移存进元数据。检索只在子块空间里做，返回的是子块 id 与相似度得分，父块文本不进向量索引。",
          "取上下文时按子块元数据回溯父块：可以用整个父块，也可以用子块前后的邻居窗口。父块越大上下文越全，但 token 成本与无关内容也越多，需要按上下文预算做裁剪与去重。",
          "重叠窗口的作用是防止边界信息丢失：一句话正好跨在两个块的分界上时，两侧各留一部分重叠，至少有一侧能看到完整句子。代价是索引体积变大，同一段内容可能被多个块重复召回。",
          "元数据里的版本与位置不只是给引用用的：文档更新时靠它定位需要删除和重建的块，避免旧内容留在索引里继续被检索到，也避免同一章节出现新旧两个版本同时命中。删除整篇文档时也靠版本号做批量清理，而不是靠标题去猜哪些块该删。",
        ],
        example: {
          title: "按标题切父块，再在父块内切子块",
          language: "python",
          code: "import hashlib\n\ndef split_parents(markdown: str, doc_id: str):\n    parents = []\n    current = {'heading': 'intro', 'text': []}\n    for line in markdown.split('\\n'):\n        if line.startswith('#'):\n            if current['text']:\n                parents.append(current)\n            current = {'heading': line.lstrip('# ').strip(), 'text': []}\n        else:\n            current['text'].append(line)\n    parents.append(current)\n\n    shaped = []\n    for i, parent in enumerate(parents):\n        shaped.append({\n            'parent_id': doc_id + '#p' + str(i),\n            'heading': parent['heading'],\n            'text': '\\n'.join(parent['text']).strip(),\n        })\n    return [item for item in shaped if item['text']]\n\ndef split_children(parent: dict, size: int = 240, overlap: int = 40):\n    text = parent['text']\n    step = max(size - overlap, 1)\n    children = []\n    for offset in range(0, len(text), step):\n        chunk = text[offset:offset + size]\n        if not chunk.strip():\n            continue\n        digest = hashlib.sha1((parent['parent_id'] + ':' + str(offset)).encode())\n        children.append({\n            'chunk_id': digest.hexdigest()[:12],\n            'parent_id': parent['parent_id'],\n            'offset': offset,\n            'text': chunk,\n        })\n    return children",
          explanation: "父块按标题切，天然保留了章节语义；子块在父块内部按固定窗口滑动，并记录 parent_id 与 offset。检索命中子块后，用 parent_id 取回整段章节内容作为生成上下文，引用时还能给出章节名与原文位置。重叠窗口让跨分界的句子至少有一侧是完整的。",
        },
        practiceSteps: [
          "先看文档结构，确定父块的边界规则，例如按几级标题切、表格是否整体保留。",
          "在父块内部切子块，保留 parent_id、offset、标题路径三样元数据。",
          "用一批跨段落问题验证：命中子块回溯父块后，答案所需的上下文是否齐全。",
          "调整块大小与重叠比例，观察召回命中率与上下文 token 成本的变化。",
        ],
        masteryChecklist: [
          "能解释为什么小块检索加父块生成优于单纯调大或调小块。",
          "能为一份真实文档写出可执行的切分规则，并说明每项元数据的用途。",
        ],
        summary: [
          "检索粒度与生成粒度可以分开，父子块就是这种解耦。",
          "小块负责精准匹配，父块负责补全上下文。",
          "按文档结构切，比按字数切更少制造碎片。",
          "元数据里的版本与位置决定了引用与增量更新能否成立。",
        ],
        terms: [
          {
            term: "父子块（Parent-Child Chunking）",
            plain: "用小块去搜，搜到了再把它所在的大块拿给模型看。",
            detail: "索引建在小块上，因为小块语义聚焦、匹配更准；生成时用父块，因为答案往往需要前因后果。两者通过元数据里的父块 id 关联。",
          },
          {
            term: "重叠窗口（Overlap）",
            plain: "相邻两段故意留一点重复，防止一句话被切断。",
            detail: "重叠太小会丢边界信息，太大会让索引膨胀、同一段内容被多次召回。常见做法是块长的百分之十到二十。",
          },
          {
            term: "结构感知切分",
            plain: "按标题、段落这些文档本来就有的边界来切。",
            detail: "固定字数切分会把表格和代码拦腰截断，产生无法回答的碎片。结构感知切分让每个块的语义边界和人的阅读边界一致。",
          },
        ],
      },
    },
    questions: [
      {
        key: "ai-engineering-exp-ai-parent-child-chunking-s1",
        stageKey: "ai-rag",
        topicKey: "ai-parent-child-chunking",
        type: "single",
        stem: "在父子块方案里，为什么通常用子块建向量索引、而用父块作为生成上下文？",
        options: [
          {
            key: "A",
            text: "因为子块更短，能省下嵌入模型的调用费用",
          },
          {
            key: "B",
            text: "因为子块语义聚焦匹配更准，而父块能补全回答所需的上下文",
          },
          {
            key: "C",
            text: "因为父块无法计算向量",
          },
          {
            key: "D",
            text: "因为父块只能用于关键词检索",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "子块长度小、主题单一，向量不会被多个主题平均，检索精度更高；但它可能缺少论证所需的前后文。父块包含完整章节或段落，适合作为生成输入。用父子指针把两者连起来，就能同时拿到匹配精度和上下文完整性，这也是这套方案存在的理由。",
        difficulty: "medium",
        tags: [
          "RAG",
          "切分",
          "父子块",
        ],
        sourceKey: "microsoft-generative-ai",
        level: "进阶",
      },
      {
        key: "ai-engineering-exp-ai-parent-child-chunking-j1",
        stageKey: "ai-rag",
        topicKey: "ai-parent-child-chunking",
        type: "judge",
        stem: "为了提升召回效果，块与块之间的重叠窗口越大越好。",
        options: [
          {
            key: "A",
            text: "正确",
          },
          {
            key: "B",
            text: "错误",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "重叠过大会让索引体积膨胀，同一段内容被多个块重复表达，检索时容易召回一堆高度相似的冗余片段，反而挤掉真正有用的证据。重叠的作用只是兜住边界信息，通常取块长的一小部分即可，还要结合上下文预算一起权衡。",
        difficulty: "medium",
        tags: [
          "切分",
          "重叠窗口",
          "检索",
        ],
        sourceKey: "microsoft-generative-ai",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "ai-engineering",
    stageKey: "ai-rag",
    topic: {
      key: "ai-hallucination-grounding",
      title: "幻觉归因与引用校验",
      summary: "幻觉不是笼统的性格缺陷，而是分层失败：检索没给证据、证据被忽略、证据被过度外推、引用指向错位。分开归因，才谈得上治理。",
      concepts: [
        "幻觉",
        "接地 grounding",
        "断言级校验",
        "拒答",
      ],
      principles: [
        "有证据仍答错和没有证据硬答，是两类完全不同的失败，治理手段也不同。",
        "引用必须可验证：指向具体片段与位置，而不是笼统地说根据相关资料。",
        "允许拒答是降低幻觉成本最低的手段，前提是判据明确并且有兜底出口。",
        "生成后要做接地检查，把回答里的每个断言映射回检索片段，找不到支撑的就标出来。",
      ],
      applications: [
        "政策、法规、医疗类问答：答案必须逐条可追溯到原文条款。",
        "客服与内部助手：区分已知与未知，避免编造流程、价格和时效。",
      ],
      pitfalls: [
        "把幻觉一律归因于模型能力，忽略检索为空或召回错误这两个更常见的原因。",
        "让模型自己生成引用编号，编号与实际片段对不上也没人校验。",
        "靠提高温度或换更大的模型去压幻觉，而不改证据供给。",
      ],
      method: "把回答拆成断言，逐条做证据映射，按无证据、弱证据、矛盾证据三档处理，再统计各档占比定位最该改的环节。",
      exercise: "对五十条真实问答做人工标注：检索是否命中、回答是否有证据支撑、引用位置是否正确，最后给出三类失败的占比。",
      checkpoint: "每条回答都能指出支撑它的片段，或者被明确标为无证据因而拒答，不存在没有依据却正常输出的断言。",
      lesson: {
        overview: [
          "幻觉常被当成模型的一种性格缺陷，实际上它更像一个症状。检索阶段没找到相关文档，模型只能靠参数里的记忆编一个；检索找到了，但关键片段被淹没在几十段文本里，模型忽略了它；证据在，但模型做了超出原文的推断。这三种情况的修法完全不同。",
          "治理幻觉的第一步，是把回答拆成可以单独核查的断言。一个长回答里往往既有扎实的部分，也有编造的部分，整体判它对或错都不提供任何信息量。逐条断言去对照检索到的片段，才能定位到具体哪一句没有依据、需要删掉还是补证。",
          "引用是让用户和开发者共同验证的手段。它必须指向具体的片段与位置，最好能在原文里高亮。如果引用只是模型自己编的编号，那它不但没有帮助，还会制造一种已经被验证过的错觉，比完全没有引用更危险，因为它让读者放弃了继续核查的念头。",
        ],
        mechanism: [
          "接地的本质是把生成约束在给定证据上：提示里明确只允许使用提供的片段，并给出证据不足时的拒答模板。这只是第一层，模型仍可能越界，所以还需要程序侧的检查来兜底，例如逐断言核对与引用绑定。",
          "更硬的一层是生成后的断言级校验：把回答切成句子或断言，逐条与片段做语义匹配，按支持、部分支持、无支持、矛盾四档打分。无支持的断言要么删除，要么标注为未验证，绝不能混在正常结论里一起输出。",
          "引用要做绑定而不是让模型自由发挥：让模型输出片段 id，程序侧校验 id 存在、且该片段确实包含被引用的内容或语义，不通过就重写或降级。编号由模型随手生成、没人核对，是引用错位最常见的成因。",
          "拒答需要产品化：明确什么条件下可以拒答、拒答时给用户什么替代路径，比如换个问法、转人工、列出相关文档。否则团队会因为怕体验变差而不敢开启拒答，最后所有问题都被强行作答，幻觉率反而更高。",
        ],
        example: {
          title: "断言级接地检查",
          language: "python",
          code: "from dataclasses import dataclass\n\n@dataclass\nclass Claim:\n    text: str\n    cited_id: str\n    score: float\n\ndef split_claims(answer: str):\n    buf = answer\n    for mark in ['。', '\\n', '；']:\n        buf = buf.replace(mark, '||')\n    return [part.strip() for part in buf.split('||') if part.strip()]\n\ndef check_grounding(answer: str, passages: dict, embed):\n    vectors = {pid: embed(text) for pid, text in passages.items()}\n    claims = []\n    for sentence in split_claims(answer):\n        vec = embed(sentence)\n        best_id, best_score = '', 0.0\n        for pid, pvec in vectors.items():\n            score = cosine(vec, pvec)\n            if score > best_score:\n                best_id, best_score = pid, score\n        claims.append(Claim(sentence, best_id, round(best_score, 3)))\n    return claims\n\ndef verdict(claim: Claim, threshold: float = 0.72):\n    if claim.score >= threshold:\n        return 'supported'\n    if claim.score >= threshold - 0.12:\n        return 'weak'\n    return 'unsupported'",
          explanation: "把回答拆成句子后逐条与检索片段比对，得到最相近的片段和分数，再按阈值分成支持、弱支持、无支持三档。无支持的断言不该直接展示给用户，应删掉或改成明确的未知；弱支持的可以让模型补一句限定语，或转人工确认。",
        },
        practiceSteps: [
          "从线上日志抽五十条回答，人工标出每条回答里哪些断言有原文支撑。",
          "按无证据、证据被忽略、过度推断、引用错位四类给失败打标签。",
          "针对占比最高的那一类做改造，再用同一批样本跑一遍对比。",
          "为无证据的情况设计拒答与替代路径，并验证用户不会卡在死胡同里。",
        ],
        masteryChecklist: [
          "能把一次答错拆解到检索、证据选择、生成、引用这四个环节。",
          "能设计一条断言级接地检查，并说明阈值该怎么定。",
        ],
        summary: [
          "幻觉是症状不是病因，必须分层归因。",
          "断言级检查比整段对错判断更有信息量。",
          "引用要绑定真实片段，并由程序校验。",
          "拒答是合法输出，前提是有明确判据和出口。",
        ],
        terms: [
          {
            term: "幻觉（Hallucination）",
            plain: "模型一本正经地说了一件没有依据的事。",
            detail: "它常来自证据缺失、证据被忽略或过度推断。把这三者混在一起谈，就永远只能得出换个更大模型这种结论，而改不到真正的病根。",
          },
          {
            term: "接地（Grounding）",
            plain: "让回答扎根在检索到的原文上，而不是凭记忆编。",
            detail: "做法包括提示里限定只用给定片段、生成后逐断言核对、以及证据不足时拒答。提示只是第一层，程序校验才是硬约束。",
          },
          {
            term: "断言级校验",
            plain: "把回答拆成一句句，逐句看有没有原文支撑。",
            detail: "整段回答对错是模糊判断，逐句核对才能定位到具体哪一句没有依据，也才能决定是删掉、改写还是标注。",
          },
        ],
      },
    },
    questions: [
      {
        key: "ai-engineering-exp-ai-hallucination-grounding-s1",
        stageKey: "ai-rag",
        topicKey: "ai-hallucination-grounding",
        type: "single",
        stem: "下面哪种做法最能有效降低引用错位这类问题？",
        options: [
          {
            key: "A",
            text: "调高温度，让模型的表达更自然",
          },
          {
            key: "B",
            text: "让模型输出片段 id，并在程序侧校验该 id 存在且内容确实支撑该断言",
          },
          {
            key: "C",
            text: "在提示里多写几遍请务必准确引用来源",
          },
          {
            key: "D",
            text: "把回答长度限制在一句话以内",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "引用错位属于可以程序化校验的失败：只要引用是结构化的片段 id，就能检查 id 是否存在、片段是否真的包含对应内容。反复叮嘱只是提高概率，温度调高反而增加随机性，把回答缩短则是在回避问题而不是解决问题。",
        difficulty: "medium",
        tags: [
          "引用",
          "接地",
          "校验",
        ],
        sourceKey: "microsoft-generative-ai",
        level: "进阶",
      },
      {
        key: "ai-engineering-exp-ai-hallucination-grounding-j1",
        stageKey: "ai-rag",
        topicKey: "ai-hallucination-grounding",
        type: "judge",
        stem: "只要检索阶段命中了正确的文档，模型就不会再产生幻觉。",
        options: [
          {
            key: "A",
            text: "正确",
          },
          {
            key: "B",
            text: "错误",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "检索命中只是必要条件。片段可能被淹没在过长的上下文里而没被使用，模型也可能做出超出原文的推断，或者把引用指向别的片段。所以还需要生成后的断言级接地检查与引用校验，才能挡住有证据仍然答错这一类失败。",
        difficulty: "medium",
        tags: [
          "幻觉",
          "检索",
          "评测",
        ],
        sourceKey: "microsoft-generative-ai",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "ai-engineering",
    stageKey: "ai-production",
    topic: {
      key: "ai-judge-regression",
      title: "自动评测与回归基线",
      summary: "用模型当评委能把评测规模化，但评委本身也会漂移；只有把样本、评分规则和评委版本一起冻结，分数变化才解释得清，回归才拦得住退步。",
      concepts: [
        "评测集",
        "LLM 评委",
        "评分口径",
        "回归基线",
      ],
      principles: [
        "没有固定的样本与固定的口径，任何分数变化都无法归因，评测也就失去了意义。",
        "评委输出必须结构化：分数加理由，理由用于抽检与修规则，分数用于统计与门禁。",
        "自动评分只做筛选，关键结论仍要人工抽检校准，一致率是评委可信度的直接指标。",
        "回归要区分真实下降与样本波动，样本量太小时，小差异在统计上没有意义。",
      ],
      applications: [
        "每次提示词或模型版本变更后跑同一批样本，比较通过率与失败样本清单。",
        "对开放式回答做批量初筛，把可疑样本按优先级送人工复核。",
      ],
      pitfalls: [
        "同时更换样本、规则和评委模型，最后说不清变化来自哪里。",
        "只看平均分不看分布，把一条严重错误平均成一堆正常回答。",
        "让评委看到参考答案或候选的顺序，产生位置偏好和长度偏好。",
      ],
      method: "先冻结评测集与评分规则，再用人工标注校准评委，最后把通过率、失败样本清单与样本量一起纳入发布门禁。",
      exercise: "为四十条问答建立评分规则，用人工标注校准一个模型评委，报告两者的一致率以及全部分歧样本。",
      checkpoint: "能说明一次回归里哪些变化来自真实质量，哪些可能只是评委或样本带来的噪声。",
      lesson: {
        overview: [
          "自动评测的价值在于可重复。人工评估一次二十条还行，上百条、每次改动都跑，就不现实了。用模型当评委能把评估规模化，但它带来一个新问题：评委自己也是个概率模型，它的判断会漂移，也会被提示措辞和选项顺序影响。",
          "所以评测系统的核心不是评委多聪明，而是口径多稳定。同一批样本、同一份评分规则、同一个评委版本，跑出来的分数才有可比性。任何一项变了，前后两次的差值就不再是质量变化，而是系统变化，你也就失去了定位问题的线索。",
          "回归的意义在于拦住退步。发布门禁要能回答一个具体问题：这次改动让通过率掉了多少，掉的是哪一类题目。只报一个平均分，等于把最有用的信息全部丢掉，剩下的数字看起来很精确，实际上无法指导任何决策，也没法说服别人接受这次改动。",
        ],
        mechanism: [
          "评测集要覆盖真实分布：常见问题、边界问题、以及历史上出过错的困难样本。样本进集时要固定版本，改动样本等于换了一把尺子，之前的分数立刻失去参照。所以样本集的变更本身也要走评审，并保留旧版本快照用于回溯。",
          "评分口径要写成可执行的规则：几档、每档的判据、什么算严重错误。开放式任务常用分项打分，把正确性、完整性、引用分开评，比一个笼统的总分稳定得多，也更容易定位是哪一项退步了。",
          "评委校准靠一致率：抽一批样本同时做人工标注和模型评分，算两者一致的比例，再逐个看分歧样本。一致率过低通常说明规则写得模糊，先把判据写清楚，往往比换一个更大的评委模型更有效。",
          "统计上要谨慎：四十条样本上两个百分点的差异基本是噪声。报告时应给出样本量与置信区间，或者直接给绝对条数，比如四十条里错了三条，这比百分比更难被误读，也更能推动决策。",
        ],
        example: {
          title: "固定口径的批量评测与回归对比",
          language: "python",
          code: "import json\nfrom statistics import mean\n\nRUBRIC = (\n    'Score 1-5 on correctness only. 5 means every claim is supported by the '\n    'reference; 3 means the main point is right but one detail is wrong; '\n    '1 means the answer contradicts the reference. '\n    'Reply as JSON with keys score and reason.'\n)\n\ndef run_eval(cases, generate, judge):\n    rows = []\n    for case in cases:\n        answer = generate(case['question'])\n        raw = judge(RUBRIC, case['reference'], answer)\n        verdict = json.loads(raw)\n        rows.append({\n            'id': case['id'],\n            'score': int(verdict['score']),\n            'reason': verdict['reason'],\n            'answer': answer,\n        })\n    return rows\n\ndef compare(baseline, candidate, threshold=0.2):\n    base = mean(row['score'] for row in baseline)\n    cand = mean(row['score'] for row in candidate)\n    failing = [row['id'] for row in candidate if row['score'] <= 3]\n    return {\n        'baseline_mean': round(base, 3),\n        'candidate_mean': round(cand, 3),\n        'delta': round(cand - base, 3),\n        'regressed': cand < base - threshold,\n        'failing_ids': failing,\n    }",
          explanation: "评分规则固定成一个常量提示，输出强制成带分数和理由的 JSON。对比函数同时给出均值差和失败样本 id 列表：均值告诉你有没有退步，id 列表告诉你退在哪，两者缺一不可。样本、规则、评委三者不改，这个 delta 才有解释力。",
        },
        practiceSteps: [
          "冻结一份四十到一百条的评测集，覆盖常见、边界、历史失败三类问题。",
          "把评分规则写成固定文本，输出强制为分数加理由的 JSON。",
          "抽二十条同时人工标注，算评委与人工的一致率，用分歧样本反过来修规则。",
          "每次变更跑同一基线，门禁里同时看均值差与失败样本清单。",
        ],
        masteryChecklist: [
          "能说明为什么换样本或换评委之后，分数不能直接比较。",
          "能设计一个带理由输出的评分规则，并用一致率校准评委。",
        ],
        summary: [
          "自动评测的前提是口径稳定：样本、规则、评委版本都固定。",
          "评委要校准，一致率低先改规则而不是换模型。",
          "报告要给失败样本清单，不能只给平均分。",
          "小样本上的小差异多半是噪声，别过度解读。",
        ],
        terms: [
          {
            term: "LLM 评委（LLM-as-Judge）",
            plain: "让另一个模型按规则给回答打分，替人做初筛。",
            detail: "它便宜、可批量，但也会漂移：提示措辞、选项顺序、评委版本都会影响分数。所以它适合做筛选，不适合做最终裁决。",
          },
          {
            term: "回归基线（Regression Baseline）",
            plain: "留一份历史成绩，之后每次改动都跟它比。",
            detail: "基线不只是一组数字，还包括当时用的样本和评委版本。三者任一变化，比较就失效了。",
          },
          {
            term: "一致率（Agreement）",
            plain: "模型评委的打分和人工打分对得上的比例。",
            detail: "它是评委可信度的直接指标。一致率低通常说明评分规则写得模糊，先把档位判据写清楚，往往比换更大的模型更有效。",
          },
        ],
      },
    },
    questions: [
      {
        key: "ai-engineering-exp-ai-judge-regression-s1",
        stageKey: "ai-production",
        topicKey: "ai-judge-regression",
        type: "single",
        stem: "下面哪种做法会让一次评测回归的结论失去可比性？",
        options: [
          {
            key: "A",
            text: "保持评测集与评分规则不变，只替换被测模型",
          },
          {
            key: "B",
            text: "同时更换评测样本、评分规则和评委模型，然后直接比较总分",
          },
          {
            key: "C",
            text: "记录失败样本的 id 清单并逐条归因",
          },
          {
            key: "D",
            text: "对评委输出做人工抽检校准",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "评测分数可比的前提是除被测对象之外其它变量都固定。样本、规则、评委同时更换，分数差异就无法归因到任何单一因素，可能全是尺子变了。A 才是正确做法：只动一个变量，其余保持不变，差异才说明问题。",
        difficulty: "medium",
        tags: [
          "评测",
          "回归",
          "评委",
        ],
        sourceKey: "openai-cookbook",
        level: "进阶",
      },
      {
        key: "ai-engineering-exp-ai-judge-regression-j1",
        stageKey: "ai-production",
        topicKey: "ai-judge-regression",
        type: "judge",
        stem: "在四十条样本的评测集上通过率提升了两个百分点，就可以判定这次改动带来了真实的质量提升。",
        options: [
          {
            key: "A",
            text: "正确",
          },
          {
            key: "B",
            text: "错误",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "四十条样本上两个百分点不到一条题的差距，完全可能来自样本波动或评委的随机性，统计上不足以支撑结论。要么扩大样本量，要么用绝对条数报告并附置信区间，或者针对这类问题单独构造更聚焦的评测集再验证一次。",
        difficulty: "hard",
        tags: [
          "评测",
          "样本量",
          "回归",
        ],
        sourceKey: "openai-cookbook",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "ai-engineering",
    stageKey: "ai-production",
    topic: {
      key: "ai-latency-cost-budget",
      title: "延迟预算与成本模型",
      summary: "延迟和成本都能提前算：输入输出 token 决定单价，首字延迟与生成速度决定体感，缓存与模型路由决定能省下多少，分层设计比事后省钱有效得多。",
      concepts: [
        "token 计费",
        "首字延迟",
        "前缀缓存",
        "模型路由",
      ],
      principles: [
        "成本是可计算的：输入 token 数与输出 token 数乘单价求和，再按缓存命中的折扣修正。",
        "用户体感由首字延迟决定，总时长由输出长度与生成速度决定，两者的优化手段不同。",
        "缓存分两类：精确匹配直接复用结果，前缀缓存复用计算，命中率决定实际收益。",
        "模型路由按任务难度分层，把简单请求交给便宜模型，是性价比最高的一步。",
      ],
      applications: [
        "高频重复问答：语义缓存把重复问题挡在模型调用之前。",
        "长系统提示的助手：利用前缀缓存降低首字延迟与输入成本。",
      ],
      pitfalls: [
        "只优化平均延迟，忽略 p95 与长尾请求，监控好看但用户仍然在等。",
        "缓存不设失效策略，文档更新后仍在返回旧答案。",
        "把最贵模型设成默认，再用采样率掩盖账单。",
      ],
      method: "先按请求类型拆出延迟预算与单次成本，再逐项决定缓存、路由、输出长度上限与降级顺序，最后用真实流量验证估算。",
      exercise: "为问答接口设计三条路径：缓存命中、小模型、大模型，估算各自的 p95 延迟与单次成本，并写出路由规则。",
      checkpoint: "能说清一次请求的钱花在哪、延迟花在哪，以及高峰时的降级顺序和预算上限。",
      lesson: {
        overview: [
          "成本不是月底才知道的数字，它在设计阶段就已经决定了。一次调用花多少钱，取决于输入多少 token、输出多少 token、单价是多少，以及有没有命中缓存。把这些项写成一个公式，你就能在写代码之前估出每月账单的量级，而不是等财务来问。",
          "延迟也要拆开看。用户感知最明显的是首字延迟：点了发送之后多久看到第一个字。总时长则取决于输出长度和生成速度。优化首字延迟靠缓存和更小的模型，优化总时长靠缩短输出和流式返回，这两件事的目标和手段都不一样。",
          "真正把成本压下来的往往不是省钱的小技巧，而是架构上的分层：能缓存的别调模型，小模型能解决的别用大模型，必须大模型的才走完整链路。分层做完，剩下的参数优化才有意义，否则只是在错误的量级上做微调，省下来的钱也抵不过一次架构返工。",
        ],
        mechanism: [
          "成本公式很直接：单次成本等于输入 token 乘输入单价，加输出 token 乘输出单价，再按缓存命中的折扣修正。输出 token 的单价通常比输入贵数倍，所以限制输出长度往往比压缩输入更有效，这也是很多团队一开始搞反的地方。",
          "前缀缓存的前提是请求开头完全一致：把稳定的系统提示、工具定义、少样本示例放在最前面，把每次变化的用户输入放在最后，命中率才会高。顺序一变，最长公共前缀就断了，缓存直接失效。",
          "语义缓存在向量空间里找相似问题，命中就返回旧答案。它省钱明显，风险也明显：问题相似而条件不同时会返回错误答案，所以必须限定可缓存的意图范围，并为文档更新和权限变更设置失效机制。",
          "模型路由按难度分流：分类、抽取、格式化交给小模型，复杂推理和多步规划才给大模型。路由本身要有置信度判断和回退，小模型低置信时升级，而不是硬着头皮答完再让用户承担错误的代价。",
        ],
        example: {
          title: "按 token 估算单次成本与路由收益",
          language: "typescript",
          code: "type Price = { inputPerM: number; outputPerM: number };\n\nconst PRICES: Record<string, Price> = {\n  small: { inputPerM: 0.15, outputPerM: 0.6 },\n  large: { inputPerM: 3.0, outputPerM: 15.0 },\n};\n\nfunction costOf(\n  model: keyof typeof PRICES,\n  inputTokens: number,\n  outputTokens: number,\n  cacheHit = false,\n) {\n  const price = PRICES[model];\n  const inputRate = cacheHit ? price.inputPerM * 0.1 : price.inputPerM;\n  return (inputTokens * inputRate + outputTokens * price.outputPerM) / 1_000_000;\n}\n\nfunction routeOf(question: string, hasCache: boolean) {\n  if (hasCache) return 'cache';\n  if (question.length < 40) return 'small';\n  return 'large';\n}\n\nfunction budgetReport(rows: { tokensIn: number; tokensOut: number; cacheHit: boolean }[]) {\n  let spend = 0;\n  for (const row of rows) {\n    const model = row.tokensOut > 400 ? 'large' : 'small';\n    spend += costOf(model, row.tokensIn, row.tokensOut, row.cacheHit);\n  }\n  return { calls: rows.length, spend, perCall: spend / Math.max(rows.length, 1) };\n}",
          explanation: "把单价、token 数与缓存折扣写进同一个函数，单次成本就变成一个可算的量。有了它，路由规则和输出长度上限的取舍就不再靠感觉：改一行路由，就能提前算出租金会怎么变，而不是等月底账单来验证。",
        },
        practiceSteps: [
          "统计线上请求的输入输出 token 分布，算出当前的单次平均成本与 p95 成本。",
          "按任务难度分层，为每层指定模型、输出长度上限与是否允许缓存。",
          "把稳定内容移到提示最前面，验证前缀缓存命中率与首字延迟的变化。",
          "为高峰设计降级顺序，并确认降级之后核心流程仍然可用。",
        ],
        masteryChecklist: [
          "能写出单次成本的估算公式，并说明为什么限制输出比压缩输入更有效。",
          "能区分首字延迟与总时长，并各给一种优化手段。",
        ],
        summary: [
          "成本可以提前算：token 数乘单价，再按缓存命中修正。",
          "输出 token 通常更贵，限制输出长度往往最有效。",
          "前缀缓存靠顺序稳定，语义缓存要管好失效。",
          "模型路由按难度分层，是性价比最高的一步。",
          "延迟要看首字延迟和总时长两个指标。",
        ],
        terms: [
          {
            term: "首字延迟（TTFT）",
            plain: "从发出请求到看见第一个字的时间。",
            detail: "它决定等待感。流式返回能让首字更早出现，前缀缓存能减少预填充时间，两种手段都直接改善体感。",
          },
          {
            term: "前缀缓存（Prompt Caching）",
            plain: "请求开头相同的部分不用重算，直接复用。",
            detail: "前提是前缀完全一致。把系统提示、工具定义放在最前，用户输入放最后，命中率才高；顺序一变缓存就失效。",
          },
          {
            term: "模型路由（Model Routing）",
            plain: "简单问题给便宜模型，难题才给贵模型。",
            detail: "它需要置信度判断和回退机制：小模型低置信时升级到大模型，而不是硬着头皮答完。",
          },
          {
            term: "语义缓存",
            plain: "问题意思差不多，就直接返回上次的答案。",
            detail: "省钱的代价是风险：条件不同而问题相似时，会返回看似正确的错误答案。所以要限定可缓存意图，并在文档更新时失效。",
          },
        ],
      },
    },
    questions: [
      {
        key: "ai-engineering-exp-ai-latency-cost-budget-s1",
        stageKey: "ai-production",
        topicKey: "ai-latency-cost-budget",
        type: "single",
        stem: "在输入 token 与输出 token 数量相同的假设下，下面哪项通常最能降低单次调用成本？",
        options: [
          {
            key: "A",
            text: "把输出长度上限调小，避免模型长篇作答",
          },
          {
            key: "B",
            text: "把系统提示改写成更礼貌的措辞",
          },
          {
            key: "C",
            text: "提高温度，让模型输出得更短",
          },
          {
            key: "D",
            text: "增加少样本示例的数量",
          },
        ],
        answer: [
          "A",
        ],
        explanation: "输出 token 的单价通常明显高于输入，因此减少输出长度对成本的杠杆最大。礼貌措辞不改变 token 量级，温度也不直接减少 token 数，而增加少样本示例会拉长输入，反而让成本上升。",
        difficulty: "easy",
        tags: [
          "成本",
          "token",
          "输出长度",
        ],
        sourceKey: "openai-cookbook",
        level: "入门",
      },
      {
        key: "ai-engineering-exp-ai-latency-cost-budget-j1",
        stageKey: "ai-production",
        topicKey: "ai-latency-cost-budget",
        type: "judge",
        stem: "只要开启了提示前缀缓存，把每次变化的内容放在提示最前面也不会影响命中率。",
        options: [
          {
            key: "A",
            text: "正确",
          },
          {
            key: "B",
            text: "错误",
          },
        ],
        answer: [
          "B",
        ],
        explanation: "前缀缓存按从头开始的最长公共前缀匹配。变化的内容一旦出现在最前面，后面再相同也匹配不上，缓存直接失效。正确做法是把稳定的系统提示、工具定义和示例放最前，把每次变化的用户输入放最后。",
        difficulty: "medium",
        tags: [
          "缓存",
          "延迟",
          "提示",
        ],
        sourceKey: "openai-cookbook",
        level: "进阶",
      },
    ],
  },
];
