"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { useProjectStore } from "@/store/project";
import { useThemeStore, applyTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, User, Sun, Moon, Monitor } from "lucide-react";
import { useRouter } from "next/navigation";

const THEME_CYCLE = ["light", "dark", "system"] as const;

export function Header() {
  const { user, logout } = useAuthStore();
  const { projects, currentProject, setCurrentProject } = useProjectStore();
  const router = useRouter();
  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const cycleTheme = () => {
    const currentIndex = THEME_CYCLE.indexOf(theme);
    const nextTheme = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length];
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div className="flex items-center gap-4">
        <Select
          value={currentProject?.id || ""}
          onValueChange={(value) => {
            const project = projects.find((p) => p.id === value);
            if (project) setCurrentProject(project);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="选择项目" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={cycleTheme}
          title={`当前主题: ${theme === "light" ? "浅色" : theme === "dark" ? "深色" : "跟随系统"}`}
        >
          <ThemeIcon className="h-4 w-4" />
        </Button>
        <button
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          onClick={() => router.push("/profile")}
          title="个人资料"
        >
          <User className="h-4 w-4" />
          <span>{user?.name}</span>
        </button>
        <Button variant="ghost" size="icon" onClick={handleLogout} title="退出登录">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
