"use client";

import { Copy } from "lucide-react";
import { useToast } from "./Toast";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older iOS / non-secure contexts: fall back to a hidden textarea.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export default function CopyCaptionButton({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) toast.success("已複製，可以貼到 IG 了");
        else toast.error("複製失敗，請再試一次");
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-400 hover:text-brand-600"
    >
      <Copy className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
