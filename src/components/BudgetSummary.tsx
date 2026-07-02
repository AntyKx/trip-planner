"use client";

import { Wallet } from "lucide-react";
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
  const items = days.flatMap((d) => d.timelineItems).filter((i) => i.cost != null);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-700">
          <Wallet className="h-4 w-4" />
          預算統計
        </h3>
        <p className="mt-3 text-sm text-slate-400">
          還沒有任何花費紀錄，編輯項目時可以填寫費用。
        </p>
      </div>
    );
  }

  const totalsByCurrency = new Map<string, number>();
  const totalsByCategory = new Map<string, Map<string, number>>();

  for (const item of items) {
    const currency = item.currency ?? "TWD";
    const category = item.costCategory ?? "OTHER";
    const cost = item.cost as number;

    totalsByCurrency.set(currency, (totalsByCurrency.get(currency) ?? 0) + cost);

    if (!totalsByCategory.has(currency)) totalsByCategory.set(currency, new Map());
    const categoryMap = totalsByCategory.get(currency)!;
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + cost);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-700">
        <Wallet className="h-4 w-4" />
        預算統計
      </h3>

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
                    className="flex items-center justify-between text-xs text-slate-600"
                  >
                    <span>{CATEGORY_LABEL[category] ?? category}</span>
                    <span>{amount.toLocaleString()}</span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
