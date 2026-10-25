import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/storage/db";
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
