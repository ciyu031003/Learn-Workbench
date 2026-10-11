# -*- coding: utf-8 -*-
"""过滤 + 去重 + 分类路由：输出 bank.jsonl（题库/数据库）与 bundled.json（学习题库）。"""
import json
import re
import sys
import hashlib

OK_CHAR = re.compile(r"[\u4e00-\u9fff\u3000-\u303f\uff00-\uffefA-Za-z0-9 \t`~!@#$%^&*()_+\-=\[\]{};:'\",.<>/?\\|《》【】（）—…·、。；：？！“”‘’]")


def cjk_ok_ratio(s):
    if not s:
        return 0.0
    return len(OK_CHAR.findall(s)) / len(s)


def sig(text):
    return hashlib.sha1(re.sub(r"\s+", "", text).encode("utf-8")).hexdigest()[:16]


TRACK_RULES = [
    ("operating-systems", "os-process-stage", r"(进程|线程|调度|死锁|信号量|互斥|同步|PV操作|页表|虚拟内存|缺页|分页|段页|文件系统|inode|磁盘调度|中断|系统调用|内核态|用户态|银行家)"),
    ("computer-networking", "net-layer-model-stage", r"(TCP|UDP|IP地址|子网|掩码|路由|ARP|DNS|HTTP|HTTPS|以太网|交换机|路由器|拥塞|三次握手|VLAN|NAT|网关|OSI|带宽|时延|CSMA|PPP|ICMP)"),
    ("computer-organization", "co-digital-stage", r"(cache|Cache|流水线|指令|寄存器|总线|补码|浮点|IEEE|存储器|DRAM|SRAM|CPI|MIPS|译码|寻址|ALU|中断屏蔽|磁盘|RAID|DMA)"),
    ("algorithms", "algo-complexity", r"(排序|二叉树|链表|栈|队列|哈希|散列|图论|有向图|无向图|邻接|DFS|BFS|时间复杂|空间复杂|折半查找|Huffman|哈夫曼|平衡树|B树|红黑树|KMP|动态规划|贪心算法|递归|算法|结点|顶点)"),
    ("database", "db-relational", r"(SQL|数据库|索引|事务|范式|关系|主键|外键|视图|存储过程|触发器|并发控制|封锁|日志|恢复|E-R|MySQL|Oracle|Access|openGauss)"),
    ("python", "python-foundation", r"(Python|列表|元组|字典|切片|缩进|PEP|pandas|numpy)"),
    ("java", "java-foundation", r"(Java|JVM|JDK|JRE|字节码|垃圾回收|GC|多态|继承|接口|Servlet|Spring|线程池)"),
    ("javascript", "js-language", r"(JavaScript|JS|DOM|BOM|闭包|原型|Promise|事件循环|ES6|Vue|React|前端|浏览器)"),
    ("linux", "linux-shell-files", r"(Linux|shell|bash|文件权限|chmod|管道|grep|awk|sed|守护进程|xinetd|crontab|systemd)"),
    ("application-security", "sec-foundation", r"(加密|解密|对称|非对称|RSA|证书|防火墙|漏洞|注入|XSS|CSRF|病毒|木马|安全|DES|AES|数字签名|身份认证)"),
    ("computer-networking", "net-link-tools-stage", r"(WLAN|无线|移动通信|蜂窝|5G|蓝牙|Wi-Fi|帧|MAC)"),
    ("computer-organization", "co-memory-io-stage", r"(嵌入式|单片机|ARM|I/O|接口|嵌入式系统)"),
]


def pick_track(text):
    best = None
    for slug, stage, pat in TRACK_RULES:
        if re.search(pat, text):
            return slug, stage
    return best


def load(path):
    return [json.loads(l) for l in open(path, encoding="utf-8")]


def main():
    items = load(".local/csimport/items.jsonl")
    seen = set()
    bank = []
    bundled = {}
    for r in items:
        q = r["question"].strip()
        ans = (r.get("explanation") or r.get("answer_text") or "").strip()
        if r["type"] == "mcq":
            if len(r["options"]) != 4:
                continue
            if len(q) < 6:
                continue
            if cjk_ok_ratio(q) < 0.6:
                continue
        else:
            if len(q) < 6 or len(ans) < 30:
                continue
            if re.search(r"\d{1,4}\s*$", q):
                continue
            if cjk_ok_ratio(q) < 0.6 or cjk_ok_ratio(ans) < 0.75:
                continue
        key = sig(q)
        if key in seen:
            continue
        seen.add(key)
        r["sig"] = key
        bank.append(r)
        if r["type"] == "mcq" and r["correct"]:
            hit = pick_track(q + " " + " ".join(o[1] for o in r["options"]))
            if hit:
                slug, stage = hit
                bundled.setdefault(slug, {"stage": stage, "items": []})["items"].append({
                    "key": "exam-" + key,
                    "stem": q[:300],
                    "options": [o[1][:200] or "(见原题)" for o in r["options"]],
                    "answer": r["correct"],
                    "explanation": (ans or ("参考答案：" + r["correct"]))[:600],
                    "source": r["source"]["note"],
                    "subject": r["subject"],
                })
    with open(".local/csimport/bank.jsonl", "w", encoding="utf-8") as f:
        for r in bank:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    json.dump(bundled, open(".local/csimport/bundled.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    total_b = sum(len(v["items"]) for v in bundled.values())
    print("bank", len(bank), "bundled", total_b, {k: len(v["items"]) for k, v in bundled.items()})


if __name__ == "__main__":
    main()
