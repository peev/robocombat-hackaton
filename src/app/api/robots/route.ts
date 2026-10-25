import { NextResponse } from "next/server";
import { ROBOT_PROFILES, DISCLAIMER } from "@/lib/robots/profiles";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    disclaimer: DISCLAIMER,
    robots: Object.values(ROBOT_PROFILES),
  });
}
