'use client';
import {
  AssetType,
  DIRECTION_BASIS_LABEL,
  DIRECTION_LABEL,
  DealType,
  Direction,
  DirectionBasis,
} from '@house/shared';
import { ChoiceChip, FormSection, HelpLine, Input, cx } from '@house/ui';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { formatCount, pyeongToSqm, sqmToPyeong } from '@/lib/format';
import {
  hasLandArea,
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

/** Step 3 — 면적 (전용/공급 ㎡ + 평) · 방/욕실 · 방향(+기준) · 사용승인일 · 주차. */
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

      {!land && (
        <>
          <FormSection letter="B" title="구조 · 방향">
            {residential && (
              <FormRow label="방 / 욕실" htmlFor="f-rooms" required legal>
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
            )}
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
