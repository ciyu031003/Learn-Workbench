import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { BlurView } from "expo-blur";
import { ThemedIcon } from "@/components/themed-icon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ScreenOrientation from "expo-screen-orientation";
import { getApiUrl } from "@/config";
import { computeFocusStats, FOCUS_MOTIVATIONS } from "@/lib/focus-stats";
import { FocusShareSheet } from "@/components/focus-share-card";
import { focusShareDataFromStats } from "@/lib/focus-share";
import { elapsedSeconds } from "@/lib/focus-elapsed";
import {
  clearRunningFocus,
  loadRunningFocus,
  recoveredSeconds,
  saveRunningFocus,
} from "@/lib/focus-session-recovery";
import { startFocusNotification, stopFocusNotification } from "@/lib/focus-notification";
import { RingProgress } from "@/components/ring-progress";
import { TimerDial } from "@/components/timer-dial";
import { getDailyQuote } from "@/lib/quotes";
import { haptics } from "@/lib/haptics";
import { typography } from "@/theme/tokens";
import type { FocusSession } from "@learn-workbench/shared/schemas";
import { DEFAULT_FOCUS_SCENE_ID, FOCUS_SCENES, getFocusScene } from "@learn-workbench/shared/focus-scenes";
import { focusSceneSource } from "@/lib/focus-scene-assets";

/**
 * 准备开始（一屏启动页）的时长档位：v2.0.1 按真机反馈改为 25/45/60。
 * 计时中的快捷档位（PRESETS）保持原样，避免改变既有行为。
 */
const START_PRESETS = [25, 45, 50, 90];
const GALLERY = [
  ...FOCUS_SCENES.map((scene) => ({ id: scene.id, name: scene.name, color: scene.accent })),
  { id: "bing", name: "每日 Bing", color: "#1f2937" },
];
const COLORS = ["#08131B", "#1f2937", "#7c2d12", "#7f1d1d", "#14532d", "#1e3a8a", "#4c1d95", "#831843"];

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
const K_GOAL = "focus-today-goal";
const K_MUSIC = "focus-music-volume";
const K_AMBIENT = "focus-ambient-volume";

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

  // 默认走纯色（#08131B 冷调深蓝，对齐 demo 专注暗场）；用户仍可在面板里选 Bing/其它背景
  const [mode, setMode] = useState<BgMode>("gallery");
  const [color, setColor] = useState("#08131B");
  const [url, setUrl] = useState<string | null>(null);
  // v4 P2：默认改为「每日 Bing」风景壁纸（Web 端早就是 bing；用户若手动选过其它背景，
  // 显式选择优先 —— 因为我们从不自动写入这个 key，所以"改默认值"对老用户同样生效）
  const [galleryId, setGalleryId] = useState(DEFAULT_FOCUS_SCENE_ID);
  const [bing, setBing] = useState<string | null>(null);

  const [minutes, setMinutes] = useState(25);
  const [total, setTotal] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [started, setStarted] = useState(false);
  /** v3 专注模式顶栏时段：会话开始时刻（事件/副作用里写入，render 只读 state） */
  const [sessionStartAt, setSessionStartAt] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  /** V3 计时模式：countdown=倒计时（既有），stopwatch=正向秒表 */
  const [timerMode, setTimerMode] = useState<"countdown" | "stopwatch">("countdown");
  /** v13 U3：主视图形态，默认仍是圆环 */
  const [timerView, setTimerView] = useState<TimerView>("ring");

  const [quote, setQuote] = useState(getDailyQuote());
  const [showBg, setShowBg] = useState(false);
  const [goal, setGoal] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);
  const [musicVolume, setMusicVolume] = useState(45);
  const [ambientVolume, setAmbientVolume] = useState(65);

  const startRef = useRef<number | null>(null);
  /** 记录去重：同一帧内连点"记录"/Modal 关闭与按钮并发时，避免写两条 */
  const recordedRef = useRef(false);
  /** 倒计时自然结束时只自动记一次 */
  const autoRecordedRef = useRef(false);
  /**
   * v1.44.2：冷启动补记只做一次 + 回调走 ref。
   * 这个 effect 只跑一次（[]），若直接闭包捕获 props 会拿到挂载那一刻的引用；
   * 用 ref 跟随最新值更稳。
   */
  const recoveredRef = useRef(false);
  const onRecordedRef = useRef(onRecorded);
  const onExerciseRecordedRef = useRef(onExerciseRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
    onExerciseRecordedRef.current = onExerciseRecorded;
  }, [onRecorded, onExerciseRecorded]);
  const remainingRef = useRef(25 * 60);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // V3 墙钟对时：累计跨暂停段的毫秒；startRef 为当前运行段墙钟起点。
  const accumulatedMsRef = useRef(0);
  const totalRef = useRef(25 * 60);
  const timerModeRef = useRef<"countdown" | "stopwatch">("countdown");
  const initialTimerModeRef = useRef(initialTimerMode);
  const initialMinutesRef = useRef(initialMinutes);
  useEffect(() => {
    initialTimerModeRef.current = initialTimerMode;
    initialMinutesRef.current = initialMinutes;
  }, [initialTimerMode, initialMinutes]);

  // 初始化偏好
  useEffect(() => {
    (async () => {
      try {
        const [m, c, u, g, q, mins, view, goalVal, music, ambient] = await Promise.all([
          AsyncStorage.getItem(K_MODE),
          AsyncStorage.getItem(K_COLOR),
          AsyncStorage.getItem(K_URL),
          AsyncStorage.getItem(K_GALLERY),
          AsyncStorage.getItem(K_QUOTE),
          AsyncStorage.getItem(K_MINUTES),
          AsyncStorage.getItem(K_VIEW),
          AsyncStorage.getItem(K_GOAL),
          AsyncStorage.getItem(K_MUSIC),
          AsyncStorage.getItem(K_AMBIENT),
        ]);
        if (view === "dial" || view === "ring") setTimerView(view);
        if (m) setMode(m as BgMode);
        if (c) setColor(c);
        if (u) setUrl(u);
        if (g) setGalleryId(g);
        if (q) setQuote(q);
        if (goalVal) setGoal(goalVal);
        if (music) setMusicVolume(Math.min(100, Math.max(0, Number(music) || 45)));
        if (ambient) setAmbientVolume(Math.min(100, Math.max(0, Number(ambient) || 65)));
        if (mins) {
          const v = Math.min(180, Math.max(1, Number(mins) || 25));
          // 调用方显式指定了时长/模式时以调用方为准
          //（"一键开始 → 学习 25 分钟"不该被历史偏好设置改掉）
          if (typeof initialMinutesRef.current !== "number" && !initialTimerModeRef.current) {
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
    const nextTimerMode = initialTimerModeRef.current ?? timerModeRef.current;
    if (initialTimerModeRef.current) {
      setTimerMode(initialTimerModeRef.current);
      timerModeRef.current = initialTimerModeRef.current;
    }
    if (typeof initialMinutesRef.current === "number" && initialMinutesRef.current > 0) {
      const v = Math.min(180, Math.max(1, Math.round(initialMinutesRef.current)));
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
    /**
     * v1.44.2：把"运行中会话"落盘。原先计时状态只在内存里，把 App 划掉/进程被杀
     * 那一段专注就彻底丢了（用户：「我退出去，也要能自动记录我计时了多久」）。
     * 正常记录或重置时会清掉这个标记（见 record / reset）。
     */
    void saveRunningFocus({
      startedAt: startRef.current ?? Date.now(),
      sessionMode,
      kind: timerModeRef.current,
      plannedSeconds: timerModeRef.current === "countdown" ? totalRef.current : 0,
      taskId: task?.id ?? null,
      contentLabel: contentLabel ?? null,
      exerciseLabel: exerciseLabel ?? null,
    });
  };
  const begin = () => {
    setSessionStartAt(Date.now());
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

  /**
   * v1.44.2：冷启动补记"上次退出时还在跑"的计时。
   *
   * 用户反馈：「不单单点击『记住本次记录』那个按钮才能记录时间。我退出去，
   * 也能自动记录我计时了多久。」原先只有按钮 / 倒计时结束 / 返回键三条落库路径，
   * 把 App 划掉那一段就丢了。现在 resume 时会把会话落盘，进程被杀后下次启动在这里补记。
   *
   * FocusTimer 在 today / tasks 页是常驻挂载的（open=false 也挂着），
   * 所以"启动后第一个挂载的实例"就会把残留标记消费掉，不需要额外的 App 级引导。
   */
  useEffect(() => {
    if (recoveredRef.current) return;
    recoveredRef.current = true;
    void (async () => {
      const stale = await loadRunningFocus();
      if (!stale) return;
      await clearRunningFocus();
      const seconds = recoveredSeconds(stale, Date.now());
      if (seconds <= 0) return;
      if (stale.sessionMode === "exercise") {
        onExerciseRecordedRef.current?.(seconds, stale.exerciseLabel);
      } else {
        onRecordedRef.current(stale.taskId, seconds, stale.contentLabel);
      }
    })();

  }, []);

  useEffect(() => {
    if (!open || !autoStart) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 一键开始：打开即进入计时态
    setStarted(true);
    setSessionStartAt((v) => v ?? Date.now());
    setDone(false);
    startRef.current = null;
    accumulatedMsRef.current = 0;
    resume();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoStart]);

  const resetTimerState = () => {
    if (timer.current) clearInterval(timer.current);
    setRunning(false);
    stopFocusNotification();
    const resetValue = timerModeRef.current === "stopwatch" ? 0 : totalRef.current;
    setRemaining(resetValue);
    remainingRef.current = resetValue;
    startRef.current = null;
    accumulatedMsRef.current = 0;
    setDone(false);
    // 重开一轮后必须允许再次记录；否则完成页的自动记录会把后续会话全部拦掉。
    recordedRef.current = false;
    autoRecordedRef.current = false;
  };

  const reset = () => {
    resetTimerState();
    // 用户主动重来 = 放弃这一段，不该在下次启动被补记
    void clearRunningFocus();
  };

  /**
   * 跳过 / 再来一次：只重置计时状态并立刻开下一轮。
   * 不能复用 reset()，否则它异步清除恢复标记会和 resume() 的落盘竞争，
   * 可能把刚开始的下一轮标记删掉。
   */
  const restartRound = () => {
    resetTimerState();
    setSessionStartAt(Date.now());
    resume();
  };
  const skipRound = restartRound;
  const record = async (elapsedSeconds: number, options: { keepOpen?: boolean } = {}) => {
    // 用 ref 去重：同一帧内"连点记录"或"到点自动记录 + 用户手动点"都只写一条
    if (recording || recordedRef.current) return;
    recordedRef.current = true;
    // 已经走记录流程了，清掉"运行中"标记，避免下次冷启动又补记一遍
    void clearRunningFocus();
    if (elapsedSeconds < 10) {
      onClose();
      return;
    }
    setRecording(true);
    // v4 P2：运动会话把秒数交给运动记录通道（不再写专注 sessions），避免 45 秒被取整成 1 分钟
    if (sessionMode === "exercise") {
      onExerciseRecorded?.(elapsedSeconds, exerciseLabel);
      setRecording(false);
      if (!options.keepOpen) onClose();
      return;
    }
    // v5 P2-1：把"这次学什么"一并带出（调用方写入 focus_sessions.tag）
    const label = contentLabel?.trim() ? contentLabel.trim().slice(0, 40) : null;
    onRecorded(task?.id ?? null, elapsedSeconds, label);
    setRecording(false);
    if (!options.keepOpen) onClose();
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
    // 自然完成保留结果页（分享 / 再来一次）；只有手动结束和关闭才退出。
    void record(seconds, { keepOpen: sessionMode === "focus" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, done]);

  /** v1.22：分享改为卡片图片弹层（截图 → 系统分享面板；不可用时弹层内退回文字） */
  const shareCard = () => setShareOpen(true);

  const ratio = timerMode === "stopwatch" ? 0 : (total > 0 ? remaining / total : 0);
  // 对齐 demo：倒计时环表示「剩余」，开始即满圈、随时间缩短；秒表仍保持满圈（旧行为）
  const ringProgress = timerMode === "stopwatch" ? 1 : ratio;
  // stopwatch 时 tick 已把「墙钟已跑秒数」写进 remaining 状态，render 内直接读 remaining 即可
  const elapsed = timerMode === "stopwatch" ? remaining : total - remaining;
  const remainingShown = remaining;
  const stats = computeFocusStats(sessions);
  const bgColor = mode === "color" ? color : mode === "upload" ? "#1f2937" : (GALLERY.find((g) => g.id === galleryId)?.color ?? "#1f2937");
  const showImage = mode === "upload" && !!url;
  const showBing = mode === "gallery" && galleryId === "bing" && !!bing;
  const sceneItem = getFocusScene(galleryId);
  const showScene = mode === "gallery" && galleryId !== "bing";
  const sceneSource = focusSceneSource(sceneItem.id);

  /**
   * v2.0.1 一屏化（真机反馈「专注界面不要上下滑动」）：
   * 小屏档位 + 用实测高度反推圆环尺寸 —— 顶部标题与底部励志短句都固定在一屏内。
   */
  const compact = height < 700;

  /** v3 专注模式（提案 §专注模式）：顶栏时段、番茄序号、剩余时间文案 */
  const fmtClock = (d: Date) =>
    String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  const fmStart = sessionStartAt === null ? null : new Date(sessionStartAt);
  const fmRange =
    fmStart === null
      ? ""
      : timerMode === "stopwatch"
        ? fmtClock(fmStart) + " – 进行中"
        : fmtClock(fmStart) + " – " + fmtClock(new Date(fmStart.getTime() + Math.max(1, minutes) * 60 * 1000));
  const pomodoroLabel = "POMODORO #" + (stats.todaySessions + 1);
  const progressPct =
    timerMode === "countdown" ? Math.max(0, Math.min(100, Math.round((1 - ratio) * 100))) : 0;

  const volumeControls = (
    <View style={styles.volumeRow}>
      <VolumeSlider
        label="音乐"
        value={musicVolume}
        onChange={(value) => {
          setMusicVolume(value);
          persist(K_MUSIC, String(value));
        }}
      />
      <VolumeSlider
        label="背景音"
        value={ambientVolume}
        onChange={(value) => {
          setAmbientVolume(value);
          persist(K_AMBIENT, String(value));
        }}
      />
    </View>
  );

  const actionDock = (
    <View style={styles.dockActions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={running ? "暂停计时" : "继续计时"}
        style={styles.dockAction}
        onPress={() => (running ? pause() : resume())}
      >
        <ThemedIcon name={running ? "pause" : "play"} size={18} color="#FFFFFF" />
        <Text style={styles.dockActionText}>{running ? "暂停" : "继续"}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="跳过本轮，开始下一轮"
        style={styles.dockAction}
        onPress={skipRound}
      >
        <ThemedIcon name="play-skip-forward" size={18} color="#FFFFFF" />
        <Text style={styles.dockActionText}>跳过</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="重置计时"
        style={styles.dockAction}
        onPress={reset}
      >
        <ThemedIcon name="refresh" size={18} color="#FFFFFF" />
        <Text style={styles.dockActionText}>重置</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="结束本次专注"
        style={styles.dockAction}
        onPress={() => record(elapsed)}
      >
        <ThemedIcon name="stop" size={18} color="#FFD6AE" />
        <Text style={[styles.dockActionText, styles.dockActionDanger]}>结束</Text>
      </Pressable>
    </View>
  );

  return (
    <Modal visible={open} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => record(elapsed)}>
      {/* v17-C1 审计发现：本页是**暗色沉浸**画面，但状态栏图标色此前继承自 App 主题。
          App 处于浅色主题时会变成「深色图标压深色背景」的低对比 —— 这里强制浅色图标；
          弹层卸载后由根布局的 StatusBar 自动恢复。 */}
      <RNStatusBar barStyle="light-content" />
      <View style={styles.root}>
        {/* 背景层 */}
        {showImage ? <ExpoImage source={{ uri: url! }} style={ABS_FILL} contentFit="cover" cachePolicy="memory-disk" transition={200} onError={() => setUrl(null)} /> : null}
        {showBing ? <ExpoImage source={{ uri: bing! }} style={ABS_FILL} contentFit="cover" cachePolicy="memory-disk" transition={200} onError={() => setBing(null)} /> : null}
        {showScene ? <ExpoImage source={sceneSource} style={ABS_FILL} contentFit="cover" cachePolicy="memory-disk" transition={200} /> : null}
        {!showImage && !showBing && !showScene ? <View style={[ABS_FILL, { backgroundColor: bgColor }]} /> : null}
        {/* 黑色压暗层只用于图片背景；纯色已是 #08131B 暗场，再叠 50% 黑会发死 */}
        {showImage || showBing || showScene ? <View style={[ABS_FILL, styles.scrim]} /> : null}

        <View pointerEvents="none" style={[styles.sceneTag, { top: insets.top + 58 }]}>
          <Text style={styles.sceneTagText}>{sceneItem.name}</Text>
        </View>

        {/* 顶部：关闭 + 专注模式标题/时段 + 背景（提案 §专注模式） */}
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <Pressable accessibilityLabel="关闭" style={styles.topBtn} onPress={() => record(elapsed)} hitSlop={8}>
            <ThemedIcon name="close" size={20} color="rgba(255,255,255,0.9)" />
          </Pressable>
          {started && !done ? (
            <View style={styles.fmHeadMid} accessible accessibilityLabel={"专注模式 " + fmRange}>
              <Text style={styles.fmHeadTitle}>专注模式</Text>
              <Text style={styles.fmHeadRange}>{fmRange}</Text>
            </View>
          ) : (
            <View style={styles.fmHeadSpacer} />
          )}
          <Pressable accessibilityLabel="背景设置" style={styles.topBtn} onPress={() => setShowBg((v) => !v)} hitSlop={8}>
            <ThemedIcon name="color-palette-outline" size={18} color="rgba(255,255,255,0.9)" />
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
                    {g.id === "bing"
                      ? bing
                        ? <ExpoImage source={{ uri: bing }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
                        : null
                      : <ExpoImage source={focusSceneSource(g.id)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />}
                    <View style={styles.galleryShade} />
                    <Text style={styles.galleryText}>{g.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={styles.bgViewRow}>
              <Text style={styles.bgViewLabel}>计时显示</Text>
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
            </View>
          </View>
        ) : null}

        {done ? (
          /* 完成页是结果页：内容可能较多，保留滚动（不属于「开始 / 计时」的一屏范围） */
          <ScrollView contentContainerStyle={styles.center} showsVerticalScrollIndicator={false}>
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
                <Pressable style={styles.secondaryBtn} onPress={restartRound}>
                  <Text style={styles.secondaryBtnText}>再来一次</Text>
                </Pressable>
                <Pressable style={styles.primaryBtn} onPress={onClose}>
                  <Text style={styles.primaryBtnText}>返回任务页</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        ) : started ? (
          isLandscape ? (
            <View
              style={[
                styles.landscapeRoot,
                {
                  paddingLeft: Math.max(16, insets.left + 8),
                  paddingRight: Math.max(16, insets.right + 8),
                  paddingBottom: insets.bottom + 12,
                },
              ]}
            >
              <View style={styles.landscapeCard}>
                <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.timerCardHead}>
                  <Text style={styles.timerCardKicker}>{pomodoroLabel}</Text>
                  <View style={[styles.statusPill, !running && styles.statusPillPaused]}>
                    <View style={[styles.statusDot, !running && styles.statusDotPaused]} />
                    <Text style={styles.statusText}>{running ? (sessionMode === "exercise" ? "运动中" : "学习中") : "已暂停"}</Text>
                  </View>
                </View>
                <Text style={styles.timerCardTask} numberOfLines={1}>{task?.title ?? "自由专注"}</Text>
                <Pressable
                  onPress={() => (running ? pause() : resume())}
                  accessibilityRole="button"
                  accessibilityLabel={running ? "暂停计时" : "继续计时"}
                >
                  <Text style={styles.landscapeTime} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{fmt(remainingShown)}</Text>
                </Pressable>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPct}%` as `${number}%` }]} />
                </View>
                <View style={styles.progressMeta}>
                  <Text style={styles.progressLabel}>{timerMode === "stopwatch" ? "正向计时" : "本轮进度"}</Text>
                  <Text style={styles.progressLabel}>{timerMode === "stopwatch" ? "进行中" : `${progressPct}%`}</Text>
                </View>
              </View>

              <View style={styles.landscapeSide}>
                <Pressable style={styles.goalPill} onPress={() => setEditingGoal(true)}>
                  <ThemedIcon name="locate-outline" size={14} color="rgba(255,255,255,0.9)" />
                  {editingGoal ? (
                    <TextInput
                      style={styles.goalInput}
                      value={goal}
                      onChangeText={(value) => {
                        setGoal(value);
                        persist(K_GOAL, value);
                      }}
                      placeholder="写下今天想完成的事…"
                      placeholderTextColor="rgba(255,255,255,0.45)"
                      autoFocus
                      maxLength={60}
                      onBlur={() => setEditingGoal(false)}
                      onSubmitEditing={() => setEditingGoal(false)}
                    />
                  ) : (
                    <Text style={styles.goalText} numberOfLines={1}>
                      {goal.trim() ? goal : "今日目标 · 写下今天想完成的事…"}
                    </Text>
                  )}
                </Pressable>
                <View style={styles.glassDock}>
                  <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} />
                  {volumeControls}
                  {actionDock}
                </View>
              </View>
            </View>
          ) : (
            /* v2.0.1 一屏计时页：flex 分配高度、无 ScrollView */
            <View style={[styles.runBody, { paddingBottom: insets.bottom + 10 }]}>
              <View style={styles.runSpacer} />
              <View style={styles.timerCard}>
                <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.timerCardHead}>
                  <Text style={styles.timerCardKicker}>{pomodoroLabel}</Text>
                  <View style={[styles.statusPill, !running && styles.statusPillPaused]}>
                    <View style={[styles.statusDot, !running && styles.statusDotPaused]} />
                    <Text style={styles.statusText}>{running ? (sessionMode === "exercise" ? "运动中" : "学习中") : "已暂停"}</Text>
                  </View>
                </View>
                <Text style={styles.timerCardTask} numberOfLines={1}>{task?.title ?? "自由专注"}</Text>
                <View style={styles.timerCardClockRow}>
                  {timerView === "ring" ? (
                    <RingProgress
                      size={58}
                      strokeWidth={4.5}
                      progress={ringProgress}
                      trackColor="rgba(255,255,255,0.18)"
                      color="#B7D9F2"
                    />
                  ) : (
                    <TimerDial
                      size={58}
                      progress={ringProgress}
                      color="#B7D9F2"
                      trackColor="rgba(255,255,255,0.18)"
                      tickColor="rgba(255,255,255,0.5)"
                    />
                  )}
                  <Pressable
                    style={styles.timerCardClockBtn}
                    onPress={() => (running ? pause() : resume())}
                    accessibilityRole="button"
                    accessibilityLabel={running ? "暂停计时" : "继续计时"}
                  >
                    <Text style={styles.timerCardTime} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{fmt(remainingShown)}</Text>
                  </Pressable>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPct}%` as `${number}%` }]} />
                </View>
                <View style={styles.progressMeta}>
                  <Text style={styles.progressLabel}>{timerMode === "stopwatch" ? "正向计时" : "本轮进度"}</Text>
                  <Text style={styles.progressLabel}>{timerMode === "stopwatch" ? "进行中" : `${progressPct}%`}</Text>
                </View>
              </View>

              <Pressable style={styles.goalPill} onPress={() => setEditingGoal(true)}>
                <ThemedIcon name="locate-outline" size={14} color="rgba(255,255,255,0.9)" />
                {editingGoal ? (
                  <TextInput
                    style={styles.goalInput}
                    value={goal}
                    onChangeText={(value) => {
                      setGoal(value);
                      persist(K_GOAL, value);
                    }}
                    placeholder="写下今天想完成的事…"
                    placeholderTextColor="rgba(255,255,255,0.45)"
                    autoFocus
                    maxLength={60}
                    onBlur={() => setEditingGoal(false)}
                    onSubmitEditing={() => setEditingGoal(false)}
                  />
                ) : (
                  <Text style={styles.goalText} numberOfLines={1}>
                    {goal.trim() ? goal : "今日目标 · 写下今天想完成的事…"}
                  </Text>
                )}
              </Pressable>

              <View style={styles.glassDock}>
                <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} />
                {volumeControls}
                {actionDock}
              </View>
            </View>
          )
        ) : (
          <ScrollView contentContainerStyle={[styles.readyBody, { paddingBottom: insets.bottom + 14 }]} showsVerticalScrollIndicator={false}>
              {/* 顶部：标题与说明（自适应，永远完整可见） */}
              <View style={styles.readyHead}>
                <Text style={styles.readyEyebrow}>FOCUS SESSION</Text>
                <Text style={styles.readyTask} numberOfLines={1}>{task?.title ?? "自由专注"}</Text>
                <Text style={styles.readyTitle} numberOfLines={2}>
                  {timerMode === "stopwatch" ? "准备开始 正向计时" : `准备开始 ${minutes} 分钟专注`}
                </Text>
                <Text style={styles.readySub}>开始后全屏沉浸，随时可以暂停</Text>
                <View style={styles.contentChip}>
                  <ThemedIcon
                    name={contentLabel?.trim() ? "bookmark-outline" : "leaf-outline"}
                    size={12}
                    color="rgba(255,255,255,0.92)"
                  />
                  <Text style={styles.contentChipText} numberOfLines={1}>
                    本次学习 · {contentLabel?.trim() ? contentLabel.trim() : "自由专注"}
                  </Text>
                </View>
              </View>

              {/* 今日目标：对齐参考图的 “今日目标 · 写下今天想完成的事” */}
              <Pressable style={styles.goalPill} onPress={() => setEditingGoal(true)}>
                <ThemedIcon name="locate-outline" size={14} color="rgba(255,255,255,0.9)" />
                {editingGoal ? (
                  <TextInput
                    style={styles.goalInput}
                    value={goal}
                    onChangeText={(value) => {
                      setGoal(value);
                      persist(K_GOAL, value);
                    }}
                    placeholder="写下今天想完成的事…"
                    placeholderTextColor="rgba(255,255,255,0.45)"
                    autoFocus
                    maxLength={60}
                    onBlur={() => setEditingGoal(false)}
                    onSubmitEditing={() => setEditingGoal(false)}
                  />
                ) : (
                  <Text style={styles.goalText} numberOfLines={1}>
                    {goal.trim() ? goal : "今日目标 · 写下今天想完成的事…"}
                  </Text>
                )}
              </Pressable>

              {/* 学习场景：横向场景卡，点一下切换背景 */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sceneStrip}>
                {FOCUS_SCENES.map((scene) => {
                  const active = galleryId === scene.id && mode === "gallery";
                  return (
                    <Pressable
                      key={scene.id}
                      onPress={() => {
                        if (mode !== "gallery") switchMode("gallery");
                        pickGallery(scene.id);
                        haptics.light();
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={scene.name}
                      style={[styles.sceneCard, active && styles.sceneCardActive]}
                    >
                      <ExpoImage
                        source={focusSceneSource(scene.id)}
                        style={styles.sceneThumb}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                      <View style={styles.sceneShade} />
                      <Text style={styles.sceneName} numberOfLines={1}>{scene.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* 声音氛围：值持久化，进入计时后沿用 */}
              <View style={styles.volumeRow}>
                <VolumeSlider
                  label="音乐"
                  value={musicVolume}
                  onChange={(value) => {
                    setMusicVolume(value);
                    persist(K_MUSIC, String(value));
                  }}
                />
                <VolumeSlider
                  label="背景音"
                  value={ambientVolume}
                  onChange={(value) => {
                    setAmbientVolume(value);
                    persist(K_AMBIENT, String(value));
                  }}
                />
              </View>

              {/* 中部：时长档位 + 计时方式（flex 撑满剩余高度，小屏自动收紧） */}
              <View style={[styles.readyStage, compact && styles.readyStageCompact]}>
                <View style={styles.readyBlock}>
                  <Text style={styles.readyLabel}>专注时长</Text>
                  <View style={styles.readyChips}>
                    {START_PRESETS.map((m) => {
                      const active = timerMode === "countdown" && minutes === m;
                      return (
                        <Pressable
                          key={m}
                          onPress={() => {
                            setTimerMode("countdown");
                            setMin(m);
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`专注 ${m} 分钟`}
                          style={[styles.readyChip, active && styles.readyChipActive]}
                        >
                          <Text style={[styles.readyChipText, active && styles.readyChipTextActive]}>{m} 分钟</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.readyBlock}>
                  <Text style={styles.readyLabel}>计时方式</Text>
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
                </View>
              </View>

              {/* 底部：开始按钮 + 一句说明，再往下是励志短句 */}
              <View style={styles.readyCtaWrap}>
                <Pressable style={styles.readyCta} onPress={begin}>
                  <View style={styles.readyCtaInner}>
                    <ThemedIcon name="play" size={16} color="#1f1f1f" />
                    <Text style={styles.primaryBtnText}>{sessionMode === "exercise" ? "开始锻炼" : timerMode === "stopwatch" ? "开始计时" : "开始专注"}</Text>
                  </View>
                </Pressable>
                <Text style={styles.readyHint}>{timerMode === "stopwatch" ? "秒表从 00:00 正向计时 · 结束即记录" : "开始后将全屏沉浸 · 可随时暂停"}</Text>
              </View>

              {/* 底部励志短句：图标 + 纯文字（无 emoji），完整落在一屏内 */}
              <View style={styles.quoteFooter}>
                <ThemedIcon name="sparkles" size={14} color="#FFB25E" />
                <Text style={styles.quoteFooterText} numberOfLines={2}>{quote}</Text>
              </View>
            </ScrollView>
          )}
      </View>
    </Modal>
  );
}

/** 轻量音量条：点击轨道任意位置即可设值；不引入新的滑块原生依赖。 */
function VolumeSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [trackWidth, setTrackWidth] = useState(0);
  return (
    <View style={volumeStyles.wrap}>
      <View style={volumeStyles.head}>
        <Text style={volumeStyles.label}>{label}</Text>
        <Text style={volumeStyles.value}>{value}%</Text>
      </View>
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel={label + "音量"}
        accessibilityValue={{ min: 0, max: 100, now: value }}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        onPress={(event) => {
          if (!(trackWidth > 0)) return;
          onChange(Math.max(0, Math.min(100, Math.round((event.nativeEvent.locationX / trackWidth) * 100))));
        }}
        style={volumeStyles.track}
      >
        <View style={[volumeStyles.fill, { width: `${value}%` as `${number}%` }]} />
        <View style={[volumeStyles.thumb, { left: Math.max(0, (value / 100) * Math.max(0, trackWidth - 12)) }]} />
      </Pressable>
    </View>
  );
}

const volumeStyles = StyleSheet.create({
  wrap: { flex: 1, gap: 5 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: "rgba(255,255,255,0.78)", fontSize: 10.5, fontWeight: "600" },
  value: { color: "rgba(255,255,255,0.45)", fontSize: 9.5, fontVariant: ["tabular-nums"] },
  track: { height: 18, justifyContent: "center", borderRadius: 9 },
  fill: {
    position: "absolute",
    left: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.88)",
  },
  thumb: { position: "absolute", top: 4, width: 10, height: 10, borderRadius: 5, backgroundColor: "#FFFFFF" },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  scrim: { backgroundColor: "rgba(0,0,0,0.5)" },
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
  galleryItem: {
    width: "31%",
    minHeight: 54,
    justifyContent: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  galleryItemActive: { borderColor: "#fff" },
  galleryText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  galleryShade: { ...ABS_FILL, backgroundColor: "rgba(0,0,0,0.28)" },
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
  /* 对齐 demo .fm-time b：细字重 400（旧值 800 偏粗），字号仍由 clockSize 动态决定 */
  clock: { color: "#fff", fontSize: 62, fontWeight: "400", fontVariant: ["tabular-nums"] },
  landscapeRoot: {
    flex: 1,
    minHeight: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    paddingTop: 8,
  },
  landscapeCard: {
    flex: 1,
    maxWidth: 340,
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(10,14,18,0.30)",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 6,
  },
  landscapeTime: { color: "#FFFFFF", fontSize: 46, fontWeight: "300", fontVariant: ["tabular-nums"] },
  landscapeSide: { flex: 1, maxWidth: 430, gap: 8 },
  landscapeWrap: { alignItems: "center", gap: 14, paddingVertical: 8 },
  landscapeTop: { alignItems: "center", gap: 3 },
  landscapeGoal: { color: "rgba(255,255,255,0.78)", fontSize: 12, maxWidth: "78%", textAlign: "center" },
  landscapeVolume: { maxWidth: 420, width: "72%", paddingHorizontal: 0 },
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
  // ---- v2.0.1 一屏布局（启动页 / 计时页都不滚动）----
  runBody: { flex: 1, minHeight: 0, paddingHorizontal: 16, gap: 10 },
  runSpacer: { flex: 1, minHeight: 0 },
  timerCard: {
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(10,14,18,0.30)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 7,
  },
  timerCardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  timerCardKicker: { color: "rgba(255,255,255,0.72)", fontSize: 10.5, fontWeight: "600" },
  timerCardTask: { color: "rgba(255,255,255,0.55)", fontSize: 11 },
  timerCardClockRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 74 },
  timerCardClockBtn: { flex: 1, minWidth: 0 },
  timerCardTime: { color: "#FFFFFF", fontSize: 54, fontWeight: "300", fontVariant: ["tabular-nums"] },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  statusPillPaused: { backgroundColor: "rgba(255,178,94,0.16)" },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#7EE0A3" },
  statusDotPaused: { backgroundColor: "#FFB25E" },
  statusText: { color: "rgba(255,255,255,0.82)", fontSize: 9.5, fontWeight: "600" },
  progressTrack: { height: 2, borderRadius: 1, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden" },
  progressFill: { height: 2, borderRadius: 1, backgroundColor: "rgba(255,255,255,0.9)" },
  progressMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressLabel: { color: "rgba(255,255,255,0.48)", fontSize: 9.5 },
  glassDock: {
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(12,16,22,0.34)",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 6,
  },
  dockActions: { flexDirection: "row", alignItems: "center" },
  dockAction: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 5 },
  dockActionText: { color: "rgba(255,255,255,0.82)", fontSize: 9.5, fontWeight: "600" },
  dockActionDanger: { color: "#FFD6AE" },
  bgViewRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  bgViewLabel: { color: "rgba(255,255,255,0.66)", fontSize: 11, fontWeight: "600" },
  /** 计时圆环的可用舞台：flex 撑满剩余高度，圆环尺寸由实测高度反推 */
  stage: { flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center" },
  readyBody: { flexGrow: 1, minHeight: 0, paddingHorizontal: 20, gap: 10, justifyContent: "space-between" },
  readyHead: { alignItems: "center", gap: 6, paddingTop: 2 },
  readyEyebrow: { ...typography.eyebrow, color: "rgba(255,255,255,0.55)", letterSpacing: 1.6 },
  readyTask: { ...typography.caption, color: "rgba(255,255,255,0.72)" },
  readySub: { ...typography.caption, color: "rgba(255,255,255,0.62)", textAlign: "center" },
  readyStage: { justifyContent: "center", gap: 18, paddingVertical: 4 },
  readyStageCompact: { gap: 10 },
  readyBlock: { gap: 8 },
  readyLabel: { ...typography.section, color: "rgba(255,255,255,0.65)", textAlign: "center" },
  readyChips: { flexDirection: "row", gap: 8 },
  readyChip: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  readyChipActive: { backgroundColor: "rgba(232,147,12,0.42)", borderColor: "rgba(232,147,12,0.72)" },
  readyChipText: { ...typography.callout, fontWeight: "700", color: "rgba(255,255,255,0.82)" },
  readyChipTextActive: { color: "#fff" },
  readyCtaWrap: { gap: 6, alignItems: "center" },
  readyCta: {
    width: "100%",
    maxWidth: 360,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFB25E",
    borderRadius: 999,
  },
  /** 底部励志短句：图标 + 纯文字（无 emoji），永远在一屏的最底部 */
  quoteFooter: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 2 },
  quoteFooterText: { flex: 1, ...typography.caption, color: "rgba(255,255,255,0.82)" },
  readyCtaInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  readyTitle: { ...typography.title2, fontWeight: "800", color: "#fff", textAlign: "center" },
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

  // ---- v3 专注模式（提案 §专注模式：顶栏时段 / 番茄序号 / 环下标题 / 双主操作）----
  fmHeadMid: { alignItems: "center", gap: 2 },
  fmHeadSpacer: { width: 44 },
  fmHeadTitle: { ...typography.caption, fontWeight: "700", color: "rgba(255,255,255,0.92)" },
  fmHeadRange: { ...typography.meta, color: "rgba(255,255,255,0.6)" },
  fmKicker: { ...typography.caption, fontWeight: "600", color: "rgba(143,195,240,0.92)", textAlign: "center" },
  fmRemain: { ...typography.meta, color: "rgba(255,255,255,0.6)" },
  fmTitleWrap: { alignItems: "center", gap: 4 },
  fmTitle: { ...typography.headline, fontWeight: "700", color: "#FFFFFF", textAlign: "center" },
  fmSub: { ...typography.meta, color: "rgba(255,255,255,0.6)", textAlign: "center" },
  fmActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  /* 对齐 demo .fm-main：半透明白玻璃胶囊（旧值实心浅蓝 #8FC3F0 偏跳） */
  fmMain: {
    flex: 1,
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  fmMainText: { ...typography.callout, fontWeight: "600", color: "#EAF3F7" },
  fmQuit: {
    flex: 1,
    minHeight: 50,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  fmQuitText: { ...typography.callout, fontWeight: "600", color: "rgba(255,255,255,0.88)" },
  sceneTag: {
    position: "absolute",
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  sceneTagText: { color: "rgba(255,255,255,0.78)", fontSize: 10.5, fontWeight: "600" },
  goalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "stretch",
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  goalText: { flex: 1, color: "rgba(255,255,255,0.78)", fontSize: 11.5 },
  goalInput: { flex: 1, color: "#FFFFFF", fontSize: 11.5, paddingVertical: 7 },
  sceneStrip: { gap: 8, paddingRight: 8 },
  sceneCard: {
    width: 96,
    height: 62,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    justifyContent: "flex-end",
    padding: 7,
  },
  sceneCardActive: { borderColor: "rgba(255,255,255,0.82)", borderWidth: 1.5 },
  sceneThumb: { ...ABS_FILL },
  sceneShade: { ...ABS_FILL, backgroundColor: "rgba(0,0,0,0.28)" },
  sceneName: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "700" },
  volumeRow: { flexDirection: "row", gap: 16, alignSelf: "stretch", paddingHorizontal: 4 },
});
