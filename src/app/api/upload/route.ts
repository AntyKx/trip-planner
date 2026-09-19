import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Same daily bucket size as the AI actions' AiUsageLog cap — generous
// enough for real usage (cover image + a day's worth of journal photos)
// while bounding worst-case Blob storage cost per account.
const UPLOADS_PER_DAY = 100;

export async function POST(request: Request): Promise<NextResponse> {
  // Without this, anyone who finds this URL (no session needed at all) can
  // POST directly and get back a valid Vercel Blob upload token — a free,
  // anonymous file host billed to this project's Blob storage, bypassing
  // the app entirely since this is a plain route handler, not gated by any
  // page's own auth check.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Checked (and logged) here rather than before handleUpload is
        // called at all, since this callback only fires for an actual
        // token request — not for the upload-completed webhook Vercel
        // sends back to this same route afterward.
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentUploads = await prisma.uploadUsageLog.count({
          where: { userId: user.id, createdAt: { gte: since } },
        });
        if (recentUploads >= UPLOADS_PER_DAY) {
          throw new Error("今天的上傳次數已達上限，請明天再試");
        }
        await prisma.uploadUsageLog.create({ data: { userId: user.id } });

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
          addRandomSuffix: true,
          maximumSizeInBytes: 15 * 1024 * 1024,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("cover image upload completed:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
