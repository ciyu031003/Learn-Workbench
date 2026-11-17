import { AuthSheet } from "@/components/auth-sheet";
import { BottomSheet } from "@/components/bottom-sheet";
import { ChipGroup, SheetSection } from "@/components/sheet";
import type { MarketFacetItem } from "@/lib/market";

import { FILTER_LABEL, type FilterKey } from "./market-widgets";

/**
 * 市场分析的三个弹层：筛选项选择、What If 目标选择、登录。
 *
 * 弹层挂在页面 root 下（层级与拆分前一致）；选项与选中值、回调由页面模型统一提供。
 */
export function MarketFilterSheet({
  filterOpen,
  onCloseFilter,
  filterOptions,
  filterValue,
  onSelectFilter,
}: {
  filterOpen: FilterKey | null;
  onCloseFilter: () => void;
  filterOptions: MarketFacetItem[];
  filterValue: string;
  onSelectFilter: (key: string) => void;
}) {
  return (
    <BottomSheet
      visible={!!filterOpen}
      onClose={onCloseFilter}
      title="选择筛选项"
      subtitle={filterOpen ? `点一下「${FILTER_LABEL[filterOpen]}」即应用并关闭` : undefined}
      icon="options-outline"
      height="62%"
    >
      {filterOpen ? (
        <SheetSection title={FILTER_LABEL[filterOpen]} hint="可横滑 / 换行查看全部选项" last>
          <ChipGroup
            options={filterOptions.map((option) => ({ key: option.key, label: option.label, badge: option.count }))}
            selected={[filterValue]}
            multiple={false}
            allKey=""
            allLabel="全部"
            wrap
            onToggle={onSelectFilter}
          />
        </SheetSection>
      ) : null}
    </BottomSheet>
  );
}

export function MarketDecisionSheet({
  decisionPicker,
  onCloseDecisionPicker,
  decisionOptions,
  decisionSelected,
  onSelectDecisionOption,
}: {
  decisionPicker: "city" | "function" | null;
  onCloseDecisionPicker: () => void;
  decisionOptions: MarketFacetItem[];
  decisionSelected: string[];
  onSelectDecisionOption: (key: string) => void;
}) {
  return (
    <BottomSheet
      visible={!!decisionPicker}
      onClose={onCloseDecisionPicker}
      title={decisionPicker === "city" ? "选择目标城市" : "选择目标职能"}
      subtitle="选择后立即重算 What If 场景"
      icon="git-branch-outline"
      height="62%"
    >
      <SheetSection title={decisionPicker === "city" ? "城市" : "职能"} last>
        <ChipGroup
          options={decisionOptions.map((option) => ({ key: option.key, label: option.label, badge: option.count }))}
          selected={decisionSelected}
          multiple={false}
          wrap
          onToggle={onSelectDecisionOption}
        />
      </SheetSection>
    </BottomSheet>
  );
}

export function MarketAuthSheet({
  authOpen,
  onCloseAuth,
  onAuthed,
}: {
  authOpen: boolean;
  onCloseAuth: () => void;
  onAuthed: (token: string, username: string) => void;
}) {
  return <AuthSheet visible={authOpen} onClose={onCloseAuth} onAuthed={onAuthed} />;
}
