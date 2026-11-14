/**
 * 学习计时（v2.6.10）
 *
 * 口径（产品确认）：进入知识点 / 章节 / 刷题页即开始计时，离开页面结算；
 * 单次不足 30 秒不记账（避免翻页噪声），结算写入 focus_sessions（tag = 内容名），
 * 与专注计时共用同一套统计口径。
 */

/** 单次学习最少记账秒数 */
export const MIN_STUDY_SECONDS = 30;

export interface StudyClock {
  /** 开始一段计时（重复调用不重置） */
  start: () => void;
  /** 结束并返回本段秒数；未在计时返回 0 */
  stop: (nowMs?: number) => number;
  /** 当前已计时秒数（不结束） */
  elapsed: (nowMs?: number) => number;
  /** 是否正在计时 */
  running: () => boolean;
}

/**
 * 墙钟计时器：只记录起点，不依赖 setInterval 的累计值，
 * 因此 App 切后台 / 掉帧都不会少算或多算。
 */
export function createStudyClock(now: () => number = () => Date.now()): StudyClock {
  let startedAt: number | null = null;
  return {
    start() {
      if (startedAt === null) startedAt = now();
    },
    stop(nowMs) {
      if (startedAt === null) return 0;
      const end = typeof nowMs === "number" ? nowMs : now();
      const seconds = Math.max(0, Math.floor((end - startedAt) / 1000));
      startedAt = null;
      return seconds;
    },
    elapsed(nowMs) {
      if (startedAt === null) return 0;
      const end = typeof nowMs === "number" ? nowMs : now();
      return Math.max(0, Math.floor((end - startedAt) / 1000));
    },
    running() {
      return startedAt !== null;
    },
  };
}

/** 结算判定：达到阈值才记账 */
export function shouldRecordStudy(seconds: number): boolean {
  return Number.isFinite(seconds) && seconds >= MIN_STUDY_SECONDS;
}

/** 页面顶部展示用：不足 1 分钟不显示，其余向下取整到分钟 */
export function studyMinutesLabel(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds < 60) return null;
  return "本次已学 " + Math.floor(seconds / 60) + " 分钟";
}