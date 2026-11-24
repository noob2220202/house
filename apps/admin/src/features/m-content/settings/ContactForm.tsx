'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Icon, Input, Panel, Skeleton, useToast } from '@house/ui';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { contactFormSchema, type ContactForm as Values } from '../api/inputs';
import { contactValueSchema } from '../api/schemas';
import { LoadError } from '../components/LoadError';
import { SaveBar } from '../components/SaveBar';
import s from '../components/shared.module.css';
import { applyServerErrors } from '../lib/form-errors';
import { useUnsavedGuard } from '../lib/use-unsaved-guard';
import styles from './settings.module.css';
import { settingSavedLabel, useSiteSetting } from './use-site-setting';

/** 고객센터 (CONTACT) — phone, e-mail, opening hours and the KakaoTalk channel link. */
export function ContactForm() {
  const { toast } = useToast();
  const { query, save } = useSiteSetting('CONTACT', contactValueSchema);
  const stored = query.data?.value;
  const initial = useMemo<Values>(
    () => ({
      phone: stored?.phone ?? '',
      email: stored?.email ?? '',
      hours: stored?.hours ?? '',
      kakaoChannelUrl: stored?.kakaoChannelUrl ?? '',
    }),
    [stored],
  );
  const { register, handleSubmit, reset, watch, setError, formState } = useForm<Values>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: initial,
    mode: 'onBlur',
  });
  useEffect(() => reset(initial), [initial, reset]);
  useUnsavedGuard(formState.isDirty);

  if (query.isError)
    return (
      <Panel>
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      </Panel>
    );

  const errors = formState.errors;
  const values = watch();
  const onSubmit = (v: Values) =>
    save.mutate(
      {
        phone: v.phone,
        email: v.email,
        hours: v.hours?.trim() || undefined,
        kakaoChannelUrl: v.kakaoChannelUrl?.trim() || undefined,
      },
      {
        onSuccess: () => toast('고객센터 정보를 저장했어요.'),
        onError: (e) => {
          const message = applyServerErrors(e, setError, [
            'phone',
            'email',
            'hours',
            'kakaoChannelUrl',
          ]);
          if (message) toast({ message, tone: 'error' });
        },
      },
    );

  return (
    <form
      className={`${s.stackLg} ${s.fill}`}
      noValidate
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
    >
      <div className={s.split}>
        <Panel title="고객센터" description="문의 안내와 푸터의 운영 시간에 쓰여요">
          {query.isPending ? (
            <div className={s.formGrid} aria-busy="true">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} height={72} radius={12} />
              ))}
            </div>
          ) : (
            <div className={s.formGrid}>
              <Input
                label="고객센터 전화번호"
                required
                inputMode="tel"
                autoComplete="tel"
                placeholder="061-000-0000"
                error={errors.phone?.message}
                {...register('phone')}
              />
              <Input
                label="문의 이메일"
                required
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="help@example.com"
                error={errors.email?.message}
                {...register('email')}
              />
              <div className={s.spanAll}>
                <Input
                  label="운영 시간"
                  maxLength={100}
                  placeholder="평일 09:00 – 18:00 · 점심 12:00 – 13:00"
                  help="가운뎃점(·)으로 나누면 모바일 푸터에는 앞부분만 보여요."
                  error={errors.hours?.message}
                  {...register('hours')}
                />
              </div>
              <div className={s.spanAll}>
                <Input
                  label="카카오톡 채널 주소"
                  type="url"
                  inputMode="url"
                  placeholder="https://pf.kakao.com/_xxxxx"
                  help="비워 두면 카카오톡 상담 버튼이 보이지 않아요."
                  error={errors.kakaoChannelUrl?.message}
                  {...register('kakaoChannelUrl')}
                />
              </div>
            </div>
          )}
        </Panel>

        <div className={s.aside}>
          <Panel title="미리보기" description="문의 안내에 이렇게 보여요">
            <div className={styles.csCard}>
              <span className={styles.csLine}>고객센터</span>
              <span className={styles.csPhone}>{values.phone.trim() || '[대표번호]'}</span>
              <span className={styles.csLine}>
                {values.hours?.trim() || '평일 09:00 – 18:00 · 점심 12:00 – 13:00'}
              </span>
              <span className={styles.csLine}>{values.email.trim() || '[이메일]'}</span>
              {values.kakaoChannelUrl?.trim() && (
                <span className={styles.csChannel}>
                  <Icon name="chat" size={16} />
                  카카오톡 채널로 문의
                </span>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <SaveBar dirty={formState.isDirty} info={settingSavedLabel(query.data)}>
        <Button
          type="button"
          variant="secondary"
          disabled={!formState.isDirty}
          onClick={() => reset(initial)}
        >
          되돌리기
        </Button>
        <Button type="submit" loading={save.isPending} disabled={query.isPending}>
          저장
        </Button>
      </SaveBar>
    </form>
  );
}
