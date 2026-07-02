"use client";

import Link from "next/link";
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
import {
  Compass,
  ExternalLink,
  MoreHorizontal,
  Navigation,
  Pencil,
  Plus,
  Route as RouteIcon,
  Search,
  Waypoints,
  X,
} from "lucide-react";
import { TYPE_LABEL, TYPE_ICON, TYPE_COLOR, MODE_ICON, formatTime } from "@/lib/labels";
import {
  reorderItems,
  deleteItem,
  saveRoutes,
  getJapanTransitHint,
  type JapanTransitHint,
  type TravelModeValue,
} from "@/app/trips/actions";
import {
  GOOGLE_TRAVEL_MODE,
  computeBestLeg,
  fetchTransitAlternatives,
  isGoogleTransitSupported,
  optimizeStopOrder,
  type TransitAlternative,
} from "@/lib/routeMode";
import PlaceDetailsTrigger from "./PlaceDetailsModal";
import EditItemModal, { type EditableItem, type SavedItemResult } from "./EditItemModal";
import TransitAlternativesModal from "./TransitAlternativesModal";
import JapanTransitHintModal from "./JapanTransitHintModal";

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
  isLoadingJapanHint,
  onDelete,
  onEdit,
  onModeChange,
  onViewAlternatives,
  onOpenJapanHint,
}: {
  item: TimelineItem;
  route?: TimelineRoute;
  hasNextStop: boolean;
  isRecomputing: boolean;
  isAutoFilling: boolean;
  isLoadingJapanHint: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onModeChange: (mode: TravelModeValue) => void;
  onViewAlternatives: () => void;
  onOpenJapanHint: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const transitSupported = isGoogleTransitSupported(item.place?.country);
  const isJapan = (item.place?.country ?? "").toUpperCase() === "JP";
  const [showMenu, setShowMenu] = useState(false);
  const TypeIcon = TYPE_ICON[item.type] ?? TYPE_ICON.CUSTOM;
  const typeColor = TYPE_COLOR[item.type] ?? TYPE_COLOR.CUSTOM;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-3 flex gap-2">
      {/* Time rail */}
      <div className="flex w-11 shrink-0 flex-col items-center pt-2">
        <span className="text-xs font-medium text-ink-500">
          {formatTime(item.startTime)}
        </span>
        {hasNextStop && <div className="mt-1 w-px flex-1 bg-slate-200" />}
      </div>

      <div className="min-w-0 flex-1">
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
              <div
                className={`flex w-20 shrink-0 items-center justify-center sm:w-28 ${typeColor.bg}`}
              >
                <TypeIcon className={`h-6 w-6 ${typeColor.text}`} />
              </div>
            )
          )}

          <div className="min-w-0 flex-1 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${typeColor.bg} ${typeColor.text}`}
                >
                  <TypeIcon className="h-3 w-3" />
                  {TYPE_LABEL[item.type]}
                </span>
                {item.cost != null && (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {item.currency} {item.cost.toLocaleString()}
                  </span>
                )}
              </div>
              <div className="relative flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={onEdit}
                  aria-label="編輯項目"
                  className="p-2 text-ink-500 hover:text-brand-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowMenu((v) => !v)}
                  aria-label="更多操作"
                  className="p-2 text-ink-500 hover:text-brand-600"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
                    {item.place && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${item.place.lat},${item.place.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShowMenu(false)}
                        className="flex items-center gap-2 px-3 py-2 text-ink-700 hover:bg-slate-50"
                      >
                        <Navigation className="h-4 w-4" />
                        導航
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onDelete();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                      刪除
                    </button>
                  </div>
                )}
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
                <h3 className="mt-1 truncate text-base font-bold text-ink-900 hover:text-brand-700">
                  {item.place.name}
                </h3>
                <p className="mt-0.5 truncate text-sm text-ink-500">
                  {item.place.address}
                  {item.place.rating != null && (
                    <span className="text-amber-500"> · ★ {item.place.rating.toFixed(1)}</span>
                  )}
                </p>
              </PlaceDetailsTrigger>
            ) : (
              <h3 className="mt-1 truncate text-base font-bold text-ink-900">
                {item.note ?? "未命名項目"}
              </h3>
            )}
            {item.confirmationNumber && (
              <p className="mt-0.5 truncate text-xs text-ink-500">
                🔖 {item.confirmationNumber}
              </p>
            )}
          </div>
        </div>

        {hasNextStop && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-ink-700">
            <select
              value={route?.mode ?? "WALK"}
              onChange={(e) => onModeChange(e.target.value as TravelModeValue)}
              disabled={isRecomputing}
              className="w-20 shrink-0 rounded-md border border-slate-200 bg-white px-1 py-0.5 text-xs disabled:opacity-50"
            >
              {TRAVEL_MODE_OPTIONS.map((opt) => {
                const disabled =
                  opt.value === "TRANSIT" && !transitSupported;
                return (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={disabled}
                    title={
                      disabled
                        ? "Google 目前沒有這個國家的大眾運輸資料"
                        : undefined
                    }
                  >
                    {opt.label}
                    {disabled ? "（Google 無資料）" : ""}
                  </option>
                );
              })}
            </select>
            {isRecomputing || (isAutoFilling && !route) ? (
              <span className="text-xs text-ink-500">計算中…</span>
            ) : route && route.durationMin != null ? (
              <span className="flex items-center gap-1">
                <span>{MODE_ICON[route.mode]}</span>
                <span>{route.durationMin} 分鐘</span>
                {route.distanceKm != null && <span>· {route.distanceKm} km</span>}
              </span>
            ) : (
              <span className="text-xs text-ink-500">
                無法自動規劃，請手動選擇交通方式
              </span>
            )}
            {transitSupported && route?.mode === "TRANSIT" && (
              <button
                type="button"
                onClick={onViewAlternatives}
                className="ml-auto flex items-center gap-1 text-xs text-brand-600 hover:underline"
              >
                <RouteIcon className="h-3.5 w-3.5" />
                路線選項
              </button>
            )}
            {isJapan && (
              <button
                type="button"
                onClick={onOpenJapanHint}
                disabled={isLoadingJapanHint}
                className="ml-auto flex items-center gap-1 text-xs text-brand-600 hover:underline disabled:opacity-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {isLoadingJapanHint ? "查詢中…" : "查看轉乘建議"}
              </button>
            )}
          </div>
        )}
      </div>
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
  const [routeError, setRouteError] = useState<string | null>(null);
  const [recomputingKey, setRecomputingKey] = useState<string | null>(null);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [viewingLeg, setViewingLeg] = useState<{
    from: TimelineItem;
    to: TimelineItem;
  } | null>(null);
  const [alternatives, setAlternatives] = useState<TransitAlternative[]>([]);
  const [isLoadingAlternatives, setIsLoadingAlternatives] = useState(false);
  const [alternativesError, setAlternativesError] = useState<string | null>(
    null
  );
  const [japanHintLeg, setJapanHintLeg] = useState<{
    from: TimelineItem;
    to: TimelineItem;
  } | null>(null);
  const [japanHint, setJapanHint] = useState<JapanTransitHint | null>(null);
  const [isLoadingJapanHint, setIsLoadingJapanHint] = useState(false);
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
          { lat: to.place!.lat, lng: to.place!.lng },
          from.place!.country.toLowerCase()
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

      persistRoutes([...routes, ...computed]);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routesLibrary, items, routes]);

  // Saves whatever the current in-memory route list is, replacing any
  // legs that share the same from/to pair as an entry already in newRoutes.
  function persistRoutes(newRoutes: TimelineRoute[]) {
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

  function upsertRoute(newRoute: TimelineRoute) {
    persistRoutes([
      ...routes.filter(
        (r) =>
          !(r.fromItemId === newRoute.fromItemId && r.toItemId === newRoute.toItemId)
      ),
      newRoute,
    ]);
  }

  async function handleLegModeChange(
    from: TimelineItem,
    to: TimelineItem,
    mode: TravelModeValue
  ) {
    if (!routesLibrary) return;
    if (mode === "TRANSIT" && !isGoogleTransitSupported(from.place?.country)) {
      setRouteError("Google 目前沒有這個國家的大眾運輸資料，請選開車或步行");
      return;
    }
    const key = `${from.id}->${to.id}`;
    setRecomputingKey(key);
    setRouteError(null);
    try {
      const directionsService = new routesLibrary.DirectionsService();
      const result = await directionsService.route({
        origin: { lat: from.place!.lat, lng: from.place!.lng },
        destination: { lat: to.place!.lat, lng: to.place!.lng },
        travelMode: GOOGLE_TRAVEL_MODE[mode],
        region: from.place!.country.toLowerCase(),
        ...(mode === "TRANSIT"
          ? { transitOptions: { departureTime: new Date() } }
          : {}),
      });
      const leg = result.routes[0]?.legs?.[0];
      upsertRoute({
        fromItemId: from.id,
        toItemId: to.id,
        mode,
        durationMin: leg?.duration ? Math.round(leg.duration.value / 60) : null,
        distanceKm: leg?.distance
          ? Math.round((leg.distance.value / 1000) * 10) / 10
          : null,
        provider: "google",
      });
    } catch {
      setRouteError("這段交通方式無法規劃路線，可能兩地之間不支援該方式");
    } finally {
      setRecomputingKey(null);
    }
  }

  // "自動安排最順路線": reorders stops by straight-line distance (first and
  // last stop stay put) so the day doesn't zigzag. No Directions calls here
  // — the existing auto-fill effect picks up the new adjacency afterward and
  // computes each leg's real travel mode/time on its own.
  function handleOrganizeRoute() {
    if (!canOptimize) return;
    const points = placeItems.map((item) => ({
      id: item.id,
      lat: item.place!.lat,
      lng: item.place!.lng,
    }));
    const ordered = optimizeStopOrder(points);
    const newItems = ordered.map(
      (p) => placeItems.find((item) => item.id === p.id)!
    );
    setItems(newItems);
    startTransition(() => {
      reorderItems(
        tripId,
        dayId,
        newItems.map((i) => i.id)
      );
    });
  }

  function openJapanHint(from: TimelineItem, to: TimelineItem) {
    setJapanHintLeg({ from, to });
    setJapanHint(null);
    setIsLoadingJapanHint(true);
    (async () => {
      const result = await getJapanTransitHint(
        from.place!.lat,
        from.place!.lng,
        to.place!.lat,
        to.place!.lng
      );
      setJapanHint(result);
      setIsLoadingJapanHint(false);
    })();
  }

  function openAlternatives(from: TimelineItem, to: TimelineItem) {
    if (!routesLibrary) return;
    setViewingLeg({ from, to });
    setAlternatives([]);
    setAlternativesError(null);
    setIsLoadingAlternatives(true);
    (async () => {
      const directionsService = new routesLibrary.DirectionsService();
      const alts = await fetchTransitAlternatives(
        directionsService,
        { lat: from.place!.lat, lng: from.place!.lng },
        { lat: to.place!.lat, lng: to.place!.lng },
        from.place!.country.toLowerCase()
      );
      setAlternatives(alts);
      if (alts.length === 0) {
        setAlternativesError("找不到大眾運輸路線建議");
      }
      setIsLoadingAlternatives(false);
    })();
  }

  function handleChooseAlternative(alt: TransitAlternative) {
    if (!viewingLeg) return;
    const { from, to } = viewingLeg;
    upsertRoute({
      fromItemId: from.id,
      toItemId: to.id,
      mode: "TRANSIT",
      durationMin: alt.durationMin,
      distanceKm: alt.distanceKm,
      provider: "google",
    });
    setViewingLeg(null);
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
        <button
          type="button"
          onClick={() => setEditingItem("new")}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs text-ink-700 hover:bg-slate-50"
        >
          <Plus className="h-3.5 w-3.5" />
          新增自訂項目
        </button>
        <button
          type="button"
          onClick={handleOrganizeRoute}
          disabled={!canOptimize}
          title={
            !canOptimize
              ? "需要至少 3 個都有地點資料的項目才能排序"
              : undefined
          }
          className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs text-ink-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Waypoints className="h-3.5 w-3.5" />
          自動安排最順路線
        </button>
      </div>

      {routeError && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {routeError}
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
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-12 text-center">
          <Compass className="h-10 w-10 text-brand-200" />
          <p className="text-sm text-ink-700">
            今天還沒有行程，先搜尋景點或新增自訂項目吧
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              href={`/explore?tripId=${tripId}`}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Search className="h-4 w-4" />
              搜尋景點
            </Link>
            <button
              type="button"
              onClick={() => setEditingItem("new")}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              新增自訂項目
            </button>
          </div>
        </div>
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
                  isLoadingJapanHint={
                    isLoadingJapanHint &&
                    japanHintLeg?.from.id === item.id &&
                    japanHintLeg?.to.id === nextId
                  }
                  onDelete={() => handleDeleteItem(item.id)}
                  onEdit={() => setEditingItem(item)}
                  onModeChange={(mode) => {
                    const to = placeItems.find((i) => i.id === nextId);
                    if (to) handleLegModeChange(item, to, mode);
                  }}
                  onViewAlternatives={() => {
                    const to = placeItems.find((i) => i.id === nextId);
                    if (to) openAlternatives(item, to);
                  }}
                  onOpenJapanHint={() => {
                    const to = placeItems.find((i) => i.id === nextId);
                    if (to) openJapanHint(item, to);
                  }}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
      )}

      {viewingLeg && (
        <TransitAlternativesModal
          fromName={viewingLeg.from.place?.name ?? ""}
          toName={viewingLeg.to.place?.name ?? ""}
          alternatives={alternatives}
          isLoading={isLoadingAlternatives}
          error={alternativesError}
          onChoose={handleChooseAlternative}
          onClose={() => setViewingLeg(null)}
        />
      )}

      {japanHintLeg && (
        <JapanTransitHintModal
          fromPlaceName={japanHintLeg.from.place?.name ?? ""}
          toPlaceName={japanHintLeg.to.place?.name ?? ""}
          isLoading={isLoadingJapanHint}
          error={japanHint && !japanHint.ok ? japanHint.error : null}
          from={japanHint && japanHint.ok ? japanHint.from : null}
          to={japanHint && japanHint.ok ? japanHint.to : null}
          sameLine={japanHint && japanHint.ok ? japanHint.sameLine : false}
          externalUrl={japanHint && japanHint.ok ? japanHint.externalUrl : null}
          onClose={() => setJapanHintLeg(null)}
        />
      )}
    </div>
  );
}
