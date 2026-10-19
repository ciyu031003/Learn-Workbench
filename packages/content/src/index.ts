/**
 * @learn-workbench/content —— 兼容 barrel（保留全部旧导出）。
 *
 * S3-2：源码已按子路径拆分，客户端请优先从子路径导入，避免把题库/课程数据拖进首屏：
 *   @learn-workbench/content/roadmap  内置路线图
 *   @learn-workbench/content/domains  职业/运动/阅读等领域模板
 *   @learn-workbench/content/learning 题库 + 课程 + 知识点模型（体积最大）
 *   @learn-workbench/content/health   食谱
 *   @learn-workbench/content/types    题库/课程纯类型
 */
export * from "./roadmap";
export * from "./domain-templates";
export * from "./learning";
export * from "./health/recipes";
