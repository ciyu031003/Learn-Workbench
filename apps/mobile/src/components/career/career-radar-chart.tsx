import { useMemo } from "react";

import { Surface } from "@/components/surface";
import { RadarChart } from "@/components/v2/charts";
import { useTheme } from "@/theme";

import { makeStyles } from "./career-styles";
import { DIMENSION_AXIS_LABELS, type CareerDimension } from "./career-model";

/**
 * ④ 能力雷达：四维能力画像（无目标方向时整块不渲染，判定在 career.tsx）。
 * 轴标签用 DIMENSION_AXIS_LABELS 的短名（基础/项目/证书/面试），尺寸与圈数与拆分前一致。
 */
export function CareerRadarChart({
  dimensions,
  overall,
}: {
  dimensions: CareerDimension[];
  overall: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Surface style={styles.radarCard}>
      <RadarChart
        title="能力雷达"
        axes={dimensions.map((dimension) => ({ key: dimension.key, label: DIMENSION_AXIS_LABELS[dimension.key] }))}
        values={dimensions.map((dimension) => Math.max(0, dimension.score) / 100)}
        score={overall}
        scoreLabel="综合"
        size={220}
        rings={4}
      />
    </Surface>
  );
}
