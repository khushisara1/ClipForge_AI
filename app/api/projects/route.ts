import { NextResponse } from "next/server";
import { listProjects } from "@/lib/storage/db";


export async function GET() {
  try {
    const projects = listProjects();
    return NextResponse.json({ projects });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to list projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
