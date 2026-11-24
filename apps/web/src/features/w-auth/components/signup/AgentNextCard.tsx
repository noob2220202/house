import { Button, Icon } from '@house/ui';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import styles from './signup.module.css';

/**
 * "중개사무소 인증 한 단계가 더 있어요" (Login.dc.html `.agent`). The verification form itself lives
 * on /agent/apply (broker console group) — this card explains the step and links to it.
 * `ready` = signup finished, so the call to action is enabled.
 */
export function AgentNextCard({ ready }: { ready: boolean }) {
  return (
    <section className={styles.agent} aria-labelledby="agent-next-h">
      <div className={styles.agentL}>
        <span className={styles.agentIc}>
          <Icon name="shield" size={24} />
        </span>
        <p className={`eyebrow ${styles.reed}`}>중개사 회원으로 가입하면</p>
        <h2 id="agent-next-h" className="t-h2">
          중개사무소 인증 한 단계가 더 있어요
        </h2>
        <p className="t-body">
          허위매물을 막기 위해 시·군·구청에 등록된 중개사무소만 매물을 올릴 수 있어요. 운영팀이
          확인한 뒤 보통 1영업일 안에 승인 알림을 드려요.
        </p>
        <ol className={styles.agentSteps}>
          <li>
            <b>1</b>개설등록번호 조회
          </li>
          <li>
            <b>2</b>사업자등록증 확인
          </li>
          <li>
            <b>3</b>승인 후 매물·광고 관리 시작
          </li>
        </ol>
      </div>
      <div className={styles.agentR}>
        <p className="t-title">미리 준비해 주세요</p>
        <dl className={styles.prep}>
          <div>
            <dt>개설등록번호</dt>
            <dd>중개사무소 등록증에 적힌 번호</dd>
          </div>
          <div>
            <dt>사업자등록증</dt>
            <dd>JPG · PNG · PDF, 10MB 이하</dd>
          </div>
          <div>
            <dt>대표 공인중개사</dt>
            <dd>등록증의 대표자 성명과 일치</dd>
          </div>
        </dl>
        {ready ? (
          <Button
            href={ROUTES.agentApply}
            linkAs={Link}
            variant="ink"
            size="lg"
            block
            iconRight={<Icon name="chevron-right" size={18} />}
          >
            중개사무소 인증 시작하기
          </Button>
        ) : (
          <p className={styles.agentHint}>
            위에서 약관 동의를 마치면 바로 중개사무소 인증 신청으로 이동해요. 서류는 본인만 볼 수
            있게 비공개로 보관돼요.
          </p>
        )}
      </div>
    </section>
  );
}
