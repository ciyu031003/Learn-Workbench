import { useId, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { typography } from "@/theme/tokens";
import { clamp } from "./v15-ui";
import type { V15Palette } from "./v15-theme";

export interface V15RingSpec {
  pct: number;
  color: string;
}

/** 同心环：外圈热量 / 内圈蛋白（demo v15Rings） */
export function V15RingStack({
  size,
  stroke = 11,
  rings,
  track,
  children,
}: {
  size: number;
  stroke?: number;
  rings: V15RingSpec[];
  track: string;
  children?: ReactNode;
}) {
  const raw = useId();
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        {rings.map((ring, index) => {
          const r = (size - stroke) / 2 - index * stroke * 1.48;
          if (r <= 0) return null;
          const c = 2 * Math.PI * r;
          const pct = clamp(ring.pct, 0, 100);
          return (
            <G key={`ring-${raw}-${index}`}>
              <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
              {pct > 0 ? (
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={ring.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${c} ${c}`}
                  strokeDashoffset={c * (1 - pct / 100)}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              ) : null}
            </G>
          );
        })}
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>{children}</View>
      </View>
    </View>
  );
}

export interface V15BarItem {
  key: string;
  label: string;
  value: number;
  valueLabel?: string;
  planned?: boolean;
  active?: boolean;
}

/** 柱状图：实心=已完成、虚线=计划；目标线横穿卡片 */
export function V15Bars({
  p,
  items,
  max,
  goal,
  height = 128,
  color,
  goalColor,
}: {
  p: V15Palette;
  items: V15BarItem[];
  max?: number;
  goal?: number;
  height?: number;
  color?: string;
  goalColor?: string;
}) {
  const chartH = height;
  const values = items.map((item) => (item.planned || item.value > 0 ? item.value : 0));
  const top = Math.max(1, max ?? Math.max(...values, goal ?? 0) * 1.14);
  const goalY = goal !== undefined && goal > 0 ? clamp((goal / top) * chartH, 0, chartH) : null;
  return (
    <View>
      <View style={{ height: chartH, flexDirection: "row", alignItems: "flex-end", gap: 7 }}>
        {goalY !== null ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: "flex-end" }]}>
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: goalY,
                borderTopWidth: 1,
                borderStyle: "dashed",
                borderColor: goalColor ?? p.lineStrong,
              }}
            />
          </View>
        ) : null}
        {items.map((item) => {
          const h = item.value > 0 ? Math.max(4, (item.value / top) * chartH) : 2;
          const fill = item.planned ? "transparent" : item.active ? color ?? p.orange : color ?? p.orange;
          return (
            <View key={item.key} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4, height: chartH }}>
              {item.valueLabel ? (
                <Text style={[styles.barValue, { color: item.active ? p.orange : p.sub }]} numberOfLines={1}>
                  {item.valueLabel}
                </Text>
              ) : null}
              <View
                style={{
                  width: "100%",
                  maxWidth: 38,
                  height: h,
                  borderRadius: 7,
                  backgroundColor: fill,
                  borderWidth: item.planned ? 1 : 0,
                  borderStyle: item.planned ? "dashed" : "solid",
                  borderColor: p.green,
                  opacity: item.active ? 1 : item.planned ? 0.9 : 0.58,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 7, marginTop: 8 }}>
        {items.map((item) => (
          <Text key={`label-${item.key}`} style={[styles.barLabel, { color: item.active ? p.ink : p.faint, fontWeight: item.active ? "800" : "600", flex: 1, textAlign: "center" }]}>
            {item.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** 周条：周一…周日 + 日期数字 + 有记录的小圆点 */
export function V15WeekStrip({
  p,
  items,
  onPick,
}: {
  p: V15Palette;
  items: { key: string; label: string; kcal: number; active?: boolean }[];
  onPick?: (key: string) => void;
}) {
  return (
    <View style={[styles.week, { backgroundColor: p.card, borderColor: p.line }]}>
      {items.map((item) => {
        const date = new Date(item.key + "T00:00:00");
        const dayNum = Number.isNaN(date.getTime()) ? "" : String(date.getDate());
        const active = item.active;
        return (
          <Pressable
            key={item.key}
            onPress={() => onPick?.(item.key)}
            accessibilityRole="button"
            accessibilityLabel={`${item.label} ${dayNum} 日${item.kcal > 0 ? "，已记录" : ""}`}
            accessibilityState={{ selected: active }}
            style={{ flex: 1, alignItems: "center" }}
            hitSlop={{ top: 4, bottom: 4 }}
          >
            <View style={[styles.day, active && { backgroundColor: p.ink }]}>
              <Text style={[styles.dayLabel, { color: active ? p.canvasTop : p.sub }]} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={[styles.dayNum, { color: active ? p.canvasTop : p.ink }]} numberOfLines={1}>
                {dayNum}
              </Text>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: item.kcal > 0 ? (active ? p.canvasTop : p.orange) : "transparent" }} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 整晚结构：只画真实分期占比，不伪造逐段时间轴 */
export function V15StageRows({
  p,
  slices,
}: {
  p: V15Palette;
  slices: { key: string; label: string; minutes: number; pct: number; color: string }[];
}) {
  return (
    <View style={{ gap: 8 }}>
      {slices.map((slice) => (
        <View key={slice.key} style={styles.stageRow}>
          <Text style={[styles.stageLabel, { color: p.sub }]} numberOfLines={1}>
            {slice.label}
          </Text>
          <View style={{ flex: 1, height: 12, borderRadius: 4, backgroundColor: p.track, overflow: "hidden" }}>
            <View style={{ width: `${clamp(slice.pct, 0, 100)}%`, height: "100%", borderRadius: 4, backgroundColor: slice.color, opacity: 0.9 }} />
          </View>
          <Text style={[styles.stagePct, { color: p.ink }]} numberOfLines={1}>
            {Math.round(slice.pct)}%
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  barValue: { ...typography.micro, fontVariant: ["tabular-nums"] },
  barLabel: { ...typography.micro },
  week: { flexDirection: "row", gap: 2, padding: 5, borderRadius: 18, borderWidth: 1, marginTop: 14 },
  day: { flex: 1, minHeight: 48, width: "100%", borderRadius: 13, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 5 },
  dayLabel: { ...typography.micro, fontWeight: "600" },
  dayNum: { ...typography.headline, fontWeight: "800", ...{ fontVariant: ["tabular-nums"] } },
  stageRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stageLabel: { ...typography.caption, width: 32 },
  stagePct: { ...typography.micro, width: 34, textAlign: "right", fontVariant: ["tabular-nums"] },
});


