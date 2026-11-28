'use client';
import {
  AGENCY_SITE_COLORS,
  AGENCY_SITE_TAGLINE_MAX,
  AgencyMemberRole,
  AgencySiteStatus,
  DEFAULT_AGENCY_SITE_COLOR,
  normalizeSiteSlug,
  siteSlugMessage,
  type AgencySiteColor,
} from '@house/shared';
import {
  Button,
  Callout,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  LoadingRegion,
  Panel,
  Skeleton,
  Spinner,
  StatusPill,
  cx,
  useDebouncedValue,
  useToast,
} from '@house/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ROUTES } from '@/config/nav';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDateShort } from '@/lib/format';
import type { MyAgency } from '../api/schemas';
import { useMyAgency } from '../api/useMyAgency';
import { useUnsavedChangesGuard } from '../lib/useUnsavedChangesGuard';
import { AGENT_ROUTES } from '../nav';
import { ConsolePage, ConsolePageHeader } from '../shell';
import { checkSiteSlug, fetchMySite, requestSite, siteKeys, updateSite } from './api';
import { ColorSwatches } from './ColorSwatches';
import {
  SITE_PREPARING_PILL,
  SITE_STATUS_PILL,
  hostOfUrl,
  requestBody,
  siteHost,
  slugCheck,
  subscriptionNotice,
  type SiteDraft,
} from './lib';
import type { AgencySite, MyAgencySite } from './schemas';
import { SitePreview } from './SitePreview';
import styles from './Site.module.css';

/** Server error codes that belong to the slug field. */
const SLUG_ERRORS = new Set([
  'AGENCY_SITE_SLUG_DUPLICATE',
  'AGENCY_SITE_SLUG_RESERVED',
  'AGENCY_SITE_SLUG_INVALID',
]);

/** A stored colour the palette no longer has shows (and saves) as the default. */
const asColor = (c: string): AgencySiteColor =>
  Object.hasOwn(AGENCY_SITE_COLORS, c) ? (c as AgencySiteColor) : DEFAULT_AGENCY_SITE_COLOR;

function draftOf(site: AgencySite | null): SiteDraft {
  return {
    slug: site?.slug ?? site?.requestedSlug ?? '',
    color: asColor(site?.color ?? DEFAULT_AGENCY_SITE_COLOR),
    tagline: site?.tagline ?? '',
  };
}

const date = (iso: string | null) => (iso ? formatDateShort(iso) : '');

/** An approved site waits for its certificate (deploy/sites.sh): poll until it can be opened. */
const PREPARING_POLL_MS = 60_000;
const isPreparing = (data: MyAgencySite | undefined) =>
  data?.site?.status === AgencySiteStatus.ACTIVE && !data.site.httpsReady;

// ---------- page ----------

/**
 * /agent/site — 내 홈페이지: the office's own site at `<slug>.<root>`. The owner requests an
 * address (an admin approves it), then picks the brand colour and 한 줄 소개; staff see it read-only.
 * States: none → request form · REQUESTED → pending (request editable) · ACTIVE → address, 주소 준비
 * 중 while https is not ready, colour / 한 줄 소개 editor · REJECTED → reason + re-request ·
 * SUSPENDED → notice.
 */
export function SiteView() {
  const agencyQuery = useMyAgency();
  const siteQuery = useQuery({
    queryKey: siteKeys.mine,
    queryFn: ({ signal }) => fetchMySite(signal),
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    // 주소 준비 중 turns into the open / copy actions by itself once HTTPS is ready.
    refetchInterval: (query) => (isPreparing(query.state.data) ? PREPARING_POLL_MS : false),
  });
  const agency = agencyQuery.data;
  const error = siteQuery.error ?? agencyQuery.error;
  const notApproved =
    (agency && agency.status !== 'APPROVED') ||
    (error instanceof ApiError && error.code === 'AGENCY_NOT_APPROVED');

  return (
    <ConsolePage>
      <ConsolePageHeader
        eyebrow="사무소"
        title="내 홈페이지"
        description="우리 사무소만의 홈페이지 주소를 신청하고, 브랜드 색과 한 줄 소개로 꾸며 보세요."
      />
      {agencyQuery.isPending || (siteQuery.isPending && !notApproved) ? (
        <LoadingRegion label="홈페이지 정보를 불러오는 중">
          <div className={styles.layout}>
            <div className={styles.col}>
              <Skeleton height={220} radius={16} />
              <Skeleton height={320} radius={16} />
            </div>
            <Skeleton height={460} radius={16} />
          </div>
        </LoadingRegion>
      ) : notApproved ? (
        <Panel>
          <EmptyState
            icon="shield"
            title="승인된 사무소만 홈페이지를 신청할 수 있어요"
            description="사무소 등록이 승인되면 이 화면에서 주소를 신청할 수 있어요."
            action={
              <Button href={AGENT_ROUTES.apply} linkAs={Link} variant="secondary">
                등록 정보 보기
              </Button>
            }
          />
        </Panel>
      ) : error || !agency || !siteQuery.data ? (
        <Panel>
          <ErrorState
            compact
            title="홈페이지 정보를 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
            onRetry={() => {
              void agencyQuery.refetch();
              void siteQuery.refetch();
            }}
            code={error instanceof ApiError ? error.requestId : undefined}
          />
        </Panel>
      ) : (
        <SiteWorkspace
          key={`${siteQuery.data.site?.status ?? 'none'}-${siteQuery.data.site?.updatedAt ?? ''}`}
          data={siteQuery.data}
          agency={agency}
        />
      )}
    </ConsolePage>
  );
}

// ---------- workspace ----------

function SiteWorkspace({ data, agency }: { data: MyAgencySite; agency: MyAgency }) {
  const { site, rootDomain } = data;
  const canEdit = agency.myRole === AgencyMemberRole.OWNER;
  const [draft, setDraft] = useState<SiteDraft>(() => draftOf(site));
  const [editingRequest, setEditingRequest] = useState(false);
  const status = site?.status ?? null;
  const showForm =
    canEdit &&
    (status === null ||
      status === AgencySiteStatus.REJECTED ||
      (status === AgencySiteStatus.REQUESTED && editingRequest));
  const previewSlug = normalizeSiteSlug(draft.slug);
  const host =
    site?.url && (status === AgencySiteStatus.ACTIVE || status === AgencySiteStatus.SUSPENDED)
      ? hostOfUrl(site.url)
      : previewSlug && !siteSlugMessage(previewSlug)
        ? siteHost(previewSlug, rootDomain)
        : `주소.${rootDomain}`;
  const sub = subscriptionNotice(data.subscription);
  const asideId = useId();

  return (
    <div className={styles.layout}>
      <div className={styles.col}>
        {!canEdit && (
          <Callout tone="info">
            홈페이지 신청과 꾸미기는 대표 공인중개사만 할 수 있어요. 지금 상태만 볼 수 있어요.
          </Callout>
        )}

        {site && (
          <StatusPanel
            data={data}
            site={site}
            canEdit={canEdit}
            onEditRequest={() => setEditingRequest(true)}
            editing={showForm}
          />
        )}

        {showForm ? (
          <RequestPanel
            data={data}
            draft={draft}
            onDraft={setDraft}
            onCancel={
              status === AgencySiteStatus.REQUESTED
                ? () => {
                    setEditingRequest(false);
                    setDraft(draftOf(site));
                  }
                : undefined
            }
          />
        ) : status === null ? (
          <Panel>
            <EmptyState
              compact
              icon="home"
              title="아직 신청한 홈페이지가 없어요"
              description="대표 공인중개사가 주소를 신청하면 운영자 확인 뒤 열려요."
            />
          </Panel>
        ) : null}

        {site && (status === AgencySiteStatus.ACTIVE || status === AgencySiteStatus.SUSPENDED) && (
          <DesignPanel site={site} draft={draft} onDraft={setDraft} canEdit={canEdit} />
        )}

        <Panel
          title="로고 · 커버 사진 · 소개"
          description="홈페이지는 사무소 프로필의 내용을 그대로 써요"
          className={styles.afterPreview}
        >
          <div className={styles.profileRow}>
            <p className={styles.help}>
              로고와 커버 사진, 사무소 소개, 영업시간을 바꾸면 홈페이지에도 함께 반영돼요.
            </p>
            <Button
              href={AGENT_ROUTES.profile}
              linkAs={Link}
              variant="secondary"
              size="sm"
              iconRight={<Icon name="chevron-right" size={16} />}
            >
              사무소 프로필 수정
            </Button>
          </div>
        </Panel>

        <Callout tone={sub.tone} icon="info" size="sm" className={styles.afterPreview}>
          <b>이용료</b> · {sub.text}
        </Callout>
      </div>

      <aside className={styles.aside} aria-labelledby={`${asideId}-title`}>
        <p className={styles.asideTitle} id={`${asideId}-title`}>
          <Icon name="eye" size={16} />
          방문자에게 이렇게 보여요
        </p>
        <SitePreview
          agencyId={agency.id}
          name={agency.name}
          representativeName={agency.representativeName}
          host={host}
          color={draft.color}
          tagline={draft.tagline.trim()}
          logo={agency.logo ?? null}
          cover={agency.cover ?? null}
        />
      </aside>
    </div>
  );
}

// ---------- status ----------

function StatusPanel({
  data,
  site,
  canEdit,
  editing,
  onEditRequest,
}: {
  data: MyAgencySite;
  site: AgencySite;
  canEdit: boolean;
  editing: boolean;
  onEditRequest: () => void;
}) {
  const pill =
    site.status === AgencySiteStatus.ACTIVE && !site.httpsReady
      ? SITE_PREPARING_PILL
      : SITE_STATUS_PILL[site.status];
  const requested = site.requestedSlug ? siteHost(site.requestedSlug, data.rootDomain) : null;
  const gated = data.subscription.required && !data.subscription.active;

  return (
    <Panel title="홈페이지 상태" actions={<StatusPill tone={pill.tone}>{pill.label}</StatusPill>}>
      <div className={styles.stack}>
        {site.status === AgencySiteStatus.ACTIVE && site.url && (
          <>
            <SiteAddress url={site.url} ready={site.httpsReady} />
            {!site.httpsReady ? (
              <Callout tone="warn" icon="clock" title="주소 준비 중 — 보통 10분 안에 열려요" live>
                보안 인증서를 발급하고 있어요. 준비가 끝나면 여기에서 홈페이지를 열고 주소를 복사할
                수 있어요. 신청이 몰리면 조금 더 걸릴 수 있어요.
              </Callout>
            ) : gated ? (
              <Callout tone="warn" title="이용 기간이 아니라서 홈페이지가 닫혀 있어요">
                이용 신청은 고객센터로 문의해 주세요.
              </Callout>
            ) : (
              <p className={styles.help}>
                주소를 명함, 문자, 블로그에 붙여 보세요. 방문자 문의는{' '}
                <Link className="link" href={AGENT_ROUTES.inquiries}>
                  문의함
                </Link>
                에 &lsquo;홈페이지&rsquo; 표시와 함께 들어와요.
              </p>
            )}
          </>
        )}

        {site.status === AgencySiteStatus.REQUESTED && (
          <>
            <dl className={styles.facts}>
              <div>
                <dt>신청한 주소</dt>
                <dd className={styles.host}>{requested}</dd>
              </div>
              <div>
                <dt>신청일</dt>
                <dd className="num">{date(site.requestedAt)}</dd>
              </div>
            </dl>
            <Callout tone="info" icon="clock">
              운영자가 신청 내용을 확인하고 있어요. 승인되면 알림으로 알려 드려요. 승인할 때 주소가
              조금 바뀔 수 있어요.
            </Callout>
            {canEdit && !editing && (
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onEditRequest}
                  iconLeft={<Icon name="edit" size={16} />}
                >
                  신청 내용 수정
                </Button>
              </div>
            )}
          </>
        )}

        {site.status === AgencySiteStatus.REJECTED && (
          <Callout tone="danger" title="신청이 반려되었어요">
            {site.decisionReason ?? '반려 사유가 없어요. 고객센터로 문의해 주세요.'}
            {requested && (
              <span className={styles.calloutMeta}>
                신청한 주소 {requested}
                {site.decidedAt ? ` · ${date(site.decidedAt)}` : ''}
              </span>
            )}
          </Callout>
        )}

        {site.status === AgencySiteStatus.SUSPENDED && (
          <>
            <Callout tone="warn" title="홈페이지 운영이 정지되었어요">
              {site.decisionReason ?? '자세한 내용은 고객센터로 문의해 주세요.'}
              <span className={styles.calloutMeta}>
                지금은 방문자가 홈페이지를 볼 수 없어요.{' '}
                <Link className="link" href={ROUTES.support}>
                  고객센터 문의
                </Link>
              </span>
            </Callout>
            {site.slug && (
              <dl className={styles.facts}>
                <div>
                  <dt>주소</dt>
                  <dd className={styles.host}>{siteHost(site.slug, data.rootDomain)}</dd>
                </div>
              </dl>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

/**
 * The address with 복사 / 열기 — only once HTTPS is ready: before the certificate exists the host
 * answers with a browser security error (HSTS: no way past it), so the address is plain text then.
 */
function SiteAddress({ url, ready }: { url: string; ready: boolean }) {
  const { toast } = useToast();
  if (!ready) {
    return (
      <div className={cx(styles.address, styles.addressPending)}>
        <span className={styles.addressUrl}>
          <Icon name="home" size={18} />
          <span>{hostOfUrl(url)}</span>
        </span>
        <span className={styles.addressWait}>
          <Spinner size={14} /> 주소 준비 중
        </span>
      </div>
    );
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ message: '홈페이지 주소를 복사했어요.' });
    } catch {
      toast({ message: '복사하지 못했어요. 주소를 길게 눌러 복사해 주세요.', tone: 'error' });
    }
  };
  return (
    <div className={styles.address}>
      <a className={styles.addressUrl} href={url} target="_blank" rel="noopener">
        <Icon name="home" size={18} />
        <span>{hostOfUrl(url)}</span>
      </a>
      <div className={styles.addressActs}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void copy()}
          iconLeft={<Icon name="copy" size={16} />}
        >
          주소 복사
        </Button>
        <Button
          size="sm"
          href={url}
          target="_blank"
          rel="noopener"
          iconRight={<Icon name="external-link" size={16} />}
          aria-label="홈페이지 열기 (새 창)"
        >
          홈페이지 열기
        </Button>
      </div>
    </div>
  );
}

// ---------- request form ----------

function RequestPanel({
  data,
  draft,
  onDraft,
  onCancel,
}: {
  data: MyAgencySite;
  draft: SiteDraft;
  onDraft: (d: SiteDraft) => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const site = data.site;
  const mode = !site ? 'new' : site.status === AgencySiteStatus.REQUESTED ? 'edit' : 'again';
  const own = site?.status === AgencySiteStatus.REQUESTED ? site.requestedSlug : null;
  const [slugError, setSlugError] = useState<string | null>(null);
  const [taglineError, setTaglineError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const slugRef = useRef<HTMLInputElement>(null);

  const slug = normalizeSiteSlug(draft.slug);
  const debounced = useDebouncedValue(slug, 350);
  const wantsCheck = !!debounced && !siteSlugMessage(debounced) && debounced !== own;
  const availability = useQuery({
    queryKey: siteKeys.availability(debounced),
    queryFn: ({ signal }) => checkSiteSlug(debounced, signal),
    enabled: wantsCheck,
    staleTime: 30_000,
    retry: false,
  });
  const check = slugCheck(draft.slug, {
    availability: debounced === slug ? availability.data : undefined,
    failed: availability.isError && debounced === slug,
    own,
  });

  const initial = draftOf(site);
  const dirty =
    slug !== normalizeSiteSlug(initial.slug) ||
    draft.color !== initial.color ||
    draft.tagline.trim() !== initial.tagline.trim();
  const guard = useUnsavedChangesGuard(dirty && !saving, {
    title: '신청을 마치지 않았어요',
    description: '입력한 홈페이지 신청 내용이 사라져요.',
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = slug ? siteSlugMessage(slug) : '홈페이지 주소를 입력해 주세요.';
    if (problem || check.state === 'unavailable') {
      setSlugError(problem ?? (check.state === 'unavailable' ? check.message : null));
      slugRef.current?.focus();
      return;
    }
    if (draft.tagline.trim().length > AGENCY_SITE_TAGLINE_MAX) {
      setTaglineError(`한 줄 소개는 ${AGENCY_SITE_TAGLINE_MAX}자 이하로 입력해 주세요.`);
      return;
    }
    setSaving(true);
    try {
      const saved = await requestSite(requestBody(draft));
      queryClient.setQueryData(siteKeys.mine, saved);
      // The office's own request no longer counts as TAKEN for itself; others may have changed.
      queryClient.removeQueries({ queryKey: siteKeys.availabilityAll });
      toast({
        message:
          mode === 'edit'
            ? '신청 내용을 바꿨어요.'
            : '홈페이지를 신청했어요. 승인되면 알림으로 알려 드려요.',
      });
    } catch (error) {
      if (error instanceof ApiError && SLUG_ERRORS.has(error.code)) {
        setSlugError(error.fieldErrors().slug ?? error.message);
        slugRef.current?.focus();
      } else if (error instanceof ApiError && error.isValidation) {
        const fields = error.fieldErrors();
        if (fields.slug) setSlugError(fields.slug);
        if (fields.tagline) setTaglineError(fields.tagline);
        toast({ message: errorMessage(error), tone: 'error' });
      } else {
        toast({ message: errorMessage(error), tone: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const statusLine: ReactNode =
    check.state === 'checking' ? (
      <span className={styles.slugChecking}>
        <Spinner size={14} /> 쓸 수 있는 주소인지 확인하고 있어요
      </span>
    ) : check.state === 'available' || check.state === 'own' ? (
      <span className={styles.slugOk}>
        <Icon name="check-circle" size={16} /> {check.message}
      </span>
    ) : check.state === 'unavailable' || check.state === 'invalid' ? (
      <span className={styles.slugBad}>
        <Icon name="info" size={16} /> {check.message}
      </span>
    ) : check.state === 'error' ? (
      <span className={styles.slugMuted}>{check.message}</span>
    ) : null;

  return (
    <Panel
      title={
        mode === 'new' ? '홈페이지 주소 신청' : mode === 'edit' ? '신청 내용 수정' : '다시 신청하기'
      }
      description="운영자가 확인하고 승인하면 홈페이지가 열려요"
    >
      <form className={styles.stack} onSubmit={(e) => void submit(e)} noValidate>
        {mode === 'new' && (
          <ul className={styles.benefits}>
            <li>
              <Icon name="building" size={18} />
              우리 사무소가 직접 등록한 매물만 모아 보여 줘요
            </li>
            <li>
              <Icon name="chat" size={18} />
              방문자가 남긴 문의는 문의함으로 바로 들어와요
            </li>
            <li>
              <Icon name="store" size={18} />
              로고·커버 사진·소개는 사무소 프로필을 그대로 써요
            </li>
          </ul>
        )}
        <div>
          <Input
            ref={slugRef}
            id={`${id}-slug`}
            label="홈페이지 주소"
            required
            value={draft.slug}
            onChange={(e) => {
              setSlugError(null);
              onDraft({ ...draft, slug: e.target.value });
            }}
            suffix={
              <span className={styles.suffix} aria-hidden="true">
                .{data.rootDomain}
              </span>
            }
            inputMode="url"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            maxLength={30}
            placeholder="예: sindae"
            help={
              slugError
                ? undefined
                : '영문 소문자·숫자·하이픈(-) 3~30자. 승인 뒤에는 바꿀 수 없어요.'
            }
            error={slugError ?? undefined}
            // <Input> merges these with its help / error line: the suffix and the live check.
            aria-describedby={`${id}-slug-suffix ${id}-slug-status`}
          />
          <span className="sr-only" id={`${id}-slug-suffix`}>
            전체 주소: 입력한 이름.{data.rootDomain}
          </span>
          <p className={styles.slugStatus} id={`${id}-slug-status`} aria-live="polite">
            {!slugError && statusLine}
          </p>
        </div>

        <ColorSwatches value={draft.color} onChange={(color) => onDraft({ ...draft, color })} />

        <TaglineInput
          value={draft.tagline}
          error={taglineError}
          onChange={(tagline) => {
            setTaglineError(null);
            onDraft({ ...draft, tagline });
          }}
        />

        <div className={styles.formActs}>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={saving}>
              취소
            </Button>
          )}
          <Button type="submit" loading={saving} disabled={mode === 'edit' && !dirty}>
            {mode === 'edit' ? '신청 내용 저장' : '신청하기'}
          </Button>
        </div>
      </form>
      {guard}
    </Panel>
  );
}

function TaglineInput({
  value,
  error,
  onChange,
  disabled,
}: {
  value: string;
  error: string | null;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <Input
      label="한 줄 소개 (선택)"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={AGENCY_SITE_TAGLINE_MAX}
      disabled={disabled}
      placeholder="예: 신대 레이크파크만 10년, 동·호수별 조망까지 알려 드려요"
      help={
        error
          ? undefined
          : `홈페이지 첫 화면의 사무소 이름 아래에 보여요 · ${value.length} / ${AGENCY_SITE_TAGLINE_MAX}자`
      }
      error={error ?? undefined}
    />
  );
}

// ---------- colour / 한 줄 소개 of a live site ----------

function DesignPanel({
  site,
  draft,
  onDraft,
  canEdit,
}: {
  site: AgencySite;
  draft: SiteDraft;
  onDraft: (d: SiteDraft) => void;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [taglineError, setTaglineError] = useState<string | null>(null);
  const savedColor = asColor(site.color);
  const savedTagline = site.tagline ?? '';
  const dirty = draft.color !== savedColor || draft.tagline.trim() !== savedTagline.trim();
  const guard = useUnsavedChangesGuard(canEdit && dirty && !saving);

  // A refetch with newer data resets the editor (the workspace is keyed by updatedAt).
  useEffect(() => setTaglineError(null), [site.updatedAt]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (draft.tagline.trim().length > AGENCY_SITE_TAGLINE_MAX) {
      setTaglineError(`한 줄 소개는 ${AGENCY_SITE_TAGLINE_MAX}자 이하로 입력해 주세요.`);
      return;
    }
    setSaving(true);
    try {
      const saved = await updateSite({ color: draft.color, tagline: draft.tagline.trim() || null });
      queryClient.setQueryData(siteKeys.mine, saved);
      toast({ message: '홈페이지를 저장했어요. 1분 안에 홈페이지에 반영돼요.' });
    } catch (error) {
      if (error instanceof ApiError && error.isValidation && error.fieldErrors().tagline) {
        setTaglineError(error.fieldErrors().tagline ?? null);
      }
      toast({ message: errorMessage(error), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="꾸미기" description="브랜드 색과 한 줄 소개는 언제든 바꿀 수 있어요">
      <form className={styles.stack} onSubmit={(e) => void save(e)} noValidate>
        <ColorSwatches
          value={draft.color}
          disabled={!canEdit}
          onChange={(color) => onDraft({ ...draft, color })}
        />
        <TaglineInput
          value={draft.tagline}
          error={taglineError}
          disabled={!canEdit}
          onChange={(tagline) => {
            setTaglineError(null);
            onDraft({ ...draft, tagline });
          }}
        />
        {canEdit && (
          <div className={cx(styles.formActs, dirty && styles.formActsDirty)}>
            <p className={styles.saveText} role="status">
              {dirty ? '저장하지 않은 변경사항이 있어요' : '모든 변경사항이 저장되어 있어요'}
            </p>
            <Button
              variant="ghost"
              disabled={!dirty || saving}
              onClick={() => onDraft({ ...draft, color: savedColor, tagline: savedTagline })}
            >
              되돌리기
            </Button>
            <Button type="submit" loading={saving} disabled={!dirty}>
              저장
            </Button>
          </div>
        )}
      </form>
      {guard}
    </Panel>
  );
}
