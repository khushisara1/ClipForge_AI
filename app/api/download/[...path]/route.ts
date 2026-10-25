import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { DIRS } from "@/lib/storage/paths";


export async function GET(
  req: NextRequest,
  props: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await props.params;
    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const sanitizedSegments = pathSegments.map((s) => s.replace(/\.\./g, ""));
    const relativePath = path.join(...sanitizedSegments);
    const fullPath = path.resolve(DIRS.data, relativePath);

    const rel = path.relative(DIRS.data, fullPath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return new NextResponse("Access Denied", { status: 403 });
    }

    if (!fs.existsSync(fullPath)) {
      return new NextResponse("File not found", { status: 404 });
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Custom filename from query param or original file name
    const searchParams = req.nextUrl.searchParams;
    let customFilename = searchParams.get("filename") || path.basename(fullPath);
    // Sanitize download filename for safety
    customFilename = customFilename.replace(/[^a-zA-Z0-9_.-]/g, "_");
    if (!customFilename.toLowerCase().endsWith(".mp4")) {
      customFilename += ".mp4";
    }

    const fileStream = fs.createReadStream(fullPath);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webStream = Readable.toWeb(fileStream) as any;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Length": String(stat.size),
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${customFilename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: unknown) {
    console.error("Download route error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
