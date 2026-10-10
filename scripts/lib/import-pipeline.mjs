/**
 * 内容导入纯逻辑（CLI 侧入口）。
 *
 * **实现只有一份**：`apps/web/lib/content/import-plan.mjs`。放在 Web 侧是因为导入接口
 * 与服务端 applier 都要用它，Node 脚本无法直接 import TS，而 `.mjs` 两边都能读。
 * 这里只做转出，避免出现第二份实现导致「脚本 dry-run 和服务端结论不一致」。
 */
export * from "../../apps/web/lib/content/import-plan.mjs";
