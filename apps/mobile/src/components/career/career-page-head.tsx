import { useMemo } from "react";

import { PageHead } from "@/components/v2/page-head";
import { useTheme } from "@/theme";

import { makeStyles } from "./career-styles";

/**
 * ① 页头：eyebrow + 主标题 + 副文案。
 * 入场动画留在 career.tsx 的组合层（本区块没有独立 Animated.View），本组件只出内容。
 */
export function CareerPageHead({ subtitle }: { subtitle: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <PageHead eyebrow="职业 · 求职准备" title="职业" subtitle={subtitle} style={styles.pageHead} />;
}
