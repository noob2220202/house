'use client';
import { AgencyStatus } from '@house/shared';
import {
  Button,
  Chip,
  ConfirmDialog,
  EmptyState,
  Icon,
  Modal,
  Table,
  Textarea,
  cx,
  useToast,
  type TableColumn,
} from '@house/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ADMIN_ROUTES } from '@/config/nav';
import {
  REGISTRY_STATUS_META,
  readyToApprove,
  waitingLabel,
} from '@/features/m-moderation/lib/labels';
import { errorMessage } from '@/lib/api';
import { formatMonthDay } from '@/lib/format';
import { decideAgency, type PendingAgency } from '../../api';
import { documentsStatus, waitingState } from '../../lib/dashboard';
import { DashPanel, PanelState } from './DashPanel';
import styles from './dashboard.module.css';

type Intent = { kind: 'approve' | 'reject'; agency: PendingAgency };

const REJECT_PRESETS = [
  '등록번호가 중개업 등록 정보와 일치하지 않습니다.',
  '대표자 정보가 등록 정보와 다릅니다.',
  '제출 서류를 확인할 수 없습니다.',
  '휴업·폐업 상태의 중개사무소입니다.',
];

const REASON_MAX = 1000;

const agencyHref = (id: string) => `${ADMIN_ROUTES.agencies}/${id}`;

function RejectDialog({
  agency,
  busy,
  onClose,
  onSubmit,
}: {
  agency: PendingAgency;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const trimmed = reason.trim();
  const error = touched && !trimmed ? '사유를 입력해 주세요. 신청자에게 그대로 안내됩니다.' : null;
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="승인 신청 반려"
      description="반려 사유는 신청자에게 알림으로 전달되고 작업 기록에 남습니다."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={() => {
              setTouched(true);
              if (trimmed) onSubmit(trimmed);
            }}
          >
            반려하기
          </Button>
        </>
      }
    >
      <dl className={styles.dialogMeta}>
        <dt>상호</dt>
        <dd>{agency.name}</dd>
        <dt>대표 · 등록번호</dt>
        <dd>
          {agency.representativeName} · {agency.registrationNumber}
        </dd>
      </dl>
      <div className={styles.reasons} role="group" aria-label="자주 쓰는 반려 사유">
        {REJECT_PRESETS.map((preset) => (
          <Chip key={preset} selected={reason === preset} onClick={() => setReason(preset)}>
            {preset}
          </Chip>
        ))}
      </div>
      <Textarea
        label="반려 사유"
        required
        rows={4}
        maxLength={REASON_MAX}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onBlur={() => setTouched(true)}
        error={error}
        help={`${reason.length.toLocaleString('ko-KR')} / ${REASON_MAX.toLocaleString('ko-KR')}자`}
        placeholder="신청자가 무엇을 고쳐야 하는지 구체적으로 적어 주세요."
      />
    </Modal>
  );
}

/** "3종 확인" + the registry lookup when it is what keeps the row from a one-click approval. */
function DocumentsCell({ agency }: { agency: PendingAgency }) {
  const docs = documentsStatus(agency.documents);
  const registry = agency.registryStatus;
  const registryMeta = registry ? REGISTRY_STATUS_META[registry] : null;
  return (
    <div className={styles.docsCell}>
      <span className={cx(styles.docs, docs.ok ? styles.ok : styles.miss)}>
        <Icon name={docs.ok ? 'check-circle' : 'alert'} size={16} />
        {docs.label}
      </span>
      {registry !== 'MATCHED' && (
        <span className={cx(styles.registry, registryMeta && styles[registryMeta.tone])}>
          <span className="sr-only">중개업 등록 </span>
          {registryMeta?.label ?? '조회 전'}
        </span>
      )}
    </div>
  );
}

export interface PendingAgenciesPanelProps {
  total: number;
  items: readonly PendingAgency[];
  now: Date;
}

/**
 * 승인 대기 중개사: approve / reject straight from the dashboard. 승인 is offered with the same rule
 * as the /agencies queue (`readyToApprove`); anything else opens the application (심사하기).
 */
export function PendingAgenciesPanel({ total, items, now }: PendingAgenciesPanelProps) {
  const [intent, setIntent] = useState<Intent | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const decision = useMutation({
    mutationFn: (vars: {
      id: string;
      status: typeof AgencyStatus.APPROVED | typeof AgencyStatus.REJECTED;
      reason?: string;
    }) => decideAgency(vars.id, { status: vars.status, reason: vars.reason }),
    onSuccess: (_data, vars) => {
      const name = intent?.agency.name ?? '중개사무소';
      toast(
        vars.status === AgencyStatus.APPROVED
          ? `${name} 신청을 승인했어요`
          : `${name} 신청을 반려했어요`,
      );
      setIntent(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      // …and the /agencies queue, tab counts and an open detail of the same application.
      void queryClient.invalidateQueries({ queryKey: ['admin-agencies'] });
    },
    onError: (error) => toast({ message: errorMessage(error), tone: 'error' }),
  });
  const close = () => {
    if (!decision.isPending) setIntent(null);
  };
  const busyId = decision.isPending ? decision.variables?.id : undefined;

  const columns = useMemo<TableColumn<PendingAgency>[]>(
    () => [
      {
        key: 'office',
        header: '상호',
        cell: (agency) => (
          <div className={styles.office}>
            <span className={styles.officeAv} aria-hidden="true">
              <Icon name="store" size={18} />
            </span>
            <Link href={agencyHref(agency.id)}>
              <b>{agency.name}</b>
              {agency.areaName && <span className={styles.officeSub}>{agency.areaName}</span>}
            </Link>
          </div>
        ),
      },
      {
        key: 'rep',
        header: '대표 · 등록번호',
        cell: (agency) => (
          <div className={styles.when}>
            <b className={styles.rep}>{agency.representativeName}</b>
            <span className={styles.mono}>{agency.registrationNumber}</span>
          </div>
        ),
      },
      {
        key: 'docs',
        header: '서류',
        cell: (agency) => <DocumentsCell agency={agency} />,
      },
      {
        key: 'applied',
        header: '신청일',
        cell: (agency) => {
          const wait = waitingState(agency.appliedAt, now);
          return (
            <div className={styles.when}>
              {formatMonthDay(agency.appliedAt)}
              <span className={cx(wait.overdue && styles.old)}>{waitingLabel(wait.days)}</span>
            </div>
          );
        },
      },
      {
        key: 'actions',
        header: <span className="sr-only">처리</span>,
        cell: (agency) => {
          const busy = busyId === agency.id;
          const ready = readyToApprove(documentsStatus(agency.documents).ok, agency.registryStatus);
          return (
            <div className={styles.acts}>
              <Button
                variant="danger"
                size="sm"
                disabled={busy}
                aria-label={`${agency.name} 반려`}
                onClick={() => setIntent({ kind: 'reject', agency })}
              >
                반려
              </Button>
              {ready ? (
                <Button
                  size="sm"
                  loading={busy}
                  aria-label={`${agency.name} 승인`}
                  onClick={() => setIntent({ kind: 'approve', agency })}
                >
                  승인
                </Button>
              ) : (
                <Button
                  variant="soft"
                  size="sm"
                  href={agencyHref(agency.id)}
                  linkAs={Link}
                  aria-label={`${agency.name} 심사하기`}
                >
                  심사하기
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [busyId, now],
  );

  return (
    <DashPanel
      id="approvals"
      title="승인 대기 중개사"
      count={total}
      caption="등록번호는 국가공간정보 중개업 조회로 자동 대조합니다"
      more={{ label: '중개사 관리', href: ADMIN_ROUTES.agencies }}
    >
      {items.length === 0 ? (
        <PanelState>
          <EmptyState
            compact
            icon="check-circle"
            title="승인을 기다리는 중개사가 없어요"
            description="새 신청이 들어오면 이곳과 알림으로 알려 드립니다."
          />
        </PanelState>
      ) : (
        <div className={styles.tableScroll}>
          <Table
            bare
            density="compact"
            caption="승인 대기 중개사"
            columns={columns}
            rows={items}
            rowKey={(agency) => agency.id}
          />
        </div>
      )}

      <ConfirmDialog
        open={intent?.kind === 'approve'}
        onClose={close}
        onConfirm={() => {
          if (intent?.kind === 'approve')
            decision.mutate({ id: intent.agency.id, status: AgencyStatus.APPROVED });
        }}
        title={`${intent?.agency.name ?? ''} 신청을 승인할까요?`}
        description={
          intent
            ? `대표 ${intent.agency.representativeName} · 등록번호 ${intent.agency.registrationNumber}. 승인하면 대표 계정이 개업공인중개사로 전환되고 매물을 등록할 수 있습니다.`
            : undefined
        }
        confirmLabel="승인"
        loading={decision.isPending}
      />
      {intent?.kind === 'reject' && (
        <RejectDialog
          key={intent.agency.id}
          agency={intent.agency}
          busy={decision.isPending}
          onClose={close}
          onSubmit={(reason) =>
            decision.mutate({ id: intent.agency.id, status: AgencyStatus.REJECTED, reason })
          }
        />
      )}
    </DashPanel>
  );
}
