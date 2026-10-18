/**
 * 匿名数据表清单（单一事实源，脚本 scripts/check-anon-tables.mjs 会校验覆盖率）。
 *
 * 背景（评审报告 L1）：schema 里带 anon_id 的表有 20+ 张，但登录时的认领逻辑
 * 只覆盖其中 8 张 —— 未登录用户记录的健康/习惯/训练/饮食数据在登录后会"消失"。
 * 本文件把每张表**显式归类**：
 *  - ANON_CLAIM_TABLES：登录时把当前设备的匿名行并入账号；
 *  - ANON_UNCLAIMED_TABLES：明确不并入（并写明原因，供后续 L1 修复时逐条决策）。
 * 新表一旦带 anon_id 却没归类，门禁会失败，避免再次静默漏认领。
 */

/** 登录时认领（与 claimAnonData 一一对应） */
export const ANON_CLAIM_TABLES = [
  "topic_progress",
  "daily_tasks",
  "focus_sessions",
  "checkins",
  "log_entries",
  "certificates",
  "xp_events",
  "resume_assets",
] as const;

/**
 * 有 anon_id 但当前**不在登录认领范围**的表 → 未登录产生的内容登录后不可见。
 * 这些是评审报告 L1 的已知缺口（S5 阶段处理），这里先显式列出，禁止默默新增。
 */
export const ANON_UNCLAIMED_TABLES: Record<string, string> = {
  break_sessions: "健康-休息记录：匿名模式下未开放写入口（待 S5 决策是否开放）",
  energy_logs: "健康-精力：同上",
  exercise_goals: "运动目标：匿名用户可写，登录后丢失（L1 缺口）",
  exercise_logs: "运动记录：匿名用户可写，登录后丢失（L1 缺口）",
  habits: "习惯：匿名用户可写，登录后丢失（L1 缺口）",
  hydration_goals: "饮水目标：匿名用户可写，登录后丢失（L1 缺口）",
  hydration_logs: "饮水记录：匿名用户可写，登录后丢失（L1 缺口）",
  knowledge_notes: "知识笔记：匿名入口未开放",
  meal_entries: "饮食记录：匿名用户可写，登录后丢失（L1 缺口）",
  resume_documents: "简历文档：匿名入口未开放",
  user_settings: "用户设置：匿名设置登录后不继承（有意，偏好跟随账号）",
  weight_logs: "体重记录：匿名用户可写，登录后丢失（L1 缺口）",
  wellbeing_reminders: "健康提醒：匿名入口未开放",
  workouts: "训练记录：匿名用户可写，登录后丢失（L1 缺口）",
};

/** 所有带 anon_id 的表（门禁用） */
export const ANON_TABLES: readonly string[] = [
  ...ANON_CLAIM_TABLES,
  ...Object.keys(ANON_UNCLAIMED_TABLES),
];
