# NJFU 刷题

作者：青棠

南林马院 2026 题库 + 军事理论题库的刷题应用。8 门科目、9323 道题，网页与安卓双端，纯本地运行，不上传任何数据。

在线体验：https://qingtang666666-source.github.io/njfu-quiz/

安卓安装包：见 Releases 或 `release/NJFU刷题-1.0.apk`

## 功能

- 科目列表：题量、已答进度、正确率
- 顺序练习：从上次位置继续，单题一屏，选完立即判分，显示正确答案与选项文字
- 填空题：按空输入，逐空判分，忽略空格标点，括号别名（如「七七事变（又称卢沟桥事变）」）也算对
- 简答/论述：背题模式，点「显示答案要点」展开，只记「已看」不判分
- 随机练习、错题本、收藏练习
- 错题重做：只出错题，连续答对 2 次才移出错题本，答错清零重来；一轮结束可「再来一轮」
  - 掌握标准可在设置里改成 1 / 2 / 3 次
- 模拟考试：60 单选 + 10 多选 + 10 判断，60 分钟倒计时，自动交卷，按题计分
- 答题卡跳题，按对错着色
- 搜索：按题干或选项关键词
- 统计：分科目、分题型、最近记录
- 深色模式、三档字号
- 备份导出 / 导入（JSON）
- 离线：Service Worker 缓存（网页）或资源内置（APK）
- 键盘操作：A–F 选项，Enter 确认 / 下一题，← → 翻页

## 目录

```
njfu-quiz/
├── web/                    前端（Vite + React + TypeScript + Dexie）
│   ├── public/data/        题库（subjects.json + 每科目一个 json，共 3.9 MB）
│   ├── src/
│   │   ├── domain/         纯逻辑：类型、判分、组卷
│   │   ├── db/             Dexie 表结构与全部读写
│   │   ├── pages/          页面
│   │   └── App.tsx         路由与全局状态
│   ├── android/            Capacitor 安卓工程
│   └── tests/              vitest 单测 + Playwright 端到端脚本
├── data/scripts/           题库转换：原始 RECORDS → schema v1
├── tools/                  抓取脚本与打包辅助
├── deploy/                 发布脚本（GitHub Pages / Netlify Drop / APK）
└── release/                APK 产物
```

## 题库流水线

```bash
# 1. 从服务端目录拉取（输出到 raw/）
PYTHONUTF8=1 python tools/fetch_tiku.py

# 2. 转成应用用的 schema v1（输出到 web/public/data/）
PYTHONUTF8=1 python data/scripts/build_data.py
```

转换脚本内置断言：题数一致、qid 唯一、答案字母落在选项内、单选答案长度 1、多选 ≥ 2、判断 ∈ {A,B}。任一不过直接退出，不写坏数据。

题库 schema：

```jsonc
{
  "schema": "njfu-quiz/v1",
  "subject": { "id": "mayuan", "name": "马克思主义基本原理", "version": "20260701", "count": 1720 },
  "questions": [{
    "qid": "mayuan:1",          // 科目:服务端id，重导不丢进度
    "type": "single",           // single | multiple | judge
    "stem": "……",
    "options": [{ "key": "A", "text": "…" }],
    "answer": ["D"],            // 统一数组；判断题 A=正确 B=错误
    "version": "20260701",
    "hash": "…",                // 内容指纹，用于检测同题改动
    "variantOf": null           // 同题干多变体指向首条
  }]
}
```

## 开发

```bash
cd web
npm install
npm run dev          # http://localhost:5173
npm run build        # 产物 dist/
npm run preview      # http://localhost:4173
npx vitest run       # 32 个单测
```

端到端（需先起 preview）：

```bash
python tests/e2e_smoke.py     # 首页→科目→练习→判分→翻页→答题卡→模考
python tests/e2e_flows.py     # 连答→错题本→刷新持久化→统计→深色
```

## 发布网页

```powershell
# 只更新站点（构建 + 推 gh-pages）
powershell -ExecutionPolicy Bypass -File deploy\publish.ps1

# 同时把源码改动推到 main
powershell -ExecutionPolicy Bypass -File deploy\publish.ps1 -PushMain

# 需要 token 时（CI 或无凭据环境）
powershell -ExecutionPolicy Bypass -File deploy\publish.ps1 -Token github_pat_xxx
```

脚本会构建到 `web/dist-pages`（base=`/njfu-quiz/`），同步到 `gh-pages` 分支，内容没变化则跳过推送。

## 安卓

```bash
cd web
npm run build
npx cap sync android
cd android
gradlew.bat assembleRelease
```

需要 JDK 21、Android SDK（platforms;android-34、build-tools;34.0.0）。签名信息在 `deploy/make-release.ps1` 与 `web/android/app/build.gradle`，正式分发前请换成自己的 keystore。

## 设计取舍

- 题目主键用 `科目:服务端id`，重新导入同一题库不丢进度。
- 答题只写 `progress` + `attempts` 两行，不做整库序列化。
- 判断题答案统一存 A/B，显示时映射为「正确 / 错误」，不依赖文案。
- 同题干多版本在练习中保留，组卷时只出一题；填空/简答不进模拟考试。
- 军事理论来自 5 章 docx，经 `junli` 预解析格式转换，题型含填空、选择、判断、简答。
- 数据全部在 IndexedDB，换设备靠导出 / 导入 JSON。

## 已知限制

- 成绩页数据在内存，刷新回首页（作答记录已落库）。
- 搜索按科目逐个进行，不做全库联合搜索。
- 模拟考试固定 60/10/10 组卷，题量不足的科目按实际题量出卷（人工智能无多选）。
- 没有账号与云同步。

## 许可

MIT，见 LICENSE。题库内容版权归原出处，本项目仅用于学习。
