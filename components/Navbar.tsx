"use client";

import React, { useState } from "react";
import { Sparkles, Settings, Plus, CheckCircle2, AlertTriangle, Menu, X } from "lucide-react";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = (view: "landing" | "dashboard" | "upload") => {
    setMobileMenuOpen(false);
    onNavigate(view);
  };
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0d12]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate("landing")}
            aria-label="ClipForge AI home"
            className="flex items-center gap-2.5 text-left text-lg font-bold tracking-tight text-white transition-opacity hover:opacity-90 focus-visible:outline"
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
              onClick={() => navigate("dashboard")}
              aria-current={currentView === "dashboard" ? "page" : undefined}
              className={`rounded-lg px-3 py-2 transition-colors ${
                currentView === "dashboard"
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => navigate("upload")}
              aria-current={currentView === "upload" ? "page" : undefined}
              className={`rounded-lg px-3 py-2 transition-colors ${
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
            onClick={() => navigate("upload")}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-violet-500/25 transition-all hover:bg-violet-500 active:scale-[0.98] sm:px-3.5 sm:text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>New Video</span>
          </button>

          {/* Diagnostics Button */}
          <button
            onClick={onOpenSettings}
            aria-label="Diagnostics and settings"
            aria-haspopup="dialog"
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
            title="Diagnostics & Settings"
          >
            <Settings className="h-4 w-4" />
          </button>

          <button
            type="button"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 hover:bg-white/10 hover:text-white md:hidden"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <nav aria-label="Mobile navigation" className="border-t border-white/10 px-4 py-3 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {(["dashboard", "upload"] as const).map((view) => (
              <button key={view} onClick={() => navigate(view)} aria-current={currentView === view ? "page" : undefined} className={`rounded-lg px-3 py-3 text-left text-sm font-medium ${currentView === view ? "bg-violet-500/15 text-violet-200" : "text-gray-300 hover:bg-white/5"}`}>
                {view === "dashboard" ? "Dashboard" : "Upload Podcast"}
              </button>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
};
