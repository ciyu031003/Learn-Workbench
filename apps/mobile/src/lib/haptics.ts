import * as ExpoHaptics from "expo-haptics";

/**
 * 统一触感反馈：Apple 手感的核心是「轻且语义化」。
 * 全部调用都吞掉异常（模拟器/无振动设备安全），并遵守系统「触摸反馈」开关的可用性探测。
 */
export const haptics = {
  /** 轻点：普通按钮、列表项确认 */
  light() {
    ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  /** 柔和：切换、滑动手势落地 */
  soft() {
    ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Soft).catch(() => {});
  },
  /** 成功：打卡完成、任务完成、登录成功 */
  success() {
    ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success).catch(() => {});
  },
  /** 警示：删除、重置等破坏性操作确认 */
  warning() {
    ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning).catch(() => {});
  },
  /** 失败：登录失败、网络错误 */
  error() {
    ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error).catch(() => {});
  },
};
