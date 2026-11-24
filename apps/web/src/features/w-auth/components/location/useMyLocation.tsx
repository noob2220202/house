'use client';
import { TermsType } from '@house/shared';
import { Button, Callout, ErrorState, Modal, SkeletonText, useToast } from '@house/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ApiError, errorMessage } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { coarsenPosition, type LatLng } from '@/lib/map';
import { authKeys, fetchConsents, fetchTermsDocument, submitConsents } from '../../api';
import signup from '../signup/signup.module.css';
import styles from './location.module.css';

/** What "내 위치" hands to the map after the 위치기반서비스 consent. */
export interface DevicePosition {
  /**
   * Centre of the coarse grid cell holding the device (lib/map `coarsenPosition`): the only value
   * that may move the map, so the URL and API requests never carry the device position.
   */
  coarse: LatLng;
  /**
   * Exact position for the on-screen "me" dot — members who agreed to the 위치기반서비스 약관 only
   * (null for visitors). Client-side only: never put it in the URL, state that is serialized or a
   * request.
   */
  precise: LatLng | null;
}

type Mode = 'member' | 'guest';

/**
 * A visitor (not logged in) agreed in this page session. Kept in memory only: nothing is recorded
 * for visitors, so they are asked again after a reload.
 */
let guestAgreed = false;

/** Test hook: forget the visitor's in-memory agreement. */
export function resetGuestLocationConsent(): void {
  guestAgreed = false;
}

const GEO_OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 };

/**
 * "내 위치" behind the 위치기반서비스 이용약관 (LOCATION, optional): the device position is read
 * only after the user agreed to the current LOCATION document.
 *  - Members: their LOCATION consent (GET /me/consents); without it, the document is shown and
 *    "동의" records it (POST /me/consents) before the position is read.
 *  - Visitors: the document is shown each page session; nothing is recorded and only the coarse
 *    cell is used (no "me" dot).
 * Render `dialog` once in the page.
 */
export function useMyLocation(): {
  locate: (onLocated: (position: DevicePosition) => void) => void;
  locating: boolean;
  dialog: ReactNode;
} {
  const session = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode | null>(null);
  const [locating, setLocating] = useState(false);
  const pending = useRef<((position: DevicePosition) => void) | null>(null);

  const readPosition = useCallback(
    (member: boolean) => {
      const onLocated = pending.current;
      pending.current = null;
      if (!onLocated) return;
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocating(false);
          const precise = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          onLocated({ coarse: coarsenPosition(precise), precise: member ? precise : null });
        },
        (error) => {
          setLocating(false);
          toast({
            message:
              error.code === error.PERMISSION_DENIED
                ? '위치 권한이 꺼져 있어요. 브라우저 설정에서 위치 접근을 허용해 주세요.'
                : '내 위치를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
            tone: 'error',
          });
        },
        GEO_OPTIONS,
      );
    },
    [toast],
  );

  const locate = useCallback(
    (onLocated: (position: DevicePosition) => void) => {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        toast({ message: '이 브라우저에서는 내 위치를 사용할 수 없어요.', tone: 'error' });
        return;
      }
      pending.current = onLocated;
      if (session.status !== 'authenticated') {
        if (guestAgreed) readPosition(false);
        else setMode('guest');
        return;
      }
      setLocating(true);
      queryClient
        .fetchQuery({
          queryKey: authKeys.consents(),
          queryFn: ({ signal }) => fetchConsents(signal),
          staleTime: 30_000,
        })
        .then((records) => {
          setLocating(false);
          const record = records.find((r) => r.type === TermsType.LOCATION);
          if (record?.agreed) readPosition(true);
          else setMode('member');
        })
        .catch((error: unknown) => {
          setLocating(false);
          pending.current = null;
          toast({ message: errorMessage(error), tone: 'error' });
        });
    },
    [session.status, queryClient, readPosition, toast],
  );

  const close = () => {
    pending.current = null;
    setMode(null);
  };

  const agreed = (member: boolean) => {
    setMode(null);
    if (!member) guestAgreed = true;
    readPosition(member);
  };

  const dialog = (
    <LocationConsentDialog
      mode={mode}
      onClose={close}
      onAgreed={agreed}
      onRecorded={(records) => queryClient.setQueryData(authKeys.consents(), records)}
    />
  );
  return { locate, locating, dialog };
}

function LocationConsentDialog({
  mode,
  onClose,
  onAgreed,
  onRecorded,
}: {
  mode: Mode | null;
  onClose: () => void;
  onAgreed: (member: boolean) => void;
  onRecorded: (records: Awaited<ReturnType<typeof submitConsents>>) => void;
}) {
  const open = mode !== null;
  const doc = useQuery({
    queryKey: authKeys.termsDocument(TermsType.LOCATION),
    queryFn: ({ signal }) => fetchTermsDocument(TermsType.LOCATION, signal),
    enabled: open,
    staleTime: 5 * 60_000,
    retry: (count, error) => !(error instanceof ApiError && error.isNotFound) && count < 2,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unpublished = doc.error instanceof ApiError && doc.error.isNotFound;

  const close = () => {
    if (saving) return;
    setError(null);
    onClose();
  };

  const agree = async () => {
    if (!doc.data) return;
    if (mode === 'guest') {
      onAgreed(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // The id of the document shown above: the record names exactly the text the member read.
      const records = await submitConsents({
        consents: [{ termsDocumentId: doc.data.id, agreed: true }],
      });
      onRecorded(records);
      onAgreed(true);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'AUTH_TERMS_INVALID') {
        setError('약관이 방금 바뀌었어요. 바뀐 내용을 확인하고 다시 동의해 주세요.');
        void doc.refetch();
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="md"
      title="위치기반서비스 이용약관"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            취소
          </Button>
          <Button
            onClick={() => void agree()}
            loading={saving}
            disabled={!doc.data?.content || unpublished}
          >
            동의하고 내 위치 보기
          </Button>
        </>
      }
    >
      <p className={styles.intro}>
        내 위치로 지도를 옮기려면 위치기반서비스 이용약관(선택)에 동의해 주세요. 위치는 이
        기기에서만 쓰고, 지도는 약 500m 단위로 어림한 위치로 옮겨요. 서버와 주소창에는 그 어림한
        지도 범위만 전달돼요. 동의하지 않아도 지도를 직접 움직여 모든 매물을 볼 수 있어요.
      </p>
      {mode === 'guest' && (
        <p className={styles.note}>
          로그인하지 않은 상태에서는 동의 기록을 남기지 않아요. 이 화면을 새로 열면 다시 물어봐요.
        </p>
      )}
      {doc.isPending ? (
        <div className={signup.termsBody} aria-busy="true">
          <SkeletonText lines={6} />
        </div>
      ) : unpublished ? (
        <Callout tone="warn" size="sm">
          위치기반서비스 약관이 아직 게시되지 않아 내 위치를 사용할 수 없어요.
        </Callout>
      ) : doc.isError || !doc.data.content ? (
        <ErrorState
          compact
          title="약관을 불러오지 못했어요"
          description={doc.isError ? errorMessage(doc.error) : undefined}
          onRetry={() => void doc.refetch()}
        />
      ) : (
        <>
          <p className={signup.termsMeta}>
            <span>선택 동의</span>
            <span aria-hidden="true">·</span>
            <span className="num">버전 {doc.data.version}</span>
            <span aria-hidden="true">·</span>
            <span className="num">시행일 {formatDate(doc.data.effectiveAt)}</span>
          </p>
          {/* Plain text from the admin, line breaks preserved; rendered as text (never as HTML). */}
          <div className={signup.termsBody} tabIndex={0} role="document" aria-label="약관 전문">
            {doc.data.content}
          </div>
        </>
      )}
      {error && (
        <Callout tone="danger" size="sm" live className={styles.error}>
          {error}
        </Callout>
      )}
    </Modal>
  );
}
