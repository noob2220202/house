'use client';
import { AGENCY_DOCUMENT_TYPE_LABEL } from '@house/shared';
import { ErrorState, Icon, IconButton, Modal, Spinner } from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { env } from '@/config/env';
import { ApiError, normalizeError, toApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import s from './agencies.module.css';
import { agencyDocumentUrl } from '../api/queries';
import type { AdminAgencyDocument } from '../api/schemas';
import {
  VIEWER_DEFAULT_ZOOM_INDEX,
  VIEWER_ZOOMS,
  documentKind,
  layoutDocument,
  type DocumentKind,
  type Size,
} from '../lib/viewer';

export interface DocumentViewerProps {
  agencyId: string;
  agencyName: string;
  /** Document to show; null closes the viewer. */
  document: AdminAgencyDocument | null;
  onClose: () => void;
}

interface LoadedFile {
  blob: Blob;
  kind: DocumentKind;
  /** Content type the server sent (shown when the file cannot be previewed). */
  type: string;
}

/**
 * Streams a PRIVATE file through the authorized admin endpoint (cookies, never a public URL).
 * The bytes stay in memory as a Blob — nothing is cached on disk and the object URL is revoked
 * when the viewer closes.
 */
async function fetchPrivateFile(url: string, signal: AbortSignal): Promise<LoadedFile> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'include', cache: 'no-store', signal });
  } catch (error) {
    throw normalizeError(error);
  }
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw toApiError(res.status, body);
  }
  const blob = await res.blob();
  const kind = documentKind(blob.type, { allowSvg: env.apiMock });
  // Never keep script-capable bytes behind a same-origin blob: URL — drop them right here.
  return kind === 'other'
    ? { blob: new Blob([]), kind, type: blob.type }
    : { blob, kind, type: blob.type };
}

/** Modal viewer for an application document: zoom / rotate for images, embedded reader for PDFs. */
export function DocumentViewer({
  agencyId,
  agencyName,
  document: doc,
  onClose,
}: DocumentViewerProps) {
  const [zoomIndex, setZoomIndex] = useState<number>(VIEWER_DEFAULT_ZOOM_INDEX);
  const [rotation, setRotation] = useState(0);
  const [natural, setNatural] = useState<Size | null>(null);
  const [stage, setStage] = useState<Size | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const docId = doc?.id;

  const file = useQuery({
    queryKey: ['admin-agencies', 'document', agencyId, docId],
    queryFn: ({ signal }) => fetchPrivateFile(agencyDocumentUrl(agencyId, docId ?? ''), signal),
    enabled: !!docId,
    // Private bytes: do not keep them around after the viewer closes.
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });

  const objectUrl = useMemo(
    () => (file.data && file.data.kind !== 'other' ? URL.createObjectURL(file.data.blob) : null),
    [file.data],
  );
  useEffect(
    () => () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
    [objectUrl],
  );
  useEffect(() => {
    setZoomIndex(VIEWER_DEFAULT_ZOOM_INDEX);
    setRotation(0);
    setNatural(null);
  }, [docId]);
  // Track the stage size so "100%" always means "the whole page fits" (desktop and phone).
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !objectUrl) return;
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [objectUrl]);

  const zoom = VIEWER_ZOOMS[zoomIndex] ?? 1;
  const layout = natural && stage ? layoutDocument(natural, stage, zoom, rotation) : null;
  const title = doc ? AGENCY_DOCUMENT_TYPE_LABEL[doc.type] : '서류';
  const notAllowed = file.error instanceof ApiError && file.error.isForbidden;

  return (
    <Modal
      open={!!doc}
      onClose={onClose}
      size="lg"
      title={title}
      description={
        doc
          ? `${agencyName} · ${doc.fileName ?? '파일'} · ${formatDateTime(doc.createdAt)} 제출`
          : undefined
      }
    >
      <div className={s.viewer}>
        <div className={s.viewerBar}>
          <p className={s.viewerNote}>
            <Icon name="shield" size={14} />
            비공개 서류예요. 열람 기록이 남고, 저장·외부 공유는 금지돼요.
          </p>
          {file.data?.kind === 'image' && (
            <div className={s.viewerTools} role="group" aria-label="보기 도구">
              <IconButton
                label="축소"
                size={36}
                disabled={zoomIndex === 0}
                onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
              >
                <Icon name="minus" size={18} />
              </IconButton>
              <span className={s.viewerZoom} aria-live="polite">
                {Math.round(zoom * 100)}%
              </span>
              <IconButton
                label="확대"
                size={36}
                disabled={zoomIndex === VIEWER_ZOOMS.length - 1}
                onClick={() => setZoomIndex((i) => Math.min(VIEWER_ZOOMS.length - 1, i + 1))}
              >
                <Icon name="plus" size={18} />
              </IconButton>
              <IconButton
                label="90도 회전"
                size={36}
                onClick={() => setRotation((r) => (r + 90) % 360)}
              >
                <Icon name="refresh" size={18} />
              </IconButton>
            </div>
          )}
        </div>

        <div className={s.stage} ref={stageRef}>
          {file.isPending && doc && <Spinner label="서류를 불러오는 중" />}
          {file.isError && (
            <ErrorState
              compact
              title={notAllowed ? '이 서류를 볼 권한이 없어요' : '서류를 불러오지 못했어요'}
              description={
                notAllowed
                  ? '서류 열람 권한이 있는 관리자 계정으로 다시 시도해 주세요.'
                  : '파일이 삭제되었거나 일시적인 오류일 수 있어요.'
              }
              onRetry={notAllowed ? undefined : () => void file.refetch()}
            />
          )}
          {objectUrl && file.data?.kind === 'image' && (
            <div
              className={s.sheet}
              style={
                layout
                  ? { width: layout.frame.w, height: layout.frame.h }
                  : // Not measured yet: keep the natural-size image from stretching the scroll area.
                    { visibility: 'hidden', width: 0, height: 0, overflow: 'hidden' }
              }
            >
              {/* A private in-memory blob: next/image cannot (and must not) optimise or cache it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={objectUrl}
                alt={`${agencyName} ${title}`}
                width={layout?.image.w}
                height={layout?.image.h}
                style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
                draggable={false}
                onLoad={(e) =>
                  setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
                }
              />
            </div>
          )}
          {objectUrl && file.data?.kind === 'pdf' && (
            <iframe src={objectUrl} title={`${agencyName} ${title}`} />
          )}
          {file.data?.kind === 'other' && (
            // Not opened in a tab or downloaded: a non-allowed type could carry script.
            <ErrorState
              compact
              title="미리 볼 수 없는 형식이에요"
              description={`허용된 서류 형식(PDF · JPG · PNG)이 아니에요${
                file.data.type ? ` (${file.data.type})` : ''
              }. 보안을 위해 열지 않았어요. 신청자에게 PDF나 이미지로 다시 제출해 달라고 요청해 주세요.`}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
