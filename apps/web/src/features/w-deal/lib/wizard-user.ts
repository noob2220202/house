import { formatPhone } from '@house/shared';
import type { SessionUser } from '@/lib/auth';
import type { WizardUser } from '../components/form/useWizard';

/** Session user → the bits the wizards need (contact prefill comes from the profile). */
export function toWizardUser(user: SessionUser): WizardUser {
  return {
    id: user.id,
    displayName: user.nickname,
    contactName: user.name ?? '',
    contactPhone: user.phone ? formatPhone(user.phone) : '',
  };
}
