import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { getFfmpegPath } from "./paths";
import { DIRS, ensureDirs } from "../storage/paths";

const execFileAsync = promisify(execFile);

export interface AudioExtractResult {
  audioPath: string;
  duration: number;
  sizeBytes: number;
}

export async function extractAudio(
  projectId: string,
  videoPath: string
): Promise<AudioExtractResult> {
  ensureDirs();
  const ffmpeg = getFfmpegPath();
  const outputAudioPath = path.join(DIRS.audio, `${projectId}.mp3`);

  // If already extracted and valid, return it
  if (fs.existsSync(outputAudioPath)) {
    const stats = fs.statSync(outputAudioPath);
    if (stats.size > 1024) {
      return {
        audioPath: outputAudioPath,
        duration: 0,
        sizeBytes: stats.size,
      };
    }
  }

  // Optimize for Whisper: 16kHz, mono, 64kbps MP3
  const args = [
    "-y",
    "-i",
    videoPath,
    "-vn", // No video
    "-acodec",
    "libmp3lame",
    "-ar",
    "16000", // 16kHz sample rate optimal for Whisper
    "-ac",
    "1", // Mono
    "-b:a",
    "64k",
    outputAudioPath,
  ];

  try {
    await execFileAsync(ffmpeg, args, {
      timeout: 120000, // 2 minutes max
    });

    if (!fs.existsSync(outputAudioPath)) {
      throw new Error("FFmpeg finished but output audio file was not found.");
    }

    const stats = fs.statSync(outputAudioPath);
    if (stats.size < 500) {
      throw new Error(
        "Extracted audio file is empty or too small. The video may not contain an audible soundtrack."
      );
    }

    return {
      audioPath: outputAudioPath,
      duration: 0,
      sizeBytes: stats.size,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Audio extraction failed: ${message}`);
  }
}

/**
 * Splits audio into chunks (e.g. 15 minutes each) if the file size exceeds the max upload limit (e.g. 24MB).
 */
export async function splitAudioIfNeeded(
  audioPath: string,
  chunkDurationSeconds: number = 900 // 15 mins
): Promise<Array<{ chunkPath: string; offsetSeconds: number }>> {
  const stats = fs.statSync(audioPath);
  const maxBytes = 24 * 1024 * 1024; // 24 MB safe threshold for Groq 25 MB limit

  // If under limit, return single file
  if (stats.size <= maxBytes) {
    return [{ chunkPath: audioPath, offsetSeconds: 0 }];
  }

  const ffmpeg = getFfmpegPath();
  const chunks: Array<{ chunkPath: string; offsetSeconds: number }> = [];
  const baseName = path.basename(audioPath, path.extname(audioPath));
  const dir = path.dirname(audioPath);

  let offset = 0;
  let chunkIndex = 0;
  let hasMore = true;

  while (hasMore) {
    const chunkPath = path.join(dir, `${baseName}_part_${chunkIndex}.mp3`);
    const args = [
      "-y",
      "-ss",
      String(offset),
      "-i",
      audioPath,
      "-t",
      String(chunkDurationSeconds),
      "-acodec",
      "copy",
      chunkPath,
    ];

    try {
      await execFileAsync(ffmpeg, args, { timeout: 60000 });
      if (fs.existsSync(chunkPath)) {
        const chunkStat = fs.statSync(chunkPath);
        if (chunkStat.size > 2000) {
          chunks.push({ chunkPath, offsetSeconds: offset });
          offset += chunkDurationSeconds;
          chunkIndex++;
          if (offset > 14400) {
            // Safety cap at 4 hours
            hasMore = false;
          }
        } else {
          try {
            fs.unlinkSync(chunkPath);
          } catch {}
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    } catch {
      hasMore = false;
    }
  }

  return chunks.length > 0 ? chunks : [{ chunkPath: audioPath, offsetSeconds: 0 }];
}
