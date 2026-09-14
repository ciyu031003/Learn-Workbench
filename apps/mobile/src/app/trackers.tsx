import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { haptics } from "@/lib/haptics";
import { Card } from "@/components/card";
import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { domainIconName, fetchDomains, type DomainItem } from "@/lib/domains";
import {
  fetchTrackers,
  fetchTrackerLogs,
  upsertTracker,
  deleteTracker,
  upsertTrackerLog,
  todayLocal,
  type TrackerItem,
  type TrackerLogItem,
} from "@/lib/trackers";

const COLOR_PALETTE = [
  "#6366f1", "#2563eb", "#0ea5e9", "#2fb3a6", "#16a34a",
  "#7c3aed", "#ea580c", "#f59e0b", "#e11d48", "#3a342c",
];

/** 领域记录（Tracker）：通用计量项 + 按日打卡。挂「我的」域维度可读可写 */
export default function TrackersScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const token = useAppStore((s) => s.token);

  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [currentDomain, setCurrentDomain] = useState("ict");
  const [trackers, setTrackers] = useState<TrackerItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 新建计量项弹层
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [target, setTarget] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly" | null>(null);
  const [color, setColor] = useState(COLOR_PALETTE[0]);

  // 打卡弹层
  const [logOpen, setLogOpen] = useState<TrackerItem | null>(null);
  const [logValue, setLogValue] = useState("");
  const [logNote, setLogNote] = useState("");
  const [logHistory, setLogHistory] = useState<TrackerLogItem[]>([]);

  const loadTrackers = useCallback(async (domainKey: string) => {
    if (!token) {
      setTrackers([]);
      return;
    }
    setLoading(true);
    try {
      setTrackers(await fetchTrackers(domainKey));
    } catch {
      setTrackers([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const load = useCallback(async () => {
    try {
      const data = await fetchDomains();
      const list = data.domains ?? [];
      setDomains(list);
      let cur = "ict";
      try {
        const curRes = await fetch(getApiUrl() + "/api/settings/career");
        const curData = await curRes.json();
        if (typeof curData?.career === "string") cur = curData.career;
      } catch {
        // 保持默认
      }
      setCurrentDomain(cur);
      await loadTrackers(cur);
    } catch {
      setDomains([]);
      setLoading(false);
    }
  }, [loadTrackers]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const pickDomain = async (key: string) => {
    setCurrentDomain(key);
    await loadTrackers(key);
  };

  const openCreate = () => {
    setName("");
    setUnit("");
    setTarget("");
    setCadence(null);
    setColor(COLOR_PALETTE[0]);
    setCreateOpen(true);
  };

  const saveCreate = async () => {
    if (!token || !name.trim()) {
      setMsg("请输入记录项名称");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await upsertTracker({
        career: currentDomain,
        name: name.trim(),
        unit: unit.trim(),
        targetValue: target.trim() ? Number(target.trim()) : null,
        targetCadence: cadence,
        color,
      });
      haptics.success();
      setCreateOpen(false);
      await loadTrackers(currentDomain);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const openLog = async (t: TrackerItem) => {
    setLogOpen(t);
    setLogValue("");
    setLogNote("");
    setLogHistory([]);
    try {
      setLogHistory(await fetchTrackerLogs(t.id, 15));
    } catch {
      setLogHistory([]);
    }
  };

  const saveLog = async () => {
    if (!logOpen) return;
    const v = Number(logValue);
    if (!Number.isFinite(v)) {
      setMsg("请输入有效数值");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await upsertTrackerLog({
        trackerId: logOpen.id,
        logDate: todayLocal(),
        value: v,
        note: logNote.trim() || undefined,
      });
      haptics.success();
      setLogOpen(null);
      await loadTrackers(currentDomain);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const doDeleteTracker = (t: TrackerItem) => {
    Alert.alert("删除记录项", `将删除「${t.name}」及其全部记录。`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => {
          setBusy(true);
          deleteTracker(t.id)
            .then(async () => {
              haptics.warning();
              await loadTrackers(currentDomain);
            })
            .catch((e: unknown) => setMsg(e instanceof Error ? e.message : "删除失败"))
            .finally(() => setBusy(false));
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <ThemedIcon name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>领域记录</Text>
        <Pressable onPress={openCreate} hitSlop={12} style={styles.backBtn}>
          <ThemedIcon name="add" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!token ? (
          <Card title="未登录" subtitle="登录后可按领域记录计量与打卡">
            <Text style={styles.hint}>在「我的」页登录后，可为英语单词量、训练量、跑量等建立通用记录并每日打卡。</Text>
          </Card>
        ) : (
          <>
            {domains.length > 1 ? (
              <Card title="领域" subtitle="切换查看不同领域的记录项">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroller}>
                  {domains.map((d) => {
                    const active = d.career_key === currentDomain;
                    return (
                      <Pressable
                        key={d.career_key}
                        onPress={() => void pickDomain(d.career_key)}
                        style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
                      >
                        <ThemedIcon name={domainIconName(d.icon)} size={14} color={active ? "#fff" : d.color} />
                        <Text style={active ? styles.chipTextActive : styles.chipTextIdle}>{d.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Card>
            ) : null}

            {loading ? (
              <ActivityIndicator color={colors.primary} style={styles.loading} />
            ) : trackers.length === 0 ? (
              <Card title="暂无记录项" subtitle="点右上角＋新建计量项">
                <Text style={styles.hint}>例如「单词量（个/日）」跟踪英语学习，「训练时长（分钟/日）」跟踪运动。</Text>
              </Card>
            ) : (
              trackers.map((t) => {
                return (
                  <Card key={t.id} title={t.name} subtitle={t.target_value != null ? `目标 ${t.target_value} ${t.unit}${t.target_cadence ? "（" + (t.target_cadence === "weekly" ? "每周" : "每日") + "）" : ""}` : t.unit || undefined}>
                    <View style={styles.trackerRow}>
                      <View style={[styles.trackerDot, { backgroundColor: t.color }]} />
                      <PressableScale style={styles.trackerLogBtn} onPress={() => void openLog(t)} disabled={busy}>
                        <Text style={styles.trackerLogText}>打卡</Text>
                      </PressableScale>
                      <Pressable onPress={() => doDeleteTracker(t)} hitSlop={8}>
                        <ThemedIcon name="trash-outline" size={16} color={colors.textFaint} />
                      </Pressable>
                    </View>
                  </Card>
                );
              })
            )}

            {msg ? <Text style={styles.msg}>{msg}</Text> : null}
          </>
        )}
      </ScrollView>

      {createOpen ? (
        <View style={[styles.modalMask, { backgroundColor: colors.scrim }]}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>新建记录项</Text>
            <TextInput style={styles.input} placeholder="名称（如：单词量）" placeholderTextColor={colors.textFaint} value={name} onChangeText={setName} autoFocus />
            <TextInput style={styles.input} placeholder="单位（如：个、分钟、公里）" placeholderTextColor={colors.textFaint} value={unit} onChangeText={setUnit} />
            <TextInput style={styles.input} placeholder="目标值（可选）" placeholderTextColor={colors.textFaint} value={target} onChangeText={setTarget} keyboardType="numeric" />
            <View style={styles.cadenceRow}>
              {(["daily", "weekly"] as const).map((c) => (
                <Pressable key={c} onPress={() => setCadence(cadence === c ? null : c)} style={[styles.cadenceChip, cadence === c && styles.cadenceChipActive]}>
                  <Text style={[styles.cadenceText, cadence === c && styles.cadenceTextActive]}>{c === "daily" ? "每日" : "每周"}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.palette}>
              {COLOR_PALETTE.map((c) => (
                <Pressable key={c} onPress={() => setColor(c)} style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]} />
              ))}
            </View>
            <View style={styles.row}>
              <PressableScale style={[styles.btn, styles.btnGhost]} onPress={() => setCreateOpen(false)}>
                <Text style={styles.btnGhostText}>取消</Text>
              </PressableScale>
              <PressableScale style={[styles.btn, styles.btnPrimary]} onPress={() => void saveCreate()} disabled={busy || !name.trim()}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>新建</Text>}
              </PressableScale>
            </View>
          </View>
        </View>
      ) : null}

      {logOpen ? (
        <View style={[styles.modalMask, { backgroundColor: colors.scrim }]}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>记录 · {logOpen.name}</Text>
            <Text style={styles.logDate}>日期 {todayLocal()}{logOpen.unit ? " · 单位 " + logOpen.unit : ""}</Text>
            <TextInput
              style={styles.input}
              placeholder="今日数值"
              placeholderTextColor={colors.textFaint}
              value={logValue}
              onChangeText={setLogValue}
              keyboardType="numeric"
              autoFocus
            />
            <TextInput style={styles.input} placeholder="备注（可选）" placeholderTextColor={colors.textFaint} value={logNote} onChangeText={setLogNote} />
            {logHistory.length > 0 ? (
              <View style={styles.historyBox}>
                <Text style={styles.historyTitle}>最近记录</Text>
                {logHistory.slice(0, 5).map((l) => (
                  <View key={l.id} style={styles.historyRow}>
                    <Text style={styles.historyDate}>{l.log_date}</Text>
                    <Text style={styles.historyValue}>{l.value}{logOpen.unit ? " " + logOpen.unit : ""}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.row}>
              <PressableScale style={[styles.btn, styles.btnGhost]} onPress={() => setLogOpen(null)}>
                <Text style={styles.btnGhostText}>取消</Text>
              </PressableScale>
              <PressableScale style={[styles.btn, styles.btnPrimary]} onPress={() => void saveLog()} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>保存</Text>}
              </PressableScale>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: "transparent" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10 },
    backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 48, gap: 12 },
    loading: { marginVertical: 24 },
    hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18, paddingHorizontal: 4 },
    msg: { fontSize: 13, color: colors.success, fontWeight: "600", paddingHorizontal: 4 },
    chipScroller: { flexDirection: "row", gap: 8, paddingVertical: 2 },
    chip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
    chipActive: { backgroundColor: colors.primary },
    chipIdle: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    chipTextActive: { color: "#fff", fontSize: 13, fontWeight: "600" },
    chipTextIdle: { color: colors.text, fontSize: 13 },
    trackerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    trackerDot: { width: 10, height: 10, borderRadius: 5 },
    trackerLogBtn: { flex: 1, backgroundColor: colors.primarySoft, borderRadius: 12, paddingVertical: 9, alignItems: "center" },
    trackerLogText: { fontSize: 13, fontWeight: "700", color: colors.primary },
    modalMask: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", padding: 24 },
    modal: { width: "100%", backgroundColor: colors.surfaceStrong, borderRadius: 20, padding: 20, gap: 12 },
    modalTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
    logDate: { fontSize: 12, color: colors.textMuted },
    input: {
      backgroundColor: colors.surface, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
      paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text,
    },
    cadenceRow: { flexDirection: "row", gap: 8 },
    cadenceChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    cadenceChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    cadenceText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
    cadenceTextActive: { color: "#fff" },
    palette: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    swatch: { width: 30, height: 30, borderRadius: 15 },
    swatchActive: { borderWidth: 3, borderColor: "#fff" },
    row: { flexDirection: "row", gap: 8, marginTop: 4 },
    btn: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
    btnGhost: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    btnGhostText: { color: colors.text, fontSize: 14, fontWeight: "600" },
    btnPrimary: { backgroundColor: colors.primary },
    btnPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    historyBox: { gap: 4, backgroundColor: colors.surface, borderRadius: 12, padding: 10 },
    historyTitle: { fontSize: 12, color: colors.textMuted, fontWeight: "700", marginBottom: 2 },
    historyRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
    historyDate: { fontSize: 12, color: colors.textMuted },
    historyValue: { fontSize: 12, color: colors.text, fontWeight: "600" },
  });
