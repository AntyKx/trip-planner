"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Pencil } from "lucide-react";
import { updateEmergencyInfo } from "@/app/trips/actions";
import { useToast } from "./Toast";
import { appButtonClassName } from "./AppButton";

export default function EmergencyInfoCard({
  tripId,
  emergencyInfo,
  canEdit,
  bare = false,
}: {
  tripId: string;
  emergencyInfo: string | null;
  canEdit: boolean;
  // true inside TripInfoToolbar's sheet, which already supplies the title.
  bare?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(emergencyInfo ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateEmergencyInfo(tripId, text);
      setIsEditing(false);
      toast.success("已儲存");
      router.refresh();
    });
  }

  return (
    <div className={bare ? "" : "rounded-card border border-line bg-surface p-4"}>
      <div className="flex items-center justify-between gap-2">
        {!bare && (
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-700">
            <ShieldAlert className="h-4 w-4" />
            緊急資訊
          </h3>
        )}
        {canEdit && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            aria-label="編輯緊急資訊"
            className={
              bare
                ? "ml-auto flex min-h-9 items-center gap-1 rounded-md border border-line px-3 text-sm text-ink-700 hover:bg-paper-alt"
                : "p-1 text-ink-500 hover:text-brand-600"
            }
          >
            <Pencil className="h-4 w-4" />
            {bare && "編輯"}
          </button>
        )}
      </div>

      {canEdit && isEditing ? (
        <div className={`${bare ? "" : "mt-3 "}space-y-2`}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="護照影本存放位置、保險保單號碼、緊急聯絡人..."
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className={appButtonClassName("primary", "sm")}
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
              className={appButtonClassName("secondary", "sm")}
            >
              取消
            </button>
          </div>
        </div>
      ) : emergencyInfo ? (
        <p className="mt-3 whitespace-pre-wrap text-sm text-ink-700">
          {emergencyInfo}
        </p>
      ) : (
        <p className="mt-3 text-sm text-ink-500">
          尚未填寫，可記錄護照影本位置、保險資訊、緊急聯絡人等。
        </p>
      )}
    </div>
  );
}
