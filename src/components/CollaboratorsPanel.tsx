"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { addCollaborator, removeCollaborator } from "@/app/trips/actions";

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
}: {
  tripId: string;
  collaborators: Collaborator[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
    });
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      await removeCollaborator(tripId, userId);
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">共同協作者</h3>

      <ul className="mt-3 space-y-2">
        {collaborators.map((c) => (
          <li
            key={c.userId}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <div>
              <span className="font-medium text-slate-700">{c.name}</span>
              <span className="ml-2 text-xs text-slate-400">{c.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {ROLE_LABEL[c.role]}
              </span>
              {c.role !== "OWNER" && (
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
          <p className="text-sm text-slate-400">還沒有共同協作者。</p>
        )}
      </ul>

      <form ref={formRef} onSubmit={handleAdd} className="mt-4 flex gap-2">
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
          className="rounded-md bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          邀請
        </button>
      </form>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <p className="mt-3 text-xs text-slate-400">
        目前是原型階段，還沒有登入系統，所以這裡只管理「誰有存取權」的名單，
        還不會限制實際編輯權限。
      </p>
    </div>
  );
}
