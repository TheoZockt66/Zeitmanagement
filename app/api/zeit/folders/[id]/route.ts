import { NextResponse } from "next/server";
import { TimeTrackingService } from "@/lib/services/timeTrackingService";

const UNAUTHORIZED_REGEX = /unauthorisiert|authentifizierung/i;

function resolveStatus(error: unknown): number {
  if (error instanceof Error && UNAUTHORIZED_REGEX.test(error.message)) {
    return 401;
  }
  return 500;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await request.json();
    const service = await TimeTrackingService.fromRequest();
    const { id } = await params;
    const folder = await service.updateFolder(id, payload);
    return NextResponse.json({ data: folder });
  } catch (error) {
    console.error("[Zeitmanagement] PATCH /api/zeit/folders/[id] failed", error);
    const status = resolveStatus(error);
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const service = await TimeTrackingService.fromRequest();
    const { id } = await params;
    await service.deleteFolder(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Zeitmanagement] DELETE /api/zeit/folders/[id] failed", error);
    const status = resolveStatus(error);
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status });
  }
}
