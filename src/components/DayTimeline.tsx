"use client";

import { useState, useTransition } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
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
import { TYPE_LABEL, MODE_LABEL, MODE_ICON, formatTime } from "@/lib/labels";
import { reorderItems, deleteItem } from "@/app/trips/actions";

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
    photoUrl: string | null;
    lat: number;
    lng: number;
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
  onDelete,
}: {
  item: TimelineItem;
  route?: TimelineRoute;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-3">
      <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {item.place?.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.place.photoUrl}
            alt={item.place.name}
            className="w-20 shrink-0 object-cover sm:w-28"
          />
        ) : (
          item.place && (
            <div className="flex w-20 shrink-0 items-center justify-center bg-slate-100 text-2xl sm:w-28">
              📍
            </div>
          )
        )}

        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-xs font-medium text-slate-500">
                {formatTime(item.startTime)}
              </span>
              <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                {TYPE_LABEL[item.type]}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {item.place && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${item.place.lat},${item.place.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="開啟 Google Maps 導航"
                  className="px-1 text-slate-400 hover:text-indigo-600"
                >
                  🧭
                </a>
              )}
              <button
                {...attributes}
                {...listeners}
                type="button"
                className="cursor-grab touch-none px-1 text-slate-400 hover:text-slate-700"
                aria-label="拖曳排序"
              >
                ⠿
              </button>
              <button
                type="button"
                onClick={onDelete}
                aria-label="刪除項目"
                className="px-1 text-slate-400 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          </div>
          <h3 className="mt-1 truncate font-semibold text-slate-900">
            {item.place?.name ?? item.note ?? "未命名項目"}
          </h3>
          {item.place && (
            <p className="mt-0.5 truncate text-sm text-slate-600">
              {item.place.address}
              {item.place.rating != null && (
                <span className="text-amber-500"> · ★ {item.place.rating.toFixed(1)}</span>
              )}
            </p>
          )}
        </div>
      </div>

      {route && (
        <div className="flex items-center gap-2 py-2 pl-3 text-sm text-slate-700">
          <span>{MODE_ICON[route.mode]}</span>
          <span>{MODE_LABEL[route.mode]}</span>
          {route.durationMin != null && <span>· {route.durationMin} 分鐘</span>}
          {route.distanceKm != null && <span>· {route.distanceKm} km</span>}
          <span className="text-xs text-slate-600">({route.provider})</span>
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
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  const routesLibrary = useMapsLibrary("routes");

  const placeItems = items.filter((i) => i.place);
  const canOptimize = placeItems.length === items.length && placeItems.length >= 3;

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

  async function handleOptimize() {
    if (!routesLibrary || !canOptimize) return;
    setOptimizeError(null);
    setIsOptimizing(true);

    try {
      const origin = placeItems[0];
      const destination = placeItems[placeItems.length - 1];
      const waypoints = placeItems.slice(1, -1).map((item) => ({
        location: { lat: item.place!.lat, lng: item.place!.lng },
        stopover: true,
      }));

      const directionsService = new routesLibrary.DirectionsService();
      const result = await directionsService.route({
        origin: { lat: origin.place!.lat, lng: origin.place!.lng },
        destination: { lat: destination.place!.lat, lng: destination.place!.lng },
        waypoints,
        optimizeWaypoints: true,
        travelMode: "DRIVING" as google.maps.TravelMode,
      });

      const order = result.routes[0]?.waypoint_order ?? [];
      const optimizedMiddle = order.map((i: number) => placeItems[1 + i]);
      const newItems = [origin, ...optimizedMiddle, destination];

      setItems(newItems);
      startTransition(() => {
        reorderItems(
          tripId,
          dayId,
          newItems.map((i) => i.id)
        );
      });
    } catch {
      setOptimizeError("路線優化失敗，可能是地點距離太遠或無法規劃路線");
    } finally {
      setIsOptimizing(false);
    }
  }

  function handleDeleteItem(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    if (
      !confirm(
        `確定要刪除「${item.place?.name ?? item.note ?? "這個項目"}」嗎？`
      )
    )
      return;

    const newItems = items.filter((i) => i.id !== itemId);
    setItems(newItems);

    startTransition(() => {
      deleteItem(tripId, itemId);
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-slate-600">這天還沒有安排項目。</p>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleOptimize}
          disabled={!canOptimize || !routesLibrary || isOptimizing}
          className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isOptimizing ? "優化中…" : "🔄 自動優化路線"}
        </button>
        {!canOptimize && items.length >= 2 && (
          <span className="text-xs text-slate-600">
            需要至少 3 個都有地點資料的項目才能優化
          </span>
        )}
      </div>

      {optimizeError && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {optimizeError}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className={isPending ? "opacity-70" : undefined}>
            {items.map((item) => {
              const route = routes.find((r) => r.fromItemId === item.id);
              return (
                <SortableItemCard
                  key={item.id}
                  item={item}
                  route={route}
                  onDelete={() => handleDeleteItem(item.id)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
