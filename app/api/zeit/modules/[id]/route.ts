import { NextResponse } from "next/server";
import { TimeTrackingService } from "@/lib/services/timeTrackingService";

const UNAUTHORIZED_REGEX = /unauthorisiert|authentifizierung/i;

function resolveStatus(error: unknown): number {
  if (error instanceof Error && UNAUTHORIZED_REGEX.test(error.message)) {
    return 401;
  }
  return 500;
}

type RouteContext = { params: Promise<{ id: string }> };

async function getParamsId(context: RouteContext): Promise<string> {
  const params = await context.params;
  return params.id;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const payload = await request.json();
    const service = await TimeTrackingService.fromRequest();
    const id = await getParamsId(context);
    const updatedModule = await service.updateModule(id, payload);
    return NextResponse.json({ data: updatedModule });
  } catch (error) {
    console.error("[Zeitmanagement] PATCH /api/zeit/modules/[id] failed", error);
    const status = resolveStatus(error);
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const service = await TimeTrackingService.fromRequest();
    const id = await getParamsId(context);
    await service.deleteModule(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Zeitmanagement] DELETE /api/zeit/modules/[id] failed", error);
    const status = resolveStatus(error);
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status });
  }
}
