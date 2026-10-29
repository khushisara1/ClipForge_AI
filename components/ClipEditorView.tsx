"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Download,
  RotateCcw,
  Trash2,
  Clock,
  CheckCircle2,
  Loader2,
  FileText,
  Video,
  ChevronLeft,
} from "lucide-react";
import { Clip, Project, Transcript } from "@/types";

interface ClipEditorViewProps {
  projectId: string;
  onBackToDashboard: () => void;
}

export const ClipEditorView: React.FC<ClipEditorViewProps> = ({
  projectId,
  onBackToDashboard,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit states for currently selected clip
  const [editedTitle, setEditedTitle] = useState("");
  const [editedCaptionText, setEditedCaptionText] = useState("");
  const [selectedRatio, setSelectedRatio] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [selectedPosition, setSelectedPosition] = useState<"bottom" | "middle" | "top">("bottom");
  const [selectedFontSize, setSelectedFontSize] = useState<number>(32);
  const [selectedColor, setSelectedColor] = useState<string>("#FFFFFF");

  const [isRerendering, setIsRerendering] = useState(false);
  const [rerenderMessage, setRerenderMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"editor" | "transcript">("editor");
  const [transcriptSearch, setTranscriptSearch] = useState("");

  const selectClip = (clip: Clip) => {
    setSelectedClipId(clip.id);
    setEditedTitle(clip.title);
    setEditedCaptionText(clip.captionText || clip.transcriptExcerpt);
    setSelectedRatio(clip.aspectRatio || "9:16");
    setSelectedPosition(clip.captionStyle?.position || "bottom");
    setSelectedFontSize(clip.captionStyle?.fontSize || 32);
    setSelectedColor(clip.captionStyle?.primaryColor || "#FFFFFF");
    setRerenderMessage(null);
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setProject(data.project);
        setClips(data.clips || []);
        setTranscript(data.transcript);

        if (data.clips && data.clips.length > 0) {
          const first = data.clips[0];
          setSelectedClipId(first.id);
          setEditedTitle(first.title);
          setEditedCaptionText(first.captionText || first.transcriptExcerpt);
          setSelectedRatio(first.aspectRatio || "9:16");
          setSelectedPosition(first.captionStyle?.position || "bottom");
          setSelectedFontSize(first.captionStyle?.fontSize || 32);
          setSelectedColor(first.captionStyle?.primaryColor || "#FFFFFF");
        }
      })
      .catch((err) => console.error("Failed to load project details:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const activeClip = clips.find((c) => c.id === selectedClipId) || clips[0];

  const handleRerender = async () => {
    if (!activeClip || isRerendering) return;

    setIsRerendering(true);
    setRerenderMessage("Re-rendering clip with updated captions & styling...");

    try {
      const res = await fetch(
        `/api/projects/${projectId}/clips/${activeClip.id}/rerender`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editedTitle.trim(),
            captionText: editedCaptionText.trim(),
            aspectRatio: selectedRatio,
            captionStyle: {
              fontSize: selectedFontSize,
              position: selectedPosition,
              primaryColor: selectedColor,
              highlightColor: "#FBBF24",
              boxColor: "#000000",
              fontName: "Arial",
            },
          }),
        }
      );

      const data = await res.json();
      if (res.ok && data.clip) {
        // Update local clips
        setClips((prev) =>
          prev.map((c) => (c.id === data.clip.id ? data.clip : c))
        );
        setRerenderMessage("Clip re-rendered successfully!");

        // Reload video element
        if (videoRef.current) {
          videoRef.current.load();
        }
      } else {
        setRerenderMessage(`Error: ${data.error || "Rerender failed"}`);
      }
    } catch {
      setRerenderMessage("Network error during re-render.");
    } finally {
      setIsRerendering(false);
    }
  };

  const handleDeleteClip = async (clipId: string) => {
    if (!confirm("Are you sure you want to delete this clip?")) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/clips/${clipId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const remaining = clips.filter((c) => c.id !== clipId);
        setClips(remaining);
        if (selectedClipId === clipId) {
          setSelectedClipId(remaining[0]?.id || null);
        }
      }
    } catch (err) {
      console.error("Delete clip error:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-white">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
            title="Back to Dashboard"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl flex items-center gap-2">
              <span>{project?.name || "Podcast Clips Studio"}</span>
              <span className="rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs text-violet-300 font-medium">
                {clips.length} Clips
              </span>
            </h1>
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              {project?.originalFilename}
            </p>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1 text-xs">
          <button
            onClick={() => setActiveTab("editor")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
              activeTab === "editor"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Video className="h-3.5 w-3.5" />
            <span>Clips Studio</span>
          </button>
          <button
            onClick={() => setActiveTab("transcript")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
              activeTab === "transcript"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Full Transcript</span>
          </button>
        </div>
      </div>

      {activeTab === "transcript" ? (
        /* Full Episode Transcript View */
        <div className="mt-8 rounded-2xl border border-white/10 bg-[#12161f] p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <h2 className="text-base font-semibold text-white">Full Episode Transcript</h2>
              <p className="text-xs text-gray-400">
                Word-accurate speech transcribed via Groq Whisper AI.
              </p>
            </div>
            <input
              type="text"
              placeholder="Search transcript..."
              value={transcriptSearch}
              onChange={(e) => setTranscriptSearch(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none w-full sm:w-64"
            />
          </div>

          <div className="mt-6 space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {transcript?.segments
              ?.filter((s) =>
                s.text.toLowerCase().includes(transcriptSearch.toLowerCase())
              )
              .map((seg, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs leading-relaxed hover:border-violet-500/30 transition-colors"
                >
                  <div className="flex items-center gap-2 text-violet-400 font-mono text-[11px] mb-1 font-semibold">
                    <span>
                      {Math.floor(seg.start / 60)}:
                      {String(Math.floor(seg.start % 60)).padStart(2, "0")}
                    </span>
                    <span>&rarr;</span>
                    <span>
                      {Math.floor(seg.end / 60)}:
                      {String(Math.floor(seg.end % 60)).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="text-gray-200">{seg.text}</p>
                </div>
              ))}
          </div>
        </div>
      ) : (
        /* Clips Studio View */
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
          {/* Left: Clips List Sidebar */}
          <div className="space-y-3 lg:col-span-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">
              Select A Clip ({clips.length})
            </h2>

            <div className="space-y-3 lg:max-h-[calc(100vh-230px)] lg:overflow-y-auto lg:pr-1">
              {clips.map((clip) => {
                const isSelected = clip.id === activeClip?.id;
                return (
                  <button
                    key={clip.id}
                    type="button"
                    onClick={() => selectClip(clip)}
                    aria-pressed={isSelected}
                    className={`w-full cursor-pointer rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? "border-violet-500 bg-violet-600/10 shadow-lg shadow-violet-500/10"
                        : "border-white/10 bg-[#12161f] hover:border-white/20 hover:bg-[#151a24]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white line-clamp-2">
                        {clip.title}
                      </h3>
                      <span className="shrink-0 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                        {clip.qualityScore ?? clip.engagementScore} / 100
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-gray-300 line-clamp-2">
                      {clip.hook || clip.transcriptExcerpt}
                    </p>

                    <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[11px] text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-violet-400" />
                        <span>{clip.duration}s</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {clip.status === "completed" ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Ready
                          </span>
                        ) : clip.status === "rendering" ? (
                          <span className="text-amber-300 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Rendering
                          </span>
                        ) : (
                          <span className="text-gray-500">Suggested</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center: Live Vertical Video Player */}
          <div className="flex flex-col items-center lg:col-span-5">
            {activeClip ? (
              <div className={`w-full ${selectedRatio === "16:9" ? "max-w-2xl" : selectedRatio === "1:1" ? "max-w-lg" : "max-w-sm"} space-y-4`}>
                <div style={{ aspectRatio: selectedRatio.replace(":", " / ") }} className="relative w-full overflow-hidden rounded-3xl border border-white/20 bg-black shadow-2xl">
                  {/* Real Video Element */}
                  <video
                    ref={videoRef}
                    src={activeClip.videoUrl}
                    controls
                    playsInline
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="w-full rounded-2xl border border-white/10 bg-[#12161f] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300">Why this moment</p>
                      <h3 className="mt-1 text-sm font-semibold text-white">{activeClip.title}</h3>
                    </div>
                    <span className="shrink-0 rounded-lg border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-200">
                      {activeClip.qualityScore ?? activeClip.engagementScore} / 100 estimate
                    </span>
                  </div>
                  {activeClip.hook && <p className="mt-3 text-xs text-gray-200"><span className="text-gray-500">Opening · </span>{activeClip.hook}</p>}
                  {activeClip.mainIdea && <p className="mt-2 text-xs leading-relaxed text-gray-400"><span className="text-gray-500">Main idea · </span>{activeClip.mainIdea}</p>}
                  {activeClip.payoff && <p className="mt-2 text-xs leading-relaxed text-gray-400"><span className="text-gray-500">Payoff · </span>{activeClip.payoff}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                    <span className="rounded-full border border-white/10 px-2 py-1">{activeClip.duration}s</span>
                    {activeClip.contextComplete === true ? <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-300">Complete thought</span> : activeClip.contextComplete === false ? <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-amber-200">Context needs review</span> : <span className="rounded-full border border-white/10 px-2 py-1">Completeness not scored</span>}
                    {activeClip.reason && <span className="max-w-full truncate">{activeClip.reason}</span>}
                  </div>
                </div>

                {/* Direct Download Button */}
                {activeClip.downloadUrl && activeClip.status === "completed" && (
                  <a
                    href={activeClip.downloadUrl}
                    download
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 active:scale-98 transition-all"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Finished Clip (MP4)</span>
                  </a>
                )}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-xs text-gray-500">
                No clip selected
              </div>
            )}
          </div>

          {/* Right: Clip Customization & Re-rendering Panel */}
          <div className="lg:col-span-4">
            {activeClip ? (
              <div className="rounded-2xl border border-white/10 bg-[#12161f] p-5 space-y-5 shadow-xl text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="font-semibold text-white text-sm">
                    Clip Customization
                  </h3>
                  <button
                    onClick={() => handleDeleteClip(activeClip.id)}
                    className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                    title="Delete clip"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Edit Title */}
                <div>
                  <label className="block font-medium text-gray-300">
                    Clip Title
                  </label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                {/* Aspect Ratio Selector */}
                <div>
                  <label className="block font-medium text-gray-300">
                    Aspect Ratio
                  </label>
                  <div className="mt-1.5 grid grid-cols-3 gap-2 text-center">
                    {(["9:16", "1:1", "16:9"] as const).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setSelectedRatio(ratio)}
                        className={`rounded-xl border py-2 font-medium transition-all ${
                          selectedRatio === ratio
                            ? "border-violet-500 bg-violet-500/20 text-white"
                            : "border-white/10 bg-white/5 text-gray-400 hover:text-white"
                        }`}
                      >
                        {ratio === "9:16"
                          ? "9:16 Shorts"
                          : ratio === "1:1"
                          ? "1:1 Square"
                          : "16:9 Wide"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Edit Caption Text */}
                <div>
                  <label className="block font-medium text-gray-300">
                    Subtitles / Caption Text
                  </label>
                  <textarea
                    rows={3}
                    value={editedCaptionText}
                    onChange={(e) => setEditedCaptionText(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 p-2.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                    placeholder="Enter burned subtitle text..."
                  />
                </div>

                {/* Caption Position & Style */}
                <div>
                  <label className="block font-medium text-gray-300">Caption presets</label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[
                      { name: "Bold", size: 40, color: "#FFFFFF" },
                      { name: "Warm", size: 34, color: "#FACC15" },
                      { name: "Minimal", size: 26, color: "#FFFFFF" },
                    ].map((preset) => (
                      <button key={preset.name} type="button" onClick={() => { setSelectedFontSize(preset.size); setSelectedColor(preset.color); setSelectedPosition("bottom"); }} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[11px] text-gray-300 hover:border-violet-500/50 hover:text-white">
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-gray-300">
                      Caption Position
                    </label>
                    <select
                      value={selectedPosition}
                      onChange={(e) =>
                        setSelectedPosition(
                          e.target.value as "bottom" | "middle" | "top"
                        )
                      }
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-violet-500 focus:outline-none"
                    >
                      <option value="bottom" className="bg-[#12161f]">Bottom</option>
                      <option value="middle" className="bg-[#12161f]">Center</option>
                      <option value="top" className="bg-[#12161f]">Top</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-gray-300">
                      Caption Color
                    </label>
                    <div className="mt-2.5 flex items-center gap-2.5">
                      {[
                        { name: "White", hex: "#FFFFFF" },
                        { name: "Yellow", hex: "#FACC15" },
                        { name: "Cyan", hex: "#22D3EE" },
                      ].map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setSelectedColor(c.hex)}
                          className={`h-6 w-6 rounded-full border transition-all ${
                            selectedColor === c.hex
                              ? "ring-2 ring-violet-500 border-white scale-110"
                              : "border-white/20 opacity-70 hover:opacity-100"
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Re-render Button */}
                <div className="pt-2">
                  <button
                    onClick={handleRerender}
                    disabled={isRerendering}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 font-bold text-white shadow-md shadow-violet-600/25 hover:bg-violet-500 disabled:opacity-50 transition-all"
                  >
                    <RotateCcw
                      className={`h-4 w-4 ${isRerendering ? "animate-spin" : ""}`}
                    />
                    <span>
                      {isRerendering ? "Re-rendering..." : "Re-render Clip"}
                    </span>
                  </button>
                </div>

                {rerenderMessage && (
                  <p
                    className={`text-center text-[11px] font-medium ${
                      rerenderMessage.includes("Error")
                        ? "text-red-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {rerenderMessage}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
