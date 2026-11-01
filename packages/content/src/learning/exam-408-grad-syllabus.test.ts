import { describe, expect, it } from "vitest";

import { learningTracks } from "./index";

/**
 * 408 讲义大纲覆盖审计（2026-11-01 对官方《计算机学科专业基础综合考试大纲》
 * 逐细目比对后的防回归护栏）。每条 = 大纲细目 → 讲义正文里必须出现的关键词。
 * 修内容时若重组措辞导致关键词失配，请同步更新本清单（改关键词，不是删条目）。
 */
const SYLLABUS_COVERAGE: Array<{ topic: string; pattern: RegExp }> = [
  // 数据结构
  { topic: "ex408g-ds-sort", pattern: /堆排序|大根堆|筛选/ },
  { topic: "ex408g-ds-sort", pattern: /基数排序|最低位|LSD/ },
  { topic: "ex408g-ds-sort", pattern: /折半插入|希尔/ },
  { topic: "ex408g-ds-sort", pattern: /外部排序|置换选择/ },
  { topic: "ex408g-ds-tree", pattern: /并查集/ },
  { topic: "ex408g-ds-tree", pattern: /平衡二叉树|AVL/ },
  { topic: "ex408g-ds-tree", pattern: /哈夫曼/ },
  { topic: "ex408g-ds-search", pattern: /B树|B-树|B\+树/ },
  { topic: "ex408g-ds-search", pattern: /散列|哈希/ },
  { topic: "ex408g-ds-graph", pattern: /最短路径|Dijkstra|Floyd/ },
  { topic: "ex408g-ds-graph", pattern: /深度优先|广度优先/ },
  { topic: "ex408g-ds-graph", pattern: /邻接多重表|十字链表/ },
  { topic: "ex408g-ds-strings", pattern: /KMP/ },
  // 计算机组成原理
  { topic: "ex408g-co-representation", pattern: /校验码|海明/ },
  { topic: "ex408g-co-representation", pattern: /浮点数|IEEE/ },
  { topic: "ex408g-co-storage", pattern: /RAID|磁盘阵列/ },
  { topic: "ex408g-co-storage", pattern: /虚拟存储器|虚拟内存/ },
  { topic: "ex408g-co-cpu", pattern: /指令流水线|冒险/ },
  { topic: "ex408g-co-cpu", pattern: /异常|中断/ },
  { topic: "ex408g-co-bus", pattern: /DMA|程序查询/ },
  { topic: "ex408g-co-instruction", pattern: /寻址|大小端/ },
  // 操作系统
  { topic: "ex408g-os-process", pattern: /用户级线程|多线程模型/ },
  { topic: "ex408g-os-process", pattern: /银行家算法|死锁避免/ },
  { topic: "ex408g-os-process", pattern: /多处理机调度|负载均衡/ },
  { topic: "ex408g-os-memory", pattern: /交换|覆盖/ },
  { topic: "ex408g-os-memory", pattern: /页置换|LRU|时钟/ },
  { topic: "ex408g-os-files", pattern: /索引节点|inode|文件的物理结构/ },
  { topic: "ex408g-os-io_device", pattern: /SPOOLing|缓冲/ },
  { topic: "ex408g-os-io_device", pattern: /磁盘调度|SCAN|电梯/ },
  // 计算机网络
  { topic: "ex408g-net-datalink", pattern: /VLAN|802\.1Q/ },
  { topic: "ex408g-net-datalink", pattern: /CRC|生成多项式/ },
  { topic: "ex408g-net-datalink", pattern: /PPP/ },
  { topic: "ex408g-net-datalink", pattern: /CSMA/ },
  { topic: "ex408g-net-network", pattern: /IPv6/ },
  { topic: "ex408g-net-network", pattern: /NAT|地址转换/ },
  { topic: "ex408g-net-network", pattern: /RIP|OSPF|BGP/ },
  { topic: "ex408g-net-network", pattern: /ARP|DHCP|ICMP/ },
  { topic: "ex408g-net-transport", pattern: /拥塞控制|慢开始/ },
  { topic: "ex408g-net-transport", pattern: /三次握手|四次挥手/ },
  { topic: "ex408g-net-transport", pattern: /滑动窗口/ },
  { topic: "ex408g-net-application", pattern: /DNS|域名/ },
  { topic: "ex408g-net-application", pattern: /HTTP|万维网/ },
  { topic: "ex408g-net-application", pattern: /FTP|电子邮件/ },
];

describe("ex-408-grad 讲义对 408 考试大纲的覆盖（防回归）", () => {
  const track = learningTracks.find((item) => item.slug === "ex-408-grad");
  const chapters = new Map<string, string>();
  for (const stage of track?.stages ?? []) {
    for (const topic of stage.topics) {
      const lesson = topic.lesson;
      const texts = [
        topic.summary ?? "",
        ...(topic.concepts ?? []),
        ...(lesson?.overview ?? []),
        ...(lesson?.mechanism ?? []),
      ];
      chapters.set(topic.key, texts.join("\n"));
    }
  }

  it.each(SYLLABUS_COVERAGE)("$topic 覆盖 $pattern", ({ topic, pattern }) => {
    const text = chapters.get(topic);
    expect(text, `讲义缺少章节 ${topic}`).toBeTruthy();
    expect(text, `章节 ${topic} 未覆盖大纲细目 ${pattern}`).toMatch(pattern);
  });
});
