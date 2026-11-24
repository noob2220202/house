'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { ASSET_TYPE_LABEL, AssetType } from '@house/shared';
import { Button, Input, Panel, Select, useToast } from '@house/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useForm, type DefaultValues } from 'react-hook-form';
import { qk } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { complexes } from '../api';
import { complexFormSchema, type ComplexForm } from '../api/inputs';
import { regionLabel, useRegions } from '../api/regions';
import type { ComplexDetail } from '../api/schemas';
import { SaveBar } from '../components/SaveBar';
import s from '../components/shared.module.css';
import { applyServerErrors } from '../lib/form-errors';
import { useUnsavedGuard } from '../lib/use-unsaved-guard';
import styles from './complexes.module.css';

const FIELDS = [
  'assetType',
  'name',
  'roadAddress',
  'jibunAddress',
  'emdCode',
  'emdName',
  'jibun',
  'lat',
  'lng',
  'households',
  'buildings',
  'floorsMin',
  'floorsMax',
  'approvalDate',
  'builtYear',
  'parkingTotal',
  'parkingPerHousehold',
  'floorAreaRatio',
  'buildingCoverageRatio',
  'heatingType',
  'builder',
  'externalCode',
] as const satisfies readonly (keyof ComplexForm)[];

const EMPTY: DefaultValues<ComplexForm> = {
  assetType: AssetType.APT,
  name: '',
  roadAddress: null,
  jibunAddress: null,
  emdCode: '',
  emdName: null,
  jibun: null,
  households: null,
  buildings: null,
  floorsMin: null,
  floorsMax: null,
  approvalDate: null,
  builtYear: null,
  parkingTotal: null,
  parkingPerHousehold: null,
  floorAreaRatio: null,
  buildingCoverageRatio: null,
  heatingType: null,
  builder: null,
  externalCode: null,
};

function toForm(c: ComplexDetail): ComplexForm {
  return {
    assetType: c.assetType === AssetType.OFFICETEL ? AssetType.OFFICETEL : AssetType.APT,
    name: c.name,
    roadAddress: c.roadAddress,
    jibunAddress: c.jibunAddress,
    emdCode: c.emdCode ?? '',
    emdName: c.emdName,
    jibun: c.jibun,
    lat: c.lat,
    lng: c.lng,
    households: c.households,
    buildings: c.buildings,
    floorsMin: c.floorsMin,
    floorsMax: c.floorsMax,
    approvalDate: c.approvalDate,
    builtYear: c.builtYear,
    parkingTotal: c.parkingTotal,
    parkingPerHousehold: c.parkingPerHousehold,
    floorAreaRatio: c.floorAreaRatio,
    buildingCoverageRatio: c.buildingCoverageRatio,
    heatingType: c.heatingType,
    builder: c.builder,
    externalCode: c.externalCode,
  };
}

/** Empty input → null, anything else → number (NaN is rejected by the schema with a message). */
const optionalNumber = {
  setValueAs: (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v)),
};
/** Required number: empty → undefined so the schema answers "입력해 주세요". */
const requiredNumber = {
  setValueAs: (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
};
const optionalText = {
  setValueAs: (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v : null),
};

/**
 * 단지 기본 정보 (facts) form — used for both 등록 (`complex` undefined) and 수정. Numbers are plain
 * text inputs with numeric keyboards; empty optional fields are sent as null.
 */
export function ComplexFactsForm({
  complex,
  onSaved,
  onDirtyChange,
}: {
  complex?: ComplexDetail;
  onSaved?: (saved: ComplexDetail) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const regions = useRegions();
  // Keyed on the facts themselves: adding a photo or 평형 refetches the complex, and that must not
  // reset edits the operator has not saved yet.
  const facts = complex ? JSON.stringify(toForm(complex)) : '';
  const initial = useMemo(() => (facts ? (JSON.parse(facts) as ComplexForm) : EMPTY), [facts]);
  const { register, handleSubmit, reset, setError, setValue, getValues, formState } =
    useForm<ComplexForm>({
      resolver: zodResolver(complexFormSchema),
      defaultValues: initial,
      mode: 'onBlur',
    });
  useEffect(() => reset(initial), [initial, reset]);
  const dirty = formState.isDirty;
  useUnsavedGuard(dirty);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const save = useMutation({
    mutationFn: (values: ComplexForm) =>
      complex ? complexes.update(complex.id, values) : complexes.create(values),
    onSuccess: (saved) => {
      const detailKey = qk('admin-complexes', 'detail', saved.id);
      // Keep the 평형 / 사진 / 거래 we already have if the write answers with the facts only (their
      // schema defaults would otherwise blank those tabs until the refetch below lands).
      queryClient.setQueryData<ComplexDetail>(detailKey, (prev) =>
        prev
          ? {
              ...saved,
              areaTypes: saved.areaTypes.length > 0 ? saved.areaTypes : prev.areaTypes,
              photos: saved.photos.length > 0 ? saved.photos : prev.photos,
              trades: saved.trades.total > 0 ? saved.trades : prev.trades,
            }
          : saved,
      );
      void queryClient.invalidateQueries({ queryKey: detailKey });
      void queryClient.invalidateQueries({ queryKey: ['admin-complexes', 'list'] });
      reset(toForm(saved));
      if (complex) toast('단지 정보를 저장했어요.');
      onSaved?.(saved);
    },
    onError: (e) => {
      const message = applyServerErrors(e, setError, FIELDS);
      if (message) toast({ message, tone: 'error' });
    },
  });

  const errors = formState.errors;
  const regionOptions = useMemo(() => {
    const items = (regions.data ?? []).map((r) => ({ value: r.code, label: regionLabel(r) }));
    const current = complex?.emdCode;
    if (current && !items.some((i) => i.value === current))
      items.unshift({ value: current, label: complex.emdName ?? current });
    return [
      { value: '', label: regions.isPending ? '지역을 불러오는 중…' : '지역 선택' },
      ...items,
    ];
  }, [regions.data, regions.isPending, complex]);
  const emd = register('emdCode');

  return (
    <form
      className={complex ? s.stackLg : `${s.stackLg} ${s.fill}`}
      noValidate
      onSubmit={(e) => void handleSubmit((v) => save.mutate(v))(e)}
    >
      <Panel title="기본 정보" description="사용자 화면의 단지 상세와 지도에 그대로 보여요">
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>단지</h3>
          <div className={`${s.formGrid} ${s.formGrid4}`}>
            <div className={s.span2}>
              <Input
                label="단지명"
                required
                maxLength={100}
                placeholder="예: 신대 레이크파크 1단지"
                error={errors.name?.message}
                {...register('name')}
              />
            </div>
            <Select
              label="종류"
              required
              options={[
                { value: AssetType.APT, label: ASSET_TYPE_LABEL[AssetType.APT] },
                { value: AssetType.OFFICETEL, label: ASSET_TYPE_LABEL[AssetType.OFFICETEL] },
              ]}
              error={errors.assetType?.message}
              {...register('assetType')}
            />
            <Input
              label="국토부 단지 코드"
              maxLength={40}
              placeholder="예: 12150-0001"
              help="실거래가를 이 코드로 단지에 연결해요."
              error={errors.externalCode?.message}
              {...register('externalCode', optionalText)}
            />
          </div>
        </div>

        <div className={styles.group}>
          <h3 className={styles.groupTitle}>위치</h3>
          <div className={`${s.formGrid} ${s.formGrid4}`}>
            <Select
              label="지역"
              required
              options={regionOptions}
              error={errors.emdCode?.message}
              {...emd}
              onChange={(e) => {
                void emd.onChange(e);
                const region = regions.data?.find((r) => r.code === e.target.value);
                const known = (regions.data ?? []).map(regionLabel);
                const current = getValues('emdName');
                // Keep a hand-written 읍면동 표기; only follow the select while it mirrors a region.
                if (region && (!current || known.includes(current)))
                  setValue('emdName', regionLabel(region), { shouldDirty: true });
              }}
            />
            <Input
              label="읍면동 표기"
              maxLength={50}
              placeholder="예: 해룡면 신대리"
              error={errors.emdName?.message}
              {...register('emdName', optionalText)}
            />
            <Input
              label="지번"
              maxLength={20}
              placeholder="예: 1971"
              error={errors.jibun?.message}
              {...register('jibun', optionalText)}
            />
            <span aria-hidden="true" className="only-lg" />
            <div className={s.span2}>
              <Input
                label="도로명 주소"
                maxLength={200}
                placeholder="예: 전라남도 순천시 해룡면 신대1로 55"
                autoComplete="off"
                error={errors.roadAddress?.message}
                {...register('roadAddress', optionalText)}
              />
            </div>
            <div className={s.span2}>
              <Input
                label="지번 주소"
                maxLength={200}
                placeholder="예: 전라남도 순천시 해룡면 신대리 1971"
                autoComplete="off"
                error={errors.jibunAddress?.message}
                {...register('jibunAddress', optionalText)}
              />
            </div>
            <Input
              label="위도"
              required
              inputMode="decimal"
              placeholder="34.9215"
              error={errors.lat?.message}
              {...register('lat', requiredNumber)}
            />
            <Input
              label="경도"
              required
              inputMode="decimal"
              placeholder="127.5800"
              help="지도 마커가 찍히는 위치예요."
              error={errors.lng?.message}
              {...register('lng', requiredNumber)}
            />
          </div>
        </div>

        <div className={styles.group}>
          <h3 className={styles.groupTitle}>규모</h3>
          <div className={`${s.formGrid} ${s.formGrid4}`}>
            <Input
              label="세대수"
              inputMode="numeric"
              suffix="세대"
              error={errors.households?.message}
              {...register('households', optionalNumber)}
            />
            <Input
              label="동수"
              inputMode="numeric"
              suffix="개 동"
              error={errors.buildings?.message}
              {...register('buildings', optionalNumber)}
            />
            <Input
              label="최저층"
              inputMode="numeric"
              suffix="층"
              error={errors.floorsMin?.message}
              {...register('floorsMin', optionalNumber)}
            />
            <Input
              label="최고층"
              inputMode="numeric"
              suffix="층"
              error={errors.floorsMax?.message}
              {...register('floorsMax', optionalNumber)}
            />
            <Input
              label="사용승인일"
              type="date"
              help="입주 전 단지는 비워 두세요."
              error={errors.approvalDate?.message}
              {...register('approvalDate', optionalText)}
            />
            <Input
              label="준공 연도"
              inputMode="numeric"
              suffix="년"
              placeholder="2019"
              error={errors.builtYear?.message}
              {...register('builtYear', optionalNumber)}
            />
          </div>
        </div>

        <div className={styles.group}>
          <h3 className={styles.groupTitle}>주차 · 건축</h3>
          <div className={`${s.formGrid} ${s.formGrid4}`}>
            <Input
              label="총 주차대수"
              inputMode="numeric"
              suffix="대"
              error={errors.parkingTotal?.message}
              {...register('parkingTotal', optionalNumber)}
            />
            <Input
              label="세대당 주차"
              inputMode="decimal"
              suffix="대"
              placeholder="1.32"
              error={errors.parkingPerHousehold?.message}
              {...register('parkingPerHousehold', optionalNumber)}
            />
            <Input
              label="용적률"
              inputMode="decimal"
              suffix="%"
              error={errors.floorAreaRatio?.message}
              {...register('floorAreaRatio', optionalNumber)}
            />
            <Input
              label="건폐율"
              inputMode="decimal"
              suffix="%"
              error={errors.buildingCoverageRatio?.message}
              {...register('buildingCoverageRatio', optionalNumber)}
            />
            <div className={s.span2}>
              <Input
                label="난방"
                maxLength={50}
                placeholder="예: 지역난방"
                error={errors.heatingType?.message}
                {...register('heatingType', optionalText)}
              />
            </div>
            <div className={s.span2}>
              <Input
                label="시공사"
                maxLength={100}
                error={errors.builder?.message}
                {...register('builder', optionalText)}
              />
            </div>
          </div>
        </div>
      </Panel>

      <SaveBar
        inset={!!complex}
        dirty={dirty}
        info={
          complex
            ? `${formatDateTime(complex.updatedAt)} 저장됨`
            : '등록한 뒤에 평형과 사진을 추가할 수 있어요'
        }
      >
        {complex && (
          <Button
            type="button"
            variant="secondary"
            disabled={!dirty}
            onClick={() => reset(initial)}
          >
            되돌리기
          </Button>
        )}
        <Button type="submit" loading={save.isPending} disabled={!!complex && !dirty}>
          {complex ? '저장' : '단지 등록'}
        </Button>
      </SaveBar>
    </form>
  );
}
