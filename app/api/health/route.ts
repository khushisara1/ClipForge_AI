import { NextResponse } from "next/server";
import fs from "fs";
import { checkFfmpegAvailable } from "@/lib/ffmpeg/paths";
import { getGroqConfig, isGroqConfigured } from "@/lib/ai/groq";
import { DIRS, ensureDirs } from "@/lib/storage/paths";


export async function GET() {
  ensureDirs();

  const ffmpegCheck = checkFfmpegAvailable();
  const groqConfig = getGroqConfig();
  const groqConfigured = isGroqConfigured();

  // Test storage write access
  let storageWritable = false;
  try {
    const testFile = `${DIRS.temp}/test_${Date.now()}.tmp`;
    fs.writeFileSync(testFile, "ok", "utf-8");
    fs.unlinkSync(testFile);
    storageWritable = true;
  } catch {
    storageWritable = false;
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    ffmpeg: {
      available: ffmpegCheck.available,
      ffmpegPath: ffmpegCheck.ffmpeg,
      ffprobePath: ffmpegCheck.ffprobe,
      error: ffmpegCheck.error,
    },
    ai: {
      groqConfigured,
      transcriptionModel: groqConfig.transcriptionModel,
      highlightModel: groqConfig.highlightModel,
      note: groqConfigured
        ? "Groq API key is active."
        : "GROQ_API_KEY is not set. Add it in .env.local to enable speech-to-text and AI highlights.",
    },
    storage: {
      dataDir: DIRS.data,
      writable: storageWritable,
      maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB || "500", 10),
    },
  });
}

export async function POST(req: Request) {
  try {
    const { groqApiKey } = await req.json();
    if (!groqApiKey || typeof groqApiKey !== "string") {
      return NextResponse.json({ error: "Invalid API key provided" }, { status: 400 });
    }

    const cleanKey = groqApiKey.trim();
    process.env.GROQ_API_KEY = cleanKey;

    // Update or append in .env.local
    const envLocalPath = `${process.cwd()}/.env.local`;
    let currentContent = "";
    if (fs.existsSync(envLocalPath)) {
      currentContent = fs.readFileSync(envLocalPath, "utf-8");
    }

    if (currentContent.includes("GROQ_API_KEY=")) {
      currentContent = currentContent.replace(/GROQ_API_KEY=.*/g, `GROQ_API_KEY=${cleanKey}`);
    } else {
      currentContent += `\nGROQ_API_KEY=${cleanKey}\n`;
    }

    fs.writeFileSync(envLocalPath, currentContent, "utf-8");

    return NextResponse.json({
      success: true,
      message: "Groq API key saved successfully.",
      groqConfigured: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update API key";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

