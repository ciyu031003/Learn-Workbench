import { useState , useMemo } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";

export interface ChartDatum {
  label: string;
  value: number;
}

function useChartWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };
  return { width, onLayout };
}

function boundedMax(data: ChartDatum[], fallback = 1) {
  const max = Math.max(...data.map((d) => d.value), 0);
  return max === 0 ? fallback : max;
}

export function BarChart({
  data,
  height = 150,
  color = "#2F74C0",
  colorTo = "#78C2E8",
  showLabels = true,
}: {
  data: ChartDatum[];
  height?: number;
  color?: string;
  colorTo?: string;
  showLabels?: boolean;
}) {
  const { width, onLayout } = useChartWidth();
  const topPad = 16;
  const bottomPad = showLabels ? 24 : 10;
  const plotH = Math.max(30, height - topPad - bottomPad);
  const max = boundedMax(data);
  const n = data.length;
  const slot = width / Math.max(1, n);
  const barW = Math.max(8, Math.min(26, slot * 0.56));
  const gid = "barGrad";

  return (
    <View style={{ height }} onLayout={onLayout}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} />
              <Stop offset="1" stopColor={colorTo} />
            </LinearGradient>
          </Defs>
          {data.map((d, i) => {
            const h = d.value <= 0 ? 2 : Math.max(6, Math.round((d.value / max) * plotH));
            const x = slot * i + (slot - barW) / 2;
            const y = topPad + plotH - h;
            return (
              <Rect
                key={i}
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={barW / 2}
                fill={`url(#${gid})`}
                opacity={d.value <= 0 ? 0.25 : 1}
              />
            );
          })}
          {showLabels
            ? data.map((d, i) => (
                <SvgText
                  key={"l" + i}
                  x={slot * i + slot / 2}
                  y={height - 8}
                  fontSize={9}
                  fill="#A0998A"
                  textAnchor="middle"
                >
                  {d.label}
                </SvgText>
              ))
            : null}
        </Svg>
      ) : null}
    </View>
  );
}

function buildSmoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    const midX = (prev.x + cur.x) / 2;
    const midY = (prev.y + cur.y) / 2;
    d += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function LineChart({
  data,
  height = 150,
  color = "#F28C28",
  fillTo = ["#FFF0DB", "#FFF6EC"],
  showLabels = true,
  labelStep = 3,
}: {
  data: ChartDatum[];
  height?: number;
  color?: string;
  fillTo?: [string, string];
  showLabels?: boolean;
  labelStep?: number;
}) {
  const { width, onLayout } = useChartWidth();
  const topPad = 16;
  const rightPad = 8;
  const leftPad = 8;
  const bottomPad = showLabels ? 24 : 10;
  const plotW = Math.max(1, width - leftPad - rightPad);
  const plotH = Math.max(30, height - topPad - bottomPad);
  const max = boundedMax(data);
  const n = data.length;

  const pts = data.map((d, i) => {
    const x = leftPad + (n <= 1 ? plotW : (plotW * i) / (n - 1));
    const y = topPad + plotH - (d.value <= 0 ? 0 : (d.value / max) * plotH);
    return { x, y };
  });

  const linePath = buildSmoothPath(pts);
  const areaPath = pts.length
    ? `${linePath} L ${pts[pts.length - 1].x} ${topPad + plotH} L ${pts[0].x} ${topPad + plotH} Z`
    : "";

  const gid = "lineFill";

  return (
    <View style={{ height }} onLayout={onLayout}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={fillTo[0]} stopOpacity={0.85} />
              <Stop offset="1" stopColor={fillTo[1]} stopOpacity={0.2} />
            </LinearGradient>
          </Defs>
          {[0.25, 0.5, 0.75].map((r) => (
            <Path
              key={r}
              d={`M ${leftPad} ${topPad + plotH * r} L ${leftPad + plotW} ${topPad + plotH * r}`}
              stroke="rgba(120,90,45,0.10)"
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          ))}
          {areaPath ? <Path d={areaPath} fill={`url(#${gid})`} /> : null}
          {linePath ? <Path d={linePath} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /> : null}
          {pts.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4.5 : 3} fill="#fff" stroke={color} strokeWidth={2.5} />
          ))}
          {showLabels
            ? data.map((d, i) =>
                i % labelStep === 0 || i === n - 1 ? (
                  <SvgText
                    key={"l" + i}
                    x={pts[i].x}
                    y={height - 8}
                    fontSize={9}
                    fill="#A0998A"
                    textAnchor="middle"
                  >
                    {d.label}
                  </SvgText>
                ) : null
              )
            : null}
        </Svg>
      ) : null}
    </View>
  );
}

export const chartStyles = StyleSheet.create({
  wrap: { width: "100%" },
});
