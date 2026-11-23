# 순천 부동산 공동중개 플랫폼

순천시(전라남도) 지역 부동산 공동중개 플랫폼의 모노레포입니다. 지도 기반 매물 탐색(아파트·분양권, 원룸·투룸,
주택, 상업·업무, 토지), 여러 중개사무소의 공동중개, 내놓기/구하기, 중개사무소 찾기, 단지·실거래가 정보,
그리고 배너·팝업·승인·신고·콘텐츠·설정·약관을 모두 다루는 관리자 백오피스를 제공합니다.

- 소셜 로그인: **카카오 · 네이버 · Google** (Apple 로그인 없음)
- **SMS 발송·휴대폰 인증 없음** — 휴대폰 번호는 형식만 검증하는 연락처 필드입니다.
- 현재 단계: 백엔드(API) + 인프라. 사용자 사이트·관리자 화면은 디자인 확정 후 구현합니다.

설계 문서: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · 개발 규칙(영문): [docs/CONVENTIONS.md](docs/CONVENTIONS.md)

## 구조

```
apps/
  api/        NestJS 11 API (포트 4000, /api/v1)
    prisma/schema/      Prisma 멀티 파일 스키마 + 마이그레이션 (모듈별 .prisma)
    src/common/         가드·데코레이터·파이프·필터·감사로그·캐시·지오·페이지네이션
    src/modules/        auth, listings, complexes, agencies, deal-requests, ads, media, admin
    test/               e2e 러너, 모듈별 env(test/env), 테스트 유틸·팩토리, e2e 스펙
  web/        Next.js 15 사용자 사이트 (포트 3000, /healthz)
  admin/      Next.js 15 관리자 (포트 3001, /healthz)
packages/
  shared/     zod 스키마 · enum · 상수 · 에러 코드 · 유틸 (api와 프론트 공용)
  config/     tsconfig / ESLint 프리셋
docs/         ARCHITECTURE.md, CONVENTIONS.md
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

# 3) 마이그레이션 + 기본 시드 (확장 postgis/pg_trgm은 마이그레이션이 생성)
pnpm db:migrate
pnpm db:seed                       # SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD 지정 시 최고관리자 생성

# 4) 실행
pnpm dev                           # api:4000, web:3000, admin:3001
curl localhost:4000/api/v1/health/ready   # {"status":"ok","checks":{"db":"ok","redis":"ok"}}
```

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
| `pnpm db:seed`                                                | 기본 시드 (멱등)                                           |
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
