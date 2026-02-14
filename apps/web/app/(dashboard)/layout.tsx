"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useProjectStore } from "@/store/project";
import { useThemeStore, applyTheme } from "@/lib/theme";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading, loadUser } = useAuthStore();
  const { loadOrgsAndProjects } = useProjectStore();
  const { theme } = useThemeStore();
  const router = useRouter();

  // 初始化主题
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadOrgsAndProjects();
    }
  }, [isAuthenticated, loadOrgsAndProjects]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center dark:bg-gray-900">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen dark:bg-gray-900">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6 dark:bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}
