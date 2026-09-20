"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { upload } from "@vercel/blob/client";
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
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BookOpen, Camera, Trash2 } from "lucide-react";
import {
  updateItemJournalText,
  addItemPhoto,
  deleteItemPhoto,
  reorderItemPhotos,
} from "@/app/trips/actions";
import { MAX_PHOTOS_PER_ITEM, MAX_JOURNAL_TEXT_LENGTH } from "@/lib/limits";
import { useToast } from "./Toast";
import ModalOverlay, { ModalCloseButton, type ModalOverlayHandle } from "./ModalOverlay";
import PhotoLightbox from "./PhotoLightbox";

export type JournalPhoto = { id: string; url: string };

function SortablePhoto({
  photo,
  onOpen,
  onDelete,
}: {
  photo: JournalPhoto;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: photo.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
      className={`relative overflow-hidden rounded-lg ${isDragging ? "opacity-80 shadow-lg" : ""}`}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label="放大照片"
        className="block h-24 w-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt="" draggable={false} className="h-24 w-full object-cover" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="刪除照片"
        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

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
  const modalRef = useRef<ModalOverlayHandle>(null);
  const [journalText, setJournalText] = useState(initialJournalText ?? "");
  const [photos, setPhotos] = useState(initialPhotos);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const images = files.filter((f) => f.type.startsWith("image/"));
    const notes: string[] = [];
    if (images.length < files.length) notes.push("已略過非圖片檔案");

    // Checked before paying for the upload — the server enforces the same
    // limit but only after the blob already landed in storage.
    const remaining = MAX_PHOTOS_PER_ITEM - photos.length;
    if (remaining <= 0) {
      setError(`一個項目最多 ${MAX_PHOTOS_PER_ITEM} 張照片`);
      return;
    }
    const batch = images.slice(0, remaining);
    if (images.length > remaining) {
      notes.push(`最多 ${MAX_PHOTOS_PER_ITEM} 張，只上傳前 ${remaining} 張`);
    }
    if (batch.length === 0) {
      setError("請選擇圖片檔案");
      return;
    }

    setError(null);
    setIsUploading(true);
    // Sequential on purpose: each addItemPhoto re-checks the per-item cap
    // and the daily upload quota, so parallel calls could race past them.
    let done = 0;
    try {
      for (const file of batch) {
        setUploadProgress(`上傳中 ${done + 1}/${batch.length}`);
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
        });
        const result = await addItemPhoto(tripId, itemId, blob.url);
        if (!result.ok) {
          notes.push(result.error);
          break;
        }
        setPhotos((prev) => [...prev, result.photo]);
        done++;
      }
    } catch (err) {
      notes.push(
        err instanceof Error ? `上傳失敗：${err.message}` : "上傳失敗，請再試一次",
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
    if (done < batch.length && notes.length === 0) notes.push("部分照片上傳失敗");
    if (notes.length > 0) {
      setError(
        (done > 0 ? `已上傳 ${done} 張。` : "") + notes.join("；"),
      );
    }
  }

  async function handleDeletePhoto(photoId: string) {
    // Optimistic removal with rollback — without the catch, a failed
    // delete left the photo gone from the UI but still saved (it came
    // back on reload), plus an unhandled rejection.
    const previous = photos;
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    try {
      await deleteItemPhoto(tripId, itemId, photoId);
    } catch {
      setPhotos(previous);
      setError("刪除照片失敗，請再試一次");
    }
  }

  // Persisted immediately (like upload/delete) rather than on 儲存, so
  // closing the modal without saving doesn't silently drop the new order.
  // Writes are chained so quick successive taps land in the order tapped.
  const reorderQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // Long-press on touch so a normal swipe still scrolls the modal.
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  );

  // Enlarge/delete taps are ignored while a drag is in progress and for a
  // moment after the drop — releasing a long-press (esp. on touch) can
  // still fire a click on the photo or its delete button underneath.
  const clickLockedUntilRef = useRef(0);
  const isClickLocked = () => Date.now() < clickLockedUntilRef.current;
  function lockClicksAfterDrag() {
    clickLockedUntilRef.current = Date.now() + 400;
  }

  function handleDragEnd(event: DragEndEvent) {
    lockClicksAfterDrag();
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = photos.findIndex((p) => p.id === active.id);
    const to = photos.findIndex((p) => p.id === over.id);
    if (from < 0 || to < 0) return;
    const previous = photos;
    const next = arrayMove(photos, from, to);
    setPhotos(next);
    const ids = next.map((p) => p.id);
    reorderQueueRef.current = reorderQueueRef.current
      .catch(() => {})
      .then(() => reorderItemPhotos(tripId, itemId, ids))
      .catch(() => {
        setPhotos(previous);
        setError("調整順序失敗，請再試一次");
      });
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await updateItemJournalText(tripId, itemId, journalText);
      toast.success("已儲存遊記");
      onSaved({ journalText: journalText.trim() || null, photos });
      modalRef.current?.requestClose();
    } catch {
      setError("儲存失敗，請再試一次");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ModalOverlay
      ref={modalRef}
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
        <ModalCloseButton />
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
            maxLength={MAX_JOURNAL_TEXT_LENGTH}
            placeholder="寫下這裡的回憶……"
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
          />
        </div>

        <div>
          <p className="text-xs font-medium text-ink-700">照片</p>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={() => {
                clickLockedUntilRef.current = Infinity;
              }}
              onDragEnd={handleDragEnd}
              onDragCancel={lockClicksAfterDrag}
            >
              <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
                {photos.map((photo, i) => (
                  <SortablePhoto
                    key={photo.id}
                    photo={photo}
                    onOpen={() => {
                      if (!isClickLocked()) setLightboxIndex(i);
                    }}
                    onDelete={() => {
                      if (!isClickLocked()) handleDeletePhoto(photo.id);
                    }}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || photos.length >= MAX_PHOTOS_PER_ITEM}
              className="flex h-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-ink-500 hover:border-brand-400 hover:text-brand-600 disabled:opacity-50"
            >
              <Camera className="h-5 w-5" />
              <span className="text-xs">
                {isUploading
                  ? (uploadProgress ?? "上傳中…")
                  : photos.length >= MAX_PHOTOS_PER_ITEM
                    ? `已達 ${MAX_PHOTOS_PER_ITEM} 張上限`
                    : "新增照片"}
              </span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {error && <p className="text-xs text-danger-600">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isSaving ? "儲存中…" : "儲存"}
        </button>
      </div>

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </ModalOverlay>
  );
}
