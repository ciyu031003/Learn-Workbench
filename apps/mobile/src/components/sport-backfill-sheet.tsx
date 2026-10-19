import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ExerciseType } from "@learn-workbench/shared/schemas";
import type { SportItem } from "@learn-workbench/shared/types";
import { SPORT_CATALOG, exerciseTypeOptions } from "@learn-workbench/shared/labels";
import { formatDateCN, fromDateKey, toDateKey, todayISO } from "@learn-workbench/shared/dates";
import { BottomSheet } from "@/components/bottom-sheet";
import { MonthCalendar } from "@/components/month-calendar";
import { ChipGroup, SheetSection, SheetStickyCta, StepperRow } from "@/components/sheet";
import { SportThemedIcon, ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { typography, type ThemeColors } from "@/theme/tokens";
import { sportColorsOf, sportIconOf, sportSfOf } from "@/lib/sport-view";
import { useAppStore } from "@/store/app-store";

/**
 * 手动补录运动（v1.45 全屏趋势页的「补录」入口）。
 *
 * 为什么需要：既有入口（今日页 SportSheet）只能记**今天**、**按分钟**，
 * 用户从别处（手表/回忆）补记前几天的运动无处可去。
 *
 * 写入走 store 新增的 `addSportAt(sportKey, minutes, dateISO)`：
 * 与 `addSport` 同一套 exerciseLogs 同步 payload，只是把 `startedAt` 换成所选日期，
 * 因此不动今天页、也不加后端接口。
 */
export function SportBackfillSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const addSportAt = useAppStore((s) => s.addSportAt);
  const sports = useAppStore((s) => s.sports);

  /** "最近"页：与今日页同一套"最近用过的项目"逻辑 */
  const [tab, setTab] = useState<"recent" | ExerciseType>("recent");
  const [sportKey, setSportKey] = useState("run");
  const [minutes, setMinutes] = useState(30);
  const [dateKey, setDateKey] = useState(() => todayISO());
  const [calOpen, setCalOpen] = useState(false);

  const items = useMemo(() => {
    if (tab === "recent") {
      const seen: string[] = [];
      for (const r of [...sports].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
        if (!seen.includes(r.sportKey)) seen.push(r.sportKey);
        if (seen.length >= 6) break;
      }
      const recent = seen.map((k) => SPORT_CATALOG.find((i) => i.key === k)).filter((i): i is SportItem => !!i);
      return recent.length > 0 ? recent : SPORT_CATALOG.filter((i) => i.featured);
    }
    return SPORT_CATALOG.filter((i) => i.type === tab);
  }, [tab, sports]);

  const current = SPORT_CATALOG.find((i) => i.key === sportKey) ?? items[0] ?? SPORT_CATALOG[0];

  const pickSport = (item: SportItem) => {
    setSportKey(item.key);
    setMinutes(item.defaultMinutes);
  };

  const quickDates: { key: string; label: string }[] = [
    { key: todayISO(), label: "今天" },
    { key: todayISO(-1), label: "昨天" },
    { key: todayISO(-2), label: "前天" },
  ];
  /** CTA 上的短日期（M/D），长文案在窄屏会被截断 */
  const shortDate = `${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8, 10))}`;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="补录运动"
      subtitle="选项目 → 调时长 → 选日期；可以补记任意过去的一天"
      icon="barbell-outline"
      height="88%"
      expandable
      footer={
        <SheetStickyCta
          label={`记录 ${current.name} ${minutes} 分钟 · ${shortDate}`}
          icon="checkmark"
          onPress={() => {
            addSportAt(current.key, minutes, dateKey);
            onClose();
          }}
        />
      }
      footerHint="补录的记录和计时记录一样，会进入运动趋势并同步到云端"
    >
      <SheetSection title="运动项目" hint="先去「最近」里找，找不到再按大类浏览">
        <ChipGroup
          options={[
            { key: "recent", label: "最近" },
            ...exerciseTypeOptions.map((o) => ({
              key: o.type,
              label: o.label.replace("运动", "").replace("训练", "").replace("放松", "").replace("活动", ""),
            })),
          ]}
          selected={[tab]}
          onToggle={(key) => setTab(key as "recent" | ExerciseType)}
          multiple={false}
          wrap
        />
        <View style={styles.grid}>
          {items.map((t) => {
            const active = t.key === current.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => pickSport(t)}
                style={[styles.gridItem, active && styles.gridItemActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t.name}
              >
                <View style={[styles.gridIcon, { backgroundColor: `${sportColorsOf(t.type).c1}22` }]}>
                  <SportThemedIcon
                    name={sportIconOf(t.key)}
                    sf={sportSfOf(t.key)}
                    size={20}
                    color={sportColorsOf(t.type).c1}
                  />
                </View>
                <Text style={[styles.gridName, active && styles.gridNameActive]} numberOfLines={1}>
                  {t.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SheetSection>

      <SheetSection title="时长" hint="以分钟为单位，按实际运动时间填">
        <StepperRow label="运动时长" unit="分钟" value={minutes} onChange={setMinutes} step={5} min={5} max={600} />
      </SheetSection>

      <SheetSection title="日期" hint="补录只能选今天或更早（未来日期不可选）" last>
        <View style={styles.dateChips}>
          {quickDates.map((d) => {
            const active = d.key === dateKey;
            return (
              <Pressable
                key={d.key}
                onPress={() => setDateKey(d.key)}
                style={[styles.dateChip, active && styles.dateChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{d.label}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setCalOpen((v) => !v)}
            style={[styles.dateChip, styles.dateChipCal]}
            accessibilityRole="button"
          >
            <ThemedIcon name="calendar-outline" size={13} color={colors.primary} />
            <Text style={[styles.dateChipText, { color: colors.primary }]}>
              {calOpen ? "收起日历" : "选择日期"}
            </Text>
          </Pressable>
        </View>
        <View style={styles.dateFoot}>
          <Text style={styles.dateFootText}>已选：{formatDateCN(dateKey)}</Text>
        </View>
        {calOpen ? (
          <View style={styles.calWrap}>
            <MonthCalendar
              selected={fromDateKey(dateKey)}
              onSelect={(d) => setDateKey(toDateKey(d))}
              onClose={() => setCalOpen(false)}
            />
          </View>
        ) : null}
      </SheetSection>
    </BottomSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    gridItem: {
      width: "23%",
      minWidth: 70,
      flexGrow: 1,
      alignItems: "center",
      gap: 5,
      paddingVertical: 9,
      borderRadius: 15,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    gridItemActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    gridIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    gridName: { ...typography.micro, color: colors.textMuted, fontWeight: "700" },
    gridNameActive: { color: colors.primary, fontWeight: "800" },
    dateChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    dateChip: {
      minHeight: 34,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 13,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    dateChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    dateChipCal: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    dateChipText: { ...typography.caption, color: colors.textMuted, fontWeight: "700" },
    dateChipTextActive: { color: colors.canvas },
    dateFoot: { paddingTop: 2 },
    dateFootText: { ...typography.caption, color: colors.text, fontWeight: "700" },
    calWrap: {
      marginTop: 4,
      padding: 10,
      borderRadius: 18,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
  });
