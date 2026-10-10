/**
 * 生成 `content-platform/id-mapping.md`（组二 · 阶段 7 = V3 Phase A 工件）。
 *
 * 为什么要生成而不是手写：84 个知识点 + 关联题数是**从库里读出来的事实**，
 * 手写就会变成"文档说一套、库里是另一套"。这份文档必须可复跑再生。
 *
 * 用法：
 *   node scripts/generate-id-mapping.mjs                         # 默认连本地 Postgres
 *   PGDATABASE=lwb_drill node scripts/generate-id-mapping.mjs
 *   PSQL=.tools/pg/Library/bin/psql.exe node scripts/generate-id-mapping.mjs
 *
 * 说明：走 psql 而不是 pg 驱动，是为了**零新增依赖**（根目录脚本没有 pg 依赖；
 * 仓库里已有 .tools/pg 与系统 psql 可用）。
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const PSQL = process.env.PSQL || "psql";
const DB = process.env.PGDATABASE || "Learn-Workbench";
const HOST = process.env.PGHOST || "127.0.0.1";
const PORT = process.env.PGPORT || "5432";
const USER = process.env.PGUSER || "postgres";
const OUT = process.env.OUT || "content-platform/id-mapping.md";

function query(sql) {
  const args = ["-h", HOST, "-p", PORT, "-U", USER, "-d", DB, "-tA", "-F", "\t", "-c", sql];
  return execFileSync(PSQL, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t"));
}

const points = query(`
  SELECT track_slug, track_title, stage_key, stage_title, topic_key, key, title,
         stage_order, topic_order, sort_order, quality_level, difficulty, estimated_minutes,
         content_version, source_key, status,
         COALESCE((SELECT count(*) FROM question_knowledge_point q WHERE q.knowledge_point_key = kp.key), 0) AS q_count
    FROM knowledge_points kp
   ORDER BY track_slug, stage_order, topic_order`);

const relationCounts = query(`
  SELECT kind, count(*) FROM knowledge_relation GROUP BY kind ORDER BY kind`);
const prereqCount = query(`SELECT count(*) FROM knowledge_prerequisite`)[0]?.[0] ?? "0";
const linkCounts = query(`
  SELECT link_source, count(*) FROM question_knowledge_point GROUP BY link_source ORDER BY link_source`);
const viewRows = query(`SELECT count(*) FROM learning_attempts_unified`);

function byTopicOrder(list) {
  return [...list].sort((a, b) => a.topicOrder - b.topicOrder);
}

const tracks = new Map();
for (const row of points) {
  const [trackSlug, trackTitle, stageKey, stageTitle, topicKey, key, title, stageOrder, topicOrder, sortOrder, quality, difficulty, minutes, version, sourceKey, status, qCount] = row;
  if (!tracks.has(trackSlug)) tracks.set(trackSlug, { title: trackTitle, stages: new Map() });
  const track = tracks.get(trackSlug);
  if (!track.stages.has(stageKey)) track.stages.set(stageKey, { title: stageTitle, order: Number(stageOrder), points: [] });
  track.stages.get(stageKey).points.push({ topicKey, key, title, topicOrder: Number(topicOrder), sortOrder: Number(sortOrder), quality, difficulty, minutes, version, sourceKey, status, qCount: Number(qCount) });
}

const lines = [];
lines.push("# 稳定 ID 映射表（阶段 7 = V3 Phase A）");
lines.push("");
lines.push("> **本文件由脚本生成，请勿手改**：`node scripts/generate-id-mapping.mjs`（读库中 `knowledge_points`）。");
lines.push("> 数据来源为同步后的真实库内容；手改会立刻与库不一致。");
lines.push("");
lines.push("## 1. ID 规则");
lines.push("");
lines.push("| 对象 | 稳定 ID | 规则来源 |");
lines.push("|---|---|---|");
lines.push("| 学习库知识点 | `<trackSlug>/<stageKey>/<topicKey>` | 三段都来自内容包（`packages/content`），不由数组下标推导 |");
lines.push("| 学习库题目 | `<questionKey>`（内容包内已全局唯一） | `learning_review_cards` 主键 (user_id, question_key) 已依赖它的全局唯一性 |");
lines.push("| 路线图阶段 | `content_phases.slug` = `phase_key` | 迁移 060 回填 + BEFORE INSERT 触发器兜底 |");
lines.push("| 路线图主题 | `content_topics.slug` = `topic_key` | 同上 |");
lines.push("");
lines.push("**红线**：知识点 ID 一经发布不再修改（改 ID 会断掉用户作答与复习卡片）。");
lines.push("内容演进只能改正文（指纹变化 → 同步识别为 updated）或新增知识点（旧知识点软归档）。");
lines.push("");
lines.push("## 2. 关联规模");
lines.push("");
lines.push(`- 知识点：${points.length}`);
lines.push(`- 知识点关系：${relationCounts.map(([kind, n]) => `${kind} ${n}`).join(" · ")}`);
lines.push(`- 前置边：${prereqCount}`);
lines.push(`- 题 ↔ 知识点：${linkCounts.map(([src, n]) => `${src} ${n}`).join(" · ")}`);
lines.push(`- 作答统一视图行数（当前库）：${viewRows?.[0]?.[0] ?? "0"}`);
lines.push("");
lines.push("## 3. 全量映射（按课程 → 阶段 → 知识点）");
lines.push("");
for (const [trackSlug, track] of tracks) {
  lines.push(`### ${track.title}（\`${trackSlug}\`）`);
  lines.push("");
  for (const [stageKey, stage] of [...track.stages].sort((a, b) => a[1].order - b[1].order)) {
    lines.push(`**阶段 ${stage.order + 1} · ${stage.title}**（\`${stageKey}\`）`);
    lines.push("");
    lines.push("| # | 知识点 | 稳定 ID | 质量 | 难度 | 分钟 | 关联题 | 来源 | 状态 |");
    lines.push("|---|---|---|---|---|---|---|---|---|");
    for (const point of byTopicOrder(stage.points)) {
      lines.push(
        `| ${point.topicOrder + 1} | ${point.title} (\`${point.topicKey}\`) | \`${point.key}\` | ${point.quality} | ${point.difficulty} | ${point.minutes} | ${point.qCount} | ${point.sourceKey ?? "-"} | ${point.status} |`
      );
    }
    lines.push("");
  }
}

lines.push("## 4. 待分类题");
lines.push("");
lines.push("内容包里未绑定 `topicKey`、且所在阶段有多个知识点的题，会进\"待分类\"（同步接口的 `unlinkedQuestions` 计数），");
lines.push("由阶段 12（Phase D）的题库统一页面处理：要么人工绑定知识点（`link_source='curated'`），要么标记待分类。");
lines.push("");
writeFileSync(OUT, lines.join("\n"), "utf8");
console.log("[id-mapping] 已生成 " + OUT + "：知识点 " + points.length + " 条");
