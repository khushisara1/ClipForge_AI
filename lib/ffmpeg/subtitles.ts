import fs from "fs";
import path from "path";
import { DIRS, ensureDirs } from "../storage/paths";
import { CaptionStyle, TranscriptSegment } from "@/types";

function formatAssTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const centis = Math.floor((s - Math.floor(s)) * 100);

  const hh = String(hours);
  const mm = String(minutes).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  const cc = String(centis).padStart(2, "0");

  return `${hh}:${mm}:${ss}.${cc}`;
}

export function hexToAssColor(hex: string, alpha: string = "00"): string {
  // Hex #RRGGBB -> ASS &HAABBGGRR
  let clean = hex.replace("#", "");
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (clean.length !== 6) {
    clean = "FFFFFF";
  }

  const r = clean.substring(0, 2);
  const g = clean.substring(2, 4);
  const b = clean.substring(4, 6);

  return `&H${alpha}${b}${g}${r}`.toUpperCase();
}

export interface SubtitleEvent {
  start: number; // relative to clip start (seconds)
  end: number;
  text: string;
}

/**
 * Builds subtitle dialogue events either from matching transcript segments
 * or splits edited captionText into readable timed phrases.
 */
export function buildSubtitleEvents(
  clipStart: number,
  clipEnd: number,
  transcriptSegments: TranscriptSegment[] | undefined,
  fallbackText: string
): SubtitleEvent[] {
  const clipDuration = clipEnd - clipStart;
  const events: SubtitleEvent[] = [];

  // 1. If we have segments overlapping the clip range, use their exact timestamps
  if (transcriptSegments && transcriptSegments.length > 0) {
    const overlapping = transcriptSegments.filter(
      (s) => s.end > clipStart && s.start < clipEnd
    );

    if (overlapping.length > 0) {
      for (const seg of overlapping) {
        const relStart = Math.max(0, seg.start - clipStart);
        const relEnd = Math.min(clipDuration, seg.end - clipStart);
        if (relEnd > relStart && seg.text.trim()) {
          events.push({
            start: relStart,
            end: relEnd,
            text: seg.text.trim(),
          });
        }
      }
    }
  }

  // 2. If no overlapping segments or events is empty, divide fallbackText into rhythmic chunks
  if (events.length === 0 && fallbackText.trim()) {
    const words = fallbackText.trim().split(/\s+/);
    const wordsPerChunk = 5;
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += wordsPerChunk) {
      chunks.push(words.slice(i, i + wordsPerChunk).join(" "));
    }

    const chunkDuration = clipDuration / chunks.length;
    chunks.forEach((chunk, index) => {
      const start = index * chunkDuration;
      const end = Math.min(clipDuration, (index + 1) * chunkDuration);
      events.push({
        start,
        end,
        text: chunk,
      });
    });
  }

  return events;
}

/**
 * Generates an ASS subtitle file and returns its absolute path.
 */
export function generateAssSubtitleFile(
  clipId: string,
  events: SubtitleEvent[],
  style: CaptionStyle,
  canvasWidth: number = 1080,
  canvasHeight: number = 1920
): string {
  ensureDirs();
  const filePath = path.join(DIRS.subtitles, `${clipId}.ass`);

  // Alignment: 2 = bottom, 5 = middle, 8 = top
  let alignment = 2;
  let marginV = 160;

  if (style.position === "middle") {
    alignment = 5;
    marginV = 20;
  } else if (style.position === "top") {
    alignment = 8;
    marginV = 180;
  }

  const primaryColour = hexToAssColor(style.primaryColor || "#FFFFFF");
  const outlineColour = "&H00000000"; // Solid black outline
  const backColour = hexToAssColor(style.boxColor || "#000000", "80");
  const fontSize = style.fontSize || 32;
  const fontName = style.fontName || "Arial";

  const lines: string[] = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${canvasWidth}`,
    `PlayResY: ${canvasHeight}`,
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,${fontName},${fontSize},${primaryColour},&H000000FF,${outlineColour},${backColour},-1,0,0,0,100,100,0,0,1,3,2,${alignment},80,80,${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  for (const ev of events) {
    const startStr = formatAssTime(ev.start);
    const endStr = formatAssTime(ev.end);
    // Sanitize ASS text: replace newlines with \N, curly braces with escaped or remove
    const sanitizedText = ev.text
      .replace(/[\r\n]+/g, "\\N")
      .replace(/\{/g, "\\{")
      .replace(/\}/g, "\\}");

    lines.push(
      `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${sanitizedText}`
    );
  }

  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
  return filePath;
}
