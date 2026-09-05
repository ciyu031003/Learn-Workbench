import { useEffect, useState , useMemo } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { useAppStore } from "@/store/app-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiUrl } from "@/config";
import { syncPush, syncPull } from "@/lib/sync";
import { useSyncEngineStatus } from "@/lib/sync-engine";
import { Card } from "@/components/card";
import { PressableScale } from "@/components/pressable-scale";
import { router } from "expo-router";
import { AuthSheet } from "@/components/auth-sheet";
import { haptics } from "@/lib/haptics";
import { radius , type ThemeMode } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

export default function SettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const backgroundEnabled = useAppStore((s) => s.backgroundEnabled);
  const toggleBackground = useAppStore((s) => s.toggleBackground);
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

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.heroTitle}>我的</Text>
        <Text style={styles.heroSub}>账号 · 学习领域 · 数据同步</Text>
      </View>

      <Card title="账号" subtitle={token ? "登录中，学习数据将自动同步云端" : "登录后同步云端，离线数据不会丢失"}>
        {token ? (
          <View style={styles.rowBetween}>
            <View style={styles.rowBetween}>
              <View style={styles.avatarChip}>
                <Text style={styles.avatarText}>{(username ?? "旅").slice(0, 1).toUpperCase()}</Text>
              </View>
              <Text style={styles.rowLabel}>已登录：{username}</Text>
            </View>
            <Pressable
              onPress={() => {
                haptics.warning();
                Alert.alert("退出登录", "退出后本机数据保留，云端数据不受影响。", [
                  { text: "取消", style: "cancel" },
                  { text: "退出", style: "destructive", onPress: () => setAuth(null, null) },
                ]);
              }}
            >
              <Text style={styles.linkText}>退出</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.authPrompt}
            onPress={() => {
              haptics.light();
              setAuthOpen(true);
            }}
          >
            <View style={styles.authPromptIcon}>
              <ThemedIcon name="person-circle-outline" size={30} color={colors.primary} />
            </View>
            <View style={styles.authPromptBody}>
              <Text style={styles.authPromptTitle}>登录 / 注册</Text>
              <Text style={styles.authPromptSub}>同步学习进度到云端，Web 端与 App 数据保持一致</Text>
            </View>
            <ThemedIcon name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        )}

        {token ? (
          <View style={styles.row}>
            <Pressable style={[styles.primaryBtn, { flex: 1 }]} onPress={doPush} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>同步到云端</Text>}
            </Pressable>
            <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={doPull} disabled={busy}>
              <Text style={styles.secondaryBtnText}>从云端恢复</Text>
            </Pressable>
          </View>
        ) : null}

        {token ? (
          <PressableScale
            style={styles.securityRow}
            onPress={() => {
              haptics.light();
              router.push("/account-security");
            }}
          >
            <ThemedIcon name="shield-checkmark-outline" size={18} color={colors.primary} />
            <Text style={styles.securityRowText}>账号与安全 · 微信绑定</Text>
            <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
          </PressableScale>
        ) : null}

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        <Text style={styles.hint}>
          {engine.syncing
            ? "正在同步…"
            : !engine.online
              ? `当前离线：数据将先保存在本机，联网后自动上传${pendingCount ? `（${pendingCount} 条待同步）` : ""}`
              : !token
                ? "网络已连接：登录后本机数据将自动同步到云端"
                : pendingCount
                  ? `网络已连接：${pendingCount} 条待同步，稍后自动上传`
                  : `本机与云端已同步${lastSyncedAt ? `（上次同步 ${lastSyncedAt.slice(0, 16).replace("T", " ")}）` : ""}`}
        </Text>
        <Text style={styles.hint}>移动端默认连接生产域名，招聘爬虫配置请在 Web 端完成。</Text>
      </Card>

      {domains.length > 0 ? (
        <Card title="学习领域" subtitle="切换后 Web 端学习路线随之切换">
          <View style={styles.chipWrap}>
            {domains.map((c) => {
              const active = c.career_key === career;
              return (
                <Pressable
                  key={c.career_key}
                  onPress={() => switchCareer(c.career_key)}
                  style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
                >
                  <Text style={active ? styles.chipTextActive : styles.chipTextIdle}>{c.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ) : null}

      <Card title="外观" subtitle="浅色 · 深色 · 跟随系统">
        <View style={styles.segToggle}>
          {(["light", "dark", "system"] as ThemeMode[]).map((m) => {
            const active = themeMode === m;
            const label = m === "light" ? "浅色" : m === "dark" ? "深色" : "跟随系统";
            return (
              <Pressable
                key={m}
                style={[styles.segToggleItem, active && styles.segToggleActive]}
                onPress={() => {
                  haptics.soft();
                  setThemeMode(m);
                }}
              >
                <Text style={[styles.segToggleText, active && styles.segToggleTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card title="每日背景图" subtitle="每天自动更换每日风景壁纸">
        <View style={styles.rowBetween}>
          <Text style={styles.rowLabel}>启用每日壁纸</Text>
          <Switch value={backgroundEnabled} onValueChange={toggleBackground} trackColor={{ true: colors.primary }} />
        </View>
      </Card>

      <Card title="数据" subtitle="本机数据保存在设备，无登录也可使用">
        <View style={styles.rowBetween}>
          <Text style={styles.rowLabel}>
            进度 {Object.values(progress).filter((p) => p.done).length} · 任务 {tasks.length} · 日志 {logs.length}
          </Text>
        </View>
        <Pressable style={[styles.primaryBtn, styles.dangerBtn]} onPress={confirmReset}>
          <Text style={styles.primaryBtnText}>清空本机数据</Text>
        </Pressable>
      </Card>

      <Card title="关于" subtitle="苦旅 v1.1.1">
        <Text style={styles.about}>Expo + React Native · 路线图内容来自《新疆ICT学习规划优化方案》</Text>
        <Text style={styles.about}>支持登录后一键同步云端，Web 与移动端数据保持一致。</Text>
      </Card>

      <AuthSheet visible={authOpen} onClose={() => setAuthOpen(false)} onAuthed={handleAuthed} />
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "transparent" },
  content: { padding: 16, paddingBottom: 118, gap: 12 },
  hero: { paddingTop: 24, paddingBottom: 6, gap: 4 },
  heroTitle: { color: colors.text, fontSize: 26, fontWeight: "800" },
  heroSub: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: "row", gap: 8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowLabel: { flex: 1, fontSize: 14, color: colors.text },
  linkText: { fontSize: 14, color: colors.primary, fontWeight: "600" },
  input: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  segToggle: {
    flexDirection: "row",
    backgroundColor: colors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 4,
  },
  segToggleItem: { flex: 1, borderRadius: 11, paddingVertical: 9, alignItems: "center" },
  segToggleActive: { backgroundColor: colors.primary },
  segToggleText: { fontSize: 14, fontWeight: "700", color: colors.textMuted },
  segToggleTextActive: { color: "#fff", fontWeight: "800" },
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  securityRowText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },
  authPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  authPromptIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  authPromptBody: { flex: 1, gap: 2 },
  authPromptTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  authPromptSub: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  avatarChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  avatarText: { fontSize: 13, fontWeight: "800", color: colors.primary },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  secondaryBtn: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dangerBtn: { backgroundColor: colors.danger },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  secondaryBtnText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  msg: { fontSize: 13, color: colors.success, fontWeight: "600" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipActive: { backgroundColor: colors.primary },
  chipIdle: { backgroundColor: colors.surfaceStrong, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipTextActive: { color: "#fff", fontSize: 13, fontWeight: "600" },
  chipTextIdle: { color: colors.text, fontSize: 13 },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  about: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
});
