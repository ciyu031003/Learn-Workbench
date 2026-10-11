/**
 * csgraduates 解析层单测。
 *
 * 这些断言钉住的是**站点结构的假设**：一旦站点改版（h4 分节、data-answer、答案速对表、
 * Prism 的 `span[style=display:flex]` 行包装），这里会先红 —— 而不是让 700 道题静默解析成空。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  findUnsafe,
  parseAnswerTable,
  parseKnowledgePage,
  parseQuizPage,
  parseSitemapUrls,
  planTargets,
  richText,
  subjectKeyFromHeading,
  subjectOfPath,
} from "./csgraduates.mjs";
import { parseHtml } from "./simple-dom.js";

const QUIZ_HTML = `<html><body><main id=content-panel>
<h1>2024 年 408 真题</h1>
<details><summary>选择题答案速对</summary><table><tbody>
<tr><td>1</td><td>D</td><td>2</td><td>A</td></tr>
</tbody></table></details>
<h4 id=数据结构>数据结构</h4>
<h5 id=1>1</h5>
<p>已知带头结点的非空单链表 <code>L</code> 的头指针为 <code>h</code>。这段代码的功能是（）。</p>
<div class="choice-container x" data-answer=D data-tags=链表,插入 data-multiple=false id=quiz-choice-abc-1>
<div class=quiz-tag-container>
<a href=/data_structure/linearlist/linked/#x class="quiz-tag quiz-tag-kp-link" title="查看「链表」知识点"></a>
</div>
<form>
<label class=choice-option><input type=radio name=choice-abc-1 value=A><span class=choice-label>A.</span><span class=choice-text>把 <code>q</code> 插到 <code>p</code> 后面</span></label>
<label class=choice-option><input type=radio name=choice-abc-1 value=B><span class=choice-label>B.</span><span class=choice-text>把 <code>p</code> 插到 <code>q</code> 后面</span></label>
<label class=choice-option><input type=radio name=choice-abc-1 value=C><span class=choice-label>C.</span><span class=choice-text>把 <code>p</code> 插到 <code>h</code> 后面</span></label>
<label class=choice-option><input type=radio name=choice-abc-1 value=D><span class=choice-label>D.</span><span class=choice-text>把 <code>q</code> 插到 <code>h</code> 后面</span></label>
</form>
<div class=feedback-area></div>
<div class=explanation id=explanation-abc-1><strong>正确答案：<span class=correct-answer-text>D</span></strong><br>
<p>代码分解分析：</p>
<div class=highlight><pre><code class=language-c><span style=display:flex><span><span style=color:#000>q</span> <span>=</span> <span>p</span><span>-&gt;</span><span>next</span>;</span></span><span style=display:flex><span>    int x = 1;</span></span></code></pre></div>
<p>把 q 接到头结点之后。</p>
</div>
</div>
<h4 id=计算机网络>计算机网络</h4>
<h5 id=2>2</h5>
<p>TCP 三次握手的目的是什么？</p>
<div class="choice-container" data-answer=B data-tags=TCP data-multiple=false id=quiz-choice-abc-2>
<form>
<label class=choice-option><input type=radio name=choice-abc-2 value=A><span class=choice-label>A.</span><span class=choice-text>确认带宽</span></label>
<label class=choice-option><input type=radio name=choice-abc-2 value=B><span class=choice-label>B.</span><span class=choice-text>确认双方收发能力</span></label>
</form>
<div class=explanation id=explanation-abc-2><strong>正确答案：<span class=correct-answer-text>B</span></strong><p>三次握手确认双方收发能力。</p></div>
</div>
<h3 id=解答题>解答题</h3>
<h4 id=数据结构-1>数据结构</h4>
<h5 id=41>41</h5>
<p>请设计算法判定拓扑序列是否唯一。</p>
<div class="answer-container" id=quiz-answer-abc-1 data-tags=拓扑排序>
<a href=/data_structure/basic/alg_design/#x class="quiz-tag quiz-tag-kp-link"></a>
<div class=quiz-actions></div>
</div>
<div class="solution-detail" id=solution-answer-abc-1 style=display:none>
<p>1）设计思想：依次选取入度为 0 的顶点。</p>
<div class=highlight><pre><code class=language-c><span style=display:flex><span>int uniquely(MGraph g) { return 1; }</span></span></code></pre></div>
</div>
</main></body></html>`;

const KNOWLEDGE_HTML = `<html><body><main id=content-panel>
<h1>链式表示</h1>
<p>🔥 高优先级</p>
<p>线性表的<strong>链式表示</strong>通常指的是使用链表来实现线性表。</p>
<h2>单链表定义</h2>
<p>与顺序表不同,单链表中每个结点的存储空间都是动态分配的。</p>
<ul><li>插入和删除方便</li><li>注意头结点不能被删除</li></ul>
<div class=highlight><pre><code class=language-c><span style=display:flex><span>typedef struct Node {</span></span><span style=display:flex><span>    int data;</span></span><span style=display:flex><span>} Node;</span></span></code></pre></div>
<h2>判空</h2>
<p>如果头指针的 next 为空,说明单链表为空。</p>
</main></body></html>`;

test("subjectKeyFromHeading：h4 小标题（含 Hugo 去重后缀）映射到四门课", () => {
  assert.equal(subjectKeyFromHeading("数据结构"), "ds");
  assert.equal(subjectKeyFromHeading("组成原理"), "co");
  assert.equal(subjectKeyFromHeading("数据结构-1"), "ds");
  assert.equal(subjectKeyFromHeading("计算机网络"), "net");
  assert.equal(subjectKeyFromHeading("操作系统"), "os");
  assert.equal(subjectKeyFromHeading("数学"), null);
});

test("subjectOfPath：只认四门课的目录", () => {
  assert.equal(subjectOfPath("/data_structure/linearlist/linked/")?.key, "ds");
  assert.equal(subjectOfPath("/study_methods/408quiz/2024/"), null);
});

test("parseSitemapUrls + planTargets：只挑 408 真题页与四门课知识点页", () => {
  const urls = parseSitemapUrls(
    `<urlset><url><loc>http://www.csgraduates.com/study_methods/408quiz/2024/</loc></url>` +
      `<url><loc>http://www.csgraduates.com/study_methods/math/math1/2024/</loc></url>` +
      `<url><loc>http://www.csgraduates.com/data_structure/linearlist/linked/</loc></url>` +
      `<url><loc>http://www.csgraduates.com/data_structure/linearlist/</loc></url>` +
      `<url><loc>http://www.csgraduates.com/study_methods/tags/408quiz/</loc></url></urlset>`
  );
  const plan = planTargets(urls);
  assert.deepEqual(plan.quiz.map((q) => q.year), [2024]);
  assert.deepEqual(plan.knowledge.map((k) => k.path), ["/data_structure/linearlist/linked/"]);
  assert.deepEqual(plan.chapters.map((c) => c.chapter), ["linearlist"]);
});

test("richText：块级换行，且 `<pre>` 里的代码缩进与词间空格不丢", () => {
  const root = parseHtml(`<div><p>第一段</p><pre><code><span style=display:flex><span><span>typedef</span> <span>struct</span></span></span><span style=display:flex><span>    int x;</span></span></code></pre></div>`);
  const text = richText(root.children[0]);
  assert.match(text, /第一段/);
  assert.match(text, /typedef struct/);
  assert.match(text, /\n {4}int x;/);
});

test("parseAnswerTable：No./Ans 两列对全部读出", () => {
  const root = parseHtml(`<details><table><tbody><tr><td>1</td><td>D</td><td>2</td><td>A</td></tr></tbody></table></details>`);
  assert.deepEqual(parseAnswerTable(root), [
    { no: 1, answer: "D" },
    { no: 2, answer: "A" },
  ]);
});

test("parseQuizPage：题干/选项/答案/解析/知识点链接/解答题都解析到位", () => {
  const page = parseQuizPage(QUIZ_HTML, "http://www.csgraduates.com/study_methods/408quiz/2024/");
  assert.equal(page.year, 2024);
  assert.equal(page.questions.length, 2);
  assert.equal(page.solutions.length, 1);

  const first = page.questions[0];
  assert.equal(first.subject, "ds");
  assert.equal(first.number, 1);
  assert.equal(first.answer, "D");
  assert.equal(first.options.length, 4);
  assert.deepEqual(first.options.map((o) => o.key), ["A", "B", "C", "D"]);
  assert.match(first.stem, /带头结点的非空单链表/);
  assert.deepEqual(first.tags, ["链表", "插入"]);
  assert.deepEqual(first.knowledgePaths, ["/data_structure/linearlist/linked/"]);
  assert.match(first.explanation, /正确答案：D/);
  assert.match(first.explanation, /代码分解分析/);
  assert.match(first.explanation, /q = p->next;/);
  assert.equal(first.hasCode, true);

  // 第二题：跨小节后学科要跟着换（h4 分节靠文档序）
  assert.equal(page.questions[1].subject, "net");
  assert.equal(page.questions[1].options.length, 2);

  // 解答题的参考解答在**同级兄弟** div.solution-detail 里，不能被漏掉
  const solution = page.solutions[0];
  assert.equal(solution.number, 41);
  assert.equal(solution.subject, "ds");
  assert.match(solution.solution, /依次选取入度为 0 的顶点/);
  assert.equal(solution.code[0].language, "c");
  assert.match(solution.code[0].code, /int uniquely/);
});

test("parseKnowledgePage：标题/优先级/小节/代码都抽出来", () => {
  const page = parseKnowledgePage(KNOWLEDGE_HTML, "http://www.csgraduates.com/data_structure/linearlist/linked/");
  assert.equal(page.subject, "ds");
  assert.equal(page.chapter, "linearlist");
  assert.equal(page.page, "linked");
  assert.equal(page.title, "链式表示");
  assert.equal(page.priority, "high");
  const headings = page.sections.map((s) => s.heading);
  assert.deepEqual(headings, ["单链表定义", "判空"]);
  assert.match(page.sections[0].paragraphs[0], /动态分配/);
  assert.deepEqual(page.sections[0].lists[0].items, ["插入和删除方便", "注意头结点不能被删除"]);
  assert.equal(page.sections[0].codes[0].language, "c");
  assert.match(page.sections[0].codes[0].code, /typedef struct Node/);
});

test("findUnsafe：危险片段能被拦下（生成阶段据此拒绝）", () => {
  assert.equal(findUnsafe("普通文本 O(n)"), false);
  assert.equal(findUnsafe("<script>alert(1)</script>"), true);
  assert.equal(findUnsafe('<a onclick="x()">'), true);
  assert.equal(findUnsafe("javascript:void(0)"), true);
});
