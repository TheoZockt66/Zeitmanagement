import { NextResponse } from "next/server";
import { TimeTrackingService } from "@/lib/services/timeTrackingService";

const UNAUTHORIZED_REGEX = /unauthorisiert|authentifizierung/i;

function resolveStatus(error: unknown): number {
  if (error instanceof Error && UNAUTHORIZED_REGEX.test(error.message)) {
    return 401;
  }
  return 500;
}

export async function GET() {
  try {
    const service = await TimeTrackingService.fromRequest();
    const state = await service.fetchState();
    const stats = await service.fetchModuleStats();
    return NextResponse.json({ data: state, stats });
  } catch (error) {
    console.error("[Zeitmanagement] GET /api/zeit/state failed", error);
    const status = resolveStatus(error);
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status });
  }
}
