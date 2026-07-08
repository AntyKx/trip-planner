"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  X,
  TriangleAlert,
  Check,
  ClipboardList,
  GripVertical,
} from "lucide-react";
import {
  addChecklistItem,
  updateChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  assignChecklistItem,
  reorderChecklistItems,
  generateChecklistForTrip,
} from "@/app/trips/[id]/checklistActions";
import {
  CHECKLIST_CATEGORY_LABEL,
  CHECKLIST_CATEGORY_ICON,
  CHECKLIST_CATEGORY_COLOR,
  CHECKLIST_CATEGORY_ORDER,
} from "@/lib/labels";
import type { ChecklistCategoryValue } from "@/lib/checklistTemplates";
import ProgressBar from "./ProgressBar";
import { Avatar } from "./Avatar";
import EmptyState from "./EmptyState";
import { useToast } from "./Toast";
import { localTodayStr } from "@/lib/timeline";

export type ChecklistItemView = {
  id: string;
  title: string;
  category: ChecklistCategoryValue;
  note: string | null;
  isDone: boolean;
  assignedToId: string | null;
  assignedToName: string | null;
  assignedToAvatarUrl: string | null;
  dueDate: string | null; // ISO date, e.g. "2026-08-01"
  sortOrder: number;
};

export type ChecklistMember = { userId: string; name: string; avatarUrl?: string | null };

// Shared by the per-item badge and the top summary banner, so "what counts
// as overdue/soon" is only defined once.
function getDueStatus(
  dueDate: string | null,
  isDone: boolean
): "overdue" | "soon" | "normal" | null {
  if (!dueDate || isDone) return null;
  const today = localTodayStr();
  const due = dueDate.slice(0, 10);
  if (due < today) return "overdue";
  const daysUntil =
    (new Date(due).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24);
  return daysUntil <= 3 ? "soon" : "normal";
}

function dueDateBadge(dueDate: string | null, isDone: boolean) {
  const status = getDueStatus(dueDate, isDone);
  if (!status || !dueDate) return null;
  const due = dueDate.slice(0, 10);
  const displayDate = `${due.slice(5, 7)}/${due.slice(8, 10)}`;
  if (status === "overdue") {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
        已逾期 · {displayDate}
      </span>
    );
  }
  if (status === "soon") {
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

function SortableChecklistItem({
  item,
  canEdit,
  isBusy,
  isEditing,
  members,
  onToggle,
  onToggleEdit,
  onDelete,
  onSaved,
}: {
  item: ChecklistItemView;
  canEdit: boolean;
  isBusy: boolean;
  isEditing: boolean;
  members: ChecklistMember[];
  onToggle: () => void;
  onToggleEdit: () => void;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: !canEdit });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...(canEdit ? attributes : {})}
      {...(canEdit ? listeners : {})}
      className={`group relative touch-manipulation rounded-lg border border-slate-100 bg-surface p-2.5 select-none [-webkit-touch-callout:none] ${
        isDragging ? "shadow-lg" : ""
      }`}
    >
      {canEdit && (
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100">
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      <div className="flex items-start gap-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={item.isDone}
          aria-label={item.isDone ? "標記為未完成" : "標記為已完成"}
          disabled={!canEdit || isBusy}
          onClick={onToggle}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-50 ${
            item.isDone
              ? "border-brand-600 bg-brand-600"
              : "border-slate-300 bg-surface hover:border-brand-400"
          }`}
        >
          <Check
            className={`h-3.5 w-3.5 text-white transition-all duration-150 ${
              item.isDone ? "scale-100 opacity-100" : "scale-0 opacity-0"
            }`}
          />
        </button>
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
              <span className="flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pr-2 pl-0.5 text-xs text-slate-600">
                <Avatar name={item.assignedToName} avatarUrl={item.assignedToAvatarUrl} size="sm" />
                {item.assignedToName}
              </span>
            )}
          </div>
          {item.note && <p className="mt-1 text-xs text-slate-500">{item.note}</p>}
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onToggleEdit}
              aria-label="編輯項目"
              className="flex min-h-8 min-w-8 items-center justify-center text-ink-500 hover:text-brand-600"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="刪除項目"
              className="flex min-h-8 min-w-8 items-center justify-center text-ink-500 hover:text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {canEdit && isEditing && (
        <ItemEditForm
          item={item}
          members={members}
          onCancel={onToggleEdit}
          onSaved={onSaved}
        />
      )}
    </li>
  );
}

export default function ChecklistTab({
  tripId,
  items: initialItems,
  members,
  canEdit,
}: {
  tripId: string;
  items: ChecklistItemView[];
  members: ChecklistMember[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  // Re-syncs whenever fresh data actually arrives from the server (every
  // action below calls router.refresh() except drag-reorder, which mirrors
  // reorderItems in DayTimeline.tsx and skips it on purpose) — initialItems
  // only gets a new reference when page.tsx actually re-runs, not on every
  // local re-render, so this doesn't fight the optimistic drag update below.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(initialItems);
  }, [initialItems]);

  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<ChecklistCategoryValue>("CUSTOM");

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  const doneCount = items.filter((i) => i.isDone).length;
  const total = items.length;
  const overdueCount = items.filter(
    (i) => getDueStatus(i.dueDate, i.isDone) === "overdue"
  ).length;
  const dueSoonCount = items.filter(
    (i) => getDueStatus(i.dueDate, i.isDone) === "soon"
  ).length;

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
      toast.success("已刪除");
      router.refresh();
    });
  }

  function handleAddSubmit(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    startTransition(async () => {
      await addChecklistItem(tripId, { title: newTitle, category: newCategory });
      toast.success("已新增");
      setNewTitle("");
      setNewCategory("CUSTOM");
      setShowAddForm(false);
      router.refresh();
    });
  }

  function handleGenerate() {
    startTransition(async () => {
      await generateChecklistForTrip(tripId);
      toast.success("已更新清單");
      router.refresh();
    });
  }

  // Reordering only ever happens within one category's own DndContext (see
  // render below), so this only needs to renumber that category's subset —
  // sortOrder values are never compared across categories (display always
  // filters by category first), so it's fine for two categories' items to
  // share the same underlying numbers.
  function handleCategoryDragEnd(category: ChecklistCategoryValue) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const categoryItems = items
        .filter((i) => i.category === category)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const oldIndex = categoryItems.findIndex((i) => i.id === active.id);
      const newIndex = categoryItems.findIndex((i) => i.id === over.id);
      const reordered = arrayMove(categoryItems, oldIndex, newIndex);
      const newSortOrder = new Map(reordered.map((it, idx) => [it.id, idx]));

      setItems((prev) =>
        prev.map((it) =>
          newSortOrder.has(it.id) ? { ...it, sortOrder: newSortOrder.get(it.id)! } : it
        )
      );

      // No router.refresh() on purpose, matching reorderItems in
      // src/app/trips/actions.ts — the local optimistic order above is
      // already correct, and refreshing would just re-fetch the whole page.
      startTransition(() => {
        reorderChecklistItems(
          tripId,
          reordered.map((it) => it.id)
        );
      });
    };
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-sm">
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
        <ProgressBar value={doneCount} max={total} className="mt-2" />
        {(overdueCount > 0 || dueSoonCount > 0) && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            {overdueCount > 0 && <span>{overdueCount} 項已逾期</span>}
            {overdueCount > 0 && dueSoonCount > 0 && <span>·</span>}
            {dueSoonCount > 0 && <span>{dueSoonCount} 項即將到期</span>}
          </p>
        )}
      </div>

      {CHECKLIST_CATEGORY_ORDER.map((category) => {
        const categoryItems = items
          .filter((i) => i.category === category)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        if (categoryItems.length === 0) return null;
        const Icon = CHECKLIST_CATEGORY_ICON[category];
        const color = CHECKLIST_CATEGORY_COLOR[category];

        return (
          <div
            key={category}
            className="rounded-xl border border-slate-200 bg-surface p-4 shadow-sm"
          >
            <h3
              className={`flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${color.bg} ${color.text}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {CHECKLIST_CATEGORY_LABEL[category]}
            </h3>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleCategoryDragEnd(category)}
            >
              <SortableContext
                items={categoryItems.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className={`mt-3 space-y-2 ${isPending ? "opacity-70" : ""}`}>
                  {categoryItems.map((item) => (
                    <SortableChecklistItem
                      key={item.id}
                      item={item}
                      canEdit={canEdit}
                      isBusy={isPending}
                      isEditing={editingId === item.id}
                      members={members}
                      onToggle={() => handleToggle(item)}
                      onToggleEdit={() =>
                        setEditingId(editingId === item.id ? null : item.id)
                      }
                      onDelete={() => handleDelete(item)}
                      onSaved={() => {
                        setEditingId(null);
                        toast.success("已儲存");
                        router.refresh();
                      }}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </div>
        );
      })}

      {total === 0 && (
        <EmptyState icon={ClipboardList} title="還沒有清單項目" />
      )}

      {canEdit && (
        <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-sm">
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
