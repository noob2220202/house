'use client';
import { Dropzone, FormSection, HelpLine, Icon, Spinner, cx } from '@house/ui';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { mediaImage } from '@/features/w-listing/lib/media';
import { errorMessage } from '@/lib/api';
import { fetchMedia, uploadListingPhoto } from '../api/queries';
import {
  CAPTION_PRESETS,
  PHOTO_ACCEPT,
  PHOTO_MAX_COUNT,
  checkPhotoFiles,
  movePhoto,
  normalizeCover,
  removePhoto,
  setCover,
  variantUrls,
  type PhotoValue,
} from '../lib/photos';
import { useWizard } from './context';
import styles from './wizard.module.css';

interface Upload {
  key: string;
  name: string;
  preview: string;
  file: File;
  error?: string;
}

let uploadSeq = 0;
/** Variant polling after an upload: up to 6 × 1.5 s, then the local file is shown. */
const VARIANT_POLLS = 6;
const VARIANT_POLL_MS = 1500;

/** Step 4 — 사진: multi upload, drag (or button) reorder, cover, captions. */
export function StepPhotos() {
  const { photos, setPhotos, setUploading } = useWizard();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [rejects, setRejects] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');
  const previews = useRef(new Set<string>());

  const pending = uploads.filter((u) => !u.error).length;
  useEffect(() => setUploading(pending), [pending, setUploading]);
  useEffect(() => {
    const urls = previews.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      setUploading(0);
    };
  }, [setUploading]);

  /** Drops a finished / cancelled upload; `keepPreview` = its object URL is now a photo's image. */
  const finish = (key: string, keepPreview = false) =>
    setUploads((list) => {
      const done = list.find((u) => u.key === key);
      if (done) {
        if (!keepPreview) URL.revokeObjectURL(done.preview);
        previews.current.delete(done.preview);
      }
      return list.filter((u) => u.key !== key);
    });

  const start = async (upload: Upload) => {
    try {
      const media = await uploadListingPhoto(upload.file);
      // The media queue builds the variants after the upload (PENDING → READY): poll briefly, then
      // show the local file until the server copy exists (the photo is attached by `mediaId`).
      let urls = variantUrls(media);
      for (let i = 0; !urls && i < VARIANT_POLLS; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, VARIANT_POLL_MS));
        urls = variantUrls(await fetchMedia(media.id).catch(() => media));
      }
      const ready = urls ?? { url: upload.preview, thumbUrl: upload.preview };
      setPhotos((list) =>
        normalizeCover([...list, { mediaId: media.id, ...ready, caption: '', isCover: false }]),
      );
      finish(upload.key, !urls);
    } catch (error) {
      const message = errorMessage(error);
      setUploads((list) => list.map((u) => (u.key === upload.key ? { ...u, error: message } : u)));
    }
  };

  const addFiles = (files: File[]) => {
    const { accepted, rejected } = checkPhotoFiles(files, photos.length + uploads.length);
    setRejects(rejected);
    const next = accepted.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      uploadSeq += 1;
      return { key: `u${uploadSeq}`, name: file.name, preview, file };
    });
    if (next.length === 0) return;
    setUploads((list) => [...list, ...next]);
    next.forEach((u) => void start(u));
  };

  const retry = (upload: Upload) => {
    setUploads((list) => list.map((u) => (u.key === upload.key ? { ...u, error: undefined } : u)));
    void start(upload);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= photos.length || from === to) return;
    setPhotos((list) => normalizeCover(movePhoto(list, from, to)));
    setAnnounce(`사진을 ${to + 1}번째로 옮겼어요.`);
  };

  const update = (mediaId: string, patch: Partial<PhotoValue>) =>
    setPhotos((list) => list.map((p) => (p.mediaId === mediaId ? { ...p, ...patch } : p)));

  const full = photos.length + uploads.length >= PHOTO_MAX_COUNT;

  return (
    <FormSection letter="A" title="매물 사진" note={`최대 ${PHOTO_MAX_COUNT}장 · 장당 10MB`}>
      <div className={styles.stack}>
        <Dropzone
          onFiles={addFiles}
          accept={PHOTO_ACCEPT}
          multiple
          disabled={full}
          label="매물 사진 선택"
          title={
            full
              ? `사진은 ${PHOTO_MAX_COUNT}장까지 올릴 수 있어요`
              : '사진을 끌어다 놓거나 눌러서 선택하세요'
          }
          hint="JPG · PNG · WEBP · HEIC. 위치 정보(EXIF)는 올릴 때 자동으로 지워져요."
        />
        {rejects.length > 0 && (
          <ul className={styles.rejects} role="alert">
            {rejects.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}

        <div className={styles.photoHead}>
          <p className={styles.photoCount}>
            <b>{photos.length}</b> / {PHOTO_MAX_COUNT}장{pending > 0 && ` · ${pending}장 올리는 중`}
          </p>
          <HelpLine>
            끌어서 순서를 바꾸고, 첫 번째 사진이 대표 사진이에요. 키보드는 ← → 버튼을 써요.
          </HelpLine>
        </div>

        {photos.length === 0 && uploads.length === 0 ? (
          <p className={styles.photoEmpty}>
            아직 사진이 없어요. 거실·주방·방·욕실·전망 순서로 5장 이상 올리면 문의가 늘어나요.
          </p>
        ) : (
          <ul className={styles.photoGrid}>
            {photos.map((photo, i) => (
              <li
                key={photo.mediaId}
                className={cx(
                  styles.photo,
                  photo.isCover && styles.cover,
                  dragIndex === i && styles.dragging,
                  overIndex === i && dragIndex !== null && dragIndex !== i && styles.over,
                )}
                draggable
                onDragStart={(e) => {
                  setDragIndex(i);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', photo.mediaId);
                }}
                onDragOver={(e) => {
                  if (dragIndex === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (overIndex !== i) setOverIndex(i);
                }}
                onDragLeave={() => setOverIndex((cur) => (cur === i ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null) move(dragIndex, i);
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
              >
                <div className={styles.photoImg}>
                  <Image
                    {...mediaImage(photo.thumbUrl ?? photo.url)}
                    alt={photo.caption || `사진 ${i + 1}`}
                    fill
                    sizes="220px"
                  />
                  {photo.isCover && (
                    <span className={styles.photoBadge}>
                      <Icon name="star" size={12} />
                      대표
                    </span>
                  )}
                  <span className={styles.photoOrder} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className={styles.photoHandle} aria-hidden="true">
                    <Icon name="drag" size={16} />
                  </span>
                </div>
                <input
                  className={styles.photoCap}
                  aria-label={`사진 ${i + 1} 설명`}
                  placeholder="설명 (예: 거실)"
                  list="photo-captions"
                  maxLength={100}
                  value={photo.caption}
                  onChange={(e) => update(photo.mediaId, { caption: e.target.value })}
                />
                <div className={styles.photoActs}>
                  <button
                    type="button"
                    className={styles.miniBtn}
                    aria-label={`사진 ${i + 1} 앞으로 옮기기`}
                    disabled={i === 0}
                    onClick={() => move(i, i - 1)}
                  >
                    <Icon name="chevron-left" size={18} />
                  </button>
                  <button
                    type="button"
                    className={styles.miniBtn}
                    aria-label={`사진 ${i + 1} 뒤로 옮기기`}
                    disabled={i === photos.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    <Icon name="chevron-right" size={18} />
                  </button>
                  {!photo.isCover && (
                    <button
                      type="button"
                      className={cx(styles.miniBtn, styles.brand)}
                      onClick={() => {
                        setPhotos((list) => setCover(list, photo.mediaId));
                        setAnnounce('대표 사진으로 지정했어요.');
                      }}
                    >
                      대표로
                    </button>
                  )}
                  <span className={styles.spacer} />
                  <button
                    type="button"
                    className={cx(styles.miniBtn, styles.dangerBtn)}
                    aria-label={`사진 ${i + 1} 삭제`}
                    onClick={() => {
                      setPhotos((list) => removePhoto(list, photo.mediaId));
                      setAnnounce('사진을 삭제했어요.');
                    }}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              </li>
            ))}
            {uploads.map((u) => (
              <li key={u.key} className={styles.photo}>
                <div className={styles.photoImg}>
                  {/* Local preview of a file that is still uploading (object URL). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u.preview}
                    alt=""
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                  />
                  {u.error ? (
                    <span className={styles.photoFail} role="alert">
                      {u.error}
                    </span>
                  ) : (
                    <span className={styles.photoBusy} role="status">
                      <Spinner size={22} />
                      올리는 중
                    </span>
                  )}
                </div>
                <span
                  className={styles.help}
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {u.name}
                </span>
                <div className={styles.photoActs}>
                  {u.error && (
                    <button
                      type="button"
                      className={cx(styles.miniBtn, styles.brand)}
                      onClick={() => retry(u)}
                    >
                      다시 시도
                    </button>
                  )}
                  <span className={styles.spacer} />
                  {u.error && (
                    <button
                      type="button"
                      className={cx(styles.miniBtn, styles.dangerBtn)}
                      aria-label={`${u.name} 올리기 취소`}
                      onClick={() => finish(u.key)}
                    >
                      <Icon name="close" size={18} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <datalist id="photo-captions">
          {CAPTION_PRESETS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <p className="sr-only" role="status" aria-live="polite">
          {announce}
        </p>
        <HelpLine icon="shield">
          이 매물을 직접 찍은 사진만 올려 주세요. 다른 매물 사진이나 보정으로 실제와 달라 보이는
          사진은 허위·과장 광고가 될 수 있어요.
        </HelpLine>
      </div>
    </FormSection>
  );
}
