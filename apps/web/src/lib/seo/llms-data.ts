import 'server-only';
import { ApiError } from '@/lib/api/errors';
import { getPublicSiteSettings } from '@/lib/site/settings';
import { getSeoRegionIndex, getTradeReport } from './api';
import type { LlmsInput } from './llms';

const orNull = <T>(p: Promise<T>): Promise<T | null> =>
  p.catch((error: unknown) => {
    if (error instanceof ApiError) return null;
    throw error;
  });

/** Live inputs of /llms.txt: sections whose data is unavailable are simply left out. */
export async function llmsInput(): Promise<LlmsInput> {
  const [index, report, settings] = await Promise.all([
    orNull(getSeoRegionIndex()),
    orNull(getTradeReport()),
    getPublicSiteSettings(),
  ]);
  const phone = settings.CONTACT?.phone || settings.BUSINESS_INFO?.phone || null;
  const email = settings.CONTACT?.email || settings.BUSINESS_INFO?.email || null;
  return { index, report, contact: { phone, email } };
}
