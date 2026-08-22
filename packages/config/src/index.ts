/**
 * Learn-Workbench · 业务规则配置（P1）
 * 把散落在业务代码里的可调规则集中到一处，改规则不再改逻辑代码；
 * 配置项带 zod 校验，结构非法在模块加载期即报错。
 */
import { z } from "zod";

/* ================= 招聘市场分析规则 ================= */

/** 数据来源平台中文名 */
export const sourceLabels: Record<string, string> = {
  lagou: "拉勾", liepin: "猎聘", zhilian: "智联", job51: "前程无忧", boss: "Boss直聘",
  "sasac-recruit": "国资委", "cpta-notice": "人事考试网", "81rc": "军队人才网",
  "mohrss-sydw": "人社部", "jiangsu-sydw": "江苏人社", iguopin: "国聘",
  guokao: "国考",
};

export const salaryBucketSchema = z.object({
  label: z.string(),
  min: z.number(),
  max: z.number(),
});

/** 薪资分桶（K/月） */
export const salaryBuckets: z.infer<typeof salaryBucketSchema>[] = [
  { label: "10K 以下", min: 0, max: 10 },
  { label: "10-15K", min: 10, max: 15 },
  { label: "15-20K", min: 15, max: 20 },
  { label: "20-30K", min: 20, max: 30 },
  { label: "30K 以上", min: 30, max: 1_000 },
];
salaryBucketSchema.array().parse(salaryBuckets);

export interface FunctionRule {
  label: string;
  /** 正则源码（保持可序列化/可配置）；运行时由 makeFunctionRule 编译 */
  pattern: string;
}

/** 岗位职能分类规则（按 title 关键词，优先级从高到低） */
export const functionRules: FunctionRule[] = [
  { label: "前端", pattern: "(前端|web前端|webs?前端|javascript工程师|vue|react工程师|uniapp)" },
  { label: "后端", pattern: "(后端|java开发|python开发|golang|go开发|c\\+\\+|c#|node.?js|php开发|中间件)" },
  { label: "算法/AI", pattern: "(算法|ai|人工智能|机器学习|深度学习|大模型|llm|nlp|cv|视觉|推荐算法|数据挖掘)" },
  { label: "测试", pattern: "(测试|qa|质量保障|测开)" },
  { label: "运维/DevOps", pattern: "(运维|devops|sre|系统工程师|网络工程师|数据库管理员|dba|linux|k8s|容器)" },
  { label: "数据", pattern: "(数据|etl|数仓|bi|数据分析师|大数据|sql)" },
  { label: "产品", pattern: "(产品|pm|需求)" },
  { label: "设计", pattern: "(设计|ui|ux|视觉|交互)" },
  { label: "运营/市场", pattern: "(运营|市场|销售|商务|客服|品牌|推广)" },
  { label: "安全", pattern: "(安全|渗透|等保|风控)" },
  { label: "硬件/嵌入式", pattern: "(硬件|嵌入式|fpga|芯片|ic|单片机|stm32|电路)" },
];

export const functionRuleSchema = z.object({ label: z.string(), pattern: z.string() });
functionRuleSchema.array().parse(functionRules);

/** 由可序列化规则编译为正则（避免直接把 RegExp 写进配置） */
export function makeFunctionRule(rule: FunctionRule): { label: string; re: RegExp } {
  return { label: rule.label, re: new RegExp(rule.pattern, "i") };
}

/** 公司名特征（zhilian/liepin 源把公司名写进 title 的脏数据清洗） */
export const companyNamePattern =
  "(公司|科技|数据|网络|信息|智能|集团|股份|有限|技术|软件|电子|通信|咨询|研究院|事务所|银行|证券|保险|置业|地产|物流|贸易|生物|医疗|教育|研究院$)";
export const companyNameRe = new RegExp(companyNamePattern);

/** 岗位类型关键词（全职/实习/外包/兼职） */
export const jobTypeRules: { label: string; pattern: string }[] = [
  { label: "实习", pattern: "(实习|intern|internship)" },
  { label: "外包", pattern: "(外包|驻场|外派)" },
  { label: "兼职", pattern: "(兼职|part[- ]?time)" },
];

/* ================= 职业准备度权重 ================= */

export const readinessWeightSchema = z.object({
  skill: z.number(),
  project: z.number(),
  resume: z.number(),
  interview: z.number(),
});

/** 四维评分权重（合计应约等于 1） */
export const readinessWeights: z.infer<typeof readinessWeightSchema> = {
  skill: 0.4,
  project: 0.3,
  resume: 0.15,
  interview: 0.15,
};
readinessWeightSchema.parse(readinessWeights);