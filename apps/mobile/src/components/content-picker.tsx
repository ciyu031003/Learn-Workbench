import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { radius, spacing, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { mainPhases } from "@learn-workbench/content";
import { readCachedRoadmap } from "@/lib/roadmap";
import type { Phase } from "@learn-workbench/shared";
import { useAppStore } from "@/store/app-store";

/** 「这次学什么」的来源：不指定 / 自由输入 / 从阶段→主题里选 */
export type ContentSource = "none" | "free" | "phase";

export interface ContentChoice {
  source: ContentSource;
  /** 展示名；空串表示"不指定"（自由输入为空时等同于不指定） */
  label: string;
  /** 本轮只用于拼 label，不落库（为将来结构化列预留，见 v5 方案 D1） */
  phaseId?: number;
  topicId?: number;
}

export const EMPTY_CONTENT: ContentChoice = Object.freeze({ source: "none" as const, label: "" });

/** 内容名长度上限：与后端 tag 文本、统计聚合的展示宽度都对齐 */
export const CONTENT_LABEL_MAX = 40;

/**
 * 取出可直接落库/展示的内容名（v5 P2）。
 *
 * 空串、纯空白都归一成 `null` —— 调用方据此判断"这次没有绑定内容"，
 * 从而走"自由专注"（不写 tag）。
 */
export function contentLabelOf(choice: ContentChoice | null | undefined): string | null {
  const trimmed = (choice?.label ?? "").trim();
  return trimmed ? trimmed.slice(0, CONTENT_LABEL_MAX) : null;
}

/**
 * 「这次学什么」选择器（v5 P2-1，决策 D3=A / D4=不记住上次）。
 *
 * 三个互斥入口：**不指定**（默认）/ **自由输入** / **阶段→主题**。
 * 被 `quick-start-sheet`（一键开始）与 `tasks`（自由专注）共用，避免两处各写一份。
 * 有意不做"记住上次"：每次打开都从「不指定」开始（D4）。
 */
export function ContentPicker({
  value,
  onChange,
}: {
  value: ContentChoice;
  onChange: (next: ContentChoice) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const customTopics = useAppStore((s) => s.customTopics);

  /**
   * 可选的阶段列表：**本机缓存的 roadmap（含自建阶段）+ 内置阶段**
   * （审查发现：只用内置 mainPhases 会让用户自建的阶段永远选不到，
   *  而它下面的自建主题也就永远不可达）。只读缓存、不发新请求。
   */
  const [cachedPhases, setCachedPhases] = useState<Phase[] | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const cached = await readCachedRoadmap();
        if (alive && cached.length > 0) setCachedPhases(cached);
      } catch {
        // 读缓存失败：回落到内置阶段
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const phases = useMemo<Phase[]>(() => {
    if (!cachedPhases || cachedPhases.length === 0) return mainPhases;
    const seen = new Set(cachedPhases.map((p) => p.id));
    return [...cachedPhases, ...mainPhases.filter((p) => !seen.has(p.id))];
  }, [cachedPhases]);

  /**
   * 阶段→主题模式下当前展开的阶段：**由受控值驱动**（不再用内部 state），
   * 这样父级把选择重置成 EMPTY_CONTENT 时它也会跟着清空（审查发现：内部 state 会残留上次阶段）。
   */
  const phaseId = value.phaseId ?? null;

  const phase = useMemo(() => phases.find((p) => p.id === phaseId) ?? null, [phases, phaseId]);

  /**
   * 主题列表 = 内置主题 + 本机自建主题（`customTopics` 里 phaseId 匹配的）。
   * 自建主题可能与服务端下发的内容重名（本地 id 与服务端 id 语义不同），
   * 因此按标题去重，避免选择器里出现两个一模一样的条目。
   */
  const topics = useMemo(() => {
    if (!phase) return [];
    const seen = new Set<string>();
    const out: { id: number; title: string; custom: boolean }[] = [];
    for (const t of phase.topics) {
      const title = t.title.trim();
      if (!title || seen.has(title)) continue;
      seen.add(title);
      out.push({ id: t.id, title, custom: false });
    }
    for (const t of customTopics) {
      if (t.phaseId !== phase.id) continue;
      const title = t.title.trim();
      if (!title || seen.has(title)) continue;
      seen.add(title);
      out.push({ id: t.id, title, custom: true });
    }
    return out;
  }, [phase, customTopics]);

  const setSource = (source: ContentSource) => {
    // 点当前已选中的入口 = 无操作（否则会把手滑误触变成"清空已选内容"）
    if (source === value.source) return;
    if (source === "none") {
      onChange(EMPTY_CONTENT);
      return;
    }
    if (source === "free") {
      // 从"阶段→主题"切过来时保留已输入的文本（它就在 label 里），否则清空
      const keep = value.source === "free" ? value.label : "";
      onChange({ source: "free", label: keep });
      return;
    }
    // 阶段→主题：先进入选择态，label 留待选中主题后再拼（未选 = 不指定）
    onChange({ source: "phase", label: "", phaseId: phaseId ?? undefined });
  };

  const pickTopic = (topicId: number, title: string) => {
    if (!phase) return;
    onChange({
      source: "phase",
      label: `${phase.title} · ${title}`.slice(0, CONTENT_LABEL_MAX),
      phaseId: phase.id,
      topicId,
    });
  };

  const selectedLabel = contentLabelOf(value);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <ThemedIcon name="bookmark-outline" size={15} color={colors.accentStrong} />
        <Text style={styles.headTitle}>这次学什么</Text>
        <Text style={styles.headHint} numberOfLines={1}>
          {selectedLabel ?? "不指定"}
        </Text>
      </View>

      <View style={styles.segRow}>
        {(
          [
            { key: "none", label: "不指定" },
            { key: "free", label: "自由输入" },
            { key: "phase", label: "阶段→主题" },
          ] as const
        ).map((o) => {
          const active = value.source === o.key;
          return (
            <Pressable
              key={o.key}
              style={[styles.seg, active && styles.segActive]}
              onPress={() => setSource(o.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {value.source === "free" ? (
        <View style={styles.freeBox}>
          <TextInput
            style={styles.input}
            value={value.label}
            onChangeText={(t) => onChange({ source: "free", label: t.slice(0, CONTENT_LABEL_MAX) })}
            placeholder="如：英语读写 / 力扣刷题"
            placeholderTextColor={colors.textFaint}
            maxLength={CONTENT_LABEL_MAX}
            returnKeyType="done"
          />
          <Text style={styles.freeHint}>留空 = 不指定（不绑定任何学习内容）</Text>
        </View>
      ) : null}

      {value.source === "phase" ? (
        <View style={styles.phaseBox}>
          <View style={styles.chipWrap}>
            {phases.map((p) => {
              const active = phase?.id === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => {
                    // 换阶段后原来的主题不再适用 → 回到"未选"，label 清空（= 不指定）；
                    // 阶段本身由受控值 value.phaseId 驱动，不再用内部 state（避免残留上次阶段）
                    onChange({ source: "phase", label: "", phaseId: p.id });
                  }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                    {p.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {phase ? (
            topics.length > 0 ? (
              <View style={styles.chipWrap}>
                {topics.map((t) => {
                  const active = value.topicId === t.id;
                  return (
                    <Pressable
                      key={`${t.custom ? "c" : "b"}-${t.id}`}
                      style={[styles.chip, styles.topicChip, active && styles.chipActive]}
                      onPress={() => pickTopic(t.id, t.title)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                        {t.title}
                        {t.custom ? " · 自建" : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.empty}>该阶段还没有主题，可用「自由输入」写一个</Text>
            )
          ) : (
            <Text style={styles.empty}>先选一个阶段，再选具体主题</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
    },
    head: { flexDirection: "row", alignItems: "center", gap: 6 },
    headTitle: { ...typography.body, fontWeight: "700", color: colors.text },
    headHint: { flex: 1, textAlign: "right", ...typography.caption, color: colors.textMuted },
    segRow: { flexDirection: "row", gap: 8 },
    seg: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceStrong,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    segActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    segText: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted },
    segTextActive: { color: "#fff" },
    freeBox: { gap: 6 },
    input: {
      backgroundColor: colors.surfaceStrong,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    freeHint: { ...typography.caption, color: colors.textMuted },
    phaseBox: { gap: 8 },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      maxWidth: "100%",
    },
    topicChip: { maxWidth: "48%" },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 12.5, color: colors.textMuted, fontWeight: "600" },
    chipTextActive: { color: "#fff" },
    empty: { ...typography.caption, color: colors.textMuted },
  });
