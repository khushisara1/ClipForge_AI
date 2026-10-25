import { NextRequest, NextResponse } from "next/server";
import { getProject, getJobStatus } from "@/lib/storage/db";
import { isJobRunning } from "@/lib/pipeline/orchestrator";


export async function GET(
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

    const job = getJobStatus(id);
    const isRunning = isJobRunning(id);

    return NextResponse.json({
      projectId: id,
      status: project.status,
      errorMessage: project.errorMessage,
      isRunning,
      job: job || {
        projectId: id,
        step: project.status,
        progress: project.status === "ready" ? 100 : 0,
        message:
          project.status === "ready"
            ? "Ready"
            : project.errorMessage || "Initialized",
        completed: project.status === "ready" || project.status === "error",
        updatedAt: project.updatedAt,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to retrieve status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
