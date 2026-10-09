import { topicQuestionPair } from "../topic-question-builders";
import type { LearningQuestion } from "../types";

export const javascriptTopicQuestions: LearningQuestion[] = [
  ...topicQuestionPair(
    "js-values-scope",
    "js-language",
    {
      stem: "`const user = { name: 'Lin' }; user.name = 'Yu'` 会发生什么？",
      options: ["赋值报错", "对象被修改", "user 变成字符串", "创建新对象"],
      answer: "B",
      explanation: "const 禁止重新绑定变量，但不冻结对象；修改对象属性仍然合法。",
      difficulty: "easy",
      tags: ["const", "对象"],
      sourceKey: "mdn-reference",
    },
    {
      stem: "对象浅拷贝后，嵌套对象仍然可能与原对象共享引用。",
      answer: true,
      explanation: "浅拷贝只复制第一层，嵌套对象引用不变，修改后可能同时影响两个状态。",
      difficulty: "medium",
      tags: ["浅拷贝", "引用"],
      sourceKey: "mdn-reference",
    }
  ),
  ...topicQuestionPair(
    "js-functions-closures",
    "js-language",
    {
      stem: "箭头函数中的 `this` 由什么决定？",
      options: ["调用时的对象", "外层词法作用域", "函数名", "new 关键字"],
      answer: "B",
      explanation: "箭头函数没有自己的 this，会捕获定义位置外层的 this。",
      difficulty: "medium",
      tags: ["箭头函数", "this"],
      sourceKey: "mdn-reference",
    },
    {
      stem: "闭包会延长被引用变量的生命周期。",
      answer: true,
      explanation: "只要闭包仍可达，其词法环境中的变量就不会被回收，直到闭包本身也不再需要。",
      difficulty: "medium",
      tags: ["闭包", "生命周期"],
      sourceKey: "mdn-reference",
    }
  ),
  ...topicQuestionPair(
    "js-collections",
    "js-language",
    {
      stem: "需要按对象引用作为键保存数据，优先选择什么结构？",
      options: ["普通对象", "Map", "JSON 字符串", "数组"],
      answer: "B",
      explanation: "普通对象键会被转成字符串，Map 支持对象引用等任意键类型。",
      difficulty: "medium",
      tags: ["Map", "键"],
      sourceKey: "mdn-reference",
    },
    {
      stem: "数组的 `sort` 方法默认返回新数组，不会修改原数组。",
      answer: false,
      explanation: "sort 会原地排序并返回同一数组，需要保留原顺序时应先复制。",
      difficulty: "easy",
      tags: ["sort", "原地修改"],
      sourceKey: "mdn-reference",
    }
  ),
  ...topicQuestionPair(
    "js-event-loop",
    "js-async-browser",
    {
      stem: "同步代码执行结束后，通常先执行哪类任务？",
      options: ["微任务", "下一个宏任务", "渲染", "网络请求"],
      answer: "A",
      explanation: "当前调用栈清空后先清空微任务队列，再执行下一轮宏任务和渲染机会。",
      difficulty: "medium",
      tags: ["事件循环", "微任务"],
      sourceKey: "mdn-reference",
    },
    {
      stem: "Promise 可以把 CPU 密集计算自动放到另一个线程。",
      answer: false,
      explanation: "Promise 只安排异步结果，CPU 计算仍在主线程执行，需要用 Worker 等机制并行。",
      difficulty: "medium",
      tags: ["事件循环", "阻塞"],
      sourceKey: "mdn-reference",
    }
  ),
  ...topicQuestionPair(
    "js-promises",
    "js-async-browser",
    {
      stem: "多个独立请求都成功才继续时，通常使用哪个组合器？",
      options: ["Promise.race", "Promise.all", "Promise.resolve", "setTimeout"],
      answer: "B",
      explanation: "Promise.all 等待所有成功，任一拒绝则整体拒绝，适合强依赖全部结果的场景。",
      difficulty: "easy",
      tags: ["Promise.all", "并发"],
      sourceKey: "mdn-reference",
    },
    {
      stem: "Promise.allSettled 会保留每个请求的成功或失败结果。",
      answer: true,
      explanation: "allSettled 等待全部完成并返回 fulfilled/rejected 状态，适合允许部分失败的场景。",
      difficulty: "medium",
      tags: ["allSettled", "部分失败"],
      sourceKey: "mdn-reference",
    }
  ),
  ...topicQuestionPair(
    "js-dom-network",
    "js-async-browser",
    {
      stem: "`fetch` 收到 HTTP 500 时通常表现为什么？",
      options: ["Promise reject", "返回 response 但 response.ok 为 false", "自动重试", "返回 null"],
      answer: "B",
      explanation: "fetch 只在网络层失败时 reject，HTTP 状态错误仍要通过 response.ok 或 status 检查。",
      difficulty: "medium",
      tags: ["fetch", "HTTP"],
      sourceKey: "mdn-reference",
    },
    {
      stem: "事件委托利用事件冒泡，让父元素统一处理多个子元素事件。",
      answer: true,
      explanation: "父元素监听器通过事件目标和 closest 判断具体子元素，减少重复监听器。",
      difficulty: "easy",
      tags: ["事件委托", "冒泡"],
      sourceKey: "mdn-reference",
    }
  ),
  ...topicQuestionPair(
    "js-modules",
    "js-engineering",
    {
      stem: "模块边界的核心目标是什么？",
      options: ["增加文件数量", "隐藏内部实现并暴露稳定接口", "避免所有依赖", "让变量全局可见"],
      answer: "B",
      explanation: "模块通过公开接口隔离实现细节，让依赖方向和测试边界更清晰。",
      difficulty: "easy",
      tags: ["模块", "接口"],
      sourceKey: "mdn-reference",
    },
    {
      stem: "循环依赖在任何情况下都不会影响模块初始化顺序。",
      answer: false,
      explanation: "循环依赖可能让模块在尚未完成初始化时被读取，导致 undefined 或难以定位的时序问题。",
      difficulty: "medium",
      tags: ["循环依赖", "初始化"],
      sourceKey: "mdn-reference",
    }
  ),
  ...topicQuestionPair(
    "js-testing",
    "js-engineering",
    {
      stem: "测试覆盖率最准确的用途是什么？",
      options: ["证明没有缺陷", "发现未执行代码区域", "替代集成测试", "衡量代码行数"],
      answer: "B",
      explanation: "覆盖率提示哪些代码未被测试执行，但不能证明断言质量或行为正确。",
      difficulty: "easy",
      tags: ["覆盖率", "测试"],
      sourceKey: "mdn-reference",
    },
    {
      stem: "异步测试应依赖真实等待时间而不是明确等待 Promise 或条件。",
      answer: false,
      explanation: "固定延迟会制造不稳定测试，应等待明确的 Promise、事件或可观察条件。",
      difficulty: "medium",
      tags: ["异步测试", "稳定性"],
      sourceKey: "mdn-reference",
    }
  ),
  ...topicQuestionPair(
    "js-browser-data",
    "js-engineering",
    {
      stem: "需要跨请求自动携带且防止脚本读取的认证信息，通常适合什么存储？",
      options: ["localStorage", "HttpOnly Cookie", "普通全局变量", "URL 参数"],
      answer: "B",
      explanation: "HttpOnly Cookie 不能由页面脚本读取，并可按域、路径和安全属性随请求发送。",
      difficulty: "medium",
      tags: ["Cookie", "安全"],
      sourceKey: "mdn-reference",
    },
    {
      stem: "键盘用户无需看到焦点位置，只要功能能用鼠标完成即可。",
      answer: false,
      explanation: "可访问界面需要可见焦点、合理顺序和键盘操作，否则键盘用户无法判断当前位置。",
      difficulty: "easy",
      tags: ["无障碍", "焦点"],
      sourceKey: "mdn-reference",
    }
  ),
  ...topicQuestionPair(
    "js-components",
    "js-modern-frontend",
    {
      stem: "受控表单中，输入值通常由谁维护？",
      options: ["DOM 隐藏状态", "父组件或明确的状态所有者", "CSS", "浏览器缓存"],
      answer: "B",
      explanation: "受控组件把值放在明确状态源，输入事件只通知变化，便于校验和同步。",
      difficulty: "medium",
      tags: ["受控组件", "状态"],
      sourceKey: "mdn-reference",
    },
    {
      stem: "组件列表使用索引作为 key 时，在插入和删除场景下通常是稳定选择。",
      answer: false,
      explanation: "索引会随位置变化，可能导致状态错配；应优先使用稳定业务 id。",
      difficulty: "medium",
      tags: ["组件", "key"],
      sourceKey: "mdn-reference",
    }
  ),
  ...topicQuestionPair(
    "js-state-render",
    "js-modern-frontend",
    {
      stem: "可以从现有状态计算出来的值，通常应如何处理？",
      options: ["再存一份 state", "直接派生计算", "写入 localStorage", "每帧随机生成"],
      answer: "B",
      explanation: "派生值从单一真相计算，避免多个状态不同步。",
      difficulty: "easy",
      tags: ["派生状态", "单一真相"],
      sourceKey: "mdn-reference",
    },
    {
      stem: "副作用清理函数在组件卸载或依赖变化前执行。",
      answer: true,
      explanation: "清理用于取消订阅、中止请求或移除监听器，避免重复执行和过期数据。",
      difficulty: "medium",
      tags: ["副作用", "清理"],
      sourceKey: "mdn-reference",
    }
  ),
  ...topicQuestionPair(
    "js-performance",
    "js-modern-frontend",
    {
      stem: "动态 import 最直接的价值是什么？",
      options: ["让代码更短", "按需下载非首屏代码", "自动修复错误", "替代测试"],
      answer: "B",
      explanation: "动态导入把模块拆成独立资源，只在需要时下载和执行，降低首屏成本。",
      difficulty: "easy",
      tags: ["代码分割", "性能"],
      sourceKey: "mdn-reference",
    },
    {
      stem: "错误边界可以捕获事件处理器中的异步错误并自动恢复。",
      answer: false,
      explanation: "错误边界主要捕获渲染期间错误，事件处理器和异步逻辑仍需显式错误处理。",
      difficulty: "hard",
      tags: ["错误边界", "异步"],
      sourceKey: "mdn-reference",
    }
  ),
];
