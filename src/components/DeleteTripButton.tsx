"use client";

import { useTransition } from "react";
import { deleteTrip } from "@/app/trips/actions";

export default function DeleteTripButton({
  tripId,
  tripTitle,
}: {
  tripId: string;
  tripTitle: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`確定要刪除行程「${tripTitle}」嗎？這個動作無法復原。`)) return;
    startTransition(() => {
      deleteTrip(tripId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? "刪除中…" : "刪除行程"}
    </button>
  );
}
