'use client';
import {
  AGENCY_STATUS_LABEL,
  ASSET_TYPE_LABEL,
  AgencyMemberRole,
  AgencyStatus,
  type AgencyDocumentType,
} from '@house/shared';
import {
  Button,
  Callout,
  ConfirmDialog,
  Icon,
  Panel,
  StatusPill,
  Stepper,
  cx,
  useToast,
  type IconName,
} from '@house/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ROUTES } from '@/config/nav';
import { errorMessage } from '@/lib/api';
import { formatDateTime, formatPhone } from '@/lib/format';
import { agencyKeys, attachDocument, resubmitAgency } from '../api/queries';
import type { MyAgency } from '../api/schemas';
import {
  APPLICATION_STEPS,
  documentsChangedSinceRejection,
  latestDocuments,
  missingDocuments,
  missingRecommended,
  registerPayloadFromAgency,
  statusView,
} from '../lib/application';
import { formatBusinessNumber } from '../lib/registration';
import { AGENT_ROUTES } from '../nav';
import styles from './Apply.module.css';
import { DocumentSlots } from './DocumentSlots';
import { useDocumentUploads } from './useDocumentUploads';

const HERO_ICON: Record<AgencyStatus, IconName> = {
  PENDING: 'clock',
  APPROVED: 'check-circle',
  REJECTED: 'x-circle',
  SUSPENDED: 'alert',
};

export interface ApplicationStatusProps {
  agency: MyAgency;
  /** Start correcting a rejected application. */
  onEdit?: () => void;
  /** Move focus to the status heading on mount (right after a submit / resubmit). */
  focusOnMount?: boolean;
}

/** Status tracking of the agency application: progress, reason, submitted data, documents, history. */
export function ApplicationStatus({ agency, onEdit, focusOnMount }: ApplicationStatusProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isOwner = agency.myRole === AgencyMemberRole.OWNER;
  const documents = latestDocuments(agency.documents);
  const present = Object.keys(documents) as AgencyDocumentType[];
  const missing = missingDocuments(present);
  const missingRec = missingRecommended(present);
  const view = statusView(agency.status, isOwner ? missing.length : 0);
  const rejected = agency.status === AgencyStatus.REJECTED;
  const canUpload = isOwner && (agency.status === AgencyStatus.PENDING || rejected);
  // After approval only the 보증서류 (renewed yearly) can still be submitted.
  const canRenew = isOwner && agency.status === AgencyStatus.APPROVED;
  const docsChanged = isOwner && documentsChangedSinceRejection(agency);

  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) headingRef.current?.focus();
  }, [focusOnMount]);

  const [confirmResubmit, setConfirmResubmit] = useState(false);
  const resubmit = useMutation({
    mutationFn: () => resubmitAgency(registerPayloadFromAgency(agency)),
    onSuccess: (saved) => {
      queryClient.setQueryData(agencyKeys.mine, saved);
      void queryClient.invalidateQueries({ queryKey: agencyKeys.mine });
      setConfirmResubmit(false);
      toast({ message: '다시 신청했어요. 심사 결과를 알려 드릴게요.' });
      headingRef.current?.focus();
    },
    onError: (error) => {
      setConfirmResubmit(false);
      toast({ message: errorMessage(error), tone: 'error' });
    },
  });

  // On this screen a picked file is attached to the application as soon as its upload finishes.
  const uploads = useDocumentUploads((doc) => {
    void (async () => {
      try {
        await attachDocument(doc);
        await queryClient.invalidateQueries({ queryKey: agencyKeys.mine });
        uploads.remove(doc.type);
        toast(
          rejected
            ? { message: '서류를 교체했어요 — 아직 재신청 전이에요.', tone: 'info', duration: 6000 }
            : { message: canRenew ? '갱신 서류를 제출했어요.' : '서류를 제출했어요.' },
        );
      } catch (error) {
        toast({ message: errorMessage(error), tone: 'error' });
      }
    })();
  });

  const address = [agency.roadAddress, agency.addressDetail].filter(Boolean).join(', ');
  const rows: [string, string][] = [
    ['상호', agency.name],
    ['대표 공인중개사', agency.representativeName],
    ['등록번호', agency.registrationNumber],
    ...(isOwner && agency.businessNumber
      ? ([['사업자등록번호', formatBusinessNumber(agency.businessNumber)]] as [string, string][])
      : []),
    ['대표 전화', formatPhone(agency.phone)],
    ['소재지', address],
    [
      '전문 분야',
      agency.specialties.length > 0
        ? agency.specialties.map((s) => ASSET_TYPE_LABEL[s]).join(' · ')
        : '선택 안 함',
    ],
    ['신청일', formatDateTime(agency.createdAt)],
  ];

  return (
    <div className={styles.statusWrap}>
      <section className={cx(styles.hero, styles[`hero${agency.status}`])} aria-live="polite">
        <span className={styles.heroIcon}>
          <Icon name={HERO_ICON[agency.status]} size={26} />
        </span>
        <div className={styles.heroText}>
          <p className={styles.heroPill}>
            <StatusPill tone={view.tone}>{view.label}</StatusPill>
            <span>{agency.name}</span>
          </p>
          <h2 className={styles.heroTitle} ref={headingRef} tabIndex={-1}>
            {view.title}
          </h2>
          <p className={styles.heroDesc}>{view.description}</p>
        </div>
        <div className={styles.heroActions}>
          {agency.status === AgencyStatus.APPROVED && (
            <>
              <Button href={AGENT_ROUTES.dashboard}>대시보드로 이동</Button>
              {isOwner && (
                <Button variant="secondary" href={AGENT_ROUTES.profile}>
                  프로필 꾸미기
                </Button>
              )}
            </>
          )}
          {agency.status === AgencyStatus.REJECTED && isOwner && onEdit && (
            <Button onClick={onEdit} iconLeft={<Icon name="edit" size={18} />}>
              수정해서 다시 신청
            </Button>
          )}
          {agency.status === AgencyStatus.SUSPENDED && (
            <Button variant="secondary" href={ROUTES.support} linkAs={Link}>
              고객센터 문의
            </Button>
          )}
        </div>
      </section>

      {(agency.status === AgencyStatus.REJECTED || agency.status === AgencyStatus.SUSPENDED) &&
        agency.statusReason && (
          <Callout
            tone={agency.status === AgencyStatus.REJECTED ? 'danger' : 'warn'}
            title={agency.status === AgencyStatus.REJECTED ? '반려 사유' : '정지 사유'}
          >
            {agency.statusReason}
          </Callout>
        )}

      {docsChanged && (
        <div className={styles.resubmitNotice} role="status">
          <Callout
            tone="warn"
            className={styles.resubmitText}
            title="서류를 바꿨어요. 다시 신청해야 재심사가 시작돼요"
          >
            교체한 서류는 아직 심사 담당자에게 전달되지 않았어요. 신청 내용을 고칠 필요가 없다면
            지금 바로 다시 신청해 주세요.
          </Callout>
          <div className={styles.resubmitActions}>
            <Button onClick={() => setConfirmResubmit(true)} loading={resubmit.isPending}>
              다시 신청
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmResubmit}
        onClose={() => setConfirmResubmit(false)}
        onConfirm={() => resubmit.mutate()}
        loading={resubmit.isPending}
        title="지금 내용으로 다시 신청할까요?"
        description="입력한 내용과 제출 서류가 사실과 같음을 다시 확인하고, 처음 신청할 때 동의한 개인정보 수집·이용 범위 안에서 재심사를 요청해요."
        confirmLabel="다시 신청"
      />

      {agency.status !== AgencyStatus.SUSPENDED && (
        <div className={styles.progress}>
          <Stepper
            label="신청 진행 단계"
            current={view.step}
            steps={APPLICATION_STEPS.map((s) => ({ label: s.label, description: s.description }))}
          />
        </div>
      )}

      <div className={styles.statusCols}>
        <Panel
          title="신청 내용"
          description={
            agency.status === AgencyStatus.APPROVED
              ? '상호·소재지·대표자가 바뀌면 고객센터로 변경 신고를 해 주세요'
              : undefined
          }
        >
          <dl className={styles.facts}>
            {rows.map(([label, value]) => (
              <div key={label} className={styles.fact}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <div className={styles.statusSide}>
          {isOwner && (
            <Panel
              title="제출 서류"
              description={
                rejected
                  ? '바꾼 서류는 다시 신청해야 심사돼요'
                  : canUpload
                    ? '빠진 서류는 여기서 바로 올릴 수 있어요'
                    : canRenew
                      ? '비공개 · 보증서류 갱신본은 여기서 제출해요'
                      : '비공개 · 심사 담당자만 열람'
              }
            >
              <DocumentSlots
                existing={documents}
                pending={uploads.docs}
                onPick={(type, file) => void uploads.pick(type, file)}
                onRemove={uploads.remove}
                readOnly={!canUpload && !canRenew}
                renewOnly={canRenew}
                missing={canUpload ? missing : []}
              />
              {agency.status === AgencyStatus.PENDING && missingRec.length > 0 && (
                <p className={styles.fieldHelp}>
                  손해배상책임 보증서류가 없으면 심사가 보류될 수 있어요.
                </p>
              )}
            </Panel>
          )}
          {isOwner && agency.statusHistory.length > 0 && (
            <Panel title="진행 이력">
              <ol className={styles.timeline}>
                {agency.statusHistory.map((h) => (
                  <li key={h.id} className={styles.event}>
                    <span
                      className={cx(styles.eventDot, styles[`dot${h.toStatus}`])}
                      aria-hidden="true"
                    />
                    <p className={styles.eventTitle}>
                      {h.fromStatus === null
                        ? '신청 접수'
                        : h.toStatus === AgencyStatus.PENDING
                          ? '재신청 접수'
                          : AGENCY_STATUS_LABEL[h.toStatus]}
                      <time dateTime={h.createdAt}>{formatDateTime(h.createdAt)}</time>
                    </p>
                    {h.reason && <p className={styles.eventReason}>{h.reason}</p>}
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
