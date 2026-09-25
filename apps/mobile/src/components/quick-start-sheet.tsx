import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import {
  ChipGroup,
  SheetSection,
  SheetSegmented,
  SheetStickyCta,
  StepperRow,
  type SegmentOption,
} from "@/components/sheet";
import {
  ContentPicker,
  EMPTY_CONTENT,
  contentLabelOf,
  type ContentChoice,
  type ContentSource,
} from "@/components/content-picker";
import { SPORT_CATALOG, exerciseTypeOptions, type SportItem } from "@learn-workbench/shared";

/** 一键开始的会话类型（由 App 决定，随后直接进入计时） */
export interface QuickStartChoice {
  /** focus=学习专注（写专注 sessions）；exercise=运动（写运动记录） */
  kind: "focus" | "exercise";
  /** countdown=倒计时；stopwatch=正向秒表 */
  timerMode: "countdown" | "stopwatch";
  minutes?: number;
  sportKey?: string;
  sportName?: string;
  /** v5 P2-1：本次绑定的学习内容（写进 focus_sessions.tag） */
  contentLabel?: string;
  contentSource?: ContentSource;
  /** 本轮仅用于拼 label，不落库（为将来结构化列预留） */
  phaseId?: number;
  topicId?: number;
}

const MODE_OPTIONS: readonly SegmentOption<"countdown" | "stopwatch">[] = [
  { key: "countdown", label: "倒计时", icon: "timer-outline" },
  { key: "stopwatch", label: "正向计时", icon: "play-forward-outline" },
];

/**
 * 「一键开始」弹层（v16 重构：Sheet v3 + 原子组件）。
 *
 * 交互不变（v1.4.2 的不变量）：**选择 ≠ 开始**。这里的点选只改选择态，
 * 只有底部的吸底 CTA 会真正进入计时；侧滑 / 点空白 / 返回键一律只关闭。
 * 观感升级：分段用滑动胶囊、分组用 SheetSection、时长用 ChipGroup + StepperRow、
 * 启动按钮吸底（内容再长也不会被推走），并把"选择 ≠ 开始"写进副标题与底部提示。
 */
export function QuickStartSheet({
  visible,
  onClose,
  onPick,
  onClosed,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (choice: QuickStartChoice) => void;
  /** 退场动画结束、Modal 卸载后回调（父级用它延后打开全屏计时器） */
  onClosed?: () => void;
}) {
  const [tab, setTab] = useState<"learning" | "exercise">("learning");
  const [sportType, setSportType] = useState<string>(exerciseTypeOptions[0]?.type ?? "AEROBIC");
  const [sport, setSport] = useState<SportItem | null>(null);
  const [sportMinutes, setSportMinutes] = useState(30);
  /** v5 P2-1：这次学什么（默认不指定；不做"记住上次"——D4） */
  const [content, setContent] = useState<ContentChoice>(EMPTY_CONTENT);
  /** 学习：时长与模式的**选择态**（不再直接开始） */
  const [learningMinutes, setLearningMinutes] = useState(25);
  const [learningMode, setLearningMode] = useState<"countdown" | "stopwatch">("countdown");
  /** 运动：模式的选择态 */
  const [exerciseMode, setExerciseMode] = useState<"countdown" | "stopwatch">("countdown");

  const sports = useMemo(() => SPORT_CATALOG.filter((s) => s.type === sportType), [sportType]);
  const pickedSport = sport ?? sports[0] ?? null;

  /** 每次关闭都回到默认选择（D4：不记住上次）——所有关闭路径（含侧滑/点空白）都会走它 */
  const reset = () => {
    setContent(EMPTY_CONTENT);
    setLearningMinutes(25);
    setLearningMode("countdown");
    setExerciseMode("countdown");
    setSport(null);
    setSportMinutes(30);
    setTab("learning");
  };

  const close = () => {
    reset();
    onClose();
  };

  /** 底部按钮文案：把当前选择说清楚，避免"点错才知道会开始" */
  const startLabel =
    tab === "learning"
      ? learningMode === "stopwatch"
        ? "开始计时 · 学习（正向计时）"
        : `开始计时 · 学习 ${learningMinutes} 分钟`
      : exerciseMode === "stopwatch"
        ? `开始计时 · ${pickedSport?.name ?? "运动"}（正向计时）`
        : `开始计时 · ${pickedSport?.name ?? "运动"} ${sportMinutes} 分钟`;

  const start = () => {
    if (tab === "learning") {
      const label = contentLabelOf(content);
      onPick({
        kind: "focus",
        timerMode: learningMode,
        minutes: learningMode === "countdown" ? learningMinutes : undefined,
        contentLabel: label ?? undefined,
        // 没填内容时明确记为 none（而不是留下一个可能会被误读的 source）
        contentSource: label ? content.source : "none",
        phaseId: label ? content.phaseId : undefined,
        topicId: label ? content.topicId : undefined,
      });
      close();
      return;
    }
    // 只接受"当前分类下真实存在"的项目：否则会静默回落到目录第一项
    if (!pickedSport) return;
    onPick({
      kind: "exercise",
      timerMode: exerciseMode,
      minutes: exerciseMode === "countdown" ? sportMinutes : undefined,
      sportKey: pickedSport.key,
      sportName: pickedSport.name,
    });
    close();
  };

  const learningBody = (
    <>
      <SheetSection title="这次学什么" hint="不指定就是自由专注">
        <ContentPicker value={content} onChange={setContent} />
      </SheetSection>

      <SheetSection
        title="时长"
        hint={learningMode === "stopwatch" ? "正向计时不限时长" : "选常用档，或自己加减"}
      >
        <ChipGroup
          multiple={false}
          options={[
            { key: "15", label: "15 分钟" },
            { key: "25", label: "25 分钟" },
            { key: "45", label: "45 分钟" },
          ]}
          selected={learningMode === "countdown" ? [String(learningMinutes)] : []}
          onToggle={(k) => {
            setLearningMode("countdown");
            setLearningMinutes(Number(k));
          }}
        />
        <StepperRow
          label="自定义时长"
          hint="5–180 分钟"
          value={learningMinutes}
          step={5}
          min={5}
          max={180}
          unit="分钟"
          onChange={(v) => {
            setLearningMode("countdown");
            setLearningMinutes(v);
          }}
        />
      </SheetSection>

      <SheetSection title="计时方式" last>
        <SheetSegmented options={MODE_OPTIONS} value={learningMode} onChange={setLearningMode} />
      </SheetSection>
    </>
  );

  const exerciseBody = (
    <>
      <SheetSection title="项目类型">
        <ChipGroup
          multiple={false}
          wrap
          options={exerciseTypeOptions.map((t) => ({ key: t.type, label: t.label }))}
          selected={[sportType]}
          onToggle={(k) => {
            setSportType(k);
            setSport(null);
          }}
        />
      </SheetSection>

      <SheetSection title="项目">
        <ChipGroup
          multiple={false}
          wrap
          options={sports.map((s) => ({ key: s.key, label: s.name }))}
          selected={pickedSport ? [pickedSport.key] : []}
          onToggle={(k) => {
            const next = sports.find((s) => s.key === k);
            if (next) setSport(next);
          }}
        />
      </SheetSection>

      <SheetSection title="时长" hint={exerciseMode === "stopwatch" ? "正向计时不限时长" : "选常用档，或自己加减"}>
        <ChipGroup
          multiple={false}
          options={[15, 30, 45, 60].map((m) => ({ key: String(m), label: `${m} 分钟` }))}
          selected={exerciseMode === "countdown" ? [String(sportMinutes)] : []}
          onToggle={(k) => {
            setExerciseMode("countdown");
            setSportMinutes(Number(k));
          }}
        />
        <StepperRow
          label="自定义时长"
          hint="5–300 分钟"
          value={sportMinutes}
          step={5}
          min={5}
          max={300}
          unit="分钟"
          onChange={(v) => {
            setExerciseMode("countdown");
            setSportMinutes(v);
          }}
        />
      </SheetSection>

      <SheetSection title="计时方式" last>
        <SheetSegmented options={MODE_OPTIONS} value={exerciseMode} onChange={setExerciseMode} />
      </SheetSection>
    </>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title="一键开始"
      subtitle="先选好这次做什么；只有点底部按钮才会开始计时"
      icon="play-circle-outline"
      height="78%"
      onClosed={onClosed}
      segmented={
        <SheetSegmented
          options={[
            { key: "learning", label: "学习", icon: "book-outline" },
            { key: "exercise", label: "运动", icon: "barbell-outline" },
          ]}
          value={tab}
          onChange={setTab}
        />
      }
      footer={
        <SheetStickyCta
          label={startLabel}
          icon="play"
          onPress={start}
          disabled={tab === "exercise" && !pickedSport}
        />
      }
      footerHint="返回、点空白或下滑只会关闭，不会开始计时"
    >
      {tab === "learning" ? learningBody : exerciseBody}
    </BottomSheet>
  );
}
