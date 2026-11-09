import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { SheetStickyCta } from "@/components/sheet";
import { ThemedIcon } from "@/components/themed-icon";
import { useIdentity } from "@/hooks/use-identity";
import { identityInitial, updateIdentity } from "@/lib/identity";
import { absoluteMediaUrl, pickAndUpload } from "@/lib/uploads";
import { useAppStore } from "@/store/app-store";
import { useTheme } from "@/theme";
import { radius, typography, type ThemeColors } from "@/theme/tokens";
import { friendlyError } from "@/lib/friendly-error";

const NAME_MAX = 20;

/**
 * 编辑头像 / 昵称。头像走现有 /api/uploads（kind=avatar），昵称走 PUT /api/auth/me；
 * 保存成功后写回 store，今日页与我的页会立即使用同一份身份。
 */
export function ProfileEditSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const identity = useIdentity();
  const token = useAppStore((s) => s.token);
  const [name, setName] = useState(identity.name);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(identity.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset editor state on open
    setName(identity.name);
    setAvatarUrl(identity.avatarUrl);
    setError(null);
  }, [visible, identity.name, identity.avatarUrl]);

  const length = Array.from(name.trim()).length;
  const preview = absoluteMediaUrl(avatarUrl);
  const canSave = length >= 1 && length <= NAME_MAX && !saving && !uploading;

  const changeAvatar = async () => {
    if (uploading) return;
    setUploading(true);
    setError(null);
    try {
      const url = await pickAndUpload("avatar");
      if (url) setAvatarUrl(url);
    } catch (e) {
      setError(friendlyError(e, "头像上传失败，请重试"));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!canSave) return;
    if (!token) {
      setError("请先登录后再编辑资料");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await updateIdentity(token, { displayName: name.trim(), avatarUrl });
      useAppStore.getState().setProfile(next.displayName, next.avatarUrl);
      onClose();
    } catch (e) {
      setError(friendlyError(e, "保存失败，请稍后重试"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="编辑资料"
      subtitle="头像和昵称会同步到今日页与我的页"
      icon="person-circle-outline"
      height="72%"
      footer={
        <SheetStickyCta
          label={saving ? "保存中…" : "保存资料"}
          icon="checkmark"
          loading={saving}
          disabled={!canSave}
          onPress={save}
        />
      }
      footerHint={error ?? "昵称 " + length + "/" + NAME_MAX + " · 头像仅保存到你的账号"}
    >
      <View style={styles.avatarBlock}>
        <Pressable
          onPress={changeAvatar}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel="更换头像"
          style={styles.avatarButton}
        >
          {preview ? (
            <Image source={{ uri: preview }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{identityInitial(name)}</Text>
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            <ThemedIcon
              name={uploading ? "cloud-upload-outline" : "camera-outline"}
              size={14}
              color={colors.canvas}
            />
          </View>
        </Pressable>
        <Text style={styles.avatarHint}>{uploading ? "上传中…" : "点击更换头像"}</Text>
        {avatarUrl ? (
          <Pressable onPress={() => setAvatarUrl(null)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.removeAvatar}>移除当前头像</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>昵称</Text>
        <TextInput
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (error) setError(null);
          }}
          maxLength={40}
          placeholder="输入昵称"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={() => void save()}
          accessibilityLabel="昵称"
        />
        <Text style={styles.fieldHint}>1–20 个字符，保存后今日页问候也会更新</Text>
      </View>
    </BottomSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    avatarBlock: { alignItems: "center", gap: 8, paddingTop: 8, paddingBottom: 18 },
    avatarButton: { width: 88, height: 88, borderRadius: radius.pill },
    avatarImage: { width: 88, height: 88, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
    avatarFallback: {
      width: 88,
      height: 88,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    avatarFallbackText: { ...typography.display, fontWeight: "700", color: colors.canvas },
    avatarEditBadge: {
      position: "absolute",
      right: 0,
      bottom: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.surfaceStrong,
    },
    avatarHint: { ...typography.caption, color: colors.textMuted },
    removeAvatar: { ...typography.caption, fontWeight: "700", color: colors.danger },
    field: { gap: 8 },
    fieldLabel: { ...typography.section, color: colors.text },
    input: {
      minHeight: 48,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 14,
      ...typography.body,
      color: colors.text,
    },
    fieldHint: { ...typography.meta, color: colors.textMuted },
  });
