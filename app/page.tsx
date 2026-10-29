"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { HealthModal } from "@/components/HealthModal";
import { LandingSection } from "@/components/LandingSection";
import { DashboardView } from "@/components/DashboardView";
import { UploadView } from "@/components/UploadView";
import { ProcessingView } from "@/components/ProcessingView";
import { ClipEditorView } from "@/components/ClipEditorView";
import { Project } from "@/types";

function PodcastApp() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlProjectId = searchParams.get("project");
  const urlView = searchParams.get("view") as
    | "landing"
    | "dashboard"
    | "upload"
    | "processing"
    | "editor"
    | null;

  const [currentView, setCurrentView] = useState<
    "landing" | "dashboard" | "upload" | "processing" | "editor"
  >(urlView || (urlProjectId ? "processing" : "landing"));

  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    urlProjectId
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [isGroqConfigured, setIsGroqConfigured] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);

  // Sync project status asynchronously if opened via URL without explicit view
  useEffect(() => {
    if (urlProjectId && !urlView) {
      let cancelled = false;
      fetch(`/api/projects/${urlProjectId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && data?.project) {
            if (data.project.status === "ready") {
              setCurrentView("editor");
            } else {
              setCurrentView("processing");
            }
          }
        })
        .catch(() => {});

      return () => {
        cancelled = true;
      };
    }
  }, [urlProjectId, urlView]);

  // Fetch health and config
  const refreshHealth = () => {
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ai) setIsGroqConfigured(Boolean(data.ai.groqConfigured));
      })
      .catch(() => {});
  };

  // Fetch projects list
  const fetchProjects = () => {
    setLoadingProjects(true);
    setProjectsError(null);
    fetch("/api/projects")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load projects from local storage.");
        return res.json();
      })
      .then((data) => {
        if (data?.projects) setProjects(data.projects);
      })
      .catch(() => setProjectsError("Could not load projects from local storage."))
      .finally(() => setLoadingProjects(false));
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.ai) {
          setIsGroqConfigured(Boolean(data.ai.groqConfigured));
        }
      })
      .catch(() => {});

    fetch("/api/projects")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load projects from local storage.");
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data?.projects) {
          setProjects(data.projects);
        }
      })
      .catch(() => { if (!cancelled) setProjectsError("Could not load projects from local storage."); });

    return () => {
      cancelled = true;
    };
  }, []);

  const navigateTo = (view: "landing" | "dashboard" | "upload") => {
    setCurrentView(view);
    if (view === "landing" || view === "dashboard" || view === "upload") {
      setActiveProjectId(null);
      router.push(`/?view=${view}`);
    }
    if (view === "dashboard") {
      fetchProjects();
    }
  };

  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    const p = projects.find((item) => item.id === projectId);
    if (p && p.status === "ready") {
      setCurrentView("editor");
      router.push(`/?project=${projectId}&view=editor`);
    } else {
      setCurrentView("processing");
      router.push(`/?project=${projectId}&view=processing`);
    }
  };

  const handleUploadSuccess = (project: Project) => {
    setProjects((prev) => [project, ...prev]);
    setActiveProjectId(project.id);
    setCurrentView("processing");
    router.push(`/?project=${project.id}&view=processing`);
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        if (activeProjectId === projectId) {
          navigateTo("dashboard");
        }
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0d12] text-white flex flex-col justify-between selection:bg-violet-500 selection:text-white">
      <div>
        {/* Navigation Bar */}
        <Navbar
          currentView={currentView}
          onNavigate={navigateTo}
          onOpenSettings={() => setIsHealthModalOpen(true)}
          isGroqConfigured={isGroqConfigured}
        />

        {/* View Router */}
        {currentView === "landing" && (
          <LandingSection
            onStartCreating={() => navigateTo("upload")}
            onOpenDashboard={() => navigateTo("dashboard")}
            projectCount={projects.length}
          />
        )}

        {currentView === "dashboard" && (
          <DashboardView
            projects={projects}
            loading={loadingProjects}
            error={projectsError}
            onSelectProject={handleSelectProject}
            onNewUpload={() => navigateTo("upload")}
            onDeleteProject={handleDeleteProject}
            onRefresh={fetchProjects}
          />
        )}

        {currentView === "upload" && (
          <UploadView
            onUploadSuccess={handleUploadSuccess}
            onCancel={() =>
              navigateTo(projects.length > 0 ? "dashboard" : "landing")
            }
          />
        )}

        {currentView === "processing" && activeProjectId && (
          <ProcessingView
            projectId={activeProjectId}
            onComplete={() => {
              setCurrentView("editor");
              router.push(`/?project=${activeProjectId}&view=editor`);
              fetchProjects();
            }}
            onOpenSettings={() => setIsHealthModalOpen(true)}
          />
        )}

        {currentView === "editor" && activeProjectId && (
          <ClipEditorView
            projectId={activeProjectId}
            onBackToDashboard={() => navigateTo("dashboard")}
          />
        )}
      </div>

      {/* Diagnostics / Settings Modal */}
      <HealthModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
        onRefreshHealth={refreshHealth}
      />

      {/* Universal Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-xs text-gray-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
          <p>ClipForge AI &middot; Automated Podcast-to-Clips Production Platform</p>
          <div className="flex items-center gap-4 text-gray-400">
            <button
              onClick={() => setIsHealthModalOpen(true)}
              className="hover:text-white transition-colors"
            >
              System Diagnostics
            </button>
            <span>&middot;</span>
            <button
              onClick={() => navigateTo("dashboard")}
              className="hover:text-white transition-colors"
            >
              Dashboard
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b0d12] flex items-center justify-center text-violet-400">
          Loading ClipForge AI...
        </div>
      }
    >
      <PodcastApp />
    </Suspense>
  );
}
