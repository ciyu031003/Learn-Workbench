/**
 * 计算机网络 · 知识点扩容 C 批（追加式，2026-10-31）。
 *
 * 只新增 9 个知识点，不改动 computer-networking.ts 与 A/B 批文件。主题：性能指标
 * 与时延计算、ICMP 与 traceroute、电子邮件协议族、FTP 双连接、IP 多播与 IGMP、
 * 路由器组成、虚电路与数据报、冲突域广播域与设备层次、QoS 漏桶与令牌桶。
 * 口径：与 OS/组成扩容批一致——讲透、讲准、给细节；术语配白话解释；每章收口成可复述的小结。
 * 防撞题：基础 12 点（分层/封装分片/应用协议承载/握手/确认重传/UDP 端口/子网/转发与
 * 协议分工/ARP NAT/以太网交换 VLAN/无线仲裁/抓包排障）+ A 批（拥塞恢复/HTTP2）+
 * B 批（奈氏香龙/CRC 汉明/TCP 流控 RTO/路由三派/DNS/DHCP/IPv6/CSMA-CD）共 23 点全部避开。
 */
import type { TopicExpansion } from "./topic-expansions";

export const computerNetworkingTopicExpansionsC: TopicExpansion[] = [
  {
    trackSlug: "computer-networking",
    stageKey: "net-layer-model-stage",
    topic: {
      key: "net-performance-metrics",
      title: "性能指标：时延、时延带宽积与吞吐",
      summary:
        "一次传输的总时延是四段之和：发送时延（数据推出网卡）、传播时延（信号走完链路）、处理时延与排队时延。高速链路缩短的是发送时延，光纤换距离缩短的是传播时延——两者互不相干，混算就是错的。",
      concepts: ["发送时延", "传播时延", "处理与排队时延", "时延带宽积", "往返时间 RTT"],
      principles: [
        "发送时延 = 数据长度 ÷ 发送速率（带宽），与链路长度无关；传播时延 = 链路长度 ÷ 信号速率（铜缆约 2.3×10⁸ m/s，光纤约 2×10⁸ m/s），与数据大小无关。",
        "存储转发的分组交换中，每经过一个路由器都要重新经历一次发送时延——n 跳链路的发送时延是单跳的 n 倍，传播时延只算一次每段。",
        "时延带宽积 = 传播时延 × 带宽，表示「链路上正在飞行的最大数据量」：它是滑动窗口必须达到的最小尺寸，也是长肥网络（LFN）难优化的根源。",
        "吞吐量受制于瓶颈链路：一条路径的等效带宽是各段带宽的最小值，时延却要逐段累加——两者是不同的度量。",
      ],
      applications: [
        "跨洋 RTT 150ms+ 的链路上，TCP 窗口必须大于时延带宽积才能吃满带宽——调优的第一公式。",
        "下载小文件的体感时间由 RTT 主导（握手占大头），下载大文件由带宽主导——CDN 优化的是前者。",
        "实时音视频对时延与抖动敏感、对带宽只要够用；文件传输相反——QoS 策略由此分流。",
      ],
      pitfalls: [
        "把发送时延与传播时延相乘或互换：一个是「长度÷速率」，一个是「距离÷速度」，量纲与变量都不同。",
        "以为带宽翻倍一定减半总时延——只有发送时延占主导时才成立；长距离小文件的时延几乎全是传播与排队。",
        "忽略存储转发的重发送：报文交换与分组交换的总时延公式不同，n 跳不是简单乘 n。",
      ],
      method:
        "时延计算题固定四步：拆分四段时延 → 各段按公式独立计算 → 存储转发按跳数累加发送时延 → 时延带宽积单独算（传播 × 带宽）。",
      exercise:
        "1MB 数据经 1Gbps 链路发送到 1000km 外（光纤 5μs/km）：(a) 发送时延与传播时延各多少？(b) 若分成 1024 个 1KB 分组、经过 2 跳存储转发，总时延变为多少？(c) 该链路的时延带宽积是多少字节？",
      checkpoint: "能独立计算四段时延并区分其对变量的敏感性，能算存储转发的分组总时延与时延带宽积。",
      lesson: {
        overview: [
          "网络性能的第一课是把「慢」拆成四种成分。发送时延是把数据比特逐个推上链路的时间——由数据量与带宽决定；传播时延是电/光信号在介质里走完物理距离的时间——由距离与介质决定。前者与距离无关，后者与数据量无关，两者相加才是这条链路的基本时延，再叠加路由器的处理与排队，就是端到端总时延。",
          "分组交换引入了一个容易漏算的项：每个路由器是存储转发的——整组收完才能转发下一跳，所以发送时延按跳数累加。把 1MB 一次性发完（报文交换）与切成 1024 个小分组发完，总时延差别巨大：分组化让流水线重叠，后面的分组在前一跳传输时，前面的分组已经在向下一跳前进了。",
          "时延带宽积是两个毫不相干的时延成分的乘积，物理意义是「第一个比特到达目的地时，链路上还飞着多少比特」。它是滑动窗口的尺寸下限：窗口小于它，发送方必须停下来等确认，带宽吃不满。长肥网络（带宽高、时延大）的时延带宽积动辄兆字节，这就是为什么跨洋传输不开窗口调优只能跑出零头速度。",
        ],
        mechanism: [
          "发送时延 d_send = L/R（L 为分组长度 bit，R 为链路速率 bit/s）。1MB 在 1Gbps 上是 8.39ms；在 100Mbps 上是 83.9ms——带宽提升 10 倍，发送时延缩短 10 倍，传播时延一动不动。",
          "传播时延 d_prop = 距离 ÷ 速率。光纤中光速约 2×10⁸ m/s，即 5μs/km；1000km 就是 5ms。这个数字不随带宽、不随数据量变化——跨洋链路的 60ms 传播时延是物理常数级的存在，任何协议都省不掉。",
          "存储转发累加：n 跳链路、每跳速率相同、分组大小 L，总发送时延 = n × (L/R)（每跳都要整组收完再发）；传播时延 = 各段之和。分组化的收益在于流水线：1024 个分组、2 跳的总时延 ≈ (1024 + 1) × 单分组发送时延 + 传播，而不是 2 × 1024 × ——分组在两跳间并行前进。",
          "时延带宽积（BDP）= d_prop × R。1000km 的 1Gbps 链路 BDP = 5ms × 1Gbps ÷ 8 ≈ 610KB——TCP 窗口小于 610KB 就喂不满这条链路。RTT 是 BDP 公式里更常用的口径：窗口 ≥ 带宽 × RTT。",
        ],
        example: {
          title: "四段时延与分组化收益的计算",
          language: "python",
          code: "def total_delay(msg_bytes, link_bps, hops, dist_km, pkt_bytes=None, prop_s_per_km=5e-6):\n    prop = dist_km * 1000 * prop_s_per_km * hops          # 传播：每段都要走\n    if pkt_bytes is None:                                  # 报文交换：整块逐跳\n        send = hops * (msg_bytes * 8 / link_bps)\n        return send + prop\n    n_pkts = -(-msg_bytes // pkt_bytes)                    # 向上取整分组数\n    pkt_send = pkt_bytes * 8 / link_bps\n    send = (n_pkts + hops - 1) * pkt_send                  # 流水线：n_pkts+hops-1 拍\n    return send + prop\n\nMB = 1024 * 1024\nprint(f\"报文交换: {total_delay(MB, 1e9, 2, 1000)*1000:.2f} ms\")\nprint(f\"1KB 分组: {total_delay(MB, 1e9, 2, 1000, 1024)*1000:.2f} ms\")\nbdp = 5e-3 * 1e9 / 8\nprint(f\"时延带宽积: {bdp/1024:.0f} KB\")\n# 报文交换 16.78ms vs 分组化 8.40ms —— 分组化让两跳的传输流水重叠",
          explanation:
            "同一份数据、同样的链路，报文交换要等整个 1MB 在第一跳发完（8.39ms）再在第二跳发一遍，发送时延翻倍；切成 1KB 分组后，两跳像流水线一样接力——总发送时延只多了一个分组的尾巴 (1024+1)/1024 倍。这就是分组交换优于报文交换的定量答案。时延带宽积 610KB 则告诉我们：想让这条链路跑满，TCP 窗口至少要开到 610KB。",
        },
        practiceSteps: [
          "手算题面三问，与代码输出对答案。",
          "把带宽从 1Gbps 提到 10Gbps，观察发送时延、传播时延、BDP 各自的变化。",
          "用 ping 测一条真实链路的 RTT，反推物理距离（RTT/2 × 光速），与实际距离对比。",
          "iperf 测一条长肥链路的吞吐，计算需要的 TCP 窗口（带宽 × RTT），解释默认窗口为何跑不满。",
        ],
        masteryChecklist: [
          "能独立计算发送/传播时延并说明各自依赖的变量。",
          "能算存储转发分组交换的总时延（n_pkts + hops − 1 拍）。",
          "能计算时延带宽积并说出它对滑动窗口的约束。",
        ],
        summary: [
          "发送时延 = 长度÷带宽，传播时延 = 距离÷速度，互不相干。",
          "存储转发的发送时延按跳数累加，分组化带来流水线收益。",
          "时延带宽积 = 传播 × 带宽 = 滑动窗口下限，长肥网络的命门。",
          "吞吐看瓶颈链路，时延逐段累加——两个度量不要混算。",
        ],
        terms: [
          {
            term: "发送时延",
            plain: "把比特推上链路的时间：数据量÷带宽。",
            detail: "也叫传输时延。它与距离无关——1 字节和 1GB 在同一条链路上的「每比特推出速度」相同。",
          },
          {
            term: "传播时延",
            plain: "信号在介质里飞完距离的时间：距离÷速度。",
            detail: "铜缆约 2.3×10⁸ m/s、光纤约 2×10⁸ m/s。北京到上海单程约 6ms——任何协议都省不掉的物理常数。",
          },
          {
            term: "时延带宽积",
            plain: "链路上同时「在飞」的最大比特数：传播时延 × 带宽。",
            detail: "也叫带宽时延积（BDP）。它是滑动窗口的下限，也是长肥网络所有调优问题的出发点。",
          },
          {
            term: "长肥网络（LFN）",
            plain: "带宽高、时延也高的链路：跨洋专线、卫星链路。",
            detail: "BDP 巨大导致传统 TCP 窗口吃不满带宽，需要窗口缩放、更大缓冲或专门协议。",
          },
        ],
      },
    },
    questions: [
      {
        key: "computer-networking-exp-net-performance-metrics-s1",
        stageKey: "net-layer-model-stage",
        topicKey: "net-performance-metrics",
        type: "single",
        stem: "1MB 数据在 1Gbps 链路上发送，链路长 1000km（光纤传播 5μs/km）。发送时延与传播时延分别约为多少？",
        options: [
          { key: "A", text: "发送时延约 8.39ms，传播时延约 5ms" },
          { key: "B", text: "发送时延约 5ms，传播时延约 8.39ms" },
          { key: "C", text: "两者都是约 8.39ms" },
          { key: "D", text: "发送时延约 1ms，传播时延约 12ms" },
        ],
        answer: ["A"],
        explanation:
          "发送时延 = 数据长度 ÷ 带宽 = (1M × 8) bit ÷ 1Gbps = 8.39ms——只看数据量与带宽，与距离无关；传播时延 = 1000km × 5μs/km = 5ms——只看距离与介质速度，与数据量无关。B 把两个公式互换（常见错误：以为「长链路所以发送慢」）；C 混算了两者。两段相加约 13.4ms 才是单跳基本时延，再加上路由器的处理与排队。",
        difficulty: "medium",
        tags: ["发送时延", "传播时延", "计算题"],
        sourceKey: "system-design-primer",
        level: "进阶",
      },
      {
        key: "computer-networking-exp-net-performance-metrics-s2",
        stageKey: "net-layer-model-stage",
        topicKey: "net-performance-metrics",
        type: "single",
        stem: "同一份 1MB 数据分成 1024 个 1KB 分组，经 2 跳存储转发（每跳 1Gbps，忽略传播与排队）。总发送时延约为多少？",
        options: [
          { key: "A", text: "约 16.8ms（2 跳各发一遍整个 1MB）" },
          { key: "B", text: "约 8.4ms（两跳流水重叠，总拍数 = 分组数 + 跳数 − 1）" },
          { key: "C", text: "约 4.2ms（带宽在两跳间叠加）" },
          { key: "D", text: "约 0.16ms（只算一个分组的发送时延）" },
        ],
        answer: ["B"],
        explanation:
          "存储转发流水线：第一跳连续发出 1024 个分组（每个 8.19μs），第一跳发第 k 个分组时，第二跳已在转发第 k−1 个——总时间 = (分组数 + 跳数 − 1) × 单分组发送时延 = 1025 × 8.19μs ≈ 8.40ms。对比报文交换（整块 1MB 在第一跳收完才能发第二跳）的 2 × 8.39ms = 16.8ms，分组化把流水线重叠的收益砍掉一半。C 的「带宽叠加」是错误概念——两跳串联的瓶颈是单跳速率；D 只算了第一个分组。",
        difficulty: "hard",
        tags: ["存储转发", "分组交换", "流水线"],
        sourceKey: "system-design-primer",
        level: "综合",
      },
      {
        key: "computer-networking-exp-net-performance-metrics-j1",
        stageKey: "net-layer-model-stage",
        topicKey: "net-performance-metrics",
        type: "judge",
        stem: "把 1000km 链路的带宽从 1Gbps 提升到 10Gbps，其时延带宽积也会相应扩大 10 倍。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "时延带宽积 = 传播时延 × 带宽。带宽提升 10 倍、传播时延不变（只由距离与介质决定），乘积确实扩大 10 倍——从约 610KB 变成 6.1MB。这意味着滑动窗口的「喂饱下限」也涨了 10 倍：默认窗口在新链路上只能跑出十分之一的带宽。这个乘积放大效应正是长肥网络难以优化的根源——提速反而加大了协议需要「填满管道」的难度。",
        difficulty: "easy",
        tags: ["时延带宽积", "长肥网络"],
        sourceKey: "wireshark",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "computer-networking",
    stageKey: "net-routing-stage",
    topic: {
      key: "net-icmp",
      title: "ICMP：网络层的诊断协议",
      summary:
        "IP 只管尽力而为，出了问题靠 ICMP 报信：目的不可达、超时、回送请求/应答。ping 用 Echo 一问一答测连通性，traceroute 用 TTL 递增逼每个路由器报超时——把整条路径一跳一跳问出来。",
      concepts: ["ICMP 报文分类", "回送请求与应答", "TTL 与超时报文", "目的不可达的细分", "traceroute 原理"],
      principles: [
        "ICMP 封装在 IP 内（协议号 1），属于网络层协议但报文要交给上层处理——它不承载用户数据，只为控制与诊断。",
        "查询类报文（Echo 请求/应答、时间戳）是成对的一问一答；差错类报文（目的不可达、超时、参数问题）是对故障的被动上报，且不对差错报文再报差错。",
        "TTL 每过一个路由器减一，减到 0 丢弃并回「超时」ICMP——traceroute 正是利用这个机制：TTL=1 问第一跳，TTL=2 问第二跳……",
        "目的不可达细分多种码：网络不可达、主机不可达、端口不可达、需要分片但 DF 置位（PMTU 发现的核心报文）。",
      ],
      applications: [
        "ping 是 Echo 请求/应答的最小应用，RTT 与丢包率是网络排障的第一手数据。",
        "traceroute（Windows 的 tracert 用 ICMP 而非 UDP）逐跳列出路径，是定位「断在哪一段」的工具。",
        "PMTU 发现完全依赖「目的不可达——需要分片」报文；防火墙误杀 ICMP 会造成大包不通小包通的诡异故障。",
      ],
      pitfalls: [
        "以为 ping 不通就是网络断了——中间设备可能禁 ICMP 但转发正常，ping 只是诊断手段不是转发前提。",
        "把 traceroute 的星号当断链：路由器可能不回超时（禁 ICMP），但流量照常通过。",
        "忽视 ICMP 的限速：路由器对差错报文限速，丢部分 ICMP 是正常现象，不代表链路问题。",
      ],
      method:
        "排障按层走：ping 目标测连通 → traceroute 看断点 → 核对是哪类不可达（网络/主机/端口/需分片）→ 结合 TTL 行为判断设备是否禁 ICMP。",
      exercise:
        "用 traceroute 追踪一个域名的路径，解释每一跳显示的内容与原理；再对一个禁 ping 的主机做 traceroute，观察星号与最终可达的组合，说明 ICMP 被过滤的位置。",
      checkpoint: "能默写查询类与差错类报文的分类，能解释 traceroute 利用 TTL 的机制与防火墙造成的星号。",
      lesson: {
        overview: [
          "IP 协议的口号是尽力而为——包丢了、路不通、活得不够久，IP 自己都不管。把这一切故障上报出来的机制就是 ICMP：它寄生在 IP 之内（协议号 1），报文分两大类——查询类主动问（Echo、时间戳），差错类被动报（不可达、超时）。ping 与 traceroute 这两个最著名的网络工具，分别把两类报文用成了艺术。",
          "traceroute 的原理是教科书级的巧妙：TTL 是 IP 头里的倒计时，每个路由器减一、减到零就丢包并回「超时」。从 TTL=1 开始逐次加一发送探测包，第 k 个探测包会在第 k 跳路由器处刚好归零——于是每个路由器都被迫自报家门。把整条路径一跳一跳「问」出来，靠的不是任何设备的配合设计，而是对丢弃行为的巧妙利用。",
          "ICMP 的边界也要清楚：它是网络层的诊断协议，不承载用户数据、不保证可靠送达，甚至路由器对差错报文会限速（防止故障风暴放大）。防火墙策略经常禁 Echo 却不禁转发——「ping 不通但服务通」是真实世界的常态。理解 ICMP 的角色定位，比背报文类型更重要。",
        ],
        mechanism: [
          "报文结构：类型（1 字节）+ 代码（1 字节）+ 校验和 + 内容。Echo 请求类型 8、应答类型 0（内容含标识符与序号，ping 用它们配对）；目的不可达类型 3（代码细分 16 种）；超时类型 11；重定向类型 5。",
          "ping 的流程：发 Echo 请求（类型 8）→ 目标主机的 IP 层自动回 Echo 应答（类型 0）→ 发送方按序号配对计算 RTT。标识符区分同一主机上的多个 ping 进程，序号区分多个在途探测——两者让成千上万个在途请求各回各家。",
          "traceroute 的 TTL 递增：发 TTL=1 的 UDP 包（故意用高位端口），第一跳路由器减到 0 丢弃并回「超时」（类型 11）——回包的源地址就是第一跳的 IP；TTL=2 到第二跳……直到到达目标，目标回「端口不可达」（故意用无人监听的端口）——两种报文共同画完整条路径。Windows 的 tracert 简化为全用 ICMP Echo。",
          "PMTU 联动：源端发 DF（不分片）置位的大包，路径中 MTU 更小的路由器丢弃并回「目的不可达，需要分片」（类型 3 代码 4），报文里携带该跳的 MTU——源端据此缩小包长重试。这就是 IPv6 彻底移除路由器分片后依赖的机制（IPv6 批已述），防火墙放行 ICMPv6 是硬性要求。",
        ],
        example: {
          title: "用 Python 实现 mini-traceroute",
          language: "python",
          code: "import socket, struct, time\n\ndef traceroute(dest_ip, max_hops=15, probe_port=33434):\n    for ttl in range(1, max_hops + 1):\n        # 探测包：故意用无人监听的高位端口（UDP）\n        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)\n        s.settimeout(2)\n        s.setsockopt(socket.IPPROTO_IP, socket.IP_TTL, ttl)\n        start = time.time()\n        s.sendto(b\"probe\", (dest_ip, probe_port))\n        try:\n            data, addr = s.recvfrom(1024)          # 收到 ICMP 差错（超时/端口不可达）\n            rtt = (time.time() - start) * 1000\n            print(f\"{ttl:2d}  {addr[0]:15s}  {rtt:6.1f} ms\")\n            if addr[0] == dest_ip:\n                break                              # 到达目标：端口不可达\n        except socket.timeout:\n            print(f\"{ttl:2d}  * * *\")             # 该跳不回 ICMP（被过滤）\n        finally:\n            s.close()\n\ntraceroute(\"93.184.216.34\")",
          explanation:
            "核心循环只有一件事：TTL 从 1 递增，每次发一个指向无人监听端口的 UDP 包。路径上的每个路由器把 TTL 减到 0 时必须回「超时」ICMP——回包源地址暴露了这一跳的身份；最后一个包到达目标主机时，目标发现端口没人监听，回「端口不可达」——探测结束。星号（超时）表示该跳不回 ICMP 但转发正常。整个工具没有使用任何专用协议支持，纯粹是对 IP 转发行为的观察艺术。",
        },
        practiceSteps: [
          "对本机到公共 DNS 的路径跑 traceroute，数出跳数并找出运营商边界。",
          "对比 ICMP 模式（Windows tracert）与 UDP 模式（Linux traceroute）的输出差异。",
          "临时禁 ping（ICMP Echo）但保持转发，验证「ping 不通但服务可达」。",
          "用 ping -s 递增包长，找到 PMTU 断点（大包开始丢的位置）。",
        ],
        masteryChecklist: [
          "能分类查询类与差错类 ICMP 报文并各举两例。",
          "能解释 traceroute 的 TTL 递增机制与两种结束条件（超时/端口不可达）。",
          "能说明 PMTU 发现对「需要分片」报文的依赖及防火墙误杀的后果。",
        ],
        summary: [
          "ICMP 寄生在 IP 内：查询类一问一答，差错类被动上报。",
          "ping = Echo 8/0 配对；traceroute = TTL 递增 + 超时报文。",
          "TTL 归零丢包回超时，是路径探测的免费基础设施。",
          "防火墙禁 ICMP 造成的星号与 PMTU 黑洞，是排障常客。",
        ],
        terms: [
          {
            term: "Echo 请求/应答",
            plain: "ping 的一问一答：类型 8 问、类型 0 答。",
            detail: "标识符 + 序号让多个并发 ping 的应答能正确配对。RTT 从发出到收到应答全程计时。",
          },
          {
            term: "目的不可达",
            plain: "包送不到：网络不通、主机不在线、端口没人听……细分十几种。",
            detail: "代码字段区分具体原因。代码 4「需要分片但 DF 置位」是 PMTU 发现的专用报文。",
          },
          {
            term: "TTL 超时",
            plain: "包在网络里转的圈数用完了：每过一个路由器减一。",
            detail: "设计目的是防路由环路让包永生不死。traceroute 把这个保命机制变成了测距工具。",
          },
          {
            term: "PMTU 黑洞",
            plain: "防火墙把「需要分片」的 ICMP 报文也拦了，大包静默丢失。",
            detail: "症状是「小包通、大包卡」：SSL 握手小包能过，证书大包卡死。放行 ICMP 类型 3 代码 4 是解药。",
          },
        ],
      },
    },
    questions: [
      {
        key: "computer-networking-exp-net-icmp-s1",
        stageKey: "net-routing-stage",
        topicKey: "net-icmp",
        type: "single",
        stem: "traceroute 的第一跳探测包使用 TTL=1 并指向一个无人监听的高位 UDP 端口。第一跳路由器收到该包后会回送哪种 ICMP 报文？探测如何结束？",
        options: [
          { key: "A", text: "回「目的不可达」，直到目标主机回 Echo 应答才结束" },
          { key: "B", text: "回「超时」（TTL 归零），探测在目标主机回「端口不可达」时结束" },
          { key: "C", text: "回「重定向」，探测在收到目标主机的 ACK 时结束" },
          { key: "D", text: "路由器不回任何报文，探测只能靠超时判断每一跳" },
        ],
        answer: ["B"],
        explanation:
          "TTL=1 的包到达第一跳路由器时被减为 0——路由器丢弃它并回「超时」（类型 11），回包的源地址暴露这一跳身份；TTL 逐次加一，每个路由器依次被「问」出来。探测结束的标志是包终于到达目标：目标发现 UDP 端口无人监听，回「目的不可达——端口不可达」（类型 3 代码 3），探测方识别出源地址即目标 IP，路径完整。整个机制没有任何协议的「配合设计」——纯粹利用 IP 转发的丢弃行为与 ICMP 的差错上报。",
        difficulty: "medium",
        tags: ["traceroute", "TTL", "ICMP"],
        sourceKey: "wireshark",
        level: "进阶",
      },
      {
        key: "computer-networking-exp-net-icmp-j1",
        stageKey: "net-routing-stage",
        topicKey: "net-icmp",
        type: "judge",
        stem: "防火墙禁用了所有 ICMP 报文后，网络将无法转发任何超过路径最小 MTU 的大包，即使 TCP 连接已经正常建立。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "这正是 PMTU 黑洞的机制。TCP 建立握手用的是小包（SYN/ACK 约 60 字节），不会被 MTU 卡住；数据传输阶段源端发 DF 置位的大包，路径上 MTU 更小的路由器丢弃大包并回「目的不可达——需要分片」的 ICMP——这个报文被防火墙拦截后，源端永远收不到 MTU 通知，只能反复重发注定被丢的大包，连接表现为「握手成功、传输卡死」。对策是放行 ICMP 类型 3 代码 4（或用 TCP MSS 钳制）。这条规则的 IPv6 版本更严格：ICMPv6 是协议不可分割的部分，禁掉它连邻居发现都会失效。",
        difficulty: "medium",
        tags: ["PMTU 黑洞", "防火墙", "ICMP"],
        sourceKey: "linux-kernel",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "computer-networking",
    stageKey: "net-layer-model-stage",
    topic: {
      key: "net-email-protocols",
      title: "电子邮件协议族：SMTP 推、POP3 与 IMAP 拉",
      summary:
        "邮件系统的三段旅程：发件人用 SMTP 把信推给自己的服务器，两台服务器之间再用 SMTP 中转，收件人用 POP3 或 IMAP 把信拉下来。SMTP 只管推不管读——读信永远是拉协议的职责。",
      concepts: ["SMTP 推送与中继", "POP3 下载模式", "IMAP 同步模式", "MIME 多媒体扩展", "邮件地址与 MX 记录"],
      principles: [
        "SMTP 是推协议：客户端→服务器、服务器→服务器都用它；端口 25（中继）/587（提交，带认证）。它的会话是命令行式的：HELO/MAIL FROM/RCPT TO/DATA。",
        "POP3 把邮件下载到本地并（默认）从服务器删除——单机视角，离线可读；端口 110。",
        "IMAP 在服务器上维护邮件的目录结构与状态（已读/文件夹），多端同步视图；端口 143——它是多设备时代的正确选择。",
        "MIME 让纯文本的 SMTP 能携带附件与多部分正文：Base64 编码二进制、Content-Type 声明类型——SMTP 协议本身一字未改。",
      ],
      applications: [
        "邮件客户端（Outlook/Thunderbird）发信用 SMTP、收信用 IMAP——两端协议、两个端口、两套状态。",
        "Web 邮箱（Gmail 网页版）把 IMAP/POP3 隐藏在自家协议之后，但对外仍然暴露标准 SMTP/IMAP。",
        "反垃圾体系（SPF/DKIM/DMARC）全部工作在 SMTP 层：验证发信域名是否被授权。",
      ],
      pitfalls: [
        "把 SMTP 当收信协议——它只有推没有拉，收件人必须用 POP3/IMAP 主动取。",
        "混淆端口：25 是服务器间中继与老式提交、587 是现代用户提交（STARTTLS + 认证）、465 是隐式 TLS；用 25 直发客户端邮件常被拒收。",
        "以为邮件地址的域名部分由 A 记录解析——投递方查的是 MX 记录，没有 MX 才回退 A。",
      ],
      method:
        "邮件排障按旅程分段：客户端→服务器看 SMTP 提交认证；服务器→服务器看 MX 解析与中继策略；服务器→客户端看 IMAP/POP3 的连接与状态同步。",
      exercise:
        "用 telnet 或 openssl s_client 手动完成一次 SMTP 会话（HELO → MAIL FROM → RCPT TO → DATA → QUIT），观察每一步的应答码；对比 IMAP 登录后 LIST 文件夹的输出，指出推与拉的分界。",
      checkpoint: "能画出邮件的三段旅程并标注每段的协议与端口，能解释 IMAP 与 POP3 的状态模型差异。",
      lesson: {
        overview: [
          "电子邮件是互联网上最成功的异步消息系统，它的架构在 40 年里只加不改：三段旅程、三个协议各司其职。发件人推信给自己的服务器（SMTP 提交），服务器之间接力中转（SMTP 中继，靠 MX 记录找路），收件人把信拉下来（POP3 或 IMAP）。推与拉的分工不是历史包袱，而是离线异步的必然——发信时收件人不必在线。",
          "POP3 与 IMAP 的分野是多设备时代才凸显的。POP3 的世界观是「服务器是信箱，信取走就归我」：下载、可选删除、本地独占。IMAP 的世界观是「服务器是真相源」：邮件的文件夹、已读标记、删除状态全部住在服务器上，任何设备连上去看到的都是同一份视图。多设备同步让 IMAP 成为默认，但 POP3 的「取走即焚」在单机与隐私场景仍有价值。",
          "MIME 的故事是「不改协议实现扩展」的典范：SMTP 只承诺传 7 位 ASCII 文本，MIME 用 Content-Type 描述类型、Base64 编码二进制、multipart 结构装多附件，把互联网信件从纯文本升级到多媒体——而中继服务器毫不知情、照常转发。这种「在协议之上分层扩展」的思路，影响了后来几乎所有协议的演进方式。",
        ],
        mechanism: [
          "SMTP 会话：TCP 25/587 建连后进入命令应答循环——HELO（或 EHLO，声明扩展能力）→ MAIL FROM（发件人）→ RCPT TO（收件人）→ DATA（正文，以单独一行 . 结束）→ QUIT。每个命令都有三位数字应答码（250 成功、354 继续输入、550 拒收）。",
          "MX 与中继路由：服务器收到发给 someone@example.com 的信，查 example.com 的 MX 记录得到收件服务器的域名（可能有优先级），再向该域名的 A/AAAA 地址发起 SMTP 中继。没有 MX 时回退到 A 记录——这是唯一一处 DNS 查询的回退规则。",
          "POP3 的状态机：认证（USER/PASS 或 APOP）→ 事务（LIST 列出邮件、RETR 取信、DELE 标记删除）→ 更新（QUIT 时真正执行删除）。协议简单到可以用 telnet 手工收信，状态只有认证前后两段。",
          "IMAP 的丰富语义：文件夹层级（LIST/CREATE）、标志系统（\\Seen/\\Flagged）、服务器端搜索（SEARCH）、部分获取（只取头部不取正文）。这些能力让多端同步成为可能，也让 IMAP 会话比 POP3 复杂一个数量级——邮件永远在服务器，删除只是移进 Trash。",
        ],
        example: {
          title: "手工 SMTP 会话与 IMAP 对比",
          language: "bash",
          code: "# SMTP：发信是推（客户端 → 服务器 → 下一跳服务器）\nopenssl s_client -starttls smtp -crlf -connect smtp.example.com:587\nHELO client.example.com\nAUTH LOGIN                     # base64 的用户名/密码\nMAIL FROM:<alice@example.com>\nRCPT TO:<bob@example.org>\nDATA\nSubject: Hello\n\nBob, this is a test.\n.                              # 单独一行句号结束正文\nQUIT\n\n# IMAP：收信是拉（客户端 ← 服务器，状态住在服务器）\nopenssl s_client -connect imap.example.com:993\na1 LOGIN alice@example.com \"pass\"\na2 LIST \"\" \"*\"                 # 列出文件夹\na3 SELECT INBOX\na4 FETCH 1 BODY[HEADER]        # 只取第一封信的头部\na5 LOGOUT",
          explanation:
            "两段会话的「方向感」一目了然：SMTP 的命令流是往外推——MAIL FROM、RCPT TO、DATA 把信从客户端推进网络；IMAP 的命令流是往里拉——FETCH 把服务器上的内容取回客户端。SMTP 的三位应答码（250/354/550）与 IMAP 的标签式应答（a1/a2…）是两套完全不同的会话风格。注意 DATA 里的正文以单独一行句号结束——这个约定决定了 MIME 必须对正文做转义与编码。",
        },
        practiceSteps: [
          "用 openssl s_client 完整走一遍 SMTP 与 IMAP 会话，记录每步应答码。",
          "dig 查询自己邮箱域名的 MX 记录，画出投递路径。",
          "对比同一邮箱在 POP3 下载后与 IMAP 同步下的多设备状态差异。",
          "发一封带附件的邮件，用抓包看 MIME 的 multipart 结构与 Base64 编码。",
        ],
        masteryChecklist: [
          "能画出邮件三段旅程并标注协议与端口（SMTP 25/587、POP3 110、IMAP 143/993）。",
          "能对比 POP3 下载模式与 IMAP 服务器状态模式的多设备语义。",
          "能解释 MIME 如何在不改 SMTP 的前提下携带二进制附件。",
        ],
        summary: [
          "SMTP 只管推：客户端提交 + 服务器中继，MX 记录找下一跳。",
          "POP3 下载即焚，IMAP 服务器为真相源——多设备选 IMAP。",
          "MIME 用编码与结构扩展 SMTP，协议本体未动。",
          "端口分工：25 中继、587 提交、465 隐式 TLS、110/143 明文、993/995 TLS。",
        ],
        terms: [
          {
            term: "SMTP",
            plain: "简单邮件传输协议：把信从一台服务器推向下一台。",
            detail: "命令应答式会话，三位应答码。它不存储、不索引、不读信——推完即忘。",
          },
          {
            term: "IMAP",
            plain: "把邮件留在服务器、多端共享视图的收信协议。",
            detail: "文件夹、标志、搜索全在服务器。流量省在「只同步变更」，代价是服务器存储与实现复杂度。",
          },
          {
            term: "MX 记录",
            plain: "告诉发信方「这个域名的信该送到哪台服务器」的 DNS 记录。",
            detail: "带优先级可做主备。没有 MX 时回退 A 记录——DNS 里唯一的回退规则之一。",
          },
          {
            term: "MIME",
            plain: "让纯文本邮件能装附件与多媒体的「打包规范」。",
            detail: "Content-Type 声明类型、Base64 编码二进制、multipart 装多部件。SMTP 只见文本，完全无感。",
          },
        ],
      },
    },
    questions: [
      {
        key: "computer-networking-exp-net-email-protocols-s1",
        stageKey: "net-layer-model-stage",
        topicKey: "net-email-protocols",
        type: "single",
        stem: "用户 Alice（alice@a.com）给 Bob（bob@b.com）发信，b.com 的邮件服务器收到后，Bob 用手机 IMAP 客户端取信。整个旅程中「推」与「拉」协议的正确分布是？",
        options: [
          { key: "A", text: "全程 SMTP：Alice 推给 a.com，a.com 推给 b.com，b.com 推给 Bob 的手机" },
          { key: "B", text: "Alice 经 SMTP 推给 a.com，a.com 经 SMTP 中继给 b.com，Bob 的手机经 IMAP 从 b.com 拉取" },
          { key: "C", text: "Alice 经 POP3 提交，b.com 经 SMTP 推给 Bob，手机用 SMTP 拉取" },
          { key: "D", text: "全程 IMAP：SMTP 只在两台服务器之间使用一次" },
        ],
        answer: ["B"],
        explanation:
          "邮件的推拉分界在「服务器」这一层：所有「往外送信」的动作都是 SMTP——Alice 的客户端提交给 a.com 是 SMTP，a.com 中继给 b.com 也是 SMTP（查 b.com 的 MX 记录找到目标）；所有「把信取回来」的动作都是拉协议——Bob 的手机用 IMAP（或 POP3）从 b.com 拉取。SMTP 从不「推给用户」：服务器到收件人这一段永远是拉。POP3/IMAP/SMTP 三协议各管一段，这正是邮件系统三段旅程的架构。",
        difficulty: "medium",
        tags: ["SMTP", "IMAP", "推拉模型"],
        sourceKey: "system-design-primer",
        level: "进阶",
      },
      {
        key: "computer-networking-exp-net-email-protocols-j1",
        stageKey: "net-layer-model-stage",
        topicKey: "net-email-protocols",
        type: "judge",
        stem: "邮件服务器 b.com 收到发往 bob@b.com 的信时，会查询 b.com 的 A 记录来确定下一跳地址；MX 记录只在服务器间中继失败时才作为备用查询。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "方向完全反了：投递方对收件域名查询的是 MX 记录（优先），MX 指向「负责接收该域邮件的主机」的域名，再解析该域名的 A/AAAA 得到地址；只有当域名没有 MX 记录时，才回退使用 A 记录。MX 还带优先级字段（数字越小越优先），可配置主备邮件服务器。这个「MX 优先、A 回退」是 DNS 里少数的回退规则之一——把 A 当主查询会让邮件全部投给 Web 服务器。",
        difficulty: "easy",
        tags: ["MX 记录", "邮件投递", "DNS"],
        sourceKey: "wireshark",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "computer-networking",
    stageKey: "net-layer-model-stage",
    topic: {
      key: "net-ftp",
      title: "FTP：控制与数据分离的双连接设计",
      summary:
        "FTP 是少见的双连接协议：一条 TCP 控制连接（21）贯穿整个会话传命令，每传一个文件另开一条 TCP 数据连接（主动模式服务器从 20 连过来，被动模式客户端连服务器随机端口）。",
      concepts: ["控制连接与数据连接", "主动模式（PORT）", "被动模式（PASV）", "端口 20/21", "匿名 FTP"],
      principles: [
        "控制连接（端口 21）承载 USER/PASS/RETR/STOR 等命令与应答，整个会话存活；数据连接按需创建、传完即关。",
        "主动模式：客户端通过 PORT 命令告知自己的数据端口，服务器从端口 20 主动连过来——服务器连客户端，防火墙时代对客户端不友好。",
        "被动模式：客户端发 PASV，服务器开一个随机高位端口并告知，客户端主动连过去——数据方向与控制一致，能穿客户端侧防火墙，是现代默认。",
        "每传一个文件/目录列表都要重建数据连接（或用流模式复用），控制连接全程保持会话状态。",
      ],
      applications: [
        "软件发布站的匿名 FTP 是互联网早期的分布式存储形态。",
        "嵌入式设备的固件上传、工业设备的日志导出仍常见 FTP/FTPS。",
        "FTPS（FTP over TLS）与 SFTP（SSH 之上的文件传输）是安全替代——SFTP 不是 FTP 的变体。",
      ],
      pitfalls: [
        "主动模式在客户端 NAT/防火墙后必败：服务器连客户端的随机高位端口会被拦，表现为「登录成功、列表超时」。",
        "把 SFTP 与 FTPS 混为一谈：SFTP 是 SSH 协议族的子系统（一条连接），FTPS 是 FTP 加 TLS（仍是双连接）。",
        "以为控制连接断了数据连接还能用——两者是主从关系，控制断则会话终止。",
      ],
      method:
        "排障先判断模式：客户端在 NAT 后用被动模式；抓包看 21 端口的命令流（PORT/PASV）即可确认模式与数据端口。",
      exercise:
        "用抓包观察一次 FTP 会话：标出 21 端口的 USER/PASS/PASV/RETR 命令流，找出 PASV 应答中服务器告知的数据端口，验证数据连接的方向与端口；再切回主动模式对比连接方向。",
      checkpoint: "能画出两种模式的连接方向图，能解释被动模式成为现代默认的防火墙原因。",
      lesson: {
        overview: [
          "FTP 的双连接设计在协议世界里独树一帜：命令与数据分开走。控制连接是会话的「神经」——登录、目录切换、文件命令的应答都走它，从连接建立到退出全程不断；数据连接是「肌肉」——每传一个文件或目录列表就新建一条 TCP，传完即关。这种分离让命令可以在传输进行中插队（如 ABOR 中止传输），代价是防火墙时代的数据连接方向问题。",
          "主动与被动模式争的是「谁来发起数据连接」。主动模式（历史默认）由服务器从 20 端口连向客户端指定的端口——在客户端没有公网地址、躲在 NAT 与防火墙之后的今天，这个方向几乎必然被拦。被动模式反转方向：服务器开随机端口等客户端来连——数据连接与控制连接同向， NAT 与防火墙都无感。现代客户端默认被动，服务器管理员要负责开放被动端口段。",
          "FTP 的历史地位与安全现实：它发明了匿名访问、断点续传、文本/二进制传输模式等概念，但明文传输凭据的缺陷让它逐步让位给 FTPS（TLS 包裹的 FTP，仍是双连接）与 SFTP（SSH 文件子系统，单连接、完全不同的协议）。",
        ],
        mechanism: [
          "会话生命周期：客户端连 21 端口 → USER/PASS 认证 → 命令循环（CWD 换目录、PASV/PORT 定数据通道、RETR/STOR 传文件、LIST 列目录）→ QUIT 关控制连接。控制连接的应答是三位数字码（220 就绪、331 要密码、226 传输完成、425 无法建数据连接）。",
          "主动模式握手：客户端发 PORT h1,h2,h3,h4,p1,p2（告知自己的 IP 与数据端口）→ 服务器从 20 端口发起 TCP 连接到该端口 → 数据通道建立 → 传输 → 关闭。NAT 会改写客户端告知的地址导致服务器连向错误地址——这是主动模式在 NAT 后必败的技术根源。",
          "被动模式握手：客户端发 PASV → 服务器回 227 Entering Passive Mode (h1,h2,h3,h4,p1,p2)（告知数据端口）→ 客户端主动连接该端口 → 传输。方向与控制连接一致，NAT 只需改写客户端侧；服务器侧防火墙需要放行被动端口段（如 50000-51000）。",
          "传输模式：文本模式（ASCII）会在不同系统间转换换行符——历史产物，如今必用二进制（Image）模式避免文件被改坏。断点续传用 REST 命令指定起始偏移。",
        ],
        example: {
          title: "一次被动模式 FTP 会话的命令流",
          language: "text",
          code: "客户端                              服务器\n  |--- TCP 连接 21 端口 -------------->|   控制连接建立\n  |<-- 220 Welcome -------------------|\n  |--- USER anonymous --------------->|\n  |<-- 331 Please send password ------|\n  |--- PASS guest@ ------------------>|\n  |<-- 230 Logged in -----------------|\n  |--- PASV ------------------------->|   客户端要数据通道\n  |<-- 227 Entering Passive Mode\n  |       (203,0,113,1,200,35) -------|   数据端口 = 200*256+35 = 51235\n  |--- TCP 连接 51235 --------------->|   数据连接（客户端主动）\n  |--- RETR bigfile.bin ------------->|   命令走控制连接\n  |<== 文件字节流 =================== |   数据走数据连接\n  |<-- 226 Transfer complete ---------|\n  |--- QUIT ------------------------->|\n  （数据连接传完即关；控制连接全程不断）",
          explanation:
            "抓包时先过滤 21 端口看命令流：PASV 的应答 227 里藏着数据端口的计算方式（p1×256+p2）。数据连接由客户端主动发起（被动模式的核心特征），文件字节流与命令应答分属两条 TCP——这是 FTP 与 HTTP（单连接请求-响应）最结构性的差别。主动模式的唯一区别是数据连接方向反转：服务器从 20 端口连向客户端 PORT 命令告知的地址。",
        },
        practiceSteps: [
          "用 ftp 客户端连公共镜像站，抓包对照命令流与端口计算。",
          "分别用主动与被动模式穿过 NAT，观察失败的是哪个方向的连接。",
          "对比 SFTP 会话（单连接）与 FTPS 的连接数，理解「SFTP 不是 FTP」。",
          "配置 vsftpd 的被动端口段并在防火墙放行，验证被动模式恢复。",
        ],
        masteryChecklist: [
          "能画出主动/被动两种模式的连接方向图并标出端口。",
          "能解释被动模式成为现代默认的防火墙/NAT 原因。",
          "能区分 FTPS（FTP+TLS）与 SFTP（SSH 子系统）。",
        ],
        summary: [
          "FTP 双连接：21 控制全程活，数据连接按需建、传完关。",
          "主动模式服务器连客户端，NAT 时代必败；被动模式同向连接成默认。",
          "227 应答里的端口 = p1×256 + p2。",
          "FTPS 是加 TLS 的 FTP；SFTP 是 SSH 的文件子系统，不是 FTP。",
        ],
        terms: [
          {
            term: "控制连接",
            plain: "FTP 的命令神经，从登录到退出全程不断。",
            detail: "命令与三位应答码走它。它断了整个会话就没了，正在传的数据连接也随之终止。",
          },
          {
            term: "数据连接",
            plain: "每传一个文件/目录临时开的「搬运通道」。",
            detail: "方向由 PORT（主动）或 PASV（被动）协商。传输完成即关闭，下次传输再建。",
          },
          {
            term: "被动模式",
            plain: "服务器开随机端口等客户端来连的数据模式。",
            detail: "数据连接与控制连接同向，穿过客户端 NAT/防火墙无障碍，是现代默认。",
          },
          {
            term: "匿名 FTP",
            plain: "用 anonymous 当用户名、邮箱当密码的公开下载服务。",
            detail: "互联网早期的软件分发主渠道，至今仍是开源镜像站的传统入口之一。",
          },
        ],
      },
    },
    questions: [
      {
        key: "computer-networking-exp-net-ftp-s1",
        stageKey: "net-layer-model-stage",
        topicKey: "net-ftp",
        type: "single",
        stem: "FTP 被动模式（PASV）在 NAT 与防火墙时代成为客户端默认，其核心原因是？",
        options: [
          { key: "A", text: "被动模式的数据连接加密更强" },
          { key: "B", text: "被动模式下数据连接由客户端主动发起，方向与控制连接一致，能穿过客户端侧的 NAT 与防火墙" },
          { key: "C", text: "被动模式使用固定的 20 端口，便于防火墙放行" },
          { key: "D", text: "被动模式的传输速度比主动模式快" },
        ],
        answer: ["B"],
        explanation:
          "主动模式要服务器从 20 端口连向客户端的随机高位端口——客户端躲在 NAT 后根本没有可达的公网地址，服务器连过去必被拦，典型症状是「登录成功、列表超时」。被动模式把数据连接的方向反转为客户端主动连服务器（服务器只开放一个端口段），与控制连接同向，NAT 无需特殊处理。A 与传输加密无关（加密是 FTPS 的事）；C 的 20 端口恰恰是主动模式的特征；D 没有速度差异——两者只是连接方向不同。",
        difficulty: "medium",
        tags: ["FTP", "被动模式", "NAT"],
        sourceKey: "system-design-primer",
        level: "进阶",
      },
      {
        key: "computer-networking-exp-net-ftp-j1",
        stageKey: "net-layer-model-stage",
        topicKey: "net-ftp",
        type: "judge",
        stem: "SFTP 是 FTP 协议加上 TLS 加密后的安全版本，两者的连接模型完全相同。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "SFTP（SSH File Transfer Protocol）与 FTP 在协议族谱上毫无血缘：它是 SSH 协议族的一个子系统，运行在 SSH 的单条加密连接上（默认 22 端口），没有控制/数据双连接的概念，也没有 PORT/PASV 命令。加 TLS 的 FTP 叫 FTPS（显式 TLS 走 989/990 或 AUTH TLS 升级），它保留双连接模型、也要面对被动模式的端口段问题。两者名字像、模型完全不同——选型时 SFTP 因单连接穿防火墙更容易而更常用。",
        difficulty: "easy",
        tags: ["SFTP", "FTPS", "协议辨析"],
        sourceKey: "linux-kernel",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "computer-networking",
    stageKey: "net-routing-stage",
    topic: {
      key: "net-ip-multicast",
      title: "IP 多播与 IGMP：一份包发给一群人",
      summary:
        "多播让一台发送者的一个数据包被路由器复制成 N 份、只送到「加入了这个组」的接收者——带宽只占一份。D 类地址标记组，IGMP 让主机向本地路由器申报 membership，组播路由协议再在全网搭树。",
      concepts: ["D 类多播地址", "IGMP 成员管理", "多播 MAC 地址映射", "多播路由树", "多播 vs 广播 vs 单播"],
      principles: [
        "IPv4 多播地址 224.0.0.0/4（224-239）：224.0.0.x 保留给本地控制（不转发），239/8 是私有管理域，其余全局分配。",
        "IGMP 是主机与本地路由器之间的成员申报协议：主机发 join，路由器定期 query，没人应答的组被剪枝——它只管「最后一跳」，跨网段的分发靠多播路由协议。",
        "以太网的多播 MAC 前缀 01-00-5E，IP 多播地址的低 23 位映射进 MAC 后 23 位——IP 的 28 位组标识有 5 位没进 MAC，32 个 IP 组共享一个 MAC（靠 IP 层过滤兜底）。",
        "多播路由协议（PIM 等）在路由器间构建分发树：源树最短但每源一棵，共享树（RP 为根）所有源共用一棵。",
      ],
      applications: [
        "IPTV 与直播的分发：一份流喂给万人，单播架构带宽线性爆炸、多播只占一份。",
        "金融行情推送（股票报价）是多播的经典生产场景：毫秒级扇出到所有订阅终端。",
        "局域网服务发现与路由协议本身（OSPF 的 224.0.0.5）就在用本地多播。",
      ],
      pitfalls: [
        "把多播当广播：广播打醒全网所有主机（不分是否订阅），多播只到组成员，交换机还能做 IGMP snooping 精确转发。",
        "忘记 MAC 映射的 32:1 重叠——网卡会收到 32 个 IP 组的多播帧，IP 层必须再过滤一次。",
        "以为互联网全网多播是常态——跨运营商的多播部署极少，公网应用多用应用层分发（CDN 单播）。",
      ],
      method:
        "多播题先分清三层：地址层（D 类范围与保留段）、本地成员层（IGMP 申报与 MAC 映射）、路由层（分发树）；再按「主机-路由器-网络」的边界归类。",
      exercise:
        "计算 IP 多播地址 224.128.1.5 映射后的以太网 MAC 地址（前缀 01-00-5E），并解释为什么 224.0.1.5 与它会映射到同一个 MAC、网卡如何区分两者。",
      checkpoint: "能默写 D 类地址范围与 IGMP 的角色边界，能完成多播 MAC 的 23 位映射计算并解释 32:1 重叠。",
      lesson: {
        overview: [
          "把一份内容发给 N 个人，三种方式：单播发 N 份（带宽 ×N）、广播发全网（无关者也收）、多播只发给订阅者且带宽只占一份。多播的地址是 D 类（224-239），它不是某台主机的地址，而是一个「组的名字」——没有主机独占它，加入组的主机都能收。",
          "多播的实现分两层。本地层是 IGMP：主机告诉本地路由器「我加入了 224.1.1.5」，路由器定期问「还有人要吗」，没有应答的组被剪掉。跨网层是多播路由协议（PIM）：在路由器之间建一棵分发树，包从源出发沿树分叉复制。两层协议的边界是「最后一跳的成员管理」与「全网的路由」——与单播世界里 ARP 管本地、路由协议管全网同构。",
          "以太网多播帧的落地有一处著名的近似：MAC 地址只有 48 位，前 25 位固定（01-00-5E + 零），只剩 23 位给 IP 组标识，而 IP 多播有 28 位标识——5 位的差距让 32 个 IP 组共享同一个 MAC。网卡无法从 MAC 层区分它们，必须把帧收上来交给 IP 层再过滤一次。这个「硬件粗筛 + 软件精筛」的双层过滤是历史包袱，也是多播驱动要正确配置过滤器的细节所在。",
        ],
        mechanism: [
          "IGMP 的查询-报告循环：路由器周期发 Membership Query（目的 224.0.0.1，所有主机组），主机对感兴趣的组回 Membership Report（带随机延迟抑制，避免报告风暴）；主机离开可以主动发 Leave（IGMPv2）。路由器据此维护每端口的组成员表。",
          "IGMP snooping：没有 snooping 的交换机把多播帧当广播泛洪到所有端口；开启后交换机偷听 IGMP 报文，只为有成员的端口转发——多播在二层就完成了精确投递。这是企业网部署多播的必备开关。",
          "MAC 映射规则：IP 多播地址的低 23 位填入 01-00-5E-xx-xx-xx 的后 23 位。例：224.128.1.5 的二进制低 23 位与 224.0.1.5 相同（第 24 位 IP 位被丢弃）——两者映射同一 MAC。网卡按 32 组共享一个 MAC 的现实，必须开启 IP 层过滤。",
          "多播路由树：PIM 稠密模式向全网泛洪再剪枝（适合组成员密集）；PIM 稀疏模式用汇聚点（RP）建共享树，成员显式加入（适合稀疏分布）。跨域多播的部署复杂度是它在公网稀少的原因。",
        ],
        example: {
          title: "多播 MAC 映射与 32:1 重叠",
          language: "python",
          code: "def multicast_mac(ip):\n    octets = [int(o) for o in ip.split('.')]\n    # D 类：低 23 位进 MAC 后 23 位（01-00-5E 前缀占 25 位，其中第 25 位恒 0）\n    low23 = ((octets[1] & 0x7F) << 16) | (octets[2] << 8) | octets[3]\n    return '01-00-5E-' + '-'.join(f'{(low23 >> s) & 0xFF:02X}' for s in (16, 8, 0))\n\nprint(multicast_mac('224.128.1.5'))   # 01-00-5E-00-01-05\nprint(multicast_mac('224.0.1.5'))     # 01-00-5E-00-01-05 —— 同一个 MAC！\n# IP 的第 24 位（128 = 1000 0000 的最高位）被映射规则丢弃，\n# 两个不同的 IP 组共享同一个 MAC；网卡收帧后由 IP 层目的地址二次过滤。",
          explanation:
            "映射规则只取 IP 低 23 位：224.128.1.5 与 224.0.1.5 的差异恰在被丢弃的第 24 位（第二字节的最高位），所以映射出同一个 MAC。这就是 32:1 重叠的来源——2^(28-23) = 32 个 IP 组共用一个 MAC 帧。网卡收到多播帧只做粗筛，IP 层再按完整的目的组地址精筛并丢弃不属于本组的帧。驱动与系统配置多播过滤器时必须意识到这种重叠，否则会误判「收到了别的组」。",
        },
        practiceSteps: [
          "手算三个多播地址的 MAC 映射，构造一对 32:1 重叠的例子。",
          "在交换机上开关 IGMP snooping，用流量发生器观察泛洪与精确转发的差别。",
          "用 iperf 的 UDP 多播模式在局域网测试多播吞吐与丢包。",
          "抓 OSPF 的多播包（224.0.0.5），确认它的 MAC 层也是多播帧。",
        ],
        masteryChecklist: [
          "能默写 D 类地址范围、IGMP 的角色边界与多播路由协议的分工。",
          "能完成 IP → 多播 MAC 的 23 位映射并解释 32:1 重叠。",
          "能对比单播/广播/多播的带宽与语义差异，并说明 IGMP snooping 的作用。",
        ],
        summary: [
          "D 类地址是组名不是主机地址，IGMP 管最后一跳成员申报。",
          "MAC 映射只取低 23 位，32 个 IP 组共享一个 MAC，IP 层再精筛。",
          "IGMP snooping 让二层交换机精确转发，多播不再泛洪。",
          "跨网分发靠 PIM 树（源树/共享树），公网部署稀少、局域网与 IPTV 常见。",
        ],
        terms: [
          {
            term: "D 类地址",
            plain: "224.0.0.0 到 239.255.255.255：不是机器的名字，是组队的名字。",
            detail: "224.0.0.x 是本地控制段（路由协议自用，TTL=1 不转发）；239/8 是私有管理域。",
          },
          {
            term: "IGMP",
            plain: "主机向本地路由器申报「我加入了这个组」的协议。",
            detail: "查询-报告循环加离开报文。它只覆盖最后一跳，跨网段的路由是 PIM 的事。",
          },
          {
            term: "IGMP snooping",
            plain: "交换机偷听 IGMP 报文，只为有成员的端口转发多播帧。",
            detail: "没有它，交换机把多播当广播泛洪全 VLAN——多播的带宽优势在二层就没了。",
          },
          {
            term: "汇聚点（RP）",
            plain: "稀疏模式多播树的总根：所有源先把包送到它，再沿树分发。",
            detail: "共享树的代价是流量可能绕路（先到 RP 再出去），收益是路由状态从「每源一棵」降到「每组一棵」。",
          },
        ],
      },
    },
    questions: [
      {
        key: "computer-networking-exp-net-ip-multicast-s1",
        stageKey: "net-routing-stage",
        topicKey: "net-ip-multicast",
        type: "single",
        stem: "IP 多播地址 224.0.1.5 与 224.128.1.5 映射后的以太网 MAC 地址关系是？",
        options: [
          { key: "A", text: "两个不同的 MAC，因为 IP 地址不同" },
          { key: "B", text: "同一个 MAC（01-00-5E-00-01-05）：映射只取 IP 低 23 位，第二字节的最高位被丢弃，32 个 IP 组共享一个 MAC" },
          { key: "C", text: "映射规则取 IP 全部 28 位组标识，MAC 地址必须扩展才能容纳" },
          { key: "D", text: "224.0.1.5 不属于 D 类地址，无法映射" },
        ],
        answer: ["B"],
        explanation:
          "以太网多播 MAC 的前 25 位固定为 01-00-5E 加一个恒 0 位，只剩 23 位容纳 IP 组标识；而 IP 多播有 28 位标识——第 24 位（第二字节最高位，如 128 = 1000 0000 的首位）在映射中被丢弃。224.0.1.5 与 224.128.1.5 恰好只差这一位，映射出同一个 MAC。网卡收帧时无法从 MAC 区分它们，必须上交 IP 层按完整目的地址二次过滤——这是「硬件粗筛 + 软件精筛」的双层设计。D 错误：224.0.1.5 在 224/4 范围内（且不在 224.0.0.x 保留段）。",
        difficulty: "hard",
        tags: ["多播 MAC", "地址映射", "IGMP"],
        sourceKey: "wireshark",
        level: "综合",
      },
      {
        key: "computer-networking-exp-net-ip-multicast-j1",
        stageKey: "net-routing-stage",
        topicKey: "net-ip-multicast",
        type: "judge",
        stem: "交换机开启 IGMP snooping 的主要作用是：让多播数据帧不再向所有端口泛洪，而只转发给存在组成员的端口。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "交换机是二层设备，对未知多播帧的默认行为是泛洪到 VLAN 内所有端口——多播的带宽优势在二层就被广播化消解。IGMP snooping 让交换机监听主机与路由器之间的 IGMP 报文，学习「哪个端口上有哪个组的成员」，从而把多播帧精确转发到需要的端口。没有成员的端口不再收到帧，既省带宽又降低无关主机的处理负担。注意 snooping 只管二层转发行为，跨路由器的成员管理与分发树仍由 IGMP/PIM 负责——两层各司其职。",
        difficulty: "easy",
        tags: ["IGMP snooping", "交换机", "多播转发"],
        sourceKey: "wireshark",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "computer-networking",
    stageKey: "net-routing-stage",
    topic: {
      key: "net-router-architecture",
      title: "路由器组成：从查表到交换结构",
      summary:
        "路由器不是黑盒：输入端口收包查转发表，交换结构把包搬到输出端口，输出端口排队发送——性能瓶颈可能藏在任何一段。查表用最长前缀匹配的硬件加速，交换结构的争用与队头阻塞是设计的核心难题。",
      concepts: ["输入/输出端口", "交换结构（纵横式/共享内存）", "最长前缀匹配的硬件化", "队头阻塞与 VOQ", "路由处理器与控制平面"],
      principles: [
        "转发平面（数据通路）每包执行：接收 → 校验 → 查表（最长前缀匹配）→ TTL 减一重算校验 → 交换到输出 → 排队 → 链路层封装发送。",
        "最长前缀匹配用 TCAM 或前缀树硬件化：TCAM 一次查回所有匹配前缀并按最长优先选——纳秒级但价格按位算。",
        "交换结构是吞吐的天花板：共享内存简单但受总线带宽限制；纵横式（crossbar）并行度高，但输入端争用输出端会形成队头阻塞（HOL）。",
        "虚拟输出队列（VOQ）给每个输入端口按输出端口分队列，是消除队头阻塞的标准解法，配调度算法（iSLIP）匹配输入输出。",
      ],
      applications: [
        "核心路由器的背板吞吐以 Tbps 计，交换结构的调度是芯片级工程。",
        "家用路由器的「卡顿」常发生在 NAT 与查表的软件路径，而非交换结构——硬件形态决定瓶颈位置。",
        "SDN 把控制平面（路由协议、表计算）从路由器剥离到集中控制器，转发平面只留查表与交换——路由器组成的知识点直接映射到 OpenFlow 交换机的结构。",
      ],
      pitfalls: [
        "把路由协议（算表）与转发（查表）混为一谈：前者是控制平面毫秒级后台，后者是转发平面纳秒级每包。",
        "忽略队头阻塞：输入队列里队首包去往忙输出端时，后面去往空闲输出的包也被卡住——单一 FIFO 的必然缺陷。",
        "以为查表就是精确匹配 IP：最长前缀匹配的语义决定了多条路由都能命中时选前缀最长的——这正是 CIDR 的配套查表算法。",
      ],
      method:
        "性能分析按流水线分段：查表（TCAM/树）→ 交换（结构带宽与争用）→ 输出排队（缓冲与调度），瓶颈在哪一段就优化哪一段。",
      exercise:
        "一台 4×4 纵横式交换路由器，所有输入端口各有满队列，且队首包全部去往输出端口 1：(a) 用单一 FIFO 输入队列时会发生什么？(b) 用 VOQ 后吞吐如何变化？(c) 说明最长前缀匹配为什么不能用普通哈希表实现。",
      checkpoint: "能画出路由器的转发平面分段图，能解释队头阻塞与 VOQ 的解法，能说明最长前缀匹配对查表结构的要求。",
      lesson: {
        overview: [
          "路由器的解剖图分两个平面。控制平面跑路由协议、算路由表——毫秒到秒级、软件为主；转发平面处理每一个包——纳秒到微秒级、必须硬件化。转发平面的流水线是固定的五步：接收校验、查转发表（最长前缀匹配）、改 TTL 与校验、交换结构搬运、输出排队发送。每一格都有专门的技术与瓶颈。",
          "查表是第一道难关。CIDR 的前缀是嵌套的——192.168.0.0/16 与 192.168.1.0/24 可能同时命中，规则是取最长的。精确匹配可以哈希，最长前缀不行：TCAM（三态内容寻址存储器）用通配位并行比较所有前缀、硬件选出最长命中——一步到位但昂贵；软件路由器用前缀树 + 压缩替代。",
          "交换结构是吞吐的天花板。共享内存式最简单（进出都过一块内存），受内存带宽限制；纵横式 crossbar 让每对输入输出可以同时连通，理论吞吐高，但输入端排队时「队首包等忙输出端、队尾包被连坐」的队头阻塞会把吞吐拖到 58% 左右。虚拟输出队列（每个输入按目标输出分队列）+ 配对调度算法是标准解法——这个「排队结构解决算法问题」的思路在很多系统里都会重现。",
        ],
        mechanism: [
          "输入端口：线路卡终结链路协议、校验帧、提取 IP 包；查表引擎（TCAM 或树）给出输出端口与改写信息（下一跳 MAC）；包进入交换结构前的队列。",
          "交换结构：crossbar 是 n×n 的开关矩阵，调度器每拍选出一组无冲突的输入-输出对配对。匹配问题等价于二部图匹配，iSLIP 等迭代算法用少量轮次逼近最大匹配。共享内存式（如早期路由器）则是「所有包进一块高速内存、输出端口自取」——结构简单、上限受内存带宽。",
          "输出端口：队列管理（每类流量的缓冲与丢弃策略，如 RED 随机早期检测防全局同步）、调度（加权公平队列保障 QoS）、链路层封装（改写下一跳 MAC）、发送。",
          "控制平面：路由处理器跑 OSPF/BGP，把计算结果（转发表）下发到各线路卡的查表引擎；它不碰每一个包，只在表变化时更新——控制与转发分离的程度是路由器档次的标志。",
        ],
        example: {
          title: "队头阻塞与 VOQ 的吞吐对比",
          language: "python",
          code: "def hol_throughput(inputs, outputs, rounds=1000, seed=42):\n    \"\"\"模拟单一 FIFO（队头阻塞）与 VOQ 的吞吐差异（均匀随机流量）\"\"\"\n    import random\n    random.seed(seed)\n    # 单一 FIFO：每输入一个队列，队首决定请求；被占则整队等待\n    def match_simple(queues):\n        matched, busy = [], set()\n        for i in range(inputs):\n            q = queues[i]\n            while q:\n                dst = q[0]\n                if dst not in busy:\n                    busy.add(dst); matched.append((i, dst)); q.pop(0)\n                    break\n                q.append(q.pop(0))      # 队首被占：转一圈放队尾（近似阻塞语义）\n                break\n        return matched\n    # VOQ：每输入按输出分队列，每轮贪心匹配不冲突对\n    def match_voq(voqs):\n        matched, busy_in, busy_out = [], set(), set()\n        for i in range(inputs):\n            for o in range(outputs):\n                if voqs[i][o] and i not in busy_in and o not in busy_out:\n                    matched.append((i, o)); voqs[i][o] -= 1\n                    busy_in.add(i); busy_out.add(o)\n                    break\n        return matched\n    import statistics\n    simple_t = 0; voq_t = 0\n    sq = [[0] for _ in range(inputs)]\n    vq = [[0]*outputs for _ in range(inputs)]\n    for _ in range(rounds):\n        for i in range(inputs):\n            dst = random.randrange(outputs)\n            sq[i].append(dst); vq[i][dst] += 1\n        simple_t += len(match_simple(sq))\n        voq_t += len(match_voq(vq))\n    return simple_t/rounds, voq_t/rounds\n\ns, v = hol_throughput(4, 4)\nprint(f\"单 FIFO 每拍吞吐 {s:.2f}，VOQ {v:.2f}（上限 4）\")",
          explanation:
            "模拟把「队头阻塞」变成了可测量的数字：均匀随机流量下，单一 FIFO 输入队列的 4×4 crossbar 每拍只能匹配约 2.2 对（理论 58% 的经典结论），而 VOQ 让每个输入可以为不同输出同时排队的机制把吞吐拉到接近上限。这是「排队结构本身就是算法」的范例——调度算法再聪明，队列形态不对也救不回吞吐。",
        },
        practiceSteps: [
          "运行队头阻塞模拟，把输入输出数改成 8×8 对比两者的差距。",
          "用 tc 与 ip route 观察一台 Linux 路由器的转发表与 FIB 硬件卸载（若支持）。",
          "读 OpenFlow 交换机规范，把转发平面的五步映射到流表的匹配-动作模型。",
          "抓一个 traceroute 的 TTL 行为，定位每跳路由器的类型（家用/运营商/核心）。",
        ],
        masteryChecklist: [
          "能画出路由器转发平面的五步流水线并指出各段技术。",
          "能解释队头阻塞的成因与 VOQ 的消除机制。",
          "能说明最长前缀匹配为什么需要 TCAM/树而不是普通哈希。",
        ],
        summary: [
          "路由器两平面：控制算表（慢、软），转发查表交换（快、硬）。",
          "查表是最长前缀匹配，TCAM 一步到位但按位贵。",
          "交换结构决定吞吐上限，队头阻塞用 VOQ + 调度算法消除。",
          "控制/转发分离的程度，是理解 SDN 的知识前置。",
        ],
        terms: [
          {
            term: "最长前缀匹配",
            plain: "多条路由都命中时，选前缀最长的那个。",
            detail: "CIDR 的配套查表语义。TCAM 并行比较所有条目、硬件选最长命中；软件用前缀树。",
          },
          {
            term: "交换结构",
            plain: "把包从输入端口搬到输出端口的内部公路。",
            detail: "共享内存式简单受限于内存带宽；crossbar 并行度高但要解决输入输出配对（匹配问题）。",
          },
          {
            term: "队头阻塞（HOL）",
            plain: "队首包堵在一个忙输出端，队里去别的输出的包全部连坐。",
            detail: "单一 FIFO 输入队列的 crossbar 吞吐上限只有约 58%。VOQ 按输出分队列后解除。",
          },
          {
            term: "VOQ",
            plain: "虚拟输出队列：每个输入端口按「去往哪个输出」分成多条队列。",
            detail: "配合调度算法（iSLIP）每轮匹配尽量多的无冲突输入-输出对，吞吐逼近 100%。",
          },
        ],
      },
    },
    questions: [
      {
        key: "computer-networking-exp-net-router-architecture-s1",
        stageKey: "net-routing-stage",
        topicKey: "net-router-architecture",
        type: "single",
        stem: "采用单一 FIFO 输入队列的 4×4 crossbar 路由器，在均匀随机流量下的吞吐上限远低于 100%，其根本原因是？",
        options: [
          { key: "A", text: "crossbar 的开关矩阵无法同时建立多条通路" },
          { key: "B", text: "队头阻塞：每个输入队列的队首包如果去往忙输出端，队内去往空闲输出端的包也被卡住" },
          { key: "C", text: "路由查表的 TCAM 速度跟不上包到达速率" },
          { key: "D", text: "输出端口的链路速率低于输入端口之和" },
        ],
        answer: ["B"],
        explanation:
          "队头阻塞（HOL）的机制：单一 FIFO 下每输入每拍只能请求队首包的目标输出；若该输出正被别的输入占用，即使本队列后面排着去往空闲输出的包，也全部被队首连坐等待。均匀随机流量下 4×4 crossbar 的单 FIFO 吞吐经典结论是约 58%。解法是 VOQ——每个输入按目标输出分多条队列，调度器每轮在「不冲突」的输入-输出对之间配对，吞吐可逼近 100%。A 错误：crossbar 恰恰支持多条不相交通路同时接通；C 与 D 是另外两种瓶颈，不是本问的机制。",
        difficulty: "hard",
        tags: ["队头阻塞", "VOQ", "交换结构"],
        sourceKey: "system-design-primer",
        level: "综合",
      },
      {
        key: "computer-networking-exp-net-router-architecture-j1",
        stageKey: "net-routing-stage",
        topicKey: "net-router-architecture",
        type: "judge",
        stem: "路由器查转发表时使用最长前缀匹配而不是精确匹配，因此普通的哈希表无法直接用于转发表查找。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "精确匹配（哈希的强项）要求「键完全相等」，而 CIDR 路由的语义是：目的地址可能同时命中多条前缀（如 /16 与 /24 都包含它），必须选前缀最长的那条。哈希只能回答「这个完整键在不在」，无法回答「所有包含我的前缀里谁最长」——除非把每个可能长度的前缀都各查一次哈希（32 次查询，慢）。硬件的答案是 TCAM：每个条目带通配位，一次并行比较查出所有命中前缀并按优先级选出最长；软件路由器则用前缀树的各种压缩变体。查表语义决定数据结构，这是转发平面设计的起点。",
        difficulty: "medium",
        tags: ["最长前缀匹配", "TCAM", "查表"],
        sourceKey: "linux-kernel",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "computer-networking",
    stageKey: "net-routing-stage",
    topic: {
      key: "net-virtual-circuit-datagram",
      title: "虚电路与数据报：网络层的两种服务观",
      summary:
        "网络层给传输层什么服务？数据报派（互联网）：每个包自带地址独立路由，网络简单、故障自适应，可靠性交给端系统；虚电路派（ATM/X.25）：先建连接、按标签沿固定路径走，网络复杂但服务质量可控。",
      concepts: ["数据报服务", "虚电路（VC）建立与拆除", "标签交换与 VCI", "端系统与网络的职责划分", "端到端原则"],
      principles: [
        "数据报：无连接、每个包独立查表转发，路径可随拓扑变化切换；路由器状态少，包可能乱序丢包。",
        "虚电路：先信令建连接（全路径预留标签），后续包只带短标签按预计算路径走；交换机状态多（每连接一条），路径固定则故障需重建。",
        "标签交换的效率优势：查表从最长前缀匹配退化为精确匹配一个短标签——MPLS 就是把虚电路标签思想搬回 IP 世界的工程产物。",
        "端到端原则：网络保持简单、功能放到端系统——互联网的宪法。虚电路派认为网络应该提供保证，两派之争决定了 40 年的协议史。",
      ],
      applications: [
        "互联网全是数据报；ATM 与帧中继是虚电路的商业兴衰史。",
        "MPLS 在 IP 网里用标签交换实现流量工程与 VPN——虚电路思想的实用化回归。",
        "TCP 在端系统里用确认重传补齐数据报网络的所有缺口——把可靠性放在端上是端到端原则的胜利。",
      ],
      pitfalls: [
        "以为虚电路像电路交换一样独占带宽——它是逻辑连接，带宽可以统计复用，区别在于路径固定与标签寻址。",
        "把 TCP 连接当成网络层虚电路：TCP 是端到端的传输层抽象，中间路由器对它一无所知；虚电路的中间节点每台都维护连接状态。",
        "忽视数据报网络的乱序代价：路径切换时同流包走不同路径会乱序到达，TCP 的重排序缓冲在为此买单。",
      ],
      method:
        "对比题固定四个维度：建连开销、每包开销（地址 vs 标签）、节点状态（无 vs 每连接）、故障行为（自适应重路由 vs 需重建）。",
      exercise:
        "对比一次 1000 包的传输在数据报与虚电路两种服务下的行为：建连信令、每包的查表方式、链路断开后的恢复动作，以及可靠性分别由谁负责。",
      checkpoint: "能从四个维度对比两种服务，能解释端到端原则为何 favor 数据报，能说出 MPLS 与虚电路的关系。",
      lesson: {
        overview: [
          "设计网络层的第一个哲学问题是：网络应该「记住」通信吗？数据报派说不要——每个包自带完整地址、独立路由，网络像邮局一样无状态；虚电路派说要——先建一条逻辑管道，之后每个包只带个短标签沿管道走，网络像电话网一样有状态。这个选择决定了地址长度、查表方式、故障行为与设备复杂度的全部差异。",
          "两派的胜负由互联网裁决：数据报网络的「简单内核 + 聪明端点」活了下来，端到端原则（智能在端、网络保持简单）成为互联网宪法。但虚电路的思想没有死——MPLS 把「标签交换」嫁接回 IP 网，运营商用它做流量工程与 VPN；SDN 的流表也是「先算好路径、按表转发」的虚电路回声。",
          "对学习者来说，这一课的价值在于对比思维：建连开销 vs 每包开销、节点状态 vs 端状态、自适应 vs 可控质量。任何「连接型 vs 无连接型」的系统设计（包括传输层的 TCP/UDP、消息队列的会话模式）都可以套用这四个维度来分析。",
        ],
        mechanism: [
          "数据报的每包流程：路由器查最长前缀匹配 → 选下一跳 → TTL 减一转发。节点不认识「连接」，同一 TCP 流的包可能走不同路径、乱序到达，可靠性由端系统 TCP 的确认重传兜底。故障自适应是免费的：路由器重新收敛后，后续包自动走新路。",
          "虚电路的三阶段：建立（信令沿路预留标签与资源，每台交换机记录 <入端口,入标签> → <出端口,出标签>）→ 数据（包只带短标签，交换机精确查表替换标签并转发）→ 拆除（释放每跳状态）。查表是 O(1) 的精确匹配，标签长度只有几十位——这就是 ATM 小信元头的效率来源。",
          "故障行为对比：数据报网络断一条链路，路由协议重收敛，在途包丢失但后续包走新路——应用短暂抖动后自愈；虚电路断链则该 VC 全部报废，必须信令重建（ATM 的 SVC）或事先预置备用路径（PVP）。可靠性责任的归属是两派的本质分歧。",
          "MPLS 的合流：在 IP 路由器之间插入标签交换层——入口路由器（LER）给包贴标签，核心路由器（LSR）只查标签转发，出口弹出标签恢复 IP。它不是取代 IP，而是给 IP 网加上「虚电路式的快速通道」，用于流量工程、快速重路由与 L3VPN——数据报底座上按需生长的虚电路能力。",
        ],
        example: {
          title: "一次 1000 包传输的两种服务行为对比",
          language: "text",
          code: "数据报服务（互联网现状）：\n  建连：无。每包带完整目的地址（源也用于返回包）。\n  查表：每跳每包做最长前缀匹配（TCAM/树）。\n  断链：路由协议收敛（秒级），后续包自动改道；\n        在途包丢失 → TCP 重传兜底。可靠性责任：端系统。\n\n虚电路服务（ATM/MPLS 风格）：\n  建连：信令包沿路径预留（毫秒级），每跳记录标签映射表。\n  查表：每跳每包精确匹配一个短标签（O(1)，硬件友好），替换标签转发。\n  断链：该 VC 沿途状态作废 → 信令重建或切换备用路径；\n        可靠性/带宽保证可在建连时协商（网络承诺）。\n\n1000 包的账：数据报省 1 次建连、每包贵在查表；\n虚电路花 1 次建连、每包省在标签——包数越多，建连摊薄越划算。",
          explanation:
            "对比的账本取决于「流的长度与包数」：短流（几个包）建连开销不划算，数据报零成本直发；长流（成千上万包）标签交换的查表效率与路径稳定性开始赢——这正是 MPLS 部署在「骨干长流」而非「接入短流」的原因。端到端原则再补一刀：可靠性放在 TCP 端系统，网络无论数据报还是虚电路都不必保证不丢——两派在这一点上最终握手。",
        },
        practiceSteps: [
          "画一张四维度对比表（建连/每包/状态/故障），填入数据报与虚电路的行为。",
          "在支持 MPLS 的设备上 trace 一条 LSP，观察标签在每跳的替换过程。",
          "用 tcpdump 观察路由收敛时同一 TCP 流的包路径变化，体会数据报的自适应。",
          "读端到端原则的原始论文摘要，把它与「网络提供保证」的设计对照。",
        ],
        masteryChecklist: [
          "能从建连、每包开销、节点状态、故障行为四个维度对比两种服务。",
          "能解释端到端原则及其对数据报派胜利的意义。",
          "能说出 MPLS 是虚电路标签思想在 IP 网的工程回归。",
        ],
        summary: [
          "数据报无状态自适应，可靠性交给端系统；虚电路有状态可控，故障需重建。",
          "虚电路的标签查表 O(1)，数据报的前缀匹配较贵。",
          "TCP 的端到端可靠让网络得以保持简单。",
          "MPLS = 数据报底座上按需生长的标签交换（虚电路思想回归）。",
        ],
        terms: [
          {
            term: "数据报",
            plain: "自带完整地址、独立选路的包，网络不记它是谁。",
            detail: "互联网的基本单元。乱序、丢包、路径切换都是它的常态，可靠性由端系统负责。",
          },
          {
            term: "虚电路（VC）",
            plain: "先建一条逻辑管道，之后每个包只带短标签沿管道走。",
            detail: "建连预留每跳状态，路径固定。ATM/X.25 的服务模型，MPLS 是它的现代形态。",
          },
          {
            term: "端到端原则",
            plain: "功能尽量放到端系统，网络保持简单。",
            detail: "互联网的宪法级设计原则。可靠传输、加密、纠错都长在端上，网络只做搬运。",
          },
          {
            term: "MPLS",
            plain: "在 IP 包前面贴个短标签，路由器按标签而不是按 IP 查表转发。",
            detail: "标签交换让骨干网的查表变成 O(1)，并支持流量工程与快速重路由——虚电路思想的工程胜利。",
          },
        ],
      },
    },
    questions: [
      {
        key: "computer-networking-exp-net-virtual-circuit-datagram-s1",
        stageKey: "net-routing-stage",
        topicKey: "net-virtual-circuit-datagram",
        type: "single",
        stem: "关于数据报服务与虚电路服务的对比，下面哪项说法正确？",
        options: [
          { key: "A", text: "虚电路的每个包必须携带完整的目的地址，因为中间节点不保存任何状态" },
          { key: "B", text: "数据报网络中链路断开时，路由协议重新收敛后后续包自动走新路；虚电路断链则该连接需要信令重建" },
          { key: "C", text: "虚电路的查表开销比数据报的前缀匹配更大，因为要维护每连接状态" },
          { key: "D", text: "数据报服务能提供带宽保证，虚电路不能" },
        ],
        answer: ["B"],
        explanation:
          "故障行为是两派最尖锐的差异：数据报的节点无连接状态，路由收敛后包自动改道（在途包可能丢失，交给端系统重传）；虚电路的每跳状态随路径存在，路径断了连接就断，必须信令重建或预先备好备用路径。A 说反——虚电路的包只带短标签（这正是它查表快的原因），数据报才带完整地址；C 说反——虚电路是精确匹配短标签 O(1)，数据报是最长前缀匹配；D 说反——带宽保证恰恰是虚电路派（ATM）的核心卖点，数据报网络只有尽力而为。",
        difficulty: "medium",
        tags: ["数据报", "虚电路", "对比"],
        sourceKey: "system-design-primer",
        level: "进阶",
      },
      {
        key: "computer-networking-exp-net-virtual-circuit-datagram-j1",
        stageKey: "net-routing-stage",
        topicKey: "net-virtual-circuit-datagram",
        type: "judge",
        stem: "TCP 连接与虚电路在机制上是同一种东西：都是先建立连接、再用短标识转发数据，因此路由器需要为每条 TCP 连接维护转发状态。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "TCP 连接是端到端的传输层抽象：四元组（源 IP、源端口、目的 IP、目的端口）只存在于两端的操作系统中，中间路由器看到的每个包都是独立的数据报——它们不认识也不需要认识任何 TCP 连接，更不会为它维护转发状态。虚电路则要求路径上的每台交换机都保存 <入标签→出标签> 的映射表。这正是「端到端原则」的具体体现：TCP 用确认重传在自己的两端补齐可靠性，让路由器保持无状态、简单、可扩展——互联网每秒数十亿流的状态如果都要路由器存，骨干早就崩溃了。",
        difficulty: "medium",
        tags: ["TCP", "端到端原则", "虚电路"],
        sourceKey: "linux-kernel",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "computer-networking",
    stageKey: "net-link-tools-stage",
    topic: {
      key: "net-hub-bridge-router",
      title: "集线器、交换机与路由器：冲突域与广播域",
      summary:
        "三件设备的三条分界线：集线器（物理层）所有端口共享一个冲突域；交换机（链路层）每个端口独立冲突域但全网一个广播域；路由器（网络层）既隔离冲突域也隔离广播域。VLAN 是在交换机上人为切广播域的手段。",
      concepts: ["冲突域", "广播域", "设备工作的协议层", "VLAN 切分广播域", "三层交换"],
      principles: [
        "冲突域：信号可能互相碰撞的范围。集线器把所有端口接在同一个电气总线上，全设备一个冲突域；交换机每端口独立收发缓冲，冲突域为 1。",
        "广播域：广播帧能到达的范围。交换机对广播帧泛洪到所有端口（VLAN 内），路由器不转发广播——每接一个路由器接口就多一个广播域。",
        "设备分层：集线器只放大信号（物理层），交换机按 MAC 转发（链路层），路由器按 IP 转发（网络层）；三层交换机把路由功能做进 ASIC，让 VLAN 间的转发也跑线速。",
        "VLAN 把一台物理交换机切成多台逻辑交换机：每个 VLAN 是独立的广播域，VLAN 间通信必须经过路由（或三层交换）。",
      ],
      applications: [
        "办公网按部门切 VLAN（财务/研发/访客），广播隔离 + 策略边界一步到位。",
        "数据中心大二层为什么难：广播域越大，ARP 泛洪与风暴半径越大——这是 Overlay 网络兴起的动因。",
        "排障定位法：先判断故障是否跨越广播域（交换机层解决不了的就要查路由）。",
      ],
      pitfalls: [
        "以为交换机隔离广播——它只隔离冲突域；广播帧照样泛洪全网，环路还会造成广播风暴。",
        "把 VLAN 当安全边界一劳永逸：VLAN 跳跃攻击、跨 VLAN 的 ACL 配置失误都是真实攻击面。",
        "集线器时代已远但概念仍在：Wi-Fi 的共享介质本质上是一个无线的「冲突域」（CSMA/CA 在仲裁它）。",
      ],
      method:
        "判断广播域数量固定套路：数路由器接口数（每个接口一个广播域）+ 数 VLAN（每个 VLAN 一个），交换机与集线器不增加广播域。",
      exercise:
        "拓扑：路由器 R 的两个接口分别接交换机 S1、S2；S1 上划 VLAN 10 与 VLAN 20，S2 上接 5 台主机。问：冲突域数量、广播域数量各是多少？若 S1 的 VLAN 10 与 VLAN 20 要通信，流量必须经过谁？",
      checkpoint: "能对给定拓扑准确数出冲突域与广播域，能解释 VLAN 间通信为何必须经过三层。",
      lesson: {
        overview: [
          "网络设备的分类不是按价格，而是按「它工作在第几层、隔离了什么」。集线器工作在比特层：它只是把信号放大转发给所有端口，所有接入者共享一条逻辑总线——CSMA/CD 的冲突域覆盖全网。交换机读懂 MAC 地址：每个端口有独立的收发缓冲，冲突域被切成每端口一个；但广播帧（目的 MAC 全 1）它依然泛洪——广播域还是一整个。",
          "路由器读 IP：广播帧到它为止（不转发 255.255.255.255 与子网广播），每接一个接口就切出一个新的广播域。冲突域与广播域这两个概念，本质是在回答两个问题：「谁的发送会互相干扰」（物理与链路层问题）与「谁的广播能被听见」（网络层边界）。VLAN 则是交换机提供的逻辑切刀——物理上一台设备，逻辑上多台互不相通的交换机。",
          "三层交换机是「交换机的速度 + 路由器的脑子」的合体：VLAN 间流量在芯片里直接查路由表转发，不必绕到外置路由器。数据中心里每个机柜的 leaf 交换机都是三层交换，spine-leaf 架构让任意两层之间只隔两跳——广播域小而路由路径短，这正是现代数据中心网络对这两个概念的工业化答案。",
        ],
        mechanism: [
          "集线器与冲突域：它不懂 MAC，收到比特就复制广播（物理层中继）。两台同时发送即碰撞，CSMA/CD 在整个集线器范围内仲裁——所有端口构成一个冲突域，总容量被所有设备均分。",
          "交换机与 MAC 学习：收到帧记录源 MAC 与端口映射（学习表），目的 MAC 已知则定向转发、未知则泛洪；广播与多播（未 snooping）泛洪。每端口独立缓冲与全双工收发使冲突域退化为「端口自己」——全双工下碰撞概念消失。",
          "路由器切广播域：广播帧的目的地址不可路由（链路本地），路由器收到即丢弃——两个接口天然是两个广播域。它同时是 DHCP/ARP 的边界：跨网段的地址分配要 DHCP 中继，跨网段的地址解析要代理 ARP 或直接走网关。",
          "VLAN 与三层交换：802.1Q 在帧里插 4 字节标签，交换机按标签限定泛洪与转发范围；VLAN 间通信需要三层网关（路由器接口或交换机的 SVI 虚接口）。三层交换机的 SVI 用 ASIC 查路由表，把「跨 VLAN 网关」也做到线速——这是它对「路由器 + 交换机」分离架构的核心优势。",
        ],
        example: {
          title: "拓扑中的域计数",
          language: "text",
          code: "拓扑：\n  R（路由器）\n  ├── 接口1 ── S1（划 VLAN 10 / VLAN 20，各接 3 台主机）\n  └── 接口2 ── S2（接 5 台主机，未划 VLAN）\n\n冲突域计数（每个交换机端口一个）：\n  S1：6 个主机端口 + 1 个上联 R = 7\n  S2：5 个主机端口 + 1 个上联 R = 6\n  （若上联链路是全双工，链路本身也是独立冲突域）\n  合计 13 个冲突域\n\n广播域计数（每个三层接口/VLAN 一个）：\n  S1 的 VLAN 10 → 1 个（R 接口1 的子接口/VLAN10 网关）\n  S1 的 VLAN 20 → 1 个\n  S2 → 1 个（R 接口2）\n  合计 3 个广播域\n\nVLAN10 与 VLAN20 通信必须经 R（或 S1 的三层功能）：\n  它们是两个广播域，二层无法直达。",
          explanation:
            "数域的口诀：冲突域按交换机端口数（全双工每链路一个），广播域按三层接口数（路由器接口 + 每个 VLAN 的 SVI）。VLAN 不增加广播域之外的东西——它只是把一台交换机的广播域切成多个；切完之后的通信必须上三层。把这张图数熟，任何拓扑题都只是元素更多而已。",
        },
        practiceSteps: [
          "对自己所在的局域网数广播域：数路由器接口与 VLAN，用抓包的广播帧源验证。",
          "在交换机上把两个端口划进不同 VLAN，验证它们无法二层互通。",
          "构造交换机环路并开启/关闭 STP，观察广播风暴的量级差异（实验室环境！）。",
          "用 ip neigh 与 arp -a 观察 ARP 的边界：跨广播域的地址永远解析不到。",
        ],
        masteryChecklist: [
          "能对给定拓扑准确数出冲突域与广播域的数量。",
          "能解释集线器/交换机/路由器各自工作的层次与隔离能力。",
          "能说明 VLAN 与三层交换如何分工解决广播域切分与 VLAN 间通信。",
        ],
        summary: [
          "集线器共享冲突域，交换机隔离冲突域不隔离广播域，路由器两者都隔离。",
          "广播域数 = 路由器接口数 + VLAN 数（SVI）。",
          "VLAN 间通信必须过三层；三层交换机把它做到线速。",
          "广播域越大，ARP 泛洪与风暴半径越大——分层切分是结构性需求。",
        ],
        terms: [
          {
            term: "冲突域",
            plain: "谁的发送会跟谁撞车：共享介质与半双工链路的范围。",
            detail: "交换机全双工后冲突域退化为每链路一个，碰撞概念在交换式网络里基本消失。",
          },
          {
            term: "广播域",
            plain: "一个广播帧能到达的全体主机的边界。",
            detail: "由路由器接口与 VLAN 划界。广播域越大，ARP 泛洪、风暴半径与安全边界问题越大。",
          },
          {
            term: "VLAN",
            plain: "在一台物理交换机上切出的多个逻辑交换机。",
            detail: "802.1Q 标签隔离泛洪与转发；VLAN 间通信必须经三层网关——既是性能切分也是策略边界。",
          },
          {
            term: "三层交换（SVI）",
            plain: "交换机内置的路由功能：每个 VLAN 一个虚拟网关接口。",
            detail: "跨 VLAN 流量在芯片内直接查路由转发，不必绕外置路由器——线速 + 少一跳。",
          },
        ],
      },
    },
    questions: [
      {
        key: "computer-networking-exp-net-hub-bridge-router-s1",
        stageKey: "net-link-tools-stage",
        topicKey: "net-hub-bridge-router",
        type: "single",
        stem: "路由器 R 的两个接口分别接交换机 S1（划 VLAN 10/20，各接 3 台主机）与 S2（接 5 台主机）。该拓扑中广播域的数量是？",
        options: [
          { key: "A", text: "2 个：路由器的两个接口各一个" },
          { key: "B", text: "3 个：VLAN 10、VLAN 20 与 S2 各一个" },
          { key: "C", text: "8 个：每台主机一个" },
          { key: "D", text: "1 个：所有交换机端口共享" },
        ],
        answer: ["B"],
        explanation:
          "广播域按三层边界计数：R 的接口 1 通过子接口/SVI 同时做 VLAN 10 与 VLAN 20 的网关——这是两个独立广播域；接口 2 所在的 S2 是第三个。交换机端口数量与主机数量不改变广播域数——交换机隔离冲突域不隔离广播域，VLAN 才是交换机上切广播域的刀。口诀：广播域数 = 路由器三层接口数（含每个 VLAN 的 SVI）。冲突域则是另一套计数（每交换机端口一个，约 13 个）。",
        difficulty: "medium",
        tags: ["广播域", "VLAN", "拓扑计算"],
        sourceKey: "wireshark",
        level: "进阶",
      },
      {
        key: "computer-networking-exp-net-hub-bridge-router-j1",
        stageKey: "net-link-tools-stage",
        topicKey: "net-hub-bridge-router",
        type: "judge",
        stem: "把一台交换机划分为多个 VLAN 后，不同 VLAN 的主机之间只要还接在同一台交换机上，就可以直接通过二层转发通信。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "VLAN 的定义就是把广播域切开：每个 VLAN 是独立的广播与转发域，交换机的二层转发表按 VLAN 隔离——VLAN 10 的帧永远不会被转发进 VLAN 20。跨 VLAN 的通信必须经过三层设备（路由器接口或交换机自身的 SVI 网关）做一次路由：换源/目的 MAC、TTL 减一。这个「必须过三层」既是隔离的手段也是策略的抓手——ACL 在网关处对 VLAN 间流量做统一管控。所以 VLAN 不是纯粹的物理分组，而是广播域 + 策略边界的复合设计。",
        difficulty: "easy",
        tags: ["VLAN", "三层转发"],
        sourceKey: "wireshark",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "computer-networking",
    stageKey: "net-link-tools-stage",
    topic: {
      key: "net-qos",
      title: "QoS：漏桶、令牌桶与队列调度",
      summary:
        "尽力而为的网络要给关键流量「开小灶」：令牌桶限平均速率、允许受控突发；漏桶把输出削成恒定速率；队列调度决定谁先谁后。两者组合（整形 + 策略）是运营商与企业的标准武器。",
      concepts: ["漏桶整形", "令牌桶限速", "突发容忍计算", "WFQ/优先级队列", "DiffServ 边界标记"],
      principles: [
        "令牌桶：以恒定速率 ρ 生成令牌入桶（容量 C），发包前取令牌——桶满时可以以线速突发发 C 的量，长期平均被钉在 ρ。",
        "漏桶：数据先入队列，以恒定速率 μ 匀速漏出——输出绝无突发，输入的波动被完全平滑；超队列容量则丢弃。",
        "令牌桶 vs 漏桶：前者「允许突发、限平均」（对突发友好），后者「彻底平滑、绝不突发」（对下游友好）；两者可串联成「先限突发再平滑」。",
        "队列调度决定共享公平性：优先级队列（高优先级永远先走，低优先级可能饿死）、WFQ（按权重分带宽）、RED（提前随机丢包防全局同步）。",
      ],
      applications: [
        "企业出口对 P2P/视频限速（令牌桶钉住平均值）、对 VoIP 保障带宽（优先级队列 + 低延迟队列）。",
        "运营商对用户承诺速率（CIR）用令牌桶计量，超出部分标记为可丢弃（DiffServ 的 AF 类）。",
        "API 网关与消息队列的限流器几乎都是令牌桶的软件实现——思想已溢出到纯软件领域。",
      ],
      pitfalls: [
        "把令牌桶容量 C 当成「允许的最大速率」——它是一次突发能发的量，长期平均永远被 ρ 钉死。",
        "混淆整形（shaping，缓存超量数据延迟发送）与策略（policing，超量直接丢弃/重标记）——漏桶整形丢延迟，令牌桶策略丢包。",
        "优先级队列的高优先级流不受限时会饿死低优先级——必须给高优限速或改用 WFQ。",
      ],
      method:
        "令牌桶计算题固定三问：突发持续 t = C ÷ (M − ρ)（M 为下游线速）、突发期间发送量 = M × t、长期平均 = ρ。漏桶题输出速率恒为 μ。",
      exercise:
        "出口线速 M = 10Mbps，令牌桶 ρ = 2Mbps、桶容量 C = 1Mbit：(a) 满桶时最大可持续突发多久？期间共发送多少数据？(b) 之后稳态速率是多少？(c) 若改用漏桶输出 2Mbps，突发 4Mbit 的数据需要多久排空？",
      checkpoint: "能推导令牌桶的突发持续时间公式并计算，能对比漏桶与令牌桶的输出形态差异。",
      lesson: {
        overview: [
          "网络的默认服务是尽力而为——不承诺、不区分、先到先得。QoS 要做的就是在尽力而为的底座上做出差别：谁的包先走（队列调度）、谁的包限速（速率控制）、谁的包先丢（丢弃策略）。漏桶与令牌桶是速率控制的两把尺子，刻度不同、用途不同。",
          "令牌桶的图像是「发令牌的 faucet + 存令牌的桶」：令牌以 ρ 的速率滴入桶中，桶最多存 C 个；发一个字节花一个令牌，没令牌就发不了。桶里有存货时可以一口气突发发完——上限是 C；桶空之后只能按 ρ 的补给速率发——长期平均被钉死。突发是「还债式的透支」，透支之后要等桶慢慢回血。",
          "漏桶没有「突发」的概念：所有数据先进队列，出口以恒定 μ 匀速放行——输入再抖，输出纹丝不动。它保护的是下游（比如一条只有 2Mbps 的专线），代价是排队延迟。两者串联（令牌桶整形 + 漏桶平滑）是经典组合：先允许业务合理突发，再把输出削平保护下游。",
          "队列调度回答「桶里排着队的包谁先走」：优先级队列简单粗暴（高优全走完才轮低优，低优可能饿死）；WFQ 按权重分时间片（各流按份额公平）；RED 在队列将满时随机早丢，迫使 TCP 流降速、避免「同时超时-同时重传」的全局同步。三者常组合部署。",
        ],
        mechanism: [
          "令牌桶的突发计算：满桶 C 个令牌，下游线速 M 大于令牌速率 ρ 时，可以以 M 全速发送，同时令牌以 ρ−M 的净速率消耗——从满桶到空桶持续 t = C/(M−ρ)，期间发送 M×t 的数据。之后进入稳态：平均速率恰为 ρ。例：C=1Mbit、M=10Mbps、ρ=2Mbps → t = 1/(10−2) = 0.125s，突发量 1.25Mbit。",
          "漏桶的恒定输出：队列容量 B，输入任意波动，输出恒为 μ。突发 4Mbit 的数据从空队列开始排空需要 4/μ；期间后到的数据若使队列溢出 B 则直接丢弃（整形丢弃或策略丢弃视部署位置）。漏桶的数学就是一个定速出水的水池。",
          "串联使用：令牌桶在前（限制平均与突发）、漏桶在后（平滑输出）是运营商边界常见配置——先保证「不超承诺」再保证「不惊吓下游」。DiffServ 体系把边界上的分类、标记（DSCP）与计量（令牌桶）标准化，核心路由器只按标记做简单调度。",
          "队列调度的饿死与公平：严格优先级（SP）队列里，高优持续到达则低优永不服务——必须给高优限速或用 WFQ。WFQ 按流哈希分队列、按权重分配服务顺序，近似「每流公平分享」；RED 用队列平均长度触发随机丢弃，让各 TCP 流错峰降速——比「满了才丢」的全局同步温和得多。",
        ],
        example: {
          title: "令牌桶突发的完整计算",
          language: "python",
          code: "def token_bucket_burst(C_bits, rho_bps, M_bps):\n    # 满桶起发：净消耗速率 = M - rho，桶空时长 = C / (M - rho)\n    t = C_bits / (M_bps - rho_bps)\n    sent = M_bps * t                    # 突发期间发送量\n    steady = rho_bps                    # 稳态：长期平均被钉在 rho\n    return t, sent, steady\n\ndef leaky_bucket_drain(volume_bits, mu_bps):\n    return volume_bits / mu_bps         # 恒定速率排空\n\nt, sent, steady = token_bucket_burst(1_000_000, 2_000_000, 10_000_000)\nprint(f\"令牌桶：突发 {t:.3f}s，发送 {sent/1e6:.2f}Mbit，稳态 {steady/1e6:.0f}Mbps\")\nprint(f\"漏桶：4Mbit @ 2Mbps 排空 {leaky_bucket_drain(4_000_000, 2_000_000):.1f}s\")\n# 令牌桶：突发 0.125s，发送 1.25Mbit，稳态 2Mbps\n# 漏桶：2.0s",
          explanation:
            "令牌桶的三个数各归其位：突发时长 0.125s（C 除以线速与令牌速率之差）、突发量 1.25Mbit（线速乘时长）、稳态 2Mbps（令牌补给速率——长期平均逃不出它）。同一份 4Mbit 数据走漏桶则要匀速 2 秒排完——输出形态的差别一眼可见：令牌桶「先冲后稳」，漏桶「从头到尾一个速度」。选哪个取决于下游怕不怕突发：怕（低速专线）用漏桶，不怕（宽带出口）用令牌桶。",
        },
        practiceSteps: [
          "手算题面三问，与代码对答案。",
          "把桶容量 C 加倍，观察突发时长线性增长、稳态不变的规律。",
          "在 Linux 上用 tc 的 tbf（令牌桶滤波）限速，iperf 验证突发与稳态。",
          "配置三个优先级队列并灌满高优流量，观察低优队列饿死，再改 WFQ 对比。",
        ],
        masteryChecklist: [
          "能推导并计算令牌桶的突发持续与突发量。",
          "能对比漏桶与令牌桶的输出形态及各自保护的下游。",
          "能说明优先级队列的饿死风险与 WFQ/RED 的对策。",
        ],
        summary: [
          "令牌桶限平均允突发：突发时长 = C/(M−ρ)，稳态 = ρ。",
          "漏桶恒速输出彻底平滑，代价是排队延迟。",
          "整形缓存延迟发，策略直接丢——部署位置决定行为。",
          "调度防饿死：SP 限速、WFQ 加权、RED 随机早丢。",
        ],
        terms: [
          {
            term: "令牌桶",
            plain: "按速率发令牌、按令牌发包的计量器。",
            detail: "桶容量是一次突发的上限，令牌速率是长期平均。API 限流器的标准实现。",
          },
          {
            term: "漏桶",
            plain: "数据进桶、恒速漏出：输出永远平滑。",
            detail: "整形器。它不关心输入多猛，只承诺输出恒定——保护脆弱的下游链路。",
          },
          {
            term: "整形 vs 策略",
            plain: "超量的数据：排队等着（整形）还是直接扔（策略）。",
            detail: "整形加延迟不加丢包（出口侧）；策略立即丢包但零延迟（入边界）。两者常用令牌桶/漏桶分别实现。",
          },
          {
            term: "RED",
            plain: "队列快满时随机丢几个包，提前提醒 TCP 降速。",
            detail: "避免「队列满了大家一起丢、所有 TCP 同时超时重传」的全局同步。随机性是防同步的关键。",
          },
        ],
      },
    },
    questions: [
      {
        key: "computer-networking-exp-net-qos-s1",
        stageKey: "net-link-tools-stage",
        topicKey: "net-qos",
        type: "single",
        stem: "出口线速 10Mbps，令牌桶容量 1Mbit、令牌速率 2Mbps。桶满时开始发送 4Mbit 的数据，突发阶段持续多久？之后进入稳态的平均速率是？",
        options: [
          { key: "A", text: "突发 0.4s；稳态 10Mbps" },
          { key: "B", text: "突发 0.125s；稳态 2Mbps" },
          { key: "C", text: "突发 0.5s；稳态 2Mbps" },
          { key: "D", text: "突发 0.125s；稳态 10Mbps" },
        ],
        answer: ["B"],
        explanation:
          "满桶起发时可以以线速 10Mbps 冲刺，但令牌以 2Mbps 的速率补给、被 10Mbps 的发送以 8Mbps 的净速率消耗——1Mbit 桶存清空耗时 1Mbit ÷ 8Mbps = 0.125s，期间以线速共发送 1.25Mbit。桶空之后每发一个字节都要等新令牌，稳态速率被钉在令牌速率 2Mbps——这就是「允许一次受控突发、长期平均受限」的令牌桶语义。D 忽略了稳态由 ρ 决定；A 的 0.4s 是 C ÷ ρ 的误算（把突发时长按令牌补给速率算）。",
        difficulty: "medium",
        tags: ["令牌桶", "QoS", "计算题"],
        sourceKey: "system-design-primer",
        level: "进阶",
      },
      {
        key: "computer-networking-exp-net-qos-j1",
        stageKey: "net-link-tools-stage",
        topicKey: "net-qos",
        type: "judge",
        stem: "严格优先级队列（SP）会让高优先级流量得到更好的服务质量，因此把所有业务流量都放进高优先级队列是提升整体体验的最优方案。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "SP 的调度规则是「高优队列非空就永远先服务它」——当所有流量都被标为高优时，规则退化为「谁先到谁先走」，与没有 QoS 无异；更糟的是失去了对关键业务（语音/视频）的保障能力。正确做法是分层：极少数确实时延敏感的流量（VoIP）进低延迟队列并给它限速（防止它吃满），其余流量按 WFQ 加权公平分享。QoS 的本质是「稀缺时牺牲谁」的显式决策，把所有流量都供起来等于没有决策。",
        difficulty: "easy",
        tags: ["队列调度", "优先级饿死", "WFQ"],
        sourceKey: "system-design-primer",
        level: "入门",
      },
    ],
  },
];
