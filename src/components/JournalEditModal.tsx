"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { upload } from "@vercel/blob/client";
import { BookOpen, Camera, Trash2, X } from "lucide-react";
import {
  updateItemJournalText,
  addItemPhoto,
  deleteItemPhoto,
} from "@/app/trips/actions";
import { useToast } from "./Toast";
import ModalOverlay from "./ModalOverlay";

export type JournalPhoto = { id: string; url: string };

export default function JournalEditModal({
  tripId,
  itemId,
  itemTitle,
  journalText: initialJournalText,
  photos: initialPhotos,
  onClose,
  onSaved,
}: {
  tripId: string;
  itemId: string;
  itemTitle: string;
  journalText: string | null;
  photos: JournalPhoto[];
  onClose: () => void;
  onSaved: (result: { journalText: string | null; photos: JournalPhoto[] }) => void;
}) {
  const toast = useToast();
  const [journalText, setJournalText] = useState(initialJournalText ?? "");
  const [photos, setPhotos] = useState(initialPhotos);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("請選擇圖片檔案");
      return;
    }

    setError(null);
    setIsUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      const photo = await addItemPhoto(tripId, itemId, blob.url);
      setPhotos((prev) => [...prev, photo]);
    } catch (err) {
      setError(err instanceof Error ? `上傳失敗：${err.message}` : "上傳失敗，請再試一次");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    await deleteItemPhoto(tripId, itemId, photoId);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await updateItemJournalText(tripId, itemId, journalText);
      toast.success("已儲存遊記");
      onSaved({ journalText: journalText.trim() || null, photos });
      onClose();
    } catch {
      setError("儲存失敗，請再試一次");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalOverlay
      onClose={onClose}
      titleId="journal-edit-modal-title"
      panelClassName="w-full max-w-md p-5 max-h-[85vh] overflow-y-auto"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="journal-edit-modal-title"
          className="flex items-center gap-1.5 text-lg font-bold text-ink-900"
        >
          <BookOpen className="h-5 w-5 text-rose-600" />
          {itemTitle}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉"
          className="flex min-h-11 min-w-11 items-center justify-center text-ink-400 hover:text-ink-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="journal-text"
            className="block text-xs font-medium text-ink-700"
          >
            遊記
          </label>
          <textarea
            id="journal-text"
            value={journalText}
            onChange={(e) => setJournalText(e.target.value)}
            rows={5}
            placeholder="寫下這裡的回憶……"
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
          />
        </div>

        <div>
          <p className="text-xs font-medium text-ink-700">照片</p>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" className="h-24 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(photo.id)}
                  aria-label="刪除照片"
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex h-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-ink-500 hover:border-brand-400 hover:text-brand-600 disabled:opacity-50"
            >
              <Camera className="h-5 w-5" />
              <span className="text-xs">{isUploading ? "上傳中…" : "新增照片"}</span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isSaving ? "儲存中…" : "儲存"}
        </button>
      </div>
    </ModalOverlay>
  );
}
