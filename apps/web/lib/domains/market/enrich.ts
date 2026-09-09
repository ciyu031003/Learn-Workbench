import { functionRules, jobTypeRules, makeFunctionRule, salaryBuckets } from "@learn-workbench/config";
import { pgPool } from "@/lib/db";

const compiledFunctionRules = functionRules.map(makeFunctionRule);
const compiledJobTypeRules = jobTypeRules.map((rule) => ({
  label: rule.label,
  re: new RegExp(rule.pattern, "i"),
}));

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export interface EnrichedJobMarketInput {
  title: string;
  company?: string;
  tags?: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  experience?: string;
}

export interface EnrichedJobMarketFields {
  functionKey: string;
  titleFamily: string;
  seniorityBucket: string;
  industrySector: string;
  industrySubsector: string;
  salaryBand: string;
}

export function classifyMarketFunction(title: string): string {
  const value = normalize(title);
  if (!value) return "其他";
  if (/(安全|渗透|等保|风控|保密)/.test(value)) return "安全";
  if (/(运维|devops|sre|系统工程师|数据库管理员|dba|linux|容器|k8s|kubernetes)/.test(value)) return "运维/DevOps";
  if (/(人工智能|算法|大模型|机器学习|深度学习|推荐算法|数据挖掘|nlp|cv|llm)/.test(value)) return "算法/AI";
  if (/(数据分析|数据开发|数据仓库|etl|bi|大数据|数仓)/.test(value)) return "数据";
  if (/(前端|web前端|vue|react工程师|uniapp|angular|h5|小程序)/.test(value)) return "前端";
  if (/(java|golang|go开发|php开发|node\.?js|python开发|后端|中间件|服务端|c\+\+|c#)/.test(value)) return "后端";
  if (/(测试|qa|质量保障|测开)/.test(value)) return "测试";
  if (/(产品经理|产品运营|需求分析师|pm)/.test(value)) return "产品";
  if (/(ui|ux|视觉|交互|设计师)/.test(value)) return "设计";
  if (/(运营|市场|销售|商务|客服|品牌|推广)/.test(value)) return "运营/市场";
  if (/(硬件|嵌入式|fpga|芯片|ic|单片机|stm32|电路)/.test(value)) return "硬件/嵌入式";
  for (const rule of compiledFunctionRules) {
    if (rule.re.test(value)) return rule.label;
  }
  return "其他";
}

export function classifyMarketJobType(title: string, tags: string[] = []): string {
  const value = `${normalize(title)} ${tags.map(normalize).join(" ")}`;
  for (const rule of compiledJobTypeRules) {
    if (rule.re.test(value)) return rule.label;
  }
  return "全职";
}

export function classifyMarketSeniority(title: string, experience: string): string {
  const titleValue = normalize(title);
  const expValue = normalize(experience);

  if (/(应届|实习|intern|trainee)/.test(`${titleValue} ${expValue}`)) return "应届/实习";
  if (/(10年以上|十年以上|10年+|15年|20年)/.test(expValue)) return "10年以上";
  if (/(5-10年|6-10年|五年以上|8年|10年)/.test(expValue)) return "5-10年";
  if (/(3-5年|三到五年|四年以上|4年|5年)/.test(expValue)) return "3-5年";
  if (/(1-3年|一到三年|1年|2年|3年)/.test(expValue)) return "1-3年";
  if (/(1年以下|无需经验|经验不限)/.test(expValue)) return "1年以下";
  if (/(高级|资深|专家|架构师|负责人|主管|经理|总监|cto|senior|staff|principal|lead)/.test(titleValue)) return "5-10年";
  return "不限/其他";
}

export function classifyMarketIndustry(
  title: string,
  tags: string[] = [],
  company = ""
): Pick<EnrichedJobMarketFields, "industrySector" | "industrySubsector"> {
  const titleValue = normalize(title);
  const text = `${titleValue} ${tags.map(normalize).join(" ")} ${normalize(company)}`;
  const fn = classifyMarketFunction(title);

  if (/(金融|银行|证券|保险|基金|信托|fintech|finance|blockchain|web3|量化|风控)/.test(text)) {
    return { industrySector: "金融", industrySubsector: "金融科技" };
  }
  if (/(医疗|医药|医院|健康|生物|制药|临床|health|medical|pharma|biotech)/.test(text)) {
    return { industrySector: "医疗健康", industrySubsector: "医药与生命科学" };
  }
  if (/(教育|培训|课程|教研|教育科技|edtech|teacher|training)/.test(text)) {
    return { industrySector: "教育", industrySubsector: "教育与培训" };
  }
  if (/(硬件|嵌入式|芯片|半导体|fpga|单片机|stm32|ic|电路|机器人|iot)/.test(text)) {
    return { industrySector: "科技", industrySubsector: "软硬件与嵌入式" };
  }
  if (/(安全|渗透|等保|风控|security|网络安全|信息安全)/.test(text)) {
    return { industrySector: "科技", industrySubsector: "网络安全" };
  }
  if (/(人工智能|算法|大模型|机器学习|深度学习|推荐算法|nlp|cv|数据挖掘|llm)/.test(text)) {
    return { industrySector: "科技", industrySubsector: "数据与 AI" };
  }
  if (/(运维|云|云计算|devops|sre|linux|docker|容器|k8s|kubernetes|aws|azure|gcp)/.test(text)) {
    return { industrySector: "科技", industrySubsector: "云与基础设施" };
  }
  if (
    ["前端", "后端", "测试", "数据", "产品", "设计", "运营/市场", "算法/AI", "运维/DevOps"].includes(fn) ||
    /(软件|互联网|开发|工程师|程序员|技术|java|python|react|vue|node|golang|go|php|c\+\+|数据库|产品经理)/.test(text)
  ) {
    return { industrySector: "科技", industrySubsector: "软件与互联网" };
  }
  if (/(电商|零售|消费品|新消费|供应链|物流|仓储|贸易|外贸)/.test(text)) {
    return { industrySector: "商业", industrySubsector: "电商与新零售" };
  }
  if (/(文化|传媒|媒体|内容|短视频|直播|游戏|品牌|广告)/.test(text)) {
    return { industrySector: "商业", industrySubsector: "内容与品牌" };
  }

  return { industrySector: "其他", industrySubsector: "其他" };
}

export function classifyMarketSalaryBand(
  salaryMin: number | null,
  salaryMax: number | null
): string {
  const value = salaryMax ?? salaryMin;
  if (value == null) return "未披露";
  const valueInK = value / 100;
  const bucket = salaryBuckets.find((item) => valueInK >= item.min && valueInK < item.max);
  return bucket?.label ?? "30K以上";
}

export function enrichMarketJob(input: EnrichedJobMarketInput): EnrichedJobMarketFields {
  const functionKey = classifyMarketFunction(input.title);
  const seniorityBucket = classifyMarketSeniority(input.title, input.experience ?? "");
  const industry = classifyMarketIndustry(input.title, input.tags ?? [], input.company ?? "");

  return {
    functionKey,
    titleFamily: functionKey,
    seniorityBucket,
    industrySector: industry.industrySector,
    industrySubsector: industry.industrySubsector,
    salaryBand: classifyMarketSalaryBand(input.salaryMin ?? null, input.salaryMax ?? null),
  };
}

interface EnrichBackfillRow {
  id: number;
  title: string;
  company: string;
  salary_min: number | null;
  salary_max: number | null;
  experience: string;
  tags: string[];
}

export async function backfillMarketJobAttributes(limit = 500): Promise<number> {
  const { rows } = await pgPool.query<EnrichBackfillRow>(
    `SELECT id, title, company, salary_min, salary_max, experience, tags
       FROM job_postings
      WHERE is_active = true
        AND channel = 'job'
        AND (function_key = '' OR industry_sector = '' OR salary_band = '')
      ORDER BY id
      LIMIT $1`,
    [limit]
  );

  let updated = 0;
  for (const row of rows) {
    const fields = enrichMarketJob({
      title: row.title,
      company: row.company,
      salaryMin: row.salary_min,
      salaryMax: row.salary_max,
      experience: row.experience,
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    });
    await pgPool.query(
      `UPDATE job_postings
          SET function_key = $2,
              title_family = $3,
              seniority_bucket = $4,
              industry_sector = $5,
              industry_subsector = $6,
              salary_band = $7,
              market_enriched_at = now()
        WHERE id = $1`,
      [
        row.id,
        fields.functionKey,
        fields.titleFamily,
        fields.seniorityBucket,
        fields.industrySector,
        fields.industrySubsector,
        fields.salaryBand,
      ]
    );
    updated += 1;
  }
  return updated;
}
