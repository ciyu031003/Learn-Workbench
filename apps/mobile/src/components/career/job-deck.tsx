import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { BlurView } from "expo-blur";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { JobPostingListItem } from "@learn-workbench/shared/schemas";
import { useBlurTarget } from "@/components/blur-target";
import { Icon } from "@/components/ui/icon";
import { haptics } from "@/lib/haptics";
import { useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme";
import { isMotionActive } from "@/theme/motion";
import { radius, shadows, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 岗位卡组（对齐 demo「职业 · 岗位卡片」）。
 *
 * - 单张卡居中、3D 悬浮（拖动时轻微 rotateX/rotate，松手回正）；
 * - 卡片本体是一整块不透明材质：surfaceStrong 打底 + 极淡主色 wash + 装饰环，
 *   不再用 BlurView 当卡面底材（半透明底会让边缘发灰、内容区像贴了一块白矩形）；
 * - 左右滑动 = 旧卡滑出 → 高斯模糊盖满 → 遮罩下换卡 → 新卡在模糊里落位 → 模糊退场，
 *   换字永远发生在完全模糊的一帧，不会出现两张卡文字交叉或闪一下；
 * - 卡片底部是唯一主 CTA「一键投递」，收藏在右上角；
 * - 左右切换按钮放在卡片下方并留出 26pt 间距，不贴着卡边。
 */

const CARD_MAX_W = 380;
const CARD_HEIGHT_RATIO = 0.5;
const SWIPE_RATIO = 0.22;
const SWIPE_VELOCITY = 720;

function salaryOf(job: JobPostingListItem): string {
  return job.salaryText || (job.salaryMin && job.salaryMax ? `${job.salaryMin}-${job.salaryMax}K` : "薪资面议");
}

export function JobDeck({
  jobs,
  applyingId,
  onApply,
  onToggleFavorite,
  onOpen,
}: {
  jobs: JobPostingListItem[];
  applyingId: string | null;
  onApply: (job: JobPostingListItem) => void;
  onToggleFavorite: (job: JobPostingListItem) => void;
  onOpen: (job: JobPostingListItem) => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const blurTarget = useBlurTarget();
  const { width: winW, height: winH } = useWindowDimensions();
  const reduced = useReducedMotion();
  const active = isMotionActive(reduced);

  const cardW = Math.min(winW - 56, CARD_MAX_W);
  const cardH = Math.min(Math.round(winH * CARD_HEIGHT_RATIO), 420);

  const [index, setIndex] = useState(0);
  const [swapping, setSwapping] = useState(false);
  const safeIndex = jobs.length === 0 ? 0 : Math.min(index, jobs.length - 1);
  const job = jobs[safeIndex];

  const dx = useSharedValue(0);
  const blur = useSharedValue(0);

  /**
   * 换卡发生在高斯模糊完全遮住卡面的一帧：只换 index，并把卡片直接放回正中。
   * 普通函数即可：不进 hook 依赖，避免 react-hooks/immutability 把 shared value 当成不可变参数。
   */
  function commit(next: number) {
    setIndex(next);
    dx.value = 0;
    // 换字后先保持一帧满模糊，再显影：避免 Android 磨砂回退层在新旧卡片交界处闪字。
    blur.value = active ? withDelay(70, withTiming(0, { duration: 210 })) : 0;
    setSwapping(false);
  }

  function go(dir: 1 | -1) {
    if (swapping) return;
    const next = safeIndex + dir;
    if (next < 0 || next >= jobs.length) {
      haptics.soft();
      dx.value = withSpring(dir * 12, { damping: 18, stiffness: 260 }, () => {
        dx.value = withSpring(0, { damping: 20, stiffness: 220 });
      });
      return;
    }
    haptics.light();
    setSwapping(true);
    if (!active) {
      setIndex(next);
      dx.value = 0;
      blur.value = 0;
      setSwapping(false);
      return;
    }
    // 旧卡先滑出；模糊在 150ms 内盖满，换卡时卡面已经不可辨认
    blur.value = withTiming(1, { duration: 150 });
    dx.value = withTiming(dir * (cardW + 96), { duration: 200 }, (finished) => {
      if (finished) runOnJS(commit)(next);
    });
  }

  const pan = Gesture.Pan()
    .enabled(!swapping)
    .activeOffsetX([-12, 12])
    .failOffsetY([-18, 18])
    .onUpdate((event) => {
      dx.value = event.translationX;
    })
    .onEnd((event) => {
      const threshold = cardW * SWIPE_RATIO;
      if (event.translationX < -threshold || event.velocityX < -SWIPE_VELOCITY) {
        runOnJS(go)(1);
      } else if (event.translationX > threshold || event.velocityX > SWIPE_VELOCITY) {
        runOnJS(go)(-1);
      } else {
        dx.value = withSpring(0, { damping: 26, stiffness: 240 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dx.value },
      { translateY: interpolate(Math.abs(dx.value), [0, cardW], [0, 8]) },
      { rotate: `${(dx.value / Math.max(1, cardW)) * 5}deg` },
      { rotateX: `${(Math.abs(dx.value) / Math.max(1, cardW)) * -4}deg` },
    ],
  }));

  const blurStyle = useAnimatedStyle(() => ({ opacity: blur.value }));

  const behind1 = useAnimatedStyle(() => {
    const p = interpolate(Math.abs(dx.value), [0, cardW * 0.6], [0, 1]);
    return { transform: [{ translateY: 12 - p * 8 }, { scale: 0.95 + p * 0.03 }], opacity: 0.6 + p * 0.3 };
  });
  const behind2 = useAnimatedStyle(() => ({
    transform: [{ translateY: 24 }, { scale: 0.9 }],
    opacity: 0.36,
  }));

  if (!job) return null;

  const salary = salaryOf(job);
  const meta = [job.city ? job.city + (job.district ?? "") : null, job.experience, job.education].filter(Boolean);

  return (
    <View style={styles.wrap}>
      <View style={[styles.stack, { width: cardW, height: cardH }]}>
        {safeIndex + 2 < jobs.length ? (
          <Animated.View pointerEvents="none" style={[styles.behind, { width: cardW, height: cardH }, behind2]}>
            <DeckBack job={jobs[safeIndex + 2]} styles={styles} />
          </Animated.View>
        ) : null}
        {safeIndex + 1 < jobs.length ? (
          <Animated.View pointerEvents="none" style={[styles.behind, { width: cardW, height: cardH }, behind1]}>
            <DeckBack job={jobs[safeIndex + 1]} styles={styles} />
          </Animated.View>
        ) : null}

        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.card, { width: cardW, height: cardH }, cardStyle]}>
            {/* 卡面材质：整块不透明底 + 极淡色温，不再让屏幕背景从卡片边缘透出来 */}
            <View pointerEvents="none" style={styles.cardGlow} />
            <View pointerEvents="none" style={styles.cardOrbit} />

            <View style={styles.topRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{job.company.slice(0, 1)}</Text>
              </View>
              <View style={styles.companyBox}>
                <Text style={styles.company} numberOfLines={1}>
                  {job.company}
                </Text>
                <Text style={styles.city} numberOfLines={1}>
                  {meta.join(" · ")}
                </Text>
              </View>
              <Pressable
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={job.isFav ? "取消收藏" : "收藏岗位"}
                onPress={() => {
                  haptics.soft();
                  onToggleFavorite(job);
                }}
                style={styles.favBtn}
              >
                <Icon name="star" size={20} weight={job.isFav ? "fill" : "regular"} color={job.isFav ? colors.accent : colors.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.title} numberOfLines={2}>
              {job.title}
            </Text>

            <View style={styles.salaryRow}>
              <Text style={[styles.salary, tabularNums]}>{salary}</Text>
              <View style={styles.countChip}>
                <Text style={styles.countText}>
                  {safeIndex + 1} / {jobs.length}
                </Text>
              </View>
            </View>

            <View style={styles.chipsWrap}>
              {job.tags.slice(0, 4).map((tag) => (
                <View key={tag} style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>

            {/* 信息区不再套一块 surfaceMuted 的白矩形，改成同卡材质 + 细分割线 */}
            <View style={styles.infoBlock}>
              <InfoRow label="工作城市" value={(job.city ?? "") + (job.district ?? "") || "不限"} />
              <InfoRow label="经验要求" value={job.experience || "不限"} />
              <InfoRow label="学历要求" value={job.education || "不限"} />
              <InfoRow label="信息来源" value={sourceLabel(job.source)} />
            </View>

            <View style={styles.spacer} />

            <Pressable
              hitSlop={8}
              onPress={() => {
                haptics.soft();
                onOpen(job);
              }}
              style={styles.detailLink}
              accessibilityRole="button"
              accessibilityLabel="查看岗位详情"
            >
              <Text style={styles.detailText}>查看完整岗位详情</Text>
              <Icon name="chevron" size={14} weight="bold" color={colors.primary} />
            </Pressable>

            <Pressable
              disabled={applyingId === job.id}
              onPress={() => {
                haptics.success();
                onApply(job);
              }}
              style={({ pressed }) => [styles.applyBtn, pressed && styles.applyPressed]}
              accessibilityRole="button"
              accessibilityLabel="一键投递"
            >
              <Icon name="check" size={18} weight="bold" color={colors.canvas} />
              <Text style={styles.applyText}>{applyingId === job.id ? "投递中…" : "一键投递"}</Text>
            </Pressable>

            {/* 高斯模糊过渡层：换卡时盖满整卡，文字永远在完全模糊的一帧切换 */}
            <Animated.View pointerEvents="none" style={[styles.blurLayer, blurStyle]}>
              {Platform.OS !== "android" || blurTarget ? (
                <BlurView
                  intensity={44}
                  tint={dark ? "dark" : "light"}
                  blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined}
                  blurTarget={blurTarget ?? undefined}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.blurFallback]} />
              )}
              <View style={styles.blurVeil} />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={() => go(-1)}
          disabled={safeIndex === 0}
          hitSlop={8}
          style={[styles.arrow, safeIndex === 0 && styles.arrowOff]}
          accessibilityRole="button"
          accessibilityLabel="上一张岗位卡"
        >
          <Icon name="chevron" size={20} weight="bold" color={colors.text} style={{ transform: [{ rotate: "180deg" }] }} />
        </Pressable>
        <Pressable
          onPress={() => go(1)}
          disabled={safeIndex >= jobs.length - 1}
          hitSlop={8}
          style={[styles.arrow, safeIndex >= jobs.length - 1 && styles.arrowOff]}
          accessibilityRole="button"
          accessibilityLabel="下一张岗位卡"
        >
          <Icon name="chevron" size={20} weight="bold" color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

function DeckBack({ job, styles }: { job: JobPostingListItem; styles: ReturnType<typeof makeStyles> }) {
  return (
    <>
      <View style={styles.behindTop}>
        <View style={styles.behindAvatar}>
          <Text style={styles.behindAvatarText}>{job.company.slice(0, 1)}</Text>
        </View>
        <Text style={styles.behindCompany} numberOfLines={1}>
          {job.company}
        </Text>
      </View>
      <Text style={styles.behindTitle} numberOfLines={2}>
        {job.title}
      </Text>
      <Text style={styles.behindSalary}>{salaryOf(job)}</Text>
    </>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  boss: "BOSS 直聘",
  liepin: "猎聘",
  lagou: "拉勾",
  maitu: "麦田",
  jobui: "职友集",
  shixiseng: "实习僧",
  nowcoder: "牛客",
  zhaopin: "智联招聘",
  zhilian: "智联招聘",
  "51job": "前程无忧",
};

function sourceLabel(source: string) {
  return SOURCE_LABELS[source] ?? source;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors, dark: boolean) =>
  StyleSheet.create({
    wrap: { alignItems: "center", gap: 26 },
    stack: { alignItems: "center", justifyContent: "center" },
    behind: {
      position: "absolute",
      borderRadius: radius.panel,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      padding: 20,
      gap: 6,
      overflow: "hidden",
    },
    behindTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    behindAvatar: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    behindAvatarText: { fontSize: 15, fontWeight: "800", color: colors.primary },
    behindCompany: { ...typography.caption, fontWeight: "700", color: colors.textMuted, flex: 1 },
    behindTitle: { ...typography.title2, fontWeight: "800", color: colors.textSecondary, marginTop: 6 },
    behindSalary: { ...typography.callout, fontWeight: "800", color: colors.primary, marginTop: 4 },
    card: {
      position: "absolute",
      borderRadius: radius.panel,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: dark ? "rgba(255,255,255,0.14)" : "rgba(15,37,48,0.10)",
      backgroundColor: colors.surfaceStrong,
      ...shadows.floating,
    },
    /**
     * 卡面色温：必须整卡铺满。
     * 只铺上半卡会让下半张露出 surfaceStrong 的纯白，形成一块“中间白矩形”，
     * 所以这里用全高、极低透明度的主色 wash，让标题、信息行和投递区落在同一材质上。
     */
    cardGlow: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: dark ? "rgba(47,116,192,0.075)" : "rgba(47,116,192,0.035)",
    },
    cardOrbit: {
      position: "absolute",
      top: -92,
      right: -74,
      width: 190,
      height: 190,
      borderRadius: 95,
      borderWidth: 26,
      borderColor: dark ? "rgba(255,255,255,0.035)" : "rgba(47,116,192,0.055)",
    },
    topRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.sm },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    avatarText: { fontSize: 18, lineHeight: 22, fontWeight: "800", color: colors.primary },
    companyBox: { flex: 1, minWidth: 0, gap: 2 },
    company: { ...typography.callout, fontWeight: "700", color: colors.text },
    city: { ...typography.meta, color: colors.textMuted },
    favBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
    title: { ...typography.hero, paddingHorizontal: spacing.lg, color: colors.text, fontSize: 22, lineHeight: 30 },
    salaryRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
    salary: { ...typography.title2, color: colors.primary, fontWeight: "800" },
    countChip: { marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
    countText: { ...typography.micro, color: colors.textMeta, ...tabularNums },
    chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: spacing.lg, marginTop: spacing.md },
    chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, maxWidth: "48%" },
    chipText: { ...typography.micro, fontWeight: "600", color: colors.textSecondary },
    spacer: { flex: 1 },
    /** 信息区：同卡材质 + 顶部细线，没有独立底色 */
    infoBlock: {
      marginTop: spacing.md,
      marginHorizontal: spacing.lg,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 25 },
    infoLabel: { ...typography.meta, color: colors.textMuted },
    infoValue: { ...typography.caption, fontWeight: "700", color: colors.text, flexShrink: 1, textAlign: "right" },
    detailLink: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: spacing.lg, paddingVertical: 4 },
    detailText: { ...typography.caption, fontWeight: "600", color: colors.primary },
    applyBtn: {
      margin: spacing.lg,
      marginTop: spacing.sm,
      minHeight: 50,
      borderRadius: radius.control,
      backgroundColor: colors.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    applyPressed: { opacity: 0.86 },
    applyText: { ...typography.callout, fontWeight: "700", color: colors.canvas },
    blurLayer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    /** Android 没有可用的 blurTarget：用半透明同色磨砂代替纯白实底，避免闪白 */
    blurFallback: { backgroundColor: colors.surfaceStrong, opacity: 0.42 },
    blurVeil: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.surfaceStrong,
      opacity: 0.26,
    },
    controls: { flexDirection: "row", alignItems: "center", gap: 40 },
    arrow: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      ...shadows.card,
    },
    arrowOff: { opacity: 0.35 },
  });
