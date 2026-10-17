/**
 * Linux 运维 · 知识点扩容（追加式，2026-10-17）。
 *
 * 只新增 6 个知识点，落在该课已有的 3 个阶段上，不改动 linux.ts 原文件。
 * 主题：权限与 umask、文件描述符与重定向、进程与信号、systemd 服务、日志与排障、包管理与依赖。
 * 口径：讲透、讲准、给细节；术语配白话解释；每章收口成可复述的小结。
 */
import type { TopicExpansion } from "./topic-expansions";

export const linuxTopicExpansions: TopicExpansion[] = [
  {
    trackSlug: "linux",
    stageKey: "linux-shell-files",
    topic: {
      key: "linux-perm-umask",
      title: "umask 与默认权限推导",
      summary:
        "新建文件不是 666，新建目录也不是 777，它们都被 umask 按位清掉了一部分。算不出这一步，就解释不了为什么 chmod 过的权限会在下一次创建时又变回去。",
      concepts: ["umask 掩码", "默认权限 666 与 777", "setgid 与组继承", "粘滞位", "目录的 x 位"],
      principles: [
        "实际权限 = 默认值 & ~umask：文件默认 666、目录默认 777，umask 只负责清位，不负责赋权。",
        "umask 是进程属性，fork 时被子进程继承；已经运行的服务不会因为你在终端改了 umask 而改变。",
        "setgid 目录让新建文件自动继承目录的组，粘滞位让可写目录里只有属主能删自己的文件，两者解决协作场景里的不同问题。",
        "目录的 x 位表示可进入与可遍历，去掉 x 之后即使知道文件名也打不开里面的内容。",
      ],
      applications: [
        "服务账号统一 umask 027，让日志与配置对组外用户不可见。",
        "团队共享目录用 2770 加 umask 007，组内可协作、组外进不来。",
        "上传目录叠加粘滞位，避免成员互相删除对方文件。",
      ],
      pitfalls: [
        "用 chmod -R 777 解决权限报错，把敏感文件变成全局可写，也绕过了 umask 的设计。",
        "以为在终端里 export umask 会影响 systemd 拉起的服务，实际服务读的是 unit 里的 UMask。",
        "把目录权限设成 644，别人能 ls 出名字却进不去，被误判成文件损坏。",
      ],
      method:
        "先写清谁需要对什么做什么，再以 666 与 777 为基准倒推 umask，最后在目标进程里新建文件实测，而不是只改存量文件的 chmod。",
      exercise:
        "为团队共享目录设计权限：目录 2770、组内 umask 007，验证组员可读写、组外无法进入，并说明这里是否还需要粘滞位。",
      checkpoint: "能由 umask 推出新建文件与目录的权限，并说清 setgid 与粘滞位各自解决什么问题。",
      lesson: {
        overview: [
          "很多人第一次遇到权限怪事，是执行过 chmod 660 之后，第二天服务新写的日志又变回 644。问题不在 chmod 而在 umask：chmod 修改的是已经存在的 inode，umask 决定的是之后每一次创建的起点。前者动存量，后者定增量，混在一起看就会以为权限被系统悄悄重置了。真正要记住的分工是：改已存在文件用 chmod，改未来新建的文件用 umask 或服务单元的 UMask，两者各管一段，不能互相替代。",
          "umask 表达的是要清掉哪些权限位，而不是给谁什么权限。这一点最容易记反：022 不是给组和其他人写权限，而是从默认值里抠掉组和其他人的写位，所以数值越大，新建出来的文件反而越封闭。把它理解成减法而不是加法，才不会在排障时推错方向。顺带记住常用值：022 得到 755 与 644，027 得到 750 与 640，077 则只剩属主自己能访问。",
          "生效范围同样常被误解：umask 是进程属性，fork 之后被子进程继承，但已经跑起来的进程不会因为你改了终端里的值而改变。systemd 拉起的服务读的是 unit 里的 UMask，登录 shell 里设的 umask 对它无效，这正是服务日志权限总对不上的原因。所以排查权限时先问一句：这个文件是谁、在哪个进程上下文里创建的，答案往往就能定位到 umask 的来源。",
        ],
        mechanism: [
          "创建文件时内核取默认值 666，创建目录取 777，再与 umask 的反码按位与。022 下文件得到 644、目录得到 755；027 下文件是 640、目录是 750。可执行文件的权限由程序自己决定，umask 只影响它请求的那部分位。记住这三组对应关系，比死背 umask 表更可靠，也能在给出的任意数值上现推。",
          "umask 存在进程的凭证结构里，fork 与 exec 都会带着走，所以子进程默认继承父进程的 umask。make install 之类工具因此受调用它的 shell 影响，而 systemd 单元拉起进程时用的是 UMask 配置或默认 0022。实际排查里，登录 shell 的启动脚本、sudo 的默认配置、服务单元的 UMask 是三处最常见的设置点，逐个确认即可。",
          "特殊位要单独记：setgid 作用在目录上让新文件继承目录的组，作用在可执行文件上让进程以文件属组的身份运行；粘滞位作用在可写目录上，限制只有文件属主或 root 能删除；setuid 只对二进制生效，脚本会被内核忽略。这三类位在 ls -l 里分别显示为 s、t 以及大写的 S、T，大写说明对应的执行位缺失，权限并没有真正生效。",
          "x 位对文件和目录含义不同：文件有 x 才能执行，脚本还需要 r 位让解释器读到内容；目录有 x 才能进入并访问其中已知路径，只有 r 时只能列出名字。很多权限故障其实是目录少了 x，此时读取一个已知路径会直接报权限不足，看起来像文件本身坏了。给目录授权时 r 与 x 要一起考虑，只给 r 的目录几乎无法正常使用。",
        ],
        example: {
          title: "用 umask 与 setgid 搭一个协作目录",
          language: "bash",
          code: "# 1) 协作目录：同组可读写，组外连目录都进不去\ngroupadd deploy\nmkdir -p /srv/app/shared\nchgrp deploy /srv/app/shared\nchmod 2770 /srv/app/shared        # 2 是 setgid：新建文件自动继承 deploy 组\n\n# 2) 服务侧固定 umask，别指望登录 shell\n# /etc/systemd/system/app.service 的 [Service] 段里加一行 UMask=0027\n\n# 3) 进程内设置只影响当前进程与它 fork 出来的子进程\numask 007\ntouch /srv/app/shared/upload.log\nstat -c '%a %U:%G %n' /srv/app/shared/upload.log\n# 660 app deploy /srv/app/shared/upload.log\n\n# 4) 反推公式：实际权限 = 默认值 & ~umask\nprintf 'file=%o dir=%o\\n' $((0666 & ~0007)) $((0777 & ~0007))\n# file=660 dir=770",
          explanation:
            "setgid 让目录下新建文件的属组自动是 deploy，不必每次 chgrp；umask 007 让同组保留读写执行、组外全部清掉，于是新日志是 660。注意 systemd 单元读的是自己的 UMask，登录 shell 的设置对它无效，这也是很多服务日志权限对不上的原因。最后一行用算术验证公式：默认值按位与 umask 的反码，文件 666 得 660，目录 777 得 770。",
        },
        practiceSteps: [
          "写下每个角色需要对目标目录做什么操作，标出读、写、执行三类需求。",
          "以 666 与 777 为基准倒推 umask，而不是先给 777 再往回改。",
          "在目标进程里设置 umask 或 UMask，重启后用新建文件验证。",
          "用 stat 检查实际权限，确认没有多余的组或其他用户权限。",
        ],
        masteryChecklist: [
          "能由 umask 值直接算出新建文件与目录的权限。",
          "能解释 setgid 目录与粘滞位分别解决什么问题。",
          "能说清 chmod 与 umask 的作用范围差异。",
        ],
        summary: [
          "文件默认 666、目录默认 777，umask 只做清位。",
          "实际权限 = 默认值 & ~umask，027 下文件是 640。",
          "umask 是进程属性，服务的权限看 unit 里的 UMask。",
          "setgid 管组继承，粘滞位管删除权，目录 x 位管能否进入。",
        ],
        terms: [
          {
            term: "umask",
            plain: "决定新建文件默认去掉哪些权限位的掩码。",
            detail:
              "它做的是减法：从 666 或 777 里清掉对应位。数值越大越封闭，022 是默认，027 常用于服务账号。它不是环境变量，而是进程属性。",
          },
          {
            term: "setgid 目录",
            plain: "目录里新建的文件自动归到目录所属的组。",
            detail:
              "没有它，新文件的组是创建者的主组，协作时就得反复 chgrp。设置后目录权限位的第二位变成 s，例如 2770。",
          },
          {
            term: "粘滞位",
            plain: "可写目录里，只有文件属主才能删自己的文件。",
            detail:
              "/tmp 就是典型：目录对所有人可写，但粘滞位阻止用户删除别人的文件。它约束的是删除与改名，不是读写。",
          },
          {
            term: "默认权限 666 与 777",
            plain: "没被 umask 削减前，文件和目录的权限起点。",
            detail:
              "666 表示所有身份都可读写、不可执行；777 在此基础上加上执行位。之所以不是 666 直接落地，是因为 umask 总要再清一次。",
          },
        ],
      },
    },
    questions: [
      {
        key: "linux-exp-linux-perm-umask-s1",
        stageKey: "linux-shell-files",
        topicKey: "linux-perm-umask",
        type: "single",
        stem: "某个服务单元里写了 UMask=0027，该服务新建的日志文件权限通常是多少？",
        options: [
          { key: "A", text: "644" },
          { key: "B", text: "640" },
          { key: "C", text: "660" },
          { key: "D", text: "604" },
        ],
        answer: ["B"],
        explanation:
          "文件默认是 666，0027 清掉组写位与组外全部权限：666 去掉 0020 得 640，目录则从 777 变成 750。注意 umask 是清位而不是赋权，数值越大新建文件越封闭；systemd 的 UMask 只影响该单元拉起的进程，与登录 shell 无关。",
        difficulty: "medium",
        tags: ["权限", "umask", "systemd"],
        sourceKey: "command-line-reference",
        level: "进阶",
      },
      {
        key: "linux-exp-linux-perm-umask-j1",
        stageKey: "linux-shell-files",
        topicKey: "linux-perm-umask",
        type: "judge",
        stem: "在登录 shell 里执行 umask 022，会同时改变由 systemd 管理的服务之后新建文件的权限。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "umask 是进程属性，只沿 fork 链继承。systemd 的服务由 PID 1 拉起，读的是 unit 里的 UMask，缺省为 0022，既不是你的登录 shell，也不是 /etc/profile 里的设置。要改服务产生文件的权限，得改 unit 里的 UMask 或服务自身的创建参数，改完还要 daemon-reload 再重启。",
        difficulty: "hard",
        tags: ["umask", "服务", "权限继承"],
        sourceKey: "linux-system-reference",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "linux",
    stageKey: "linux-shell-files",
    topic: {
      key: "linux-fd-redirection",
      title: "文件描述符与重定向",
      summary:
        "重定向改的是描述符指向，不是命令的输出内容；shell 从左到右逐个生效，所以 2>&1 写的位置决定了错误到底进文件还是留在终端。",
      concepts: ["文件描述符 0/1/2", "重定向顺序", "覆盖与追加", "dup2", "描述符复用"],
      principles: [
        "每个进程默认有 0 标准输入、1 标准输出、2 标准错误，重定向改的是这三个编号指向的文件。",
        "重定向从左到右就地生效：2>&1 是复制当前指向的快照，之后再改 1，2 不会跟着变。",
        "管道只连接前一个进程的 1 和后一个进程的 0，错误流不参与，所以 stderr 会绕过管道落到终端。",
        "> 以截断方式打开，>> 以追加方式打开；对正在写入的日志执行 > 会留下前部空洞。",
      ],
      applications: [
        "部署脚本把标准输出与错误都落到同一个日志，同时在终端保留错误以便人工观察。",
        "用 exec 固定一个日志描述符，避免脚本里每条命令都重复写路径与追加符号。",
      ],
      pitfalls: [
        "写成 cmd 2>&1 >app.log 还以为错误进了日志，实际 stderr 仍打在终端上。",
        "用 > 覆盖正在被服务写入的日志文件，导致内容被截断且后续写入出现空洞。",
        "后台启动服务时漏掉 2>&1，启动报错全部丢失，只剩一个消失的进程。",
      ],
      method:
        "先在纸上画出这条命令的 0、1、2 各指向哪里，再从左到右逐个读重定向，最后用 /proc/PID/fd 或小文件验证结果。",
      exercise:
        "写一条命令：把命令的标准输出追加到 deploy.log，同时让错误单独进入 error.log，终端不显示任何输出；再用 ls -l /proc/PID/fd 验证两个描述符的指向。",
      checkpoint: "能解释 cmd >file 2>&1 与 cmd 2>&1 >file 的结果差异，并说清管道为什么接不到 stderr。",
      lesson: {
        overview: [
          "重定向看起来只是把输出换个地方，实际动的是描述符的指向。命令本身并不知道自己写的是终端还是文件，它只会往 1 号描述符写；至于 1 指向哪里，是 shell 在 fork 之后、exec 之前用 dup2 改掉的。理解这一层，那些看起来反直觉的写法才有解释。所以读一条命令时，与其背语法，不如按描述符逐个标注指向，画一遍就再也不会记混。",
          "经典坑几乎都出在顺序上。shell 从左到右逐个处理重定向，每遇到一个就立刻改一次指向，所以 >file 2>&1 与 2>&1 >file 的效果完全不同：前者两个流都进文件，后者错误依旧打在屏幕上。这不是 shell 的怪癖，而是复制式语义的必然结果。记住一句话：复制发生在那一刻，之后谁再改指向，都不会回头影响已经复制过的描述符。",
          "第三件常被忽略的事是管道只接标准输出。2 号描述符没有参与管道，错误会绕过它直接到终端，于是日志统计里永远缺了最关键的报错。想把错误也送进去，必须在竖线之前把 2 合并到 1，也就是写成 2>&1 |。所以排查日志缺内容时，先确认错误流有没有被显式合并，再去怀疑程序没打日志。",
        ],
        mechanism: [
          "进程启动时继承三个描述符：0 读键盘或管道，1 写终端，2 也写终端。重定向的本质是 shell 先 open 目标文件拿到新描述符，再用 dup2 覆盖 0、1 或 2，最后 exec 的程序只看到 1 是一个普通文件。程序感知不到终端与文件的差别，它只是照常往编号里写。",
          "顺序决定结果，因为 2>&1 是复制当前指向的一次快照。>file 2>&1 先把 1 指向文件，2 再复制这个指向，两者都进文件；2>&1 >file 先让 2 复制当时的终端，再把 1 改到文件，2 不会跟着变。顺序不是风格问题，写反了就是数据丢失，也很难从最终结果反推出原因。",
          "管道由内核对象实现：shell 建一个管道，把前一个进程的 1 接到写端、后一个进程的 0 接到读端。2 不在这条链上，所以错误会绕过管道落到原来的终端，统计脚本自然看不到。这也是为什么很多脚本统计错误数永远为零。",
          "> 用截断方式打开，先清零再写；>> 用追加方式打开。对正在被写入的日志执行 > 会截断内容，但写进程的文件偏移不会回到 0，后续写入会在文件前部留下空洞，看起来大小很大、前面却全是空字节。发现日志大小异常却读不出内容时，先查是不是被截断过。",
        ],
        example: {
          title: "固定日志描述符，并让错误各走各的文件",
          language: "bash",
          code: "#!/usr/bin/env bash\nset -euo pipefail\n\nLOG=/var/log/deploy.log\n\n# 3 号描述符固定指向日志，后续复用，避免每条命令都写一次 >>\nexec 3>>\"$LOG\"\nlog() { printf '%s [deploy] %s\\n' \"$(date -Is)\" \"$*\" >&3; }\n\n# 1 和 2 都进日志：顺序必须是 >file 2>&1\n./migrate.sh >>\"$LOG\" 2>&1 || log \"migrate failed\"\n\n# 终端只看得到错误：先把终端复制到 4，再让 2 指向 4\nexec 4>&1\n./build.sh >\"$LOG\" 2>&4\nexec 4>&-\n\n# 管道只接标准输出；想让错误也进管道，必须在竖线前合并\ngrep -c ERROR \"$LOG\" | tee /tmp/error-count.txt",
          explanation:
            "脚本先用 exec 3>> 固定一个日志描述符，后面所有 log 调用只写 >&3，不必每条命令重复路径。migrate 那行把 1 与 2 都导向日志，顺序是 >file 2>&1，两者都进文件；build 那行要的是终端只看错误，所以先把终端复制到 4，再让 2 直接指向 4。管道那行说明 2 不参与管道，grep 只统计到标准输出，想看错误必须提前合并。",
        },
        practiceSteps: [
          "先在纸上画出这条命令的 0、1、2 分别指向哪里。",
          "按从左到右的顺序逐个读重定向，确认每一步改变了哪个描述符。",
          "用无害的小命令验证，例如 ls /nonexistent >out 2>&1 后检查文件内容。",
          "用 ls -l /proc/PID/fd 检查运行中进程的描述符指向。",
        ],
        masteryChecklist: [
          "能说清 cmd >file 2>&1 与 cmd 2>&1 >file 的结果差异。",
          "能解释为什么管道接不到 stderr。",
          "能说明为什么要用 exec 固定日志描述符。",
        ],
        summary: [
          "重定向改的是描述符指向，不是命令的输出内容。",
          "2>&1 是快照，写的位置决定错误最终去哪。",
          "管道只连标准输出，要带上错误必须 2>&1 |。",
          "> 截断、>> 追加，对运行中的日志用 > 会留下空洞。",
        ],
        terms: [
          {
            term: "文件描述符",
            plain: "进程打开文件时拿到的编号，默认 0、1、2。",
            detail:
              "程序只认编号不认路径。shell 改掉编号对应的文件，程序下次写同一个编号就落到新文件里。",
          },
          {
            term: "dup2",
            plain: "把一个描述符复制成另一个，重定向底层就靠它。",
            detail:
              "2>&1 实际执行的是 dup2(1, 2)，让 2 指向 1 当前的文件。因为复制的是当下状态，顺序才如此重要。",
          },
          {
            term: "截断与追加",
            plain: "> 先清空再写，>> 接着末尾继续写。",
            detail:
              "两者用不同的打开标志：截断会清零，追加把偏移放到末尾。对正在写的日志用截断，容易产生前部空洞。",
          },
          {
            term: "stderr",
            plain: "专门放错误信息的输出通道，默认直连终端。",
            detail:
              "它和标准输出分开，平时便于人看，统计时却容易被漏掉。合并前要想清楚，日志里该不该混入错误。",
          },
        ],
      },
    },
    questions: [
      {
        key: "linux-exp-linux-fd-redirection-s1",
        stageKey: "linux-shell-files",
        topicKey: "linux-fd-redirection",
        type: "single",
        stem: "下面哪条命令能把命令的标准输出与标准错误都覆盖写入 app.log？",
        options: [
          { key: "A", text: "cmd >app.log 2>&1" },
          { key: "B", text: "cmd 2>&1 >app.log" },
          { key: "C", text: "cmd >app.log 2>app.err" },
          { key: "D", text: "cmd 2>app.log" },
        ],
        answer: ["A"],
        explanation:
          "shell 从左到右处理重定向。A 先把 1 指向 app.log，再把 2 复制成 1 的当前指向，两个流都进文件。B 先把 2 复制成当时的 1，也就是终端，再把 1 改到文件，错误仍然打在屏幕上。C 把错误分到另一个文件。D 只重定向了 2。记住复制的是快照，之后改 1 不会带着 2 一起走。",
        difficulty: "medium",
        tags: ["重定向", "文件描述符", "顺序"],
        sourceKey: "command-line-reference",
        level: "进阶",
      },
      {
        key: "linux-exp-linux-fd-redirection-j1",
        stageKey: "linux-shell-files",
        topicKey: "linux-fd-redirection",
        type: "judge",
        stem: "管道 cmd1 | cmd2 会把 cmd1 的标准错误也一并传给 cmd2。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "管道只连接前一个进程的 1 和后一个进程的 0，2 不参与这条链，所以错误会绕过管道直接落到终端。要把错误也送进管道，必须在竖线之前显式合并，写成 cmd1 2>&1 | cmd2，此时 2 复制的是已经指向管道写端的 1。",
        difficulty: "easy",
        tags: ["管道", "stderr"],
        sourceKey: "algorithms-shell",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "linux",
    stageKey: "linux-process-system",
    topic: {
      key: "linux-signal-process-control",
      title: "进程状态与信号控制",
      summary:
        "信号是内核异步投递的控制消息：SIGTERM 可以被捕获用来收尾，SIGKILL 不能；D 状态连 kill -9 都杀不掉，先看清状态再决定用哪个信号。",
      concepts: ["SIGTERM 与 SIGKILL", "进程状态 R/S/D/Z/T", "进程组", "信号处理器", "僵尸进程"],
      principles: [
        "信号的默认动作分为终止、终止并产生 core、忽略、停止、继续五类，同一信号对不同程序的效果可以不同。",
        "SIGTERM 请求退出且可被捕获，SIGKILL 与 SIGSTOP 由内核直接执行，不能捕获、忽略或阻塞。",
        "kill 默认只发给单个 PID，终止父进程不会自动带走子进程，整组停止要发给进程组或 cgroup。",
        "D 状态是不可中断睡眠，卡在内核 IO 路径上，信号必须等系统调用返回才会被处理。",
      ],
      applications: [
        "发版停服务时先发 SIGTERM 并等待超时，而不是直接 kill -9。",
        "用 SIGHUP 让守护进程重读配置，避免重启带来的连接中断。",
      ],
      pitfalls: [
        "上来就 kill -9，进程来不及释放锁文件、临时文件与未落盘的缓冲。",
        "只杀主进程不杀 worker，端口仍被占用，重启时报地址已被使用。",
        "把 SIGHUP 当成挂断就退出，很多守护进程把它实现成重新加载配置。",
      ],
      method:
        "先用 ps 或 pgrep 确认进程树与状态，再看它如何处理目标信号，最后按 SIGTERM、等待、SIGKILL 的阶梯处理并检查残留。",
      exercise:
        "写一个捕获 SIGTERM 的脚本：收到信号后打印一行、删除临时目录、以 0 退出；分别用 kill 与 kill -9 验证，并说明两次行为的差异。",
      checkpoint: "能说出 SIGTERM 与 SIGKILL 的行为差异，并解释为什么按进程组停止比只杀一个 PID 更彻底。",
      lesson: {
        overview: [
          "信号不是打个招呼这么简单，它是内核在目标进程的执行流里插入的一段控制：要么走进程自己注册的处理函数，要么走内核的默认动作。默认动作可能是终止、可能是产生 core 文件、也可能只是忽略，所以同一个信号对不同程序的效果可以完全不同。这也解释了为什么同一个 kill 命令，对有的服务是优雅退出，对另一个服务却是当场消失。",
          "真正影响运维决策的是可捕获性。SIGTERM 请求退出，进程可以捕获它做清理；SIGKILL 和 SIGSTOP 由内核直接执行，进程没有任何执行用户态代码的机会。把 SIGKILL 当成首选，等于主动放弃所有清理逻辑，锁文件与半写数据都会留下。所以信号的选择顺序应当固定：先请求，再等待，最后才强杀。",
          "还有一类更隐蔽的情况：进程卡在不可中断睡眠的 D 状态，信号要等系统调用返回才会被处理，此时连 SIGKILL 都表现为毫无反应。先看状态再选信号，比反复重试 kill 有效得多。看到进程杀不掉时，第一反应应该是查状态与内核栈，而不是加大力度，同时记录下它在等哪一类 IO。",
        ],
        mechanism: [
          "常用信号各有分工：SIGTERM 请求终止、可捕获；SIGKILL 立即终止、不可捕获不可忽略；SIGINT 来自 Ctrl-C；SIGHUP 在终端断开时发送，多数守护进程把它实现成重载配置；SIGSTOP 与 SIGCONT 用于暂停和继续。记信号编号意义不大，记语义与能否捕获才是关键。",
          "信号投递后先进入待处理集合，进程被调度到才执行处理函数。处理函数里只能调用异步信号安全的接口，例如 write 和设置标志位；在里面调用 malloc 或 printf 可能因为锁重入而卡死，所以常见做法是只置位，由主循环收尾。这条约束在写优雅退出逻辑时尤其容易违反。",
          "进程状态决定能不能被杀：R 是可运行，S 是可中断睡眠，D 是不可中断睡眠，T 是停止，Z 是已退出但父进程还没回收。D 状态卡在内核 IO 路径上，只有等 IO 返回、超时或重启机器才会推进。僵尸进程则已经退出，只剩一条进程表记录，等父进程回收即可。",
          "kill 默认只发给单个进程，kill 加负号 PID 才发给整个进程组。父进程退出不会自动带走子进程，只杀主进程常常留下仍占着端口的 worker。systemd 的 KillMode 设为 control-group 会把整个 cgroup 一起收掉，这正是它比手写 kill 更可靠的地方，也是停机脚本应当优先走服务管理器的原因。",
        ],
        example: {
          title: "捕获 SIGTERM，做一次真正的优雅退出",
          language: "bash",
          code: "#!/usr/bin/env bash\nset -euo pipefail\n\nWORK=$(mktemp -d)\nCHILD_PID=\n\ncleanup() {\n  printf 'signal received, cleaning up\\n' >&2\n  [ -n \"$CHILD_PID\" ] && kill -TERM \"$CHILD_PID\" 2>/dev/null || true\n  rm -rf \"$WORK\"\n  exit 0\n}\ntrap cleanup TERM INT\n\nsleep 3600 &\nCHILD_PID=$!\nprintf 'self=%s child=%s\\n' \"$$\" \"$CHILD_PID\"\n\n# wait 让 shell 在阻塞期间也能被信号唤醒并执行 trap\nwait \"$CHILD_PID\"",
          explanation:
            "trap 只是登记处理函数，shell 必须回到可以处理信号的执行点才会调用它。前台命令运行期间信号会排队，所以脚本用 wait 阻塞：wait 是内建命令，能让 shell 在等待子进程时被信号打断，cleanup 才有机会执行。cleanup 先给子进程发 SIGTERM，再删临时目录，最后用 0 退出，让停止动作在 systemd 看来是正常结束。换成 kill -9，这段清理完全不会运行。",
        },
        practiceSteps: [
          "用 ps 或 pgrep 确认进程树与状态码，分清主进程和 worker。",
          "先发 SIGTERM，按 TimeoutStopSec 或自定超时等待其退出。",
          "超时后再发 SIGKILL，并检查锁文件、端口、临时目录是否残留。",
          "需要整体停止时向进程组或 cgroup 发信号，而不是只杀一个 PID。",
        ],
        masteryChecklist: [
          "能说出 SIGTERM 与 SIGKILL 的行为差异和适用场景。",
          "能解释 D 状态为什么连 SIGKILL 也无效。",
          "能说明按进程组停止比杀单个 PID 更彻底的原因。",
        ],
        summary: [
          "信号是异步控制通知，可捕获性与默认动作决定后果。",
          "SIGTERM 用来收尾，SIGKILL 只作最后手段。",
          "D 状态卡在内核 IO，信号要等系统调用返回。",
          "按进程组或 cgroup 停止，避免留下占端口的子进程。",
        ],
        terms: [
          {
            term: "SIGTERM",
            plain: "请求退出的信号，程序可以捕获它做清理。",
            detail:
              "它是礼貌的停止请求，也是 systemctl stop 默认发出的信号。程序可以自己决定收尾多久，所以适合有状态的服务。",
          },
          {
            term: "SIGKILL",
            plain: "内核直接终止进程的信号，捕获不了也忽略不了。",
            detail:
              "进程没有任何执行用户态代码的机会，锁文件、临时文件、未落盘的缓冲都会留在原地。只应在超时后作为最后手段。",
          },
          {
            term: "僵尸进程",
            plain: "已经退出但父进程没回收，只剩一条进程表记录。",
            detail:
              "它不占 CPU 也不占内存，但会占 PID。父进程调用 wait 就会消失；父进程先死，则由 init 或 systemd 收养并回收。",
          },
          {
            term: "不可中断睡眠",
            plain: "卡在内核 IO 等返回的状态，信号也要排队。",
            detail:
              "D 状态常见于磁盘或网络存储无响应，表现为 kill 毫无反应。只能等 IO 返回、超时，或者重启机器。",
          },
        ],
      },
    },
    questions: [
      {
        key: "linux-exp-linux-signal-process-control-s1",
        stageKey: "linux-process-system",
        topicKey: "linux-signal-process-control",
        type: "single",
        stem: "某个进程处于 D 状态，kill -9 也毫无反应，最可能的原因是什么？",
        options: [
          { key: "A", text: "该进程把 SIGKILL 设置成了忽略" },
          { key: "B", text: "它阻塞在不返回的内核 IO 上，信号要等系统调用返回才会被处理" },
          { key: "C", text: "当前用户权限不足，信号根本没有发出去" },
          { key: "D", text: "它是僵尸进程，需要父进程回收" },
        ],
        answer: ["B"],
        explanation:
          "SIGKILL 不可忽略、不可捕获，所以 A 不成立。D 状态是不可中断睡眠，进程通常卡在磁盘或网络 IO 的内核路径上，只有等 IO 返回、超时或重启机器才会推进到可处理信号的调度点，因此表现为杀不掉。僵尸进程已经退出，不存在需要被 kill 的问题，它在等父进程 wait 回收。",
        difficulty: "hard",
        tags: ["信号", "进程状态", "排障"],
        sourceKey: "linux-system-reference",
        level: "综合",
      },
      {
        key: "linux-exp-linux-signal-process-control-j1",
        stageKey: "linux-process-system",
        topicKey: "linux-signal-process-control",
        type: "judge",
        stem: "SIGKILL 能被进程注册的信号处理器捕获，因此程序有机会在退出前清理临时文件和锁。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "SIGKILL 和 SIGSTOP 是仅有的两个不能被捕获、忽略或阻塞的信号，内核直接执行终止动作，进程没有执行任何用户态代码的机会。要保证清理逻辑跑到，应该用 SIGTERM 并注册处理器，再给一段超时；超时后由管理进程补发 SIGKILL。",
        difficulty: "medium",
        tags: ["SIGKILL", "信号处理"],
        sourceKey: "command-line-reference",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "linux",
    stageKey: "linux-process-system",
    topic: {
      key: "linux-systemd-unit-ordering",
      title: "systemd 单元依赖与启动顺序",
      summary:
        "Requires 管依赖是否存在，After 管谁先谁后，两者正交；只写依赖不写排序，并行启动下照样抢跑。Type 则决定什么时刻算启动完成。",
      concepts: ["Requires 与 Wants", "After 与 Before", "Type 启动判定", "启动限流", "target"],
      principles: [
        "Requires 表达强依赖，依赖失败则本单元也失败；Wants 表达弱依赖，对端失败不影响自己。",
        "依赖不表达顺序：谁先谁后必须用 After 或 Before 单独声明，否则单元会并行启动。",
        "After 只保证作业先后，不保证对端可用；就绪判定要交给 Type 或显式的健康检查。",
        "Restart 必须与 RestartSec 和启动限流配合，否则崩溃会变成无限重启并把日志刷满。",
      ],
      applications: [
        "应用服务依赖数据库启动：Requires 加 After 同时声明，必要时再加健康探测。",
        "用 Type 为 notify 加 WatchdogSec，让 systemd 判断进程是真的就绪还是只是活着。",
      ],
      pitfalls: [
        "只写 Requires 不写 After，并行启动时应用先连库失败。",
        "设置无限重启却没有 RestartSec，崩溃循环拖垮机器并淹没真正的错误。",
        "改完 unit 不执行 daemon-reload，systemd 仍在用旧定义启动服务。",
      ],
      method:
        "先画依赖图，分清必须存在与希望存在，再分别写依赖和排序，最后用 systemd-analyze verify 与 critical-chain 检查事务。",
      exercise:
        "为一个依赖 PostgreSQL 的 API 服务写 unit：Requires 加 After、Type 设为 notify、Restart 设为 on-failure 并配 RestartSec 与启动限流，最后用 systemd-analyze critical-chain 验证顺序。",
      checkpoint: "能解释 Requires 与 After 各自管什么，并用 Type 说明什么时刻算启动完成。",
      lesson: {
        overview: [
          "systemd 把启动顺序拆成两个正交的问题：谁依赖谁，以及谁先谁后。前者由 Requires 与 Wants 表达，后者由 After 与 Before 表达。新手常把它们当一回事，只写依赖不写排序，结果在并行启动下依然抢跑：依赖的服务确实被拉起来了，但还没就绪，自己的连接就失败了。把这两个维度分开记，是读懂 unit 文件的第一步，依赖和顺序都写全，行为才可预期。",
          "第二个关键点是启动完成的判定。Type 设为 simple 时进程一 fork 出来就算 active，设为 notify 要等进程主动发 READY，设为 oneshot 要等进程退出。类型选错，systemd 就会对就绪状态给出错误判断，依赖它的单元也会跟着抢跑。很多偶发性的启动失败，根子就在这一行配置上。判断依据应该是程序自身暴露了什么信号，而不是照抄别人的模板。",
          "第三点是失败处理的节制。Restart 配上 RestartSec 和启动限流，才能在崩溃时重试，又不会把机器拖进无限重启。没有闸门的自动重启，最终表现为日志被刷满、CPU 被占满，真正的原因反而被淹没。重启策略的目的不是掩盖故障，而是让故障在被放大的同时保留可见性，排障时第一步就该看它有没有触顶。",
        ],
        mechanism: [
          "单元被 target 的 Wants 拉起后，systemd 为它组织一个事务：先把 Requires 与 Wants 的依赖加入同一批作业，再按 After 与 Before 排成偏序。没有排序声明的成员之间没有先后约束，一律并行启动。这就是为什么依赖写对了，启动顺序仍然可能颠倒。理解事务这个概念，才能理解为什么改完依赖要用 critical-chain 再看一遍。",
          "After 只保证作业先后，不保证对端可用。数据库 fork 出进程与能接受连接是两件事，要么让数据库用 notify 类型在就绪时才报 READY，要么在自己的 ExecStartPre 里循环探测端口。只写 After 而依赖方是 simple 类型，仍然可能连不上，这种失败在日志里通常表现为连接被拒绝，而不是超时。",
          "Type 决定就绪信号：simple 在 fork 后立即算启动成功，exec 等 execve 成功，notify 等应用主动上报 READY 且可配 WatchdogSec 做心跳，oneshot 等进程退出且需要 RemainAfterExit 才能保持 active，forking 则要等父进程退出。选型的依据是程序自身暴露了什么信号，而不是随手抄一段配置，否则只是在碰运气。",
          "Restart 与限流配合：RestartSec 拉开重试间隔，StartLimitIntervalSec 与 StartLimitBurst 规定窗口内允许的启动次数，超过后单元进入 failed 并停止重试，只有 systemctl reset-failed 才能再来。闸门存在的意义是让故障可见，而不是无限掩盖。排障时看到 failed 却没有新的重启记录，先查它是不是已经触顶。",
        ],
        example: {
          title: "依赖数据库的 API 服务单元",
          language: "ini",
          code: "# /etc/systemd/system/app-api.service\n[Unit]\nDescription=App API\n# 强依赖：数据库处于失败状态时本单元也算失败\nRequires=postgresql.service\n# 排序：只保证先后，不保证对端已经能接受连接\nAfter=network-online.target postgresql.service\nWants=network-online.target\n# 崩溃循环闸门：5 分钟内最多启动 5 次\nStartLimitIntervalSec=300\nStartLimitBurst=5\n\n[Service]\nType=notify\nUser=app\nWorkingDirectory=/srv/app\nEnvironment=APP_ENV=prod\nExecStart=/srv/app/bin/api\nRestart=on-failure\nRestartSec=5\nWatchdogSec=30\nTimeoutStopSec=20\n\n[Install]\nWantedBy=multi-user.target",
          explanation:
            "Requires 让数据库的失败传染给本单元，After 保证本单元在数据库作业之后启动，两者缺一不可。Type 设为 notify 让 systemd 等应用真正就绪再宣布启动完成，WatchdogSec 则在应用卡死时触发重启。RestartSec 与启动限流组成闸门，避免崩溃循环。改完 unit 必须 daemon-reload，systemd 才会用新定义重建事务。",
        },
        practiceSteps: [
          "先画依赖图，标出哪些是必须存在、哪些只是希望存在。",
          "依赖用 Requires 或 Wants，顺序用 After 或 Before，两类都要写。",
          "按程序是否支持就绪通知选择 Type，并设置合理的超时。",
          "配置 RestartSec 与启动限流，用 systemd-analyze critical-chain 验证顺序。",
        ],
        masteryChecklist: [
          "能解释 Requires 与 After 各自管什么。",
          "能用 Type 说明什么时刻算启动完成。",
          "能说明启动限流如何避免崩溃循环刷日志。",
        ],
        summary: [
          "Requires 管依赖，After 管顺序，两者正交。",
          "没有排序声明的单元会并行启动。",
          "Type 决定就绪判定，选错会让依赖方抢跑。",
          "RestartSec 加启动限流，才能让崩溃循环可见。",
        ],
        terms: [
          {
            term: "单元事务",
            plain: "systemd 一次性排好的一批启动或停止作业。",
            detail:
              "事务把所有依赖加进来，再按排序约束排成偏序执行。事务里的作业要么全部成功，要么触发回滚与失败传播。",
          },
          {
            term: "Type=notify",
            plain: "进程主动报告就绪，systemd 才认为启动完成。",
            detail:
              "程序需要调用 sd_notify 发送 READY。它比 simple 诚实，适合初始化时间长的服务；配合 WatchdogSec 还能发现卡死。",
          },
          {
            term: "启动限流",
            plain: "限定时间内最多重启几次，超了就判失败。",
            detail:
              "由 StartLimitIntervalSec 与 StartLimitBurst 控制。超过上限后单元进入 failed，必须 reset-failed 才能重来。",
          },
          {
            term: "Wants 与 Requires",
            plain: "弱依赖失败不影响自己，强依赖会连坐。",
            detail:
              "两者都只把对方拉进事务，不排序。Requires 还会在对方停止时考虑停止自己，Wants 则不会。",
          },
        ],
      },
    },
    questions: [
      {
        key: "linux-exp-linux-systemd-unit-ordering-s1",
        stageKey: "linux-process-system",
        topicKey: "linux-systemd-unit-ordering",
        type: "single",
        stem: "某个 unit 只写了 Requires=postgresql.service，没有写 After=postgresql.service。最可能的结果是什么？",
        options: [
          { key: "A", text: "数据库不会被启动" },
          { key: "B", text: "数据库会被拉起，但两个单元可能并行启动，本服务可能在数据库就绪前连接失败" },
          { key: "C", text: "systemd 会拒绝加载这个 unit" },
          { key: "D", text: "本服务一定启动失败" },
        ],
        answer: ["B"],
        explanation:
          "Requires 只声明依赖关系，作用是把依赖加入同一批启动作业；排序必须由 After 或 Before 另外声明，未声明排序的成员会并行启动。所以依赖存在不等于对端就绪，还要配合就绪通知、健康探测或启动前等待端口。C 也不成立：unit 语法合法，只是行为不符合预期。",
        difficulty: "medium",
        tags: ["systemd", "依赖", "启动顺序"],
        sourceKey: "linux-system-reference",
        level: "进阶",
      },
      {
        key: "linux-exp-linux-systemd-unit-ordering-j1",
        stageKey: "linux-process-system",
        topicKey: "linux-systemd-unit-ordering",
        type: "judge",
        stem: "在 unit 里写 Requires=postgresql.service，就能保证本服务启动时数据库已经可以接受连接。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "Requires 表达的是依赖与失败传播，不表达顺序；即使补上 After，也只保证两个作业的先后，不保证进程已经就绪。数据库 fork 出来到能接受连接之间还有初始化时间。可靠做法是让数据库用就绪通知类型，或在应用侧加连接重试与健康检查。",
        difficulty: "hard",
        tags: ["依赖", "就绪", "systemd"],
        sourceKey: "linux-system-reference",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "linux",
    stageKey: "linux-process-system",
    topic: {
      key: "linux-log-evidence-chain",
      title: "日志优先级、轮转与排障取证",
      summary:
        "排障不是搜 error，而是先固定时间窗口与对象，再按优先级和上下游还原因果链；日志还会被限流、轮转和内存存储悄悄吃掉。",
      concepts: ["日志优先级 0-7", "journald 持久化", "速率限制", "logrotate", "结构化字段"],
      principles: [
        "日志要能当证据，必须同时具备时间、对象、级别三个维度，缺一项就只能算线索。",
        "-p 是阈值语义：指定 err 会连同 crit、alert、emerg 一起选出，而不是只匹配 err。",
        "journald 默认只在 /var/log/journal 存在时持久化，否则写内存，重启即丢。",
        "速率限制与轮转策略决定事故窗口内的日志还在不在，保留时间要覆盖最长排查周期。",
      ],
      applications: [
        "用 journalctl 按时间窗口加单元、PID 过滤，快速缩小到出事那几分钟。",
        "给关键路径打结构化日志，再用 logrotate 控制保留份数与压缩。",
      ],
      pitfalls: [
        "只 grep error，忽略更早的 warning 与上游超时，根因反而被跳过。",
        "用 tail 观察复现，却不知道突发日志已经被速率限制丢弃。",
        "事故后才想起日志只存在内存里，一重启证据全没。",
      ],
      method:
        "固定时间窗口，圈定对象，按严重级别由重到轻找第一条异常，再用上下游日志交叉验证，最后确认日志是否完整。",
      exercise:
        "还原一次偶发 502：给定十分钟窗口，用 journalctl 过滤出应用与反向代理两侧日志，标出第一条异常并写出时间、对象、因果三段证据。",
      checkpoint: "能给出触发时间、影响对象与验证修复的三段证据，并说明日志保留策略是否覆盖该窗口。",
      lesson: {
        overview: [
          "日志的价值不在数量，而在可定位性。一条只写操作失败的日志，和一条带时间戳、进程、请求标识与错误码的日志，信息量差着一个数量级。排障要做的第一件事，是把事故窗口缩成一个确定的时间段，再把这一段的日志按对象摊开对照。窗口定不下来，后面的关键字搜索基本都是在碰运气，而把对象标清楚，才能避免多个服务互相干扰。",
          "systemd 时代日志分成两层：应用把内容写到标准输出与错误，systemd 收进 journal；journald 再按规则转发给 rsyslog 或落盘文件。分不清这一层，就会出现 journalctl 里看不到、而 /var/log 下有的怪现象，白白多查半小时。先确认日志走的哪条路径，再决定去哪里查，比一条条翻文件快得多；路径搞清楚了，漏查和重复查都能避免。",
          "还有两个会悄悄吃掉证据的机制：速率限制丢弃突发日志，轮转淘汰旧文件。事故发生时日志突然变少，往往不是没打，而是被限流；事故复盘时发现窗口外的记录全没了，往往是保留份数不够。这两个机制平时不显眼，出事时却直接决定有没有证据可用，值得在系统上线时就配置好。",
        ],
        mechanism: [
          "优先级用 0 到 7 表示，数字越小越严重：emerg、alert、crit、err、warning、notice、info、debug。journalctl 的 -p 是阈值语义，指定 err 会选出 0 到 3 的全部级别，而不是只等于 err；根因常常在更早的一条 warning 里。理解阈值语义，才不会在过滤时把关键线索一起筛掉，也能解释为什么结果总比预期多。",
          "journald 默认按 auto 策略决定存储：只有 /var/log/journal 存在时才持久化，否则写进 /run/log/journal，重启即丢。速率限制由时间窗口与条数上限控制，超出部分被吞掉并记一条抑制提示。所以看到日志不连续时，先确认存储策略与限流参数，再怀疑应用，否则很容易得出错误的结论。",
          "轮转由 logrotate 按大小或周期触发，保留份数决定事故窗口能不能覆盖。copytruncate 适合不会重新打开文件的进程，create 则要求进程配合重开，否则会继续写进已被删除的 inode，空间不释放。选错模式会出现磁盘越删越满的怪现象，排查时值得单独确认文件句柄的指向。",
          "取证要把三个维度对齐：时间用 short-iso 输出或 json 里的实时时间戳，对象用单元、PID 或容器标识过滤，上下文用请求标识串起上下游。三者对齐之后，才能说这条错误由那次超时引发，而不是碰巧同时出现。这也是复盘文档里最该保留的部分，比单纯的截图有用得多。",
        ],
        example: {
          title: "按时间窗口与对象取证",
          language: "bash",
          code: "# 1) 事故窗口：只取这一段，避免被更早的同类错误带偏\njournalctl --since '2026-10-17 09:10:00' --until '2026-10-17 09:20:00' -u app-api.service -p warning --no-pager\n\n# 2) 同一个 PID 的全量日志，看它退出前最后发生了什么\njournalctl _PID=4821 -o short-iso --no-pager | tail -n 50\n\n# 3) 结构化字段：把时间戳、优先级、消息交给下游统计\njournalctl -u app-api.service -o json --since '-30min' | jq -r '[.__REALTIME_TIMESTAMP, PRIORITY, MESSAGE] | @tsv' | sort | uniq -c | sort -rn | head\n\n# 4) 确认日志有没有被限流丢掉\njournalctl --since '-1h' | grep -i suppressed || echo 'no suppression'",
          explanation:
            "第一步先固定窗口，避免被更早的同类错误带偏；第二步用 PID 把这个进程的全部日志拉出来，包括它退出前的最后几行，往往能直接看到根因；第三步用 json 输出把结构化字段交给统计，比人工翻页可靠；第四步确认日志是否被限流吞掉，否则所有结论都建立在缺失的数据上。注意时间过滤要写时区明确的格式，否则跨时区排查会对不上。",
        },
        practiceSteps: [
          "记录故障现象与大致时间，把窗口收敛到分钟级。",
          "按单元、PID、容器标识过滤，避免把全机日志混在一起。",
          "从 warning 级别起向下看，找到第一条异常再向后追。",
          "检查限流与轮转配置，确认窗口内的日志确实完整。",
        ],
        masteryChecklist: [
          "能解释 -p err 的阈值语义。",
          "能说明 journald 重启丢日志的原因与持久化方法。",
          "能判断一次排障所用的证据链是否完整。",
        ],
        summary: [
          "先定窗口与对象，再谈关键字。",
          "-p 是阈值，err 包含更严重的级别。",
          "默认 journal 在内存，重启即丢。",
          "限流与轮转会悄悄吃掉证据，要提前确认。",
        ],
        terms: [
          {
            term: "journald",
            plain: "systemd 的日志收集服务，统一收应用输出。",
            detail:
              "它接收标准输出与错误，也接收 syslog 协议的消息，再按配置决定持久化与转发。字段化存储是它比纯文本日志强的地方。",
          },
          {
            term: "优先级",
            plain: "日志严重程度的 0 到 7 编号，越小越严重。",
            detail:
              "0 到 7 依次是 emerg、alert、crit、err、warning、notice、info、debug。过滤时给的是阈值，不是精确匹配。",
          },
          {
            term: "速率限制",
            plain: "单位时间内日志太多就丢弃，防止刷爆磁盘。",
            detail:
              "默认配置下突发量会被截断，并留下一条抑制提示。排障时看到日志凭空变少，先查这个配置，再怀疑应用。",
          },
          {
            term: "logrotate",
            plain: "按大小或时间切分旧日志并按份数淘汰。",
            detail:
              "它决定事故窗口能不能被覆盖。保留份数太少，复盘时窗口外的记录早已被删，取证链会断在起点。",
          },
        ],
      },
    },
    questions: [
      {
        key: "linux-exp-linux-log-evidence-chain-s1",
        stageKey: "linux-process-system",
        topicKey: "linux-log-evidence-chain",
        type: "single",
        stem: "journalctl -p err 选出的日志范围是什么？",
        options: [
          { key: "A", text: "只有 err 这一级" },
          { key: "B", text: "err 以及更严重的 crit、alert、emerg" },
          { key: "C", text: "err 以及更轻的 warning、notice、info、debug" },
          { key: "D", text: "所有级别的日志" },
        ],
        answer: ["B"],
        explanation:
          "syslog 优先级用 0 到 7 表示，数字越小越严重：emerg 为 0，err 为 3。指定 err 是阈值语义，选出 0 到 3 的全部级别，而不是只等于 err。要找更早的线索，还得把 warning 一起纳入，因为根因常常是上游的一条告警或超时。",
        difficulty: "medium",
        tags: ["journalctl", "日志级别"],
        sourceKey: "linux-system-reference",
        level: "进阶",
      },
      {
        key: "linux-exp-linux-log-evidence-chain-j1",
        stageKey: "linux-process-system",
        topicKey: "linux-log-evidence-chain",
        type: "judge",
        stem: "journald 默认把日志持久化到 /var/log/journal，所以机器重启后仍能用 journalctl 查到之前的日志。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "systemd 默认按 auto 策略存储：只有 /var/log/journal 目录存在时才持久化，否则写进 /run/log/journal，重启即丢。想让历史日志留下来，要创建该目录或显式设置持久化，并用容量上限控制占用，否则日志会反过来把磁盘写满。",
        difficulty: "hard",
        tags: ["日志", "持久化", "排障"],
        sourceKey: "linux-system-reference",
        level: "综合",
      },
    ],
  },
  {
    trackSlug: "linux",
    stageKey: "linux-automation-ops",
    topic: {
      key: "linux-package-dependency",
      title: "包管理器、依赖解析与版本锁定",
      summary:
        "apt 负责下载与依赖求解，dpkg 负责解包与登记；生产环境真正要治的是版本漂移，所以装包必须锁版本并固定仓库来源。",
      concepts: ["apt 与 dpkg 分工", "依赖图求解", "版本锁定", "dpkg 锁", "仓库优先级"],
      principles: [
        "apt 计算依赖并下载，dpkg 解包并登记状态；绕过 apt 直接装 deb 就跳过了依赖检查。",
        "依赖求解是带约束的搜索，无解时工具会拒绝而不是自动降级，需要人工给出可行版本组合。",
        "版本锁定要写精确版本并用 hold 阻止被动升级，否则同一脚本隔月执行会装出不同结果。",
        "多仓库同名包由优先级决定，混入不匹配的发行版仓库可能连基础库一起换掉。",
      ],
      applications: [
        "容器构建时锁死关键包版本，并记录清单，保证不同时间构建出同一环境。",
        "自动化脚本里先做半配置收尾，再安装，避免上一次中断让整条流水线失败。",
      ],
      pitfalls: [
        "两个 apt 进程并发撞上 dpkg 锁，安装被中断并留下未配置的包。",
        "只记录安装命令不记录版本，半年后无法复现同一套环境。",
        "混用不同发行版的仓库源，升级时把基础库换掉导致整机不可用。",
      ],
      method:
        "先确认发行版与仓库来源，用 apt-cache policy 看候选版本，安装时写死版本并 hold，最后用 dpkg 查询与依赖检查验证一致性。",
      exercise:
        "为一个生产镜像固定三个关键包的版本：写出安装命令、hold 命令与验证命令，并说明仓库快照在构建流程里怎么固定。",
      checkpoint: "能解释 apt 与 dpkg 的分工，并给出可复现的版本锁定方案。",
      lesson: {
        overview: [
          "包管理器不只是下载安装器，它维护着一张系统级的依赖图，并负责在安装、升级、卸载时保持这张图自洽。理解这一点，才能解释为什么 apt 有时会顺手卸掉一堆看似无关的包：那不是它乱来，而是在当前约束下只有那个解。看懂求解结果，比记住命令更重要，也能在方案不合理时及时喊停。",
          "分工也要分清：apt 读仓库索引、计算依赖、下载 deb，再调用 dpkg；dpkg 只负责解包、执行安装脚本、把状态写进数据库。绕过 apt 直接装单个 deb，等于跳过依赖检查，很容易把系统留在半配置状态。半配置状态的表现是后续所有安装都失败，恢复起来比想象中麻烦，所以能走 apt 就不要绕路。",
          "生产环境真正难的是可复现。同一条安装命令，隔一个月在另一台机器上执行，可能会装到更新的小版本，行为随之改变。锁版本、固定仓库来源、记录清单，这三件事决定了半年后还能不能复现同一套环境。把这三件事写进构建脚本，才算真正把环境当成代码来管理，而不是靠记忆和运气。",
        ],
        mechanism: [
          "apt 从仓库配置读取地址，下载包索引，用依赖求解器算出安装方案，再逐个调用 dpkg。dpkg 解包、执行安装前后脚本，把结果写进自己的状态数据库，这也是查询已装包的来源。所以 apt 报错与 dpkg 报错往往指向不同层，先分清是哪一层出问题，再去改配置或补依赖。",
          "锁文件防止并发修改：前端锁与数据库锁保护同一份状态。两个 apt 同时运行会撞锁，被中断的安装会留下未配置的包，后续命令全部报错，需要用 dpkg --configure -a 收尾。自动化里最常见的翻车，就是人工登录和定时任务同时装包，所以装包前先确认没有别的 apt 在跑。",
          "版本约束有三种常见写法：写等号精确锁定，写大于等于只是下界，用 hold 让后续升级跳过该包。多仓库同名包由优先级配置决定，超过 1000 的优先级可以强制降级。混入别的发行版仓库时，优先级和依赖会一起把系统推向不可预期的版本组合，这类改动一定要在测试机上先验证。",
          "可复现的做法是把版本与来源都固定下来：安装时写死版本号，仓库指向带日期的快照，构建产物里记录已装清单。容器场景还可以把依赖固化进镜像层，让运行时不再依赖仓库当天的状态。清单是最省事的证据，出问题时能立刻对比差异，也能在重建环境时一次装对。",
        ],
        example: {
          title: "锁版本、查候选、收尾半配置",
          language: "bash",
          code: "#!/usr/bin/env bash\nset -euo pipefail\n\nexport DEBIAN_FRONTEND=noninteractive\n\n# 1) 先看候选版本与来源，别盲装\napt-cache policy nginx | sed -n '1,4p'\n\n# 2) 精确锁版本安装，并阻止后续升级替换\napt-get update\napt-get install -y --no-install-recommends nginx=1.24.0-1\napt-mark hold nginx\n\n# 3) 上次被中断的安装先收尾，否则后续命令全部失败\ndpkg --audit || true\ndpkg --configure -a\n\n# 4) 验证：已装版本、被 hold 的包、依赖是否自洽\ndpkg-query -W nginx\napt-mark showhold\napt-get check\n\n# 5) 清理缓存，减小镜像层\napt-get clean",
          explanation:
            "第一步先用 apt-cache policy 看候选版本来自哪个仓库，避免装到意料之外的版本。第二步写等号精确锁定版本，再用 hold 阻止后续升级顺手替换。第三步处理上一次被中断的安装：dpkg 处于半配置状态时，后续任何安装都会失败。第四步用三条只读命令验证版本、锁定名单与依赖一致性。最后清理索引缓存，避免把几百兆的索引带进镜像层。",
        },
        practiceSteps: [
          "确认发行版与仓库来源，用 apt-cache policy 看候选版本。",
          "安装时写死版本号，并用 hold 阻止被动升级。",
          "把仓库固定到快照或内网镜像，避免上游更新改变构建结果。",
          "记录已装清单，安装后用依赖检查命令验证自洽。",
        ],
        masteryChecklist: [
          "能说清 apt 与 dpkg 的分工。",
          "能给出可复现的版本锁定方案。",
          "能解释 dpkg 锁冲突后如何收尾。",
        ],
        summary: [
          "apt 算依赖并下载，dpkg 解包并登记。",
          "直接装 deb 跳过依赖检查，容易留下半配置状态。",
          "锁版本加固定仓库，才能跨时间复现环境。",
          "撞锁或被中断后用 dpkg --configure -a 收尾。",
        ],
        terms: [
          {
            term: "dpkg",
            plain: "底层安装器，只负责解包和登记状态。",
            detail:
              "它不联网、不认识仓库，也不计算依赖。所有已装包的信息都在它维护的状态数据库里，查询命令读的就是这份数据。",
          },
          {
            term: "依赖求解",
            plain: "按约束算出要装哪些包、装哪个版本。",
            detail:
              "它是一道带约束的搜索题。没有可行解时工具会拒绝执行并给出候选，而不是自作主张降级，这时需要人来调整版本或仓库。",
          },
          {
            term: "版本锁定",
            plain: "把包固定在某个精确版本，不让升级替换。",
            detail:
              "精确版本加 hold 是两个动作：前者决定这次装哪个，后者阻止以后被动升级。生产环境两者都要有，否则版本会悄悄漂移。",
          },
          {
            term: "仓库优先级",
            plain: "多仓库同名包时，决定装哪一个版本。",
            detail:
              "由偏好配置文件控制。优先级过高可以强制降级，混入别的发行版仓库时尤其危险，可能连基础运行库一起被替换。",
          },
        ],
      },
    },
    questions: [
      {
        key: "linux-exp-linux-package-dependency-s1",
        stageKey: "linux-automation-ops",
        topicKey: "linux-package-dependency",
        type: "single",
        stem: "关于 apt 与 dpkg 的分工，下面哪一项正确？",
        options: [
          { key: "A", text: "apt 只负责下载，依赖计算由 dpkg 完成" },
          { key: "B", text: "dpkg 负责解包与登记安装状态，apt 负责下载索引、求解依赖并调用 dpkg" },
          { key: "C", text: "两者完全等价，可以互相替代" },
          { key: "D", text: "dpkg -i 会自动从仓库补齐缺失的依赖" },
        ],
        answer: ["B"],
        explanation:
          "apt 是上层工具：读仓库配置、下载包索引、用依赖求解器算出方案，再逐个调用 dpkg。dpkg 是底层安装器，只解包、执行安装脚本、把状态写进数据库，它不联网也不认识仓库。所以 dpkg -i 遇到缺失依赖只会把包留在未配置状态，A、C、D 都不成立。",
        difficulty: "medium",
        tags: ["apt", "dpkg", "包管理"],
        sourceKey: "linux-system-reference",
        level: "进阶",
      },
      {
        key: "linux-exp-linux-package-dependency-j1",
        stageKey: "linux-automation-ops",
        topicKey: "linux-package-dependency",
        type: "judge",
        stem: "用 dpkg -i 安装一个 deb 包时，如果依赖缺失，它会自动从仓库下载并安装依赖。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "dpkg 不联网也不认识仓库，依赖缺失时它只会报未满足的依赖，并把包留在未配置状态。补齐依赖要用 apt 的相关命令让它先算依赖再调用 dpkg，出问题后用 dpkg --configure -a 收尾。把 dpkg 当成 apt 用，是很多半配置系统的来源。",
        difficulty: "easy",
        tags: ["dpkg", "依赖"],
        sourceKey: "command-line-reference",
        level: "入门",
      },
    ],
  },
];
