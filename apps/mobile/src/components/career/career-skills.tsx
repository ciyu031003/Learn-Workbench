import { useMemo } from "react";
import { Text, View } from "react-native";

import { Surface } from "@/components/surface";
import { BarList } from "@/components/v2/charts";
import { useTheme } from "@/theme";
import type { UserSkillView } from "@learn-workbench/shared/schemas";

import { makeStyles } from "./career-styles";
import type { CareerSkillGapItem } from "./career-model";

/**
 * ⑦ 我的技能：最多 12 个技能 chip + 待补技能（低于 Lv3 的前 5 项，BarList 排行）。
 * 整块只在 skills.length > 0 时渲染（判定与 SectionTitle 留在 career.tsx）。
 */
export function CareerSkills({
  skills,
  gapSkills,
  gapSkillItems,
}: {
  skills: UserSkillView[];
  gapSkills: number;
  gapSkillItems: CareerSkillGapItem[];
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Surface style={styles.skillsCard}>
      <View style={styles.skillChips}>
        {skills.slice(0, 12).map((skill) => (
          <View key={String(skill.id)} style={styles.skillChip}>
            <Text style={styles.skillChipText} numberOfLines={1}>{skill.name}</Text>
          </View>
        ))}
      </View>
      {gapSkillItems.length > 0 ? (
        <>
          <View style={styles.skillsDivider} />
          <View style={styles.gapHead}>
            <Text style={styles.gapTitle}>待补技能</Text>
            <Text style={styles.gapCount}>{gapSkills} 项低于 Lv 3</Text>
          </View>
          <View style={styles.gapList}>
            <BarList items={gapSkillItems} />
          </View>
        </>
      ) : null}
    </Surface>
  );
}
