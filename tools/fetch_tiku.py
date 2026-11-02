#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从服务端题库目录拉取全部 2026 版题库（原始 RECORDS 格式）。

流程：
  1. GET loadDate.php 取 tiku_data（题库目录）
  2. 筛 version 以 "2026" 开头的条目
  3. 逐个 GET json/<category>.json?category=<category>，落 raw/raw-<category>.json
  4. 打印清单与体积，不覆盖已存在且内容相同的文件

用法： python scripts/fetch_tiku.py [--all] [--force]
       --all    不按 2026 过滤，拉目录里全部题库
       --force  即使已存在也重新下载
"""
import json, os, subprocess, sys, urllib.parse

# 输出到 <repo>/raw/，build_data.py 默认从这里读
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRAFFIC = os.environ.get("NJFU_RAW") or os.path.join(BASE, "raw")
HOST = "https://minirainer.top/api/question_test/"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"


def get(url, timeout=90):
    """用 curl 取数据。python 自带的 TLS 栈与目标服务端握手会 SSL UNEXPECTED_EOF，curl 正常。"""
    p = subprocess.run(["curl", "-sS", "--noproxy", "*", "--max-time", str(timeout), "-A", UA,
                        "-w", "\n%{http_code}", url],
                       capture_output=True)
    if p.returncode != 0:
        raise RuntimeError("curl failed: %s" % p.stderr.decode("utf-8", "replace"))
    body, _, code = p.stdout.rpartition(b"\n")
    return int(code or 0), body


def catalog():
    code, body = get(HOST + "loadDate.php?openid=test")
    d = json.loads(body.decode("utf-8"))
    tiku = d.get("tiku_data")
    if isinstance(tiku, str):
        tiku = json.loads(tiku)
    return tiku


def fetch_one(cat, force=False):
    out = os.path.join(TRAFFIC, "raw-%s.json" % cat)
    url = HOST + "json/%s.json?category=%s" % (urllib.parse.quote(cat), urllib.parse.quote(cat))
    if os.path.exists(out) and not force:
        try:
            recs = json.load(open(out, encoding="utf-8"))["RECORDS"]
            return {"category": cat, "status": "cached", "records": len(recs),
                    "bytes": os.path.getsize(out), "file": os.path.basename(out)}
        except Exception:
            pass
    code, body = get(url)
    data = json.loads(body.decode("utf-8"))
    recs = data.get("RECORDS")
    if code != 200 or not isinstance(recs, list):
        return {"category": cat, "status": "FAIL http=%s" % code, "records": 0, "bytes": 0}
    with open(out, "wb") as f:
        f.write(body)
    return {"category": cat, "status": "downloaded", "records": len(recs),
            "bytes": len(body), "file": os.path.basename(out)}


def main():
    force = "--force" in sys.argv
    all_ = "--all" in sys.argv
    os.makedirs(TRAFFIC, exist_ok=True)
    cat = catalog()
    picked = cat if all_ else [x for x in cat if str(x.get("version", "")).startswith("2026")]
    print("目录共 %d 个题库，%s %d 个" % (len(cat), "全选" if all_ else "2026 版", len(picked)))
    results = []
    for item in picked:
        name = item["category"]
        r = fetch_one(name, force)
        r.update({"version": item.get("version"), "pay": item.get("pay")})
        results.append(r)
        print("  %-30s %-10s %5s 条  %8d B  version=%s pay=%s" % (
            name, r["status"], r["records"], r["bytes"], r.get("version"), r.get("pay")))
    summary = os.path.join(TRAFFIC, "_fetch_2026.json")
    json.dump(results, open(summary, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    total = sum(r["records"] for r in results)
    print("\n合计 %d 条，%d 个题库，清单写入 %s" % (total, len(results), summary))
    return 0 if all(r["status"] in ("cached", "downloaded") for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
