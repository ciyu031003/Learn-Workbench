/** 专注/运动计时会话的单一事实：最短记录阈值与单会话上限。 */

/** 专注最短记录阈值：实际学习中 5 秒以上就入账（含只学 2 分钟退出的场景） */
export const MIN_FOCUS_SECONDS = 5;

/** 运动最短记录阈值（沿用现有交互：不足 1 分钟不入账） */
export const MIN_EXERCISE_SECONDS = 60;

/** 单次会话时长上限：12 小时（标准倒计时最长 3 小时；服务端同样复核） */
export const MAX_SESSION_SECONDS = 12 * 3600;
