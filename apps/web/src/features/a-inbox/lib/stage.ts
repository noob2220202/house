import { DealRequestStatus, ProposalStatus } from '@house/shared';
import type { StatusTone } from '@house/ui';
import type { AgencyDealRequest, InboxStage } from '../api/schemas';

type StageInput = Pick<AgencyDealRequest, 'status' | 'myProposal' | 'contactGranted'>;

/** The request still takes proposals / answers. */
export function isRequestActive(status: DealRequestStatus): boolean {
  return status === DealRequestStatus.OPEN || status === DealRequestStatus.MATCHED;
}

/**
 * Where a request sits in the agency's inbox:
 * - `NEW` — active and we have not proposed yet
 * - `PROPOSED` — our proposal is waiting for the requester (SENT / VIEWED)
 * - `ACCEPTED` — the requester accepted us or opened their contact to us
 * - `ENDED` — the request is over, or our proposal was declined / withdrawn
 */
export function inboxStage(r: StageInput): InboxStage {
  if (!isRequestActive(r.status)) return 'ENDED';
  const proposal = r.myProposal?.status;
  if (proposal === ProposalStatus.DECLINED || proposal === ProposalStatus.WITHDRAWN) return 'ENDED';
  if (proposal === ProposalStatus.ACCEPTED || r.contactGranted) return 'ACCEPTED';
  if (proposal) return 'PROPOSED';
  return 'NEW';
}

/** We may still send a proposal: the request is active and we never proposed (one per agency). */
export function canPropose(r: StageInput): boolean {
  return isRequestActive(r.status) && !r.myProposal;
}

/** Our proposal can be taken back while the requester has not answered it. */
export function canWithdraw(r: StageInput): boolean {
  const proposal = r.myProposal?.status;
  return (
    isRequestActive(r.status) &&
    (proposal === ProposalStatus.SENT || proposal === ProposalStatus.VIEWED)
  );
}

export const STAGE_LABEL: Record<InboxStage, string> = {
  NEW: '새 요청',
  PROPOSED: '응답 대기',
  ACCEPTED: '수락됨',
  ENDED: '종료',
};

export interface StagePill {
  label: string;
  tone: StatusTone;
}

const ENDED_REQUEST_LABEL: Partial<Record<DealRequestStatus, string>> = {
  CLOSED: '요청 종료',
  CANCELLED: '요청 취소',
  EXPIRED: '기간 만료',
};

/** Status pill of a row / the detail header — the most specific thing we know. */
export function stagePill(r: StageInput): StagePill {
  const proposal = r.myProposal?.status;
  if (!isRequestActive(r.status)) {
    return { label: ENDED_REQUEST_LABEL[r.status] ?? '종료', tone: 'ended' };
  }
  if (proposal === ProposalStatus.DECLINED) return { label: '거절됨', tone: 'rejected' };
  if (proposal === ProposalStatus.WITHDRAWN) return { label: '제안 철회', tone: 'ended' };
  if (r.contactGranted) return { label: '연락처 공개', tone: 'live' };
  if (proposal === ProposalStatus.ACCEPTED) return { label: '제안 수락', tone: 'live' };
  if (proposal === ProposalStatus.VIEWED) return { label: '요청자 확인', tone: 'scheduled' };
  if (proposal === ProposalStatus.SENT) return { label: '제안 보냄', tone: 'scheduled' };
  return { label: '제안 전', tone: 'review' };
}

export interface TimelineStep {
  key: 'sent' | 'viewed' | 'answered' | 'contact';
  label: string;
  /** ISO time when the step happened; null = not yet. */
  at: string | null;
  state: 'done' | 'pending' | 'off';
}

/** Progress of our proposal: 보냄 → 요청자 확인 → 수락/거절 → 연락처 공개. */
export function proposalTimeline(r: StageInput, contactGrantedAt?: string | null): TimelineStep[] {
  const p = r.myProposal;
  if (!p) return [];
  const declined = p.status === ProposalStatus.DECLINED;
  const withdrawn = p.status === ProposalStatus.WITHDRAWN;
  const accepted = p.status === ProposalStatus.ACCEPTED;
  const viewed = !!p.viewedAt || p.status === ProposalStatus.VIEWED || accepted || declined;
  const steps: TimelineStep[] = [
    { key: 'sent', label: '제안 보냄', at: p.createdAt, state: 'done' },
    {
      key: 'viewed',
      label: '요청자 확인',
      at: p.viewedAt ?? null,
      state: viewed ? 'done' : withdrawn ? 'off' : 'pending',
    },
    {
      key: 'answered',
      label: declined ? '제안 거절' : withdrawn ? '제안 철회' : '제안 수락',
      at: p.respondedAt ?? null,
      state: accepted ? 'done' : declined || withdrawn ? 'off' : 'pending',
    },
  ];
  if (!declined && !withdrawn) {
    steps.push({
      key: 'contact',
      label: '연락처 공개',
      at: contactGrantedAt ?? null,
      state: r.contactGranted ? 'done' : 'pending',
    });
  }
  return steps;
}
