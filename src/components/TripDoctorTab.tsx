"use client";

import { CheckCircle2, TriangleAlert, Info } from "lucide-react";
import type { DoctorFinding } from "@/lib/tripDoctor";
import EmptyState from "./EmptyState";

// Groups by dayIndex (findings arrive already ordered day-by-day, check-
// by-check within a day — Object.entries preserves insertion order for
// numeric-looking string keys inconsistently, so this collects into a Map
// keyed by dayIndex instead of relying on that).
function groupByDay(findings: DoctorFinding[]): Map<number, DoctorFinding[]> {
  const map = new Map<number, DoctorFinding[]>();
  for (const finding of findings) {
    const existing = map.get(finding.dayIndex);
    if (existing) existing.push(finding);
    else map.set(finding.dayIndex, [finding]);
  }
  return map;
}

export default function TripDoctorTab({ findings }: { findings: DoctorFinding[] }) {
  if (findings.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="太棒了，沒有發現問題！"
        description="這趟行程目前看起來很順，時間、交通、天氣都沒有明顯衝突"
      />
    );
  }

  const byDay = groupByDay(findings);
  const dayIndexes = [...byDay.keys()].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {dayIndexes.map((dayIndex) => (
        <div
          key={dayIndex}
          className="rounded-card-lg border border-line bg-surface p-4 shadow-sm"
        >
          <h3 className="text-sm font-bold text-ink-900">Day {dayIndex}</h3>
          <ul className="mt-2 space-y-2">
            {byDay.get(dayIndex)!.map((finding, i) => (
              <li
                key={i}
                className={`flex items-start gap-2 text-sm ${
                  finding.severity === "issue" ? "text-red-600" : "text-amber-700"
                }`}
              >
                {finding.severity === "issue" ? (
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>{finding.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
