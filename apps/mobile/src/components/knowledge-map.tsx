import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";
import { router } from "expo-router";
import Svg, { Circle, G, Line, Rect, Text as SvgText } from "react-native-svg";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import {
  MAP_MAX_ZOOM,
  clampMapPan,
  clampMapZoom,
  knowledgeMapNodeRoute,
  layoutKnowledgeMap,
  mapViewport,
  type Exam408KnowledgeMap,
  type MapNodeBox,
} from "@/lib/exam-408-map";
import { setNavPendingParams } from "@/lib/nav-pending";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 408 章节知识图谱原生渲染（v1.55）：替代原来的 iframe 占位 + 外链。
 *
 * 设计取舍：
 * - **自绘 SVG**：只画「章节起点 + 主线顺序链 + 旁支虚线」，不引入力导向布局/第三方图库；
 *   逻辑坐标 = 渲染像素（列宽按容器宽等比切分），zoom=1 时字号就是设计字号，不会糊。
 * - **手势**：单指拖动（仅在放大后）、双指缩放、按钮缩放、重置；图谱卡片自带边界钳制，
 *   不会把图拖出视口。zoom=1 时不拦截纵向拖动，页面仍能正常滚动。
 * - **可读性兜底**：提供「列表」模式，按 章节起点 / 主线知识点 / 补充旁支 分组，
 *   小屏、读屏、或不想缩放时用列表直读；两种模式都能点节点跳转。
 */

export interface KnowledgeMapProps {
  map: Exam408KnowledgeMap | null;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

const GRAPH_MIN_HEIGHT = 200;

export function KnowledgeMap({ map, loading, error, onRetry }: KnowledgeMapProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [mode, setMode] = useState<"graph" | "list">("graph");
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  /**
   * 手势起始快照（grant 时写入）。用 state 而不是 ref：仓库的 react-hooks 规则禁止
   * 「渲染期读写 ref」，而 PanResponder 又在渲染期创建；起始值是事件时刻的数据，
   * 放进 state 后响应器按依赖重建，语义相同且能通过 lint。
   */
  const [gestureStart, setGestureStart] = useState({ zoom: 1, panX: 0, panY: 0, distance: 0 });

  const layout = useMemo(
    () => (map && containerWidth > 0 ? layoutKnowledgeMap(map, { width: containerWidth }) : null),
    [map, containerWidth],
  );
  const viewport = useMemo(
    () => (layout ? mapViewport(layout, containerWidth) : { fitScale: 1, height: GRAPH_MIN_HEIGHT }),
    [layout, containerWidth],
  );
  const scale = viewport.fitScale * zoom;

  const contentWidth = layout?.width ?? 320;
  const contentHeight = layout?.height ?? GRAPH_MIN_HEIGHT;

  const applyPan = useCallback(
    (nextX: number, nextY: number, nextScale: number) => {
      const clamped = clampMapPan(nextX, nextY, nextScale, contentWidth, contentHeight, contentWidth, viewport.height);
      setPan({ x: clamped.translateX, y: clamped.translateY });
    },
    [contentHeight, contentWidth, viewport.height],
  );

  const applyZoom = useCallback(
    (nextZoom: number) => {
      const clamped = clampMapZoom(nextZoom);
      setZoom(clamped);
      const nextScale = viewport.fitScale * clamped;
      setPan((previous) => {
        const bounded = clampMapPan(previous.x, previous.y, nextScale, contentWidth, contentHeight, contentWidth, viewport.height);
        return { x: bounded.translateX, y: bounded.translateY };
      });
    },
    [contentHeight, contentWidth, viewport.fitScale, viewport.height],
  );

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setGestureStart({ zoom: 1, panX: 0, panY: 0, distance: 0 });
  }, []);

  const responder = useMemo(
    () =>
      PanResponder.create({
        // 起手不抢手势：单击节点要能正常触发、zoom=1 时页面也要能正常滚动
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (event, state) => {
          if (event.nativeEvent.touches.length >= 2) return true;
          if (gestureStart.zoom <= 1.01) return false;
          return Math.abs(state.dx) > 4 || Math.abs(state.dy) > 4;
        },
        onPanResponderGrant: (event: GestureResponderEvent) => {
          setGestureStart({
            zoom,
            panX: pan.x,
            panY: pan.y,
            distance: distanceOf(event.nativeEvent.touches),
          });
        },
        onPanResponderMove: (event: GestureResponderEvent, state) => {
          const touches = event.nativeEvent.touches;
          if (touches.length >= 2 && gestureStart.distance > 0) {
            // 双指缩放：两指距离比作为倍率（不追踪焦点，稳定且够用）
            applyZoom((gestureStart.zoom * distanceOf(touches)) / gestureStart.distance);
            return;
          }
          // 单指平移：只在放大后生效（zoom=1 时内容不溢出，拖动会白抢页面滚动）
          const nextScale = viewport.fitScale * gestureStart.zoom;
          applyPan(gestureStart.panX + state.dx, gestureStart.panY + state.dy, nextScale);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: () => {
          setGestureStart((previous) => ({ ...previous, distance: 0 }));
        },
      }),
    [applyPan, applyZoom, gestureStart, pan.x, pan.y, viewport.fitScale, zoom],
  );

  const openNode = useCallback((box: MapNodeBox) => {
    const route = knowledgeMapNodeRoute(box.node);
    if (!route) return;
    setNavPendingParams(route.channel, route.params);
    router.push(route.path as never);
  }, []);

  const chapterTitle = map?.chapter ?? "章节图谱";

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headIcon}>
          <ThemedIcon name="git-network-outline" size={18} color={colors.primary} />
        </View>
        <View style={styles.headBody}>
          <Text style={styles.headTitle} numberOfLines={1}>
            {chapterTitle} · 知识图谱
          </Text>
          <Text style={styles.headMeta} numberOfLines={1}>
            {loading ? "正在绘制…" : map ? map.nodes.length + " 个知识点 · " + countByType(map) : "本章暂无图谱"}
          </Text>
        </View>
        {map ? (
          <View style={styles.modeTabs}>
            {(["graph", "list"] as const).map((item) => (
              <Pressable
                key={item}
                hitSlop={6}
                onPress={() => setMode(item)}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === item }}
                style={[styles.modeTab, mode === item ? styles.modeTabActive : null]}
              >
                <Text style={[styles.modeTabText, mode === item ? styles.modeTabTextActive : null]}>
                  {item === "graph" ? "图谱" : "列表"}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>正在加载本章知识图谱…</Text>
        </View>
      ) : !map || !layout ? (
        <View style={styles.stateBox}>
          <ThemedIcon name="map-outline" size={22} color={colors.textMuted} />
          <Text style={styles.stateText}>{error || "本章知识图谱暂未同步"}</Text>
          {onRetry ? (
            <PressableScale haptic onPress={onRetry} style={styles.retry}>
              <Text style={styles.retryText}>重试</Text>
            </PressableScale>
          ) : null}
        </View>
      ) : mode === "list" ? (
        <MapList map={map} onNodePress={openNode} styles={styles} colors={colors} />
      ) : (
        <View style={styles.graphWrap}>
          <View
            style={styles.canvas}
            onLayout={(event) => {
              const next = Math.round(event.nativeEvent.layout.width);
              if (next > 0 && next !== containerWidth) setContainerWidth(next);
            }}
            {...responder.panHandlers}
          >
            {containerWidth > 0 ? (
              <Svg width="100%" height={viewport.height} viewBox={"0 0 " + layout.width + " " + viewport.height}>
                <G transform={"translate(" + pan.x + ", " + pan.y + ") scale(" + scale + ")"}>
                  {layout.edges.map((edge, index) => (
                    <Line
                      key={"e-" + index}
                      x1={edge.x1}
                      y1={edge.y1}
                      x2={edge.x2}
                      y2={edge.y2}
                      stroke={edge.dashed ? colors.accent : colors.borderStrong}
                      strokeWidth={edge.dashed ? 1.2 : 1.6}
                      strokeDasharray={edge.dashed ? "4 4" : undefined}
                      strokeLinecap="round"
                    />
                  ))}
                  <ChapterNode box={layout.chapter} colors={colors} />
                  {layout.nodes.map((box, index) => (
                    <MapNode key={"n-" + index} box={box} colors={colors} onPress={openNode} />
                  ))}
                </G>
              </Svg>
            ) : (
              <View style={{ height: GRAPH_MIN_HEIGHT }} />
            )}
          </View>
          <View style={styles.footer}>
            <Text style={styles.hint} numberOfLines={1}>
              双指缩放 · 放大后可拖动 · 点节点跳转
            </Text>
            <View style={styles.zoomBar}>
              <IconButton
                label="缩小"
                icon="remove"
                disabled={zoom <= 1}
                onPress={() => applyZoom(zoom - 0.5)}
                styles={styles}
                colors={colors}
              />
              <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
              <IconButton
                label="放大"
                icon="add"
                disabled={zoom >= MAP_MAX_ZOOM}
                onPress={() => applyZoom(zoom + 0.5)}
                styles={styles}
                colors={colors}
              />
              <IconButton label="重置视图" icon="refresh" onPress={resetView} styles={styles} colors={colors} />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function distanceOf(touches: readonly { pageX: number; pageY: number }[]): number {
  if (touches.length < 2) return 0;
  const [first, second] = touches;
  return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}

function countByType(map: Exam408KnowledgeMap): string {
  const core = map.nodes.filter((node) => node.type === "core").length;
  const ext = map.nodes.length - core;
  return ext > 0 ? "主线 " + core + " · 补充 " + ext : "主线 " + core;
}

function importanceColor(importance: string, colors: ThemeColors): string {
  if (importance === "must") return colors.danger;
  if (importance === "rare" || importance === "none") return colors.textFaint;
  return colors.primary;
}

function ChapterNode({ box, colors }: { box: MapNodeBox; colors: ThemeColors }) {
  return (
    <G>
      <Rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        rx={12}
        fill={colors.primarySoft}
        stroke={colors.primary}
        strokeWidth={1.2}
      />
      <SvgText x={box.x + 14} y={box.y + 18} fontSize={10} fill={colors.primaryStrong}>
        章节起点
      </SvgText>
      <SvgText x={box.x + 14} y={box.y + 34} fontSize={15} fontWeight="700" fill={colors.text}>
        {box.lines[0] ?? box.node.title}
      </SvgText>
      <SvgText x={box.x + box.width - 14} y={box.y + box.height - 12} fontSize={10} fill={colors.primaryStrong} textAnchor="end">
        {box.meta}
      </SvgText>
    </G>
  );
}

function MapNode({
  box,
  colors,
  onPress,
}: {
  box: MapNodeBox;
  colors: ThemeColors;
  onPress: (box: MapNodeBox) => void;
}) {
  const isExt = box.kind === "ext";
  const fill = isExt ? colors.accentSoft : colors.surface;
  const stroke = isExt ? colors.accent : colors.borderStrong;
  const titleSize = isExt ? 11 : 13;
  const lineHeight = isExt ? 15 : 17;
  const titleTop = box.y + 20;
  const actionable = Boolean(box.node.studySlug || box.node.pointKey);
  return (
    <G
      onPress={actionable ? () => onPress(box) : undefined}
      accessibilityRole={actionable ? "button" : undefined}
      accessibilityLabel={box.node.title + "，" + box.meta + (actionable ? "，点按跳转" : "")}
    >
      <Rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        rx={11}
        fill={fill}
        stroke={stroke}
        strokeWidth={isExt ? 1.1 : 1.3}
        strokeDasharray={isExt ? "5 4" : undefined}
      />
      <Circle cx={box.x + 11} cy={box.y + 13} r={3} fill={importanceColor(box.node.importance, colors)} />
      {box.lines.map((line, index) => (
        <SvgText
          key={index}
          x={box.x + 20}
          y={titleTop + index * lineHeight}
          fontSize={titleSize}
          fontWeight={box.node.type === "core" ? "600" : "500"}
          fill={colors.text}
        >
          {line}
        </SvgText>
      ))}
      <SvgText
        x={box.x + 20}
        y={box.y + box.height - 9}
        fontSize={9.5}
        fill={isExt ? colors.accentStrong : colors.textMuted}
      >
        {box.meta}
      </SvgText>
      {actionable ? (
        <SvgText x={box.x + box.width - 12} y={box.y + box.height - 9} fontSize={10} fill={colors.textFaint} textAnchor="end">
          ›
        </SvgText>
      ) : null}
    </G>
  );
}

function MapList({
  map,
  onNodePress,
  styles,
  colors,
}: {
  map: Exam408KnowledgeMap;
  onNodePress: (box: MapNodeBox) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
}) {
  const core = map.nodes.filter((node) => node.type === "core");
  const ext = map.nodes.filter((node) => node.type === "ext");
  const rows = [
    { title: "主线知识点", items: core, kind: "core" as const },
    { title: "补充与旁支", items: ext, kind: "ext" as const },
  ].filter((group) => group.items.length > 0);
  return (
    <View style={styles.list}>
      <View style={styles.listChapter}>
        <ThemedIcon name="flag-outline" size={15} color={colors.primary} />
        <Text style={styles.listChapterText} numberOfLines={1}>
          {map.chapter}
        </Text>
        <Text style={styles.listChapterMeta}>{map.nodes.length} 点</Text>
      </View>
      {rows.map((group) => (
        <View key={group.title} style={styles.listGroup}>
          <Text style={styles.listGroupTitle}>{group.title}</Text>
          {group.items.map((node, index) => (
            <PressableScale
              key={node.slug || group.kind + index}
              haptic
              scaleTo={0.99}
              onPress={() => onNodePress({ node, kind: group.kind, x: 0, y: 0, width: 0, height: 0, lines: [], meta: "" })}
              style={styles.listRow}
              accessibilityRole="button"
              accessibilityLabel={node.title + "，点按跳转"}
            >
              <View style={[styles.listDot, group.kind === "ext" ? styles.listDotExt : null]} />
              <View style={styles.listRowBody}>
                <Text style={styles.listRowTitle} numberOfLines={2}>
                  {node.title}
                </Text>
                <Text style={styles.listRowMeta} numberOfLines={1}>
                  {nodeMetaLabel(node)}
                </Text>
              </View>
              <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
            </PressableScale>
          ))}
        </View>
      ))}
    </View>
  );
}

function nodeMetaLabel(node: Exam408KnowledgeMap["nodes"][number]): string {
  const typeLabel = node.type === "ext" ? "补充" : "核心";
  if (node.examFrequency > 0) return typeLabel + " · 真题 " + node.examFrequency + " 次";
  if (node.counts.questions > 0) return typeLabel + " · " + node.counts.questions + " 题";
  return typeLabel;
}

function IconButton({
  label,
  icon,
  onPress,
  disabled,
  styles,
  colors,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  disabled?: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
}) {
  return (
    <Pressable
      hitSlop={8}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.iconButton, disabled ? styles.iconButtonDisabled : null]}
    >
      <ThemedIcon name={icon as never} size={16} color={disabled ? colors.textFaint : colors.text} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.md,
    },
    head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    headIcon: {
      width: 32,
      height: 32,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    headBody: { flex: 1, gap: 2 },
    headTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    headMeta: { ...typography.caption, color: colors.textMuted },
    modeTabs: { flexDirection: "row", gap: 2, padding: 2, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
    modeTab: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
    modeTabActive: { backgroundColor: colors.surface },
    modeTabText: { ...typography.caption, color: colors.textMuted },
    modeTabTextActive: { color: colors.text, fontWeight: "700" },
    graphWrap: { gap: spacing.sm },
    canvas: {
      borderRadius: radius.md,
      backgroundColor: colors.canvas,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },
    footer: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    hint: { ...typography.caption, color: colors.textFaint, flex: 1 },
    zoomBar: { flexDirection: "row", alignItems: "center", gap: 2 },
    zoomText: { ...typography.caption, color: colors.textMuted, minWidth: 38, textAlign: "center" },
    iconButton: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    iconButtonDisabled: { opacity: 0.45 },
    stateBox: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
    stateText: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
    retry: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
    retryText: { ...typography.caption, fontWeight: "700", color: colors.primaryStrong },
    list: { gap: spacing.md },
    listChapter: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.primarySoft,
    },
    listChapterText: { ...typography.callout, fontWeight: "700", color: colors.text, flex: 1 },
    listChapterMeta: { ...typography.caption, color: colors.primaryStrong },
    listGroup: { gap: 6 },
    listGroupTitle: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    listRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
    },
    listDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
    listDotExt: { backgroundColor: colors.accent },
    listRowBody: { flex: 1, gap: 2 },
    listRowTitle: { ...typography.callout, fontWeight: "600", color: colors.text },
    listRowMeta: { ...typography.caption, color: colors.textMuted },
  });
