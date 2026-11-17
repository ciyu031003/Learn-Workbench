import { useMemo } from "react";
import { Text, View } from "react-native";

import { Card } from "@/components/card";
import { PressableScale } from "@/components/pressable-scale";
import type { MarketGapItem } from "@learn-workbench/shared/schemas";
import type { MarketPersonalInsights } from "@/lib/market";
import { useTheme } from "@/theme";

import { makeStyles } from "./market-styles";
import { KpiCard } from "./market-widgets";

/**
 * 我的市场位置卡：技能覆盖 / 可触达（KPI）+ 优先补什么（可一键加入今日计划）+ 推荐岗位。
 * 未登录时展示登录引导（登录弹层在 market-sheets.tsx）。
 */
export function MarketPersonalCard({
  personal,
  enrolling,
  onEnroll,
  onOpenAuth,
}: {
  personal: MarketPersonalInsights;
  enrolling: string | null;
  onEnroll: (gap: MarketGapItem) => void;
  onOpenAuth: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Card title="我的市场位置" subtitle="技能覆盖、可触达岗位和推荐">
      {personal.loggedIn ? (
        <View style={styles.personalBody}>
          <View style={styles.kpiGrid}>
            <KpiCard styles={styles} colors={colors} icon="git-branch-outline" label="技能覆盖" value={`${personal.profile.skillCoveragePct}%`} color={colors.lavender} />
            <KpiCard styles={styles} colors={colors} icon="briefcase-outline" label="可触达" value={personal.reachableJobs} color={colors.primary} />
          </View>
          <Text style={styles.groupTitle}>优先补什么</Text>
          {personal.gaps.slice(0, 5).map((gap) => (
            <View key={gap.skill} style={styles.gapRow}>
              <View style={styles.moveMain}>
                <Text style={styles.skillName} numberOfLines={1}>{gap.skill}</Text>
                <Text style={styles.skillMeta}>{gap.topicTitle ?? "技能主题"} · 约 {gap.estimateHours ?? 8}h</Text>
              </View>
              <PressableScale
                haptic
                disabled={enrolling === gap.skill || !gap.enrollable}
                style={[styles.gapButton, (!gap.enrollable || enrolling === gap.skill) && styles.gapButtonDisabled]}
                onPress={() => void onEnroll(gap)}
              >
                <Text style={styles.gapButtonText}>{enrolling === gap.skill ? "加入中" : "加入"}</Text>
              </PressableScale>
            </View>
          ))}
          {!personal.gaps.length ? <Text style={styles.mutedText}>当前能力画像已覆盖主要热门技能</Text> : null}
          <Text style={styles.groupTitle}>推荐岗位</Text>
          {personal.recommendations.slice(0, 4).map((job) => (
            <View key={job.id} style={styles.recommendRow}>
              <View style={styles.moveMain}>
                <Text style={styles.skillName} numberOfLines={1}>{job.title}</Text>
                <Text style={styles.skillMeta}>{job.company} · {job.city} · {job.salaryText}</Text>
                {job.missingSkills.length ? <Text style={styles.skillMeta}>还缺 {job.missingSkills.slice(0, 3).join(" / ")}</Text> : null}
              </View>
              <Text style={styles.matchText}>{job.match}%</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.loginBox}>
          <Text style={styles.loginText}>登录后查看技能覆盖、可触达岗位和推荐职位。</Text>
          <PressableScale haptic style={styles.gapButton} onPress={onOpenAuth}>
            <Text style={styles.gapButtonText}>去登录</Text>
          </PressableScale>
        </View>
      )}
    </Card>
  );
}
