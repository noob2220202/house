'use client';
import { VERIFICATION_METHOD_LABEL, VerificationMethod } from '@house/shared';
import { Button, ChoiceChip, FieldError, FormSection, HelpLine, Icon, Input, cx } from '@house/ui';
import { useState } from 'react';
import { formatDate, toKstDateString } from '@/lib/format';
import { VERIFICATION_VALID_DAYS, verificationState } from '../lib/status';
import { useWizard } from './context';
import { FormRow } from './parts';
import styles from './wizard.module.css';

const METHOD_HINT: Record<VerificationMethod, string> = {
  OWNER_CONFIRMED: '의뢰인 직접 확인',
  OWNER_CALL: '전화로 확인',
  SITE_VISIT: '방문해서 확인',
  REGISTRY: '등기사항증명서',
  DOCUMENT: '계약서·위임장 등',
};
const METHODS: VerificationMethod[] = [
  VerificationMethod.SITE_VISIT,
  VerificationMethod.OWNER_CALL,
  VerificationMethod.OWNER_CONFIRMED,
  VerificationMethod.REGISTRY,
  VerificationMethod.DOCUMENT,
];

/** Step 6 — 실매물 확인 기록 (방법 · 날짜 · 메모) + history. */
export function StepVerify() {
  const { verifications, addVerification, listing, busy } = useWizard();
  const today = toKstDateString();
  const [method, setMethod] = useState<VerificationMethod | ''>('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const latest = verifications[0];
  const state = verificationState({
    verifiedAt: latest?.verifiedAt ?? null,
    verificationDueAt: listing?.verificationDueAt ?? null,
  });

  const submit = async () => {
    if (!method) return setError('확인 방법을 선택해 주세요.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('확인한 날짜를 선택해 주세요.');
    if (date > today) return setError('확인일은 오늘 이후일 수 없어요.');
    setError(null);
    setAdding(true);
    const ok = await addVerification({ method, verifiedAt: date, note: note.trim() || undefined });
    setAdding(false);
    if (ok) {
      setMethod('');
      setNote('');
      setDate(today);
    }
  };

  return (
    <>
      <FormSection letter="A" title="실매물 확인">
        <div
          className={cx(
            styles.verifyNow,
            state.kind === 'none' && styles.none,
            (state.kind === 'soon' || state.kind === 'overdue') && styles.warn,
          )}
          role="status"
        >
          <span className={styles.verifyIc}>
            <Icon
              name={
                state.kind === 'ok' ? 'check-circle' : state.kind === 'none' ? 'shield' : 'alert'
              }
              size={22}
            />
          </span>
          <span className={styles.verifyT}>
            {latest ? (
              <>
                <b>
                  {state.kind === 'overdue'
                    ? `확인 기한이 ${state.label.replace(' 지남', '')} 지났어요`
                    : `최근 확인 ${formatDate(latest.verifiedAt)}`}
                </b>
                <span>
                  {VERIFICATION_METHOD_LABEL[latest.method]}
                  {state.kind === 'ok' && ` · 다음 확인까지 ${state.label}`}
                  {state.kind === 'soon' && ` · 다시 확인할 때가 됐어요 (${state.label})`}
                  {state.kind === 'overdue' && ' · 아래에서 다시 확인하고 기록해 주세요'}
                </span>
              </>
            ) : (
              <>
                <b>아직 확인 기록이 없어요</b>
                <span>
                  기록이 없으면 공개 화면에 ‘실매물 확인 전’으로 표시되고, 확인순 정렬에서 뒤로
                  밀려요.
                </span>
              </>
            )}
          </span>
        </div>

        <FormRow label="확인 방법" labelId="l-verifyMethod">
          <div className={styles.chips} role="radiogroup" aria-labelledby="l-verifyMethod">
            {METHODS.map((m) => (
              <ChoiceChip
                key={m}
                type="radio"
                name="verifyMethod"
                value={m}
                checked={method === m}
                onChange={() => {
                  setMethod(m);
                  setError(null);
                }}
                hint={METHOD_HINT[m]}
              >
                {VERIFICATION_METHOD_LABEL[m]}
              </ChoiceChip>
            ))}
          </div>
        </FormRow>
        <FormRow label="확인일" htmlFor="f-verifyDate">
          <div className={styles.w240}>
            <Input
              id="f-verifyDate"
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </FormRow>
        <FormRow label="메모" htmlFor="f-verifyNote" help="사무소 내부용이에요.">
          <Input
            id="f-verifyNote"
            maxLength={500}
            placeholder="예: 임대인과 통화, 12월 말 퇴거 예정 확인"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <FieldError>{error}</FieldError>}
          <div className={styles.addRow}>
            <Button
              variant="soft"
              loading={adding}
              disabled={busy && !adding}
              iconLeft={<Icon name="plus" size={18} />}
              onClick={() => void submit()}
            >
              확인 기록 추가
            </Button>
          </div>
          <HelpLine icon="shield">
            소유자(임대인)에게 거래 의사와 조건을 직접 확인한 날짜를 기록해요. 확인은{' '}
            <b>{VERIFICATION_VALID_DAYS}일</b>마다 다시 해야 하고, 거래가 끝난 매물은 지체 없이
            내려야 해요.
          </HelpLine>
        </FormRow>
      </FormSection>

      {verifications.length > 0 && (
        <FormSection letter="B" title="확인 이력" note={`${verifications.length}건`}>
          <ol className={styles.history}>
            {verifications.map((v) => (
              <li key={v.id}>
                <span className={styles.date}>{formatDate(v.verifiedAt)}</span>
                <span className={styles.method}>{VERIFICATION_METHOD_LABEL[v.method]}</span>
                <span className={styles.note}>{v.note || '메모 없음'}</span>
                <span className={styles.by}>{v.verifiedByName ?? ''}</span>
              </li>
            ))}
          </ol>
        </FormSection>
      )}
    </>
  );
}
