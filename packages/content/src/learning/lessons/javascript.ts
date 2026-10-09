import type { LearningTopicLesson } from "../types";

export const javascriptTopicLessons: Record<string, LearningTopicLesson> = {
  "js-values-scope": {
    overview: [
      "JavaScript 的变量是对值的绑定。原始值按值比较，对象按引用身份比较；`const` 只禁止重新绑定，不禁止修改对象内部属性。",
      "作用域由代码书写位置决定。块级作用域中的 `let/const` 不会泄漏到块外，闭包则保留词法环境中仍被引用的变量。",
    ],
    mechanism: [
      "`let` 存在暂时性死区，声明前访问会抛错；`var` 会被提升到函数作用域并初始化为 undefined。",
      "对象浅拷贝只复制第一层，嵌套对象仍共享引用；更新嵌套状态时应复制到变化的路径，避免修改原对象。",
    ],
    example: {
      title: "安全更新嵌套对象",
      language: "javascript",
      code: `const state = {
  user: { name: "Lin", tags: ["vip"] },
  count: 1,
};

const next = {
  ...state,
  user: {
    ...state.user,
    tags: [...state.user.tags, "new"],
  },
};

console.log(state.user.tags); // ["vip"]
console.log(next.user.tags);  // ["vip", "new"]`,
      explanation: "复制对象和数组到变更路径，得到新状态而不是修改原状态。浅拷贝只处理每一层需要变化的节点，行为可预测。",
    },
    practiceSteps: [
      "比较 `==` 和 `===` 在 null、数字和字符串上的结果。",
      "写出一个 `var`、`let` 和作用域组合的输出题。",
      "实现一个只更新指定字段的不可变对象函数。",
    ],
    masteryChecklist: [
      "能解释原始值和对象引用的比较差异。",
      "能说明浅拷贝为何仍可能共享嵌套对象。",
    ],
  },
  "js-functions-closures": {
    overview: [
      "函数是一等值，可以赋值、传参和返回。闭包是函数与其创建时词法环境的组合，即使外层函数已返回，内部变量仍可被访问。",
      "`this` 不由函数定义位置决定，而由调用方式决定；箭头函数没有自己的 this，会继承外层词法环境。",
    ],
    mechanism: [
      "普通函数通过对象方法调用时 this 指向对象，单独调用在严格模式下为 undefined；`call/apply/bind` 可显式改变。",
      "闭包适合保存私有状态，但也会延长变量生命周期；循环中创建函数时尤其要确认每个闭包捕获的变量是否符合预期。",
    ],
    example: {
      title: "用闭包实现一次执行",
      language: "javascript",
      code: `function once(fn) {
  let called = false;
  let result;

  return function (...args) {
    if (!called) {
      called = true;
      result = fn.apply(this, args);
    }
    return result;
  };
}

const initialize = once(() => ({ ready: true }));`,
      explanation: "`called` 和 `result` 被返回函数捕获，只在该函数实例中可见。多次调用复用第一次结果，形成受控的一次性初始化。",
    },
    practiceSteps: [
      "实现 `debounce` 并验证最后一次调用才执行。",
      "用对象方法、赋值方法和箭头函数观察 this。",
      "用 `bind` 修复一个回调中的 this 问题。",
    ],
    masteryChecklist: [
      "能从词法位置说明闭包捕获了哪些变量。",
      "能根据调用方式判断 this 的指向。",
    ],
  },
  "js-collections": {
    overview: [
      "数组适合有序列表，对象适合固定字段记录，Map 支持任意类型键且保留插入顺序，Set 表达唯一值。",
      "`map`、`filter`、`reduce` 是数据转换工具，但复杂 reduce 可能降低可读性。先写出变换的输入输出，再决定是否链式组合。",
    ],
    mechanism: [
      "数组方法大多返回新数组或新值，不直接修改原数组；`sort` 和 `splice` 会原地修改，调用前应确认是否需要复制。",
      "Map 的键按引用身份比较，对象键不会自动按内容相等；Set 对相同引用去重，对内容相同但引用不同的对象仍视为不同。",
    ],
    example: {
      title: "用 Map 分组并用 reduce 汇总",
      language: "javascript",
      code: `const orders = [
  { user: "u1", amount: 30 },
  { user: "u2", amount: 20 },
  { user: "u1", amount: 10 },
];

const totals = orders.reduce((map, order) => {
  map.set(order.user, (map.get(order.user) ?? 0) + order.amount);
  return map;
}, new Map());

console.log([...totals]); // [["u1", 40], ["u2", 20]]`,
      explanation: "Map 以用户字符串为键累加金额，保留每个用户的总和。先明确键和累加值，再写 reduce 更容易检查。",
    },
    practiceSteps: [
      "用 Map 和普通对象分别实现分组并比较键语义。",
      "复制数组后排序，验证原数组是否保持不变。",
      "实现去重并说明原始值与对象引用的差异。",
    ],
    masteryChecklist: [
      "能根据键类型、顺序和唯一性选择集合。",
      "能区分原地修改和返回新集合的方法。",
    ],
  },
  "js-event-loop": {
    overview: [
      "JavaScript 主线程执行调用栈中的同步代码。当前任务结束后，微任务队列会优先清空，然后浏览器才有机会进行渲染或执行下一个宏任务。",
      "异步不代表并行执行 CPU 工作。长时间同步计算仍会阻塞事件循环，Promise 只是在任务完成后安排继续执行的时机。",
    ],
    mechanism: [
      "Promise 回调属于微任务，`setTimeout` 和事件回调属于宏任务；`await` 之后的代码相当于在 Promise 兑现后安排继续执行。",
      "微任务持续递归会产生饥饿，使渲染和用户事件无法运行；大计算应拆分任务或交给 Worker。",
    ],
    example: {
      title: "预测输出顺序",
      language: "javascript",
      code: `console.log("sync");

setTimeout(() => console.log("timeout"), 0);

Promise.resolve().then(() => console.log("microtask"));

console.log("end");

// sync
// end
// microtask
// timeout`,
      explanation: "同步代码先执行，当前调用栈清空后微任务先于下一轮宏任务。输出顺序反映任务队列而不是代码行顺序。",
    },
    practiceSteps: [
      "修改示例，加入第二个 Promise 和 setTimeout 继续预测。",
      "用一个阻塞循环验证页面无法处理事件。",
      "把大数组计算分块，观察界面是否恢复响应。",
    ],
    masteryChecklist: [
      "能区分宏任务、微任务和同步执行。",
      "能解释异步代码为何仍可能阻塞渲染。",
    ],
  },
  "js-promises": {
    overview: [
      "Promise 表示未来某个时间产生的结果，可能是值也可能是拒绝原因。错误会沿链传播，直到遇到 catch 或 unhandled rejection。",
      "async 函数始终返回 Promise，await 只是让异步结果以同步书写形式出现。并发请求要用 `Promise.all` 或 `allSettled` 控制，避免不必要的串行等待。",
    ],
    mechanism: [
      "`Promise.all` 在任一失败时拒绝，`Promise.allSettled` 返回每个请求的状态和值；取消通常需要 AbortController 或下游协议支持。",
      "超时不是 Promise 自带能力，需要与取消信号组合；超时后继续运行的任务仍可能占用资源。",
    ],
    example: {
      title: "并发请求并保留部分失败",
      language: "javascript",
      code: `async function loadUsers(ids) {
  const results = await Promise.allSettled(
    ids.map((id) => fetch("/users/" + id).then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }))
  );

  return results.map((result) =>
    result.status === "fulfilled" ? result.value : null
  );
}`,
      explanation: "每个用户独立请求，部分失败不会阻止其他结果返回。调用方仍需决定 null 是显示占位、重试还是记录错误。",
    },
    practiceSteps: [
      "实现带超时和 AbortController 的请求封装。",
      "比较 `Promise.all` 与 `allSettled` 的失败行为。",
      "写一个竞态测试，确认旧请求不会覆盖新结果。",
    ],
    masteryChecklist: [
      "能说明 Promise 错误如何沿链传播和捕获。",
      "能为并发请求定义取消、超时和失败策略。",
    ],
  },
  "js-dom-network": {
    overview: [
      "DOM 是页面结构的运行时表示，事件是从目标向外传播或从外向内捕获的消息。事件委托利用冒泡减少监听器数量。",
      "`fetch` 只在网络层失败时 reject，HTTP 404/500 仍会解析为响应对象，需要检查 `response.ok` 和状态码。",
    ],
    mechanism: [
      "表单提交、导航和键盘操作都可能触发默认行为，需要根据业务决定 `preventDefault`；事件监听器应在组件销毁时移除。",
      "请求体要明确 JSON、表单或二进制格式，响应要检查 Content-Type；接口错误应转换为可展示的领域错误。",
    ],
    example: {
      title: "事件委托和 HTTP 状态检查",
      language: "javascript",
      code: `list.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-user-id]");
  if (!button) return;

  const response = await fetch("/api/users/" + button.dataset.userId);
  if (!response.ok) {
    throw new Error("load user failed: " + response.status);
  }

  renderUser(await response.json());
});`,
      explanation: "列表只需要一个监听器，通过 `closest` 判断实际按钮。HTTP 状态错误被显式抛出，而不是误把错误 JSON 当成用户数据。",
    },
    practiceSteps: [
      "用事件委托实现列表删除按钮，并验证动态新增项可用。",
      "请求一个 404 地址，观察 fetch 是否 reject。",
      "为表单提交添加键盘操作和错误提示。",
    ],
    masteryChecklist: [
      "能解释事件冒泡、委托和监听器清理。",
      "能区分网络失败与 HTTP 状态失败。",
    ],
  },
  "js-modules": {
    overview: [
      "模块把实现细节封装在文件边界内，导出稳定接口，导入方只依赖公开能力。依赖方向应从页面指向核心业务，避免核心逻辑反向依赖 UI。",
      "ESM 是静态分析的模块系统，导入导出关系在运行前可确定；循环依赖会让初始化顺序变得难以推理，应通过拆分职责或延迟调用消除。",
    ],
    mechanism: [
      "命名导出适合明确 API，默认导出适合模块只提供一个主对象；导入路径应稳定，不应通过深层相对路径穿透模块边界。",
      "包管理器负责版本解析和安装，锁文件固定依赖图；依赖升级要经过测试和兼容性检查。",
    ],
    example: {
      title: "模块只暴露命令和查询接口",
      language: "javascript",
      code: `// user-service.js
export async function getUser(id) {}
export async function updateUser(id, patch) {}

// page.js
import { getUser } from "./user-service.js";

const user = await getUser("u1");`,
      explanation: "页面依赖用户服务的公开函数，不需要知道存储实现。服务内部可以替换请求地址、缓存或本地存储而不影响页面。",
    },
    practiceSteps: [
      "把一个混合网络和渲染的文件拆成 service、view 和 util。",
      "制造一个循环依赖，观察初始化顺序问题。",
      "记录当前依赖图和每个模块的职责。",
    ],
    masteryChecklist: [
      "能说明模块应该暴露什么、隐藏什么。",
      "能避免让核心逻辑依赖页面或框架细节。",
    ],
  },
  "js-testing": {
    overview: [
      "测试验证行为契约而不是内部实现。一个测试应准备输入、执行公共行为、断言可观察结果，并能在失败时说明原因。",
      "边界条件包括空值、极值、重复输入、异步竞态和失败路径。调试时先构造最小可重复案例，再用断点或日志确认实际数据。",
    ],
    mechanism: [
      "单元测试隔离纯逻辑，DOM 测试验证用户交互，集成测试验证模块协作；覆盖率是提示盲区的指标，不是质量目标。",
      "异步测试必须等待明确的 Promise 或条件，不能依赖固定延迟；假定时器适合测试超时，但要恢复真实计时器。",
    ],
    example: {
      title: "测试成功、空结果和失败",
      language: "javascript",
      code: `import { describe, expect, it, vi } from "vitest";

describe("loadUsers", () => {
  it("returns an empty list without requests", async () => {
    const request = vi.fn();
    await expect(loadUsers([], request)).resolves.toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });
});`,
      explanation: "空输入是一个明确边界，同时验证结果和副作用都没有发生。测试替身只在真正的外部边界使用。",
    },
    practiceSteps: [
      "为请求组合器列出成功、超时、取消和部分失败。",
      "先写最小复现，再修复一个异步竞态。",
      "增加一个空输入测试，确认没有不必要请求。",
    ],
    masteryChecklist: [
      "能说明测试保护的行为，而不是实现细节。",
      "能用最小案例复现并验证异步问题。",
    ],
  },
  "js-browser-data": {
    overview: [
      "浏览器存储各有生命周期和安全边界。Cookie 会自动随请求发送并受 HttpOnly、Secure、SameSite 影响；localStorage 适合非敏感持久数据；IndexedDB 适合较大结构化数据。",
      "性能和无障碍都是用户体验的一部分。网络、解析、渲染和交互延迟需要分别测量，键盘、焦点和语义标签决定所有用户是否可用。",
    ],
    mechanism: [
      "浏览器缓存受 HTTP 头和资源指纹控制，缓存命中不等于数据永远最新；敏感令牌不应放在可被脚本读取的存储中。",
      "测量要使用真实用户指标而不是单次感觉；布局抖动、长任务和图片尺寸通常比微小的 JavaScript 优化更值得处理。",
    ],
    example: {
      title: "持久化非敏感界面偏好",
      language: "javascript",
      code: `const THEME_KEY = "app-theme";

export function loadTheme() {
  const value = localStorage.getItem(THEME_KEY);
  return value === "dark" || value === "light" ? value : "system";
}

export function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}`,
      explanation: "只保存非敏感偏好，并在读取时校验值域。主题不是权限数据，丢失后回退到系统设置即可。",
    },
    practiceSteps: [
      "比较 Cookie、localStorage 和 IndexedDB 的生命周期与风险。",
      "为页面补全键盘导航和可见焦点。",
      "记录一次加载指标并定位最大资源。",
    ],
    masteryChecklist: [
      "能根据敏感性和生命周期选择存储方式。",
      "能用可测量指标描述性能和无障碍问题。",
    ],
  },
  "js-components": {
    overview: [
      "组件是输入、状态、事件和输出的边界。Props 向下传递数据，事件向上通知变化，组件不应隐式依赖全局状态。",
      "组合优于复制：把布局和能力拆成小组件，再通过插槽、children 或 render props 组合。受控表单把值的所有权放在父组件。",
    ],
    mechanism: [
      "组件渲染应是可预测的纯过程；输入相同应得到相同界面，副作用放在明确的生命周期或事件处理器中。",
      "列表需要稳定 key，表单需要值和错误状态，复杂组件要定义空、加载、错误和禁用状态。",
    ],
    example: {
      title: "受控输入组件",
      language: "javascript",
      code: `function SearchBox({ value, onChange, onSubmit }) {
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      onSubmit(value);
    }}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="搜索"
      />
    </form>
  );
}`,
      explanation: "输入值由父组件拥有，组件只负责显示和发送变化。这样搜索条件可以与其他状态同步，也更容易测试。",
    },
    practiceSteps: [
      "把筛选、列表和详情拆成三个组件并画出数据流。",
      "为表单添加空、错误和禁用状态。",
      "给列表使用稳定业务 id 作为 key。",
    ],
    masteryChecklist: [
      "能说明状态放在哪个组件以及为什么。",
      "能通过 props 和事件建立单向数据流。",
    ],
  },
  "js-state-render": {
    overview: [
      "状态是随时间变化且影响渲染的数据，派生状态应由现有数据计算得到，不应重复存储。单一数据流让变化来源可追踪。",
      "不可变更新保证旧快照不被修改，便于比较、撤销和调试。副作用负责与外部世界同步，必须建立和清理成对出现。",
    ],
    mechanism: [
      "渲染函数根据当前 props 和 state 生成界面；如果每次渲染都创建新对象作为依赖，可能造成重复执行。",
      "订阅、定时器、请求和事件监听在依赖变化或卸载时需要清理，否则会重复执行或持有过期数据。",
    ],
    example: {
      title: "订阅外部数据并清理",
      language: "javascript",
      code: `useEffect(() => {
  const controller = new AbortController();

  loadOrders(controller.signal).then(setOrders);

  return () => controller.abort();
}, [query]);`,
      explanation: "查询变化时创建新的请求并中止旧请求，返回的清理函数防止旧响应覆盖新结果。",
    },
    practiceSteps: [
      "找出一个可以计算的派生状态并从 state 中移除。",
      "给重复订阅的 effect 补清理函数。",
      "用旧请求覆盖新请求制造竞态，再修复。",
    ],
    masteryChecklist: [
      "能区分真实状态和可派生数据。",
      "能说明副作用的建立、依赖与清理关系。",
    ],
  },
  "js-performance": {
    overview: [
      "性能优化先测量再改变。网络下载、解析、执行、渲染和交互延迟属于不同阶段，必须用指标定位瓶颈。",
      "代码分割、懒加载、资源压缩和缓存可以降低首屏成本；错误边界、降级和发布检查决定故障时用户能否继续使用。",
    ],
    mechanism: [
      "大包会让设备下载和执行更多代码，长任务会阻塞交互；按路由或能力拆分能减少初始路径。",
      "错误边界只捕获渲染期间错误，异步事件处理器仍要自行处理。监控需要记录版本、用户环境、错误类型和恢复路径。",
    ],
    example: {
      title: "按需加载重型编辑器",
      language: "javascript",
      code: `const editorPromise = import("./rich-editor.js");

async function openEditor() {
  const { createEditor } = await editorPromise;
  return createEditor(document.querySelector("#editor"));
}`,
      explanation: "重型编辑器只在用户需要时下载，首屏包更小。加载失败应有重试或基础文本编辑降级。",
    },
    practiceSteps: [
      "记录一次首屏包大小和最大资源。",
      "把非首屏功能改为动态导入并复测。",
      "为异步失败添加错误提示和重试路径。",
    ],
    masteryChecklist: [
      "能把性能问题归因到具体阶段。",
      "能为错误提供可恢复的用户路径。",
    ],
  },
};
