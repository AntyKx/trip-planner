"use client";

import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import {
  updateItem,
  addCustomItem,
  type ItemTypeValue,
  type CostCategoryValue,
} from "@/app/trips/actions";

const TYPE_OPTIONS: { value: ItemTypeValue; label: string }[] = [
  { value: "PLACE", label: "景點" },
  { value: "RESTAURANT", label: "餐廳" },
  { value: "HOTEL", label: "住宿" },
  { value: "TRANSPORT", label: "交通" },
  { value: "CUSTOM", label: "自訂" },
];

const COST_CATEGORY_OPTIONS: { value: CostCategoryValue; label: string }[] = [
  { value: "TRANSPORT", label: "交通" },
  { value: "FOOD", label: "餐飲" },
  { value: "LODGING", label: "住宿" },
  { value: "TICKET", label: "門票" },
  { value: "SHOPPING", label: "購物" },
  { value: "OTHER", label: "其他" },
];

const CURRENCY_OPTIONS = ["TWD", "JPY", "USD"];

const DEFAULT_COST_CATEGORY: Record<ItemTypeValue, CostCategoryValue> = {
  PLACE: "TICKET",
  RESTAURANT: "FOOD",
  HOTEL: "LODGING",
  TRANSPORT: "TRANSPORT",
  CUSTOM: "OTHER",
};

export type EditableItem = {
  id: string;
  type: string;
  startTime: string | Date | null;
  endTime: string | Date | null;
  note: string | null;
  confirmationNumber: string | null;
  cost: number | null;
  currency: string | null;
  costCategory: string | null;
  placeName: string | null;
};

export type SavedItemResult = {
  id: string;
  type: ItemTypeValue;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  confirmationNumber: string | null;
  cost: number | null;
  currency: string | null;
  costCategory: CostCategoryValue | null;
};

const CONFIRMATION_LABEL: Record<ItemTypeValue, string> = {
  HOTEL: "訂房編號",
  TRANSPORT: "航班/車票編號",
  PLACE: "票券編號",
  RESTAURANT: "訂位編號",
  CUSTOM: "確認碼/編號",
};

function toHHMM(value: string | Date | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(11, 16);
}

export default function EditItemModal({
  tripId,
  dayId,
  dayDate,
  item,
  onClose,
  onSaved,
}: {
  tripId: string;
  dayId: string;
  dayDate: string;
  item: EditableItem | null;
  onClose: () => void;
  onSaved: (result: SavedItemResult) => void;
}) {
  const [type, setType] = useState<ItemTypeValue>(
    (item?.type as ItemTypeValue) ?? "CUSTOM"
  );
  const [startTime, setStartTime] = useState(toHHMM(item?.startTime ?? null));
  const [endTime, setEndTime] = useState(toHHMM(item?.endTime ?? null));
  const [note, setNote] = useState(item?.note ?? "");
  const [confirmationNumber, setConfirmationNumber] = useState(
    item?.confirmationNumber ?? ""
  );
  const [cost, setCost] = useState(item?.cost != null ? String(item.cost) : "");
  const [currency, setCurrency] = useState(item?.currency ?? "TWD");
  const [costCategory, setCostCategory] = useState<CostCategoryValue>(
    (item?.costCategory as CostCategoryValue) ??
      DEFAULT_COST_CATEGORY[(item?.type as ItemTypeValue) ?? "CUSTOM"]
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function toIso(hhmm: string): string | null {
    if (!hhmm) return null;
    return `${dayDate}T${hhmm}:00`;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!item && !note.trim()) {
      setError("請填寫項目說明");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const startIso = toIso(startTime);
      const endIso = toIso(endTime);
      const costValue = cost.trim() ? Number(cost) : null;

      if (item) {
        await updateItem(tripId, item.id, {
          type,
          startTime: startIso,
          endTime: endIso,
          note,
          confirmationNumber,
          cost: costValue,
          currency,
          costCategory,
        });
        onSaved({
          id: item.id,
          type,
          startTime: startIso,
          endTime: endIso,
          note: note.trim() || null,
          confirmationNumber: confirmationNumber.trim() || null,
          cost: costValue,
          currency: costValue != null ? currency : null,
          costCategory: costValue != null ? costCategory : null,
        });
      } else {
        const created = await addCustomItem(tripId, dayId, {
          type,
          note,
          startTime: startIso,
          endTime: endIso,
          confirmationNumber,
          cost: costValue,
          currency,
          costCategory,
        });
        onSaved({
          id: created.id,
          type,
          startTime: startIso,
          endTime: endIso,
          note: note.trim() || null,
          confirmationNumber: confirmationNumber.trim() || null,
          cost: costValue,
          currency: costValue != null ? currency : null,
          costCategory: costValue != null ? costCategory : null,
        });
      }
      onClose();
    } catch {
      setError("儲存失敗，請再試一次");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">
            {item ? (item.placeName ?? "編輯項目") : "新增自訂項目"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">
              類型
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ItemTypeValue)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600">
                開始時間
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600">
                結束時間
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600">
                費用
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="選填"
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="w-20">
              <label className="block text-xs font-medium text-slate-600">
                幣別
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600">
                費用類型
              </label>
              <select
                value={costCategory}
                onChange={(e) =>
                  setCostCategory(e.target.value as CostCategoryValue)
                }
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                {COST_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">
              {CONFIRMATION_LABEL[type]}
            </label>
            <input
              type="text"
              value={confirmationNumber}
              onChange={(e) => setConfirmationNumber(e.target.value)}
              placeholder="選填"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">
              備註{!item && "（例如：買票、集合、Check-in）"}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={item ? "" : "買票 / 集合 / Check-in ..."}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {isSaving ? "儲存中…" : "儲存"}
          </button>
        </form>
      </div>
    </div>
  );
}
