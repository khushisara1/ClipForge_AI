"use client";

import React from "react";
import { Sparkles, Settings, Plus, CheckCircle2, AlertTriangle } from "lucide-react";

interface NavbarProps {
  currentView: "landing" | "dashboard" | "upload" | "processing" | "editor";
  onNavigate: (view: "landing" | "dashboard" | "upload") => void;
  onOpenSettings: () => void;
  isGroqConfigured: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onOpenSettings,
  isGroqConfigured,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0d12]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => onNavigate("landing")}
            className="flex items-center gap-2.5 text-left text-lg font-bold tracking-tight text-white hover:opacity-90 transition-opacity"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 shadow-md shadow-violet-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span>
              <span className="text-violet-400">Clip</span>Forge AI
            </span>
          </button>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <button
              onClick={() => onNavigate("dashboard")}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                currentView === "dashboard"
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => onNavigate("upload")}
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                currentView === "upload"
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Upload Podcast
            </button>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <button
            onClick={onOpenSettings}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
              isGroqConfigured
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            }`}
            title="System Diagnostics & API Configuration"
          >
            {isGroqConfigured ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">AI Online</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Setup API Key</span>
              </>
            )}
          </button>

          {/* New Project CTA */}
          <button
            onClick={() => onNavigate("upload")}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-sm shadow-violet-500/25 hover:bg-violet-500 transition-all active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>New Video</span>
          </button>

          {/* Diagnostics Button */}
          <button
            onClick={onOpenSettings}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
            title="Diagnostics & Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
