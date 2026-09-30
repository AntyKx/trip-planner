"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import AppModal from "./AppModal";
import AppButton from "./AppButton";
import { MAX_TRIP_DAYS } from "@/lib/limits";
import {
  addDays,
  daySpan,
  monthsBetween,
  nextSelection,
  shortLabel,
  weekdayOf,
} from "@/lib/dateRange";

const WEEKDAY_HEADER = ["日", "一", "二", "三", "四", "五", "六"];

// Flight-search style range picker: one field, and a calendar where the
// first tap is the start and the second the end. Replaces the pair of
// side-by-side <input type="date">s, which overflowed the form on iPhone
// (each native date input has a wide intrinsic minimum width).
//
// lockedDays: the trip already has stops, so its length can't change
// (see updateTripInfo) — a single tap then picks the start and the end
// follows automatically.
export default function DateRangePicker({
  id,
  label,
  start,
  end,
  onChange,
  lockedDays,
}: {
  id: string;
  label: string;
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  lockedDays?: number;
}) {
  const [open, setOpen] = useState(false);
  const hasRange = Boolean(start && end);

  return (
    <div>
      <span id={`${id}-label`} className="block text-sm font-medium text-ink-700">
        {label}
      </span>
      <button
        id={id}
        type="button"
        aria-labelledby={`${id}-label ${id}`}
        onClick={() => setOpen(true)}
        className="mt-1 flex w-full min-w-0 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-left text-base hover:border-brand-300"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-brand-600" />
        {hasRange ? (
          <span className="min-w-0 flex-1 truncate text-ink-900">
            {shortLabel(start)} → {shortLabel(end)}
            <span className="ml-1.5 text-sm text-brand-700">· {daySpan(start, end)} 天</span>
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-ink-400">選擇出發與回程日期</span>
        )}
      </button>
      {open && (
        <RangeCalendar
          initialStart={start}
          initialEnd={end}
          lockedDays={lockedDays}
          onDone={(s, e) => {
            onChange(s, e);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function RangeCalendar({
  initialStart,
  initialEnd,
  lockedDays,
  onDone,
  onClose,
}: {
  initialStart: string;
  initialEnd: string;
  lockedDays?: number;
  onDone: (start: string, end: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState({ start: initialStart, end: initialEnd });
  // Captured once — the calendar doesn't need to tick over midnight.
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const listRef = useRef<HTMLDivElement>(null);

  // A year back (to log a trip already taken) through two years ahead —
  // further back if the trip being edited started earlier than that.
  const months = useMemo(() => {
    const yearAgo = addDays(today, -365);
    const from = initialStart && initialStart < yearAgo ? initialStart : yearAgo;
    return monthsBetween(from, addDays(today, 730));
  }, [today, initialStart]);

  // Open on the selected month (or this month), not a year back.
  useEffect(() => {
    const key = (initialStart || today).slice(0, 7);
    listRef.current
      ?.querySelector<HTMLElement>(`[data-month="${key}"]`)
      ?.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While choosing the end, days past the max span can't be picked.
  const choosingEnd = !lockedDays && Boolean(draft.start) && !draft.end;
  const lastPickable = choosingEnd ? addDays(draft.start, MAX_TRIP_DAYS - 1) : null;

  function tap(date: string) {
    if (lockedDays) {
      setDraft({ start: date, end: addDays(date, lockedDays - 1) });
    } else {
      setDraft((prev) => nextSelection(prev, date, MAX_TRIP_DAYS));
    }
  }

  const complete = Boolean(draft.start && draft.end);
  const hint = lockedDays
    ? `已有排定的景點，天數固定 ${lockedDays} 天，點一下選出發日`
    : !draft.start || complete
      ? "點選出發日"
      : "再點選回程日（當天來回就點同一天）";

  return (
    <AppModal
      titleId="date-range-title"
      title="選擇旅行日期"
      onClose={onClose}
      footer={
        <div className="flex items-center gap-3">
          {!lockedDays && (draft.start || draft.end) && (
            <button
              type="button"
              onClick={() => setDraft({ start: "", end: "" })}
              className="min-h-11 shrink-0 px-2 text-sm text-ink-500 hover:text-ink-700"
            >
              清除
            </button>
          )}
          <AppButton
            type="button"
            disabled={!complete}
            onClick={() => onDone(draft.start, draft.end)}
            className="flex-1"
          >
            {complete ? `完成（共 ${daySpan(draft.start, draft.end)} 天）` : "完成"}
          </AppButton>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <SummaryBox caption="出發" date={draft.start} active={!draft.start || complete} />
        <SummaryBox caption="回程" date={draft.end} active={choosingEnd} />
      </div>
      <p className="mt-2 text-xs text-ink-500">{hint}</p>

      <div className="mt-3 grid grid-cols-7 border-b border-line pb-1.5 text-center text-xs text-ink-500">
        {WEEKDAY_HEADER.map((w, i) => (
          <span key={w} className={i === 0 || i === 6 ? "text-danger-600/80" : ""}>
            {w}
          </span>
        ))}
      </div>

      {/* Own scroll area so the summary and weekday row above stay put. */}
      <div ref={listRef} className="max-h-[52dvh] overflow-y-auto overscroll-contain">
        {months.map((month) => (
          <section key={month.key} data-month={month.key} className="pt-4">
            <h3 className="mb-2 text-center text-sm font-semibold text-ink-900">
              {month.label}
            </h3>
            <div className="grid grid-cols-7 gap-y-1">
              {month.cells.map((date, i) => {
                if (!date) return <span key={`blank-${i}`} />;
                const isStart = date === draft.start;
                const isEnd = date === draft.end;
                const inRange =
                  complete && date > draft.start && date < draft.end;
                const disabled = lastPickable !== null && date > lastPickable;
                const isToday = date === today;
                // Band behind the circles: right half on the start, left
                // half on the end, full width in between.
                const band =
                  complete && draft.start !== draft.end
                    ? isStart
                      ? "bg-gradient-to-r from-transparent from-50% to-brand-50 to-50%"
                      : isEnd
                        ? "bg-gradient-to-r from-brand-50 from-50% to-transparent to-50%"
                        : inRange
                          ? "bg-brand-50"
                          : ""
                    : "";
                return (
                  <div key={date} className={`flex justify-center ${band}`}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => tap(date)}
                      aria-label={`${date} 星期${weekdayOf(date)}`}
                      aria-pressed={isStart || isEnd}
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:text-ink-300 ${
                        isStart || isEnd
                          ? "bg-brand-600 font-semibold text-white"
                          : inRange
                            ? "text-brand-700"
                            : "text-ink-900 hover:bg-paper-alt"
                      } ${isToday && !isStart && !isEnd ? "font-bold text-brand-700 underline underline-offset-4" : ""}`}
                    >
                      {Number(date.slice(8, 10))}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AppModal>
  );
}

function SummaryBox({
  caption,
  date,
  active,
}: {
  caption: string;
  date: string;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        active ? "border-brand-600 bg-brand-50" : "border-line bg-surface"
      }`}
    >
      <p className="text-[11px] text-ink-500">{caption}</p>
      <p className={`text-sm font-semibold ${date ? "text-ink-900" : "text-ink-400"}`}>
        {date ? shortLabel(date) : "未選擇"}
      </p>
    </div>
  );
}
