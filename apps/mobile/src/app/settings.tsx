import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppStore } from "@/store/app-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiUrl } from "@/config";
import { apiLogin, syncPush, syncPull } from "@/lib/sync";
import { useSyncEngineStatus } from "@/lib/sync-engine";
import { Card } from "@/components/card";
import { colors, radius } from "@/theme/tokens";

export default function SettingsScreen() {
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
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt);
  const engine = useSyncEngineStatus();

  const [userInput, setUserInput] = useState("");
  const [passInput, setPassInput] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [pwCur, setPwCur] = useState("");
  const [pwNew1, setPwNew1] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

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

  const doLogin = async () => {
    if (!userInput.trim() || !passInput) return;
    setBusy(true);
    setMsg(null);
    try {
      const data = await apiLogin(userInput.trim(), passInput);
      setAuth(data.token, data.user.username);
      setMsg("登录成功");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "登录失败");
    } finally {
      setBusy(false);
    }
  };

  const doRegister = async () => {
    if (!userInput.trim() || !passInput) return;
    if (passInput.length < 6) {
      setMsg("密码至少 6 位");
      return;
    }
    if (passInput !== confirmPass) {
      setMsg("两次输入的密码不一致");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(getApiUrl() + "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: userInput.trim(), password: passInput }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "注册失败");
      setAuth(data.token, data.user?.username ?? userInput.trim());
      setMsg("注册成功");
      setAuthMode("login");
      setPassInput("");
      setConfirmPass("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "注册失败");
    } finally {
      setBusy(false);
    }
  };

  const submitAuth = () => {
    if (authMode === "register") doRegister();
    else doLogin();
  };

  const doPush = async () => {
    if (!token) return;
    setBusy(true);
    setMsg(null);
    try {
      await syncPush(token);
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

  const changePassword = async () => {
    if (!token) return;
    if (!pwCur || !pwNew1 || !pwNew2) { setPwMsg("请填写完整"); return; }
    if (pwNew1 !== pwNew2) { setPwMsg("两次新密码不一致"); return; }
    if (pwNew1.length < 6) { setPwMsg("新密码至少 6 位"); return; }
    setPwBusy(true);
    setPwMsg(null);
    try {
      const r = await fetch(getApiUrl() + "/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ currentPassword: pwCur, newPassword: pwNew1 }),
      });
      const data = await r.json();
      if (!r.ok) { setPwMsg(data.error ?? "修改失败"); }
      else { setPwMsg("密码修改成功"); setPwCur(""); setPwNew1(""); setPwNew2(""); }
    } catch {
      setPwMsg("网络异常，请稍后重试");
    } finally {
      setPwBusy(false);
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
            <Text style={styles.rowLabel}>已登录：{username}</Text>
            <Pressable onPress={() => setAuth(null, null)}>
              <Text style={styles.linkText}>退出</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.authBox}>
            <View style={styles.authBrand}>
              <View style={styles.authLogo}>
                <Ionicons name="sunny" size={26} color={colors.accentStrong} />
              </View>
              <Text style={styles.authTitle}>苦旅</Text>
              <Text style={styles.authSub}>把每一天的学习，都变成面向未来的积累</Text>
            </View>

            <View style={styles.segToggle}>
              <Pressable
                style={[styles.segToggleItem, authMode === "login" && styles.segToggleActive]}
                onPress={() => { setAuthMode("login"); setMsg(null); }}
              >
                <Text style={[styles.segToggleText, authMode === "login" && styles.segToggleTextActive]}>登录</Text>
              </Pressable>
              <Pressable
                style={[styles.segToggleItem, authMode === "register" && styles.segToggleActive]}
                onPress={() => { setAuthMode("register"); setMsg(null); }}
              >
                <Text style={[styles.segToggleText, authMode === "register" && styles.segToggleTextActive]}>注册</Text>
              </Pressable>
            </View>

            <View style={styles.authInputShell}>
              <Ionicons name="person-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.authInput}
                placeholder="账号"
                placeholderTextColor={colors.textFaint}
                value={userInput}
                onChangeText={setUserInput}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.authInputShell}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.authInput}
                placeholder="密码"
                placeholderTextColor={colors.textFaint}
                value={passInput}
                onChangeText={setPassInput}
                secureTextEntry
              />
            </View>
            {authMode === "register" ? (
              <View style={styles.authInputShell}>
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
                <TextInput
                  style={styles.authInput}
                  placeholder="确认密码"
                  placeholderTextColor={colors.textFaint}
                  value={confirmPass}
                  onChangeText={setConfirmPass}
                  secureTextEntry
                />
              </View>
            ) : null}

            <Pressable style={styles.authBtn} onPress={submitAuth} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.authBtnText}>{authMode === "login" ? "登 录" : "创建账号"}</Text>}
            </Pressable>

            <Pressable
              onPress={() => {
                setAuthMode((mode) => (mode === "login" ? "register" : "login"));
                setPassInput("");
                setConfirmPass("");
                setMsg(null);
              }}
            >
              <Text style={styles.authSwitch}>{authMode === "login" ? "还没有账号？立即注册" : "已有账号？返回登录"}</Text>
            </Pressable>
          </View>
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

      {token ? (
        <Card title="修改密码" subtitle="修改后其他设备将自动退出登录">
          <TextInput
            style={styles.input}
            placeholder="当前密码"
            placeholderTextColor={colors.textFaint}
            value={pwCur}
            onChangeText={setPwCur}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder="新密码（至少 6 位）"
            placeholderTextColor={colors.textFaint}
            value={pwNew1}
            onChangeText={setPwNew1}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder="确认新密码"
            placeholderTextColor={colors.textFaint}
            value={pwNew2}
            onChangeText={setPwNew2}
            secureTextEntry
          />
          <Pressable style={styles.primaryBtn} onPress={changePassword} disabled={pwBusy}>
            {pwBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>保存新密码</Text>}
          </Pressable>
          {pwMsg ? <Text style={styles.msg}>{pwMsg}</Text> : null}
        </Card>
      ) : null}

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

      <Card title="关于" subtitle="苦旅 v1.0.0">
        <Text style={styles.about}>Expo + React Native · 路线图内容来自《新疆ICT学习规划优化方案》</Text>
        <Text style={styles.about}>支持登录后一键同步云端，Web 与移动端数据保持一致。</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  authBox: { gap: 12 },
  authBrand: { alignItems: "center", gap: 6, paddingVertical: 8 },
  authLogo: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  authTitle: { fontSize: 22, fontWeight: "900", color: colors.text },
  authSub: { fontSize: 12, color: colors.textMuted, textAlign: "center", lineHeight: 18 },
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
  authInputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  authInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text },
  authBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  authBtnText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  authSwitch: { fontSize: 12, color: colors.primary, fontWeight: "600", textAlign: "center", paddingVertical: 2 },
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
