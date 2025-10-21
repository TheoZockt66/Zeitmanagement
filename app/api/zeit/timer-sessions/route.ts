import { NextResponse } from "next/server";
import { TimeTrackingService } from "@/lib/services/timeTrackingService";

const UNAUTHORIZED_REGEX = /unauthorisiert|authentifizierung/i;

function resolveStatus(error: unknown): number {
  if (error instanceof Error && UNAUTHORIZED_REGEX.test(error.message)) {
    return 401;
  }
  return 500;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const service = await TimeTrackingService.fromRequest();
    const session = await service.createTimerSession(payload);
    return NextResponse.json({ data: session }, { status: 201 });
  } catch (error) {
    console.error("[Zeitmanagement] POST /api/zeit/timer-sessions failed", error);
    const status = resolveStatus(error);
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status });
  }
}
