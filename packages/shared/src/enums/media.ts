import type { EnumValue } from './define';

export const MediaVisibility = {
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
} as const;
export type MediaVisibility = EnumValue<typeof MediaVisibility>;

export const MediaStatus = {
  PENDING: 'PENDING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;
export type MediaStatus = EnumValue<typeof MediaStatus>;

export const MediaPurpose = {
  LISTING_PHOTO: 'LISTING_PHOTO',
  COMPLEX_PHOTO: 'COMPLEX_PHOTO',
  DEAL_REQUEST_PHOTO: 'DEAL_REQUEST_PHOTO',
  AGENCY_LOGO: 'AGENCY_LOGO',
  /** Wide header image of the agency's public page (public, like the logo). */
  AGENCY_COVER: 'AGENCY_COVER',
  AGENCY_DOCUMENT: 'AGENCY_DOCUMENT',
  BANNER: 'BANNER',
  POPUP: 'POPUP',
  CONTENT: 'CONTENT',
  PROFILE: 'PROFILE',
} as const;
export type MediaPurpose = EnumValue<typeof MediaPurpose>;

/** Purposes whose files are private (outside the public media root). */
export const PRIVATE_MEDIA_PURPOSES: readonly MediaPurpose[] = [MediaPurpose.AGENCY_DOCUMENT];
