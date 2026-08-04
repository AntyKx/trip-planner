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
  BookOpen,
  CalendarClock,
  CalendarDays,
  GripVertical,
  MapPin,
  MapPinned,
  Navigation,
  Pencil,
  Plus,
  Route as RouteIcon,
  Search,
  Star,
  Ticket,
  Waypoints,
  X,
} from "lucide-react";
import {
  TYPE_LABEL,
  TYPE_ICON,
  TYPE_COLOR,
  MODE_ICON,
  MODE_LABEL,
  formatTime,
  formatStayDuration,
} from "@/lib/labels";
import { useToast } from "./Toast";
import {
  reorderItems,
  deleteItem,
  moveItemToDay,
  saveRoutes,
  getJapanTransitHint,
  type TravelModeValue,
  type AnchorItemResult,
} from "@/app/trips/actions";
import {
  GOOGLE_TRAVEL_MODE,
  computeBestLeg,
  estimateFlightLeg,
  fetchTransitAlternatives,
  isAirportPlaceName,
  isGoogleTransitSupported,
  optimizeStopOrder,
  type TransitAlternative,
} from "@/lib/routeMode";
import PlaceDetailsTrigger from "./PlaceDetailsModal";
import EditItemModal, { type EditableItem, type SavedItemResult } from "./EditItemModal";
import JournalEditModal, { type JournalPhoto } from "./JournalEditModal";
import AutoScheduleModal, { type AppliedTimeUpdate } from "./AutoScheduleModal";
import ImgWithFallback from "./ImgWithFallback";
import TransitAlternativesModal from "./TransitAlternativesModal";
import DayAnchorControl, { type DaySummary } from "./DayAnchorControl";
import EmptyState from "./EmptyState";
import { NoItemsTodayIllustration } from "./EmptyStateIllustrations";
import ActionMenu, { type ActionMenuItem } from "./ActionMenu";
import AppModal from "./AppModal";

export type TimelineItem = {
  id: string;
  type: string;
  startTime: string | Date | null;
  endTime: string | Date | null;
  note: string | null;
  confirmationNumber: string | null;
  costs: {
    label: string | null;
    amount: number;
    currency: string;
    category: string;
  }[];
  journalText: string | null;
  photos: JournalPhoto[];
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
    openHours: string | null;
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
  { value: "WALK", label: "步行" },
  { value: "TRANSIT", label: "大眾運輸" },
  { value: "DRIVE", label: "開車" },
  { value: "BIKE", label: "騎車" },
];

function SortableItemCard({
  tripId,
  dayId,
  item,
  index,
  route,
  hasNextStop,
  bothAirports,
  isAnchor,
  isHighlighted,
  isSelected,
  canEdit,
  isRecomputing,
  isAutoFilling,
  otherDays,
  onDelete,
  onEdit,
  onOpenJournal,
  onOpenMove,
  onModeChange,
  onViewAlternatives,
  onLocate,
}: {
  tripId: string;
  dayId: string;
  item: TimelineItem;
  // Only used for the entrance-animation stagger delay (see the wrapper
  // below) — capped there, so this doesn't need bounding itself.
  index: number;
  route?: TimelineRoute;
  hasNextStop: boolean;
  // Both this stop and the next one look like airports (see
  // isAirportPlaceName) — only then does "搭飛機" show up as a mode
  // option, since Directions can't route a flight and offering it for a
  // normal hop would just be a mode nobody could ever pick correctly.
  bothAirports: boolean;
  isAnchor: boolean;
  // Just added from the explore page — plays a one-shot amber wash so the
  // user sees where their place landed.
  isHighlighted: boolean;
  // Currently selected on the map (marker click or this card's own
  // "定位" button) — a standing ring, not a one-shot animation like
  // isHighlighted above.
  isSelected: boolean;
  canEdit: boolean;
  isRecomputing: boolean;
  isAutoFilling: boolean;
  // Only for the "移動到其他天" menu item's picker — empty on a single-day
  // trip, where there's nowhere to move a card to.
  otherDays: DaySummary[];
  onDelete: () => void;
  onEdit: () => void;
  onOpenJournal: () => void;
  onOpenMove: () => void;
  onModeChange: (mode: TravelModeValue) => void;
  onViewAlternatives: () => void;
  onLocate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: !canEdit });
  const transitSupported = isGoogleTransitSupported(item.place?.country);
  const isJapan = (item.place?.country ?? "").toUpperCase() === "JP";
  const TypeIcon = TYPE_ICON[item.type] ?? TYPE_ICON.CUSTOM;
  const typeColor = TYPE_COLOR[item.type] ?? TYPE_COLOR.CUSTOM;
  const ModeIcon = route ? MODE_ICON[route.mode] : null;
  const modeOptions = bothAirports
    ? [{ value: "FLY" as TravelModeValue, label: "搭飛機" }, ...TRAVEL_MODE_OPTIONS]
    : TRAVEL_MODE_OPTIONS;

  const menuItems: ActionMenuItem[] = [
    ...(item.place
      ? [
          {
            key: "navigate",
            label: "導航",
            icon: Navigation,
            href: `https://www.google.com/maps/dir/?api=1&destination=${item.place.lat},${item.place.lng}`,
            external: true,
          },
        ]
      : []),
    ...(canEdit && otherDays.length > 0
      ? [{ key: "move", label: "移動到其他天", icon: CalendarDays, onClick: onOpenMove }]
      : []),
    ...(canEdit
      ? [{ key: "delete", label: "刪除", icon: X, onClick: onDelete, variant: "danger" as const }]
      : []),
  ];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const stayDuration = formatStayDuration(item.startTime, item.endTime);

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, animationDelay: `${Math.min(index * 60, 400)}ms` }}
      className="relative mb-3 flex animate-fade-up gap-2"
      id={`timeline-item-${item.id}`}
    >
      {/* Spine gutter — the dot marks this stop on the shared dashed line
          drawn by the list wrapper (see DayTimeline's items.map below);
          the handwritten time replaces the old plain-text time badge that
          used to sit in the card's top row. This app's journal page
          already uses this dashed-line + font-script language (see
          JournalBook.tsx) — this extends it to the timeline itself
          instead of leaving it only on the post-trip recap. */}
      <div className="w-8 shrink-0 pt-4 text-center">
        <span
          aria-hidden="true"
          className={`mx-auto block rounded-full border-2 border-paper bg-brand-700 ${
            isAnchor ? "h-3.5 w-3.5 ring-2 ring-brand-300" : "h-3 w-3"
          }`}
        />
        {formatTime(item.startTime) && (
          <span className="mt-1 block -rotate-2 font-script text-lg leading-none text-brand-700">
            {formatTime(item.startTime)}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
      <div
        {...(canEdit ? attributes : {})}
        {...(canEdit ? listeners : {})}
        className={`group relative flex touch-manipulation items-stretch rounded-xl border transition select-none [-webkit-touch-callout:none] ${
          isDragging ? "shadow-lg" : "shadow-sm hover:-translate-y-0.5 hover:shadow-md"
        } ${isAnchor ? "border-brand-200 bg-brand-50/40" : "border-line bg-surface"} ${
          isSelected ? "ring-2 ring-brand-400" : ""
        }`}
      >
        {isHighlighted && (
          <div
            aria-hidden="true"
            className="animate-added-highlight pointer-events-none absolute inset-0 rounded-xl"
          />
        )}
        {/* Visual-only drag affordance — the whole card is already the drag
            handle (better for touch than a tiny target), this just shows
            intent on hover for mouse users. Hidden for VIEWER since
            attributes/listeners aren't attached at all in that case. */}
        {canEdit && (
          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-ink-400 opacity-0 transition-opacity group-hover:opacity-100">
            <GripVertical className="h-4 w-4" />
          </span>
        )}
        {item.place && (
          // Stretches to fill the row's full height (items-stretch on the
          // parent), min-h only — no max-h. A max-h cap was tried, but any
          // card with an extra badge line (遊記, multi-line type badges,
          // ...) pushed the text column past that cap, leaving a visible
          // gap below the capped photo — worse than the occasional tall
          // crop this trades for, because it made cards visibly
          // inconsistent (some full, some gapped) rather than uniformly
          // "fills, occasionally a bit tall". min-h still guarantees it's
          // never smaller/more cropped than the original fixed size.
          <ImgWithFallback
            src={item.place.photoUrl}
            alt={item.place.name}
            className="w-20 min-h-20 shrink-0 rounded-l-xl object-cover sm:w-28 sm:min-h-28"
            fallback={
              <div
                className={`flex w-20 min-h-20 shrink-0 items-center justify-center rounded-l-xl sm:w-28 sm:min-h-28 ${typeColor.bg}`}
              >
                <TypeIcon className={`h-7 w-7 ${typeColor.text}`} />
              </div>
            }
          />
        )}

        <div className="min-w-0 flex-1 p-3">
          {/* items-start (not items-center) — the badge group wraps to a
              second line once the spine gutter narrowed this card's
              available width (住宿/本日起點, or a cost pill, no longer
              always fit on one line). items-center used to vertically
              center the button row against that now-taller wrapped badge
              stack, landing the icons visually inside/between the two
              badge lines instead of clear of them. */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {/* Time used to be repeated here as plain bold text — now
                  shown once, as the handwritten label on the spine gutter
                  to the card's left, instead of duplicating it inline. */}
              <span
                className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${typeColor.bg} ${typeColor.text}`}
              >
                <TypeIcon className="h-3 w-3" />
                {TYPE_LABEL[item.type]}
              </span>
              {isAnchor && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                  <MapPin className="h-3 w-3" />
                  本日起點
                </span>
              )}
              {(item.journalText || item.photos.length > 0) && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600">
                  <BookOpen className="h-3 w-3" />
                  遊記{item.photos.length > 0 && ` · ${item.photos.length}張照片`}
                </span>
              )}
              {/* One pill per currency (usually just one) summing that
                  currency's entries — mixing currencies into one number
                  would be meaningless. */}
              {item.costs.length > 0 &&
                [...item.costs
                  .reduce((totals, c) => {
                    totals.set(c.currency, (totals.get(c.currency) ?? 0) + c.amount);
                    return totals;
                  }, new Map<string, number>())
                  .entries()].map(([currency, total]) => (
                  <span
                    key={currency}
                    className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                  >
                    {currency} {total.toLocaleString()}
                  </span>
                ))}
            </div>
            {/* 40px targets with zero gap — slightly under the 44px
                guideline as a deliberate density trade-off the user chose
                (狀態徽章 keep full visibility; only the action buttons
                tighten up). items-start (not items-center) on both this
                row and each button's own icon centering — so the icon
                glyphs line up with the top badge row's text instead of
                sitting centered inside the full 40px tap target, which
                visually drifted low once the badges started wrapping to a
                second line (see the spine-gutter width fix above). */}
            <div className="flex shrink-0 items-start">
              {item.place && (
                <button
                  type="button"
                  onClick={onLocate}
                  aria-label="在地圖上定位"
                  title="在地圖上定位"
                  className={`flex min-h-10 min-w-10 items-start justify-center pt-0.5 hover:text-brand-600 ${
                    isSelected ? "text-brand-600" : "text-ink-500"
                  }`}
                >
                  <MapPinned className="h-4 w-4" />
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={onOpenJournal}
                  aria-label="編輯遊記"
                  title="遊記與照片"
                  className={`flex min-h-10 min-w-10 items-start justify-center pt-0.5 hover:text-rose-600 ${
                    item.journalText || item.photos.length > 0
                      ? "text-rose-600"
                      : "text-ink-500"
                  }`}
                >
                  <BookOpen className="h-4 w-4" />
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  aria-label="編輯項目"
                  className="flex min-h-10 min-w-10 items-start justify-center pt-0.5 text-ink-500 hover:text-brand-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <ActionMenu items={menuItems} />
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
              tripId={tripId}
              dayId={dayId}
            >
              <h3 className="mt-1 truncate text-lg font-bold text-ink-900 hover:text-brand-700">
                {item.place.name}
              </h3>
              {/* Rating and stay duration share one line (separated by a
                  middot when both are present) instead of two — this is
                  what used to push the card taller once auto-schedule
                  started giving every item a real stay duration to show. */}
              {(item.place.rating != null || stayDuration) && (
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-500">
                  {item.place.rating != null && (
                    <span className="flex items-center gap-1 text-amber-500">
                      <Star className="h-3.5 w-3.5 fill-amber-500" />
                      {item.place.rating.toFixed(1)}
                    </span>
                  )}
                  {item.place.rating != null && stayDuration && (
                    <span className="text-ink-300" aria-hidden="true">
                      ·
                    </span>
                  )}
                  {stayDuration && <span>{stayDuration}</span>}
                </p>
              )}
            </PlaceDetailsTrigger>
          ) : (
            <>
              <h3 className="mt-1 truncate text-lg font-bold text-ink-900">
                {item.note ?? "未命名項目"}
              </h3>
              {stayDuration && (
                <p className="mt-0.5 text-sm text-ink-500">{stayDuration}</p>
              )}
            </>
          )}
          {item.confirmationNumber && (
            <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-500">
              <Ticket className="h-3 w-3 shrink-0" />
              {item.confirmationNumber}
            </div>
          )}
        </div>
      </div>

      {hasNextStop && (
        <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-full border border-line bg-paper-alt px-3 py-1.5 text-sm text-ink-700">
          {ModeIcon && <ModeIcon className="h-3.5 w-3.5 shrink-0 text-ink-500" />}
          {canEdit ? (
            <select
              aria-label="交通方式"
              value={route?.mode ?? "WALK"}
              onChange={(e) => onModeChange(e.target.value as TravelModeValue)}
              disabled={isRecomputing}
              // w-28 (not w-20): globals.css forces every select/input to
              // 16px font (fixes iOS auto-zoom-on-focus — see the comment
              // there), which overrides this text-xs class since Tailwind's
              // utilities live in a named CSS layer and that override
              // doesn't. At the resulting 16px, "大眾運輸" plus the native
              // dropdown arrow no longer fit in a narrower width.
              className="w-28 shrink-0 rounded-md border border-line bg-surface px-1 py-0.5 text-xs disabled:opacity-50"
            >
              {modeOptions.map((opt) => {
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
          ) : (
            <span className="shrink-0 text-xs font-medium text-ink-700">
              {MODE_LABEL[route?.mode ?? "WALK"]}
            </span>
          )}
          {isRecomputing || (isAutoFilling && !route) ? (
            <span className="text-xs text-ink-500">計算中…</span>
          ) : route && route.durationMin != null ? (
            <span className="text-xs text-ink-700">
              {route.durationMin}分鐘
              {route.distanceKm != null && `·${route.distanceKm}km`}
            </span>
          ) : (
            <span className="text-xs text-ink-500">
              無法自動規劃，請手動選擇交通方式
            </span>
          )}
          {/* Japan (and India) never get a Google-computed TRANSIT route
              to begin with (see isGoogleTransitSupported), so this button
              shows regardless of the currently-picked mode there — it's
              the only way to see transit options at all. Everywhere else,
              it only shows once TRANSIT is already picked, matching
              "查看/change the route Google already gave you". */}
          {(isJapan || (transitSupported && route?.mode === "TRANSIT")) && (
            <button
              type="button"
              onClick={onViewAlternatives}
              className="ml-auto flex items-center gap-1 text-xs text-brand-600 hover:underline"
            >
              <RouteIcon className="h-3.5 w-3.5" />
              路線選項
            </button>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

// Only one day is ever mounted at a time (DayTimeline remounts fresh per
// day via `key={dayId}` in TripDayBoard — see the item-removal comment on
// handleMoveItem above), so there's no on-screen drag target for a
// cross-day move the way within-day reordering has. This is the picker
// that stands in for it.
function MoveToDayModal({
  itemName,
  otherDays,
  isMoving,
  onPick,
  onClose,
}: {
  itemName: string;
  otherDays: DaySummary[];
  isMoving: boolean;
  onPick: (dayId: string) => void;
  onClose: () => void;
}) {
  return (
    <AppModal titleId="move-to-day-title" title={`把「${itemName}」移到哪一天？`} onClose={onClose}>
      <div className="flex flex-wrap gap-2">
        {otherDays.map((day) => (
          <button
            key={day.id}
            type="button"
            disabled={isMoving}
            onClick={() => onPick(day.id)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-700 hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
          >
            Day {day.dayIndex}
          </button>
        ))}
      </div>
    </AppModal>
  );
}

export default function DayTimeline({
  tripId,
  dayId,
  dayDate,
  items: initialItems,
  routes: initialRoutes,
  anchorItemId: initialAnchorItemId,
  defaultCountry,
  otherDays,
  canEdit,
  highlightItemId,
  selectedItemId,
  onLocateItem,
}: {
  tripId: string;
  dayId: string;
  dayDate: string;
  items: TimelineItem[];
  routes: TimelineRoute[];
  anchorItemId: string | null;
  defaultCountry: string;
  otherDays: DaySummary[];
  canEdit: boolean;
  // Item just added from the explore page (see TripDayBoard's
  // sessionStorage handshake) — scrolled into view + one-shot highlight.
  highlightItemId?: string | null;
  // Currently selected on the map — see TripDayBoard, shared with TripMap.
  selectedItemId?: string | null;
  onLocateItem?: (itemId: string) => void;
}) {
  const [items, setItems] = useState(initialItems);
  const [routes, setRoutes] = useState(initialRoutes);

  // Bring the just-added card into view once — the wash animation alone is
  // pointless if the card sits below the fold.
  useEffect(() => {
    if (!highlightItemId) return;
    const el = document.getElementById(`timeline-item-${highlightItemId}`);
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  }, [highlightItemId]);
  // The item (if any) that represents this day's "start from" point (e.g.
  // the hotel) — a real card like any other, just always kept first by
  // handleOrganizeRoute instead of being reordered away. See
  // src/app/trips/actions.ts (setDayAnchor) for why it's tracked by id
  // rather than by position.
  const [anchorItemId, setAnchorItemId] = useState(initialAnchorItemId);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const [routeError, setRouteError] = useState<string | null>(null);
  const [recomputingKey, setRecomputingKey] = useState<string | null>(null);
  // Request-token guards for the three async handlers below (mode change,
  // Japan transit hint, transit alternatives) — each only has one active
  // target at a time, so a fresh call bumps its token and a resolving
  // callback whose token has since been superseded (e.g. the user picked a
  // different leg, or re-triggered the same one, before the first request
  // finished) just discards its result instead of overwriting newer state.
  const legModeRequestIdRef = useRef<Record<string, number>>({});
  const alternativesRequestIdRef = useRef(0);
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
  // Legs we've already tried to auto-fill this session, so a leg Directions
  // can't find a route for isn't retried on every items/routes change.
  const attemptedAutoFillRef = useRef<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<TimelineItem | "new" | null>(
    null
  );
  const [journalItem, setJournalItem] = useState<TimelineItem | null>(null);
  const [movingItem, setMovingItem] = useState<TimelineItem | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isAutoScheduling, setIsAutoScheduling] = useState(false);
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
  const anchorItem = anchorItemId
    ? placeItems.find((i) => i.id === anchorItemId)
    : undefined;
  // Reordering only means something with >=3 place-items: without an
  // anchor, first/last stay fixed (1+ free in the interior); with an
  // anchor, the anchor itself stays fixed and every other place-item is
  // free (so still need 2+ others for reordering to matter).
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
      // Compute every missing leg concurrently instead of one at a time —
      // each leg is 1-3 independent Directions API calls, so awaiting them
      // sequentially made a day's worth of legs take N times as long as a
      // single leg for no reason.
      const results = await Promise.all(
        missingPairs.map(async ({ from, to, key }): Promise<TimelineRoute | null> => {
          attemptedAutoFillRef.current.add(key);
          const leg = await computeBestLeg(
            directionsService,
            { lat: from.place!.lat, lng: from.place!.lng },
            { lat: to.place!.lat, lng: to.place!.lng },
            from.place!.country.toLowerCase(),
            {
              bothAirports:
                isAirportPlaceName(from.place!.name) && isAirportPlaceName(to.place!.name),
            }
          );
          if (!leg) return null;
          return {
            fromItemId: from.id,
            toItemId: to.id,
            mode: leg.mode,
            durationMin: leg.durationMin,
            distanceKm: leg.distanceKm,
            provider: "google",
          };
        })
      );
      const computed = results.filter((r): r is TimelineRoute => r != null);
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
            provider: r.provider,
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
    // No Directions call for this one — Google can't route a flight, so
    // the estimate (see estimateFlightLeg) is the whole computation.
    if (mode === "FLY") {
      setRouteError(null);
      const leg = estimateFlightLeg(
        { lat: from.place!.lat, lng: from.place!.lng },
        { lat: to.place!.lat, lng: to.place!.lng }
      );
      upsertRoute({
        fromItemId: from.id,
        toItemId: to.id,
        mode: "FLY",
        durationMin: leg.durationMin,
        distanceKm: leg.distanceKm,
        provider: "estimate",
      });
      return;
    }
    if (!routesLibrary) return;
    if (mode === "TRANSIT" && !isGoogleTransitSupported(from.place?.country)) {
      setRouteError("Google 目前沒有這個國家的大眾運輸資料，請選開車或步行");
      return;
    }
    const key = `${from.id}->${to.id}`;
    const requestId = (legModeRequestIdRef.current[key] ?? 0) + 1;
    legModeRequestIdRef.current[key] = requestId;
    const isCurrent = () => legModeRequestIdRef.current[key] === requestId;

    setRecomputingKey(key);
    setRouteError(null);
    try {
      const directionsService = new routesLibrary.DirectionsService();
      const result = await directionsService.route({
        origin: { lat: from.place!.lat, lng: from.place!.lng },
        destination: { lat: to.place!.lat, lng: to.place!.lng },
        travelMode: GOOGLE_TRAVEL_MODE[mode]!,
        region: from.place!.country.toLowerCase(),
        language: "zh-TW",
        ...(mode === "TRANSIT"
          ? { transitOptions: { departureTime: new Date() } }
          : {}),
      });
      if (!isCurrent()) return; // superseded by a later mode change on this leg
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
      if (isCurrent()) setRouteError("這段交通方式無法規劃路線，可能兩地之間不支援該方式");
    } finally {
      if (isCurrent()) setRecomputingKey(null);
    }
  }

  // "自動安排最順路線": reorders stops by straight-line distance so the day
  // doesn't zigzag. No Directions calls here — the existing auto-fill
  // effect picks up the new adjacency afterward and computes each leg's
  // real travel mode/time on its own.
  //
  // Without a "本日起點" set, first/last stop stay fixed — with one set,
  // every stop (including the current first/last) is free to reorder, so a
  // geographic outlier can land at the edge of the route instead of being
  // sandwiched between two endpoints that were never meant to be anchors.
  function handleOrganizeRoute() {
    if (!canOptimize) return;
    const rest = anchorItem
      ? placeItems.filter((item) => item.id !== anchorItem.id)
      : placeItems;
    const points = rest.map((item) => ({
      id: item.id,
      lat: item.place!.lat,
      lng: item.place!.lng,
    }));
    const ordered = optimizeStopOrder(
      points,
      anchorItem
        ? { lat: anchorItem.place!.lat, lng: anchorItem.place!.lng }
        : undefined
    );
    const orderedRest = ordered.map(
      (p) => rest.find((item) => item.id === p.id)!
    );
    const newItems = anchorItem ? [anchorItem, ...orderedRest] : orderedRest;
    setItems(newItems);
    startTransition(() => {
      reorderItems(
        tripId,
        dayId,
        newItems.map((i) => i.id)
      );
    });
  }

  // Japan (and India) are excluded from Google's own transit data — see
  // isGoogleTransitSupported's comment — so this branches to NAVITIME for
  // exactly those, feeding the same TransitAlternativesModal Google's path
  // uses below instead of Japan getting its own separate, weaker UI.
  function openAlternatives(from: TimelineItem, to: TimelineItem) {
    setViewingLeg({ from, to });
    setAlternatives([]);
    setAlternativesError(null);
    setIsLoadingAlternatives(true);
    const requestId = ++alternativesRequestIdRef.current;
    const isJapanLeg = (from.place?.country ?? "").toUpperCase() === "JP";
    (async () => {
      let alts: TransitAlternative[] = [];
      let error: string | null = null;
      if (isJapanLeg) {
        const result = await getJapanTransitHint(
          from.place!.lat,
          from.place!.lng,
          to.place!.lat,
          to.place!.lng
        );
        if (result.ok) alts = result.alternatives;
        else error = result.error;
      } else if (routesLibrary) {
        const directionsService = new routesLibrary.DirectionsService();
        alts = await fetchTransitAlternatives(
          directionsService,
          { lat: from.place!.lat, lng: from.place!.lng },
          { lat: to.place!.lat, lng: to.place!.lng },
          from.place!.country.toLowerCase()
        );
      }
      if (alternativesRequestIdRef.current !== requestId) return;
      setAlternatives(alts);
      if (alts.length === 0) {
        setAlternativesError(error ?? "找不到大眾運輸路線建議");
      }
      setIsLoadingAlternatives(false);
    })();
  }

  function handleChooseAlternative(alt: TransitAlternative) {
    if (!viewingLeg) return;
    const { from, to } = viewingLeg;
    const isJapanLeg = (from.place?.country ?? "").toUpperCase() === "JP";
    upsertRoute({
      fromItemId: from.id,
      toItemId: to.id,
      mode: "TRANSIT",
      durationMin: alt.durationMin,
      distanceKm: alt.distanceKm,
      provider: isJapanLeg ? "navitime" : "google",
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
    toast.success("已更新排序");

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
    toast.success("已刪除");

    startTransition(() => {
      deleteItem(tripId, itemId);
    });
  }

  // Awaited (not the optimistic-then-fire-and-forget pattern handleDeleteItem
  // above uses) because this is driven from a modal with a discrete
  // "pick a day" click rather than an instant single-purpose button — it's
  // worth a brief loading state on the picked day and a real error path
  // instead of removing the card from view before knowing the move landed.
  async function handleMoveItem(itemId: string, toDayId: string) {
    setIsMoving(true);
    try {
      await moveItemToDay(tripId, itemId, dayId, toDayId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setMovingItem(null);
      toast.success("已搬到其他天");
    } catch (err) {
      console.error("moveItemToDay failed:", err);
      toast.error("移動失敗，請再試一次");
    } finally {
      setIsMoving(false);
    }
  }

  function handleItemSaved(result: SavedItemResult) {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === result.id);
      toast.success(exists ? "已儲存" : "已新增");
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
                costs: result.costs,
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
          costs: result.costs,
          journalText: null,
          photos: [],
          place: null,
        },
      ];
    });
  }

  // Batch variant of handleItemSaved's time fields — the server write
  // already happened inside AutoScheduleModal, this just mirrors it into
  // local state (raw "…Z" strings, same convention as SavedItemResult).
  function handleScheduleApplied(updates: AppliedTimeUpdate[]) {
    const byId = new Map(updates.map((u) => [u.itemId, u]));
    setItems((prev) =>
      prev.map((i) => {
        const update = byId.get(i.id);
        return update
          ? { ...i, startTime: update.startTime, endTime: update.endTime }
          : i;
      })
    );
  }

  function handleJournalSaved(
    itemId: string,
    result: { journalText: string | null; photos: JournalPhoto[] }
  ) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, journalText: result.journalText, photos: result.photos }
          : i
      )
    );
  }

  // Splices the anchor card into local state immediately instead of
  // waiting for the server action's revalidatePath to flow back down —
  // this DayTimeline instance's own useState(initialItems) won't pick up
  // a prop change on its own (only a remount via the `key={day.id}` in
  // TripDayBoard would), so the currently-open day needs this explicit
  // update. Other days pick up the change naturally next time they mount.
  function handleAnchorSet(result: AnchorItemResult) {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === result.id);
      const place = { ...result.place, openHours: null };
      if (exists) {
        return prev.map((i) =>
          i.id === result.id ? { ...i, type: result.type, place } : i
        );
      }
      return [
        {
          id: result.id,
          type: result.type,
          startTime: null,
          endTime: null,
          note: null,
          confirmationNumber: null,
          costs: [],
          journalText: null,
          photos: [],
          place,
        },
        ...prev,
      ];
    });
    setAnchorItemId(result.id);
  }

  function handleAnchorCleared() {
    setItems((prev) => prev.filter((i) => i.id !== anchorItemId));
    setAnchorItemId(null);
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
          costs: editingItem.costs,
          placeName: editingItem.place?.name ?? null,
          placeOpenHours: editingItem.place?.openHours ?? null,
        }
      : null;

  return (
    <div>
      {canEdit && (
        <>
          {/* Mobile: three equal-width buttons with shortened labels so
              the row never wraps (full labels overflow ~375px screens);
              desktop keeps natural widths + full labels. Styling mirrors
              AppButton's visual language (rounded-xl, active scale press
              feedback) hand-rolled here because the shared primitive's
              shrink-0/whitespace-nowrap fights the responsive flex-1 +
              dual-label layout this row needs. 新增項目 is tinted as the
              primary-of-the-row; the two auto tools stay secondary with
              brand-colored icons (not gold — accent gold is reserved as
              the AI signal, these are pure logic). */}
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingItem("new")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-50 px-2 py-2 text-xs font-medium text-brand-700 transition hover:bg-brand-100 active:scale-[0.97] sm:flex-initial sm:px-3"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="sm:hidden">新增項目</span>
              <span className="hidden sm:inline">新增自訂項目</span>
            </button>
            <button
              type="button"
              onClick={handleOrganizeRoute}
              disabled={!canOptimize}
              title={
                !canOptimize ? "需要至少 3 個都有地點資料的項目才能排序" : undefined
              }
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-2 text-xs font-medium text-ink-700 transition hover:bg-paper-alt active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 sm:flex-initial sm:px-3"
            >
              <Waypoints className="h-3.5 w-3.5 shrink-0 text-brand-600" />
              <span className="sm:hidden">最順路線</span>
              <span className="hidden sm:inline">自動安排最順路線</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAutoScheduling(true)}
              disabled={items.length < 2}
              title={items.length < 2 ? "需要至少 2 個項目才能排時間" : undefined}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-2 text-xs font-medium text-ink-700 transition hover:bg-paper-alt active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 sm:flex-initial sm:px-3"
            >
              <CalendarClock className="h-3.5 w-3.5 shrink-0 text-brand-600" />
              自動排時間
            </button>
          </div>

          <div className="mb-3">
            <DayAnchorControl
              tripId={tripId}
              dayId={dayId}
              anchorName={anchorItem?.place?.name ?? null}
              defaultCountry={defaultCountry}
              otherDays={otherDays}
              onAnchorSet={handleAnchorSet}
              onAnchorCleared={handleAnchorCleared}
            />
          </div>
        </>
      )}

      {routeError && (
        <p className="mb-3 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-600">
          {routeError}
        </p>
      )}

      {isAutoScheduling && (
        <AutoScheduleModal
          tripId={tripId}
          dayId={dayId}
          dayDate={dayDate}
          items={items.map((i) => ({
            id: i.id,
            type: i.type,
            startTime: i.startTime,
            endTime: i.endTime,
            place: i.place
              ? { name: i.place.name, openHours: i.place.openHours }
              : null,
            note: i.note,
          }))}
          routes={routes.map((r) => ({
            fromItemId: r.fromItemId,
            toItemId: r.toItemId,
            durationMin: r.durationMin,
          }))}
          onClose={() => setIsAutoScheduling(false)}
          onApplied={handleScheduleApplied}
        />
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

      {journalItem && (
        <JournalEditModal
          tripId={tripId}
          itemId={journalItem.id}
          itemTitle={journalItem.place?.name ?? journalItem.note ?? "遊記"}
          journalText={journalItem.journalText}
          photos={journalItem.photos}
          onClose={() => setJournalItem(null)}
          onSaved={(result) => handleJournalSaved(journalItem.id, result)}
        />
      )}

      {movingItem && (
        <MoveToDayModal
          itemName={movingItem.place?.name ?? movingItem.note ?? "此項目"}
          otherDays={otherDays}
          isMoving={isMoving}
          onClose={() => setMovingItem(null)}
          onPick={(toDayId) => handleMoveItem(movingItem.id, toDayId)}
        />
      )}

      {items.length === 0 ? (
        <EmptyState
          illustration={<NoItemsTodayIllustration />}
          title="今天還沒有行程"
          description={canEdit ? "先搜尋景點或新增自訂項目吧" : undefined}
          action={
            canEdit && (
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                <Link
                  href={`/explore?tripId=${tripId}&dayId=${dayId}`}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  <Search className="h-4 w-4" />
                  搜尋景點
                </Link>
                <button
                  type="button"
                  onClick={() => setEditingItem("new")}
                  className="flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-700 hover:bg-paper-alt"
                >
                  <Plus className="h-4 w-4" />
                  新增自訂項目
                </button>
              </div>
            )
          }
        />
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
          <div className={`relative ${isPending ? "opacity-70" : ""}`}>
            {/* Dashed spine — a static line, not animated (the per-item
                dots/cards below stagger in on top of it via animate-fade-up
                instead); real card heights vary too much for an SVG
                stroke-dashoffset draw-in to stay aligned. left-[15px]
                centers it under each row's w-8 gutter (see
                SortableItemCard above) — same dashed-line language as
                JournalBook's day-section rule, just vertical here. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-2 left-[15px] top-2 w-0 border-l-2 border-dashed border-brand-200"
            />
            {items.map((item, index) => {
              const nextId = nextPlaceItemId.get(item.id);
              const route = nextId
                ? routes.find(
                    (r) => r.fromItemId === item.id && r.toItemId === nextId
                  )
                : undefined;
              const bothAirports =
                nextId != null &&
                isAirportPlaceName(item.place?.name) &&
                isAirportPlaceName(placeItems.find((i) => i.id === nextId)?.place?.name);
              return (
                <SortableItemCard
                  key={item.id}
                  tripId={tripId}
                  dayId={dayId}
                  item={item}
                  index={index}
                  route={route}
                  hasNextStop={nextId != null}
                  bothAirports={bothAirports}
                  isAnchor={item.id === anchorItemId}
                  isHighlighted={item.id === highlightItemId}
                  isSelected={item.id === selectedItemId}
                  canEdit={canEdit}
                  isRecomputing={recomputingKey === `${item.id}->${nextId}`}
                  isAutoFilling={isAutoFilling}
                  otherDays={otherDays}
                  onDelete={() => handleDeleteItem(item.id)}
                  onEdit={() => setEditingItem(item)}
                  onOpenJournal={() => setJournalItem(item)}
                  onOpenMove={() => setMovingItem(item)}
                  onModeChange={(mode) => {
                    const to = placeItems.find((i) => i.id === nextId);
                    if (to) handleLegModeChange(item, to, mode);
                  }}
                  onViewAlternatives={() => {
                    const to = placeItems.find((i) => i.id === nextId);
                    if (to) openAlternatives(item, to);
                  }}
                  onLocate={() => onLocateItem?.(item.id)}
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
    </div>
  );
}
