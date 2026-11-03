import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { EmptyState } from "@/components/empty-state";
import { ListGroup } from "@/components/list-row";
import { PressableScale } from "@/components/pressable-scale";
import { ThemedIcon } from "@/components/themed-icon";
import { SectionTitle } from "@/components/v2/section-title";
import { useHeaderTopInset } from "@/components/screen-header";
import { getApiUrl } from "@/config";
import { useLearningTracks } from "@/lib/content-store";
import { setNavPendingParams } from "@/lib/nav-pending";
import {
  HOT_SEARCHES,
  RECENT_SEARCH_KEY,
  buildLearningSearchEntries,
  exam408HitRoute,
  highlightSegments,
  learningEntryRoute,
  normalizeSearchQuery,
  pickExam408Groups,
  pushRecentSearch,
  removeRecentSearch,
  sanitizeRecentSearches,
  searchLearning,
  type Exam408SearchGroup,
  type Exam408SearchResponse,
  type LocalSearchGroup,
  type SearchRoute,
} from "@/lib/search";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * P2-3 · 全局搜索（v1.62）。
 *
 * 两个源：
 * 1) 本地内容库（zustand content-store 的 LearningTrack[]，离线可用）→ 课程 / 主题 / 学习内容；
 * 2) 408 专区接口 GET /api/exam/408/search?q=（精读 + 知识点两组）；失败只降级不阻塞本地结果。
 *
 * 交互：进入自动聚焦 / 250ms 防抖 / 最近搜索（AsyncStorage ≤8，可单删可清空）/ 加载·空·错误态 /
 * 热门搜索（未输入与无结果两处引导）/ 命中词高亮（主题主色 + 加粗，嵌套 Text 实现）/
 * 键盘避让（ScrollView automaticallyAdjustKeyboardInsets + 点结果保持键盘不吞点击）。
 * 逻辑全在 lib/search.ts（纯函数、有单测），本文件只管渲染与跳转。
 */
const DEBOUNCE_MS = 250;
const API_TIMEOUT_MS = 6000;

type RemoteState = {
  status: "idle" | "loading" | "done" | "error";
  groups: Exam408SearchGroup[];
};

export default function GlobalSearchScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tracks = useLearningTracks();
  const entries = useMemo(() => buildLearningSearchEntries(tracks), [tracks]);
  const headerTop = useHeaderTopInset("compact");
  const tabBarSpace = useTabBarSpace();
  const inputRef = useRef<TextInput | null>(null);

  const [input, setInput] = useState("");
  /** 防抖后的实际检索词（空串 = 未搜索，展示最近搜索/引导） */
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [remote, setRemote] = useState<RemoteState>({ status: "idle", groups: [] });
  const [retryKey, setRetryKey] = useState(0);

  // 自动聚焦：autoFocus 在部分 ROM 上会被页面转场吞掉，转场后补一次 focus
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 160);
    return () => clearTimeout(timer);
  }, []);

  // 最近搜索：读盘失败按空列表处理（搜索本身不受影响）
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(RECENT_SEARCH_KEY)
      .then((raw) => {
        if (!alive) return;
        let parsed: unknown = [];
        try {
          parsed = raw ? (JSON.parse(raw) as unknown) : [];
        } catch {
          parsed = [];
        }
        setRecent(sanitizeRecentSearches(parsed));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // 250ms 防抖：连续输入只在停手后检索一次
  useEffect(() => {
    const next = normalizeSearchQuery(input);
    const timer = setTimeout(() => setQuery(next), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const localGroups = useMemo(() => searchLearning(entries, query), [entries, query]);

  // 408 远程搜索：query 变化即取消上一发（AbortController + 6s 超时）
  useEffect(() => {
    const q = query;
    if (!q) return;
    const controller = new AbortController();
    let alive = true;
    const run = async () => {
      // 先过一拍再置 loading：避免在 effect 体里同步 setState（级联渲染）
      await Promise.resolve();
      if (!alive) return;
      setRemote({ status: "loading", groups: [] });
      const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
      try {
        const response = await fetch(
          getApiUrl() + "/api/exam/408/search?q=" + encodeURIComponent(q),
          { signal: controller.signal, headers: { accept: "application/json" } },
        );
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = (await response.json()) as Exam408SearchResponse;
        if (!alive) return;
        setRemote({ status: "done", groups: pickExam408Groups(data) });
      } catch {
        if (!alive) return;
        setRemote({ status: "error", groups: [] });
      } finally {
        clearTimeout(timer);
      }
    };
    void run();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [query, retryKey]);

  const rememberSearch = useCallback((value: string) => {
    setRecent((prev) => {
      const next = pushRecentSearch(prev, value);
      void AsyncStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  /** 提交搜索（键盘回车 / 点最近搜索）：立即生效并写入最近搜索 */
  const commitSearch = useCallback(
    (raw?: string) => {
      const next = normalizeSearchQuery(raw ?? input);
      if (!next) return;
      setInput(next);
      setQuery(next);
      rememberSearch(next);
    },
    [input, rememberSearch],
  );

  const clearRecent = useCallback(() => {
    setRecent([]);
    void AsyncStorage.removeItem(RECENT_SEARCH_KEY).catch(() => {});
  }, []);

  /** 单条删除最近搜索：删空时顺手清掉本地 key，避免残留空数组 */
  const forgetRecent = useCallback((keyword: string) => {
    setRecent((prev) => {
      const next = removeRecentSearch(prev, keyword);
      if (next.length === 0) void AsyncStorage.removeItem(RECENT_SEARCH_KEY).catch(() => {});
      else void AsyncStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  /** 命中跳转：需要场外通道的页面（阅读页 / 408 精读）先写 params，再 push */
  const openRoute = useCallback((route: SearchRoute, keyword: string) => {
    if (keyword) rememberSearch(keyword);
    if (route.navChannel && route.navParams) setNavPendingParams(route.navChannel, route.navParams);
    router.push(route.href as never);
  }, [rememberSearch]);

  const remoteLoading = remote.status === "loading";
  const remoteFailed = remote.status === "error";
  const localEmpty = localGroups.length === 0;
  const remoteEmpty = remote.status === "done" && remote.groups.length === 0;
  const showEmpty = Boolean(query) && localEmpty && remote.status !== "loading" && (remoteEmpty || remoteFailed);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: headerTop }]}>
        <PressableScale
          hitSlop={12}
          scaleTo={0.9}
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="返回"
        >
          <ThemedIcon name="chevron-back" size={20} color={colors.text} />
        </PressableScale>
        <View style={styles.searchBox}>
          <ThemedIcon name="search" size={16} color={colors.textFaint} />
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            placeholder="搜索课程 / 知识点 / 408 内容"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            onSubmitEditing={() => commitSearch()}
            accessibilityLabel="全局搜索输入框"
          />
          {input ? (
            <Pressable
              hitSlop={14}
              onPress={() => {
                setInput("");
                setQuery("");
                inputRef.current?.focus();
              }}
              accessibilityRole="button"
              accessibilityLabel="清空搜索词"
            >
              <ThemedIcon name="close-circle" size={16} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {!query ? (
          <>
            {recent.length > 0 ? (
              <View style={styles.block}>
                <SectionTitle
                  title="最近搜索"
                  style={styles.section}
                  right={
                    <Pressable
                      hitSlop={16}
                      onPress={clearRecent}
                      accessibilityRole="button"
                      accessibilityLabel="清空最近搜索"
                    >
                      <Text style={styles.blockAction}>清空</Text>
                    </Pressable>
                  }
                />
                <View style={styles.chipRow}>
                  {recent.map((item) => (
                    <View key={item} style={styles.recentChip}>
                      <PressableScale
                        hitSlop={6}
                        scaleTo={0.96}
                        style={styles.chipMain}
                        onPress={() => commitSearch(item)}
                        accessibilityRole="button"
                        accessibilityLabel={"搜索 " + item}
                      >
                        <Text style={styles.chipText} numberOfLines={1}>
                          {item}
                        </Text>
                      </PressableScale>
                      <Pressable
                        hitSlop={12}
                        onPress={() => forgetRecent(item)}
                        accessibilityRole="button"
                        accessibilityLabel={"删除 最近搜索 " + item}
                        style={styles.chipRemove}
                      >
                        <ThemedIcon name="close" size={14} color={colors.textFaint} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            <View style={styles.block}>
              <SectionTitle title="搜点什么" style={styles.section} />
              <Text style={styles.hintText}>
                课程 / 主题 / 学习内容来自本机内容库，离线也能搜；408 精读与知识点来自专区搜索接口，
                断网时只显示本地结果，不影响阅读与刷题。
              </Text>
            </View>
            <HotSearches onPress={commitSearch} />
          </>
        ) : (
          <>
            {localGroups.map((group) => (
              <LocalGroup
                key={group.group}
                group={group}
                keyword={query}
                onPress={(hit) => openRoute(learningEntryRoute(hit), query)}
              />
            ))}

            {remoteLoading && localEmpty ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>正在搜索 408 专区…</Text>
              </View>
            ) : null}

            {remoteFailed ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>408 搜索暂时不可用，已显示本地结果。</Text>
                <Pressable hitSlop={16} onPress={() => setRetryKey((value) => value + 1)} accessibilityRole="button" accessibilityLabel="重试 408 搜索">
                  <Text style={styles.blockAction}>重试</Text>
                </Pressable>
              </View>
            ) : null}

            {remote.groups.map((group) => (
              <RemoteGroup
                key={group.kind}
                group={group}
                keyword={query}
                onPress={(hit) => openRoute(exam408HitRoute(hit), query)}
              />
            ))}

            {showEmpty ? (
              <>
                <EmptyState
                  icon="search-outline"
                  title="没有找到相关内容"
                  hint="换个关键词试试，或者点下面的热门搜索。"
                />
                <HotSearches onPress={commitSearch} />
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function LocalGroup({
  group,
  keyword,
  onPress,
}: {
  group: LocalSearchGroup;
  keyword: string;
  onPress: (hit: LocalSearchGroup["hits"][number]) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.block}>
      <SectionTitle
        title={group.label}
        style={styles.section}
        right={
          <Text style={styles.blockCount} numberOfLines={1}>
            {group.total} 条 · 「{keyword}」
          </Text>
        }
      />
      <ListGroup>
        {group.hits.map((hit, index) => (
          <PressableScale
            key={hit.key}
            hitSlop={2}
            scaleTo={1}
            pressedStyle={styles.hitPressed}
            style={styles.hit}
            onPress={() => onPress(hit)}
            accessibilityRole="button"
            accessibilityLabel={group.label + "：" + hit.title}
          >
            <View style={styles.hitBody}>
              <HighlightedText
                text={hit.title}
                keyword={keyword}
                style={styles.hitTitle}
                highlightStyle={styles.hitHighlight}
                numberOfLines={1}
              />
              {hit.snippet ? (
                <HighlightedText
                  text={hit.snippet}
                  keyword={keyword}
                  style={styles.hitSnippet}
                  highlightStyle={styles.hitHighlight}
                  numberOfLines={2}
                />
              ) : null}
              <Text style={styles.hitMeta} numberOfLines={1}>
                {hit.meta}
              </Text>
            </View>
            <ThemedIcon name="chevron-forward" size={15} color={colors.textFaint} />
            {index < group.hits.length - 1 ? (
              <View pointerEvents="none" style={styles.hitDivider} />
            ) : null}
          </PressableScale>
        ))}
      </ListGroup>
    </View>
  );
}

function RemoteGroup({
  group,
  keyword,
  onPress,
}: {
  group: Exam408SearchGroup;
  keyword: string;
  onPress: (hit: Exam408SearchGroup["hits"][number]) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.block}>
      <SectionTitle
        title={group.label}
        style={styles.section}
        right={
          <Text style={styles.blockCount} numberOfLines={1}>
            {group.total} 条 · 「{keyword}」
          </Text>
        }
      />
      <ListGroup>
        {group.hits.map((hit, index) => (
          <PressableScale
            key={hit.kind + ":" + hit.key}
            hitSlop={2}
            scaleTo={1}
            pressedStyle={styles.hitPressed}
            style={styles.hit}
            onPress={() => onPress(hit)}
            accessibilityRole="button"
            accessibilityLabel={group.label + "：" + hit.title}
          >
            <View style={styles.hitBody}>
              <HighlightedText
                text={hit.title}
                keyword={keyword}
                style={styles.hitTitle}
                highlightStyle={styles.hitHighlight}
                numberOfLines={1}
              />
              {hit.snippet ? (
                <HighlightedText
                  text={hit.snippet}
                  keyword={keyword}
                  style={styles.hitSnippet}
                  highlightStyle={styles.hitHighlight}
                  numberOfLines={2}
                />
              ) : null}
              <Text style={styles.hitMeta} numberOfLines={1}>
                {hit.meta}
              </Text>
            </View>
            <ThemedIcon name="chevron-forward" size={15} color={colors.textFaint} />
            {index < group.hits.length - 1 ? (
              <View pointerEvents="none" style={styles.hitDivider} />
            ) : null}
          </PressableScale>
        ))}
      </ListGroup>
    </View>
  );
}

/**
 * 命中词高亮：把 highlightSegments 的命中片段渲染成嵌套 Text（主题主色 + 加粗），
 * 不引第三方富文本库；没有命中时退化为普通 Text，少一层嵌套。
 */
function HighlightedText({
  text,
  keyword,
  style,
  highlightStyle,
  numberOfLines,
}: {
  text: string;
  keyword: string;
  style: StyleProp<TextStyle>;
  highlightStyle: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const segments = useMemo(() => highlightSegments(text, keyword), [text, keyword]);
  const matched = segments.some((segment) => segment.match);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {matched
        ? segments.map((segment, index) => (
            <Text key={"hl-" + index} style={segment.match ? highlightStyle : undefined}>
              {segment.text}
            </Text>
          ))
        : text}
    </Text>
  );
}

/** 热门搜索 chips：未输入与无结果两处共用，点击直接触发搜索。 */
function HotSearches({ onPress }: { onPress: (word: string) => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.block}>
      <SectionTitle title="热门搜索" style={styles.section} />
      <View style={styles.chipRow}>
        {HOT_SEARCHES.map((word) => (
          <PressableScale
            key={word}
            hitSlop={6}
            scaleTo={0.96}
            style={styles.chip}
            onPress={() => onPress(word)}
            accessibilityRole="button"
            accessibilityLabel={"搜索热门词 " + word}
          >
            <Text style={styles.chipText} numberOfLines={1}>
              {word}
            </Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: colors.canvas,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    searchBox: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 40,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    input: { ...typography.body, flex: 1, minWidth: 0, color: colors.text, padding: 0 },
    scroll: { flex: 1 },
    content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.xs },
    block: { gap: spacing.sm },
    /* 区块标题：沿用 career/settings 的页内节奏（SectionTitle 默认上下留白偏大，这里收紧） */
    section: { marginTop: spacing.md, marginBottom: 0 },
    blockCount: { ...typography.meta, color: colors.textMuted, flexShrink: 1 },
    blockAction: { ...typography.caption, fontWeight: "700", color: colors.primary },
    hintText: { ...typography.meta, color: colors.textSecondary, lineHeight: 20 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    /* 热门词 chips：v2 胶囊（surfaceMuted 底 + radius.pill，不描边，跟卡片区分开） */
    chip: {
      maxWidth: "48%",
      minHeight: 36,
      justifyContent: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipText: { ...typography.caption, fontWeight: "600", color: colors.textSecondary, flexShrink: 1 },
    recentChip: {
      maxWidth: "48%",
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    // 主命中区铺满 chip 左侧（含左内边距），右侧「×」单独一个热区
    chipMain: { flexShrink: 1, minWidth: 0, alignSelf: "stretch", justifyContent: "center", paddingLeft: spacing.md },
    chipRemove: {
      minWidth: 28,
      minHeight: 28,
      marginLeft: spacing.xs,
      marginRight: spacing.xs,
      alignItems: "center",
      justifyContent: "center",
    },
    /* 命中行：统一列表行质感（ListGroup 包卡，行内 58 高 + 发丝分隔线 + 按压整行变色） */
    hit: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
    },
    hitPressed: { backgroundColor: colors.surfaceMuted },
    hitDivider: {
      position: "absolute",
      left: 14,
      right: 0,
      bottom: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    hitBody: { flex: 1, minWidth: 0, gap: 3 },
    hitTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    hitSnippet: { ...typography.caption, fontWeight: "400", color: colors.textSecondary, lineHeight: 18 },
    hitHighlight: { color: colors.primary, fontWeight: "800" },
    hitMeta: { ...typography.meta, color: colors.textMuted },
    loadingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
    loadingText: { ...typography.meta, color: colors.textMuted },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
      borderRadius: radius.control,
      backgroundColor: colors.warningSoft,
    },
    errorText: { ...typography.meta, color: colors.warning, flex: 1 },
  });
