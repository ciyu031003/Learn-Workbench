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
 * 现在的规则**与变量名无关**，覆盖两类来源：
 *   A. 任何 `onScroll={xxx.onScroll}` 属性访问（Reanimated 处理器恒以对象形式返回回调）；
 *   B. 任何由 `useAnimatedScrollHandler(` / `useEvent(` / `useAnimatedGestureHandler(`
 *      直接赋值的标识符，出现在 `onScroll={` 里。
 * 这两类都要求最近的容器是 `Animated.*`；普通容器必须改用 hook 暴露的 `onScrollJS`。
 */
const SRC = path.resolve(import.meta.dirname, "..");
const CONTAINER_RE = /<(Animated\.)?(ScrollView|FlatList|FlashList|SectionList|VirtualizedList)\b/;
const FACTORY_RE =
  /(?:const|let|var)\s+([A-Za-z0-9_$]+)[^=\n]*=\s*(?:useAnimatedScrollHandler|useEvent|useAnimatedGestureHandler)\s*\(/g;
/** 属性访问式处理器：onScroll={a.b.onScroll} / onScroll={headerScroll.onScroll} */
const PROP_HANDLER_RE = /onScroll=\{[^}]*\.onScroll\}/;
/** 标识符式处理器（来源由 FACTORY_RE 判定，见下） */
const IDENT_HANDLER_RE = /onScroll=\{([A-Za-z0-9_$]+)\}/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function containerOf(lines: string[], index: number): string | null {
  for (let j = index; j >= Math.max(0, index - 40); j--) {
    const m = lines[j].match(CONTAINER_RE);
    if (m) return m[0];
  }
  return null;
}

describe("Reanimated 处理器与容器必须配对（踩坑 99）", () => {
  it("onScroll={…onScroll} 只能出现在 Animated.* 容器上（变量名无关）", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const text = readFileSync(file, "utf8");
      const lines = text.split("\n");
      // 本文件里由 Reanimated 工厂直接产出的处理器标识符
      const fromFactory = new Set<string>();
      for (const m of text.matchAll(FACTORY_RE)) fromFactory.add(m[1]);
      lines.forEach((line, i) => {
        const isPropForm = PROP_HANDLER_RE.test(line);
        const ident = IDENT_HANDLER_RE.exec(line)?.[1];
        const isIdentForm = !!ident && fromFactory.has(ident);
        if (!isPropForm && !isIdentForm) return;
        const container = containerOf(lines, i);
        if (!container || !container.startsWith("<Animated.")) {
          offenders.push(
            path.relative(SRC, file) + ":" + (i + 1) + " → " + (container ?? "(找不到容器)") + "：" + line.trim().slice(0, 60)
          );
        }
      });
    }
    expect(offenders, "普通 FlatList/FlashList/ScrollView 必须用 onScrollJS（否则真机一滑就闪退）").toEqual([]);
  });

  it("hook 同时提供 onScroll(Animated) 与 onScrollJS(普通) 两条路径", () => {
    const src = readFileSync(path.resolve(SRC, "components/screen-header.tsx"), "utf8");
    expect(src).toContain("onScrollJS");
    expect(src).toContain("useAnimatedScrollHandler");
  });
});
