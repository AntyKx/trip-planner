"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ChevronDown, ChevronUp, Plus, ScanText, TriangleAlert, X } from "lucide-react";
import {
  updateItem,
  addCustomItem,
  type ItemTypeValue,
  type CostCategoryValue,
  type ItemCostInput,
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

export type EditableCost = {
  label: string | null;
  amount: number;
  currency: string;
  category: string;
};

export type EditableItem = {
  id: string;
  type: string;
  startTime: string | Date | null;
  endTime: string | Date | null;
  note: string | null;
  confirmationNumber: string | null;
  costs: EditableCost[];
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
  costs: ItemCostInput[];
};

// Local editing row — `amount` stays a string so the input can hold
// intermediate states ("", "12.") without fighting the user; converted on
// submit. `key` is only for React list identity (rows are added/removed).
type CostRow = {
  key: number;
  label: string;
  amount: string;
  currency: string;
  category: CostCategoryValue;
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
  // Initial rows are keyed by index; the ref continues the sequence for
  // rows added later (only ever bumped inside event handlers).
  const nextCostKey = useRef((item?.costs ?? []).length);
  const [costs, setCosts] = useState<CostRow[]>(() =>
    (item?.costs ?? []).map((c, index) => ({
      key: index,
      label: c.label ?? "",
      amount: String(c.amount),
      currency: c.currency,
      category: (c.category as CostCategoryValue) ?? "OTHER",
    }))
  );
  // Accordion: rows render as one-line summaries so a long cost list stays
  // short; only the row being edited is expanded (newly added rows expand
  // automatically). null = everything collapsed.
  const [expandedCostKey, setExpandedCostKey] = useState<number | null>(null);
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

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setScanError("請選擇圖片或 PDF 檔案");
      return;
    }
    // Raw-file cap, well under the ~6MB base64 body-size limit configured
    // in next.config.ts (base64 inflates size by ~4/3).
    if (file.size > 4 * 1024 * 1024) {
      setScanError("檔案太大，建議截圖而非直接拍照，或裁切/縮小後再試");
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
      // Appended as a new entry rather than overwriting — the item may
      // already carry other costs the screenshot knows nothing about.
      if (result.cost != null) {
        const amount = result.cost;
        const rowCurrency = result.currency ?? "TWD";
        const key = nextCostKey.current++;
        setCosts((prev) => [
          ...prev,
          {
            key,
            label: "",
            amount: String(amount),
            currency: CURRENCY_OPTIONS.includes(rowCurrency) ? rowCurrency : "TWD",
            category: DEFAULT_COST_CATEGORY[type],
          },
        ]);
        setExpandedCostKey(key);
      }
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

  function addCostRow() {
    const key = nextCostKey.current++;
    setCosts((prev) => [
      ...prev,
      {
        key,
        label: "",
        amount: "",
        // New rows follow the currently selected item type; existing rows
        // keep whatever the user picked even if the type changes later.
        currency: prev[prev.length - 1]?.currency ?? "TWD",
        category: DEFAULT_COST_CATEGORY[type],
      },
    ]);
    setExpandedCostKey(key);
  }

  function updateCostRow(key: number, patch: Partial<Omit<CostRow, "key">>) {
    setCosts((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  }

  function removeCostRow(key: number) {
    setCosts((prev) => prev.filter((row) => row.key !== key));
    setExpandedCostKey((current) => (current === key ? null : current));
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
      // "e" to be typed — rows whose amount is unparseable or negative are
      // dropped instead of persisting garbage (same rule the old
      // single-cost field applied).
      const costsPayload: ItemCostInput[] = costs
        .map((row) => ({ row, amount: Number(row.amount) }))
        .filter(
          ({ row, amount }) =>
            row.amount.trim() && Number.isFinite(amount) && amount >= 0
        )
        .map(({ row, amount }) => ({
          label: row.label.trim() || null,
          amount,
          currency: row.currency,
          category: row.category,
        }));

      if (item) {
        await updateItem(tripId, item.id, {
          type,
          startTime: startIso,
          endTime: endIso,
          note,
          confirmationNumber,
          costs: costsPayload,
        });
        onSaved({
          id: item.id,
          type,
          startTime: startIso,
          endTime: endIso,
          note: note.trim() || null,
          confirmationNumber: confirmationNumber.trim() || null,
          costs: costsPayload,
        });
      } else {
        const created = await addCustomItem(tripId, dayId, {
          type,
          note,
          startTime: startIso,
          endTime: endIso,
          confirmationNumber,
          costs: costsPayload,
        });
        onSaved({
          id: created.id,
          type,
          startTime: startIso,
          endTime: endIso,
          note: note.trim() || null,
          confirmationNumber: confirmationNumber.trim() || null,
          costs: costsPayload,
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
          accept="image/*,application/pdf"
          capture="environment"
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
          {isScanning ? "辨識中…" : "拍照/上傳訂房票券自動帶入"}
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

        {/* grid (not flex) so the two columns are exact halves: time
            inputs have an intrinsic min-width (inflated further by the
            global 16px input font-size rule in globals.css), and flex
            items refuse to shrink below it — the two fields ended up
            overlapping on narrow screens. min-w-0 lets the inputs shrink
            inside their track instead. */}
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor="edit-item-start" className="block text-xs font-medium text-ink-700">
              開始時間
            </label>
            <input
              id="edit-item-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 w-full min-w-0 rounded-md border border-line px-2 py-2 text-sm"
            />
            {startTimeWarning && (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                {startTimeWarning}
              </p>
            )}
          </div>
          <div className="min-w-0">
            <label htmlFor="edit-item-end" className="block text-xs font-medium text-ink-700">
              結束時間
            </label>
            <input
              id="edit-item-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1 w-full min-w-0 rounded-md border border-line px-2 py-2 text-sm"
            />
            {endTimeWarning && (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                {endTimeWarning}
              </p>
            )}
          </div>
        </div>

        <div>
          <span className="block text-xs font-medium text-ink-700">花費</span>
          <div className="mt-1 space-y-1.5">
            {costs.map((row) => {
              const isExpanded = expandedCostKey === row.key;
              const categoryLabel =
                COST_CATEGORY_OPTIONS.find((o) => o.value === row.category)?.label ??
                row.category;
              if (!isExpanded) {
                return (
                  <div
                    key={row.key}
                    className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedCostKey(row.key)}
                      aria-label="展開編輯這筆花費"
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs text-ink-700"
                    >
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                      <span className="truncate">
                        {row.label.trim() || categoryLabel}
                      </span>
                      <span className="ml-auto shrink-0 font-medium text-amber-700">
                        {row.amount.trim()
                          ? `${row.currency} ${Number(row.amount).toLocaleString()}`
                          : "未填金額"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCostRow(row.key)}
                      aria-label="刪除這筆花費"
                      className="shrink-0 rounded-md p-1 text-ink-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              }
              return (
                <div key={row.key} className="rounded-lg border border-brand-200 p-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedCostKey(null)}
                      aria-label="收合這筆花費"
                      className="shrink-0 rounded-md p-1 text-ink-500 hover:bg-paper-alt"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) =>
                        updateCostRow(row.key, { label: e.target.value })
                      }
                      maxLength={30}
                      placeholder="名稱（選填），例如 午餐"
                      aria-label="花費名稱"
                      className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeCostRow(row.key)}
                      aria-label="刪除這筆花費"
                      className="shrink-0 rounded-md p-1.5 text-ink-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={row.amount}
                      onChange={(e) =>
                        updateCostRow(row.key, { amount: e.target.value })
                      }
                      placeholder="金額"
                      aria-label="金額"
                      className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-sm"
                    />
                    <select
                      value={row.currency}
                      onChange={(e) =>
                        updateCostRow(row.key, { currency: e.target.value })
                      }
                      aria-label="幣別"
                      className="w-20 rounded-md border border-line px-2 py-1.5 text-sm"
                    >
                      {CURRENCY_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <select
                      value={row.category}
                      onChange={(e) =>
                        updateCostRow(row.key, {
                          category: e.target.value as CostCategoryValue,
                        })
                      }
                      aria-label="費用類型"
                      className="w-24 rounded-md border border-line px-2 py-1.5 text-sm"
                    >
                      {COST_CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
            {costs.length < 20 && (
              <button
                type="button"
                onClick={addCostRow}
                className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                新增一筆花費
              </button>
            )}
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
