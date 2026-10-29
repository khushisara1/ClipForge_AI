"use client";

import React, { useState, useEffect } from "react";
import { X, CheckCircle2, AlertTriangle, Cpu, Key, HardDrive, RefreshCw } from "lucide-react";

interface HealthData {
  status: string;
  ffmpeg: {
    available: boolean;
    ffmpegPath?: string;
    ffprobePath?: string;
    error?: string;
  };
  ai: {
    groqConfigured: boolean;
    transcriptionModel: string;
    highlightModel: string;
    note: string;
  };
  storage: {
    mode: string;
    writable: boolean;
    maxUploadMb: number;
  };
  processing?: {
    concurrency: number;
    maxRetries: number;
    estimatedTokenBudgetPerMinute: number;
  };
}

interface HealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshHealth: () => void;
}

export const HealthModal: React.FC<HealthModalProps> = ({
  isOpen,
  onClose,
  onRefreshHealth,
}) => {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchHealth = () => {
    setLoading(true);
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setData(json);
      })
      .catch((err) => console.error("Health fetch error:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json) setData(json);
      })
      .catch((err) => console.error("Health fetch error:", err));

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;

    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch("/api/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groqApiKey: apiKeyInput.trim() }),
      });
      const resData = await res.json();
      if (res.ok) {
        setSaveStatus("Key saved successfully! AI services are now active.");
        setApiKeyInput("");
        fetchHealth();
        onRefreshHealth();
      } else {
        setSaveStatus(`Failed: ${resData.error || "Could not save key"}`);
      }
    } catch {
      setSaveStatus("Network error saving key.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="diagnostics-title" className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#12161f] p-4 text-white shadow-2xl sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Cpu className="h-5 w-5 text-violet-400" />
            <h2 id="diagnostics-title" className="text-lg font-semibold">System Diagnostics & AI Settings</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close diagnostics"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* FFmpeg Service */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    data?.ffmpeg.available ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {data?.ffmpeg.available ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-semibold">FFmpeg & FFprobe Media Engines</h3>
                  <p className="text-xs text-gray-400">
                    {data?.ffmpeg.available
                      ? "Bundled static binaries operational (video trimming, audio extraction, ASS styling)"
                      : data?.ffmpeg.error || "FFmpeg binary unavailable"}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  data?.ffmpeg.available ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                }`}
              >
                {data?.ffmpeg.available ? "READY" : "MISSING"}
              </span>
            </div>
          </div>

          {/* Groq AI Service */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    data?.ai.groqConfigured ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Groq AI Speech & Highlights</h3>
                  <p className="text-xs text-gray-400">
                    Whisper ({data?.ai.transcriptionModel}) & Groq LLM ({data?.ai.highlightModel})
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">{data?.ai.groqConfigured ? "API key configured; live connectivity is checked when processing starts." : "Add a Groq API key to enable transcription and highlight detection."}</p>
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  data?.ai.groqConfigured ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-300"
                }`}
              >
                {data?.ai.groqConfigured ? "CONFIGURED" : "KEY REQUIRED"}
              </span>
            </div>

            {/* Quick Key Entry */}
            <form onSubmit={handleSaveApiKey} className="mt-4 pt-3 border-t border-white/5 space-y-2.5">
              <label className="block text-xs font-medium text-gray-300">
                Update Groq API Key (saved safely to your local <code className="text-violet-300">.env.local</code>):
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="gsk_..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={saving || !apiKeyInput.trim()}
                  className="rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : "Save Key"}
                </button>
              </div>

              {saveStatus && (
                <p className="text-xs text-emerald-400 mt-1">{saveStatus}</p>
              )}

              <p className="text-[11px] text-gray-400">
                Free Groq API keys can be generated at{" "}
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet-400 underline hover:text-violet-300"
                >
                  console.groq.com/keys
                </a>
              </p>
            </form>
          </div>

          {/* Local Storage Status */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                  <HardDrive className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Local Storage & Uploads</h3>
                  <p className="text-xs text-gray-400">
                Local JSON project storage &middot; Max upload: {data?.storage.maxUploadMb || 500}MB
                  </p>
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${data?.storage.writable ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                {data?.storage.writable ? "WRITABLE" : "UNAVAILABLE"}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-start gap-3">
              <RefreshCw className="mt-1 h-4 w-4 text-violet-400" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">Processing and rate limits</h3>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                  <div><dt className="text-gray-500">AI concurrency</dt><dd className="mt-1 text-gray-200">{data?.processing?.concurrency ?? 1} request(s)</dd></div>
                  <div><dt className="text-gray-500">429 retries</dt><dd className="mt-1 text-gray-200">Up to {data?.processing?.maxRetries ?? 2}</dd></div>
                  <div><dt className="text-gray-500">Token budget</dt><dd className="mt-1 text-gray-200">~{(data?.processing?.estimatedTokenBudgetPerMinute ?? 7000).toLocaleString()}/min</dd></div>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Re-check Diagnostics</span>
          </button>
          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
