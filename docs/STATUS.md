# 진행 현황 (STATUS)

기준일: 2026-11-24 · 단계: **전부 구현 완료, 출시 준비** — 사용자 사이트 · 중개사 콘솔 · 관리자 · API · 배포 키트

서비스 이름 **순천부동산지도**, 주소 `https://suncheonmap.kr` (관리자 `https://admin.suncheonmap.kr`), 지도는 **카카오맵**.
이 문서는 "무엇이 만들어졌고, 무엇으로 검증했고, 출시하려면 사장님이 무엇을 어떤 순서로 하면 되는지"를 한 장에 정리합니다.
처음 보시면 [README](../README.md)부터 보세요. 서버 배포는 [DEPLOY.md](DEPLOY.md), 키 발급은 [KEY_SETUP.md](KEY_SETUP.md),
일상 운영은 [OPERATIONS.md](OPERATIONS.md), 브라우저 테스트는 [E2E.md](E2E.md)에 있습니다.

---

## 1. 만들어진 것

### 사용자 사이트 (`apps/web`, https://suncheonmap.kr)

- **홈**: 검색(단지·지역 자동완성), 메인 배너 캐러셀, 팝업, 관리자가 고르는 섹션 순서·표시(메인 화면 편집).
- **지도 검색** (`/map/apt`, `/map/oneroom` …): 카카오맵, 확대 단계별로 읍면동 묶음 → 격자 묶음 → 매물 마커,
  가격·면적·방·층·준공년도 등 필터, 목록 정렬, 주소창에 위치·필터 저장. 지도 키가 없으면 정적 지도로 대신 표시.
- **매물 상세**: 사진(확대 보기), 가격·관리비, 공동중개 사무소, **공인중개사법 표시·광고 명시사항**, 위치(호수는 절대 표시 안 함),
  문의(전화·문자·번호 복사), 관심 매물, 허위매물 신고.
- **단지**: 단지·평형 정보, 국토교통부 실거래가(최근 거래·월별 시세), 단지 매물.
- **중개사무소 찾기** (`/agencies`, `/agency/:id`), **내놓기 / 구하기** (`/deal/sell`, `/deal/find`, 개인정보 동의 2종 포함),
  **내 정보** (`/me`: 관심·최근 본 매물, 내 요청과 받은 제안, 알림, 계정·탈퇴), 공지 · FAQ · 영상 · 고객지원 · 약관.
- **로그인**: 카카오 · 네이버 · Google만 (Apple 로그인 없음, SMS·휴대폰 인증 없음).

### 중개사 콘솔 (`apps/web` `/agent`)

- 중개사무소 등록 신청(서류 업로드, 동의) → 관리자 승인 후 대시보드.
- 매물 등록 마법사(공용 게시 규칙으로 명시사항 검사, 원룸 주소 검색 = 카카오 로컬), 매물 관리·수정, **공동중개 요청·수락**.
- 받은 내놓기/구하기 요청함 → 제안 보내기 → 요청자가 수락하면 연락처 공개, 알림, 사무소 소개·직원 초대.

### 관리자 (`apps/admin`, https://admin.suncheonmap.kr)

- 이메일 + 비밀번호 + **OTP 2단계 인증 필수**, 관리자 작업 전부 감사 로그.
- 대시보드 · 통합 검색 · 회원 · 중개사무소 승인/반려/정지 · 매물 · 단지(실거래가 동기화) · 내놓기/구하기 · 허위매물 신고 처리 ·
  배너(슬롯·기간·통계) · 팝업 · 공지/FAQ/영상 · 메인 화면 편집 · **사이트 설정(사업자 정보)** · 약관 버전 관리 · 소셜 로그인 상태 · 관리자 계정 · 통계 · 알림.

### API · 워커 (`apps/api`, NestJS, `/api/v1`)

- 엔드포인트 250여 개, Prisma 모델 53개, 마이그레이션 18개 (PostgreSQL 16 + PostGIS + pg_trgm, Redis).
- 서버 세션(httpOnly 쿠키) + CSRF 방어, 사용자/관리자 출처(Origin) 분리, 권한·소유권 검사, 요청 제한, 오류 응답 형식 통일(한국어 메시지).
- 지도 묶음 검색, 실거래가 월별 자동 동기화(순천시 새 코드 `12150`, 옛 코드 `46150` 재조회 대비), 브이월드 중개사무소 등록번호 대조,
  주소 → 좌표(카카오 로컬 API), 이미지 webp 변환·EXIF 제거, 조회수·배너 통계, 만료·탈퇴 정리 작업(BullMQ 워커).

### 검색 노출 (SEO · AI 검색 GEO)

- 모든 공개 페이지를 서버에서 그려서 보냄(H1 · canonical · 구조화 데이터 JSON-LD), 지역 색인(`/suncheon`), 지역 × 매물 종류 랜딩,
  순천 아파트 실거래 리포트(`/reports/suncheon-apartment-trades`), 서비스 소개(`/about`).
- `sitemap.xml`(기본·지역·단지·매물·중개사무소 묶음), `robots.txt`, AI 검색용 `llms.txt` · `llms-full.txt`,
  네이버 서치어드바이저 / 구글 서치 콘솔 소유 확인 태그(키만 넣으면 출력).

### 배포 키트 (`deploy/`, Docker 없음)

- `install.sh`(서버 최초 설치: Node 22 · PostgreSQL+PostGIS · Redis · Nginx · PM2 · 방화벽 · fail2ban · HTTPS 인증서 · 백업 예약),
  `set-keys.sh`(키 입력 도우미), `deploy.sh`(무중단 배포: 빌드 → 마이그레이션 전 백업 → 임시 포트 사전 점검 → 전환 → 헬스체크 → 실패 시 자동 롤백 → 사진 최적화 점검),
  `rollback.sh`, `backup.sh`, `restore.sh`, `status.sh`, `create-admin.sh`, `db-shell.sh`. Nginx에 보안 헤더 · CSP · 요청 제한.

---

## 2. 검증 결과 (2026-11-24 최종 게이트)

| 항목                                                        | 결과                                                                                                      |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                            | 통과                                                                                                      |
| `pnpm build` (5개 패키지)                                   | 통과                                                                                                      |
| `pnpm lint` (7개 작업)                                      | 통과 (오류 0)                                                                                             |
| `pnpm typecheck` (7개 작업)                                 | 통과                                                                                                      |
| `pnpm format:check`                                         | 통과                                                                                                      |
| 단위 테스트 `pnpm test`                                     | **213개 파일, 2,267개 테스트 통과**                                                                       |
| ㄴ `packages/shared`                                        | 14개 파일 · 307개                                                                                         |
| ㄴ `packages/ui`                                            | 2개 파일 · 77개                                                                                           |
| ㄴ `apps/api`                                               | 45개 파일 · 409개                                                                                         |
| ㄴ `apps/web` (사용자 사이트 + 중개사 콘솔)                 | 106개 파일 · 1,002개                                                                                      |
| ㄴ `apps/admin`                                             | 46개 파일 · 472개                                                                                         |
| `pnpm db:drift` (마이그레이션 = 스키마)                     | 통과                                                                                                      |
| API e2e `pnpm --filter @house/api test:e2e` (실제 DB·Redis) | **10개 모듈, 57개 파일, 775개 테스트 통과**                                                               |
| 실제 API 브라우저 e2e (Playwright, 새 DB, 실제 모드 빌드)   | **17개 테스트 모두 통과** (사용자 12 · 관리자 로그인 1 · 관리자 4)                                        |
| 배포 키트 `pnpm lint:deploy && pnpm test:deploy`            | shellcheck 통과 · **20개 파일, 400개 검사 통과**                                                          |
| 배포 리허설 (install.sh → deploy.sh → 롤백 → 재배포)        | 성공 — nginx 경유 api·worker·web·admin 정상, 사진 최적화 200, CSP 헤더 확인, 롤백·재배포 중 요청 모두 200 |

API e2e 모듈별: auth 138 · listings 110 · agencies 94 · deal-requests 91 · admin 89 · complexes 70 · media 69 · ads 63 · core 29 · home 22.

**자동 테스트 합계: 3,059개 (단위 2,267 + API e2e 775 + 브라우저 e2e 17) + 배포 키트 검사 400개, 모두 통과.**

이번 게이트에서 고친 것: install.sh가 systemd 없는 서버에서 Redis를 재시작할 때 이전 Redis가 끝나기 전에 새로 띄워 둘 다 꺼지던 문제
(리허설에서 발견, 테스트 추가), 형식이 어긋난 파일 5개 정리, 지도·브랜드 관련 문서 갱신. 리허설 상세는 [DEPLOY.md 부록](DEPLOY.md).

다시 실행하는 방법:

```bash
pnpm install --frozen-lockfile
pnpm build && pnpm lint && pnpm typecheck && pnpm format:check
pnpm test                                  # 단위 테스트
pnpm db:drift
pnpm --filter @house/api test:e2e          # API e2e (모듈마다 별도 DB·Redis 번호)
pnpm lint:deploy && pnpm test:deploy       # 배포 키트
scripts/e2e-stack.sh up && pnpm exec playwright test -c e2e/playwright.config.ts && scripts/e2e-stack.sh down
```

---

## 3. 출시 순서 (사장님 체크리스트)

순서대로 하시면 됩니다. 각 단계의 자세한 화면 설명은 괄호 안 문서에 있습니다.

1. **서버 준비** — 깨끗한 **Ubuntu 24.04 LTS** VPS (2 vCPU / 4GB RAM / SSD 50GB 이상, 서울 리전 권장, 고정 공인 IP).
   클라우드 방화벽(보안 그룹)에서 **22(SSH) · 80 · 443** 포트를 엽니다. (DEPLOY.md 1·4단계)
2. **DNS A 레코드 3개** — `suncheonmap.kr`(@), `www`, `admin` → 서버 IP. `nslookup suncheonmap.kr`로 반영 확인. (DEPLOY.md 3단계)
3. **설치** — 서버에서 저장소를 받고:
   `./deploy/install.sh --domain suncheonmap.kr --email 내메일 --repo git@github.com:OWNER/REPO.git --branch main`
   요약 화면의 배포 키(`ssh-ed25519 …`)를 GitHub 저장소 → Deploy keys에 읽기 전용으로 등록. (DEPLOY.md 5·6단계)
4. **키 입력** — `sudo /srv/house/set-keys.sh` (하나씩 묻고, Enter는 그대로 둠. 발급 방법은 KEY_SETUP.md)
   - `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET` — 카카오 로그인 (REST API 키, 주소 검색에도 사용)
   - `NEXT_PUBLIC_KAKAO_MAP_KEY` — 카카오맵 JavaScript 키 (같은 카카오 앱, 사이트 도메인 등록 + 카카오맵 사용 ON)
   - `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` — 네이버 로그인
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google 로그인
   - `DATA_GO_KR_SERVICE_KEY` — 공공데이터포털 실거래가 (아파트 매매·전월세 2개 API 활용 신청)
   - `VWORLD_API_KEY` — 브이월드 중개사무소 등록번호 대조 (선택)
   - 각 로그인 콘솔의 Redirect URI: `https://suncheonmap.kr/api/v1/auth/oauth/{kakao|naver|google}/callback`
5. **첫 배포** — `sudo /srv/house/deploy.sh` → `✔ 배포 성공` 확인, `sudo /srv/house/status.sh`로 헬스체크 정상 확인. (DEPLOY.md 8·10단계)
6. **관리자 계정** — `sudo /srv/house/create-admin.sh` → `https://admin.suncheonmap.kr`에서 로그인하고 OTP 앱 등록. (DEPLOY.md 9단계)
7. **사업자 정보** — 관리자 → 사이트 설정: 상호, 대표자, 사업자등록번호, 통신판매업 신고번호, 주소, 개인정보보호책임자, 고객센터 연락처·이메일.
   (지금은 `(상호 입력)` 같은 자리 표시 값입니다. 사이트 하단과 `/about`에 그대로 나갑니다.)
8. **약관 법률 검토** — 시드에 든 약관·동의서는 **견본**입니다. 이용약관 · 개인정보처리방침 · 위치기반서비스 · 마케팅 수신,
   신청용 동의서 4종(중개사무소 신청, 소속 중개사 합류, 내놓기·구하기 수집·이용, 제3자 제공)을 검토받은 문안으로 관리자 → 약관 관리에서 새 버전으로 게시.
9. **소셜 로그인 공개 심사** — 네이버 로그인 **검수 요청**(승인 전에는 등록한 테스트 계정만 로그인됨), Google OAuth 동의 화면 **앱 게시**(프로덕션으로 전환).
   카카오는 이메일·전화번호 동의항목을 쓰려면 비즈 앱 전환이 필요할 수 있습니다.
10. **검색 등록** — 네이버 서치어드바이저와 구글 서치 콘솔에 `https://suncheonmap.kr` 등록 → HTML 태그 값을
    `.env`의 `NEXT_PUBLIC_NAVER_SITE_VERIFICATION` / `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`에 넣고 `deploy.sh` → 소유 확인 →
    사이트맵 `https://suncheonmap.kr/sitemap.xml` 제출. (DEPLOY.md "검색 등록")

출시 직후 한 번씩 확인할 것: 실제 키로 카카오맵(지도 화면·중개사 위치 선택), 세 가지 로그인, 관리자 → 단지 → 실거래가 첫 동기화,
중개사무소 신청 때 브이월드 대조 결과.

---

## 4. 알려진 제한 / 남은 일

### 출시 전에 확인할 것

- **카카오맵 실제 화면은 아직 실제 키로 확인하지 못했습니다.** 카카오 지도 SDK는 등록된 도메인에서만 키를 받아 주므로 테스트 환경에서는
  정적 지도로 대신 검증했습니다. 4단계 키 입력 후 `suncheonmap.kr`에서 `/map/apt`, `/map/oneroom`, `/agencies`, 중개사 콘솔의 위치 선택을
  PC와 휴대폰에서 확인하세요(마커 누르기, 지도 이동 시 다시 불러오기, 확대·축소 버튼).
- **카카오 로컬 API(주소 → 좌표), 실거래가(data.go.kr), 브이월드는 실제 키로 호출해 보지 못했습니다** (테스트는 가짜 응답으로 검증).
  카카오 주소는 "전남 순천시 …"처럼 짧은 도 이름으로 오지만 지역 판별은 법정동 코드로 하므로 동작에는 영향이 없습니다.
- **법정동 코드 목록 (2026-11-25 검증 완료)**: 순천시 법정동 207개(동 33, 읍 1, 면 10, 리 163)를 카카오 로컬 API(행안부 법정동코드)로
  하나씩 대조했고, 기본 시드와 관리자 "기본 목록 넣기"가 이 목록을 씁니다(`apps/api/src/modules/complexes/regions/suncheon-regions.data.ts`,
  읍면동 8자리·리 10자리). 예전 시드의 견본 코드 33개(23개가 틀림, 예: 조례동 `1215011900` → 공식 `12150133`)는 다음 배포 때
  마이그레이션 `20261125140000_regions_verified_list`가 자동으로 고칩니다(DEPLOY.md "서비스 지역 코드"). 남은 확인 하나: 주암면에
  `1215035027`이 비어 있는 것(폐지된 리로 추정)을 code.go.kr에서 확인하면 좋습니다.
- **데모 데이터**: `db:seed:demo`의 단지·사무소·매물·배너는 가상 데이터입니다. 운영 서버에는 넣지 마세요(`deploy.sh`는 기본 시드만 넣습니다).
- 위치기반서비스를 제공하려면 방송통신위원회 위치기반서비스사업 신고가 필요할 수 있습니다.

### 알려진 제한

- **중개사 요청함의 단계 탭·지역·매물 종류 필터와 마감순 정렬은 실제 서버에서 동작하지 않습니다.** 실제 API 목록이 이 조건을 아직 받지 않아서
  전체 목록이 그대로 나옵니다(목업 모드에서만 동작). 서버에 조건을 추가하거나 화면을 바꾸는 후속 작업이 필요합니다(`docs/frontend-integration/a-inbox.md`).
- 알림은 **앱 내 알림만** 있습니다 (SMS · 이메일 · 알림톡 발송 없음). 서면 문의 기능도 출시 범위에서 뺐습니다(문의 = 전화 · 문자 · 번호 복사).
- 지도의 지적편집도 · 학군 · 통학 도보권 · 편의시설 · CCTV 레이어와 동·호 배치도는 출시 범위에서 뺐습니다.
- 실거래가 동기화는 아파트 매매 · 전월세만 대상입니다. 단지 매칭이 안 되면 관리자 화면에서 단지의 국토교통부 코드를 넣어 주면 다음 동기화부터 연결됩니다.
- 지도 확대는 최대 19단계(카카오 레벨 1)까지입니다. 중개사무소 길찾기 링크는 카카오맵으로 열립니다.
- 배포 끝의 사진 최적화 점검이 실패하면 경고만 하고 되돌리지는 않습니다(사이트 자체는 정상이므로). 원하시면 자동 롤백으로 바꿀 수 있습니다.
- 빌드할 때 글꼴을 Google Fonts에서 받습니다. 서버에서 `fonts.googleapis.com`에 접속할 수 없으면 배포가 빌드 단계에서 멈춥니다(서비스는 이전 버전 유지).
- 사용자 사이트의 목업 API 경로(`/mock-api/**`)가 운영 빌드에도 남아 있습니다(견본 데이터만 돌려주므로 해는 없음, robots.txt에서 수집 제외).
- 배포 리허설은 systemd 없는 컨테이너에서 했습니다. 실제 인증서 발급(certbot), systemd 자동 시작, UFW · fail2ban은 실제 서버에서 처음 동작합니다.
