"use client";

// Horizontal scrollable "全部 / Day 1 / Day 2 …" tab strip shared by the
// 旅遊書 and the budget detail modal. Same visual language as the trip
// page's Day Tabs (brand-50 active pill, snap scroll) but self-contained,
// since those are tied to the trip board's own state.
export type DayFilterTab = { id: string; label: string; sub?: string };

export default function DayFilterTabs({
  tabs,
  value,
  onChange,
  ariaLabel = "選擇日期",
}: {
  tabs: DayFilterTab[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 overflow-x-auto border-b border-line snap-x snap-mandatory"
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`shrink-0 snap-start rounded-t-lg border-b-2 px-3 py-2 text-left transition ${
              active
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-transparent text-ink-700 hover:bg-paper-alt"
            }`}
          >
            <div className="text-sm font-semibold">{tab.label}</div>
            {tab.sub && (
              <div className={`text-xs ${active ? "text-brand-600" : "text-ink-500"}`}>
                {tab.sub}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
