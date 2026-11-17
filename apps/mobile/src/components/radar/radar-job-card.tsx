import { useMemo } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { Card } from "@/components/card";
import { PressableScale } from "@/components/pressable-scale";
import { ThemedIcon } from "@/components/themed-icon";
import { ProgressBar } from "@/components/v2/progress-bar";
import { useTheme } from "@/theme";
import { radarMatchSummary, radarUpdatedLabel } from "@/lib/radar-filter";

import { makeStyles } from "./radar-styles";
import { CHIP_LIMIT, CHIP_LIMIT_EXPANDED, type RadarJob } from "./radar-widgets";

/**
 * 岗位卡：匹配度 + 薪资/截止 + 匹配条 + 匹配理由（可展开缺失技能）+ 技能标签 + 来源页脚。
 * 数值与文案全部来自接口字段与纯函数，组件内不新增派生口径。
 */
export function RadarJobCard({
  job,
  expanded,
  onToggleExpand,
  reasonExpanded,
  onToggleReason,
  onPress,
  now,
}: {
  job: RadarJob;
  expanded: boolean;
  onToggleExpand: (jobId: number) => void;
  /** v1.62 P1-4：匹配理由默认折叠，点开看缺失技能（全局一个开关，持久化） */
  reasonExpanded: boolean;
  onToggleReason: () => void;
  onPress: (job: RadarJob) => void;
  now: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const matched = job.matchedSkills.map((item) => item.skill);
  const missing = job.missingSkills.map((item) => item.skill);
  /** v1.62 P1-4：理由摘要收敛到纯函数（文案与计数可单测） */
  const matchReason = radarMatchSummary(job);
  const tags = [...matched, ...missing];
  const limit = expanded ? CHIP_LIMIT_EXPANDED : CHIP_LIMIT;
  const visibleTags = tags.slice(0, limit);
  const hidden = Math.max(0, tags.length - visibleTags.length);
  const tone = job.overall >= 75 ? colors.success : job.overall >= 55 ? colors.primary : colors.warning;
  const soft = job.overall >= 75 ? colors.successSoft : job.overall >= 55 ? colors.primarySoft : colors.warningSoft;
  /** 匹配条 tone（与上面的 soft/tone 同一档语义） */
  const barTone: "success" | "primary" | "warning" = job.overall >= 75 ? "success" : job.overall >= 55 ? "primary" : "warning";
  const meta = [job.company, job.city || "城市不限", job.education || "学历不限", job.experience].filter(Boolean).join(" · ");
  const sourceLabel = job.source ? String(job.source) : "";
  const updatedLabel = radarUpdatedLabel(job.publishedAt, now);

  return (
    <PressableScale onPress={() => onPress(job)} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`${job.title}，${job.company}，匹配度 ${job.overall}%`}>
      <Card style={styles.jobCard}>
        <View style={styles.jobHead}>
          <View style={styles.jobHeadInfo}>
            <Text style={styles.jobTitle} numberOfLines={2}>
              {job.title}
            </Text>
            <Text style={styles.jobMeta} numberOfLines={1}>
              {meta}
            </Text>
          </View>
          <View style={[styles.matchPill, { backgroundColor: soft }]}>
            <Text style={[styles.matchPillText, { color: tone }]}>{job.overall}%</Text>
          </View>
        </View>

        <View style={styles.salaryRow}>
          <Text style={styles.salaryText} numberOfLines={1}>
            {job.salaryText || "薪资面议"}
          </Text>
          {job.deadlineLabel ? (
            <Text style={styles.deadlineText} numberOfLines={1}>
              {job.deadlineLabel}
            </Text>
          ) : null}
        </View>

        <View style={styles.matchBarRow}>
          <View style={styles.matchBar}>
            <ProgressBar value={Math.max(2, Math.min(100, job.overall)) / 100} tone={barTone} height={6} />
          </View>
          <Text style={styles.matchBarLabel}>匹配度</Text>
        </View>

        {/* 匹配理由：默认一行；点开看缺失技能（状态全局记忆，持久化） */}
        <Pressable
          hitSlop={8}
          onPress={onToggleReason}
          accessibilityRole="button"
          accessibilityState={{ expanded: reasonExpanded }}
          accessibilityLabel={reasonExpanded ? "收起匹配理由" : "展开缺失技能"}
          style={styles.reasonRow}
        >
          <ThemedIcon name="sparkles-outline" size={12} color={colors.textMuted} />
          <Text style={styles.reasonText} numberOfLines={reasonExpanded ? 2 : 1}>
            {matchReason.label}
          </Text>
          <ThemedIcon name={reasonExpanded ? "chevron-up" : "chevron-down"} size={12} color={colors.textMuted} />
        </Pressable>

        {reasonExpanded ? (
          missing.length > 0 ? (
            <View style={styles.missingRow}>
              <Text style={styles.missingLabel}>还缺</Text>
              {missing.slice(0, 8).map((skill) => (
                <View key={`miss:${skill}`} style={[styles.tag, styles.tagGap]}>
                  <Text style={styles.tagText} numberOfLines={1}>{skill}</Text>
                </View>
              ))}
              {missing.length > 8 ? <Text style={styles.missingMore}>+{missing.length - 8}</Text> : null}
            </View>
          ) : (
            <Text style={styles.missingEmpty}>技能已全部命中，保持复习即可</Text>
          )
        ) : null}

        <View style={styles.tagRow}>
          {visibleTags.map((tag) => {
            const hit = matched.includes(tag);
            return (
              <View key={`${hit ? "hit" : "gap"}:${tag}`} style={[styles.tag, hit ? styles.tagHit : styles.tagGap]}>
                <ThemedIcon
                  name={hit ? "checkmark-circle-outline" : "ellipse-outline"}
                  size={12}
                  color={hit ? colors.success : colors.textFaint}
                />
                <Text style={[styles.tagText, hit && styles.tagTextHit]} numberOfLines={1}>
                  {tag}
                </Text>
              </View>
            );
          })}
          {hidden > 0 || (expanded && tags.length > CHIP_LIMIT) ? (
            <Pressable hitSlop={8} onPress={() => onToggleExpand(job.jobId)} accessibilityRole="button" accessibilityLabel={expanded ? "收起标签" : `展开 ${hidden} 个标签`}>
              <View style={[styles.tag, styles.tagMore]}>
                <Text style={styles.tagMoreText}>{expanded ? "收起" : `+${hidden}`}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.jobFoot}>
          <Text style={styles.footText} numberOfLines={1}>
            {[sourceLabel, updatedLabel].filter(Boolean).join(" · ")}
          </Text>
          <View style={styles.footRight}>
            {job.fromFavorite ? <Text style={styles.flagText}>已收藏</Text> : null}
            {job.fromApplication ? <Text style={styles.flagText}>已投递</Text> : null}
            {job.gapHours > 0 ? (
              <Text style={styles.gapText}>缺口约 {Math.round(job.gapHours)} 小时</Text>
            ) : null}
            {job.url ? (
              <Pressable hitSlop={8} onPress={() => void Linking.openURL(job.url)} accessibilityRole="link" accessibilityLabel="查看原始来源">
                <Text style={styles.sourceLink}>原始来源</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Card>
    </PressableScale>
  );
}
