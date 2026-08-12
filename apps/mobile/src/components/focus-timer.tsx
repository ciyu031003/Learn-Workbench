import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "@/config";
import { computeFocusStats, FOCUS_MOTIVATIONS } from "@/lib/focus-stats";
import type { FocusSession } from "@learn-workbench/shared";

const PRESETS = [15, 25, 45];
const GALLERY = [
  { id: "sunset", name: "黄昏暖阳", color: "#7c2d12" },
  { id: "ocean", name: "深海蓝", color: "#0f2027" },
  { id: "forest", name: "森野绿", color: "#134e5e" },
  { id: "aurora", name: "极光紫", color: "#41295a" },
  { id: "midnight", name: "午夜蓝", color: "#0b1026" },
  { id: "candy", name: "糖果粉", color: "#831843" },
  { id: "bing", name: "每日 Bing", color: "#1f2937" },
];
const COLORS = ["#0f172a", "#1f2937", "#7c2d12", "#7f1d1d", "#14532d", "#1e3a8a", "#4c1d95", "#831843"];

const K_COLOR = "focus-bg-color";
const K_URL = "focus-bg-url";
const K_MODE = "focus-bg-mode";
const K_GALLERY = "focus-bg-gallery";
const K_QUOTE = "focus-quote";
const K_MINUTES = "focus-minutes";

type BgMode = "gallery" | "color" | "upload";

const ABS_FILL = { position: "absolute" as const, left: 0, right: 0, top: 0, bottom: 0 };

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

export function FocusTimer({
  open,
  task,
  sessions,
  onClose,
  onRecorded,
}: {
  open: boolean;
  task: { id: number | null; title: string | null } | null;
  sessions: FocusSession[];
  onClose: () => void;
  onRecorded: (taskId: number | null, seconds: number) => void;
}) {
  const [mode, setMode] = useState<BgMode>("gallery");
  const [color, setColor] = useState("#0f172a");
  const [url, setUrl] = useState<string | null>(null);
  const [galleryId, setGalleryId] = useState("sunset");
  const [bing, setBing] = useState<string | null>(null);

  const [minutes, setMinutes] = useState(25);
  const [total, setTotal] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [recording, setRecording] = useState(false);
  const [quote, setQuote] = useState(FOCUS_MOTIVATIONS[Math.floor(Math.random() * FOCUS_MOTIVATIONS.length)]);
  const [editingQuote, setEditingQuote] = useState(false);
  const [quoteInput, setQuoteInput] = useState("");
  const [showBg, setShowBg] = useState(false);
  const [customMin, setCustomMin] = useState("");

  const startRef = useRef<number | null>(null);
  const remainingRef = useRef(25 * 60);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringScale = useRef(new Animated.Value(1)).current;

  // 初始化偏好
  useEffect(() => {
    (async () => {
      try {
        const [m, c, u, g, q, mins] = await Promise.all([
          AsyncStorage.getItem(K_MODE),
          AsyncStorage.getItem(K_COLOR),
          AsyncStorage.getItem(K_URL),
          AsyncStorage.getItem(K_GALLERY),
          AsyncStorage.getItem(K_QUOTE),
          AsyncStorage.getItem(K_MINUTES),
        ]);
        if (m) setMode(m as BgMode);
        if (c) setColor(c);
        if (u) setUrl(u);
        if (g) setGalleryId(g);
        if (q) setQuote(q);
        if (mins) {
          const v = Math.min(180, Math.max(1, Number(mins) || 25));
          setMinutes(v);
          setTotal(v * 60);
          setRemaining(v * 60);
          remainingRef.current = v * 60;
        }
      } catch {
        // 忽略
      }
    })();
  }, []);

  // 打开：自动开始 + 加载每日 Bing
  useEffect(() => {
    if (!open) return;
    setDone(false);
    setRecording(false);
    setRemaining(total);
    remainingRef.current = total;
    startRef.current = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRunning(true);
    timer.current = setInterval(tick, 1000);

    let alive = true;
    if (galleryId === "bing") {
      fetch(`${API_URL}/api/background`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { exists?: boolean; date?: string } | null) => {
          if (alive && d?.exists && d.date) setBing(`${API_URL}/api/background/img?date=${encodeURIComponent(d.date)}`);
          else setBing(null);
        })
        .catch(() => setBing(null));
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const tick = () => {
    const next = Math.max(0, remainingRef.current - 1);
    remainingRef.current = next;
    setRemaining(next);
    if (next === 0) {
      setRunning(false);
      setDone(true);
      if (timer.current) clearInterval(timer.current);
    }
  };

  // 环形缩放动画
  useEffect(() => {
    const ratio = total > 0 ? remaining / total : 0;
    Animated.timing(ringScale, {
      toValue: 0.6 + 0.4 * ratio,
      duration: 900,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const persist = async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // 忽略
    }
  };

  const switchMode = (m: BgMode) => {
    setMode(m);
    persist(K_MODE, m);
  };
  const pickColor = (c: string) => {
    setColor(c);
    persist(K_COLOR, c);
  };
  const pickGallery = (g: string) => {
    setGalleryId(g);
    persist(K_GALLERY, g);
  };
  const setCustomUrl = (u: string) => {
    setUrl(u);
    persist(K_URL, u);
  };
  const setMin = (m: number) => {
    const v = Math.min(180, Math.max(1, m));
    setMinutes(v);
    setTotal(v * 60);
    setRemaining(v * 60);
    remainingRef.current = v * 60;
    setRunning(false);
    startRef.current = null;
    setDone(false);
    if (timer.current) clearInterval(timer.current);
    persist(K_MINUTES, String(v));
  };

  const pause = () => {
    if (timer.current) clearInterval(timer.current);
    setRunning(false);
  };
  const resume = () => {
    if (timer.current) clearInterval(timer.current);
    if (startRef.current === null) startRef.current = Date.now() - (total - remaining) * 1000;
    setRunning(true);
    timer.current = setInterval(tick, 1000);
  };
  const reset = () => {
    if (timer.current) clearInterval(timer.current);
    setRunning(false);
    setRemaining(total);
    remainingRef.current = total;
    startRef.current = null;
    setDone(false);
  };

  const record = async (elapsedSeconds: number) => {
    if (recording) return;
    if (elapsedSeconds < 10) {
      onClose();
      return;
    }
    setRecording(true);
    onRecorded(task?.id ?? null, elapsedSeconds);
    setRecording(false);
    onClose();
  };

  const saveQuote = () => {
    const v = quoteInput.trim();
    if (v) {
      setQuote(v);
      persist(K_QUOTE, v);
    } else {
      setQuote(FOCUS_MOTIVATIONS[Math.floor(Math.random() * FOCUS_MOTIVATIONS.length)]);
      persist(K_QUOTE, "");
    }
    setEditingQuote(false);
  };

  const shareCard = async () => {
    const stats = computeFocusStats(sessions);
    const msg = [
      "📚 学习工作台 · 专注打卡",
      `📅 ${stats.date}`,
      `🔥 连续专注 ${stats.streak} 天 ｜ 累计专注 ${stats.totalFocusDays} 天`,
      `⏱ 今日专注 ${stats.todaySessions} 次 · ${stats.todayMinutes} 分钟`,
      "",
      `💪 ${FOCUS_MOTIVATIONS[Math.min(stats.streak, FOCUS_MOTIVATIONS.length - 1)]}`,
    ].join("\n");
    try {
      await Share.share({ message: msg });
    } catch {
      // 忽略
    }
  };

  const ratio = total > 0 ? remaining / total : 0;
  const elapsed = total - remaining;
  const stats = computeFocusStats(sessions);
  const maxMin = Math.max(1, ...stats.last14.map((d) => d.minutes));
  const bgColor = mode === "color" ? color : mode === "upload" ? "#1f2937" : (GALLERY.find((g) => g.id === galleryId)?.color ?? "#1f2937");
  const showImage = mode === "upload" && !!url;
  const showBing = mode === "gallery" && galleryId === "bing" && !!bing;

  return (
    <Modal visible={open} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => record(elapsed)}>
      <View style={styles.root}>
        {/* 背景层 */}
        {showImage ? <Image source={{ uri: url! }} style={ABS_FILL} resizeMode="cover" /> : null}
        {showBing ? <Image source={{ uri: bing! }} style={ABS_FILL} resizeMode="cover" /> : null}
        {!showImage && !showBing ? <View style={[ABS_FILL, { backgroundColor: bgColor }]} /> : null}
        <View style={[ABS_FILL, styles.scrim]} />
        <View style={[ABS_FILL, styles.glow]} />

        {/* 顶部：背景切换 + 关闭 */}
        <View style={styles.topBar}>
          <Pressable style={styles.topBtn} onPress={() => setShowBg((v) => !v)}>
            <Text style={styles.topBtnText}>🎨 背景</Text>
          </Pressable>
          <Pressable style={styles.topBtn} onPress={() => record(elapsed)}>
            <Text style={styles.topBtnText}>✕</Text>
          </Pressable>
        </View>

        {showBg ? (
          <View style={styles.bgPanel}>
            <View style={styles.bgModes}>
              {([
                { key: "gallery", label: "默认图库" },
                { key: "color", label: "纯色" },
                { key: "upload", label: "自定义图片" },
              ] as { key: BgMode; label: string }[]).map((m) => (
                <Pressable key={m.key} style={[styles.bgModeBtn, mode === m.key && styles.bgModeBtnActive]} onPress={() => switchMode(m.key)}>
                  <Text style={[styles.bgModeText, mode === m.key && styles.bgModeTextActive]}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
            {mode === "color" ? (
              <View style={styles.swatches}>
                {COLORS.map((c) => (
                  <Pressable key={c} onPress={() => pickColor(c)} style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]} />
                ))}
              </View>
            ) : null}
            {mode === "upload" ? (
              <View style={styles.urlRow}>
                <TextInput
                  style={styles.urlInput}
                  placeholder="粘贴图片 URL（https://…）"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={url ?? ""}
                  onChangeText={setCustomUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ) : null}
            {mode === "gallery" ? (
              <View style={styles.gallery}>
                {GALLERY.map((g) => (
                  <Pressable key={g.id} onPress={() => pickGallery(g.id)} style={[styles.galleryItem, { backgroundColor: g.color }, galleryId === g.id && styles.galleryItemActive]}>
                    <Text style={styles.galleryText}>{g.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <ScrollView contentContainerStyle={styles.center} showsVerticalScrollIndicator={false}>
          {done ? (
            <View style={styles.doneWrap}>
              <Text style={styles.doneTitle}>🎉 专注完成！</Text>
              <Text style={styles.doneSub}>本次专注 {fmt(elapsed)}，已自动记录</Text>
              <View style={styles.statGrid}>
                {[
                  { label: "累计专注", value: `${stats.totalFocusDays} 天` },
                  { label: "连续专注", value: `${stats.streak} 天` },
                  { label: "今日次数", value: `${stats.todaySessions} 次` },
                  { label: "今日时长", value: `${stats.todayMinutes} 分` },
                ].map((s) => (
                  <View key={s.label} style={styles.statBox}>
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.quoteText}>{FOCUS_MOTIVATIONS[Math.min(stats.streak, FOCUS_MOTIVATIONS.length - 1)]}</Text>
              <Pressable style={styles.primaryBtn} onPress={shareCard}>
                <Text style={styles.primaryBtnText}>分享打卡卡片</Text>
              </Pressable>
              <View style={styles.doneBtns}>
                <Pressable style={styles.secondaryBtn} onPress={() => { reset(); resume(); }}>
                  <Text style={styles.secondaryBtnText}>再来一次</Text>
                </Pressable>
                <Pressable style={styles.primaryBtn} onPress={onClose}>
                  <Text style={styles.primaryBtnText}>返回任务页</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {/* 任务名 + 状态 */}
              <View style={styles.taskWrap}>
                <Text style={styles.taskName} numberOfLines={1}>{task?.title ?? "自由专注"}</Text>
                <Text style={styles.taskStatus}>
                  {running ? "● 专注中 · 保持节奏" : "❚❚ 已暂停"}
                </Text>
              </View>

              {/* 环形进度 + 数字时钟 */}
              <View style={[styles.ringWrap, { width: 300, height: 300 }]}>
                <View style={[styles.ringTrack, { width: 300, height: 300, borderRadius: 150 }]} />
                <Animated.View style={[styles.ringProgress, { width: 300, height: 300, borderRadius: 150, transform: [{ scale: ringScale }] }]} />
                <Pressable style={styles.clockWrap} onPress={() => (running ? pause() : resume())}>
                  <Text style={styles.clock}>{fmt(remaining)}</Text>
                </Pressable>
              </View>

              {/* 控制按钮 */}
              <View style={styles.controls}>
                <Pressable style={styles.ctrlBtn} onPress={() => (running ? pause() : resume())}>
                  <Text style={styles.ctrlText}>{running ? "⏸" : "▶"}</Text>
                </Pressable>
                <Pressable style={styles.ctrlBtn} onPress={reset}>
                  <Text style={styles.ctrlText}>↺</Text>
                </Pressable>
                <Pressable style={styles.ctrlBtn} onPress={() => record(elapsed)}>
                  <Text style={styles.ctrlText}>⏹</Text>
                </Pressable>
              </View>

              {/* 时长选择 */}
              <View style={styles.presets}>
                {PRESETS.map((m) => (
                  <Pressable key={m} style={[styles.presetChip, minutes === m && styles.presetChipActive]} onPress={() => setMin(m)}>
                    <Text style={[styles.presetText, minutes === m && styles.presetTextActive]}>{m} 分钟</Text>
                  </Pressable>
                ))}
                <View style={styles.customMin}>
                  <TextInput
                    style={styles.customMinInput}
                    placeholder="自定义"
                    placeholderTextColor="rgba(255,255,255,0.45)"
                    keyboardType="number-pad"
                    value={customMin}
                    onChangeText={(t) => {
                      setCustomMin(t);
                      const v = Number(t);
                      if (v >= 1 && v <= 180) setMin(v);
                    }}
                  />
                  <Text style={styles.customMinUnit}>分</Text>
                </View>
              </View>

              {/* 励志短句 */}
              <View style={styles.quoteCard}>
                <View style={styles.quoteHeader}>
                  <Text style={styles.quoteLabel}>✨ 励志短句</Text>
                  <Pressable onPress={() => { setEditingQuote((v) => !v); setQuoteInput(quote); }} hitSlop={8}>
                    <Text style={styles.quoteEdit}>{editingQuote ? "取消" : "编辑"}</Text>
                  </Pressable>
                </View>
                {editingQuote ? (
                  <View style={styles.quoteEditRow}>
                    <TextInput
                      style={styles.quoteInput}
                      placeholder="输入你的励志短句…"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      value={quoteInput}
                      onChangeText={setQuoteInput}
                    />
                    <Pressable style={styles.quoteSave} onPress={saveQuote}>
                      <Text style={styles.quoteSaveText}>保存</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.quoteText}>{quote}</Text>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  scrim: { backgroundColor: "rgba(0,0,0,0.32)" },
  glow: { backgroundColor: "rgba(232,147,12,0.10)" },
  topBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, zIndex: 20 },
  topBtn: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  topBtnText: { color: "rgba(255,255,255,0.9)", fontSize: 13 },
  bgPanel: { marginHorizontal: 16, marginTop: 10, backgroundColor: "rgba(20,20,26,0.55)", borderRadius: 18, padding: 12, zIndex: 20 },
  bgModes: { flexDirection: "row", gap: 8, marginBottom: 10 },
  bgModeBtn: { flex: 1, borderRadius: 10, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center" },
  bgModeBtnActive: { backgroundColor: "rgba(232,147,12,0.4)" },
  bgModeText: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  bgModeTextActive: { color: "#fff", fontWeight: "600" },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" },
  swatchActive: { borderColor: "#fff", transform: [{ scale: 1.12 }] },
  urlRow: { gap: 6 },
  urlInput: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: "#fff",
    fontSize: 13,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  galleryItem: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  galleryItemActive: { borderColor: "#fff" },
  galleryText: { color: "#fff", fontSize: 12 },
  center: { flexGrow: 1, alignItems: "center", padding: 20, paddingBottom: 40, gap: 20 },
  taskWrap: { alignItems: "center", gap: 6 },
  taskName: { color: "#fff", fontSize: 16, fontWeight: "600", maxWidth: "85%" },
  taskStatus: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  ringWrap: { alignItems: "center", justifyContent: "center" },
  ringTrack: { position: "absolute", borderWidth: 10, borderColor: "rgba(255,255,255,0.16)" },
  ringProgress: { position: "absolute", borderWidth: 12, borderColor: "#ffb25e" },
  clockWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  clock: { color: "#fff", fontSize: 62, fontWeight: "800", fontVariant: ["tabular-nums"] },
  controls: { flexDirection: "row", gap: 22 },
  ctrlBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlText: { color: "#fff", fontSize: 22 },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  presetChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  presetChipActive: { backgroundColor: "rgba(232,147,12,0.4)", borderColor: "rgba(232,147,12,0.7)" },
  presetText: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  presetTextActive: { color: "#fff", fontWeight: "600" },
  customMin: { flexDirection: "row", alignItems: "center", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  customMinInput: { color: "#fff", fontSize: 13, width: 56, textAlign: "center" },
  customMinUnit: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  quoteCard: { width: "100%", maxWidth: 420, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  quoteHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  quoteLabel: { color: "#ffb25e", fontSize: 12, fontWeight: "600" },
  quoteEdit: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  quoteEditRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  quoteInput: { flex: 1, color: "#fff", fontSize: 14, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  quoteSave: { backgroundColor: "rgba(232,147,12,0.5)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  quoteSaveText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  quoteText: { color: "rgba(255,255,255,0.92)", fontSize: 14, lineHeight: 21 },
  doneWrap: { alignItems: "center", gap: 14, width: "100%" },
  doneTitle: { color: "#fff", fontSize: 26, fontWeight: "800" },
  doneSub: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  statBox: { width: "46%", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  statValue: { color: "#fff", fontSize: 22, fontWeight: "800" },
  statLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 3 },
  primaryBtn: { backgroundColor: "#e8930c", borderRadius: 999, paddingHorizontal: 26, paddingVertical: 12, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryBtn: { backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12, alignItems: "center" },
  secondaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  doneBtns: { flexDirection: "row", gap: 12 },
});
