import { NextRequest, NextResponse } from "next/server";
import { getClip, updateClip, deleteClip } from "@/lib/storage/db";


export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string; clipId: string }> }
) {
  try {
    const { clipId } = await props.params;
    const clip = getClip(clipId);

    if (!clip) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    return NextResponse.json({ clip });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to retrieve clip";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string; clipId: string }> }
) {
  try {
    const { clipId } = await props.params;
    const body = await req.json();

    const allowedFields = [
      "title",
      "captionText",
      "captionStyle",
      "aspectRatio",
      "hook",
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    const updated = updateClip(clipId, updates);
    if (!updated) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, clip: updated });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to update clip";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string; clipId: string }> }
) {
  try {
    const { clipId } = await props.params;
    const deleted = deleteClip(clipId);

    if (!deleted) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Clip deleted" });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to delete clip";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
