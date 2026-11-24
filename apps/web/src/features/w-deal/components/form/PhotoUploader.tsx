'use client';
import { ALLOWED_IMAGE_MIME } from '@house/shared';
import { FieldError, Icon, Spinner, cx } from '@house/ui';
import Image from 'next/image';
import { useCallback, useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { errorMessage } from '@/lib/api';
import { dealApi, mediaThumbUrl } from '../../api/client';
import type { UploadedPhoto } from '../../lib/form-common';
import { MAX_PHOTO_BYTES, MAX_REQUEST_PHOTOS } from '../../lib/labels';
import styles from './form.module.css';

interface PendingUpload {
  key: string;
  /** Selection order — finished uploads are inserted by it, not by completion time. */
  seq: number;
  name: string;
  preview: string;
  file: File;
  error?: string;
}

const ACCEPT = ALLOWED_IMAGE_MIME.join(',');
/** Browsers often report an empty type for HEIC/HEIF (Windows) — fall back to the extension. */
const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
/** The media API processes variants asynchronously: poll GET /media/:id for the thumbnail. */
const POLL_MS = 1000;
const POLL_TRIES = 20;

let nextSeq = 0;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Client-side pre-check (the server sniffs the real type again). Returns a message or null. */
export function checkPhotoFile(file: Pick<File, 'type' | 'size' | 'name'>): string | null {
  const typeOk =
    file.type === ''
      ? IMAGE_EXT.test(file.name)
      : (ALLOWED_IMAGE_MIME as readonly string[]).includes(file.type);
  if (!typeOk) return 'JPG · PNG · WEBP · HEIC 사진만 올릴 수 있어요.';
  if (file.size > MAX_PHOTO_BYTES) return '한 장에 10MB까지 올릴 수 있어요.';
  return null;
}

export interface PhotoUploaderProps {
  id: string;
  value: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  /** True while any upload is in flight (the wizard disables its primary button meanwhile). */
  onBusyChange?: (busy: boolean) => void;
  error?: string;
}

/**
 * Inserts a finished upload after the last photo that was selected before it, so the order is
 * the selection order even when uploads finish out of order (photos restored from a draft or
 * moved by "대표로" keep their place).
 */
export function insertBySeq(
  list: readonly UploadedPhoto[],
  photo: UploadedPhoto,
  seq: number,
  seqOf: (id: string) => number,
): UploadedPhoto[] {
  let at = 0;
  list.forEach((p, i) => {
    if (seqOf(p.id) < seq) at = i + 1;
  });
  return [...list.slice(0, at), photo, ...list.slice(at)];
}

/**
 * Photo upload for 내놓기: drop area per design, immediate upload through POST /media
 * (purpose DEAL_REQUEST_PHOTO), thumbnails with 대표 badge, remove, and "대표로" reorder.
 */
export function PhotoUploader({ id, value, onChange, onBusyChange, error }: PhotoUploaderProps) {
  const hintId = useId();
  const [over, setOver] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  // Latest value for async upload callbacks (several uploads may finish in any order).
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  /** Uploads the user cancelled while they were still in flight. */
  const cancelled = useRef(new Set<string>());
  const previews = useRef(new Set<string>());
  /** Photo id → selection order / local blob preview (this session's uploads only). */
  const seqs = useRef(new Map<string, number>());
  const localPreview = useRef(new Map<string, string>());
  /** Photo ids whose thumbnail is being polled / was polled without success. */
  const polled = useRef(new Set<string>());
  const [stalled, setStalled] = useState<ReadonlySet<string>>(new Set());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const urls = previews.current;
    return () => {
      mounted.current = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const busy = pending.some((p) => !p.error);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  const total = value.length + pending.length;
  const full = total >= MAX_REQUEST_PHOTOS;

  /** Waits for the thumbnail variant of a processed upload (PENDING → READY). Reads refs only. */
  const pollThumb = useCallback(async (photoId: string) => {
    if (polled.current.has(photoId)) return;
    polled.current.add(photoId);
    for (let i = 0; i < POLL_TRIES; i += 1) {
      await sleep(POLL_MS);
      if (!mounted.current || !valueRef.current.some((p) => p.id === photoId)) return;
      try {
        const url = mediaThumbUrl(await dealApi.getMedia(photoId));
        if (url) {
          const next = valueRef.current.map((p) => (p.id === photoId ? { ...p, url } : p));
          valueRef.current = next;
          onChangeRef.current(next);
          return;
        }
      } catch {
        /* keep trying until the time is up */
      }
    }
    if (mounted.current) setStalled((set) => new Set(set).add(photoId));
  }, []);

  // Photos without a thumbnail yet — fresh uploads, or restored from a draft / an earlier visit.
  useEffect(() => {
    value.filter((p) => !p.url).forEach((p) => void pollThumb(p.id));
  }, [value, pollThumb]);

  const upload = async (item: PendingUpload) => {
    try {
      const media = await dealApi.uploadPhoto(item.file);
      if (cancelled.current.has(item.key)) {
        void dealApi.deleteMedia(media.id).catch(() => undefined);
        return;
      }
      seqs.current.set(media.id, item.seq);
      localPreview.current.set(media.id, item.preview);
      const photo: UploadedPhoto = { id: media.id, url: mediaThumbUrl(media), name: item.name };
      const next = insertBySeq(
        valueRef.current,
        photo,
        item.seq,
        (photoId) => seqs.current.get(photoId) ?? -1,
      );
      valueRef.current = next;
      onChangeRef.current(next);
      setPending((list) => list.filter((p) => p.key !== item.key));
    } catch (e) {
      setPending((list) =>
        list.map((p) => (p.key === item.key ? { ...p, error: errorMessage(e) } : p)),
      );
    }
  };

  const addFiles = (files: File[]) => {
    setNotice(null);
    const room = MAX_REQUEST_PHOTOS - total;
    const rejected: string[] = [];
    const accepted: PendingUpload[] = [];
    for (const file of files) {
      const problem = checkPhotoFile(file);
      if (problem) {
        rejected.push(`${file.name}: ${problem}`);
        continue;
      }
      if (accepted.length >= room) {
        rejected.push(`사진은 최대 ${MAX_REQUEST_PHOTOS}장까지 올릴 수 있어요.`);
        break;
      }
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      nextSeq += 1;
      accepted.push({
        key: `${Date.now()}-${accepted.length}-${file.name}`,
        seq: nextSeq,
        name: file.name,
        preview,
        file,
      });
    }
    if (rejected.length > 0) setNotice(rejected.slice(0, 2).join(' '));
    if (accepted.length === 0) return;
    setPending((list) => [...list, ...accepted]);
    accepted.forEach((item) => void upload(item));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!full) addFiles(Array.from(e.dataTransfer.files));
  };

  const remove = (photo: UploadedPhoto) => {
    onChange(value.filter((p) => p.id !== photo.id));
    // Best effort — orphaned uploads are cleaned up by the backend anyway.
    void dealApi.deleteMedia(photo.id).catch(() => undefined);
  };

  const makeCover = (photo: UploadedPhoto) =>
    onChange([photo, ...value.filter((p) => p.id !== photo.id)]);

  return (
    <>
      <label
        className={cx(styles.drop, over && styles.over, full && styles.disabled)}
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          if (!full) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <input
          id={id}
          className="sr-only"
          type="file"
          multiple
          accept={ACCEPT}
          disabled={full}
          aria-describedby={hintId}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
        <span className={styles.dropIc}>
          <Icon name="upload" size={22} />
        </span>
        <span className={styles.dropT}>사진을 끌어 놓거나 눌러서 올려 주세요</span>
        <span className={styles.dropCap} id={hintId}>
          JPG · PNG · HEIC, 장당 10MB, 최대 {MAX_REQUEST_PHOTOS}장 · 거실, 주방, 창밖 풍경 순서를
          추천해요
        </span>
      </label>
      {(notice || error) && <FieldError>{notice ?? error}</FieldError>}
      {total > 0 && (
        <div className={styles.thumbs}>
          {value.map((photo, i) => {
            // Until the server thumbnail exists, show this session's local preview.
            const src = photo.url || localPreview.current.get(photo.id);
            const processing = !photo.url;
            return (
              <figure key={photo.id} className={styles.thumb}>
                <div className={styles.thumbImg}>
                  {src && (
                    <Image src={src} alt={`올린 사진 ${i + 1}`} fill sizes="132px" unoptimized />
                  )}
                  {processing && !stalled.has(photo.id) && (
                    <span className={styles.thumbBusy}>
                      <Spinner size={20} label={`사진 ${i + 1} 처리 중`} />
                    </span>
                  )}
                </div>
                {i === 0 && <span className={styles.rep}>대표</span>}
                <figcaption className={styles.thumbCap}>
                  <span>{processing ? '처리 중' : i === 0 ? '대표 사진' : `사진 ${i + 1}`}</span>
                  {i > 0 && (
                    <button
                      type="button"
                      className={styles.thumbAct}
                      onClick={() => makeCover(photo)}
                      aria-label={`사진 ${i + 1}을 대표 사진으로 지정`}
                    >
                      대표로
                    </button>
                  )}
                </figcaption>
                <button
                  type="button"
                  className={styles.x}
                  onClick={() => remove(photo)}
                  aria-label={`사진 ${i + 1} 삭제`}
                >
                  <Icon name="close" size={16} />
                </button>
              </figure>
            );
          })}
          {pending.map((item) => (
            <figure key={item.key} className={styles.thumb}>
              <div className={styles.thumbImg}>
                {/* Local blob preview while the upload is in flight. */}
                <Image src={item.preview} alt="" fill sizes="132px" unoptimized />
                {item.error ? (
                  <span className={styles.thumbFail} role="alert">
                    업로드 실패
                  </span>
                ) : (
                  <span className={styles.thumbBusy}>
                    <Spinner label={`${item.name} 올리는 중`} />
                  </span>
                )}
              </div>
              <figcaption className={styles.thumbCap}>
                <span title={item.error}>{item.error ? '다시 시도해 주세요' : '올리는 중…'}</span>
                {item.error && (
                  <button
                    type="button"
                    className={styles.thumbAct}
                    onClick={() => {
                      setPending((list) =>
                        list.map((p) => (p.key === item.key ? { ...p, error: undefined } : p)),
                      );
                      void upload({ ...item, error: undefined });
                    }}
                  >
                    재시도
                  </button>
                )}
              </figcaption>
              <button
                type="button"
                className={styles.x}
                onClick={() => {
                  cancelled.current.add(item.key);
                  setPending((list) => list.filter((p) => p.key !== item.key));
                }}
                aria-label={`${item.name} 올리기 취소`}
              >
                <Icon name="close" size={16} />
              </button>
            </figure>
          ))}
          <span className={styles.thumbCount}>
            <b className="num">{value.length}</b> / {MAX_REQUEST_PHOTOS}장
          </span>
        </div>
      )}
    </>
  );
}
