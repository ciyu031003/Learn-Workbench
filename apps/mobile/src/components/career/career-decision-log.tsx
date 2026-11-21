import { useMemo } from "react";
import { Text, View } from "react-native";

import { useTheme } from "@/theme";

import { makeStyles } from "./career-styles";
import type { CareerLogItem } from "./career-model";

/**
 * ⑥ 决策日志（对齐 demo 的 .dlog）：左侧日期 + 一句话，样式像日志而不是卡片。
 *
 * 文案是产品叙事（静态），日期按「今天往前推」生成，第三条的目标方向取真实画像值。
 * 等后端有 career_decisions 表后再把这里换成真实流。
 */
export function CareerDecisionLog({ items }: { items: CareerLogItem[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View>
      {items.map((item, index) => (
        <View key={item.key} style={[styles.logRow, index === items.length - 1 && styles.logRowLast]}>
          <Text style={styles.logDate}>{item.date}</Text>
          <View style={styles.logBody}>
            <Text style={styles.logText}>
              {item.prefix}
              <Text style={styles.logStrong}>{item.highlight}</Text>
              {item.suffix}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
