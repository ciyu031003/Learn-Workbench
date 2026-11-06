import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useHeaderTopInset } from "@/components/screen-header";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";
import { addDaysToDateKey, computeStreak, todayISOInZone } from "@learn-workbench/shared/domains";
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
import { Surface } from "@/components/surface";
import { PageHead } from "@/components/v2/page-head";
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
import { radius, spacing, tabularNums, typography } from "@/theme/tokens";
import { setMotionUserEnabled } from "@/theme/motion";

/**
 * 「我的」设置页（v2.0 UI 重构 · 2026-11）。
 *
 * 版式：PageHead（eyebrow / 标题 / 说明）→ 身份卡（本屏唯一 glassStrong 视觉锚点）→
 * 「账户与偏好 / 工具 / 账号」三张分组卡（行高 58、图标芯片 surfaceMuted、右侧值或 chevron）。
 *
 * 纪律（v1.62 起沿用，本轮只换版式）：
 * - 所有设置项、开关、跳转与处理逻辑保持原样（登录/退出、手动同步、主题弹层与日夜开关、
 *   每日背景、动效、字体大小、通知权限、学习领域切换、检查更新/OTA、诊断、隐私与备案链接、
 *   同步状态、时钟偏差、清空本机数据），逐项保留；
 * - 不写裸 fontSize（全部走 typography token）；颜色只取 useTheme().colors；
 * - 不新增动效调用点：入场沿用 useScreenEntrance，按压沿用 PressableScale / 原生 Switch；
 * - 命中区 ≥44（行高 58、chip 40 + hitSlop、按钮 48）；320pt / 130% 字号不溢出。
 */

type IconName = ComponentProps<typeof ThemedIcon>["name"];

/** 周一为一周起点：返回 todayKey 所在周的周一日期键（纯日历运算；业务日期口径见 shared/domains） */
function weekStartKey(todayKey: string): string {
  const year = Number(todayKey.slice(0, 4));
  const month = Number(todayKey.slice(5, 7)) - 1;
  const day = Number(todayKey.slice(8, 10));
  const weekday = new Date(Date.UTC(year, month, day)).getUTCDay(); // 0 = 周日
  return addDaysToDateKey(todayKey, -((weekday + 6) % 7));
}

/**
 * v2 分组卡：白色实底 + 细描边（层级靠色场与描边，不叠投影），内部分隔线由行自己画。
 */
function GroupCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Surface tier="surface" corner={radius.card} padded={false} style={style}>
      {children}
    </Surface>
  );
}

/**
 * v2 设置行：图标芯片(34, surfaceMuted) + 标题/副标题 + 右侧值或控件 + chevron。
 * 无 onPress 时退化为纯展示行（开关行、状态行）；有 onPress 时整行可点（按压只换底色，不缩放）。
 */
function SettingsRow({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  valueColor,
  right,
  onPress,
  showChevron = false,
  last = false,
  disabled = false,
  accessibilityLabel,
  style,
}: {
  icon?: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  valueColor?: string;
  right?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  last?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const body = (
    <>
      {icon ? (
        <View style={styles.iconChip}>
          <ThemedIcon name={icon} size={18} color={iconColor ?? colors.primary} />
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
        <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {showChevron ? <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} /> : null}
      {!last ? (
        <View pointerEvents="none" style={[styles.rowDivider, { left: icon ? 62 : spacing.lg }]} />
      ) : null}
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
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
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
  /** 系统字号倍数（只读展示；改字号走系统设置，见「字体大小」行）。
   *  P2 遗留修复：改为订阅 Dimensions/AppState 实时刷新，去系统设置改完返回立即更新。 */
  const fontScale = useFontScale();
  const resetAll = useAppStore((s) => s.resetAll);
  const resetForLogout = useAppStore((s) => s.resetForLogout);
  const progress = useAppStore((s) => s.progress);
  const tasks = useAppStore((s) => s.tasks);
  const logs = useAppStore((s) => s.logs);
  /** 身份卡「连续打卡天数」：与今日页/Web 同源（shared/domains 东八区口径） */
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

  const [domains, setDomains] = useState<{ career_key: string; name: string; kind?: string; kind_label?: string }[]>([]);
  const [career, setCareer] = useState("ict");

  /**
   * 身份卡两枚统计（只用本机既有数据，不新增接口）：
   * - 今日完成：今天到期的任务里已完成条数（与今日页 todayDone 同源）；
   * - 本周打卡：本周（周一起）checkins 条数（东八区业务日期口径）。
   */
  const today = todayISOInZone();
  const todayDone = useMemo(() => tasks.filter((t) => t.taskDate === today && t.done).length, [tasks, today]);
  const weekCheckins = useMemo(() => {
    const start = weekStartKey(today);
    return checkins.filter((d) => d >= start && d <= today).length;
  }, [checkins, today]);

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
    setMsg(`欢迎回来，${username}：本机数据将自动同步云端`);
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
      setMsg(dropped > 0 ? `已退出登录（丢弃 ${dropped} 条非本账号待同步变更）` : "已退出登录，本机数据已清理");
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
      Alert.alert("已是最新版本", `当前版本：苦旅 v${APP_VERSION_NAME}`, [
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
          : `v${APP_VERSION_NAME}`;
  const syncHint = engine.syncing
    ? "正在同步…"
    : engine.lastError
      ? `上次同步失败：${engine.lastError.slice(0, 60)}`
      : !engine.online
        ? `当前离线${pendingCount ? ` · ${pendingCount} 条待同步` : ""}`
        : !token
          ? "登录后自动同步到云端"
          : pendingCount
            ? `${pendingCount} 条待同步，稍后自动上传`
            : lastSyncedAt
              ? `已同步 · ${lastSyncedAt.slice(0, 16).replace("T", " ")}`
              : "本机与云端已同步";

  /** 身份卡：头像首字母 + 昵称（未登录沿用「学习工作台」文案） */
  const displayName = token ? username || "学习工作台" : "学习工作台";
  const avatarInitial = (username ?? "旅").slice(0, 1).toUpperCase();

  return (
    <ScrollView
      ref={settingsScrollRef}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ① 页头：eyebrow + 27px 标题 + 一句说明 */}
      <Animated.View entering={entrance(0)} style={{ paddingTop: headerTop }}>
        <PageHead
          eyebrow="PERSONAL WORKSPACE"
          title="我的"
          subtitle="管理个人目标、数据偏好与工作台设置。"
        />
      </Animated.View>

      {/* ② 身份卡（本屏唯一 glassStrong 视觉锚点）：头像 + 昵称 + 今日/本周统计；未登录引导登录 */}
      <Animated.View entering={entrance(1)}>
        <Surface tier="glassStrong" corner={radius.card} style={styles.profile}>
          <View style={styles.profileHead}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarInitial}</Text>
            </View>
            <View style={styles.profileBody}>
              <View style={styles.profileTitleRow}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {displayName}
                </Text>
                {streak > 0 ? (
                  <View style={styles.streakPill}>
                    <ThemedIcon name="flame" size={11} color={colors.accent} />
                    <Text style={styles.streakText} numberOfLines={1}>{`${streak} 天`}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.profileStats, tabularNums]} numberOfLines={2}>
                {`今日完成 ${todayDone} 项 · 本周打卡 ${weekCheckins} 次`}
              </Text>
              {token ? null : (
                <Text style={styles.profileHint} numberOfLines={1}>
                  登录后自动同步到云端
                </Text>
              )}
            </View>
          </View>
          {token ? (
            <ButtonRow>
              <Button label="同步到云端" onPress={doPush} loading={busy} icon="cloud-upload-outline" />
              <Button label="从云端恢复" variant="secondary" onPress={doPull} disabled={busy} />
            </ButtonRow>
          ) : (
            <Button
              label="登录 / 注册"
              icon="log-in-outline"
              onPress={() => {
                haptics.light();
                setAuthOpen(true);
              }}
            />
          )}
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        </Surface>
      </Animated.View>

      {/* ③ 账户与偏好：主题 / 每日背景 / 动效 / 字体大小 / 通知权限 / 学习领域 */}
      <Animated.View entering={entrance(2)}>
        <SectionTitle title="账户与偏好" />
      </Animated.View>
      <GroupCard>
        <SettingsRow
          icon="color-palette-outline"
          iconColor={colors.primary}
          title="主题"
          /* 值放进副标题：右侧已被日夜开关占位，避免 320pt 下标题区被挤成 4 字宽 */
          subtitle={`当前：${themeLabel}`}
          /* v13 U9：日夜开关负责"浅 ↔ 深"两态；"跟随系统"仍在三档弹层里（API 不变） */
          right={
            <DayNightSwitch
              value={dark ? "dark" : "light"}
              onChange={(next) => {
                haptics.soft();
                setThemeMode(next);
              }}
            />
          }
          showChevron
          onPress={() => setThemeOpen(true)}
        />
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
          onPress={() => void Linking.openSettings().catch(() => {})}
          accessibilityLabel={"字体大小跟随系统，当前 " + formatFontScale(fontScale) + "，点此打开系统设置"}
        />
        {/* 通知权限：本工程未接 expo-notifications（不新增依赖），只做系统设置入口，不伪造状态开关 */}
        <SettingsRow
          icon="alert-circle"
          iconColor={colors.accent}
          title="通知权限"
          subtitle="在系统设置中开启"
          showChevron
          onPress={() => void Linking.openSettings().catch(() => {})}
          last={domains.length === 0}
          accessibilityLabel="通知权限，在系统设置中开启，点此打开系统设置"
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
                    accessibilityLabel={`学习领域：${c.name}${active ? "，当前" : ""}`}
                  >
                    <Text style={active ? styles.chipTextActive : styles.chipTextIdle}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </GroupCard>

      {/* ④ 工具：领域 / 学习记录 / 诊断 / 更新 / 隐私与关于 / 清空本机数据 */}
      <Animated.View entering={entrance(3)}>
        <SectionTitle title="工具" />
      </Animated.View>
      <GroupCard>
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
          icon="refresh"
          iconColor={colors.success}
          title="检查更新"
          subtitle="支持应用内 OTA 推送"
          value={updateState === "checking" ? undefined : updateLabel}
          valueColor={updateState === "update" ? colors.accentStrong : undefined}
          showChevron={updateState !== "checking"}
          right={updateState === "checking" ? <ActivityIndicator size="small" color={colors.primary} /> : undefined}
          disabled={updateState === "checking"}
          onPress={() => void checkUpdate()}
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
          iconColor={colors.textMuted}
          title="隐私与数据"
          subtitle="数据只在本机与你的云端账号之间流转"
          showChevron
          onPress={() => void Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
        />
        <SettingsRow
          icon="information-circle-outline"
          iconColor={colors.textMuted}
          title={`苦旅 v${APP_VERSION_NAME}`}
          subtitle={`App 备案：${APP_ICP_NUMBER}`}
          showChevron
          onPress={() => void Linking.openURL(ICP_VERIFY_URL).catch(() => {})}
        />
        {APP_MPS_NUMBER ? (
          <SettingsRow
            icon="shield-checkmark-outline"
            iconColor={colors.textMuted}
            title="公安联网备案"
            subtitle={APP_MPS_NUMBER}
            showChevron
            onPress={() =>
              void Linking.openURL(MPS_VERIFY_URL + APP_MPS_NUMBER.replace(/[^0-9]/g, "")).catch(() => {})
            }
          />
        ) : null}
        <SettingsRow
          icon="document-text-outline"
          iconColor={colors.textMuted}
          title="隐私政策"
          showChevron
          onPress={() => void Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
        />
        <SettingsRow
          icon="trash-outline"
          iconColor={colors.danger}
          title="清空本机数据"
          subtitle={`进度 ${Object.values(progress).filter((x) => x.done).length} · 任务 ${tasks.length} · 日志 ${logs.length}`}
          last
          onPress={confirmReset}
        />
      </GroupCard>

      {/* ⑤ 账号：账号安全 / 同步状态 / 时钟校准 / 退出登录（未登录时给登录入口） */}
      <Animated.View entering={entrance(4)}>
        <SectionTitle title="账号" />
      </Animated.View>
      <GroupCard>
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
        />
        {token ? (
          <SettingsRow
            icon="pulse-outline"
            iconColor={colors.primary}
            title="同步状态"
            subtitle={syncHint}
            value={
              engine.syncing
                ? "同步中"
                : engine.retryInMs !== null
                  ? `重试 ${Math.ceil(engine.retryInMs / 1000)}s`
                  : engine.online
                    ? "在线"
                    : "离线"
            }
          />
        ) : null}
        {/* S5-3：设备时钟偏移 >5min 时提示校准（游标只认 serverTime，但本地 updatedAt 会受时钟影响） */}
        {token && clock.skewed ? (
          <SettingsRow
            icon="time-outline"
            iconColor={colors.warning}
            title="设备时间与服务器不一致"
            subtitle={`${clockSkewHint(clock.offsetMs)}，可能影响同步；请开启系统「自动设置时间」`}
            value="需校准"
            valueColor={colors.warning}
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

      <View style={styles.footerBlock}>
        <Text style={styles.footer}>移动端默认连接生产域名，招聘爬虫配置请在 Web 端完成。</Text>
        <Text style={styles.footer}>© 苦旅 · 学习工作台 · Expo + React Native</Text>
      </View>

      <BottomSheet visible={themeOpen} onClose={() => setThemeOpen(false)} title="外观主题" height="48%">
        <GroupCard>
          {(["light", "dark", "system"] as ThemeMode[]).map((m, i, list) => {
            const label = m === "light" ? "浅色" : m === "dark" ? "深色" : "跟随系统";
            const active = themeMode === m;
            return (
              <SettingsRow
                key={m}
                icon={m === "light" ? "sunny" : m === "dark" ? "moon-outline" : "options-outline"}
                iconColor={active ? colors.primary : colors.textMuted}
                title={label}
                value={active ? "当前" : undefined}
                valueColor={active ? colors.primary : undefined}
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

      <AuthSheet visible={authOpen} onClose={() => setAuthOpen(false)} onAuthed={handleAuthed} />
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    /** v2.2.2：本页没有外层 View，ScrollView 就是根容器 → 直接垫 canvas（不再 transparent） */
    scroll: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },

    /* ② 身份卡（glassStrong 容器自带 16 内边距，这里只定内部节奏） */
    profile: { gap: spacing.md },
    profileHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
    avatarText: { ...typography.hero, fontWeight: "800", color: colors.primary },
    profileBody: { flex: 1, minWidth: 0, gap: 3 },
    profileTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    profileName: { ...typography.hero, color: colors.text, flexShrink: 1 },
    profileStats: { ...typography.callout, fontWeight: "600", color: colors.textSecondary },
    profileHint: { ...typography.meta, color: colors.textMuted },
    streakPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.accentSoft,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      flexShrink: 0,
    },
    streakText: { ...typography.micro, color: colors.accentStrong },
    msg: { ...typography.meta, fontWeight: "600", color: colors.success },

    /* ③ 设置行（行高 58；图标芯片 34 surfaceMuted；右侧值 + chevron） */
    row: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 1,
    },
    rowPressed: { backgroundColor: colors.surfaceMuted },
    iconChip: {
      width: 34,
      height: 34,
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
    rowValue: { ...typography.meta, fontWeight: "700", color: colors.textMuted, flexShrink: 1, textAlign: "right" },
    rowDivider: {
      position: "absolute",
      bottom: 0,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },

    /* 学习领域内嵌块：chip 命中区 40 + hitSlop 4 = 48 */
    domainBlock: { gap: spacing.sm + 2, paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2 },
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

    footerBlock: { marginTop: spacing.lg, paddingHorizontal: spacing.xs, gap: 2 },
    footer: { ...typography.meta, color: colors.textFaint, textAlign: "center" },
  });
