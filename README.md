# 순천 부동산 공동중개 플랫폼

순천시(전남광주통합특별시) 지역 부동산 공동중개 플랫폼의 모노레포입니다. 지도 기반 매물 탐색(아파트·분양권, 원룸·투룸,
주택, 상업·업무, 토지), 여러 중개사무소의 공동중개, 내놓기/구하기, 중개사무소 찾기, 단지·실거래가 정보,
그리고 배너·팝업·승인·신고·콘텐츠·설정·약관을 모두 다루는 관리자 백오피스를 제공합니다.

- 소셜 로그인: **카카오 · 네이버 · Google** (Apple 로그인 없음)
- **SMS 발송·휴대폰 인증 없음** — 휴대폰 번호는 형식만 검증하는 연락처 필드입니다.
- 서비스 이름: **순천부동산지도** (suncheonmap.kr · 관리자 admin.suncheonmap.kr). 지도: 카카오맵.
- 현재 단계: 사용자 사이트 · 중개사 콘솔 · 관리자 · API · 배포 키트 모두 구현 완료, 출시 준비 단계([docs/STATUS.md](docs/STATUS.md)).

진행 현황: [docs/STATUS.md](docs/STATUS.md) · 설계 문서: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · 개발 규칙(영문): [docs/CONVENTIONS.md](docs/CONVENTIONS.md) ·
배포: [docs/DEPLOY.md](docs/DEPLOY.md) · 운영: [docs/OPERATIONS.md](docs/OPERATIONS.md)

## 구조

```
apps/
  api/        NestJS 11 API (포트 4000, /api/v1) + BullMQ 워커 (src/worker.ts, HTTP 없음)
    prisma/schema/      Prisma 멀티 파일 스키마 + 마이그레이션 (모듈별 .prisma)
    prisma/seed.ts      멱등 시드 (기본 데이터 / SEED_DEMO=true 시 가상 데모 데이터, prisma/seed/)
    src/common/         가드·데코레이터·파이프·필터·감사로그·캐시·지오·페이지네이션
    src/modules/        auth, listings, complexes, agencies, deal-requests, ads, media, admin
    test/               e2e 러너, 모듈별 env(test/env), 테스트 유틸·팩토리, e2e 스펙
  web/        Next.js 15 사용자 사이트 + 중개사 콘솔(/agent) (포트 3000, /healthz)
  admin/      Next.js 15 관리자 백오피스 (포트 3001, /healthz)
packages/
  shared/     zod 스키마 · enum · 상수 · 에러 코드 · 유틸 (api와 프론트 공용)
  ui/         디자인 토큰 + 공용 React 컴포넌트 (web·admin 공용)
  config/     tsconfig / ESLint 프리셋
deploy/       VPS 설치·배포·롤백·백업 스크립트 (install.sh, deploy.sh, rollback.sh …, PM2 + nginx)
docs/         STATUS.md, ARCHITECTURE.md, CONVENTIONS.md, FRONTEND.md, DEPLOY.md, OPERATIONS.md, E2E.md, KEY_SETUP.md
e2e/          Playwright 실제 API 브라우저 테스트 (scripts/e2e-stack.sh, docs/E2E.md)
ecosystem.config.cjs  PM2 프로세스 정의 (house-api, house-worker, house-web, house-admin)
```

## 로컬 개발 (Docker 없이)

필요: Node 22 (`.nvmrc`), pnpm 10 (`corepack enable`), PostgreSQL 16 + PostGIS 3.4 + pg_trgm, Redis 7.

```bash
# 1) DB 준비 (Ubuntu 예시)
sudo apt install postgresql-16 postgresql-16-postgis-3 redis-server
sudo -u postgres psql -c "CREATE ROLE house LOGIN SUPERUSER PASSWORD 'house';"
sudo -u postgres createdb -O house house_dev
# 서비스가 꺼져 있으면: pg_ctlcluster 16 main start ; redis-server --daemonize yes

# 2) 설치 및 환경 변수
pnpm install                       # prisma generate 포함
cp apps/api/.env.example apps/api/.env

# 3) 마이그레이션 + 시드 (확장 postgis/pg_trgm은 마이그레이션이 생성)
pnpm db:migrate
ADMIN_BOOTSTRAP_EMAIL=admin@example.com ADMIN_BOOTSTRAP_PASSWORD='12자-이상-비밀번호' pnpm db:seed:demo
#   기본 시드: 순천시 읍면동(샘플 코드), 배너 슬롯, 사이트 설정 자리표시값, 약관 v1, 최고관리자(OTP는 첫 로그인 때 등록)
#   데모 시드(db:seed:demo): 가상 단지 9곳·중개사무소 8곳·매물 약 200건(공동중개·확인·사진)·실거래가·
#   모든 슬롯 배너·팝업·공지·FAQ·영상. 운영(NODE_ENV=production)에서는 거부됩니다.

# 4) 실행
pnpm dev                           # api:4000 (dist를 계속 빌드), web:3000, admin:3001
pnpm --filter @house/api dev:worker   # 작업 워커 (실거래가·배너 통계·이미지·정리 작업). API는 작업을 실행하지 않습니다.
curl localhost:4000/api/v1/health/ready   # {"status":"ok","checks":{"db":"ok","redis":"ok"}}
```

데모 계정은 모두 가상 데이터이며 소셜 로그인 식별자가 없어 로그인할 수 없습니다. 관리자는 위에서 만든
최고관리자로 `POST /api/v1/admin/auth/login` → `totp/setup` → `totp/activate` 순서로 OTP를 등록합니다.

Swagger 문서는 `SWAGGER_ENABLED=true`일 때 `http://localhost:4000/api/v1/docs`.

## 명령어

| 명령                                                          | 설명                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------- |
| `pnpm dev`                                                    | 전체 개발 서버 (turbo) · `pnpm dev:api` API만              |
| `pnpm build`                                                  | 전체 빌드 (shared → api/web/admin)                         |
| `pnpm lint` / `pnpm typecheck`                                | ESLint / TypeScript 검사                                   |
| `pnpm test`                                                   | 단위 테스트 (DB 불필요)                                    |
| `pnpm test:e2e`                                               | 모든 모듈 e2e (실제 Postgres/Redis, 모듈별 DB)             |
| `pnpm --filter @house/api test:e2e <module>`                  | 특정 모듈 e2e (예: `listings`, 여러 개 가능, `--parallel`) |
| `pnpm db:migrate`                                             | 마이그레이션 적용 (`prisma migrate deploy`)                |
| `pnpm db:seed`                                                | 기본 시드 (멱등, 배포 때마다 자동 실행)                    |
| `pnpm db:seed:demo`                                           | 기본 + 가상 데모 데이터 (로컬·스테이징 전용)               |
| `pnpm db:drift`                                               | Prisma 스키마와 마이그레이션 불일치 검사 (CI·배포 전)      |
| `pnpm lint:deploy` / `pnpm test:deploy`                       | 배포 스크립트 shellcheck / 배포 키트 테스트                |
| `pnpm db:generate`                                            | Prisma Client 생성                                         |
| `pnpm db:test:prepare`                                        | 모든 `house_test_<module>` DB 생성·마이그레이션            |
| `pnpm --filter @house/api db:migration:new <module> <change>` | 스키마 변경분 마이그레이션 생성 (모듈 전용 shadow DB)      |
| `pnpm format`                                                 | Prettier 정리                                              |

## 테스트 DB

모듈별 e2e는 `apps/api/test/env/<module>.env`의 DB와 Redis 인덱스를 사용합니다.

| 모듈                   | DB                       | Redis |
| ---------------------- | ------------------------ | ----- |
| auth                   | house_test_auth          | 1     |
| listings               | house_test_listings      | 2     |
| complexes              | house_test_complexes     | 3     |
| agencies               | house_test_agencies      | 4     |
| deal-requests          | house_test_deal_requests | 5     |
| ads                    | house_test_ads           | 6     |
| media                  | house_test_media         | 7     |
| admin                  | house_test_admin         | 8     |
| core (공통 파이프라인) | house_test_core          | 9     |

개발 DB(`house_dev`)는 Redis 0번을 사용합니다.

## 프로세스 구성 (운영)

| PM2 앱         | 실행 파일                 | 모드        | 역할                                                   |
| -------------- | ------------------------- | ----------- | ------------------------------------------------------ |
| `house-api`    | `apps/api/dist/main.js`   | cluster (2) | HTTP API. 작업은 큐에 넣기만 함 (`JOBS_ENABLED=false`) |
| `house-worker` | `apps/api/dist/worker.js` | fork (1)    | 모든 BullMQ 작업과 반복 작업 등록                      |
| `house-web`    | Next.js `apps/web`        | cluster (2) | 사용자 사이트                                          |
| `house-admin`  | Next.js `apps/admin`      | cluster (1) | 관리자                                                 |

배포(`deploy.sh`)는 새 릴리스를 임시 포트에서 먼저 띄워 점검한 뒤 PM2 reload로 무중단 전환하고,
실패하면 전환하지 않거나 이전 릴리스로 되돌립니다. 자세한 절차는 [docs/DEPLOY.md](docs/DEPLOY.md).

## 알아 둘 점

- 읍면동 법정동코드는 **샘플 값**입니다. 오픈 전 행정표준코드관리시스템의 공식 목록으로 바꿔야 합니다
  (`apps/api/prisma/seed/regions.ts`, 관리자 지역 API).
- 약관·사이트 설정은 자리표시 문구입니다. 관리자 화면에서 법률 검토를 거친 내용으로 교체하세요.
- SMS·휴대폰 인증·Apple 로그인은 만들지 않습니다 (운영자 결정).
