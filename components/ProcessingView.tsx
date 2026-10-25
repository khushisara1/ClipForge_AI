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
  { id: "upload", label: "Media Uploaded", icon: FileCheck },
  { id: "validate", label: "Validating Media & Codecs", icon: FileCheck },
  { id: "audio", label: "Extracting Speech Audio", icon: FileAudio },
  { id: "transcribe", label: "Transcribing Speech (Whisper AI)", icon: BrainCircuit },
  { id: "highlights", label: "Analyzing Highlights (Llama AI)", icon: Sparkles },
  { id: "render", label: "Rendering 9:16 Clips with Captions", icon: Crop },
  { id: "ready", label: "Ready to Preview & Download", icon: Play },
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

  useEffect(() => {
    let isCancelled = false;

    const pollStatus = () => {
      fetch(`/api/projects/${projectId}/status`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (isCancelled || !data) return;
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
      await fetch(`/api/projects/${projectId}/process`, { method: "POST" });
      const res = await fetch(`/api/projects/${projectId}/status`);
      if (res.ok) {
        const data = await res.json();
        setJob(data.job);
      }
    } catch {
      setError("Failed to restart processing.");
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
        {/* Progress Bar & Status Line */}
        <div className="space-y-3 pb-8 border-b border-white/10">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-violet-300">
              {job?.message || "Running automated pipeline..."}
            </span>
            <span className="font-mono text-white font-bold">
              {job?.progress || (currentStepIndex / (STAGES.length - 1)) * 100}%
            </span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full transition-all duration-300 ${
                isFailed
                  ? "bg-red-500"
                  : "bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500"
              }`}
              style={{
                width: isFailed
                  ? "100%"
                  : `${Math.max(10, job?.progress || ((currentStepIndex + 1) / STAGES.length) * 100)}%`,
              }}
            />
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
                  Processing Interrupted
                </h4>
                <p className="text-xs text-red-200/90 leading-relaxed">
                  {error || job?.error || "An error occurred during media processing."}
                </p>

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
                    disabled={retrying}
                    className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition-colors"
                  >
                    <RotateCcw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
                    <span>{retrying ? "Restarting..." : "Retry Processing"}</span>
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
