import type { LearningTopicLesson } from "../types";

export const linuxTopicLessons: Record<string, LearningTopicLesson> = {
  "linux-filesystem": {
    overview: [
      "Linux 用单一目录树组织所有文件系统，挂载把外部存储接到某个目录。绝对路径从根开始，相对路径依赖当前目录。",
      "文件类型不仅包括普通文件和目录，还包括符号链接、设备文件和管道。符号链接是路径转发，硬链接是同一 inode 的多个目录项。",
    ],
    mechanism: [
      "`find` 按目录递归并按条件输出对象，`realpath` 解析链接后的真实路径，`du` 统计空间。",
      "删除目标文件后，符号链接可能失效；硬链接仍指向原对象，直到最后一个链接被删除才释放数据块。",
    ],
    example: {
      title: "按名称查找并安全查看结果",
      language: "bash",
      code: `find /var/log/myapp -type f -name '*.log' -print

find /var/log/myapp -type l -print

# 先预览，再决定是否批量处理。`,
      explanation: "`find` 只输出匹配的普通文件，先查看结果可以避免对目录或链接执行错误操作。",
    },
    practiceSteps: [
      "创建软链接和硬链接，删除目标文件后比较行为。",
      "用绝对路径和相对路径运行同一命令。",
      "在不删除文件的前提下统计日志目录占用。",
    ],
    masteryChecklist: [
      "能解释绝对路径、相对路径和链接类型。",
      "能在执行破坏性命令前先预览目标集合。",
    ],
  },
  "linux-permissions": {
    overview: [
      "Linux 权限由所有者、所属组和其他人三类身份以及读、写、执行三种操作组成。目录的执行位决定能否进入或遍历目录。",
      "服务应使用完成工作所需的最小权限运行。sudo 是受控提权，不是默认工作方式；umask 决定新建文件的默认权限。",
    ],
    mechanism: [
      "`chmod` 修改模式位，`chown` 修改所有者和组，`umask` 从请求权限中屏蔽位。",
      "读取目录需要执行位，写入目录需要写和执行位；无法进入父目录时，即使文件本身可读也可能访问失败。",
    ],
    example: {
      title: "为应用组配置最小权限目录",
      language: "bash",
      code: `sudo groupadd --system app
sudo install -d -o root -g app -m 0750 /srv/app/config
sudo install -d -o app -g app -m 0750 /srv/app/logs
sudo chown -R app:app /srv/app/logs`,
      explanation: "配置目录由 root 管理、应用组只读，日志目录由应用写入。最小权限避免应用修改自己的配置和二进制。",
    },
    practiceSteps: [
      "创建用户和组，分别测试读、写、进入目录权限。",
      "用 `umask` 观察新文件默认权限变化。",
      "为服务账号移除不必要的 sudo 权限。",
    ],
    masteryChecklist: [
      "能解释 rwx 在文件和目录上的不同含义。",
      "能用最小权限原则设计服务目录。",
    ],
  },
  "linux-text-pipeline": {
    overview: [
      "Unix 小工具通过标准输入、标准输出和标准错误组合。管道只连接标准输出，错误仍会显示或进入单独文件。",
      "日志统计常见流程是过滤、字段提取、排序、去重、计数和取前几名。每一步都应单独验证，避免把错误藏在长管道中。",
    ],
    mechanism: [
      "`grep` 选择行，`awk` 按字段处理，`sort` 排序，`uniq -c` 只合并相邻重复行，`xargs` 把标准输入转成参数。",
      "`>` 覆盖文件，`>>` 追加，`2>` 重定向错误；管道中间失败有时不会自动让整条命令失败。",
    ],
    example: {
      title: "统计访问日志状态码 Top 5",
      language: "bash",
      code: `awk '{print $9}' access.log \
  | grep -E '^[0-9]{3}$' \
  | sort \
  | uniq -c \
  | sort -nr \
  | head -n 5`,
      explanation: "先提取状态码字段，再过滤数字状态码，排序后计数并按次数降序取前五。每一步都可以在中间单独运行检查。",
    },
    practiceSteps: [
      "统计某个 URL 的请求次数。",
      "比较管道中的错误和标准输出重定向。",
      "把长管道拆成中间文件并验证每步结果。",
    ],
    masteryChecklist: [
      "能说明标准输出和标准错误的区别。",
      "能用小工具组合完成可验证的日志统计。",
    ],
  },
  "linux-processes": {
    overview: [
      "进程是运行中的程序实例，PID 标识当前命名空间中的进程。父子进程形成进程树，信号用于请求进程改变状态或终止。",
      "负载不只看 CPU：等待 IO、内存压力和调度延迟都可能拉高 load average。必须先判断资源类型，再决定优化。",
    ],
    mechanism: [
      "`ps` 查看快照，`top` 查看动态状态，`kill` 发送信号，`kill -9` 强制终止且不给清理机会。",
      "前后台任务和终端相关进程可能受 SIGHUP 影响；服务通常由 systemd 管理，避免依赖登录会话。",
    ],
    example: {
      title: "先定位进程再温和终止",
      language: "bash",
      code: `ps -eo pid,ppid,stat,pcpu,pmem,etime,cmd --sort=-pcpu | head

# 确认 PID 和启动命令后先发送 TERM
kill -TERM 12345

# 等待退出，必要时再升级信号。`,
      explanation: "先查看父子关系、状态和资源，确认目标后再发送 TERM，让进程有机会保存状态和释放资源。",
    },
    practiceSteps: [
      "启动一个后台任务并查看父子进程。",
      "比较 TERM 和 KILL 对清理逻辑的影响。",
      "解释 load average 高但 CPU 空闲的可能原因。",
    ],
    masteryChecklist: [
      "能读懂进程状态和资源列。",
      "能安全选择信号并验证进程已退出。",
    ],
  },
  "linux-systemd": {
    overview: [
      "systemd 通过 unit 声明服务如何启动、依赖哪些目标、失败后如何重启。服务管理应声明式配置，而不是依赖人工脚本顺序。",
      "状态查询和日志查询是不同证据来源：`systemctl status` 给出当前状态，`journalctl` 给出事件时间线。",
    ],
    mechanism: [
      "`ExecStart` 定义主进程，`Restart` 决定退出后的重启策略，`After` 和 `Wants` 描述启动顺序与依赖。",
      "服务应使用专用用户、WorkingDirectory、EnvironmentFile 和明确输出；频繁重启说明配置或依赖有问题，不能只靠无限重启。",
    ],
    example: {
      title: "最小应用 service",
      language: "ini",
      code: `[Unit]
Description=Learn Workbench API
After=network-online.target

[Service]
User=app
WorkingDirectory=/srv/app
EnvironmentFile=/srv/app/.env
ExecStart=/srv/app/bin/server
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target`,
      explanation: "服务在专用用户下运行，环境从受保护文件读取，失败后延迟重启。日志会进入 journal，便于查看真实退出原因。",
    },
    practiceSteps: [
      "创建一个只监听本地端口的测试服务。",
      "故意让服务启动失败，查看 systemctl 和 journal。",
      "设置重启策略并验证连续失败的行为。",
    ],
    masteryChecklist: [
      "能解释 unit 的启动、依赖和重启配置。",
      "能区分服务状态与日志证据。",
    ],
  },
  "linux-logs": {
    overview: [
      "日志是故障证据，不是聊天记录。有效的日志至少包含时间、对象、操作、结果和必要的上下文。",
      "排障应从最早的异常或第一次偏离正常状态开始，再沿请求、连接或任务链路追踪，而不是只看最后一条错误。",
    ],
    mechanism: [
      "`journalctl -u` 查看服务日志，`--since/--until` 限定时间，`-o json` 适合结构化处理，`follow` 会持续输出。",
      "日志轮转防止磁盘无限增长；关联标识、请求 ID 和版本号能把多个组件的事件串起来。",
    ],
    example: {
      title: "按时间线查看服务失败",
      language: "bash",
      code: `journalctl -u learn-api \
  --since '2026-10-09 10:00:00' \
  --until '2026-10-09 10:15:00' \
  --no-pager -o short-iso`,
      explanation: "固定时间窗和稳定输出格式便于复制时间线。查看最早错误后，再向对应组件查询上游证据。",
    },
    practiceSteps: [
      "为一次请求记录 request id 和关键阶段耗时。",
      "用时间窗查询服务日志并找最早异常。",
      "检查日志轮转策略和当前磁盘占用。",
    ],
    masteryChecklist: [
      "能写出可关联、可过滤的日志字段。",
      "能从时间线定位根因而不是只看最后错误。",
    ],
  },
  "linux-network": {
    overview: [
      "网络排障按本机地址、路由、DNS、端口、对端和防火墙逐层验证。每一层只回答一个问题，避免一次改变很多变量。",
      "监听端口和防火墙放行是独立条件：服务未监听，放行也没用；服务已监听，防火墙仍可能阻断外部访问。",
    ],
    mechanism: [
      "`ip addr` 看地址，`ip route` 看默认路由，`dig` 看 DNS 解析，`ss` 看监听，`curl` 看应用层响应。",
      "TCP 连接建立依赖路由和端口可达；DNS 失败会表现为名称解析错误，但连接 IP 仍可能正常。",
    ],
    example: {
      title: "分层验证一个 API",
      language: "bash",
      code: `ip addr show
ip route get 1.1.1.1
dig +short api.example.com
ss -lntp | grep ':443'
curl -v --connect-timeout 5 https://api.example.com/health`,
      explanation: "命令从地址、路由、DNS、监听和应用响应逐层收集证据。若某层失败，就能缩小后续排查范围。",
    },
    practiceSteps: [
      "用 IP 和域名分别访问同一服务，区分 DNS 与连接问题。",
      "比较本机 curl 和外部 curl 的差异。",
      "记录一次端口未开放问题的完整证据链。",
    ],
    masteryChecklist: [
      "能按层级排查网络而不跳过 DNS 或路由。",
      "能区分监听、防火墙和对端应用错误。",
    ],
  },
  "linux-ssh": {
    overview: [
      "SSH 是远程访问和自动化部署的基础。密钥认证比共享密码更适合脚本，私钥必须保护，公钥才放到服务器。",
      "最小暴露包括限制来源地址、禁用 root 直接登录、关闭不需要的转发，并为部署账号设置最小权限。",
    ],
    mechanism: [
      "客户端用私钥完成挑战，服务端检查授权公钥；known_hosts 防止误连伪造主机。",
      "端口转发、SFTP 和 rsync over SSH 都建立在同一安全通道上，自动化脚本需要超时、批处理和错误退出。",
    ],
    example: {
      title: "安全传输和远程执行",
      language: "bash",
      code: `ssh -o BatchMode=yes -o ConnectTimeout=5 deploy@host \
  'systemctl is-active learn-api'

rsync -az --delete-after \
  ./dist/ deploy@host:/srv/app/public/`,
      explanation: "批处理模式禁止交互输入，连接超时让自动化可终止，rsync 使用压缩和删除远端残留文件，但删除动作只作用于已确认目录。",
    },
    practiceSteps: [
      "为部署账号生成密钥并禁用密码登录。",
      "在 config 中固定主机别名、用户和超时。",
      "用 rsync 传输前先执行 dry-run。",
    ],
    masteryChecklist: [
      "能解释密钥认证、known_hosts 和最小暴露。",
      "能让自动化 SSH 在失败时快速退出。",
    ],
  },
  "linux-storage": {
    overview: [
      "磁盘容量和 inode 是两套独立资源。日志、临时文件、删除但仍被进程打开的文件都可能让空间无法立即释放。",
      "挂载点决定路径看到哪个文件系统。扩容、迁移和清理都需要先确认对象、备份和回滚，不能直接删除未知文件。",
    ],
    mechanism: [
      "`df -h` 看文件系统容量，`df -i` 看 inode，`du -x` 看目录占用，`lsof +L1` 找已删除但仍打开的文件。",
      "挂载覆盖会隐藏原目录内容；解除挂载前必须确认没有进程正在使用目标路径。",
    ],
    example: {
      title: "定位容量增长的来源",
      language: "bash",
      code: `df -h /
df -i /
du -xhd1 /var 2>/dev/null | sort -h | tail -n 10
lsof +L1 2>/dev/null | head`,
      explanation: "先确认容量和 inode，再按目录找占用，最后检查已删除但仍打开的文件。每一步只使用只读命令。",
    },
    practiceSteps: [
      "创建一个 inode 很多的小文件目录并观察 `df -i`。",
      "删除一个仍被进程打开的文件，比较逻辑删除和空间释放。",
      "为日志目录制定轮转和清理策略。",
    ],
    masteryChecklist: [
      "能区分容量、inode 和挂载点问题。",
      "能安全定位空间占用而不盲目删除。",
    ],
  },
  "linux-bash": {
    overview: [
      "可靠脚本应明确参数、失败条件、输出位置和重复执行语义。默认继续执行失败命令会让错误隐藏在后续步骤中。",
      "函数用于封装重复逻辑，临时目录和锁用于隔离并发，日志用于说明脚本实际做了什么。自动化必须考虑部分完成。",
    ],
    mechanism: [
      "`set -euo pipefail` 让未定义变量、失败命令和管道失败更早暴露；`trap` 在退出时清理临时资源。",
      "参数校验应在执行变更前完成，退出码应区分成功、输入错误和运行失败，调用方才能正确重试。",
    ],
    example: {
      title: "带参数校验和清理的脚本骨架",
      language: "bash",
      code: `#!/usr/bin/env bash
set -euo pipefail

target="\${1:?target directory is required}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

[[ -d "$target" ]] || {
  echo "not a directory: $target" >&2
  exit 2
}

echo "preparing $target"`,
      explanation: "缺少参数立即失败，临时目录退出时清理，目标类型在执行前验证。`trap` 使用单引号延迟展开变量。",
    },
    practiceSteps: [
      "为发布准备脚本添加参数校验和退出码。",
      "故意让管道中间命令失败，验证 pipefail。",
      "重复运行脚本，检查是否产生重复资源。",
    ],
    masteryChecklist: [
      "能说明脚本的成功、失败和部分完成状态。",
      "能用 trap、临时目录和退出码保护自动化。",
    ],
  },
  "linux-scheduling": {
    overview: [
      "定时任务解决“何时运行”，但不保证“只运行一次”或“一定按时完成”。任务可能重叠、机器休眠、上一步超时或失败。",
      "互斥锁防止同一任务并发，超时和重试限制资源，通知让失败可见。systemd timer 更适合需要依赖和日志集成的任务。",
    ],
    mechanism: [
      "cron 按周期启动进程；如果上一次未结束，下一次仍可能启动。锁可以由 flock 或应用层实现，但必须自动释放。",
      "重试只适合瞬时错误，输入错误和权限错误无限重试只会制造噪声；重试次数与退避策略要和业务匹配。",
    ],
    example: {
      title: "防止备份任务重叠",
      language: "bash",
      code: `flock -n /var/lock/backup.lock \
  timeout 30m /srv/app/bin/backup

# flock 非阻塞获取失败时立即退出，
# timeout 防止任务无限挂起。`,
      explanation: "锁保证同一时间只有一个备份，超时防止无限占用。任务失败后应发送告警并保留可诊断日志。",
    },
    practiceSteps: [
      "启动两个相同任务观察锁的阻塞行为。",
      "为一个任务增加超时和失败退出码。",
      "记录 cron 与 systemd timer 的执行时间差异。",
    ],
    masteryChecklist: [
      "能说明 cron 不保证任务不会重叠。",
      "能为定时任务定义锁、超时、重试和通知。",
    ],
  },
  "linux-troubleshooting": {
    overview: [
      "故障排查先止血，避免扩大影响；再收集证据定位根因，最后才做长期修复。任何变更都应可回滚并记录时间线。",
      "备份只有在恢复演练成功后才可信。备份目标、频率、保留、加密和恢复命令都必须明确。",
    ],
    mechanism: [
      "分层排障从用户可见症状开始，逐层验证入口、网络、服务、依赖和存储，避免一次改变多个变量。",
      "恢复演练要记录数据点、恢复耗时、校验方式和失败路径，不能只检查备份文件存在。",
    ],
    example: {
      title: "恢复演练记录模板",
      language: "text",
      code: `事故：API 返回 502
开始：10:00
止血：回滚到上一版本 10:04
证据：网关日志、服务退出码、变更记录
恢复：10:18 数据校验通过
复盘：增加部署前健康检查与回滚门禁`,
      explanation: "模板把症状、止血、证据、恢复和复盘分开。时间线可以避免事后记忆偏差，也能验证行动是否有效。",
    },
    practiceSteps: [
      "对一个测试目录做备份并计算校验值。",
      "模拟删除后执行恢复，记录耗时和命令。",
      "为一次故障写时间线和防复发措施。",
    ],
    masteryChecklist: [
      "能遵守先止血、再定位、后复盘的顺序。",
      "能证明备份确实可恢复而不是只存在。",
    ],
  },
};
