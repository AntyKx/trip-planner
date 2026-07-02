"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Pencil } from "lucide-react";
import { updateEmergencyInfo } from "@/app/trips/actions";

export default function EmergencyInfoCard({
  tripId,
  emergencyInfo,
}: {
  tripId: string;
  emergencyInfo: string | null;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(emergencyInfo ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateEmergencyInfo(tripId, text);
      setIsEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <ShieldAlert className="h-4 w-4" />
          緊急資訊
        </h3>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            aria-label="編輯緊急資訊"
            className="p-1 text-ink-500 hover:text-brand-600"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="護照影本存放位置、保險保單號碼、緊急聯絡人..."
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="rounded-md bg-brand-600 px-3 py-1 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {isPending ? "儲存中…" : "儲存"}
            </button>
            <button
              type="button"
              onClick={() => {
                setText(emergencyInfo ?? "");
                setIsEditing(false);
              }}
              disabled={isPending}
              className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
            >
              取消
            </button>
          </div>
        </div>
      ) : emergencyInfo ? (
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
          {emergencyInfo}
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-400">
          尚未填寫，可記錄護照影本位置、保險資訊、緊急聯絡人等。
        </p>
      )}
    </div>
  );
}
