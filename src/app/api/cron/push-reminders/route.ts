import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/pushNotifications";
import { getDailyWeather, getWeatherReminders } from "@/lib/weather";

// Runs once a day (see vercel.json's crons entry). Not cached, not
// statically analyzable at build time — this reads "today" and hits the
// DB/weather API fresh on every invocation.
export const dynamic = "force-dynamic";

// UTC "tomorrow", as a plain YYYY-MM-DD range. Trip/TripDay dates are
// stored as UTC midnight (same convention the rest of the app already uses
// for date-only fields — see localTodayStr/formatDate call sites), so
// comparing against a UTC day boundary here matches how they were written,
// not the server's or any particular user's local calendar day.
function tomorrowRange(): { start: Date; end: Date; iso: string } {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end, iso: start.toISOString().slice(0, 10) };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  // Checked separately from the header comparison below — otherwise an
  // unset CRON_SECRET makes the comparison degrade to matching the literal
  // string "Bearer undefined", which anyone can send. Fail closed instead.
  if (!cronSecret) {
    console.error("push-reminders cron: CRON_SECRET is not configured");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { start, end, iso } = tomorrowRange();

  let tripReminders = 0;
  let checklistReminders = 0;
  let weatherAlerts = 0;

  // 行前提醒 + 檢查清單提醒 — both scoped to "trip starts tomorrow", the
  // one moment both are actually actionable (any earlier and there's still
  // time; the day it starts, it's too late to still be prepping).
  const startingTrips = await prisma.trip.findMany({
    where: { startDate: { gte: start, lte: end } },
    select: {
      id: true,
      title: true,
      ownerId: true,
      collaborators: { select: { userId: true } },
      days: { select: { items: { select: { id: true } } } },
      checklistItems: { select: { isDone: true } },
    },
  });

  for (const trip of startingTrips) {
    const userIds = [...new Set([trip.ownerId, ...trip.collaborators.map((c) => c.userId)])];
    const emptyDays = trip.days.filter((d) => d.items.length === 0).length;
    const incompleteChecklist = trip.checklistItems.filter((c) => !c.isDone).length;

    const reminderBody =
      emptyDays > 0
        ? `距離出發只剩 1 天，還有 ${emptyDays} 天沒排景點`
        : "距離出發只剩 1 天，祝旅途愉快！";

    for (const userId of userIds) {
      await sendPushToUser(userId, {
        title: `${trip.title} 明天出發`,
        body: reminderBody,
        url: `/trips/${trip.id}`,
        tag: `trip-reminder-${trip.id}`,
      });
      tripReminders++;

      if (incompleteChecklist > 0) {
        await sendPushToUser(userId, {
          title: `檢查清單還有 ${incompleteChecklist} 項`,
          body: `${trip.title} 出發前記得check`,
          url: `/trips/${trip.id}?mode=checklist`,
          tag: `checklist-reminder-${trip.id}`,
        });
        checklistReminders++;
      }
    }
  }

  // 天氣示警 — scoped to whichever TripDay's own date is tomorrow, across
  // every trip that has one (not just trips starting tomorrow — a
  // multi-day trip already underway still has a "tomorrow" worth warning
  // about). One representative place (first item that has one) stands in
  // for the day's location, same simplification HeroWeatherBadge/
  // TripDayBoard already make when fetching a day's forecast.
  const tomorrowDays = await prisma.tripDay.findMany({
    where: { date: { gte: start, lte: end } },
    select: {
      id: true,
      trip: {
        select: {
          id: true,
          title: true,
          ownerId: true,
          collaborators: { select: { userId: true } },
        },
      },
      items: {
        where: { place: { isNot: null } },
        select: { place: { select: { lat: true, lng: true } } },
        take: 1,
      },
    },
  });

  for (const day of tomorrowDays) {
    const place = day.items[0]?.place;
    if (!place) continue;

    const weather = await getDailyWeather(place.lat, place.lng, start);
    if (!weather) continue;

    const reminders = getWeatherReminders(weather);
    if (reminders.length === 0) continue;

    const userIds = [
      ...new Set([day.trip.ownerId, ...day.trip.collaborators.map((c) => c.userId)]),
    ];

    for (const userId of userIds) {
      await sendPushToUser(userId, {
        title: `${day.trip.title} 明天天氣提醒`,
        body: reminders.map((r) => r.text).join("；"),
        url: `/trips/${day.trip.id}`,
        tag: `weather-${day.id}`,
      });
      weatherAlerts++;
    }
  }

  return NextResponse.json({
    ok: true,
    date: iso,
    tripsStartingTomorrow: startingTrips.length,
    tripReminders,
    checklistReminders,
    weatherAlerts,
  });
}
