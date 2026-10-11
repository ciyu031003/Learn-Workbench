/**
 * 知识点（topic）标题目录。
 *
 * 每个阶段（= 一个教程）给出**按站内顺序排列**的标题；生成脚本按相邻标题的相似度
 * 把该教程的页面切成等量连续的若干簇，每簇 = 一个知识点。标题数量即知识点数量。
 *
 * 约束（来自内容契约）：每阶段 ≥3 个知识点、每知识点 ≥2 道配套题、每阶段 ≥16 道题；
 * 因此标题数 ≤ floor(题数 / 2)，下表均已满足。
 */
export const RUNOOB_TOPICS = {
  html: [
    "HTML 基础语法与文档结构",
    "HTML 常用标签：文本、链接与列表",
    "HTML 表格、布局与表单",
    "HTML 颜色、字符实体与速查表",
    "HTML5 新特性、图形与存储",
  ],
  css: [
    "CSS 基础语法与选择器",
    "CSS 文本、字体与列表样式",
    "CSS 盒子模型、边框与定位",
    "CSS 布局、导航与响应式设计",
  ],
  javascript: [
    "JavaScript 入门、语法与变量",
    "JavaScript 运算符与流程控制",
    "JavaScript 函数、作用域与闭包",
    "JavaScript 对象、类与原型",
    "JavaScript 内置对象与正则表达式",
    "JavaScript DOM 操作与事件",
    "JavaScript BOM、异步与浏览器存储",
  ],
  jquery: [
    "jQuery 入门、选择器与事件",
    "jQuery 效果与动画",
    "jQuery DOM 与 CSS 操作",
    "jQuery 遍历、AJAX 与插件",
  ],
  typescript: [
    "TypeScript 入门、环境与配置",
    "TypeScript 基础类型与变量",
    "TypeScript 函数与异步编程",
    "TypeScript 对象、类与接口",
    "TypeScript 泛型与高级类型",
    "TypeScript 工程实践与框架集成",
  ],
  vue3: [
    "Vue3 入门、环境与项目结构",
    "Vue3 模板语法与内置指令",
    "Vue3 组件、计算与监听属性",
    "Vue3 路由、状态管理与组合式 API",
    "Vue3 工程实践与项目实战",
  ],
  xml: [
    "XML 基础语法与元素",
    "XML 命名空间、CDATA 与验证",
    "XML 解析、XPath 与转换",
  ],
  python: [
    "Python 简介、环境与基础语法",
    "Python 基本数据类型与运算符",
    "Python 流程控制与推导式",
    "Python 函数、迭代器与装饰器",
    "Python 数据结构与模块",
    "Python 面向对象、异常与文件",
    "Python 标准库与常用模块",
  ],
  java: [
    "Java 入门、环境与基础语法",
    "Java 数据类型、运算符与流程控制",
    "Java 面向对象与修饰符",
    "Java 常用类库与字符串处理",
    "Java 集合框架、泛型与多线程",
  ],
  cpp: [
    "C++ 入门、环境与基本语法",
    "C++ 数据类型、变量与运算符",
    "C++ 流程控制、函数与数组",
    "C++ 指针、引用与字符串",
    "C++ 结构体、类与对象",
    "C++ 继承、多态与运算符重载",
    "C++ 模板、STL 与异常处理",
    "C++ 标准库常用头文件",
  ],
  csharp: [
    "C# 入门、环境与程序结构",
    "C# 数据类型、运算符与流程控制",
    "C# 面向对象、可空类型与字符串",
    "C# 委托、事件、集合与泛型",
  ],
  go: [
    "Go 入门、环境与基础语法",
    "Go 数据类型、函数与流程控制",
    "Go 结构体、接口与并发",
  ],
  php: [
    "PHP 入门、语法与变量",
    "PHP 运算符、流程控制与数组",
    "PHP 函数、面向对象与命名空间",
    "PHP 表单、Cookie 与 Session",
    "PHP 文件、错误与异常处理",
    "PHP 与 MySQL 数据库操作",
    "PHP XML、AJAX 与过滤器",
    "PHP 内置函数参考",
  ],
  asp: [
    "ASP 入门与基础语法",
    "ASP 内置对象与表单处理",
    "ASP 组件、会话与数据库访问",
  ],
  sql: [
    "SQL 入门、语法与数据类型",
    "SQL 查询、条件与排序",
    "SQL 函数、分组与聚合",
    "SQL 连接、子查询与视图",
    "SQL 增删改与约束",
    "SQL 进阶：索引、事务与存储过程",
  ],
  numpy: [
    "NumPy 入门与 ndarray",
    "NumPy 数组运算与索引切片",
    "NumPy 广播、统计与线性代数",
  ],
  pandas: [
    "Pandas 入门与数据结构",
    "Pandas 数据读取与查看",
    "Pandas 数据清洗与缺失值",
    "Pandas 索引、筛选与分组",
    "Pandas 合并、透视与时间序列",
  ],
  git: [
    "Git 入门与仓库基础",
    "Git 分支、合并与冲突",
    "Git 远程仓库与协作流程",
  ],
  linux: [
    "Linux 入门、目录与文件操作",
    "Linux 用户、权限与进程管理",
    "Linux 网络、软件包与 Shell",
  ],
};
