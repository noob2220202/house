'use client';
import {
  AGENCY_SITE_DECISION_REASON_MAX,
  AgencySiteDecisionAction,
  normalizeSiteSlug,
  siteSlugMessage,
  type AdminAgencySiteDecisionInput,
} from '@house/shared';
import { Button, ConfirmDialog, Input, Modal, useToast } from '@house/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { env } from '@/config/env';
import { errorMessage } from '@/lib/api';
import { decideAgencySite, modKeys } from '../api/queries';
import type { AgencySite } from '../api/schemas';
import { siteHost } from '../lib/labels';
import { AGENCY_SITE_REJECT_PRESETS, AGENCY_SITE_SUSPEND_PRESETS } from '../lib/reasons';
import { ReasonDialog } from '../ui/ReasonDialog';
import s from '../ui/ui.module.css';

/** A decision the admin is about to take on one office site. */
export interface SiteIntent {
  action: AgencySiteDecisionAction;
  site: AgencySite;
  agencyName: string;
  representativeName?: string;
}

const DONE: Record<AgencySiteDecisionAction, string> = {
  APPROVE: '홈페이지를 승인했어요. 중개사무소에 알림을 보냈고, 주소는 10분 안에 열려요.',
  REJECT: '홈페이지 신청을 반려했어요. 사유를 중개사무소에 전달했어요.',
  SUSPEND: '홈페이지를 정지했어요. 방문자에게 더 이상 보이지 않아요.',
  RESUME: '홈페이지 정지를 해제했어요.',
};

/**
 * POST /admin/agencies/:id/site/decision. A decision changes the site, the queue
 * (`/agencies/sites`) and the dashboard (queue panel + sidebar badge), so both resource keys are
 * refreshed.
 */
export function useSiteDecision(onDone?: () => void) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { agencyId: string; body: AdminAgencySiteDecisionInput }) =>
      decideAgencySite(v.agencyId, v.body),
    onSuccess: (site, v) => {
      queryClient.setQueryData(modKeys.agencySite(v.agencyId), { site });
      void queryClient.invalidateQueries({ queryKey: ['admin-agencies'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      toast(DONE[v.body.action]);
      onDone?.();
    },
  });
}

const REASON_DIALOG = {
  REJECT: {
    title: '홈페이지 신청 반려',
    description:
      '반려 사유는 중개사무소 콘솔에 그대로 보여요. 어떤 주소로 다시 신청하면 되는지 알려 주세요.',
    label: '반려 사유',
    presets: AGENCY_SITE_REJECT_PRESETS,
    confirm: '반려',
  },
  SUSPEND: {
    title: '홈페이지 정지',
    description:
      '정지하면 이 사무소 홈페이지가 바로 닫히고, 주소는 다른 사무소가 쓸 수 없게 그대로 남아요. 메인 사이트의 사무소 정보와 매물은 그대로예요.',
    label: '정지 사유',
    presets: AGENCY_SITE_SUSPEND_PRESETS,
    confirm: '정지',
  },
} as const;

/** Approve with the requested address, or with a corrected one (the office is told the result). */
function ApproveSiteDialog({
  intent,
  busy,
  serverError,
  onClose,
  onSubmit,
}: {
  intent: SiteIntent;
  busy: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (slug: string | undefined) => void;
}) {
  const requested = intent.site.requestedSlug ?? '';
  const [value, setValue] = useState(requested);
  const [touched, setTouched] = useState(false);
  const formId = useId();
  const slug = normalizeSiteSlug(value);
  const problem = siteSlugMessage(slug);
  const changed = slug !== requested;
  const fieldError = (touched || changed ? problem : null) ?? serverError;

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      size="md"
      title="홈페이지 승인"
      description="승인하면 아래 주소로 홈페이지가 열리고 중개사무소에 알림이 가요. 보안 인증서 발급에 보통 10분 정도 걸려요."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            {changed ? '주소 고쳐서 승인' : '승인'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className={s.dialogBody}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (problem || busy) return;
          onSubmit(changed ? slug : undefined);
        }}
      >
        <div className={s.dialogTarget}>
          {intent.agencyName}
          {intent.representativeName && <small>대표 {intent.representativeName}</small>}
        </div>
        <Input
          label="홈페이지 주소"
          required
          value={value}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="url"
          maxLength={40}
          suffix={`.${env.siteRootDomain}`}
          error={fieldError ?? undefined}
          help={
            changed
              ? `신청한 주소는 ${requested || '없음'}이에요. 고친 주소로 승인되고 중개사무소에도 그대로 안내돼요.`
              : '영문 소문자·숫자·하이픈(-) 3~30자. 상호와 관계없거나 오해를 살 주소라면 고쳐서 승인하거나 반려해 주세요.'
          }
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          data-autofocus
        />
        {!problem && (
          <p className={s.actionHint}>
            열릴 주소: <strong className={s.mono}>{siteHost(slug, env.siteRootDomain)}</strong>
          </p>
        )}
      </form>
    </Modal>
  );
}

/**
 * The dialog of a site decision: approve (editable slug), reject / suspend (reason with presets)
 * or resume (plain confirm). Errors of the form dialogs show inline; a failed resume toasts.
 */
export function SiteDecisionDialog({
  intent,
  onClose,
}: {
  intent: SiteIntent | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const decision = useSiteDecision(onClose);
  if (!intent) return null;
  const agencyId = intent.site.agencyId;
  const close = () => {
    if (decision.isPending) return;
    decision.reset();
    onClose();
  };
  const inlineError = decision.isError ? errorMessage(decision.error) : null;
  const target = {
    title: intent.agencyName,
    sub: intent.site.slug ?? intent.site.requestedSlug ?? undefined,
  };

  if (intent.action === AgencySiteDecisionAction.APPROVE) {
    return (
      <ApproveSiteDialog
        key={intent.site.id}
        intent={intent}
        busy={decision.isPending}
        serverError={inlineError}
        onClose={close}
        onSubmit={(slug) =>
          decision.mutate({ agencyId, body: { action: AgencySiteDecisionAction.APPROVE, slug } })
        }
      />
    );
  }
  if (intent.action === AgencySiteDecisionAction.RESUME) {
    return (
      <ConfirmDialog
        open
        onClose={close}
        onConfirm={() =>
          decision.mutate(
            { agencyId, body: { action: AgencySiteDecisionAction.RESUME } },
            {
              onError: (error) => {
                toast({ message: errorMessage(error), tone: 'error' });
                onClose();
              },
            },
          )
        }
        title="홈페이지 정지를 해제할까요?"
        description={`${intent.agencyName} 홈페이지가 ${intent.site.slug ? siteHost(intent.site.slug, env.siteRootDomain) : '원래 주소'}에서 다시 열려요.`}
        confirmLabel="정지 해제"
        loading={decision.isPending}
      />
    );
  }
  const dialog = REASON_DIALOG[intent.action];
  return (
    <ReasonDialog
      open
      onClose={close}
      title={dialog.title}
      description={dialog.description}
      target={target}
      reasonLabel={dialog.label}
      presets={dialog.presets}
      maxLength={AGENCY_SITE_DECISION_REASON_MAX}
      confirmLabel={dialog.confirm}
      danger
      loading={decision.isPending}
      error={inlineError}
      onConfirm={(reason) => decision.mutate({ agencyId, body: { action: intent.action, reason } })}
    />
  );
}
