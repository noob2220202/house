'use client';
import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import type { VerificationInput } from '../api/queries';
import type {
  AgencyListing,
  AgencyListingAgency,
  AgencyListingVerification,
  ComplexForListing,
} from '../api/schemas';
import type { FormField } from '../lib/form';
import type { PhotoValue } from '../lib/photos';

/** Everything the step components need besides the react-hook-form context. */
export interface WizardContextValue {
  /** Last saved server state (null until the draft is first saved). */
  listing: AgencyListing | null;
  /** Complex of the chosen 단지 (pre-fill source), null for non-complex listings. */
  complex: ComplexForListing | null;
  setComplex: (complex: ComplexForListing | null) => void;
  photos: PhotoValue[];
  setPhotos: Dispatch<SetStateAction<PhotoValue[]>>;
  /** Number of uploads in flight (saving waits for them). */
  setUploading: (count: number) => void;
  verifications: readonly AgencyListingVerification[];
  /** Saves the draft if needed, then records a 실매물 확인. Resolves false on failure. */
  addVerification: (input: VerificationInput) => Promise<boolean>;
  /** Offices for the disclosure block of the preview (the caller's office first for new drafts). */
  agencies: readonly AgencyListingAgency[];
  goToStep: (index: number) => void;
  goToField: (field: FormField) => void;
  /** Published listings keep their asset type. */
  assetLocked: boolean;
  busy: boolean;
}

export const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard(): WizardContextValue {
  const value = useContext(WizardContext);
  if (!value) throw new Error('useWizard must be used inside <ListingWizard>');
  return value;
}
