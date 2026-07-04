"use client";

import { Footprints, X } from "lucide-react";
import type { TransitAlternative } from "@/lib/routeMode";
import { VEHICLE_ICON, VEHICLE_LABEL } from "@/lib/labels";
import ModalOverlay from "./ModalOverlay";

export default function TransitAlternativesModal({
  fromName,
  toName,
  alternatives,
  isLoading,
  error,
  onChoose,
  onClose,
}: {
  fromName: string;
  toName: string;
  alternatives: TransitAlternative[];
  isLoading: boolean;
  error: string | null;
  onChoose: (alt: TransitAlternative) => void;
  onClose: () => void;
}) {
  return (
    <ModalOverlay
      onClose={onClose}
      titleId="transit-alternatives-modal-title"
      panelClassName="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden"
    >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 id="transit-alternatives-modal-title" className="min-w-0 truncate text-base font-bold text-ink-900">
            {fromName} → {toName}
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
          {isLoading && <p className="text-sm text-slate-500">查詢路線中…</p>}
          {!isLoading && error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          {!isLoading && !error && alternatives.length === 0 && (
            <p className="text-sm text-slate-500">找不到大眾運輸路線建議。</p>
          )}

          <div className="space-y-3">
            {alternatives.map((alt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onChoose(alt)}
                className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-brand-400 hover:bg-brand-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-900">
                    {alt.durationMin} 分鐘
                  </span>
                  <span className="text-xs text-slate-500">
                    {alt.distanceKm} km
                    {alt.fareText ? ` · ${alt.fareText}` : ""}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1 text-sm text-slate-700">
                  {alt.steps.map((step, j) => {
                    const StepIcon =
                      step.mode === "WALK"
                        ? Footprints
                        : VEHICLE_ICON[step.vehicleType ?? ""] ?? Footprints;
                    return (
                      <span key={j} className="flex items-center gap-1">
                        {j > 0 && <span className="text-slate-300">→</span>}
                        {step.mode === "WALK" ? (
                          <span className="flex items-center gap-1 text-slate-500">
                            <StepIcon className="h-3.5 w-3.5" />
                            {step.durationMin} 分
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                            <StepIcon className="h-3.5 w-3.5" />
                            {step.lineName ||
                              VEHICLE_LABEL[step.vehicleType ?? ""] ||
                              "大眾運輸"}
                            {step.stops != null && ` · ${step.stops} 站`}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </button>
            ))}
          </div>
        </div>
    </ModalOverlay>
  );
}
