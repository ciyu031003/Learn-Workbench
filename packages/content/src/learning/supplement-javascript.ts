import type { LearningDifficulty, LearningQuestion, LearningLevel } from "./types";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function singleQuestion(input: {
  key: string; stageKey: string; topicKey: string;
  stem: string; options: [string, string, string, string];
  answer: "A" | "B" | "C" | "D"; explanation: string;
  difficulty: LearningDifficulty; tags: string[]; sourceKey: string; level: LearningLevel;
}): LearningQuestion {
  return { key: input.key, stageKey: input.stageKey, topicKey: input.topicKey, type: "single",
    stem: input.stem, options: input.options.map((text, i) => ({ key: OPTION_KEYS[i], text })),
    answer: [input.answer], explanation: input.explanation, difficulty: input.difficulty,
    tags: input.tags, sourceKey: input.sourceKey, level: input.level };
}

function judgeQuestion(input: {
  key: string; stageKey: string; topicKey: string;
  stem: string; answer: boolean; explanation: string;
  difficulty: LearningDifficulty; tags: string[]; sourceKey: string; level: LearningLevel;
}): LearningQuestion {
  return { key: input.key, stageKey: input.stageKey, topicKey: input.topicKey, type: "judge",
    stem: input.stem, options: [{ key: "A", text: "正确" }, { key: "B", text: "错误" }],
    answer: [input.answer ? "A" : "B"], explanation: input.explanation, difficulty: input.difficulty,
    tags: input.tags, sourceKey: input.sourceKey, level: input.level };
}

/** JavaScript 补充题库（按知识点细分，2 题/知识点，共 15 个知识点）。 */
export const javascriptSupplementQuestions: LearningQuestion[] = [
  // ===== 1. js-values-scope（值、类型与作用域；归属阶段 js-language） =====
  singleQuestion({ key: "javascript-sup-js-values-scope-s1", stageKey: "js-language", topicKey: "js-values-scope",
    stem: "在判断两个值是否相等时，下列关于严格相等运算符 === 行为的说法，哪一项是正确的？",
    options: ["=== 会先尝试把两边转换为相同类型再比较值", "=== 先比较类型，类型不同直接返回 false，类型相同再比较值", "=== 与 == 的唯一区别是 === 不能比较对象", "原始值和对象用 === 比较时都按引用身份判断"],
    answer: "B",
    explanation: "=== 是严格相等，比较前不会做隐式类型转换：若两边类型不同直接返回 false，类型相同才按值比较；原始值按值内容比较，对象按引用身份比较，所以 A、C、D 均错误。",
    difficulty: "easy", tags: ["严格相等", "类型转换"], sourceKey: "mdn-reference", level: "入门" }),
  judgeQuestion({ key: "javascript-sup-js-values-scope-j1", stageKey: "js-language", topicKey: "js-values-scope",
    stem: "在 let x = 1; 这条声明语句之前访问变量 x 会得到一个初始值 undefined，而不会报错。",
    answer: false,
    explanation: "let/const 声明的变量存在暂时性死区（TDZ），在声明语句执行前访问会抛出 ReferenceError 而不是返回 undefined；只有 var 或函数声明才会被提升并初始化为 undefined，因此该命题错误。",
    difficulty: "medium", tags: ["作用域", "暂时性死区"], sourceKey: "mdn-reference", level: "进阶" }),

  // ===== 2. js-functions-closures（函数、闭包与 this；归属阶段 js-language） =====
  singleQuestion({ key: "javascript-sup-js-functions-closures-s1", stageKey: "js-language", topicKey: "js-functions-closures",
    stem: "如下代码为三个按钮分别绑定点击回调，依次点击这三个按钮时控制台分别输出什么？\nfor (var i = 0; i < 3; i++) { buttons[i].onclick = function () { console.log(i); }; }",
    options: ["0、1、2", "3、3、3", "依次报错", "undefined、undefined、undefined"],
    answer: "B",
    explanation: "var 没有块级作用域，三个回调共享同一个变量 i；循环结束后 i 已经累加到 3，点击时再读取自然都输出 3。若改用 let 或为每个回调创建独立闭包，才会分别得到 0、1、2，因此选 B。",
    difficulty: "medium", tags: ["闭包", "var作用域"], sourceKey: "mdn-reference", level: "进阶" }),
  judgeQuestion({ key: "javascript-sup-js-functions-closures-j1", stageKey: "js-language", topicKey: "js-functions-closures",
    stem: "箭头函数没有自己的 this，它的 this 会继承自定义时外层词法作用域中的 this。",
    answer: true,
    explanation: "箭头函数本身不绑定 this，而是沿词法作用域向上取外层（通常是包含它的普通函数或模块/全局）的 this，因此不能用 call/apply 改变其 this，这也使它很适合用作回调，该命题正确。",
    difficulty: "easy", tags: ["箭头函数", "this绑定"], sourceKey: "mdn-reference", level: "入门" }),

  // ===== 3. js-collections（数组、对象与现代集合；归属阶段 js-language） =====
  singleQuestion({ key: "javascript-sup-js-collections-s1", stageKey: "js-language", topicKey: "js-collections",
    stem: "关于 Map 与普通对象 {} 作为键值容器，下列哪项正确？",
    options: ["普通对象的键只能是字符串或 Symbol，而 Map 的键可以是任意类型的值", "Map 不能存储超过 1000 个键值对", "用 obj[1] 和 obj[\"1\"] 访问的是两个不同的键", "Map 的键顺序不保证与插入顺序一致"],
    answer: "A",
    explanation: "普通对象的属性键会被强制转换为字符串（或 Symbol），因此 obj[1] 与 obj[\"1\"] 是同一个键、键顺序也不完全可控；Map 允许任意类型作为键（包括对象、函数），严格保持插入顺序，且没有数量上限，故 A 正确。",
    difficulty: "medium", tags: ["Map", "数据结构"], sourceKey: "algorithms-javascript", level: "进阶" }),
  judgeQuestion({ key: "javascript-sup-js-collections-j1", stageKey: "js-language", topicKey: "js-collections",
    stem: "使用展开运算符 {...obj} 或 arr.slice() 对嵌套对象进行拷贝时，会同时复制其内部的引用对象，因此得到的是一份完全独立的深拷贝。",
    answer: false,
    explanation: "展开运算符与 slice/concat 都只做浅拷贝：最外层对象是新的，但内部的引用类型属性仍指向原对象。修改拷贝后的嵌套属性会影响原对象，真正深拷贝需要递归克隆或使用 structuredClone 等专门手段，因此该命题错误。",
    difficulty: "medium", tags: ["浅拷贝", "深拷贝"], sourceKey: "algorithms-javascript", level: "进阶" }),

  // ===== 4. js-async-browser（异步、浏览器与网络；归属阶段 js-language） =====
  singleQuestion({ key: "javascript-sup-js-async-browser-s1", stageKey: "js-async-browser", topicKey: "js-event-loop",
    stem: "关于浏览器中 fetch 发起的 HTTP 请求，下列说法正确的是？",
    options: ["只要服务器返回 4xx/5xx，fetch 返回的 Promise 就会 reject", "fetch 仅在网络故障、跨域被拦截等请求根本未完成时 reject，HTTP 错误状态码仍需手动检查", "fetch 默认会自动跟随所有重定向并忽略响应体", "调用 fetch 后无需关心响应，Promise 一定 resolve 为成功数据"],
    answer: "B",
    explanation: "fetch 基于网络层语义：只有当请求无法完成（断网、DNS 失败、被 CORS 阻止等）时 Promise 才 reject；服务器返回 404、500 等 HTTP 状态仍会 resolve，需读取 res.ok 或 res.status 自行判断业务成功与否，故 B 正确。",
    difficulty: "medium", tags: ["fetch", "网络请求"], sourceKey: "mdn-reference", level: "进阶" }),
  judgeQuestion({ key: "javascript-sup-js-async-browser-j1", stageKey: "js-async-browser", topicKey: "js-event-loop",
    stem: "在浏览器中，使用 <img src> 加载一张图片与用 fetch 请求同一资源，二者都受同源策略限制，跨域时都无法读取到响应内容。",
    answer: false,
    explanation: "<img>、<script>、<link> 等标签的跨域资源加载不受同源策略阻止（可显示/执行），只是脚本无法读取其像素或文本内容；而 fetch/XHR 默认受 CORS 限制，跨域需在服务端设置 Access-Control-Allow-Origin 才能读取，二者约束并不相同，因此命题错误。",
    difficulty: "hard", tags: ["同源策略", "CORS"], sourceKey: "mdn-reference", level: "综合" }),

  // ===== 5. js-event-loop（事件循环与任务队列；归属阶段 js-language） =====
  singleQuestion({ key: "javascript-sup-js-event-loop-s1", stageKey: "js-async-browser", topicKey: "js-event-loop",
    stem: "考虑以下代码，其正确的控制台输出顺序是？\nconsole.log(\"1\");\nsetTimeout(() => console.log(\"2\"), 0);\nPromise.resolve().then(() => console.log(\"3\"));\nconsole.log(\"4\");",
    options: ["1、2、3、4", "1、4、2、3", "1、4、3、2", "1、3、4、2"],
    answer: "C",
    explanation: "同步代码先执行，输出 1 和 4；setTimeout 回调进入宏任务队列，Promise.then 回调进入微任务队列。当前宏任务结束后会先清空微任务队列（输出 3），再取下一个宏任务（输出 2），所以顺序是 1、4、3、2，选 C。",
    difficulty: "hard", tags: ["事件循环", "微任务"], sourceKey: "mdn-reference", level: "综合" }),
  judgeQuestion({ key: "javascript-sup-js-event-loop-j1", stageKey: "js-async-browser", topicKey: "js-event-loop",
    stem: "事件循环中，微任务（microtask）队列会在每个宏任务（macrotask）执行结束后被清空，而渲染通常要等到当前所有微任务处理完之后才可能发生。",
    answer: true,
    explanation: "每执行完一个宏任务，运行时会先清空整个微任务队列（包括微任务中继续派生的微任务），然后再考虑渲染和取下一个宏任务；这也意味着大量同步派生的微任务会推迟渲染与交互，造成页面卡顿，因此该命题正确。",
    difficulty: "medium", tags: ["事件循环", "任务队列"], sourceKey: "mdn-reference", level: "进阶" }),

  // ===== 6. js-promises（Promise 与 async/await；归属阶段 js-language） =====
  singleQuestion({ key: "javascript-sup-js-promises-s1", stageKey: "js-async-browser", topicKey: "js-promises",
    stem: "关于 async 函数与 await，下列说法正确的是？",
    options: ["await 只能用在普通函数中，不能用在 async 函数内", "async 函数永远返回 undefined", "async 函数无论是否显式 return，其调用结果都是一个 Promise", "await 会阻塞整个主线程直到 Promise 完成"],
    answer: "C",
    explanation: "async 函数被调用后立即返回一个 Promise，函数体内 return x 会让该 Promise 以 x 兑现；await 只是暂停当前 async 函数的执行并让出主线程，待 Promise 兑现后恢复，并不会阻塞整个线程，因此选 C。",
    difficulty: "medium", tags: ["async", "Promise"], sourceKey: "mdn-reference", level: "进阶" }),
  judgeQuestion({ key: "javascript-sup-js-promises-j1", stageKey: "js-async-browser", topicKey: "js-promises",
    stem: "在 Promise.all([p1, p2, p3]) 中，只要有一个 Promise 被拒绝（reject），整体就会立即 reject，且其余仍在进行的 Promise 会被自动取消。",
    answer: false,
    explanation: "Promise.all 确实在任一成员 reject 时整体立刻 reject，但它不会主动取消其它 Promise——那些仍在进行中的异步操作会继续执行直到完成，只是其结果被忽略；若需要全部结束无论成败应使用 Promise.allSettled，因此命题错误。",
    difficulty: "hard", tags: ["Promise", "并发组合"], sourceKey: "mdn-reference", level: "综合" }),

  // ===== 7. js-dom-network（DOM、事件与网络；归属阶段 js-language） =====
  singleQuestion({ key: "javascript-sup-js-dom-network-s1", stageKey: "js-async-browser", topicKey: "js-dom-network",
    stem: "在一个包含大量子元素的列表容器上，为了高效地处理所有子项的点击事件，推荐的做法是？",
    options: ["给每个子元素单独绑定一个点击事件监听器", "使用事件委托：在容器上绑定一个监听器，利用事件冒泡判断 event.target", "使用 innerHTML 拼接包含用户内容的 HTML 字符串来绑定事件", "把事件监听器绑定到 document 上并在其中遍历所有子元素"],
    answer: "B",
    explanation: "事件委托利用事件冒泡机制，在父容器上绑定单一监听器，通过 event.target 判断实际被点击的子项；相比逐子项绑定，它减少监听器数量、对动态新增子项也天然生效，性能与可维护性更好，故 B 正确。",
    difficulty: "medium", tags: ["事件委托", "DOM"], sourceKey: "mdn-reference", level: "进阶" }),
  judgeQuestion({ key: "javascript-sup-js-dom-network-j1", stageKey: "js-async-browser", topicKey: "js-dom-network",
    stem: "在 DOM 中直接通过 element.innerHTML = userInput 插入未经转义的用户输入，存在跨站脚本（XSS）注入风险。",
    answer: true,
    explanation: "innerHTML 会把字符串当作 HTML 解析执行，若其中包含 <script> 或事件属性等恶意内容，就会在当前页面上下文中执行，造成 XSS；应使用 textContent 或先对内容进行转义/消毒（sanitize）后再插入，因此该命题正确。",
    difficulty: "easy", tags: ["XSS", "DOM安全"], sourceKey: "mdn-reference", level: "入门" }),

  // ===== 8. js-engineering（模块、测试与工程化；归属阶段 js-language） =====
  singleQuestion({ key: "javascript-sup-js-engineering-s1", stageKey: "js-engineering", topicKey: "js-modules",
    stem: "关于前端工程化中构建（build）步骤的作用，下列描述最准确的是？",
    options: ["构建只是为了把代码文件改名，对运行没有任何影响", "构建负责把源码转换为可部署产物：转译新语法、打包依赖、压缩体积并处理资源", "构建只能在浏览器中运行，无法在开发机器上完成", "构建会移除所有注释但不会改变模块之间的依赖关系"],
    answer: "B",
    explanation: "构建工具（如打包器）将开发态的模块、ES 新语法、各种资源统一处理：对旧浏览器做语法转译、合并与拆分打包、压缩混淆、处理 CSS/图片等，产出可高效加载与部署的静态产物，远不止改名或去注释，故 B 正确。",
    difficulty: "medium", tags: ["工程化", "构建"], sourceKey: "freecodecamp-js", level: "进阶" }),
  judgeQuestion({ key: "javascript-sup-js-engineering-j1", stageKey: "js-engineering", topicKey: "js-modules",
    stem: "在多人协作的前端项目中，把依赖锁定文件（如 package-lock.json / pnpm-lock.yaml）纳入版本控制，有助于在不同机器上复现完全一致的依赖安装结果。",
    answer: true,
    explanation: "锁文件记录了每个依赖的精确版本与解析来源，提交后团队成员和 CI 执行安装时会按锁文件还原，避免在我机器上能跑的依赖漂移问题；它是可复现构建与工程化协作的重要一环，因此该命题正确。",
    difficulty: "medium", tags: ["依赖管理", "工程化"], sourceKey: "freecodecamp-js", level: "进阶" }),

  // ===== 9. js-modules（模块与依赖边界；归属阶段 js-language） =====
  singleQuestion({ key: "javascript-sup-js-modules-s1", stageKey: "js-engineering", topicKey: "js-modules",
    stem: "关于 ES Modules（ESM）的导入导出，下列说法正确的是？",
    options: ["import 引入的绑定是动态只读引用，原始模块中导出值的变化会反映到导入方", "一个模块只能使用默认导出，不能使用命名导出", "命名导出必须在导入时用 * 一次性全部引入，不能单独挑选", "模块的导入在运行时发生，可以在函数内部条件性地 import 普通静态语句"],
    answer: "A",
    explanation: "ESM 的导入是活绑定（live binding），导入方看到的是源模块当前导出的实时值；模块可同时拥有默认导出与多个命名导出，命名导出可用 import { a, b } 精确挑选，静态 import 必须位于模块顶层，故 A 正确。",
    difficulty: "medium", tags: ["ESM", "模块"], sourceKey: "mdn-reference", level: "进阶" }),
  judgeQuestion({ key: "javascript-sup-js-modules-j1", stageKey: "js-engineering", topicKey: "js-modules",
    stem: "在 ES Modules 中，默认导出（default export）和命名导出（named export）可以在同一个模块里同时存在。",
    answer: true,
    explanation: "一个模块既可以提供唯一的默认导出 export default，也可以提供多个命名导出 export const x = ...；导入时分别用 import foo from 和 import { x } from 即可，二者互不冲突，这是 ESM 的常见用法，因此命题正确。",
    difficulty: "easy", tags: ["ESM", "导出"], sourceKey: "mdn-reference", level: "入门" }),

  // ===== 10. js-testing（测试与调试；归属阶段 js-language） =====
  singleQuestion({ key: "javascript-sup-js-testing-s1", stageKey: "js-engineering", topicKey: "js-testing",
    stem: "在编写单元测试时，下列哪一项最能体现好的测试？",
    options: ["测试覆盖率高就代表业务逻辑正确，无需再写具体断言", "测试应当验证行为契约（输入与可观察输出），而不是内部实现细节", "测试之间必须依赖固定执行顺序才能通过", "只要能运行通过，测试内部可以硬编码真实网络请求"],
    answer: "B",
    explanation: "好的单元测试验证的是函数对给定输入产生的可观察行为（契约），而非内部私有步骤；这样在重构实现时测试依然稳定。覆盖率高但断言空洞、测试间相互依赖或强耦合外部网络，都会让测试脆弱且失真，故 B 正确。",
    difficulty: "medium", tags: ["单元测试", "测试"], sourceKey: "freecodecamp-js", level: "进阶" }),
  judgeQuestion({ key: "javascript-sup-js-testing-j1", stageKey: "js-engineering", topicKey: "js-testing",
    stem: "在测试异步代码时，使用测试替身（test double，如 mock/stub）替代真实网络请求，有助于让测试快速、稳定且聚焦于被测逻辑。",
    answer: true,
    explanation: "用替身替换不确定的外部依赖（网络、计时器、数据库），可以消除网络抖动、超时等干扰，让测试变为确定性、可重复的单元验证，同时便于模拟成功、失败、超时等各种边界情况，提升测试价值，因此该命题正确。",
    difficulty: "medium", tags: ["测试替身", "异步测试"], sourceKey: "freecodecamp-js", level: "进阶" }),

  // ===== 11. js-browser-data（存储、性能与可访问性；归属阶段 js-language） =====
  singleQuestion({ key: "javascript-sup-js-browser-data-s1", stageKey: "js-engineering", topicKey: "js-browser-data",
    stem: "关于浏览器中不同客户端存储方案的特性，下列对比正确的是？",
    options: ["localStorage 与 Cookie 都会在每次 HTTP 请求中自动携带到服务器", "localStorage 容量约 5MB、同源持久存储且不会被请求自动发送，适合存非敏感偏好", "Cookie 默认可以安全存放用户的登录令牌且永不过期", "sessionStorage 的数据在关闭标签页后仍然长期保留"],
    answer: "B",
    explanation: "localStorage 容量约 5MB、同源、持久化且不会随请求自动发送到服务端，适合主题、布局等非敏感偏好；Cookie 才会随请求发送且容量仅约 4KB，登录令牌放 localStorage 有 XSS 风险；sessionStorage 在标签页关闭即清除，故 B 正确。",
    difficulty: "hard", tags: ["存储", "浏览器"], sourceKey: "mdn-reference", level: "综合" }),
  judgeQuestion({ key: "javascript-sup-js-browser-data-j1", stageKey: "js-engineering", topicKey: "js-browser-data",
    stem: "为了兼顾可访问性（a11y），仅通过颜色差异或纯鼠标悬停来传达关键信息（如校验错误或状态）是充分且合规的做法。",
    answer: false,
    explanation: "仅用颜色或鼠标悬停传递信息会排除色觉障碍用户和键盘/屏幕阅读器用户；可访问性要求以多重方式（文字、图标、aria 属性、键盘可达）传达状态，并配合语义化标签与对比度，才能覆盖更广泛的用户群体，因此命题错误。",
    difficulty: "hard", tags: ["可访问性", "a11y"], sourceKey: "mdn-reference", level: "综合" }),

  // ===== 12. js-modern-frontend（现代前端与综合项目；归属阶段 js-async-browser） =====
  singleQuestion({ key: "javascript-sup-js-modern-frontend-s1", stageKey: "js-modern-frontend", topicKey: "js-components",
    stem: "在构建现代前端单页应用时，关于路由的职责，下列说法正确的是？",
    options: ["路由只负责修改浏览器地址栏的 URL，与页面要渲染什么无关", "路由根据 URL 匹配对应的视图/组件，并管理页面状态、参数与历史记录", "前端路由必须每次都向服务器重新请求完整 HTML 页面", "路由只能在应用启动时配置一次，运行中不能切换页面"],
    answer: "B",
    explanation: "前端路由的核心是根据当前 URL（path/query/params）决定渲染哪个视图组件，并管理导航历史、参数传递与状态；客户端路由通常只更新视图而不整页刷新，既支持历史回退也支持运行中动态跳转，故 B 正确。",
    difficulty: "hard", tags: ["路由", "SPA"], sourceKey: "freecodecamp-js", level: "综合" }),
  judgeQuestion({ key: "javascript-sup-js-modern-frontend-j1", stageKey: "js-modern-frontend", topicKey: "js-components",
    stem: "现代前端框架普遍倡导组件化：把界面拆分为职责单一、接口明确、可组合的组件，从而提升复用性与可维护性。",
    answer: true,
    explanation: "组件化将 UI 拆成可独立开发、测试与复用的单元，每个组件通过明确的 props/状态接口对外通信，内部实现被封装；这降低了耦合、便于团队协作与渐进式重构，是现代前端工程化的基础实践，因此该命题正确。",
    difficulty: "medium", tags: ["组件化", "前端"], sourceKey: "freecodecamp-js", level: "进阶" }),

  // ===== 13. js-components（组件与组合；归属阶段 js-async-browser） =====
  singleQuestion({ key: "javascript-sup-js-components-s1", stageKey: "js-modern-frontend", topicKey: "js-components",
    stem: "关于受控组件（controlled component）在表单中的含义，下列说法正确的是？",
    options: ["表单元素的值完全由 DOM 自身保存，框架不读取也不干预", "表单元素的值由组件 state 驱动，用户输入通过事件回写到 state，从而保持单一数据源", "受控组件指完全禁止用户输入，只能由程序赋值", "受控组件无法处理键盘输入，必须改用非受控方式"],
    answer: "B",
    explanation: "受控组件中，输入值来自 state，每次 onChange 把新值写回 state，再由 state 渲染到元素，保证界面展示与数据状态一致、单一可信来源；非受控组件才主要依赖 DOM 自身保存值，二者并非禁止输入，故 B 正确。",
    difficulty: "medium", tags: ["受控组件", "表单"], sourceKey: "freecodecamp-js", level: "进阶" }),
  judgeQuestion({ key: "javascript-sup-js-components-j1", stageKey: "js-modern-frontend", topicKey: "js-components",
    stem: "在组件设计中，把状态放在真正需要它的最小公共祖先组件里，可以减少重复状态并让数据来源唯一。",
    answer: true,
    explanation: "状态提升（lifting state up）原则建议：当多个子组件需要共享同一份数据时，把它放到它们最近的共同父组件中管理，再向下传递；这样避免多处维护重复、易不一致的副本，保证数据来源唯一且可预测，因此该命题正确。",
    difficulty: "easy", tags: ["状态提升", "组件"], sourceKey: "freecodecamp-js", level: "入门" }),

  // ===== 14. js-state-render（状态、渲染与副作用；归属阶段 js-async-browser） =====
  singleQuestion({ key: "javascript-sup-js-state-render-s1", stageKey: "js-modern-frontend", topicKey: "js-state-render",
    stem: "关于单向数据流与不可变更新，下列说法正确的是？",
    options: ["单向数据流允许子组件直接反向修改父组件的状态对象", "派生数据（可由其他状态计算而来）也应单独存储，以避免重复", "不可变更新要求生成新对象/数组而不是原地修改，便于检测变化与避免副作用", "在渲染函数内部直接修改状态对象是推荐做法，因为它最直接"],
    answer: "C",
    explanation: "单向数据流指数据从父向子、从状态到视图单向传递；派生值应即时计算而非另存（B 错）；状态更新应通过返回新对象/数组的不可变方式完成，这样框架能可靠比较引用、触发渲染并避免共享引用带来的意外副作用；渲染中改状态（D）会破坏可预测性，故 C 正确。",
    difficulty: "hard", tags: ["单向数据流", "不可变"], sourceKey: "freecodecamp-js", level: "综合" }),
  judgeQuestion({ key: "javascript-sup-js-state-render-j1", stageKey: "js-modern-frontend", topicKey: "js-state-render",
    stem: "在组件中使用订阅、定时器或异步请求等副作用时，应当在组件卸载或依赖变化时成对地进行清理（如取消订阅、清除定时器），否则可能留下残留任务或内存泄漏。",
    answer: true,
    explanation: "副作用（订阅、setInterval、未取消的 fetch）若不在卸载时清理，会在组件已不存在后仍触发回调，导致更新已卸载组件、重复订阅或内存无法释放；通过清理函数（如 useEffect 的返回函数、AbortController）成对管理生命周期是必要实践，因此该命题正确。",
    difficulty: "medium", tags: ["副作用", "清理"], sourceKey: "freecodecamp-js", level: "进阶" }),

  // ===== 15. js-performance（性能与交付质量；归属阶段 js-async-browser） =====
  singleQuestion({ key: "javascript-sup-js-performance-s1", stageKey: "js-modern-frontend", topicKey: "js-performance",
    stem: "关于前端性能优化方法，下列说法正确的是？",
    options: ["只要把所有组件都用 memo 包裹，就一定能让应用更快", "性能优化应先测量后优化，用真实指标（如 LCP、CLS）定位瓶颈再针对性改进", "代码分割（code splitting）会把整个应用打包成单个更大的文件以提升加载速度", "布局抖动（layout thrashing）是不可避免的浏览器底层缺陷，开发者无需关心"],
    answer: "B",
    explanation: "有效的性能优化遵循先测量、再优化、再对比：用 LCP/CLS/INP 等指标和性能面板找到真实瓶颈，再针对性做懒加载、代码分割、减少重排等；无依据地到处 memo（A）或盲目打包反而可能拖慢，布局抖动需通过读写分离主动避免，故 B 正确。",
    difficulty: "hard", tags: ["性能优化", "测量"], sourceKey: "mdn-reference", level: "综合" }),
  judgeQuestion({ key: "javascript-sup-js-performance-j1", stageKey: "js-modern-frontend", topicKey: "js-performance",
    stem: "错误边界（error boundary）的目标是尽可能吞掉所有错误让日志消失，从而给用户一个永远不报错的应用。",
    answer: false,
    explanation: "错误边界的用意不是隐藏错误，而是限定错误影响范围：在局部出错时提供降级 UI 与恢复路径（如重试、返回安全页），同时把错误上报以便修复；掩盖错误会让问题持续损害用户且难以排查，并非正确目标，因此命题错误。",
    difficulty: "medium", tags: ["错误边界", "容错"], sourceKey: "mdn-reference", level: "进阶" }),
];
