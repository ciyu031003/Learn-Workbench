/**
 * 应用安全 · 知识点扩容（追加式，2026-10-15）。
 *
 * 与 topic-expansion-backend-engineering.ts 同口径：每条 expansion = 1 个知识点 + 2 道配套题；
 * 术语一律配白话解释；只新增知识点，不改课程主文件与登记表。
 */
import type { TopicExpansion } from "./topic-expansions";

export const applicationSecurityTopicExpansions: TopicExpansion[] = [
  {
    trackSlug: "application-security",
    stageKey: "sec-foundation",
    topic: {
      key: "sec-file-upload",
      title: "文件上传安全",
      summary:
        "上传的风险不在文件内容本身，而在于它落地后会被当成什么处理：类型要看文件头、文件名由服务端生成、存储位置不可执行。",
      concepts: ["文件头与内容嗅探", "路径穿越", "存储隔离", "可执行性"],
      principles: [
        "扩展名与 Content-Type 都由客户端提供，必须结合文件头（magic bytes）做白名单判断。",
        "原始文件名不可信，可能含 ../ 造成路径穿越，保存名必须由服务端重新生成。",
        "上传目录不应位于 Web 根内、不应允许被脚本引擎解析；下载时统一设置 Content-Disposition: attachment。",
      ],
      applications: [
        "头像、附件上传接口的类型、大小与数量校验。",
        "对象存储加私有读与签名 URL 的下载链路设计。",
      ],
      pitfalls: [
        "只看扩展名或 Content-Type 就把文件落盘。",
        "把 originalname 直接拼进保存路径，导致穿越或覆盖。",
        "上传文件与业务页面同域同源，伪装文件被当页面执行。",
      ],
      method: "按判内容、改名字、隔离存储、限制下载四步加固上传链路，让每一步独立生效。",
      exercise: "为头像上传接口写出校验与保存流程，并说明如何阻止上传的 HTML/SVG 在同一域名下被当页面执行。",
      checkpoint: "能解释为什么仅凭扩展名判断文件类型不可靠。",
      lesson: {
        overview: [
          "文件上传把外部的字节写进了你自己的系统，是少数会让数据变成可执行内容的入口。攻击者可以上传伪装成图片的脚本、利用文件名做路径穿越，或者干脆用超大文件把磁盘和服务拖垮。防线的关键不是猜文件叫什么，而是让保存的位置和处理的方式本身是安全的。",
          "很多人把上传安全等同于过滤扩展名，但扩展名只是字符串。真正决定风险的是文件落地后会不会被解析执行、能不能被越权读取，以及它的大小与数量会不会影响服务。把这三点分开设计，才能同时覆盖伪装、越权覆盖与拒绝服务这几类问题。",
        ],
        mechanism: [
          "MIME 类型来自请求头，扩展名来自文件名，二者都在客户端控制之下，只能当参考；文件开头的魔数由内容决定，更接近真实类型，但仍要配合白名单使用。",
          "路径穿越来自把用户提供的文件名直接拼进路径，例如 ../../etc/cron.d/x。由服务端生成随机文件名可以同时消除穿越与重名覆盖两个问题。",
          "落地目录如果在 Web 根下且允许脚本解析，上传就等价于远程代码执行。把文件放到 Web 根之外或对象存储、下载时统一设置 attachment，可以从存储与响应两头切断执行路径。",
        ],
        example: {
          title: "用文件头白名单与服务端随机名保存上传",
          language: "javascript",
          code: "import { randomUUID } from 'node:crypto';\nimport path from 'node:path';\nimport fs from 'node:fs';\n\n// 只接受文件头能对上的图片类型\nconst SIGNATURES = {\n  'image/jpeg': [0xff, 0xd8, 0xff],\n  'image/png': [0x89, 0x50, 0x4e, 0x47],\n};\n\nfunction sniff(buffer) {\n  return Object.entries(SIGNATURES).find(([, bytes]) =>\n    bytes.every((byte, i) => buffer[i] === byte)\n  )?.[0];\n}\n\napp.post('/upload', upload.single('file'), async (req, res) => {\n  if (!sniff(req.file.buffer)) {\n    return res.status(400).json({ error: 'unsupported file type' });\n  }\n  const storedName = randomUUID() + '.bin'; // 服务端命名，丢掉原始文件名\n  await fs.promises.writeFile(path.join(UPLOAD_DIR, storedName), req.file.buffer);\n  res.json({ id: storedName });\n});",
          explanation:
            "这段代码先用文件头判断真实类型，再丢弃客户端传来的文件名、由服务端生成随机名保存。这样即使攻击者把脚本改名成 .png，类型校验也会拒绝；即使文件名里带 ../，路径也由服务端构造，穿越无从发生。示例里 upload 与 UPLOAD_DIR 是接入时的占位约定，落盘前还应限制文件大小与数量，并把 UPLOAD_DIR 放在 Web 根之外。",
        },
        practiceSteps: [
          "把类型判断从扩展名换成文件头魔数白名单，并拒绝未知类型。",
          "用服务端生成的随机名替换原始文件名，并限定保存目录。",
          "把上传目录移出 Web 根或改用对象存储，下载响应加 Content-Disposition: attachment。",
          "限制单文件大小、总数量，并对上传者做鉴权与配额。",
        ],
        masteryChecklist: [
          "能写出不依赖扩展名的类型校验。",
          "能解释上传目录被 Web 直接解析为何等于代码执行。",
        ],
        summary: [
          "扩展名与 Content-Type 都可伪造，判类型看文件头并走白名单。",
          "文件名必须由服务端生成，防路径穿越与重名覆盖。",
          "存储要隔离且不可执行，下载用 attachment。",
          "大小、数量与访问权限同样属于上传安全的一部分。",
        ],
        terms: [
          {
            term: "MIME 类型（MIME Type）",
            plain: "文件自称是什么格式的标签，比如 image/png。",
            detail:
              "上传请求里的 Content-Type 由客户端填写，可以随意伪造，只能当提示而不能当判据。真正的判据通常是文件开头几个字节，也就是魔数。",
          },
          {
            term: "路径穿越（Path Traversal）",
            plain: "文件名里塞 ../../，让保存位置跑到别的目录去。",
            detail:
              "成因是把用户给的文件名直接当路径拼接。修复不是过滤点点斜杠，而是由服务端生成文件名，让用户输入根本不参与路径构造。",
          },
          {
            term: "魔数（Magic Bytes）",
            plain: "文件开头几个固定字节，能看出它真实是什么格式。",
            detail:
              "例如 PNG 以 89 50 4E 47 开头。攻击者也可能把脚本内容包在图片头之后，所以魔数校验要配合存储不可执行、下载不改名一起用。",
          },
          {
            term: "内容嗅探（Content Sniffing）",
            plain: "浏览器不看声明的类型，自己猜文件是什么。",
            detail:
              "某些浏览器会忽略 Content-Type 去猜内容，导致伪装文件被当 HTML 执行。响应里加 X-Content-Type-Options: nosniff 可以阻止这种猜测。",
          },
        ],
      },
    },
    questions: [
      {
        key: "application-security-sup-sec-file-upload-s1",
        stageKey: "sec-foundation",
        topicKey: "sec-file-upload",
        type: "single",
        stem: "下面哪种做法最能降低文件上传功能的风险？",
        options: [
          { key: "A", text: "仅根据扩展名判断文件类型" },
          { key: "B", text: "把上传文件保存在 Web 根目录下便于访问" },
          { key: "C", text: "由服务端生成随机文件名，并把文件保存到不可执行的位置" },
          { key: "D", text: "使用上传请求里的 Content-Type 作为类型判据" },
        ],
        answer: ["C"],
        explanation:
          "扩展名与 Content-Type 都由客户端提供、可以伪造，单独依赖它们会放过伪装文件。可靠做法是结合文件头白名单判断真实类型，由服务端重新生成文件名以消除路径穿越与重名覆盖，并把文件放到 Web 根之外或不可执行的位置，从存储层面切断它被当作脚本执行的可能。",
        difficulty: "medium",
        tags: ["文件上传", "路径穿越", "存储隔离"],
        sourceKey: "owasp-cheatsheets",
        level: "进阶",
      },
      {
        key: "application-security-sup-sec-file-upload-j1",
        stageKey: "sec-foundation",
        topicKey: "sec-file-upload",
        type: "judge",
        stem: "只要校验了上传文件的扩展名，就可以放心把文件保存到 Web 根目录下的 uploads 文件夹里。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "扩展名校验可以被大小写、双扩展名或伪造内容绕过，而且把文件放在 Web 根下意味着它可能被服务器直接解析。若目录允许脚本执行，伪装的上传文件就可能变成可执行的 WebShell；即使不允许执行，同域渲染 HTML 或 SVG 也可能触发脚本。应把文件存到 Web 根之外或对象存储，并限制下载方式与同源渲染。",
        difficulty: "hard",
        tags: ["文件上传", "可执行性", "纵深防御"],
        sourceKey: "juice-shop",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "application-security",
    stageKey: "sec-foundation",
    topic: {
      key: "sec-mass-assignment",
      title: "批量赋值与字段越权",
      summary:
        "把整个请求体交给框架或 ORM 绑定，用户就能顺手多写几个不该改的字段，比如 role=admin 或 balance=999。",
      concepts: ["批量赋值", "DTO 白名单", "输入绑定", "过度提交"],
      principles: [
        "只把明确允许用户修改的字段纳入绑定，其余一律忽略，这是白名单思路在写操作上的体现。",
        "黑名单（删掉 isAdmin、role）总会漏掉新增字段；字段的默认状态应当是禁止，而不是允许。",
        "字段级授权与资源级授权是两件事：能改自己的昵称，不代表能改自己的角色。",
      ],
      applications: [
        "用户资料、偏好设置等更新接口的字段收敛。",
        "注册与邀请流程中角色字段的独立处理。",
      ],
      pitfalls: [
        "直接把 req.body 传给 ORM 的 update 或 create。",
        "以为前端表单不提交某字段，服务端就收不到它。",
      ],
      method: "为每个写接口定义显式的输入结构，只取出允许的字段后再落库，敏感字段另走管理接口与独立权限校验。",
      exercise: "找出一个资料更新接口里被过度绑定的字段，改写成显式字段白名单，并写出一个能验证修复的请求体。",
      checkpoint: "能解释为什么删掉敏感字段的黑名单不如字段白名单可靠。",
      lesson: {
        overview: [
          "现代框架喜欢帮你把请求体自动映射成对象，写起来省事，代价是请求里出现什么字段，对象上就可能被写上什么。用户提交一个包含 role=admin 的 JSON，如果代码原样保存，他就顺手给自己提了权。问题在于框架并不知道哪些字段属于用户，它只是忠实地按名字逐一对上。",
          "这类问题常被误判成框架漏洞，其实是接口设计问题：服务端没有声明哪些字段可以被用户写。把可写字段显式列出来，才能让同一个接口既支持灵活表单，又不被用户顺走权限。换句话说，接口要为每一次写入划定边界，而不是相信调用者只提交了它该提交的东西。",
        ],
        mechanism: [
          "批量赋值的根因是数据绑定把输入字段名直接当成对象属性或数据库列名，而请求体中包含哪些字段完全由调用者决定。",
          "黑名单式防御依赖维护者记得每一个危险字段，而表结构一改就可能新增未覆盖的列，所以会持续漏。",
          "白名单式防御只认可枚举出的字段，新字段默认被忽略：漏掉的后果是功能不可用，容易被发现，而不是权限被提升，失败方向更安全。",
        ],
        example: {
          title: "只解构允许修改的字段",
          language: "javascript",
          code: "// 错误：请求体里任何字段都会被写进用户记录\nawait User.update(req.body, { where: { id: req.user.id } });\n\n// 正确：显式列出用户可自行修改的字段，其余一律忽略\nconst { nickname, avatarUrl } = req.body;\nawait User.update(\n  { nickname, avatarUrl },\n  { where: { id: req.user.id } }\n);",
          explanation:
            "第二段代码明确声明了用户可以改什么，role、balance 这些字段根本没进入更新语句，所以请求体里带不带它们都不生效。这种写法把安全性建立在默认忽略上，新增字段时必须手动加入白名单，不会因为忘记删除某个字段而失守。",
        },
        practiceSteps: [
          "列出每个写接口允许用户修改的字段清单。",
          "改成显式解构或按 schema 校验，未知字段直接丢弃或报错。",
          "对角色、余额、归属等敏感字段单独设管理接口与权限校验。",
          "补一条测试：请求体加入未声明字段后，数据库中的对应字段保持不变。",
        ],
        masteryChecklist: [
          "能指出代码里哪里发生了批量赋值。",
          "能写出字段白名单并说明新字段的默认处理方式。",
        ],
        summary: [
          "批量赋值等于让输入字段名直接决定能写哪些属性。",
          "防御靠白名单：只绑定明确允许的字段。",
          "黑名单会随字段增加而失效。",
          "字段级权限要单独校验，不能靠隐藏表单。",
        ],
        terms: [
          {
            term: "批量赋值（Mass Assignment）",
            plain: "把用户提交的一整坨字段直接写进数据库对象。",
            detail:
              "省事但危险，因为用户能提交你没打算开放的字段。修复方式是只挑出允许的字段再保存，而不是把整坨交给 ORM。",
          },
          {
            term: "DTO（Data Transfer Object）",
            plain: "一个只装这次接口允许出现哪些字段的小结构。",
            detail:
              "它的作用是给输入划边界：请求体先校验成 DTO，再交给业务层，未知字段在入口就被丢弃。",
          },
          {
            term: "过度提交（Over-posting）",
            plain: "用户多提交了几个你没想让他改的字段。",
            detail:
              "攻击者常加 role、isAdmin、userId 之类的字段试探。它会生效的前提，正是服务端把整个请求体做了批量赋值。",
          },
          {
            term: "字段级授权",
            plain: "不光判断能不能改这条数据，还要判断能不能改这个字段。",
            detail:
              "同一个用户对自己的资料有写权限，但对其中的角色字段没有。资源归属校验通过，不代表所有字段都可写。",
          },
        ],
      },
    },
    questions: [
      {
        key: "application-security-sup-sec-mass-assignment-s1",
        stageKey: "sec-foundation",
        topicKey: "sec-mass-assignment",
        type: "single",
        stem: "关于批量赋值（mass assignment），下面说法正确的是？",
        options: [
          { key: "A", text: "只要前端表单不包含 role 字段，后端就不会收到该字段" },
          { key: "B", text: "防御的关键是显式声明允许绑定的字段，其余默认忽略" },
          { key: "C", text: "把 isAdmin 从请求体里删掉就不会有其它风险" },
          { key: "D", text: "使用 ORM 就一定不会发生批量赋值" },
        ],
        answer: ["B"],
        explanation:
          "请求体完全由调用者构造，攻击者可以绕过前端直接提交任意字段，所以前端不显示并不等于服务端收不到。批量赋值的防御是把可写字段做成白名单，只绑定明确允许的字段；删除个别敏感字段属于黑名单，会随着表结构变化而漏掉新字段。ORM 只是工具，把整个请求体交给它同样会发生过度提交。",
        difficulty: "medium",
        tags: ["批量赋值", "字段越权", "白名单"],
        sourceKey: "owasp-cheatsheets",
        level: "进阶",
      },
      {
        key: "application-security-sup-sec-mass-assignment-j1",
        stageKey: "sec-foundation",
        topicKey: "sec-mass-assignment",
        type: "judge",
        stem: "把请求体里已知的敏感字段（如 isAdmin、role）删除后再保存，是一种比字段白名单更可靠的防御。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "删除已知敏感字段属于黑名单思路，它的有效性依赖维护者穷举所有危险字段。一旦模型新增字段，例如 freeze、credit、tenantId，旧的黑名单不会自动覆盖，攻击者仍可能借新字段提权。字段白名单只接受明确列出的字段，未知字段默认被忽略，失败时表现为功能缺失而不是权限提升，因此更可靠。",
        difficulty: "hard",
        tags: ["批量赋值", "黑名单", "权限提升"],
        sourceKey: "juice-shop",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "application-security",
    stageKey: "sec-web",
    topic: {
      key: "sec-ssrf",
      title: "SSRF 服务端请求伪造",
      summary:
        "服务端替用户去取一个 URL 时，攻击者就把这个 URL 指向内网地址或云元数据接口，借服务器之手访问只有它才够得着的资源。",
      concepts: ["服务端请求伪造", "内网与链路本地地址", "云元数据", "DNS 重绑定"],
      principles: [
        "只要目标 URL 由用户可控，就必须当成不可信输入，先做协议与主机白名单，再检查解析出的 IP 是否属于内网。",
        "字符串黑名单（例如禁止 localhost）挡不住等价写法：127.0.0.1、十进制或十六进制 IP、指向内网的域名。",
        "校验要在 DNS 解析之后进行，并尽量把连接固定到已校验的 IP，防止检查与连接之间地址被换掉。",
      ],
      applications: [
        "图片抓取、URL 预览、文档转换等会主动发起外连的功能。",
        "云主机元数据服务的访问限制与 IMDSv2 加固。",
      ],
      pitfalls: [
        "只过滤 localhost 字符串就放行。",
        "校验通过后自动跟随重定向，最终落到内网地址。",
      ],
      method: "对用户提供的 URL 采用协议加主机白名单、解析后 IP 判定、限制重定向的层层检查，并在网络层用出站策略兜底。",
      exercise: "为一个根据 URL 抓取网页标题的接口写出安全校验，说明白名单、IP 判定与重定向处理分别拦住了什么。",
      checkpoint: "能说明为什么必须在 DNS 解析之后再判断内网地址。",
      lesson: {
        overview: [
          "很多功能需要服务端主动访问一个 URL：抓取预览图、调用第三方回调、把网页转成 PDF。这个主动外连的请求往往带着更高的网络可达性，它能访问内网，也能看到只有服务器才看得到的服务。换句话说，用户提交的是一个地址，而你的服务器会真的带着自己的身份走过去。",
          "SSRF 就是让攻击者遥控这次外连。他不需要攻破服务器，只要把 URL 换成云元数据地址或内网管理后台，响应就会经由你的服务器回到他手里。危险之处在于请求确实是你自己发出的，所以内网的防火墙和鉴权往往不会拦它。",
        ],
        mechanism: [
          "服务器通常处在内网并可访问本机回环，而攻击者在外部无法直达这些地址；SSRF 借用了服务器的网络位置，把不可达变成可达。",
          "云平台元数据服务是一个固定的链路本地地址，能被实例内部访问，常携带临时凭据；未加固时一次 SSRF 就可能升级为云账号失陷。",
          "DNS 重绑定利用先检查后连接之间的时间差：第一次解析返回公网 IP 通过校验，实际连接时域名改指向内网 IP，所以只校验一次主机名并不充分。",
        ],
        example: {
          title: "先解析、再判定内网地址的主机白名单校验",
          language: "javascript",
          code: "import dns from 'node:dns';\n\nconst ALLOWED_HOSTS = new Set(['api.partner.com', 'cdn.example.com']);\nconst PRIVATE = [\n  /^10\\./,\n  /^127\\./,\n  /^192\\.168\\./,\n  /^169\\.254\\./,\n  /^172\\.(1[6-9]|2[0-9]|3[01])\\./,\n];\n\nexport async function assertSafeUrl(raw) {\n  const url = new URL(raw);\n  if (url.protocol !== 'https:') throw new Error('only https allowed');\n  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error('host not allowed');\n  const { address } = await dns.promises.lookup(url.hostname, { family: 4 });\n  if (PRIVATE.some((re) => re.test(address))) {\n    throw new Error('private address blocked');\n  }\n}",
          explanation:
            "这段代码按顺序做了三件事：限定协议、限定主机、解析出真实 IP 再判断是否属于内网网段。先白名单再判 IP，是因为只黑名单字符串挡不住等价表示；在解析后判断，是因为域名可以指向内网。要更彻底地防 DNS 重绑定，还应把已校验的 IP 固定给连接使用、禁止自动跟随重定向，并用网络出站策略兜底。",
        },
        practiceSteps: [
          "找出所有由用户输入决定目标地址的服务端外连点。",
          "改成主机与协议白名单，并在 DNS 解析后判定内网与链路本地网段。",
          "禁止或限制自动重定向，重定向的每一跳都要重新校验。",
          "云上开启元数据服务令牌模式并限制实例出站访问。",
        ],
        masteryChecklist: [
          "能解释 SSRF 为什么能访问外部攻击者到不了的地址。",
          "能写出先解析后判定 IP 的校验顺序并说明原因。",
        ],
        summary: [
          "用户可控的 URL 是不可信输入。",
          "白名单加解析后 IP 判定，缺一不可。",
          "重定向与 DNS 重绑定是两个必须复检的点。",
          "网络出站策略是最后一道兜底。",
        ],
        terms: [
          {
            term: "SSRF（服务端请求伪造）",
            plain: "让服务器替攻击者去访问一个它本可以访问、但攻击者碰不到的地址。",
            detail:
              "危害取决于服务器能到哪：内网服务、云元数据、本机管理端口。修复重点是把用户可控的目标地址收敛到白名单，而不是简单禁用某个字符串。",
          },
          {
            term: "云元数据服务（Metadata Service）",
            plain: "云主机内部的一个特殊地址，能查到实例信息和临时凭据。",
            detail:
              "常见地址是 169.254.169.254，因为它只需实例内部可达，常成为 SSRF 的跳板。开启要求带令牌的访问模式并限制出站可以显著降低风险。",
          },
          {
            term: "DNS 重绑定（DNS Rebinding）",
            plain: "同一个域名先解析到公网、再解析到内网，骗过只检查一次的程序。",
            detail:
              "防御要点是不能只信任检查那一刻的解析结果：把校验过的 IP 固定用于连接，或不跟随重定向，并配合出站网络策略。",
          },
          {
            term: "链路本地地址（Link-local Address）",
            plain: "只在本地这一段网络里有效的地址，比如 169.254 开头。",
            detail:
              "它不能路由到公网，通常用于本机或同链路的特殊服务。校验内网地址时必须把 169.254.0.0/16 一并纳入拒绝范围。",
          },
        ],
      },
    },
    questions: [
      {
        key: "application-security-sup-sec-ssrf-s1",
        stageKey: "sec-web",
        topicKey: "sec-ssrf",
        type: "single",
        stem: "在实现根据用户提供的 URL 抓取网页标题时，下面哪种校验最有效？",
        options: [
          { key: "A", text: "过滤掉 URL 中的 localhost 字符串" },
          { key: "B", text: "限定协议与允许的主机，并在 DNS 解析后拒绝内网与链路本地 IP" },
          { key: "C", text: "只允许 http 与 https 两种协议" },
          { key: "D", text: "把请求超时时间设置得短一些" },
        ],
        answer: ["B"],
        explanation:
          "SSRF 的核心是攻击者控制服务端请求的目标。仅过滤 localhost 属于字符串黑名单，攻击者可用 127.0.0.1、十进制 IP 或指向内网的域名绕过；只限制协议也不限制目标。有效做法是协议加主机白名单，并在 DNS 解析出真实 IP 后判断它是否落在内网或链路本地网段，同时限制重定向。缩短超时只能降低影响，不能阻止请求发出。",
        difficulty: "medium",
        tags: ["SSRF", "内网", "白名单"],
        sourceKey: "owasp-cheatsheets",
        level: "进阶",
      },
      {
        key: "application-security-sup-sec-ssrf-j1",
        stageKey: "sec-web",
        topicKey: "sec-ssrf",
        type: "judge",
        stem: "只要在校验时确认了目标域名解析到公网 IP，之后就可以放心跟随该请求的重定向。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "重定向会引入新的目标地址，而这个新地址没有经过校验。攻击者可以先把 URL 指向自己控制的公网地址，再返回一个跳转到内网服务的响应。正确做法是禁止自动跟随重定向，或对每一跳重新执行协议、主机与 IP 校验。同理，即便首次解析是公网 IP，也要防 DNS 重绑定，最好把已校验的 IP 固定用于连接。",
        difficulty: "hard",
        tags: ["SSRF", "重定向", "DNS重绑定"],
        sourceKey: "owasp-wstg",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "application-security",
    stageKey: "sec-web",
    topic: {
      key: "sec-clickjacking",
      title: "点击劫持与框架嵌入防护",
      summary:
        "把你的页面塞进透明 iframe，让用户在看着 A 页面的情况下点中 B 页面的按钮；防护靠响应头，不靠脚本。",
      concepts: ["点击劫持", "frame-ancestors", "X-Frame-Options", "界面伪装"],
      principles: [
        "是否允许被嵌入由响应头决定：CSP 的 frame-ancestors 是当前标准，X-Frame-Options 用于兼容旧浏览器。",
        "JavaScript 的 frame-busting 不可靠，攻击者可用 iframe 的 sandbox 属性阻止脚本执行。",
        "对转账、改密、授权等高风险动作，应要求重新确认或二次验证，让一次误点不足以完成操作。",
      ],
      applications: [
        "后台管理页、支付确认页等敏感界面的响应头配置。",
        "需要被第三方嵌入时，用 frame-ancestors 精确指定允许的父页面。",
      ],
      pitfalls: [
        "只在页面里写 frame-busting 脚本，不设响应头。",
        "把嵌入来源放开成通配，等于允许任何站点伪装你的界面。",
      ],
      method: "默认对所有响应加 frame-ancestors 的 none 策略，确需嵌入的页面单独列出来源；高风险操作再加一层确认。",
      exercise: "为一个需要被合作方页面嵌入的支付组件设计响应头策略，并说明如何在允许嵌入的同时保护敏感操作。",
      checkpoint: "能说明为什么 frame-ancestors 比 JavaScript 的防框架脚本更可靠。",
      lesson: {
        overview: [
          "点击劫持不需要注入代码，它利用的是看到的界面和点击的位置可以分离。攻击者把你的页面放进 iframe，调成透明并盖在诱饵按钮上，用户以为在点抽奖，实际点的是你的删除或授权按钮。整个过程没有脚本执行、没有数据泄露，用户只是点错了一次位置。",
          "它的门槛很低：只要你的页面允许被外部站点嵌入，就可能被组合出误导性界面。防护目标很明确，就是告诉浏览器谁能把我的页面放进框架，而这个决定应该由服务端响应头做出。攻击者甚至不需要针对你写任何代码，只要能嵌入页面就足够了。",
        ],
        mechanism: [
          "浏览器允许站点通过 iframe 嵌入其它站点，默认并不限制。点击位置由父页面排版决定，所以父页面可以任意覆盖被嵌入页面的可视区域。",
          "CSP 的 frame-ancestors 指令由浏览器在加载时检查：若当前页面的祖先链不在允许列表内，就拒绝渲染。它是响应头，攻击者无法在自己的页面上关掉你服务端的策略。",
          "X-Frame-Options 是更早的机制，取值为 DENY 或 SAMEORIGIN，可被旧浏览器识别；与 frame-ancestors 同时存在时，现代浏览器优先使用 frame-ancestors。",
        ],
        example: {
          title: "用响应头禁止被嵌入，确需嵌入时指定来源",
          language: "text",
          code: "# 默认：任何站点都不许把我的页面放进 iframe / frame / object\nContent-Security-Policy: frame-ancestors 'none'\nX-Frame-Options: DENY\n\n# 需要被嵌入时，只列出可信来源，不要用通配\n# Content-Security-Policy: frame-ancestors https://partner.example.com",
          explanation:
            "第一组头是最安全的默认值，none 表示不允许任何祖先页面，X-Frame-Options: DENY 作为旧浏览器的兜底。需要被嵌入时不要直接放开成通配，而要用 frame-ancestors 精确列出可信来源，这样即使其它站点拿到你的 URL，也无法把它伪装进自己的界面。",
        },
        practiceSteps: [
          "盘点哪些页面确实需要被第三方嵌入。",
          "对默认页面下发 frame-ancestors 的 none 策略与 X-Frame-Options: DENY。",
          "对需要嵌入的页面用 frame-ancestors 精确列出父来源，避免使用通配。",
          "为高风险操作增加二次确认或重新认证。",
        ],
        masteryChecklist: [
          "能写出禁止被嵌入的响应头组合。",
          "能解释为什么 frame-busting 脚本不可靠。",
        ],
        summary: [
          "点击劫持把可见界面与可点位置分离。",
          "防护由响应头决定，frame-ancestors 是当前标准。",
          "别用通配放开嵌入，只列可信来源。",
          "高风险操作应有二次确认兜底。",
        ],
        terms: [
          {
            term: "点击劫持（Clickjacking）",
            plain: "用透明框架把真页面盖在诱饵上，骗用户点到真按钮。",
            detail:
              "它不窃取数据也不注入脚本，而是操纵用户的一次点击，因此防护重点是限制嵌入，而不是做输入过滤。",
          },
          {
            term: "iframe",
            plain: "网页里再开一个小窗口，用来显示另一个网页。",
            detail:
              "它本身是正常功能，但父页面可以控制它的大小、位置和透明度，这正是点击劫持的利用点。",
          },
          {
            term: "frame-ancestors",
            plain: "一条响应头，声明哪些页面可以把我嵌进框架。",
            detail:
              "它是 CSP 的指令，取值 none 表示都不允许，也可以列出来源。因为写在响应头里，攻击者无法在自己的页面上绕过它。",
          },
          {
            term: "frame-busting",
            plain: "用一段脚本判断自己是否在框架里，是就把页面弹出去。",
            detail:
              "在攻击者给 iframe 加上 sandbox 后，嵌入页面的脚本可能无法执行，所以它只能当辅助手段，不能替代响应头。",
          },
        ],
      },
    },
    questions: [
      {
        key: "application-security-sup-sec-clickjacking-s1",
        stageKey: "sec-web",
        topicKey: "sec-clickjacking",
        type: "single",
        stem: "防御点击劫持最可靠的做法是？",
        options: [
          { key: "A", text: "在页面里用 JavaScript 检测是否被 iframe 嵌入" },
          { key: "B", text: "通过响应头下发 frame-ancestors 的 none 策略，必要时列出可信来源" },
          { key: "C", text: "对 Cookie 设置 HttpOnly" },
          { key: "D", text: "禁用页面上的所有链接" },
        ],
        answer: ["B"],
        explanation:
          "点击劫持的本质是页面被外部站点嵌入后用界面伪装诱导点击，所以要由服务端用响应头声明是否允许嵌入。CSP 的 frame-ancestors 是当前标准，取值 none 表示任何祖先页面都不允许。JavaScript 的 frame-busting 依赖脚本能执行，攻击者可给 iframe 加 sandbox 使其失效；HttpOnly 防的是脚本读取 Cookie，属于 XSS 范畴，与点击劫持无关。",
        difficulty: "easy",
        tags: ["点击劫持", "响应头", "CSP"],
        sourceKey: "owasp-cheatsheets",
        level: "入门",
      },
      {
        key: "application-security-sup-sec-clickjacking-j1",
        stageKey: "sec-web",
        topicKey: "sec-clickjacking",
        type: "judge",
        stem: "为了防止点击劫持，只要在页面里加入检测并跳出框架的 JavaScript，就不需要再设置 X-Frame-Options 或 CSP。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "框架跳转脚本运行在被嵌入的页面里，攻击者可以通过 iframe 的 sandbox 属性禁止脚本执行，或配合其它条件让检测失效，因此它不可靠。可靠防护必须由服务端响应头完成，例如 Content-Security-Policy 的 frame-ancestors 设为 none，并用 X-Frame-Options: DENY 兼容旧浏览器。脚本只能作为额外一层，不能作为唯一防线。",
        difficulty: "medium",
        tags: ["点击劫持", "frame-busting", "响应头"],
        sourceKey: "owasp-wstg",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "application-security",
    stageKey: "sec-auth",
    topic: {
      key: "sec-mfa",
      title: "多因素认证与动态口令",
      summary:
        "用两类不同性质的凭证做验证（知道什么加拥有什么），并保证这一步真正挡在会话建立之前、且不能被反复猜。",
      concepts: ["多因素", "TOTP", "恢复码", "防重放"],
      principles: [
        "多因素要求凭证来自不同类别：口令是知道的东西，动态口令或安全密钥是拥有的东西，两个口令不算多因素。",
        "第二因素必须在服务端登录流程中强制，验证失败要限次并告警，否则形同虚设。",
        "同一个 TOTP 码在有效窗口内可被重复使用，服务端应记录已用过的计数器或时间步，防止重放。",
      ],
      applications: [
        "后台管理、支付与改密等高风险操作的二次验证。",
        "面向员工的统一登录强制开启多因素。",
      ],
      pitfalls: [
        "只在界面上要求验证码，后端接口仍可绕过。",
        "恢复码明文存储且可无限次尝试，变成绕过第二因素的后门。",
      ],
      method: "在服务端登录流程里强制第二因素，限制尝试次数，一次性消费验证码，并安全保存恢复码。",
      exercise: "为一个已有口令登录的系统接入动态口令：写出绑定密钥、登录校验、失败限次与恢复码存储的完整流程。",
      checkpoint: "能说明为什么两个口令不算多因素，以及动态口令为什么需要防重放。",
      lesson: {
        overview: [
          "口令泄露的途径太多：撞库、钓鱼、复用。多因素认证的价值是在口令已经泄露的前提下，仍然让攻击者过不去，因为他还得拿到你另外一类东西，比如手机上的动态码或一枚硬件密钥。这正是不把安全全部押在口令一个点上的意义。",
          "要注意多因素认证不是再加一个密码框。如果第二因素可以在前端跳过、可以无限猜，或者恢复码管理松散，攻击者完全可以绕过它。真正生效的是服务端流程上的强制关卡。因此评价一套多因素方案，要看攻击者能不能跳过它，而不是看页面上有没有那个输入框。",
        ],
        mechanism: [
          "认证因素按性质分为三类：知道的东西，比如口令；拥有的东西，比如手机、令牌、安全密钥；以及生物特征。跨类别组合才叫多因素，同类叠加只增加了长度，没有增加独立性。",
          "TOTP 基于客户端与服务端共享的密钥和时间步，用 HMAC 算出一次性数字，因此两端时钟需要大致同步，服务端通常会容忍前后一个时间窗口。",
          "服务端的校验顺序决定安全性：必须在口令通过之后、会话建立之前校验第二因素，且通过之前发放的会话不能拥有完整权限。",
        ],
        example: {
          title: "服务端校验动态口令：限次并防重放",
          language: "javascript",
          code: "import { authenticator } from 'otplib';\n\nauthenticator.options = { window: 1 }; // 容忍前后各一个 30 秒窗口\n\nexport async function verifySecondFactor(user, token) {\n  if (user.mfaLockedUntil && user.mfaLockedUntil > Date.now()) {\n    throw new Error('too many attempts, try again later');\n  }\n  const step = Math.floor(Date.now() / 30000);\n  if (user.lastTotpStep === step) throw new Error('code already used');\n\n  const ok = authenticator.verify({ token, secret: user.totpSecret });\n  if (!ok) {\n    user.failedMfaCount += 1;\n    if (user.failedMfaCount >= 5) {\n      user.mfaLockedUntil = Date.now() + 15 * 60 * 1000;\n    }\n    return false;\n  }\n  user.failedMfaCount = 0;\n  user.lastTotpStep = step; // 记下已使用的时间步，拒绝重放\n  return true;\n}",
          explanation:
            "这段代码体现三点：验证前先检查锁定状态，避免离线暴力猜测；校验通过后记录已使用的时间步，使同一个动态码不能在同一窗口内被再次使用；失败累计达到阈值就临时锁定。真实实现还需要把共享密钥妥善保存、提示时间同步，并对恢复码做哈希存储与一次性消费。",
        },
        practiceSteps: [
          "在服务端登录流程中插入第二因素校验，未通过不建立完整会话。",
          "绑定动态口令时安全保存共享密钥，并提示用户备份恢复码。",
          "对第二因素校验做失败计数与临时锁定，并写入安全日志。",
          "实现验证码一次性消费与恢复码哈希存储，测试重放会被拒绝。",
        ],
        masteryChecklist: [
          "能判断一组认证方式是否构成多因素。",
          "能说明第二因素校验应放在登录流程的哪一步。",
        ],
        summary: [
          "多因素等于不同类别的凭证组合。",
          "第二因素必须在服务端强制，且在会话建立之前。",
          "限次与锁定防暴力，消费时间步防重放。",
          "恢复码是薄弱环节，要哈希存储并一次性使用。",
        ],
        terms: [
          {
            term: "MFA（多因素认证）",
            plain: "登录时除口令外，再要求一样不同类别的凭证。",
            detail:
              "类别指知道、拥有、生物特征。口令加短信码属于跨类别，两个不同密码不算。它假设口令已泄露也仍然能挡住攻击者。",
          },
          {
            term: "TOTP（基于时间的一次性口令）",
            plain: "每 30 秒变一次的 6 位数字，由 App 和服务器用同一个密钥算出。",
            detail:
              "双方共享密钥加当前时间步做 HMAC，得到一次性数字。因为与时间绑定，服务器要容忍轻微时钟偏差，同时注意同一窗口内不要允许重复使用。",
          },
          {
            term: "重放（Replay）",
            plain: "把已经用过的一次性码再提交一次。",
            detail:
              "TOTP 在有效窗口内可能重复通过，所以服务端应记录已使用的时间步并拒绝重复，否则攻击者截获一个码后可在窗口内复用。",
          },
          {
            term: "恢复码（Recovery Code）",
            plain: "手机丢了的时候用来登录的一次性备选码。",
            detail:
              "它等价于一把备用钥匙，必须哈希存储、每码限用一次、用后可重新生成。明文保存或长期有效，会把多因素的强度拉回到只有口令的水平。",
          },
        ],
      },
    },
    questions: [
      {
        key: "application-security-sup-sec-mfa-s1",
        stageKey: "sec-auth",
        topicKey: "sec-mfa",
        type: "single",
        stem: "下面哪种组合真正构成多因素认证（MFA）？",
        options: [
          { key: "A", text: "登录口令加另一个更长的口令" },
          { key: "B", text: "登录口令加手机上的 TOTP 动态码" },
          { key: "C", text: "登录口令加用户名" },
          { key: "D", text: "登录口令加邮箱地址" },
        ],
        answer: ["B"],
        explanation:
          "多因素要求凭证来自不同类别：知道的东西（口令）与拥有的东西（手机或 TOTP 密钥）组合才叫多因素。另一个更长的口令、用户名、邮箱都属于知道的东西或身份标识，不构成第二类因素，无法在口令泄露后提供额外保护。",
        difficulty: "easy",
        tags: ["MFA", "TOTP", "认证因素"],
        sourceKey: "owasp-cheatsheets",
        level: "入门",
      },
      {
        key: "application-security-sup-sec-mfa-j1",
        stageKey: "sec-auth",
        topicKey: "sec-mfa",
        type: "judge",
        stem: "只要登录页面上出现了动态验证码输入框，就已经有效防御了会话被冒用，后端无需再单独校验。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "前端输入框只是界面，攻击者可以直接调用后端接口，跳过页面逻辑。多因素认证必须在服务端登录流程中强制执行，并且在通过第二因素之前不能发放具备完整权限的会话。此外还要限制验证码尝试次数、记录安全日志，并防止同一动态码被重放，否则第二因素仍可被暴力或复用绕过。",
        difficulty: "medium",
        tags: ["MFA", "服务端校验", "会话"],
        sourceKey: "owasp-wstg",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "application-security",
    stageKey: "sec-defense",
    topic: {
      key: "sec-rate-limiting",
      title: "速率限制与暴力破解防护",
      summary:
        "限速是给猜测这个动作定价：按账号与来源两个维度计数、只对失败计数、并让多实例共享同一份限速状态。",
      concepts: ["固定窗口计数", "令牌桶", "按账号限速", "退避与告警"],
      principles: [
        "只按 IP 限速挡不住分布式撞库，关键接口要同时按账号或账号加来源维度限制。",
        "计数应发生在失败尝试上，成功登录清除计数，避免正常用户被误伤，同时也要注意锁定本身会被滥用成拒绝服务。",
        "多实例部署时计数必须放在共享存储里，否则每个实例各算各的，等于把阈值乘以实例数。",
      ],
      applications: [
        "登录、验证码、口令重置与短信发送接口的防滥用。",
        "开放 API 的配额与防爬。",
      ],
      pitfalls: [
        "只在应用内存里计数，扩容后限制失效。",
        "阈值设得过低且不限来源，攻击者可故意输错来锁死他人账号。",
      ],
      method: "为敏感接口同时按账号与来源维度设阈值，用共享存储计数，失败计数、成功清零，并配合退避与告警。",
      exercise: "为登录接口设计一套限速方案，说明计数维度、存储、阈值、成功清零与误伤缓解措施。",
      checkpoint: "能解释为什么只按 IP 限速对分布式撞库几乎没有作用。",
      lesson: {
        overview: [
          "暴力破解和撞库都是大量尝试：前者猜一个账号的口令，后者拿别处泄露的账号口令表批量来试。只要尝试成本足够低，攻击者就能靠数量取胜。限速的作用就是把每次尝试的成本抬高，让猜测变得更慢、更容易被发现。",
          "限速看似简单，细节却决定成败：按什么维度计数、在哪个存储里计数、什么时候清零、锁太狠会不会伤到正常用户。设计不好时，防护要么形同虚设，要么被攻击者反过来用作拒绝服务的工具。这些选择没有标准答案，但要和你的业务风险与用户体验一起权衡。",
        ],
        mechanism: [
          "常见算法有固定窗口、滑动窗口与令牌桶。固定窗口实现简单但窗口交界处可能有突发；滑动窗口统计更平滑；令牌桶允许短时突发但限制长期平均速率。",
          "多实例部署时，每个进程内存里的计数器互相独立，攻击者轮询不同实例就能让每次请求都落在低计数上；把计数放进 Redis 等共享存储，整个集群才能共享同一份阈值。",
          "键的设计决定防护强度：只按 IP 计数时，攻击者用代理池换 IP 即可绕过；按账号计数则直接限制对同一账号的猜测。但按账号锁定也可能被用来锁死他人，所以常与来源维度、退避和告警结合，而不是永久锁定。",
        ],
        example: {
          title: "用 Redis 按账号做登录失败限速",
          language: "javascript",
          code: "// 同一账号 15 分钟内最多允许 5 次失败尝试\nexport async function registerLoginFailure(accountId) {\n  const key = 'login:fail:' + accountId;\n  const count = await redis.incr(key);\n  if (count === 1) {\n    await redis.expire(key, 15 * 60); // 只在计数第一次出现时设置窗口\n  }\n  return count;\n}\n\nexport async function assertLoginAllowed(accountId) {\n  const count = await redis.get('login:fail:' + accountId);\n  if (Number(count) >= 5) throw new Error('too many attempts, try later');\n}\n\n// 登录成功后清除失败计数，避免正常用户被旧失败拖累\nexport async function clearLoginFailures(accountId) {\n  await redis.del('login:fail:' + accountId);\n}",
          explanation:
            "用 Redis 让多实例共享同一份计数：INCR 原子自增，第一次计数时设置过期时间，形成 15 分钟窗口，超过阈值就拒绝。只在登录失败时计数、成功时删除键，可以在防暴力与减少误伤之间取得平衡。生产实现还应对同一来源 IP 另设一层限制，并考虑自增与设置过期之间的原子性。",
        },
        practiceSteps: [
          "列出需要限速的接口，确定按账号、按 IP 还是两者组合计数。",
          "把计数器放进共享存储，统一键命名与窗口长度。",
          "区分成功与失败：失败计数、成功清零，并设置合理阈值与退避。",
          "为触发阈值的事件建立告警与人工处置路径。",
        ],
        masteryChecklist: [
          "能说明进程内计数在扩容后为何失效。",
          "能为登录接口设计账号与来源两个维度的阈值。",
        ],
        summary: [
          "限速把暴力尝试的成本抬高。",
          "按账号加来源双维度，别只按 IP。",
          "计数放共享存储，多实例才一致。",
          "失败计数、成功清零，阈值过高过低都是问题。",
          "限速是纵深防御的一层，不能替代强口令与多因素认证。",
        ],
        terms: [
          {
            term: "速率限制（Rate Limiting）",
            plain: "限制一个对象在一段时间里能做多少次操作。",
            detail:
              "对象可以是账号、IP 或 API Key。它保护的是登录、验证码等可被大量尝试的接口，通常只是纵深防御的一层，不替代认证强度。",
          },
          {
            term: "固定窗口（Fixed Window）",
            plain: "把时间切成固定的小段，每段里重新计数。",
            detail:
              "实现简单，但在窗口交界处可能出现接近两倍阈值的突发。对精度要求高时可以改用滑动窗口或令牌桶。",
          },
          {
            term: "令牌桶（Token Bucket）",
            plain: "以固定速率往桶里放令牌，请求要消耗令牌才能通过。",
            detail:
              "它允许短时间突发，因为桶里有存货，但长期平均速率受补充速度限制，适合既要平滑又要容忍尖峰的接口。",
          },
          {
            term: "撞库（Credential Stuffing）",
            plain: "拿别处泄露的账号口令表，批量来你这里试。",
            detail:
              "它的特点是每个账号只试很少几次、来源 IP 却很多，所以只按 IP 限速收效有限。按账号限速、异常登录检测与多因素认证更有效。",
          },
          {
            term: "退避（Backoff）",
            plain: "失败几次后，要求等得越来越久再试。",
            detail:
              "相比直接永久锁定，指数退避对正常用户的误伤更小，也能让自动化尝试的吞吐急剧下降，常与告警一起使用。",
          },
        ],
      },
    },
    questions: [
      {
        key: "application-security-sup-sec-rate-limiting-s1",
        stageKey: "sec-defense",
        topicKey: "sec-rate-limiting",
        type: "single",
        stem: "关于登录接口的速率限制，下面哪种设计最能抵御分布式撞库？",
        options: [
          { key: "A", text: "只按来源 IP 限制，每个 IP 每分钟 10 次" },
          { key: "B", text: "只把计数放在单个应用实例的内存里" },
          { key: "C", text: "同时按账号与来源维度限速，计数存于共享存储，失败计数、成功清零" },
          { key: "D", text: "把账号永久锁定，且不提供任何解锁途径" },
        ],
        answer: ["C"],
        explanation:
          "撞库的特点是每个账号只试少量口令、但来源 IP 很多，所以只按 IP 限速容易被代理池绕过；只放在实例内存里，多实例部署时每个进程各算各的，实际阈值会被放大。同时按账号与来源两个维度计数、把计数放进 Redis 等共享存储，才能在整个集群生效。失败计数、成功清零并在必要时退避，可以在防暴力与减少误伤之间取得平衡；永久锁定还可能被滥用为拒绝服务。",
        difficulty: "medium",
        tags: ["速率限制", "撞库", "Redis"],
        sourceKey: "owasp-cheatsheets",
        level: "进阶",
      },
      {
        key: "application-security-sup-sec-rate-limiting-j1",
        stageKey: "sec-defense",
        topicKey: "sec-rate-limiting",
        type: "judge",
        stem: "应用部署了多个实例时，可以在每个实例的内存里各自计数，效果与使用共享计数存储相同。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "每个实例的内存计数器彼此独立，攻击者只要让请求被负载均衡分散到不同实例，每个实例看到的尝试次数都远低于阈值，实际允许的总尝试次数会被放大到阈值乘以实例数。多实例场景应把计数放进 Redis 等共享存储，保证整个集群对同一账号或来源使用同一份计数，才能得到预期的限制强度。",
        difficulty: "medium",
        tags: ["速率限制", "多实例", "共享存储"],
        sourceKey: "owasp-wstg",
        level: "进阶",
      },
    ],
  },
];
