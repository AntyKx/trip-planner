"use client";

import { useState } from "react";
import { ChevronRight, Wallet } from "lucide-react";
import AppModal from "./AppModal";
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

export default function BudgetSummary({ days }: { days: BoardDay[] }) {
  const [showDetail, setShowDetail] = useState(false);
  const [detailDay, setDetailDay] = useState("all");
  const costs = days.flatMap((d) => d.timelineItems).flatMap((i) => i.costs);

  if (costs.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-700">
          <Wallet className="h-4 w-4" />
          預算統計
        </h3>
        <p className="mt-3 text-sm text-ink-400">
          還沒有任何花費紀錄，編輯項目時可以填寫費用。
        </p>
      </div>
    );
  }

  const totalsByCurrency = new Map<string, number>();
  const totalsByCategory = new Map<string, Map<string, number>>();

  for (const cost of costs) {
    const currency = cost.currency || "TWD";
    const category = cost.category || "OTHER";

    totalsByCurrency.set(
      currency,
      (totalsByCurrency.get(currency) ?? 0) + cost.amount,
    );

    if (!totalsByCategory.has(currency))
      totalsByCategory.set(currency, new Map());
    const categoryMap = totalsByCategory.get(currency)!;
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + cost.amount);
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setShowDetail(true)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-700">
          <Wallet className="h-4 w-4" />
          預算統計
        </span>
        <span className="flex items-center text-xs text-brand-600">
          查看明細
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </button>

      <div className="mt-3 space-y-4">
        {Array.from(totalsByCurrency.entries()).map(([currency, total]) => (
          <div key={currency}>
            <p className="text-lg font-bold text-ink-900">
              {currency} {total.toLocaleString()}
            </p>
            <ul className="mt-1 space-y-1">
              {Array.from(totalsByCategory.get(currency)!.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([category, amount]) => (
                  <li
                    key={category}
                    className="flex items-center justify-between text-xs text-ink-700"
                  >
                    <span>{CATEGORY_LABEL[category] ?? category}</span>
                    <span>{amount.toLocaleString()}</span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      {showDetail && (
        <AppModal
          titleId="budget-detail-title"
          title="花費明細"
          onClose={() => setShowDetail(false)}
        >
          {(() => {
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
            // Per-currency subtotal for whatever the tab currently shows —
            // mixing currencies into one number would be meaningless.
            const subtotals = new Map<string, number>();
            for (const { rows } of shown)
              for (const item of rows)
                for (const c of item.costs) {
                  const cur = c.currency || "TWD";
                  subtotals.set(cur, (subtotals.get(cur) ?? 0) + c.amount);
                }
            return (
              <>
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
                      <h3 className="text-sm font-semibold text-ink-900">
                        第 {day.dayIndex} 天
                        <span className="ml-1.5 text-xs font-normal text-ink-500">
                          {day.date.slice(0, 10)}
                        </span>
                      </h3>
                      <ul className="mt-2 space-y-3">
                        {rows.map((item) => (
                          <li
                            key={item.id}
                            className="rounded-lg border border-line p-3"
                          >
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
                                    {CATEGORY_LABEL[cost.category] ??
                                      cost.category}
                                    {cost.label ? `・${cost.label}` : ""}
                                  </span>
                                  <span className="shrink-0 font-medium">
                                    {cost.currency || "TWD"}{" "}
                                    {cost.amount.toLocaleString()}
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
              </>
            );
          })()}
        </AppModal>
      )}
    </div>
  );
}
