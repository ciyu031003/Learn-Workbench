/**
 * 庆祝弹窗的**分档文案与配色**（纯函数，可单测）。
 *
 * 产品口径（2026-10-15）：一组/一章练习做完后按**正确率**给不同反馈 ——
 * 全对、优秀、及格、需要加油是四种不同的话术与配色，而不是永远一句"又向前一步"。
 * 分档刻意只做四档：档位太多，用户记不住差别，也就没有"这次比上次好"的感觉。
 */
export type CelebrationTier = "perfect" | "great" | "pass" | "retry";

export interface CelebrationTone {
  tier: CelebrationTier;
  /** 顶部小字 */
  kicker: string;
  /** 徽章下方的一行结论 */
  resultLabel: string;
  /** 主按钮文案 */
  buttonText: string;
  /** 卡片底色 */
  cardColor: string;
  /** 徽章底色 */
  badgeColor: string;
  /** 两团氛围光斑 */
  glowA: string;
  glowB: string;
}

const TONES: Record<CelebrationTier, CelebrationTone> = {
  perfect: {
    tier: "perfect",
    kicker: "完美通关",
    resultLabel: "全部答对，这一章可以过了",
    buttonText: "继续挑战",
    cardColor: "#4A3413",
    badgeColor: "rgba(240,178,50,0.95)",
    glowA: "#f5c451",
    glowB: "#e8a020",
  },
  great: {
    tier: "great",
    kicker: "表现出色",
    resultLabel: "掌握得不错，错题已进复习队列",
    buttonText: "继续保持",
    cardColor: "#2B3F2A",
    badgeColor: "rgba(86,171,47,0.95)",
    glowA: "#7ed957",
    glowB: "#4fae3a",
  },
  pass: {
    tier: "pass",
    kicker: "完成练习",
    resultLabel: "大体记住了，再巩固一遍就稳了",
    buttonText: "再来一组",
    cardColor: "#26314F",
    badgeColor: "rgba(74,128,226,0.95)",
    glowA: "#6f9bff",
    glowB: "#4a80e2",
  },
  retry: {
    tier: "retry",
    kicker: "完成练习",
    resultLabel: "别急，错题已进入复习队列",
    buttonText: "去复习错题",
    cardColor: "#4A2A2A",
    badgeColor: "rgba(226,110,90,0.95)",
    glowA: "#ff8a6b",
    glowB: "#e26e5a",
  },
};

/** 分档阈值：100% 完美 / ≥80% 优秀 / ≥60% 及格 / 其余需要加油 */
export function celebrationTier(percent: number): CelebrationTier {
  const value = Number.isFinite(percent) ? percent : 0;
  if (value >= 100) return "perfect";
  if (value >= 80) return "great";
  if (value >= 60) return "pass";
  return "retry";
}

export function celebrationTone(percent: number): CelebrationTone {
  return TONES[celebrationTier(percent)];
}

/** 弹窗副标题里对成绩的一句话说明（与档位同源，避免两处口径打架） */
export function celebrationSummary(correct: number, total: number): string {
  if (total <= 0) return "本组没有可统计的题目。";
  const percent = Math.round((correct / total) * 100);
  const tier = celebrationTier(percent);
  if (tier === "perfect") return `${total} 题全对，保持这个状态。`;
  if (tier === "great") return `答对 ${correct} / ${total} 题，接近满分。`;
  if (tier === "pass") return `答对 ${correct} / ${total} 题，还差一点点。`;
  return `答对 ${correct} / ${total} 题，错题会自动进入复习队列。`;
}
