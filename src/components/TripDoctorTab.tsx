"use client";

import { useState } from "react";
import { CheckCircle2, TriangleAlert, Info, Sparkles } from "lucide-react";
import type { DoctorFinding } from "@/lib/tripDoctor";
import { summarizeTripDoctorFindings, type DoctorSummaryResult } from "@/app/trips/aiActions";
import EmptyState from "./EmptyState";
import { Skeleton } from "./LoadingSkeleton";

type LoadedSummary = Extract<DoctorSummaryResult, { ok: true }>;

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

export default function TripDoctorTab({
  tripId,
  findings,
}: {
  tripId: string;
  findings: DoctorFinding[];
}) {
  const [summary, setSummary] = useState<LoadedSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  async function handleSummarize() {
    setIsSummarizing(true);
    setSummaryError(null);
    const res = await summarizeTripDoctorFindings(
      tripId,
      findings.map((f) => ({
        dayIndex: f.dayIndex,
        severity: f.severity,
        message: f.message,
      }))
    );
    setIsSummarizing(false);
    if (res.ok) setSummary(res);
    else setSummaryError(res.error);
  }

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

  // Counts drive the overall verdict — derived, never an invented score
  // (the spec itself warns against fabricated percentages).
  const issueCount = findings.filter((f) => f.severity === "issue").length;
  const noticeCount = findings.length - issueCount;
  const verdict =
    issueCount > 0
      ? {
          icon: TriangleAlert,
          title: `有 ${issueCount} 個項目需要調整`,
          className: "border-danger-100 bg-danger-50 text-danger-600",
        }
      : {
          icon: Info,
          title: `整體狀況良好，${noticeCount} 個提醒留意一下`,
          className: "border-warning-100 bg-warning-50 text-warning-700",
        };
  const VerdictIcon = verdict.icon;

  return (
    <div className="space-y-4">
      <div className={`rounded-card-lg border p-4 ${verdict.className}`}>
        <p className="flex items-center gap-2 text-sm font-bold">
          <VerdictIcon className="h-5 w-5 shrink-0" />
          {verdict.title}
        </p>
        <p className="mt-1 text-xs opacity-80">
          需要調整 {issueCount} 項・建議注意 {noticeCount} 項
        </p>
      </div>

      {!summary ? (
        <div>
          <button
            type="button"
            onClick={handleSummarize}
            disabled={isSummarizing}
            className="flex items-center gap-1.5 rounded-lg border border-accent-100 bg-accent-50 px-3 py-1.5 text-xs font-medium text-accent-700 hover:bg-accent-100 disabled:opacity-50"
          >
            <Sparkles className={`h-3.5 w-3.5 ${isSummarizing ? "animate-pulse" : ""}`} />
            {isSummarizing ? "AI 統整中…" : "✨ AI 幫我總結，排出優先順序"}
          </button>
          {/* Previews the shape of the summary card about to replace this
              button, instead of a blank gap while the request is in flight. */}
          {isSummarizing && (
            <div className="mt-1.5 space-y-2 rounded-lg border border-accent-100 bg-accent-50 p-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          )}
          {summaryError && <p className="mt-1.5 text-xs text-danger-600">{summaryError}</p>}
        </div>
      ) : (
        <div className="rounded-lg border border-accent-100 bg-accent-50 p-3 text-sm">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-700">
            <Sparkles className="h-3.5 w-3.5" />
            AI 總結建議
          </p>
          <p className="mt-1.5 text-ink-700">{summary.overview}</p>
          {summary.priorities.length > 0 && (
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-ink-700">
              {summary.priorities.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          )}
        </div>
      )}

      {dayIndexes.map((dayIndex) => {
        const dayFindings = byDay.get(dayIndex)!;
        const dayHasIssue = dayFindings.some((f) => f.severity === "issue");
        return (
          <div
            key={dayIndex}
            className="rounded-card-lg border border-line bg-surface p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-ink-900">Day {dayIndex}</h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  dayHasIssue
                    ? "bg-danger-50 text-danger-600"
                    : "bg-warning-50 text-warning-700"
                }`}
              >
                {dayHasIssue ? "需要調整" : "建議注意"}
              </span>
            </div>
            <ul className="mt-2.5 space-y-1.5">
              {dayFindings.map((finding, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-2 rounded-lg px-2.5 py-2 text-sm ${
                    finding.severity === "issue"
                      ? "bg-danger-50 text-danger-600"
                      : "bg-warning-50 text-warning-700"
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
        );
      })}
    </div>
  );
}
