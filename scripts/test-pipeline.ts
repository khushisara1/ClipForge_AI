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
  getClipsByProject,
  updateClip,
  deleteClip,
  updateJobStatus,
  getJobStatus,
  deleteProject,
} from "../lib/storage/db";
import { getFfmpegPath } from "../lib/ffmpeg/paths";
import { probeMedia } from "../lib/ffmpeg/probe";
import { extractAudio } from "../lib/ffmpeg/audio";
import { generateAssSubtitleFile } from "../lib/ffmpeg/subtitles";
import { renderClip } from "../lib/ffmpeg/render";
import { Clip, Project, Transcript } from "../types";

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

  // Generate a legal 5-second 1080p synthetic test video with sine audio
  console.log("  Generating 5-second test video with synthetic audio & color bars...");
  execFileSync(ffmpeg, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc=duration=5:size=1280x720:rate=30",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=5",
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
  assert(probe.duration >= 4.5, `FFprobe measured accurate duration (${probe.duration.toFixed(1)}s)`);
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

  // ---------------- TEST 7: CLEANUP & INTEGRITY ----------------
  console.log("\n--- 7. Testing Project Deletion & Storage Cleanup ---");
  deleteClip(testClipId);
  assert((await import("../lib/storage/db")).getClip(testClipId) === null, "Clip deleted from database");

  deleteProject(testProjectId);
  assert(getProject(testProjectId) === null, "Project and associated files deleted");

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
