"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ScanText, TriangleAlert } from "lucide-react";
import {
  updateItem,
  addCustomItem,
  type ItemTypeValue,
  type CostCategoryValue,
} from "@/app/trips/actions";
import { extractConfirmationFromImage } from "@/app/trips/aiActions";
import { isTimeOutsideHours, weekdayLabel, type OpeningPeriod } from "@/lib/businessHours";
import ModalOverlay, { ModalCloseButton, type ModalOverlayHandle } from "./ModalOverlay";
import { useToast } from "./Toast";

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
  const toast = useToast();
  const modalRef = useRef<ModalOverlayHandle>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
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
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Reads a File as a data URL and strips the "data:<mime>;base64," prefix
  // so the server action gets a plain base64 string, not a data URI.
  function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const commaIndex = result.indexOf(",");
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function handleScanFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setScanError("請選擇圖片檔案");
      return;
    }
    // Raw-file cap, well under the ~6MB base64 body-size limit configured
    // in next.config.ts (base64 inflates size by ~4/3).
    if (file.size > 4 * 1024 * 1024) {
      setScanError("圖片太大，建議截圖而非直接拍照，或裁切後再試");
      return;
    }

    setScanError(null);
    setIsScanning(true);
    try {
      const base64 = await readFileAsBase64(file);
      const result = await extractConfirmationFromImage(
        tripId,
        dayId,
        base64,
        file.type
      );
      if (!result.ok) {
        setScanError(result.error);
        return;
      }
      if (result.confirmationNumber) setConfirmationNumber(result.confirmationNumber);
      if (result.cost != null) setCost(String(result.cost));
      if (result.currency) setCurrency(result.currency);
      if (result.startTime) setStartTime(result.startTime);
      if (result.endTime) setEndTime(result.endTime);
      if (result.note && !note.trim()) setNote(result.note);
      toast.success("已自動帶入辨識結果，請確認後再儲存");
    } catch {
      setScanError("辨識失敗，請稍後再試");
    } finally {
      setIsScanning(false);
    }
  }

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
      modalRef.current?.requestClose();
    } catch {
      setError("儲存失敗，請再試一次");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalOverlay
      ref={modalRef}
      onClose={onClose}
      titleId="edit-item-modal-title"
      panelClassName="w-full max-w-md p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="edit-item-modal-title" className="text-lg font-bold text-ink-900">
          {item ? (item.placeName ?? "編輯項目") : "新增自訂項目"}
        </h2>
        <ModalCloseButton />
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-line p-3">
        <input
          ref={scanInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleScanFile}
        />
        <button
          type="button"
          onClick={() => scanInputRef.current?.click()}
          disabled={isScanning}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink-700 hover:bg-paper disabled:opacity-50"
        >
          <ScanText className="h-4 w-4" />
          {isScanning ? "辨識中…" : "上傳訂房/票券截圖自動帶入"}
        </button>
        {scanError && <p className="mt-2 text-xs text-red-500">{scanError}</p>}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="edit-item-type" className="block text-xs font-medium text-ink-700">
            類型
          </label>
          <select
            id="edit-item-type"
            value={type}
            onChange={(e) => setType(e.target.value as ItemTypeValue)}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
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
            <label htmlFor="edit-item-start" className="block text-xs font-medium text-ink-700">
              開始時間
            </label>
            <input
              id="edit-item-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
            />
            {startTimeWarning && (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                {startTimeWarning}
              </p>
            )}
          </div>
          <div className="flex-1">
            <label htmlFor="edit-item-end" className="block text-xs font-medium text-ink-700">
              結束時間
            </label>
            <input
              id="edit-item-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
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
            <label htmlFor="edit-item-cost" className="block text-xs font-medium text-ink-700">
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
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
            />
          </div>
          <div className="w-20">
            <label htmlFor="edit-item-currency" className="block text-xs font-medium text-ink-700">
              幣別
            </label>
            <select
              id="edit-item-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="edit-item-cost-category" className="block text-xs font-medium text-ink-700">
              費用類型
            </label>
            <select
              id="edit-item-cost-category"
              value={costCategory}
              onChange={(e) =>
                setCostCategory(e.target.value as CostCategoryValue)
              }
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
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
          <label htmlFor="edit-item-confirmation" className="block text-xs font-medium text-ink-700">
            {CONFIRMATION_LABEL[type]}
          </label>
          <input
            id="edit-item-confirmation"
            type="text"
            value={confirmationNumber}
            onChange={(e) => setConfirmationNumber(e.target.value)}
            placeholder="選填"
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="edit-item-note" className="block text-xs font-medium text-ink-700">
            備註{!item && "（例如：買票、集合、Check-in）"}
          </label>
          <textarea
            id="edit-item-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={item ? "" : "買票 / 集合 / Check-in ..."}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
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
