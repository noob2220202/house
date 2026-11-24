import { BANNER_SLOT_SPECS, BannerStatus, type BannerSlot } from '@house/shared';
import { bannerState, slotBanners, statusOf } from '../banners/_store';

/** Slot row: spec (BANNER_SLOT_SPECS) + the effective limit (banner_slot_configs) + live counts. */
export function toSlotRow(slot: BannerSlot) {
  const spec = BANNER_SLOT_SPECS[slot];
  const banners = slotBanners(slot);
  const count = (status: BannerStatus) => banners.filter((b) => statusOf(b) === status).length;
  return {
    slot,
    label: spec.label,
    maxActive: bannerState().maxActive[slot],
    defaultMaxActive: spec.maxActive,
    pc: spec.pc,
    mobile: spec.mobile,
    activeCount: count(BannerStatus.ACTIVE),
    scheduledCount: count(BannerStatus.SCHEDULED),
    pausedCount: count(BannerStatus.PAUSED),
    totalCount: banners.length,
  };
}
