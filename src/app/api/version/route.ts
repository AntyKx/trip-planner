import { NextResponse } from "next/server";

// Never cache this route — it must always reflect the currently
// deployed build so the client can detect when a newer one is live.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID },
    { headers: { "Cache-Control": "no-store" } }
  );
}
