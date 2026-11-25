import { type AuthProvider, type TermsType, UserRole, UserStatus } from '@house/shared';
import type { AdminUserDetail, AdminUserListItem } from '@/features/m-moderation/api/schemas';
import { ago, mid, mockTable } from '@/features/m-moderation/mock/handler';
import { agenciesDb } from '../agencies/_fixtures';

/** Regular member #i (0-based) — referenced by deal-requests / reports fixtures. */
export const memberId = (i: number) => mid('c1', 100 + i);

const NAMES = [
  '김하준',
  '이서아',
  '박지호',
  '최다인',
  '정우진',
  '한소율',
  '조민서',
  '윤시우',
  '장예준',
  '임나은',
  '오지안',
  '서하윤',
  '신도윤',
  '권유진',
  '황준서',
  '안채은',
  '송태윤',
  '전수빈',
  '홍지유',
  '고은호',
  '문서연',
  '양현서',
  '손아린',
  '배주원',
  '백하람',
  '허민준',
  '유다온',
  '남시현',
  '심예나',
  '노윤우',
];
const NICKS = [
  '신대사는곰',
  '연향동주민',
  '순천새댁',
  '오천러버',
  '조례호수산책',
  '왕지숲길',
  '석현자취생',
  '선월예비입주',
  '금당토박이',
  '덕연동아빠',
  '순천만노을',
  '풍덕동이웃',
  '매곡언덕',
  '장천역세권',
  '가곡텃밭',
  '별량바람',
];
const PROVIDERS: AuthProvider[][] = [
  ['KAKAO'],
  ['KAKAO'],
  ['NAVER'],
  ['KAKAO', 'NAVER'],
  ['GOOGLE'],
  ['KAKAO'],
  ['NAVER'],
  ['KAKAO', 'GOOGLE'],
];

const TERMS: { type: TermsType; title: string; version: string; isRequired: boolean }[] = [
  { type: 'SERVICE', title: '이용약관', version: '1.2', isRequired: true },
  { type: 'PRIVACY', title: '개인정보 수집·이용 동의', version: '1.3', isRequired: true },
  { type: 'LOCATION', title: '위치기반서비스 이용약관', version: '1.0', isRequired: false },
  { type: 'MARKETING', title: '마케팅 정보 수신 동의', version: '1.0', isRequired: false },
];

interface Base {
  n: number;
  id: string;
  name: string;
  /** Null: a live social sign-up that never set a nickname (Google). */
  nickname: string | null;
  role: UserRole;
  status?: UserStatus;
  providers: AuthProvider[];
  joinedDaysAgo: number;
  lastLoginHoursAgo: number;
  agency?: AdminUserDetail['agency'];
  suspendedReason?: string;
  withdrawalReason?: string;
  scrubbed?: boolean;
  dealRequests?: number;
  reports?: number;
}

function build(b: Base): AdminUserDetail {
  const digits = String(b.n % 100).padStart(2, '0');
  const status = b.status ?? UserStatus.ACTIVE;
  const createdAt = ago({ d: b.joinedDaysAgo, h: (b.n * 5) % 23 });
  const marketing = b.n % 3 === 0;
  const location = b.n % 4 !== 1;
  const withdrawn = status === UserStatus.WITHDRAWN;
  const suspendedAt = status === UserStatus.SUSPENDED ? ago({ d: 2 + (b.n % 5), h: 3 }) : null;
  const pii = !b.scrubbed;
  return {
    id: b.id,
    name: pii ? b.name : null,
    nickname: pii ? b.nickname : null,
    email: pii ? `user${String(b.n).padStart(3, '0')}@example.com` : null,
    phone: pii && b.n % 6 !== 5 ? `0100000${String(1000 + b.n).slice(-4)}` : null,
    role: b.role,
    status,
    providers: b.scrubbed ? [] : b.providers,
    agency: b.agency ?? null,
    createdAt,
    lastLoginAt: withdrawn
      ? ago({ d: 20 + (b.n % 9) })
      : status === UserStatus.SUSPENDED
        ? ago({ d: 2 + (b.n % 5), h: 9 })
        : ago({ h: b.lastLoginHoursAgo, m: (b.n * 7) % 50 }),
    suspendedAt,
    suspendedReason: b.suspendedReason ?? null,
    withdrawnAt: withdrawn ? ago({ d: b.scrubbed ? 41 : 6, h: 2 }) : null,
    withdrawalReason: b.withdrawalReason ?? null,
    piiScrubAfter: withdrawn ? ago({ d: b.scrubbed ? 11 : -24 }) : null,
    piiScrubbedAt: b.scrubbed ? ago({ d: 11 }) : null,
    marketingOptIn: marketing && !withdrawn,
    identities: b.scrubbed
      ? []
      : b.providers.map((provider, i) => ({
          id: mid('c2', b.n * 10 + i),
          provider,
          email: `${provider.toLowerCase()}${digits}@example.com`,
          emailVerified: provider !== 'KAKAO' || b.n % 2 === 0,
          lastUsedAt:
            i > 0
              ? ago({ d: 14 + i * 9 })
              : status === UserStatus.SUSPENDED
                ? ago({ d: 2 + (b.n % 5), h: 9 })
                : ago({ h: b.lastLoginHoursAgo }),
          createdAt: i === 0 ? createdAt : ago({ d: Math.max(1, b.joinedDaysAgo - 40) }),
        })),
    consents: TERMS.map((t, i) => ({
      id: mid('c3', b.n * 10 + i),
      termsType: t.type,
      termsTitle: t.title,
      version: t.version,
      isRequired: t.isRequired,
      agreed: t.isRequired || (t.type === 'MARKETING' ? marketing : location),
      createdAt,
    })),
    activity: {
      dealRequestCount: b.dealRequests ?? b.n % 3,
      reportCount: b.reports ?? (b.n % 7 === 0 ? 1 : 0),
      favoriteCount: (b.n * 3) % 17,
      activeSessionCount: status === UserStatus.ACTIVE ? 1 + (b.n % 2) : 0,
    },
    sanctions:
      status === UserStatus.SUSPENDED
        ? [
            {
              id: mid('c4', b.n),
              action: 'SUSPENDED',
              reason: b.suspendedReason ?? null,
              adminName: '한지우',
              createdAt: suspendedAt ?? createdAt,
            },
          ]
        : [],
  };
}

function seed(): AdminUserDetail[] {
  const rows: AdminUserDetail[] = [];
  // Office owners / applicants (ids match agencies/_fixtures.ts `ownerUserId`).
  agenciesDb().forEach((a, i) => {
    const n = Number(a.owner?.id.slice(-4) ?? i + 1);
    const approved = a.status === 'APPROVED' || a.status === 'SUSPENDED';
    rows.push(
      build({
        n,
        id: a.owner?.id ?? mid('c1', n),
        name: a.representativeName,
        nickname: a.owner?.nickname ?? a.representativeName,
        role: approved ? UserRole.AGENCY_OWNER : UserRole.USER,
        providers: a.owner?.providers ?? ['KAKAO'],
        joinedDaysAgo: Math.round((Date.now() - new Date(a.createdAt).getTime()) / 86_400_000) + 3,
        lastLoginHoursAgo: 2 + i * 3,
        agency: { id: a.id, name: a.name, status: a.status, memberRole: 'OWNER' },
        dealRequests: 0,
        reports: 0,
      }),
    );
    a.members
      .filter((m) => m.role === 'AGENT')
      .forEach((m, k) => {
        const sn = 60 + rows.length + k;
        rows.push(
          build({
            n: sn,
            id: mid('c1', sn),
            name: m.displayName,
            nickname: `${m.displayName.slice(1)}중개`,
            role: UserRole.AGENT,
            providers: PROVIDERS[sn % PROVIDERS.length]!,
            joinedDaysAgo: 120 + sn,
            lastLoginHoursAgo: 5 + k * 9,
            agency: { id: a.id, name: a.name, status: a.status, memberRole: 'AGENT' },
            dealRequests: 0,
            reports: 0,
          }),
        );
      });
  });
  // Regular members.
  NAMES.forEach((name, i) => {
    const special: Partial<Base> =
      i === 7
        ? {
            status: 'SUSPENDED',
            suspendedReason:
              '같은 내용의 구하기 요청을 연락처만 바꿔 반복 등록해 스팸으로 확인되었습니다.',
            dealRequests: 6,
          }
        : i === 18
          ? {
              status: 'SUSPENDED',
              suspendedReason: '사실과 다른 허위매물 신고를 반복 접수했습니다(기각 5건).',
              reports: 7,
            }
          : i === 4
            ? { nickname: null, providers: ['GOOGLE'] }
            : i === 12
              ? { status: 'WITHDRAWN', withdrawalReason: '이사를 마쳐서 더 이용하지 않아요.' }
              : i === 25
                ? { status: 'WITHDRAWN', scrubbed: true }
                : {};
    rows.push(
      build({
        n: 100 + i,
        id: memberId(i),
        name,
        nickname: `${NICKS[i % NICKS.length]}${i >= NICKS.length ? i : ''}`,
        role: UserRole.USER,
        providers: PROVIDERS[i % PROVIDERS.length]!,
        joinedDaysAgo: i < 6 ? i : 9 + i * 13,
        lastLoginHoursAgo: 1 + i * 4,
        ...special,
      }),
    );
  });
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function usersDb(): AdminUserDetail[] {
  return mockTable('users', seed);
}

export function toUserListItem(u: AdminUserDetail): AdminUserListItem {
  return {
    id: u.id,
    name: u.name,
    nickname: u.nickname,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
    providers: u.providers,
    agency: u.agency ? { id: u.agency.id, name: u.agency.name } : null,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    suspendedAt: u.suspendedAt,
    withdrawnAt: u.withdrawnAt,
  };
}
