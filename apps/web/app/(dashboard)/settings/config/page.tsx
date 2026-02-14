"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/project";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { Save } from "lucide-react";

const LLM_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "o3-mini"],
  anthropic: ["claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001", "claude-opus-4-6"],
  gemini: ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"],
  together: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "meta-llama/Llama-3.1-8B-Instruct-Turbo", "mistralai/Mixtral-8x7B-Instruct-v0.1", "Qwen/Qwen2.5-72B-Instruct-Turbo"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"],
  ollama: ["llama3.2", "llama3.1", "mistral", "phi3", "qwen2.5", "gemma2"],
};

const EMBEDDER_MODELS: Record<string, string[]> = {
  openai: ["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"],
  gemini: ["text-embedding-004", "embedding-001"],
  huggingface: ["sentence-transformers/all-MiniLM-L6-v2", "BAAI/bge-large-en-v1.5", "BAAI/bge-m3"],
  ollama: ["nomic-embed-text", "mxbai-embed-large", "all-minilm"],
};

const DEFAULT_API_BASE: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  together: "https://api.together.xyz/v1",
  groq: "https://api.groq.com/openai/v1",
  ollama: "http://localhost:11434",
  huggingface: "https://api-inference.huggingface.co",
};

const CUSTOM_VALUE = "__custom__";

export default function ConfigPage() {
  const { currentProject } = useProjectStore();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // LLM Form state
  const [llmProvider, setLlmProvider] = useState("openai");
  const [llmModel, setLlmModel] = useState("gpt-4o-mini");
  const [llmModelCustom, setLlmModelCustom] = useState(false);
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmApiBaseUrl, setLlmApiBaseUrl] = useState("");
  const [llmTemperature, setLlmTemperature] = useState(0.7);

  // Embedder Form state
  const [embedderProvider, setEmbedderProvider] = useState("openai");
  const [embedderModel, setEmbedderModel] = useState("text-embedding-3-small");
  const [embedderModelCustom, setEmbedderModelCustom] = useState(false);
  const [embedderApiBaseUrl, setEmbedderApiBaseUrl] = useState("");

  // Advanced
  const [customInstructions, setCustomInstructions] = useState("");
  const [maxMemories, setMaxMemories] = useState(10000);

  useEffect(() => {
    if (!currentProject) return;
    setLoading(true);
    api
      .getConfig(currentProject.id)
      .then((data) => {
        setConfig(data);
        if (data.llm) {
          const provider = data.llm.provider || "openai";
          const model = data.llm.model || "gpt-4o-mini";
          setLlmProvider(provider);
          setLlmModel(model);
          const presetModels = LLM_MODELS[provider] || [];
          setLlmModelCustom(!presetModels.includes(model));
          setLlmTemperature(data.llm.temperature ?? 0.7);
          setLlmApiBaseUrl(data.llm.api_base_url || "");
        }
        if (data.embedder) {
          const provider = data.embedder.provider || "openai";
          const model = data.embedder.model || "text-embedding-3-small";
          setEmbedderProvider(provider);
          setEmbedderModel(model);
          const presetModels = EMBEDDER_MODELS[provider] || [];
          setEmbedderModelCustom(!presetModels.includes(model));
          setEmbedderApiBaseUrl(data.embedder.api_base_url || "");
        }
        setCustomInstructions(data.custom_instructions || "");
        setMaxMemories(data.max_memories || 10000);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentProject]);

  const handleLlmProviderChange = (provider: string) => {
    setLlmProvider(provider);
    const models = LLM_MODELS[provider] || [];
    if (models.length > 0) {
      setLlmModel(models[0]);
      setLlmModelCustom(false);
    } else {
      setLlmModel("");
      setLlmModelCustom(true);
    }
    setLlmApiBaseUrl("");
  };

  const handleEmbedderProviderChange = (provider: string) => {
    setEmbedderProvider(provider);
    const models = EMBEDDER_MODELS[provider] || [];
    if (models.length > 0) {
      setEmbedderModel(models[0]);
      setEmbedderModelCustom(false);
    } else {
      setEmbedderModel("");
      setEmbedderModelCustom(true);
    }
    setEmbedderApiBaseUrl("");
  };

  const handleLlmModelSelect = (value: string) => {
    if (value === CUSTOM_VALUE) {
      setLlmModelCustom(true);
      setLlmModel("");
    } else {
      setLlmModelCustom(false);
      setLlmModel(value);
    }
  };

  const handleEmbedderModelSelect = (value: string) => {
    if (value === CUSTOM_VALUE) {
      setEmbedderModelCustom(true);
      setEmbedderModel("");
    } else {
      setEmbedderModelCustom(false);
      setEmbedderModel(value);
    }
  };

  const handleSave = async () => {
    if (!currentProject) return;
    setSaving(true);
    try {
      await api.updateConfig(currentProject.id, {
        llm: {
          provider: llmProvider,
          model: llmModel,
          api_key: llmApiKey || undefined,
          api_base_url: llmApiBaseUrl || undefined,
          temperature: llmTemperature,
        },
        embedder: {
          provider: embedderProvider,
          model: embedderModel,
          api_base_url: embedderApiBaseUrl || undefined,
        },
        custom_instructions: customInstructions || undefined,
        max_memories: maxMemories,
      });
      toast({ title: "配置已保存" });
    } catch (err: any) {
      toast({ title: "保存失败", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!currentProject) {
    return <div className="text-muted-foreground">请先选择一个项目</div>;
  }

  if (loading) {
    return <div className="text-muted-foreground">加载中...</div>;
  }

  const llmModels = LLM_MODELS[llmProvider] || [];
  const embedderModels = EMBEDDER_MODELS[embedderProvider] || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">配置中心</h1>
          <p className="text-muted-foreground">管理项目的 mem0 配置</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "保存中..." : "保存配置"}
        </Button>
      </div>

      {/* LLM 配置 */}
      <Card>
        <CardHeader>
          <CardTitle>LLM 配置</CardTitle>
          <CardDescription>配置记忆提取和处理使用的语言模型</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={llmProvider} onValueChange={handleLlmProviderChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="together">Together AI</SelectItem>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="ollama">Ollama</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              {llmModelCustom ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="输入自定义模型名称"
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (llmModels.length > 0) {
                        setLlmModelCustom(false);
                        setLlmModel(llmModels[0]);
                      }
                    }}
                    disabled={llmModels.length === 0}
                  >
                    预设列表
                  </Button>
                </div>
              ) : (
                <Select value={llmModel} onValueChange={handleLlmModelSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {llmModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_VALUE}>自定义...</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>API Key (可选覆盖)</Label>
              <Input
                type="password"
                placeholder="使用环境变量默认值"
                value={llmApiKey}
                onChange={(e) => setLlmApiKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>API Base URL (可选覆盖)</Label>
              <Input
                placeholder={DEFAULT_API_BASE[llmProvider] || "使用官方默认地址"}
                value={llmApiBaseUrl}
                onChange={(e) => setLlmApiBaseUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                留空使用官方默认地址，可自定义为代理或兼容 API 地址
              </p>
            </div>
            <div className="space-y-2">
              <Label>Temperature</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={llmTemperature}
                onChange={(e) => setLlmTemperature(parseFloat(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                推荐值 0.7，较低值输出更确定，较高值输出更多样
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Embedder 配置 */}
      <Card>
        <CardHeader>
          <CardTitle>嵌入模型配置</CardTitle>
          <CardDescription>配置向量嵌入使用的模型</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={embedderProvider} onValueChange={handleEmbedderProviderChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="huggingface">HuggingFace</SelectItem>
                  <SelectItem value="ollama">Ollama</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              {embedderModelCustom ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="输入自定义模型名称"
                    value={embedderModel}
                    onChange={(e) => setEmbedderModel(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (embedderModels.length > 0) {
                        setEmbedderModelCustom(false);
                        setEmbedderModel(embedderModels[0]);
                      }
                    }}
                    disabled={embedderModels.length === 0}
                  >
                    预设列表
                  </Button>
                </div>
              ) : (
                <Select value={embedderModel} onValueChange={handleEmbedderModelSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {embedderModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_VALUE}>自定义...</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="col-span-2 space-y-2">
              <Label>API Base URL (可选覆盖)</Label>
              <Input
                placeholder={DEFAULT_API_BASE[embedderProvider] || "使用官方默认地址"}
                value={embedderApiBaseUrl}
                onChange={(e) => setEmbedderApiBaseUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                留空使用官方默认地址
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 高级配置 */}
      <Card>
        <CardHeader>
          <CardTitle>高级配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>自定义记忆提取指令</Label>
            <Textarea
              placeholder="自定义 prompt，用于指导 LLM 如何从对话中提取记忆..."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>最大记忆数</Label>
            <Input
              type="number"
              value={maxMemories}
              onChange={(e) => setMaxMemories(parseInt(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
