/**
 * 学习领域模板目录（Learn-Workbench 3.0 · P1）
 * 用户「从模板创建」领域时，服务端复制该模板为私有领域（owner_id = 用户 id），
 * 不预灌所有人的 careers 列表。
 *
 * 类型复用 @learn-workbench/shared 的 Phase/Topic/Resource 结构。
 * 模板只描述「结构骨架」，服务端创建时重写为自定义 key 与自增 id。
 */
import type { Phase } from "@learn-workbench/shared";

export interface DomainTemplate {
  key: string;            // 稳定模板 key（创建后作为 career_key 前缀来源）
  name: string;
  kind: "language" | "sports" | "hobby" | "life" | "custom";
  icon: string;
  color: string;
  phasePrefix: string;    // 阶段徽标（E/S/H/L/C）
  description: string;
  weeksNote?: string;     // 可选的默认周期文案
  phases: Phase[];        // 主轨（main）阶段骨架；agent 轨道模板暂不提供
}

export const englishTemplate: DomainTemplate = {
  key: "english",
  name: "英语学习",
  kind: "language",
  icon: "languages",
  color: "#2563eb",
  phasePrefix: "E",
  description: "词汇语法 → 听力口语 → 阅读写作 → 目标考试/职场应用",
  phases: [
    {
      id: 1, phaseKey: "e-phase-1", title: "摸底与学习机制", weeks: "第 1-2 周", track: "main",
      summary: "水平自测、音标与发音矫正、学习工具与每日节奏。", sortOrder: 0,
      topics: [
        { id: 101, topicKey: "e-t1-1", title: "英语水平自测", summary: "词汇量测试 + 听说读写四项摸底。", agentTask: null, sortOrder: 0, resources: [], practices: [{ id: 1001, text: "完成一次四维水平自测并记录薄弱项", sortOrder: 0 }], projects: [], checkpoints: [] },
        { id: 102, topicKey: "e-t1-2", title: "音标与发音矫正", summary: "48 音标、连读弱读、影子跟读入门。", agentTask: null, sortOrder: 1, resources: [], practices: [], projects: [], checkpoints: [{ id: 2001, text: "能准确朗读一段 60 秒材料", sortOrder: 0 }] },
        { id: 103, topicKey: "e-t1-3", title: "学习工具与节奏", summary: "词书/听力 App/笔记方法，制定每日固定时间。", agentTask: null, sortOrder: 2, resources: [], practices: [], projects: [], checkpoints: [] },
      ],
    },
    {
      id: 2, phaseKey: "e-phase-2", title: "词汇语法地基", weeks: "第 3-8 周", track: "main",
      summary: "核心词汇与语法体系，能读懂中等难度文章。", sortOrder: 1,
      topics: [
        { id: 201, topicKey: "e-t2-1", title: "核心词汇 1500", summary: "按主题记忆 + 语境复习，每日 30 词。", agentTask: null, sortOrder: 0, resources: [], practices: [], projects: [], checkpoints: [{ id: 2002, text: "词汇量自测提升 1500+", sortOrder: 0 }] },
        { id: 202, topicKey: "e-t2-2", title: "核心语法", summary: "时态语态、从句、非谓语、虚拟语气。", agentTask: null, sortOrder: 1, resources: [], practices: [], projects: [], checkpoints: [] },
        { id: 203, topicKey: "e-t2-3", title: "长难句拆解", summary: "每日拆解 2 句，训练阅读速度。", agentTask: null, sortOrder: 2, resources: [], practices: [{ id: 1002, text: "完成 20 组长难句拆解", sortOrder: 0 }], projects: [], checkpoints: [] },
      ],
    },
    {
      id: 3, phaseKey: "e-phase-3", title: "听力口语突破", weeks: "第 9-14 周", track: "main",
      summary: "精听 + 影子跟读 + 场景口语，能进行日常交流。", sortOrder: 2,
      topics: [
        { id: 301, topicKey: "e-t3-1", title: "精听训练", summary: "VOA/播客精听五步法。", agentTask: null, sortOrder: 0, resources: [], practices: [], projects: [], checkpoints: [] },
        { id: 302, topicKey: "e-t3-2", title: "影子跟读", summary: "每日 15 分钟跟读，模仿语音语调。", agentTask: null, sortOrder: 1, resources: [], practices: [], projects: [], checkpoints: [{ id: 2003, text: "能完整跟读 3 篇材料并录音回听", sortOrder: 0 }] },
        { id: 303, topicKey: "e-t3-3", title: "场景口语", summary: "自我介绍/点餐/问路/职场寒暄等 20 场景。", agentTask: null, sortOrder: 2, resources: [], practices: [{ id: 1003, text: "完成 20 个场景对话演练", sortOrder: 0 }], projects: [], checkpoints: [] },
      ],
    },
    {
      id: 4, phaseKey: "e-phase-4", title: "阅读写作进阶", weeks: "第 15-20 周", track: "main",
      summary: "精读外刊 + 写作模板，能输出结构清晰的短文。", sortOrder: 3,
      topics: [
        { id: 401, topicKey: "e-t4-1", title: "精读外刊", summary: "每周精读 2 篇，整理生词与句型。", agentTask: null, sortOrder: 0, resources: [], practices: [], projects: [], checkpoints: [] },
        { id: 402, topicKey: "e-t4-2", title: "写作模板", summary: "议论文/邮件/报告三类模板。", agentTask: null, sortOrder: 1, resources: [], practices: [{ id: 1004, text: "输出 10 篇短文写作并自评", sortOrder: 0 }], projects: [], checkpoints: [{ id: 2004, text: "能 30 分钟写一篇 200 词短文", sortOrder: 0 }] },
      ],
    },
    {
      id: 5, phaseKey: "e-phase-5", title: "目标冲刺", weeks: "第 21-26 周", track: "main",
      summary: "四六级/考研/雅思/职场口语任选目标集中冲刺。", sortOrder: 4,
      topics: [
        { id: 501, topicKey: "e-t5-1", title: "目标题型演练", summary: "按目标考试做真题套题与错题复盘。", agentTask: null, sortOrder: 0, resources: [], practices: [], projects: [], checkpoints: [{ id: 2005, text: "完成 3 套真题并复盘错题", sortOrder: 0 }] },
        { id: 502, topicKey: "e-t5-2", title: "职场英语应用", summary: "邮件/会议/汇报场景实战（可选）。", agentTask: null, sortOrder: 1, resources: [], practices: [], projects: [], checkpoints: [] },
      ],
    },
  ],
};

export const badmintonTemplate: DomainTemplate = {
  key: "badminton",
  name: "羽毛球·从零到实战",
  kind: "sports",
  icon: "activity",
  color: "#ea580c",
  phasePrefix: "S",
  description: "基础动作 → 步法 → 网前 → 进攻 → 战术实战，配体能训练",
  phases: [
    {
      id: 1, phaseKey: "s-phase-1", title: "基础动作", weeks: "第 1-3 周", track: "main",
      summary: "握拍/架拍/挥拍与发球，建立正确动作定型。", sortOrder: 0,
      topics: [
        { id: 101, topicKey: "s-t1-1", title: "握拍与架拍", summary: "正反手握拍转换、准备架拍。", agentTask: null, sortOrder: 0, resources: [], practices: [{ id: 1001, text: "每日挥拍 100 次，录像纠错", sortOrder: 0 }], projects: [], checkpoints: [{ id: 2001, text: "握拍转换无停顿", sortOrder: 0 }] },
        { id: 102, topicKey: "s-t1-2", title: "发球", summary: "正手高远球发球、反手发网前球。", agentTask: null, sortOrder: 1, resources: [], practices: [{ id: 1002, text: "多球发球 50 个×3 组", sortOrder: 0 }], projects: [], checkpoints: [] },
        { id: 103, topicKey: "s-t1-3", title: "正手高远球", summary: "原地高远球完整动作链。", agentTask: null, sortOrder: 2, resources: [], practices: [], projects: [], checkpoints: [{ id: 2002, text: "能连续对拉高远球 20 拍", sortOrder: 0 }] },
      ],
    },
    {
      id: 2, phaseKey: "s-phase-2", title: "步法", weeks: "第 4-6 周", track: "main",
      summary: "启动步与米字步，前后场连贯。", sortOrder: 1,
      topics: [
        { id: 201, topicKey: "s-t2-1", title: "启动步与米字步", summary: "启动小跳、六个方向垫步/交叉步。", agentTask: null, sortOrder: 0, resources: [], practices: [{ id: 1003, text: "米字步 5 组×10 次", sortOrder: 0 }], projects: [], checkpoints: [] },
        { id: 202, topicKey: "s-t2-2", title: "上网与后退步法", summary: "上网挑球/放网、后退起跳击球连贯。", agentTask: null, sortOrder: 1, resources: [], practices: [], projects: [], checkpoints: [{ id: 2003, text: "前后场连贯 15 次不失误", sortOrder: 0 }] },
      ],
    },
    {
      id: 3, phaseKey: "s-phase-3", title: "网前与过渡", weeks: "第 7-9 周", track: "main",
      summary: "搓放勾与平抽挡，掌握网前主动权。", sortOrder: 2,
      topics: [
        { id: 301, topicKey: "s-t3-1", title: "搓球与放网", summary: "正反手搓球、放网质量控制。", agentTask: null, sortOrder: 0, resources: [], practices: [], projects: [], checkpoints: [] },
        { id: 302, topicKey: "s-t3-2", title: "勾对角与平抽挡", summary: "网前勾对角、中前场平抽挡。", agentTask: null, sortOrder: 1, resources: [], practices: [], projects: [], checkpoints: [] },
      ],
    },
    {
      id: 4, phaseKey: "s-phase-4", title: "进攻技术", weeks: "第 10-13 周", track: "main",
      summary: "杀吊结合与接杀防守，建立得分手段。", sortOrder: 3,
      topics: [
        { id: 401, topicKey: "s-t4-1", title: "杀球与吊球", summary: "原地/起跳杀球、劈吊斜线。", agentTask: null, sortOrder: 0, resources: [], practices: [{ id: 1004, text: "杀吊结合多球 30 个×3 组", sortOrder: 0 }], projects: [], checkpoints: [{ id: 2004, text: "能杀吊结合连续进攻", sortOrder: 0 }] },
        { id: 402, topicKey: "s-t4-2", title: "接杀防守", summary: "接杀挡网与挑后场。", agentTask: null, sortOrder: 1, resources: [], practices: [], projects: [], checkpoints: [] },
      ],
    },
    {
      id: 5, phaseKey: "s-phase-5", title: "战术与实战", weeks: "第 14-18 周", track: "main",
      summary: "单打战术、双打轮转、规则与体能。", sortOrder: 4,
      topics: [
        { id: 501, topicKey: "s-t5-1", title: "单打战术", summary: "四方球控制、后场压制前场抢网。", agentTask: null, sortOrder: 0, resources: [], practices: [], projects: [], checkpoints: [] },
        { id: 502, topicKey: "s-t5-2", title: "双打轮转", summary: "前后站位轮转、发接发配合。", agentTask: null, sortOrder: 1, resources: [], practices: [], projects: [], checkpoints: [] },
        { id: 503, topicKey: "s-t5-3", title: "规则与体能", summary: "比赛规则、常见战术与身体素质训练。", agentTask: null, sortOrder: 2, resources: [], practices: [{ id: 1005, text: "完成 3 场实战并录像复盘", sortOrder: 0 }], projects: [], checkpoints: [{ id: 2005, text: "能完整打一场计分比赛", sortOrder: 0 }] },
      ],
    },
  ],
};

/** 球类运动通用框架（可套篮球/乒乓球/网球等，用户创建后自行编辑阶段主题） */
export const ballSportsTemplate: DomainTemplate = {
  key: "ball-sports",
  name: "球类运动训练",
  kind: "sports",
  icon: "dribbble",
  color: "#f59e0b",
  phasePrefix: "S",
  description: "球类通用训练框架：基础动作 → 单项技术 → 组合对抗 → 战术实战 → 体能",
  phases: [
    {
      id: 1, phaseKey: "bs-phase-1", title: "基础动作与球感", weeks: "第 1-3 周", track: "main",
      summary: "持球/触球感觉、基本站姿与移动。", sortOrder: 0,
      topics: [
        { id: 101, topicKey: "bs-t1-1", title: "球感训练", summary: "颠球/运球/传接基础（按项目替换）。", agentTask: null, sortOrder: 0, resources: [], practices: [{ id: 1001, text: "每日球感训练 15 分钟", sortOrder: 0 }], projects: [], checkpoints: [] },
      ],
    },
    {
      id: 2, phaseKey: "bs-phase-2", title: "单项技术", weeks: "第 4-8 周", track: "main",
      summary: "按项目拆解核心单项技术并反复训练。", sortOrder: 1,
      topics: [
        { id: 201, topicKey: "bs-t2-1", title: "核心单项技术", summary: "投篮/击球/传接/步法等（按项目补充）。", agentTask: null, sortOrder: 0, resources: [], practices: [], projects: [], checkpoints: [] },
      ],
    },
    {
      id: 3, phaseKey: "bs-phase-3", title: "组合与对抗", weeks: "第 9-13 周", track: "main",
      summary: "组合技术串联与半场/全场对抗。", sortOrder: 2,
      topics: [
        { id: 301, topicKey: "bs-t3-1", title: "组合技术", summary: "运传投/发接攻等组合套路。", agentTask: null, sortOrder: 0, resources: [], practices: [], projects: [], checkpoints: [] },
        { id: 302, topicKey: "bs-t3-2", title: "对抗训练", summary: "一对一/小范围对抗。", agentTask: null, sortOrder: 1, resources: [], practices: [{ id: 1002, text: "每周 2 次对抗训练并记录", sortOrder: 0 }], projects: [], checkpoints: [] },
      ],
    },
    {
      id: 4, phaseKey: "bs-phase-4", title: "战术与实战", weeks: "第 14-18 周", track: "main",
      summary: "团队战术配合、规则与实战。", sortOrder: 3,
      topics: [
        { id: 401, topicKey: "bs-t4-1", title: "战术配合", summary: "跑位/轮转/战术套路。", agentTask: null, sortOrder: 0, resources: [], practices: [], projects: [], checkpoints: [] },
        { id: 402, topicKey: "bs-t4-2", title: "实战与复盘", summary: "完整比赛 + 录像复盘。", agentTask: null, sortOrder: 1, resources: [], practices: [], projects: [], checkpoints: [] },
      ],
    },
    {
      id: 5, phaseKey: "bs-phase-5", title: "体能保持", weeks: "持续", track: "main",
      summary: "力量/灵敏/耐力基础体能，防伤与恢复。", sortOrder: 4,
      topics: [
        { id: 501, topicKey: "bs-t5-1", title: "体能训练", summary: "核心力量/折返跑/跳绳等。", agentTask: null, sortOrder: 0, resources: [], practices: [], projects: [], checkpoints: [] },
      ],
    },
  ],
};

export const domainTemplates: DomainTemplate[] = [englishTemplate, badmintonTemplate, ballSportsTemplate];