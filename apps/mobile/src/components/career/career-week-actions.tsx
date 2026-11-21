import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { PressableScale } from "@/components/pressable-scale";
import { Icon, ICON_SIZE } from "@/components/ui/icon";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";

import { makeStyles } from "./career-styles";
import type { CareerWeekAction } from "./career-model";

/**
 * ⑤ 本周行动（对齐 demo 的 .todo3）：3 条可勾选清单。
 *
 * 标题是产品叙事（静态），副文案尽量挂真实数据（最近截止 / 首个缺口 / 简历完成度）。
 * 勾选是**真实本地 state toggle**（不是视觉假态），刷新页面后回到未勾选（不落库，
 * 避免为装饰性清单新增写入接口）。
 */
export function CareerWeekActions({ actions }: { actions: CareerWeekAction[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [done, setDone] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => {
    haptics.light();
    setDone((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <View>
      {actions.map((action, index) => {
        const checked = Boolean(done[action.key]);
        return (
          <PressableScale
            key={action.key}
            scaleTo={0.995}
            hitSlop={4}
            onPress={() => toggle(action.key)}
            style={[styles.actionRow, index === actions.length - 1 && styles.actionRowLast]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={action.title + "，" + action.detail + "，" + (checked ? "已完成" : "未完成")}
          >
            <View style={[styles.tick, checked && styles.tickDone]}>
              {checked ? <Icon name="check" size={ICON_SIZE.sm} weight="bold" color={colors.surface} /> : null}
            </View>
            <View style={styles.actionBody}>
              <Text style={[styles.actionTitle, checked && styles.actionTitleDone]}>{action.title}</Text>
              <Text style={styles.actionDetail} numberOfLines={2}>
                {action.detail}
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
