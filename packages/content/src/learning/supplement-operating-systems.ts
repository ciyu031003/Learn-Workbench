import type { LearningDifficulty, LearningQuestion, LearningLevel } from "./types";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function singleQuestion(input: {
  key: string; stageKey: string; topicKey: string;
  stem: string; options: [string, string, string, string];
  answer: "A" | "B" | "C" | "D"; explanation: string;
  difficulty: LearningDifficulty; tags: string[]; sourceKey: string; level: LearningLevel;
}): LearningQuestion {
  return { key: input.key, stageKey: input.stageKey, topicKey: input.topicKey, type: "single",
    stem: input.stem, options: input.options.map((t, i) => ({ key: OPTION_KEYS[i], text: t })),
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

/** 操作系统 补充题库（按知识点细分，2 题/知识点：1 单选 + 1 判断）。 */
export const operatingsystemsSupplementQuestions: LearningQuestion[] = [
  // ===== os-process-thread =====
  singleQuestion({ key: "operating-systems-sup-os-process-thread-s1", stageKey: "os-process-stage", topicKey: "os-process-thread",
    stem: "关于进程与线程的关系，以下哪一项描述是正确的？",
    options: [
      "进程是资源分配的基本单位，线程是 CPU 调度的基本单位，同一进程内的线程共享地址空间",
      "线程是资源分配的基本单位，进程是 CPU 调度的基本单位，二者地址空间互相独立",
      "进程和线程是同一概念，只是不同操作系统叫法不同，没有任何区别",
      "每个线程都拥有独立的内核栈、独立的虚拟地址空间与独立的打开文件表",
    ],
    answer: "A",
    explanation: "进程是操作系统进行资源分配（内存、打开文件、信号等）的基本单位，而线程是内核调度执行的基本单位。同一进程内的多个线程共享该进程的虚拟地址空间、堆和全局变量，但各自拥有独立的栈、寄存器与程序计数器，因此线程切换代价通常小于进程切换。",
    difficulty: "easy", tags: ["进程", "线程"], sourceKey: "linux-kernel", level: "入门" }),
  judgeQuestion({ key: "operating-systems-sup-os-process-thread-j1", stageKey: "os-process-stage", topicKey: "os-process-thread",
    stem: "同一进程内的多个线程共享同一个虚拟地址空间，因此一个线程对全局变量的修改，其他线程立刻可见，无需任何同步机制也能保证数据安全。",
    answer: false,
    explanation: "虽然同一进程的线程共享地址空间，使得一个线程写入的全局变量对其他线程可见，但多个线程并发读写共享数据会引发竞态条件，导致结果依赖于调度时序而不可预测。必须使用互斥锁、原子操作等同步机制才能保证数据安全，可见性并不等同于正确性。",
    difficulty: "easy", tags: ["进程", "线程", "同步"], sourceKey: "linux-kernel", level: "入门" }),

  // ===== os-scheduling =====
  singleQuestion({ key: "operating-systems-sup-os-scheduling-s1", stageKey: "os-process-stage", topicKey: "os-scheduling",
    stem: "在抢占式调度中，以下关于上下文切换（context switch）代价的说法，哪项正确？",
    options: [
      "上下文切换需要保存和恢复寄存器、程序计数器等状态，并可能刷新 TLB，因此存在不可忽视的开销",
      "上下文切换完全由硬件在一条指令内完成，对 CPU 没有任何额外开销",
      "上下文切换只切换页表基址，不需要保存任何寄存器，所以几乎没有代价",
      "只有进程切换才算上下文切换，同一进程内线程切换不需要保存任何状态",
    ],
    answer: "A",
    explanation: "上下文切换时内核必须保存当前进程的寄存器、程序计数器、栈指针等硬件上下文，并加载下一个进程的上下文；若切换到不同地址空间还需切换页表，导致 TLB 部分或全部失效，引发后续访存代价。这些操作消耗 CPU 周期，因此高频上下文切换会降低系统吞吐。",
    difficulty: "medium", tags: ["调度", "上下文切换"], sourceKey: "xv6", level: "进阶" }),
  judgeQuestion({ key: "operating-systems-sup-os-scheduling-j1", stageKey: "os-process-stage", topicKey: "os-scheduling",
    stem: "时间片轮转（RR）调度属于抢占式调度，每个进程运行一个固定时间片后被强制让出 CPU，从而保证交互任务的响应性。",
    answer: true,
    explanation: "时间片轮转给每个就绪进程分配一个时间片，时间片耗尽后由时钟中断触发抢占，内核将当前进程放回就绪队列并选择下一个进程运行。这种抢占机制防止了单个进程长期霸占 CPU，使多个任务能公平、及时地获得处理器响应，是典型的交互式调度策略。",
    difficulty: "medium", tags: ["调度", "时间片"], sourceKey: "xv6", level: "进阶" }),

  // ===== os-ipc-sync =====
  singleQuestion({ key: "operating-systems-sup-os-ipc-sync-s1", stageKey: "os-process-stage", topicKey: "os-ipc-sync",
    stem: "两个互不相关的进程需要交换大量数据，下列哪种进程间通信（IPC）机制通常能提供最高的带宽、最低的拷贝开销？",
    options: [
      "共享内存（shared memory），仅在建立映射时拷贝一次，之后双方直接读写同一块物理页",
      "匿名管道（pipe），每次 write 都需要内核在读写双方之间完整拷贝数据",
      "信号（signal），可以携带任意长度的字符串负载并在进程间直接传输",
      "消息队列每次发送都需要把数据从用户态逐字节复制到内核再复制回用户态，且能传输无限大消息",
    ],
    answer: "A",
    explanation: "共享内存允许多个进程把同一段物理内存映射到各自的虚拟地址空间，建立映射后双方读写不再经过内核中转，避免了反复的用户态-内核态数据拷贝，因此带宽高、延迟低。管道与消息队列通常需要在内核缓冲区做数据拷贝，信号只适合传递极少量事件而非大量数据。",
    difficulty: "medium", tags: ["IPC", "共享内存"], sourceKey: "linux-kernel", level: "进阶" }),
  judgeQuestion({ key: "operating-systems-sup-os-ipc-sync-j1", stageKey: "os-process-stage", topicKey: "os-ipc-sync",
    stem: "信号量（semaphore）的 P 操作（wait）和 V 操作（signal）必须是原子操作，否则在多处理器上并发执行时可能产生竞态，导致临界区保护失效。",
    answer: true,
    explanation: "信号量用来控制对共享资源的并发访问，其 P/V 操作对计数值的减一和加一必须是原子地、不可中断地完成。若非原子，多个 CPU 同时进入临界区前读取到相同的计数值，便会同时获得许可，破坏互斥，因此原子性是信号量正确性的前提。",
    difficulty: "medium", tags: ["同步", "信号量"], sourceKey: "xv6", level: "进阶" }),

  // ===== os-memory-stage =====
  singleQuestion({ key: "operating-systems-sup-os-memory-stage-s1", stageKey: "os-memory-stage", topicKey: "os-virtual-memory",
    stem: "关于操作系统内存管理的目标，以下哪一项说法最全面？",
    options: [
      "在有限物理内存下，通过抽象、隔离、共享与置换，让多个进程安全、高效地使用比物理内存更大的地址空间",
      "内存管理唯一目标就是把所有程序都放进物理内存，不允许任何程序使用磁盘作为后备存储",
      "内存管理只需要保证单进程能运行，不需要考虑进程之间的隔离与保护",
      "内存管理应尽可能让每个进程独占全部物理内存，以提升各自运行速度",
    ],
    answer: "A",
    explanation: "内存管理的核心目标包括：用虚拟地址为每个进程提供独立、连续的地址空间抽象；通过权限位实现进程间隔离与保护；支持内存共享以节省空间；借助换页把不常用页换出到磁盘，从而在物理内存不足时仍能运行大程序。这些都是提升安全性与利用率的关键设计。",
    difficulty: "easy", tags: ["内存管理", "虚拟内存"], sourceKey: "linux-kernel", level: "入门" }),
  judgeQuestion({ key: "operating-systems-sup-os-memory-stage-j1", stageKey: "os-memory-stage", topicKey: "os-virtual-memory",
    stem: "现代操作系统为每个进程提供独立的虚拟地址空间，进程 A 直接通过虚拟地址访问到的数据，不会因为地址数值相同而意外读到进程 B 的内存。",
    answer: true,
    explanation: "每个进程拥有各自独立的页表，相同的虚拟地址经不同页表翻译后映射到不同的物理页。因此即便两个进程的某个虚拟地址数值相同，硬件 MMU 也会根据当前进程的页表将其翻译到不同的物理位置，天然实现了进程间内存隔离与保护。",
    difficulty: "easy", tags: ["内存管理", "隔离"], sourceKey: "linux-kernel", level: "入门" }),

  // ===== os-virtual-memory =====
  singleQuestion({ key: "operating-systems-sup-os-virtual-memory-s1", stageKey: "os-memory-stage", topicKey: "os-virtual-memory",
    stem: "关于虚拟内存与地址翻译，下列说法正确的是？",
    options: [
      "CPU 发出的虚拟地址经 MMU 结合页表翻译为物理地址，页面不在内存时触发缺页异常由内核处理",
      "虚拟地址就是物理地址，CPU 直接把程序里的地址送到内存总线上，不需要任何翻译",
      "只有内核态代码访问内存时才需要地址翻译，用户态程序直接使用物理地址",
      "地址翻译完全由软件逐条查表完成，硬件 MMU 不参与任何翻译工作",
    ],
    answer: "A",
    explanation: "现代 CPU 执行时产生的是虚拟地址，内存管理单元（MMU）依据当前进程的页表把虚拟地址转换为物理地址。若目标页尚未装入物理内存（即发生缺页），MMU 触发缺页异常，陷入内核后由页面调度程序从磁盘载入该页并更新页表，之后再重试引发异常的指令。",
    difficulty: "medium", tags: ["虚拟内存", "地址翻译"], sourceKey: "xv6", level: "进阶" }),
  judgeQuestion({ key: "operating-systems-sup-os-virtual-memory-j1", stageKey: "os-memory-stage", topicKey: "os-virtual-memory",
    stem: "虚拟内存使得程序可以使用比实际物理内存更大的地址空间，其代价之一是需要额外的页表等结构占用内存，并带来地址翻译的硬件开销。",
    answer: true,
    explanation: "虚拟内存用磁盘作为内存的后备，让进程地址空间总量可超过物理内存，提升了多任务能力与便利性。但每个进程都要维护页表，多级页表会占用不少内存，且每次访存都需 MMU 查表（常借助 TLB 加速），因此确实存在空间与时间的额外开销，这是权衡后的设计代价。",
    difficulty: "medium", tags: ["虚拟内存", "开销"], sourceKey: "linux-kernel", level: "进阶" }),

  // ===== os-paging =====
  singleQuestion({ key: "operating-systems-sup-os-paging-s1", stageKey: "os-memory-stage", topicKey: "os-paging",
    stem: "关于分页（paging）与缺页（page fault），以下描述哪项正确？",
    options: [
      "分页把虚拟地址空间和物理内存都切成固定大小的页，缺页指访问的虚拟页尚未映射到物理页，需内核调入",
      "分页要求虚拟地址空间和物理内存必须按程序的逻辑段（代码、数据、堆）连续分配，不能离散存放",
      "只要发生缺页就说明程序出现非法访问错误，内核必须立即终止该进程",
      "页表项只保存物理页框号，不需要记录该页是否在内存或是否可写等状态位",
    ],
    answer: "A",
    explanation: "分页机制将虚拟内存和物理内存统一划分为固定大小的页/页框，通过页表建立映射，允许虚拟页离散地落在任意物理页框上。缺页并不一定代表错误：当访问的虚拟页合法但尚未装入物理内存（如首次访问、被换出）时，内核会分配页框并从磁盘载入后恢复正常执行。",
    difficulty: "medium", tags: ["分页", "缺页"], sourceKey: "xv6", level: "进阶" }),
  judgeQuestion({ key: "operating-systems-sup-os-paging-j1", stageKey: "os-memory-stage", topicKey: "os-paging",
    stem: "采用请求分页（demand paging）时，进程启动时并不把全部页面载入内存，而是在真正访问到某页且该页不在内存时才触发缺页并载入，从而节省启动时间和内存。",
    answer: true,
    explanation: "请求分页遵循按需装入原则：只有当程序实际访问某虚拟页而该页尚未在物理内存时，才由缺页异常处理程序把它从磁盘（如可执行文件或交换区）调入。这样进程启动时不需载入全部页面，既缩短启动延迟，又让物理内存只保留真正被使用的页，提升整体利用率。",
    difficulty: "medium", tags: ["分页", "请求分页"], sourceKey: "xv6", level: "进阶" }),

  // ===== os-allocation =====
  singleQuestion({ key: "operating-systems-sup-os-allocation-s1", stageKey: "os-memory-stage", topicKey: "os-allocation",
    stem: "关于内存分配中的碎片问题，下列说法哪项正确？",
    options: [
      "外部碎片指空闲内存总量足够，但被切分成许多不连续的小块而无法满足较大连续分配请求",
      "内部碎片指进程释放内存后系统无法回收，导致全部空闲内存彻底消失",
      "分页管理因为必须分配连续物理内存，所以比连续分配更容易产生外部碎片",
      "伙伴系统（buddy system）通过任意大小切分来彻底消除所有类型的碎片",
    ],
    answer: "A",
    explanation: "外部碎片出现在多次分配与释放后，空闲内存总和不小，但散布为许多不连续的细小块，无法拼出满足某次连续请求的大块。与之相对，内部碎片是分配给进程的块略大于需求而浪费在块内部。分页用固定页框映射，基本消除外部碎片，但可能产生内部碎片。",
    difficulty: "medium", tags: ["内存分配", "碎片"], sourceKey: "linux-kernel", level: "进阶" }),
  judgeQuestion({ key: "operating-systems-sup-os-allocation-j1", stageKey: "os-memory-stage", topicKey: "os-allocation",
    stem: "伙伴系统（buddy system）把内存按 2 的幂次大小进行分配与合并，能够有效减少外部碎片，但分配非 2 的幂次大小时仍可能产生内部碎片。",
    answer: true,
    explanation: "伙伴系统维护一系列大小为 2 的幂的内存块，分配时向上取整到最近的 2 的幂并递归拆分，释放时尝试与相邻伙伴块合并。它显著降低了外部碎片，但因为只能分配 2 的幂次块，当请求大小不是 2 的幂时，多余部分就造成了内部碎片，因而无法完全消除浪费。",
    difficulty: "medium", tags: ["内存分配", "伙伴系统"], sourceKey: "linux-kernel", level: "进阶" }),

  // ===== os-io-fs-stage =====
  singleQuestion({ key: "operating-systems-sup-os-io-fs-stage-s1", stageKey: "os-io-fs-stage", topicKey: "os-interrupt-driver",
    stem: "关于 I/O 与文件系统的整体定位，下列说法正确的是？",
    options: [
      "文件系统为持久化存储提供按名存取的组织抽象，I/O 子系统则管理设备与 CPU 之间的数据传输",
      "文件系统只负责把数据写进内存缓存，不关心数据最终如何落到磁盘等物理设备",
      "I/O 子系统完全独立于内核，运行在用户态并直接操作硬件端口",
      "文件系统与 I/O 子系统是同一个模块，二者没有任何职责划分",
    ],
    answer: "A",
    explanation: "文件系统构建在存储设备之上，用目录树与文件这一抽象为用户提供按名存取和权限管理；I/O 子系统则屏蔽设备差异，通过驱动、中断和缓冲机制管理 CPU 与外设间的数据传输。两者紧密协作：文件系统的读写最终都经由 I/O 子系统驱动具体硬件完成。",
    difficulty: "easy", tags: ["I/O", "文件系统"], sourceKey: "linux-kernel", level: "入门" }),
  judgeQuestion({ key: "operating-systems-sup-os-io-fs-stage-j1", stageKey: "os-io-fs-stage", topicKey: "os-interrupt-driver",
    stem: "为了提高性能，操作系统通常会对文件读写使用页缓存（page cache），写操作可能先进入缓存而非立即落盘，因此存在掉电后数据丢失的风险。",
    answer: true,
    explanation: "页缓存把文件数据缓存在内存中，读可命中缓存避免慢速磁盘访问，写常采用回写（write-back）策略先更新缓存、延后刷盘以聚合写操作。代价是若系统突然掉电，尚未刷回磁盘的脏页会丢失，因此关键数据需要 fsync 等调用强制落盘以保证持久性。",
    difficulty: "easy", tags: ["I/O", "页缓存"], sourceKey: "linux-kernel", level: "入门" }),

  // ===== os-interrupt-driver =====
  singleQuestion({ key: "operating-systems-sup-os-interrupt-driver-s1", stageKey: "os-io-fs-stage", topicKey: "os-interrupt-driver",
    stem: "关于中断、DMA 与设备驱动，下列说法正确的是？",
    options: [
      "DMA 允许设备在不占用 CPU 的情况下，直接把数据在内存与外设之间搬运，完成后以中断通知 CPU",
      "每次 I/O 数据传输都必须由 CPU 逐字节拷贝，DMA 在整个过程中毫无作用",
      "中断的作用只是让 CPU 定时轮询设备状态，不能用于表示设备已完成某项任务",
      "设备驱动运行在完全脱离内核的用户态程序里，内核从不参与驱动逻辑",
    ],
    answer: "A",
    explanation: "中断机制让设备在就绪或完成工作时主动通知 CPU，避免 CPU 忙等轮询；DMA 控制器则可在 CPU 让出总线后独立地在设备与内存间批量搬移数据，传输结束再发中断。这样 CPU 仅在开始和结束阶段介入，大幅降低大块数据传输对处理器的占用。",
    difficulty: "medium", tags: ["中断", "DMA"], sourceKey: "raspberry-pi-os", level: "进阶" }),
  judgeQuestion({ key: "operating-systems-sup-os-interrupt-driver-j1", stageKey: "os-io-fs-stage", topicKey: "os-interrupt-driver",
    stem: "设备驱动是内核的一部分，它把具体硬件的操作细节封装起来，向上层提供统一的 I/O 接口，从而屏蔽不同设备之间的差异。",
    answer: true,
    explanation: "设备驱动位于内核态，负责初始化硬件、响应中断、执行具体的寄存器读写与 DMA 配置等工作。操作系统通过驱动模型把千差万别的硬件包装成统一的文件或设备接口，使上层的文件系统与应用程序无需关心硬件实现细节，这是 I/O 可移植性的关键。",
    difficulty: "medium", tags: ["驱动", "设备"], sourceKey: "raspberry-pi-os", level: "进阶" }),

  // ===== os-filesystem =====
  singleQuestion({ key: "operating-systems-sup-os-filesystem-s1", stageKey: "os-io-fs-stage", topicKey: "os-filesystem",
    stem: "关于 UNIX 风格文件系统中的 inode，下列说法正确的是？",
    options: [
      "inode 保存文件的元数据（权限、大小、时间戳、数据块指针等），文件名存储在目录项而非 inode 中",
      "inode 直接保存文件的完整内容，因此不需要任何数据块即可读取小文件",
      "每个目录项把文件名直接映射到文件内容，中间不存在 inode 这一层间接结构",
      "同一个文件只能有一个硬链接，创建第二个链接会导致原 inode 被立即删除",
    ],
    answer: "A",
    explanation: "在 UNIX/Linux 文件系统中，inode 是文件的元数据节点，记录权限、属主、大小、时间戳以及指向数据块的指针，但不含文件名。文件名与 inode 编号的对应关系保存在目录项里，因此同一 inode 可被多个目录项（硬链接）引用，只有链接计数归零且文件关闭时数据才真正释放。",
    difficulty: "medium", tags: ["文件系统", "inode"], sourceKey: "linux-kernel", level: "进阶" }),
  judgeQuestion({ key: "operating-systems-sup-os-filesystem-j1", stageKey: "os-io-fs-stage", topicKey: "os-filesystem",
    stem: "删除一个文件（如执行 rm）在大多数情况下只是减少其 inode 的链接计数，只有当链接计数降为 0 且该文件当前没有被任何进程打开时，其数据块才会被真正回收。",
    answer: true,
    explanation: "unlink/rm 操作移走目录项并让 inode 的链接计数减一。若计数变为 0 但仍有进程持有该文件的描述符，内核会延后到进程关闭后才释放数据块；只有链接计数为 0 且无打开引用时，文件系统才把对应的数据块与 inode 标记为空闲，因此已打开的文件即使被删除仍可继续读写。",
    difficulty: "medium", tags: ["文件系统", "inode", "删除"], sourceKey: "linux-kernel", level: "进阶" }),

  // ===== os-io-model =====
  singleQuestion({ key: "operating-systems-sup-os-io-model-s1", stageKey: "os-io-fs-stage", topicKey: "os-io-model",
    stem: "在 I/O 模型中，关于阻塞 I/O、非阻塞 I/O 与 I/O 多路复用，下列说法正确的是？",
    options: [
      "I/O 多路复用（如 select/poll/epoll）让一个线程同时监视多个描述符，其中就绪者才被处理，适合高并发连接",
      "阻塞 I/O 调用会立即返回，无论数据是否就绪，因此单线程也能轻松支撑上万并发连接",
      "非阻塞 I/O 调用在内核数据未准备好时会一直挂起当前线程直到数据到达才返回",
      "I/O 多路复用要求每个连接必须分配一个独立的内核线程去轮询，否则无法获知就绪事件",
    ],
    answer: "A",
    explanation: "I/O 多路复用借助 select/poll/epoll 等机制，使单个线程能够同时注册并监听大量文件描述符，内核只在某个描述符就绪（可读/可写）时才通知进程，从而避免为每个连接都创建线程。它把「谁就绪」的查询交给内核批量完成，是高并发网络服务的核心手段。",
    difficulty: "medium", tags: ["I/O模型", "多路复用"], sourceKey: "linux-kernel", level: "进阶" }),
  judgeQuestion({ key: "operating-systems-sup-os-io-model-j1", stageKey: "os-io-fs-stage", topicKey: "os-io-model",
    stem: "异步 I/O（AIO）中，应用程序发起读请求后立刻返回去做别的事，当内核真正把数据准备好并拷贝到用户缓冲区后，再通过回调或信号通知应用，整个过程应用线程无需阻塞等待。",
    answer: true,
    explanation: "异步 I/O 与同步 I/O 的本质区别在于：同步模型（含阻塞、非阻塞+轮询、多路复用）最终仍需应用主动等待或查询数据就绪并自行拷贝；而真正的异步 I/O 由内核完成等待与数据拷贝两阶段，完成后才通知应用，应用线程在等待期间完全不被阻塞，适合追求高吞吐与低延迟的场景。",
    difficulty: "hard", tags: ["I/O模型", "异步"], sourceKey: "linux-kernel", level: "综合" }),

  // ===== os-concurrency-stage =====
  singleQuestion({ key: "operating-systems-sup-os-concurrency-stage-s1", stageKey: "os-concurrency-stage", topicKey: "os-locks",
    stem: "关于并发与系统边界（并发执行、内核态/用户态边界）的认识，下列说法正确的是？",
    options: [
      "并发是指多个任务在重叠时间段内推进，可由多核真正并行或单核时间片切换实现，系统调用是跨越用户态与内核态边界的入口",
      "并发与并行完全无关，单核 CPU 在任何情况下都不可能表现出多个任务同时推进的效果",
      "系统调用只是普通的函数调用，不会切换特权级，也不会陷入内核执行",
      "用户态程序可以直接执行特权指令并随意修改页表基址，无需通过内核",
    ],
    answer: "A",
    explanation: "并发强调多个任务在时间段上重叠推进，既可以是多核上的真正并行，也可以是单核通过调度交替执行造成的「同时」假象。系统调用是用户程序请求内核服务的正式入口，执行时会通过软中断或专用指令切换到内核态、提升特权级，完成后返回用户态，这是操作系统保护自身的关键边界。",
    difficulty: "hard", tags: ["并发", "系统边界"], sourceKey: "rcore-tutorial", level: "综合" }),
  judgeQuestion({ key: "operating-systems-sup-os-concurrency-stage-j1", stageKey: "os-concurrency-stage", topicKey: "os-locks",
    stem: "在单核处理器上，由于任意时刻只有一个指令流在执行，因此根本不存在并发，只有拥有多核的机器才谈得上并发。",
    answer: false,
    explanation: "并发描述的是任务在时间上重叠推进的逻辑属性，并不要求物理并行。单核机器通过时间片轮转、中断抢占，让多个任务交替执行，从外部观察它们「同时」在进展，这就是并发；而并行是并发在硬件上的一种实现（多核同时执行）。因此单核同样有并发，只是没有真正并行。",
    difficulty: "hard", tags: ["并发", "并行"], sourceKey: "rcore-tutorial", level: "综合" }),

  // ===== os-locks =====
  singleQuestion({ key: "operating-systems-sup-os-locks-s1", stageKey: "os-concurrency-stage", topicKey: "os-locks",
    stem: "关于锁、原子操作与死锁，下列说法正确的是？",
    options: [
      "死锁产生的四个必要条件包括互斥、持有并等待、不可剥夺和循环等待，打破其中任一条件即可预防死锁",
      "原子操作可以用普通的几条赋值语句拼凑而成，不需要硬件提供不可分割的执行保证",
      "只要程序使用了锁，就一定会发生死锁，锁与死锁是必然绑定的关系",
      "自旋锁在获取不到锁时会主动让出 CPU 进入睡眠，因此不会浪费处理器时间",
    ],
    answer: "A",
    explanation: "死锁需同时满足四个条件：资源互斥使用、进程持有资源并等待其他资源、资源不可被强行剥夺、存在进程-资源循环等待链。只要破坏其中任意一个（例如用超时放弃、按顺序加锁、允许抢占）就能避免死锁。原子操作依赖硬件指令保证不可中断，自旋锁忙等而非睡眠。",
    difficulty: "hard", tags: ["锁", "死锁"], sourceKey: "xv6", level: "综合" }),
  judgeQuestion({ key: "operating-systems-sup-os-locks-j1", stageKey: "os-concurrency-stage", topicKey: "os-locks",
    stem: "比较并交换（CAS）是一种典型的原子操作，它通过硬件保证「读取-比较-写入」三步不可被其他处理器打断，因此常作为无锁（lock-free）数据结构的基础。",
    answer: true,
    explanation: "CAS 指令在单个原子步骤内完成：比较某内存位置当前值是否等于预期值，若是则写入新值并返回成功，否则不改变并返回失败。由于该过程由 CPU 以原子方式执行、中间不会被其他核插入，多个线程可无锁地竞争更新共享变量，是实现自旋锁和各种无锁队列的核心原语。",
    difficulty: "hard", tags: ["锁", "原子操作"], sourceKey: "xv6", level: "综合" }),

  // ===== os-syscall =====
  singleQuestion({ key: "operating-systems-sup-os-syscall-s1", stageKey: "os-concurrency-stage", topicKey: "os-syscall",
    stem: "关于系统调用与特权级，下列说法正确的是？",
    options: [
      "系统调用通过软中断或专用指令（如 syscall）从用户态陷入内核态，由内核在较高特权级下代为执行受保护操作",
      "用户程序可以直接在用户态执行内核特权指令来读写硬件寄存器，无需任何切换",
      "系统调用的开销极低，与一次普通函数调用完全相同，没有任何额外代价",
      "特权级只有用户态一种，内核与应用程序运行在同一特权层次上，因此不区分操作权限",
    ],
    answer: "A",
    explanation: "现代 CPU 用特权级（如 x86 的 ring）区分内核态与用户态。用户程序不能直接执行特权指令，必须通过系统调用接口，借助软中断或 syscall 指令触发异常陷入内核，CPU 切换到高特权级后由内核代其完成设备管理、内存分配等敏感操作，结束后返回用户态。",
    difficulty: "medium", tags: ["系统调用", "特权级"], sourceKey: "rcore-tutorial", level: "进阶" }),
  judgeQuestion({ key: "operating-systems-sup-os-syscall-j1", stageKey: "os-concurrency-stage", topicKey: "os-syscall",
    stem: "系统调用相比同一进程内的普通函数调用需要额外的特权级切换和参数校验，因此通常开销更大，频繁的系统调用会成为性能瓶颈。",
    answer: true,
    explanation: "普通函数调用只在同一特权级内跳转并直接访问栈上参数，而系统调用要先从用户态陷入内核态，内核需保存上下文、校验用户传入指针的合法性与可访问性，再执行服务并恢复现场返回。这些跨特权边界与安全检查带来可观开销，故高频小数据操作应尽量减少系统调用次数或批量处理。",
    difficulty: "medium", tags: ["系统调用", "开销"], sourceKey: "rcore-tutorial", level: "进阶" }),

  // ===== os-boot-container =====
  singleQuestion({ key: "operating-systems-sup-os-boot-container-s1", stageKey: "os-concurrency-stage", topicKey: "os-boot-container",
    stem: "关于操作系统启动流程与容器进程隔离，下列说法正确的是？",
    options: [
      "容器共享宿主机内核，通过命名空间（namespace）和控制组（cgroup）实现进程、网络与资源的隔离与限制，而非运行独立内核",
      "容器必须像虚拟机一样启动一份完整独立的客户机操作系统内核，因此隔离性与虚拟机完全相同",
      "启动流程中 PID 1 是用户空间第一个进程，但它与后续所有服务的启动顺序毫无关系",
      "cgroup 的作用是给每个容器分配独立的物理 CPU 和独立的内核，使其完全不受宿主机其他进程影响",
    ],
    answer: "A",
    explanation: "容器建立在宿主机内核之上，利用 namespace 提供 PID、网络、挂载点等视图隔离，用 cgroup 限制 CPU、内存等资源用量，所有容器进程都运行在同一内核中。这与虚拟机各自运行独立客户内核有本质区别，因此容器更轻量但隔离边界弱于虚拟机。",
    difficulty: "hard", tags: ["启动", "容器"], sourceKey: "rcore-tutorial", level: "综合" }),
  judgeQuestion({ key: "operating-systems-sup-os-boot-container-j1", stageKey: "os-concurrency-stage", topicKey: "os-boot-container",
    stem: "在 Linux 启动流程中，内核完成自身初始化后会启动用户空间的第一个进程（通常是 init/systemd，即 PID 1），由它负责拉起后续的系统服务与登录环境。",
    answer: true,
    explanation: "内核引导并解压后进入初始化阶段，挂载根文件系统并创建 PID 1 进程（传统为 init，现代多为 systemd）。PID 1 是所有用户态进程的祖先，负责按依赖顺序启动守护进程、挂载点与登录服务，并在子进程退出时进行回收，是用户空间初始化的总入口。",
    difficulty: "hard", tags: ["启动", "PID1"], sourceKey: "linux-kernel", level: "综合" }),
];
