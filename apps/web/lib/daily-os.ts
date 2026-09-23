import { pgPool } from "@/lib/db";
import { scopeWhere } from "@/lib/anon";
import { computeHabitStats, isScheduled, toDateKey, sumNutrition, buildNutritionTargetView, ACTIVITY_LEVELS, type ActivityLevel, type Habit, type Sex } from "@learn-workbench/shared";

export interface Scope {
  uid: string | null;
  anonId: string | null;
}

export interface DailyOsResult {
  date: string;
  greeting: string;
  /** 今日完成度 0-100（学习任务 + 习惯 + 运动 + 饮食 的加权） */
  progress: number;
  learning: {
    tasksTotal: number;
    tasksDone: number;
    focusMinutes: number;
    items: { id: number; title: string; done: boolean; taskType: string; careerKey: string }[];
  };
  career: {
    targetRole: string | null;
    highMatchJobs: number;
    pendingApplications: number;
    expiringCertificates: number;
  };
  fitness: {
    workoutName: string | null;
    workoutMinutes: number;
    nutritionKcal: number;
    nutritionTargetKcal: number;
    /** 今日剩余可吃（可为负；v3 M11 今日页与健康 Hub 共用） */
    nutritionRemainingKcal?: number;
    /** 今日饮食明细（最近 5 条；v3 M11 让 Hub/今日页直接看到吃了什么） */
    nutritionEntries?: { id: number; name: string; meal: string; kcal: number; createdAt?: string }[];
  };
  /** 今日饮水（v3 M7/M11：复用 hydration_logs，无需新表） */
  hydration?: { totalMl: number; targetMl: number };
  habits: {
    scheduled: number;
    done: number;
  };
}

function greetingFor(hour: number): string {
  if (hour < 6) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

/**
 * Daily OS 聚合（只读）：把 Learning / Career / Fitness / Habit 的当日数据汇总为「我的一天」。
 * 不写库、不新建表；各域数据实时读取（见各 Phase 的领域表）。
 */
export async function buildDailyOs(
  scope: Scope,
  now: Date = new Date(),
  /** 客户端本地日期（YYYY-MM-DD）。服务器跑在 UTC，东八区凌晨 0–8 点用 `now` 会算成前一天，
   *  于是「饮食页有记录、健康主页/今日页却是 0」（2026-09-22 真机反馈）。 */
  dateKeyOverride?: string | null
): Promise<DailyOsResult> {
  const dateKey =
    dateKeyOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateKeyOverride) ? dateKeyOverride : toDateKey(now);

  // ---- 学习：今日任务 + 专注时长 ----
  const taskWhere = scopeWhere(scope, [scope.uid, dateKey]);
  const { rows: taskRows } = await pgPool.query<{
    id: string; title: string; done: boolean; taskType: string; careerKey: string; focusMinutes: string | number;
  }>(
    `SELECT id, title, done, task_type AS "taskType", career_key AS "careerKey", focus_minutes AS "focusMinutes"
       FROM daily_tasks
      WHERE user_id IS NOT DISTINCT FROM $1${taskWhere.sql} AND task_date = $2::date
      ORDER BY sort_order, id`,
    taskWhere.params
  );

  const focusWhere = scopeWhere(scope, [scope.uid, dateKey]);
  const { rows: focusRows } = await pgPool.query<{ seconds: string | number | null }>(
    `SELECT COALESCE(SUM(duration_seconds), 0) AS seconds
       FROM focus_sessions
      WHERE user_id IS NOT DISTINCT FROM $1${focusWhere.sql}
        AND started_at >= $2::date AND started_at < ($2::date + interval '1 day')`,
    focusWhere.params
  );
  const focusMinutes = Math.round(Number(focusRows[0]?.seconds ?? 0) / 60);

  // ---- 习惯 ----
  const habitWhere = scopeWhere(scope, [scope.uid]);
  const { rows: habitRows } = await pgPool.query<Habit & { targetValue: string | null }>(
    `SELECT id, name, icon, is_boolean AS "isBoolean", target_value AS "targetValue", unit, schedule, color, sort_order AS "sortOrder"
       FROM habits
      WHERE user_id IS NOT DISTINCT FROM $1${habitWhere.sql} AND deleted_at IS NULL AND archived_at IS NULL`,
    habitWhere.params
  );
  const habits: Habit[] = habitRows.map((h) => ({
    ...h,
    targetValue: h.targetValue === null || h.targetValue === undefined ? null : Number(h.targetValue),
    schedule: Array.isArray(h.schedule) ? h.schedule.map(Number) : [0, 1, 2, 3, 4, 5, 6],
  }));

  let habitLogs: { habitId: number; logDate: string; value: number }[] = [];
  if (habits.length > 0) {
    const logWhere = scopeWhere(scope, [scope.uid]);
    const { rows } = await pgPool.query<{ habitId: string; logDate: string; value: string }>(
      `SELECT habit_id AS "habitId", log_date AS "logDate", value
         FROM habit_logs
        WHERE user_id IS NOT DISTINCT FROM $1${logWhere.sql} AND log_date = $2::date`,
      logWhere.params
    );
    habitLogs = rows.map((r) => ({ habitId: Number(r.habitId), logDate: String(r.logDate).slice(0, 10), value: Number(r.value) }));
  }
  const statsByHabit = new Map(habits.map((h) => [h.id, computeHabitStats(h, habitLogs, now)]));
  const scheduled = habits.filter((h) => isScheduled(h.schedule, now)).length;
  const habitsDone = habits.filter((h) => statsByHabit.get(h.id)?.doneToday).length;

  // ---- 运动（今日训练） ----
  const workoutWhere = scopeWhere(scope, [scope.uid, dateKey]);
  const { rows: workoutRows } = await pgPool.query<{ name: string; minutes: string | number }>(
    `SELECT name, ROUND(duration_seconds / 60.0) AS minutes
       FROM workouts
      WHERE user_id IS NOT DISTINCT FROM $1${workoutWhere.sql} AND exercised_on = $2::date AND deleted_at IS NULL
      ORDER BY id DESC LIMIT 1`,
    workoutWhere.params
  );

  // ---- 饮食（今日摄入 + 明细前 5 条，供「一处看全」直接展示，无需再发一次请求） ----
  const mealWhere = scopeWhere(scope, [scope.uid, dateKey]);
  const { rows: mealRows } = await pgPool.query<{
    id: string;
    name: string;
    meal: string;
    kcal: string;
    createdAt: string;
  }>(
    `SELECT id, name, meal, kcal, created_at AS "createdAt"
       FROM meal_entries
      WHERE user_id IS NOT DISTINCT FROM $1${mealWhere.sql} AND log_date = $2::date AND deleted_at IS NULL
      ORDER BY created_at DESC, id DESC`,
    mealWhere.params
  );
  const nutrition = sumNutrition(mealRows.map((r) => ({ kcal: Number(r.kcal), proteinG: 0, carbsG: 0, fatG: 0 })));
  const nutritionEntries = mealRows.slice(0, 5).map((r) => ({
    id: Number(r.id),
    name: r.name,
    meal: (["breakfast", "lunch", "dinner", "snack"].includes(r.meal) ? r.meal : "snack") as
      | "breakfast"
      | "lunch"
      | "dinner"
      | "snack",
    kcal: Math.round(Number(r.kcal)),
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
  }));

  // ---- 职业：目标岗位 + 高匹配数 + 在途投递 + 临期证书 ----
  const profWhere = scopeWhere(scope, [scope.uid]);
  const { rows: profRows } = await pgPool.query<{
    targetRole: string | null;
    weightKg: string | null;
    heightCm: number | null;
    birthYear: number | null;
    sex: string | null;
    activityLevel: string | null;
    targetKcal: string | null;
  }>(
    `SELECT target_role AS "targetRole", weight_kg AS "weightKg", height_cm AS "heightCm",
            birth_year AS "birthYear", sex, activity_level AS "activityLevel",
            nutrition_target_kcal AS "targetKcal"
       FROM user_settings
      WHERE user_id IS NOT DISTINCT FROM $1${profWhere.sql} LIMIT 1`,
    profWhere.params
  );

  // ---- 饮水（复用 hydration_logs，未登录也可用）----
  const waterWhere = scopeWhere(scope, [scope.uid, dateKey]);
  const { rows: waterRows } = await pgPool.query<{ totalMl: string | null }>(
    `SELECT COALESCE(SUM(amount_ml), 0)::text AS "totalMl"
       FROM hydration_logs
      WHERE user_id IS NOT DISTINCT FROM $1${waterWhere.sql}
        AND deleted_at IS NULL
        AND recorded_at >= $2::date AND recorded_at < ($2::date + 1)`,
    waterWhere.params
  );
  const hydrationTotalMl = Number(waterRows[0]?.totalMl ?? 0) || 0;
  const hydrationTargetMl = 2000;

  let highMatchJobs = 0;
  let pendingApplications = 0;
  let expiringCertificates = 0;
  if (scope.uid) {
    // 高匹配：岗位技能命中权重达 70% 以上的活跃岗位数（规则版，与雷达同口径）
    const { rows } = await pgPool.query<{ n: string }>(
      `WITH my_skills AS (
          SELECT skill_id, CASE WHEN level >= 2 THEN 1.0 WHEN level = 1 THEN 0.5 ELSE 0.0 END AS hit
            FROM user_skills WHERE user_id = $1
       ),
       agg AS (
          SELECT l.job_id, SUM(l.weight) AS total, SUM(l.weight * COALESCE(ms.hit, 0)) AS hit
            FROM job_skill_links l
            LEFT JOIN my_skills ms ON ms.skill_id = l.skill_id
           GROUP BY l.job_id
       )
       SELECT COUNT(*)::text AS n FROM agg a
         JOIN job_postings j ON j.id = a.job_id AND j.is_active = true
        WHERE a.total > 0 AND a.hit / a.total >= 0.7`,
      [scope.uid]
    );
    highMatchJobs = Number(rows[0]?.n ?? 0);

    const { rows: appRows } = await pgPool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM job_applications
        WHERE user_id = $1 AND stage NOT IN ('hired','closed')`,
      [scope.uid]
    );
    pendingApplications = Number(appRows[0]?.n ?? 0);

    const { rows: certRows } = await pgPool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM certificates
        WHERE user_id = $1 AND deleted_at IS NULL AND expiry_date IS NOT NULL
          AND expiry_date <= CURRENT_DATE + interval '30 days'`,
      [scope.uid]
    );
    expiringCertificates = Number(certRows[0]?.n ?? 0);
  }

  // ---- 完成度：学习 40% + 习惯 30% + 运动 15% + 饮食 15% ----
  const tasksTotal = taskRows.length;
  const tasksDone = taskRows.filter((t) => t.done).length;
  const taskPart = tasksTotal > 0 ? tasksDone / tasksTotal : 0;
  const habitPart = scheduled > 0 ? habitsDone / scheduled : 0;
  const workoutPart = workoutRows.length > 0 ? 1 : 0;

  // 目标热量：优先手动覆盖，其次按身体数据算（v3 M6），最后默认 2000
  const profileRow = profRows[0];
  const targetView = buildNutritionTargetView(
    {
      weightKg: profileRow?.weightKg ? Number(profileRow.weightKg) : 60,
      heightCm: profileRow?.heightCm ?? null,
      birthYear: profileRow?.birthYear ?? null,
      sex: profileRow?.sex === "male" || profileRow?.sex === "female" ? (profileRow.sex as Sex) : null,
      activityLevel:
        profileRow?.activityLevel && (ACTIVITY_LEVELS as readonly string[]).includes(profileRow.activityLevel)
          ? (profileRow.activityLevel as ActivityLevel)
          : null,
    },
    { kcal: profileRow?.targetKcal ? Number(profileRow.targetKcal) : null },
    now
  );
  const nutritionTargetKcal = targetView.kcal;
  const nutritionPart = Math.min(1, nutrition.kcal / Math.max(1, nutritionTargetKcal));
  const progress = Math.round((taskPart * 40 + habitPart * 30 + workoutPart * 15 + nutritionPart * 15));

  return {
    date: dateKey,
    greeting: greetingFor(now.getHours()),
    progress: Math.max(0, Math.min(100, progress)),
    learning: {
      tasksTotal,
      tasksDone,
      focusMinutes,
      items: taskRows.slice(0, 6).map((t) => ({
        id: Number(t.id),
        title: t.title,
        done: t.done,
        taskType: t.taskType,
        careerKey: t.careerKey,
      })),
    },
    career: {
      targetRole: profRows[0]?.targetRole ?? null,
      highMatchJobs,
      pendingApplications,
      expiringCertificates,
    },
    fitness: {
      workoutName: workoutRows[0]?.name ?? null,
      workoutMinutes: workoutRows[0] ? Math.round(Number(workoutRows[0].minutes)) : 0,
      nutritionKcal: nutrition.kcal,
      nutritionTargetKcal,
      nutritionRemainingKcal: nutritionTargetKcal - nutrition.kcal,
      nutritionEntries,
    },
    hydration: { totalMl: hydrationTotalMl, targetMl: hydrationTargetMl },
    habits: { scheduled, done: habitsDone },
  };
}