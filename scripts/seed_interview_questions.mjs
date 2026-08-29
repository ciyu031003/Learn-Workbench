#!/usr/bin/env node
/**
 * 面试题库种子内容（interview_questions）
 * 需求：P3 题库刷题链路需要有数据可跑。仅当题库为空时插入，避免覆盖。
 * 用法：node scripts/seed_interview_questions.mjs
 * 环境变量：PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const QUESTIONS = [
  // 通信
  { module: "通信", difficulty: "easy", question: "TCP 三次握手的过程是什么？", answer: "客户端发 SYN → 服务端回 SYN+ACK → 客户端回 ACK，连接建立。" },
  { module: "通信", difficulty: "medium", question: "TCP 与 UDP 的区别是什么？", answer: "TCP 面向连接、可靠、有序、有拥塞控制；UDP 无连接、不可靠、开销小、低延迟。" },
  { module: "通信", difficulty: "medium", question: "HTTPS 相比 HTTP 多了什么保障？", answer: "通过 TLS 加密传输、身份认证与完整性校验。" },
  // ETL
  { module: "ETL", difficulty: "easy", question: "什么是 ETL？", answer: "Extract/Transform/Load，即抽取、转换、加载数据的流程。" },
  { module: "ETL", difficulty: "medium", question: "数据清洗通常处理哪些问题？", answer: "缺失值、重复记录、格式不一致、异常值与脏数据。" },
  // Linux 云运维
  { module: "Linux云运维", difficulty: "easy", question: "如何查看 Linux 的进程与端口占用？", answer: "ps 查看进程、netstat/ss 查看端口、lsof 看文件占用。" },
  { module: "Linux云运维", difficulty: "medium", question: "Docker 镜像与容器的区别？", answer: "镜像是只读模板，容器是镜像的运行实例，可读写、可启动停止。" },
  { module: "Linux云运维", difficulty: "hard", question: "Kubernetes 中 Deployment 的作用？", answer: "声明期望副本数，滚动更新/回滚，保障副本可用。" },
  // Agent
  { module: "Agent", difficulty: "medium", question: "什么是 Agent？与普通程序的区别？", answer: "能感知环境、自主决策、调用工具并多步执行目标；普通程序按固定脚本执行。" },
  { module: "Agent", difficulty: "medium", question: "大模型 Agent 通常由哪些组件构成？", answer: "模型推理、工具调用、记忆、规划（ReAct 等流程）。" },
  // 行业
  { module: "行业", difficulty: "easy", question: "什么是数据中台？", answer: "沉淀企业级数据资产、统一口径并支撑上层应用的数据平台。" },
  { module: "行业", difficulty: "hard", question: "什么是大模型微调（Fine-tuning）？", answer: "用领域数据继续训练模型以适配特定任务，通常在预训练基础上进行。" },
];

async function main() {
  const pool = new Pool({
    host: process.env.PGHOST || "127.0.0.1",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "Learn-Workbench",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    max: 3,
  });
  try {
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM interview_questions");
    if ((rows[0]?.n ?? 0) > 0) {
      console.log(`[skip] 题库已有 ${rows[0].n} 题，跳过种子写入`);
      return;
    }
    let inserted = 0;
    for (const q of QUESTIONS) {
      const r = await pool.query(
        `INSERT INTO interview_questions (module, question, answer, difficulty)
         VALUES ($1, $2, $3, $4)`,
        [q.module, q.question, q.answer, q.difficulty]
      );
      if (r.rowCount > 0) inserted += 1;
    }
    console.log(`[done] 种子写入 ${inserted} 题（module=${[...new Set(QUESTIONS.map((q) => q.module))].join("/")}）`);
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error("[fatal]", e && e.message ? e.message : e);
  process.exit(1);
});
