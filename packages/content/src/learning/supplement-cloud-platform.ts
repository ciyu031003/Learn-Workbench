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

/** 云平台与容器 补充题库（按知识点细分，2 题/知识点：1 单选 + 1 判断）。 */
export const cloudplatformSupplementQuestions: LearningQuestion[] = [
  // ===== cloud-service-models (cloud-foundation) =====
  singleQuestion({ key: "cloud-platform-sup-cloud-service-models-s1", stageKey: "cloud-foundation", topicKey: "cloud-service-models",
    stem: "关于 IaaS、PaaS、SaaS 与共享责任模型，下列说法哪一项是正确的？",
    options: [
      "共享责任模型的核心是厂商负责云本身的安全，客户负责云中的安全配置与数据，且责任边界随服务模型不同而变化",
      "在 SaaS 模式下客户仍需自行负责底层操作系统与数据库的漏洞补丁",
      "使用 IaaS 时云厂商会负责客户应用程序的代码质量与业务逻辑缺陷",
      "PaaS 与 SaaS 的责任边界完全相同，客户都无需关心任何运维工作",
    ],
    answer: "A",
    explanation: "共享责任模型的关键点是责任随服务模型上移：IaaS 客户负责系统及以上，PaaS 进一步由厂商接管运行时，SaaS 客户仅负责数据与配置。因此厂商负责云本身的安全，客户负责云中自身的安全，边界随模型变化，只有 A 正确。",
    difficulty: "easy", tags: ["服务模型", "责任边界"], sourceKey: "az104", level: "入门" }),
  judgeQuestion({ key: "cloud-platform-sup-cloud-service-models-j1", stageKey: "cloud-foundation", topicKey: "cloud-service-models",
    stem: "在 IaaS 模式下，客户只为计算、存储与网络资源付费，底层硬件的物理安全由云厂商承担，客户无需负责。",
    answer: true,
    explanation: "IaaS 的共享责任边界落在客户操作系统之上：物理机房、硬件、网络与虚拟化由厂商负责，客户负责操作系统、应用、数据及配置。物理安全属于厂商责任范围，客户无需承担，故该说法正确。",
    difficulty: "easy", tags: ["IaaS", "物理安全"], sourceKey: "az104", level: "入门" }),

  // ===== cloud-compute-network (cloud-foundation) =====
  singleQuestion({ key: "cloud-platform-sup-cloud-compute-network-s1", stageKey: "cloud-foundation", topicKey: "cloud-compute-network",
    stem: "关于云中虚拟网络、安全组与负载均衡，下列哪一项是正确的？",
    options: [
      "安全组的默认策略是允许所有入站流量，需要显式配置拒绝规则来收紧",
      "将数据库子网直接分配公网 IP 并开放 0.0.0.0/0 是推荐的网络安全实践",
      "负载均衡器的健康检查用于探测后端实例是否可用，只有健康的实例才会接收流量",
      "子网划分只影响地址分配，对安全隔离与流量控制没有任何作用",
    ],
    answer: "C",
    explanation: "负载均衡依靠健康检查区分健康与故障实例，仅把流量转发到通过检查的实例，这是可用性的基础；安全组默认应拒绝未放通的流量而非全放通，数据库子网不应暴露公网，子网也是重要的隔离边界。因此只有 C 正确。",
    difficulty: "easy", tags: ["虚拟网络", "安全组"], sourceKey: "az104", level: "入门" }),
  judgeQuestion({ key: "cloud-platform-sup-cloud-compute-network-j1", stageKey: "cloud-foundation", topicKey: "cloud-compute-network",
    stem: "云网络安全组规则区分入站与出站方向，遵循默认拒绝、显式允许的原则更安全，即未明确放通的流量一律拒绝。",
    answer: true,
    explanation: "最小权限的网络安全做法是入站与出站分别定义，只显式允许必要的端口与来源，其余默认拒绝。这能显著缩小攻击面，避免 0.0.0.0/0 全放通之类的高风险配置，故该说法正确。",
    difficulty: "easy", tags: ["安全组", "最小权限"], sourceKey: "az104", level: "入门" }),

  // ===== cloud-identity (cloud-foundation) =====
  singleQuestion({ key: "cloud-platform-sup-cloud-identity-s1", stageKey: "cloud-foundation", topicKey: "cloud-identity",
    stem: "关于身份与最小权限原则，下列哪一项是正确的？",
    options: [
      "为方便 CI 自动部署，应给构建账号分配固定长期超级管理员密钥并写入代码仓库",
      "权限应授予角色而非个人，且只授予完成具体任务所需的最小动作与范围，自动化流程优先使用短期凭证或托管身份",
      "最小权限意味着所有人员都应拥有相同的高权限以便应急操作",
      "权限一旦授予便无需回收，因为增加权限总比减少权限更安全",
    ],
    answer: "B",
    explanation: "最小权限要求按职责分权：权限绑定角色而非个人，只给完成任务的最小动作与资源范围；自动化用短期或托管身份，凭证不入仓库；权限需可解释、可审计并可回收。只有 B 符合该原则。",
    difficulty: "easy", tags: ["身份", "最小权限"], sourceKey: "az104", level: "入门" }),
  judgeQuestion({ key: "cloud-platform-sup-cloud-identity-j1", stageKey: "cloud-foundation", topicKey: "cloud-identity",
    stem: "最小权限原则要求每次权限变更都能回答为什么需要，并保留审计记录；长期密钥不应写入代码仓库。",
    answer: true,
    explanation: "最小权限强调按职责分权、自动化使用短期或托管身份、凭证不进代码仓库，且每一次权限授予都要可解释并留痕审计，便于事后追溯与及时回收，故该说法正确。",
    difficulty: "easy", tags: ["审计", "凭证"], sourceKey: "az104", level: "入门" }),

  // ===== cloud-container (cloud-foundation) =====
  singleQuestion({ key: "cloud-platform-sup-cloud-container-s1", stageKey: "cloud-container", topicKey: "cloud-container-basics",
    stem: "关于容器与编排系统，下列哪一项是正确的？",
    options: [
      "容器通过共享宿主机内核并依赖命名空间与控制组实现进程级隔离，比完整虚拟机更轻量",
      "编排系统如 Kubernetes 要求用户手动维护每个实例，无法自动恢复故障",
      "容器镜像运行时必须包含完整的操作系统内核",
      "编排只解决部署问题，与健康检查、扩缩容和自愈没有关系",
    ],
    answer: "A",
    explanation: "容器共享宿主内核，借助 namespace 与 cgroup 做资源与视图隔离，省去独立内核因此比虚拟机轻量；Kubernetes 等编排能自动调度、健康检查与自愈；镜像不含独立内核；编排还覆盖扩缩容与发布。只有 A 正确。",
    difficulty: "medium", tags: ["容器", "编排"], sourceKey: "aks-labs", level: "进阶" }),
  judgeQuestion({ key: "cloud-platform-sup-cloud-container-j1", stageKey: "cloud-container", topicKey: "cloud-container-basics",
    stem: "Kubernetes 属于声明式编排系统：用户描述期望状态，控制器持续把实际状态收敛回期望状态，实例失效时会自动重建。",
    answer: true,
    explanation: "Kubernetes 以声明式 API 描述期望状态，内置控制器通过调谐循环不断对比实际与期望并纠正偏差，因此实例崩溃或节点故障时可自动重建与重新调度，无需人工干预，故该说法正确。",
    difficulty: "medium", tags: ["声明式", "自愈"], sourceKey: "aks-labs", level: "进阶" }),

  // ===== cloud-container-basics (cloud-foundation) =====
  singleQuestion({ key: "cloud-platform-sup-cloud-container-basics-s1", stageKey: "cloud-container", topicKey: "cloud-container-basics",
    stem: "关于容器镜像与构建，下列哪一项是正确的？",
    options: [
      "镜像分层的顺序不影响构建缓存，任意一层变动都会重建全部层",
      "镜像应当不可变，同一标签指向的内容不应变化；变化频繁的层应放在后面以提升缓存命中率",
      "使用 latest 标签部署生产环境是最稳妥、可追溯的做法",
      "构建阶段与运行阶段无需分离，把编译器留在运行镜像里更方便",
    ],
    answer: "B",
    explanation: "镜像按层叠加且可缓存：同一基础层命中缓存即可复用，因此变化频繁的层放后面能减少重建；镜像应不可变，同一标签内容不应变，生产禁用 latest 以保证可追溯；多阶段构建让运行镜像更精简。只有 B 正确。",
    difficulty: "medium", tags: ["镜像", "多阶段构建"], sourceKey: "aks-labs", level: "进阶" }),
  judgeQuestion({ key: "cloud-platform-sup-cloud-container-basics-j1", stageKey: "cloud-container", topicKey: "cloud-container-basics",
    stem: "多阶段构建应把编译工具留在构建阶段，运行镜像只包含运行所需文件，以减小体积并避免密钥与工具泄露。",
    answer: true,
    explanation: "多阶段构建在构建阶段完成编译，再把产物复制到精简的运行阶段镜像，使运行镜像不含编译器与源码，既减小体积又降低攻击面与密钥泄露风险，故该说法正确。",
    difficulty: "medium", tags: ["镜像精简", "安全"], sourceKey: "aks-labs", level: "进阶" }),

  // ===== cloud-k8s-workloads (cloud-foundation) =====
  singleQuestion({ key: "cloud-platform-sup-cloud-k8s-workloads-s1", stageKey: "cloud-container", topicKey: "cloud-k8s-workloads",
    stem: "关于 Kubernetes 工作负载类型，下列哪一项是正确的？",
    options: [
      "无状态负载的实例可被随意替换，而有状态负载需要稳定的网络标识与持久存储",
      "所有工作负载都应使用无状态 Deployment，有状态服务也完全适用",
      "服务发现把调用方与实例列表变动耦合在一起，实例扩缩需手工通知调用方",
      "手工直接修改运行中的 Pod 是保持期望状态一致的最佳方式",
    ],
    answer: "A",
    explanation: "无状态实例可任意替换，适合 Deployment；有状态负载需要稳定标识与持久卷，适用 StatefulSet。服务发现解耦调用方与实例列表，实例变动由控制面自动维护；手工改 Pod 会造成漂移。只有 A 正确。",
    difficulty: "medium", tags: ["工作负载", "有状态"], sourceKey: "kubernetes", level: "进阶" }),
  judgeQuestion({ key: "cloud-platform-sup-cloud-k8s-workloads-j1", stageKey: "cloud-container", topicKey: "cloud-k8s-workloads",
    stem: "在 Kubernetes 中，StatefulSet 用于有状态负载，提供稳定的网络标识与持久卷，而 Deployment 更适用于可替换的无状态服务。",
    answer: true,
    explanation: "StatefulSet 为有状态应用提供固定名称、有序部署与稳定持久存储，适合数据库等；Deployment 管理无状态副本便于滚动更新与扩缩，二者按负载是否有状态选择，故该说法正确。",
    difficulty: "medium", tags: ["StatefulSet", "Deployment"], sourceKey: "kubernetes", level: "进阶" }),

  // ===== cloud-k8s-ops (cloud-foundation) =====
  singleQuestion({ key: "cloud-platform-sup-cloud-k8s-ops-s1", stageKey: "cloud-container", topicKey: "cloud-k8s-ops",
    stem: "关于 Kubernetes 发布、探针与回滚，下列哪一项是正确的？",
    options: [
      "就绪探针用于判断容器能否接收流量，失败期间不会转发请求给它；存活探针失败会重启容器",
      "只要修改了 Deployment 的镜像，Kubernetes 会立即一次性替换所有实例",
      "资源请求 request 与限制 limit 对调度和稳定性没有影响，可以不设置",
      "回滚只需手工删除新版本 Pod 即可，无需记录任何历史版本",
    ],
    answer: "A",
    explanation: "就绪探针决定流量是否进入，存活探针失败触发重启，二者语义不同；更新按滚动批次逐步替换而非一次性；request/limit 影响调度与稳定性必须设置；回滚依赖保留的 ReplicaSet 修订。只有 A 正确。",
    difficulty: "medium", tags: ["探针", "回滚"], sourceKey: "kubernetes", level: "进阶" }),
  judgeQuestion({ key: "cloud-platform-sup-cloud-k8s-ops-j1", stageKey: "cloud-container", topicKey: "cloud-k8s-ops",
    stem: "滚动更新通过逐步替换旧副本实现无停机发布，配合就绪探针确保新实例真正可用后才切断旧实例流量；异常时可用记录的修订一键回滚。",
    answer: true,
    explanation: "滚动更新按批次替换 Pod，就绪探针防止流量过早进入未就绪实例；Kubernetes 保存每次发布的 ReplicaSet 修订，发现异常可执行回滚恢复到上一可用版本，故该说法正确。",
    difficulty: "medium", tags: ["滚动更新", "回滚"], sourceKey: "kubernetes", level: "进阶" }),

  // ===== cloud-storage-data (cloud-foundation) =====
  singleQuestion({ key: "cloud-platform-sup-cloud-storage-data-s1", stageKey: "cloud-storage-data", topicKey: "cloud-object-block",
    stem: "关于云存储与数据接入，下列哪一项是正确的？",
    options: [
      "块存储类似于物理硬盘，需先格式化并挂载到计算实例才能使用，适合数据库等需要文件系统的负载",
      "对象存储要求先挂载为本地文件系统之后才能写入文件",
      "所有数据接入都应使用最高持久性存储，完全不需要考虑成本差异",
      "数据传输只需关注带宽，无需考虑加密与合规要求",
    ],
    answer: "A",
    explanation: "块存储以裸磁盘块形式提供给实例，需格式化挂载后当作本地盘使用，适合低延迟随机读写的数据库；对象存储走 HTTP API 而非挂载；存储选型需权衡持久性、成本与合规，传输也要加密。只有 A 正确。",
    difficulty: "easy", tags: ["块存储", "数据接入"], sourceKey: "az104", level: "入门" }),
  judgeQuestion({ key: "cloud-platform-sup-cloud-storage-data-j1", stageKey: "cloud-storage-data", topicKey: "cloud-object-block",
    stem: "对象存储通过 HTTP API 以对象方式存取，适合海量非结构化数据与静态资源，通常不挂载为本地文件系统。",
    answer: true,
    explanation: "对象存储以扁平的键值方式管理对象，访问走 REST API，天然适合图片、备份、日志等非结构化数据，并可配合生命周期策略降低成本，一般不强求挂载为本地文件系统，故该说法正确。",
    difficulty: "easy", tags: ["对象存储", "API"], sourceKey: "az104", level: "入门" }),

  // ===== cloud-object-block (cloud-foundation) =====
  singleQuestion({ key: "cloud-platform-sup-cloud-object-block-s1", stageKey: "cloud-storage-data", topicKey: "cloud-object-block",
    stem: "关于对象存储与块存储的差异，下列哪一项是正确的？",
    options: [
      "块存储以固定大小块提供裸磁盘，适合低延迟随机读写的数据库；对象存储以对象方式存取，适合非结构化数据",
      "对象存储与块存储都只能通过挂载为本地目录才能使用",
      "块存储更适合存放文档、图片等海量静态文件",
      "对象存储无法设置访问策略与生命周期规则",
    ],
    answer: "A",
    explanation: "块存储提供裸磁盘块，需挂载格式化，适合数据库等随机 IO；对象存储以对象方式存取值，适合图片、备份等非结构化数据，支持访问策略与生命周期。B、C、D 均与事实相反，只有 A 正确。",
    difficulty: "easy", tags: ["对象存储", "块存储"], sourceKey: "az104", level: "入门" }),
  judgeQuestion({ key: "cloud-platform-sup-cloud-object-block-j1", stageKey: "cloud-storage-data", topicKey: "cloud-object-block",
    stem: "对象存储通常提供版本控制、生命周期过期删除与跨地域复制等能力，可用于归档与灾备，降低长期存储成本。",
    answer: true,
    explanation: "对象存储支持版本管理与生命周期规则，可自动将冷数据转入低频或归档层甚至到期删除，并借助跨地域复制实现冗余，是低成本归档与灾备的常见选择，故该说法正确。",
    difficulty: "easy", tags: ["版本控制", "生命周期"], sourceKey: "az104", level: "入门" }),

  // ===== cloud-db-cache (cloud-container) =====
  singleQuestion({ key: "cloud-platform-sup-cloud-db-cache-s1", stageKey: "cloud-storage-data", topicKey: "cloud-db-cache",
    stem: "关于托管数据库与缓存，下列哪一项是正确的？",
    options: [
      "托管数据库仍由客户完全负责操作系统补丁与高可用切换，厂商不参与任何运维",
      "使用 Redis 等内存缓存可显著降低热点读请求的数据库压力，但需注意缓存与数据库的一致性与失效策略",
      "缓存可以完全替代数据库，作为唯一的数据真相来源",
      "数据库只读副本只能用于备份，不能分担任何读流量",
    ],
    answer: "B",
    explanation: "内存缓存承接热点读请求，能显著减轻数据库负载，但需处理缓存穿透、击穿、雪崩及与数据库的一致性；托管库厂商负责补丁与切换，客户负责 schema 与权限；只读副本可分担读流量。只有 B 正确。",
    difficulty: "medium", tags: ["缓存", "托管数据库"], sourceKey: "az104", level: "进阶" }),
  judgeQuestion({ key: "cloud-platform-sup-cloud-db-cache-j1", stageKey: "cloud-storage-data", topicKey: "cloud-db-cache",
    stem: "托管数据库服务通常会自动处理补丁、备份与故障切换，但客户仍需负责表结构、查询优化、账号权限与数据本身的安全。",
    answer: true,
    explanation: "托管数据库把底层运维如补丁、备份、主备切换交给厂商，客户聚焦 schema、索引、权限与数据安全，这正是共享责任模型在 PaaS 数据库上的体现，故该说法正确。",
    difficulty: "medium", tags: ["共享责任", "运维边界"], sourceKey: "az104", level: "进阶" }),

  // ===== cloud-cdn-dns (cloud-container) =====
  singleQuestion({ key: "cloud-platform-sup-cloud-cdn-dns-s1", stageKey: "cloud-storage-data", topicKey: "cloud-cdn-dns",
    stem: "关于 CDN 与 DNS 接入，下列哪一项是正确的？",
    options: [
      "CDN 通过在靠近用户的边缘节点缓存静态与可缓存内容，减少回源距离与访问延迟",
      "开启 CDN 后所有动态请求也必须每次都回源，缓存对延迟毫无帮助",
      "DNS 仅用于把域名解析为 IP，对流量调度与多地域接入没有作用",
      "CDN 缓存越久越好，完全不需要考虑内容更新后的生效时间",
    ],
    answer: "A",
    explanation: "CDN 把可缓存内容下沉到边缘节点，用户就近访问从而降延迟、减源站压力；动态请求可回源但静态资源受益明显；DNS 配合智能解析可做地域调度；缓存需设合理 TTL 兼顾更新。只有 A 正确。",
    difficulty: "easy", tags: ["CDN", "DNS"], sourceKey: "az104", level: "入门" }),
  judgeQuestion({ key: "cloud-platform-sup-cloud-cdn-dns-j1", stageKey: "cloud-storage-data", topicKey: "cloud-cdn-dns",
    stem: "DNS 的 TTL 决定了记录缓存时长，TTL 过大会在切换故障时导致解析更新缓慢，过小则增加解析请求与延迟，需要权衡。",
    answer: true,
    explanation: "DNS 解析结果会被本地与递归服务器按 TTL 缓存，TTL 过长使故障切换后旧 IP 长期生效，过短增加解析开销，需根据容灾需求合理设置，故该说法正确。",
    difficulty: "easy", tags: ["TTL", "解析"], sourceKey: "az104", level: "入门" }),

  // ===== cloud-reliability (cloud-container) =====
  singleQuestion({ key: "cloud-platform-sup-cloud-reliability-s1", stageKey: "cloud-reliability", topicKey: "cloud-observability",
    stem: "关于可靠性与基础设施即代码 IaC，下列哪一项是正确的？",
    options: [
      "IaC 把环境定义为可版本化的代码，使环境可重复创建、评审与回滚，减少手工漂移",
      "成本治理与可靠性无关，只需关注功能是否正常即可",
      "可观测性只包含日志，指标与链路追踪可有可无",
      "用 IaC 会导致环境无法回滚，因此手工配置更可靠",
    ],
    answer: "A",
    explanation: "IaC 将基础设施代码化并纳入版本控制，所有变更可评审、可重复、可回滚，避免手工漂移；可靠性与成本治理、可观测性三者相辅相成。B、C、D 均与工程实践相反，只有 A 正确。",
    difficulty: "medium", tags: ["IaC", "可靠性"], sourceKey: "aks-labs", level: "进阶" }),
  judgeQuestion({ key: "cloud-platform-sup-cloud-reliability-j1", stageKey: "cloud-reliability", topicKey: "cloud-observability",
    stem: "通过 IaC 将基础设施代码化并纳入版本控制，可实现环境的可重复部署与变更评审，配合监控与预算告警共同提升系统可靠性与可控成本。",
    answer: true,
    explanation: "IaC 把资源定义成代码，变更走评审与流水线避免手工漂移；结合指标告警与预算阈值可及时发现容量与费用异常，增强可靠性与成本可控性，故该说法正确。",
    difficulty: "medium", tags: ["IaC", "成本"], sourceKey: "aks-labs", level: "进阶" }),

  // ===== cloud-observability (cloud-container) =====
  singleQuestion({ key: "cloud-platform-sup-cloud-observability-s1", stageKey: "cloud-reliability", topicKey: "cloud-observability",
    stem: "关于可观测性与告警，下列哪一项是正确的？",
    options: [
      "日志、指标、链路追踪分别回答发生了什么、系统有多忙、请求走了哪条路径，三者共同定位问题",
      "只要收集足够多的日志，就不需要指标与告警",
      "告警阈值越灵敏越好，告警数量越多代表系统越安全",
      "可观测性仅在故障发生后才有价值，平时无需建设",
    ],
    answer: "A",
    explanation: "可观测性三支柱中日志记录事件、指标反映系统量化状态、链路追踪还原请求路径，三者互补才能高效定位问题；过度灵敏的告警会引发告警疲劳，可观测性也用于容量规划与预防。只有 A 正确。",
    difficulty: "medium", tags: ["可观测性", "告警"], sourceKey: "aks-labs", level: "进阶" }),
  judgeQuestion({ key: "cloud-platform-sup-cloud-observability-j1", stageKey: "cloud-reliability", topicKey: "cloud-observability",
    stem: "告警应基于业务与系统指标设置合理阈值，并区分严重程度与通知渠道，避免告警风暴导致真正重要的问题被忽略。",
    answer: true,
    explanation: "有效告警需结合 SLO 设定阈值，区分紧急与常规并路由到对应值班渠道；盲目频发告警会引发疲劳，使关键告警被淹没，降低响应效率，故该说法正确。",
    difficulty: "medium", tags: ["告警", "SLO"], sourceKey: "aks-labs", level: "进阶" }),

  // ===== cloud-iac (cloud-storage-data) =====
  singleQuestion({ key: "cloud-platform-sup-cloud-iac-s1", stageKey: "cloud-reliability", topicKey: "cloud-iac",
    stem: "关于基础设施即代码 IaC 的实践，下列哪一项是正确的？",
    options: [
      "把密钥硬编码进 IaC 模板并提交到代码仓库是推荐做法",
      "使用变量与模块化拆分环境差异，并通过状态文件管理资源对应关系，可在不同环境复用同一套定义",
      "IaC 一旦写好就不需要再次执行，资源会自动自愈",
      "手动修改由 IaC 管理的资源不会影响后续一致性",
    ],
    answer: "B",
    explanation: "IaC 通过变量与模块抽象环境差异，并用状态文件记录资源与实际对应关系，实现多环境复用；密钥应走密钥管理而非硬编码；资源不会自愈，手工改动会造成漂移。只有 B 正确。",
    difficulty: "medium", tags: ["IaC", "模块化"], sourceKey: "az104", level: "进阶" }),
  judgeQuestion({ key: "cloud-platform-sup-cloud-iac-j1", stageKey: "cloud-reliability", topicKey: "cloud-iac",
    stem: "对由 IaC 托管的资源进行手工改动会造成实际状态与状态文件或定义不一致的配置漂移，应在代码中修正并重新应用。",
    answer: true,
    explanation: "配置漂移指实际基础设施偏离了代码声明，会导致不可预测的更新与回滚困难；正确做法是在 IaC 中修正并用流水线重新应用，保证单一事实来源，故该说法正确。",
    difficulty: "medium", tags: ["配置漂移", "状态"], sourceKey: "az104", level: "进阶" }),

  // ===== cloud-cost-security (cloud-storage-data) =====
  singleQuestion({ key: "cloud-platform-sup-cloud-cost-security-s1", stageKey: "cloud-reliability", topicKey: "cloud-cost-security",
    stem: "关于成本与安全治理，下列哪一项是正确的？",
    options: [
      "安全治理只关心防火墙，与身份权限和成本无关",
      "通过标签 tag 对资源分类可实现按团队或环境核算成本，并据此设置预算告警与权限边界",
      "为节省成本应关闭所有日志记录与审计，因为日志没有任何价值",
      "成本治理是财务部门的事，工程团队无需参与",
    ],
    answer: "B",
    explanation: "标签化是云治理基础：按团队或环境分类资源可核算成本、设置预算告警并约束权限边界；日志审计对安全至关重要；成本与工程团队的设计、回收策略密切相关。只有 B 正确。",
    difficulty: "medium", tags: ["成本治理", "标签"], sourceKey: "az104", level: "进阶" }),
  judgeQuestion({ key: "cloud-platform-sup-cloud-cost-security-j1", stageKey: "cloud-reliability", topicKey: "cloud-cost-security",
    stem: "成本治理与安全治理应当结合，例如为闲置资源设置自动回收、对公开暴露的存储桶做访问审计，可在降本的同时降低数据泄露风险。",
    answer: true,
    explanation: "闲置资源既浪费费用也扩大攻击面，定期回收与未公开访问审计可同时优化成本与安全；标签化成本归属与最小权限配合，是云治理的常见实践，故该说法正确。",
    difficulty: "medium", tags: ["降本", "安全审计"], sourceKey: "az104", level: "进阶" }),
];
