-- 068：计算机核心课程来源（计算机网络 / 操作系统 / 计算机组成原理）
--
-- 口径变更（2026-10-11，用户决策）：**个人自用、不商用**，不再按"许可是否允许再分发"限制 import；
-- 但仍如实登记各来源的**真实许可**（用 raw LICENSE/COPYING 文件核验，不用 GitHub API —— 会被限流），
-- 目的只是"有据可查 + 许可字段非空"，不再作为能否写入的门槛。
-- 门禁（packages/content/src/learning/quality.test.ts）同步放宽为：import 来源必须有**已知许可**，
-- 空 / unknown / NOASSERTION 仍然拦下（无许可的仓库连"依据"都没有）。
--
-- 核验方式（raw.githubusercontent.com/<repo>/<branch>/LICENSE|COPYING）：
--   Wireshark/wireshark        GPL-2.0        master   （项目整体 GPL-2.0；COPYING 内同时含 LGPL 段落）
--   torvalds/linux             GPL-2.0        master
--   mit-pdos/xv6-riscv         MIT            master
--   s-matyukevich/raspberry-pi-os MIT         master
--   rcore-os/rCore-Tutorial-Book-v3 GPL-3.0   main
--   nand2tetris/nand2tetris    MIT            main
--   hneemann/Digital           GPL-3.0        master
--   riscv/riscv-isa-manual     CC BY 4.0      main
--   TheAlgorithms/C            GPL-3.0        master
--   ossu/computer-science      MIT            master
--
-- 幂等：ON CONFLICT (key) DO NOTHING；db/schema.sql 已同步登记。

INSERT INTO content_source (key, name, url, repo, ref, license, usage, obligation, note, verified_at)
VALUES
  ('wireshark', 'Wireshark', 'https://github.com/wireshark/wireshark', 'wireshark/wireshark', 'master', 'GPL-2.0', 'import',
   '如实登记许可；个人自用', '协议解析器与抓包工具的权威参照，用于讲清每一层的真实报文形态', now()),
  ('linux-kernel', 'Linux Kernel', 'https://github.com/torvalds/linux', 'torvalds/linux', 'master', 'GPL-2.0', 'import',
   '如实登记许可；个人自用', 'TCP/IP 协议栈、进程调度、内存管理、文件系统的实现依据', now()),
  ('xv6', 'xv6-riscv', 'https://github.com/mit-pdos/xv6-riscv', 'mit-pdos/xv6-riscv', 'master', 'MIT', 'import',
   '如实登记许可；个人自用', '教学级 Unix 内核（几千行），进程/页表/中断/文件系统最干净的参照实现', now()),
  ('raspberry-pi-os', 'raspberry-pi-os', 'https://github.com/s-matyukevich/raspberry-pi-os', 's-matyukevich/raspberry-pi-os', 'master', 'MIT', 'import',
   '如实登记许可；个人自用', '从零在裸机上写 OS 的渐进式教程（调度/内存/中断/用户态）', now()),
  ('rcore-tutorial', 'rCore-Tutorial-Book-v3', 'https://github.com/rcore-os/rCore-Tutorial-Book-v3', 'rcore-os/rCore-Tutorial-Book-v3', 'main', 'GPL-3.0', 'import',
   '如实登记许可；个人自用', '中文操作系统教程，按章节对应真实内核实现', now()),
  ('nand2tetris', 'Nand2Tetris', 'https://github.com/nand2tetris/nand2tetris', 'nand2tetris/nand2tetris', 'main', 'MIT', 'import',
   '如实登记许可；个人自用', '从 NAND 门到 CPU 与 VM 的自底向上计算机体系结构课程', now()),
  ('digital-sim', 'Digital (hneemann)', 'https://github.com/hneemann/Digital', 'hneemann/Digital', 'master', 'GPL-3.0', 'import',
   '如实登记许可；个人自用', '数字电路仿真器，用于验证组合/时序电路设计', now()),
  ('riscv-isa-manual', 'RISC-V ISA Manual', 'https://github.com/riscv/riscv-isa-manual', 'riscv/riscv-isa-manual', 'main', 'CC BY 4.0', 'import',
   '如实登记许可；个人自用', '指令集手册，讲清编码、寻址与流水线相关约定', now()),
  ('algorithms-c', 'TheAlgorithms/C', 'https://github.com/TheAlgorithms/C', 'TheAlgorithms/C', 'master', 'GPL-3.0', 'import',
   '如实登记许可；个人自用', '贴近硬件的 C 实现（位运算、内存布局、结构体对齐）', now()),
  ('ossu-cs', 'OSSU Computer Science', 'https://github.com/ossu/computer-science', 'ossu/computer-science', 'master', 'MIT', 'import',
   '如实登记许可；个人自用', '计算机科学自学路径索引，用于校对知识覆盖面', now())
ON CONFLICT (key) DO NOTHING;
