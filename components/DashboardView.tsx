"use client";

import React, { useMemo, useState } from "react";
import { Project } from "@/types";
import {
  Plus,
  Play,
  Trash2,
  RefreshCw,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileVideo,
  Search,
  ArrowDownUp,
  Sparkles,
  Activity,
} from "lucide-react";

interface DashboardViewProps {
  projects: Project[];
  loading: boolean;
  error?: string | null;
  onSelectProject: (projectId: string) => void;
  onNewUpload: () => void;
  onDeleteProject: (projectId: string) => void;
  onRefresh: () => void;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

function getStatusBadge(status: Project["status"]) {
  switch (status) {
    case "ready":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="h-3 w-3" />
          Ready
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-400 border border-red-500/30">
          <AlertCircle className="h-3 w-3" />
          Failed
        </span>
      );
    case "uploaded":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/30">
          Uploaded
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/30">
          <Loader2 className="h-3 w-3 animate-spin" />
          {status.replace("_", " ")}
        </span>
      );
  }
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  loading,
  error,
  onSelectProject,
  onNewUpload,
  onDeleteProject,
  onRefresh,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "name">("recent");

  const visibleProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects
      .filter((project) => {
        const matchesQuery = !query || `${project.name} ${project.originalFilename}`.toLowerCase().includes(query);
        const matchesStatus = statusFilter === "all" ||
          (statusFilter === "processing"
            ? !["ready", "error", "uploaded"].includes(project.status)
            : project.status === statusFilter);
        return matchesQuery && matchesStatus;
      })
      .sort((a, b) => sortBy === "name"
        ? a.name.localeCompare(b.name)
        : sortBy === "oldest"
          ? Date.parse(a.createdAt) - Date.parse(b.createdAt)
          : Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [projects, search, statusFilter, sortBy]);

  const generatedClips = projects.reduce((total, project) => total + (project.clipCount || 0), 0);
  const processedProjects = projects.filter((project) => project.status === "ready").length;
  const recentProject = projects.slice().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}" and all generated clips?`)) {
      setDeletingId(id);
      onDeleteProject(id);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Top Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-8 border-b border-white/10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Creator Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Manage your uploaded podcast recordings and repurposed viral clips.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
            title="Refresh projects list"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={onNewUpload}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-600/30 hover:bg-violet-500 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Upload Podcast</span>
          </button>
        </div>
      </div>

      <section aria-label="Workspace overview" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Projects", value: projects.length, icon: FileVideo },
          { label: "Clips generated", value: generatedClips, icon: Sparkles },
          { label: "Videos processed", value: processedProjects, icon: CheckCircle2 },
          { label: "Recent activity", value: recentProject ? formatDate(recentProject.updatedAt) : "—", icon: Activity },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-[#12161f] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
              <span>{label}</span><Icon aria-hidden="true" className="h-4 w-4 text-violet-400" />
            </div>
            <p className="mt-3 truncate text-xl font-semibold text-white sm:text-2xl">{value}</p>
          </div>
        ))}
      </section>

      {projects.length > 0 && (
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input aria-label="Search projects" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects or filenames" className="w-full rounded-xl border border-white/10 bg-[#12161f] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-gray-500" />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#12161f] px-3 text-gray-400">
            <Activity aria-hidden="true" className="h-4 w-4" />
            <select aria-label="Filter by processing status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="bg-transparent py-2.5 text-sm text-white focus:outline-none">
              <option value="all" className="bg-[#12161f]">All statuses</option>
              <option value="ready" className="bg-[#12161f]">Ready</option>
              <option value="processing" className="bg-[#12161f]">Processing</option>
              <option value="uploaded" className="bg-[#12161f]">Uploaded</option>
              <option value="error" className="bg-[#12161f]">Failed</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#12161f] px-3 text-gray-400">
            <ArrowDownUp aria-hidden="true" className="h-4 w-4" />
            <select aria-label="Sort projects" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="bg-transparent py-2.5 text-sm text-white focus:outline-none">
              <option value="recent" className="bg-[#12161f]">Newest first</option>
              <option value="oldest" className="bg-[#12161f]">Oldest first</option>
              <option value="name" className="bg-[#12161f]">Name A–Z</option>
            </select>
          </label>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-6 flex flex-col gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button onClick={onRefresh} className="shrink-0 rounded-lg border border-red-300/20 px-3 py-2 text-xs font-semibold hover:bg-red-500/10">Try again</button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && projects.length === 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-2xl border border-white/5 bg-white/[0.02]"
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && projects.length === 0 && (
        <div className="mt-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.02]">
            <FileVideo className="h-8 w-8 text-gray-500" />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-white">No projects yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-xs text-gray-400">
            Upload your first video podcast to automatically detect highlights and render 9:16 vertical clips.
          </p>
          <button
            onClick={onNewUpload}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-violet-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Upload First Episode</span>
          </button>
        </div>
      )}

      {/* Project Cards Grid */}
      {projects.length > 0 && visibleProjects.length === 0 && (
        <div className="mt-8 rounded-2xl border border-white/10 bg-[#12161f] p-10 text-center text-sm text-gray-400">No projects match those filters.</div>
      )}

      {visibleProjects.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visibleProjects.map((project) => (
            <div
              key={project.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#12161f] p-5 hover:border-violet-500/40 hover:bg-[#151a24] transition-all shadow-lg"
            >
              <div>
                <div className="relative mb-4 aspect-video overflow-hidden rounded-xl border border-white/10 bg-black/40">
                  <video
                    aria-label={`Preview of ${project.name}`}
                    src={`/api/media/uploads/${encodeURIComponent(project.originalPath.split(/[\\/]/).pop() || "")}`}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                    onLoadedData={(event) => { event.currentTarget.currentTime = 0.1; }}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                      const fallback = event.currentTarget.parentElement?.querySelector<HTMLElement>("[data-preview-fallback]");
                      if (fallback) fallback.hidden = false;
                    }}
                  />
                  <div data-preview-fallback hidden className="pointer-events-none absolute inset-0 flex items-center justify-center text-gray-600"><FileVideo className="h-8 w-8" /></div>
                </div>

                {/* Header status */}
                <div className="flex items-center justify-between">
                  {getStatusBadge(project.status)}
                  <span className="text-[11px] text-gray-500">
                  {(project.fileSize / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>

                {/* Title */}
                <h2 className="mt-4 text-base font-semibold text-white line-clamp-1 group-hover:text-violet-300 transition-colors">
                  {project.name}
                </h2>
                <p className="mt-1 text-xs text-gray-400 line-clamp-1 font-mono">
                  {project.originalFilename}
                </p>

                {/* Metadata */}
                <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/5 pt-4 text-xs text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-violet-400" />
                    <span>Duration: {formatDuration(project.duration)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-violet-400" />
                    <span>{formatDate(project.createdAt)}</span>
                  </div>
                </div>

                {/* Error message snippet if any */}
                {project.errorMessage && (
                  <div className="mt-3 rounded-lg bg-red-500/10 p-2 text-[11px] text-red-300 line-clamp-2 border border-red-500/20">
                    {project.errorMessage}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                <div className="text-xs text-gray-400">
                  <span className="font-semibold text-white">
                    {project.clipCount || 0}
                  </span>{" "}
                  clips
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelete(project.id, project.name)}
                    disabled={deletingId === project.id}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    title="Delete project"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => onSelectProject(project.id)}
                    className="flex items-center gap-1.5 rounded-xl bg-violet-600/20 px-3.5 py-1.5 text-xs font-semibold text-violet-300 hover:bg-violet-600 hover:text-white transition-all"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>
                      {project.status === "ready" ? "Open Studio" : "View Status"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
