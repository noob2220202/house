import type { UseFormReturn } from 'react-hook-form';
import type { AddressMatch } from '../../api/schemas';
import type { SellFormValues } from '../../lib/sell-form';

/** What every 내놓기 step component receives from the wizard. */
export interface SellStepProps {
  form: UseFormReturn<SellFormValues>;
  /** Live form values. */
  v: SellFormValues;
  /** Error message of a field (undefined when valid). */
  err: (name: keyof SellFormValues) => string | undefined;
  /** setValue for custom controls: marks dirty and re-validates the field. */
  set: <K extends keyof SellFormValues>(key: K, value: SellFormValues[K]) => void;
  /** Validate one field (on blur). */
  touch: (key: keyof SellFormValues) => void;
  /** Complex matched from the address (when the asset type belongs to a complex). */
  complex: NonNullable<AddressMatch['complex']> | null;
}
