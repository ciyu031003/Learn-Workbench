import type { LearningTopicLesson } from "../types";

export const databaseTopicLessons: Record<string, LearningTopicLesson> = {
  "db-relational-model": {
    overview: [
      "关系数据库把数据组织成表：表是关系的载体，行是一条记录，列是同一种属性的取值。约束不是附加装饰，而是业务规则在数据层的表达。",
      "主键回答「这是哪一行」，外键回答「这一行属于谁」。把这两个问题交给数据库而不是只交给应用代码，才能在并发、批处理和手工运维时都不出现坏数据。",
    ],
    mechanism: [
      "建表时先声明主键，再声明唯一约束、非空约束与检查约束，最后用外键把引用关系写清楚。数据库会在每次写入时逐条验证这些约束。",
      "外键的删除行为需要显式选择：拒绝删除可以保护历史数据，级联删除适合从属明细，置空适合可选引用。默认行为往往不是业务想要的。",
    ],
    example: {
      title: "带完整约束的订单与明细",
      language: "sql",
      code: `CREATE TABLE orders (
  id          bigserial PRIMARY KEY,
  user_id     bigint      NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status      text        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'paid', 'cancelled')),
  total_cents integer     NOT NULL CHECK (total_cents >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id       bigserial PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku      text   NOT NULL,
  qty      integer NOT NULL CHECK (qty > 0),
  UNIQUE (order_id, sku)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);`,
      explanation: "订单用 RESTRICT 阻止删掉仍有订单的用户，明细用 CASCADE 随订单一起清理，`UNIQUE (order_id, sku)` 防止同一订单出现重复商品行。",
    },
    practiceSteps: [
      "写三张表的建表语句，逐条标注每条业务规则对应哪个约束。",
      "故意插入违反约束的数据，记录报错信息并确认错误定位到具体约束。",
      "尝试删除仍有外键引用的行，比较 RESTRICT 与 CASCADE 的行为差异。",
    ],
    masteryChecklist: [
      "能说明主键、唯一约束和外键各自保护什么，不会混用。",
      "能为每条业务规则指出对应的数据层约束。",
    ],
  },
  "db-select-join": {
    overview: [
      "SQL 是按声明写的，但数据库按固定顺序执行：先确定数据来源与连接，再过滤行，然后分组聚合，最后排序和限制输出。理解这个顺序才能预测结果。",
      "连接的本质是按键把两边的行配对。配对的粒度决定结果行数：一对一不会放大，一对多会放大，多对多会相乘。",
    ],
    mechanism: [
      "内连接只保留两侧都匹配的行；左连接保留左表全部行，右表缺失时补 NULL。把右表的过滤条件写在 ON 与写在 WHERE，会分别得到「保留左表全部」和「退化成内连接」两种结果。",
      "半连接只判断「存在」，使用 IN 或 EXISTS 表达；反连接判断「不存在」，通常用 NOT EXISTS。用不等号去表达存在性容易产生重复行。",
    ],
    example: {
      title: "有订单但从未支付的用户",
      language: "sql",
      code: `-- 左侧保留全部用户，只在 ON 里限制订单状态
SELECT u.id, u.name
  FROM users u
  LEFT JOIN orders o
         ON o.user_id = u.id
        AND o.status = 'paid'
 WHERE o.id IS NULL;

-- 等价的反连接写法，通常更直观
SELECT u.id, u.name
  FROM users u
 WHERE NOT EXISTS (
         SELECT 1 FROM orders o
          WHERE o.user_id = u.id
            AND o.status = 'paid'
       );`,
      explanation: "第一种写法把状态条件放在 ON 里，未支付用户仍会保留下来并在右表得到 NULL，再用 `o.id IS NULL` 筛出；第二种用 NOT EXISTS 直接表达「不存在支付记录」。",
    },
    practiceSteps: [
      "对同一个需求分别用 LEFT JOIN 与 NOT EXISTS 实现，比较执行计划。",
      "给一个多对多连接写出结果行数的上界，并用真实数据核对。",
      "把右表过滤条件从 ON 移到 WHERE，观察左连接为何退化成内连接。",
    ],
    masteryChecklist: [
      "能在写查询前说明结果的目标粒度。",
      "能解释 ON 与 WHERE 在左连接中的差别。",
    ],
  },
  "db-aggregate-window": {
    overview: [
      "聚合把多行折叠成一行，适合回答「总共多少」；窗口函数在同一分区内计算但保留每一行明细，适合回答「这一行相对同组的位置」。",
      "选择哪种写法，取决于结果里要不要保留明细行，而不是取决于哪种看起来更短。",
    ],
    mechanism: [
      "分组聚合先按分组键把行分到组里，再在组内计算聚合函数，HAVING 在聚合之后过滤结果组。非分组列必须出现在聚合函数里，否则语义不明确。",
      "窗口函数用 OVER 声明分区与排序，计算不会改变行数。排序不唯一时排名结果不稳定，需要补一个唯一列让顺序确定。",
    ],
    example: {
      title: "每个用户的最近一次登录与当日排名",
      language: "sql",
      code: `SELECT user_id,
       login_at,
       ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_at DESC) AS rn,
       RANK()       OVER (PARTITION BY DATE(login_at) ORDER BY login_at) AS day_rank
  FROM user_logins;`,
      explanation: "第一列按用户分区、按时间倒序编号，编号为 1 的就是最近一次登录；第二个窗口按天分区给出排名。只是查询明细时不要把窗口函数写进 WHERE。",
    },
    practiceSteps: [
      "取每个用户最近一次登录：先用窗口函数，再写成相关子查询，比较两种写法。",
      "观察同一份数据下 ROW_NUMBER 与 RANK 在并列值上的输出差异。",
      "给窗口加上唯一的次级排序列，验证结果在重复执行时保持稳定。",
    ],
    masteryChecklist: [
      "能说明一条需求该用聚合还是窗口函数。",
      "能解释为什么窗口排序必须加上唯一列。",
    ],
  },
  "db-index-basics": {
    overview: [
      "索引是一份额外维护的有序副本，让数据库能直接跳到目标区间而不是逐行扫描。代价是每次写入都要同步维护索引结构。",
      "B-Tree 索引先按第一列排序，再按第二列排序。因此复合索引的列顺序必须匹配查询的过滤与排序方式。",
    ],
    mechanism: [
      "等值过滤、范围过滤和最左前缀排序都能利用 B-Tree。反过来，只按第二列过滤、或在列上套函数，都无法定位区间。",
      "如果查询需要的列都在索引里，数据库可以只读索引而不回表，这叫覆盖索引，能显著减少随机读取。",
    ],
    example: {
      title: "为倒序分页设计复合索引",
      language: "sql",
      code: `CREATE INDEX idx_orders_user_created
    ON orders (user_id, created_at DESC);

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, created_at
  FROM orders
 WHERE user_id = 42
 ORDER BY created_at DESC
 LIMIT 20;`,
      explanation: "过滤列在前、排序列在后，索引可以同时服务过滤与排序，避免额外排序节点。用带 ANALYZE 的执行计划确认扫描行数与是否回表。",
    },
    practiceSteps: [
      "为一条真实查询设计复合索引，并解释列顺序的理由。",
      "在列上套一个函数，观察索引从计划中消失。",
      "把常用列全部放进索引做成覆盖索引，对比是否还需要回表。",
    ],
    masteryChecklist: [
      "能说出一个索引服务哪些查询、不服务哪些查询。",
      "能用执行计划而不是感觉验证索引是否生效。",
    ],
  },
  "db-explain": {
    overview: [
      "执行计划是优化器给出的执行方案：按什么顺序访问表、用什么算法连接、估算多少行。读懂它才能定位瓶颈。",
      "计划里的估算行数与实际行数如果差一个数量级，说明优化器拿到的统计信息已经不反映真实数据分布。",
    ],
    mechanism: [
      "节点从最内层开始执行，上层节点的代价包含下层。先看返回行数最多的节点，再判断瓶颈在扫描、连接还是排序。",
      "优化器会根据代价在顺序扫描、索引扫描和各种连接算法之间选择。数据量或选择性变化时，同一个 SQL 可能换一条完全不同的路径。",
    ],
    example: {
      title: "用计划对比改造前后",
      language: "sql",
      code: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT o.id
  FROM orders o
  JOIN users u ON u.id = o.user_id
 WHERE u.city = 'Urumqi';

ANALYZE orders;
ANALYZE users;`,
      explanation: "先拿到带实际行数的计划，再看估算与实际的偏差；如果偏差明显，先执行 ANALYZE 更新统计信息，然后重新对比同一份计划输出。",
    },
    practiceSteps: [
      "对一条慢查询输出计划，标出估算与实际偏差最大的节点。",
      "更新统计信息后重新导出计划，对比连接算法是否改变。",
      "把小表查询与达到数据量一半的大范围查询放到一起比较，说明顺序扫描何时是合理选择。",
    ],
    masteryChecklist: [
      "能指认计划中代价最高的节点。",
      "能区分「扫描慢」与「估算错」两类问题。",
    ],
  },
  "db-query-tuning": {
    overview: [
      "优化是减少数据库必须处理的数据量。加索引只是手段之一，改写查询、缩小时间范围、分批处理往往收益更大。",
      "深分页是典型反例：页码越靠后，数据库要扫描并丢弃的行越多，耗时随页码线性增长。",
    ],
    mechanism: [
      "谓词下推让过滤尽早发生，分区裁剪让数据库跳过无关分区，批处理把一次大事务拆成多个可提交的小事务。",
      "避免 N+1：如果外层查询每行都要再查一次子表，应改写成一次连接或一次批量查询，把往返次数降下来。",
    ],
    example: {
      title: "把深分页改成游标分页",
      language: "sql",
      code: `-- 越翻越慢：OFFSET 会先扫描并丢弃前面的行
SELECT id, created_at FROM orders
 ORDER BY created_at DESC, id DESC
 OFFSET 200000 LIMIT 20;

-- 游标分页：从上一页最后一行继续，扫描量恒定
SELECT id, created_at FROM orders
 WHERE (created_at, id) < ('2026-09-01T00:00:00Z', 918273)
 ORDER BY created_at DESC, id DESC
 LIMIT 20;`,
      explanation: "分页必须带唯一键（这里补了 id）保证顺序稳定；游标分页用上一页的边界值做过滤，避免扫描被丢弃的行。",
    },
    practiceSteps: [
      "把一条深分页查询改写为游标分页，记录两次扫描的行数。",
      "把一次循环内逐条查询改成一次批量查询，比较往返次数。",
      "给一条查询加上分区裁剪条件，确认数据库跳过了无关分区。",
    ],
    masteryChecklist: [
      "能量化优化前后的处理数据量，而不是只报耗时。",
      "能识别 N+1 查询并给出改写方案。",
    ],
  },
  "db-acid": {
    overview: [
      "事务把多条语句打包成一个整体：要么全部提交，要么全部回滚。事务边界的依据是业务不变量，而不是代码结构。",
      "原子性保证中间状态不会被别人看见，一致性保证约束在提交后仍然成立，持久性保证提交后的数据不会丢。",
    ],
    mechanism: [
      "数据库用日志记录变更，未提交的修改对其他事务不可见；提交时写日志并保证落到持久存储，崩溃后按日志恢复。",
      "回滚会撤销事务内的全部修改并释放锁。事务持续越久，占用的锁与回滚段越多，冲突概率越高。",
    ],
    example: {
      title: "扣减库存并生成订单",
      language: "sql",
      code: `BEGIN;

UPDATE stock
   SET qty = qty - 1
 WHERE sku = 'A-1001'
   AND qty > 0;

INSERT INTO orders (user_id, sku, status)
VALUES (42, 'A-1001', 'pending');

COMMIT;`,
      explanation: "扣减与下单必须一起成功：库存不足以 `qty > 0` 的条件返回 0 行时，应用应判定失败并回滚，不能只检查影响行数就继续。",
    },
    practiceSteps: [
      "写出一次事务的每一步状态，并标注异常时数据库停在哪里。",
      "把一次外部接口调用移出事务，比较持锁时间。",
      "构造扣减影响行数为 0 的情况，确认应用会判定失败并回滚。",
    ],
    masteryChecklist: [
      "能为一个业务场景说清必须一起成功的那一件事。",
      "能解释为什么事务里不应该做不可控的外部调用。",
    ],
  },
  "db-isolation": {
    overview: [
      "隔离级别决定并发事务之间能看到彼此多少中间结果。级别越高，异常越少，但冲突与重试越多。",
      "脏读、不可重复读、幻读是三个典型异常，不同级别挡住的异常不同，必须对着业务需求来选。",
    ],
    mechanism: [
      "多版本并发控制让读操作读取事务开始时的可见版本，从而不阻塞写；写操作按行加锁，冲突时排队或失败。",
      "当前读（如加锁读）会读取最新版本并加锁，因此即使快照读不冲突，当前读仍可能出现锁等待或序列化失败。",
    ],
    example: {
      title: "复现不可重复读的两会话脚本",
      language: "sql",
      code: `-- 会话 A
BEGIN ISOLATION LEVEL READ COMMITTED;
SELECT qty FROM stock WHERE sku = 'A-1001';

-- 会话 B：在 A 两次读之间提交修改
UPDATE stock SET qty = qty - 1 WHERE sku = 'A-1001';

-- 会话 A：同一事务内再次读，值已变化 → 不可重复读
SELECT qty FROM stock WHERE sku = 'A-1001';
COMMIT;`,
      explanation: "读已提交下每次语句都会看到最新已提交版本，所以同一事务内两次读数不同；换成可重复读后两次读会返回同一版本。",
    },
    practiceSteps: [
      "用两个会话复现不可重复读，再切换隔离级别观察差异。",
      "列出当前业务不能容忍的异常，逐条对照所选级别。",
      "把一次快照读改成当前读，观察锁等待与冲突是否出现。",
    ],
    masteryChecklist: [
      "能说明所选级别已挡住哪些异常。",
      "知道哪些异常必须由应用层补充处理。",
    ],
  },
  "db-lock-deadlock": {
    overview: [
      "锁是并发控制的基本单位。行锁粒度小、并发高，表锁粒度大、冲突少但阻塞面广。",
      "死锁是两个以上事务互相等待对方持有的锁。数据库会检测到环路并回滚其中一个事务，让它重试。",
    ],
    mechanism: [
      "共享锁允许多个读者共存，排他锁与任何锁互斥。更新同一行的两个事务必然有一个先拿到锁。",
      "死锁的常见来源是不同事务以不同顺序访问同一批资源。统一加锁顺序能把循环等待变成排队等待，从根上减少死锁。",
    ],
    example: {
      title: "统一顺序加锁 + 退避重试",
      language: "sql",
      code: `BEGIN;
-- 约定：始终按主键升序占位，避免循环等待
SELECT id FROM accounts WHERE id IN (10, 20) ORDER BY id FOR UPDATE;
UPDATE accounts SET balance = balance - 100 WHERE id = 10;
UPDATE accounts SET balance = balance + 100 WHERE id = 20;
COMMIT;

-- 应用侧伪代码：捕获死锁错误码后重试
-- for attempt in 1..3:
--   try: runTransaction()
--   catch deadlock: sleep(50ms * 2 ** attempt)`,
      explanation: "先用一条按主键排序的加锁读把目标行固定下来，保证所有事务顺序一致；应用层对死锁错误做指数退避重试。",
    },
    practiceSteps: [
      "构造一个死锁场景，从数据库日志找出被牺牲的事务。",
      "为它加上退避重试，并设定最大重试次数与最终失败行为。",
      "把两个事务的加锁顺序统一后重跑同一场景，确认死锁不再出现。",
    ],
    masteryChecklist: [
      "能定位死锁涉及的事务与语句。",
      "能说明重试的边界、上限与放弃条件。",
    ],
  },
  "db-normalization": {
    overview: [
      "范式化把每个事实只存一处，避免同一信息多处修改不一致；冗余把常用结果预先算好，用一致性成本换查询速度。",
      "取舍依据是读写比例与一致性要求，不是个人风格。写多读少时冗余往往得不偿失。",
    ],
    mechanism: [
      "第一范式要求字段原子，第二范式消除部分依赖，第三范式消除传递依赖。建模先走到第三范式，再针对确认的热点做冗余。",
      "冗余字段必须写明维护方：由哪个写入路径更新、何时更新、如何定期校验是否漂移。没有维护方的冗余字段迟早不一致。",
    ],
    example: {
      title: "范式化模型与可安全冗余的字段",
      language: "sql",
      code: `CREATE TABLE courses (
  id     bigserial PRIMARY KEY,
  title  text NOT NULL
);

CREATE TABLE enrollments (
  id         bigserial PRIMARY KEY,
  course_id  bigint NOT NULL REFERENCES courses(id),
  user_id    bigint NOT NULL REFERENCES users(id),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id)
);

-- 冗余示例：报名人数由报名表维护，可定期重算校验
ALTER TABLE courses ADD COLUMN enrolled_count integer NOT NULL DEFAULT 0;`,
      explanation: "报名事实只存在 enrollments 一张表里；courses.enrolled_count 是明确的冗余，它的维护方是报名与退课的写入路径，并可用计数查询定期重算比对。",
    },
    practiceSteps: [
      "为课程与报名写出第三范式模型。",
      "指出可以冗余的字段，并写出它的更新来源与校验 SQL。",
      "用计数查询重算冗余字段，验证它是否与明细一致。",
    ],
    masteryChecklist: [
      "能为每个冗余字段指明维护方。",
      "能说明为什么统计值不能当作业务事实使用。",
    ],
  },
  "db-migration-safe": {
    overview: [
      "迁移是结构变更的版本化记录。已应用的文件不能再改，否则不同环境的结构会分叉。",
      "安全迁移的目标是：每一步都能独立验证、能重复执行、能单独回滚，而不是一次性完成所有改动。",
    ],
    mechanism: [
      "加可空字段几乎不阻塞写入；回填数据要分批提交；最后再加非空约束。三步拆开后，中途失败可以安全重跑。",
      "大表加索引与改列类型可能持有较长锁，应评估锁级别与耗时，必要时使用不阻塞写入的在线变更方式。",
    ],
    example: {
      title: "三步迁移与对应回滚",
      language: "sql",
      code: `-- 第 1 步：加可空字段（快，几乎不阻塞）
ALTER TABLE orders ADD COLUMN channel text;

-- 第 2 步：分批回填，可重复执行
UPDATE orders SET channel = 'web'
 WHERE channel IS NULL AND id BETWEEN 1 AND 100000;

-- 第 3 步：补默认值与非空约束
ALTER TABLE orders ALTER COLUMN channel SET DEFAULT 'web';
ALTER TABLE orders ALTER COLUMN channel SET NOT NULL;

-- 回滚：DROP COLUMN 即可（第 3 步之前回滚更安全）
-- ALTER TABLE orders DROP COLUMN channel;`,
      explanation: "每一步都能单独执行并在失败后重跑：字段可空时回填不会失败，回填按主键区间分批避免长事务，最后才收紧约束。",
    },
    practiceSteps: [
      "为大表增加非空字段写出三步迁移与逐步回滚。",
      "在演练库执行一次，记录每步耗时与锁等待。",
      "故意在第 2 步中断后重跑，确认回填语句可以安全重复执行。",
    ],
    masteryChecklist: [
      "能说明迁移中途失败后数据库停在哪里。",
      "能保证每条迁移语句可重复执行。",
    ],
  },
  "db-backup-recovery": {
    overview: [
      "备份的价值由恢复能力定义。备份频率与保留策略应由「能接受丢多少数据、多久恢复」倒推得出。",
      "恢复演练必须在独立环境进行，否则一次演练就可能变成生产事故。",
    ],
    mechanism: [
      "全量备份提供基准点，增量或日志备份缩短可恢复粒度。时间点恢复把两者叠加，可以回到某个具体时刻。",
      "恢复耗时由数据量、IO 能力与日志重放量共同决定。只测备份速度而不测恢复耗时，等于没有掌握真实恢复能力。",
    ],
    example: {
      title: "演练环境恢复并记录耗时",
      language: "bash",
      code: `# 在演练实例上恢复全量备份
pg_restore --clean --if-exists -d lwb_drill /backup/lwb_full.dump

# 重放日志到指定时间点（时间点恢复）
# recovery_target_time = '2026-10-10 09:30:00+08'

# 记录关键指标：恢复总耗时、日志重放量、校验结果
psql -d lwb_drill -c 'SELECT count(*) FROM knowledge_points;'`,
      explanation: "在独立演练库上恢复并统计关键行数，既验证备份可用，也得到真实的恢复耗时与重放量，用于倒推生产恢复目标。",
    },
    practiceSteps: [
      "在演练库执行一次完整恢复，记录耗时与卡点。",
      "写出一份恢复步骤清单，包含校验查询与失败判定。",
      "对比全量恢复与时间点恢复的耗时差异，据此校准恢复目标。",
    ],
    masteryChecklist: [
      "能报出最近一次恢复演练的时间与结果。",
      "能区分数据增长与查询放大造成的容量问题。",
    ],
  },
};
