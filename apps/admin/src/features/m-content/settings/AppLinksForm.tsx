'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Callout, Input, Panel, Skeleton, useToast } from '@house/ui';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { ADMIN_ROUTES } from '@/config/nav';
import { appLinksFormSchema, type AppLinksForm as Values } from '../api/inputs';
import { appLinksValueSchema } from '../api/schemas';
import { LoadError } from '../components/LoadError';
import { SaveBar } from '../components/SaveBar';
import s from '../components/shared.module.css';
import { applyServerErrors } from '../lib/form-errors';
import { useUnsavedGuard } from '../lib/use-unsaved-guard';
import { settingSavedLabel, useSiteSetting } from './use-site-setting';

/** Form values → APP_LINKS value: empty links are left out (the band hides that store button). */
export function toAppLinksValue(v: Values): { iosUrl?: string; androidUrl?: string } {
  const iosUrl = v.iosUrl.trim();
  const androidUrl = v.androidUrl.trim();
  return { ...(iosUrl ? { iosUrl } : {}), ...(androidUrl ? { androidUrl } : {}) };
}

/**
 * 앱 링크 (APP_LINKS, D9) — App Store / Google Play pages the home app band links to. The band
 * itself is switched on in 메인 화면 편집 (앱 안내 띠).
 */
export function AppLinksForm() {
  const { toast } = useToast();
  const { query, save } = useSiteSetting('APP_LINKS', appLinksValueSchema);
  const stored = query.data?.value;
  const initial = useMemo<Values>(
    () => ({ iosUrl: stored?.iosUrl ?? '', androidUrl: stored?.androidUrl ?? '' }),
    [stored],
  );
  const { register, handleSubmit, reset, setError, formState } = useForm<Values>({
    resolver: zodResolver(appLinksFormSchema),
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
  const onSubmit = (v: Values) =>
    save.mutate(toAppLinksValue(v), {
      onSuccess: () => toast('앱 링크를 저장했어요.'),
      onError: (e) => {
        const message = applyServerErrors(e, setError, ['iosUrl', 'androidUrl']);
        if (message) toast({ message, tone: 'error' });
      },
    });

  return (
    <form
      className={`${s.stackLg} ${s.fill}`}
      noValidate
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
    >
      <Panel
        title="앱 링크"
        description="메인 화면의 앱 안내 띠에 있는 스토어 버튼이 이 주소로 연결돼요"
      >
        {query.isPending ? (
          <div className={s.formGrid} aria-busy="true">
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} height={72} radius={12} />
            ))}
          </div>
        ) : (
          <div className={s.stack}>
            <div className={s.formGrid}>
              <div className={s.spanAll}>
                <Input
                  label="App Store 주소"
                  type="url"
                  inputMode="url"
                  placeholder="https://apps.apple.com/kr/app/…"
                  help="비워 두면 App Store 버튼이 보이지 않아요."
                  error={errors.iosUrl?.message}
                  {...register('iosUrl')}
                />
              </div>
              <div className={s.spanAll}>
                <Input
                  label="Google Play 주소"
                  type="url"
                  inputMode="url"
                  placeholder="https://play.google.com/store/apps/details?id=…"
                  help="비워 두면 Google Play 버튼이 보이지 않아요."
                  error={errors.androidUrl?.message}
                  {...register('androidUrl')}
                />
              </div>
            </div>
            <Callout size="sm" tone="muted">
              앱 안내 띠는{' '}
              <Link href={ADMIN_ROUTES.homeEditor} className="link">
                메인 화면 편집
              </Link>
              에서 켜고 끌 수 있어요. 두 주소가 모두 비어 있으면 띠를 켜도 버튼이 보이지 않아요.
            </Callout>
          </div>
        )}
      </Panel>

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
