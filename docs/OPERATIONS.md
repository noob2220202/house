# 운영 가이드 (일상 점검 · 로그 · DB · 복원 · 보안)

서버 설치와 첫 배포는 [DEPLOY.md](DEPLOY.md)를 먼저 보세요. 이 문서는 **서비스를 운영하면서** 필요한 명령과 절차를 모았습니다.
모든 명령은 서버에 SSH로 접속해 **root**(또는 `sudo`)로 실행한다고 가정합니다.

---

## 1. 점검 체크리스트

### 매일 (1분)

```bash
/srv/house/status.sh
```

- 헬스체크가 모두 **정상**인지
- **최근 DB 백업**이 26시간 이내인지 (빨간 경고가 없어야 함)
- 디스크 사용률(`Use%`)이 80% 미만인지
- PM2 앱의 `restarts` 숫자가 갑자기 늘지 않았는지 (늘었다면 로그 확인)

### 매주

- 관리자 화면에서 **허위매물 신고**, **중개사무소 승인 대기** 처리
- `sudo -u house pm2 logs --err --lines 200` 으로 반복되는 오류가 없는지
- 외부 백업(rclone)을 쓴다면 원격 저장소에 최근 파일이 올라갔는지: `sudo -u house rclone ls offsite-crypt:house-backups/db | tail`

### 매월

- **보안 업데이트 + 재부팅** (아래 8장)
- **복원 연습** (아래 5장) — 백업은 복원해 봐야 믿을 수 있습니다
- 인증서 만료일 확인 (`status.sh`의 TLS 항목, 자동 갱신 동작 확인)
- 공공데이터포털 API 사용량·만료일, 네이버 클라우드 요금 확인

---

## 2. 로그

| 로그                       | 위치 / 명령                                                          |
| -------------------------- | -------------------------------------------------------------------- |
| API / worker / web / admin | `sudo -u house pm2 logs` · 파일: `/var/log/house/pm2/*.log`          |
| 배포·롤백 기록             | `/var/log/house/deploy.log`                                          |
| 백업 기록                  | `/var/log/house/backup.log`                                          |
| 복원 기록                  | `/var/log/house/restore.log`                                         |
| Nginx 접속/오류            | `/var/log/nginx/house-web.*.log`, `/var/log/nginx/house-admin.*.log` |
| PostgreSQL                 | `/var/log/postgresql/postgresql-16-main.log`                         |
| Redis                      | `/var/log/redis/redis-server.log`                                    |
| 자동 보안 업데이트         | `/var/log/unattended-upgrades/`                                      |

자주 쓰는 명령:

```bash
sudo -u house pm2 logs house-api --lines 200        # API 최근 로그
sudo -u house pm2 logs house-worker                 # 실거래가 동기화·배너 통계 등 작업 로그
grep '"level":50' /var/log/house/pm2/api.out.log | tail -20   # API 오류(level 50)만
tail -f /var/log/nginx/house-web.access.log         # 실시간 접속
grep ' 429 ' /var/log/nginx/house-web.access.log | tail   # 요청 제한에 걸린 요청
```

API 로그는 JSON 한 줄 형식이며, 각 요청에 `requestId`가 붙습니다. 사용자가 오류 화면의 요청 ID를 알려 주면 `grep 요청ID /var/log/house/pm2/api.out.log`로 찾을 수 있습니다.

로그 파일은 자동으로 정리됩니다: 앱 로그는 PM2 logrotate(50MB 또는 매일, 14개 보관), 배포/백업 로그는 logrotate(주 1회, 12주), Nginx는 Ubuntu 기본 설정.

## 3. PM2 (앱 프로세스) 명령

PM2는 `house` 사용자로 동작하므로 항상 `sudo -u house pm2 ...` 형태로 실행합니다.

| 명령                                     | 설명                                                 |
| ---------------------------------------- | ---------------------------------------------------- |
| `sudo -u house pm2 ls`                   | 앱 목록과 상태                                       |
| `sudo -u house pm2 monit`                | CPU·메모리 실시간 화면 (q로 종료)                    |
| `sudo -u house pm2 describe house-api`   | 앱 상세 (재시작 횟수, 로그 경로, 실행 위치)          |
| `sudo -u house pm2 reload house-api`     | API **무중단** 재시작 (2개 프로세스를 하나씩)        |
| `sudo -u house pm2 restart house-worker` | 작업 처리기 재시작 (진행 중 작업은 최대 30초 마무리) |
| `sudo -u house pm2 reload all`           | 전체 재시작 (`.env` 변경은 `deploy.sh`로 반영하세요) |
| `sudo -u house pm2 flush`                | 로그 파일 비우기                                     |

- 앱 구성: `house-api`(API, 2개), `house-worker`(작업 큐, 1개), `house-web`(사용자 사이트, 2개), `house-admin`(관리자, 1개)
- 메모리가 기준(API 700MB, worker 800MB, web 600MB, admin 400MB)을 넘으면 PM2가 자동으로 재시작합니다.
- 서버 재부팅 후 자동 시작은 systemd 서비스 `pm2-house`가 담당합니다: `systemctl status pm2-house`
- `.env`를 바꾼 뒤에는 `pm2 reload`보다 **`/srv/house/deploy.sh`** 를 쓰세요. 같은 버전이면 빌드 없이 설정만 다시 읽습니다.

## 4. 서비스(시스템) 명령

```bash
systemctl status nginx postgresql redis-server pm2-house cron fail2ban
systemctl reload nginx            # Nginx 설정 반영 (먼저 nginx -t 로 검사)
systemctl restart redis-server    # Redis 재시작 (데이터는 디스크에 보존, 앱은 자동 재연결)
systemctl restart postgresql      # DB 재시작 (수 초간 API 오류 발생, 한가한 시간에)
```

Nginx 설정은 템플릿으로 생성됩니다. 직접 고치지 말고 저장소의 `deploy/nginx/`를 수정해 배포한 뒤 `/srv/house/bin/install.sh --nginx-only`로 다시 만드세요.

## 5. 데이터베이스

### 접속

```bash
# 앱 계정으로 (일반 조회) — .env의 DATABASE_URL 사용
sudo -u house bash -c 'psql "$(grep ^DATABASE_URL= /srv/house/shared/.env | cut -d= -f2- | sed "s/?.*//")"'

# 관리자(슈퍼유저)로
sudo -u postgres psql -d house
```

- 운영 DB에서 직접 `UPDATE`/`DELETE`를 하기 전에는 **반드시** `/srv/house/backup.sh --db-only`로 백업하세요.
- 가능하면 관리자 화면에서 처리하세요. 관리자 화면의 변경은 **감사 로그**(누가, 무엇을, 이전/이후 값, IP)에 남지만 직접 SQL은 남지 않습니다.
- 읽기 전용으로 보려면 psql에서 먼저 `SET default_transaction_read_only = on;`

유용한 조회:

```sql
SELECT pg_size_pretty(pg_database_size(current_database()));          -- DB 크기
SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY 2 DESC LIMIT 15;  -- 큰 테이블
SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;  -- 최근 마이그레이션
SELECT pid, now() - query_start AS 시간, state, left(query, 80) FROM pg_stat_activity
 WHERE datname = current_database() AND state <> 'idle' ORDER BY 2 DESC;   -- 오래 걸리는 쿼리
```

### Redis

```bash
sudo -u house bash -c 'REDISCLI_AUTH="$(grep ^REDIS_URL= /srv/house/shared/.env | sed -E "s#.*://:([^@]*)@.*#\1#")" redis-cli -h 127.0.0.1 info memory | head -5'
```

Redis에는 **로그인 세션**과 **작업 큐**가 있어 `noeviction`(메모리가 차도 지우지 않음)으로 설정되어 있습니다. `used_memory`가 `maxmemory`(서버 메모리의 1/8, 최대 1GB)에 가까워지면 `/etc/redis/house.conf`의 `maxmemory`를 늘리고 `systemctl restart redis-server`.
`FLUSHALL`은 절대 실행하지 마세요 (모든 사용자가 로그아웃되고 대기 중 작업이 사라집니다).

## 6. 백업과 복원

### 백업 현황

```bash
/srv/house/restore.sh --list
ls -lh /var/backups/house/db | tail
```

| 종류              | 주기                     | 위치                              | 보관    |
| ----------------- | ------------------------ | --------------------------------- | ------- |
| DB 전체 (pg_dump) | 매일 03:30               | `/var/backups/house/db/`          | 14일    |
| 업로드 파일       | 주 1회 (하드링크 스냅샷) | `/var/backups/house/uploads/`     | 14일    |
| 배포 전 DB        | DB 변경이 있는 배포마다  | `/var/backups/house/pre-migrate/` | 최근 10 |
| 복원 전 DB        | 복원할 때마다            | `/var/backups/house/pre-restore/` | 수동    |
| `.env` 사본       | 매일                     | `/var/backups/house/config/`      | 14일    |
| 외부 복사(선택)   | 매일                     | `RCLONE_REMOTE`                   | 14일    |

**`.env` 사본은 서버 밖으로 따로 보관**하세요 (비밀번호 관리자 등). 서버를 새로 만들 때 이 파일이 있어야 관리자 OTP와 기존 세션이 유지됩니다.

### 복원 연습 (매월 권장, 운영에 영향 없음)

```bash
/srv/house/restore.sh --db /var/backups/house/db/house-YYYYMMDD-HHMMSS.dump --target-db house_drill
sudo -u postgres psql -d house_drill -c "SELECT count(*) FROM users;"     # 데이터가 보이는지
sudo -u postgres dropdb house_drill                                       # 확인 후 삭제
```

복원 연습 날짜와 결과(테이블 수, 걸린 시간)를 기록해 두세요.

### 실제 복원 (데이터 사고 시)

1. **원인부터 멈추기**: 잘못된 배포라면 먼저 `/srv/house/rollback.sh`
2. 복원할 시점의 덤프 선택: `/srv/house/restore.sh --list`
3. 실행:

```bash
/srv/house/restore.sh --db /var/backups/house/db/house-YYYYMMDD-HHMMSS.dump
```

- 확인 질문에 DB 이름(`house`)을 정확히 입력해야 진행됩니다.
- 과정: 현재 DB 덤프(안전 백업) → **새 DB에 복원·검증** → API·worker 일시 중지(약 10초) → 이름 교체 → 재시작 → 헬스체크
- 교체 전 DB는 `house_before_날짜시간` 이름으로 남아 있습니다. 며칠 지켜본 뒤 삭제: `sudo -u postgres dropdb house_before_...`
- 덤프 시점 이후의 데이터(새 매물, 회원가입 등)는 사라집니다. 필요하면 `house_before_...` DB에서 해당 데이터를 조회해 옮깁니다.

업로드 파일 복원:

```bash
/srv/house/restore.sh --uploads /var/backups/house/uploads/YYYYMMDD-HHMMSS
```

### 서버 이전 / 서버가 사라졌을 때

1. 새 서버에서 DEPLOY.md 4~6단계 (install.sh)
2. **설치 직후, 첫 배포 전에** 보관해 둔 `.env`를 `/srv/house/shared/.env`로 복사 (`chown house:house`, `chmod 600`)
   그리고 install.sh를 한 번 더 실행해 DB/Redis 비밀번호를 그 `.env`에 맞춥니다.
3. 외부 백업에서 최신 DB 덤프와 업로드 파일을 받아 `/var/backups/house/db/`, `/var/backups/house/uploads/<날짜>/` 에 놓기
   (예: `sudo -u house rclone copy offsite-crypt:house-backups/db /var/backups/house/db`)
4. `/srv/house/deploy.sh` → `/srv/house/restore.sh --db ...` → `/srv/house/restore.sh --uploads ...`
5. DNS A 레코드를 새 서버 IP로 바꾸고, 반영 후 install.sh를 다시 실행하면 인증서가 발급됩니다.

## 7. HTTPS 인증서

- Let's Encrypt 인증서(90일)는 **자동 갱신**됩니다 (`certbot.timer`, 하루 2회 확인, 만료 30일 전 갱신). 갱신 후 Nginx가 자동으로 다시 읽습니다.
- 확인:

```bash
certbot certificates                 # 만료일
systemctl list-timers | grep certbot # 자동 갱신 타이머
certbot renew --dry-run              # 갱신 시험 (실제 변경 없음)
```

- 만료 알림 메일이 오면 대개 DNS나 방화벽(80번 포트) 문제입니다. `certbot renew` 를 직접 실행해 오류를 확인하세요.
- 도메인을 추가/변경했다면 install.sh를 새 도메인으로 다시 실행합니다.

## 8. 보안 업데이트

- **자동**: Ubuntu 보안 업데이트는 매일 자동 설치됩니다(unattended-upgrades). **재부팅은 자동으로 하지 않습니다.**
- **매월 1회 (사용자가 적은 새벽 시간)**:

```bash
apt-get update && apt-get upgrade -y       # PostgreSQL(PGDG), Node.js(NodeSource) 패치 포함
[ -f /var/run/reboot-required ] && echo "재부팅 필요"
reboot                                     # 필요할 때만. 1~2분 후 앱은 자동으로 다시 켜집니다
```

재부팅 후 `/srv/house/status.sh`로 확인합니다.

- **Node.js 메이저 버전**(22 → 24 등)과 **PostgreSQL 메이저 버전** 업그레이드는 자동으로 하지 않습니다. 개발 쪽에서 호환성을 확인한 뒤 별도로 계획하세요.
- **SSH 강화** (SSH 키 로그인이 되는 것을 확인한 뒤에만):
  `/etc/ssh/sshd_config.d/90-house.conf` 에 `PasswordAuthentication no` 와 `PermitRootLogin prohibit-password` 를 쓰고 `systemctl reload ssh`.
  **현재 접속 창을 닫지 말고** 새 창에서 로그인되는지 먼저 확인하세요.
- **방화벽**: `ufw status` (22/80/443만 열려 있어야 함). PostgreSQL(5432)과 Redis는 외부에 열지 않습니다.
- **차단 현황**: `fail2ban-client status sshd`, 차단 해제: `fail2ban-client set sshd unbanip 1.2.3.4`

### 관리자 화면 IP 제한

```bash
nano /etc/nginx/house/admin-allowlist.conf
```

```
allow 203.0.113.10;     # 사무실
deny all;
```

`nginx -t && systemctl reload nginx`. API 수준 제한은 `.env`의 `ADMIN_IP_ALLOWLIST`(배포 필요). 집·사무실 IP가 바뀌면 관리자 화면이 막히므로, 바뀐 IP를 추가하거나 SSH로 접속해 이 파일을 고치면 됩니다.

### 비밀값 교체

| 값                         | 교체 영향 / 방법                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 소셜 로그인 Secret, API 키 | 콘솔에서 재발급 → `.env` 수정 → `/srv/house/deploy.sh`                                                                      |
| `COOKIE_SECRET`            | 바꾸면 **모든 사용자가 로그아웃**됩니다. 유출이 의심될 때만. `openssl rand -base64 48`                                      |
| `TOTP_ENCRYPTION_KEY`      | **바꾸지 마세요.** 바꾸면 모든 관리자 OTP가 무효가 됩니다. (유출 시 개발자와 함께 재암호화 작업)                            |
| DB 비밀번호                | `.env`의 `DATABASE_URL` 비밀번호 부분을 새 값(영문·숫자)으로 수정 → `install.sh` 재실행(역할 비밀번호 동기화) → `deploy.sh` |
| Redis 비밀번호             | `.env`의 `REDIS_URL` 수정 → `install.sh` 재실행 → `deploy.sh`                                                               |

## 9. 디스크 관리

```bash
df -h /
du -sh /srv/house/releases /var/backups/house /var/lib/house/uploads /var/log/house /srv/house/shared/pnpm-store
```

- 릴리스는 최근 5개만 보관됩니다 (`deploy.conf`의 `KEEP_RELEASES`).
- 빌드 캐시가 커지면: `rm -rf /srv/house/shared/turbo-cache` (다음 배포가 조금 느려질 뿐 안전)
- pnpm 저장소 정리: `cd /srv/house/current && sudo -u house pnpm store prune --store-dir /srv/house/shared/pnpm-store`
- 백업 보관 기간 조정: `deploy.conf`의 `BACKUP_RETENTION_DAYS`

## 10. 장애 대응 순서

1. `/srv/house/status.sh` — 어느 부분이 실패인지 확인
2. **앱(api/web/admin)만 실패** → `sudo -u house pm2 logs <앱> --err --lines 100`
   - 방금 배포했다면 → `/srv/house/rollback.sh`
   - `.env` 문제(`Invalid environment configuration`)라면 → 값 수정 → `/srv/house/deploy.sh`
3. **DB(`db` 체크) 실패** → `systemctl status postgresql`, `tail -50 /var/log/postgresql/postgresql-16-main.log`, 디스크 가득 참 여부(`df -h`)
4. **Redis 실패** → `systemctl status redis-server`, `tail -50 /var/log/redis/redis-server.log`
5. **nginx만 실패** → `nginx -t`, `systemctl status nginx`
6. 사이트가 아예 안 열림 → VPS 콘솔에서 서버가 켜져 있는지, DNS(`nslookup`)가 맞는지, `ufw status`
7. 조치 후 다시 `/srv/house/status.sh`. 발생 시각·원인·조치를 기록해 두세요.

## 11. 규모 조정

- 접속이 늘어 CPU가 부족하면 VPS 사양을 올린 뒤 `deploy.conf`의 `API_INSTANCES`(CPU 수 - 1 정도), `WEB_INSTANCES`를 늘립니다. 프로세스 수 변경은 다시 등록해야 반영됩니다(수 초 중단):
  `sudo -u house pm2 delete house-api house-web && /srv/house/deploy.sh --force`
- PostgreSQL 메모리 설정은 기본값입니다. 4GB 이상 서버에서는 `/etc/postgresql/16/main/conf.d/house.conf`에 예를 들어
  `shared_buffers = 1GB`, `effective_cache_size = 3GB`, `work_mem = 16MB` 를 넣고 한가한 시간에 `systemctl restart postgresql`.
