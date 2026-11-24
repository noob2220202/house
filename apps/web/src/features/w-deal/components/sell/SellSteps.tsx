'use client';
import { AssetType, DEAL_TYPE_LABEL, DealType } from '@house/shared';
import {
  Button,
  Checkbox,
  FormRow,
  FormSection,
  HelpLine,
  Icon,
  Input,
  PhotoPlaceholder,
  SegmentedControl,
  Select,
  Spinner,
  Textarea,
  photoKindForAsset,
} from '@house/ui';
import { useState } from 'react';
import {
  floorClassOf,
  floorClassShort,
  formatCount,
  formatManwon,
  formatMonthly,
  formatPerPyeong,
  formatPriceRange,
  formatSqm,
  pyeongToSqm,
  sqmToPyeong,
  toKstDateString,
  type AreaUnit,
} from '@/lib/format';
import type { ComplexAreaType } from '../../api/schemas';
import type { PickedAddress } from '../../lib/daum-postcode';
import { dealTypesFor } from '../../lib/labels';
import {
  isComplexAsset,
  priceFieldsFor,
  sellFloor,
  sellPriceLabel,
  type SellFormValues,
} from '../../lib/sell-form';
import { AddressSearchDialog } from '../form/AddressSearchDialog';
import styles from '../form/form.module.css';
import { MoneyInput } from '../form/MoneyInput';
import { AssetTypeTiles } from '../form/parts';
import { PhotoUploader } from '../form/PhotoUploader';
import type { SellStepProps } from './types';

const ID = 'sell';

/** 평형 of an area type: its label, else 공급면적 (falling back to 전용) in 평. */
const pyeongLabelOf = (t: ComplexAreaType) =>
  t.pyeongLabel ?? `${sqmToPyeong(t.supplyArea ?? t.exclusiveArea, 0)}평`;

function areaTypeLabel(t: ComplexAreaType, unit: AreaUnit): string {
  const pyeong = pyeongLabelOf(t);
  if (unit === 'sqm')
    return `전용 ${formatSqm(t.exclusiveArea)}${t.supplyArea ? ` / 공급 ${formatSqm(t.supplyArea)}` : ''} · ${pyeong}`;
  return `${pyeong} · ${t.supplyArea ? `공급 ${formatSqm(t.supplyArea)} / ` : ''}전용 ${formatSqm(t.exclusiveArea)}`;
}

export interface StepPropertyProps extends SellStepProps {
  matching: boolean;
  /** "다른 단지예요" — unlink the matched complex. */
  onDismissComplex: () => void;
  onAddress: (address: PickedAddress) => void;
}

/** Step 1 — A 매물 기본 정보: 매물 유형, 주소 (postcode search), 동/호 or 상세 주소. */
export function StepProperty({
  form,
  v,
  err,
  set,
  complex,
  matching,
  onDismissComplex,
  onAddress,
}: StepPropertyProps) {
  const [searching, setSearching] = useState(false);
  const inComplex = isComplexAsset(v.assetType);
  const floor = sellFloor(v);
  // Only the 저/중/고 class reaches agencies before a contact grant (as a line of the description,
  // see toSellPayload) — and only when the complex' total floor count is known.
  const floorHint =
    floor && complex?.floorsMax
      ? `${floorClassShort(floorClassOf(floor, complex.floorsMax))}/${complex.floorsMax}층`
      : null;

  return (
    <FormSection letter="A" title="매물 기본 정보">
      <FormRow label="매물 유형" labelId={`${ID}-type-label`} required error={err('assetType')}>
        <AssetTypeTiles
          name={`${ID}-type`}
          labelledBy={`${ID}-type-label`}
          value={v.assetType}
          invalid={!!err('assetType')}
          onChange={(value) => {
            set('assetType', value);
            // Deal types / private-address fields depend on the asset type.
            const allowed = dealTypesFor(value);
            if (!allowed.includes(v.dealType)) set('dealType', allowed[0] ?? DealType.SALE);
            form.clearErrors(['dong', 'ho', 'addressDetail', 'dealType']);
          }}
        />
      </FormRow>

      <FormRow label="주소" htmlFor={`${ID}-addr`} required>
        <div className={styles.inline}>
          <div className={styles.grow}>
            <Input
              id={`${ID}-addr`}
              className={styles.addrInput}
              readOnly
              required
              placeholder="도로명 또는 건물명으로 검색해 주세요"
              prefix={<Icon name="search" size={18} />}
              value={v.roadAddress}
              error={err('roadAddress')}
              onClick={() => setSearching(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSearching(true);
                }
              }}
              aria-haspopup="dialog"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className={styles.btnGrow}
            onClick={() => setSearching(true)}
          >
            {v.roadAddress ? '주소 다시 찾기' : '주소 찾기'}
          </Button>
        </div>
        {matching && (
          <p className={styles.helpIc} role="status">
            <Spinner size={16} />
            <span>단지 정보를 확인하고 있어요…</span>
          </p>
        )}
        {inComplex && complex && (
          <div className={styles.match}>
            <span className={styles.matchPh}>
              <PhotoPlaceholder kind="tower" />
            </span>
            <div className={styles.matchT}>
              <span className={styles.verified}>
                <Icon name="check-circle" size={16} />
                단지 확인됨
              </span>
              <b>{complex.name}</b>
              <span className={styles.matchCap}>
                {[
                  complex.emdName,
                  complex.households && `${formatCount(complex.households)}세대`,
                  complex.builtYear && `${complex.builtYear}년 준공`,
                  complex.areaTypes.length > 0 &&
                    `${complex.areaTypes
                      .map((t) => (t.pyeongLabel ?? '').replace('평', ''))
                      .filter(Boolean)
                      .sort()
                      .join('·')}평`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            <button type="button" className={styles.matchA} onClick={onDismissComplex}>
              다른 단지예요
            </button>
          </div>
        )}
        <AddressSearchDialog
          open={searching}
          onClose={() => setSearching(false)}
          onSelect={(address) => {
            setSearching(false);
            onAddress(address);
          }}
        />
      </FormRow>

      {v.assetType === '' ? null : inComplex ? (
        <FormRow label="동 / 호" htmlFor={`${ID}-dong`} required>
          <div className={styles.pair}>
            <Input
              id={`${ID}-dong`}
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              suffix="동"
              placeholder="103"
              required
              error={err('dong')}
              {...form.register('dong')}
            />
            <Input
              id={`${ID}-ho`}
              aria-label="호"
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              suffix="호"
              placeholder="1502"
              required
              error={err('ho')}
              {...form.register('ho')}
            />
          </div>
          <HelpLine icon="lock">
            {floorHint ? (
              <>
                도로명 주소와 동·호수는 내가 연락처 공개에 동의한 중개사에게만 보이고, 그 전에는
                단지명과 <b>{floorHint}</b>으로만 전달돼요.
              </>
            ) : (
              '도로명 주소와 동·호수는 내가 연락처 공개에 동의한 중개사에게만 보이고, 그 전에는 단지명과 읍면동만 전달돼요.'
            )}
          </HelpLine>
        </FormRow>
      ) : (
        <FormRow
          label="상세 주소"
          htmlFor={`${ID}-detail`}
          help={v.assetType === AssetType.LAND ? '선택' : '선택 · 층, 호수 등'}
        >
          <div className={`${styles.pair} ${styles.pairWide}`}>
            <Input
              id={`${ID}-detail`}
              autoComplete="off"
              maxLength={100}
              placeholder={v.assetType === AssetType.LAND ? '예: 지번, 필지 구분' : '예: 302호'}
              error={err('addressDetail')}
              {...form.register('addressDetail')}
            />
            {v.assetType !== AssetType.LAND && (
              <Input
                id={`${ID}-floor`}
                aria-label="해당 층"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                suffix="층"
                placeholder="3"
                error={err('floor')}
                {...form.register('floor')}
              />
            )}
          </div>
          <HelpLine icon="lock">
            도로명 주소와 상세 주소는 내가 연락처 공개에 동의한 중개사에게만 보여요. 그 전에는
            읍면동과 약 200m 단위의 대략적인 위치만 전달돼요.
          </HelpLine>
        </FormRow>
      )}
    </FormSection>
  );
}

/** Step 2 — B 거래 조건: 거래 유형, 희망가, 면적, 입주 가능일, 설명. */
export function StepTerms({ form, v, err, set, touch, complex }: SellStepProps) {
  const dealOptions = dealTypesFor(v.assetType).map((d) => ({
    value: d,
    label: DEAL_TYPE_LABEL[d],
  }));
  const need = priceFieldsFor(v.dealType);
  const areaTypes = isComplexAsset(v.assetType) ? (complex?.areaTypes ?? []) : [];
  const market = isComplexAsset(v.assetType) ? complex?.market : null;
  const today = toKstDateString();
  const manualArea = areaTypes.length === 0 || v.areaTypeId === '';
  const typedSqm = v.area.trim() && Number(v.area) > 0 ? Number(v.area) : null;

  const nego = (
    <Checkbox className={styles.pushRight} {...form.register('priceNegotiable')}>
      가격 협의 가능
    </Checkbox>
  );

  const changeUnit = (unit: AreaUnit) => {
    if (unit === v.areaUnit) return;
    // Convert what was typed so the value keeps its meaning.
    if (typedSqm !== null) {
      set('area', String(unit === 'sqm' ? pyeongToSqm(typedSqm) : sqmToPyeong(typedSqm, 1)));
    }
    set('areaUnit', unit);
  };

  return (
    <FormSection letter="B" title="거래 조건">
      <FormRow label="거래 유형" labelId={`${ID}-deal-label`} required error={err('dealType')}>
        <SegmentedControl
          className={styles.seg}
          label="거래 유형"
          options={dealOptions}
          value={v.dealType}
          onChange={(value) => {
            set('dealType', value);
            form.clearErrors(['salePrice', 'deposit', 'monthlyRent']);
          }}
        />
      </FormRow>

      <FormRow
        label={sellPriceLabel(v.dealType)}
        htmlFor={need.sale ? `${ID}-price` : `${ID}-deposit`}
        required
      >
        {need.sale && (
          <div className={styles.inline}>
            <MoneyInput
              id={`${ID}-price`}
              value={v.salePrice}
              placeholder="예: 44,500"
              required
              error={err('salePrice')}
              onChange={(value) => set('salePrice', value)}
              onBlur={() => touch('salePrice')}
              readout
            />
            {nego}
          </div>
        )}
        {need.deposit && (
          <div className={styles.inline}>
            {need.rent && (
              <span className={styles.priceLabel} aria-hidden="true">
                보증금
              </span>
            )}
            <MoneyInput
              id={`${ID}-deposit`}
              aria-label={need.rent ? '보증금' : undefined}
              value={v.deposit}
              placeholder={need.rent ? '예: 3,000' : '예: 26,000'}
              required
              error={err('deposit')}
              onChange={(value) => set('deposit', value)}
              onBlur={() => touch('deposit')}
              readout
            />
            {!need.rent && nego}
          </div>
        )}
        {need.rent && (
          <div className={styles.inline}>
            <span className={styles.priceLabel} aria-hidden="true">
              월세
            </span>
            <MoneyInput
              id={`${ID}-rent`}
              aria-label="월세"
              value={v.monthlyRent}
              placeholder="예: 90"
              required
              error={err('monthlyRent')}
              onChange={(value) => set('monthlyRent', value)}
              onBlur={() => touch('monthlyRent')}
            />
            {nego}
          </div>
        )}
        {market && (
          <div className={styles.market}>
            <span className={styles.marketH}>
              <Icon name="chart" size={16} />이 단지 시세 참고
            </span>
            <dl>
              {typeof market.recentTradePrice === 'number' && (
                <div>
                  <dt>
                    최근 실거래{market.recentTradePyeong ? ` (${market.recentTradePyeong})` : ''}
                  </dt>
                  <dd className="num">
                    {formatManwon(market.recentTradePrice)}
                    {market.recentTradeYm && (
                      <span>{market.recentTradeYm.slice(2).replace('-', '.')}</span>
                    )}
                  </dd>
                </div>
              )}
              {(market.askingMin ?? market.askingMax) != null && (
                <div>
                  <dt>현재 매물 호가</dt>
                  <dd className="num">{formatPriceRange(market.askingMin, market.askingMax)}</dd>
                </div>
              )}
              {typeof market.perPyeong === 'number' && (
                <div>
                  <dt>평당가</dt>
                  <dd className="num">{formatPerPyeong(market.perPyeong).replace('/평', '')}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </FormRow>

      <FormRow
        label={v.assetType === AssetType.LAND ? '면적' : '전용면적'}
        htmlFor={areaTypes.length > 0 ? `${ID}-area-type` : `${ID}-area`}
        required
      >
        <div className={styles.inline}>
          {areaTypes.length > 0 && (
            <div className={styles.grow}>
              <Select
                id={`${ID}-area-type`}
                value={v.areaTypeId}
                error={manualArea ? undefined : err('area')}
                onChange={(e) => {
                  const picked = areaTypes.find((t) => t.id === e.target.value);
                  set('areaTypeId', picked?.id ?? '');
                  set('areaTypeSqm', picked ? String(picked.exclusiveArea) : '');
                  set('areaTypeLabel', picked ? pyeongLabelOf(picked) : '');
                  form.clearErrors('area');
                }}
              >
                <option value="">직접 입력</option>
                {areaTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {areaTypeLabel(t, v.areaUnit)}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {manualArea && (
            <div className={areaTypes.length > 0 ? styles.priceIn : styles.grow}>
              <Input
                id={`${ID}-area`}
                aria-label={areaTypes.length > 0 ? '전용면적 직접 입력' : undefined}
                inputMode="decimal"
                autoComplete="off"
                maxLength={8}
                suffix={v.areaUnit === 'pyeong' ? '평' : '㎡'}
                placeholder={v.areaUnit === 'pyeong' ? '예: 25.7' : '예: 84.98'}
                required
                error={err('area')}
                {...form.register('area')}
              />
            </div>
          )}
          <SegmentedControl<AreaUnit>
            label="면적 단위"
            options={[
              { value: 'pyeong', label: '평' },
              { value: 'sqm', label: '㎡' },
            ]}
            value={v.areaUnit}
            onChange={changeUnit}
          />
        </div>
        {manualArea && typedSqm !== null && (
          <p className={styles.help} aria-live="polite">
            {v.areaUnit === 'pyeong'
              ? `= ${formatSqm(pyeongToSqm(typedSqm))}`
              : `= 약 ${sqmToPyeong(typedSqm, 1)}평`}
          </p>
        )}
      </FormRow>

      <FormRow label="입주 가능일" htmlFor={`${ID}-move`} required>
        <div className={styles.inline}>
          <div className={styles.move}>
            <Input
              id={`${ID}-move`}
              type="date"
              min={today}
              disabled={v.moveInNow}
              required={!v.moveInNow}
              error={err('moveInDate')}
              {...form.register('moveInDate')}
            />
          </div>
          <Checkbox
            checked={v.moveInNegotiable}
            disabled={v.moveInNow}
            onChange={(e) => set('moveInNegotiable', e.target.checked)}
          >
            날짜 협의 가능
          </Checkbox>
          <Checkbox
            checked={v.moveInNow}
            onChange={(e) => {
              set('moveInNow', e.target.checked);
              if (e.target.checked) form.clearErrors('moveInDate');
            }}
          >
            즉시 입주
          </Checkbox>
        </div>
      </FormRow>

      <FormRow label="매물 설명" htmlFor={`${ID}-desc`} help="선택">
        <Textarea
          id={`${ID}-desc`}
          rows={4}
          maxLength={2800}
          placeholder="수리 내역, 집 보기 가능한 시간, 옵션 등 중개사가 알면 좋은 내용을 적어 주세요."
          error={err('description')}
          {...form.register('description')}
        />
        <span className={styles.counter} aria-hidden="true">
          {v.description.length.toLocaleString('ko-KR')} / 2,800
        </span>
        <HelpLine icon="lock">
          설명은 내가 연락처 공개에 동의한 중개사에게만 보여요. 체크한 조건(가격 협의 가능 등)은
          요청을 받은 모든 중개사에게 보여요.
        </HelpLine>
      </FormRow>
    </FormSection>
  );
}

/** Step 3 (first half) — C 사진: optional photos through the media API. */
export function StepPhotos({
  v,
  err,
  set,
  onBusyChange,
}: Pick<SellStepProps, 'v' | 'err' | 'set'> & { onBusyChange?: (busy: boolean) => void }) {
  return (
    <FormRow label="매물 사진" htmlFor={`${ID}-photo`} help="선택 · 연락 받을 확률이 높아져요">
      <PhotoUploader
        id={`${ID}-photo`}
        value={v.photos}
        onChange={(photos) => set('photos', photos)}
        onBusyChange={onBusyChange}
        error={err('photos')}
      />
      <HelpLine icon="lock">
        사진은 내가 연락처 공개에 동의한 중개사에게만 보여요. 그 전에는 사진 장수만 전달돼요.
      </HelpLine>
    </FormRow>
  );
}

/** Headline price of the form values: "4억 4,500" / "3,000/90" ('' while incomplete). */
export function sellPriceText(
  v: SellFormValues,
  parse: (s: string) => number | null | undefined,
): string {
  const need = priceFieldsFor(v.dealType);
  if (need.sale) {
    const price = parse(v.salePrice);
    return typeof price === 'number' ? formatManwon(price) : '';
  }
  const deposit = parse(v.deposit);
  if (typeof deposit !== 'number') return '';
  if (v.dealType === DealType.MONTHLY) {
    const rent = parse(v.monthlyRent);
    return typeof rent === 'number' ? formatMonthly(deposit, rent) : '';
  }
  return formatManwon(deposit);
}

/** Photo-placeholder kind for the summary thumbnail. */
export const sellPhotoKind = (assetType: AssetType | '') =>
  photoKindForAsset(assetType || AssetType.APT);
