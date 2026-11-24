import styles from './PhotoPlaceholder.module.css';
import { cx } from '../lib/cx';
import { GENERATED_PHOTO_ART } from '../art/photos.generated';

export type PhotoKind = keyof typeof GENERATED_PHOTO_ART;
export const PHOTO_KINDS = Object.keys(GENERATED_PHOTO_ART) as PhotoKind[];

export interface PhotoPlaceholderProps {
  /** tower (아파트) · villa (주택/빌라) · shop (상가) · land (토지) · room (원룸 실내) · office (중개사무소, square) */
  kind?: PhotoKind;
  /** Accessible description; omit when decorative (default). */
  label?: string;
  className?: string;
}

/** Branded illustration shown when a listing/complex/agency has no photo. Fills its (positioned) parent. */
export function PhotoPlaceholder({ kind = 'tower', label, className }: PhotoPlaceholderProps) {
  const art = GENERATED_PHOTO_ART[kind];
  return (
    <svg
      className={cx(styles.photo, className)}
      viewBox={art.viewBox}
      preserveAspectRatio="xMidYMid slice"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {art.node}
    </svg>
  );
}

/** Maps a backend AssetType (APT/OFFICETEL/ONEROOM/HOUSE/COMMERCIAL/LAND) to a placeholder illustration. */
export function photoKindForAsset(assetType: string): PhotoKind {
  switch (assetType.toUpperCase()) {
    case 'ONEROOM':
      return 'room';
    case 'HOUSE':
      return 'villa';
    case 'COMMERCIAL':
      return 'shop';
    case 'LAND':
      return 'land';
    default:
      return 'tower';
  }
}
