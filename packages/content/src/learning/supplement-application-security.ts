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

/** 应用安全 补充题库（按知识点细分，2 题/知识点）。 */
export const applicationsecuritySupplementQuestions: LearningQuestion[] = [
  // ---- sec-trust-boundary （阶段：sec-foundation） ----
  singleQuestion({ key: "application-security-sup-sec-trust-boundary-s1", stageKey: "sec-foundation", topicKey: "sec-trust-boundary",
    stem: "在一次 Web 请求中，来自外部系统的「服务端到服务端回调（webhook）」应当如何对待？",
    options: ["因为来自系统内部服务所以可以完全信任", "因为走内网通道所以必然可信", "只要校验了来源 IP 白名单就绝对安全", "仍应视为不可信输入，对签名、来源与内容进行独立校验"],
    answer: "D",
    explanation: "网络边界与进程边界本身就是信任边界，服务端到服务端回调同样可能被伪造、重放或经内网被横向移动攻击。正确做法是把回调当作不可信输入，独立校验签名/来源/来源认证与数据合法性，而不是因为「内网」或「同系统」就默认放行。",
    difficulty: "medium", tags: ["信任边界", "webhook"], sourceKey: "juice-shop", level: "进阶" }),
  judgeQuestion({ key: "application-security-sup-sec-trust-boundary-j1", stageKey: "sec-foundation", topicKey: "sec-trust-boundary",
    stem: "只要数据经过了 TLS 加密传输，服务端就可以把该数据当作完全可信的输入处理。",
    answer: false,
    explanation: "TLS 只保证传输过程中的机密性与完整性，解决的是「中间人窃听/篡改」，并不证明数据的业务合法性。攻击者仍可在加密通道内发送恶意载荷，因此到达应用边界后的数据仍需按不可信处理，做校验、鉴权与规范化。",
    difficulty: "easy", tags: ["信任边界", "TLS"], sourceKey: "juice-shop", level: "入门" }),

  // ---- sec-input-validation （阶段：sec-foundation） ----
  singleQuestion({ key: "application-security-sup-sec-input-validation-s1", stageKey: "sec-foundation", topicKey: "sec-input-validation",
    stem: "对「邮箱地址」这类结构化字段，下列做法中最稳妥的输入校验策略是？",
    options: ["用一条很长的正则黑名单过滤危险字符", "先用白名单定义合法字符集与格式并拒绝一切不匹配项", "只在前端用 JS 校验即可", "把输入原样存储后再做清理"],
    answer: "B",
    explanation: "结构化字段适合采用白名单（正模型）校验：先明确「什么才是合法的」（字符集、长度、格式），不匹配则默认拒绝。白名单天然覆盖未知绕过手法，而黑名单永远滞后于新变体；前端校验只是体验层，不能作为服务端信任依据。",
    difficulty: "easy", tags: ["输入校验", "白名单"], sourceKey: "owasp-cheatsheets", level: "入门" }),
  judgeQuestion({ key: "application-security-sup-sec-input-validation-j1", stageKey: "sec-foundation", topicKey: "sec-input-validation",
    stem: "对用户输入进行 Unicode 规范化（如 NFC 归一化）并在解码之后再校验，可以有效减少「编码绕过」类攻击。",
    answer: true,
    explanation: "攻击常利用多层编码（如 %2e%2e、全角/半角、不同 Unicode 归一形态）绕过朴素过滤。先做 URL 解码、归一化到唯一规范表示，再做白名单校验，能保证校验对象与后续处理对象完全一致，从而显著削弱编码绕过。",
    difficulty: "medium", tags: ["规范化", "编码绕过"], sourceKey: "owasp-cheatsheets", level: "进阶" }),

  // ---- sec-least-privilege （阶段：sec-foundation） ----
  singleQuestion({ key: "application-security-sup-sec-least-privilege-s1", stageKey: "sec-foundation", topicKey: "sec-least-privilege",
    stem: "「失败安全（fail-safe / fail-closed）」原则要求鉴权或校验环节发生异常时应当？",
    options: ["默认放行以保证可用性", "默认拒绝访问并进入最小权限状态", "自动重试而不记录日志", "忽略错误继续处理请求"],
    answer: "B",
    explanation: "失败安全指安全控制（鉴权、校验、限流）在异常时采用「fail-closed」：默认拒绝而非放行。因为放行带来的危害（越权、数据泄露）通常远大于拒绝带来的可用性损失，故安全组件异常时应按拒绝/最小权限处理并记录告警。",
    difficulty: "medium", tags: ["最小权限", "失败安全"], sourceKey: "owasp-cheatsheets", level: "进阶" }),
  judgeQuestion({ key: "application-security-sup-sec-least-privilege-j1", stageKey: "sec-foundation", topicKey: "sec-least-privilege",
    stem: "为应用分配数据库账号时，遵循最小权限原则意味着该账号不应直接使用数据库超级用户（如 root / postgres 超级角色）。",
    answer: true,
    explanation: "最小权限要求账号只拥有完成业务所必需的库表与操作权限。若应用使用超级用户，一次 SQL 注入或凭据泄露就会直接升级为全库乃至主机失陷；按业务拆分只读/读写账号、限制到具体表与列才是正确做法。",
    difficulty: "easy", tags: ["最小权限", "数据库账号"], sourceKey: "owasp-wstg", level: "入门" }),

  // ---- sec-web （阶段：sec-foundation） ----
  singleQuestion({ key: "application-security-sup-sec-web-s1", stageKey: "sec-web", topicKey: "sec-injection",
    stem: "「输出编码（output encoding）」与「输入校验」在防御注入中的关系是？",
    options: ["两者互斥，只能选其一", "输入校验在前、输出编码在后，是互补的两道独立防线", "输出编码可完全替代输入校验", "输入校验可完全替代输出编码"],
    answer: "B",
    explanation: "输入校验负责把非法数据挡在门外（正模型），输出编码负责在把数据送回浏览器/命令行/解释器时按上下文转义，防止数据被当成代码执行。两者针对不同环节、互不替代，属于纵深防御中互补的两层。",
    difficulty: "medium", tags: ["输出编码", "输入校验"], sourceKey: "owasp-cheatsheets", level: "进阶" }),
  judgeQuestion({ key: "application-security-sup-sec-web-j1", stageKey: "sec-web", topicKey: "sec-injection",
    stem: "只要对用户输入做了严格的输入校验，就不需要再针对不同输出上下文做输出编码。",
    answer: false,
    explanation: "输入校验通常只覆盖「进入系统」这一个方向，而同一份数据可能流向 HTML、HTML 属性、URL、JavaScript、CSS 或 shell 等多种上下文，每种上下文的转义规则不同。仅在输入处把关无法保证所有出口都安全，输出时仍须按上下文正确编码。",
    difficulty: "medium", tags: ["输出编码", "纵深防御"], sourceKey: "owasp-cheatsheets", level: "进阶" }),

  // ---- sec-injection （阶段：sec-foundation） ----
  singleQuestion({ key: "application-security-sup-sec-injection-s1", stageKey: "sec-web", topicKey: "sec-injection",
    stem: "为了从根本层面防止用户可控数据进入 OS 命令执行，下列做法最恰当的是？",
    options: ["把输入中的 && 和 ; 替换为空", "使用不经由 shell 的 API，将参数以数组形式传入进程", "用正则黑名单删掉所有特殊字符", "把命令写入临时文件再执行"],
    answer: "B",
    explanation: "命令注入的根因是把数据拼进 shell 可解释的字符串。最稳妥的办法是避免使用 shell：调用进程/库函数时把可执行文件与参数作为独立数组传入，shell 不再参与解析，用户输入永远只是参数而非代码，转义式黑名单难以覆盖全部边界。",
    difficulty: "hard", tags: ["命令注入", "参数化"], sourceKey: "juice-shop", level: "综合" }),
  judgeQuestion({ key: "application-security-sup-sec-injection-j1", stageKey: "sec-web", topicKey: "sec-injection",
    stem: "使用参数化查询（预编译占位符）可以从根本上避免 SQL 注入。",
    answer: true,
    explanation: "参数化查询把 SQL 语句结构与数据彻底分离，占位符处的参数始终被数据库当作数据而非可执行代码，因此拼接 + 转义那种容易遗漏的写法相比，它是防御 SQL 注入的根本手段。但需注意动态表名/列名无法参数化，仍需白名单控制。",
    difficulty: "easy", tags: ["SQL注入", "参数化查询"], sourceKey: "juice-shop", level: "入门" }),

  // ---- sec-xss-output （阶段：sec-foundation） ----
  singleQuestion({ key: "application-security-sup-sec-xss-output-s1", stageKey: "sec-web", topicKey: "sec-xss-output",
    stem: "把用户输入输出到 HTML 页面中的「<a href=\"...\">」链接属性时，最合适的编码方式是？",
    options: ["只做 HTML 实体编码即可", "对属性值做属性上下文编码，并对 URL 做白名单协议校验（如只允许 http/https）", "原样输出但加上引号", "去掉所有空格"],
    answer: "B",
    explanation: "XSS 的编码必须匹配输出上下文：链接 href 属性既处于 HTML 属性上下文又可能是 URL 上下文。正确做法是先做 HTML 属性编码，再对 URL 做协议白名单校验（禁止 javascript: 等危险协议），否则仅做 HTML 编码仍可能通过伪协议执行脚本。",
    difficulty: "hard", tags: ["XSS", "输出编码", "URL"], sourceKey: "juice-shop", level: "综合" }),
  judgeQuestion({ key: "application-security-sup-sec-xss-output-j1", stageKey: "sec-web", topicKey: "sec-xss-output",
    stem: "仅通过设置 Content-Security-Policy（CSP）就可以完全不必再对输出做编码来防 XSS。",
    answer: false,
    explanation: "CSP 属于纵深防御的缓解层，能限制脚本来源、降低 XSS 危害，却无法替代按上下文输出编码。一旦策略过于宽松、存在内联脚本允许点或 JSONP 等可绕过点，XSS 仍会发生。编码是根本手段，CSP 是兜底。",
    difficulty: "hard", tags: ["CSP", "纵深防御"], sourceKey: "owasp-cheatsheets", level: "综合" }),

  // ---- sec-csrf-cors （阶段：sec-foundation） ----
  singleQuestion({ key: "application-security-sup-sec-csrf-cors-s1", stageKey: "sec-web", topicKey: "sec-csrf-cors",
    stem: "关于 CORS 与凭证请求，下列配置正确的是？",
    options: ["Access-Control-Allow-Origin 设为 * 且 Access-Control-Allow-Credentials 为 true", "Access-Control-Allow-Origin 反射为请求来源并校验白名单，配合明确的允许方法与头部", "任意来源都允许携带 Cookie 以提升兼容性", "完全关闭预检（OPTIONS）请求"],
    answer: "B",
    explanation: "携带凭证（Cookie）的跨域请求不允许使用通配来源 *，浏览器会拒绝。正确做法是把 Allow-Origin 反射回已校验的受信任来源（或使用显式白名单），并显式声明允许的方法与头部，同时配合 SameSite 与 CSRF Token 形成多层防护。",
    difficulty: "hard", tags: ["CORS", "跨域", "凭证"], sourceKey: "owasp-cheatsheets", level: "综合" }),
  judgeQuestion({ key: "application-security-sup-sec-csrf-cors-j1", stageKey: "sec-web", topicKey: "sec-csrf-cors",
    stem: "将会话 Cookie 的 SameSite 属性设置为 Strict 或 Lax，可以在多数场景下显著缓解 CSRF 攻击。",
    answer: true,
    explanation: "CSRF 利用浏览器自动携带 Cookie 发起跨站请求。SameSite=Strict/Lax 会限制第三方上下文中 Cookie 的发送，使跨站伪造请求难以带上凭证，从而显著削弱 CSRF；但它不能替代 CSRF Token 等校验，仍应作为纵深防御的一层。",
    difficulty: "medium", tags: ["CSRF", "SameSite"], sourceKey: "owasp-cheatsheets", level: "进阶" }),

  // ---- sec-auth （阶段：sec-foundation） ----
  singleQuestion({ key: "application-security-sup-sec-auth-s1", stageKey: "sec-auth", topicKey: "sec-password-hashing",
    stem: "在登录认证流程中，下列做法最符合安全基线的是？",
    options: ["错误用户名与错误口令返回完全相同的通用提示，并对尝试次数做限流", "错误时明确提示「口令错误」以方便用户排查", "允许无限次试错以优化体验", "把登录凭证写入前端日志"],
    answer: "A",
    explanation: "认证环节应做到两点：一是避免账号枚举，对未知账号与错误口令返回一致的通用错误（如「用户名或口令不正确」）；二是做速率限制/锁定与验证码以对抗暴力破解。明确区分「账号不存在/口令错」会暴露账号是否存在，方便攻击者枚举。",
    difficulty: "medium", tags: ["认证", "防爆破", "账号枚举"], sourceKey: "owasp-cheatsheets", level: "进阶" }),
  judgeQuestion({ key: "application-security-sup-sec-auth-j1", stageKey: "sec-auth", topicKey: "sec-password-hashing",
    stem: "认证（authentication）与授权（authorization）是同一件事，只要完成了登录就自动获得了访问任意资源的权限。",
    answer: false,
    explanation: "认证解决「你是谁」（身份确认），授权解决「你能做什么」（权限判定），二者职责不同。即便登录成功，每次访问敏感资源仍需依据角色/策略做独立的访问控制校验，绝不能因已登录就默认放行所有操作。",
    difficulty: "easy", tags: ["认证", "授权"], sourceKey: "owasp-cheatsheets", level: "入门" }),

  // ---- sec-password-hashing （阶段：sec-foundation） ----
  singleQuestion({ key: "application-security-sup-sec-password-hashing-s1", stageKey: "sec-auth", topicKey: "sec-password-hashing",
    stem: "存储用户口令时，下列做法最安全的是？",
    options: ["使用 MD5 直接哈希后存储", "使用带每用户随机盐（salt）的慢哈希算法（如 bcrypt/Argon2/scrypt）", "把口令明文存库方便找回", "用 Base64 编码代替哈希"],
    answer: "B",
    explanation: "口令属于高熵敏感数据，必须用自适应慢哈希（bcrypt/Argon2id/scrypt 等）并配合每用户随机盐。慢哈希能大幅提高暴力破解成本，盐能阻止彩虹表与跨用户相同口令的批量破解；MD5/SHA 等快速摘要过慢且易受 GPU 加速攻击，明文或编码更不可取。",
    difficulty: "medium", tags: ["口令存储", "慢哈希", "盐"], sourceKey: "owasp-cheatsheets", level: "进阶" }),
  judgeQuestion({ key: "application-security-sup-sec-password-hashing-j1", stageKey: "sec-auth", topicKey: "sec-password-hashing",
    stem: "为了安全存储口令，使用 SHA-256 对口令做一次哈希（不加 salt）已经足够。",
    answer: false,
    explanation: "SHA-256 是快速摘要算法，不加盐的单一哈希既无法抵御彩虹表，也无法区分相同口令的不同用户，且可被 GPU 大规模并行暴力破解。安全口令存储需要慢哈希（如 Argon2/bcrypt）加每用户随机盐，而非快速无盐哈希。",
    difficulty: "medium", tags: ["口令存储", "SHA", "盐"], sourceKey: "owasp-cheatsheets", level: "进阶" }),

  // ---- sec-session-token （阶段：sec-foundation） ----
  singleQuestion({ key: "application-security-sup-sec-session-token-s1", stageKey: "sec-auth", topicKey: "sec-session-token",
    stem: "关于会话令牌（session token）的安全属性，下列描述最准确的是？",
    options: ["令牌只需足够长即可，随机性不重要", "令牌应具备足够熵（随机/不可预测），通过 HTTPS 传输并设 HttpOnly+Secure，且支持服务端注销", "令牌可以长期不轮换也无风险", "把令牌放在 URL 参数里最方便且同样安全"],
    answer: "B",
    explanation: "安全的会话令牌需要：高熵且不可预测以防被猜测；经 TLS 传输并打上 Secure 防明文泄露；设 HttpOnly 防止 JS 读取被 XSS 窃取；设置合理过期与空闲超时；服务端能主动作废（注销/改密失效）。放 URL 易泄露于日志与 Referer，长期不轮换增大失窃窗口。",
    difficulty: "hard", tags: ["会话令牌", "HttpOnly", "注销"], sourceKey: "owasp-wstg", level: "综合" }),
  judgeQuestion({ key: "application-security-sup-sec-session-token-j1", stageKey: "sec-auth", topicKey: "sec-session-token",
    stem: "将会话 Cookie 标记为 HttpOnly 可以防止 JavaScript 通过 document.cookie 读取该 Cookie，从而缓解 XSS 窃取会话令牌的风险。",
    answer: true,
    explanation: "HttpOnly 指示浏览器禁止脚本访问该 Cookie，即使页面存在 XSS 漏洞，攻击者用 document.cookie 也读不到令牌，降低了会话被窃后冒用的可能。但它不能修复 XSS 本身，仍需配合输出编码与 CSP 等综合防护。",
    difficulty: "medium", tags: ["会话", "HttpOnly", "XSS"], sourceKey: "owasp-wstg", level: "进阶" }),

  // ---- sec-access-control （阶段：sec-web） ----
  singleQuestion({ key: "application-security-sup-sec-access-control-s1", stageKey: "sec-auth", topicKey: "sec-access-control",
    stem: "某接口通过隐藏前端按钮来「限制」普通用户访问管理员功能，后端未做校验。这种做法属于？",
    options: ["安全的默认拒绝设计", "典型的缺失服务端授权检查（越权/IDOR 隐患）", "符合最小权限原则", "等同于角色鉴权"],
    answer: "B",
    explanation: "仅在前端隐藏入口只是界面层面的「障眼法」，攻击者可直接构造请求访问接口。任何敏感操作都必须由服务端基于当前身份与资源归属做显式授权校验（基于角色的访问控制/基于属性的访问控制），前端隐藏不能替代后端鉴权。",
    difficulty: "medium", tags: ["授权", "越权", "IDOR"], sourceKey: "owasp-cheatsheets", level: "进阶" }),
  judgeQuestion({ key: "application-security-sup-sec-access-control-j1", stageKey: "sec-auth", topicKey: "sec-access-control",
    stem: "在基于对象的接口（如 /api/order/{id}）中，仅校验「用户已登录」而不校验「该订单属于当前用户」，会导致水平越权（IDOR）。",
    answer: true,
    explanation: "水平越权指同权限级别的用户访问了他人的资源。若只判断登录态而忽略资源归属（order.id 是否属于当前 user.id），攻击者可遍历/篡改 ID 访问他人数据。正确做法是服务端依据身份与资源所有权做访问控制校验，并对 ID 做不可猜测化处理。",
    difficulty: "hard", tags: ["越权", "IDOR", "资源归属"], sourceKey: "owasp-cheatsheets", level: "综合" }),

  // ---- sec-defense （阶段：sec-web） ----
  singleQuestion({ key: "application-security-sup-sec-defense-s1", stageKey: "sec-defense", topicKey: "sec-secrets",
    stem: "下列哪一项最能体现「纵深防御（defense in depth）」的思想？",
    options: ["只在最外层加一道防火墙", "单层强校验即可，无需其他措施", "在输入校验、输出编码、鉴权、日志监控等多层都设置相互独立且可叠加的防护", "把所有安全逻辑都放进前端"],
    answer: "C",
    explanation: "纵深防御主张不依赖单一控制点，而是在攻击链的各阶段（边界、输入、处理、输出、运行时监控）部署相互独立、可叠加的防御措施。任一层被绕过，仍有其他层兜底，从而降低单点失效导致整体被攻破的概率。",
    difficulty: "medium", tags: ["纵深防御", "多层防护"], sourceKey: "owasp-cheatsheets", level: "进阶" }),
  judgeQuestion({ key: "application-security-sup-sec-defense-j1", stageKey: "sec-defense", topicKey: "sec-secrets",
    stem: "只要部署了 WAF（Web 应用防火墙），后端应用就可以不再做输入校验与输出编码。",
    answer: false,
    explanation: "WAF 是边界辅助手段，存在规则绕过、误判与内部请求不经过 WAF 等情况，不能作为唯一防线。纵深防御要求应用自身仍要做输入校验、参数化查询、输出编码与鉴权；WAF 仅作为额外缓解层，绝不能替代代码层的安全实践。",
    difficulty: "medium", tags: ["WAF", "纵深防御"], sourceKey: "owasp-cheatsheets", level: "进阶" }),

  // ---- sec-secrets （阶段：sec-web） ----
  singleQuestion({ key: "application-security-sup-sec-secrets-s1", stageKey: "sec-defense", topicKey: "sec-secrets",
    stem: "关于应用密钥与凭据（如数据库口令、API Key）的管理，下列做法最安全的是？",
    options: ["硬编码在源码并提交到 Git 仓库", "写入前端公开的配置文件供调用", "通过环境变量或专用密钥管理服务（如 Vault/KMS）注入，并做最小权限与定期轮换", "用明文保存在共享网盘方便团队取用"],
    answer: "C",
    explanation: "密钥不应进入源码或前端，也不宜明文散落。正确做法是借助环境变量、密钥管理服务或云 KMS 集中保管，严格控制访问权限，启用加密存储与审计，并定期轮换、支持紧急吊销。源码中的硬编码密钥极易随仓库泄露而大面积扩散。",
    difficulty: "medium", tags: ["密钥管理", "凭据", "KMS"], sourceKey: "owasp-wstg", level: "进阶" }),
  judgeQuestion({ key: "application-security-sup-sec-secrets-j1", stageKey: "sec-defense", topicKey: "sec-secrets",
    stem: "把数据库口令等机密以明文形式硬编码进源码并提交到版本控制系统，是一种可接受的临时做法。",
    answer: false,
    explanation: "源码仓库的读取权限通常较宽，且历史提交难以彻底清除，硬编码的口令会随仓库克隆、备份、CI 日志而广泛扩散，一旦泄露需全量轮换。机密应外置到密钥管理系统或环境变量，并纳入轮换与访问审计流程。",
    difficulty: "easy", tags: ["密钥管理", "硬编码", "泄露"], sourceKey: "owasp-wstg", level: "入门" }),

  // ---- sec-dependencies （阶段：sec-web） ----
  singleQuestion({ key: "application-security-sup-sec-dependencies-s1", stageKey: "sec-defense", topicKey: "sec-dependencies",
    stem: "针对软件供应链与第三方依赖的安全风险，下列措施最有效的是？",
    options: ["从不更新依赖以保持稳定", "仅依赖数量越多越好", "使用软件成分分析（SCA）持续扫描依赖漏洞，并锁定版本、校验来源完整性（校验和/签名）", "完全照搬他人 package.json 即可"],
    answer: "C",
    explanation: "第三方依赖是主要的攻击面之一。应建立软件成分分析（SCA）流程，持续监控已知漏洞并打补丁；通过锁文件固定版本、使用可信源并校验包完整性（哈希/签名），避免引入被投毒或劫持的版本，从而控制供应链风险。",
    difficulty: "hard", tags: ["供应链", "依赖", "SCA"], sourceKey: "owasp-wstg", level: "综合" }),
  judgeQuestion({ key: "application-security-sup-sec-dependencies-j1", stageKey: "sec-defense", topicKey: "sec-dependencies",
    stem: "安装依赖时只管「能跑就行」，不关注依赖的来源可信度与已知漏洞，不会显著增加应用被供应链攻击的风险。",
    answer: false,
    explanation: "现代应用大量依赖开源包，恶意或被攻陷的依赖（投毒、维护者账号被盗、镜像劫持）可直接执行任意代码。忽视依赖来源校验、版本锁定与漏洞扫描，会让供应链攻击长驱直入。应使用可信源、锁版本并持续做漏洞扫描与更新。",
    difficulty: "medium", tags: ["供应链", "依赖", "投毒"], sourceKey: "owasp-wstg", level: "进阶" }),

  // ---- sec-defense-in-depth （阶段：sec-auth） ----
  singleQuestion({ key: "application-security-sup-sec-defense-in-depth-s1", stageKey: "sec-defense", topicKey: "sec-defense-in-depth",
    stem: "在认证与会话场景中，下列组合最能体现纵深防御的是？",
    options: ["仅使用口令登录", "口令 + 多因素认证（MFA）+ 异常登录检测 + 会话异常即注销", "关闭所有审计日志以免性能下降", "把 MFA 密钥写进前端代码"],
    answer: "B",
    explanation: "认证环节的单点失效代价极高。纵深防御应在身份层叠加多因素认证（MFA）提升冒用门槛，配合异常登录/异地/新设备检测等运行时监控，并在检测到风险时强制重新认证或注销会话，多层措施共同降低账户被攻破的概率。",
    difficulty: "hard", tags: ["纵深防御", "MFA", "认证"], sourceKey: "owasp-wstg", level: "综合" }),
  judgeQuestion({ key: "application-security-sup-sec-defense-in-depth-j1", stageKey: "sec-defense", topicKey: "sec-defense-in-depth",
    stem: "开启多因素认证（MFA）后，即便用户口令泄露，攻击者也难以仅凭口令完成登录。",
    answer: true,
    explanation: "MFA 要求除口令外的第二因素（如一次性验证码、硬件密钥、生物特征），即便口令因钓鱼或泄露被获取，缺乏第二因素仍无法通过认证，从而显著降低账户被盗用风险。它是对单因子认证的强有力补充，属于纵深防御的重要一环。",
    difficulty: "medium", tags: ["MFA", "多因素认证", "纵深防御"], sourceKey: "owasp-wstg", level: "进阶" }),
];
