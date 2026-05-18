#!/usr/bin/env bash
# 编译前端并将静态资源输出到 web/dist（后端 go:embed 与运行时静态服务目录）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/web"
npm install
npm run build
test -f "$ROOT/web/dist/index.html"
echo "Frontend built -> web/dist"
echo "Next: go run .   (or: go build -o kafka-manager-go .)"
