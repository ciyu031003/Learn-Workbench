import { useMemo, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { Icon } from "@/components/ui/icon";
import { PressableScale } from "@/components/pressable-scale";
import { BottomSheet } from "@/components/bottom-sheet";
import { ChipGroup, SheetSection, SheetStickyCta } from "@/components/sheet";
import { Field } from "@/components/field";
import { V15Card, V15Header, V15IconButton, V15Pill, V15ProgressBar, V15Scroll, V15Section, useV15Layout } from "@/components/v15/v15-ui";
import { useV15 } from "@/components/v15/v15-theme";
import type { V15Palette } from "@/components/v15/v15-theme";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { tabularNums, typography } from "@/theme/tokens";
import { useHealthBaseline } from "@/lib/health/use-health-baseline";
import type { HealthProfileDto } from "@/lib/health/health-client";
import {
  healthConfidenceLabel,
  type HealthConfidence,
  type HealthGoal,
  type HealthInsight,
  type HealthReminderCandidate,
  type SleepComponent,
} from "@learn-workbench/shared/health-rules";
import type { ActivityLevel, Sex } from "@learn-workbench/shared";

/**
 * 健康基线（v2.8.9）
 *
 * 不是又一个「打卡页」，而是把目标 / 基线 / 判定 / 提醒四件事讲清楚：
 *  1. 每日能量与宏量营养从哪来（Mifflin-St Jeor + PAL + 目标修正）；
 *  2. 近 7 天 / 28 天的数据是否够形成结论（门槛与置信度）；
 *  3. 睡眠综合分由哪些维度组成（时长 / 效率 / 分期 / 规律 / 睡眠债）；
 *  4. 只有达到门槛后才出现早睡 / 补蛋白提醒，并支持本地通知。
 */

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/wellness" as never);
}

function toneColor(tone: HealthInsight["tone"], p: V15Palette): string {
  if (tone === "green") return p.green;
  if (tone === "amber") return p.amber;
  if (tone === "orange") return p.orange;
  if (tone === "red") return p.red;
  if (tone === "blue") return p.blue;
  return p.lilac;
}

function confidenceTone(confidence: HealthConfidence): "green" | "blue" | "amber" | "neutral" {
  if (confidence === "stable") return "green";
  if (confidence === "moderate") return "blue";
  if (confidence === "early") return "amber";
  return "neutral";
}

export default function HealthBaselineScreen() {
  const p = useV15();
  const layout = useV15Layout();
  const styles = useMemo(() => makeStyles(p), [p]);
  const model = useHealthBaseline();
  const { control } = usePullRefresh(model.load);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { profile, plan, nutrition7, nutrition28, sleep7, sleep28, briefing } = model;
  const referenceNutrition = nutrition28.meetsMinimum ? nutrition28 : nutrition7;
  const referenceSleep = sleep28.meetsMinimum ? sleep28 : sleep7;
  const refNutritionLabel = nutrition28.meetsMinimum ? "近 4 周" : "近 7 天";
  const refSleepLabel = sleep28.meetsMinimum ? "近 4 周" : "近 7 天";

  const proteinRatio = plan.proteinG > 0 ? ((referenceNutrition.avgProteinG ?? 0) / plan.proteinG) * 100 : 0;
  const kcalRatio = plan.kcal > 0 ? ((referenceNutrition.avgKcal ?? 0) / plan.kcal) * 100 : 0;
  const score = referenceSleep.score;
  const compact = layout.width < 370;

  return (
    <View style={styles.root}>
      <V15Scroll p={p} refreshControl={<RefreshControl {...control} />}>
        <V15Header
          p={p}
          onBack={goBack}
          kicker="HEALTH BASELINE"
          title="健康基线"
          subtitle="7 / 28 天滚动评估 · 生活方式建议"
          actions={<V15IconButton p={p} icon="target" label="调整健康目标" onPress={() => setSheetOpen(true)} />}
        />

        {model.error ? (
          <PressableScale haptic scaleTo={0.98} onPress={() => void model.load()} style={styles.errorBar}>
            <Icon name="cloud" size={15} weight="regular" color={p.red} />
            <Text style={styles.errorText}>{model.error} · 点此重试</Text>
          </PressableScale>
        ) : null}

        {/* 1. 个性化能量目标 */}
        <V15Card p={p} style={{ marginTop: 14 }}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.kicker, { color: p.orange }]}>PERSONAL TARGET</Text>
              <View style={styles.heroValueRow}>
                <Text style={[styles.heroValue, { color: p.ink }]} numberOfLines={1} adjustsFontSizeToFit>
                  {plan.kcal.toLocaleString()}
                </Text>
                <Text style={[styles.heroUnit, { color: p.sub }]}>kcal / 天</Text>
              </View>
              <Text style={[styles.heroSub, { color: p.sub }]}>
                {plan.bmr === null ? "补齐身体数据后自动重算" : `BMR ${plan.bmr} × ${plan.activityFactor} = TDEE ${plan.tdee}`}
              </Text>
            </View>
            <V15Pill p={p} tone={plan.computed ? "orange" : "neutral"} label={plan.computed ? "个体化目标" : "默认目标"} />
          </View>

          <View style={[styles.chain, { borderTopColor: p.line }]}>
            <ChainItem label="BMR" value={plan.bmr === null ? "—" : String(plan.bmr)} p={p} styles={styles} />
            <Text style={[styles.chainOp, { color: p.faint }]}>×{plan.activityFactor}</Text>
            <ChainItem label="TDEE" value={plan.tdee === null ? "—" : String(plan.tdee)} p={p} styles={styles} />
            <Text style={[styles.chainOp, { color: p.faint }]}>{plan.goalDeltaPct === 0 ? "=" : plan.goalDeltaPct > 0 ? `+${plan.goalDeltaPct}%` : `${plan.goalDeltaPct}%`}</Text>
            <ChainItem label="目标" value={String(plan.kcal)} p={p} styles={styles} strong />
          </View>

          <Text style={[styles.formulaNote, { color: p.sub }]} numberOfLines={3}>
            {plan.notes[0]}
          </Text>
          {plan.floorApplied ? (
            <Text style={[styles.warnText, { color: p.amber }]}>已应用 {plan.kcalFloor} kcal 安全下限</Text>
          ) : null}
        </V15Card>

        {/* 2. 宏量营养 */}
        <V15Section p={p} title="每日营养目标" right={plan.formula} />
        <V15Card p={p}>
          <View style={styles.macroGrid}>
            <MacroTile label="热量" value={plan.kcal.toLocaleString()} unit="kcal" sub={plan.goal === "lose" ? "减脂 -15%" : plan.goal === "gain" ? "增肌 +8%" : "维持"} color={p.orange} p={p} styles={styles} />
            <MacroTile label="蛋白质" value={String(plan.proteinG)} unit="g" sub={`${plan.proteinPerKg} g/kg`} color={p.blue} p={p} styles={styles} />
            <MacroTile label="碳水" value={String(plan.carbsG)} unit="g" sub="补足剩余热量" color={p.amber} p={p} styles={styles} />
            <MacroTile label="脂肪" value={String(plan.fatG)} unit="g" sub={`${plan.fatPctOfKcal}% 热量`} color={p.green} p={p} styles={styles} />
          </View>
          <View style={[styles.hintRow, { borderTopColor: p.line }]}>
            <Icon name="info" size={13} weight="regular" color={p.faint} />
            <Text style={[styles.hintText, { color: p.sub }]}>
              蛋白质按目标与训练频率取 1.2–2.2 g/kg；脂肪不低于 0.6 g/kg；数据不全时用保守默认值。
            </Text>
          </View>
          <Pressable
            onPress={() => setSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="调整健康目标"
            style={({ pressed }) => [styles.editLink, { borderTopColor: p.line }, pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.editLinkText, { color: p.orange }]}>调整体重、目标与睡眠时间</Text>
            <Icon name="chevron" size={13} weight="bold" color={p.orange} />
          </Pressable>
        </V15Card>

        {/* 3. 7 / 28 天营养基线 */}
        <V15Section p={p} title="营养基线" right={`${refNutritionLabel} · ${referenceNutrition.validDays}/${referenceNutrition.windowDays} 天`} />
        <V15Card p={p}>
          <View style={styles.baselineTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.cardKicker, { color: p.sub }]}>数据充分性</Text>
              <Text style={[styles.cardTitle, { color: p.ink }]}>
                {referenceNutrition.meetsMinimum ? "已达到判定门槛" : "还在积累有效记录"}
              </Text>
            </View>
            <V15Pill p={p} tone={confidenceTone(referenceNutrition.confidence)} label={healthConfidenceLabel(referenceNutrition.confidence)} />
          </View>

          <View style={styles.metricStack}>
            <MetricBar
              label="蛋白质"
              value={referenceNutrition.avgProteinG === null ? "—" : `${referenceNutrition.avgProteinG} g`}
              target={`目标 ${plan.proteinG} g`}
              pct={proteinRatio}
              color={p.blue}
              p={p}
              styles={styles}
            />
            <MetricBar
              label="热量"
              value={referenceNutrition.avgKcal === null ? "—" : `${referenceNutrition.avgKcal} kcal`}
              target={`目标 ${plan.kcal} kcal`}
              pct={kcalRatio}
              color={p.orange}
              p={p}
              styles={styles}
            />
            <View style={styles.macroMiniRow}>
              <MiniStat label="碳水" value={referenceNutrition.avgCarbsG === null ? "—" : `${referenceNutrition.avgCarbsG} g`} p={p} styles={styles} />
              <MiniStat label="脂肪" value={referenceNutrition.avgFatG === null ? "—" : `${referenceNutrition.avgFatG} g`} p={p} styles={styles} />
              <MiniStat label="记录条数" value={String(referenceNutrition.totalEntries)} p={p} styles={styles} />
            </View>
          </View>

          <Text style={[styles.noteText, { color: p.sub }]}>{referenceNutrition.note}</Text>

          <View style={[styles.confidenceGrid, { borderTopColor: p.line }]}>
            <ConfidenceCell label="7 天" base={nutrition7} p={p} styles={styles} />
            <ConfidenceCell label="28 天" base={nutrition28} p={p} styles={styles} />
          </View>
        </V15Card>

        {/* 4. 睡眠质量判定 */}
        <V15Section p={p} title="睡眠质量判定" right={`${refSleepLabel} · ${referenceSleep.nights}/${referenceSleep.windowDays} 晚`} />
        <V15Card p={p}>
          <View style={styles.sleepTop}>
            <View style={styles.scoreBlock}>
              <Text style={[styles.scoreValue, { color: score === null ? p.faint : score >= 80 ? p.green : score >= 60 ? p.amber : p.orange }]}>
                {score === null ? "—" : score}
              </Text>
              <Text style={[styles.scoreLabel, { color: p.sub }]}>综合分</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.cardTitle, { color: p.ink }]}>
                {score === null ? "先记满 5 晚" : score >= 85 ? "恢复质量优秀" : score >= 70 ? "恢复质量良好" : score >= 55 ? "恢复质量一般" : "需要优先补觉"}
              </Text>
              <Text style={[styles.cardBody, { color: p.sub }]}>
                {score === null
                  ? "满 5 晚后自动生成时长、效率、分期、规律、睡眠债与夜醒六维评分。"
                  : `${refSleepLabel}平均 ${referenceSleep.avgDurationMin === null ? "—" : `${Math.floor(referenceSleep.avgDurationMin / 60)}h${String(referenceSleep.avgDurationMin % 60).padStart(2, "0")}m`}，入睡波动 ±${referenceSleep.bedtimeStdMin ?? "—"} 分。`}
              </Text>
              <View style={styles.sleepPills}>
                <V15Pill p={p} tone={confidenceTone(referenceSleep.confidence)} label={healthConfidenceLabel(referenceSleep.confidence)} />
                {score === null ? null : (
                  <V15Pill p={p} tone={referenceSleep.regularityLabel === "规律" ? "green" : referenceSleep.regularityLabel === "一般" ? "amber" : "neutral"} label={referenceSleep.regularityLabel} />
                )}
              </View>
            </View>
          </View>

          {score === null ? (
            <View style={styles.progressBlock}>
              <V15ProgressBar p={p} pct={(referenceSleep.nights / 5) * 100} color={p.lilac} height={6} />
              <Text style={[styles.progressText, { color: p.sub }]}>已记录 {referenceSleep.nights} / 5 晚，达到门槛后才给综合判定</Text>
            </View>
          ) : (
            <View style={styles.componentStack}>
              {referenceSleep.components.map((component) => (
                <SleepComponentRow key={component.key} component={component} p={p} styles={styles} />
              ))}
            </View>
          )}

          <View style={[styles.insightLinkRow, { borderTopColor: p.line }]}>
            <Text style={[styles.hintText, { color: p.sub }]}>评分权重：时长 30 · 效率 20 · 分期 15 · 规律 15 · 睡眠债 10 · 夜醒 10；缺项自动重分配。</Text>
            <Pressable onPress={() => router.push("/sleep" as never)} hitSlop={8} accessibilityRole="button" accessibilityLabel="查看睡眠分析">
              <Text style={[styles.editLinkText, { color: p.orange }]}>睡眠分析 ›</Text>
            </Pressable>
          </View>
        </V15Card>

        {/* 5. 主动提醒 */}
        <V15Section p={p} title="主动提醒" right={model.reminderMessage ?? "仅本地通知"} />
        <V15Card p={p} padded={false}>
          <ReminderRow
            keyName="early-sleep"
            icon="moon"
            title="早睡提醒"
            candidate={briefing.reminders.find((item) => item.key === "early-sleep") ?? null}
            enabled={profile.reminderPrefs.earlySleep === true}
            disabledReason={referenceSleep.meetsMinimum ? `${refSleepLabel}睡眠指标在目标区间，暂不需要早睡提醒` : "记录满 5 晚后才开启"}
            onToggle={(next) => void model.toggleReminder("earlySleep", next)}
            p={p}
            styles={styles}
          />
          <ReminderRow
            keyName="protein"
            icon="food"
            title="补蛋白提醒"
            candidate={briefing.reminders.find((item) => item.key === "protein") ?? null}
            enabled={profile.reminderPrefs.protein === true}
            disabledReason={referenceNutrition.meetsMinimum ? `${refNutritionLabel}蛋白质已达到目标的 85%` : "记录满 5 天且蛋白持续偏低后才开启"}
            onToggle={(next) => void model.toggleReminder("protein", next)}
            p={p}
            styles={styles}
            last
          />
          <View style={[styles.testRow, { borderTopColor: p.line }]}>
            <Text style={[styles.hintText, { color: p.sub, flex: 1 }]}>
              提醒由本机调度，未来 7 天有效；每次打开页面会自动续期。静默时段 {profile.reminderPrefs.quietStart ?? "22:30"}–{profile.reminderPrefs.quietEnd ?? "07:00"}。
            </Text>
            <Pressable onPress={() => void model.sendTestReminder()} hitSlop={8} accessibilityRole="button" accessibilityLabel="发送测试提醒">
              <Text style={[styles.editLinkText, { color: p.blue }]}>测试提醒</Text>
            </Pressable>
          </View>
        </V15Card>

        {/* 6. 洞察 */}
        <V15Section p={p} title="当前洞察" right={`${briefing.insights.length} 条`} />
        <View style={styles.insightStack}>
          {briefing.insights.slice(0, compact ? 4 : 6).map((insight) => (
            <InsightRow key={insight.key} insight={insight} p={p} styles={styles} />
          ))}
        </View>

        <View style={[styles.safety, { backgroundColor: p.card2, borderColor: p.line }]}>
          <Icon name="info" size={14} weight="regular" color={p.faint} />
          <Text style={[styles.safetyText, { color: p.sub }]}>
            以上内容基于公开公式与常见参考区间，用于生活方式管理，不构成医疗诊断。若持续失眠、体重异常变化或身体不适，请咨询专业医生。
          </Text>
        </View>
      </V15Scroll>
      {sheetOpen ? (
        <HealthProfileSheet
          visible
          profile={profile}
          saving={model.saving}
          onClose={() => setSheetOpen(false)}
          onSave={async (next) => {
            const saved = await model.save(next);
            if (saved) setSheetOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

function ChainItem({ label, value, p, styles, strong }: { label: string; value: string; p: V15Palette; styles: ReturnType<typeof makeStyles>; strong?: boolean }) {
  return (
    <View style={styles.chainItem}>
      <Text style={[styles.chainLabel, { color: p.sub }]}>{label}</Text>
      <Text style={[styles.chainValue, { color: strong ? p.orange : p.ink }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function MacroTile({ label, value, unit, sub, color, p, styles }: { label: string; value: string; unit: string; sub: string; color: string; p: V15Palette; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={[styles.macroTile, { backgroundColor: p.card2, borderColor: p.line }]}>
      <View style={styles.macroTileHead}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.macroTileLabel, { color: p.sub }]} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.macroTileValue, { color: p.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}<Text style={[styles.macroTileUnit, { color: p.sub }]}> {unit}</Text>
      </Text>
      <Text style={[styles.macroTileSub, { color: p.faint }]} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

function MetricBar({ label, value, target, pct, color, p, styles }: { label: string; value: string; target: string; pct: number; color: string; p: V15Palette; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricHead}>
        <Text style={[styles.metricLabel, { color: p.ink }]}>{label}</Text>
        <Text style={[styles.metricValue, { color: color }]}>{value}<Text style={[styles.metricTarget, { color: p.sub }]}> / {target}</Text></Text>
      </View>
      <V15ProgressBar p={p} pct={pct} color={color} height={6} />
    </View>
  );
}

function MiniStat({ label, value, p, styles }: { label: string; value: string; p: V15Palette; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniStatValue, { color: p.ink }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[styles.miniStatLabel, { color: p.sub }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function ConfidenceCell({ label, base, p, styles }: { label: string; base: ReturnType<typeof useHealthBaseline>["nutrition7"]; p: V15Palette; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.confidenceCell}>
      <Text style={[styles.confidenceLabel, { color: p.sub }]}>{label}</Text>
      <Text style={[styles.confidenceValue, { color: p.ink }]}>{base.validDays}/{base.windowDays} 天</Text>
      <Text style={[styles.confidenceMeta, { color: base.meetsMinimum ? p.green : p.faint }]} numberOfLines={1}>
        {base.meetsMinimum ? healthConfidenceLabel(base.confidence) : `还差 ${Math.max(0, base.minDays - base.validDays)} 天`}
      </Text>
    </View>
  );
}

function SleepComponentRow({ component, p, styles }: { component: SleepComponent; p: V15Palette; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.componentRow}>
      <View style={styles.componentHead}>
        <Text style={[styles.componentLabel, { color: p.ink }]}>{component.label}</Text>
        <Text style={[styles.componentValue, { color: p.sub }]} numberOfLines={1}>{component.valueText}</Text>
        <Text style={[styles.componentScore, { color: p.ink }]}>{component.available ? component.score : "—"}</Text>
      </View>
      <V15ProgressBar p={p} pct={component.available ? component.score : 0} color={component.score >= 75 ? p.green : component.score >= 50 ? p.amber : p.orange} height={4} />
      <Text style={[styles.componentWeight, { color: p.faint }]}>权重 {component.weightPct}%</Text>
    </View>
  );
}

function ReminderRow({
  icon,
  title,
  candidate,
  enabled,
  disabledReason,
  onToggle,
  p,
  styles,
  last,
}: {
  keyName: "early-sleep" | "protein";
  icon: "moon" | "food";
  title: string;
  candidate: HealthReminderCandidate | null;
  enabled: boolean;
  disabledReason: string;
  onToggle: (next: boolean) => void;
  p: V15Palette;
  styles: ReturnType<typeof makeStyles>;
  last?: boolean;
}) {
  const active = Boolean(candidate?.active);
  return (
    <View style={[styles.reminderRow, !last && { borderBottomColor: p.line, borderBottomWidth: 1 }]}>
      <View style={[styles.reminderIcon, { backgroundColor: active ? p.orangeSoft : p.card2 }]}>
        <Icon name={icon} size={17} weight="duotone" color={active ? p.orange : p.faint} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.reminderTitleRow}>
          <Text style={[styles.reminderTitle, { color: p.ink }]}>{title}</Text>
          {active ? <V15Pill p={p} tone="orange" label={candidate?.windowLabel ?? "已触发"} /> : null}
        </View>
        <Text style={[styles.reminderBody, { color: p.sub }]} numberOfLines={3}>
          {active ? candidate?.body : disabledReason}
        </Text>
        {active ? <Text style={[styles.reminderEvidence, { color: p.faint }]} numberOfLines={2}>{candidate?.evidence}</Text> : null}
      </View>
      <Switch
        value={enabled}
        disabled={!active && !enabled}
        onValueChange={onToggle}
        trackColor={{ false: p.track, true: p.orangeSoft }}
        thumbColor={enabled ? p.orange : p.faint}
        accessibilityLabel={title + (active ? "开关" : "暂不可开启")}
      />
    </View>
  );
}

function InsightRow({ insight, p, styles }: { insight: HealthInsight; p: V15Palette; styles: ReturnType<typeof makeStyles> }) {
  const color = toneColor(insight.tone, p);
  return (
    <View style={[styles.insightRow, { backgroundColor: p.card, borderColor: p.line }]}>
      <View style={[styles.insightRail, { backgroundColor: color }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.insightHead}>
          <Text style={[styles.insightTitle, { color: p.ink }]} numberOfLines={1}>{insight.title}</Text>
          <V15Pill p={p} tone={confidenceTone(insight.confidence)} label={healthConfidenceLabel(insight.confidence)} />
        </View>
        <Text style={[styles.insightBody, { color: p.sub }]}>{insight.body}</Text>
        <Text style={[styles.insightEvidence, { color: p.faint }]} numberOfLines={2}>{insight.evidence}</Text>
      </View>
    </View>
  );
}

function HealthProfileSheet({
  visible,
  profile,
  saving,
  onClose,
  onSave,
}: {
  visible: boolean;
  profile: HealthProfileDto;
  saving: boolean;
  onClose: () => void;
  onSave: (next: Partial<HealthProfileDto>) => void | Promise<void>;
}) {
  const p = useV15();
  const styles = useMemo(() => makeStyles(p), [p]);
  const [form, setForm] = useState<HealthProfileDto>(profile);


  const patch = (part: Partial<HealthProfileDto>) => setForm((prev) => ({ ...prev, ...part }));
  const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
  const safeBedtime = TIME_RE.test(form.bedtimeTarget.trim()) ? form.bedtimeTarget.trim() : profile.bedtimeTarget;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="健康目标"
      subtitle="身体数据只用于计算目标与基线，不上传第三方"
      icon="heart-outline"
      height="88%"
      footer={
        <SheetStickyCta
          label="保存并重算"
          icon="checkmark"
          loading={saving}
          onPress={() =>
            void onSave({
              weightKg: form.weightKg,
              heightCm: form.heightCm,
              birthYear: form.birthYear,
              sex: form.sex,
              activityLevel: form.activityLevel,
              bodyGoal: form.bodyGoal,
              trainingDaysPerWeek: form.trainingDaysPerWeek,
              sleepTargetMinutes: form.sleepTargetMinutes,
              bedtimeTarget: safeBedtime,
            })
          }
        />
      }
      footerHint="保存后今日目标、7/28 天基线与提醒会立即重算"
    >
      <SheetSection title="目标" hint="减脂 / 增肌采用温和缺口或盈余">
        <ChipGroup
          multiple={false}
          wrap
          options={[
            { key: "lose", label: "减脂 -15%" },
            { key: "maintain", label: "维持" },
            { key: "gain", label: "增肌 +8%" },
          ]}
          selected={[form.bodyGoal]}
          onToggle={(key) => patch({ bodyGoal: key as HealthGoal })}
        />
      </SheetSection>

      <SheetSection title="活动水平" hint="决定 TDEE 的活动系数">
        <ChipGroup
          multiple={false}
          wrap
          options={[
            { key: "sedentary", label: "久坐 ×1.2" },
            { key: "light", label: "轻活动 ×1.375" },
            { key: "moderate", label: "中等 ×1.55" },
            { key: "high", label: "高活动 ×1.725" },
          ]}
          selected={[form.activityLevel ?? "light"]}
          onToggle={(key) => patch({ activityLevel: key as ActivityLevel })}
        />
      </SheetSection>

      <SheetSection title="身体数据" hint="身高 / 出生年 / 性别缺失时用保守默认值">
        <View style={styles.sheetRow}>
          <Field
            label="体重 kg"
            value={String(form.weightKg || "")}
            onChangeText={(v) => patch({ weightKg: Number(v) || 60 })}
            keyboardType="numeric"
            placeholder="62"
            containerStyle={styles.sheetCol}
          />
          <Field
            label="身高 cm"
            value={form.heightCm ? String(form.heightCm) : ""}
            onChangeText={(v) => patch({ heightCm: Number(v) || null })}
            keyboardType="numeric"
            placeholder="170"
            containerStyle={styles.sheetCol}
          />
        </View>
        <View style={styles.sheetRow}>
          <Field
            label="出生年"
            value={form.birthYear ? String(form.birthYear) : ""}
            onChangeText={(v) => patch({ birthYear: Number(v) || null })}
            keyboardType="numeric"
            placeholder="1998"
            containerStyle={styles.sheetCol}
          />
          <View style={styles.sheetCol}>
            <Text style={[styles.sheetLabel, { color: p.sub }]}>性别</Text>
            <ChipGroup
              multiple={false}
              options={[
                { key: "male", label: "男" },
                { key: "female", label: "女" },
              ]}
              selected={form.sex ? [form.sex] : []}
              onToggle={(key) => patch({ sex: form.sex === key ? null : (key as Sex) })}
            />
          </View>
        </View>
      </SheetSection>

      <SheetSection title="训练频率" hint="每周计划训练天数，用于蛋白目标">
        <ChipGroup
          multiple={false}
          wrap
          options={[0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({ key: String(n), label: n + " 天" }))}
          selected={[String(form.trainingDaysPerWeek ?? 0)]}
          onToggle={(key) => patch({ trainingDaysPerWeek: Number(key) })}
        />
      </SheetSection>

      <SheetSection title="睡眠目标" hint="建议成人 7–9 小时；默认 7.5 小时">
        <ChipGroup
          multiple={false}
          wrap
          options={[
            { key: "420", label: "7 小时" },
            { key: "450", label: "7.5 小时" },
            { key: "480", label: "8 小时" },
            { key: "510", label: "8.5 小时" },
          ]}
          selected={[String(form.sleepTargetMinutes)]}
          onToggle={(key) => patch({ sleepTargetMinutes: Number(key) })}
        />
        <Field
          label="建议入睡时刻 HH:mm"
          value={form.bedtimeTarget}
          onChangeText={(v) => patch({ bedtimeTarget: v })}
          placeholder="23:30"
          hint="早睡提醒会在目标前 90 分钟送达（20:30–23:30 之间）"
        />
      </SheetSection>
    </BottomSheet>
  );
}

const makeStyles = (p: V15Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: p.canvas },
    errorBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: p.red,
      backgroundColor: p.redSoft,
    },
    errorText: { ...typography.caption, color: p.red, fontWeight: "600", flex: 1 },
    heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    kicker: { ...typography.micro, fontWeight: "800", letterSpacing: 1.2 },
    heroValueRow: { flexDirection: "row", alignItems: "baseline", gap: 5, marginTop: 2 },
    heroValue: { ...typography.numXl, ...tabularNums },
    heroUnit: { ...typography.caption, fontWeight: "700" },
    heroSub: { ...typography.meta, marginTop: 2, lineHeight: 18 },
    chain: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, marginTop: 14, paddingTop: 12, borderTopWidth: 1 },
    chainItem: { alignItems: "flex-start", flex: 1, minWidth: 0 },
    chainLabel: { ...typography.micro, fontWeight: "600" },
    chainValue: { ...typography.caption, fontWeight: "800", ...tabularNums, marginTop: 2 },
    chainOp: { ...typography.micro, fontWeight: "700", paddingHorizontal: 1 },
    formulaNote: { ...typography.meta, marginTop: 10, lineHeight: 18 },
    warnText: { ...typography.micro, fontWeight: "700", marginTop: 6 },
    macroGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    macroTile: { width: "48%", borderWidth: 1, borderRadius: 14, padding: 10, gap: 3 },
    macroTileHead: { flexDirection: "row", alignItems: "center", gap: 5 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    macroTileLabel: { ...typography.micro, fontWeight: "600" },
    macroTileValue: { ...typography.numLg, ...tabularNums, marginTop: 2 },
    macroTileUnit: { ...typography.micro, fontWeight: "600" },
    macroTileSub: { ...typography.micro },
    hintRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
    hintText: { ...typography.micro, lineHeight: 17, flex: 1 },
    editLink: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
    editLinkText: { ...typography.caption, fontWeight: "700" },
    baselineTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    cardKicker: { ...typography.micro, fontWeight: "600" },
    cardTitle: { ...typography.headline, fontWeight: "800", marginTop: 2 },
    cardBody: { ...typography.meta, marginTop: 3, lineHeight: 18 },
    metricStack: { gap: 10, marginTop: 12 },
    metricRow: { gap: 5 },
    metricHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
    metricLabel: { ...typography.caption, fontWeight: "700" },
    metricValue: { ...typography.caption, fontWeight: "800", ...tabularNums },
    metricTarget: { ...typography.micro, fontWeight: "500" },
    macroMiniRow: { flexDirection: "row", gap: 8, marginTop: 2 },
    miniStat: { flex: 1, minWidth: 0, backgroundColor: p.card2, borderRadius: 10, padding: 8, gap: 2 },
    miniStatValue: { ...typography.caption, fontWeight: "800", ...tabularNums },
    miniStatLabel: { ...typography.micro, color: p.sub },
    noteText: { ...typography.micro, lineHeight: 17, marginTop: 10 },
    confidenceGrid: { flexDirection: "row", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
    confidenceCell: { flex: 1, minWidth: 0, gap: 2 },
    confidenceLabel: { ...typography.micro, fontWeight: "600" },
    confidenceValue: { ...typography.caption, fontWeight: "800", ...tabularNums },
    confidenceMeta: { ...typography.micro, fontWeight: "600" },
    sleepTop: { flexDirection: "row", alignItems: "center", gap: 14 },
    scoreBlock: { width: 68, alignItems: "center" },
    scoreValue: { ...typography.numXl, ...tabularNums },
    scoreLabel: { ...typography.micro, fontWeight: "600", marginTop: -2 },
    sleepPills: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
    progressBlock: { marginTop: 12, gap: 6 },
    progressText: { ...typography.micro },
    componentStack: { gap: 12, marginTop: 12 },
    componentRow: { gap: 4 },
    componentHead: { flexDirection: "row", alignItems: "baseline", gap: 6 },
    componentLabel: { ...typography.caption, fontWeight: "700", minWidth: 68 },
    componentValue: { ...typography.micro, flex: 1 },
    componentScore: { ...typography.caption, fontWeight: "800", ...tabularNums },
    componentWeight: { ...typography.micro, textAlign: "right" },
    insightLinkRow: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, gap: 6 },
    reminderRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
    reminderIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    reminderTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    reminderTitle: { ...typography.caption, fontWeight: "800" },
    reminderBody: { ...typography.micro, lineHeight: 17, marginTop: 3 },
    reminderEvidence: { ...typography.micro, marginTop: 4 },
    testRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1 },
    insightStack: { gap: 8 },
    insightRow: { flexDirection: "row", gap: 0, borderWidth: 1, borderRadius: 16, overflow: "hidden" },
    insightRail: { width: 4 },
    insightHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 12, paddingHorizontal: 12 },
    insightTitle: { ...typography.caption, fontWeight: "800", flex: 1 },
    insightBody: { ...typography.meta, lineHeight: 18, paddingHorizontal: 12, marginTop: 3 },
    insightEvidence: { ...typography.micro, paddingHorizontal: 12, paddingBottom: 12, marginTop: 4 },
    safety: { flexDirection: "row", alignItems: "flex-start", gap: 7, borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 18, marginBottom: 8 },
    safetyText: { ...typography.micro, lineHeight: 17, flex: 1 },
    sheetRow: { flexDirection: "row", gap: 8 },
    sheetCol: { flex: 1, minWidth: 0 },
    sheetLabel: { ...typography.caption, fontWeight: "600", marginBottom: 6 },
  });
