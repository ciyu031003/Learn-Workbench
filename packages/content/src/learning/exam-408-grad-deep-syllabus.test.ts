import { describe, expect, it } from "vitest";

import { exam408DeepLessons } from "./exam-408-grad-deep";

/**
 * 408 讲义加深层的「大纲细目覆盖」防回归（2026-11）。
 *
 * 与 `exam-408-grad-syllabus.test.ts`（1.53 的 43 条骨架断言）分工不同：
 * 那份守的是「章级骨架别把大纲点丢了」，本份守的是**本次加深层正文**——
 * 25 章每一章都必须把大纲里高频细目真正写进正文，而不是只凑段落数。
 * 关键词按「教材术语」选，重组措辞时改关键词、不要删条目。
 */
const COVERAGE: Array<{ topic: string; pattern: RegExp; name: string }> = [
  // ---------- 数据结构 ----------
  { topic: "ex408g-ds-basic", name: "时间复杂度", pattern: /时间复杂度/ },
  { topic: "ex408g-ds-basic", name: "空间复杂度", pattern: /空间复杂度|原地/ },
  { topic: "ex408g-ds-basic", name: "渐进/大O", pattern: /渐进|大O|O\(/ },
  { topic: "ex408g-ds-linearlist", name: "双链表", pattern: /双链表|双向链表/ },
  { topic: "ex408g-ds-linearlist", name: "循环链表", pattern: /循环链表/ },
  { topic: "ex408g-ds-linearlist", name: "头结点", pattern: /头结点|头指针/ },
  { topic: "ex408g-ds-array", name: "循环队列", pattern: /循环队列|队满|队空/ },
  { topic: "ex408g-ds-array", name: "卡特兰/出栈序列", pattern: /卡特兰|出栈序列/ },
  { topic: "ex408g-ds-array", name: "特殊矩阵压缩", pattern: /压缩存储|对称矩阵|三角矩阵|稀疏矩阵/ },
  { topic: "ex408g-ds-strings", name: "KMP", pattern: /KMP/ },
  { topic: "ex408g-ds-strings", name: "next 数组", pattern: /next/ },
  { topic: "ex408g-ds-tree", name: "线索二叉树", pattern: /线索二叉树/ },
  { topic: "ex408g-ds-tree", name: "哈夫曼", pattern: /哈夫曼|Huffman/i },
  { topic: "ex408g-ds-tree", name: "并查集", pattern: /并查集/ },
  { topic: "ex408g-ds-search", name: "平衡二叉树", pattern: /平衡二叉树|AVL/ },
  { topic: "ex408g-ds-tree", name: "WPL", pattern: /WPL|带权路径/ },
  { topic: "ex408g-ds-graph", name: "Dijkstra", pattern: /Dijkstra/i },
  { topic: "ex408g-ds-graph", name: "Floyd", pattern: /Floyd/i },
  { topic: "ex408g-ds-graph", name: "Prim", pattern: /Prim/i },
  { topic: "ex408g-ds-graph", name: "Kruskal", pattern: /Kruskal/i },
  { topic: "ex408g-ds-graph", name: "拓扑排序", pattern: /拓扑排序/ },
  { topic: "ex408g-ds-graph", name: "关键路径", pattern: /关键路径/ },
  { topic: "ex408g-ds-graph", name: "十字链表/邻接多重表", pattern: /十字链表|邻接多重表/ },
  { topic: "ex408g-ds-search", name: "折半查找", pattern: /折半查找|二分查找/ },
  { topic: "ex408g-ds-search", name: "B树/B+树", pattern: /B\s*\+?\s*树/ },
  { topic: "ex408g-ds-search", name: "散列", pattern: /散列|哈希/ },
  { topic: "ex408g-ds-search", name: "ASL", pattern: /平均查找长度|ASL/ },
  { topic: "ex408g-ds-search", name: "红黑树", pattern: /红黑树/ },
  { topic: "ex408g-ds-sort", name: "堆排序", pattern: /堆排序|大根堆/ },
  { topic: "ex408g-ds-sort", name: "基数排序", pattern: /基数排序/ },
  { topic: "ex408g-ds-sort", name: "归并排序", pattern: /归并/ },
  { topic: "ex408g-ds-sort", name: "稳定性", pattern: /稳定性|稳定/ },
  { topic: "ex408g-ds-sort", name: "外部排序", pattern: /外部排序/ },
  { topic: "ex408g-ds-sort", name: "希尔排序", pattern: /希尔/ },

  // ---------- 计算机组成原理 ----------
  { topic: "ex408g-co-overview", name: "CPI", pattern: /CPI/ },
  { topic: "ex408g-co-overview", name: "MIPS", pattern: /MIPS|MFLOPS/ },
  { topic: "ex408g-co-overview", name: "存储程序", pattern: /存储程序/ },
  { topic: "ex408g-co-representation", name: "补码", pattern: /补码/ },
  { topic: "ex408g-co-representation", name: "IEEE754", pattern: /IEEE ?754|IEEE/i },
  { topic: "ex408g-co-representation", name: "原码/反码/移码", pattern: /原码|移码/ },
  { topic: "ex408g-co-representation", name: "标志位", pattern: /标志位|溢出|OF|CF/ },
  { topic: "ex408g-co-representation", name: "大小端", pattern: /大小端|大端|小端/ },
  { topic: "ex408g-co-instruction", name: "寻址方式", pattern: /寻址/ },
  { topic: "ex408g-co-instruction", name: "CISC/RISC", pattern: /CISC|RISC/ },
  { topic: "ex408g-co-instruction", name: "指令格式", pattern: /指令格式|操作码/ },
  { topic: "ex408g-co-cpu", name: "流水线", pattern: /流水线/ },
  { topic: "ex408g-co-cpu", name: "数据通路", pattern: /数据通路/ },
  { topic: "ex408g-co-cpu", name: "控制器", pattern: /微程序|控制器|控制信号/ },
  { topic: "ex408g-co-cpu", name: "异常/中断", pattern: /异常|中断/ },
  { topic: "ex408g-co-storage", name: "Cache", pattern: /Cache|缓存/ },
  { topic: "ex408g-co-storage", name: "映射方式", pattern: /直接映射|组相联|全相联/ },
  { topic: "ex408g-co-storage", name: "虚拟存储", pattern: /虚拟存储|虚拟内存|页表/ },
  { topic: "ex408g-co-storage", name: "TLB", pattern: /TLB|快表/ },
  { topic: "ex408g-co-storage", name: "RAID", pattern: /RAID/ },
  { topic: "ex408g-co-bus", name: "DMA", pattern: /DMA/ },
  { topic: "ex408g-co-bus", name: "程序查询/中断", pattern: /程序查询|程序中断/ },
  { topic: "ex408g-co-bus", name: "总线仲裁", pattern: /仲裁/ },
  { topic: "ex408g-co-bus", name: "中断向量", pattern: /中断向量|中断服务|中断处理/ },

  // ---------- 操作系统 ----------
  { topic: "ex408g-os-concepts", name: "系统调用", pattern: /系统调用/ },
  { topic: "ex408g-os-concepts", name: "内核态/用户态", pattern: /内核态|核心态|用户态/ },
  { topic: "ex408g-os-concepts", name: "中断/异常", pattern: /中断|异常/ },
  { topic: "ex408g-os-process", name: "信号量/PV", pattern: /信号量|PV|P 操作|P操作/ },
  { topic: "ex408g-os-process", name: "死锁", pattern: /死锁/ },
  { topic: "ex408g-os-process", name: "银行家算法", pattern: /银行家/ },
  { topic: "ex408g-os-process", name: "调度算法", pattern: /轮转|时间片|调度算法|多级反馈/ },
  { topic: "ex408g-os-memory", name: "页表", pattern: /页表/ },
  { topic: "ex408g-os-memory", name: "缺页", pattern: /缺页/ },
  { topic: "ex408g-os-memory", name: "页面置换", pattern: /LRU|置换/ },
  { topic: "ex408g-os-memory", name: "虚拟内存", pattern: /虚拟内存|虚拟存储/ },
  { topic: "ex408g-os-files", name: "inode", pattern: /索引结点|inode|索引节点/i },
  { topic: "ex408g-os-files", name: "目录", pattern: /目录/ },
  { topic: "ex408g-os-files", name: "文件分配/物理结构", pattern: /文件分配|物理结构|连续分配|链接分配|索引分配/ },
  { topic: "ex408g-os-io_device", name: "SPOOLing", pattern: /SPOOLing|假脱机/i },
  { topic: "ex408g-os-io_device", name: "缓冲", pattern: /缓冲/ },
  { topic: "ex408g-os-io_device", name: "磁盘调度", pattern: /磁盘调度|SCAN|电梯|最短寻道/ },

  // ---------- 计算机网络 ----------
  { topic: "ex408g-net-overall", name: "OSI", pattern: /OSI/ },
  { topic: "ex408g-net-overall", name: "TCP/IP", pattern: /TCP\/IP|体系结构/ },
  { topic: "ex408g-net-overall", name: "性能指标", pattern: /时延|带宽|吞吐量/ },
  { topic: "ex408g-net-physical", name: "奈氏准则", pattern: /奈氏|奈奎斯特/ },
  { topic: "ex408g-net-physical", name: "香农定理", pattern: /香农/ },
  { topic: "ex408g-net-physical", name: "编码调制", pattern: /编码|调制/ },
  { topic: "ex408g-net-physical", name: "信道复用", pattern: /复用|频分|时分/ },
  { topic: "ex408g-net-datalink", name: "CSMA", pattern: /CSMA/ },
  { topic: "ex408g-net-datalink", name: "CRC", pattern: /CRC|循环冗余/ },
  { topic: "ex408g-net-datalink", name: "滑动窗口", pattern: /滑动窗口/ },
  { topic: "ex408g-net-datalink", name: "VLAN", pattern: /VLAN|802\.1Q/ },
  { topic: "ex408g-net-datalink", name: "PPP", pattern: /PPP/ },
  { topic: "ex408g-net-network", name: "子网/CIDR", pattern: /子网|CIDR/ },
  { topic: "ex408g-net-network", name: "ARP", pattern: /ARP/ },
  { topic: "ex408g-net-network", name: "IP 分片", pattern: /分片|MTU/ },
  { topic: "ex408g-net-network", name: "路由协议", pattern: /RIP|OSPF|BGP/ },
  { topic: "ex408g-net-network", name: "NAT", pattern: /NAT|地址转换/ },
  { topic: "ex408g-net-network", name: "IPv6", pattern: /IPv6/ },
  { topic: "ex408g-net-transport", name: "三次握手", pattern: /三次握手/ },
  { topic: "ex408g-net-transport", name: "四次挥手", pattern: /四次挥手|挥手/ },
  { topic: "ex408g-net-transport", name: "拥塞控制", pattern: /拥塞控制|慢开始/ },
  { topic: "ex408g-net-transport", name: "UDP", pattern: /UDP/ },
  { topic: "ex408g-net-application", name: "DNS", pattern: /DNS/ },
  { topic: "ex408g-net-application", name: "HTTP", pattern: /HTTP/ },
  { topic: "ex408g-net-application", name: "FTP", pattern: /FTP/ },
  { topic: "ex408g-net-application", name: "电子邮件", pattern: /SMTP|电子邮件|邮件/ },
];

function deepText(topic: string): string {
  const deep = exam408DeepLessons[topic];
  if (!deep) return "";
  return [
    ...(deep.overview ?? []),
    ...(deep.mechanism ?? []),
    ...(deep.summary ?? []),
    ...(deep.pitfalls ?? []),
  ].join("\n");
}

describe("ex-408-grad 加深层对官方大纲细目的覆盖（防回归）", () => {
  it("25 章都有加深内容", () => {
    expect(Object.keys(exam408DeepLessons).length).toBe(25);
  });

  it.each(COVERAGE)("$topic 加深层覆盖 $name", ({ topic, pattern }) => {
    const text = deepText(topic);
    expect(text, `缺少章节 ${topic} 的加深内容`).toBeTruthy();
    expect(text, `章节 ${topic} 未覆盖大纲细目：${pattern}`).toMatch(pattern);
  });
});
