import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/ui/icon";
import { typography } from "@/theme/tokens";
import { useV15 } from "@/components/v15/v15-theme";
import { V15Button, V15Card, V15Header, V15IconButton, V15Note, V15Pill, V15ProgressBar, V15Scroll, V15Section, useV15Layout } from "@/components/v15/v15-ui";
import { bedtimeWindow } from "@/lib/v15/sleep-model";
import { normalizeSleepNights, sleepApi, type SleepNight } from "@/lib/sleep-api";
import { isSleepDateKey, parseSleepDurationInput, shiftSleepDate, sleepClockToIso } from "@/lib/sleep-view";
import { haptics } from "@/lib/haptics";
import { takeNavPendingParams } from "@/lib/nav-pending";
import { todayISO } from "@learn-workbench/shared/dates";

/**
 * 记录睡眠（全屏，V15）。
 *
 * demo 的输入结构（入睡/起床 → 自动时长 → 质量 → 保存）保留，
 * 但质量改为「评分派生」，来源固定为本机手动记录；仍复用 sleepApi 的手动订正优先逻辑。
 */
export default function SleepAddScreen() {
  const p = useV15();
  const layout = useV15Layout();
  const styles = useMemo(() => makeStyles(p), [p]);
  const params = useLocalSearchParams<{ date?: string }>();
  const todayKey = useMemo(() => todayISO(), []);
  const initialDate = isSleepDateKey(params.date) ? params.date : todayKey;

  const [date, setDate] = useState(initialDate);
  const [duration, setDuration] = useState("");
  const [bedtime, setBedtime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [deep, setDeep] = useState("");
  const [rem, setRem] = useState("");
  const [awakeCount, setAwakeCount] = useState("");
  const [efficiency, setEfficiency] = useState("");
  const [saving, setSaving] = useState(false);
  const [weekNights, setWeekNights] = useState<SleepNight[]>([]);
  const [error, setError] = useState<string | null>(null);

  const dateChoices = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, index) => shiftSleepDate(todayKey, -index));
    return days.includes(initialDate) ? days : [initialDate, ...days];
  }, [initialDate, todayKey]);

  const prefillRef = useRef<string | null>(null);

  // 从睡眠页点「编辑」时通过 nav-pending 传入完整字段（Health Connect 记录也可能不在本机列表里）
  useFocusEffect(
    useCallback(() => {
      const pending = takeNavPendingParams("sleep-add");
      if (!pending || !isSleepDateKey(pending.date)) return;
      prefillRef.current = pending.date;
      setDate(pending.date);
      setDuration(pending.durationMin ?? "");
      // nav-pending 里的入睡/起床是 ISO 时间戳；输入框只接受 23:00 这种时钟文本，
      // 原样回填会显示 "2026-11-19T15:00:00.000Z"（v2.8.6 真机测试发现）。
      const clock = (value?: string) => {
        if (!value) return "";
        // 已经是 23:00 就直接用；ISO 时间戳再格式化，避免二次解析变成 "—"
        return /^\d{1,2}:\d{2}$/.test(value.trim()) ? value.trim() : sleepApi.formatClockTime(value);
      };
      setBedtime(clock(pending.bedtime));
      setWakeTime(clock(pending.wakeTime));
      setDeep(pending.deep ?? "");
      setRem(pending.rem ?? "");
      setAwakeCount(pending.awakeCount ?? "");
      setEfficiency(pending.efficiency ?? "");
    }, [])
  );

  const editingNight = useMemo(
    () => weekNights.find((night) => night.date === initialDate) ?? null,
    [initialDate, weekNights]
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      const local = normalizeSleepNights(await sleepApi.loadSleepNights());
      if (!active) return;
      setWeekNights(local);
      const current = prefillRef.current === initialDate ? null : local.find((night) => night.date === initialDate);
      if (current) {
        setDuration(sleepApi.formatSleepMinutes(current.durationMin));
        setBedtime(current.bedtime ? sleepApi.formatClockTime(current.bedtime) : "");
        setWakeTime(current.wakeTime ? sleepApi.formatClockTime(current.wakeTime) : "");
        setDeep(current.stages ? String(Math.round(current.stages.deep)) : "");
        setRem(current.stages ? String(Math.round(current.stages.rem)) : "");
        setAwakeCount(current.awakeCount === null ? "" : String(Math.round(current.awakeCount)));
        setEfficiency(current.efficiencyPct === null ? "" : String(Math.round(current.efficiencyPct)));
      }
    })();
    return () => {
      active = false;
    };
  }, [initialDate]);

  const bedtimeIso = useMemo(
    () => (bedtime.trim() ? sleepClockToIso(date, bedtime, "bedtime") : null),
    [bedtime, date]
  );
  const wakeIso = useMemo(
    () => (wakeTime.trim() ? sleepClockToIso(date, wakeTime, "wakeTime") : null),
    [date, wakeTime]
  );

  const autoDurationMin = useMemo(() => {
    if (!bedtimeIso || !wakeIso) return null;
    const start = Date.parse(bedtimeIso);
    const end = Date.parse(wakeIso);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    const minutes = Math.round((end - start) / 60000);
    return minutes > 0 && minutes <= 1440 ? minutes : null;
  }, [bedtimeIso, wakeIso]);

  const parsedDuration = parseSleepDurationInput(duration);
  const durationMin = autoDurationMin ?? parsedDuration;

  const deepMin = deep.trim() ? Number(deep) : null;
  const remMin = rem.trim() ? Number(rem) : null;
  const awakeNum = awakeCount.trim() ? Number(awakeCount) : null;
  const efficiencyNum = efficiency.trim() ? Number(efficiency) : null;

  const previewNight = useMemo<SleepNight | null>(() => {
    if (!durationMin || durationMin <= 0) return null;
    const hasStages = deepMin !== null && remMin !== null && Number.isFinite(deepMin) && Number.isFinite(remMin) && deepMin >= 0 && remMin >= 0 && deepMin + remMin <= durationMin;
    const stages = hasStages
      ? { deep: deepMin, light: Math.max(0, durationMin - deepMin - remMin), rem: remMin, awake: 0 }
      : null;
    return {
      date,
      bedtime: bedtimeIso ?? "",
      wakeTime: wakeIso ?? "",
      durationMin,
      timeInBedMin: durationMin,
      stages,
      awakeCount: awakeNum !== null && Number.isFinite(awakeNum) ? awakeNum : null,
      efficiencyPct: efficiencyNum !== null && Number.isFinite(efficiencyNum) ? efficiencyNum : null,
      source: "manual",
      updatedAt: new Date().toISOString(),
    };
  }, [awakeNum, bedtimeIso, date, deepMin, durationMin, efficiencyNum, remMin, wakeIso]);

  const previewScore = previewNight ? sleepApi.sleepScore(previewNight) : null;
  const previewRating = previewScore !== null ? sleepApi.qualityLabel(previewScore) : "—";
  const previewHours = durationMin ? Math.floor(durationMin / 60) : 0;
  const previewMinutes = durationMin ? durationMin % 60 : 0;

  const window = useMemo(
    () =>
      bedtimeWindow(
        weekNights
          .slice(0, 7)
          .map((night) => (night.bedtime ? new Date(night.bedtime) : null))
          .filter((value): value is Date => value !== null && Number.isFinite(value.getTime()))
          .map((value) => {
            const minutes = value.getHours() * 60 + value.getMinutes();
            return minutes >= 12 * 60 ? minutes - 24 * 60 : minutes;
          })
      ),
    [weekNights]
  );

  const save = useCallback(async () => {
    if (!durationMin || durationMin <= 0) {
      haptics.soft();
      setError("填 7.5 / 7h30m / 450 分钟这样的时长（0–24 小时）");
      return;
    }
    if (bedtime.trim() && !bedtimeIso) {
      haptics.soft();
      setError("入睡时间写成 23:30 这样");
      return;
    }
    if (wakeTime.trim() && !wakeIso) {
      haptics.soft();
      setError("起床时间写成 07:10 这样");
      return;
    }
    if (Boolean(deep.trim()) !== Boolean(rem.trim())) {
      haptics.soft();
      setError("深睡和 REM 要一起填，才能生成完整分期");
      return;
    }
    if (deepMin !== null && remMin !== null && (!Number.isFinite(deepMin) || !Number.isFinite(remMin) || deepMin < 0 || remMin < 0 || deepMin + remMin > durationMin)) {
      haptics.soft();
      setError("深睡 + REM 分钟数要有效，且不能超过总睡眠时长");
      return;
    }
    if (awakeNum !== null && (!Number.isFinite(awakeNum) || awakeNum < 0 || awakeNum > 30)) {
      haptics.soft();
      setError("清醒次数填 0–30 的整数");
      return;
    }
    if (efficiencyNum !== null && (!Number.isFinite(efficiencyNum) || efficiencyNum < 0 || efficiencyNum > 100)) {
      haptics.soft();
      setError("睡眠效率填 0–100 的百分比");
      return;
    }
    setSaving(true);
    setError(null);
    const saved = await sleepApi.upsertManualSleepNight({
      date,
      durationMin,
      bedtime: bedtimeIso ?? undefined,
      wakeTime: wakeIso ?? undefined,
      deepMin: deepMin ?? undefined,
      remMin: remMin ?? undefined,
      awakeCount: awakeNum === null ? undefined : Math.round(awakeNum),
      efficiencyPct: efficiencyNum ?? undefined,
    });
    setSaving(false);
    if (!saved) {
      haptics.soft();
      setError("保存到本机失败，再试一次");
      return;
    }
    if (editingNight && editingNight.date !== date) {
      await sleepApi.deleteSleepNight(editingNight.date);
    }
    haptics.success();
    router.back();
  }, [awakeNum, bedtime, bedtimeIso, date, deep, deepMin, durationMin, editingNight, efficiencyNum, rem, remMin, wakeIso, wakeTime]);

  const remove = useCallback(() => {
    Alert.alert("删除这一晚？", "本机记录会被删除；若系统健康数据里仍有这一晚，重新读取会再次出现。", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await sleepApi.deleteSleepNight(date);
            haptics.warning();
            router.back();
          })();
        },
      },
    ]);
  }, [date]);

  return (
    <View style={{ flex: 1, backgroundColor: p.canvas }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <V15Scroll p={p}>
          <V15Header
            p={p}
            kicker="LOG SLEEP"
            title={editingNight ? "编辑睡眠" : "记录睡眠"}
            subtitle={editingNight ? "修改这一晚 · 同一天保存会覆盖原记录" : "补录一晚 · 自动计算时长与评分"}
            onBack={() => router.back()}
            actions={<V15IconButton p={p} icon="close" label="关闭" onPress={() => router.back()} size={16} weight="bold" />}
          />

          <V15Card p={p} style={{ marginTop: 16 }}>
            <Text style={[styles.label, { color: p.sub }]}>日期</Text>
            <View style={styles.dateRow}>
              {dateChoices.map((key) => {
                const active = key === date;
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setDate(key);
                      setError(null);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={"选择 " + key}
                    hitSlop={{ top: 4, bottom: 4 }}
                    style={[styles.dateChip, { backgroundColor: active ? p.ink : p.card2, borderColor: active ? p.ink : p.line }]}
                  >
                    <Text style={[styles.dateChipText, { color: active ? p.canvasTop : p.sub }]} numberOfLines={1}>
                      {key === todayKey ? "今天" : key.slice(5).replace("-", "/")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.timeRow}>
              <View style={styles.timeCell}>
                <Text style={[styles.label, { color: p.sub }]}>入睡</Text>
                <View style={[styles.timeInput, { backgroundColor: p.card2, borderColor: p.line }]}>
                  <TextInput
                    value={bedtime}
                    onChangeText={(value) => {
                      setBedtime(value);
                      setError(null);
                    }}
                    placeholder="23:12"
                    placeholderTextColor={p.faint}
                    style={[styles.timeText, { color: p.ink }]}
                    keyboardType="numbers-and-punctuation"
                    accessibilityLabel="入睡时间"
                  />
                  <Icon name="clock" size={15} weight="regular" color={p.sub} />
                </View>
              </View>
              <Icon name="chevron" size={16} weight="bold" color={p.faint} />
              <View style={styles.timeCell}>
                <Text style={[styles.label, { color: p.sub }]}>起床</Text>
                <View style={[styles.timeInput, { backgroundColor: p.card2, borderColor: p.line }]}>
                  <TextInput
                    value={wakeTime}
                    onChangeText={(value) => {
                      setWakeTime(value);
                      setError(null);
                    }}
                    placeholder="07:10"
                    placeholderTextColor={p.faint}
                    style={[styles.timeText, { color: p.ink }]}
                    keyboardType="numbers-and-punctuation"
                    accessibilityLabel="起床时间"
                  />
                  <Icon name="clock" size={15} weight="regular" color={p.sub} />
                </View>
              </View>
            </View>

            {autoDurationMin === null ? (
              <>
                <Text style={[styles.label, { color: p.sub, marginTop: 14 }]}>总时长</Text>
                <TextInput
                  value={duration}
                  onChangeText={(value) => {
                    setDuration(value);
                    setError(null);
                  }}
                  placeholder="7.5 或 7h30m"
                  placeholderTextColor={p.faint}
                  style={[styles.input, { backgroundColor: p.card2, borderColor: p.line, color: p.ink }]}
                  accessibilityLabel="总睡眠时长"
                />
              </>
            ) : null}

            <View style={[styles.preview, { backgroundColor: p.lilacSoft, borderColor: p.dark ? "transparent" : "rgba(109,116,232,0.18)" }]}>
              <View style={styles.previewTop}>
                <Text style={[styles.previewLabel, { color: p.lilac }]}>预计睡眠</Text>
                <V15Pill p={p} tone="lilac" label={autoDurationMin !== null ? "自动计算" : "手动时长"} />
              </View>
              <View style={styles.previewBody}>
                <View style={styles.previewDuration}>
                  <Text style={[styles.previewBig, { color: p.ink }]} numberOfLines={1} adjustsFontSizeToFit>
                    {durationMin ? previewHours : "—"}
                    <Text style={[styles.previewUnit, { color: p.sub }]}>h</Text>
                    {durationMin ? String(previewMinutes).padStart(2, "0") : ""}
                    <Text style={[styles.previewUnit, { color: p.sub }]}>m</Text>
                  </Text>
                </View>
                <View style={styles.previewScore}>
                  <Text style={[styles.previewScoreLabel, { color: p.sub }]}>睡眠分约</Text>
                  <Text style={[styles.previewScoreValue, { color: p.lilac }]} numberOfLines={1}>
                    {previewScore ?? "—"}
                    <Text style={[styles.previewScoreUnit, { color: p.sub }]}> 分</Text>
                  </Text>
                  <Text style={[styles.previewRating, { color: p.sub }]}>{previewRating}</Text>
                </View>
              </View>
              <View style={styles.previewBar}>
                <V15ProgressBar p={p} pct={previewScore ?? 0} color={p.lilac} height={6} />
              </View>
            </View>

            <Pressable
              onPress={() => setError(null)}
              style={styles.autoHint}
              accessibilityRole="none"
              accessibilityLabel="入睡和起床时间都填写后会自动计算时长"
            >
              <Icon name="info" size={12} weight="regular" color={p.faint} />
              <Text style={[styles.autoHintText, { color: p.sub }]}>入睡与起床都填写时，时长自动计算；留空一段则用下方总时长。</Text>
            </Pressable>

            {error ? <Text style={[styles.error, { color: p.red }]}>{error}</Text> : null}

            <V15Button p={p} label={editingNight ? "保存修改" : "保存睡眠记录"} icon="check" loading={saving} onPress={() => void save()} style={{ marginTop: 12 }} />
            {editingNight ? (
              <Pressable onPress={remove} hitSlop={8} accessibilityRole="button" accessibilityLabel="删除这一晚" style={styles.deleteRow}>
                <Text style={[styles.deleteText, { color: p.red }]}>删除这一晚</Text>
              </Pressable>
            ) : null}
          </V15Card>

          <V15Section p={p} title="睡眠分期（可选）" right="设备没同步时手填" />
          <V15Card p={p}>
            <View style={styles.fieldRow}>
              <View style={styles.fieldCell}>
                <Text style={[styles.label, { color: p.sub }]}>深睡分钟</Text>
                <TextInput
                  value={deep}
                  onChangeText={(value) => {
                    setDeep(value);
                    setError(null);
                  }}
                  placeholder="90"
                  placeholderTextColor={p.faint}
                  keyboardType="numeric"
                  style={[styles.input, { backgroundColor: p.card2, borderColor: p.line, color: p.ink }]}
                />
              </View>
              <View style={styles.fieldCell}>
                <Text style={[styles.label, { color: p.sub }]}>REM 分钟</Text>
                <TextInput
                  value={rem}
                  onChangeText={(value) => {
                    setRem(value);
                    setError(null);
                  }}
                  placeholder="100"
                  placeholderTextColor={p.faint}
                  keyboardType="numeric"
                  style={[styles.input, { backgroundColor: p.card2, borderColor: p.line, color: p.ink }]}
                />
              </View>
            </View>
            <View style={styles.fieldRow}>
              <View style={styles.fieldCell}>
                <Text style={[styles.label, { color: p.sub }]}>清醒次数</Text>
                <TextInput
                  value={awakeCount}
                  onChangeText={(value) => {
                    setAwakeCount(value);
                    setError(null);
                  }}
                  placeholder="2"
                  placeholderTextColor={p.faint}
                  keyboardType="numeric"
                  style={[styles.input, { backgroundColor: p.card2, borderColor: p.line, color: p.ink }]}
                />
              </View>
              <View style={styles.fieldCell}>
                <Text style={[styles.label, { color: p.sub }]}>睡眠效率 %</Text>
                <TextInput
                  value={efficiency}
                  onChangeText={(value) => {
                    setEfficiency(value);
                    setError(null);
                  }}
                  placeholder="92"
                  placeholderTextColor={p.faint}
                  keyboardType="numeric"
                  style={[styles.input, { backgroundColor: p.card2, borderColor: p.line, color: p.ink }]}
                />
              </View>
            </View>
            <Text style={[styles.hint, { color: p.sub }]}>深睡 + REM 要一起填，且不能超过总时长；全部留空则按时长估算。</Text>
          </V15Card>

          <V15Section p={p} title="睡前准备" right={window ? "今晚 " + window.label.split(" – ")[0] + " 前" : "记录 2 晚后给建议"} />
          <V15Card p={p} padded={false}>
            <AdviceRow
              p={p}
              styles={styles}
              icon="moon"
              tone={p.lilac}
              soft={p.lilacSoft}
              title={window ? "入睡窗口 " + window.label : "固定起床时间"}
              body={window ? "与过去 7 晚平均入睡时间一致，生物钟更稳定。" : "有 2 晚入睡时刻后，这里会给出个人化的入睡窗口。"}
              badge="推荐"
            />
            <View style={[styles.adviceDivider, { backgroundColor: p.line }]} />
            <AdviceRow
              p={p}
              styles={styles}
              icon="clock"
              tone={p.orange}
              soft={p.orangeSoft}
              title="睡前 1 小时调暗屏幕"
              body="减少蓝光暴露，让褪黑素按时分泌。"
              badge="提醒"
            />
          </V15Card>

          <V15Note p={p}>记录存本机；同一天有系统数据时，重新读取会以系统数据为准。手动订正会优先保留你的版本。</V15Note>
          <View style={{ height: layout.wide ? 18 : 10 }} />
        </V15Scroll>
      </KeyboardAvoidingView>
    </View>
  );
}

function AdviceRow({
  p,
  styles,
  icon,
  tone,
  soft,
  title,
  body,
  badge,
}: {
  p: ReturnType<typeof useV15>;
  styles: ReturnType<typeof makeStyles>;
  icon: "moon" | "clock";
  tone: string;
  soft: string;
  title: string;
  body: string;
  badge: string;
}) {
  return (
    <View style={styles.advice}>
      <View style={[styles.adviceIcon, { backgroundColor: soft }]}>
        <Icon name={icon} size={16} weight="duotone" color={tone} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.adviceTitle, { color: p.ink }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.adviceBody, { color: p.sub }]}>{body}</Text>
      </View>
      <Text style={[styles.adviceBadge, { color: p.orange }]}>{badge}</Text>
    </View>
  );
}

const makeStyles = (p: ReturnType<typeof useV15>) =>
  StyleSheet.create({
    label: { ...typography.micro, fontWeight: "700", marginBottom: 6 },
    dateRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    dateChip: { minWidth: 48, minHeight: 36, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
    dateChipText: { ...typography.micro, fontWeight: "700" },
    timeRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 14 },
    timeCell: { flex: 1, minWidth: 0 },
    timeInput: { height: 52, borderRadius: 15, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12 },
    timeText: { flex: 1, ...typography.hero, paddingVertical: 0 },
    input: { height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, ...typography.callout },
    preview: { marginTop: 14, borderRadius: 18, borderWidth: 1, padding: 13 },
    previewTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    previewLabel: { ...typography.caption, fontWeight: "700" },
    previewBody: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 5 },
    previewDuration: { flex: 1, minWidth: 0 },
    previewBig: { ...typography.numLg, fontWeight: "900", fontVariant: ["tabular-nums"] },
    previewUnit: { ...typography.callout, fontWeight: "600" },
    previewScore: { alignItems: "flex-end" },
    previewScoreLabel: { ...typography.micro, fontWeight: "500" },
    previewScoreValue: { ...typography.headline, fontWeight: "900", fontVariant: ["tabular-nums"] },
    previewScoreUnit: { ...typography.micro, fontWeight: "500" },
    previewRating: { ...typography.micro, fontWeight: "500" },
    previewBar: { marginTop: 8 },
    autoHint: { flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: 10 },
    autoHintText: { ...typography.micro, fontWeight: "500", flex: 1, lineHeight: 15 },
    error: { ...typography.caption, fontWeight: "600", marginTop: 8 },
    deleteRow: { alignItems: "center", paddingVertical: 10, marginTop: 2 },
    deleteText: { ...typography.caption, fontWeight: "700" },
    fieldRow: { flexDirection: "row", gap: 8, marginTop: 8 },
    fieldCell: { flex: 1, minWidth: 0 },
    hint: { ...typography.meta, marginTop: 8, lineHeight: 18 },
    advice: { flexDirection: "row", alignItems: "flex-start", gap: 9, paddingHorizontal: 12, paddingVertical: 10 },
    adviceIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    adviceTitle: { ...typography.callout, fontWeight: "700" },
    adviceBody: { ...typography.meta, marginTop: 2, lineHeight: 18 },
    adviceBadge: { ...typography.micro, fontWeight: "700" },
    adviceDivider: { height: 1, marginHorizontal: 12 },
  });
