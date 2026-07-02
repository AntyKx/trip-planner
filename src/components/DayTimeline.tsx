"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
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
import { MapPin, Navigation, Pencil, Plus, X, RefreshCw } from "lucide-react";
import { TYPE_LABEL, formatTime } from "@/lib/labels";
import {
  reorderItems,
  deleteItem,
  saveRoutes,
  type TravelModeValue,
} from "@/app/trips/actions";
import { GOOGLE_TRAVEL_MODE, computeBestLeg } from "@/lib/routeMode";
import PlaceDetailsTrigger from "./PlaceDetailsModal";
import EditItemModal, { type EditableItem, type SavedItemResult } from "./EditItemModal";

export type TimelineItem = {
  id: string;
  type: string;
  startTime: string | Date | null;
  endTime: string | Date | null;
  note: string | null;
  confirmationNumber: string | null;
  cost: number | null;
  currency: string | null;
  costCategory: string | null;
  place: {
    name: string;
    address: string | null;
    rating: number | null;
    country: string;
    provider: string;
    externalId: string;
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

const TRAVEL_MODE_OPTIONS: { value: TravelModeValue; label: string }[] = [
  { value: "WALK", label: "🚶 步行" },
  { value: "TRANSIT", label: "🚆 大眾運輸" },
  { value: "DRIVE", label: "🚗 開車" },
  { value: "BIKE", label: "🚲 騎車" },
];

function SortableItemCard({
  item,
  route,
  hasNextStop,
  isRecomputing,
  isAutoFilling,
  onDelete,
  onEdit,
  onModeChange,
}: {
  item: TimelineItem;
  route?: TimelineRoute;
  hasNextStop: boolean;
  isRecomputing: boolean;
  isAutoFilling: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onModeChange: (mode: TravelModeValue) => void;
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
      <div
        {...attributes}
        {...listeners}
        className="flex touch-manipulation items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm select-none [-webkit-touch-callout:none]"
      >
        {item.place?.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.place.photoUrl}
            alt={item.place.name}
            className="w-20 shrink-0 object-cover sm:w-28"
          />
        ) : (
          item.place && (
            <div className="flex w-20 shrink-0 items-center justify-center bg-slate-100 sm:w-28">
              <MapPin className="h-6 w-6 text-slate-400" />
            </div>
          )
        )}

        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-xs font-medium text-slate-500">
                {formatTime(item.startTime)}
              </span>
              <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-600">
                {TYPE_LABEL[item.type]}
              </span>
              {item.cost != null && (
                <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {item.currency} {item.cost.toLocaleString()}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onEdit}
                aria-label="編輯項目"
                className="p-1 text-slate-400 hover:text-teal-600"
              >
                <Pencil className="h-4 w-4" />
              </button>
              {item.place && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${item.place.lat},${item.place.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="開啟 Google Maps 導航"
                  className="p-1 text-slate-400 hover:text-teal-600"
                >
                  <Navigation className="h-4 w-4" />
                </a>
              )}
              <button
                type="button"
                onClick={onDelete}
                aria-label="刪除項目"
                className="p-1 text-slate-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {item.place ? (
            <PlaceDetailsTrigger
              provider={item.place.provider}
              externalId={item.place.externalId}
              fallback={{
                name: item.place.name,
                address: item.place.address,
                rating: item.place.rating,
                photoUrl: item.place.photoUrl,
              }}
            >
              <h3 className="mt-1 truncate font-semibold text-slate-900 hover:text-teal-700">
                {item.place.name}
              </h3>
              <p className="mt-0.5 truncate text-sm text-slate-600">
                {item.place.address}
                {item.place.rating != null && (
                  <span className="text-amber-500"> · ★ {item.place.rating.toFixed(1)}</span>
                )}
              </p>
            </PlaceDetailsTrigger>
          ) : (
            <h3 className="mt-1 truncate font-semibold text-slate-900">
              {item.note ?? "未命名項目"}
            </h3>
          )}
          {item.confirmationNumber && (
            <p className="mt-0.5 truncate text-xs text-slate-500">
              🔖 {item.confirmationNumber}
            </p>
          )}
        </div>
      </div>

      {hasNextStop && (
        <div className="flex items-center gap-2 py-2 pl-3 text-sm text-slate-700">
          <select
            value={route?.mode ?? "WALK"}
            onChange={(e) => onModeChange(e.target.value as TravelModeValue)}
            disabled={isRecomputing}
            className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-xs disabled:opacity-50"
          >
            {TRAVEL_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {isRecomputing || (isAutoFilling && !route) ? (
            <span className="text-xs text-slate-400">計算中…</span>
          ) : route && route.durationMin != null ? (
            <>
              <span>{route.durationMin} 分鐘</span>
              {route.distanceKm != null && <span>· {route.distanceKm} km</span>}
            </>
          ) : (
            <span className="text-xs text-slate-400">
              無法自動規劃，請手動選擇交通方式
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function DayTimeline({
  tripId,
  dayId,
  dayDate,
  items: initialItems,
  routes: initialRoutes,
}: {
  tripId: string;
  dayId: string;
  dayDate: string;
  items: TimelineItem[];
  routes: TimelineRoute[];
}) {
  const [items, setItems] = useState(initialItems);
  const [routes, setRoutes] = useState(initialRoutes);
  const [isPending, startTransition] = useTransition();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isComputingRoutes, setIsComputingRoutes] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [travelMode, setTravelMode] = useState<TravelModeValue>("WALK");
  const [recomputingKey, setRecomputingKey] = useState<string | null>(null);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  // Legs we've already tried to auto-fill this session, so a leg Directions
  // can't find a route for isn't retried on every items/routes change.
  const attemptedAutoFillRef = useRef<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<TimelineItem | "new" | null>(
    null
  );
  const sensors = useSensors(
    // Mouse: quick distance-based activation (no scroll to conflict with).
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // Touch: long-press activation. TouchSensor (unlike PointerSensor) can
    // preventDefault() on touchmove after the delay elapses instead of
    // needing touch-action: none up front, so a quick swipe before the
    // hold completes still scrolls the page natively.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    })
  );
  const routesLibrary = useMapsLibrary("routes");

  const placeItems = items.filter((i) => i.place);
  const canOptimize = placeItems.length === items.length && placeItems.length >= 3;

  // Maps an item to the id of the next place-item after it, so the route
  // badge under a card always reflects the *current* adjacency instead of a
  // stale leg left over from before a reorder or delete.
  const nextPlaceItemId = new Map<string, string>();
  for (let i = 0; i < placeItems.length - 1; i++) {
    nextPlaceItemId.set(placeItems[i].id, placeItems[i + 1].id);
  }

  // Auto-fill legs Tabikoto-style: whenever two consecutive place-items
  // don't have a saved route yet (e.g. a place card was just added), pick
  // the best travel mode for that hop and compute it automatically.
  useEffect(() => {
    if (!routesLibrary) return;

    const missingPairs: { from: TimelineItem; to: TimelineItem; key: string }[] = [];
    for (let i = 0; i < placeItems.length - 1; i++) {
      const from = placeItems[i];
      const to = placeItems[i + 1];
      const key = `${from.id}->${to.id}`;
      const hasRoute = routes.some(
        (r) => r.fromItemId === from.id && r.toItemId === to.id
      );
      if (!hasRoute && !attemptedAutoFillRef.current.has(key)) {
        missingPairs.push({ from, to, key });
      }
    }
    if (missingPairs.length === 0) return;

    let cancelled = false;
    (async () => {
      setIsAutoFilling(true);
      const directionsService = new routesLibrary.DirectionsService();
      const computed: TimelineRoute[] = [];
      for (const { from, to, key } of missingPairs) {
        attemptedAutoFillRef.current.add(key);
        const leg = await computeBestLeg(
          directionsService,
          { lat: from.place!.lat, lng: from.place!.lng },
          { lat: to.place!.lat, lng: to.place!.lng }
        );
        if (leg) {
          computed.push({
            fromItemId: from.id,
            toItemId: to.id,
            mode: leg.mode,
            durationMin: leg.durationMin,
            distanceKm: leg.distanceKm,
            provider: "google",
          });
        }
      }
      if (cancelled) return;
      setIsAutoFilling(false);
      if (computed.length === 0) return;

      const merged = [...routes, ...computed];
      setRoutes(merged);
      const country = placeItems[0]?.place?.country ?? "TW";
      startTransition(() => {
        saveRoutes(
          tripId,
          dayId,
          country,
          merged
            .filter((r) => r.durationMin != null && r.distanceKm != null)
            .map((r) => ({
              fromItemId: r.fromItemId,
              toItemId: r.toItemId,
              mode: r.mode as TravelModeValue,
              durationMin: r.durationMin!,
              distanceKm: r.distanceKm!,
            }))
        );
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routesLibrary, items, routes]);

  async function handleLegModeChange(
    from: TimelineItem,
    to: TimelineItem,
    mode: TravelModeValue
  ) {
    if (!routesLibrary) return;
    const key = `${from.id}->${to.id}`;
    setRecomputingKey(key);
    setOptimizeError(null);
    try {
      const directionsService = new routesLibrary.DirectionsService();
      const result = await directionsService.route({
        origin: { lat: from.place!.lat, lng: from.place!.lng },
        destination: { lat: to.place!.lat, lng: to.place!.lng },
        travelMode: GOOGLE_TRAVEL_MODE[mode],
      });
      const leg = result.routes[0]?.legs?.[0];
      const newRoute: TimelineRoute = {
        fromItemId: from.id,
        toItemId: to.id,
        mode,
        durationMin: leg?.duration ? Math.round(leg.duration.value / 60) : null,
        distanceKm: leg?.distance
          ? Math.round((leg.distance.value / 1000) * 10) / 10
          : null,
        provider: "google",
      };
      const merged = [
        ...routes.filter(
          (r) => !(r.fromItemId === from.id && r.toItemId === to.id)
        ),
        newRoute,
      ];
      setRoutes(merged);
      const country = placeItems[0]?.place?.country ?? "TW";
      startTransition(() => {
        saveRoutes(
          tripId,
          dayId,
          country,
          merged
            .filter((r) => r.durationMin != null && r.distanceKm != null)
            .map((r) => ({
              fromItemId: r.fromItemId,
              toItemId: r.toItemId,
              mode: r.mode as TravelModeValue,
              durationMin: r.durationMin!,
              distanceKm: r.distanceKm!,
            }))
        );
      });
    } catch {
      setOptimizeError("這段交通方式無法規劃路線，可能兩地之間不支援該方式");
    } finally {
      setRecomputingKey(null);
    }
  }

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

  function legsToRoutes(
    orderedPlaceItems: TimelineItem[],
    legs: google.maps.DirectionsLeg[]
  ): TimelineRoute[] {
    return legs.map((leg, i) => ({
      fromItemId: orderedPlaceItems[i].id,
      toItemId: orderedPlaceItems[i + 1].id,
      mode: travelMode,
      durationMin: leg.duration ? Math.round(leg.duration.value / 60) : null,
      distanceKm: leg.distance
        ? Math.round((leg.distance.value / 1000) * 10) / 10
        : null,
      provider: "google",
    }));
  }

  // Google's Directions API rejects waypoints[] entirely for TRANSIT mode
  // (unlike WALK/DRIVE/BIKE, which just can't optimize them). So for
  // transit we fetch each consecutive leg as its own request instead of
  // one batched multi-waypoint request.
  async function fetchLegsForMode(
    orderedPlaceItems: TimelineItem[],
    mode: TravelModeValue
  ): Promise<google.maps.DirectionsLeg[]> {
    if (!routesLibrary) return [];
    const directionsService = new routesLibrary.DirectionsService();

    if (mode === "TRANSIT") {
      const legs: google.maps.DirectionsLeg[] = [];
      for (let i = 0; i < orderedPlaceItems.length - 1; i++) {
        const result = await directionsService.route({
          origin: {
            lat: orderedPlaceItems[i].place!.lat,
            lng: orderedPlaceItems[i].place!.lng,
          },
          destination: {
            lat: orderedPlaceItems[i + 1].place!.lat,
            lng: orderedPlaceItems[i + 1].place!.lng,
          },
          travelMode: GOOGLE_TRAVEL_MODE[mode],
        });
        const leg = result.routes[0]?.legs?.[0];
        if (leg) legs.push(leg);
      }
      return legs;
    }

    const origin = orderedPlaceItems[0];
    const destination = orderedPlaceItems[orderedPlaceItems.length - 1];
    const waypoints = orderedPlaceItems.slice(1, -1).map((item) => ({
      location: { lat: item.place!.lat, lng: item.place!.lng },
      stopover: true,
    }));
    const result = await directionsService.route({
      origin: { lat: origin.place!.lat, lng: origin.place!.lng },
      destination: { lat: destination.place!.lat, lng: destination.place!.lng },
      waypoints,
      travelMode: GOOGLE_TRAVEL_MODE[mode],
    });
    return result.routes[0]?.legs ?? [];
  }

  function saveComputedRoutes(newRoutes: TimelineRoute[]) {
    setRoutes(newRoutes);
    const country = placeItems[0]?.place?.country ?? "TW";
    startTransition(() => {
      saveRoutes(
        tripId,
        dayId,
        country,
        newRoutes
          .filter((r) => r.durationMin != null && r.distanceKm != null)
          .map((r) => ({
            fromItemId: r.fromItemId,
            toItemId: r.toItemId,
            mode: r.mode as TravelModeValue,
            durationMin: r.durationMin!,
            distanceKm: r.distanceKm!,
          }))
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
        travelMode: GOOGLE_TRAVEL_MODE[travelMode],
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

      const legs = result.routes[0]?.legs ?? [];
      saveComputedRoutes(legsToRoutes(newItems, legs));
    } catch {
      setOptimizeError("路線優化失敗，可能是地點距離太遠或無法規劃路線");
    } finally {
      setIsOptimizing(false);
    }
  }

  async function handleComputeRoutes() {
    if (!routesLibrary || placeItems.length < 2) return;
    setOptimizeError(null);
    setIsComputingRoutes(true);

    try {
      const legs = await fetchLegsForMode(placeItems, travelMode);
      saveComputedRoutes(legsToRoutes(placeItems, legs));
    } catch {
      setOptimizeError("計算交通路線失敗，可能是地點距離太遠或無法規劃路線");
    } finally {
      setIsComputingRoutes(false);
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

  function handleItemSaved(result: SavedItemResult) {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === result.id);
      if (exists) {
        return prev.map((i) =>
          i.id === result.id
            ? {
                ...i,
                type: result.type,
                startTime: result.startTime,
                endTime: result.endTime,
                note: result.note,
                confirmationNumber: result.confirmationNumber,
                cost: result.cost,
                currency: result.currency,
                costCategory: result.costCategory,
              }
            : i
        );
      }
      return [
        ...prev,
        {
          id: result.id,
          type: result.type,
          startTime: result.startTime,
          endTime: result.endTime,
          note: result.note,
          confirmationNumber: result.confirmationNumber,
          cost: result.cost,
          currency: result.currency,
          costCategory: result.costCategory,
          place: null,
        },
      ];
    });
  }

  const editingAsEditable: EditableItem | null =
    editingItem && editingItem !== "new"
      ? {
          id: editingItem.id,
          type: editingItem.type,
          startTime: editingItem.startTime,
          endTime: editingItem.endTime,
          note: editingItem.note,
          confirmationNumber: editingItem.confirmationNumber,
          cost: editingItem.cost,
          currency: editingItem.currency,
          costCategory: editingItem.costCategory,
          placeName: editingItem.place?.name ?? null,
        }
      : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={travelMode}
          onChange={(e) => setTravelMode(e.target.value as TravelModeValue)}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
        >
          {TRAVEL_MODE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleOptimize}
          disabled={!canOptimize || !routesLibrary || isOptimizing || travelMode === "TRANSIT"}
          title={
            travelMode === "TRANSIT"
              ? "Google 大眾運輸路線不支援自動排序，請改用「計算交通路線」"
              : undefined
          }
          className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isOptimizing ? "animate-spin" : ""}`} />
          {isOptimizing ? "優化中…" : "自動優化路線"}
        </button>
        <button
          type="button"
          onClick={handleComputeRoutes}
          disabled={!routesLibrary || placeItems.length < 2 || isComputingRoutes}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isComputingRoutes ? "animate-spin" : ""}`} />
          {isComputingRoutes ? "計算中…" : "計算交通路線"}
        </button>
        <button
          type="button"
          onClick={() => setEditingItem("new")}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          <Plus className="h-3.5 w-3.5" />
          新增自訂項目
        </button>
        {!canOptimize && items.length >= 2 && (
          <span className="text-xs text-slate-600">
            需要至少 3 個都有地點資料的項目才能優化
          </span>
        )}
        {canOptimize && travelMode === "TRANSIT" && (
          <span className="text-xs text-slate-600">
            大眾運輸不支援自動排序，請用「計算交通路線」依目前順序計算
          </span>
        )}
      </div>

      {optimizeError && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {optimizeError}
        </p>
      )}

      {(editingItem === "new" || editingAsEditable) && (
        <EditItemModal
          tripId={tripId}
          dayId={dayId}
          dayDate={dayDate}
          item={editingAsEditable}
          onClose={() => setEditingItem(null)}
          onSaved={handleItemSaved}
        />
      )}

      {items.length === 0 ? (
        <p className="text-sm text-slate-600">這天還沒有安排項目。</p>
      ) : (
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
              const nextId = nextPlaceItemId.get(item.id);
              const route = nextId
                ? routes.find(
                    (r) => r.fromItemId === item.id && r.toItemId === nextId
                  )
                : undefined;
              return (
                <SortableItemCard
                  key={item.id}
                  item={item}
                  route={route}
                  hasNextStop={nextId != null}
                  isRecomputing={recomputingKey === `${item.id}->${nextId}`}
                  isAutoFilling={isAutoFilling}
                  onDelete={() => handleDeleteItem(item.id)}
                  onEdit={() => setEditingItem(item)}
                  onModeChange={(mode) => {
                    const to = placeItems.find((i) => i.id === nextId);
                    if (to) handleLegModeChange(item, to, mode);
                  }}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
      )}
    </div>
  );
}
