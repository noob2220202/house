'use client';
import { AgencyMemberRole, AgencyStatus } from '@house/shared';
import { ErrorState, LoadingRegion, Panel, Skeleton, Tabs } from '@house/ui';
import Link from 'next/link';
import { useState } from 'react';
import { BRAND } from '@/config/brand';
import { ApiError } from '@/lib/api';
import { useMyAgency } from '../api/useMyAgency';
import { AGENT_ROUTES } from '../nav';
import { ConsolePage, ConsolePageHeader } from '../shell';
import styles from './Apply.module.css';
import { ApplicationStatus } from './ApplicationStatus';
import { ApplyForm } from './ApplyForm';
import { JoinForm } from './JoinForm';

export type ApplyTab = 'register' | 'join';

export interface ApplyViewProps {
  /** From `?tab=join` (server-read so the tab is linkable). */
  tab: ApplyTab;
}

function ApplySkeleton() {
  return (
    <LoadingRegion label="신청 정보를 불러오는 중">
      <Skeleton height={132} radius={16} />
      <Skeleton height={300} radius={16} style={{ marginTop: 20 }} />
      <Skeleton height={300} radius={16} style={{ marginTop: 20 }} />
    </LoadingRegion>
  );
}

/** /agent/apply — application form, invite-code join, or status tracking, depending on state. */
export function ApplyView({ tab }: ApplyViewProps) {
  const [editing, setEditing] = useState(false);
  // Set by a successful submit → the status screen focuses its heading (screen-reader context).
  const [justSubmitted, setJustSubmitted] = useState(false);
  const { data: agency, isPending, isError, error, refetch } = useMyAgency();

  if (isPending) {
    return (
      <ConsolePage width="narrow">
        <ConsolePageHeader title="중개사 회원 신청" />
        <ApplySkeleton />
      </ConsolePage>
    );
  }
  if (isError) {
    return (
      <ConsolePage width="narrow">
        <ConsolePageHeader title="중개사 회원 신청" />
        <Panel>
          <ErrorState
            compact
            title="신청 정보를 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
            onRetry={() => void refetch()}
            code={error instanceof ApiError ? error.requestId : undefined}
          />
        </Panel>
      </ConsolePage>
    );
  }

  // No agency yet → new application or join by invite code.
  if (!agency) {
    return (
      <ConsolePage width="narrow">
        <ConsolePageHeader
          eyebrow="중개사 회원 가입"
          title={tab === 'join' ? '소속 중개사로 합류' : '중개사무소 등록 신청'}
          description={
            tab === 'join'
              ? '이미 등록된 사무소의 소속공인중개사·중개보조원이라면 대표님께 받은 초대 코드로 바로 합류할 수 있어요.'
              : `${BRAND.region}에서 영업 중인 개업공인중개사라면 사무소를 등록하고 공동중개 매물을 올릴 수 있어요. 서류 심사는 영업일 기준 1~2일 걸려요.`
          }
        />
        <Tabs
          label="가입 방법"
          idBase="apply"
          value={tab}
          linkAs={Link}
          items={[
            { value: 'register', label: '사무소 등록 신청 (대표)', href: AGENT_ROUTES.apply },
            { value: 'join', label: '초대 코드로 합류 (소속)', href: AGENT_ROUTES.applyJoin },
          ]}
        />
        <div className={styles.tabBody}>
          {tab === 'join' ? <JoinForm /> : <ApplyForm onSubmitted={() => setJustSubmitted(true)} />}
        </div>
      </ConsolePage>
    );
  }

  const isOwner = agency.myRole === AgencyMemberRole.OWNER;
  if (editing && isOwner && agency.status === AgencyStatus.REJECTED) {
    return (
      <ConsolePage width="narrow">
        <ConsolePageHeader
          eyebrow="중개사 회원 가입"
          title="신청서 수정"
          description="반려 사유를 확인하고 내용이나 서류를 고친 뒤 다시 신청해 주세요."
        />
        <ApplyForm
          agency={agency}
          onCancel={() => setEditing(false)}
          onSubmitted={() => {
            setEditing(false);
            setJustSubmitted(true);
          }}
        />
      </ConsolePage>
    );
  }

  const approved = agency.status === AgencyStatus.APPROVED;
  return (
    <ConsolePage width="narrow">
      <ConsolePageHeader
        eyebrow={approved ? '사무소' : '중개사 회원 가입'}
        title={approved ? '등록 정보' : '신청 현황'}
        description={
          approved
            ? isOwner
              ? '승인받은 중개사무소 등록 정보와 제출 서류예요.'
              : '소속 중개사무소의 등록 정보예요.'
            : '심사 진행 상황과 제출한 내용을 확인할 수 있어요.'
        }
      />
      <ApplicationStatus
        agency={agency}
        onEdit={() => setEditing(true)}
        focusOnMount={justSubmitted}
      />
    </ConsolePage>
  );
}
