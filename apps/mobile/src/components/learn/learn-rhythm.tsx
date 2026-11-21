import { useMemo } from "react";
import { Text, View } from "react-native";

import { SectionTitle } from "@/components/v2/section-title";
import { useTheme } from "@/theme";
import { normalizeByMax } from "@/lib/chart-math";

import { makeStyles } from "./learn-styles";

/** 柱状条高度（px）：轨道固定，填充按当天占近 7 天最大值的比例缩放 */
const RHYTHM_HEIGHT = 52;

/**
 * ④ 学习节律（对齐 demo .rhythm）：最近 7 天柱状条（今天橙色）+ 一二三四五六日 标签。
 *
 * 数据来自 store.sessions 经 computeFocusStats 派生的近 7 天分钟数（hook 的 last7Minutes），
 * 没有数据时全部 0 高度但**保留轨道结构**（不允许整块消失）。
 * 下面的那一行文字承接原来的「学习成果」数字（周总时长 / 日均 / 连续天数）。
 */
export function LearnRhythm({
  minutes,
  labels,
  weekTotal,
  avgDailyMinutes,
  streak,
}: {
  minutes: number[];
  labels: string[];
  weekTotal: number;
  avgDailyMinutes: number;
  streak: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const ratios = useMemo(() => normalizeByMax(minutes), [minutes]);
  const statsText =
    weekTotal > 0
      ? "近 7 天专注 " + weekTotal + " 分钟 · 日均 " + avgDailyMinutes + " 分钟 · 连续 " + streak + " 天"
      : "近 7 天还没有专注记录 · 连续 " + streak + " 天";

  return (
    <>
      <SectionTitle title="学习节律" right={<Text style={styles.sectionMeta}>近 7 天</Text>} style={styles.sectionTitle} />

      <View style={styles.rhythmBars} accessible={false}>
        {ratios.map((ratio, index) => {
          const isToday = index === ratios.length - 1;
          /** 非零值至少 4px，避免"有记录但看不见"；0 值保持 0（只剩轨道） */
          const fillHeight = ratio > 0 ? Math.max(4, Math.round(ratio * RHYTHM_HEIGHT)) : 0;
          return (
            <View key={index} style={[styles.rhythmCol, { height: RHYTHM_HEIGHT }]}>
              <View
                style={[styles.rhythmFill, isToday && styles.rhythmFillToday, { height: fillHeight }]}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.rhythmLabels} accessible={false}>
        {labels.map((label, index) => (
          <Text
            key={label + index}
            style={[styles.rhythmLabel, index === labels.length - 1 && styles.rhythmLabelToday]}
          >
            {label}
          </Text>
        ))}
      </View>

      <Text style={styles.rhythmStats}>{statsText}</Text>
    </>
  );
}
