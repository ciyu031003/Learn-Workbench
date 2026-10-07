import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 回归护栏：**Reanimated 的滚动/手势处理器对象，绝不能挂到普通列表上**。
 *
 * 背景（2026-09-29 真机闪退真根因，踩坑 99）：`useAnimatedScrollHandler()` 返回的**不是函数**，
 * 而是 Reanimated `useEvent()` 的 `{ workletEventHandler }` 对象；只有 `Animated.*` 容器
 * 会把它换成真正的回调。而 FlashList v2 内部是 `props.onScroll?.(event)` 直接调用、
 * RN `ScrollView._handleScroll` 也是 `this.props.onScroll(e)` —— 调用一个对象 →
 * `TypeError: undefined is not a function` → RN 判为 fatal JS error → 抛 Java 异常 → **进程死**。
 * 真机表现就是"招花岗位列表一往下滑就闪退"，前 4 次修补都没找对（前身护栏只看
 * `headerScroll|header` 两个变量名，today.tsx 的 `heroScroll` 直接漏检）。
 *
 * 现在的规则**与变量名无关**，覆盖三类来源：
 *   A. 任何 `onScroll={xxx.onScroll}` 属性访问（Reanimated 处理器恒以对象形式返回回调）；
 *   B. 任何由 `useAnimatedScrollHandler(` / `useEvent(` / `useAnimatedGestureHandler(`
 *      直接赋值的标识符，出现在 `onScroll={` 里；
 *   C. **解构式**（2026-10-07 二轮评审补的洞）：`const { onScroll } = useLargeTitleHeader()`
 *      再 `onScroll={onScroll}` —— 与踩坑 99 同形，旧正则两个形态都匹配不到。
 * 这三类都要求最近的容器是 `Animated.*`；普通容器必须改用 hook 暴露的 `onScrollJS`。
 *
 * ⚠️ 检测逻辑抽成 `scanText()` 并配**合成用例**（自守）：否则将来任何人改坏正则，
 * 真实代码恰好全合规、没有负例可触发，护栏静默失效而测试照样全绿。
 */
const SRC = path.resolve(import.meta.dirname, "..");
const CONTAINER_RE = /<(Animated\.)?(ScrollView|FlatList|FlashList|SectionList|VirtualizedList)\b/;
const FACTORY_RE =
  /(?:const|let|var)\s+([A-Za-z0-9_$]+)[^=\n]*=\s*(?:useAnimatedScrollHandler|useEvent|useAnimatedGestureHandler)\s*\(/g;
/** 解构式：const { onScroll, onScrollJS } = useLargeTitleHeader()（支持 onScroll: alias 重命名） */
const DESTRUCTURE_RE =
  /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:useLargeTitleHeader|useAnimatedScrollHandler|useEvent|useAnimatedGestureHandler)\s*\(/g;
/** 属性访问式处理器：onScroll={a.b.onScroll} / onScroll={headerScroll.onScroll} */
const PROP_HANDLER_RE = /onScroll=\{[^}]*\.onScroll\}/;
/** 标识符式处理器（来源由 FACTORY_RE / DESTRUCTURE_RE 判定，见下） */
const IDENT_HANDLER_RE = /onScroll=\{([A-Za-z0-9_$]+)\}/;

function containerOf(lines: string[], index: number): string | null {
  for (let j = index; j >= Math.max(0, index - 40); j--) {
    const m = lines[j].match(CONTAINER_RE);
    if (m) return m[0];
  }
  return null;
}

/**
 * 对**单个文件源码**跑检测，返回违规描述（空数组 = 合规）。
 * 抽成纯函数是为了让下面的合成用例能直接喂 fixture（护栏自身受护栏）。
 */
export function scanText(text: string): string[] {
  const offenders: string[] = [];
  const lines = text.split("\n");
  // 本文件里由 Reanimated 工厂产出的处理器标识符（直接赋值 + 解构两种来源）
  const fromFactory = new Set<string>();
  for (const m of text.matchAll(FACTORY_RE)) fromFactory.add(m[1]);
  for (const m of text.matchAll(DESTRUCTURE_RE)) {
    for (const part of m[1].split(",")) {
      const seg = part.trim();
      // 只认 onScroll（\b 保证 onScrollJS 不会误中）；onScroll: so 重命名时记别名
      if (!/^onScroll\b/.test(seg)) continue;
      const alias = seg.includes(":") ? (seg.split(":")[1]?.trim().match(/^[A-Za-z0-9_$]+/)?.[0] ?? "") : "onScroll";
      if (alias) fromFactory.add(alias);
    }
  }
  lines.forEach((line, i) => {
    const isPropForm = PROP_HANDLER_RE.test(line);
    const ident = IDENT_HANDLER_RE.exec(line)?.[1];
    const isIdentForm = !!ident && fromFactory.has(ident);
    if (!isPropForm && !isIdentForm) return;
    const container = containerOf(lines, i);
    if (!container || !container.startsWith("<Animated.")) {
      offenders.push((i + 1) + " → " + (container ?? "(找不到容器)") + "：" + line.trim().slice(0, 60));
    }
  });
  return offenders;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("合成用例：护栏自身必须能抓住并放行典型写法（自守）", () => {
  it("抓住：任意变量名的 handler 挂普通容器（today.tsx heroScroll 形态）", () => {
    const src = [
      "function Demo() {",
      "  const heroScroll = useAnimatedScrollHandler({ onScroll: (e) => {} });",
      "  return (",
      "    <FlatList",
      "      onScroll={heroScroll}",
      "    />",
      "  );",
      "}",
    ].join("\n");
    expect(scanText(src)).toHaveLength(1);
    expect(scanText(src)[0]).toContain("heroScroll");
  });

  it("抓住：解构式 const { onScroll } = useLargeTitleHeader() 挂普通容器", () => {
    const src = [
      "function Demo() {",
      "  const { onScroll, onScrollJS } = useLargeTitleHeader();",
      "  return (",
      "    <FlatList",
      "      onScroll={onScroll}",
      "    />",
      "  );",
      "}",
    ].join("\n");
    expect(scanText(src)).toHaveLength(1);
  });

  it("抓住：解构重命名（onScroll: so）挂普通容器", () => {
    const src = [
      "function Demo() {",
      "  const { onScroll: so } = useLargeTitleHeader();",
      "  return <FlatList onScroll={so} />;",
      "}",
    ].join("\n");
    expect(scanText(src)).toHaveLength(1);
  });

  it("抓住：onScroll={x.y.onScroll} 属性访问形态挂普通容器", () => {
    const src = 'function Demo() {\n  return <FlatList onScroll={headerScroll.onScroll} />;\n}';
    expect(scanText(src)).toHaveLength(1);
  });

  it("放行：Animated.ScrollView 配 onScroll（合法配对）", () => {
    const src = [
      "function Demo() {",
      "  const { onScroll } = useLargeTitleHeader();",
      "  return <Animated.ScrollView onScroll={onScroll} />;",
      "}",
    ].join("\n");
    expect(scanText(src)).toEqual([]);
  });

  it("放行：普通容器用 onScrollJS / 内联箭头函数 / 普通 onScroll 数字", () => {
    const src = [
      "function Demo() {",
      "  const { onScrollJS } = useLargeTitleHeader();",
      "  return (",
      "    <View>",
      "      <FlatList onScroll={onScrollJS} scrollEventThrottle={16} />",
      "      <FlatList onScroll={(e) => log(e)} />",
      "      <FlatList onScroll={undefined} />",
      "    </View>",
      "  );",
      "}",
    ].join("\n");
    expect(scanText(src)).toEqual([]);
  });
});

describe("Reanimated 处理器与容器必须配对（踩坑 99）——全仓扫描", () => {
  it("onScroll={…onScroll} 只能出现在 Animated.* 容器上（变量名无关）", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      for (const issue of scanText(readFileSync(file, "utf8"))) {
        offenders.push(path.relative(SRC, file) + ":" + issue);
      }
    }
    expect(offenders, "普通 FlatList/FlashList/ScrollView 必须用 onScrollJS（否则真机一滑就闪退）").toEqual([]);
  });

  it("hook 同时提供 onScroll(Animated) 与 onScrollJS(普通) 两条路径", () => {
    const src = readFileSync(path.resolve(SRC, "components/screen-header.tsx"), "utf8");
    expect(src).toContain("onScrollJS");
    expect(src).toContain("useAnimatedScrollHandler");
  });
});
