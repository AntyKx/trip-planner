"use server";

import { generateText, Output } from "ai";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTripEditor } from "@/lib/auth";

// Same daily bucket as src/app/explore/aiActions.ts's getPlaceInsight —
// AiUsageLog has no feature-scoping column, so this shares one per-user
// budget with place-insight generation rather than getting its own 30/day.
const AI_CALLS_PER_DAY = 30;

// PDF included because booking confirmations are often emailed as PDF
// attachments rather than screenshotted — Claude accepts PDF documents as
// input the same way it accepts images.
const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

// ~6MB of raw file data as base64 (base64 inflates size by ~4/3). Guards
// the action directly since the client-side size check (EditItemModal) can
// be bypassed by anyone calling this action directly with arbitrary input.
const MAX_BASE64_LENGTH = 8_000_000;

const extractionSchema = z.object({
  confirmationNumber: z
    .string()
    .optional()
    .describe("訂位/訂房/票券編號，看不出來就省略這個欄位"),
  cost: z.number().optional().describe("總金額（純數字），看不出來就省略這個欄位"),
  currency: z
    .string()
    .optional()
    .describe("ISO 4217 三碼幣別，例如 TWD/JPY/USD，看不出來就省略這個欄位"),
  startTime: z
    .string()
    .optional()
    .describe("開始時間（入住時間、起飛時間等），HH:mm 24小時制，看不出來就省略這個欄位"),
  endTime: z
    .string()
    .optional()
    .describe("結束時間（退房時間、抵達時間等），HH:mm 24小時制，看不出來就省略這個欄位"),
  note: z
    .string()
    .optional()
    .describe("一句話說明這是什麼預訂，例如飯店名稱或航班號碼，30 字以內"),
});

export type ExtractConfirmationResult =
  | {
      ok: true;
      confirmationNumber: string | null;
      cost: number | null;
      currency: string | null;
      startTime: string | null;
      endTime: string | null;
      note: string | null;
    }
  | { ok: false; error: string };

// Reads a booking/ticket confirmation screenshot and extracts fields to
// pre-fill EditItemModal's form. The image is never persisted — passed
// straight through to the model and discarded, so it never touches Blob
// storage or ItemPhoto (which is exposed via the public 旅遊書 share link).
export async function extractConfirmationFromImage(
  tripId: string,
  dayId: string,
  imageBase64: string,
  mediaType: string
): Promise<ExtractConfirmationResult> {
  const user = await requireTripEditor(tripId);

  // Same shape as getPlaceInsight in src/app/explore/aiActions.ts — dayId
  // is client-supplied, so it has to be verified as actually belonging to
  // tripId to prevent cross-trip access.
  const day = await prisma.tripDay.findFirst({
    where: { id: dayId, tripId },
    select: { id: true, date: true },
  });
  if (!day) redirect("/");

  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return { ok: false, error: "不支援的圖片格式" };
  }
  if (!imageBase64 || imageBase64.length > MAX_BASE64_LENGTH) {
    return { ok: false, error: "圖片太大，請重新截圖或裁切後再試" };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCalls = await prisma.aiUsageLog.count({
    where: { userId: user.id, createdAt: { gte: since } },
  });
  if (recentCalls >= AI_CALLS_PER_DAY) {
    return { ok: false, error: "今天的 AI 分析次數已達上限，請明天再試" };
  }

  // Logged before the call (not just on success) so a failing call still
  // counts against the limit — same reasoning as getPlaceInsight.
  await prisma.aiUsageLog.create({ data: { userId: user.id } });

  try {
    const { output } = await generateText({
      model: "anthropic/claude-haiku-4.5",
      instructions:
        "你是旅遊行程規劃助手。使用者會提供一張旅遊訂房、機票或票券的確認截圖或 PDF，" +
        `這是 ${day.date.toISOString().slice(0, 10)} 這天的行程。` +
        "從中盡量抓出訂位/訂房/票券編號、總金額、幣別、開始時間（入住/起飛等）、" +
        "結束時間（退房/抵達等），以及一句話說明這是什麼預訂。只根據實際看得到的" +
        "內容填寫，看不出來的欄位直接省略，不要編造。",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "請辨識這份訂房/票券資訊。" },
            { type: "file", data: imageBase64, mediaType },
          ],
        },
      ],
      output: Output.object({ schema: extractionSchema }),
    });

    if (!output) return { ok: false, error: "AI 沒有回傳內容，請再試一次" };

    return {
      ok: true,
      confirmationNumber: output.confirmationNumber ?? null,
      cost: output.cost ?? null,
      currency: output.currency ?? null,
      startTime: output.startTime ?? null,
      endTime: output.endTime ?? null,
      note: output.note ?? null,
    };
  } catch {
    return { ok: false, error: "AI 辨識失敗，請稍後再試" };
  }
}
