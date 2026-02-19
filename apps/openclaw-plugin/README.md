# @rigouu0407/openclaw-plugin

OpenClaw 插件 — 为 OpenClaw Agent 添加 [MemVault](https://github.com/rikouu/memvault) 持久化跨会话记忆能力。

v1.2.0 起，插件与 OpenClaw 原生 Markdown 记忆系统（`MEMORY.md` + daily log）**协同工作**，实现三层互补召回和双写捕获。

## 安装

```bash
npm install @rigouu0407/openclaw-plugin
```

## 配置

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
        "topK": 5,
        "localMemorySync": true
      }
    }
  ]
}
```

## 配置项

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
| `workspacePath` | string | 否 | OpenClaw 工作区路径（含 MEMORY.md 和 memory/ 目录） | `~/.openclaw/workspace` |
| `localMemorySync` | boolean | 否 | 捕获记忆时是否同步写入本地文件 | `true` |

## 工作原理：三层互补召回 + 双写捕获

### 自动召回 (Auto-Recall)

每次用户发送消息前，从三个来源合并上下文注入 Agent：

| 层 | 来源 | 擅长 |
|---|---|---|
| MemVault | 向量数据库 | 语义相似度匹配、跨会话积累 |
| MEMORY.md | 本地文件 | 人工策划的核心事实和决策 |
| Daily log | 本地文件 | 最近 1-2 天的活动上下文 |

### 自动捕获 (Auto-Capture)

Agent 回复后，双写：
1. 提取记忆存入 MemVault 向量数据库
2. 同步追加到本地 `MEMORY.md` 和今日 daily log

### 工具互补

Agent 同时拥有两套搜索能力，互不冲突：
- `memory_search` — OpenClaw 原生工具（BM25 搜索本地 md 文件）
- `memvault_search` — MemVault 插件（语义搜索向量数据库，跨设备跨 Agent）

## Agent 工具

所有 MemVault 工具使用 `memvault_` 前缀：

| 工具 | 说明 |
|------|------|
| `memvault_search` | 语义搜索 MemVault 向量数据库 |
| `memvault_store` | 显式存储一条记忆 |
| `memvault_list` | 列出所有记忆 |
| `memvault_get` | 获取单条记忆详情 |
| `memvault_forget` | 删除指定记忆 |

## CLI 命令

```bash
# 搜索记忆
openclaw memvault search "用户偏好"

# 查看统计（包含本地文件信息）
openclaw memvault stats

# 将本地 OpenClaw 记忆导入 MemVault（一次性迁移）
openclaw memvault sync
```

## 从 v1.1.x 升级

- **工具重命名**: `memory_*` → `memvault_*`。Agent 侧动态发现工具，无需手动修改
- **向后兼容**: 工作区目录不存在时，所有本地功能静默跳过，行为与 v1.1.x 一致
- 设置 `localMemorySync: false` 可关闭本地文件写入

## License

MIT
