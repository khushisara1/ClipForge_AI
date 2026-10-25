import { randomUUID } from "crypto";
import {
  getProject,
  saveProject,
  saveTranscript,
  getTranscript,
  saveClip,
  getClipsByProject,
  updateJobStatus,
} from "../storage/db";
import { probeMedia } from "../ffmpeg/probe";
import { extractAudio } from "../ffmpeg/audio";
import { renderClip } from "../ffmpeg/render";
import { isGroqConfigured, transcribeAudio } from "../ai/groq";
import { detectHighlights } from "../ai/highlights";
import { Clip, JobStep, Project } from "@/types";

const runningJobs = new Set<string>();

export function isJobRunning(projectId: string): boolean {
  return runningJobs.has(projectId);
}

function updateProgress(
  projectId: string,
  step: JobStep,
  progress: number,
  message: string,
  details?: string,
  error?: string
) {
  updateJobStatus({
    projectId,
    step,
    progress,
    message,
    details,
    error,
    updatedAt: new Date().toISOString(),
    completed: step === "ready" || step === "error",
  });
}

export async function runProcessingPipeline(projectId: string): Promise<void> {
  if (runningJobs.has(projectId)) {
    console.log(`Job for project ${projectId} already running, skipping duplicate.`);
    return;
  }

  runningJobs.add(projectId);

  try {
    const project = getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found.`);
    }

    // ---------------- STAGE 1: VALIDATE MEDIA ----------------
    updateProgress(projectId, "validate", 15, "Validating media file and streams with FFprobe...");
    saveProject({ ...project, status: "validating" });

    const probe = await probeMedia(project.originalPath);

    const updatedProject: Project = {
      ...project,
      duration: probe.duration,
      width: probe.width,
      height: probe.height,
      fps: probe.fps,
      status: "validating",
    };
    saveProject(updatedProject);

    // ---------------- STAGE 2: EXTRACT AUDIO ----------------
    updateProgress(projectId, "audio", 30, "Extracting high-fidelity speech audio for transcription...");
    saveProject({ ...updatedProject, status: "extracting_audio" });

    const audioResult = await extractAudio(projectId, project.originalPath);
    updatedProject.audioPath = audioResult.audioPath;
    saveProject(updatedProject);

    // ---------------- STAGE 3: TRANSCRIBE SPEECH ----------------
    updateProgress(projectId, "transcribe", 48, "Transcribing speech using Groq Whisper AI...");
    saveProject({ ...updatedProject, status: "transcribing" });

    let transcript = getTranscript(projectId);
    if (!transcript || transcript.segments.length === 0) {
      if (!isGroqConfigured()) {
        throw new Error(
          "GROQ_API_KEY is not configured in .env.local. Please provide a valid Groq API key to transcribe speech."
        );
      }
      transcript = await transcribeAudio(projectId, audioResult.audioPath);
      saveTranscript(transcript);
    }

    if (!transcript.text.trim()) {
      throw new Error("Transcription produced no speech text. Video audio may be silent.");
    }

    // ---------------- STAGE 4: HIGHLIGHT DETECTION ----------------
    updateProgress(projectId, "highlights", 65, "Analyzing transcript and selecting viral moments with AI...");
    saveProject({ ...updatedProject, status: "analyzing" });

    let clips = getClipsByProject(projectId);
    if (clips.length === 0) {
      const suggestions = await detectHighlights(
        transcript,
        updatedProject.duration || probe.duration
      );

      if (suggestions.length === 0) {
        throw new Error(
          "AI did not identify any viable highlights. Try adjusting clip duration or provide longer content."
        );
      }

      for (const item of suggestions) {
        const clipId = randomUUID();
        const newClip: Clip = {
          id: clipId,
          projectId,
          title: item.title,
          startTime: item.startTime,
          endTime: item.endTime,
          duration: Math.round((item.endTime - item.startTime) * 10) / 10,
          reason: item.reason,
          transcriptExcerpt: item.transcriptExcerpt,
          hook: item.hook,
          engagementScore: item.engagementScore,
          status: "suggested",
          aspectRatio: "9:16",
          captionStyle: {
            fontSize: 32,
            position: "bottom",
            primaryColor: "#FFFFFF",
            highlightColor: "#FBBF24",
            boxColor: "#000000",
            fontName: "Arial",
          },
          captionText: item.transcriptExcerpt,
          videoUrl: `/api/media/clips/${clipId}.mp4`,
          downloadUrl: `/api/download/clips/${clipId}.mp4?filename=${encodeURIComponent(
            item.title.replace(/[^a-zA-Z0-9_-]/g, "_")
          )}.mp4`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        saveClip(newClip);
      }

      clips = getClipsByProject(projectId);
    }

    // ---------------- STAGE 5: RENDER INITIAL CLIPS ----------------
    updateProgress(projectId, "render", 80, `Rendering ${clips.length} vertical 9:16 clips with animated captions...`);
    saveProject({ ...updatedProject, status: "rendering" });

    let renderedCount = 0;
    for (const clip of clips) {
      if (clip.status !== "completed") {
        try {
          const renderResult = await renderClip({
            projectId,
            clip,
            sourceVideoPath: updatedProject.originalPath,
            transcriptSegments: transcript.segments,
          });

          clip.status = "completed";
          clip.videoPath = renderResult.outputPath;
          clip.errorMessage = undefined;
          saveClip(clip);
          renderedCount++;

          const percent = Math.min(95, 80 + Math.round((renderedCount / clips.length) * 15));
          updateProgress(
            projectId,
            "render",
            percent,
            `Rendered ${renderedCount}/${clips.length} clips...`
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`Failed to render clip ${clip.id}:`, message);
          clip.status = "error";
          clip.errorMessage = message;
          saveClip(clip);
        }
      }
    }

    // ---------------- STAGE 6: READY ----------------
    updateProgress(projectId, "ready", 100, "Processing complete! All clips are ready to preview and download.");
    saveProject({
      ...updatedProject,
      status: "ready",
      clipCount: clips.length,
      errorMessage: undefined,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`Pipeline failure for project ${projectId}:`, errorMsg);

    const project = getProject(projectId);
    if (project) {
      saveProject({
        ...project,
        status: "error",
        errorMessage: errorMsg,
      });
    }

    updateProgress(projectId, "error", 0, "Processing failed", undefined, errorMsg);
  } finally {
    runningJobs.delete(projectId);
  }
}

/**
 * Triggers re-rendering for an individual clip when its captions, style, or aspect ratio changes.
 */
export async function rerenderSingleClip(clipId: string): Promise<Clip> {
  const { getClip, saveClip, getTranscript } = await import("../storage/db");
  const clip = getClip(clipId);
  if (!clip) throw new Error("Clip not found");

  const project = (await import("../storage/db")).getProject(clip.projectId);
  if (!project) throw new Error("Associated project not found");

  clip.status = "rendering";
  clip.errorMessage = undefined;
  saveClip(clip);

  try {
    const transcript = getTranscript(clip.projectId);
    const result = await renderClip({
      projectId: clip.projectId,
      clip,
      sourceVideoPath: project.originalPath,
      transcriptSegments: transcript?.segments,
    });

    clip.status = "completed";
    clip.videoPath = result.outputPath;
    clip.errorMessage = undefined;
    saveClip(clip);
    return clip;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    clip.status = "error";
    clip.errorMessage = message;
    saveClip(clip);
    throw new Error(`Rerender failed: ${message}`);
  }
}
