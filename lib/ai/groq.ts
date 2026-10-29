import fs from "fs";
import path from "path";
import { Transcript, TranscriptSegment } from "@/types";
import { splitAudioIfNeeded } from "../ffmpeg/audio";

export interface GroqConfig {
  apiKey: string;
  transcriptionModel: string;
  highlightModel: string;
}

export function getGroqConfig(): GroqConfig {
  const apiKey = process.env.GROQ_API_KEY?.trim() || "";
  const transcriptionModel =
    process.env.TRANSCRIPTION_MODEL?.trim() || "whisper-large-v3";
  const highlightModel =
    process.env.HIGHLIGHT_MODEL?.trim() || "llama3-70b-8192";

  return { apiKey, transcriptionModel, highlightModel };
}

export function isGroqConfigured(): boolean {
  const { apiKey } = getGroqConfig();
  return Boolean(apiKey && apiKey.length > 5);
}

interface GroqWhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: Array<{ word: string; start: number; end: number }>;
  avg_logprob?: number;
  no_speech_prob?: number;
}

interface GroqWhisperResponse {
  text: string;
  segments?: GroqWhisperSegment[];
  language?: string;
  duration?: number;
}

/**
 * Transcribes an audio file using Groq's Whisper API.
 * Automatically segments audio if exceeding Groq's 25MB request limit.
 */
export async function transcribeAudio(
  projectId: string,
  audioPath: string
): Promise<Transcript> {
  const { apiKey, transcriptionModel } = getGroqConfig();

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not configured. Please add your key to .env.local to enable speech transcription."
    );
  }

  // Split audio if over 24MB
  const audioChunks = await splitAudioIfNeeded(audioPath, 900);

  const allSegments: TranscriptSegment[] = [];
  const fullTextParts: string[] = [];
  let detectedLanguage = "en";
  let totalDuration = 0;
  let segmentCounter = 0;

  for (const { chunkPath, offsetSeconds } of audioChunks) {
    const fileBuffer = fs.readFileSync(chunkPath);
    const blob = new Blob([fileBuffer], { type: "audio/mpeg" });

    const formData = new FormData();
    formData.append("file", blob, path.basename(chunkPath));
    formData.append("model", transcriptionModel);
    formData.append("response_format", "verbose_json");
    formData.append("temperature", "0");

    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      let errorDetail = "";
      try {
        const errorJson = await response.json();
        errorDetail = errorJson?.error?.message || JSON.stringify(errorJson);
      } catch {
        errorDetail = await response.text();
      }

      if (response.status === 401) {
        throw new Error(
          "Invalid Groq API key. Please check your GROQ_API_KEY in .env.local."
        );
      } else if (response.status === 429) {
        throw new Error(
          "Groq rate limit exceeded. Please wait a moment before retrying."
        );
      }

      throw new Error(`Groq Whisper transcription failed: ${errorDetail}`);
    }

    const data = (await response.json()) as GroqWhisperResponse;

    if (data.language) detectedLanguage = data.language;
    if (data.text) fullTextParts.push(data.text);
    if (data.duration) totalDuration += data.duration;

    if (data.segments && Array.isArray(data.segments)) {
      for (const seg of data.segments) {
        const adjustedStart = Math.round((seg.start + offsetSeconds) * 100) / 100;
        const adjustedEnd = Math.round((seg.end + offsetSeconds) * 100) / 100;
        const confidence =
          typeof seg.avg_logprob === "number"
            ? Math.exp(Math.min(0, seg.avg_logprob)) * 100
            : undefined;
        const speechProbability =
          typeof seg.no_speech_prob === "number"
            ? Math.min(1, Math.max(0, seg.no_speech_prob))
            : undefined;
        const audioClarity =
          confidence !== undefined
            ? Math.round(
                confidence * (speechProbability === undefined ? 1 : 1 - speechProbability)
              )
            : speechProbability === undefined
              ? undefined
              : Math.round((1 - speechProbability) * 100);

        allSegments.push({
          id: segmentCounter++,
          start: adjustedStart,
          end: adjustedEnd,
          text: seg.text.trim(),
          ...(audioClarity !== undefined && { audioClarity }),
          words: seg.words?.map((w) => ({
            word: w.word,
            start: Math.round((w.start + offsetSeconds) * 100) / 100,
            end: Math.round((w.end + offsetSeconds) * 100) / 100,
          })),
        });
      }
    }

    // Clean up temporary split chunk if it was created
    if (chunkPath !== audioPath && fs.existsSync(chunkPath)) {
      try {
        fs.unlinkSync(chunkPath);
      } catch {}
    }
  }

  // If no granular segments were returned, fallback to full text
  if (allSegments.length === 0 && fullTextParts.length > 0) {
    allSegments.push({
      id: 0,
      start: 0,
      end: totalDuration || 60,
      text: fullTextParts.join(" ").trim(),
    });
  }

  return {
    projectId,
    text: fullTextParts.join(" \n\n ").trim(),
    segments: allSegments,
    language: detectedLanguage,
    duration: totalDuration,
  };
}
