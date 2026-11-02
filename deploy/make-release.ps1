# 打一个可安装的 APK：构建 web → 同步到安卓工程 → gradle 打包 → 复制到 release/
$ErrorActionPreference = "Stop"
$root = "D:\APKnixiang\work\njfu-quiz"
$env:JAVA_HOME = "D:\nixiang\jdk\jdk21"
$env:ANDROID_HOME = "D:\nixiang\bin\android"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

Push-Location "$root\web"
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "web 构建失败" }
npx cap sync android
Pop-Location

Push-Location "$root\web\android"
.\gradlew.bat assembleRelease --no-daemon
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "gradle 打包失败" }
Pop-Location

$apk = "$root\web\android\app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apk)) { throw "找不到 APK：$apk" }
New-Item -ItemType Directory -Force -Path "$root\release" | Out-Null
$dest = Join-Path $root "release\NJFU刷题-1.0.apk"
Copy-Item $apk $dest -Force
Write-Host "APK: $dest" -ForegroundColor Green
