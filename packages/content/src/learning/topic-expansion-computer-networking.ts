/**
 * 计算机网络 · 知识点扩容（2026-10-17）。
 *
 * 只新增知识点，不动原课程文件：每条 expansion = 1 个新知识点 + 2 道配套题，
 * 由 expandLearningTrack 在运行时按 stageKey 追加到对应阶段。
 *
 * 选题刻意贴着原课程已有知识点的边界往外扩：
 *   - 原 net-tcp-reliability 讲可靠传输的骨架，这里补拥塞控制算法与两种重传路径；
 *   - 原 net-app-protocols 只提了一句 HTTP/2 / DNS / TLS，这里各拆成一个独立知识点；
 *   - 原 net-arp-nat 讲 NAT 的基本行为，这里补 NAT 类型判定与穿透；
 *   - 原 net-debug-tools 讲分层排障方法，这里补丢包定位的证据链。
 * 因此 6 个 topicKey 与既有 12 个 topicKey 均不重复，标题也不重复。
 */
import type { TopicExpansion } from "./topic-expansions";

export const computerNetworkingTopicExpansions: TopicExpansion[] = [
  {
    trackSlug: "computer-networking",
    stageKey: "net-transport-stage",
    topic: {
      key: "net-tcp-congestion-recovery",
      title: "TCP 拥塞控制与丢包恢复",
      summary:
        "拥塞窗口决定链路上同时在飞的数据量；三个重复 ACK 走快速重传，RTO 超时才会把窗口打回起点。CUBIC 把丢包当拥塞信号，BBR 则用带宽与最小 RTT 建模。",
      concepts: ["拥塞窗口 cwnd", "RTO 与快速重传", "SACK 与重复 ACK", "CUBIC 与 BBR"],
      principles: [
        "发送窗口取 cwnd 与 rwnd 的较小值：前者是网络允许的在途量，后者是接收端剩余缓冲。",
        "连续三个重复 ACK 触发快速重传，说明后续报文已经到达；RTO 超时意味着连确认都迟迟不回，通常更严重。",
        "CUBIC 把丢包当作拥塞信号并压低窗口；BBR 持续测量瓶颈带宽与最小 RTT，丢包不必然导致降速。",
      ],
      applications: [
        "跨机房大文件传输按带宽时延积调大缓冲，并选 BBR 规避随机丢包导致的误降速。",
        "抓包里出现大量重传时，先区分链路丢包、接收窗口收缩还是应用读取太慢。",
      ],
      pitfalls: [
        "把任何重传都归因为链路故障，忽略接收端窗口收缩与应用不读数据这两种情况。",
        "只调大发送缓冲而不看带宽时延积，窗口再大也填不满高时延链路。",
      ],
      method:
        "先用 ss -ti 看 cwnd、rtt、retrans 与 pacing，再对照两端抓包判断丢包发生在哪一段，最后才决定改窗口、换算法还是修应用。",
      exercise:
        "在同一条 100ms RTT 的链路上分别用 cubic 与 bbr 传 1GB 文件，记录 cwnd、重传率与吞吐，并解释两者的差异来源。",
      checkpoint:
        "能说清快速重传与超时重传各自的触发条件，以及为什么 BBR 不把丢包直接当成拥塞信号。",
      lesson: {
        overview: [
          "很多人把 TCP 的可靠性理解成重传，其实重传只是补救。真正决定速度的是发送端已发出但尚未被确认的数据量，也就是拥塞窗口。窗口开得小，链路再空也快不起来；开得过大，中间队列被塞满就会丢包，丢包又反过来触发降速。拥塞控制就是在这两者之间反复试探的一套规则，它决定了同一条链路在不同算法下的吞吐可以差出好几倍。",
          "理解拥塞控制还要分清两种丢包信号。收到重复 ACK 说明后面的报文已经到达，只是中间缺了一段，发送端可以快速重传并只小幅收缩窗口。等到重传定时器超时，意味着连确认都长时间没有回来，发送端只能把窗口打回起点重新慢启动。把这两种情况混为一谈，就会在排障时把短暂的乱序误判成严重拥塞。",
          "算法演进的分歧点在于如何看待丢包。CUBIC 沿用丢包即拥塞的假设，用三次函数逼近上一次的窗口上限；BBR 则持续测量瓶颈带宽与最小往返时延，据此算出应该发多少数据。前者在随机丢包的有损链路上容易误降速，后者在深队列链路上可能过于激进。没有普适最优，只有与链路特征匹配的选择。",
        ],
        mechanism: [
          "发送窗口由拥塞窗口与接收窗口的较小值决定。拥塞窗口由发送端维护，接收窗口由接收端在确认报文首部通告。任何一方为零，发送都会停下。用 ss -ti 可以同时看到拥塞窗口与接收窗口受限标记，从而判断瓶颈在发送端、网络还是接收端。",
          "快速重传依赖重复 ACK：接收端每收到一个乱序报文就重发一次期望的序号，发送端连续收到三个重复 ACK 便立刻重传缺失段，同时进入快速恢复，把窗口减半后继续发送，而不必等到超时。确认补齐后回到拥塞避免，而不是重新慢启动。",
          "超时重传由 RTO 触发，RTO 基于平滑 RTT 与方差估算，并有最小与最大边界。超时后发送端把拥塞窗口降到 1 个 MSS 重新慢启动，代价远大于快速重传。因此同一段丢失，越早被重复 ACK 发现，吞吐损失越小。内核在连续超时后还会成倍放大 RTO，避免在链路彻底拥塞时反复冲击。",
          "SACK 让接收端在确认报文里声明已经收到的非连续区间，发送端据此只重传真正缺失的段，避免把已到达的数据再发一遍。没有 SACK 时，一次丢包可能触发大段回退重传，在高带宽时延积链路上浪费明显。",
        ],
        example: {
          title: "用 ss -ti 读出拥塞窗口与重传",
          language: "bash",
          code: "# 查看当前连接使用的拥塞控制算法与实时指标\nss -ti dst 203.0.113.10\n\n# 输出里重点看这几项：\n# cubic wscale:7,7 rtt:42.5/3.2 rcv_space:29200\n# cwnd:38 ssthresh:32 retrans:0/7 bytes_acked:...\n\n# 查看与切换系统默认算法\nsysctl net.ipv4.tcp_congestion_control\nsysctl -w net.ipv4.tcp_congestion_control=bbr\n\n# 确认内核可用的算法列表\nsysctl net.ipv4.tcp_available_congestion_control",
          explanation:
            "ss -ti 把内核维护的连接状态直接摊开：rtt 后面的第二个数字是方差，cwnd 是当前拥塞窗口，retrans 的分子是本次连接重传次数、分母是总发送段数。先看 retrans 比例判断是否真的在丢包，再看 rwnd_limited 与 sndbuf_limited 判断限速点，最后才决定换算法还是调缓冲。",
        },
        practiceSteps: [
          "用 ss -ti 连续采样同一连接，记录 cwnd、rtt 与 retrans 的变化趋势。",
          "在可控环境里制造 1% 随机丢包，对比 cubic 与 bbr 的吞吐与重传率。",
          "在两端同时抓包，确认重传的段是否真的没有到达对端。",
        ],
        masteryChecklist: [
          "能区分 cwnd 与 rwnd，并说出各自保护谁。",
          "能解释三个重复 ACK 为什么足以触发重传。",
          "能说明 BBR 与 CUBIC 对丢包的不同处理。",
        ],
        summary: [
          "发送窗口取 cwnd 与 rwnd 的较小值。",
          "重复 ACK 走快速重传，超时则慢启动重来。",
          "SACK 让重传只补真正缺失的段。",
          "CUBIC 见丢包就降速，BBR 用带宽与最小 RTT 建模。",
        ],
        terms: [
          {
            term: "拥塞窗口（cwnd）",
            plain: "发送端自己估的、网络还能吞下多少数据。",
            detail:
              "它是对网络承载能力的估计，不是链路带宽本身。发送端通过 ACK 的节奏不断试探：能顺利确认就慢慢加大，出现丢包或时延上升就收缩。它和接收窗口一起决定实际发送窗口。",
          },
          {
            term: "快速重传（Fast Retransmit）",
            plain: "靠重复确认提前发现丢包，不用干等超时。",
            detail:
              "接收端遇到序号空洞时，每来一个后续报文就重复发一次期望序号。发送端收到三个重复 ACK 就认定该段丢失并立即补发，比等 RTO 快一个量级。",
          },
          {
            term: "RTO（重传超时）",
            plain: "等确认的最长耐心，超时了就从慢启动重来。",
            detail:
              "RTO 由平滑 RTT 加若干倍方差估算，避免把正常抖动误判成丢包。一旦超时，发送端不仅重传，还会把拥塞窗口打回 1 个 MSS，代价很高。",
          },
          {
            term: "带宽时延积（BDP）",
            plain: "链路上同时在飞的数据量上限，等于带宽乘往返时延。",
            detail:
              "1Gbps 链路配 100ms RTT，BDP 约 12.5MB。窗口小于这个值时，无论带宽多大都跑不满；窗口远大于它，则容易在中间队列堆积。",
          },
        ],
      },
    },
    questions: [
      {
        key: "computer-networking-exp-net-tcp-congestion-recovery-s1",
        stageKey: "net-transport-stage",
        topicKey: "net-tcp-congestion-recovery",
        type: "single",
        stem: "关于 TCP 的丢包恢复，下面哪一项描述是正确的？",
        options: [
          { key: "A", text: "收到三个重复 ACK 后，发送端仍要等 RTO 超时才重传" },
          { key: "B", text: "快速重传后进入快速恢复，窗口通常减半而不是回到 1 个 MSS" },
          { key: "C", text: "SACK 的作用是让接收端主动请求重发丢失的报文" },
          { key: "D", text: "只要发生重传，就说明链路一定出现了拥塞" },
        ],
        answer: ["B"],
        explanation:
          "三个重复 ACK 说明后续报文已经到达，发送端立即重传缺失段并进入快速恢复，窗口减半后继续探测，不必等超时。超时重传才会把窗口打回一个 MSS 重新慢启动。SACK 是接收端告知已收到的区间，由发送端决定补发哪一段。重传也可能来自乱序或接收端处理慢，不能直接等同于链路拥塞。",
        difficulty: "medium",
        tags: ["TCP", "拥塞控制", "重传"],
        sourceKey: "linux-kernel",
        level: "进阶",
      },
      {
        key: "computer-networking-exp-net-tcp-congestion-recovery-j1",
        stageKey: "net-transport-stage",
        topicKey: "net-tcp-congestion-recovery",
        type: "judge",
        stem: "在 BBR 拥塞控制下，只要出现丢包，发送端就一定会把拥塞窗口减半。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "BBR 用测得的最大带宽与最小 RTT 估算在途上限，丢包本身不是它的降速信号；只有估算出的带宽明显下降时才会调整发送速率。CUBIC 才把丢包当作拥塞信号并大幅收缩窗口。这也是 BBR 在有随机丢包的链路上吞吐更稳、但在深队列链路上可能过于激进的原因。",
        difficulty: "hard",
        tags: ["TCP", "BBR", "拥塞控制"],
        sourceKey: "linux-kernel",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "computer-networking",
    stageKey: "net-layer-model-stage",
    topic: {
      key: "net-http2-multiplexing",
      title: "HTTP/2 多路复用与队头阻塞",
      summary:
        "HTTP/2 把请求切成带流 ID 的二进制帧，在同一条 TCP 上并发交错传输，解决了应用层排队，却让队头阻塞落到 TCP 的按序交付上。",
      concepts: ["二进制分帧", "流与流 ID", "HPACK 首部压缩", "TCP 层队头阻塞"],
      principles: [
        "HTTP/2 把报文拆成 HEADERS、DATA 等帧，同一连接上的多个流可以交错发送，接收端按流 ID 重组。",
        "多路复用消除了 HTTP/1.1 的管道化阻塞，但所有流共享一条 TCP 连接，单个报文段丢失会让所有流一起等重传。",
        "HPACK 用静态表、动态表与哈夫曼编码压缩首部，压缩状态与连接绑定，代理不能随意改写首部。",
      ],
      applications: [
        "静态资源策略从合并请求转向按缓存粒度拆分，因为请求数不再是最主要的成本。",
        "gRPC 与长连接网关用 HTTP/2 承载多路调用，减少连接数与握手开销。",
      ],
      pitfalls: [
        "以为 HTTP/2 消除了所有队头阻塞，忽略单条 TCP 连接上丢包的连带影响。",
        "把多个大文件塞进同一条连接，弱网下互相拖累。",
        "在代理层随意改写首部，破坏 HPACK 动态表的前提。",
      ],
      method:
        "先用浏览器面板或 nghttp 观察流并发与帧交错，再结合抓包看丢包是否让所有流共同停顿，最后决定拆连接、调优先级还是换协议。",
      exercise:
        "在同一条 1% 丢包的链路上，分别用 HTTP/1.1 六连接与 HTTP/2 单连接加载同一组资源，比较完成时间并解释差异。",
      checkpoint:
        "能说明 HTTP/2 的队头阻塞转移到了哪一层，以及 QUIC 为什么能把它隔离到单流。",
      lesson: {
        overview: [
          "HTTP/1.1 的并发靠多开连接：浏览器对同一域名通常只开六条 TCP，多出来的请求必须排队。HTTP/2 换了个思路，把请求和响应切成带流标识的二进制帧，在同一条连接上交错发送，接收端按流标识拼回去。这样几十个请求可以共用一个连接，握手与慢启动的成本只付一次，首部压缩也把重复的 Cookie 与 User-Agent 压得很小。",
          "但多路复用并没有消灭队头阻塞，只是把它从应用层挪到了传输层。所有流共享同一条 TCP 连接，一旦某个报文段丢失，后续所有流的数据都要等在接收端按序重组，哪怕它们属于完全不同的请求。这就是为什么在丢包率高的移动网络上，单连接多路复用有时反而比多连接更慢。",
        ],
        mechanism: [
          "HTTP/2 的帧有固定九字节首部，包含长度、类型、标志与流标识。HEADERS 帧承载压缩后的首部，DATA 帧承载正文，同一流的帧保持有序，不同流的帧可以任意交错，接收端按流标识分别组装。此外还有 SETTINGS、WINDOW_UPDATE 与 PING 等控制帧，用于协商参数、调整流控和探测连通性。",
          "流是逻辑概念，客户端发起奇数流 ID，服务端发起偶数流 ID。一个流结束用 END_STREAM 标志表示，取消用 RST_STREAM。并发流数量受 SETTINGS_MAX_CONCURRENT_STREAMS 限制，超出就要排队。流 ID 不能复用，用尽后必须重新握手；每个流还有独立的流量控制窗口，避免一个大响应把整条连接占满。",
          "TCP 层队头阻塞来自按序交付：接收端必须等缺失段重传到达，才能把后续数据交给应用。HTTP/2 的多个流在同一条连接里，因此一次丢包会让所有流同时停摆。QUIC 把可靠传输做在 UDP 之上，各流独立重传，才真正把这个问题隔离到单流。",
        ],
        example: {
          title: "同一条连接上的三个请求如何交错",
          language: "text",
          code: "# 简化后的帧序列，-> 为客户端发出，<- 为服务端返回\n-> HEADERS stream=1 :method=GET :path=/a.css\n-> HEADERS stream=3 :method=GET :path=/b.js\n-> HEADERS stream=5 :method=GET :path=/c.png\n<- HEADERS stream=1 :status=200\n<- DATA    stream=1 len=4096 flags=END_STREAM\n<- DATA    stream=3 len=8192\n<- DATA    stream=5 len=2048\n<- DATA    stream=3 len=8192 flags=END_STREAM\n\n# 三个流交错出现，没有谁必须等谁\n# 但若 stream=3 的某个 DATA 段在链路上丢失：\n# TCP 会阻塞整条连接，stream=1 与 stream=5 的后续数据同样要等重传",
          explanation:
            "这段序列说明多路复用只解决应用层排队：三个请求的首部帧连续发出，响应的数据帧也可以交错返回，不需要像 HTTP/1.1 那样等前一个响应结束。但最后几行点出了代价：帧在同一条 TCP 字节流里，TCP 要求按序交付，任何一段丢失都会让整条连接停住，属于其它流的帧也只能在内核缓冲里等着，直到缺失段被重传补齐。",
        },
        practiceSteps: [
          "打开浏览器开发者工具的协议列，确认站点实际走的是 h2 还是 http/1.1。",
          "用 nghttp 或 curl --http2 观察同一连接上的流 ID 与帧交错。",
          "在弱网下对比单连接 HTTP/2 与多连接 HTTP/1.1 的加载曲线。",
        ],
        masteryChecklist: [
          "能说出流 ID 与常见帧类型各自的作用。",
          "能解释 HTTP/2 的队头阻塞为什么发生在 TCP 层。",
          "能说明 QUIC 如何在流级别隔离丢包。",
        ],
        summary: [
          "HTTP/2 用二进制帧与流 ID 在一条连接上并发多路请求。",
          "HPACK 压缩首部，但压缩状态与连接绑定。",
          "所有流共享一条 TCP，丢包会让全部流一起等。",
          "QUIC 把可靠传输下沉到流级别，才缓解这个问题。",
        ],
        terms: [
          {
            term: "多路复用（Multiplexing）",
            plain: "一条连接上同时跑很多请求，互不排队。",
            detail:
              "HTTP/1.1 靠多开连接实现并发，HTTP/2 靠流 ID 在同一条连接里交错发送。前者成本是握手与慢启动，后者成本是共享 TCP 带来的连带阻塞。",
          },
          {
            term: "流（Stream）",
            plain: "一次请求响应在连接里的逻辑通道，用 ID 区分。",
            detail:
              "流只是逻辑编号，不额外占连接。同一流内的帧必须有序，不同流的帧可以交错。流的生命周期由 END_STREAM 与 RST_STREAM 控制。",
          },
          {
            term: "HPACK",
            plain: "把重复的请求头压成索引，少传很多字节。",
            detail:
              "它维护静态表与动态表，动态表随连接演进，所以中间代理必须同步两侧的压缩上下文，不能只改一端。压缩是有状态的，这也是它比通用压缩更高效的原因。",
          },
          {
            term: "TCP 层队头阻塞",
            plain: "前面的字节没到，后面的字节只能干等。",
            detail:
              "TCP 保证按序交付，接收端不能把空洞之后的数据先交给应用。多路复用把多个请求放进同一条连接，于是原本互不相关的请求被这条连接绑在了一起。",
          },
        ],
      },
    },
    questions: [
      {
        key: "computer-networking-exp-net-http2-multiplexing-s1",
        stageKey: "net-layer-model-stage",
        topicKey: "net-http2-multiplexing",
        type: "single",
        stem: "关于 HTTP/2 的多路复用，下面哪一项说法正确？",
        options: [
          { key: "A", text: "多个流各自使用一条独立 TCP 连接，所以互不影响" },
          { key: "B", text: "多个流共享一条 TCP 连接，某个报文段丢失会让所有流一起等待重传" },
          { key: "C", text: "HTTP/2 使用可读的文本首部，便于人工排查" },
          { key: "D", text: "HPACK 压缩是无状态的，代理可以任意改写首部" },
        ],
        answer: ["B"],
        explanation:
          "HTTP/2 的多个流跑在同一条 TCP 连接里，TCP 要求按序交付，因此一个报文段丢失时，接收端必须等它重传到达才能把后续字节交给 HTTP/2 层，属于其它流的帧也被一并堵住。这正是队头阻塞从应用层转移到传输层的表现。HTTP/2 采用二进制分帧；HPACK 的压缩状态与连接绑定，代理改写首部会导致两侧动态表不一致。",
        difficulty: "medium",
        tags: ["HTTP/2", "多路复用", "队头阻塞"],
        sourceKey: "system-design-primer",
        level: "进阶",
      },
      {
        key: "computer-networking-exp-net-http2-multiplexing-j1",
        stageKey: "net-layer-model-stage",
        topicKey: "net-http2-multiplexing",
        type: "judge",
        stem: "HTTP/2 部署后应用层的队头阻塞被彻底消除，因此在丢包率高的链路上一定比 HTTP/1.1 更快。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "HTTP/2 消除的是 HTTP/1.1 管道化那种应用层排队，但所有流仍共享一条 TCP 连接，TCP 的按序交付会把单次丢包放大成全体流停顿。丢包率高时，多连接 HTTP/1.1 反而可能因为丢包影响被限制在单条连接内而更快。要真正按流隔离丢包，需要 QUIC 这类把可靠传输下沉到流级别的协议。",
        difficulty: "hard",
        tags: ["HTTP/2", "丢包", "性能"],
        sourceKey: "system-design-primer",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "computer-networking",
    stageKey: "net-layer-model-stage",
    topic: {
      key: "net-dns-resolution-chain",
      title: "DNS 解析链路与缓存",
      summary:
        "一次解析要经过浏览器、系统、递归解析器，再由解析器向根、顶级、权威逐级迭代查询；TTL 与各级缓存共同决定了改解析要等多久才生效。",
      concepts: ["递归查询与迭代查询", "根与权威服务器", "TTL 与多级缓存", "CNAME 与负缓存"],
      principles: [
        "客户端通常只向递归解析器发一次递归查询，剩下的迭代查询由解析器代劳。",
        "解析结果按 TTL 在浏览器、操作系统与解析器各级缓存，TTL 越长变更生效越慢。",
        "CNAME 把名字指向另一个名字，解析器必须继续追，追链越长时延越大、故障面越广。",
      ],
      applications: [
        "灰度切流量前先把 TTL 调短，给回滚留出生效窗口。",
        "解析异常时逐级 dig，定位是本地缓存、解析器缓存还是权威配置的问题。",
        "多地域部署用 GeoDNS 返回就近地址，缩短首包时延。",
      ],
      pitfalls: [
        "以为改了权威记录就立刻全网生效，忽略各级缓存里仍有旧值。",
        "把解析故障当成网站故障，直接去查服务器状态。",
        "域名刚注册就反复查，忽略负缓存会让不存在的结果持续一段时间。",
      ],
      method:
        "按浏览器缓存、系统缓存、递归解析器、权威服务器的顺序逐层验证，用 dig 指定服务器并观察 TTL 递减，避免在错误的一层反复试。",
      exercise:
        "对一个域名执行 dig +trace，标出每一跳的服务器角色与返回的 TTL，并解释本机缓存命中时为什么看不到这些跳。",
      checkpoint:
        "能说出递归查询与迭代查询分别由谁发起，以及 TTL 如何影响改解析的生效时间。",
      lesson: {
        overview: [
          "浏览器输入域名后，第一步不是连服务器，而是把名字换成地址。这个过程像查电话簿：先看自己手边有没有记过，再问运营商或公共解析器；解析器手里没有，就从根服务器开始一级级问下去，直到权威服务器给出答案。整条链路上任何一级缓存命中，后面的查询都不会发生，所以同一个域名在不同机器上解析耗时可能差出几十毫秒。",
          "缓存是 DNS 能撑住全球查询量的关键，也是变更生效慢的根源。每条记录都带 TTL，告诉各级缓存可以保存多久。你在权威侧把记录改掉，缓存里的旧值仍会继续服务到过期为止。因此计划切流量时，通常提前把 TTL 调短，等旧缓存自然过期后再改指向，给自己留出回滚窗口。",
        ],
        mechanism: [
          "递归查询是客户端对解析器的请求，语义是你要么给我最终答案，要么给我错误。迭代查询是解析器对根、顶级、权威的请求，对方只返回下一步该问谁，剩下的路要解析器自己走。两者常被混为一谈，但只要看谁在反复发包，就能分清当前处在哪一段。",
          "根服务器只返回对应顶级域的服务器地址，顶级域服务器返回该域权威服务器的地址，权威服务器才给出 A、AAAA 或 CNAME 记录。每一层都可能被缓存，缓存键包含域名、类型与一些标志位。解析器通常会把整条委托链上各层的地址都记下来，减少下次追问的次数。",
          "TTL 是秒数，解析器可以自行下调但不能上调。负缓存同样存在：域名不存在时会按 SOA 里的最小 TTL 缓存一段时间，所以刚注册的域名可能仍返回不存在。很多客户端还会把结果再缓存一层，实际生效时间往往比配置的更长，排查时要逐层看剩余 TTL，而不是只看权威配置。",
          "本机还有 hosts 文件与系统缓存，它们的优先级通常高于 DNS 查询。排查时先确认 hosts 没有被改动，再看系统缓存是否命中，最后才怀疑解析器或权威服务器，否则很容易在错误的一层反复试。在容器环境里还要注意基础镜像可能自带 hosts 条目，覆盖了真实解析结果。",
        ],
        example: {
          title: "用 dig 逐级看清解析链路",
          language: "bash",
          code: "# 从根开始逐级追问，看清解析链路\ndig +trace www.example.com\n\n# 指定公共解析器，验证递归结果与剩余 TTL\ndig @1.1.1.1 www.example.com A +noall +answer\n\n# 直接问权威服务器，绕开中间缓存\ndig @ns1.example.com www.example.com A +norecurse\n\n# 只看 CNAME 链\ndig www.example.com CNAME +short",
          explanation:
            "dig +trace 会自己扮演递归解析器，从根服务器开始逐个追问，因此能看清每一步返回的引荐与最终答案。指定 @1.1.1.1 则是观察公共解析器缓存里的值，answer 段的最后一个数字就是剩余 TTL。直接问权威服务器可以绕开中间缓存，用来确认权威侧到底配了什么。三者对照，就能判断问题出在缓存还是配置。",
        },
        practiceSteps: [
          "用 dig +trace 记录一次完整解析经过的服务器与跳数。",
          "连续两次查询同一域名，对比 TTL 递减，确认缓存命中。",
          "把权威记录的 TTL 调短，观察各级缓存多久后返回新值。",
        ],
        masteryChecklist: [
          "能区分递归查询与迭代查询的发起方。",
          "能按层次顺序排查解析异常，而不是一上来就重启服务。",
          "能解释负缓存为什么会延迟新域名的生效。",
        ],
        summary: [
          "客户端发递归查询，解析器做迭代查询。",
          "根、顶级、权威三级逐层引荐，直到拿到最终记录。",
          "TTL 决定旧值还能活多久，改解析要预留生效时间。",
          "负缓存会让不存在的域名持续报错一段时间。",
        ],
        terms: [
          {
            term: "递归查询（Recursive Query）",
            plain: "你只要最终答案，中间怎么问由对方负责。",
            detail:
              "客户端一般只发这种查询。解析器如果缓存里没有，就要替客户端跑完整个迭代过程，最后返回答案或明确错误，不能只说你去问别人。",
          },
          {
            term: "迭代查询（Iterative Query）",
            plain: "对方只告诉你下一步问谁，路要自己走。",
            detail:
              "根与顶级域服务器通常只做引荐，返回下一层服务器的地址。递归解析器顺着这些引荐一路走下去，直到权威服务器给出最终记录。",
          },
          {
            term: "TTL（Time To Live）",
            plain: "这条记录还能被缓存多少秒。",
            detail:
              "TTL 由权威侧设置，缓存方只能下调不能上调。它同时影响生效速度与权威服务器压力：调得太短，查询量上升；调得太长，改解析后旧值会顽固地留在缓存里。",
          },
          {
            term: "权威服务器（Authoritative Server）",
            plain: "这个域名真正的主人，记录以它为准。",
            detail:
              "权威服务器上的配置才是事实来源，解析器缓存只是副本。排查时直接向权威查询，可以确认到底是配置错了，还是缓存还没过期。",
          },
          {
            term: "负缓存（Negative Caching）",
            plain: "查不到的结果也会被记住一阵子。",
            detail:
              "域名不存在或类型不存在时，解析器会按 SOA 记录里的最小 TTL 缓存这个否定结果。刚注册的域名、刚加的记录，都可能在这段时间里继续报不存在。",
          },
        ],
      },
    },
    questions: [
      {
        key: "computer-networking-exp-net-dns-resolution-chain-s1",
        stageKey: "net-layer-model-stage",
        topicKey: "net-dns-resolution-chain",
        type: "single",
        stem: "客户端向本地递归解析器查询域名时，通常发起的是哪种查询？",
        options: [
          { key: "A", text: "迭代查询，解析器只返回下一步该问的服务器" },
          { key: "B", text: "递归查询，解析器负责把最终答案或错误返回给客户端" },
          { key: "C", text: "广播查询，链路上所有服务器都会应答" },
          { key: "D", text: "反向查询，用 IP 反查域名" },
        ],
        answer: ["B"],
        explanation:
          "客户端与递归解析器之间是递归查询：客户端只发一次请求，解析器要么给出最终答案，要么返回明确错误。解析器与根、顶级、权威服务器之间才是迭代查询，对方只返回下一层服务器地址，由解析器继续追问。反向查询是用 IP 查域名，属于另一类查询，与这里的解析链路不是一回事。",
        difficulty: "easy",
        tags: ["DNS", "递归查询", "解析链路"],
        sourceKey: "system-design-primer",
        level: "入门",
      },
      {
        key: "computer-networking-exp-net-dns-resolution-chain-j1",
        stageKey: "net-layer-model-stage",
        topicKey: "net-dns-resolution-chain",
        type: "judge",
        stem: "在权威服务器上把 A 记录的 TTL 设为 3600 并修改指向后，所有用户会立即解析到新地址。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "权威侧改完记录只是改了事实来源，各级缓存里仍保存着旧值，并会继续服务到原 TTL 过期。TTL 设为 3600 意味着最坏情况下要等一小时。正确做法是切流量前先把 TTL 调短，等旧缓存自然过期后再改指向，并预留回滚窗口。此外部分客户端还有自己的 hosts 与系统缓存，也会延长生效时间。",
        difficulty: "medium",
        tags: ["DNS", "TTL", "缓存"],
        sourceKey: "system-design-primer",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "computer-networking",
    stageKey: "net-layer-model-stage",
    topic: {
      key: "net-tls-handshake-chain",
      title: "TLS 握手与证书链",
      summary:
        "握手用非对称运算完成身份认证与密钥协商，之后的数据交给对称密钥；证书链把服务器公钥逐级签到受信任根，缺一环或过期都会让验证失败。",
      concepts: ["ClientHello 与 ServerHello", "ECDHE 与前向保密", "证书链与根信任", "SNI 与 ALPN"],
      principles: [
        "握手阶段用非对称运算认证身份并协商密钥，之后的数据用对称密钥加密，兼顾安全与性能。",
        "证书链从服务器证书经中间 CA 追到受信任根，验证要检查签名、有效期、域名与用途。",
        "只有 ECDHE 这类临时密钥交换才具备前向保密，长期私钥泄露也解不开历史会话。",
      ],
      applications: [
        "排查证书过期与链不完整导致的客户端握手失败。",
        "网关按 SNI 选择多域名证书，按 ALPN 协商 HTTP/2 或 HTTP/3。",
      ],
      pitfalls: [
        "只部署服务器证书而漏掉中间证书，浏览器能开但部分客户端失败。",
        "把关闭证书校验当成修复方案，掩盖真实问题。",
        "认为只要用了 TLS 就必然具备前向保密。",
      ],
      method:
        "先用 openssl s_client 看完整链与协商结果，再用 openssl verify 逐环校验，最后确认客户端信任库是否包含对应根证书。",
      exercise:
        "对一台站点抓一次完整握手，标出 ClientHello、ServerHello、Certificate、Finished 四个关键报文，并解释每个报文的作用。",
      checkpoint:
        "能说明证书链为什么会缺中间证书，以及缺了之后哪些客户端会失败、报什么错。",
      lesson: {
        overview: [
          "TLS 要同时解决三件事：确认对面是谁、协商出一把只有双方知道的密钥、保证后续数据不被篡改。握手就是这三件事的谈判过程。客户端先报出自己支持的版本、加密套件与随机数，服务器选一套并出示证书，双方再用密钥交换算法算出同一份共享秘密，最后各自发送 Finished 校验握手内容没有被改过。",
          "证书之所以能证明身份，靠的是一条从服务器证书到受信任根的签名链。服务器证书由中间 CA 签发，中间 CA 由根 CA 签发，根证书预装在操作系统或浏览器里。验证方逐级校验签名与有效期，任何一环缺失、过期或域名不匹配，整条链就不成立。实践中最多的事故不是算法被攻破，而是中间证书忘了部署或者证书到期没人续。",
        ],
        mechanism: [
          "TLS 1.3 把完整握手压缩到一次往返：ClientHello 带上密钥共享，服务器直接回 ServerHello、证书与 Finished，客户端验证后即可发送加密的应用数据。TLS 1.2 需要两次往返，且部分套件不具备前向保密。会话恢复机制则让重连省掉证书验证与密钥协商的大部分开销，常见于长连接场景。",
          "密钥交换常用 ECDHE：双方各自生成临时密钥对，交换公钥后算出共享秘密，临时私钥用完即弃。这样即使服务器长期私钥泄露，攻击者也无法回溯解密过去的会话，这就是前向保密。握手签名只证明服务器持有对应私钥，不参与会话密钥的推导，两者职责必须分清。",
          "证书链验证包括签名验证、有效期检查、域名匹配与扩展用途检查。链不完整时，部分客户端会主动下载中间证书补齐，部分则直接失败，所以现象常常是浏览器正常而命令行工具报错。自签根还需要显式导入信任库，否则同样会报未知颁发者。",
          "SNI 让客户端在握手时明文告知目标域名，服务器据此选择证书；ALPN 在同一次握手里协商应用层协议。两者都在明文里，因此可被中间设备观察，这也是加密客户端问候要解决的问题。反向代理需要透传 SNI，否则后端只能拿到默认站点的证书。",
        ],
        example: {
          title: "用 openssl 读握手与证书链",
          language: "bash",
          code: "# 看完整证书链与协商结果\nopenssl s_client -connect www.example.com:443 -servername www.example.com -showcerts\n\n# 提取对端证书的签发者与有效期\nopenssl s_client -connect www.example.com:443 2>/dev/null | openssl x509 -noout -subject -issuer -dates\n\n# 用系统信任库校验整条链\nopenssl verify -CAfile /etc/ssl/certs/ca-certificates.crt chain.pem",
          explanation:
            "第一条命令打印服务器发来的整条链，注意 Certificate chain 里通常有一张服务器证书加一到两张中间证书，根证书一般不在里面。第二条只看叶子证书的签发者与有效期，适合快速判断是否过期。第三条把导出的链交给信任库校验，缺中间证书时会明确报 unable to get local issuer certificate，这正是漏部署中间证书的典型报错。",
        },
        practiceSteps: [
          "用 openssl s_client 抓一次握手，确认协商出的协议版本与加密套件。",
          "把证书链导出后用 openssl verify 校验，定位缺失的那一环。",
          "用 curl -v 对照浏览器行为，确认客户端信任库差异。",
        ],
        masteryChecklist: [
          "能说清握手阶段非对称运算与数据传输阶段对称加密的分工。",
          "能解释中间证书缺失为什么会让部分客户端失败。",
          "能说明 ECDHE 与前向保密的关系。",
        ],
        summary: [
          "握手负责认证与协商密钥，之后用对称密钥传数据。",
          "证书链要逐级验签，直到受信任根。",
          "ECDHE 提供前向保密。",
          "SNI 选证书，ALPN 选应用协议。",
          "缺中间证书是线上最常见的证书事故。",
        ],
        terms: [
          {
            term: "握手（Handshake）",
            plain: "双方先对暗号、换密钥，之后才正式说话。",
            detail:
              "握手阶段要协商版本与套件、验证证书、生成会话密钥，并确认双方算出的密钥一致。握手完成后才进入加密的应用数据传输。",
          },
          {
            term: "证书链（Certificate Chain）",
            plain: "从服务器证书一路签到根证书的信任接力。",
            detail:
              "链上每一环用自己的私钥签下一环的公钥。验证方从服务器证书往上追，直到某个预置在信任库里的根。缺中间证书时，这条链就断了。",
          },
          {
            term: "前向保密（Forward Secrecy）",
            plain: "长期私钥哪天泄露，也解不开以前录下的会话。",
            detail:
              "靠的是每次握手临时生成的密钥对。会话密钥不落盘、不参与长期密钥派生，所以事后拿到服务器私钥也无法还原。RSA 密钥交换不具备这个性质。",
          },
          {
            term: "SNI",
            plain: "握手时先报要访问哪个域名，好让对方选对证书。",
            detail:
              "一台服务器可能承载多个域名，SNI 让它在握手阶段就知道该出示哪张证书。不支持的旧客户端只能拿到默认证书，常见表现是证书域名不匹配。",
          },
          {
            term: "ALPN",
            plain: "握手时顺便商量后面用 HTTP/2 还是 HTTP/1.1。",
            detail:
              "它在 TLS 握手中协商应用层协议，省掉额外一次探测往返。HTTP/2 与 HTTP/3 都依赖 ALPN 与明文 HTTP 升级做区分。",
          },
        ],
      },
    },
    questions: [
      {
        key: "computer-networking-exp-net-tls-handshake-chain-s1",
        stageKey: "net-layer-model-stage",
        topicKey: "net-tls-handshake-chain",
        type: "single",
        stem: "关于 TLS 握手与证书链，下面哪一项说法正确？",
        options: [
          { key: "A", text: "握手全程都用非对称加密传输应用数据" },
          { key: "B", text: "服务器只需部署自己的证书，中间证书由所有客户端自动补齐，因此可以省略" },
          { key: "C", text: "证书链要逐级验证签名直到受信任根，缺少中间证书可能导致部分客户端握手失败" },
          { key: "D", text: "只要启用了 TLS，就必然具备前向保密" },
        ],
        answer: ["C"],
        explanation:
          "证书链从服务器证书逐级验签到受信任根，缺中间证书时链就断了。部分客户端会去下载补齐，部分直接报 unable to get local issuer certificate，于是出现浏览器正常而命令行工具失败的现象。握手阶段用非对称运算认证与协商，应用数据交给对称密钥；前向保密取决于是否使用 ECDHE 这类临时密钥交换，而不是启用 TLS 本身。",
        difficulty: "medium",
        tags: ["TLS", "证书链", "握手"],
        sourceKey: "wireshark",
        level: "进阶",
      },
      {
        key: "computer-networking-exp-net-tls-handshake-chain-j1",
        stageKey: "net-layer-model-stage",
        topicKey: "net-tls-handshake-chain",
        type: "judge",
        stem: "使用 ECDHE 密钥交换时，即使服务器长期私钥日后泄露，攻击者也无法解密此前录制的会话。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "ECDHE 的密钥对是每次握手临时生成的，共享秘密由双方的临时私钥算出，用完即弃。长期私钥只用于签名证明身份，不参与会话密钥推导，所以事后拿到长期私钥也无法还原历史会话密钥。这正是前向保密的含义，也是 TLS 1.3 只保留具备前向保密套件的原因之一；RSA 密钥交换则不具备这个性质。",
        difficulty: "medium",
        tags: ["TLS", "前向保密", "ECDHE"],
        sourceKey: "wireshark",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "computer-networking",
    stageKey: "net-routing-stage",
    topic: {
      key: "net-nat-traversal",
      title: "NAT 类型与内网穿透",
      summary:
        "NAT 靠映射与过滤两张表工作；锥型 NAT 复用外部端口、对称型 NAT 每换目标就换端口。能不能打洞取决于两端类型组合，打不通就回落到中继。",
      concepts: ["映射与过滤规则", "锥型与对称型 NAT", "STUN 与 TURN", "ICE 与打洞"],
      principles: [
        "NAT 设备同时维护映射与过滤两套规则：映射决定外部看到的地址端口，过滤决定谁能把包送进来。",
        "锥型 NAT 对同一内网端点复用同一外部端口，对称型 NAT 每换一个目标就换一个外部端口。",
        "打洞依赖双方同时向对方的外部地址发包，让各自的过滤规则放行；失败时由 TURN 中继转发。",
      ],
      applications: [
        "视频会议与 P2P 下载优先尝试直连与打洞，失败再回落到中继。",
        "自建服务用端口映射或反向隧道暴露到公网，并确认上游没有运营商级 NAT。",
      ],
      pitfalls: [
        "以为做了端口映射就等于公网可达，忽略运营商级 NAT 仍在中间。",
        "把 STUN 当成能转发数据的方案，它只负责发现外部地址。",
        "只测 TCP 打洞，忽略多数媒体流实际走 UDP。",
      ],
      method:
        "先用 STUN 探测两端映射行为判断 NAT 类型，再按组合决定直连、打洞还是中继，最后用抓包确认包是否真的双向通过。",
      exercise:
        "在同一网络下用两个 STUN 服务器探测本机映射端口，判断属于锥型还是对称型，并解释判断依据。",
      checkpoint:
        "能说明对称型 NAT 为什么让打洞失败，以及 TURN 在其中扮演什么角色。",
      lesson: {
        overview: [
          "内网主机没有公网地址，出门时由 NAT 把源地址端口换成公网的一对，回包再换回去。问题在于外部无法主动发起连接，因为 NAT 不知道这个包该交给谁。端口映射是人工写死一条规则，打洞则是让两端先各自向外发一个包，把自己的映射告诉对方，再同时向对方的映射发包，借 NAT 的过滤规则放行。",
          "能不能打通，取决于两端 NAT 的类型组合。锥型 NAT 对同一个内网端点固定使用一个外部端口，只要目标对过一次就允许回包；对称型 NAT 每换一个目标就换一个外部端口，你从 STUN 学到的端口对另一个目标并不适用，打洞因此失败。工程上不会假设一定能直连，而是按 ICE 框架先试直连，再试打洞，最后回落到中继。",
        ],
        mechanism: [
          "NAT 维护两张表：映射表记录内网地址端口到外部地址端口的对应，过滤表记录允许哪些外部地址端口把包送进来。查表时先看过滤是否放行，再做地址转换。不同厂商的默认策略差异，正是 NAT 类型划分的来源。",
          "全锥型对任何外部地址都放行；受限锥型只放行本机曾主动访问过的外部地址；端口受限锥型还要求端口也一致；对称型则为每个目标分配不同的外部端口，映射本身就随目标变化。实际设备常常混合多种行为，所以探测要换不同目标多测几次才可靠。",
          "STUN 让客户端向公网服务器发一个请求，服务器把观察到的源地址端口回给客户端，客户端由此得知自己的外部映射。TURN 则是服务器替你转发流量，带宽成本高但一定能通。ICE 把候选地址收集、连通性检查与优先级排序串起来。",
        ],
        example: {
          title: "从映射表判断 NAT 类型",
          language: "text",
          code: "# NAT 设备上的映射表（conntrack 视角）\nudp 192.168.1.20:54321 -> 203.0.113.7:62000  dst=198.51.100.9:3478\nudp 192.168.1.20:54321 -> 203.0.113.7:62000  dst=198.51.100.10:3478\ntcp 192.168.1.20:50000 -> 203.0.113.7:62001  dst=203.0.113.50:443\n\n# 两个不同目标复用同一外部端口 -> 锥型 NAT 的特征\n# 若第二行变成 203.0.113.7:62007\n# 说明每换目标就换端口 -> 对称型 NAT，打洞基本没戏\n\n# 客户端侧看到的 STUN 结果\nmapped-address: 203.0.113.7:62000",
          explanation:
            "这张表把 NAT 的决策摊开：同一个内网 UDP 端点访问两个不同的 STUN 服务器，如果外部端口都是 62000，说明映射与目标无关，属于锥型；如果第二个目标拿到了新端口，说明映射随目标变化，属于对称型。判断清楚类型，才能预判打洞成功率。TCP 那一行则说明不同协议各自维护映射，不能拿 TCP 的结果去推 UDP。",
        },
        practiceSteps: [
          "用两个不同 STUN 服务器探测本机 UDP 映射端口，比较是否一致。",
          "在两端同时抓包，确认打洞时的出站包与入站包是否都被放行。",
          "构造对称型 NAT 场景，验证 ICE 是否按预期回落到 TURN。",
        ],
        masteryChecklist: [
          "能区分映射规则与过滤规则各自决定什么。",
          "能根据 STUN 探测结果判断 NAT 类型。",
          "能说明 TURN 为什么是兜底而不是首选。",
        ],
        summary: [
          "NAT 靠映射与过滤两张表工作。",
          "锥型复用外部端口，对称型按目标换端口。",
          "打洞是双方同时发包，让过滤规则放行。",
          "STUN 只发现地址，TURN 才负责转发。",
          "ICE 按直连、打洞、中继的顺序尝试。",
        ],
        terms: [
          {
            term: "端口映射（Port Mapping）",
            plain: "在 NAT 上写死一条规则，外面访问固定端口就转到内网。",
            detail:
              "它把外部端口与内网地址端口固定绑定，适合自建服务。但如果上游还有运营商级 NAT，你在自家路由器上做的映射外面依然看不到。",
          },
          {
            term: "打洞（Hole Punching）",
            plain: "两端同时向对方的外部地址发包，让 NAT 放行。",
            detail:
              "关键在同时：只发一侧，另一侧的过滤规则不会为这个陌生来源开口。双方还要知道对方的外部映射，所以通常先经过信令服务器交换地址。",
          },
          {
            term: "STUN",
            plain: "问公网服务器：你看到的我是哪个地址端口。",
            detail:
              "它只做地址发现，不转发业务数据。返回的映射地址是否稳定，是判断 NAT 类型的主要依据，但拿到地址不代表对方就能把包送进来。",
          },
          {
            term: "TURN",
            plain: "打不通时由服务器替你转发流量。",
            detail:
              "服务器分配一个中继地址，双方都往那里发，由它复制转发。一定能通，代价是带宽与额外一跳延迟，所以只在直连与打洞都失败时使用。",
          },
          {
            term: "对称型 NAT（Symmetric NAT）",
            plain: "每换一个目标就换一个外部端口，最难打洞。",
            detail:
              "因为从 STUN 学到的端口只对那个 STUN 服务器有效，对端拿这个端口发包会被 NAT 拒绝。两端都是对称型时，基本只能走中继。",
          },
        ],
      },
    },
    questions: [
      {
        key: "computer-networking-exp-net-nat-traversal-s1",
        stageKey: "net-routing-stage",
        topicKey: "net-nat-traversal",
        type: "single",
        stem: "两台主机各自位于 NAT 之后，UDP 打洞能否成功主要取决于什么？",
        options: [
          { key: "A", text: "两端操作系统的版本是否一致" },
          { key: "B", text: "两端 NAT 的类型组合，对称型 NAT 往往导致打洞失败" },
          { key: "C", text: "两端内网 IP 是否处于同一网段" },
          { key: "D", text: "是否改用 TCP 而不是 UDP" },
        ],
        answer: ["B"],
        explanation:
          "打洞能否成功，取决于两端 NAT 的映射与过滤行为。锥型 NAT 对同一内网端点复用外部端口，双方同时向已知映射发包就能放行；对称型 NAT 每换目标就换端口，从 STUN 得到的端口对另一个目标无效，打洞因此失败。操作系统版本与内网网段不决定外部映射行为，换成 TCP 也不能绕过对称型 NAT 的限制，通常仍需中继兜底。",
        difficulty: "medium",
        tags: ["NAT", "打洞", "STUN"],
        sourceKey: "linux-kernel",
        level: "进阶",
      },
      {
        key: "computer-networking-exp-net-nat-traversal-j1",
        stageKey: "net-routing-stage",
        topicKey: "net-nat-traversal",
        type: "judge",
        stem: "STUN 服务器可以在打洞失败时替客户端转发媒体数据。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "STUN 的职责只有一件事：告诉客户端它在公网侧被观察到的地址与端口，自身不转发业务数据。真正承担转发兜底的是 TURN，它分配中继地址并复制流量，代价是带宽与延迟。ICE 会在直连与打洞都失败后选择 TURN 候选，因此把两者混为一谈会导致排障方向错误。",
        difficulty: "easy",
        tags: ["NAT", "STUN", "TURN"],
        sourceKey: "linux-kernel",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "computer-networking",
    stageKey: "net-link-tools-stage",
    topic: {
      key: "net-packet-loss-triage",
      title: "丢包排障：抓包与内核计数器对照",
      summary:
        "丢包可能发生在驱动、协议栈、链路或对端；抓包只是某一观察点的副本，必须和接口丢弃计数、内核重传增量一起对齐，才能把丢失位置夹出来。",
      concepts: ["抓包点与可见性", "接口与环形缓冲丢弃", "内核重传统计", "双端时间对齐"],
      principles: [
        "抓包看到的是某一观察点的副本，没抓到不等于没到达，抓到了也不等于对端收到。",
        "网卡或环形缓冲溢出造成的丢弃发生在抓包之前，必须看接口丢弃计数而不是只数报文。",
        "双端抓包要按同一时间基准对齐，才能判断包是在路径上丢失还是在某一端被丢弃。",
      ],
      applications: [
        "定位间歇性超时是链路丢包、本机丢弃还是对端不处理。",
        "扩容后检查网卡是否因中断不足或缓冲太小而丢包。",
      ],
      pitfalls: [
        "只在一端抓包就断言对端没收到。",
        "过滤表达式写得太窄，把重传与 ICMP 关键报文滤掉。",
        "抓包文件写满磁盘导致进程被杀，证据反而丢失。",
      ],
      method:
        "先看接口与内核计数器确认有没有本地丢弃，再在两端同时抓包并按时间对齐，最后用重传与 ICMP 报文补齐因果链。",
      exercise:
        "对一次间歇性超时的请求，在客户端与服务端同时抓包，配合接口丢弃计数与重传统计，判断丢包发生在哪一段并写出证据。",
      checkpoint:
        "能说明为什么没抓到包不能证明包没有到达，以及本地丢弃要去哪里看。",
      lesson: {
        overview: [
          "遇到丢包，最容易犯的错是只在一端抓包，看到没有某条报文就断定对端没收到。抓包工具拿到的是内核在某个观察点交给它的副本，网卡缓冲区溢出、过滤规则写错、抓包进程被调度延迟，都会让报文在文件里消失。因此抓包只是证据之一，必须和接口丢弃计数、内核重传统计一起看，才能把丢失的位置夹出来。",
          "定位丢包的思路是分段夹逼：先确认本机有没有在收包前就丢了，再看链路中间有没有异常，最后看对端有没有收到却不处理。每一段都需要不同的证据：网卡计数看丢弃，内核统计看重传与超时，双端抓包看同一报文是否同时出现。把这些证据按时间排好，结论才站得住，而不是靠猜。",
        ],
        mechanism: [
          "抓包点在协议栈里是有位置的。tcpdump 走 AF_PACKET，看到的是网卡驱动交付给内核的报文；如果环形缓冲满，驱动会直接丢弃，tcpdump 根本看不到。因此接口的 dropped 计数增长，往往说明抓包本身就在丢包。内核里还有一道 socket 接收队列，应用读得太慢同样会在那里丢。",
          "内核维护大量按协议的统计：重传次数、超时次数、重复 ACK、连接重置。用 nstat 或 netstat -s 看增量比看总量更有意义，因为总量只增不减，无法对应到某次故障。这些计数器按协议分门别类，名称晦涩但含义明确；建议在故障前先记一份基线，复现后再取差值，才能把增长归因到具体连接与时间段。",
          "双端抓包要对齐时间。两台机器的时钟可能有几十毫秒偏差，直接用绝对时间比较会得出错误结论。可行做法是先用 NTP 校时，或在同一链路上抓一次双向握手估算偏移，再比较同一序列号的报文在两端的时间差。",
        ],
        example: {
          title: "四步把丢包夹到具体一段",
          language: "bash",
          code: "# 1. 先看接口有没有在收包阶段就丢弃\nip -s link show eth0\n\n# 2. 看内核协议栈的重传与超时增量\nnstat -az TcpRetransSegs TcpExtTCPTimeouts TcpExtTCPLostRetransmit\nsleep 10\nnstat -az TcpRetransSegs TcpExtTCPTimeouts TcpExtTCPLostRetransmit\n\n# 3. 带环形缓冲抓包，避免写盘卡顿导致丢包\ntcpdump -i eth0 -s 0 -w /tmp/cap.pcap -C 100 -W 20 'tcp port 443'\n\n# 4. 抓完统计重传占比\ntshark -r /tmp/cap.pcap -q -z io,stat,0,'tcp.analysis.retransmission'",
          explanation:
            "四步对应四类证据：接口计数回答本机有没有在驱动层丢包，nstat 的增量回答协议栈有没有反复重传，带 -C 与 -W 的 tcpdump 用环形文件避免磁盘写满或写慢导致丢包，最后的 tshark 统计把重传量化成比例。只有前三步都排除本地因素，双端抓包的差异才能归因到链路。",
        },
        practiceSteps: [
          "复现故障前先记录接口与内核计数器的基线值。",
          "用环形缓冲抓包，同时在两端启动，确保时间窗口重叠。",
          "抓完后统计重传比例，并与计数器增量交叉验证。",
        ],
        masteryChecklist: [
          "能说出抓包在协议栈中的位置以及它看不到什么。",
          "能用计数器增量而不是总量判断故障窗口。",
          "能解释双端抓包为什么必须先对齐时间。",
        ],
        summary: [
          "没抓到不等于没到达，抓到了也不等于对端收到。",
          "接口丢弃计数反映驱动层丢弃，发生在抓包之前。",
          "计数器要看增量，总量无法对应故障时刻。",
          "双端对齐时间，才能把丢失夹到具体一段。",
        ],
        terms: [
          {
            term: "环形缓冲（Ring Buffer）",
            plain: "网卡收包用的环形缓冲区，满了就直接丢。",
            detail:
              "驱动把收到的报文放进这块内存，内核再取走处理。取走的速度跟不上到达速度就会溢出，此时报文在抓包工具看到之前就已经没了，只能从接口丢弃计数发现。",
          },
          {
            term: "抓包点",
            plain: "在协议栈哪一层复制报文，决定你能看到什么。",
            detail:
              "在网卡、内核协议栈入口或应用层抓，看到的范围不同。越靠下越能看到原始报文，越靠上越接近应用真实收到的数据，但都可能漏掉被提前丢弃的包。",
          },
          {
            term: "重传率",
            plain: "重传的报文占总发送量的比例，越高越可疑。",
            detail:
              "少量重传在公网上很正常，比例突然升高才值得追。要结合链路类型看：无线链路的正常重传率明显高于有线链路。",
          },
          {
            term: "双端抓包",
            plain: "两端同时抓，靠时间对齐判断包丢在哪段。",
            detail:
              "同一序列号的报文如果在发送端出现、接收端没有，才说明它丢在路径上；两端都有则问题在应用处理。前提是时钟对齐，否则时间差会把结论带偏。",
          },
          {
            term: "增量统计",
            plain: "只看这段时间新增了多少，而不是开机以来总数。",
            detail:
              "总量只能说明历史上发生过什么，无法对应本次故障。抓故障前记一次基线，复现后再取一次，两者相减才是这次故障的证据。",
          },
        ],
      },
    },
    questions: [
      {
        key: "computer-networking-exp-net-packet-loss-triage-s1",
        stageKey: "net-link-tools-stage",
        topicKey: "net-packet-loss-triage",
        type: "single",
        stem: "关于抓包与丢包定位，下面哪一项说法正确？",
        options: [
          { key: "A", text: "只要在一端抓包没有看到某个报文，就能证明该报文没有到达对端" },
          { key: "B", text: "接口的 dropped 计数增长，说明报文可能在抓包工具看到之前就被丢弃了" },
          { key: "C", text: "内核重传统计的总量越大，说明当前这次故障越严重" },
          { key: "D", text: "两端抓包可以直接按系统时间比较，不需要校时" },
        ],
        answer: ["B"],
        explanation:
          "抓包拿到的只是内核在某个观察点交付的副本。环形缓冲溢出时驱动会直接丢包，抓包文件里根本没有这条报文，所以没抓到不能证明没到达；接口的 dropped 计数增长正是这种本地丢弃的信号。内核统计要看故障窗口内的增量而不是总量，两端抓包也必须先校时或用同一基准对齐，否则时间差会把结论带偏。",
        difficulty: "medium",
        tags: ["抓包", "丢包", "排障"],
        sourceKey: "wireshark",
        level: "进阶",
      },
      {
        key: "computer-networking-exp-net-packet-loss-triage-j1",
        stageKey: "net-link-tools-stage",
        topicKey: "net-packet-loss-triage",
        type: "judge",
        stem: "把 tcpdump 的过滤表达式写得越精确，越不容易漏掉与故障相关的报文。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "过滤表达式越窄，写入文件的报文越少，但排障常需要看上下文：握手、重传、ICMP 不可达、连接重置往往不在最初的过滤条件里。正确做法是先粗后细，用较宽的表达式抓到完整会话，再在分析阶段用显示过滤器缩小范围。抓包文件可以事后过滤，漏抓的报文却无法补回，因此过窄的过滤反而更容易漏证据。",
        difficulty: "easy",
        tags: ["抓包", "过滤表达式", "排障"],
        sourceKey: "wireshark",
        level: "入门",
      },
    ],
  },
];
