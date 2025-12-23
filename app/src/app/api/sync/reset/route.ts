import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/client";

/**
 * Reset endpoint - truncates all tables to start fresh
 * Protected by admin secret
 */
export async function POST(request: NextRequest) {
  // Check for admin secret
  const authHeader = request.headers.get("authorization");
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let supabase;
    try {
      supabase = createServerClient();
    } catch {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    // Truncate all tables in the correct order (to handle foreign key constraints)
    const tables = [
      "program_events",
      "juror_records",
      "challenger_records",
      "defender_records",
      "disputes",
      "escrows",
      "subjects",
      "juror_pools",
      "challenger_pools",
      "defender_pools",
    ];

    const results: Record<string, { success: boolean; error?: string }> = {};

    for (const table of tables) {
      const { error } = await (supabase as any)
        .from(table)
        .delete()
        .neq("id", ""); // Delete all rows

      if (error) {
        results[table] = { success: false, error: error.message };
      } else {
        results[table] = { success: true };
      }
    }

    const allSuccess = Object.values(results).every(r => r.success);

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess ? "All tables reset" : "Some tables failed to reset",
      results,
    });
  } catch (error) {
    console.error("Reset error:", error);
    return NextResponse.json(
      { error: "Reset failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
