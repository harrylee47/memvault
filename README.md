# MemVault

**自托管的 AI 记忆管理平台** — 为 AI Agent 提供持久化的跨会话记忆能力。

基于 [mem0](https://github.com/mem0ai/mem0) 构建，提供完整的多租户管理界面、RESTful API、MCP 协议支持和 OpenClaw 插件，让你的 AI Agent 真正"记住"每一位用户。

---

## 功能特性

- **记忆管理** — 自动提取、存储、搜索和管理 AI 对话中的关键信息
- **语义搜索** — 基于向量相似度的智能记忆检索，支持自定义相似度阈值
- **多租户架构** — 用户 → 组织 → 项目的层级隔离，支持 RBAC 权限控制
- **MCP 协议** — 原生支持 Model Context Protocol，可直接接入 Claude Desktop / Cursor
- **OpenClaw 插件** — 一键集成 OpenClaw Agent 框架，实现自动记忆提取与召回
- **图谱可视化** — 记忆关系图谱展示（可选 Neo4j 图存储）
- **Webhook 推送** — 记忆变更实时通知，支持自定义事件订阅
- **深度分析** — 记忆使用统计、趋势分析、Agent 活跃度追踪
- **订阅计划** — 内置 Free / Pro / Max 计划体系，支持兑换码激活

## 技术栈

| 层级 | 技术 |
|------|------|
| **后端 API** | Python 3.12 · FastAPI · SQLAlchemy (async) · Alembic |
| **AI 引擎** | mem0ai 1.0 · OpenAI (GPT-4o-mini / text-embedding-3-small) |
| **前端** | Next.js 14 · React 18 · Tailwind CSS · shadcn/ui · Zustand · Recharts |
| **数据库** | PostgreSQL 16 · Qdrant (向量存储) · Redis 7 (缓存/限流) |
| **可选** | Neo4j 5 (图存储) · GitHub/Google OAuth |
| **部署** | Docker Compose |

## 项目结构

```
memvault/
├── apps/
│   ├── api/                  # FastAPI 后端
│   │   ├── app/
│   │   │   ├── models/       # SQLAlchemy 数据模型
│   │   │   ├── routers/      # API 路由
│   │   │   ├── services/     # 业务逻辑
│   │   │   ├── middleware/    # 认证/限流中间件
│   │   │   ├── mcp/          # MCP 协议服务器
│   │   │   └── config.py     # 配置
│   │   ├── alembic/          # 数据库迁移
│   │   ├── main.py           # 应用入口
│   │   └── Dockerfile
│   ├── web/                  # Next.js 前端
│   │   ├── app/              # App Router 页面
│   │   ├── components/       # UI 组件
│   │   ├── lib/              # API Client / 工具库
│   │   └── Dockerfile
│   └── openclaw-plugin/      # OpenClaw 插件
├── infra/                    # 基础设施配置
├── docker-compose.yml
├── Makefile
└── .env.example
```

---

## 快速开始

### 前置要求

- [Docker](https://docs.docker.com/get-docker/) 和 [Docker Compose](https://docs.docker.com/compose/install/)
- OpenAI API Key（用于 LLM 记忆提取和向量嵌入）

### 1. 克隆项目

```bash
git clone https://github.com/rikouu/memvault.git
cd memvault
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，**必须修改**以下配置：

```ini
# 安全密钥（请替换为随机字符串）
SECRET_KEY=your-random-secret-key
NEXTAUTH_SECRET=your-random-nextauth-secret

# OpenAI API Key（必需）
OPENAI_API_KEY=sk-your-openai-api-key
```

### 3. 启动服务

```bash
# 一键初始化（构建镜像 + 启动服务 + 运行迁移）
make init

# 或手动分步执行
make build
make up
make migrate
```

### 4. 访问服务

| 服务 | 地址 |
|------|------|
| **Web 控制台** | http://localhost:3001 |
| **API 服务** | http://localhost:8765 |
| **API 文档 (Swagger)** | http://localhost:8765/docs |
| **产品文档** | http://localhost:3001/docs |

### 5. 默认管理员账号

首次启动时会自动创建管理员账号：

```
邮箱: admin@memvault.com
密码: a123456
```

> **重要**: 登录后请立即修改默认密码。

---

## 环境变量

完整配置参考 `.env.example`：

### 基础配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `APP_ENV` | 运行环境 | `development` |
| `SECRET_KEY` | JWT 签名密钥 | `change-me-to-a-random-secret-key` |

### 数据库

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `POSTGRES_HOST` | PostgreSQL 主机 | `postgres` |
| `POSTGRES_PORT` | PostgreSQL 端口 | `5432` |
| `POSTGRES_DB` | 数据库名 | `memvault` |
| `POSTGRES_USER` | 数据库用户 | `memvault` |
| `POSTGRES_PASSWORD` | 数据库密码 | `memvault_secret` |
| `POSTGRES_PORT_HOST` | 宿主机映射端口 | `5434` |
| `REDIS_URL` | Redis 连接地址 | `redis://redis:6379/0` |
| `REDIS_PORT_HOST` | Redis 宿主机端口 | `6381` |
| `QDRANT_HOST` | Qdrant 主机 | `qdrant` |
| `QDRANT_PORT` | Qdrant 端口 | `6333` |
| `QDRANT_PORT_HOST` | Qdrant 宿主机端口 | `6335` |

### AI 模型

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENAI_API_KEY` | OpenAI API Key | — |
| `LLM_PROVIDER` | LLM 提供商 | `openai` |
| `LLM_MODEL` | LLM 模型 | `gpt-4o-mini` |
| `EMBEDDER_PROVIDER` | 嵌入模型提供商 | `openai` |
| `EMBEDDER_MODEL` | 嵌入模型 | `text-embedding-3-small` |

### 前端

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NEXT_PUBLIC_API_URL` | 前端访问 API 的地址 | `http://localhost:8765` |
| `NEXTAUTH_URL` | NextAuth 回调地址 | `http://localhost:3001` |
| `NEXTAUTH_SECRET` | NextAuth 签名密钥 | — |
| `WEB_PORT` | Web 宿主机端口 | `3001` |

### OAuth（可选）

| 变量 | 说明 |
|------|------|
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Secret |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Secret |
| `OAUTH_REDIRECT_BASE` | OAuth 回调基础 URL |

### Neo4j 图存储（可选）

启用前需在 `docker-compose.yml` 中取消 `neo4j` 服务的注释。

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NEO4J_URL` | Neo4j Bolt 连接地址 | — |
| `NEO4J_USER` | Neo4j 用户名 | `neo4j` |
| `NEO4J_PASSWORD` | Neo4j 密码 | `password` |

---

## API 使用

### 认证

所有 API 请求需携带 API Key（在 Web 控制台的项目设置中生成）：

```bash
# Header 方式
curl -H "Authorization: Bearer mv_your_api_key" http://localhost:8765/api/v1/memories

# Query 参数方式
curl "http://localhost:8765/api/v1/memories?api_key=mv_your_api_key&project_id=your_project_id"
```

### 添加记忆

```bash
curl -X POST http://localhost:8765/api/v1/memories \
  -H "Authorization: Bearer mv_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "我喜欢用 Python 写后端，用 TypeScript 写前端"},
      {"role": "assistant", "content": "了解！Python 和 TypeScript 是很好的技术组合。"}
    ],
    "agent_id": "my-agent",
    "user_id": "user-001",
    "project_id": "your_project_id"
  }'
```

系统会自动从对话中提取关键事实并存储为记忆。

### 搜索记忆

```bash
curl -X POST http://localhost:8765/api/v1/memories/search \
  -H "Authorization: Bearer mv_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "用户偏好的编程语言",
    "agent_id": "my-agent",
    "user_id": "user-001",
    "limit": 5,
    "project_id": "your_project_id"
  }'
```

### 获取所有记忆

```bash
curl "http://localhost:8765/api/v1/memories?agent_id=my-agent&user_id=user-001&project_id=your_project_id" \
  -H "Authorization: Bearer mv_your_api_key"
```

### 删除记忆

```bash
curl -X DELETE "http://localhost:8765/api/v1/memories/{memory_id}?project_id=your_project_id" \
  -H "Authorization: Bearer mv_your_api_key"
```

完整 API 文档请访问: http://localhost:8765/docs

---

## MCP 接入

MemVault 原生支持 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)，可直接接入 Claude Desktop、Cursor 等支持 MCP 的客户端。

### MCP 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/mcp/{project_id}/sse` | GET | SSE 长连接，接收服务器推送 |
| `/mcp/{project_id}/messages` | POST | 发送 JSON-RPC 消息 |

### MCP 工具

| 工具 | 说明 |
|------|------|
| `add_memory` | 从对话消息中提取并存储记忆 |
| `search_memory` | 语义搜索相关记忆 |
| `get_memories` | 获取所有记忆列表 |
| `delete_memory` | 删除指定记忆 |

### Claude Desktop 配置

编辑 Claude Desktop 配置文件：

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "memvault": {
      "url": "http://localhost:8765/mcp/YOUR_PROJECT_ID/sse?api_key=mv_YOUR_API_KEY"
    }
  }
}
```

### Cursor 配置

在 Cursor 设置 → MCP Servers 中添加：

```json
{
  "memvault": {
    "url": "http://localhost:8765/mcp/YOUR_PROJECT_ID/sse?api_key=mv_YOUR_API_KEY"
  }
}
```

配置后重启客户端，AI 助手即可使用 `add_memory`、`search_memory` 等工具管理记忆。

---

## OpenClaw 插件

MemVault 提供 OpenClaw 插件 [`@rigouu0407/openclaw-plugin`](https://www.npmjs.com/package/@rigouu0407/openclaw-plugin)，为 OpenClaw Agent 框架添加持久化记忆能力。

### 安装

```bash
npm install @rigouu0407/openclaw-plugin
```

### 配置

在 OpenClaw Agent 配置中启用插件：

```json
{
  "plugins": [
    {
      "id": "memvault",
      "config": {
        "apiBaseUrl": "http://localhost:8765",
        "apiKey": "mv_your_api_key",
        "projectId": "your_project_id",
        "agentId": "your_agent_id",
        "userId": "default",
        "autoRecall": true,
        "autoCapture": true,
        "captureWindowSize": 6,
        "topK": 5
      }
    }
  ]
}
```

### 配置项

| 参数 | 类型 | 必需 | 说明 | 默认值 |
|------|------|------|------|--------|
| `apiBaseUrl` | string | 是 | MemVault API 地址 | — |
| `apiKey` | string | 是 | API Key | — |
| `projectId` | string | 是 | 项目 ID | — |
| `agentId` | string | 是 | Agent ID | — |
| `userId` | string | 否 | 默认用户 ID | `"default"` |
| `autoRecall` | boolean | 否 | 自动召回相关记忆 | `true` |
| `autoCapture` | boolean | 否 | 自动提取并存储记忆 | `true` |
| `captureWindowSize` | number | 否 | 每轮提取的对话消息数（建议 6，最小 2） | `6` |
| `topK` | number | 否 | 每轮最多召回记忆数 | `5` |
| `sourceApp` | string | 否 | 来源标识 | `"openclaw"` |
| `threshold` | number | 否 | 搜索相似度阈值 (0-1) | — |

### 工作原理

1. **自动召回 (Auto-Recall)**: 每次用户发送消息前，插件自动用最近一条用户消息作为查询，从 MemVault 检索相关记忆并注入到 Agent 上下文中
2. **自动提取 (Auto-Capture)**: Agent 回复后，插件将最近的对话消息（默认 6 条，即 3 轮对话）发送给 MemVault，由 LLM 自动提取关键事实存储为记忆
3. **手动工具**: Agent 还可主动调用 `memory_search`、`memory_store`、`memory_list`、`memory_get`、`memory_forget` 5 个工具

### CLI 命令

```bash
# 搜索记忆
openclaw memvault search "用户偏好"

# 查看统计
openclaw memvault stats
```

---

## 管理功能

### 注册开关

管理员可在 Admin 面板的「系统设置」中控制是否允许公开注册：

- 关闭后，注册页面将显示"注册已关闭"提示
- 登录页面将隐藏注册链接
- 管理员仍可在 Admin 面板中手动创建用户

### 用户管理

管理员可以：
- 查看所有用户列表
- 手动创建新用户（自动创建默认组织和项目）
- 编辑用户信息
- 删除用户

### 组织与权限

每个组织支持 4 种角色：

| 角色 | 权限 |
|------|------|
| **OWNER** | 完全控制权，管理成员和组织设置 |
| **ADMIN** | 管理项目和成员 |
| **MEMBER** | 使用项目功能 |
| **VIEWER** | 只读访问 |

---

## 开发指南

### 本地开发

后端和前端可以独立于 Docker 在本地运行（但仍需要 PostgreSQL、Qdrant、Redis 服务）：

```bash
# 启动基础设施服务
docker compose up -d postgres qdrant redis

# 后端开发
make dev-api

# 前端开发（另一个终端）
make dev-web
```

### 数据库迁移

```bash
# 运行所有待执行的迁移
make migrate

# 创建新迁移
make migrate-new MSG="add_new_table"
```

### Makefile 命令

| 命令 | 说明 |
|------|------|
| `make init` | 首次初始化（复制 .env + 构建 + 启动 + 迁移） |
| `make up` | 启动所有服务 |
| `make down` | 停止所有服务 |
| `make build` | 构建所有镜像 |
| `make rebuild` | 重新构建并启动 |
| `make logs` | 查看所有服务日志 |
| `make logs-api` | 查看 API 日志 |
| `make logs-web` | 查看 Web 日志 |
| `make restart` | 重启所有服务 |
| `make clean` | 清理所有数据（危险） |
| `make dev-api` | 本地启动 API 开发服务器 |
| `make dev-web` | 本地启动 Web 开发服务器 |
| `make migrate` | 运行数据库迁移 |
| `make migrate-new` | 创建新迁移 |
| `make test` | 运行后端测试 |
| `make test-web` | 运行前端测试 |

---

## Docker 服务

| 服务 | 镜像 | 宿主机端口 | 说明 |
|------|------|------------|------|
| **postgres** | postgres:16-alpine | 5434 | 关系型数据库 |
| **qdrant** | qdrant/qdrant:latest | 6335 (HTTP), 6336 (gRPC) | 向量数据库 |
| **redis** | redis:7-alpine | 6381 | 缓存与限流 |
| **api** | 自定义构建 | 8765 | FastAPI 后端 |
| **web** | 自定义构建 | 3001 | Next.js 前端 |
| **neo4j** *(可选)* | neo4j:5-community | 7474, 7687 | 图数据库 |

> 宿主机端口均已偏移，避免与本地服务冲突。可通过 `.env` 中的 `*_PORT_HOST` 变量自定义。

---

## 常见问题

### 如何更换 LLM 提供商？

在 `.env` 中修改以下变量，MemVault 支持 mem0 所有支持的 LLM 提供商：

```ini
LLM_PROVIDER=openai          # 或 anthropic, azure_openai 等
LLM_MODEL=gpt-4o-mini
EMBEDDER_PROVIDER=openai
EMBEDDER_MODEL=text-embedding-3-small
```

也可在 Web 控制台的项目设置中为每个项目单独配置 LLM 和 Embedder。

### 如何启用 Neo4j 图存储？

1. 在 `docker-compose.yml` 中取消 `neo4j` 服务的注释
2. 在 `.env` 中配置 Neo4j 连接信息
3. 重新启动: `make rebuild`

### 如何启用 OAuth 登录？

1. 创建 GitHub OAuth App 或 Google OAuth 凭证
2. 在 `.env` 中填入对应的 Client ID 和 Secret
3. 设置 `OAUTH_REDIRECT_BASE` 为你的前端地址
4. 重启服务: `make restart`

### 如何备份数据？

```bash
# 备份 PostgreSQL
docker compose exec postgres pg_dump -U memvault memvault > backup.sql

# 备份 Qdrant 快照
curl -X POST http://localhost:6335/collections/memvault/snapshots
```

### 端口被占用怎么办？

在 `.env` 中修改对应的宿主机端口映射：

```ini
POSTGRES_PORT_HOST=5434    # PostgreSQL
QDRANT_PORT_HOST=6335      # Qdrant
REDIS_PORT_HOST=6381       # Redis
API_PORT=8765              # API
WEB_PORT=3001              # Web
```
