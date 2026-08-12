import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useAppStore } from "@/store/app-store";
import { API_URL } from "@/config";
import { apiLogin, syncPush, syncPull } from "@/lib/sync";
import { Card } from "@/components/card";

export default function SettingsScreen() {
  const backgroundEnabled = useAppStore((s) => s.backgroundEnabled);
  const toggleBackground = useAppStore((s) => s.toggleBackground);
  const resetAll = useAppStore((s) => s.resetAll);
  const progress = useAppStore((s) => s.progress);
  const tasks = useAppStore((s) => s.tasks);
  const logs = useAppStore((s) => s.logs);

  const token = useAppStore((s) => s.token);
  const username = useAppStore((s) => s.username);
  const setAuth = useAppStore((s) => s.setAuth);
  const replaceAll = useAppStore((s) => s.replaceAll);

  const [userInput, setUserInput] = useState("");
  const [passInput, setPassInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pwCur, setPwCur] = useState("");
  const [pwNew1, setPwNew1] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [careers, setCareers] = useState<{ career_key: string; name: string }[]>([]);
  const [career, setCareer] = useState("ict");

  useEffect(() => {
    (async () => {
      try {
        const [cRes, curRes] = await Promise.all([
          fetch(`${API_URL}/api/careers`),
          fetch(`${API_URL}/api/settings/career`),
        ]);
        const cData = await cRes.json();
        const curData = await curRes.json();
        setCareers(cData.careers ?? []);
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
      const data = await syncPull(token);
      replaceAll(data);
      setMsg("已从云端恢复数据");
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
        await fetch(`${API_URL}/api/settings/career`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
      const r = await fetch(`${API_URL}/api/auth/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>设置</Text>
        <Text style={styles.heroSub}>外观、背景图、云同步与数据</Text>
      </View>

      {/* 云同步 */}
      <Card title="云同步" subtitle={`服务地址：${API_URL}`}>
        {token ? (
          <View style={styles.rowBetween}>
            <Text style={styles.rowLabel}>已登录：{username}</Text>
            <Pressable onPress={() => setAuth(null, null)}>
              <Text style={styles.linkText}>退出</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="账号（默认 yuanabd）"
              placeholderTextColor="#9ca3af"
              value={userInput}
              onChangeText={setUserInput}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="密码"
              placeholderTextColor="#9ca3af"
              value={passInput}
              onChangeText={setPassInput}
              secureTextEntry
            />
            <Pressable style={styles.primaryBtn} onPress={doLogin} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>登录</Text>}
            </Pressable>
          </>
        )}
        {token ? (
          <View style={styles.row}>
            <Pressable style={[styles.primaryBtn, { flex: 1 }]} onPress={doPush} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>一键同步到云端</Text>}
            </Pressable>
            <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={doPull} disabled={busy}>
              <Text style={styles.secondaryBtnText}>从云端恢复</Text>
            </Pressable>
          </View>
        ) : null}
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        <Text style={styles.hint}>Android 模拟器使用 10.0.2.2 访问本机；真机请把 app.json 中 apiUrl 改为电脑局域网 IP。</Text>
      </Card>

      {token ? (
        <Card title="修改密码" subtitle="修改后其他设备将自动退出登录">
          <TextInput
            style={styles.input}
            placeholder="当前密码"
            placeholderTextColor="#9ca3af"
            value={pwCur}
            onChangeText={setPwCur}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder="新密码（至少 6 位）"
            placeholderTextColor="#9ca3af"
            value={pwNew1}
            onChangeText={setPwNew1}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder="确认新密码"
            placeholderTextColor="#9ca3af"
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

      {careers.length > 0 ? (
        <Card title="职业 / 学习路线" subtitle="切换后 Web 端学习路线随之切换，ICT 规划为固定内容">
          <View style={styles.chipWrap}>
            {careers.map((c) => {
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

      <Card title="每日背景图" subtitle="每天自动更换 Bing 每日风景壁纸">
        <View style={styles.rowBetween}>
          <Text style={styles.rowLabel}>启用每日壁纸</Text>
          <Switch value={backgroundEnabled} onValueChange={toggleBackground} trackColor={{ true: "#e8930c" }} />
        </View>
      </Card>

      <Card title="数据" subtitle="本机数据保存在 AsyncStorage，无登录也可用">
        <View style={styles.rowBetween}>
          <Text style={styles.rowLabel}>
            进度 {Object.values(progress).filter((p) => p.done).length} · 任务 {tasks.length} · 日志 {logs.length}
          </Text>
        </View>
        <Pressable style={[styles.primaryBtn, styles.dangerBtn]} onPress={confirmReset}>
          <Text style={styles.primaryBtnText}>清空本机数据</Text>
        </Pressable>
      </Card>

      <Card title="关于" subtitle="学习工作台 v0.3">
        <Text style={styles.about}>Expo + React Native + 每日 Bing 壁纸 · 路线图内容来自《新疆ICT学习规划优化方案》</Text>
        <Text style={styles.about}>支持登录后一键同步云端，Web 与移动端数据保持一致。</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  hero: { paddingTop: 24, paddingBottom: 6, gap: 4 },
  heroTitle: { color: "#ffffff", fontSize: 24, fontWeight: "700" },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  row: { flexDirection: "row", gap: 8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowLabel: { fontSize: 14, color: "#18181b" },
  linkText: { fontSize: 14, color: "#e8930c", fontWeight: "600" },
  input: {
    backgroundColor: "rgba(24,24,27,0.04)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#18181b",
  },
  primaryBtn: { backgroundColor: "#e8930c", borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  secondaryBtn: {
    backgroundColor: "rgba(24,24,27,0.05)",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  dangerBtn: { backgroundColor: "#dc2626" },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  secondaryBtnText: { color: "#18181b", fontSize: 15, fontWeight: "600" },
  msg: { fontSize: 13, color: "#16a34a", fontWeight: "600" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipActive: { backgroundColor: "#e8930c" },
  chipIdle: { backgroundColor: "rgba(24,24,27,0.06)" },
  chipTextActive: { color: "#fff", fontSize: 13, fontWeight: "600" },
  chipTextIdle: { color: "#18181b", fontSize: 13 },
  hint: { fontSize: 12, color: "#9ca3af", lineHeight: 18 },
  about: { fontSize: 13, color: "#71717a", lineHeight: 19 },
});
