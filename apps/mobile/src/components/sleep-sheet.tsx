/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { SheetSection, SheetStickyCta } from "@/components/sheet";
import { Field } from "@/components/field";
import { PressableScale } from "@/components/pressable-scale";
import { ThemedIcon } from "@/components/themed-icon";
import { haptics } from "@/lib/haptics";
import {
  formatSleepHours,
  formatSleepHoursValue,
  openSleepSettings,
  parseSleepHoursInput,
  readSleepFromHealth,
  saveSleepEntry,
  SLEEP_STATUS_HINT,
  type SleepEntry,
  type SleepHealthResult,
  type SleepHealthStatus,
} from "@/lib/sleep";
import { radius, spacing, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 睡眠记录弹层（v2.0.1 真机反馈修复）
 *
 * 反馈：健康页的睡眠卡把用户丢去「领域追踪」，既不是睡眠数据也不符合预期；
 * 睡眠格又恒为「—」。本弹层改成**一条自洽的记录链**：
 * ① 打开即自动读系统健康数据（Android Health Connect / SleepSessionRecord）；
 * ② 成功 → 显示「昨晚 X 小时」，仍可手动修正后保存（Health Connect 的自动识别并不总是准）；
 * ③ 失败/未授权/本机不支持 → 不报错弹窗，直接给手动输入 + 「去授权 / 去系统健康 App」入口；
 * ④ 保存写本机 AsyncStorage（lwb.sleep.v1），健康页指标格立刻显示这个数。
 *
 * 交互约束：不新增动效点（只复用 PressableScale 的按压与 Sheet 自身的滑入），字号全走 token。
 */
export function SleepSheet({
  visible,
  todayKey,
  entry,
  onClose,
  onSaved,
}: {
  visible: boolean;
  /** 起床日（健康页的今日日期键）：保存时写进条目 */
  todayKey: string;
  /** 本机已有的睡眠存档（用于手动输入预填） */
  entry: SleepEntry | null;
  onClose: () => void;
  onSaved: (entry: SleepEntry) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  /** reading：正在读系统数据；detected：读到了；manual：降级手动 */
  const [phase, setPhase] = useState<"reading" | "detected" | "manual">("reading");
  const [status, setStatus] = useState<SleepHealthStatus | null>(null);
  /** 系统读到的昨晚小时数（用于文案与 source 判定） */
  const [detected, setDetected] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 防止关掉再打开后旧请求回写 */
  const requestRef = useRef(0);

  const applyResult = useCallback(
    (result: SleepHealthResult, keepInput: boolean) => {
      setStatus(result.status);
      if (result.ok && result.hours !== null) {
        setDetected(result.hours);
        setInput(formatSleepHoursValue(result.hours));
        setPhase("detected");
        return;
      }
      setDetected(null);
      setPhase("manual");
      if (!keepInput) {
        // 之前手动记过就预填，省得重敲
        setInput(entry ? formatSleepHoursValue(entry.hours) : "");
      }
    },
    [entry]
  );

  /** 打开弹层：先静默读（不弹系统授权框），失败就降级手动 */
  useEffect(() => {
    if (!visible) return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setError(null);
    setSaving(false);
    setGranting(false);
    setPhase("reading");
    setStatus(null);
    setDetected(null);
    setInput(entry ? formatSleepHoursValue(entry.hours) : "");
    void (async () => {
      const result = await readSleepFromHealth({ requestPermission: false });
      if (requestRef.current !== requestId) return;
      applyResult(result, false);
    })();
  }, [applyResult, entry, visible]);

  /** 用户点「去授权」：这次允许弹系统授权框 */
  const authorize = async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    haptics.light();
    setGranting(true);
    setError(null);
    const result = await readSleepFromHealth({ requestPermission: true });
    if (requestRef.current !== requestId) return;
    setGranting(false);
    applyResult(result, true);
  };

  /** 重新读一次（已有权限但当时没数据 / 刚在系统里补了记录） */
  const reRead = async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    haptics.light();
    setPhase("reading");
    setError(null);
    const result = await readSleepFromHealth({ requestPermission: false });
    if (requestRef.current !== requestId) return;
    applyResult(result, true);
  };

  const openSystemHealth = async () => {
    haptics.light();
    const opened = await openSleepSettings();
    if (!opened) {
      // 打不开就说清楚（不弹 Alert）：老系统上健康数据是独立 App
      setError("没找到系统健康数据设置，可在系统里的「健康数据 / Health Connect」授权");
    }
  };

  const save = async () => {
    const hours = parseSleepHoursInput(input);
    if (hours === null) {
      haptics.soft();
      setError("填 0–24 之间的小时数，比如 7.5 或 7:30");
      return;
    }
    setSaving(true);
    setError(null);
    // 与系统读到的一致就当健康数据；改过则是手动订正
    const keepDetected = detected !== null && Math.abs(hours - detected) < 0.05;
    const saved = await saveSleepEntry({
      date: todayKey,
      hours,
      source: keepDetected ? "health" : "manual",
    });
    setSaving(false);
    if (!saved) {
      setError("保存到本机失败，再试一次");
      return;
    }
    haptics.success();
    onSaved(saved);
    onClose();
  };

  const hint = phase === "reading" ? null : status ? SLEEP_STATUS_HINT[status] : null;
  const canAuthorize = status === "denied";
  const canOpenSystem = status === "denied" || status === "no-data" || status === "unavailable";
  /** 读取失败（多为瞬时）与「系统里没记录」都给一次只读重试，不用关掉重开 */
  const canRetry = status === "no-data" || status === "error";
  const showActions = canAuthorize || canOpenSystem || canRetry;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="睡眠记录"
      subtitle="自动读取系统睡眠，读不到就手动记一笔"
      icon="moon-outline"
      height="76%"
      footer={<SheetStickyCta label="保存睡眠" icon="checkmark" loading={saving} onPress={() => void save()} />}
      footerHint="保存后存在本机；健康页的睡眠格会显示这个数字，可随时回来修正"
    >
      <SheetSection title="系统健康数据" hint="Android「健康数据 / Health Connect」里昨晚的睡眠会话">
        <View style={styles.statusRow}>
          {phase === "reading" ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <ThemedIcon
              name={phase === "detected" ? "checkmark-circle" : "information-circle-outline"}
              size={18}
              color={phase === "detected" ? colors.success : colors.textMuted}
            />
          )}
          <Text style={styles.statusText}>
            {phase === "reading"
              ? "正在读取系统睡眠…"
              : phase === "detected" && detected !== null
                ? "已读取昨晚 " + formatSleepHours(detected) + "，可直接保存或修正"
                : hint}
          </Text>
        </View>
        {phase === "detected" && detected !== null ? (
          <Text style={styles.statusFoot}>
            数据来自系统健康记录；系统识别不准时，直接改下面的小时数再保存。
          </Text>
        ) : null}

        {showActions ? (
          <View style={styles.actionRow}>
            {canAuthorize ? (
              <PressableScale
                haptic
                scaleTo={0.97}
                disabled={granting}
                accessibilityRole="button"
                accessibilityLabel="授权读取系统睡眠"
                style={styles.actionBtn}
                onPress={() => void authorize()}
              >
                {granting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <ThemedIcon name="shield-checkmark-outline" size={16} color={colors.primary} />
                )}
                <Text style={styles.actionText}>去授权</Text>
              </PressableScale>
            ) : null}
            {canOpenSystem ? (
              <PressableScale
                haptic
                scaleTo={0.97}
                accessibilityRole="button"
                accessibilityLabel="打开系统健康数据设置"
                style={styles.actionBtn}
                onPress={() => void openSystemHealth()}
              >
                <ThemedIcon name="open-outline" size={16} color={colors.primary} />
                <Text style={styles.actionText}>去系统健康 App</Text>
              </PressableScale>
            ) : null}
            {canRetry ? (
              <PressableScale
                haptic
                scaleTo={0.97}
                accessibilityRole="button"
                accessibilityLabel="重新读取系统睡眠"
                style={styles.actionBtn}
                onPress={() => void reRead()}
              >
                <ThemedIcon name="refresh" size={16} color={colors.primary} />
                <Text style={styles.actionText}>重新读取</Text>
              </PressableScale>
            ) : null}
          </View>
        ) : null}
      </SheetSection>

      <SheetSection title="昨晚睡了几小时" hint="手动记录，任何设备都能用" last>
        <Field
          label="小时数"
          value={input}
          onChangeText={(value) => {
            setInput(value);
            if (error) setError(null);
          }}
          keyboardType="decimal-pad"
          placeholder="7.5"
          hint="可填 7.5、7:30 这样的写法"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </SheetSection>
    </BottomSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    statusText: { flex: 1, minWidth: 0, ...typography.callout, fontWeight: "600", color: colors.text },
    statusFoot: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
    actionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 2 },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 40,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
    },
    actionText: { ...typography.caption, fontWeight: "700", color: colors.primary },
    error: { ...typography.caption, fontWeight: "600", color: colors.danger },
  });
