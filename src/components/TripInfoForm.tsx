"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateTripInfo } from "@/app/trips/actions";
import AppButton from "@/components/AppButton";

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
  // updateTripInfo) — only the start date is editable, and the end date
  // always follows it so a day-count change can never even be submitted.
  function handleStartDateChange(value: string) {
    setStartDate(value);
    setSuccess(false);
    if (hasItems) {
      const shifted = new Date(
        new Date(value).getTime() + (dayCount - 1) * 24 * 60 * 60 * 1000
      );
      setEndDate(shifted.toISOString().slice(0, 10));
    } else if (endDate && endDate < value) {
      setEndDate(value);
    }
  }

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

      {hasItems ? (
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-ink-700">
            開始日期
          </label>
          <input
            id="startDate"
            type="date"
            required
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-base"
          />
          <p className="mt-1.5 text-xs text-ink-500">
            已有排定的景點，天數鎖定為 {dayCount} 天（結束日期會自動跟著移動到{" "}
            {endDate}）
          </p>
        </div>
      ) : (
        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="startDate" className="block text-sm font-medium text-ink-700">
              開始日期
            </label>
            <input
              id="startDate"
              type="date"
              required
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-base"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="endDate" className="block text-sm font-medium text-ink-700">
              結束日期
            </label>
            <input
              id="endDate"
              type="date"
              required
              min={startDate || undefined}
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setSuccess(false);
              }}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-base"
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger-600">{error}</p>}
      {success && !error && <p className="text-sm text-brand-700">已儲存</p>}

      <AppButton type="submit" isLoading={isPending} className="w-full">
        {isPending ? "儲存中…" : "儲存"}
      </AppButton>
    </form>
  );
}
