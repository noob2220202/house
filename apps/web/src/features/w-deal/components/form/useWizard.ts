'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { clearDraft, draftKey, readDraft, writeDraft, type DraftKind } from '../../lib/draft';
import type { ContactScopeValues } from '../../lib/form-common';

export interface WizardUser {
  id: string;
  /** Display name for the "로그인됨" row. */
  displayName: string;
  /** Prefill for 연락받을 이름. */
  contactName: string;
  /** Prefill for the phone field (formatted), '' when the profile has none. */
  contactPhone: string;
}

export interface UseWizardOptions<T extends FieldValues & ContactScopeValues> {
  kind: DraftKind;
  user: WizardUser;
  form: UseFormReturn<T>;
  defaults: T;
  /** Fields validated when leaving each step (last entry = review step, usually empty). */
  stepFields: readonly (readonly (keyof T & string)[])[];
  /** Repairs restored draft values (e.g. a value an older version allowed). */
  normalize?: (values: T) => T;
}

export interface WizardState {
  /** False until the draft has been read on the client (render a skeleton meanwhile). */
  ready: boolean;
  step: number;
  lastStep: number;
  /** True when a saved draft was restored on mount. */
  restored: boolean;
  savedAt: string | null;
  /** Validate the current step and advance; focuses the first invalid control otherwise. */
  next: () => Promise<boolean>;
  prev: () => void;
  goTo: (step: number) => void;
  /** Throw the draft away and start over. */
  reset: () => void;
  /** Remove the draft after a successful submit. */
  finish: () => void;
  /** Attach to the <form> so step changes can scroll/focus it. */
  formRef: React.RefObject<HTMLFormElement | null>;
}

/**
 * setValue for custom (non-registered) controls with a typed top-level key: marks the field dirty and
 * touched and optionally re-validates it.
 */
export function setField<T extends FieldValues, K extends keyof T & string>(
  form: UseFormReturn<T>,
  key: K,
  value: T[K],
  validate: boolean,
): void {
  form.setValue(key as unknown as Path<T>, value, {
    shouldDirty: true,
    shouldTouch: true,
    shouldValidate: validate,
  });
}

/** Focuses the first control flagged invalid inside `root` (or the first error message's row). */
export function focusFirstError(root: HTMLElement | null): void {
  if (!root) return;
  const invalid = root.querySelector<HTMLElement>('[aria-invalid="true"]');
  const target =
    invalid?.matches('input,select,textarea,button') === true
      ? invalid
      : (invalid?.querySelector<HTMLElement>('input,select,textarea,button') ??
        root
          .querySelector<HTMLElement>('[data-field-error]')
          ?.parentElement?.querySelector<HTMLElement>('input,select,textarea,button') ??
        null);
  if (target) {
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } else {
    root.querySelector('[data-field-error]')?.scrollIntoView({ block: 'center' });
  }
}

/**
 * Wizard plumbing shared by 내놓기 and 구하기: step state, per-step validation, and the localStorage
 * draft (restored after mount, autosaved 500ms after every change, cleared on submit).
 */
export function useWizard<T extends FieldValues & ContactScopeValues>({
  kind,
  user,
  form,
  defaults,
  stepFields,
  normalize,
}: UseWizardOptions<T>): WizardState {
  const key = draftKey(kind, user.id);
  const lastStep = stepFields.length - 1;
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const stepRef = useRef(0);
  /** True once a draft exists in storage (restored or saved) — step changes are only persisted then. */
  const hasDraftRef = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const { reset: resetForm, watch, getValues, trigger, getFieldState } = form;
  const normalizeRef = useRef(normalize);

  const withPrefill = useCallback(
    (values: T): T => ({
      ...values,
      contactName: values.contactName || user.contactName,
      contactPhone: values.contactPhone || user.contactPhone,
    }),
    [user.contactName, user.contactPhone],
  );

  // Restore the draft once (client only — localStorage is not available during SSR).
  useEffect(() => {
    const draft = readDraft(key, defaults);
    const values = draft?.values ?? defaults;
    resetForm(withPrefill(normalizeRef.current ? normalizeRef.current(values) : values));
    if (draft) {
      const s = Math.min(draft.step, lastStep);
      stepRef.current = s;
      setStep(s);
      setSavedAt(draft.savedAt);
      setRestored(true);
      hasDraftRef.current = true;
    }
    setReady(true);
  }, [key, defaults, lastStep, resetForm, withPrefill]);

  const save = useCallback(() => {
    const at = writeDraft(key, stepRef.current, getValues());
    if (at) {
      hasDraftRef.current = true;
      setSavedAt(at);
    }
  }, [key, getValues]);

  // Autosave (debounced) on every user change.
  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = watch((_values, info) => {
      if (!info.name) return; // reset() — nothing typed
      clearTimeout(timer);
      timer = setTimeout(save, 500);
    });
    return () => {
      sub.unsubscribe();
      if (timer) {
        clearTimeout(timer);
        save();
      }
    };
  }, [ready, watch, save]);

  // A field that shows an error re-validates on every change, so the message clears while typing
  // instead of on blur — otherwise the blur on mousedown of the next control removes the message,
  // the layout shifts and that click is lost. (The wizard never calls handleSubmit, so
  // react-hook-form's own reValidateMode does not kick in for fields the user has not blurred.)
  useEffect(() => {
    if (!ready) return;
    const sub = watch((_values, { name }) => {
      if (name && getFieldState(name).invalid) void trigger(name);
    });
    return () => sub.unsubscribe();
  }, [ready, watch, trigger, getFieldState]);

  const goTo = useCallback(
    (target: number) => {
      const s = Math.max(0, Math.min(target, lastStep));
      const moved = s !== stepRef.current;
      stepRef.current = s;
      setStep(s);
      if (moved && hasDraftRef.current) save();
      requestAnimationFrame(() => {
        const el = formRef.current;
        if (!el) return;
        el.scrollIntoView({ block: 'start', behavior: 'auto' });
        el.querySelector<HTMLElement>('[data-step-heading]')?.focus({ preventScroll: true });
      });
    },
    [lastStep, save],
  );

  const next = useCallback(async () => {
    const fields = stepFields[stepRef.current] ?? [];
    const ok = fields.length === 0 || (await trigger(fields as unknown as Path<T>[]));
    if (!ok) {
      requestAnimationFrame(() => focusFirstError(formRef.current));
      return false;
    }
    save();
    goTo(stepRef.current + 1);
    return true;
  }, [stepFields, trigger, goTo, save]);

  const prev = useCallback(() => goTo(stepRef.current - 1), [goTo]);

  const reset = useCallback(() => {
    clearDraft(key);
    hasDraftRef.current = false;
    resetForm(withPrefill(defaults));
    setSavedAt(null);
    setRestored(false);
    stepRef.current = 0;
    setStep(0);
  }, [key, defaults, resetForm, withPrefill]);

  const finish = useCallback(() => clearDraft(key), [key]);

  return { ready, step, lastStep, restored, savedAt, next, prev, goTo, reset, finish, formRef };
}
