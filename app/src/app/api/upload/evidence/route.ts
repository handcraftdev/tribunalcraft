import { NextRequest, NextResponse } from "next/server";
import { createFilebaseClient } from "@/lib/filebase";
import { authenticateUpload } from "@/lib/upload-auth";

// Initialize Filebase client
const filebase =
  process.env.FILEBASE_KEY &&
  process.env.FILEBASE_SECRET &&
  process.env.FILEBASE_BUCKET
    ? createFilebaseClient({
        accessKey: process.env.FILEBASE_KEY,
        secretKey: process.env.FILEBASE_SECRET,
        bucket: process.env.FILEBASE_BUCKET,
      })
    : null;

// Max file size: 10MB for evidence files
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed file types for evidence
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/json",
];

/**
 * POST /api/upload/evidence
 * Upload an evidence file to IPFS
 *
 * FormData: {
 *   file: File,
 *   wallet: string,
 *   signature: string,
 *   timestamp: string (number as string)
 * }
 * Returns: { cid: string, url: string, name: string, size: number }
 */
export async function POST(request: NextRequest) {
  if (!filebase) {
    return NextResponse.json(
      { error: "Storage not configured" },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const wallet = formData.get("wallet") as string | null;
    const signature = formData.get("signature") as string | null;
    const timestampStr = formData.get("timestamp") as string | null;

    // Require authentication
    if (!wallet || !signature || !timestampStr) {
      return NextResponse.json(
        { error: "Authentication required. Provide wallet, signature, and timestamp." },
        { status: 401 }
      );
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      return NextResponse.json(
        { error: "Invalid timestamp" },
        { status: 400 }
      );
    }

    // Verify signature and check rate limit
    const authResult = authenticateUpload(wallet, signature, timestamp);
    if (!authResult.authenticated) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.error?.includes("Rate limit") ? 429 : 401 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed. Allowed types: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await filebase.upload(buffer, file.name, file.type);

    return NextResponse.json({
      success: true,
      cid: result.cid,
      url: result.url,
      name: file.name,
      size: result.size,
      type: file.type,
    });
  } catch (error) {
    console.error("Evidence upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
