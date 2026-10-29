export type ProjectStatus =
  | "uploaded"
  | "validating"
  | "extracting_audio"
  | "transcribing"
  | "analyzing"
  | "rendering"
  | "ready"
  | "error";

export interface Project {
  id: string;
  name: string;
  originalFilename: string;
  originalPath: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  fileSize: number;
  status: ProjectStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  audioPath?: string;
  clipCount?: number;
}

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptSegment {
  id: number | string;
  start: number;
  end: number;
  text: string;
  words?: TranscriptWord[];
  /** Optional Whisper confidence proxy; absent when the transcription API omits it. */
  audioClarity?: number;
}

export interface Transcript {
  projectId: string;
  text: string;
  segments: TranscriptSegment[];
  language?: string;
  duration?: number;
}

export type ClipAspectRatio = "9:16" | "1:1" | "16:9";

export interface CaptionStyle {
  fontSize: number;
  position: "bottom" | "middle" | "top";
  primaryColor: string;
  highlightColor: string;
  boxColor?: string;
  fontName?: string;
}

export type ClipStatus = "suggested" | "rendering" | "completed" | "error";

export interface Clip {
  id: string;
  projectId: string;
  title: string;
  startTime: number;
  endTime: number;
  duration: number;
  reason: string;
  transcriptExcerpt: string;
  hook?: string;
  engagementScore: number; // Editorial quality estimate (1-100), not a probability
  /** AI-generated editorial assessments, not probabilities or guarantees. */
  mainIdea?: string;
  payoff?: string;
  qualityScore?: number;
  contextComplete?: boolean;
  openingStrength?: number;
  standaloneClarity?: number;
  contentValue?: number;
  narrativeCompleteness?: number;
  naturalEnding?: number;
  audioClarity?: number;
  rankingScore?: number;
  status: ClipStatus;
  videoPath?: string;
  videoUrl?: string;
  downloadUrl?: string;
  aspectRatio: ClipAspectRatio;
  captionStyle: CaptionStyle;
  captionText: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export type JobStep =
  | "upload"
  | "validate"
  | "audio"
  | "transcribe"
  | "highlights"
  | "render"
  | "ready"
  | "error";

export interface JobStatus {
  projectId: string;
  step: JobStep;
  progress: number; // 0-100
  message: string;
  details?: string;
  error?: string;
  errorCategory?: string;
  errorModel?: string;
  retryAfterAt?: string;
  updatedAt: string;
  completed: boolean;
}

export interface HighlightSuggestion {
  title: string;
  startTime: number;
  endTime: number;
  reason: string;
  transcriptExcerpt: string;
  hook: string;
  engagementScore: number;
  mainIdea: string;
  payoff: string;
  qualityScore: number;
  contextComplete: boolean;
  openingStrength: number;
  standaloneClarity: number;
  contentValue: number;
  narrativeCompleteness: number;
  naturalEnding: number;
  audioClarity?: number;
  rankingScore: number;
}
