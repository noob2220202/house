import {
  AssetType,
  DealType,
  Direction,
  DirectionBasis,
  ListingStatus,
  MoveInType,
  VerificationMethod,
  MaintenanceFeeBillingType,
  MaintenanceFeeKind,
} from '@house/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import type { VerificationInput } from './api/queries';
import type { AgencyListingItem } from './api/schemas';
import { FORM_DEFAULTS, type ListingFormValues } from './lib/form';
import { StatusDialog, VerifyDialog } from './list/dialogs';
import { RowMenu } from './list/RowMenu';
import { Checklist } from './wizard/Checklist';
import { WizardContext, type WizardContextValue } from './wizard/context';
import { StepDeal } from './wizard/StepDeal';
import { StepDetail } from './wizard/StepDetail';

const row = (patch: Partial<AgencyListingItem> = {}): AgencyListingItem => ({
  id: 'l1',
  status: ListingStatus.ACTIVE,
  dealType: DealType.SALE,
  assetType: AssetType.APT,
  name: '신대 레이크파크 1단지',
  dong: '103동',
  salePrice: 44500,
  photoCount: 8,
  viewCount: 0,
  favoriteCount: 0,
  inquiryCount: 0,
  agencyCount: 1,
  isPrimary: true,
  ...patch,
});

/** Any status-transition action of the row menu. */
const STATUS_ACTIONS = /계약중으로 변경|거래완료 처리|숨기기|다시 광고하기/;

async function openMenu(item: AgencyListingItem, isOwner = true) {
  const onAction = vi.fn();
  const user = userEvent.setup();
  render(<RowMenu row={item} isOwner={isOwner} onAction={onAction} />);
  await user.click(screen.getByRole('button', { name: /더보기 메뉴/ }));
  return { onAction, user };
}

describe('RowMenu', () => {
  it('offers the transitions of an ACTIVE listing and reports the chosen one', async () => {
    const { onAction, user } = await openMenu(row());
    expect(screen.getByRole('link', { name: /공개 페이지 보기/ })).toHaveAttribute(
      'href',
      '/listing/l1',
    );
    expect(screen.getByRole('button', { name: '거래완료 처리' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '숨기기' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '계약중으로 변경' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'status', to: ListingStatus.RESERVED });
  });

  it('a draft links to the publish step and can only be deleted', async () => {
    const { onAction, user } = await openMenu(row({ status: ListingStatus.DRAFT }));
    expect(screen.getByRole('link', { name: /미리보기·게시/ })).toHaveAttribute(
      'href',
      '/agent/listings/l1/edit?step=preview',
    );
    expect(screen.queryByRole('link', { name: /공개 페이지 보기/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: STATUS_ACTIONS })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '작성중인 매물 삭제' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'delete' });
  });

  it('a closed listing has no status change, no 실매물 확인 and no photo management', async () => {
    await openMenu(row({ status: ListingStatus.CLOSED }));
    expect(screen.queryByRole('button', { name: STATUS_ACTIONS })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /실매물 확인 기록/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /사진 관리/ })).not.toBeInTheDocument();
  });

  it('explains why an operator-hidden listing cannot be re-opened', async () => {
    await openMenu(row({ status: ListingStatus.HIDDEN, hiddenReason: '허위매물 신고 접수' }));
    expect(screen.queryByRole('button', { name: '다시 광고하기' })).not.toBeInTheDocument();
    expect(screen.getByText(/허위매물 신고 접수/)).toBeInTheDocument();
  });

  it('co-brokered listing: the owner may leave, staff may not', async () => {
    const shared = row({ isPrimary: false, primaryAgencyName: '호수공원 공인중개사사무소' });
    const owner = await openMenu(shared, true);
    expect(screen.queryByRole('button', { name: /매물 삭제/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: STATUS_ACTIONS })).not.toBeInTheDocument();
    await owner.user.click(screen.getByRole('button', { name: /공동중개 나가기/ }));
    expect(owner.onAction).toHaveBeenCalledWith({ type: 'leave' });
  });

  it('staff see the leave action disabled with the reason', async () => {
    await openMenu(row({ isPrimary: false }), false);
    expect(screen.getByRole('button', { name: /공동중개 나가기/ })).toBeDisabled();
    expect(screen.getByText(/대표만 할 수 있어요/)).toBeInTheDocument();
  });
});

describe('VerifyDialog', () => {
  it('requires a method, then submits method + date + trimmed note', async () => {
    const onSubmit = vi.fn<(input: VerificationInput) => void>();
    const user = userEvent.setup();
    render(
      <VerifyDialog open rows={[row()]} loading={false} onClose={vi.fn()} onSubmit={onSubmit} />,
    );
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('신대 레이크파크 1단지 103동 · 매매 4억 4,500'),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '확인 기록하기' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('확인 방법을 선택해 주세요.');
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('radio', { name: '소유자 통화 확인' }));
    await user.type(within(dialog).getByLabelText(/메모/), '  임대인과 통화  ');
    await user.click(within(dialog).getByRole('button', { name: '확인 기록하기' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      method: VerificationMethod.OWNER_CALL,
      note: '임대인과 통화',
    });
    expect(onSubmit.mock.calls[0]?.[0].verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('shows the count when several listings are verified at once', () => {
    render(
      <VerifyDialog
        open
        rows={[row(), row({ id: 'l2', dong: '106동' })]}
        loading={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog', { name: /실매물 확인 기록 · 2건/ })).toBeInTheDocument();
  });
});

describe('StatusDialog', () => {
  it('names the listing and the effect on the public site', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <StatusDialog
        rows={[row()]}
        to={ListingStatus.CLOSED}
        loading={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: '거래완료 처리할까요?' });
    expect(dialog).toHaveTextContent('신대 레이크파크 1단지 103동 · 매매 4억 4,500');
    expect(dialog).toHaveTextContent('다시 광고할 수 없어요');
    await user.click(within(dialog).getByRole('button', { name: '거래완료 처리' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('renders nothing without a target status', () => {
    const { container } = render(
      <StatusDialog rows={[]} to={null} loading={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Checklist (표시·광고 명시사항)', () => {
  const wizard = (goToField: WizardContextValue['goToField']): WizardContextValue => ({
    listing: null,
    complex: null,
    setComplex: vi.fn(),
    photos: [],
    setPhotos: vi.fn(),
    setUploading: vi.fn(),
    verifications: [],
    addVerification: vi.fn(),
    agencies: [],
    goToStep: vi.fn(),
    goToField,
    assetLocked: false,
    busy: false,
  });

  function Harness({
    values,
    goToField,
    children,
  }: {
    values: ListingFormValues;
    goToField: WizardContextValue['goToField'];
    children: ReactNode;
  }) {
    const form = useForm<ListingFormValues>({ defaultValues: values });
    return (
      <WizardContext.Provider value={wizard(goToField)}>
        <FormProvider {...form}>{children}</FormProvider>
      </WizardContext.Provider>
    );
  }

  const complete: ListingFormValues = {
    ...FORM_DEFAULTS,
    assetType: AssetType.APT,
    complexId: 'c1',
    roadAddress: '전라남도 순천시 해룡면 신대1로 30',
    lat: 34.93,
    lng: 127.54,
    emdCode: '1215033028',
    floor: '20',
    totalFloors: '25',
    salePrice: '44,500',
    maintenanceFee: '18.5',
    feeBillingType: MaintenanceFeeBillingType.FIXED,
    feeItems: FORM_DEFAULTS.feeItems.map((row) =>
      row.kind === MaintenanceFeeKind.GENERAL ? { ...row, included: true, amount: '185,000' } : row,
    ),
    moveInType: MoveInType.IMMEDIATE,
    exclusiveArea: '84.98',
    rooms: '3',
    baths: '2',
    direction: Direction.SOUTH,
    directionBasis: DirectionBasis.LIVING_ROOM,
    approvalDate: '2019-06-28',
    parkingSpaces: '1949',
  };

  it('counts what is still missing and jumps to the field', async () => {
    const goToField = vi.fn();
    const user = userEvent.setup();
    render(
      <Harness values={{ ...complete, salePrice: '', direction: '' }} goToField={goToField}>
        <Checklist />
      </Harness>,
    );
    expect(screen.getByText('16 / 18')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '16');
    expect(screen.getByText(/2개 항목을 더 입력해야 게시할 수 있어요/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^가격 입력 필요/ }));
    expect(goToField).toHaveBeenCalledWith('salePrice');
    expect(screen.getByRole('button', { name: /소재지 입력 완료/ })).toBeInTheDocument();
  });

  it('confirms when everything is entered', () => {
    render(
      <Harness values={complete} goToField={vi.fn()}>
        <Checklist />
      </Harness>,
    );
    expect(screen.getByText('18 / 18')).toBeInTheDocument();
    expect(screen.getByText(/필수 표시사항을 모두 입력했어요/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /입력 필요/ })).not.toBeInTheDocument();
    // An 아파트 has no 검색 정보 group.
    expect(screen.queryByText('검색 정보 (선택)')).not.toBeInTheDocument();
  });

  it('lists 지목 / 용도지역 of a land listing as search info, apart from the counted 명시사항', async () => {
    const goToField = vi.fn();
    const user = userEvent.setup();
    const land: ListingFormValues = {
      ...FORM_DEFAULTS,
      assetType: AssetType.LAND,
      roadAddress: '전라남도 순천시 해룡면 신대3길 9',
      lat: 34.93,
      lng: 127.55,
      emdCode: '1215033028',
      landArea: '512',
      salePrice: '18,500',
      landCategory: '임야',
    };
    render(
      <Harness values={land} goToField={goToField}>
        <Checklist />
      </Harness>,
    );
    // Land 명시사항 only (소재지·법정동·면적·가격·종류·거래형태) — the search info is not counted.
    expect(screen.getByText('6 / 6')).toBeInTheDocument();
    expect(screen.getByText('검색 정보 (선택)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^지목 입력 완료 \(임야\)/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^용도지역 선택 입력/ }));
    expect(goToField).toHaveBeenCalledWith('zoning');
  });
});

describe('StepDetail — 방 구성 / 토지 정보', () => {
  const ctx = {
    listing: null,
    complex: null,
    setComplex: vi.fn(),
    photos: [],
    setPhotos: vi.fn(),
    setUploading: vi.fn(),
    verifications: [],
    addVerification: vi.fn(),
    agencies: [],
    goToStep: vi.fn(),
    goToField: vi.fn(),
    assetLocked: false,
    busy: false,
  } satisfies WizardContextValue;

  function DetailHarness({
    values,
    onValues,
  }: {
    values: Partial<ListingFormValues>;
    onValues: (get: () => ListingFormValues) => void;
  }) {
    const form = useForm<ListingFormValues>({ defaultValues: { ...FORM_DEFAULTS, ...values } });
    onValues(form.getValues);
    return (
      <WizardContext.Provider value={ctx}>
        <FormProvider {...form}>
          <StepDetail />
        </FormProvider>
      </WizardContext.Provider>
    );
  }

  it('lets a 원룸·투룸 state 1.5룸 (default: from the room count)', async () => {
    let getValues: () => ListingFormValues = () => FORM_DEFAULTS;
    const user = userEvent.setup();
    render(
      <DetailHarness
        values={{ assetType: AssetType.ONEROOM, rooms: '1' }}
        onValues={(g) => (getValues = g)}
      />,
    );
    const group = screen.getByRole('radiogroup', { name: '방 구성' });
    expect(within(group).getByRole('radio', { name: /방 수로 자동/ })).toBeChecked();
    await user.click(within(group).getByRole('radio', { name: '1.5룸' }));
    expect(getValues().roomType).toBe('ONE_HALF_ROOM');
    expect(screen.queryByLabelText('지목')).not.toBeInTheDocument();
  });

  it('collects 지목 and 용도지역 for 토지 and shows their search groups', async () => {
    let getValues: () => ListingFormValues = () => FORM_DEFAULTS;
    const user = userEvent.setup();
    render(
      <DetailHarness values={{ assetType: AssetType.LAND }} onValues={(g) => (getValues = g)} />,
    );
    expect(screen.queryByRole('radiogroup', { name: '방 구성' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '임야' }));
    expect(getValues().landCategory).toBe('임야');
    await user.type(screen.getByLabelText('용도지역'), '계획관리지역');
    expect(getValues().zoning).toBe('계획관리지역');
    expect(screen.getByText('검색 분류 관리지역')).toBeInTheDocument();
    expect(screen.getByText('검색 분류 임야')).toBeInTheDocument();
  });
});

describe('StepDeal — 분양권 프리미엄', () => {
  function DealHarness({ onValues }: { onValues: (get: () => ListingFormValues) => void }) {
    const form = useForm<ListingFormValues>({
      defaultValues: { ...FORM_DEFAULTS, assetType: AssetType.APT, dealType: DealType.PRESALE },
    });
    onValues(form.getValues);
    return (
      <FormProvider {...form}>
        <StepDeal />
      </FormProvider>
    );
  }

  it('keeps a minus premium after the amount field loses focus', async () => {
    let getValues: () => ListingFormValues = () => FORM_DEFAULTS;
    const user = userEvent.setup();
    render(<DealHarness onValues={(get) => (getValues = get)} />);

    await user.type(screen.getByRole('textbox', { name: '분양가' }), '35000');
    await user.selectOptions(screen.getByLabelText('프리미엄 부호'), '-');
    const amount = screen.getByRole('textbox', { name: '프리미엄 금액' });
    await user.type(amount, '1200');
    await user.tab(); // blur — a registered input would re-read "1,200" here and drop the sign

    expect(amount).toHaveValue('1,200');
    expect(screen.getByLabelText('프리미엄 부호')).toHaveValue('-');
    expect(getValues().premium).toBe('-1,200');
    expect(getValues().presalePrice).toBe('35,000');
    expect(screen.getByText('3억 3,800만원')).toBeInTheDocument();

    // Switching back to 플러스 keeps the amount.
    await user.selectOptions(screen.getByLabelText('프리미엄 부호'), '+');
    expect(getValues().premium).toBe('1,200');
    expect(screen.getByText('3억 6,200만원')).toBeInTheDocument();
  });

  it('remembers 마이너스 when it is chosen before typing the amount', async () => {
    let getValues: () => ListingFormValues = () => FORM_DEFAULTS;
    const user = userEvent.setup();
    render(<DealHarness onValues={(get) => (getValues = get)} />);
    await user.selectOptions(screen.getByLabelText('프리미엄 부호'), '-');
    expect(screen.getByLabelText('프리미엄 부호')).toHaveValue('-');
    await user.type(screen.getByRole('textbox', { name: '프리미엄 금액' }), '500');
    await user.tab();
    expect(getValues().premium).toBe('-500');
  });
});
