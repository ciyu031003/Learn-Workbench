/**
 * Web 侧入口：解析实现已下沉到 @learn-workbench/shared（移动端共用同一实现）。
 * 保留这个薄封装，让页面与测试的导入路径稳定。
 */
export { parseMarkdownLite, splitInlineCode, type MdBlock } from "@learn-workbench/shared";
