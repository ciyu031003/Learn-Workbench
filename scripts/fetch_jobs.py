# ⚠️ DEPRECATED（2026-08-23 起）
# 本 Python 爬虫已被 Node 双引擎取代（scripts/jobs_browser.mjs + scripts/jobs_official.mjs）：
#   - 生产服务器（Docker）使用 Node 引擎，支持代理(JOBS_PROXY)/登录态(storageState)/Playwright 过 WAF
#   - 本文件仅保留用于本地 --mock 演示与历史参考，不再维护新平台/反爬适配
#   - 计划在确认无本地计划任务依赖后删除（见 docs/JOBS_ANTI_CRAWL.md）
# 本地演示仍可用：python scripts/fetch_jobs.py --mock#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
招花 · 招聘信息爬虫（ICT 学习工作台）—— 调优版

读取所有账号的爬虫配置（job_crawler_configs，enabled=true），按 关键词 x 城市 x 平台
组合抓取招聘信息，规范化后 upsert 到 job_postings（source+source_job_id 去重，
content_hash 相同则跳过 UPDATE，减少写放大），并写入 job_crawler_runs 运行日志。

调优点：
  1) 并发抓取：ThreadPoolExecutor + 每平台限速信号量（--concurrency 控制并发度）
  2) 组合去重：多账号重叠的 (平台, 关键词, 城市) 只抓一次
  3) 分页：适配器按配置 max_pages 翻页（--pages 可覆盖）
  4) 指数退避重试（--retries）
  5) 归一化：发布时间统一转 ISO（兼容毫秒时间戳/空格分隔日期）、HTML 清洗、薪资解析扩展（万/月、年薪）
  6) 精确统计：new_count 用键差集计算，不再用 before/after 全表计数
  7) 分批 upsert（每批 100 行），避免超长 SQL

用法示例：
  python scripts/fetch_jobs.py                          # 真实抓取（需联网）
  python scripts/fetch_jobs.py --mock                   # 本地演示：生成示例职位（不联网）
  python scripts/fetch_jobs.py --concurrency 8 --pages 3
  python scripts/fetch_jobs.py --db "host=127.0.0.1 port=5432 dbname=Learn-Workbench user=postgres"
依赖：仅 Python 标准库（urllib / concurrent.futures）。
"""

import argparse
import concurrent.futures
import datetime
import gzip
import hashlib
import html as html_mod
import io
import json
import os
import random
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
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

UPSERT_CHUNK = 100  # 每批写入行数

# 可选：每个平台的 Cookie（--cookies-file 注入，个人登录浏览器后粘贴最实用）
EXTRA_COOKIES = {}
DEBUG = False


# ---------------------------------------------------------------------------
# 数据库辅助（psql，stdin 传 SQL，避免 Windows 命令行中文编码问题）
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
        raw = out.decode("utf-8", errors="replace").strip()
        # psql 会把长 JSON 自动折行，合并全部行后再解析
        line = "".join(raw.splitlines()).strip()
        return json.loads(line or "null")
    except Exception as e:  # noqa: BLE001
        print("[warn] psql 查询失败：%s" % e, file=sys.stderr)
        return None


def q(s):
    return "'" + ("" if s is None else str(s)).replace("'", "''") + "'"


def arr_literal(items):
    return "ARRAY[" + ",".join("'" + str(i).replace("'", "''") + "'" for i in items) + "]"


# ---------------------------------------------------------------------------
# 配置读取（合并所有启用账号的配置；无配置时使用默认值）
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
            "max_pages": max(1, int(c.get("max_pages") or 2)),
        })
    return cleaned


# ---------------------------------------------------------------------------
# 归一化工具
# ---------------------------------------------------------------------------

def parse_salary(text):
    """解析薪资文本为 (min, max)（单位：K/月）。
    支持：'15k-25k' / '15k-25k·13薪' / '200-300/天' / '2万-3万/月' / '30-50万/年' / '面议'。
    """
    if not text:
        return None, None
    t = text.replace("K", "k").strip()
    m = re.search(r"(\d+(?:\.\d+)?)\s*k\s*[-~—至]\s*(\d+(?:\.\d+)?)\s*k", t)
    if m:
        return float(m.group(1)), float(m.group(2))
    # 万/月 或 万-万/年（年薪近似折算为月薪：/12）；兼容 "30-50万/年"（万 只在后面出现）
    yearly = "年" in t
    mw = re.search(r"(\d+(?:\.\d+)?)\s*万\s*[-~—至]\s*(\d+(?:\.\d+)?)\s*万", t)
    if not mw:
        mw = re.search(r"(\d+(?:\.\d+)?)\s*[-~—至]\s*(\d+(?:\.\d+)?)\s*万", t)
    if mw:
        a = float(mw.group(1)) * 10.0
        b = float(mw.group(2)) * 10.0
        if yearly:
            a, b = round(a / 12.0, 1), round(b / 12.0, 1)
        return a, b
    # 单个 万 值："30万/年以上" / "2万/月"
    ms = re.search(r"(\d+(?:\.\d+)?)\s*万", t)
    if ms:
        a = float(ms.group(1)) * 10.0
        if yearly:
            a = round(a / 12.0, 1)
        return a, a
    m2 = re.search(r"(\d+(?:\.\d+)?)\s*[-~—至]\s*(\d+(?:\.\d+)?)", t)
    if m2 and ("/" not in t or "天" in t or "日" in t):
        return float(m2.group(1)), float(m2.group(2))
    m3 = re.search(r"(\d+(?:\.\d+)?)\s*k", t)
    if m3:
        return float(m3.group(1)), float(m3.group(1))
    return None, None


def parse_published_at(value):
    """把各平台五花八门的发布时间统一为 ISO 8601；解析失败返回 None。
    支持：毫秒/秒时间戳、'YYYY-MM-DD HH:MM:SS'、ISO、datetime 对象。
    """
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        v = float(value)
        if v > 1e12:  # 毫秒
            v = v / 1000.0
        try:
            return datetime.datetime.fromtimestamp(v).isoformat()
        except Exception:  # noqa: BLE001
            return None
    if isinstance(value, datetime.datetime):
        return value.isoformat()
    s = str(value).strip()
    # 纯数字时间戳（字符串形式）
    if s.isdigit():
        return parse_published_at(float(s))
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(s, fmt).isoformat()
        except ValueError:
            continue
    # 尝试 ISO（含 T 和时区）
    try:
        return datetime.datetime.fromisoformat(s).isoformat()
    except ValueError:
        return None


def strip_html(text):
    if not text:
        return ""
    s = re.sub(r"<[^>]+>", "\n", str(text))
    s = html_mod.unescape(s)
    s = re.sub(r"[ \t\u3000]+", " ", s)
    s = re.sub(r"\n\s*\n+", "\n", s)
    return s.strip()


def content_hash(p):
    """对职位内容做哈希，用于判断是否需要 UPDATE。"""
    raw = "|".join([
        p.get("title", ""), p.get("company", ""), p.get("city", ""), p.get("district", ""),
        p.get("salary_text", ""), p.get("experience", ""), p.get("education", ""),
        json.dumps(p.get("tags", []), ensure_ascii=False, sort_keys=True),
        p.get("description", ""), p.get("requirements", ""), p.get("company_info", ""),
        p.get("url", ""), p.get("logo_url", ""),
    ])
    return hashlib.md5(raw.encode("utf-8", errors="replace")).hexdigest()


# ---------------------------------------------------------------------------
# HTTP 辅助（gzip 解压 + 重试）
# ---------------------------------------------------------------------------

def _read_response(resp):
    data = resp.read()
    if (resp.headers.get("Content-Encoding") or "").lower() in ("gzip", "x-gzip"):
        try:
            data = gzip.GzipFile(fileobj=io.BytesIO(data)).read()
        except Exception:  # noqa: BLE001
            pass
    return data


def _cookie_for(url):
    for host, ck in EXTRA_COOKIES.items():
        if host and ck and host in url:
            return ck
    return None


def http_get(url, headers=None, timeout=15):
    h = {"User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9", "Accept": "*/*",
         "Accept-Encoding": "gzip, deflate"}
    ck = _cookie_for(url)
    if ck:
        h["Cookie"] = ck
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return _read_response(resp).decode("utf-8", errors="replace")


def http_post(url, data, headers=None, timeout=15):
    h = {"User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9",
         "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
         "Accept-Encoding": "gzip, deflate", "Referer": url}
    ck = _cookie_for(url)
    if ck:
        h["Cookie"] = ck
    if headers:
        h.update(headers)
    body = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return _read_response(resp).decode("utf-8", errors="replace")


# ---------------------------------------------------------------------------
# 适配器（每个返回 raw 列表；内部已做分页）
# ---------------------------------------------------------------------------

def adapt_lagou(keyword, city, pages, limit):
    """拉勾：positionAjax.json 接口（需 cookie，可能被风控）。"""
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
    base = "https://www.lagou.com/jobs/list_" + urllib.parse.quote(keyword)
    try:
        opener.open(urllib.request.Request(base, headers={"User-Agent": UA}), timeout=15).read()
    except Exception:  # noqa: BLE001
        pass
    out = []
    for pn in range(1, max(1, pages) + 1):
        data = {"first": "true" if pn == 1 else "false", "pn": pn, "kd": keyword}
        if city:
            data["city"] = city
        req = urllib.request.Request(base.replace("/jobs/list_", "/jobs/positionAjax.json?needAddtionalResult=false"),
                                     data=urllib.parse.urlencode(data).encode("utf-8"), headers={
            "User-Agent": UA, "Referer": base, "X-Requested-With": "XMLHttpRequest",
        })
        try:
            with opener.open(req, timeout=15) as resp:
                payload = json.loads(_read_response(resp).decode("utf-8", errors="replace"))
        except Exception:  # noqa: BLE001
            break
        results = (((payload.get("content") or {}).get("positionResult") or {}).get("result")) or []
        if not results:
            break
        for it in results:
            if len(out) >= limit:
                return out
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
                "description": strip_html(it.get("positionDetail") or ""),
                "requirements": "",
                "company_info": it.get("industryField") or "",
                "url": "https://www.lagou.com/jobs/" + str(it.get("positionId") or "") + ".html",
                "logo_url": "",
                "published_at": parse_published_at(it.get("createTime")),
            })
    return out


def adapt_liepin(keyword, city, pages, limit):
    """猎聘：搜索页内嵌 __INITIAL_STATE__（风控较重，失败返回空）。"""
    out = []
    for page in range(1, min(max(1, pages), 2) + 1):
        url = "https://www.liepin.com/zhaopin/?key=" + urllib.parse.quote(keyword)
        if city:
            url += "&dq=" + urllib.parse.quote(city)
        if page > 1:
            url += "&curPage=" + str(page - 1)
        try:
            html_text = http_get(url)
        except Exception:  # noqa: BLE001
            break
        m = re.search(r"window\.__INITIAL_STATE__\s*=\s*(\{.*?\})\s*;", html_text, re.S)
        if not m:
            break
        try:
            state = json.loads(m.group(1))
        except Exception:  # noqa: BLE001
            break
        items = ((state.get("jobData") or {}).get("list") or [])
        if not items:
            break
        for it in items:
            if len(out) >= limit:
                return out
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
                "published_at": parse_published_at(it.get("pubTime")),
            })
    return out


def adapt_zhilian(keyword, city, pages, limit):
    """智联招聘：fe-api 搜索接口。"""
    city_map = {"北京": "530", "上海": "538", "广州": "653", "深圳": "765", "杭州": "619",
                "成都": "801", "西安": "715", "乌鲁木齐": "749", "重庆": "551"}
    city_id = city_map.get(city, "489")
    out = []
    page_size = min(limit, 90)
    for page in range(1, max(1, pages) + 1):
        params = {"start": str((page - 1) * page_size), "pageSize": str(page_size),
                  "cityId": city_id, "kw": keyword, "kt": "3"}
        url = "https://fe-api.zhaopin.com/c/i/sou?" + urllib.parse.urlencode(params)
        try:
            payload = json.loads(http_get(url, headers={"Referer": "https://sou.zhaopin.com/"}))
        except Exception:  # noqa: BLE001
            break
        results = (payload.get("data") or {}).get("results") or []
        if not results:
            break
        for it in results:
            if len(out) >= limit:
                return out
            sal_min, sal_max = parse_salary(it.get("salary") or "")
            out.append({
                "source_job_id": str(it.get("number") or ""),
                "title": it.get("jobName") or keyword,
                "company": (it.get("company", {}) or {}).get("name") or "",
                "city": (it.get("city", {}) or {}).get("display") or city or "",
                "district": (it.get("businessDistrict") or {}).get("display") or "",
                "salary_min": sal_min, "salary_max": sal_max,
                "salary_text": it.get("salary") or "",
                "experience": (it.get("workingExp", {}) or {}).get("name") or "",
                "education": (it.get("eduLevel", {}) or {}).get("name") or "",
                "tags": list(it.get("labels") or []),
                "description": strip_html(it.get("jobDesc") or ""),
                "requirements": "",
                "company_info": (it.get("company", {}) or {}).get("type", {}).get("name") or "",
                "url": it.get("positionURL") or ("https://sou.zhaopin.com/jobs/" + str(it.get("number") or "") + ".html"),
                "logo_url": (it.get("company", {}) or {}).get("logo") or "",
                "published_at": parse_published_at(it.get("updateDate")),
            })
    return out


def adapt_job51(keyword, city, pages, limit):
    """前程无忧：we.51job.com 搜索 API。"""
    area_map = {"北京": "010000", "上海": "020000", "广州": "030200", "深圳": "040000",
                "杭州": "080200", "成都": "090200", "西安": "200200", "乌鲁木齐": "330100"}
    out = []
    for page in range(1, max(1, pages) + 1):
        params = {"api_key": "51job", "timestamp": str(int(time.time())), "keyword": keyword,
                  "searchType": "2", "pageNum": str(page), "pageSize": str(min(limit, 50))}
        if city:
            params["jobArea"] = area_map.get(city, "")
        url = "https://we.51job.com/api/job/search-pc?" + urllib.parse.urlencode(params)
        try:
            payload = json.loads(http_get(url, headers={"Referer": "https://we.51job.com/"}))
        except Exception:  # noqa: BLE001
            break
        items = (((payload.get("resultbody") or {}).get("job") or {}).get("items")) or []
        if not items:
            break
        for it in items:
            if len(out) >= limit:
                return out
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
                "description": strip_html(it.get("jobdescribe") or ""),
                "requirements": "",
                "company_info": it.get("companytype", {}).get("name") or "",
                "url": it.get("jobHref") or ("https://jobs.51job.com/" + str(it.get("jobid") or "") + ".html"),
                "logo_url": it.get("companylogo") or "",
                "published_at": parse_published_at(it.get("updateDateTime") or it.get("issuedate")),
            })
    return out


def adapt_boss(keyword, city, pages, limit):
    """Boss 直聘（实验性）：公开搜索页，强风控，大概率被拦，失败返回空。"""
    url = "https://www.zhipin.com/web/geek/job?query=" + urllib.parse.quote(keyword)
    if city:
        url += "&city=" + urllib.parse.quote(city)
    try:
        html_text = http_get(url, headers={"Referer": "https://www.zhipin.com/"})
    except Exception:  # noqa: BLE001
        return []
    names = re.findall(r'"jobName"\s*:\s*"([^"]+)"', html_text)
    out = []
    for idx, name in enumerate(names[:limit]):
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
# 组合抓取（带重试）
# ---------------------------------------------------------------------------

def fetch_one_combo(source, keyword, city, pages, limit, semaphore, retries, debug=False):
    adapter = ADAPTERS.get(source)
    if adapter is None:
        return []
    attempt = 0
    while True:
        with semaphore:
            try:
                items = adapter(keyword, city or "", pages, limit)
                items = [it for it in items if it.get("source_job_id") and it.get("title")]
                if not items and debug:
                    probe = debug_probe(source, keyword, city or "")
                    print("[debug] %s x %s x %s 返回空；响应片段：%s" % (source, keyword, city or "全国", probe[:160].replace("\n", " ")), file=sys.stderr)
                return items
            except Exception as e:  # noqa: BLE001
                attempt += 1
                if attempt > retries:
                    raise
                time.sleep(2 ** attempt + random.uniform(0.2, 0.8))
    # pragma: no cover


def debug_probe(source, keyword, city):
    """抓取原始响应前 200 字符，帮助判断是被风控还是接口变更。"""
    try:
        if source == "lagou":
            import urllib.parse as _up
            return http_get("https://www.lagou.com/jobs/list_" + _up.quote(keyword), timeout=10)
        if source == "liepin":
            import urllib.parse as _up
            u = "https://www.liepin.com/zhaopin/?key=" + _up.quote(keyword)
            if city:
                u += "&dq=" + _up.quote(city)
            return http_get(u, timeout=10)
        if source == "zhilian":
            return http_get("https://fe-api.zhaopin.com/c/i/sou?start=0&pageSize=10&cityId=489&kw=" + urllib.parse.quote(keyword) + "&kt=3", headers={"Referer": "https://sou.zhaopin.com/"}, timeout=10)
        if source == "job51":
            return http_get("https://we.51job.com/api/job/search-pc?api_key=51job&timestamp=" + str(int(time.time())) + "&keyword=" + urllib.parse.quote(keyword) + "&searchType=2&pageNum=1&pageSize=10", headers={"Referer": "https://we.51job.com/"}, timeout=10)
        if source == "boss":
            import urllib.parse as _up
            u = "https://www.zhipin.com/web/geek/job?query=" + _up.quote(keyword)
            if city:
                u += "&city=" + _up.quote(city)
            return http_get(u, headers={"Referer": "https://www.zhipin.com/"}, timeout=10)
    except Exception as e:  # noqa: BLE001
        return "ERR:" + str(e)
    return ""


def normalize_row(source, raw):
    """补齐字段 + 清洗 + 计算 content_hash。"""
    tags = []
    for t in raw.get("tags") or []:
        t = str(t).strip()
        if t and t not in tags:
            tags.append(t[:40])
    desc = strip_html(raw.get("description") or "")
    req = strip_html(raw.get("requirements") or "")
    cinfo = strip_html(raw.get("company_info") or "")
    p = {
        "source": source,
        "source_job_id": str(raw.get("source_job_id") or "").strip()[:120],
        "title": str(raw.get("title") or "").strip()[:120],
        "company": str(raw.get("company") or "").strip()[:120],
        "city": str(raw.get("city") or "").strip()[:40],
        "district": str(raw.get("district") or "").strip()[:60],
        "salary_min": raw.get("salary_min"),
        "salary_max": raw.get("salary_max"),
        "salary_text": str(raw.get("salary_text") or "").strip()[:60],
        "experience": str(raw.get("experience") or "").strip()[:30],
        "education": str(raw.get("education") or "").strip()[:30],
        "tags": tags[:10],
        "description": desc[:5000],
        "requirements": req[:3000],
        "company_info": cinfo[:500],
        "url": str(raw.get("url") or "").strip()[:500],
        "logo_url": str(raw.get("logo_url") or "").strip()[:500],
        "published_at": parse_published_at(raw.get("published_at")),
    }
    p["content_hash"] = content_hash(p)
    return p


# ---------------------------------------------------------------------------
# 入库（分批 upsert + content_hash 条件更新 + 精确 new_count）
# ---------------------------------------------------------------------------

def existing_keys(conn, sources):
    if not sources:
        return set()
    v = psql_query_json(
        conn,
        "SELECT coalesce(json_agg(t), '[]'::json) FROM ("
        "SELECT source || '|' || source_job_id AS k FROM job_postings "
        "WHERE source = ANY(" + arr_literal(sources) + ")) t",
    )
    if not isinstance(v, list):
        return set()
    keys = set()
    for x in v:
        if isinstance(x, dict):
            keys.add(str(x.get("k") or ""))
        else:
            keys.add(str(x))
    return keys


def upsert_postings(conn, rows):
    """分批 upsert；返回 (总写入尝试数)。content_hash 相同则跳过 UPDATE。"""
    if not rows:
        return
    for start in range(0, len(rows), UPSERT_CHUNK):
        chunk = rows[start:start + UPSERT_CHUNK]
        values = []
        for p in chunk:
            values.append(
                "(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
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
                    q(p["content_hash"]),
                    "now()",
                    "true",
                )
            )
        sql = (
            "INSERT INTO job_postings "
            "(source, source_job_id, title, company, city, district, salary_min, salary_max, "
            "salary_text, experience, education, tags, description, requirements, company_info, "
            "url, logo_url, published_at, content_hash, fetched_at, is_active) VALUES "
            + ",".join(values) +
            " ON CONFLICT (source, source_job_id) DO UPDATE SET "
            "title = EXCLUDED.title, company = EXCLUDED.company, city = EXCLUDED.city, "
            "district = EXCLUDED.district, salary_min = EXCLUDED.salary_min, "
            "salary_max = EXCLUDED.salary_max, salary_text = EXCLUDED.salary_text, "
            "experience = EXCLUDED.experience, education = EXCLUDED.education, "
            "tags = EXCLUDED.tags, description = EXCLUDED.description, "
            "requirements = EXCLUDED.requirements, company_info = EXCLUDED.company_info, "
            "url = EXCLUDED.url, logo_url = EXCLUDED.logo_url, "
            "published_at = EXCLUDED.published_at, content_hash = EXCLUDED.content_hash, "
            "fetched_at = now(), is_active = true "
            "WHERE job_postings.content_hash IS DISTINCT FROM EXCLUDED.content_hash"
        )
        psql_run(conn, sql)


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

    ap = argparse.ArgumentParser(description="招花 · 招聘信息爬虫（调优版）")
    ap.add_argument("--db", default=None, help="PostgreSQL 连接串（缺省用环境变量/本地默认）")
    ap.add_argument("--mock", action="store_true", help="本地演示模式：生成示例职位，不联网")
    ap.add_argument("--limit", type=int, default=100, help="每 (平台x关键词x城市) 最多抓取条数（默认 100）")
    ap.add_argument("--concurrency", type=int, default=6, help="并发抓取数（默认 6）")
    ap.add_argument("--pages", type=int, default=None, help="每组合翻页数（默认取账号配置 max_pages）")
    ap.add_argument("--retries", type=int, default=2, help="额外重试次数（默认 2）")
    ap.add_argument("--timeout-min", type=int, default=25, help="本轮总时长上限（分钟，默认 25）")
    ap.add_argument("--cookies-file", default=None, help='JSON 文件：{平台域名: "Cookie 头字符串"}，注入请求绕过登录态限制')
    ap.add_argument("--debug", action="store_true", help="空结果时打印原始响应片段，便于排查风控/接口变更")
    args = ap.parse_args()

    conn = args.db
    global EXTRA_COOKIES, DEBUG
    DEBUG = args.debug
    if args.cookies_file and os.path.exists(args.cookies_file):
        try:
            with open(args.cookies_file, "r", encoding="utf-8") as f:
                EXTRA_COOKIES = {str(k).strip(): str(v) for k, v in json.load(f).items()}
            print("[info] 已加载 %d 个平台的 Cookie" % len(EXTRA_COOKIES))
        except Exception as e:  # noqa: BLE001
            print("[warn] 读取 cookies 文件失败：%s" % e, file=sys.stderr)
    started = datetime.datetime.now()
    deadline = time.monotonic() + args.timeout_min * 60

    # 创建运行日志
    run_id = None
    v = psql_query_json(conn, "INSERT INTO job_crawler_runs (started_at, status) VALUES (%s, 'running') RETURNING id" % q(started.isoformat()))
    if isinstance(v, int):
        run_id = v

    configs = load_configs(conn)
    if not configs:
        print("[info] 无启用配置，使用默认关键词/平台")

    try:
        if args.mock:
            print("[info] 演示模式：生成本地示例职位")
            raw_rows = gen_mock(configs, args.limit)
            rows = [normalize_row(r["source"], r) for r in raw_rows]
            sources = sorted({r["source"] for r in rows})
            existing = existing_keys(conn, sources)
            new_rows = [r for r in rows if (r["source"] + "|" + r["source_job_id"]) not in existing]
            upsert_postings(conn, rows)
            platforms_result = {}
            for r in rows:
                platforms_result[r["source"]] = platforms_result.get(r["source"], 0) + 1
            status = "success"
            error = None
            fetched = len(rows)
            new_count = len(new_rows)
        else:
            # 1) 聚合去重后的 (平台, 关键词, 城市) 组合
            combos = {}
            pages_by_src = {}
            for cfg in configs:
                for source in (cfg.get("platforms") or DEFAULT_PLATFORMS):
                    pages_by_src[source] = max(pages_by_src.get(source, 0), cfg.get("max_pages", 2))
                    for kw in cfg.get("keywords") or DEFAULT_KEYWORDS:
                        for city in (cfg.get("cities") or [""]):
                            key = (source, kw, city)
                            combos.setdefault(key, None)
            if args.pages:
                pages_by_src = {s: args.pages for s in pages_by_src}

            combos_list = list(combos.keys())
            print("[info] 组合数 %d，平台 %s，并发 %d" % (len(combos_list), sorted(pages_by_src), args.concurrency))

            semaphores = {s: threading.Semaphore(max(1, args.concurrency // 2)) for s in pages_by_src}
            results = []
            errors = []

            def work(combo):
                source, kw, city = combo
                pages = pages_by_src.get(source, 2)
                label = PLATFORMS.get(source, source)
                if time.monotonic() > deadline:
                    return None
                try:
                    items = fetch_one_combo(source, kw, city, pages, args.limit, semaphores[source], args.retries, DEBUG)
                    print("[ok] %s x %s x %s -> %d 条" % (label, kw, city or "全国", len(items)))
                    return [normalize_row(source, it) for it in items]
                except Exception as e:  # noqa: BLE001
                    errors.append("%s:%s:%s -> %s" % (label, kw, city or "全国", e))
                    print("[warn] %s 抓取失败：%s" % (label, e), file=sys.stderr)
                    return None

            with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as ex:
                futures = [ex.submit(work, c) for c in combos_list]
                for f in concurrent.futures.as_completed(futures):
                    r = f.result()
                    if r:
                        results.extend(r)

            # 2) 内存去重（同 key 保留后抓到的）
            dedup = {}
            for r in results:
                dedup[(r["source"], r["source_job_id"])] = r
            rows = list(dedup.values())

            # 3) 精确 new_count + 分批写入
            sources = sorted(pages_by_src)
            existing = existing_keys(conn, sources)
            new_rows = [r for r in rows if (r["source"] + "|" + r["source_job_id"]) not in existing]
            upsert_postings(conn, rows)

            platforms_result = {}
            for r in rows:
                platforms_result[r["source"]] = platforms_result.get(r["source"], 0) + 1
            fetched = len(rows)
            new_count = len(new_rows)
            if errors:
                status = "failed"
            elif fetched == 0:
                status = "partial"
                errors.append("0 条结果（可能被平台风控拦截，可用 --debug 排查）")
            else:
                status = "success"
            error = ("；".join(errors[:5])) if errors else None

        finished = datetime.datetime.now()
        if run_id is not None:
            sql = (
                "UPDATE job_crawler_runs SET finished_at = %s, status = %s, "
                "platforms_result = %s, fetched_count = %d, new_count = %d, error = %s WHERE id = %d"
                % (q(finished.isoformat()), q(status), q(json.dumps(platforms_result, ensure_ascii=False)),
                   fetched, new_count, "NULL" if error is None else q(error), run_id)
            )
            psql_run(conn, sql)
        print("[done] status=%s fetched=%d new=%d 用时=%.1fs platforms=%s"
              % (status, fetched, new_count, (finished - started).total_seconds(),
                 json.dumps(platforms_result, ensure_ascii=False)))
        sys.exit(0 if status != "failed" else 2)
    except Exception as e:  # noqa: BLE001
        print("[error] %s" % e, file=sys.stderr)
        if run_id is not None:
            psql_run(conn, "UPDATE job_crawler_runs SET finished_at = now(), status = 'failed', error = %s WHERE id = %d" % (q(str(e)), run_id))
        sys.exit(1)


if __name__ == "__main__":
    main()
