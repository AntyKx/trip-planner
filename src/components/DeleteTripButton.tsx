"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
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
      className="flex items-center gap-1.5 rounded-lg border border-danger-200 px-3 py-2 text-sm font-medium text-danger-600 hover:bg-danger-50 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
      {isPending ? "刪除中…" : "刪除行程"}
    </button>
  );
}
