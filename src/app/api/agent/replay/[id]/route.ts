import { NextResponse } from "next/server";
import { replayExperiment } from "@/lib/agent/ops";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const experiment = replayExperiment(id);
  if (!experiment) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ experiment });
}
