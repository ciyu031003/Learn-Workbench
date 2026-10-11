/**
 * 「菜鸟教程 · Web 前端」——来源：菜鸟教程 https://www.runoob.com/ 。
 *
 * 由 `scripts/runoob/crawl.mjs` + `scripts/runoob/generate.mjs` 自动生成 —— **请勿手改**，
 * 要改请改 `scripts/runoob/topics.mjs` 的标题目录（或抓取/解析层）后重跑。
 *
 * 阶段 7 个 · 知识点 34 个 · 题目 186 道。
 */
import type { LearningTrack } from "./types";

export const runoobFrontendTrack: LearningTrack = {
  slug: "rn-frontend",
  title: "菜鸟教程 · Web 前端",
  category: "前端开发",
  level: "入门",
  accent: "#D97757",
  softAccent: "#FBEDE7",
  icon: "logo-html5",
  summary: "菜鸟教程（runoob.com）HTML 教程 / CSS 教程 / JavaScript 教程 / jQuery 教程 / TypeScript 教程 / Vue 3 教程 / XML 教程 的系统整理：7 个教程、34 个知识点、186 道官方测验题。知识点保持站内阅读顺序，题按内容相似度归属到对应知识点。",
  whyLearn: "HTML 教程、CSS 教程、JavaScript 教程、jQuery 教程、TypeScript 教程、Vue 3 教程、XML 教程 是上手这些技术最常用的入门路径；菜鸟教程的示例短、能直接跑。本课程把它们按知识点重新编排，并为每个知识点配上官方测验题，形成「读一节 → 做这一节的题 → 回读错题」的闭环。",
  prerequisites: ["会使用浏览器或命令行", "能读写基本的代码片段", "愿意动手敲示例并跑通"],
  studyMethod: ["按知识点顺序读原文，先看示例再看结论。", "每读完一个知识点立刻做它的配套题，用正确率判断是否读懂。", "错题回到对应知识点复述一遍，并写下错因。"],
  estimatedHours: 33,
  featured: false,
  stages: [
    {
      key: "rn-html-stage",
      title: "HTML 教程",
      weeks: "第 1 阶段",
      goal: "把「HTML 教程」的 57 页内容按 5 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出HTML 教程的典型用法，并把 40 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-html-1",
          title: "HTML 基础语法与文档结构",
          summary: "HTML 基础语法与文档结构（HTML 教程）：超文本标记语言（英语：HyperText Markup Language，简称：HTML）是一种用于创建网页的标准标记语言 本节含 7 页、8 道配套题。",
          concepts: [
            "HTML 教程- (HTML5 标准)",
            "HTML 实例",
            "HTML文档的后缀名",
            "HTML 编辑器",
            "HTML 编辑器推荐",
            "VS Code",
            "步骤 1: 新建 HTML 文件",
            "步骤 2: 另存为 HTML 文件",
            "步骤 3: 在浏览器中运行这个 HTML 文件",
            "HTML 简介"
          ],
          principles: [
            "超文本标记语言（英语：HyperText Markup Language，简称：HTML）是一种用于创建网页的标准标记语言",
            "您可以使用 HTML 来建立自己的 WEB 站点，HTML 运行在浏览器上，由浏览器来解析",
            "本教程包含了数百个 HTML 实例",
            "使用本站的编辑器，您可以轻松实现在线修改 HTML，并查看实例运行结果",
            "以上两种后缀名没有区别，都可以使用",
            "在 HTML 手册中包含了数百个在线实例，您可以在线编辑并查看运行结果",
            "可以使用专业的 HTML 编辑器来编辑 HTML，为大家推荐几款常用的编辑器：",
            "你可以从以上软件的官网中下载对应的软件，按步骤安装即可"
          ],
          applications: [
            "示例：<!DOCTYPE html>",
            "示例：<h1>这是一个标题</h1>",
            "示例：<p>这是一个段落。</p>",
            "示例：<a href=\"https://www.runoob.com\">这是一个链接</a>",
            "示例：<img src=\"/images/logo.png\" width=\"258\" height=\"39\" />",
            "示例：<a href=\"http://www.runoob.com\">这是一个链接</a>"
          ],
          pitfalls: [
            "注意：对于中文网页需要使用 ＜meta charset=\"utf-8\"＞ 声明编码，否则会出现乱码",
            "整个 HTML 文档的根节点，所有内容都必须包含在其中",
            "不要担心本章中您还没有学过的例子",
            "注意：图像的名称和尺寸是以属性的形式提供的",
            "提示: 在某些个别的情况下，比如属性值本身就含有双引号，那么您必须使用单引号，例如："
          ],
          method: "按站内顺序读「HTML 教程- (HTML5 标准) → HTML 编辑器 → HTML 简介 → HTML 元素 → HTML 基础- 4个实例 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 8 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「HTML 教程- (HTML5 标准)、HTML 实例、HTML文档的后缀名」的用法，并把 8 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【HTML 教程- (HTML5 标准)】HTML 教程- (HTML5 标准)：超文本标记语言（英语：HyperText Markup Language，简称：HTML）是一种用于创建网页的标准标记语言",
              "【HTML 教程- (HTML5 标准)】HTML 实例：本教程包含了数百个 HTML 实例",
              "【HTML 教程- (HTML5 标准)】HTML文档的后缀名：以上两种后缀名没有区别，都可以使用",
              "【HTML 教程- (HTML5 标准)】HTML 实例：在 HTML 手册中包含了数百个在线实例，您可以在线编辑并查看运行结果",
              "【HTML 编辑器】HTML 编辑器推荐：可以使用专业的 HTML 编辑器来编辑 HTML，为大家推荐几款常用的编辑器：",
              "【HTML 编辑器】VS Code：Visual Studio Code（简称 VS Code）是一个由微软开发，同时支持 Windows 、 Linux 和 macOS 等操作系统且开放源代码的代码编辑器，编辑器中内置了扩展程序管理的功能"
            ],
            mechanism: [
              "超文本标记语言（英语：HyperText Markup Language，简称：HTML）是一种用于创建网页的标准标记语言",
              "您可以使用 HTML 来建立自己的 WEB 站点，HTML 运行在浏览器上，由浏览器来解析",
              "在本教程中，您将学习如何使用 HTML 来创建站点",
              "本教程包含了数百个 HTML 实例",
              "使用本站的编辑器，您可以轻松实现在线修改 HTML，并查看实例运行结果",
              "注意：对于中文网页需要使用 ＜meta charset=\"utf-8\"＞ 声明编码，否则会出现乱码",
              "有些浏览器(如 360 浏览器)会设置 GBK 为默认编码，则你需要设置为 ＜meta charset=\"gbk\"＞",
              "以上两种后缀名没有区别，都可以使用",
              "在 HTML 手册中包含了数百个在线实例，您可以在线编辑并查看运行结果",
              "可以使用专业的 HTML 编辑器来编辑 HTML，为大家推荐几款常用的编辑器："
            ],
            example: {
              title: "HTML 编辑器 · 步骤 1: 新建 HTML 文件",
              language: "html",
              code: "<!DOCTYPE html>\n<html>\n<head>\n＜meta charset=\"utf-8\"＞\n<title>菜鸟教程(runoob.com)</title>\n</head>\n<body>\n\n<h1>我的第一个标题</h1>\n\n<p>我的第一个段落。</p>\n\n</body>\n</html>",
              explanation: "在 VS Code 安装完成后，选择\" 文件(F)->新建文件(N) \"，在新建的文件中输入以下代码："
            },
            practiceSteps: [
              "先通读本节 7 页：HTML 教程- (HTML5 标准)、HTML 编辑器、HTML 简介、HTML 元素 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 8 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「HTML 基础语法与文档结构」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 8 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-html-2",
          title: "HTML 常用标签：文本、链接与列表",
          summary: "HTML 常用标签：文本、链接与列表（HTML 教程）：HTML 使用标签 <b>(\"bold\") 与 <i>(\"italic\") 对输出的文本进行格式, 如：粗体 or 斜体 本节含 17 页、9 道配套题。",
          concepts: [
            "HTML 文本格式化",
            "HTML 格式化标签",
            "在线实例",
            "HTML 文本格式化标签",
            "HTML \"计算机输出\" 标签",
            "HTML 引文, 引用, 及标签定义",
            "HTML 段落",
            "不要忘记结束标签",
            "HTML 折行",
            "HTML 输出- 使用提醒"
          ],
          principles: [
            "HTML 使用标签 <b>(\"bold\") 与 <i>(\"italic\") 对输出的文本进行格式, 如：粗体 or 斜体",
            "这些HTML标签被称为格式化标签（请查看底部完整标签参考手册）",
            "此例演示如何在一个 HTML 文件中对文本进行格式化",
            "此例演示如何使用 pre 标签对空行和空格进行控制",
            "HTML 可以将文档分割为若干段落",
            "段落是通过 <p> 标签定义的",
            "注意：浏览器会自动地在段落的前后添加空行",
            "即使忘了使用结束标签，大多数浏览器也会正确地将 HTML 显示出来："
          ],
          applications: [
            "示例：<p>这是一个段落 </p>",
            "示例：<p>这是一个段落",
            "示例：<p>这个<br>段落<br>演示了分行的效果</p>",
            "示例：<!DOCTYPE html>",
            "示例：<head>",
            "示例：＜meta name=\"keywords\" content=\"HTML, CSS, XML, XHTML, JavaScript\"＞"
          ],
          pitfalls: [
            "注意：浏览器会自动地在段落的前后添加空行",
            "上面的例子在大多数浏览器中都没问题，但不要依赖这种做法",
            "忘记使用结束标签会产生意想不到的结果和错误",
            "需要注意的是，HTML 代码中的所有连续的空行（换行）也被显示为一个空格",
            "注意：如果为这些超链接设置了 CSS 样式，展示样式会根据 CSS 的设定而显示"
          ],
          method: "按站内顺序读「HTML 文本格式化 → HTML 段落 → HTML <head> → HTML 链接 → HTML 样式- CSS → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 9 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「HTML 文本格式化、HTML 格式化标签、在线实例」的用法，并把 9 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【HTML 文本格式化】HTML 文本格式化：HTML 文本格式化",
              "【HTML 文本格式化】HTML 格式化标签：HTML 使用标签 <b>(\"bold\") 与 <i>(\"italic\") 对输出的文本进行格式, 如：粗体 or 斜体",
              "【HTML 文本格式化】在线实例：此例演示如何在一个 HTML 文件中对文本进行格式化",
              "【HTML 文本格式化】HTML 文本格式化标签：标签\n\n描述\n\n<b>\n\n定义粗体文本\n\n<em>\n\n定义着重文字\n\n<i>\n\n定义斜体字\n\n<small>\n\n定义小号字\n\n<strong>\n\n定义加重语气\n\n<sub>\n\n定义下标字\n\n<sup>\n\n定义上标字\n\n<ins>\n\n定义插入字\n\n<del>\n\n定义删除字",
              "【HTML 文本格式化】HTML \"计算机输出\" 标签：标签\n\n描述\n\n<code>\n\n定义计算机代码\n\n<kbd>\n\n定义键盘码\n\n<samp>\n\n定义计算机代码样本\n\n<var>\n\n定义变量\n\n<pre>\n\n定义预格式文本",
              "【HTML 文本格式化】HTML 引文, 引用, 及标签定义：<blockquote>"
            ],
            mechanism: [
              "HTML 使用标签 <b>(\"bold\") 与 <i>(\"italic\") 对输出的文本进行格式, 如：粗体 or 斜体",
              "这些HTML标签被称为格式化标签（请查看底部完整标签参考手册）",
              "通常标签 <strong> 替换加粗标签 <b> 来使用, <em> 替换 <i>标签使用",
              "然而，这些标签的含义是不同的：",
              "<b> 与<i> 定义粗体或斜体文本",
              "<strong> 或者 <em>意味着你要呈现的文本是重要的，所以要突出显示",
              "现今所有主要浏览器都能渲染各种效果的字体",
              "不过，未来浏览器可能会支持更好的渲染效果",
              "此例演示如何在一个 HTML 文件中对文本进行格式化",
              "此例演示如何使用 pre 标签对空行和空格进行控制"
            ],
            example: {
              title: "HTML 表单和输入 · HTML 表单和输入",
              language: "html",
              code: "<form action=\"/\" method=\"post\">\n\n<!-- 文本输入框 -->\n\n<label for=\"name\">用户名:</label>\n\n<input type=\"text\" id=\"name\" name=\"name\" required>\n\n<br>\n\n<!-- 密码输入框 -->\n\n<label for=\"password\">密码:</label>\n\n<input type=\"password\" id=\"password\" name=\"password\" required>\n\n<br>\n\n<!-- 单选按钮 -->\n\n<label>性别:</label>\n\n<input type=\"radio\" id=\"male\" name=\"gender\" value=\"male\" checked>\n\n<label for=\"male\">男</label>\n\n<input type=\"radio\" id=\"female\" name=\"gender\" value=\"female\">\n\n<label for=\"female\">女</label>\n\n<br>\n\n<!-- 复选框 -->\n\n<input type=\"checkbox\" id=\"subscribe\" name=\"subscribe\" checked>\n\n<label for=\"subscribe\">订阅推送信息</label>\n\n<br>\n\n<!-- 下拉列表 -->\n\n<label for=\"country\">国家:</label>\n\n<select id=\"country\" name=\"country\">\n\n<option value=\"cn\">CN</option>\n\n<option value=\"usa\">USA</option>\n\n<option value=\"uk\">UK</option>\n\n</select>\n\n<br>\n\n<!-- 提交按钮 -->\n\n<input type=\"submit\" value=\"提交\">\n\n</form>",
              explanation: "HTML 表单用于收集用户的输入信息"
            },
            practiceSteps: [
              "先通读本节 17 页：HTML 文本格式化、HTML 段落、HTML <head>、HTML 链接 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 9 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「HTML 常用标签：文本、链接与列表」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 9 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-html-3",
          title: "HTML 表格、布局与表单",
          summary: "HTML 表格、布局与表单（HTML 教程）：URL可以由字母组成，如\"runoob.com\"，或互联网协议（IP）地址： 本节含 6 页、7 道配套题。",
          concepts: [
            "URL - 统一资源定位器",
            "常见的 URL Scheme",
            "URL 字符编码",
            "在线实例",
            "URL 编码实例",
            "HTML 速查列表",
            "HTML 基本文档",
            "基本标签（Basic Tags）",
            "文本格式化（Formatting）",
            "链接（Links）"
          ],
          principles: [
            "URL可以由字母组成，如\"runoob.com\"，或互联网协议（IP）地址：",
            "Web浏览器通过URL从Web服务器请求页面",
            "当您点击 HTML 页面中的某个链接时，对应的 <a> 标签指向万维网上的一个地址",
            "以下是一些URL scheme：",
            "如果您点击下面的\"提交\"按钮，浏览器会在发送输入之前对其进行 URL 编码",
            "服务器上的页面会显示出接收到的输入",
            "如需完整的 URL 编码参考，请访问我们的 URL 编码参考手册",
            "HTML 速查列表. 你可以打印它，以备日常使用"
          ],
          applications: [
            "示例：<!DOCTYPE html>",
            "示例：<h1>最大的标题</h1>",
            "示例：<b>粗体文本</b>",
            "示例：普通的链接：<a href=\"http://www.example.com/\">链接文本</a>",
            "示例：<img src=\"URL\" alt=\"替换文本\" height=\"42\" width=\"42\">",
            "示例：＜style type=\"text/css\"＞"
          ],
          pitfalls: [
            "path - 定义服务器上的路径（如果省略，则文档必须位于网站的根目录中）",
            "由于 URL 常常会包含 ASCII 集合之外的字符，URL 必须转换为有效的 ASCII 格式",
            "URL 不能包含空格",
            "不要指望低价的 PC 能够应付这些工作",
            "同时请注意，服务器授权也许有用户数量限制"
          ],
          method: "按站内顺序读「HTML 统一资源定位器(Uniform Resource Locators) → HTML 速查列表 → HTML 标签简写及全称 → HTML 测验 → 你已经完成了 HTML 的学习，下一步该学习什么呢？ → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 7 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「URL - 统一资源定位器、常见的 URL Scheme、URL 字符编码」的用法，并把 7 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【HTML 统一资源定位器(Uniform Reso…】HTML 统一资源定位器(Uniform Resource Locators)：URL可以由字母组成，如\"runoob.com\"，或互联网协议（IP）地址：",
              "【HTML 统一资源定位器(Uniform Reso…】URL - 统一资源定位器：Web浏览器通过URL从Web服务器请求页面",
              "【HTML 统一资源定位器(Uniform Reso…】常见的 URL Scheme：以下是一些URL scheme：",
              "【HTML 统一资源定位器(Uniform Reso…】URL 字符编码：由于 URL 常常会包含 ASCII 集合之外的字符，URL 必须转换为有效的 ASCII 格式",
              "【HTML 统一资源定位器(Uniform Reso…】在线实例：如果您点击下面的\"提交\"按钮，浏览器会在发送输入之前对其进行 URL 编码",
              "【HTML 统一资源定位器(Uniform Reso…】URL 编码实例：如需完整的 URL 编码参考，请访问我们的 URL 编码参考手册"
            ],
            mechanism: [
              "URL可以由字母组成，如\"runoob.com\"，或互联网协议（IP）地址：",
              "大多数人进入网站使用网站域名来访问，因为",
              "Web浏览器通过URL从Web服务器请求页面",
              "当您点击 HTML 页面中的某个链接时，对应的 <a> 标签指向万维网上的一个地址",
              "一个统一资源定位器(URL) 用于定位万维网上的文档",
              "http://www.runoob.com/html/html-tutorial.html",
              "scheme - 定义因特网服务的类型",
              "host - 定义域主机（http 的默认主机是 www）",
              "domain - 定义因特网域名，比如 runoob.com",
              ":port - 定义主机上的端口号（http 的默认端口号是 80）"
            ],
            example: {
              title: "HTML 速查列表 · 表单（Forms）",
              language: "html",
              code: "<form action=\"demo_form.php\" method=\"post/get\">\n<input type=\"text\" name=\"email\" size=\"40\" maxlength=\"50\">\n<input type=\"password\">\n<input type=\"checkbox\" checked=\"checked\">\n<input type=\"radio\" checked=\"checked\">\n<input type=\"submit\" value=\"Send\">\n<input type=\"reset\">\n<input type=\"hidden\">\n<select>\n<option>苹果</option>\n<option selected=\"selected\">香蕉</option>\n<option>樱桃</option>\n</select>\n<textarea name=\"comment\" rows=\"60\" cols=\"20\"></textarea>\n\n</form>",
              explanation: "示例代码取自「HTML 速查列表」，可直接改参数观察输出差异。"
            },
            practiceSteps: [
              "先通读本节 6 页：HTML 统一资源定位器(Uniform Resource Locators)、HTML 速查列表、HTML 标签简写及全称、HTML 测验 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 7 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「HTML 表格、布局与表单」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 7 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-html-4",
          title: "HTML 颜色、字符实体与速查表",
          summary: "HTML 颜色、字符实体与速查表（HTML 教程）：HTML5是HTML最新的修订版本，2014年10月由万维网联盟（W3C）完成标准制定 本节含 21 页、9 道配套题。",
          concepts: [
            "HTML5 简介",
            "什么是 HTML5?",
            "HTML5 是如何起步的？",
            "HTML5 <!DOCTYPE>",
            "最小的HTML5文档",
            "HTML5 的改进",
            "HTML5 多媒体",
            "HTML5 应用",
            "HTML5 图形",
            "HTML5 使用 CSS3"
          ],
          principles: [
            "HTML5是HTML最新的修订版本，2014年10月由万维网联盟（W3C）完成标准制定",
            "HTML5的设计目的是为了在移动设备上支持多媒体",
            "HTML5 是下一代 HTML 标准",
            "HTML , HTML 4.01的上一个版本诞生于 1999 年",
            "HTML5 是 W3C 与 WHATWG 合作的结果,WHATWG 指 Web Hypertext Application Technology Working Group",
            "WHATWG 致力于 web 表单和应用程序，而 W3C 专注于 XHTML 2.0",
            "<!doctype> 声明必须位于 HTML5 文档中的第一行,使用非常简单:",
            "下面是一个简单的HTML5文档："
          ],
          applications: [
            "示例：<!DOCTYPE html>",
            "示例：<!DOCTYPE HTML>",
            "示例：<!--[if lt IE 9]>",
            "示例：header, section, footer, aside, nav, main, article, figure {",
            "示例：<svg xmlns=\"http://www.w3.org/2000/svg\" version=\"1.1\">",
            "示例：<canvas id=\"myCanvas\" width=\"200\" height=\"100\""
          ],
          pitfalls: [
            "<!doctype> 声明必须位于 HTML5 文档中的第一行,使用非常简单:",
            "注意：对于中文网页需要使用 ＜meta charset=\"utf-8\"＞ 声明编码，否则会出现乱码",
            "注意：国内用户请使用本站静态资源库（Google 资源库在国内不稳定）：",
            "html5shiv主要解决HTML5提出的新的元素不被IE6-8识别，这些新元素不能作为父节点包裹子元素，并且不能应用CSS样式",
            "html5shiv.js 引用代码必须放在 <head> 元素中，因为 IE 浏览器在解析 HTML5 新元素时需要先加载该文件"
          ],
          method: "按站内顺序读「HTML5 简介 → HTML5 浏览器支持 → HTML5 新元素 → HTML5 SVG → HTML5 Canvas → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 9 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「HTML5 简介、什么是 HTML5?、HTML5 是如何起步的？」的用法，并把 9 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【HTML5 简介】HTML5 简介：HTML5是HTML最新的修订版本，2014年10月由万维网联盟（W3C）完成标准制定",
              "【HTML5 简介】什么是 HTML5?：HTML5 是下一代 HTML 标准",
              "【HTML5 简介】HTML5 是如何起步的？：HTML5 是 W3C 与 WHATWG 合作的结果,WHATWG 指 Web Hypertext Application Technology Working Group",
              "【HTML5 简介】HTML5 <!DOCTYPE>：<!doctype> 声明必须位于 HTML5 文档中的第一行,使用非常简单:",
              "【HTML5 简介】最小的HTML5文档：下面是一个简单的HTML5文档：",
              "【HTML5 简介】HTML5 的改进：Video 和 Audio"
            ],
            mechanism: [
              "HTML5是HTML最新的修订版本，2014年10月由万维网联盟（W3C）完成标准制定",
              "HTML5的设计目的是为了在移动设备上支持多媒体",
              "HTML5 是下一代 HTML 标准",
              "HTML , HTML 4.01的上一个版本诞生于 1999 年",
              "自从那以后，Web 世界已经经历了巨变",
              "然而，大部分现代浏览器已经具备了某些 HTML5 支持",
              "HTML5 是 W3C 与 WHATWG 合作的结果,WHATWG 指 Web Hypertext Application Technology Working Group",
              "WHATWG 致力于 web 表单和应用程序，而 W3C 专注于 XHTML 2.0",
              "在 2006 年，双方决定进行合作，来创建一个新版本的 HTML",
              "HTML5 中的一些有趣的新特性："
            ],
            example: {
              title: "HTML5 Web IndexedDB 数据库 · IndexedDB 应用实例",
              language: "html",
              code: "// 打开或创建数据库\n\nvar request = indexedDB.open('myDatabase', 1);\n\n// 如果数据库版本变化或首次创建时触发\n\nrequest.onupgradeneeded = function(event) {\n\nvar db = event.target.result;\n\n// 创建对象存储（表），设置主键为 'id'\n\nvar objectStore = db.createObjectStore('customers', { keyPath: 'id' });\n\n// 为 'name' 字段创建索引\n\nobjectStore.createIndex('name', 'name', { unique: false });\n\n};\n\n// 打开数据库成功\n\nrequest.onsuccess = function(event) {\n\nvar db = event.target.result;\n\n// 插入数据\n\nvar transaction = db.transaction(['customers'], 'readwrite');\n\nvar objectStore = transaction.objectStore('customers');\n\nobjectStore.add({ id: 1, name: 'John Doe', email: 'john@example.com' });\n\nobjectStore.add({ id: 2, name: 'Jane Doe', email: 'jane@example.com' });\n\ntransaction.oncomplete = function() {\n\nconsole.log('Transaction completed: data added.');\n\n};\n\ntransaction.onerror＝ function(event) {\n\nconsole.error('Transaction failed:', event);\n\n};\n\n// 查询数据\n\nvar queryTransaction = db.transaction(['customers']);\n\nvar queryObjectStore = queryTransaction.objectStore('customers');\n\nvar query = queryObjectStore.get(1);\n\nquery.onsuccess = function(event) {\n\nconsole.log('Customer:', event.target.result);\n\n};\n\n// 更新数据\n\nvar updateTransaction = db.transaction(['customers'], 'readwrite');\n\nvar updateObjectStore = updateTransaction.objectStore('customers');\n\nvar updatedCustomer = { id: 1, name: 'John Smith', email: 'johnsmith@example.com' };\n\nupdateObjectStore.put(updatedCustomer);\n\nupdateTransaction.oncomplete = function() {\n\nconsole.log('Transaction completed: data updated.');\n\n};\n\n};\n\n// 错误处理\n\nrequest.onerror＝ function(event) {\n\nconsole.error('Database error:",
              explanation: "以下是一个完整的 IndexedDB 实例，用于创建数据库、插入数据、查询数据并更新数据"
            },
            practiceSteps: [
              "先通读本节 21 页：HTML5 简介、HTML5 浏览器支持、HTML5 新元素、HTML5 SVG 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 9 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「HTML 颜色、字符实体与速查表」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 9 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-html-5",
          title: "HTML5 新特性、图形与存储",
          summary: "HTML5 新特性、图形与存储（HTML 教程）：很多 Web 开发人员对 HTML 的代码规范知之甚少 本节含 6 页、7 道配套题。",
          concepts: [
            "HTML(5) 代码规范",
            "HTML 代码约定",
            "使用正确的文档类型",
            "使用小写元素名",
            "关闭所有 HTML 元素",
            "关闭空的 HTML 元素",
            "使用小写属性名",
            "属性值",
            "图片属性",
            "空格和等号"
          ],
          principles: [
            "很多 Web 开发人员对 HTML 的代码规范知之甚少",
            "在2000年至2010年，许多Web开发人员从 HTML 转换到 XHTML",
            "文档类型声明位于HTML文档的第一行：",
            "如果你想跟其他标签一样使用小写，可以使用以下代码：",
            "HTML5 元素名可以使用大写和小写字母",
            "在 HTML5 中, 你不一定要关闭所有元素 (例如 <p> 元素)，但我们建议每个元素都要添加关闭标签",
            "在 HTML5 中, 空的 HTML 元素也不一定要关闭：",
            "HTML5 属性名允许使用大写和小写字母"
          ],
          applications: [
            "示例：<!DOCTYPE html>",
            "示例：<SECTION>",
            "示例：<section>",
            "示例：＜meta",
            "示例：<div CLASS=\"menu\">",
            "示例：<table class=table striped>"
          ],
          pitfalls: [
            "在 XHTML 和 XML 中斜线 (/) 是必须的",
            "以下实例属性值包含空格，没有使用引号，所以不能起作用:",
            "在图片不能显示时，它能替代图片显示",
            "不要无缘无故添加空行",
            "比较短的代码间不要使用不必要的空行和缩进"
          ],
          method: "按站内顺序读「HTML(5) 代码规范 → HTML 多媒体 → HTML 插件 → HTML 音频(Audio) → HTML 视频（Video） → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 7 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「HTML(5) 代码规范、HTML 代码约定、使用正确的文档类型」的用法，并把 7 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【HTML(5) 代码规范】HTML 代码约定：很多 Web 开发人员对 HTML 的代码规范知之甚少",
              "【HTML(5) 代码规范】使用正确的文档类型：文档类型声明位于HTML文档的第一行：",
              "【HTML(5) 代码规范】使用小写元素名：HTML5 元素名可以使用大写和小写字母",
              "【HTML(5) 代码规范】关闭所有 HTML 元素：在 HTML5 中, 你不一定要关闭所有元素 (例如 <p> 元素)，但我们建议每个元素都要添加关闭标签",
              "【HTML(5) 代码规范】关闭空的 HTML 元素：在 HTML5 中, 空的 HTML 元素也不一定要关闭：",
              "【HTML(5) 代码规范】使用小写属性名：HTML5 属性名允许使用大写和小写字母"
            ],
            mechanism: [
              "很多 Web 开发人员对 HTML 的代码规范知之甚少",
              "在2000年至2010年，许多Web开发人员从 HTML 转换到 XHTML",
              "使用 XHTML 开发人员逐渐养成了比较好的 HTML 编写规范",
              "而针对于 HTML5 ，我们应该形成比较好的代码规范，以下提供了几种规范的建议",
              "文档类型声明位于HTML文档的第一行：",
              "如果你想跟其他标签一样使用小写，可以使用以下代码：",
              "HTML5 元素名可以使用大写和小写字母",
              "混合了大小写的风格是非常糟糕的",
              "开发人员通常使用小写 (类似 XHTML)",
              "在 HTML5 中, 你不一定要关闭所有元素 (例如 <p> 元素)，但我们建议每个元素都要添加关闭标签"
            ],
            example: {
              title: "HTML 视频（Video） · 最好的 HTML 解决方法",
              language: "html",
              code: "<video width=\"320\" height=\"240\" controls>\n\n<source src=\"movie.mp4\" type=\"video/mp4\">\n\n<source src=\"movie.ogg\" type=\"video/ogg\">\n\n<source src=\"movie.webm\" type=\"video/webm\">\n\n\t＜object data=\"movie.mp4\"\n\twidth=\"320\" height=\"240\"＞\n\n＜embed src=\"movie.swf\" width=\"320\"\n\theight=\"240\"＞\n\n\t＜/object＞\n\n\t</video>",
              explanation: "以下实例中使用了 4 种不同的视频格式"
            },
            practiceSteps: [
              "先通读本节 6 页：HTML(5) 代码规范、HTML 多媒体、HTML 插件、HTML 音频(Audio) 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 7 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「HTML5 新特性、图形与存储」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 7 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-html-2",
        "rn-html-5",
        "rn-html-10",
        "rn-html-13",
        "rn-html-16",
        "rn-html-18",
        "rn-html5-11",
        "rn-html5-16",
        "rn-html-3",
        "rn-html-12",
        "rn-html-14",
        "rn-html-17",
        "rn-html-19",
        "rn-html-20",
        "rn-html5-9",
        "rn-html5-12",
        "rn-html5-18",
        "rn-html-1",
        "rn-html-6",
        "rn-html-7",
        "rn-html-8",
        "rn-html-9",
        "rn-html-11",
        "rn-html5-5",
        "rn-html5-1",
        "rn-html5-4",
        "rn-html5-7",
        "rn-html5-10",
        "rn-html5-13",
        "rn-html5-14",
        "rn-html5-15",
        "rn-html5-17",
        "rn-html5-20",
        "rn-html-4",
        "rn-html-15",
        "rn-html5-2",
        "rn-html5-3",
        "rn-html5-6",
        "rn-html5-8",
        "rn-html5-19"
      ],
      lesson: {
        overview: [
          "《HTML 教程》取自菜鸟教程，共 57 页，整理为 5 个知识点、40 道配套测验题。",
          "知识点顺序保持站内阅读顺序：HTML 基础语法与文档结构 → HTML 常用标签：文本、链接与列表 → HTML 表格、布局与表单 → HTML 颜色、字符实体与速查表 → HTML5 新特性、图形与存储。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 40 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 HTML 基础语法与文档结构 并跑通示例",
            evidence: "本地示例输出与站点示例一致"
          },
          {
            title: "完成全部配套测验",
            evidence: "题正确率 ≥ 80%（共 40 道）"
          },
          {
            title: "能独立复述全部知识点",
            evidence: "不看文档说出每个知识点的用法与易错点"
          }
        ],
        completionCriteria: ["《HTML 教程》5 个知识点全部读完。", "配套 40 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    },
    {
      key: "rn-css-stage",
      title: "CSS 教程",
      weeks: "第 1 阶段",
      goal: "把「CSS 教程」的 48 页内容按 4 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出CSS 教程的典型用法，并把 40 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-css-1",
          title: "CSS 基础语法与选择器",
          summary: "CSS 基础语法与选择器（CSS 教程）：CSS (Cascading Style Sheets，层叠样式表），是一种用来为结构化文档（如 HTML 文档或 XML 应用）添加样式（字体、间距和颜色等）的计算机语言，CSS 文件扩展名为 .css 本节含 17 页、10 道配套题。",
          concepts: [
            "CSS 教程",
            "各章节实例",
            "CSS 实例",
            "CSS 简介",
            "你需要具备的知识",
            "什么是 CSS?",
            "样式解决了一个很大的问题",
            "CSS 编辑器",
            "VS Code",
            "第一步: 建立项目结构"
          ],
          principles: [
            "CSS (Cascading Style Sheets，层叠样式表），是一种用来为结构化文档（如 HTML 文档或 XML 应用）添加样式（字体、间距和颜色等）的计算机语言，CSS 文件扩展名为 .css",
            "通过使用 CSS 我们可以大大提升网页开发的工作效率",
            "本 CSS 教程包含了数百个 CSS 在线实例",
            "通过本站的在线编辑器，你可以在线编辑 CSS，并且可以在线查看修改后的效果",
            "css 在线150个实例，通过本站编辑器，你可以学习在线查看修改后css的运行效果",
            "在继续学习之前，你需要对下面的知识有基本的了解：",
            "HTML / XHTML",
            "CSS 指层叠样式表 (Cascading Style Sheets)"
          ],
          applications: [
            "示例：body {",
            "示例：<h1>这是一个标题</h1>",
            "示例：<!DOCTYPE html>",
            "示例：/* 给整个页面加个背景色 */",
            "示例：p {color:red;text-align:center;}",
            "示例：/*这是个注释*/"
          ],
          pitfalls: [
            "CSS 必须依附于 HTML 存在，以下是 index.html 文件代码",
            "ID属性不要以数字开头，数字开头的ID在 Mozilla/Firefox 浏览器中不起作用",
            "类名的第一个字符不能使用数字",
            "文件不能包含任何的 html 标签",
            "不要在属性值与单位之间留有空格（如：\"margin-left: 20 px\" ），正确的写法是 \"margin-left: 20px\""
          ],
          method: "按站内顺序读「CSS 教程 → CSS 简介 → CSS 编辑器 → CSS 语法 → CSS id 和 class → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 10 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「CSS 教程、各章节实例、CSS 实例」的用法，并把 10 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【CSS 教程】CSS 教程：CSS (Cascading Style Sheets，层叠样式表），是一种用来为结构化文档（如 HTML 文档或 XML 应用）添加样式（字体、间距和颜色等）的计算机语言，CSS 文件扩展名为 .css",
              "【CSS 教程】各章节实例：本 CSS 教程包含了数百个 CSS 在线实例",
              "【CSS 教程】CSS 实例：css 在线150个实例，通过本站编辑器，你可以学习在线查看修改后css的运行效果",
              "【CSS 简介】你需要具备的知识：在继续学习之前，你需要对下面的知识有基本的了解：",
              "【CSS 简介】什么是 CSS?：CSS 指层叠样式表 (Cascading Style Sheets)",
              "【CSS 简介】CSS 实例：一个HTML文档可以显示不同的样式:"
            ],
            mechanism: [
              "CSS (Cascading Style Sheets，层叠样式表），是一种用来为结构化文档（如 HTML 文档或 XML 应用）添加样式（字体、间距和颜色等）的计算机语言，CSS 文件扩展名为 .css",
              "通过使用 CSS 我们可以大大提升网页开发的工作效率",
              "在我们的 CSS 教程中，您会学到如何使用 CSS 同时控制多重网页的样式和布局",
              "CSS3 现在已被大部分现代浏览器支持，而下一版的 CSS4 仍在开发中",
              "本 CSS 教程包含了数百个 CSS 在线实例",
              "通过本站的在线编辑器，你可以在线编辑 CSS，并且可以在线查看修改后的效果",
              "点击 \"尝试一下\" 按钮查看css是如何工作的",
              "css 在线150个实例，通过本站编辑器，你可以学习在线查看修改后css的运行效果",
              "在继续学习之前，你需要对下面的知识有基本的了解：",
              "CSS 指层叠样式表 (Cascading Style Sheets)"
            ],
            example: {
              title: "CSS 编辑器 · 第三步：编写 CSS 样式",
              language: "css",
              code: "/* 给整个页面加个背景色 */\n\nbody {\n\nbackground-color: #f0f2f5;\n\nfont-family: 'Segoe UI', sans-serif;\n\ndisplay: flex;\n\njustify-content: center; /* 水平居中 */\n\nalign-items: center; /* 垂直居中 */\n\nheight: 100vh; /* 占满屏幕高度 */\n\nmargin: 0;\n\n}\n\n/* 设计卡片样式 */\n\n.card {\n\nbackground-color: white;\n\nwidth: 300px;\n\npadding: 30px;\n\nborder-radius: 15px; /* 圆角 */\n\nbox-shadow: 0 4px 15px rgba(0,0,0,0.1); /* 阴影 */\n\ntext-align: center;\n\n}\n\n/* 标题颜色 */\n\nh1 {\n\ncolor: #333;\n\n}\n\n/* 按钮样式 */\n\nbutton {\n\nbackground-color: #007bff;\n\ncolor: white;\n\nborder: none;\n\npadding: 10px 20px;\n\nborder-radius: 5px;\n\ncursor: pointer;\n\ntransition: background 0.3s; /* 动画过渡 */\n\n}\n\n/* 鼠标悬停在按钮上的效果 */\n\nbutton:hover {\n\nbackground-color: #0056b3;\n\n}",
              explanation: "在 style.css 文件中输入以下代码:"
            },
            practiceSteps: [
              "先通读本节 17 页：CSS 教程、CSS 简介、CSS 编辑器、CSS 语法 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 10 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「CSS 基础语法与选择器」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 10 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-css-2",
          title: "CSS 文本、字体与列表样式",
          summary: "CSS 文本、字体与列表样式（CSS 教程）：在样式表中有很多具有相同样式的元素 本节含 7 页、10 道配套题。",
          concepts: [
            "CSS 分组 和 嵌套 选择器",
            "分组选择器",
            "嵌套选择器",
            "CSS 尺寸 (Dimension)",
            "更多实例",
            "所有CSS 尺寸 (Dimension)属性",
            "CSS Display - 块和内联元素",
            "如何改变一个元素显示",
            "CSS Position(定位)",
            "static 定位"
          ],
          principles: [
            "在样式表中有很多具有相同样式的元素",
            "为了尽量减少代码，你可以使用分组选择器",
            "它可能适用于选择器内部的选择器的样式",
            "在下面的例子设置了四个样式：",
            "CSS 尺寸 (Dimension) 属性允许你控制元素的高度和宽度",
            "同样，它允许你增加行间距",
            "这个例子演示了如何设置不同元素的高度",
            "display属性设置一个元素应如何显示，visibility属性指定一个元素应可见还是隐藏"
          ],
          applications: [
            "示例：h1 {",
            "示例：p",
            "示例：h1.hidden {visibility:hidden;}",
            "示例：li {display:inline;}",
            "示例：div.static {",
            "示例：p.pos_fixed"
          ],
          pitfalls: [
            "但是请注意，这两种方法会产生不同的结果",
            "注意：变更元素的显示类型看该元素是如何显示，它是什么样的元素",
            "相对于最近的已定位祖先元素进行定位（否则相对于 body），脱离文档流",
            "注意： Fixed 定位在 IE7 和 IE8 下需要描述 !DOCTYPE 才能支持",
            "否则其行为与相对定位相同"
          ],
          method: "按站内顺序读「CSS 分组 和 嵌套 选择器 → CSS 尺寸 (Dimension) → CSS Display(显示) 与 Visibility（可见性） → CSS Position(定位) → CSS 布局 - Overflow → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 10 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「CSS 分组 和 嵌套 选择器、分组选择器、嵌套选择器」的用法，并把 10 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【CSS 分组 和 嵌套 选择器】分组选择器：在样式表中有很多具有相同样式的元素",
              "【CSS 分组 和 嵌套 选择器】嵌套选择器：它可能适用于选择器内部的选择器的样式",
              "【CSS 尺寸 (Dimension)】CSS 尺寸 (Dimension)：CSS 尺寸 (Dimension) 属性允许你控制元素的高度和宽度",
              "【CSS 尺寸 (Dimension)】更多实例：这个例子演示了如何设置不同元素的高度",
              "【CSS 尺寸 (Dimension)】所有CSS 尺寸 (Dimension)属性：属性\n\n描述\n\nheight\n\n设置元素的高度。\n\nline-height\n\n设置行高。\n\nmax-height\n\n设置元素的最大高度。\n\nmax-width\n\n设置元素的最大宽度。\n\nmin-height\n\n设置元素的最小高度。\n\nmin-width\n\n设置元素的最小宽…",
              "【CSS Display(显示) 与 Visibil…】CSS Display(显示) 与 Visibility（可见性）：display属性设置一个元素应如何显示，visibility属性指定一个元素应可见还是隐藏"
            ],
            mechanism: [
              "在样式表中有很多具有相同样式的元素",
              "为了尽量减少代码，你可以使用分组选择器",
              "在下面的例子中，我们对以上代码使用分组选择器：",
              "它可能适用于选择器内部的选择器的样式",
              "在下面的例子设置了四个样式：",
              "p{ }: 为所有 p 元素指定一个样式",
              ".marked{ }: 为所有 class=\"marked\" 的元素指定一个样式",
              ".marked p{ }: 为所有 class=\"marked\" 元素内的 p 元素指定一个样式",
              "p.marked{ }: 为所有 class=\"marked\" 的 p 元素指定一个样式",
              "CSS 尺寸 (Dimension) 属性允许你控制元素的高度和宽度"
            ],
            example: {
              title: "CSS 布局 - 水平 & 垂直对齐 · 垂直居中 - 使用 line-height",
              language: "css",
              code: ".center {\nline-height: 200px;\nheight: 200px;\nborder: 3px solid green;\ntext-align: center;\n}\n\n/* 如果文本有多行，添加以下代码: */\n.center p {\nline-height: 1.5;\ndisplay: inline-block;\nvertical-align: middle;\n}",
              explanation: "我是垂直居中的"
            },
            practiceSteps: [
              "先通读本节 7 页：CSS 分组 和 嵌套 选择器、CSS 尺寸 (Dimension)、CSS Display(显示) 与 Visibility（可见性）、CSS Position(定位) 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 10 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「CSS 文本、字体与列表样式」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 10 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-css-3",
          title: "CSS 盒子模型、边框与定位",
          summary: "CSS 盒子模型、边框与定位（CSS 教程）：组合选择符说明了两个选择器之间的关系 本节含 17 页、11 道配套题。",
          concepts: [
            "CSS 组合选择符",
            "后代选择器",
            "子元素选择器",
            "相邻兄弟选择器",
            "后续兄弟选择器",
            "CSS 伪类(Pseudo-classes)",
            "语法",
            "anchor伪类",
            "伪类和CSS类",
            "CSS :first-child 伪类"
          ],
          principles: [
            "组合选择符说明了两个选择器之间的关系",
            "CSS组合选择符包括各种简单选择符的组合方式",
            "后代选择器用于选取某元素的后代元素",
            "以下实例选取所有 <p> 元素插入到 <div> 元素中:",
            "与后代选择器相比，子元素选择器（Child selectors）只能选择作为某元素直接/一级子元素的元素",
            "以下实例选择了<div>元素中所有直接子元素 <p> ：",
            "相邻兄弟选择器（Adjacent sibling selector）可选择紧接在另一元素后的元素，且二者有相同父元素",
            "如果需要选择紧接在另一个元素后的元素，而且二者有相同的父元素，可以使用相邻兄弟选择器（Adjacent sibling selector）"
          ],
          applications: [
            "示例：div p",
            "示例：div>p",
            "示例：div+p",
            "示例：div~p",
            "示例：a:link {color:#FF0000;} /* 未访问的链接 */",
            "示例：a.red:visited {color:#FF0000;}"
          ],
          pitfalls: [
            "注意：在CSS定义中，a:hover 必须被置于 a:link 和 a:visited 之后，才是有效的",
            "注意：在 CSS 定义中，a:active 必须被置于 a:hover 之后，才是有效的",
            "注意：伪类的名称不区分大小写",
            "注意：在IE8的之前版本必须声明<!DOCTYPE> ，这样 :first-child 才能生效",
            "注意：IE8必须声明<!DOCTYPE>才能支持;lang伪类"
          ],
          method: "按站内顺序读「CSS 组合选择符 → CSS 伪类(Pseudo-classes) → CSS 伪元素 → CSS 下拉菜单 → CSS 导航栏 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 11 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「CSS 组合选择符、后代选择器、子元素选择器」的用法，并把 11 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【CSS 组合选择符】CSS 组合选择符：组合选择符说明了两个选择器之间的关系",
              "【CSS 组合选择符】后代选择器：后代选择器用于选取某元素的后代元素",
              "【CSS 组合选择符】子元素选择器：与后代选择器相比，子元素选择器（Child selectors）只能选择作为某元素直接/一级子元素的元素",
              "【CSS 组合选择符】相邻兄弟选择器：相邻兄弟选择器（Adjacent sibling selector）可选择紧接在另一元素后的元素，且二者有相同父元素",
              "【CSS 组合选择符】后续兄弟选择器：后续兄弟选择器选取所有指定元素之后的相邻兄弟元素",
              "【CSS 伪类(Pseudo-classes)】CSS 伪类(Pseudo-classes)：CSS伪类是用来添加一些选择器的特殊效果"
            ],
            mechanism: [
              "组合选择符说明了两个选择器之间的关系",
              "CSS组合选择符包括各种简单选择符的组合方式",
              "在 CSS3 中包含了四种组合方式:",
              "子元素选择器(以大于 > 号分隔）",
              "相邻兄弟选择器（以加号 + 分隔）",
              "普通兄弟选择器（以波浪号～分隔）",
              "后代选择器用于选取某元素的后代元素",
              "以下实例选取所有 <p> 元素插入到 <div> 元素中:",
              "与后代选择器相比，子元素选择器（Child selectors）只能选择作为某元素直接/一级子元素的元素",
              "以下实例选择了<div>元素中所有直接子元素 <p> ："
            ],
            example: {
              title: "CSS 网页布局 · 响应式网页布局",
              language: "css",
              code: "* {\nbox-sizing: border-box;\n}\n\nbody {\nfont-family: Arial;\npadding: 10px;\nbackground: #f1f1f1;\n}\n\n/* 头部标题 */\n.header {\npadding: 30px;\ntext-align: center;\nbackground: white;\n}\n\n.header h1 {\nfont-size: 50px;\n}\n\n/* 导航条 */\n.topnav {\noverflow: hidden;\nbackground-color: #333;\n}\n\n/* 导航条链接 */\n.topnav a {\nfloat: left;\ndisplay: block;\ncolor: #f2f2f2;\ntext-align: center;\npadding: 14px 16px;\ntext-decoration: none;\n}\n\n/* 链接颜色修改 */\n.topnav a:hover {\nbackground-color: #ddd;\ncolor: black;\n}\n\n/* 创建两列 */\n/* Left column */\n.leftcolumn {\nfloat: left;\nwidth: 75%;\n}\n\n/* 右侧栏 */\n.rightcolumn {\nfloat: left;\nwidth: 25%;\nbackground-color: #f1f1f1;\npadding-left: 20px;\n}\n\n/* 图像部分 */\n.fakeimg {\nbackground-color: #aaa;\nwidth: 100%;\npadding: 20px;\n}\n\n/* 文章卡片效果 */\n.card {\nbackground-color: white;\npadding: 20px;\nmargin-top: 20px;\n}\n\n/* 列后面清除浮动 */\n.row:after {\ncontent: \"\";\ndisplay: table;\nclear: both;\n}\n\n/* 底部 */\n.footer {\npadding: 20px;\ntext-align: center;\nbackground: #ddd;\nmargin-top: 20px;\n}\n\n/* 响应式布局 - 屏幕尺寸小于 800px 时，两列布局改为上下布局 */\n@media screen and (max-width: 800px) {\n.leftcolumn, .rightcolumn {\nwidth: 100%;\npadding: 0;\n}\n}\n\n/* 响应式布局 -屏幕尺寸小于 400px 时，导航等布局改为上下布局 */\n@media screen and (max-width: 400px) {\n.topnav a {\nfloat: none;\nwidth: 100%;\n}\n}",
              explanation: "通过以上等学习我们来创建一个响应式等页面，页面的布局会根据屏幕的大小来调整："
            },
            practiceSteps: [
              "先通读本节 17 页：CSS 组合选择符、CSS 伪类(Pseudo-classes)、CSS 伪元素、CSS 下拉菜单 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 11 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「CSS 盒子模型、边框与定位」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 11 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-css-4",
          title: "CSS 布局、导航与响应式设计",
          summary: "CSS 布局、导航与响应式设计（CSS 教程）：使用 CSS3 border-radius 属性，你可以给任何元素制作 \"圆角\" 本节含 7 页、9 道配套题。",
          concepts: [
            "CSS3 圆角",
            "浏览器支持",
            "CSS3 border-radius 属性",
            "CSS3 圆角属性",
            "响应式 Web 设计 - 网格视图",
            "什么是网格视图?",
            "响应式 Web 设计 - Viewport",
            "什么是 Viewport?",
            "设置 Viewport",
            "实例1、没有添加 viewport：点击查看"
          ],
          principles: [
            "使用 CSS3 border-radius 属性，你可以给任何元素制作 \"圆角\"",
            "表格中的数字表示支持该属性的第一个浏览器的版本号",
            "-webkit- 或 -moz- 前面的数字表示支持该前缀的第一个版本",
            "如果你在 border-radius 属性中只指定一个值，那么将生成 4 个圆角",
            "但是，如果你要在四个角上一一指定，可以使用以下规则：",
            "border-radius",
            "所有四个边角 border-*-*-radius 属性的缩写",
            "很多网页都是基于网格设计的，这说明网页是按列来布局的"
          ],
          applications: [
            "示例：#rcorners1 {",
            "示例：#rcorners4 {",
            "示例：＜meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"＞",
            "示例：@media only screen and (max-width: 500px) {",
            "示例：/* For desktop: */",
            "示例：/* 为移动端设计: */"
          ],
          pitfalls: [
            "在先前的教程中我们使用行和列来制作网页，它是响应式的，但在小屏幕上并不能友好的展示",
            "这就意味着我们必须对 CSS 做一些改变",
            "注意在以上实例中，视频播放器根据屏幕大小自动调整比例，且可以比原始尺寸大",
            "注意在以上实例中，图片会比它的原始图片大",
            "注意该属性保持了图片的比例因此"
          ],
          method: "按站内顺序读「CSS3 圆角 → 响应式 Web 设计 - 网格视图 → 响应式 Web 设计 - Viewport → 响应式 Web 设计 - 媒体查询 → 响应式 Web 设计 - 视频(Video) → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 9 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「CSS3 圆角、浏览器支持、CSS3 border-radius 属性」的用法，并把 9 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【CSS3 圆角】CSS3 圆角：使用 CSS3 border-radius 属性，你可以给任何元素制作 \"圆角\"",
              "【CSS3 圆角】浏览器支持：表格中的数字表示支持该属性的第一个浏览器的版本号",
              "【CSS3 圆角】CSS3 border-radius 属性：使用 CSS3 border-radius 属性，你可以给任何元素制作 \"圆角\"",
              "【CSS3 圆角】CSS3 border-radius - 指定每个圆角：如果你在 border-radius 属性中只指定一个值，那么将生成 4 个圆角",
              "【CSS3 圆角】CSS3 圆角属性：border-radius",
              "【响应式 Web 设计 - 网格视图】什么是网格视图?：很多网页都是基于网格设计的，这说明网页是按列来布局的"
            ],
            mechanism: [
              "使用 CSS3 border-radius 属性，你可以给任何元素制作 \"圆角\"",
              "表格中的数字表示支持该属性的第一个浏览器的版本号",
              "-webkit- 或 -moz- 前面的数字表示支持该前缀的第一个版本",
              "1. 指定背景颜色的元素圆角：",
              "3. 指定背景图片的元素圆角:",
              "如果你在 border-radius 属性中只指定一个值，那么将生成 4 个圆角",
              "但是，如果你要在四个角上一一指定，可以使用以下规则：",
              "四个值: 第一个值为左上角，第二个值为右上角，第三个值为右下角，第四个值为左下角",
              "三个值: 第一个值为左上角, 第二个值为右上角和左下角，第三个值为右下角",
              "两个值: 第一个值为左上角与右下角，第二个值为右上角与左下角"
            ],
            example: {
              title: "响应式 Web 设计 - 媒体查询 · 手机设备",
              language: "css",
              code: "/* For mobile phones: */\n[class*=\"col-\"] {\nwidth: 100%;\n}\n@media only screen and (min-width: 600px) {\n\n\t/* For tablets: */\n.col-m-1 {width: 8.33%;}\n.col-m-2 {width: 16.66%;}\n.col-m-3 {width: 25%;}\n.col-m-4 {width: 33.33%;}\n.col-m-5 {width: 41.66%;}\n.col-m-6 {width: 50%;}\n.col-m-7 {width: 58.33%;}\n.col-m-8 {width: 66.66%;}\n.col-m-9 {width: 75%;}\n.col-m-10 {width: 83.33%;}\n.col-m-11 {width: 91.66%;}\n.col-m-12 {width: 100%;}\n}\n@media only screen and (min-width:\n\t768px) {\n/* For desktop: */\n.col-1 {width: 8.33%;}\n.col-2 {width: 16.66%;}\n.col-3 {width: 25%;}\n.col-4 {width: 33.33%;}\n.col-5 {width: 41.66%;}\n.col-6 {width: 50%;}\n.col-7 {width: 58.33%;}\n.col-8 {width: 66.66%;}\n.col-9 {width: 75%;}\n.col-10 {width: 83.33%;}\n.col-11 {width: 91.66%;}\n.col-12 {width: 100%;}\n}",
              explanation: "在屏幕为 600px 时添加媒体查询，并设置新的样式（屏幕大于600px但小于768px）："
            },
            practiceSteps: [
              "先通读本节 7 页：CSS3 圆角、响应式 Web 设计 - 网格视图、响应式 Web 设计 - Viewport、响应式 Web 设计 - 媒体查询 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 9 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「CSS 布局、导航与响应式设计」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 9 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-css-1",
        "rn-css-2",
        "rn-css-6",
        "rn-css-7",
        "rn-css-10",
        "rn-css-13",
        "rn-css-14",
        "rn-css-15",
        "rn-css3-3",
        "rn-css3-20",
        "rn-css-4",
        "rn-css-5",
        "rn-css-9",
        "rn-css-11",
        "rn-css-12",
        "rn-css-16",
        "rn-css-17",
        "rn-css-19",
        "rn-css-20",
        "rn-css3-11",
        "rn-css-3",
        "rn-css3-6",
        "rn-css3-7",
        "rn-css3-8",
        "rn-css3-9",
        "rn-css3-10",
        "rn-css3-12",
        "rn-css3-13",
        "rn-css3-17",
        "rn-css3-18",
        "rn-css3-19",
        "rn-css-8",
        "rn-css-18",
        "rn-css3-1",
        "rn-css3-2",
        "rn-css3-4",
        "rn-css3-5",
        "rn-css3-14",
        "rn-css3-15",
        "rn-css3-16"
      ],
      lesson: {
        overview: [
          "《CSS 教程》取自菜鸟教程，共 48 页，整理为 4 个知识点、40 道配套测验题。",
          "知识点顺序保持站内阅读顺序：CSS 基础语法与选择器 → CSS 文本、字体与列表样式 → CSS 盒子模型、边框与定位 → CSS 布局、导航与响应式设计。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 40 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 CSS 基础语法与选择器 并跑通示例",
            evidence: "本地示例输出与站点示例一致"
          },
          {
            title: "完成全部配套测验",
            evidence: "题正确率 ≥ 80%（共 40 道）"
          },
          {
            title: "能独立复述全部知识点",
            evidence: "不看文档说出每个知识点的用法与易错点"
          }
        ],
        completionCriteria: ["《CSS 教程》4 个知识点全部读完。", "配套 40 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    },
    {
      key: "rn-javascript-stage",
      title: "JavaScript 教程",
      weeks: "第 1 阶段",
      goal: "把「JavaScript 教程」的 85 页内容按 7 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出JavaScript 教程的典型用法，并把 20 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-javascript-1",
          title: "JavaScript 入门、语法与变量",
          summary: "JavaScript 入门、语法与变量（JavaScript 教程）：JavaScript 是 Web 的编程语言 本节含 17 页、3 道配套题。",
          concepts: [
            "JavaScript 教程",
            "JavaScript 在线实例",
            "为什么学习 JavaScript?",
            "谁适合阅读本教程?",
            "阅读本教程前，您需要了解的知识：",
            "JavaScript 实例",
            "JavaScript 测验",
            "JavaScript 用法",
            "＜script＞ 标签",
            "<body> 中的 JavaScript"
          ],
          principles: [
            "JavaScript 是 Web 的编程语言",
            "所有现代的 HTML 页面都可以使用 JavaScript",
            "本教程包含了大量的 JavaScript 实例，您可以点击 \"尝试一下\" 来在线查看实例",
            "在每个页面您可以点击 \"尝试一下\" 在线查看实例",
            "JavaScript 是 web 开发人员必须学习的 3 门语言中的一门：",
            "HTML 定义了网页的内容",
            "1. 如果您想学习 JavaScript，您可以学习本教程：",
            "了解 JavaScript 是如何与 HTML 和 CSS 一起工作的"
          ],
          applications: [
            "示例：＜script＞",
            "示例：<!DOCTYPE html>",
            "示例：document.write(\"<h1>这是一个标题</h1>\");",
            "示例：<button type=\"button\" onclick＝\"alert('欢迎!')\">点我!</button>",
            "示例：console.log(\"Hello, World!\");",
            "示例：console.log(\"runoob-1\")"
          ],
          pitfalls: [
            "JavaScript 是 web 开发人员必须学习的 3 门语言中的一门：",
            "HTML 中的 Javascript 脚本代码必须位于 ＜script＞ 与 ＜/script＞ 标签之间",
            "外部脚本不能包含 ＜script＞ 标签",
            "VSCode 安装也很简单，打开官网 https://code.visualstudio.com/，下载软件包，一步步安装即可，安装过程注意安装路径设置、环境变量默认自动添加到系统中，勾选以下所有选项：",
            "使用 window.alert() 弹出警告框"
          ],
          method: "按站内顺序读「JavaScript 教程 → JavaScript 用法 → JavaScript 简介 → JavaScript VScode → Chrome 浏览器中执行 JavaScript → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「JavaScript 教程、JavaScript 在线实例、为什么学习 JavaScript?」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【JavaScript 教程】JavaScript 教程：JavaScript 是 Web 的编程语言",
              "【JavaScript 教程】JavaScript 在线实例：本教程包含了大量的 JavaScript 实例，您可以点击 \"尝试一下\" 来在线查看实例",
              "【JavaScript 教程】为什么学习 JavaScript?：JavaScript 是 web 开发人员必须学习的 3 门语言中的一门：",
              "【JavaScript 教程】谁适合阅读本教程?：1. 如果您想学习 JavaScript，您可以学习本教程：",
              "【JavaScript 教程】阅读本教程前，您需要了解的知识：：阅读本教程，您需要有以下基础：",
              "【JavaScript 教程】JavaScript 实例：学习 100 多个 JavaScript 实例"
            ],
            mechanism: [
              "JavaScript 是 Web 的编程语言",
              "所有现代的 HTML 页面都可以使用 JavaScript",
              "JavaScript 非常容易学",
              "本教程将教你学习从初级到高级 JavaScript 知识",
              "本教程包含了大量的 JavaScript 实例，您可以点击 \"尝试一下\" 来在线查看实例",
              "在每个页面您可以点击 \"尝试一下\" 在线查看实例",
              "尝试每个实例，并且在线修改代码，查看不同的运行效果",
              "如果能根据本站的实例一步一个脚印学习，你将会在很短的时间内学会 JavaScript",
              "JavaScript 是 web 开发人员必须学习的 3 门语言中的一门：",
              "JavaScript 控制了网页的行为"
            ],
            example: {
              title: "JavaScript 函数 · 向未声明的 JavaScript 变量分配值",
              language: "javascript",
              code: "var var1 = 1; // 不可配置全局属性\nvar2 = 2; // 没有使用 var 声明，可配置全局属性\n\nconsole.log(this.var1); // 1\nconsole.log(window.var1); // 1\nconsole.log(window.var2); // 2\n\ndelete var1; // false 无法删除\nconsole.log(var1); //1\n\ndelete var2;\nconsole.log(delete var2); // true\nconsole.log(var2); // 已经删除 报错变量未定义",
              explanation: "如果您把值赋给尚未声明的变量，该变量将被自动作为 window 的一个属性"
            },
            practiceSteps: [
              "先通读本节 17 页：JavaScript 教程、JavaScript 用法、JavaScript 简介、JavaScript VScode 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「JavaScript 入门、语法与变量」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-javascript-2",
          title: "JavaScript 运算符与流程控制",
          summary: "JavaScript 运算符与流程控制（JavaScript 教程）：y=5，下面的表格解释了这些算术运算符： 本节含 13 页、3 道配套题。",
          concepts: [
            "JavaScript 运算符",
            "JavaScript 算术运算符",
            "JavaScript 赋值运算符",
            "用于字符串的 + 运算符",
            "对字符串和数字进行加法运算",
            "JavaScript 比较 和 逻辑运算符",
            "比较运算符",
            "如何使用",
            "逻辑运算符",
            "条件运算符"
          ],
          principles: [
            "y=5，下面的表格解释了这些算术运算符：",
            "赋值运算符用于给 JavaScript 变量赋值",
            "给定 x=10 和 y=5，下面的表格解释了赋值运算符：",
            "+ 运算符用于把文本值或字符串变量加起来（连接起来）",
            "如需把两个或多个字符串变量连接起来，请使用 + 运算符",
            "两个数字相加，返回数字相加的和，如果数字与字符串相加，返回字符串，如下实例：",
            "规则:如果把数字与字符串相加，结果将成为字符串",
            "比较和逻辑运算符用于测试 true 或者"
          ],
          applications: [
            "示例：y=5;",
            "示例：txt1=\"What a very\";",
            "示例：x=5+5;",
            "示例：voteable=(age<18)?\"年龄太小\":\"年龄已达到\";",
            "示例：if (time<20)",
            "示例：if (time<10)"
          ],
          pitfalls: [
            "使用大写字母（IF）会生成 JavaScript 错误",
            "请注意，在这个语法中，没有 ..else..",
            "Statement 2 定义循环运行的条件（i 必须小于 5）",
            "如果您省略了语句 2，那么必须在循环内提供 break",
            "否则循环就无法停下来"
          ],
          method: "按站内顺序读「JavaScript 运算符 → JavaScript 比较 和 逻辑运算符 → JavaScript if...Else 语句 → JavaScript switch 语句 → JavaScript for 循环 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「JavaScript 运算符、JavaScript 算术运算符、JavaScript 赋值运算符」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【JavaScript 运算符】JavaScript 运算符：运算符 = 用于给 JavaScript 变量赋值",
              "【JavaScript 运算符】JavaScript 算术运算符：y=5，下面的表格解释了这些算术运算符：",
              "【JavaScript 运算符】JavaScript 赋值运算符：赋值运算符用于给 JavaScript 变量赋值",
              "【JavaScript 运算符】用于字符串的 + 运算符：+ 运算符用于把文本值或字符串变量加起来（连接起来）",
              "【JavaScript 运算符】对字符串和数字进行加法运算：两个数字相加，返回数字相加的和，如果数字与字符串相加，返回字符串，如下实例：",
              "【JavaScript 比较 和 逻辑运算符】JavaScript 比较 和 逻辑运算符：比较和逻辑运算符用于测试 true 或者"
            ],
            mechanism: [
              "运算符 = 用于给 JavaScript 变量赋值",
              "算术运算符 + 用于把值加起来",
              "y=5，下面的表格解释了这些算术运算符：",
              "赋值运算符用于给 JavaScript 变量赋值",
              "给定 x=10 和 y=5，下面的表格解释了赋值运算符：",
              "+ 运算符用于把文本值或字符串变量加起来（连接起来）",
              "如需把两个或多个字符串变量连接起来，请使用 + 运算符",
              "要想在两个字符串之间增加空格，需要把空格插入一个字符串之中：",
              "两个数字相加，返回数字相加的和，如果数字与字符串相加，返回字符串，如下实例：",
              "规则:如果把数字与字符串相加，结果将成为字符串"
            ],
            example: {
              title: "JavaScript 错误 - throw、try 和 catch · finally 语句",
              language: "javascript",
              code: "function myFunction() {\n// 获取元素\nconst messageElement = document.getElementById(\"p01\");\nconst inputElement = document.getElementById(\"demo\");\n\n// 清空之前的消息\nmessageElement.innerHTML = \"\";\n\n// 获取输入值并去除首尾空格\nconst rawValue = inputElement.value.trim();\n\ntry {\n// 1. 检查是否为空\nif (rawValue === \"\") {\nthrow new Error(\"输入不能为空，请填写一个数字\");\n}\n\n// 2. 检查是否为有效数字\nif (isNaN(rawValue)) {\nthrow new Error(\"请输入有效的数字（如：5、10.5、-3）\");\n}\n\n// 转换为数字\nconst x = Number(rawValue);\n\n// 3. 检查是否为整数（可根据需求调整）\nif (!Number.isInteger(x)) {\nthrow new Error(\"请输入整数（不支持小数）\");\n}\n\n// 4. 检查数字范围（可根据需求调整）\nif (x > 10) {\nthrow new Error(`数字 ${x} 太大了，请输入 5-10 之间的数字`);\n}\n\nif (x < 5) {\nthrow new Error(`数字 ${x} 太小了，请输入 5-10 之间的数字`);\n}\n\n// 5. 检查是否为负数的特殊情况\nif (x < 0) {\nthrow new Error(\"请输入正数（不支持负数）\");\n}\n\n// 所有验证通过\nmessageElement.innerHTML = `验证通过！您输入的数字是：${x}`;\nmessageElement.style.color = \"green\";\n\n// 成功时可执行其他操作\nconsole.log(`用户输入了有效数字：${x}`);\n\n} catch (err) {\n// 显示错误信息\nmessageElement.innerHTML = `错误：${err.message}`;\nmessageElement.style.color = \"red\";\n\n// 可选：将错误记录到控制台\nconsole.error(\"输入验证失败：\", err.message);\n\n} finally {\n// 无论成功或失败，都清空输入框\ninputElement.value = \"\";\n\n// 可选：重新聚焦到输入框，方便用户重新输入\ninputElement.focus();\n}\n}",
              explanation: "finally 语句不论之前的 try 和 catch 中是否产生异常都会执行该代码块"
            },
            practiceSteps: [
              "先通读本节 13 页：JavaScript 运算符、JavaScript 比较 和 逻辑运算符、JavaScript if...Else 语句、JavaScript switch 语句 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「JavaScript 运算符与流程控制」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-javascript-3",
          title: "JavaScript 函数、作用域与闭包",
          summary: "JavaScript 函数、作用域与闭包（JavaScript 教程）：JavaScript 严格模式（strict mode）即在严格的条件下运行 本节含 5 页、3 道配套题。",
          concepts: [
            "使用 \"use strict\" 指令",
            "严格模式声明",
            "严格模式的限制",
            "保留关键字",
            "JavaScript 使用误区",
            "赋值运算符应用错误",
            "比较运算符常见错误",
            "加法与连接注意事项",
            "浮点型数据使用注意事项",
            "JavaScript 字符串分行"
          ],
          principles: [
            "JavaScript 严格模式（strict mode）即在严格的条件下运行",
            "\"use strict\" 指令在 JavaScript 1.8.5 (ECMAScript5) 中新增",
            "它不是一条语句，但是是一个字面量表达式，在 JavaScript 旧版本中会被忽略",
            "严格模式通过在脚本或函数的头部添加 use strict; 表达式来声明",
            "实例中我们可以在浏览器按下 F12 (或点击\"工具>更多工具>开发者工具\") 开启调试模式，查看报错信息",
            "不允许使用未声明的变量：",
            "为了向将来Javascript的新版本过渡，严格模式新增了一些保留关键字：",
            "本章节我们将讨论 JavaScript 的使用误区"
          ],
          applications: [
            "示例：\"use strict\";",
            "示例：var x = 0;",
            "示例：var x = 10;",
            "示例：var x = 10 + 5; //",
            "示例：var x = 0.1;",
            "示例：var x ="
          ],
          pitfalls: [
            "严格模式下你不能使用未声明的变量",
            "一些在\"正常模式\"下可以运行的语句，在\"严格模式\"下将不能运行",
            "变量名不能使用 \"eval\" 字符串:",
            "变量名不能使用 \"arguments\" 字符串:",
            "由于一些安全原因，在作用域 eval() 创建的变量不能被调用："
          ],
          method: "按站内顺序读「JavaScript 严格模式(use strict) → JavaScript 使用误区 → JavaScript 表单 → JavaScript 验证 API → JavaScript 表单验证」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「使用 \"use strict\" 指令、严格模式声明、严格模式的限制」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【JavaScript 严格模式(use stric…】JavaScript 严格模式(use strict)：JavaScript 严格模式（strict mode）即在严格的条件下运行",
              "【JavaScript 严格模式(use stric…】使用 \"use strict\" 指令：\"use strict\" 指令在 JavaScript 1.8.5 (ECMAScript5) 中新增",
              "【JavaScript 严格模式(use stric…】严格模式声明：严格模式通过在脚本或函数的头部添加 use strict; 表达式来声明",
              "【JavaScript 严格模式(use stric…】严格模式的限制：不允许使用未声明的变量：",
              "【JavaScript 严格模式(use stric…】保留关键字：为了向将来Javascript的新版本过渡，严格模式新增了一些保留关键字：",
              "【JavaScript 使用误区】JavaScript 使用误区：本章节我们将讨论 JavaScript 的使用误区"
            ],
            mechanism: [
              "JavaScript 严格模式（strict mode）即在严格的条件下运行",
              "\"use strict\" 指令在 JavaScript 1.8.5 (ECMAScript5) 中新增",
              "它不是一条语句，但是是一个字面量表达式，在 JavaScript 旧版本中会被忽略",
              "\"use strict\" 的目的是指定代码在严格条件下执行",
              "严格模式下你不能使用未声明的变量",
              "Internet Explorer 10 +、Firefox 4+、 Chrome 13+、 Safari 5.1+、 Opera 12+",
              "严格模式通过在脚本或函数的头部添加 use strict; 表达式来声明",
              "实例中我们可以在浏览器按下 F12 (或点击\"工具>更多工具>开发者工具\") 开启调试模式，查看报错信息",
              "也可以通过右击鼠标，选择 \"检查\" 来查看，Gif 图演示如下：",
              "在函数内部声明是局部作用域 (只在函数内使用严格模式):"
            ],
            example: {
              title: "JavaScript 表单验证 · 使用正则表达式进行验证",
              language: "javascript",
              code: "function validateEmail(email) {\n\nvar regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;\n\nreturn regex.test(email);\n\n}\n\nvar email = \"example@example.com\";\n\nif (validateEmail(email)) {\n\nconsole.log('Valid email address.');\n\n} else {\n\nconsole.log('Invalid email address.');\n\n}",
              explanation: "正则表达式（Regular Expression）是一种强大的工具，可以用于匹配复杂的字符串模式"
            },
            practiceSteps: [
              "先通读本节 5 页：JavaScript 严格模式(use strict)、JavaScript 使用误区、JavaScript 表单、JavaScript 验证 API 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「JavaScript 函数、作用域与闭包」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-javascript-4",
          title: "JavaScript 对象、类与原型",
          summary: "JavaScript 对象、类与原型（JavaScript 教程）：在 JavaScript 中，一些标识符是保留关键字，不能用作变量名或函数名 本节含 9 页、3 道配套题。",
          concepts: [
            "JavaScript 保留关键字",
            "JavaScript 标准",
            "JavaScript 对象、属性和方法",
            "Java 保留关键字",
            "Window 保留关键字",
            "HTML 事件句柄",
            "JavaScript this 关键字",
            "方法中的 this",
            "单独使用 this",
            "函数中使用 this（默认）"
          ],
          principles: [
            "在 JavaScript 中，一些标识符是保留关键字，不能用作变量名或函数名",
            "所有的现代浏览器完全支持 ECMAScript 3（ES3，JavaScript 的第三版，从 1999 年开始）",
            "ECMAScript 4（ES4）未通过",
            "Javascript 的保留关键字不可以用作变量、标签或者函数名",
            "有些保留关键字是作为 Javascript 以后扩展使用",
            "您也应该避免使用 JavaScript 内置的对象、属性和方法的名称作为 Javascript 的变量或函数名：",
            "JavaScript 经常与 Java 一起使用",
            "您应该避免使用一些 Java 对象和属性作为 JavaScript 标识符："
          ],
          applications: [
            "示例：var person = {",
            "示例：fullName : function() {",
            "示例：var x = this;",
            "示例：function myFunction() {",
            "示例：\"use strict\";",
            "示例：<button onclick＝\"this.style.display='none'\">"
          ],
          pitfalls: [
            "在 JavaScript 中，一些标识符是保留关键字，不能用作变量名或函数名",
            "您也应该避免使用 JavaScript 内置的对象、属性和方法的名称作为 Javascript 的变量或函数名：",
            "您应该避免使用一些 Java 对象和属性作为 JavaScript 标识符：",
            "在 HTML 中，您必须（为了可移植性，您也应该这么做）避免使用 HTML 和 Window 对象和属性的名称作为 Javascript 的变量及函数名：",
            "除此之外，您还应该避免使用 HTML 事件句柄的名称作为 Javascript 的变量及函数名"
          ],
          method: "按站内顺序读「JavaScript 保留关键字 → JavaScript this 关键字 → JavaScript JSON → JavaScript let 和 const → javascript：void(0) 含义 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「JavaScript 保留关键字、JavaScript 标准、JavaScript 对象、属性和方法」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【JavaScript 保留关键字】JavaScript 保留关键字：在 JavaScript 中，一些标识符是保留关键字，不能用作变量名或函数名",
              "【JavaScript 保留关键字】JavaScript 标准：所有的现代浏览器完全支持 ECMAScript 3（ES3，JavaScript 的第三版，从 1999 年开始）",
              "【JavaScript 保留关键字】JavaScript 保留关键字：Javascript 的保留关键字不可以用作变量、标签或者函数名",
              "【JavaScript 保留关键字】JavaScript 对象、属性和方法：您也应该避免使用 JavaScript 内置的对象、属性和方法的名称作为 Javascript 的变量或函数名：",
              "【JavaScript 保留关键字】Java 保留关键字：JavaScript 经常与 Java 一起使用",
              "【JavaScript 保留关键字】Window 保留关键字：JavaScript 可以在 HTML 外部使用"
            ],
            mechanism: [
              "在 JavaScript 中，一些标识符是保留关键字，不能用作变量名或函数名",
              "所有的现代浏览器完全支持 ECMAScript 3（ES3，JavaScript 的第三版，从 1999 年开始）",
              "ECMAScript 4（ES4）未通过",
              "ECMAScript 5（ES5，2009 年发布）",
              "ECMAScript 6（ES6，2015 年发布），是 JavaScript 最新的官方版本",
              "随着时间的推移，我们开始看到，所有的现代浏览器已经完全支持 ES6",
              "Javascript 的保留关键字不可以用作变量、标签或者函数名",
              "有些保留关键字是作为 Javascript 以后扩展使用",
              "* 标记的关键字是 ECMAScript5 中新添加的",
              "您也应该避免使用 JavaScript 内置的对象、属性和方法的名称作为 Javascript 的变量或函数名："
            ],
            example: {
              title: "JavaScript 异步编程 · 异步 AJAX",
              language: "javascript",
              code: "var xhr = new XMLHttpRequest();\n\nxhr.onload＝ function () {\n// 输出接收到的文字数据\ndocument.getElementById(\"demo\").innerHTML=xhr.responseText;\n}\n\nxhr.onerror＝ function () {\ndocument.getElementById(\"demo\").innerHTML=\"请求出错\";\n}\n\n// 发送异步 GET 请求\nxhr.open(\"GET\", \"https://www.runoob.com/try/ajax/ajax_info.txt\", true);\nxhr.send();",
              explanation: "除了 setTimeout 函数以外，异步回调广泛应用于 AJAX 编程"
            },
            practiceSteps: [
              "先通读本节 9 页：JavaScript 保留关键字、JavaScript this 关键字、JavaScript JSON、JavaScript let 和 const 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「JavaScript 对象、类与原型」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-javascript-5",
          title: "JavaScript 内置对象与正则表达式",
          summary: "JavaScript 内置对象与正则表达式（JavaScript 教程）：JavaScript 测验 1 本节含 16 页、2 道配套题。",
          concepts: [
            "JavaScript 基础测验",
            "JavaScript 函数定义",
            "函数声明",
            "函数表达式",
            "Function() 构造函数",
            "函数提升（Hoisting）",
            "自调用函数",
            "函数可作为一个值使用",
            "函数是对象",
            "箭头函数"
          ],
          principles: [
            "JavaScript 测验 1",
            "JavaScript 测验 2",
            "JavaScript 使用关键字",
            "function 定义函数",
            "在之前的教程中，你已经了解了函数声明的语法 :",
            "函数声明后不会立即执行，会在我们需要的时候调用到",
            "JavaScript 函数可以通过一个表达式定义",
            "函数表达式可以存储在变量中："
          ],
          applications: [
            "示例：function functionName(parameters) {",
            "示例：var x = function (a, b) {return a * b};",
            "示例：var myFunction = new Function(\"a\", \"b\", \"return a *",
            "示例：myFunction(5);",
            "示例：(function () {",
            "示例：function myFunction(a, b) {"
          ],
          pitfalls: [
            "在 JavaScript 中，很多时候，你需要避免使用 new 关键字",
            "不能自调用声明的函数",
            "箭头函数是不能提升的，所以需要在使用之前定义",
            "注意：IE11 及更早 IE 版本不支持箭头函数",
            "注意 this 是保留关键字，你不能修改 this 的值"
          ],
          method: "按站内顺序读「JavaScript 基础测验 → JavaScript 函数定义 → JavaScript 函数调用 → JavaScript 函数参数 → JavaScript 闭包 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 2 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「JavaScript 基础测验、JavaScript 函数定义、函数声明」的用法，并把 2 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【JavaScript 基础测验】JavaScript 基础测验：JavaScript 测验 1",
              "【JavaScript 函数定义】JavaScript 函数定义：JavaScript 使用关键字",
              "【JavaScript 函数定义】函数声明：在之前的教程中，你已经了解了函数声明的语法 :",
              "【JavaScript 函数定义】函数表达式：JavaScript 函数可以通过一个表达式定义",
              "【JavaScript 函数定义】Function() 构造函数：在以上实例中，我们了解到函数通过关键字 function 定义",
              "【JavaScript 函数定义】函数提升（Hoisting）：在之前的教程中我们已经了解了 \"hoisting(提升)\""
            ],
            mechanism: [
              "JavaScript 测验 1",
              "JavaScript 测验 2",
              "JavaScript 测验 3",
              "JavaScript 测验 4",
              "JavaScript 测验 5",
              "JavaScript 测验 6",
              "JavaScript 测验 7",
              "JavaScript 测验 8",
              "JavaScript 测验 9",
              "JavaScript 测验 10"
            ],
            example: {
              title: "JavaScript 类继承 · 使用原型链继承",
              language: "javascript",
              code: "function Animal(name) {\nthis.name = name;\n}\n\nAnimal.prototype.eat = function() {\nconsole.log(this.name + \" is eating.\");\n};\n\nfunction Dog(name, breed) {\nAnimal.call(this, name);\nthis.breed = breed;\n}\n\n// 建立原型链，让 Dog 继承 Animal\nDog.prototype = Object.create(Animal.prototype);\nDog.prototype.constructor = Dog;\n\nDog.prototype.bark = function() {\nconsole.log(this.name + \" is barking.\");\n};\n\nvar dog = new Dog(\"Buddy\", \"Labrador\");\ndog.eat(); // 调用从 Animal 继承的方法\ndog.bark(); // 调用 Dog 的方法",
              explanation: "在下面实例中，Animal 是一个基类，Dog 是一个继承自 Animal 的子类，Dog.prototype 使用 Object.create(Animal.prototype) 来创建一个新对象，它继承了 Animal.prototype 的方法和属性，通过将 Dog.prototype.constructor 设置为 Dog，确保继承链上的构造函数正确"
            },
            practiceSteps: [
              "先通读本节 16 页：JavaScript 基础测验、JavaScript 函数定义、JavaScript 函数调用、JavaScript 函数参数 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 2 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「JavaScript 内置对象与正则表达式」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 2 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-javascript-6",
          title: "JavaScript DOM 操作与事件",
          summary: "JavaScript DOM 操作与事件（JavaScript 教程）：JavaScript 中的所有事物都是对象：字符串、数值、数组、函数... 本节含 15 页、2 道配套题。",
          concepts: [
            "JavaScript 对象",
            "所有事物都是对象",
            "访问对象的属性",
            "访问对象的方法",
            "创建 JavaScript 对象",
            "使用 Object",
            "使用对象构造器",
            "创建 JavaScript 对象实例",
            "把属性添加到 JavaScript 对象",
            "把方法添加到 JavaScript 对象"
          ],
          principles: [
            "JavaScript 中的所有事物都是对象：字符串、数值、数组、函数...",
            "此外，JavaScript 允许自定义对象",
            "JavaScript 提供多个内建对象，比如 String、Date、Array 等等",
            "对象只是带有属性和方法的特殊数据类型",
            "方法是能够在对象上执行的动作",
            "您可以通过以下语法来调用方法：",
            "通过 JavaScript，您能够定义并创建自己的对象",
            "创建新对象有两种不同的方法："
          ],
          applications: [
            "示例：objectName.propertyName",
            "示例：objectName.methodName()",
            "示例：// 以构造函数形式来调用",
            "示例：function person(firstname,lastname,age,eyecolor)",
            "示例：var myFather=new person(\"John\",\"Doe\",50,\"blue\");",
            "示例：person.firstname=\"John\";"
          ],
          pitfalls: [
            "注意： for...in 循环中的代码块将针对每个属性执行一次",
            "我们也知道在一个已存在构造器的对象中是不能添加新的属性：",
            "绝不要在数字前面写零，除非您需要进行八进制转换",
            "注意: 如果增加天数会改变月份或者年份，那么日期对象会自动完成这种转换",
            "否则，其值为 true（即使当变量值为字符串 \"false\" 时）"
          ],
          method: "按站内顺序读「JavaScript 对象 → JavaScript prototype（原型对象） → JavaScript Number 对象 → JavaScript 字符串（String） 对象 → JavaScript Array（数组） 对象 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 2 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「JavaScript 对象、所有事物都是对象、访问对象的属性」的用法，并把 2 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【JavaScript 对象】JavaScript 对象：JavaScript 中的所有事物都是对象：字符串、数值、数组、函数...",
              "【JavaScript 对象】所有事物都是对象：JavaScript 提供多个内建对象，比如 String、Date、Array 等等",
              "【JavaScript 对象】JavaScript 对象：对象只是一种特殊的数据。对象拥有属性和方法。",
              "【JavaScript 对象】访问对象的属性：这个例子使用了 String 对象的 length 属性来获得字符串的长度：",
              "【JavaScript 对象】访问对象的方法：方法是能够在对象上执行的动作",
              "【JavaScript 对象】创建 JavaScript 对象：通过 JavaScript，您能够定义并创建自己的对象"
            ],
            mechanism: [
              "JavaScript 中的所有事物都是对象：字符串、数值、数组、函数...",
              "此外，JavaScript 允许自定义对象",
              "JavaScript 提供多个内建对象，比如 String、Date、Array 等等",
              "对象只是带有属性和方法的特殊数据类型",
              "这个例子使用了 String 对象的 length 属性来获得字符串的长度：",
              "在以上代码执行后，x 的值将是：",
              "方法是能够在对象上执行的动作",
              "您可以通过以下语法来调用方法：",
              "这个例子使用了 String 对象的 toUpperCase() 方法来将文本转换为大写：",
              "通过 JavaScript，您能够定义并创建自己的对象"
            ],
            example: {
              title: "JavaScript prototype（原型对象） · 修改原型",
              language: "javascript",
              code: "function Person(name) {\n\nthis.name = name;\n\n}\n\nPerson.prototype.sayHello = function() {\n\nconsole.log(\"Hello, my name is \" + this.name);\n\n};\n\nlet bob = new Person(\"Bob\");\n\nbob.sayHello(); // 输出: Hello, my name is Bob\n\n// 修改原型\n\nPerson.prototype.sayGoodbye = function() {\n\nconsole.log(\"Goodbye from \" + this.name);\n\n};\n\nbob.sayGoodbye(); // 输出: Goodbye from Bob",
              explanation: "你可以动态地修改对象的原型，这样可以影响到所有基于该原型创建的对象："
            },
            practiceSteps: [
              "先通读本节 15 页：JavaScript 对象、JavaScript prototype（原型对象）、JavaScript Number 对象、JavaScript 字符串（String） 对象 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 2 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「JavaScript DOM 操作与事件」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 2 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-javascript-7",
          title: "JavaScript BOM、异步与浏览器存储",
          summary: "JavaScript BOM、异步与浏览器存储（JavaScript 教程）：JavaScript 库 - jQuery、Prototype、MooTools 本节含 10 页、4 道配套题。",
          concepts: [
            "JavaScript Cookie",
            "JavaScript 库",
            "JavaScript 框架（库）",
            "jQuery",
            "Prototype",
            "MooTools",
            "其他框架",
            "CDN -内容分发网络",
            "使用框架",
            "JavaScript - 测试 jQuery"
          ],
          principles: [
            "JavaScript 库 - jQuery、Prototype、MooTools",
            "JavaScript 高级程序设计（特别是对浏览器差异的复杂处理），通常很困难也很耗时",
            "为了应对这些调整，许多的 JavaScript (helper) 库应运而生",
            "jQuery 是目前最受欢迎的 JavaScript 框架",
            "它使用 CSS 选择器来访问和操作网页上的 HTML 元素（DOM 对象）",
            "Prototype 是一种库，提供用于执行常见 web 任务的简单 API",
            "API 是应用程序编程接口（Application Programming Interface）的缩写",
            "MooTools 也是一个框架，提供了可使常见的 JavaScript 编程更为简单的 API"
          ],
          applications: [
            "示例：＜script src=\"https://cdn.staticfile.net/jquery/3.4.0/jquery.min.js\"＞",
            "示例：<!DOCTYPE html>",
            "示例：function myFunction()"
          ],
          pitfalls: ["您不能在 jQuery 对象上使用 HTML DOM 的属性和方法", "Alert(警告)框", "带有换行的警告框", "弹出一个警告框", "弹出一个带折行的警告框"],
          method: "按站内顺序读「JavaScript 计时事件 → JavaScript Cookie → JavaScript 库 → JavaScript - 测试 jQuery → JavaScript - 测试 Prototype → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 4 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「JavaScript Cookie、JavaScript 库、JavaScript 框架（库）」的用法，并把 4 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【JavaScript 库】JavaScript 库：JavaScript 库 - jQuery、Prototype、MooTools",
              "【JavaScript 库】JavaScript 框架（库）：JavaScript 高级程序设计（特别是对浏览器差异的复杂处理），通常很困难也很耗时",
              "【JavaScript 库】jQuery：jQuery 是目前最受欢迎的 JavaScript 框架",
              "【JavaScript 库】Prototype：Prototype 是一种库，提供用于执行常见 web 任务的简单 API",
              "【JavaScript 库】MooTools：MooTools 也是一个框架，提供了可使常见的 JavaScript 编程更为简单的 API",
              "【JavaScript 库】其他框架：下面是其他一些在上面未涉及的框架："
            ],
            mechanism: [
              "JavaScript 库 - jQuery、Prototype、MooTools",
              "JavaScript 高级程序设计（特别是对浏览器差异的复杂处理），通常很困难也很耗时",
              "为了应对这些调整，许多的 JavaScript (helper) 库应运而生",
              "这些 JavaScript 库常被称为 JavaScript 框架",
              "在本教程中，我们将了解到一些广受欢迎的 JavaScript 框架：",
              "所有这些框架都提供针对常见 JavaScript 任务的函数，包括动画、DOM 操作以及 Ajax 处理",
              "在本教程中，您将学习到如何开始使用它们，来使得 JavaScript 编程更容易、更安全且更有乐趣",
              "jQuery 是目前最受欢迎的 JavaScript 框架",
              "它使用 CSS 选择器来访问和操作网页上的 HTML 元素（DOM 对象）",
              "jQuery 同时提供 companion UI（用户界面）和插件"
            ],
            example: {
              title: "JavaScript - 测试 Prototype · 测试 Prototype",
              language: "javascript",
              code: "<!DOCTYPE html>\n<html>\n＜script src=\"https://cdn.staticfile.org/prototype/1.7.3/prototype.min.js\"＞\n＜/script＞\n＜script＞\nfunction myFunction()\n{\n$(\"h01\").writeAttribute(\"style\",\"color:red\").insert(\"Hello Prototype!\");\n}\nEvent.observe(window,\"load\",myFunction);\n＜/script＞\n</head>\n<body>\n<h1 id=\"h01\"></h1>\n</body>\n</html>",
              explanation: "请试一下下面这个例子："
            },
            practiceSteps: [
              "先通读本节 10 页：JavaScript 计时事件、JavaScript Cookie、JavaScript 库、JavaScript - 测试 jQuery 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 4 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「JavaScript BOM、异步与浏览器存储」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 4 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-javascript-1",
        "rn-javascript-2",
        "rn-javascript-18",
        "rn-javascript-11",
        "rn-javascript-12",
        "rn-javascript-20",
        "rn-javascript-5",
        "rn-javascript-10",
        "rn-javascript-13",
        "rn-javascript-6",
        "rn-javascript-7",
        "rn-javascript-16",
        "rn-javascript-3",
        "rn-javascript-17",
        "rn-javascript-4",
        "rn-javascript-19",
        "rn-javascript-8",
        "rn-javascript-9",
        "rn-javascript-14",
        "rn-javascript-15"
      ],
      lesson: {
        overview: [
          "《JavaScript 教程》取自菜鸟教程，共 85 页，整理为 7 个知识点、20 道配套测验题。",
          "知识点顺序保持站内阅读顺序：JavaScript 入门、语法与变量 → JavaScript 运算符与流程控制 → JavaScript 函数、作用域与闭包 → JavaScript 对象、类与原型 → JavaScript 内置对象与正则表达式 → JavaScript DOM 操作与事件 → JavaScript BOM、异步与浏览器存储。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 20 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 JavaScript 入门、语法与变量 并跑通示例",
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
        completionCriteria: ["《JavaScript 教程》7 个知识点全部读完。", "配套 20 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    },
    {
      key: "rn-jquery-stage",
      title: "jQuery 教程",
      weeks: "第 1 阶段",
      goal: "把「jQuery 教程」的 47 页内容按 4 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出jQuery 教程的典型用法，并把 20 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-jquery-1",
          title: "jQuery 入门、选择器与事件",
          summary: "jQuery 入门、选择器与事件（jQuery 教程）：jQuery 是一个 JavaScript 库 本节含 15 页、6 道配套题。",
          concepts: [
            "jQuery 教程",
            "本章节的每一篇都包含了在线实例",
            "jQuery 实例",
            "jQuery 测验",
            "jQuery 安装",
            "网页中添加 jQuery",
            "下载 jQuery",
            "替代方案",
            "jQuery 使用版本",
            "jQuery 简介"
          ],
          principles: [
            "jQuery 是一个 JavaScript 库",
            "jQuery 极大地简化了 JavaScript 编程",
            "通过本站的在线编辑器，你可以在线运行修改后的代码，并查看运行结果",
            "点击 \"尝试一下\" 按钮查看运行结果",
            "在本教程中，您将通过教程以及许多在线实例，学到如何通过使用 jQuery 应用 JavaScript 效果",
            "在菜鸟教程上测试你的 jQuery 技能!",
            "可以通过多种方法在网页中添加 jQuery",
            "有两个版本的 jQuery 可供下载："
          ],
          applications: [
            "示例：$(document).ready(function(){",
            "示例：<head>",
            "示例：$(\"p\").click();",
            "示例：$(\"p\").click(function(){",
            "示例：$(\"p\").dblclick(function(){",
            "示例：$(\"#p1\").mouseenter(function(){"
          ],
          pitfalls: [
            "您也许已经注意到在我们的实例中的所有 jQuery 函数位于一个 document ready 函数中：",
            "请注意，生成动画的过程中可同时使用多个属性：",
            "不过，需要记住一件重要的事情：当使用 animate() 时，必须使用 Camel 标记法书写所有的属性名，比如，必须使用 paddingLeft 而不是 padding-left，使用 marginRight 而不是 margin-right，等等",
            "以下实例没有回调函数，警告框会在隐藏效果完成前弹出："
          ],
          method: "按站内顺序读「jQuery 教程 → jQuery 安装 → jQuery 简介 → jQuery 语法 → jQuery 选择器 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 6 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「jQuery 教程、本章节的每一篇都包含了在线实例、jQuery 实例」的用法，并把 6 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【jQuery 教程】jQuery 教程：jQuery 是一个 JavaScript 库",
              "【jQuery 教程】本章节的每一篇都包含了在线实例：通过本站的在线编辑器，你可以在线运行修改后的代码，并查看运行结果",
              "【jQuery 教程】jQuery 实例：在本教程中，您将通过教程以及许多在线实例，学到如何通过使用 jQuery 应用 JavaScript 效果",
              "【jQuery 教程】jQuery 测验：在菜鸟教程上测试你的 jQuery 技能!",
              "【jQuery 安装】网页中添加 jQuery：可以通过多种方法在网页中添加 jQuery",
              "【jQuery 安装】下载 jQuery：有两个版本的 jQuery 可供下载："
            ],
            mechanism: [
              "jQuery 是一个 JavaScript 库",
              "jQuery 极大地简化了 JavaScript 编程",
              "通过本站的在线编辑器，你可以在线运行修改后的代码，并查看运行结果",
              "点击 \"尝试一下\" 按钮查看运行结果",
              "在本教程中，您将通过教程以及许多在线实例，学到如何通过使用 jQuery 应用 JavaScript 效果",
              "在菜鸟教程上测试你的 jQuery 技能!",
              "可以通过多种方法在网页中添加 jQuery",
              "从 jquery.com 下载 jQuery 库",
              "从 CDN 中载入 jQuery, 如从 Google 中加载 jQuery",
              "有两个版本的 jQuery 可供下载："
            ],
            example: {
              title: "jQuery - 设置内容和属性 · text()、html() 以及 val() 的回调函数",
              language: "javascript",
              code: "$(\"#btn1\").click(function(){\n$(\"#test1\").text(function(i,origText){\nreturn \"旧文本: \" + origText + \" 新文本: Hello world! (index: \" + i + \")\";\n});\n});\n\n$(\"#btn2\").click(function(){\n$(\"#test2\").html(function(i,origText){\nreturn \"旧 html: \" + origText + \" 新 html: Hello <b>world!</b> (index: \" + i + \")\";\n});\n});",
              explanation: "上面的三个 jQuery 方法：text()、html() 以及 val()，同样拥有回调函数"
            },
            practiceSteps: [
              "先通读本节 15 页：jQuery 教程、jQuery 安装、jQuery 简介、jQuery 语法 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 6 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「jQuery 入门、选择器与事件」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 6 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-jquery-2",
          title: "jQuery 效果与动画",
          summary: "jQuery 效果与动画（jQuery 教程）：通过 jQuery，可以很容易地添加新元素/内容 本节含 10 页、5 道配套题。",
          concepts: [
            "jQuery - 添加元素",
            "添加新的 HTML 内容",
            "jQuery append() 方法",
            "jQuery prepend() 方法",
            "jQuery - 删除元素",
            "删除元素/内容",
            "jQuery remove() 方法",
            "jQuery empty() 方法",
            "过滤被删除的元素",
            "jQuery - 获取并设置 CSS 类"
          ],
          principles: [
            "通过 jQuery，可以很容易地添加新元素/内容",
            "我们将学习用于添加新内容的四个 jQuery 方法：",
            "append() - 在被选元素的结尾插入内容",
            "jQuery append() 方法在被选元素的结尾插入内容（仍然在该元素的内部）",
            "jQuery prepend() 方法在被选元素的开头插入内容",
            "在上面的例子中，我们只在被选元素的开头/结尾插入文本/HTML",
            "不过，append() 和 prepend() 方法能够通过参数接收无限数量的新元素",
            "jQuery after() 方法在被选元素之后插入内容"
          ],
          applications: [
            "示例：$(\"p\").append(\"追加文本\");",
            "示例：$(\"p\").prepend(\"在开头追加文本\");",
            "示例：function appendText(){",
            "示例：$(\"img\").after(\"在后面添加文本\");",
            "示例：function afterText()",
            "示例：$(\"#div1\").remove();"
          ],
          pitfalls: ["本节以示例为主：动手前先确认语言/工具版本与站点示例一致，否则输出可能对不上。"],
          method: "按站内顺序读「jQuery - 添加元素 → jQuery - 删除元素 → jQuery - 获取并设置 CSS 类 → jQuery css() 方法 → jQuery 尺寸 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 5 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「jQuery - 添加元素、添加新的 HTML 内容、jQuery append() 方法」的用法，并把 5 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【jQuery - 添加元素】jQuery - 添加元素：通过 jQuery，可以很容易地添加新元素/内容",
              "【jQuery - 添加元素】添加新的 HTML 内容：我们将学习用于添加新内容的四个 jQuery 方法：",
              "【jQuery - 添加元素】jQuery append() 方法：jQuery append() 方法在被选元素的结尾插入内容（仍然在该元素的内部）",
              "【jQuery - 添加元素】jQuery prepend() 方法：jQuery prepend() 方法在被选元素的开头插入内容",
              "【jQuery - 添加元素】通过 append() 和 prepend() 方法添加若干新元素：在上面的例子中，我们只在被选元素的开头/结尾插入文本/HTML",
              "【jQuery - 添加元素】jQuery after() 和 before() 方法：jQuery after() 方法在被选元素之后插入内容"
            ],
            mechanism: [
              "通过 jQuery，可以很容易地添加新元素/内容",
              "我们将学习用于添加新内容的四个 jQuery 方法：",
              "append() - 在被选元素的结尾插入内容",
              "prepend() - 在被选元素的开头插入内容",
              "after() - 在被选元素之后插入内容",
              "before() - 在被选元素之前插入内容",
              "jQuery append() 方法在被选元素的结尾插入内容（仍然在该元素的内部）",
              "jQuery prepend() 方法在被选元素的开头插入内容",
              "在上面的例子中，我们只在被选元素的开头/结尾插入文本/HTML",
              "不过，append() 和 prepend() 方法能够通过参数接收无限数量的新元素"
            ],
            example: {
              title: "jQuery - 添加元素 · 通过 append() 和 prepend() 方法添加若干新元素",
              language: "javascript",
              code: "function appendText(){\nvar txt1=\"<p>文本-1。</p>\"; // 使用 HTML 标签创建文本\nvar txt2=$(\"<p></p>\").text(\"文本-2。\"); // 使用 jQuery 创建文本\nvar txt3=document.createElement(\"p\");\ntxt3.innerHTML=\"文本-3。\"; // 使用 DOM 创建文本 text with DOM\n$(\"body\").append(txt1,txt2,txt3); // 追加新元素\n}",
              explanation: "在上面的例子中，我们只在被选元素的开头/结尾插入文本/HTML"
            },
            practiceSteps: [
              "先通读本节 10 页：jQuery - 添加元素、jQuery - 删除元素、jQuery - 获取并设置 CSS 类、jQuery css() 方法 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 5 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「jQuery 效果与动画」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 5 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-jquery-3",
          title: "jQuery DOM 与 CSS 操作",
          summary: "jQuery DOM 与 CSS 操作（jQuery 教程）：AJAX 是与服务器交换数据的技术，它在不重载全部页面的情况下，实现了对部分网页的更新 本节含 6 页、5 道配套题。",
          concepts: [
            "jQuery - AJAX 简介",
            "什么是 AJAX？",
            "关于 jQuery 与 AJAX",
            "jQuery - AJAX load() 方法",
            "jQuery load() 方法",
            "HTTP 请求：GET vs POST",
            "jQuery $.get() 方法",
            "语法：",
            "jQuery $.post() 方法",
            "jQuery - noConflict() 方法"
          ],
          principles: [
            "AJAX 是与服务器交换数据的技术，它在不重载全部页面的情况下，实现了对部分网页的更新",
            "jQuery AJAX 实例",
            "AJAX = 异步 JavaScript 和 XML（Asynchronous JavaScript and XML）",
            "简短地说，在不重载整个网页的情况下，AJAX 通过后台加载数据，并在网页上进行显示",
            "jQuery 提供多个与 AJAX 有关的方法",
            "通过 jQuery AJAX 方法，您能够使用 HTTP Get 和 HTTP Post 从远程服务器上请求文本、HTML、XML 或 JSON - 同时您能够把这些外部数据直接载入网页的被选元素中",
            "jQuery load() 方法是简单但强大的 AJAX 方法",
            "load() 方法从服务器加载数据，并把返回的数据放入被选元素中"
          ],
          applications: [
            "示例：使用 jQuery AJAX 修改文本内容",
            "示例：$(selector).load(URL,data,callback);",
            "示例：$.get(URL,callback);",
            "示例：$.post(URL,callback);",
            "示例：$.noConflict();"
          ],
          pitfalls: ["这意味着您必须编写额外的代码对浏览器进行测试", "\"，而如果失败，则显示错误消息："],
          method: "按站内顺序读「jQuery - AJAX 简介 → jQuery - AJAX load() 方法 → jQuery - AJAX get() 和 post() 方法 → jQuery - noConflict() 方法 → jQuery 实例 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 5 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「jQuery - AJAX 简介、什么是 AJAX？、关于 jQuery 与 AJAX」的用法，并把 5 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【jQuery - AJAX 简介】jQuery - AJAX 简介：AJAX 是与服务器交换数据的技术，它在不重载全部页面的情况下，实现了对部分网页的更新",
              "【jQuery - AJAX 简介】什么是 AJAX？：AJAX = 异步 JavaScript 和 XML（Asynchronous JavaScript and XML）",
              "【jQuery - AJAX 简介】关于 jQuery 与 AJAX：jQuery 提供多个与 AJAX 有关的方法",
              "【jQuery - AJAX load() 方法】jQuery load() 方法：jQuery load() 方法是简单但强大的 AJAX 方法",
              "【jQuery - AJAX get() 和 pos…】jQuery - AJAX get() 和 post() 方法：jQuery get() 和 post() 方法用于通过 HTTP GET 或 POST 请求从服务器请求数据",
              "【jQuery - AJAX get() 和 pos…】HTTP 请求：GET vs POST：两种在客户端和服务器端进行请求-响应的常用方法是：GET 和 POST"
            ],
            mechanism: [
              "AJAX 是与服务器交换数据的技术，它在不重载全部页面的情况下，实现了对部分网页的更新",
              "jQuery AJAX 实例",
              "AJAX = 异步 JavaScript 和 XML（Asynchronous JavaScript and XML）",
              "简短地说，在不重载整个网页的情况下，AJAX 通过后台加载数据，并在网页上进行显示",
              "使用 AJAX 的应用程序案例：谷歌地图、腾讯微博、优酷视频、人人网等等",
              "您可以在我们的 jQuery Ajax 参考手册学会 jQuery Ajax 的具体应用",
              "您可以在我们的 AJAX 教程中学到更多有关 AJAX 的知识",
              "jQuery 提供多个与 AJAX 有关的方法",
              "通过 jQuery AJAX 方法，您能够使用 HTTP Get 和 HTTP Post 从远程服务器上请求文本、HTML、XML 或 JSON - 同时您能够把这些外部数据直接载入网页的被选元素中",
              "如果没有 jQuery，AJAX 编程还是有些难度的"
            ],
            example: {
              title: "jQuery - AJAX load() 方法 · jQuery load() 方法",
              language: "javascript",
              code: "$(\"button\").click(function(){\n$(\"#div1\").load(\"demo_test.txt\",function(responseTxt,statusTxt,xhr){\nif(statusTxt==\"success\")\nalert(\"外部内容加载成功!\");\nif(statusTxt==\"error\")\nalert(\"Error: \"+xhr.status+\": \"+xhr.statusText);\n});\n});",
              explanation: "jQuery load() 方法是简单但强大的 AJAX 方法"
            },
            practiceSteps: [
              "先通读本节 6 页：jQuery - AJAX 简介、jQuery - AJAX load() 方法、jQuery - AJAX get() 和 post() 方法、jQuery - noConflict() 方法 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 5 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「jQuery DOM 与 CSS 操作」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 5 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-jquery-4",
          title: "jQuery 遍历、AJAX 与插件",
          summary: "jQuery 遍历、AJAX 与插件（jQuery 教程）：事件方法触发器或添加一个函数到被选元素的事件处理程序 本节含 16 页、4 道配套题。",
          concepts: [
            "jQuery 事件 方法",
            "jQuery 事件方法",
            "jQuery 效果 方法",
            "jQuery 效果方法",
            "jQuery HTML / CSS 方法",
            "jQuery 遍历 方法",
            "jQuery 遍历方法",
            "jQuery AJAX 方法",
            "jQuery 杂项方法",
            "jQuery 实用工具"
          ],
          principles: [
            "事件方法触发器或添加一个函数到被选元素的事件处理程序",
            "下面的表格列出了所有用于处理事件的 jQuery 方法",
            "下面的表格列出了所有用于创建动画效果的 jQuery 方法",
            "下面的表格列出了所有用于处理 HTML 和 CSS 的 jQuery 方法",
            "下面的方法适用于 HTML 和 XML 文档",
            "把元素添加到匹配元素的集合中",
            "AJAX 是一种与服务器交换数据的技术，可以在不重新载入整个页面的情况下更新网页的一部分",
            "下面的表格列出了所有的 jQuery AJAX 方法："
          ],
          applications: [
            "示例：＜script src=\"https://lf9-cdn-tos.bytecdntp.com/cdn/expire-1-M/jquery/1.12.3/jqu…",
            "示例：messages: {",
            "示例：$().ready(function() {",
            "示例：ignore: \".ignore\"",
            "示例：errorPlacement：Callback",
            "示例：input.error { border: 1px solid red; }"
          ],
          pitfalls: [
            "处理包裹在jQuery()中函数同步抛出的错误",
            "所有的捆绑方法默认使用英语作为错误信息，且已翻译成其他 37 种语言",
            "必须输入的字段",
            "必须输入正确格式的电子邮件",
            "必须输入正确格式的网址"
          ],
          method: "按站内顺序读「jQuery 事件 方法 → jQuery 效果 方法 → jQuery HTML / CSS 方法 → jQuery 遍历 方法 → jQuery AJAX 方法 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 4 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「jQuery 事件 方法、jQuery 事件方法、jQuery 效果 方法」的用法，并把 4 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【jQuery 事件 方法】jQuery 事件方法：事件方法触发器或添加一个函数到被选元素的事件处理程序",
              "【jQuery 效果 方法】jQuery 效果方法：下面的表格列出了所有用于创建动画效果的 jQuery 方法",
              "【jQuery HTML / CSS 方法】jQuery HTML / CSS 方法：下面的表格列出了所有用于处理 HTML 和 CSS 的 jQuery 方法",
              "【jQuery 遍历 方法】jQuery 遍历方法：把元素添加到匹配元素的集合中",
              "【jQuery AJAX 方法】jQuery AJAX 方法：AJAX 是一种与服务器交换数据的技术，可以在不重新载入整个页面的情况下更新网页的一部分",
              "【jQuery 杂项方法】jQuery 杂项方法：向被选元素附加数据，或者从被选元素获取数据"
            ],
            mechanism: [
              "事件方法触发器或添加一个函数到被选元素的事件处理程序",
              "下面的表格列出了所有用于处理事件的 jQuery 方法",
              "添加/触发 change 事件",
              "添加/触发 click 事件",
              "添加/触发 double click 事件",
              "向匹配元素的当前或未来的子元素添加处理程序",
              "移除所有通过 live() 方法添加的事件处理程序",
              "添加/触发 error 事件",
              "event.currentTarget",
              "在事件冒泡阶段内的当前 DOM 元素"
            ],
            example: {
              title: "jQuery Validate · 2、将校验规则写到 js 代码中",
              language: "javascript",
              code: "<form class=\"cmxform\" id=\"signupForm\" method=\"get\" action=\"\">\n<fieldset>\n<legend>验证完整的表单</legend>\n<p>\n<label for=\"firstname\">名字</label>\n<input id=\"firstname\" name=\"firstname\" type=\"text\">\n</p>\n<p>\n<label for=\"lastname\">姓氏</label>\n<input id=\"lastname\" name=\"lastname\" type=\"text\">\n</p>\n<p>\n<label for=\"username\">用户名</label>\n<input id=\"username\" name=\"username\" type=\"text\">\n</p>\n<p>\n<label for=\"password\">密码</label>\n<input id=\"password\" name=\"password\" type=\"password\">\n</p>\n<p>\n<label for=\"confirm_password\">验证密码</label>\n<input id=\"confirm_password\" name=\"confirm_password\" type=\"password\">\n</p>\n<p>\n<label for=\"email\">Email</label>\n<input id=\"email\" name=\"email\" type=\"email\">\n</p>\n<p>\n<label for=\"agree\">请同意我们的声明</label>\n<input type=\"checkbox\" class=\"checkbox\" id=\"agree\" name=\"agree\">\n</p>\n<p>\n<label for=\"newsletter\">我乐意接收新信息</label>\n<input type=\"checkbox\" class=\"checkbox\" id=\"newsletter\" name=\"newsletter\">\n</p>\n<fieldset id=\"newsletter_topics\">\n<legend>主题 (至少选择两个) - 注意：如果没有勾选“我乐意接收新信息”以下选项会隐藏，但我们这里作为演示让它可见</legend>\n<label for=\"topic_marketflash\">\n<input type=\"checkbox\" id=\"topic_marketflash\" value=\"marketflash\" name=\"topic\">Marketflash\n</label>\n<label for=\"topic_fuzz\">\n<input type=\"checkbox\" id=\"topic_fuzz\" value=\"fuzz\" name=\"topic\">Latest fuzz\n</label>\n<label for=\"topic_digester\">\n<input type=\"checkbox\" id=\"topic_digester\" value=\"digester\" name=\"topic\">Mailing list digester\n</label>\n<label for=\"topic\" class=\"error\">Please select at least two topics you'd like to receive.</label>\n</fieldset>\n<p>\n<input class=\"submit\" type=\"submit\" value=\"提交\">\n</p>\n</fieldset>\n</form>",
              explanation: "messages 处，如果某个控件没有 message，将调用默认的信息"
            },
            practiceSteps: [
              "先通读本节 16 页：jQuery 事件 方法、jQuery 效果 方法、jQuery HTML / CSS 方法、jQuery 遍历 方法 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 4 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「jQuery 遍历、AJAX 与插件」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 4 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-jquery-1",
        "rn-jquery-2",
        "rn-jquery-6",
        "rn-jquery-10",
        "rn-jquery-11",
        "rn-jquery-16",
        "rn-jquery-4",
        "rn-jquery-12",
        "rn-jquery-13",
        "rn-jquery-14",
        "rn-jquery-15",
        "rn-jquery-3",
        "rn-jquery-5",
        "rn-jquery-7",
        "rn-jquery-8",
        "rn-jquery-9",
        "rn-jquery-17",
        "rn-jquery-18",
        "rn-jquery-19",
        "rn-jquery-20"
      ],
      lesson: {
        overview: [
          "《jQuery 教程》取自菜鸟教程，共 47 页，整理为 4 个知识点、20 道配套测验题。",
          "知识点顺序保持站内阅读顺序：jQuery 入门、选择器与事件 → jQuery 效果与动画 → jQuery DOM 与 CSS 操作 → jQuery 遍历、AJAX 与插件。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 20 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 jQuery 入门、选择器与事件 并跑通示例",
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
        completionCriteria: ["《jQuery 教程》4 个知识点全部读完。", "配套 20 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    },
    {
      key: "rn-typescript-stage",
      title: "TypeScript 教程",
      weeks: "第 1 阶段",
      goal: "把「TypeScript 教程」的 72 页内容按 6 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出TypeScript 教程的典型用法，并把 26 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-typescript-1",
          title: "TypeScript 入门、环境与配置",
          summary: "TypeScript 入门、环境与配置（TypeScript 教程）：TypeScript 是 JavaScript 的一个超集，支持 ECMAScript 6 标准（ES6 教程） 本节含 6 页、4 道配套题。",
          concepts: [
            "TypeScript 教程",
            "为什么选择 TypeScript",
            "TypeScript 的主要优势",
            "TypeScript 工作原理",
            "语言特性",
            "核心增强能力（TypeScript 独有）",
            "来自 ES2015 的语法支持（向下兼容）",
            "第一个 TypeScript 实例",
            "TypeScript 安装",
            "NPM 安装 TypeScript"
          ],
          principles: [
            "TypeScript 是 JavaScript 的一个超集，支持 ECMAScript 6 标准（ES6 教程）",
            "TypeScript 由微软开发的自由和开源的编程语言，在 JavaScript 的基础上增加了静态类型检查的超集",
            "TypeScript 是由 Microsoft 开发的开源编程语言，它是 JavaScript 的超集",
            "TypeScript 通过添加可选的静态类型、接口、枚举等特性，大大增强了 JavaScript 的开发体验",
            "静态类型检查：在编译时发现类型错误，减少运行时错误",
            "强大的 IDE 支持：智能代码补全、导航和重构",
            "TypeScript 不能直接在浏览器中运行，它需要先编译为 JavaScript",
            "这个编译过程会检查类型错误，并将 TypeScript 特有的语法转换为纯 JavaScript"
          ],
          applications: [
            "示例：const hello : string = \"Hello World!\"",
            "示例：npm config set registry https://registry.npmmirror.com",
            "示例：// JavaScript：运行时才会报错",
            "示例：// 基础类型：number、string、boolean、null、undefined、symbol、bigint",
            "示例：// 定义接口：描述用户对象的结构",
            "示例：// 联合类型：变量可以是多种类型之一"
          ],
          pitfalls: [
            "静态类型检查：在编译时发现类型错误，减少运行时错误",
            "TypeScript 不能直接在浏览器中运行，它需要先编译为 JavaScript",
            "这个编译过程会检查类型错误，并将 TypeScript 特有的语法转换为纯 JavaScript",
            "TypeScript 编译器 (tsc) 在编译过程中进行类型检查，如果发现类型错误会报错并阻止编译",
            "在开发阶段发现类型错误，提高代码可靠性"
          ],
          method: "按站内顺序读「TypeScript 教程 → TypeScript 安装 → TypeScript 简介 → 使用 VS Code 开发 TypeScript → TypeScript 特性 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 4 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「TypeScript 教程、为什么选择 TypeScript、TypeScript 的主要优势」的用法，并把 4 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【TypeScript 教程】TypeScript 教程：TypeScript 是 JavaScript 的一个超集，支持 ECMAScript 6 标准（ES6 教程）",
              "【TypeScript 教程】为什么选择 TypeScript：TypeScript 是由 Microsoft 开发的开源编程语言，它是 JavaScript 的超集",
              "【TypeScript 教程】TypeScript 的主要优势：静态类型检查：在编译时发现类型错误，减少运行时错误",
              "【TypeScript 教程】TypeScript 工作原理：TypeScript 不能直接在浏览器中运行，它需要先编译为 JavaScript",
              "【TypeScript 教程】语言特性：TypeScript 是对 JavaScript 的类型增强扩展，在保持原有语法兼容的基础上，引入了更强的类型系统和工程能力",
              "【TypeScript 教程】核心增强能力（TypeScript 独有）：类型批注 & 编译时检查"
            ],
            mechanism: [
              "TypeScript 是 JavaScript 的一个超集，支持 ECMAScript 6 标准（ES6 教程）",
              "TypeScript 由微软开发的自由和开源的编程语言，在 JavaScript 的基础上增加了静态类型检查的超集",
              "TypeScript 设计目标是开发大型应用，它可以编译成纯 JavaScript，编译出来的 JavaScript 可以运行在任何浏览器上",
              "TypeScript 是由 Microsoft 开发的开源编程语言，它是 JavaScript 的超集",
              "TypeScript 通过添加可选的静态类型、接口、枚举等特性，大大增强了 JavaScript 的开发体验",
              "静态类型检查：在编译时发现类型错误，减少运行时错误",
              "强大的 IDE 支持：智能代码补全、导航和重构",
              "更好的代码可读性：类型本身就是最好的文档",
              "现代 JavaScript 特性：支持 ES6+ 语法，如箭头函数、模块、类等",
              "渐进式迁移：可以逐步将现有 JavaScript 项目迁移到 TypeScript"
            ],
            example: {
              title: "TypeScript 简介 · 类与访问修饰符",
              language: "typescript",
              code: "class Animal {\n\nreadonly name: string; // 只读，初始化后不能修改\n\nprivate age: number; // 私有，只能在类内部访问\n\nprotected species: string; // 受保护，子类可访问\n\nconstructor(name: string, age: number, species: string) {\n\nthis.name = name;\n\nthis.age = age;\n\nthis.species = species;\n\n}\n\n// public 方法（默认即为 public，可省略）\n\npublic introduce(): string {\n\nreturn `I'm ${this.name}, a ${this.species}.`;\n\n}\n\n// getter：像访问属性一样调用方法\n\nget info(): string {\n\nreturn `${this.name} (${this.age} years old)`;\n\n}\n\n}\n\nclass Dog extends Animal {\n\nprivate breed: string;\n\nconstructor(name: string, age: number, breed: string) {\n\nsuper(name, age, \"Canis lupus familiaris\"); // 调用父类构造函数\n\nthis.breed = breed;\n\n}\n\n// 子类可以访问 protected 属性\n\ndescribe(): string {\n\nreturn `${this.name} is a ${this.species}, breed: ${this.breed}`;\n\n}\n\n}\n\nconst dog = new Dog(\"RUNOOB\", 3, \"Labrador\");\n\nconsole.log(dog.introduce()); // 输出：I'm RUNOOB, a Canis lupus familiaris.\n\nconsole.log(dog.info); // 输出：RUNOOB (3 years old)\n\n// console.log(dog.age); // 错误：私有属性无法从外部访问",
              explanation: "TypeScript 完整支持 ES6 的类语法，并新增了 public、private、protected、readonly 四种访问修饰符"
            },
            practiceSteps: [
              "先通读本节 6 页：TypeScript 教程、TypeScript 安装、TypeScript 简介、使用 VS Code 开发 TypeScript 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 4 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「TypeScript 入门、环境与配置」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 4 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-typescript-2",
          title: "TypeScript 基础类型与变量",
          summary: "TypeScript 基础类型与变量（TypeScript 教程）：TypeScript 程序的基本结构可以分为几个部分，每个部分都有特定的作用 本节含 12 页、4 道配套题。",
          concepts: [
            "TypeScript 基本结构",
            "1. 声明部分（Declarations）",
            "4. 类声明（Class Declarations）",
            "7. 类型断言（Type Assertions）",
            "8. 泛型（Generics）",
            "9. 注释（Comments）",
            "10. 类型推断（Type Inference）",
            "11. 类型守卫（Type Guards）",
            "13. 错误处理（Error Handling）",
            "核心区别"
          ],
          principles: [
            "TypeScript 程序的基本结构可以分为几个部分，每个部分都有特定的作用",
            "以下是 TypeScript 程序的常见组成部分：",
            "类型声明：TypeScript 是一种静态类型的语言，可以通过类型声明来定义变量、函数、类等的类型",
            "类型声明可以帮助代码更具可维护性和可读性",
            "在 TypeScript 中，可以使用 let, const, 和 var 来声明变量",
            "推荐使用 let 和 const，var 用法不再推荐",
            "函数声明：TypeScript 允许声明带有类型注解的函数，包括参数类型和返回值类型",
            "箭头函数：TypeScript 同样支持 ES6 的箭头函数，使用简洁的语法来声明函数"
          ],
          applications: [
            "示例：let name: string = \"Alice\";",
            "示例：let age: number = 25;",
            "示例：function greet(name: string): string {",
            "示例：class Person {",
            "示例：interface Animal {",
            "示例：export class Person {"
          ],
          pitfalls: [
            "错误处理：通过 try/catch 进行错误捕捉",
            "TypeScript 允许使用 try/catch 块进行错误处理，还可以使用类型来描述错误的类型",
            "修改函数签名时，调用处会显示错误",
            "编译时错误检测，提前发现 bug",
            "注意：TypeScript 和 JavaScript 没有整数类型"
          ],
          method: "按站内顺序读「TypeScript 基本结构 → TypeScript vs JavaScript 对比 → TypeScript tsconfig.json 配置 → TypeScript 编译选项 → TypeScript 基础类型 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 4 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「TypeScript 基本结构、1. 声明部分（Declarations）、4. 类声明（Class Declarations）」的用法，并把 4 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【TypeScript 基本结构】TypeScript 基本结构：TypeScript 程序的基本结构可以分为几个部分，每个部分都有特定的作用",
              "【TypeScript 基本结构】1. 声明部分（Declarations）：类型声明：TypeScript 是一种静态类型的语言，可以通过类型声明来定义变量、函数、类等的类型",
              "【TypeScript 基本结构】2. 变量声明（Variable Declarations）：在 TypeScript 中，可以使用 let, const, 和 var 来声明变量",
              "【TypeScript 基本结构】3. 函数声明（Function Declarations）：函数声明：TypeScript 允许声明带有类型注解的函数，包括参数类型和返回值类型",
              "【TypeScript 基本结构】4. 类声明（Class Declarations）：TypeScript 提供对面向对象编程的支持，允许定义类和类的方法、属性",
              "【TypeScript 基本结构】5. 接口与类型别名（Interfaces & Type Aliases）：接口（Interface）：用于描述对象的形状，接口可以继承和扩展"
            ],
            mechanism: [
              "TypeScript 程序的基本结构可以分为几个部分，每个部分都有特定的作用",
              "以下是 TypeScript 程序的常见组成部分：",
              "声明部分：包括类型声明、接口声明等",
              "变量声明：包括 let, const 和 var 的使用",
              "函数声明：包括普通函数和箭头函数",
              "接口与类型别名：描述类型的结构",
              "模块化：通过 import 和 export 组织代码",
              "泛型：使代码具备更多的复用性",
              "异步编程：支持 async/await",
              "错误处理：通过 try/catch 进行错误捕捉"
            ],
            example: {
              title: "TypeScript 基础类型 · 实例",
              language: "typescript",
              code: "// 定义枚举类型，用于表示用户的角色\n\nenum Role {\n\nAdmin,\n\nUser,\n\nGuest,\n\n}\n\n// 使用 interface 定义用户的结构\n\ninterface User {\n\nid: number; // number 类型，用于唯一标识用户\n\nusername: string; // string 类型，表示用户名\n\nisActive: boolean; // boolean 类型，表示用户是否激活\n\nrole: Role; // enum 类型，用于表示用户角色\n\nhobbies: string[]; // array 类型，存储用户的兴趣爱好\n\ncontactInfo: [string, number]; // tuple 类型，包含电话号码的元组，格式为：[区域码, 电话号码]\n\n}\n\n// 创建用户对象，符合 User 接口的结构\n\nconst user: User = {\n\nid: 1,\n\nusername: \"Alice\",\n\nisActive: true,\n\nrole: Role.User,\n\nhobbies: [\"Reading\", \"Gaming\"],\n\ncontactInfo: [\"+1\", 123456789],\n\n};\n\n// 定义一个返回字符串的函数来获取用户信息\n\nfunction getUserInfo(user: User): string {\n\nreturn `User ${user.username} is ${user.isActive ? \"active\" : \"inactive\"} with role ${Role[user.role]}`;\n\n}\n\n// 使用 void 类型定义一个函数，专门打印用户信息\n\nfunction printUserInfo(user: User): void {\n\nconsole.log(getUserInfo(user));\n\n}\n\n// 定义一个 union 类型的函数参数，接受用户 ID（number）或用户名（string）\n\nfunction findUser(query: number | string): User | undefined {\n\n// 使用 typeof 来判断 query 的类型\n\nif (typeof query === \"number\") {\n\n// 如果是数字，则根据 ID 查找用户\n\nreturn query === user.id ? user : undefined;\n\n} else if (typeof query === \"string\") {\n\n// 如果是字符串，则根据用户名查找用户\n\nreturn query === user.username ? user : undefined;\n\n}\n\nreturn undefined;\n\n}\n\n// 定义一个 never 类型的函数，用于处理程序的异常情况\n\nfunction throwError(message: string): never {\n\nthrow new Error(message);\n\n}\n\n// 使用 any 类型处理未知类型的数据\n\nlet unknownData: any = \"This is a string\";\n\nunknownData = 42; // 重新赋值为数字，类型为 any\n\n// 使用 unknown 类型处理不确定的数据，更加安全\n\nlet someData: unknown = \"Possible data\";\n\nif (typeof someData === \"string\") {\n\nconsole.log(`Length of data: ${(someData as string).lengt",
              explanation: "以下实例展示了 TypeScript 中主要基础类型的定义和使用，模拟一个用户对象和相关的操作函数："
            },
            practiceSteps: [
              "先通读本节 12 页：TypeScript 基本结构、TypeScript vs JavaScript 对比、TypeScript tsconfig.json 配置、TypeScript 编译选项 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 4 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「TypeScript 基础类型与变量」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 4 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-typescript-3",
          title: "TypeScript 函数与异步编程",
          summary: "TypeScript 函数与异步编程（TypeScript 教程）：迭代器和生成器是 JavaScript/TypeScript 中处理集合的重要模式 本节含 14 页、5 道配套题。",
          concepts: [
            "TypeScript 迭代器与生成器",
            "为什么需要迭代器和生成器",
            "可迭代协议",
            "自定义可迭代对象",
            "生成器函数",
            "无限生成器",
            "委托生成器",
            "TypeScript 生成器类型",
            "注意事项",
            "总结"
          ],
          principles: [
            "迭代器和生成器是 JavaScript/TypeScript 中处理集合的重要模式",
            "它们提供了一种统一的遍历数据的方式，让处理大数据流、无限序列等变得更加简单",
            "在处理集合数据时，我们经常需要遍历数组、对象等数据结构",
            "迭代器提供了一种统一的、可自定义的遍历接口，让任何对象都可以被遍历",
            "实现 Symbol.iterator 方法的对象可以被 for...of 循环遍历",
            "说明：数组和字符串都内置实现了 Symbol.iterator 方法，所以可以直接使用 for...of 遍历",
            "让普通对象实现 Symbol.iterator 接口，使其可被遍历",
            "迭代器协议：迭代器必须有一个 next() 方法，返回 { done: boolean, value: any } 格式的对象"
          ],
          applications: [
            "示例：// 数组默认可迭代",
            "示例：// 创建自定义可迭代对象：范围",
            "示例：// 生成器函数：使用 function* 语法",
            "示例：// 无限数字生成器",
            "示例：// 第一个生成器",
            "示例：// 生成器类型：Generator<yield类型, return类型, next参数类型>"
          ],
          pitfalls: [
            "迭代器协议：迭代器必须有一个 next() 方法，返回 { done: boolean, value: any } 格式的对象",
            "使用 try/catch 处理异步错误",
            "更好的错误堆栈",
            "错误处理：try/catch",
            "注意：如果任何一个 Promise 失败，Promise.all 会立即 rejection，不会等待其他 Promise 完成"
          ],
          method: "按站内顺序读「TypeScript 迭代器与生成器 → TypeScript async/await 异步编程 → TypeScript Promise 详解 → TypeScript String（字符串） → TypeScript Number → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 5 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「TypeScript 迭代器与生成器、为什么需要迭代器和生成器、可迭代协议」的用法，并把 5 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【TypeScript 迭代器与生成器】TypeScript 迭代器与生成器：迭代器和生成器是 JavaScript/TypeScript 中处理集合的重要模式",
              "【TypeScript 迭代器与生成器】为什么需要迭代器和生成器：在处理集合数据时，我们经常需要遍历数组、对象等数据结构",
              "【TypeScript 迭代器与生成器】可迭代协议：实现 Symbol.iterator 方法的对象可以被 for...of 循环遍历",
              "【TypeScript 迭代器与生成器】自定义可迭代对象：让普通对象实现 Symbol.iterator 接口，使其可被遍历",
              "【TypeScript 迭代器与生成器】生成器函数：使用 function* 语法创建生成器，使用 yield 暂停执行并返回值",
              "【TypeScript 迭代器与生成器】无限生成器：生成器可以产生无限序列，由于是惰性求值，不会占用无限内存"
            ],
            mechanism: [
              "迭代器和生成器是 JavaScript/TypeScript 中处理集合的重要模式",
              "它们提供了一种统一的遍历数据的方式，让处理大数据流、无限序列等变得更加简单",
              "在处理集合数据时，我们经常需要遍历数组、对象等数据结构",
              "迭代器提供了一种统一的、可自定义的遍历接口，让任何对象都可以被遍历",
              "生成器是创建迭代器的简洁方式，它允许你使用函数来暂停和恢复执行，非常适合处理大数据流或无限序列",
              "概念说明：迭代器是一个对象，它提供 next() 方法用于遍历数据",
              "生成器是一种特殊的函数，可以在执行过程中暂停并返回一个值",
              "实现 Symbol.iterator 方法的对象可以被 for...of 循环遍历",
              "说明：数组和字符串都内置实现了 Symbol.iterator 方法，所以可以直接使用 for...of 遍历",
              "让普通对象实现 Symbol.iterator 接口，使其可被遍历"
            ],
            example: {
              title: "TypeScript 特殊类型：never、void、unknown、any · 实际应用：Exhaustive Ch…",
              language: "typescript",
              code: "// 定义形状的联合类型\n\ntype Shape = { kind: \"circle\", radius: number }\n\n| { kind: \"square\", side: number };\n\n// 计算形状面积\n\nfunction area(shape: Shape): number {\n\nswitch (shape.kind) {\n\ncase \"circle\":\n\nreturn Math.PI * shape.radius ** 2;\n\ncase \"square\":\n\nreturn shape.side ** 2;\n\ndefault:\n\n// default 分支应该处理所有未预料到的情况\n\n// 如果添加新的 Shape 类型但忘记处理，编译器会报错\n\nvar _exhaustive: never = shape;\n\nreturn _exhaustive;\n\n}\n\n}\n\nvar circle = { kind: \"circle\" as const, radius: 5 };\n\nvar square = { kind: \"square\" as const, side: 4 };\n\nconsole.log(\"圆形面积: \" + area(circle).toFixed(2));\n\nconsole.log(\"正方形面积: \" + area(square));",
              explanation: "never 类型的一个重要用途是进行穷举检查，确保所有可能的情况都被处理"
            },
            practiceSteps: [
              "先通读本节 14 页：TypeScript 迭代器与生成器、TypeScript async/await 异步编程、TypeScript Promise 详解、TypeScript String（字符串） 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 5 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「TypeScript 函数与异步编程」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 5 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-typescript-4",
          title: "TypeScript 对象、类与接口",
          summary: "TypeScript 对象、类与接口（TypeScript 教程）：类是面向对象编程（OOP）的核心概念，它是一种模板或蓝图，用于创建具有相同属性和方法的对象 本节含 21 页、5 道配套题。",
          concepts: [
            "TypeScript 类",
            "类的定义",
            "语法格式",
            "实例：创建简单的类",
            "类的字段和构造函数",
            "访问控制修饰符",
            "public（默认）",
            "private（私有）",
            "protected（受保护）",
            "类的继承"
          ],
          principles: [
            "类是面向对象编程（OOP）的核心概念，它是一种模板或蓝图，用于创建具有相同属性和方法的对象",
            "TypeScript 完全支持面向对象编程，提供了类、继承、访问修饰符等特性",
            "TypeScript 使用 class 关键字定义类",
            "一个类可以包含以下成员：",
            "编译后的 JavaScript：",
            "类的字段是存储对象数据的地方，构造函数在对象创建时自动调用，用于初始化字段",
            "this 关键字指向当前类的实例",
            "TypeScript 提供了三种访问修饰符来控制类成员的可访问性："
          ],
          applications: [
            "示例：class class_name {",
            "示例：// 定义一个空的 Person 类",
            "示例：// 定义 Car 类",
            "示例：class Person {",
            "示例：class child_class extends parent_class {",
            "示例：// 父类：形状"
          ],
          pitfalls: [
            "注意：TypeScript 的类在编译后会转换为 JavaScript 的构造函数原型模式，接口不会出现在编译结果中",
            "抽象类不能被实例化，只能作为基类供子类继承",
            "抽象类可以包含抽象方法（没有实现的占位方法），子类必须实现这些方法",
            "抽象类：使用 abstract 关键字，不能实例化，作为基类",
            "类型安全：在编译时进行类型检查，避免在运行时出现类型错误"
          ],
          method: "按站内顺序读「TypeScript 元组我们知道数组中元素的数据类型都一般是相同的（any[… → TypeScript 联合类型联合类型（Union Types）可以通过管道(… → TypeScript 类 → TypeScript 接口接口是一系列抽象方法的声明，是一些方法特征的集合，这… → TypeScript 泛型 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 5 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「TypeScript 类、类的定义、语法格式」的用法，并把 5 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【TypeScript 类】TypeScript 类：类是面向对象编程（OOP）的核心概念，它是一种模板或蓝图，用于创建具有相同属性和方法的对象",
              "【TypeScript 类】类的定义：TypeScript 使用 class 关键字定义类",
              "【TypeScript 类】实例：创建简单的类：编译后的 JavaScript：",
              "【TypeScript 类】类的字段和构造函数：类的字段是存储对象数据的地方，构造函数在对象创建时自动调用，用于初始化字段",
              "【TypeScript 类】访问控制修饰符：TypeScript 提供了三种访问修饰符来控制类成员的可访问性：",
              "【TypeScript 类】public（默认）：实例"
            ],
            mechanism: [
              "类是面向对象编程（OOP）的核心概念，它是一种模板或蓝图，用于创建具有相同属性和方法的对象",
              "TypeScript 完全支持面向对象编程，提供了类、继承、访问修饰符等特性",
              "类封装了数据（属性）和行为（方法），使得代码更加模块化、可复用和易维护",
              "TypeScript 使用 class 关键字定义类",
              "字段（Field）：类中声明的变量，表示对象的属性",
              "构造函数（Constructor）：类实例化时调用的特殊方法，用于初始化对象",
              "方法（Method）：类中定义的函数，表示对象的行为",
              "编译后的 JavaScript：",
              "类的字段是存储对象数据的地方，构造函数在对象创建时自动调用，用于初始化字段",
              "this 关键字指向当前类的实例"
            ],
            example: {
              title: "TypeScript 类 · 综合实例",
              language: "typescript",
              code: "// 接口定义\n\ninterface I Printable {\n\nprint(): void;\n\n}\n\n// 抽象类\n\nabstract class Item {\n\nprotected name: string;\n\nprotected price: number;\n\nconstructor(name: string, price: number) {\n\nthis.name = name;\n\nthis.price = price;\n\n}\n\nabstract getDetails(): string;\n\n}\n\n// 具体类\n\nclass Product extends Item implements I Printable {\n\nprivate category: string;\n\nconstructor(name: string, price: number, category: string) {\n\nsuper(name, price);\n\nthis.category = category;\n\n}\n\n// 实现抽象方法\n\ngetDetails(): string {\n\nreturn `产品: ${this.name}, 价格: ¥${this.price}, 类别: ${this.category}`;\n\n}\n\n// 实现接口方法\n\nprint(): void {\n\nconsole.log(this.getDetails());\n\n}\n\n// 静态方法\n\nstatic create(name: string, price: number): Product {\n\nreturn new Product(name, price, \"默认类别\");\n\n}\n\n}\n\n// 使用\n\nvar product = Product.create(\"笔记本电脑\", 5999);\n\nproduct.print();\n\n// 折扣方法\n\nclass DiscountedProduct extends Product {\n\nprivate discount: number;\n\nconstructor(name: string, price: number, category: string, discount: number) {\n\nsuper(name, price, category);\n\nthis.discount = discount;\n\n}\n\ngetDetails(): string {\n\nvar discountedPrice = this.price * (1 - this.discount / 100);\n\nreturn `产品: ${this.name}, 原价: ¥${this.price}, 折扣: ${this.discount}%, 现价: ¥${discountedPrice.toFixed(2)}`;\n\n}\n\n}\n\nvar discountedProduct = new DiscountedProduct(\"手机\", 2999, \"电子产品\", 20);\n\ndiscountedProduct.print();",
              explanation: "综合运用类的各种特性："
            },
            practiceSteps: [
              "先通读本节 21 页：TypeScript 元组我们知道数组中元素的数据类型都一般是相同的（any[…、TypeScript 联合类型联合类型（Union Types）可以通过管道(…、TypeScript 类、TypeScript 接口接口是一系列抽象方法的声明，是一些方法特征的集合，这… 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 5 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「TypeScript 对象、类与接口」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 5 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-typescript-5",
          title: "TypeScript 泛型与高级类型",
          summary: "TypeScript 泛型与高级类型（TypeScript 教程）：TypeScript 支持面向对象编程的继承和多态特性 本节含 7 页、5 道配套题。",
          concepts: [
            "TypeScript 类继承与多态",
            "类的继承",
            "super 关键字",
            "多态",
            "instanceof 检查",
            "protected 成员",
            "总结",
            "TypeScript 错误处理",
            "为什么需要良好的错误处理",
            "自定义错误类型"
          ],
          principles: [
            "TypeScript 支持面向对象编程的继承和多态特性",
            "使用 extends 关键字实现继承",
            "super 用于调用父类的方法和构造函数",
            "子类的实例可以赋值给父类类型",
            "使用 instanceof 检查实例类型",
            "protected 成员在子类中可见",
            "继承：extends 关键字",
            "错误处理是保证程序健壮性的重要环节"
          ],
          applications: [
            "示例：class Animal {",
            "示例：class Shape {",
            "示例：class Rectangle {",
            "示例：class Person {",
            "示例：// 定义应用程序错误类",
            "示例：// 定义 Result 类型，使用联合类型"
          ],
          pitfalls: [
            "错误处理是保证程序健壮性的重要环节",
            "TypeScript 提供了强大的类型系统，可以帮助开发者更好地处理和预防错误",
            "本文介绍 TypeScript 中常见的错误处理模式和最佳实践",
            "任何程序都可能遇到错误情况，如网络请求失败、文件不存在、用户输入错误等",
            "良好的错误处理可以防止程序崩溃，提供友好的错误提示，并帮助开发者定位问题"
          ],
          method: "按站内顺序读「TypeScript 类继承与多态 → TypeScript 错误处理 → TypeScript 交叉类型 → TypeScript 模板字面量类型 → TypeScript 从 JavaScript 迁移 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 5 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「TypeScript 类继承与多态、类的继承、super 关键字」的用法，并把 5 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【TypeScript 类继承与多态】TypeScript 类继承与多态：TypeScript 支持面向对象编程的继承和多态特性",
              "【TypeScript 类继承与多态】类的继承：使用 extends 关键字实现继承",
              "【TypeScript 类继承与多态】super 关键字：super 用于调用父类的方法和构造函数",
              "【TypeScript 类继承与多态】多态：子类的实例可以赋值给父类类型",
              "【TypeScript 类继承与多态】instanceof 检查：使用 instanceof 检查实例类型",
              "【TypeScript 类继承与多态】protected 成员：protected 成员在子类中可见"
            ],
            mechanism: [
              "TypeScript 支持面向对象编程的继承和多态特性",
              "使用 extends 关键字实现继承",
              "super 用于调用父类的方法和构造函数",
              "子类的实例可以赋值给父类类型",
              "使用 instanceof 检查实例类型",
              "protected 成员在子类中可见",
              "继承：extends 关键字",
              "protected：子类可见",
              "错误处理是保证程序健壮性的重要环节",
              "TypeScript 提供了强大的类型系统，可以帮助开发者更好地处理和预防错误"
            ],
            example: {
              title: "TypeScript 单元测试 · 测试 Service",
              language: "typescript",
              code: "import { UserService } from \"./userService\";\n\ndescribe(\"UserService\", () => {\n\nlet service: UserService;\n\nbeforeEach(() => {\n\nservice = new UserService();\n\n});\n\ndescribe(\"createUser\", () => {\n\nit(\"should create a user with id\", () => {\n\nconst user = service.createUser(\"Alice\");\n\nexpect(user.id).toBe(1);\n\nexpect(user.name).toBe(\"Alice\");\n\n});\n\nit(\"should increment id for each user\", () => {\n\nconst user1 = service.createUser(\"Alice\");\n\nconst user2 = service.createUser(\"Bob\");\n\nexpect(user2.id).toBe(user1.id + 1);\n\n});\n\n});\n\ndescribe(\"getUser\", () => {\n\nit(\"should return user by id\", () => {\n\nconst created = service.createUser(\"Alice\");\n\nconst found = service.getUser(created.id);\n\n// 使用可选链和 toBe\n\nexpect(found?.name).toBe(\"Alice\");\n\n});\n\nit(\"should return undefined for non-existent id\", () => {\n\nconst found = service.getUser(999);\n\nexpect(found).toBeUndefined();\n\n});\n\n});\n\n});",
              explanation: "测试 Service 层的业务逻辑"
            },
            practiceSteps: [
              "先通读本节 7 页：TypeScript 类继承与多态、TypeScript 错误处理、TypeScript 交叉类型、TypeScript 模板字面量类型 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 5 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「TypeScript 泛型与高级类型」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 5 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-typescript-6",
          title: "TypeScript 工程实践与框架集成",
          summary: "TypeScript 工程实践与框架集成（TypeScript 教程）：索引类型和 keyof 是 TypeScript 中操作对象类型的强大工具 本节含 12 页、3 道配套题。",
          concepts: [
            "TypeScript 索引类型与 keyof 关键字",
            "为什么需要索引类型",
            "keyof 操作符",
            "索引访问类型",
            "映射类型基础",
            "约束键的类型",
            "只获取特定类型的属性",
            "遍历数组类型",
            "注意事项",
            "总结"
          ],
          principles: [
            "索引类型和 keyof 是 TypeScript 中操作对象类型的强大工具",
            "它们允许我们动态地访问对象的属性，并创建灵活的类型映射",
            "在 JavaScript 中，我们经常需要动态访问对象的属性",
            "例如，一个函数可能需要获取对象的所有键，或者根据键访问对应的值类型",
            "keyof 操作符用于获取对象类型的所有键组成的联合类型",
            "说明：keyof 返回的是键名的字面量联合类型，而不是字符串类型",
            "使用索引访问类型（Index Access Type）可以获取对象属性的类型",
            "索引访问：使用方括号 [] 可以访问对象类型的具体属性类型，非常强大且灵活"
          ],
          applications: [
            "示例：// 定义用户类型",
            "示例：// 定义配置类型",
            "示例：// 定义混合类型",
            "示例：// 定义元组类型",
            "示例：// 定义树节点类型，children 引用自身",
            "示例：// 定义嵌套列表类型"
          ],
          pitfalls: [
            "约束：K extends keyof T 确保传入的键一定是对象上存在的键，防止运行时错误",
            "递归基例：确保递归类型有终止条件，避免无限递归",
            "协变与逆变规则帮助 TypeScript 捕获这些潜在的类型错误",
            "TypeScript 中数组是协变的，但需要注意可变性带来的问题",
            "数组可变性：协变赋值后修改数组可能导致运行时错误，需要注意"
          ],
          method: "按站内顺序读「TypeScript 索引类型与 keyof 关键字 → TypeScript 递归类型 → TypeScript 协变与逆变 → TypeScript 路径映射 paths → TypeScript 项目引用 References → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「TypeScript 索引类型与 keyof 关键字、为什么需要索引类型、keyof 操作符」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【TypeScript 索引类型与 keyof 关键字】TypeScript 索引类型与 keyof 关键字：索引类型和 keyof 是 TypeScript 中操作对象类型的强大工具",
              "【TypeScript 索引类型与 keyof 关键字】为什么需要索引类型：在 JavaScript 中，我们经常需要动态访问对象的属性",
              "【TypeScript 索引类型与 keyof 关键字】keyof 操作符：keyof 操作符用于获取对象类型的所有键组成的联合类型",
              "【TypeScript 索引类型与 keyof 关键字】索引访问类型：使用索引访问类型（Index Access Type）可以获取对象属性的类型",
              "【TypeScript 索引类型与 keyof 关键字】映射类型基础：映射类型允许基于现有类型创建新类型，遍历其所有键",
              "【TypeScript 索引类型与 keyof 关键字】约束键的类型：使用 keyof 和泛型约束来限制函数接受的键"
            ],
            mechanism: [
              "索引类型和 keyof 是 TypeScript 中操作对象类型的强大工具",
              "它们允许我们动态地访问对象的属性，并创建灵活的类型映射",
              "在 JavaScript 中，我们经常需要动态访问对象的属性",
              "例如，一个函数可能需要获取对象的所有键，或者根据键访问对应的值类型",
              "索引类型和 keyof 让我们能够在类型系统中表达这种动态性，同时保持类型安全",
              "概念：索引类型是一类允许动态访问对象属性的类型，keyof 用于获取对象类型的所有键组成的联合类型",
              "keyof 操作符用于获取对象类型的所有键组成的联合类型",
              "说明：keyof 返回的是键名的字面量联合类型，而不是字符串类型",
              "使用索引访问类型（Index Access Type）可以获取对象属性的类型",
              "索引访问：使用方括号 [] 可以访问对象类型的具体属性类型，非常强大且灵活"
            ],
            example: {
              title: "TypeScript 综合项目实战 · 自定义 Hook",
              language: "typescript",
              code: "// 导入 React Hooks 和类型\n\nimport { useState, useEffect, useCallback } from \"react\";\n\nimport {\n\nTask,\n\nCreateTaskInput,\n\nUpdateTaskInput,\n\nTaskFilter,\n\nTaskStatus,\n\nTaskPriority\n\n} from \"../types/task\";\n\nimport { taskService } from \"../services/taskService\";\n\n// Hook 返回的状态类型\n\ninterface UseTasksReturn {\n\ntasks: Task[];\n\nloading: boolean;\n\nerror: string | null;\n\nfilter: TaskFilter;\n\n// 操作方法\n\ncreateTask: (input: CreateTaskInput) => Promise<void>;\n\nupdateTask: (id: string, input: UpdateTaskInput) => Promise<void>;\n\ndeleteTask: (id: string) => Promise<void>;\n\nupdateStatus: (id: string, status: TaskStatus) => Promise<void>;\n\nsetFilter: (filter: TaskFilter) => void;\n\nrefresh: () => void;\n\n}\n\n// 初始化默认过滤器\n\nconst defaultFilter: TaskFilter = {};\n\nexport function useTasks(): UseTasksReturn {\n\n// 任务列表状态\n\nconst [tasks, setTasks] = useState<Task[]>([]);\n\n// 加载状态\n\nconst [loading, setLoading] = useState(true);\n\n// 错误状态\n\nconst [error, setError] = useState<string | null>(null);\n\n// 过滤条件\n\nconst [filter, setFilter] = useState<TaskFilter>(defaultFilter);\n\n// 加载任务列表\n\nconst loadTasks = useCallback(() => {\n\nsetLoading(true);\n\nsetError(null);\n\ntry {\n\nconst data = taskService.getAll(filter);\n\nsetTasks(data);\n\n} catch (err) {\n\nsetError(err instanceof Error ? err.message : \"加载失败\");\n\n} finally {\n\nsetLoading(false);\n\n}\n\n}, [filter]);\n\n// 初始加载和过滤器变化时重新加载\n\nuseEffect(() => {\n\nloadTasks();\n\n}, [loadTasks]);\n\n// 创建任务\n\nconst createTask = useCallback(async (input: CreateTaskInput) => {\n\ntry {\n\ntaskService.create(input);\n\nloadTasks();\n\n} catch (err) {\n\nsetError(err instanceof Error ? err.message : \"创建失败\");\n\n}\n\n}, [l",
              explanation: "使用 Hook 管理任务状态"
            },
            practiceSteps: [
              "先通读本节 12 页：TypeScript 索引类型与 keyof 关键字、TypeScript 递归类型、TypeScript 协变与逆变、TypeScript 路径映射 paths 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「TypeScript 工程实践与框架集成」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-ts-4",
        "rn-ts-10",
        "rn-ts-12",
        "rn-ts-25",
        "rn-ts-2",
        "rn-ts-11",
        "rn-ts-17",
        "rn-ts-23",
        "rn-ts-7",
        "rn-ts-16",
        "rn-ts-22",
        "rn-ts-24",
        "rn-ts-26",
        "rn-ts-1",
        "rn-ts-15",
        "rn-ts-18",
        "rn-ts-19",
        "rn-ts-20",
        "rn-ts-3",
        "rn-ts-5",
        "rn-ts-8",
        "rn-ts-13",
        "rn-ts-14",
        "rn-ts-6",
        "rn-ts-9",
        "rn-ts-21"
      ],
      lesson: {
        overview: [
          "《TypeScript 教程》取自菜鸟教程，共 72 页，整理为 6 个知识点、26 道配套测验题。",
          "知识点顺序保持站内阅读顺序：TypeScript 入门、环境与配置 → TypeScript 基础类型与变量 → TypeScript 函数与异步编程 → TypeScript 对象、类与接口 → TypeScript 泛型与高级类型 → TypeScript 工程实践与框架集成。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 26 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 TypeScript 入门、环境与配置 并跑通示例",
            evidence: "本地示例输出与站点示例一致"
          },
          {
            title: "完成全部配套测验",
            evidence: "题正确率 ≥ 80%（共 26 道）"
          },
          {
            title: "能独立复述全部知识点",
            evidence: "不看文档说出每个知识点的用法与易错点"
          }
        ],
        completionCriteria: ["《TypeScript 教程》6 个知识点全部读完。", "配套 26 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    },
    {
      key: "rn-vue3-stage",
      title: "Vue 3 教程",
      weeks: "第 1 阶段",
      goal: "把「Vue 3 教程」的 57 页内容按 5 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出Vue 3 教程的典型用法，并把 20 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-vue3-1",
          title: "Vue3 入门、环境与项目结构",
          summary: "Vue3 入门、环境与项目结构（Vue 3 教程）：Vue.js（读音 /vjuː/, 类似于 view）是一套构建用户界面的渐进式框架 本节含 7 页、5 道配套题。",
          concepts: [
            "Vue3 教程",
            "渐进式框架‌",
            "阅读本教程前，您需要了解的知识：",
            "第一个实例",
            "Vue.js 的特点和优势",
            "参考资料：",
            "Vue3 简介",
            "Vue3 与 Vue2 的本质区别",
            "核心特性",
            "组合式 API（Composition API）"
          ],
          principles: [
            "Vue.js（读音 /vjuː/, 类似于 view）是一套构建用户界面的渐进式框架",
            "Vue 只关注视图层，采用自底向上增量开发的设计",
            "‌渐进式框架‌是指那些允许开发者根据项目需求逐步引入和使用其功能的框架，而不需要一次性全部使用框架的特性",
            "常见的渐进式框架‌有：Vue、React、Angular 等",
            "本教程主要介绍了 Vue3.x 版本的使用",
            "响应式数据绑定：Vue.js 提供强大的响应式数据绑定系统，确保数据的变化能够自动反映到视图层，减少了开发者手动操作 DOM 的需要",
            "组件化：Vue.js 提倡将应用分解为小的、可复用的组件，增强了代码的组织性、可维护性和重用性",
            "官方网站：https://cn.vuejs.org/"
          ],
          applications: [
            "示例：<div id=\"hello-vue\" class=\"demo\">",
            "示例：<!-- Options API 写法（Vue2 / Vue3 均支持） -->",
            "示例：import { ref, reactive, watch } from 'vue'",
            "示例：// 文件路径：composables/useCounter.js",
            "示例：＜script setup＞",
            "示例：// Vue2：所有 API 通过全局对象 Vue 访问，无法 tree-shake"
          ],
          pitfalls: [
            "减少技术债务：避免一开始的大规模重构",
            "必须有且只有一个根元素",
            "Vue2 要求组件模板必须有单一根节点，Fragment 允许多个根节点并存（无需额外包裹 div）",
            "两套 API 风格共存，团队需约定统一规范，否则代码风格不一致",
            "注意：Vue.js 不支持 IE8 及其以下 IE 版本"
          ],
          method: "按站内顺序读「Vue3 教程 → Vue3 简介 → Vue3 安装 → Vue3 项目打包 → 使用 VSCode 开发 Vue → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 5 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Vue3 教程、渐进式框架‌、阅读本教程前，您需要了解的知识：」的用法，并把 5 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Vue3 教程】Vue3 教程：Vue.js（读音 /vjuː/, 类似于 view）是一套构建用户界面的渐进式框架",
              "【Vue3 教程】渐进式框架‌：‌渐进式框架‌是指那些允许开发者根据项目需求逐步引入和使用其功能的框架，而不需要一次性全部使用框架的特性",
              "【Vue3 教程】阅读本教程前，您需要了解的知识：：本教程主要介绍了 Vue3.x 版本的使用",
              "【Vue3 教程】第一个实例：Vue 3.0 实例",
              "【Vue3 教程】Vue.js 的特点和优势：响应式数据绑定：Vue.js 提供强大的响应式数据绑定系统，确保数据的变化能够自动反映到视图层，减少了开发者手动操作 DOM 的需要",
              "【Vue3 教程】参考资料：：官方网站：https://cn.vuejs.org/"
            ],
            mechanism: [
              "Vue.js（读音 /vjuː/, 类似于 view）是一套构建用户界面的渐进式框架",
              "Vue 只关注视图层，采用自底向上增量开发的设计",
              "Vue 的目标是通过尽可能简单的 API 实现响应的数据绑定和组合的视图组件",
              "Vue 学习起来非常简单，本教程基于 Vue3 以上版本测试",
              "‌渐进式框架‌是指那些允许开发者根据项目需求逐步引入和使用其功能的框架，而不需要一次性全部使用框架的特性",
              "常见的渐进式框架‌有：Vue、React、Angular 等",
              "易于上手：开发者可以从基础功能开始，逐步学习和使用",
              "灵活性：按需引入框架功能，兼容现有代码",
              "降低学习曲线：分阶段学习，逐步掌握高级特性",
              "提升效率：快速构建原型，逐步扩展功能"
            ],
            example: {
              title: "Vue3 安装 · 3、NPM 方法",
              language: "vue",
              code: "$ npm init vue@latest\nNeed to install the following packages:\ncreate-vue@3.6.1\nOk to proceed? (y) y\n\nVue.js - The Progressive JavaScript Framework\n# 这里需要进行一些配置，项目名输入 runoob-vue3-test，其他默认回车即可\n-> Project name: … runoob-vue3-test\n-> Add TypeScript? … No / Yes\n-> Add JSX Support? … No / Yes\n-> Add Vue Router for Single Page Application development? … No / Yes\n-> Add Pinia for state management? … No / Yes\n-> Add Vitest for Unit Testing? … No / Yes\n-> Add an End-to-End Testing Solution? &rsaquo; No\n-> Add ESLint for code quality? … No / Yes\n\nScaffolding project in /Users/runoob/runoob-test/runoob-vue3/runoob-vue3-test...\n\nDone. Now run:\n\ncd runoob-vue3-test\nnpm install\nnpm run dev",
              explanation: "由于 npm 安装速度慢，本教程使用了淘宝的镜像及其命令 cnpm，安装使用介绍参照：使用淘宝 NPM 镜像"
            },
            practiceSteps: [
              "先通读本节 7 页：Vue3 教程、Vue3 简介、Vue3 安装、Vue3 项目打包 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 5 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Vue3 入门、环境与项目结构」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 5 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-vue3-2",
          title: "Vue3 模板语法与内置指令",
          summary: "Vue3 模板语法与内置指令（Vue 3 教程）：Vite 是一个现代化的前端构建工具，旨在通过利用现代浏览器的原生 ES 模块支持，提供快速的开发体验 本节含 21 页、5 道配套题。",
          concepts: [
            "Vite 教程",
            "传统构建工具的痛点",
            "Vite 的工作原理",
            "Vite 适用场景",
            "创建 Vite 项目",
            "启动开发服务器",
            "修改代码并查看效果",
            "Vite 启动流程",
            "文件调用顺序（以典型 Vue3 项目为例）",
            "关键点"
          ],
          principles: [
            "Vite 是一个现代化的前端构建工具，旨在通过利用现代浏览器的原生 ES 模块支持，提供快速的开发体验",
            "Vite 由两部分组成：",
            "在 Vite 出现之前，前端开发通常使用 Webpack 等构建工具，这些工具虽然功能强大，但也存在一些痛点：",
            "启动速度慢：项目越大，启动时间越长，影响开发效率",
            "Vite 的工作原理可以分为开发模式和生产模式：",
            "Vite 启动一个开发服务器，利用浏览器原生支持 ES 模块的特性，直接加载源代码",
            "Vite 适用于各种项目，尤其适合：",
            "单页应用 (SPA)：如 Vue、React 项目"
          ],
          applications: [
            "示例：npm create vite@latest",
            "示例：cd runoob-vite-test",
            "示例：\"scripts\": {",
            "示例：npm run dev",
            "示例：npm install -D sass",
            "示例：npm install -D typescript"
          ],
          pitfalls: [
            "然而，有些模板需要依赖更高的 Node 版本才能正常运行，当你的包管理器发出警告时，请注意升级你的 Node 版本",
            "应用实例必须在调用了 .mount() 方法后才会渲染出来，.mount()方法接收一个\"容器\"参数，可以是一个实际的 DOM 元素或是一个 CSS 选择器字符串：",
            "通过绑定数据，Vue 可以自动更新 DOM 元素的内容，避免了传统的手动 DOM 操作",
            "以下实例判断 use 的值，如果为 true 使用 class1 类的样式，否则不使用该类：",
            "因为 v-if 是一个指令，所以必须将它添加到一个元素上"
          ],
          method: "按站内顺序读「Vite 教程 → Vue3 目录结构 → Vue3 起步 → Vue3 基础语法 → Vue3 声明式渲染 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 5 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Vite 教程、传统构建工具的痛点、Vite 的工作原理」的用法，并把 5 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Vite 教程】Vite 教程：Vite 是一个现代化的前端构建工具，旨在通过利用现代浏览器的原生 ES 模块支持，提供快速的开发体验",
              "【Vite 教程】传统构建工具的痛点：在 Vite 出现之前，前端开发通常使用 Webpack 等构建工具，这些工具虽然功能强大，但也存在一些痛点：",
              "【Vite 教程】Vite 的工作原理：Vite 的工作原理可以分为开发模式和生产模式：",
              "【Vite 教程】Vite 适用场景：Vite 适用于各种项目，尤其适合：",
              "【Vite 教程】创建 Vite 项目：Vite 提供了多种方式来创建新项目，最简单的方式是使用命令行工具",
              "【Vite 教程】启动开发服务器：Vite 会启动一个本地开发服务器，并打印出访问地址，例如 http://localhost:5173，端口可以在 vite.config.js 中配置修改"
            ],
            mechanism: [
              "Vite 是一个现代化的前端构建工具，旨在通过利用现代浏览器的原生 ES 模块支持，提供快速的开发体验",
              "开发服务器：基于原生 ES 模块，提供超快的热更新",
              "构建命令：使用 Rollup 打包代码，生成适用于生产环境的优化静态资源",
              "Vite 需要 Node.js 版本 18+ 或 20+",
              "然而，有些模板需要依赖更高的 Node 版本才能正常运行，当你的包管理器发出警告时，请注意升级你的 Node 版本",
              "在 Vite 出现之前，前端开发通常使用 Webpack 等构建工具，这些工具虽然功能强大，但也存在一些痛点：",
              "启动速度慢：项目越大，启动时间越长，影响开发效率",
              "热更新慢：每次修改代码后，都需要重新构建整个项目，导致热更新速度慢",
              "配置复杂： Webpack 等工具配置复杂，学习成本高",
              "Vite 的出现解决了传统构建工具的痛点，具有以下优势："
            ],
            example: {
              title: "Vue3 Ajax(axios) · 请求配置项",
              language: "vue",
              code: "{\n// `url` 是用于请求的服务器 URL\nurl: \"/user\",\n\n// `method` 是创建请求时使用的方法\nmethod: \"get\", // 默认是 get\n\n// `baseURL` 将自动加在 `url` 前面，除非 `url` 是一个绝对 URL。\n// 它可以通过设置一个 `baseURL` 便于为 axios 实例的方法传递相对 URL\nbaseURL: \"https://some-domain.com/api/\",\n\n// `transformRequest` 允许在向服务器发送前，修改请求数据\n// 只能用在 \"PUT\", \"POST\" 和 \"PATCH\" 这几个请求方法\n// 后面数组中的函数必须返回一个字符串，或 ArrayBuffer，或 Stream\ntransformRequest: [function (data) {\n// 对 data 进行任意转换处理\n\nreturn data;\n}],\n\n// `transformResponse` 在传递给 then/catch 前，允许修改响应数据\ntransformResponse: [function (data) {\n// 对 data 进行任意转换处理\n\nreturn data;\n}],\n\n// `headers` 是即将被发送的自定义请求头\nheaders: {\"X-Requested-With\": \"XMLHttpRequest\"},\n\n// `params` 是即将与请求一起发送的 URL 参数\n// 必须是一个无格式对象(plain object)或 URLSearchParams 对象\nparams: {\nID: 12345\n},\n\n// `paramsSerializer` 是一个负责 `params` 序列化的函数\n// (e.g. https://www.npmjs.com/package/qs, http://api.jquery.com/jquery.param/)\nparamsSerializer: function(params) {\nreturn Qs.stringify(params, {arrayFormat: \"brackets\"})\n},\n\n// `data` 是作为请求主体被发送的数据\n// 只适用于这些请求方法 \"PUT\", \"POST\", 和 \"PATCH\"\n// 在没有设置 `transformRequest` 时，必须是以下类型之一：\n// - string, plain object, ArrayBuffer, ArrayBufferView, URLSearchParams\n// - 浏览器专属：FormData, File, Blob\n// - Node 专属： Stream\ndata: {\nfirstName: \"Fred\"\n},\n\n// `timeout` 指定请求超时的毫秒数(0 表示无超时时间)\n// 如果请求花费了超过 `timeout` 的时间，请求将被中断\ntimeout: 1000,\n\n// `withCredentials` 表示跨域请求时是否需要使用凭证\nwithCredentials: false, // 默认的\n\n// `adapter` 允许自定义处理请求，以使测试更轻松\n// 返回一个 promise 并应用一个有效的响应 (查阅 [response docs](#response-api)).\nadapter: function (config) {\n/* ... */\n},\n\n// `auth` 表示应该使用 HTTP 基础验证，并提供凭据\n// 这将设置一个 `Authorization` 头，覆写掉现有的任意使用 `headers` 设置的自定义 `Autho",
              explanation: "下面是创建请求时可用的配置选项，注意只有 url 是必需的"
            },
            practiceSteps: [
              "先通读本节 21 页：Vite 教程、Vue3 目录结构、Vue3 起步、Vue3 基础语法 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 5 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Vue3 模板语法与内置指令」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 5 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-vue3-3",
          title: "Vue3 组件、计算与监听属性",
          summary: "Vue3 组件、计算与监听属性（Vue 3 教程）：在 Vue3 中，状态管理是一个绕不开的话题 本节含 4 页、4 道配套题。",
          concepts: [
            "Pinia 入门教程",
            "安装与配置",
            "安装 Pinia",
            "配置 Pinia",
            "创建第一个 Store",
            "定义 Store",
            "Store 的结构说明",
            "在组件中使用 Store",
            "基本使用",
            "响应式解构"
          ],
          principles: [
            "在 Vue3 中，状态管理是一个绕不开的话题",
            "Pinia 是 Vue.js 的轻量级状态管理库，它让你能够在组件之间共享和管理状态，我们可以把 Pinia 想象成一个全局的数据仓库，所有组件都可以从这里获取数据或者更新数据",
            "用 Vite 创建项目：",
            "首先，在你的 Vue3 项目中安装 Pinia：",
            "在 src/main.js 或 src/main.ts 中配置 Pinia：",
            "Store 就是 Pinia 中的数据仓库，我们来创建一个简单的计数器 Store",
            "新建 src/stores/useCounter.js：",
            "让我们通过一个表格来理解 Store 的各个部分："
          ],
          applications: [
            "示例：npm create vite@latest vue-pinia-demo --template vue",
            "示例：npm install pinia",
            "示例：// main.js",
            "示例：// stores/useCounter.js",
            "示例：<!-- CounterComponent.vue -->",
            "示例：<template>"
          ],
          pitfalls: [
            "稳定的意思是，key 不应该随着数据的变化而变化，否则会影响 Vue 的性能和虚拟 DOM 的复用策略",
            "避免使用索引作为 key，除非你明确知道列表项的顺序不会改变",
            "避免滥用 ref，尽可能通过数据驱动和事件处理来操作 DOM 和子组件，保持代码的可维护性和清晰性",
            "<keep-alive> 是一个抽象组件，用于保持组件状态或避免多次渲染",
            "它可以在异步组件加载完成之前显示占位内容，并处理加载状态和错误"
          ],
          method: "按站内顺序读「Pinia 入门教程 → Vue3 内置属性 → Vue3 内置组件 → Vue 组件实例」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 4 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Pinia 入门教程、安装与配置、安装 Pinia」的用法，并把 4 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Pinia 入门教程】Pinia 入门教程：在 Vue3 中，状态管理是一个绕不开的话题",
              "【Pinia 入门教程】安装与配置：用 Vite 创建项目：",
              "【Pinia 入门教程】安装 Pinia：首先，在你的 Vue3 项目中安装 Pinia：",
              "【Pinia 入门教程】配置 Pinia：在 src/main.js 或 src/main.ts 中配置 Pinia：",
              "【Pinia 入门教程】创建第一个 Store：Store 就是 Pinia 中的数据仓库，我们来创建一个简单的计数器 Store",
              "【Pinia 入门教程】定义 Store：新建 src/stores/useCounter.js："
            ],
            mechanism: [
              "在 Vue3 中，状态管理是一个绕不开的话题",
              "Pinia 是 Vue.js 的轻量级状态管理库，它让你能够在组件之间共享和管理状态，我们可以把 Pinia 想象成一个全局的数据仓库，所有组件都可以从这里获取数据或者更新数据",
              "本章节我们要介绍的是 Vue3 官方推荐的状态管理库 —— Pinia，相比 Vuex，Pinia 提供了更简洁、更符合 Vue3 组合式 API 思维的状态管理方案",
              "Vuex 采用单仓库加多级模块的树状结构，层级固定，依赖 mutations，整体更重",
              "Pinia 则由多个独立 store 组成，扁平、轻量、不分模块，无命名空间负担",
              "支持 Vue2 和 Vue3",
              "完整的 TypeScript 支持",
              "Pinia 的扁平结构让组件可以直接连到任意 store，各取所需，不经过树状模块，也不走命名空间路径，状态流动简单直接，耦合度低",
              "首先，在你的 Vue3 项目中安装 Pinia：",
              "actions：执行逻辑、修改 state"
            ],
            example: {
              title: "Pinia 入门教程 · 实际应用示例：购物车",
              language: "vue",
              code: "// stores/cart.js\n\nexport const useCartStore = defineStore('cart', {\n\nstate: () => ({\n\nitems: [], // { productId, quantity }\n\ndiscount: 0\n\n}),\n\ngetters: {\n\n// 购物车商品总数\n\ntotalItems: (state) => {\n\nreturn state.items.reduce((total, item) => total + item.quantity, 0)\n\n},\n\n// 购物车总金额\n\ntotalPrice: (state) => {\n\nconst productStore = useProductStore()\n\nreturn state.items.reduce((total, item) => {\n\nconst product = productStore.getProductById(item.productId)\n\nreturn total + (product?.price || 0) * item.quantity\n\n}, 0)\n\n},\n\n// 折后总价\n\nfinalPrice: (state) => {\n\nreturn state.totalPrice * (1 - state.discount / 100)\n\n}\n\n},\n\nactions: {\n\n// 添加商品到购物车\n\naddToCart(productId, quantity = 1) {\n\nconst existingItem = this.items.find(item => item.productId === productId)\n\nif (existingItem) {\n\nexistingItem.quantity += quantity\n\n} else {\n\nthis.items.push({ productId, quantity })\n\n}\n\n},\n\n// 从购物车移除商品\n\nremoveFromCart(productId) {\n\nthis.items = this.items.filter(item => item.productId !== productId)\n\n},\n\n// 清空购物车\n\nclearCart() {\n\nthis.items = []\n\nthis.discount = 0\n\n},\n\n// 设置折扣\n\nsetDiscount(percent) {\n\nthis.discount = Math.max(0, Math.min(100, percent))\n\n}\n\n}\n\n})",
              explanation: "让我们创建一个完整的购物车示例："
            },
            practiceSteps: [
              "先通读本节 4 页：Pinia 入门教程、Vue3 内置属性、Vue3 内置组件、Vue 组件实例。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 4 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Vue3 组件、计算与监听属性」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 4 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-vue3-4",
          title: "Vue3 路由、状态管理与组合式 API",
          summary: "Vue3 路由、状态管理与组合式 API（Vue 3 教程）：Vue.js 内置了多个指令（Directives），用于在模板中添加特定的响应式行为或操作 DOM 本节含 9 页、3 道配套题。",
          concepts: [
            "Vue3 内置指令",
            "v-text",
            "v-html",
            "v-model",
            "v-show",
            "v-if / v-else / v-else-if",
            "v-for",
            "v-on (@)",
            "v-bind ( : )",
            "v-slot"
          ],
          principles: [
            "Vue.js 内置了多个指令（Directives），用于在模板中添加特定的响应式行为或操作 DOM",
            "以下是 Vue.js 中常用的内置指令：",
            "用法: <p v-text=\"message\"></p>",
            "说明: 更新元素的 textContent，类似于插值 {{ }}，但是是单向绑定",
            "用法: <div v-html=\"htmlContent\"></div>",
            "说明: 更新元素的 innerHTML，用于输出包含 HTML 结构的内容",
            "用法: <input v-model=\"value\">",
            "说明: 在表单控件元素上创建双向数据绑定，将输入字段与数据属性同步，支持多种表单控件类型"
          ],
          applications: [
            "示例：<p v-text=\"message\"></p>",
            "示例：<div v-html=\"htmlContent\"></div>",
            "示例：<input type=\"text\" v-model=\"message\">",
            "示例：<div v-show=\"isVisible\">Visible when true</div>",
            "示例：<p v-if=\"isVisible\">Visible</p>",
            "示例：<ul>"
          ],
          pitfalls: [
            "在 Vue 实例编译完成前隐藏模板内容，避免显示未编译的 Mustache 标签",
            "需要注意安全性，避免 XSS 攻击",
            "说明: 在 Vue 实例编译完成前隐藏模板内容，避免显示未编译的 Mustache 标签",
            "避免使用箭头函数：定义生命周期钩子时，不要使用箭头函数，因为这会导致无法通过 this 获取组件实例",
            "用法: 可以在这个阶段操作 DOM，但避免在此期间更改数据，因为可能导致无限循环更新"
          ],
          method: "按站内顺序读「Vue3 内置指令 → Vue3 生命周期钩子 → Vue 实例选项 → Vue3 Tailwind CSS → Vue3 全局 API → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「Vue3 内置指令、v-text、v-html」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【Vue3 内置指令】Vue3 内置指令：Vue.js 内置了多个指令（Directives），用于在模板中添加特定的响应式行为或操作 DOM",
              "【Vue3 内置指令】v-text：用法: <p v-text=\"message\"></p>",
              "【Vue3 内置指令】v-html：用法: <div v-html=\"htmlContent\"></div>",
              "【Vue3 内置指令】v-model：用法: <input v-model=\"value\">",
              "【Vue3 内置指令】v-show：用法: <div v-show=\"isVisible\"></div>",
              "【Vue3 内置指令】v-if / v-else / v-else-if：用法: <p v-if=\"isVisible\">Visible</p><p v-else>Not Visible</p>"
            ],
            mechanism: [
              "Vue.js 内置了多个指令（Directives），用于在模板中添加特定的响应式行为或操作 DOM",
              "以下是 Vue.js 中常用的内置指令：",
              "<p v-text=\"message\"></p>",
              "更新元素的 textContent，类似于插值 {{ }}，但是是单向绑定",
              "<div v-html=\"htmlContent\"></div>",
              "更新元素的 innerHTML，用于输出 HTML",
              "<input v-model=\"value\">",
              "在表单控件元素上创建双向数据绑定，将输入字段与数据属性同步",
              "<div v-show=\"isVisible\"></div>",
              "根据表达式的真假切换元素的显示与隐藏，使用 CSS 的 display 属性"
            ],
            example: {
              title: "Vue3 Tailwind CSS · App.vue",
              language: "vue",
              code: "<template>\n\n<div class=\"min-h-screen bg-gray-50 flex items-center justify-center p-6\">\n\n<div class=\"w-full max-w-md bg-white p-8 rounded-xl shadow-lg\">\n\n<h1 class=\"text-2xl font-semibold text-center text-gray-800 mb-6\">\n\nVue 3 + Tailwind CSS 示例\n\n</h1>\n\n<!-- 输入框和按钮 -->\n\n<div class=\"mb-4\">\n\n<label for=\"name\" class=\"block text-sm font-medium text-gray-700\">用户名</label>\n\n<input\n\ntype=\"text\"\n\nid=\"name\"\n\nv-model=\"username\"\n\nplaceholder=\"请输入用户名\"\n\nclass=\"mt-2 w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500\"\n\n/>\n\n</div>\n\n<button\n\n@click=\"submitForm\"\n\nclass=\"w-full bg-blue-500 text-white py-2 rounded-md shadow-md hover:bg-blue-600 transition duration-200\"\n\n>\n\n提交\n\n</button>\n\n<!-- 显示用户名 -->\n\n<p v-if=\"submitted\" class=\"mt-4 text-center text-gray-600\">欢迎, {{ username }}!</p>\n\n</div>\n\n</div>\n\n</template>\n\n＜script＞\n\nexport default {\n\ndata() {\n\nreturn {\n\nusername: '',\n\nsubmitted: false\n\n};\n\n},\n\nmethods: {\n\nsubmitForm() {\n\nif (this.username) {\n\nthis.submitted = true;\n\n} else {\n\nalert('请输入用户名');\n\n}\n\n}\n\n}\n\n};\n\n＜/script＞\n\n＜style scoped＞\n\n/* 这里的样式是自定义的，如果需要的话 */\n\n＜/style＞",
              explanation: "App.vue 是应用的主要组件，它包含了 Vue 3 和 Tailwind CSS 的基础用法"
            },
            practiceSteps: [
              "先通读本节 9 页：Vue3 内置指令、Vue3 生命周期钩子、Vue 实例选项、Vue3 Tailwind CSS 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Vue3 路由、状态管理与组合式 API」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-vue3-5",
          title: "Vue3 工程实践与项目实战",
          summary: "Vue3 工程实践与项目实战（Vue 3 教程）：接下来我们将在 App.vue 中构建核心任务管理逻辑 本节含 16 页、3 道配套题。",
          concepts: [
            "核心业务开发",
            "基础布局与响应式数据",
            "核心知识点",
            "2. 列表渲染与 Key 值",
            "3. 事件处理与修饰符",
            "4. 双向绑定 (v-model)",
            "5. 动画系统 (TransitionGroup)",
            "Tailwind v4 样式特性讲解",
            "1. 全新的渐变语法",
            "2. 透明度处理"
          ],
          principles: [
            "接下来我们将在 App.vue 中构建核心任务管理逻辑",
            "在 src/App.vue 中编写：",
            "以上代码展示了 Vue 3 最核心的逻辑组织方式：",
            "ref (响应式基础)：tasks、newTaskTitle 等都是响应式引用",
            ":key 的重要性：在 Vue 中，列表循环必须提供 key",
            "这里使用了 crypto.randomUUID() 生成的唯一 ID",
            "@keyup.enter：这是一个按键修饰符",
            "它让 addTask 函数只在用户按下回车键时触发，极大提升了输入体验"
          ],
          applications: [
            "示例：＜script setup＞",
            "示例：<li v-for=\"task in filteredTasks\" :key=\"task.id\">",
            "示例：npm install pinia",
            "示例：import { defineStore } from 'pinia'",
            "示例：<template>",
            "示例：npm install vue-router"
          ],
          pitfalls: [
            "在 ＜script＞ 中修改它们必须使用 .value（如 tasks.value = ...），但在 <template> 中直接写变量名",
            ":key 的重要性：在 Vue 中，列表循环必须提供 key",
            "这保证了当列表顺序改变或删除某项时，Vue 能准确识别具体的 DOM 节点，避免渲染错乱（特别是带有动画或输入状态的列表）",
            "注意：push 会向浏览器历史记录添加一条新记录，点击浏览器返回键是可以回退的",
            "Vite 要求变量必须以 VITE_ 开头才能被暴露给客户端代码"
          ],
          method: "按站内顺序读「核心业务开发 → 状态管理与数据持久化 → 组件拆分 → 路由系统 → 逻辑复用与性能优化 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 3 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「核心业务开发、基础布局与响应式数据、核心知识点」的用法，并把 3 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【核心业务开发】核心业务开发：接下来我们将在 App.vue 中构建核心任务管理逻辑",
              "【核心业务开发】基础布局与响应式数据：在 src/App.vue 中编写：",
              "【核心业务开发】1. 组合式 API (Composition API)：以上代码展示了 Vue 3 最核心的逻辑组织方式：",
              "【核心业务开发】2. 列表渲染与 Key 值：:key 的重要性：在 Vue 中，列表循环必须提供 key",
              "【核心业务开发】3. 事件处理与修饰符：@keyup.enter：这是一个按键修饰符",
              "【核心业务开发】4. 双向绑定 (v-model)：v-model=\"newTaskTitle\" 实现了输入框和变量的同步"
            ],
            mechanism: [
              "接下来我们将在 App.vue 中构建核心任务管理逻辑",
              "数据流向：输入框输入内容 -> v-model 更新 newTaskTitle",
              "动作触发：按回车 -> 执行 addTask -> tasks 数组增加一项",
              "视图更新：tasks 改变 -> 触发 filteredTasks 自动重新计算 -> Vue 重新渲染 li 列表",
              "状态流转：点击过滤器按钮 -> 修改 currentFilter 值 -> 再次触发 filteredTasks 计算 -> 页面展示不同类别的任务",
              "在 src/App.vue 中编写：",
              "以上代码展示了 Vue 3 最核心的逻辑组织方式：",
              "ref (响应式基础)：tasks、newTaskTitle 等都是响应式引用",
              "在 ＜script＞ 中修改它们必须使用 .value（如 tasks.value = ...），但在 <template> 中直接写变量名",
              "Vue 会自动追踪这些值的变化并更新 UI"
            ],
            example: {
              title: "核心业务开发 · 基础布局与响应式数据",
              language: "vue",
              code: "＜script setup＞\n\nimport { ref, computed } from 'vue';\n\n// 1. 任务数据模型\n\nconst tasks = ref([\n\n{ id: '1', title: '体验 Tailwind v4 新特性', isCompleted: false },\n\n{ id: '2', title: '掌握 Composition API', isCompleted: true }\n\n]);\n\nconst newTaskTitle = ref('');\n\nconst currentFilter = ref('all');\n\n// 2. 核心方法\n\nconst addTask = () => {\n\nconst title = newTaskTitle.value.trim();\n\nif (!title) return;\n\ntasks.value.unshift({\n\nid: crypto.randomUUID(),\n\ntitle,\n\nisCompleted: false\n\n});\n\nnewTaskTitle.value = '';\n\n};\n\nconst removeTask = (id) => {\n\ntasks.value = tasks.value.filter(t => t.id !== id);\n\n};\n\nconst toggleTask = (id) => {\n\nconst task = tasks.value.find(t => t.id === id);\n\nif (task) task.isCompleted = !task.isCompleted;\n\n};\n\n// 3. 计算属性处理过滤\n\nconst filteredTasks = computed(() => {\n\nif (currentFilter.value === 'active') return tasks.value.filter(t => !t.isCompleted);\n\nif (currentFilter.value === 'completed') return tasks.value.filter(t => t.isCompleted);\n\nreturn tasks.value;\n\n});\n\n＜/script＞\n\n<template>\n\n<div class=\"min-h-screen py-12 px-4\">\n\n<div class=\"max-w-md mx-auto bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 overflow-hidden\">\n\n<header class=\"bg-linear-to-br from-blue-600 to-indigo-700 p-8 text-white\">\n\n<h1 class=\"text-3xl font-black tracking-tight\">TaskHub</h1>\n\n<p class=\"text-blue-100/80 text-sm\">Vue 3 + Tailwind v4 实战</p>\n\n</header>\n\n<main class=\"p-6\">\n\n<div class=\"flex gap-2 mb-8\">\n\n<input\n\nv-model=\"newTaskTitle\"\n\n@keyup.enter=\"addTask\"\n\nplaceholder=\"今天要完成什么？\"\n\nclass=\"flex-1 bg-slate-50 border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-brand/50 outline",
              explanation: "在 src/App.vue 中编写："
            },
            practiceSteps: [
              "先通读本节 16 页：核心业务开发、状态管理与数据持久化、组件拆分、路由系统 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 3 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「Vue3 工程实践与项目实战」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 3 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-vue3-1",
        "rn-vue3-3",
        "rn-vue3-4",
        "rn-vue3-10",
        "rn-vue3-20",
        "rn-vue3-6",
        "rn-vue3-9",
        "rn-vue3-11",
        "rn-vue3-13",
        "rn-vue3-19",
        "rn-vue3-5",
        "rn-vue3-7",
        "rn-vue3-8",
        "rn-vue3-15",
        "rn-vue3-14",
        "rn-vue3-16",
        "rn-vue3-17",
        "rn-vue3-2",
        "rn-vue3-12",
        "rn-vue3-18"
      ],
      lesson: {
        overview: [
          "《Vue 3 教程》取自菜鸟教程，共 57 页，整理为 5 个知识点、20 道配套测验题。",
          "知识点顺序保持站内阅读顺序：Vue3 入门、环境与项目结构 → Vue3 模板语法与内置指令 → Vue3 组件、计算与监听属性 → Vue3 路由、状态管理与组合式 API → Vue3 工程实践与项目实战。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 20 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 Vue3 入门、环境与项目结构 并跑通示例",
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
        completionCriteria: ["《Vue 3 教程》5 个知识点全部读完。", "配套 20 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    },
    {
      key: "rn-xml-stage",
      title: "XML 教程",
      weeks: "第 1 阶段",
      goal: "把「XML 教程」的 29 页内容按 3 个知识点串起来，并能独立写出示例。",
      outcome: "能在不看文档的情况下写出XML 教程的典型用法，并把 20 道配套题做到 80% 以上正确率。",
      topics: [
        {
          key: "rn-xml-1",
          title: "XML 基础语法与元素",
          summary: "XML 基础语法与元素（XML 教程）：XML 指可扩展标记语言（eXtensible Markup Language） 本节含 12 页、7 道配套题。",
          concepts: [
            "XML 教程",
            "XML 实例",
            "XML 在线格式化",
            "XML 简介",
            "应该掌握的基础知识",
            "什么是 XML？",
            "XML 和 HTML 之间的差异",
            "XML 不会做任何事情",
            "通过 XML 您可以发明自己的标签",
            "XML 不是对 HTML 的替代"
          ],
          principles: [
            "XML 指可扩展标记语言（eXtensible Markup Language）",
            "XML 被设计用来传输和存储数据，不用于表现和展示数据，HTML 则用来表现数据",
            "XML 文档第一行以 XML 声明开始，用来表述文档的一些信息，如：",
            "XML 定义结构、存储信息、传送信息",
            "使用我们的编辑器，你可以编辑 XML 代码，然后点击测试按钮查看结果",
            "通过 XML 在线格式化可以在线压缩与 XML 代码:",
            "https://www.jyshare.com/front-end/710/",
            "XML 被设计用来传输和存储数据"
          ],
          applications: [
            "示例：<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
            "示例：<note>",
            "示例：<root>",
            "示例：<bookstore>",
            "示例：<?xml version=\"1.0\" encoding=\"utf-8\"?>",
            "示例：<person age=\"30\" gender=\"male\">John Doe</person>"
          ],
          pitfalls: [
            "标签必须成对出现，有开始标签就需要有结束标签，例如：",
            "必须转换大量的数据，不兼容的数据经常会丢失",
            "XML 文档必须包含根元素",
            "XML 元素必须遵循以下命名规则：",
            "名称不能以数字或者标点符号开始"
          ],
          method: "按站内顺序读「XML 教程 → XML 简介 → XML 用途 → XML 树结构 → XML 元素 → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 7 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「XML 教程、XML 实例、XML 在线格式化」的用法，并把 7 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【XML 教程】XML 教程：XML 指可扩展标记语言（eXtensible Markup Language）",
              "【XML 教程】XML 实例：XML 文档第一行以 XML 声明开始，用来表述文档的一些信息，如：",
              "【XML 教程】XML 实例：使用我们的编辑器，你可以编辑 XML 代码，然后点击测试按钮查看结果",
              "【XML 教程】XML 在线格式化：通过 XML 在线格式化可以在线压缩与 XML 代码:",
              "【XML 简介】XML 简介：XML 被设计用来传输和存储数据",
              "【XML 简介】应该掌握的基础知识：在您继续学习之前，需要对以下知识有基本的了解："
            ],
            mechanism: [
              "XML 指可扩展标记语言（eXtensible Markup Language）",
              "XML 被设计用来传输和存储数据，不用于表现和展示数据，HTML 则用来表现数据",
              "XML 很重要，也很容易学习",
              "XML 文档第一行以 XML 声明开始，用来表述文档的一些信息，如：",
              "XML 定义结构、存储信息、传送信息",
              "<name>、<url>、<logo>、<desc> 分别为标签，标签内包含了要传递的信息",
              "标签必须成对出现，有开始标签就需要有结束标签，例如：",
              "使用我们的编辑器，你可以编辑 XML 代码，然后点击测试按钮查看结果",
              "通过 XML 在线格式化可以在线压缩与 XML 代码:",
              "https://www.jyshare.com/front-end/710/"
            ],
            example: {
              title: "XML 树结构 · 实例：",
              language: "xml",
              code: "<bookstore>\n<book category=\"COOKING\">\n<title lang=\"en\">Everyday Italian</title>\n<author>Giada De Laurentiis</author>\n<year>2005</year>\n<price>30.00</price>\n</book>\n<book category=\"CHILDREN\">\n<title lang=\"en\">Harry Potter</title>\n<author>J K. Rowling</author>\n<year>2005</year>\n<price>29.99</price>\n</book>\n<book category=\"WEB\">\n<title lang=\"en\">Learning XML</title>\n<author>Erik T. Ray</author>\n<year>2003</year>\n<price>39.95</price>\n</book>\n</bookstore>",
              explanation: "上图表示下面的 XML 中的一本书："
            },
            practiceSteps: [
              "先通读本节 12 页：XML 教程、XML 简介、XML 用途、XML 树结构 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 7 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「XML 基础语法与元素」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 7 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-xml-2",
          title: "XML 命名空间、CDATA 与验证",
          summary: "XML 命名空间、CDATA 与验证（XML 教程）：XMLHttpRequest 对象用于在后台与服务器交换数据 本节含 4 页、6 道配套题。",
          concepts: [
            "XMLHttpRequest 对象",
            "XMLHttpRequest 实例",
            "创建一个 XMLHttpRequest 对象",
            "XML Parser",
            "解析 XML 文档",
            "解析 XML 字符串",
            "跨域访问",
            "XML DOM",
            "HTML DOM",
            "加载一个 XML 文件 - 跨浏览器实例"
          ],
          principles: [
            "XMLHttpRequest 对象用于在后台与服务器交换数据",
            "XMLHttpRequest 对象是开发者的梦想，因为您能够：",
            "当你在下面的输入字段中键入一个字符，一个 XMLHttpRequest 发送到服务器 - 返回名称的建议（从服务器上的文件）：",
            "在输入框中键入一个字母：",
            "所有现代浏览器（IE7+、Firefox、Chrome、Safari 和 Opera）都有内建的 XMLHttpRequest 对象",
            "创建 XMLHttpRequest 对象的语法：",
            "所有现代浏览器都有内建的 XML 解析器",
            "XML 解析器把 XML 文档转换为 XML DOM 对象 - 可通过 JavaScript 操作的对象"
          ],
          applications: ["示例：<html>"],
          pitfalls: ["这意味着，网页以及它试图加载的 XML 文件，都必须位于相同的服务器上", "请注意，即使 XML 文件只包含一个 <to> 元素，您仍然必须指定数组索引 [0]"],
          method: "按站内顺序读「XMLHttpRequest 对象 → XML Parser → XML DOM → HTML 页面显示 XML 数据」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 6 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「XMLHttpRequest 对象、XMLHttpRequest 实例、创建一个 XMLHttpRequest 对象」的用法，并把 6 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【XMLHttpRequest 对象】XMLHttpRequest 对象：XMLHttpRequest 对象用于在后台与服务器交换数据",
              "【XMLHttpRequest 对象】XMLHttpRequest 实例：当你在下面的输入字段中键入一个字符，一个 XMLHttpRequest 发送到服务器 - 返回名称的建议（从服务器上的文件）：",
              "【XMLHttpRequest 对象】创建一个 XMLHttpRequest 对象：所有现代浏览器（IE7+、Firefox、Chrome、Safari 和 Opera）都有内建的 XMLHttpRequest 对象",
              "【XML Parser】XML Parser：所有现代浏览器都有内建的 XML 解析器",
              "【XML Parser】解析 XML 文档：下面的代码片段把 XML 文档解析到 XML DOM 对象中：",
              "【XML Parser】解析 XML 字符串：下面的代码片段把 XML 字符串解析到 XML DOM 对象中："
            ],
            mechanism: [
              "XMLHttpRequest 对象用于在后台与服务器交换数据",
              "XMLHttpRequest 对象是开发者的梦想，因为您能够：",
              "在不重新加载页面的情况下更新网页",
              "在页面已加载后从服务器请求数据",
              "在页面已加载后从服务器接收数据",
              "如需学习更多关于 XMLHttpRequest 对象的知识，请学习我们的 XML DOM 教程",
              "当你在下面的输入字段中键入一个字符，一个 XMLHttpRequest 发送到服务器 - 返回名称的建议（从服务器上的文件）：",
              "所有现代浏览器（IE7+、Firefox、Chrome、Safari 和 Opera）都有内建的 XMLHttpRequest 对象",
              "创建 XMLHttpRequest 对象的语法：",
              "旧版本的Internet Explorer（IE5和IE6）中使用 ActiveX 对象："
            ],
            example: {
              title: "XML DOM · 加载一个 XML 字符串 - 跨浏览器实例",
              language: "xml",
              code: "<html>\n\n<body>\n\n<h1>W3Schools Internal Note</h1>\n\n<div>\n\n<b>To:</b> <span id=\"to\"></span><br />\n\n<b>From:</b> <span id=\"from\"></span><br />\n\n<b>Message:</b> <span id=\"message\"></span>\n\n</div>\n\n＜script＞\n\ntxt=\"<note>\";\n\ntxt=txt+\"<to>Tove</to>\";\n\ntxt=txt+\"<from>Jani</from>\";\n\ntxt=txt+\"<heading>Reminder</heading>\";\n\ntxt=txt+\"<body>Don't forget me this weekend!</body>\";\n\ntxt=txt+\"</note>\";\n\nif (window.DOMParser)\n\n{\n\nparser=new DOMParser();\n\nxmlDoc=parser.parseFromString(txt,\"text/xml\");\n\n}\n\nelse // Internet Explorer\n\n{\n\nxmlDoc=new ActiveXObject(\"Microsoft.XMLDOM\");\n\nxmlDoc.async=false;\n\nxmlDoc.loadXML(txt);\n\n}\n\ndocument.getElementById(\"to\").innerHTML=\n\nxmlDoc.getElementsByTagName(\"to\")[0].childNodes[0].nodeValue;\n\ndocument.getElementById(\"from\").innerHTML=\n\nxmlDoc.getElementsByTagName(\"from\")[0].childNodes[0].nodeValue;\n\ndocument.getElementById(\"message\").innerHTML=\n\nxmlDoc.getElementsByTagName(\"body\")[0].childNodes[0].nodeValue;\n\n＜/script＞\n\n</body>\n\n</html>",
              explanation: "下面的实例把 XML 字符串解析到 XML DOM 对象中，然后通过 JavaScript 提取一些信息："
            },
            practiceSteps: [
              "先通读本节 4 页：XMLHttpRequest 对象、XML Parser、XML DOM、HTML 页面显示 XML 数据。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 6 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「XML 命名空间、CDATA 与验证」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 6 道测验题正确率达到 80% 以上。"]
          }
        },
        {
          key: "rn-xml-3",
          title: "XML 解析、XPath 与转换",
          summary: "XML 解析、XPath 与转换（XML 教程）：本章演示一些基于 XML, HTML, XML DOM 和 JavaScript 构建的小型 XML 应用程序 本节含 13 页、7 道配套题。",
          concepts: [
            "XML 应用程序",
            "XML 文档实例",
            "在 HTML div 元素中显示第一个 CD",
            "添加导航脚本",
            "当点击 CD 时显示专辑信息",
            "XML 命名空间",
            "命名冲突",
            "使用前缀来避免命名冲突",
            "XML 命名空间 - xmlns 属性",
            "默认的命名空间"
          ],
          principles: [
            "本章演示一些基于 XML, HTML, XML DOM 和 JavaScript 构建的小型 XML 应用程序",
            "在本应用程序中，我们将使用 \"cd_catalog.xml\" 文件",
            "下面的实例从第一个 CD 元素中获取 XML 数据，然后在 id=\"showCD\" 的 HTML 元素中显示数据",
            "displayCD() 函数在页面加载时调用：",
            "为了向上面的实例添加导航（功能），需要创建 next() 和 previous() 两个函数：",
            "最后的实例展示如何在用户点击某个 CD 项目时显示专辑信息：",
            "如需了解更多关于使用 JavaScript 和 XML DOM 的信息，请访问我们的 XML DOM 教程",
            "XML 命名空间提供避免元素命名冲突的方法"
          ],
          applications: [
            "示例：x=xmlDoc.getElementsByTagName(\"CD\");",
            "示例：function next()",
            "示例：txt=xmlDoc.getElementsByTagName(\"title\")[0].childNodes[0].nodeValue;",
            "示例：txt=xmlDoc.getElementsByTagName(\"title\")[0].getAttribute(\"lang\");",
            "示例：x=xmlDoc.getElementsByTagName(\"title\")[0].childNodes[0];",
            "示例：x=xmlDoc.getElementsByTagName(\"book\");"
          ],
          pitfalls: [
            "XML 命名空间提供避免元素命名冲突的方法",
            "在 XML 中的命名冲突可以通过使用名称前缀从而容易地避免",
            "当在 XML 中使用前缀时，一个所谓的用于前缀的命名空间必须被定义",
            "\"<\" 会产生错误，因为解析器会把该字符解释为新元素的开始",
            "\"&\" 会产生错误，因为解析器会把该字符解释为字符实体的开始"
          ],
          method: "按站内顺序读「XML 应用程序 → XML 命名空间 → XML CDATA → XML 编码 → 服务器上的 XML → …」，每页先看示例再读结论，最后回做题。",
          exercise: "完成本节配套的 7 道题；把错题原文记进练习记录，隔天重做一遍。",
          checkpoint: "能说清「XML 应用程序、XML 文档实例、在 HTML div 元素中显示第一个 CD」的用法，并把 7 道题做到 80% 以上正确率。",
          lesson: {
            overview: [
              "【XML 应用程序】XML 应用程序：本章演示一些基于 XML, HTML, XML DOM 和 JavaScript 构建的小型 XML 应用程序",
              "【XML 应用程序】XML 文档实例：在本应用程序中，我们将使用 \"cd_catalog.xml\" 文件",
              "【XML 应用程序】在 HTML div 元素中显示第一个 CD：下面的实例从第一个 CD 元素中获取 XML 数据，然后在 id=\"showCD\" 的 HTML 元素中显示数据",
              "【XML 应用程序】添加导航脚本：为了向上面的实例添加导航（功能），需要创建 next() 和 previous() 两个函数：",
              "【XML 应用程序】当点击 CD 时显示专辑信息：最后的实例展示如何在用户点击某个 CD 项目时显示专辑信息：",
              "【XML 命名空间】XML 命名空间：XML 命名空间提供避免元素命名冲突的方法"
            ],
            mechanism: [
              "本章演示一些基于 XML, HTML, XML DOM 和 JavaScript 构建的小型 XML 应用程序",
              "在本应用程序中，我们将使用 \"cd_catalog.xml\" 文件",
              "下面的实例从第一个 CD 元素中获取 XML 数据，然后在 id=\"showCD\" 的 HTML 元素中显示数据",
              "displayCD() 函数在页面加载时调用：",
              "为了向上面的实例添加导航（功能），需要创建 next() 和 previous() 两个函数：",
              "最后的实例展示如何在用户点击某个 CD 项目时显示专辑信息：",
              "如需了解更多关于使用 JavaScript 和 XML DOM 的信息，请访问我们的 XML DOM 教程",
              "XML 命名空间提供避免元素命名冲突的方法",
              "在 XML 中，元素名称是由开发者定义的，当两个不同的文档使用相同的元素名时，就会发生命名冲突",
              "这个 XML 携带 HTML 表格的信息："
            ],
            example: {
              title: "XML - E4X · 没有使用 E4X",
              language: "xml",
              code: "var xmlDoc;\n\n//code for Internet Explorer\n\nif (window.ActiveXObject)\n\n{\n\nxmlDoc = new ActiveXObject(\"Microsoft.XMLDOM\");\n\nxmlDoc.async=false;\n\nxmlDoc.load(\"note.xml\");\n\ndisplaymessage();\n\n}\n\n// code for Mozilla, Firefox, etc.\n\nelse (document.implementation && document.implementation.createDocument)\n\n{\n\nxmlDoc= document.implementation.createDocument(\"\",\"\",null);\n\nxmlDoc.load(\"note.xml\");\n\nxmlDoc.onload＝displaymessage;\n\n}\n\nfunction displaymessage()\n\n{\n\ndocument.write(xmlDoc.getElementsByTagName(\"body\")[0].firstChild.nodeValue);\n\n}",
              explanation: "下面的实例是一个跨浏览器的实例，实例加载一个现有的 XML 文档（\"note.xml\"）到 XML 解析器，并显示消息说明："
            },
            practiceSteps: [
              "先通读本节 13 页：XML 应用程序、XML 命名空间、XML CDATA、XML 编码 等。",
              "把上面示例代码敲进本地环境跑一遍，对照站点输出核对结果。",
              "做完本节 7 道测验题，错题回到对应小节复述一遍。",
              "用一句话写下本节最容易踩的坑，贴到自己的笔记里。"
            ],
            masteryChecklist: ["能不看示例说出「XML 解析、XPath 与转换」的核心用法与适用场景。", "能独立写出本节至少一个示例并跑通。", "本节 7 道测验题正确率达到 80% 以上。"]
          }
        }
      ],
      questionKeys: [
        "rn-xml-1",
        "rn-xml-3",
        "rn-xml-5",
        "rn-xml-6",
        "rn-xml-7",
        "rn-xml-16",
        "rn-xml-20",
        "rn-xml-2",
        "rn-xml-4",
        "rn-xml-8",
        "rn-xml-9",
        "rn-xml-11",
        "rn-xml-12",
        "rn-xml-10",
        "rn-xml-13",
        "rn-xml-14",
        "rn-xml-15",
        "rn-xml-17",
        "rn-xml-18",
        "rn-xml-19"
      ],
      lesson: {
        overview: [
          "《XML 教程》取自菜鸟教程，共 29 页，整理为 3 个知识点、20 道配套测验题。",
          "知识点顺序保持站内阅读顺序：XML 基础语法与元素 → XML 命名空间、CDATA 与验证 → XML 解析、XPath 与转换。"
        ],
        studyLoop: [
          "按知识点顺序读原文，每个知识点先看示例再读结论。",
          "读完一个知识点立刻做它的配套题（本节共 20 道），用正确率判断是否真的读懂。",
          "错题回到对应知识点原文复述一遍，并把错因写进笔记。",
          "全部知识点过完后，隔天把错题重做一遍。"
        ],
        milestones: [
          {
            title: "读完 XML 基础语法与元素 并跑通示例",
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
        completionCriteria: ["《XML 教程》3 个知识点全部读完。", "配套 20 道题完成，正确率 ≥ 80%。", "至少独立写出 3 个示例并跑通。"]
      }
    }
  ],
  questions: [
    {
      key: "rn-html-2",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-1",
      type: "single",
      stem: "HTML 中用于创建超链接的标签是？",
      options: [
        {
          key: "A",
          text: "<a>"
        },
        {
          key: "B",
          text: "＜link＞"
        },
        {
          key: "C",
          text: "<href>"
        },
        {
          key: "D",
          text: "<hyperlink>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <a>\n\n回答错误，正确答案为 <a>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-5",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-1",
      type: "single",
      stem: "HTML 中用于定义标题的标签是？",
      options: [
        {
          key: "A",
          text: "<h1> 到 <h6>"
        },
        {
          key: "B",
          text: "<header>"
        },
        {
          key: "C",
          text: "<title>"
        },
        {
          key: "D",
          text: "<head>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <h1> 到 <h6>\n\n回答错误，正确答案为 <h1> 到 <h6>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-10",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-1",
      type: "single",
      stem: "HTML 中用于定义超链接目标的属性是？",
      options: [
        {
          key: "A",
          text: "href"
        },
        {
          key: "B",
          text: "src"
        },
        {
          key: "C",
          text: "link"
        },
        {
          key: "D",
          text: "target"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. href\n\n回答错误，正确答案为 href。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-13",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-1",
      type: "single",
      stem: "HTML 中用于定义输入框的标签是？",
      options: [
        {
          key: "A",
          text: "<input>"
        },
        {
          key: "B",
          text: "<form>"
        },
        {
          key: "C",
          text: "<textarea>"
        },
        {
          key: "D",
          text: "<button>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <input>\n\n回答错误，正确答案为 <input>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-16",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-1",
      type: "single",
      stem: "HTML 中用于定义按钮的标签是？",
      options: [
        {
          key: "A",
          text: "<button>"
        },
        {
          key: "B",
          text: "<input>"
        },
        {
          key: "C",
          text: "<form>"
        },
        {
          key: "D",
          text: "<click>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <button>\n\n回答错误，正确答案为 <button>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-18",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-1",
      type: "single",
      stem: "HTML 中用于定义页面标题的标签是？",
      options: [
        {
          key: "A",
          text: "<title>"
        },
        {
          key: "B",
          text: "<head>"
        },
        {
          key: "C",
          text: "<header>"
        },
        {
          key: "D",
          text: "<h1>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <title>\n\n回答错误，正确答案为 <title>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-11",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-1",
      type: "single",
      stem: "HTML5 中哪个属性可用于输入时显示提示信息？",
      options: [
        {
          key: "A",
          text: "placeholder"
        },
        {
          key: "B",
          text: "hint"
        },
        {
          key: "C",
          text: "title"
        },
        {
          key: "D",
          text: "label"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. placeholder\n\n回答错误，正确答案是 placeholder。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-16",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-1",
      type: "single",
      stem: "HTML5 中哪个标签用于定义与页面内容略有相关的内容？",
      options: [
        {
          key: "A",
          text: "<aside>"
        },
        {
          key: "B",
          text: "<section>"
        },
        {
          key: "C",
          text: "<nav>"
        },
        {
          key: "D",
          text: "<footer>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <aside>\n\n回答错误，正确答案是 <aside>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-3",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-2",
      type: "single",
      stem: "HTML 中用于插入图片的标签是？",
      options: [
        {
          key: "A",
          text: "<img>"
        },
        {
          key: "B",
          text: "<image>"
        },
        {
          key: "C",
          text: "<pic>"
        },
        {
          key: "D",
          text: "<src>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <img>\n\n回答错误，正确答案为 <img>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-12",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-2",
      type: "single",
      stem: "HTML 中用于定义表格标题单元格的标签是？",
      options: [
        {
          key: "A",
          text: "<th>"
        },
        {
          key: "B",
          text: "<td>"
        },
        {
          key: "C",
          text: "<tr>"
        },
        {
          key: "D",
          text: "<thead>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <th>\n\n回答错误，正确答案为 <th>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-14",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-2",
      type: "single",
      stem: "HTML 中用于定义下拉列表的标签是？",
      options: [
        {
          key: "A",
          text: "<select>"
        },
        {
          key: "B",
          text: "<option>"
        },
        {
          key: "C",
          text: "<dropdown>"
        },
        {
          key: "D",
          text: "<list>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <select>\n\n回答错误，正确答案为 <select>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-17",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-2",
      type: "single",
      stem: "HTML 中用于定义脚注的标签是？",
      options: [
        {
          key: "A",
          text: "<footer>"
        },
        {
          key: "B",
          text: "<foot>"
        },
        {
          key: "C",
          text: "<bottom>"
        },
        {
          key: "D",
          text: "<note>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <footer>\n\n回答错误，正确答案为 <footer>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-19",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-2",
      type: "single",
      stem: "HTML 中用于定义页面元信息的标签是？",
      options: [
        {
          key: "A",
          text: "＜meta＞"
        },
        {
          key: "B",
          text: "<head>"
        },
        {
          key: "C",
          text: "<info>"
        },
        {
          key: "D",
          text: "<data>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. ＜meta＞\n\n回答错误，正确答案为 ＜meta＞。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-20",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-2",
      type: "single",
      stem: "HTML 中用于定义水平线的标签是？",
      options: [
        {
          key: "A",
          text: "<hr>"
        },
        {
          key: "B",
          text: "<line>"
        },
        {
          key: "C",
          text: "<horizontal>"
        },
        {
          key: "D",
          text: "<break>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <hr>\n\n回答错误，正确答案为 <hr>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-9",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-2",
      type: "single",
      stem: "HTML5 中哪个标签用于定义主要内容？",
      options: [
        {
          key: "A",
          text: "<main>"
        },
        {
          key: "B",
          text: "<body>"
        },
        {
          key: "C",
          text: "<content>"
        },
        {
          key: "D",
          text: "<section>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <main>\n\n回答错误，正确答案是 <main>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-12",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-2",
      type: "single",
      stem: "HTML5 中哪个标签用于定义进度条？",
      options: [
        {
          key: "A",
          text: "<progress>"
        },
        {
          key: "B",
          text: "<bar>"
        },
        {
          key: "C",
          text: "<meter>"
        },
        {
          key: "D",
          text: "<range>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <progress>\n\n回答错误，正确答案是 <progress>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-18",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-2",
      type: "single",
      stem: "HTML5 中哪个标签用于定义标记文本？",
      options: [
        {
          key: "A",
          text: "<mark>"
        },
        {
          key: "B",
          text: "<highlight>"
        },
        {
          key: "C",
          text: "<strong>"
        },
        {
          key: "D",
          text: "<em>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <mark>\n\n回答错误，正确答案是 <mark>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-1",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-3",
      type: "single",
      stem: "HTML 的全称是什么？",
      options: [
        {
          key: "A",
          text: "Hyper Text Markup Language"
        },
        {
          key: "B",
          text: "Hyperlinks and Text Markup Language"
        },
        {
          key: "C",
          text: "Home Tool Markup Language"
        },
        {
          key: "D",
          text: "Hyperlink Text Management Language"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. Hyper Text Markup Language\n\n回答错误，正确答案为 Hyper Text Markup Language。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-6",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-3",
      type: "single",
      stem: "HTML 中用于创建无序列表的标签是？",
      options: [
        {
          key: "A",
          text: "<ul>"
        },
        {
          key: "B",
          text: "<ol>"
        },
        {
          key: "C",
          text: "<li>"
        },
        {
          key: "D",
          text: "<list>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <ul>\n\n回答错误，正确答案为 <ul>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-7",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-3",
      type: "single",
      stem: "HTML 中用于定义表单的标签是？",
      options: [
        {
          key: "A",
          text: "<form>"
        },
        {
          key: "B",
          text: "<input>"
        },
        {
          key: "C",
          text: "<textarea>"
        },
        {
          key: "D",
          text: "<fieldset>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <form>\n\n回答错误，正确答案为 <form>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-8",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-3",
      type: "single",
      stem: "HTML 中用于定义表格的标签是？",
      options: [
        {
          key: "A",
          text: "<table>"
        },
        {
          key: "B",
          text: "<tr>"
        },
        {
          key: "C",
          text: "<td>"
        },
        {
          key: "D",
          text: "<th>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <table>\n\n回答错误，正确答案为 <table>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-9",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-3",
      type: "single",
      stem: "HTML 中用于定义文档类型的声明是？",
      options: [
        {
          key: "A",
          text: "<!DOCTYPE>"
        },
        {
          key: "B",
          text: "<doctype>"
        },
        {
          key: "C",
          text: "<document>"
        },
        {
          key: "D",
          text: "<html>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <!DOCTYPE>\n\n回答错误，正确答案为 <!DOCTYPE>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-11",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-3",
      type: "single",
      stem: "HTML 中用于定义表格单元格的标签是？",
      options: [
        {
          key: "A",
          text: "<td>"
        },
        {
          key: "B",
          text: "<tr>"
        },
        {
          key: "C",
          text: "<table>"
        },
        {
          key: "D",
          text: "<cell>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <td>\n\n回答错误，正确答案为 <td>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-5",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-3",
      type: "single",
      stem: "HTML5 中哪个标签用于定义导航链接？",
      options: [
        {
          key: "A",
          text: "<nav>"
        },
        {
          key: "B",
          text: "<navigate>"
        },
        {
          key: "C",
          text: "<menu>"
        },
        {
          key: "D",
          text: "＜link＞"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <nav>\n\n回答错误，正确答案是 <nav>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-1",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-4",
      type: "single",
      stem: "HTML5 中用于绘制图形的标签是？",
      options: [
        {
          key: "A",
          text: "<svg>"
        },
        {
          key: "B",
          text: "<canvas>"
        },
        {
          key: "C",
          text: "<draw>"
        },
        {
          key: "D",
          text: "<graphic>"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. <canvas>\n\n回答错误，正确答案是 <canvas>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-4",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-4",
      type: "single",
      stem: "HTML5 新增的表单输入类型不包括？",
      options: [
        {
          key: "A",
          text: "email"
        },
        {
          key: "B",
          text: "date"
        },
        {
          key: "C",
          text: "color"
        },
        {
          key: "D",
          text: "passwords"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. passwords\n\n回答错误，正确答案是 passwords。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-7",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-4",
      type: "single",
      stem: "HTML5 中哪个标签用于定义侧边栏内容？",
      options: [
        {
          key: "A",
          text: "<aside>"
        },
        {
          key: "B",
          text: "<sidebar>"
        },
        {
          key: "C",
          text: "<left>"
        },
        {
          key: "D",
          text: "<section>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <aside>\n\n回答错误，正确答案是 <aside>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-10",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-4",
      type: "single",
      stem: "HTML5 中哪个属性可用于自动获得输入焦点？",
      options: [
        {
          key: "A",
          text: "autofocus"
        },
        {
          key: "B",
          text: "focus"
        },
        {
          key: "C",
          text: "selected"
        },
        {
          key: "D",
          text: "checked"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. autofocus\n\n回答错误，正确答案是 autofocus。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-13",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-4",
      type: "single",
      stem: "HTML5 中哪个标签用于定义度量值？",
      options: [
        {
          key: "A",
          text: "<meter>"
        },
        {
          key: "B",
          text: "<progress>"
        },
        {
          key: "C",
          text: "<measure>"
        },
        {
          key: "D",
          text: "<value>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <meter>\n\n回答错误，正确答案是 <meter>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-14",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-4",
      type: "single",
      stem: "HTML5 中哪个 API 用于在浏览器本地存储数据？",
      options: [
        {
          key: "A",
          text: "localStorage"
        },
        {
          key: "B",
          text: "sessionStorage"
        },
        {
          key: "C",
          text: "cookie"
        },
        {
          key: "D",
          text: "全部正确"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 全部正确\n\n回答错误，正确答案是 全部正确。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-15",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-4",
      type: "single",
      stem: "HTML5 中哪个标签用于定义文章内容？",
      options: [
        {
          key: "A",
          text: "<article>"
        },
        {
          key: "B",
          text: "<section>"
        },
        {
          key: "C",
          text: "<div>"
        },
        {
          key: "D",
          text: "<content>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <article>\n\n回答错误，正确答案是 <article>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-17",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-4",
      type: "single",
      stem: "HTML5 中哪个标签用于定义时间或日期？",
      options: [
        {
          key: "A",
          text: "<time>"
        },
        {
          key: "B",
          text: "<date>"
        },
        {
          key: "C",
          text: "<datetime>"
        },
        {
          key: "D",
          text: "<clock>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <time>\n\n回答错误，正确答案是 <time>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-20",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-4",
      type: "single",
      stem: "HTML5 中哪个属性可用于指定输入字段的最大长度？",
      options: [
        {
          key: "A",
          text: "maxlength"
        },
        {
          key: "B",
          text: "max"
        },
        {
          key: "C",
          text: "limit"
        },
        {
          key: "D",
          text: "size"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. maxlength\n\n回答错误，正确答案是 maxlength。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-4",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-5",
      type: "single",
      stem: "HTML 中用于定义段落的标签是？",
      options: [
        {
          key: "A",
          text: "<p>"
        },
        {
          key: "B",
          text: "<paragraph>"
        },
        {
          key: "C",
          text: "<text>"
        },
        {
          key: "D",
          text: "<para>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <p>\n\n回答错误，正确答案为 <p>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html-15",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-5",
      type: "single",
      stem: "HTML 中用于定义多行文本输入框的标签是？",
      options: [
        {
          key: "A",
          text: "<textarea>"
        },
        {
          key: "B",
          text: "<input>"
        },
        {
          key: "C",
          text: "<form>"
        },
        {
          key: "D",
          text: "<text>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <textarea>\n\n回答错误，正确答案为 <textarea>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-2",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-5",
      type: "single",
      stem: "HTML5 中用于嵌入音频的标签是？",
      options: [
        {
          key: "A",
          text: "<audio>"
        },
        {
          key: "B",
          text: "<sound>"
        },
        {
          key: "C",
          text: "<music>"
        },
        {
          key: "D",
          text: "<media>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <audio>\n\n回答错误，正确答案是 <audio>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-3",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-5",
      type: "single",
      stem: "HTML5 中用于嵌入视频的标签是？",
      options: [
        {
          key: "A",
          text: "<media>"
        },
        {
          key: "B",
          text: "<movie>"
        },
        {
          key: "C",
          text: "<video>"
        },
        {
          key: "D",
          text: "<mp4>"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. <video>\n\n回答错误，正确答案是 <video>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-6",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-5",
      type: "single",
      stem: "HTML5 中哪个标签用于定义文档页眉？",
      options: [
        {
          key: "A",
          text: "<header>"
        },
        {
          key: "B",
          text: "<head>"
        },
        {
          key: "C",
          text: "<top>"
        },
        {
          key: "D",
          text: "<section>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <header>\n\n回答错误，正确答案是 <header>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-8",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-5",
      type: "single",
      stem: "HTML5 中哪个标签用于定义文档底部？",
      options: [
        {
          key: "A",
          text: "<footer>"
        },
        {
          key: "B",
          text: "<bottom>"
        },
        {
          key: "C",
          text: "<down>"
        },
        {
          key: "D",
          text: "<section>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <footer>\n\n回答错误，正确答案是 <footer>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-html5-19",
      stageKey: "rn-html-stage",
      topicKey: "rn-html-5",
      type: "single",
      stem: "HTML5 中哪个标签用于定义音频或视频的文本轨道？",
      options: [
        {
          key: "A",
          text: "<track>"
        },
        {
          key: "B",
          text: "<caption>"
        },
        {
          key: "C",
          text: "<subtitle>"
        },
        {
          key: "D",
          text: "<text>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <track>\n\n回答错误，正确答案是 <track>。\n\n考点：HTML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["HTML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-1",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-1",
      type: "single",
      stem: "CSS 的全称是什么？",
      options: [
        {
          key: "A",
          text: "Cascading Style Sheets"
        },
        {
          key: "B",
          text: "Computer Style Sheets"
        },
        {
          key: "C",
          text: "Creative Style System"
        },
        {
          key: "D",
          text: "Colorful Style Sheets"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. Cascading Style Sheets\n\n回答错误，正确答案是 Cascading Style Sheets。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-2",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-1",
      type: "single",
      stem: "CSS 用于什么？",
      options: [
        {
          key: "A",
          text: "制作网页结构"
        },
        {
          key: "B",
          text: "美化网页样式"
        },
        {
          key: "C",
          text: "编写服务器脚本"
        },
        {
          key: "D",
          text: "存储数据"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. 美化网页样式\n\n回答错误，CSS 用于美化网页样式。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-6",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-1",
      type: "single",
      stem: "设置字体颜色的 CSS 属性是？",
      options: [
        {
          key: "A",
          text: "background-color"
        },
        {
          key: "B",
          text: "font-style"
        },
        {
          key: "C",
          text: "color"
        },
        {
          key: "D",
          text: "text-color"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. color\n\n回答错误，正确答案是 color。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-7",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-1",
      type: "single",
      stem: "设置背景颜色的 CSS 属性是？",
      options: [
        {
          key: "A",
          text: "background"
        },
        {
          key: "B",
          text: "background-color"
        },
        {
          key: "C",
          text: "color"
        },
        {
          key: "D",
          text: "bgcolor"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. background-color\n\n回答错误，正确答案是 background-color。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-10",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-1",
      type: "single",
      stem: "设置文本居中的 CSS 属性是？",
      options: [
        {
          key: "A",
          text: "text-align"
        },
        {
          key: "B",
          text: "align"
        },
        {
          key: "C",
          text: "center"
        },
        {
          key: "D",
          text: "vertical-align"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. text-align\n\n回答错误，正确答案是 text-align。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-13",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-1",
      type: "single",
      stem: "CSS 中用于设置外边距的属性是？",
      options: [
        {
          key: "A",
          text: "padding"
        },
        {
          key: "B",
          text: "margin"
        },
        {
          key: "C",
          text: "border"
        },
        {
          key: "D",
          text: "space"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. margin\n\n回答错误，正确答案是 margin。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-14",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-1",
      type: "single",
      stem: "CSS 中用于设置内边距的属性是？",
      options: [
        {
          key: "A",
          text: "padding"
        },
        {
          key: "B",
          text: "margin"
        },
        {
          key: "C",
          text: "border"
        },
        {
          key: "D",
          text: "space"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. padding\n\n回答错误，正确答案是 padding。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-15",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-1",
      type: "single",
      stem: "CSS 中用于设置边框的属性是？",
      options: [
        {
          key: "A",
          text: "border"
        },
        {
          key: "B",
          text: "outline"
        },
        {
          key: "C",
          text: "frame"
        },
        {
          key: "D",
          text: "box"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. border\n\n回答错误，正确答案是 border。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-3",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-1",
      type: "single",
      stem: "CSS3 中用于给文字添加阴影的属性是？",
      options: [
        {
          key: "A",
          text: "text-shadow"
        },
        {
          key: "B",
          text: "font-shadow"
        },
        {
          key: "C",
          text: "box-shadow"
        },
        {
          key: "D",
          text: "shadow"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. text-shadow\n\n回答错误，正确答案是 text-shadow。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-20",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-1",
      type: "single",
      stem: "CSS3 中哪个属性可用于设置弹性盒子项目的对齐方式？",
      options: [
        {
          key: "A",
          text: "justify-content"
        },
        {
          key: "B",
          text: "align-items"
        },
        {
          key: "C",
          text: "align-content"
        },
        {
          key: "D",
          text: "align-self"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. justify-content\n\n回答错误，正确答案是 justify-content。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-4",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-2",
      type: "single",
      stem: "CSS 选择器 .box 选择的是？",
      options: [
        {
          key: "A",
          text: "所有 box 元素"
        },
        {
          key: "B",
          text: "class 为 box 的元素"
        },
        {
          key: "C",
          text: "id 为 box 的元素"
        },
        {
          key: "D",
          text: "name 为 box 的元素"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. class 为 box 的元素\n\n回答错误，.box 选择 class 为 box 的元素。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-5",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-2",
      type: "single",
      stem: "CSS 选择器 #main 选择的是？",
      options: [
        {
          key: "A",
          text: "所有 main 元素"
        },
        {
          key: "B",
          text: "class 为 main 的元素"
        },
        {
          key: "C",
          text: "id 为 main 的元素"
        },
        {
          key: "D",
          text: "name 为 main 的元素"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. id 为 main 的元素\n\n回答错误，#main 选择 id 为 main 的元素。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-9",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-2",
      type: "single",
      stem: "设置元素加粗的 CSS 属性是？",
      options: [
        {
          key: "A",
          text: "font-weight"
        },
        {
          key: "B",
          text: "font-style"
        },
        {
          key: "C",
          text: "font-bold"
        },
        {
          key: "D",
          text: "bold"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. font-weight\n\n回答错误，正确答案是 font-weight。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-11",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-2",
      type: "single",
      stem: "选择所有 <p> 元素的 CSS 选择器是？",
      options: [
        {
          key: "A",
          text: "p"
        },
        {
          key: "B",
          text: ".p"
        },
        {
          key: "C",
          text: "#p"
        },
        {
          key: "D",
          text: "*p"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. p\n\n回答错误，正确答案是 p。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-12",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-2",
      type: "single",
      stem: "选择所有 class 为 box 的 <div> 元素的选择器是？",
      options: [
        {
          key: "A",
          text: "div.box"
        },
        {
          key: "B",
          text: ".div.box"
        },
        {
          key: "C",
          text: "#div.box"
        },
        {
          key: "D",
          text: "div#box"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. div.box\n\n回答错误，正确答案是 div.box。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-16",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-2",
      type: "single",
      stem: "CSS 中用于设置元素宽度的属性是？",
      options: [
        {
          key: "A",
          text: "width"
        },
        {
          key: "B",
          text: "size"
        },
        {
          key: "C",
          text: "length"
        },
        {
          key: "D",
          text: "max-width"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. width\n\n回答错误，正确答案是 width。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-17",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-2",
      type: "single",
      stem: "CSS 中用于设置元素高度的属性是？",
      options: [
        {
          key: "A",
          text: "height"
        },
        {
          key: "B",
          text: "size"
        },
        {
          key: "C",
          text: "length"
        },
        {
          key: "D",
          text: "max-height"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. height\n\n回答错误，正确答案是 height。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-19",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-2",
      type: "single",
      stem: "CSS 中用于隐藏元素的属性是？",
      options: [
        {
          key: "A",
          text: "display"
        },
        {
          key: "B",
          text: "visibility"
        },
        {
          key: "C",
          text: "hidden"
        },
        {
          key: "D",
          text: "opacity"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. display\n\n回答错误，正确答案是 display（如 display: none）。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-20",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-2",
      type: "single",
      stem: "CSS 中用于设置元素透明度的属性是？",
      options: [
        {
          key: "A",
          text: "opacity"
        },
        {
          key: "B",
          text: "transparent"
        },
        {
          key: "C",
          text: "alpha"
        },
        {
          key: "D",
          text: "visibility"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. opacity\n\n回答错误，正确答案是 opacity。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-11",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-2",
      type: "single",
      stem: "CSS3 中哪个选择器可以选择所有偶数行？",
      options: [
        {
          key: "A",
          text: "tr:nth-child(even)"
        },
        {
          key: "B",
          text: "tr:nth-child(odd)"
        },
        {
          key: "C",
          text: "tr:nth-last-child(even)"
        },
        {
          key: "D",
          text: "tr:even"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. tr:nth-child(even)\n\n回答错误，正确答案是 tr:nth-child(even)。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-3",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-3",
      type: "single",
      stem: "在 HTML 文件中引入外部 CSS 文件，使用哪个标签？",
      options: [
        {
          key: "A",
          text: "＜style＞"
        },
        {
          key: "B",
          text: "<css>"
        },
        {
          key: "C",
          text: "＜link＞"
        },
        {
          key: "D",
          text: "＜script＞"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. ＜link＞\n\n回答错误，正确答案是 ＜link＞。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-6",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-3",
      type: "single",
      stem: "CSS3 新增的弹性盒子布局模块是？",
      options: [
        {
          key: "A",
          text: "flexbox"
        },
        {
          key: "B",
          text: "grid"
        },
        {
          key: "C",
          text: "floatbox"
        },
        {
          key: "D",
          text: "boxmodel"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. flexbox\n\n回答错误，正确答案是 flexbox。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-7",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-3",
      type: "single",
      stem: "CSS3 中用于设置元素透明度的属性是？",
      options: [
        {
          key: "A",
          text: "opacity"
        },
        {
          key: "B",
          text: "transparent"
        },
        {
          key: "C",
          text: "alpha"
        },
        {
          key: "D",
          text: "visibility"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. opacity\n\n回答错误，正确答案是 opacity。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-8",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-3",
      type: "single",
      stem: "CSS3 中用于设置动画的属性是？",
      options: [
        {
          key: "A",
          text: "animation"
        },
        {
          key: "B",
          text: "transition"
        },
        {
          key: "C",
          text: "transform"
        },
        {
          key: "D",
          text: "effect"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. animation\n\n回答错误，正确答案是 animation。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-9",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-3",
      type: "single",
      stem: "CSS3 中用于设置过渡效果的属性是？",
      options: [
        {
          key: "A",
          text: "transition"
        },
        {
          key: "B",
          text: "animation"
        },
        {
          key: "C",
          text: "transform"
        },
        {
          key: "D",
          text: "effect"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. transition\n\n回答错误，正确答案是 transition。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-10",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-3",
      type: "single",
      stem: "CSS3 中用于旋转、缩放等变换的属性是？",
      options: [
        {
          key: "A",
          text: "transform"
        },
        {
          key: "B",
          text: "transition"
        },
        {
          key: "C",
          text: "animation"
        },
        {
          key: "D",
          text: "effect"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. transform\n\n回答错误，正确答案是 transform。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-12",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-3",
      type: "single",
      stem: "CSS3 中哪个伪类用于鼠标悬停时的样式？",
      options: [
        {
          key: "A",
          text: ":hover"
        },
        {
          key: "B",
          text: ":active"
        },
        {
          key: "C",
          text: ":focus"
        },
        {
          key: "D",
          text: ":visited"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. :hover\n\n回答错误，正确答案是 :hover。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-13",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-3",
      type: "single",
      stem: "CSS3 中哪个伪类用于选中输入框时的样式？",
      options: [
        {
          key: "A",
          text: ":focus"
        },
        {
          key: "B",
          text: ":hover"
        },
        {
          key: "C",
          text: ":active"
        },
        {
          key: "D",
          text: ":checked"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. :focus\n\n回答错误，正确答案是 :focus。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-17",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-3",
      type: "single",
      stem: "CSS3 中哪个属性可用于多重背景？",
      options: [
        {
          key: "A",
          text: "background"
        },
        {
          key: "B",
          text: "background-image"
        },
        {
          key: "C",
          text: "backgrounds"
        },
        {
          key: "D",
          text: "multi-background"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. background-image\n\n回答错误，正确答案是 background-image。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-18",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-3",
      type: "single",
      stem: "CSS3 中哪个属性可用于设置弹性盒子主轴方向？",
      options: [
        {
          key: "A",
          text: "flex-direction"
        },
        {
          key: "B",
          text: "flex-align"
        },
        {
          key: "C",
          text: "flex-flow"
        },
        {
          key: "D",
          text: "flex-wrap"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. flex-direction\n\n回答错误，正确答案是 flex-direction。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-19",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-3",
      type: "single",
      stem: "CSS3 中哪个属性可用于设置弹性盒子换行？",
      options: [
        {
          key: "A",
          text: "flex-wrap"
        },
        {
          key: "B",
          text: "flex-flow"
        },
        {
          key: "C",
          text: "flex-direction"
        },
        {
          key: "D",
          text: "flex-break"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. flex-wrap\n\n回答错误，正确答案是 flex-wrap。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-8",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-4",
      type: "single",
      stem: "设置字体大小的 CSS 属性是？",
      options: [
        {
          key: "A",
          text: "font-size"
        },
        {
          key: "B",
          text: "text-size"
        },
        {
          key: "C",
          text: "size"
        },
        {
          key: "D",
          text: "font-style"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. font-size\n\n回答错误，正确答案是 font-size。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css-18",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-4",
      type: "single",
      stem: "CSS 中用于让元素浮动的属性是？",
      options: [
        {
          key: "A",
          text: "float"
        },
        {
          key: "B",
          text: "display"
        },
        {
          key: "C",
          text: "position"
        },
        {
          key: "D",
          text: "align"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. float\n\n回答错误，正确答案是 float。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-1",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-4",
      type: "single",
      stem: "CSS3 新增的圆角属性是？",
      options: [
        {
          key: "A",
          text: "border-corner"
        },
        {
          key: "B",
          text: "border-radius"
        },
        {
          key: "C",
          text: "corner-radius"
        },
        {
          key: "D",
          text: "radius"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. border-radius\n\n回答错误，正确答案是 border-radius。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-2",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-4",
      type: "single",
      stem: "CSS3 中用于添加阴影效果的属性是？",
      options: [
        {
          key: "A",
          text: "box-shadow"
        },
        {
          key: "B",
          text: "shadow"
        },
        {
          key: "C",
          text: "text-shadow"
        },
        {
          key: "D",
          text: "filter-shadow"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. box-shadow\n\n回答错误，正确答案是 box-shadow。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-4",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-4",
      type: "single",
      stem: "CSS3 中用于设置渐变背景的属性是？",
      options: [
        {
          key: "A",
          text: "background-gradient"
        },
        {
          key: "B",
          text: "gradient"
        },
        {
          key: "C",
          text: "background-image"
        },
        {
          key: "D",
          text: "background"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. background-image\n\n回答错误，正确答案是 background-image。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-5",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-4",
      type: "single",
      stem: "CSS3 中实现多列布局的属性是？",
      options: [
        {
          key: "A",
          text: "columns"
        },
        {
          key: "B",
          text: "multi-column"
        },
        {
          key: "C",
          text: "column-count"
        },
        {
          key: "D",
          text: "column"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. column-count\n\n回答错误，正确答案是 column-count。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-14",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-4",
      type: "single",
      stem: "CSS3 中哪个属性可用于设置背景图片的大小？",
      options: [
        {
          key: "A",
          text: "background-size"
        },
        {
          key: "B",
          text: "background-width"
        },
        {
          key: "C",
          text: "background-scale"
        },
        {
          key: "D",
          text: "background-fit"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. background-size\n\n回答错误，正确答案是 background-size。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-15",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-4",
      type: "single",
      stem: "CSS3 中哪个属性可用于设置圆形头像？",
      options: [
        {
          key: "A",
          text: "border-radius"
        },
        {
          key: "B",
          text: "border-circle"
        },
        {
          key: "C",
          text: "circle"
        },
        {
          key: "D",
          text: "radius"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. border-radius\n\n回答错误，正确答案是 border-radius。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-css3-16",
      stageKey: "rn-css-stage",
      topicKey: "rn-css-4",
      type: "single",
      stem: "CSS3 中哪个属性可用于自定义字体？",
      options: [
        {
          key: "A",
          text: "@font-face"
        },
        {
          key: "B",
          text: "font-family"
        },
        {
          key: "C",
          text: "font-style"
        },
        {
          key: "D",
          text: "font-weight"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. @font-face\n\n回答错误，正确答案是 @font-face。\n\n考点：CSS 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["CSS", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-1",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-1",
      type: "single",
      stem: "JavaScript 的变量声明关键字不包括？",
      options: [
        {
          key: "A",
          text: "var"
        },
        {
          key: "B",
          text: "let"
        },
        {
          key: "C",
          text: "const"
        },
        {
          key: "D",
          text: "int"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. int\n\n回答错误，正确答案是 int。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-2",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-1",
      type: "single",
      stem: "下列哪个是 JavaScript 的正确数据类型？",
      options: [
        {
          key: "A",
          text: "Number"
        },
        {
          key: "B",
          text: "String"
        },
        {
          key: "C",
          text: "Boolean"
        },
        {
          key: "D",
          text: "以上都是"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 以上都是\n\n回答错误，正确答案是 以上都是。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-18",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-1",
      type: "single",
      stem: "JavaScript 中用于定时执行代码的方法是？",
      options: [
        {
          key: "A",
          text: "setTimeout()"
        },
        {
          key: "B",
          text: "setInterval()"
        },
        {
          key: "C",
          text: "setTimer()"
        },
        {
          key: "D",
          text: "setDelay()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. setTimeout()\n\n回答错误，正确答案是 setTimeout()。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-11",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-2",
      type: "single",
      stem: "JavaScript 中 typeof null 的结果是？",
      options: [
        {
          key: "A",
          text: "object"
        },
        {
          key: "B",
          text: "null"
        },
        {
          key: "C",
          text: "undefined"
        },
        {
          key: "D",
          text: "boolean"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. object\n\n回答错误，正确答案是 object。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-12",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-2",
      type: "single",
      stem: "JavaScript 中判断变量是否为数组的方法是？",
      options: [
        {
          key: "A",
          text: "Array.isArray()"
        },
        {
          key: "B",
          text: "isArray()"
        },
        {
          key: "C",
          text: "typeof array"
        },
        {
          key: "D",
          text: "arrayType()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. Array.isArray()\n\n回答错误，正确答案是 Array.isArray()。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-20",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-2",
      type: "single",
      stem: "JavaScript 中严格相等运算符是？",
      options: [
        {
          key: "A",
          text: "==="
        },
        {
          key: "B",
          text: "=="
        },
        {
          key: "C",
          text: "="
        },
        {
          key: "D",
          text: "!="
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. ===\n\n回答错误，正确答案是 ===。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-5",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-3",
      type: "single",
      stem: "JavaScript 中用于获取用户输入的方法是？",
      options: [
        {
          key: "A",
          text: "prompt()"
        },
        {
          key: "B",
          text: "alert()"
        },
        {
          key: "C",
          text: "console.log()"
        },
        {
          key: "D",
          text: "input()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. prompt()\n\n回答错误，正确答案是 prompt()。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-10",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-3",
      type: "single",
      stem: "JavaScript 中字符串拼接可以使用哪个运算符？",
      options: [
        {
          key: "A",
          text: "+"
        },
        {
          key: "B",
          text: "-"
        },
        {
          key: "C",
          text: "*"
        },
        {
          key: "D",
          text: "&"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. +\n\n回答错误，正确答案是 +。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-13",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-3",
      type: "single",
      stem: "JavaScript 中函数声明的关键字是？",
      options: [
        {
          key: "A",
          text: "function"
        },
        {
          key: "B",
          text: "func"
        },
        {
          key: "C",
          text: "def"
        },
        {
          key: "D",
          text: "declare"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. function\n\n回答错误，正确答案是 function。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-6",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-4",
      type: "single",
      stem: "JavaScript 中用于判断条件的关键字是？",
      options: [
        {
          key: "A",
          text: "if"
        },
        {
          key: "B",
          text: "for"
        },
        {
          key: "C",
          text: "while"
        },
        {
          key: "D",
          text: "switch"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. if\n\n回答错误，正确答案是 if。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-7",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-4",
      type: "single",
      stem: "JavaScript 中用于循环的关键字不包括？",
      options: [
        {
          key: "A",
          text: "for"
        },
        {
          key: "B",
          text: "while"
        },
        {
          key: "C",
          text: "do"
        },
        {
          key: "D",
          text: "repeat"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. repeat\n\n回答错误，正确答案是 repeat。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-16",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-4",
      type: "single",
      stem: "JavaScript 中全局对象是？",
      options: [
        {
          key: "A",
          text: "window"
        },
        {
          key: "B",
          text: "document"
        },
        {
          key: "C",
          text: "global"
        },
        {
          key: "D",
          text: "this"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. window\n\n回答错误，正确答案是 window。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-3",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-5",
      type: "single",
      stem: "JavaScript 中用于输出内容到控制台的方法是？",
      options: [
        {
          key: "A",
          text: "console.log()"
        },
        {
          key: "B",
          text: "alert()"
        },
        {
          key: "C",
          text: "document.write()"
        },
        {
          key: "D",
          text: "prompt()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. console.log()\n\n回答错误，正确答案是 console.log()。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-17",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-5",
      type: "single",
      stem: "JavaScript 中获取元素的方法是？",
      options: [
        {
          key: "A",
          text: "getElementById()"
        },
        {
          key: "B",
          text: "getElement()"
        },
        {
          key: "C",
          text: "query()"
        },
        {
          key: "D",
          text: "findElement()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. getElementById()\n\n回答错误，正确答案是 getElementById()。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-4",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-6",
      type: "single",
      stem: "JavaScript 中用于弹出警告框的方法是？",
      options: [
        {
          key: "A",
          text: "alert()"
        },
        {
          key: "B",
          text: "prompt()"
        },
        {
          key: "C",
          text: "confirm()"
        },
        {
          key: "D",
          text: "console.log()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. alert()\n\n回答错误，正确答案是 alert()。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-19",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-6",
      type: "single",
      stem: "JavaScript 中用于将字符串转为整数的方法是？",
      options: [
        {
          key: "A",
          text: "parseInt()"
        },
        {
          key: "B",
          text: "parseFloat()"
        },
        {
          key: "C",
          text: "Number()"
        },
        {
          key: "D",
          text: "toInt()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. parseInt()\n\n回答错误，正确答案是 parseInt()。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-8",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-7",
      type: "single",
      stem: "JavaScript 中数组的下标从几开始？",
      options: [
        {
          key: "A",
          text: "0"
        },
        {
          key: "B",
          text: "1"
        },
        {
          key: "C",
          text: "-1"
        },
        {
          key: "D",
          text: "任意"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 0\n\n回答错误，正确答案是 0。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-9",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-7",
      type: "single",
      stem: "JavaScript 中获取数组长度的属性是？",
      options: [
        {
          key: "A",
          text: "size"
        },
        {
          key: "B",
          text: "length"
        },
        {
          key: "C",
          text: "count"
        },
        {
          key: "D",
          text: "number"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. length\n\n回答错误，正确答案是 length。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-14",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-7",
      type: "single",
      stem: "JavaScript 中用于终止循环的关键字是？",
      options: [
        {
          key: "A",
          text: "break"
        },
        {
          key: "B",
          text: "continue"
        },
        {
          key: "C",
          text: "stop"
        },
        {
          key: "D",
          text: "exit"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. break\n\n回答错误，正确答案是 break。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-javascript-15",
      stageKey: "rn-javascript-stage",
      topicKey: "rn-javascript-7",
      type: "single",
      stem: "JavaScript 中用于跳过本次循环的关键字是？",
      options: [
        {
          key: "A",
          text: "continue"
        },
        {
          key: "B",
          text: "break"
        },
        {
          key: "C",
          text: "skip"
        },
        {
          key: "D",
          text: "next"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. continue\n\n回答错误，正确答案是 continue。\n\n考点：JavaScript 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["JavaScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-1",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-1",
      type: "single",
      stem: "jQuery 是什么？",
      options: [
        {
          key: "A",
          text: "JavaScript 框架"
        },
        {
          key: "B",
          text: "JavaScript 库"
        },
        {
          key: "C",
          text: "CSS 框架"
        },
        {
          key: "D",
          text: "HTML 编辑器"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. JavaScript 库\n\n回答错误，jQuery 是 JavaScript 库。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-2",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-1",
      type: "single",
      stem: "jQuery 的核心选择符是？",
      options: [
        {
          key: "A",
          text: "$()"
        },
        {
          key: "B",
          text: "jQuery[]"
        },
        {
          key: "C",
          text: "select()"
        },
        {
          key: "D",
          text: "query()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. $()\n\n回答错误，jQuery 的核心选择符是 $()。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-6",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-1",
      type: "single",
      stem: "jQuery 中 $(document).ready() 的作用是？",
      options: [
        {
          key: "A",
          text: "页面加载完成后执行代码"
        },
        {
          key: "B",
          text: "页面关闭时执行代码"
        },
        {
          key: "C",
          text: "页面加载前执行代码"
        },
        {
          key: "D",
          text: "页面刷新时执行代码"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 页面加载完成后执行代码\n\n回答错误，$(document).ready() 用于页面加载完成后执行代码。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-10",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-1",
      type: "single",
      stem: "jQuery 中用于设置元素内容的方法是？",
      options: [
        {
          key: "A",
          text: "html()"
        },
        {
          key: "B",
          text: "text()"
        },
        {
          key: "C",
          text: "val()"
        },
        {
          key: "D",
          text: "content()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. html()\n\n回答错误，正确答案是 html()。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-11",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-1",
      type: "single",
      stem: "jQuery 中用于获取表单输入值的方法是？",
      options: [
        {
          key: "A",
          text: "val()"
        },
        {
          key: "B",
          text: "text()"
        },
        {
          key: "C",
          text: "html()"
        },
        {
          key: "D",
          text: "value()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. val()\n\n回答错误，正确答案是 val()。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-16",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-1",
      type: "single",
      stem: "jQuery 中用于绑定点击事件的方法是？",
      options: [
        {
          key: "A",
          text: "click()"
        },
        {
          key: "B",
          text: "onClick()"
        },
        {
          key: "C",
          text: "bindClick()"
        },
        {
          key: "D",
          text: "addClick()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. click()\n\n回答错误，正确答案是 click()。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-4",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-2",
      type: "single",
      stem: "jQuery 选择所有 class 为 box 的元素，正确写法是？",
      options: [
        {
          key: "A",
          text: "$('.box')"
        },
        {
          key: "B",
          text: "$('#box')"
        },
        {
          key: "C",
          text: "$(box)"
        },
        {
          key: "D",
          text: "$('box')"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. $('.box')\n\n回答错误，正确答案是 $('.box')。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-12",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-2",
      type: "single",
      stem: "jQuery 中用于设置 CSS 样式的方法是？",
      options: [
        {
          key: "A",
          text: "css()"
        },
        {
          key: "B",
          text: "style()"
        },
        {
          key: "C",
          text: "setStyle()"
        },
        {
          key: "D",
          text: "addCss()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. css()\n\n回答错误，正确答案是 css()。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-13",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-2",
      type: "single",
      stem: "jQuery 中用于添加类的方法是？",
      options: [
        {
          key: "A",
          text: "addClass()"
        },
        {
          key: "B",
          text: "addClassName()"
        },
        {
          key: "C",
          text: "appendClass()"
        },
        {
          key: "D",
          text: "setClass()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. addClass()\n\n回答错误，正确答案是 addClass()。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-14",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-2",
      type: "single",
      stem: "jQuery 中用于移除类的方法是？",
      options: [
        {
          key: "A",
          text: "removeClass()"
        },
        {
          key: "B",
          text: "deleteClass()"
        },
        {
          key: "C",
          text: "clearClass()"
        },
        {
          key: "D",
          text: "unsetClass()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. removeClass()\n\n回答错误，正确答案是 removeClass()。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-15",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-2",
      type: "single",
      stem: "jQuery 中用于切换类的方法是？",
      options: [
        {
          key: "A",
          text: "toggleClass()"
        },
        {
          key: "B",
          text: "switchClass()"
        },
        {
          key: "C",
          text: "changeClass()"
        },
        {
          key: "D",
          text: "swapClass()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. toggleClass()\n\n回答错误，正确答案是 toggleClass()。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-3",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-3",
      type: "single",
      stem: "jQuery 默认使用哪个符号作为别名？",
      options: [
        {
          key: "A",
          text: "$"
        },
        {
          key: "B",
          text: "#"
        },
        {
          key: "C",
          text: "&"
        },
        {
          key: "D",
          text: "%"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. $\n\n回答错误，jQuery 默认使用 $ 作为别名。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-5",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-3",
      type: "single",
      stem: "jQuery 选择 id 为 main 的元素，正确写法是？",
      options: [
        {
          key: "A",
          text: "$('#main')"
        },
        {
          key: "B",
          text: "$('.main')"
        },
        {
          key: "C",
          text: "$(main)"
        },
        {
          key: "D",
          text: "$('main')"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. $('#main')\n\n回答错误，正确答案是 $('#main')。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-7",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-3",
      type: "single",
      stem: "jQuery 中用于隐藏元素的方法是？",
      options: [
        {
          key: "A",
          text: "hide()"
        },
        {
          key: "B",
          text: "show()"
        },
        {
          key: "C",
          text: "display()"
        },
        {
          key: "D",
          text: "invisible()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. hide()\n\n回答错误，正确答案是 hide()。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-8",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-3",
      type: "single",
      stem: "jQuery 中用于显示隐藏元素的方法是？",
      options: [
        {
          key: "A",
          text: "show()"
        },
        {
          key: "B",
          text: "hide()"
        },
        {
          key: "C",
          text: "display()"
        },
        {
          key: "D",
          text: "visible()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. show()\n\n回答错误，正确答案是 show()。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-9",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-3",
      type: "single",
      stem: "jQuery 中用于切换显示/隐藏的方法是？",
      options: [
        {
          key: "A",
          text: "toggle()"
        },
        {
          key: "B",
          text: "switch()"
        },
        {
          key: "C",
          text: "change()"
        },
        {
          key: "D",
          text: "swap()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. toggle()\n\n回答错误，正确答案是 toggle()。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-17",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-4",
      type: "single",
      stem: "jQuery 中用于遍历元素的方法是？",
      options: [
        {
          key: "A",
          text: "each()"
        },
        {
          key: "B",
          text: "forEach()"
        },
        {
          key: "C",
          text: "loop()"
        },
        {
          key: "D",
          text: "traverse()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. each()\n\n回答错误，正确答案是 each()。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-18",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-4",
      type: "single",
      stem: "jQuery 中用于获取父元素的方法是？",
      options: [
        {
          key: "A",
          text: "parent()"
        },
        {
          key: "B",
          text: "parents()"
        },
        {
          key: "C",
          text: "father()"
        },
        {
          key: "D",
          text: "getParent()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. parent()\n\n回答错误，正确答案是 parent()。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-19",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-4",
      type: "single",
      stem: "jQuery 中用于获取所有祖先元素的方法是？",
      options: [
        {
          key: "A",
          text: "parents()"
        },
        {
          key: "B",
          text: "parent()"
        },
        {
          key: "C",
          text: "ancestors()"
        },
        {
          key: "D",
          text: "getParents()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. parents()\n\n回答错误，正确答案是 parents()。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-jquery-20",
      stageKey: "rn-jquery-stage",
      topicKey: "rn-jquery-4",
      type: "single",
      stem: "jQuery 中用于发起 AJAX 请求的方法是？",
      options: [
        {
          key: "A",
          text: "$.ajax()"
        },
        {
          key: "B",
          text: "$.get()"
        },
        {
          key: "C",
          text: "$.post()"
        },
        {
          key: "D",
          text: "以上都是"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 以上都是\n\n回答错误，正确答案是 以上都是。\n\n考点：jQuery 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["jQuery", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-4",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-1",
      type: "single",
      stem: "TypeScript 是哪个公司开发的？",
      options: [
        {
          key: "A",
          text: "苹果"
        },
        {
          key: "B",
          text: "Sun"
        },
        {
          key: "C",
          text: "微软"
        },
        {
          key: "D",
          text: "甲骨文"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. 微软\n\n回答错误，TypeScript是一种开源的编程语言，该语言项目由微软进行维护和管理。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-10",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-1",
      type: "single",
      stem: "TypeScript 代码最终会被编译成？",
      options: [
        {
          key: "A",
          text: "Java"
        },
        {
          key: "B",
          text: "JavaScript"
        },
        {
          key: "C",
          text: "C++"
        },
        {
          key: "D",
          text: "Python"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. JavaScript\n\n回答错误，TypeScript 会被编译成 JavaScript。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-12",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-1",
      type: "single",
      stem: "TypeScript 中如何定义字符串类型变量？",
      options: [
        {
          key: "A",
          text: "let str: string;"
        },
        {
          key: "B",
          text: "let str = string;"
        },
        {
          key: "C",
          text: "string str;"
        },
        {
          key: "D",
          text: "let str: String;"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. let str: string;\n\n回答错误，正确答案是 let str: string;。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-25",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-1",
      type: "single",
      stem: "TypeScript 中如何声明一个 never 类型的函数？",
      options: [
        {
          key: "A",
          text: "function fn(): never {}"
        },
        {
          key: "B",
          text: "function fn(): void {}"
        },
        {
          key: "C",
          text: "function fn(): any {}"
        },
        {
          key: "D",
          text: "function fn(): null {}"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. function fn(): never {}\n\n回答错误，正确答案是 function fn(): never {}。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-2",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-2",
      type: "single",
      stem: "TypeScript 语言第一个版本是哪一年发行的？",
      options: [
        {
          key: "A",
          text: "2012年10月1日"
        },
        {
          key: "B",
          text: "2008年10月1日"
        },
        {
          key: "C",
          text: "2006年10月1日"
        },
        {
          key: "D",
          text: "2004年10月1日"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 2012年10月1日\n\n回答错误，TypeScript于2012年10月首次发布0.8版本。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-11",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-2",
      type: "single",
      stem: "TypeScript 中声明变量推荐使用哪个关键字？",
      options: [
        {
          key: "A",
          text: "var"
        },
        {
          key: "B",
          text: "let"
        },
        {
          key: "C",
          text: "const"
        },
        {
          key: "D",
          text: "static"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. const\n\n回答错误，推荐使用 const。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-17",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-2",
      type: "single",
      stem: "TypeScript 中可选参数的写法是？",
      options: [
        {
          key: "A",
          text: "param?"
        },
        {
          key: "B",
          text: "?param"
        },
        {
          key: "C",
          text: "param:optional"
        },
        {
          key: "D",
          text: "optional param"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. param?\n\n回答错误，正确答案是 param?。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-23",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-2",
      type: "single",
      stem: "TypeScript 中如何导入模块？",
      options: [
        {
          key: "A",
          text: "import ... from ..."
        },
        {
          key: "B",
          text: "require(...)"
        },
        {
          key: "C",
          text: "include ..."
        },
        {
          key: "D",
          text: "using ..."
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. import ... from ...\n\n回答错误，正确答案是 import ... from ...。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-7",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-3",
      type: "single",
      stem: "TypeScript 输出 \"Hello, world!\" 正确的是？",
      options: [
        {
          key: "A",
          text: "cout << \"Hello, world!\" << endl;"
        },
        {
          key: "B",
          text: "console.print << \"Hello, world!\""
        },
        {
          key: "C",
          text: "print \"Hello, world!\""
        },
        {
          key: "D",
          text: "console.log(\"Hello, world!\")"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. console.log(\"Hello, world!\")\n\n本题考查「TypeScript 输出 \"Hello, world!\" 正确的是？」，正确答案是 console.log(\"Hello, world!\")。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-16",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-3",
      type: "single",
      stem: "TypeScript 中类型断言的语法是？",
      options: [
        {
          key: "A",
          text: "value as type"
        },
        {
          key: "B",
          text: "type as value"
        },
        {
          key: "C",
          text: "assert type value"
        },
        {
          key: "D",
          text: "type:value"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. value as type\n\n回答错误，正确答案是 value as type。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-22",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-3",
      type: "single",
      stem: "TypeScript 中如何让一个属性可选？",
      options: [
        {
          key: "A",
          text: "在属性名后加 ?"
        },
        {
          key: "B",
          text: "用 optional 关键字"
        },
        {
          key: "C",
          text: "用 maybe 关键字"
        },
        {
          key: "D",
          text: "用 undefined"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 在属性名后加 ?\n\n回答错误，正确答案是在属性名后加 ?。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-24",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-3",
      type: "single",
      stem: "TypeScript 中如何定义枚举？",
      options: [
        {
          key: "A",
          text: "enum"
        },
        {
          key: "B",
          text: "enumeration"
        },
        {
          key: "C",
          text: "enumtype"
        },
        {
          key: "D",
          text: "enum()"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. enum\n\n回答错误，正确答案是 enum。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-26",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-3",
      type: "single",
      stem: "TypeScript 中下列哪个不是基本类型？",
      options: [
        {
          key: "A",
          text: "number"
        },
        {
          key: "B",
          text: "string"
        },
        {
          key: "C",
          text: "boolean"
        },
        {
          key: "D",
          text: "object"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. object\n\n回答错误，object 不是基本类型。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-1",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-4",
      type: "single",
      stem: "TypeScript 是什么？",
      options: [
        {
          key: "A",
          text: "TypeScript 是 JavaScript 的另外一个称呼"
        },
        {
          key: "B",
          text: "TypeScript 是 js 框架"
        },
        {
          key: "C",
          text: "TypeScript 是 JavaScript 的一个超集"
        },
        {
          key: "D",
          text: "以上都是"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. TypeScript 是 JavaScript 的一个超集\n\n回答错误，TypeScript 是 JavaScript 的一个超集，支持 ECMAScript 6 标准（ES6 教程）。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-15",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-4",
      type: "single",
      stem: "TypeScript 中联合类型的写法是？",
      options: [
        {
          key: "A",
          text: "number|string"
        },
        {
          key: "B",
          text: "number|string[]"
        },
        {
          key: "C",
          text: "number|or|string"
        },
        {
          key: "D",
          text: "number or string"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. number|string\n\n回答错误，正确答案是 number|string。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-18",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-4",
      type: "single",
      stem: "TypeScript 中泛型的语法是？",
      options: [
        {
          key: "A",
          text: "function<T>()"
        },
        {
          key: "B",
          text: "function<T> {}"
        },
        {
          key: "C",
          text: "function(T)"
        },
        {
          key: "D",
          text: "function<T>[]"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. function<T>()\n\n回答错误，正确答案是 function<T>()。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-19",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-4",
      type: "single",
      stem: "TypeScript 中如何定义只读属性？",
      options: [
        {
          key: "A",
          text: "readonly"
        },
        {
          key: "B",
          text: "const"
        },
        {
          key: "C",
          text: "static"
        },
        {
          key: "D",
          text: "final"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. readonly\n\n回答错误，正确答案是 readonly。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-20",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-4",
      type: "single",
      stem: "TypeScript 中数组类型的写法是？",
      options: [
        {
          key: "A",
          text: "number[]"
        },
        {
          key: "B",
          text: "Array<number>"
        },
        {
          key: "C",
          text: "两者都可以"
        },
        {
          key: "D",
          text: "只能用 number[]"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. 两者都可以\n\n回答错误，number[] 和 Array<number> 都可以。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-3",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-5",
      type: "single",
      stem: "TypeScript 语言的文件名后缀是？",
      options: [
        {
          key: "A",
          text: ".t"
        },
        {
          key: "B",
          text: ".ts"
        },
        {
          key: "C",
          text: ".tt"
        },
        {
          key: "D",
          text: ".js"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. .ts\n\nTypeScript 语言的文件名后缀是 <strong>.ts</strong>。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-5",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-5",
      type: "single",
      stem: "TypeScript 可转译成 JavaScript？",
      options: [
        {
          key: "A",
          text: "正确"
        },
        {
          key: "B",
          text: "错误"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 正确\n\n本题考查「TypeScript 可转译成 JavaScript？」，正确答案是 正确。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-8",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-5",
      type: "single",
      stem: "TypeScript 支持面向对象？",
      options: [
        {
          key: "A",
          text: "正确"
        },
        {
          key: "B",
          text: "错误"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 正确\n\n本题考查「TypeScript 支持面向对象？」，正确答案是 正确。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-13",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-5",
      type: "single",
      stem: "TypeScript 支持哪种面向对象特性？",
      options: [
        {
          key: "A",
          text: "类"
        },
        {
          key: "B",
          text: "接口"
        },
        {
          key: "C",
          text: "继承"
        },
        {
          key: "D",
          text: "以上都是"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 以上都是\n\n回答错误，TypeScript 支持类、接口和继承。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-14",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-5",
      type: "single",
      stem: "TypeScript 中接口的关键字是？",
      options: [
        {
          key: "A",
          text: "interface"
        },
        {
          key: "B",
          text: "implements"
        },
        {
          key: "C",
          text: "protocol"
        },
        {
          key: "D",
          text: "type"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. interface\n\n回答错误，正确答案是 interface。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-6",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-6",
      type: "single",
      stem: "TypeScript 支持 ECMAScript 6 标准？",
      options: [
        {
          key: "A",
          text: "正确"
        },
        {
          key: "B",
          text: "错误"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 正确\n\n回答错误，TypeScript 添加了ECMAScript 2015标准中定义的类、模块和箭头函数等语法的支持。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-9",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-6",
      type: "single",
      stem: "TypeScript 最主要的特性是？",
      options: [
        {
          key: "A",
          text: "类型系统"
        },
        {
          key: "B",
          text: "更快的运行速度"
        },
        {
          key: "C",
          text: "更小的文件体积"
        },
        {
          key: "D",
          text: "更好的动画支持"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 类型系统\n\n回答错误，TypeScript 最主要的特性是类型系统。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-ts-21",
      stageKey: "rn-typescript-stage",
      topicKey: "rn-typescript-6",
      type: "single",
      stem: "TypeScript 中类型别名的关键字是？",
      options: [
        {
          key: "A",
          text: "alias"
        },
        {
          key: "B",
          text: "type"
        },
        {
          key: "C",
          text: "typedef"
        },
        {
          key: "D",
          text: "as"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. type\n\n回答错误，正确答案是 type。\n\n考点：TypeScript 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["TypeScript", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-1",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-1",
      type: "single",
      stem: "Vue 3 是什么？",
      options: [
        {
          key: "A",
          text: "一种后端框架"
        },
        {
          key: "B",
          text: "一种数据库"
        },
        {
          key: "C",
          text: "一种前端框架"
        },
        {
          key: "D",
          text: "一种操作系统"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. 一种前端框架\n\n回答错误，Vue 3 是一种前端框架。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-3",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-1",
      type: "single",
      stem: "Vue 3 中的 Composition API 是用来做什么的？",
      options: [
        {
          key: "A",
          text: "定义路由"
        },
        {
          key: "B",
          text: "管理样式"
        },
        {
          key: "C",
          text: "操作 DOM"
        },
        {
          key: "D",
          text: "定义组件的逻辑和状态"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 定义组件的逻辑和状态\n\n回答错误，Composition API 用于定义组件的逻辑和状态。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-4",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-1",
      type: "single",
      stem: "Vue 3 中的模板语法使用什么符号来插值数据？",
      options: [
        {
          key: "A",
          text: "[[]]"
        },
        {
          key: "B",
          text: "<%= %>"
        },
        {
          key: "C",
          text: "{{ }}"
        },
        {
          key: "D",
          text: "${ }"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. {{ }}\n\n回答错误，Vue 3 的模板语法使用 {{ }} 来插值数据。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-10",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-1",
      type: "single",
      stem: "Vue 3 中的路由管理通常使用哪个库？",
      options: [
        {
          key: "A",
          text: "Vuex"
        },
        {
          key: "B",
          text: "React Router"
        },
        {
          key: "C",
          text: "Angular Router"
        },
        {
          key: "D",
          text: "Vue Router"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. Vue Router\n\n回答错误，Vue 3 的路由管理通常使用 Vue Router。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-20",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-1",
      type: "single",
      stem: "Vue 3 中的 Fragment 是用来做什么的？",
      options: [
        {
          key: "A",
          text: "支持多个根节点"
        },
        {
          key: "B",
          text: "定义路由"
        },
        {
          key: "C",
          text: "管理样式"
        },
        {
          key: "D",
          text: "操作 DOM"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 支持多个根节点\n\n回答错误，Fragment 用于支持多个根节点。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-6",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-2",
      type: "single",
      stem: "Vue 3 中用于绑定事件的指令是？",
      options: [
        {
          key: "A",
          text: "v-bind"
        },
        {
          key: "B",
          text: "v-if"
        },
        {
          key: "C",
          text: "v-for"
        },
        {
          key: "D",
          text: "v-on"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. v-on\n\n回答错误，Vue 3 中用于绑定事件的指令是 v-on。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-9",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-2",
      type: "single",
      stem: "Vue 3 中的单文件组件的默认扩展名是？",
      options: [
        {
          key: "A",
          text: ".js"
        },
        {
          key: "B",
          text: ".html"
        },
        {
          key: "C",
          text: ".vue"
        },
        {
          key: "D",
          text: ".jsx"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. .vue\n\n回答错误，Vue 3 的单文件组件默认扩展名是 .vue。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-11",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-2",
      type: "single",
      stem: "Vue 3 中的 v-bind 指令的作用是什么？",
      options: [
        {
          key: "A",
          text: "绑定事件"
        },
        {
          key: "B",
          text: "绑定属性或样式"
        },
        {
          key: "C",
          text: "条件渲染"
        },
        {
          key: "D",
          text: "循环渲染"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. 绑定属性或样式\n\n回答错误，v-bind 用于绑定属性或样式。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-13",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-2",
      type: "single",
      stem: "Vue 3 中的 v-model 指令用于？",
      options: [
        {
          key: "A",
          text: "双向数据绑定"
        },
        {
          key: "B",
          text: "单向数据绑定"
        },
        {
          key: "C",
          text: "事件绑定"
        },
        {
          key: "D",
          text: "样式绑定"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 双向数据绑定\n\n回答错误，v-model 用于双向数据绑定。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-19",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-2",
      type: "single",
      stem: "Vue 3 中的 Teleport 是用来做什么的？",
      options: [
        {
          key: "A",
          text: "定义路由"
        },
        {
          key: "B",
          text: "管理样式"
        },
        {
          key: "C",
          text: "操作 DOM"
        },
        {
          key: "D",
          text: "将组件渲染到 DOM 的其他位置"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 将组件渲染到 DOM 的其他位置\n\n回答错误，Teleport 用于将组件渲染到 DOM 的其他位置。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-5",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-3",
      type: "single",
      stem: "Vue 3 中的生命周期钩子之一是？",
      options: [
        {
          key: "A",
          text: "onStart"
        },
        {
          key: "B",
          text: "onMounted"
        },
        {
          key: "C",
          text: "onCreate"
        },
        {
          key: "D",
          text: "onInit"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. onMounted\n\n回答错误，Vue 3 的生命周期钩子之一是 onMounted。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-7",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-3",
      type: "single",
      stem: "Vue 3 中如何定义一个响应式数据？",
      options: [
        {
          key: "A",
          text: "使用 state"
        },
        {
          key: "B",
          text: "使用 props"
        },
        {
          key: "C",
          text: "使用 ref 或 reactive"
        },
        {
          key: "D",
          text: "使用 data"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. 使用 ref 或 reactive\n\n回答错误，Vue 3 中可以使用 ref 或 reactive 定义响应式数据。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-8",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-3",
      type: "single",
      stem: "Vue 3 中的 v-for 指令用于？",
      options: [
        {
          key: "A",
          text: "绑定样式"
        },
        {
          key: "B",
          text: "循环渲染列表"
        },
        {
          key: "C",
          text: "条件渲染"
        },
        {
          key: "D",
          text: "绑定事件"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. 循环渲染列表\n\n回答错误，v-for 指令用于循环渲染列表。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-15",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-3",
      type: "single",
      stem: "Vue 3 中的 computed 是用来做什么的？",
      options: [
        {
          key: "A",
          text: "定义响应式数据"
        },
        {
          key: "B",
          text: "绑定事件"
        },
        {
          key: "C",
          text: "操作 DOM"
        },
        {
          key: "D",
          text: "定义计算属性"
        }
      ],
      answer: ["D"],
      explanation: "正确答案：D. 定义计算属性\n\n回答错误，computed 用于定义计算属性。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-14",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-4",
      type: "single",
      stem: "Vue 3 中的 watch 是用来做什么的？",
      options: [
        {
          key: "A",
          text: "监听数据变化"
        },
        {
          key: "B",
          text: "定义组件"
        },
        {
          key: "C",
          text: "绑定事件"
        },
        {
          key: "D",
          text: "操作 DOM"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 监听数据变化\n\n回答错误，watch 用于监听数据变化。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-16",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-4",
      type: "single",
      stem: "Vue 3 中的 props 是用来做什么的？",
      options: [
        {
          key: "A",
          text: "传递数据给子组件"
        },
        {
          key: "B",
          text: "定义响应式数据"
        },
        {
          key: "C",
          text: "绑定事件"
        },
        {
          key: "D",
          text: "操作 DOM"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 传递数据给子组件\n\n回答错误，props 用于传递数据给子组件。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-17",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-4",
      type: "single",
      stem: "Vue 3 中的 emits 是用来做什么的？",
      options: [
        {
          key: "A",
          text: "定义响应式数据"
        },
        {
          key: "B",
          text: "操作 DOM"
        },
        {
          key: "C",
          text: "子组件向父组件发送事件"
        },
        {
          key: "D",
          text: "父组件向子组件传递数据"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. 子组件向父组件发送事件\n\n回答错误，emits 用于子组件向父组件发送事件。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-2",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-5",
      type: "single",
      stem: "Vue 3 的核心概念是什么？",
      options: [
        {
          key: "A",
          text: "模块"
        },
        {
          key: "B",
          text: "组件"
        },
        {
          key: "C",
          text: "服务"
        },
        {
          key: "D",
          text: "控制器"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. 组件\n\n回答错误，Vue 3 的核心概念是组件。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-12",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-5",
      type: "single",
      stem: "Vue 3 中的 v-if 指令用于？",
      options: [
        {
          key: "A",
          text: "条件渲染"
        },
        {
          key: "B",
          text: "循环渲染"
        },
        {
          key: "C",
          text: "绑定事件"
        },
        {
          key: "D",
          text: "绑定样式"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 条件渲染\n\n回答错误，v-if 指令用于条件渲染。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-vue3-18",
      stageKey: "rn-vue3-stage",
      topicKey: "rn-vue3-5",
      type: "single",
      stem: "Vue 3 中的 setup 函数是用来做什么的？",
      options: [
        {
          key: "A",
          text: "初始化组件逻辑"
        },
        {
          key: "B",
          text: "定义路由"
        },
        {
          key: "C",
          text: "管理样式"
        },
        {
          key: "D",
          text: "操作 DOM"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 初始化组件逻辑\n\n回答错误，setup 函数用于初始化组件逻辑。\n\n考点：Vue 3 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["Vue 3", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-1",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-1",
      type: "single",
      stem: "XML 的全称是什么？",
      options: [
        {
          key: "A",
          text: "eXtensible Markup Language"
        },
        {
          key: "B",
          text: "eXtra Modern Language"
        },
        {
          key: "C",
          text: "Example Markup Language"
        },
        {
          key: "D",
          text: "Excellent Markup Language"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. eXtensible Markup Language\n\n回答错误，正确答案是 eXtensible Markup Language。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-3",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-1",
      type: "single",
      stem: "下列哪个是合法的 XML 声明？",
      options: [
        {
          key: "A",
          text: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
        },
        {
          key: "B",
          text: "<xml version=\"1.0\">"
        },
        {
          key: "C",
          text: "<?xml 1.0 UTF-8?>"
        },
        {
          key: "D",
          text: "<?xml version=1.0 encoding=UTF-8>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\n回答错误，正确答案是 <?xml version=\"1.0\" encoding=\"UTF-8\"?>。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-5",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-1",
      type: "single",
      stem: "XML 标签的命名规则，以下哪项是正确的？",
      options: [
        {
          key: "A",
          text: "可以以数字开头"
        },
        {
          key: "B",
          text: "区分大小写"
        },
        {
          key: "C",
          text: "可以包含空格"
        },
        {
          key: "D",
          text: "可以以 xml 开头"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. 区分大小写\n\n回答错误，XML 标签区分大小写。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-6",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-1",
      type: "single",
      stem: "下列哪个是合法的 XML 标签？",
      options: [
        {
          key: "A",
          text: "<data-item>"
        },
        {
          key: "B",
          text: "<data item>"
        },
        {
          key: "C",
          text: "<data.item>"
        },
        {
          key: "D",
          text: "<data:item>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <data-item>\n\n回答错误，正确答案是 <data-item>。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-7",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-1",
      type: "single",
      stem: "XML 属性值必须？",
      options: [
        {
          key: "A",
          text: "用引号括起来"
        },
        {
          key: "B",
          text: "可以不加引号"
        },
        {
          key: "C",
          text: "用单引号或双引号都不行"
        },
        {
          key: "D",
          text: "只能用单引号"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 用引号括起来\n\n回答错误，XML 属性值必须用引号括起来。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-16",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-1",
      type: "single",
      stem: "下列关于 XML 的说法正确的是？",
      options: [
        {
          key: "A",
          text: "标签必须正确嵌套"
        },
        {
          key: "B",
          text: "标签可以不闭合"
        },
        {
          key: "C",
          text: "属性可以没有值"
        },
        {
          key: "D",
          text: "标签名不区分大小写"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 标签必须正确嵌套\n\n回答错误，XML 标签必须正确嵌套。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-20",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-1",
      type: "single",
      stem: "下列哪个不是 XML 的优点？",
      options: [
        {
          key: "A",
          text: "可扩展性强"
        },
        {
          key: "B",
          text: "可自定义标签"
        },
        {
          key: "C",
          text: "体积小，传输快"
        },
        {
          key: "D",
          text: "平台无关"
        }
      ],
      answer: ["C"],
      explanation: "正确答案：C. 体积小，传输快\n\n回答错误，XML 体积较大，传输速度不如 JSON。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-2",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-2",
      type: "single",
      stem: "XML 的主要作用是？",
      options: [
        {
          key: "A",
          text: "显示网页内容"
        },
        {
          key: "B",
          text: "存储和传输数据"
        },
        {
          key: "C",
          text: "制作动画"
        },
        {
          key: "D",
          text: "美化网页"
        }
      ],
      answer: ["B"],
      explanation: "正确答案：B. 存储和传输数据\n\n回答错误，XML 主要用于存储和传输数据。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-4",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-2",
      type: "single",
      stem: "XML 文档的根元素是什么？",
      options: [
        {
          key: "A",
          text: "只能有一个"
        },
        {
          key: "B",
          text: "可以有多个"
        },
        {
          key: "C",
          text: "必须是 <root>"
        },
        {
          key: "D",
          text: "必须是 <xml>"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 只能有一个\n\n回答错误，XML 文档只能有一个根元素。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-8",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-2",
      type: "single",
      stem: "XML 文档必须？",
      options: [
        {
          key: "A",
          text: "有且只有一个根元素"
        },
        {
          key: "B",
          text: "有多个根元素"
        },
        {
          key: "C",
          text: "没有根元素也可以"
        },
        {
          key: "D",
          text: "根元素可选"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. 有且只有一个根元素\n\n回答错误，XML 文档必须有且只有一个根元素。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-9",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-2",
      type: "single",
      stem: "XML 注释的正确写法是？",
      options: [
        {
          key: "A",
          text: "<!-- 注释内容 -->"
        },
        {
          key: "B",
          text: "// 注释内容"
        },
        {
          key: "C",
          text: "# 注释内容"
        },
        {
          key: "D",
          text: "<! 注释内容 >"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <!-- 注释内容 -->\n\n回答错误，正确答案是 <!-- 注释内容 -->。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-11",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-2",
      type: "single",
      stem: "XML 与 HTML 的主要区别是？",
      options: [
        {
          key: "A",
          text: "XML 可自定义标签，HTML 不可"
        },
        {
          key: "B",
          text: "HTML 可自定义标签，XML 不可"
        },
        {
          key: "C",
          text: "都不可自定义标签"
        },
        {
          key: "D",
          text: "都可自定义标签"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. XML 可自定义标签，HTML 不可\n\n回答错误，XML 可自定义标签，HTML 不可。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-12",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-2",
      type: "single",
      stem: "XML 文档的文件扩展名通常是？",
      options: [
        {
          key: "A",
          text: ".xml"
        },
        {
          key: "B",
          text: ".html"
        },
        {
          key: "C",
          text: ".json"
        },
        {
          key: "D",
          text: ".css"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. .xml\n\n回答错误，正确答案是 .xml。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-10",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-3",
      type: "single",
      stem: "XML 中用于定义数据结构和约束的语言是？",
      options: [
        {
          key: "A",
          text: "DTD 或 XML Schema"
        },
        {
          key: "B",
          text: "CSS"
        },
        {
          key: "C",
          text: "HTML"
        },
        {
          key: "D",
          text: "JSON"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. DTD 或 XML Schema\n\n回答错误，正确答案是 DTD 或 XML Schema。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-13",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-3",
      type: "single",
      stem: "XML 中实体引用 &lt; 表示什么？",
      options: [
        {
          key: "A",
          text: "<"
        },
        {
          key: "B",
          text: ">"
        },
        {
          key: "C",
          text: "&"
        },
        {
          key: "D",
          text: "\""
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. <\n\n回答错误，&lt; 表示 <。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-14",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-3",
      type: "single",
      stem: "XML 中用于描述数据的数据结构的文件是？",
      options: [
        {
          key: "A",
          text: "DTD 或 XSD"
        },
        {
          key: "B",
          text: "CSS"
        },
        {
          key: "C",
          text: "JS"
        },
        {
          key: "D",
          text: "SVG"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. DTD 或 XSD\n\n回答错误，正确答案是 DTD 或 XSD。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "easy",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-15",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-3",
      type: "single",
      stem: "XML 可以与哪种技术结合实现数据转换？",
      options: [
        {
          key: "A",
          text: "XSLT"
        },
        {
          key: "B",
          text: "CSS"
        },
        {
          key: "C",
          text: "PHP"
        },
        {
          key: "D",
          text: "SQL"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. XSLT\n\n回答错误，正确答案是 XSLT。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-17",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-3",
      type: "single",
      stem: "XML 文档声明的编码格式通常为？",
      options: [
        {
          key: "A",
          text: "UTF-8"
        },
        {
          key: "B",
          text: "GBK"
        },
        {
          key: "C",
          text: "ASCII"
        },
        {
          key: "D",
          text: "ISO-8859-1"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. UTF-8\n\n回答错误，常用编码格式为 UTF-8。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-18",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-3",
      type: "single",
      stem: "XML 中用于唯一标识元素的属性是？",
      options: [
        {
          key: "A",
          text: "id"
        },
        {
          key: "B",
          text: "name"
        },
        {
          key: "C",
          text: "class"
        },
        {
          key: "D",
          text: "type"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. id\n\n回答错误，正确答案是 id。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["XML", "菜鸟教程", "选择题"],
      sourceKey: "runoob-com"
    },
    {
      key: "rn-xml-19",
      stageKey: "rn-xml-stage",
      topicKey: "rn-xml-3",
      type: "single",
      stem: "XML 文档可以通过什么方式校验结构？",
      options: [
        {
          key: "A",
          text: "DTD 或 XML Schema"
        },
        {
          key: "B",
          text: "CSS"
        },
        {
          key: "C",
          text: "JS"
        },
        {
          key: "D",
          text: "HTML"
        }
      ],
      answer: ["A"],
      explanation: "正确答案：A. DTD 或 XML Schema\n\n回答错误，正确答案是 DTD 或 XML Schema。\n\n考点：XML 教程。可回到对应知识点原文复习。",
      difficulty: "medium",
      tags: ["XML", "菜鸟教程", "选择题"],
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
