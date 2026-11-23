# 내 PC(Windows)에서 프론트엔드 개발 돌리기

프론트엔드(사용자 사이트, 중개사 화면, 관리자 화면)는 **API 모의(mock) 모드**로 개발합니다.
그래서 PC에는 **DB(PostgreSQL)나 Redis를 설치할 필요가 없습니다.** Docker, WSL, 가상환경도 쓰지 않습니다.

---

## 1. 설치할 프로그램 (처음 한 번만)

| 순서 | 프로그램 | 받는 곳 | 비고 |
|---|---|---|---|
| ① | **Git for Windows** | https://git-scm.com/download/win | 설치 옵션은 기본값 그대로. Git Bash와 GitHub 로그인 도구(Credential Manager)가 같이 설치됩니다. Claude Code가 Git Bash를 사용합니다. |
| ② | **Node.js 22 LTS** | https://nodejs.org → "22.x LTS" Windows 설치 파일(.msi) | 23 이상이 아니라 **22 버전**이어야 합니다. |
| ③ | **Claude 데스크톱 앱** | 이미 사용 중 | Claude Code 탭에서 내 PC 폴더로 세션을 열 수 있어야 합니다. |

설치가 끝나면 **PowerShell을 관리자 권한으로** 열고 아래를 한 줄씩 실행합니다.

```powershell
corepack enable
```

```powershell
git config --global core.longpaths true
```

- 첫 번째 명령은 pnpm(패키지 관리자)을 켭니다. 프로젝트가 정한 버전(pnpm 10.28.0)이 자동으로 쓰입니다.
- 두 번째 명령은 윈도우의 긴 경로 문제를 막습니다.

확인 (일반 PowerShell):

```powershell
node -v
```

```powershell
pnpm -v
```

`v22.x.x`와 `10.x.x`가 나오면 정상입니다.

---

## 2. 코드 받기

원하는 위치(예: `C:\dev`)에서 PowerShell을 열고 실행합니다.

```powershell
git clone -b develop https://github.com/noob2220202/house.git C:\dev\house
```

```powershell
cd C:\dev\house
```

```powershell
pnpm install
```

- `pnpm install`은 처음에 몇 분 걸립니다.
- 화면 캡처 검수용 브라우저(Playwright Chromium)는 워크플로 첫 단계에서 자동으로 설치됩니다.

> 윈도우 보안(Defender)이 `node_modules` 검사 때문에 느려지면 `C:\dev\house` 폴더를 검사 예외에 추가하면 빨라집니다(선택).

---

## 3. Claude Code로 프론트엔드 작업 시작

1. Claude 데스크톱 앱 → **Claude Code** → 폴더로 **`C:\dev\house`** 를 선택해 새 세션을 엽니다.
2. 첫 메시지로 아래를 그대로 보냅니다.

```
ultracode house-frontend 워크플로를 실행해줘. 작업 브랜치는 frontend로 만들고, 끝나면 커밋해서 origin에 frontend 브랜치로 푸시해줘.
```

- 이 워크플로(`.claude/workflows/house-frontend.js`)는 승인된 디자인 시안(`design/drafts`)을 기준으로 아래 순서로 진행합니다.
  - 공통 UI 컴포넌트 → 사용자 사이트 9개 묶음 → 중개사 화면 3개 묶음 → 관리자 화면 4개 묶음
  - 묶음마다 **제작 → 화면 캡처로 디자인과 비교 리뷰 → 수정**을 거칩니다.
  - 마지막에 화면 전체 일관성을 점검하고 빌드·테스트까지 통과시킵니다.
- PC는 논리 프로세서가 12개라 에이전트를 최대 10개까지 동시에 돌립니다.

### 진행 중 확인
- `/workflows` 를 입력하면 진행 상황이 보입니다.
- 개발 서버를 직접 띄워 보고 싶으면 (모의 모드):

```powershell
cd C:\dev\house\apps\web
```

```powershell
$env:NEXT_PUBLIC_API_MOCK="1"; pnpm exec next dev --port 3000
```

  → 브라우저에서 http://localhost:3000

---

## 4. 백엔드와 합치기

- 백엔드는 클라우드 작업 공간에서 `develop` 브랜치로 계속 개발됩니다.
- PC 작업이 `frontend` 브랜치로 푸시되면, 클라우드 쪽에서 두 브랜치를 합치고 모의 모드를 실제 API로 연결하는 **통합 테스트**를 진행합니다.
- 두 작업은 폴더가 나뉘어 있어 충돌이 거의 없습니다. 프론트엔드는 `apps/web`, `apps/admin`, `packages/ui`, 백엔드는 `apps/api`, `packages/shared`를 씁니다.

## 주의
- **사용량 한도**: 동시에 많이 돌리는 만큼 사용량도 빨리 씁니다. 한도에 걸리면 초기화될 때까지 멈췄다가 이어서 진행하면 됩니다.
- **키/비밀번호는 이 저장소에 절대 커밋하지 않습니다.** 프론트엔드 개발에는 키가 필요 없습니다.
