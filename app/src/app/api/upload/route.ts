import { NextRequest, NextResponse } from "next/server";
import { createFilebaseClient } from "@/lib/filebase";
import {
  validateSubjectContent,
  validateDisputeContent,
} from "@/lib/content-types";

// Initialize Filebase client from environment variables
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

/**
 * POST /api/upload
 * Upload subject or dispute content to IPFS via Filebase
 *
 * Body: { type: "subject" | "dispute", content: SubjectContent | DisputeContent }
 * Returns: { cid: string, url: string }
 */
export async function POST(request: NextRequest) {
  if (!filebase) {
    return NextResponse.json(
      { error: "Storage not configured. Set FILEBASE_KEY, FILEBASE_SECRET, FILEBASE_BUCKET." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { type, content } = body as { type: string; content: Record<string, unknown> };

    if (!type || !content) {
      return NextResponse.json(
        { error: "Missing type or content" },
        { status: 400 }
      );
    }

    // Validate content based on type
    if (type === "subject") {
      if (!validateSubjectContent(content)) {
        return NextResponse.json(
          { error: "Invalid subject content. Required: title, description, category, terms.text" },
          { status: 400 }
        );
      }

      const result = await filebase.uploadJSON(
        content,
        `subject-${Date.now()}`
      );

      return NextResponse.json({
        success: true,
        cid: result.cid,
        url: result.url,
        size: result.size,
      });
    }

    if (type === "dispute") {
      if (!validateDisputeContent(content)) {
        return NextResponse.json(
          { error: "Invalid dispute content. Required: title, reason, type, subjectCid, requestedOutcome, evidence" },
          { status: 400 }
        );
      }

      const result = await filebase.uploadJSON(
        content,
        `dispute-${Date.now()}`
      );

      return NextResponse.json({
        success: true,
        cid: result.cid,
        url: result.url,
        size: result.size,
      });
    }

    return NextResponse.json(
      { error: "Invalid type. Must be 'subject' or 'dispute'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload
 * Check if storage is configured
 */
export async function GET() {
  return NextResponse.json({
    configured: !!filebase,
    provider: "filebase",
  });
}
