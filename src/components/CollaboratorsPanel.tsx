"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Users, Link2, Copy, Check } from "lucide-react";
import {
  addCollaborator,
  removeCollaborator,
  enableTripShare,
  disableTripShare,
  updateTripShareRole,
} from "@/app/trips/actions";

export type Collaborator = {
  userId: string;
  name: string;
  email: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
};

const ROLE_LABEL: Record<Collaborator["role"], string> = {
  OWNER: "擁有者",
  EDITOR: "可編輯",
  VIEWER: "僅檢視",
};

export default function CollaboratorsPanel({
  tripId,
  collaborators,
  canManage,
  shareEnabled,
  shareToken,
  shareRole,
}: {
  tripId: string;
  collaborators: Collaborator[];
  canManage: boolean;
  shareEnabled: boolean;
  shareToken: string | null;
  shareRole: "EDITOR" | "VIEWER" | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [isSharePending, startShareTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const shareUrl =
    shareEnabled && shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/trips/${tripId}?share=${shareToken}`
      : "";

  function handleEnableShare() {
    setCopied(false);
    startShareTransition(async () => {
      await enableTripShare(tripId, "EDITOR");
      router.refresh();
    });
  }

  function handleDisableShare() {
    setCopied(false);
    startShareTransition(async () => {
      await disableTripShare(tripId);
      router.refresh();
    });
  }

  function handleShareRoleChange(role: "EDITOR" | "VIEWER") {
    startShareTransition(async () => {
      await updateTripShareRole(tripId, role);
      router.refresh();
    });
  }

  async function handleCopyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const email = (formData.get("email") as string)?.trim();
    const role = formData.get("role") as "EDITOR" | "VIEWER";

    if (!email) return;
    if (collaborators.some((c) => c.email === email.toLowerCase())) {
      setError("這個信箱已經在協作名單裡了");
      return;
    }

    startTransition(async () => {
      await addCollaborator(tripId, email, role);
      formRef.current?.reset();
      router.refresh();
    });
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      await removeCollaborator(tripId, userId);
      router.refresh();
    });
  }

  // Reuses addCollaborator rather than a new action — it already upserts
  // by email, so calling it again with the same email just updates that
  // row's role instead of creating a duplicate.
  function handleRoleChange(email: string, role: "EDITOR" | "VIEWER") {
    startTransition(async () => {
      await addCollaborator(tripId, email, role);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        <Users className="h-4 w-4" />
        共同協作者
      </h3>

      <ul className="mt-3 space-y-2">
        {collaborators.map((c) => (
          <li
            key={c.userId}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <div>
              <span className="font-medium text-slate-700">{c.name}</span>
              <span className="ml-2 text-xs text-slate-600">{c.email}</span>
            </div>
            <div className="flex items-center gap-2">
              {canManage && c.role !== "OWNER" ? (
                <select
                  value={c.role}
                  disabled={isPending}
                  onChange={(e) =>
                    handleRoleChange(c.email, e.target.value as "EDITOR" | "VIEWER")
                  }
                  className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600 disabled:opacity-50"
                >
                  <option value="EDITOR">可編輯</option>
                  <option value="VIEWER">僅檢視</option>
                </select>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {ROLE_LABEL[c.role]}
                </span>
              )}
              {canManage && c.role !== "OWNER" && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleRemove(c.userId)}
                  className="text-xs text-red-500 hover:underline disabled:opacity-50"
                >
                  移除
                </button>
              )}
            </div>
          </li>
        ))}

        {collaborators.length === 0 && (
          <p className="text-sm text-slate-600">還沒有共同協作者。</p>
        )}
      </ul>

      {canManage && (
        <>
          <form
            ref={formRef}
            onSubmit={handleAdd}
            className="mt-4 flex flex-col gap-2 sm:flex-row"
          >
            <input
              name="email"
              type="email"
              required
              placeholder="邀請夥伴的 email"
              className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm"
            />
            <select
              name="role"
              defaultValue="EDITOR"
              className="rounded-md border border-slate-200 px-2 py-1 text-sm"
            >
              <option value="EDITOR">可編輯</option>
              <option value="VIEWER">僅檢視</option>
            </select>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-brand-600 px-3 py-1 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
            >
              邀請
            </button>
          </form>

          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <Link2 className="h-3.5 w-3.5" />
                分享連結
              </span>
              <button
                type="button"
                disabled={isSharePending}
                onClick={shareEnabled ? handleDisableShare : handleEnableShare}
                className={`rounded-md px-2.5 py-1 text-xs disabled:opacity-50 ${
                  shareEnabled
                    ? "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    : "bg-brand-600 text-white hover:bg-brand-700"
                }`}
              >
                {shareEnabled ? "關閉分享" : "開啟分享連結"}
              </button>
            </div>

            {shareEnabled && (
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">連結權限：</span>
                  <select
                    value={shareRole ?? "EDITOR"}
                    disabled={isSharePending}
                    onChange={(e) =>
                      handleShareRoleChange(e.target.value as "EDITOR" | "VIEWER")
                    }
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option value="EDITOR">可編輯</option>
                    <option value="VIEWER">僅檢視</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.target.select()}
                    className="min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied ? "已複製" : "複製"}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  任何人拿到這個連結，登入後就會自動加入為協作者。
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
