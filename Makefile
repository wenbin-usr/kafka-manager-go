.PHONY: dev-backend dev-frontend build-frontend embed-frontend build run run-backend clean

dev-backend:
	go run main.go

dev-frontend:
	cd web && npm run dev

# 编译前端，产物写入 web/dist（与 main.go go:embed 路径一致）
build-frontend:
	cd web && npm install && npm run build

embed-frontend: build-frontend

build: embed-frontend
	go build -o kafka-manager-go .

run: build
	./kafka-manager-go

# 先构建前端静态资源，再启动后端（可直接访问 http://localhost:8080）
run-backend: embed-frontend
	go run .

clean:
	rm -f kafka-manager-go
	rm -rf web/dist
