# 一键发布到 GitHub Pages
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File deploy\publish.ps1
#   powershell -ExecutionPolicy Bypass -File deploy\publish.ps1 -Token github_pat_xxx
#   powershell -ExecutionPolicy Bypass -File deploy\publish.ps1 -PushMain
#
# 做的事：
#   1. 用 /njfu-quiz/ 作为 base 构建到 web/dist-pages
#   2. 把产物同步到 gh-pages 分支并推送
#   3. 内容没变化就跳过推送
#
# -PushMain  同时把源码改动提交并推送到 main

param(
  [string]$Token = "",
  [switch]$SkipBuild,
  [switch]$PushMain,
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

$owner = "qingtang666666-source"
$repo = "njfu-quiz"
$site = "https://$owner.github.io/$repo/"
$root = Split-Path -Parent $PSScriptRoot
$web = Join-Path $root "web"
$pagesDir = Join-Path $web "dist-pages"
$remote = "https://github.com/$owner/$repo.git"
if (-not $Message) { $Message = "deploy: 更新站点 $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }

function Push-WithAuth([string]$ref) {
  if ($Token) {
    $url = "https://x-access-token:$Token@github.com/$owner/$repo.git"
    git push $url $ref
  } else {
    git push origin $ref
  }
  if ($LASTEXITCODE -ne 0) { throw "推送 $ref 失败：检查网络/代理，或传 -Token" }
}

# 1. 构建
if (-not $SkipBuild) {
  Write-Host "==> 构建（base=/njfu-quiz/）" -ForegroundColor Cyan
  Push-Location $web
  $env:VITE_BASE = "/$repo/"
  npx vite build --outDir dist-pages --emptyOutDir
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -ne 0) { throw "构建失败" }
}
if (-not (Test-Path (Join-Path $pagesDir "index.html"))) { throw "找不到构建产物：$pagesDir" }

Push-Location $root
try {
  # 2. 源码（可选）
  if ($PushMain) {
    Write-Host "==> 提交源码到 main" -ForegroundColor Cyan
    git add -A
    if (git status --porcelain) {
      git -c user.name="青棠" -c user.email="qingtang666666@gmail.com" commit -q -m $Message
      Push-WithAuth "main"
      Write-Host "    main 已推送"
    } else {
      Write-Host "    main 无改动"
    }
  }

  # 3. 确保 gh-pages 分支存在
  git worktree prune
  if (-not (git branch --list gh-pages)) {
    $empty = ('' | git mktree)
    $init = git commit-tree $empty -m "init gh-pages"
    git branch gh-pages $init | Out-Null
  }

  # 4. 在临时 worktree 里更新站点
  $wt = Join-Path $env:TEMP ("njfu-pages-" + [guid]::NewGuid().ToString("N"))
  git worktree add -q --force $wt gh-pages
  if ($LASTEXITCODE -ne 0) { throw "创建 worktree 失败" }

  Get-ChildItem -Force $wt | Where-Object { $_.Name -ne ".git" } | Remove-Item -Recurse -Force
  Copy-Item (Join-Path $pagesDir "*") $wt -Recurse -Force
  New-Item -ItemType File -Force -Path (Join-Path $wt ".nojekyll") | Out-Null

  Push-Location $wt
  git add -A
  if (git status --porcelain) {
    git -c user.name="青棠" -c user.email="qingtang666666@gmail.com" commit -q -m $Message
    Pop-Location
    Push-WithAuth "gh-pages"
    Write-Host "==> 已发布：$site" -ForegroundColor Green
  } else {
    Pop-Location
    Write-Host "==> 站点内容无变化，跳过推送"
  }
} finally {
  if ($wt -and (Test-Path $wt)) {
    git worktree remove $wt --force 2>$null
  }
  Pop-Location
}

Write-Host ""
Write-Host "线上地址：$site" -ForegroundColor Green
Write-Host "首次生效约 30-60 秒，之后刷新即可。"
