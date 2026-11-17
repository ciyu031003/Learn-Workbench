import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { ChipGroup, SheetSection, SheetStickyCta } from "@/components/sheet";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import {
  citiesForProvinces,
  clearRadarFilterKey,
  isSameRadarFilter,
  RADAR_PRESET_LIMIT,
  RADAR_SALARY_OPTIONS,
  radarActiveFilterCount,
  radarPresetName,
  toggleRadarFilterValue,
  type RadarFacets,
  type RadarFilter,
  type RadarFilterPreset,
} from "@/lib/radar-filter";

import { makeStyles } from "./radar-styles";

/**
 * 筛选弹层：我的筛选（应用/重命名/删除）+ 城市/方向/薪资/经验/学历/来源多选 + 保存当前筛选。
 * 草稿态在页面模型里，弹层只负责展示草稿并把交互转发回去（关闭不丢草稿）。
 */
export function FilterSheet({
  visible,
  onClose,
  draft,
  facets,
  previewCount,
  presets,
  onApplyPreset,
  onDeletePreset,
  onRenamePreset,
  onSavePreset,
  onToggle,
  onClear,
  onReset,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  draft: RadarFilter;
  facets: RadarFacets;
  previewCount: number;
  /** v1.62 P1-4：已保存的筛选预设（展示/应用/重命名/删除） */
  presets: RadarFilterPreset[];
  onApplyPreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
  onRenamePreset: (id: string, name: string) => void;
  onSavePreset: (source: RadarFilter) => void;
  onToggle: (group: Parameters<typeof toggleRadarFilterValue>[1], value: string) => void;
  onClear: (group: Parameters<typeof clearRadarFilterKey>[1]) => void;
  onReset: () => void;
  onApply: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const draftActive = radarActiveFilterCount(draft);
  const draftDuplicate = presets.some((preset) => isSameRadarFilter(preset.filter, draft));
  const canSaveDraft = draftActive > 0 && !draftDuplicate;
  const draftName = radarPresetName(draft);
  const provinceOptions = facets.provinces.map((item) => ({
    key: item.province,
    label: item.province,
    badge: item.count,
  }));
  const cityPool = useMemo(() => {
    const counts = new Map<string, number>();
    for (const province of facets.provinces) {
      for (const city of province.cities) counts.set(city.city, city.count);
    }
    return counts;
  }, [facets.provinces]);
  const allCities = [...cityPool.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh"))
    .map(([city, count]) => ({ key: city, label: city, badge: count }));
  const cityChoices = citiesForProvinces(
    draft.provinces,
    allCities.map((item) => item.key),
  ).map((city) => allCities.find((item) => item.key === city) ?? { key: city, label: city, badge: 0 });

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="筛选岗位"
      subtitle="多选可叠加；应用后回到第一页"
      icon="options-outline"
      height="88%"
      headerAction={
        <Pressable onPress={onReset} hitSlop={8} accessibilityRole="button" accessibilityLabel="重置全部筛选">
          <Text style={styles.sheetReset}>重置</Text>
        </Pressable>
      }
      footer={
        <SheetStickyCta
          label={previewCount > 0 ? `应用筛选 · ${previewCount} 个岗位` : "应用筛选 · 无结果"}
          icon="checkmark"
          onPress={onApply}
          secondaryLabel="清空全部条件"
          onSecondary={onReset}
        />
      }
      footerHint="关闭不会丢失已选条件；重新打开继续调整"
    >
      {presets.length > 0 ? (
        <SheetSection title="我的筛选" hint={`${presets.length}/${RADAR_PRESET_LIMIT} 个 · 点名字即应用`}>
          {presets.map((preset) =>
            editingId === preset.id ? (
              <View key={preset.id} style={styles.presetEditRow}>
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  autoFocus
                  maxLength={24}
                  placeholder="预设名称"
                  placeholderTextColor={colors.textFaint}
                  style={styles.presetInput}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    onRenamePreset(preset.id, nameDraft);
                    setEditingId(null);
                  }}
                />
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    onRenamePreset(preset.id, nameDraft);
                    setEditingId(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="保存预设名称"
                >
                  <Text style={styles.presetEditSave}>保存</Text>
                </Pressable>
                <Pressable hitSlop={8} onPress={() => setEditingId(null)} accessibilityRole="button" accessibilityLabel="取消重命名">
                  <Text style={styles.presetEditCancel}>取消</Text>
                </Pressable>
              </View>
            ) : (
              <View key={preset.id} style={styles.presetManageRow}>
                <PressableScale
                  style={styles.presetManageBody}
                  onPress={() => onApplyPreset(preset.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`应用筛选预设 ${preset.name}`}
                >
                  <ThemedIcon name="bookmark-outline" size={13} color={colors.primary} />
                  <Text style={styles.presetManageName} numberOfLines={1}>{preset.name}</Text>
                </PressableScale>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setNameDraft(preset.name);
                    setEditingId(preset.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`重命名筛选预设 ${preset.name}`}
                >
                  <ThemedIcon name="create-outline" size={15} color={colors.textMuted} />
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={() => onDeletePreset(preset.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`删除筛选预设 ${preset.name}`}
                >
                  <ThemedIcon name="trash-outline" size={15} color={colors.danger} />
                </Pressable>
              </View>
            ),
          )}
        </SheetSection>
      ) : null}

      <SheetSection title="城市" hint="省市二级，可多选">
        <ChipGroup
          multiple
          wrap
          allKey="__all_province__"
          allLabel="全部省份"
          options={provinceOptions}
          selected={draft.provinces.length > 0 ? draft.provinces : ["__all_province__"]}
          onToggle={(key) => {
            if (key === "__all_province__") {
              onClear("provinces");
              return;
            }
            onToggle("provinces", key);
          }}
        />
        {cityChoices.length > 0 ? (
          <ChipGroup
            multiple
            wrap
            options={cityChoices}
            selected={draft.cities}
            onToggle={(key) => onToggle("cities", key)}
          />
        ) : null}
      </SheetSection>

      <SheetSection title="方向 / 职能" hint="领域、职能、行业可叠加">
        <Text style={styles.groupLabel}>领域</Text>
        <ChipGroup
          multiple
          wrap
          options={facets.categories}
          selected={draft.categories}
          onToggle={(key) => onToggle("categories", key)}
        />
        {facets.functions.length > 0 ? (
          <>
            <Text style={styles.groupLabel}>职能</Text>
            <ChipGroup
              multiple
              wrap
              options={facets.functions}
              selected={draft.functions}
              onToggle={(key) => onToggle("functions", key)}
            />
          </>
        ) : null}
        {facets.industries.length > 0 ? (
          <>
            <Text style={styles.groupLabel}>行业</Text>
            <ChipGroup
              multiple
              wrap
              options={facets.industries}
              selected={draft.industries}
              onToggle={(key) => onToggle("industries", key)}
            />
          </>
        ) : null}
      </SheetSection>

      <SheetSection title="薪资区间" hint="按区间重叠匹配">
        <ChipGroup
          multiple
          wrap
          options={RADAR_SALARY_OPTIONS.map((option) => ({ key: option.key, label: option.label }))}
          selected={draft.salaryBands}
          onToggle={(key) => onToggle("salaryBands", key)}
        />
      </SheetSection>

      {facets.experiences.length > 0 ? (
        <SheetSection title="经验" hint="可多选">
          <ChipGroup
            multiple
            wrap
            options={facets.experiences}
            selected={draft.experiences}
            onToggle={(key) => onToggle("experiences", key)}
          />
        </SheetSection>
      ) : null}

      {facets.educations.length > 0 ? (
        <SheetSection title="学历" hint="可多选">
          <ChipGroup
            multiple
            wrap
            options={facets.educations}
            selected={draft.educations}
            onToggle={(key) => onToggle("educations", key)}
          />
        </SheetSection>
      ) : null}

      <SheetSection title="来源" hint="岗位抓取渠道">
        {facets.sources.length > 0 ? (
          <ChipGroup
            multiple
            wrap
            options={facets.sources}
            selected={draft.sources}
            onToggle={(key) => onToggle("sources", key)}
          />
        ) : (
          <Text style={styles.distEmpty} numberOfLines={2}>
            当前候选集还没有来源信息
          </Text>
        )}
      </SheetSection>

      {/* 弹层底部：保存当前筛选（自动命名，可在「我的筛选」里重命名） */}
      <SheetSection title="保存当前筛选" hint={`最多 ${RADAR_PRESET_LIMIT} 个，超出会替换最早保存的`} last>
        <PressableScale
          style={[styles.sheetSave, !canSaveDraft && styles.sheetSaveOff]}
          disabled={!canSaveDraft}
          onPress={() => onSavePreset(draft)}
          accessibilityRole="button"
          accessibilityLabel={`保存当前筛选为预设 ${draftName}`}
          accessibilityState={{ disabled: !canSaveDraft }}
        >
          <ThemedIcon name="bookmark-outline" size={14} color={canSaveDraft ? colors.primary : colors.textMuted} />
          <Text style={[styles.sheetSaveText, !canSaveDraft && styles.sheetSaveTextOff]} numberOfLines={1}>
            {draftActive === 0
              ? "先选条件再保存"
              : draftDuplicate
                ? "当前条件已保存"
                : `保存为「${draftName}」`}
          </Text>
        </PressableScale>
      </SheetSection>
    </BottomSheet>
  );
}
