# 网页版发布

三种方式，按你能接受的门槛选一个。

## 一、GitHub Pages（推荐，免费且长期有效）

1. 在 GitHub 网页新建一个空仓库，名字例如 `njfu-quiz`，不要勾选 README。
2. 在电脑上跑：

```powershell
$env:GITHUB_PAT_TOKEN = "你的 token"
powershell -ExecutionPolicy Bypass -File D:\APKnixiang\work\njfu-quiz\deploy\deploy-github-pages.ps1 -Owner 你的用户名 -Repo njfu-quiz
```

3. 等一分钟，访问 `https://<用户名>.github.io/njfu-quiz/`

脚本做的事：用 `/njfu-quiz/` 作为 base 重新构建 → 推到 `gh-pages` 分支 → 调 API 开启 Pages。

注意：GitHub Pages 仓库必须是 public（免费账号），所以这个网址是公开可访问的，只是没在任何地方被链接，且页面带了 `noindex`，搜索引擎不会收录。谁拿到网址谁就能用。

## 二、Netlify Drop（不用命令行，拖拽即可）

1. 打开 https://app.netlify.com/drop
2. 把 `D:\APKnixiang\work\njfu-quiz\deploy\dist.zip` 拖进去
3. 得到 `https://xxxx.netlify.app`，可改子域名

这个包用的是根路径 base，拖拽上去正好。

## 三、临时分享（电脑开着才有效）

```powershell
cd D:\APKnixiang\work\njfu-quiz\tools
.\cloudflared.exe tunnel --url http://127.0.0.1:4173 --protocol http2
```

或

```powershell
ssh -R 80:localhost:4173 nokey@localhost.run
```

拿到 https 网址就能发给别人，关掉进程网址失效。https 下 Service Worker 正常，手机可「添加到主屏幕」离线用。

## 关于内容可见性

网页版里打包了 9013 道题。发布到公开托管后，任何拿到网址的人都能看到题目和答案，也能从浏览器缓存里导出。如果只想让同学用、不想公开，两个办法：

1. 用方案三的临时隧道，用完就关；
2. 发「无题库版」：把 `public/data/` 清空后构建，别人打开只有空壳，需要自己导入题库 JSON（这个版本还没做导入 UI，要做的话说一声）。

## 更新题库后重新发布

```powershell
cd D:\APKnixiang\work\njfu-quiz
PYTHONUTF8=1 python data\scripts\build_data.py     # 重新生成 public/data
cd web
npm run build                                      # 本地验证
# 然后重跑 deploy-github-pages.ps1 或重新拖 dist.zip
```
