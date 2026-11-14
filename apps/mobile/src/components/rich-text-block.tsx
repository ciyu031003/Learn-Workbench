import { useMemo } from "react";
import { View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { QuestionBlocks } from "@/components/question-blocks";
import { RichText } from "@/components/rich-text";

/**
 * 自适应富文本（v2.6.10 学习模块渲染审计）。
 *
 * 单行文本走 RichText（行内粗体 / 代码 / 公式），
 * 只有出现换行、标题、列表、表格或围栏代码块时才切到块级渲染，
 * 避免知识点正文里的 `#`、`- `、``` 等标记原样露出，同时不改变普通段落的排版节奏。
 */
const BLOCK_MARK = /(^|\n)\s{0,3}(#{1,6}\s|```|~~~|\||[-*+]\s|\d+[.)]\s)/;

export function isBlockRichText(text: string): boolean {
  const source = String(text ?? "").trim();
  if (!source) return false;
  return /[\r\n]/.test(source) || BLOCK_MARK.test(source);
}

export function RichTextBlock({
  text,
  style,
  numberOfLines,
  containerStyle,
  compact = false,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  /** 只在单行预览场景使用；传入后强制走 RichText 以便截断 */
  numberOfLines?: number;
  containerStyle?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const block = useMemo(() => (numberOfLines === undefined ? isBlockRichText(text) : false), [text, numberOfLines]);
  if (!block) {
    return <RichText text={text} style={style} numberOfLines={numberOfLines} />;
  }
  return (
    <View style={containerStyle}>
      <QuestionBlocks text={text} style={style} compact={compact} />
    </View>
  );
}
