'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Callout, Input, Panel, Skeleton, useToast } from '@house/ui';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { businessInfoFormSchema, type BusinessInfoForm as Values } from '../api/inputs';
import { businessInfoValueSchema } from '../api/schemas';
import { LoadError } from '../components/LoadError';
import { SaveBar } from '../components/SaveBar';
import s from '../components/shared.module.css';
import { formatBusinessNumber } from '../lib/business';
import { applyServerErrors } from '../lib/form-errors';
import { useUnsavedGuard } from '../lib/use-unsaved-guard';
import styles from './settings.module.css';
import { settingSavedLabel, useSiteSetting } from './use-site-setting';

const FIELDS = [
  'companyName',
  'ceoName',
  'businessNumber',
  'mailOrderNumber',
  'address',
  'privacyOfficer',
  'phone',
  'email',
] as const;

/** Same items, order and placeholders as the user-site footer (apps/web SiteFooter). */
function FooterPreview({ values }: { values: Values }) {
  const items = [
    { label: '상호', value: values.companyName, fallback: '[상호]' },
    { label: '대표', value: values.ceoName, fallback: '[대표]' },
    { label: '사업자등록번호', value: values.businessNumber, fallback: '[사업자등록번호]' },
    { label: '통신판매업 신고', value: values.mailOrderNumber ?? '', fallback: '[신고번호]' },
    { label: '주소', value: values.address, fallback: '[주소]' },
    { label: '개인정보보호책임자', value: values.privacyOfficer, fallback: '[개인정보보호책임자]' },
    { label: '이메일', value: values.email, fallback: '[이메일]' },
  ];
  return (
    <div className={styles.footerPreview}>
      <p className={styles.footerCs}>
        <b>고객센터 {values.phone.trim() || '[대표번호]'}</b>
        운영 시간은 &lsquo;고객센터&rsquo; 탭에서 바꿔요
      </p>
      <dl className={styles.footerBiz}>
        {items.map((item) => {
          const filled = item.value.trim() !== '';
          return (
            <div key={item.label}>
              <dt>{item.label}</dt>{' '}
              <dd className={filled ? undefined : styles.placeholder}>
                {filled ? item.value : item.fallback}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/** 사업자 정보 (BUSINESS_INFO) — 전자상거래법 표시사항 shown in the user-site footer. */
export function BusinessInfoForm() {
  const { toast } = useToast();
  const { query, save } = useSiteSetting('BUSINESS_INFO', businessInfoValueSchema);
  const stored = query.data?.value;
  const initial = useMemo<Values>(
    () => ({
      companyName: stored?.companyName ?? '',
      ceoName: stored?.ceoName ?? '',
      businessNumber: stored?.businessNumber ?? '',
      mailOrderNumber: stored?.mailOrderNumber ?? '',
      address: stored?.address ?? '',
      privacyOfficer: stored?.privacyOfficer ?? '',
      phone: stored?.phone ?? '',
      email: stored?.email ?? '',
    }),
    [stored],
  );
  const { register, handleSubmit, reset, watch, setError, formState } = useForm<Values>({
    resolver: zodResolver(businessInfoFormSchema),
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
  const businessNumber = register('businessNumber');
  const onSubmit = (v: Values) =>
    save.mutate(
      { ...v, mailOrderNumber: v.mailOrderNumber?.trim() || undefined },
      {
        onSuccess: () => toast('사업자 정보를 저장했어요. 사용자 화면 푸터에는 5분 안에 반영돼요.'),
        onError: (e) => {
          const message = applyServerErrors(e, setError, FIELDS);
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
        <Panel title="사업자 정보" description="전자상거래법 표시사항 · 사용자 화면 푸터에 보여요">
          {query.isPending ? (
            <div className={s.formGrid} aria-busy="true">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} height={72} radius={12} />
              ))}
            </div>
          ) : (
            <div className={s.stack}>
              {query.data.value === null && (
                <Callout size="sm" tone="warn">
                  아직 저장한 적이 없어요. 저장하기 전에는 사용자 화면 푸터에{' '}
                  <strong>[상호]</strong> 같은 자리 표시가 보여요.
                </Callout>
              )}
              <div className={s.formGrid}>
                <Input
                  label="상호"
                  required
                  maxLength={100}
                  placeholder="예: 주식회사 ○○"
                  autoComplete="organization"
                  error={errors.companyName?.message}
                  {...register('companyName')}
                />
                <Input
                  label="대표자명"
                  required
                  maxLength={50}
                  error={errors.ceoName?.message}
                  {...register('ceoName')}
                />
                <Input
                  label="사업자등록번호"
                  required
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="000-00-00000"
                  help="숫자 10자리 · 하이픈은 자동으로 넣어요"
                  error={errors.businessNumber?.message}
                  {...businessNumber}
                  onChange={(e) => {
                    e.target.value = formatBusinessNumber(e.target.value);
                    void businessNumber.onChange(e);
                  }}
                />
                <Input
                  label="통신판매업 신고번호"
                  maxLength={50}
                  placeholder="예: 제2026-전남순천-0000호"
                  help="신고 전이면 비워 두세요."
                  error={errors.mailOrderNumber?.message}
                  {...register('mailOrderNumber')}
                />
                <div className={s.spanAll}>
                  <Input
                    label="주소"
                    required
                    maxLength={200}
                    placeholder="예: 전라남도 순천시 ○○로 00, 0층"
                    autoComplete="street-address"
                    error={errors.address?.message}
                    {...register('address')}
                  />
                </div>
                <Input
                  label="개인정보보호책임자"
                  required
                  maxLength={50}
                  error={errors.privacyOfficer?.message}
                  {...register('privacyOfficer')}
                />
                <Input
                  label="대표 전화번호"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="061-000-0000"
                  error={errors.phone?.message}
                  {...register('phone')}
                />
                <div className={s.spanAll}>
                  <Input
                    label="이메일"
                    required
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="help@example.com"
                    error={errors.email?.message}
                    {...register('email')}
                  />
                </div>
              </div>
            </div>
          )}
        </Panel>

        <div className={s.aside}>
          <Panel title="푸터 미리보기" description="입력하는 대로 바뀌어요">
            <FooterPreview values={values} />
            <p className={styles.metaNote}>
              비어 있는 항목은 사용자 화면에 대괄호 자리 표시로 보여요. 사업자등록번호와 통신판매업
              신고번호는 등록증에 적힌 그대로 입력해 주세요.
            </p>
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
