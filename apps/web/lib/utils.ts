import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, "") // 去除中文字符
    .replace(/[^a-z0-9\s-]/g, "") // 去除特殊字符
    .trim()
    .replace(/\s+/g, "-") // 空格替换为连字符
    .replace(/-+/g, "-") // 多个连字符合并
    .replace(/^-|-$/g, ""); // 去除首尾连字符
}

export function validateSlug(slug: string): boolean {
  if (slug.length < 2 || slug.length > 50) return false;
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

export function validateAgentId(id: string): boolean {
  if (id.length < 1 || id.length > 64) return false;
  return /^[a-zA-Z0-9_-]+$/.test(id);
}
