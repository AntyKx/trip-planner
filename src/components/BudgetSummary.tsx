"use client";

import { useState } from "react";
import DayFilterTabs from "./DayFilterTabs";
import type { BoardDay } from "./TripDayBoard";

const CATEGORY_LABEL: Record<string, string> = {
  TRANSPORT: "交通",
  FOOD: "餐飲",
  LODGING: "住宿",
  TICKET: "門票",
  SHOPPING: "購物",
  OTHER: "其他",
};

function totalsByCurrency(days: BoardDay[]) {
  const totals = new Map<string, number>();
  for (const cost of days.flatMap((d) => d.timelineItems).flatMap((i) => i.costs)) {
    const currency = cost.currency || "TWD";
    totals.set(currency, (totals.get(currency) ?? 0) + cost.amount);
  }
  return totals;
}

// One-line figure for the toolbar chip (see TripInfoToolbar). Different
// currencies are never added together, and their amounts aren't
// comparable either (¥10,000 vs NT$10,000), so the currency with the most
// entries is shown and the rest collapse into "+N".
export function budgetHeadline(days: BoardDay[]): string | null {
  const costs = days.flatMap((d) => d.timelineItems).flatMap((i) => i.costs);
  if (costs.length === 0) return null;
  const counts = new Map<string, number>();
  for (const c of costs) {
    const cur = c.currency || "TWD";
    counts.set(cur, (counts.get(cur) ?? 0) + 1);
  }
  const currency = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  const total = totalsByCurrency(days).get(currency) ?? 0;
  const more = counts.size > 1 ? ` +${counts.size - 1}` : "";
  return `${currency} ${total.toLocaleString()}${more}`;
}

// Budget sheet body: totals per currency (with category split), then the
// per-day breakdown. Used to be a sidebar card with its own 查看明細 modal;
// now that the whole thing opens as a sheet from the toolbar, the detail
// sits right below the totals instead of a second modal on top.
export default function BudgetSummary({ days }: { days: BoardDay[] }) {
  const [detailDay, setDetailDay] = useState("all");
  const costs = days.flatMap((d) => d.timelineItems).flatMap((i) => i.costs);

  if (costs.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        還沒有任何花費紀錄，編輯項目時可以填寫費用。
      </p>
    );
  }

  const totalsByCategory = new Map<string, Map<string, number>>();
  for (const cost of costs) {
    const currency = cost.currency || "TWD";
    const category = cost.category || "OTHER";
    if (!totalsByCategory.has(currency)) totalsByCategory.set(currency, new Map());
    const categoryMap = totalsByCategory.get(currency)!;
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + cost.amount);
  }

  const daysWithCosts = days
    .map((day) => ({
      day,
      rows: day.timelineItems.filter((i) => i.costs.length > 0),
    }))
    .filter(({ rows }) => rows.length > 0);
  const shown =
    detailDay === "all"
      ? daysWithCosts
      : daysWithCosts.filter(({ day }) => day.id === detailDay);
  // Per-currency subtotal for whatever the tab currently shows — mixing
  // currencies into one number would be meaningless.
  const subtotals = new Map<string, number>();
  for (const { rows } of shown)
    for (const item of rows)
      for (const c of item.costs) {
        const cur = c.currency || "TWD";
        subtotals.set(cur, (subtotals.get(cur) ?? 0) + c.amount);
      }

  return (
    <div>
      <div className="space-y-4">
        {Array.from(totalsByCurrency(days).entries()).map(([currency, total]) => (
          <div key={currency}>
            <p className="text-2xl font-bold text-ink-900 tabular-nums">
              {currency} {total.toLocaleString()}
            </p>
            <ul className="mt-2 divide-y divide-line">
              {Array.from(totalsByCategory.get(currency)!.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => (
                  <li
                    key={category}
                    className="flex items-center justify-between py-1.5 text-sm text-ink-700 tabular-nums"
                  >
                    <span>{CATEGORY_LABEL[category] ?? category}</span>
                    <span>{amount.toLocaleString()}</span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold text-ink-900">每日明細</h3>
      <DayFilterTabs
        value={detailDay}
        onChange={setDetailDay}
        tabs={[
          { id: "all", label: "全部" },
          ...daysWithCosts.map(({ day }) => ({
            id: day.id,
            label: `Day ${day.dayIndex}`,
            sub: day.date.slice(5, 10),
          })),
        ]}
      />
      <p className="mt-3 text-sm font-semibold text-ink-900">
        {detailDay === "all" ? "合計" : "當天合計"}
        {"　"}
        {Array.from(subtotals.entries())
          .map(([cur, total]) => `${cur} ${total.toLocaleString()}`)
          .join(" ＋ ")}
      </p>
      <div className="mt-4 space-y-5">
        {shown.map(({ day, rows }) => (
          <section key={day.id}>
            <h4 className="text-sm font-semibold text-ink-900">
              第 {day.dayIndex} 天
              <span className="ml-1.5 text-xs font-normal text-ink-500">
                {day.date.slice(0, 10)}
              </span>
            </h4>
            <ul className="mt-2 space-y-3">
              {rows.map((item) => (
                <li key={item.id} className="rounded-lg border border-line p-3">
                  <p className="text-sm font-medium text-ink-900">
                    {item.place?.name ?? item.note ?? "未命名項目"}
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {item.costs.map((cost, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-3 text-xs text-ink-700"
                      >
                        <span className="min-w-0 truncate">
                          {CATEGORY_LABEL[cost.category] ?? cost.category}
                          {cost.label ? `・${cost.label}` : ""}
                        </span>
                        <span className="shrink-0 font-medium">
                          {cost.currency || "TWD"} {cost.amount.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
