/**
 * 操作系统 · 知识点扩容 D 批（追加式，2026-10-31）。
 *
 * 新增 3 个知识点，不改动 operating-system.ts 与 A/B/C 批文件。主题：访问控制
 * （ACL vs 能力表）、多级页表与反向页表（OS 视角）、用户级线程与协程。
 * 防撞题：A/B/C 批与基础 13 点共 37 点已覆盖——TLB/虚存硬件侧在组成 C 批讲过，
 * 本批的页表主题取「OS 页表结构演进与空间优化」角度，与硬件翻译角度错开。
 */
import type { TopicExpansion } from "./topic-expansions";

export const operatingSystemsTopicExpansionsD: TopicExpansion[] = [
  {
    trackSlug: "operating-systems",
    stageKey: "os-concurrency-stage",
    topic: {
      key: "os-access-control",
      title: "访问控制：保护矩阵、ACL 与能力表",
      summary:
        "「谁能对谁做什么」可以用一张矩阵描述：行是主体、列是对象。按行拆开存（每个主体一张能力表）或按列拆开存（每个对象一张 ACL），是两种落地方式——查权限的方向决定了选谁。",
      concepts: ["保护矩阵", "访问控制列表 ACL", "能力表（Capability）", " Unix 权限位与 ACL 扩展", "最小特权原则"],
      principles: [
        "保护矩阵：主体（进程/用户）× 对象（文件/设备/内存段）× 操作（读/写/执行），矩阵元素就是权限——理论完备、直接实现太稀疏。",
        "ACL 按列存储：每个对象附一张「谁可以对它做什么」的列表；查「谁能访问这个文件」快，查「这个用户能访问什么」要扫全部对象。",
        "能力表按行存储：每个主体持有一张「我能对谁做什么」的票据列表；能力是不可伪造的令牌（含对象引用 + 权限位），查「这个用户能做什么」快、撤销困难。",
        "Unix 的 rwx 权限位是 ACL 的极简特例（owner/group/other 三段）；POSIX ACL 与 Windows DACL 是可变长扩展，支持细粒度条目与继承。",
      ],
      applications: [
        "文件系统的权限检查（ext4 的 POSIX ACL、Windows NTFS 的 DACL）。",
        "内核对进程的能力收窄：Linux capabilities 把 root 的全能拆成几十个独立能力位。",
        "云平台的 IAM 策略引擎是 ACL/能力思想的规模化实现（AWS 的 IAM policy 是能力表风格）。",
      ],
      pitfalls: [
        "把 Unix 的 suid 位当普通权限位——它改变的是「执行时的有效用户」，是权限提升机制不是访问控制项。",
        "能力表丢失即失控：能力令牌被窃取等同权限被窃取，撤销（revoke）与传递（delegation）是能力系统的两大难题。",
        "ACL 越长检查越慢且语义打架——条目顺序与拒绝优先规则必须明确，否则权限判断不可预期。",
      ],
      method:
        "权限设计题先问两个方向：按对象管（ACL，资源中心）还是按主体管（能力，用户中心）；再检查是否符合最小特权——只给完成任务所必需的权限。",
      exercise:
        "设计一个网盘系统的权限模型：文件有属主/协作者/访客三类主体，操作有读/写/分享。分别用 ACL 与能力表建模，比较「撤销某人访问」在两种模型下的成本。",
      checkpoint: "能画出保护矩阵并说明 ACL 与能力表分别是它的行视图/列视图，能比较两者在查询与撤销上的差异。",
      lesson: {
        overview: [
          "保护的本质是回答「谁能对谁做什么」，理论模型是一张矩阵：行是主体、列是对象、格子是允许的操作。这张矩阵在真实系统里太稀疏（绝大多数格子是空），直接存储不可行——于是拆开存：按列存成每个对象一份的 ACL，按行存成每个主体一份的能力表。两种存储方向决定了两种查询成本与两种撤销成本。",
          "ACL 是「资源的访客名单」：文件说「Alice 可读写、Bob 只读、其他人拒绝」。它的天然主场是文件系统——资源相对稳定、主体众多，检查发生在资源被访问的瞬间。Unix 的三段权限位是它的极简特例，POSIX ACL 与 NTFS DACL 是它的可变长扩展。",
          "能力表是「用户的通行证包」：用户手里攥着一张张不可伪造的票据，每张票据说「我可以对这个对象做这件事」。它的天然主场是分布式与对象系统——能力本身就是访问凭证（含随机令牌防伪造），不需要每次回查中心。代价是撤销：票发出去了，收回来要么等过期、要么全网吊销。",
          "最小特权原则是横跨两种模型的设计纪律：无论 ACL 还是能力表，默认只给完成任务所必需的权限。Linux capabilities 把「root 全能」拆成几十个独立位，让服务进程只保留绑端口、改时间等真实需要的能力——把「被攻破后的损失」限到最小。",
        ],
        mechanism: [
          "ACL 的检查流程：进程以 uid/gid 访问对象 → 内核取对象的 ACL → 逐条匹配（属主条目优先于 named 条目优先于 group 条目）→ 命中即按条目权限判定 → 未命中任何条目落到 other 类。拒绝条目（deny）与允许条目（allow）的顺序语义必须明确。",
          "能力表的实现：能力 = 对象引用 + 权限位 + 校验码（防伪造）。用户态持有能力（文件描述符就是一种能力——指向打开文件表项、带读写模式），内核按能力判定而非按用户身份。传递能力 = 转发文件描述符（SCM_RIGHTS），撤销 = 关闭描述符或内核回收。",
          "Unix 权限位的映射：rwx 三组（属主/组/其他）就是一张退化的 ACL——每个对象最多三个条目、条目内 9 个权限位。三段的匹配顺序是「属主匹配则只看属主位」，不会叠加 other 位——这个顺序规则是 chmod 题目的关键。",
          "强制访问控制（MAC）的补充：ACL/能力都属于自主访问控制（DAC，属主说了算）；SELinux/AppArmor 的 MAC 由系统策略强制——即使属主想放权，策略不允许就是不允许。多级安全的场景（军标密级）必须 MAC。",
        ],
        example: {
          title: "ACL 与能力表的撤销成本对比",
          language: "python",
          code: "class AclModel:\n    # 对象 → [(主体, 权限集)]\n    def __init__(self):\n        self.acl = {}                       # file → list[(user, perms)]\n    def grant(self, obj, user, perms):\n        self.acl.setdefault(obj, []).append((user, perms))\n    def revoke(self, obj, user):\n        # 撤销：只改这个对象的列表——O(条目数)，精确且即时\n        self.acl[obj] = [e for e in self.acl[obj] if e[0] != user]\n    def check(self, user, obj, perm):\n        return any(u == user and perm in p for u, p in self.acl.get(obj, []))\n\nclass CapabilityModel:\n    # 用户 → [(对象, 权限集, 能力令牌)]\n    def __init__(self):\n        self.caps = {}                      # user → list[(obj, perms, token)]\n    def grant(self, user, obj, perms, token):\n        self.caps.setdefault(user, []).append((obj, perms, token))\n    def revoke(self, user, obj):\n        # 撤销：要找到该用户手里对应对象的所有令牌并作废；\n        # 若令牌已被转授他人（委派），还需全网追溯——成本随传递链增长\n        self.caps[user] = [c for c in self.caps[user] if c[0] != obj]\n    def check(self, user, obj, perm, token):\n        return any(o == obj and perm in p and t == token\n                   for o, p, t in self.caps.get(user, []))",
          explanation:
            "撤销是两种模型分野的试金石：ACL 的撤销是「改资源的名单」——一个对象一处改动，即时生效且不影响他人；能力表的撤销是「追回发出的票据」——若能力已被委派传播，需要沿传递链全网回收（或等令牌过期）。反过来，认证方向也有差异：ACL 每次访问都要回查资源名单，能力表本地验票即可——分布式系统的 IAM 偏爱能力风格正是为了免去中心回查。没有万能模型，只有方向匹配的场景。",
        },
        practiceSteps: [
          "用两个模型分别建模题面网盘场景，实测撤销与委派的操作数。",
          "在 Linux 上用 setfacl/getfacl 给文件加 named 用户条目并验证检查顺序。",
          "用 capsh --print 查看某服务进程的 capabilities，找出可以裁剪的项。",
          "读一份 IAM policy 文档，标注它的 ACL 风格与能力风格成分。",
        ],
        masteryChecklist: [
          "能画出保护矩阵并解释 ACL/能力表是它的列视图/行视图。",
          "能对比两种模型在查询方向与撤销成本上的差异。",
          "能解释 Unix 权限位三段匹配顺序与最小特权原则。",
        ],
        summary: [
          "保护矩阵是理论模型，ACL 按列存、能力表按行存。",
          "ACL 撤销易（改对象名单）、查询偏资源侧；能力表反之。",
          "Unix rwx 是退化 ACL，POSIX ACL/NTFS DACL 是扩展。",
          "最小特权是横跨两模型的设计纪律；强安全场景叠加 MAC。",
        ],
        terms: [
          {
            term: "ACL",
            plain: "挂在对象上的访客名单：谁可以对它做什么。",
            detail: "检查发生在资源被访问的瞬间。文件系统与网关路由器的标配。",
          },
          {
            term: "能力表",
            plain: "主体手里攥着的通行证包：我能对谁做什么。",
            detail: "能力即凭证（不可伪造），本地验票无需回查。撤销与委派是它的两大难题。",
          },
          {
            term: "保护矩阵",
            plain: "主体×对象×操作的完整权限表。",
            detail: "理论完备、实现稀疏。ACL 与能力表是它的两种压缩存储——与稀疏矩阵压缩同构。",
          },
          {
            term: "MAC",
            plain: "强制访问控制：策略由系统定，属主无权放权。",
            detail: "SELinux/AppArmor 的模型。与 ACL 的自主访问控制（DAC）相对，用于密级与多租户强隔离。",
          },
        ],
      },
    },
    questions: [
      {
        key: "operating-systems-exp-os-access-control-s1",
        stageKey: "os-concurrency-stage",
        topicKey: "os-access-control",
        type: "single",
        stem: "文件系统需要支持「资源所有者随时撤销某个用户的访问权」，且撤销必须即时生效。ACL 与能力表两种模型中应选哪种？为什么？",
        options: [
          { key: "A", text: "能力表：撤销只需删除用户手里的能力令牌，本地操作最快捷" },
          { key: "B", text: "ACL：撤销是修改对象上的访问列表——一处改动即时生效；能力表的撤销要追回发出的票据，委派后成本随传递链增长" },
          { key: "C", text: "两者撤销成本相同，选择只取决于个人偏好" },
          { key: "D", text: "选 ACL 的原因是它支持更细粒度的权限位" },
        ],
        answer: ["B"],
        explanation:
          "撤销成本是两种模型最锐利的分界。ACL 的权限挂在对象上——撤销就是从对象的列表里删一条，即时生效、不牵连他人；能力表的凭证已发到主体手里，撤销要么逐一追回（委派传播后是全网追溯）、要么依赖令牌过期——即时性天然不足。D 的理由不成立：两种模型都能表达细粒度权限位，粒度不是分界。能力表的优势在另一侧：认证无需回查中心（本地验票）、分布式委派自然——云 IAM 的长时效凭证就是能力风格。按「撤销即时性」选 ACL 是本题的答案。",
        difficulty: "medium",
        tags: ["ACL", "能力表", "撤销"],
        sourceKey: "linux-kernel",
        level: "进阶",
      },
      {
        key: "operating-systems-exp-os-access-control-j1",
        stageKey: "os-concurrency-stage",
        topicKey: "os-access-control",
        type: "judge",
        stem: "Linux 的 capabilities 机制把传统 root 的全能权限拆成若干独立能力位（如 CAP_NET_BIND_SERVICE 允许绑 1024 以下端口），其目的是实现最小特权原则。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["A"],
        explanation:
          "传统 Unix 的权限模型是二元的：要么 root 全能、要么普通用户什么特权都没有。Web 服务想绑 80 端口就得以 root 跑——一旦被攻破，攻击者拿到的是全能 root，损失无界。capabilities 把 root 的权力拆成约 40 个独立位：Web 服务只保留 CAP_NET_BIND_SERVICE，进程被攻破时攻击者拿到的只是这一个能力——不能读全部文件、不能 kill 其他进程、不能加载内核模块。这就是最小特权原则的落地：权限按需分配、损失按权限封顶。systemd 的 AmbientCapabilities、Docker 的 --cap-drop 都在这条线上。",
        difficulty: "easy",
        tags: ["capabilities", "最小特权", "Linux"],
        sourceKey: "linux-kernel",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "operating-systems",
    stageKey: "os-memory-stage",
    topic: {
      key: "os-multilevel-pagetable",
      title: "多级页表与反向页表：页表本身的内存战争",
      summary:
        "32 位系统单级页表要 4MB——每个进程一份就是灾难。多级页表按需分配页表页：没用到的地址区间连页表都不存在，4MB 变成 KB 级。反向页表更进一步：全系统一张表按物理页索引，虚拟页号经哈希查找。",
      concepts: ["单级页表的空间问题", "二级/多级页表", "页目录与按需分配", "反向页表（倒排）", "TLB 与多级的配合"],
      principles: [
        "32 位 / 4KB 页 / 4B 表项：单级页表 2^20 项 × 4B = 4MB/进程——绝大多数进程的地址空间是稀疏的，页表 99% 是空洞的占位。",
        "二级页表把页号切成页目录（10 位）+ 页表（10 位）：页目录 1024 项指向各自的页表页，页表页按需分配——未映射的区间页目录项标记无效即可，省掉整个下级页表。",
        "64 位的极致是多级（x86-64 四级/五级）+ 巨页：48 位虚拟地址切成 4 段各 9 位 + 页内 12 位；巨页（2MB/1GB）让单张页表覆盖更大范围，TLB 命中率同步提升。",
        "反向页表全系统只有一张，按物理页框索引：虚拟页号经哈希定位，命中项记录「哪个进程的哪个虚拟页占用了这个物理框」——页表大小与物理内存成正比，与地址空间和进程数无关。",
      ],
      applications: [
        "进程 fork 后真正写页之前，二级/多级页表把新进程的页表开销压到几乎为零。",
        "数据库与科学计算的大内存进程用透明巨页减少 TLB 缺失——代价是内存碎片与 COW 粒度变粗。",
        "反向页表思想活在 PowerPC/IA-64 与软件 TLB 架构里；x86 主流仍是正向多级。",
      ],
      pitfalls: [
        "以为多级页表只是把一张表切成几张——关键是「按需分配」：稀疏地址空间省掉的是整页整页的页表页。",
        "多级查表多访存的问题靠 TLB 解决——没有 TLB 的多级页表在性能上是负优化（组成批已述）。",
        "反向页表的共享页与多进程映射处理复杂（一个物理框可能映射多个虚拟页），实现远比正向页表绕。",
      ],
      method:
        "页表计算题固定三问：各级索引位数（地址位 ÷ 页大小对数切分）、页表页数量（按已映射区间算）、省了多少内存（对比单级）。",
      exercise:
        "32 位虚拟地址、4KB 页、4B 表项：(a) 单级页表大小？(b) 二级页表（页目录 10 位 + 页表 10 位 + 偏移 12 位）下，若进程只映射了代码段（4MB）与栈（1MB），共需多少个页表页（含页目录）？",
      checkpoint: "能推导二级页表的位数切分与按需分配的省内存账，能说出反向页表的索引方式与代价。",
      lesson: {
        overview: [
          "页表是虚拟内存的账本，但账本本身贵得惊人。32 位系统、4KB 页意味着每个进程有 2²⁰ 个虚拟页——单级页表要 100 万个表项、4MB 连续内存。而绝大多数进程实际只用了地址空间的零头：代码几百 KB、堆栈几 MB，中间几十 MB 的空洞根本不需要页表项。页表的内存战争就是围绕「空洞不付钱」打的。",
          "多级页表的解法是把账本做成树：页目录只记录「哪些下级页表存在」，下级页表按需分配。稀疏地址空间里，未使用的 4MB 区间只需要页目录里的一个无效项（4 字节），整张 4KB 的下级页表都不用分配——4MB 的固定成本变成 KB 级的可变成本。代价是翻译多了一次访存（TLB 兜底）。",
          "反向页表换了记账方向：不是「每个虚拟页在哪」而是「每个物理框被谁占用」——全系统一张表，条目数等于物理页框数（256MB 内存 = 64K 条），与进程数、地址空间大小彻底解耦。代价是查表方式变了：虚拟页号不再是下标，要经哈希或相联查找定位；共享页的映射关系也更复杂。x86 选择正向多级，PowerPC 选择反向——两条路线各付各的代价。",
        ],
        mechanism: [
          "二级切分：32 位地址 = 10 位页目录索引 + 10 位页表索引 + 12 位偏移。CR3 指向页目录；页目录项的 present 位为 0 表示该 4MB 区间整体未映射——下级页表不存在，访问即缺页（若区间合法则按需分配页表页）。",
          "按需分配的账：只映射 5MB（代码 4MB + 栈 1MB）的进程需要页目录 1 页（4KB）+ 页表页 ⌈5MB/4MB⌉×… 精确算：代码 4MB 占 1 张完整页表（1024 项）+ 栈 1MB 占 1 张页表（256 项有效）——共 1 目录 + 2 页表 = 12KB，对比单级 4MB，省了 99.7%。",
          "四级（x86-64）：48 位地址 = PML4 + PDPT + PD + PT 各 9 位 + 偏移 12 位。每多一级，寻址范围扩大 512 倍（9 位 = 512 项）；五级（LA57）把地址扩到 57 位。巨页在叶子层直接「跳级」——PD 项直接指向 2MB 页框，少一层页表也少一次访存。",
          "反向页表（倒排）：表项 = (进程 ID, 虚拟页号) → 物理框号，按物理框排序。查表 = 用 (PID, VPN) 哈希/相联搜索；TLB 缺失的代价高于正向（哈希冲突与链），但表本身与进程数无关、内存占用恒定。共享内存与 COW 的多映射需要表项内的引用计数与链表——复杂度的集中地。",
        ],
        example: {
          title: "二级页表的按需分配账本",
          language: "python",
          code: "PAGE_SIZE = 4096\nENTRY = 4                       # 每个页表项 4 字节\nENTRIES_PER_TABLE = PAGE_SIZE // ENTRY   # 1024\n\ndef two_level_cost(mapped_regions):\n    \"\"\"mapped_regions: [(起始虚拟地址, 长度)]，返回页表页占用\"\"\"\n    tables = set()\n    for start, length in mapped_regions:\n        first_vpn = start // PAGE_SIZE\n        last_vpn = (start + length - 1) // PAGE_SIZE\n        for vpn in range(first_vpn, last_vpn + 1):\n            tables.add(vpn >> 10)          # 高 10 位 = 页目录索引 = 页表页编号\n    # + 1 张页目录（常驻）\n    return len(tables) + 1\n\nsingle = (2**32 // PAGE_SIZE) * ENTRY   # 单级：4MB\nregions = [(0x08048000, 4 * 1024 * 1024), (0xBFFF0000 - 1024*1024, 1024*1024)]\ncost_pages = two_level_cost(regions)\nprint(f\"单级页表: {single/1024:.0f} KB/进程\")\nprint(f\"二级页表: {cost_pages} 页 = {cost_pages * 4} KB/进程（仅映射 5MB 时）\")\n# 单级 4096 KB vs 二级 12 KB —— 省 99.7%",
          explanation:
            "账本的核心变量是「页表页的数量」：二级结构下每张页表页覆盖 4MB（1024 页 × 4KB），只映射 5MB 的进程最多碰 2 张页表页，加上常驻的页目录共 12KB。单级页表无论进程用不用，4096KB 先花出去——而且要求物理连续。按需分配同时解决了「空间」与「连续性」两个问题，这是多级页表能成为主流的根本原因。TLB 的存在让多查一次表的代价平时不出现——两者的配合缺一不可。",
        },
        practiceSteps: [
          "手算题面三问，与代码对答案。",
          "对 64 位四级页表做位数切分（48 位 / 5 级 57 位），算每级覆盖的范围。",
          "用 /proc/self/pagemap 或 pmap 观察一个进程的页表项分布与巨页使用。",
          "构造稀疏地址空间（mmap 大区间只碰首尾），对比多级页表的页表页增长。",
        ],
        masteryChecklist: [
          "能解释单级页表的 4MB 问题与多级按需分配的省法。",
          "能完成地址位数的多级切分并计算页表页数量。",
          "能对比正向多级与反向页表的查表方式、内存占用与共享复杂度。",
        ],
        summary: [
          "单级页表 4MB/进程是稀疏地址空间的冤枉账。",
          "多级页表按需分配：空洞不付钱，TLB 兜住多级访存。",
          "巨页减少层数与 TLB 压力，代价是碎片与 COW 粒度。",
          "反向页表全系统一张、与进程数解耦，查表靠哈希——共享映射复杂。",
        ],
        terms: [
          {
            term: "页目录",
            plain: "多级页表的第一级：记录「哪些下级页表存在」。",
            detail: "present 位为 0 的目录项代表整段 4MB 未映射——连下级页表都不存在，这是省内存的关键机关。",
          },
          {
            term: "反向页表",
            plain: "按物理页框索引的全系统唯一页表。",
            detail: "表项数与物理内存成正比、与进程数无关。查表用哈希/相联，共享映射处理复杂。",
          },
          {
            term: "巨页",
            plain: "2MB/1GB 的大页：一张页表项覆盖更大范围。",
            detail: "TLB 条目变相扩容，缺页次数下降；代价是内部碎片（2MB 内只用一点也占 2MB）与 COW 粒度变粗。",
          },
          {
            term: "页表隔离",
            plain: "每个进程（含内核切换）独立的页表视图。",
            detail: " meltdown 漏洞的缓解手段（KPTI）：内核页表项从用户态页表中摘除——安全与性能的又一笔交易。",
          },
        ],
      },
    },
    questions: [
      {
        key: "operating-systems-exp-os-multilevel-pagetable-s1",
        stageKey: "os-memory-stage",
        topicKey: "os-multilevel-pagetable",
        type: "single",
        stem: "32 位系统、4KB 页、每个页表项 4 字节。某进程仅映射了 5MB 地址空间（代码 4MB + 栈 1MB，分布在两个不同的 4MB 对齐区间）。采用二级页表时，该进程的页目录与页表页共占用多少内存？",
        options: [
          { key: "A", text: "4MB（与单级页表相同，多级只是换了个组织方式）" },
          { key: "B", text: "约 12KB（1 张页目录 + 2 张页表页，按需分配）" },
          { key: "C", text: "8KB（两张页表页，页目录不需要）" },
          { key: "D", text: "约 20KB（每映射 1MB 需要 4 张页表页）" },
        ],
        answer: ["B"],
        explanation:
          "二级切分：页目录 10 位 + 页表 10 位 + 偏移 12 位。一张页表页覆盖 4MB（1024 项 × 4KB）——代码 4MB 占满 1 张页表页，栈 1MB 落在另一张页表页，共 2 张页表页；页目录 1 张常驻（1024 项 × 4B = 4KB）。合计 3 页 × 4KB = 12KB。对比单级页表的 4MB（无论进程用多少），省了 99.7%——省的机制是「未映射区间的下级页表根本不存在」，页目录的无效项只花 4 字节。多级的核心价值不是「换个组织方式」（A），而是按需分配。",
        difficulty: "medium",
        tags: ["多级页表", "按需分配", "计算题"],
        sourceKey: "linux-kernel",
        level: "进阶",
      },
      {
        key: "operating-systems-exp-os-multilevel-pagetable-j1",
        stageKey: "os-memory-stage",
        topicKey: "os-multilevel-pagetable",
        type: "judge",
        stem: "反向页表（倒排页表）的条目数与系统的进程数量成正比，进程越多页表越大，这与正向多级页表的空间特性正好相反。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "方向说反了。反向页表按物理页框索引——表项数 = 物理内存的页框数，与进程数量、虚拟地址空间大小完全解耦：256MB 物理内存就是 64K 个条目，无论上面跑 1 个还是 1000 个进程。这正是它相对正向页表的空间优势（正向页表每进程一份，进程数翻倍页表内存翻倍）。反向页表真正的代价在查表侧：虚拟页号不再是下标，需要哈希/相联查找定位，且一个物理框可能被多个进程的虚拟页映射（共享内存、COW），表项要挂链处理多映射——复杂度从空间转移到了查表与共享语义上。",
        difficulty: "medium",
        tags: ["反向页表", "空间特性", "概念辨析"],
        sourceKey: "rcore-tutorial",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "operating-systems",
    stageKey: "os-process-stage",
    topic: {
      key: "os-userlevel-threads",
      title: "用户级线程与协程：调度权回到用户手里",
      summary:
        "内核线程的每次切换都要陷入内核——几十微秒的固定税。用户级线程/协程把切换搬回用户态：保存几个寄存器、换一个栈指针，纳秒级完成；代价是阻塞式系统调用会卡住整个宿主线程，调度权与阻塞语义要自己管理。",
      concepts: ["用户级 vs 内核级线程", "协程与有栈/无栈", "协作式调度与让出点", "M:N 模型与调度器", "阻塞系统调用的化解"],
      principles: [
        "内核线程切换 = 两次模式切换 + 内核调度器决策，成本微秒级；协程切换 = 保存/恢复少量寄存器 + 换栈指针，成本纳秒级（10-100 倍差距）。",
        "协作式调度：协程只在显式让出点（await/yield）交出控制权——无抢占，切换点可预测；代价是一个不让出的死循环饿死所有兄弟协程。",
        "有栈协程每协程独立栈（MB 级，可百万级并发但内存可观）；无栈协程（async/await）把状态存进状态机对象，栈就是调用栈本身。",
        "M:N 模型的经典难题：一个协程做阻塞系统调用会卡死宿主内核线程上的所有协程——解法是阻塞前迁移其他协程或全异步化。",
      ],
      applications: [
        "Go 的 goroutine 是 M:N 有栈协程：阻塞调用由运行时接管（netpoller 转异步 + 迁移 goroutine），体验接近线程。",
        "async/await（Rust/JS/Python）是无栈协程：编译器生成状态机，配合事件循环（epoll）实现单线程万级并发。",
        "数据库连接池与代理服务用协程摊薄线程栈开销：百万连接场景下每线程 1MB 栈是物理不可能。",
      ],
      pitfalls: [
        "协程里调用阻塞系统调用（同步 sleep、同步 DNS）——整个宿主线程被卡，同线程所有协程陪葬。",
        "以为协程能利用多核——单线程事件循环只用一核，CPU 密集任务必须配合多进程/多线程分摊。",
        "协作式调度的饿死：一个计算密集协程不让出，事件循环整条停摆——让出点是协议不是可选项。",
      ],
      method:
        "选型题先算并发规模与切换成本：万级以上并发连接选协程；CPU 密集选多进程/线程；阻塞库调用无法避免时选内核线程或 Go 类运行时托管模型。",
      exercise:
        "分别用「每连接一线程」与「协程 + epoll」实现一个回显服务，压测 10000 并发连接的内存占用与切换开销；再在协程版本里插入一个同步 sleep(5)，观察全部协程的阻塞。",
      checkpoint: "能对比内核线程与协程的切换成本构成，能解释 M:N 模型的阻塞系统调用难题及其解法。",
      lesson: {
        overview: [
          "线程的粒度问题在万级并发时代爆发：内核线程的栈以 MB 计、切换要陷入内核（保存全部寄存器、过调度器、可能换核）——1 万个连接就是 1 万个内核线程、10GB 栈内存，物理不可能。用户级线程/协程把调度权收回用户态：切换就是换一个保存好的上下文，纳秒级；栈可以按需增长或干脆不要（无栈）。",
          "协程的两种形态对应两种实现哲学。有栈协程（goroutine、Lua coroutine）每个协程真有一个栈，可以在任意函数深度挂起——语义最接近线程；无栈协程（async/await）没有独立栈，编译器把 await 点切开变成状态机——挂在事件循环上，内存极省但「不能在普通函数里 await」的限制贯穿语言设计。",
          "协作式调度是协程的纪律：控制权只在让出点交出。这带来可预测的切换（没有抢占打断的竞态窗口，很多地方不需要锁）与致命的饿死风险（一个不让出的循环卡死全场）。Go 的运行时用抢占式 GC 扫描点与异步抢占把「纪律」半自动化；async 生态靠约定（每 await 一次就是一次礼让）。让出点的分布就是协程程序的健康度。",
        ],
        mechanism: [
          "切换成本解剖：内核线程切换 = 用户态→内核态（保存用户寄存器）→ 调度决策 → 换栈 → 内核态→用户态，外加缓存/TLB 污染——微秒级。协程切换 = 保存 PC 与少量 callee-saved 寄存器 + 换栈指针——几十纳秒，缓存几乎不污染（同核连续跑）。两者 10-100 倍的差距决定了万级并发的技术选型。",
          "M:N 调度：M 个协程复用 N 个内核线程。运行时维护「可运行协程队列」，内核线程从队列取协程执行；协程让出则归还线程。关键难题是阻塞系统调用：协程同步 read 时宿主线程被内核挂起——Go 的 netpoller 把网络 IO 全部转成异步（协程让出，fd 注册 epoll，数据就绪后协程重新入队），文件 IO 则由线程池代理——「阻塞发生在运行时内部而不是线程上」。",
          "有栈 vs 无栈：有栈协程的栈从几 KB 起按需增长（分段栈/连续栈），挂起点可以是任意函数深度；无栈协程编译成状态机，每个 await 是一个状态边界，协程对象只存「活过 await 的局部变量」——内存极省，但跨函数的 await 需要语言级传染（async 关键字沿调用链传播）。",
          "与操作系统的接口：协程运行时本身是内核线程上的普通程序——epoll、定时器、信号最终还是要走内核设施。协程不是替代操作系统，而是在「线程」这个昂贵资源之上做一层用户态复用——与页缓存之于磁盘、虚拟内存之于物理内存，是同一种「加一层间接」的体系结构手法。",
        ],
        example: {
          title: "协程切换 vs 线程切换的成本对照",
          language: "python",
          code: "import asyncio, threading, time\n\nN = 100_000\n\ndef bench_coroutines():\n    async def worker():\n        await asyncio.sleep(0)          # 让出点：挂起再恢复\n    async def main():\n        tasks = [worker() for _ in range(N)]\n        await asyncio.gather(*tasks)\n    t0 = time.time()\n    asyncio.run(main())\n    return time.time() - t0             # 10 万协程创建+调度 ≈ 1-2s\n\ndef bench_threads(count=10_000):\n    ts = []\n    t0 = time.time()\n    for _ in range(count):\n        th = threading.Thread(target=lambda: None)\n        th.start(); ts.append(th)\n    for th in ts: th.join()\n    return time.time() - t0             # 1 万内核线程 ≈ 数秒 + MB 级栈\n\nprint(f\"10 万协程: {bench_coroutines():.2f}s\")\nprint(f\"1 万线程  : {bench_threads():.2f}s\")",
          explanation:
            "数字不会说谎：10 万个协程的创建与调度比 1 万个内核线程还快——因为协程切换只是用户态的上下文交换（几百纳秒），而线程创建要向内核申请栈、注册调度实体（微秒到毫秒级）。内存侧更悬殊：goroutine 起步 2-8KB 可增长，内核线程栈固定 MB 级。万级并发连接的场景里，「线程」这个资源的物理上限就是协程存在的理由。代价同样清晰：协程里的阻塞调用是全局毒药，要么运行时托管（Go），要么生态全异步化（async/await）。",
        },
        practiceSteps: [
          "跑协程与线程的基准对比，记录创建/切换/内存三个数字。",
          "在协程里插入同步 sleep 与同步 requests.get，观察全协程阻塞的现场。",
          "用 go tool trace 或 py-spy 观察协程调度器的让出点分布。",
          "把回显服务分别用线程池与 asyncio 实现，压测 1 万连接的内存与延迟。",
        ],
        masteryChecklist: [
          "能对比内核线程与协程的切换成本构成（数量级差异）。",
          "能解释 M:N 模型的阻塞系统调用难题与运行时托管/异步化的解法。",
          "能区分有栈与无栈协程的实现差异及各自的语言影响。",
        ],
        summary: [
          "协程切换纳秒级（换寄存器+栈指针），线程切换微秒级（陷内核）。",
          "协作式调度：让出点是协议，不让出即饿死全场。",
          "M:N 的阻塞难题靠运行时托管（netpoller/线程池）化解。",
          "有栈协程任意深度挂起、无栈协程内存极省——形态决定语言设计。",
        ],
        terms: [
          {
            term: "协程",
            plain: "用户态的执行流：切换不进内核，成本纳秒级。",
            detail: "调度权在运行时/应用手里。协作式让出是纪律，饿死是失控的代价。",
          },
          {
            term: "有栈协程",
            plain: "每个协程有自己独立的调用栈（可增长）。",
            detail: "可以在任意函数深度挂起恢复——语义最接近线程。栈内存是它的成本项。",
          },
          {
            term: "无栈协程",
            plain: "编译成状态机的协程：没有独立栈，状态存在对象里。",
            detail: "async/await 的实现形态。await 是状态边界，跨函数传染是它的语言级代价。",
          },
          {
            term: "M:N 模型",
            plain: "M 个用户协程复用 N 个内核线程。",
            detail: "阻塞系统调用卡宿主线程是它的经典难题；Go 的 netpoller 与线程池代理是主流解法。",
          },
        ],
      },
    },
    questions: [
      {
        key: "operating-systems-exp-os-userlevel-threads-s1",
        stageKey: "os-process-stage",
        topicKey: "os-userlevel-threads",
        type: "single",
        stem: "一个 M:N 模型的协程运行时中，某个协程调用了阻塞式 DNS 解析（同步系统调用）。对同一线程上其他协程的影响是？",
        options: [
          { key: "A", text: "无影响：每个协程有独立的内核线程，阻塞互不干扰" },
          { key: "B", text: "宿主内核线程被内核挂起等待解析完成，同线程上所有协程都无法被调度，直到解析返回" },
          { key: "C", text: "运行时会自动把该协程 kill 掉以保护其他协程" },
          { key: "D", text: "其他协程会被迁移到其他线程继续执行，由硬件中断自动触发" },
        ],
        answer: ["B"],
        explanation:
          "这正是 M:N 模型的经典难题：阻塞系统调用把宿主内核线程整个交给内核挂起——该线程上的全部协程陪葬，直到系统调用返回。成熟运行时的化解手段是「阻塞发生在运行时内部而不是线程上」：Go 的 netpoller 把网络 IO 转成 epoll 异步（协程让出、fd 注册、就绪后重新入队），文件 IO 由线程池代理；D 的自动迁移需要运行时在「即将阻塞」前感知——纯用户态无法感知内核即将挂起，必须显式钩子。选型含义：协程生态里用同步阻塞库是性能毒药，必须用异步原生库或运行时托管的语言（Go）。",
        difficulty: "hard",
        tags: ["M:N 模型", "阻塞系统调用", "协程调度"],
        sourceKey: "linux-kernel",
        level: "综合",
      },
      {
        key: "operating-systems-exp-os-userlevel-threads-j1",
        stageKey: "os-process-stage",
        topicKey: "os-userlevel-threads",
        type: "judge",
        stem: "无栈协程（async/await）的每个协程需要独立分配一块 MB 级的调用栈，以便在任意函数深度挂起和恢复。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "MB 级独立栈是有栈协程（goroutine、Lua）的形态。无栈协程没有独立栈：编译器把 async 函数转换成状态机对象，每个 await 点是状态边界——「挂起」只是记下当前状态编号，「恢复」是跳回对应状态继续。协程对象里只保存「活过 await 点的局部变量」，通常几百字节——百万级并发在内存上可行。代价是语言级的传染性：await 只能出现在 async 函数里，调用链上每个环节都要 async 化。有栈与无栈的取舍是「任意深度挂起 + 栈内存」vs「状态机 + 极致内存」，没有绝对优劣。",
        difficulty: "medium",
        tags: ["无栈协程", "async/await", "状态机"],
        sourceKey: "linux-kernel",
        level: "进阶",
      },
    ],
  },
];
