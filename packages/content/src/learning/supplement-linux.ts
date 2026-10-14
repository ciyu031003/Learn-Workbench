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

/** Linux 运维 补充题库（按知识点细分，2 题/知识点：1 单选 + 1 判断）。 */
export const linuxSupplementQuestions: LearningQuestion[] = [
  // ===== linux-filesystem =====
  singleQuestion({ key: "linux-sup-linux-filesystem-s1", stageKey: "linux-shell-files", topicKey: "linux-filesystem",
    stem: "在 Linux 文件系统层级（FHS）中，下列关于根目录下常见目录用途的说法，哪项正确？",
    options: [
      "/home 是普通用户的家目录父目录，每个用户拥有形如 /home/alice 的独立子目录",
      "/etc 主要存放用户的可执行程序与命令，是二进制文件集中地",
      "/tmp 用于存放系统启动后只读的内核镜像与启动文件",
      "/var 专门存放所有用户家目录的备份压缩包",
    ],
    answer: "A",
    explanation: "依据文件系统层级标准，/home 是普通用户家目录的父目录，每个用户拥有独立子目录用于存放个人文件与配置；/etc 存放系统配置文件而非可执行程序（二进制多在 /bin、/usr/bin）；/tmp 是可读写的临时目录；/var 存放经常变化的数据如日志与缓存。因此只有 A 正确。",
    difficulty: "easy", tags: ["文件系统", "目录结构"], sourceKey: "command-line-reference", level: "入门" }),
  judgeQuestion({ key: "linux-sup-linux-filesystem-j1", stageKey: "linux-shell-files", topicKey: "linux-filesystem",
    stem: "在 Linux 中，以单个点号 . 开头的文件或目录表示隐藏文件，基础命令 ls 不带参数时默认不会显示它们，必须加 -a 才能看到。",
    answer: true,
    explanation: "以 . 开头的条目在 Unix/Linux 约定中被视为隐藏文件或目录，例如 .bashrc。基础命令 ls 默认只列出非隐藏项，必须加 -a（或 -A）选项才能显示这些隐藏条目。这一约定源自早期 ls 跳过以 . 开头条目的实现，并沿用至今，是路径与文件管理的基本常识。",
    difficulty: "easy", tags: ["文件系统", "隐藏文件"], sourceKey: "command-line-reference", level: "入门" }),

  // ===== linux-permissions =====
  singleQuestion({ key: "linux-sup-linux-permissions-s1", stageKey: "linux-shell-files", topicKey: "linux-permissions",
    stem: "某文件权限位显示为 -rwxr-xr--，其对应的八进制（数字）权限表示最可能是下列哪一个？",
    options: [
      "754",
      "777",
      "640",
      "644",
    ],
    answer: "A",
    explanation: "权限串 -rwxr-xr-- 拆解为：属主 u 为 rwx=4+2+1=7，属组 g 为 r-x=4+0+1=5，其他 o 为 r--=4+0+0=4，因此八进制为 754；首位 - 表示普通文件（目录为 d）。常见混淆 644 对应 rw-r--r--、777 对应 rwxrwxrwx，均不符合题面所示权限分布。",
    difficulty: "easy", tags: ["权限", "八进制"], sourceKey: "linux-system-reference", level: "入门" }),
  judgeQuestion({ key: "linux-sup-linux-permissions-j1", stageKey: "linux-shell-files", topicKey: "linux-permissions",
    stem: "在 Linux 中，chmod 777 filename 会将该文件设置为所有用户（属主、属组、其他）都拥有读、写、执行权限，这在生产环境中通常存在严重的安全风险。",
    answer: true,
    explanation: "数字 777 展开为 ugo 均为 rwx，即对任何用户开放完全的读、写、执行权限。对普通数据或脚本赋予全局可写会导致任意用户篡改内容，对可执行文件则可能被植入恶意代码，因此在生产环境应尽量避免使用 777，仅对确需共享的目录谨慎设置最小必要权限。",
    difficulty: "easy", tags: ["权限", "安全"], sourceKey: "linux-system-reference", level: "入门" }),

  // ===== linux-text-pipeline =====
  singleQuestion({ key: "linux-sup-linux-text-pipeline-s1", stageKey: "linux-shell-files", topicKey: "linux-text-pipeline",
    stem: "在 Shell 管道中，命令 cat file.txt | grep 'foo' | wc -l 的实际作用是下列哪一项？",
    options: [
      "统计 file.txt 中包含字符串 'foo' 的行数",
      "统计 file.txt 中包含字符串 'foo' 的单词个数",
      "统计 file.txt 中 'foo' 出现的总字符数",
      "列出 file.txt 中所有含 'foo' 的行并自动去重",
    ],
    answer: "A",
    explanation: "该管道先将 file.txt 内容交给 grep，grep 'foo' 筛选出包含字符串 foo 的每一行；随后 wc -l 统计输入中的换行符数量即行数，因此整体含义是统计包含 foo 的行数。wc -l 计的是行数而非单词数或字符数，grep 默认也不去重，故其余选项均不正确。",
    difficulty: "easy", tags: ["管道", "文本处理"], sourceKey: "command-line-reference", level: "入门" }),
  judgeQuestion({ key: "linux-sup-linux-text-pipeline-j1", stageKey: "linux-shell-files", topicKey: "linux-text-pipeline",
    stem: "在 Linux 管道中，grep 的 -v 选项表示“反向匹配”，即只输出那些不包含指定模式的行，常用于过滤注释行。",
    answer: true,
    explanation: "grep -v（invert match）会反转匹配逻辑：默认 grep 输出包含模式的行，加 -v 后改为输出所有不包含该模式的行。这在过滤掉注释行（如 grep -v '^#'）或排除特定日志时非常实用，是文本处理流水线中配合管道进行过滤的核心技巧之一。",
    difficulty: "easy", tags: ["管道", "grep"], sourceKey: "command-line-reference", level: "入门" }),

  // ===== linux-process-system =====
  singleQuestion({ key: "linux-sup-linux-process-system-s1", stageKey: "linux-process-system", topicKey: "linux-processes",
    stem: "在 Linux 中，想要查看当前系统中所有进程的完整快照信息（包括其他用户的进程），最常用且信息最全的命令是？",
    options: [
      "ps aux",
      "jobs",
      "ls /proc",
      "top -b",
    ],
    answer: "A",
    explanation: "ps aux 是查看进程快照的经典用法：a 显示所有终端的进程，u 以用户友好格式展示 CPU、内存、命令等，x 包含无控制终端的进程（如守护进程），可一次性列出全部进程的详细信息。jobs 只显示当前 shell 的后台任务，/proc 是内核接口而非命令，top 是动态实时视图而非快照。",
    difficulty: "medium", tags: ["进程", "ps"], sourceKey: "linux-system-reference", level: "进阶" }),
  judgeQuestion({ key: "linux-sup-linux-process-system-j1", stageKey: "linux-process-system", topicKey: "linux-processes",
    stem: "在 Linux 中，信号 SIGKILL（编号 9）可以被进程捕获并忽略或自定义处理，因此 kill -9 有时无法立即终止目标进程。",
    answer: false,
    explanation: "SIGKILL（9 号信号）是系统保留的强制终止信号，由内核直接销毁进程，进程既不能捕获、也不能忽略或阻塞它，因此 kill -9 几乎总能立即结束目标。与之相对，SIGTERM（15）才允许进程注册处理函数进行清理后再退出。说 SIGKILL 可被忽略是常见误解，该判断错误。",
    difficulty: "medium", tags: ["进程", "信号"], sourceKey: "linux-system-reference", level: "进阶" }),

  // ===== linux-processes =====
  singleQuestion({ key: "linux-sup-linux-processes-s1", stageKey: "linux-process-system", topicKey: "linux-processes",
    stem: "使用 top 观察进程时，某进程 %CPU 长期接近 100%，而系统整体 load average 却很低。这最可能是因为？",
    options: [
      "该进程是单线程且运行在单核上，受单个 CPU 核心算力上限约束",
      "系统开启超线程使所有核心算力翻倍，所以负载被低估",
      "进程被 cgroup 限制为只能使用 1% 的 CPU",
      "负载平均值只统计磁盘 I/O，根本不统计 CPU",
    ],
    answer: "A",
    explanation: "单线程进程只能在一个 CPU 核心上并发执行，因此在多核机器上其 %CPU 最多约 100%（一个核心满载）。系统 load average 反映处于可运行或不可中断状态的任务数，多核下整体负载被多核分摊，故单进程满载不一定抬高总负载。负载同时包含 CPU 与不可中断 I/O 等待，并非只计磁盘。",
    difficulty: "medium", tags: ["进程", "资源"], sourceKey: "linux-system-reference", level: "进阶" }),
  judgeQuestion({ key: "linux-sup-linux-processes-j1", stageKey: "linux-process-system", topicKey: "linux-processes",
    stem: "在 Linux 中，进程号（PID）为 1 的通常是 init 或 systemd，由内核在启动时最先创建，并负责收养所有父进程先退出的孤儿进程。",
    answer: true,
    explanation: "内核完成启动后会运行第一个用户态进程，现代发行版中即 systemd（老系统为 init/SysV init），其 PID 固定为 1。它作为所有进程的始祖，当某进程的父进程先于其退出时，该孤儿进程会被重新挂载到 PID 1 之下由其接管，确保系统内没有“无主”进程导致资源泄漏。",
    difficulty: "medium", tags: ["进程", "PID1"], sourceKey: "linux-system-reference", level: "进阶" }),

  // ===== linux-systemd =====
  singleQuestion({ key: "linux-sup-linux-systemd-s1", stageKey: "linux-process-system", topicKey: "linux-systemd",
    stem: "在采用 systemd 的发行版上，要让某服务（如 nginx）在系统开机时自动启动，应使用下列哪条命令？",
    options: [
      "systemctl enable nginx",
      "systemctl start nginx",
      "systemctl restart nginx",
      "systemctl daemon-reload",
    ],
    answer: "A",
    explanation: "systemctl enable 会在对应 .service 单元与启动目标（如 multi-user.target）之间建立符号链接，从而把服务注册为开机自启。start 只是本次立即启动但不保证下次开机运行；restart 用于重启已加载的服务；daemon-reload 仅重新加载 unit 文件定义，并不改变启用状态，四者在持久化自启目的上并不等价。",
    difficulty: "medium", tags: ["systemd", "服务管理"], sourceKey: "linux-system-reference", level: "进阶" }),
  judgeQuestion({ key: "linux-sup-linux-systemd-j1", stageKey: "linux-process-system", topicKey: "linux-systemd",
    stem: "在 systemd 中，执行 systemctl daemon-reload 会重新读取所有 unit 文件，但它本身并不会自动启动或重启任何已修改的服务。",
    answer: true,
    explanation: "daemon-reload 的作用是通知 systemd 重新扫描并解析磁盘上的 unit 配置文件（例如新增或修改了 /etc/systemd/system 下的服务文件），使配置生效。它仅刷新管理器的内部定义，既不启动服务也不重启服务；要让改动真正运行，还需显式执行 start 或 restart 等命令。",
    difficulty: "medium", tags: ["systemd", "重载"], sourceKey: "linux-system-reference", level: "进阶" }),

  // ===== linux-logs =====
  singleQuestion({ key: "linux-sup-linux-logs-s1", stageKey: "linux-process-system", topicKey: "linux-logs",
    stem: "在 systemd 系统中，想要查看某服务（如 sshd）本次启动以来的日志并按时间排序，最快捷的命令是？",
    options: [
      "journalctl -u sshd",
      "cat /var/log/sshd.log",
      "dmesg | grep sshd",
      "tail -f /var/log/messages",
    ],
    answer: "A",
    explanation: "journalctl -u sshd 专用于查询 systemd 日志中单元 sshd.service 的记录，输出按时间先后排列，并能跨重启聚合。传统 syslog 文件在启用 journald 后可能为空或不完整；dmesg 只显示内核环形缓冲区消息，不含服务应用日志；因此按服务查日志的标准做法就是 -u 指定单元名。",
    difficulty: "medium", tags: ["日志", "journalctl"], sourceKey: "linux-system-reference", level: "进阶" }),
  judgeQuestion({ key: "linux-sup-linux-logs-j1", stageKey: "linux-process-system", topicKey: "linux-logs",
    stem: "在 Linux 中，/var/log 目录专门用于存放系统运行期不断变化的日志、缓存与邮件队列等数据；其中 /var/log/messages（或 syslog）通常记录系统级通用日志。",
    answer: true,
    explanation: "根据文件系统层级标准（FHS），/var 存放“可变数据”，/var/log 是日志主目录，由各类守护进程与系统组件写入运行期记录。/var/log/messages 或 /var/log/syslog 承载通用系统消息（认证、内核、服务启动等），是故障排查时首先查看的证据来源，这一划分是运维取证的基础。",
    difficulty: "medium", tags: ["日志", "取证"], sourceKey: "linux-system-reference", level: "进阶" }),

  // ===== linux-network-storage =====
  singleQuestion({ key: "linux-sup-linux-network-storage-s1", stageKey: "linux-network-storage", topicKey: "linux-network",
    stem: "在 Linux 上要把远程 NFS 共享挂载到本地 /mnt/data 目录，下列流程中最关键且不可缺少的一步是？",
    options: [
      "确保内核已加载对应文件系统模块，并通过 mount 命令或 /etc/fstab 把远程路径映射到本地挂载点",
      "直接把远程文件复制到本地即可，无需任何挂载操作",
      "修改 /etc/passwd 添加远程用户账户",
      "必须整体关闭防火墙，否则绝对无法访问远程存储",
    ],
    answer: "A",
    explanation: "挂载网络存储（如 NFS）需内核支持相应文件系统，并通过 mount 命令或 /etc/fstab 条目把远程导出路径关联到本地挂载点 /mnt/data，这是访问远端共享的必要步骤。直接复制文件与“挂载”概念不同，修改 passwd 与挂载无关，防火墙可针对端口放行而非必须整体关闭。",
    difficulty: "medium", tags: ["网络存储", "挂载"], sourceKey: "command-line-reference", level: "进阶" }),
  judgeQuestion({ key: "linux-sup-linux-network-storage-j1", stageKey: "linux-network-storage", topicKey: "linux-network",
    stem: "在 Linux 中，df -h 用于显示已挂载文件系统的磁盘空间使用情况（按易读单位），而 du 用于估算目录或文件的磁盘占用量，两者用途不可混用。",
    answer: true,
    explanation: "df（disk free）从文件系统超级块读取整体视图，报告各挂载分区的已用/可用空间，适合查看“磁盘满没满”；du（disk usage）则递归遍历目录统计其中文件实际占用，适合查找“哪个目录最占空间”。前者看分区容量，后者看目录用量，定位问题的层级不同，不可互相替代。",
    difficulty: "medium", tags: ["磁盘", "df/du"], sourceKey: "command-line-reference", level: "进阶" }),

  // ===== linux-network =====
  singleQuestion({ key: "linux-sup-linux-network-s1", stageKey: "linux-network-storage", topicKey: "linux-network",
    stem: "用户报告无法访问某域名网站，但能 ping 通该网站的 IP。下列诊断步骤中，最先应当排查的是？",
    options: [
      "DNS 解析是否正确（如用 dig/nslookup 检查域名到 IP 的映射）",
      "网线是否松动导致物理层断连",
      "远程主机是否已经宕机",
      "本机内存是否不足",
    ],
    answer: "A",
    explanation: "既然能 ping 通目标 IP，说明网络层连通性、路由与远程主机均在运行，问题被收敛到“域名到 IP”的解析环节。此时应优先用 dig 或 nslookup 验证 DNS 是否返回正确 IP，以及 /etc/resolv.conf 是否指向可用 DNS 服务器。物理层、主机宕机、内存均与“能通 IP 不通域名”的现象不符。",
    difficulty: "medium", tags: ["网络诊断", "DNS"], sourceKey: "command-line-reference", level: "进阶" }),
  judgeQuestion({ key: "linux-sup-linux-network-j1", stageKey: "linux-network-storage", topicKey: "linux-network",
    stem: "在 Linux 中，ping 基于 ICMP 协议，仅能验证网络层（IP）连通性，无法证明对端的应用服务（如 Web 80/443 端口）一定可用。",
    answer: true,
    explanation: "ping 发送 ICMP Echo 请求并等待应答，只能说明两台主机之间 IP 层可达、往返路径正常，并不触及传输层端口与上层协议：对端可能禁 ping（防火墙丢弃 ICMP）却服务正常，或者服务进程崩溃但主机仍在线。因此验证 Web 服务还需 curl/nc 等工具探测具体端口。",
    difficulty: "medium", tags: ["网络诊断", "ICMP"], sourceKey: "command-line-reference", level: "进阶" }),

  // ===== linux-ssh =====
  singleQuestion({ key: "linux-sup-linux-ssh-s1", stageKey: "linux-network-storage", topicKey: "linux-ssh",
    stem: "关于 SSH 公钥登录的部署，下列哪一步是必须的？",
    options: [
      "将客户端的公钥内容追加到服务器的 ~/.ssh/authorized_keys 文件中",
      "把服务器私钥下载到本地客户端妥善保存",
      "在服务器端删除 ~/.ssh 目录以增强安全",
      "将客户端私钥通过邮件发送给服务器管理员",
    ],
    answer: "A",
    explanation: "公钥认证的原理是：客户端持有私钥（保密），服务器在其对应用户的 ~/.ssh/authorized_keys 中保存匹配的公钥。登录时服务器用公钥挑战、客户端用私钥签名证明身份。因此必须把客户端公钥（而非私钥）写入服务器 authorized_keys；私钥绝不可外传，删除 .ssh 反而会破坏现有配置。",
    difficulty: "medium", tags: ["SSH", "公钥登录"], sourceKey: "linux-system-reference", level: "进阶" }),
  judgeQuestion({ key: "linux-sup-linux-ssh-j1", stageKey: "linux-network-storage", topicKey: "linux-ssh",
    stem: "为提升 SSH 安全性，将 /etc/ssh/sshd_config 中的 PermitRootLogin 设为 no 可禁止直接使用 root 账户远程登录，从而降低暴力破解风险。",
    answer: true,
    explanation: "允许 root 直接通过 SSH 登录会放大暴力破解的潜在危害，因为攻击者一旦得手即获得最高权限。设为 no 强制管理员先用普通账户登录再 sudo 提权，既符合最小权限原则，也让审计日志能记录实际操作者，是加固 SSH 服务的标准做法之一，可显著降低被攻破的概率。",
    difficulty: "medium", tags: ["SSH", "安全加固"], sourceKey: "linux-system-reference", level: "进阶" }),

  // ===== linux-storage =====
  singleQuestion({ key: "linux-sup-linux-storage-s1", stageKey: "linux-network-storage", topicKey: "linux-storage",
    stem: "在新加一块磁盘并分区后，要使 Linux 能在该分区存放文件，下一步必不可少的顺序是？",
    options: [
      "先对该分区执行 mkfs 创建文件系统，再用 mount 挂载到某个目录",
      "直接 mount 原始分区即可，无需任何格式化",
      "修改 /etc/hostname 后系统会自动识别并使用",
      "用 fdisk 删除分区再重建一次即可直接使用",
    ],
    answer: "A",
    explanation: "裸分区（如 /dev/sdb1）只是连续的扇区块，没有文件系统结构，操作系统无法按文件名存取。必须先用 mkfs.ext4 等在其上创建文件系统（写入超级块、inode 表等元数据），再用 mount 将其关联到某个空目录作为访问入口。未格式化的设备无法直接挂载使用。",
    difficulty: "medium", tags: ["磁盘", "文件系统"], sourceKey: "linux-system-reference", level: "进阶" }),
  judgeQuestion({ key: "linux-sup-linux-storage-j1", stageKey: "linux-network-storage", topicKey: "linux-storage",
    stem: "在 Linux 中，swap 分区或 swap 文件的作用是在物理内存不足时把部分内存页换出到磁盘，从而扩展可用的虚拟内存空间，避免进程因 OOM 被立即杀死。",
    answer: true,
    explanation: "swap 是磁盘上的一块保留区域，当 RAM 紧张时内核的页回收机制会把不常访问的匿名页写入 swap，腾出物理内存给更活跃的任务，从而平滑应对内存峰值。它并非“加速”内存，而是用较慢的磁盘换取更大的虚拟地址空间，是防止 OOM Killer 误杀进程的重要缓冲机制。",
    difficulty: "medium", tags: ["磁盘", "swap"], sourceKey: "linux-system-reference", level: "进阶" }),

  // ===== linux-automation-ops =====
  singleQuestion({ key: "linux-sup-linux-automation-ops-s1", stageKey: "linux-automation-ops", topicKey: "linux-bash",
    stem: "在生产运维中，要每天凌晨对数据库执行一次备份，并希望脚本失败时能自动告警，下列方案最稳妥的是？",
    options: [
      "用 cron 定时调用备份脚本，并在脚本内用 set -e 配合 trap 捕获错误后发送告警",
      "仅靠手工每天登录服务器手动执行备份",
      "把脚本命名为 backup.now 放进 /tmp 即可自动运行",
      "用 while true 死循环替代定时任务来实现重复执行",
    ],
    answer: "A",
    explanation: "自动化运维强调“无人值守+可观测”。cron 负责按时触发，脚本中 set -e 让任意命令失败即退出，trap ERR/EXIT 捕获异常并触发告警（邮件/Webhook），形成闭环。手工执行不可持续，/tmp 命名不会自动运行，死循环既无调度也不具备失败通知能力，均不符合生产可靠要求。",
    difficulty: "hard", tags: ["自动化", "运维"], sourceKey: "algorithms-shell", level: "综合" }),
  judgeQuestion({ key: "linux-sup-linux-automation-ops-j1", stageKey: "linux-automation-ops", topicKey: "linux-bash",
    stem: "可靠的自动化运维脚本应当在执行关键操作前后记录日志、校验返回值，并在异常时及时告警，而不是“静默失败”导致问题被长期掩盖。",
    answer: true,
    explanation: "生产环境最危险的故障往往源于脚本悄悄失败：例如备份因磁盘满而退出却无人知晓，直到需要恢复时才发现备份是空的。因此成熟脚本会用非零退出码、日志落地、退出状态校验与告警通道把“失败”显性化，确保每一个异常都被运维人员看见并跟进，而非被静默掩盖。",
    difficulty: "hard", tags: ["自动化", "可靠性"], sourceKey: "algorithms-shell", level: "综合" }),

  // ===== linux-bash =====
  singleQuestion({ key: "linux-sup-linux-bash-s1", stageKey: "linux-automation-ops", topicKey: "linux-bash",
    stem: "在编写 Bash 脚本时，为防止因中间命令失败而继续执行后续危险操作，应在脚本开头加入下列哪条设置？",
    options: [
      "set -euo pipefail",
      "echo 'start'",
      "#!/bin/bash 即可，无需其他设置",
      "export DEBUG=1",
    ],
    answer: "A",
    explanation: "set -e 使脚本在任何命令返回非零时立即退出；-u 把引用未定义变量当作错误；-o pipefail 让管道中任一环节失败都使整条管道返回非零。三者组合能显著避免“部分失败却被忽略”导致的级联破坏（如删错目录）。它们是 Bash 脚本可靠性的基础防御性设置，其余选项无此保护效果。",
    difficulty: "hard", tags: ["Shell", "脚本可靠性"], sourceKey: "algorithms-shell", level: "综合" }),
  judgeQuestion({ key: "linux-sup-linux-bash-j1", stageKey: "linux-automation-ops", topicKey: "linux-bash",
    stem: "在 Bash 中，变量赋值写为 var = 'hello'（等号两侧加空格）是合法且推荐的写法。",
    answer: false,
    explanation: "Bash 的赋值语法要求等号两侧不能有空格：var='hello' 才正确。若写成 var = 'hello'，Shell 会把 var 当作要执行的命令、= 与 'hello' 当作其参数，从而报 command not found。这是初学者最常见的语法错误，空格会彻底改变语句语义，该写法并不合法也不被推荐。",
    difficulty: "hard", tags: ["Shell", "语法"], sourceKey: "algorithms-shell", level: "综合" }),

  // ===== linux-scheduling =====
  singleQuestion({ key: "linux-sup-linux-scheduling-s1", stageKey: "linux-automation-ops", topicKey: "linux-scheduling",
    stem: "关于 crontab 的时间字段，表达式 0 2 * * 1 表示任务将在何时执行？",
    options: [
      "每周一凌晨 2:00",
      "每天凌晨 2:00",
      "每月 1 号凌晨 2:00",
      "每小时的第 2 分钟",
    ],
    answer: "A",
    explanation: "crontab 五个字段依次为：分 时 日 月 星期。本例 0 2 * * 1 即分钟 0、小时 2、日与月为任意（*）、星期 1（周一），合起来就是“每周一 02:00”。若想每天执行应为 0 2 * * *，每月 1 号则是 0 2 1 * *。星期字段用 0 或 7 均代表周日，需注意字段顺序。",
    difficulty: "hard", tags: ["定时任务", "cron"], sourceKey: "linux-system-reference", level: "综合" }),
  judgeQuestion({ key: "linux-sup-linux-scheduling-j1", stageKey: "linux-automation-ops", topicKey: "linux-scheduling",
    stem: "在 Linux 中，systemd 定时器（timer unit）可作为传统 cron 的替代方案，支持更精细的触发条件（如开机后延迟、单调时间触发）并与日志集成。",
    answer: true,
    explanation: "systemd timer 通过 .timer 单元配合 .service 单元工作，既能表达日历式定时（类似 cron），也能表达“开机后 N 秒”“上次触发后间隔”等单调触发，还天然接入 journald 日志，便于追踪每次执行的输出与成败。它在现代发行版中常被用来取代分散的 crontab 条目，提升可观测性。",
    difficulty: "hard", tags: ["定时任务", "systemd"], sourceKey: "linux-system-reference", level: "综合" }),

  // ===== linux-troubleshooting =====
  singleQuestion({ key: "linux-sup-linux-troubleshooting-s1", stageKey: "linux-automation-ops", topicKey: "linux-troubleshooting",
    stem: "服务器突然变慢且磁盘告警，排查时发现某个日志文件异常巨大。下列处理顺序中最合理的是？",
    options: [
      "先确认文件用途与正在写入的进程，再采用日志轮转或安全清空（而非直接 rm）释放空间",
      "立即 rm -rf 删除该文件以最快释放空间",
      "直接重启服务器掩盖问题",
      "忽略，等磁盘写满后会自然恢复",
    ],
    answer: "A",
    explanation: "对正在被进程占用的文件直接 rm 后，文件描述符仍被持有，磁盘空间不会立即释放，问题被掩盖且日志丢失不利取证。正确做法是先 lsof 确认写入进程、用 logrotate 或向进程发送信号让其重新打开文件（或 truncate 清空），在安全前提下回收空间并修复根因，而非简单删文件。",
    difficulty: "hard", tags: ["故障排查", "日志"], sourceKey: "linux-system-reference", level: "综合" }),
  judgeQuestion({ key: "linux-sup-linux-troubleshooting-j1", stageKey: "linux-automation-ops", topicKey: "linux-troubleshooting",
    stem: "在 Linux 故障排查中，盲目执行 rm -rf / 或杀掉未知 PID 的进程可能扩大故障面，因此任何破坏性操作前都应先确认目标与影响范围。",
    answer: true,
    explanation: "生产排障的第一原则是“先止血、再定位、后修复”，且不可逆操作需二次确认。rm -rf 路径一旦拼错（如变量为空变成删根）或误杀关键系统进程（如数据库、systemd 子进程），会造成数据永久丢失或服务雪崩。成熟运维会先 dry-run、核对 PID 与路径，把爆炸半径控制在最小。",
    difficulty: "hard", tags: ["故障排查", "安全操作"], sourceKey: "linux-system-reference", level: "综合" }),
];
