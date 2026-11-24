# 순천부동산지도 — 발급·준비 체크리스트

도메인: **suncheonmap.kr** · 관리자: **admin.suncheonmap.kr** · 앱 이름을 묻는 곳에는 **순천부동산지도**

> ⚠️ **키·Secret은 채팅에 붙여 넣지 마세요.** 메모장이나 비밀번호 관리자에 아래 **"저장할 이름"** 그대로 적어 두면,
> 최종 배포 때 서버 파일(`/srv/house/shared/.env`)에 직접 넣습니다.
> 저(Claude)에게는 **서버 IP만** 알려 주세요. 비밀 정보가 아닙니다.

---

## 0. 기본 준비

- [ ] **도메인 구매**: suncheonmap.kr ✅
- [ ] **DNS A 레코드 3개** → 모두 **서버 IP** ✅ (전파에 몇 시간 걸릴 수 있음)

  | 호스트  | 종류 | 값      |
  | ------- | ---- | ------- |
  | `@`     | A    | 서버 IP |
  | `www`   | A    | 서버 IP |
  | `admin` | A    | 서버 IP |

- [ ] **VPS 서버**: Ubuntu **24.04**, 2 vCPU / **4GB RAM** / SSD 50GB+, **서울 리전**, 고정 IP
  - 받아 둘 것: **서버 IP**, root 비밀번호(또는 SSH 키)
- [ ] **GitHub 저장소 비공개 전환**: github.com/noob2220202/house → Settings → 맨 아래 Danger Zone → Change visibility → **Private**
- [ ] **GitHub 읽기 전용 토큰** (서버가 코드를 받아 갈 때 사용)
  1. github.com/settings/personal-access-tokens/new → **Fine-grained token**
  2. Repository access: **Only select repositories → house**
  3. Permissions → **Contents: Read-only**, 만료 1년
  4. 저장할 이름: `GITHUB_TOKEN`
- [ ] **관리자 이메일** 1개 정하기 + 휴대폰에 **OTP 앱**(Google Authenticator 등) 설치

---

## 1. 카카오 로그인 — developers.kakao.com

1. [ ] 내 애플리케이션 → **애플리케이션 추가** (앱 이름: 순천부동산지도)
2. [ ] 플랫폼 → **Web** → 사이트 도메인: `https://suncheonmap.kr`
3. [ ] 카카오 로그인 → **활성화 ON**
4. [ ] Redirect URI: `https://suncheonmap.kr/api/v1/auth/oauth/kakao/callback`
5. [ ] 동의항목: **닉네임(필수)**, 프로필 사진(선택), 카카오계정 이메일(선택 — 사업자등록번호로 **비즈 앱 전환** 필요)
6. [ ] 보안 → **Client Secret** 코드 생성 → 활성화 상태 **사용함**

| 저장할 이름           | 값이 있는 곳            |
| --------------------- | ----------------------- |
| `KAKAO_CLIENT_ID`     | 앱 키 → **REST API 키** |
| `KAKAO_CLIENT_SECRET` | 보안 → Client Secret    |

_메뉴 이름은 카카오 화면 개편에 따라 조금 다를 수 있습니다._

---

## 2. 네이버 로그인 — developers.naver.com → Application → 애플리케이션 등록

1. [ ] 애플리케이션 이름: 순천부동산지도
2. [ ] 사용 API: **네이버 로그인** → 제공 정보: **별명, 이메일, 프로필 사진**
3. [ ] 환경: **PC 웹**
   - 서비스 URL: `https://suncheonmap.kr`
   - Callback URL: `https://suncheonmap.kr/api/v1/auth/oauth/naver/callback`

| 저장할 이름           | 값이 있는 곳  |
| --------------------- | ------------- |
| `NAVER_CLIENT_ID`     | Client ID     |
| `NAVER_CLIENT_SECRET` | Client Secret |

_검수 요청은 사이트 오픈 후에 합니다(검수 전에는 등록한 멤버 계정만 로그인 가능)._

---

## 3. Google 로그인 — console.cloud.google.com

1. [ ] 새 프로젝트 만들기 (이름 자유)
2. [ ] **Google 인증 플랫폼**(OAuth 동의 화면) → 시작하기
   - 앱 이름: 순천부동산지도 · 사용자 지원 이메일 · 대상: **외부**
   - 승인된 도메인: `suncheonmap.kr`
   - 홈페이지: `https://suncheonmap.kr` · 개인정보처리방침: `https://suncheonmap.kr/terms/privacy` · 서비스 약관: `https://suncheonmap.kr/terms/service`
3. [ ] **클라이언트** → 클라이언트 만들기 → **웹 애플리케이션**
   - 승인된 JavaScript 원본: `https://suncheonmap.kr`
   - 승인된 리디렉션 URI: `https://suncheonmap.kr/api/v1/auth/oauth/google/callback`
4. [ ] 대상 → **앱 게시(프로덕션으로 푸시)** — 테스트 상태면 등록한 사용자만 로그인됩니다

| 저장할 이름            | 값이 있는 곳                                                            |
| ---------------------- | ----------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | 클라이언트 ID                                                           |
| `GOOGLE_CLIENT_SECRET` | 클라이언트 보안 비밀번호 (**만들 때 한 번만 보일 수 있으니 바로 저장**) |

---

## 4. 네이버 클라우드 지도 — ncloud.com

1. [ ] 회원가입 → **결제수단 등록** (무료 사용량 안에서는 대부분 무료)
2. [ ] 콘솔 → Services → **Maps** → Application 등록
3. [ ] 사용 API: **Dynamic Map, Geocoding, Reverse Geocoding** 3개 체크
4. [ ] Web 서비스 URL: `https://suncheonmap.kr`, `https://www.suncheonmap.kr`, `https://admin.suncheonmap.kr`

| 저장할 이름               | 값이 있는 곳                                                 |
| ------------------------- | ------------------------------------------------------------ |
| `NAVER_MAP_CLIENT_ID`     | Client ID (**같은 값을 `NEXT_PUBLIC_NAVER_MAP_KEY_ID`에도**) |
| `NAVER_MAP_CLIENT_SECRET` | Client Secret                                                |

---

## 5. 공공데이터포털 (실거래가) — data.go.kr

1. [ ] 회원가입
2. [ ] 아래 2개를 검색해서 각각 **활용신청** (목적: 웹사이트 서비스, 보통 자동 승인)
   - 국토교통부\_아파트 매매 실거래가 상세 자료
   - 국토교통부\_아파트 전월세 실거래가 자료
3. [ ] 마이페이지 → 데이터활용 → 인증키 → **일반 인증키(Decoding)** 복사

| 저장할 이름              | 값이 있는 곳                               |
| ------------------------ | ------------------------------------------ |
| `DATA_GO_KR_SERVICE_KEY` | 일반 인증키 **(Decoding)** — Encoding 아님 |

_승인 후 실제로 동작하기까지 1~2시간 걸릴 수 있습니다._

---

## 6. 브이월드 (선택 — 중개사무소 등록번호 자동 대조) — vworld.kr

1. [ ] 회원가입 → 오픈API → **인증키 발급**
2. [ ] 서비스 URL: `suncheonmap.kr` · 활용 API: **데이터 API(부동산중개업)** 포함

| 저장할 이름      | 값이 있는 곳  |
| ---------------- | ------------- |
| `VWORLD_API_KEY` | 발급된 인증키 |

_없어도 중개사무소 가입·승인은 정상 동작합니다(자동 대조만 빠짐)._

---

## 7. 사이트에 넣을 사업자 정보 (배포 후 관리자 화면 → 사이트 설정에서 입력)

- [ ] 상호 · 대표자 · 사업자등록번호
- [ ] 통신판매업 신고번호
- [ ] 사업장 주소
- [ ] 개인정보보호책임자 (이름·연락처)
- [ ] 고객센터 전화·이메일
- [ ] 호스팅 서비스 제공자 (VPS 업체 이름)

## 8. 배포 후에 할 것 (그때 안내)

- [ ] 네이버 로그인 **검수 요청**
- [ ] **네이버 서치어드바이저**(searchadvisor.naver.com) · **구글 서치 콘솔**(search.google.com/search-console)에 사이트 등록 → 사이트맵 제출
- [ ] 약관 4종 + 동의서 문구 법률 검토 후 관리자 화면에서 게시

---

## 확인용 표 — 다 모이면 체크

| 저장할 이름                                                                         | 어디서          | ✔  |
| ----------------------------------------------------------------------------------- | --------------- | --- |
| `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`                                            | 카카오          | ☐   |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`                                            | 네이버 로그인   | ☐   |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                          | Google          | ☐   |
| `NAVER_MAP_CLIENT_ID`, `NAVER_MAP_CLIENT_SECRET` (+ `NEXT_PUBLIC_NAVER_MAP_KEY_ID`) | 네이버 클라우드 | ☐   |
| `DATA_GO_KR_SERVICE_KEY`                                                            | 공공데이터포털  | ☐   |
| `VWORLD_API_KEY` (선택)                                                             | 브이월드        | ☐   |
| `GITHUB_TOKEN`                                                                      | GitHub          | ☐   |
| 서버 IP · root 접속 정보                                                            | VPS             | ☐   |
| 관리자 이메일 · OTP 앱                                                              | —               | ☐   |

**SMS 키, Apple 키는 필요 없습니다.** (Apple 로그인·SMS 발송 기능 없음)
