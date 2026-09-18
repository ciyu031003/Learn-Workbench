import { describe, it, expect } from "vitest";
import {
  MD_DEFAULT_PHASE_TITLE,
  MD_DEFAULT_TOPIC_TITLE,
  countParsed,
  parseRoadmapMarkdown,
} from "./roadmap-markdown";

const SAMPLE = `
# 阶段一：基础
先把工具链搭起来。

## 主题 A：环境
安装 Node 与 pnpm

### 1. 安装
brew install node
- pnpm -v 应输出版本号

### 2. 验证
跑一遍 demo

## 主题 B：进阶
读文档

# 阶段二：实战
做一个小项目
## 主题 C
### 3. 收尾
提交代码
  `.trim();

describe("parseRoadmapMarkdown（v6 P3-2：H1=阶段 / H2=主题 / H3=学习内容）", () => {
  it("按三级标题切分并保留正文", () => {
    const phases = parseRoadmapMarkdown(SAMPLE);
    expect(phases).toHaveLength(2);
    expect(phases[0].title).toBe("阶段一：基础");
    expect(phases[0].summary).toBe("先把工具链搭起来。");
    expect(phases[0].topics.map((t) => t.title)).toEqual(["主题 A：环境", "主题 B：进阶"]);
    expect(phases[0].topics[0].summary).toBe("安装 Node 与 pnpm");
    expect(phases[0].topics[0].items.map((i) => i.title)).toEqual(["1. 安装", "2. 验证"]);
    expect(phases[0].topics[0].items[0].contentMd).toContain("brew install node");
    expect(phases[0].topics[0].items[0].contentMd).toContain("pnpm -v");
    expect(phases[1].topics[0].items[0].title).toBe("3. 收尾");
  });

  it("统计口径正确", () => {
    expect(countParsed(parseRoadmapMarkdown(SAMPLE))).toEqual({ phases: 2, topics: 3, items: 3 });
  });

  it("缺 H1 时归入默认阶段；缺 H2 时归入默认主题", () => {
    const phases = parseRoadmapMarkdown(["### 只有内容", "正文"].join("\n"));
    expect(phases).toHaveLength(1);
    expect(phases[0].title).toBe(MD_DEFAULT_PHASE_TITLE);
    expect(phases[0].topics[0].title).toBe(MD_DEFAULT_TOPIC_TITLE);
    expect(phases[0].topics[0].items[0].contentMd).toBe("正文");
  });

  it("代码块里的 # 不算标题", () => {
    const md = ["# 阶段", "```bash", "# 这是注释", "## 也不是标题", "```", "### 真条目"].join("\n");
    const phases = parseRoadmapMarkdown(md);
    expect(phases).toHaveLength(1);
    expect(phases[0].topics).toHaveLength(1);
    expect(phases[0].topics[0].title).toBe(MD_DEFAULT_TOPIC_TITLE);
    expect(phases[0].topics[0].items).toHaveLength(1);
  });

  it("CRLF 与空标题容错", () => {
    const md = "#\r\n\r\n# 阶段一\r\n## \r\n### 步骤\r\n内容";
    const phases = parseRoadmapMarkdown(md);
    expect(phases).toHaveLength(1);
    expect(phases[0].title).toBe("阶段一");
    expect(phases[0].topics[0].items[0].title).toBe("步骤");
  });

  it("标题超长按层级截断（阶段 60）", () => {
    const long = "啊".repeat(200);
    expect(parseRoadmapMarkdown("# " + long)[0].title).toHaveLength(60);
  });

  it("H4 归入当前条目的内容（原样保留）", () => {
    const md = ["# 阶段", "## 主题", "### 条目", "#### 细节", "正文"].join("\n");
    const phases = parseRoadmapMarkdown(md);
    expect(phases[0].topics[0].items).toHaveLength(1);
    expect(phases[0].topics[0].items[0].contentMd).toBe("#### 细节\n正文");
  });

  it("空内容返回空数组", () => {
    expect(parseRoadmapMarkdown("")).toEqual([]);
  });
});
