import { useEffect, useRef, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ScreenOrientation from "expo-screen-orientation";
import { getApiUrl } from "@/config";
import { computeFocusStats, FOCUS_MOTIVATIONS } from "@/lib/focus-stats";
import { RingProgress } from "@/components/ring-progress";
import { getDailyQuote } from "@/lib/quotes";
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
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

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
  const [started, setStarted] = useState(false);
  const [recording, setRecording] = useState(false);
  // eslint-disable-next-line react-hooks/purity -- useState 初始每日一言（既有模式）
  const [quote, setQuote] = useState(getDailyQuote());
  const [editingQuote, setEditingQuote] = useState(false);
  const [quoteInput, setQuoteInput] = useState("");
  const [showBg, setShowBg] = useState(false);
  const [customMin, setCustomMin] = useState("");

  const startRef = useRef<number | null>(null);
  const remainingRef = useRef(25 * 60);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
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
    if (open) {
      ScreenOrientation.unlockAsync().catch(() => {
        // 忽略某些设备不支持旋转
      });
      // 未自定义语录时，回到“每日一言”
      AsyncStorage.getItem(K_QUOTE)
        .then((saved) => {
          if (!saved) setQuote(getDailyQuote());
        })
        .catch(() => {
          // 忽略
        });
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {
        // 忽略
      });
    }

    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 打开弹层时重置状态（既有模式）
    setDone(false);
    setRecording(false);
    setRemaining(total);
    remainingRef.current = total;
    startRef.current = null;
    setStarted(false);

    let alive = true;
    if (galleryId === "bing") {
      fetch(`${getApiUrl()}/api/background`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { exists?: boolean; date?: string } | null) => {
          if (alive && d?.exists && d.date) setBing(`${getApiUrl()}/api/background/img?date=${encodeURIComponent(d.date)}`);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 打开弹层时重置状态（既有模式）
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
  const begin = () => {
    setStarted(true);
    resume();
  };

  const reset = () => {
    if (timer.current) clearInterval(timer.current);
    setRunning(false);
    setRemaining(total);
    remainingRef.current = total;
    startRef.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 打开弹层时重置状态（既有模式）
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
      setQuote(getDailyQuote());
      persist(K_QUOTE, "");
    }
    setEditingQuote(false);
  };

  const shareCard = async () => {
    const stats = computeFocusStats(sessions);
    const msg = [
      "📚 苦旅 · 专注打卡",
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
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <Pressable style={styles.topBtn} onPress={() => setShowBg((v) => !v)}>
            <View style={styles.topBtnInner}>
              <Ionicons name="color-palette-outline" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.topBtnText}>背景</Text>
            </View>
          </Pressable>
          <Pressable style={styles.topBtn} onPress={() => record(elapsed)}>
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.9)" />
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
              <View style={styles.doneTitleRow}>
                <Ionicons name="trophy" size={34} color="#FFB25E" />
                <Text style={styles.doneTitle}>专注完成！</Text>
              </View>
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
          ) : started ? (
            isLandscape ? (
              <View style={styles.landscapeWrap}>
                <View style={styles.landscapeTop}>
                  <Text style={styles.taskName} numberOfLines={1}>{task?.title ?? "自由专注"}</Text>
                  <Text style={styles.taskStatus}>{running ? "● 专注中" : "❚❚ 已暂停"}</Text>
                </View>
                <Pressable style={styles.landscapeClockWrap} onPress={() => (running ? pause() : resume())}>
                  <Text style={styles.landscapeClock}>{fmt(remaining)}</Text>
                  <Text style={styles.landscapeClockHint}>点击计时 · 暂停 / 继续</Text>
                </Pressable>
                <View style={styles.controls}>
                  <Pressable style={styles.ctrlBtn} onPress={() => (running ? pause() : resume())}>
                    <Ionicons name={running ? "pause" : "play"} size={26} color="#fff" />
                  </Pressable>
                  <Pressable style={styles.ctrlBtn} onPress={reset}>
                    <Ionicons name="refresh" size={26} color="#fff" />
                  </Pressable>
                  <Pressable style={styles.ctrlBtn} onPress={() => record(elapsed)}>
                    <Ionicons name="stop" size={26} color="#fff" />
                  </Pressable>
                </View>
                <Pressable style={styles.recordBtn} onPress={() => record(elapsed)}>
                  <Ionicons name="checkmark-done" size={18} color="#1f1f1f" />
                  <Text style={styles.recordBtnText}>结束并记录本次专注</Text>
                </Pressable>
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
              <View style={styles.ringWrap}>
                <RingProgress
                  size={300}
                  strokeWidth={14}
                  progress={1 - ratio}
                  trackColor="rgba(255,255,255,0.16)"
                  color="#FFB25E"
                />
                <Pressable style={styles.clockWrap} onPress={() => (running ? pause() : resume())}>
                  <Text style={styles.clock}>{fmt(remaining)}</Text>
                </Pressable>
              </View>

              {/* 控制按钮 */}
              <View style={styles.controls}>
                <Pressable style={styles.ctrlBtn} onPress={() => (running ? pause() : resume())}>
                  <Ionicons name={running ? "pause" : "play"} size={26} color="#fff" />
                </Pressable>
                <Pressable style={styles.ctrlBtn} onPress={reset}>
                  <Ionicons name="refresh" size={26} color="#fff" />
                </Pressable>
                <Pressable style={styles.ctrlBtn} onPress={() => record(elapsed)}>
                  <Ionicons name="stop" size={26} color="#fff" />
                </Pressable>
              </View>

              <Pressable style={styles.recordBtn} onPress={() => record(elapsed)}>
                <Ionicons name="checkmark-done" size={18} color="#1f1f1f" />
                <Text style={styles.recordBtnText}>结束并记录本次专注</Text>
              </Pressable>

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
                  <View style={styles.quoteLabelRow}>
                    <Ionicons name="sparkles" size={14} color="#FFB25E" />
                    <Text style={styles.quoteLabel}>励志短句</Text>
                  </View>
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
            )
          ) : (
            <View style={styles.readyWrap}>
              <Text style={styles.taskName} numberOfLines={1}>{task?.title ?? "自由专注"}</Text>
              <Text style={styles.readyTitle}>准备开始 {minutes} 分钟专注</Text>
              <Pressable style={styles.primaryBtn} onPress={begin}>
                <View style={styles.readyCtaInner}>
                  <Ionicons name="play" size={16} color="#1f1f1f" />
                  <Text style={styles.primaryBtnText}>开始专注</Text>
                </View>
              </Pressable>
              <Text style={styles.readyHint}>开始后将全屏沉浸 · 可随时暂停</Text>
            </View>
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
    justifyContent: "center",
  },
  topBtnInner: { flexDirection: "row", alignItems: "center", gap: 6 },
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
  clockWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  clock: { color: "#fff", fontSize: 62, fontWeight: "800", fontVariant: ["tabular-nums"] },
  landscapeWrap: { alignItems: "center", gap: 14, paddingVertical: 8 },
  landscapeTop: { alignItems: "center", gap: 3 },
  landscapeClockWrap: { alignItems: "center", gap: 6, paddingHorizontal: 24, paddingVertical: 6 },
  landscapeClock: { color: "#fff", fontSize: 64, fontWeight: "800", fontVariant: ["tabular-nums"], letterSpacing: 2 },
  landscapeClockHint: { color: "rgba(255,255,255,0.65)", fontSize: 12 },
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
  recordBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFB25E",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  recordBtnText: { color: "#1f1f1f", fontSize: 14, fontWeight: "700" },
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
  quoteLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  quoteLabel: { color: "#ffb25e", fontSize: 12, fontWeight: "600" },
  quoteEdit: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  quoteEditRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  quoteInput: { flex: 1, color: "#fff", fontSize: 14, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  quoteSave: { backgroundColor: "rgba(232,147,12,0.5)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  quoteSaveText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  quoteText: { color: "rgba(255,255,255,0.92)", fontSize: 14, lineHeight: 21 },
  doneWrap: { alignItems: "center", gap: 14, width: "100%" },
  doneTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  doneTitle: { color: "#fff", fontSize: 26, fontWeight: "800" },
  doneSub: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  statBox: { width: "46%", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  statValue: { color: "#fff", fontSize: 22, fontWeight: "800" },
  statLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 3 },
  primaryBtn: { backgroundColor: "#FFB25E", borderRadius: 999, paddingHorizontal: 26, paddingVertical: 12, alignItems: "center" },
  primaryBtnText: { color: "#1f1f1f", fontSize: 15, fontWeight: "700" },
  secondaryBtn: { backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12, alignItems: "center" },
  secondaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  doneBtns: { flexDirection: "row", gap: 12 },
  readyWrap: { alignItems: "center", gap: 16, paddingVertical: 48 },
  readyCtaInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  readyTitle: { color: "#fff", fontSize: 24, fontWeight: "800" },
  readyHint: { color: "rgba(255,255,255,0.55)", fontSize: 12, textAlign: "center" },
});
