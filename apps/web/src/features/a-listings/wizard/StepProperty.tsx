'use client';
import {
  ASSET_TYPE_LABEL,
  AssetType,
  DealType,
  FLOOR_CLASS_LABEL,
  FloorDisplay,
} from '@house/shared';
import {
  Callout,
  CategoryIcon,
  FormSection,
  HelpLine,
  Icon,
  Input,
  SegmentedControl,
  cx,
  useDebouncedValue,
  useToast,
  type CategoryIconName,
  type IconName,
} from '@house/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { errorMessage } from '@/lib/api';
import { floorClassOf, formatCount, formatDate } from '@/lib/format';
import { fetchComplex, fetchCoBrokerCandidates, listingKeys } from '../api/queries';
import type { ComplexSearchItem, GeocodeItem } from '../api/schemas';
import {
  dealTypesFor,
  isComplexAsset,
  isLand,
  parseCount,
  parseFloor,
  type ListingFormValues,
} from '../lib/form';
import { CO_BROKER_ROUTE } from '../routes';
import { useWizard } from './context';
import { FormRow } from './parts';
import { AddressSearch, ComplexSearch } from './Pickers';
import { PinPicker } from './PinPicker';
import styles from './wizard.module.css';

const TILES: readonly {
  value: AssetType;
  label: string;
  icon: CategoryIconName | { icon: IconName };
}[] = [
  { value: AssetType.APT, label: '아파트', icon: 'apt' },
  { value: AssetType.OFFICETEL, label: '오피스텔', icon: { icon: 'building' } },
  { value: AssetType.ONEROOM, label: '원룸·투룸', icon: 'room' },
  { value: AssetType.HOUSE, label: '주택', icon: 'house' },
  { value: AssetType.COMMERCIAL, label: '상업·업무', icon: 'biz' },
  { value: AssetType.LAND, label: '토지', icon: 'land' },
];

/** 해당 층은 정확히 표시하는 것이 원칙 — 저·중·고 표시는 의뢰인이 원할 때만 (세부기준). */
const FLOOR_DISPLAY_OPTIONS = [
  { value: FloorDisplay.EXACT, label: '정확한 층 표시' },
  { value: FloorDisplay.CLASS, label: '저·중·고로 표시' },
] as const;

/** Step 1 — 중개대상물 종류 + 소재지 (단지 검색 · 동/층, or 주소 검색 + 지도 핀). */
export function StepProperty() {
  const { register, setValue, getValues, clearErrors, formState } =
    useFormContext<ListingFormValues>();
  const { errors } = formState;
  const { complex, setComplex, assetLocked, listing } = useWizard();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const v = useWatch<ListingFormValues>() as ListingFormValues;
  const asset = v.assetType;
  const complexAsset = isComplexAsset(asset);
  const land = isLand(asset);
  // 단지 목록에 없는 아파트·오피스텔은 주소로 입력한다.
  const [manual, setManual] = useState(() => complexAsset && !v.complexId && !!v.roadAddress);
  const [loadingComplex, setLoadingComplex] = useState(false);
  const useComplex = complexAsset && !manual;

  const set = <K extends keyof ListingFormValues>(key: K, value: ListingFormValues[K]) =>
    setValue(key, value as never, { shouldDirty: true });

  const clearLocation = () => {
    setComplex(null);
    set('complexId', '');
    set('complexName', '');
    set('areaTypeId', '');
    set('roadAddress', '');
    set('jibunAddress', '');
    set('buildingName', '');
    set('lat', null);
    set('lng', null);
  };

  const chooseAsset = (next: AssetType) => {
    if (next === asset) return;
    const wasComplex = isComplexAsset(asset);
    set('assetType', next);
    clearErrors('assetType');
    if (asset !== '' && wasComplex !== isComplexAsset(next)) clearLocation();
    if (!isComplexAsset(next)) setManual(false);
    if (!dealTypesFor(next).includes(getValues('dealType'))) set('dealType', DealType.SALE);
  };

  const chooseComplex = async (item: ComplexSearchItem) => {
    setLoadingComplex(true);
    try {
      const detail = await queryClient.fetchQuery({
        queryKey: listingKeys.complex(item.id),
        queryFn: ({ signal }) => fetchComplex(item.id, signal),
        staleTime: 5 * 60_000,
      });
      setComplex(detail);
      set('complexId', detail.id);
      set('complexName', detail.name);
      set('areaTypeId', '');
      set('roadAddress', detail.roadAddress ?? detail.name);
      set('jibunAddress', detail.jibunAddress ?? '');
      set('buildingName', detail.name);
      set('lat', detail.lat);
      set('lng', detail.lng);
      // Pre-fill what the complex already knows — the broker can still correct each value.
      if (detail.floorsMax) set('totalFloors', String(detail.floorsMax));
      set('approvalDate', detail.approvalDate?.slice(0, 10) ?? '');
      if (detail.parkingTotal) set('parkingSpaces', String(detail.parkingTotal));
      clearErrors(['roadAddress', 'complexId', 'totalFloors']);
    } catch (error) {
      toast({ message: errorMessage(error), tone: 'error' });
    } finally {
      setLoadingComplex(false);
    }
  };

  const chooseAddress = (item: GeocodeItem) => {
    set('roadAddress', item.roadAddress);
    set('jibunAddress', item.jibunAddress ?? '');
    if (item.buildingName && !getValues('buildingName')) set('buildingName', item.buildingName);
    set('lat', item.lat);
    set('lng', item.lng);
    clearErrors('roadAddress');
  };

  // Same 단지 + 동 already listed by another office → suggest co-brokering instead of a duplicate.
  const dong = useDebouncedValue(v.dong.trim(), 400);
  const isNew = !listing || listing.status === 'DRAFT';
  const candidates = useQuery({
    queryKey: listingKeys.candidates({ complexId: v.complexId, dong }),
    queryFn: ({ signal }) => fetchCoBrokerCandidates({ complexId: v.complexId, dong }, signal),
    enabled: useComplex && isNew && !!v.complexId && dong !== '',
    staleTime: 60_000,
    retry: false,
  });
  const duplicates = (candidates.data?.items ?? []).filter((c) => !c.joined);

  const floor = parseFloor(v.floor);
  const total = parseCount(v.totalFloors);
  const floorClass =
    typeof floor === 'number' && typeof total === 'number' && total > 0
      ? FLOOR_CLASS_LABEL[floorClassOf(floor, total)]
      : null;

  return (
    <>
      <FormSection letter="A" title="매물 종류">
        <FormRow
          label="중개대상물 종류"
          labelId="l-assetType"
          required
          legal
          error={errors.assetType?.message}
          help={assetLocked ? '게시한 매물은 종류를 바꿀 수 없어요.' : undefined}
        >
          <div
            className={styles.types}
            role="radiogroup"
            aria-labelledby="l-assetType"
            aria-required
            id="f-assetType"
          >
            {TILES.map((t) => {
              const locked = assetLocked && asset !== t.value;
              return (
                <label
                  key={t.value}
                  className={cx(
                    styles.type,
                    asset === t.value && styles.sel,
                    locked && styles.locked,
                  )}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="assetType"
                    value={t.value}
                    checked={asset === t.value}
                    disabled={locked}
                    onChange={() => chooseAsset(t.value)}
                  />
                  {typeof t.icon === 'string' ? (
                    <CategoryIcon name={t.icon} size={26} />
                  ) : (
                    <Icon name={t.icon.icon} size={26} />
                  )}
                  <span>{t.label}</span>
                </label>
              );
            })}
          </div>
          <HelpLine>
            건축물대장의 용도에 맞게 골라 주세요. 분양권은 아파트·오피스텔을 고른 뒤 다음 단계에서
            거래 형태로 선택해요.
          </HelpLine>
        </FormRow>
      </FormSection>

      {asset !== '' && (
        <FormSection
          letter="B"
          title="소재지"
          note={land ? '지번까지 표시돼요' : '호수는 공개되지 않아요'}
        >
          {useComplex ? (
            <FormRow
              label="단지"
              htmlFor="f-roadAddress"
              required
              legal
              help="단지를 선택하면 주소·준공·주차 정보가 자동으로 채워져요."
            >
              {v.complexId ? (
                <div className={styles.match}>
                  <span className={styles.matchIc} aria-hidden="true">
                    <CategoryIcon name="apt" size={26} />
                  </span>
                  <span className={styles.matchT}>
                    <b>{v.complexName}</b>
                    <span className={styles.matchCap}>
                      {v.roadAddress}
                      {complex && (
                        <>
                          {complex.households ? ` · ${formatCount(complex.households)}세대` : ''}
                          {complex.approvalDate
                            ? ` · ${formatDate(complex.approvalDate)} 사용승인`
                            : ' · 입주 예정 단지'}
                        </>
                      )}
                    </span>
                  </span>
                  <button type="button" className={styles.textBtn} onClick={clearLocation}>
                    단지 변경
                  </button>
                </div>
              ) : (
                <>
                  <ComplexSearch
                    id="f-roadAddress"
                    onSelect={(item) => void chooseComplex(item)}
                    error={errors.roadAddress?.message}
                  />
                  <div className={cx(styles.inline, styles.inlineCenter)}>
                    <HelpLine>
                      {loadingComplex
                        ? '단지 정보를 불러오고 있어요…'
                        : `${ASSET_TYPE_LABEL[asset]}는 단지를 먼저 선택해요.`}
                    </HelpLine>
                    <button
                      type="button"
                      className={styles.textBtn}
                      onClick={() => {
                        clearLocation();
                        setManual(true);
                      }}
                    >
                      단지 목록에 없어요 · 주소로 입력
                    </button>
                  </div>
                </>
              )}
            </FormRow>
          ) : (
            <>
              <FormRow
                label={land ? '소재지 (지번)' : '주소'}
                htmlFor="f-roadAddress"
                required
                legal
                help={
                  land
                    ? '토지는 지번까지 표시해야 해요.'
                    : '건물은 지번·동·층수까지 표시하고, 호수는 공개하지 않아요.'
                }
              >
                <AddressSearch
                  id="f-roadAddress"
                  value={v.roadAddress}
                  onSelect={chooseAddress}
                  onClear={() => {
                    set('roadAddress', '');
                    set('jibunAddress', '');
                    set('lat', null);
                    set('lng', null);
                  }}
                  error={errors.roadAddress?.message}
                  placeholder={land ? '지번으로 검색 (예: 신대리 2011)' : undefined}
                />
                {v.jibunAddress && <p className={styles.help}>지번 · {v.jibunAddress}</p>}
                {complexAsset && (
                  <button
                    type="button"
                    className={styles.textBtn}
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => {
                      clearLocation();
                      setManual(false);
                    }}
                  >
                    단지 검색으로 돌아가기
                  </button>
                )}
              </FormRow>
              <FormRow
                label="지도 위치"
                labelId="l-pin"
                required
                help="지도 검색에 쓰이는 위치예요. 핀을 건물(필지) 위에 맞춰 주세요."
              >
                <PinPicker
                  value={v.lat !== null && v.lng !== null ? { lat: v.lat, lng: v.lng } : null}
                  onChange={(pos) => {
                    set('lat', pos.lat);
                    set('lng', pos.lng);
                  }}
                  invalid={!!errors.roadAddress && v.lat === null}
                  describedBy="l-pin"
                />
              </FormRow>
              {!land && (
                <FormRow label="건물명" htmlFor="f-buildingName" help="있으면 적어 주세요.">
                  <Input
                    id="f-buildingName"
                    placeholder="예: 석현동 해오름빌"
                    maxLength={100}
                    error={errors.buildingName?.message}
                    {...register('buildingName')}
                  />
                </FormRow>
              )}
            </>
          )}

          {!land && (
            <>
              <FormRow label="동 / 호" htmlFor="f-dong" help="호수는 사무소 직원에게만 보여요.">
                <div className={styles.inline}>
                  <div className={styles.w160}>
                    <Input
                      id="f-dong"
                      aria-label="동"
                      placeholder={useComplex ? '103동' : '동 (없으면 비움)'}
                      maxLength={20}
                      error={errors.dong?.message}
                      {...register('dong')}
                    />
                  </div>
                  <div className={styles.w160}>
                    <Input
                      id="f-ho"
                      aria-label="호 (비공개)"
                      placeholder="1502호"
                      maxLength={20}
                      prefix={<Icon name="lock" size={16} />}
                      error={errors.ho?.message}
                      {...register('ho')}
                    />
                  </div>
                </div>
                <HelpLine icon="lock">
                  동은 공개 화면에 표시되고, <b>호수는 어디에도 공개되지 않아요.</b> 중복 등록
                  확인과 사무소 내부 관리에만 써요.
                </HelpLine>
                {duplicates.length > 0 && (
                  <Callout
                    tone="warn"
                    title={`같은 동에 이미 등록된 매물이 ${duplicates.length}건 있어요`}
                  >
                    같은 집이라면 새로 올리지 말고 공동중개로 참여해 주세요. 사이트에는 한 매물로
                    보이고, 사무소 목록에 함께 표시돼요.{' '}
                    <Link
                      className="link"
                      href={`${CO_BROKER_ROUTE}?complexId=${encodeURIComponent(v.complexId)}&dong=${encodeURIComponent(dong)}`}
                    >
                      등록된 매물 확인하기
                    </Link>
                  </Callout>
                )}
              </FormRow>

              <FormRow
                label="층"
                htmlFor="f-floor"
                required
                legal
                help={asset === AssetType.HOUSE ? '단독주택은 총 층수만 적어도 돼요.' : undefined}
              >
                <div className={cx(styles.inline)}>
                  <div className={cx(styles.w120, styles.num)}>
                    <Input
                      id="f-floor"
                      aria-label="해당 층"
                      aria-required={asset !== AssetType.HOUSE}
                      inputMode="numeric"
                      placeholder="해당 층"
                      suffix="층"
                      error={errors.floor?.message}
                      {...register('floor')}
                    />
                  </div>
                  <span className={styles.sep} aria-hidden="true">
                    /
                  </span>
                  <div className={cx(styles.w120, styles.num)}>
                    <Input
                      id="f-totalFloors"
                      aria-label="총 층수"
                      aria-required
                      inputMode="numeric"
                      placeholder="총 층수"
                      suffix="층"
                      error={errors.totalFloors?.message}
                      {...register('totalFloors')}
                    />
                  </div>
                  {floorClass && (
                    <span className={styles.readout}>
                      = <b>{floorClass}</b>
                    </span>
                  )}
                </div>
                <SegmentedControl
                  label="층 표시 방식"
                  options={FLOOR_DISPLAY_OPTIONS}
                  value={v.floorDisplay}
                  onChange={(next) => set('floorDisplay', next)}
                  size="sm"
                  className={styles.segStart}
                />
                <HelpLine>
                  총 층수와 해당 층을 표시해야 해요. 의뢰인이 원하면 해당 층을 <b>저층·중층·고층</b>
                  으로 바꿔 표시할 수 있어요. 지하는 B1처럼 적어요.
                </HelpLine>
              </FormRow>
            </>
          )}
        </FormSection>
      )}
    </>
  );
}
