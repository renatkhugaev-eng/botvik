import { NextRequest, NextResponse } from "next/server";
import { sendDailyReminders } from "@/lib/notifications";

export const runtime = "nodejs";

// Maximum execution time for the cron job
export const maxDuration = 60;

/**
 * POST /api/notifications/daily
 * 
 * Trigger daily reminders for users who haven't played today.
 * Should be called by a cron job (e.g., Vercel Cron at 18:00 UTC).
 * 
 * Requires CRON_SECRET for authorization.
 */
export async function POST(req: NextRequest) {
  // ═══ UNIFIED CRON AUTH ═══
  const { requireCronAuth } = await import("@/lib/cron-auth");
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    const result = await sendDailyReminders();
    
    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Daily reminders failed:", error);
    return NextResponse.json(
      { error: "internal_error", message: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET for health check
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/notifications/daily",
    description: "Send daily play reminders",
    method: "POST",
    auth: "Bearer CRON_SECRET",
  });
}

