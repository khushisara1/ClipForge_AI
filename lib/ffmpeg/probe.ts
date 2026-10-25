import { execFile } from "child_process";
import { promisify } from "util";
import { getFfprobePath } from "./paths";

const execFileAsync = promisify(execFile);

export interface MediaProbeResult {
  duration: number;
  width: number;
  height: number;
  fps: number;
  format: string;
  videoCodec?: string;
  audioCodec?: string;
  hasAudio: boolean;
  hasVideo: boolean;
  fileSize: number;
}

export async function probeMedia(filePath: string): Promise<MediaProbeResult> {
  const ffprobe = getFfprobePath();

  const args = [
    "-v",
    "error",
    "-show_entries",
    "format=duration,size,format_name",
    "-show_entries",
    "stream=codec_type,codec_name,width,height,r_frame_rate,duration",
    "-of",
    "json",
    filePath,
  ];

  try {
    const { stdout, stderr } = await execFileAsync(ffprobe, args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    });

    if (stderr && stderr.trim().length > 0) {
      console.warn("FFprobe warning:", stderr);
    }

    const data = JSON.parse(stdout);
    const streams = data.streams || [];
    const format = data.format || {};

    const videoStream = streams.find((s: { codec_type: string }) => s.codec_type === "video");
    const audioStream = streams.find((s: { codec_type: string }) => s.codec_type === "audio");

    if (!videoStream && !audioStream) {
      throw new Error("File contains neither a valid video nor audio stream.");
    }

    let fps = 30;
    if (videoStream?.r_frame_rate) {
      const parts = videoStream.r_frame_rate.split("/");
      if (parts.length === 2 && Number(parts[1]) > 0) {
        fps = Math.round(Number(parts[0]) / Number(parts[1])) || 30;
      }
    }

    const duration =
      parseFloat(format.duration) ||
      parseFloat(videoStream?.duration) ||
      parseFloat(audioStream?.duration) ||
      0;

    const fileSize = parseInt(format.size, 10) || 0;

    return {
      duration: Math.max(0, duration),
      width: videoStream?.width || 1920,
      height: videoStream?.height || 1080,
      fps,
      format: format.format_name || "unknown",
      videoCodec: videoStream?.codec_name,
      audioCodec: audioStream?.codec_name,
      hasAudio: Boolean(audioStream),
      hasVideo: Boolean(videoStream),
      fileSize,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Media validation failed: ${errorMsg}`);
  }
}
