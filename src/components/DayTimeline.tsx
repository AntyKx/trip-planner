"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
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
  TYPE_LABEL,
  MODE_LABEL,
  MODE_ICON,
  COUNTRY_FLAG,
  formatTime,
} from "@/lib/labels";
import { reorderItems } from "@/app/trips/actions";

export type TimelineItem = {
  id: string;
  type: string;
  startTime: string | Date | null;
  note: string | null;
  place: {
    name: string;
    address: string | null;
    rating: number | null;
    country: string;
    provider: string;
  } | null;
};

export type TimelineRoute = {
  fromItemId: string;
  toItemId: string;
  mode: string;
  durationMin: number | null;
  distanceKm: number | null;
  provider: string;
};

function SortableItemCard({
  item,
  route,
}: {
  item: TimelineItem;
  route?: TimelineRoute;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="cursor-grab touch-none self-start px-1 text-slate-300 hover:text-slate-500"
          aria-label="拖曳排序"
        >
          ⠿
        </button>
        <div className="w-14 shrink-0 text-sm font-medium text-slate-500">
          {formatTime(item.startTime)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
              {TYPE_LABEL[item.type]}
            </span>
            {item.place && (
              <span className="text-xs text-slate-400">
                {COUNTRY_FLAG[item.place.country] ?? ""} {item.place.provider}
              </span>
            )}
          </div>
          <h3 className="mt-1 font-semibold">
            {item.place?.name ?? item.note ?? "未命名項目"}
          </h3>
          {item.place?.address && (
            <p className="mt-0.5 text-sm text-slate-500">{item.place.address}</p>
          )}
          {item.place?.rating && (
            <p className="mt-0.5 text-sm text-amber-500">
              ★ {item.place.rating.toFixed(1)}
            </p>
          )}
        </div>
      </div>

      {route && (
        <div className="flex items-center gap-2 py-2 pl-16 text-sm text-slate-500">
          <span>{MODE_ICON[route.mode]}</span>
          <span>{MODE_LABEL[route.mode]}</span>
          {route.durationMin != null && <span>· {route.durationMin} 分鐘</span>}
          {route.distanceKm != null && <span>· {route.distanceKm} km</span>}
          <span className="text-xs text-slate-300">({route.provider})</span>
        </div>
      )}
    </div>
  );
}

export default function DayTimeline({
  tripId,
  dayId,
  items: initialItems,
  routes,
}: {
  tripId: string;
  dayId: string;
  items: TimelineItem[];
  routes: TimelineRoute[];
}) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);

    startTransition(() => {
      reorderItems(
        tripId,
        dayId,
        newItems.map((i) => i.id)
      );
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-slate-400">這天還沒有安排項目。</p>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className={isPending ? "space-y-0 opacity-70" : "space-y-0"}>
          {items.map((item) => {
            const route = routes.find((r) => r.fromItemId === item.id);
            return <SortableItemCard key={item.id} item={item} route={route} />;
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
