"use client";

import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/login/actions";

export default function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="flex items-center gap-1 text-xs text-ink-500 hover:text-brand-600"
      >
        <LogOut className="h-3.5 w-3.5" />
        登出
      </button>
    </form>
  );
}
