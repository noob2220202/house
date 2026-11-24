# 서버 배포 가이드 (VPS · Docker 없이)

이 문서는 서버를 처음 다뤄 보는 분도 따라 할 수 있도록 **도메인 구입부터 첫 배포, 업데이트, 백업**까지 순서대로 설명합니다.
명령어는 회색 상자 안의 내용을 **그대로 복사해서** 붙여 넣으면 됩니다. `example.com`, `OWNER/REPO` 같은 부분만 내 값으로 바꾸세요.

- Docker, 컨테이너, 가상환경은 쓰지 않습니다. 서버에 Node.js, PostgreSQL, Redis, Nginx를 직접 설치합니다.
- 소셜 로그인은 **카카오, 네이버, Google**만 씁니다.
- **SMS 발송 서비스는 쓰지 않습니다.** 휴대폰 인증이 없으므로 SMS 업체와 계약하거나 키를 받을 필요가 없습니다.
- 일상 운영(로그, 백업 확인, 복원 연습, 보안 업데이트)은 [OPERATIONS.md](OPERATIONS.md)에 있습니다.

---

## 0. 전체 구조 한눈에 보기

```
 사용자 브라우저
      │  https://example.com          https://admin.example.com
      ▼
 ┌──────────────────────── Nginx (80/443, 인증서) ────────────────────────┐
 │ example.com         → 사용자 사이트 (Next.js, 3000)                     │
 │ example.com/api/    → API (NestJS, 4000)  ← 2개 프로세스 (무중단 교체)   │
 │ example.com/media/  → 업로드 이미지 파일 (/var/lib/house/uploads/public) │
 │ admin.example.com   → 관리자 사이트 (Next.js, 3001) + /api/              │
 │ www.example.com     → example.com 으로 이동                             │
 └─────────────────────────────────────────────────────────────────────────┘
          │                         │
   PostgreSQL 16 + PostGIS      Redis (세션·캐시·작업 큐)
          ▲                         ▲
          └── worker (실거래가 동기화, 배너 통계, 이미지 처리, 정리 작업)
```

모든 앱은 **PM2**(Node.js 프로세스 관리자)가 실행하고, 서버가 재부팅되면 자동으로 다시 켭니다.

서버의 주요 위치:

| 위치                             | 내용                                                     |
| -------------------------------- | -------------------------------------------------------- |
| `/srv/house/deploy.sh`           | **배포 명령** (업데이트할 때마다 실행)                   |
| `/srv/house/current`             | 지금 서비스 중인 버전 (releases 안의 폴더를 가리킴)      |
| `/srv/house/releases/`           | 배포된 버전들 (최근 5개 보관, 되돌리기용)                |
| `/srv/house/shared/.env`         | **설정·비밀값 파일** (외부 서비스 키를 여기에 넣음)      |
| `/srv/house/shared/deploy.conf`  | 도메인, 저장소 주소, 포트 등 배포 설정                   |
| `/srv/house/bin/`                | 배포 스크립트 설치본 (root 소유, 18단계 참고)            |
| `/var/lib/house/uploads/public`  | 매물 사진 등 공개 이미지                                 |
| `/var/lib/house/uploads/private` | 중개사무소 등록증 등 비공개 서류 (웹에서 직접 접근 불가) |
| `/var/backups/house/`            | 자동 백업 (DB·업로드 파일 매일, 14일 보관)               |
| `/var/log/house/`                | 앱 로그, 배포 로그, 백업 로그                            |

---

## 1. 준비물

| 항목        | 권장                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------- |
| VPS(서버)   | **2 vCPU / 4GB RAM / SSD 50GB 이상**. 최소 2GB RAM도 가능(설치 스크립트가 스왑을 만듭니다). |
| 운영체제    | **Ubuntu 24.04 LTS** (22.04 LTS도 지원)                                                     |
| 지역        | 한국 사용자 대상이면 서울 리전(예: 네이버 클라우드, AWS Lightsail 서울, Vultr 서울 등)      |
| 도메인      | 예: `example.com` (아래 2단계)                                                              |
| 코드 저장소 | GitHub 저장소 (비공개 저장소 권장)                                                          |

VPS를 만들 때 **고정(공인) IP**가 붙어 있는지 확인하고, 그 IP 주소를 메모해 두세요. (예: `203.0.113.10`)

---

## 2. 도메인 구입

1. 가비아, 후이즈, Cloudflare, Namecheap 같은 등록업체에서 도메인을 삽니다. (예: `example.com`, `example.co.kr`)
2. **한글 도메인**(예: `순천부동산.com`)을 쓰는 경우, 아래 명령들에는 반드시 **퓨니코드**(`xn--`로 시작하는 영문 표기)를 넣어야 합니다.
   등록업체 관리 화면이나 퓨니코드 변환기에서 확인할 수 있습니다.

## 3. DNS 설정 (도메인 → 서버 IP 연결)

도메인 등록업체의 **DNS 관리** 화면에서 **A 레코드 3개**를 만듭니다.

| 호스트(이름) | 타입 | 값(IP)  | 의미                          |
| ------------ | ---- | ------- | ----------------------------- |
| `@`          | A    | 서버 IP | `example.com` (사용자 사이트) |
| `www`        | A    | 서버 IP | `www.example.com`             |
| `admin`      | A    | 서버 IP | `admin.example.com` (관리자)  |

- TTL은 기본값(또는 300초)이면 됩니다.
- **Cloudflare**를 쓰는 경우 처음에는 구름 아이콘을 **회색(DNS only)** 으로 두세요. 주황색(프록시)이면 인증서 발급과 접속자 IP 기록이 달라집니다.
- 서버에 IPv6가 있고 그 주소도 쓰려면 같은 이름으로 AAAA 레코드를 추가합니다. 모르면 만들지 마세요.

반영 확인 (내 PC의 PowerShell 또는 서버에서):

```bash
nslookup example.com
nslookup www.example.com
nslookup admin.example.com
```

세 개 모두 서버 IP가 나오면 됩니다. 보통 몇 분, 길게는 몇 시간 걸립니다. **DNS가 반영되기 전에는 HTTPS 인증서가 발급되지 않습니다.**

## 4. 서버 접속 (SSH)

Windows에서는 **PowerShell**을 열고:

```powershell
ssh root@203.0.113.10
```

- VPS 업체에 따라 첫 사용자 이름이 `ubuntu`일 수 있습니다: `ssh ubuntu@203.0.113.10`, 접속 후 `sudo -i`로 관리자(root)가 됩니다.
- 처음 접속할 때 `Are you sure you want to continue connecting?`이 나오면 `yes`를 입력합니다.
- 비밀번호 대신 **SSH 키** 로그인을 권장합니다 (VPS 업체 콘솔에서 키 등록). 키 로그인이 확인된 뒤에는 비밀번호 로그인을 끄는 것이 안전합니다(OPERATIONS.md 참고).

이후 명령은 모두 **root** 상태(프롬프트가 `#`)에서 실행한다고 가정합니다. `ubuntu` 사용자라면 앞에 `sudo`를 붙이세요.

## 5. 코드 받기 (처음 한 번)

설치 스크립트가 저장소 안에 있으므로 먼저 코드를 한 번 받습니다.

```bash
apt-get update && apt-get install -y git
git clone https://github.com/OWNER/REPO.git /root/house-setup
```

**비공개 저장소**라면 `git clone` 할 때 GitHub 아이디와 비밀번호를 묻습니다. 비밀번호 자리에는 **토큰**을 넣어야 합니다.

1. GitHub → 오른쪽 위 프로필 → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. Repository access: **Only select repositories** → 이 저장소만 선택
3. Permissions → Repository permissions → **Contents: Read-only**
4. 만료일은 7일 정도로 짧게. 생성된 토큰을 비밀번호 칸에 붙여 넣습니다.

이 토큰은 처음 한 번만 씁니다. 이후 서버의 자동 업데이트는 6단계에서 만드는 **배포 키**를 사용합니다. 끝나면 토큰은 GitHub에서 삭제하세요.

## 6. 서버 설치 (install.sh)

```bash
cd /root/house-setup
./deploy/install.sh \
  --domain example.com \
  --email 내메일@example.com \
  --repo git@github.com:OWNER/REPO.git \
  --branch main
```

| 옵션                | 설명                                                                              |
| ------------------- | --------------------------------------------------------------------------------- |
| `--domain`          | 내 도메인 (`www`, `admin`은 자동으로 붙습니다)                                    |
| `--email`           | 인증서 만료 알림을 받을 메일 (Let's Encrypt)                                      |
| `--repo`            | 저장소 주소. **비공개 저장소는 `git@github.com:OWNER/REPO.git` 형식**으로 쓰세요. |
| `--branch`          | 배포할 브랜치 (기본 `main`)                                                       |
| `--admin-subdomain` | 관리자 주소를 `admin` 대신 다른 이름으로 (예: `office` → `office.example.com`)    |

설치는 5~15분 걸립니다. 스크립트가 하는 일:

- 시스템 업데이트, **자동 보안 업데이트**, 시간대 **Asia/Seoul**, 메모리가 4GB 미만이면 **스왑** 생성
- 서비스 전용 사용자 `house` 생성, 폴더 생성
- **Node.js 22**, pnpm, PM2(+로그 자동 정리, 재부팅 시 자동 시작)
- **PostgreSQL 16 + PostGIS + pg_trgm**, DB와 계정 생성 (**비밀번호 자동 생성**)
- **Redis** (서버 내부에서만 접속, 비밀번호 자동 생성)
- **Nginx** 설정, **Let's Encrypt HTTPS 인증서** 발급 (`example.com`, `www`, `admin` 한 번에)
- **방화벽(UFW)**: SSH, 80, 443만 허용 / **fail2ban**: 로그인 공격 차단
- `/srv/house/shared/.env` 생성 (비밀값 자동 생성. **이미 있으면 절대 덮어쓰지 않음**. root 소유, 앱은 읽기만 가능)
- 매일 새벽 3시 30분 **자동 백업** 등록

끝나면 한국어 요약이 나옵니다. 스크립트는 **여러 번 실행해도 안전**합니다. 중간에 실패했으면 원인을 고치고 같은 명령을 다시 실행하세요.

### 6-1. 배포 키 등록 (비공개 저장소)

요약 화면에 `ssh-ed25519 AAAA... house-deploy@...` 로 시작하는 줄이 나오면, 서버가 저장소를 읽을 수 있도록 등록해야 합니다.

1. GitHub 저장소 → **Settings → Deploy keys → Add deploy key**
2. Title: `house-server`, Key: 화면의 `ssh-ed25519 ...` 한 줄 전체 붙여넣기
3. **Allow write access는 체크하지 않습니다** (읽기 전용)

키를 다시 보려면: `cat /home/house/.ssh/id_ed25519.pub`

### 6-2. 인증서 발급이 실패했다면

대부분 DNS가 아직 반영되지 않은 경우입니다. 3단계의 `nslookup`으로 확인한 뒤 **6단계 명령을 그대로 다시 실행**하면 됩니다.
(그동안 사이트는 HTTP로만 열립니다. 로그인은 HTTPS에서만 동작합니다.)

## 7. 외부 서비스 키 넣기 (.env)

```bash
sudo nano /srv/house/shared/.env
```

- 이 파일은 **root 소유**(`root:house`, 0640)입니다. 앱(house 사용자)은 읽기만 하고 고칠 수 없으므로, 편집은 항상 `sudo`로 합니다.
- `nano` 편집기 사용법: 화살표로 이동, 값 입력 → **Ctrl+O** 후 Enter(저장) → **Ctrl+X**(나가기)
- `키=값` 형식입니다. `=` 앞뒤에 공백을 넣지 마세요. 값 뒤의 `# 설명`은 그대로 두어도 됩니다.
- DB/Redis 비밀번호, `COOKIE_SECRET`, `TOTP_ENCRYPTION_KEY`는 이미 자동으로 채워져 있습니다. **절대 바꾸거나 공개하지 마세요.**
  특히 `TOTP_ENCRYPTION_KEY`를 바꾸면 관리자 OTP가 모두 무효가 됩니다.

아래 키들을 각 사이트에서 받아 넣습니다. (콘솔 메뉴 이름은 업체 사정으로 조금씩 바뀔 수 있습니다.)
로그인 **Redirect(Callback) URI**는 아래 주소를 **정확히 그대로**(https, 끝에 `/` 없음) 등록해야 합니다.

```
https://example.com/api/v1/auth/oauth/kakao/callback
https://example.com/api/v1/auth/oauth/naver/callback
https://example.com/api/v1/auth/oauth/google/callback
```

### 카카오 로그인 → `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`

1. [Kakao Developers](https://developers.kakao.com) 로그인 → **내 애플리케이션 → 애플리케이션 추가하기** (앱 이름, 사업자명)
2. **앱 키**의 **REST API 키** → `KAKAO_CLIENT_ID`
3. **플랫폼 → Web**: 사이트 도메인 `https://example.com` 등록
4. **카카오 로그인**: 활성화 **ON**, **Redirect URI**에 위 kakao 주소 등록
5. **카카오 로그인 → 동의항목**: 닉네임, 프로필 사진, 카카오계정(이메일)을 필요에 맞게 설정
   (전화번호 등 일부 항목은 비즈 앱 전환·검수가 필요합니다. 없어도 로그인은 됩니다.)
6. **보안 → Client Secret**: 코드 생성 → 활성화 상태 **사용함** → 값 → `KAKAO_CLIENT_SECRET`

### 네이버 로그인 → `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`

1. [NAVER Developers](https://developers.naver.com) → **Application → 애플리케이션 등록**
2. 사용 API: **네이버 로그인**, 제공 정보: 이름/이메일/휴대전화번호 등 필요한 항목 선택
3. 로그인 오픈 API 서비스 환경: **PC 웹** → 서비스 URL `https://example.com`, **Callback URL**에 위 naver 주소
4. 등록 후 **Client ID** → `NAVER_CLIENT_ID`, **Client Secret** → `NAVER_CLIENT_SECRET`
5. 처음에는 "개발 중" 상태라 **멤버로 등록한 계정만** 로그인됩니다. 서비스 공개 전에 **검수 요청**을 하세요.

### Google 로그인 → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

1. [Google Cloud Console](https://console.cloud.google.com) → 새 프로젝트 만들기
2. **API 및 서비스 → OAuth 동의 화면**(Google 인증 플랫폼): 사용자 유형 **외부**, 앱 이름·지원 이메일, 승인된 도메인 `example.com`, 범위 `openid`, `email`, `profile`
3. 게시 상태를 **프로덕션**으로 전환 (테스트 상태면 등록한 테스트 사용자만 로그인됩니다)
4. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID** → 유형 **웹 애플리케이션**
5. **승인된 리디렉션 URI**에 위 google 주소 → 생성된 **클라이언트 ID / 보안 비밀** → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

### 네이버 지도 → `NAVER_MAP_CLIENT_ID`, `NAVER_MAP_CLIENT_SECRET`

1. [네이버 클라우드 플랫폼](https://www.ncloud.com) 가입 → 결제 수단 등록(무료 사용량 이후 과금)
2. 콘솔 → **Services → Application Services → Maps** → **Application 등록**
3. 사용할 API: **Dynamic Map**(지도 표시), **Geocoding**(주소 → 좌표), 필요 시 **Reverse Geocoding**
4. **Web 서비스 URL**에 `https://example.com`, `https://admin.example.com` 등록
5. 인증 정보의 **Client ID** → `NAVER_MAP_CLIENT_ID`, **Client Secret** → `NAVER_MAP_CLIENT_SECRET`

### 공공데이터포털(실거래가) → `DATA_GO_KR_SERVICE_KEY`

1. [공공데이터포털](https://www.data.go.kr) 회원가입
2. 아래 두 API를 검색해서 각각 **활용신청** (보통 자동 승인)
   - 국토교통부\_아파트 매매 실거래가 자료
   - 국토교통부\_아파트 전월세 실거래가 자료
3. **마이페이지 → 개발계정(또는 데이터활용) → 인증키**의 **Decoding(일반 인증키)** 값 → `DATA_GO_KR_SERVICE_KEY`
   (Encoding 키가 아니라 **Decoding** 키입니다)
4. 개발계정은 하루 호출 한도가 있습니다. 운영 중 한도가 부족하면 **운영계정 전환 신청**을 합니다.

### 브이월드(중개사무소 등록번호 대조) → `VWORLD_API_KEY`, `VWORLD_DOMAIN` (선택)

국가공간정보포털이 2024년 브이월드로 통합되면서 「부동산중개업 사무소정보조회」 API는 브이월드에서 제공합니다
(공공데이터포털에는 같은 이름의 **파일 데이터**만 있습니다).

1. [브이월드](https://www.vworld.kr) 회원가입
2. **오픈API → 인증키 발급**: 서비스 URL에 실제 도메인(예: `example.com`)을 입력하고, 사용 API에 데이터 API(부동산중개업)를 포함
3. 발급된 키 → `VWORLD_API_KEY`, 등록한 도메인 → `VWORLD_DOMAIN` (비우면 `PUBLIC_BASE_URL`의 도메인 사용)
4. 인증키는 등록한 도메인에서만 동작합니다(다른 도메인이면 `INCORRECT_KEY`). 키에 유효기간이 있으면 만료 전에 연장하세요.

키가 없어도 중개사무소 가입·승인은 정상 동작합니다. 관리자 심사 화면의 "등록번호 대조" 결과만 "확인 불가"로 표시됩니다.

### 선택 항목

- `ADMIN_IP_ALLOWLIST`: 관리자 API를 특정 IP에서만 허용 (예: `203.0.113.5,198.51.100.0/24`). 비워 두면 제한 없음(비밀번호+OTP는 항상 필요).
  관리자 화면 자체를 막으려면 `/etc/nginx/house/admin-allowlist.conf`도 설정합니다 (OPERATIONS.md 참고).
- `REGION_SGG_CODE`: 서비스 지역 시군구 코드. 순천시는 `12150`(전남광주통합특별시 순천시, 2026-07-01 개편 전에는 전라남도 순천시 `46150`)이며
  기본값이므로 비워 둬도 됩니다. 예전 값 `46150`이 남아 있으면 자동으로 `12150`으로 읽습니다. 아래 '서비스 지역 코드'를 참고하세요.
- `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`, `SEED_DEMO`: 비워 두세요. 관리자 계정은 9단계의 `create-admin.sh`로 만들고, 가상 데모 데이터(`SEED_DEMO`)는 운영 서버에 넣지 않습니다.

설정을 끌 때는 줄을 지우지 말고 값을 비워 두세요 (`GOOGLE_CLIENT_ID=`).
저장한 뒤에는 배포(8단계)를 실행해야 반영됩니다. 이미 배포된 상태에서 `.env`만 바꿨다면 `deploy.sh`가 새로 빌드하지 않고 설정만 다시 읽어 재시작합니다.
이때도 **먼저 새 `.env`로 앱을 임시 포트에서 켜 보고**(사전 점검), 켜지지 않으면 재시작하지 않고 멈춥니다. 화면에 `현재 서비스는 바뀌지 않았습니다`와 함께
마지막으로 정상 동작한 설정(`/var/backups/house/config/env.last-good`)으로 되돌리는 명령이 나오니, 오류 내용을 보고 고치거나 그 명령으로 되돌리세요.

### 서비스 지역 코드 (행정구역 개편)

2026-07-01 전라남도·광주광역시가 전남광주통합특별시(시도 `12`)로 통합되면서 순천시 코드가 `46150` → `12150`으로 바뀌었습니다.
읍면동·리 코드는 앞 다섯 자리만 바뀝니다(왕지동 `46150132` → `12150132`, 신대리 `4615031022` → `1215031022`).

- **`.env`의 `REGION_SGG_CODE`만 바꾸는 것으로는 부족합니다.** 지역 표, 매물·단지·중개사무소·내놓기/구하기·광고 타기팅에 저장된 코드도
  함께 바뀌어야 합니다. 순천시는 배포 때 자동으로 실행되는 DB 마이그레이션(`20261124063850_region_code_12150`)이 기존 데이터를
  `12150`으로 옮기고, 기본 시드가 새 코드로 지역 표를 채웁니다. 별도 작업은 필요 없습니다.
- 중개사무소 등록번호(예: `46150-2020-00012`)는 발급 당시 번호라서 바꾸지 않습니다.
- 사용자가 예전 코드(`46150…`, 예: 옛 링크나 카카오 주소 검색 결과)를 보내도 서버가 `12150…`으로 바꿔 저장합니다.
- 실거래가는 계약월과 상관없이 `12150`으로 조회합니다(국토교통부 API는 개편 전 달도 새 코드로 줍니다). 어떤 달이 0건이면
  `46150`으로 한 번 더 조회하고 경고 로그를 남깁니다. **2026-07 이후 예전 버전(`46150`)으로 동기화했던 달은 0건으로 기록되었을 수
  있으니**, 배포 후 관리자 → 단지 → 실거래가 동기화에서 해당 달을 다시 실행하세요(같은 거래는 중복 저장되지 않습니다).
- 순천시가 아닌 다른 시군구로 서비스를 옮기는 경우는 이 마이그레이션 대상이 아닙니다. 그때는 `REGION_SGG_CODE`를 바꾼 뒤
  관리자 지역 API(`PUT /api/v1/admin/regions/:code`)로 그 시군구의 법정동 목록을 넣고, 기존 데이터는 별도로 옮겨야 합니다.

## 8. 첫 배포

```bash
/srv/house/deploy.sh
```

처음에는 3~10분 걸립니다. 화면에 단계가 차례로 표시됩니다.

1. 저장소에서 최신 코드 가져오기
2. 새 버전 폴더 만들기 (`/srv/house/releases/날짜시간-커밋`)
3. 의존성 설치, 빌드
4. DB 백업(변경이 있을 때) → DB 구조 업데이트(마이그레이션) → 기본 데이터 입력
5. **사전 점검**: 새 버전을 임시 포트에서 실제로 켜 보고, 안 켜지면 여기서 중단 (서비스는 그대로)
6. 서비스 전환 → **무중단 재시작** (API·사이트는 2개 프로세스를 하나씩 교체)
7. 상태 확인(헬스체크). 실패하면 **자동으로 이전 버전으로 되돌림**

마지막에 `✔ 배포 성공`이 나오면 끝입니다.

## 9. 관리자 계정 만들기

```bash
/srv/house/create-admin.sh
```

이메일과 비밀번호(12자 이상)를 입력합니다. 비밀번호는 화면에 보이지 않고 파일에도 저장되지 않습니다.
그다음 `https://admin.example.com`에서 로그인하면 **OTP 등록**(Google Authenticator, Microsoft Authenticator 등 앱으로 QR 스캔)을 먼저 해야 관리자 기능을 쓸 수 있습니다.

## 10. 확인

```bash
/srv/house/status.sh
```

`헬스체크`가 모두 **정상**이면 됩니다. 브라우저에서도 확인하세요.

- `https://example.com` — 사용자 사이트
- `https://admin.example.com` — 관리자 사이트
- `https://example.com/api/v1/health/ready` — `{"status":"ok", ...}` 이 보이면 API·DB·Redis 정상
- `http://www.example.com` → 자동으로 `https://example.com` 으로 이동하는지

**오픈 전에 약관·동의서 교체.** 배포할 때 기본 시드가 약관과 개인정보 동의서 **견본**(버전 1.0)을 넣습니다:
이용약관·개인정보처리방침·위치기반·마케팅, 그리고 신청할 때마다 받는 동의서 4종(중개사무소 등록 신청,
소속 중개사 합류, 내놓기·구하기 수집·이용, 내놓기·구하기 제3자 제공). 법률 검토를 받은 문안으로 관리자 사이트
**약관 관리**에서 새 버전을 게시하세요. 동의서가 하나라도 게시되어 있지 않으면 해당 신청은 접수되지 않습니다
(`AUTH_CONSENT_UNAVAILABLE`).

---

## 11. 업데이트 (코드를 고칠 때마다)

1. 개발 PC에서 코드를 GitHub `main` 브랜치에 push
2. 서버에 SSH 접속 후:

```bash
/srv/house/deploy.sh
```

| 옵션                 | 언제 쓰나요                                     |
| -------------------- | ----------------------------------------------- |
| `--branch 브랜치`    | 다른 브랜치를 배포 (예: 긴급 수정 브랜치)       |
| `--ref 커밋해시`     | 특정 커밋을 배포                                |
| `--skip-migrate`     | DB 변경 없이 코드만 (DB 마이그레이션·시드 생략) |
| `--skip-build-cache` | 빌드가 이상할 때 캐시 없이 처음부터 빌드        |
| `--force`            | 같은 커밋이라도 새로 빌드                       |

- 배포는 한 번에 하나만 실행됩니다. 누가 배포 중이면 `다른 배포가 진행 중입니다`라고 나옵니다.
- 배포는 **별도 세션**에서 실행되고 화면은 그 로그를 보여 주기만 합니다. 그래서 중간에 **SSH가 끊기거나 Ctrl+C를 눌러도 배포는 끝까지 진행**되고,
  실패하면 자동 롤백까지 마칩니다. 다시 접속해서 `tail -f /var/log/house/deploy.log` 로 이어서 볼 수 있습니다.
  꼭 멈춰야 한다면 화면에 표시된 `kill <PID>` 를 실행하세요 (전환 이후라면 이전 버전으로 자동 롤백).
  인터넷이 자주 끊기는 곳이라면 `tmux` 안에서 실행하면 화면도 유지됩니다: `tmux new -s deploy` → 배포 → 끊긴 뒤 `tmux attach -t deploy`.
- 배포 스크립트(`deploy/` 폴더)가 바뀐 커밋이면 마지막에 안내가 나옵니다. 보안상 배포 스크립트는 자동으로 바뀌지 않으므로 안내된 명령
  `sudo /srv/house/bin/install.sh --kit-only --kit-ref <커밋>` 을 실행하세요 (18단계).
- 배포 기록: `/var/log/house/deploy.log`

## 12. 되돌리기 (롤백)

새 버전에 문제가 있으면:

```bash
/srv/house/rollback.sh            # 바로 이전 정상 버전으로
/srv/house/rollback.sh --list     # 버전 목록
/srv/house/rollback.sh 20261123101500-abc1234   # 특정 버전으로
```

- 전환하기 전에 대상 버전을 **현재 `.env`·DB로 임시 포트에서 켜 봅니다**. 켜지지 않으면 전환하지 않고 멈춥니다 (서비스는 그대로).
- 전환 후 헬스체크에 실패하면 **원래 버전으로 자동 복귀**합니다.
- 롤백은 **코드만** 되돌립니다. 대상 버전이 모르는 DB 마이그레이션이 적용되어 있으면 목록을 보여 주고 멈춥니다.
  새 코드가 이미 저장한 새 상태값(enum)을 이전 코드가 읽지 못해 오류가 날 수 있기 때문입니다. 그래도 진행하려면
  `--force`를 붙이고 화면에서 버전 이름을 입력합니다. (개발 규칙상 새 enum 값은 "추가만 하는 배포 → 사용하는 배포" 두 단계로 나가므로,
  **바로 이전 버전**으로의 롤백은 보통 안전합니다.)

데이터를 배포 직전으로 되돌려야 한다면 `/var/backups/house/pre-migrate/`의 백업으로 복원합니다 (OPERATIONS.md의 복원 절차).

## 13. 백업

- **자동**: 매일 03:30 DB 전체 백업과 업로드 파일 스냅샷(바뀌지 않은 파일은 하드링크라 용량을 거의 쓰지 않음), **14일 보관** (`/var/backups/house`)
  - 기간이 지나도 **최근 7개는 항상 남깁니다**(`deploy.conf`의 `BACKUP_KEEP_MIN`). 그날 백업이 실패하면 오래된 백업을 지우지 않습니다.
- **수동**: `/srv/house/backup.sh` (DB만: `--db-only`)
- **배포 전 백업**: DB 변경이 있는 배포마다 `/var/backups/house/pre-migrate/`에 자동 저장 (최근 10개)

### 서버 밖으로 백업 복사 (강력 권장)

서버가 통째로 사라지는 경우를 대비해 외부 저장소(네이버 클라우드 Object Storage, AWS S3, Backblaze B2, Google Drive 등)에 복사해 두세요.

```bash
apt-get install -y rclone
sudo -u house rclone config      # 안내에 따라 원격 저장소 추가 (예: 이름 "offsite")
```

개인정보가 들어 있으므로 rclone의 **crypt**(암호화) 원격을 한 겹 더 만드는 것을 권장합니다. 그다음 `sudo nano /srv/house/shared/deploy.conf`에서:

```
RCLONE_REMOTE=offsite-crypt:house-backups
```

이제 매일 백업 후 DB 덤프와 업로드 파일이 자동으로 업로드됩니다. 서버에서 지워지거나 바뀐 업로드 파일은 원격에서 바로 지우지 않고
`uploads-deleted/<날짜시간>/` 으로 옮겨 14일 동안 보관합니다. (`.env` 비밀값 파일은 외부로 보내지 않습니다. 별도로 안전한 곳에 보관하세요.)

`deploy.conf`는 스크립트가 **읽어서 검사**합니다(실행하지 않음). 값은 `키=값` 한 줄씩, 따옴표 없이 쓰면 됩니다. 모르는 키나 형식이 틀린 값
(예: 포트에 문자, `https://`가 아닌 알림 URL)이 있으면 모든 스크립트가 `deploy.conf N번째 줄 ...` 오류를 내고 멈추니, 그 줄을 고치세요.

백업이 실패하면 알림을 받으려면 [healthchecks.io](https://healthchecks.io) 같은 서비스에서 체크 URL을 만들어 `deploy.conf`에 넣습니다.

```
BACKUP_NOTIFY_URL=https://hc-ping.com/여러분의-UUID
```

## 14. 로그와 모니터링

```bash
/srv/house/status.sh                       # 전체 상태 한 화면
sudo -u house pm2 logs                     # 실시간 로그 (Ctrl+C로 종료)
sudo -u house pm2 logs house-api --lines 200
tail -f /var/log/house/deploy.log          # 배포 기록
```

외부 감시: [UptimeRobot](https://uptimerobot.com) 등에 `https://example.com/api/v1/health/ready`를 5분 간격으로 등록하면, 서비스가 멈췄을 때 메일/앱 알림을 받습니다.

## 15. 문제 해결

| 증상                                | 확인할 것                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 인증서 발급 실패                    | `nslookup`으로 DNS 확인 → 6단계 명령 다시 실행. Cloudflare 주황 구름이면 회색으로.                                        |
| `502 Bad Gateway`                   | 앱이 꺼짐: `/srv/house/status.sh`, `sudo -u house pm2 logs --err --lines 100`                                             |
| 소셜 로그인 후 오류                 | 콘솔의 Redirect URI가 7단계 주소와 **글자 하나까지** 같은지(https, 도메인). `.env`의 CLIENT_ID/SECRET 확인 후 `deploy.sh` |
| 로그인이 유지되지 않음              | HTTPS로 접속했는지 (HTTP에서는 로그인 쿠키가 동작하지 않음)                                                               |
| `다른 배포가 진행 중입니다`         | 다른 창에서 배포 중인지 확인. 진행 중인 것이 없다면 잠시 후 다시 실행                                                     |
| 배포 중 `preflight api: FAILED`     | 새 코드가 켜지지 않음 (서비스는 이전 버전 그대로). 화면의 오류 내용 또는 `.env` 값 확인                                   |
| `Invalid environment configuration` | `.env` 값 형식 오류 (줄에 표시된 키 확인). 서비스는 그대로이며, 화면의 명령으로 직전 정상 `.env`로 되돌릴 수 있음         |
| `deploy.conf N번째 줄 ...`          | 그 줄의 키 이름 또는 값 형식 오류: `sudo nano /srv/house/shared/deploy.conf`                                              |
| `잠금 파일이 없습니다`              | 이전 버전으로 설치된 서버: 18단계의 "기존 서버 업그레이드" 실행                                                           |
| 디스크 가득 참                      | `df -h`, `du -sh /var/backups/house /var/log/house /srv/house/releases` (OPERATIONS.md 참고)                              |
| 저장소를 가져오지 못함              | 6-1 배포 키 등록 확인: `sudo -u house ssh -T git@github.com` (환영 메시지가 나오면 정상)                                  |

## 16. 서버 설정 바꾸기

- **도메인/관리자 주소 변경**: 3단계 DNS를 먼저 바꾸고, 6단계 명령을 새 `--domain`(필요하면 `--admin-subdomain`)으로 다시 실행합니다.
  install.sh가 기존 인증서에 새 이름이 없음을 알아채고 **새 이름으로 인증서를 다시 발급**합니다.
  `.env`는 덮어쓰지 않으므로, 요약의 경고에 나온 키(`PUBLIC_BASE_URL`, `ADMIN_BASE_URL`, `API_BASE_URL`, `CORS_ORIGINS`,
  `KAKAO_REDIRECT_URI`, `NAVER_REDIRECT_URI`, `GOOGLE_REDIRECT_URI`)를 `sudo nano /srv/house/shared/.env`로 고치고, 각 로그인 콘솔의
  Redirect URI도 새 주소로 바꾼 뒤 `/srv/house/deploy.sh`.
- **저장소/브랜치 변경**: 6단계 명령을 새 `--repo`/`--branch`로 다시 실행
- **프로세스 수** (`API_INSTANCES`, `WEB_INSTANCES`, `ADMIN_INSTANCES`): `sudo nano /srv/house/shared/deploy.conf`에서 고친 뒤 **중단 없이**
  ```bash
  sudo -u house pm2 scale house-api 3 && sudo -u house pm2 scale house-web 3 && sudo -u house pm2 save
  ```
  (숫자는 deploy.conf에 적은 값. 다음 배포부터도 그 값이 쓰입니다.)
- **포트** (`API_PORT`, `WEB_PORT`, `ADMIN_PORT`, `WORKER_PORT`): Nginx도 새 포트로 다시 만들어야 합니다. 한가한 시간에 (해당 앱 수 초 중단):
  ```bash
  sudo nano /srv/house/shared/deploy.conf             # 포트 수정
  sudo -u house pm2 delete house-web                    # 바꾼 앱만 (예: WEB_PORT)
  sudo -u house pm2 start /srv/house/current/ecosystem.config.cjs --only house-web && sudo -u house pm2 save
  sudo /srv/house/bin/install.sh --nginx-only           # nginx upstream을 새 포트로
  ```
  `API_PORT`를 바꿨다면 web/admin도 내부 API 주소가 바뀌므로 `house-api`, `house-web`, `house-admin` 모두 위처럼 다시 등록합니다.
- **Nginx 설정만 다시 만들기**: `/srv/house/bin/install.sh --nginx-only`

## 17. 파일 소유권 (보안 구조)

인터넷에 노출된 앱과 빌드 스크립트(npm 패키지)는 `house` 사용자로 실행됩니다. 만약 앱이 뚫리거나 악성 패키지가 들어와도 **root 권한을 얻지 못하도록**
root가 실행하거나 읽는 파일은 모두 root 소유입니다.

| 위치                                                             | 소유 / 권한      | 이유                                                    |
| ---------------------------------------------------------------- | ---------------- | ------------------------------------------------------- |
| `/srv/house`, `/srv/house/bin`, `/srv/house/*.sh`                | root, 0755       | `sudo`로 실행하는 배포 스크립트                         |
| `/srv/house/shared/`                                             | root:house, 0750 |                                                         |
| `/srv/house/shared/.env`, `deploy.conf`                          | root:house, 0640 | 앱은 읽기만. 편집은 `sudo nano`                         |
| `/srv/house/releases/`, `/srv/house/repo.git`                    | house            | 배포(빌드)는 house 사용자가 수행                        |
| `/var/lib/house/uploads`, `/var/backups/house`, `/var/log/house` | house            | 앱·백업이 쓰는 데이터 (root 작업은 house 권한으로 처리) |

배포 스크립트는 `deploy.sh`가 스스로 바꾸지 않습니다. 바뀐 배포 스크립트는 root가 직접 저장소에서 받아 검사(문법 확인) 후 설치합니다 (18단계).

## 18. 배포 스크립트 갱신 / 기존 서버 업그레이드

- **배포 스크립트 갱신** (배포 화면에 안내가 나왔을 때):
  ```bash
  sudo /srv/house/bin/install.sh --kit-only --kit-ref <안내된 커밋>     # 커밋 생략 시 deploy.conf의 BRANCH 최신
  ```
  root가 서버의 배포 키로 저장소에서 `deploy/` 폴더만 받아(호스트 키는 `/srv/house/shared/ssh_known_hosts`로 확인) root 소유로 설치합니다.
- **이 구조 이전에 설치한 서버** (`/srv/house`가 house 소유였던 서버)는 신뢰할 수 있는 새 체크아웃으로 install.sh를 한 번 다시 실행합니다.
  ```bash
  rm -rf /root/house-setup && git clone https://github.com/OWNER/REPO.git /root/house-setup    # 5단계와 같은 방법
  cd /root/house-setup && ./deploy/install.sh --domain example.com --email 내메일@example.com
  ```
  소유권 정리, `current` 링크 구조 변경, 잠금 파일 생성, fail2ban의 nginx 차단 규칙 제거가 자동으로 됩니다. 그다음 `/srv/house/deploy.sh --force`로
  한 번 배포하세요(관리자 사이트가 무중단 모드로 다시 등록되며 이때만 수 초 끊깁니다).

## 부록: 컨테이너 종단 검증 기록 (2026-11-23)

systemd 없는 Ubuntu 24.04 컨테이너에서 저장소 복사본(로컬 경로 `REPO_URL`)으로 아래 순서를 실제로 실행했습니다.

1. `install.sh --no-tls --skip-upgrade --skip-firewall --skip-fail2ban --skip-swap --skip-timezone --skip-pm2-startup`
   → PostgreSQL 역할·DB, Redis(비밀번호), nginx, `/srv/house` 구조, `.env` 생성 (재실행해도 기존 값 유지).
   저장소 디렉터리는 `house` 사용자가 읽을 수 있어야 합니다(다른 소유자면 git의 dubious ownership 오류).
2. 첫 `deploy.sh`: 의존성 설치 → 빌드 → 마이그레이션 전 백업 → 마이그레이션 → 임시 포트 사전 점검 → 전환 (약 1분).
   PM2에서 `house-api` ×2(cluster), `house-worker`(fork, `dist/worker.js`), `house-web` ×2, `house-admin` 실행 확인.
   BullMQ 소비자(blocking 연결)는 모두 worker 프로세스에만 있음을 확인했습니다.
3. nginx: `curl -H 'Host: <도메인>' http://127.0.0.1/api/v1/health/ready` → 200, `/healthz`(web·admin) 200,
   사이트 도메인의 `/api/v1/admin/*`·`/api/v1/ADMIN/*` → 404, `/media/*` 정적 제공(immutable 캐시).
4. 두 번째 배포 중 0.05초 간격으로 api·web·admin·매물 목록을 폴링: 884건 모두 200 (무중단 reload).
5. `rollback.sh -y`: 이전 릴리스로 전환, 폴링 224건 모두 200.
6. API가 부팅 중 죽는 커밋 배포: 사전 점검에서 실패 → 전환하지 않음, 서비스 영향 없음(폴링 776건 모두 200).
7. `create-admin.sh` → 기본 시드 + 최고관리자 생성 (OTP는 첫 로그인 때 등록).

검증하지 못한 부분: 실제 도메인의 인증서 발급(certbot), systemd 서비스 등록·UFW·fail2ban, `restore.sh` 전체 교체
(배포 키트 자체 테스트 `pnpm test:deploy` 범위), `--no-tls`에서는 Secure 쿠키 때문에 관리자 로그인 흐름을 nginx 경유로 확인하지 않았습니다.
