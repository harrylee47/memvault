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

export default function ConfigPage() {
  const { currentProject } = useProjectStore();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [llmProvider, setLlmProvider] = useState("openai");
  const [llmModel, setLlmModel] = useState("gpt-4o-mini");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmTemperature, setLlmTemperature] = useState(0);
  const [embedderProvider, setEmbedderProvider] = useState("openai");
  const [embedderModel, setEmbedderModel] = useState("text-embedding-3-small");
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
          setLlmProvider(data.llm.provider || "openai");
          setLlmModel(data.llm.model || "gpt-4o-mini");
          setLlmTemperature(data.llm.temperature ?? 0);
        }
        if (data.embedder) {
          setEmbedderProvider(data.embedder.provider || "openai");
          setEmbedderModel(data.embedder.model || "text-embedding-3-small");
        }
        setCustomInstructions(data.custom_instructions || "");
        setMaxMemories(data.max_memories || 10000);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentProject]);

  const handleSave = async () => {
    if (!currentProject) return;
    setSaving(true);
    try {
      await api.updateConfig(currentProject.id, {
        llm: {
          provider: llmProvider,
          model: llmModel,
          api_key: llmApiKey || undefined,
          temperature: llmTemperature,
        },
        embedder: {
          provider: embedderProvider,
          model: embedderModel,
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
              <Select value={llmProvider} onValueChange={setLlmProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="together">Together AI</SelectItem>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="ollama">Ollama</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input value={llmModel} onChange={(e) => setLlmModel(e.target.value)} />
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
              <Label>Temperature</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={llmTemperature}
                onChange={(e) => setLlmTemperature(parseFloat(e.target.value))}
              />
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
              <Select value={embedderProvider} onValueChange={setEmbedderProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="huggingface">HuggingFace</SelectItem>
                  <SelectItem value="ollama">Ollama</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input value={embedderModel} onChange={(e) => setEmbedderModel(e.target.value)} />
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
