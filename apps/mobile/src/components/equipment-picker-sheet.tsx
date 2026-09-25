import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BottomSheet } from "@/components/bottom-sheet";
import { ChipGroup, SheetSearchField } from "@/components/sheet";
import { GearCard } from "@/components/gear-card";
import { SkeletonList } from "@/components/skeleton";
import { equipmentCategoriesForSport } from "@learn-workbench/shared";
import { fetchEquipment, type EquipmentItem } from "@/lib/equipment";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/** v13 U10：本机收藏的装备（纯本地偏好，不进后端，跨启动保留） */
const FAVORITES_KEY = "equipment-favorites-v1";

/**
 * 装备图库选择器（v11 P1.5）：类别 chips + 搜索 + 白底图网格。
 * 选中后回填型号与商品图，用户不用自己拍照。
 *
 * v13 U10：网格改用统一的 `GearCard`（技法参考 uiverse.io/Smit-Prajapati/funny-sloth-75, MIT：
 * 图片区 + 右上收藏心形角标 + 底部胶囊 + 抬起反馈）；加载态换成 `SkeletonList`。
 * 收藏只做本地可见状态（点了有心形反馈并持久化），不改变选装备的数据流。
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
  const [favorites, setFavorites] = useState<readonly number[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(FAVORITES_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) setFavorites(parsed.filter((v) => typeof v === "number"));
      } catch {
        // 本地偏好损坏：忽略，不影响图库
      }
    })();
  }, []);

  const toggleFavorite = useCallback((id: number) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id];
      void AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

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
      <ChipGroup
        multiple={false}
        options={categories.map((item) => ({ key: item.key, label: item.label }))}
        selected={[category]}
        onToggle={(key) => setCategory(key)}
      />

      <SheetSearchField
        value={query}
        onChangeText={setQuery}
        placeholder="搜型号或品牌，如 ASTROX / 天斧"
        autoCapitalize="characters"
        autoCorrect={false}
      />

      {loading ? (
        <SkeletonList count={3} />
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>图库暂时没有这一类，先自己拍照上传也行</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {items.map((item) => (
            <GearCard
              key={item.id}
              style={styles.cell}
              model={item.model}
              brand={item.brand}
              price={categories.find((c) => c.key === item.category)?.label ?? null}
              imageUrl={item.imageUrl}
              favorited={favorites.includes(item.id)}
              onToggleFavorite={() => toggleFavorite(item.id)}
              onPress={() => {
                onPick(item);
                onClose();
              }}
            />
          ))}
        </View>
      )}
    </View>
  );

  if (inline) return visible ? body : null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="从装备图库选择"
      subtitle="点一张白底图即回填型号与商品图"
      icon="images-outline"
      height="86%"
    >
      {body}
    </BottomSheet>
  );
}

/** 弹层形态（表格外独立使用） */
export const EquipmentPickerSheet = EquipmentPicker;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 12 },

    center: { paddingVertical: 40, alignItems: "center" },
    emptyText: { fontSize: 12, color: colors.textMuted, textAlign: "center" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    cell: { width: "31%" },
  });
