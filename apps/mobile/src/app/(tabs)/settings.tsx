import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useHeaderTopInset } from "@/components/screen-header";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Animated from "react-native-reanimated";
import { addDaysToDateKey, computeStreak } from "@learn-workbench/shared/domains";
import { formatDateCN, formatDuration } from "@learn-workbench/shared/dates";
import type { Certificate, FocusSession } from "@learn-workbench/shared/schemas";
import { useAppStore } from "@/store/app-store";
import { useUpdateStore } from "@/store/update-store";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useFontScale } from "@/lib/use-font-scale";
import { formatFontScale } from "@/lib/text-scale";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useScrollToTopHandler } from "@/lib/scroll-to-top";
import { getApiUrl } from "@/config";
import { discardForeignPendingChanges, requestSync, useSyncEngineStatus } from "@/lib/sync-engine";
import { clockSkewHint, useServerClock } from "@/lib/sync-clock";
import {
  APP_ICP_NUMBER,
  APP_MPS_NUMBER,
  MPS_VERIFY_URL,
  APP_VERSION_NAME,
  DOWNLOAD_PAGE_URL,
  ICP_VERIFY_URL,
  PRIVACY_POLICY_URL,
  clearPendingUpdate,
  readPendingUpdate,
  silentCheckForUpdate,
} from "@/lib/ota";
import { buildDayMinutesMap, localKey, sessionMinutes } from "@/lib/focus-series";
import { withAlpha } from "@/lib/chart-math";
import { Surface } from "@/components/surface";
import { SectionTitle } from "@/components/v2/section-title";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { Button, ButtonRow } from "@/components/button";
import { BottomSheet } from "@/components/bottom-sheet";
import { DayNightSwitch } from "@/components/day-night-switch";
import { router } from "expo-router";
import { AuthSheet } from "@/components/auth-sheet";
import { haptics } from "@/lib/haptics";
import type { ThemeColors, ThemeMode } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, tabularNums, typography } from "@/theme/tokens";
import { setMotionUserEnabled } from "@/theme/motion";

/**
 * 「我的」页（v3 版式重排 · 2026-11）。
 *
 * 版式（对齐《移动端 UI 优化提案》我的页）：
 * ① 顶部个人卡（实景带 + 头像首字母 + 昵称 + 专业·届别·城市 + 连续打卡）
 * ② 三格统计（累计专注 / 完成任务 / 获得徽章，分别可点进学习统计 / 任务 / 证书）
 * ③ 成长记录热力卡（近 14 周每日专注，自绘 14×7 格 + 少↔多图例）
 * ④ 最近获得（已取得证书的最近 3 枚；徽章口径 = 现有成就数据 /api/certificates）
 * ⑤ 设置列表（数据同步 / 学习提醒 / 外观与主题 / 关于 Workbench）+ 账户与偏好 / 工具 / 账号分组
 *
 * 纪律（v1.62 起沿用，本轮只换版式）：
 * - 所有设置项、开关、跳转与处理逻辑保持原样（登录/退出、手动同步、主题弹层与日夜开关、
 *   每日背景、动效、字体大小、通知权限、学习领域切换、检查更新/OTA、诊断、隐私与备案链接、
 *   同步状态、时钟偏差、清空本机数据），逐项保留；「检查更新 / 下载 / 隐私 / 备案」收进
 *   「关于 Workbench」弹层，「同步状态」收进「数据同步」弹层；
 * - 不写裸 fontSize（全部走 typography token）；颜色/圆角/阴影只取 useTheme().colors 与 tokens；
 * - 不新增动效调用点：入场沿用 useScreenEntrance，按压沿用 PressableScale / 原生 Switch；
 * - 每个可点区域都带 hitSlop 与 accessibilityRole / Label（开关/选中态带 accessibilityState）；
 * - 数据只用真实来源：store（sessions / tasks / checkins / progress / logs / 同步状态）与
 *   既有接口（/api/profile/info 资料、/api/certificates 已取得证书）；拿不到时显示「—」。
 */

type IconName = ComponentProps<typeof ThemedIcon>["name"];

/** 成长记录热力图：近 14 周（98 天），周一为一周起点 */
const HEAT_WEEKS = 14;
const HEAT_LEVEL_ALPHA = [0, 0.16, 0.34, 0.62, 1] as const;
/** 每日专注分钟 → 热力档位（0 无 / 1 <30 / 2 <60 / 3 <120 / 4 ≥120） */
function heatLevelOf(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}
/** 档位 → 主题色（深色自动跟随 token；不用裸色值） */
function heatBackgroundOf(level: number, colors: ThemeColors): string {
  if (level <= 0) return colors.surfaceMuted;
  if (level >= 4) return colors.primary;
  return withAlpha(colors.primary, HEAT_LEVEL_ALPHA[level]);
}

type HeatDay = { key: string; minutes: number; future: boolean };

/** 周一为一周起点：返回 todayKey 所在周的周一日期键（纯日历运算；业务日期口径见 shared/domains） */
function weekStartKey(todayKey: string): string {
  const year = Number(todayKey.slice(0, 4));
  const month = Number(todayKey.slice(5, 7)) - 1;
  const day = Number(todayKey.slice(8, 10));
  const weekday = new Date(Date.UTC(year, month, day)).getUTCDay(); // 0 = 周日
  return addDaysToDateKey(todayKey, -((weekday + 6) % 7));
}

/** 近 14 周（周一起、最后一周是本周）的每日专注；未来几天标 future，由渲染层压暗 */
function buildHeatWeeks(sessions: FocusSession[], todayKey: string): HeatDay[][] {
  const byDay = buildDayMinutesMap(sessions);
  const start = addDaysToDateKey(weekStartKey(todayKey), -(HEAT_WEEKS - 1) * 7);
  const weeks: HeatDay[][] = [];
  for (let w = 0; w < HEAT_WEEKS; w += 1) {
    const days: HeatDay[] = [];
    for (let d = 0; d < 7; d += 1) {
      const key = addDaysToDateKey(start, w * 7 + d);
      days.push({ key, minutes: byDay.get(key) ?? 0, future: key > todayKey });
    }
    weeks.push(days);
  }
  return weeks;
}

/** 徽章卡配色（已取得证书按位次轮换三档语义色，全部取 token） */
function badgeToneOf(colors: ThemeColors, index: number): { soft: string; strong: string } {
  if (index === 0) return { soft: colors.accentSoft, strong: colors.accentStrong };
  if (index === 1) return { soft: colors.primarySoft, strong: colors.primary };
  return { soft: colors.successSoft, strong: colors.success };
}
const BADGE_ICONS: IconName[] = ["ribbon", "trophy", "checkmark-circle"];

/** 已取得证书的展示日期（卡片宽度只有 3 等分，展示用「M 月 D 日」；缺失时给状态词，不编造日期） */
function earnedDateText(value: string | null | undefined): string {
  const raw = (value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "已取得";
  return Number(raw.slice(5, 7)) + " 月 " + Number(raw.slice(8, 10)) + " 日";
}
/** 无障碍朗读用的完整日期（含年份） */
function earnedDateFull(value: string | null | undefined): string {
  const raw = (value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? formatDateCN(raw) : "已取得";
}

interface ProfileBits {
  major: string;
  graduationYear: string;
  city: string;
  targetRole: string;
}

/**
 * v3 分组卡：白色实底 + 细描边（层级靠色场与描边，不叠投影）。
 * 列表卡内边距 14 / 2 对齐提案的 .list 卡片，行内不再重复左右留白。
 */
function GroupCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Surface tier="surface" corner={radius.card} padded={false} style={style}>
      {children}
    </Surface>
  );
}

/**
 * v3 设置行：图标芯片(30, surfaceMuted) + 标题/副标题 + 右侧值或控件 + chevron。
 * 无 onPress 时退化为纯展示行（开关行、状态行）；有 onPress 时整行可点（按压只换底色，不缩放）。
 */
function SettingsRow({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  valueColor,
  valueDotColor,
  right,
  onPress,
  showChevron = false,
  last = false,
  disabled = false,
  accessibilityLabel,
  accessibilityState,
  style,
}: {
  icon?: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  valueColor?: string;
  /** 值前面的状态小圆点（数据同步「已同步」用） */
  valueDotColor?: string;
  right?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  last?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const body = (
    <>
      {icon ? (
        <View style={styles.iconChip}>
          <ThemedIcon name={icon} size={16} color={iconColor ?? colors.textSecondary} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, disabled && styles.rowTitleOff]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <View style={styles.rowValueWrap}>
          {valueDotColor ? <View style={[styles.rowValueDot, { backgroundColor: valueDotColor }]} /> : null}
          <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]} numberOfLines={1}>
            {value}
          </Text>
        </View>
      ) : null}
      {right}
      {showChevron ? <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} /> : null}
      {!last ? <View pointerEvents="none" style={[styles.rowDivider, { left: icon ? 41 : 0 }]} /> : null}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, style]}>{body}</View>;
  }

  return (
    <PressableScale
      haptic
      disabled={disabled}
      onPress={onPress}
      /** 列表行用整行底色反馈（与既有 ListRow 一致），不做缩放 */
      scaleTo={1}
      pressedStyle={styles.rowPressed}
      hitSlop={2}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={accessibilityState ?? { disabled }}
      style={[styles.row, style]}
    >
      {body}
    </PressableScale>
  );
}

export default function SettingsScreen() {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerTop = useHeaderTopInset("hero");
  const tabBarSpace = useTabBarSpace();
  /** v19-M1：首屏入场错峰（Tab scene 常驻，只在首次挂载播放） */
  const entrance = useScreenEntrance();
  /** v19-M8：TabBar 双击回顶 */
  const settingsScrollRef = useRef<ScrollView>(null);
  useScrollToTopHandler("/settings", settingsScrollRef);

  const backgroundEnabled = useAppStore((s) => s.backgroundEnabled);
  const toggleBackground = useAppStore((s) => s.toggleBackground);
  // 只认显式 false（老版本持久化里没有该字段 → 默认开，不能显示成关闭）
  const motionEnabled = useAppStore((s) => s.motionEnabled !== false);
  const setMotionEnabled = useAppStore((s) => s.setMotionEnabled);
  /**
   * 动效开关（真实生效）：写持久化偏好 + 立刻作用到 theme/motion 的运行期 override。
   * 根布局 _layout 也订阅了 store，双保险（设置页直接调是为了点击即生效、不等下一帧）。
   */
  const toggleMotion = (next: boolean) => {
    haptics.soft();
    setMotionEnabled(next);
    setMotionUserEnabled(next);
  };
  /** 系统字号倍数（只读展示；改字号走系统设置，见「字体大小」行）。 */
  const fontScale = useFontScale();
  const resetAll = useAppStore((s) => s.resetAll);
  const resetForLogout = useAppStore((s) => s.resetForLogout);
  const progress = useAppStore((s) => s.progress);
  const tasks = useAppStore((s) => s.tasks);
  const logs = useAppStore((s) => s.logs);
  /** 专注会话 / 打卡：统计与热力图都从本机真实记录聚合，不新增数据口径 */
  const sessions = useAppStore((s) => s.sessions);
  const checkins = useAppStore((s) => s.checkins);
  const streak = useMemo(() => computeStreak(checkins, { now: new Date() }), [checkins]);

  const token = useAppStore((s) => s.token);
  const username = useAppStore((s) => s.username);
  const setAuth = useAppStore((s) => s.setAuth);
  const pendingCount = useAppStore((s) => s.pendingChanges.length);
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt);
  const engine = useSyncEngineStatus();
  /** S5-3：设备时钟与服务器偏移（>5min 提示校准；游标本身只认 serverTime，不依赖本机时钟） */
  const clock = useServerClock();

  const [authOpen, setAuthOpen] = useState(false);
  // 手动同步按钮的 loading 跟随引擎状态（v2.1：手动同步已并入引擎 single-flight）
  const busy = engine.syncing;
  const [msg, setMsg] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<"idle" | "checking" | "latest" | "update" | "failed">("idle");
  // v7 P1：主题改为弹层选择
  const [themeOpen, setThemeOpen] = useState(false);
  // v3：同步详情与「关于」改为弹层（页面主列表只保留提案的四个入口）
  const [syncOpen, setSyncOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  /** 弹层串行：先关当前弹层、等它卸载完再开下一个（BottomSheet 明令禁止两个 Modal 同时 present） */
  const [pendingAuthAfterSync, setPendingAuthAfterSync] = useState(false);
  const [pendingUpdateCheck, setPendingUpdateCheck] = useState(false);

  const [domains, setDomains] = useState<{ career_key: string; name: string; kind?: string; kind_label?: string }[]>([]);
  const [career, setCareer] = useState("ict");

  /** 资料：专业 / 届别 / 城市（/api/profile/info 的 education + currentCity；缺失显示引导语） */
  const [profileBits, setProfileBits] = useState<ProfileBits | null>(null);
  /** 已取得证书：现有「成就数据」的真源；null = 未登录 / 接口不可用（统计显示「—」） */
  const [certs, setCerts] = useState<Certificate[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [dRes, curRes] = await Promise.all([
          fetch(getApiUrl() + "/api/domains"),
          fetch(getApiUrl() + "/api/settings/career"),
        ]);
        const dData = await dRes.json();
        const curData = await curRes.json();
        setDomains(dData.domains ?? []);
        setCareer(curData.career ?? "ict");
      } catch {
        // 职业接口不可用时保持默认
      }
    })();
  }, []);

  /** 资料与徽章：登录后一次性拉取（换账号 / 重新登录会自动重拉）；接口失败保持「—」 */
  useEffect(() => {
    if (!token) return;
    let alive = true;
    (async () => {
      const headers = { Authorization: "Bearer " + token };
      const [info, certsData] = await Promise.all([
        fetch(getApiUrl() + "/api/profile/info", { headers })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(getApiUrl() + "/api/certificates", { headers })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      if (!alive) return;
      const education = Array.isArray(info?.education) ? info.education[0] : null;
      setProfileBits({
        major: typeof education?.major === "string" ? education.major.trim() : "",
        graduationYear: typeof education?.end === "string" ? education.end.trim().slice(0, 4) : "",
        city: typeof info?.currentCity === "string" ? info.currentCity.trim() : "",
        targetRole: typeof info?.targetRole === "string" ? info.targetRole.trim() : "",
      });
      if (certsData) {
        setCerts(Array.isArray(certsData.records) ? (certsData.records as Certificate[]) : []);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  // OTA 启动静默检查的落盘结果：进来就把这一行标成「发现新版本」（不弹窗）
  useEffect(() => {
    void (async () => {
      const pending = await readPendingUpdate();
      if (pending) setUpdateState("update");
      else void silentCheckForUpdate();
    })();
  }, []);

  const handleAuthed = (token: string, username: string) => {
    setAuth(token, username);
    setMsg("欢迎回来，" + username + "：本机数据将自动同步云端");
  };

  /** 退出登录：先尽力通知服务端销毁会话，再清本地（接口不可用也必须清，安全优先） */
  const doLogout = async () => {
    if (!token) return;
    // 退出前先丢弃不属于当前账号的队列（换账号兜底；sync-engine 的 push 前校验是第二道防线）
    const dropped = discardForeignPendingChanges("退出登录");
    try {
      await fetch(getApiUrl() + "/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      });
    } catch {
      // 离线/接口不可用：忽略。本地清理必须继续，否则 token 与会话数据会留在本机
    } finally {
      resetForLogout();
      // 登录态相关的展示数据一并清掉，避免退出后还显示上一个账号的资料/徽章
      setProfileBits(null);
      setCerts(null);
      setMsg(dropped > 0 ? "已退出登录（丢弃 " + dropped + " 条非本账号待同步变更）" : "已退出登录，本机数据已清理");
    }
  };

  const confirmLogout = () => {
    haptics.warning();
    Alert.alert(
      "退出登录",
      "退出后本机学习记录与未同步的变更会被清空（云端数据不受影响），重新登录会从云端恢复。",
      [
        { text: "取消", style: "cancel" },
        { text: "退出", style: "destructive", onPress: () => void doLogout() },
      ],
    );
  };

  // v2.1（评审 2026-10-31）：手动同步改走引擎 single-flight——此前直接调 syncPush/syncPull，
  // 会绕过 runSync 的 running 守卫与自动同步并发执行（同一批 pending 被两路发送、pull 双写）。
  // requestSync 在引擎空闲时立即跑一轮（推送 + 拉取），running 时只置 dirty、本轮结束自动补跑。
  const doPush = () => {
    if (!token) return;
    // 手动同步前同样校验归属，避免把上一个账号的离线队列推给当前 Bearer
    discardForeignPendingChanges("手动同步");
    setMsg(null);
    requestSync();
    haptics.success();
    setMsg("已加入同步队列：推送 + 拉取");
  };

  const doPull = () => {
    if (!token) return;
    setMsg(null);
    requestSync();
    haptics.soft();
    setMsg("已加入同步队列：推送 + 拉取");
  };

  const checkUpdate = async () => {
    setUpdateState("checking");
    // v11：检查与升级都走 update-store（发现新版本会直接弹出「应用内升级」弹层，不跳浏览器）
    const outcome = await useUpdateStore.getState().check({ silent: false });
    if (outcome === "available") {
      setUpdateState("update");
      return;
    }
    if (outcome === "latest") {
      setUpdateState("latest");
      await clearPendingUpdate();
      // 永远留一条「去下载页」：万一客户端缓存/服务端策略出问题，用户仍能自救
      Alert.alert("已是最新版本", "当前版本：苦旅 v" + APP_VERSION_NAME, [
        { text: "知道了", style: "cancel" },
        { text: "打开下载页", onPress: () => void Linking.openURL(DOWNLOAD_PAGE_URL).catch(() => {}) },
      ]);
      return;
    }
    setUpdateState("failed");
    Alert.alert("检查更新失败", "请确认网络可用，或前往 learn.yuanabd.cn/download.html 手动下载", [
      { text: "知道了", style: "cancel" },
      { text: "打开下载页", onPress: () => void Linking.openURL(DOWNLOAD_PAGE_URL).catch(() => {}) },
    ]);
  };

  const switchCareer = async (key: string) => {
    setCareer(key);
    if (token) {
      try {
        await fetch(getApiUrl() + "/api/settings/career", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ career: key }),
        });
        setMsg("职业路线已切换并同步到云端");
      } catch {
        setMsg("切换失败：请确认已登录且 Web 服务可用");
      }
    } else {
      setMsg("登录后可同步职业路线到云端");
    }
  };

  const confirmReset = () => {
    Alert.alert("重置数据", "将清空本机所有进度、任务、日志与打卡，确定吗？", [
      { text: "取消", style: "cancel" },
      { text: "重置", style: "destructive", onPress: resetAll },
    ]);
  };

  /** 分组卡右侧「值」的文案（值 + 箭头） */
  const themeLabel = themeMode === "light" ? "浅色" : themeMode === "dark" ? "深色" : "跟随系统";
  const updateLabel =
    updateState === "update"
      ? "发现新版本"
      : updateState === "latest"
        ? "已是最新"
        : updateState === "failed"
          ? "检查失败"
          : "v" + APP_VERSION_NAME;
  const syncHint = engine.syncing
    ? "正在同步…"
    : engine.lastError
      ? "上次同步失败：" + engine.lastError.slice(0, 60)
      : !engine.online
        ? "当前离线" + (pendingCount ? " · " + pendingCount + " 条待同步" : "")
        : !token
          ? "登录后自动同步到云端"
          : pendingCount
            ? pendingCount + " 条待同步，稍后自动上传"
            : lastSyncedAt
              ? "已同步 · " + lastSyncedAt.slice(0, 16).replace("T", " ")
              : "本机与云端已同步";

  /** 数据同步行右侧的状态词 + 语义色（与 syncHint 同一批引擎字段） */
  const syncValue = !token
    ? "未登录"
    : engine.syncing
      ? "同步中"
      : engine.lastError
        ? "同步失败"
        : !engine.online
          ? "离线"
          : pendingCount > 0
            ? pendingCount + " 条待同步"
            : "已同步";
  const syncValueColor = !token
    ? colors.textMuted
    : engine.syncing
      ? colors.primary
      : engine.lastError
        ? colors.danger
        : !engine.online
          ? colors.warning
          : pendingCount > 0
            ? colors.accentStrong
            : colors.success;

  /** 身份卡：头像首字母 + 昵称（未登录沿用「学习工作台」文案） */
  const displayName = token ? username || "学习工作台" : "学习工作台";
  const avatarInitial = (username ?? "旅").slice(0, 1).toUpperCase();

  /** 个人卡副标题：专业 · 届别 · 城市（真实资料；缺失时给引导语，不编造） */
  const profileLine = useMemo(() => {
    if (!token) return "";
    const parts: string[] = [];
    if (profileBits?.major) parts.push(profileBits.major);
    if (profileBits?.graduationYear) parts.push(profileBits.graduationYear + " 届");
    if (profileBits?.city) parts.push(profileBits.city);
    if (parts.length > 0) return parts.join(" · ");
    if (profileBits?.targetRole) return "目标 " + profileBits.targetRole;
    return "完善简历资料后显示专业 · 届别 · 城市";
  }, [token, profileBits]);

  /** ② 三格统计：累计专注（sessions）/ 完成任务（tasks.done）/ 获得徽章（已取得证书） */
  const totalFocusMinutes = useMemo(
    () => sessions.reduce((sum, session) => sum + sessionMinutes(session), 0),
    [sessions]
  );
  const doneTasks = useMemo(() => tasks.filter((task) => task.done).length, [tasks]);
  const achievedCerts = useMemo(
    () => (certs ? certs.filter((cert) => cert.status === "achieved") : null),
    [certs]
  );
  const recentBadges = useMemo(() => {
    if (!achievedCerts) return null;
    return [...achievedCerts]
      .sort((a, b) => {
        const ea = a.earnedDate ?? "";
        const eb = b.earnedDate ?? "";
        if (ea !== eb) return eb.localeCompare(ea);
        return b.id - a.id;
      })
      .slice(0, 3);
  }, [achievedCerts]);
  const focusHours = totalFocusMinutes / 60;
  const focusStat =
    totalFocusMinutes >= 60
      ? {
          value: String(focusHours >= 10 ? Math.round(focusHours) : Math.round(focusHours * 10) / 10),
          unit: "h",
        }
      : { value: String(totalFocusMinutes), unit: "m" };
  const statItems = [
    {
      key: "focus",
      label: "累计专注",
      value: focusStat.value,
      unit: focusStat.unit,
      target: "/study-stats",
      accessibilityLabel: "累计专注 " + formatDuration(totalFocusMinutes) + "，打开学习统计",
    },
    {
      key: "tasks",
      label: "完成任务",
      value: String(doneTasks),
      unit: "",
      target: "/tasks",
      accessibilityLabel: "完成任务 " + doneTasks + " 项，打开任务页",
    },
    {
      key: "badges",
      label: "获得徽章",
      value: achievedCerts ? String(achievedCerts.length) : "—",
      unit: "",
      target: "/certificates",
      accessibilityLabel:
        achievedCerts !== null
          ? "获得徽章 " + achievedCerts.length + " 枚，打开证书页"
          : token
            ? "徽章数据暂不可用，打开证书页"
            : "登录后可查看徽章，打开证书页",
    },
  ];

  /** ③ 成长记录热力图（近 14 周，本机 sessions 聚合） */
  const todayKey = localKey(new Date());
  const heatWeeks = useMemo(() => buildHeatWeeks(sessions, todayKey), [sessions, todayKey]);
  const heatActiveDays = useMemo(
    () => heatWeeks.reduce((sum, week) => sum + week.filter((day) => !day.future && day.minutes > 0).length, 0),
    [heatWeeks]
  );

  return (
    <ScrollView
      ref={settingsScrollRef}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: headerTop, paddingBottom: tabBarSpace + spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ① 顶部个人卡（实景带 + 暗场；本屏唯一"实景"主视觉） */}
      <Animated.View entering={entrance(0)}>
        <View style={styles.hero}>
          <Image
            source={require("../../../assets/images/scene-hero.jpg")}
            style={[StyleSheet.absoluteFill, styles.heroImgFill]}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <LinearGradient id="meHeroScrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.focusCanvas} stopOpacity={0.34} />
                <Stop offset="0.42" stopColor={colors.focusCanvas} stopOpacity={0.2} />
                <Stop offset="1" stopColor={colors.focusCanvas} stopOpacity={0.82} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#meHeroScrim)" />
          </Svg>
          <View style={styles.heroInfo}>
            <View style={styles.heroAvatar}>
              {/* 对齐 demo .pic：150° 蓝色渐变（#3C86CE → #1B4F87） */}
              <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
                <Defs>
                  <LinearGradient id="meAvatarGradient" x1="0" y1="0" x2="0.5" y2="1">
                    <Stop offset="0" stopColor="#3C86CE" />
                    <Stop offset="1" stopColor="#1B4F87" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#meAvatarGradient)" />
              </Svg>
              <Text style={styles.heroAvatarText}>{avatarInitial}</Text>
            </View>
            <View style={styles.heroText}>
              <Text style={styles.heroName} numberOfLines={1} accessibilityRole="header">
                {displayName}
              </Text>
              {token ? (
                <Text style={styles.heroSub} numberOfLines={1}>
                  {profileLine}
                </Text>
              ) : (
                <Pressable
                  hitSlop={6}
                  onPress={() => {
                    haptics.light();
                    setAuthOpen(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="登录或注册，登录后自动同步到云端"
                >
                  <Text style={styles.heroSubLink} numberOfLines={1}>
                    登录后自动同步到云端
                  </Text>
                </Pressable>
              )}
            </View>
            <View style={styles.streakPill} accessible accessibilityLabel={"连续打卡 " + streak + " 天"}>
              <ThemedIcon name="flame" size={13} color={colors.focusCanvas} />
              <Text style={styles.streakText} numberOfLines={1}>
                {streak + " 天"}
              </Text>
            </View>
          </View>
        </View>
        {msg ? (
          <Surface tier="surface" corner={radius.md} padded={false} style={styles.msgBar}>
            <ThemedIcon name="checkmark-circle" size={15} color={colors.success} />
            <Text style={styles.msg} numberOfLines={3}>
              {msg}
            </Text>
          </Surface>
        ) : null}
      </Animated.View>

      {/* ② 三格统计（真实数据；每格都能进到对应明细页） */}
      <Animated.View entering={entrance(1)}>
        <Surface tier="elevated" corner={radius.lg} padded={false} style={styles.statsCard}>
          <View style={styles.statsRow}>
            {statItems.map((item, index) => (
              <Pressable
                key={item.key}
                hitSlop={4}
                onPress={() => {
                  haptics.light();
                  router.push(item.target as never);
                }}
                style={({ pressed }) => [
                  styles.statCell,
                  index > 0 && styles.statCellBorder,
                  pressed && styles.statCellPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={item.accessibilityLabel}
              >
                <Text
                  style={[styles.statValue, tabularNums]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {item.value}
                  {item.unit ? <Text style={styles.statUnit}>{item.unit}</Text> : null}
                </Text>
                <Text style={styles.statLabel} numberOfLines={1}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Surface>
      </Animated.View>

      {/* ③ 成长记录：近 14 周每日专注热力格 + 少↔多图例（点开学习统计） */}
      <Animated.View entering={entrance(2)}>
        <PressableScale
          haptic
          scaleTo={0.99}
          hitSlop={4}
          onPress={() => {
            haptics.light();
            router.push("/study-stats" as never);
          }}
          accessibilityRole="button"
          accessibilityLabel={"成长记录，近 14 周每日专注，共 " + heatActiveDays + " 天有记录，打开学习统计"}
          style={styles.heatPress}
        >
          <Surface tier="surface" corner={radius.card} padded={false} style={styles.heatCard}>
            <View style={styles.heatHead}>
              <Text style={styles.heatTitle}>成长记录</Text>
              <Text style={styles.heatMeta}>近 14 周 · 每日专注</Text>
            </View>
            <View style={styles.heatGrid}>
              {heatWeeks.map((week) => (
                <View key={week[0]?.key ?? "week"} style={styles.heatCol}>
                  {week.map((day) => {
                    const level = heatLevelOf(day.minutes);
                    const background = day.future
                      ? heatBackgroundOf(0, colors)
                      : day.key === todayKey
                        ? level > 0
                          ? colors.accent
                          : colors.accentSoft
                        : heatBackgroundOf(level, colors);
                    return (
                      <View
                        key={day.key}
                        style={[styles.heatCell, day.future && styles.heatCellFuture, { backgroundColor: background }]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
            <View style={styles.heatLegend}>
              <Text style={styles.heatLegendText}>少</Text>
              {[0, 1, 2, 3, 4].map((level) => (
                <View key={level} style={[styles.heatSwatch, { backgroundColor: heatBackgroundOf(level, colors) }]} />
              ))}
              <Text style={styles.heatLegendText}>多</Text>
            </View>
          </Surface>
        </PressableScale>
      </Animated.View>

      {/* ④ 最近获得：已取得证书最近 3 枚（现有成就数据；无数据给空态，不编造） */}
      <Animated.View entering={entrance(3)}>
        <SectionTitle
          title="最近获得"
          actionLabel={achievedCerts ? "共 " + achievedCerts.length + " 枚" : "查看全部"}
          onAction={() => {
            haptics.light();
            router.push("/certificates" as never);
          }}
        />
        {recentBadges && recentBadges.length > 0 ? (
          <View style={styles.badgeRow}>
            {recentBadges.map((cert, index) => {
              const tone = badgeToneOf(colors, index);
              return (
                <PressableScale
                  key={cert.id}
                  haptic
                  scaleTo={0.97}
                  hitSlop={4}
                  onPress={() => {
                    haptics.light();
                    router.push("/certificates" as never);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    "已获得证书 " + cert.name + "，" + earnedDateFull(cert.earnedDate) + "，打开证书页"
                  }
                  style={styles.badgeSlot}
                >
                  <Surface tier="elevated" corner={radius.lg} padded={false} style={styles.badgeCard}>
                    <View style={[styles.badgeIcon, { backgroundColor: tone.soft }]}>
                      <ThemedIcon name={BADGE_ICONS[index % BADGE_ICONS.length]} size={17} color={tone.strong} />
                    </View>
                    <Text style={styles.badgeTitle} numberOfLines={2}>
                      {cert.name}
                    </Text>
                    <Text style={styles.badgeDate} numberOfLines={1}>
                      {earnedDateText(cert.earnedDate)}
                    </Text>
                  </Surface>
                </PressableScale>
              );
            })}
          </View>
        ) : (
          <PressableScale
            haptic
            scaleTo={0.99}
            hitSlop={4}
            onPress={() => {
              haptics.light();
              router.push("/certificates" as never);
            }}
            accessibilityRole="button"
            accessibilityLabel="打开证书页"
            style={styles.badgeEmptySlot}
          >
            <Surface tier="surface" corner={radius.card} padded={false} style={styles.badgeEmpty}>
              <ThemedIcon name="ribbon-outline" size={20} color={colors.textFaint} />
              <Text style={styles.badgeEmptyText}>
                {achievedCerts === null
                  ? token
                    ? "证书数据暂不可用"
                    : "登录后可查看已获得的证书"
                  : "还没有已取得的证书"}
              </Text>
              <Text style={styles.badgeEmptyHint}>
                {achievedCerts === null
                  ? "点此打开证书页"
                  : "在证书页把状态标记为「已取得」，这里就会亮起来"}
              </Text>
            </Surface>
          </PressableScale>
        )}
      </Animated.View>

      {/* ⑤ 设置：数据同步 / 学习提醒 / 外观与主题 / 关于 Workbench */}
      <Animated.View entering={entrance(4)}>
        <SectionTitle title="设置" />
        <GroupCard style={styles.listCard}>
          <SettingsRow
            icon="cloud-upload-outline"
            iconColor={colors.primary}
            title="数据同步"
            subtitle="推送与拉取 · 云端账号"
            value={syncValue}
            valueColor={syncValueColor}
            valueDotColor={token ? syncValueColor : undefined}
            showChevron
            onPress={() => {
              haptics.light();
              setSyncOpen(true);
            }}
            accessibilityLabel={"数据同步，" + syncValue + "，" + syncHint + "，点此查看同步详情"}
          />
          <SettingsRow
            icon="alert-circle"
            iconColor={colors.textSecondary}
            title="学习提醒"
            subtitle="通知权限在系统设置中开启"
            value="系统设置"
            showChevron
            onPress={() => void Linking.openSettings().catch(() => {})}
            accessibilityLabel="学习提醒，通知权限在系统设置中开启，点此打开系统设置"
          />
          <SettingsRow
            icon="color-palette-outline"
            iconColor={colors.textSecondary}
            title="外观与主题"
            value={themeLabel}
            showChevron
            onPress={() => {
              haptics.light();
              setThemeOpen(true);
            }}
            accessibilityLabel={"外观与主题，当前" + themeLabel + "，点此选择主题"}
          />
          <SettingsRow
            icon="information-circle-outline"
            iconColor={colors.textSecondary}
            title="关于 Workbench"
            subtitle="检查更新 · 隐私政策 · 备案信息"
            value={"v" + APP_VERSION_NAME}
            showChevron
            last
            onPress={() => {
              haptics.light();
              setAboutOpen(true);
            }}
            accessibilityLabel={"关于 Workbench，当前版本 " + APP_VERSION_NAME + "，点此查看"}
          />
        </GroupCard>
      </Animated.View>

      {/* ⑥ 账户与偏好：每日背景 / 动效 / 字体大小 / 学习领域（全部原设置项） */}
      <Animated.View entering={entrance(5)}>
        <SectionTitle title="账户与偏好" />
        <GroupCard style={styles.listCard}>
          <SettingsRow
            icon="image-outline"
            iconColor={colors.teal}
            title="每日背景图"
            subtitle="每天自动更换风景壁纸"
            right={
              <Switch
                value={backgroundEnabled}
                onValueChange={toggleBackground}
                trackColor={{ true: colors.primary }}
                accessibilityLabel="每日背景图"
                accessibilityRole="switch"
                accessibilityState={{ checked: backgroundEnabled }}
              />
            }
          />
          {/* v1.62 P2-2：动效开关（真实生效，关掉后全 App 装饰动效停止） */}
          <SettingsRow
            icon="sparkles-outline"
            iconColor={colors.lavender}
            title="动效"
            subtitle={
              motionEnabled
                ? "入场、按压与庆祝动画正常播放"
                : "已关闭 · 所有装饰动效停用（等同系统「减弱动态」）"
            }
            right={
              <Switch
                value={motionEnabled}
                onValueChange={toggleMotion}
                trackColor={{ true: colors.primary }}
                accessibilityLabel={motionEnabled ? "动效已开启，点此关闭" : "动效已关闭，点此开启"}
                accessibilityRole="switch"
                accessibilityState={{ checked: motionEnabled }}
              />
            }
          />
          {/* 字体大小：不做假开关，直接跳系统设置改字号 */}
          <SettingsRow
            icon="options-outline"
            iconColor={colors.primary}
            title="字体大小"
            subtitle="在系统设置中调整字号后返回生效"
            value={"跟随系统 · " + formatFontScale(fontScale)}
            showChevron
            last={domains.length === 0}
            onPress={() => void Linking.openSettings().catch(() => {})}
            accessibilityLabel={"字体大小跟随系统，当前 " + formatFontScale(fontScale) + "，点此打开系统设置"}
          />
          {/* 学习领域：保留全部切换逻辑（PUT /api/settings/career） */}
          {domains.length > 0 ? (
            <View style={styles.domainBlock}>
              <Text style={styles.domainLabel}>学习领域</Text>
              <View style={styles.domainChips}>
                {domains.map((c) => {
                  const active = c.career_key === career;
                  return (
                    <Pressable
                      key={c.career_key}
                      onPress={() => void switchCareer(c.career_key)}
                      hitSlop={4}
                      style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={"学习领域：" + c.name + (active ? "，当前" : "")}
                    >
                      <Text style={active ? styles.chipTextActive : styles.chipTextIdle}>{c.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </GroupCard>
      </Animated.View>

      {/* ⑦ 工具：领域管理 / 记录 / 打卡 / 诊断 / 清空本机数据（检查更新等已收进「关于」弹层） */}
      <Animated.View entering={entrance(6)}>
        <SectionTitle title="工具" />
        <GroupCard style={styles.listCard}>
          {token ? (
            <SettingsRow
              icon="layers-outline"
              iconColor={colors.primary}
              title="领域管理"
              subtitle="新建 / 归档 / 从模板创建"
              showChevron
              onPress={() => {
                haptics.light();
                router.push("/domain-manager");
              }}
            />
          ) : null}
          <SettingsRow
            icon="stats-chart-outline"
            iconColor={colors.success}
            title="领域记录"
            subtitle="通用计量与按日打卡"
            showChevron
            onPress={() => {
              haptics.light();
              router.push("/trackers");
            }}
          />
          <SettingsRow
            icon="checkmark-circle"
            iconColor={colors.accent}
            title="习惯与打卡"
            subtitle="连续天数 · 13 周热力图"
            showChevron
            onPress={() => {
              haptics.light();
              router.push("/habits");
            }}
          />
          <SettingsRow
            icon="pulse-outline"
            iconColor={colors.primary}
            title="问题诊断"
            subtitle="点不动 / 白屏时跑一次触摸自检"
            showChevron
            onPress={() => {
              haptics.light();
              router.push("/diagnostics");
            }}
          />
          <SettingsRow
            icon="trash-outline"
            iconColor={colors.danger}
            title="清空本机数据"
            subtitle={
              "进度 " +
              Object.values(progress).filter((x) => x.done).length +
              " · 任务 " +
              tasks.length +
              " · 日志 " +
              logs.length
            }
            last
            onPress={confirmReset}
            accessibilityLabel="清空本机数据，点此确认重置"
          />
        </GroupCard>
      </Animated.View>

      {/* ⑧ 账号：账号安全 / 设备时钟偏差 / 退出登录（同步详情在「数据同步」弹层） */}
      <Animated.View entering={entrance(7)}>
        <SectionTitle title="账号" />
        <GroupCard style={styles.listCard}>
          <SettingsRow
            icon="shield-checkmark-outline"
            iconColor={colors.primary}
            title="账号与安全"
            subtitle="密码 · 微信绑定 · 登录设备"
            value={token ? "已登录" : "未登录"}
            showChevron
            onPress={() => {
              haptics.light();
              if (token) router.push("/account-security");
              else setAuthOpen(true);
            }}
            accessibilityLabel={"账号与安全，" + (token ? "已登录" : "未登录") + "，点此打开"}
          />
          {/* S5-3：设备时钟偏移 >5min 时提示校准（游标只认 serverTime，但本地 updatedAt 会受时钟影响） */}
          {token && clock.skewed ? (
            <SettingsRow
              icon="time-outline"
              iconColor={colors.warning}
              title="设备时间与服务器不一致"
              subtitle={clockSkewHint(clock.offsetMs) + "，可能影响同步；请开启系统「自动设置时间」"}
              value="需校准"
              valueColor={colors.warning}
              onPress={() => void Linking.openSettings().catch(() => {})}
              accessibilityLabel="设备时间与服务器不一致，需校准，点此打开系统设置"
            />
          ) : null}
          {token ? (
            <SettingsRow
              icon="log-out-outline"
              iconColor={colors.danger}
              title="退出登录"
              subtitle="清除本机数据并回到未登录状态"
              last
              onPress={confirmLogout}
              accessibilityLabel="退出登录，点此确认"
            />
          ) : (
            <SettingsRow
              icon="log-in-outline"
              iconColor={colors.primary}
              title="登录 / 注册"
              subtitle="登录后自动同步到云端"
              last
              onPress={() => {
                haptics.light();
                setAuthOpen(true);
              }}
            />
          )}
        </GroupCard>
      </Animated.View>

      <View style={styles.footerBlock}>
        <Text style={styles.footerName}>Learn-Workbench · 苦旅</Text>
        <Text style={styles.footerVersion}>{"移动端 v" + APP_VERSION_NAME}</Text>
        <Text style={styles.footerNote}>移动端默认连接生产域名，招聘爬虫配置请在 Web 端完成。</Text>
        <Text style={styles.footerNote}>© 苦旅 · 学习工作台 · Expo + React Native</Text>
      </View>

      {/* 数据同步弹层：同步状态 + 待同步条数 + 上次同步 + 时钟偏差 + 推送/拉取（保留原按钮） */}
      <BottomSheet
        visible={syncOpen}
        onClose={() => setSyncOpen(false)}
        onClosed={() => {
          if (pendingAuthAfterSync) {
            setPendingAuthAfterSync(false);
            setAuthOpen(true);
          }
        }}
        title="数据同步"
        subtitle={syncHint}
        icon="cloud-upload-outline"
        height="62%"
      >
        <GroupCard style={styles.listCard}>
          <SettingsRow
            icon="pulse-outline"
            iconColor={colors.primary}
            title="同步状态"
            value={syncValue}
            valueColor={syncValueColor}
            valueDotColor={token ? syncValueColor : undefined}
          />
          <SettingsRow
            icon="cloud-upload-outline"
            iconColor={colors.primary}
            title="待同步变更"
            value={pendingCount + " 条"}
          />
          <SettingsRow
            icon="time-outline"
            iconColor={colors.textSecondary}
            title="上次同步"
            value={lastSyncedAt ? lastSyncedAt.slice(0, 16).replace("T", " ") : "—"}
            last={!(token && clock.skewed)}
          />
          {token && clock.skewed ? (
            <SettingsRow
              icon="time-outline"
              iconColor={colors.warning}
              title="设备时间与服务器不一致"
              subtitle={clockSkewHint(clock.offsetMs)}
              value="需校准"
              valueColor={colors.warning}
              last
            />
          ) : null}
        </GroupCard>
        {token ? (
          <ButtonRow style={styles.sheetActions}>
            <Button label="同步到云端" onPress={doPush} loading={busy} icon="cloud-upload-outline" />
            <Button label="从云端恢复" variant="secondary" onPress={doPull} disabled={busy} />
          </ButtonRow>
        ) : (
          <Button
            label="登录 / 注册"
            icon="log-in-outline"
            style={styles.sheetActions}
            onPress={() => {
              setPendingAuthAfterSync(true);
              setSyncOpen(false);
            }}
          />
        )}
        {msg ? <Text style={styles.msgLine}>{msg}</Text> : null}
      </BottomSheet>

      {/* 外观与主题弹层：日夜开关快捷切换 + 三档主题（保留「跟随系统」） */}
      <BottomSheet visible={themeOpen} onClose={() => setThemeOpen(false)} title="外观与主题" height="60%">
        <GroupCard style={styles.listCard}>
          <SettingsRow
            icon="swap-horizontal"
            iconColor={colors.primary}
            title="快速切换"
            subtitle="浅色 ↔ 深色"
            right={
              <DayNightSwitch
                value={dark ? "dark" : "light"}
                onChange={(next) => {
                  haptics.soft();
                  setThemeMode(next);
                }}
              />
            }
          />
          {(["light", "dark", "system"] as ThemeMode[]).map((m, i, list) => {
            const label = m === "light" ? "浅色" : m === "dark" ? "深色" : "跟随系统";
            const active = themeMode === m;
            return (
              <SettingsRow
                key={m}
                icon={m === "light" ? "sunny" : m === "dark" ? "moon-outline" : "options-outline"}
                iconColor={active ? colors.primary : colors.textSecondary}
                title={label}
                value={active ? "当前" : undefined}
                valueColor={active ? colors.primary : undefined}
                accessibilityState={{ selected: active }}
                last={i === list.length - 1}
                onPress={() => {
                  haptics.soft();
                  setThemeMode(m);
                  setThemeOpen(false);
                }}
              />
            );
          })}
        </GroupCard>
      </BottomSheet>

      {/* 关于弹层：检查更新 / 手动下载 / 隐私与数据 / 隐私政策 / 备案（原「工具」里的条目全部保留） */}
      <BottomSheet
        visible={aboutOpen}
        onClose={() => setAboutOpen(false)}
        onClosed={() => {
          if (pendingUpdateCheck) {
            setPendingUpdateCheck(false);
            void checkUpdate();
          }
        }}
        title="关于 Workbench"
        subtitle={"苦旅 v" + APP_VERSION_NAME}
        icon="information-circle-outline"
        height="70%"
      >
        <GroupCard style={styles.listCard}>
          <SettingsRow
            icon="refresh"
            iconColor={colors.success}
            title="检查更新"
            subtitle="支持应用内 OTA 推送"
            value={updateState === "checking" ? undefined : updateLabel}
            valueColor={updateState === "update" ? colors.accentStrong : undefined}
            showChevron={updateState !== "checking"}
            right={updateState === "checking" ? <ActivityIndicator size="small" color={colors.primary} /> : undefined}
            disabled={updateState === "checking"}
            accessibilityState={{ disabled: updateState === "checking" }}
            onPress={() => {
              setPendingUpdateCheck(true);
              setAboutOpen(false);
            }}
          />
          <SettingsRow
            icon="cloud-download-outline"
            iconColor={colors.primary}
            title="手动下载最新版"
            subtitle="打不开更新时用这个"
            showChevron
            onPress={() => void Linking.openURL(DOWNLOAD_PAGE_URL).catch(() => {})}
          />
          <SettingsRow
            icon="lock-closed-outline"
            iconColor={colors.textSecondary}
            title="隐私与数据"
            subtitle="数据只在本机与你的云端账号之间流转"
            showChevron
            onPress={() => void Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
          />
          <SettingsRow
            icon="document-text-outline"
            iconColor={colors.textSecondary}
            title="隐私政策"
            showChevron
            onPress={() => void Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
          />
          <SettingsRow
            icon="information-circle-outline"
            iconColor={colors.textSecondary}
            title={"苦旅 v" + APP_VERSION_NAME}
            subtitle={"App 备案：" + APP_ICP_NUMBER}
            showChevron
            last={!APP_MPS_NUMBER}
            onPress={() => void Linking.openURL(ICP_VERIFY_URL).catch(() => {})}
          />
          {APP_MPS_NUMBER ? (
            <SettingsRow
              icon="shield-checkmark-outline"
              iconColor={colors.textSecondary}
              title="公安联网备案"
              subtitle={APP_MPS_NUMBER}
              showChevron
              last
              onPress={() =>
                void Linking.openURL(MPS_VERIFY_URL + APP_MPS_NUMBER.replace(/[^0-9]/g, "")).catch(() => {})
              }
            />
          ) : null}
        </GroupCard>
        <Text style={styles.sheetNote}>移动端默认连接生产域名，招聘爬虫配置请在 Web 端完成。</Text>
      </BottomSheet>

      <AuthSheet visible={authOpen} onClose={() => setAuthOpen(false)} onAuthed={handleAuthed} />
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    /** v2.2.2：本页没有外层 View，ScrollView 就是根容器 → 直接垫 canvas（不再 transparent） */
    scroll: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: 17 },

    /* ① 个人卡（实景带高度对齐今日页的实景带 158，暗场保证白字可读） */
    /** Web 上 react-native-web 会按原图尺寸布局绝对定位图片（导致只看左上角）：显式 100% 让 cover 生效 */
    heroImgFill: { width: "100%", height: "100%" },
    /* 对齐 demo .me-hero：高 146、圆角 24（旧值 158/22） */
    hero: {
      height: 146,
      borderRadius: 24,
      overflow: "hidden",
      ...shadows.card,
    },
    heroInfo: {
      position: "absolute",
      left: 15,
      right: 15,
      bottom: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
    },
    heroAvatar: {
      width: 50,
      height: 50,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      backgroundColor: colors.primary, // 渐变层未就绪时的兜底
      borderWidth: 1.5,
      borderColor: colors.glassBorder,
      flexShrink: 0,
    },
    heroAvatarText: { ...typography.hero, fontWeight: "700", color: "#FFFFFF" },
    heroText: { flex: 1, minWidth: 0, gap: 3 },
    heroName: { ...typography.headline, fontWeight: "700", color: "#FFFFFF" },
    heroSub: { ...typography.meta, color: "rgba(255,255,255,0.82)" },
    heroSubLink: { ...typography.meta, fontWeight: "600", color: "rgba(255,255,255,0.92)" },
    streakPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      height: 26,
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      flexShrink: 0,
    },
    streakText: { ...typography.micro, fontWeight: "700", color: colors.focusCanvas },

    /* 状态提示条（保留原身份卡里的操作反馈） */
    msgBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 1,
    },
    msg: { ...typography.meta, fontWeight: "600", color: colors.success, flex: 1, minWidth: 0 },
    /** 弹层内没有 message 行的 flex 上下文，单独一条居中提示 */
    msgLine: { ...typography.meta, fontWeight: "600", color: colors.success, textAlign: "center", marginTop: spacing.md },

    /* ② 三格统计 */
    statsCard: { marginTop: spacing.md + 2 },
    statsRow: { flexDirection: "row", paddingVertical: spacing.md + 1 },
    statCell: { flex: 1, alignItems: "center", gap: 3, paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
    statCellBorder: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.border,
    },
    statCellPressed: { opacity: 0.7 },
    statValue: { ...typography.num, color: colors.text },
    statUnit: { ...typography.meta, fontWeight: "600", color: colors.textMuted },
    statLabel: { ...typography.meta, color: colors.textMuted },

    /* ③ 成长记录热力图 */
    heatPress: { marginTop: spacing.md + 2, borderRadius: radius.card },
    heatCard: { paddingHorizontal: spacing.lg - 1, paddingVertical: spacing.lg - 1 },
    heatHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
    heatTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    heatMeta: { ...typography.micro, fontWeight: "500", color: colors.textMuted },
    heatGrid: { flexDirection: "row", gap: 3, marginTop: spacing.md },
    heatCol: { flex: 1, gap: 3 },
    heatCell: { width: "100%", aspectRatio: 1, borderRadius: radius.sm / 2 },
    heatCellFuture: { opacity: 0.35 },
    heatLegend: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 4,
      marginTop: spacing.sm + 1,
    },
    heatLegendText: { ...typography.meta, color: colors.textMuted },
    heatSwatch: { width: 8, height: 8, borderRadius: radius.sm / 4 },

    /* ④ 最近获得（徽章 = 已取得证书） */
    badgeRow: { flexDirection: "row", gap: 9 },
    badgeSlot: { flex: 1 },
    badgeCard: { alignItems: "center", paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.md },
    badgeIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.sm,
    },
    badgeTitle: { ...typography.caption, fontWeight: "700", color: colors.text, textAlign: "center" },
    badgeDate: { ...typography.meta, color: colors.textMuted, marginTop: 3, textAlign: "center" },
    badgeEmptySlot: { marginTop: 0 },
    badgeEmpty: {
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg + 2,
    },
    badgeEmptyText: { ...typography.callout, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },
    badgeEmptyHint: { ...typography.meta, color: colors.textMuted, textAlign: "center" },

    /* ⑤ 设置列表卡（提案 .list：padding 2 / 14，行内 divider 由行自己画） */
    listCard: { paddingHorizontal: spacing.lg - 2, paddingVertical: 2 },
    row: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: 13,
    },
    rowPressed: { backgroundColor: colors.surfaceMuted },
    iconChip: {
      width: 30,
      height: 30,
      borderRadius: radius.control - 2,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
      flexShrink: 0,
    },
    rowText: { flex: 1, minWidth: 0, gap: 2 },
    rowTitle: { ...typography.callout, fontWeight: "600", color: colors.text },
    rowTitleOff: { color: colors.textFaint },
    rowSubtitle: { ...typography.meta, color: colors.textMuted },
    rowValueWrap: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
    rowValue: { ...typography.meta, fontWeight: "700", color: colors.textMuted, flexShrink: 1, textAlign: "right" },
    rowValueDot: { width: 6, height: 6, borderRadius: 3 },
    rowDivider: {
      position: "absolute",
      bottom: 0,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },

    /* 学习领域内嵌块：chip 命中区 40 + hitSlop 4 = 48 */
    domainBlock: { gap: spacing.sm + 2, paddingVertical: spacing.md + 2 },
    domainLabel: { ...typography.meta, fontWeight: "700", color: colors.textMuted },
    domainChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
      minHeight: 40,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md + 2,
      paddingVertical: spacing.sm,
      justifyContent: "center",
    },
    chipActive: { backgroundColor: colors.primary },
    chipIdle: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipTextActive: { ...typography.caption, fontWeight: "700", color: "#FFFFFF" },
    chipTextIdle: { ...typography.caption, color: colors.text },

    /* 弹层内动作与说明 */
    sheetActions: { marginTop: spacing.md },
    sheetNote: { ...typography.meta, color: colors.textFaint, textAlign: "center", marginTop: spacing.md },

    footerBlock: { marginTop: spacing.xl, paddingHorizontal: spacing.xs, gap: 3 },
    footerName: { ...typography.caption, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },
    footerVersion: { ...typography.meta, color: colors.textMuted, textAlign: "center" },
    footerNote: { ...typography.meta, color: colors.textFaint, textAlign: "center" },
  });
