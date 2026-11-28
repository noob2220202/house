'use client';
import {
  INQUIRY_LIMITS,
  InquiriesErrorCode,
  InquirySource,
  type InquiryCreated,
} from '@house/shared';
import {
  Button,
  Callout,
  Checkbox,
  ErrorState,
  FieldError,
  Icon,
  Input,
  SkeletonText,
  Textarea,
  cx,
} from '@house/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, type FormEvent, type Ref } from 'react';
import { ROUTES } from '@/config/nav';
import {
  ApiError,
  CONSENT_OUTDATED_MESSAGE,
  errorMessage,
  isConsentOutdatedError,
  shownConsents,
  type ActionTermsDocument,
} from '@/lib/api';
import { useActionTerms } from '@/lib/api/useActionTerms';
import { useSession } from '@/lib/auth';
import { loginUrl } from '@/lib/auth/paths';
import { formatDate, formatPhone } from '@/lib/format';
import { inquiryKeys, sendInquiry } from '../api';
import {
  EMPTY_INQUIRY_FORM,
  INQUIRY_STARTERS,
  appendStarter,
  firstErrorField,
  messageCounter,
  toInquiryBody,
  validateInquiryForm,
  type InquiryFormErrors,
  type InquiryFormField,
  type InquiryFormValues,
} from '../lib';
import styles from './inquiry.module.css';

const CONSENT_TITLE = '문의 개인정보 수집·이용 및 제공 동의';

function ConsentBox({
  id,
  docs,
  terms,
  checked,
  error,
  agencyName,
  onChange,
  inputRef,
}: {
  id: string;
  inputRef: Ref<HTMLInputElement>;
  docs: readonly ActionTermsDocument<'INQUIRY'>[] | undefined;
  terms: { isError: boolean; error: unknown; refetch: () => unknown };
  checked: boolean;
  error?: string;
  agencyName: string;
  onChange: (on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const doc = docs?.[0];
  const panelId = `${id}-notice`;
  if (!doc) {
    return terms.isError ? (
      <ErrorState
        compact
        title="동의 내용을 불러오지 못했어요"
        description={`${errorMessage(terms.error)} 내용을 확인한 뒤에 문의를 보낼 수 있어요.`}
        onRetry={() => void terms.refetch()}
      />
    ) : (
      <div className={styles.agree} aria-busy="true" aria-label="동의 내용을 불러오는 중">
        <SkeletonText lines={2} />
      </div>
    );
  }
  return (
    <div>
      <div className={cx(styles.agree, !!error && styles.agreeErr)}>
        <div className={styles.agreeRow}>
          <Checkbox
            ref={inputRef}
            id={id}
            checked={checked}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => onChange(e.target.checked)}
          >
            [필수] {CONSENT_TITLE}
          </Checkbox>
          <button
            type="button"
            className={cx('link', styles.agreeLink)}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${CONSENT_TITLE} 내용 ${open ? '접기' : '보기'}`}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? '접기' : '보기'}
          </button>
        </div>
        <div id={panelId} className={styles.agreeNotice} hidden={!open}>
          <p className={styles.agreeMeta}>
            <b>{doc.title || CONSENT_TITLE}</b>
            <span className="num">
              버전 {doc.version}
              {doc.effectiveAt ? ` · 시행일 ${formatDate(doc.effectiveAt)}` : ''}
            </span>
          </p>
          {/* Plain text from the admin, line breaks preserved; rendered as text (never as HTML). */}
          <div
            className={styles.agreeText}
            tabIndex={0}
            role="document"
            aria-label={`${CONSENT_TITLE} 전문`}
          >
            {doc.content}
          </div>
          <p className={styles.recipient}>
            이번 문의를 받는 곳: <b>{agencyName}</b>
          </p>
          <Link className="link" href={ROUTES.terms('privacy')} target="_blank" rel="noopener">
            개인정보처리방침 전문 보기 (새 창)
          </Link>
        </div>
      </div>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

export interface InquiryFormProps {
  agencyId: string;
  agencyName: string;
  listing?: { id: string; no: string; label: string } | null;
  source: InquirySource;
  onSent: (result: InquiryCreated) => void;
}

/**
 * 문의 남기기: name, phone (required for guests, optional for members — prefilled from the
 * session), message (5–1,000) with one-tap starters, the INQUIRY_PRIVACY consent (the published
 * text inline; its version is what the submission records) and a hidden honeypot.
 */
export function InquiryForm({ agencyId, agencyName, listing, source, onSent }: InquiryFormProps) {
  const id = useId();
  const queryClient = useQueryClient();
  const { user, status } = useSession();
  const member = status === 'authenticated';
  const terms = useActionTerms('INQUIRY');
  const [values, setValues] = useState<InquiryFormValues>(EMPTY_INQUIRY_FORM);
  const [errors, setErrors] = useState<InquiryFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<string>('');
  const refs = {
    name: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    message: useRef<HTMLTextAreaElement>(null),
    agree: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    setReturnTo(`${window.location.pathname}${window.location.search}`);
  }, []);

  // Members: name and number come from the profile (only into fields the user has not typed in).
  const prefilled = useRef(false);
  useEffect(() => {
    if (!user || prefilled.current) return;
    prefilled.current = true;
    const name = user.name?.trim() || (user.hasNickname ? user.nickname : '');
    const phone = user.phone ? formatPhone(user.phone) : '';
    setValues((v) => ({ ...v, name: v.name || name, phone: v.phone || phone }));
  }, [user]);

  const set = <K extends keyof InquiryFormValues>(key: K, value: InquiryFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const focus = (field: InquiryFormField | null) => {
    if (field) refs[field].current?.focus();
  };

  const send = useMutation({
    mutationFn: async () =>
      sendInquiry(
        toInquiryBody(
          values,
          { agencyId, listingId: listing?.id ?? null, source },
          shownConsents(terms.data),
        ),
      ),
    onSuccess: (result) => {
      if (result.member) void queryClient.invalidateQueries({ queryKey: inquiryKeys.mine });
      onSent(result);
    },
    onError: (error) => {
      if (isConsentOutdatedError(error)) {
        set('agree', false);
        setErrors((e) => ({ ...e, agree: CONSENT_OUTDATED_MESSAGE }));
        void terms.refetch();
        focus('agree');
        return;
      }
      if (error instanceof ApiError) {
        if (error.code === InquiriesErrorCode.INQUIRY_PHONE_REQUIRED) {
          setErrors((e) => ({ ...e, phone: error.message }));
          focus('phone');
          return;
        }
        if (error.isValidation) {
          const fields = error.fieldErrors();
          const next: InquiryFormErrors = {
            name: fields.name,
            phone: fields.phone,
            message: fields.message,
            agree: fields.consents,
          };
          if (firstErrorField(next)) {
            setErrors(next);
            focus(firstErrorField(next));
            return;
          }
        }
      }
      setFormError(errorMessage(error));
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (send.isPending) return;
    setFormError(null);
    const found = validateInquiryForm(values, { member });
    setErrors(found);
    if (firstErrorField(found)) {
      focus(firstErrorField(found));
      return;
    }
    send.mutate();
  };

  const over = values.message.trim().length > INQUIRY_LIMITS.MESSAGE_MAX;

  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-label="문의 남기기">
      {listing && (
        <p className={styles.subject}>
          <b>문의할 매물</b>
          <span>
            {listing.label} · 매물번호 <span className="num">{listing.no}</span>
          </span>
        </p>
      )}
      {!member && status !== 'loading' && source === InquirySource.MAIN && (
        <Callout size="sm" tone="muted" icon="info">
          로그인하지 않아도 문의할 수 있어요. 로그인하면 답변을 <b>MY &gt; 문의 내역</b>에서 볼 수
          있어요.{' '}
          <Link className="link" href={loginUrl(returnTo)}>
            로그인
          </Link>
        </Callout>
      )}
      <div className={styles.pair}>
        <Input
          ref={refs.name}
          id={`${id}-name`}
          label="이름"
          required
          autoComplete="name"
          maxLength={INQUIRY_LIMITS.NAME_MAX}
          placeholder="문의하는 분 이름"
          value={values.name}
          error={errors.name}
          onChange={(e) => set('name', e.target.value)}
        />
        <Input
          ref={refs.phone}
          id={`${id}-phone`}
          label={member ? '연락처 (선택)' : '연락처'}
          required={!member}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          placeholder="010-1234-5678"
          value={values.phone}
          error={errors.phone}
          onChange={(e) => set('phone', e.target.value)}
        />
      </div>
      <Textarea
        ref={refs.message}
        id={`${id}-message`}
        label="문의 내용"
        required
        rows={5}
        maxLength={INQUIRY_LIMITS.MESSAGE_MAX + 200}
        placeholder={
          listing
            ? '궁금한 점을 적어 주세요. 방문 희망 일정, 입주 시기, 대출 계획 등을 함께 적으면 답변이 빨라요.'
            : '찾는 매물 조건이나 궁금한 점을 적어 주세요.'
        }
        value={values.message}
        error={errors.message}
        // The counter is read with the field, not announced on every keystroke.
        aria-describedby={`${id}-counter`}
        onChange={(e) => set('message', e.target.value)}
      />
      <div className={styles.messageFoot}>
        {listing ? (
          <div className={styles.starters} role="group" aria-label="자주 쓰는 문장 넣기">
            {INQUIRY_STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                className={styles.starter}
                onClick={() => set('message', appendStarter(values.message, s))}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
        <span
          id={`${id}-counter`}
          className={cx(styles.counter, 'num', over && styles.counterOver)}
        >
          {messageCounter(values.message)}
        </span>
        {/* Announced once when the limit is crossed (the counter itself stays silent). */}
        <span className="sr-only" aria-live="polite">
          {over
            ? `문의 내용이 ${INQUIRY_LIMITS.MESSAGE_MAX.toLocaleString('ko-KR')}자를 넘었어요.`
            : ''}
        </span>
      </div>
      <ConsentBox
        id={`${id}-agree`}
        docs={terms.data}
        terms={terms}
        checked={values.agree}
        error={errors.agree}
        agencyName={agencyName}
        onChange={(on) => set('agree', on)}
        inputRef={refs.agree}
      />
      {/* Honeypot (see `website` in inquiryCreateSchema). */}
      <div className={styles.trap} aria-hidden="true">
        <label htmlFor={`${id}-website`}>웹사이트</label>
        <input
          id={`${id}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={(e) => set('website', e.target.value)}
        />
      </div>
      {formError && (
        <Callout size="sm" tone="danger" icon="alert" live>
          {formError}
        </Callout>
      )}
      <Button
        type="submit"
        size="lg"
        block
        loading={send.isPending}
        disabled={!terms.data}
        iconLeft={<Icon name="chat" size={18} />}
      >
        문의 보내기
      </Button>
    </form>
  );
}
