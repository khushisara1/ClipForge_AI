import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { ensureDirs, resolveSafeDataPath } from "@/lib/storage/paths";
import { saveProject } from "@/lib/storage/db";
import { runProcessingPipeline } from "@/lib/pipeline/orchestrator";
import { Project } from "@/types";

const ALLOWED_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".mkv", ".m4v"]);
const MAX_UPLOAD_BYTES =
  (parseInt(process.env.MAX_UPLOAD_MB || "500", 10) || 500) * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    ensureDirs();

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No video file provided in upload request." },
        { status: 400 }
      );
    }

    const originalFilename = file.name || "podcast.mp4";
    const extension = path.extname(originalFilename).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        {
          error: `Unsupported file format '${extension}'. Please upload MP4, MOV, or WebM video.`,
        },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "Uploaded file is empty (0 bytes)." },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      const maxMb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
      return NextResponse.json(
        {
          error: `File size exceeds the maximum allowed limit of ${maxMb}MB.`,
        },
        { status: 413 }
      );
    }

    const projectId = randomUUID();
    const safeTargetFilename = `${projectId}${extension}`;
    const destinationPath = resolveSafeDataPath("uploads", safeTargetFilename);

    // Stream file to disk to minimize memory usage
    const writeStream = fs.createWriteStream(destinationPath);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeStream = Readable.fromWeb(file.stream() as any);
    await pipeline(nodeStream, writeStream);

    const now = new Date().toISOString();
    const customTitle = (formData.get("title") as string)?.trim();
    const projectName =
      customTitle || path.basename(originalFilename, extension);

    const project: Project = {
      id: projectId,
      name: projectName,
      originalFilename,
      originalPath: destinationPath,
      duration: 0,
      width: 0,
      height: 0,
      fps: 0,
      fileSize: file.size,
      status: "uploaded",
      createdAt: now,
      updatedAt: now,
    };

    saveProject(project);

    // Launch pipeline asynchronously without blocking response
    const autoProcess = formData.get("autoProcess") !== "false";
    if (autoProcess) {
      setTimeout(() => {
        runProcessingPipeline(projectId).catch((err) => {
          console.error(`Error in background pipeline for ${projectId}:`, err);
        });
      }, 50);
    }

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error: unknown) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
