# 把网页版发布到 GitHub Pages
# 用法：
#   $env:GITHUB_PAT_TOKEN="ghp_xxx"
#   powershell -ExecutionPolicy Bypass -File deploy-github-pages.ps1 -Owner <你的用户名> -Repo njfu-quiz
param(
  [string]$Token = $env:GITHUB_PAT_TOKEN,
  [Parameter(Mandatory = $true)][string]$Owner,
  [string]$Repo = "njfu-quiz"
)
$ErrorActionPreference = "Stop"
if (-not $Token) { throw "缺少 token：设置 `$env:GITHUB_PAT_TOKEN 或传 -Token" }

$web = "D:\APKnixiang\work\njfu-quiz\web"
$api = "https://api.github.com/repos/$Owner/$Repo"
$headers = @{ Authorization = "Bearer $Token"; Accept = "application/vnd.github+json" }

# 1. 检查仓库存在（token 需要 repo 创建权限，没有就手工建一个空仓库）
try {
  Invoke-RestMethod -Uri $api -Headers $headers | Out-Null
  Write-Host "仓库存在：$Owner/$Repo"
} catch {
  throw "仓库 $Owner/$Repo 不存在或无权访问。请先在 GitHub 网页新建一个空仓库（不要勾选 README），再重跑本脚本。"
}

# 2. 用子路径构建（项目页地址是 /<repo>/）
Push-Location $web
$env:VITE_BASE = "/$Repo/"
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "构建失败" }
Pop-Location

# 3. 推送到 gh-pages
$tmp = Join-Path $env:TEMP ("njfu-pages-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmp | Out-Null
Copy-Item "$web\dist\*" $tmp -Recurse
New-Item -ItemType File -Path (Join-Path $tmp ".nojekyll") | Out-Null
Push-Location $tmp
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="deploy" -c user.email="deploy@local" commit -qm "deploy $(Get-Date -Format s)"
git push -q --force "https://x-access-token:$Token@github.com/$Owner/$Repo.git" gh-pages
Pop-Location
Remove-Item -Recurse -Force $tmp

# 4. 开启 Pages
try {
  $body = @{ source = @{ branch = "gh-pages"; path = "/" } } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$api/pages" -Headers $headers -Body $body | Out-Null
  Write-Host "已开启 Pages"
} catch {
  Write-Host "Pages 可能已开启，或需要手动在仓库 Settings → Pages 选 gh-pages 分支。"
}

Write-Host ""
Write-Host "地址：https://$Owner.github.io/$Repo/" -ForegroundColor Green
Write-Host "首次生效约需 1 分钟。"
