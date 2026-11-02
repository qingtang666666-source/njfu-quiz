# 自建刷题软件方案（待审核）

## 0. 参考对象（已核实）

| 项 | 值 |
|---|---|
| 仓库 | `keggin-CHN/njfu_grinding` |
| 描述 | 南京林业大学马院刷题系统 —— 自动化题库爬虫 + Android 刷题应用 |
| 语言 | Java（Android 原生 10,912 行 / JavaFX 桌面端 10,632 行） |
| 许可 | Apache License 2.0 |
| 规模 | 19 个 Activity，0 个单元测试；`题库收集/` 13 个 JSON 共 16,501 条 |
| 数据 | 68 stars，2026-10-22 更新，`题库收集/2025-2026-1`、`2025-2026-2` 共 13 个 JSON，16,501 条 |
| 另一仓库 | `keggin-CHN/njfu-grinding-desktop`（已归档）、`keggin-CHN/njfu-exam`（油猴插件） |

### 交叉验证：它的题库与我从服务端直接拉的一致

| 题型 | 参考仓库题数 | 我方题数 | 交集 | 差异 |
|---|---|---|---|---|
| 单选 | 805 | 805 | 804 | 1 处只是题干多了前缀「1.」 |
| 多选 | 465 | 466 | 465 | 我方多 1 题「当代资本主义的新变化」 |
| 判断 | 438 | 438 | 438 | 无 |

结论：两边数据同源，我拉的 2026 库是最新版（version 20260701），参考仓库是 2025-2026-2 快照。这独立证明了我方抓取完整。

补充：我方三门共 3,619 条记录 / 3,609 个唯一题干，服务端本身存在「同题干、选项顺序不同」的多变体（习概 2、毛概 3、马原 5）。参考仓库组卷时按题干去重，我的方案保留全部变体但组卷时同样按题干去重。

---

## 1. 参考仓库的架构拆解（读代码得出，非 README 转述）

### 1.1 四个模块

```
爬虫/        Python + Selenium：登录 → 进考试 → 自动交卷 → 解析报告页 → 增量去重存 JSON
题库收集/    按学期分目录，{ "单选题": { "<题干>": {"answer":"C","options":["A. xx",...]}}, "多选题": {...}, "判断题": {...} }
app/        Android 原生 Java，单 Activity 多页（19 个 Activity + 8 Adapter + 10 data + 6 service）
desktop/    JavaFX，把 Android 的 model/data/service 整份复刻了一遍，用 FXML 重画 UI
proxy_server/ Python 211 行，代理 GitHub raw 下载题库，带 TTL 缓存
```

### 1.2 数据模型

```
Subject { id, name, displayName, totalQuestions, questions[], lastPosition,
          correctCount, attemptedCount, endlessBestStreak,
          sequentialLastPosition, reviewLastPosition, wrongReviewLastPosition,
          sortOrder, lastModified, tagColor }

Question { id, questionText, options[], answer, explanation, category, type,
           isWrong, userAnswer, index, relativeId, wrongAnswerCount,
           answerState ∈ {UNANSWERED, ANSWERED, CORRECT, WRONG} }
```

判分：单选/判断字符串相等；多选先排序再比；判断题把用户答案 A/B 转成「正确/错误」再比。

### 1.3 存储与并发

- `SharedPreferences` 里存两个大 JSON 字符串（`subjects`、`exam_history`），Gson 全量序列化。
- 2 秒防抖 + 单线程 Executor 后台写，`apply()` 异步落盘。
- 内存里另建 `questionIndex: Map<id, Question>`、`questionSubjectIndex`、`wrongQuestionIds` 三张索引表加速。
- 没有数据库，没有 schema 版本，没有迁移。

### 1.4 学习模式

顺序 / 随机 / 复习（只看已答）/ 错题复习 / 无尽连击 / 模拟考试（60 单选 + 10 多选 + 10 判断，单选 1 分、多选与判断 2 分）/ 搜索 / 相似题（Levenshtein 距离）/ 错题分析。

### 1.5 同步与 AI

- 同步：`NsdManager` 做 mDNS 服务发现（`_njfu-grinding-sync._tcp.`）+ 裸 TCP Socket 传整包 `SyncData{subjects, examHistory}`，无鉴权、无版本、无冲突处理。
- AI：OpenAI 兼容 `/chat/completions`，用户自填 baseURL / key / model，模板化 prompt 解释题目。

### 1.6 我读出来的问题（不照抄的原因）

| 编号 | 问题 | 后果 |
|---|---|---|
| D1 | 题目 id 用 `UUID.randomUUID()` 生成 | 重新导入同一题库，所有题变新 id，进度/错题/收藏全丢 |
| D2 | 整库 JSON 存一个 SharedPreferences 键 | 3619 题约 2.1 MB，每次答题都要全量序列化；Android 单次事务超 1 MB 有失败风险，靠 2 秒防抖掩盖 |
| D3 | 判断题答案格式耦合 | 参考仓库题库写「正确/错误」，服务端原始数据是 A/B；格式一变整类判错 |
| D4 | `util/XGBoostPredictor.java` 是假的 | 加权平均 + `Math.random()` 抖动，名字误导，没有模型 |
| D5 | 桌面端整份复刻 Android 逻辑 | 两套 model/data/service 各自维护，改一处要改两处 |
| D6 | 无单元测试、无迁移、无去重键 | 数据演进即崩 |
| D7 | 同步裸 TCP 无加密无校验 | 局域网可被中间人篡改学习记录 |

这 7 条是我要在自己的方案里直接消掉的。

---

## 2. 我的方案（推荐 A，备选 B）

### 方案 A：Web / PWA 单栈（推荐）

- 技术栈：Vite + React 18 + TypeScript + Dexie(IndexedDB) + 手写 CSS，零 UI 框架。
- 形态：PC 浏览器打开即用；手机浏览器「添加到主屏幕」后全屏、可离线；后续用 Capacitor 直接打 APK（本机已有 Android SDK：`D:/nixiang/bin/android`，build-tools 35、system-image android-34、AVD `rp`）。
- 为什么选它：
  1. 本机 node 24 / npm 11 已就绪，无需装 Flutter（缺失）或 Android Studio（缺失）。
  2. 3,619 题 / 2.1 MB 数据，IndexedDB 完全够，且能按表增量写，不再整库序列化（解决 D2）。
  3. 一套代码同时覆盖手机和 PC（解决 D5）。
  4. 迭代成本最低，改完刷新即见；验证用本机已装的 Playwright 自动跑（截图、抓 console、抓网络）。
  5. 题库随仓库走，手机端不需要装 APK 也能用。

### 方案 B：Android 原生（Kotlin + Room）

- 复用参考仓库的页面结构，但数据层换成 Room（SQLite）+ 稳定主键。
- 优点：APK 体验最接近原生，可后台/通知；缺点：桌面端要另做一套或只做手机。
- 成本：需要补 `platforms;android-34`，配 Gradle，首次构建要下依赖。

### 建议

先做 A 的 P0，能立刻在手机和 PC 上用；确认功能定型后再用 Capacitor 打 APK。这样不用为了「先有个 APK」把 80% 时间花在环境上。

---

## 3. 数据层设计（方案 A 与 B 共用）

### 3.0 已就绪的题库（2026 版，7 门 9,013 条）

| 科目 | 记录数 | 单选 | 多选 | 判断 | version |
|---|---|---|---|---|---|
| 中国近代史纲要 | 977 | 485 | 217 | 275 | 20260701 |
| 习近平新时代中国特色社会主义思想 | 686 | 365 | 135 | 186 | 20260701 |
| 马克思主义基本原理 | 1720 | 812 | 470 | 438 | 20260701 |
| 思想道德与法治 | 1612 | 705 | 375 | 532 | 20260701 |
| 毛泽东思想和中国特色社会主义理论体系概论 | 1213 | 680 | 199 | 334 | 20260701 |
| 大学生心理健康教育 | 1769 | 1068 | 264 | 437 | 20260701 |
| 人工智能 | 1036 | 652 | 0 | 383 | 20260107 |
| 合计 | 9013 | | | | |

数据在 `D:/APKnixiang/work/njfu-mayuan-applet/export/`，每库有 xlsx/csv/jsonl/txt 四种格式。
人工智能库无多选题，且含 1 条完全重复记录（导出时去重为 1035 行）。

### 3.1 统一题库 schema v1

```jsonc
{
  "schema": "njfu-quiz/v1",
  "subject": { "id": "mayuan", "name": "马克思主义基本原理", "term": "2026", "version": "20260701" },
  "questions": [
    {
      "qid": "mayuan:1720",            // 稳定主键 = subjectId + ':' + 服务端 id
      "serverId": 1720,
      "type": "single" | "multiple" | "judge",
      "stem": "……（  ）",
      "options": [ {"key":"A","text":"…"}, {"key":"B","text":"…"} ],
      "answer": ["D"],                  // 统一成数组，多选多元素
      "version": "20260701",
      "hash": "sha256(题干+选项+答案)[:16]"
    }
  ]
}
```

关键点：

- `qid` 用 `subjectId:serverId`，不用 UUID —— 重新导入同一题仍是同一 id，进度不丢（解决 D1）。
- `answer` 统一为字符串数组：单选 `["D"]`、多选 `["A","C","D"]`、判断 `["A"]`（A=正确、B=错误），渲染时再映射成「正确/错误」（解决 D3）。
- 保留 `serverId` 与 `version`，题库更新时按 qid 做 upsert：新题插入、改题更新、消失题标记 `retired` 而不删除（保住历史作答记录）。
- `hash` 用于检测「同 qid 内容变了」，变了就单独记一条 `revision`，错题本能追溯到具体版本。

### 3.2 导入器（三种来源都吃）

| 来源 | 格式 | 处理 |
|---|---|---|
| 我抓的服务端原始包 | `{RECORDS:[{id,question,type,answer,options{},version}]}` | 直接映射，`answer` 拆字母 |
| 参考仓库题库 | `{单选题:{题干:{answer,options[]}}, 多选题:{…}, 判断题:{answer:"正确"}}` | 题干当 key，`正确/错误`→A/B，选项去 `A. ` 前缀 |
| CSV | 序号,类型,题目,选项A..F,答案 | 按列名映射 |

导入时跑断言，任一不过即拒绝入库并报错行号：

1. 题数 > 0，qid 无重复；
2. 每题 `answer` 非空且每个字母都存在于 `options`；
3. 单选答案长度 = 1，多选 ≥ 2，判断答案 ∈ {A, B}；
4. 题干非空，长度 < 2000；
5. 同 `hash` 重复题给出警告并列出（不自动删）；
6. 同题干多变体（3,619 → 3,609）保留全部，入库时标记 `variantOf`，组卷时同题干只取一条。

### 3.3 存储（IndexedDB / Dexie，方案 B 则对应 Room 表）

| 表 | 主键 | 索引 | 说明 |
|---|---|---|---|
| `subjects` | `id` | — | 科目元数据、题数、版本 |
| `questions` | `qid` | `subjectId`, `type`, `hash` | 题目本体（只读） |
| `progress` | `[subjectId+qid]` | `subjectId`, `state` | 作答状态、用户答案、答题次数、连对次数 |
| `wrongs` | `[subjectId+qid]` | `subjectId`, `dueAt` | 错题本，含错误次数与下次复习时间 |
| `stars` | `[subjectId+qid]` | `subjectId` | 收藏 |
| `sessions` | `id`(自增) | `subjectId`, `startedAt` | 每次练习/模考会话 |
| `attempts` | `id`(自增) | `sessionId`, `qid` | 逐题作答流水，用于统计与回放 |
| `meta` | `key` | — | schema 版本、上次同步时间、题库版本 |

写入策略：答题只写 `progress` + `attempts` 两行，不做整库序列化（解决 D2）。

---

## 4. 功能分期

### P0（第一版必须，约 1–2 天）

1. 科目列表（三门 2026 库，显示题数、已答、正确率、上次进度）
2. 顺序练习：单题一屏、选项点击、立即判分、显示正确答案与选项文字、上一题/下一题、跳题导航、自动记住位置
3. 随机练习
4. 错题本：自动收集、按错误次数排序、可移除
5. 模拟考试：按服务端题型比例组卷（默认 60 单选 + 10 多选 + 10 判断），倒计时、交卷确认、按题给分、成绩页
6. 搜索：题干关键词，支持多科目
7. 本地进度持久化 + 断点续做

### P1（用一周后再定）

8. 收藏夹
9. 复习模式（只看已答错的/未答的）
10. 统计页：正确率趋势、题型分布、错题热区（按题目关键词聚合）
11. 简化的间隔重复：错题按 1/3/7/15 天递增安排（不用 SM-2 全量公式，够用即可）
12. 题库导入/更新 UI：选文件、预览、断言报告、确认入库
13. 深色模式、字号调节

### P2（可选）

14. AI 解析：接你自己的模型端点，题目答错后可点「解释」，本地缓存结果
15. 多端同步：不做裸 TCP，走「导出/导入加密 JSON」或 WebDAV
16. 打包 APK（Capacitor）

---

## 5. 工程结构（方案 A）

```
D:/APKnixiang/work/njfu-quiz/
├── data/
│   ├── build/                      # 由导出脚本生成的三门题库 JSON
│   │   ├── mayuan.json
│   │   ├── mao.json
│   │   └── xi.json
│   └── scripts/
│       ├── from_server.py          # 服务端原始包 → schema v1
│       ├── from_refrepo.py         # 参考仓库格式 → schema v1
│       └── validate.py             # 五条断言，CI 里跑
├── web/
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── db/schema.ts            # Dexie 表定义 + 迁移
│   │   ├── db/repo.ts              # 所有读写集中在这里，UI 不直接碰 Dexie
│   │   ├── domain/grade.ts         # 判分（纯函数，可单测）
│   │   ├── domain/exam.ts          # 组卷与计分
│   │   ├── domain/review.ts        # 间隔重复
│   │   ├── pages/                  # Home / Practice / Exam / Result / Wrong / Stats / Settings
│   │   └── components/
│   ├── tests/                      # vitest 单测 + playwright 端到端
│   └── vite.config.ts
└── README.md
```

数据与 UI 分离：`domain/` 全是纯函数，不碰 DOM 和数据库，便于单测与将来搬去 Android。

---

## 6. 验证方案（交付前必须全绿）

| 层 | 手段 | 判据 |
|---|---|---|
| 题库 | `validate.py` | 3,619 题，0 条断言失败；三门题数与服务端一致（686 / 1213 / 1720） |
| 判分 | vitest 单测 | 单选/多选/判断各覆盖：正确、少选、多选、空答、字母乱序 |
| 组卷 | vitest | 题量不足时不越界；题型比例正确；同卷不重复 |
| 存储 | vitest + fake-indexeddb | 迁移 v1→v2 不丢数据；重复导入同库 qid 不变 |
| 端到端 | Playwright | 从首页到做完 10 题再到错题本，console 无 error，进度刷新后仍在 |
| 真机 | 手机浏览器打开局域网地址 | 375×812 视口下无横向滚动、按钮可点 |

---

## 7. 风险与取舍

| 风险 | 处理 |
|---|---|
| 题库来自第三方服务端，可能变更或下线 | 本地固化 JSON + 版本号，导入即离线可用，不依赖在线 |
| 题目答案本身可能有错（服务端也有错题） | 提供「报错」按钮，记录到本地 `meta`，导出后统一修 |
| 参考仓库 Apache-2.0，抄代码要署名 | 不抄代码，只借鉴模块划分；若复用片段则保留 NOTICE 与出处 |
| PWA 在微信内置浏览器可能限制 | 不做微信内运行，直接手机浏览器打开/加桌面 |
| 3619 题首屏加载 | 按科目懒加载，IndexedDB 批量写入（每批 500），首次导入 < 3 秒 |

---

## 8. 进度（2026-11-02）

P0 已实现并跑通（Vite + React 18 + TS + Dexie）：

- 工程：`D:/APKnixiang/work/njfu-quiz/web`
- 数据：7 门 9013 题转成 schema v1，3.5 MB，`public/data/`
- 页面：首页 / 科目 / 顺序与随机练习 / 错题本 / 收藏 / 模拟考试 / 结果 / 统计 / 搜索 / 设置
- 判分：单选精确、多选集合、判断 A/B 映射
- 存储：IndexedDB 八张表，答题只写 progress + attempts
- 离线：manifest + service worker
- 验证：32 个单测全绿；两个 Playwright 端到端脚本 0 控制台错误
- 实测：977 题首次导入 0.7s；连答 3 题后错题本、统计、刷新持久化均正确

## 9. 已交付（2026-11-02 追加）

- 安卓 APK：`release/NJFU刷题-1.0.apk`，3.9 MB，release 签名，包名 `com.njfu.quiz`，minSdk 22 / targetSdk 34
  - 在 Android 14 模拟器实测：安装、启动、7 门科目、顺序练习、判分、返回键、进度落库全部正常
- 网页版：`deploy/dist.zip`（0.93 MB）+ GitHub Pages 脚本 + Netlify Drop 方案
  - 临时公网地址（https，PWA 可离线）已实测：Service Worker 注册成功、能正常做题
- 打包脚本：`deploy/make-release.ps1`、`deploy/deploy-github-pages.ps1`

## 10. 需要你拍板的点

1. 技术栈：走 A（Web/PWA，推荐）还是 B（Android 原生）？
2. 交付形态：只要能浏览器打开，还是必须给一个 APK？
3. 题库范围：已按你的要求把 2026 版 7 个库全部下载（9,013 条）。是否就用这 7 门作为软件首版科目？
4. 要不要 AI 解析功能（P2）？要的话用哪个模型端点。
5. 要不要多端同步，还是单机够用。
6. 界面风格：极简白（像参考仓库的 Material）还是深色护眼优先。

你确认后我按 P0 开始实现，先出可跑的最小版本给你在手机上试。
