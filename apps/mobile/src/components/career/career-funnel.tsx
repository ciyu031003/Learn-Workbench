import { useMemo } from "react";
import { Text, View } from "react-native";

import { useTheme } from "@/theme";

import { makeStyles } from "./career-styles";
import type { CareerFunnelRow } from "./career-model";

/**
 * ④ 投递漏斗（对齐 demo 的 .funnel）。
 *
 * 五级：收藏 / 已投 / 笔试 / 面试 / Offer —— 每级是「累计到该阶段」的真实计数
 * （applications 按 stage 汇总，见 career-model.buildCareerFunnel），
 * 右侧是相对上一级的转化率；没有投递数据时显示空态而不是 0 冒充。
 */
export function CareerFunnel({ rows, hasData }: { rows: CareerFunnelRow[]; hasData: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!hasData) {
    return <Text style={styles.funnelEmpty}>登录并记录投递阶段后，这里会显示每一级的转化率</Text>;
  }

  return (
    <View>
      {rows.map((row) => {
        const countLabel = row.count === null ? "—" : String(row.count);
        const fillWidth: `${number}%` = `${row.widthPct}%`;
        return (
          <View
            key={row.key}
            style={styles.funnelRow}
            accessible
            accessibilityLabel={row.label + " " + countLabel + " 个，转化 " + row.rateLabel}
          >
            <Text style={styles.funnelLabel}>{row.label}</Text>
            <View style={styles.funnelTrack}>
              <View
                style={[
                  styles.funnelFill,
                  row.key === "offer" && styles.funnelFillOffer,
                  { width: fillWidth },
                ]}
              />
            </View>
            <Text style={styles.funnelCount} numberOfLines={1}>
              {countLabel}
            </Text>
            <Text style={styles.funnelRate} numberOfLines={1}>
              {row.rateLabel}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
