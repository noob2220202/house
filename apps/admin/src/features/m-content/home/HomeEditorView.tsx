'use client';
import {
  Badge,
  Button,
  Callout,
  Icon,
  Panel,
  SegmentedControl,
  Skeleton,
  Switch,
  cx,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ADMIN_ROUTES } from '@/config/nav';
import { errorMessage, qk } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { siteSettings } from '../api';
import { useDevQuery } from '../api/dev';
import { homeLayoutSchema } from '../api/schemas';
import { LoadError } from '../components/LoadError';
import { OrderButtons } from '../components/OrderButtons';
import { SaveBar } from '../components/SaveBar';
import s from '../components/shared.module.css';
import {
  DEFAULT_HOME_SECTIONS,
  LOCKED_SECTIONS,
  canMoveSection,
  normalizeHomeLayout,
  sameLayout,
  type HomeSection,
} from '../lib/home-layout';
import { HOME_SECTION_META } from '../lib/labels';
import { moveItem } from '../lib/reorder';
import { useUnsavedGuard } from '../lib/use-unsaved-guard';
import styles from './HomeEditorView.module.css';

const KEY = 'HOME_LAYOUT';
const BLOCK_TONE: Partial<Record<HomeSection['key'], string | undefined>> = {
  HERO_SEARCH: styles.blockHero,
  MAIN_BANNER: styles.blockAd,
  APP_BAND: styles.blockInk,
};

/**
 * 메인 화면 편집 — order and visibility of the home page sections. The layout is stored as the site
 * setting `HOME_LAYOUT` (ASSUMED key, not in SiteSettingKey yet): saving works end to end against
 * the mock, and the user site starts honouring it once the backend exposes the key publicly.
 */
export function HomeEditorView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dev = useDevQuery();
  const [device, setDevice] = useState<'pc' | 'mobile'>('pc');

  const key = qk('admin-site-settings', KEY, dev);
  const setting = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => siteSettings.get(KEY, homeLayoutSchema, dev, { signal }),
  });
  const saved = useMemo(() => normalizeHomeLayout(setting.data?.value), [setting.data]);
  const [sections, setSections] = useState<HomeSection[]>(saved);
  useEffect(() => setSections(saved), [saved]);
  const dirty = !sameLayout(sections, saved);
  useUnsavedGuard(dirty);

  const save = useMutation({
    mutationFn: () => siteSettings.put(KEY, homeLayoutSchema, { sections }),
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast('메인 화면 구성을 저장했어요.');
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });

  const visibleCount = sections.filter((sec) => sec.visible).length;
  const isDefault = sameLayout(sections, DEFAULT_HOME_SECTIONS);

  if (setting.isError)
    return (
      <Panel>
        <LoadError error={setting.error} onRetry={() => void setting.refetch()} />
      </Panel>
    );

  return (
    <>
      <Callout size="sm">
        <strong>연동 준비 단계예요.</strong> 여기서 저장한 구성은 관리자 설정에 기록되고, 사용자
        사이트 반영은 백엔드에 메인 화면 구성 설정이 추가된 뒤에 켜져요. 배너와 팝업의 내용은{' '}
        <Link href={ADMIN_ROUTES.banners} className="link">
          배너·팝업 관리
        </Link>
        에서 바꿀 수 있어요.
      </Callout>

      <div className={s.split}>
        <Panel
          title="메인 화면 구성"
          count={setting.isPending ? undefined : `${visibleCount}/${sections.length}`}
          description="화살표로 순서를 바꾸고 스위치로 표시 여부를 정해요"
          flush
          actions={
            <Button
              size="sm"
              variant="ghost"
              iconLeft={<Icon name="refresh" size={16} />}
              disabled={isDefault || setting.isPending}
              onClick={() => setSections(DEFAULT_HOME_SECTIONS.map((sec) => ({ ...sec })))}
            >
              기본 구성으로
            </Button>
          }
        >
          {setting.isPending ? (
            <div className={s.stack} style={{ padding: 20 }} aria-busy="true">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} height={44} radius={12} />
              ))}
            </div>
          ) : (
            <ol className={styles.list}>
              {sections.map((section, index) => {
                const meta = HOME_SECTION_META[section.key];
                const locked = LOCKED_SECTIONS.includes(section.key);
                return (
                  <li
                    key={section.key}
                    className={cx(styles.row, !section.visible && styles.rowHidden)}
                  >
                    {locked ? (
                      <span className={styles.lockSlot}>
                        <Icon name="lock" size={16} label="항상 맨 위에 고정" />
                      </span>
                    ) : (
                      <OrderButtons
                        name={meta.label}
                        index={canMoveSection(sections, index, -1) ? index : 0}
                        count={canMoveSection(sections, index, 1) ? sections.length : index + 1}
                        onMove={(delta) => setSections(moveItem(sections, index, index + delta))}
                      />
                    )}
                    <span className={styles.tile}>
                      <Icon name={meta.icon} size={20} />
                    </span>
                    <div className={styles.text}>
                      <span className={styles.label}>
                        {meta.label}
                        {locked && <Badge tone="neutral">고정</Badge>}
                        {!section.visible && <Badge tone="warn">숨김</Badge>}
                      </span>
                      <span className={styles.desc}>{meta.description}</span>
                    </div>
                    {meta.manage && (
                      <Link href={meta.manage.href} className={styles.manage}>
                        {meta.manage.label}
                        <Icon name="chevron-right" size={14} />
                      </Link>
                    )}
                    <Switch
                      checked={section.visible}
                      disabled={locked}
                      onChange={(e) =>
                        setSections(
                          sections.map((sec, i) =>
                            i === index ? { ...sec, visible: e.target.checked } : sec,
                          ),
                        )
                      }
                      aria-label={`${meta.label} 표시`}
                    />
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        <div className={s.aside}>
          <Panel title="미리보기" description="표시 중인 영역만 순서대로 보여요">
            <div className={styles.previewHd}>
              <SegmentedControl
                label="미리보기 기기"
                size="sm"
                value={device}
                onChange={setDevice}
                options={[
                  { value: 'pc', label: 'PC' },
                  { value: 'mobile', label: '모바일' },
                ]}
              />
            </div>
            <div className={styles.stage}>
              <div
                className={cx(styles.frame, device === 'mobile' && styles.frameMobile)}
                role="img"
                aria-label={`메인 화면 미리보기: ${sections
                  .filter((sec) => sec.visible)
                  .map((sec) => HOME_SECTION_META[sec.key].label)
                  .join(', ')}`}
              >
                <div className={styles.chrome}>
                  <i />
                  <b />
                </div>
                {sections
                  .filter((sec) => sec.visible)
                  .map((sec) => {
                    const meta = HOME_SECTION_META[sec.key];
                    return (
                      <div
                        key={sec.key}
                        className={cx(styles.block, BLOCK_TONE[sec.key])}
                        style={{ height: meta.previewHeight * (device === 'mobile' ? 0.8 : 1) }}
                      >
                        <Icon name={meta.icon} size={14} />
                        <span>{meta.label}</span>
                      </div>
                    );
                  })}
                <div className={styles.footerBlock} />
              </div>
            </div>
            <p className={styles.previewNote}>실제 화면의 비율을 단순하게 줄인 그림이에요.</p>
          </Panel>
        </div>
      </div>

      <SaveBar
        dirty={dirty}
        info={
          setting.data?.updatedAt
            ? `${formatDateTime(setting.data.updatedAt)} · ${setting.data.updatedByAdminName ?? '알 수 없음'} 저장`
            : '아직 저장한 적이 없어요 (기본 구성 사용 중)'
        }
      >
        <Button
          type="button"
          variant="secondary"
          disabled={!dirty}
          onClick={() => setSections(saved)}
        >
          되돌리기
        </Button>
        <Button
          type="button"
          disabled={!dirty || setting.isPending}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          저장
        </Button>
      </SaveBar>
    </>
  );
}
