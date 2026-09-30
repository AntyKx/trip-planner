"use client";

import { useEffect, useState } from "react";
import { Wallet, ShieldAlert, Share2, type LucideIcon } from "lucide-react";
import AppModal from "./AppModal";
import BudgetSummary, { budgetHeadline } from "./BudgetSummary";
import EmergencyInfoCard from "./EmergencyInfoCard";
import CollaboratorsPanel, { type Collaborator } from "./CollaboratorsPanel";
import ItinerarySharePanel from "./ItinerarySharePanel";
import JournalSharePanel from "./JournalSharePanel";
import type { BoardDay } from "./TripDayBoard";

type Sheet = "budget" | "emergency" | "share";
type ShareTab = "collaborators" | "itinerary" | "journal";

// A row of summary chips under the trip cover — 預算 / 緊急資訊 / 分享 —
// each opening its full panel in a sheet. These used to be five stacked
// cards below the timeline (budget, emergency, collaborators, journal
// share, itinerary share), so reaching any of them meant scrolling past
// the whole day first, and the rarely-touched share settings took as much
// room as the itinerary itself. Chosen (plan A) over collapsible cards at
// the bottom after comparing both in an Artifact preview (2026-09-30).
export default function TripInfoToolbar({
  tripId,
  days,
  emergencyInfo,
  canEdit,
  isOwner,
  collaborators,
  shareEnabled,
  shareToken,
  shareRole,
  journalShareEnabled,
  journalShareToken,
  itineraryShareEnabled,
  itineraryShareToken,
  initialSheet,
}: {
  tripId: string;
  days: BoardDay[];
  emergencyInfo: string | null;
  canEdit: boolean;
  isOwner: boolean;
  collaborators: Collaborator[];
  shareEnabled: boolean;
  shareToken: string | null;
  shareRole: "EDITOR" | "VIEWER" | null;
  journalShareEnabled: boolean;
  journalShareToken: string | null;
  itineraryShareEnabled: boolean;
  itineraryShareToken: string | null;
  initialSheet?: Sheet;
}) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  // Opened after mount, not as the initial state — the sheet portals into
  // document.body, which doesn't exist during server rendering.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialSheet) setSheet(initialSheet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [shareTab, setShareTab] = useState<ShareTab>("collaborators");

  const budget = budgetHeadline(days);
  // The two public-link panels render nothing for non-owners (they can't
  // manage them), so only owners get the tabbed share sheet.
  const shareTabs: { key: ShareTab; label: string }[] = isOwner
    ? [
        { key: "collaborators", label: "共同編輯" },
        { key: "itinerary", label: "行程總覽" },
        { key: "journal", label: "旅遊書" },
      ]
    : [{ key: "collaborators", label: "共同編輯" }];
  const activeShareTab = shareTabs.some((t) => t.key === shareTab)
    ? shareTab
    : "collaborators";
  const shareTitle = isOwner ? "分享" : "協作者";

  return (
    <>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <ToolbarChip
          icon={Wallet}
          caption="預算"
          value={budget ?? "尚未記錄"}
          onClick={() => setSheet("budget")}
        />
        <ToolbarChip
          icon={ShieldAlert}
          tone="danger"
          caption={emergencyInfo ? "出事時看這裡" : "尚未填寫"}
          value="緊急資訊"
          onClick={() => setSheet("emergency")}
        />
        <ToolbarChip
          icon={Share2}
          caption={`${collaborators.length} 人協作`}
          value={shareTitle}
          onClick={() => {
            setShareTab("collaborators");
            setSheet("share");
          }}
        />
      </div>

      {sheet === "budget" && (
        <AppModal titleId="trip-budget-title" title="預算" onClose={() => setSheet(null)}>
          <BudgetSummary days={days} />
        </AppModal>
      )}

      {sheet === "emergency" && (
        <AppModal
          titleId="trip-emergency-title"
          title="緊急資訊"
          onClose={() => setSheet(null)}
        >
          <EmergencyInfoCard
            tripId={tripId}
            emergencyInfo={emergencyInfo}
            canEdit={canEdit}
            bare
          />
        </AppModal>
      )}

      {sheet === "share" && (
        <AppModal titleId="trip-share-title" title={shareTitle} onClose={() => setSheet(null)}>
          {shareTabs.length > 1 && (
            <div
              role="tablist"
              aria-label="分享方式"
              className="mb-4 flex gap-1 rounded-lg bg-paper-alt p-1"
            >
              {shareTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeShareTab === tab.key}
                  onClick={() => setShareTab(tab.key)}
                  className={`min-h-9 flex-1 rounded-md px-2 text-sm ${
                    activeShareTab === tab.key
                      ? "bg-surface font-medium text-ink-900 shadow-sm"
                      : "text-ink-500"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          {activeShareTab === "collaborators" && (
            <CollaboratorsPanel
              tripId={tripId}
              collaborators={collaborators}
              canManage={isOwner}
              shareEnabled={shareEnabled}
              shareToken={shareToken}
              shareRole={shareRole}
              bare
            />
          )}
          {activeShareTab === "itinerary" && (
            <ItinerarySharePanel
              tripId={tripId}
              canManage={isOwner}
              itineraryShareEnabled={itineraryShareEnabled}
              itineraryShareToken={itineraryShareToken}
              bare
            />
          )}
          {activeShareTab === "journal" && (
            <JournalSharePanel
              tripId={tripId}
              canManage={isOwner}
              journalShareEnabled={journalShareEnabled}
              journalShareToken={journalShareToken}
              bare
            />
          )}
        </AppModal>
      )}
    </>
  );
}

function ToolbarChip({
  icon: Icon,
  caption,
  value,
  tone = "brand",
  onClick,
}: {
  icon: LucideIcon;
  caption: string;
  value: string;
  tone?: "brand" | "danger";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left shadow-sm hover:bg-paper-alt"
    >
      <Icon
        className={`h-[18px] w-[18px] shrink-0 ${
          tone === "danger" ? "text-danger-600" : "text-brand-600"
        }`}
      />
      <span>
        <span className="block text-[11px] leading-tight text-ink-500">{caption}</span>
        <span className="block whitespace-nowrap text-sm font-medium leading-snug text-ink-900 tabular-nums">
          {value}
        </span>
      </span>
    </button>
  );
}
