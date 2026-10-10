import type { LearningTopicLesson } from "../types";

export const backendEngineeringTopicLessons: Record<string, LearningTopicLesson> = {
  "be-rest-resource": {
    overview: [
      "接口设计的收益来自「可预测」：客户端看到路径与方法就能推断语义、能否缓存、能否重试。",
      "资源建模的第一步是把业务名词列出来（订单、支付、退款），再决定它们之间的从属与动作归属。",
    ],
    mechanism: [
      "路径定位资源，方法决定语义：GET 读、POST 创建或执行动作、PUT 整体替换、PATCH 局部修改、DELETE 删除。",
      "动作类的业务（支付、审批、取消）用子资源 + POST 表达，既保留了资源可寻址性，也不破坏方法来。",
    ],
    example: {
      title: "订单与支付的资源路径设计",
      language: "text",
      code: `GET    /orders?status=paid&limit=20       # 列表，可缓存，可重试
GET    /orders/{id}                        # 详情
POST   /orders                             # 创建，非幂等
PUT    /orders/{id}                        # 整体替换，幂等
PATCH  /orders/{id}                        # 局部修改
POST   /orders/{id}/payment                # 支付（子资源动作，非幂等）
POST   /orders/{id}/payment/refund         # 退款-子资源动作
GET    /orders/{id}/payment                # 查询支付状态（幂等，可重试）`,
      explanation: "把「支付」建成订单的子资源后，查询支付状态与发起支付各自有明确方法与幂等性，客户端无需记忆自定义动词路径。",
    },
    practiceSteps: [
      "为一个业务域列出全部业务名词，圈出可作为资源的那些。",
      "为每个资源写出允许的方法与状态码，标注幂等性。",
      "把设计里所有动词化路径改写成子资源形式。",
    ],
    masteryChecklist: [
      "能指出一个接口破坏了哪条 HTTP 语义。",
      "能为每个接口标注幂等性与可缓存性。",
    ],
  },
  "be-validation-errors": {
    overview: [
      "外部输入一律不可信：即使客户端是自己的 App，也会遇到旧版本、被篡改或被脚本直接调用的情况。",
      "错误契约的目标是让客户端能自动决策：去登录、提示用户改输入、还是稍后重试。",
    ],
    mechanism: [
      "校验集中在系统边界做一次，内部只传已校验的数据；每层重复校验既浪费又容易口径不一致。",
      "错误码与文案分离：文案说给人听、可以随时改；错误码说给程序听、发布后必须稳定。",
    ],
    example: {
      title: "统一错误响应体",
      language: "json",
      code: `{
  "error": "导入批次为空",
  "code": "validation_failed",
  "requestId": "9f3c1a7e-5c2b-4f1a-9d38-77b0c1e2a4d5",
  "details": [{ "field": "items", "reason": "size must be between 1 and 500" }]
}`,
      explanation: "`code` 稳定、`error` 可变、`requestId` 用于对齐日志，`details` 给出可定位到字段的原因，客户端据此直接标注表单。",
    },
    practiceSteps: [
      "为一个接口列出全部错误场景，标注状态码与错误码。",
      "把校验失败与下游异常分别返回 4xx 与 5xx，并验证客户端分支。",
      "检查错误响应里是否泄漏了堆栈或 SQL 片段。",
    ],
    masteryChecklist: [
      "能说明某个错误为什么属于 4xx。",
      "能给出「可重试」与「不可重试」错误的判别依据。",
    ],
  },
  "be-idempotency-timeout": {
    overview: [
      "网络不可靠是常态：请求可能到达两次，也可能到达一次但响应丢失。幂等是把这两件事都变成无害的手段。",
      "超时语义是「结果未知」。把它当失败处理，会制造重复数据或错误的回滚。",
    ],
    mechanism: [
      "幂等键由客户端生成并随请求发送；服务端先用唯一约束落库，冲突即说明已处理过，直接返回原结果。",
      "重试要有上限与退避（指数 + 抖动），并且只对幂等操作重试，避免故障放大。",
    ],
    example: {
      title: "唯一约束兜住并发重复提交",
      language: "sql",
      code: `CREATE TABLE uploads (
  id        bigserial PRIMARY KEY,
  user_id   uuid NOT NULL,
  client_id text,
  url       text NOT NULL,
  deleted_at timestamptz
);

-- 同一用户同一 client_id 只允许一条有效记录（软删后重新选图不受影响）
CREATE UNIQUE INDEX uq_uploads_user_client
  ON uploads (user_id, client_id)
  WHERE client_id IS NOT NULL AND deleted_at IS NULL;`,
      explanation: "并发补发时数据库唯一索引保证只有一条成功；另一条收到 23505 后回查已有记录返回 200，客户端看到相同结果。",
    },
    practiceSteps: [
      "为一个写接口引入客户端幂等键，并在数据库上建立唯一约束。",
      "模拟并发发送同一幂等键，确认只落一条且两次响应一致。",
      "给重试加上次数上限与退避，并记录每次重试的序号。",
    ],
    masteryChecklist: [
      "能解释为什么应用层判重不能替代唯一约束。",
      "能说明超时后重试为什么必须幂等。",
    ],
  },
  "be-orm-vs-sql": {
    overview: [
      "ORM 是减少样板代码的工具，不是数据库的替代品。它的收益与风险都来自「生成的 SQL 你看不见」。",
      "判断标准很简单：这段逻辑能否用一条可解释的 SQL 表达？能就手写，不能再用 ORM 表达。",
    ],
    mechanism: [
      "惰性加载在访问关联属性时才发查询；循环里访问关联字段就会形成 N+1。",
      "预加载（JOIN / IN 批量取）把 N+1 压成 1-2 条查询，代价是可能带来数据冗余。",
    ],
    example: {
      title: "把 N+1 改成一次批量查询",
      language: "python",
      code: `# 反例：循环里逐个查作者 -> 1 + N 条查询
rows = db.query("SELECT * FROM articles LIMIT 50")
for row in rows:
    author = db.query("SELECT * FROM users WHERE id = %s", row["author_id"])

# 正例：一次取出所有需要的作者
articles = db.query("SELECT * FROM articles LIMIT 50")
ids = [a["author_id"] for a in articles]
authors = {u["id"]: u for u in db.query(
    "SELECT * FROM users WHERE id = ANY(%s)", (ids,))}
for a in articles:
    a["author"] = authors.get(a["author_id"])`,
      explanation: "从 N+1 条降到 2 条查询；用字典做本地连接，避免重复查询同一位作者。",
    },
    practiceSteps: [
      "打开查询日志，统计一个列表接口实际发出的 SQL 条数。",
      "找出其中的 N+1 并改成批量预加载，对比条数与耗时。",
      "为一个报表接口手写聚合 SQL，比较与内存聚合的差异。",
    ],
    masteryChecklist: [
      "能说出一个接口实际执行了哪些 SQL。",
      "能判断何时该放弃 ORM 改手写。",
    ],
  },
  "be-transaction-boundary": {
    overview: [
      "事务是「一组必须同时成立或同时不成立」的写操作。它的成本是锁与连接占用，边界应当尽量小。",
      "理解隔离级别才能知道代码里哪些「先读后写」的判断其实不安全。",
    ],
    mechanism: [
      "提交读（默认）下普通 SELECT 不加锁，因此两步之间的状态可能被其它事务改掉。",
      "行锁（SELECT ... FOR UPDATE）或数据库原子 UPDATE（条件写 + 影响行数判断）才能把检查与修改合为一体。",
    ],
    example: {
      title: "用条件更新实现原子扣减",
      language: "sql",
      code: `-- 原子扣减：影响行数为 0 说明库存不足（或已被并发拿走）
UPDATE inventory
   SET qty = qty - 1, updated_at = now()
 WHERE sku = 'SKU-1'
   AND qty >= 1
RETURNING qty;

-- 乐观锁：带 version 条件更新，冲突时重读重试
UPDATE articles
   SET title = $2, version = version + 1, updated_at = now()
 WHERE id = $1 AND version = $3
RETURNING version;`,
      explanation: "把判断写进 WHERE 由数据库在一条语句内完成，避免「先查再改」的窗口；影响行数为 0 就是冲突信号。",
    },
    practiceSteps: [
      "为一次扣减操作写出「先读后写」版本并说明竞态窗口。",
      "改成条件更新或行锁版本，比较并发下的结果。",
      "把事务内的外部接口调用移出事务，测量持锁时间变化。",
    ],
    masteryChecklist: [
      "能说明默认隔离级别下哪类判断不可靠。",
      "能解释影响行数为 0 意味着什么。",
    ],
  },
  "be-nplusone-index": {
    overview: [
      "索引是查询性能的第一杠杆，但建错索引比不建更糟：写入变慢、优化器可能选错路径。",
      "复合索引的列顺序决定它能支持哪些查询，最左前缀是关键约束。",
    ],
    mechanism: [
      "等值条件列在前、排序或范围列在后，可同时利用定位与顺序，避免额外排序。",
      "外键列缺少索引时，删除或更新父行需要扫描整张子表确认引用。",
    ],
    example: {
      title: "按访问模式设计复合索引",
      language: "sql",
      code: `-- 高频查询：某用户最近的记录，按时间倒序分页
SELECT id, title, created_at
  FROM notes
 WHERE user_id = $1 AND deleted_at IS NULL
 ORDER BY created_at DESC
 LIMIT 20;

CREATE INDEX idx_notes_user_created
  ON notes (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- 验证：应出现 Index Scan，且没有额外 Sort
EXPLAIN (ANALYZE, BUFFERS) SELECT ... ;`,
      explanation: "等值列 user_id 在前、排序列 created_at 在后，部分索引条件与查询一致，因此能直接顺序取前 20 行。",
    },
    practiceSteps: [
      "列出高频查询及其 WHERE/ORDER BY 列。",
      "按「等值→范围→排序」顺序设计复合索引并创建。",
      "用 EXPLAIN 验证命中情况，并检查是否仍有额外排序。",
    ],
    masteryChecklist: [
      "能解释 (a, b) 索引为何不支持只按 b 的高效查询。",
      "能用执行计划证伪「有索引就一定快」。",
    ],
  },
  "be-concurrency-model": {
    overview: [
      "并发问题的根源是共享可变状态。设计的第一选择是消除共享，其次才是同步。",
      "不同运行时对并发的抽象不同：线程是抢占式、协程是协作式、事件循环是单线程回调。",
    ],
    mechanism: [
      "「检查后修改」是复合操作，中间可被调度打断，因此必须整体原子化。",
      "事件循环里任何同步阻塞（CPU 计算、同步 IO）都会卡住所有并发请求。",
    ],
    example: {
      title: "三个版本的计数器",
      language: "go",
      code: `// 反例：读-改-写之间可被抢占
var n int
func bad() { n++ }

// 正例 1：互斥锁
var (mu sync.Mutex)
func good1() { mu.Lock(); n++; mu.Unlock() }

// 正例 2：原子操作
var counter atomic.Int64
func good2() { counter.Add(1) }`,
      explanation: "`n++` 编译成读、加、写三条指令，并发下会互相覆盖；锁与原子操作都把它变成一个不可分割的操作。",
    },
    practiceSteps: [
      "写一个计数器并用并发请求暴露竞态。",
      "分别用锁与原子操作修复，并压测对比结果。",
      "把一段 CPU 密集逻辑从事件循环移到工作线程，测量请求延迟变化。",
    ],
    masteryChecklist: [
      "能指出竞态发生的具体指令间隙。",
      "能为不同运行时选择合适并发手段。",
    ],
  },
  "be-cache-strategy": {
    overview: [
      "缓存的收益是减少昂贵计算与往返，代价是一致性窗口与额外维护。先问「不一致能忍多久」。",
      "失效策略决定一致性窗口：主动失效最小，过期兜底。",
    ],
    mechanism: [
      "穿透：查不存在的键每次都落库；击穿：热点键同时过期；雪崩：大量键同时过期。",
      "缓解手段各不相同：空值缓存/过滤器、单飞与随机抖动、分层过期。",
    ],
    example: {
      title: "带随机抖动的缓存写入",
      language: "typescript",
      code: `const BASE_TTL = 300; // 秒

async function cachedDetail(id: string) {
  const key = \`detail:\${id}\`;
  const hit = await cache.get(key);
  if (hit) return JSON.parse(hit);

  const fresh = await loadDetail(id);          // 真实来源
  const jitter = Math.floor(Math.random() * 60); // 0-59 秒抖动
  await cache.set(key, JSON.stringify(fresh), "EX", BASE_TTL + jitter);
  return fresh;
}`,
      explanation: "TTL 加随机抖动避免大批键在同一秒过期造成雪崩；真实来源仍是数据库，缓存只做加速。",
    },
    practiceSteps: [
      "为读多写少的接口设计缓存键、TTL 与失效时机。",
      "在写路径上加入主动失效，验证写后立刻读到新值。",
      "构造一次击穿场景，用单飞或抖动修复。",
    ],
    masteryChecklist: [
      "能区分穿透、击穿与雪崩并给出对应缓解。",
      "能说明缓存里为何不能存私有数据。",
    ],
  },
  "be-resilience": {
    overview: [
      "过载与依赖故障一定会发生。可靠性设计的目标不是避免故障，而是让故障可控、可预期。",
      "核心链路必须保住，非核心功能要能主动放弃。",
    ],
    mechanism: [
      "限流按自身容量设定阈值，超出直接快速失败，避免请求堆积耗尽资源。",
      "熔断在连续失败后打开，快速失败一段时间后半开试探恢复。",
    ],
    example: {
      title: "超时预算与熔断配合",
      language: "typescript",
      code: `const TIMEOUT_MS = 800;        // 内层调用预算
const RETRIES = 2;             // 重试次数上限

async function callUpstream(payload: unknown) {
  if (breaker.isOpen()) throw new Error("upstream circuit open");
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(UPSTREAM, {
        method: "POST",
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) { breaker.recordSuccess(); return res.json(); }
      throw new Error(\`upstream \${res.status}\`);
    } catch (error) {
      lastError = error;
      breaker.recordFailure();
      await sleep(2 ** attempt * 50 + Math.random() * 50); // 退避 + 抖动
    }
  }
  throw lastError;
}`,
      explanation: "内层超时 800ms 保证不拖垮外层预算；重试带指数退避与抖动；熔断打开后直接快速失败，不再压垮已故障的上游。",
    },
    practiceSteps: [
      "为核心依赖设定超时预算，并说明外层等待时间应如何设置。",
      "实现一个熔断器（含半开状态）并写测试覆盖三种状态。",
      "为非核心功能设计降级返回，并加上开关。",
    ],
    masteryChecklist: [
      "能说明限流与熔断在同一故障中的不同作用。",
      "能给出降级方案的触发与恢复条件。",
    ],
  },
  "be-config-secrets": {
    overview: [
      "配置与代码分离是部署可靠性的基础：同一份镜像应能在不同环境启动，差异只来自配置。",
      "秘密（密码、密钥、令牌）必须来自环境变量或密钥服务，绝不进仓库。",
    ],
    mechanism: [
      "启动自检在进程启动时校验必填配置，缺失即失败退出，把问题提前到部署阶段。",
      "秘密轮换要同步调用方与调度器（如 cron 里的请求头），并验证轮换后功能可用。",
    ],
    example: {
      title: "启动自检",
      language: "typescript",
      code: `interface Config { databaseUrl: string; cronSecret: string; port: number }

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const missing: string[] = [];
  const databaseUrl = env.DATABASE_URL?.trim();
  const cronSecret = env.CRON_SECRET?.trim();
  if (!databaseUrl) missing.push("DATABASE_URL");
  if (!cronSecret) missing.push("CRON_SECRET");
  if (missing.length) {
    // 明确失败，而不是用猜的默认值启动
    throw new Error(\`缺少必填配置: \${missing.join(", ")}\`);
  }
  return { databaseUrl: databaseUrl!, cronSecret: cronSecret!, port: Number(env.PORT ?? 3001) };
}`,
      explanation: "必填项缺失时抛错终止启动，避免带着错误配置长期运行；可选项才给默认值。",
    },
    practiceSteps: [
      "列出服务的配置清单，标注必填/可选/默认值。",
      "实现启动自检并对缺失场景写测试。",
      "梳理一次秘密轮换的完整步骤与验证方式。",
    ],
    masteryChecklist: [
      "能说明为什么不能给必填配置设默认值。",
      "能写出一次秘密轮换的操作与验证清单。",
    ],
  },
  "be-observability": {
    overview: [
      "可观测回答三个问题：出了什么问题、影响多大、从哪儿开始查。日志、指标、追踪分别擅长其中之一。",
      "设计顺序应当是「先问要看什么」，而不是「先接什么工具」。",
    ],
    mechanism: [
      "结构化日志便于检索与聚合，字段化比拼字符串更有价值。",
      "指标标签基数决定成本：标签值必须来自固定枚举，且指标口径一旦发布就要保持稳定。",
    ],
    example: {
      title: "请求级日志与指标",
      language: "typescript",
      code: `const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
const startedAt = Date.now();

try {
  const result = await handle(req);
  metrics.inc("http_requests_total", { route: "import", status: "ok" });
  logger.info("import done", { requestId, route: "import", ms: Date.now() - startedAt });
  return result;
} catch (error) {
  metrics.inc("http_requests_total", { route: "import", status: "error" });
  logger.error("import failed", { requestId, route: "import", err: String(error) });
  throw error;
}`,
      explanation: "标签只用固定枚举（route/status），用户维度信息放在日志里；requestId 让日志与响应体对齐。",
    },
    practiceSteps: [
      "为关键路径列出需要观测的数字与告警阈值。",
      "把日志改成结构化字段并去掉隐私内容。",
      "检查指标标签是否含高基数值并改掉。",
    ],
    masteryChecklist: [
      "能说明为什么用户 ID 不能作为指标标签。",
      "能用 requestId 把一次请求的前后端记录对齐。",
    ],
  },
  "be-migration-deploy": {
    overview: [
      "数据库变更是最容易出事故的发布类型，因为它通常不可快速回滚。",
      "把变更拆成「兼容 → 迁移 → 收口」三步，可以让结构与代码独立演进。",
    ],
    mechanism: [
      "只追加迁移：改写历史文件会让不同环境实际结构分叉，且无法用同一脚本重建。",
      "大表加非空默认列可能长时间持锁，拆成加可空列、分批回填、再加约束三步。",
    ],
    example: {
      title: "字段重命名的三步方案",
      language: "sql",
      code: `-- 第 1 步（兼容）：新增列并双写
ALTER TABLE articles ADD COLUMN IF NOT EXISTS headline text;
-- 应用同时写 title 与 headline，读仍用 title

-- 第 2 步（迁移）：回填历史数据并校验
UPDATE articles SET headline = title WHERE headline IS NULL;

-- 第 3 步（收口）：读切到 headline，观察一个发布周期后再删旧列
-- ALTER TABLE articles DROP COLUMN title;   -- 确认无调用方后再执行`,
      explanation: "每一步都能独立回滚：第 1 步删新列即可；第 2 步是数据回填；第 3 步之前旧列仍在，随时可切回。",
    },
    practiceSteps: [
      "为一次表结构变更写出三步方案与每步回滚动作。",
      "在临时库上演练回滚脚本，确认对象真的消失。",
      "检查发布流程中迁移与代码是否可独立回滚。",
    ],
    masteryChecklist: [
      "能说明为何不能改写已发布的迁移文件。",
      "能为一次大表变更给出不停服方案。",
    ],
  },
};
