#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把服务端原始题库转成 app 用的 schema v1。

输入：D:/APKnixiang/work/njfu-mayuan-applet/traffic/raw-<category>.json
输出：web/public/data/subjects.json 与 web/public/data/<sid>.json

规则：
  qid      = "<sid>:<serverId>"   稳定主键，重导不丢进度
  type     = single | multiple | judge
  answer   = 字符串数组；判断题 A=正确 B=错误
  hash     = sha256(stem + 选项 + 答案)[:16]，用于检测同题内容变更
  同题干多变体全部保留，标 variantOf（取该题干第一次出现的 qid）
"""
import hashlib, json, os, re, sys

# 原始题库目录：默认 <repo>/raw，可用环境变量 NJFU_RAW 覆盖
SRC = os.environ.get("NJFU_RAW") or os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "raw")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "web", "public", "data")

SUBJECTS = [
    ("jindaishi", "中国近代史纲要", "中国近代史纲要"),
    ("xigai", "习近平新时代中国特色社会主义思想", "习近平新时代中国特色社会主义思想"),
    ("mayuan", "马克思主义基本原理", "马克思主义基本原理"),
    ("sifa", "思想道德与法治", "思想道德与法治"),
    ("maogai", "毛泽东思想和中国特色社会主义理论体系概论", "毛泽东思想和中国特色社会主义理论体系概论"),
    ("xinli", "大学生心理健康教育", "大学生心理健康教育"),
    ("rgzn", "人工智能", "人工智能"),
]

TYPE_MAP = {"单选": "single", "多选": "multiple", "判断": "judge"}


def norm_space(s):
    """题干里的 CRLF 统一成 LF，去掉首尾空白；不动内部空格。
    服务端个别选项是数字（如二进制题 10101），统一转字符串。"""
    if isinstance(s, str):
        text = s
    elif s is None:
        text = ""
    else:
        text = str(s)
    return text.replace("\r\n", "\n").replace("\r", "\n").strip()


def build_one(sid, name, category):
    path = os.path.join(SRC, "raw-%s.json" % category)
    recs = json.load(open(path, encoding="utf-8"))["RECORDS"]
    version = sorted({r.get("version") for r in recs if r.get("version")})
    version = version[0] if len(version) == 1 else ",".join(version)

    questions, seen_hash, stem_first = [], {}, {}
    for r in recs:
        qtype = TYPE_MAP.get(r.get("type"))
        if qtype is None:
            raise SystemExit("未知题型 %r in %s" % (r.get("type"), path))
        opts_raw = r.get("options") or {}
        options = [{"key": k, "text": norm_space(v)} for k, v in sorted(opts_raw.items())]
        if qtype == "judge" and not options:
            options = [{"key": "A", "text": "正确"}, {"key": "B", "text": "错误"}]
        answer = [c for c in str(r.get("answer") or "") if c.isalpha()]
        if not answer:
            raise SystemExit("空答案 %s in %s" % (r.get("id"), path))

        stem = norm_space(r.get("question"))
        h = hashlib.sha256(
            (stem + "|" + json.dumps(options, ensure_ascii=False, sort_keys=True) + "|" + "".join(answer)).encode("utf-8")
        ).hexdigest()[:16]
        qid = "%s:%s" % (sid, r.get("id"))
        key = (qtype, stem)
        variant_of = stem_first.get(key)
        stem_first.setdefault(key, qid)
        seen_hash[h] = seen_hash.get(h, 0) + 1

        questions.append({
            "qid": qid,
            "serverId": r.get("id"),
            "type": qtype,
            "stem": stem,
            "options": options,
            "answer": answer,
            "version": r.get("version"),
            "hash": h,
            "variantOf": variant_of or None,
        })

    # 断言
    assert len(questions) == len(recs), "记录数不一致"
    assert len({q["qid"] for q in questions}) == len(questions), "qid 重复"
    for q in questions:
        keys = {o["key"] for o in q["options"]}
        assert set(q["answer"]) <= keys, "答案字母不在选项内: %s" % q["qid"]
        assert len(q["stem"]) > 0, "空题干: %s" % q["qid"]
        if q["type"] == "single":
            assert len(q["answer"]) == 1, "单选答案长度: %s" % q["qid"]
        if q["type"] == "multiple":
            assert len(q["answer"]) >= 2, "多选答案长度: %s" % q["qid"]
        if q["type"] == "judge":
            assert q["answer"][0] in ("A", "B"), "判断答案非 A/B: %s" % q["qid"]

    by_type = {}
    for q in questions:
        by_type[q["type"]] = by_type.get(q["type"], 0) + 1

    payload = {
        "schema": "njfu-quiz/v1",
        "subject": {
            "id": sid, "name": name, "term": "2026", "version": version,
            "count": len(questions), "byType": by_type,
            "variants": sum(1 for q in questions if q["variantOf"]),
        },
        "questions": questions,
    }
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, sid + ".json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    return payload["subject"]


if __name__ == "__main__":
    index = []
    total = 0
    for sid, name, category in SUBJECTS:
        s = build_one(sid, name, category)
        index.append(s)
        total += s["count"]
        print("  %-10s %-30s %5d 条  version=%s  题型=%s  变体=%d" % (
            sid, name, s["count"], s["version"], s["byType"], s["variants"]))
    with open(os.path.join(OUT, "subjects.json"), "w", encoding="utf-8") as f:
        json.dump({"schema": "njfu-quiz/v1", "subjects": index, "total": total}, f,
                  ensure_ascii=False, indent=2)
    print("\n合计 %d 条，索引写入 %s" % (total, os.path.join(OUT, "subjects.json")))
