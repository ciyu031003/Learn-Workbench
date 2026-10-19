/**
 * @learn-workbench/shared —— 兼容 barrel（保留全部旧导出）。
 *
 * S3-2：源码已按子路径拆分，客户端请优先从子路径导入，避免把 zod（~78KB gz）拖进首屏：
 *   @learn-workbench/shared/dates     日期/格式化纯函数
 *   @learn-workbench/shared/labels    文案 / 标签 / 常量表 / 静态目录
 *   @learn-workbench/shared/types     纯 TypeScript 类型（运行时零成本）
 *   @learn-workbench/shared/pure      其余领域纯函数（营养/运动/习惯/求职/就绪度）
 *   @learn-workbench/shared/learning  学习判分 / 掌握度 / 间隔复习
 *   @learn-workbench/shared/md-lite   极简 Markdown 解析
 *   @learn-workbench/shared/schemas   zod schema（仅服务端/校验用）
 *
 * 保留 "." 入口是为了兼容 Web/Mobile 既有导入与测试；新代码不要从 "." 导入值。
 */
export * from "./types";
export * from "./labels";
export * from "./dates";
export * from "./pure";
export * from "./schemas";
export * from "./learning";
export * from "./md-lite";
