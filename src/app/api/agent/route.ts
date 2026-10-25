import { NextResponse } from "next/server";
import { getOpenClawStatus, listLog } from "@/lib/agent/ops";

export const dynamic = "force-dynamic";

export async function GET() {
  const [openclaw, log] = await Promise.all([getOpenClawStatus(), Promise.resolve(listLog(40))]);
  return NextResponse.json({ openclaw, log });
}
