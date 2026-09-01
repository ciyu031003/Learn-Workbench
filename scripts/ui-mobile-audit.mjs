import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const cookie = JSON.parse(readFileSync("scripts/.audit_cookie.txt", "utf8")).cookie;
const COOKIE_NAME = "lwb_session";

const ROUTES = [
  "/dashboard", "/roadmap", "/tasks", "/logs", "/jobs", "/settings",
  "/wellbeing", "/career", "/career/skills", "/career/resume", "/career/interview",
  "/career/applications", "/career/market",
];

const VIEWPORTS = [
  { name: "360x800", width: 360, height: 800 },
  { name: "390x844", width: 390, height: 844 },
];

async function auditRoute(page, route) {
  try {
    await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(900);
  } catch (e) {
    return { route, ok: false, error: e.message.slice(0, 120), offenders: [] };
  }
    const result = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bodyW = document.documentElement.scrollWidth;
    const hasScrollAncestor = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.position === "fixed") return true;
        if (s.overflowX === "auto" || s.overflowX === "scroll" || s.overflowX === "hidden" || s.overflowX === "clip") return true;
      }
      return false;
    };
    const offenders = [];
    const seen = new Set();
    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const over = rect.right - vw;
      if (over > 8 && !hasScrollAncestor(el)) {
        const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 4).join(".");
        const tag = el.tagName.toLowerCase();
        const id = el.id ? "#" + el.id : "";
        const key = tag + (cls ? "." + cls : "") + id;
        if (seen.has(key)) continue;
        seen.add(key);
        offenders.push({ key, right: Math.round(rect.right), w: Math.round(rect.width), overflow: Math.round(over) });
      }
    }
    return { vw, bodyW, pageOverflow: bodyW - vw, offenders: offenders.slice(0, 25) };
  });  return { route, ok: true, ...result };
}

const browser = await chromium.launch({ headless: true });
for (const vp of VIEWPORTS) {
  let overflowCount = 0;
  console.log(`\n========== VIEWPORT ${vp.name} ==========`);
  for (const route of ROUTES) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await context.addCookies([{ name: COOKIE_NAME, value: cookie.replace(/^lwb_session=/, ""), domain: "localhost", path: "/" }]);
    const page = await context.newPage();
    const r = await auditRoute(page, route);
    await context.close();
    if (!r.ok) { console.log(`  ${route}  ⚠  ${r.error}`); continue; }
    if (r.pageOverflow > 0) {
      overflowCount++;
      console.log(`  ${route}  ✗ pageOverflow=${r.pageOverflow}px  vw=${r.vw}`);
      for (const o of r.offenders) console.log(`      > ${o.key}  right=${o.right} overflow=${o.overflow}px`);
    } else if (r.offenders.length) {
      overflowCount++;
      console.log(`  ${route}  ✗ 元素溢出 (body no-scroll but elements off-screen)`);
      for (const o of r.offenders) console.log(`      > ${o.key}  right=${o.right} overflow=${o.overflow}px`);
    } else {
      console.log(`  ${route}  ✓`);
    }
  }
  if (overflowCount === 0) console.log(`  [CLEAN] 无横向溢出`);
  else console.log(`  [ISSUES] ${overflowCount} 个路由存在溢出`);
}
await browser.close();