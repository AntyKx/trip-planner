"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, RefreshCw, X } from "lucide-react";
import {
  addChecklistItem,
  updateChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  assignChecklistItem,
  generateChecklistForTrip,
} from "@/app/trips/[id]/checklistActions";
import {
  CHECKLIST_CATEGORY_LABEL,
  CHECKLIST_CATEGORY_ICON,
  CHECKLIST_CATEGORY_COLOR,
  CHECKLIST_CATEGORY_ORDER,
} from "@/lib/labels";
import type { ChecklistCategoryValue } from "@/lib/checklistTemplates";

export type ChecklistItemView = {
  id: string;
  title: string;
  category: ChecklistCategoryValue;
  note: string | null;
  isDone: boolean;
  assignedToId: string | null;
  assignedToName: string | null;
  dueDate: string | null; // ISO date, e.g. "2026-08-01"
  sortOrder: number;
};

export type ChecklistMember = { userId: string; name: string };

function dueDateBadge(dueDate: string | null, isDone: boolean) {
  if (!dueDate || isDone) return null;
  const today = new Date().toISOString().slice(0, 10);
  const due = dueDate.slice(0, 10);
  const displayDate = `${due.slice(5, 7)}/${due.slice(8, 10)}`;
  if (due < today) {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
        已逾期 · {displayDate}
      </span>
    );
  }
  const daysUntil =
    (new Date(due).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntil <= 3) {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        即將到期 · {displayDate}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
      {displayDate}
    </span>
  );
}

function ItemEditForm({
  item,
  members,
  onCancel,
  onSaved,
}: {
  item: ChecklistItemView;
  members: ChecklistMember[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState<ChecklistCategoryValue>(item.category);
  const [note, setNote] = useState(item.note ?? "");
  const [dueDate, setDueDate] = useState(item.dueDate?.slice(0, 10) ?? "");
  const [assignedToId, setAssignedToId] = useState(item.assignedToId ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      await updateChecklistItem(item.id, {
        title,
        category,
        note: note.trim() || null,
        dueDate: dueDate || null,
      });
      if (assignedToId !== (item.assignedToId ?? "")) {
        await assignChecklistItem(item.id, assignedToId || null);
      }
      onSaved();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="項目名稱"
        className="rounded-md border border-slate-200 px-2 py-1 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ChecklistCategoryValue)}
          className="rounded-md border border-slate-200 px-2 py-1 text-sm"
        >
          {CHECKLIST_CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {CHECKLIST_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-md border border-slate-200 px-2 py-1 text-sm"
        />
        <select
          value={assignedToId}
          onChange={(e) => setAssignedToId(e.target.value)}
          className="rounded-md border border-slate-200 px-2 py-1 text-sm"
        >
          <option value="">未指派</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="備註"
        className="rounded-md border border-slate-200 px-2 py-1 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isPending ? "儲存中…" : "儲存"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          取消
        </button>
      </div>
    </form>
  );
}

export default function ChecklistTab({
  tripId,
  items,
  members,
  canEdit,
}: {
  tripId: string;
  items: ChecklistItemView[];
  members: ChecklistMember[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<ChecklistCategoryValue>("CUSTOM");

  const doneCount = items.filter((i) => i.isDone).length;
  const total = items.length;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  function handleToggle(item: ChecklistItemView) {
    startTransition(async () => {
      await toggleChecklistItem(item.id, !item.isDone);
      router.refresh();
    });
  }

  function handleDelete(item: ChecklistItemView) {
    if (!confirm(`確定要刪除「${item.title}」嗎？`)) return;
    startTransition(async () => {
      await deleteChecklistItem(item.id);
      router.refresh();
    });
  }

  function handleAddSubmit(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    startTransition(async () => {
      await addChecklistItem(tripId, { title: newTitle, category: newCategory });
      setNewTitle("");
      setNewCategory("CUSTOM");
      setShowAddForm(false);
      router.refresh();
    });
  }

  function handleGenerate() {
    startTransition(async () => {
      await generateChecklistForTrip(tripId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-ink-700">
            已完成 {doneCount} / {total}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isPending}
              className="flex items-center gap-1 text-xs text-brand-600 hover:underline disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              補上目的地清單
            </button>
          )}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {CHECKLIST_CATEGORY_ORDER.map((category) => {
        const categoryItems = items
          .filter((i) => i.category === category)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        if (categoryItems.length === 0) return null;
        const Icon = CHECKLIST_CATEGORY_ICON[category];
        const color = CHECKLIST_CATEGORY_COLOR[category];

        return (
          <div key={category} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3
              className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${color.bg} ${color.text} w-fit`}
            >
              <Icon className="h-3.5 w-3.5" />
              {CHECKLIST_CATEGORY_LABEL[category]}
            </h3>

            <ul className="mt-3 space-y-2">
              {categoryItems.map((item) => (
                <li key={item.id} className="rounded-lg border border-slate-100 p-2.5">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={item.isDone}
                      disabled={!canEdit || isPending}
                      onChange={() => handleToggle(item)}
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium ${
                          item.isDone ? "text-slate-400 line-through" : "text-ink-900"
                        }`}
                      >
                        {item.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {dueDateBadge(item.dueDate, item.isDone)}
                        {item.assignedToName && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            👤 {item.assignedToName}
                          </span>
                        )}
                      </div>
                      {item.note && (
                        <p className="mt-1 text-xs text-slate-500">{item.note}</p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingId(editingId === item.id ? null : item.id)
                          }
                          aria-label="編輯項目"
                          className="flex min-h-8 min-w-8 items-center justify-center text-ink-500 hover:text-brand-600"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          aria-label="刪除項目"
                          className="flex min-h-8 min-w-8 items-center justify-center text-ink-500 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {canEdit && editingId === item.id && (
                    <ItemEditForm
                      item={item}
                      members={members}
                      onCancel={() => setEditingId(null)}
                      onSaved={() => {
                        setEditingId(null);
                        router.refresh();
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {total === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
          還沒有清單項目。
        </p>
      )}

      {canEdit && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {showAddForm ? (
            <form onSubmit={handleAddSubmit} className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="新增項目名稱"
                  className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                />
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as ChecklistCategoryValue)}
                  className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                >
                  {CHECKLIST_CATEGORY_ORDER.map((c) => (
                    <option key={c} value={c}>
                      {CHECKLIST_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  新增
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  <X className="h-3.5 w-3.5" />
                  取消
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
            >
              <Plus className="h-4 w-4" />
              新增自訂項目
            </button>
          )}
        </div>
      )}
    </div>
  );
}
