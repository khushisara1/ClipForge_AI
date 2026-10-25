import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { DIRS } from "@/lib/storage/paths";


const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
};

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await props.params;
    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Disallow traversal attempts
    const sanitizedSegments = pathSegments.map((s) => s.replace(/\.\./g, ""));
    const relativePath = path.join(...sanitizedSegments);
    const fullPath = path.resolve(DIRS.data, relativePath);

    // Verify file stays strictly inside DIRS.data
    const rel = path.relative(DIRS.data, fullPath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return new NextResponse("Access Denied", { status: 403 });
    }

    if (!fs.existsSync(fullPath)) {
      return new NextResponse("Media file not found", { status: 404 });
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const fileSize = stat.size;
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const range = req.headers.get("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${fileSize}`,
          },
        });
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(fullPath, { start, end });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const webStream = Readable.toWeb(fileStream) as any;

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // Full file stream
    const fileStream = fs.createReadStream(fullPath);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webStream = Readable.toWeb(fileStream) as any;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Length": String(fileSize),
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error: unknown) {
    console.error("Media stream error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
