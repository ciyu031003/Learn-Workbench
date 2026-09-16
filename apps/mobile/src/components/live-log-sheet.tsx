/* eslint-disable react-hooks/immutability -- 贴纸拖拽靠共享值在 UI 线程驱动（与 today-stack 等既有写法一致） */
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Image } from "expo-image";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { getApiUrl } from "@/config";
import { BottomSheet } from "@/components/bottom-sheet";
import { FoodSticker } from "@/components/food-sticker";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { haptics } from "@/lib/haptics";
import {
  LIVE_LOG_MAX_STICKERS,
  addSticker,
  backgroundById,
  clearStickers,
  createLiveLog,
  cycleBackground,
  moveSticker,
  removeSticker,
  type LiveLogDoc,
  type LiveSticker,
} from "@/lib/live-log";
import { loadLiveLog, saveLiveLog } from "@/lib/live-log-store";
import { useAppStore } from "@/store/app-store";
import { useTheme } from "@/theme";
import { radius, shadows, typography, type ThemeColors } from "@/theme/tokens";

/**
 * LiveLog（v4 P4-c，参考图 4/5/7）：在背景图上**自由拖拽食物贴纸**，摆好后保存成一张画布。
 *
 * 与「贴纸墙 / 收集册」的分工：
 *  - 贴纸墙、收集册 = 对真实饮食记录的聚合（服务端数据）；
 *  - LiveLog = 本机玩法画布，**只存本机**（AsyncStorage），不参与同步（UI 上明确写出来）。
 *
 * 交互取舍：参考图里的 "5s / Aa / ✦ / 涂鸦 / 静音" 是**视频 Live Photo** 的编辑工具条；
 * 我们做的是静态画布，于是工具条换成同类语义里真正有用的动作：贴纸 / 背景 / 放大 / 旋转 / 删除 / 清空。
 * 没有做"导出成图片"——那需要 `react-native-view-shot`（新增原生依赖），本轮不引入；
 * 需要留档时系统截图即可（画布本身是干净的圆角矩形）。
 */
export function LiveLogSheet({
  visible,
  onClose,
  /** 可用的食物贴纸候选（今天的记录 + 常用食物），点一下即加到画布 */
  names,
}: {
  visible: boolean;
  onClose: () => void;
  names: string[];
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { height: winH } = useWindowDimensions();
  const token = useAppStore((s) => s.token);

  /**
   * 画布尺寸按可用高度反推（而不是固定 3:4 撑满宽度）：
   * 弹层里还有标题、贴纸候选、工具条，画布若按宽度撑满，小屏会把工具条挤出屏幕。
   * 宽高比固定 3:4（竖版，适合手机看），并按剩余高度夹取。
   */
  const canvasH = Math.round(Math.min(460, Math.max(240, winH * 0.9 - 300)));
  const canvasW = Math.round(canvasH * 0.75);

  const [doc, setDoc] = useState<LiveLogDoc>(() => createLiveLog());
  const [selected, setSelected] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const bingUrl = useBingWallpaper(visible);

  // 打开时载入本机画布；关闭时若还有未保存的改动就自动保存（避免手摆的一次白做）
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void loadLiveLog().then((d) => {
      if (!alive) return;
      setDoc(d);
      setSelected(null);
      setDirty(false);
      setSavedAt(d.stickers.length > 0 ? d.updatedAt : null);
    });
    return () => {
      alive = false;
    };
  }, [visible]);

  /**
   * 关闭时把未保存的改动落盘（含点遮罩/返回键关闭 —— 它们都走 BottomSheet 的 onClose）。
   * 用"关闭即保存"而不是"effect 监听 dirty 自动保存"：后者会在 effect 里同步 setState，
   * 且每次拖动松手都写一次存储；关闭时写一次更省、语义也更清楚（界面上仍有显式「保存」）。
   */
  const closeAndSave = useCallback(() => {
    if (dirty) void saveLiveLog(doc);
    onClose();
  }, [dirty, doc, onClose]);

  const bg = backgroundById(doc.bgId);
  const needBing = bg.kind === "remote" && !bingUrl;
  // 今日壁纸拉不到（离线/服务端没图）时从循环里跳过，避免"按背景没反应"
  const skipBg = useMemo(() => (bingUrl ? [] : ["bing"]), [bingUrl]);

  /**
   * 贴纸候选的兜底补拉：`names` 只来自"今天的记录 + 已加载的常用食物"，
   * 若用户今天还没记、也没打开过添加面板，候选会少得没法玩。
   * 这里在面板打开且候选不足时补拉一次"最近用过的食物"，让画布总有东西可摆。
   * 失败静默（候选少一点不影响主流程）。
   */
  const [extraNames, setExtraNames] = useState<string[]>([]);
  useEffect(() => {
    if (!visible || names.length >= 8) return;
    let alive = true;
    void (async () => {
      try {
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const r = await fetch(`${getApiUrl()}/api/nutrition/foods?sort=recent&limit=24`, { headers });
        if (!r.ok) return;
        const d = (await r.json()) as { foods?: { name?: unknown }[] };
        if (!alive || !Array.isArray(d.foods)) return;
        setExtraNames(
          d.foods
            .map((f) => (typeof f?.name === "string" ? f.name.trim() : ""))
            .filter((n) => n.length > 0)
        );
      } catch {
        // 离线：保持现状
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible, names.length, token]);

  /** 候选 = 传进来的（今天的记录优先）+ 补拉的，去重后最多 16 个 */
  const palette = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of [...names, ...extraNames]) {
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push(n);
      if (out.length >= 16) break;
    }
    return out;
  }, [names, extraNames]);

  const onCanvasLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    const h = Math.round(e.nativeEvent.layout.height);
    if (w !== size.w || h !== size.h) setSize({ w, h });
  };

  const commit = useCallback((id: string, x: number, y: number) => {
    setDoc((prev) => moveSticker(prev, id, { x, y }));
    setDirty(true);
  }, []);

  const commitScale = useCallback((id: string, scale: number) => {
    setDoc((prev) => moveSticker(prev, id, { scale }));
    setDirty(true);
  }, []);

  const add = (name: string) => {
    setDoc((prev) => {
      if (prev.stickers.length >= LIVE_LOG_MAX_STICKERS) {
        Alert.alert("贴纸满了", `一张画布最多 ${LIVE_LOG_MAX_STICKERS} 张贴纸，先删掉几张再摆吧。`);
        return prev;
      }
      return addSticker(prev, name);
    });
    setDirty(true);
    haptics.light();
  };

  const nudgeSelected = (patch: { scale?: number; rotate?: number }) => {
    if (!selected) return;
    const current = doc.stickers.find((s) => s.id === selected);
    if (!current) return;
    haptics.light();
    setDoc((prev) =>
      moveSticker(prev, selected, {
        scale: patch.scale ?? current.scale,
        rotate: patch.rotate ?? current.rotate,
      })
    );
    setDirty(true);
  };

  const save = async () => {
    await saveLiveLog(doc);
    setDirty(false);
    setSavedAt(new Date().toISOString());
    haptics.success();
  };

  return (
    <BottomSheet visible={visible} onClose={closeAndSave} title="Today LiveLog" height="90%" scroll={false}>
      <View style={styles.wrap}>
        <View style={styles.head}>
          <View style={styles.headText}>
            <Text style={styles.headTitle}>
              自由拖动贴纸 <Text style={styles.headCount}>{doc.stickers.length}/{LIVE_LOG_MAX_STICKERS}</Text>
            </Text>
            <Text style={styles.headSub}>
              只保存在本机，不会上传
              {savedAt ? ` · 已保存 ${clock(savedAt)}` : dirty ? " · 有未保存改动" : ""}
            </Text>
          </View>
          <PressableScale haptic scaleTo={0.94} onPress={() => void save()} style={styles.saveBtn}>
            <Text style={styles.saveText}>保存</Text>
          </PressableScale>
        </View>

        {/* 画布 */}
        <View style={[styles.canvas, { width: canvasW, height: canvasH }]} onLayout={onCanvasLayout}>
          {bg.kind === "gradient" && bg.colors ? (
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id="liveLogBg" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={bg.colors[0]} />
                  <Stop offset="1" stopColor={bg.colors[1]} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#liveLogBg)" />
            </Svg>
          ) : bingUrl ? (
            <Image
              source={{ uri: bingUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.canvasFallback]} />
          )}

          {/* 可读性蒙层：壁纸可能是亮色雪景/天空，贴纸描边在白底上会糊 */}
          <View pointerEvents="none" style={styles.canvasScrim} />

          {size.w > 0
            ? doc.stickers.map((s) => (
                <DraggableSticker
                  key={s.id}
                  sticker={s}
                  size={size}
                  selected={selected === s.id}
                  onSelect={setSelected}
                  onCommit={commit}
                  onCommitScale={commitScale}
                />
              ))
            : null}

          {doc.stickers.length === 0 ? (
            <View pointerEvents="none" style={styles.canvasEmpty}>
              <ThemedIcon name="hand-left-outline" size={22} color="rgba(255,255,255,0.9)" />
              <Text style={styles.canvasEmptyText}>从下面挑一张贴纸，拖到你喜欢的位置</Text>
            </View>
          ) : null}

          {needBing ? (
            <View pointerEvents="none" style={styles.bgLoading}>
              <Text style={styles.bgLoadingText}>今日壁纸加载中…</Text>
            </View>
          ) : null}
        </View>

        {/* 工具条 1：贴纸候选 */}
        <View style={styles.paletteHead}>
          <Text style={styles.paletteTitle}>点一下加贴纸</Text>
          <Pressable
            hitSlop={8}
            onPress={() => {
              haptics.soft();
              setDoc((prev) => cycleBackground(prev, 1, skipBg));
              setDirty(true);
            }}
            style={styles.bgBtn}
            accessibilityLabel="切换背景"
          >
            <ThemedIcon name="image-outline" size={14} color={colors.primary} />
            <Text style={styles.bgBtnText}>背景 · {bg.name}</Text>
          </Pressable>
        </View>

        {palette.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paletteRow}>
            {palette.map((n) => (
              <PressableScale key={n} haptic scaleTo={0.92} onPress={() => add(n)} style={styles.paletteItem}>
                <FoodSticker name={n} size={40} outlined rotate={-4} />
                <Text style={styles.paletteName} numberOfLines={1}>
                  {n}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.paletteEmpty}>今天还没有饮食记录，先去记一条再回来摆贴纸</Text>
        )}

        {/* 工具条 2：选中贴纸的操作 */}
        <View style={styles.tools}>
          <ToolBtn
            icon="add"
            label="放大"
            disabled={!selected}
            onPress={() => nudgeSelected({ scale: (doc.stickers.find((s) => s.id === selected)?.scale ?? 1) + 0.15 })}
          />
          <ToolBtn
            icon="remove"
            label="缩小"
            disabled={!selected}
            onPress={() => nudgeSelected({ scale: (doc.stickers.find((s) => s.id === selected)?.scale ?? 1) - 0.15 })}
          />
          <ToolBtn
            icon="refresh-outline"
            label="转一下"
            disabled={!selected}
            onPress={() => nudgeSelected({ rotate: (doc.stickers.find((s) => s.id === selected)?.rotate ?? 0) + 12 })}
          />
          <ToolBtn
            icon="trash-outline"
            label="删除"
            disabled={!selected}
            onPress={() => {
              if (!selected) return;
              haptics.warning();
              setDoc((prev) => removeSticker(prev, selected));
              setSelected(null);
              setDirty(true);
            }}
          />
          <ToolBtn
            icon="close-circle-outline"
            label="清空"
            disabled={doc.stickers.length === 0}
            onPress={() => {
              haptics.warning();
              setDoc((prev) => clearStickers(prev));
              setSelected(null);
              setDirty(true);
            }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

/** 单张贴纸：拖拽（UI 线程）+ 双指缩放；松手时才回写状态（避免每帧跨线程 setState） */
function DraggableSticker({
  sticker,
  size,
  selected,
  onSelect,
  onCommit,
  onCommitScale,
}: {
  sticker: LiveSticker;
  size: { w: number; h: number };
  selected: boolean;
  onSelect: (id: string) => void;
  onCommit: (id: string, x: number, y: number) => void;
  onCommitScale: (id: string, scale: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const base = 56;
  const tx = useSharedValue(sticker.x * size.w);
  const ty = useSharedValue(sticker.y * size.h);
  const sc = useSharedValue(sticker.scale);
  const startScale = useSharedValue(sticker.scale);
  /** 手指按下时"贴纸中心 − 手指"的偏移：不加它贴纸会在按下瞬间跳到手指中心 */
  const grabX = useSharedValue(0);
  const grabY = useSharedValue(0);

  // 外部（回写后被夹取、或打开时载入）变化 → 同步回共享值
  useEffect(() => {
    tx.value = sticker.x * size.w;
    ty.value = sticker.y * size.h;
    sc.value = sticker.scale;
  }, [sticker.x, sticker.y, sticker.scale, size.w, size.h, tx, ty, sc]);

  const minX = size.w * 0.08;
  const maxX = size.w * 0.92;
  const minY = size.h * 0.08;
  const maxY = size.h * 0.92;

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onBegin((e) => {
          // 按下即选中（顺带覆盖"单击选中"的语义，不必再叠一个 Tap 手势）
          runOnJS(onSelect)(sticker.id);
          grabX.value = tx.value - e.absoluteX;
          grabY.value = ty.value - e.absoluteY;
        })
        .onUpdate((e) => {
          const nx = e.absoluteX + grabX.value;
          const ny = e.absoluteY + grabY.value;
          tx.value = nx < minX ? minX : nx > maxX ? maxX : nx;
          ty.value = ny < minY ? minY : ny > maxY ? maxY : ny;
        })
        .onEnd(() => {
          // 松手才回写状态：拖动过程零 React 重渲染
          runOnJS(onCommit)(sticker.id, tx.value / size.w, ty.value / size.h);
        }),
    [grabX, grabY, maxX, maxY, minX, minY, onCommit, onSelect, size.h, size.w, sticker.id, tx, ty]
  );

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          startScale.value = sc.value;
        })
        .onUpdate((e) => {
          const next = startScale.value * e.scale;
          sc.value = next < 0.6 ? 0.6 : next > 2 ? 2 : next;
        })
        .onEnd(() => {
          runOnJS(onCommitScale)(sticker.id, sc.value);
        }),
    [onCommitScale, sc, startScale, sticker.id]
  );

  const composed = useMemo(() => Gesture.Simultaneous(pan, pinch), [pan, pinch]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value - base / 2 },
      { translateY: ty.value - base / 2 },
      { scale: sc.value },
      { rotate: `${sticker.rotate}deg` },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[styles.stickerWrap, selected && styles.stickerSelected, style]}
        accessibilityLabel={`贴纸 ${sticker.name}，可拖动`}
      >
        <FoodSticker name={sticker.name} size={base} outlined rotate={-3} />
      </Animated.View>
    </GestureDetector>
  );
}

function ToolBtn({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: ComponentProps<typeof ThemedIcon>["name"];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.tool, disabled && styles.toolOff]}
      accessibilityLabel={label}
    >
      <ThemedIcon name={icon} size={17} color={disabled ? colors.textFaint : colors.textMuted} />
      <Text style={[styles.toolText, disabled && styles.toolTextOff]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Bing 每日壁纸 URL（LiveLog 的背景之一）。
 *
 * 为什么这里又写了一遍拉取逻辑：`focus-timer.tsx` 里那段是内联的，而 P4-c 明确要求
 * **不动 focus-timer**（它是 P2 的成果）。所以这里独立实现一份，并沿用同样的两条策略：
 * ① 先用上次缓存的 URL 秒出图；② 拉到新 URL 后写缓存 + 预取（`expo-image` 磁盘缓存）。
 * 后续若要合并，抽成 `lib/` 里的共享 hook 即可，两边行为已一致。
 */
function useBingWallpaper(enabled: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void (async () => {
      try {
        const cached = await AsyncStorage.getItem("live-bg-bing-v1");
        if (alive && cached) {
          const parsed = JSON.parse(cached) as { url?: string };
          if (parsed?.url) setUrl(parsed.url);
        }
      } catch {
        // 缓存损坏：忽略
      }
      try {
        const r = await fetch(`${getApiUrl()}/api/background`);
        const d = (r.ok ? await r.json() : null) as { exists?: boolean; date?: string } | null;
        if (!alive || !d?.exists || !d.date) return;
        const next = `${getApiUrl()}/api/background/img?date=${encodeURIComponent(d.date)}`;
        setUrl(next);
        void AsyncStorage.setItem("live-bg-bing-v1", JSON.stringify({ date: d.date, url: next })).catch(() => {});
        void Image.prefetch(next, { cachePolicy: "memory-disk" }).catch(() => {});
      } catch {
        // 拉不到：保留缓存值；没有缓存时背景循环会自动跳过"今日壁纸"
      }
    })();
    return () => {
      alive = false;
    };
  }, [enabled]);
  return url;
}

function clock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { flex: 1, gap: 10, paddingTop: 2 },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    headText: { flex: 1, minWidth: 0, gap: 2 },
    headTitle: { ...typography.headline, color: colors.text },
    headCount: { ...typography.caption, color: colors.textMuted, fontWeight: "700" },
    headSub: { ...typography.micro, color: colors.textMuted, fontWeight: "500" },
    saveBtn: {
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    saveText: { ...typography.caption, color: "#fff", fontWeight: "800" },
    canvas: {
      alignSelf: "center",
      borderRadius: radius.lg,
      overflow: "hidden",
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    canvasFallback: { backgroundColor: "#3A3226" },
    canvasScrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.12)" },
    canvasEmpty: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 24,
    },
    canvasEmptyText: { ...typography.caption, color: "rgba(255,255,255,0.94)", textAlign: "center", fontWeight: "600" },
    bgLoading: { position: "absolute", top: 8, right: 10 },
    bgLoadingText: { ...typography.micro, fontSize: 9, color: "rgba(255,255,255,0.9)", fontWeight: "600" },
    stickerWrap: { position: "absolute", left: 0, top: 0, width: 56, height: 56, ...shadows.card },
    stickerSelected: {
      borderRadius: 18,
      borderWidth: 2,
      borderColor: "#FFFFFF",
    },
    paletteHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    paletteTitle: { ...typography.caption, color: colors.text, fontWeight: "700" },
    bgBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
    },
    bgBtnText: { ...typography.micro, color: colors.primary, fontWeight: "700" },
    paletteRow: { gap: 10, paddingVertical: 2, paddingRight: 8 },
    paletteItem: { alignItems: "center", gap: 3, width: 52 },
    paletteName: { ...typography.micro, fontSize: 9, color: colors.textMuted, fontWeight: "600", width: 52, textAlign: "center" },
    paletteEmpty: { ...typography.caption, color: colors.textMuted, textAlign: "center", paddingVertical: 10 },
    tools: { flexDirection: "row", gap: 6, paddingTop: 2 },
    tool: {
      flex: 1,
      alignItems: "center",
      gap: 2,
      paddingVertical: 8,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
    },
    toolOff: { opacity: 0.5 },
    toolText: { ...typography.micro, fontSize: 10, color: colors.textMuted, fontWeight: "700" },
    toolTextOff: { color: colors.textFaint },
  });
