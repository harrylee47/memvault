const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface FetchOptions extends RequestInit {
  token?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  }

  private async request<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const { token, ...fetchOptions } = options;
    const accessToken = token || this.getToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((fetchOptions.headers as Record<string, string>) || {}),
    };

    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...fetchOptions,
      headers,
    });

    if (response.status === 401) {
      // Token 过期，清除本地存储
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  // =====================
  // Auth
  // =====================
  async register(email: string, name: string, password: string) {
    return this.request<{ access_token: string; refresh_token: string }>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, name, password }),
    });
  }

  async login(email: string, password: string) {
    return this.request<{ access_token: string; refresh_token: string }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async loginWithGithub(code: string) {
    return this.request<{ access_token: string; refresh_token: string }>(
      `/api/v1/auth/login/github?code=${encodeURIComponent(code)}`,
      { method: "POST" }
    );
  }

  async loginWithGoogle(code: string) {
    return this.request<{ access_token: string; refresh_token: string }>(
      `/api/v1/auth/login/google?code=${encodeURIComponent(code)}`,
      { method: "POST" }
    );
  }

  async getMe() {
    return this.request<any>("/api/v1/auth/me");
  }

  // =====================
  // Organizations
  // =====================
  async getOrganizations() {
    return this.request<any[]>("/api/v1/organizations");
  }

  async deleteOrganization(orgId: string) {
    return this.request<void>(`/api/v1/organizations/${orgId}`, {
      method: "DELETE",
    });
  }

  // =====================
  // Organization Members
  // =====================
  async getOrgMembers(orgId: string) {
    return this.request<any[]>(`/api/v1/organizations/${orgId}/members`);
  }

  async addOrgMember(orgId: string, data: { email: string; role?: string }) {
    return this.request<any>(`/api/v1/organizations/${orgId}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateMemberRole(orgId: string, memberId: string, role: string) {
    return this.request<any>(
      `/api/v1/organizations/${orgId}/members/${memberId}?role=${encodeURIComponent(role)}`,
      { method: "PUT" }
    );
  }

  async removeMember(orgId: string, memberId: string) {
    return this.request<void>(`/api/v1/organizations/${orgId}/members/${memberId}`, {
      method: "DELETE",
    });
  }

  // =====================
  // Projects
  // =====================
  async getProjects(orgId?: string) {
    const params = orgId ? `?org_id=${orgId}` : "";
    return this.request<any[]>(`/api/v1/projects${params}`);
  }

  async createProject(orgId: string, data: { name: string; slug: string; description?: string }) {
    return this.request<any>(`/api/v1/projects?org_id=${orgId}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // =====================
  // Memories
  // =====================
  async getMemories(projectId: string, params: Record<string, any> = {}) {
    const searchParams = new URLSearchParams({ project_id: projectId, ...params });
    return this.request<any>(`/api/v1/memories?${searchParams}`);
  }

  async addMemory(projectId: string, data: any) {
    return this.request<any>(`/api/v1/memories?project_id=${projectId}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getMemory(projectId: string, memoryId: string) {
    return this.request<any>(`/api/v1/memories/${memoryId}?project_id=${projectId}`);
  }

  async updateMemory(projectId: string, memoryId: string, content: string) {
    return this.request<any>(`/api/v1/memories/${memoryId}?project_id=${projectId}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  }

  async deleteMemory(projectId: string, memoryId: string) {
    return this.request<void>(`/api/v1/memories/${memoryId}?project_id=${projectId}`, {
      method: "DELETE",
    });
  }

  async searchMemories(projectId: string, data: any) {
    return this.request<any>(`/api/v1/memories/search?project_id=${projectId}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getMemoryHistory(projectId: string, memoryId: string) {
    return this.request<any>(`/api/v1/memories/${memoryId}/history?project_id=${projectId}`);
  }

  async resetMemories(projectId: string, userId?: string, agentId?: string) {
    const params = new URLSearchParams({ project_id: projectId });
    if (userId) params.set("user_id", userId);
    if (agentId) params.set("agent_id", agentId);
    return this.request<any>(`/api/v1/memories/actions/reset?${params}`, { method: "POST" });
  }

  // =====================
  // Memory Export / Import
  // =====================
  async exportMemories(
    projectId: string,
    data: { format?: string; user_id?: string; agent_id?: string }
  ) {
    return this.request<any>(`/api/v1/memories/export?project_id=${projectId}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async importMemories(
    projectId: string,
    data: { memories: any[]; user_id?: string }
  ) {
    return this.request<any>(`/api/v1/memories/import?project_id=${projectId}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // =====================
  // Config
  // =====================
  async getConfig(projectId: string) {
    return this.request<any>(`/api/v1/config?project_id=${projectId}`);
  }

  async updateConfig(projectId: string, data: any) {
    return this.request<any>(`/api/v1/config?project_id=${projectId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // =====================
  // API Keys
  // =====================
  async getApiKeys(projectId: string) {
    return this.request<any[]>(`/api/v1/api-keys?project_id=${projectId}`);
  }

  async createApiKey(projectId: string, data: { name: string; scopes?: string[]; expires_in_days?: number }) {
    return this.request<any>(`/api/v1/api-keys?project_id=${projectId}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteApiKey(keyId: string) {
    return this.request<void>(`/api/v1/api-keys/${keyId}`, { method: "DELETE" });
  }

  // =====================
  // Agents
  // =====================
  async getAgents(projectId: string) {
    return this.request<any[]>(`/api/v1/agents?project_id=${projectId}`);
  }

  async createAgent(projectId: string, data: any) {
    return this.request<any>(`/api/v1/agents?project_id=${projectId}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getAgent(agentId: string) {
    return this.request<any>(`/api/v1/agents/${agentId}`);
  }

  async updateAgent(agentId: string, projectId: string, data: any) {
    return this.request<any>(`/api/v1/agents/${agentId}?project_id=${projectId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteAgent(agentId: string, projectId: string) {
    return this.request<void>(`/api/v1/agents/${agentId}?project_id=${projectId}`, {
      method: "DELETE",
    });
  }

  async getAgentMemories(agentId: string, projectId: string, params: Record<string, any> = {}) {
    const searchParams = new URLSearchParams({ project_id: projectId, ...params });
    return this.request<any>(`/api/v1/agents/${agentId}/memories?${searchParams}`);
  }

  async getAgentStats(agentId: string, projectId: string) {
    return this.request<any>(`/api/v1/agents/${agentId}/stats?project_id=${projectId}`);
  }

  // =====================
  // Analytics
  // =====================
  async getAnalyticsOverview(projectId: string) {
    return this.request<any>(`/api/v1/analytics/overview?project_id=${projectId}`);
  }

  async getMemoryAnalytics(projectId: string, days?: number) {
    const params = new URLSearchParams({ project_id: projectId });
    if (days !== undefined) params.set("days", String(days));
    return this.request<any>(`/api/v1/analytics/memories?${params}`);
  }

  async getAgentAnalytics(projectId: string) {
    return this.request<any>(`/api/v1/analytics/agents?project_id=${projectId}`);
  }

  async getUsageAnalytics(projectId: string, days?: number) {
    const params = new URLSearchParams({ project_id: projectId });
    if (days !== undefined) params.set("days", String(days));
    return this.request<any>(`/api/v1/analytics/usage?${params}`);
  }

  async getCategoryAnalytics(projectId: string) {
    return this.request<any>(`/api/v1/analytics/categories?project_id=${projectId}`);
  }

  // =====================
  // Graph
  // =====================
  async getGraph(projectId: string) {
    return this.request<any>(`/api/v1/graph?project_id=${projectId}`);
  }

  async getGraphStats(projectId: string) {
    return this.request<any>(`/api/v1/graph/stats?project_id=${projectId}`);
  }

  // =====================
  // Webhooks
  // =====================
  async getWebhooks(projectId: string) {
    return this.request<any[]>(`/api/v1/webhooks?project_id=${projectId}`);
  }

  async createWebhook(projectId: string, data: { url: string; events?: string[] }) {
    return this.request<any>(`/api/v1/webhooks?project_id=${projectId}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateWebhook(webhookId: string, projectId: string, data: any) {
    return this.request<any>(`/api/v1/webhooks/${webhookId}?project_id=${projectId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async testWebhook(webhookId: string, projectId: string) {
    return this.request<any>(`/api/v1/webhooks/${webhookId}/test?project_id=${projectId}`, {
      method: "POST",
    });
  }

  async deleteWebhook(webhookId: string) {
    return this.request<void>(`/api/v1/webhooks/${webhookId}`, { method: "DELETE" });
  }

  // =====================
  // Audit Logs
  // =====================
  async getAuditLogs(projectId: string, params: Record<string, any> = {}) {
    const searchParams = new URLSearchParams({ project_id: projectId, ...params });
    return this.request<any>(`/api/v1/audit-logs?${searchParams}`);
  }
}

export const api = new ApiClient(API_BASE);
