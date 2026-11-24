'use client';
import type { MediaPurpose } from '@house/shared';
import { cx, Icon, Spinner } from '@house/ui';
import { useId, useRef, useState, type DragEvent } from 'react';
import { errorMessage } from '@/lib/api';
import { uploadAdImage } from '../api/hooks';
import { mediaUrl } from '../api/schemas';
import type { AdImageValue } from '../lib/banner-form';
import {
  AD_IMAGE_ACCEPT,
  AD_IMAGE_MAX_BYTES,
  formatBytes,
  formatSize,
  measureImage,
  ratioMatches,
  validateAdImage,
  type ImageSize,
} from '../lib/image-rules';
import { AdImage } from './AdImage';
import styles from './editor.module.css';
import { FormField } from './FormField';

export interface ImageUploadFieldProps {
  label: string;
  value: AdImageValue | null;
  onChange: (value: AdImageValue | null) => void;
  /** Required pixel size / ratio of the slot. */
  spec: ImageSize;
  purpose: MediaPurpose;
  required?: boolean;
  /** Form-level error (e.g. "PC 이미지를 올려 주세요"). */
  error?: string;
  /** When set the field is not applicable (e.g. the slot has no mobile placement). */
  unavailable?: string;
  /** Reports "an upload is running" so the form can block saving meanwhile. */
  onBusyChange?: (busy: boolean) => void;
}

/**
 * One ad image: pick / drop → measure → validate against the slot spec (type, size, pixels, ratio)
 * → upload to the media API. Shows the stored image with its size check, 교체 and (optional) 삭제.
 */
export function ImageUploadField({
  label,
  value,
  onChange,
  spec,
  purpose,
  required,
  error,
  unavailable,
  onBusyChange,
}: ImageUploadFieldProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const shownError = localError ?? error;

  const setBusyState = (next: boolean) => {
    setBusy(next);
    onBusyChange?.(next);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setLocalError(null);
    setBusyState(true);
    try {
      let size: ImageSize = { width: 0, height: 0 };
      try {
        size = await measureImage(file);
      } catch {
        // unreadable → the type check below reports it when the type is wrong, otherwise say so
        if (AD_IMAGE_ACCEPT.split(',').includes(file.type)) {
          setLocalError('이미지를 읽지 못했어요. 파일이 손상되지 않았는지 확인해 주세요.');
          return;
        }
      }
      const check = validateAdImage({ ...size, bytes: file.size, type: file.type }, spec);
      if (!check.ok) {
        setLocalError(check.message);
        return;
      }
      const media = await uploadAdImage(file, purpose);
      const url = mediaUrl(media);
      if (!url) {
        setLocalError('이미지 처리가 오래 걸리고 있어요. 잠시 후 다시 올려 주세요.');
        return;
      }
      onChange({
        mediaId: media.id,
        url,
        width: media.width ?? size.width,
        height: media.height ?? size.height,
        fileName: file.name,
        bytes: file.size,
      });
    } catch (e) {
      setLocalError(errorMessage(e));
    } finally {
      setBusyState(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setOver(false);
    void handleFile(e.dataTransfer.files[0]);
  };

  const input = (
    <input
      ref={inputRef}
      id={id}
      type="file"
      className="sr-only"
      accept={AD_IMAGE_ACCEPT}
      aria-describedby={shownError ? `${id}-err` : undefined}
      aria-invalid={shownError ? true : undefined}
      disabled={busy}
      onChange={(e) => void handleFile(e.target.files?.[0])}
    />
  );

  let tile;
  if (unavailable) {
    tile = (
      <div className={cx(styles.up, styles.upNone)}>
        <Icon name="minus" size={18} />
        <span>{unavailable}</span>
      </div>
    );
  } else if (busy) {
    tile = (
      <div className={cx(styles.up, styles.upBusy)} role="status">
        {input}
        <Spinner size={20} />
        <span>확인하고 올리는 중…</span>
      </div>
    );
  } else if (value) {
    const known = value.width !== null && value.height !== null;
    const size = { width: value.width ?? 0, height: value.height ?? 0 };
    const matches = known && ratioMatches(size, spec);
    tile = (
      <div
        className={cx(styles.up, styles.upDone, !!shownError && styles.upInvalid)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {input}
        <span className={styles.upImg}>
          <AdImage src={value.url} alt={`${label} 미리보기`} sizes="220px" fit="contain" />
        </span>
        <span className={styles.upFile}>
          <b>{value.fileName ?? '등록된 이미지'}</b>
          {value.bytes !== undefined && <span>{formatBytes(value.bytes)}</span>}
        </span>
        <span className={cx(styles.upOk, known && !matches && styles.upWarn)}>
          <Icon name={known && !matches ? 'alert' : 'check-circle'} size={14} />
          {known ? (
            <>
              <b>{formatSize(size, '×')}</b> {matches ? '비율 일치' : '비율 확인 필요'}
            </>
          ) : (
            '업로드됨'
          )}
        </span>
        <span className={styles.upBtns}>
          {!required && (
            <button
              type="button"
              className={styles.upRm}
              onClick={() => {
                setLocalError(null);
                onChange(null);
              }}
              aria-label={`${label} 삭제`}
            >
              삭제
            </button>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label={`${label} 교체`}
          >
            교체
          </button>
        </span>
      </div>
    );
  } else {
    tile = (
      <label
        htmlFor={id}
        className={cx(
          styles.up,
          styles.upEmpty,
          over && styles.upOver,
          !!shownError && styles.upInvalid,
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        {input}
        <Icon name="upload" size={20} />
        <span>
          <b>파일 선택</b> 또는 끌어다 놓기
        </span>
        <span className={styles.upSpec}>
          권장 {formatSize(spec)} · {formatBytes(AD_IMAGE_MAX_BYTES)} 이하
        </span>
      </label>
    );
  }

  return (
    <FormField
      label={label}
      htmlFor={unavailable ? undefined : id}
      required={required}
      error={unavailable ? undefined : shownError}
      errorId={`${id}-err`}
    >
      {tile}
    </FormField>
  );
}
