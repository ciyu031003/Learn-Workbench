import { useId, useMemo } from "react";
import { Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { router } from "expo-router";

import { Icon } from "@/components/ui/icon";
import { PressableScale } from "@/components/pressable-scale";
import { SectionTitle } from "@/components/v2/section-title";
import { useTheme } from "@/theme";

import { makeStyles } from "./learn-styles";
import type { LearnChapterNode } from "./use-learn-screen";

/**
 * ③ 章节树（对齐 demo .crail）：1px 渐变竖线 + 主题节点。
 *
 * 节点 = 当前阶段的一个主题：标题 + 一行 meta（已读 / 未开始 · N 道练习）+ 知识点小圆点行
 * （已完成实心绿 / 当前蓝 / 其余灰）。点按进阶段树（/phase/[id]），长按看主题详情弹层。
 * 竖线用 react-native-svg 的 LinearGradient 画（RN 没有 CSS 渐变），两端淡出避免"硬切"。
 */
export function LearnChapterRail({ nodes, meta }: { nodes: LearnChapterNode[]; meta: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const rawId = useId();
  const gradientId = useMemo(() => "lwbRail" + rawId.replace(/[^a-zA-Z0-9]/g, ""), [rawId]);

  return (
    <>
      <SectionTitle title="章节树" right={<Text style={styles.sectionMeta}>{meta}</Text>} style={styles.sectionTitle} />

      {nodes.length === 0 ? (
        <View style={styles.railEmpty}>
          <Icon name="info" size={16} weight="regular" color={colors.textMuted} />
          <Text style={styles.railEmptyText}>当前阶段还没有主题，先建一条路线或导入 Markdown。</Text>
          <PressableScale
            hitSlop={10}
            scaleTo={0.95}
            onPress={() => router.push("/roadmap" as never)}
            style={styles.railEmptyLink}
            accessibilityRole="button"
            accessibilityLabel="打开阶段路线，新建阶段或导入 Markdown"
          >
            <Text style={styles.railEmptyLinkText}>去建路线</Text>
          </PressableScale>
        </View>
      ) : (
        <View style={styles.railWrap}>
          <View pointerEvents="none" style={styles.railLine}>
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.primary} stopOpacity={0.55} />
                  <Stop offset="1" stopColor={colors.primary} stopOpacity={0.05} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill={"url(#" + gradientId + ")"} />
            </Svg>
          </View>

          {nodes.map((node) => (
            <PressableScale
              key={node.id}
              haptic
              hitSlop={4}
              scaleTo={0.99}
              onPress={node.onPress}
              onLongPress={node.onOpenDetails}
              style={styles.node}
              accessibilityRole="button"
              accessibilityLabel={node.a11y}
              accessibilityHint="长按查看该主题的练习与验收"
            >
              <View style={styles.nodeTime}>
                <View style={[styles.nodeHalo, node.state === "now" && styles.nodeHaloNow]}>
                  <View
                    style={[
                      styles.nodeDot,
                      node.state === "done" && styles.nodeDotDone,
                      node.state === "now" && styles.nodeDotNow,
                    ]}
                  />
                </View>
              </View>

              <View style={styles.nodeBody}>
                <View style={styles.nodeTitleRow}>
                  <Text style={styles.nodeTitle} numberOfLines={1}>
                    {node.title}
                  </Text>
                  {node.state === "now" ? <Text style={styles.nodeBadge}>在读</Text> : null}
                </View>
                <Text style={styles.nodeMeta} numberOfLines={1}>
                  {node.meta}
                </Text>
                {node.points.length > 0 ? (
                  <View style={styles.nodeDots}>
                    {node.points.map((point, index) => (
                      <View
                        key={index}
                        style={[
                          styles.nodePoint,
                          point === "done" && styles.nodePointDone,
                          point === "current" && styles.nodePointCurrent,
                        ]}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            </PressableScale>
          ))}
        </View>
      )}
    </>
  );
}
