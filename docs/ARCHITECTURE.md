# 아키텍처

순천시 부동산 공동중개 플랫폼의 백엔드·인프라 설계 결정 사항입니다. 모듈 팀의 작업 규칙은
[CONVENTIONS.md](./CONVENTIONS.md)(영문)를 참고하세요.

## 1. 제품 범위

- 지도 기반 매물 탐색: 아파트·분양권, 원룸·투룸, 주택, 상업·업무, 토지
- **공동중개**: 하나의 매물에 여러 중개사무소가 함께 광고(대표 중개사무소 1곳 + 공동중개 사무소)
- **내놓기 / 구하기**: 소유자는 매물을 내놓고, 수요자는 원하는 조건을 등록 → 지역 중개사무소가 제안
- 중개사무소 찾기, 단지 정보·실거래가, 관심(찜)·최근 본 매물
- 관리자: 배너·팝업(슬롯/예약/타겟팅/통계), 중개사무소 승인, 허위매물 신고 처리, 공지/FAQ/영상,
  사이트 설정(사업자 정보), 약관 버전, 회원 관리, 감사 로그
- 소셜 로그인은 **카카오 · 네이버 · Google만** 지원합니다. **Apple 로그인과 SMS는 만들지 않습니다**
  (운영자 결정).
- 프론트엔드(Next.js 사용자 사이트, 관리자)는 디자인 확정 후 구현. 현재는 빌드·기동되는 플레이스홀더입니다.

## 2. 저장소 구조 (pnpm workspaces + Turborepo)

| 경로              | 설명                                                                  |
| ----------------- | --------------------------------------------------------------------- |
| `apps/api`        | NestJS 11 (Express) — 유일한 백엔드. 전역 prefix `/api/v1`, 포트 4000 |
| `apps/api` 워커   | `dist/worker.js` — HTTP 없는 BullMQ 워커 프로세스 (모든 작업 처리)    |
| `apps/web`        | Next.js 15 App Router 사용자 사이트 (포트 3000, `/healthz`)           |
| `apps/admin`      | Next.js 15 App Router 관리자 (포트 3001, `/healthz`)                  |
| `packages/shared` | zod 스키마, enum, 상수, 에러 코드, 유틸 (api·프론트 공용, `tsc` 빌드) |
| `packages/config` | 공용 tsconfig / ESLint flat config 프리셋                             |

TypeScript strict, ESLint(flat config, type-aware) + Prettier, Node 22 LTS.
**Docker·컨테이너·virtualenv는 사용하지 않습니다** (로컬과 VPS 모두 OS 패키지로 설치한 PostgreSQL / Redis / nginx 사용).

## 3. 데이터베이스

- PostgreSQL 16 + PostGIS 3.4 + pg_trgm, ORM은 Prisma 6 (멀티 파일 스키마 `apps/api/prisma/schema/*.prisma`, 모듈별 파일).
- 테이블·컬럼은 snake_case(`@@map`/`@map`), PK는 UUIDv7, 시간은 `timestamptz(3)`.
- 금액은 **만원 단위 정수**(관리비만 원 단위), 면적은 ㎡ `Decimal(10,2)` (평은 표시용: 1평 = 3.305785㎡).
- **지오**: 위치가 있는 엔티티(지역, 중개사무소, 단지, 매물/물건, 내놓기)는 `lat`/`lng`와 함께
  `location geography(Point,4326)` 컬럼을 가집니다. `location`은 마이그레이션의 트리거
  `house_sync_location()`이 lat/lng로부터 자동 유지하며(앱은 쓰지 않음), GIST 인덱스가 걸려 있습니다.
  지오 쿼리는 `$queryRaw` 태그드 템플릿 + `common/geo` 헬퍼로만 작성합니다(문자열 연결 SQL 금지).
- **한글 검색**: 중개사무소명/주소, 단지명/주소, 물건 주소, 지역명에 pg_trgm GIN 인덱스.
- DB 수준 불변식: 매물당 대표 중개사무소 1곳(부분 유니크 인덱스), 좌표 범위·가격 음수 금지·노출 기간 CHECK 제약.
- 첫 마이그레이션 `20261123000000_init`: 확장(postgis, pg_trgm), 전체 테이블/enum/인덱스, 트리거, CHECK 제약.

### 주요 모델

| 영역          | 모델                                                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 회원·인증     | User, Identity(provider, providerUserId 유니크), AdminUser(argon2id + TOTP), TermsDocument, UserConsent                                                                               |
| 매물          | Property(물건, **호수는 비공개**), Listing(거래 조건·상태·검색용 비정규화 컬럼), ListingAgency(공동중개), ListingPhoto, ListingVerification(실매물 확인), FavoriteListing, RecentView |
| 단지          | Complex, ComplexAreaType(평형), ComplexPhoto, TradeRecord(실거래), ComplexTradeStat(월별 통계), TradeSyncRun, FavoriteComplex                                                         |
| 중개사무소    | Agency(등록번호·대표·승인 상태), AgencyMember, AgencyDocument(비공개 서류), AgencyStatusHistory, AgencyWarning                                                                        |
| 내놓기/구하기 | DealRequest, DealRequestTarget, DealRequestPhoto, Proposal, ProposalListing, DealRequestContactGrant(연락처 공개 동의)                                                                |
| 광고          | BannerSlotConfig, Banner, BannerTargetRegion/Complex, BannerStatDaily, Popup                                                                                                          |
| 미디어        | Media(PUBLIC/PRIVATE, 변환본 variants)                                                                                                                                                |
| 운영          | Report(허위매물 신고), AuditLog, Notice, Faq, LocalVideo, SiteSetting, Region, Notification                                                                                           |

## 4. Redis

ioredis 단일 클라이언트(키 prefix `REDIS_KEY_PREFIX`) — 서버 세션, 레이트 리밋(@nestjs/throttler + Redis
storage, Lua 원자 처리), 일일 한도(DailyCapService), 캐시(CacheService: 지도 타일, 배너 노출 등 짧은 TTL),
BullMQ 큐와 반복 작업(실거래가 동기화, 배너 통계 반영, 이미지 처리, 조회수 반영, 알림, 정리 작업).

**프로세스 분리**: HTTP API(`dist/main.js`)는 작업을 큐에 넣기만 하고 프로세서를 실행하지 않습니다.
모든 프로세서와 반복 작업 등록은 별도 워커(`dist/worker.js`, PM2 `house-worker`)에서만 돌아갑니다.
진입점이 AppModule보다 먼저 역할을 정하고(`src/roles/api.ts` → `JOBS_ENABLED=false`,
`src/roles/worker.ts` → `true`), 모든 `@Processor`는 `autorun: false`로 선언되어 `JOBS_ENABLED`일 때만
워커를 시작합니다(`src/processors.spec.ts`가 강제). 큰 이미지 디코딩·실거래가 동기화가 API 메모리를
밀어내지 않고, API를 여러 인스턴스로 늘려도 작업이 중복 실행되지 않습니다.

## 5. 인증·권한

- **서버 세션**: 256비트 랜덤 불투명 토큰을 httpOnly · Secure(운영) · SameSite=Lax 쿠키로 전달,
  Redis에는 토큰의 SHA-256을 키로 세션 저장. 슬라이딩 만료 + 절대 만료, 사용자별 세션 목록(전체 로그아웃).
  사용자 쿠키 `house_sid`, 관리자 쿠키 `house_admin_sid`(짧은 수명) 분리.
- **CSRF**: 상태 변경 요청은 Origin/Referer 허용 목록 검사 + 더블 서브밋 토큰(`house_csrf` 쿠키 =
  `x-csrf-token` 헤더, 세션에 바인딩).
- **소셜 로그인**(Passport 미사용, 자체 구현 OAuth2 authorization code): 카카오, 네이버, Google(PKCE +
  OIDC id_token을 Google JWKS로 검증). provider registry 구조로 추후 다른 제공자 추가 가능.
  라우트는 고정(콘솔 등록 완료): `GET /api/v1/auth/oauth/{kakao|naver|google}/start`,
  `GET /api/v1/auth/oauth/{kakao|naver|google}/callback`. state·nonce는 Redis에 TTL로 저장(1회용).
  계정 연결은 (provider, providerUserId)로만 — **검증되지 않은 이메일로 자동 연결 금지**.
- **관리자**: 이메일 + 비밀번호(argon2id) + **필수 TOTP 2단계 인증**, 짧은 세션, 선택적 IP 허용 목록,
  로그인 실패 잠금. `/api/v1/admin/**`는 TOTP 검증된 관리자 세션만 접근.
- **역할**: USER, AGENT(중개사무소 소속), AGENCY_OWNER, OPERATOR, ADMIN, SUPER_ADMIN.
  전역 AuthGuard + `@Public()` / `@Roles()` / `@AdminOnly()` 데코레이터, 서비스 단에서 리소스 소유권 검사
  (타인 리소스는 404 — IDOR 방지).
- **SMS·휴대폰 인증 없음**: 휴대폰 번호는 사용자가 입력하는 단순 연락처 필드입니다(형식 검증·정규화만,
  인증 안 함). 카카오/네이버가 동의하에 제공하면 프로필에서 미리 채웁니다. 어뷰징 방지는 로그인 필수(소셜),
  레이트 리밋, 사용자별 일일 한도, 관리자 모더레이션, 신고로 대응합니다.

## 6. 법규 반영 (공인중개사법 제18조의2, 표시·광고 명시사항 세부기준)

매물 게시(DRAFT → ACTIVE) 시 게시 검증기가 다음 항목을 필수로 확인합니다: 소재지, 면적, 가격,
중개대상물 종류, 거래형태, 총층수, 해당층(저/중/고 표시 가능), 사용승인일, 방향(및 기준), 방·욕실 수,
입주가능일, 주차대수, 관리비 — 그리고 담당 중개사무소의 명칭, 소재지, 연락처, 등록번호, 개업공인중개사 성명.
누락 시 `LISTING_PUBLISH_REQUIREMENTS` 에러와 누락 항목 목록을 반환합니다. 호수(ho)는 공개 응답에 절대 포함하지 않습니다.

## 7. 지도 검색

입력: bbox(`swLng,swLat,neLng,neLat`, 최대 2°) + zoom + 필터(유형, 거래유형, 가격(만원), 면적, 방/욕실,
방향, 층, 준공년도, 옵션). 출력: 낮은 줌은 읍면동 집계 클러스터, 중간 줌은 `ST_SnapToGrid` 그리드 클러스터,
높은 줌은 단지/매물 마커(거래유형별 개수, 최저/최고가). 목록 API는 페이지네이션 + 정렬(최신순, 실매물확인순,
가격순, 면적순, 준공년순, 사진순). 인덱스·LIMIT·Redis 타일 캐시(짧은 TTL)로 응답 속도를 확보합니다.

## 8. 미디어

로컬 디스크(`UPLOAD_DIR`, 예: `/var/lib/house/uploads`)에 저장하고 nginx가 `/media/*`로 제공.
sharp로 webp 변환본(thumb/medium/large) 생성, EXIF 제거, 매직 바이트 MIME 판별, 용량 제한, 랜덤 파일명.
중개사무소 등록증 등 비공개 서류는 공개 루트 밖(`PRIVATE_UPLOAD_DIR`)에 저장하고 권한 확인 엔드포인트로만 제공합니다.

## 9. 실거래가

국토교통부 아파트 매매·전월세 실거래가 API(data.go.kr)를 `REGION_SGG_CODE`(전남광주통합특별시 순천시 12150, 설정 가능)
기준으로 BullMQ 반복 작업이 월 단위 동기화합니다. 원천 행의 결정적 해시(`sourceKey`)로 멱등 upsert, 실행 이력 기록,
평형별 최근 거래·월별 중위가 통계 재계산. 테스트는 픽스처 기반 가짜 클라이언트를 사용(네트워크 없음).
어떤 달이 0건이면 옛 코드(46150)로 한 번 더 조회하고(경고 로그), 응답의 지역 코드·단지 일련번호(aptSeq)는 새 코드로
정규화합니다. 옛 코드로 저장된 거래는 다음 동기화 때 같은 행의 `sourceKey`를 새 값으로 바꿔 중복 없이 이어집니다.

### 지역 코드 (2026-07-01 행정구역 개편)

순천시는 `12150`(시도 `12` 전남광주통합특별시)입니다. 저장·응답에는 새 코드만 씁니다. 옛 코드(`46150…`, `46`)는
`packages/shared`의 `canonicalRegionCode()`/`legacyRegionCode()` 한 곳에서만 다루며, 지역 코드를 받는 모든 입력 스키마
(`regionCodeSchema`, `emdCodeSchema`, 매물 `property.emdCode`, 단지 `externalCode`)와 외부 응답(실거래가, 브이월드),
`REGION_SGG_CODE` 환경변수에서 새 코드로 바뀝니다. 기존 데이터는 마이그레이션 `20261124063850_region_code_12150`이
옮겼습니다. 중개사무소 등록번호(`46150-2020-00012`)는 발급 번호라 그대로 둡니다. 브이월드 등록번호 대조는 `ldCode=12150`으로
먼저 조회하고, 일치하는 사무소가 없으면 `46150`으로 한 번 더 조회합니다.

## 10. 광고

배너 슬롯(MAIN_HERO, MAIN_STRIP, MAP_AD, COMPLEX_FEATURED_AGENCY, LISTING_SIDE, AGENCY_SEARCH_TOP, MOBILE_MAIN)별
최대 개수, PC/모바일 이미지, 링크(새 창), 노출 기간, 상태(ACTIVE/PAUSED/SCHEDULED/ENDED — 계산값), 우선순위·정렬,
타겟팅(전체/지역/단지). 노출·클릭은 세션 단위 중복 제거 후 Redis 카운터 → 일별 통계로 반영. 클릭은 URL을
검증하는 리다이렉트 엔드포인트를 거칩니다. 팝업은 대상 페이지, 기간, "N일 동안 보지 않기", 순서를 가집니다.
공개 조회 API는 캐시되며 현재 노출 중인 항목만 반환합니다.

## 11. 설정·관측·보안

- 설정: `@nestjs/config` + zod 검증(`apps/api/src/config/env.schema.ts`), 전체 목록은 `apps/api/.env.example`.
  운영 환경에서 개발용 시크릿·Swagger 활성화·비보안 쿠키는 부팅 단계에서 거부됩니다.
- 로그: nestjs-pino 구조화 로그(JSON), 요청 ID(`x-request-id`, AsyncLocalStorage로 전파), 쿠키/CSRF 헤더 마스킹.
- 헬스체크: `GET /api/v1/health`(liveness), `GET /api/v1/health/ready`(DB + Redis, 실패 시 503).
- graceful shutdown(SIGTERM 시 Prisma/Redis/BullMQ 정리), Swagger(`/api/v1/docs`)는 env 플래그로만.
- helmet, CORS 허용 목록, compression, 본문 크기 제한, 전역 zod 검증, 전역 예외 필터
  (에러 형태 `{ code, message, details?, requestId }`, 사용자 메시지는 한국어), 인증·신고·내놓기 등 레이트 리밋,
  모든 관리자 변경 작업 감사 로그(누가, 무엇을, 변경 전/후, IP).

## 12. 테스트

Jest 단위 테스트 + supertest e2e를 **실제 Postgres/Redis**로 실행합니다. 모듈마다 전용 DB(`house_test_<module>`)와
Redis DB 인덱스(1~8)를 사용해 병렬 실행해도 충돌하지 않습니다. 외부 API(OAuth, data.go.kr, 중개업소 조회)는
인터페이스 뒤에 두고 테스트에서는 가짜/픽스처를 사용합니다. 모든 엔드포인트는 정상·권한 실패·검증 실패 e2e를 가집니다.

## 13. 모듈 간 연결 (통합 단계에서 확정)

| 연결                                 | 방식                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 미디어 첨부 (매물·중개사무소·내놓기) | 각 모듈 port → `MediaService.assertUsable(ids, rule, tx)` (같은 트랜잭션에서 잠금) + 분리 시 `released` |
| 중개사무소 상태 변경 → 매물·광고     | `ListingsModerationService.onAgencyStatusChanged/memberDeparted` + `AdsInvalidationService`             |
| 관리자 매물 조치 (숨김·거래완료)     | `ListingsModerationService` (hide/close/unhide, `invalidateSearch`)                                     |
| 회원 탈퇴                            | 같은 트랜잭션에서 내놓기·구하기 삭제(`DealRequestMaintenanceService.scrubUser`), 매물 담당자 이관       |
| 탈퇴 회원 PII 파기 작업              | `MediaService.scrubOwner`로 업로드 파일명 삭제·미첨부 파일 제거                                         |
| 알림                                 | `notifications` 테이블 (`LISTING_EXPIRED`, `CO_BROKER_REQUESTED` 등), 외부 발송(SMS 등) 없음            |
| 감사 로그 안전망                     | `AuditService.record`가 요청 컨텍스트에 기록 여부 표시 → 관리자 변경에 기록이 없으면 자동 기록          |

라우팅은 대소문자를 구분합니다(`/api/v1/ADMIN/...`은 404). 외래 키 경합(P2003)은 409로 응답합니다.
스키마와 마이그레이션의 차이는 `pnpm db:drift`로 검사합니다(CI·배포 전 필수).

## 14. 배포

단일 VPS(Ubuntu)에 Node 22, PostgreSQL 16 + PostGIS, Redis, nginx를 OS 패키지로 설치하고 PM2로
house-api(cluster)·house-worker(fork 1개)·house-web·house-admin을 관리합니다(Docker 미사용).
nginx가 TLS 종료, `/api` → API, 사용자 사이트·관리자 → Next.js, `/media/*` → `UPLOAD_DIR` 정적 제공을
담당합니다. 설치·배포·롤백·백업 절차는 [DEPLOY.md](DEPLOY.md), 운영은 [OPERATIONS.md](OPERATIONS.md).
