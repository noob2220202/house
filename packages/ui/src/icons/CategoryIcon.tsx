import type { SVGProps } from 'react';
import { GENERATED_CATEGORY_PATHS } from './category.generated';
import styles from './CategoryIcon.module.css';
import { cx } from '../lib/cx';

export type CategoryIconName = keyof typeof GENERATED_CATEGORY_PATHS;

export interface CategoryIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  /** apt = 아파트·분양권, room = 원룸·투룸, house = 주택, biz = 상업·업무, land = 토지 */
  name: CategoryIconName;
  size?: number;
}

/** Category line icon with one cobalt detail. */
export function CategoryIcon({ name, size = 28, className, ...rest }: CategoryIconProps) {
  return (
    <svg
      className={cx(styles.icon, className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {GENERATED_CATEGORY_PATHS[name]}
    </svg>
  );
}

export interface CategoryTileProps {
  name: CategoryIconName;
  /** Tile edge in px (56 desktop, 44–48 mobile). */
  size?: number;
  className?: string;
}

/** 56px rounded tile holding a category icon (`.cat-tile`). */
export function CategoryTile({ name, size = 56, className }: CategoryTileProps) {
  return (
    <span className={cx(styles.tile, className)} style={{ width: size, height: size }}>
      <CategoryIcon name={name} size={Math.round(size / 2)} />
    </span>
  );
}
