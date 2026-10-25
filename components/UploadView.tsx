"use client";

import React, { useRef, useState } from "react";
import {
  UploadCloud,
  FileVideo,
  X,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Project } from "@/types";

interface UploadViewProps {
  onUploadSuccess: (project: Project) => void;
  onCancel: () => void;
}

const ALLOWED_EXTS = [".mp4", ".mov", ".webm", ".mkv", ".m4v"];
const MAX_MB = 500;

export const UploadView: React.FC<UploadViewProps> = ({
  onUploadSuccess,
  onCancel,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const validateAndSetFile = (file: File) => {
    setErrorMessage(null);
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

    if (!ALLOWED_EXTS.includes(ext) && !file.type.startsWith("video/")) {
      setErrorMessage(
        `Unsupported file type. Please upload a video file (${ALLOWED_EXTS.join(
          ", "
        )}).`
      );
      return;
    }

    if (file.size > MAX_MB * 1024 * 1024) {
      setErrorMessage(`File exceeds maximum size of ${MAX_MB}MB.`);
      return;
    }

    setSelectedFile(file);
    if (!title.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      setTitle(baseName);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const startUpload = () => {
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setUploadProgress(0);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("title", title.trim());
    formData.append("autoProcess", "true");

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setIsUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.project) {
            onUploadSuccess(res.project);
          } else {
            setErrorMessage("Unexpected server response format.");
          }
        } catch {
          setErrorMessage("Failed to parse server upload response.");
        }
      } else {
        try {
          const errRes = JSON.parse(xhr.responseText);
          setErrorMessage(errRes.error || `Upload failed with status ${xhr.status}`);
        } catch {
          setErrorMessage(`Upload failed with server status ${xhr.status}`);
        }
      }
    };

    xhr.onerror = () => {
      setIsUploading(false);
      setErrorMessage("Network error during upload. Please check connection and try again.");
    };

    xhr.onabort = () => {
      setIsUploading(false);
      setUploadProgress(null);
      setErrorMessage("Upload cancelled.");
    };

    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  };

  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="text-center pb-8">
        <h1 className="text-3xl font-extrabold text-white">Upload Podcast Episode</h1>
        <p className="mt-2 text-sm text-gray-400">
          Upload your video recording to begin automated transcription and vertical clip extraction.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#12161f] p-6 sm:p-8 shadow-2xl">
        {/* Drop Zone */}
        {!selectedFile ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
              dragActive
                ? "border-violet-500 bg-violet-600/10 scale-[1.01]"
                : "border-white/20 bg-white/[0.02] hover:border-violet-500/50 hover:bg-white/[0.04]"
            }`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 text-violet-400">
              <UploadCloud className="h-8 w-8" />
            </div>

            <h2 className="mt-5 text-base font-semibold text-white">
              Drag & Drop your video file here
            </h2>
            <p className="mt-1 text-xs text-gray-400">
              or click anywhere to browse from your computer
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-gray-400">
              <span>MP4, MOV, WebM, MKV</span>
              <span>&middot;</span>
              <span>Max {MAX_MB}MB</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  validateAndSetFile(e.target.files[0]);
                }
              }}
            />
          </div>
        ) : (
          /* Selected File Preview & Customization */
          <div className="space-y-6">
            <div className="flex items-start justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
                  <FileVideo className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white break-all">
                    {selectedFile.name}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &middot;{" "}
                    {selectedFile.type || "Video file"}
                  </p>
                </div>
              </div>

              {!isUploading && (
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setUploadProgress(null);
                    setErrorMessage(null);
                  }}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
                  title="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Title Input */}
            <div>
              <label className="block text-xs font-medium text-gray-300">
                Project Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isUploading}
                placeholder="Episode name or podcast topic"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none"
              />
            </div>

            {/* Real Progress Bar */}
            {isUploading && uploadProgress !== null && (
              <div className="space-y-2 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-violet-300">
                    {uploadProgress < 100
                      ? "Uploading media to server..."
                      : "Finalizing stream on disk..."}
                  </span>
                  <span className="text-white">{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={isUploading ? cancelUpload : onCancel}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                {isUploading ? "Cancel Upload" : "Cancel"}
              </button>

              <button
                type="button"
                onClick={startUpload}
                disabled={isUploading}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md shadow-violet-600/30 hover:bg-violet-500 disabled:opacity-50 transition-all"
              >
                <Sparkles className="h-4 w-4" />
                <span>{isUploading ? "Uploading..." : "Upload & Process Clips"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
