import { NextRequest, NextResponse } from "next/server";
import { getClip, updateClip } from "@/lib/storage/db";
import { rerenderSingleClip } from "@/lib/pipeline/orchestrator";


export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string; clipId: string }> }
) {
  try {
    const { clipId } = await props.params;
    const clip = getClip(clipId);

    if (!clip) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }

    // Optional updates sent in body before rendering
    try {
      const body = await req.json();
      if (body.captionText !== undefined || body.captionStyle !== undefined || body.aspectRatio !== undefined) {
        updateClip(clipId, {
          ...(body.captionText !== undefined && { captionText: body.captionText }),
          ...(body.captionStyle !== undefined && { captionStyle: body.captionStyle }),
          ...(body.aspectRatio !== undefined && { aspectRatio: body.aspectRatio }),
          ...(body.title !== undefined && { title: body.title }),
        });
      }
    } catch {
      // Body is optional
    }

    const updatedClip = await rerenderSingleClip(clipId);

    return NextResponse.json({
      success: true,
      message: "Clip re-rendered successfully",
      clip: updatedClip,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Clip re-render failed";
    console.error("Rerender error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
