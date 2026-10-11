/**
 * 「菜鸟教程 · 数据库与开发工具」——来源：菜鸟教程 https://www.runoob.com/ 。
 *
 * 由 `scripts/runoob/crawl.mjs` + `scripts/runoob/generate.mjs` 自动生成 —— **请勿手改**，
 * 要改请改 `scripts/runoob/topics.mjs` 的标题目录（或抓取/解析层）后重跑。
 *
 * 阶段 5 个 · 知识点 20 个 · 题目 89 道。
 */
import type { LearningTrack } from "./types";

export const runoobCsToolsTrack: LearningTrack = {
  slug: "rn-cs-tools",
  title: "菜鸟教程 · 数据库与开发工具",
  category: "计算机基础",
  level: "入门",
  accent: "#2F855A",
  softAccent: "#E6F4EC",
  icon: "terminal-outline",
  summary: "菜鸟教程（runoob.com）SQL 教程 / NumPy 教程 / Pandas 教程 / Git 教程 / Linux 教程 的系统整理：5 个教程、20 个知识点、89 道官方测验题。知识点保持站内阅读顺序，题按内容相似度归属到对应知识点。",
  whyLearn: "SQL 教程、NumPy 教程、Pandas 教程、Git 教程、Linux 教程 是上手这些技术最常用的入门路径；菜鸟教程的示例短、能直接跑。本课程把它们按知识点重新编排，并为每个知识点配上官方测验题，形成「读一节 → 做这一节的题 → 回读错题」的闭环。",
  prerequisites: ["会使用浏览器或命令行", "能读写基本的代码片段", "愿意动手敲示例并跑通"],
  studyMethod: ["按知识点顺序读原文，先看示例再看结论。", "每读完一个知识点立刻做它的配套题，用正确率判断是否读懂。", "错题回到对应知识点复述一遍，并写下错因。"],
  estimatedHours: 16,
  featured: false,
  stages: [
    {
      key: "rn-sql-stage",
      title: "SQL 教程",
      weeks: "第 1 阶段",
      goal: "把「SQL 教程」的 67 页内容按 6 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出SQL 教程的典型用法，并把 20 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-sql-1",
          title: "SQL 入门、语法与数据类型",
          summary: "SQL 入门、语法与数据类型（SQL 教程）：SQL（Structured Query Language，结构化查询语言）是一种用于管理和操作关系型数据库的标准化编程语言 本节含 8 页、3 道配套题。",
          concepts: [
            "SQL 教程",
            "每一章实例",
            "SQL 数据类型",
            "SQL 简介",
            "SQL 是什么？",
            "SQL 能做什么？",
            "SQL 是一种标准 - 但是...",
            "在您的网站中使用 SQL",
            "RDBMS",
            "SQL 发展历史"
          ],
          principles: [
            "SQL（Structured Query Language，结构化查询语言）是一种用于管理和操作关系型数据库的标准化编程语言",
            "在本教程中，您将学到如何使用 SQL 访问和处理数据系统中的数据，这类数据库包括：MySQL、SQL Server、Access、Oracle、Sybase、DB2 等等",
            "每章节都提供了简单的 SQL 简单实例",
            "本教程的 SQL 在 MySQL 中测试通过",
            "介绍 Microsoft Access、MySQL 和 SQL Server 的数据类型和范围",
            "SQL (Structured Query Language:结构化查询语言) 是用于管理关系数据库管理系统（RDBMS）",
            "SQL 通过一系列的语句和命令来执行数据定义、数据查询、数据操作和数据控制等功能,包括数据插入、查询、更新和删除，数据库模式创建和修改，以及数据访问控制",
            "SQL 指结构化查询语言，全称是 Structured Query Language"
          ],
          applications: [
            "示例：SELECT * FROM Websites;",
            "示例：mysql> use RUNOOB;",
            "示例：SELECT column_name(s)",
            "示例：SELECT DISTINCT column1, column2, ...",
            "示例：SELECT DISTINCT country FROM Websites;",
            "示例：SELECT column1, column2, ..."
          ],
          pitfalls: [
            "然而，为了与 ANSI 标准相兼容，它们必须以相似的方式共同地来支持一些主要的命令（比如 SELECT、UPDATE、DELETE、INSERT、WHERE 等等）",
            "如果是数值字段，请不要使用引号",
            "您是否注意到，我们没有向 id 字段插入任何数字"
          ],
          method: "按站内顺序读「SQL 教程 → SQL 简介 → SQL 语法 → SQL SELECT DISTINCT 语句 → SQL SELECT 语句 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「SQL 教程、每一章实例、SQL 数据类型」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【SQL 教程】SQL 教程：SQL（Structured Query Language，结构化查询语言）是一种用于管理和操作关系型数据库的标准化编程语言",
              "【SQL 教程】每一章实例：每章节都提供了简单的 SQL 简单实例",
              "【SQL 教程】SQL 数据类型：介绍 Microsoft Access、MySQL 和 SQL Server 的数据类型和范围",
              "【SQL 简介】SQL 简介：SQL (Structured Query Language:结构化查询语言) 是用于管理关系数据库管理系统（RDBMS）",
              "【SQL 简介】SQL 是什么？：SQL 指结构化查询语言，全称是 Structured Query Language",
              "【SQL 简介】SQL 能做什么？：SQL 面向数据库执行查询"
            ],
            mechanism: [
              "SQL（Structured Query Language，结构化查询语言）是一种用于管理和操作关系型数据库的标准化编程语言",
              "在本教程中，您将学到如何使用 SQL 访问和处理数据系统中的数据，这类数据库包括：MySQL、SQL Server、Access、Oracle、Sybase、DB2 等等",
              "在线测试工具：https://www.jyshare.com/front-end/7768/",
              "每章节都提供了简单的 SQL 简单实例",
              "本教程的 SQL 在 MySQL 中测试通过",
              "本教程使用到的 Websites 表 SQL 文件：websites.sql",
              "本教程使用到的 access_log 表 SQL 文件：access_log.sql",
              "本教程使用到的 apps 表 SQL 文件：apps.sql",
              "介绍 Microsoft Access、MySQL 和 SQL Server 的数据类型和范围",
              "SQL (Structured Query Language:结构化查询语言) 是用于管理关系数据库管理系统（RDBMS）"
            ],
            example: {
              title: "SQL 语法 · 数据库表",
              language: "sql",
              code: "mysql> use RUNOOB;\nDatabase changed\n\nmysql> set names utf8;\nQuery OK, 0 rows affected (0.00 sec)\n\nmysql> SELECT * FROM Websites;\n+----+--------------+---------------------------+-------+---------+\n| id | name | url | alexa | country |\n+----+--------------+---------------------------+-------+---------+\n| 1 | Google | https://www.google.cm/ | 1 | USA |\n| 2 | 淘宝 | https://www.taobao.com/ | 13 | CN |\n| 3 | 菜鸟教程 | http://www.runoob.com/ | 4689 | CN |\n| 4 | 微博 | http://weibo.com/ | 20 | CN |\n| 5 | Facebook | https://www.facebook.com/ | 3 | USA |\n+----+--------------+---------------------------+-------+---------+\n5 rows in set (0.01 sec)",
              explanation: "一个数据库通常包含一个或多个表，每个表有一个名字标识（例如:\"Websites\"），表包含带有数据的记录（行）"
            },
            practiceSteps: [
              "先通读本节 8 页：SQL 教程、SQL 简介、SQL 语法、SQL SELECT DISTINCT 语句 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「SQL 入门、语法与数据类型」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-sql-2",
          title: "SQL 查询、条件与排序",
          summary: "SQL 查询、条件与排序（SQL 教程）：ORDER BY 关键字用于对结果集进行排序 本节含 14 页、3 道配套题。",
          concepts: [
            "SQL ORDER BY 关键字",
            "SQL ORDER BY 语法",
            "演示数据库",
            "ORDER BY 实例",
            "ORDER BY DESC 实例",
            "ORDER BY 多列",
            "SQL UPDATE 语句",
            "SQL UPDATE 语法",
            "SQL UPDATE 实例",
            "Update 警告！"
          ],
          principles: [
            "ORDER BY 关键字用于对结果集进行排序",
            "ORDER BY 关键字用于对结果集按照一个列或者多个列进行排序",
            "ORDER BY 关键字默认按照升序对记录进行排序",
            "column1, column2, ...：要排序的字段名称，可以为多个字段",
            "在本教程中，我们将使用 RUNOOB 样本数据库",
            "下面是选自 \"Websites\" 表的数据：",
            "下面的 SQL 语句从 \"Websites\" 表中选取所有网站，并按照 \"alexa\" 列排序：",
            "下面的 SQL 语句从 \"Websites\" 表中选取所有网站，并按照 \"alexa\" 列降序排序："
          ],
          applications: [
            "示例：SELECT column1, column2, ...",
            "示例：+----+--------------+---------------------------+-------+---------+",
            "示例：SELECT * FROM Websites",
            "示例：UPDATE table_name",
            "示例：UPDATE Websites",
            "示例：SELECT TOP number|percent column1, column2, ..."
          ],
          pitfalls: [
            "请注意 SQL UPDATE 语句中的 WHERE 子句",
            "请注意 SQL DELETE 语句中的 WHERE 子句",
            "因为您不能重来",
            "请注意，在不同的数据库中，BETWEEN 操作符会产生不同的结果",
            "请注意，\"Websites\" 表中的 \"id\" 列指向 \"access_log\" 表中的字段 \"site_id\""
          ],
          method: "按站内顺序读「SQL ORDER BY 关键字 → SQL UPDATE 语句 → SQL SELECT TOP, LIMIT, ROWNUM 子句 → SQL DELETE 语句 → SQL LIKE 操作符 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「SQL ORDER BY 关键字、SQL ORDER BY 语法、演示数据库」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【SQL ORDER BY 关键字】SQL ORDER BY 关键字：ORDER BY 关键字用于对结果集进行排序",
              "【SQL ORDER BY 关键字】SQL ORDER BY 关键字：ORDER BY 关键字用于对结果集按照一个列或者多个列进行排序",
              "【SQL ORDER BY 关键字】SQL ORDER BY 语法：column1, column2, ...：要排序的字段名称，可以为多个字段",
              "【SQL ORDER BY 关键字】演示数据库：在本教程中，我们将使用 RUNOOB 样本数据库",
              "【SQL ORDER BY 关键字】ORDER BY 实例：下面的 SQL 语句从 \"Websites\" 表中选取所有网站，并按照 \"alexa\" 列排序：",
              "【SQL ORDER BY 关键字】ORDER BY DESC 实例：下面的 SQL 语句从 \"Websites\" 表中选取所有网站，并按照 \"alexa\" 列降序排序："
            ],
            mechanism: [
              "ORDER BY 关键字用于对结果集进行排序",
              "ORDER BY 关键字用于对结果集按照一个列或者多个列进行排序",
              "ORDER BY 关键字默认按照升序对记录进行排序",
              "如果需要按照降序对记录进行排序，您可以使用 DESC 关键字",
              "column1, column2, ...：要排序的字段名称，可以为多个字段",
              "在本教程中，我们将使用 RUNOOB 样本数据库",
              "下面是选自 \"Websites\" 表的数据：",
              "下面的 SQL 语句从 \"Websites\" 表中选取所有网站，并按照 \"alexa\" 列排序：",
              "下面的 SQL 语句从 \"Websites\" 表中选取所有网站，并按照 \"alexa\" 列降序排序：",
              "下面的 SQL 语句从 \"Websites\" 表中选取所有网站，并按照 \"country\" 和 \"alexa\" 列排序："
            ],
            example: {
              title: "SQL SELECT TOP, LIMIT, ROWNUM 子句 · 演示数据库",
              language: "sql",
              code: "mysql> SELECT * FROM Websites;\n+----+---------------+---------------------------+-------+---------+\n| id | name | url | alexa | country |\n+----+---------------+---------------------------+-------+---------+\n| 1 | Google | https://www.google.cm/ | 1 | USA |\n| 2 | 淘宝 | https://www.taobao.com/ | 13 | CN |\n| 3 | 菜鸟教程 | http://www.runoob.com/ | 5000 | USA |\n| 4 | 微博 | http://weibo.com/ | 20 | CN |\n| 5 | Facebook | https://www.facebook.com/ | 3 | USA |\n| 7 | stackoverflow | http://stackoverflow.com/ | 0 | IND |\n+----+---------------+---------------------------+-------+---------+",
              explanation: "在本教程中，我们将使用 RUNOOB 样本数据库"
            },
            practiceSteps: [
              "先通读本节 14 页：SQL ORDER BY 关键字、SQL UPDATE 语句、SQL SELECT TOP, LIMIT, ROWNUM 子句、SQL DELETE 语句 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「SQL 查询、条件与排序」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-sql-3",
          title: "SQL 函数、分组与聚合",
          summary: "SQL 函数、分组与聚合（SQL 教程）：SQL UNION 操作符合并两个或多个 SELECT 语句的结果 本节含 13 页、4 道配套题。",
          concepts: [
            "SQL UNION 操作符",
            "SQL UNION 语法",
            "SQL UNION ALL 语法",
            "演示数据库",
            "SQL UNION 实例",
            "SQL UNION ALL 实例",
            "带有 WHERE 的 SQL UNION ALL",
            "SQL SELECT INTO 语句",
            "SQL SELECT INTO 语法",
            "使用注意事项"
          ],
          principles: [
            "SQL UNION 操作符合并两个或多个 SELECT 语句的结果",
            "UNION 操作符用于合并两个或多个 SELECT 语句的结果集",
            "UNION 操作符默认会去除重复的记录，如果需要保留所有重复记录，可以使用 UNION ALL 操作符",
            "注释：UNION 结果集中的列名总是等于 UNION 中第一个 SELECT 语句中的列名",
            "在本教程中，我们将使用 RUNOOB 样本数据库",
            "下面是选自 \"Websites\" 表的数据：",
            "下面的 SQL 语句从 \"Websites\" 和 \"apps\" 表中选取所有不同的country（只有不同的值）：",
            "注释：UNION 不能用于列出两个表中所有的country"
          ],
          applications: [
            "示例：SELECT column1, column2, ...",
            "示例：mysql> SELECT * FROM Websites;",
            "示例：SELECT country FROM Websites",
            "示例：SELECT country, name FROM Websites",
            "示例：SELECT *",
            "示例：CREATE TABLE employees_backup AS"
          ],
          pitfalls: [
            "使用 UNION 时，每个 SELECT 语句必须具有相同数量的列，且对应列的数据类型必须相似",
            "注释：UNION 不能用于列出两个表中所有的country",
            "表由行和列组成，每个表都必须有个表名",
            "NOT NULL - 指示某列不能存储 NULL 值",
            "UNIQUE - 保证某列的每行必须有唯一的值"
          ],
          method: "按站内顺序读「SQL UNION 操作符 → SQL SELECT INTO 语句 → SQL CREATE DATABASE 语句 → SQL INSERT INTO SELECT 语句 → SQL CREATE TABLE 语句 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 4 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「SQL UNION 操作符、SQL UNION 语法、SQL UNION ALL 语法」的用法，并把 4 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【SQL UNION 操作符】SQL UNION 操作符：SQL UNION 操作符合并两个或多个 SELECT 语句的结果",
              "【SQL UNION 操作符】SQL UNION 语法：UNION 操作符默认会去除重复的记录，如果需要保留所有重复记录，可以使用 UNION ALL 操作符",
              "【SQL UNION 操作符】SQL UNION ALL 语法：注释：UNION 结果集中的列名总是等于 UNION 中第一个 SELECT 语句中的列名",
              "【SQL UNION 操作符】演示数据库：在本教程中，我们将使用 RUNOOB 样本数据库",
              "【SQL UNION 操作符】SQL UNION 实例：下面的 SQL 语句从 \"Websites\" 和 \"apps\" 表中选取所有不同的country（只有不同的值）：",
              "【SQL UNION 操作符】SQL UNION ALL 实例：下面的 SQL 语句使用 UNION ALL 从 \"Websites\" 和 \"apps\" 表中选取所有的country（也有重复的值）："
            ],
            mechanism: [
              "SQL UNION 操作符合并两个或多个 SELECT 语句的结果",
              "UNION 操作符用于合并两个或多个 SELECT 语句的结果集",
              "它可以从多个表中选择数据，并将结果集组合成一个结果集",
              "使用 UNION 时，每个 SELECT 语句必须具有相同数量的列，且对应列的数据类型必须相似",
              "UNION 操作符默认会去除重复的记录，如果需要保留所有重复记录，可以使用 UNION ALL 操作符",
              "注释：UNION 结果集中的列名总是等于 UNION 中第一个 SELECT 语句中的列名",
              "在本教程中，我们将使用 RUNOOB 样本数据库",
              "下面是选自 \"Websites\" 表的数据：",
              "下面是 \"apps\" APP 的数据：",
              "下面的 SQL 语句从 \"Websites\" 和 \"apps\" 表中选取所有不同的country（只有不同的值）："
            ],
            example: {
              title: "SQL UNION 操作符 · 演示数据库",
              language: "sql",
              code: "mysql> SELECT * FROM Websites;\n+----+--------------+---------------------------+-------+---------+\n| id | name | url | alexa | country |\n+----+--------------+---------------------------+-------+---------+\n| 1 | Google | https://www.google.cm/ | 1 | USA |\n| 2 | 淘宝 | https://www.taobao.com/ | 13 | CN |\n| 3 | 菜鸟教程 | http://www.runoob.com/ | 4689 | CN |\n| 4 | 微博 | http://weibo.com/ | 20 | CN |\n| 5 | Facebook | https://www.facebook.com/ | 3 | USA |\n| 7 | stackoverflow | http://stackoverflow.com/ | 0 | IND |\n+----+---------------+---------------------------+-------+---------+",
              explanation: "在本教程中，我们将使用 RUNOOB 样本数据库"
            },
            practiceSteps: [
              "先通读本节 13 页：SQL UNION 操作符、SQL SELECT INTO 语句、SQL CREATE DATABASE 语句、SQL INSERT INTO SELECT 语句 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 4 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「SQL 函数、分组与聚合」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 4 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-sql-4",
          title: "SQL 连接、子查询与视图",
          summary: "SQL 连接、子查询与视图（SQL 教程）：通过使用 DROP 语句，可以轻松地删除索引、表和数据库 本节含 7 页、2 道配套题。",
          concepts: [
            "SQL 撤销索引、撤销表以及撤销数据库",
            "DROP INDEX 语句",
            "DROP TABLE 语句",
            "DROP DATABASE 语句",
            "TRUNCATE TABLE 语句",
            "SQL ALTER TABLE 语句",
            "ALTER TABLE 语句",
            "SQL ALTER TABLE 语法",
            "SQL ALTER TABLE 实例",
            "改变数据类型实例"
          ],
          principles: [
            "通过使用 DROP 语句，可以轻松地删除索引、表和数据库",
            "索引是一种优化数据库查询性能的结构，但有时候可能需要删除某个索引，例如当索引不再需要或需要替换为新的索引时",
            "DROP INDEX 语句用于删除表中的索引",
            "DROP TABLE 语句用于删除表",
            "删除表将同时删除表的结构以及存储在其中的所有数据",
            "DROP DATABASE 语句用于删除数据库，包括其中的所有表、视图、存储过程等数据库对象",
            "DROP DATABASE 是一个非常强大和危险的操作，因为它会永久删除整个数据库及其所有相关数据，因此在执行之前务必要慎重考虑并确保你真的希望执行此操作",
            "如果我们仅仅需要删除表内的数据，但并不删除表本身，那么我们该如何做呢"
          ],
          applications: [
            "示例：DROP INDEX [IF EXISTS] index_name",
            "示例：DROP TABLE [IF EXISTS] TABLE_NAME;",
            "示例：DROP DATABASE [IF EXISTS] database_name;",
            "示例：TRUNCATE TABLE TABLE_NAME;",
            "示例：ALTER TABLE table_name",
            "示例：CREATE VIEW view_name AS"
          ],
          pitfalls: [
            "请注意，删除索引可能会影响数据库的查询性能，因此在执行此类操作之前，请确保了解其对数据库的影响，并根据实际需求进行操作",
            "请注意，执行DROP TABLE将永久删除表和其所有数据",
            "然而，需要注意的是，TRUNCATE TABLE不会触发触发器，而且无法在事务中进行回滚",
            "如需删除表中的列，请使用下面的语法（请注意，某些数据库系统不允许这种在数据库表中删除列的方式）：",
            "请注意，新列 \"DateOfBirth\" 的类型是 date，可以存放日期"
          ],
          method: "按站内顺序读「SQL 撤销索引、撤销表以及撤销数据库 → SQL ALTER TABLE 语句 → SQL AUTO INCREMENT 字段 → SQL 视图（Views） → SQL Date 函数 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 2 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「SQL 撤销索引、撤销表以及撤销数据库、DROP INDEX 语句、DROP TABLE 语句」的用法，并把 2 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【SQL 撤销索引、撤销表以及撤销数据库】SQL 撤销索引、撤销表以及撤销数据库：通过使用 DROP 语句，可以轻松地删除索引、表和数据库",
              "【SQL 撤销索引、撤销表以及撤销数据库】DROP INDEX 语句：索引是一种优化数据库查询性能的结构，但有时候可能需要删除某个索引，例如当索引不再需要或需要替换为新的索引时",
              "【SQL 撤销索引、撤销表以及撤销数据库】DROP TABLE 语句：DROP TABLE 语句用于删除表",
              "【SQL 撤销索引、撤销表以及撤销数据库】DROP DATABASE 语句：DROP DATABASE 语句用于删除数据库，包括其中的所有表、视图、存储过程等数据库对象",
              "【SQL 撤销索引、撤销表以及撤销数据库】TRUNCATE TABLE 语句：如果我们仅仅需要删除表内的数据，但并不删除表本身，那么我们该如何做呢",
              "【SQL ALTER TABLE 语句】ALTER TABLE 语句：ALTER TABLE 语句用于在已有的表中添加、删除或修改列"
            ],
            mechanism: [
              "通过使用 DROP 语句，可以轻松地删除索引、表和数据库",
              "索引是一种优化数据库查询性能的结构，但有时候可能需要删除某个索引，例如当索引不再需要或需要替换为新的索引时",
              "DROP INDEX 语句用于删除表中的索引",
              "DROP INDEX：表示要删除索引的操作",
              "IF EXISTS：是一个可选的子句，用于检查索引是否存在",
              "index_name：要删除的索引的名称",
              "ON table_name：指定包含要删除索引的表的名称",
              "以下是一个简单的例子，假设有一个名为 idx_example 的索引要从名为 my_table 的表中删除：",
              "请注意，删除索引可能会影响数据库的查询性能，因此在执行此类操作之前，请确保了解其对数据库的影响，并根据实际需求进行操作",
              "DROP TABLE 语句用于删除表"
            ],
            example: {
              title: "SQL 视图（Views） · SQL 更新视图",
              language: "sql",
              code: "-- 步骤 1: 更新 employees 表中的数据\nUPDATE employees\nSET salary = 60000\nWHERE employee_id = 1001;\n\n-- 步骤 2: 查询更新后的高工资员工视图\nSELECT *\nFROM high_salary_employees;",
              explanation: "在 SQL 中，你不能直接使用 UPDATE 语句来更新视图，因为视图是基于查询结果生成的虚拟表，而不是实际存储数据的表"
            },
            practiceSteps: [
              "先通读本节 7 页：SQL 撤销索引、撤销表以及撤销数据库、SQL ALTER TABLE 语句、SQL AUTO INCREMENT 字段、SQL 视图（Views） 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 2 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「SQL 连接、子查询与视图」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 2 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-sql-5",
          title: "SQL 增删改与约束",
          summary: "SQL 增删改与约束（SQL 教程）：Microsoft Access、MySQL 和 SQL Server 所使用的数据类型和范围 本节含 10 页、4 道配套题。",
          concepts: [
            "SQL 用于各种数据库的数据类型",
            "Microsoft Access 数据类型",
            "MySQL 数据类型",
            "SQL Server 数据类型",
            "SQL 通用数据类型",
            "SQL 函数",
            "SQL Aggregate 函数",
            "SQL Scalar 函数",
            "SQL AVG() 函数",
            "AVG() 函数"
          ],
          principles: [
            "Microsoft Access、MySQL 和 SQL Server 所使用的数据类型和范围",
            "用于文本或文本与数字的组合",
            "在 MySQL 中，有三种主要的类型：Text（文本）、Number（数字）和 Date/Time（日期/时间）类型",
            "数据类型定义列中存放的值的种类",
            "数据库表中的每个列都要求有名称和数据类型",
            "Each column in a database table is required to have a name and a data type.",
            "SQL 拥有很多可用于计数和计算的内建函数",
            "SQL Aggregate 函数计算从列中取得的值，返回一个单一的值"
          ],
          applications: [
            "示例：+-----+---------+-------+------------+",
            "示例：SELECT AVG(count) AS CountAverage FROM access_log;",
            "示例：+----+--------------+---------------------------+-------+---------+",
            "示例：SELECT name AS FirstSite FROM Websites LIMIT 1;",
            "示例：SELECT COUNT(count) AS nums FROM access_log",
            "示例：SELECT COUNT(*) AS nums FROM access_log;"
          ],
          pitfalls: [
            "注意：以上的 size 代表的并不是存储在数据库中的具体的长度，如 int(4) 并不是只能存储4个长度的数字",
            "p 必须是 1 到 38 之间的值",
            "s 必须是 0 到 p 之间的值",
            "SQL 开发人员必须在创建 SQL 表时决定表中的每个列将要存储的数据的类型"
          ],
          method: "按站内顺序读「SQL 用于各种数据库的数据类型 → SQL 通用数据类型 → SQL 函数 → SQL AVG() 函数 → SQL FIRST() 函数 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 4 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「SQL 用于各种数据库的数据类型、Microsoft Access 数据类型、MySQL 数据类型」的用法，并把 4 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【SQL 用于各种数据库的数据类型】SQL 用于各种数据库的数据类型：Microsoft Access、MySQL 和 SQL Server 所使用的数据类型和范围",
              "【SQL 用于各种数据库的数据类型】Microsoft Access 数据类型：用于文本或文本与数字的组合",
              "【SQL 用于各种数据库的数据类型】MySQL 数据类型：在 MySQL 中，有三种主要的类型：Text（文本）、Number（数字）和 Date/Time（日期/时间）类型",
              "【SQL 用于各种数据库的数据类型】SQL Server 数据类型：最多 8,000 个字符",
              "【SQL 通用数据类型】SQL 通用数据类型：数据类型定义列中存放的值的种类",
              "【SQL 通用数据类型】SQL 通用数据类型：数据库表中的每个列都要求有名称和数据类型"
            ],
            mechanism: [
              "Microsoft Access、MySQL 和 SQL Server 所使用的数据类型和范围",
              "Memo 用于更大数量的文本",
              "最多存储 65,536 个字符",
              "注释：无法对 memo 字段进行排序",
              "允许 0 到 255 的数字",
              "允许介于 -32,768 与 32,767 之间的全部数字",
              "允许介于 -2,147,483,648 与 2,147,483,647 之间的全部数字",
              "支持 15 位的元，外加 4 位小数",
              "提示：您可以选择使用哪个国家的货币",
              "AutoNumber 字段自动为每条记录分配数字，通常从 1 开始"
            ],
            example: {
              title: "SQL FIRST() 函数 · 演示数据库",
              language: "sql",
              code: "+----+--------------+---------------------------+-------+---------+\n| id | name | url | alexa | country |\n+----+--------------+---------------------------+-------+---------+\n| 1 | Google | https://www.google.cm/ | 1 | USA |\n| 2 | 淘宝 | https://www.taobao.com/ | 13 | CN |\n| 3 | 菜鸟教程 | http://www.runoob.com/ | 4689 | CN |\n| 4 | 微博 | http://weibo.com/ | 20 | CN |\n| 5 | Facebook | https://www.facebook.com/ | 3 | USA |\n| 6 | 百度 | https://www.baidu.com/ | 4 | CN |\n| 7 | stackoverflow | http://stackoverflow.com/ | 0 | IND |\n+----+---------------+---------------------------+-------+---------+",
              explanation: "在本教程中，我们将使用 RUNOOB 样本数据库"
            },
            practiceSteps: [
              "先通读本节 10 页：SQL 用于各种数据库的数据类型、SQL 通用数据类型、SQL 函数、SQL AVG() 函数 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 4 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「SQL 增删改与约束」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 4 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-sql-6",
          title: "SQL 进阶：索引、事务与存储过程",
          summary: "SQL 进阶：索引、事务与存储过程（SQL 教程）：GROUP BY 语句可结合一些聚合函数来使用 本节含 15 页、4 道配套题。",
          concepts: [
            "SQL GROUP BY 语句",
            "GROUP BY 语句",
            "SQL GROUP BY 语法",
            "演示数据库",
            "GROUP BY 简单应用",
            "SQL GROUP BY 多表连接",
            "SQL HAVING 子句",
            "HAVING 子句",
            "SQL HAVING 语法",
            "SQL HAVING 实例"
          ],
          principles: [
            "GROUP BY 语句可结合一些聚合函数来使用",
            "GROUP BY 语句用于结合聚合函数，根据一个或多个列对结果集进行分组",
            "在本教程中，我们将使用 RUNOOB 样本数据库",
            "下面是选自 \"Websites\" 表的数据：",
            "统计 access_log 各个 site_id 的访问量：",
            "下面的 SQL 语句统计有记录的网站的记录数量：",
            "在 SQL 中增加 HAVING 子句原因是，WHERE 关键字无法与聚合函数一起使用",
            "HAVING 子句可以让我们筛选分组后的各组数据"
          ],
          applications: [
            "示例：+----+--------------+---------------------------+-------+---------+",
            "示例：SELECT site_id, SUM(access_log.count) AS",
            "示例：SELECT Websites.name,COUNT(access_log.aid) AS nums FROM",
            "示例：SELECT column1, aggregate_function(column2)",
            "示例：SELECT Websites.name, Websites.url, SUM(access_log.count) AS nums FROM (access_…",
            "示例：SELECT column_name(s)"
          ],
          pitfalls: [
            "EXISTS 运算符用于判断查询子句是否有记录，如果有一条或多条记录存在返回 True，否则返回 False",
            "注意：ROUND 返回值被变换为一个BIGINT!",
            "通过故意触发数据库错误，利用错误信息推测表名、列名或数据",
            "错误信息可能暴露数据库版本或其他信息",
            "使用参数化查询或预编译语句，将用户输入与 SQL 语句分离，避免用户输入被直接解析为 SQL 代码"
          ],
          method: "按站内顺序读「SQL GROUP BY 语句 → SQL HAVING 子句 → SQL EXISTS 运算符 → SQL UCASE() 函数 → SQL LCASE() 函数 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 4 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「SQL GROUP BY 语句、GROUP BY 语句、SQL GROUP BY 语法」的用法，并把 4 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【SQL GROUP BY 语句】SQL GROUP BY 语句：GROUP BY 语句可结合一些聚合函数来使用",
              "【SQL GROUP BY 语句】GROUP BY 语句：GROUP BY 语句用于结合聚合函数，根据一个或多个列对结果集进行分组",
              "【SQL GROUP BY 语句】演示数据库：在本教程中，我们将使用 RUNOOB 样本数据库",
              "【SQL GROUP BY 语句】GROUP BY 简单应用：统计 access_log 各个 site_id 的访问量：",
              "【SQL GROUP BY 语句】SQL GROUP BY 多表连接：下面的 SQL 语句统计有记录的网站的记录数量：",
              "【SQL HAVING 子句】HAVING 子句：在 SQL 中增加 HAVING 子句原因是，WHERE 关键字无法与聚合函数一起使用"
            ],
            mechanism: [
              "GROUP BY 语句可结合一些聚合函数来使用",
              "GROUP BY 语句用于结合聚合函数，根据一个或多个列对结果集进行分组",
              "在本教程中，我们将使用 RUNOOB 样本数据库",
              "下面是选自 \"Websites\" 表的数据：",
              "下面是 \"access_log\" 网站访问记录表的数据：",
              "统计 access_log 各个 site_id 的访问量：",
              "下面的 SQL 语句统计有记录的网站的记录数量：",
              "在 SQL 中增加 HAVING 子句原因是，WHERE 关键字无法与聚合函数一起使用",
              "HAVING 子句可以让我们筛选分组后的各组数据",
              "aggregate_function(column2)：一个聚合函数，例如SUM、COUNT、AVG等，应用于column2的值"
            ],
            example: {
              title: "SQL GROUP BY 语句 · 演示数据库",
              language: "sql",
              code: "+----+--------------+---------------------------+-------+---------+\n| id | name | url | alexa | country |\n+----+--------------+---------------------------+-------+---------+\n| 1 | Google | https://www.google.cm/ | 1 | USA |\n| 2 | 淘宝 | https://www.taobao.com/ | 13 | CN |\n| 3 | 菜鸟教程 | http://www.runoob.com/ | 4689 | CN |\n| 4 | 微博 | http://weibo.com/ | 20 | CN |\n| 5 | Facebook | https://www.facebook.com/ | 3 | USA |\n| 7 | stackoverflow | http://stackoverflow.com/ | 0 | IND |\n+----+---------------+---------------------------+-------+---------+",
              explanation: "在本教程中，我们将使用 RUNOOB 样本数据库"
            },
            practiceSteps: [
              "先通读本节 15 页：SQL GROUP BY 语句、SQL HAVING 子句、SQL EXISTS 运算符、SQL UCASE() 函数 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 4 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「SQL 进阶：索引、事务与存储过程」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 4 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-sql-1",
        "rn-sql-3",
        "rn-sql-10",
        "rn-sql-7",
        "rn-sql-11",
        "rn-sql-14",
        "rn-sql-2",
        "rn-sql-6",
        "rn-sql-8",
        "rn-sql-15",
        "rn-sql-5",
        "rn-sql-17",
        "rn-sql-16",
        "rn-sql-18",
        "rn-sql-19",
        "rn-sql-20",
        "rn-sql-4",
        "rn-sql-9",
        "rn-sql-12",
        "rn-sql-13"
      ],
      lesson: {
        overview: [
          "《SQL 教程》取自菜鸟教程，共 67 页，整理为 6 个知识点、20 道配套测验题。",
          "知识点顺序保持站内阅读顺序：SQL 入门、语法与数据类型 → SQL 查询、条件与排序 → SQL 函数、分组与聚合 → SQL 连接、子查询与视图 → SQL 增删改与约束 → SQL 进阶：索引、事务与存储过程。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 20 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 SQL 入门、语法与数据类型 并跑通示例",
            evidence: "本地示例输出与站点示例一致"
          },
          {
            title: "完成全部配套测验",
            evidence: "题正确率 ≥ 80%（共 20 道）"
          },
          {
            title: "能独立复述全部知识点",
            evidence: "不看文档说出每个知识点的用法与易错点"
          }
        ],
        completionCriteria: ["《SQL 教程》6 个知识点全部读完。", "配套 20 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    },
    {
      key: "rn-numpy-stage",
      title: "NumPy 教程",
      weeks: "第 1 阶段",
      goal: "把「NumPy 教程」的 26 页内容按 3 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出NumPy 教程的典型用法，并把 20 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-numpy-1",
          title: "NumPy 入门与 ndarray",
          summary: "NumPy 入门与 ndarray（NumPy 教程）：NumPy(Numerical Python) 是 Python 语言的一个扩展程序库，支持大量的维度数组与矩阵运算，此外也针对数组运算提供大量的数学函数库 本节含 8 页、7 道配套题。",
          concepts: [
            "NumPy 教程",
            "学习本教程前你需要了解",
            "NumPy 应用",
            "相关链接",
            "NumPy Ndarray 对象",
            "实例",
            "NumPy 安装",
            "使用 pip 安装",
            "使用 conda 安装",
            "从源代码安装"
          ],
          principles: [
            "NumPy(Numerical Python) 是 Python 语言的一个扩展程序库，支持大量的维度数组与矩阵运算，此外也针对数组运算提供大量的数学函数库",
            "NumPy 的前身 Numeric 最早是由 Jim Hugunin 与其它协作者共同开发，2005 年，Travis Oliphant 在 Numeric 中结合了另一个同性质的程序库 Numarray 的特色，并加入了其它扩展而开发了 NumPy",
            "在开学习 NumPy 教程之前，我们需要具备基本的 Python 基础，如果你对 Python还不了解，可以阅读我们的教程：",
            "Python 2.x 版本",
            "NumPy 通常与 SciPy（Scientific Python）和 Matplotlib（绘图库）一起使用，这种组合广泛用于替代 MatLab，是一个强大的科学计算环境，有助于我们通过 Python 学习数据科学或者机器学习",
            "SciPy 是一个开源的 Python 算法库和数学工具包",
            "NumPy 官网 http://www.numpy.org/",
            "NumPy 源代码：https://github.com/numpy/numpy"
          ],
          applications: [
            "示例：numpy.array(object, dtype = None, copy = True, order = None, subok = False, ndm…",
            "示例：import numpy as np",
            "示例：pip3 install numpy",
            "示例：conda install numpy",
            "示例：python setup.py install",
            "示例：numpy.dtype(object, align, copy)"
          ],
          pitfalls: [
            "注意 − 数组元素为随机值，因为它们未初始化",
            "是否允许返回子类，如果为 True，则返回一个子类对象，否则返回一个与 a 数组具有相同数据类型和存储顺序的数组",
            "注意：buffer 是字符串的时候，Python3 默认 str 是 Unicode 类型，所以要转成 bytestring 在原 str 前加上 b"
          ],
          method: "按站内顺序读「NumPy 教程 → NumPy Ndarray 对象 → NumPy 安装 → NumPy 数据类型 → NumPy 数组属性 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 7 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「NumPy 教程、学习本教程前你需要了解、NumPy 应用」的用法，并把 7 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【NumPy 教程】NumPy 教程：NumPy(Numerical Python) 是 Python 语言的一个扩展程序库，支持大量的维度数组与矩阵运算，此外也针对数组运算提供大量的数学函数库",
              "【NumPy 教程】学习本教程前你需要了解：在开学习 NumPy 教程之前，我们需要具备基本的 Python 基础，如果你对 Python还不了解，可以阅读我们的教程：",
              "【NumPy 教程】NumPy 应用：NumPy 通常与 SciPy（Scientific Python）和 Matplotlib（绘图库）一起使用，这种组合广泛用于替代 MatLab，是一个强大的科学计算环境，有助于我们通过 Python 学习数据科学或者机器学习",
              "【NumPy 教程】相关链接：NumPy 官网 http://www.numpy.org/",
              "【NumPy Ndarray 对象】NumPy Ndarray 对象：NumPy 最重要的一个特点是其 N 维数组对象 ndarray，它是一系列同类型数据的集合，以 0 下标为开始进行集合中元素的索引",
              "【NumPy Ndarray 对象】实例：接下来可以通过以下实例帮助我们更好的理解"
            ],
            mechanism: [
              "NumPy(Numerical Python) 是 Python 语言的一个扩展程序库，支持大量的维度数组与矩阵运算，此外也针对数组运算提供大量的数学函数库",
              "NumPy 的前身 Numeric 最早是由 Jim Hugunin 与其它协作者共同开发，2005 年，Travis Oliphant 在 Numeric 中结合了另一个同性质的程序库 Numarray 的特色，并加入了其它扩展而开发了 NumPy",
              "NumPy 为开放源代码并且由许多协作者共同维护开发",
              "NumPy 是一个运行速度非常快的数学库，主要用于数组计算，包含：",
              "一个强大的N维数组对象 ndarray",
              "整合 C/C++/Fortran 代码的工具",
              "线性代数、傅里叶变换、随机数生成等功能",
              "在开学习 NumPy 教程之前，我们需要具备基本的 Python 基础，如果你对 Python还不了解，可以阅读我们的教程：",
              "NumPy 通常与 SciPy（Scientific Python）和 Matplotlib（绘图库）一起使用，这种组合广泛用于替代 MatLab，是一个强大的科学计算环境，有助于我们通过 Python 学习数据科学或者机器学习",
              "SciPy 是一个开源的 Python 算法库和数学工具包"
            ],
            example: {
              title: "NumPy 数组属性 · ndarray.itemsize",
              language: "python",
              code: "import numpy as np\n\n# 数组的 dtype 为 int8，每个元素占 1 个字节\n\nx = np.array([1, 2, 3, 4, 5], dtype=np.int8)\n\nprint(x.itemsize)\n\n# 数组的 dtype 为 float64，每个元素占 8 个字节\n\ny = np.array([1, 2, 3, 4, 5], dtype=np.float64)\n\nprint(y.itemsize)",
              explanation: "ndarray.itemsize 以字节的形式返回数组中每一个元素的大小"
            },
            practiceSteps: [
              "先通读本节 8 页：NumPy 教程、NumPy Ndarray 对象、NumPy 安装、NumPy 数据类型 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 7 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「NumPy 入门与 ndarray」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 7 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-numpy-2",
          title: "NumPy 数组运算与索引切片",
          summary: "NumPy 数组运算与索引切片（NumPy 教程）：ndarray对象的内容可以通过索引或切片来访问和修改，与 Python 中 list 的切片操作一样 本节含 11 页、7 道配套题。",
          concepts: [
            "NumPy 切片和索引",
            "NumPy 广播(Broadcast)",
            "NumPy 高级索引",
            "整数数组索引",
            "布尔索引",
            "花式索引",
            "一维数组",
            "二维数组",
            "NumPy 迭代数组",
            "控制遍历顺序"
          ],
          principles: [
            "ndarray对象的内容可以通过索引或切片来访问和修改，与 Python 中 list 的切片操作一样",
            "ndarray 数组可以基于 0 - n 的下标进行索引，切片对象可以通过内置的 slice 函数，并设置 start, stop 及 step 参数进行，从原数组中切割出一个新数组",
            "广播(Broadcast)是 numpy 对不同形状(shape)的数组进行数值计算的方式，对数组的算术运算通常在相应的元素上进行",
            "如果两个数组 a 和 b 形状相同，即满足 a.shape == b.shape，那么 a*b 的结果就是 a 与 b 数组对应位相乘",
            "NumPy 比一般的 Python 序列提供更多的索引方式",
            "除了之前看到的用整数和切片的索引外，数组可以由整数数组索引、布尔索引及花式索引",
            "整数数组索引是指使用一个数组来访问另一个数组的元素",
            "这个数组中的每个元素都是目标数组中某个维度上的索引值"
          ],
          applications: [
            "示例：import numpy as np",
            "示例：numpy.reshape(arr, newshape, order='C')",
            "示例：ndarray.flatten(order='C')",
            "示例：numpy.ravel(a, order='C')",
            "示例：numpy.transpose(arr, axes)",
            "示例：numpy.rollaxis(arr, axis, start)"
          ],
          pitfalls: [
            "如果输入数组的某个维度和输出数组的对应维度的长度相同或者其长度为 1 时，这个数组能够用来计算，否则出错",
            "默认情况下，nditer 将视待迭代遍历的数组为只读对象（read-only），为了在遍历数组的同时，实现对数组元素值的修改，必须指定 readwrite 或者 writeonly 的模式",
            "此外，输入数组的维度必须匹配否则将生成ValueError",
            "需要注意的是，插入操作会返回一个新的数组，而不会改变原始数组",
            "否则，结果为0"
          ],
          method: "按站内顺序读「NumPy 切片和索引 → NumPy 广播(Broadcast) → NumPy 高级索引 → NumPy 迭代数组 → Numpy 数组操作 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 7 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「NumPy 切片和索引、NumPy 广播(Broadcast)、NumPy 高级索引」的用法，并把 7 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【NumPy 切片和索引】NumPy 切片和索引：ndarray对象的内容可以通过索引或切片来访问和修改，与 Python 中 list 的切片操作一样",
              "【NumPy 广播(Broadcast)】NumPy 广播(Broadcast)：广播(Broadcast)是 numpy 对不同形状(shape)的数组进行数值计算的方式，对数组的算术运算通常在相应的元素上进行",
              "【NumPy 高级索引】NumPy 高级索引：NumPy 比一般的 Python 序列提供更多的索引方式",
              "【NumPy 高级索引】整数数组索引：整数数组索引是指使用一个数组来访问另一个数组的元素",
              "【NumPy 高级索引】布尔索引：我们可以通过一个布尔数组来索引目标数组",
              "【NumPy 高级索引】花式索引：花式索引指的是利用整数数组进行索引"
            ],
            mechanism: [
              "ndarray对象的内容可以通过索引或切片来访问和修改，与 Python 中 list 的切片操作一样",
              "ndarray 数组可以基于 0 - n 的下标进行索引，切片对象可以通过内置的 slice 函数，并设置 start, stop 及 step 参数进行，从原数组中切割出一个新数组",
              "以上实例中，我们首先通过 arange() 函数创建 ndarray 对象",
              "然后，分别设置起始，终止和步长的参数为 2，7 和 2",
              "我们也可以通过冒号分隔切片参数 start:stop:step 来进行切片操作：",
              "冒号 : 的解释：如果只放置一个参数，如 [2]，将返回与该索引相对应的单个元素",
              "如果为 [2:]，表示从该索引开始以后的所有项都将被提取",
              "如果使用了两个参数，如 [2:7]，那么则提取两个索引(不包括停止索引)之间的项",
              "多维数组同样适用上述索引提取方法：",
              "切片还可以包括省略号 …，来使选择元组的长度与数组的维度相同"
            ],
            example: {
              title: "NumPy 位运算 · NumPy 位运算",
              language: "python",
              code: "import numpy as np\n\narr1 = np.array([True, False, True], dtype=bool)\n\narr2 = np.array([False, True, False], dtype=bool)\n\nresult_and = np.bitwise_and(arr1, arr2)\n\nresult_or = np.bitwise_or(arr1, arr2)\n\nresult_xor = np.bitwise_xor(arr1, arr2)\n\nresult_not = np.bitwise_not(arr1)\n\nprint(\"AND:\", result_and) # [False, False, False]\n\nprint(\"OR:\", result_or) # [True, True, True]\n\nprint(\"XOR:\", result_xor) # [True, True, True]\n\nprint(\"NOT:\", result_not) # [False, True, False]\n\n# 按位取反\n\narr_invert = np.invert(np.array([1, 2], dtype=np.int8))\n\nprint(\"Invert:\", arr_invert) # [-2, -3]\n\n# 左移位运算\n\narr_left_shift = np.left_shift(5, 2)\n\nprint(\"Left Shift:\", arr_left_shift) # 20\n\n# 右移位运算\n\narr_right_shift = np.right_shift(10, 1)\n\nprint(\"Right Shift:\", arr_right_shift) # 5",
              explanation: "位运算是一种在二进制数字的位级别上进行操作的一类运算，它们直接操作二进制数字的各个位，而不考虑数字的整体值"
            },
            practiceSteps: [
              "先通读本节 11 页：NumPy 切片和索引、NumPy 广播(Broadcast)、NumPy 高级索引、NumPy 迭代数组 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 7 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「NumPy 数组运算与索引切片」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 7 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-numpy-3",
          title: "NumPy 广播、统计与线性代数",
          summary: "NumPy 广播、统计与线性代数（NumPy 教程）：在几乎所有的机器上，多字节对象都被存储为连续的字节序列 本节含 7 页、6 道配套题。",
          concepts: [
            "NumPy 字节交换",
            "numpy.ndarray.byteswap()",
            "NumPy 副本和视图",
            "无复制",
            "视图或浅拷贝",
            "副本或深拷贝",
            "更多相关文章",
            "NumPy 矩阵库(Matrix)",
            "转置矩阵",
            "matlib.empty()"
          ],
          principles: [
            "在几乎所有的机器上，多字节对象都被存储为连续的字节序列",
            "字节顺序，是跨越多字节的程序对象的存储规则",
            "numpy.ndarray.byteswap() 函数将 ndarray 中每个元素中的字节进行大小端转换",
            "副本是一个数据的完整的拷贝，如果我们对副本进行修改，它不会影响到原始数据，物理内存不在同一位置",
            "视图是数据的一个别称或引用，通过该别称或引用亦便可访问、操作原有数据，但原有数据不会产生拷贝",
            "简单的赋值不会创建数组对象的副本",
            "相反，它使用原始数组的相同id()来访问它",
            "ndarray.view() 方会创建一个新的数组对象，该方法创建的新数组的维数变化不会改变原始数据的维数"
          ],
          applications: [
            "示例：import numpy as np",
            "示例：numpy.matlib.empty(shape, dtype, order)",
            "示例：import numpy.matlib",
            "示例：numpy.matlib.eye(n, M,k, dtype)",
            "示例：numpy.dot(a, b, out=None)",
            "示例：x + y + z = 6"
          ],
          pitfalls: ["本节以示例为主：动手前先确认语言/工具版本与站点示例一致，否则输出可能对不上。"],
          method: "按站内顺序读「NumPy 字节交换 → NumPy 副本和视图 → NumPy 矩阵库(Matrix) → NumPy 线性代数 → NumPy IO → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 6 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「NumPy 字节交换、numpy.ndarray.byteswap()、NumPy 副本和视图」的用法，并把 6 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【NumPy 字节交换】NumPy 字节交换：在几乎所有的机器上，多字节对象都被存储为连续的字节序列",
              "【NumPy 字节交换】numpy.ndarray.byteswap()：numpy.ndarray.byteswap() 函数将 ndarray 中每个元素中的字节进行大小端转换",
              "【NumPy 副本和视图】NumPy 副本和视图：副本是一个数据的完整的拷贝，如果我们对副本进行修改，它不会影响到原始数据，物理内存不在同一位置",
              "【NumPy 副本和视图】无复制：简单的赋值不会创建数组对象的副本",
              "【NumPy 副本和视图】视图或浅拷贝：ndarray.view() 方会创建一个新的数组对象，该方法创建的新数组的维数变化不会改变原始数据的维数",
              "【NumPy 副本和视图】副本或深拷贝：ndarray.copy() 函数创建一个副本"
            ],
            mechanism: [
              "在几乎所有的机器上，多字节对象都被存储为连续的字节序列",
              "字节顺序，是跨越多字节的程序对象的存储规则",
              "大端模式：指数据的高字节保存在内存的低地址中，而数据的低字节保存在内存的高地址中，这样的存储模式有点儿类似于把数据当作字符串顺序处理：地址由小向大增加，而数据从高位往低位放",
              "小端模式：指数据的高字节保存在内存的高地址中，而数据的低字节保存在内存的低地址中，这种存储模式将地址的高低和数据位权有效地结合起来，高地址部分权值高，低地址部分权值低",
              "例如在 C 语言中，一个类型为 int 的变量 x 地址为 0x100，那么其对应地址表达式&x的值为 0x100",
              "且x的四个字节将被存储在存储器的 0x100, 0x101, 0x102, 0x103位置",
              "numpy.ndarray.byteswap() 函数将 ndarray 中每个元素中的字节进行大小端转换",
              "副本是一个数据的完整的拷贝，如果我们对副本进行修改，它不会影响到原始数据，物理内存不在同一位置",
              "视图是数据的一个别称或引用，通过该别称或引用亦便可访问、操作原有数据，但原有数据不会产生拷贝",
              "如果我们对视图进行修改，它会影响到原始数据，物理内存在同一位置"
            ],
            example: {
              title: "NumPy Matplotlib · 图形中文显示",
              language: "python",
              code: "import numpy as np\nfrom matplotlib import pyplot as plt\nimport matplotlib\n\n# fname 为 你下载的字体库路径，注意 SourceHanSansSC-Bold.otf 字体的路径\nzhfont1 = matplotlib.font_manager.FontProperties(fname=\"SourceHanSansSC-Bold.otf\")\n\nx = np.arange(1,11)\ny = 2 * x + 5\nplt.title(\"菜鸟教程 - 测试\", fontproperties=zhfont1)\n\n# fontproperties 设置中文显示，fontsize 设置字体大小\nplt.xlabel(\"x 轴\", fontproperties=zhfont1)\nplt.ylabel(\"y 轴\", fontproperties=zhfont1)\nplt.plot(x,y)\nplt.show()",
              explanation: "Matplotlib 默认情况不支持中文，我们可以使用以下简单的方法来解决"
            },
            practiceSteps: [
              "先通读本节 7 页：NumPy 字节交换、NumPy 副本和视图、NumPy 矩阵库(Matrix)、NumPy 线性代数 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 6 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「NumPy 广播、统计与线性代数」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 6 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-numpy-2",
        "rn-numpy-3",
        "rn-numpy-4",
        "rn-numpy-5",
        "rn-numpy-6",
        "rn-numpy-7",
        "rn-numpy-10",
        "rn-numpy-12",
        "rn-numpy-13",
        "rn-numpy-15",
        "rn-numpy-16",
        "rn-numpy-18",
        "rn-numpy-19",
        "rn-numpy-20",
        "rn-numpy-1",
        "rn-numpy-8",
        "rn-numpy-9",
        "rn-numpy-11",
        "rn-numpy-14",
        "rn-numpy-17"
      ],
      lesson: {
        overview: [
          "《NumPy 教程》取自菜鸟教程，共 26 页，整理为 3 个知识点、20 道配套测验题。",
          "知识点顺序保持站内阅读顺序：NumPy 入门与 ndarray → NumPy 数组运算与索引切片 → NumPy 广播、统计与线性代数。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 20 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 NumPy 入门与 ndarray 并跑通示例",
            evidence: "本地示例输出与站点示例一致"
          },
          {
            title: "完成全部配套测验",
            evidence: "题正确率 ≥ 80%（共 20 道）"
          },
          {
            title: "能独立复述全部知识点",
            evidence: "不看文档说出每个知识点的用法与易错点"
          }
        ],
        completionCriteria: ["《NumPy 教程》3 个知识点全部读完。", "配套 20 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    },
    {
      key: "rn-pandas-stage",
      title: "Pandas 教程",
      weeks: "第 1 阶段",
      goal: "把「Pandas 教程」的 54 页内容按 5 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出Pandas 教程的典型用法，并把 20 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-pandas-1",
          title: "Pandas 入门与数据结构",
          summary: "Pandas 入门与数据结构（Pandas 教程）：Pandas 是 Python 语言的一个扩展程序库，用于数据分析 本节含 16 页、4 道配套题。",
          concepts: [
            "Pandas 教程",
            "学习本教程前你需要了解",
            "Pandas 应用",
            "Pandas 功能",
            "数据结构",
            "第一个 pandas 实例",
            "相关链接",
            "Pandas 安装",
            "Pandas 简介",
            "Pandas 特点"
          ],
          principles: [
            "Pandas 是 Python 语言的一个扩展程序库，用于数据分析",
            "Pandas 名字衍生自术语 \"panel data\"（面板数据）和 \"Python data analysis\"（Python 数据分析）",
            "在开始学习 Pandas 教程之前，我们需要具备基本的 Python 基础，如果你对 Python还不了解，可以阅读我们的教程：",
            "Python 2.x 版本",
            "Pandas 可以从各种文件格式比如 CSV、JSON、SQL、Microsoft Excel 导入数据",
            "Pandas 可以对各种数据进行运算操作，比如归并、再成形、选择，还有数据清洗和数据加工特征",
            "Pandas 是数据分析的利器，它不仅提供了高效、灵活的数据结构，还能帮助你以极低的成本完成复杂的数据操作和分析任务",
            "Pandas 提供了丰富的功能，包括："
          ],
          applications: [
            "示例：import pandas as pd",
            "示例：pip install pandas",
            "示例：pandas.Series(data=None, index=None, dtype=None, name=None, copy=False, fastpat…",
            "示例：# 使用列表创建 Series",
            "示例：pandas.DataFrame(data=None, index=None, columns=None, dtype=None, copy=False)",
            "示例：# DataFrame 的属性和方法"
          ],
          pitfalls: [
            "Pandas 优化了大规模数据处理，提供高效的向量化操作，避免了使用 Python 循环处理数据的低效",
            "索引可以是唯一的，但不是必须的",
            "以下实例使用 ndarrays 创建，ndarray 的长度必须相同，如果传递了 index，则索引的长度应等于数组的长度",
            "注意：返回结果其实就是一个 Pandas Series 数据",
            "注意：返回结果其实就是一个 Pandas DataFrame 数据"
          ],
          method: "按站内顺序读「Pandas 教程 → Pandas 安装 → Pandas 简介 → Pandas 数据结构 - Series → Pandas 数据结构 - DataFrame → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 4 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Pandas 教程、学习本教程前你需要了解、Pandas 应用」的用法，并把 4 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Pandas 教程】Pandas 教程：Pandas 是 Python 语言的一个扩展程序库，用于数据分析",
              "【Pandas 教程】学习本教程前你需要了解：在开始学习 Pandas 教程之前，我们需要具备基本的 Python 基础，如果你对 Python还不了解，可以阅读我们的教程：",
              "【Pandas 教程】Pandas 应用：Pandas 可以从各种文件格式比如 CSV、JSON、SQL、Microsoft Excel 导入数据",
              "【Pandas 教程】Pandas 功能：Pandas 是数据分析的利器，它不仅提供了高效、灵活的数据结构，还能帮助你以极低的成本完成复杂的数据操作和分析任务",
              "【Pandas 教程】数据结构：Pandas 的主要数据结构是 Series （一维数据）与 DataFrame（二维数据）",
              "【Pandas 教程】第一个 pandas 实例：以下实例创建一个简单的 DataFrame："
            ],
            mechanism: [
              "Pandas 是 Python 语言的一个扩展程序库，用于数据分析",
              "Pandas 名字衍生自术语 \"panel data\"（面板数据）和 \"Python data analysis\"（Python 数据分析）",
              "Pandas 是一个开放源码、BSD 许可的库，提供高性能、易于使用的数据结构和数据分析工具",
              "Pandas 一个强大的分析结构化数据的工具集，基础是 Numpy（提供高性能的矩阵运算）",
              "在开始学习 Pandas 教程之前，我们需要具备基本的 Python 基础，如果你对 Python还不了解，可以阅读我们的教程：",
              "Pandas 可以从各种文件格式比如 CSV、JSON、SQL、Microsoft Excel 导入数据",
              "Pandas 可以对各种数据进行运算操作，比如归并、再成形、选择，还有数据清洗和数据加工特征",
              "Pandas 广泛应用在学术、金融、统计学等各个数据分析领域",
              "Pandas 是数据分析的利器，它不仅提供了高效、灵活的数据结构，还能帮助你以极低的成本完成复杂的数据操作和分析任务",
              "Pandas 提供了丰富的功能，包括："
            ],
            example: {
              title: "Pandas 读取 Parquet / Feather 文件 · 性能对比测试",
              language: "python",
              code: "import pandas as pd\n\nimport numpy as np\n\nimport time\n\nimport os\n\nimport tempfile\n\n# 创建测试数据\n\nnp.random.seed(42)\n\nn_rows = 1000000\n\ndf = pd.DataFrame({\n\n\"id\": range(n_rows),\n\n\"category\": np.random.choice([\"A\", \"B\", \"C\", \"D\"], n_rows),\n\n\"value\": np.random.randn(n_rows),\n\n\"flag\": np.random.choice([True, False], n_rows),\n\n\"date\": pd.date_range(\"2020-01-01\", periods=n_rows, freq=\"1min\")\n\n})\n\n# 创建临时目录\n\nwith tempfile.TemporaryDirectory() as tmpdir:\n\n# CSV 写入\n\nstart = time.time()\n\ndf.to_csv(f\"{tmpdir}/data.csv\", index=False)\n\ncsv_write = time.time() - start\n\nstart = time.time()\n\ndf_csv = pd.read_csv(f\"{tmpdir}/data.csv\")\n\ncsv_read = time.time() - start\n\n# Parquet 写入\n\nstart = time.time()\n\ndf.to_parquet(f\"{tmpdir}/data.parquet\", index=False)\n\npq_write = time.time() - start\n\nstart = time.time()\n\ndf_pq = pd.read_parquet(f\"{tmpdir}/data.parquet\")\n\npq_read = time.time() - start\n\n# Feather 写入\n\nstart = time.time()\n\ndf.to_feather(f\"{tmpdir}/data.feather\")\n\nfeather_write = time.time() - start\n\nstart = time.time()\n\ndf_feather = pd.read_feather(f\"{tmpdir}/data.feather\")\n\nfeather_read = time.time() - start\n\n# 输出结果\n\nprint(f\"{'格式':<10} {'写入时间':<12} {'读取时间':<12} {'文件大小':<12}\")\n\nprint(\"-\" * 50)\n\nprint(f\"{'CSV':<10} {csv_write:.3f}s{'':<5} {csv_read:.3f}s{'':<5} {os.path.getsize(f'{tmpdir}/data.csv')/1024/1024:.2f}MB\")\n\nprint(f\"{'Parquet':<10} {pq_write:.3f}s{'':<5} {pq_read:.3f}s{'':<5} {os.path.getsize(f'{tmpdir}/data.parquet')/1024/1024:.2f}MB\")\n\nprint(f\"{'Feather':<10} {feather_write:.3f}s{'':<5} {feather_read:.3f}s{'':<5} {os.path.getsize(f'{tmpdir}/data.feather')/1024/1024:.2f}MB\")",
              explanation: "示例代码取自「Pandas 读取 Parquet / Feather 文件」，可直接改参数观察输出差异。"
            },
            practiceSteps: [
              "先通读本节 16 页：Pandas 教程、Pandas 安装、Pandas 简介、Pandas 数据结构 - Series 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 4 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Pandas 入门与数据结构」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 4 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-pandas-2",
          title: "Pandas 数据读取与查看",
          summary: "Pandas 数据读取与查看（Pandas 教程）：数据排序与聚合是数据分析中非常常见且重要的操作，特别是在大数据集中的数据分析时 本节含 10 页、4 道配套题。",
          concepts: [
            "Pandas 数据排序与聚合",
            "一、数据排序（Sorting）",
            "排序方法",
            "实例",
            "二、数据聚合（Aggregation）",
            "聚合方法",
            "三、分组后的排序",
            "分组后排序",
            "四、透视表",
            "Pandas 数据可视化"
          ],
          principles: [
            "数据排序与聚合是数据分析中非常常见且重要的操作，特别是在大数据集中的数据分析时",
            "排序帮助我们按特定标准对数据进行排列，而聚合则让我们对数据进行汇总，计算出各种统计量",
            "排序是指将数据按某个列的值进行升序或降序排列",
            "Pandas 提供了两种主要的方法来进行排序：sort_values() 和 sort_index()",
            "sort_values()：根据列的值进行排序",
            "sort_index()：根据行或列的索引进行排序",
            "df.sort_values(by, ascending)",
            "按照指定的列（by）排序，ascending 控制升序或降序，默认为升序"
          ],
          applications: [
            "示例：import pandas as pd",
            "示例：# 按照部门分组后，按薪资降序排序",
            "示例：# 使用 pivot_table 计算每个部门的薪资平均值",
            "示例：# 选择 Letter 为 'A' 的所有数据",
            "示例：# 按照多重索引排序",
            "示例：# 使用 groupby 对多重索引进行聚合"
          ],
          pitfalls: [
            "Pandas 性能优化涉及多个方面，包括数据类型优化、避免不必要的循环、使用向量化操作、优化索引以及分块加载大数据集等方法",
            "在 Pandas 中，尽量避免使用 Python 的原生循环，应该使用 Pandas 内置的函数，这样可以利用底层的优化进行快速计算",
            "# 使用向量化操作，避免使用循环",
            "避免链式赋值",
            "链式赋值（chained assignment）是 Pandas 中常见的性能陷阱之一"
          ],
          method: "按站内顺序读「Pandas 数据排序与聚合 → Pandas 数据可视化 → Pandas 性能优化 → Pandas 高级功能 → Pandas 股票数据分析 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 4 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Pandas 数据排序与聚合、一、数据排序（Sorting）、排序方法」的用法，并把 4 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Pandas 数据排序与聚合】Pandas 数据排序与聚合：数据排序与聚合是数据分析中非常常见且重要的操作，特别是在大数据集中的数据分析时",
              "【Pandas 数据排序与聚合】一、数据排序（Sorting）：排序是指将数据按某个列的值进行升序或降序排列",
              "【Pandas 数据排序与聚合】排序方法：sort_values()：根据列的值进行排序",
              "【Pandas 数据排序与聚合】实例：df.sort_values(by, ascending)",
              "【Pandas 数据排序与聚合】二、数据聚合（Aggregation）：聚合是将数据按某些规则进行汇总，通常是对某些列的数据进行求和、求平均数、求最大值、求最小值等操作",
              "【Pandas 数据排序与聚合】聚合方法：groupby()：按某些列分组"
            ],
            mechanism: [
              "数据排序与聚合是数据分析中非常常见且重要的操作，特别是在大数据集中的数据分析时",
              "排序帮助我们按特定标准对数据进行排列，而聚合则让我们对数据进行汇总，计算出各种统计量",
              "Pandas 提供了强大的排序和聚合功能，能够帮助分析人员高效地处理数据",
              "sort_values(by, ascending)",
              "根据某列的值进行排序，ascending 控制升降序",
              "df.sort_values(by='column')",
              "sort_index(axis)",
              "df.sort_index(axis=0)",
              "按照某列进行分组后，应用聚合函数",
              "df.groupby('column')"
            ],
            example: {
              title: "Pandas 股票数据分析 · 2、相对强弱指数（RSI）",
              language: "python",
              code: "import yfinance as yf\n\nimport matplotlib.pyplot as plt\n\n# 获取茅台（600519.SS）的股票数据，日期范围从 2020-01-01 到 2021-01-01\n\nstock_data = yf.download('600519.SS', start='2020-01-01', end='2021-01-01')\n\n# 删除\"Volume\"和\"Adj Close\"列\n\nstock_data_cleaned = stock_data.drop(columns=['Adj Close', 'Volume'])\n\n# 计算 RSI 指标\n\ndelta = stock_data_cleaned['Close'].diff(1)\n\ngain = delta.where(delta > 0, 0)\n\nloss = -delta.where(delta < 0, 0)\n\n# 计算平均收益和损失\n\navg_gain = gain.rolling(window=14).mean()\n\navg_loss = loss.rolling(window=14).mean()\n\n# 计算相对强弱指数 RSI\n\nrs = avg_gain / avg_loss\n\nrsi = 100 - (100 / (1 + rs))\n\n# 添加 RSI 到数据中\n\nstock_data_cleaned['RSI'] = rsi\n\n# 绘制 RSI 曲线\n\nplt.figure(figsize=(12, 6))\n\nplt.plot(stock_data_cleaned['RSI'], label='RSI')\n\nplt.axhline(y=70, color='r', linestyle='--', label='Overbought (70)')\n\nplt.axhline(y=30, color='g', linestyle='--', label='Oversold (30)')\n\nplt.title('RSI Indicator for Maotai Stock', fontsize=14)\n\nplt.xlabel('Date', fontsize=12)\n\nplt.ylabel('RSI', fontsize=12)\n\nplt.legend()\n\nplt.grid(True)\n\nplt.show()",
              explanation: "RSI 是用来评估股票是否被过度买入或卖出的技术指标，一般来说，RSI 大于 70 表示过度买入，小于 30 表示过度卖出"
            },
            practiceSteps: [
              "先通读本节 10 页：Pandas 数据排序与聚合、Pandas 数据可视化、Pandas 性能优化、Pandas 高级功能 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 4 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Pandas 数据读取与查看」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 4 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-pandas-3",
          title: "Pandas 数据清洗与缺失值",
          summary: "Pandas 数据清洗与缺失值（Pandas 教程）：数据过滤是数据分析中最常用的操作之一 本节含 10 页、4 道配套题。",
          concepts: [
            "Pandas 过滤与条件查询",
            "基础条件过滤",
            "单一条件过滤",
            "多条件组合",
            "isin 与 where",
            "isin 筛选",
            "where 条件",
            "字符串过滤",
            "数值范围过滤",
            "时间数据过滤"
          ],
          principles: [
            "数据过滤是数据分析中最常用的操作之一",
            "Pandas 提供了丰富的条件查询功能，可以根据各种条件筛选数据",
            "多条件组合时，每个条件需要用括号括起来，并且条件之间使用 &（与）、|（或）连接，不能使用 Python 的 and、or 关键字",
            "query 方法提供了一种更简洁的 SQL 风格的过滤方式",
            "多条件过滤时要使用括号明确优先级，并且使用 &、| 而不是 and、or",
            "真实数据中往往存在缺失值（NaN），Pandas 提供了丰富的函数来处理缺失数据",
            "本节详细介绍 fillna、dropna、interpolate 等方法的使用",
            "Pandas 中使用 NaN（Not a Number）表示缺失值，它来源于 NumPy 库"
          ],
          applications: ["示例：import pandas as pd", "示例：# 不推荐（已废弃）"],
          pitfalls: [
            "多条件组合时，每个条件需要用括号括起来，并且条件之间使用 &（与）、|（或）连接，不能使用 Python 的 and、or 关键字",
            "如果 DataFrame 有自定义索引，需要注意 loc 和 iloc 的区别",
            "正则表达式功能强大但相对较慢，处理大数据量时注意性能",
            "使用 pd.to_datetime 时可以指定 format 参数明确格式，避免解析错误",
            "applymap 是 DataFrame 的方法，对每个元素逐个应用函数（注意：Pandas 2.0+ 推荐使用 DataFrame.map 代替）"
          ],
          method: "按站内顺序读「Pandas 过滤与条件查询 → Pandas 缺失值处理 → Pandas 重复数据处理 → Pandas 字符串操作 → Pandas 日期与时间 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 4 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Pandas 过滤与条件查询、基础条件过滤、单一条件过滤」的用法，并把 4 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Pandas 过滤与条件查询】Pandas 过滤与条件查询：数据过滤是数据分析中最常用的操作之一",
              "【Pandas 过滤与条件查询】单一条件过滤：实例",
              "【Pandas 过滤与条件查询】多条件组合：多条件组合时，每个条件需要用括号括起来，并且条件之间使用 &（与）、|（或）连接，不能使用 Python 的 and、or 关键字",
              "【Pandas 过滤与条件查询】isin 筛选：实例",
              "【Pandas 过滤与条件查询】where 条件：实例",
              "【Pandas 过滤与条件查询】字符串过滤：实例"
            ],
            mechanism: [
              "数据过滤是数据分析中最常用的操作之一",
              "Pandas 提供了丰富的条件查询功能，可以根据各种条件筛选数据",
              "本节详细介绍各种数据过滤方法",
              "多条件组合时，每个条件需要用括号括起来，并且条件之间使用 &（与）、|（或）连接，不能使用 Python 的 and、or 关键字",
              "query 方法提供了一种更简洁的 SQL 风格的过滤方式",
              "多条件过滤时要使用括号明确优先级，并且使用 &、| 而不是 and、or",
              "使用 str.contains 前需要处理空值：df[df[\"列\"].str.contains(\"x\", na=False)]",
              "如果 DataFrame 有自定义索引，需要注意 loc 和 iloc 的区别",
              "对于复杂的多条件查询，query 方法的语法更接近自然语言，代码更易读",
              "当数据量很大时，loc 配合布尔数组通常比 query 更快"
            ],
            example: {
              title: "Pandas 重复数据处理 · 综合案例",
              language: "python",
              code: "import pandas as pd\n\nimport numpy as np\n\n# 创建模拟的订单数据（包含重复）\n\norders = pd.DataFrame({\n\n\"订单号\": [\"O001\", \"O002\", \"O001\", \"O003\", \"O002\", \"O004\"],\n\n\"客户ID\": [\"C001\", \"C002\", \"C001\", \"C003\", \"C002\", \"C004\"],\n\n\"商品\": [\"iPhone\", \"MacBook\", \"iPhone\", \"iPad\", \"AirPods\", \"Apple Watch\"],\n\n\"金额\": [8000, 12000, 8000, 5000, 1500, 3000],\n\n\"日期\": [\"2024-01-01\", \"2024-01-02\", \"2024-01-01\", \"2024-01-03\", \"2024-01-02\", \"2024-01-04\"]\n\n})\n\nprint(\"原始订单数据：\")\n\nprint(orders)\n\nprint()\n\n# 1. 检测重复订单\n\nprint(\"重复订单检测：\")\n\nduplicates = orders[orders.duplicated(subset=[\"订单号\"], keep=False)]\n\nprint(duplicates)\n\nprint()\n\n# 2. 删除完全重复的订单\n\norders_clean = orders.drop_duplicates()\n\nprint(\"删除完全重复后：\")\n\nprint(f\"原始 {len(orders)} 行 -> {len(orders_clean)} 行\")\n\nprint()\n\n# 3. 按订单号去重，保留最新的\n\n# 假设最后一条是最新的\n\norders_clean = orders.sort_values(\"日期\").drop_duplicates(\n\nsubset=[\"订单号\"],\n\nkeep=\"last\"\n\n).sort_index()\n\nprint(\"按订单号去重（保留最新）：\")\n\nprint(orders_clean)",
              explanation: "示例代码取自「Pandas 重复数据处理」，可直接改参数观察输出差异。"
            },
            practiceSteps: [
              "先通读本节 10 页：Pandas 过滤与条件查询、Pandas 缺失值处理、Pandas 重复数据处理、Pandas 字符串操作 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 4 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Pandas 数据清洗与缺失值」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 4 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-pandas-4",
          title: "Pandas 索引、筛选与分组",
          summary: "Pandas 索引、筛选与分组（Pandas 教程）：groupby 是 Pandas 最强大的功能之一，允许按照一个或多个列对数据进行分组，然后对每个分组进行聚合、转换或过滤操作 本节含 12 页、5 道配套题。",
          concepts: [
            "Pandas 分组操作（groupby）",
            "groupby 基本用法",
            "单列分组",
            "分组并聚合",
            "多列分组",
            "常用聚合函数",
            "单一聚合",
            "自定义聚合",
            "transform",
            "filter 过滤"
          ],
          principles: [
            "groupby 是 Pandas 最强大的功能之一，允许按照一个或多个列对数据进行分组，然后对每个分组进行聚合、转换或过滤操作",
            "transform 可以在保持原数据形状的同时，对每个分组进行计算并返回与原数据相同形状的结果",
            "filter 可以根据分组条件过滤数据",
            "apply 允许对每个分组应用自定义函数",
            "groupby 是数据分析的核心操作，熟练掌握可以高效完成各种统计分析任务",
            "窗口函数用于对时间序列或有序数据进行滑动窗口计算，是金融分析、信号处理等领域的重要工具",
            "扩展窗口从开始累积到当前位置，窗口大小逐渐增大",
            "指数加权移动平均（EWMA）对近期数据赋予更大权重"
          ],
          applications: [
            "示例：import pandas as pd",
            "示例：ts = pd.Timestamp('2017-01-01 09:10:11')",
            "示例：friday = pd.Timestamp('2022-01-05')"
          ],
          pitfalls: ["本节以示例为主：动手前先确认语言/工具版本与站点示例一致，否则输出可能对不上。"],
          method: "按站内顺序读「Pandas 分组操作（groupby） → Pandas 窗口函数（rolling / expanding / ewm） → Pandas 常用函数 → Pandas Input/Output (输入输出) API 手册 → Pandas Series API 手册 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 5 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Pandas 分组操作（groupby）、groupby 基本用法、单列分组」的用法，并把 5 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Pandas 分组操作（groupby）】Pandas 分组操作（groupby）：groupby 是 Pandas 最强大的功能之一，允许按照一个或多个列对数据进行分组，然后对每个分组进行聚合、转换或过滤操作",
              "【Pandas 分组操作（groupby）】单列分组：实例",
              "【Pandas 分组操作（groupby）】分组并聚合：实例",
              "【Pandas 分组操作（groupby）】多列分组：实例",
              "【Pandas 分组操作（groupby）】单一聚合：min() / max()",
              "【Pandas 分组操作（groupby）】自定义聚合：实例"
            ],
            mechanism: [
              "groupby 是 Pandas 最强大的功能之一，允许按照一个或多个列对数据进行分组，然后对每个分组进行聚合、转换或过滤操作",
              "first() / last()",
              "transform 可以在保持原数据形状的同时，对每个分组进行计算并返回与原数据相同形状的结果",
              "filter 可以根据分组条件过滤数据",
              "apply 允许对每个分组应用自定义函数",
              "groupby 是数据分析的核心操作，熟练掌握可以高效完成各种统计分析任务",
              "窗口函数用于对时间序列或有序数据进行滑动窗口计算，是金融分析、信号处理等领域的重要工具",
              "扩展窗口从开始累积到当前位置，窗口大小逐渐增大",
              "指数加权移动平均（EWMA）对近期数据赋予更大权重",
              "EWM 对趋势变化更敏感，适合需要快速响应的场景"
            ],
            example: {
              title: "Pandas 分组操作（groupby） · 实战：销售数据分析",
              language: "python",
              code: "import pandas as pd\n\n# 模拟销售数据\n\nsales = pd.DataFrame({\n\n\"日期\": pd.date_range(\"2024-01-01\", periods=30, freq=\"D\"),\n\n\"产品\": [\"手机\", \"电脑\", \"平板\"] * 10,\n\n\"渠道\": [\"线上\"] * 15 + [\"线下\"] * 15,\n\n\"销售额\": [1000, 2000, 1500] * 10\n\n})\n\nprint(\"=== 销售数据分析 ===\\n\")\n\n# 1. 按产品统计\n\nprint(\"1. 按产品统计：\")\n\nproduct_summary = sales.groupby(\"产品\")[\"销售额\"].agg([\"sum\", \"mean\", \"count\"])\n\nprint(product_summary)\n\nprint()\n\n# 2. 按渠道统计\n\nprint(\"2. 按渠道统计：\")\n\nchannel_summary = sales.groupby(\"渠道\")[\"销售额\"].sum()\n\nprint(channel_summary)\n\nprint()\n\n# 3. 按产品和渠道交叉统计\n\nprint(\"3. 产品×渠道交叉统计：\")\n\ncross_summary = sales.groupby([\"产品\", \"渠道\"])[\"销售额\"].sum().unstack()\n\nprint(cross_summary)\n\nprint()\n\n# 4. 计算各产品销售额占比\n\nprint(\"4. 销售额占比：\")\n\ntotal = sales[\"销售额\"].sum()\n\nproduct_pct = sales.groupby(\"产品\")[\"销售额\"].sum() / total * 100\n\nprint(product_pct.round(2))",
              explanation: "groupby 是数据分析的核心操作，熟练掌握可以高效完成各种统计分析任务"
            },
            practiceSteps: [
              "先通读本节 12 页：Pandas 分组操作（groupby）、Pandas 窗口函数（rolling / expanding / ewm）、Pandas 常用函数、Pandas Input/Output (输入输出) API 手册 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 5 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Pandas 索引、筛选与分组」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 5 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-pandas-5",
          title: "Pandas 合并、透视与时间序列",
          summary: "Pandas 合并、透视与时间序列（Pandas 教程）：处理大型数据文件时，内存可能不足以一次性加载所有数据 本节含 6 页、3 道配套题。",
          concepts: [
            "Pandas 处理大文件（chunksize）",
            "分块读取 CSV",
            "chunksize 参数",
            "聚合处理",
            "增量处理",
            "筛选过滤",
            "多进程并行处理",
            "处理 JSON 大文件",
            "Pandas 数据分箱（cut / qcut）",
            "cut 等宽分箱"
          ],
          principles: [
            "处理大型数据文件时，内存可能不足以一次性加载所有数据",
            "Pandas 提供了分块读取功能，可以分批处理数据",
            "分块处理可以显著降低内存占用，但会增加处理时间",
            "合理选择 chunk 大小以平衡内存和时间",
            "数据分箱（也称为分桶）是将连续变量离散化的过程，常用于数据预处理、特征工程和数据分析",
            "cut 将数据划分为等宽的区间",
            "qcut 将数据划分为具有大致相同数据点的区间",
            "Pandas 基于 NumPy 构建，两者紧密集成"
          ],
          applications: [
            "示例：import pandas as pd",
            "示例：# 提取日期特征",
            "示例：# 整体销售指标",
            "示例：# 产品销售排名",
            "示例：# 客户消费分析",
            "示例：# 按时段分析"
          ],
          pitfalls: ["本节以示例为主：动手前先确认语言/工具版本与站点示例一致，否则输出可能对不上。"],
          method: "按站内顺序读「Pandas 处理大文件（chunksize） → Pandas 数据分箱（cut / qcut） → Pandas 与 NumPy 结合使用 → Pandas 与 Matplotlib / Seaborn 进阶可视化 → Pandas 电商数据分析实战 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Pandas 处理大文件（chunksize）、分块读取 CSV、chunksize 参数」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Pandas 处理大文件（chunksize）】Pandas 处理大文件（chunksize）：处理大型数据文件时，内存可能不足以一次性加载所有数据",
              "【Pandas 处理大文件（chunksize）】chunksize 参数：实例",
              "【Pandas 处理大文件（chunksize）】聚合处理：实例",
              "【Pandas 处理大文件（chunksize）】筛选过滤：实例",
              "【Pandas 处理大文件（chunksize）】多进程并行处理：实例",
              "【Pandas 处理大文件（chunksize）】处理 JSON 大文件：分块处理可以显著降低内存占用，但会增加处理时间"
            ],
            mechanism: [
              "处理大型数据文件时，内存可能不足以一次性加载所有数据",
              "Pandas 提供了分块读取功能，可以分批处理数据",
              "分块处理可以显著降低内存占用，但会增加处理时间",
              "合理选择 chunk 大小以平衡内存和时间",
              "数据分箱（也称为分桶）是将连续变量离散化的过程，常用于数据预处理、特征工程和数据分析",
              "cut 将数据划分为等宽的区间",
              "qcut 将数据划分为具有大致相同数据点的区间",
              "Pandas 基于 NumPy 构建，两者紧密集成",
              "理解它们的交互可以更高效地进行数据处理和科学计算",
              "Pandas 和 NumPy 的深度集成使得复杂的数据处理变得简单高效"
            ],
            example: {
              title: "Pandas 用户行为分析实战 · 模拟用户行为数据",
              language: "python",
              code: "import pandas as pd\n\nimport numpy as np\n\nnp.random.seed(42)\n\nn_users = 500\n\nn_events = 5000\n\n# 用户基础信息\n\nusers = pd.DataFrame({\n\n\"用户ID\": range(1, n_users + 1),\n\n\"注册日期\": pd.date_range(\"2024-01-01\", periods=n_users, freq=\"D\")[:n_users],\n\n\"渠道\": np.random.choice([\"自然搜索\", \"广告\", \"推荐\", \"社交\"], n_users),\n\n\"设备\": np.random.choice([\"PC\", \"Mobile\", \"Tablet\"], n_users, p=[0.3, 0.6, 0.1])\n\n})\n\n# 用户行为事件\n\nevents = pd.DataFrame({\n\n\"事件ID\": range(1, n_events + 1),\n\n\"用户ID\": np.random.randint(1, n_users + 1, n_events),\n\n\"事件类型\": np.random.choice(\n\n[\"浏览\", \"点击\", \"收藏\", \"加购\", \"下单\", \"评论\"],\n\nn_events,\n\np=[0.4, 0.25, 0.1, 0.1, 0.1, 0.05]\n\n),\n\n\"事件时间\": pd.date_range(\"2024-01-15\", periods=n_events, freq=\"10min\")\n\n})\n\n# 合并数据\n\nevents = events.merge(users[[\"用户ID\", \"渠道\", \"设备\"]], on=\"用户ID\")\n\nprint(\"用户数据：\")\n\nprint(users.head())\n\nprint(f\"\\n用户数: {len(users)}\")\n\nprint(\"\\n事件数据：\")\n\nprint(events.head())\n\nprint(f\"\\n事件数: {len(events)}\")",
              explanation: "示例代码取自「Pandas 用户行为分析实战」，可直接改参数观察输出差异。"
            },
            practiceSteps: [
              "先通读本节 6 页：Pandas 处理大文件（chunksize）、Pandas 数据分箱（cut / qcut）、Pandas 与 NumPy 结合使用、Pandas 与 Matplotlib / Seaborn 进阶可视化 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Pandas 合并、透视与时间序列」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-pandas-4",
        "rn-pandas-6",
        "rn-pandas-8",
        "rn-pandas-19",
        "rn-pandas-5",
        "rn-pandas-10",
        "rn-pandas-16",
        "rn-pandas-17",
        "rn-pandas-1",
        "rn-pandas-15",
        "rn-pandas-18",
        "rn-pandas-20",
        "rn-pandas-7",
        "rn-pandas-9",
        "rn-pandas-11",
        "rn-pandas-12",
        "rn-pandas-13",
        "rn-pandas-2",
        "rn-pandas-3",
        "rn-pandas-14"
      ],
      lesson: {
        overview: [
          "《Pandas 教程》取自菜鸟教程，共 54 页，整理为 5 个知识点、20 道配套测验题。",
          "知识点顺序保持站内阅读顺序：Pandas 入门与数据结构 → Pandas 数据读取与查看 → Pandas 数据清洗与缺失值 → Pandas 索引、筛选与分组 → Pandas 合并、透视与时间序列。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 20 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 Pandas 入门与数据结构 并跑通示例",
            evidence: "本地示例输出与站点示例一致"
          },
          {
            title: "完成全部配套测验",
            evidence: "题正确率 ≥ 80%（共 20 道）"
          },
          {
            title: "能独立复述全部知识点",
            evidence: "不看文档说出每个知识点的用法与易错点"
          }
        ],
        completionCriteria: ["《Pandas 教程》5 个知识点全部读完。", "配套 20 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    },
    {
      key: "rn-git-stage",
      title: "Git 教程",
      weeks: "第 1 阶段",
      goal: "把「Git 教程」的 16 页内容按 3 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出Git 教程的典型用法，并把 9 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-git-1",
          title: "Git 入门与仓库基础",
          summary: "Git 入门与仓库基础（Git 教程）：Git 是一个开源的分布式版本控制系统，用于敏捷高效地处理任何或小或大的项目 本节含 7 页、4 道配套题。",
          concepts: [
            "Git 教程",
            "Git 与 SVN 区别",
            "Git 快速入门",
            "Git 工作流程",
            "知识点说明",
            "命令说明",
            "1、克隆仓库",
            "2、创建新分支",
            "3、工作目录",
            "4、暂存文件"
          ],
          principles: [
            "Git 是一个开源的分布式版本控制系统，用于敏捷高效地处理任何或小或大的项目",
            "Git 是 Linus Torvalds 为了帮助管理 Linux 内核开发而开发的一个开放源码的版本控制软件",
            "Git 不仅仅是个版本控制系统，它也是个内容管理系统(CMS)，工作管理系统等",
            "如果你是一个具有使用 SVN 背景的人，你需要做一定的思想转换，来适应 Git 提供的一些概念和特征",
            "本站也提供了 Git 快速入门版本，你可以点击 Git 简明指南查看",
            "入门后建议通过本站详细学习 Git 教程",
            "2、Git GUI使用方法",
            "本章节我们将为大家介绍 Git 的工作流程"
          ],
          applications: [
            "示例：git clone https://github.com/username/repo.git",
            "示例：git checkout -b new-feature",
            "示例：git add filename",
            "示例：git commit -m \"Add new feature\"",
            "示例：git pull origin main",
            "示例：git push origin new-feature"
          ],
          pitfalls: [
            "为了避免直接在 main 或 master 分支上进行开发，通常会创建一个新的分支：",
            "在推送本地更改之前，最好从远程仓库拉取最新的更改，以避免冲突：",
            "注意：如果没有 runoob.php，需要先创建这个文件，命令可以是 touch runoob.php"
          ],
          method: "按站内顺序读「Git 教程 → Git 工作流程 → Git 安装配置 → Git 工作区、暂存区和版本库 → Git 创建仓库 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 4 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Git 教程、Git 与 SVN 区别、Git 快速入门」的用法，并把 4 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Git 教程】Git 教程：Git 是一个开源的分布式版本控制系统，用于敏捷高效地处理任何或小或大的项目",
              "【Git 教程】Git 与 SVN 区别：Git 不仅仅是个版本控制系统，它也是个内容管理系统(CMS)，工作管理系统等",
              "【Git 教程】Git 快速入门：本站也提供了 Git 快速入门版本，你可以点击 Git 简明指南查看",
              "【Git 教程】2、Git GUI使用方法",
              "【Git 工作流程】Git 工作流程：本章节我们将为大家介绍 Git 的工作流程",
              "【Git 工作流程】1. 工作区 (Working Directory) —— 你的书桌：这是你实际修改文件的地方"
            ],
            mechanism: [
              "Git 是一个开源的分布式版本控制系统，用于敏捷高效地处理任何或小或大的项目",
              "Git 是 Linus Torvalds 为了帮助管理 Linux 内核开发而开发的一个开放源码的版本控制软件",
              "Git 与常用的版本控制工具 CVS, Subversion 等不同，它采用了分布式版本库的方式，不必服务器端软件支持",
              "Git 不仅仅是个版本控制系统，它也是个内容管理系统(CMS)，工作管理系统等",
              "如果你是一个具有使用 SVN 背景的人，你需要做一定的思想转换，来适应 Git 提供的一些概念和特征",
              "Git 与 SVN 区别点：",
              "1、Git 是分布式的，SVN 不是：这是 Git 和其它非分布式的版本控制系统，例如 SVN，CVS 等，最核心的区别",
              "2、Git 把内容按元数据方式存储，而 SVN 是按文件：所有的资源控制系统都是把文件的元信息隐藏在一个类似 .svn、.cvs 等的文件夹里",
              "3、Git 分支和 SVN 的分支不同：分支在 SVN 中一点都不特别，其实它就是版本库中的另外一个目录",
              "4、Git 没有一个全局的版本号，而 SVN 有：目前为止这是跟 SVN 相比 Git 缺少的最大的一个特征"
            ],
            example: {
              title: "Git 分支管理 · 实例",
              language: "bash",
              code: "$ mkdir gitdemo\n$ cd gitdemo/\n$ git init\nInitialized empty Git repository...\n$ touch README\n$ git add README\n$ git commit -m '第一次版本提交'\n[master (root-commit) 3b58100] 第一次版本提交\n1 file changed, 0 insertions(+), 0 deletions(-)\ncreate mode 100644 README",
              explanation: "开始前我们先创建一个测试目录："
            },
            practiceSteps: [
              "先通读本节 7 页：Git 教程、Git 工作流程、Git 安装配置、Git 工作区、暂存区和版本库 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 4 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Git 入门与仓库基础」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 4 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-git-2",
          title: "Git 分支、合并与冲突",
          summary: "Git 分支、合并与冲突（Git 教程）：如果你达到一个重要的阶段，并希望永远记住提交的快照，你可以使用 git tag 给它打上标签 本节含 6 页、3 道配套题。",
          concepts: [
            "Git 标签",
            "推送标签到远程仓库",
            "删除轻量标签",
            "附注标签",
            "实例",
            "删除标签",
            "Git Flow",
            "Git Flow 安装",
            "Linux",
            "macOS"
          ],
          principles: [
            "如果你达到一个重要的阶段，并希望永远记住提交的快照，你可以使用 git tag 给它打上标签",
            "Git 标签（Tag）用于给仓库中的特定提交点加上标记，通常用于发布版本（如 v1.0, v2.0）",
            "默认情况下，git push 不会推送标签，你需要显式地推送标签",
            "附注标签存储了创建者的名字、电子邮件、日期，并且可以包含标签信息",
            "附注标签更为正式，适用于需要额外元数据的场景",
            "以下是一个综合示例，演示如何创建、查看、推送和删除标签",
            "创建轻量标签和附注标签：",
            "Git Flow 是一种基于 Git 的分支模型，旨在帮助团队更好地管理和发布软件"
          ],
          applications: [
            "示例：git tag <tagname>",
            "示例：git push origin <tagname>",
            "示例：git tag -d <tagname>",
            "示例：git tag -a <tagname> -m \"message\"",
            "示例：git tag v1.0",
            "示例：git tag -d v1.0"
          ],
          pitfalls: ["现在，注意当我们执行 git log --decorate 时，我们可以看到我们的标签了："],
          method: "按站内顺序读「Git 查看提交历史查看 Git 提交历史可以帮助你了解代码的变更情况和开发进… → Git 标签 → Git Flow → Git 进阶操作 → Git 远程仓库(Github) → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Git 标签、推送标签到远程仓库、删除轻量标签」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Git 标签】Git 标签：如果你达到一个重要的阶段，并希望永远记住提交的快照，你可以使用 git tag 给它打上标签",
              "【Git 标签】推送标签到远程仓库：默认情况下，git push 不会推送标签，你需要显式地推送标签",
              "【Git 标签】删除轻量标签：本地删除：\n远程删除：",
              "【Git 标签】附注标签：附注标签存储了创建者的名字、电子邮件、日期，并且可以包含标签信息",
              "【Git 标签】实例：以下是一个综合示例，演示如何创建、查看、推送和删除标签",
              "【Git 标签】删除标签：本地删除：\n远程删除："
            ],
            mechanism: [
              "如果你达到一个重要的阶段，并希望永远记住提交的快照，你可以使用 git tag 给它打上标签",
              "Git 标签（Tag）用于给仓库中的特定提交点加上标记，通常用于发布版本（如 v1.0, v2.0）",
              "比如说，我们想为我们的 runoob 项目发布一个 \"1.0\" 版本，我们可以用 git tag -a v1.0 命令给最新一次提交打上（HEAD） \"v1.0\" 的标签",
              "当你执行 git tag -a 命令时，Git 会打开你的编辑器，让你写一句标签注解，就像你给提交写注解一样",
              "现在，注意当我们执行 git log --decorate 时，我们可以看到我们的标签了：",
              "如果我们忘了给某个提交打标签，又将它发布了，我们可以给它追加标签",
              "例如，假设我们发布了提交 85fc7e7(上面实例最后一行)，但是那时候忘了给它打标签",
              "如果我们要查看所有标签可以使用以下命令：",
              "默认情况下，git push 不会推送标签，你需要显式地推送标签",
              "附注标签存储了创建者的名字、电子邮件、日期，并且可以包含标签信息"
            ],
            example: {
              title: "Git 标签 · Git 标签",
              language: "bash",
              code: "$ git tag -a v0.9 85fc7e7\n$ git log --oneline --decorate --graph\n* d5e9fc2 (HEAD -> master) Merge branch 'change_site'\n|\\\n| * 7774248 (change_site) changed the runoob.php\n* | c68142b 修改代码\n|/\n* c1501a2 removed test.txt、add runoob.php\n* 3e92c19 add test.txt\n* 3b58100 (tag: v0.9) 第一次版本提交",
              explanation: "如果你达到一个重要的阶段，并希望永远记住提交的快照，你可以使用 git tag 给它打上标签"
            },
            practiceSteps: [
              "先通读本节 6 页：Git 查看提交历史查看 Git 提交历史可以帮助你了解代码的变更情况和开发进…、Git 标签、Git Flow、Git 进阶操作 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Git 分支、合并与冲突」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-git-3",
          title: "Git 远程仓库与协作流程",
          summary: "Git 远程仓库与协作流程（Git 教程）：Git 有很多图形界面工具 ( GUI )，比如 SourceTree、Github Desktop、TortoiseGit 等 本节含 3 页、2 道配套题。",
          concepts: [
            "Sourcetree 使用教程",
            "Sourcetree 安装",
            "连接 Github 账户",
            "创建本地仓库",
            "Git 测验",
            "知识挑战",
            "测验完成！",
            "其他相关测试",
            "GitHub Actions",
            "核心概念"
          ],
          principles: [
            "Git 有很多图形界面工具 ( GUI )，比如 SourceTree、Github Desktop、TortoiseGit 等",
            "SourceTree 是一个 Git 客户端管理工具，适用于 Windows 和 Mac 系统",
            "我们可以在 Sourcetree 官网 https://www.sourcetreeapp.com/ 直接点击下载按钮来下载：",
            "其他版本可以查看：https://www.sourcetreeapp.com/download-archives",
            "如果你还没有 Github 账户需要创建一个，可以参考 Git 远程仓库(Github)",
            "接下来我们将介绍使用 Sourcetree 管理我们的 Github 账户",
            "单击新建，然后选择创建本地仓库",
            "输入您的目标路径和存储库名称，然后点击创建"
          ],
          applications: [
            "示例：仓库（Repository）",
            "示例：your-repo/",
            "示例：# .github/workflows/hello.yml",
            "示例：span style=\"color: #007F45;\">",
            "示例：# 层级一：Workflow 级别（所有 Job 和 Step 都可以访问）",
            "示例：# .github/workflows/ci.yml"
          ],
          pitfalls: [
            "所有 Workflow 文件必须存放在仓库根目录的 .github/workflows/ 文件夹下，文件名以 .yml 或 .yaml 结尾，文件名可以自定义：",
            "YAML 文件对缩进非常敏感，必须使用空格缩进，不能使用 Tab 键",
            "建议使用 VS Code 并安装 YAML 插件，可以实时检测格式错误",
            "指定固定版本，避免因 latest 升级引入不兼容问题",
            "密码、API 密钥、服务器地址等敏感信息不能直接写在 yml 文件中（因为代码是公开的），必须存储在 GitHub 仓库的 Secrets 中"
          ],
          method: "按站内顺序读「Sourcetree 使用教程 → Git 测验 → GitHub Actions」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 2 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Sourcetree 使用教程、Sourcetree 安装、连接 Github 账户」的用法，并把 2 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Sourcetree 使用教程】Sourcetree 使用教程：Git 有很多图形界面工具 ( GUI )，比如 SourceTree、Github Desktop、TortoiseGit 等",
              "【Sourcetree 使用教程】Sourcetree 安装：我们可以在 Sourcetree 官网 https://www.sourcetreeapp.com/ 直接点击下载按钮来下载：",
              "【Sourcetree 使用教程】连接 Github 账户：如果你还没有 Github 账户需要创建一个，可以参考 Git 远程仓库(Github)",
              "【Sourcetree 使用教程】创建本地仓库：单击新建，然后选择创建本地仓库",
              "【Git 测验】知识挑战：通过这些互动问题测试学习情况",
              "【GitHub Actions】GitHub Actions：GitHub Actions 是 GitHub 内置的自动化平台，允许你在代码仓库中直接定义并运行自动化流程，无需借助任何外部 CI/CD 工具"
            ],
            mechanism: [
              "Git 有很多图形界面工具 ( GUI )，比如 SourceTree、Github Desktop、TortoiseGit 等",
              "SourceTree 是一个 Git 客户端管理工具，适用于 Windows 和 Mac 系统",
              "SourceTree 简化了开发者与代码仓库之间的 Git 操作方式，我们可以通过界面菜单很方便的处理 Git 操作，而不需要通过命令",
              "通过 SourceTree，我们可以管理所有的 Git 库，无论是远程还是本地的",
              "SourceTree 支持 Bitbucket、GitHub 以及 Gitlab 等远程仓库",
              "我们可以在 Sourcetree 官网 https://www.sourcetreeapp.com/ 直接点击下载按钮来下载：",
              "其他版本可以查看：https://www.sourcetreeapp.com/download-archives",
              "下载完成后，解压 ZIP 文件，双击应用程序文件（Windows 为 EXE 或 Mac 为 DMG）进行安装",
              "安装过程中，我们只需要同意 Atlassian 客户协议并点击 Continue 即可",
              "创建 Bitbucket 账户可跳过初始设置，加载 SSH 密钥，如果有会默认加载进来，也可以后面再设置"
            ],
            example: {
              title: "GitHub Actions · 示例三：构建并推送 Docker 镜像",
              language: "bash",
              code: "# .github/workflows/docker.yml\n\nname: 构建并推送 Docker 镜像\n\non:\n\npush:\n\nbranches: [main]\n\ntags:\n\n- 'v*' # 推送 v 开头的 tag 时触发，如 v1.0.0\n\njobs:\n\ndocker:\n\nruns-on: ubuntu-latest\n\nsteps:\n\n- uses: actions/checkout@v4\n\n# 使用官方 Docker 元数据 Action 自动生成镜像标签\n\n# 如推送 tag v1.2.3 时，自动生成 1.2.3、1.2、1、latest 等多个标签\n\n- name: 提取 Docker 元数据（镜像标签等）\n\nid: meta # 为此 Step 设置 ID，供后续 Step 引用其输出\n\nuses: docker/metadata-action@v5\n\nwith:\n\nimages: your-dockerhub-username/your-image-name\n\n- name: 登录 Docker Hub\n\nuses: docker/login-action@v3\n\nwith:\n\nusername: ${{ secrets.DOCKERHUB_USERNAME }}\n\npassword: ${{ secrets.DOCKERHUB_TOKEN }} # 使用 Access Token 而非密码，更安全\n\n- name: 构建并推送镜像\n\nuses: docker/build-push-action@v5\n\nwith:\n\ncontext: . # Dockerfile 所在目录（当前目录）\n\npush: true # true：构建完成后推送到 Registry\n\ntags: ${{ steps.meta.outputs.tags }} # 引用 meta Step 生成的标签列表\n\nlabels: ${{ steps.meta.outputs.labels }} # 引用 meta Step 生成的标签信息",
              explanation: "示例代码取自「GitHub Actions」，可直接改参数观察输出差异。"
            },
            practiceSteps: [
              "先通读本节 3 页：Sourcetree 使用教程、Git 测验、GitHub Actions。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 2 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Git 远程仓库与协作流程」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 2 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-git-1",
        "rn-git-4",
        "rn-git-5",
        "rn-git-6",
        "rn-git-7",
        "rn-git-8",
        "rn-git-9",
        "rn-git-2",
        "rn-git-3"
      ],
      lesson: {
        overview: [
          "《Git 教程》取自菜鸟教程，共 16 页，整理为 3 个知识点、9 道配套测验题。",
          "知识点顺序保持站内阅读顺序：Git 入门与仓库基础 → Git 分支、合并与冲突 → Git 远程仓库与协作流程。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 9 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 Git 入门与仓库基础 并跑通示例",
            evidence: "本地示例输出与站点示例一致"
          },
          {
            title: "完成全部配套测验",
            evidence: "题正确率 ≥ 80%（共 9 道）"
          },
          {
            title: "能独立复述全部知识点",
            evidence: "不看文档说出每个知识点的用法与易错点"
          }
        ],
        completionCriteria: ["《Git 教程》3 个知识点全部读完。", "配套 9 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    },
    {
      key: "rn-linux-stage",
      title: "Linux 教程",
      weeks: "第 1 阶段",
      goal: "把「Linux 教程」的 31 页内容按 3 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出Linux 教程的典型用法，并把 20 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-linux-1",
          title: "Linux 入门、目录与文件操作",
          summary: "Linux 入门、目录与文件操作（Linux 教程）：Linux 是一种自由和开放源码的类 UNIX 操作系统 本节含 7 页、6 道配套题。",
          concepts: [
            "Linux 教程",
            "谁适合阅读？",
            "需要具备的知识？",
            "Linux 是开源的",
            "Linux 安装",
            "Linux 安装步骤",
            "Linux 简介",
            "Linux 的发行版",
            "Linux 应用领域",
            "Linux vs Windows"
          ],
          principles: [
            "Linux 是一种自由和开放源码的类 UNIX 操作系统",
            "Linux 英文解释为 Linux is not Unix",
            "本教程针对的是Linux服务器方面的知识，适合从事运维或后端开发的人员阅读",
            "如果你熟悉操作系统方面的知识，相信你会很快学会 Linux",
            "本教程将于 Linux 的发行版本 Centos 为例来为大家介绍 Linux 系统的应用",
            "Linux 遵循 GNU 通用公共许可证（GPL），任何个人和机构都可以自由地使用 Linux 的所有底层源代码，也可以自由地修改和再发布",
            "由于 Linux 是自由软件，任何人都可以创建一个符合自己需求的 Linux 发行版",
            "本章节我们将为大家介绍 Linux 的安装，安装步骤比较繁琐，现在其实云服务器挺普遍的，价格也便宜，如果自己不想搭建，也可以配置一个，参考 Linux 云服务器"
          ],
          applications: [
            "示例：wsl --install",
            "示例：dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux…",
            "示例：cd /mnt/c/Users/你的用户名/Desktop",
            "示例：# 卸载某个 Linux 发行版",
            "示例：ls /"
          ],
          pitfalls: [
            "4、选中\"English（English）\"否则会有部分乱码问题",
            "13、调整分区，必须要有/home这个分区，如果没有这个分区，安装部分软件会出现不能安装的问题",
            "26、第一次登录，登录前不要做任何更改，这个很重要",
            "注意：很多云服务器给新用户提供的优惠力度是最大，基本上都是 1～2 折，建议新注册的用户购买",
            "运行级别0：系统停机状态，系统默认运行级别不能设为0，否则不能正常启动"
          ],
          method: "按站内顺序读「Linux 教程 → Linux 安装 → Linux 简介 → 云服务器 → Windows WSL 安装 Linux → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 6 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Linux 教程、谁适合阅读？、需要具备的知识？」的用法，并把 6 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Linux 教程】Linux 教程：Linux 是一种自由和开放源码的类 UNIX 操作系统",
              "【Linux 教程】谁适合阅读？：本教程针对的是Linux服务器方面的知识，适合从事运维或后端开发的人员阅读",
              "【Linux 教程】需要具备的知识？：如果你熟悉操作系统方面的知识，相信你会很快学会 Linux",
              "【Linux 教程】Linux 是开源的：Linux 遵循 GNU 通用公共许可证（GPL），任何个人和机构都可以自由地使用 Linux 的所有底层源代码，也可以自由地修改和再发布",
              "【Linux 安装】Linux 安装：本章节我们将为大家介绍 Linux 的安装，安装步骤比较繁琐，现在其实云服务器挺普遍的，价格也便宜，如果自己不想搭建，也可以配置一个，参考 Linux 云服务器",
              "【Linux 安装】Linux 安装步骤：1、首先，使用光驱或U盘或你下载的Linux ISO文件进行安装"
            ],
            mechanism: [
              "Linux 是一种自由和开放源码的类 UNIX 操作系统",
              "Linux 英文解释为 Linux is not Unix",
              "Linux 是在 1991 由林纳斯·托瓦兹在赫尔辛基大学上学时创立的，主要受到 Minix 和 Unix 思想的启发",
              "本教程，我们将为大家介绍如何使用 Linux",
              "Linux 其实很容易学，相信你们能很快学会",
              "本教程针对的是Linux服务器方面的知识，适合从事运维或后端开发的人员阅读",
              "如果你熟悉操作系统方面的知识，相信你会很快学会 Linux",
              "本教程将于 Linux 的发行版本 Centos 为例来为大家介绍 Linux 系统的应用",
              "Linux 遵循 GNU 通用公共许可证（GPL），任何个人和机构都可以自由地使用 Linux 的所有底层源代码，也可以自由地修改和再发布",
              "由于 Linux 是自由软件，任何人都可以创建一个符合自己需求的 Linux 发行版"
            ],
            example: {
              title: "Windows WSL 安装 Linux · 方法二：手动安装（适合定制需求）",
              language: "bash",
              code: "dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart\ndism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart",
              explanation: "1、启用 WSL 功能和虚拟机平台"
            },
            practiceSteps: [
              "先通读本节 7 页：Linux 教程、Linux 安装、Linux 简介、云服务器 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 6 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Linux 入门、目录与文件操作」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 6 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-linux-2",
          title: "Linux 用户、权限与进程管理",
          summary: "Linux 用户、权限与进程管理（Linux 教程）：很多朋友经常会忘记Linux系统的root密码，linux系统忘记root密码的情况该怎么办呢 本节含 11 页、6 道配套题。",
          concepts: [
            "Linux 忘记密码解决方法",
            "重启linux系统",
            "Linux 远程登录",
            "使用密钥认证机制远程登录linux",
            "Linux 文件基本属性",
            "Linux文件属主和属组",
            "更改文件属性",
            "1、chgrp：更改文件属组",
            "3、chmod：更改文件9个属性",
            "符号类型改变文件权限"
          ],
          principles: [
            "很多朋友经常会忘记Linux系统的root密码，linux系统忘记root密码的情况该怎么办呢",
            "3 秒之内要按一下回车，出现如下界面",
            "在 第二行最后边输入 single，有一个空格",
            "Linux 一般作为服务器使用，而服务器一般放在机房，你不可能在机房操作你的 Linux 服务器",
            "这时我们就需要远程登录到Linux服务器来管理维护系统",
            "SSH 为 Secure Shell 的缩写，由 IETF 的网络工作小组（Network Working Group）所制定",
            "SSH 为建立在应用层和传输层基础上的安全协议",
            "Linux 系统是一种典型的多用户系统，不同的用户处于不同的地位，拥有不同的权限"
          ],
          applications: [
            "示例：[root@www /]# ls -l",
            "示例：chgrp [-R] 属组名 文件名",
            "示例：chown [–R] 所有者 文件名",
            "示例：chmod [-R] xyz 文件或目录",
            "示例：# touch test1 // 创建 test1 文件",
            "示例：[root@www ~]# ls [-aAdfFhilnrRSt] 目录名称"
          ],
          pitfalls: [
            "注意的是，在这个过程中鼠标要来回的动，否则这个进度条是不会动的",
            "要注意的是，这三个权限的位置不会改变，如果没有权限，就会出现减号 - 而已",
            "不过要注意的是，这个 rmdir 仅能删除空的目录，你可以使用 rm 命令来删除非空目录",
            "-f ：就是 force 的意思，忽略不存在的文件，不会出现警告信息",
            "如果加上 -i 的选项就会主动询问喔，避免你删除到错误的档名"
          ],
          method: "按站内顺序读「Linux 忘记密码解决方法 → Linux 远程登录 → Linux 文件基本属性 → Linux 文件与目录管理 → Linux 用户和用户组管理 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 6 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Linux 忘记密码解决方法、重启linux系统、Linux 远程登录」的用法，并把 6 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Linux 忘记密码解决方法】Linux 忘记密码解决方法：很多朋友经常会忘记Linux系统的root密码，linux系统忘记root密码的情况该怎么办呢",
              "【Linux 忘记密码解决方法】重启linux系统：3 秒之内要按一下回车，出现如下界面",
              "【Linux 远程登录】Linux 远程登录：Linux 一般作为服务器使用，而服务器一般放在机房，你不可能在机房操作你的 Linux 服务器",
              "【Linux 远程登录】使用密钥认证机制远程登录linux：SSH 为 Secure Shell 的缩写，由 IETF 的网络工作小组（Network Working Group）所制定",
              "【Linux 文件基本属性】Linux 文件基本属性：Linux 系统是一种典型的多用户系统，不同的用户处于不同的地位，拥有不同的权限",
              "【Linux 文件基本属性】Linux文件属主和属组：对于文件来说，它都有一个特定的所有者，也就是对该文件具有所有权的用户"
            ],
            mechanism: [
              "很多朋友经常会忘记Linux系统的root密码，linux系统忘记root密码的情况该怎么办呢",
              "进入单用户模式更改一下root密码即可",
              "3 秒之内要按一下回车，出现如下界面",
              "在 第二行最后边输入 single，有一个空格",
              "具体方法为按向下尖头移动到第二行，按\"e\"进入编辑模式",
              "在后边加上single 回车",
              "最后按\"b\"启动，启动后就进入了单用户模式了",
              "此时已经进入到单用户模式了，你可以更改root密码了",
              "更密码的命令为 passwd",
              "【使用系统安装光盘的救援模式】"
            ],
            example: {
              title: "Linux yum 命令 · 实例 2",
              language: "bash",
              code: "[root@www ~]# yum remove pam-devel\nSetting up Remove Process\nResolving Dependencies <==同样的，先解决属性相依的问题\n--> Running transaction check\n---> Package pam-devel.i386 0:0.99.6.2-4.el5 set to be erased\n--> Finished Dependency Resolution\n\nDependencies Resolved\n\n=============================================================================\nPackage Arch Version Repository Size\n=============================================================================\nRemoving:\npam-devel i386 0.99.6.2-4.el5 installed 495 k\n\nTransaction Summary\n=============================================================================\nInstall 0 Package(s)\nUpdate 0 Package(s)\nRemove 1 Package(s) <==还好，并没有属性相依的问题，单纯移除一个软件\n\nIs this ok [y/N]: y\nDownloading Packages:\nRunning rpm_check_debug\nRunning Transaction Test\nFinished Transaction Test\nTransaction Test Succeeded\nRunning Transaction\nErasing : pam-devel ######################### [1/1]\n\nRemoved: pam-devel.i386 0:0.99.6.2-4.el5\nComplete!",
              explanation: "移除 pam-devel"
            },
            practiceSteps: [
              "先通读本节 11 页：Linux 忘记密码解决方法、Linux 远程登录、Linux 文件基本属性、Linux 文件与目录管理 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 6 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Linux 用户、权限与进程管理」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 6 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-linux-3",
          title: "Linux 网络、软件包与 Shell",
          summary: "Linux 网络、软件包与 Shell（Linux 教程）：我们可以在执行 Shell 脚本时，向脚本传递参数，脚本内获取参数的格式为 $n，n 代表一个数字，1 为执行脚本的第一个参数，2 为执行脚本的第二个参数 本节含 13 页、8 道配套题。",
          concepts: [
            "Shell 传递参数",
            "实例",
            "Shell 数组",
            "读取数组",
            "关联数组",
            "获取数组中的所有元素",
            "获取数组的长度",
            "Shell 基本运算符",
            "算术运算符",
            "关系运算符"
          ],
          principles: [
            "我们可以在执行 Shell 脚本时，向脚本传递参数，脚本内获取参数的格式为 $n，n 代表一个数字，1 为执行脚本的第一个参数，2 为执行脚本的第二个参数",
            "例如可以使用 $1、$2 等来引用传递给脚本的参数，其中 $1 表示第一个参数，$2 表示第二个参数，依此类推",
            "以下实例我们向脚本传递三个参数，并分别输出，其中 $0 为执行的文件名（包含文件路径）：",
            "为脚本设置可执行权限，并执行脚本，输出结果如下所示：",
            "Bash Shell 只支持一维数组（不支持多维数组），初始化时不需要定义数组大小（与 PHP 类似）",
            "创建一个简单的数组 my_array：",
            "我们也可以使用数字下标来定义数组:",
            "读取数组元素值的一般格式是："
          ],
          applications: [
            "示例：#!/bin/bash",
            "示例：array_name=(value1 value2 ... valuen)",
            "示例：${array_name[index]}",
            "示例：declare -A array_name",
            "示例：printf format-string [arguments...]",
            "示例：# 简单字符串输出"
          ],
          pitfalls: [
            "0表示没有错误，其他任何值表明有错误",
            "例如，两个数相加(注意使用的是反引号 ` 而不是单引号 ')：",
            "表达式和运算符之间要有空格，例如 2+2 是不对的，必须写成 2 + 2，这与我们熟悉的大多数编程语言不一样",
            "完整的表达式要被 ` ` 包含，注意这个字符不是常用的单引号，在 Esc 键下边",
            "注意：条件表达式要放在方括号之间，并且要有空格，例如: [$a==$b] 是错误的，必须写成 [ $a == $b ]"
          ],
          method: "按站内顺序读「Shell 传递参数 → Shell 数组 → Shell 基本运算符 → Shell echo 命令 | 菜鸟教程 → Shell printf 命令 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 8 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Shell 传递参数、实例、Shell 数组」的用法，并把 8 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Shell 传递参数】Shell 传递参数：我们可以在执行 Shell 脚本时，向脚本传递参数，脚本内获取参数的格式为 $n，n 代表一个数字，1 为执行脚本的第一个参数，2 为执行脚本的第二个参数",
              "【Shell 传递参数】实例：以下实例我们向脚本传递三个参数，并分别输出，其中 $0 为执行的文件名（包含文件路径）：",
              "【Shell 数组】Shell 数组：Bash Shell 只支持一维数组（不支持多维数组），初始化时不需要定义数组大小（与 PHP 类似）",
              "【Shell 数组】实例：创建一个简单的数组 my_array：",
              "【Shell 数组】读取数组：读取数组元素值的一般格式是：",
              "【Shell 数组】关联数组：Bash 支持关联数组，可以使用任意的字符串、或者整数作为下标来访问数组元素"
            ],
            mechanism: [
              "我们可以在执行 Shell 脚本时，向脚本传递参数，脚本内获取参数的格式为 $n，n 代表一个数字，1 为执行脚本的第一个参数，2 为执行脚本的第二个参数",
              "例如可以使用 $1、$2 等来引用传递给脚本的参数，其中 $1 表示第一个参数，$2 表示第二个参数，依此类推",
              "以下实例我们向脚本传递三个参数，并分别输出，其中 $0 为执行的文件名（包含文件路径）：",
              "为脚本设置可执行权限，并执行脚本，输出结果如下所示：",
              "另外，还有几个特殊字符用来处理参数：",
              "以一个单字符串显示所有向脚本传递的参数",
              "如\"$*\"用「\"」括起来的情况、以\"$1 $2 … $n\"的形式输出所有参数",
              "后台运行的最后一个进程的ID号",
              "与$*相同，但是使用时加引号，并在引号中返回每个参数",
              "如\"$@\"用「\"」括起来的情况、以\"$1\" \"$2\" … \"$n\" 的形式输出所有参数"
            ],
            example: {
              title: "MySQL 安装配置 · MySQL 配置",
              language: "bash",
              code: "$ cat /etc/my.cnf\n\n[client]\nport = 3306\nsocket = /tmp/mysql.sock\n[mysqld]\nreplicate-ignore-db = mysql\nreplicate-ignore-db = test\nreplicate-ignore-db = information_schema\nuser = mysql\nport = 3306\nsocket = /tmp/mysql.sock\nbasedir = /usr/local/webserver/mysql\ndatadir = /www/data_mysql\nlog-error = /usr/local/webserver/mysql/mysql_error.log\npid-file = /usr/local/webserver/mysql/mysql.pid\nopen_files_limit = 65535\nback_log = 600\nmax_connections = 5000\nmax_connect_errors = 1000\ntable_open_cache = 1024\nexternal-locking = FALSE\nmax_allowed_packet = 32M\nsort_buffer_size = 1M\njoin_buffer_size = 1M\nthread_cache_size = 600\n#thread_concurrency = 8\nquery_cache_size = 128M\nquery_cache_limit = 2M\nquery_cache_min_res_unit = 2k\ndefault-storage-engine = MyISAM\ndefault-tmp-storage-engine=MYISAM\nthread_stack = 192K\ntransaction_isolation = READ-COMMITTED\ntmp_table_size = 128M\nmax_heap_table_size = 128M\nlog-slave-updates\nlog-bin = /usr/local/webserver/mysql/binlog/binlog\nbinlog-do-db=oa_fb\nbinlog-ignore-db=mysql\nbinlog_cache_size = 4M\nbinlog_format = MIXED\nmax_binlog_cache_size = 8M\nmax_binlog_size = 1G\nrelay-log-index = /usr/local/webserver/mysql/relaylog/relaylog\nrelay-log-info-file = /usr/local/webserver/mysql/relaylog/relaylog\nrelay-log = /usr/local/webserver/mysql/relaylog/relaylog\nexpire_logs_days = 10\nkey_buffer_size = 256M\nread_buffer_size = 1M\nread_rnd_buffer_size = 16M\nbulk_insert_buffer_size = 64M\nmyisam_sort_buffer_size = 128M\nmyisam_max_sort_file_size = 10G\nmyisam_repair_threads = 1\nmyisam_recover\ninteractive_timeout = 120\nwait_timeout = 120\nskip-name-resolve\n#master-connect-retry = 10",
              explanation: "1、创建mysql运行使用的用户mysql："
            },
            practiceSteps: [
              "先通读本节 13 页：Shell 传递参数、Shell 数组、Shell 基本运算符、Shell echo 命令 | 菜鸟教程 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 8 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Linux 网络、软件包与 Shell」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 8 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-linux-8",
        "rn-linux-9",
        "rn-linux-10",
        "rn-linux-11",
        "rn-linux-14",
        "rn-linux-20",
        "rn-linux-1",
        "rn-linux-2",
        "rn-linux-4",
        "rn-linux-5",
        "rn-linux-17",
        "rn-linux-19",
        "rn-linux-3",
        "rn-linux-6",
        "rn-linux-7",
        "rn-linux-12",
        "rn-linux-13",
        "rn-linux-15",
        "rn-linux-16",
        "rn-linux-18"
      ],
      lesson: {
        overview: [
          "《Linux 教程》取自菜鸟教程，共 31 页，整理为 3 个知识点、20 道配套测验题。",
          "知识点顺序保持站内阅读顺序：Linux 入门、目录与文件操作 → Linux 用户、权限与进程管理 → Linux 网络、软件包与 Shell。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 20 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 Linux 入门、目录与文件操作 并跑通示例",
            evidence: "本地示例输出与站点示例一致"
          },
          {
            title: "完成全部配套测验",
            evidence: "题正确率 ≥ 80%（共 20 道）"
          },
          {
            title: "能独立复述全部知识点",
            evidence: "不看文档说出每个知识点的用法与易错点"
          }
        ],
        completionCriteria: ["《Linux 教程》3 个知识点全部读完。", "配套 20 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    }
  ],
  questions: [
    {
      key: "rn-sql-1",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-1",
      type: "single",
      stem: "SQL 的全称是什么？",
      options: [
        {
          key: "A",
          text: "Structured Query Language"
        },
        {
          key: "B",
          text: "Simple Query Language"
        },
        {
          key: "C",
          text: "Sequential Query Language"
        },
        {
          key: "D",
          text: "Standard Query Language"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. Structured Query Language\n\n回答错误，正确答案是 Structured Query Language。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-3",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-1",
      type: "single",
      stem: "用于向表中插入新数据的 SQL 语句是？",
      options: [
        {
          key: "A",
          text: "INSERT"
        },
        {
          key: "B",
          text: "SELECT"
        },
        {
          key: "C",
          text: "UPDATE"
        },
        {
          key: "D",
          text: "DELETE"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. INSERT\n\n回答错误，正确答案是 INSERT。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-10",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-1",
      type: "single",
      stem: "用于从表中选择所有列的 SQL 语法是？",
      options: [
        {
          key: "A",
          text: "SELECT * FROM 表名"
        },
        {
          key: "B",
          text: "SELECT ALL FROM 表名"
        },
        {
          key: "C",
          text: "SELECT FROM 表名"
        },
        {
          key: "D",
          text: "SELECT 列名 FROM 表名"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. SELECT * FROM 表名\n\n回答错误，正确答案是 SELECT * FROM 表名。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-7",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-2",
      type: "single",
      stem: "用于删除表结构的 SQL 语句是？",
      options: [
        {
          key: "A",
          text: "DROP TABLE"
        },
        {
          key: "B",
          text: "DELETE TABLE"
        },
        {
          key: "C",
          text: "REMOVE TABLE"
        },
        {
          key: "D",
          text: "ERASE TABLE"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. DROP TABLE\n\n回答错误，正确答案是 DROP TABLE。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-11",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-2",
      type: "single",
      stem: "用于对查询结果排序的 SQL 子句是？",
      options: [
        {
          key: "A",
          text: "ORDER BY"
        },
        {
          key: "B",
          text: "GROUP BY"
        },
        {
          key: "C",
          text: "SORT BY"
        },
        {
          key: "D",
          text: "ARRANGE BY"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. ORDER BY\n\n回答错误，正确答案是 ORDER BY。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-14",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-2",
      type: "single",
      stem: "用于限制查询结果数量的 SQL 子句是？",
      options: [
        {
          key: "A",
          text: "LIMIT"
        },
        {
          key: "B",
          text: "TOP"
        },
        {
          key: "C",
          text: "ROWNUM"
        },
        {
          key: "D",
          text: "MAX"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. LIMIT\n\n回答错误，正确答案是 LIMIT（MySQL/SQLite），其他数据库有不同写法。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-2",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-3",
      type: "single",
      stem: "用于从数据库表中查询数据的 SQL 语句是？",
      options: [
        {
          key: "A",
          text: "SELECT"
        },
        {
          key: "B",
          text: "INSERT"
        },
        {
          key: "C",
          text: "UPDATE"
        },
        {
          key: "D",
          text: "DELETE"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. SELECT\n\n回答错误，正确答案是 SELECT。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-6",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-3",
      type: "single",
      stem: "用于创建新表的 SQL 语句是？",
      options: [
        {
          key: "A",
          text: "CREATE TABLE"
        },
        {
          key: "B",
          text: "NEW TABLE"
        },
        {
          key: "C",
          text: "MAKE TABLE"
        },
        {
          key: "D",
          text: "ADD TABLE"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. CREATE TABLE\n\n回答错误，正确答案是 CREATE TABLE。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-8",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-3",
      type: "single",
      stem: "用于修改表结构的 SQL 语句是？",
      options: [
        {
          key: "A",
          text: "ALTER TABLE"
        },
        {
          key: "B",
          text: "CHANGE TABLE"
        },
        {
          key: "C",
          text: "MODIFY TABLE"
        },
        {
          key: "D",
          text: "UPDATE TABLE"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. ALTER TABLE\n\n回答错误，正确答案是 ALTER TABLE。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-15",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-3",
      type: "single",
      stem: "用于去除重复记录的 SQL 关键字是？",
      options: [
        {
          key: "A",
          text: "DISTINCT"
        },
        {
          key: "B",
          text: "UNIQUE"
        },
        {
          key: "C",
          text: "ONLY"
        },
        {
          key: "D",
          text: "DIFFERENT"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. DISTINCT\n\n回答错误，正确答案是 DISTINCT。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-5",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-4",
      type: "single",
      stem: "用于删除表中数据的 SQL 语句是？",
      options: [
        {
          key: "A",
          text: "DELETE"
        },
        {
          key: "B",
          text: "DROP"
        },
        {
          key: "C",
          text: "REMOVE"
        },
        {
          key: "D",
          text: "ERASE"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. DELETE\n\n回答错误，正确答案是 DELETE。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-17",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-4",
      type: "single",
      stem: "用于计算总和的 SQL 聚合函数是？",
      options: [
        {
          key: "A",
          text: "SUM()"
        },
        {
          key: "B",
          text: "COUNT()"
        },
        {
          key: "C",
          text: "AVG()"
        },
        {
          key: "D",
          text: "TOTAL()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. SUM()\n\n回答错误，正确答案是 SUM()。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-16",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-5",
      type: "single",
      stem: "用于统计行数的 SQL 聚合函数是？",
      options: [
        {
          key: "A",
          text: "COUNT()"
        },
        {
          key: "B",
          text: "SUM()"
        },
        {
          key: "C",
          text: "AVG()"
        },
        {
          key: "D",
          text: "TOTAL()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. COUNT()\n\n回答错误，正确答案是 COUNT()。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-18",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-5",
      type: "single",
      stem: "用于计算平均值的 SQL 聚合函数是？",
      options: [
        {
          key: "A",
          text: "AVG()"
        },
        {
          key: "B",
          text: "SUM()"
        },
        {
          key: "C",
          text: "COUNT()"
        },
        {
          key: "D",
          text: "MEAN()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. AVG()\n\n回答错误，正确答案是 AVG()。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-19",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-5",
      type: "single",
      stem: "用于查找最大值的 SQL 聚合函数是？",
      options: [
        {
          key: "A",
          text: "MAX()"
        },
        {
          key: "B",
          text: "MIN()"
        },
        {
          key: "C",
          text: "TOP()"
        },
        {
          key: "D",
          text: "HIGHEST()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. MAX()\n\n回答错误，正确答案是 MAX()。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-20",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-5",
      type: "single",
      stem: "用于查找最小值的 SQL 聚合函数是？",
      options: [
        {
          key: "A",
          text: "MIN()"
        },
        {
          key: "B",
          text: "MAX()"
        },
        {
          key: "C",
          text: "LOWEST()"
        },
        {
          key: "D",
          text: "BOTTOM()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. MIN()\n\n回答错误，正确答案是 MIN()。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-4",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-6",
      type: "single",
      stem: "用于修改表中已有数据的 SQL 语句是？",
      options: [
        {
          key: "A",
          text: "UPDATE"
        },
        {
          key: "B",
          text: "SELECT"
        },
        {
          key: "C",
          text: "INSERT"
        },
        {
          key: "D",
          text: "DELETE"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. UPDATE\n\n回答错误，正确答案是 UPDATE。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-9",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-6",
      type: "single",
      stem: "SQL 语句结束时通常用什么符号？",
      options: [
        {
          key: "A",
          text: ";"
        },
        {
          key: "B",
          text: "."
        },
        {
          key: "C",
          text: ","
        },
        {
          key: "D",
          text: ":"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. ;\n\n回答错误，正确答案是 ;。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-12",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-6",
      type: "single",
      stem: "用于分组查询结果的 SQL 子句是？",
      options: [
        {
          key: "A",
          text: "GROUP BY"
        },
        {
          key: "B",
          text: "ORDER BY"
        },
        {
          key: "C",
          text: "SORT BY"
        },
        {
          key: "D",
          text: "COLLECT BY"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. GROUP BY\n\n回答错误，正确答案是 GROUP BY。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-sql-13",
      stageKey: "rn-sql-stage",
      topicKey: "rn-sql-6",
      type: "single",
      stem: "用于筛选查询结果的 SQL 子句是？",
      options: [
        {
          key: "A",
          text: "WHERE"
        },
        {
          key: "B",
          text: "HAVING"
        },
        {
          key: "C",
          text: "IF"
        },
        {
          key: "D",
          text: "FILTER"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. WHERE\n\n回答错误，正确答案是 WHERE。\n\n考点：SQL 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["SQL", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-2",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-1",
      type: "single",
      stem: "以下哪个函数用于创建全零数组？",
      options: [
        {
          key: "A",
          text: "np.zeros()"
        },
        {
          key: "B",
          text: "np.ones()"
        },
        {
          key: "C",
          text: "np.empty()"
        },
        {
          key: "D",
          text: "np.full()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. np.zeros()\n\n回答错误，正确答案为 np.zeros()。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-3",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-1",
      type: "single",
      stem: "以下哪个函数用于创建全一数组？",
      options: [
        {
          key: "A",
          text: "np.zeros()"
        },
        {
          key: "B",
          text: "np.empty()"
        },
        {
          key: "C",
          text: "np.full()"
        },
        {
          key: "D",
          text: "np.ones()"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. np.ones()\n\n回答错误，正确答案为 np.ones()。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-4",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-1",
      type: "single",
      stem: "以下哪个函数用于创建指定形状和值的数组？",
      options: [
        {
          key: "A",
          text: "np.full()"
        },
        {
          key: "B",
          text: "np.zeros()"
        },
        {
          key: "C",
          text: "np.ones()"
        },
        {
          key: "D",
          text: "np.empty()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. np.full()\n\n回答错误，正确答案为 np.full()。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-5",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-1",
      type: "single",
      stem: "以下哪个函数用于生成等差数列？",
      options: [
        {
          key: "A",
          text: "np.linspace()"
        },
        {
          key: "B",
          text: "np.range()"
        },
        {
          key: "C",
          text: "np.arange()"
        },
        {
          key: "D",
          text: "np.sequence()"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. np.arange()\n\n回答错误，正确答案为 np.arange()。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-6",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-1",
      type: "single",
      stem: "以下哪个函数用于生成等间隔的数值？",
      options: [
        {
          key: "A",
          text: "np.linspace()"
        },
        {
          key: "B",
          text: "np.arange()"
        },
        {
          key: "C",
          text: "np.range()"
        },
        {
          key: "D",
          text: "np.sequence()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. np.linspace()\n\n回答错误，正确答案为 np.linspace()。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-7",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-1",
      type: "single",
      stem: "以下哪个属性用于查看数组的形状？",
      options: [
        {
          key: "A",
          text: "array.size"
        },
        {
          key: "B",
          text: "array.shape"
        },
        {
          key: "C",
          text: "array.ndim"
        },
        {
          key: "D",
          text: "array.dtype"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. array.shape\n\n回答错误，正确答案为 array.shape。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-10",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-1",
      type: "single",
      stem: "以下哪个属性用于查看数组的元素类型？",
      options: [
        {
          key: "A",
          text: "array.dtype"
        },
        {
          key: "B",
          text: "array.type"
        },
        {
          key: "C",
          text: "array.element_type"
        },
        {
          key: "D",
          text: "array.data_type"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. array.dtype\n\n回答错误，正确答案为 array.dtype。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-12",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-2",
      type: "single",
      stem: "以下哪个函数用于水平拼接数组？",
      options: [
        {
          key: "A",
          text: "np.hstack()"
        },
        {
          key: "B",
          text: "np.vstack()"
        },
        {
          key: "C",
          text: "np.concatenate()"
        },
        {
          key: "D",
          text: "np.stack()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. np.hstack()\n\n回答错误，正确答案为 np.hstack()。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-13",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-2",
      type: "single",
      stem: "以下哪个函数用于垂直拼接数组？",
      options: [
        {
          key: "A",
          text: "np.hstack()"
        },
        {
          key: "B",
          text: "np.concatenate()"
        },
        {
          key: "C",
          text: "np.vstack()"
        },
        {
          key: "D",
          text: "np.stack()"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. np.vstack()\n\n回答错误，正确答案为 np.vstack()。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-15",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-2",
      type: "single",
      stem: "以下哪个函数用于计算数组的中位数？",
      options: [
        {
          key: "A",
          text: "np.mean()"
        },
        {
          key: "B",
          text: "np.median()"
        },
        {
          key: "C",
          text: "np.average()"
        },
        {
          key: "D",
          text: "np.mode()"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. np.median()\n\n回答错误，正确答案为 np.median()。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-16",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-2",
      type: "single",
      stem: "以下哪个函数用于计算数组的标准差？",
      options: [
        {
          key: "A",
          text: "np.std()"
        },
        {
          key: "B",
          text: "np.var()"
        },
        {
          key: "C",
          text: "np.mean()"
        },
        {
          key: "D",
          text: "np.median()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. np.std()\n\n回答错误，正确答案为 np.std()。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-18",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-2",
      type: "single",
      stem: "以下哪个函数用于对数组进行排序？",
      options: [
        {
          key: "A",
          text: "np.sort()"
        },
        {
          key: "B",
          text: "np.order()"
        },
        {
          key: "C",
          text: "np.arrange()"
        },
        {
          key: "D",
          text: "np.sequence()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. np.sort()\n\n回答错误，正确答案为 np.sort()。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-19",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-2",
      type: "single",
      stem: "以下哪个函数用于查找数组中的最大值？",
      options: [
        {
          key: "A",
          text: "np.max()"
        },
        {
          key: "B",
          text: "np.maximum()"
        },
        {
          key: "C",
          text: "np.argmax()"
        },
        {
          key: "D",
          text: "np.highest()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. np.max()\n\n回答错误，正确答案为 np.max()。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-20",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-2",
      type: "single",
      stem: "以下哪个函数用于查找数组中的最小值？",
      options: [
        {
          key: "A",
          text: "np.minimum()"
        },
        {
          key: "B",
          text: "np.argmin()"
        },
        {
          key: "C",
          text: "np.min()"
        },
        {
          key: "D",
          text: "np.lowest()"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. np.min()\n\n回答错误，正确答案为 np.min()。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-1",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-3",
      type: "single",
      stem: "NumPy 中用于创建数组的函数是？",
      options: [
        {
          key: "A",
          text: "np.create_array()"
        },
        {
          key: "B",
          text: "np.array()"
        },
        {
          key: "C",
          text: "np.new_array()"
        },
        {
          key: "D",
          text: "np.make_array()"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. np.array()\n\n回答错误，正确答案为 np.array()。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-8",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-3",
      type: "single",
      stem: "以下哪个属性用于查看数组的维度？",
      options: [
        {
          key: "A",
          text: "array.shape"
        },
        {
          key: "B",
          text: "array.size"
        },
        {
          key: "C",
          text: "array.ndim"
        },
        {
          key: "D",
          text: "array.dtype"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. array.ndim\n\n回答错误，正确答案为 array.ndim。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-9",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-3",
      type: "single",
      stem: "以下哪个属性用于查看数组的元素总数？",
      options: [
        {
          key: "A",
          text: "array.shape"
        },
        {
          key: "B",
          text: "array.ndim"
        },
        {
          key: "C",
          text: "array.dtype"
        },
        {
          key: "D",
          text: "array.size"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. array.size\n\n回答错误，正确答案为 array.size。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-11",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-3",
      type: "single",
      stem: "以下哪个函数用于改变数组的形状？",
      options: [
        {
          key: "A",
          text: "np.resize()"
        },
        {
          key: "B",
          text: "np.reshape()"
        },
        {
          key: "C",
          text: "np.change_shape()"
        },
        {
          key: "D",
          text: "np.modify_shape()"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. np.reshape()\n\n回答错误，正确答案为 np.reshape()。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-14",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-3",
      type: "single",
      stem: "以下哪个函数用于计算数组的均值？",
      options: [
        {
          key: "A",
          text: "np.average()"
        },
        {
          key: "B",
          text: "np.mean()"
        },
        {
          key: "C",
          text: "np.median()"
        },
        {
          key: "D",
          text: "np.mode()"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. np.mean()\n\n回答错误，正确答案为 np.mean()。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-numpy-17",
      stageKey: "rn-numpy-stage",
      topicKey: "rn-numpy-3",
      type: "single",
      stem: "以下哪个函数用于计算数组的方差？",
      options: [
        {
          key: "A",
          text: "np.std()"
        },
        {
          key: "B",
          text: "np.mean()"
        },
        {
          key: "C",
          text: "np.var()"
        },
        {
          key: "D",
          text: "np.median()"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. np.var()\n\n回答错误，正确答案为 np.var()。\n\n考点：NumPy 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["NumPy", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-4",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-1",
      type: "single",
      stem: "以下哪个方法用于查看 DataFrame 的列名？",
      options: [
        {
          key: "A",
          text: "df.columns"
        },
        {
          key: "B",
          text: "df.get_columns()"
        },
        {
          key: "C",
          text: "df.colnames()"
        },
        {
          key: "D",
          text: "df.get_colnames()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. df.columns\n\n回答错误，正确答案为 df.columns。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-6",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-1",
      type: "single",
      stem: "以下哪个方法用于统计 DataFrame 的基本信息？",
      options: [
        {
          key: "A",
          text: "df.info()"
        },
        {
          key: "B",
          text: "df.describe()"
        },
        {
          key: "C",
          text: "df.summary()"
        },
        {
          key: "D",
          text: "df.statistics()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. df.info()\n\n回答错误，正确答案为 df.info()。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-8",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-1",
      type: "single",
      stem: "以下哪个方法用于选择 DataFrame 的某一列？",
      options: [
        {
          key: "A",
          text: "df[\"column_name\"]"
        },
        {
          key: "B",
          text: "df.select(\"column_name\")"
        },
        {
          key: "C",
          text: "df.get_column(\"column_name\")"
        },
        {
          key: "D",
          text: "df.pick(\"column_name\")"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. df[\"column_name\"]\n\n回答错误，正确答案为 df[\"column_name\"]。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-19",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-1",
      type: "single",
      stem: "以下哪个方法用于计算 DataFrame 的缺失值？",
      options: [
        {
          key: "A",
          text: "df.isnull()"
        },
        {
          key: "B",
          text: "df.isnan()"
        },
        {
          key: "C",
          text: "df.isna()"
        },
        {
          key: "D",
          text: "df.is_missing()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. df.isnull()\n\n回答错误，正确答案为 df.isnull()。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-5",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-2",
      type: "single",
      stem: "以下哪个方法用于查看 DataFrame 的数据类型？",
      options: [
        {
          key: "A",
          text: "df.dtypes"
        },
        {
          key: "B",
          text: "df.types"
        },
        {
          key: "C",
          text: "df.datatypes"
        },
        {
          key: "D",
          text: "df.get_types()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. df.dtypes\n\n回答错误，正确答案为 df.dtypes。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-10",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-2",
      type: "single",
      stem: "以下哪个方法用于按条件筛选 DataFrame 的数据？",
      options: [
        {
          key: "A",
          text: "df[df[\"column_name\"] > 10]"
        },
        {
          key: "B",
          text: "df.filter(\"column_name > 10\")"
        },
        {
          key: "C",
          text: "df.query(\"column_name > 10\")"
        },
        {
          key: "D",
          text: "df.select(\"column_name > 10\")"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. df[df[\"column_name\"] > 10]\n\n回答错误，正确答案为 df[df[\"column_name\"] > 10]。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-16",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-2",
      type: "single",
      stem: "以下哪个方法用于对 DataFrame 按索引排序？",
      options: [
        {
          key: "A",
          text: "df.sort_index()"
        },
        {
          key: "B",
          text: "df.sort_by_index()"
        },
        {
          key: "C",
          text: "df.order_by_index()"
        },
        {
          key: "D",
          text: "df.arrange_by_index()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. df.sort_index()\n\n回答错误，正确答案为 df.sort_index()。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-17",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-2",
      type: "single",
      stem: "以下哪个方法用于将 DataFrame 的索引重置为默认值？",
      options: [
        {
          key: "A",
          text: "df.reset_index()"
        },
        {
          key: "B",
          text: "df.clear_index()"
        },
        {
          key: "C",
          text: "df.drop_index()"
        },
        {
          key: "D",
          text: "df.default_index()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. df.reset_index()\n\n回答错误，正确答案为 df.reset_index()。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-1",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-3",
      type: "single",
      stem: "Pandas 中用于创建 DataFrame 的方法是？",
      options: [
        {
          key: "A",
          text: "pd.DataFrame()"
        },
        {
          key: "B",
          text: "pd.create_dataframe()"
        },
        {
          key: "C",
          text: "pd.new_dataframe()"
        },
        {
          key: "D",
          text: "pd.make_dataframe()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. pd.DataFrame()\n\n回答错误，正确答案为 pd.DataFrame()。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-15",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-3",
      type: "single",
      stem: "以下哪个方法用于对 DataFrame 按列排序？",
      options: [
        {
          key: "A",
          text: "df.sort_values(by=\"column_name\")"
        },
        {
          key: "B",
          text: "df.sort(by=\"column_name\")"
        },
        {
          key: "C",
          text: "df.order(by=\"column_name\")"
        },
        {
          key: "D",
          text: "df.arrange(by=\"column_name\")"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. df.sort_values(by=\"column_name\")\n\n回答错误，正确答案为 df.sort_values(by=\"column_name\")。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-18",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-3",
      type: "single",
      stem: "以下哪个方法用于将 DataFrame 按列分组？",
      options: [
        {
          key: "A",
          text: "df.groupby(\"column_name\")"
        },
        {
          key: "B",
          text: "df.group_by(\"column_name\")"
        },
        {
          key: "C",
          text: "df.split_by(\"column_name\")"
        },
        {
          key: "D",
          text: "df.partition(\"column_name\")"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. df.groupby(\"column_name\")\n\n回答错误，正确答案为 df.groupby(\"column_name\")。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-20",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-3",
      type: "single",
      stem: "以下哪个方法用于填充 DataFrame 的缺失值？",
      options: [
        {
          key: "A",
          text: "df.fillna(value)"
        },
        {
          key: "B",
          text: "df.replace_na(value)"
        },
        {
          key: "C",
          text: "df.fill_missing(value)"
        },
        {
          key: "D",
          text: "df.replace_missing(value)"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. df.fillna(value)\n\n回答错误，正确答案为 df.fillna(value)。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-7",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-4",
      type: "single",
      stem: "以下哪个方法用于统计 DataFrame 的描述性统计信息？",
      options: [
        {
          key: "A",
          text: "df.describe()"
        },
        {
          key: "B",
          text: "df.info()"
        },
        {
          key: "C",
          text: "df.summary()"
        },
        {
          key: "D",
          text: "df.statistics()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. df.describe()\n\n回答错误，正确答案为 df.describe()。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-9",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-4",
      type: "single",
      stem: "以下哪个方法用于选择 DataFrame 的某几行？",
      options: [
        {
          key: "A",
          text: "df.loc[]"
        },
        {
          key: "B",
          text: "df.select_rows()"
        },
        {
          key: "C",
          text: "df.get_rows()"
        },
        {
          key: "D",
          text: "df.pick_rows()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. df.loc[]\n\n回答错误，正确答案为 df.loc[]。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-11",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-4",
      type: "single",
      stem: "以下哪个方法用于删除 DataFrame 的某一列？",
      options: [
        {
          key: "A",
          text: "df.drop(\"column_name\", axis=1)"
        },
        {
          key: "B",
          text: "df.remove(\"column_name\")"
        },
        {
          key: "C",
          text: "df.delete(\"column_name\")"
        },
        {
          key: "D",
          text: "df.pop(\"column_name\")"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. df.drop(\"column_name\", axis=1)\n\n回答错误，正确答案为 df.drop(\"column_name\", axis=1)。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-12",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-4",
      type: "single",
      stem: "以下哪个方法用于重命名 DataFrame 的列名？",
      options: [
        {
          key: "A",
          text: "df.rename(columns={\"old_name\": \"new_name\"})"
        },
        {
          key: "B",
          text: "df.rename_columns({\"old_name\": \"new_name\"})"
        },
        {
          key: "C",
          text: "df.change_columns({\"old_name\": \"new_name\"})"
        },
        {
          key: "D",
          text: "df.update_columns({\"old_name\": \"new_name\"})"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. df.rename(columns={\"old_name\": \"new_name\"})\n\n回答错误，正确答案为 df.rename(columns={\"old_name\": \"new_name\"})。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-13",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-4",
      type: "single",
      stem: "以下哪个方法用于将 DataFrame 保存为 CSV 文件？",
      options: [
        {
          key: "A",
          text: "df.to_csv(\"file.csv\")"
        },
        {
          key: "B",
          text: "df.save_csv(\"file.csv\")"
        },
        {
          key: "C",
          text: "df.export_csv(\"file.csv\")"
        },
        {
          key: "D",
          text: "df.write_csv(\"file.csv\")"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. df.to_csv(\"file.csv\")\n\n回答错误，正确答案为 df.to_csv(\"file.csv\")。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-2",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-5",
      type: "single",
      stem: "以下哪个方法用于读取 CSV 文件？",
      options: [
        {
          key: "A",
          text: "pd.read_csv()"
        },
        {
          key: "B",
          text: "pd.load_csv()"
        },
        {
          key: "C",
          text: "pd.open_csv()"
        },
        {
          key: "D",
          text: "pd.import_csv()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. pd.read_csv()\n\n回答错误，正确答案为 pd.read_csv()。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-3",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-5",
      type: "single",
      stem: "以下哪个方法用于查看 DataFrame 的前几行数据？",
      options: [
        {
          key: "A",
          text: "df.head()"
        },
        {
          key: "B",
          text: "df.top()"
        },
        {
          key: "C",
          text: "df.first()"
        },
        {
          key: "D",
          text: "df.preview()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. df.head()\n\n回答错误，正确答案为 df.head()。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-pandas-14",
      stageKey: "rn-pandas-stage",
      topicKey: "rn-pandas-5",
      type: "single",
      stem: "以下哪个方法用于将 DataFrame 转换为 NumPy 数组？",
      options: [
        {
          key: "A",
          text: "df.to_numpy()"
        },
        {
          key: "B",
          text: "df.to_array()"
        },
        {
          key: "C",
          text: "df.as_numpy()"
        },
        {
          key: "D",
          text: "df.as_array()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. df.to_numpy()\n\n回答错误，正确答案为 df.to_numpy()。\n\n考点：Pandas 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Pandas", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-git-1",
      stageKey: "rn-git-stage",
      topicKey: "rn-git-1",
      type: "single",
      stem: "Git 是什么？",
      options: [
        {
          key: "A",
          text: "Git 是 SVN"
        },
        {
          key: "B",
          text: "Git 是 Github 的简写"
        },
        {
          key: "C",
          text: "是编程语言"
        },
        {
          key: "D",
          text: "分布式版本控制系统"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 分布式版本控制系统\n\n回答错误，Git 是一个分布式版本控制系统。\n\n考点：Git 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Git", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-git-4",
      stageKey: "rn-git-stage",
      topicKey: "rn-git-1",
      type: "single",
      stem: "提交修改先使用以下哪个命令？",
      options: [
        {
          key: "A",
          text: "git add"
        },
        {
          key: "B",
          text: "git commit"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. git add\n\ncommit 之前需要使用 git add 命令将该文件添加到暂存区。\n\n考点：Git 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Git", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-git-5",
      stageKey: "rn-git-stage",
      topicKey: "rn-git-1",
      type: "single",
      stem: "以下哪个命令是正确的提交所有更改的注释？",
      options: [
        {
          key: "A",
          text: "git message -am \"I'm coding\""
        },
        {
          key: "B",
          text: "git add -a \"I'm coding\""
        },
        {
          key: "C",
          text: "git commit -a \"I'm coding\""
        },
        {
          key: "D",
          text: "git commit -am \"I'm coding\""
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. git commit -am \"I'm coding\"\n\n回答错误，正确答案为 git commit -am \"I'm coding\"\n\n考点：Git 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Git", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-git-6",
      stageKey: "rn-git-stage",
      topicKey: "rn-git-1",
      type: "single",
      stem: "以下哪个命令是正确的提交注释？",
      options: [
        {
          key: "A",
          text: "git message \"I like runoob\""
        },
        {
          key: "B",
          text: "git add \"I like runoob\""
        },
        {
          key: "C",
          text: "git commit \"I like runoob\""
        },
        {
          key: "D",
          text: "git commit -m \"I like runoob\""
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. git commit -m \"I like runoob\"\n\n回答错误，正确答案为 git commit -m \"I like runoob\"。\n\n考点：Git 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Git", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-git-7",
      stageKey: "rn-git-stage",
      topicKey: "rn-git-2",
      type: "single",
      stem: "以下哪个命令是将所有修改提交到暂存区？",
      options: [
        {
          key: "A",
          text: "git commit add ."
        },
        {
          key: "B",
          text: "git commit ."
        },
        {
          key: "C",
          text: "git add ."
        },
        {
          key: "D",
          text: "git push -am \"Message\""
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. git add .\n\n回答错误，正确答案为 git add .\n\n考点：Git 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Git", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-git-8",
      stageKey: "rn-git-stage",
      topicKey: "rn-git-2",
      type: "single",
      stem: "以下哪个命令用于查看在你上次提交之后是否有对文件进行再次修改？",
      options: [
        {
          key: "A",
          text: "git check"
        },
        {
          key: "B",
          text: "git status"
        },
        {
          key: "C",
          text: "git commit"
        },
        {
          key: "D",
          text: "git diff"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. git status\n\n回答错误，正确答案为 git status。\n\n考点：Git 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Git", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-git-9",
      stageKey: "rn-git-stage",
      topicKey: "rn-git-2",
      type: "single",
      stem: "以下哪个命令用于提交到暂存区？",
      options: [
        {
          key: "A",
          text: "git stage"
        },
        {
          key: "B",
          text: "git commit"
        },
        {
          key: "C",
          text: "git add"
        },
        {
          key: "D",
          text: "git reset"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. git add\n\n回答错误，正确为 git add。\n\n考点：Git 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Git", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-git-2",
      stageKey: "rn-git-stage",
      topicKey: "rn-git-3",
      type: "single",
      stem: "将仓库从 GitHub 下载到本地的 git 命令是什么？",
      options: [
        {
          key: "A",
          text: "git push"
        },
        {
          key: "B",
          text: "git fork"
        },
        {
          key: "C",
          text: "git clone"
        },
        {
          key: "D",
          text: "git commit"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. git clone\n\n回答错误，正确答案为 git clone。\n\n考点：Git 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Git", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-git-3",
      stageKey: "rn-git-stage",
      topicKey: "rn-git-3",
      type: "single",
      stem: "如何将本地仓库上传到远程仓库？",
      options: [
        {
          key: "A",
          text: "git push"
        },
        {
          key: "B",
          text: "git add"
        },
        {
          key: "C",
          text: "git upload"
        },
        {
          key: "D",
          text: "git status"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. git push\n\ngit push 可以将本地仓库上传到远程仓库。\n\n考点：Git 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Git", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-8",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-1",
      type: "single",
      stem: "复制文件的命令是？",
      options: [
        {
          key: "A",
          text: "copy"
        },
        {
          key: "B",
          text: "cp"
        },
        {
          key: "C",
          text: "mv"
        },
        {
          key: "D",
          text: "cat"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. cp\n\n回答错误，正确答案为 cp\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-9",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-1",
      type: "single",
      stem: "移动文件的命令是？",
      options: [
        {
          key: "A",
          text: "rm"
        },
        {
          key: "B",
          text: "mv"
        },
        {
          key: "C",
          text: "cp"
        },
        {
          key: "D",
          text: "touch"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. mv\n\n回答错误，正确答案为 mv\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-10",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-1",
      type: "single",
      stem: "显示当前运行进程状态的命令是？",
      options: [
        {
          key: "A",
          text: "top"
        },
        {
          key: "B",
          text: "jobs"
        },
        {
          key: "C",
          text: "ps"
        },
        {
          key: "D",
          text: "list"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. ps\n\n回答错误，正确答案为 ps\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-11",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-1",
      type: "single",
      stem: "结束进程的命令是？",
      options: [
        {
          key: "A",
          text: "stop"
        },
        {
          key: "B",
          text: "end"
        },
        {
          key: "C",
          text: "kill"
        },
        {
          key: "D",
          text: "exit"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. kill\n\n回答错误，正确答案为 kill\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-14",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-1",
      type: "single",
      stem: "监视系统资源使用情况的命令是？",
      options: [
        {
          key: "A",
          text: "free"
        },
        {
          key: "B",
          text: "df"
        },
        {
          key: "C",
          text: "uptime"
        },
        {
          key: "D",
          text: "top"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. top\n\n回答错误，正确答案为 top\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-20",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-1",
      type: "single",
      stem: "显示当前用户信息的命令是？",
      options: [
        {
          key: "A",
          text: "id"
        },
        {
          key: "B",
          text: "whoami"
        },
        {
          key: "C",
          text: "user"
        },
        {
          key: "D",
          text: "grep"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. whoami\n\n回答错误，正确答案为 whoami\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-1",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-2",
      type: "single",
      stem: "查看当前工作目录的命令是？",
      options: [
        {
          key: "A",
          text: "cd"
        },
        {
          key: "B",
          text: "ls"
        },
        {
          key: "C",
          text: "pwd"
        },
        {
          key: "D",
          text: "mkdir"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. pwd\n\n回答错误，正确答案为 pwd\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-2",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-2",
      type: "single",
      stem: "列出目录内容的命令是？",
      options: [
        {
          key: "A",
          text: "rm"
        },
        {
          key: "B",
          text: "ls"
        },
        {
          key: "C",
          text: "pwd"
        },
        {
          key: "D",
          text: "mkdir"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. ls\n\n回答错误，正确答案为 ls\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-4",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-2",
      type: "single",
      stem: "删除文件的命令是？",
      options: [
        {
          key: "A",
          text: "delete"
        },
        {
          key: "B",
          text: "rm"
        },
        {
          key: "C",
          text: "rmdir"
        },
        {
          key: "D",
          text: "remove"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. rm\n\n回答错误，正确答案为 rm\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-5",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-2",
      type: "single",
      stem: "创建新目录的命令是？",
      options: [
        {
          key: "A",
          text: "touch"
        },
        {
          key: "B",
          text: "mkdir"
        },
        {
          key: "C",
          text: "cd"
        },
        {
          key: "D",
          text: "ls"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. mkdir\n\n回答错误，正确答案为 mkdir\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-17",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-2",
      type: "single",
      stem: "显示磁盘使用情况的命令是？",
      options: [
        {
          key: "A",
          text: "du"
        },
        {
          key: "B",
          text: "ls"
        },
        {
          key: "C",
          text: "ps"
        },
        {
          key: "D",
          text: "df"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. df\n\n回答错误，正确答案为 df\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-19",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-2",
      type: "single",
      stem: "更改文件所有者的命令是？",
      options: [
        {
          key: "A",
          text: "chgrp"
        },
        {
          key: "B",
          text: "chmod"
        },
        {
          key: "C",
          text: "chown"
        },
        {
          key: "D",
          text: "changeowner"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. chown\n\n回答错误，正确答案为 chown\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-3",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-3",
      type: "single",
      stem: "创建空文件的命令是？",
      options: [
        {
          key: "A",
          text: "touch"
        },
        {
          key: "B",
          text: "cat"
        },
        {
          key: "C",
          text: "rm"
        },
        {
          key: "D",
          text: "mkdir"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. touch\n\n回答错误，正确答案为 touch\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-6",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-3",
      type: "single",
      stem: "显示当前日期及时间的命令是？",
      options: [
        {
          key: "A",
          text: "clock"
        },
        {
          key: "B",
          text: "time"
        },
        {
          key: "C",
          text: "date"
        },
        {
          key: "D",
          text: "datetime"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. date\n\n回答错误，正确答案为 date\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-7",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-3",
      type: "single",
      stem: "查看文件内容的命令是？",
      options: [
        {
          key: "A",
          text: "ls"
        },
        {
          key: "B",
          text: "echo"
        },
        {
          key: "C",
          text: "cat"
        },
        {
          key: "D",
          text: "touch"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. cat\n\n回答错误，正确答案为 cat\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-12",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-3",
      type: "single",
      stem: "切换到超级用户的命令是？",
      options: [
        {
          key: "A",
          text: "sudo"
        },
        {
          key: "B",
          text: "su"
        },
        {
          key: "C",
          text: "admin"
        },
        {
          key: "D",
          text: "root"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. su\n\n回答错误，正确答案为 su\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-13",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-3",
      type: "single",
      stem: "显示网络接口配置的命令是？",
      options: [
        {
          key: "A",
          text: "netstat"
        },
        {
          key: "B",
          text: "route"
        },
        {
          key: "C",
          text: "ifconfig"
        },
        {
          key: "D",
          text: "ping"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. ifconfig\n\n回答错误，正确答案为 ifconfig\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-15",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-3",
      type: "single",
      stem: "查找文件的命令是？",
      options: [
        {
          key: "A",
          text: "locate"
        },
        {
          key: "B",
          text: "grep"
        },
        {
          key: "C",
          text: "find"
        },
        {
          key: "D",
          text: "search"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. find\n\n回答错误，正确答案为 find\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-16",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-3",
      type: "single",
      stem: "显示内存使用情况的命令是？",
      options: [
        {
          key: "A",
          text: "echo"
        },
        {
          key: "B",
          text: "ls"
        },
        {
          key: "C",
          text: "df"
        },
        {
          key: "D",
          text: "free"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. free\n\n回答错误，正确答案为 free\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-linux-18",
      stageKey: "rn-linux-stage",
      topicKey: "rn-linux-3",
      type: "single",
      stem: "更改文件权限的命令是？",
      options: [
        {
          key: "A",
          text: "chown"
        },
        {
          key: "B",
          text: "chmod"
        },
        {
          key: "C",
          text: "chgrp"
        },
        {
          key: "D",
          text: "chperm"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. chmod\n\n回答错误，正确答案为 chmod\n\n考点：Linux 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Linux", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    }
  ],
  sources: [
    {
      key: "runoob-com",
      name: "菜鸟教程（runoob.com）",
      url: "https://www.runoob.com",
      license: "站点声明 Copyright © 2013-2026（保留所有权利，未声明开源许可）· 个人自用不商用",
      usage: "import",
      note: "抓取口径：只抓有官方测验的 19 个教程的知识点与测验题；robots.txt 未禁止教程页（仅禁 /try/ 等），请求限并发并留间隔。"
    },
    {
      key: "runoob-quiz",
      name: "菜鸟教程 · 在线测验",
      url: "https://www.runoob.com/quiz/",
      license: "站点声明 Copyright © 2013-2026（保留所有权利，未声明开源许可）· 个人自用不商用",
      usage: "reference",
      note: "题目与答案来自测验页内嵌的 quizData（题干/选项/正确下标/解析）。"
    }
  ]
};
