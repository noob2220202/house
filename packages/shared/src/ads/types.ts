import type { BannerSlot, BannerStatus, BannerTargeting, PopupPage } from '../enums/ads';

/** Banner as served to the public site (only live banners are ever returned). */
export interface PublicBannerView {
  id: string;
  slot: BannerSlot;
  title: string;
  advertiserName: string | null;
  agency: { id: string; name: string } | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  /** Tracking redirect (`/api/v1/banners/:id/click`); null when the banner has no link. */
  clickUrl: string | null;
  newWindow: boolean;
}

export interface PublicPopupView {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  newWindow: boolean;
  /** "N일 동안 보지 않기" (0 = no dismiss option). */
  dismissDays: number;
  endAt: string;
}

export interface AdMediaView {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}

export interface AdminBannerView {
  id: string;
  slot: BannerSlot;
  title: string;
  advertiserName: string | null;
  agency: { id: string; name: string } | null;
  pcImage: AdMediaView;
  mobileImage: AdMediaView | null;
  linkUrl: string | null;
  newWindow: boolean;
  startAt: string;
  endAt: string;
  paused: boolean;
  status: BannerStatus;
  priority: number;
  sortOrder: number;
  targeting: BannerTargeting;
  targetRegionCodes: string[];
  targetComplexes: { id: string; name: string }[];
  memo: string | null;
  createdByAdminId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPopupView {
  id: string;
  title: string;
  image: AdMediaView;
  linkUrl: string | null;
  newWindow: boolean;
  targetPages: PopupPage[];
  startAt: string;
  endAt: string;
  paused: boolean;
  status: BannerStatus;
  dismissDays: number;
  sortOrder: number;
  createdByAdminId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BannerSlotView {
  slot: BannerSlot;
  label: string;
  pc: { width: number; height: number };
  mobile: { width: number; height: number } | null;
  /** Effective limit (config override or BANNER_SLOT_SPECS default). */
  maxActive: number;
  defaultMaxActive: number;
  isEnabled: boolean;
  note: string | null;
  /** Banners of the slot must name an (APPROVED) advertiser agency. */
  requiresAgency: boolean;
  /** Targeting every banner of the slot must use (null = any). */
  requiredTargeting: BannerTargeting | null;
  /** Banners live right now (not paused, inside their window). */
  activeCount: number;
  /** Banners not ended yet and not paused (live + scheduled). */
  upcomingCount: number;
}

export interface BannerStatPoint {
  date: string;
  impressions: number;
  clicks: number;
  /** Percent, two decimals. */
  ctr: number;
}

export interface BannerStatsView {
  bannerId: string;
  from: string;
  to: string;
  totals: { impressions: number; clicks: number; ctr: number };
  daily: BannerStatPoint[];
}
