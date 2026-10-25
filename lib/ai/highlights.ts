import { z } from "zod";
import { HighlightSuggestion, Transcript } from "@/types";
import { getGroqConfig } from "./groq";

const HighlightSchema = z.object({
  title: z.string().min(1).max(100),
  startTime: z.number().nonnegative(),
  endTime: z.number().positive(),
  reason: z.string().min(1),
  transcriptExcerpt: z.string().min(1),
  hook: z.string().optional(),
  engagementScore: z.number().min(1).max(100).default(80),
});

const HighlightListSchema = z.object({
  highlights: z.array(HighlightSchema),
});

export async function detectHighlights(
  transcript: Transcript,
  videoDuration: number,
  options: {
    minDuration?: number;
    maxDuration?: number;
    targetClipCount?: number;
  } = {}
): Promise<HighlightSuggestion[]> {
  const { apiKey, highlightModel } = getGroqConfig();

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is missing. Please set GROQ_API_KEY in .env.local to generate AI highlight clips."
    );
  }

  const minDuration = options.minDuration ?? 15;
  const maxDuration = options.maxDuration ?? 90;
  const targetCount = options.targetClipCount ?? 5;

  // Format segments compactly for LLM prompt
  const segmentSummaries = transcript.segments.map((s) => ({
    start: s.start,
    end: s.end,
    text: s.text,
  }));

  const systemPrompt = `You are an expert podcast editor and viral video strategist for YouTube Shorts, TikTok, and Instagram Reels.
Your task is to analyze the podcast transcript and extract between 3 and ${targetCount} compelling standalone short clips.

Guidelines:
1. Look for:
   - Strong, curiosity-inducing opening hooks.
   - Surprising facts, counterintuitive perspectives, or punchy insights.
   - Complete personal stories, jokes, or emotional moments.
   - Actionable takeaways that make sense without hearing the entire episode.
2. Clip duration MUST be between ${minDuration} and ${maxDuration} seconds (endTime - startTime).
3. The timestamps MUST correspond to the provided transcript segments.
4. Total video duration is ${Math.round(videoDuration)} seconds. Do NOT exceed this.
5. Provide a clear, catchy title, an opening hook sentence, an engagement score heuristic (1-100), and the exact transcript excerpt.
6. Return ONLY a valid JSON object matching this schema:
{
  "highlights": [
    {
      "title": "Short catchy title",
      "startTime": 12.5,
      "endTime": 45.0,
      "reason": "Why this moment is engaging",
      "transcriptExcerpt": "The actual spoken words...",
      "hook": "Opening hook sentence",
      "engagementScore": 88
    }
  ]
}`;

  const userPrompt = `Here is the timestamped podcast transcript:
${JSON.stringify(segmentSummaries.slice(0, 300), null, 2)}

Identify the best 3 to ${targetCount} clips following all rules. Output JSON only.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: highlightModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq LLM highlight detection failed: ${errorBody}`);
  }

  const result = await response.json();
  const rawContent = result.choices?.[0]?.message?.content || "{}";

  // Parse JSON with sanitization of possible markdown code fences
  let parsedJson: unknown;
  try {
    const cleaned = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    parsedJson = JSON.parse(cleaned);
  } catch {
    throw new Error("Groq LLM returned non-JSON response for highlights.");
  }

  const validation = HighlightListSchema.safeParse(parsedJson);
  if (!validation.success) {
    console.error("Highlight validation errors:", validation.error.format());
    throw new Error("Highlight schema validation failed on model output.");
  }

  const rawHighlights = validation.data.highlights;

  // Validate and sanitize timestamps
  const validClips: HighlightSuggestion[] = [];
  const maxAllowedDuration = videoDuration > 0 ? videoDuration : 3600;

  for (const h of rawHighlights) {
    let start = Math.max(0, h.startTime);
    let end = Math.min(maxAllowedDuration, h.endTime);

    // If inverted, swap
    if (end < start) {
      const temp = start;
      start = end;
      end = temp;
    }

    let duration = end - start;

    // Enforce minDuration
    if (duration < minDuration) {
      end = Math.min(maxAllowedDuration, start + minDuration);
      duration = end - start;
      if (duration < 5) continue; // too short to salvage
    }

    // Enforce maxDuration
    if (duration > maxDuration) {
      end = start + maxDuration;
    }

    // Deduplicate against existing clips (avoid > 60% overlap)
    const isOverlapping = validClips.some((existing) => {
      const overlapStart = Math.max(existing.startTime, start);
      const overlapEnd = Math.min(existing.endTime, end);
      const overlapDuration = Math.max(0, overlapEnd - overlapStart);
      return overlapDuration > 0.6 * Math.min(existing.endTime - existing.startTime, duration);
    });

    if (!isOverlapping) {
      validClips.push({
        title: h.title.trim().slice(0, 80),
        startTime: Math.round(start * 10) / 10,
        endTime: Math.round(end * 10) / 10,
        reason: h.reason.trim(),
        transcriptExcerpt: h.transcriptExcerpt.trim(),
        hook: h.hook?.trim() || undefined,
        engagementScore: Math.min(100, Math.max(1, Math.round(h.engagementScore))),
      });
    }
  }

  // Sort chronologically
  validClips.sort((a, b) => a.startTime - b.startTime);

  return validClips;
}
