import { ERROR_MESSAGES, BannerStatus, type BannerCreateInput } from '@house/shared';
import { mockError } from '@/lib/mock';
import { agencyById } from '../../agencies/_fixtures';
import { getMedia } from '../media/_store';
import { activeCount, bannerState, statusOf, type MockBanner } from './_store';

const fieldError = (path: string, message: string) =>
  mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [{ path, message }]);

/** Checks shared by create and update (media exist, agency exists, slot limit); error Response or null. */
export function checkBannerInput(input: BannerCreateInput, self?: MockBanner): Response | null {
  if (!getMedia(input.pcMediaId)) return fieldError('pcMediaId', '이미지를 다시 올려 주세요.');
  if (input.mobileMediaId && !getMedia(input.mobileMediaId))
    return fieldError('mobileMediaId', '이미지를 다시 올려 주세요.');
  if (input.agencyId && !agencyById(input.agencyId))
    return fieldError('agencyId', '중개사무소를 찾을 수 없습니다.');
  const willBeActive = statusOf(input) === BannerStatus.ACTIVE;
  const wasActive = !!self && self.slot === input.slot && statusOf(self) === BannerStatus.ACTIVE;
  if (
    willBeActive &&
    !wasActive &&
    activeCount(input.slot, self?.id) >= bannerState().maxActive[input.slot]
  )
    return mockError(409, 'BANNER_SLOT_FULL', ERROR_MESSAGES.BANNER_SLOT_FULL);
  return null;
}
