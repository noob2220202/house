import { ErrorCode, INQUIRY_LIMITS } from '@house/shared';
import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import type { DailyCapService } from '../../../common/throttle/daily-cap.service';
import { DAILY_CAPS, type DailyCapKey } from '../../../common/throttle/throttle.constants';

// Compile-time guard: the shared limit (shown by the forms) and the enforced cap agree.
const sameCap: typeof INQUIRY_LIMITS.DAILY_CAP = DAILY_CAPS.INQUIRY_CREATE;
void sameCap;

/**
 * DailyCapService answers RATE_LIMITED; the inquiry routes answer their own 429 code so the form
 * can tell "try again tomorrow" apart from the per-minute throttle.
 */
export async function consumeInquiryCap(
  caps: DailyCapService,
  key: Extract<DailyCapKey, 'INQUIRY_CREATE' | 'INQUIRY_FOLLOW_UP'>,
  subject: string,
  now: Date,
): Promise<void> {
  try {
    await caps.consume(key, subject, now);
  } catch (err) {
    if (err instanceof AppException && err.code === ErrorCode.RATE_LIMITED) {
      throw new AppException(ErrorCode.INQUIRY_DAILY_LIMIT, {
        status: HttpStatus.TOO_MANY_REQUESTS,
        details: { limit: DAILY_CAPS[key] },
      });
    }
    throw err;
  }
}
