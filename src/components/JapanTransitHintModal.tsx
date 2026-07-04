"use client";

import { ExternalLink, MapPin, X } from "lucide-react";
import type { JapanTransitStationHint } from "@/app/trips/actions";
import ModalOverlay from "./ModalOverlay";

const WALK_KMH = 4.5;

function walkMinutes(meters: number): number {
  return Math.max(1, Math.round((meters / 1000 / WALK_KMH) * 60));
}

function StationRow({
  label,
  stations,
}: {
  label: string;
  stations: JapanTransitStationHint[];
}) {
  return (
    <div className="flex items-start gap-2">
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-xs text-slate-500">{label}</p>
        {stations.map((station, i) => (
          <div key={`${station.name}-${i}`}>
            <p className="font-medium text-ink-900">
              {station.name}
              {station.lines.map((line) => (
                <span
                  key={line}
                  className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600"
                >
                  {line}
                </span>
              ))}
            </p>
            <p className="text-xs text-slate-500">
              步行約 {station.walkMeters} 公尺（約{" "}
              {walkMinutes(station.walkMeters)} 分鐘）
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function JapanTransitHintModal({
  fromPlaceName,
  toPlaceName,
  isLoading,
  error,
  from,
  to,
  sameLine,
  externalUrl,
  onClose,
}: {
  fromPlaceName: string;
  toPlaceName: string;
  isLoading: boolean;
  error: string | null;
  from: JapanTransitStationHint[] | null;
  to: JapanTransitStationHint[] | null;
  sameLine: boolean;
  externalUrl: string | null;
  onClose: () => void;
}) {
  return (
    <ModalOverlay
      onClose={onClose}
      titleId="japan-transit-hint-modal-title"
      panelClassName="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden"
    >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 id="japan-transit-hint-modal-title" className="min-w-0 truncate text-base font-bold text-ink-900">
            {fromPlaceName} → {toPlaceName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-slate-400 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          {isLoading && <p className="text-sm text-slate-500">查詢中…</p>}
          {!isLoading && error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {!isLoading && from && to && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                資料來源：駅すぱあと（Ekispert）。免費方案只提供附近車站與所屬路線，正確搭乘時間、轉乘站與票價請按下方連結查看完整建議。
              </p>

              <div className="space-y-4 rounded-xl border border-slate-200 p-3">
                <StationRow label="起點附近車站（可選其一搭乘）" stations={from} />
                <StationRow label="終點附近車站（可選其一下車）" stations={to} />
              </div>

              {sameLine ? (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  兩個車站在同一條路線上，應該不用轉乘。
                </p>
              ) : (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  兩個車站不在同一條路線，可能需要轉乘。
                </p>
              )}

              {externalUrl && (
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-brand-600 hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  在 Ekispert 查看完整轉乘時間與票價
                </a>
              )}
            </div>
          )}
        </div>
    </ModalOverlay>
  );
}
