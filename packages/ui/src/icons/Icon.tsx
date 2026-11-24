import type { ReactNode, SVGProps } from 'react';
import { GENERATED_ICON_PATHS } from './paths.generated';

/** Extra icons drawn in the same language (24 grid · stroke 1.75 · currentColor). */
const EXTRA_ICON_PATHS = {
  'chevron-up': <path d="m6 15 6-6 6 6" />,
  'arrow-left': (
    <>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </>
  ),
  'arrow-up': (
    <>
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </>
  ),
  'arrow-down': (
    <>
      <path d="M12 5v14" />
      <path d="m6 13 6 6 6-6" />
    </>
  ),
  swap: (
    <>
      <path d="M7 4.5v15" />
      <path d="m3.5 8 3.5-3.5L10.5 8" />
      <path d="M17 19.5v-15" />
      <path d="m13.5 16 3.5 3.5 3.5-3.5" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  share: (
    <>
      <circle cx="6.5" cy="12" r="2.5" />
      <circle cx="17" cy="6" r="2.5" />
      <circle cx="17" cy="18" r="2.5" />
      <path d="m8.7 10.8 6.1-3.5M8.7 13.2l6.1 3.5" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
    </>
  ),
  more: <path d="M5.5 12h.01M12 12h.01M18.5 12h.01" strokeWidth="3" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 21 19.5H3z" />
      <path d="M12 10v4.5M12 17h.01" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5a2 2 0 0 1 2-2h2l1.5-2h5L16 6.5h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 7.5 8 6 8-6" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  download: (
    <>
      <path d="M12 4.5V16" />
      <path d="m7 11.5 5 5 5-5" />
      <path d="M4.5 15v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15" />
    </>
  ),
  bookmark: <path d="M6.5 4.5h11v15.5L12 16.5 6.5 20z" />,
  'x-circle': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </>
  ),
  expand: <path d="M14 4.5h5.5V10M10 19.5H4.5V14M19.5 4.5 13 11M4.5 19.5 11 13" />,
  document: (
    <>
      <path d="M6.5 3.5h7l4 4v13h-11z" />
      <path d="M13.5 3.5v4h4M9.5 12h5M9.5 15.5h5" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8.5-8.5M16 7l2.5 2.5M13.5 9.5 15.5 11.5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export const ICON_PATHS = { ...GENERATED_ICON_PATHS, ...EXTRA_ICON_PATHS };
export type IconName = keyof typeof ICON_PATHS;
export const ICON_NAMES = Object.keys(ICON_PATHS) as IconName[];

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  /** px size (width = height). Default 24. */
  size?: number;
  /** Accessible label. Omit for decorative icons (aria-hidden). */
  label?: string;
  /** Fill the shape with currentColor (e.g. a "liked" heart). */
  filled?: boolean;
}

/** Stroke icon from the design system set. Decorative by default. */
export function Icon({ name, size = 24, label, filled, style, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={{ flex: 'none', display: 'block', ...style }}
      {...rest}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
