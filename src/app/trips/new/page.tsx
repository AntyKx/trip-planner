import Link from "next/link";
import { createTrip } from "../actions";

export default function NewTripPage() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-10">
      <Link href="/" className="text-sm text-ink-700 hover:underline">
        ← 回我的行程
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-ink-900">建立新行程</h1>

      <form action={createTrip} className="mt-6 space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-slate-700">
            行程名稱
          </label>
          <input
            id="title"
            name="title"
            required
            placeholder="例如：東京五日自由行"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="startDate" className="block text-sm font-medium text-slate-700">
              開始日期
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="endDate" className="block text-sm font-medium text-slate-700">
              結束日期
            </label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          建立行程
        </button>
      </form>
    </main>
  );
}
