import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

let cachedFfmpegPath: string | null = null;
let cachedFfprobePath: string | null = null;

export function getFfmpegPath(): string {
  if (cachedFfmpegPath) return cachedFfmpegPath;

  // 1. Explicit env var
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    const p = process.env.FFMPEG_PATH;
    cachedFfmpegPath = p;
    return p;
  }

  // 2. Direct node_modules binary path on Windows/Linux
  const directFfmpeg = path.join(
    process.cwd(),
    "node_modules",
    "ffmpeg-static",
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
  );
  if (fs.existsSync(directFfmpeg)) {
    cachedFfmpegPath = directFfmpeg;
    return directFfmpeg;
  }

  // 3. Bundled ffmpeg-static require
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require("ffmpeg-static");
    const rawPath =
      typeof ffmpegStatic === "string"
        ? ffmpegStatic
        : ffmpegStatic?.default || ffmpegStatic?.path;
    if (rawPath && typeof rawPath === "string" && fs.existsSync(rawPath)) {
      const p: string = rawPath;
      cachedFfmpegPath = p;
      return p;
    }
  } catch {
    // ignore
  }

  // 4. Fallback to system PATH
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    cachedFfmpegPath = "ffmpeg";
    return "ffmpeg";
  } catch {
    // not in PATH
  }

  throw new Error(
    "FFmpeg binary not found. Please install ffmpeg or set FFMPEG_PATH in .env.local"
  );
}

export function getFfprobePath(): string {
  if (cachedFfprobePath) return cachedFfprobePath;

  // 1. Explicit env var
  if (process.env.FFPROBE_PATH && fs.existsSync(process.env.FFPROBE_PATH)) {
    const p = process.env.FFPROBE_PATH;
    cachedFfprobePath = p;
    return p;
  }

  // 2. Direct node_modules binary path
  const directFfprobeWin = path.join(
    process.cwd(),
    "node_modules",
    "ffprobe-static",
    "bin",
    "win32",
    "x64",
    "ffprobe.exe"
  );
  if (fs.existsSync(directFfprobeWin)) {
    cachedFfprobePath = directFfprobeWin;
    return directFfprobeWin;
  }

  // 3. Bundled ffprobe-static require
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffprobeStatic = require("ffprobe-static");
    const rawPath =
      typeof ffprobeStatic === "string"
        ? ffprobeStatic
        : ffprobeStatic?.path || ffprobeStatic?.default;
    if (rawPath && typeof rawPath === "string" && fs.existsSync(rawPath)) {
      const p: string = rawPath;
      cachedFfprobePath = p;
      return p;
    }
  } catch {
    // ignore
  }

  // 3. Fallback to system PATH
  try {
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    cachedFfprobePath = "ffprobe";
    return cachedFfprobePath;
  } catch {
    // not in PATH
  }

  throw new Error(
    "FFprobe binary not found. Please install ffprobe or set FFPROBE_PATH in .env.local"
  );
}

export function checkFfmpegAvailable(): { available: boolean; ffmpeg?: string; ffprobe?: string; error?: string } {
  try {
    const ffmpeg = getFfmpegPath();
    const ffprobe = getFfprobePath();
    return { available: true, ffmpeg, ffprobe };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { available: false, error: message };
  }
}
