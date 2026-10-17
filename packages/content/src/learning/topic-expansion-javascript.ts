/**
 * JavaScript · 知识点扩容（追加式，2026-10-17）。
 *
 * 与 topic-expansion-backend-engineering.ts 同款口径：每条 expansion = 1 个知识点 + 2 道配套题。
 * 本次新增 6 个课程尚未覆盖的知识点，分布到 js-language / js-async-browser / js-engineering /
 * js-modern-frontend 四个真实阶段；topic.key 沿用 js- 前缀，且不与既有 12 个 key 重复。
 */
import type { TopicExpansion } from "./topic-expansions";

export const javascriptTopicExpansions: TopicExpansion[] = [
  {
    trackSlug: "javascript",
    stageKey: "js-language",
    topic: {
      key: "js-prototype-chain",
      title: "原型链与属性查找",
      summary:
        "每个对象内部都有一条指向原型的隐藏链接，读取属性时沿链向上找，写入却总发生在对象自己身上；class 只是把构造函数和原型包起来的语法糖。",
      concepts: ["原型对象", "原型链查找", "构造函数与 new", "instanceof"],
      principles: [
        "函数的 prototype 属性决定 new 出来的实例的 [[Prototype]]，实例与构造函数共享 prototype 上的方法。",
        "属性读取先查自身，再沿原型链向上，直到 null 仍未命中才返回 undefined；属性写入只在自身创建（原型上是 setter 时除外）。",
        "class 是语法糖：方法定义在 prototype 上且不可枚举，实例字段则挂在每个实例自身。",
      ],
      applications: [
        "用构造函数加原型让成百上千个实例共享方法，避免每个实例复制一份函数。",
        "用 Object.create(null) 或 Map 代替普通对象做纯字典，避开原型上继承来的键名冲突。",
        "借助 instanceof 与 Object.getPrototypeOf 判断对象来自哪个构造函数，处理老代码与调试。",
      ],
      pitfalls: [
        "直接用 obj.__proto__ 读写原型，它是历史遗留访问器，正确做法是 Object.getPrototypeOf、Object.setPrototypeOf 或 Object.create。",
        "给内置原型（如 Array.prototype）加方法，可能与库或未来标准冲突，还会让 for...in 遍历出意外键。",
        "以为 class 里写的方法在实例上，实际上方法在 prototype，实例只持有字段，所以 Object.keys(instance) 看不到方法。",
      ],
      method:
        "遇到属性找不到或方法被覆盖时，先画一条链：实例、构造函数.prototype、Object.prototype、null，再用 Object.getOwnPropertyNames 逐层确认属性到底挂在哪一层。",
      exercise:
        "用构造函数加原型实现 Shape 与 Circle：describe 放在 Shape.prototype，area 放在 Circle.prototype，创建实例后验证 instanceof 与属性所在层级。",
      checkpoint:
        "能预测一次属性访问经过几层原型、最终拿到什么值，并解释为什么改原型会影响所有已创建的实例。",
      lesson: {
        overview: [
          "原型是 JavaScript 实现**对象之间共享行为**的方式。每个对象内部都有一条指向另一个对象的链接，规范里叫 [[Prototype]]，当你要读一个对象自己身上没有的属性时，引擎就顺着这条链接去下一个对象找，这就是常说的原型链。理解它，你才能解释为什么数组能调用 map、为什么给 prototype 加一个方法会让所有实例立刻具备该能力，以及为什么两个内容相同的对象用 === 比较却不相等。",
          "为什么要有原型链？因为方法如果放在每个实例上，创建一万个对象就复制一万份函数，内存和创建开销都浪费。把方法放在共享的原型上，实例只保存自己的数据字段，行为按需沿链查找。这也带来一条必须记住的分工：数据在实例上，行为在原型上。这个分工解释了几乎所有**为什么这里改不到**的困惑，也是读懂库源码和老代码的钥匙。",
          "什么时候要显式关心原型？三种场景：读老代码时看到 Shape.prototype.describe 这种写法；写类库时想把方法共享给所有实例；调试时发现对象上冒出一个自己没定义过的属性，那一定来自原型链。现代业务代码很少直接操作原型，但只要你用 class、用 instanceof、区分 Object.keys 与 for...in，就还在和它打交道。",
        ],
        mechanism: [
          "new 一共做了四件事：先创建一个空对象；再把它的 [[Prototype]] 指向构造函数的 prototype；然后以这个新对象为 this 执行构造函数；最后如果构造函数没有返回对象，就把这个新对象返回。所以实例身上的方法来自第二步建立的那条链接，而不是在创建时被复制了一份。",
          "读取 obj.x 的时候，引擎先看对象自身有没有 x，也就是 own property；如果没有，就去 [[Prototype]] 指向的对象里找；再没有就继续向上，直到遇到 null 才停下并返回 undefined。这就是遮蔽：在实例上写同名属性会盖住原型上的值，但原型本身一点都没被改动，删掉实例属性之后原型上的值又会重新露出来。",
          "赋值 obj.x = 1 并不会沿链查找之后再修改，而是直接在 obj 上创建一个属性。唯一的例外是原型链上存在同名 setter：这时赋值会触发那个 setter 函数，看起来像改到了原型，其实只是调用了一个函数。理解这一点，才能解释为什么有些属性怎么改都不生效。",
          "class 里的方法被定义为不可枚举，所以 Object.keys(instance) 和 for...in 都看不到它们；而构造函数里的 this.x 赋值是实打实写在实例上的可枚举字段。想确认某个方法到底挂在哪一层，就用 Object.getOwnPropertyNames 分别打印实例与原型对比。这也解释了为什么用展开运算符合并对象时，类的方法不会被带过去。",
        ],
        example: {
          title: "实例、原型与 class 的三角关系",
          language: "javascript",
          code: "function Shape(name) {\n  this.name = name;\n}\n\n// 方法放在原型上：所有实例共用同一份\nShape.prototype.describe = function () {\n  return 'shape:' + this.name;\n};\n\nclass Circle extends Shape {\n  constructor(name, r) {\n    super(name);\n    this.r = r;\n  }\n\n  area() {\n    return Math.PI * this.r ** 2;\n  }\n}\n\nconst c = new Circle('c1', 2);\n\nconsole.log(c.describe()); // shape:c1（来自 Shape.prototype）\nconsole.log(Object.keys(c)); // ['name', 'r']，只列自身可枚举字段\nconsole.log(Object.getPrototypeOf(c) === Circle.prototype); // true\nconsole.log(Object.getPrototypeOf(Circle.prototype) === Shape.prototype); // true\nconsole.log(c instanceof Shape); // true，instanceof 就是沿这条链判断\nconsole.log(Object.getOwnPropertyNames(Circle.prototype)); // ['constructor', 'area']",
          explanation:
            "这段代码刻意把三种写法放在一起对比。Shape 用构造函数加 prototype 定义 describe，Circle 用 class extends 继承；控制台输出的 describe 来自 Shape.prototype 上的共享方法，而 Object.keys(c) 只有 name 与 r，说明方法根本不在实例上。最后三行验证链接：getPrototypeOf(c) 正是 Circle.prototype，Circle.prototype 的原型又是 Shape.prototype，instanceof 就是沿这条链向上查找。注意 area 出现在原型上，如果用 this.area = ... 写进构造函数，它就会变成每个实例各自的副本。",
        },
        practiceSteps: [
          "打开控制台，用 function A() {} 与 A.prototype.hi = function () {} 创建实例，打印 Object.keys 与 Object.getOwnPropertyNames(A.prototype) 对比。",
          "用 Object.create(proto) 手动造一个对象，验证它没有自身属性但能读到 proto 上的值。",
          "把例子里的 area 改为构造函数里的 this.area = ...，再比较两次 Object.keys 的输出差异。",
          "先用 obj.__proto__ 改原型，再用 Object.setPrototypeOf 重复一次，体会后者为什么更清晰可维护。",
        ],
        masteryChecklist: [
          "能不看资料说出 new 的四个步骤。",
          "能解释为什么修改 prototype 会影响已经创建出来的实例。",
          "能说明 Object.keys、for...in、Object.getOwnPropertyNames 三者在原型链上的差别。",
        ],
        summary: [
          "对象内部有 [[Prototype]] 链接，读取沿链向上，写入只发生在自身。",
          "new 的四步：建对象、连原型、执行构造函数、返回对象。",
          "方法放原型共享，数据放实例独占。",
          "class 是构造函数加原型的语法糖，方法不可枚举。",
          "改内置原型风险高，纯字典用 Object.create(null) 或 Map。",
        ],
        terms: [
          {
            term: "原型（Prototype）",
            plain: "每个对象背后挂着的那个共享备用对象。",
            detail:
              "严格说实例的原型是构造函数的 prototype 属性所指的那个对象。容易混的是：函数自己有 prototype 属性，实例通过 [[Prototype]] 指向它，这两个不是同一个东西。",
          },
          {
            term: "原型链（Prototype Chain）",
            plain: "一层层往上找属性的那条链子。",
            detail:
              "链的尽头是 Object.prototype，再往上就是 null。链通常只有两三层，查找成本可以忽略；真正要注意的是不要频繁改写原型，那会让所有实例的行为一起变。",
          },
          {
            term: "构造函数（Constructor）",
            plain: "用 new 调用来造对象的那个函数。",
            detail:
              "构造函数本身也是普通函数。不用 new 直接调用时，this 在严格模式下是 undefined，非严格模式下是全局对象，于是 this.name = ... 会把属性写到全局上，这是老代码里的经典 bug。",
          },
          {
            term: "属性遮蔽（Shadowing）",
            plain: "实例上的同名属性盖住了原型上的那个。",
            detail:
              "遮蔽只影响读取顺序，原型上的值一点没变。要取被盖住的值，得用 Object.getPrototypeOf(obj).x；删除实例属性用 delete obj.x 又会重新暴露原型上的值。",
          },
          {
            term: "语法糖（Syntactic Sugar）",
            plain: "写法更顺眼、底层还是老东西的语法。",
            detail:
              "class 就是典型：它没有引入新的对象模型，只是把构造函数、原型方法和 extends 包装得更像传统面向对象语言。所以 typeof Circle 仍然是 function。",
          },
        ],
      },
    },
    questions: [
      {
        key: "javascript-exp-js-prototype-chain-s1",
        stageKey: "js-language",
        topicKey: "js-prototype-chain",
        type: "single",
        stem: "关于 JavaScript 的属性查找，下面哪一句是正确的？",
        options: [
          { key: "A", text: "读取实例属性时，会先把原型上的同名属性复制到实例上，再返回" },
          { key: "B", text: "读取时先查对象自身，找不到再沿 [[Prototype]] 链向上，直到链末端 null 才返回 undefined" },
          { key: "C", text: "执行 obj.x = 1 时，如果原型上已有 x，就会修改原型上的那个 x" },
          { key: "D", text: "class 中定义的方法会为每个实例各存一份副本" },
        ],
        answer: ["B"],
        explanation:
          "属性读取是查找而不是复制：先看自身属性，再沿原型链向上，走到 null 仍未命中就得到 undefined。赋值总在实例自身创建属性（原型上是 setter 时除外），不会改原型；class 的方法定义在 prototype 上由所有实例共享，所以 A、C、D 都错。判断方法挂在哪一层，用 Object.getOwnPropertyNames 看构造函数原型即可。",
        difficulty: "medium",
        tags: ["原型链", "属性查找", "class"],
        sourceKey: "mdn-reference",
        level: "进阶",
      },
      {
        key: "javascript-exp-js-prototype-chain-j1",
        stageKey: "js-language",
        topicKey: "js-prototype-chain",
        type: "judge",
        stem: "在 class 中定义的方法，每个实例都会各创建一份函数副本。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "class 里的方法被定义在构造函数的 prototype 上，实例通过 [[Prototype]] 链接共享同一份函数，这正是原型存在的意义：一万个实例只有一份方法代码。实例自己只持有构造函数里赋值的字段，所以 Object.keys 看不到方法。",
        difficulty: "easy",
        tags: ["class", "原型", "实例"],
        sourceKey: "mdn-reference",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "javascript",
    stageKey: "js-language",
    topic: {
      key: "js-error-handling",
      title: "异常处理与 Error 对象",
      summary:
        "throw 能抛任何值，但只有 Error 实例带调用栈；try 只覆盖同一次同步执行，所以定时器回调里的错误、忘记 await 的 Promise 拒绝，都接不到。",
      concepts: ["Error 对象", "try/catch/finally", "错误传播与包装", "Error.cause"],
      principles: [
        "抛出的值最好是 Error 实例：只有它带 stack 与标准字段，抛字符串会在上报时丢掉调用栈。",
        "try 只覆盖它内部同步执行的代码；回调在之后的宏任务里运行，错误会冒到全局而不是外层 try。",
        "await 一个 rejected Promise 会把拒绝转成同步抛错，因此能被 try/catch；漏写 await 就只能拿到一个 Promise 对象。",
        "finally 无论正常返回、抛错还是提前 return 都会执行；在 finally 里 return 会吞掉正在抛出的异常。",
      ],
      applications: [
        "接口层把网络错误、HTTP 错误、解析错误分类包装，再交给界面显示不同提示。",
        "表单校验抛自定义 Error 子类，用 instanceof 判断并定位到具体字段。",
        "错误上报时用 cause 串起原始错误，保留完整因果链。",
      ],
      pitfalls: [
        "空 catch，或只 console.log 一句后继续执行，把错误吞掉，让上层拿到错误数据还以为成功。",
        "catch 到的参数类型不可信，可能是字符串也可能是任意值，直接读 .message 会得到 undefined。",
        "在 finally 里写 return，覆盖掉 try 的返回值或正在传播的异常，调试时极难发现。",
      ],
      method:
        "先给错误分层：能就地恢复的（校验失败、可重试的网络抖动）在这一层处理；不能处理的加上下文重新抛出，用 new Error(msg, { cause: err }) 保留现场。",
      exercise:
        "封装一个 request 函数，区分超时、网络失败、非 2xx 与 JSON 解析失败四种情况，各自抛出带 cause 的错误，并在调用处用 instanceof 分类处理。",
      checkpoint:
        "能解释为什么 setTimeout 回调里 throw 不会被外层 try 捕获，以及为什么 async 函数里漏写 await 会让 catch 失效。",
      lesson: {
        overview: [
          "错误处理的第一原则是：不要假装成功。很多线上事故不是**抛了错**，而是错了以后代码继续往下跑，用 undefined 拼出一个看似正常的响应。try/catch 让你在错误发生的那一层决定：就地恢复、加上下文重抛，还是交给最外层统一兜底。判断标准很简单，这一层有没有足够信息做出正确决定，没有就往上抛。",
          "JavaScript 的错误有两个容易忽略的边界。第一，异步会切断 try 的作用范围：setTimeout 的回调在未来的宏任务里执行，那时 try 早已结束，错误只能冒到全局。第二，Promise 的拒绝不会自动变成异常，只有 await 才把它转成同步抛错。不理解这两点，你会写出**明明包了 try 却什么都没接住**的代码，然后误以为是框架的问题。",
          "为什么要自定义 Error 子类？因为 catch 到的只是一个值，靠 message 字符串做分支判断既脆弱又难维护，文案一改逻辑就崩。继承 Error 后可以加字段（比如 field、statusCode），并用 instanceof 精确分类；别忘了手动设置 this.name，否则打印出来永远是 Error。最后用 cause 把原始错误挂上去，上报时才能看到完整因果链。另一个常见需求是区分可重试与不可重试，这时给错误加一个 retryable 字段，比在 catch 里匹配字符串可靠得多。",
        ],
        mechanism: [
          "try 块里的代码如果在执行过程中抛错，控制流会立刻跳到 catch，并把抛出的值作为参数传进去；如果没有写 catch，引擎就沿调用栈一层层向上找，一路都找不到就交给全局，浏览器会触发 window.onerror 或 unhandledrejection 事件。所以捕获的位置越靠近出错点，你能拿到的信息就越完整。",
          "setTimeout 的回调根本不在 try 的调用栈上：try 执行的时候只是把回调交给了定时器，函数返回之后 try 的作用域就已经结束，等到回调将来抛错时，没有任何活动的 catch 可以接住它，错误只能冒到全局去。要兜住它，必须在回调函数内部自己再包一层 try/catch。",
          "async 函数里 await 之后的部分会被包进 Promise 的后续回调。Promise 的拒绝只有在被 await 的时候才会变成一次抛错；不写 await 就相当于把这个 Promise 直接丢掉，它的拒绝最终会以 unhandledrejection 的形式出现，try/catch 完全看不到。这也是很多异步 bug 只在控制台报未处理拒绝、业务日志里却一片安静的原因。",
          "finally 设计出来是为了清理，比如关连接、清定时器，所以它总会被执行，无论前面是正常返回、抛错还是提前 return。但也正因为如此，在 finally 里写 return 会让函数从这里正常返回，把正在传播的异常直接丢弃，排查起来非常费劲。",
        ],
        example: {
          title: "自定义错误、错误分类与原因链",
          language: "javascript",
          code: "class ValidationError extends Error {\n  constructor(field, message) {\n    super(message);\n    this.name = 'ValidationError'; // 不设的话打印出来永远是 Error\n    this.field = field;\n  }\n}\n\nfunction parseAge(raw) {\n  const n = Number(raw);\n  if (!Number.isInteger(n) || n < 0 || n > 150) {\n    throw new ValidationError('age', '年龄必须是 0-150 的整数，收到: ' + raw);\n  }\n  return n;\n}\n\nasync function loadUser(id) {\n  const res = await fetch('/api/users/' + id);\n  if (!res.ok) {\n    // fetch 只在网络层失败时 reject，404/500 仍会 resolve\n    throw new Error('HTTP ' + res.status);\n  }\n  return res.json();\n}\n\nasync function main() {\n  try {\n    const user = await loadUser(42); // await 把拒绝转成可 catch 的抛错\n    console.log(parseAge(user.age));\n  } catch (err) {\n    if (err instanceof ValidationError) {\n      console.warn('字段不合法:', err.field, err.message);\n    } else {\n      throw new Error('初始化失败', { cause: err }); // 保留原始错误链\n    }\n  } finally {\n    console.log('main 结束'); // 无论成功失败都会执行\n  }\n}",
          explanation:
            "这段代码覆盖了日常最常用的四件事。继承 Error 并设置 name，才能在日志里区分自定义错误；带 field 字段，调用方就能定位到哪个输入项出错。loadUser 里显式检查 res.ok，因为 fetch 不会因 404 而 reject，不检查就会把错误页当数据解析。main 里的 await 让 Promise 的拒绝变成可 catch 的抛错，if 分支用 instanceof 而不是比字符串，最后用 cause 把原始错误挂在包装错误上，上报时既能看到业务上下文，也不会丢原始堆栈。",
        },
        practiceSteps: [
          "写一个会抛错的函数，分别用同步调用、setTimeout 回调和 Promise 三种方式触发，观察 try/catch 哪些能接住。",
          "自定义一个 ValidationError 子类，带上 field 字段，在 catch 里用 instanceof 分支处理。",
          "把 catch 里的 console.log(err) 改成 throw new Error('...', { cause: err })，在上层打印 err.cause 验证链路。",
          "在这个例子里故意删掉 await，再运行一次，观察 catch 为什么不再触发、控制台为什么出现 unhandledrejection。",
        ],
        masteryChecklist: [
          "能说清同步、定时器回调、Promise 拒绝三种错误各自该在哪里捕获。",
          "能写出一个带 name 与自定义字段的 Error 子类，并解释为什么必须设置 name。",
          "能解释 finally 里 return 的危险，以及 cause 解决了什么问题。",
        ],
        summary: [
          "只抛 Error 实例，抛字符串会丢调用栈。",
          "try 只覆盖同步执行，异步边界要各自处理。",
          "await 把拒绝变成抛错，漏写 await 就接不到。",
          "finally 负责清理，不要在里面 return。",
          "重抛时用 cause 保留原始错误。",
        ],
        terms: [
          {
            term: "Error 对象（Error）",
            plain: "JS 里表示出错了的标准对象，带消息和调用栈。",
            detail:
              "new Error 时传入的字符串是 message。抛字符串或数字语法上允许，但会丢掉 stack 与 name 这些排查问题的关键信息，等于给自己挖坑。",
          },
          {
            term: "抛出（throw）",
            plain: "主动中断当前流程，把错误交给调用方。",
            detail:
              "throw 之后的代码不会执行。它和 return 的区别是：return 交回结果，throw 交回失败，调用方必须显式处理失败，否则会一路冒到全局。",
          },
          {
            term: "错误传播（Error Propagation）",
            plain: "这一层处理不了，就带上上下文往上一层扔。",
            detail:
              "好的实践是加一层上下文再抛，例如 throw new Error('加载用户失败 id=42', { cause: err })。这样上层既知道业务场景，也能追到原始错误，而不是只剩一句 network error。",
          },
          {
            term: "原因链（Error.cause）",
            plain: "把底层原始错误挂在新错误上，保留现场。",
            detail:
              "ES2022 加入的标准字段。以前只能手动拼 message 或自定义属性，容易丢。用 cause 后，打印或上报时能清楚看到哪个错误导致了哪个错误。",
          },
          {
            term: "拒绝（Rejection）",
            plain: "Promise 表示失败的那个状态。",
            detail:
              "rejected 不等于抛异常，它只是一个状态。要让它变成能 catch 的抛错，必须 await 或调用 .catch()，否则会触发 unhandledrejection 事件。",
          },
        ],
      },
    },
    questions: [
      {
        key: "javascript-exp-js-error-handling-s1",
        stageKey: "js-language",
        topicKey: "js-error-handling",
        type: "single",
        stem: "下面哪种情况，外层的 try/catch 一定接不住错误？",
        options: [
          { key: "A", text: "在 try 块里直接 throw new Error('x')" },
          { key: "B", text: "在 try 块里 await 一个 rejected 的 Promise" },
          { key: "C", text: "在 try 块里把会抛错的回调交给 setTimeout，回调随后抛错" },
          { key: "D", text: "在 try 块里调用一个同步抛错的普通函数" },
        ],
        answer: ["C"],
        explanation:
          "try 的作用范围只有它内部同步执行的那段调用栈。setTimeout 只是登记了一个回调，try 结束之后回调才在宏任务里运行，此时没有活动的 catch，错误只能冒到全局。A、D 是同步抛错，B 的 await 会把拒绝转成抛错，三者都能被接住。要兜住定时器里的错误，得在回调内部自己 try/catch，或监听全局错误事件。",
        difficulty: "medium",
        tags: ["try/catch", "异步", "错误"],
        sourceKey: "mdn-reference",
        level: "进阶",
      },
      {
        key: "javascript-exp-js-error-handling-j1",
        stageKey: "js-language",
        topicKey: "js-error-handling",
        type: "judge",
        stem: "async 函数里忘了写 await，外层 try/catch 依然能捕获那个 Promise 的拒绝。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "不 await 时，函数只是创建了一个 Promise 并继续往下走，这个 Promise 的拒绝与当前执行栈无关，try/catch 捕获不到，最终会变成 unhandledrejection。只有 await 或显式 .catch() 才把拒绝接回当前执行流，所以异步调用处的 await 不只是拿值，也是错误处理的一部分。",
        difficulty: "medium",
        tags: ["async", "await", "Promise"],
        sourceKey: "freecodecamp-js",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "javascript",
    stageKey: "js-async-browser",
    topic: {
      key: "js-timers-debounce-throttle",
      title: "定时器调度与防抖节流",
      summary:
        "setTimeout 的延迟是**至少等这么久**而不是精确时刻；防抖是等用户停手才执行一次，节流是固定窗口内最多执行一次，两者都必须能被取消。",
      concepts: ["宏任务与延迟精度", "防抖 debounce", "节流 throttle", "定时器清理"],
      principles: [
        "定时器回调排在宏任务队列，必须等当前同步代码与微任务清空，所以真实触发时间只会晚于设定值。",
        "嵌套超过 5 层的 setTimeout 会被规范钳制为至少 4ms，后台标签页还会被浏览器进一步节流。",
        "防抖与节流都要提供取消能力，否则组件卸载后回调仍会跑，造成报错或内存滞留。",
      ],
      applications: [
        "搜索框输入联想：用防抖，等用户停止输入 300ms 再发请求。",
        "滚动、resize、鼠标移动：用节流，按固定频率更新位置或进度。",
        "按钮防连点：提交后禁用，或用节流保证一段时间内只提交一次。",
      ],
      pitfalls: [
        "只在每次触发时 clearTimeout，却忘了在卸载时清理，回调去访问已经销毁的 DOM。",
        "用 setInterval 做倒计时或轮询，误差累积，且上一次没跑完就可能叠加下一次。",
        "把 setTimeout(fn, 0) 当成立刻执行或插队，它只是排到下一个宏任务。",
      ],
      method:
        "先判断需求是**等停手**还是**限频率**，再决定防抖或节流；实现时统一返回带 cancel 的函数，并在组件卸载、路由切换时调用。",
      exercise:
        "实现 debounce 与 throttle，给搜索框接防抖、给滚动监听接节流，并在页面卸载时清理，用控制台验证触发次数。",
      checkpoint:
        "能说出同一个场景为什么选防抖而不是节流，并能解释 setTimeout 的延迟为什么不准。",
      lesson: {
        overview: [
          "定时器看起来简单，其实它只是**把回调交给事件循环，排在至少 N 毫秒之后**。真正什么时候执行，取决于前面还有多少同步代码和任务。所以 setTimeout(fn, 0) 不会立刻执行，setTimeout(fn, 100) 也可能在 120ms 才跑。这个认知很重要：任何依赖精确时间点的逻辑，比如动画帧、倒计时，都不该压在 setTimeout 上。",
          "防抖与节流解决的是同一类问题：事件触发太频繁，处理函数扛不住。区别在目标。防抖关心用户是不是停了，只保留最后一次；节流关心频率上限，窗口期内只放行一次。搜索联想用防抖，因为用户还在打字时发请求没意义；滚动进度用节流，因为中途的位置也需要展示。选错的典型症状是**输入时一直不响应**或**滚动时疯狂重绘**。",
          "它们还有一个共同点：必须有清理手段。定时器和监听器不会因为组件卸载自动消失，回调里访问已被移除的节点会抛错，闭包还会拖住整棵 DOM 树不让回收。所以工业级实现都会返回一个带 cancel 的函数，在卸载、路由切换、请求完成时调用。这也是**为什么我的页面越用越卡**最常见的答案之一。",
        ],
        mechanism: [
          "调用 setTimeout 时，运行时会记录下延迟并把回调放进定时器列表；到期之后回调被排进宏任务队列，必须等当前任务和所有微任务都跑完，才轮到它执行。所以多久之后执行，实际含义是至少多久之后才排队。",
          "HTML 规范规定，嵌套层级超过 5 的定时器最小延迟会被钳制为 4ms；浏览器还会对后台标签页做节流，可能延长到 1 秒甚至更久。所以用定时器做动画或计时的基准并不可靠，需要稳定节奏时应该改用 requestAnimationFrame，或者自己按时间戳计算进度。",
          "防抖的机制是每次触发都先取消上一次：只要两次事件的间隔小于 wait，就永远只有最后一个定时器存活，于是回调只在用户停手之后执行一次。它天然带延迟，因为必须等满一个完整的等待窗口，这也决定了它不适合要求即时反馈的交互。",
          "节流的机制是记录上一次执行的时间戳：每次触发都比较当前时间与上次的差值，达到间隔才执行并更新时间戳，窗口期内的其它触发直接丢弃。它的第一次触发不延迟，所以持续事件也能马上得到一次反馈，代价是最后一次触发可能被丢掉。",
        ],
        example: {
          title: "可取消的防抖与节流",
          language: "javascript",
          code: "function debounce(fn, wait = 300) {\n  let timer = null;\n\n  function debounced(...args) {\n    const ctx = this;\n    if (timer !== null) clearTimeout(timer); // 每次触发都重置\n    timer = setTimeout(function () {\n      timer = null;\n      fn.apply(ctx, args);\n    }, wait);\n  }\n\n  debounced.cancel = function () {\n    if (timer !== null) clearTimeout(timer);\n    timer = null;\n  };\n\n  return debounced;\n}\n\nfunction throttle(fn, interval = 200) {\n  let last = 0;\n  return function (...args) {\n    const now = Date.now();\n    if (now - last >= interval) {\n      last = now;\n      fn.apply(this, args);\n    }\n  };\n}\n\nconst input = document.querySelector('#search');\nconst runSearch = debounce(function (keyword) {\n  console.log('请求搜索:', keyword);\n}, 300);\n\ninput.addEventListener('input', function (e) {\n  runSearch(e.target.value);\n});\n\nwindow.addEventListener('scroll', throttle(function () {\n  console.log('滚动位置:', window.scrollY);\n}, 200));\n\nwindow.addEventListener('beforeunload', function () {\n  runSearch.cancel(); // 卸载时清理，避免回调访问已销毁的节点\n});",
          explanation:
            "防抖的关键是每一轮触发都先 clearTimeout 再重新计时，所以输入十个字符只会留下最后一个定时器，停手 300ms 后才真正发请求。throttle 换成时间戳判定：窗口期内直接返回，滚动时每 200ms 最多输出一次。两处都用 function 而不是箭头函数保存调用时的 this，这样 fn.apply(ctx, args) 才能把正确的上下文传下去。cancel 不是可选项，它是这套实现能在组件里安全使用的前提。",
        },
        practiceSteps: [
          "写一个输入框，分别接上防抖与节流版本的日志函数，快速输入十个字符，比较控制台输出次数。",
          "把 debounce 的 wait 改成 0，观察它是否立刻执行，并用事件循环的顺序解释原因。",
          "在 setTimeout 回调里再嵌套 setTimeout 六层，打印每次的实际间隔，体会 4ms 钳制。",
          "给两个函数都加上取消逻辑，在页面卸载或组件销毁时调用，验证之后不再有任何输出。",
        ],
        masteryChecklist: [
          "能解释 setTimeout(fn, 0) 为什么不是立即执行。",
          "能根据场景正确选择防抖或节流，并说明理由。",
          "能写出带 cancel 的实现，并说明为什么必须清理。",
        ],
        summary: [
          "定时器延迟是最小等待，真实触发只会更晚。",
          "防抖等于等停手，只执行最后一次；节流等于限频率，窗口内只放行一次。",
          "嵌套定时器有 4ms 钳制，后台标签页会被进一步节流。",
          "与屏幕刷新对齐的动画用 requestAnimationFrame。",
          "定时器必须能取消，卸载时一定要清理。",
        ],
        terms: [
          {
            term: "防抖（Debounce）",
            plain: "事件停下来之后才执行一次，中间的全丢掉。",
            detail:
              "典型场景是搜索联想、窗口 resize 结束后重算布局。注意它一定会延迟执行，所以对按下就要有反馈的交互不合适，那种场景应该先给即时反馈再防抖。",
          },
          {
            term: "节流（Throttle）",
            plain: "固定时间内最多执行一次，多出来的触发直接丢。",
            detail:
              "适合滚动、鼠标移动这类持续事件。上面这种实现只保留窗口内第一次，如果业务需要收尾那一次，还要补 trailing 逻辑，否则最后一次滚动位置不会被记录。",
          },
          {
            term: "宏任务（Macrotask）",
            plain: "事件循环里排队的一整批任务，定时器回调就是。",
            detail:
              "每个宏任务执行完，引擎会把微任务队列清空，再取下一个宏任务。所以定时器回调永远插不进当前同步代码中间，只能排在后面。",
          },
          {
            term: "事件循环（Event Loop）",
            plain: "一个不停取任务来执行的循环机制。",
            detail:
              "它让单线程的 JS 也能处理异步：任务排队、逐个执行、中间穿插渲染。理解它就能解释几乎所有**输出顺序**类问题。",
          },
          {
            term: "屏幕刷新率（Refresh Rate）",
            plain: "屏幕每秒重画多少次，常见是 60 次。",
            detail:
              "requestAnimationFrame 按这个节奏调用回调，比 setTimeout(fn, 16) 更稳，也不会在后台标签页空转，是动画的默认选择。",
          },
        ],
      },
    },
    questions: [
      {
        key: "javascript-exp-js-timers-debounce-throttle-s1",
        stageKey: "js-async-browser",
        topicKey: "js-timers-debounce-throttle",
        type: "single",
        stem: "用户在搜索框里连续快速输入，希望停止输入后才发一次请求，应该采用哪种策略？",
        options: [
          { key: "A", text: "节流，固定每 300ms 发一次请求" },
          { key: "B", text: "防抖，每次输入都重置 300ms 定时器，只有停手后才发" },
          { key: "C", text: "用 setInterval 每 300ms 轮询输入框的值再发请求" },
          { key: "D", text: "每次输入都立刻发请求，靠服务端去重" },
        ],
        answer: ["B"],
        explanation:
          "需求是停手后发一次，正好是防抖：每次输入先取消上一次定时器，只有间隔超过 300ms 才真正执行。节流会按固定频率持续发请求，用户还在打字时就产生了多次无意义请求；轮询既有延迟又浪费；服务端去重只是兜底，并不能减少请求量。判断口诀是：等停手用防抖，限频率用节流。",
        difficulty: "easy",
        tags: ["防抖", "节流", "输入"],
        sourceKey: "mdn-reference",
        level: "入门",
      },
      {
        key: "javascript-exp-js-timers-debounce-throttle-j1",
        stageKey: "js-async-browser",
        topicKey: "js-timers-debounce-throttle",
        type: "judge",
        stem: "setTimeout(fn, 0) 会立刻打断当前代码并执行 fn。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "定时器回调是宏任务，必须等当前同步代码执行完、微任务队列清空之后才会被取出执行，所以它一定排在当前代码之后，不可能插队打断。想尽快执行可以用 queueMicrotask 或 Promise.resolve().then，但同样不会打断正在运行的同步代码。区分这一点，才能正确推断输出顺序。",
        difficulty: "easy",
        tags: ["setTimeout", "宏任务", "事件循环"],
        sourceKey: "mdn-reference",
        level: "入门",
      },
    ],
  },
  {
    trackSlug: "javascript",
    stageKey: "js-async-browser",
    topic: {
      key: "js-cors-credentials",
      title: "跨域请求、CORS 与凭证",
      summary:
        "同源策略限制的是浏览器里的 JS 能不能读响应；CORS 是服务端用响应头授权的方式，带 cookie 时通配符会失效，必须回显具体来源。",
      concepts: ["同源策略", "预检请求", "Access-Control-Allow-Origin", "credentials 凭证模式"],
      principles: [
        "同源要求协议、主机、端口三者完全一致；子域、协议升级、端口不同都算跨源。",
        "简单请求直接发出，浏览器只在响应阶段检查是否放行；PUT、DELETE、自定义头或 application/json 会先触发 OPTIONS 预检。",
        "凭证模式下 Access-Control-Allow-Origin 不能是通配符，必须回显具体 Origin，并同时返回 Access-Control-Allow-Credentials: true。",
        "CORS 是浏览器的行为，服务端之间调用、命令行工具都不受限制，所以本地能用而浏览器报错，通常就是 CORS。",
      ],
      applications: [
        "前后端分域部署时为指定来源开放跨域，例如 app.example.com 调 api.example.com。",
        "接入第三方 API 时确认对方是否允许你的 Origin 与自定义请求头。",
        "带 cookie 的单点登录回调，配置凭证模式与精确来源白名单。",
      ],
      pitfalls: [
        "Access-Control-Allow-Origin 写成通配符，却又在 fetch 里带 credentials，浏览器直接拒绝响应。",
        "预检响应漏掉实际请求用到的自定义头，导致真实请求根本发不出去。",
        "以为加了 CORS 就安全：CORS 只是浏览器读取限制，不是身份验证。",
      ],
      method:
        "先在 Network 面板确认有没有 OPTIONS 预检、失败在哪一步，再按允许来源、允许方法、允许头、是否带凭证四项逐一对照响应头，最后加 Vary: Origin 防止缓存串源。",
      exercise:
        "用命令行工具复现一次带自定义头的跨域请求：先看 OPTIONS 预检缺哪个头导致失败，再补齐服务端配置，最后在浏览器里验证带 cookie 的 fetch 能成功。",
      checkpoint:
        "能区分简单请求与预检请求，并解释带 cookie 时为什么不能用通配符来源。",
      lesson: {
        overview: [
          "浏览器里跑着的脚本来自某个网站，如果它能随便读别的网站的响应，你打开的任何一个页面都能在你不知情时读走网银数据。同源策略就是这道闸门，它限制脚本读取跨源响应。注意它限制的是读，不是发：跨源的表单提交、图片引用、静态资源加载一直都被允许，这也是 CSRF 这类攻击存在的土壤。",
          "CORS 是给同源策略开的一扇合规的门。服务端在响应里声明我允许哪个来源读我，浏览器核对后决定是否把响应交给 JS。关键在于决定权在服务端（它声明允许谁），执行权在浏览器（它决定放不放行）。这也解释了为什么改前端代码没用、为什么命令行工具能通而页面不行、为什么后端日志里明明有请求前端却报错。",
          "带 cookie 的场景是坑最多的地方：凭证模式下浏览器要求服务端精确回显 Origin，不能图省事写通配符，还必须显式允许凭证。顺序也要注意，预检失败时真实请求根本不会发出，所以你在 Network 里只看到一个失败的 OPTIONS，看不到业务请求，容易误判成接口没通。改完配置后还要记得清缓存或缩短 Max-Age，否则旧的预检结果会继续生效一段时间。",
        ],
        mechanism: [
          "浏览器发出跨源请求时会自动带上 Origin 头，标明这个请求来自哪个源。响应回来之后，浏览器检查 Access-Control-Allow-Origin 是否与当前源匹配、或者是否为通配符；不匹配就不把响应体交给 JS，只在控制台留下一条 CORS 错误。所以 CORS 失败时状态码可能已经是 200，只是响应体被浏览器拦下来了。",
          "不是简单请求的时候，浏览器会先发一个 OPTIONS 预检，用 Access-Control-Request-Method 和 Access-Control-Request-Headers 告诉服务端真正想用的方法与头，服务端再用对应的 Allow 头逐项答复。只要有一项没被允许，真实请求就不会发出。另外预检请求默认不携带凭证信息，它只是一次能力协商，所以你的登录态校验逻辑不会在预检阶段执行。",
          "带凭证时规则会收紧：Allow-Origin 必须是具体来源而不是通配符，并且必须出现 Allow-Credentials: true，否则浏览器不会带上 cookie，或者干脆拒绝把响应交给页面。这条规则是为了防止任意站点借用户已登录的 cookie 去读取数据。服务端如果漏了其中任何一项，控制台都会给出与凭证相关的错误提示。",
          "预检结果会按照 Access-Control-Max-Age 缓存一段时间，缓存期内同样的请求不再重复预检。但如果缓存键里不包含 Origin，多个来源就会共用同一份缓存而产生串源，所以服务端响应要加上 Vary: Origin 这个响应头。排查串源问题时，先看响应头里有没有 Vary，往往一眼就能定位。",
        ],
        example: {
          title: "带自定义头的预检往返",
          language: "text",
          code: "# 预检请求：浏览器在真实请求之前自动发出\nOPTIONS /api/orders HTTP/1.1\nHost: api.example.com\nOrigin: https://app.example.com\nAccess-Control-Request-Method: PUT\nAccess-Control-Request-Headers: content-type, x-csrf-token\n\n# 服务端应答：逐项允许\nHTTP/1.1 204 No Content\nAccess-Control-Allow-Origin: https://app.example.com\nAccess-Control-Allow-Methods: GET, POST, PUT\nAccess-Control-Allow-Headers: content-type, x-csrf-token\nAccess-Control-Allow-Credentials: true\nAccess-Control-Max-Age: 600\nVary: Origin",
          explanation:
            "这段报文对应页面上的 fetch('/api/orders', { method: 'PUT', headers: { 'x-csrf-token': ... }, credentials: 'include' })。因为用了 PUT 和自定义头，它不是简单请求，浏览器先发 OPTIONS。服务端必须回显具体 Origin（带凭证时不能用通配符）、列出 PUT，并把请求里出现的每个头都写进 Allow-Headers，少一个预检就不通过。Allow-Credentials 与 Max-Age 分别控制能否带 cookie 和预检缓存多久，Vary: Origin 保证多来源时缓存不会串。",
        },
        practiceSteps: [
          "在浏览器 Network 面板找一条跨源请求，确认它前面有没有 OPTIONS，以及预检响应里的 Allow-Methods 与 Allow-Headers 是否覆盖你的请求。",
          "把 fetch 改成 PUT 并加一个自定义头 x-trace-id，观察请求从简单请求变成需要预检。",
          "把服务端 Allow-Origin 临时改成通配符，同时打开 credentials: 'include'，在控制台确认浏览器的报错信息。",
          "给服务端响应补上 Vary: Origin，并说明多来源场景下不加会造成什么缓存问题。",
        ],
        masteryChecklist: [
          "能判断一个请求是简单请求还是需要预检。",
          "能解释带凭证时为什么必须回显具体 Origin。",
          "能区分 CORS 失败与 HTTP 401、500 的区别：前者连响应体都读不到。",
        ],
        summary: [
          "同源等于协议、主机、端口三者完全一致。",
          "CORS 由服务端声明、浏览器执行，改前端代码无效。",
          "非简单请求先 OPTIONS 预检，预检失败真实请求不发出。",
          "带凭证不能用通配符，必须回显 Origin 且允许凭证。",
          "跨源响应加 Vary: Origin，避免缓存串源。",
        ],
        terms: [
          {
            term: "同源策略（Same-Origin Policy）",
            plain: "只让脚本读自己网站的数据，别的站不让读。",
            detail:
              "限制的是读取，不是发送。所以跨站表单能提交、图片能加载，但响应内容 JS 拿不到。它是浏览器安全模型的基石，不是服务器端的能力。",
          },
          {
            term: "预检（Preflight）",
            plain: "正式请求前先问一句**我能这么请求吗**。",
            detail:
              "用 OPTIONS 方法发，声明想用的方法与头。预检不通过，真实请求根本不会发出，所以调试时只看到一条失败的 OPTIONS，业务接口日志里什么都没有。",
          },
          {
            term: "凭证（Credentials）",
            plain: "请求要不要带上 cookie、Authorization 这类身份信息。",
            detail:
              "fetch 默认不带跨源 cookie，需要 credentials: 'include'。开启后服务端必须精确允许来源，不能用通配符，否则浏览器会拒绝。",
          },
          {
            term: "简单请求（Simple Request）",
            plain: "不用预检、浏览器直接发出的那种跨源请求。",
            detail:
              "限定 GET、HEAD、POST，头只能是少数安全头，Content-Type 只能是表单那三种。一旦用 application/json 或加自定义头，就不再是简单请求。",
          },
          {
            term: "跨源（Cross-Origin）",
            plain: "协议、域名、端口里有一项跟当前页面不一样。",
            detail:
              "https 与 http 之间算跨源，子域之间也算，同域名不同端口同样算。本地开发时前端 3000 端口调后端 8080 端口，就是最常见的一例。",
          },
        ],
      },
    },
    questions: [
      {
        key: "javascript-exp-js-cors-credentials-s1",
        stageKey: "js-async-browser",
        topicKey: "js-cors-credentials",
        type: "single",
        stem: "页面 https://app.example.com 用 fetch 请求 https://api.example.com，并且需要携带 cookie，下面哪种服务端配置是正确的？",
        options: [
          { key: "A", text: "Allow-Origin 写通配符，再加 Allow-Credentials: true" },
          { key: "B", text: "Allow-Origin 回显 https://app.example.com，并返回 Allow-Credentials: true" },
          { key: "C", text: "只返回 Allow-Origin: https://app.example.com 就够了，cookie 会自动带上" },
          { key: "D", text: "不需要任何响应头，浏览器会自动允许带 cookie 的跨源请求" },
        ],
        answer: ["B"],
        explanation:
          "凭证模式下浏览器要求 Allow-Origin 回显具体来源，不能用通配符，同时必须显式返回 Allow-Credentials: true，两个条件缺一不可。C 缺了凭证允许，浏览器不会把响应交给 JS；A 用了通配符，浏览器会直接拒绝响应；D 完全违背同源策略。这也说明为什么把来源写成通配符再去带 cookie 是行不通的。",
        difficulty: "medium",
        tags: ["CORS", "凭证", "跨域"],
        sourceKey: "mdn-reference",
        level: "进阶",
      },
      {
        key: "javascript-exp-js-cors-credentials-j1",
        stageKey: "js-async-browser",
        topicKey: "js-cors-credentials",
        type: "judge",
        stem: "用命令行工具请求同一个接口能看到完整响应，说明浏览器里的 CORS 报错其实是服务端的权限校验失败。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "CORS 是浏览器的检查：浏览器拿到响应后核对 Allow-Origin 等响应头，不合格就把响应体丢掉并报错。命令行工具不是浏览器，不执行这套检查，所以能看到响应。反过来说，命令行通而页面不通，几乎总是 CORS 配置问题，而不是接口鉴权问题。",
        difficulty: "medium",
        tags: ["CORS", "同源策略", "调试"],
        sourceKey: "freecodecamp-js",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "javascript",
    stageKey: "js-engineering",
    topic: {
      key: "js-bundle-tree-shaking",
      title: "打包、Tree Shaking 与副作用",
      summary:
        "Tree Shaking 靠 ESM 的静态结构在构建期判断**这个导出没人用而且没有副作用**，才敢删；一旦有顶层副作用或 CJS 依赖，打包器只能保守保留。",
      concepts: ["ESM 静态分析", "副作用 sideEffects", "死代码消除", "代码分割"],
      principles: [
        "ESM 的 import 与 export 只能在顶层、路径必须是字面量，构建工具不执行代码就能画出依赖图，这是摇树的前提。",
        "只有未被引用且无副作用的代码才能删，顶层调用函数、改全局对象、注册 polyfill 都算副作用。",
        "package.json 的 sideEffects 字段是给打包器的提示，写错会误删样式或全局注册代码。",
        "压缩只缩短标识符、删空白，不判断代码是否可达；删代码靠 tree shaking 与死代码消除。",
      ],
      applications: [
        "只从工具库导入真正用到的那几个函数，避免整包进入产物。",
        "按路由拆 chunk，把首屏用不到的页面和大依赖拆出去按需加载。",
        "发布库时正确声明 sideEffects 与 module 字段，让使用方的打包器能摇树。",
      ],
      pitfalls: [
        "sideEffects 声明为 false 而包里含 CSS 导入或全局注册，使用方打包后样式丢失。",
        "依赖是 CommonJS 写法，导出可以动态生成，打包器无法静态分析，往往整包保留。",
        "用 import * 取整个命名空间再以动态键访问成员，打包器无法静态确定用了哪些导出，只能保守保留。",
      ],
      method:
        "先用打包分析产物看谁占体积，再检查对应依赖是否提供 ESM 构建、导出是否被静态引用、sideEffects 是否声明正确，最后按路由做代码分割。",
      exercise:
        "拿一个只用一个函数的工具库，分别用整包导入与具名导入打包，对比产物体积，并用 metafile 找出差异来源。",
      checkpoint:
        "能解释为什么**ESM 加具名导入**才可能被摇树，以及 sideEffects 写错会造成什么后果。",
      lesson: {
        overview: [
          "Tree Shaking 这个名字很形象：把依赖图当成一棵树，没人走到的分支就剪掉。但它是构建期的静态分析，不是运行时的聪明优化，打包器不会执行你的代码，只能看 import 与 export 的结构。所以能被摇掉的前提是：依赖关系一眼看得出来，且被删的代码不会产生副作用。缺了任何一条，工具都只能保守处理。",
          "为什么强调 ESM？因为 ESM 的导入导出必须在顶层，模块路径必须是字符串字面量，打包器读一遍源码就知道谁引用了谁。CommonJS 的 require 可以写在 if 里、路径可以拼出来，导出还能随时挂到 exports 上，静态分析根本无从下手，于是只能整包保留。这也是同一个库提供 ESM 版本后，产物体积明显下降的原因。",
          "副作用是另一个判据，也是最容易出事的地方。一个模块即使没人使用它的导出，只要它在顶层执行了动作，比如注册自定义元素、注入样式、修改全局对象，删掉就会改变程序行为，打包器必须保留。sideEffects 字段让你用声明的方式告诉打包器哪些文件有副作用：声明得准，产物才小；声明错了，线上就少样式或者少注册逻辑。",
        ],
        mechanism: [
          "构建工具先解析入口文件，递归读取每个模块的 import 与 export，建立一张模块依赖图，并为每个导出记录它被谁引用过。这一步完全不需要执行代码，只看语法结构，所以代码写成什么模块规范，直接决定了分析的质量。",
          "接下来从入口开始做可达性分析：被引用到的导出保留下来，没被引用到的标记为可删除；然后再叠加副作用判定，只要一个模块在顶层执行过动作，即使没有任何地方引用它，也必须保留，因为删掉之后程序行为就变了。",
          "压缩阶段会做死代码消除：删掉恒假分支、return 之后不可达的语句、从未使用过的局部变量。它和 tree shaking 作用的层级不同，一个删的是模块级别的导出，一个删的是函数内部的语句，两者常常一起工作，但不要混为一谈。",
          "代码分割走的是另一条路：把首屏不需要的模块拆成独立的 chunk，运行时再按需加载。摇树减少的是单个包里的冗余代码，分割减少的是首屏必须下载的字节数，两者互补，缺掉任何一个都可能让页面变慢。",
        ],
        example: {
          title: "用 sideEffects 白名单告诉打包器谁不能删",
          language: "json",
          code: "{\n  \"name\": \"web-app\",\n  \"type\": \"module\",\n  \"sideEffects\": [\"**/*.css\", \"./src/polyfills.js\"],\n  \"scripts\": {\n    \"build\": \"esbuild src/main.js --bundle --format=esm --splitting --minify --sourcemap --outdir=dist\",\n    \"analyze\": \"esbuild src/main.js --bundle --format=esm --metafile=meta.json --outdir=dist\"\n  }\n}",
          explanation:
            "sideEffects 是一个白名单：列出确实有副作用的文件（样式与 polyfill），其余模块只要没被引用就可以安全删除。如果图省事写成 false，打包器会把 CSS 导入也当成无用代码删掉，线上就没有样式；反过来全标成有副作用，摇树直接失效。构建命令里 --format=esm 与 --splitting 配合才能按需拆出独立 chunk，--sourcemap 让你在分析产物时能对回源码，--metafile 则给出每个模块的体积明细。",
        },
        practiceSteps: [
          "写两个模块，一个导出被使用、一个导出没人用，用 esbuild --bundle 打包后搜索产物里是否还留有后者。",
          "给 package.json 加上 sideEffects: false，再引入一个只做全局注册的模块，观察它是否被删掉。",
          "用 --metafile=meta.json 生成分析文件，找出产物里体积最大的三个模块。",
          "把具名导入改成整包导入并动态取属性，对比两次产物体积，解释差异来自哪里。",
        ],
        masteryChecklist: [
          "能解释 ESM 相比 CommonJS 为什么更容易被静态分析。",
          "能说出 tree shaking 的两个前提：未被引用、无副作用。",
          "能说明 sideEffects 声明错误会导致什么线上问题。",
        ],
        summary: [
          "摇树是构建期静态分析，不是运行时优化。",
          "ESM 的静态结构是前提，CJS 往往整包保留。",
          "只有未被引用且无副作用的代码才可删。",
          "sideEffects 白名单写错会误删样式或注册逻辑。",
          "压缩只缩短名字，减体积靠摇树与代码分割。",
        ],
        terms: [
          {
            term: "Tree Shaking",
            plain: "把没人用到的代码像枯枝一样剪掉。",
            detail:
              "它不是压缩，而是删除整个未被引用的导出或模块。前提是依赖关系能被静态确定，所以 ESM 才友好；CJS 写法会让它基本失效。",
          },
          {
            term: "副作用（Side Effect）",
            plain: "模块被加载时顺手干了别的事，比如改全局或注入样式。",
            detail:
              "有副作用的模块即使没人用也不能删，因为删了行为就变了。判断标准看它是否在顶层执行了动作，而不只是声明函数和变量。",
          },
          {
            term: "死代码消除（DCE）",
            plain: "删掉永远执行不到的代码。",
            detail:
              "常见于恒假分支、return 之后的语句、未使用的局部变量。它发生在函数内部，和针对模块导出的 tree shaking 不是一个层级，两者常配合使用。",
          },
          {
            term: "代码分割（Code Splitting）",
            plain: "把代码拆成多个包，用到时再下载。",
            detail:
              "和摇树互补：摇树减少冗余，分割减少首屏下载量。典型做法是按路由拆分，配合动态 import 使用，注意拆得太碎会增加请求数。",
          },
          {
            term: "打包器（Bundler）",
            plain: "把一堆模块拼成浏览器能直接跑的文件。",
            detail:
              "webpack、Rollup、esbuild、Vite 都算。它们的摇树能力有差异，但都依赖 ESM 的静态结构，所以写法比工具更重要。",
          },
        ],
      },
    },
    questions: [
      {
        key: "javascript-exp-js-bundle-tree-shaking-s1",
        stageKey: "js-engineering",
        topicKey: "js-bundle-tree-shaking",
        type: "single",
        stem: "关于 Tree Shaking，下面哪一句是正确的？",
        options: [
          { key: "A", text: "它发生在运行时，浏览器会自动跳过没有被执行的函数" },
          { key: "B", text: "它依赖构建期的静态分析，只有未被引用且无副作用的代码才会被删除" },
          { key: "C", text: "只要开启压缩 minify，所有没用的代码都会被删掉" },
          { key: "D", text: "把代码写成 CommonJS 比 ESM 更容易被摇树" },
        ],
        answer: ["B"],
        explanation:
          "摇树是打包阶段的静态分析：先看谁引用了谁，再判断被删代码有没有副作用，两个条件都满足才会删。minify 只做缩短与去空白，不判断可达性；CJS 的导出可以动态生成，打包器无法静态确定，反而更难摇。运行时跳过没执行的分支属于引擎的惰性优化，和摇树不是一回事。",
        difficulty: "hard",
        tags: ["Tree Shaking", "ESM", "构建"],
        sourceKey: "mdn-reference",
        level: "综合",
      },
      {
        key: "javascript-exp-js-bundle-tree-shaking-j1",
        stageKey: "js-engineering",
        topicKey: "js-bundle-tree-shaking",
        type: "judge",
        stem: "package.json 里写 sideEffects: false，可以让打包器放心删除所有未被引用的模块代码，包括那些在顶层注册全局行为的模块。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "sideEffects: false 的含义是本包所有文件都没有副作用，打包器据此连顶层注册代码也会删，这恰恰是危险的：注册全局行为、注入样式的模块必须列进白名单。正确做法是写数组，只把真正有副作用的文件列出来，否则线上会出现样式丢失或组件未注册这类难查问题。",
        difficulty: "medium",
        tags: ["sideEffects", "打包", "踩坑"],
        sourceKey: "freecodecamp-js",
        level: "进阶",
      },
    ],
  },
  {
    trackSlug: "javascript",
    stageKey: "js-modern-frontend",
    topic: {
      key: "js-web-components-shadow-dom",
      title: "自定义元素与 Shadow DOM",
      summary:
        "Web Components 是浏览器原生能力：customElements.define 注册带连字符的标签，Shadow DOM 提供 DOM 与样式隔离，slot 把外部内容嵌进组件内部。",
      concepts: ["自定义元素", "Shadow DOM", "slot 插槽", "生命周期回调"],
      principles: [
        "自定义元素名必须包含连字符，且同一名字全局只能定义一次，重复 define 会抛错。",
        "Shadow DOM 的样式默认双向隔离：外部选择器选不到内部节点，内部样式也不会泄漏到页面。",
        "生命周期顺序大致是 constructor、attributeChangedCallback、connectedCallback，移除时触发 disconnectedCallback。",
        "attribute 是 HTML 上的字符串，property 是 JS 对象上的值，两者需要手动同步。",
      ],
      applications: [
        "做跨框架的设计系统组件，React、Vue 和老页面都能直接使用同一个标签。",
        "在宿主页面里嵌入第三方内容时，用 Shadow DOM 隔离样式冲突。",
        "给老系统做渐进式增强，用自定义元素包裹一小块新交互。",
      ],
      pitfalls: [
        "在 constructor 里读取子节点或 attribute，此时元素可能还没就绪，应该放到 connectedCallback。",
        "忘了在 observedAttributes 里声明属性名，导致 attributeChangedCallback 永远不触发。",
        "以为 document.querySelector 能选中影子树内部节点，其实必须从宿主元素的 shadowRoot 进去。",
      ],
      method:
        "先确定组件的对外接口（属性、事件、插槽），再写结构；读写 DOM 放 connectedCallback，属性同步放 attributeChangedCallback，清理放 disconnectedCallback。",
      exercise:
        "实现一个 user-card 自定义元素：支持 name 属性、内部样式隔离、默认插槽显示职位，并在属性变化时更新界面。",
      checkpoint:
        "能说清 attribute 与 property 的区别，以及为什么重复注册同名自定义元素会报错。",
      lesson: {
        overview: [
          "Web Components 不是框架，而是几个浏览器标准合起来的能力：customElements 定义标签、Shadow DOM 隔离 DOM 与样式、template 存模板、slot 做内容分发。它是浏览器原生标准，所以不依赖打包器与运行时库。它的独特价值是跨框架，写一次，React、Vue 甚至十年前的 jQuery 页面都能直接使用同一个标签。这在设计系统、微前端、第三方嵌入场景里特别有用。",
          "Shadow DOM 解决的是样式互相污染的老问题。页面里一个全局的 .title 样式，本来会同时命中你组件内部的标题；有了影子树，内部样式自成作用域，外部选择器也进不来。代价是调试和取元素的方式变了，document.querySelector 看不到内部节点，必须从宿主元素的 shadowRoot 进去，这是新手最常卡住的一步。",
          "什么时候该用它？如果团队已经重度使用某个框架，优先用框架的组件模型，因为生态、状态管理、服务端渲染都更成熟。Web Components 更适合需要被任意环境消费的组件：设计系统、嵌入式小部件、渐进式改造老页面。它的短板也明显：传对象类型的属性不方便、服务端渲染支持弱、样式定制要靠 CSS 变量。",
        ],
        mechanism: [
          "浏览器解析到带连字符的未知标签时，会先创建一个普通的 HTMLElement。等到调用 customElements.define 注册之后，已经存在的元素会被升级：原型换成你写的类，执行 constructor，再补触 attributeChangedCallback 与 connectedCallback。注册之后新建的元素走正常创建流程，不再需要升级，这也解释了为什么自定义元素在注册前后表现不一致。",
          "attachShadow 会在宿主元素下面建立一棵独立的影子树，它有自己的样式作用域。:host 选择器指向宿主本身，::slotted() 才能从组件内部选中被插槽分发进来的节点，两者分工不同，不能互相替代。同时影子树内部的样式也不会影响页面其它部分，这正是样式隔离的另一半。",
          "插槽里的内容其实属于外部文档，也就是 light DOM，所以它受页面样式的控制，组件内部写的样式管不到它。这就是样式跟着内容来源走的直觉来源，也是很多人发现插槽内容的样式怎么都不生效的原因。",
          "observedAttributes 是一个静态数组，浏览器只对其中列出的属性触发 attributeChangedCallback，没列出来的属性怎么改都不会通知你。想监听多个属性，就把名字都写进这个数组，并在回调里用第一个参数区分是哪个属性变了。注意 HTML 里的属性名会被统一转成小写，所以数组里也写小写形式。",
        ],
        example: {
          title: "带样式隔离与插槽的 user-card",
          language: "javascript",
          code: "class UserCard extends HTMLElement {\n  // 只有这里声明过的属性变化才会触发 attributeChangedCallback\n  static observedAttributes = ['name'];\n\n  // 构造式样式表：不往影子树里塞 style 标签，样式作用域依然是隔离的\n  static styles = (() => {\n    const sheet = new CSSStyleSheet();\n    sheet.replaceSync(\n      ':host { display: block; border: 1px solid #ddd; padding: 8px; }' +\n      '.name { font-weight: 600; }'\n    );\n    return sheet;\n  })();\n\n  constructor() {\n    super();\n    const root = this.attachShadow({ mode: 'open' });\n    root.adoptedStyleSheets = [UserCard.styles];\n    root.innerHTML = '<div class=\"name\"></div><slot></slot>';\n    this._name = root.querySelector('.name');\n  }\n\n  connectedCallback() {\n    this._name.textContent = this.getAttribute('name') || '';\n  }\n\n  attributeChangedCallback(attr, oldValue, newValue) {\n    if (attr === 'name' && this._name) {\n      this._name.textContent = newValue || '';\n    }\n  }\n}\n\ncustomElements.define('user-card', UserCard);\n\n// 页面里直接使用，插槽内容会落到 slot 的位置\n// <user-card name=\"Ada\">前端工程师</user-card>",
          explanation:
            "这段代码展示了三个关键点。第一，observedAttributes 只声明了 name，所以只有 name 变化才回调，其它属性改了没有通知。第二，样式写在影子树里并用 :host 定位宿主，页面上的全局样式影响不到内部，内部也不会污染页面。第三，属性同步放在 attributeChangedCallback，首次渲染放在 connectedCallback，因为升级时机可能早于属性就绪。使用时写成 user-card 标签，标签之间的文字会自动落到 slot 的位置。",
        },
        practiceSteps: [
          "写一个最小自定义元素，在四个生命周期回调里各打印一句，观察升级与插入文档分别触发什么。",
          "在页面加一条全局样式 div { color: red }，验证影子树内部的 div 是否受影响。",
          "把 observedAttributes 清空，再改元素属性，确认 attributeChangedCallback 不再触发。",
          "用 slot 做两个命名插槽，对比 ::slotted() 与内部选择器各自能选中哪些节点。",
        ],
        masteryChecklist: [
          "能说出自定义元素名的命名限制与重复 define 的后果。",
          "能解释 Shadow DOM 的双向样式隔离，以及取内部节点方式的改变。",
          "能区分 constructor、connectedCallback、attributeChangedCallback 各自的职责。",
        ],
        summary: [
          "自定义元素名必须带连字符，重复 define 同名会抛错。",
          "Shadow DOM 隔离 DOM 与样式，:host 指宿主，::slotted 管插槽。",
          "observedAttributes 决定哪些属性变化会触发回调。",
          "attribute 是字符串，property 是 JS 值，需要手动同步。",
          "跨框架消费是它最大价值，服务端渲染与复杂数据传输是短板。",
        ],
        terms: [
          {
            term: "Web Components",
            plain: "浏览器原生的一套自定义标签能力。",
            detail:
              "由 customElements、Shadow DOM、template、slot 几个标准组成。它不是框架，也不需要打包器，浏览器直接支持，所以能跨框架复用。",
          },
          {
            term: "自定义元素（Custom Element）",
            plain: "你自己定义、能在 HTML 里直接写的标签。",
            detail:
              "名字必须含连字符，用来和未来可能出现的 HTML 标准标签区分。注册后浏览器一遇到这个标签就会实例化你的类，已有元素也会被升级。",
          },
          {
            term: "影子树（Shadow DOM）",
            plain: "藏在元素内部、样式和外层互不干扰的一棵小 DOM。",
            detail:
              "mode 为 open 时外部可以通过 host.shadowRoot 访问，closed 则拿不到引用。开发者工具里会显示 #shadow-root，调试时别在顶层找内部节点。",
          },
          {
            term: "插槽（slot）",
            plain: "组件内部留的坑，外面写的内容会填进去。",
            detail:
              "内容仍属于外部文档，所以外部样式能作用于它；组件内部想给它加样式必须用 ::slotted()，而且 ::slotted 只能选到插槽的一级子节点。",
          },
          {
            term: "生命周期回调（Lifecycle Callback）",
            plain: "元素被创建、插入、移除、属性变化时自动调用的函数。",
            detail:
              "constructor 里拿不到子节点，connectedCallback 才是安全的初始化时机；移除时要记得在 disconnectedCallback 里清定时器和监听器，否则会泄漏。",
          },
        ],
      },
    },
    questions: [
      {
        key: "javascript-exp-js-web-components-shadow-dom-s1",
        stageKey: "js-modern-frontend",
        topicKey: "js-web-components-shadow-dom",
        type: "single",
        stem: "关于自定义元素与 Shadow DOM，下面哪一句是正确的？",
        options: [
          { key: "A", text: "自定义元素名可以随便写，比如 usercard 或 card" },
          { key: "B", text: "只有在 observedAttributes 里声明过的属性名，变化时才会触发 attributeChangedCallback" },
          { key: "C", text: "document.querySelector 可以直接选中影子树内部的节点" },
          { key: "D", text: "attachShadow 之后，外部的全局样式依然会作用到影子树内部" },
        ],
        answer: ["B"],
        explanation:
          "只有被 observedAttributes 列出的属性变化才会触发回调，这是浏览器做的一次过滤，没声明的属性改了不会通知。自定义元素名必须含连字符，否则注册直接抛错；影子树内部节点要通过宿主元素的 shadowRoot 查询，document.querySelector 进不去；影子树样式默认隔离，外部全局样式不会渗入。",
        difficulty: "medium",
        tags: ["Web Components", "Shadow DOM", "自定义元素"],
        sourceKey: "mdn-reference",
        level: "进阶",
      },
      {
        key: "javascript-exp-js-web-components-shadow-dom-j1",
        stageKey: "js-modern-frontend",
        topicKey: "js-web-components-shadow-dom",
        type: "judge",
        stem: "在自定义元素的 constructor 里读取 this.children 或 attribute，是最稳妥的初始化方式。",
        options: [
          { key: "A", text: "正确" },
          { key: "B", text: "错误" },
        ],
        answer: ["B"],
        explanation:
          "constructor 的触发时机可能早于属性与子节点就绪，尤其是浏览器升级已经存在的元素时，此时读到的是空值。正确做法是把依赖 DOM 与属性的初始化放到 connectedCallback，把属性同步放到 attributeChangedCallback。规范还限制了 constructor 里不能添加子节点或修改属性。",
        difficulty: "hard",
        tags: ["生命周期", "自定义元素", "DOM"],
        sourceKey: "mdn-reference",
        level: "综合",
      },
    ],
  },
];
