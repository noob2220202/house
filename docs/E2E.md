# 실제 API 브라우저 E2E (stage 3) · Real-API browser e2e

`apps/web`(사용자 사이트 + 중개사 콘솔)과 `apps/admin`(관리자)을 **실제 API 모드**
(`NEXT_PUBLIC_API_MOCK` 미설정)로 `apps/api` + worker에 붙여, 새로 마이그레이션하고 base + demo
시드를 넣은 전용 DB에서 Playwright로 핵심 흐름을 돌립니다. API 모듈별 jest e2e
(`pnpm --filter @house/api test:e2e <module>`)와는 별개입니다.

## 빠른 실행 · Quick start

```bash
# 1) 스택 올리기 (빌드 → DB/Redis 초기화 → 마이그레이션 → 시드 → 기동 → 헬스 대기). 처음엔 수 분.
#    Start the stack (build, reset DB/Redis, migrate, seed, start, wait for health).
scripts/e2e-stack.sh up

# 2) 테스트 · Run the tests
pnpm exec playwright test -c e2e/playwright.config.ts                 # 전체 · all
pnpm exec playwright test -c e2e/playwright.config.ts -g @smoke       # 스모크만 · smoke only
pnpm exec playwright test -c e2e/playwright.config.ts --project web   # 사용자 사이트·콘솔 · user site + console
pnpm exec playwright test -c e2e/playwright.config.ts --project admin # 관리자 (admin-setup 포함) · admin (runs admin-setup first)
pnpm exec playwright show-report .tmp/e2e/report                      # HTML 리포트 · HTML report

# 3) 내리기 (.next-e2e 빌드도 삭제) · Stop (also deletes the .next-e2e builds)
scripts/e2e-stack.sh down
```

그 밖의 명령 · Other commands:

| 명령 · Command                                       | 설명 · What                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `scripts/e2e-stack.sh up --skip-build`               | 직전 e2e 빌드 재사용 (DB는 초기화) · reuse the previous build, still reset data |
| `scripts/e2e-stack.sh up --skip-build --keep-data`   | 빌드·데이터 모두 재사용 · reuse build and data (just restart processes)         |
| `scripts/e2e-stack.sh status`                        | 프로세스·헬스 · pids + health                                                   |
| `scripts/e2e-stack.sh logs api` (`worker`, `web`, …) | 로그 tail · tail a log (`.tmp/e2e/logs/*.log`)                                  |
| `scripts/e2e-stack.sh reset-limits`                  | 레이트리밋·일일 한도 카운터 초기화 · clear throttle / daily-cap counters        |
| `scripts/e2e-stack.sh down --keep-builds`            | 빌드는 남기고 정지 · stop, keep builds                                          |

프런트엔드가 계속 바뀌는 중이라 `up`은 매번 `next build`를 새로 합니다(`NEXT_DIST_DIR=.next-e2e`,
web과 admin 병렬). 루트 `package.json` 스크립트는 건드리지 않았으므로 위 명령을 그대로 쓰세요.

## 스택 구성 · What the script starts

| 서비스 · Service | 주소 · Address          | 비고 · Notes                                                                                  |
| ---------------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| api              | `http://127.0.0.1:4100` | `apps/api/.tmp/e2e-dist/main.js`, `NODE_ENV=test`, `E2E_FAKE_OAUTH=1`, `COOKIE_SECURE=false`  |
| worker           | —                       | `apps/api/.tmp/e2e-dist/worker.js` (미디어 처리 등 BullMQ 잡) · media processing etc.         |
| media            | `http://127.0.0.1:4101` | `scripts/e2e/media-server.mjs` — nginx 대신 `UPLOAD_DIR`를 `/media/*`로 제공                  |
| web              | `http://localhost:3200` | `next start`, rewrites `/api/v1` → api, `/media` → media (`INTERNAL_API_URL`, `MEDIA_ORIGIN`) |
| admin            | `http://localhost:3201` | 동일 · same                                                                                   |

격리 · Isolation: DB `house_e2e` (매 `up`마다 DROP/CREATE), Redis DB **14** (`house-e2e:` 접두어;
`apps/api/test/env/*.env`가 쓰는 1–9, 12와 겹치지 않음 — 스크립트가 확인), 업로드는 `.tmp/e2e/uploads`.
`E2E_DB_NAME`, `E2E_REDIS_DB`, `E2E_*_PORT`, `E2E_PG_URL`, `E2E_REDIS_HOST_URL`로 바꿀 수 있습니다.

마이그레이션은 `flock /tmp/house-prisma.lock`을 잡고 `prisma migrate deploy`로 적용하고, 시드는
`SEED_DEMO=true` + `ADMIN_BOOTSTRAP_EMAIL/PASSWORD`로 base + demo + e2e 관리자를 만듭니다.

## 로그인 · Logins

### 회원·중개사: 테스트 전용 로그인 · Members and brokers: TEST-ONLY login

실제 카카오/네이버/Google은 쓸 수 없어서 API에 **테스트 전용** 모듈
`apps/api/src/modules/e2e-auth`를 두었습니다.

- `POST /api/v1/e2e/login` `{ email, create?: { nickname }, agreeTerms?: true }`
  → 실제 OAuth 콜백·가입과 같은 `UserSessionService.start`로 세션 생성(쿠키 `house_sid` + `house_csrf`,
  소속 사무소, `lastLoginAt`), 응답 `{ userId, role, agencyId, created, csrfToken }`.
  ACTIVE 회원만(정지·탈퇴는 OAuth 콜백과 같은 거절), 현재 필수 약관에 미동의면 동의 기록 추가.
  `create`는 `@e2e.example.invalid` 이메일만 새 USER 회원을 만듭니다.
- **활성 조건 · Guards** (세 겹): `AppModule`은 `NODE_ENV=test` **그리고** `E2E_FAKE_OAUTH=1`일 때만
  모듈을 등록 · env 스키마는 `NODE_ENV≠test`에서 `E2E_FAKE_OAUTH`를 거부(운영·개발 기동 실패) ·
  컨트롤러 가드가 매 요청 다시 확인(아니면 404) · 모듈 `onModuleInit`도 확인. 단위 테스트:
  `pnpm --filter @house/api test -- src/modules/e2e-auth`.
- 시드 계정 · Seeded accounts (`e2e/lib/env.ts` `SEED`): `a1-owner@seed.example.invalid`
  (신대호수공인중개사사무소 대표, AGENCY_OWNER), `a2-owner@seed.example.invalid` (공동중개 상대),
  `a1-staff1@seed.example.invalid` (AGENT). 일반 회원은 테스트마다 새로 만듭니다.

테스트에서는 `loginAs(context, email)`(브라우저 컨텍스트와 쿠키 공유) 또는
`apiSessionAs(playwright, email)`(별도 API 컨텍스트)를 씁니다.

### 관리자: 실제 TOTP · Admin: real TOTP

`up`이 시드로 `e2e-admin@e2e.example.invalid`를 만들고, 실제 API로 로그인 → `totp/setup` →
`totp/activate`까지 진행해 비밀키를 `.tmp/e2e/admin.json`(0600)에 저장합니다
(`scripts/e2e/enroll-admin.mjs`). 테스트는 `e2e/lib/totp.mjs`(RFC 6238, 의존성 없음; otplib과 RFC 테스트
벡터로 검증)로 코드를 계산해 **관리자 로그인 화면에서 실제로** 로그인합니다(`admin-setup` 프로젝트, 세션은
`.tmp/e2e/auth/admin.json`에 저장해 admin 프로젝트가 재사용). API는 같은 30초 구간의 코드 재사용을
거부하므로 헬퍼가 마지막 사용 구간 이후 코드를 씁니다(필요하면 다음 구간 경계까지만 대기).

## 테스트 목록 · Flows (`e2e/tests`)

| 파일 · File                  | 흐름 · Flow                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/smoke.spec.ts`          | `@smoke` 비로그인 홈이 실제 API로 렌더, `/mock-api` 호출 없음                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `web/browse.spec.ts`         | 홈 → 지도 → 단지 → 매물 상세 (표시·광고 명시사항 블록, 공개 API·화면에 호수 없음) · 히어로 검색 자동완성 → 단지                                                                                                                                                                                                                                                                                                                                                                     |
| `web/member.spec.ts`         | 관심 매물 → `/me/favorites` · 내놓기(원룸, 가짜 우편번호 위젯, 동의 2종 포함 제출) → `/me/requests`                                                                                                                                                                                                                                                                                                                                                                                 |
| `web/seo.spec.ts`            | SEO 페이지 서버 렌더(view-source): 홈·지역 색인·지역×종류 랜딩·실거래 리포트·소개·단지·매물에 H1 1개·canonical·JSON-LD, 매물 HTML에 명시사항 있고 호수 없음 · sitemap/robots/llms.txt                                                                                                                                                                                                                                                                                               |
| `web/broker.spec.ts`         | 대표 `/agent` 대시보드 + 사이드바 **문의함** 메뉴와 `/agent/inquiries` 화면(SPEC §4.4, D5 대체) · 등록 마법사로 아파트·원룸 게시(공용 게시 규칙, emdCode·buildingUse) → 공개 목록·상세 · 공동중개 요청                                                                                                                                                                                                                                                                              |
| `web/office-site.spec.ts`    | 사무소 홈페이지 호스트 라우팅(`next start`, nginx 없이): 없는 주소 → 사무소 404 · 예약어 `www` → 메인 사이트 · 메인 사이트의 `/office-site` → 404 · 사무소 호스트의 그 밖 경로 → 메인 사이트 같은 경로로 이동                                                                                                                                                                                                                                                                       |
| `web/inquiries.spec.ts`      | 회원이 매물 문의 → 사무소가 콘솔 문의함에서 답변 → 회원이 MY > 문의 내역에서 확인 + `INQUIRY_REPLIED` 알림 · 바로 연락(번호 복사)은 문의함에 기록되지만 안 읽음 배지를 올리지 않음                                                                                                                                                                                                                                                                                                  |
| `admin/admin.setup.ts`       | 관리자 이메일·비밀번호·TOTP 로그인                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `admin/content.spec.ts`      | MAIN_HERO 배너(2480×440 / 1074×480 업로드) → 홈 캐러셀("광고: 제목" 링크, 클릭 집계 주소) · 팝업 → 홈 노출(앞선 팝업은 닫고 차례로)                                                                                                                                                                                                                                                                                                                                                 |
| `admin/moderation.spec.ts`   | 중개사무소 신청(API: 서류 업로드 + PRIVACY_AGENCY_APPLICATION 동의) → 관리자 승인 → AGENCY_OWNER · 허위매물 신고 → 매물 숨김 조치 → 공개 매물에서 사라짐                                                                                                                                                                                                                                                                                                                            |
| `admin/agency-sites.spec.ts` | 사무소 홈페이지 전체 흐름(SPEC [docs/agency-sites/SPEC.md](agency-sites/SPEC.md) §3.1, §4.1–4.4, §5): 대표가 `/agent/site`에서 주소 신청(사용 가능 확인) → 관리자가 홈페이지 대기열에서 승인 → 대표 콘솔의 주소·승인 알림 → 사무소 호스트 `<주소>.localhost`(자기 대표 매물만, 브랜드 색, 매물 페이지 canonical = 메인 사이트, 다른 사무소 매물 404, 그 밖 경로 → 메인 사이트) → 비회원 문의 → 사무소 문의함(홈페이지 출처, 안 읽음, 비회원은 답변 없음) → 관리자 정지 → 호스트 404 |

원칙 · Rules: 테스트마다 자기 데이터를 만듭니다(고유 이메일·이름, 서로 다른 시드 사무소). 고정 sleep 없이
응답 대기(`waitForResponse`)와 조건 폴링(`expect.poll`)만 씁니다 — 예: 홈 배너는 Next ISR
(`revalidate 60`, 배너 조회 캐시 60초) 때문에 새 배너가 보일 때까지 다시 불러오며 최대 150초 폴링,
팝업은 하이드레이션 뒤 클라이언트가 `GET /popups?page=MAIN`으로 불러오므로 그 응답을 기다린 뒤 확인합니다.

외부 의존 대체 · External boundaries replaced in the browser only:
카카오 우편번호 스크립트(`e2e/lib/postcode.ts`: 버튼 하나를 그리는 가짜 `daum.Postcode`),
broker 원룸 주소 검색 `GET /api/v1/geo/geocode`(카카오 로컬 API 키 없음 → 응답 스텁). 그 밖에는 모두 실제
API입니다. 브이월드 키가 없어서 사무소 등록번호 대조는 MATCHED가 아니며, 승인 대화상자의 확인 체크를 거칩니다.

## 브라우저 · Browser

루트 `playwright` 1.65.1이 기대하는 Chromium(1255)은 설치돼 있지 않아서, 설정이 자동으로
`/opt/pw-browsers/chromium`(1243)을 씁니다. 다른 경로는 `E2E_CHROMIUM=/path/to/chrome`.

## Windows 개발 PC · Windows

`scripts/e2e-stack.sh`는 **Linux 전용**입니다(`setsid`, `ss`, `flock`). Windows 11에서는 스크립트가 하는 단계를 Git Bash와
PowerShell로 직접 실행합니다. 값(포트, 환경 변수)은 스크립트의 `api_env()`·`next_env()`와 같게 맞춥니다.
PostgreSQL·Redis는 로컬 스택(`localhost:5432`, `localhost:6379`, SPEC §8)을 씁니다.

1. **빌드**: `packages/shared` 빌드 → API를 `apps/api/.tmp/e2e-dist`로(`tsc -p tsconfig.build.json --outDir .tmp/e2e-dist`) →
   web·admin을 `NEXT_DIST_DIR=.next-e2e`, `INTERNAL_API_URL=http://127.0.0.1:4100`, `MEDIA_ORIGIN=http://127.0.0.1:4101`,
   `NEXT_PUBLIC_SITE_URL=http://localhost:3200`으로 `next build`(`NEXT_PUBLIC_API_MOCK`는 비움).
2. **데이터 초기화**: `house_e2e`를 DROP/CREATE, e2e용 Redis DB 비우기(다른 테스트가 쓰지 않는 번호), `uploads`·`admin.json`·`auth` 삭제 →
   `apps/api`에서 API 환경으로 `prisma migrate deploy` → `SEED_DEMO=true`, `ADMIN_BOOTSTRAP_EMAIL`·`ADMIN_BOOTSTRAP_PASSWORD`
   (스크립트의 `E2E_ADMIN_EMAIL`·`E2E_ADMIN_PASSWORD`)로 `prisma db seed`.
3. **기동**(PowerShell `Start-Process -WindowStyle Hidden`, 로그는 `.tmp/e2e/logs`): media(`node scripts/e2e/media-server.mjs`) →
   api·worker(`node --enable-source-maps .tmp/e2e-dist/main.js` / `worker.js`, API 환경) → 관리자 TOTP 등록
   (`node scripts/e2e/enroll-admin.mjs`, `E2E_API_ORIGIN`·`E2E_ADMIN_EMAIL`·`E2E_ADMIN_PASSWORD`·`E2E_STATE_DIR`) →
   web·admin(`next start --port 3200` / `3201`, 빌드와 같은 값). 정지는 `taskkill /PID <pid> /T /F`.
4. **테스트**: 시스템 Chrome을 씁니다(Playwright가 기대하는 Chromium을 받지 않아도 됨). 다시 돌리기 전에는 `reset-limits`처럼
   그 Redis DB의 `house-e2e:throttle:*`·`house-e2e:cap:*` 키를 지웁니다.
   ```bash
   E2E_CHROMIUM='C:\Program Files\Google\Chrome\Application\chrome.exe' pnpm exec playwright test -c e2e/playwright.config.ts
   ```
   사무소 호스트 `<주소>.localhost`는 Chrome이 스스로 `127.0.0.1`로 풀므로 hosts 파일을 고칠 필요가 없습니다.

## 타입 검사 · Typecheck

```bash
./node_modules/.bin/tsc -p e2e/tsconfig.json
```

## 상태 · Status (2026-11-24, stage 3 round 1)

- 새 스택(`up`: 빌드·DB 초기화·시드)에서 전체 **17건 통과**(web 11 · admin-setup 1 · admin 5),
  1.1–4.5분(홈 배너 ISR 대기에 따라 다름).
- round 1에서 고친 것: 마법사 단계 이동 대기·평형 칩 선택(`e2e/lib/listing-wizard.ts`), 신고 조치의
  매물 숨김 체크박스, 배너 확인 셀렉터(클릭 가능한 배너는 `img`가 아니라 "광고: 제목" 링크), 팝업 확인 경쟁
  조건(하이드레이션 전에 DOM을 보던 문제), 스택 `API_BASE_URL`을 운영과 같이 사이트 주소로. 모두 테스트·하네스
  쪽 문제였고 앱 코드 결함은 이번 라운드에서 나오지 않았습니다.
- Full run on a fresh stack: **17/17 passed**. Round-1 fixes were all in the tests/harness (selectors,
  waits, stack env); no app defect surfaced in this round.

## 상태 · Status (2026-11-28, 사무소 홈페이지 · 구독 · 문의)

- 전체 **27건 통과**(web 16 · admin-setup 1 · admin 10). 새 파일: `admin/agency-sites.spec.ts`(6), `web/office-site.spec.ts`(2),
  `web/inquiries.spec.ts`(2). `web/broker.spec.ts`는 이제 D5의 "문의 메뉴 없음" 대신 문의함 메뉴와 화면을 확인합니다.
- 27/27 passed (web 16 · admin-setup 1 · admin 10).
