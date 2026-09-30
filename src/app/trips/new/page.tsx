"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { createTrip } from "../actions";
import AppCard from "@/components/AppCard";
import AppButton from "@/components/AppButton";
import DateRangePicker from "@/components/DateRangePicker";

// Mirrors the day-count math in createTrip so the preview and the actual
// save agree — computed client-side purely for the live "共 N 天" hint,
// the real validation happens server-side regardless.
function describeDayCount(startDate: string, endDate: string): { text: string; invalid: boolean } | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (days <= 0) return { text: "結束日期不能早於開始日期", invalid: true };
  return { text: `共 ${days} 天`, invalid: false };
}

export default function NewTripPage() {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const preview = describeDayCount(startDate, endDate);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createTrip(title, startDate, endDate);
      // No result on success — createTrip redirects server-side instead
      // of returning, so reaching here at all means it failed.
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-10">
      <Link href="/" className="text-sm text-ink-700 hover:underline">
        ← 回我的行程
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-ink-900">建立新行程</h1>

      <AppCard className="mt-6 p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-ink-700">
              行程名稱
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="例如：東京五日自由行"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-base"
            />
          </div>

          <DateRangePicker
            id="tripDates"
            label="旅行日期"
            start={startDate}
            end={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
          />

          {error && <p className="text-sm text-danger-600">{error}</p>}

          <AppButton
            type="submit"
            isLoading={isPending}
            // The picker is a button, not a required <input>, so the form
            // can't block an empty range by itself.
            disabled={!startDate || !endDate || preview?.invalid}
            className="w-full"
          >
            {isPending ? "建立中…" : "建立行程"}
          </AppButton>
        </form>
      </AppCard>
    </main>
  );
}
