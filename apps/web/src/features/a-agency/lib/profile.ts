import { normalizePhone } from '@house/shared';
import type { AgencyProfilePatch } from '../api/queries';
import type { Media, MyAgency, ProfileFormValues } from '../api/schemas';
import { sameBusinessHours, type BusinessHours } from './business-hours';

export interface ProfileDraft {
  /** Current form values. */
  values: ProfileFormValues;
  hours: BusinessHours;
  logo: Media | null;
  cover: Media | null;
}

type SavedProfile = Pick<
  MyAgency,
  'intro' | 'phone' | 'mobile' | 'specialties' | 'businessHours' | 'logo' | 'cover'
>;

const digits = (v: string | null | undefined) => normalizePhone(v ?? '');

/**
 * PATCH body with only the fields that differ from the saved profile — unchanged fields are never
 * sent, and nothing is sent as `null` except a deliberate clear (mobile / logo / cover / hours).
 * `specialties` always goes along: the shared update schema would otherwise default it to [].
 */
export function buildProfilePatch(saved: SavedProfile, draft: ProfileDraft): AgencyProfilePatch {
  const { values } = draft;
  const patch: AgencyProfilePatch = { specialties: values.specialties };

  const intro = values.intro.trim();
  if (intro !== (saved.intro ?? '').trim()) patch.intro = intro;

  const phone = values.phone.trim();
  if (digits(phone) !== digits(saved.phone)) patch.phone = phone;

  const mobile = values.mobile.trim();
  if (digits(mobile) !== digits(saved.mobile)) patch.mobile = mobile === '' ? null : mobile;

  if (!sameBusinessHours(draft.hours, saved.businessHours)) patch.businessHours = draft.hours;

  const logoId = draft.logo?.id ?? null;
  if (logoId !== (saved.logo?.id ?? null)) patch.logoMediaId = logoId;

  const coverId = draft.cover?.id ?? null;
  if (coverId !== (saved.cover?.id ?? null)) patch.coverMediaId = coverId;

  return patch;
}

/**
 * Parts of a PATCH that the response does not reflect (an API that strips unknown keys answers 200
 * but drops them). Returns Korean labels for the error toast; [] when everything persisted.
 */
export function unpersistedProfileFields(patch: AgencyProfilePatch, saved: SavedProfile): string[] {
  const lost: string[] = [];
  if (
    patch.businessHours !== undefined &&
    !sameBusinessHours(patch.businessHours, saved.businessHours)
  ) {
    lost.push('영업시간');
  }
  if (patch.logoMediaId !== undefined && patch.logoMediaId !== (saved.logo?.id ?? null)) {
    lost.push('로고');
  }
  if (patch.coverMediaId !== undefined && patch.coverMediaId !== (saved.cover?.id ?? null)) {
    lost.push('커버 사진');
  }
  if (patch.intro !== undefined && patch.intro !== (saved.intro ?? '').trim()) lost.push('소개');
  if (patch.mobile !== undefined && digits(patch.mobile) !== digits(saved.mobile)) {
    lost.push('휴대폰 번호');
  }
  return lost;
}
