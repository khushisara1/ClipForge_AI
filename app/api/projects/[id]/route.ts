import { NextRequest, NextResponse } from "next/server";
import {
  getProject,
  deleteProject,
  getTranscript,
  getClipsByProject,
  getJobStatus,
} from "@/lib/storage/db";


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

    const transcript = getTranscript(id);
    const clips = getClipsByProject(id);
    const jobStatus = getJobStatus(id);

    return NextResponse.json({
      project,
      transcript,
      clips,
      jobStatus,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to retrieve project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const deleted = deleteProject(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Project not found or already deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Project deleted successfully" });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to delete project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
