import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { dealRequestDetailSchema, proposalSchema, type Proposal } from '../api/schemas';
import { CONTACT_SCOPE_DEFAULTS } from '../lib/form-common';
import { ConsentFields } from './form/ContactScopeFields';
import { checkPhotoFile, insertBySeq } from './form/PhotoUploader';
import { AssetTypeTiles, WizardStepper } from './form/parts';
import { focusFirstError } from './form/useWizard';
import { fastestIndex, listingsPriceRange } from './requests/CompareDialog';
import { ProposalCard } from './requests/ProposalCard';
import { revealTextOf, sortProposals } from './requests/RequestDetailView';
import {
  parseStatusFilter,
  parseTypeFilter,
  requestsHref,
  STATUS_PARAM,
} from './requests/RequestsListView';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));

const proposal = (over: Record<string, unknown>): Proposal =>
  proposalSchema.parse({
    id: 'p',
    dealRequestId: 'r',
    agencyId: 'a',
    agency: { id: 'a', name: '중개사무소', avgResponseMinutes: 12 },
    message: '제안',
    status: 'SENT',
    createdAt: '2026-11-20T00:00:00.000Z',
    ...over,
  });

describe('WizardStepper', () => {
  const steps = [{ label: '매물 정보' }, { label: '거래 조건' }, { label: '확인 · 전달' }];

  it('marks done / current steps and lets the user go back only to finished ones', async () => {
    const onSelect = vi.fn();
    render(
      <WizardStepper steps={steps} current={1} label="내놓기 진행 단계" onSelect={onSelect} />,
    );
    const list = screen.getByRole('list', { name: '내놓기 진행 단계' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).toHaveTextContent('1단계 · 완료');
    expect(items[1]).toHaveTextContent('2단계 · 작성 중');
    expect(within(list).getAllByRole('button')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: '1단계 매물 정보 수정하기' }));
    expect(onSelect).toHaveBeenCalledWith(0);
  });
});

describe('AssetTypeTiles', () => {
  it('is a labelled radio group that reports the picked asset type', async () => {
    const onChange = vi.fn();
    render(
      <>
        <span id="lbl">매물 유형</span>
        <AssetTypeTiles name="t" value="APT" onChange={onChange} labelledBy="lbl" />
      </>,
    );
    const group = screen.getByRole('radiogroup', { name: '매물 유형' });
    expect(within(group).getAllByRole('radio')).toHaveLength(6);
    expect(screen.getByRole('radio', { name: '아파트·분양권' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: '토지' }));
    expect(onChange).toHaveBeenCalledWith('LAND');
  });
});

describe('focusFirstError', () => {
  it('focuses the first invalid control, also inside an invalid group', () => {
    render(
      <form data-testid="f">
        <input aria-label="ok" />
        <div role="radiogroup" aria-invalid="true">
          <input type="radio" aria-label="first" />
        </div>
        <input aria-label="later" aria-invalid="true" />
      </form>,
    );
    Element.prototype.scrollIntoView = vi.fn();
    focusFirstError(screen.getByTestId('f'));
    expect(screen.getByLabelText('first')).toHaveFocus();
  });
});

describe('photo pre-check', () => {
  it('allows the image types of the media API up to 10MB', () => {
    expect(checkPhotoFile({ name: 'a.jpg', type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(checkPhotoFile({ name: 'a.heic', type: 'image/heic', size: 1000 })).toBeNull();
    expect(checkPhotoFile({ name: 'a.gif', type: 'image/gif', size: 1000 })).toMatch(/사진만/);
    expect(checkPhotoFile({ name: 'a.png', type: 'image/png', size: 11 * 1024 * 1024 })).toMatch(
      /10MB/,
    );
    // Windows reports no type for HEIC — fall back to the extension.
    expect(checkPhotoFile({ name: 'IMG_0001.HEIC', type: '', size: 1000 })).toBeNull();
    expect(checkPhotoFile({ name: 'notes.txt', type: '', size: 1000 })).toMatch(/사진만/);
  });

  it('keeps the selection order when uploads finish out of order', () => {
    const seq = new Map([
      ['old', -1],
      ['b', 2],
    ]);
    const seqOf = (id: string) => seq.get(id) ?? -1;
    const photo = (id: string) => ({ id, url: '', name: id });
    // living (seq 1) finishes after kitchen (seq 2): it still lands before it.
    const list = insertBySeq([photo('old'), photo('b')], photo('a'), 1, seqOf);
    expect(list.map((p) => p.id)).toEqual(['old', 'a', 'b']);
    // A photo moved to the front by "대표로" keeps its place.
    expect(insertBySeq([photo('b'), photo('old')], photo('a'), 1, seqOf).map((p) => p.id)).toEqual([
      'b',
      'old',
      'a',
    ]);
  });
});

describe('request list filters', () => {
  it('parses query values and builds canonical hrefs', () => {
    expect(parseTypeFilter('sell')).toBe('sell');
    expect(parseTypeFilter('x')).toBe('all');
    expect(parseStatusFilter('ended')).toBe('ended');
    expect(parseStatusFilter(undefined)).toBe('all');
    expect(requestsHref('all', 'all')).toBe('/me/requests');
    expect(requestsHref('find', 'open', 2)).toBe('/me/requests?type=find&status=open&page=2');
    // "종료" covers every finished status.
    expect(STATUS_PARAM.ended).toBe('CLOSED,CANCELLED,EXPIRED');
  });
});

describe('ConsentFields', () => {
  it('keeps both consents separate, unchecked, with the statutory notice inline', async () => {
    const set = vi.fn();
    render(
      <ConsentFields
        idPrefix="t"
        kind="sell"
        values={CONTACT_SCOPE_DEFAULTS}
        errors={{}}
        set={set}
        recipients="매물 근처 중개사무소 12곳"
      />,
    );
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    boxes.forEach((box) => expect(box).not.toBeChecked());
    const toggle = screen.getByRole('button', { name: '중개사무소 정보 제공 동의 내용 보기' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('제공받는 자')).toBeVisible();
    expect(screen.getByText('매물 근처 중개사무소 12곳')).toBeVisible();
    expect(screen.getAllByText('거부 시 불이익').length).toBeGreaterThan(0);
  });
});

describe('ProposalCard contact switch', () => {
  const props = {
    revealText: '김하늘 · 010-0000-1234',
    revealHint: '이름과 휴대폰 번호',
    now: '2026-11-24T00:00:00.000Z',
    onAccept: vi.fn(),
    onDecline: vi.fn(),
  };

  it('asks the parent (to confirm) instead of granting on one tap', async () => {
    const onToggleContact = vi.fn();
    render(
      <ul>
        <ProposalCard {...props} proposal={proposal({})} active onToggleContact={onToggleContact} />
      </ul>,
    );
    await userEvent.click(screen.getByRole('switch', { name: '중개사무소에 내 연락처 공개' }));
    expect(onToggleContact).toHaveBeenCalledWith(true);
  });

  it('still lets a granted contact be revoked after the request ended', () => {
    const { rerender } = render(
      <ul>
        <ProposalCard
          {...props}
          proposal={proposal({ contactGranted: true, status: 'ACCEPTED' })}
          active={false}
          onToggleContact={vi.fn()}
        />
      </ul>,
    );
    expect(screen.getByRole('switch')).toBeChecked();
    rerender(
      <ul>
        <ProposalCard
          {...props}
          proposal={proposal({ status: 'SENT' })}
          active={false}
          onToggleContact={vi.fn()}
        />
      </ul>,
    );
    expect(screen.queryByRole('switch')).toBeNull();
  });
});

describe('proposal helpers', () => {
  it('orders accepted, then waiting (newest first), then answered proposals', () => {
    const list = [
      proposal({ id: 'declined', status: 'DECLINED' }),
      proposal({ id: 'old', status: 'VIEWED', createdAt: '2026-11-18T00:00:00.000Z' }),
      proposal({ id: 'accepted', status: 'ACCEPTED' }),
      proposal({ id: 'new', status: 'SENT', createdAt: '2026-11-22T00:00:00.000Z' }),
    ];
    expect(sortProposals(list).map((p) => p.id)).toEqual(['accepted', 'new', 'old', 'declined']);
  });

  it('finds the fastest agency and the price range of suggested listings', () => {
    const a = proposal({ agency: { id: 'a', name: 'A', avgResponseMinutes: 12 } });
    const b = proposal({ agency: { id: 'b', name: 'B', avgResponseMinutes: 8 } });
    const c = proposal({ agency: { id: 'c', name: 'C' } });
    expect(fastestIndex([a, b, c])).toBe(1);
    expect(fastestIndex([c])).toBe(-1);
    const listing = (id: string, price: number) => ({
      id,
      title: id,
      assetType: 'APT',
      dealType: 'SALE',
      price,
    });
    expect(
      listingsPriceRange(proposal({ listings: [listing('1', 46000), listing('2', 44500)] })),
    ).toBe('4억 4,500 ~ 4억 6,000');
    expect(listingsPriceRange(a)).toBe('');
  });

  it('describes exactly what a contact grant reveals', () => {
    const request = dealRequestDetailSchema.parse({
      id: 'r',
      type: 'SELL_OR_LEASE',
      status: 'OPEN',
      assetType: 'APT',
      dealTypes: ['SALE'],
      visibility: 'ALL_AGENCIES_IN_REGION',
      contactName: '김하늘',
      contactPhone: '01000001234',
      addressDetail: '103동 1502호',
      createdAt: '2026-11-19T06:42:00.000Z',
      updatedAt: '2026-11-19T06:42:00.000Z',
    });
    expect(revealTextOf(request)).toBe('김하늘 · 010-0000-1234 · 103동 1502호');
  });
});
