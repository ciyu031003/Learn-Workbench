import type { LearningTopicLesson } from "../types";

export const cloudPlatformTopicLessons: Record<string, LearningTopicLesson> = {
  "cloud-service-models": {
    overview: [
      "云不是「别人的机房」，而是一组责任划分方式不同的服务。IaaS 把虚拟机交给你，PaaS 把运行时交给你，SaaS 把成品交给你，责任边界随之上移。",
      "判断一个服务是否适合业务，第一步不是看功能列表，而是看它替你承担了什么、又把哪些责任留给你。",
    ],
    mechanism: [
      "共享责任模型把安全与控制拆成两半：厂商负责「云本身」的物理、主机与网络底座，客户负责「云里」的身份、数据、配置与访问控制。",
      "区域是地理级别的故障域，可用区是区域内的独立故障域。跨可用区部署能抵御单区故障，跨区域部署才抵御区域级灾难，两者的成本与复杂度依次上升。",
    ],
    example: {
      title: "列出一次托管部署的责任清单",
      language: "text",
      code: `服务：托管数据库 + 应用容器

厂商负责
  - 物理机房、供电、网络底座
  - 数据库引擎版本与官方补丁
  - 底层存储冗余

我方负责
  - 库表结构、索引与查询
  - 账号、角色与网络白名单
  - 备份策略与恢复演练
  - 参数配置与容量评估
  - 应用侧的证书与密钥管理`,
      explanation: "把责任逐项写下来，空白项就是没人负责的风险点。清单里最容易被忽略的通常是「备份有没有真的恢复过」和「白名单是否还开着旧地址」。",
    },
    practiceSteps: [
      "为一个 Web 应用写出完整的责任清单，逐项标注归属方。",
      "找出清单里没有明确归属的项，并补齐责任人与验证方式。",
      "对比 IaaS 与 PaaS 两种方案的责任清单差异，说明团队需要多承担什么。",
    ],
    masteryChecklist: [
      "能逐项说明每个资源由谁负责。",
      "能解释选择更高层托管服务时放弃了什么控制权。",
    ],
  },
  "cloud-compute-network": {
    overview: [
      "云上网络的设计目标只有一个：让必要的流量通过，其余一律不通。子网划分决定分区，安全组规则决定每一跳是否放行。",
      "计算规格决定能力上限，弹性决定应对峰值的方式。规格该多大，应由实测负载而不是机型名称决定。",
    ],
    mechanism: [
      "安全组规则按方向生效：入站控制谁能访问你，出站控制你能访问谁。规则默认拒绝比默认允许安全，但需要把必要端口显式列出。",
      "负载均衡通过健康检查维护可用实例列表。检查路径必须反映真实业务可用性——返回 200 但依赖已断的实例，等于把流量引向故障。",
    ],
    example: {
      title: "两个子网加一个负载均衡的最小拓扑",
      language: "yaml",
      code: `subnets:
  public:   10.10.1.0/24   # 仅放负载均衡
  private:  10.10.2.0/24   # 放应用实例

load_balancer:
  listen: 443
  health_check:
    path: /healthz          # 必须检查依赖连通性
    interval: 10s
    unhealthy_threshold: 3

security_groups:
  lb:       inbound 443 from 0.0.0.0/0; inbound 22 from bastion
  app:      inbound 8080 from lb only
  database: inbound 5432 from app only`,
      explanation: "只有负载均衡暴露公网，应用与数据库各自只接受上游来源的指定端口。这样即便某层被攻破，横向移动也被规则挡住。",
    },
    practiceSteps: [
      "画出一次请求从公网进入应用再到数据库的完整路径。",
      "为每一跳写出必要的安全组规则，并说明该条规则对应的具体来源。",
      "把健康检查路径改成依赖可控的地址，验证故障实例会被摘除。",
    ],
    masteryChecklist: [
      "能说明每条网络规则存在的必要性。",
      "能解释健康检查如何影响可用性。",
    ],
  },
  "cloud-identity": {
    overview: [
      "身份体系的核心问题是「谁能在什么范围做什么」。把权限授予角色而不是个人，把凭证交给托管身份而不是配置文件。",
      "最小权限不是「权限越小越好」，而是「恰好能完成任务且说得清为什么需要」。",
    ],
    mechanism: [
      "角色把一组权限与职责绑定，人员变动时只调整成员关系，避免遗留个人权限。权限边界进一步限制角色最大可授予范围，形成双层约束。",
      "长期密钥一旦泄漏就长期有效，且轮换常被忘记。托管身份与短期凭证由平台自动签发与轮换，从根本上消除这一风险。",
    ],
    example: {
      title: "为只读排障与自动发布分别定义角色",
      language: "json",
      code: `{
  "roles": [
    {
      "name": "readonly-triage",
      "allow": ["read:logs", "read:metrics", "list:resources"],
      "deny": ["write:*", "delete:*"],
      "reason": "值班排障只需观察，不需要改动线上资源"
    },
    {
      "name": "deployer",
      "allow": ["write:app-service", "read:app-service", "read:secrets-metadata"],
      "scope": "resource-group:prod-app",
      "reason": "发布流程只操作应用资源，且限定在单一资源组"
    }
  ]
}`,
      explanation: "两个角色都限定了动作与范围，并写明理由。理由是权限复核时最重要的信息：说不出理由的权限就应该删掉。",
    },
    practiceSteps: [
      "为自动发布流水线写出权限清单，逐条注明对应任务。",
      "检查是否存在长期密钥，替换为托管身份或短期凭证。",
      "对最近一次权限授予追问理由，无法回答的记录下来准备回收。",
    ],
    masteryChecklist: [
      "能为每个权限条目说出它服务于哪个任务。",
      "能说明人员变动时权限如何自动收敛。",
    ],
  },
  "cloud-container-basics": {
    overview: [
      "容器把应用与依赖打包成不可变的镜像，让「本地能跑」与「线上能跑」不再依赖环境巧合。",
      "镜像分层既是构建缓存的基础，也是体积控制的抓手：变化频繁的内容放在上层，构建工具留在构建阶段。",
    ],
    mechanism: [
      "镜像由若干只读层叠加而成，每条构建指令生成一层。相同层在后续构建中可直接复用缓存，因此把拷贝依赖描述文件与安装依赖放在拷贝源码之前能显著加速。",
      "运行时通过命名空间与资源限制把容器隔离在有限视野内。容器不是虚拟机，但也不是没有边界，隔离强度取决于运行时配置。",
    ],
    example: {
      title: "多阶段构建：构建工具不进运行镜像",
      language: "bash",
      code: `# 构建阶段：装依赖、编译
FROM node:22 AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# 运行阶段：只保留产物与运行依赖
FROM node:22-slim AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
USER node
CMD ["node", "dist/server.js"]`,
      explanation: "依赖层在源码变更时仍可命中缓存；运行镜像只保留 dist 与依赖，不含编译器与源码，体积更小且攻击面更低。",
    },
    practiceSteps: [
      "为一个服务写多阶段构建，标出哪些层会被缓存复用。",
      "对比多阶段前后的镜像体积与层数量。",
      "把基础镜像标签固定到具体版本，验证构建结果可复现。",
    ],
    masteryChecklist: [
      "能指出每次发布哪些层会重建、哪些被复用。",
      "能说明为什么不能用 latest 标签部署生产。",
    ],
  },
  "cloud-k8s-workloads": {
    overview: [
      "编排的核心思想是声明式：你描述期望状态，控制器持续把实际状态拉回期望状态。",
      "工作负载类型的选择由「负载是否有状态」决定：无状态可随意替换，有状态需要稳定身份与专属存储。",
    ],
    mechanism: [
      "控制器循环不断比较期望状态与实际状态，发现差异就执行动作。因此实例崩溃无需人工干预，控制器会重建它。",
      "服务发现把实例列表的变动与调用方解耦：调用方只面向稳定的服务名，后端实例的增删由平台维护。",
    ],
    example: {
      title: "声明式地描述一个无状态 API",
      language: "yaml",
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels: { app: api }
  template:
    metadata:
      labels: { app: api }
    spec:
      containers:
        - name: api
          image: registry.example.com/api:2026.10.0
          resources:
            requests: { cpu: "250m", memory: "256Mi" }
            limits:   { cpu: "1",    memory: "512Mi" }`,
      explanation: "副本数、镜像与资源都是期望状态。镜像标签固定到版本，控制器负责把实际运行的实例数维持为 3。",
    },
    practiceSteps: [
      "为一个 API 与一个数据库分别选择工作负载类型并说明理由。",
      "手工删掉一个实例，观察控制器如何把期望状态恢复。",
      "把副本数改大再改小，记录实际状态收敛的过程。",
    ],
    masteryChecklist: [
      "能解释声明式模型如何实现自愈。",
      "能判断一个负载是有状态还是无状态。",
    ],
  },
  "cloud-k8s-ops": {
    overview: [
      "发布的目标是「用户无感」：新实例先证明自己可用再接流量，旧实例先停止接新请求再处理完存量。",
      "探针与资源参数是这套流程的两个支点，配置错误会导致流量进入坏实例或频繁重启。",
    ],
    mechanism: [
      "滚动更新按批次替换实例，每批新实例通过就绪探针后才继续。就绪探针决定是否加入服务端点，存活探针决定是否重启。",
      "资源请求影响调度，限制影响运行上限。终止宽限期必须覆盖真实处理时间，否则存量请求会被强行中断。",
    ],
    example: {
      title: "探针与资源参数配置",
      language: "yaml",
      code: `containers:
  - name: api
    readinessProbe:
      httpGet: { path: /readyz, port: 8080 }   # 依赖就绪才接流量
      periodSeconds: 5
      failureThreshold: 2
    livenessProbe:
      httpGet: { path: /livez, port: 8080 }    # 只看自身存活，不查外部依赖
      periodSeconds: 10
      failureThreshold: 3
    resources:
      requests: { cpu: "250m", memory: "256Mi" }
      limits:   { cpu: "1",    memory: "512Mi" }
terminationGracePeriodSeconds: 30`,
      explanation: "就绪检查依赖、存活检查自身，避免依赖抖动引发级联重启；宽限期 30 秒需与应用的最大请求处理时间对齐。",
    },
    practiceSteps: [
      "为一个 API 设计就绪与存活探针，说明各自检查什么。",
      "统计应用最慢请求耗时，据此设置终止宽限期。",
      "执行一次发布并立即回滚，记录判定回滚的依据。",
    ],
    masteryChecklist: [
      "能说明新实例何时接流量、旧实例何时退出。",
      "能解释只设限制不设请求带来的调度问题。",
    ],
  },
  "cloud-object-block": {
    overview: [
      "存储选型由访问模式决定：顺序读写的大文件适合对象存储，随机小 IO 适合块存储，多实例共享目录才需要文件存储。",
      "生命周期策略是成本治理的第一手段：数据写入后热度快速衰减，自动下沉到低成本层几乎无风险。",
    ],
    mechanism: [
      "对象存储通过 HTTP 接口按键访问，天然支持海量并发与跨地域复制，但没有文件锁与低延迟随机写能力。",
      "块存储挂载后表现为设备，可供文件系统使用，延迟低但通常绑定单个实例，需要靠快照与副本获得冗余。",
    ],
    example: {
      title: "按访问模式分配三类数据",
      language: "yaml",
      code: `storage_plan:
  static_assets:
    kind: object
    lifecycle: 30d -> infrequent, 365d -> archive
  database_data:
    kind: block
    snapshot: daily, retain 14
    verified_restore: monthly
  shared_config:
    kind: file
    mount: /etc/app
    access: read-only for app instances`,
      explanation: "静态资源走对象存储并按生命周期下沉；数据库数据走块存储且明确快照保留与恢复验证；共享配置用文件存储只读挂载，避免各实例配置漂移。",
    },
    practiceSteps: [
      "为应用的三类数据各选一种存储形态并说明理由。",
      "为冷数据设计生命周期规则并核算预期成本下降。",
      "从块存储快照恢复一次数据，确认恢复流程可用。",
    ],
    masteryChecklist: [
      "能说明每种存储形态的访问代价与成本特征。",
      "能为数据说出它的生命周期与恢复方式。",
    ],
  },
  "cloud-db-cache": {
    overview: [
      "托管数据库把补丁、备份与高可用交给平台，把模型、索引与访问控制留给你。只读副本与缓存是分摊读压力的两种手段，但都会引入延迟或不一致。",
      "使用副本与缓存前，必须先回答「这份数据可以旧多久」。",
    ],
    mechanism: [
      "只读副本通过日志复制同步数据，存在复制延迟。写在主库、立刻从副本读，可能读到旧值。",
      "缓存以空间换时间，命中时跳过数据库。但写入后若不让缓存失效，就会长期返回过期数据，因此失效策略与缓存本身同等重要。",
    ],
    example: {
      title: "读路径分工与写入失效",
      language: "text",
      code: `读路径
  - 商品列表 / 详情  -> 缓存（TTL 60s）+ 只读副本
  - 用户自己的订单  -> 主库（需读己之写）
  - 报表聚合        -> 只读副本

写入路径
  1. 写主库并提交
  2. 删除对应缓存键（而不是更新，避免竞态写出旧值）
  3. 删除失败时记录告警，靠 TTL 兜底`,
      explanation: "先判断哪些读可以容忍延迟，再决定走副本还是主库；写入后用删除缓存而不是更新缓存，可以减少并发写入互相覆盖旧值的风险。",
    },
    practiceSteps: [
      "为一个页面列出读路径，标注每条路径能否接受副本延迟。",
      "设计缓存键与失效时机，写清写入后如何失效。",
      "统计连接池总上限，确认不超过数据库连接上限。",
    ],
    masteryChecklist: [
      "能指出哪些查询走副本、哪些必须走主库。",
      "能说明缓存为什么必须配失效策略。",
    ],
  },
  "cloud-cdn-dns": {
    overview: [
      "接入层决定用户如何找到你、多快拿到内容。DNS 决定「去哪台」，CDN 决定「内容从哪里取、取多快」。",
      "两者的共同点是都依赖缓存，而缓存意味着变更不会立即生效——所以切换动作必须提前准备。",
    ],
    mechanism: [
      "DNS 解析结果会被各级缓存持有 TTL 指定的时长。TTL 大则变更慢生效，TTL 小则解析压力大，故障切换前应临时调小。",
      "CDN 按规则判断内容能否缓存、缓存多久。静态资源可以长缓存并用内容指纹换 URL，动态内容必须谨慎，否则会把用户数据缓存给其他人。",
    ],
    example: {
      title: "切换前的前置动作与缓存规则",
      language: "text",
      code: `# 切换前 24 小时
1. 把记录 TTL 从 3600s 调小到 60s
2. 确认新目标已预热并健康
3. 准备好回切步骤与判定指标

# 缓存规则
/assets/*         cache 1y, immutable（带内容指纹）
/api/*            no-store
/pages/*          cache 60s, revalidate`,
      explanation: "TTL 提前调小是切换能快速生效的前提；缓存规则把静态资源与动态接口分开，避免把接口响应缓存出去。",
    },
    practiceSteps: [
      "为一个站点规划 DNS 记录与 TTL，说明每条记录的作用。",
      "写出静态与动态内容的缓存规则差异，并解释原因。",
      "设计一次故障切换的前置动作清单与回切条件。",
    ],
    masteryChecklist: [
      "能解释一次域名切换多久生效、为什么。",
      "能说明为什么不缓存动态接口响应。",
    ],
  },
  "cloud-observability": {
    overview: [
      "可观测性由三部分组成：指标回答「好不好」，日志回答「发生了什么」，追踪回答「慢在哪一段」。三者分工明确，缺一就会在故障时抓瞎。",
      "告警的价值由「是否值得打断值班」决定，而不是由覆盖多少指标决定。",
    ],
    mechanism: [
      "SLI 是可测量的服务质量指标，SLO 是它的目标值，错误预算是允许的失败额度。预算耗尽说明稳定性优先于继续发布。",
      "告警应基于用户可感知的症状。对内部每个指标单独告警会制造噪声，真正的故障反而被淹没。",
    ],
    example: {
      title: "为一个 API 定义 SLO 与分级告警",
      language: "text",
      code: `SLO
  可用性 99.9% / 30 天（错误预算约 43 分钟）
  延迟 P95 < 300ms

告警分级
  P1  可用性 5 分钟窗口 < 95%      -> 立即短信，值班接手
  P2  错误预算消耗率 > 10x 正常     -> 工作时间内处理
  P3  单实例资源持续 > 90%          -> 记录并观察，不打断`,
      explanation: "告警对着用户可感知的可用性与延迟，并明确每条告警的处置动作与时效，避免要么不响、要么响得太多的两难。",
    },
    practiceSteps: [
      "为一个 API 定义 SLI 与 SLO，算出允许的错误预算。",
      "写出三条分级告警及其处置动作。",
      "给日志补上请求关联标识，使其能串联一次完整调用。",
    ],
    masteryChecklist: [
      "能说明一条告警为什么值得打断值班。",
      "能区分指标、日志与追踪各自回答的问题。",
    ],
  },
  "cloud-iac": {
    overview: [
      "基础设施即代码把环境变成可评审、可复现的文本。它的价值不在自动化本身，而在让变更可追溯。",
      "只要还有人在控制台手工改资源，环境与代码就会漂移，后续应用变更时可能意外覆盖或删除。",
    ],
    mechanism: [
      "声明式定义描述期望资源，工具对比代码与实际状态生成执行计划：哪些新增、哪些修改、哪些销毁。计划就是评审对象。",
      "销毁与替换类操作具有破坏性，必须与常规变更分开评审并显式确认，不能混在自动流水线里顺手执行。",
    ],
    example: {
      title: "预览—评审—应用的固定流程",
      language: "bash",
      code: `# 1) 生成计划：只读，不改变任何资源
plan --out=tfplan

# 2) 评审：重点看 destroy / replace
#    - 0 to add, 2 to change, 0 to destroy  -> 常规变更
#    - 任何 destroy / replace               -> 需要额外确认

# 3) 应用同一份计划（保证评审的就是执行的内容）
apply tfplan`,
      explanation: "先生成计划再人工评审，最后应用同一份计划文件，可以确保审批的对象与实际执行的变更完全一致。",
    },
    practiceSteps: [
      "把一个网络资源写成声明式定义并生成预览。",
      "在预览中找出所有销毁与替换操作，说明它们的风险。",
      "检查环境与代码是否存在漂移，列出消除漂移的步骤。",
    ],
    masteryChecklist: [
      "能说明当前环境与代码是否一致。",
      "能列出破坏性变更并给出确认方式。",
    ],
  },
  "cloud-cost-security": {
    overview: [
      "成本与安全是同一件事的两面：都在回答「这些资源是否仍然必要、是否只被需要的人使用」。",
      "成本优化必须先能归因：不知道钱花在哪个团队或业务，就无法判断哪笔支出值得。",
    ],
    mechanism: [
      "标签把资源与团队、环境、业务对齐，使账单可以按维度聚合。缺少标签的资源会让整份账单失去可分析性。",
      "优化顺序由风险与收益决定：先清理闲置资源（无风险、收益直接），再调规格（需评估），最后才考虑架构改造（周期长）。",
    ],
    example: {
      title: "月度成本归因与三条动作",
      language: "text",
      code: `归因口径
  team / env / service 三个标签必须齐全

本月账单
  计算  62%   -> 其中 1 台实例连续 30 天 CPU < 2%
  存储  24%   -> 未设生命周期的日志归档占 70%
  网络  14%   -> 回源带宽高于预期

动作
  1. 下线闲置实例                      预期减少 ~9%
  2. 归档设 30 天生命周期               预期减少 ~6%
  3. 提高缓存命中率、降低回源           预期减少 ~4%`,
      explanation: "先按标签归因，再按「闲置—规格—架构」的顺序识别动作，并给出预期收益，让成本优化成为可验证的工程任务。",
    },
    practiceSteps: [
      "为一份账单按标签做归因，找出占比最高的三项。",
      "识别闲置资源并估算清理后的收益。",
      "复核一次权限与网络边界，列出需要回收的条目。",
    ],
    masteryChecklist: [
      "能说出本月成本构成与下一步动作。",
      "能解释为什么权限与网络边界要定期复核。",
    ],
  },
};
