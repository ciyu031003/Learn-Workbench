import { useMemo } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";

import { PressableScale } from "@/components/pressable-scale";
import { Icon, ICON_SIZE } from "@/components/ui/icon";
import { useTheme } from "@/theme";

import { makeStyles } from "./career-styles";
import type { CareerDecisionRow } from "./career-model";

/**
 * ② 岗位决策矩阵（对齐 demo 的 .dw-matrix）：表格式，不是卡片流。
 *
 * 列：岗位 / 匹配 / 薪资 / 成长 / 截止。
 * - 匹配：彩色数字徽章，绿 ≥75 / 蓝 ≥65 / 灰 <65（阈值在 career-model 里锁定）；
 * - 成长：由岗位的技能缺口条数派生（缺口越多 = 可补空间越大），不是凭空编的档位；
 * - 截止：服务端 deadlineLabel 压缩成「21d / 今日」；
 * - 行点击进 /job-detail?id=（详情页负责收藏/投递），空态进 /jobs 挑岗位。
 */
export function CareerDecisionMatrix({ rows }: { rows: CareerDecisionRow[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.matrix}>
      <View style={styles.matrixHead}>
        <Text style={styles.matrixHeadTitle}>岗位</Text>
        <Text style={[styles.matrixHeadCell, styles.colMatch]}>匹配</Text>
        <Text style={[styles.matrixHeadCell, styles.colSalary]}>薪资</Text>
        <Text style={[styles.matrixHeadCell, styles.colGrowth]}>成长</Text>
        <Text style={[styles.matrixHeadCell, styles.matrixHeadDeadline, styles.colDeadline]}>截止</Text>
      </View>

      {rows.length === 0 ? (
        <PressableScale
          haptic
          scaleTo={0.995}
          hitSlop={4}
          onPress={() => router.push("/jobs" as never)}
          style={styles.matrixEmpty}
          accessibilityRole="button"
          accessibilityLabel="还没有匹配岗位，去招花挑岗位"
        >
          <Text style={styles.matrixEmptyText}>还没有匹配岗位 · 去招花挑岗位</Text>
          <Icon name="chevron" size={ICON_SIZE.sm} weight="bold" color={colors.primary} />
        </PressableScale>
      ) : (
        rows.map((row, index) => {
          /**
           * 匹配徽章：底色区分绿 / 蓝 / 灰，数字统一用正文色 ——
           * 软色底 + 状态色文字在浅色档只有 ~3:1（10pt 数字读不清），
           * 所以"颜色编码"交给底，可读性交给 text。
           */
          const matchTone =
            row.matchTone === "hi"
              ? { bg: colors.successSoft, fg: colors.text, border: colors.success }
              : row.matchTone === "mid"
                ? { bg: colors.primarySoft, fg: colors.text, border: colors.primary }
                : { bg: colors.surfaceMuted, fg: colors.textSecondary, border: colors.borderStrong };
          const growthColor =
            row.growth.tone === "warn" ? colors.accentStrong : row.growth.tone === "mid" ? colors.primary : colors.textSecondary;
          const matchLabel = row.match > 0 ? String(row.match) : "—";
          return (
            <View key={row.key}>
              {index > 0 ? <View style={styles.matrixDivider} /> : null}
              <PressableScale
                haptic
                scaleTo={0.995}
                hitSlop={4}
                pressedStyle={styles.matrixRowPressed}
                onPress={() => router.push(("/job-detail?id=" + encodeURIComponent(String(row.jobId))) as never)}
                style={styles.matrixRow}
                accessibilityRole="button"
                accessibilityLabel={
                  row.title +
                  "，" +
                  row.company +
                  "，匹配 " +
                  matchLabel +
                  "，薪资 " +
                  row.salary +
                  "，成长 " +
                  row.growth.label +
                  "，" +
                  (row.deadline === "—" ? "暂无截止" : row.deadline + " 截止") +
                  "，打开岗位详情"
                }
              >
                <View style={styles.mName}>
                  <Text style={styles.mTitle} numberOfLines={1}>
                    {row.title}
                  </Text>
                  <Text style={styles.mSub} numberOfLines={1}>
                    {row.company}
                  </Text>
                </View>
                <View style={[styles.colMatch, styles.badgeCell]}>
                  <View style={[styles.badge, { backgroundColor: matchTone.bg, borderColor: matchTone.border }]}>
                    <Text style={[styles.badgeText, { color: matchTone.fg }]}>{matchLabel}</Text>
                  </View>
                </View>
                <Text style={[styles.mSalary, styles.colSalary]} numberOfLines={1}>
                  {row.salary}
                </Text>
                <Text style={[styles.mGrowth, styles.colGrowth, { color: growthColor }]}>{row.growth.label}</Text>
                <Text style={[styles.mDeadline, styles.colDeadline]} numberOfLines={1}>
                  {row.deadline}
                </Text>
              </PressableScale>
            </View>
          );
        })
      )}
    </View>
  );
}
