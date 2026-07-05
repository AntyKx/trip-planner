"use server";

import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export type ReviewInput = {
  rating?: number;
  text?: string;
};

export type PlaceInsightResult =
  | { ok: true; summary: string }
  | { ok: false; error: string };

// This action is reachable via direct POST by any signed-in user (Google
// sign-in is self-service, no invite gate) with arbitrary placeName/review
// text — nothing here ties it to a real Google place. Without a limit,
// it's effectively a free-form LLM text generator billed to this
// project's AI Gateway account. Generous enough for real usage (browsing
// many places) but bounds worst-case cost per account.
const AI_CALLS_PER_DAY = 30;

// Cached per place (see PlaceInsight in schema.prisma) — generated once
// from whatever reviews the client already fetched for display, so this
// never triggers an extra Google Places call, and repeat views of the
// same place never pay for a second AI call either. Cache hits don't
// count against the rate limit below, only actual generations do.
export async function getPlaceInsight(
  provider: string,
  externalId: string,
  placeName: string,
  reviews: ReviewInput[]
): Promise<PlaceInsightResult> {
  const user = await requireUser();

  const existing = await prisma.placeInsight.findUnique({
    where: { provider_externalId: { provider, externalId } },
  });
  if (existing) return { ok: true, summary: existing.summary };

  const usableReviews = reviews.filter((r) => r.text && r.text.trim());
  if (usableReviews.length === 0) {
    return { ok: false, error: "這個地點目前沒有足夠的評論可以摘要" };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCalls = await prisma.aiUsageLog.count({
    where: { userId: user.id, createdAt: { gte: since } },
  });
  if (recentCalls >= AI_CALLS_PER_DAY) {
    return { ok: false, error: "今天的 AI 摘要次數已達上限，請明天再試" };
  }

  // Cap length defensively regardless of what the client claims a
  // "review" (or a place name) is — bounds the cost of any single call.
  const reviewBlock = usableReviews
    .slice(0, 5)
    .map((r, i) => `評論 ${i + 1}（評分 ${r.rating ?? "無"}）：${(r.text ?? "").slice(0, 500)}`)
    .join("\n\n");
  const safePlaceName = placeName.slice(0, 200);

  // Logged before the call (not just on success) so a failing/retried
  // call still counts against the limit — the cost to us is incurred by
  // the attempt reaching the provider, not by whether it happened to
  // return cleanly.
  await prisma.aiUsageLog.create({ data: { userId: user.id } });

  try {
    const { text } = await generateText({
      model: "anthropic/claude-haiku-4.5",
      instructions:
        "你是旅遊行程規劃助手。根據使用者提供的 Google 評論，用繁體中文寫一段簡短摘要，" +
        "幫遊客快速判斷這個地點值不值得去。重點放在：評論中重複提到的優點/缺點、" +
        "建議的造訪時機或注意事項（例如排隊、公休、必點品項）。" +
        "只根據評論內容摘要，不要編造評論沒提到的資訊。不要輸出任何開場白或結語，" +
        "直接給重點，控制在 120 字以內，可以用條列。",
      prompt: `地點名稱：${safePlaceName}\n\n${reviewBlock}`,
    });

    const summary = text.trim();
    if (!summary) return { ok: false, error: "AI 沒有回傳內容，請再試一次" };

    await prisma.placeInsight.upsert({
      where: { provider_externalId: { provider, externalId } },
      update: { summary },
      create: { provider, externalId, summary },
    });

    return { ok: true, summary };
  } catch {
    return { ok: false, error: "AI 摘要失敗，請稍後再試" };
  }
}
