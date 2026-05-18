# 编译前端并将静态资源输出到 web/dist（后端 go:embed 与运行时静态服务目录）
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$WebDir = Join-Path $Root "web"
$DistDir = Join-Path $WebDir "dist"

Push-Location $WebDir
try {
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "npm not found. Install Node.js first."
    }
    npm install
    npm run build
} finally {
    Pop-Location
}

if (-not (Test-Path (Join-Path $DistDir "index.html"))) {
    throw "Build failed: web/dist/index.html not found"
}

Write-Host "Frontend built -> web/dist"
Write-Host "Next: go run .   (or: go build -o kafka-manager-go.exe .)"
