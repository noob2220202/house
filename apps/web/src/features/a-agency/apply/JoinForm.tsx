'use client';
import { Button, Callout, Checkbox, Icon, Input, Panel, useToast } from '@house/ui';
import { useId, useRef, useState, type FormEvent } from 'react';
import { ApiError, errorMessage } from '@/lib/api';
import { joinAgency } from '../api/queries';
import { JOIN_PRIVACY_NOTICE } from '../lib/application';
import {
  INVITE_CODE_LENGTH,
  formatInviteCode,
  isCompleteInviteCode,
  normalizeInviteCode,
} from '../lib/registration';
import { AGENT_ROUTES } from '../nav';
import { useConsoleUser } from '../shell/ConsoleUser';
import { PrivacySummary } from '../ui/PrivacySummary';
import styles from './Apply.module.css';

/** 소속 공인중개사·중개보조원: redeem the invite code issued by the agency owner. */
export function JoinForm() {
  const { toast } = useToast();
  const user = useConsoleUser();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  // The name the office sees in its staff list (agencyJoinSchema `displayName`).
  const [name, setName] = useState(() => (user?.hasNickname ? user.nickname : ''));
  const [nameError, setNameError] = useState<string>();
  const nameRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState<string>();
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState<string>();
  const codeRef = useRef<HTMLInputElement>(null);
  const agreeRef = useRef<HTMLInputElement>(null);
  const privacyId = useId();

  /** Show a code error and put the keyboard / screen-reader focus back on the code input. */
  const failCode = (message: string) => {
    setError(message);
    codeRef.current?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isCompleteInviteCode(code)) {
      failCode(`초대 코드 ${INVITE_CODE_LENGTH}자리를 입력해 주세요.`);
      return;
    }
    if (name.trim() === '') {
      setNameError('사무소에 표시할 이름을 입력해 주세요.');
      nameRef.current?.focus();
      return;
    }
    if (!agreed) {
      setAgreeError('개인정보 수집·이용에 동의해 주세요.');
      agreeRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const result = await joinAgency({
        code: normalizeInviteCode(code),
        displayName: name.trim(),
      });
      setJoined(result.agency.name);
      toast({ message: `${result.agency.name}에 합류했어요.` });
      // Full navigation: the session role changed, so every server guard must re-run.
      window.location.assign(AGENT_ROUTES.dashboard);
    } catch (err) {
      const fields = err instanceof ApiError ? err.fieldErrors() : {};
      if (err instanceof ApiError && err.isValidation && fields.displayName && !fields.code) {
        setNameError(fields.displayName);
        nameRef.current?.focus();
      } else if (
        err instanceof ApiError &&
        (err.isNotFound || err.status === 410 || err.isValidation)
      ) {
        failCode(fields.code ?? err.message);
      } else {
        toast({ message: errorMessage(err), tone: 'error' });
      }
      setBusy(false);
    }
  };

  return (
    <div className={styles.join}>
      <Panel title="초대 코드로 합류" description="대표 공인중개사가 직원 관리에서 발급한 코드예요">
        <form className={styles.joinForm} onSubmit={(e) => void submit(e)} noValidate>
          <Input
            ref={codeRef}
            label="초대 코드"
            required
            className={styles.codeInput}
            placeholder="ABCDE-FGHJK"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={INVITE_CODE_LENGTH + 1}
            value={code}
            onChange={(e) => {
              setCode(formatInviteCode(e.target.value));
              setError(undefined);
            }}
            error={error}
            help={`영문·숫자 ${INVITE_CODE_LENGTH}자리 · 대표님이 정한 기간 동안 한 번만 쓸 수 있어요`}
          />
          <Input
            ref={nameRef}
            label="이름"
            required
            autoComplete="name"
            maxLength={50}
            placeholder="예: 이도윤"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(undefined);
            }}
            error={nameError}
            help="사무소 직원 목록에 표시돼요."
          />
          <div className={styles.joinConsent}>
            <Checkbox
              ref={agreeRef}
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked) setAgreeError(undefined);
              }}
              aria-invalid={agreeError ? true : undefined}
              aria-describedby={privacyId}
            >
              <span>
                <b>[필수]</b> 개인정보 수집·이용에 동의합니다.
              </span>
            </Checkbox>
            <PrivacySummary id={privacyId} notice={JOIN_PRIVACY_NOTICE} action="합류" />
            {agreeError && (
              <p className={styles.fieldError} role="alert">
                {agreeError}
              </p>
            )}
          </div>
          <Button type="submit" size="lg" loading={busy} disabled={!!joined}>
            사무소에 합류하기
          </Button>
        </form>
      </Panel>
      <div className={styles.joinAside}>
        <Callout tone="info" title="초대 코드가 없나요?">
          사무소 대표님께 ‘중개사 콘솔 → 직원 관리 → 직원 초대’에서 코드를 발급해 달라고 요청해
          주세요. 합류하면 사무소 이름으로 매물을 등록하고 요청에 제안을 보낼 수 있어요.
        </Callout>
        <ul className={styles.checklist}>
          <li>
            <Icon name="check" size={16} strokeWidth={2.5} />
            중개보조원으로 합류하고, 대표님이 자격증을 확인하면 소속공인중개사로 바뀌어요
          </li>
          <li>
            <Icon name="check" size={16} strokeWidth={2.5} />
            매물에는 사무소 정보와 대표 성명이 함께 표시돼요
          </li>
          <li>
            <Icon name="check" size={16} strokeWidth={2.5} />
            퇴사하면 대표님이 직원 관리에서 내보낼 수 있어요
          </li>
        </ul>
      </div>
    </div>
  );
}
