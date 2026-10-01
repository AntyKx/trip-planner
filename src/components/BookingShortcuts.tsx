"use client";

import { useEffect, useState } from "react";
import { BedDouble, MapPin, Pencil, Plane, Ticket } from "lucide-react";
import AppModal from "./AppModal";
import {
  BOOKING_CITIES,
  BOOKING_ORIGINS,
  agodaUrl,
  findBookingCity,
  skyscannerUrl,
  klookUrl,
  nightsBetween,
  type BookingCity,
} from "@/lib/bookingLinks";

type Choice = { city?: string; origin?: string };

// Per trip, per device — the picker's choice overrides what was detected
// from the trip's title/addresses. Browser storage is fine here: losing it
// just falls back to the detected city.
function storageKey(tripId: string) {
  return `tp_booking_${tripId}`;
}

// 預訂捷徑 under the next-trip card on the home page (see
// src/lib/bookingLinks.ts for how each link is built).
export default function BookingShortcuts({
  tripId,
  startDate,
  endDate,
  detectedCity,
  traveling,
}: {
  tripId: string;
  startDate: string;
  endDate: string;
  detectedCity?: string;
  // Already on the trip — flights no longer apply.
  traveling: boolean;
}) {
  const [choice, setChoice] = useState<Choice>({});
  const [picking, setPicking] = useState(false);

  // Read after mount so the server render (detected city) and the first
  // client render agree.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(tripId));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setChoice(JSON.parse(saved) as Choice);
    } catch {
      // Unreadable storage — stay on the detected city.
    }
  }, [tripId]);

  function save(next: Choice) {
    setChoice(next);
    try {
      localStorage.setItem(storageKey(tripId), JSON.stringify(next));
    } catch {
      // Not persisted this time; the choice still applies until reload.
    }
  }

  const city: BookingCity | undefined = findBookingCity(choice.city ?? detectedCity);
  const origin = BOOKING_ORIGINS.find((o) => o.name === choice.origin) ?? BOOKING_ORIGINS[0];
  const nights = nightsBetween(startDate, endDate);
  const showFlights = !traveling;

  return (
    <div className="border-t border-line pt-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h3 className="shrink-0 text-sm font-semibold text-ink-700">預訂捷徑</h3>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex min-h-8 min-w-0 items-center gap-1 rounded-md bg-paper-alt px-2.5 text-xs text-ink-700 hover:bg-line"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {city ? city.name : "選擇目的地"}
            {showFlights && ` · ${origin.name}出發`}
          </span>
          <Pencil className="h-3 w-3 shrink-0" />
        </button>
      </div>

      {city ? (
        <>
          <div
            className={`mt-2.5 grid gap-2 ${showFlights ? "grid-cols-[repeat(3,minmax(0,1fr))]" : "grid-cols-[repeat(2,minmax(0,1fr))]"}`}
          >
            {showFlights &&
              (city.domestic || city.name === origin.name || !city.skyscanner ? (
                <ShortcutTile icon={Plane} label="找機票" note="國內不用飛" />
              ) : (
                <ShortcutTile
                  icon={Plane}
                  label="找機票"
                  note="Skyscanner 比價"
                  href={skyscannerUrl(origin, city, startDate, endDate)}
                />
              ))}
            {nights > 0 ? (
              <ShortcutTile
                icon={BedDouble}
                label="找住宿"
                note={`Agoda · ${nights} 晚`}
                href={agodaUrl(city, startDate, nights)}
              />
            ) : (
              <ShortcutTile icon={BedDouble} label="找住宿" note="當天來回" />
            )}
            <ShortcutTile icon={Ticket} label="找票券" note="Klook" href={klookUrl(city)} />
          </div>
          <p className="mt-2 text-[11px] text-ink-400">會開啟外部網站，價格與優惠以該網站為準</p>
        </>
      ) : (
        <p className="mt-2 text-xs text-ink-500">
          選好目的地後，就能直接帶入日期搜尋機票、住宿和票券
        </p>
      )}

      {picking && (
        <AppModal titleId={`booking-picker-${tripId}`} title="目的地與出發地" onClose={() => setPicking(false)}>
          <p className="mb-2 text-xs text-ink-500">
            目的地
            {detectedCity && `（從行程判斷為「${detectedCity}」，可以改）`}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[...new Set(BOOKING_CITIES.map((c) => c.region))].map((region) => (
              <div key={region} className="contents">
                <span className="mt-1 w-full text-[11px] text-ink-400">{region}</span>
                {BOOKING_CITIES.filter((c) => c.region === region).map((c) => (
                  <ChoiceChip
                    key={c.name}
                    label={c.name}
                    selected={city?.name === c.name}
                    onClick={() => save({ ...choice, city: c.name })}
                  />
                ))}
              </div>
            ))}
          </div>
          <p className="mb-2 mt-5 text-xs text-ink-500">從哪裡出發</p>
          <div className="flex flex-wrap gap-1.5">
            {BOOKING_ORIGINS.map((o) => (
              <ChoiceChip
                key={o.name}
                label={o.name}
                selected={origin.name === o.name}
                onClick={() => save({ ...choice, origin: o.name })}
              />
            ))}
          </div>
          <p className="mt-5 text-[11px] text-ink-400">
            清單以外的城市暫不支援帶入日期的住宿搜尋。
          </p>
        </AppModal>
      )}
    </div>
  );
}

function ShortcutTile({
  icon: Icon,
  label,
  note,
  href,
}: {
  icon: typeof Plane;
  label: string;
  note: string;
  href?: string;
}) {
  const body = (
    <>
      <Icon className="h-5 w-5 text-brand-600" />
      <span className="text-[13px] font-bold text-ink-900">{label}</span>
      <span className="max-w-full truncate text-[10.5px] font-normal text-ink-500">{note}</span>
    </>
  );
  const className =
    "flex min-h-16 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-2 text-center";
  if (!href) {
    return <span className={`${className} border-line bg-paper-alt opacity-60`}>{body}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} border-line bg-surface transition hover:bg-paper-alt active:scale-[0.97]`}
    >
      {body}
    </a>
  );
}

function ChoiceChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-9 rounded-md border px-3 text-sm ${
        selected
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-line bg-surface text-ink-700 hover:bg-paper-alt"
      }`}
    >
      {label}
    </button>
  );
}
