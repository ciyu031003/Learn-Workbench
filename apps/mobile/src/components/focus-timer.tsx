import { useEffect, useRef, useState } from "react";
import {
  AppState,
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
import { Image as ExpoImage } from "expo-image";
import { ThemedIcon } from "@/components/themed-icon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ScreenOrientation from "expo-screen-orientation";
import { getApiUrl } from "@/config";
import { computeFocusStats, FOCUS_MOTIVATIONS } from "@/lib/focus-stats";
import { FocusShareSheet } from "@/components/focus-share-card";
import { focusShareDataFromStats } from "@/lib/focus-share";
import { elapsedSeconds } from "@/lib/focus-elapsed";
import { startFocusNotification, stopFocusNotification } from "@/lib/focus-notification";
import { RingProgress } from "@/components/ring-progress";
import { TimerDial } from "@/components/timer-dial";
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
/** v13 U3：计时主视图（圆环 / 表盘），默认圆环，选择沿用 AsyncStorage 持久化 */
const K_VIEW = "focus-timer-view";
type TimerView = "ring" | "dial";
/** Bing 壁纸 URL 最近一次解析结果（秒出图用；按天由服务端回退历史图，不会 404） */
const K_BING = "focus-bg-bing-v1";

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
  autoStart = false,
  initialTimerMode,
  initialMinutes,
  mode: sessionMode = "focus",
  exerciseLabel = null,
  onExerciseRecorded,
  contentLabel = null,
}: {
  open: boolean;
  task: { id: number | null; title: string | null } | null;
  sessions: FocusSession[];
  onClose: () => void;
  /** v5 P2-1：第三个参数是本次绑定的学习内容（写 focus_sessions.tag）；忽略它也能编译 */
  onRecorded: (taskId: number | null, seconds: number, label?: string | null) => void;
  /** v4 P2「一键开始」：打开即开始计时（跳过"准备开始"屏） */
  autoStart?: boolean;
  /** 打开时的计时模式（倒计时 / 正向秒表）；不传则沿用上次/默认 */
  initialTimerMode?: "countdown" | "stopwatch";
  /** 打开时的时长（分钟），例如一键学习 = 25 */
  initialMinutes?: number;
  /** 会话类型：exercise 时结束时把秒数交给 onExerciseRecorded（不再写专注 sessions） */
  mode?: "focus" | "exercise";
  exerciseLabel?: string | null;
  onExerciseRecorded?: (seconds: number, label: string | null) => void;
  /** 本次学习的内容名（"英语读写" / "阶段X · 主题Y"），随会话一起写入 tag */
  contentLabel?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [mode, setMode] = useState<BgMode>("gallery");
  const [color, setColor] = useState("#0f172a");
  const [url, setUrl] = useState<string | null>(null);
  // v4 P2：默认改为「每日 Bing」风景壁纸（Web 端早就是 bing；用户若手动选过其它背景，
  // 显式选择优先 —— 因为我们从不自动写入这个 key，所以"改默认值"对老用户同样生效）
  const [galleryId, setGalleryId] = useState("bing");
  const [bing, setBing] = useState<string | null>(null);

  const [minutes, setMinutes] = useState(25);
  const [total, setTotal] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [recording, setRecording] = useState(false);
  /** V3 计时模式：countdown=倒计时（既有），stopwatch=正向秒表 */
  const [timerMode, setTimerMode] = useState<"countdown" | "stopwatch">("countdown");
  /** v13 U3：主视图形态，默认仍是圆环 */
  const [timerView, setTimerView] = useState<TimerView>("ring");
  // eslint-disable-next-line react-hooks/purity -- useState 初始每日一言（既有模式）
  const [quote, setQuote] = useState(getDailyQuote());
  const [editingQuote, setEditingQuote] = useState(false);
  const [quoteInput, setQuoteInput] = useState("");
  const [showBg, setShowBg] = useState(false);
  const [customMin, setCustomMin] = useState("");

  const startRef = useRef<number | null>(null);
  /** 记录去重：同一帧内连点"记录"/Modal 关闭与按钮并发时，避免写两条 */
  const recordedRef = useRef(false);
  /** 倒计时自然结束时只自动记一次 */
  const autoRecordedRef = useRef(false);
  const remainingRef = useRef(25 * 60);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // V3 墙钟对时：累计跨暂停段的毫秒；startRef 为当前运行段墙钟起点。
  const accumulatedMsRef = useRef(0);
  const totalRef = useRef(25 * 60);
  const timerModeRef = useRef<"countdown" | "stopwatch">("countdown");
  // 初始化偏好
  useEffect(() => {
    (async () => {
      try {
        const [m, c, u, g, q, mins, view] = await Promise.all([
          AsyncStorage.getItem(K_MODE),
          AsyncStorage.getItem(K_COLOR),
          AsyncStorage.getItem(K_URL),
          AsyncStorage.getItem(K_GALLERY),
          AsyncStorage.getItem(K_QUOTE),
          AsyncStorage.getItem(K_MINUTES),
          AsyncStorage.getItem(K_VIEW),
        ]);
        if (view === "dial" || view === "ring") setTimerView(view);
        if (m) setMode(m as BgMode);
        if (c) setColor(c);
        if (u) setUrl(u);
        if (g) setGalleryId(g);
        if (q) setQuote(q);
        if (mins) {
          const v = Math.min(180, Math.max(1, Number(mins) || 25));
          // 调用方显式指定了时长/模式时以调用方为准
          //（"一键开始 → 学习 25 分钟"不该被历史偏好设置改掉）
          if (typeof initialMinutes !== "number" && !initialTimerMode) {
            setMinutes(v);
            setTotal(v * 60);
            totalRef.current = v * 60;
            setRemaining(v * 60);
            remainingRef.current = v * 60;
          }
        }
      } catch {
        // 忽略
      }
    })();
  }, []);

  // V3 同步计时模式到 ref（供事件/定时器闭包读取）
  useEffect(() => {
    timerModeRef.current = timerMode;
  }, [timerMode]);

  // 墙钟已跑秒数（后台 AppState 不暂停，靠 startRef 墙钟起点 + 累计推算）
  // ⚠️ 运行状态一律看 startRef（ref），**不能看 running（state）**：
  //    setInterval 注册的是「注册那一刻的闭包」，而 setRunning(true) 是异步的，
  //    若用 state 判断，interval 里的旧闭包永远读到 running=false → 已跑时长恒为 0（计时器不动）。
  const currentElapsed = () => elapsedSeconds(accumulatedMsRef.current, startRef.current, Date.now());

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
    totalRef.current = total;
    startRef.current = null;
    accumulatedMsRef.current = 0;
    setStarted(false);

    // v4 P2 一键开始：应用调用方指定的模式/时长，并可选立即开始
    const nextTimerMode = initialTimerMode ?? timerModeRef.current;
    if (initialTimerMode) {
      setTimerMode(initialTimerMode);
      timerModeRef.current = initialTimerMode;
    }
    if (typeof initialMinutes === "number" && initialMinutes > 0) {
      const v = Math.min(180, Math.max(1, Math.round(initialMinutes)));
      setMinutes(v);
      setTotal(v * 60);
      totalRef.current = v * 60;
      setRemaining(v * 60);
      remainingRef.current = v * 60;
    } else if (nextTimerMode === "countdown") {
      const v = Math.min(180, Math.max(1, minutes));
      setTotal(v * 60);
      totalRef.current = v * 60;
      setRemaining(v * 60);
      remainingRef.current = v * 60;
    } else {
      // 秒表模式：remaining 被当作"已跑秒数"用，初值必须是 0（否则第一眼显示 25:00）
      setRemaining(0);
      remainingRef.current = 0;
    }
    recordedRef.current = false;
    autoRecordedRef.current = false;

    // V3 AppState 对时：退后台不暂停（墙钟继续走），回前台按墙钟刷新剩余时间
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (running && startRef.current !== null) {
          if (timerModeRef.current === "stopwatch") {
            setRemaining(currentElapsed());
          } else {
            const next = Math.max(0, totalRef.current - currentElapsed());
            remainingRef.current = next;
            setRemaining(next);
            if (next === 0) {
              setRunning(false);
              setDone(true);
              if (timer.current) clearInterval(timer.current);
            }
          }
        }
      }
    });

    let alive = true;
    void alive;
    return () => {
      if (timer.current) clearInterval(timer.current);
      sub.remove();
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /**
   * Bing 每日壁纸：`open` 或所选背景变化时都会加载。
   * 修掉既有 bug：旧实现只在打开的瞬间判断一次 `galleryId === "bing"`，
   * 于是"在计时页里切到每日 Bing"永远拉不到图（只能关掉重开）。
   * 另外先用上次缓存的 URL 秒出图（避免 0.3~1s 纯色再跳图），再静默刷新并预取。
   */
  useEffect(() => {
    if (!open || mode !== "gallery" || galleryId !== "bing") return;
    let alive = true;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(K_BING);
        if (alive && cached) {
          const parsed = JSON.parse(cached) as { url?: string };
          if (parsed?.url) setBing(parsed.url);
        }
      } catch {
        // 缓存损坏：忽略
      }
      try {
        const r = await fetch(`${getApiUrl()}/api/background`);
        const d = (r.ok ? await r.json() : null) as { exists?: boolean; date?: string } | null;
        if (!alive) return;
        if (d?.exists && d.date) {
          const next = `${getApiUrl()}/api/background/img?date=${encodeURIComponent(d.date)}`;
          setBing(next);
          void AsyncStorage.setItem(K_BING, JSON.stringify({ date: d.date, url: next })).catch(() => {});
          void ExpoImage.prefetch(next, { cachePolicy: "memory-disk" }).catch(() => {});
        }
      } catch {
        // 拉不到：保留缓存或回落到纯色兜底（setBing 保持原值）
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, mode, galleryId]);

  const tick = () => {
    if (timerModeRef.current === "stopwatch") {
      // 秒表：用 remaining 存当前墙钟秒数驱动每秒重渲染
      setRemaining(currentElapsed());
      return;
    }
    const el = currentElapsed();
    const next = Math.max(0, totalRef.current - el);
    remainingRef.current = next;
    setRemaining(next);
    if (next === 0) {
      // 冻结时长：把当前运行段折进累计并清空起点，避免完成之后 elapsed 继续增长
      if (startRef.current !== null) {
        accumulatedMsRef.current += Date.now() - startRef.current;
        startRef.current = null;
      }
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
  const pickView = (v: TimerView) => {
    setTimerView(v);
    persist(K_VIEW, v);
  };

  const setMin = (m: number) => {
    const v = Math.min(180, Math.max(1, m));
    setMinutes(v);
    setTotal(v * 60);
    totalRef.current = v * 60;
    setRemaining(v * 60);
    remainingRef.current = v * 60;
    setRunning(false);
    startRef.current = null;
    accumulatedMsRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 打开弹层时重置状态（既有模式）
    setDone(false);
    if (timer.current) clearInterval(timer.current);
    persist(K_MINUTES, String(v));
  };

  /**
   * 把计时状态同步到「通知栏常驻」（v12 P0-8）：
   * 运行中 → 拉起前台服务并刷新圆环/任务名；暂停、结束、关弹层 → 收掉通知。
   */
  const syncNotification = (isRunning: boolean) => {
    if (!isRunning) {
      stopFocusNotification();
      return;
    }
    const title =
      task?.title?.trim() || contentLabel?.trim() || exerciseLabel?.trim() || (sessionMode === "exercise" ? "运动计时" : "专注学习");
    const isCountdown = timerModeRef.current === "countdown";
    void startFocusNotification({
      title,
      mode: isCountdown ? "countdown" : "stopwatch",
      totalMs: isCountdown ? totalRef.current * 1000 : 0,
      elapsedMs: currentElapsed() * 1000,
    });
  };

  const pause = () => {
    // 把当前运行段折算进累计（墙钟），暂停段不计入
    if (startRef.current !== null) {
      accumulatedMsRef.current += Date.now() - startRef.current;
      startRef.current = null;
    }
    if (timer.current) clearInterval(timer.current);
    setRunning(false);
    stopFocusNotification();
  };
  const resume = () => {
    if (timer.current) clearInterval(timer.current);
    if (startRef.current === null) startRef.current = Date.now();
    setRunning(true);
    timer.current = setInterval(tick, 1000);
    syncNotification(true);
  };
  const begin = () => {
    setStarted(true);
    resume();
  };

  /**
   * v4 P2「一键开始」：打开弹层即开始计时（用户点了"学习 25 分钟"就不该再点一次"开始"）。
   * 声明在 resume 之后，依赖 open 的 false→true 变化（home 页的 FocusTimer 无 key，
   * tasks 页用 key={timerSession} 重挂载，两种入口都能触发）。
   */
  // 弹层关闭或组件卸载 → 收掉常驻通知（计时不在跑时不该有残留）
  useEffect(() => {
    if (open) return;
    stopFocusNotification();
  }, [open]);
  useEffect(() => {
    return () => stopFocusNotification();
  }, []);

  useEffect(() => {
    if (!open || !autoStart) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 一键开始：打开即进入计时态
    setStarted(true);
    setDone(false);
    startRef.current = null;
    accumulatedMsRef.current = 0;
    resume();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoStart]);

  const reset = () => {
    if (timer.current) clearInterval(timer.current);
    setRunning(false);
    stopFocusNotification();
    setRemaining(total);
    remainingRef.current = total;
    startRef.current = null;
    accumulatedMsRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 打开弹层时重置状态（既有模式）
    setDone(false);
  };

  const record = async (elapsedSeconds: number) => {
    // 用 ref 去重：同一帧内"连点记录"或"到点自动记录 + 用户手动点"都只写一条
    if (recording || recordedRef.current) return;
    recordedRef.current = true;
    if (elapsedSeconds < 10) {
      onClose();
      return;
    }
    setRecording(true);
    // v4 P2：运动会话把秒数交给运动记录通道（不再写专注 sessions），避免 45 秒被取整成 1 分钟
    if (sessionMode === "exercise") {
      onExerciseRecorded?.(elapsedSeconds, exerciseLabel);
      setRecording(false);
      onClose();
      return;
    }
    // v5 P2-1：把"这次学什么"一并带出（调用方写入 focus_sessions.tag）
    const label = contentLabel?.trim() ? contentLabel.trim().slice(0, 40) : null;
    onRecorded(task?.id ?? null, elapsedSeconds, label);
    setRecording(false);
    onClose();
  };

  /**
   * v4 P2：倒计时自然结束（done=true）时**自动记录一次**。
   * 之前只在到点时把 done 置真、什么也不写，而弹层文案写着"倒计时结束自动记入运动记录"——
   * 用户按预期离开，结果一条记录都没有。
   * 手动提前结束仍走「记录」按钮（record 内部有 ref 去重，不会写两条）。
   */
  useEffect(() => {
    if (!open || !done) return;
    if (autoRecordedRef.current) return;
    autoRecordedRef.current = true;
    const seconds = timerModeRef.current === "stopwatch" ? currentElapsed() : totalRef.current;
    void record(seconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, done]);

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

  /** v1.22：分享改为卡片图片弹层（截图 → 系统分享面板；不可用时弹层内退回文字） */
  const shareCard = () => setShareOpen(true);

  const ratio = timerMode === "stopwatch" ? 0 : (total > 0 ? remaining / total : 0);
  // stopwatch 时 tick 已把「墙钟已跑秒数」写进 remaining 状态，render 内直接读 remaining 即可
  const elapsed = timerMode === "stopwatch" ? remaining : total - remaining;
  const remainingShown = remaining;
  const stats = computeFocusStats(sessions);
  const maxMin = Math.max(1, ...stats.last14.map((d) => d.minutes));
  const bgColor = mode === "color" ? color : mode === "upload" ? "#1f2937" : (GALLERY.find((g) => g.id === galleryId)?.color ?? "#1f2937");
  const showImage = mode === "upload" && !!url;
  const showBing = mode === "gallery" && galleryId === "bing" && !!bing;

  return (
    <Modal visible={open} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => record(elapsed)}>
      <View style={styles.root}>
        {/* 背景层 */}
        {showImage ? <ExpoImage source={{ uri: url! }} style={ABS_FILL} contentFit="cover" cachePolicy="memory-disk" transition={200} onError={() => setUrl(null)} /> : null}
        {showBing ? <ExpoImage source={{ uri: bing! }} style={ABS_FILL} contentFit="cover" cachePolicy="memory-disk" transition={200} onError={() => setBing(null)} /> : null}
        {!showImage && !showBing ? <View style={[ABS_FILL, { backgroundColor: bgColor }]} /> : null}
        <View style={[ABS_FILL, styles.scrim]} />
        <View style={[ABS_FILL, styles.glow]} />

        {/* 顶部：背景切换 + 关闭 */}
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <Pressable style={styles.topBtn} onPress={() => setShowBg((v) => !v)}>
            <View style={styles.topBtnInner}>
              <ThemedIcon name="color-palette-outline" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.topBtnText}>背景</Text>
            </View>
          </Pressable>
          <Pressable style={styles.topBtn} onPress={() => record(elapsed)}>
            <ThemedIcon name="close" size={20} color="rgba(255,255,255,0.9)" />
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
                <ThemedIcon name="trophy" size={34} color="#FFB25E" />
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
              <FocusShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} data={focusShareDataFromStats(stats)} />
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
                  <Text style={styles.landscapeClock}>{fmt(remainingShown)}</Text>
                  <Text style={styles.landscapeClockHint}>点击计时 · 暂停 / 继续</Text>
                </Pressable>
                <View style={styles.controls}>
                  <Pressable style={styles.ctrlBtn} onPress={() => (running ? pause() : resume())}>
                    <ThemedIcon name={running ? "pause" : "play"} size={26} color="#fff" />
                  </Pressable>
                  <Pressable style={styles.ctrlBtn} onPress={reset}>
                    <ThemedIcon name="refresh" size={26} color="#fff" />
                  </Pressable>
                  <Pressable style={styles.ctrlBtn} onPress={() => record(elapsed)}>
                    <ThemedIcon name="stop" size={26} color="#fff" />
                  </Pressable>
                </View>
                <Pressable style={styles.recordBtn} onPress={() => record(elapsed)}>
                  <ThemedIcon name="checkmark-done" size={18} color="#1f1f1f" />
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

              {/* 圆环 / 表盘（v13 U3）+ 数字时钟 */}
              <View style={styles.ringWrap}>
                {timerView === "ring" ? (
                  <>
                    <RingProgress
                      size={300}
                      strokeWidth={14}
                      progress={1 - ratio}
                      trackColor="rgba(255,255,255,0.16)"
                      color="#FFB25E"
                    />
                    <Pressable style={styles.clockWrap} onPress={() => (running ? pause() : resume())}>
                      <Text style={styles.clock}>{fmt(remainingShown)}</Text>
                    </Pressable>
                  </>
                ) : (
                  <TimerDial
                    size={300}
                    progress={1 - ratio}
                    color="#FFB25E"
                    trackColor="rgba(255,255,255,0.16)"
                    tickColor="rgba(255,255,255,0.6)"
                  />
                )}
              </View>

              {/* 表盘视图下时钟放到盘下方（指针扫过中心，数字放中间会互相压） */}
              {timerView === "dial" ? (
                <Pressable style={styles.dialClockWrap} onPress={() => (running ? pause() : resume())}>
                  <Text style={styles.clock}>{fmt(remainingShown)}</Text>
                  <Text style={styles.dialClockHint}>点击暂停 / 继续</Text>
                </Pressable>
              ) : null}

              {/* v13 U3：视图切换（默认圆环，选择持久化到 AsyncStorage） */}
              <View style={styles.viewToggle}>
                {(
                  [
                    { key: "ring", label: "圆环" },
                    { key: "dial", label: "表盘" },
                  ] as const
                ).map((o) => (
                  <Pressable
                    key={o.key}
                    onPress={() => pickView(o.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: timerView === o.key }}
                    style={[styles.viewChip, timerView === o.key && styles.viewChipActive]}
                  >
                    <Text style={[styles.viewChipText, timerView === o.key && styles.viewChipTextActive]}>
                      {o.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* 控制按钮 */}
              <View style={styles.controls}>
                <Pressable style={styles.ctrlBtn} onPress={() => (running ? pause() : resume())}>
                  <ThemedIcon name={running ? "pause" : "play"} size={26} color="#fff" />
                </Pressable>
                <Pressable style={styles.ctrlBtn} onPress={reset}>
                  <ThemedIcon name="refresh" size={26} color="#fff" />
                </Pressable>
                <Pressable style={styles.ctrlBtn} onPress={() => record(elapsed)}>
                  <ThemedIcon name="stop" size={26} color="#fff" />
                </Pressable>
              </View>

              <Pressable style={styles.recordBtn} onPress={() => record(elapsed)}>
                <ThemedIcon name="checkmark-done" size={18} color="#1f1f1f" />
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
                    <ThemedIcon name="sparkles" size={14} color="#FFB25E" />
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
              <Text style={styles.readyTitle}>{timerMode === "stopwatch" ? "准备开始 正向计时" : `准备开始 ${minutes} 分钟专注`}</Text>
              {contentLabel?.trim() ? (
                <View style={styles.contentChip}>
                  <ThemedIcon name="bookmark-outline" size={12} color="rgba(255,255,255,0.92)" />
                  <Text style={styles.contentChipText} numberOfLines={1}>
                    本次学习 · {contentLabel.trim()}
                  </Text>
                </View>
              ) : null}

              {/* V3 计时模式切换 */}
              <View style={styles.modeToggle}>
                {(
                  [
                    { key: "countdown", label: "倒计时" },
                    { key: "stopwatch", label: "正向秒表" },
                  ] as const
                ).map((o) => (
                  <Pressable
                    key={o.key}
                    onPress={() => setTimerMode(o.key)}
                    style={[styles.modeChip, timerMode === o.key && styles.modeChipActive]}
                  >
                    <Text style={[styles.modeChipText, timerMode === o.key && styles.modeChipTextActive]}>{o.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable style={styles.primaryBtn} onPress={begin}>
                <View style={styles.readyCtaInner}>
                  <ThemedIcon name="play" size={16} color="#1f1f1f" />
                  <Text style={styles.primaryBtnText}>{sessionMode === "exercise" ? "开始锻炼" : timerMode === "stopwatch" ? "开始计时" : "开始专注"}</Text>
                </View>
              </Pressable>
              <Text style={styles.readyHint}>{timerMode === "stopwatch" ? "秒表从 00:00 正向计时 · 结束即记录" : "开始后将全屏沉浸 · 可随时暂停"}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  scrim: { backgroundColor: "rgba(0,0,0,0.5)" },
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
  // v13 U3：表盘模式的时钟与视图切换
  dialClockWrap: { alignItems: "center", gap: 2 },
  dialClockHint: { color: "rgba(255,255,255,0.55)", fontSize: 11 },
  viewToggle: { flexDirection: "row", gap: 8 },
  viewChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  viewChipActive: { backgroundColor: "rgba(232,147,12,0.4)", borderColor: "rgba(232,147,12,0.7)" },
  viewChipText: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  viewChipTextActive: { color: "#fff", fontWeight: "700" },
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
  contentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    maxWidth: "88%",
  },
  contentChipText: { color: "rgba(255,255,255,0.95)", fontSize: 12.5, fontWeight: "700" },
  readyHint: { color: "rgba(255,255,255,0.55)", fontSize: 12, textAlign: "center" },
  modeToggle: { flexDirection: "row", gap: 8 },
  modeChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  modeChipActive: { backgroundColor: "rgba(232,147,12,0.4)", borderColor: "rgba(232,147,12,0.7)" },
  modeChipText: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  modeChipTextActive: { color: "#fff", fontWeight: "600" },
});
