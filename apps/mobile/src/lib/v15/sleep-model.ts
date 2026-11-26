export interface SleepInsight {
  key: string;
  tone: "green" | "orange" | "amber" | "lilac" | "red" | "blue";
  title: string;
  body: string;
}

export function formatSleepDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes <= 0) return "—";
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return m + "m";
  return h + "h " + String(m).padStart(2, "0") + "m";
}

/** 默认目标 7h30m；睡眠债按 7 晚累计，缺失数据返回 null */
export function sleepDebtMinutes(avgMinutes: number | null | undefined, goalMinutes = 450, nights = 7): number | null {
  if (avgMinutes === null || avgMinutes === undefined || !Number.isFinite(avgMinutes) || avgMinutes <= 0) return null;
  return Math.max(0, Math.round((goalMinutes - avgMinutes) * nights));
}

export function sleepAchievementPct(avgMinutes: number | null | undefined, goalMinutes = 450): number {
  if (avgMinutes === null || avgMinutes === undefined || !Number.isFinite(avgMinutes) || avgMinutes <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((avgMinutes / goalMinutes) * 100)));
}

function clockOfOffset(offsetMin: number): string {
  const raw = ((Math.round(offsetMin) % 1440) + 1440) % 1440;
  return String(Math.floor(raw / 60)).padStart(2, "0") + ":" + String(raw % 60).padStart(2, "0");
}

/** 由近 7 晚入睡时刻给出建议窗口（均值 ±15 分钟）；少于 2 晚返回 null */
export function bedtimeWindow(offsets: readonly number[]): { label: string; meanMin: number } | null {
  const values = offsets.filter((value) => Number.isFinite(value));
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { label: clockOfOffset(mean - 15) + " – " + clockOfOffset(mean + 15), meanMin: Math.round(mean) };
}

/**
 * 洞察只从真实指标生成（时长 / 分期 / 规律性 / 夜醒），
 * 不足三项时返回已有的，绝不用占位数字凑数。
 */
export function buildSleepInsights(input: {
  avgDurationMin: number | null;
  deepPct: number | null;
  regularityStdMin: number | null;
  awakeAvg: number | null;
  metNights: number;
}): SleepInsight[] {
  const out: SleepInsight[] = [];
  const { avgDurationMin, deepPct, regularityStdMin, awakeAvg, metNights } = input;

  if (regularityStdMin !== null && Number.isFinite(regularityStdMin)) {
    if (regularityStdMin <= 30) {
      out.push({
        key: "regularity",
        tone: "green",
        title: "作息很稳定",
        body: "近 7 晚入睡时间波动约 ±" + Math.round(regularityStdMin) + " 分钟，生物钟正在形成。",
      });
    } else {
      out.push({
        key: "regularity",
        tone: "amber",
        title: "入睡时间波动较大",
        body: "近 7 晚波动约 ±" + Math.round(regularityStdMin) + " 分钟；先固定起床时间，比强迫自己早睡更有效。",
      });
    }
  }

  if (deepPct !== null && Number.isFinite(deepPct)) {
    if (deepPct >= 15) {
      out.push({
        key: "deep",
        tone: "lilac",
        title: "深睡占比健康",
        body: "深睡占整晚 " + Math.round(deepPct) + "%，恢复性睡眠处在参考区间内。",
      });
    } else {
      out.push({
        key: "deep",
        tone: "red",
        title: "深睡偏少",
        body: "深睡只占 " + Math.round(deepPct) + "%；睡前一小时调暗屏幕、避免酒精，通常能拉回来。",
      });
    }
  }

  if (avgDurationMin !== null && avgDurationMin > 0) {
    if (avgDurationMin < 450) {
      out.push({
        key: "debt",
        tone: "orange",
        title: "有睡眠债",
        body: "近 7 晚平均 " + formatSleepDuration(avgDurationMin) + "，低于 7h30m 目标；今晚提前 " + Math.min(60, Math.round(450 - avgDurationMin)) + " 分钟上床。",
      });
    } else {
      out.push({
        key: "duration",
        tone: "green",
        title: "时长达标",
        body: "近 7 晚平均 " + formatSleepDuration(avgDurationMin) + "，达标 " + metNights + "/7 晚。",
      });
    }
  }

  if (awakeAvg !== null && Number.isFinite(awakeAvg) && awakeAvg >= 2) {
    out.push({
      key: "awake",
      tone: "blue",
      title: "夜间醒来偏多",
      body: "平均每晚醒 " + Math.round(awakeAvg) + " 次；睡前减少大量饮水，卧室温度保持在 18–22°C。",
    });
  }

  return out.slice(0, 3);
}
