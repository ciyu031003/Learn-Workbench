#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
招花 · 招聘信息爬虫（ICT 学习工作台）

读取所有账号的爬虫配置（job_crawler_configs，enabled=true），按 关键词 x 城市 x 平台
组合抓取招聘信息，规范化后 upsert 到 job_postings（按 source+source_job_id 去重），
并写入 job_crawler_runs 运行日志。

用法示例：
  python scripts/fetch_jobs.py                          # 真实抓取（需联网）
  python scripts/fetch_jobs.py --mock                   # 本地演示：生成示例职位（不联网）
  python scripts/fetch_jobs.py --db "host=127.0.0.1 port=5432 dbname=Learn-Workbench user=postgres"
  python scripts/fetch_jobs.py --limit 60               # 每平台最多保留 N 条（默认 100）

平台适配器：
  lagou（拉勾）/ liepin（猎聘）/ zhilian（智联招聘）/ job51（前程无忧）——稳定适配器
  boss（Boss 直聘）——实验性（强风控，可能失败，失败不影响其他平台）

依赖：仅 Python 标准库（urllib）。
"""

import argparse
import datetime
import json
import os
import random
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

DEFAULT_PSQL = os.path.join("F:", os.sep, "CodeFiles", "Learn-Workbench", ".tools", "pg", "Library", "bin", "psql.exe")

PLATFORMS = {
    "lagou": "拉勾",
    "liepin": "猎聘",
    "zhilian": "智联招聘",
    "job51": "前程无忧",
    "boss": "Boss直聘",
}
EXPERIMENTAL = {"boss"}

DEFAULT_KEYWORDS = ["前端工程师", "网络安全", "数据分析"]
DEFAULT_CITIES = []
DEFAULT_PLATFORMS = ["lagou", "liepin", "zhilian", "job51"]


# ---------------------------------------------------------------------------
# 数据库辅助（复用 Bing 爬虫的 psql 模式，无第三方驱动）
# ---------------------------------------------------------------------------

def find_psql():
    if os.environ.get("PSQL_BIN") and os.path.exists(os.environ["PSQL_BIN"]):
        return os.environ["PSQL_BIN"]
    w = shutil.which("psql")
    if w:
        return w
    if os.path.exists(DEFAULT_PSQL):
        return DEFAULT_PSQL
    return None


def psql_base_args(conn):
    psql = find_psql()
    if psql is None:
        return None
    cmd = [psql, "-w", "-q", "-v", "ON_ERROR_STOP=1"]
    if conn:
        cmd.append(conn)
    else:
        cmd += ["-d", os.environ.get("PGDATABASE", "Learn-Workbench"),
                "-h", os.environ.get("PGHOST", "127.0.0.1"),
                "-p", os.environ.get("PGPORT", "5432"),
                "-U", os.environ.get("PGUSER", "postgres")]
    if os.environ.get("PGPASSWORD"):
        cmd = [psql, "-w", "-q"] + ["-d", os.environ.get("PGDATABASE", "Learn-Workbench"),
                              "-h", os.environ.get("PGHOST", "127.0.0.1"),
                              "-p", os.environ.get("PGPORT", "5432"),
                              "-U", os.environ.get("PGUSER", "postgres")]
        cmd += ["--set", "PGPASSWORD=" + os.environ["PGPASSWORD"]]
    return cmd


def psql_run(conn, sql):
    cmd = psql_base_args(conn)
    if cmd is None:
        print("[warn] 未找到 psql，跳过数据库操作", file=sys.stderr)
        return False
    cmd += ["-f", "-"]
    try:
        subprocess.run(cmd, input=sql.encode("utf-8"), check=False, timeout=60)
        return True
    except Exception as e:  # noqa: BLE001
        print("[warn] psql 执行失败：%s" % e, file=sys.stderr)
        return False


def psql_query_json(conn, sql):
    cmd = psql_base_args(conn)
    if cmd is None:
        return None
    cmd += ["-t", "-A", "-f", "-"]
    try:
        out = subprocess.check_output(cmd, input=sql.encode("utf-8"), timeout=60)
        line = (out.decode("utf-8", errors="replace").strip().splitlines() or [""])[0].strip()
        return json.loads(line or "null")
    except Exception as e:  # noqa: BLE001
        print("[warn] psql 查询失败：%s" % e, file=sys.stderr)
        return None


def q(s):
    return "'" + ("" if s is None else str(s)).replace("'", "''") + "'"


# ---------------------------------------------------------------------------
# 读取账号爬虫配置（合并所有启用配置；无配置时使用默认值）
# ---------------------------------------------------------------------------

def load_configs(conn):
    rows = psql_query_json(
        conn,
        "SELECT coalesce(json_agg(t), '[]'::json) FROM ("
        "SELECT keywords, industries, cities, platforms, max_pages "
        "FROM job_crawler_configs WHERE enabled ORDER BY updated_at) t",
    )
    configs = rows if isinstance(rows, list) else []
    if not configs:
        return [{
            "keywords": DEFAULT_KEYWORDS,
            "cities": DEFAULT_CITIES,
            "platforms": DEFAULT_PLATFORMS,
            "max_pages": 2,
        }]
    cleaned = []
    for c in configs:
        cleaned.append({
            "keywords": [k for k in (c.get("keywords") or []) if str(k).strip()],
            "cities": [k for k in (c.get("cities") or []) if str(k).strip()],
            "platforms": [k for k in (c.get("platforms") or DEFAULT_PLATFORMS) if k in PLATFORMS],
            "max_pages": int(c.get("max_pages") or 2),
        })
    return cleaned


# ---------------------------------------------------------------------------
# 薪资解析
# ---------------------------------------------------------------------------

def parse_salary(text):
    """'15k-25k' -> (15,25)；'15k-25k·13薪' -> (15,25)；'200-300/天' -> (200,300)；'面议' -> (None,None)"""
    if not text:
        return None, None
    t = text.replace("K", "k").strip()
    m = re.search(r"(\d+(?:\.\d+)?)\s*k\s*[-~—至]\s*(\d+(?:\.\d+)?)\s*k", t)
    if m:
        return float(m.group(1)), float(m.group(2))
    m2 = re.search(r"(\d+(?:\.\d+)?)\s*[-~—至]\s*(\d+(?:\.\d+)?)", t)
    if m2 and ("/" not in t or "天" in t or "日" in t):
        return float(m2.group(1)), float(m2.group(2))
    m3 = re.search(r"(\d+(?:\.\d+)?)\s*k", t)
    if m3:
        return float(m3.group(1)), float(m3.group(1))
    return None, None


# ---------------------------------------------------------------------------
# HTTP 辅助
# ---------------------------------------------------------------------------

def http_get(url, headers=None, timeout=15):
    h = {"User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9", "Accept": "*/*"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def http_post(url, data, headers=None, timeout=15):
    h = {"User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "Referer": url}
    if headers:
        h.update(headers)
    body = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


# ---------------------------------------------------------------------------
# 适配器
# ---------------------------------------------------------------------------

def _city_param(city):
    """把城市名转成各平台参数；未知城市返回空串（表示不限/全国）。"""
    return city


def adapt_lagou(keyword, city, limit):
    """拉勾：positionAjax.json 接口（需要先拿 cookie，可能被风控，失败返回空）。"""
    import urllib.parse
    url = "https://www.lagou.com/jobs/positionAjax.json?needAddtionalResult=false"
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
    try:
        opener.open(urllib.request.Request("https://www.lagou.com/jobs/list_" + urllib.parse.quote(keyword), headers={"User-Agent": UA}), timeout=15).read()
    except Exception:  # noqa: BLE001
        pass
    data = {"first": "true", "pn": 1, "kd": keyword}
    if city:
        data["city"] = city
    req = urllib.request.Request(url, data=urllib.parse.urlencode(data).encode("utf-8"), headers={
        "User-Agent": UA, "Referer": "https://www.lagou.com/jobs/list_" + urllib.parse.quote(keyword),
        "X-Requested-With": "XMLHttpRequest",
    })
    try:
        with opener.open(req, timeout=15) as resp:
            payload = json.loads(resp.read().decode("utf-8", errors="replace"))
    except Exception:  # noqa: BLE001
        return []
    results = (((payload.get("content") or {}).get("positionResult") or {}).get("result")) or []
    out = []
    for it in results[:limit]:
        sal_min, sal_max = parse_salary(it.get("salary") or "")
        out.append({
            "source_job_id": str(it.get("positionId") or ""),
            "title": it.get("positionName") or keyword,
            "company": it.get("companyFullName") or it.get("companyShortName") or "",
            "city": it.get("city") or city or "",
            "district": it.get("district") or "",
            "salary_min": sal_min, "salary_max": sal_max,
            "salary_text": it.get("salary") or "",
            "experience": it.get("workYear") or "",
            "education": it.get("education") or "",
            "tags": list(it.get("companyLabelList") or []) + list(it.get("positionLables") or []),
            "description": (it.get("positionDetail") or "").replace("<br>", "\n"),
            "requirements": "",
            "company_info": it.get("industryField") or "",
            "url": "https://www.lagou.com/jobs/" + str(it.get("positionId") or "") + ".html",
            "logo_url": "",
            "published_at": it.get("createTime") or None,
        })
    return out


def adapt_liepin(keyword, city, limit):
    """猎聘：搜索页内嵌 JSON（__INITIAL_STATE__），风控较重，失败返回空。"""
    import urllib.parse
    url = "https://www.liepin.com/zhaopin/?key=" + urllib.parse.quote(keyword)
    if city:
        url += "&dq=" + urllib.parse.quote(city)
    try:
        html = http_get(url)
    except Exception:  # noqa: BLE001
        return []
    m = re.search(r"window\.__INITIAL_STATE__\s*=\s*(\{.*?\})\s*;", html, re.S)
    if not m:
        return []
    try:
        state = json.loads(m.group(1))
    except Exception:  # noqa: BLE001
        return []
    items = ((state.get("jobData") or {}).get("list") or [])
    out = []
    for it in items[:limit]:
        sal_min, sal_max = parse_salary(it.get("salary") or "")
        out.append({
            "source_job_id": str(it.get("jobId") or ""),
            "title": it.get("title") or keyword,
            "company": it.get("companyName") or "",
            "city": it.get("cityName") or city or "",
            "district": "",
            "salary_min": sal_min, "salary_max": sal_max,
            "salary_text": it.get("salary") or "",
            "experience": it.get("workYear") or "",
            "education": it.get("eduLevel") or "",
            "tags": list(it.get("labels") or []),
            "description": "",
            "requirements": "",
            "company_info": it.get("industry") or "",
            "url": "https://www.liepin.com/j/" + str(it.get("jobId") or "") + ".shtml",
            "logo_url": "",
            "published_at": it.get("pubTime") or None,
        })
    return out


def adapt_zhilian(keyword, city, limit):
    """智联招聘：fe-api 搜索接口（UA 正常时可用）。"""
    import urllib.parse
    params = {"start": "0", "pageSize": str(min(limit, 90)), "cityId": "489", "kw": keyword, "kt": "3"}
    if city:
        # 城市名 -> 智联 cityId 简化映射（未知城市用全国 489）
        city_map = {"北京": "530", "上海": "538", "广州": "653", "深圳": "765", "杭州": "619", "成都": "801", "西安": "715", "乌鲁木齐": "749", "重庆": "551"}
        params["cityId"] = city_map.get(city, "489")
    url = "https://fe-api.zhaopin.com/c/i/sou?" + urllib.parse.urlencode(params)
    try:
        payload = json.loads(http_get(url, headers={"Referer": "https://sou.zhaopin.com/"}))
    except Exception:  # noqa: BLE001
        return []
    results = (payload.get("data") or {}).get("results") or []
    out = []
    for it in results[:limit]:
        sal_min, sal_max = parse_salary(it.get("salary") or "")
        out.append({
            "source_job_id": str(it.get("number") or ""),
            "title": it.get("jobName") or keyword,
            "company": it.get("company", {}).get("name") or "",
            "city": (it.get("city", {}) or {}).get("display") or city or "",
            "district": (it.get("businessDistrict") or {}).get("display") or "",
            "salary_min": sal_min, "salary_max": sal_max,
            "salary_text": it.get("salary") or "",
            "experience": (it.get("workingExp", {}) or {}).get("name") or "",
            "education": (it.get("eduLevel", {}) or {}).get("name") or "",
            "tags": list(it.get("labels") or []),
            "description": it.get("jobDesc") or "",
            "requirements": "",
            "company_info": (it.get("company", {}) or {}).get("type", {}).get("name") or "",
            "url": it.get("positionURL") or ("https://sou.zhaopin.com/jobs/" + str(it.get("number") or "") + ".html"),
            "logo_url": (it.get("company", {}) or {}).get("logo") or "",
            "published_at": it.get("updateDate") or None,
        })
    return out


def adapt_job51(keyword, city, limit):
    """前程无忧：we.51job.com 搜索 API。"""
    import urllib.parse
    params = {"api_key": "51job", "timestamp": str(int(time.time())), "keyword": keyword, "searchType": "2", "pageNum": "1", "pageSize": str(min(limit, 50))}
    if city:
        area_map = {"北京": "010000", "上海": "020000", "广州": "030200", "深圳": "040000", "杭州": "080200", "成都": "090200", "西安": "200200", "乌鲁木齐": "330100"}
        params["jobArea"] = area_map.get(city, "")
    url = "https://we.51job.com/api/job/search-pc?" + urllib.parse.urlencode(params)
    try:
        payload = json.loads(http_get(url, headers={"Referer": "https://we.51job.com/"}))
    except Exception:  # noqa: BLE001
        return []
    items = (((payload.get("resultbody") or {}).get("job") or {}).get("items")) or []
    out = []
    for it in items[:limit]:
        sal_min, sal_max = parse_salary(it.get("providesalarytext") or "")
        out.append({
            "source_job_id": str(it.get("jobid") or ""),
            "title": it.get("jobname") or keyword,
            "company": it.get("companyname") or "",
            "city": (it.get("jobarea") or {}).get("city") or city or "",
            "district": (it.get("jobarea") or {}).get("district") or "",
            "salary_min": sal_min, "salary_max": sal_max,
            "salary_text": it.get("providesalarytext") or "",
            "experience": it.get("workyear") or "",
            "education": it.get("degree") or "",
            "tags": list(it.get("jobwelf") or []),
            "description": it.get("jobdescribe") or "",
            "requirements": "",
            "company_info": it.get("companytype", {}).get("name") or "",
            "url": it.get("jobHref") or ("https://jobs.51job.com/" + str(it.get("jobid") or "") + ".html"),
            "logo_url": it.get("companylogo") or "",
            "published_at": it.get("updateDateTime") or it.get("issuedate") or None,
        })
    return out


def adapt_boss(keyword, city, limit):
    """Boss 直聘（实验性）：公开搜索页，强风控，大概率被拦，失败返回空。"""
    import urllib.parse
    url = "https://www.zhipin.com/web/geek/job?query=" + urllib.parse.quote(keyword)
    if city:
        url += "&city=" + urllib.parse.quote(city)
    try:
        html = http_get(url, headers={"Referer": "https://www.zhipin.com/"})
    except Exception:  # noqa: BLE001
        return []
    # 页面为 JS 渲染 + 风控；仅尝试提取 JSON-LD，失败即空
    items = re.findall(r'"jobName"\s*:\s*"([^"]+)"', html)
    if not items:
        return []
    out = []
    for idx, name in enumerate(items[:limit]):
        out.append({
            "source_job_id": "boss-" + keyword + "-" + str(idx),
            "title": name,
            "company": "",
            "city": city or "",
            "district": "",
            "salary_min": None, "salary_max": None,
            "salary_text": "面议",
            "experience": "",
            "education": "",
            "tags": [],
            "description": "",
            "requirements": "",
            "company_info": "",
            "url": url,
            "logo_url": "",
            "published_at": None,
        })
    return out


ADAPTERS = {
    "lagou": adapt_lagou,
    "liepin": adapt_liepin,
    "zhilian": adapt_zhilian,
    "job51": adapt_job51,
    "boss": adapt_boss,
}


# ---------------------------------------------------------------------------
# 入库（upsert，按 source+source_job_id 去重）
# ---------------------------------------------------------------------------

def upsert_postings(conn, rows):
    if not rows:
        return
    values = []
    for p in rows:
        values.append(
            "(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s, %s, %s)"
            % (
                q(p["source"]), q(p["source_job_id"]), q(p["title"]), q(p["company"]),
                q(p["city"]), q(p["district"]),
                "NULL" if p["salary_min"] is None else str(int(p["salary_min"])),
                "NULL" if p["salary_max"] is None else str(int(p["salary_max"])),
                q(p["salary_text"]), q(p["experience"]), q(p["education"]),
                q(json.dumps(p["tags"], ensure_ascii=False)),
                q(p["description"]), q(p["requirements"]), q(p["company_info"]),
                q(p["url"]), q(p["logo_url"]),
                "NULL" if not p["published_at"] else q(p["published_at"]),
                "now()",
                "true",
            )
        )
    sql = (
        "INSERT INTO job_postings "
        "(source, source_job_id, title, company, city, district, salary_min, salary_max, "
        "salary_text, experience, education, tags, description, requirements, company_info, "
        "url, logo_url, published_at, fetched_at, is_active) VALUES "
        + ",".join(values) +
        " ON CONFLICT (source, source_job_id) DO UPDATE SET "
        "title = EXCLUDED.title, company = EXCLUDED.company, city = EXCLUDED.city, "
        "district = EXCLUDED.district, salary_min = EXCLUDED.salary_min, "
        "salary_max = EXCLUDED.salary_max, salary_text = EXCLUDED.salary_text, "
        "experience = EXCLUDED.experience, education = EXCLUDED.education, "
        "tags = EXCLUDED.tags, description = EXCLUDED.description, "
        "requirements = EXCLUDED.requirements, company_info = EXCLUDED.company_info, "
        "url = EXCLUDED.url, logo_url = EXCLUDED.logo_url, "
        "published_at = EXCLUDED.published_at, fetched_at = now(), is_active = true"
    )
    psql_run(conn, sql)


def new_count_of(conn, rows):
    if not rows:
        return 0
    keys = ["('" + r["source"].replace("'", "''") + "','" + r["source_job_id"].replace("'", "''") + "')" for r in rows]
    sql = "SELECT count(*)::int FROM job_postings WHERE (source, source_job_id) IN (" + ",".join(keys) + ") AND fetched_at >= now() - interval '60 seconds'"
    v = psql_query_json(conn, sql)
    return int(v) if isinstance(v, (int, float)) else 0


# ---------------------------------------------------------------------------
# Mock 演示数据
# ---------------------------------------------------------------------------

MOCK_TITLES = [
    ("前端工程师（React）", "星辰科技", "上海", "徐汇", "15-25K·13薪", ["React", "TypeScript", "Vite"], "负责 Web 端研发与组件库建设，推动体验升级。"),
    ("网络安全工程师", "云杉网络", "北京", "海淀", "20-35K·14薪", ["渗透测试", "等保合规"], "负责安全评估、渗透测试与安全体系建设。"),
    ("数据分析师", "蓝鲸智能", "杭州", "余杭", "12-20K", ["SQL", "Python", "Tableau"], "输出数据分析报表，搭建指标体系与自动化看板。"),
    ("Java 后端开发", "磐石云", "深圳", "南山", "18-30K·13薪", ["Spring Cloud", "Redis", "Kafka"], "负责交易核心系统研发与稳定性保障。"),
    ("AI 算法实习生", "极光实验室", "成都", "高新", "200-300/天", ["PyTorch", "LLM", "NLP"], "参与 LLM 应用与大模型微调方向研究。"),
    ("测试开发工程师", "峰谷科技", "上海", "浦东", "15-24K", ["自动化测试", "Python"], "负责自动化测试体系与测试平台建设。"),
    ("DevOps 工程师", "梯云数据", "北京", "朝阳", "22-38K·15薪", ["K8s", "Terraform", "CI/CD"], "负责 K8s 集群与 CI/CD 流水线建设。"),
    ("产品经理（AI 方向）", "山岚互动", "广州", "天河", "18-28K", ["AI产品", "PRD"], "负责 AI 产品线规划与迭代。"),
    ("嵌入式软件工程师", "昆仑电子", "乌鲁木齐", "经开", "10-18K", ["C/C++", "RTOS", "STM32"], "负责物联网终端嵌入式软件研发。"),
    ("大数据开发工程师", "星环数科", "深圳", "南山", "25-40K·14薪", ["Spark", "Flink", "Hive"], "负责数仓建设与实时管道开发。"),
]
MOCK_EXP = ["1-3年", "3-5年", "经验不限", "5-10年"]
MOCK_EDU = ["本科", "大专", "硕士"]
MOCK_CITIES = ["上海", "北京", "深圳", "杭州", "成都", "广州", "乌鲁木齐"]


def gen_mock(configs, limit):
    rows = []
    idx = 0
    platforms = sorted({p for c in configs for p in c.get("platforms", [])} or DEFAULT_PLATFORMS)
    keywords = [k for c in configs for k in c.get("keywords", [])] or DEFAULT_KEYWORDS
    cities = [c for cfg in configs for c in cfg.get("cities", [])] or MOCK_CITIES[:4]
    for source in platforms:
        for _ in range(limit // max(1, len(platforms))):
            t, company, city, district, salary, tags, desc = random.choice(MOCK_TITLES)
            kw = random.choice(keywords)
            if cities and city not in cities:
                city = random.choice(cities)
            smin, smax = parse_salary(salary)
            published = (datetime.datetime.now() - datetime.timedelta(hours=random.randint(1, 72))).isoformat()
            rows.append({
                "source": source,
                "source_job_id": "mock-%s-%d" % (source, idx),
                "title": t if random.random() > 0.3 else "%s（%s方向）" % (t.split("（")[0], kw),
                "company": company,
                "city": city,
                "district": district,
                "salary_min": smin, "salary_max": smax,
                "salary_text": salary,
                "experience": random.choice(MOCK_EXP),
                "education": random.choice(MOCK_EDU),
                "tags": list(tags),
                "description": desc + " 该职位由本地演示模式生成，用于展示「招花」界面效果。",
                "requirements": "1. 具备扎实的计算机基础；\n2. 有相关项目经验者优先；\n3. 良好的沟通与协作能力。",
                "company_info": company + " 是一家快速成长中的科技公司，团队氛围开放。",
                "url": "https://example.com/jobs/mock-" + source + "-" + str(idx),
                "logo_url": "",
                "published_at": published,
            })
            idx += 1
            if len(rows) >= limit:
                return rows
    return rows


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def main():
    # Windows GBK 控制台下 print 中文会崩溃：强制 stdout/stderr 使用 UTF-8
    for stream in (sys.stdout, sys.stderr):
        try:
            if stream is not None and hasattr(stream, "reconfigure"):
                stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:  # noqa: BLE001
            pass
    ap = argparse.ArgumentParser(description="招花 · 招聘信息爬虫")
    ap.add_argument("--db", default=None, help="PostgreSQL 连接串（缺省用环境变量/本地默认）")
    ap.add_argument("--mock", action="store_true", help="本地演示模式：生成示例职位，不联网")
    ap.add_argument("--limit", type=int, default=100, help="每平台最多抓取条数（默认 100）")
    args = ap.parse_args()

    conn = args.db
    started = datetime.datetime.now().isoformat()

    # 创建运行日志
    run_id = None
    v = psql_query_json(conn, "INSERT INTO job_crawler_runs (started_at, status) VALUES (%s, 'running') RETURNING id" % q(started))
    if isinstance(v, int):
        run_id = v

    configs = load_configs(conn)
    if not configs:
        print("[info] 无启用配置，使用默认关键词/平台")
    print("[info] 启用配置 %d 份，关键词: %s" % (len(configs), sorted({k for c in configs for k in c.get("keywords", [])}) or DEFAULT_KEYWORDS))

    try:
        if args.mock:
            print("[info] 演示模式：生成本地示例职位")
            rows = gen_mock(configs, args.limit)
            platforms_result = {}
            for r in rows:
                platforms_result[r["source"]] = platforms_result.get(r["source"], 0) + 1
            before = int(psql_query_json(conn, "SELECT count(*)::int FROM job_postings") or 0)
            upsert_postings(conn, rows)
            after = int(psql_query_json(conn, "SELECT count(*)::int FROM job_postings") or before)
            fetched = len(rows)
            new_count = max(0, after - before)
            status = "success"
            error = None
        else:
            fetched = 0
            new_rows = []
            platforms_result = {}
            errors = []
            for cfg in configs:
                platforms = cfg.get("platforms") or DEFAULT_PLATFORMS
                keywords = cfg.get("keywords") or DEFAULT_KEYWORDS
                cities = cfg.get("cities") or [None]
                for source in platforms:
                    adapter = ADAPTERS.get(source)
                    if not adapter:
                        continue
                    label = PLATFORMS.get(source, source)
                    for kw in keywords:
                        for city in cities:
                            time.sleep(random.uniform(1.2, 2.2))  # 限速
                            try:
                                items = adapter(kw, city or "", args.limit)
                                items = [it for it in items if it.get("source_job_id")]
                                for it in items:
                                    it["source"] = source
                                    it["salary_min"], it["salary_max"] = it.get("salary_min"), it.get("salary_max")
                                new_rows.extend(items)
                                fetched += len(items)
                                platforms_result[source] = platforms_result.get(source, 0) + len(items)
                                print("[ok] %s × %s × %s → %d 条" % (label, kw, city or "全国", len(items)))
                            except Exception as e:  # noqa: BLE001
                                errors.append("%s:%s:%s → %s" % (label, kw, city or "全国", e))
                                print("[warn] %s 抓取失败：%s" % (label, e), file=sys.stderr)
            before = psql_query_json(conn, "SELECT count(*)::int FROM job_postings") or 0
            upsert_postings(conn, new_rows)
            after = psql_query_json(conn, "SELECT count(*)::int FROM job_postings") or before
            new_count = max(0, int(after) - int(before))
            status = "failed" if fetched == 0 and errors else ("partial" if errors else "success")
            error = ("；".join(errors[:5])) if errors else None

        finished = datetime.datetime.now().isoformat()
        if run_id is not None:
            sql = (
                "UPDATE job_crawler_runs SET finished_at = %s, status = %s, "
                "platforms_result = %s, fetched_count = %d, new_count = %d, error = %s WHERE id = %d"
                % (q(finished), q(status), q(json.dumps(platforms_result, ensure_ascii=False)),
                   fetched, new_count, "NULL" if error is None else q(error), run_id)
            )
            psql_run(conn, sql)
        print("[done] status=%s fetched=%d new=%d platforms=%s" % (status, fetched, new_count, json.dumps(platforms_result, ensure_ascii=False)))
        sys.exit(0 if status != "failed" else 2)
    except Exception as e:  # noqa: BLE001
        print("[error] %s" % e, file=sys.stderr)
        if run_id is not None:
            psql_run(conn, "UPDATE job_crawler_runs SET finished_at = now(), status = 'failed', error = %s WHERE id = %d" % (q(str(e)), run_id))
        sys.exit(1)


if __name__ == "__main__":
    main()
