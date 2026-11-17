import { Text, View } from "react-native";

import { tabularNums } from "@/theme/tokens";
import type { RadarJobLike } from "@/lib/radar-filter";

import { makeStyles } from "./radar-styles";

/**
 * 岗位雷达的局部小组件 / 类型 / 常量（从 app/radar.tsx 原样搬出，逻辑与数值未改）。
 *
 * - RadarJob / RadarResponse：接口回包形状，hook 与岗位卡共用；
 * - CHIP_LIMIT / CHIP_LIMIT_EXPANDED：卡片技能标签折叠阈值；
 * - TARGET_ROLE_MAX_LENGTH：目标岗位输入上限（与接口 target 上限 40 留余量）；
 * - Stat：概览卡里的一个统计格。
 */
export interface RadarJob extends RadarJobLike {
  jobId: number;
  url: string;
  deadlineLabel: string | null;
  matchedSkills: { skill: string }[];
  missingSkills: { skill: string }[];
  gapHours: number;
  fromFavorite?: boolean;
  fromApplication?: boolean;
}

export interface RadarResponse {
  mode: "batch" | "fallback";
  hasProfile: boolean;
  profileCity: string | null;
  targetRole: string | null;
  top: RadarJob[];
  counts: { candidates: number; matched: number; favorites: number; applications: number };
  total?: number;
}

/** 卡片里默认展示的技能标签数（超出折叠） */
export const CHIP_LIMIT = 4;
/** 展开后最多展示的技能标签数 */
export const CHIP_LIMIT_EXPANDED = 10;
/** 目标岗位输入上限：移动端编辑按任务口径 ≤30 字（接口 target 上限 40，留余量） */
export const TARGET_ROLE_MAX_LENGTH = 30;

export function Stat({
  value,
  label,
  highlight = false,
  styles,
}: {
  value: number;
  label: string;
  highlight?: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, tabularNums, highlight && styles.statValueHighlight]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

