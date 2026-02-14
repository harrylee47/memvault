import { create } from "zustand";
import { api } from "@/lib/api-client";

interface Project {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

interface ProjectState {
  organizations: Organization[];
  projects: Project[];
  currentProject: Project | null;
  currentOrg: Organization | null;
  isLoading: boolean;
  loadOrgsAndProjects: () => Promise<void>;
  setCurrentProject: (project: Project) => void;
  setCurrentOrg: (org: Organization) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  organizations: [],
  projects: [],
  currentProject: null,
  currentOrg: null,
  isLoading: true,

  loadOrgsAndProjects: async () => {
    try {
      const orgs = await api.getOrganizations();
      set({ organizations: orgs });

      if (orgs.length > 0) {
        const savedOrgId = localStorage.getItem("current_org_id");
        const org = orgs.find((o: Organization) => o.id === savedOrgId) || orgs[0];
        set({ currentOrg: org });

        const projects = await api.getProjects(org.id);
        set({ projects });

        if (projects.length > 0) {
          const savedProjectId = localStorage.getItem("current_project_id");
          const project = projects.find((p: Project) => p.id === savedProjectId) || projects[0];
          set({ currentProject: project });
          localStorage.setItem("current_project_id", project.id);
        }
        localStorage.setItem("current_org_id", org.id);
      }
    } catch (err) {
      console.error("Failed to load orgs/projects:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  setCurrentProject: (project: Project) => {
    localStorage.setItem("current_project_id", project.id);
    set({ currentProject: project });
  },

  setCurrentOrg: async (org: Organization) => {
    localStorage.setItem("current_org_id", org.id);
    set({ currentOrg: org, isLoading: true });
    const projects = await api.getProjects(org.id);
    set({ projects, isLoading: false });
    if (projects.length > 0) {
      get().setCurrentProject(projects[0]);
    }
  },
}));
