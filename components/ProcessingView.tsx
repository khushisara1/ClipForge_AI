"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCheck,
  FileAudio,
  BrainCircuit,
  Sparkles,
  Crop,
  Play,
  RotateCcw,
  Key,
} from "lucide-react";
import { JobStatus, Project } from "@/types";

interface ProcessingViewProps {
  projectId: string;
  onComplete: () => void;
  onOpenSettings: () => void;
}

const STAGES = [
  { id: "upload", label: "Preparing video", icon: FileCheck },
  { id: "validate", label: "Checking media and codecs", icon: FileCheck },
  { id: "audio", label: "Extracting speech audio", icon: FileAudio },
  { id: "transcribe", label: "Transcribing speech", icon: BrainCircuit },
  { id: "highlights", label: "Finding and validating highlights", icon: Sparkles },
  { id: "render", label: "Rendering clips and captions", icon: Crop },
  { id: "ready", label: "Preparing downloads", icon: Play },
];

export const ProcessingView: React.FC<ProcessingViewProps> = ({
  projectId,
  onComplete,
  onOpenSettings,
}) => {
  const [project, setProject] = useState<Project | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const pollStatus = () => {
      fetch(`/api/projects/${projectId}/status`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (isCancelled || !data) return;
          setNow(Date.now());
          setJob(data.job);
          if (data.errorMessage) {
            setError(data.errorMessage);
          } else if (data.status === "error") {
            setError(data.job?.error || "Processing failed");
          } else {
            setError(null);
          }

          if (data.status === "ready") {
            setTimeout(onComplete, 800);
          }
        })
        .catch((err) => console.error("Status polling error:", err));
    };

    pollStatus();
    const interval = setInterval(pollStatus, 1500);

    fetch(`/api/projects/${projectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isCancelled && data?.project) {
          setProject(data.project);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [projectId, onComplete]);

  const handleRetry = async () => {
    setRetrying(true);
    setError(null);
    try {
      const restartResponse = await fetch(`/api/projects/${projectId}/process`, { method: "POST" });
      const restartData = await restartResponse.json().catch(() => ({}));
      if (!restartResponse.ok) {
        if (restartResponse.status === 429) setJob((previous) => previous ? { ...previous, retryAfterAt: restartData.retryAfterAt } : previous);
        throw new Error(restartData.error || "Failed to restart processing.");
      }
      const res = await fetch(`/api/projects/${projectId}/status`);
      if (res.ok) {
        const data = await res.json();
        setJob(data.job);
      }
    } catch (restartError) {
      setError(restartError instanceof Error ? restartError.message : "Failed to restart processing.");
    } finally {
      setRetrying(false);
    }
  };

  // Determine active step index
  const getStepIndex = (stepId?: string) => {
    if (!stepId) return 0;
    if (stepId === "validating") return 1;
    if (stepId === "extracting_audio") return 2;
    if (stepId === "transcribing") return 3;
    if (stepId === "analyzing") return 4;
    if (stepId === "rendering") return 5;
    if (stepId === "ready") return 6;

    const idx = STAGES.findIndex((s) => s.id === stepId);
    return idx >= 0 ? idx : 0;
  };

  const currentStepIndex = getStepIndex(job?.step || project?.status);
  const isFailed = Boolean(error || project?.status === "error" || job?.step === "error");
  const rateLimited = job?.errorCategory === "rate_limit_exceeded" || error?.includes("AI Processing Temporarily Paused");
  const retryInSeconds = job?.retryAfterAt ? Math.max(0, Math.ceil((Date.parse(job.retryAfterAt) - now) / 1000)) : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="text-center pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Processing Podcast Episode
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          {project?.name || "Your media is undergoing automated AI analysis and clip rendering."}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#12161f] p-6 sm:p-8 shadow-2xl">
        <div className="space-y-2 border-b border-white/10 pb-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-violet-300">Current operation</p>
          <p className="text-sm font-semibold text-white">{job?.message || "Preparing the media pipeline…"}</p>
          {job?.details && <p className="text-xs text-gray-400">{job.details}</p>}
          <div className="h-1 w-full overflow-hidden rounded bg-white/10" aria-hidden="true">
            <div className={`h-full w-1/3 rounded bg-violet-500 ${!isFailed ? "animate-pulse" : "bg-red-500"}`} />
          </div>
        </div>

        {/* 7 Real Stages Stepper */}
        <div className="mt-8 space-y-4">
          {STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const isCompleted = idx < currentStepIndex && !isFailed;
            const isActive = idx === currentStepIndex && !isFailed;
            const isPending = idx > currentStepIndex && !isFailed;

            return (
              <div
                key={stage.id}
                className={`flex items-center justify-between rounded-xl border p-3.5 transition-all ${
                  isActive
                    ? "border-violet-500/60 bg-violet-600/10 shadow-md shadow-violet-500/10"
                    : isCompleted
                    ? "border-white/10 bg-white/[0.02]"
                    : "border-white/5 bg-transparent opacity-50"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      isActive
                        ? "bg-violet-600 text-white"
                        : isCompleted
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-white/5 text-gray-400"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-semibold text-white">
                      {stage.label}
                    </h3>
                    {isActive && (
                      <p className="text-[11px] text-violet-300 font-medium">
                        {job?.message || "In progress..."}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  {isCompleted && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  )}
                  {isActive && (
                    <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                  )}
                  {isPending && (
                    <span className="text-[11px] text-gray-500">Pending</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Error Notification & Recovery Actions */}
        {isFailed && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <h4 className="text-sm font-semibold text-red-300">
                  {rateLimited ? "AI Processing Temporarily Paused" : "Processing Interrupted"}
                </h4>
                <p className="text-xs text-red-200/90 leading-relaxed">
                  {rateLimited
                    ? "The AI service has reached its token rate limit. Your transcription and completed clips are preserved. You can retry this project when the service cooldown ends."
                    : (error || job?.error || "An error occurred during media processing.").split("\n")[0].slice(0, 240)}
                </p>

                {rateLimited && (
                  <details className="rounded-lg border border-red-500/20 bg-black/10 p-3 text-xs text-red-100/80">
                    <summary className="cursor-pointer font-medium">Technical details</summary>
                    <dl className="mt-2 grid grid-cols-2 gap-2">
                      <dt className="text-gray-400">Model</dt><dd>{job?.errorModel || "Groq highlight model"}</dd>
                      <dt className="text-gray-400">Category</dt><dd>{job?.errorCategory || "rate_limit_exceeded"}</dd>
                      <dt className="text-gray-400">Next retry</dt><dd>{retryInSeconds > 0 ? `Available in ${retryInSeconds}s` : "Available now"}</dd>
                    </dl>
                  </details>
                )}

                {/* Missing Key Helper */}
                {(error?.includes("GROQ_API_KEY") || job?.error?.includes("GROQ_API_KEY")) && (
                  <div className="mt-3 pt-3 border-t border-red-500/20 flex flex-wrap gap-2">
                    <button
                      onClick={onOpenSettings}
                      className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors"
                    >
                      <Key className="h-3.5 w-3.5" />
                      <span>Configure Groq API Key</span>
                    </button>
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button
                    onClick={handleRetry}
                    disabled={retrying || retryInSeconds > 0}
                    className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition-colors"
                  >
                    <RotateCcw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
                    <span>{retrying ? "Restarting…" : retryInSeconds > 0 ? `Retry in ${retryInSeconds}s` : "Retry Processing"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
