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

/** 后端工程 补充题库（按知识点细分，2 题/知识点）。 */
export const backendengineeringSupplementQuestions: LearningQuestion[] = [
  // ---- be-rest-resource（资源建模与 REST 语义；stage: be-api-design） ----
  singleQuestion({ key: "backend-engineering-sup-be-rest-resource-s1", stageKey: "be-api-design", topicKey: "be-rest-resource",
    stem: "在 REST 设计中，把「用户收藏某商品」建模，最符合资源语义的做法是？",
    options: ["POST /users/{uid}/favorites 并在请求体携带商品 id", "GET /favorite?uid=1&item=2", "PUT /favorite/{uid} 每次覆盖整个收藏列表", "POST /addFavorite"],
    answer: "A",
    explanation: "收藏是用户的子资源，用子资源路径 + POST 表达追加动作最贴合资源语义；GET 带写副作用会破坏幂等与缓存，动词化路径丢失资源寻址性，而 PUT 覆盖整表并不适合「追加一条」的语义。",
    difficulty: "medium", tags: ["REST", "资源建模"], sourceKey: "system-design-primer", level: "进阶" }),
  judgeQuestion({ key: "backend-engineering-sup-be-rest-resource-j1", stageKey: "be-api-design", topicKey: "be-rest-resource",
    stem: "REST 中 DELETE 方法应当是幂等的：对同一个资源多次 DELETE，最终状态都相同（资源处于已删除状态）。",
    answer: true,
    explanation: "DELETE 的幂等性指重复执行不会改变最终状态——无论第一次还是第五次删除，目标资源都处于「已删除」状态，因此客户端可以安全重试删除请求而不会产生额外的副作用。",
    difficulty: "medium", tags: ["REST", "幂等"], sourceKey: "system-design-primer", level: "进阶" }),

  // ---- be-validation-errors（输入校验与错误契约；stage: be-api-design） ----
  singleQuestion({ key: "backend-engineering-sup-be-validation-errors-s1", stageKey: "be-api-design", topicKey: "be-validation-errors",
    stem: "为批量创建接口设计错误响应，当某一行数据非法时，最利于客户端批量修正的做法是？",
    options: ["返回 422 并带逐行的字段级错误明细（行号+字段+错误码）", "只返回第一条错误，其余忽略", "返回 500 让客户端重试", "返回 200 并在 body 里塞错误信息"],
    answer: "A",
    explanation: "批量导入场景下客户端需一次性知道所有非法行的具体位置与原因才能批量修正；只返回第一条会迫使用户反复提交；5xx 表示服务器故障不应由客户端输入触发；用 200 承载错误会破坏状态码语义。",
    difficulty: "medium", tags: ["错误契约", "批量校验"], sourceKey: "fastapi", level: "进阶" }),
  judgeQuestion({ key: "backend-engineering-sup-be-validation-errors-j1", stageKey: "be-api-design", topicKey: "be-validation-errors",
    stem: "只要框架层用 schema 做了请求体校验，业务层就无需再校验参数合法性。",
    answer: false,
    explanation: "框架的 schema 校验只覆盖类型与基础格式（如必填、范围），无法覆盖业务规则（如余额是否充足、该用户是否有权操作目标资源）；这类领域约束必须在业务层再次校验，否则会出现类型通过但业务非法的请求。",
    difficulty: "medium", tags: ["错误契约", "校验分层"], sourceKey: "fastapi", level: "进阶" }),

  // ---- be-idempotency-timeout（幂等、重试与超时；stage: be-api-design） ----
  singleQuestion({ key: "backend-engineering-sup-be-idempotency-timeout-s1", stageKey: "be-api-design", topicKey: "be-idempotency-timeout",
    stem: "支付网关回调可能因网络重试而重复到达，服务端要保证只入账一次且并发安全，正确做法是？",
    options: ["用网关回调中的商户订单号做唯一约束，重复回调直接幂等返回已处理结果", "收到回调先查数据库是否已入账，没有再插入", "用客户端 IP 去重", "每次回调都重新入账，由对账补平"],
    answer: "A",
    explanation: "「先查后插」在并发下存在时间窗口，两个相同回调可能同时通过检查后各入一次账；把唯一约束建立在业务幂等键上，数据库会在并发时直接拒绝重复写入，这是唯一能兜住并发的手段；IP 与对账都不能即时阻止重复入账。",
    difficulty: "hard", tags: ["幂等", "并发去重"], sourceKey: "system-design-primer", level: "综合" }),
  judgeQuestion({ key: "backend-engineering-sup-be-idempotency-timeout-j1", stageKey: "be-api-design", topicKey: "be-idempotency-timeout",
    stem: "重试应在上层统一做，且重试次数不宜无限，并配合指数退避与抖动，避免把下游故障放大成雪崩。",
    answer: true,
    explanation: "无上限重试会在下游已故障时持续堆积请求，把局部故障放大为系统雪崩；指数退避加随机抖动能让大量客户端错峰重试，降低瞬时冲击，同时必须有次数上限以最终失败而不是无限占用资源。",
    difficulty: "hard", tags: ["重试", "退避"], sourceKey: "system-design-primer", level: "综合" }),

  // ---- be-data-access（数据访问与事务；stage: be-api-design） ----
  singleQuestion({ key: "backend-engineering-sup-be-data-access-s1", stageKey: "be-data-access", topicKey: "be-orm-vs-sql",
    stem: "一个读多写少的「公告列表」接口，每次都直接查主库最新数据，潜在问题是？",
    options: ["读请求占用主库连接与 IO，高并发下挤压写事务与锁资源", "主库数据一定不是最新的", "查询永远走全表扫描", "无法使用索引"],
    answer: "A",
    explanation: "读多写少的场景把全部读打到主库会让只读流量与写事务争抢同一批连接与磁盘 IO，高并发下会拖慢甚至阻塞写操作；应将只读流量引向只读副本，把主库连接留给事务性写，从而提升整体吞吐。",
    difficulty: "medium", tags: ["读写分离", "连接池"], sourceKey: "postgresql", level: "进阶" }),
  judgeQuestion({ key: "backend-engineering-sup-be-data-access-j1", stageKey: "be-data-access", topicKey: "be-orm-vs-sql",
    stem: "数据库连接池设置得越大，系统的并发处理能力就必然越强。",
    answer: false,
    explanation: "连接池过大不仅不会线性提升吞吐，反而会让过多连接同时占用数据库内存与锁，引发上下文切换与锁竞争；数据库的有效并发受 CPU、IO 与锁上限约束，连接数超过拐点后吞吐反而下降甚至触发连接风暴。",
    difficulty: "medium", tags: ["连接池", "容量"], sourceKey: "postgresql", level: "进阶" }),

  // ---- be-orm-vs-sql（ORM 与手写 SQL 的取舍；stage: be-api-design） ----
  singleQuestion({ key: "backend-engineering-sup-be-orm-vs-sql-s1", stageKey: "be-data-access", topicKey: "be-orm-vs-sql",
    stem: "需要对订单表按「地区 + 月份」做分组统计并生成报表，最合适的做法是？",
    options: ["用 GROUP BY 在数据库内聚合，只返回汇总行", "用 ORM 拉取全部订单到内存再手算", "对每张订单各发一条计数查询", "在应用层用循环逐行累加"],
    answer: "A",
    explanation: "分组聚合是数据库引擎的强项，可以在存储引擎内完成扫描、分组与求和，只把少量汇总行返回应用，极大减少数据传输与内存占用；把全量订单拉到内存再计算会产生大量 IO 与内存压力，还可能触发 N+1。",
    difficulty: "medium", tags: ["ORM", "聚合查询"], sourceKey: "postgresql", level: "进阶" }),
  judgeQuestion({ key: "backend-engineering-sup-be-orm-vs-sql-j1", stageKey: "be-data-access", topicKey: "be-orm-vs-sql",
    stem: "ORM 自动生成的 SQL 一定比手写 SQL 高效，因此生产环境应完全避免手写 SQL。",
    answer: false,
    explanation: "ORM 以通用方式生成 SQL，往往无法利用特定索引顺序、窗口函数或 CTE 优化，复杂聚合与报表查询手写 SQL 反而能显式控制执行计划；盲目信任生成 SQL 会导致隐性慢查询，生产环境应针对性能敏感路径评估并必要时手写。",
    difficulty: "medium", tags: ["ORM", "SQL取舍"], sourceKey: "postgresql", level: "进阶" }),

  // ---- be-transaction-boundary（事务边界与隔离级别；stage: be-api-design） ----
  singleQuestion({ key: "backend-engineering-sup-be-transaction-boundary-s1", stageKey: "be-data-access", topicKey: "be-transaction-boundary",
    stem: "在「扣减库存并生成订单」的事务中，还调用了第三方短信服务，最严重的问题是？",
    options: ["外部调用的不可控延迟会长时间持有数据库锁与连接，极易引发连接耗尽与死锁", "短信服务会失败", "事务会变大", "订单无法生成"],
    answer: "A",
    explanation: "事务内调用外部服务会把数据库行锁/连接持有时间拉长到外部延迟的量级，期间其它请求无法修改被锁数据，连接也长期占用；一旦外部慢或挂起，连接池被占满，整个写链路被拖垮，还可能因锁等待超时导致死锁。",
    difficulty: "hard", tags: ["事务边界", "锁"], sourceKey: "postgresql", level: "综合" }),
  judgeQuestion({ key: "backend-engineering-sup-be-transaction-boundary-j1", stageKey: "be-data-access", topicKey: "be-transaction-boundary",
    stem: "使用 READ COMMITTED 默认隔离级别时，两个并发事务的「先读后写」检查可能因彼此未提交而无法互相看见，从而都通过检查造成超卖。",
    answer: true,
    explanation: "在 READ COMMITTED 下普通 SELECT 只读取已提交数据且不提前加锁，两个事务各自读到旧库存后都通过「库存充足」检查再写入，结果都提交成功造成超卖；要可靠需用行锁（SELECT FOR UPDATE）、唯一约束或更高隔离级别。",
    difficulty: "hard", tags: ["隔离级别", "并发"], sourceKey: "postgresql", level: "综合" }),

  // ---- be-nplusone-index（N+1 与索引设计；stage: be-api-design） ----
  singleQuestion({ key: "backend-engineering-sup-be-nplusone-index-s1", stageKey: "be-data-access", topicKey: "be-nplusone-index",
    stem: "分析一个接口的慢查询，执行计划显示对大表做了 Seq Scan，最可能缺少的是？",
    options: ["与 WHERE 条件匹配且列顺序合理的索引", "更多的内存", "更快的 CPU", "更小的数据页"],
    answer: "A",
    explanation: "执行计划出现 Seq Scan（全表扫描）通常说明没有可命中查询条件的索引，数据库只能逐行扫描整张表；优先应建立覆盖 WHERE、JOIN、ORDER BY 的复合索引，再结合 EXPLAIN 验证是否变为 Index Scan，而不是盲目加硬件。",
    difficulty: "medium", tags: ["索引", "执行计划"], sourceKey: "postgresql", level: "进阶" }),
  judgeQuestion({ key: "backend-engineering-sup-be-nplusone-index-j1", stageKey: "be-data-access", topicKey: "be-nplusone-index",
    stem: "复合索引 (status, created_at) 能高效支持「只按 created_at 范围查询、不带 status」的语句。",
    answer: false,
    explanation: "复合索引遵循最左前缀原则，(status, created_at) 只有在查询包含 status 条件时才能有效利用 created_at 这一列的顺序；仅按 created_at 查询无法使用索引的有序性，往往退化为全表扫描或低效索引扫描。",
    difficulty: "medium", tags: ["索引", "最左前缀"], sourceKey: "postgresql", level: "进阶" }),

  // ---- be-runtime（并发、缓存与可靠性；stage: be-api-design） ----
  singleQuestion({ key: "backend-engineering-sup-be-runtime-s1", stageKey: "be-runtime", topicKey: "be-concurrency-model",
    stem: "Go 这类带 goroutine 的运行时，多个 goroutine 并发读写同一 map 而不加保护，会发生？",
    options: ["运行时触发并发读写 panic，程序崩溃", "自动加锁保证安全", "读到的一定是旧值", "没有任何影响"],
    answer: "A",
    explanation: "Go 的内置 map 不是并发安全的，多个 goroutine 同时读写（至少含一个写）会被运行时检测到并发访问并抛出 fatal error 使进程崩溃；必须用 sync.Mutex、sync.RWMutex 或 sync.Map 等机制来保护共享 map。",
    difficulty: "medium", tags: ["并发", "运行时"], sourceKey: "gin", level: "进阶" }),
  judgeQuestion({ key: "backend-engineering-sup-be-runtime-j1", stageKey: "be-runtime", topicKey: "be-concurrency-model",
    stem: "在请求处理链路中把无状态的 CPU 计算缓存到本地内存，一定能提升所有场景的吞吐。",
    answer: false,
    explanation: "本地内存缓存只在「计算昂贵且结果可复用」的场景才有收益；若数据频繁变化或缓存命中率低，反而增加内存占用与失效复杂度，单实例缓存还会在水平扩容时产生数据不一致，因此不能无条件假定其提升吞吐。",
    difficulty: "medium", tags: ["缓存", "运行时"], sourceKey: "gin", level: "进阶" }),

  // ---- be-concurrency-model（并发模型与共享状态；stage: be-api-design） ----
  singleQuestion({ key: "backend-engineering-sup-be-concurrency-model-s1", stageKey: "be-runtime", topicKey: "be-concurrency-model",
    stem: "Spring 默认单例 Controller 中，用实例字段保存「当前请求的用户上下文」，多线程下会？",
    options: ["不同请求的上下文互相覆盖，导致串号与越权风险", "每次请求自动隔离", "实例字段是线程私有的", "不会有任何问题"],
    answer: "A",
    explanation: "单例 Bean 在多线程间共享同一实例，实例字段被所有请求线程共用；一个请求写入的「当前用户」可能被另一请求覆盖，造成数据串号甚至越权读取他人数据；请求级状态应放在方法参数、ThreadLocal 或请求作用域对象中。",
    difficulty: "hard", tags: ["并发", "共享状态"], sourceKey: "spring-boot", level: "综合" }),
  judgeQuestion({ key: "backend-engineering-sup-be-concurrency-model-j1", stageKey: "be-runtime", topicKey: "be-concurrency-model",
    stem: "协程（轻量级线程）由于切换成本极低，因此可以无限制地创建数百万个而不影响系统稳定性。",
    answer: false,
    explanation: "协程虽轻量，但每个仍占用栈内存并可能持有数据库连接、文件句柄等资源；无限制创建会让内存随协程数线性增长，且大量协程阻塞在 IO 上会拖垮调度与下游连接，必须配合池化与背压来控制总量。",
    difficulty: "hard", tags: ["协程", "背压"], sourceKey: "spring-boot", level: "综合" }),

  // ---- be-cache-strategy（缓存策略与失效；stage: be-data-access） ----
  singleQuestion({ key: "backend-engineering-sup-be-cache-strategy-s1", stageKey: "be-runtime", topicKey: "be-cache-strategy",
    stem: "缓存雪崩指大量缓存键在同一时刻集中失效，正确的缓解方式是？",
    options: ["给过期时间加随机抖动，避免同时失效", "把所有过期时间设为永久", "缓存只存一份", "关闭缓存"],
    answer: "A",
    explanation: "雪崩源于大量键同时过期使请求瞬间全部回源，压垮数据库；给基础过期时间叠加随机抖动能把失效时间打散，使回源请求平滑分散；永久不失效会带来数据长期不一致，且仍躲不过热点键集体重建。",
    difficulty: "medium", tags: ["缓存", "雪崩"], sourceKey: "system-design-primer", level: "进阶" }),
  judgeQuestion({ key: "backend-engineering-sup-be-cache-strategy-j1", stageKey: "be-runtime", topicKey: "be-cache-strategy",
    stem: "缓存击穿指某个极热点的键在失效瞬间被大量并发请求同时回源，可用 single-flight（请求合并）或互斥重建来防护。",
    answer: true,
    explanation: "击穿与雪崩不同，它针对的是单一热点键：失效瞬间所有并发请求都去查库。single-flight 让同一键的并发回源只真正执行一次，其余共享结果；或用互斥锁保证只有一个线程重建缓存，从而避免数据库被瞬间打爆。",
    difficulty: "medium", tags: ["缓存", "击穿"], sourceKey: "system-design-primer", level: "进阶" }),

  // ---- be-resilience（限流、降级与熔断；stage: be-data-access） ----
  singleQuestion({ key: "backend-engineering-sup-be-resilience-s1", stageKey: "be-runtime", topicKey: "be-resilience",
    stem: "对一个非核心的「商品推荐」依赖，主链路是它的调用方，推荐服务抖动时最合适的策略是？",
    options: ["对该依赖熔断并走降级（返回默认/热门列表），保护主链路", "加大超时时间等待恢复", "直接让整个请求失败", "对该依赖无限重试"],
    answer: "A",
    explanation: "非核心依赖抖动时若继续同步等待，会拖垮主链路（如商品详情页本身可用）；熔断器在失败率超阈值时进入打开态，快速失败并走降级返回默认推荐，既保住核心功能又避免线程被故障依赖占满，符合「保核心弃非核心」原则。",
    difficulty: "hard", tags: ["熔断", "降级"], sourceKey: "system-design-primer", level: "综合" }),
  judgeQuestion({ key: "backend-engineering-sup-be-resilience-j1", stageKey: "be-runtime", topicKey: "be-resilience",
    stem: "限流应当针对系统真实容量设定，并结合压测基线，而不是凭经验拍脑袋定一个固定值。",
    answer: true,
    explanation: "限流阈值若低于真实容量会浪费资源、误杀正常流量，过高则起不到保护作用；只有基于压测得到的吞吐、延迟与资源拐点设定，并在容量变化后持续校准，限流才能在过载时真正护住系统而不误伤。",
    difficulty: "hard", tags: ["限流", "容量规划"], sourceKey: "system-design-primer", level: "综合" }),

  // ---- be-delivery（交付与可观测；stage: be-data-access） ----
  singleQuestion({ key: "backend-engineering-sup-be-delivery-s1", stageKey: "be-delivery", topicKey: "be-config-secrets",
    stem: "把服务从测试环境发布到生产，关于配置与密码管理，正确做法是？",
    options: ["通过环境变量或密钥服务注入，敏感配置绝不入仓库", "把生产密码写进 application-prod.yml 一并提交", "在代码里写死默认值", "用注释把密码留在代码里"],
    answer: "A",
    explanation: "秘密必须与源码分离，通过环境变量或密钥管理服务在部署时注入，才能在不同环境间隔离并支持轮换；把密码提交进配置文件等同于把密钥永久暴露在仓库历史中，任何能访问仓库的人都能拿到，风险极高。",
    difficulty: "easy", tags: ["交付", "配置"], sourceKey: "spring-boot", level: "入门" }),
  judgeQuestion({ key: "backend-engineering-sup-be-delivery-j1", stageKey: "be-delivery", topicKey: "be-config-secrets",
    stem: "为不影响老用户，滚动发布时应先启动新版本实例、确认健康后再下线旧实例，保证全程有可用实例。",
    answer: true,
    explanation: "滚动发布通过「逐个替换」实现不停服更新：先拉起新实例并通过健康检查，再摘除一个旧实例，使整个过程中始终有实例在对外服务；这避免了全量停机，也让问题实例能在被发现时立即回退而不影响整体可用性。",
    difficulty: "easy", tags: ["交付", "滚动发布"], sourceKey: "spring-boot", level: "入门" }),

  // ---- be-config-secrets（配置与秘密管理；stage: be-data-access） ----
  singleQuestion({ key: "backend-engineering-sup-be-config-secrets-s1", stageKey: "be-delivery", topicKey: "be-config-secrets",
    stem: "某服务启动时读取配置，数据库地址缺失却用了 localhost 默认值成功启动，最危险的是？",
    options: ["配置错误被静默掩盖，运行时连错库导致难定位的数据问题", "启动会变慢", "日志会变多", "应用无法启动"],
    answer: "A",
    explanation: "把缺失的必填配置用猜测默认值兜底，会把「部署配置错误」这种本该在启动阶段暴露的问题，伪装成「能跑但行为异常」的运行时故障；一旦连错库，可能读写错误数据且极难排查，因此必填项缺失应启动即失败。",
    difficulty: "medium", tags: ["配置", "启动自检"], sourceKey: "spring-boot", level: "进阶" }),
  judgeQuestion({ key: "backend-engineering-sup-be-config-secrets-j1", stageKey: "be-delivery", topicKey: "be-config-secrets",
    stem: "配置项应区分「必填」与「可选」，必填项缺失时应用应在启动阶段明确报错退出，而不是用默认值继续运行。",
    answer: true,
    explanation: "启动自检把配置类错误提前到部署期，运维能在发布流水线里立刻发现并阻断；若用默认值硬撑，错误会延迟到请求期以诡异行为暴露，定位成本高。区分必填/可选并显式失败是配置健壮性的基本要求。",
    difficulty: "medium", tags: ["配置", "健壮性"], sourceKey: "spring-boot", level: "进阶" }),

  // ---- be-observability（日志、指标与追踪；stage: be-runtime） ----
  singleQuestion({ key: "backend-engineering-sup-be-observability-s1", stageKey: "be-delivery", topicKey: "be-observability",
    stem: "为排查一条偶发的慢请求，最该在日志与追踪里保留的是？",
    options: ["贯穿全链路的 requestId 与各阶段耗时（span）以定位瓶颈环节", "完整的用户明文密码", "只记录日期不记录请求标识", "把所有 SQL 拼接进一条日志"],
    answer: "A",
    explanation: "偶发慢请求需要能把「一次请求」在网关、服务、数据库之间的调用串起来；requestId 让各服务日志可关联，span 耗时定位到具体卡在哪个下游或查询，从而精准优化；记录明文密码违反安全合规，散落的日志无法回溯。",
    difficulty: "hard", tags: ["可观测", "链路追踪"], sourceKey: "system-design-primer", level: "综合" }),
  judgeQuestion({ key: "backend-engineering-sup-be-observability-j1", stageKey: "be-delivery", topicKey: "be-observability",
    stem: "结构化日志（如 JSON 格式）比纯文本日志更利于机器检索、聚合与告警，但应注意不要在日志中输出敏感字段。",
    answer: true,
    explanation: "结构化日志把每条记录变成带字段的文档，可被日志系统按字段过滤、统计与告警，大幅提升排障效率；但同时必须做脱敏，避免把密码、token、身份证等敏感信息写入日志造成数据泄露，需配合字段级过滤。",
    difficulty: "hard", tags: ["日志", "脱敏"], sourceKey: "system-design-primer", level: "综合" }),

  // ---- be-migration-deploy（数据库迁移与滚动发布；stage: be-runtime） ----
  singleQuestion({ key: "backend-engineering-sup-be-migration-deploy-s1", stageKey: "be-delivery", topicKey: "be-migration-deploy",
    stem: "对一张千万级大表新增索引，不希望长时间锁表影响线上写入，正确方式是？",
    options: ["用 CREATE INDEX CONCURRENTLY 在后台不阻塞写入地建索引", "直接 CREATE INDEX 锁全表", "停服后再建", "在应用层建一份镜像索引"],
    answer: "A",
    explanation: "普通 CREATE INDEX 会对表加锁阻止写入，大表上可能持续数分钟到数十分钟造成写入中断；PostgreSQL 的 CREATE INDEX CONCURRENTLY 通过两阶段扫描在几乎不阻塞读写的情况下建索引，是线上大表加索引的标准做法（需留意失败残留的无效索引）。",
    difficulty: "hard", tags: ["迁移", "在线建索引"], sourceKey: "postgresql", level: "综合" }),
  judgeQuestion({ key: "backend-engineering-sup-be-migration-deploy-j1", stageKey: "be-delivery", topicKey: "be-migration-deploy",
    stem: "数据库迁移脚本一旦随版本发布并执行过，就不应该再修改历史脚本，而应追加新的迁移来表达后续变更。",
    answer: true,
    explanation: "已执行的迁移已固化在各环境的实际结构中，改写它不会让已执行过该脚本的环境重新跑，反而造成不同环境结构分叉、无法对齐；正确做法是只追加新迁移，使所有环境按相同顺序重放到同一最终结构，保证一致性与可回滚。",
    difficulty: "hard", tags: ["迁移", "可回滚"], sourceKey: "postgresql", level: "综合" }),
];
