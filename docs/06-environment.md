# 06. 환경변수 및 시크릿

주체 3개(`web` / `api` / `scripts`) × 환경 3개(local / preview / production)를 머리로 관리하면 반드시 틀린다.

## 노출 등급

| 등급 | 뜻 | 규칙 |
|---|---|---|
| **공개** | 브라우저 번들에 박혀도 안전 | `NEXT_PUBLIC_` 접두사 허용 |
| **서버** | 서버에서만 읽힘. 노출 시 DB가 열림 | `NEXT_PUBLIC_` **금지** |
| **로컬** | 개발자 기기에만 존재 | Vercel에 등록하지 **않음** |

## 전체 목록

| 변수 | 주체 | 등급 | 값 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | web | 공개 | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | 공개 | 콘솔의 **publishable key**(`sb_publishable_…`). RLS 전제가 아니라 **Auth 용도로만** 쓴다 |
| `NEXT_PUBLIC_DATA_BASE_URL` | web | 공개 | CDN 데이터 경로. **랜덤 프리픽스 포함 — 실제 값은 커밋 금지** |
| `NEXT_PUBLIC_API_URL` | web | 공개 | 로컬 폴백용. 배포에서는 `VERCEL_RELATED_PROJECTS`가 우선 |
| `VERCEL_RELATED_PROJECTS` | web | 공개 | **Vercel이 자동 주입.** 직접 설정하지 않는다 |
| `VERCEL_GIT_COMMIT_SHA` | api | 공개 | **Vercel이 자동 주입.** `GET /health`의 `version`이 앞 7자리를 쓴다. 로컬에는 없으므로 `dev` |
| `SUPABASE_JWKS_URL` | api | 공개 | `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` — **`/auth/v1/jwks`가 아니다.** 그 경로는 apikey를 요구해 401이 온다 (2026-08-31 실측, SJO-41) |
| `SUPABASE_JWT_ISSUER` | api | 공개 | `iss` 클레임 검증용 |
| `ALLOWED_EMAIL` | api | 공개 | 소유자 이메일. JWT `email` 불일치 시 403 |
| `DATABASE_URL` | api | **서버** | Supavisor 트랜잭션 풀러 `:6543` |
| `DATA_BASE_URL` | api | 공개 | `catalog` 모듈이 인덱스를 받을 경로 |
| `CORS_ALLOWED_ORIGINS` | api | 공개 | 쉼표 구분 |
| `SOURCE_PDF_DIR` | scripts | 로컬 | `data:extract`가 읽을 원본 PDF 디렉터리. **기기마다 다르다.** 미설정이면 즉시 실패 |
| `DATA_CDN_BASE` | scripts | 로컬 | `manifest.json`의 `base`. **랜덤 프리픽스 포함 — 커밋 금지.** 채우는 것은 `data:extract`다. 미설정이면 `base`가 빈 문자열이 되고, 그 manifest는 `data:publish`가 거부한다 |
| `DATA_VERSION` | scripts | 로컬 | 산출물 버전. 미설정이면 `v1`. 데이터를 고치면 `v2`로 올린다 (`04` 「버전 경로를 쓰는 이유」) |
| `AWS_ACCESS_KEY_ID` | scripts | **로컬** | S3 업로드 전용 |
| `AWS_SECRET_ACCESS_KEY` | scripts | **로컬** | 〃 |
| `AWS_REGION` | scripts | 로컬 | `ap-northeast-2` |
| `S3_BUCKET` | scripts | 로컬 | CDN 오리진 버킷 |
| `CLOUDFRONT_DISTRIBUTION_ID` | scripts | 로컬 | 예외 상황 invalidation용. 정상 흐름에선 안 씀 |

## 가장 흔한 사고

**service role key를 `NEXT_PUBLIC_`에 넣는 것.** 브라우저 번들에 박히고, 우리는 RLS를 켜지 않았으므로 DB가 통째로 열린다 (`05-database.md` 설계 원칙 4).

**애초에 service role key를 쓰지 않는다.** `web`은 Auth만 하고 DB에 닿지 않는다. DB는 `api`가 `DATABASE_URL`로만 접근한다.

## AWS 자격증명을 Vercel에 넣지 않는 이유

S3 업로드는 `pnpm data:publish`가 **로컬에서만** 실행한다. 런타임 코드는 CDN을 읽기만 하고 쓰지 않는다. Vercel에 쓰기 권한을 올려둘 이유가 없다.

IAM 정책은 `s3:PutObject` / `s3:GetObject` / `s3:ListBucket`을 `arn:aws:s3:::<bucket>/aws-saa/*` 로 좁힌다.

## 주체별 접근 경계

```
web     → Supabase Auth (anon)  ·  CDN (읽기)  ·  api (Bearer JWT)
api     → Postgres (풀러)        ·  CDN (읽기)  ·  Supabase JWKS (읽기)
scripts → S3 (쓰기)              ·  로컬 PDF
```

**`web`은 Postgres에 직접 닿지 않는다.** 모든 가변 데이터는 `api`를 거친다. 경로가 하나면 소유권 검증도 한 곳에서 끝난다.

## 환경별 차이

| | local | preview | production |
|---|---|---|---|
| API URL | `http://localhost:3001` | `VERCEL_RELATED_PROJECTS` | `VERCEL_RELATED_PROJECTS` |
| CORS 허용 | `http://localhost:3000` | `https://aws-study-*-smelljo.vercel.app` | 프로덕션 도메인 |
| DB | 프로덕션과 **동일** | 동일 | 동일 |
| CDN | 프로덕션과 동일 | 동일 | 동일 |

프리뷰 패턴이 프로젝트명(`aws-study-web-*`)이 아니다. Vercel이 배포마다 주는 URL은 `https://aws-study-<해시>-smelljo.vercel.app`이고 브랜치 별칭만 `aws-study-web-git-<브랜치>-smelljo`다 — 대시보드에서 프리뷰를 열면 앞의 형태라 프로젝트명으로 좁히면 막힌다. (2026-08-27 실측, SJO-3).

**`-smelljo` 접미사는 스코프를 완전히 고정하지 못한다.** 와일드카드가 호스트 레이블 하나(`[^.]*`)를 덮으므로 팀 슬러그를 `evil-smelljo`로 잡고 프로젝트를 `aws-study`로 만들면 `https://aws-study-x-evil-smelljo.vercel.app`이 통과한다. 남은 위험은 **`credentials`를 켜지 않고 인증을 Bearer JWT로 두는 것**으로 막는다 — 교차출처 페이지가 토큰을 읽을 수 없으므로 허용된 Origin이 새어도 얻는 것이 없다. 이 조건이 깨지면(쿠키 인증 도입 등) 패턴부터 다시 좁혀야 한다.

**DB를 환경별로 나누지 않는다.** 사용자 1명, 데이터 규모가 작다. 스테이징 DB를 유지하는 비용이 얻는 것보다 크다.

주의: 프리뷰 배포가 프로덕션 데이터를 건드린다. 마이그레이션을 프리뷰에서 시험하지 않는다.

## `.env.example`

git에 커밋한다. **시크릿과 CDN 랜덤 프리픽스는 값을 비우고 키만 남긴다.** 로컬 기본값이 곧 정답인 것(포트·localhost)은 값을 채워도 된다 — 새 기기에서 그대로 복사해 쓰는 게 목적이다. 실제 값이 담기는 `.env*`는 `.gitignore`에 있어야 한다 (example만 예외).

**아래는 최종 형태다.** 각 변수는 그것을 실제로 읽는 코드가 생기는 이슈에서 추가한다 — 읽는 곳이 없는 키를 미리 넣으면 검증할 수 없는 죽은 설정이 된다.

```bash
# apps/web/.env.example
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_DATA_BASE_URL=          # CDN 경로. 랜덤 프리픽스 포함, 커밋 금지
NEXT_PUBLIC_API_URL=http://localhost:3001

# apps/api/.env.example
DATABASE_URL=
SUPABASE_JWKS_URL=
SUPABASE_JWT_ISSUER=
ALLOWED_EMAIL=
DATA_BASE_URL=                      # CDN 경로. 랜덤 프리픽스 포함, 커밋 금지
CORS_ALLOWED_ORIGINS=http://localhost:3000

# scripts/.env.example
SOURCE_PDF_DIR=                     # 원본 PDF 디렉터리. 기기마다 다르므로 값은 비운다
DATA_CDN_BASE=                      # manifest의 base. 랜덤 프리픽스 포함, 커밋 금지
DATA_VERSION=                       # 비우면 v1
                                    # 파일은 번호 접두사로 고른다 (docs/01 「원본 자료」) — "4. …pdf"
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-northeast-2
S3_BUCKET=
```

## 환경변수가 아닌 전제

`pnpm data:extract`는 **`pdftotext`(poppler)를 PATH에서 찾는다.** 없으면 `spawnSync pdftotext ENOENT`로 죽는다. macOS는 `brew install poppler`.

환경변수가 아니라 여기 적는 이유: 값이 아니라 도구라 `.env`로 해결되지 않고, 새 기기에서 `data:extract`가 실패하는 첫 번째 원인이다 (2026-08-28, SJO-6).

## 검증

`api`는 부팅 시 필수 변수가 없으면 **즉시 죽는다.** 서버리스에서 환경변수 누락은 첫 요청에서야 드러나므로, 부팅 시 검증이 없으면 원인을 찾는 데 오래 걸린다.

NestJS `ConfigModule`에 스키마 검증을 붙인다.
