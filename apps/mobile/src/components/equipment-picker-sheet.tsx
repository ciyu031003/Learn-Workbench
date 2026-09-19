import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { BottomSheet } from "@/components/bottom-sheet";
import { Field } from "@/components/field";
import { equipmentCategoriesForSport } from "@learn-workbench/shared";
import { fetchEquipment, type EquipmentItem } from "@/lib/equipment";
import { radius } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 装备图库选择器（v11 P1.5）：类别 chips + 搜索 + 三列白底图网格。
 * 选中后回填型号与商品图，用户不用自己拍照。
 */
export function EquipmentPicker({
  visible,
  onClose,
  onPick,
  sportKey,
  defaultCategory,
  inline = false,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (item: EquipmentItem) => void;
  sportKey: string;
  defaultCategory?: string;
  /** true = 直接渲染内容（嵌在编辑弹层里，避免 Modal 套 Modal） */
  inline?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const categories = useMemo(() => equipmentCategoriesForSport(sportKey), [sportKey]);

  // 初始类别由调用方给（切换装备行时用 key 强制重挂载，避免在 effect 里同步 setState）
  const [category, setCategory] = useState(() => defaultCategory ?? categories[0]?.key ?? "");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    const timer = setTimeout(() => {
      setLoading(true);
      void (async () => {
        try {
          const list = await fetchEquipment({ category, q: query.trim(), limit: 60 });
          if (alive) setItems(list);
        } catch {
          if (alive) setItems([]);
        } finally {
          if (alive) setLoading(false);
        }
      })();
    }, query ? 300 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [visible, category, query]);

  const body = (
    <View style={styles.wrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {categories.map((item) => {
            const active = item.key === category;
            return (
              <Pressable
                key={item.key}
                onPress={() => setCategory(item.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="搜型号或品牌，如 ASTROX / 天斧"
          autoCapitalize="characters"
        />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>图库暂时没有这一类，先自己拍照上传也行</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  onPick(item);
                  onClose();
                }}
                style={styles.cell}
              >
                <View style={styles.imageBox}>
                  <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="contain" transition={150} />
                </View>
                <Text style={styles.model} numberOfLines={2}>{item.model}</Text>
                <Text style={styles.brand} numberOfLines={1}>{item.brand}</Text>
              </Pressable>
            ))}
          </View>
        )}
    </View>
  );

  if (inline) return visible ? body : null;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="从装备图库选择" height="86%">
      {body}
    </BottomSheet>
  );
}

/** 弹层形态（表格外独立使用） */
export const EquipmentPickerSheet = EquipmentPicker;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 12 },
    chipRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 7,
      backgroundColor: colors.surfaceStrong,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, fontWeight: "600", color: colors.text },
    chipTextActive: { color: "#ffffff" },
    center: { paddingVertical: 40, alignItems: "center" },
    emptyText: { fontSize: 12, color: colors.textMuted, textAlign: "center" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    cell: { width: "31%", gap: 4 },
    imageBox: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "#ffffff",
      overflow: "hidden",
    },
    image: { width: "100%", height: "100%" },
    model: { fontSize: 11, fontWeight: "600", color: colors.text },
    brand: { fontSize: 10, color: colors.textMuted },
  });
