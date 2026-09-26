/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { FoodSticker } from "@/components/food-sticker";
import { SkeletonList } from "@/components/skeleton";
import { EmptyState } from "@/components/empty-state";
import { haptics } from "@/lib/haptics";
import { fetchStickerBook, type StickerBookDto } from "@/lib/wellbeing-client";
import { useAppStore } from "@/store/app-store";
import { tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/** 收集册时间范围（借「收集」动机：本周 / 本月 / 近 90 天） */
const RANGES = [
  { key: 7, label: "本周" },
  { key: 30, label: "本月" },
  { key: 90, label: "近 90 天" },
] as const;

/**
 * 我的饮食日记 · 收集册（v3 M9 深化）
 *
 * 从「今天的贴纸」升级为「一段时间的收集」：按食物名聚合次数、平均热量与首末日期，
 * 点一下就把该食物再记一份（复用调用方的 quickAdd）。
 */
export function StickerBookSheet({
  visible,
  onClose,
  onPick,
  reloadKey,
}: {
  visible: boolean;
  onClose: () => void;
  /** 点某个贴纸 = 再记一份（由调用方写入当天记录） */
  onPick: (name: string, avgKcal: number) => void;
  /** 外部数据变化时刷新（如新增了一条记录） */
  reloadKey?: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const token = useAppStore((s) => s.token);

  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<StickerBookDto | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const d = await fetchStickerBook(token, days);
        if (alive) setData(d);
      } catch {
        if (alive) setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [days, reloadKey, token, visible]);

  const stickers = data?.stickers ?? [];

  return (
    <BottomSheet visible={visible} onClose={onClose} title="我的饮食日记" height="86%">
      {/* 范围切换 */}
      <View style={styles.rangeRow}>
        {RANGES.map((r) => {
          const active = days === r.key;
          return (
            <Pressable
              key={r.key}
              onPress={() => {
                haptics.soft();
                setDays(r.key);
              }}
              style={[styles.rangeChip, active && styles.rangeChipActive]}
            >
              <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* 汇总 */}
      {data ? (
        <Text style={styles.summary}>
          已收集 <Text style={styles.summaryNum}>{data.totalKinds}</Text> 种食物 · 记录{" "}
          <Text style={styles.summaryNum}>{data.totalTimes}</Text> 次
          {data.totalTimes > 0 ? ` · 平均 ${Math.round((data.stickers.reduce((a, s) => a + s.totalKcal, 0) / Math.max(1, data.totalTimes)))} kcal/份` : ""}
        </Text>
      ) : null}

      {loading && stickers.length === 0 ? (
        <SkeletonList count={4} />
      ) : stickers.length === 0 ? (
        <EmptyState
          icon="albums-outline"
          title="还没有可收集的贴纸"
          hint="记录几次饮食后，这里会把吃过的食物做成贴纸"
        />
      ) : (
        <View style={styles.grid}>
          {stickers.map((s) => (
            <Pressable
              key={s.name}
              onPress={() => {
                haptics.light();
                onPick(s.name, s.avgKcal);
              }}
              style={styles.cell}
              accessibilityLabel={`再记一份 ${s.name}，平均 ${s.avgKcal} 千卡`}
            >
              <View>
                <FoodSticker name={s.name} size={52} />
                {s.times > 1 ? (
                  <View style={styles.timesBadge}>
                    <Text style={styles.timesText}>×{s.times}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.meta}>{s.avgKcal} kcal</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.hint}>点贴纸＝按平均份量再记一份；长按列表里的记录可以改份量。</Text>
    </BottomSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    rangeRow: { flexDirection: "row", gap: 8 },
    rangeChip: {
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 7,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    rangeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    rangeText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    rangeTextActive: { color: "#ffffff" },
    summary: { ...typography.caption, fontWeight: "500", color: colors.textMuted, ...tabularNums },
    summaryNum: { fontWeight: "800", color: colors.accentStrong },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 4 },
    cell: { width: 76, alignItems: "center", gap: 2 },
    timesBadge: {
      position: "absolute",
      right: -4,
      bottom: -4,
      minWidth: 22,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentStrong,
    },
    timesText: { ...typography.micro, fontSize: 10, fontWeight: "800", color: "#ffffff" },
    name: { ...typography.micro, fontSize: 10, color: colors.text, textAlign: "center" },
    meta: { ...typography.micro, fontSize: 10, fontWeight: "400", color: colors.textFaint, ...tabularNums },
    hint: { ...typography.micro, fontWeight: "400", color: colors.textFaint, marginTop: 6 },
  });
