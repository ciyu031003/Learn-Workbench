/**
 * 网络工程 · 知识点扩容（2026-10-17）。
 *
 * 覆盖 VLAN/Trunk、生成树、链路聚合、静态路由与 OSPF、ACL 与 NAT、分层排障六个方向，
 * 追加到课程已有的 net-lan / net-security / net-automation 阶段，不改动原课程大文件。
 * 内容口径：讲透、讲准、给细节；术语配人话解释；每节给出可复述小结。
 */
import type { TopicExpansion } from "./topic-expansions";

export const networkEngineeringTopicExpansions: TopicExpansion[] = [
  {
    trackSlug: "network-engineering",
    stageKey: "net-lan",
    topic: {
      key: "net-vlan-trunk",
      title: "VLAN 与 Trunk 端口配置",
      summary:
        "VLAN 把一台交换机切成多个互不广播的二层网络，Trunk 用 802.1Q 标签把归属带到对端；端口模式、允许列表与 Native VLAN 必须三对齐，否则只会断掉一部分 VLAN。",
      concepts: ["广播域与 VLAN", "Access 与 Trunk", "802.1Q 标签与 PVID", "Native VLAN"],
      principles: [
        "Access 端口只承载一个 VLAN：收无标签帧时打上 PVID，发往终端前把标签剥掉。",
        "Trunk 端口按标签归类入站帧，未打标的帧归入 Native VLAN，出站时除 Native VLAN 外都带标签。",
        "允许列表决定哪些 VLAN 能通过这条链路：配窄了断个别 VLAN，配成全部则隔离失效。",
      ],
      applications: [
        "按部门或用途划分 VLAN，跨交换机用 Trunk 汇聚到核心。",
        "访客与办公分属不同 VLAN，用三层网关与策略控制互访范围。",
      ],
      pitfalls: [
        "两端 Trunk 允许列表不一致，表现为个别 VLAN 不通而链路指示灯正常。",
        "两端 Native VLAN 不同，未打标流量被塞进错误的广播域。",
        "把接终端的端口配成 Trunk 并放通全部 VLAN，等于给终端开放整网二层。",
      ],
      method:
        "先按隔离需求定 VLAN 编号与网关位置，再统一定义 Trunk 的允许列表和 Native VLAN，最后逐跳核对两端配置与标签行为。",
      exercise:
        "为两个部门加一个访客网络设计 VLAN 与 Trunk：写出两端端口配置、允许列表、Native VLAN，并说明跨交换机同 VLAN 通信时标签如何变化。",
      checkpoint:
        "能解释一台终端发出的无标签帧经过 Access 与 Trunk 时标签如何变化，并指出两端不一致会断掉哪个 VLAN。",
      lesson: {
        overview: [
          "VLAN 的本质是把一台物理交换机切成多个互不广播的二层网络。端口划分只是把终端放进某个广播域，真正让身份跨设备传递的是 802.1Q 标签：交换机在帧头插入 4 个字节，用其中 12 位表示 VLAN ID。理解标签在哪一段存在、在哪一段被剥掉，比背下配置命令重要得多，因为绝大多数跨交换机故障都出在标签处理上。",
          "很多现场故障不是 VLAN 编号写错，而是两端对标签的处理方式不一致：一端打标、另一端剥标，或者两端允许列表不同，包在途中就换了身份或被直接丢弃。这类问题通常表现为部分 VLAN 不通、其它 VLAN 一切正常，最容易被误判成线路或终端故障，于是换网线、换端口，时间全花在错误的方向上。",
          "配置时要同时对齐三件事：端口模式、允许通过的 VLAN 列表、Native VLAN。三者只要有一项不一致，结果往往不是全断而是局部不通：同一个 VLAN 里一部分终端好、一部分不通，排查时很容易在错误的层次上打转。这种半好半坏的现象最容易让人在错误的层次上打转，真正该做的是把两端的标签处理逐项对照，而不是先换硬件。",
        ],
        mechanism: [
          "Access 端口只属于一个 VLAN：收到无标签帧时按本端口 PVID 打上标签再送入交换芯片，发往终端时把标签剥掉。终端对 VLAN 一无所知，它看到的永远是最普通的无标签以太网帧，因此换一个 Access 端口就等于换了一个网络归属。",
          "Trunk 端口收帧时先看有没有标签：带标签的按标签归入对应 VLAN，不带标签的一律归入 Native VLAN；出站时除 Native VLAN 外全部带上标签再发出。两端 Native VLAN 不一致，就会把对方的无标签帧塞进错误的广播域，表现为地址冲突、时通时断或者干脆不通。",
          "允许列表决定哪些 VLAN 的帧可以从这条 Trunk 通过：列表配窄，对应 VLAN 跨交换机不通；配成全部，则连访客、管理这些本应隔离的广播域也一起扩散过去，隔离设计形同虚设。列表应显式列出业务 VLAN，并随规划变更同步维护。",
        ],
        example: {
          title: "两台交换机的 Access 与 Trunk 配置",
          language: "text",
          code: "SW1(config)# vlan 10\nSW1(config-vlan)# name office\nSW1(config)# vlan 20\nSW1(config-vlan)# name guest\nSW1(config)# interface GigabitEthernet1/0/1\nSW1(config-if)# switchport mode access\nSW1(config-if)# switchport access vlan 10\nSW1(config)# interface GigabitEthernet1/0/24\nSW1(config-if)# switchport mode trunk\nSW1(config-if)# switchport trunk native vlan 99\nSW1(config-if)# switchport trunk allowed vlan 10,20\nSW1# show interfaces trunk",
          explanation:
            "接终端的端口配成 Access 并绑定 VLAN 10，上联端口配成 Trunk 并显式列出允许通过的 VLAN。关键是两端 allowed vlan 与 native vlan 必须写成同一份清单，否则 show interfaces trunk 里会看到一侧放通、另一侧拒绝。最后用 show interfaces trunk 核对模式、Native VLAN 与允许列表三列。",
        },
        practiceSteps: [
          "先按部门与用途列出 VLAN 编号、网关位置和允许互访关系。",
          "在接入交换机上把终端端口配成 Access 并绑定 VLAN，上联口配成 Trunk。",
          "两端 Trunk 显式写出 allowed vlan 列表，并统一 Native VLAN。",
          "用 show vlan brief 与 show interfaces trunk 核对两端，再跨交换机同 VLAN 互 ping 验证。",
        ],
        masteryChecklist: [
          "能画出每个 VLAN 的广播域边界，并说出哪些端口在其内部。",
          "能根据 show interfaces trunk 的输出判断允许列表与 Native VLAN 是否两端一致。",
        ],
        summary: [
          "VLAN 定义广播域，标签负责跨设备传递归属。",
          "Access 打标入、剥标出；Trunk 按标签归类，Native VLAN 不打标。",
          "允许列表与 Native VLAN 必须两端一致，不一致的表现是局部不通。",
          "接终端的端口不要配 Trunk，更不要放通全部 VLAN。",
        ],
        terms: [
          {
            term: "PVID",
            plain: "端口默认把没打标签的帧算作哪个 VLAN。",
            detail:
              "Access 口收帧时按 PVID 打标；Trunk 口的 PVID 就是 Native VLAN。两端 PVID 不一致时，无标签帧会落到不同广播域，这种故障往往只影响部分终端。",
          },
          {
            term: "802.1Q 标签",
            plain: "在以太网帧头插 4 个字节，写明这个帧属于哪个 VLAN。",
            detail:
              "其中 12 位是 VLAN ID，另有 3 位优先级。标签只在交换机之间的干道上存在，到终端前会被剥掉，所以终端抓包看不到 VLAN 信息。",
          },
          {
            term: "Native VLAN",
            plain: "Trunk 上唯一不打标签通过的 VLAN。",
            detail:
              "它存在的历史原因是兼容不支持标签的设备。正因为不打标，两端必须一致，否则无标签流量会被归错 VLAN，也常被用作 VLAN 跳变攻击的入口。",
          },
          {
            term: "VLAN 跳变（VLAN Hopping）",
            plain: "攻击者借双层标签把流量塞进不该去的 VLAN。",
            detail:
              "常见成因是把终端口配成 Trunk，或两端 Native VLAN 不一致。防御手段是终端口强制 Access、显式设置 Native VLAN 并禁止它承载业务。",
          },
        ],
      },
    },
    questions: [
      {
        key: "network-engineering-exp-net-vlan-trunk-s1",
        stageKey: "net-lan",
        topicKey: "net-vlan-trunk",
        type: "single",
        stem: "两台交换机之间的 Trunk 链路已 up，VLAN 10 的终端跨交换机正常，VLAN 20 的终端不通。最应先检查什么？",
        options: [
          { key: "A", text: "更换上联光纤与光模块" },
          { key: "B", text: "两端 Trunk 的 allowed vlan 列表与 Native VLAN 是否一致" },
          { key: "C", text: "终端网卡的协商速率" },
          { key: "D", text: "把两端端口都改成 Access" },
        ],
        answer: ["B"],
        explanation:
          "链路 up 且只有个别 VLAN 不通，说明物理层与 Trunk 协商本身正常，问题出在二层的归属处理：先核对两端允许列表是否都放通了 VLAN 20，再看 Native VLAN 与 PVID 是否一致。换线或改端口模式既不能解释为什么 VLAN 10 是好的，还会把故障范围扩大。",
        difficulty: "medium",
        tags: ["VLAN", "Trunk", "二层排障"],
        sourceKey: "napalm",
        level: "进阶",
      },
      {
        key: "network-engineering-exp-net-vlan-trunk-j1",
        stageKey: "net-lan",
        topicKey: "net-vlan-trunk",
        type: "judge",
        stem: "Trunk 端口发送 Native VLAN 的帧时不会携带 802.1Q 标签。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "这正是 Native VLAN 的定义：它是干道上唯一以无标签形式通过的 VLAN。也正因为不打标，两端 Native VLAN 必须一致，否则无标签帧会被对端归入另一个广播域，造成部分终端莫名不通。",
        difficulty: "easy",
        tags: ["Native VLAN", "802.1Q"],
        sourceKey: "wireshark",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "network-engineering",
    stageKey: "net-lan",
    topic: {
      key: "net-stp-loop",
      title: "生成树协议与二层环路",
      summary:
        "二层帧没有 TTL，环路会让广播无限复制直到整网瘫痪；STP 用 BPDU 选出一棵无环树，RSTP 把收敛压到秒级，边缘端口与 BPDU Guard 决定这棵树稳不稳。",
      concepts: ["广播风暴", "根桥与端口角色", "BPDU 与收敛", "边缘端口与防护"],
      principles: [
        "二层没有 TTL，环路中的广播帧会被反复复制，几秒内就能打满链路与设备 CPU。",
        "STP 先选根桥（桥 ID 最小），再为每个网段选根端口与指定端口，剩下的端口阻塞，从而得到无环树。",
        "RSTP 用提议与同意机制快速收敛，并把不接交换机的端口标为边缘端口，避免终端插拔触发拓扑计算。",
      ],
      applications: ["双上联冗余设计", "接入层防环", "变更后的环路排查"],
      pitfalls: [
        "双上联只做了链路冗余却没启用 STP，插上即成广播风暴。",
        "边缘端口未开 BPDU Guard，终端误接家用路由器造成环路。",
        "根桥落在接入层，流量绕行且收敛变慢。",
      ],
      method:
        "先确认根桥位置符合设计，再检查阻塞端口是否与预期一致，最后给终端口补齐边缘端口与 BPDU Guard。",
      exercise:
        "画出三台交换机的双上联拓扑，标出根桥、根端口、指定端口与阻塞端口，并说明断掉一条链路后哪些端口会发生变化。",
      checkpoint:
        "能用 show spanning-tree 的输出判断根桥是谁、哪个端口在阻塞，并解释环路会带来什么现象。",
      lesson: {
        overview: [
          "二层转发没有 TTL 字段，一个帧只要进了环路就会一直被复制下去。广播帧更糟：每台交换机都会把它从除入端口以外的所有端口转发出去，几秒钟就能把链路带宽和 CPU 打满，表现为整网卡死、指示灯狂闪、连管理地址都登不上去，只能到现场拔线。这类故障不会自愈，只会随着广播扩散迅速恶化，所以现场的第一动作永远是断开环路，而不是先登录设备翻日志。",
          "生成树协议的作用，就是在物理上存在冗余的拓扑里算出一棵无环的逻辑树：该通的通，该堵的堵。它靠 BPDU 报文交换桥 ID 与路径开销，先选出唯一的根桥，再为每个网段保留一条最优路径，剩下的端口进入阻塞状态，随时准备接替。阻塞并不等于失效：端口仍在监听 BPDU，主路径一断就按备份顺序顶上，这正是双上联既能防环又能冗余的原因。",
          "很多环路事故的根源不是没开 STP，而是边缘端口没有做防护：有人把家用路由器或第二台交换机插到墙面信息口，BPDU 从接入端口涌进来，整棵拓扑被迫重算。把终端口标成边缘端口并开启 BPDU Guard，才能让接入层既快又稳，把环路的入口掐死在端口上。反过来，如果为了防环把所有终端口都关掉 portfast，员工换个座位就要等半分钟才能上网，体验会先崩掉。",
        ],
        mechanism: [
          "选举分三步：先比桥优先级再比 MAC，选出唯一的根桥；然后每台非根交换机选一个到根开销最小的根端口；最后每个网段选一个指定端口，既不是根端口也不是指定端口的一律阻塞。这三步的顺序不能颠倒，因为根端口与指定端口的判断，都建立在前一步已经确定的前提之上。",
          "BPDU 默认每两秒发送一次，传统 STP 要依次经过监听、学习才能转发，所以收敛要几十秒。RSTP 改成相邻交换机之间的提议与同意握手，链路故障时可以直接把备份端口提升为转发状态。注意收敛时间指的是从拓扑变化到全网重新稳定，而不是单台设备刷新的时间，评估业务影响要按前者算。",
          "边缘端口假设下游是终端，插上线就直接转发，不参与拓扑计算。代价是它无法识别下面接的其实是交换机，所以必须配合 BPDU Guard：一旦在该端口收到 BPDU 就立即 err-disable，把环路的入口掐掉。err-disable 之后端口需要手动恢复或配置自动恢复定时器，这个细节要写进割接方案，否则一次误插会留下一个长期 down 的端口。",
          "根桥位置应该由设计决定，而不是让最小 MAC 的旧设备碰巧当上。核心交换机手动设为 root primary，接入层再配置 root guard，可以防止接入设备抢走根桥，导致全网流量绕行、收敛变慢。根桥一旦漂移，所有路径开销都会重算，表现是延迟升高与间歇丢包而不是彻底不通，这类问题尤其依赖拓扑变化告警来发现。",
        ],
        example: {
          title: "固定根桥并给终端口加保护",
          language: "text",
          code: "SW1(config)# spanning-tree mode rapid-pvst\nSW1(config)# spanning-tree vlan 10,20 root primary\nSW1(config)# interface GigabitEthernet1/0/1\nSW1(config-if)# switchport mode access\nSW1(config-if)# spanning-tree portfast\nSW1(config-if)# spanning-tree bpduguard enable\nSW1(config)# interface GigabitEthernet1/0/24\nSW1(config-if)# spanning-tree guard root\nSW1# show spanning-tree vlan 10\nSW1# show spanning-tree interface GigabitEthernet1/0/24 detail",
          explanation:
            "root primary 把本机优先级压低，确保根桥落在核心；portfast 让终端口跳过监听与学习，bpduguard 在收到 BPDU 时直接把端口关掉；上联口的 root guard 则阻止下联设备成为根桥。最后两条 show 用来核对根桥与端口角色是否符合设计，而不是只看配置有没有打进去。",
        },
        practiceSteps: [
          "先画出物理拓扑与预期根桥，标注每条链路的开销。",
          "在核心上固定根桥，接入层开启 root guard，终端口设 portfast 加 bpduguard。",
          "用 show spanning-tree 核对根桥、根端口与阻塞端口是否与设计一致。",
          "断开一条冗余链路，观察收敛时间与端口角色变化是否在预期内。",
        ],
        masteryChecklist: [
          "能说出根桥、根端口、指定端口、阻塞端口的判定顺序。",
          "能解释 portfast 与 bpduguard 为什么必须成对使用。",
        ],
        summary: [
          "二层没有 TTL，环路必然导致广播风暴。",
          "STP 用桥 ID 选根桥，再按开销分配根端口与指定端口，其余阻塞。",
          "RSTP 用握手快速收敛，边缘端口加速终端接入但必须配 BPDU Guard。",
          "根桥位置要由设计固定，不能交给最小 MAC 决定。",
        ],
        terms: [
          {
            term: "根桥（Root Bridge）",
            plain: "整棵生成树的中心，所有路径都以它为准算开销。",
            detail:
              "先比桥优先级（默认 32768 加 VLAN 号），相同再比 MAC。根桥应放在核心，否则流量会绕行，且拓扑变化时收敛更频繁。",
          },
          {
            term: "BPDU",
            plain: "交换机之间互相比谁当根、路好走的报文。",
            detail:
              "默认每 2 秒发一次，携带桥 ID、根路径开销与端口角色。收不到 BPDU 的超时是 20 秒，这也是传统 STP 收敛慢的来源之一。",
          },
          {
            term: "边缘端口（Edge Port）",
            plain: "直连终端、插上就转发的端口。",
            detail:
              "它跳过监听学习，所以终端开机就能上网。但正因为它不参与拓扑计算，下游一旦接了交换机就会形成环路，必须用 BPDU Guard 兜底。",
          },
          {
            term: "广播风暴",
            plain: "广播帧在环路里越滚越多，把网络堵死。",
            detail:
              "二层没有 TTL 限制，帧会一直循环并被复制。典型现象是链路灯狂闪、交换机 CPU 打满、管理地址也登不上，只能物理断开环路。",
          },
        ],
      },
    },
    questions: [
      {
        key: "network-engineering-exp-net-stp-loop-s1",
        stageKey: "net-lan",
        topicKey: "net-stp-loop",
        type: "single",
        stem: "启用 STP 的交换网络中，某个端口既不是根端口也不是指定端口，它的状态应该是？",
        options: [
          { key: "A", text: "转发（Forwarding）" },
          { key: "B", text: "阻塞（Blocking）" },
          { key: "C", text: "学习（Learning）" },
          { key: "D", text: "禁用（Disabled）" },
        ],
        answer: ["B"],
        explanation:
          "STP 的规则是：每台非根交换机有一个到根开销最小的根端口，每个网段有一个指定端口，其余端口全部阻塞，用它们构成无环树的备份。阻塞端口仍会监听 BPDU，一旦主路径失效就能被提升为转发。",
        difficulty: "medium",
        tags: ["STP", "端口角色"],
        sourceKey: "wireshark",
        level: "进阶",
      },
      {
        key: "network-engineering-exp-net-stp-loop-j1",
        stageKey: "net-lan",
        topicKey: "net-stp-loop",
        type: "judge",
        stem: "接入端口配置了 portfast 就能防止终端误接交换机形成环路。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "portfast 只是让端口跳过监听与学习、插上就转发，它并不检测下游接的是什么设备，因此对环路毫无防御作用。真正兜底的是 BPDU Guard：在该端口收到 BPDU 时立即 err-disable，把环路入口关掉。",
        difficulty: "hard",
        tags: ["portfast", "BPDU Guard", "环路"],
        sourceKey: "napalm",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "network-engineering",
    stageKey: "net-lan",
    topic: {
      key: "net-link-aggregation",
      title: "链路聚合与 LACP",
      summary:
        "链路聚合把多条物理链路捆成一条逻辑链路，带宽叠加、单线故障不断网；成败取决于成员口的速率、双工、VLAN 与协商模式是否完全一致，以及流量哈希是否真的分散。",
      concepts: ["逻辑接口", "LACP 协商", "成员口一致性", "哈希与负载分担"],
      principles: [
        "聚合后的带宽是成员链路之和，但单条流只会走其中一条，哈希决定它走哪条。",
        "成员口的速率、双工、VLAN 配置必须一致，任何一项不同都会导致成员被踢出聚合组。",
        "静态聚合不协商，一端配错另一端无法察觉；LACP 用报文互相确认，成员异常时能自动降级。",
      ],
      applications: ["核心与汇聚互联", "服务器双网卡上联", "堆叠设备之间的链路"],
      pitfalls: [
        "两端模式一边 active 一边 on，链路时通时断。",
        "成员口跨了不同板卡或不同速率，导致部分成员根本不转发。",
        "以为聚合后单条流能跑满总带宽。",
      ],
      method:
        "先确认两端支持的聚合模式与成员口范围，再统一速率、双工与 VLAN 配置，最后用哈希结果验证流量是否真的分散。",
      exercise:
        "为两台交换机之间的四条千兆链路设计聚合，写出两端配置与成员口一致性检查项，并说明两条大流量为什么可能都挤在一条成员上。",
      checkpoint:
        "能用 show etherchannel summary 判断聚合是否成功，并解释单流带宽为什么上不去。",
      lesson: {
        overview: [
          "链路聚合解决的问题很具体：既要更多带宽，又要一条线断了业务不断。做法是把多条物理链路绑成一个逻辑接口，生成树把它当作一条链路看待，转发时按哈希选择其中一条成员发出，因此不会因为并联而出现二层环路，这也是它比简单堆叠多条上联更安全的地方。",
          "聚合不是插上线就自动生效。两端必须使用兼容的协商模式，成员口的速率、双工、VLAN、MTU 都要一致，否则协议会把不一致的成员踢出聚合组，剩下的成员继续转发，最终表现为带宽莫名减半、链路时通时断，而链路指示灯一切正常。更麻烦的是这类问题往往在扩容或换板卡之后才出现，配置本身没人动过，于是很难第一时间联想到聚合。",
          "即使聚合成功，也不代表单条流能跑满总带宽。哈希通常按源目 MAC、IP 与端口的组合计算，同一条 TCP 流始终落在同一条成员链路上；只有大量不同五元组的流才会被摊开。评估容量时要看并发流的数量，而不是只盯着链路总带宽。备份与视频这类单流大带宽业务尤其容易踩坑，规划容量时要先问清楚业务是单连接还是多连接。",
        ],
        mechanism: [
          "LACP 通过 LACPDU 交换系统优先级、端口优先级与操作键。两端键值一致才允许把端口加入同一个聚合组；键值不一致时端口保持独立，聚合组里只剩部分成员，这就是配置了却不生效最常见的形态。系统优先级决定谁主导成员选择，端口优先级决定成员被裁掉时先裁谁，这两个值两端不一致时很难看出问题。",
          "哈希算法在成员之间做选择，常见输入是源目 IP、源目端口与协议号。输入完全相同的一组流必然走同一条成员，所以两条各占一半带宽的大流可能全挤在一条上，另一条几乎空闲。不同厂商支持的哈希字段不同，有的还能按二层或三层组合切换，选型时要把业务流量特征一起纳入考虑。",
          "静态聚合（mode on）不做任何协商，两端都认为链路可用就直接转发。它的问题是无法发现对端配错：一端捆了四条、另一端只捆两条，剩下的链路会被生成树阻塞或直接丢包，排查时很难看出原因。因此只要设备支持，就应该优先用 LACP，把正确性交给协议去确认，而不是靠人记住两端配置一致。",
        ],
        example: {
          title: "两端用 LACP 主动模式捆绑四条链路",
          language: "text",
          code: "SW1(config)# interface range GigabitEthernet1/0/23 - 24\nSW1(config-if-range)# channel-group 1 mode active\nSW1(config)# interface Port-channel1\nSW1(config-if)# switchport mode trunk\nSW1(config-if)# switchport trunk allowed vlan 10,20\nSW1# show etherchannel 1 summary\nSW1# show lacp neighbor",
          explanation:
            "把成员口加入同一个 channel-group 并指定 active，两端都用主动模式就一定能协商成功。Trunk 与允许列表要配在 Port-channel 逻辑口上，而不是逐个成员口配，否则成员加入后配置会被逻辑口覆盖。最后用 show etherchannel summary 看成员是 P（已捆绑）还是 I（独立），用 show lacp neighbor 确认对端确实在协商。",
        },
        practiceSteps: [
          "确认两端支持的聚合模式，优先选 LACP active，避免一端 on 一端 active。",
          "把成员口配成相同速率、双工与 VLAN，再加入同一个 channel-group。",
          "在 Port-channel 逻辑口上配置 Trunk 与允许列表，而不是逐个成员口配。",
          "用 show etherchannel summary 与 show lacp neighbor 核对两端成员状态，再用多条并发流测吞吐。",
        ],
        masteryChecklist: [
          "能区分静态聚合与 LACP 的差别，并说明各自的风险。",
          "能根据聚合状态判断成员是被踢出还是根本没有加入。",
        ],
        summary: [
          "聚合把多条物理链路变成一个逻辑接口，冗余与带宽同时获得。",
          "成员口参数必须完全一致，否则会被踢出聚合组。",
          "单流只走一条成员，容量评估要看并发流的数量。",
          "优先用 LACP，静态聚合无法发现对端配错。",
        ],
        terms: [
          {
            term: "LACP",
            plain: "两端交换机商量好把哪几条线捆在一起的协议。",
            detail:
              "它用 LACPDU 交换优先级与操作键，键一致才允许捆绑。active 主动发起、passive 被动等待，两端都 passive 就没人先开口，聚合建不起来。",
          },
          {
            term: "成员口（Member Port）",
            plain: "被捆进聚合组的那几条物理链路。",
            detail:
              "成员的速率、双工、VLAN、MTU 必须一致。任何一项不同，协议会把它留在组外单独转发，表现为带宽少一截却查不出告警。",
          },
          {
            term: "哈希（Hash）",
            plain: "按五元组算一个值，决定这条流走哪条成员。",
            detail:
              "同一个哈希输入永远落到同一条成员，所以单条大流无法用满总带宽。想让流量摊开，要么增加并发流，要么调整设备支持的哈希字段。",
          },
          {
            term: "Port-channel",
            plain: "聚合之后对外表现的那一个逻辑接口。",
            detail:
              "IP、Trunk、允许列表都配在它上面，而不是成员口上。成员口只负责物理承载，配置不一致会被逻辑口的配置覆盖或直接拒绝加入。",
          },
        ],
      },
    },
    questions: [
      {
        key: "network-engineering-exp-net-link-aggregation-s1",
        stageKey: "net-lan",
        topicKey: "net-link-aggregation",
        type: "single",
        stem: "两端都配置了链路聚合，但 show etherchannel summary 显示成员口为独立状态（I）。最可能的原因是什么？",
        options: [
          { key: "A", text: "光纤或模块损坏" },
          { key: "B", text: "两端协商模式或成员口参数不一致" },
          { key: "C", text: "没有开启生成树" },
          { key: "D", text: "没有配置路由" },
        ],
        answer: ["B"],
        explanation:
          "成员显示独立，说明物理链路是通的但没被接纳进聚合组：常见原因是两端模式不兼容（一端 active 一端 on），或成员口的速率、双工、VLAN、MTU 不一致导致操作键不同。光纤损坏会让端口直接 down，根本不会出现在聚合成员列表里。",
        difficulty: "medium",
        tags: ["链路聚合", "LACP", "成员口"],
        sourceKey: "napalm",
        level: "进阶",
      },
      {
        key: "network-engineering-exp-net-link-aggregation-j1",
        stageKey: "net-lan",
        topicKey: "net-link-aggregation",
        type: "judge",
        stem: "四条千兆链路做聚合后，单条 TCP 流最高可以跑到 4Gbps。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "聚合的负载分担是按流哈希的，同一条 TCP 流的五元组不变，因此只会落在一条成员链路上，上限仍是一条链路的带宽。要跑满总带宽需要多条并发流，或者使用能按报文分片分担的专有方案。",
        difficulty: "easy",
        tags: ["链路聚合", "哈希", "带宽"],
        sourceKey: "napalm",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "network-engineering",
    stageKey: "net-lan",
    topic: {
      key: "net-static-ospf",
      title: "静态路由与 OSPF 邻居建立",
      summary:
        "静态路由确定、可控、不自愈；OSPF 靠 Hello 建邻居、靠 LSA 同步拓扑、靠开销选路。选型的分界线是网络规模与变更频率，而不是哪个协议更高级。",
      concepts: ["最长前缀与下一跳", "管理距离与浮动静态", "Hello 与邻居状态", "区域与开销"],
      principles: [
        "静态路由不会感知故障，下一跳断开后流量仍按原方向发出，形成黑洞，必须配合浮动静态或链路检测。",
        "OSPF 邻居建立要求 Hello/Dead 间隔、区域 ID、认证与网络类型一致，且双方接口在同一网段。",
        "同一目的有多条来源时先比管理距离再比度量，浮动静态就是故意调大管理距离，只在主路由消失时生效。",
      ],
      applications: ["出口默认路由", "分支机构互联", "园区多区域组网"],
      pitfalls: [
        "只写去程静态路由，回程缺失造成单向不通。",
        "OSPF 两端 Hello 间隔不一致，邻居长期停在 INIT。",
        "把接口宣告进错误区域，路由学不到却查不出报错。",
      ],
      method:
        "先按规模与变更频率决定静态还是动态，再逐项对齐 OSPF 的邻居参数，最后用路由表验证实际选路结果。",
      exercise:
        "为三台路由器设计路由：两台之间跑 OSPF，出口用默认静态并配一条浮动备份，写出配置与验证命令。",
      checkpoint:
        "能解释邻居停在 INIT 与 EXSTART 分别意味着什么，并说明浮动静态路由如何生效。",
      lesson: {
        overview: [
          "静态路由是把去往某个网段的方向手工写死在路由表里：简单、可预测、没有协议开销，适合出口默认路由和分支互联这类拓扑稳定的位置。代价是它不会自己发现故障，下一跳断了流量仍按原方向发出去，形成黑洞，直到有人发现并删掉这条路由。",
          "OSPF 解决的是规模问题：路由器用 Hello 报文发现邻居，用 LSA 把各自的链路状态扩散到同一区域，每台设备据此独立算出最短路径树。拓扑变化时 LSA 重新泛洪，路由自动收敛，不需要人工去改每台设备的配置。代价是多了协议开销与排障复杂度：邻居起不来、区域划错、汇总不当，都会让路由看起来存在却到不了。",
          "选型的分界线不是哪个更先进，而是这张网会不会变、变得有多快。三五台设备、拓扑一年不动，静态路由更省心；几十上百台、经常加链路加区域，动态协议才能把变更成本压下来。两者也常混用：内部跑 OSPF，出口写一条默认静态。判断标准可以很朴素：一次变更要改几台设备、改完怎么验证、错了怎么回退，这三个问题的答案决定了选型。",
        ],
        mechanism: [
          "OSPF 邻居要经过几个状态：DOWN 收不到 Hello；INIT 收到了对方的 Hello 但对方还没看到自己；2-WAY 双方互相看见；EXSTART 与 EXCHANGE 协商主从并交换摘要；LOADING 请求缺失的 LSA；FULL 数据库同步完成。卡在哪个状态，就指向哪类参数不一致。记住状态顺序比背命令有用：状态就是进度条，停得越靠后，说明前面的基础参数越可能是对的。",
          "Hello 与 Dead 间隔必须一致，广播网络上默认是 10 秒和 40 秒；区域 ID、认证、MTU 与网络类型也要匹配。任何一项不同，邻居就会停在 INIT 或反复重建，表现为路由时有时无。排查时先看邻居状态再抓 Hello 包，把两端的间隔、区域与认证字段逐项对比，问题通常当场就能定位。",
          "路由选择先比管理距离：直连 0、静态 1、OSPF 110。把备份静态路由的管理距离设成 250，它平时不会进表，只有 OSPF 学到的路由消失后才顶上来，这就是浮动静态。注意浮动静态仍然依赖主路由从表中消失，如果主路径只是变慢或丢包而路由还在，它不会切换。",
          "区域把拓扑变化限制在局部：区域内的路由器维护完整链路状态，区域间只传递汇总路由。所有非骨干区域必须挂在区域 0 上，否则学不到其它区域的路由，这是多区域组网最常见的配置错误。划分区域时还要考虑链路稳定性，把经常抖动的分支放进单独区域，可以避免一次抖动扩散到全网重算。",
        ],
        example: {
          title: "OSPF 主路由加浮动静态备份",
          language: "text",
          code: "R1(config)# router ospf 1\nR1(config-router)# router-id 10.0.0.1\nR1(config-router)# network 10.0.0.0 0.0.0.255 area 0\nR1(config-router)# passive-interface GigabitEthernet0/1\nR1(config)# ip route 10.20.0.0 255.255.0.0 10.0.0.6 250\nR1(config)# ip route 0.0.0.0 0.0.0.0 203.0.113.1\nR1# show ip ospf neighbor\nR1# show ip route ospf\nR1# show ip route 10.20.0.0",
          explanation:
            "内部网段交给 OSPF 学，到 10.20.0.0/16 的主路由也由 OSPF 提供；再把同一目的地的静态路由管理距离设成 250，它就成了一根备胎，只有 OSPF 路由消失才会进表。passive-interface 让接终端的接口不发 Hello，避免无意义的邻居。验证时先看邻居是否 FULL，再看 10.20.0.0 的实际下一跳是哪一条。",
        },
        practiceSteps: [
          "先确定哪些网段走静态、哪些交给 OSPF，并画出区域边界。",
          "在出口写默认静态路由，再补一条管理距离更大的浮动备份。",
          "启用 OSPF 并宣告正确的网段与区域，核对两端 Hello 参数。",
          "用 show ip route 与 show ip ospf neighbor 验证选路与邻居状态。",
        ],
        masteryChecklist: [
          "能解释管理距离与度量的区别，并说明浮动静态的原理。",
          "能根据邻居状态判断是 Hello 参数问题还是 MTU 或区域问题。",
        ],
        summary: [
          "静态路由可控但不自愈，必须配浮动备份或链路检测。",
          "OSPF 靠 Hello 建邻居、靠 LSA 同步拓扑、靠开销选路。",
          "邻居状态是排障入口：INIT 多是单向可见，EXSTART 常见于 MTU 不一致。",
          "先比管理距离再比度量，浮动静态就是调大管理距离的备份路由。",
        ],
        terms: [
          {
            term: "管理距离（AD）",
            plain: "不同来源的路由谁更可信，数值越小越可信。",
            detail:
              "直连 0、静态 1、OSPF 110、RIP 120。它只在来源之间比较；同一协议内部再比度量。浮动静态正是利用这一点把自己藏起来。",
          },
          {
            term: "浮动静态路由",
            plain: "平时不用、主路由断了才生效的备份静态路由。",
            detail:
              "做法是把管理距离调到比主路由来源更大，例如 250。主路由还在时它不进表；主路由消失后它顶上来，代价是它依然不会感知更远处的故障。",
          },
          {
            term: "LSA",
            plain: "OSPF 用来告诉别人我这边链路长什么样的通告。",
            detail:
              "不同类型的 LSA 描述路由器、网段、外部路由等。同一区域内每台设备都保存一份相同的链路状态库，再各自算最短路。",
          },
          {
            term: "邻居状态",
            plain: "两台路由器建邻居走到了哪一步。",
            detail:
              "DOWN 到 FULL 是有顺序的。卡在 INIT 说明反向的 Hello 没到；卡在 EXSTART 常见于两端 MTU 不一致；能到 2-WAY 却起不来，要查区域或认证。",
          },
        ],
      },
    },
    questions: [
      {
        key: "network-engineering-exp-net-static-ospf-s1",
        stageKey: "net-lan",
        topicKey: "net-static-ospf",
        type: "single",
        stem: "OSPF 邻居长时间停在 INIT 状态，最可能的原因是什么？",
        options: [
          { key: "A", text: "两端区域 ID 不一致" },
          { key: "B", text: "本机收到了对方的 Hello，但自己的 Hello 到不了对方" },
          { key: "C", text: "接口没有配置 IP 地址" },
          { key: "D", text: "路由表已满" },
        ],
        answer: ["B"],
        explanation:
          "INIT 的含义是收到了对方的 Hello，但对方的 Hello 里没有列出本机的 Router ID，说明反方向不可达或对端没有在收：常见于单向链路、组播被 ACL 拦截、对端接口被设为 passive。区域 ID 不一致会停在 2-WAY 之前就反复重建，接口没配地址则根本进不了邻居流程。",
        difficulty: "medium",
        tags: ["OSPF", "邻居状态", "INIT"],
        sourceKey: "napalm",
        level: "进阶",
      },
      {
        key: "network-engineering-exp-net-static-ospf-j1",
        stageKey: "net-lan",
        topicKey: "net-static-ospf",
        type: "judge",
        stem: "把备份静态路由的管理距离设得比 OSPF 更大，可以让它平时不进路由表，只在 OSPF 路由消失后生效。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "路由选择先比管理距离，OSPF 默认 110，把静态路由设成 250 就排在它后面。只要 OSPF 路由还在表里，静态路由就不会被选中；等 OSPF 路由因故障撤销后才顶上来，这就是浮动静态的标准做法。",
        difficulty: "medium",
        tags: ["浮动静态", "管理距离"],
        sourceKey: "napalm",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "network-engineering",
    stageKey: "net-security",
    topic: {
      key: "net-acl-nat",
      title: "ACL 与 NAT 配置落地",
      summary:
        "ACL 用通配符掩码描述范围、自上而下匹配、末尾隐含拒绝；NAT 改写地址并复用公网端口。两者常叠在同一台边界设备上，方向或顺序错了就会出现策略写了却不生效。",
      concepts: ["通配符掩码", "匹配顺序与隐含拒绝", "源 NAT 与端口复用", "静态映射与端口转发"],
      principles: [
        "通配符掩码 0 表示必须匹配、1 表示忽略，与子网掩码的写法正好相反。",
        "ACL 自上而下逐条匹配，命中即执行；末尾隐含 deny any，所以至少要有明确放通。",
        "NAT 只在标记为 inside 与 outside 的接口之间生效，流量方向决定 ACL 看到的是转换前还是转换后的地址。",
      ],
      applications: ["出口共享上网", "对外发布内部服务", "区域之间的访问控制"],
      pitfalls: [
        "把通配符掩码写成子网掩码，匹配范围完全错位。",
        "在 NAT 之后的链路上做过滤，看到的是改写后的地址。",
        "静态映射只做一半，回程或端口没有放通。",
      ],
      method:
        "先写清流量矩阵，再把矩阵翻译成有序 ACL，最后确认 NAT 的 inside/outside 方向与 ACL 的应用接口和方向。",
      exercise:
        "为一个内网网段设计共享上网与一台服务器对外发布：写出 ACL、NAT 规则与应用接口，并说明外部访问服务器时地址的完整变化。",
      checkpoint:
        "能解释某条 ACL 看起来放通了却没生效，并从接口方向与匹配顺序给出原因。",
      lesson: {
        overview: [
          "ACL 是一串按顺序排列的匹配语句，每条包含匹配条件和动作。设备从第一条开始比对，命中就执行并停止，全部不命中则落到末尾的隐含拒绝。因此规则的顺序本身就是逻辑：把宽泛的放通写在前面，后面的精确规则就永远不会生效。维护时也一样，新增规则要插在同类精确规则附近，随手追加到末尾往往会被前面的宽泛规则挡掉。",
          "写 ACL 用的不是子网掩码而是通配符掩码：0 表示这一位必须相同，1 表示这一位随便。10.10.0.0 0.0.255.255 表示整个 10.10.0.0/16，一旦误写成 255.255.0.0，语义完全变了，规则会匹配到一批你根本没打算放通的地址。记法是先写掩码再按位取反：/16 的掩码是 255.255.0.0，取反之后就是 0.0.255.255，两者一定互为补数，写完之后反着核对一遍就不容易错。",
          "NAT 与 ACL 经常出现在同一台边界设备上，于是出现了顺序问题：流量是先匹配 ACL 还是先做地址转换，取决于接口方向与厂商实现。搞不清这一点，就会看到抓包里是公网地址、日志里是私网地址，两边对不上，结论自然也就错了。实用做法是固定一个观测点：要么都在内网侧看，要么都在外网侧看，再对照会话表确认转换发生在哪一步。",
        ],
        mechanism: [
          "源 NAT 把内网源地址改成公网地址，并用端口号区分不同会话，这就是 PAT 或端口复用。会话表记录转换前后的五元组，回程包靠查表还原，因此外部无法主动发起连接，除非配置了静态映射。会话表有容量上限，连接数暴涨或超时设置过长时，新连接会因表项耗尽而失败，这类故障看起来很像链路断了。",
          "静态 NAT 一对一绑定地址；端口转发则把公网某地址的某端口映射到内网主机的某端口，适合只发布一个服务。两者都要确认回程路径与策略放通，否则会出现请求到了、响应回不来的现象。发布服务时还要确认内网服务器的默认网关指回边界设备，否则响应会从别的出口出去，形成非对称路径。",
          "ACL 应用在接口上有方向：inbound 在报文进入设备时匹配，outbound 在离开设备前匹配。同一条规则放错方向等于没写；放对方向但接口选错，例如放在 NAT 外侧，匹配到的地址也和你以为的不一样。因此排障时先确认三件事：规则内容、应用接口、应用方向，缺任何一项都可能得出相反结论。",
        ],
        example: {
          title: "内网访问控制、共享上网与端口发布",
          language: "text",
          code: "R1(config)# ip access-list extended INSIDE-IN\nR1(config-ext-nacl)# permit ip 10.10.0.0 0.0.255.255 10.20.0.0 0.0.255.255\nR1(config-ext-nacl)# deny ip 10.10.0.0 0.0.255.255 10.30.0.0 0.0.255.255\nR1(config-ext-nacl)# permit ip any any\nR1(config)# ip access-list standard NAT-LIST\nR1(config-std-nacl)# permit 10.10.0.0 0.0.255.255\nR1(config)# interface GigabitEthernet0/0\nR1(config-if)# ip address 10.10.0.1 255.255.0.0\nR1(config-if)# ip nat inside\nR1(config-if)# ip access-group INSIDE-IN in\nR1(config)# interface GigabitEthernet0/1\nR1(config-if)# ip address 203.0.113.10 255.255.255.0\nR1(config-if)# ip nat outside\nR1(config)# ip nat inside source list NAT-LIST interface GigabitEthernet0/1 overload\nR1(config)# ip nat inside source static tcp 10.10.1.20 80 203.0.113.10 80\nR1# show ip nat translations",
          explanation:
            "内网侧入向 ACL 看到的是转换前的私网地址，因此可以用 10.10.0.0 0.0.255.255 描述范围。源 NAT 用 NAT-LIST 匹配要上网的网段，并以 outside 接口地址做端口复用；静态映射把公网 80 端口一对一转到 10.10.1.20:80，这才让外部能主动访问。验证时用 show ip nat translations 对照内外地址，比只看配置更可靠。",
        },
        practiceSteps: [
          "先写流量矩阵：谁访问谁、用什么协议和端口、是否需要转换地址。",
          "用通配符掩码把矩阵翻译成有序 ACL，精确规则在前、宽泛放通在后。",
          "配置 NAT：内网口标 inside、外网口标 outside，源 NAT 用地址池或接口复用。",
          "用 show ip nat translations 与抓包核对地址变化，再从外部验证发布的服务。",
        ],
        masteryChecklist: [
          "能写出 10.10.0.0/16 对应的通配符掩码并解释每一位的含义。",
          "能说清一条 ACL 应用在哪个接口、哪个方向，匹配的是转换前还是转换后的地址。",
        ],
        summary: [
          "通配符掩码 0 必须匹配、1 忽略，与子网掩码相反。",
          "ACL 自上而下匹配，末尾隐含拒绝。",
          "NAT 靠会话表还原回程，外部主动访问必须静态映射。",
          "接口方向决定 ACL 看到的是转换前还是转换后的地址。",
        ],
        terms: [
          {
            term: "通配符掩码",
            plain: "ACL 里用来表示哪几位要一样、哪几位随意的掩码。",
            detail:
              "0 表示这一位必须与给定地址相同，1 表示忽略。它和子网掩码按位取反的关系容易记混，写错一位就会多放通或少放通一大片地址。",
          },
          {
            term: "PAT",
            plain: "多个内网地址共用同一个公网地址，靠端口区分会话。",
            detail:
              "也叫端口复用或 NAT 重载。会话表记录原地址端口与转换后地址端口的对应，表满时新连接会被丢弃，这就是出口 NAT 的容量上限。",
          },
          {
            term: "隐含拒绝",
            plain: "ACL 最后一条看不见的规则：没匹配上的全部丢掉。",
            detail:
              "因此只写拒绝规则会变成默认全禁。设计时要明确最后是放通还是拒绝，并把这条显式写出来，方便下一个维护的人看懂意图。",
          },
          {
            term: "静态映射",
            plain: "把某个公网地址或端口固定指到一台内网主机。",
            detail:
              "一对一地址映射用于整机发布，端口转发用于只开放一个服务。映射配了但策略没放通，表现是外部超时、内网一切正常。",
          },
        ],
      },
    },
    questions: [
      {
        key: "network-engineering-exp-net-acl-nat-s1",
        stageKey: "net-security",
        topicKey: "net-acl-nat",
        type: "single",
        stem: "内网 10.10.1.20 的 Web 服务已做端口转发到 203.0.113.10:80，内网访问正常，外部访问超时。最应优先核对什么？",
        options: [
          { key: "A", text: "内网服务器的 CPU 占用" },
          { key: "B", text: "外网接口的入向 ACL 是否放通到该地址的 80 端口，以及静态映射是否内外成对" },
          { key: "C", text: "把 Web 服务端口改成 8080" },
          { key: "D", text: "关闭 NAT 以排除干扰" },
        ],
        answer: ["B"],
        explanation:
          "内网正常说明服务本身与内网路径没问题，故障点在边界：要么外网接口的入向 ACL 没有放通到 203.0.113.10:80，要么静态映射只配了单侧、会话表里看不到转换。改成 8080 或关掉 NAT 都不解决策略未放通这个根因，只会让变量更多。",
        difficulty: "hard",
        tags: ["NAT", "ACL", "端口发布"],
        sourceKey: "wireshark",
        level: "综合",
      },
      {
        key: "network-engineering-exp-net-acl-nat-j1",
        stageKey: "net-security",
        topicKey: "net-acl-nat",
        type: "judge",
        stem: "ACL 里的通配符掩码 0.0.255.255 与子网掩码 255.255.0.0 表达的是同一件事。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "两者互为按位取反：0.0.255.255 表示前 16 位必须相同、后 16 位随意，对应 /16 范围；255.255.0.0 若直接写进 ACL，含义变成前 16 位随意、后 16 位必须相同，匹配到的地址完全不是你要的。",
        difficulty: "medium",
        tags: ["ACL", "通配符掩码"],
        sourceKey: "napalm",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "network-engineering",
    stageKey: "net-automation",
    topic: {
      key: "net-layer-troubleshoot",
      title: "故障分层定位与证据链",
      summary:
        "排障的效率取决于搜索空间收缩的速度：先定范围，再按层取证，每层用一条命令证明一个结论，最后把证据串成指向单一根因的链条。",
      concepts: ["影响范围", "自下而上与自上而下", "分段验证", "证据链与复盘"],
      principles: [
        "范围决定根因位置：一台还是全部、单向还是双向，答案不同则怀疑对象完全不同。",
        "每一层只回答一个问题，用一条可复现的命令取证，不靠经验猜。",
        "同时只改一个变量，否则问题即使消失也无法归因。",
      ],
      applications: ["业务不通的快速定位", "变更后的回归验证", "跨团队交接的故障说明"],
      pitfalls: [
        "从最复杂的原因开始假设，忽略物理层与地址配置。",
        "同时改多个变量，问题消失也不知道是谁的功劳。",
        "只记录结论不记录证据，复盘时无法复现。",
      ],
      method:
        "先定范围与时间线，再从物理层向上逐层取证；范围大的先查共享环节，范围小的从终端侧往下查。",
      exercise:
        "为部分用户无法访问某个域名设计排障流程：写出每层要执行的命令、判定标准与下一步分支。",
      checkpoint:
        "能给出从现象到根因的完整证据链，并说明每条证据排除了什么。",
      lesson: {
        overview: [
          "排障最贵的成本不是修，而是找。网络故障的可疑点从网线、光模块一路铺到路由、DNS 与应用，如果按直觉一个个试，时间就耗在无效动作上。分层取证的价值在于每一步都能排除掉一大片可能性，让搜索空间快速收缩。经验越丰富的人越容易跳过取证直接下结论，而恰恰是这种跳步，会在疑难故障上把排查带回原点。",
          "分层不是背 OSI 七层，而是把问题映射到能取证的位置：链路是否 up、地址与网关是否正确、路由是否双向、端口是否可达、应用是否正常返回。每一层用一条命令给出是或否，而不是堆一串猜测，命令行输出不会骗人，人的推断会。顺序可以按场景调整，但每一步的结论都必须建立在上一步已经被证明的前提之上。",
          "范围是第一个要问的问题。只有一台终端不通，先怀疑这台机器的地址、网线、策略；整个网段都不通，先看网关、上联与路由；只有某个域名不通，先看 DNS 与出口。范围问对了，一半的排查动作可以直接跳过。范围还包括时间维度：是持续不通还是间歇抖动，是从某个时点开始还是一直如此，这决定了要不要查流量与拥塞。",
        ],
        mechanism: [
          "自下而上从物理层开始，适合怀疑链路或新接入的场景；自上而下从应用报错开始，适合刚刚变更过配置的场景；分段验证把长路径切成几段，逐段确认可达，适合跨多台设备或跨运营商的场景。三种顺序没有优劣，选哪种取决于你手上已有什么信息，以及哪一端更容易拿到证据。",
          "每一层都要有明确的判定标准：ping 网关通说明二层与地址配置基本正确；traceroute 在某跳之后全是星号说明路由或策略在该处断开；端口能连通但 HTTP 返回 502，问题已经在应用而不在网络上。判定标准最好在动手前就写下来，避免边看结果边改标准，把不符合预期的输出解释成正常。",
          "证据链要求每个结论都能被复现：命令、输出、时间点三件套。只写重启后恢复不算根因，因为下次还会复发。复盘要回答三个问题：触发条件是什么、为什么监控没提前发现、补什么措施能让它不再发生。",
        ],
        example: {
          title: "自下而上的分层取证命令序列",
          language: "bash",
          code: "# 按层取证：链路 -> 地址 -> 网关 -> 路径 -> DNS -> 应用\nip link show eth0\nip -4 addr show eth0\nping -c 3 10.10.1.1\ntracepath -n 10.20.1.30\ndig +short app.example.com\ncurl -sS -o /dev/null -w '%{http_code}' https://app.example.com/health",
          explanation:
            "六条命令对应六个可判定的问题：网卡是否 up、地址与掩码是否正确、网关是否可达、路径在哪一跳断、域名是否解析、应用是否返回 2xx。哪一步先失败，问题就锁在该层及其下层，后面的命令不必再猜；每一步的输出连同时间一起记下来，就是可复现的证据链。",
        },
        practiceSteps: [
          "先把现象写清楚：谁、访问什么、什么时间、报错原文是什么。",
          "确定影响范围，据此选择自下而上、自上而下或分段验证。",
          "每层执行一条命令并记录输出与时间，明确这一层是通过还是失败。",
          "定位后只改一个变量验证，再补监控与复盘结论。",
        ],
        masteryChecklist: [
          "能把一个模糊报障拆成可取证的分层问题。",
          "能说明每条命令的输出排除了哪些可能。",
        ],
        summary: [
          "先定范围，范围决定先查共享环节还是个体环节。",
          "每层一条命令、一个结论，不做跨层猜测。",
          "同时只改一个变量，结论才可归因。",
          "证据链要能复现：命令、输出、时间点。",
        ],
        terms: [
          {
            term: "证据链",
            plain: "一串能互相印证、指向同一结论的现场记录。",
            detail:
              "每条证据都要写清命令、输出与时间，并能说明它排除了什么。只有结论没有证据的排障记录，换个人无法复现，也无法复盘。",
          },
          {
            term: "分段验证",
            plain: "把长链路切成几段，一段段确认通不通。",
            detail:
              "适合跨多台设备或跨运营商的场景。每段都有明确的起点与终点，避免在整条链路上同时怀疑十几个环节。",
          },
          {
            term: "单向可达",
            plain: "请求能过去，响应回不来。",
            detail:
              "常见成因是回程路由缺失、非对称路径被策略拦截、NAT 只做了一侧。表现为能 ping 通某一跳却打不开服务，必须双向验证。",
          },
          {
            term: "黑洞路由",
            plain: "路由表说这条路通，实际包发出去就没了。",
            detail:
              "多由静态路由指向不可达下一跳、或汇总路由覆盖了不存在的网段造成。排查时对照路由表与实际转发路径，别只看有没有路由条目。",
          },
        ],
      },
    },
    questions: [
      {
        key: "network-engineering-exp-net-layer-troubleshoot-s1",
        stageKey: "net-automation",
        topicKey: "net-layer-troubleshoot",
        type: "single",
        stem: "只有财务部一台新装的终端无法访问内网服务器，同楼层其它终端正常。按分层排障应先查什么？",
        options: [
          { key: "A", text: "核心交换机的完整路由表" },
          { key: "B", text: "该终端的链路状态、地址与掩码配置" },
          { key: "C", text: "服务器的磁盘空间" },
          { key: "D", text: "出口链路的带宽利用率" },
        ],
        answer: ["B"],
        explanation:
          "故障范围只有一台终端，说明共享环节大概率是好的，应先在这台机器的个体环节取证：网线或无线是否 up、地址与掩码是否正确、网关是否可达。核心路由表、服务器磁盘与出口带宽都属于共享或远端环节，等个体层排除后再看才合理。",
        difficulty: "easy",
        tags: ["排障方法", "影响范围", "分层取证"],
        sourceKey: "wireshark",
        level: "入门",
      },
      {
        key: "network-engineering-exp-net-layer-troubleshoot-j1",
        stageKey: "net-automation",
        topicKey: "net-layer-troubleshoot",
        type: "judge",
        stem: "排障时同时修改多个配置项，只要问题消失就说明找到了根因。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "同时改多个变量后问题消失，无法判断是哪一处起了作用，也无法解释它为什么会出现。一次只改一个变量、每步留下证据，结论才可归因；否则下次遇到同类问题仍然没有可复用的经验，还可能把真正的隐患留在配置里。",
        difficulty: "medium",
        tags: ["排障纪律", "可归因"],
        sourceKey: "napalm",
        level: "进阶",
      },
    ],
  },
];
