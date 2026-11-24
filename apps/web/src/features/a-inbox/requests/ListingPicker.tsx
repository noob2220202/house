'use client';
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  LoadingRegion,
  Modal,
  Skeleton,
  cx,
} from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/lib/api';
import { fetchListingCandidates, inboxKeys } from '../api/queries';
import type { AgencyDealRequest, InboxListing } from '../api/schemas';
import { rankListings, type ListingMatch } from '../lib/match';
import { PROPOSAL_LISTINGS_MAX } from '../lib/proposal';
import { ListingMini } from '../ui/ListingMini';
import styles from './Requests.module.css';
import { formatCount } from '@/lib/format';

/** "조건 일치" when everything the request states is met, otherwise what differs / what fits. */
export function MatchNote({ match }: { match: ListingMatch }) {
  if (match.full)
    return (
      <span className={styles.matchFull}>
        <Icon name="check-circle" size={14} />
        조건 일치
      </span>
    );
  // Few misses → name them; otherwise say what does fit.
  if (match.misses.length > 0 && match.misses.length <= 2)
    return <span className={styles.matchPart}>{match.misses.join(' · ')} 조건이 달라요</span>;
  if (match.reasons.length === 0) return null;
  return <span className={styles.matchPart}>{match.reasons.join(' · ')}만 일치</span>;
}

export interface ListingPickerProps {
  open: boolean;
  onClose: () => void;
  request: AgencyDealRequest;
  selected: readonly InboxListing[];
  onApply: (listings: InboxListing[]) => void;
}

/**
 * Picks up to 10 of the office's ACTIVE listings for a proposal. Listings are ranked by how well
 * they fit the request; the selection survives searching.
 */
export function ListingPicker({ open, onClose, request, selected, onApply }: ListingPickerProps) {
  const [draft, setDraft] = useState<InboxListing[]>(() => [...selected]);
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');

  // Start every session from the applied selection (state adjusted while rendering the opening).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft([...selected]);
      setInput('');
      setQ('');
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setQ(input.trim()), 250);
    return () => clearTimeout(timer);
  }, [input]);

  const query = useQuery({
    queryKey: inboxKeys.candidates(request.id, q),
    queryFn: ({ signal }) => fetchListingCandidates(request.id, q, signal),
    enabled: open,
    staleTime: 60_000,
  });
  const ranked = useMemo(
    () => rankListings(request, query.data?.items ?? []),
    [request, query.data],
  );
  const full = draft.length >= PROPOSAL_LISTINGS_MAX;
  const toggle = (listing: InboxListing, on: boolean) =>
    setDraft((prev) =>
      on
        ? prev.some((l) => l.id === listing.id) || prev.length >= PROPOSAL_LISTINGS_MAX
          ? prev
          : [...prev, listing]
        : prev.filter((l) => l.id !== listing.id),
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="첨부할 매물 고르기"
      description="우리 사무소의 광고중 매물이에요. 요청 조건에 잘 맞는 순서로 보여 드려요."
      footer={
        <div className={styles.pickerFoot}>
          <span className={styles.pickerCount} aria-live="polite">
            선택 <b>{draft.length}</b> / {PROPOSAL_LISTINGS_MAX}
          </span>
          <Button
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            {draft.length > 0 ? `${draft.length}건 첨부` : '첨부 없이 닫기'}
          </Button>
        </div>
      }
    >
      <div className={styles.picker}>
        <Input
          aria-label="매물 이름 검색"
          type="search"
          placeholder="단지·건물 이름으로 검색"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          prefix={<Icon name="search" size={18} />}
          autoComplete="off"
        />
        {query.isPending ? (
          <LoadingRegion label="매물을 불러오는 중" className={styles.pickerList}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height={74} radius={12} />
            ))}
          </LoadingRegion>
        ) : query.isError ? (
          <ErrorState
            compact
            title="매물을 불러오지 못했어요"
            description={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : ranked.length === 0 ? (
          <EmptyState
            compact
            icon="building"
            title={q ? `‘${q}’에 맞는 매물이 없어요` : '광고중인 매물이 없어요'}
            description={
              q
                ? '다른 이름으로 검색해 보세요.'
                : '매물을 등록하고 광고를 시작하면 제안에 첨부할 수 있어요.'
            }
          />
        ) : (
          <>
            <ul className={styles.pickerList}>
              {ranked.map(({ listing, match }) => {
                const on = draft.some((l) => l.id === listing.id);
                const disabled = !on && full;
                return (
                  <li key={listing.id}>
                    <label
                      className={cx(
                        styles.pick,
                        on && styles.pickOn,
                        disabled && styles.pickDisabled,
                      )}
                    >
                      <input
                        type="checkbox"
                        className={styles.pickBox}
                        checked={on}
                        disabled={disabled}
                        onChange={(e) => toggle(listing, e.target.checked)}
                      />
                      <ListingMini listing={listing} note={<MatchNote match={match} />} />
                    </label>
                  </li>
                );
              })}
            </ul>
            {/* The picker loads one page: say so instead of silently hiding the rest. */}
            {query.data && query.data.total > query.data.items.length && (
              <p className={styles.pickerMore}>
                광고중 매물 {formatCount(query.data.total)}건 중 {query.data.items.length}건만 보여
                드려요. 다른 매물은 이름으로 검색해 주세요.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
