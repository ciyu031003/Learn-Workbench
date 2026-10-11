import assert from "node:assert/strict";
import test from "node:test";

import {
  extractQuizData,
  findUnsafe,
  parseJsLiteral,
  parseTutorialPage,
  tutorialPages,
} from "./runoob.mjs";

test("parseJsLiteral：单/双引号、无引号键、尾随逗号都能读", () => {
  const src = `
    const quizData = {
      title: '演示',
      questions: [
        { 'q': 'A 还是 B？', options: ["一", '二'], correctIndex: 1, },
        { q: "换行\\n与转义", options: ["x", "y"], correctIndex: 0 },
      ],
    };`;
  const { value } = parseJsLiteral(src);
  assert.equal(value.title, "演示");
  assert.equal(value.questions.length, 2);
  assert.equal(value.questions[0].correctIndex, 1);
  assert.equal(value.questions[1].q, "换行\n与转义");
});

test("extractQuizData：读出题干/选项/正确下标，并解 HTML 实体", () => {
  const html = `<html><body><script>
    const quizData = {
      title: "HTML - 测验",
      description: "测试你的了解",
      questions: [
        { 'q': '用于插入图片的标签是？', 'options': ['&lt;img&gt;', '&lt;image&gt;', '&lt;pic&gt;'], 'correctIndex': 0,
          'correctResponse': '回答正确。', 'incorrectResponse': '回答错误，正确答案为 &lt;img&gt;。' },
      ],
    };
  </script></body></html>`;
  const data = extractQuizData(html);
  assert.equal(data.title, "HTML - 测验");
  assert.equal(data.questions.length, 1);
  assert.deepEqual(data.questions[0].options, ["<img>", "<image>", "<pic>"]);
  assert.equal(data.questions[0].correctIndex, 0);
  assert.match(data.questions[0].incorrectResponse, /<img>/);
});

test("extractQuizData：没有 quizData 时返回 null", () => {
  assert.equal(extractQuizData("<html><body>无</body></html>"), null);
});

test("parseTutorialPage：分节、正文、<pre> 与 div.example_code 代码都抽出来", () => {
  const html = `<html><body>
    <h1>CSS 教程</h1>
    <div id="content">
      <h1>CSS 教程</h1>
      <p>CSS 是层叠样式表。</p>
      <h2>CSS 语法</h2>
      <p>规则由选择器和声明块组成。</p>
      <pre>body {
  color: red;
}</pre>
      <h2>输入框样式</h2>
      <p>用 width 设置宽度：</p>
      <div class="example"><h2 class="example_head">CSS 实例</h2>
        <div class="example_code"><div class="hl-main"><span class="hl-identifier">input</span><span class="hl-code"> </span><span class="hl-brackets">{</span><span class="hl-code">
  </span><span class="hl-reserved">width:</span><span class="hl-code"> </span><span class="hl-number">100</span><span class="hl-string">%</span><span class="hl-code">;
</span><span class="hl-brackets">}</span></div></div>
      </div>
      <h3>点我分享笔记</h3><p>噪声内容，必须被过滤。</p>
    </div>
  </body></html>`;
  const page = parseTutorialPage(html);
  assert.equal(page.title, "CSS 教程");
  const headings = page.sections.map((section) => section.heading);
  assert.ok(headings.includes("CSS 语法"));
  assert.ok(headings.includes("输入框样式"));
  assert.ok(!headings.some((heading) => /分享笔记/.test(heading)), "噪声小节必须被过滤");

  const syntax = page.sections.find((section) => section.heading === "CSS 语法");
  assert.match(syntax.text, /层叠样式表|选择器和声明块/);
  assert.match(syntax.codes[0], /color: red;/);

  const form = page.sections.find((section) => section.heading === "输入框样式");
  const code = form.codes[0];
  assert.match(code, /width: 100%;/, "example_code 的词间空格不能丢");
  assert.ok(!/<[a-z]/i.test(code), "example_code 里不应残留标签");
});

test("tutorialPages：只取左侧栏的同目录 .html 页（相对与绝对链接都认）", () => {
  const html = `<html><body><div class="design" id="leftcolumn">
      <a href="/python3/python3-tutorial.html">Python3 教程</a>
      <a href="python3-intro.html">Python3 简介</a>
      <a href="python3-list.html#top">Python3 列表</a>
      <a href="/try/runcode.php?filename=x&type=python3">运行实例</a>
      <a href="/java/java-tutorial.html">Java 教程</a>
    </div><div id="content"><p>正文</p></div></body></html>`;
  const pages = tutorialPages(html, "/python3/python3-tutorial.html");
  const paths = pages.map((page) => page.path);
  assert.deepEqual(paths, ["/python3/python3-tutorial.html", "/python3/python3-intro.html", "/python3/python3-list.html"]);
  assert.ok(!paths.some((p) => p.includes("/try/")), "robots.txt 禁的 /try/ 不能出现");
  assert.ok(!paths.some((p) => p.startsWith("/java/")), "跨目录链接不能混进来");
});

test("findUnsafe：脚本/事件/伪协议能被拦下，普通标签示例不误报", () => {
  assert.deepEqual(findUnsafe("普通正文，含 <meta charset=\"utf-8\"> 与 <script>alert(1)</script>"), ["script"]);
  assert.ok(findUnsafe('<a onclick="x()">y</a>').includes("event-handler"));
  assert.ok(findUnsafe('href="javascript:void(0)"').includes("javascript-url"));
  assert.deepEqual(findUnsafe("纯文本，没有危险片段"), []);
});
