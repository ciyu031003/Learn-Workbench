import { useEffect, useMemo, useRef, useState } from "react";
import { useHeaderTopInset } from "@/components/screen-header";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { computeStreak } from "@learn-workbench/shared/domains";
import { useAppStore } from "@/store/app-store";
import { useUpdateStore } from "@/store/update-store";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
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
import { Card } from "@/components/card";
import { Button, ButtonRow } from "@/components/button";
import { ListGroup, ListRow } from "@/components/list-row";
import { EntryCard, type EntryTone } from "@/components/entry-card";
import { SectionHeader } from "@/components/section-header";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { DayNightSwitch } from "@/components/day-night-switch";
import { router } from "expo-router";
import { AuthSheet } from "@/components/auth-sheet";
import { haptics } from "@/lib/haptics";
import type { ThemeColors, ThemeMode } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { radius, spacing, typography } from "@/theme/tokens";

/**
 * 「我的」设置页（v1.62 P0-4b 重构）。
 *
 * 结构：紧凑 header（不再用 LargeTitle 大标题）→ 身份卡 → 偏好 / 工具 / 账号 三组。
 * 视觉统一走 SectionHeader（分组标题）+ ListGroup/ListRow（带开关/值/危险项的行）
 * 与 EntryCard size="row"（纯跳转入口行）。
 *
 * 纪律：
 * - 只重排分组与视觉，**所有设置项、开关、跳转与处理逻辑保持原样**（登录/退出、
 *   手动同步、主题弹层与日夜开关、每日背景、学习领域切换、检查更新/OTA、诊断、
 *   隐私与备案链接、清空本机数据）；
 * - 不写裸 fontSize（全部走 typography token）；不新增动效点；320pt/130% 不溢出；
 *   无新依赖（只用已就绪的 Card/ListRow/EntryCard/SectionHeader）。
 */

/** 分组标题的语义色（SectionHeader 左侧色条） */
const SECTION_ACCENT = {
  preference: "teal",
  tools: "primary",
  account: "accent",
} as const;

export default function SettingsScreen() {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerTop = useHeaderTopInset("compact");
  const tabBarSpace = useTabBarSpace();
  /** v19-M1：首屏入场错峰（Tab scene 常驻，只在首次挂载播放） */
  const entrance = useScreenEntrance();
  /** v19-M8：TabBar 双击回顶 */
  const settingsScrollRef = useRef<ScrollView>(null);
  useScrollToTopHandler("/settings", settingsScrollRef);

  const backgroundEnabled = useAppStore((s) => s.backgroundEnabled);
  const toggleBackground = useAppStore((s) => s.toggleBackground);
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
  // v7 P1：主题改为弹层选择（分组卡片范式里没有折叠卡）
  const [themeOpen, setThemeOpen] = useState(false);

  const [domains, setDomains] = useState<{ career_key: string; name: string; kind?: string; kind_label?: string }[]>([]);
  const [career, setCareer] = useState("ict");

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

  /** v7 P1：分组卡片右侧「值」的文案（截图范式：值 + 箭头） */
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

  /** 身份卡的一句话状态：登录态 + 连续打卡天数（今日页同源数据，不编造） */
  const identityStatus = token
    ? `连续打卡 ${streak} 天${
        pendingCount > 0 ? ` · ${pendingCount} 条待同步` : engine.online ? " · 已与云端同步" : " · 离线"
      }`
    : `未登录${streak > 0 ? ` · 连续打卡 ${streak} 天` : ""} · 登录后自动同步云端`;

  /** 工具组里的纯跳转入口行（EntryCard row，tone 决定图标底色） */
  const entryRow = (
    icon: Parameters<typeof EntryCard>[0]["icon"],
    title: string,
    meta: string,
    tone: EntryTone,
    onPress: () => void,
  ) => (
    <EntryCard size="row" icon={icon} title={title} meta={meta} tone={tone} onPress={onPress} />
  );

  return (
    <ScrollView
      ref={settingsScrollRef}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ① 紧凑 header：不再用 LargeTitle；版本号收进右侧小字 */}
      <Animated.View entering={entrance(0)} style={[styles.header, { paddingTop: headerTop }]}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>我的</Text>
          <Text style={styles.headerSub} numberOfLines={1}>账号 · 学习领域 · 数据同步</Text>
        </View>
        <Text style={styles.headerVersion}>v{APP_VERSION_NAME}</Text>
      </Animated.View>

      {/* ② 身份卡：头像首字母 + 昵称/学习工作台 + 一句话状态；登录态才出现同步按钮 */}
      <Animated.View entering={entrance(1)}>
        <Card variant="glass" style={styles.profileCard}>
          <View style={styles.profileHead}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(username ?? "旅").slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.profileBody}>
              <Text style={styles.profileName} numberOfLines={1}>
                {token ? username || "学习工作台" : "学习工作台"}
              </Text>
              <Text style={styles.profileSub} numberOfLines={2}>{identityStatus}</Text>
            </View>
            {token ? null : (
              <PressableScale
                haptic
                scaleTo={0.96}
                style={styles.loginBtn}
                accessibilityRole="button"
                accessibilityLabel="登录或注册"
                onPress={() => {
                  haptics.light();
                  setAuthOpen(true);
                }}
              >
                <Text style={styles.loginBtnText}>登录 / 注册</Text>
              </PressableScale>
            )}
          </View>
          {token ? (
            <ButtonRow>
              <Button label="同步到云端" onPress={doPush} loading={busy} icon="cloud-upload-outline" />
              <Button label="从云端恢复" variant="secondary" onPress={doPull} disabled={busy} />
            </ButtonRow>
          ) : null}
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        </Card>
      </Animated.View>

      {/* ③ 偏好：主题（日夜开关 + 三档弹层）/ 每日背景 / 学习领域 */}
      <Animated.View entering={entrance(2)}>
        <SectionHeader title="偏好" subtitle="外观 · 背景 · 学习领域" accentColor={colors[SECTION_ACCENT.preference]} />
      </Animated.View>
      <ListGroup>
        <ListRow
          icon="color-palette-outline"
          iconColor={colors.primary}
          iconBg={colors.primarySoft}
          title="主题"
          subtitle="浅色 / 深色 / 跟随系统"
          value={themeLabel}
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
        <ListRow
          icon="image-outline"
          iconColor={colors.teal}
          iconBg={colors.surfaceMuted}
          title="每日背景图"
          subtitle="每天自动更换风景壁纸"
          right={<Switch value={backgroundEnabled} onValueChange={toggleBackground} trackColor={{ true: colors.primary }} />}
          last={domains.length === 0}
        />
        {/* 学习领域（原「学习与数据」组内嵌块）：偏好项，保留全部逻辑 */}
        {domains.length > 0 ? (
          <View style={styles.domainBlock}>
            <Text style={styles.domainLabel}>当前学习领域</Text>
            <View style={styles.chipWrap}>
              {domains.map((c) => {
                const active = c.career_key === career;
                return (
                  <Pressable
                    key={c.career_key}
                    onPress={() => void switchCareer(c.career_key)}
                    style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={active ? styles.chipTextActive : styles.chipTextIdle}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </ListGroup>

      {/* ④ 工具：领域/学习记录/检查更新/诊断/隐私与关于/清空本机数据 */}
      <Animated.View entering={entrance(3)}>
        <SectionHeader title="工具" subtitle="领域 · 学习记录 · 诊断与关于" accentColor={colors[SECTION_ACCENT.tools]} />
      </Animated.View>
      <ListGroup>
        {token
          ? entryRow("layers-outline", "领域管理", "新建 / 归档 / 从模板创建", "primary", () => {
              haptics.light();
              router.push("/domain-manager");
            })
          : null}
        {entryRow("stats-chart-outline", "领域记录", "通用计量与按日打卡", "success", () => {
          haptics.light();
          router.push("/trackers");
        })}
        {entryRow("checkmark-circle", "习惯与打卡", "连续天数 · 13 周热力图", "accent", () => {
          haptics.light();
          router.push("/habits");
        })}
        {entryRow("pulse-outline", "问题诊断", "点不动 / 白屏时跑一次触摸自检", "primary", () => {
          haptics.light();
          router.push("/diagnostics");
        })}
        <ListRow
          icon="refresh"
          iconColor={colors.success}
          iconBg={colors.successSoft}
          title="检查更新"
          subtitle="支持应用内 OTA 推送"
          value={updateState === "checking" ? undefined : updateLabel}
          valueColor={updateState === "update" ? colors.accentStrong : undefined}
          showChevron={updateState !== "checking"}
          right={updateState === "checking" ? <ActivityIndicator size="small" color={colors.primary} /> : undefined}
          disabled={updateState === "checking"}
          onPress={() => void checkUpdate()}
        />
        <ListRow
          icon="cloud-download-outline"
          iconColor={colors.primary}
          iconBg={colors.primarySoft}
          title="手动下载最新版"
          subtitle="打不开更新时用这个"
          onPress={() => void Linking.openURL(DOWNLOAD_PAGE_URL).catch(() => {})}
        />
        <ListRow
          icon="lock-closed-outline"
          iconColor={colors.textMuted}
          iconBg={colors.surfaceMuted}
          title="隐私与数据"
          subtitle="数据只在本机与你的云端账号之间流转"
          showChevron
          onPress={() => void Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
        />
        <ListRow
          icon="information-circle-outline"
          iconColor={colors.textMuted}
          iconBg={colors.surfaceMuted}
          title={`苦旅 v${APP_VERSION_NAME}`}
          subtitle={`App 备案：${APP_ICP_NUMBER}`}
          showChevron
          onPress={() => void Linking.openURL(ICP_VERIFY_URL).catch(() => {})}
        />
        {APP_MPS_NUMBER ? (
          <ListRow
            icon="shield-checkmark-outline"
            iconColor={colors.textMuted}
            iconBg={colors.surfaceMuted}
            title="公安联网备案"
            subtitle={APP_MPS_NUMBER}
            showChevron
            onPress={() =>
              void Linking.openURL(MPS_VERIFY_URL + APP_MPS_NUMBER.replace(/[^0-9]/g, "")).catch(() => {})
            }
          />
        ) : null}
        <ListRow
          icon="document-text-outline"
          iconColor={colors.textMuted}
          iconBg={colors.surfaceMuted}
          title="隐私政策"
          showChevron
          onPress={() => void Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
        />
        <ListRow
          icon="trash-outline"
          iconColor={colors.danger}
          iconBg={colors.dangerSoft}
          title="清空本机数据"
          subtitle={`进度 ${Object.values(progress).filter((x) => x.done).length} · 任务 ${tasks.length} · 日志 ${logs.length}`}
          last
          onPress={confirmReset}
        />
      </ListGroup>

      {/* ⑤ 账号：账号安全 / 同步状态 / 时钟校准 / 退出登录（未登录时给登录入口） */}
      <Animated.View entering={entrance(4)}>
        <SectionHeader title="账号" subtitle="安全 · 同步" accentColor={colors[SECTION_ACCENT.account]} />
      </Animated.View>
      <ListGroup>
        <ListRow
          icon="shield-checkmark-outline"
          iconColor={colors.primary}
          iconBg={colors.primarySoft}
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
          <ListRow
            icon="pulse-outline"
            iconColor={colors.primary}
            iconBg={colors.primarySoft}
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
          <ListRow
            icon="time-outline"
            iconColor={colors.warning}
            iconBg={colors.warningSoft}
            title="设备时间与服务器不一致"
            subtitle={`${clockSkewHint(clock.offsetMs)}，可能影响同步；请开启系统「自动设置时间」`}
            value="需校准"
          />
        ) : null}
        {token ? (
          <ListRow
            icon="log-out-outline"
            iconColor={colors.danger}
            iconBg={colors.dangerSoft}
            title="退出登录"
            subtitle="清除本机数据并回到未登录状态"
            last
            onPress={confirmLogout}
          />
        ) : (
          <ListRow
            icon="log-in-outline"
            iconColor={colors.primary}
            iconBg={colors.primarySoft}
            title="登录 / 注册"
            subtitle="登录后自动同步到云端"
            last
            onPress={() => {
              haptics.light();
              setAuthOpen(true);
            }}
          />
        )}
      </ListGroup>

      <Text style={styles.footer}>移动端默认连接生产域名，招聘爬虫配置请在 Web 端完成。</Text>
      <Text style={styles.footer}>© 苦旅 · 学习工作台 · Expo + React Native</Text>

      <BottomSheet visible={themeOpen} onClose={() => setThemeOpen(false)} title="外观主题" height="48%">
        <ListGroup>
          {(["light", "dark", "system"] as ThemeMode[]).map((m, i, list) => {
            const label = m === "light" ? "浅色" : m === "dark" ? "深色" : "跟随系统";
            const active = themeMode === m;
            return (
              <ListRow
                key={m}
                icon={m === "light" ? "sunny" : m === "dark" ? "moon-outline" : "options-outline"}
                iconColor={active ? colors.primary : colors.textMuted}
                iconBg={active ? colors.primarySoft : colors.surfaceMuted}
                title={label}
                value={active ? "当前" : undefined}
                last={i === list.length - 1}
                onPress={() => {
                  haptics.soft();
                  setThemeMode(m);
                  setThemeOpen(false);
                }}
              />
            );
          })}
        </ListGroup>
      </BottomSheet>

      <AuthSheet visible={authOpen} onClose={() => setAuthOpen(false)} onAuthed={handleAuthed} />
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: spacing.lg, gap: spacing.md },

    /* ① 紧凑 header（PaddingTop 由安全区 + 6 给出） */
    header: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: spacing.md,
      paddingBottom: spacing.xs,
    },
    headerTextWrap: { flex: 1, minWidth: 0, gap: 2 },
    headerTitle: { ...typography.title2, color: colors.text },
    headerSub: { ...typography.caption, color: colors.textSecondary },
    headerVersion: { ...typography.micro, color: colors.textFaint, flexShrink: 0 },

    /* ② 身份卡 */
    profileCard: { gap: spacing.md },
    profileHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(47,116,192,0.24)",
    },
    avatarText: { ...typography.headline, fontWeight: "800", color: colors.primary },
    profileBody: { flex: 1, minWidth: 0, gap: 3 },
    profileName: { ...typography.headline, fontWeight: "800", color: colors.text },
    profileSub: { ...typography.caption, color: colors.textSecondary, lineHeight: 17 },
    loginBtn: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md + 2,
      paddingVertical: 9,
    },
    loginBtnText: { ...typography.caption, fontWeight: "800", color: "#FFFFFF" },
    msg: { ...typography.caption, color: colors.success, fontWeight: "600" },

    /* 偏好组里的学习领域内嵌块 */
    domainBlock: { gap: spacing.sm, paddingHorizontal: spacing.md + 2, paddingVertical: spacing.md },
    domainLabel: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 7 },
    chipActive: { backgroundColor: colors.primary },
    chipIdle: {
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipTextActive: { ...typography.caption, fontWeight: "600", color: "#FFFFFF" },
    chipTextIdle: { ...typography.caption, color: colors.text },

    footer: { ...typography.caption, color: colors.textFaint, lineHeight: 18, paddingHorizontal: spacing.xs },
  });
