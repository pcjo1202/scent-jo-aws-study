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
| `SUPABASE_JWT_ISSUER` | api | 공개 | `https://<ref>.supabase.co/auth/v1` — **후행 슬래시 없음.** jose의 `issuer` 옵션은 토큰 `iss`와 문자열 완전 일치를 요구해 슬래시 하나만 붙어도 401이다 (2026-09-06 실측, SJO-50). 같은 값이 `/auth/v1/.well-known/openid-configuration`의 `issuer`로도 나온다 |
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

### 필수 키를 추가하는 이슈가 Vercel 등록까지 한다

**`env.ts`의 `REQUIRED_ENV_KEYS`에 키를 추가하는 이슈는 같은 이슈 안에서 Vercel 등록과 개수 세기까지 끝낸다.** 코드만 넣고 환경을 비워 두면 그 순간부터 배포된 api가 부팅에서 죽는데, 죽는 것이 의도된 동작이라 로컬 게이트(`typecheck`·`test`)는 전부 초록이다. SJO-12가 셋을 필수로 만들고 등록하지 않아 SJO-50까지 남았다.

절차는 셋이다.

1. **세 환경 전부에 넣는다** — production·preview·development. `DATABASE_URL`이 production에만 있던 사고를 SJO-13에서 한 번 했다
2. **`vercel env ls`로 「몇 칸 중 몇 칸」을 센다.** 키 목록은 손으로 적지 않고 `env.ts`에서 뽑아 대조한다 — 손으로 적으면 방금 추가한 키를 목록에도 빠뜨린다. 기준은 **필수 키 수 × 3환경**이다 (2026-09-06 실측 12칸 중 12칸, SJO-50)
3. **값 자체는 development에서만 되받아 볼 수 있다.** `vercel env add`가 production·preview 항목을 Sensitive로 만들어 `vercel env pull`이 `[SENSITIVE]`로 가린다. 세 환경에 같은 값을 넣었다는 것은 **한 번의 실행에서 같은 변수로 넣어** 보장하고, 프로덕션 쪽은 배포 후 `GET /health` 200으로 확인한다

**등록만으로는 기존 배포가 낫지 않는다.** 환경변수는 배포 시점에 묶이므로 **재배포해야 반영된다** — `vercel redeploy <배포 URL>`이면 같은 커밋 그대로 새 값을 태운다 (2026-09-06, SJO-50: 500 → 200).

### 빌드 산출물을 실제로 띄워 본다

`pnpm --filter @aws-study/api build`가 `nest build` 뒤에 `smoke.mjs`를 돌린다. `dist/main.js`를 자식 프로세스로 띄우고 `GET /health` 200을 받은 뒤 죽인다. 실패하면 빌드가 실패한다 — Vercel 빌드에서도 같다.

**왜 필요한가.** `pnpm test`는 vitest + `unplugin-swc`로 **소스**를 직접 돌리고, `pnpm typecheck`는 `tsc --noEmit`이라 emit 결과를 실행하지 않는다. `nest build` 산출물을 Node로 실행하는 경로가 어디에도 없어서, `@nestjs/config@12`가 ESM 전용이 된 것이 **배포에서야** 드러났다 (SJO-49 — 프로덕션 api와 web 빌드가 동시에 막혀 있었다).

**`--no-experimental-require-module`이 이 검사의 전부다.** Vercel Fluid 런타임의 모듈 로더는 Node 24의 `require(esm)`를 구현하지 않는데 로컬 Node 24는 구현한다. 이 플래그가 없으면 **프로덕션에서 죽는 코드가 로컬에서 200을 준다** (2026-09-04 실측). 플래그를 빼면 검사가 통과만 하고 아무것도 막지 못한다.

우회 경로 프로브로 실측했다 — ESM 전용 패키지를 값으로 import하는 자리를 `app.module.ts`·`main.ts`·`cors-origins.ts`(모듈 그래프 밖)·`auth/jwks.service.ts`(그래프 말단)와 동적 `import()`까지 **5곳에 심어 5곳 전부 검출**, 정상 케이스 2건(타입 전용 import·무패치) 오탐 0.

**환경변수는 `smoke.mjs`가 자체 주입한다.** `.env`나 Vercel 등록 상태에 게이트가 좌우되면 기기마다 판정이 갈린다. 값은 URL 형태여야 한다 — `JwksService`가 생성자에서 `new URL()`을, `postgres()`가 접속 문자열을 즉시 파싱한다.
