import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { useAppStore } from "@/store/app-store";
import { useUpdateStore } from "@/store/update-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { getApiUrl } from "@/config";
import { syncPush, syncPull } from "@/lib/sync";
import { useSyncEngineStatus } from "@/lib/sync-engine";
import {
  APP_ICP_NUMBER,
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
import { GroupLabel } from "@/components/group-label";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { DayNightSwitch } from "@/components/day-night-switch";
import { router } from "expo-router";
import { AuthSheet } from "@/components/auth-sheet";
import { haptics } from "@/lib/haptics";
import type { ThemeColors, ThemeMode } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { resolveEdgeSwipeEnabled } from "@/lib/edge-swipe";
import { typography } from "@/theme/tokens";

export default function SettingsScreen() {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const backgroundEnabled = useAppStore((s) => s.backgroundEnabled);
  const toggleBackground = useAppStore((s) => s.toggleBackground);
  const storedEdgeSwipe = useAppStore((s) => s.edgeSwipeEnabled);
  const setEdgeSwipeEnabled = useAppStore((s) => s.setEdgeSwipeEnabled);
  const edgeSwipeEnabled = resolveEdgeSwipeEnabled(storedEdgeSwipe, Platform.OS);
  const resetAll = useAppStore((s) => s.resetAll);
  const progress = useAppStore((s) => s.progress);
  const tasks = useAppStore((s) => s.tasks);
  const logs = useAppStore((s) => s.logs);

  const token = useAppStore((s) => s.token);
  const username = useAppStore((s) => s.username);
  const setAuth = useAppStore((s) => s.setAuth);
  const pendingCount = useAppStore((s) => s.pendingChanges.length);
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt);
  const engine = useSyncEngineStatus();

  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const doPush = async () => {
    if (!token) return;
    setBusy(true);
    setMsg(null);
    try {
      await syncPush(token);
      haptics.success();
      setMsg("已一键同步到云端");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "同步失败");
    } finally {
      setBusy(false);
    }
  };

  const doPull = async () => {
    if (!token) return;
    setBusy(true);
    setMsg(null);
    try {
      await syncPull(token);
      haptics.soft();
      setMsg("已从云端拉取最新数据");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "拉取失败");
    } finally {
      setBusy(false);
    }
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
    : !engine.online
      ? `当前离线${pendingCount ? ` · ${pendingCount} 条待同步` : ""}`
      : !token
        ? "登录后自动同步到云端"
        : pendingCount
          ? `${pendingCount} 条待同步，稍后自动上传`
          : lastSyncedAt
            ? `已同步 · ${lastSyncedAt.slice(0, 16).replace("T", " ")}`
            : "本机与云端已同步";

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.heroTitle}>我的</Text>
        <Text style={styles.heroSub}>账号 · 学习领域 · 数据同步</Text>
      </View>

      {/* 账号英雄卡（v12 P1-3：升级为玻璃材质 + 数据行，对齐健康/饮食的语言） */}
      <Card variant="glass" style={styles.profileCard}>
        <View style={styles.profileHead}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(username ?? "旅").slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.profileBody}>
            <Text style={styles.profileName}>{token ? username || "已登录" : "未登录"}</Text>
            <Text style={styles.profileSub}>{syncHint}</Text>
          </View>
          {token ? (
            <PressableScale
              haptic
              scaleTo={0.96}
              style={styles.logoutBtn}
              accessibilityLabel="退出登录"
              onPress={() => {
                haptics.warning();
                Alert.alert("退出登录", "退出后本机数据保留，云端数据不受影响。", [
                  { text: "取消", style: "cancel" },
                  { text: "退出", style: "destructive", onPress: () => setAuth(null, null) },
                ]);
              }}
            >
              <ThemedIcon name="log-out-outline" size={15} color={colors.danger} />
              <Text style={styles.logoutText}>退出</Text>
            </PressableScale>
          ) : (
            <PressableScale
              haptic
              scaleTo={0.96}
              style={styles.loginBtn}
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

        {/* 三格数据行：账号 / 待同步 / 版本 —— 与「今日饮食」的三指标行同款节奏（v12 P1-3） */}
        <View style={styles.profileStats}>
          <View style={styles.profileStat}>
            <Text style={styles.profileStatValue}>{token ? "已登录" : "未登录"}</Text>
            <Text style={styles.profileStatLabel}>账号</Text>
          </View>
          <View style={styles.profileStat}>
            <Text style={[styles.profileStatValue, pendingCount > 0 && { color: colors.warning }]}>
              {pendingCount > 0 ? pendingCount + " 条" : "0 条"}
            </Text>
            <Text style={styles.profileStatLabel}>待同步</Text>
          </View>
          <View style={styles.profileStat}>
            <Text style={styles.profileStatValue}>{APP_VERSION_NAME}</Text>
            <Text style={styles.profileStatLabel}>版本</Text>
          </View>
        </View>
      </Card>

      <GroupLabel>账号</GroupLabel>
      <ListGroup>
        <ListRow
          {...tint(GROUP_TINT.blue)}
          icon="shield-checkmark-outline"
          title="账号与安全"
          subtitle="密码 · 微信绑定 · 登录设备"
          value={token ? "已登录" : "未登录"}
          showChevron
          last={!token}
          onPress={() => {
            haptics.light();
            if (token) router.push("/account-security");
            else setAuthOpen(true);
          }}
        />
        {token ? (
          <ListRow
            {...tint(GROUP_TINT.blue)}
            icon="pulse-outline"
            title="同步状态"
            subtitle={pendingCount ? `还有 ${pendingCount} 条待上传` : "本机与云端一致"}
            value={engine.syncing ? "同步中" : engine.online ? "在线" : "离线"}
            last
          />
        ) : null}
      </ListGroup>

      <GroupLabel>学习与数据</GroupLabel>
      <ListGroup>
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
                  >
                    <Text style={active ? styles.chipTextActive : styles.chipTextIdle}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        {token ? (
          <ListRow
            {...tint(GROUP_TINT.purple)}
            icon="layers-outline"
            title="领域管理"
            subtitle="新建 / 归档 / 从模板创建"
            showChevron
            onPress={() => {
              haptics.light();
              router.push("/domain-manager");
            }}
          />
        ) : null}
        <ListRow
          {...tint(GROUP_TINT.green)}
          icon="stats-chart-outline"
          title="领域记录"
          subtitle="通用计量与按日打卡"
          showChevron
          onPress={() => {
            haptics.light();
            router.push("/trackers");
          }}
        />
        <ListRow
          {...tint(GROUP_TINT.orange)}
          icon="checkmark-circle"
          title="习惯与打卡"
          subtitle="连续天数 · 13 周热力图"
          showChevron
          onPress={() => {
            haptics.light();
            router.push("/habits");
          }}
        />
        <ListRow
          {...tint(colors.danger)}
          icon="trash-outline"
          title="清空本机数据"
          subtitle={`进度 ${Object.values(progress).filter((x) => x.done).length} · 任务 ${tasks.length} · 日志 ${logs.length}`}
          last
          onPress={confirmReset}
        />
      </ListGroup>

      <GroupLabel>外观与体验</GroupLabel>
      <ListGroup>
        <ListRow
          {...tint(GROUP_TINT.purple)}
          icon="color-palette-outline"
          title="主题"
          subtitle="浅色 / 深色 / 跟随系统"
          value={themeLabel}
          /* v13 U9：日夜开关负责"浅 ↔ 深"两态；"跟随系统"仍在下面的三档弹层里（API 不变） */
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
          {...tint(GROUP_TINT.teal)}
          icon="image-outline"
          title="每日背景图"
          subtitle="每天自动更换风景壁纸"
          right={<Switch value={backgroundEnabled} onValueChange={toggleBackground} trackColor={{ true: colors.primary }} />}
          onPress={toggleBackground}
        />
        <ListRow
          {...tint(GROUP_TINT.orange)}
          icon="swap-horizontal"
          title="边缘横滑切换 Tab"
          subtitle="Android 默认关闭：系统返回手势同样占用屏幕边缘，容易互相抢触摸"
          right={<Switch value={edgeSwipeEnabled} onValueChange={setEdgeSwipeEnabled} trackColor={{ true: colors.primary }} />}
          last
          onPress={() => setEdgeSwipeEnabled(!edgeSwipeEnabled)}
        />
      </ListGroup>

      <GroupLabel>支持</GroupLabel>
      <ListGroup>
        <ListRow
          {...tint(GROUP_TINT.green)}
          icon="refresh"
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
          {...tint(GROUP_TINT.blue)}
          icon="pulse-outline"
          title="问题诊断"
          subtitle="点不动 / 白屏时跑一次触摸自检"
          showChevron
          onPress={() => router.push("/diagnostics")}
        />
        <ListRow
          {...tint(GROUP_TINT.blue)}
          icon="cloud-download-outline"
          title="手动下载最新版"
          subtitle="打不开更新时用这个"
          onPress={() => void Linking.openURL(DOWNLOAD_PAGE_URL).catch(() => {})}
        />
        <ListRow
          {...tint(GROUP_TINT.gray)}
          icon="lock-closed-outline"
          title="隐私与数据"
          subtitle="数据只在本机与你的云端账号之间流转"
          showChevron
          last
          onPress={() => void Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
        />
      </ListGroup>

      <GroupLabel>关于</GroupLabel>
      <ListGroup>
        <ListRow
          {...tint(GROUP_TINT.gray)}
          icon="information-circle-outline"
          title={`苦旅 v${APP_VERSION_NAME}`}
          subtitle={`App 备案：${APP_ICP_NUMBER}`}
          showChevron
          onPress={() => void Linking.openURL(ICP_VERIFY_URL).catch(() => {})}
        />
        <ListRow
          {...tint(GROUP_TINT.gray)}
          icon="document-text-outline"
          title="隐私政策"
          showChevron
          last
          onPress={() => void Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
        />
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
                {...tint(active ? GROUP_TINT.blue : GROUP_TINT.gray)}
                icon={m === "light" ? "sunny" : m === "dark" ? "moon-outline" : "options-outline"}
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

/** v7 P1：分组卡片的语义色（淡底 = 颜色 + 22 alpha，与 wellness 入口卡同款做法） */
const GROUP_TINT = {
  blue: "#2F74C0",
  purple: "#8D7BD8",
  teal: "#2FB3A6",
  orange: "#F28C28",
  green: "#3DA35D",
  gray: "#8A8375",
} as const;

function tint(color: string) {
  return { iconColor: color, iconBg: color + "22" };
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "transparent" },
  content: { padding: 16, gap: 12 },
  hero: { paddingTop: 24, paddingBottom: 2, gap: 4 },
  profileStats: { flexDirection: "row", gap: 8, marginTop: 4 },
  profileStat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 8,
  },
  profileStatValue: { fontSize: 13, fontWeight: "800", color: colors.text },
  profileStatLabel: { fontSize: 10, color: colors.textMuted },
  heroTitle: {
    ...typography.display,
    color: colors.text,
  },
  heroSub: {
    ...typography.callout,
    color: colors.textMuted,
  },
  /* 账号英雄卡 */
  profileCard: { gap: 12 },
  profileHead: { flexDirection: "row", alignItems: "center", gap: 12 },
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
  avatarText: { fontSize: 18, fontWeight: "800", color: colors.primary },
  profileBody: { flex: 1, minWidth: 0, gap: 3 },
  profileName: { fontSize: 17, fontWeight: "800", color: colors.text },
  profileSub: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  loginBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  loginBtnText: { fontSize: 13, fontWeight: "800", color: "#fff" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.dangerSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(192,69,69,0.24)",
  },
  logoutText: { fontSize: 13, fontWeight: "800", color: colors.danger },
  msg: { fontSize: 13, color: colors.success, fontWeight: "600" },
  /* 领域选择（组内嵌块） */
  domainBlock: { gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  domainLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipActive: { backgroundColor: colors.primary },
  chipIdle: { backgroundColor: colors.surfaceStrong, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipTextActive: { color: "#fff", fontSize: 13, fontWeight: "600" },
  chipTextIdle: { color: colors.text, fontSize: 13 },
  footer: { fontSize: 12, color: colors.textFaint, lineHeight: 18, paddingHorizontal: 4 },
});
