/**
 * 计算机网络 · 知识点扩容 D 批（追加式，2026-10-31）。
 *
 * 新增 3 个知识点，不改动 computer-networking.ts 与 A/B/C 批文件。主题：HTTP/1.1
 * 报文语义与状态码、PPP 与广域网链路、移动 IP。防撞题：A 批已覆盖 HTTP/2 多路
 * 复用，base 已覆盖应用协议承载选择与封装分片——本批全部避开。
 */
import type { TopicExpansion } from "./topic-expansions";

export const computerNetworkingTopicExpansionsD: TopicExpansion[] = [
  {
    trackSlug: "computer-networking",
    stageKey: "net-layer-model-stage",
    topic: {
      key: "net-http11-semantics",
      title: "HTTP/1.1：报文语义、方法与状态码",
      summary:
        "HTTP 是文本的请求-应答协议：请求行 + 首部 + 空行 + 可选正文。方法表达意图（GET 安全幂等、POST 不幂等），状态码表达结果（2xx 成功、3xx 重定向、4xx 客户端错、5xx 服务器错），首部的 Connection 与 Host 支撑了 1.1 的持久连接与虚拟主机。",
      concepts: ["请求/应答报文结构", "方法的幂等与安全", "状态码分类与常用码", "持久连接与管线化", "Host 与 Cookie 首部"],
      principles: [
        "幂等方法（GET/PUT/DELETE）重复执行结果不变——重试安全；POST 不幂等——重试可能重复下单，因此客户端对 POST 超时要谨慎自动重试。",
        "状态码三位数首位定类：1xx 信息、2xx 成功（200/201/204）、3xx 重定向（301 永久/302 临时/304 未修改配合缓存）、4xx 客户端错（400/401/403/404/429）、5xx 服务器错（500/502/503）。",
        "HTTP/1.1 默认 Connection: keep-alive 持久连接——一次 TCP 握手服务多次请求；管线化（同时发多个请求）因队头阻塞实际被禁用，HTTP/2 用多路复用解决。",
        "Host 首部是 1.1 的必填项——一台服务器一个 IP 上跑多个网站（虚拟主机）靠它区分；Cookie/Set-Cookie 让无状态协议有了会话记忆。",
      ],
      applications: [
        "RESTful API 的语义映射：GET 读、POST 建、PUT 全量改、DELETE 删——幂等性决定重试策略。",
        "CDN 与缓存体系靠 304 Not Modified + ETag/Last-Modified 省流量。",
        "502/503 的排障方向完全不同：502 是反向代理后面的应用挂了，503 是限流或过载——状态码是排障路标。",
      ],
      pitfalls: [
        "把 301 与 302 混用：301 永久重定向会被浏览器与搜索引擎缓存，误用后改回极其痛苦。",
        "以为 GET 没有正文就不能携带数据——查询参数在 URL 里，但它可能被日志与缓存记录，敏感数据不能用 GET。",
        "HTTP/1.1 的管线化不是并发：响应必须按请求顺序返回，慢的第一个响应堵住所有后续——这才是 HTTP/2 多路复用的动机。",
      ],
      method:
        "排障抓包先读三段：请求行（方法+路径+版本）、状态行（版本+码+短语）、关键首部（Host/Content-Type/Connection/Set-Cookie）——语义问题都在这三段里。",
      exercise:
        "用 curl -v 请求一个网站：标出请求行、Host 首部、应答状态码与 Set-Cookie；再连续请求两次同一静态资源，观察 304 与 ETag/If-None-Match 的配合。",
      checkpoint: "能默写请求/应答报文的四段结构，能对常用方法判断幂等性、对常用状态码分类并给出排障含义。",
      lesson: {
        overview: [
          "HTTP 的设计哲学是「文本协议 + 无状态 + 请求-应答」：每条报文人类可读，每次请求自带全部上下文（服务器不记你是谁，Cookie 是唯一的记忆补丁）。这套简单性让 HTTP 成为互联网的通用方言——HTTP 之上的 API、代理、缓存、CDN 全部依赖「语义可以被中间设备理解」。",
          "1.1 相对 1.0 的三大增强：持久连接（省掉每请求一次握手）、Host 首部（一台服务器 hosting 多个网站）、Chunked 传输（流式发送未知长度的正文）。三件事都是「在文本协议框架内挖潜」——挖到管线化遭遇队头阻塞为止，突破要等 HTTP/2 的二进制帧。",
          "方法与状态码是 HTTP 的语法词表：方法表达客户端的意图（安全、幂等与否决定重试策略），状态码表达服务器的结论（首位分类决定客户端的下一步动作）。读懂这两张表，API 调试的一半工作就完成了。",
        ],
        mechanism: [
          "报文结构：请求 = 请求行（METHOD /path HTTP/1.1）+ 首部（每行 Key: Value）+ 空行 + 正文；应答 = 状态行（HTTP/1.1 200 OK）+ 首部 + 空行 + 正文。空行是头与体的分界——代理与缓存靠它切分。",
          "方法语义：GET（读，安全幂等，可缓存）、POST（非幂等，创建/提交）、PUT（幂等，全量替换）、DELETE（幂等，删除）、HEAD（GET 去掉正文，探测用）、OPTIONS（询问能力，CORS 预检用它）。幂等 ≠ 无副作用：DELETE 有副作用但重复执行结果一致。",
          "持久连接与队头阻塞：keep-alive 下请求串行复用一条 TCP；管线化允许连续发请求，但应答必须按序返回——第一个慢响应阻塞全部后续。HTTP/2 把报文拆成帧交错传输，才是真正的并行。",
          "缓存协商：服务器给 ETag（内容指纹）或 Last-Modified；客户端下次带 If-None-Match / If-Modified-Since，未变则回 304 不带正文——省流量不减缓存正确性。301/302 重定向的浏览器缓存行为差异是运维的经典坑。",
        ],
        example: {
          title: "一次完整的 HTTP/1.1 会话原文",
          language: "text",
          code: "=== 请求 ===\nGET /api/users/42 HTTP/1.1\r\nHost: api.example.com\r\nAccept: application/json\r\nIf-None-Match: \"v7\"\r\n\r\n=== 应答（内容未变） ===\nHTTP/1.1 304 Not Modified\r\nETag: \"v7\"\r\nCache-Control: max-age=3600\r\n\r\n=== 应答（内容变了） ===\nHTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 87\r\nSet-Cookie: session=abc; HttpOnly; SameSite=Lax\r\n\r\n{\"id\":42,\"name\":\"Alice\"}",
          explanation:
            "原文里有四个考点：Host 首部（1.1 必填，虚拟主机靠它分流）；If-None-Match 与 ETag 的协商缓存——内容未变回 304 零正文，变了回 200 带新内容与新 ETag；Set-Cookie 的 HttpOnly 标记（禁止 JS 读取防 XSS 偷会话）；空行分隔首部与正文——抓包时找空行就是找正文起点。文本协议的可读性让这一切肉眼可查，这是 HTTP 统治应用层的隐性优势。",
        },
        practiceSteps: [
          "用 curl -v 完成题面实验，标注报文四段与协商缓存行为。",
          "故意访问不存在的路径，记录 404 与自定义错误页的报文差异。",
          "对比 HTTP/1.1 与 HTTP/2 在抓包里的帧形态（Wireshark 解密 TLS 后）。",
          "对同一资源分别验证 301 与 302 的浏览器缓存行为（用无痕窗口）。",
        ],
        masteryChecklist: [
          "能默写请求/应答报文的四段结构与各段职责。",
          "能对 GET/POST/PUT/DELETE 判断幂等性并说明重试策略差异。",
          "能按状态码首位分类并解释 301/302/304 的缓存语义。",
        ],
        summary: [
          "四段报文：请求行/状态行、首部、空行、正文。",
          "幂等决定重试安全：GET/PUT/DELETE 幂等，POST 不幂等。",
          "304 + ETag 是协商缓存的核心；301 永久 302 临时。",
          "keep-alive 持久连接，管线化被队头阻塞终结——突破在 HTTP/2。",
        ],
        terms: [
          {
            term: "幂等",
            plain: "同一个请求发一次和发一百次，服务器的最终状态一样。",
            detail: "GET/PUT/DELETE 幂等，POST 不幂等。重试策略、代理转发、消息队列的 at-least-once 语义都围绕它。",
          },
          {
            term: "304 Not Modified",
            plain: "内容没变，用你手里的缓存吧——不带正文的应答。",
            detail: "配合 ETag/If-None-Match 或 Last-Modified/If-Modified-Since 使用。省的是正文流量与渲染时间。",
          },
          {
            term: "Cookie",
            plain: "服务器发给浏览器的小纸条，之后每次请求自动带上。",
            detail: "无状态 HTTP 的会话记忆。HttpOnly 防 JS 偷、Secure 限 HTTPS、SameSite 防 CSRF——三个标志各管一种攻击。",
          },
          {
            term: "管线化",
            plain: "不等应答就连续发下一个请求。",
            detail: "HTTP/1.1 允许但响应必须按序返回——队头阻塞让它实际被禁用。HTTP/2 用帧交错真正解决。",
          },
        ],
      },
    },
    questions: [
      {
        key: "computer-networking-exp-net-http11-semantics-s1",
        stageKey: "net-layer-model-stage",
        topicKey: "net-http11-semantics",
        type: "single",
        stem: "客户端调用支付接口（POST /api/pay）后网络超时，无法确认服务器是否处理成功。正确的重试策略与原因是？",
        options: [
          { key: "A", text: "立即重试：POST 是 HTTP 方法之一，天然幂等，重复执行结果不变" },
          { key: "B", text: "不能盲目重试：POST 不幂等，重试可能造成重复扣款；应带幂等键（如唯一请求 ID）让服务器去重后再重试" },
          { key: "C", text: "改用 GET 重试：GET 不会产生副作用" },
          { key: "D", text: "改用 PUT 重试：PUT 幂等所以一定安全" },
        ],
        answer: ["B"],
        explanation:
          "POST 的语义是非幂等——同一笔支付请求重发两次，服务器可能扣两次款。盲目重试（A）在超时场景下有真实的资金风险：超时不代表失败，可能服务器已处理、只是应答丢了。工程解法是幂等键：请求携带唯一 ID，服务器以它去重（重复请求返回第一次的结果）——重试从此安全。GET 不携带支付语义（C）；PUT 的幂等是「同一资源全量替换」，对创建类支付动作不适用（D）。",
        difficulty: "medium",
        tags: ["HTTP 方法", "幂等性", "重试策略"],
        sourceKey: "system-design-primer",
        level: "进阶",
      },
      {
        key: "computer-networking-exp-net-http11-semantics-j1",
        stageKey: "net-layer-model-stage",
        topicKey: "net-http11-semantics",
        type: "judge",
        stem: "HTTP/1.1 的管线化（pipelining）允许客户端在收到前一个应答之前发送下一个请求，因此它实现了请求的真正并发处理。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "管线化只解决了「发送端不用等」——请求可以连续发出；但 HTTP/1.1 的应答必须严格按请求顺序返回（协议无法标注哪个应答对应哪个请求）。第一个慢响应会把后面所有已完成的应答堵在后面——这就是应用层的队头阻塞，RFC 也因此从未允许默认开启管线化。真正的并发要等 HTTP/2：报文拆成带流 ID 的二进制帧，多流交错复用同一条连接，互不阻塞。发出去了 ≠ 并发处理了——这是 1.1 管线化与 2 多路复用的本质分界。",
        difficulty: "medium",
        tags: ["管线化", "队头阻塞", "HTTP/1.1"],
        sourceKey: "wireshark",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "computer-networking",
    stageKey: "net-link-tools-stage",
    topic: {
      key: "net-ppp-wan",
      title: "PPP：点对点链路的帧格式与协商",
      summary:
        "PPP 是拨号与广域点对点链路的标准协议：LCP 建立与配置链路，NCP（如 IPCP）协商网络层参数（分配 IP），认证可选 PAP/CHAP。帧格式带标志字段定界、有校验无重传——错帧丢弃交给上层。",
      concepts: ["LCP/NCP 分层协商", "帧格式与标志字节 0x7E", "字节填充与透明传输", "PAP 与 CHAP 认证", "零比特填充对比"],
      principles: [
        "PPP 的三段式协商：LCP（Link Control Protocol）建立链路参数 → 可选认证（PAP 明文两次握手 / CHAP 三次握手不定时挑战）→ NCP（IPCP 分配 IP 地址与协商网络参数）。",
        "帧格式：标志 0x7E 定界 + 地址 0xFF + 控制 0x03 + 协议字段 + 信息 + FCS + 标志 0x7E；地址与控制在点对点链路上是固定占位。",
        "透明传输：同步线路用零比特填充（遇连续五个 1 插一个 0）；异步线路（拨号）用字节填充（0x7E 与 0x7D 转义）。",
        "PPP 只检错不纠错：FCS 校验失败的帧静默丢弃——可靠传输交给上层（如 TCP），这与以太网的取舍一致。",
      ],
      applications: [
        "PPPoE 是 PPP over Ethernet：家庭宽带拨号上网的标准形态，认证计费靠它。",
        "串行链路与 4G/5G 模组的数据通道常见 PPP（移动设备的 IP 分配）。",
        "VPN 的 L2TP/IPsec 携带 PPP 帧复用其认证与地址协商。",
      ],
      pitfalls: [
        "把 PPP 当成有流量控制与可靠重传的协议——它只有 FCS 检错，可靠性与拥塞控制都在上层。",
        "混淆 PAP 与 CHAP：PAP 明文两次握手（可被抓包重放），CHAP 只传哈希挑战、口令不上线且可不定时重挑战。",
        "零比特填充与字节填充用错场景：同步线路（SDH）用前者，异步拨号用后者——PPP 两种都支持。",
      ],
      method:
        "PPP 题目先看层：链路参数问 LCP、地址分配问 NCP/IPCP、认证问 PAP/CHAP、透明传输问同步/异步线路；帧格式题先找 0x7E 定界再数 FCS。",
      exercise:
        "画出 PPP 帧的完整字段序列并标注每段长度；推演一段含 0x7E 字节的数据在异步线路发送时的字节填充结果；对比 CHAP 三次握手的报文顺序与 PAP 的差异。",
      checkpoint: "能默写 PPP 帧字段序列与两种填充方式，能分清 LCP/NCP/认证三段协商的职责与顺序。",
      lesson: {
        overview: [
          "点对点链路（两台设备直连）不需要寻址，但需要「对齐语言」：MTU 多大、要不要认证、IP 地址谁分配——PPP 的三层协商（LCP → 认证 → NCP）就是这套对齐流程。它比以太网简单（没有寻址问题），比裸串口完整（有帧定界、检错与协商）。",
          "帧格式里最值得琢磨的是两个「固定占位」：地址字段恒 0xFF、控制字段恒 0x03——点对点链路没有「别的站」，这两个字段是从 HDLC 继承的历史遗迹，存在的意义是帧结构的规整。透明传输才是真正的技术点：数据里出现标志字节 0x7E 怎么办？同步线路按比特填充，异步线路按字节转义——两条路线对应两种物理层。",
          "认证是 PPP 的可选段但现代必选：PAP 的明文口令在线上裸奔（两次握手），CHAP 用挑战-应答让口令永不上线（三次握手 + 可不定时重复挑战防重放）。家庭宽带的 PPPoE 把 PPP 装进以太网帧——运营商的认证计费体系全部建立在 CHAP 之上。",
        ],
        mechanism: [
          "协商三段：LCP 先行（MRU 最大接收单元、是否认证、压缩选项）→ 认证可选（PAP/CHAP/EAP）→ NCP 按网络层各开各会（IPCP 协商 IP 地址与 DNS，IPv6CP 协商接口标识）。NCP 打开则链路进入「网络层可用」状态，NCP 关闭则回到链路层可用。",
          "帧定界与填充：0x7E 是帧的首尾标志。同步线路（比特流）用零比特填充——发送端遇连续五个 1 自动插 0，接收端遇五个 1 删后一位；异步线路（字节流）用字节填充——0x7E 转义为 0x7D 0x5E、0x7D 转义为 0x7D 0x5D。两种填充恢复后的数据与原文逐位（逐字节）一致。",
          "FCS 与错误处理：16 位 CRC 校验整个信息字段，校验失败整帧丢弃、计数器加一——PPP 不重传。这个「只检错」的取舍与以太网一致：链路错误率在现代介质上足够低，重传的经济性不如交给 TCP 端到端。",
          "CHAP 的三次握手：认证方发随机挑战 → 被认证方用口令的哈希应答 → 认证方比对并应答成功/失败。口令本身永不上线、挑战随机（防重放）、可以周期性重新挑战（在线持续验证）——三个安全属性都优于 PAP 的单次明文。",
        ],
        example: {
          title: "异步线路的字节填充演算",
          language: "python",
          code: "def ppp_byte_stuff(payload: bytes) -> bytes:\n    out = bytearray([0x7E])                # 帧首标志\n    for b in payload:\n        if b == 0x7E:                      # 标志字节 → 转义\n            out += bytes([0x7D, 0x5E])\n        elif b == 0x7D:                    # 转义字节本身 → 再转义\n            out += bytes([0x7D, 0x5D])\n        else:\n            out.append(b)\n    out.append(0x7E)                       # 帧尾标志\n    return bytes(out)\n\ndef ppp_unstuff(stuffed: bytes) -> bytes:\n    out, i = bytearray(), 1                # 跳过首标志\n    while i < len(stuffed) - 1:\n        if stuffed[i] == 0x7D:             # 转义前缀：下一字节 XOR 0x20\n            out.append(stuffed[i + 1] ^ 0x20)\n            i += 2\n        else:\n            out.append(stuffed[i]); i += 1\n    return bytes(out)\n\npayload = bytes([0x01, 0x7E, 0x45, 0x7D, 0x02])\nstuffed = ppp_byte_stuff(payload)\nprint(stuffed.hex(' '))       # 7e 01 7d 5e 45 7d 5d 02 7e\nprint(ppp_unstuff(stuffed) == payload)   # True",
          explanation:
            "字节填充的对称性：转义规则是 0x7E → 0x7D 0x5E 与 0x7D → 0x7D 0x5D，解填充统一用「0x7D 的下一字节异或 0x20」还原——0x5E XOR 0x20 = 0x7E、0x5D XOR 0x20 = 0x7D。转义字节本身（0x7D）也要被转义，否则数据里出现 0x7D 会被误当转义前缀。零比特填充（同步线路）的思想相同，只是粒度从字节换成比特：五个连续 1 之后插 0。",
        },
        practiceSteps: [
          "手推题面字节的填充结果，与代码输出比对。",
          "用 Wireshark 抓 PPPoE 拨号（或读一份 PPP 会话日志），标出 LCP/认证/IPCP 三段。",
          "对比零比特填充与字节填充在「五个连续 1」数据上的处理差异。",
          "查 PPPoE 会话的 PADT 报文，理解断链流程与 PPP 的 LCP Terminate 对应关系。",
        ],
        masteryChecklist: [
          "能默写 PPP 帧的字段序列与两种透明传输方式。",
          "能分清 LCP、认证、NCP 三段协商的顺序与职责。",
          "能对比 PAP 与 CHAP 的安全属性。",
        ],
        summary: [
          "PPP 三段协商：LCP 定链路、认证可选、NCP 配网络层。",
          "帧 = 0x7E 定界 + FF/03 占位 + 协议 + 信息 + FCS + 0x7E。",
          "同步线路零比特填充、异步线路字节填充，透明传输双路线。",
          "只检错不重传；CHAP 挑战应答完胜 PAP 明文。",
        ],
        terms: [
          {
            term: "LCP",
            plain: "链路控制协议：先把「这条链路的规矩」谈好。",
            detail: "协商 MRU、认证方式、压缩与魔术字（检测环回）。谈崩了链路就不建立。",
          },
          {
            term: "IPCP",
            plain: "NCP 里的 IP 分支：给链路两端分配 IP、协商 DNS。",
            detail: "家庭宽带拨号拿到的公网/私网 IP 就是 IPCP 分配的。NCP 是一族协议，每种网络层各一个。",
          },
          {
            term: "CHAP",
            plain: "挑战握手认证：口令不上线，上线的是口令的哈希应答。",
            detail: "随机挑战防重放、可周期重复挑战。三次握手：挑战 → 哈希应答 → 成功/失败。",
          },
          {
            term: "PPPoE",
            plain: "把 PPP 装进以太网帧：家庭宽带拨号的载体。",
            detail: "发现阶段（PADI/PADO/PADR/PADS）找服务器建会话，之后 PPP 帧封装在 PPPoE 内传输。",
          },
        ],
      },
    },
    questions: [
      {
        key: "computer-networking-exp-net-ppp-wan-s1",
        stageKey: "net-link-tools-stage",
        topicKey: "net-ppp-wan",
        type: "single",
        stem: "PPP 从链路建立到网络层可用的协商顺序是？",
        options: [
          { key: "A", text: "NCP 分配 IP → LCP 建立链路 → 认证" },
          { key: "B", text: "LCP 建立并配置链路 → （可选）PAP/CHAP 认证 → NCP（如 IPCP）协商网络层参数" },
          { key: "C", text: "认证 → NCP → LCP，三层顺序可以互换" },
          { key: "D", text: "LCP 与 NCP 同时进行，认证在数据传输期间随时插做" },
        ],
        answer: ["B"],
        explanation:
          "三段顺序有严格的依赖关系：LCP 先把链路本身的参数（MRU、认证方式）谈妥——链路可用之后才谈得上认证（认证协议自身需要链路承载）；认证通过后才进入 NCP——IPCP 分配 IP 地址与 DNS，让网络层「有地址可用」。每一层为下一层提供承载：链路承认证、认证承 NCP、NCP 承 IP 包。D 的「随时插做」违背协商状态机；A 的顺序倒置会在没有链路时谈地址。",
        difficulty: "medium",
        tags: ["PPP", "LCP", "NCP", "协商顺序"],
        sourceKey: "linux-kernel",
        level: "进阶",
      },
      {
        key: "computer-networking-exp-net-ppp-wan-j1",
        stageKey: "net-link-tools-stage",
        topicKey: "net-ppp-wan",
        type: "judge",
        stem: "PPP 提供了 FCS 校验与重传机制，因此在不可靠的链路上也能保证数据帧的可靠交付。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "PPP 只有检错没有重传：FCS 校验失败的帧被静默丢弃并计数，绝不重发。这个取舍与以太网一致——现代链路的误码率足够低，逐帧重传的经济性远不如把可靠性交给端到端（TCP 的确认重传按需工作、还能做拥塞控制）。PPP 的可靠交付目标因此不存在：它承诺的是「帧定界正确、错帧可检测」，交付质量由上层协议负责。这条设计也呼应了端到端原则：链路层保持简单，智能放在两端。",
        difficulty: "easy",
        tags: ["PPP", "FCS", "可靠性"],
        sourceKey: "linux-kernel",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "computer-networking",
    stageKey: "net-routing-stage",
    topic: {
      key: "net-mobile-ip",
      title: "移动 IP：换个网络还接得到你",
      summary:
        "移动设备换到外地网络，IP 变了老朋友就找不到你。移动 IP 用两个地址解这个题：家乡地址（永久身份）+ 转交地址（当前位置），家乡代理像传达室把包截住、隧道送到外地、外地代理拆隧道本地交付。",
      concepts: ["家乡地址与转交地址", "家乡代理与外地代理", "隧道与三角路由", "代理发现与注册", "路由优化"],
      principles: [
        "家乡地址（HoA）是设备的永久身份，通信对端永远用它；转交地址（CoA）反映当前接入位置——身份与位置解耦是移动 IP 的核心思想。",
        "家乡代理（HA）在家乡网络截获发往 HoA 的包，经隧道封装送到 CoA；外地代理（FA）拆隧道后在本地链路交付（或设备自己持有协同定位 CoA 直接拆）。",
        "三角路由：对端 → 家乡代理 → 隧道 → 移动节点，绕家乡一圈；路由优化让对端缓存绑定关系后直发 CoA——代价是对端要懂移动 IP。",
        "代理发现（ICMP 路由通告扩展）让设备感知外地代理，注册报文（经隧道给 HA）完成 HoA↔CoA 的绑定与生命周期管理。",
      ],
      applications: [
        "运营商核心网的移动性管理（3GPP 的 GTP 隧道）是移动 IP 思想的工业化版本。",
        "企业无线漫游：跨 AP 切换时保持 TCP 会话，靠的是 IP 不变 + 链路层快速切换。",
        "车队/物联网设备的固定寻址：设备换基站不换 IP，管理面不用重新发现。",
      ],
      pitfalls: [
        "把转交地址当成新身份——CoA 只是邮政信箱，对外通信对端仍应使用家乡地址（除非做了路由优化）。",
        "忽略三角路由的延迟代价：所有包绕道家乡网络，跨洲场景延迟翻倍——路由优化是对端配合才能启用的增强。",
        "以为移动 IP 解决 Wi-Fi 漫游——AP 间的快速切换主要靠链路层，移动 IP 解决的是跨 IP 网段的网络层移动。",
      ],
      method:
        "移动 IP 题按四步流程走：代理发现（知道自己在哪、FA 是谁）→ 注册（CoA 报给 HA）→ 隧道传输（HA 截包送 CoA）→ 拆隧道交付；路由优化是第五步的可选增强。",
      exercise:
        "画出移动节点从家乡网络漫游到外地网络后的完整包流：通信对端发往 HoA 的包如何经 HA 隧道到达移动节点，移动节点的应答又如何直接回到对端（三角路由的形状）。",
      checkpoint: "能区分 HoA 与 CoA 的角色，能画出三角路由并解释隧道封装的方向。",
      lesson: {
        overview: [
          "IP 地址有双重身份：它是「你是谁」（通信对端寻址你）也是「你在哪」（路由器据此转发）。设备不移动时两个身份合一，移动后立刻撕裂——换个网段地址必然改变，改了地址对端就找不到你。移动 IP 的全部设计就是让两个身份分离工作：家乡地址保持「你是谁」，转交地址追踪「你在哪」，家乡代理把两个地址缝合起来。",
          "缝合的机制是隧道：家乡代理截获发往家乡地址的包（家乡网络上的其他主机都以为设备还在，ARP 代理应答把包引向 HA），用 IP-in-IP 封装后发往转交地址；外地代理（或设备自身）拆开隧道把包交付。移动节点发出的应答包则直接发往对端（三角路由的第三边）——入口绕家乡、出口直达，形状像一个三角形。",
          "三角路由是设计的第一版遗憾：对端在上海、设备在广州、家乡在北京——每个包都先飞北京再飞广州。路由优化让移动节点向对端发送绑定更新（HoA↔CoA 映射），对端缓存后直发 CoA——隧道退化为备用。代价是对端协议栈要理解移动 IP——互联网上推广缓慢的原因就在这个「需要对方配合」。4G/5G 用 GTP 隧道 + 运营商控制的锚点绕开了这个依赖。",
        ],
        mechanism: [
          "代理发现：外地网络的路由器周期广播 ICMP 路由通告（扩展携带移动 IP 信息），移动节点由此发现「我到外地了」并取得外地代理的 CoA（FA-CoA）或通过 DHCP 拿协同定位 CoA（co-located，设备自持）。",
          "注册：移动节点经 FA（或直接）向 HA 发注册请求——声明「HoA 现在对应 CoA」；HA 回注册应答并建立绑定表（HoA ↔ CoA，带生命周期）。注册报文本身经隧道送到 HA——此时只有隧道可用。",
          "隧道与交付：HA 用代理 ARP 截获发往 HoA 的包，IP-in-IP（或 GRE）封装外层目的为 CoA；FA 收到拆外层，内层目的 HoA 在本地链路上交付（代理 ARP 让 FA 持有 HoA 的 MAC）。反向路径：移动节点直接发包给对端（源地址 HoA，外地出口路由器需容忍——反向过滤是部署坑）。",
          "三角路由与优化：默认路径 对端→HA→隧道→MN。路由优化（IPv6 的 mobility 扩展内置）：MN 向对端发 Binding Update，对端缓存后直发 CoA，HA 只在新绑定前兜底。IPv6 把移动支持纳入协议本体，正是吸取了 v4 时代「需要全网配合」的教训。",
        ],
        example: {
          title: "三角路由的完整包流",
          language: "text",
          code: "家乡网络（北京）            外地网络（广州）\n  HA（家乡代理）              FA（外地代理）\n      ↑ 隧道（IP-in-IP）          ↓ 拆隧道\n对端（上海）--包目的=HoA--> HA --隧道--> FA --交付--> MN（HoA=198.18.1.7, CoA=广州）\nMN 应答 --源=HoA, 目的=对端--（直发，不经 HA）--> 对端\n\n三角路由的三条边：\n  对端 → HA：正常路由（对端只知道 HoA 在家乡）\n  HA → FA：隧道（外层目的=CoA）\n  FA → MN：本地链路交付\n\n路由优化后：对端缓存绑定，直达 MN，三角塌成一条边。",
          explanation:
            "三角形的两条长边（对端→HA→FA）是初始状态的代价；MN 的应答直接回对端（源 HoA 可用，因为对端认 HoA）。路由优化发送 Binding Update 后，对端直发 CoA，三角形塌缩成对端→MN 的一条边——这是移动 IPv6 把绑定更新内置为协议报文的理由。HA 的角色像一个「永不过期的传达室」：不管你搬到哪，寄给老地址的信它都代收转寄。",
        },
        practiceSteps: [
          "画题面的三角路由图，标出每段的目的地址（内层/外层）。",
          "用两层虚拟机 + 手工隧道（ip tunnel）模拟 HA 截包转发的实验。",
          "抓一个 4G 终端移动前后的包，观察 GTP 隧道端点的变化（对应移动 IP 的 CoA 更新）。",
          "分析为什么反向包能直接回对端（源 HoA + 出口过滤的部署前提）。",
        ],
        masteryChecklist: [
          "能区分家乡地址与转交地址的身份/位置双重角色。",
          "能画出 HA 隧道与三角路由的包流并说明路由优化的作用。",
          "能按代理发现、注册、隧道、交付四步走完移动 IP 的流程。",
        ],
        summary: [
          "HoA 管身份、CoA 管位置，家乡代理做两者的缝合。",
          "HA 截包 → 隧道（IP-in-IP）→ FA 拆包本地交付。",
          "三角路由绕家乡；路由优化需要对端配合缓存绑定。",
          "代理发现 + 注册 + 隧道 + 交付，四步流程固定。",
        ],
        terms: [
          {
            term: "家乡地址（HoA）",
            plain: "设备的永久身份证：对端永远用它找你。",
            detail: "分配在家乡网络，设备离开家乡也不变。TCP 连接不因移动断开的前提。",
          },
          {
            term: "转交地址（CoA）",
            plain: "设备当前所在的「邮政信箱」地址。",
            detail: "外地代理的地址（FA-CoA）或设备自持的地址（协同定位 CoA）。生命周期到期需重新注册。",
          },
          {
            term: "家乡代理（HA）",
            plain: "家乡网络上的传达室：截获发往 HoA 的包并隧道转寄。",
            detail: "用代理 ARP 把发往 HoA 的包引到自己，IP-in-IP 封装外层目的为 CoA。绑定表记录 HoA↔CoA。",
          },
          {
            term: "三角路由",
            plain: "对端→家乡→外地→设备 的绕路形状。",
            detail: "初始移动 IP 的固有代价。路由优化（对端缓存绑定）后三角塌缩为直连。",
          },
        ],
      },
    },
    questions: [
      {
        key: "computer-networking-exp-net-mobile-ip-s1",
        stageKey: "net-routing-stage",
        topicKey: "net-mobile-ip",
        type: "single",
        stem: "移动节点漫游到外地网络后，通信对端（不支持移动 IP）发送一个目的地址为家乡地址的包。这个包最终如何到达移动节点？",
        options: [
          { key: "A", text: "对端直接把包发到外地网络的新地址，因为 DHCP 已更新了地址" },
          { key: "B", text: "家乡代理截获该包，用隧道封装后送到转交地址，由外地代理（或节点自身）拆隧道交付" },
          { key: "C", text: "包被家乡网络丢弃，移动节点必须主动轮询家乡代理获取" },
          { key: "D", text: "对端通过 DNS 查询到移动节点的新位置后直发" },
        ],
        answer: ["B"],
        explanation:
          "对端不支持移动 IP，它认的永远是家乡地址（HoA）——包按正常路由到达家乡网络。家乡代理用代理 ARP 截获该包，IP-in-IP 封装（外层目的 = 转交地址 CoA）后隧道送往外地；外地代理拆掉外层封装，按内层的 HoA 在本地链路交付（FA 事先通过代理 ARP 持有该 HoA 的 MAC）。这就是「三角路由」的长边。A 错误：对端发往 HoA 的包与新 CoA 无关，DHCP 只影响节点自身的 CoA；D 的 DNS 更新是另一条路（动态 DNS），不属于移动 IP 的隧道机制且有缓存延迟。",
        difficulty: "medium",
        tags: ["移动 IP", "家乡代理", "隧道"],
        sourceKey: "linux-kernel",
        level: "进阶",
      },
      {
        key: "computer-networking-exp-net-mobile-ip-j1",
        stageKey: "net-routing-stage",
        topicKey: "net-mobile-ip",
        type: "judge",
        stem: "移动 IP 的「三角路由」问题是：通信对端发往移动节点的每个包都要先绕道家乡网络再隧道到外地，即使对端与移动节点近在咫尺。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "三角形的两条长边正是不必要的绕行：对端不知道 HoA 已绑定到外地 CoA，包按 IP 路由的「常识」发往家乡网络，再由 HA 隧道转寄。对端与移动节点即使同处一个机房，包也要跨到家乡网络折返——延迟与带宽双重浪费。路由优化的解法是移动节点向对端发送绑定更新（HoA↔CoA），对端缓存后直发 CoA，三角形塌缩为一条直连边；IPv4 时代因「需要对端配合」推广受限，IPv6 把绑定更新内置为协议原生报文，算是吸取了教训。注意优化的安全性：绑定更新本身需要认证，否则攻击者可以声明别人的 HoA 归自己。",
        difficulty: "medium",
        tags: ["三角路由", "路由优化", "绑定更新"],
        sourceKey: "linux-kernel",
        level: "进阶",
      },
    ],
  },
];
