import { NextResponse } from "next/server";
import { TimeTrackingService } from "@/lib/services/timeTrackingService";

const UNAUTHORIZED_REGEX = /unauthorisiert|authentifizierung/i;

function resolveStatus(error: unknown): number {
  if (error instanceof Error && UNAUTHORIZED_REGEX.test(error.message)) {
    return 401;
  }
  return 500;
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json();
    const service = await TimeTrackingService.fromRequest();
    const profile = await service.upsertProfile(payload);
    return NextResponse.json({ data: profile });
  } catch (error) {
    console.error("[Zeitmanagement] PATCH /api/zeit/profile failed", error);
    const status = resolveStatus(error);
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status });
  }
}
