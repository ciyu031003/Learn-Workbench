import { BottomSheet } from "@/components/bottom-sheet";
import { Field } from "@/components/field";
import { ListGroup, ListRow } from "@/components/list-row";
import { SheetSection, SheetStickyCta } from "@/components/sheet";

import { TARGET_ROLE_MAX_LENGTH } from "./radar-widgets";

/**
 * 目标岗位（P3-3B）：入口行 + 编辑弹层。
 *
 * 保存后按目标岗位重算雷达（逻辑在 use-radar-screen.ts）；本文件只负责展示与回调转发。
 */
export function TargetRoleRow({
  targetRole,
  onPress,
}: {
  targetRole: string | null;
  onPress: () => void;
}) {
  return (
    <ListGroup>
      <ListRow
        icon="briefcase-outline"
        title={targetRole ?? "目标岗位"}
        subtitle={targetRole ? "目标岗位 · 点按修改，保存后按新岗位重算" : "尚未设置 · 点按设置后按岗位重算"}
        showChevron
        last
        haptic={false}
        onPress={onPress}
        accessibilityLabel={targetRole ? `目标岗位 ${targetRole}，点按编辑` : "设置目标岗位，按岗位重算匹配度"}
      />
    </ListGroup>
  );
}

export function TargetRoleSheet({
  visible,
  onClose,
  draft,
  onChangeDraft,
  onSave,
  onClear,
  saving,
  error,
}: {
  visible: boolean;
  onClose: () => void;
  draft: string;
  onChangeDraft: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="目标岗位"
      subtitle="保存后按目标岗位重算岗位契合与排序"
      icon="briefcase-outline"
      height="58%"
      footer={
        <SheetStickyCta
          label="保存并重算"
          icon="checkmark"
          loading={saving}
          onPress={onSave}
          secondaryLabel="清除目标岗位"
          onSecondary={onClear}
        />
      }
      footerHint="留空表示未设置；清除后岗位契合按中性分计算"
    >
      <SheetSection title="目标岗位" hint={`最多 ${TARGET_ROLE_MAX_LENGTH} 字；与岗位标题 / 职能做包含匹配`} last>
        <Field
          label="目标岗位"
          value={draft}
          onChangeText={onChangeDraft}
          placeholder="如：网络安全工程师"
          maxLength={TARGET_ROLE_MAX_LENGTH}
          returnKeyType="done"
          onSubmitEditing={onSave}
          error={error}
          hint={`${draft.length}/${TARGET_ROLE_MAX_LENGTH} 字`}
        />
      </SheetSection>
    </BottomSheet>
  );
}
