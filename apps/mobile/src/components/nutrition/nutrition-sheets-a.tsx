import { BottomSheet } from "@/components/bottom-sheet";
import { MonthCalendar } from "@/components/month-calendar";
import { StickerBookSheet } from "@/components/sticker-book";
import { WaterCupSheet } from "@/components/water-cup";
import { LiveLogSheet } from "@/components/live-log-sheet";
import { type ThemeColors } from "@/theme/tokens";
import { fromDateKey, toDateKey } from "@learn-workbench/shared/dates";
import type { NutritionModel } from "@/lib/nutrition/use-nutrition-screen";
import type { NutritionStyles } from "./nutrition-styles";

export function NutritionSheetsA({
  model,
  styles,
  colors,
}: {
  model: NutritionModel;
  styles: NutritionStyles;
  colors: ThemeColors;
}) {
  const { date, setDate, entries, dateSheetOpen, setDateSheetOpen, foods, setManual, hydration, wellnessBusy, bookOpen, setBookOpen, cupOpen, setCupOpen, liveOpen, setLiveOpen, liveNames, openSheet, quickAdd, onAddWater, onUndoWater } = model;
  return (
    <>
      {/* 日视图的「选择日期」：复用同一个 MonthCalendar（与学习统计页行为一致） */}
      <BottomSheet
        visible={dateSheetOpen}
        onClose={() => setDateSheetOpen(false)}
        title="选择日期"
        height="60%"
      >
        <MonthCalendar
          selected={fromDateKey(date)}
          onSelect={(d) => setDate(toDateKey(d))}
          onClose={() => setDateSheetOpen(false)}
        />
      </BottomSheet>

      <StickerBookSheet
        visible={bookOpen}
        reloadKey={entries.length}
        onClose={() => setBookOpen(false)}
        onPick={(name, avgKcal) => {
          const food = foods.find((f) => f.name === name);
          if (food) {
            void quickAdd(food);
            return;
          }
          // 不在常用库里：带着名字与平均热量打开手动表单（今天先落账）
          setManual((prev) => ({ ...prev, name, kcal: String(Math.round(avgKcal)) }));
          setBookOpen(false);
          openSheet();
        }}
      />

      {/* v4 P4-c：水杯（液面动画 + 快捷水量） */}
      <BottomSheet
        visible={cupOpen}
        onClose={() => setCupOpen(false)}
        title="今日饮水"
        height="86%"
        scroll={false}
      >
        <WaterCupSheet
          visible={cupOpen}
          totalMl={hydration.totalMl}
          targetMl={hydration.targetMl}
          lastLogId={hydration.lastId}
          lastTime={hydration.lastTime}
          busy={wellnessBusy}
          onAdd={(ml) => void onAddWater(ml)}
          onUndo={() => void onUndoWater()}
        />
      </BottomSheet>

      {/* v4 P4-c：LiveLog 贴纸画布（本机保存） */}
      <LiveLogSheet visible={liveOpen} onClose={() => setLiveOpen(false)} names={liveNames} />
    </>
  );
}
