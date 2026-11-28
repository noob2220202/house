'use client';
import { Badge, Button, Callout, Panel, Skeleton, Switch, useToast } from '@house/ui';
import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/lib/api';
import { featuresValueSchema, type FeaturesValue } from '../api/schemas';
import { LoadError } from '../components/LoadError';
import { SaveBar } from '../components/SaveBar';
import s from '../components/shared.module.css';
import { groupFlags, normalizeFlags } from '../lib/features';
import { FEATURE_META } from '../lib/labels';
import { useUnsavedGuard } from '../lib/use-unsaved-guard';
import styles from './settings.module.css';
import { settingSavedLabel, useSiteSetting } from './use-site-setting';

function FlagRows({
  keys,
  flags,
  saved,
  onChange,
}: {
  keys: readonly string[];
  flags: FeaturesValue;
  saved: FeaturesValue;
  onChange: (key: string, on: boolean) => void;
}) {
  return (
    <div>
      {keys.map((key) => {
        const meta = FEATURE_META[key];
        const changed = flags[key] !== saved[key];
        return (
          <div key={key} className={s.switchRow}>
            <div className={s.switchText}>
              <span className={s.switchLabel}>
                {meta?.label ?? key} {changed && <Badge tone="warn">변경됨</Badge>}
              </span>
              <span className={s.switchHelp}>
                {meta?.description ?? '백엔드에 등록된 기능 플래그예요.'}{' '}
                <span className={styles.flagKey}>{key}</span>
              </span>
            </div>
            <Switch
              checked={flags[key] ?? false}
              onChange={(e) => onChange(key, e.target.checked)}
              aria-label={`${meta?.label ?? key} 사용`}
            />
          </div>
        );
      })}
    </div>
  );
}

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className={s.stack} aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={52} radius={12} />
      ))}
    </div>
  );
}

/**
 * 기능 설정 (FEATURES) — on/off switches for optional parts of the user site, and apart from them
 * the 유료 적용 switches (same setting key), which restrict instead of hide when turned on.
 */
export function FeaturesForm() {
  const { toast } = useToast();
  const { query, save } = useSiteSetting('FEATURES', featuresValueSchema);
  const stored = query.data?.value;
  const saved = useMemo<FeaturesValue>(() => normalizeFlags(stored), [stored]);
  const [flags, setFlags] = useState<FeaturesValue>(saved);
  useEffect(() => setFlags(saved), [saved]);
  const keys = Object.keys(flags);
  const groups = groupFlags(keys);
  const setFlag = (key: string, on: boolean) => setFlags({ ...flags, [key]: on });
  const dirty = keys.some((k) => flags[k] !== saved[k]);
  useUnsavedGuard(dirty);

  if (query.isError)
    return (
      <Panel>
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      </Panel>
    );

  return (
    <div className={`${s.stackLg} ${s.fill}`}>
      <Panel
        title="기능 설정"
        count={
          query.isPending
            ? undefined
            : `${groups.visibility.filter((k) => flags[k]).length}/${groups.visibility.length}`
        }
        description="끄면 사용자 화면에서 해당 메뉴와 영역이 사라져요"
      >
        {query.isPending ? (
          <RowsSkeleton rows={4} />
        ) : (
          <FlagRows keys={groups.visibility} flags={flags} saved={saved} onChange={setFlag} />
        )}
      </Panel>
      {(query.isPending || groups.paid.length > 0) && (
        <Panel
          title="유료 적용"
          description="켜면 이용 기간이 있는 사무소만 이용할 수 있어요. 끄면 모두 무료로 써요"
        >
          {query.isPending ? (
            <RowsSkeleton rows={2} />
          ) : (
            <FlagRows keys={groups.paid} flags={flags} saved={saved} onChange={setFlag} />
          )}
        </Panel>
      )}
      <Callout size="sm" tone="muted">
        내놓기·구하기를 끄면 새 요청만 막히고, 이미 등록된 요청과 중개사 제안은 그대로 남아요. 유료
        적용은 중개사무소 상세에 기록한 이용 기간(계좌이체로 받은 기간)을 기준으로 해요. 변경 내용은
        사용자 화면에 5분 안에 반영돼요.
      </Callout>

      <SaveBar dirty={dirty} info={settingSavedLabel(query.data)}>
        <Button type="button" variant="secondary" disabled={!dirty} onClick={() => setFlags(saved)}>
          되돌리기
        </Button>
        <Button
          type="button"
          disabled={!dirty || query.isPending}
          loading={save.isPending}
          onClick={() =>
            save.mutate(flags, {
              onSuccess: () => toast('기능 설정을 저장했어요.'),
              onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
            })
          }
        >
          저장
        </Button>
      </SaveBar>
    </div>
  );
}
