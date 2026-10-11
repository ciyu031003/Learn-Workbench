import type { MetadataRoute } from "next";

/**
 * robots.txt（v1.43.10 新增）。
 *
 * /learn/408 系列：来源自述「站点未声明开源或转载许可；仅个人、非商业、本地学习使用，不再分发」
 * （db/migrations/071_exam_408_content.sql:226），因此对外**不再分发**：这里显式 Disallow，
 * 三个页面同时带 noindex（app/learn/408/page.tsx 等），双保险避免被搜索引擎收录。
 *
 * 其余路径不设限：本站原本没有任何 robots 规则（爬虫按默认全站可抓），
 * 这里不引入新的全站 Allow 语义，避免改变既有行为。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/learn/408",
      },
    ],
  };
}
