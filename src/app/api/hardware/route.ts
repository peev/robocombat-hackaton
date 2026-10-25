import { NextResponse } from "next/server";
import { collectHardwareMetrics } from "@/lib/hardware/nvidia";
import { getGpuEvents } from "@/lib/persistence/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const metrics = await collectHardwareMetrics();
  return NextResponse.json({
    title: "NVIDIA GB10 LIVE COMPUTE",
    metrics,
    timeline: getGpuEvents(),
  });
}
