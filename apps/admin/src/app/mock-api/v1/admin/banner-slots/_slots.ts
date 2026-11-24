import { BANNER_SLOT_SPECS, BannerStatus, type BannerSlot } from '@house/shared';
import { bannerState, slotBanners, statusOf } from '../banners/_store';

/**
 * Shared `BannerSlotView`: spec (BANNER_SLOT_SPECS) + the effective limit (banner_slot_configs) +
 * live (`activeCount`) and live-or-scheduled (`upcomingCount`) counts.
 */
export function toSlotRow(slot: BannerSlot) {
  const spec = BANNER_SLOT_SPECS[slot];
  const banners = slotBanners(slot);
  const count = (status: BannerStatus) => banners.filter((b) => statusOf(b) === status).length;
  return {
    slot,
    label: spec.label,
    pc: spec.pc,
    mobile: spec.mobile,
    maxActive: bannerState().maxActive[slot],
    defaultMaxActive: spec.maxActive,
    isEnabled: true,
    note: null,
    requiresAgency: spec.requiresAgency,
    requiredTargeting: spec.requiredTargeting,
    activeCount: count(BannerStatus.ACTIVE),
    upcomingCount: count(BannerStatus.ACTIVE) + count(BannerStatus.SCHEDULED),
  };
}
