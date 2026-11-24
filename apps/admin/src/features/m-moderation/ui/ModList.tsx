'use client';
import {
  Button,
  EmptyState,
  ErrorState,
  FilterDropdown,
  Icon,
  LoadingRegion,
  Pagination,
  RadioGroup,
  Skeleton,
  Table,
  Tabs,
  type IconName,
  type TabItem,
  type TableColumn,
} from '@house/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { errorMessage } from '@/lib/api';
import { formatCount } from '@/lib/format';
import s from './ui.module.css';
import { pageRange } from '../lib/list-params';

// ---------- head: tabs + search ----------------------------------------------------------------

export interface ListHeadProps<T extends string> {
  label: string;
  tabs: readonly TabItem<T>[];
  current: T;
  /** Right side: search box, buttons. */
  children?: ReactNode;
}

/** Status tabs (links → URL state) with the search box on the right, per AdminBanners. */
export function ListHead<T extends string>({ label, tabs, current, children }: ListHeadProps<T>) {
  return (
    <div className={s.head}>
      <Tabs label={label} items={tabs} value={current} linkAs={Link} />
      {children && <div className={s.headSide}>{children}</div>}
    </div>
  );
}

// ---------- filters ---------------------------------------------------------------------------

export interface FilterSelectProps<T extends string> {
  field: string;
  /** Options; the one with value '' is the "전체" choice. */
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  width?: number;
}

/** Single-choice filter chip (chip + popover with 초기화 / 적용), per the design system. */
export function FilterSelect<T extends string>({
  field,
  options,
  value,
  onChange,
  width = 260,
}: FilterSelectProps<T>) {
  const [draft, setDraft] = useState(value);
  const current = options.find((o) => o.value === value);
  const first = options[0]?.value ?? value;
  return (
    <FilterDropdown
      field={field}
      valueLabel={current?.label ?? '전체'}
      active={value !== first}
      width={width}
      onOpen={() => setDraft(value)}
      onReset={() => setDraft(first)}
      onApply={() => {
        if (draft !== value) onChange(draft);
      }}
    >
      <RadioGroup
        label={field}
        hideLabel
        name={`filter-${field}`}
        options={options}
        value={draft}
        onChange={setDraft}
        direction="column"
        className={s.optionList}
      />
    </FilterDropdown>
  );
}

export function ResetFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={s.resetBtn} onClick={onClick}>
      <Icon name="refresh" size={14} />
      필터 초기화
    </button>
  );
}

// ---------- table + mobile cards --------------------------------------------------------------

export interface ModListProps<T> {
  caption: string;
  columns: readonly TableColumn<T>[];
  rowKey: (row: T) => string;
  /** Detail page of a row — the whole row / card opens it. */
  rowHref: (row: T) => string;
  /** Mobile (≤ 720px) card body for a row. Use <ModCard> parts. */
  renderCard: (row: T) => ReactNode;
  data:
    | { items: T[]; page: number; pageSize: number; total: number; totalPages: number }
    | undefined;
  isPending: boolean;
  /** True while a refetch for new params is running and stale rows are shown. */
  isFetching?: boolean;
  error: unknown;
  onRetry: () => void;
  /** Counter word for the footer: "건", "곳", "명". */
  unit?: string;
  /** Text after the range in the footer ("신청일 오래된 순"). */
  footerNote?: string;
  empty: { icon?: IconName; title: string; description?: string; action?: ReactNode };
  hrefForPage: (page: number) => string;
}

/**
 * Data view of every moderation list: @house/ui Table on desktop, stacked cards on mobile, with
 * loading skeletons, an empty state, an error state (retry) and the range + pagination footer.
 */
export function ModList<T>({
  caption,
  columns,
  rowKey,
  rowHref,
  renderCard,
  data,
  isPending,
  isFetching,
  error,
  onRetry,
  unit = '건',
  footerNote,
  empty,
  hrefForPage,
}: ModListProps<T>) {
  const router = useRouter();
  if (error && !data) {
    return (
      <ErrorState
        compact
        title="목록을 불러오지 못했어요"
        description={errorMessage(error)}
        onRetry={onRetry}
      />
    );
  }
  const rows = data?.items ?? [];
  // A page past the end (old link, or rows moved out of the tab after an action).
  const outOfRange = !!data && rows.length === 0 && data.total > 0;
  const emptyNode = outOfRange ? (
    <EmptyState
      compact
      icon="list"
      title="이 페이지에는 항목이 없어요"
      description="목록이 바뀌어 페이지 수가 줄었어요."
      action={
        <Button size="sm" variant="secondary" href={hrefForPage(1)} linkAs={Link}>
          첫 페이지로
        </Button>
      }
    />
  ) : (
    <EmptyState
      compact
      icon={empty.icon ?? 'search'}
      title={empty.title}
      description={empty.description}
      action={empty.action}
    />
  );
  const [from, to] = data ? pageRange(data.page, data.pageSize, data.total) : [0, 0];

  return (
    <div
      aria-busy={isFetching || undefined}
      style={isFetching && !isPending ? { opacity: 0.6 } : undefined}
    >
      <div className="only-lg">
        <Table
          bare
          caption={caption}
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          loading={isPending}
          loadingRows={6}
          empty={emptyNode}
          onRowClick={(row) => router.push(rowHref(row))}
        />
      </div>
      <div className="only-sm">
        {isPending ? (
          <LoadingRegion>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={s.cardSkeleton}>
                <Skeleton height={16} width="60%" />
                <Skeleton height={13} width="85%" />
                <Skeleton height={13} width="40%" />
              </div>
            ))}
          </LoadingRegion>
        ) : rows.length === 0 ? (
          emptyNode
        ) : (
          <ul className={s.cards} aria-label={caption}>
            {rows.map((row) => (
              <li key={rowKey(row)} className={s.card}>
                {renderCard(row)}
              </li>
            ))}
          </ul>
        )}
      </div>
      {data && data.total > 0 && !outOfRange && (
        <div className={s.listFoot}>
          <span>
            {formatCount(data.total)}
            {unit} 중{' '}
            <strong className={s.num}>
              {from}–{to}
            </strong>
            {footerNote ? ` · ${footerNote}` : ''}
          </span>
          {data.totalPages > 1 && (
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              hrefFor={hrefForPage}
              linkAs={Link}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Stops row navigation for controls inside a clickable table row. */
export function RowActions({ children }: { children: ReactNode }) {
  return (
    // The wrapper only swallows the bubbling click; the controls inside are real buttons/links.
    <span className={s.rowActions} onClick={(e) => e.stopPropagation()}>
      {children}
    </span>
  );
}

/** Title link of a table row (keyboard / screen-reader path to the detail page). */
export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={s.cellTitle} onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  );
}

export interface ModCardProps {
  href: string;
  title: ReactNode;
  /** Status pill etc. at the top right. */
  badge?: ReactNode;
  /** Small lines under the title. */
  meta?: ReactNode;
  children?: ReactNode;
  /** Buttons at the bottom (stay clickable above the stretched link). */
  actions?: ReactNode;
}

/** Mobile list card: the title link stretches over the whole card. */
export function ModCard({ href, title, badge, meta, children, actions }: ModCardProps) {
  return (
    <>
      <div className={s.cardTop}>
        <Link href={href} className={s.cardTitle}>
          {title}
        </Link>
        {badge}
      </div>
      {children}
      {meta && <div className={s.cardMeta}>{meta}</div>}
      {actions && <div className={s.cardActions}>{actions}</div>}
    </>
  );
}
