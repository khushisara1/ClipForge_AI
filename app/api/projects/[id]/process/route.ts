import { NextRequest, NextResponse } from "next/server";
import { getJobStatus, getProject } from "@/lib/storage/db";
import {
  isJobRunning,
  runProcessingPipeline,
} from "@/lib/pipeline/orchestrator";


export async function POST(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const project = getProject(id);

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (isJobRunning(id)) {
      return NextResponse.json({
        message: "Processing job is already active for this project.",
        status: project.status,
      });
    }

    const previousJob = getJobStatus(id);
    if (previousJob?.retryAfterAt && Date.parse(previousJob.retryAfterAt) > Date.now()) {
      const retryAfterSeconds = Math.ceil((Date.parse(previousJob.retryAfterAt) - Date.now()) / 1000);
      return NextResponse.json({
        error: "Groq is cooling down after a token rate limit. Please retry when the countdown ends.",
        retryAfterAt: previousJob.retryAfterAt,
        errorCategory: previousJob.errorCategory,
        errorModel: previousJob.errorModel,
      }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } });
    }

    // Trigger in background
    setTimeout(() => {
      runProcessingPipeline(id).catch((err) => {
        console.error(`Pipeline error for project ${id}:`, err);
      });
    }, 50);

    return NextResponse.json({
      success: true,
      message: "Processing started",
      projectId: id,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to trigger processing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
