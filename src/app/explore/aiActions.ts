"use server";

import { generateText, Output } from "ai";
import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTripEditor } from "@/lib/auth";

export type ReviewInput = {
  rating?: number;
  text?: string;
};

export type PlaceInsightResult =
  | {
      ok: true;
      fitScore: number;
      summary: string;
      suggestedDuration: string;
      caution: string | null;
    }
  | { ok: false; error: string };

// This action is reachable via direct POST by any signed-in user (Google
// sign-in is self-service, no invite gate) with arbitrary placeName/review
// text — nothing here ties it to a real Google place. Without a limit,
// it's effectively a free-form LLM text generator billed to this
// project's AI Gateway account. Generous enough for real usage (browsing
// many places) but bounds worst-case cost per account.
const AI_CALLS_PER_DAY = 30;

const insightSchema = z.object({
  fitScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      "這個地點排進這一天目前的行程安排有多合適，0-100，考慮跟已排定景點的步調、時間、性質是否搭配"
    ),
  summary: z.string().describe("根據評論的重點摘要，繁體中文，120 字以內，可條列"),
  suggestedDuration: z.string().describe("建議停留時間，例如「1-2 小時」"),
  caution: z
    .string()
    .optional()
    .describe("需要注意的事（排隊、公休、需預約等），沒有就省略這個欄位"),
});

// Cached per (place, day) — see PlaceInsight in schema.prisma. Scoped per
// day (not globally per place) because fitScore/suggestedDuration are
// judged against that day's already-planned itinerary, not the place in
// isolation. Cache hits don't count against the rate limit below, only
// actual generations do.
export async function getPlaceInsight(
  provider: string,
  externalId: string,
  placeName: string,
  reviews: ReviewInput[],
  tripId: string,
  dayId: string
): Promise<PlaceInsightResult> {
  const user = await requireTripEditor(tripId);

  // Same shape as requireDayInTrip in src/app/trips/actions.ts — dayId is
  // client-supplied, so it has to be verified as actually belonging to
  // tripId. Without this, a user with EDITOR on *any* trip of their own
  // could pass someone else's dayId and get that day's itinerary
  // (place names/times) fed back to them through the AI response.
  const day = await prisma.tripDay.findFirst({
    where: { id: dayId, tripId },
    select: { id: true, dayIndex: true, date: true },
  });
  if (!day) redirect("/");

  const existing = await prisma.placeInsight.findUnique({
    where: { provider_externalId_dayId: { provider, externalId, dayId } },
  });
  if (existing) {
    return {
      ok: true,
      fitScore: existing.fitScore,
      summary: existing.summary,
      suggestedDuration: existing.suggestedDuration,
      caution: existing.caution,
    };
  }

  const usableReviews = reviews.filter((r) => r.text && r.text.trim());
  if (usableReviews.length === 0) {
    return { ok: false, error: "這個地點目前沒有足夠的評論可以分析" };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCalls = await prisma.aiUsageLog.count({
    where: { userId: user.id, createdAt: { gte: since } },
  });
  if (recentCalls >= AI_CALLS_PER_DAY) {
    return { ok: false, error: "今天的 AI 分析次數已達上限，請明天再試" };
  }

  const dayItems = await prisma.item.findMany({
    where: { dayId },
    orderBy: { sortOrder: "asc" },
    select: {
      type: true,
      startTime: true,
      endTime: true,
      place: { select: { name: true } },
    },
  });
  const itineraryBlock =
    dayItems.length === 0
      ? "目前這天還沒有排定任何行程。"
      : dayItems
          .map((i) => {
            const time = i.startTime
              ? new Date(i.startTime).toISOString().slice(11, 16)
              : "時間未定";
            return `${time} ${i.place?.name ?? "自訂項目"}`;
          })
          .join("、");

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
    const { output } = await generateText({
      model: "anthropic/claude-haiku-4.5",
      instructions:
        "你是旅遊行程規劃助手。根據使用者提供的 Google 評論，以及這一天目前已經" +
        "排定的行程，判斷這個地點適不適合排進這一天，並整理評論重點。" +
        "fitScore 要考慮跟已排定景點的步調、時間、性質是否搭配（例如這天已經" +
        "排很滿就不適合再塞一個要花很久的景點）；如果這天還沒有排定任何行程，" +
        "fitScore 只需反映這個地點本身值不值得去。只根據評論內容摘要，不要" +
        "編造評論沒提到的資訊。",
      prompt: `地點名稱：${safePlaceName}\n\nDay ${day.dayIndex}（${day.date.toISOString().slice(0, 10)}）目前已排定：${itineraryBlock}\n\n${reviewBlock}`,
      output: Output.object({ schema: insightSchema }),
    });

    if (!output) return { ok: false, error: "AI 沒有回傳內容，請再試一次" };
    const result = output;

    await prisma.placeInsight.upsert({
      where: { provider_externalId_dayId: { provider, externalId, dayId } },
      update: {
        summary: result.summary,
        fitScore: result.fitScore,
        suggestedDuration: result.suggestedDuration,
        caution: result.caution ?? null,
      },
      create: {
        provider,
        externalId,
        tripId,
        dayId,
        summary: result.summary,
        fitScore: result.fitScore,
        suggestedDuration: result.suggestedDuration,
        caution: result.caution ?? null,
      },
    });

    return {
      ok: true,
      fitScore: result.fitScore,
      summary: result.summary,
      suggestedDuration: result.suggestedDuration,
      caution: result.caution ?? null,
    };
  } catch {
    return { ok: false, error: "AI 分析失敗，請稍後再試" };
  }
}
