"use client";

import React from "react";
import {
  Sparkles,
  ArrowRight,
  UploadCloud,
  FileAudio,
  BrainCircuit,
  Crop,
  Download,
  Play,
  Film,
  CheckCircle,
} from "lucide-react";

interface LandingSectionProps {
  onStartCreating: () => void;
  onOpenDashboard: () => void;
  projectCount: number;
}

export const LandingSection: React.FC<LandingSectionProps> = ({
  onStartCreating,
  onOpenDashboard,
  projectCount,
}) => {
  return (
    <div className="relative overflow-hidden">
      {/* Background Glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-25">
        <div className="h-[500px] w-[500px] rounded-full bg-violet-600/30 blur-[130px]" />
        <div className="h-[400px] w-[400px] rounded-full bg-indigo-500/20 blur-[110px]" />
      </div>

      {/* Hero */}
      <section className="relative mx-auto max-w-5xl px-4 pt-16 pb-20 text-center sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1 text-xs font-medium text-violet-300">
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
          <span>Automated AI Video Repurposing Pipeline</span>
        </div>

        <h1 className="mt-7 text-4xl font-extrabold tracking-tight text-white sm:text-6xl sm:leading-[1.15]">
          Turn Long Podcasts Into{" "}
          <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-indigo-300 bg-clip-text text-transparent">
            Engaging Vertical Clips
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-gray-300 sm:text-lg leading-relaxed">
          Upload any podcast episode. ClipForge transcribes speech with Whisper AI,
          pinpoints the most engaging moments with LLM intelligence, and renders
          crisp 9:16 Shorts & Reels with burned-in dynamic captions.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onStartCreating}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 active:scale-95 transition-all"
          >
            <span>Start Creating Clips</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          {projectCount > 0 && (
            <button
              onClick={onOpenDashboard}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-gray-200 hover:bg-white/10 transition-all"
            >
              <Film className="h-4 w-4 text-violet-400" />
              <span>View Dashboard ({projectCount} projects)</span>
            </button>
          )}
        </div>

        {/* Realistic Interactive Interface Preview */}
        <div className="mt-14 overflow-hidden rounded-2xl border border-white/15 bg-[#0e121b] p-3 shadow-2xl shadow-violet-950/40">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-amber-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 font-mono text-gray-400">clipforge-studio.preview</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] text-violet-300">
                1080 x 1920 (9:16)
              </span>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
                Synchronized ASS Subtitles
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 text-left">
            {/* Left Mock Clips List */}
            <div className="md:col-span-4 space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                AI Detected Highlights
              </p>
              {[
                { title: "The Secret to High Productivity", time: "00:42", score: 94, active: true },
                { title: "Why Most Startups Fail Early", time: "00:35", score: 89, active: false },
                { title: "A Counterintuitive Advice", time: "00:48", score: 86, active: false },
              ].map((c, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-3 transition-all ${
                    c.active
                      ? "border-violet-500/60 bg-violet-600/10 shadow-sm shadow-violet-500/10"
                      : "border-white/5 bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{c.title}</span>
                    <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                      Score: {c.score}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                    <span>Duration: {c.time}</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Ready
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Center Vertical Mock Player */}
            <div className="md:col-span-4 flex justify-center">
              <div className="relative aspect-[9/16] w-full max-w-[210px] overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-b from-gray-900 via-purple-950/40 to-black shadow-inner flex flex-col justify-between p-3.5">
                <div className="flex justify-between items-center text-[10px] text-white/80">
                  <span className="rounded bg-black/60 px-1.5 py-0.5">00:18 / 00:42</span>
                  <span className="rounded-full bg-violet-500 px-1.5 py-0.2 text-[9px] font-bold">REEL</span>
                </div>
                {/* Center Content Placeholder */}
                <div className="text-center space-y-1">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
                    <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                  </div>
                  <p className="text-[10px] text-gray-400">Speaker Center Focus</p>
                </div>
                {/* Burned In Caption Preview */}
                <div className="rounded-lg bg-black/80 px-2.5 py-1.5 text-center shadow-lg border border-white/10">
                  <span className="text-xs font-extrabold tracking-wide text-amber-300">
                    &quot;THIS CHANGED EVERYTHING&quot;
                  </span>
                </div>
              </div>
            </div>

            {/* Right Mock Settings */}
            <div className="md:col-span-4 space-y-3 text-xs">
              <p className="font-semibold uppercase tracking-wider text-gray-400">
                Customization Studio
              </p>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-2">
                <p className="text-gray-300 font-medium">Aspect Ratio</p>
                <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                  <div className="rounded border border-violet-500 bg-violet-500/20 py-1 text-white font-medium">9:16</div>
                  <div className="rounded border border-white/10 bg-white/5 py-1 text-gray-400">1:1</div>
                  <div className="rounded border border-white/10 bg-white/5 py-1 text-gray-400">16:9</div>
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-2">
                <p className="text-gray-300 font-medium">Caption Styling</p>
                <div className="flex gap-2">
                  <span className="h-5 w-5 rounded-full bg-amber-400 ring-2 ring-violet-500" />
                  <span className="h-5 w-5 rounded-full bg-white ring-1 ring-white/20" />
                  <span className="h-5 w-5 rounded-full bg-cyan-400 ring-1 ring-white/20" />
                </div>
              </div>
              <div className="rounded-xl bg-violet-600/10 border border-violet-500/30 p-2.5 text-center text-violet-300 text-[11px]">
                Ready to download H.264 MP4 with burned subtitles
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works / Workflow */}
      <section className="border-t border-white/10 bg-white/[0.01] py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-xs font-bold uppercase tracking-widest text-violet-400">
              End-To-End Architecture
            </h2>
            <p className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              From Raw Episode to Finished Clips in 6 Steps
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: UploadCloud,
                step: "01",
                title: "Upload & Stream",
                desc: "Upload MP4, MOV, or WebM podcasts up to 500MB with real-time byte tracking.",
              },
              {
                icon: FileAudio,
                step: "02",
                title: "Audio Extraction",
                desc: "FFmpeg extracts 16kHz speech audio and optimizes loudness for speech recognition.",
              },
              {
                icon: BrainCircuit,
                step: "03",
                title: "Speech Transcription",
                desc: "Groq Whisper generates timestamped transcript segments for accurate subtitle timing.",
              },
              {
                icon: Sparkles,
                step: "04",
                title: "AI Moment Analysis",
                desc: "Language models evaluate narrative hooks, jokes, insights, and engagement potential.",
              },
              {
                icon: Crop,
                step: "05",
                title: "9:16 Vertical Framing",
                desc: "FFmpeg crops, scales, and layers ambient blurred backgrounds to fit vertical screens.",
              },
              {
                icon: Download,
                step: "06",
                title: "Burned Captions & Export",
                desc: "Subtitles are rendered directly into browser-compatible H.264 MP4s for instant download.",
              },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="group relative rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-violet-500/40 hover:bg-white/[0.04] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-sm font-bold text-gray-500">
                      {f.step}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-white">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-gray-400">
                    {f.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
