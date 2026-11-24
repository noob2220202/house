import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OFFICE_LISTINGS } from '@/app/mock-api/v1/agency/deal-requests/_listings';
import { seedInboxRequests } from '@/app/mock-api/v1/agency/deal-requests/_seed';
import {
  agencyRequestDetailDto,
  agencyRequestDto,
  maskName,
  MY_AGENCY_ID,
  stageOf,
} from '@/app/mock-api/v1/agency/deal-requests/_store';
import type { Notification } from '@/features/w-me/schemas';
import {
  agencyDealRequestDetailSchema,
  agencyDealRequestPageSchema,
  agencyDealRequestSchema,
  inboxListingSchema,
  type AgencyDealRequestDetail,
} from './api/schemas';
import { wantedPlaces } from './lib/request-text';
import { AgentNotificationRow } from './notifications/AgentNotificationsView';
import { ContactCard, lockedHint } from './requests/ContactCard';
import { MatchNote } from './requests/ListingPicker';
import { MyProposalCard } from './requests/MyProposalCard';
import { RequestRow, deadlineOf } from './requests/RequestRow';
import { RequestSummary } from './requests/RequestSummary';

vi.mock('@house/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@house/ui')>()),
  useToast: () => ({ toast: vi.fn(), dismiss: vi.fn() }),
}));

const seeds = seedInboxRequests();
const seed = (id: string) => {
  const found = seeds.find((r) => r.id === id);
  if (!found) throw new Error(`missing seed ${id}`);
  return found;
};
const detail = (id: string): AgencyDealRequestDetail =>
  agencyDealRequestDetailSchema.parse(agencyRequestDetailDto(seed(id)));

/** The mock fixtures are the contract examples — they must satisfy the response schemas. */
describe('a-inbox schemas ↔ mock fixtures', () => {
  it('parses every seeded request (list and detail shape)', () => {
    for (const r of seeds) {
      expect(agencyDealRequestSchema.safeParse(agencyRequestDto(r)).success, r.id).toBe(true);
      expect(agencyDealRequestDetailSchema.safeParse(agencyRequestDetailDto(r)).success, r.id).toBe(
        true,
      );
    }
  });

  it('never leaks contact data or the private address before consent', () => {
    for (const r of seeds) {
      const dto = agencyRequestDetailDto(r);
      const json = JSON.stringify(dto);
      if (dto.contact) continue;
      expect(json, r.id).not.toContain(r.contactPhone);
      expect(json, r.id).not.toContain(r.contactName);
      if (r.addressDetail) expect(json, r.id).not.toContain(r.addressDetail);
      if (r.roadAddress) expect(json, r.id).not.toContain(r.roadAddress);
    }
    // The list shape never carries a contact, granted or not.
    expect(JSON.stringify(agencyRequestDto(seed('req-06')))).not.toContain('01000003476');
    expect(maskName('김하늘')).toBe('김*늘');
    expect(maskName('이준')).toBe('이*');
    expect(maskName('남궁민수')).toBe('남**수');
  });

  it('seeds every inbox stage (3 new requests, like the dashboard badge)', () => {
    const counts = { NEW: 0, PROPOSED: 0, ACCEPTED: 0, ENDED: 0 };
    for (const r of seeds) counts[stageOf(r)] += 1;
    expect(counts).toEqual({ NEW: 3, PROPOSED: 2, ACCEPTED: 2, ENDED: 4 });
  });

  it('parses the office listings', () => {
    for (const l of OFFICE_LISTINGS)
      expect(inboxListingSchema.safeParse(l).success, l.title).toBe(true);
  });
});

describe('<RequestRow>', () => {
  const now = new Date();

  it('links to the detail page and shows type, price and stage', () => {
    render(
      <ul>
        <RequestRow request={detail('req-01')} now={now} />
      </ul>,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/agent/requests/req-01');
    expect(link).toHaveTextContent('내놓기');
    expect(link).toHaveTextContent('신대 레이크파크 1단지 · 매매');
    expect(link).toHaveTextContent('희망 매매가');
    expect(link).toHaveTextContent('4억 5,000');
    // No requester name before consent (the API sends none in the list).
    expect(link).not.toHaveTextContent('님');
    expect(link).toHaveTextContent('제안 전');
    expect(link).toHaveTextContent('다른 사무소 제안 1곳');
    expect(link).not.toHaveTextContent('1803호');
  });

  it('marks requests that picked this office and counts only other offices', () => {
    render(
      <ul>
        <RequestRow request={detail('req-03')} now={now} />
        <RequestRow request={detail('req-05')} now={now} />
      </ul>,
    );
    const [targeted, proposed] = screen.getAllByRole('link');
    expect(targeted).toHaveTextContent('지정 요청');
    expect(proposed).toHaveTextContent('제안 보냄');
    expect(proposed).toHaveTextContent('보증금/월세');
    expect(proposed).toHaveTextContent('1,000/60 이하');
    expect(proposed).toHaveTextContent('아직 다른 제안 없음');
  });

  it('computes the deadline only for active requests', () => {
    const at = new Date('2026-11-23T03:00:00Z');
    expect(deadlineOf({ status: 'OPEN', expiresAt: '2026-11-25T03:00:00Z' }, at)).toEqual({
      label: 'D-2',
      hot: true,
    });
    expect(deadlineOf({ status: 'OPEN', expiresAt: '2026-12-20T03:00:00Z' }, at)?.hot).toBe(false);
    expect(deadlineOf({ status: 'EXPIRED', expiresAt: '2026-11-20T03:00:00Z' }, at)).toBeNull();
    expect(deadlineOf({ status: 'OPEN', expiresAt: null }, at)).toBeNull();
  });
});

describe('<ContactCard>', () => {
  it('shows no name or number while the contact is not granted', () => {
    render(<ContactCard request={detail('req-01')} />);
    expect(screen.getByText('요청자 · 연락처 비공개')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('이*훈');
    expect(screen.getByText(/제안을 보내면/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('010');
  });

  it('shows name, phone actions and the private address once granted', () => {
    render(<ContactCard request={detail('req-06')} />);
    expect(screen.getByText('윤가람 님')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '010-0000-3476' })).toHaveAttribute(
      'href',
      'tel:01000003476',
    );
    expect(screen.getByRole('link', { name: '전화 걸기' })).toHaveAttribute(
      'href',
      'tel:01000003476',
    );
    expect(screen.getByRole('link', { name: '문자' })).toHaveAttribute('href', 'sms:01000003476');
    expect(screen.getByRole('button', { name: '번호 복사' })).toBeInTheDocument();
    expect(screen.getByText('전남 순천시 해룡면 선월로 55 205동 904호')).toBeInTheDocument();
  });

  it('explains what unlocks the contact in each state', () => {
    expect(lockedHint(detail('req-04'))).toMatch(/검토하고 있어요/);
    expect(lockedHint(detail('req-08'))).toMatch(/공개되지 않았어요/);
    expect(lockedHint(detail('req-09'))).toMatch(/종료된 요청/);
  });
});

describe('<RequestSummary>', () => {
  it('renders a 내놓기 request before a grant reduced: flags and area band, no own words or address', () => {
    render(<RequestSummary request={detail('req-01')} />);
    expect(screen.getByText('희망 매매가')).toBeInTheDocument();
    expect(screen.getByText('4억 5,000')).toBeInTheDocument();
    expect(screen.getByText('가격 협의 가능')).toBeInTheDocument();
    expect(screen.getByText('전용면적 구간')).toBeInTheDocument();
    expect(screen.queryByText(/도배·장판을 새로 했습니다/)).toBeNull();
    expect(
      screen.getByText(/도로명 주소·동·호수·층·정확한 면적·사진·요청자가 쓴 설명은/),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('신대2로');
  });

  it('renders the full 내놓기 details once the requester shared them with this office', () => {
    const granted = { ...seed('req-01'), grants: { [MY_AGENCY_ID]: '2026-11-20T00:00:00.000Z' } };
    render(
      <RequestSummary
        request={agencyDealRequestDetailSchema.parse(agencyRequestDetailDto(granted))}
      />,
    );
    expect(screen.getByText(/도배·장판을 새로 했습니다/)).toBeInTheDocument();
    expect(screen.getByText('전용면적')).toBeInTheDocument();
    expect(screen.queryByText(/요청자가 쓴 설명은/)).toBeNull();
  });

  it('parses the backend shape: complex, photo views, granted road address, detailsShared', () => {
    const wire = {
      id: 'r1',
      type: 'SELL_OR_LEASE',
      status: 'OPEN',
      assetType: 'APT',
      dealTypes: ['SALE'],
      visibility: 'ALL_AGENCIES_IN_REGION',
      emdCode: '1215010100',
      roadAddress: null,
      complex: { id: 'c1', name: '신대 레이크파크' },
      lat: 34.951,
      lng: 127.487,
      exclusiveArea: null,
      areaRange: { min: 60, max: 85 },
      floor: null,
      description: '· 가격 협의 가능',
      photos: [],
      photoCount: 2,
      desiredSalePrice: 45000,
      regionCodes: [],
      complexIds: [],
      proposalCount: 0,
      createdAt: '2026-11-20T00:00:00.000Z',
      targeted: false,
      myProposal: null,
      contact: null,
      detailsShared: false,
    };
    const before = agencyDealRequestDetailSchema.parse(wire);
    expect(before).toMatchObject({
      complexId: 'c1',
      complexName: '신대 레이크파크',
      contactGranted: false,
    });
    render(<RequestSummary request={before} />);
    expect(screen.getByText('첨부 사진 2장')).toBeInTheDocument();
    expect(screen.getByText('60~85㎡')).toBeInTheDocument();
    const after = agencyDealRequestDetailSchema.parse({
      ...wire,
      roadAddress: '전남광주통합특별시 순천시 중앙로 1',
      exclusiveArea: 84.97,
      photos: [{ mediaId: 'm1', url: '/m/large.webp', thumbUrl: '/m/thumb.webp' }],
      contact: { name: '홍길동', phone: '01012345678', addressDetail: '101동 1001호' },
      detailsShared: true,
    });
    expect(after.contactGranted).toBe(true);
    expect(after.contact?.roadAddress).toBe('전남광주통합특별시 순천시 중앙로 1');
    expect(after.photos[0]?.variants.thumb?.url).toBe('/m/thumb.webp');
  });

  it('parses a real list page: no requester name, 단지 names or stage counters', () => {
    const wanted = {
      id: 'r2',
      type: 'WANTED',
      status: 'OPEN',
      assetType: 'APT',
      dealTypes: ['SALE'],
      visibility: 'ALL_AGENCIES_IN_REGION',
      sggCode: '12150',
      emdCode: null,
      roadAddress: null,
      complex: null,
      lat: null,
      lng: null,
      regionCodes: ['12150132'],
      complexIds: ['c1', 'c2'],
      priceMax: 43000,
      photos: [],
      photoCount: 0,
      proposalCount: 1,
      createdAt: '2026-11-20T00:00:00.000Z',
      targeted: false,
      myProposal: { id: 'p1', status: 'SENT', createdAt: '2026-11-21T00:00:00.000Z' },
      contact: null,
      detailsShared: false,
      areaRange: null,
    };
    const page = agencyDealRequestPageSchema.parse({
      items: [wanted],
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
    const [item] = page.items;
    expect(item).toBeDefined();
    expect(item).not.toHaveProperty('requesterName');
    expect(item).not.toHaveProperty('complexNames');
    expect(page).not.toHaveProperty('stageCounts');
    expect(item?.myProposal).toMatchObject({ id: 'p1', status: 'SENT', message: '', listings: [] });
    expect(wantedPlaces(item!)).toEqual([expect.any(String), '선택한 단지 2곳']);
    render(
      <ul>
        <RequestRow request={item!} now={new Date('2026-11-22T00:00:00Z')} />
      </ul>,
    );
    expect(screen.getByRole('link')).toHaveTextContent('제안 보냄');
  });

  it('renders the wanted regions, complexes and conditions of a 구하기 request', () => {
    render(<RequestSummary request={detail('req-03')} />);
    expect(screen.getByText('매매 예산')).toBeInTheDocument();
    expect(screen.getByText('4억 3,000 이하')).toBeInTheDocument();
    expect(screen.getByText('선월지구')).toBeInTheDocument();
    // Wanted 단지 arrive as ids only: counted, not named.
    expect(screen.getByText('선택한 단지 1곳')).toBeInTheDocument();
    expect(screen.getByText('요청자가 고른 중개사무소')).toBeInTheDocument();
  });
});

describe('<MyProposalCard>', () => {
  it('shows the suggested price, message, progress and lets a pending proposal be withdrawn', async () => {
    const onWithdraw = vi.fn();
    render(<MyProposalCard request={detail('req-04')} onWithdraw={onWithdraw} />);
    expect(screen.getByText('예상 전세가 2억 8,500')).toBeInTheDocument();
    expect(screen.getByText(/3단지 39평 전세는 이번 달에만 2건/)).toBeInTheDocument();
    const steps = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(steps[0]).toContain('제안 보냄');
    expect(steps[2]).toContain('제안 수락 (대기 중)');
    await userEvent.click(screen.getByRole('button', { name: '제안 철회' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('다시 제안할 수 없어요');
    await userEvent.click(screen.getByRole('button', { name: '철회하기' }));
    expect(onWithdraw).toHaveBeenCalledTimes(1);
  });

  it('lists attached listings and hides 철회 once the requester answered', () => {
    render(<MyProposalCard request={detail('req-08')} onWithdraw={vi.fn()} />);
    expect(screen.getByText('요청자가 이 제안을 거절했어요')).toBeInTheDocument();
    expect(screen.getByText('첨부한 매물 1건')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /신대리 2층 단독주택/ })).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(screen.queryByRole('button', { name: '제안 철회' })).not.toBeInTheDocument();
  });
});

describe('<MatchNote>', () => {
  it('says 조건 일치, names up to two misses, otherwise what fits', () => {
    const { rerender } = render(
      <MatchNote match={{ full: true, score: 4, reasons: ['지역'], misses: [] }} />,
    );
    expect(screen.getByText('조건 일치')).toBeInTheDocument();
    rerender(<MatchNote match={{ full: false, score: 3, reasons: ['지역'], misses: ['예산'] }} />);
    expect(screen.getByText('예산 조건이 달라요')).toBeInTheDocument();
    rerender(
      <MatchNote
        match={{ full: false, score: 1, reasons: ['지역'], misses: ['예산', '면적', '방 수'] }}
      />,
    );
    expect(screen.getByText('지역만 일치')).toBeInTheDocument();
  });
});

describe('<AgentNotificationRow>', () => {
  const notification = (over: Partial<Notification>): Notification => ({
    id: 'n1',
    type: 'DEAL_REQUEST_RECEIVED',
    title: '새 내놓기 요청이 도착했어요',
    body: '신대 레이크파크 1단지 · 매매',
    data: { agencyId: 'a1', dealRequestId: 'req-01' },
    readAt: null,
    createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    ...over,
  });

  it('opens the console page of an agency event and marks it read', async () => {
    const onRead = vi.fn();
    render(<AgentNotificationRow notification={notification({})} onRead={onRead} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/agent/requests/req-01');
    expect(link).toHaveTextContent('읽지 않음');
    link.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(link);
    expect(onRead).toHaveBeenCalledWith('n1');
  });

  it('renders a read notification without a destination as plain text', () => {
    render(
      <AgentNotificationRow
        notification={notification({
          type: 'REPORT_RESOLVED',
          data: null,
          readAt: '2026-11-23T03:00:00Z',
        })}
        onRead={vi.fn()}
      />,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
