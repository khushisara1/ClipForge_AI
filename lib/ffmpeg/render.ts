import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { Clip, TranscriptSegment } from "@/types";
import { getFfmpegPath } from "./paths";
import { DIRS, ensureDirs } from "../storage/paths";
import {
  buildSubtitleEvents,
  generateAssSubtitleFile,
} from "./subtitles";

export interface RenderClipOptions {
  projectId: string;
  clip: Clip;
  sourceVideoPath: string;
  transcriptSegments?: TranscriptSegment[];
}

export async function renderClip({
  clip,
  sourceVideoPath,
  transcriptSegments,
}: RenderClipOptions): Promise<{ outputPath: string; sizeBytes: number }> {
  ensureDirs();
  const ffmpeg = getFfmpegPath();
  const outputPath = path.join(DIRS.clips, `${clip.id}.mp4`);

  // Target canvas dimensions based on chosen aspect ratio
  let targetWidth = 1080;
  let targetHeight = 1920;

  if (clip.aspectRatio === "1:1") {
    targetWidth = 1080;
    targetHeight = 1080;
  } else if (clip.aspectRatio === "16:9") {
    targetWidth = 1920;
    targetHeight = 1080;
  }

  // 1. Generate subtitle events and ASS file
  const events = buildSubtitleEvents(
    clip.startTime,
    clip.endTime,
    transcriptSegments,
    clip.captionText || clip.transcriptExcerpt
  );

  const assFilePath = generateAssSubtitleFile(
    clip.id,
    events,
    clip.captionStyle,
    targetWidth,
    targetHeight
  );

  const assFileName = path.basename(assFilePath);

  // 2. Build video filter graph
  let filterGraph = "";

  if (clip.aspectRatio === "9:16") {
    // Beautiful Blurred Background Stack:
    // [0:v] split into background (scaled & blurred) and foreground (scaled centered)
    // with subtitles applied on top of the composed frame
    filterGraph = [
      `[0:v]split=2[bg_in][fg_in]`,
      `[bg_in]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg]`,
      `[fg_in]scale=1080:-2[fg]`,
      `[bg][fg]overlay=(W-w)/2:(H-h)/2[composed]`,
      `[composed]subtitles=filename='${assFileName}'[outv]`,
    ].join(";");
  } else if (clip.aspectRatio === "1:1") {
    filterGraph = [
      `[0:v]split=2[bg_in][fg_in]`,
      `[bg_in]scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,boxblur=25:5[bg]`,
      `[fg_in]scale=1080:-2[fg]`,
      `[bg][fg]overlay=(W-w)/2:(H-h)/2[composed]`,
      `[composed]subtitles=filename='${assFileName}'[outv]`,
    ].join(";");
  } else {
    // 16:9 Landscape
    filterGraph = [
      `[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[composed]`,
      `[composed]subtitles=filename='${assFileName}'[outv]`,
    ].join(";");
  }

  // Calculate duration
  const duration = Math.max(1, clip.endTime - clip.startTime);

  const args = [
    "-y",
    "-ss",
    String(clip.startTime),
    "-t",
    String(duration),
    "-i",
    sourceVideoPath,
    "-filter_complex",
    filterGraph,
    "-map",
    "[outv]",
    "-map",
    "0:a?", // Map audio if present
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  return new Promise((resolve, reject) => {
    // Execute FFmpeg with cwd set to subtitles directory so relative subtitle path works cleanly
    const child = spawn(ffmpeg, args, {
      cwd: DIRS.subtitles,
      windowsHide: true,
    });

    let stderrData = "";

    child.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    child.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        if (stats.size > 2000) {
          resolve({ outputPath, sizeBytes: stats.size });
          return;
        }
      }

      console.error("FFmpeg render failed. Exit code:", code);
      console.error("FFmpeg stderr snippet:", stderrData.slice(-1000));
      reject(
        new Error(
          `FFmpeg render process failed with code ${code}. Please verify media format.`
        )
      );
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to launch FFmpeg: ${err.message}`));
    });
  });
}
