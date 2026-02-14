"""RBAC 权限控制中间件"""
from enum import Enum
from functools import wraps
from fastapi import HTTPException, status
from app.models.organization import OrgRole


class Permission(str, Enum):
    # 记忆
    MEMORY_READ = "memory:read"
    MEMORY_WRITE = "memory:write"
    MEMORY_DELETE = "memory:delete"
    MEMORY_EXPORT = "memory:export"
    MEMORY_RESET = "memory:reset"
    # Agent
    AGENT_READ = "agent:read"
    AGENT_WRITE = "agent:write"
    # 配置
    CONFIG_READ = "config:read"
    CONFIG_WRITE = "config:write"
    # API Key
    API_KEY_READ = "api_key:read"
    API_KEY_WRITE = "api_key:write"
    # Webhook
    WEBHOOK_READ = "webhook:read"
    WEBHOOK_WRITE = "webhook:write"
    # 组织
    ORG_READ = "org:read"
    ORG_WRITE = "org:write"
    ORG_MANAGE_MEMBERS = "org:manage_members"
    # 项目
    PROJECT_READ = "project:read"
    PROJECT_WRITE = "project:write"
    PROJECT_DELETE = "project:delete"
    # 审计
    AUDIT_READ = "audit:read"


# 角色权限映射
ROLE_PERMISSIONS: dict[str, set[Permission]] = {
    OrgRole.OWNER: set(Permission),  # Owner 拥有所有权限
    OrgRole.ADMIN: {
        Permission.MEMORY_READ, Permission.MEMORY_WRITE, Permission.MEMORY_DELETE,
        Permission.MEMORY_EXPORT, Permission.MEMORY_RESET,
        Permission.AGENT_READ, Permission.AGENT_WRITE,
        Permission.CONFIG_READ, Permission.CONFIG_WRITE,
        Permission.API_KEY_READ, Permission.API_KEY_WRITE,
        Permission.WEBHOOK_READ, Permission.WEBHOOK_WRITE,
        Permission.ORG_READ, Permission.ORG_WRITE, Permission.ORG_MANAGE_MEMBERS,
        Permission.PROJECT_READ, Permission.PROJECT_WRITE,
        Permission.AUDIT_READ,
    },
    OrgRole.MEMBER: {
        Permission.MEMORY_READ, Permission.MEMORY_WRITE, Permission.MEMORY_DELETE,
        Permission.MEMORY_EXPORT,
        Permission.AGENT_READ, Permission.AGENT_WRITE,
        Permission.CONFIG_READ,
        Permission.API_KEY_READ, Permission.API_KEY_WRITE,
        Permission.WEBHOOK_READ,
        Permission.PROJECT_READ,
        Permission.AUDIT_READ,
    },
    OrgRole.VIEWER: {
        Permission.MEMORY_READ,
        Permission.AGENT_READ,
        Permission.CONFIG_READ,
        Permission.API_KEY_READ,
        Permission.WEBHOOK_READ,
        Permission.ORG_READ,
        Permission.PROJECT_READ,
    },
}


def has_permission(role: str, permission: Permission) -> bool:
    """检查角色是否拥有指定权限"""
    role_perms = ROLE_PERMISSIONS.get(role, set())
    return permission in role_perms


def check_api_key_scope(scopes: list[str], required_scope: str) -> bool:
    """检查 API Key 是否有所需 scope"""
    # scope 格式: "memories:read", "memories:write" 等
    # 支持通配符: "memories:*" 或 "*"
    if "*" in scopes:
        return True
    if required_scope in scopes:
        return True
    # 检查通配符
    parts = required_scope.split(":")
    if len(parts) == 2:
        wildcard = f"{parts[0]}:*"
        if wildcard in scopes:
            return True
    return False
