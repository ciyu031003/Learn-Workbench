import { describe, expect, it } from "vitest";
import {
  buildStudyToc,
  chapterSheetVisibleWithoutSnapshot,
  chunkInlineText,
  normalizeApiStudyBlocks,
  normalizeStudySegments,
  exam408StudyImportanceLabel,
  exam408StudySubjectTitle,
  normalizeStudyDetail,
  normalizeStudyList,
  parseStudyInline,
  parseStudyMarkdown,
  parseStudySegments,
  resolveStudyAssetUrl,
  sanitizeStudyInlineHtml,
  studyImageKind,
  studyPlainText,
  studyTableColumnWidths,
} from "./exam-408-study";

/**
 * 408 精读数据层单测（v1.55）：Markdown 方言 → 结构块、接口归一化、目录与资源路径。
 * 用例取自 cs408 快照（.local/cs408-snapshot.json）的真实写法，覆盖 181 篇里出现过的
 * 全部块类型：标题 / 段落 / 列表（含二级缩进）/ 表格 / 代码块 / 引用块 / 插图 /
 * 独立公式 / iframe 知识图谱 / 分隔线。
 */

describe("parseStudyInline", () => {
  it("切出行内代码、加粗、$…$ 公式与纯文本", () => {
    const tokens = parseStudyInline("**抽象数据类型**指 " + "`ADT`" + "，复杂度 $O(n 的平方)$，纯文本");
    expect(tokens.map((token) => token.type)).toEqual(["strong", "text", "code", "text", "math", "text"]);
    expect(tokens[0]).toEqual({ type: "strong", value: "抽象数据类型" });
    expect(tokens[2]).toEqual({ type: "code", value: "ADT" });
    expect(tokens[4]).toEqual({ type: "math", value: "O(n 的平方)" });
  });

  it("长公式也按公式切（放宽到 300 字符）", () => {
    const long = "$T(n) = 2T(n/2) + O(n) = O(n\\log n)$";
    const tokens = parseStudyInline("归并排序 " + long + " 的结论");
    expect(tokens.some((token) => token.type === "math")).toBe(true);
  });

  it("纯数字金额不误判成公式", () => {
    const tokens = parseStudyInline("只要 $5 就能跑");
    expect(tokens.every((token) => token.type === "text")).toBe(true);
  });

  it("LaTeX 行内定界符也识别", () => {
    const tokens = parseStudyInline("时间复杂度 \\(O(n)\\) 之后");
    expect(tokens[1]).toEqual({ type: "math", value: "O(n)" });
  });

  it("粗体里的行内代码/公式摊平成同级段（v2.2）", () => {
    const tokens = parseStudyInline("**复杂度 `O(n)` 是 $\\Theta(1)$**");
    expect(tokens.map((token) => token.type)).toEqual(["strong", "code", "strong", "math"]);
    expect(tokens.map((token) => token.value).join("")).toBe("复杂度 O(n) 是 \\Theta(1)");
  });

  it("粗体跨两个行内公式也能闭合（cs408 真实写法）", () => {
    const tokens = parseStudyInline("**别把 $n/2$ 与 $(n-1)/2$ 记混**");
    expect(tokens.map((token) => token.type)).toEqual(["strong", "math", "strong", "math", "strong"]);
    expect(tokens[0]).toEqual({ type: "strong", value: "别把 " });
    expect(tokens[2]).toEqual({ type: "strong", value: " 与 " });
    expect(tokens[4]).toEqual({ type: "strong", value: " 记混" });
  });

  it("纯数字 $…$ 当字面量整段跳过，不让后面的 $ 错位吞掉加粗", () => {
    const tokens = parseStudyInline(
      "商位 $1,1,0,1$，即 **商 $=0.1101$**；另 **步数固定（$n$ 次移位 + $n+1$ 次加减）**。",
    );
    expect(tokens.some((token) => token.type === "strong")).toBe(true);
    expect(tokens.some((token) => token.type === "math")).toBe(true);
    const text = tokens
      .filter((token) => token.type === "text" || token.type === "strong" || token.type === "code")
      .map((token) => token.value)
      .join("");
    expect(text).not.toContain("**");
    expect(text).not.toContain("$");
  });

  it("****粗体**** 按星号串配对，不影响后续正常粗体（cs408 真实写法）", () => {
    const tokens = parseStudyInline("构建 ****最小物理单位****，再构建 **逻辑结构**。");
    expect(tokens).toEqual([
      { type: "text", value: "构建 " },
      { type: "strong", value: "最小物理单位" },
      { type: "text", value: "，再构建 " },
      { type: "strong", value: "逻辑结构" },
      { type: "text", value: "。" },
    ]);
  });

  it("无配对的 3+ 星号串被丢弃（畸形加粗不再露出 ****）", () => {
    const tokens = parseStudyInline("1. **初始化一个 **操作数栈****：");
    const text = tokens
      .filter((token) => token.type === "text" || token.type === "strong")
      .map((token) => token.value)
      .join("");
    expect(text).toBe("1. 初始化一个 操作数栈：");
    expect(text).not.toContain("*");
  });

  it("未配对的 ** 原样保留为文本，不吞掉后续内容", () => {
    expect(parseStudyInline("**没有闭合的加粗")).toEqual([{ type: "text", value: "**没有闭合的加粗" }]);
    expect(parseStudyInline("")).toEqual([]);
    expect(parseStudyInline("普通文本")).toEqual([{ type: "text", value: "普通文本" }]);
  });
});

describe("sanitizeStudyInlineHtml", () => {
  it("剥白名单标签但保留数学记号里的尖括号", () => {
    expect(sanitizeStudyInlineHtml("<sup>2</sup> 的 <reg> 与 <i,j> 记法")).toBe("2 的 <reg> 与 <i,j> 记法");
  });

  it("br 变空格、img 丢弃", () => {
    expect(sanitizeStudyInlineHtml("第一行<br/>第二行")).toBe("第一行 第二行");
    expect(sanitizeStudyInlineHtml('前 <img src="/a.svg"> 后')).toBe("前 后");
  });
});

describe("studyTableColumnWidths（表格列宽固定）", () => {
  it("表头与数据行按同一列取最长内容，宽度一致且有上下限", () => {
    const widths = studyTableColumnWidths(
      ["空间复杂度", "描述", "示例"],
      [
        ["O(1)", "只用一个额外变量保存中间值", "int tmp = a; a = b; b = tmp;"],
        ["O(n)", "额外数组", "[1, 2, 3]"],
      ],
      3,
    );
    expect(widths).toHaveLength(3);
    widths.forEach((width) => {
      expect(width).toBeGreaterThanOrEqual(92);
      expect(width).toBeLessThanOrEqual(236);
    });
    // 描述/示例列的内容比表头长 → 宽度应大于表头列（空间复杂度）
    expect(widths[1]).toBeGreaterThan(widths[0]);
    expect(widths[2]).toBeGreaterThanOrEqual(widths[0]);
  });

  it("列数多于表头时补默认宽度；空表也返回一列", () => {
    const widths = studyTableColumnWidths(["A"], [["1", "2"]], 2);
    expect(widths).toHaveLength(2);
    expect(studyTableColumnWidths([], [], 1)).toHaveLength(1);
  });

  it("CJK 字符按 2 个半角宽估算，超长内容封顶", () => {
    const narrow = studyTableColumnWidths(["ababab"], [["cdcdcd"]], 1)[0];
    const wide = studyTableColumnWidths(["中文中文中文"], [["中文中文"]], 1)[0];
    expect(wide).toBeGreaterThan(narrow);
    const long = studyTableColumnWidths(["描述"], [["一".repeat(200)]], 1)[0];
    expect(long).toBe(236);
  });
});

describe("parseStudyMarkdown", () => {
  it("解析标题、段落与列表，标题分配顺序锚点", () => {
    const blocks = parseStudyMarkdown(["# 绪论 · 知识图谱", "", "第一行说明", "第二行说明", "", "- 条目一", "- 条目二", ""].join("\n"));
    expect(blocks[0]).toMatchObject({ type: "heading", level: 1, text: "绪论 · 知识图谱", id: "study-h-1" });
    expect(blocks[1].type).toBe("paragraph");
    if (blocks[1].type === "paragraph") {
      expect(blocks[1].inlines.map((inline) => inline.value).join("")).toBe("第一行说明 第二行说明");
    }
    expect(blocks[2]).toMatchObject({ type: "list", ordered: false });
    if (blocks[2].type === "list") expect(blocks[2].items).toHaveLength(2);
  });

  it("有序列表与二级缩进深度", () => {
    const blocks = parseStudyMarkdown(["1. 顺序存储", "2. 链式存储", "  - 双向链表", "  - 循环链表"].join("\n"));
    expect(blocks[0].type).toBe("list");
    if (blocks[0].type === "list") {
      expect(blocks[0].ordered).toBe(true);
      expect(blocks[0].items.map((item) => item.depth)).toEqual([0, 0]);
    }
    // 顶层有序列表后来一条二级无序项：类型切换会另起列表（保持渲染语义简单）
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  it("表格：表头 + 分隔行 + 多行单元格（含转义竖线）", () => {
    const md = ["| 逻辑结构 | 关系 |", "|---|---|", "| 线性结构 | 一对一 |", "| 图状结构 | 多对多 \\| 网状 |"].join("\n");
    const blocks = parseStudyMarkdown(md);
    expect(blocks).toHaveLength(1);
    if (blocks[0].type === "table") {
      expect(blocks[0].header.map((cell) => cell.map((inline) => inline.value).join(""))).toEqual(["逻辑结构", "关系"]);
      expect(blocks[0].rows).toHaveLength(2);
      expect(blocks[0].rows[1][1].map((inline) => inline.value).join("")).toBe("多对多 | 网状");
    }
  });

  it("围栏代码块保留语言与内容，反引号数量更多也能闭合", () => {
    const blocks = parseStudyMarkdown(["```c", "int sum = 0;", "```", "后续段落"].join("\n"));
    expect(blocks[0]).toMatchObject({ type: "code", lang: "c", code: "int sum = 0;" });
    expect(blocks[1].type).toBe("paragraph");
  });

  it("引用块合并多行", () => {
    const blocks = parseStudyMarkdown(["> **补充考点**", "> 正文之外的补充细节", "> 导读：ADT 与复杂度"].join("\n"));
    expect(blocks[0].type).toBe("quote");
    if (blocks[0].type === "quote") {
      expect(blocks[0].lines).toHaveLength(3);
      expect(blocks[0].lines[0][0]).toEqual({ type: "strong", value: "补充考点" });
    }
  });

  it("独立成行的 Markdown 图片与 img 标签图片", () => {
    const blocks = parseStudyMarkdown(
      ['![图示](/content-images/cs408/stack-1.svg "栈")', '<img src="/book-figs/co/o-div-flow-3-9.png" alt="除法流程">'].join("\n"),
    );
    expect(blocks[0]).toEqual({ type: "image", alt: "图示", src: "/content-images/cs408/stack-1.svg" });
    expect(blocks[1]).toEqual({ type: "image", alt: "除法流程", src: "/book-figs/co/o-div-flow-3-9.png" });
  });

  it("独立公式：单行与块状", () => {
    const blocks = parseStudyMarkdown(["$$O(n) < O(n\\log n)$$", "", "$$", "T(n) = 2T(n-1) + 1", "$$"].join("\n"));
    expect(blocks[0]).toEqual({ type: "math", tex: "O(n) < O(n\\log n)" });
    expect(blocks[1]).toEqual({ type: "math", tex: "T(n) = 2T(n-1) + 1" });
  });

  it("iframe 知识图谱降级为提示块，后续内容不丢", () => {
    const md = ['<iframe src="/interactive/knowledge-map.html?data=x" title="绪论 知识图谱"></iframe>', "", "## 一、抽象数据类型"].join("\n");
    const blocks = parseStudyMarkdown(md);
    expect(blocks[0]).toMatchObject({ type: "embed", title: "绪论 知识图谱" });
    expect(blocks[1]).toMatchObject({ type: "heading", level: 2, text: "一、抽象数据类型" });
  });

  it("分隔线与空输入", () => {
    expect(parseStudyMarkdown("---")).toEqual([{ type: "divider" }]);
    expect(parseStudyMarkdown("")).toEqual([]);
    expect(parseStudyMarkdown("   \n\n ")).toEqual([]);
  });

  it("CRLF 与 BOM 归一化", () => {
    const blocks = parseStudyMarkdown("\uFEFF## 标题\r\n\r\n正文");
    expect(blocks[0]).toMatchObject({ type: "heading", text: "标题" });
    expect(blocks[1].type).toBe("paragraph");
  });
});

describe("buildStudyToc", () => {
  it("目录文本剥掉行内标记（标题里的公式与反引号）", () => {
    const blocks = parseStudyMarkdown("## 5.5 平方根量级：`i * i <= n` 到 $O(\\sqrt n)$");
    const toc = buildStudyToc(blocks);
    expect(toc[0]?.text).toBe("5.5 平方根量级：i * i <= n 到 O(\\sqrt n)");
    expect(studyPlainText("**粗** `码` $O(n)$")).toBe("粗 码 O(n)");
  });

  it("优先取 2~3 级标题，没有时回落到全部标题", () => {
    const withSub = parseStudyMarkdown(["# 总标题", "## 一、概念", "### 1.1 定义", "#### 细节"].join("\n"));
    expect(buildStudyToc(withSub)).toEqual([
      { id: "study-h-2", level: 2, text: "一、概念" },
      { id: "study-h-3", level: 3, text: "1.1 定义" },
    ]);
    const onlyTop = parseStudyMarkdown("# 只有一级");
    expect(buildStudyToc(onlyTop)).toHaveLength(1);
  });
});

describe("资源与类型工具", () => {
  it("SVG 与位图分流", () => {
    expect(studyImageKind("/content-images/cs408/a.svg")).toBe("svg");
    expect(studyImageKind("/content-images/cs408/a.SVG?v=2")).toBe("svg");
    expect(studyImageKind("/book-figs/co/a.png")).toBe("raster");
    expect(studyImageKind("")).toBe("raster");
  });

  it("相对路径拼到 API 基址，绝对地址与 data URI 不动", () => {
    expect(resolveStudyAssetUrl("/content-images/a.svg", "https://x.cn/")).toBe("https://x.cn/content-images/a.svg");
    expect(resolveStudyAssetUrl("content-images/a.svg", "https://x.cn")).toBe("https://x.cn/content-images/a.svg");
    expect(resolveStudyAssetUrl("https://cdn/a.svg", "https://x.cn")).toBe("https://cdn/a.svg");
    expect(resolveStudyAssetUrl("", "https://x.cn")).toBe("");
  });

  it("重要度与科目文案", () => {
    expect(exam408StudyImportanceLabel("must")).toBe("必考");
    expect(exam408StudyImportanceLabel("rare")).toBe("冷门");
    expect(exam408StudyImportanceLabel("none")).toBe("未考");
    expect(exam408StudyImportanceLabel("common")).toBe("常考");
    expect(exam408StudySubjectTitle("operating-system")).toBe("操作系统");
    expect(exam408StudySubjectTitle("unknown")).toBe("unknown");
  });
});

describe("接口归一化", () => {
  const article = {
    key: "id-1",
    title: "数据结构基本概念",
    subjectKey: "data-structure",
    chapter: "绪论",
    chapterOrder: 1010,
    slug: "data-structure-basic-ds",
    importance: "common",
    examFrequency: 2,
  };

  it("列表支持数组 / articles / items / data.articles 四种形态", () => {
    for (const payload of [[article], { articles: [article] }, { items: [article] }, { data: { articles: [article] } }]) {
      const catalog = normalizeStudyList(payload, "data-structure");
      expect(catalog.total).toBe(1);
      expect(catalog.chapters[0].chapter).toBe("绪论");
    }
  });

  it("按 chapterOrder 分组排序，缺 slug 的条目丢弃", () => {
    const payload = {
      articles: [
        { ...article, slug: "b", chapter: "线性表", chapterOrder: 1020 },
        { ...article, slug: "a", chapter: "绪论", chapterOrder: 1010 },
        { ...article, slug: "", chapter: "绪论", chapterOrder: 1010 },
      ],
    };
    const catalog = normalizeStudyList(payload, "data-structure");
    expect(catalog.total).toBe(2);
    expect(catalog.chapters.map((chapter) => chapter.chapter)).toEqual(["绪论", "线性表"]);
    expect(catalog.chapters[0].articles[0].slug).toBe("a");
  });

  it("兼容 snake_case 字段与缺省章节", () => {
    const catalog = normalizeStudyList(
      [{ key: "k", title: "T", subject_key: "computer-network", chapter_order: 2, slug: "s", exam_frequency: "3" }],
      "computer-network",
    );
    expect(catalog.chapters[0].chapter).toBe("未分章");
    expect(catalog.chapters[0].articles[0]).toMatchObject({ chapterOrder: 2, examFrequency: 3, subjectKey: "computer-network" });
  });

  it("详情含 prev/next，缺省为 null", () => {
    const detail = normalizeStudyDetail({
      article: { ...article, contentMd: "# 标题", sourceUrl: "https://cs408.cloud/study?topic=x" },
      prev: { slug: "p", title: "上一篇" },
      next: null,
    });
    expect(detail.article.contentMd).toBe("# 标题");
    expect(detail.article.sourceUrl).toContain("cs408.cloud");
    expect(detail.prev).toEqual({ slug: "p", title: "上一篇", chapter: undefined });
    expect(detail.next).toBeNull();
  });

  it("详情容错：只有 article 时 prev/next 为 null，缺内容为空串", () => {
    const detail = normalizeStudyDetail({ article: { key: "k", title: "T", slug: "s" } });
    expect(detail.article.contentMd).toBe("");
    expect(detail.article.sourceUrl).toBeNull();
    expect(detail.prev).toBeNull();
    expect(detail.next).toBeNull();
  });
});

describe("服务端公式段（P7 / format=svg）", () => {
  it("text 段会再切一次：**粗体** 跨公式、粗体套代码都不漏符号", () => {
    const segments = normalizeStudySegments([
      { type: "text", text: "**别把 " },
      { type: "math", tex: "n/2", svg: '<svg viewBox="0 0 1 1"></svg>' },
      { type: "text", text: " 与 " },
      { type: "math", tex: "(n-1)/2", svg: "not-a-svg" },
      { type: "text", text: " 记混**，另见 `int a[N]`" },
    ]);
    expect(segments.map((segment) => segment.type)).toEqual([
      "strong",
      "math",
      "strong",
      "math",
      "strong",
      "text",
      "code",
    ]);
    expect(segments[0]).toEqual({ type: "strong", value: "别把 " });
    expect(segments[1]).toEqual({ type: "math", tex: "n/2", svg: '<svg viewBox="0 0 1 1"></svg>' });
    // 非法 svg → null；tex 仍保留（渲染方回退等宽 LaTeX）
    expect(segments[3]).toEqual({ type: "math", tex: "(n-1)/2", svg: null });
    expect(segments[4]).toEqual({ type: "strong", value: " 记混" });
    expect(segments[6]).toEqual({ type: "code", value: "int a[N]" });
    // 渲染段里不允许再残留 markdown 字面量
    const plain = segments
      .filter((segment): segment is { type: "text"; text: string } => segment.type === "text")
      .map((segment) => segment.text)
      .join("");
    expect(plain).not.toContain("**");
    expect(plain).not.toContain("`");
  });

  it("丢弃空段、非法输入与非法 svg 值归 null", () => {
    const segments = normalizeStudySegments([
      { type: "text", text: "复杂度 " },
      { type: "math", tex: "O(n^2)", svg: '<svg viewBox="0 0 1 1"></svg>' },
      { type: "math", tex: "O(1)", svg: "not-a-svg" },
      { type: "math", tex: "" },
      { type: "text", text: "" },
    ]);
    expect(segments).toEqual([
      { type: "text", text: "复杂度 " },
      { type: "math", tex: "O(n^2)", svg: '<svg viewBox="0 0 1 1"></svg>' },
      { type: "math", tex: "O(1)", svg: null },
    ]);
    expect(normalizeStudySegments(null)).toEqual([]);
    expect(normalizeStudySegments("x")).toEqual([]);
  });

  it("parseStudySegments 按 tex 把 svg 挂回公式（匹配不到时按顺序兜底）", () => {
    const svgA = '<svg viewBox="0 0 1 1"></svg>';
    const svgB = '<svg viewBox="0 0 2 2"></svg>';
    const segments = parseStudySegments("已知 $O(n)$ 与 $O(1)$，稍后 $O(\\log n)$", [
      { type: "math", tex: "O(n)", svg: svgA },
      { type: "math", tex: "O(1)", svg: svgB },
    ]);
    expect(segments[1]).toEqual({ type: "math", tex: "O(n)", svg: svgA });
    expect(segments[3]).toEqual({ type: "math", tex: "O(1)", svg: svgB });
    // 队列里没有的公式：svg 为 null，但仍是 math 段（不是字面量 $…$）
    expect(segments[5]).toEqual({ type: "math", tex: "O(\\log n)", svg: null });
  });

  it("normalizeApiStudyBlocks 把服务端 blocks 转成 App 结构块", () => {
    const blocks = normalizeApiStudyBlocks([
      { type: "heading", id: "h-1", level: 2, text: "一、复杂度" },
      {
        type: "paragraph",
        lines: ["已知 $O(n)$ 与 $O(1)$"],
        segments: [
          { type: "text", text: "已知 " },
          { type: "math", tex: "O(n)", svg: '<svg viewBox="0 0 10 10"></svg>' },
          { type: "text", text: " 与 " },
          { type: "math", tex: "O(1)", svg: null },
        ],
      },
      { type: "math", tex: "T(n)=2T(n/2)+n", svg: '<svg viewBox="0 0 20 20"></svg>' },
      { type: "list", ordered: true, items: [{ text: "均摊 $O(1)$", depth: 1, segments: [{ type: "math", tex: "O(1)", svg: null }] }] },
      {
        type: "table",
        header: ["结构", "复杂度"],
        rows: [["顺序表", "$O(1)$"]],
        headerSegments: [[{ type: "text", text: "结构" }], [{ type: "text", text: "复杂度" }]],
        rowSegments: [[[{ type: "text", text: "顺序表" }], [{ type: "math", tex: "O(1)", svg: null }]]],
      },
      { type: "quote", lines: ["最坏 $O(n^2)$"], segments: [{ type: "math", tex: "O(n^2)", svg: null }] },
      { type: "code", lang: "c", code: "int x;" },
      { type: "image", src: "/content-images/cs408/a.svg", alt: "图" },
      { type: "iframe", src: "/interactive/knowledge-map.html?x=1", title: "图谱" },
      { type: "divider" },
      { type: "unknown-type" },
    ]);

    expect(blocks[0]).toMatchObject({ type: "heading", level: 2, text: "一、复杂度", id: "h-1" });
    expect(blocks[1]).toMatchObject({ type: "paragraph" });
    if (blocks[1].type === "paragraph") {
      expect(blocks[1].segments).toHaveLength(4);
      expect(blocks[1].segments?.[1]).toMatchObject({ type: "math", tex: "O(n)" });
      expect(blocks[1].inlines.some((inline) => inline.type === "math")).toBe(true);
    }
    expect(blocks[2]).toMatchObject({ type: "math", tex: "T(n)=2T(n/2)+n" });
    if (blocks[2].type === "math") expect(blocks[2].svg).toContain("<svg");
    expect(blocks[3]).toMatchObject({ type: "list", ordered: true });
    if (blocks[3].type === "list") {
      expect(blocks[3].items[0].depth).toBe(1);
      expect(blocks[3].items[0].segments).toHaveLength(1);
    }
    expect(blocks[4]).toMatchObject({ type: "table" });
    if (blocks[4].type === "table") {
      expect(blocks[4].headerSegments?.[1]).toEqual([{ type: "text", text: "复杂度" }]);
      expect(blocks[4].rowSegments?.[0]?.[1]).toEqual([{ type: "math", tex: "O(1)", svg: null }]);
    }
    expect(blocks[5]).toMatchObject({ type: "quote" });
    if (blocks[5].type === "quote") {
      // 每行独立切分：第 1 行是「最坏 」+ 公式，而不是整块引用
      expect(blocks[5].lineSegments?.[0]?.map((segment) => segment.type)).toEqual(["text", "math"]);
      expect(blocks[5].lineSegments).toHaveLength(1);
    }
    expect(blocks[6]).toMatchObject({ type: "code", lang: "c" });
    expect(blocks[7]).toMatchObject({ type: "image" });
    expect(blocks[8]).toMatchObject({ type: "embed", title: "图谱" });
    expect(blocks[9]).toMatchObject({ type: "divider" });
    expect(blocks).toHaveLength(10);
    expect(normalizeApiStudyBlocks(undefined)).toEqual([]);
  });

  it("表格表头/单元格里的粗体与公式按段渲染（不再出现 ** 与 $）", () => {
    const blocks = normalizeApiStudyBlocks([
      {
        type: "table",
        header: ["**结构**", "复杂度"],
        rows: [["**顺序表**", "$O(1)$"]],
        headerSegments: [[{ type: "text", text: "**结构**" }], [{ type: "text", text: "复杂度" }]],
        rowSegments: [[[{ type: "text", text: "**顺序表**" }], [{ type: "math", tex: "O(1)", svg: null }]]],
      },
    ]);
    expect(blocks[0].type).toBe("table");
    if (blocks[0].type === "table") {
      expect(blocks[0].headerSegments?.[0]).toEqual([{ type: "strong", value: "结构" }]);
      expect(blocks[0].rowSegments?.[0]?.[0]).toEqual([{ type: "strong", value: "顺序表" }]);
      expect(blocks[0].rowSegments?.[0]?.[1]).toEqual([{ type: "math", tex: "O(1)", svg: null }]);
    }
  });

  it("引用块按行切 segments：不重复整段文本，行内粗体/公式成型", () => {
    const blocks = normalizeApiStudyBlocks([
      {
        type: "quote",
        lines: ["最坏 $O(n^2)$", "**最好** $O(n)$"],
        segments: [
          { type: "text", text: "最坏 " },
          { type: "math", tex: "O(n^2)", svg: null },
          { type: "text", text: " **最好** " },
          { type: "math", tex: "O(n)", svg: null },
        ],
      },
    ]);
    expect(blocks[0].type).toBe("quote");
    if (blocks[0].type === "quote") {
      expect(blocks[0].lineSegments).toHaveLength(2);
      const first = blocks[0].lineSegments?.[0] ?? [];
      expect(first.map((segment) => segment.type)).toEqual(["text", "math"]);
      // 旧实现把整块引用塞进第 1 行（后续行再各渲染一次 → 正文重复）
      expect(
        first
          .filter((segment): segment is { type: "text"; text: string } => segment.type === "text")
          .map((segment) => segment.text)
          .join(""),
      ).toBe("最坏 ");
      const second = blocks[0].lineSegments?.[1] ?? [];
      expect(second.map((segment) => segment.type)).toEqual(["strong", "text", "math"]);
    }
  });

  it("chunkInlineText 给折行留机会，空串返回空数组", () => {
    expect(chunkInlineText("一二三四五六七八九十", 4)).toEqual(["一二三四", "五六七八", "九十"]);
    expect(chunkInlineText("abc", 10)).toEqual(["abc"]);
    expect(chunkInlineText("")).toEqual([]);
  });

  it("normalizeStudyDetail 携带服务端 blocks（缺省为空数组）", () => {
    const detail = normalizeStudyDetail({
      topic: { key: "k", title: "T", slug: "s", contentMd: "# 标题" },
      blocks: [{ type: "math", tex: "x^2", svg: '<svg viewBox="0 0 1 1"></svg>' }],
      prev: null,
      next: null,
    });
    expect(detail.article.contentMd).toBe("# 标题");
    expect(detail.blocks).toHaveLength(1);
    expect(detail.blocks[0]).toMatchObject({ type: "math", tex: "x^2" });
    const noBlocks = normalizeStudyDetail({ article: { key: "k", title: "T", slug: "s" } });
    expect(noBlocks.blocks).toEqual([]);
  });
});

describe("normalizeStudyList（P13：真实 API 形状 subject.chapters[].topics）", () => {
  it("从单科树响应里 flatten 出文章，保留章节与章节序", () => {
    // 取自线上 /api/exam/408/study?subject=data-structure 的真实形状（截取两章三篇）
    const payload = {
      mode: "subject",
      source: { key: "cs408-cloud", name: "cs408", baseUrl: "https://cs408.cloud" },
      subject: {
        key: "data-structure",
        title: "数据结构",
        shortName: "DS",
        chapterCount: 2,
        topicCount: 3,
        readingMinutes: 24,
        chapters: [
          {
            chapter: "绪论",
            chapterOrder: 10010,
            topics: [
              {
                slug: "data-structure-intro-basic",
                title: "数据结构基本概念",
                chapter: "绪论",
                chapterOrder: 10010,
                importance: "must",
                examFrequency: 2,
                readingMinutes: 8,
              },
            ],
          },
          {
            chapter: "线性表",
            chapterOrder: 10020,
            topics: [
              {
                slug: "data-structure-linear-list",
                title: "线性表的定义",
                chapter: "线性表",
                chapterOrder: 10020,
                importance: "common",
                examFrequency: 0,
              },
              {
                slug: "data-structure-linear-storage",
                title: "线性表的存储结构",
                chapter: "线性表",
                chapterOrder: 10021,
                importance: "must",
                examFrequency: 5,
              },
            ],
          },
        ],
      },
    };

    const catalog = normalizeStudyList(payload, "data-structure");

    expect(catalog.total).toBe(3);
    expect(catalog.chapters.map((group) => group.chapter)).toEqual(["绪论", "线性表"]);
    expect(catalog.chapters[1]?.chapterOrder).toBe(10020);
    expect(catalog.chapters[1]?.articles.map((article) => article.slug)).toEqual([
      "data-structure-linear-list",
      "data-structure-linear-storage",
    ]);
    expect(catalog.chapters[0]?.articles[0]).toMatchObject({
      slug: "data-structure-intro-basic",
      subjectKey: "data-structure",
      chapter: "绪论",
      importance: "must",
      examFrequency: 2,
    });
  });

  it("总览形状 subjects[].chapters[].topics 也能归一化", () => {
    const catalog = normalizeStudyList(
      {
        mode: "overview",
        subjects: [
          {
            key: "operating-system",
            chapters: [
              {
                chapter: "进程管理",
                chapterOrder: 20020,
                topics: [{ slug: "os-process", title: "进程" }],
              },
            ],
          },
        ],
      },
      "operating-system",
    );
    expect(catalog.total).toBe(1);
    expect(catalog.chapters[0]?.chapter).toBe("进程管理");
  });

  it("空响应/无文章时 total=0（页面据此显示明确空态）", () => {
    expect(normalizeStudyList({ mode: "subject", subject: { chapters: [] } }, "data-structure").total).toBe(0);
    expect(normalizeStudyList(null, "data-structure").total).toBe(0);
  });
});

describe("chapterSheetVisibleWithoutSnapshot（P13：崩溃后章节弹层残留防御）", () => {
  it("可见但无快照 → 自动收敛关闭", () => {
    expect(chapterSheetVisibleWithoutSnapshot(true, false)).toBe(true);
  });
  it("正常可见/已关闭都不触发", () => {
    expect(chapterSheetVisibleWithoutSnapshot(true, true)).toBe(false);
    expect(chapterSheetVisibleWithoutSnapshot(false, false)).toBe(false);
  });
});
