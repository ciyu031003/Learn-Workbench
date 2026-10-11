import type { LearningTopicLesson } from "../types";

export const operatingSystemsTopicLessons: Record<string, LearningTopicLesson> = {
  "os-process-thread": {
    overview: [
      "进程与线程的差别不在「谁更轻」，而在「隔离与共享的边界画在哪里」。",
      "选错模型的代价通常表现为两类事故：共享状态写坏，或者隔离过强导致通信昂贵。",
    ],
    mechanism: [
      "创建进程要新建地址空间与页表，创建线程只需新栈与寄存器，因而线程创建与切换更便宜。",
      "线程共享堆与全局数据，因此并发访问必须自己加同步；进程之间默认互不可见，天然隔离。",
    ],
    example: {
      title: "线程共享、进程隔离",
      language: "c",
      code: `// 线程：共享同一地址空间，counter 需要同步
static int counter = 0;
void *worker(void *arg) {
    for (int i = 0; i < 100000; i++) counter++;  // 竞态！
    return NULL;
}

// 进程：各自独立的地址空间，counter 不会互相影响
// fork() 之后父子各有一份副本`,
      explanation: "同一段代码在线程里必须加锁、在进程里则天然无竞争——这就是「共享即需同步」的直接体现。",
    },
    practiceSteps: [
      "对比同一任务的线程版与进程版，观察资源占用与隔离差异。",
      "写一个无锁的自增计数器，复现竞态导致的结果错误。",
      "为「一个请求并行处理多个子任务」选择模型并说明理由。",
    ],
    masteryChecklist: [
      "能说出线程之间共享哪些资源。",
      "能解释为什么共享状态必须同步。",
    ],
  },
  "os-scheduling": {
    overview: [
      "调度的本质是排队与分配：让谁先用 CPU、用多久。",
      "所有「调参」都应先有观测依据，否则是在猜。",
    ],
    mechanism: [
      "切换要保存/恢复寄存器与栈；进程切换还要换页表并刷新 TLB，因此比线程切换更贵。",
      "时间片越短响应越好但切换开销占比越高；越长吞吐好但交互延迟变大。",
    ],
    example: {
      title: "观测上下文切换",
      language: "bash",
      code: `# 每 1 秒采样一次：cs 列是上下文切换次数
vmstat 1

procs -----------memory---------- ---swap-- -----io---- --system-- -------cpu-------
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa
 8  0      0 512000   1200 980000    0    0     4    12 2200 18000 40  9 51  0

# r 列长期大于核数 → 就绪队列积压
# cs 列过高 → 切换本身在消耗 CPU`,
      explanation: "先看就绪队列（r）与切换次数（cs），才能区分「CPU 不够」与「切换太频繁」这两类不同问题。",
    },
    practiceSteps: [
      "压测时观察 r 与 cs 两列的变化趋势。",
      "对比纯计算与大量阻塞 I/O 两类负载的切换频率。",
      "把线程数从过少调到过多，观察吞吐先升后降的拐点。",
    ],
    masteryChecklist: [
      "能说明为什么进程切换比线程切换更贵。",
      "能解释线程过多为什么会反而变慢。",
    ],
  },
  "os-ipc-sync": {
    overview: [
      "IPC 的选择标准是数据量、时延与同步需求，而不是习惯。",
      "共享内存最快，但把同步责任完全转移给了应用。",
    ],
    mechanism: [
      "管道与消息队列由内核中转，天然提供顺序与边界，但有拷贝开销。",
      "共享内存把同一段物理页映射进两个进程，数据零拷贝，但读写顺序必须靠信号量或 futex 协调。",
    ],
    example: {
      title: "共享内存 + 信号量",
      language: "c",
      code: `// 伪代码：共享内存只负责“放数据”，同步交给信号量
shm = shm_open("/buf", O_CREAT | O_RDWR, 0600);
ptr = mmap(NULL, SIZE, PROT_READ | PROT_WRITE, MAP_SHARED, shm, 0);

sem_wait(write_ok);      // 等空位
memcpy(ptr + offset, data, len);
sem_post(read_ready);    // 通知消费者`,
      explanation: "共享内存本身不提供任何同步；忘记配对 wait/post 会得到难以复现的脏读。",
    },
    practiceSteps: [
      "用管道实现一个生产者/消费者，观察缓冲区满时的阻塞行为。",
      "改用共享内存 + 信号量实现同一功能，对比拷贝次数。",
      "解释信号为什么只能传递事件而不能承载数据。",
    ],
    masteryChecklist: [
      "能解释共享内存「快但危险」的原因。",
      "能按数据量与时延需求选择合适的 IPC。",
    ],
  },
  "os-virtual-memory": {
    overview: [
      "虚拟内存给了两个礼物：进程之间的地址隔离，以及超出物理内存的地址空间。",
      "理解它要始终分清「虚拟地址」与「物理地址」，很多性能误判都源于混淆两者。",
    ],
    mechanism: [
      "MMU 用页表把虚拟地址翻译为物理地址；进程切换要换页表基址并刷新 TLB。",
      "越界或无权限访问由页表权限位拦下并触发异常，由内核决定是缺页还是报错。",
    ],
    example: {
      title: "进程切换时的地址空间动作",
      language: "text",
      code: `进程 A 运行中
  CR3 = 页表 A 基址

切换到进程 B
  1. 保存 A 的寄存器与栈指针
  2. CR3 ← 页表 B 基址
  3. 刷新 TLB（旧映射全部失效）
  4. 恢复 B 的寄存器

代价：TLB 与缓存局部性重建`,
      explanation: "第 3 步是进程切换昂贵的关键：地址空间变了，之前缓存的翻译结果全部作废。",
    },
    practiceSteps: [
      "打印一个进程的内存映射，识别代码段、堆、栈与共享库区间。",
      "解释一次进程切换在地址空间层面发生了什么。",
      "对比同一程序在线程与进程模型下的内存占用。",
    ],
    masteryChecklist: [
      "能说出虚拟内存带来的两个好处。",
      "能解释为什么进程切换要刷新 TLB。",
    ],
  },
  "os-paging": {
    overview: [
      "缺页是正常机制而不是故障：它让「按需加载」和「超出物理内存」成为可能。",
      "多级页表与 TLB 的组合，是空间、时间与容量之间的三方权衡。",
    ],
    mechanism: [
      "缺页处理流程：分配页框 → 从后备存储载入 → 更新页表 → 让指令重新执行。",
      "多级页表只为实际使用的区域分配中间层，节省空间，代价是未命中 TLB 时要做多次访存。",
    ],
    example: {
      title: "缺页率与访存代价",
      language: "text",
      code: `平均访存时间 = 命中时间 + 缺页率 × 缺页代价

TLB 命中        1ns
缺页率 0.1% × 磁盘 100µs = 100ns
──────────────────────────────
平均            101ns   ← 单次缺页把平均拉高两个数量级`,
      explanation: "这条式子解释了为什么「缺页率看起来很低」依然可能是主要瓶颈。",
    },
    practiceSteps: [
      "用工具观察一个内存压力进程的缺页率变化。",
      "解释缺页发生后为什么指令要重新执行。",
      "对比顺序访问与随机访问同一数据的缺页与 TLB 表现。",
    ],
    masteryChecklist: [
      "能说明缺页发生后为什么指令要重新执行。",
      "能解释多级页表省了什么、付出了什么。",
    ],
  },
  "os-allocation": {
    overview: [
      "分配器在速度、空间利用率与碎片之间取舍，没有全赢的方案。",
      "排查「内存持续增长」时，先分清虚拟占用与常驻占用。",
    ],
    mechanism: [
      "内部碎片是分配单元大于实际需要；外部碎片是空闲空间不连续，总量够却凑不出大块。",
      "惰性分配让 malloc 成功不等于占用物理内存，首次访问才触发缺页映射。",
    ],
    example: {
      title: "虚拟占用 ≠ 真实占用",
      language: "bash",
      code: `# 看进程内存：VIRT 是虚拟地址空间，RSS 才是常驻物理内存
ps -o pid,vsz,rss,comm -p $$

# 只申请不写入 → VIRT 涨、RSS 几乎不变
python3 -c "x = bytearray(200*1024*1024)"; sleep 5

# 逐页写入 → RSS 随之上涨
python3 -c "x = bytearray(200*1024*1024); x[::4096] = b'1' * len(x[::4096])"`,
      explanation: "只看 VIRT 会把「预留地址空间」误判成内存泄漏；RSS 才反映真实物理占用。",
    },
    practiceSteps: [
      "对比同一进程的 VIRT 与 RSS，解释差距来源。",
      "写一个「申请但不写入」的程序，观察 RSS 是否上涨。",
      "为一次内存增长排查写出观测路径与判定标准。",
    ],
    masteryChecklist: [
      "能区分内部碎片与外部碎片。",
      "能说明惰性分配为什么让申请不等于占用。",
    ],
  },
  "os-interrupt-driver": {
    overview: [
      "设备通知 CPU 有两种基本方式：让 CPU 反复问（轮询），或者设备主动喊（中断）。",
      "DMA 的价值在于把「搬运」这件事从 CPU 手里拿走。",
    ],
    mechanism: [
      "中断驱动下 CPU 不必空转等待，设备就绪时发中断；轮询省去中断开销，适合高频可预测设备。",
      "DMA 控制器直接在设备与内存之间传输，传输完成后才中断 CPU。",
    ],
    example: {
      title: "三种 I/O 方式的 CPU 开销",
      language: "text",
      code: `程序控制轮询    CPU 全程空转检查状态      开销最高
中断驱动        就绪时打断 CPU             中等
DMA            设备直连内存，完成才中断   最低

高 PPS 场景还常用轮询模式驱动（NAPI）：
  省去每包中断的固定开销，批量处理`,
      explanation: "「中断一定最好」是常见误解：开销与设备速率相关，高频场景反而要合并中断或改用轮询。",
    },
    practiceSteps: [
      "对比同一设备在轮询与中断下的 CPU 占用。",
      "解释高 PPS 网络为什么倾向轮询模式驱动。",
      "说明中断处理为什么要尽量短小。",
    ],
    masteryChecklist: [
      "能说明 DMA 省掉的到底是什么开销。",
      "能解释中断上下文为什么不能做阻塞操作。",
    ],
  },
  "os-filesystem": {
    overview: [
      "文件系统的核心问题是：如何用块索引表达一个可变长的文件，并在崩溃后仍能恢复。",
      "inode、目录项与日志三者配合，分别解决索引、命名与一致性。",
    ],
    mechanism: [
      "inode 保存元数据与数据块位置，目录项保存「名字 → inode 号」的映射。",
      "日志先记录变更意图，崩溃后回放已提交事务或丢弃未提交事务，避免全盘扫描。",
    ],
    example: {
      title: "硬链接与符号链接",
      language: "bash",
      code: `echo hello > a
ln a b          # 硬链接：a 与 b 指向同一 inode
ln -s a c       # 符号链接：c 是一个独立文件，内容是路径 "a"

ls -li a b c    # a、b 的 inode 号相同，c 不同
rm a            # 数据仍在：b 还引用着这个 inode
rm b            # 链接数归零，数据才真正释放`,
      explanation: "「删除文件」删的是目录项与链接计数，而不是数据本身；理解这一点才能解释磁盘空间何时被回收。",
    },
    practiceSteps: [
      "用 ls -li 观察硬链接与符号链接的 inode 差异。",
      "解释删除仍有硬链接的文件后数据何时释放。",
      "对比写入后 fsync 与不 fsync 的持久性与性能差异。",
    ],
    masteryChecklist: [
      "能说明 inode 里有什么、没有什么。",
      "能解释日志文件系统如何缩短崩溃恢复时间。",
    ],
  },
  "os-io-model": {
    overview: [
      "I/O 模型的区别在于「谁来等待」：线程等待、还是内核通知应用就绪。",
      "多路复用是「一个线程管很多连接」的关键，也是高并发网关的基石。",
    ],
    mechanism: [
      "阻塞 I/O 让线程睡眠；非阻塞 I/O 立即返回，由应用决定何时重试。",
      "epoll 只返回就绪集合，复杂度与活跃连接数相关，而 select/poll 每次都要全量轮询。",
    ],
    example: {
      title: "select 与 epoll 的复杂度差异",
      language: "text",
      code: `10000 连接、其中 100 个活跃

select/poll   每次调用遍历全部 10000 个 fd   O(n)
epoll         内核维护就绪表，只返回 100 个    O(活跃数)

→ 连接数越大，差距越明显`,
      explanation: "这就是「C10K 问题」的解法：把每次全量检查换成事件驱动的就绪通知。",
    },
    practiceSteps: [
      "用 select 与 epoll 各实现一个 echo 服务，压测对比。",
      "解释边缘触发与水平触发的语义差异及各自适用场景。",
      "为一个高并发网关选择 I/O 模型并说明理由。",
    ],
    masteryChecklist: [
      "能解释 epoll 为什么在大连接数下更优。",
      "能说明阻塞与非阻塞的本质差别。",
    ],
  },
  "os-locks": {
    overview: [
      "锁的选择取决于临界区长度与是否允许睡眠。",
      "死锁不是玄学：四个必要条件里打破任意一个就能避免。",
    ],
    mechanism: [
      "自旋锁忙等不让出 CPU，适合极短临界区；互斥量会让出 CPU，适合较长临界区。",
      "死锁四条件为互斥、持有并等待、不可剥夺、循环等待；统一加锁顺序即打破循环等待。",
    ],
    example: {
      title: "统一加锁顺序避免死锁",
      language: "c",
      code: `// 危险：两个线程以相反顺序拿锁
// 线程1: lock(A); lock(B);
// 线程2: lock(B); lock(A);   ← 可能互相等待

// 安全：全局统一顺序（按地址/编号）
void transfer(Account *from, Account *to) {
    Account *first  = from < to ? from : to;
    Account *second = from < to ? to : from;
    lock(first);
    lock(second);
    // ... 临界区
    unlock(second);
    unlock(first);
}`,
      explanation: "只要所有线程按同一顺序获取锁，就无法形成循环等待，这是工程上最省事的死锁预防手段。",
    },
    practiceSteps: [
      "构造两把锁交叉加锁的死锁场景并复现。",
      "用统一加锁顺序修复它并验证。",
      "判断一段代码该用自旋锁还是互斥量。",
    ],
    masteryChecklist: [
      "能说出死锁的四个必要条件。",
      "能解释持锁做 I/O 为什么危险。",
    ],
  },
  "os-syscall": {
    overview: [
      "系统调用是用户态请求内核服务的唯一正规入口，也是保护机制的物理边界。",
      "跨边界的代价包括特权级切换、参数校验与数据拷贝，因此热路径要尽量减少调用次数。",
    ],
    mechanism: [
      "应用通过陷阱指令从用户态切到内核态，按系统调用号分派到内核实现，完成后返回用户态。",
      "用户态受页表权限位限制，不能直接访问任意物理内存。",
    ],
    example: {
      title: "统计并减少系统调用",
      language: "bash",
      code: `# 统计一次写入的系统调用次数
strace -c -e trace=write,read dd if=/dev/zero of=/tmp/x bs=1 count=1000 2>&1 | tail -5

# 把小写入合并成大块写 → 系统调用次数大幅下降
dd if=/dev/zero of=/tmp/y bs=1M count=1`,
      explanation: "同样的数据量，块大小从 1 字节改成 1MB，系统调用从上千次降到个位数，吞吐差异可能达到数量级。",
    },
    practiceSteps: [
      "用 strace -c 统计一段程序的系统调用分布。",
      "把频繁小写改成批量写并复测耗时。",
      "解释系统调用为什么比普通函数调用贵。",
    ],
    masteryChecklist: [
      "能解释系统调用为什么比普通函数调用贵。",
      "能说明用户态为什么不能直接访问任意内存。",
    ],
  },
  "os-boot-container": {
    overview: [
      "启动流程把控制权从固件交给内核，再交给 PID 1。",
      "容器不是小虚拟机：它复用宿主内核，靠命名空间与 cgroup 做隔离与限额。",
    ],
    mechanism: [
      "内核初始化设备与驱动后挂载根文件系统，再执行 init 类进程接管服务工作。",
      "命名空间隔离视图（进程、网络、挂载等），cgroup 限制 CPU/内存等资源用量。",
    ],
    example: {
      title: "容器隔离依赖的两类机制",
      language: "bash",
      code: `# 视图隔离：新命名空间里看不到宿主进程
unshare --pid --fork --mount-proc ps -ef

# 资源限额：限制内存 256MB
docker run --memory=256m --cpus=1 myapp

# 二者组合 → 隔离 + 限额，但共享同一个内核`,
      explanation: "共享内核意味着容器启动快、密度高，但也意味着内核漏洞影响面更大——这正是虚拟机仍不可替代的原因。",
    },
    practiceSteps: [
      "在新命名空间中启动一个 shell，确认看不到宿主进程。",
      "为一个服务设置内存上限，触发并观察 OOM 行为。",
      "对比容器与虚拟机在启动时间与隔离强度上的差异。",
    ],
    masteryChecklist: [
      "能说出容器隔离依赖的两类内核机制。",
      "能解释容器与虚拟机在隔离强度上的差别。",
    ],
  },
};
