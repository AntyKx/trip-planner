"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateTripInfo } from "@/app/trips/actions";
import AppButton from "@/components/AppButton";
import DateRangePicker from "@/components/DateRangePicker";

export default function TripInfoForm({
  tripId,
  initialTitle,
  initialStartDate,
  initialEndDate,
  dayCount,
  hasItems,
}: {
  tripId: string;
  initialTitle: string;
  initialStartDate: string;
  initialEndDate: string;
  dayCount: number;
  hasItems: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Once the trip has scheduled items, the span length is locked (see
  // updateTripInfo) — the picker's lockedDays mode then only lets the
  // start move, with the end following it, so a day-count change can
  // never even be submitted.

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateTripInfo(tripId, title, startDate, endDate);
      if (!result.ok) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-ink-700">
          行程名稱
        </label>
        <input
          id="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSuccess(false);
          }}
          required
          className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-base"
        />
      </div>

      <div>
        <DateRangePicker
          id="tripDates"
          label="旅行日期"
          start={startDate}
          end={endDate}
          lockedDays={hasItems ? dayCount : undefined}
          onChange={(start, end) => {
            setStartDate(start);
            setEndDate(end);
            setSuccess(false);
          }}
        />
        {hasItems && (
          <p className="mt-1.5 text-xs text-ink-500">
            已有排定的景點，天數鎖定為 {dayCount} 天，只能整段往前或往後移
          </p>
        )}
      </div>

      {error && <p className="text-sm text-danger-600">{error}</p>}
      {success && !error && <p className="text-sm text-brand-700">已儲存</p>}

      <AppButton type="submit" isLoading={isPending} className="w-full">
        {isPending ? "儲存中…" : "儲存"}
      </AppButton>
    </form>
  );
}
