import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useAppStore } from "@/store/app-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEFAULT_API_URL, getApiUrl } from "@/config";
import { apiLogin, syncPush, syncPull } from "@/lib/sync";
import { useSyncEngineStatus } from "@/lib/sync-engine";
import { fetchJobConfig, fetchJobRuns, fetchJobStats, runCrawler as runJobsCrawler, saveJobConfig as saveJobsConfig } from "@/lib/jobs";
import { allJobCategories, defaultCrawlerConfig, experimentalJobSources, formatRelativeTime, jobCategoryLabels, jobSourceLabels, type JobCrawlerConfig, type JobRun, type JobSource, type JobStats } from "@learn-workbench/shared";
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
  const apiUrlFromStore = useAppStore((s) => s.apiUrl);
  const setApiUrl = useAppStore((s) => s.setApiUrl);
  const [apiUrlInput, setApiUrlInput] = useState(apiUrlFromStore ?? "");

  const [jobConfig, setJobConfig] = useState<JobCrawlerConfig>(defaultCrawlerConfig);
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  const [jobRuns, setJobRuns] = useState<JobRun[]>([]);
  const [jobBusy, setJobBusy] = useState(false);
  const [jobMsg, setJobMsg] = useState<string | null>(null);
  const [keywordInput, setKeywordInput] = useState("");
  const [industryInput, setIndustryInput] = useState("");
  const [cityInput, setCityInput] = useState("");

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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const config = await fetchJobConfig();
        if (alive) setJobConfig(config);
      } catch {
        // 保留默认配置，待用户手动保存
      }
      try {
        const stats = await fetchJobStats();
        if (alive) setJobStats(stats);
      } catch {
        // 后端未启动时保留空态
      }
      try {
        const runs = await fetchJobRuns();
        if (alive) setJobRuns(runs);
      } catch {
        // 运行记录为空时不阻塞设置页
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const saveApiUrl = () => {
    const v = apiUrlInput.trim().replace(/\/+$/, "");
    setApiUrl(v || DEFAULT_API_URL);
    setMsg(v ? "服务地址已保存：" + v : "已恢复默认：" + DEFAULT_API_URL);
  };

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
      setMsg("已从云端拉取增量更新");
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

  const patchJobConfig = (patch: Partial<JobCrawlerConfig>) => {
    setJobConfig((prev) => ({ ...prev, ...patch }));
  };

  const addStringField = (field: "keywords" | "industries" | "cities", value: string) => {
    const v = value.trim();
    if (!v) return;
    if (field === "keywords") setKeywordInput("");
    if (field === "industries") setIndustryInput("");
    if (field === "cities") setCityInput("");
    setJobConfig((prev) => {
      if (prev[field].includes(v)) return prev;
      return { ...prev, [field]: [...prev[field], v] };
    });
  };

  const removeStringField = (field: "keywords" | "industries" | "cities", value: string) => {
    setJobConfig((prev) => ({ ...prev, [field]: prev[field].filter((x) => x !== value) }));
  };

  const toggleJobPlatform = (source: JobSource) => {
    setJobConfig((prev) => {
      const enabled = prev.platforms.includes(source);
      return {
        ...prev,
        platforms: enabled ? prev.platforms.filter((p) => p !== source) : [...prev.platforms, source],
      };
    });
  };

  const persistJobConfig = async () => {
    if (!/^\d{2}:\d{2}$/.test(jobConfig.scheduleTime)) {
      setJobMsg("抓取时间格式应为 HH:mm，例如 08:00");
      return;
    }
    setJobBusy(true);
    setJobMsg(null);
    try {
      const saved = await saveJobsConfig(jobConfig);
      setJobConfig(saved);
      setJobMsg("招聘爬虫配置已保存");
    } catch (e) {
      setJobMsg(e instanceof Error ? e.message : "配置保存失败");
    } finally {
      setJobBusy(false);
    }
  };

  const refreshJobRunStatus = async () => {
    try {
      const [stats, runs] = await Promise.all([fetchJobStats(), fetchJobRuns()]);
      setJobStats(stats);
      setJobRuns(runs);
    } catch {
      // 状态刷新失败时保留旧值
    }
  };

  const startJobsRun = async () => {
    if (!token) {
      Alert.alert("请先登录", "执行抓取任务需要先登录。");
      return;
    }
    setJobBusy(true);
    setJobMsg(null);
    try {
      await runJobsCrawler();
      setJobMsg("抓取任务已启动，稍后刷新即可查看最新职位");
      await refreshJobRunStatus();
    } catch (e) {
      setJobMsg(e instanceof Error ? e.message : "启动抓取失败");
    } finally {
      setJobBusy(false);
    }
  };

  const renderEditableChips = (
    label: string,
    field: "keywords" | "industries" | "cities",
    values: string[],
    inputValue: string,
    setInput: (value: string) => void
  ) => (
    <View style={styles.chipBlock}>
      <Text style={styles.chipLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {values.map((value, index) => (
          <View key={value + "-" + index} style={styles.jobChip}>
            <Text style={styles.jobChipText}>{value}</Text>
            <Pressable hitSlop={8} onPress={() => removeStringField(field, value)}>
              <Text style={styles.jobChipX}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder={"输入" + label + "后回车添加"}
        placeholderTextColor="#9ca3af"
        value={inputValue}
        onChangeText={setInput}
        returnKeyType="done"
        onSubmitEditing={() => addStringField(field, inputValue)}
      />
    </View>
  );

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.heroTitle}>我的</Text>
        <Text style={styles.heroSub}>账号 · 偏好 · 职业方向 · 数据同步</Text>
      </View>

      {/* 云同步 */}
      <Card title="云同步" subtitle={"服务地址：" + getApiUrl()}>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="服务器地址（如 http://192.168.1.100:3001）"
            placeholderTextColor="#9ca3af"
            value={apiUrlInput}
            onChangeText={setApiUrlInput}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Pressable style={styles.secondaryBtn} onPress={saveApiUrl}>
            <Text style={styles.secondaryBtnText}>保存</Text>
          </Pressable>
        </View>
        {token ? (
          <View style={styles.rowBetween}>
            <Text style={styles.rowLabel}>已登录：{username}</Text>
            <Pressable onPress={() => setAuth(null, null)}>
              <Text style={styles.linkText}>退出</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.rowLabel}>{authMode === "login" ? "账号登录" : "注册新账号"}</Text>
              <Pressable onPress={() => {
                setAuthMode((mode) => (mode === "login" ? "register" : "login"));
                setPassInput("");
                setConfirmPass("");
                setMsg(null);
              }}>
                <Text style={styles.linkText}>{authMode === "login" ? "没有账号？注册" : "已有账号？登录"}</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="账号"
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
            {authMode === "register" ? (
              <TextInput
                style={styles.input}
                placeholder="确认密码"
                placeholderTextColor="#9ca3af"
                value={confirmPass}
                onChangeText={setConfirmPass}
                secureTextEntry
              />
            ) : null}
            <Pressable style={styles.primaryBtn} onPress={submitAuth} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{authMode === "login" ? "登录" : "注册"}</Text>}
            </Pressable>
          </View>
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
        <Text style={styles.hint}>
          {engine.syncing
            ? "Syncing…"
            : !engine.online
              ? `Offline mode: data is saved to this device first, and will be automatically uploaded to the cloud once the network connection is restored${pendingCount ? ` (${pendingCount} items pending sync)` : ""}`
              : !token
                ? "Network connected: after logging in, local data will be automatically synced to the cloud"
                : pendingCount
                  ? `Network connected: ${pendingCount} items pending sync, will be automatically uploaded shortly`
                  : `Local and cloud are in sync${lastSyncedAt ? ` (last synced at ${lastSyncedAt.slice(0, 16).replace("T", " ")})` : ""}`}
        </Text>
        <Text style={styles.hint}>默认连接 https://learn.yuanabd.cn（生产）；本地联调请在启动时设置 EXPO_PUBLIC_API_URL 与 EXPO_PUBLIC_ALLOW_CLEARTEXT=1，或在下方临时覆盖。</Text>
      </Card>

      {/* 招聘爬虫 */}
      <Card title="招聘爬虫" subtitle="招花 · 自动采集招聘信息">
        <View style={styles.rowBetween}>
          <Text style={styles.rowLabel}>自动抓取</Text>
          <Switch value={jobConfig.enabled} onValueChange={(value) => patchJobConfig({ enabled: value })} trackColor={{ true: "#10b981" }} />
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.rowLabel}>抓取时间</Text>
          <TextInput
            style={[styles.input, styles.scheduleInput]}
            value={jobConfig.scheduleTime}
            onChangeText={(value) => patchJobConfig({ scheduleTime: value })}
            placeholder="08:00"
            placeholderTextColor="#9ca3af"
            keyboardType="numbers-and-punctuation"
          />
        </View>

        {renderEditableChips("关键词", "keywords", jobConfig.keywords, keywordInput, setKeywordInput)}
        {renderEditableChips("行业", "industries", jobConfig.industries, industryInput, setIndustryInput)}
        {renderEditableChips("城市", "cities", jobConfig.cities, cityInput, setCityInput)}

        <Text style={styles.chipLabel}>抓取类别（考公考编 / 央国企）</Text>
        {allJobCategories.map((cat) => {
          const enabled = jobConfig.categories.includes(cat);
          return (
            <View key={cat} style={styles.rowBetween}>
              <Text style={styles.rowLabel}>{jobCategoryLabels[cat]}</Text>
              <Switch
                value={enabled}
                onValueChange={() =>
                  patchJobConfig({
                    categories: enabled
                      ? jobConfig.categories.filter((c) => c !== cat)
                      : [...jobConfig.categories, cat],
                  })
                }
                trackColor={{ true: "#10b981" }}
              />
            </View>
          );
        })}

        <Text style={styles.chipLabel}>招聘平台</Text>
        {(Object.keys(jobSourceLabels) as JobSource[]).map((source) => {
          const enabled = jobConfig.platforms.includes(source);
          const experimental = experimentalJobSources.includes(source);
          return (
            <View key={source} style={styles.rowBetween}>
              <Text style={styles.rowLabel}>
                {jobSourceLabels[source]}
                {experimental ? " · 实验" : ""}
              </Text>
              <Switch value={enabled} onValueChange={() => toggleJobPlatform(source)} trackColor={{ true: "#10b981" }} />
            </View>
          );
        })}

        <View style={styles.row}>
          <Pressable style={[styles.primaryBtn, styles.jobsPrimaryBtn, { flex: 1 }]} onPress={persistJobConfig} disabled={jobBusy}>
            {jobBusy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryBtnText}>保存配置</Text>}
          </Pressable>
          <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={startJobsRun} disabled={jobBusy}>
            {jobBusy ? <ActivityIndicator color="#10b981" /> : <Text style={styles.secondaryBtnText}>立即抓取一次</Text>}
          </Pressable>
        </View>

        {jobMsg ? <Text style={styles.jobMsg}>{jobMsg}</Text> : null}
        <Text style={styles.hint}>
          上次运行：{jobStats?.lastRun ? formatRelativeTime(jobStats.lastRun) : "暂无"}
          {" · "}状态：{jobStats?.lastRunStatus ?? "—"}
          {jobRuns[0] ? " · 最近任务：" + jobRuns[0].status : ""}
        </Text>
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

      {domains.length > 0 ? (
        <Card title="学习领域" subtitle="切换后 Web 端学习路线随之切换；移动端路线图暂为内置内容副本">
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

      <Card title="每日背景图" subtitle="每天自动更换 Bing 每日风景壁纸">
        <View style={styles.rowBetween}>
          <Text style={styles.rowLabel}>启用每日壁纸</Text>
          <Switch value={backgroundEnabled} onValueChange={toggleBackground} trackColor={{ true: "#4f46e5" }} />
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

      <Card title="关于" subtitle="苦旅 v1.0.0">
        <Text style={styles.about}>Expo + React Native + 每日 Bing 壁纸 · 路线图内容来自《新疆ICT学习规划优化方案》</Text>
        <Text style={styles.about}>支持登录后一键同步云端，Web 与移动端数据保持一致。</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "transparent" },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  hero: { paddingTop: 24, paddingBottom: 6, gap: 4 },
  heroTitle: { color: colors.text, fontSize: 26, fontWeight: "800" },
  heroSub: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: "row", gap: 8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowLabel: { flex: 1, fontSize: 14, color: colors.text },
  linkText: { fontSize: 14, color: colors.primary, fontWeight: "600" },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  scheduleInput: { width: 96, textAlign: "center", fontWeight: "700" },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  secondaryBtn: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  jobsPrimaryBtn: { backgroundColor: colors.success },
  dangerBtn: { backgroundColor: colors.danger },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  secondaryBtnText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  msg: { fontSize: 13, color: colors.success, fontWeight: "600" },
  jobMsg: { fontSize: 13, color: colors.success, fontWeight: "600", lineHeight: 18 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipBlock: { gap: 7 },
  chipLabel: { fontSize: 12, color: colors.success, fontWeight: "700", marginTop: 2 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipActive: { backgroundColor: colors.primary },
  chipIdle: { backgroundColor: colors.surface },
  chipTextActive: { color: "#fff", fontSize: 13, fontWeight: "600" },
  chipTextIdle: { color: colors.text, fontSize: 13 },
  jobChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: `${colors.success}22`,
    borderWidth: 1,
    borderColor: `${colors.success}50`,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  jobChipText: { color: colors.success, fontSize: 13, fontWeight: "700" },
  jobChipX: { color: colors.success, fontSize: 16, lineHeight: 18, paddingLeft: 2 },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  about: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
});
