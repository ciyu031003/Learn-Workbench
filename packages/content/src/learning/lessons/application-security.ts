import type { LearningTopicLesson } from "../types";

export const applicationSecurityTopicLessons: Record<string, LearningTopicLesson> = {
  "sec-trust-boundary": {
    overview: [
      "安全设计的第一步不是选工具，而是判断「谁的话不能信」。跨过进程或网络边界进入应用的数据，都应按不可信处理。",
      "把这条假设画进数据流图，才能看清校验与鉴权应该贴在哪些边上，而不是散落在业务代码里。",
    ],
    mechanism: [
      "可信域由代码与配置构成，边界是数据进入可信域的位置：HTTP 入口、消息回调、文件上传、上游 Webhook。",
      "攻击者可绕过任何客户端约束直接构造跨边界数据，因此边界后的服务端必须独立承担安全判定。",
    ],
    example: {
      title: "一条请求链路上的信任边界",
      language: "text",
      code: `浏览器/攻击者
   │  ← 不可信：参数、头部、Cookie、上传文件
   ▼
[网关]  ← 校验来源、限流
   │
   ▼
[应用]  ← 校验类型/范围、鉴权、业务规则
   │
   ▼
[数据库]  ← 最小权限账号，参数化查询`,
      explanation: "每个箭头跨越一次边界，也应在那里布置一次校验或鉴权；把安全判定集中到边界，能避免遗漏与重复。",
    },
    practiceSteps: [
      "列出系统全部数据入口，含接口、回调、上传与定时任务拉取。",
      "为每个入口标注它跨越的信任边界与服务端校验点。",
      "检查是否存在「只在前端校验」或「把内网调用当可信」的假设。",
    ],
    masteryChecklist: [
      "能为一条链路画出信任边界并指出必须校验的位置。",
      "能说明为什么客户端校验不能作为安全依据。",
    ],
  },
  "sec-input-validation": {
    overview: [
      "校验的目标是把不可信输入收敛到唯一的合法形态，而不是「过滤掉坏的字符串」。",
      "白名单加规范化的组合，比任何黑名单都更接近这个目标。",
    ],
    mechanism: [
      "黑名单枚举坏模式，永远落后于新的编码绕过；白名单只接受已知合法形态，未知变体默认拒绝。",
      "多重编码（URL 编码、Unicode、全角）能让同一段内容有多种表示，先解码规范化再校验才能收敛判断。",
    ],
    example: {
      title: "文件上传字段的白名单校验",
      language: "python",
      code: `ALLOWED = {".png", ".jpg", ".pdf"}
MAX_BYTES = 5 * 1024 * 1024

def validate_upload(filename: str, size: int) -> str:
    import os
    name = os.path.basename(filename)          # 去掉路径，防目录穿越
    ext = os.path.splitext(name)[1].lower()
    if ext not in ALLOWED:
        raise ValueError("不允许的扩展名")
    if size <= 0 or size > MAX_BYTES:
        raise ValueError("大小超限")
    return name`,
      explanation: "先取 basename 去掉路径、再比对扩展名白名单、最后限制大小，三步都在服务端执行，覆盖类型与范围。",
    },
    practiceSteps: [
      "为每个外部字段写出允许的形态（类型、长度、范围、格式）。",
      "在边界处统一挂载校验层，避免散落各处。",
      "为关键字段补上解码规范化后再校验，并写绕过用例验证。",
    ],
    masteryChecklist: [
      "能解释白名单相比黑名单的优势。",
      "能说明为什么先解码再校验更安全。",
    ],
  },
  "sec-least-privilege": {
    overview: [
      "最小权限让每个组件只拥有完成职责所需的操作，一次泄露不会升级为全盘失陷。",
      "与之配套的是失败安全：任何鉴权或校验环节出错时，默认拒绝而不是默认放行。",
    ],
    mechanism: [
      "权限过大时，一个低级漏洞（如 SQL 注入）就能借高权限账号读取或改写整库数据。",
      "fail-closed 让异常分支走向拒绝，避免「判断失败就当作通过」这类隐蔽放行。",
    ],
    example: {
      title: "只读报表服务的数据库账号",
      language: "sql",
      code: `-- 只读账号：仅授予报表所需库的 SELECT
REVOKE ALL ON DATABASE app FROM report_user;
GRANT CONNECT ON DATABASE app TO report_user;
GRANT USAGE ON SCHEMA public TO report_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO report_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO report_user;
-- 明确不授予 INSERT/UPDATE/DELETE/DDL`,
      explanation: "报表服务只需要读，就不应拿到写与建表权限；即使报表被注入，攻击面也被限制在读取范围内。",
    },
    practiceSteps: [
      "列出每个组件真正需要的操作集合。",
      "据此收敛数据库账号、服务凭据与网关策略。",
      "审查异常分支，确保失败时默认拒绝。",
    ],
    masteryChecklist: [
      "能为一个服务推导出最小权限集合。",
      "能举例说明失败时默认放行的危害。",
    ],
  },
  "sec-injection": {
    overview: [
      "注入的共同成因是：把数据拼接进了代码结构，使数据被当成指令执行。",
      "根本防线是让数据与结构分离——参数化查询、参数数组调用、独立模板。",
    ],
    mechanism: [
      "SQL 注入源于把用户输入拼进语句，数据库无法区分哪部分是数据。",
      "命令注入源于把输入拼进 shell 字符串，shell 的解析规则让转义极难覆盖全部边界。",
    ],
    example: {
      title: "从拼接查询改为参数化查询",
      language: "sql",
      code: `-- 危险：字符串拼接
-- SELECT * FROM users WHERE name = '" + name + "';

-- 安全：参数化占位符，数据永远不参与语句结构
SELECT id, name, email
FROM users
WHERE name = $1
LIMIT 1;`,
      explanation: "参数化让数据库把 $1 当作纯数据绑定，即使参数里含引号或注释符也不会改变语句结构。",
    },
    practiceSteps: [
      "搜索所有把外部输入拼接进查询/命令/模板的位置。",
      "逐一改造成参数化或结构化传递。",
      "为每处修复写出一个可复现的攻击载荷作为回归用例。",
    ],
    masteryChecklist: [
      "能说明参数化为什么比转义更可靠。",
      "能识别命令注入与 SQL 注入的相同成因。",
    ],
  },
  "sec-xss-output": {
    overview: [
      "XSS 的本质是数据被当作代码执行，因此防线重心在输出侧而非输入侧。",
      "按输出上下文选择编码方式，再用 CSP 叠加一层纵深防御。",
    ],
    mechanism: [
      "同一段文本渲染到 HTML 文本、属性、URL、JS 时，危险字符各不相同，需要各自对应的编码器。",
      "黑名单过滤标签会被编码绕过（如实体、大小写、非常规标签），只能覆盖已知手法。",
    ],
    example: {
      title: "按上下文编码输出",
      language: "javascript",
      code: `// 危险：直接注入 HTML
// el.innerHTML = userInput;

// 安全：作为文本插入，浏览器不会执行其中的标签
el.textContent = userInput;

// 必须输出到属性时，用框架/库的转义能力并按属性上下文处理
link.setAttribute("title", userInput);`,
      explanation: "把用户数据以文本方式插入，浏览器只当字符串处理；只有当数据必须进入 HTML 结构时才需要对应上下文的编码器。",
    },
    practiceSteps: [
      "列出所有把数据渲染进页面的位置及其输出上下文。",
      "按上下文选择编码方式，杜绝 innerHTML 直插。",
      "配置合理 CSP 作为额外一层，并验证不破坏功能。",
    ],
    masteryChecklist: [
      "能解释为什么防 XSS 的关键在输出侧。",
      "能说明 CSP 与输出编码的关系。",
    ],
  },
  "sec-csrf-cors": {
    overview: [
      "CSRF 利用浏览器会自动携带 Cookie 的特性，让受害者在已登录状态下发出非本意请求。",
      "CORS 则决定跨源请求能否读到响应，配置不当会破坏同源隔离。",
    ],
    mechanism: [
      "只要状态变更接口仅凭 Cookie 鉴权且不校验来源，攻击者就能在其他站点构造请求触发变更。",
      "允许凭证的跨源请求不允许用通配来源，否则等于把会话暴露给任意站点。",
    ],
    example: {
      title: "CSRF Token 与 SameSite 组合",
      language: "text",
      code: `POST /orders HTTP/1.1
Host: shop.example.com
Cookie: session=...; SameSite=Lax; Secure; HttpOnly
X-CSRF-Token: 9f2c...（与服务器会话绑定的随机值）
Origin: https://shop.example.com`,
      explanation: "SameSite 让跨站请求默认不带上会话 Cookie，CSRF Token 再由服务端校验请求确实来自本站页面，两者叠加更稳。",
    },
    practiceSteps: [
      "确认哪些写接口仅凭 Cookie 鉴权。",
      "为其补齐 CSRF Token / SameSite / Origin 校验中的至少两项。",
      "审查 CORS 配置，禁止通配来源配合凭证。",
    ],
    masteryChecklist: [
      "能说明 CSRF 与 CORS 分别防的是什么。",
      "能给出一个依赖 Cookie 的写接口的防护组合。",
    ],
  },
  "sec-password-hashing": {
    overview: [
      "口令存储的目标是：即使数据库泄露，攻击者也难以还原或批量破解口令。",
      "慢哈希与每用户独立随机盐是达成这个目标的基本条件。",
    ],
    mechanism: [
      "MD5/SHA 一类快速哈希每秒可尝试海量组合，GPU 下口令空间很快被穷举。",
      "bcrypt/argon2 通过可调成本因子拖慢每次计算，让穷举成本高到不可行。",
    ],
    example: {
      title: "用 bcrypt 存储与校验口令",
      language: "python",
      code: `import bcrypt

# 注册：生成含随机盐的哈希（盐已内嵌在结果里）
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))

# 登录：用同一哈希方法校验
ok = bcrypt.checkpw(password.encode(), hashed)
if not ok:
    raise PermissionError("用户名或口令错误")`,
      explanation: "gensalt 每次生成独立随机盐并内嵌进哈希串，rounds 控制成本；校验时无需单独存盐，checkpw 自动处理。",
    },
    practiceSteps: [
      "确认当前使用的哈希算法与成本参数。",
      "迁移到 bcrypt/argon2 并对每用户使用独立随机盐。",
      "审查注册、登录、重置三条路径，确保口令从不以可逆方式存储或返回。",
    ],
    masteryChecklist: [
      "能解释为什么快哈希不适合存口令。",
      "能说明随机盐如何对抗彩虹表。",
    ],
  },
  "sec-session-token": {
    overview: [
      "会话标识代表已认证身份，它的生成、存储、轮换与失效共同决定会话安全。",
      "一个被预测或未轮换的标识，等于把账号交给别人。",
    ],
    mechanism: [
      "会话固定的成因是攻击者预先设定标识，等受害者登录后直接复用；登录后轮换标识即可切断。",
      "HttpOnly 阻止脚本读取会话，Secure 限定仅 HTTPS 传输，SameSite 限制跨站携带。",
    ],
    example: {
      title: "安全的会话 Cookie 标志",
      language: "javascript",
      code: `res.cookie("session", sid, {
  httpOnly: true,   // 脚本读不到，降低 XSS 窃取风险
  secure: true,     // 仅 HTTPS 传输
  sameSite: "lax",  // 限制跨站携带
  path: "/",
  maxAge: 1000 * 60 * 60 * 8,
});
// 登录成功时重新生成 sid（会话固定防御）`,
      explanation: "三个标志各管一件事，登录成功后再轮换 sid，可同时防窃取、防明文传输与防跨站与固定攻击。",
    },
    practiceSteps: [
      "检查会话标识的随机性与长度是否足够。",
      "为会话 Cookie 配置 HttpOnly/Secure/SameSite。",
      "在登录、提权等敏感节点强制轮换标识，并设置合理过期与撤销。",
    ],
    masteryChecklist: [
      "能说明登录后不轮换会话会带来什么问题。",
      "能区分 HttpOnly 与 Secure 各自防什么。",
    ],
  },
  "sec-access-control": {
    overview: [
      "认证回答「你是谁」，授权回答「你能做什么、能动谁的资源」。",
      "越权往往不出在登录环节，而出在资源归属未被校验。",
    ],
    mechanism: [
      "水平越权是同级主体越界，如把 URL 里的订单 id 换成别人的。",
      "垂直越权是低权限做了高权限操作，如普通用户调用管理接口。",
    ],
    example: {
      title: "在资源访问点校验归属",
      language: "go",
      code: `// 危险：只按 id 取，谁都能读到
// order := repo.GetOrder(ctx, orderID)

// 安全：以「当前用户 + 资源」为条件查询
order, err := repo.GetOrderForUser(ctx, orderID, currentUserID)
if err != nil {
    return ErrNotFound // 不属于本人时按不存在处理，避免信息泄露
}`,
      explanation: "把主体归属作为查询条件的一部分，使越权在数据层就取不到数据；找不到时返回 404 而非 403，避免暴露资源存在性。",
    },
    practiceSteps: [
      "找出所有涉及资源 id 的接口。",
      "为每个接口补上主体-资源归属校验。",
      "审查前端隐藏入口的接口，确认后端有独立判定。",
    ],
    masteryChecklist: [
      "能区分水平越权与垂直越权并各举一例。",
      "能说明为什么前端隐藏不能作为访问控制。",
    ],
  },
  "sec-secrets": {
    overview: [
      "密钥管理的底线是：不落代码、可轮换、泄露可响应。",
      "密钥一旦进入版本历史，就必须按已失陷处理。",
    ],
    mechanism: [
      "提交到仓库的密钥会被历史、镜像、日志多处留存，删除当前文件并不能收回。",
      "泄露后应立刻轮换，因为攻击者可能已复制旧凭据；单纯改代码无法使旧值失效。",
    ],
    example: {
      title: "通过环境注入而非硬编码",
      language: "typescript",
      code: `// 危险：写死在代码里
// const dbPassword = "hunter2";

// 安全：从环境/密钥服务读取，启动时校验存在性
const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) {
  throw new Error("缺少 DB_PASSWORD，拒绝启动");
}

// 日志中绝不打印密钥本身，只记录是否已配置
logger.info("db credential loaded", { configured: true });`,
      explanation: "密钥从运行环境注入、启动时显式校验缺失、日志只记录存在性，三处共同避免密钥进入代码与日志。",
    },
    practiceSteps: [
      "清点全部密钥并确认没有硬编码或进日志。",
      "改为环境变量或密钥管理服务注入，并加启动校验。",
      "制定轮换周期与泄露响应流程。",
    ],
    masteryChecklist: [
      "能说明为什么改代码不能替代轮换密钥。",
      "能列出一份密钥清点与轮换方案。",
    ],
  },
  "sec-dependencies": {
    overview: [
      "现代应用大部分代码来自第三方，供应链风险因此成为常态。",
      "治理手段是锁定版本、持续审计与设定修复时限。",
    ],
    mechanism: [
      "版本区间让不同时间构建出不同依赖树，漏洞引入变得不可追踪；锁文件固定解析结果。",
      "依赖审计基于已知漏洞库比对，能发现间接依赖中的高危项。",
    ],
    example: {
      title: "CI 中的依赖审计门禁",
      language: "yaml",
      code: `steps:
  - name: 依赖审计（高危阻断）
    run: |
      npm audit --omit=dev --audit-level=high
  - name: 许可与来源检查
    run: node scripts/check-deps.mjs`,
      explanation: "把审计固化进流水线，高危漏洞直接让构建失败，配合许可检查避免引入许可不合规或来源不明的依赖。",
    },
    practiceSteps: [
      "确认锁文件被提交且构建使用锁定版本。",
      "在 CI 中加入依赖审计并对高危设定阻断。",
      "建立引入新依赖前的活跃度与许可评估清单。",
    ],
    masteryChecklist: [
      "能说明锁文件对供应链安全的作用。",
      "能给出高危依赖漏洞的处理流程。",
    ],
  },
  "sec-defense-in-depth": {
    overview: [
      "纵深防御承认单点控制会失效，因此在不同层叠加彼此独立的控制。",
      "脱敏审计日志让这些控制可被观测，从而及时发现正在发生的攻击。",
    ],
    mechanism: [
      "输入校验、鉴权、输出编码、运行时隔离与监控分别守住不同环节，任一层被绕过仍有兜底。",
      "审计日志记录关键安全事件，经脱敏后可用于实时告警而非仅仅事后取证。",
    ],
    example: {
      title: "分层控制与脱敏审计",
      language: "text",
      code: `输入层   → 白名单校验 + 规范化
鉴权层   → 资源归属校验 + 最小权限
输出层   → 上下文编码 + CSP
运行时   → 参数化查询 + 沙箱隔离
监控层   → 脱敏审计日志 + 异常告警

audit(event="auth.failed", user="u_123", ip="1.2.3.4")  # 不含口令/令牌明文`,
      explanation: "每层独立生效、互不替代；审计事件只记录必要字段并脱敏，既能告警又不引入新的泄露风险。",
    },
    practiceSteps: [
      "按输入、鉴权、输出、运行时、监控五层列出已部署的控制。",
      "找出仅靠单一层防护的环节并补齐兜底。",
      "为关键安全事件接入脱敏审计与告警。",
    ],
    masteryChecklist: [
      "能说明审计日志除取证外的实时价值。",
      "能为一个服务列出五层纵深防御控制清单。",
    ],
  },
};
