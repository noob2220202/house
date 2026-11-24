'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Icon,
  IconButton,
  Input,
  Panel,
  useToast,
  type TableColumn,
} from '@house/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { errorMessage } from '@/lib/api';
import { formatCount, formatManwon, sqmToPyeong } from '@/lib/format';
import { complexes } from '../api';
import { areaTypeFormSchema, type AreaTypeForm } from '../api/inputs';
import type { AreaType, ComplexDetail } from '../api/schemas';
import { DataTable, cardStyles } from '../components/DataTable';
import drawer from '../components/drawer.module.css';
import s from '../components/shared.module.css';
import { suggestPyeongLabel } from '../lib/complex';
import { applyServerErrors } from '../lib/form-errors';
import styles from './complexes.module.css';

type Editing = { mode: 'create' } | { mode: 'edit'; area: AreaType } | null;

const EMPTY = {
  supplyArea: null,
  typeName: '',
  pyeongLabel: null,
  households: null,
  rooms: null,
  baths: null,
} satisfies Partial<AreaTypeForm>;

const optionalNumber = {
  setValueAs: (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v)),
};
const requiredNumber = {
  setValueAs: (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
};
const optionalText = {
  setValueAs: (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v : null),
};

const pyeong = (sqm: number) => sqmToPyeong(sqm).toFixed(1);
function AreaTypeDrawer({
  complexId,
  editing,
  onClose,
  onSaved,
}: {
  complexId: string;
  editing: Editing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const area = editing?.mode === 'edit' ? editing.area : null;
  const { register, handleSubmit, reset, watch, setValue, setError, formState } =
    useForm<AreaTypeForm>({
      resolver: zodResolver(areaTypeFormSchema),
      defaultValues: EMPTY,
      mode: 'onBlur',
    });
  useEffect(() => {
    if (!editing) return;
    reset(
      editing.mode === 'edit'
        ? {
            exclusiveArea: editing.area.exclusiveArea,
            supplyArea: editing.area.supplyArea,
            typeName: editing.area.typeName,
            pyeongLabel: editing.area.pyeongLabel,
            households: editing.area.households,
            rooms: editing.area.rooms,
            baths: editing.area.baths,
          }
        : EMPTY,
    );
  }, [editing, reset]);

  const save = useMutation({
    mutationFn: (values: AreaTypeForm) =>
      area
        ? complexes.updateAreaType(complexId, area.id, values)
        : complexes.addAreaType(complexId, values),
    onSuccess: () => {
      toast(area ? '평형을 저장했어요.' : '평형을 추가했어요.');
      onSaved();
    },
    onError: (e) => {
      const message = applyServerErrors(e, setError, [
        'exclusiveArea',
        'supplyArea',
        'typeName',
        'pyeongLabel',
        'households',
        'rooms',
        'baths',
      ]);
      if (message) toast({ message, tone: 'error' });
    },
  });

  const errors = formState.errors;
  const exclusive = watch('exclusiveArea');
  const supply = watch('supplyArea');
  const suggestion = suggestPyeongLabel(
    typeof exclusive === 'number' ? exclusive : null,
    typeof supply === 'number' ? supply : null,
  );
  const hint = [
    typeof exclusive === 'number' && exclusive > 0 ? `전용 ${pyeong(exclusive)}평` : null,
    typeof supply === 'number' && supply > 0 ? `공급 ${pyeong(supply)}평` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Drawer
      open={editing !== null}
      onClose={onClose}
      title={area ? '평형 수정' : '평형 추가'}
      width={480}
      footer={
        <div className={drawer.footer}>
          <span className={drawer.spacer} />
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" form="area-type-form" loading={save.isPending}>
            저장
          </Button>
        </div>
      }
    >
      <form
        id="area-type-form"
        className={s.stack}
        noValidate
        onSubmit={(e) => void handleSubmit((v) => save.mutate(v))(e)}
      >
        <div className={s.formGrid}>
          <Input
            label="전용면적"
            required
            inputMode="decimal"
            suffix="㎡"
            placeholder="84.98"
            error={errors.exclusiveArea?.message}
            {...register('exclusiveArea', requiredNumber)}
          />
          <Input
            label="공급면적"
            inputMode="decimal"
            suffix="㎡"
            placeholder="112.40"
            error={errors.supplyArea?.message}
            {...register('supplyArea', optionalNumber)}
          />
        </div>
        {hint && (
          <p className={styles.areaHint} aria-live="polite">
            {hint} <span className={s.muted}>(1평 = 3.305785㎡)</span>
          </p>
        )}
        <div className={s.formGrid}>
          <Input
            label="타입명"
            maxLength={20}
            placeholder="예: 84A"
            help="같은 면적에 구조가 다르면 A · B로 구분해요."
            error={errors.typeName?.message}
            {...register('typeName')}
          />
          <div className={styles.pyeongRow}>
            <Input
              label="평형 표기"
              maxLength={20}
              placeholder="예: 34평"
              error={errors.pyeongLabel?.message}
              {...register('pyeongLabel', optionalText)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!suggestion}
              onClick={() =>
                suggestion &&
                setValue('pyeongLabel', suggestion, { shouldDirty: true, shouldValidate: true })
              }
            >
              자동
            </Button>
          </div>
        </div>
        <div className={`${s.formGrid} ${s.formGrid3}`}>
          <Input
            label="세대수"
            inputMode="numeric"
            suffix="세대"
            error={errors.households?.message}
            {...register('households', optionalNumber)}
          />
          <Input
            label="방"
            inputMode="numeric"
            suffix="개"
            error={errors.rooms?.message}
            {...register('rooms', optionalNumber)}
          />
          <Input
            label="욕실"
            inputMode="numeric"
            suffix="개"
            error={errors.baths?.message}
            {...register('baths', optionalNumber)}
          />
        </div>
      </form>
    </Drawer>
  );
}

/** 평형 (ComplexAreaType) table of a complex with add / edit / delete. */
export function AreaTypesPanel({
  complex,
  onChanged,
}: {
  complex: ComplexDetail;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<AreaType | null>(null);

  const remove = useMutation({
    mutationFn: (areaTypeId: string) => complexes.removeAreaType(complex.id, areaTypeId),
    onSuccess: () => {
      setDeleting(null);
      toast('평형을 삭제했어요.');
      void queryClient.invalidateQueries({ queryKey: ['admin-complexes', 'list'] });
      onChanged();
    },
    onError: (e) => {
      setDeleting(null);
      toast({ message: errorMessage(e), tone: 'error' });
    },
  });

  const name = (a: AreaType) => a.pyeongLabel ?? `${a.exclusiveArea}㎡`;
  const typeCell = (a: AreaType) => (
    <div className={s.cellMain}>
      <span className={s.cellTitle}>
        {a.pyeongLabel ?? '평형 표기 없음'}
        {a.typeName && <span className={styles.typeName}>{a.typeName}</span>}
      </span>
      <span className={s.cellSub}>
        방 {a.rooms ?? '–'} · 욕실 {a.baths ?? '–'}
      </span>
    </div>
  );
  const areaCell = (sqm: number | null) =>
    sqm === null ? (
      <span className={s.muted}>–</span>
    ) : (
      <span>
        <b className={s.num}>{sqm.toFixed(2)}</b>㎡{' '}
        <span className={`${s.muted} ${s.small}`}>({pyeong(sqm)}평)</span>
      </span>
    );
  const actions = (a: AreaType) => (
    <span className={s.rowActions}>
      <IconButton
        label={`${name(a)} ${a.typeName} 수정`}
        size={36}
        variant="plain"
        onClick={() => setEditing({ mode: 'edit', area: a })}
      >
        <Icon name="edit" size={18} />
      </IconButton>
      <IconButton
        label={`${name(a)} ${a.typeName} 삭제`}
        size={36}
        variant="plain"
        onClick={() => setDeleting(a)}
      >
        <Icon name="trash" size={18} />
      </IconButton>
    </span>
  );

  const columns: TableColumn<AreaType>[] = [
    { key: 'type', header: '평형 · 타입', cell: typeCell },
    { key: 'exclusive', header: '전용면적', width: 170, cell: (a) => areaCell(a.exclusiveArea) },
    { key: 'supply', header: '공급면적', width: 170, cell: (a) => areaCell(a.supplyArea) },
    {
      key: 'households',
      header: '세대수',
      align: 'right',
      width: 90,
      cell: (a) => <span className={s.num}>{a.households ? formatCount(a.households) : '–'}</span>,
    },
    {
      key: 'trades',
      header: '실거래',
      align: 'right',
      width: 90,
      cell: (a) => <span className={s.num}>{formatCount(a.tradeCount)}건</span>,
    },
    {
      key: 'lastSale',
      header: '최근 매매가',
      align: 'right',
      width: 120,
      cell: (a) =>
        a.lastSalePrice ? (
          <span className={s.num}>{formatManwon(a.lastSalePrice)}</span>
        ) : (
          <span className={s.muted}>–</span>
        ),
    },
    { key: 'actions', header: '관리', align: 'right', width: 96, cell: actions },
  ];

  return (
    <>
      <Panel
        title="평형"
        count={complex.areaTypes.length}
        description="전용면적이 실거래 신고 면적과 같아야 실거래가가 연결돼요"
        flush
        actions={
          <Button
            size="sm"
            iconLeft={<Icon name="plus" size={16} />}
            onClick={() => setEditing({ mode: 'create' })}
          >
            평형 추가
          </Button>
        }
      >
        <DataTable
          caption={`${complex.name} 평형 목록`}
          columns={columns}
          rows={complex.areaTypes}
          rowKey={(a) => a.id}
          empty={
            <EmptyState
              compact
              icon="layers"
              title="등록된 평형이 없어요"
              description="평형이 있어야 매물 등록과 실거래가 연결이 돼요."
              action={
                <Button size="sm" onClick={() => setEditing({ mode: 'create' })}>
                  첫 평형 추가
                </Button>
              }
            />
          }
          card={(a) => (
            <>
              <div className={cardStyles.cardRow}>
                {typeCell(a)}
                <div className={cardStyles.cardActions}>{actions(a)}</div>
              </div>
              <div className={cardStyles.cardMeta}>
                <span>전용 {a.exclusiveArea.toFixed(2)}㎡</span>
                {a.supplyArea !== null && <span>공급 {a.supplyArea.toFixed(2)}㎡</span>}
                {a.households !== null && <span>{formatCount(a.households)}세대</span>}
                <span>실거래 {formatCount(a.tradeCount)}건</span>
                {a.lastSalePrice !== null && <span>최근 {formatManwon(a.lastSalePrice)}</span>}
              </div>
            </>
          )}
        />
      </Panel>

      <AreaTypeDrawer
        complexId={complex.id}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void queryClient.invalidateQueries({ queryKey: ['admin-complexes', 'list'] });
          onChanged();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        title="평형을 삭제할까요?"
        description={
          deleting
            ? deleting.tradeCount > 0
              ? `${name(deleting)} ${deleting.typeName} 평형에 연결된 실거래 ${formatCount(deleting.tradeCount)}건이 '평형 미연결' 상태가 돼요.`
              : `${name(deleting)} ${deleting.typeName} 평형을 삭제해요.`
            : undefined
        }
        confirmLabel="삭제"
        danger
        loading={remove.isPending}
      />
    </>
  );
}
