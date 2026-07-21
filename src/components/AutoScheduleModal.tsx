"use client";

import { useRef, useState } from "react";
import { ArrowRight, CalendarClock, Lock, TriangleAlert } from "lucide-react";
import { updateItemTimes } from "@/app/trips/actions";
import {
  buildDaySchedule,
  type ScheduleItem,
  type ScheduleRoute,
} from "@/lib/autoSchedule";
import ModalOverlay, { ModalCloseButton, type ModalOverlayHandle } from "./ModalOverlay";
import { useToast } from "./Toast";

export type AppliedTimeUpdate = {
  itemId: string;
  startTime: string; // "YYYY-MM-DDTHH:mm:00Z"
  endTime: string;
};

function toHHMM(value: string | Date | null): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(11, 16);
}

export default function AutoScheduleModal({
  tripId,
  dayId,
  dayDate,
  items,
  routes,
  onClose,
  onApplied,
}: {
  tripId: string;
  dayId: string;
  dayDate: string;
  items: ScheduleItem[];
  routes: ScheduleRoute[];
  onClose: () => void;
  onApplied: (updates: AppliedTimeUpdate[]) => void;
}) {
  const toast = useToast();
  const modalRef = useRef<ModalOverlayHandle>(null);
  const [dayStart, setDayStart] = useState(
    () => toHHMM(items[0]?.startTime ?? null) ?? "09:00"
  );
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pure and cheap — recomputed directly on every render so the preview
  // follows the start-time input live, no effect/loading state needed.
  const proposals = buildDaySchedule(items, routes, dayDate, dayStart);

  async function handleApply() {
    setIsApplying(true);
    setError(null);
    const updates: AppliedTimeUpdate[] = proposals
      .filter((p) => !p.fixed)
      .map((p) => ({
        itemId: p.itemId,
        // Same wall-clock-as-UTC convention as EditItemModal's toIso — the
        // "Z" keeps server/browser parses agreeing on the same instant.
        startTime: `${dayDate}T${p.newStart}:00Z`,
        endTime: `${dayDate}T${p.newEnd}:00Z`,
      }));
    try {
      await updateItemTimes(tripId, dayId, updates);
      onApplied(updates);
      toast.success("已套用新時間");
      modalRef.current?.requestClose();
    } catch {
      setError("套用失敗，請再試一次");
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <ModalOverlay
      ref={modalRef}
      onClose={onClose}
      titleId="auto-schedule-modal-title"
      panelClassName="w-full max-w-md p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="auto-schedule-modal-title"
          className="flex items-center gap-2 text-lg font-bold text-ink-900"
        >
          <CalendarClock className="h-5 w-5 text-brand-600" />
          自動排時間
        </h2>
        <ModalCloseButton />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label htmlFor="auto-schedule-start" className="text-sm font-medium text-ink-700">
          出發時間
        </label>
        <input
          id="auto-schedule-start"
          type="time"
          value={dayStart}
          onChange={(e) => e.target.value && setDayStart(e.target.value)}
          className="rounded-md border border-line px-3 py-1.5 text-sm"
        />
      </div>
      <p className="mt-1.5 text-xs text-ink-500">
        依交通時間、營業時間與預設停留時間排出整天，交通項目的既定時間不會被移動。
      </p>

      <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
        {proposals.map((p) => (
          <li key={p.itemId} className="rounded-lg border border-line bg-paper p-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium text-ink-900">{p.name}</span>
              {p.fixed && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-paper-alt px-2 py-0.5 text-xs text-ink-500">
                  <Lock className="h-3 w-3" />
                  已固定
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
              <span>
                {p.oldStart ? `${p.oldStart}${p.oldEnd ? `–${p.oldEnd}` : ""}` : "未排時間"}
              </span>
              {!p.fixed && (
                <>
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <span className="font-semibold text-brand-700">
                    {p.newStart}–{p.newEnd}
                  </span>
                </>
              )}
            </div>
            {p.warning && (
              <p className="mt-1 flex items-start gap-1 text-xs text-warning-700">
                <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                {p.warning}
              </p>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="mt-2 text-xs text-danger-600">{error}</p>}

      <button
        type="button"
        onClick={handleApply}
        disabled={isApplying || proposals.every((p) => p.fixed)}
        className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {isApplying ? "套用中…" : "套用這份時間表"}
      </button>
    </ModalOverlay>
  );
}
