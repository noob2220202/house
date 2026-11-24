'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { BrandMark, Button, Input, Panel, Skeleton, Textarea, cx, useToast } from '@house/ui';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { env } from '@/config/env';
import { seoFormSchema, type SeoForm as Values } from '../api/inputs';
import { seoValueSchema } from '../api/schemas';
import { LoadError } from '../components/LoadError';
import { SaveBar } from '../components/SaveBar';
import s from '../components/shared.module.css';
import { applyServerErrors } from '../lib/form-errors';
import { useUnsavedGuard } from '../lib/use-unsaved-guard';
import styles from './settings.module.css';
import { settingSavedLabel, useSiteSetting } from './use-site-setting';

/** Lengths search engines usually show before cutting the text. */
const TITLE_GOOD = 30;
const DESC_GOOD = 80;

function Counter({ length, good, max }: { length: number; good: number; max: number }) {
  return (
    <span className={cx(styles.counter, length > good && styles.counterWarn)}>
      {length}/{max}자{length > good ? ` · 검색 결과에서는 ${good}자 안팎까지만 보여요` : ''}
    </span>
  );
}

/** 검색 노출 (SEO) — default title / description of the user site with a search-result preview. */
export function SeoForm() {
  const { toast } = useToast();
  const { query, save } = useSiteSetting('SEO', seoValueSchema);
  const stored = query.data?.value;
  const initial = useMemo<Values>(
    () => ({ title: stored?.title ?? '', description: stored?.description ?? '' }),
    [stored],
  );
  const { register, handleSubmit, reset, watch, setError, formState } = useForm<Values>({
    resolver: zodResolver(seoFormSchema),
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
      // Keep the share image the backend already stores (no uploader for it yet).
      { ...v, ...(stored?.ogImageMediaId ? { ogImageMediaId: stored.ogImageMediaId } : {}) },
      {
        onSuccess: () => toast('검색 노출 정보를 저장했어요.'),
        onError: (e) => {
          const message = applyServerErrors(e, setError, ['title', 'description']);
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
        <Panel
          title="검색 노출"
          description="포털 검색 결과와 메신저 공유 미리보기의 기본 문구예요"
        >
          {query.isPending ? (
            <div className={s.stack} aria-busy="true">
              <Skeleton height={72} radius={12} />
              <Skeleton height={128} radius={12} />
            </div>
          ) : (
            <div className={s.stack}>
              <Input
                label="사이트 제목"
                required
                maxLength={100}
                placeholder="예: 순천 부동산 공동중개"
                help={<Counter length={values.title.length} good={TITLE_GOOD} max={100} />}
                error={errors.title?.message}
                {...register('title')}
              />
              <Textarea
                label="사이트 설명"
                required
                rows={4}
                maxLength={300}
                placeholder="예: 순천 공인중개사들이 함께 만드는 공동중개 부동산 서비스"
                help={<Counter length={values.description.length} good={DESC_GOOD} max={300} />}
                error={errors.description?.message}
                {...register('description')}
              />
            </div>
          )}
        </Panel>

        <div className={s.aside}>
          <Panel title="검색 결과 미리보기" description="실제 모습은 검색엔진마다 조금씩 달라요">
            <div className={styles.serp}>
              <span className={styles.serpSite}>
                <BrandMark size={24} />
                <span className={styles.serpUrl}>{env.siteUrl.replace(/^https?:\/\//, '')}</span>
              </span>
              <span className={styles.serpTitle}>{values.title.trim() || '사이트 제목'}</span>
              <span className={styles.serpDesc}>
                {values.description.trim() || '사이트 설명이 여기에 보여요.'}
              </span>
            </div>
            <p className={styles.metaNote}>
              매물·단지·중개사무소 상세 화면은 각자의 제목과 설명을 따로 써요. 여기 문구는 메인
              화면과 그 밖의 화면의 기본값이에요.
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
