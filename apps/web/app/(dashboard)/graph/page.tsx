"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useProjectStore } from "@/store/project";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Network, CircleDot, GitFork, Database, RefreshCw, Loader2 } from "lucide-react";

// ============================================================
// Types
// ============================================================

interface GraphNode {
  id: string;
  name: string;
  type: string;
  properties?: Record<string, any>;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  weight?: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphStats {
  node_count: number;
  edge_count: number;
  backend: string;
}

// 力导向布局中使用的内部节点
interface SimNode {
  id: string;
  name: string;
  type: string;
  properties?: Record<string, any>;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  connections: number;
  pinned: boolean;
}

interface SimEdge {
  source: SimNode;
  target: SimNode;
  relation: string;
  weight: number;
}

// ============================================================
// Constants
// ============================================================

const NODE_COLORS: Record<string, string> = {
  Memory: "#6366f1",
  User: "#10b981",
  Agent: "#f59e0b",
};

const DEFAULT_NODE_COLOR = "#8b5cf6";

const MIN_RADIUS = 8;
const MAX_RADIUS = 28;

// 力导向参数
const REPULSION = 5000;
const ATTRACTION = 0.005;
const SPRING_LENGTH = 120;
const DAMPING = 0.85;
const CENTER_GRAVITY = 0.01;
const SIMULATION_STEPS_PER_FRAME = 3;

// ============================================================
// Page Component
// ============================================================

export default function GraphPage() {
  const { currentProject } = useProjectStore();

  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Canvas ref 和绘图状态
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);

  // 仿真数据 ref（不触发 rerender）
  const simNodesRef = useRef<SimNode[]>([]);
  const simEdgesRef = useRef<SimEdge[]>([]);

  // 交互状态
  const dragNodeRef = useRef<SimNode | null>(null);
  const hoverNodeRef = useRef<SimNode | null>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(1);
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });
  const frameCountRef = useRef<number>(0);
  const hasFittedRef = useRef<boolean>(false);

  // ============================================================
  // Canvas CSS 尺寸辅助
  // ============================================================

  const getCanvasSize = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      return { w: rect.width, h: rect.height };
    }
    return { w: 800, h: 600 };
  }, []);

  // ============================================================
  // 自动适配视图
  // ============================================================

  const fitToView = useCallback(() => {
    const nodes = simNodesRef.current;
    if (nodes.length === 0) return;

    const { w, h } = getCanvasSize();

    // 计算所有节点的包围盒
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x - node.radius);
      minY = Math.min(minY, node.y - node.radius);
      maxX = Math.max(maxX, node.x + node.radius);
      maxY = Math.max(maxY, node.y + node.radius);
    }

    const graphW = maxX - minX;
    const graphH = maxY - minY;
    if (graphW < 1 || graphH < 1) return;

    const padding = 60;
    const scaleX = (w - padding * 2) / graphW;
    const scaleY = (h - padding * 2) / graphH;
    const zoom = Math.min(scaleX, scaleY, 2); // 最大不超过 2x

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    zoomRef.current = zoom;
    panRef.current = {
      x: w / 2 - centerX * zoom,
      y: h / 2 - centerY * zoom,
    };
  }, [getCanvasSize]);

  // ============================================================
  // 数据加载
  // ============================================================

  const fetchData = useCallback(async () => {
    if (!currentProject) return;

    setLoading(true);
    setError(null);

    const token = localStorage.getItem("access_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const [graphRes, statsRes] = await Promise.allSettled([
        fetch(`/api/v1/graph?project_id=${currentProject.id}`, { headers }),
        fetch(`/api/v1/graph/stats?project_id=${currentProject.id}`, { headers }),
      ]);

      if (graphRes.status === "fulfilled" && graphRes.value.ok) {
        const data: GraphData = await graphRes.value.json();
        setGraphData(data);
      } else {
        const errMsg =
          graphRes.status === "rejected"
            ? graphRes.reason?.message
            : `HTTP ${(graphRes as PromiseFulfilledResult<Response>).value.status}`;
        setError(`图谱数据加载失败: ${errMsg}`);
      }

      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        const data: GraphStats = await statsRes.value.json();
        setStats(data);
      }
    } catch (err: any) {
      setError(err.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================================
  // 初始化仿真节点
  // ============================================================

  useEffect(() => {
    if (!graphData) return;

    const { nodes, edges } = graphData;

    // 计算每个节点的连接数
    const connectionCount: Record<string, number> = {};
    nodes.forEach((n) => (connectionCount[n.id] = 0));
    edges.forEach((e) => {
      connectionCount[e.source] = (connectionCount[e.source] || 0) + 1;
      connectionCount[e.target] = (connectionCount[e.target] || 0) + 1;
    });

    const maxConn = Math.max(1, ...Object.values(connectionCount));

    // 创建仿真节点，随机初始位置（使用 CSS 像素）
    const { w: canvasW, h: canvasH } = getCanvasSize();
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const spread = Math.min(cx, cy) * 0.6;

    const simNodes: SimNode[] = nodes.map((n) => {
      const conn = connectionCount[n.id] || 0;
      const normalizedConn = conn / maxConn;
      const radius = MIN_RADIUS + normalizedConn * (MAX_RADIUS - MIN_RADIUS);

      return {
        id: n.id,
        name: n.name,
        type: n.type,
        properties: n.properties,
        x: cx + (Math.random() - 0.5) * spread,
        y: cy + (Math.random() - 0.5) * spread,
        vx: 0,
        vy: 0,
        radius,
        connections: conn,
        pinned: false,
      };
    });

    const nodeMap = new Map<string, SimNode>();
    simNodes.forEach((n) => nodeMap.set(n.id, n));

    const simEdges: SimEdge[] = edges
      .map((e) => {
        const source = nodeMap.get(e.source);
        const target = nodeMap.get(e.target);
        if (!source || !target) return null;
        return {
          source,
          target,
          relation: e.relation,
          weight: e.weight ?? 1,
        };
      })
      .filter(Boolean) as SimEdge[];

    simNodesRef.current = simNodes;
    simEdgesRef.current = simEdges;

    // 重置视角和自动适配标志
    panRef.current = { x: 0, y: 0 };
    zoomRef.current = 1;
    frameCountRef.current = 0;
    hasFittedRef.current = false;
  }, [graphData, getCanvasSize]);

  // ============================================================
  // 力导向布局算法
  // ============================================================

  const simulate = useCallback(() => {
    const nodes = simNodesRef.current;
    const edges = simEdgesRef.current;
    if (nodes.length === 0) return;

    const { w, h } = getCanvasSize();
    const cx = w / 2;
    const cy = h / 2;

    for (let step = 0; step < SIMULATION_STEPS_PER_FRAME; step++) {
      // 斥力（节点间库伦力）
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 1) {
            dx = (Math.random() - 0.5) * 2;
            dy = (Math.random() - 0.5) * 2;
            dist = Math.sqrt(dx * dx + dy * dy);
          }

          const force = REPULSION / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (!a.pinned) {
            a.vx -= fx;
            a.vy -= fy;
          }
          if (!b.pinned) {
            b.vx += fx;
            b.vy += fy;
          }
        }
      }

      // 引力（弹簧力）
      for (const edge of edges) {
        const { source, target, weight } = edge;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) continue;

        const displacement = dist - SPRING_LENGTH;
        const force = ATTRACTION * displacement * weight;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (!source.pinned) {
          source.vx += fx;
          source.vy += fy;
        }
        if (!target.pinned) {
          target.vx -= fx;
          target.vy -= fy;
        }
      }

      // 中心引力
      for (const node of nodes) {
        if (node.pinned) continue;
        node.vx += (cx - node.x) * CENTER_GRAVITY;
        node.vy += (cy - node.y) * CENTER_GRAVITY;
      }

      // 更新位置
      for (const node of nodes) {
        if (node.pinned) continue;
        node.vx *= DAMPING;
        node.vy *= DAMPING;

        // 限速
        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (speed > 10) {
          node.vx = (node.vx / speed) * 10;
          node.vy = (node.vy / speed) * 10;
        }

        node.x += node.vx;
        node.y += node.vy;
      }
    }
  }, [getCanvasSize]);

  // ============================================================
  // Canvas 渲染
  // ============================================================

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nodes = simNodesRef.current;
    const edges = simEdgesRef.current;
    const pan = panRef.current;
    const zoom = zoomRef.current;
    const hoverNode = hoverNodeRef.current;

    const { w, h } = getCanvasSize();

    // 清空
    ctx.clearRect(0, 0, w, h);

    // 背景
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, w, h);

    // 网格背景
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const gridSize = 40;
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1 / zoom;

    const startX = Math.floor((-pan.x / zoom - w) / gridSize) * gridSize;
    const endX = Math.ceil((-pan.x / zoom + 2 * w) / gridSize) * gridSize;
    const startY = Math.floor((-pan.y / zoom - h) / gridSize) * gridSize;
    const endY = Math.ceil((-pan.y / zoom + 2 * h) / gridSize) * gridSize;

    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }

    // 绘制边
    for (const edge of edges) {
      const { source, target, relation } = edge;
      const isHovered =
        hoverNode && (source.id === hoverNode.id || target.id === hoverNode.id);

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = isHovered
        ? "rgba(255,255,255,0.5)"
        : "rgba(255,255,255,0.12)";
      ctx.lineWidth = (isHovered ? 2 : 1) / zoom;
      ctx.stroke();

      // 边上的关系文本
      if (zoom > 0.5) {
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        const fontSize = Math.max(9, 11 / zoom);
        ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = isHovered
          ? "rgba(255,255,255,0.7)"
          : "rgba(255,255,255,0.25)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // 背景
        const textMetrics = ctx.measureText(relation);
        const padding = 3 / zoom;
        ctx.fillStyle = "rgba(9,9,11,0.7)";
        ctx.fillRect(
          midX - textMetrics.width / 2 - padding,
          midY - fontSize / 2 - padding,
          textMetrics.width + padding * 2,
          fontSize + padding * 2
        );

        ctx.fillStyle = isHovered
          ? "rgba(255,255,255,0.7)"
          : "rgba(255,255,255,0.3)";
        ctx.fillText(relation, midX, midY);
      }

      // 箭头
      const angle = Math.atan2(target.y - source.y, target.x - source.x);
      const arrowLen = 8 / zoom;
      const arrowX = target.x - Math.cos(angle) * target.radius;
      const arrowY = target.y - Math.sin(angle) * target.radius;

      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - arrowLen * Math.cos(angle - Math.PI / 7),
        arrowY - arrowLen * Math.sin(angle - Math.PI / 7)
      );
      ctx.lineTo(
        arrowX - arrowLen * Math.cos(angle + Math.PI / 7),
        arrowY - arrowLen * Math.sin(angle + Math.PI / 7)
      );
      ctx.closePath();
      ctx.fillStyle = isHovered
        ? "rgba(255,255,255,0.5)"
        : "rgba(255,255,255,0.15)";
      ctx.fill();
    }

    // 绘制节点
    for (const node of nodes) {
      const color = NODE_COLORS[node.type] || DEFAULT_NODE_COLOR;
      const isHovered = hoverNode?.id === node.id;

      // 光晕效果
      if (isHovered) {
        const gradient = ctx.createRadialGradient(
          node.x,
          node.y,
          node.radius,
          node.x,
          node.y,
          node.radius * 2.5
        );
        gradient.addColorStop(0, color + "40");
        gradient.addColorStop(1, color + "00");
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // 节点圆形
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

      // 渐变填充
      const gradient = ctx.createRadialGradient(
        node.x - node.radius * 0.3,
        node.y - node.radius * 0.3,
        0,
        node.x,
        node.y,
        node.radius
      );
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color + "b0");
      ctx.fillStyle = gradient;
      ctx.fill();

      // 边框
      ctx.strokeStyle = isHovered ? "#ffffff" : color + "80";
      ctx.lineWidth = (isHovered ? 2.5 : 1.5) / zoom;
      ctx.stroke();

      // 节点名称
      if (zoom > 0.4) {
        const fontSize = Math.max(10, Math.min(13, node.radius * 0.9)) / Math.max(zoom, 0.6);
        ctx.font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isHovered
          ? "rgba(255,255,255,0.95)"
          : "rgba(255,255,255,0.7)";

        const label = node.name.length > 16 ? node.name.slice(0, 14) + "..." : node.name;
        ctx.fillText(label, node.x, node.y + node.radius + 4 / zoom);
      }
    }

    ctx.restore();

    // Tooltip
    if (hoverNode) {
      const screenX = hoverNode.x * zoom + pan.x;
      const screenY = hoverNode.y * zoom + pan.y;
      const tooltipX = screenX + 15;
      const tooltipY = screenY - 15;

      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      const nameWidth = ctx.measureText(hoverNode.name).width;
      ctx.font = "12px system-ui, -apple-system, sans-serif";
      const typeText = `Type: ${hoverNode.type}`;
      const connText = `Connections: ${hoverNode.connections}`;
      const typeWidth = ctx.measureText(typeText).width;
      const connWidth = ctx.measureText(connText).width;
      const boxWidth = Math.max(nameWidth, typeWidth, connWidth) + 24;
      const boxHeight = 70;

      // 确保 tooltip 不超出 canvas
      const clampedX = Math.min(tooltipX, w - boxWidth - 10);
      const clampedY = Math.max(tooltipY, 10);

      // 背景
      ctx.fillStyle = "rgba(24,24,27,0.95)";
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      roundRect(ctx, clampedX, clampedY, boxWidth, boxHeight, 8);
      ctx.fill();
      ctx.stroke();

      // 文字
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(hoverNode.name, clampedX + 12, clampedY + 10);

      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "12px system-ui, -apple-system, sans-serif";
      ctx.fillText(typeText, clampedX + 12, clampedY + 30);
      ctx.fillText(connText, clampedX + 12, clampedY + 48);
    }

    // 左下角的缩放指示器
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`Zoom: ${(zoom * 100).toFixed(0)}%`, 12, h - 12);
  }, [getCanvasSize]);

  // ============================================================
  // 动画循环
  // ============================================================

  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0) return;

    const loop = () => {
      simulate();
      frameCountRef.current++;

      // 在仿真稳定后自动适配视图（第 60 帧）
      if (!hasFittedRef.current && frameCountRef.current === 60) {
        fitToView();
        hasFittedRef.current = true;
      }

      render();
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [graphData, simulate, render, fitToView]);

  // ============================================================
  // Canvas 尺寸管理
  // ============================================================

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      // 更新内部宽高用于渲染（使用 CSS 像素）
      (canvas as any).__cssWidth = rect.width;
      (canvas as any).__cssHeight = rect.height;
    };

    resizeCanvas();

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // ============================================================
  // Canvas 交互事件
  // ============================================================

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const pan = panRef.current;
    const zoom = zoomRef.current;
    return {
      x: (sx - pan.x) / zoom,
      y: (sy - pan.y) / zoom,
    };
  }, []);

  const findNodeAtPosition = useCallback((wx: number, wy: number): SimNode | null => {
    const nodes = simNodesRef.current;
    // 反向遍历以优先选择最上层的节点
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = wx - node.x;
      const dy = wy - node.y;
      if (dx * dx + dy * dy <= node.radius * node.radius) {
        return node;
      }
    }
    return null;
  }, []);

  const getCanvasMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getCanvasMousePos(e);
      const world = screenToWorld(pos.x, pos.y);
      const node = findNodeAtPosition(world.x, world.y);

      if (node) {
        dragNodeRef.current = node;
        node.pinned = true;
      } else {
        // 开始平移
        isPanningRef.current = true;
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          panX: panRef.current.x,
          panY: panRef.current.y,
        };
      }
    },
    [getCanvasMousePos, screenToWorld, findNodeAtPosition]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getCanvasMousePos(e);
      mouseRef.current = pos;

      if (dragNodeRef.current) {
        const world = screenToWorld(pos.x, pos.y);
        dragNodeRef.current.x = world.x;
        dragNodeRef.current.y = world.y;
        dragNodeRef.current.vx = 0;
        dragNodeRef.current.vy = 0;
        return;
      }

      if (isPanningRef.current) {
        panRef.current = {
          x: panStartRef.current.panX + (e.clientX - panStartRef.current.x),
          y: panStartRef.current.panY + (e.clientY - panStartRef.current.y),
        };
        return;
      }

      // Hover 检测
      const world = screenToWorld(pos.x, pos.y);
      const node = findNodeAtPosition(world.x, world.y);
      hoverNodeRef.current = node;

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = node ? "pointer" : "default";
      }
    },
    [getCanvasMousePos, screenToWorld, findNodeAtPosition]
  );

  const handleMouseUp = useCallback(() => {
    if (dragNodeRef.current) {
      dragNodeRef.current.pinned = false;
      dragNodeRef.current = null;
    }
    isPanningRef.current = false;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const pos = getCanvasMousePos(e as any);

      const zoomFactor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      const newZoom = Math.max(0.1, Math.min(5, zoomRef.current * zoomFactor));

      // 以鼠标位置为中心缩放
      const worldBefore = screenToWorld(pos.x, pos.y);
      zoomRef.current = newZoom;
      panRef.current = {
        x: pos.x - worldBefore.x * newZoom,
        y: pos.y - worldBefore.y * newZoom,
      };
    },
    [getCanvasMousePos, screenToWorld]
  );

  // ============================================================
  // 渲染
  // ============================================================

  if (!currentProject) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        请先选择一个项目
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">图谱可视化</h1>
          <p className="text-muted-foreground">实体关系图谱 - 力导向布局</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          刷新
        </button>
      </div>

      {/* 主布局: 左侧统计面板 + 右侧 Canvas */}
      <div className="flex gap-4" style={{ height: "calc(100vh - 180px)" }}>
        {/* 左侧统计面板 */}
        <div className="w-72 shrink-0 space-y-4 overflow-y-auto">
          {/* 统计卡片 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Network className="h-4 w-4" />
                图谱统计
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : stats ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-500/10">
                      <CircleDot className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.node_count}</p>
                      <p className="text-xs text-muted-foreground">节点数</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10">
                      <GitFork className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.edge_count}</p>
                      <p className="text-xs text-muted-foreground">边数</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-500/10">
                      <Database className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{stats.backend}</p>
                      <p className="text-xs text-muted-foreground">后端类型</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">统计数据不可用</p>
              )}
            </CardContent>
          </Card>

          {/* 图例 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">节点类型</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(NODE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm">{type}</span>
                  {graphData && (
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      {graphData.nodes.filter((n) => n.type === type).length}
                    </Badge>
                  )}
                </div>
              ))}
              {graphData && (
                <>
                  {(() => {
                    const otherTypes = graphData.nodes.filter(
                      (n) => !NODE_COLORS[n.type]
                    );
                    if (otherTypes.length === 0) return null;

                    const uniqueTypes = [...new Set(otherTypes.map((n) => n.type))];
                    return uniqueTypes.map((type) => (
                      <div key={type} className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: DEFAULT_NODE_COLOR }}
                        />
                        <span className="text-sm">{type}</span>
                        <Badge variant="secondary" className="ml-auto text-[10px]">
                          {graphData.nodes.filter((n) => n.type === type).length}
                        </Badge>
                      </div>
                    ));
                  })()}
                </>
              )}
            </CardContent>
          </Card>

          {/* 操作提示 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">操作说明</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>拖拽节点 - 移动节点位置</li>
                <li>拖拽空白区域 - 平移画布</li>
                <li>鼠标滚轮 - 缩放视图</li>
                <li>悬停节点 - 查看详情</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* 右侧 Canvas */}
        <Card className="flex-1 overflow-hidden">
          <div ref={containerRef} className="relative h-full w-full">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">加载图谱数据...</p>
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
                <div className="flex flex-col items-center gap-3 text-center">
                  <Network className="h-12 w-12 text-muted-foreground opacity-40" />
                  <p className="text-sm text-destructive">{error}</p>
                  <p className="text-xs text-muted-foreground">
                    请确认图存储 (Neo4j) 已启用并配置正确
                  </p>
                  <button
                    onClick={fetchData}
                    className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <RefreshCw className="h-3 w-3" />
                    重试
                  </button>
                </div>
              </div>
            )}

            {!loading && !error && graphData && graphData.nodes.length === 0 && (
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-center">
                  <Network className="h-12 w-12 text-muted-foreground opacity-40" />
                  <p className="text-sm text-muted-foreground">暂无图谱数据</p>
                  <p className="text-xs text-muted-foreground">
                    添加记忆后，关系图谱将自动生成
                  </p>
                </div>
              </div>
            )}

            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              className="h-full w-full"
              style={{ display: "block" }}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
