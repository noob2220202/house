'use client';
import {
  AssetType,
  DIRECTION_BASIS_LABEL,
  DIRECTION_LABEL,
  DealType,
  Direction,
  DirectionBasis,
  LAND_CATEGORY_LABEL,
  LAND_ZONE_LABEL,
  LandCategory,
  ROOM_TYPE_LABEL,
  RoomType,
  effectiveRoomType,
  landCategoryOf,
  landZoneOf,
} from '@house/shared';
import { ChoiceChip, FormSection, HelpLine, Input, cx } from '@house/ui';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { formatCount, pyeongToSqm, sqmToPyeong } from '@/lib/format';
import {
  LAND_CATEGORY_MAX,
  ZONING_MAX,
  hasLandArea,
  hasRoomType,
  isLand,
  isResidential,
  parseArea,
  parseCount,
  type ListingFormValues,
} from '../lib/form';
import { useWizard } from './context';
import { FormRow, Readout } from './parts';
import styles from './wizard.module.css';

type AreaField = 'exclusiveArea' | 'supplyArea' | 'landArea';

const DIRECTIONS: Direction[] = [
  Direction.SOUTH,
  Direction.SOUTH_EAST,
  Direction.SOUTH_WEST,
  Direction.EAST,
  Direction.WEST,
  Direction.NORTH_EAST,
  Direction.NORTH_WEST,
  Direction.NORTH,
];

/** 지목 quick picks (토지대장 wording); anything else (공장용지, 목장용지 …) is typed. */
const LAND_CATEGORY_PICKS = Object.values(LandCategory)
  .filter((c) => c !== LandCategory.ETC)
  .map((c) => LAND_CATEGORY_LABEL[c]);

const pyeongText = (sqm: string) => {
  const n = parseArea(sqm);
  return typeof n === 'number' ? String(sqmToPyeong(n, 1)) : '';
};

/**
 * Area in ㎡ (the stored value) with a linked 평 helper: typing 평 fills ㎡ (1평 = 3.305785㎡) and
 * typing ㎡ shows 평. The legal display unit is ㎡ — 평 is only a convenience.
 */
function AreaInput({
  name,
  label,
  required = false,
}: {
  name: AreaField;
  label: string;
  required?: boolean;
}) {
  const { register, setValue, clearErrors, formState } = useFormContext<ListingFormValues>();
  const sqm = useWatch<ListingFormValues, AreaField>({ name });
  const [pyeong, setPyeong] = useState(() => pyeongText(sqm));
  const [editingPyeong, setEditingPyeong] = useState(false);
  const shown = editingPyeong ? pyeong : pyeongText(sqm);

  return (
    <div className={styles.inline}>
      <div className={cx(styles.w200, styles.num)}>
        <Input
          id={`f-${name}`}
          aria-label={`${label} (제곱미터)`}
          aria-required={required}
          inputMode="decimal"
          autoComplete="off"
          suffix="㎡"
          placeholder="예: 84.98"
          error={formState.errors[name]?.message}
          {...register(name)}
        />
      </div>
      <span className={styles.sep} aria-hidden="true">
        =
      </span>
      <div className={cx(styles.w160, styles.num)}>
        <Input
          aria-label={`${label} (평, 입력하면 제곱미터로 환산)`}
          inputMode="decimal"
          autoComplete="off"
          suffix="평"
          placeholder="예: 25.7"
          value={shown}
          onFocus={() => {
            setPyeong(pyeongText(sqm));
            setEditingPyeong(true);
          }}
          onBlur={() => setEditingPyeong(false)}
          onChange={(e) => {
            const text = e.target.value.replace(/[^\d.]/g, '');
            setPyeong(text);
            const n = Number(text);
            if (text === '') setValue(name, '', { shouldDirty: true });
            else if (Number.isFinite(n) && n > 0) {
              setValue(name, String(pyeongToSqm(n, 2)), { shouldDirty: true });
              clearErrors(name);
            }
          }}
        />
      </div>
    </div>
  );
}

/** Step 3 — 면적 (전용/공급 ㎡ + 평) · 방/욕실(+방 구성) · 방향(+기준) · 사용승인일 · 주차; 토지는 지목·용도지역. */
export function StepDetail() {
  const { register, setValue, clearErrors, formState } = useFormContext<ListingFormValues>();
  const { errors } = formState;
  const { complex } = useWizard();
  const v = useWatch<ListingFormValues>() as ListingFormValues;
  const asset = v.assetType;
  const land = isLand(asset);
  const residential = isResidential(asset);
  const presale = v.dealType === DealType.PRESALE;

  const set = <K extends keyof ListingFormValues>(key: K, value: ListingFormValues[K]) =>
    setValue(key, value as never, { shouldDirty: true });

  const areaTypes = v.complexId && complex?.id === v.complexId ? complex.areaTypes : [];
  const parking = parseCount(v.parkingSpaces);
  const perHousehold =
    complex?.households && typeof parking === 'number' && parking > 0
      ? Math.round((parking / complex.households) * 100) / 100
      : null;

  return (
    <>
      <FormSection letter="A" title="면적" note="㎡로 표시돼요 · 1평 = 3.305785㎡">
        {areaTypes.length > 0 && (
          <FormRow label="평형" labelId="l-areaType" help="고르면 면적과 방 수가 채워져요.">
            <div className={styles.chips} role="radiogroup" aria-labelledby="l-areaType">
              {areaTypes.map((a) => (
                <ChoiceChip
                  key={a.id}
                  type="radio"
                  name="areaTypeId"
                  value={a.id}
                  checked={v.areaTypeId === a.id}
                  onChange={() => {
                    set('areaTypeId', a.id);
                    set('exclusiveArea', String(a.exclusiveArea));
                    set('supplyArea', a.supplyArea ? String(a.supplyArea) : '');
                    if (typeof a.rooms === 'number') set('rooms', String(a.rooms));
                    if (typeof a.baths === 'number') set('baths', String(a.baths));
                    clearErrors(['exclusiveArea', 'supplyArea', 'rooms', 'baths']);
                  }}
                  hint={a.typeName ?? undefined}
                >
                  {a.pyeongLabel ?? `${sqmToPyeong(a.supplyArea ?? a.exclusiveArea, 0)}평`}
                </ChoiceChip>
              ))}
            </div>
          </FormRow>
        )}
        {!land && (
          <>
            <FormRow label="전용면적" htmlFor="f-exclusiveArea" required legal>
              <AreaInput name="exclusiveArea" label="전용면적" required />
              <HelpLine>
                건축물은 <b>전용면적을 ㎡로</b> 표시해야 해요. 평은 참고용으로 함께 보여 드려요.
              </HelpLine>
            </FormRow>
            <FormRow
              label="공급면적"
              htmlFor="f-supplyArea"
              help={asset === AssetType.APT ? '아파트는 함께 적어 주세요.' : '있으면 적어 주세요.'}
            >
              <AreaInput name="supplyArea" label="공급면적" />
            </FormRow>
          </>
        )}
        {hasLandArea(asset) && (
          <FormRow
            label="대지면적"
            htmlFor="f-landArea"
            required={land}
            legal={land}
            help={land ? undefined : '있으면 적어 주세요.'}
          >
            <AreaInput name="landArea" label="대지면적" required={land} />
            {land && <HelpLine>토지는 토지대장의 면적을 ㎡로 표시해요.</HelpLine>}
          </FormRow>
        )}
      </FormSection>

      {land && <LandInfoSection />}

      {!land && (
        <>
          <FormSection letter="B" title="구조 · 방향">
            <FormRow
              label={residential ? '방 / 욕실' : '방(룸) / 화장실'}
              htmlFor="f-rooms"
              required
              legal
              help={residential ? undefined : '구획된 방이나 화장실이 없으면 0을 입력해요.'}
            >
              <div className={styles.inline}>
                <div className={cx(styles.w160, styles.num)}>
                  <Input
                    id="f-rooms"
                    aria-label="방 수"
                    aria-required
                    inputMode="numeric"
                    prefix="방"
                    suffix="개"
                    placeholder="예: 3"
                    error={errors.rooms?.message}
                    {...register('rooms')}
                  />
                </div>
                <div className={cx(styles.w160, styles.num)}>
                  <Input
                    id="f-baths"
                    aria-label="욕실 수"
                    aria-required
                    inputMode="numeric"
                    prefix="욕실"
                    suffix="개"
                    placeholder="예: 2"
                    error={errors.baths?.message}
                    {...register('baths')}
                  />
                </div>
              </div>
            </FormRow>
            {hasRoomType(asset) && <RoomTypeRow />}
            <FormRow
              label="방향"
              labelId="l-direction"
              required
              legal
              error={errors.direction?.message}
            >
              <div
                className={styles.chips}
                role="radiogroup"
                aria-labelledby="l-direction"
                aria-required
                id="f-direction"
              >
                {DIRECTIONS.map((d) => (
                  <ChoiceChip
                    key={d}
                    type="radio"
                    name="direction"
                    value={d}
                    checked={v.direction === d}
                    onChange={() => {
                      set('direction', d);
                      clearErrors('direction');
                      if (!v.directionBasis) {
                        set(
                          'directionBasis',
                          residential ? DirectionBasis.LIVING_ROOM : DirectionBasis.ENTRANCE,
                        );
                        clearErrors('directionBasis');
                      }
                    }}
                  >
                    {DIRECTION_LABEL[d]}
                  </ChoiceChip>
                ))}
              </div>
            </FormRow>
            <FormRow
              label="방향 기준"
              labelId="l-directionBasis"
              required
              legal
              error={errors.directionBasis?.message}
            >
              <div
                className={styles.chips}
                role="radiogroup"
                aria-labelledby="l-directionBasis"
                aria-required
                id="f-directionBasis"
              >
                {Object.values(DirectionBasis).map((b) => (
                  <ChoiceChip
                    key={b}
                    type="radio"
                    name="directionBasis"
                    value={b}
                    checked={v.directionBasis === b}
                    onChange={() => {
                      set('directionBasis', b);
                      clearErrors('directionBasis');
                    }}
                  >
                    {DIRECTION_BASIS_LABEL[b]}
                  </ChoiceChip>
                ))}
              </div>
              <HelpLine>
                방향은 <b>기준과 함께</b> 표시해야 해요. 주거용은 거실이나 안방 등 가장 넓은 방, 그
                밖의 건물은 주된 출입구를 기준으로 해요.
              </HelpLine>
            </FormRow>
          </FormSection>

          <FormSection letter="C" title="건물 정보">
            <FormRow
              label="사용승인일"
              htmlFor="f-approvalDate"
              required={!presale}
              legal={!presale}
              help={presale ? '준공 전이면 비워 두세요.' : undefined}
            >
              <div className={styles.w240}>
                <Input
                  id="f-approvalDate"
                  type="date"
                  aria-label="사용승인일"
                  aria-required={!presale}
                  error={errors.approvalDate?.message}
                  {...register('approvalDate')}
                />
              </div>
              <HelpLine>
                건축물대장의 사용승인일(없으면 사용검사일·준공인가일)을 적어요.
                {complex?.approvalDate && ' 단지 정보에서 가져온 날짜예요 — 다르면 고쳐 주세요.'}
              </HelpLine>
            </FormRow>
            <FormRow label="주차대수" htmlFor="f-parkingSpaces" required legal help="총 주차대수">
              <div className={cx(styles.inline, styles.inlineCenter)}>
                <div className={cx(styles.w200, styles.num)}>
                  <Input
                    id="f-parkingSpaces"
                    aria-label="총 주차대수"
                    aria-required
                    inputMode="numeric"
                    prefix="총"
                    suffix="대"
                    placeholder="0"
                    error={errors.parkingSpaces?.message}
                    {...register('parkingSpaces')}
                  />
                </div>
                {perHousehold !== null && complex?.households && (
                  <Readout>
                    세대당 <b>{perHousehold}대</b> · {formatCount(complex.households)}세대
                  </Readout>
                )}
              </div>
              <HelpLine>
                건물 전체의 총 주차대수를 적어요. 주차할 수 없으면 0을 입력해요. 단지는 세대당
                주차대수로 함께 표시돼요.
              </HelpLine>
            </FormRow>
          </FormSection>
        </>
      )}
    </>
  );
}

/**
 * 방 구성 (원룸·투룸): optional — without a choice the API derives it from the room count (1 → 원룸,
 * 2 → 투룸, 3+ → 쓰리룸+). 1.5룸 can only be stated. The map's 방 종류 filter reads it.
 */
function RoomTypeRow() {
  const { setValue } = useFormContext<ListingFormValues>();
  const v = useWatch<ListingFormValues>() as ListingFormValues;
  const rooms = parseCount(v.rooms);
  const derived = effectiveRoomType(
    AssetType.ONEROOM,
    null,
    typeof rooms === 'number' ? rooms : null,
  );
  const set = (value: RoomType | '') => setValue('roomType', value, { shouldDirty: true });

  return (
    <FormRow
      label="방 구성"
      labelId="l-roomType"
      help="1.5룸이면 꼭 골라 주세요. 고르지 않으면 방 수로 정해져요."
    >
      <div className={styles.chips} role="radiogroup" aria-labelledby="l-roomType" id="f-roomType">
        <ChoiceChip
          type="radio"
          name="roomType"
          value=""
          checked={v.roomType === ''}
          onChange={() => set('')}
          hint={derived ? ROOM_TYPE_LABEL[derived] : undefined}
        >
          방 수로 자동
        </ChoiceChip>
        {Object.values(RoomType).map((t) => (
          <ChoiceChip
            key={t}
            type="radio"
            name="roomType"
            value={t}
            checked={v.roomType === t}
            onChange={() => set(t)}
          >
            {ROOM_TYPE_LABEL[t]}
          </ChoiceChip>
        ))}
      </div>
      <HelpLine>원룸·투룸 지도에서 방 종류로 찾을 때 이 값이 쓰여요.</HelpLine>
    </FormRow>
  );
}

/**
 * 토지 — 지목 (토지대장) and 용도지역 (토지이용계획확인서) as written in the documents. Optional for
 * publishing, but the 토지 map filters (용도지역 / 지목) find the listing only by them.
 */
function LandInfoSection() {
  const { register, setValue, clearErrors, formState } = useFormContext<ListingFormValues>();
  const { errors } = formState;
  const v = useWatch<ListingFormValues>() as ListingFormValues;
  const zone = landZoneOf(v.zoning);
  const category = landCategoryOf(v.landCategory);

  return (
    <FormSection letter="B" title="토지 정보" note="토지 검색 필터에 쓰여요">
      <FormRow label="지목" htmlFor="f-landCategory" help="토지대장에 적힌 지목">
        <div className={styles.chips} role="radiogroup" aria-label="자주 쓰는 지목">
          {LAND_CATEGORY_PICKS.map((label) => (
            <ChoiceChip
              key={label}
              type="radio"
              name="landCategoryPick"
              value={label}
              checked={v.landCategory.trim() === label}
              onChange={() => {
                setValue('landCategory', label, { shouldDirty: true });
                clearErrors('landCategory');
              }}
            >
              {label}
            </ChoiceChip>
          ))}
        </div>
        <div className={cx(styles.inline, styles.inlineCenter)}>
          <div className={styles.w200}>
            <Input
              id="f-landCategory"
              aria-label="지목"
              autoComplete="off"
              maxLength={LAND_CATEGORY_MAX}
              placeholder="예: 대, 임야, 공장용지"
              error={errors.landCategory?.message}
              {...register('landCategory')}
            />
          </div>
          {category && <Readout>검색 분류 {LAND_CATEGORY_LABEL[category]}</Readout>}
        </div>
      </FormRow>
      <FormRow label="용도지역" htmlFor="f-zoning" help="토지이용계획확인서에 적힌 용도지역">
        <div className={cx(styles.inline, styles.inlineCenter)}>
          <div className={styles.w240}>
            <Input
              id="f-zoning"
              aria-label="용도지역"
              autoComplete="off"
              maxLength={ZONING_MAX}
              placeholder="예: 제2종일반주거지역"
              error={errors.zoning?.message}
              {...register('zoning')}
            />
          </div>
          {zone && <Readout>검색 분류 {LAND_ZONE_LABEL[zone]}</Readout>}
        </div>
        <HelpLine>
          세부 용도지역 그대로 적어 주세요. 주거·상업·공업·녹지·관리·농림·자연환경보전지역으로 묶어
          검색돼요.
        </HelpLine>
      </FormRow>
    </FormSection>
  );
}
