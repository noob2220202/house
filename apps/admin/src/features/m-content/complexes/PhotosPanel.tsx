'use client';
import {
  Badge,
  ConfirmDialog,
  Dropzone,
  EmptyState,
  Icon,
  IconButton,
  Panel,
  Spinner,
  useToast,
} from '@house/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { errorMessage, qk } from '@/lib/api';
import { complexes } from '../api';
import type { ComplexDetail, ComplexPhoto } from '../api/schemas';
import { OrderButtons } from '../components/OrderButtons';
import {
  PHOTO_MAX_COUNT,
  PHOTO_MIME,
  applyPhotoChange,
  photoFileError,
  takeWithinLimit,
  type PhotoChange,
} from '../lib/complex';
import styles from './complexes.module.css';

interface Upload {
  key: string;
  name: string;
  status: 'uploading' | 'done' | 'error';
  message?: string;
}

/** Backend media goes through the optimizer; mock stand-ins (SVG) and blobs are served as-is. */
function PhotoImage({ photo, alt }: { photo: ComplexPhoto; alt: string }) {
  return (
    <Image
      src={photo.url}
      alt={alt}
      fill
      sizes="(max-width: 720px) 50vw, 240px"
      unoptimized={!photo.url.startsWith('/media/')}
    />
  );
}

function CaptionInput({
  photo,
  index,
  onSave,
}: {
  photo: ComplexPhoto;
  index: number;
  onSave: (caption: string | null) => void;
}) {
  const [value, setValue] = useState(photo.caption ?? '');
  useEffect(() => setValue(photo.caption ?? ''), [photo.caption]);
  return (
    <input
      className={styles.caption}
      value={value}
      maxLength={100}
      placeholder="사진 설명 (예: 단지 전경)"
      aria-label={`${index + 1}번째 사진 설명`}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const next = value.trim() || null;
        if (next !== (photo.caption ?? null)) onSave(next);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

/**
 * 단지 사진: upload (media → READY → append), caption, order (first = 대표 사진), delete — each as a
 * whole-list PUT /admin/complexes/:id/photos.
 */
export function PhotosPanel({
  complex,
  onChanged,
}: {
  complex: ComplexDetail;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [deleting, setDeleting] = useState<ComplexPhoto | null>(null);
  const seq = useRef(0);
  const photos = complex.photos;
  const detailKey = qk('admin-complexes', 'detail', complex.id);
  const busyUploading = uploads.some((u) => u.status === 'uploading');

  const setPhotos = (next: ComplexPhoto[]) =>
    queryClient.setQueryData<ComplexDetail>(detailKey, (prev) =>
      prev ? { ...prev, photos: next, photoCount: next.length } : prev,
    );
  const refreshLists = () =>
    void queryClient.invalidateQueries({ queryKey: ['admin-complexes', 'list'] });

  const onFiles = async (files: File[]) => {
    const { accepted, rejected } = takeWithinLimit(files, photos.length);
    if (rejected.length > 0)
      toast({
        message: `사진은 ${PHOTO_MAX_COUNT}장까지 등록할 수 있어요. ${rejected.length}장은 올리지 않았어요.`,
        tone: 'error',
      });
    const queue = accepted.map((file) => {
      seq.current += 1;
      const problem = photoFileError(file);
      return {
        file,
        upload: {
          key: `u${seq.current}`,
          name: file.name,
          status: problem ? 'error' : 'uploading',
          message: problem ?? undefined,
        } satisfies Upload,
      };
    });
    if (queue.length === 0) return;
    setUploads((prev) => [...queue.map((q) => q.upload), ...prev].slice(0, 12));
    const settle = (key: string, patch: Partial<Upload>) =>
      setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, ...patch } : u)));

    let added = 0;
    // One at a time: keeps the order of the selection and is gentle on the upload endpoint.
    for (const { file, upload } of queue) {
      if (upload.status === 'error') continue;
      try {
        const media = await complexes.uploadPhoto(file);
        await save.mutateAsync({
          kind: 'add',
          photo: {
            id: media.id,
            mediaId: media.id,
            url: media.variants.medium?.url ?? media.url ?? media.variants.large?.url ?? '',
            width: media.width,
            height: media.height,
            caption: null,
            sortOrder: photos.length + added,
          },
        });
        settle(upload.key, { status: 'done' });
        added += 1;
      } catch (e) {
        settle(upload.key, { status: 'error', message: errorMessage(e) });
      }
    }
    if (added > 0) {
      toast(`사진 ${added}장을 추가했어요.`);
      refreshLists();
      onChanged();
    }
  };

  /**
   * Every edit (add, caption, order, delete) replaces the whole list with PUT …/photos. The calls
   * run one after another (`scope`) and each one starts from the list the previous one saved, so
   * quick consecutive edits never undo each other.
   */
  const save = useMutation({
    scope: { id: `admin-complex-photos-${complex.id}` },
    mutationFn: async (change: PhotoChange<ComplexPhoto>) => {
      const current = queryClient.getQueryData<ComplexDetail>(detailKey)?.photos ?? photos;
      const next = applyPhotoChange(current, change);
      setPhotos(next);
      return complexes.setPhotos(complex.id, next);
    },
    onSuccess: (saved, change) => {
      setPhotos(saved);
      if (change.kind === 'caption') toast('사진 설명을 저장했어요.');
      if (change.kind === 'remove') {
        setDeleting(null);
        toast('사진을 삭제했어요.');
        refreshLists();
        onChanged();
      }
    },
    onError: (e, change) => {
      if (change.kind === 'remove') setDeleting(null);
      // Uploads report per file; everything else through a toast. Reload the saved list.
      if (change.kind !== 'add') toast({ message: errorMessage(e), tone: 'error' });
      onChanged();
    },
  });

  const move = (photo: ComplexPhoto, delta: -1 | 1) =>
    save.mutate({ kind: 'move', mediaId: photo.mediaId, delta });
  const full = photos.length >= PHOTO_MAX_COUNT;

  return (
    <>
      <Panel
        title="사진"
        count={photos.length}
        description={`최대 ${PHOTO_MAX_COUNT}장 · 첫 번째 사진이 대표 사진이에요`}
      >
        <Dropzone
          onFiles={(files) => void onFiles(files)}
          accept={PHOTO_MIME.join(',')}
          multiple
          disabled={full || busyUploading}
          label="단지 사진 선택"
          title={
            full
              ? `사진을 ${PHOTO_MAX_COUNT}장 모두 등록했어요`
              : '사진을 끌어다 놓거나 클릭해서 선택'
          }
          hint="JPG · PNG · WebP, 장당 10MB 이하 · 가로 사진(4:3)을 권장해요"
        />
        {uploads.length > 0 && (
          <ul className={styles.uploads} aria-label="업로드 상태" aria-live="polite">
            {uploads.map((u) => (
              <li key={u.key} className={styles.upload}>
                {u.status === 'uploading' ? (
                  <Spinner size={16} />
                ) : (
                  <Icon name={u.status === 'done' ? 'check-circle' : 'alert'} size={16} />
                )}
                <span className={styles.uploadName}>{u.name}</span>
                {u.status === 'uploading' && <span>올리는 중…</span>}
                {u.status === 'done' && <span className={styles.uploadOk}>완료</span>}
                {u.status === 'error' && <span className={styles.uploadErr}>{u.message}</span>}
              </li>
            ))}
          </ul>
        )}

        {photos.length === 0 ? (
          <EmptyState
            compact
            icon="image"
            title="아직 사진이 없어요"
            description="사진이 없는 단지는 사용자 화면에 기본 그림이 보여요."
          />
        ) : (
          <ul className={styles.photoGrid}>
            {photos.map((photo, index) => (
              <li key={photo.id} className={styles.photo}>
                <div className={styles.photoImg}>
                  <PhotoImage
                    photo={photo}
                    alt={photo.caption ?? `${complex.name} 사진 ${index + 1}`}
                  />
                  {index === 0 && (
                    <Badge tone="ink" className={styles.cover}>
                      대표
                    </Badge>
                  )}
                </div>
                <div className={styles.photoBody}>
                  <CaptionInput
                    photo={photo}
                    index={index}
                    onSave={(next) =>
                      save.mutate({ kind: 'caption', mediaId: photo.mediaId, caption: next })
                    }
                  />
                  <div className={styles.photoTools}>
                    <OrderButtons
                      direction="horizontal"
                      name={`${index + 1}번째 사진`}
                      index={index}
                      count={photos.length}
                      onMove={(delta) => move(photo, delta)}
                    />
                    <IconButton
                      label={`${index + 1}번째 사진 삭제`}
                      size={32}
                      variant="plain"
                      onClick={() => setDeleting(photo)}
                    >
                      <Icon name="trash" size={18} />
                    </IconButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && save.mutate({ kind: 'remove', mediaId: deleting.mediaId })}
        title="사진을 삭제할까요?"
        description={
          deleting && photos[0]?.id === deleting.id && photos.length > 1
            ? '대표 사진을 삭제하면 다음 사진이 대표 사진이 돼요.'
            : '삭제한 사진은 되돌릴 수 없어요.'
        }
        confirmLabel="삭제"
        danger
        loading={save.isPending && save.variables?.kind === 'remove'}
      />
    </>
  );
}
