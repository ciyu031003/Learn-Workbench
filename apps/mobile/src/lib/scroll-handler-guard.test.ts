import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 回归护栏（v1.32.2）：`onScroll={headerScroll.onScroll}` **只能**挂在 `Animated.*` 容器上。
 *
 * 为什么值得写一条静态检查：这个错误在类型上完全合法（hook 把返回类型声明成了函数），
 * 只有真机滑动时才会炸 —— 而且炸的是**整个进程**（RN 把 fatal JS error 抛成 Java 异常）。
 * 2026-09-29 的「招花下滑闪退」就是它：FlashList v2 内部 `props.onScroll?.(event)` 直接调用，
 * 而 Reanimated 的 handler 其实是 `{ workletEventHandler }` 对象。
 * 详见 `components/screen-header.tsx` 的 useLargeTitleHeader 注释。
 */
const SRC = path.resolve(import.meta.dirname, "..");
const CONTAINER_RE = /<(Animated\.)?(ScrollView|FlatList|FlashList|SectionList|VirtualizedList)\b/;
const HANDLER_RE = /onScroll=\{(headerScroll|header)\.onScroll\}/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("onScroll 与容器必须配对", () => {
  it("onScroll={...onScroll} 只能出现在 Animated.* 容器上（普通列表用 onScrollJS）", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!HANDLER_RE.test(line)) return;
        let container: string | null = null;
        for (let j = i; j >= Math.max(0, i - 40); j--) {
          const m = lines[j].match(CONTAINER_RE);
          if (m) {
            container = m[0];
            break;
          }
        }
        if (!container || !container.startsWith("<Animated.")) {
          offenders.push(path.relative(SRC, file) + ":" + (i + 1) + " → " + (container ?? "(找不到容器)"));
        }
      });
    }
    expect(offenders, "普通 FlatList/FlashList/ScrollView 必须用 onScrollJS，否则真机一滑就闪退").toEqual([]);
  });
});
