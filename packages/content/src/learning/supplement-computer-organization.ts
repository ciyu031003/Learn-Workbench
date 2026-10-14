import type { LearningDifficulty, LearningQuestion, LearningLevel } from "./types";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function singleQuestion(input: {
  key: string;
  stageKey: string;
  topicKey: string;
  stem: string;
  options: [string, string, string, string];
  answer: "A" | "B" | "C" | "D";
  explanation: string;
  difficulty: LearningDifficulty;
  tags: string[];
  sourceKey: string;
  level: LearningLevel;
}): LearningQuestion {
  return {
    key: input.key,
    stageKey: input.stageKey,
    topicKey: input.topicKey,
    type: "single",
    stem: input.stem,
    options: input.options.map((t, i) => ({ key: OPTION_KEYS[i], text: t })),
    answer: [input.answer],
    explanation: input.explanation,
    difficulty: input.difficulty,
    tags: input.tags,
    sourceKey: input.sourceKey,
    level: input.level,
  };
}

function judgeQuestion(input: {
  key: string;
  stageKey: string;
  topicKey: string;
  stem: string;
  answer: boolean;
  explanation: string;
  difficulty: LearningDifficulty;
  tags: string[];
  sourceKey: string;
  level: LearningLevel;
}): LearningQuestion {
  return {
    key: input.key,
    stageKey: input.stageKey,
    topicKey: input.topicKey,
    type: "judge",
    stem: input.stem,
    options: [
      { key: "A", text: "正确" },
      { key: "B", text: "错误" },
    ],
    answer: [input.answer ? "A" : "B"],
    explanation: input.explanation,
    difficulty: input.difficulty,
    tags: input.tags,
    sourceKey: input.sourceKey,
    level: input.level,
  };
}

export const computerorganizationSupplementQuestions: LearningQuestion[] = [
  // ===== co-boolean 布尔代数与逻辑门 =====
  singleQuestion({
    key: "computer-organization-sup-co-boolean-s1",
    stageKey: "co-digital-stage",
    topicKey: "co-boolean",
    stem: "根据德摩根定律，逻辑表达式 NOT(A AND B) 等价于下列哪一个？",
    options: [
      "NOT A AND NOT B",
      "NOT A OR NOT B",
      "(NOT A) AND B",
      "A OR NOT B",
    ],
    answer: "B",
    explanation:
      "德摩根定律指出：与非等价于先非后或，即 NOT(A AND B) = NOT A OR NOT B；同理 NOT(A OR B) = NOT A AND NOT B。这是化简与门级电路、将电路全部转换为与非/或非实现的重要工具。",
    difficulty: "easy",
    tags: ["布尔代数", "德摩根"],
    sourceKey: "nand2tetris",
    level: "入门",
  }),
  judgeQuestion({
    key: "computer-organization-sup-co-boolean-j1",
    stageKey: "co-digital-stage",
    topicKey: "co-boolean",
    stem: "仅使用与非门（NAND）就可以实现任意布尔函数，即与非门是 functionally complete 的。",
    answer: true,
    explanation:
      "与非门是完备逻辑门：由它可分别构造 NOT（NAND 输入相连）、AND（与非后再非）、OR（先非再与非），进而构造任意组合逻辑。因此只用 NAND 即可搭建出全部数字电路，这是 Nand2Tetris 课程从与非门起步构建计算机的理论基础。",
    difficulty: "easy",
    tags: ["逻辑门", "完备性"],
    sourceKey: "nand2tetris",
    level: "入门",
  }),

  // ===== co-combinational 组合逻辑与时序逻辑 =====
  singleQuestion({
    key: "computer-organization-sup-co-combinational-s1",
    stageKey: "co-digital-stage",
    topicKey: "co-combinational",
    stem: "下列关于组合逻辑电路的描述，哪一项是正确的？",
    options: [
      "输出不仅取决于当前输入，还与电路上一时刻的状态有关",
      "电路中一定包含触发器或锁存器等存储元件",
      "输出仅由当前输入决定，不含记忆元件，无时钟也能工作",
      "组合逻辑必须使用全局时钟信号才能进行计算",
    ],
    answer: "C",
    explanation:
      "组合逻辑电路没有记忆元件，任意时刻的输出仅由该时刻的输入唯一确定，与历史状态无关，因此不需要时钟；常见例子有加法器、多路选择器、译码器。而时序逻辑才包含触发器并依赖时钟与历史状态。",
    difficulty: "easy",
    tags: ["组合逻辑", "时序逻辑"],
    sourceKey: "digital-sim",
    level: "入门",
  }),
  judgeQuestion({
    key: "computer-organization-sup-co-combinational-j1",
    stageKey: "co-digital-stage",
    topicKey: "co-combinational",
    stem: "时序逻辑电路必定含有存储元件（如触发器），其输出同时依赖于当前输入和电路原有状态。",
    answer: true,
    explanation:
      "时序逻辑与组合逻辑的根本区别在于具有记忆能力：它内部保存状态（通常由触发器、锁存器或寄存器构成），输出是当前输入 + 原有状态的函数，并随时钟节拍演化，例如计数器、有限状态机都属于时序逻辑。",
    difficulty: "easy",
    tags: ["时序逻辑", "存储元件"],
    sourceKey: "digital-sim",
    level: "入门",
  }),

  // ===== co-clock 时钟、触发器与状态机 =====
  singleQuestion({
    key: "computer-organization-sup-co-clock-s1",
    stageKey: "co-digital-stage",
    topicKey: "co-clock",
    stem: "对于一个上升沿触发的 D 触发器，其输出 Q 在何时更新为输入 D 的值？",
    options: [
      "在时钟信号为低电平的整个期间持续跟随 D",
      "仅在时钟由低到高的上升沿瞬间采样 D 并锁存",
      "在时钟信号为高电平的整个期间持续跟随 D",
      "在时钟由高到低的下降沿才更新",
    ],
    answer: "B",
    explanation:
      "边沿触发 D 触发器只在时钟的有效边沿（此处为上升沿）对 D 采样一次，并把该值锁存到 Q，其余时间 Q 保持不变。这保证了每个时钟周期只在边沿更新一次状态，是同步时序系统稳定工作的基础。",
    difficulty: "medium",
    tags: ["触发器", "时钟边沿"],
    sourceKey: "nand2tetris",
    level: "进阶",
  }),
  judgeQuestion({
    key: "computer-organization-sup-co-clock-j1",
    stageKey: "co-digital-stage",
    topicKey: "co-clock",
    stem: "异步清零（异步复位）信号可以在任意时刻立即生效，无需等待时钟边沿的到来。",
    answer: true,
    explanation:
      "异步复位不依赖时钟：只要异步清零信号有效，触发器立即被强制置为确定状态（如 0），常用于上电初始化或紧急停机；与之相对，同步复位只在时钟有效边沿才生效。异步信号需注意毛刺和亚稳态问题。",
    difficulty: "medium",
    tags: ["异步复位", "触发器"],
    sourceKey: "nand2tetris",
    level: "进阶",
  }),

  // ===== co-datapath-stage 数据通路与指令集 =====
  singleQuestion({
    key: "computer-organization-sup-co-datapath-stage-s1",
    stageKey: "co-datapath-stage", topicKey: "co-isa",
    stem: "在经典处理器的五级数据通路中，取指（Fetch）阶段通常完成下列哪组操作？",
    options: [
      "根据寄存器内容计算内存地址并写入结果",
      "从程序计数器 PC 所指内存读取指令，并将 PC 更新为下一条指令地址",
      "对两个寄存器操作数执行 ALU 运算",
      "将结果写回目的寄存器文件",
    ],
    answer: "B",
    explanation:
      "取指阶段由指令存储器按 PC 读出当前指令，同时 PC 自增（或加上偏移）指向下一条指令，使指令流能连续执行；后续的译码、执行、访存、写回阶段才分别处理读取寄存器、ALU 运算、内存访问与结果回写。",
    difficulty: "medium",
    tags: ["数据通路", "取指"],
    sourceKey: "riscv-isa-manual",
    level: "进阶",
  }),
  judgeQuestion({
    key: "computer-organization-sup-co-datapath-stage-j1",
    stageKey: "co-datapath-stage", topicKey: "co-isa",
    stem: "寄存器堆（register file）是用于暂存 CPU 运算中间结果、可被指令直接读写的少量高速存储单元。",
    answer: true,
    explanation:
      "寄存器堆是数据通路的核心存储部件，提供一组编址的通用寄存器，ALU 的源操作数与运算结果都通过它传递，访问速度远快于主存；指令集中的寄存器寻址正是直接指定寄存器堆中的编号来读写数据。",
    difficulty: "easy",
    tags: ["寄存器堆", "数据通路"],
    sourceKey: "riscv-isa-manual",
    level: "入门",
  }),

  // ===== co-isa 指令集与寻址方式 =====
  singleQuestion({
    key: "computer-organization-sup-co-isa-s1",
    stageKey: "co-datapath-stage", topicKey: "co-isa",
    stem: "在 RISC-V 中，指令 lw x5, 8(x6) 采用的寻址方式是下列哪一种？",
    options: [
      "立即数寻址：操作数就编码在指令中的常数",
      "寄存器寻址：操作数全部来自通用寄存器",
      "基址（偏移）寻址：有效地址 = 寄存器值 + 指令中的偏移量",
      "PC 相对寻址：地址由 PC 加上偏移得到",
    ],
    answer: "C",
    explanation:
      "Load/Store 指令使用基址加偏移寻址：先将基址寄存器 x6 的值与符号扩展后的 12 位立即数 8 相加形成有效内存地址，再读出该单元写入 x5。这种寻址方式便于访问结构体字段与数组元素。",
    difficulty: "medium",
    tags: ["寻址方式", "RISC-V"],
    sourceKey: "riscv-isa-manual",
    level: "进阶",
  }),
  judgeQuestion({
    key: "computer-organization-sup-co-isa-j1",
    stageKey: "co-datapath-stage", topicKey: "co-isa",
    stem: "RISC-V 属于 Load/Store 架构：算术逻辑指令的源操作数只能是寄存器，只有专门的 Load/Store 指令才能在寄存器和内存之间搬运数据。",
    answer: true,
    explanation:
      "Load/Store 架构要求所有运算都在寄存器间进行，内存访问被限制为独立的 load/store 指令；这与允许内存操作数的 CISC 风格不同，能简化数据通路、统一指令格式，是 RISC 设计提升流水效率的关键原则。",
    difficulty: "medium",
    tags: ["指令集", "Load/Store"],
    sourceKey: "riscv-isa-manual",
    level: "进阶",
  }),

  // ===== co-datapath 数据通路设计 =====
  singleQuestion({
    key: "computer-organization-sup-co-datapath-s1",
    stageKey: "co-datapath-stage", topicKey: "co-datapath",
    stem: "关于单周期（single-cycle）数据通路，下列哪项描述是正确的？",
    options: [
      "每条指令需要多个时钟周期才能完成",
      "所有指令都在一个时钟周期内完成，时钟周期长度须按最慢指令设定",
      "不同指令的执行阶段在时间上重叠以提速",
      "必须借助流水线寄存器才能正确工作",
    ],
    answer: "B",
    explanation:
      "单周期数据通路让每条指令都在一个时钟周期内走完整条路径，因此时钟周期必须足够长以容纳最慢指令（如访存），短指令也占满整个周期，硬件利用率低但控制简单。多周期与流水线才进一步拆分或重叠执行。",
    difficulty: "medium",
    tags: ["单周期", "数据通路"],
    sourceKey: "riscv-isa-manual",
    level: "进阶",
  }),
  judgeQuestion({
    key: "computer-organization-sup-co-datapath-j1",
    stageKey: "co-datapath-stage", topicKey: "co-datapath",
    stem: "多周期数据通路通过多个时钟周期执行一条指令，可以复用同一份功能部件，从而减少硬件重复。",
    answer: true,
    explanation:
      "多周期设计把指令执行拆成若干步骤，每步用一个时钟周期驱动同一组共享部件（如 ALU、寄存器堆），避免了单周期中每种指令各建一套数据通路的浪费；代价是指令总延迟变长，但硬件更节省。",
    difficulty: "medium",
    tags: ["多周期", "硬件复用"],
    sourceKey: "riscv-isa-manual",
    level: "进阶",
  }),

  // ===== co-control 控制器：硬布线与微程序 =====
  singleQuestion({
    key: "computer-organization-sup-co-control-s1",
    stageKey: "co-datapath-stage", topicKey: "co-control",
    stem: "微程序控制器（microprogrammed control）的核心思想是下列哪一项？",
    options: [
      "用组合逻辑门直接由指令操作码生成全部控制信号",
      "把控制信号序列存储在控制存储器中，以微指令序列解释执行每条机器指令",
      "完全依靠软件解释器逐条翻译指令，不使用任何硬件控制",
      "用 FPGA 动态重配置数据通路来适配每条指令",
    ],
    answer: "B",
    explanation:
      "微程序控制器把每条机器指令的实现分解为若干微指令，微指令存放在控制存储器（控存）里，执行时按顺序取出产生各级控制信号。其优点是规整、易修改与扩展，缺点是多一次取微指令的存储访问，速度通常慢于硬布线。",
    difficulty: "medium",
    tags: ["微程序", "控制器"],
    sourceKey: "nand2tetris",
    level: "进阶",
  }),
  judgeQuestion({
    key: "computer-organization-sup-co-control-j1",
    stageKey: "co-datapath-stage", topicKey: "co-control",
    stem: "硬布线控制器执行速度快、但设计复杂且不易修改；微程序控制器更灵活、易于扩展，但速度相对较慢。",
    answer: true,
    explanation:
      "硬布线控制器用门电路直接由指令字段组合出控制信号，延迟小、适合高速场景，但逻辑一旦定型便难以更改；微程序控制器将控制逻辑软件化存入控存，修改指令集只需改微程序，灵活性高却因多一次控存取指而较慢。",
    difficulty: "medium",
    tags: ["硬布线", "微程序"],
    sourceKey: "nand2tetris",
    level: "进阶",
  }),

  // ===== co-pipeline-stage 流水线与性能 =====
  singleQuestion({
    key: "computer-organization-sup-co-pipeline-stage-s1",
    stageKey: "co-pipeline-stage", topicKey: "co-pipeline-basics",
    stem: "若一条指令在无流水线时执行需 5 个时间单位，在理想 k 段流水线下吞吐率最高可提升约多少倍？",
    options: [
      "几乎不变，仅提升约 1 倍",
      "约提升 k 倍（本例 5 段约 5 倍）",
      "提升倍数等于指令总数",
      "提升倍数与段数无关，只取决于时钟频率",
    ],
    answer: "B",
    explanation:
      "理想流水线中，首条指令仍需 k 个周期，之后每个周期产出一条结果，因此长指令流的吞吐率约为非流水线的 k 倍（本例 5 段约 5 倍）。注意这是吞吐率而非单条指令延迟的提升，实际会因冒险与不平衡而低于理想值。",
    difficulty: "hard",
    tags: ["流水线", "吞吐率"],
    sourceKey: "riscv-isa-manual",
    level: "综合",
  }),
  judgeQuestion({
    key: "computer-organization-sup-co-pipeline-stage-j1",
    stageKey: "co-pipeline-stage", topicKey: "co-pipeline-basics",
    stem: "采用流水线后，只要不断提高时钟频率，单条指令的执行延迟（latency）就一定会同比下降。",
    answer: false,
    explanation:
      "流水线提升的是吞吐率（单位时间完成的指令数），而非单条指令的延迟；一条指令仍要经过全部流水段，其延迟约等于段数乘段时长。提高时钟频率虽能缩短段时长，但受限于最慢段、冒险停顿与布线延迟，单条延迟并非线性下降。",
    difficulty: "hard",
    tags: ["流水延迟", "吞吐率"],
    sourceKey: "riscv-isa-manual",
    level: "综合",
  }),

  // ===== co-pipeline-basics 流水线原理 =====
  singleQuestion({
    key: "computer-organization-sup-co-pipeline-basics-s1",
    stageKey: "co-pipeline-stage", topicKey: "co-pipeline-basics",
    stem: "流水线技术能够提升性能的根本原因是下列哪一项？",
    options: [
      "让同一条指令的不同阶段被强制串行执行",
      "把指令执行划分为多个阶段，使不同指令的不同阶段在时间上重叠并行",
      "减少了程序的指令总数",
      "用软件缓冲替代了硬件寄存器",
    ],
    answer: "B",
    explanation:
      "流水线把一条指令的执行拆分为取指、译码、执行、访存、写回等多个子阶段，各阶段由独立的流水段硬件承担，不同指令的不同阶段在时间轴上重叠推进，从而在相同时间内完成更多指令，本质是任务级并行。",
    difficulty: "easy",
    tags: ["流水线原理", "并行"],
    sourceKey: "riscv-isa-manual",
    level: "入门",
  }),
  judgeQuestion({
    key: "computer-organization-sup-co-pipeline-basics-j1",
    stageKey: "co-pipeline-stage", topicKey: "co-pipeline-basics",
    stem: "流水线各段的处理时间应尽量均衡；若存在某段明显更慢，则该段会成为整条流水线的吞吐瓶颈。",
    answer: true,
    explanation:
      "流水线的节拍由最慢的一段决定（木桶短板效应）：每段时间等于最长段耗时，因此非均衡的段会造成其他段空等。设计时常把工作尽量均匀分配到各段，或使用更细的分段来平衡，以提升整体吞吐率。",
    difficulty: "medium",
    tags: ["流水平衡", "瓶颈"],
    sourceKey: "riscv-isa-manual",
    level: "进阶",
  }),

  // ===== co-hazards 冒险与解决手段 =====
  singleQuestion({
    key: "computer-organization-sup-co-hazards-s1",
    stageKey: "co-pipeline-stage", topicKey: "co-hazards",
    stem: "下列解决数据冒险（data hazard）的技术中，哪一项是把 ALU 的计算结果直接旁路给后续指令使用？",
    options: [
      "流水线停顿（stall / bubble），插入空周期等待数据就绪",
      "前向转发（forwarding / bypassing），将结果直接从产生处送往需要的段",
      "乱序执行（out-of-order），重排指令避开依赖",
      "分支预测，提前猜测分支走向",
    ],
    answer: "B",
    explanation:
      "数据冒险指后一条指令需要使用前一条尚未写回的结果。前向转发（旁路）不等待结果写回寄存器，而是把 ALU 输出或访存结果经专用通路直接送到后续指令的运算输入端，从而消除大部分停顿，是高效流水线的标准优化。",
    difficulty: "hard",
    tags: ["数据冒险", "旁路"],
    sourceKey: "riscv-isa-manual",
    level: "综合",
  }),
  judgeQuestion({
    key: "computer-organization-sup-co-hazards-j1",
    stageKey: "co-pipeline-stage", topicKey: "co-hazards",
    stem: "结构冒险（structural hazard）源于硬件资源冲突，例如单端口存储器同时被取指和访存阶段争用；可通过增加硬件资源或插入流水线停顿来缓解。",
    answer: true,
    explanation:
      "当多条并行指令需要同一硬件资源（如唯一的存储器或总线）且无法同时服务时，便发生结构冒险。解决办法包括提供分离的对指/数据存储器、多端口或流水停顿（stall）让某阶段等待资源空闲，从而保证功能正确。",
    difficulty: "medium",
    tags: ["结构冒险", "资源冲突"],
    sourceKey: "riscv-isa-manual",
    level: "进阶",
  }),

  // ===== co-performance CPU 性能指标与评测 =====
  singleQuestion({
    key: "computer-organization-sup-co-performance-s1",
    stageKey: "co-pipeline-stage", topicKey: "co-performance",
    stem: "CPU 执行一段程序的总时间可用下列哪个公式表示？",
    options: [
      "CPU 时间 = 指令数 × CPI × 时钟周期时间",
      "CPU 时间 = 主频 ÷ (指令数 × CPI)",
      "CPU 时间 = 缓存命中率 × 主频",
      "CPU 时间 = 指令数 ÷ 时钟周期时间",
    ],
    answer: "A",
    explanation:
      "经典性能公式将程序执行时间拆为三因子的乘积：指令数（IC）、平均每条指令时钟数（CPI）和时钟周期时间（1/主频）。优化可从任一因子入手——减少指令数、降低 CPI 或缩短时钟周期，三者常相互制约需综合权衡。",
    difficulty: "hard",
    tags: ["性能指标", "CPU时间"],
    sourceKey: "ossu-cs",
    level: "综合",
  }),
  judgeQuestion({
    key: "computer-organization-sup-co-performance-j1",
    stageKey: "co-pipeline-stage", topicKey: "co-performance",
    stem: "仅凭 MIPS（每秒百万条指令）数值越高，就一定能说明该程序的实际运行性能越好。",
    answer: false,
    explanation:
      "MIPS 只反映指令吞吐速率，却掩盖了不同指令集每条指令完成的工作量差异与 CPI 变化；对完成同样任务，RISC 可能用更多指令但每条更快。衡量真实性能应看执行时间，常用 MIPS、MFLOPS 需结合基准与指令构成谨慎比较。",
    difficulty: "hard",
    tags: ["MIPS", "性能评测"],
    sourceKey: "ossu-cs",
    level: "综合",
  }),

  // ===== co-memory-io-stage 存储层次与 I/O =====
  singleQuestion({
    key: "computer-organization-sup-co-memory-io-stage-s1",
    stageKey: "co-memory-io-stage", topicKey: "co-cache",
    stem: "存储层次（memory hierarchy）设计的根本依据是下列哪一项？",
    options: [
      "制造工艺越先进，存储器容量越大越好",
      "程序的局部性原理（时间局部性与空间局部性）",
      "CPU 主频必须高于内存频率",
      "所有数据都应放在最快的存储器中",
    ],
    answer: "B",
    explanation:
      "局部性原理指出程序倾向重复访问近期用过的单元（时间局部性）及邻近单元（空间局部性）。据此把最常用数据放在靠近 CPU、更快更小的存储器，不常用数据下沉到慢而大的存储器，从而在成本可控下获得接近最快存储的速度。",
    difficulty: "medium",
    tags: ["存储层次", "局部性"],
    sourceKey: "ossu-cs",
    level: "进阶",
  }),
  judgeQuestion({
    key: "computer-organization-sup-co-memory-io-stage-j1",
    stageKey: "co-memory-io-stage", topicKey: "co-cache",
    stem: "Cache、主存、辅存构成典型的存储层次，越靠近 CPU 的层级容量越小、速度越快、单位成本越高。",
    answer: true,
    explanation:
      "存储层次呈金字塔结构：寄存器/Cache 最快最小最贵，主存居中，磁盘等辅存最慢最大最便宜。系统自动把热点数据向上层迁移，使整体表现接近顶层速度而成本接近底层，是平衡速度、容量与价格的核心方案。",
    difficulty: "easy",
    tags: ["存储层次", "Cache"],
    sourceKey: "ossu-cs",
    level: "入门",
  }),

  // ===== co-cache 缓存与局部性 =====
  singleQuestion({
    key: "computer-organization-sup-co-cache-s1",
    stageKey: "co-memory-io-stage", topicKey: "co-cache",
    stem: "在直接映射（direct-mapped）Cache 中，主存块与 Cache 行之间的对应关系是下列哪一种？",
    options: [
      "任意一个主存块可放入任意一个 Cache 行",
      "每个主存块只能映射到唯一确定的 Cache 行",
      "主存块只能在两个固定 Cache 行之间选择",
      "映射关系由程序员手动指定，硬件不参与",
    ],
    answer: "B",
    explanation:
      "直接映射用主存块号 mod Cache 行数确定唯一落点，硬件实现最简单、查找最快，但不同主存块若映射到同一行便会互相替换，容易产生冲突缺失。组相联与全相联则通过增加可选行来降低此类冲突。",
    difficulty: "medium",
    tags: ["Cache映射", "直接映射"],
    sourceKey: "ossu-cs",
    level: "进阶",
  }),
  judgeQuestion({
    key: "computer-organization-sup-co-cache-j1",
    stageKey: "co-memory-io-stage", topicKey: "co-cache",
    stem: "当程序轮流访问多个被映射到同一 Cache 组（或行）的不同内存块时，会频繁互相替换，产生冲突缺失（thrashing）。",
    answer: true,
    explanation:
      "冲突缺失发生在多个主存块竞争同一 Cache 位置的情形：直接映射下它们因模运算落点相同，刚装入就被下一访问挤出，命中率骤降形成颠簸。增大相联度（如组相联）或提高 Cache 容量可缓解此类缺失。",
    difficulty: "hard",
    tags: ["冲突缺失", "Cache颠簸"],
    sourceKey: "ossu-cs",
    level: "综合",
  }),

  // ===== co-memory-hierarchy 主存与存储层次 =====
  singleQuestion({
    key: "computer-organization-sup-co-memory-hierarchy-s1",
    stageKey: "co-memory-io-stage", topicKey: "co-memory-hierarchy",
    stem: "下列关于 DRAM 与 SRAM 的描述，哪一项是正确的？",
    options: [
      "SRAM 需要定期刷新，断电后数据易失但容量大",
      "DRAM 靠电容存电荷，需定期刷新，密度高、速度较慢、单位成本低",
      "SRAM 比 DRAM 慢但比其便宜，多用于主存",
      "DRAM 不需刷新且速度比 SRAM 快，常用于 Cache",
    ],
    answer: "B",
    explanation:
      "DRAM 以电容电荷表示比特，电荷会漏电故需周期性刷新，集成度高、成本低，是主存的主要技术；SRAM 用触发器存储，无需刷新、速度快但面积大、价格高，多用于 Cache 与寄存器。二者均易失，掉电即丢数据。",
    difficulty: "medium",
    tags: ["DRAM", "SRAM"],
    sourceKey: "ossu-cs",
    level: "进阶",
  }),
  judgeQuestion({
    key: "computer-organization-sup-co-memory-hierarchy-j1",
    stageKey: "co-memory-io-stage", topicKey: "co-memory-hierarchy",
    stem: "虚拟内存借助页表把程序使用的虚拟地址映射到物理地址，并可用磁盘扩展主存容量，使程序仿佛拥有连续而巨大的地址空间。",
    answer: true,
    explanation:
      "虚拟内存由 MMU 与页表实现地址翻译，把进程看到的连续虚拟地址分散映射到物理页，缺失时再从磁盘换入（缺页）；它既扩展了可用内存，又隔离了进程地址空间、便于保护，是现代操作系统内存管理的基石。",
    difficulty: "hard",
    tags: ["虚拟内存", "页表"],
    sourceKey: "ossu-cs",
    level: "综合",
  }),

  // ===== co-bus-io 总线、中断与 I/O 组织 =====
  singleQuestion({
    key: "computer-organization-sup-co-bus-io-s1",
    stageKey: "co-memory-io-stage", topicKey: "co-bus-io",
    stem: "当外部设备产生中断请求并被 CPU 响应后，CPU 通常通过下列哪一项找到对应的中断服务程序入口？",
    options: [
      "直接跳转到固定物理地址，与中断号无关",
      "查找中断向量表，由其给出中断服务程序的入口地址",
      "随机选择一个空闲内存地址开始执行",
      "由设备自行写入 PC，无需 CPU 参与",
    ],
    answer: "B",
    explanation:
      "中断向量表（或中断描述符表）按中断号存放各中断服务程序的入口地址（或段/偏移）。CPU 响应中断时，用中断号索引该表取得入口并跳转执行；处理完再执行中断返回恢复原现场，从而实现异步、高效的设备响应。",
    difficulty: "medium",
    tags: ["中断", "向量表"],
    sourceKey: "ossu-cs",
    level: "进阶",
  }),
  judgeQuestion({
    key: "computer-organization-sup-co-bus-io-j1",
    stageKey: "co-memory-io-stage", topicKey: "co-bus-io",
    stem: "DMA（直接存储器访问）允许外设与内存之间直接批量传输数据，过程中无需 CPU 逐字节参与搬运。",
    answer: true,
    explanation:
      "DMA 控制器在获得总线控制权后，直接在内存与外设间搬运大块数据，CPU 只需发起请求并在传输结束时收到中断，从而把处理器从繁琐的数据拷贝中解放出来，显著降低 I/O 开销、提升系统吞吐。",
    difficulty: "medium",
    tags: ["DMA", "I/O组织"],
    sourceKey: "ossu-cs",
    level: "进阶",
  }),
];
