// ============================================================================
// announcement —— 公告解析器：从公告标题/正文提取时间节点、招录人数、岗位表链接
// 时间一律归一化为 Asia/Shanghai (UTC+8) 的 ISO 字符串
// ============================================================================

/** 将 "2026年3月6日" / "2026-03-06" / "2026.3.6" + 可选时间 转为 Date */
export function parseCnDate(str) {
  if (!str) return null;
  let m = str.match(/(\d{4})\s*[年\-/.年]\s*(\d{1,2})\s*[月\-/.]\s*(\d{1,2})\s*日?/);
  if (!m) return null;
  const [, y, mo, d] = m;
  let hh = 0, mm = 0;
  const tm = str.match(/(\d{1,2})[:：点时](\d{2})?/);
  if (tm) {
    hh = Number(tm[1] || 0);
    mm = Number(tm[2] || 0);
  }
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), hh - 8, mm));
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

const KIND_LABEL = {
  apply_start: "报名开始",
  apply_end: "报名截止",
  exam: "笔试/考试",
  interview: "面试",
  result: "成绩公布",
};

/** 从正文提取时间节点事件数组 [{kind,label,eventAt,note}] */
export function parseExamEvents(text) {
  const events = [];
  const t = String(text || "").replace(/\s+/g, " ");

  // 报名时间：A 至 B（最常见的两种格式）
  const applyRe = /(?:网上)?报名(?:时间|安排)?[：:为]?\s*([^，。；;\n]{4,60}?)(?:至|到|—|－|~|～)\s*([^，。；;\n]{4,40}?)(?:止|截止|结束)?/g;
  let m;
  while ((m = applyRe.exec(t)) !== null) {
    const a = parseCnDate(m[1]);
    const b = parseCnDate(m[2]);
    if (a) events.push({ kind: "apply_start", label: KIND_LABEL.apply_start, eventAt: a, note: "报名开始" });
    if (b) events.push({ kind: "apply_end", label: KIND_LABEL.apply_end, eventAt: b, note: "报名截止" });
  }
  // 报名时间：A 至 B（"至" 在中间、前面无描述）
  if (events.length === 0) {
    const re2 = /报名时间[：:]\s*(\d{4}[年\-/.][^，。；;\n]{2,20}?)\s*(?:至|到|—|－)\s*(\d{4}[年\-/.][^，。；;\n]{2,20}?)/g;
    while ((m = re2.exec(t)) !== null) {
      const a = parseCnDate(m[1]);
      const b = parseCnDate(m[2]);
      if (a) events.push({ kind: "apply_start", label: KIND_LABEL.apply_start, eventAt: a, note: "报名开始" });
      if (b) events.push({ kind: "apply_end", label: KIND_LABEL.apply_end, eventAt: b, note: "报名截止" });
    }
  }
  // 报名截止/截至
  const endRe = /(?:报名|网上报名)?(?:截止|截至|于[^，。；;]{0,8}截止)[时间]?[：:]?\s*(\d{4}[年\-/.][^，。；;\n]{2,24}?)(?:止)?/g;
  while ((m = endRe.exec(t)) !== null) {
    const d = parseCnDate(m[1]);
    if (d && !events.some((e) => e.kind === "apply_end" && e.eventAt === d)) {
      events.push({ kind: "apply_end", label: KIND_LABEL.apply_end, eventAt: d, note: "报名截止" });
    }
  }
  // 笔试时间 / 考试时间
  const examRe = /(?:笔试|考试)(?:时间|安排)?[：:为]?\s*(\d{4}[年\-/.][^，。；;\n]{2,24}?)/g;
  while ((m = examRe.exec(t)) !== null) {
    const d = parseCnDate(m[1]);
    if (d && !events.some((e) => e.kind === "exam" && e.eventAt === d)) {
      events.push({ kind: "exam", label: KIND_LABEL.exam, eventAt: d, note: "笔试/考试" });
    }
  }
  // 面试时间
  const ivRe = /(?:面试)(?:时间|安排)?[：:为]?\s*(\d{4}[年\-/.][^，。；;\n]{2,24}?)/g;
  while ((m = ivRe.exec(t)) !== null) {
    const d = parseCnDate(m[1]);
    if (d && !events.some((e) => e.kind === "interview" && e.eventAt === d)) {
      events.push({ kind: "interview", label: KIND_LABEL.interview, eventAt: d, note: "面试" });
    }
  }
  // 成绩公布
  const resRe = /(?:成绩)?(?:公布|发布|查询)(?:时间)?[：:为]?\s*(\d{4}[年\-/.][^，。；;\n]{2,24}?)/g;
  while ((m = resRe.exec(t)) !== null) {
    const d = parseCnDate(m[1]);
    if (d && !events.some((e) => e.kind === "result" && e.eventAt === d)) {
      events.push({ kind: "result", label: KIND_LABEL.result, eventAt: d, note: "成绩公布" });
    }
  }

  // 去重 + 按时间排序
  const seen = new Set();
  const out = [];
  for (const e of events) {
    const key = e.kind + "|" + e.eventAt;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  out.sort((a, b) => (a.eventAt < b.eventAt ? -1 : 1));
  return out;
}

/** 招录人数 / 岗位数 */
export function parseRecruitCount(text) {
  const t = String(text || "");
  let m = t.match(/(?:计划)?(?:招聘|招录|新招)(?:工作人员)?\s*(\d+(?:\.\d+)?)\s*人/);
  if (m) return Number(m[1]);
  m = t.match(/(\d+)\s*个(?:招聘)?岗位/);
  if (m) return Number(m[1]);
  m = t.match(/岗位(?:计划)?\s*(\d+)/);
  if (m) return Number(m[1]);
  return null;
}

/** 从详情 HTML 提取岗位表附件链接 */
export function findAttachmentLinks(html, baseUrl) {
  const out = [];
  const re = /<a[^>]+href="([^"]+)"[^>]*>([^<]{0,60})<\/a>/gi;
  let m;
  while ((m = re.exec(String(html || ""))) !== null) {
    const href = m[1];
    const txt = m[2] || "";
    const isExcel = /\.(xlsx|xls)(\?|$)/i.test(href);
    const isAttachment = /岗位表|职位表|附件|岗位计划|招考职位/.test(txt + " " + href);
    if (isExcel && isAttachment) {
      let url = href;
      if (!/^https?:\/\//i.test(url)) {
        try {
          url = new URL(url, baseUrl).href;
        } catch {
          url = baseUrl + (url.startsWith("/") ? "" : "/") + url;
        }
      }
      out.push({ url, name: txt.trim() || "岗位表附件" });
    }
  }
  return out;
}
