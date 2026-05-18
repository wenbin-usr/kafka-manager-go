# 一键：编译前端 -> 编译后端 -> 启动服务
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

& (Join-Path $PSScriptRoot "build-frontend.ps1")

Push-Location $Root
try {
    go build -o kafka-manager-go.exe .
    Write-Host "Starting http://localhost:18855 ..."
    & ".\kafka-manager-go.exe"
} finally {
    Pop-Location
}
