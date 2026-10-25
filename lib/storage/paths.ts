import path from "path";
import fs from "fs";

export function getDataDir(): string {
  return path.join(process.cwd(), "data");
}

export const DIRS = {
  get data() {
    return getDataDir();
  },
  get db() {
    return path.join(getDataDir(), "db");
  },
  get uploads() {
    return path.join(getDataDir(), "uploads");
  },
  get audio() {
    return path.join(getDataDir(), "audio");
  },
  get clips() {
    return path.join(getDataDir(), "clips");
  },
  get subtitles() {
    return path.join(getDataDir(), "subtitles");
  },
  get temp() {
    return path.join(getDataDir(), "temp");
  },
};

export function ensureDirs(): void {
  for (const dirPath of Object.values(DIRS)) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}

/**
 * Validates and resolves a file path safely within the data directory.
 * Prevents directory traversal attacks.
 */
export function resolveSafeDataPath(subDir: keyof typeof DIRS, filename: string): string {
  // Prevent any null byte or traversal sequence in filename
  if (!filename || filename.includes("\0") || filename.includes("..")) {
    throw new Error("Invalid filename or path traversal detected");
  }

  const base = DIRS[subDir];
  const target = path.resolve(base, filename);

  const relative = path.relative(base, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Resolved path escapes authorized directory");
  }

  return target;
}
