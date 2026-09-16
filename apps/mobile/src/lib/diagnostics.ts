/**
 * 「问题诊断」纯逻辑（零 react-native import，可单测）。
 *
 * 用途：内测用户遇到「界面正常但点不动 / 白屏 / 卡住」时，让他在手机上跑一次自检，
 * 把生成的一段文本发给我们 —— 一次就能区分下面三类原因，不用来回问：
 *   ① 触摸事件根本没到 JS（ROM/系统层拦截：悬浮窗、兼容模式、录屏/无障碍类 App）
 *   ② 触摸到了 JS 但被某个覆盖层吃掉（我们自己的 UI 层问题）
 *   ③ JS 线程被卡住（心跳不涨：Keystore/同步/死循环）
 */

export interface DiagnosticsInput {
  appVersion: string;
  /** Platform.OS */
  platform: string;
  /** Platform.Version（Android 上是 API level） */
  osVersion: string | number;
  brand?: string;
  manufacturer?: string;
  model?: string;
  /** Android release（如 "16"） */
  release?: string;
  uiMode?: string;
  window: { width: number; height: number; scale: number; fontScale: number };
  screen: { width: number; height: number };
  insets: { top: number; bottom: number; left: number; right: number };
  /** JS 心跳计数（每秒 +1） */
  heartbeatTicks: number;
  /** 从模块加载到现在的毫秒数 */
  uptimeMs: number;
  /** 首次触摸距启动的毫秒数（null = 尚未收到任何触摸） */
  firstTouchMs: number | null;
  tapCount: number;
  lastTap: { x: number; y: number } | null;
  edgeSwipeEnabled: boolean;
  /** 安全存储令牌是否读到（null = 读取超时/失败） */
  tokenLoaded: boolean | null;
  pendingSync: number;
}

export type TouchVerdictLevel = "ok" | "warn" | "pending";

export interface TouchVerdict {
  level: TouchVerdictLevel;
  title: string;
  detail: string;
}

/** 触摸是否到达 JS —— 这是区分「ROM 层问题」与「我们 UI 层问题」的关键判据 */
export function judgeTouch(input: Pick<DiagnosticsInput, "tapCount" | "heartbeatTicks">): TouchVerdict {
  if (input.heartbeatTicks <= 0) {
    return {
      level: "pending",
      title: "JS 心跳尚未开始",
      detail: "如果这个数字一直不动，说明 JS 线程被卡住（Keystore / 同步 / 死循环），界面会整体无响应。",
    };
  }
  if (input.tapCount <= 0) {
    return {
      level: "warn",
      title: "还没收到任何触摸事件",
      detail:
        "请在下方「触摸测试区」点几下。若点了仍然没有计数，说明触摸在到达 App 之前就被拦截了" +
        "（系统悬浮窗 / 录屏 / 无障碍服务 / 应用兼容模式），不是 App 内部布局问题。",
    };
  }
  return {
    level: "ok",
    title: "触摸事件能正常到达 JS",
    detail:
      "触摸链路正常。若其它页面仍点不动，问题在我们的 UI 覆盖层（或该页面的手势冲突），" +
      "请把这份报告连同「哪个页面点不动」一起发给我们。",
  };
}

const fmt = (n: number) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : 0);
const secs = (ms: number) => `${fmt(ms / 1000)}s`;

/** 生成可直接粘贴发送的诊断文本 */
export function formatDiagnostics(input: DiagnosticsInput, now: Date = new Date()): string {
  const verdict = judgeTouch(input);
  const icon = verdict.level === "ok" ? "✅" : verdict.level === "warn" ? "⚠️" : "⏳";
  const lines = [
    `苦旅 v${input.appVersion} 触控自检报告`,
    `生成时间：${now.toISOString()}`,
    "",
    "── 设备 ──",
    `平台：${input.platform} ${input.osVersion}`,
    `厂商 / 品牌：${input.manufacturer ?? "?"} / ${input.brand ?? "?"}`,
    `机型：${input.model ?? "?"}`,
    `Android 版本：${input.release ?? "?"}${input.uiMode ? `（uiMode：${input.uiMode}）` : ""}`,
    "",
    "── 显示与安全区 ──",
    `window：${input.window.width}x${input.window.height} @${input.window.scale}x（fontScale ${input.window.fontScale}）`,
    `screen：${input.screen.width}x${input.screen.height}`,
    `insets：top ${input.insets.top} / bottom ${input.insets.bottom} / left ${input.insets.left} / right ${input.insets.right}`,
    "",
    "── 运行时 ──",
    `JS 心跳：${input.heartbeatTicks} 次（已运行 ${secs(input.uptimeMs)}）`,
    `首个触摸：${input.firstTouchMs === null ? "尚未收到" : secs(input.firstTouchMs)}`,
    `触摸计数：${input.tapCount} 次${input.lastTap ? `，最后落点 (${Math.round(input.lastTap.x)}, ${Math.round(input.lastTap.y)})` : ""}`,
    `边缘横滑：${input.edgeSwipeEnabled ? "开" : "关"}`,
    `登录令牌：${input.tokenLoaded === null ? "读取超时/失败（按未登录启动）" : input.tokenLoaded ? "已恢复" : "无"}`,
    `待同步变更：${input.pendingSync} 条`,
    "",
    "── 结论 ──",
    `${icon} ${verdict.title}`,
    verdict.detail,
  ];
  return lines.join("\n");
}
