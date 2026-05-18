# Kafka Manager

一个基于 Web 的 Kafka 集群管理工具，提供 Topic、Consumer Group、消息浏览等常用运维操作的可视化界面。

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| 后端 | Go + [Gin](https://github.com/gin-gonic/gin) + [segmentio/kafka-go](https://github.com/segmentio/kafka-go) |
| 前端 | React 18 + TypeScript + [Vite](https://vitejs.dev/) + [Ant Design 5](https://ant.design/) |
| 路由 | react-router-dom v6 |
| HTTP 客户端 | axios |
| 部署 | `go:embed` 嵌入前端静态资源，单二进制部署 |

**选型理由：**
- `segmentio/kafka-go`：纯 Go 实现，无 CGO 依赖，Windows 上构建简单
- `gin`：成熟、高性能、中间件生态丰富
- `antd`：开箱即用的专业 UI 组件，适合数据密集型管理界面
- `go:embed`：生产环境单二进制部署，无需额外文件服务

## 项目结构

```
kafka-manager-go/
├── main.go                          # 入口：路由注册、静态文件服务、go:embed
├── go.mod / go.sum
├── Makefile
├── .gitignore
├── internal/
│   ├── handler/                     # HTTP 处理层（薄层，调用 service）
│   │   ├── cluster.go               #   集群 CRUD 处理器
│   │   ├── topic.go                 #   Topic 增删查处理器
│   │   ├── consumer.go              #   Consumer Group 处理器
│   │   └── message.go               #   消息浏览处理器
│   ├── service/                     # 业务逻辑层（Kafka 操作）
│   │   ├── cluster.go               #   集群管理 + JSON 文件持久化
│   │   ├── topic.go                 #   Topic 列表/详情/创建/删除
│   │   ├── consumer.go              #   Consumer Group 列表/详情/偏移量删除
│   │   └── message.go               #   消息读取 + JSON 自动识别
│   ├── model/
│   │   └── types.go                 # 请求/响应数据类型定义
│   └── middleware/
│       └── cors.go                  # CORS 中间件（开发模式）
└── web/                             # React 前端
    ├── package.json
    ├── vite.config.ts               # Vite 配置 + API 代理
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── App.tsx                  # 路由定义
        ├── main.tsx                 # 入口 + antd ConfigProvider
        ├── api/
        │   └── client.ts           # axios 封装 + 全部 API 调用函数
        ├── components/
        │   └── Layout.tsx          # 全局布局：侧边栏导航 + 集群选择器
        ├── pages/
        │   ├── Dashboard.tsx       # 集群概览仪表盘
        │   ├── Topics.tsx          # Topic 列表
        │   ├── TopicDetail.tsx     # Topic 分区详情
        │   ├── ConsumerGroups.tsx  # Consumer Group 列表
        │   ├── ConsumerGroupDetail.tsx  # Consumer Group 详情
        │   └── MessageViewer.tsx   # 消息浏览器
        └── types/
            └── index.ts            # TypeScript 类型定义（与后端模型对应）
```

## 架构设计

### 分层架构

```
┌─────────────────────────────────────────────┐
│             Frontend (React)                │
│   Pages ──→ API Client (axios) ──→ /api/*  │
└────────────────────┬────────────────────────┘
                     │ HTTP
┌────────────────────▼────────────────────────┐
│            Handler Layer (Gin)              │
│   解析请求参数 → 调用 Service → 返回 JSON   │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│           Service Layer (业务逻辑)           │
│   Cluster / Topic / Consumer / Message      │
│   调用 kafka-go 与 Kafka 集群交互           │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│            Kafka Cluster(s)                 │
└─────────────────────────────────────────────┘
```

- **Handler 层**：薄层，仅负责参数解析和响应封装，不含业务逻辑
- **Service 层**：核心业务逻辑，直接通过 `kafka-go` 与 Kafka 交互
- **Model 层**：纯数据类型定义，Handler 和 Service 共享
- **前端 API Client**：统一封装 axios 调用，自动解包 `ApiResponse` 包装

### 集群配置持久化

集群配置以 JSON 文件（`clusters.json`）形式存储在本地，无需数据库：
- 添加集群时验证连接可用性，生成 UUID 作为 ID
- 程序启动时自动加载，变更时自动保存

### 前端部署策略

- **开发模式**：Vite 开发服务器（:5173）+ Go 后端（:8080），通过 Vite 代理转发 API 请求
- **生产模式**：`go:embed` 将 `web/dist` 嵌入 Go 二进制，单文件部署，SPA 路由回退到 `index.html`

## API 接口

所有接口返回统一格式：`{ "success": bool, "data": ..., "error": "..." }`

### 集群管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/clusters` | 获取集群列表 |
| POST | `/api/clusters` | 添加集群（验证连接） |
| DELETE | `/api/clusters/:id` | 删除集群 |
| GET | `/api/clusters/:id/overview` | 集群概览（Broker/Topic/分区/消费者组数量） |

### Topic 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/clusters/:id/topics` | Topic 列表 |
| GET | `/api/clusters/:id/topics/:topic` | Topic 详情（分区偏移量/ISR/Leader） |
| POST | `/api/clusters/:id/topics` | 创建 Topic |
| DELETE | `/api/clusters/:id/topics/:topic` | 删除 Topic |

### Consumer Group 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/clusters/:id/consumer-groups` | Consumer Group 列表 |
| GET | `/api/clusters/:id/consumer-groups/:group` | Group 详情（成员/偏移量/Lag） |
| DELETE | `/api/clusters/:id/consumer-groups/:group` | 删除 Group 偏移量 |

### 消息浏览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/clusters/:id/topics/:topic/messages` | 查询消息 |

**消息查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `partition` | int | 指定分区（可选，默认全部分区） |
| `startOffset` | int64 | 起始偏移量（可选，默认从最新偏移量往前读） |
| `limit` | int | 最大条数（默认 20，上限 100） |
| `keyFilter` | string | 按消息 Key 过滤（大小写不敏感） |

## 功能页面

### Dashboard（仪表盘）
展示集群概览：Broker 数量、Topic 数量、分区数量、Consumer Group 数量。

### Topics（Topic 管理）
- Topic 列表：搜索、查看分区数和副本因子
- 创建 Topic：指定名称、分区数、副本因子
- 删除 Topic：二次确认
- 点击 Topic 名称进入详情页

### Topic Detail（Topic 详情）
- 分区表格：每个分区的 Leader、Replicas、ISR、首尾偏移量、消息数量
- 汇总：总消息数

### Consumer Groups（消费者组管理）
- 列表：Group ID、状态（Stable/Empty/Rebalancing 等）、成员数
- 删除偏移量：二次确认

### Consumer Group Detail（消费者组详情）
- 成员列表：Member ID、Client ID、Client Host、分配情况
- 偏移量 & Lag 表：每个 Topic-Partition 的 Committed Offset、Log End Offset、Lag（带颜色标记）

### Message Viewer（消息浏览器）
- 选择 Topic、指定分区/起始偏移量/条数/Key 过滤
- 消息表格：分区、偏移量、Key、Value（JSON 自动标记）、时间戳
- 展开行查看完整消息内容

## 快速开始

### 前提条件

- Go 1.21+
- Node.js 18+
- 运行中的 Kafka 集群

### 开发模式

```bash
# 启动前端开发服务器（端口 5173）
make dev-frontend

# 启动后端（端口 8080）
make dev-backend
```

浏览器访问 http://localhost:5173，点击"添加集群"，输入 Broker 地址（如 `localhost:9092`）即可开始使用。

### 生产构建

```bash
# 构建前端 + 后端，生成单二进制
make build

# 运行
make run
# 或
PORT=9090 ./kafka-manager-go
```

浏览器访问 http://localhost:8080（或指定的 PORT）。

### 清理

```bash
make clean
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8080` | 服务监听端口 |
