import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { DIRS, ensureDirs, resolveSafeDataPath } from "../lib/storage/paths";
import {
  saveProject,
  getProject,
  listProjects,
  saveTranscript,
  getTranscript,
  saveClip,
  updateClip,
  deleteClip,
  updateJobStatus,
  getJobStatus,
  getClipsByProject,
  deleteProject,
} from "../lib/storage/db";
import { POST as uploadPodcast } from "../app/api/upload/route";
import { GET as downloadClip } from "../app/api/download/[...path]/route";
import { NextRequest } from "next/server";
import { getFfmpegPath } from "../lib/ffmpeg/paths";
import { probeMedia } from "../lib/ffmpeg/probe";
import { extractAudio } from "../lib/ffmpeg/audio";
import { buildSubtitleEvents, generateAssSubtitleFile } from "../lib/ffmpeg/subtitles";
import { renderClip } from "../lib/ffmpeg/render";
import {
  buildTranscriptWindows,
  rankHighlights,
  snapTranscriptBoundaries,
  requestGroqJson,
  GroqRateLimitError,
} from "../lib/ai/highlights";
import { Clip, HighlightSuggestion, Project, Transcript, TranscriptSegment } from "../types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${message}`);
    passedCount++;
  } else {
    console.error(`  \x1b[31m✖ FAIL:\x1b[0m ${message}`);
    failedCount++;
  }
}

async function runTestSuite() {
  console.log("\n=======================================================");
  console.log("  PODCAST-TO-CLIPS AUTOMATED PIPELINE & SECURITY TESTS");
  console.log("=======================================================\n");

  ensureDirs();

  // ---------------- HIGHLIGHT QUALITY & TIMING ----------------
  console.log("--- 0. Testing Highlight Validation, Ranking & Word Timing ---");
  const wordTimedSegment: TranscriptSegment = {
    id: 0,
    start: 10,
    end: 20,
    text: "We need to finish this thought.",
    words: [
      { word: " We", start: 10, end: 10.3 },
      { word: " need", start: 10.4, end: 10.7 },
      { word: " to", start: 10.8, end: 11 },
      { word: " finish", start: 11.1, end: 11.6 },
      { word: " this", start: 11.7, end: 12 },
      { word: " thought.", start: 12.1, end: 12.8 },
    ],
  };
  const snappedBoundaries = snapTranscriptBoundaries(
    10.4,
    12.6,
    [wordTimedSegment],
    30
  );
  assert(
    snappedBoundaries?.startTime === 10.4 && snappedBoundaries.endTime === 12.8,
    "Snaps candidate timestamps to actual word boundaries"
  );
  assert(
    snapTranscriptBoundaries(14, 16, [wordTimedSegment], 30) === null,
    "Rejects candidate timestamps that are not near transcript boundaries"
  );

  const windowSegments: TranscriptSegment[] = Array.from({ length: 7 }, (_, index) => ({
    id: index,
    start: index,
    end: index + 1,
    text: `Transcript sentence ${index}.`,
  }));
  const windows = buildTranscriptWindows(windowSegments, 3, 100, 1);
  assert(
    windows.length > 1 &&
      windows.flatMap((window) => window.segments).length >= windowSegments.length &&
      windows[0].segments[windows[0].segments.length - 1].id === windows[1].segments[0].id,
    "Analyzes all transcript segments with overlap for context"
  );
  const charLimitedWindows = buildTranscriptWindows(
    windowSegments.map((segment) => ({ ...segment, text: "x".repeat(30) })),
    10,
    100,
    1,
    60
  );
  assert(
    charLimitedWindows.every((window) => window.segments.reduce((size, segment) => size + segment.text.length, 0) <= 60),
    "Keeps transcript requests under a configurable character budget"
  );

  // ---------------- MOCKED GROQ API HANDLING ----------------
  console.log("--- 0b. Testing Groq token budget, retry, and output validation ---");
  const originalFetch = globalThis.fetch;
  const savedEnv = {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.HIGHLIGHT_MODEL,
    retries: process.env.GROQ_429_MAX_RETRIES,
    tokenLimit: process.env.GROQ_TOKENS_PER_MINUTE,
    concurrency: process.env.GROQ_MAX_CONCURRENT_REQUESTS,
  };
  process.env.GROQ_API_KEY = "mock-key-for-tests";
  process.env.HIGHLIGHT_MODEL = "openai/gpt-oss-120b";
  process.env.GROQ_429_MAX_RETRIES = "1";
  process.env.GROQ_TOKENS_PER_MINUTE = "10000";
  process.env.GROQ_MAX_CONCURRENT_REQUESTS = "1";
  let groqCalls = 0;
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    groqCalls += 1;
    requestBody = JSON.parse(String(init?.body));
    if (groqCalls === 1) {
      return new Response(JSON.stringify({ error: { message: "throttled" } }), {
        status: 429,
        headers: { "retry-after": "0" },
      });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ highlights: [] }) } }] }), { status: 200 });
  };
  try {
    const mockedResult = await requestGroqJson("small system prompt", "small transcript");
    assert(groqCalls === 2, "Retries a mocked 429 once and succeeds without a live Groq call");
    assert(requestBody.max_completion_tokens === 900, "Sends a bounded completion-token budget");
    assert(JSON.stringify(mockedResult) === JSON.stringify({ highlights: [] }), "Parses the mocked structured JSON response");

    let activeMockCalls = 0;
    let peakMockCalls = 0;
    globalThis.fetch = async () => {
      activeMockCalls += 1;
      peakMockCalls = Math.max(peakMockCalls, activeMockCalls);
      await new Promise((resolve) => setTimeout(resolve, 20));
      activeMockCalls -= 1;
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ highlights: [] }) } }] }), { status: 200 });
    };
    await Promise.all([
      requestGroqJson("system", "transcript one"),
      requestGroqJson("system", "transcript two"),
    ]);
    assert(peakMockCalls === 1, "Keeps concurrent project requests within the configured limit");

    process.env.GROQ_429_MAX_RETRIES = "0";
    globalThis.fetch = async () => new Response("{}", { status: 429, headers: { "retry-after": "2" } });
    let cooldownError: unknown;
    try {
      await requestGroqJson("system", "transcript");
    } catch (error) {
      cooldownError = error;
    }
    assert(cooldownError instanceof GroqRateLimitError && cooldownError.retryAfterMs === 2000, "Preserves the provider Retry-After delay after bounded retries");

    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }), { status: 200 });
    let invalidOutputRejected = false;
    try {
      await requestGroqJson("system", "transcript");
    } catch {
      invalidOutputRejected = true;
    }
    assert(invalidOutputRejected, "Rejects invalid LLM JSON before it reaches rendering");
  } finally {
    globalThis.fetch = originalFetch;
    if (savedEnv.apiKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = savedEnv.apiKey;
    if (savedEnv.model === undefined) delete process.env.HIGHLIGHT_MODEL; else process.env.HIGHLIGHT_MODEL = savedEnv.model;
    if (savedEnv.retries === undefined) delete process.env.GROQ_429_MAX_RETRIES; else process.env.GROQ_429_MAX_RETRIES = savedEnv.retries;
    if (savedEnv.tokenLimit === undefined) delete process.env.GROQ_TOKENS_PER_MINUTE; else process.env.GROQ_TOKENS_PER_MINUTE = savedEnv.tokenLimit;
    if (savedEnv.concurrency === undefined) delete process.env.GROQ_MAX_CONCURRENT_REQUESTS; else process.env.GROQ_MAX_CONCURRENT_REQUESTS = savedEnv.concurrency;
  }

  const createSuggestion = (
    title: string,
    startTime: number,
    endTime: number,
    transcriptExcerpt: string,
    qualityScore: number
  ): HighlightSuggestion => ({
    title,
    startTime,
    endTime,
    reason: "Complete example for ranking.",
    transcriptExcerpt,
    hook: transcriptExcerpt.split(" ").slice(0, 3).join(" "),
    engagementScore: qualityScore,
    mainIdea: "A complete point",
    payoff: "The idea resolves",
    qualityScore,
    contextComplete: true,
    openingStrength: qualityScore,
    standaloneClarity: qualityScore,
    contentValue: qualityScore,
    narrativeCompleteness: qualityScore,
    naturalEnding: qualityScore,
    rankingScore: qualityScore,
  });
  const ranked = rankHighlights(
    [
      createSuggestion("Strong first", 10, 30, "A useful story about learning from mistakes.", 96),
      createSuggestion("Duplicate", 12, 32, "A useful story about learning from mistakes.", 90),
      createSuggestion("Distinct second", 50, 70, "Why asking better questions changes the outcome.", 82),
    ],
    2
  );
  assert(
    ranked.length === 2 &&
      ranked[0].title === "Strong first" &&
      ranked[1].title === "Distinct second",
    "Ranks quality and filters redundant candidate clips"
  );

  const wordCaptionEvents = buildSubtitleEvents(
    10,
    13,
    [wordTimedSegment],
    "We need to finish this thought."
  );
  assert(
    wordCaptionEvents.length === 1 &&
      wordCaptionEvents[0].start === 0 &&
      Math.abs(wordCaptionEvents[0].end - 2.8) < 0.001 &&
      wordCaptionEvents[0].text === "We need to finish this thought.",
    "Uses word timestamps and clip-relative offsets for synchronized captions"
  );

  // ---------------- TEST 1: PATH SECURITY ----------------
  console.log("--- 1. Testing File-Path Security & Traversal Prevention ---");
  try {
    const safePath = resolveSafeDataPath("uploads", "test-video.mp4");
    assert(
      safePath.includes(path.join("data", "uploads")),
      "Resolves legitimate file inside data/uploads"
    );

    let trapped = false;
    try {
      resolveSafeDataPath("uploads", "../../etc/passwd");
    } catch {
      trapped = true;
    }
    assert(trapped, "Blocks directory traversal (../../etc/passwd)");

    trapped = false;
    try {
      resolveSafeDataPath("uploads", "file\0nullbyte.mp4");
    } catch {
      trapped = true;
    }
    assert(trapped, "Blocks null byte injections");
  } catch (err) {
    assert(false, `Path security threw unexpected error: ${err}`);
  }

  // ---------------- TEST 2: DATABASE PERSISTENCE & CRUD ----------------
  console.log("\n--- 2. Testing Database Persistence & Metadata Models ---");
  const testProjectId = "test-proj-" + Date.now();
  const testProject: Project = {
    id: testProjectId,
    name: "Automated Test Podcast Episode",
    originalFilename: "sample_recording.mp4",
    originalPath: path.join(DIRS.uploads, "sample_recording.mp4"),
    duration: 120,
    width: 1920,
    height: 1080,
    fps: 30,
    fileSize: 1024 * 1024 * 15,
    status: "uploaded",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveProject(testProject);
  const fetchedProj = getProject(testProjectId);
  assert(
    fetchedProj !== null && fetchedProj.name === testProject.name,
    "Successfully persists and retrieves Project record"
  );

  const allProjects = listProjects();
  assert(
    allProjects.some((p) => p.id === testProjectId),
    "Projects list contains newly added project"
  );

  // Transcript persistence
  const testTranscript: Transcript = {
    projectId: testProjectId,
    text: "Welcome to this episode where we discuss artificial intelligence and engineering excellence.",
    segments: [
      {
        id: 0,
        start: 0,
        end: 5,
        text: "Welcome to this episode.",
      },
      {
        id: 1,
        start: 5.5,
        end: 15,
        text: "where we discuss artificial intelligence and engineering excellence.",
      },
    ],
    language: "en",
  };
  saveTranscript(testTranscript);
  const fetchedTranscript = getTranscript(testProjectId);
  assert(
    fetchedTranscript !== null && fetchedTranscript.segments.length === 2,
    "Persists and retrieves timestamped transcript"
  );

  // Clip persistence
  const testClipId = "test-clip-" + Date.now();
  const testClip: Clip = {
    id: testClipId,
    projectId: testProjectId,
    title: "AI and Engineering Excellence",
    startTime: 5.5,
    endTime: 15.0,
    duration: 9.5,
    reason: "Strong hook on AI engineering",
    transcriptExcerpt: "where we discuss artificial intelligence and engineering excellence.",
    hook: "This changes software development forever.",
    engagementScore: 92,
    status: "suggested",
    aspectRatio: "9:16",
    captionStyle: {
      fontSize: 32,
      position: "bottom",
      primaryColor: "#FFFFFF",
      highlightColor: "#FBBF24",
    },
    captionText: "where we discuss artificial intelligence and engineering excellence.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveClip(testClip);
  let fetchedClip = (await import("../lib/storage/db")).getClip(testClipId);
  assert(
    fetchedClip !== null && fetchedClip.title === testClip.title,
    "Persists and retrieves Clip metadata"
  );

  updateClip(testClipId, { title: "Updated Clip Title" });
  fetchedClip = (await import("../lib/storage/db")).getClip(testClipId);
  assert(
    fetchedClip?.title === "Updated Clip Title",
    "Updates clip title successfully"
  );

  // Job status
  updateJobStatus({
    projectId: testProjectId,
    step: "render",
    progress: 75,
    message: "Rendering test clips...",
    updatedAt: new Date().toISOString(),
    completed: false,
  });
  const fetchedJob = getJobStatus(testProjectId);
  assert(
    fetchedJob !== null && fetchedJob.progress === 75,
    "Updates and retrieves real-time job progress"
  );

  // ---------------- TEST 3: REAL MEDIA GENERATION & PROBE ----------------
  console.log("\n--- 3. Testing FFmpeg/FFprobe Media Inspection & Probe ---");
  const ffmpeg = getFfmpegPath();
  const sampleVideoPath = path.join(DIRS.temp, `synthetic_test_${Date.now()}.mp4`);

  // Generate a legal 25-second 1080p synthetic test video with sine audio
  console.log("  Generating 25-second test video with synthetic audio & color bars...");
  execFileSync(ffmpeg, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc=duration=25:size=1280x720:rate=30",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=25",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-c:a",
    "aac",
    sampleVideoPath,
  ]);

  assert(fs.existsSync(sampleVideoPath), "Created synthetic test video file");

  const probe = await probeMedia(sampleVideoPath);
  assert(probe.hasVideo && probe.hasAudio, "FFprobe detected valid video and audio streams");
  assert(probe.duration >= 24.5, `FFprobe measured accurate duration (${probe.duration.toFixed(1)}s)`);
  assert(probe.width === 1280 && probe.height === 720, `FFprobe detected resolution (${probe.width}x${probe.height})`);

  // ---------------- TEST 4: AUDIO EXTRACTION ----------------
  console.log("\n--- 4. Testing Audio Extraction for Whisper STT ---");
  const audioResult = await extractAudio(testProjectId, sampleVideoPath);
  assert(fs.existsSync(audioResult.audioPath), "Extracted audio file to disk");
  assert(audioResult.sizeBytes > 1000, `Extracted audio has valid size (${audioResult.sizeBytes} bytes)`);

  // ---------------- TEST 5: ASS SUBTITLE GENERATION ----------------
  console.log("\n--- 5. Testing ASS Subtitle Styling & Escaping ---");
  const assPath = generateAssSubtitleFile(
    testClipId,
    [
      { start: 0.5, end: 2.5, text: "Artificial Intelligence" },
      { start: 2.6, end: 4.8, text: "Engineering Excellence" },
    ],
    {
      fontSize: 34,
      position: "bottom",
      primaryColor: "#FACC15", // yellow
      highlightColor: "#FFFFFF",
    },
    1080,
    1920
  );
  assert(fs.existsSync(assPath), "Generated ASS subtitle file");
  const assContent = fs.readFileSync(assPath, "utf-8");
  assert(
    assContent.includes("PlayResX: 1080") && assContent.includes("Dialogue: 0,"),
    "ASS subtitle file contains correct 9:16 layout headers and dialogue entries"
  );

  // ---------------- TEST 6: REAL 9:16 CLIP RENDERING ----------------
  console.log("\n--- 6. Testing Real Vertical 9:16 Clip Rendering with Captions ---");
  const renderClipObj: Clip = {
    ...testClip,
    id: `render-test-${Date.now()}`,
    startTime: 0.5,
    endTime: 4.5,
    duration: 4.0,
    aspectRatio: "9:16",
    captionText: "Artificial Intelligence & Engineering Excellence",
  };

  const renderResult = await renderClip({
    projectId: testProjectId,
    clip: renderClipObj,
    sourceVideoPath: sampleVideoPath,
  });

  assert(fs.existsSync(renderResult.outputPath), "Rendered finished vertical video to disk");
  assert(renderResult.sizeBytes > 10000, `Rendered file has valid video size (${renderResult.sizeBytes} bytes)`);

  // Probe the rendered output to verify vertical framing
  const renderedProbe = await probeMedia(renderResult.outputPath);
  assert(
    renderedProbe.width === 1080 && renderedProbe.height === 1920,
    `Rendered clip has true 9:16 vertical resolution (${renderedProbe.width}x${renderedProbe.height})`
  );

  // ---------------- MOCKED UPLOAD-TO-DOWNLOAD WORKFLOW ----------------
  console.log("\n--- 6b. Testing upload, mocked AI processing, rendering, and download routes ---");
  const workflowOriginalFetch = globalThis.fetch;
  const workflowSavedEnv = {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.HIGHLIGHT_MODEL,
    tokenLimit: process.env.GROQ_TOKENS_PER_MINUTE,
  };
  let workflowProjectId: string | null = null;
  process.env.GROQ_API_KEY = "mock-workflow-key";
  process.env.HIGHLIGHT_MODEL = "openai/gpt-oss-120b";
  process.env.GROQ_TOKENS_PER_MINUTE = "12000";
  const transcriptSegments = [
    { id: 0, start: 0, end: 5, text: "Most people wait for the perfect plan." },
    { id: 1, start: 5, end: 10, text: "But progress comes from starting small." },
    { id: 2, start: 10, end: 15, text: "Choose one task and do it for ten minutes." },
    { id: 3, start: 15, end: 20, text: "That small action builds momentum." },
    { id: 4, start: 20, end: 25, text: "You can decide the next step after that." },
  ];
  const mockedCandidate = {
    start_time: 0,
    end_time: 20,
    hook: "Most people wait for the perfect plan.",
    main_idea: "Start with a small, manageable action.",
    payoff: "A small action creates momentum and makes the next step easier to choose.",
    suggested_title: "Start Before You Feel Ready",
    reason: "A clear, actionable idea with a complete explanation and payoff.",
    quality_score: 92,
    context_complete: true,
    opening_strength: 90,
    standalone_clarity: 94,
    content_value: 91,
    narrative_completeness: 92,
    natural_ending: 91,
  };
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/audio/transcriptions")) {
      return new Response(JSON.stringify({
        text: transcriptSegments.map((segment) => segment.text).join(" "),
        segments: transcriptSegments,
        duration: 25,
        language: "en",
      }), { status: 200 });
    }
    if (url.includes("/chat/completions")) {
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ highlights: [mockedCandidate] }) } }] }), { status: 200 });
    }
    throw new Error(`Unexpected network request in mocked integration test: ${url}`);
  };
  try {
    const formData = new FormData();
    const uploadedBytes = new Uint8Array(fs.readFileSync(sampleVideoPath));
    formData.append("file", new File([uploadedBytes as unknown as BlobPart], "workflow-sample.mp4", { type: "video/mp4" }));
    formData.append("title", "Mocked Upload Workflow");
    formData.append("autoProcess", "true");
    const uploadResponse = await uploadPodcast(new NextRequest("http://localhost/api/upload", { method: "POST", body: formData }));
    const uploadData = await uploadResponse.json();
    workflowProjectId = uploadData.project?.id || null;
    assert(uploadResponse.status === 200 && Boolean(workflowProjectId), "Accepts a supported upload through the real upload route");

    const waitUntil = Date.now() + 45_000;
    let workflowProject = workflowProjectId ? getProject(workflowProjectId) : null;
    while (workflowProject && workflowProject.status !== "ready" && workflowProject.status !== "error" && Date.now() < waitUntil) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      workflowProject = getProject(workflowProjectId!);
    }
    assert(workflowProject?.status === "ready", `Completes transcription, highlight selection, and FFmpeg rendering${workflowProject?.errorMessage ? ` (${workflowProject.errorMessage})` : ""}`);

    const workflowClips = workflowProjectId ? getClipsByProject(workflowProjectId) : [];
    const completedClip = workflowClips.find((clip) => clip.status === "completed" && clip.videoPath);
    assert(Boolean(completedClip), "Persists a rendered clip with a download path");
    if (completedClip) {
      const downloadResponse = await downloadClip(
        new NextRequest(`http://localhost/api/download/clips/${completedClip.id}.mp4?filename=workflow-test.mp4`),
        { params: Promise.resolve({ path: ["clips", `${completedClip.id}.mp4`] }) }
      );
      const downloadedBytes = await downloadResponse.arrayBuffer();
      assert(downloadResponse.status === 200 && downloadedBytes.byteLength > 10_000 && Boolean(downloadResponse.headers.get("content-disposition")?.includes("workflow-test.mp4")), "Serves the rendered MP4 through the real download route");
    }
  } finally {
    globalThis.fetch = workflowOriginalFetch;
    if (workflowSavedEnv.apiKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = workflowSavedEnv.apiKey;
    if (workflowSavedEnv.model === undefined) delete process.env.HIGHLIGHT_MODEL; else process.env.HIGHLIGHT_MODEL = workflowSavedEnv.model;
    if (workflowSavedEnv.tokenLimit === undefined) delete process.env.GROQ_TOKENS_PER_MINUTE; else process.env.GROQ_TOKENS_PER_MINUTE = workflowSavedEnv.tokenLimit;
  }

  // ---------------- TEST 7: CLEANUP & INTEGRITY ----------------
  console.log("\n--- 7. Testing Project Deletion & Storage Cleanup ---");
  deleteClip(testClipId);
  assert((await import("../lib/storage/db")).getClip(testClipId) === null, "Clip deleted from database");

  deleteProject(testProjectId);
  assert(getProject(testProjectId) === null, "Project and associated files deleted");

  if (workflowProjectId) {
    deleteProject(workflowProjectId);
    assert(getProject(workflowProjectId) === null, "Mocked upload workflow data and generated media are cleaned up");
  }

  // Clean up synthetic source video
  try {
    fs.unlinkSync(sampleVideoPath);
    if (fs.existsSync(renderResult.outputPath)) {
      fs.unlinkSync(renderResult.outputPath);
    }
  } catch {}

  console.log("\n=======================================================");
  console.log(`  TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
