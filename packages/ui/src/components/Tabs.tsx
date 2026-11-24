'use client';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Tabs.module.css';
import { cx } from '../lib/cx';
import { useControllable } from '../lib/hooks';
import type { LinkAs } from '../lib/types';

export interface TabItem<T extends string = string> {
  value: T;
  label: ReactNode;
  /** Brand-coloured count after the label. */
  count?: number | string;
  /** When set the tab is a link (navigation tabs) and `aria-current="page"` marks the active one. */
  href?: string;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  /** Accessible name of the tab list. */
  label: string;
  items: readonly TabItem<T>[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  /** Prefix for tab/panel ids: tab id = `${idBase}-tab-${value}`, panel id = `${idBase}-panel-${value}`. */
  idBase?: string;
  linkAs?: LinkAs;
  className?: string;
}

/** Underline tabs (`.tabs`). Button tabs follow the WAI-ARIA tabs pattern; link tabs render a <nav>. */
export function Tabs<T extends string = string>({
  label,
  items,
  value,
  defaultValue,
  onChange,
  idBase,
  linkAs,
  className,
}: TabsProps<T>) {
  const [current, setCurrent] = useControllable<T | undefined>(
    value,
    defaultValue ?? items[0]?.value,
    (v) => {
      if (v !== undefined) onChange?.(v);
    },
  );
  const ref = useRef<HTMLDivElement>(null);
  const asLinks = items.some((i) => i.href !== undefined);

  if (asLinks) {
    const Comp = linkAs ?? 'a';
    return (
      <nav aria-label={label} className={cx(styles.tabs, className)}>
        {items.map((i) => {
          const on = i.value === current;
          const props = {
            href: i.href ?? '#',
            className: cx(styles.tab, on && styles.on),
            'aria-current': on ? ('page' as const) : undefined,
          };
          return (
            <Comp key={i.value} {...props}>
              {i.label}
              {i.count !== undefined && <span className={styles.count}>{i.count}</span>}
            </Comp>
          );
        })}
      </nav>
    );
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.filter((i) => !i.disabled);
    const idx = enabled.findIndex((i) => i.value === current);
    let next: TabItem<T> | undefined;
    if (e.key === 'ArrowRight') next = enabled[(idx + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(idx - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (!next) return;
    e.preventDefault();
    setCurrent(next.value);
    ref.current
      ?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(next.value)}"]`)
      ?.focus();
  };

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      className={cx(styles.tabs, className)}
      onKeyDown={onKeyDown}
    >
      {items.map((i) => {
        const on = i.value === current;
        return (
          <button
            key={i.value}
            type="button"
            role="tab"
            id={idBase ? `${idBase}-tab-${i.value}` : undefined}
            aria-controls={idBase ? `${idBase}-panel-${i.value}` : undefined}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            data-value={i.value}
            disabled={i.disabled}
            className={cx(styles.tab, on && styles.on)}
            onClick={() => setCurrent(i.value)}
          >
            {i.label}
            {i.count !== undefined && <span className={styles.count}>{i.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps {
  idBase: string;
  value: string;
  /** Currently selected tab value; the panel renders only when it matches. */
  current: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ idBase, value, current, children, className }: TabPanelProps) {
  if (value !== current) return null;
  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${value}`}
      aria-labelledby={`${idBase}-tab-${value}`}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
