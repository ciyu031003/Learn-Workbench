import { topicQuestionPair } from "../topic-question-builders";
import type { LearningQuestion } from "../types";

export const linuxTopicQuestions: LearningQuestion[] = [
  ...topicQuestionPair(
    "linux-filesystem",
    "linux-shell-files",
    {
      stem: "需要先查看匹配对象再决定后续处理，哪个命令组合最合适？",
      options: ["find ... -delete", "find ... -print", "rm -rf 目录", "mv 到临时目录"],
      answer: "B",
      explanation: "find -print 只输出匹配路径，是执行删除或移动前用于预览和确认目标的安全步骤。",
      difficulty: "easy",
      tags: ["find", "预览"],
      sourceKey: "command-line-reference",
    },
    {
      stem: "符号链接删除后，原目标文件一定会立即消失。",
      answer: false,
      explanation: "符号链接只是指向目标的路径，删除链接本身不会删除目标；硬链接语义也不同。",
      difficulty: "medium",
      tags: ["符号链接", "文件"],
      sourceKey: "command-line-reference",
    }
  ),
  ...topicQuestionPair(
    "linux-permissions",
    "linux-shell-files",
    {
      stem: "目录的 r 和 x 权限分别主要控制什么？",
      options: ["读取内容与进入/遍历", "执行程序与写文件", "修改所有者和删除", "查看日志与重启服务"],
      answer: "A",
      explanation: "读权限允许列出目录项，执行权限允许进入或遍历目录，修改目录项还需要写权限。",
      difficulty: "medium",
      tags: ["权限", "目录"],
      sourceKey: "linux-system-reference",
    },
    {
      stem: "服务应以完成工作所需的最小权限运行，而不是默认使用 root。",
      answer: true,
      explanation: "最小权限能限制被利用后的影响范围，配置和二进制也应避免被服务自身修改。",
      difficulty: "easy",
      tags: ["最小权限", "sudo"],
      sourceKey: "linux-system-reference",
    }
  ),
  ...topicQuestionPair(
    "linux-text-pipeline",
    "linux-shell-files",
    {
      stem: "统计访问日志状态码 Top 5 前，为什么通常要先排序再 uniq -c？",
      options: ["uniq 只统计相邻重复行", "sort 会删掉错误", "uniq 需要文件名", "head 会改变数据"],
      answer: "A",
      explanation: "uniq -c 只合并相邻重复行，排序后相同状态码才会集中，计数才准确。",
      difficulty: "medium",
      tags: ["管道", "uniq"],
      sourceKey: "algorithms-shell",
    },
    {
      stem: "管道默认把标准错误也传给下一个命令。",
      answer: false,
      explanation: "管道默认连接标准输出，标准错误通常仍输出到终端，需要显式重定向。",
      difficulty: "medium",
      tags: ["标准错误", "管道"],
      sourceKey: "command-line-reference",
    }
  ),
  ...topicQuestionPair(
    "linux-processes",
    "linux-process-system",
    {
      stem: "要终止一个进程但给它清理资源的机会，通常先发送哪个信号？",
      options: ["SIGKILL", "SIGTERM", "SIGHUP", "SIGSTOP"],
      answer: "B",
      explanation: "SIGTERM 是可处理的正常终止请求；SIGKILL 会立即强制终止且不给清理机会。",
      difficulty: "medium",
      tags: ["信号", "SIGTERM"],
      sourceKey: "linux-system-reference",
    },
    {
      stem: "load average 只反映 CPU 计算压力，与 IO 等待无关。",
      answer: false,
      explanation: "load average 包含运行和不可中断等待任务，IO 等待也可能拉高负载。",
      difficulty: "medium",
      tags: ["load", "IO"],
      sourceKey: "linux-system-reference",
    }
  ),
  ...topicQuestionPair(
    "linux-systemd",
    "linux-process-system",
    {
      stem: "服务连续启动失败时，首先应查看什么？",
      options: ["systemctl status 和 journal 日志", "桌面背景", "CPU 型号", "文件大小"],
      answer: "A",
      explanation: "状态给出退出结果，journal 给出启动和错误时间线，两者结合才能定位依赖或配置问题。",
      difficulty: "easy",
      tags: ["systemd", "journalctl"],
      sourceKey: "linux-system-reference",
    },
    {
      stem: "无限重启可以替代对启动失败根因的排查。",
      answer: false,
      explanation: "无限重启会制造日志和资源噪声，应先修复配置、权限或依赖，再设置合理重启策略。",
      difficulty: "medium",
      tags: ["重启策略", "排障"],
      sourceKey: "linux-system-reference",
    }
  ),
  ...topicQuestionPair(
    "linux-logs",
    "linux-process-system",
    {
      stem: "定位一次故障时，日志中最重要的证据是什么？",
      options: ["最多颜色的文本", "时间、对象、操作、结果和上下文", "最短的一行", "最后一条文字"],
      answer: "B",
      explanation: "结构化上下文能把多个事件关联成时间线，单看最后一条错误常常只看到结果而非根因。",
      difficulty: "medium",
      tags: ["日志", "时间线"],
      sourceKey: "linux-system-reference",
    },
    {
      stem: "日志轮转的主要作用之一是防止日志无限增长占满磁盘。",
      answer: true,
      explanation: "轮转按大小或时间切分、压缩和删除旧日志，同时保留故障排查窗口。",
      difficulty: "easy",
      tags: ["日志轮转", "磁盘"],
      sourceKey: "linux-system-reference",
    }
  ),
  ...topicQuestionPair(
    "linux-network",
    "linux-network-storage",
    {
      stem: "域名访问失败但直接用 IP 可以连接，最优先排查什么？",
      options: ["DNS 解析", "内存容量", "文件权限", "CPU 核数"],
      answer: "A",
      explanation: "IP 可连说明底层路由和端口基本可达，域名失败通常是 DNS 解析或搜索域问题。",
      difficulty: "medium",
      tags: ["DNS", "网络"],
      sourceKey: "linux-system-reference",
    },
    {
      stem: "服务已经在监听端口，外部一定可以访问该端口。",
      answer: false,
      explanation: "还需要监听地址、网络路由和防火墙放行正确，外部才能访问。",
      difficulty: "medium",
      tags: ["端口", "防火墙"],
      sourceKey: "linux-system-reference",
    }
  ),
  ...topicQuestionPair(
    "linux-ssh",
    "linux-network-storage",
    {
      stem: "自动化 SSH 脚本为什么常设置 BatchMode 和 ConnectTimeout？",
      options: ["提升 CPU", "避免交互卡住并限制连接等待", "修改密码", "自动删除日志"],
      answer: "B",
      explanation: "批处理模式禁止交互提示，连接超时让网络故障快速失败，避免 cron 或部署任务永久挂起。",
      difficulty: "medium",
      tags: ["SSH", "自动化"],
      sourceKey: "command-line-reference",
    },
    {
      stem: "私钥可以安全地复制到服务器账户目录中用于登录。",
      answer: false,
      explanation: "服务器保存公钥，私钥应只保留在受保护的客户端或密钥代理中。",
      difficulty: "easy",
      tags: ["SSH", "密钥"],
      sourceKey: "command-line-reference",
    }
  ),
  ...topicQuestionPair(
    "linux-storage",
    "linux-network-storage",
    {
      stem: "删除日志文件后 df 空间没有释放，最可能的原因是什么？",
      options: ["文件仍被进程打开", "磁盘没有挂载", "文件名太长", "权限太宽"],
      answer: "A",
      explanation: "目录项删除后，只要进程仍持有文件描述符，数据块可能继续被占用。",
      difficulty: "hard",
      tags: ["磁盘", "lsof"],
      sourceKey: "linux-system-reference",
    },
    {
      stem: "inode 使用率过高和磁盘容量不足是两个不同问题。",
      answer: true,
      explanation: "大量小文件可能耗尽 inode，即使块空间仍有余；需要分别用 df -i 和 df -h 检查。",
      difficulty: "medium",
      tags: ["inode", "容量"],
      sourceKey: "linux-system-reference",
    }
  ),
  ...topicQuestionPair(
    "linux-bash",
    "linux-automation-ops",
    {
      stem: "Bash 脚本为什么常设置 `set -euo pipefail`？",
      options: ["让脚本更快", "让失败更早暴露", "自动修复语法", "加密输出"],
      answer: "B",
      explanation: "该组合让未定义变量、失败命令和管道失败更容易终止脚本，减少部分完成和静默错误。",
      difficulty: "medium",
      tags: ["Bash", "错误处理"],
      sourceKey: "algorithms-shell",
    },
    {
      stem: "守护脚本的临时目录应在退出时清理，即使中途失败也应尽量执行。",
      answer: true,
      explanation: "trap 可以在 EXIT 时清理临时资源，避免重复运行积累垃圾。",
      difficulty: "easy",
      tags: ["trap", "清理"],
      sourceKey: "algorithms-shell",
    }
  ),
  ...topicQuestionPair(
    "linux-scheduling",
    "linux-automation-ops",
    {
      stem: "cron 任务执行时间超过下一次触发周期时，会发生什么风险？",
      options: ["自动合并成一次", "同一任务可能重叠执行", "系统自动扩容", "任务变成服务"],
      answer: "B",
      explanation: "cron 只按时间触发新进程，不关心上一次是否完成；需要锁、超时或 systemd timer 控制。",
      difficulty: "medium",
      tags: ["cron", "重叠"],
      sourceKey: "linux-system-reference",
    },
    {
      stem: "定时任务只要有 cron 表达式，就不需要记录失败和通知。",
      answer: false,
      explanation: "看不见的失败会长期积累，任务需要退出码、日志和告警，重要任务还要验证结果。",
      difficulty: "easy",
      tags: ["定时任务", "告警"],
      sourceKey: "linux-system-reference",
    }
  ),
  ...topicQuestionPair(
    "linux-troubleshooting",
    "linux-automation-ops",
    {
      stem: "故障恢复流程中，什么时候适合做长期重构？",
      options: ["现象刚出现时", "止血并确认业务稳定后", "还没收集证据时", "恢复演练之前"],
      answer: "B",
      explanation: "先限制影响并恢复服务，稳定后再根据证据做根因修复和长期改进。",
      difficulty: "medium",
      tags: ["故障恢复", "止血"],
      sourceKey: "linux-system-reference",
    },
    {
      stem: "备份文件存在就代表恢复能力已经得到验证。",
      answer: false,
      explanation: "只有实际恢复、校验数据完整性和记录耗时后，才能证明备份可用。",
      difficulty: "easy",
      tags: ["备份", "恢复演练"],
      sourceKey: "linux-system-reference",
    }
  ),
];
