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

function joinTimedWords(words: Array<{ word: string }>): string {
  let result = "";

  for (const entry of words) {
    const token = entry.word.trim();
    if (!token) continue;

    if (!result) {
      result = token;
    } else if (/^[.,!?;:%)}\]]/.test(token) || /[(\[{“‘]$/.test(result)) {
      result += token;
    } else {
      result += ` ${token}`;
    }
  }

  return result.replace(/\s+/g, " ").trim();
}

function comparableCaptionText(value: string): string {
  return value.toLocaleLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.join(" ") ?? "";
}

function transcriptTextForRange(
  segments: TranscriptSegment[],
  clipStart: number,
  clipEnd: number
): string {
  return segments
    .filter((segment) => segment.end > clipStart && segment.start < clipEnd)
    .map((segment) => {
      if (segment.words?.length) {
        const words = segment.words.filter(
          (word) => word.start >= clipStart - 0.03 && word.end <= clipEnd + 0.03
        );
        return words.length > 0 ? joinTimedWords(words) : "";
      }
      return segment.start >= clipStart - 0.03 && segment.end <= clipEnd + 0.03
        ? segment.text.trim()
        : "";
    })
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildWordTimedEvents(
  segments: TranscriptSegment[],
  clipStart: number,
  clipEnd: number
): SubtitleEvent[] {
  const events: SubtitleEvent[] = [];
  const clipDuration = clipEnd - clipStart;

  for (const segment of segments) {
    if (segment.end <= clipStart || segment.start >= clipEnd) continue;

    if (!segment.words?.length) {
      if (
        segment.start >= clipStart - 0.03 &&
        segment.end <= clipEnd + 0.03 &&
        segment.text.trim()
      ) {
        events.push({
          start: Math.max(0, segment.start - clipStart),
          end: Math.min(clipDuration, segment.end - clipStart),
          text: segment.text.trim(),
        });
      }
      continue;
    }

    const words = segment.words
      .filter(
        (word) =>
          word.start >= clipStart - 0.03 &&
          word.end <= clipEnd + 0.03 &&
          word.end > word.start
      )
      .sort((a, b) => a.start - b.start);

    let group: typeof words = [];
    const flush = () => {
      if (group.length === 0) return;
      events.push({
        start: Math.max(0, group[0].start - clipStart),
        end: Math.min(clipDuration, group[group.length - 1].end - clipStart),
        text: joinTimedWords(group),
      });
      group = [];
    };

    for (const word of words) {
      const previous = group[group.length - 1];
      const punctuationEnded = previous && /[.!?…][”’\")\]]?$/.test(previous.word.trim());
      const longPause = previous && word.start - previous.end > 0.8;
      if (group.length >= 6 || punctuationEnded || longPause) flush();
      group.push(word);
    }
    flush();
  }

  return events
    .filter((event) => event.end > event.start && event.text.length > 0)
    .sort((a, b) => a.start - b.start);
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

  // Prefer transcript timestamps only when the displayed text still matches the transcript.
  // Edited caption text uses the timed fallback below so edits are not silently ignored.
  if (transcriptSegments && transcriptSegments.length > 0) {
    const overlapping = transcriptSegments.filter(
      (s) => s.end > clipStart && s.start < clipEnd
    );
    const transcriptText = transcriptTextForRange(
      overlapping,
      clipStart,
      clipEnd
    );
    const sameAsTranscript =
      comparableCaptionText(fallbackText) === comparableCaptionText(transcriptText);

    if (overlapping.length > 0 && sameAsTranscript) {
      events.push(...buildWordTimedEvents(overlapping, clipStart, clipEnd));
      if (events.length > 0) return events;
    }
  }

  // Divide edited or otherwise unmatched caption text into readable timed phrases.
  if (fallbackText.trim()) {
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
