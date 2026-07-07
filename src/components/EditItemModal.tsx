"use client";

import { useState, type FormEvent } from "react";
import { TriangleAlert, X } from "lucide-react";
import {
  updateItem,
  addCustomItem,
  type ItemTypeValue,
  type CostCategoryValue,
} from "@/app/trips/actions";
import { isTimeOutsideHours, weekdayLabel, type OpeningPeriod } from "@/lib/businessHours";
import ModalOverlay from "./ModalOverlay";

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
  placeOpenHours: string | null;
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

  // Non-blocking hints, not validation — the user can save regardless.
  const openPeriods: OpeningPeriod[] | null = (() => {
    if (!item?.placeOpenHours) return null;
    try {
      return JSON.parse(item.placeOpenHours);
    } catch {
      return null;
    }
  })();
  const dayDateObj = new Date(`${dayDate}T00:00:00`);
  const startTimeWarning =
    openPeriods && startTime && isTimeOutsideHours(openPeriods, dayDateObj, startTime)
      ? `${weekdayLabel(dayDateObj)}的開始時間可能超出營業時間`
      : null;
  const endTimeWarning =
    openPeriods && endTime && isTimeOutsideHours(openPeriods, dayDateObj, endTime)
      ? `${weekdayLabel(dayDateObj)}的結束時間可能超出營業時間`
      : null;

  // Labeling this "Z" (UTC) is what makes it unambiguous — these times are
  // really just wall-clock digits with no true timezone, but a bare
  // "YYYY-MM-DDTHH:mm:00" string is parsed by `new Date()` as *local time
  // of whatever environment does the parsing*: UTC on the server (where
  // this gets saved), but the browser's own zone when the same string is
  // re-parsed client-side after a save (see handleItemSaved in
  // DayTimeline.tsx, which stores this raw string, not a Date object) —
  // that mismatch was silently shifting the displayed time by the
  // browser's UTC offset until the next full page reload. Appending "Z"
  // forces every parse, wherever it happens, to agree on the same instant.
  function toIso(hhmm: string): string | null {
    if (!hhmm) return null;
    return `${dayDate}T${hhmm}:00Z`;
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
      // Number("1e") is NaN and type=number inputs still allow "-" and
      // "e" to be typed — treat anything unparseable or negative as "no
      // cost entered" instead of persisting garbage.
      const parsedCost = Number(cost);
      const costValue =
        cost.trim() && Number.isFinite(parsedCost) && parsedCost >= 0
          ? parsedCost
          : null;

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
    <ModalOverlay
      onClose={onClose}
      titleId="edit-item-modal-title"
      panelClassName="w-full max-w-md p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="edit-item-modal-title" className="text-lg font-bold text-ink-900">
          {item ? (item.placeName ?? "編輯項目") : "新增自訂項目"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉"
          className="flex min-h-11 min-w-11 items-center justify-center text-slate-400 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="edit-item-type" className="block text-xs font-medium text-slate-600">
            類型
          </label>
          <select
            id="edit-item-type"
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
            <label htmlFor="edit-item-start" className="block text-xs font-medium text-slate-600">
              開始時間
            </label>
            <input
              id="edit-item-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
            {startTimeWarning && (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                {startTimeWarning}
              </p>
            )}
          </div>
          <div className="flex-1">
            <label htmlFor="edit-item-end" className="block text-xs font-medium text-slate-600">
              結束時間
            </label>
            <input
              id="edit-item-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
            {endTimeWarning && (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                {endTimeWarning}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="edit-item-cost" className="block text-xs font-medium text-slate-600">
              費用
            </label>
            <input
              id="edit-item-cost"
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
            <label htmlFor="edit-item-currency" className="block text-xs font-medium text-slate-600">
              幣別
            </label>
            <select
              id="edit-item-currency"
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
            <label htmlFor="edit-item-cost-category" className="block text-xs font-medium text-slate-600">
              費用類型
            </label>
            <select
              id="edit-item-cost-category"
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
          <label htmlFor="edit-item-confirmation" className="block text-xs font-medium text-slate-600">
            {CONFIRMATION_LABEL[type]}
          </label>
          <input
            id="edit-item-confirmation"
            type="text"
            value={confirmationNumber}
            onChange={(e) => setConfirmationNumber(e.target.value)}
            placeholder="選填"
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="edit-item-note" className="block text-xs font-medium text-slate-600">
            備註{!item && "（例如：買票、集合、Check-in）"}
          </label>
          <textarea
            id="edit-item-note"
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
          className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isSaving ? "儲存中…" : "儲存"}
        </button>
      </form>
    </ModalOverlay>
  );
}
