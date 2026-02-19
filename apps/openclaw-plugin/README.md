# @rigouu0407/openclaw-plugin

OpenClaw 插件 — 为 OpenClaw Agent 添加 [MemVault](https://github.com/rikouu/memvault) 持久化跨会话记忆能力。

插件**不修改** OpenClaw 原有的任何行为，纯粹做增量增强。

## 安装

```bash
npm install @rigouu0407/openclaw-plugin
```

## 配置

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
        "memoryMode": "enhance"
      }
    }
  ]
}
```

## 记忆模式

### `enhance`（默认）— MemVault + 本地记忆协同

```
召回: MemVault 语义搜索 + MEMORY.md 作为静态上下文始终注入
捕获: 会话 → MemVault（不写本地文件，OpenClaw 原生该怎么记还怎么记）
```

MEMORY.md 是 Agent 的"人设"（核心规则、偏好、项目信息），每次都注入；MemVault 是 Agent 的"记忆"（从对话中提取的事实），按语义相关度搜索。两者职责分明，不会重复。

Agent 同时拥有两套搜索工具：
- `memory_search` — OpenClaw 原生（BM25 搜索本地 md 文件）
- `memvault_search` — MemVault（语义搜索向量数据库，跨设备跨 Agent）

### `standalone` — 纯 MemVault

```
召回: 纯 MemVault 语义搜索
捕获: 会话 → MemVault
本地文件: 完全不碰
```

适合服务端部署、多设备同步、或不使用 OpenClaw 原生记忆系统的场景。

## 配置项

| 参数 | 类型 | 必需 | 说明 | 默认值 |
|------|------|------|------|--------|
| `apiBaseUrl` | string | 是 | MemVault API 地址 | — |
| `apiKey` | string | 是 | API Key | — |
| `projectId` | string | 是 | 项目 ID | — |
| `agentId` | string | 是 | Agent ID | — |
| `userId` | string | 否 | 默认用户 ID | `"default"` |
| `memoryMode` | string | 否 | `"enhance"` 或 `"standalone"` | `"enhance"` |
| `autoRecall` | boolean | 否 | 自动召回相关记忆 | `true` |
| `autoCapture` | boolean | 否 | 自动提取并存储记忆 | `true` |
| `captureWindowSize` | number | 否 | 每轮提取的对话消息数（建议 6，最小 2） | `6` |
| `topK` | number | 否 | 每轮最多召回记忆数 | `5` |
| `sourceApp` | string | 否 | 来源标识 | `"openclaw"` |
| `threshold` | number | 否 | 搜索相似度阈值 (0-1) | — |
| `workspacePath` | string | 否 | OpenClaw 工作区路径 | `~/.openclaw/workspace` |

## Agent 工具

所有 MemVault 工具使用 `memvault_` 前缀，与 OpenClaw 原生工具互不冲突：

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

# 查看统计
openclaw memvault stats

# 将本地 OpenClaw 记忆导入 MemVault（一次性迁移，两种模式都可用）
openclaw memvault sync
```

## 从 v1.2.x 升级

- `localMemorySync` 配置已移除，替换为 `memoryMode`
- 默认 `enhance` 模式不再写入本地文件（只读 MEMORY.md）
- 设置 `memoryMode: "standalone"` 等同于之前完全不使用本地文件

## License

MIT
