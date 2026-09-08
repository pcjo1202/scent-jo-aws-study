# 03. 아키텍처

## 전체 구조

```
              ┌─────────────────────────────────────┐
              │  static-cdn.scent-jo.dev            │
              │  S3 (ap-northeast-2) + CloudFront   │
              │  문제 · 노트 · 해부서 (불변)          │
              └──────────────┬──────────────────────┘
                             │ ① 정적 데이터 fetch (immutable)
                             ▼
  ┌──────────┐        ┌─────────────┐  ③ Bearer JWT   ┌──────────────┐
  │ Supabase │◀──②───▶│  Next.js    │────────────────▶│   NestJS     │
  │   Auth   │ 로그인  │  apps/web   │                 │  apps/api    │
  └──────────┘        └─────────────┘                 └──────┬───────┘
       │                                                     │ ④ JWKS 검증 (로컬)
       │                                                     │ ⑤ Supavisor :6543
       │                                              ┌──────▼───────┐
       └─────────────────────────────────────────────▶│  Postgres    │
                        같은 Supabase 프로젝트          │  진도·시도    │
                                                      └──────────────┘
```

## 핵심 결정: 데이터를 둘로 쪼갠다

| 데이터 | 성질 | 저장소 | 근거 |
|---|---|---|---|
| 문제 1019 · 노트 234 · 해부서 | **불변** | CDN | 변하지 않는 2.7MB를 매 요청마다 서버리스 함수에 통과시킬 이유가 없다 |
| 진도 · 시도 · 세션 | 가변, 사용자별 | Postgres | 기기 간 동기화가 필요한 유일한 데이터 |

이 분리가 세 가지를 동시에 해결한다.

1. 폰에서 빠르다 — CDN 엣지에서 직접, 서버 왕복 없음
2. 백엔드가 죽어도 문제는 읽힌다 — 진도 저장만 실패한다
3. NestJS가 맡는 일이 명확해진다 — 인증 가드, 도메인 로직, 집계. 정적 파일 서빙 프록시가 아니다

## 모노레포

```
aws-study/
├─ apps/
│  ├─ web/              Next.js 16.x · App Router
│  └─ api/              NestJS
├─ packages/
│  └─ shared/           도메인 타입, API 계약 DTO
├─ scripts/             PDF → JSON 추출·검증·배포
├─ data/                추출 결과 (gitignored)
├─ docs/
├─ pnpm-workspace.yaml
└─ turbo.json
```

- 패키지 매니저: **pnpm workspaces**
- 태스크 러너: **Turborepo**
- 번들러: Next.js 내장 **Turbopack** (16부터 기본값)

> Turbopack과 Turborepo는 다른 도구다. 전자는 Next.js의 번들러, 후자는 모노레포 태스크 러너다. 둘 다 쓴다.

`packages/shared`에는 **타입만** 둔다. 추출 데이터는 절대 들어가지 않는다. "타입만"은 런타임 산출물이 없다는 뜻이다 — class-validator DTO 클래스는 `apps/api` 소유이고, shared의 interface를 `implements`해 계약 정합을 강제한다.

## 배포

Vercel 프로젝트 2개를 같은 레포에서 만든다. Root Directory로 구분한다.

| 프로젝트 | Root Directory | 비고 |
|---|---|---|
| `aws-study-web` | `apps/web` | |
| `aws-study-api` | `apps/api` | NestJS 제로 설정 감지 |

**NestJS는 Vercel 1급 지원 프레임워크다.** `src/main.ts`에 표준 `bootstrap()` + `app.listen()`만 있으면 자동 감지되고, Nest 앱 전체가 단일 Vercel Function이 되어 Fluid compute로 실행된다. 콜드스타트가 완화되고 CPU 사용분만 과금된다. `vercel dev`로 로컬 실행하며 CLI 48.4.0 이상이 필요하다.

### 프로젝트 간 URL 연결

`apps/web/vercel.json`에 API 프로젝트 ID를 등록한다.

```json
{ "relatedProjects": ["prj_<api-project-id>"] }
```

배포 시 `VERCEL_RELATED_PROJECTS` 환경변수로 API URL이 주입된다. **프리뷰 배포끼리도 짝이 맞게 연결**되므로 API URL을 하드코딩하거나 환경별로 관리할 필요가 없다. 조회에는 `@vercel/related-projects`를 쓴다.

**새 브랜치의 첫 푸시는 짝이 어긋난다.** web과 api가 같은 순간에 빌드되면 web이 읽는 `VERCEL_RELATED_PROJECTS`에 그 브랜치의 api 별칭이 아직 없어, api가 **직전에 프리뷰를 올린 다른 브랜치**의 별칭이 박힌다 (2026-08-27 실측: 새 브랜치 첫 배포에서 이전 브랜치의 api를 가리켰고, 같은 브랜치 2차 푸시에서 바로잡혔다). 응답 자체는 정상이라 화면으로는 구분되지 않는다 — **api를 함께 고친 브랜치라면 두 번째 푸시 이후의 프리뷰로 확인한다.** `GET /health`의 `version`이 커밋 sha라서 이 어긋남을 눈으로 잡을 수 있다.

**`VERCEL_RELATED_PROJECTS`는 `NEXT_PUBLIC_`이 아니다 — 클라이언트 번들에 들어가지 않는다.** 서버 컴포넌트에서 `withRelatedProject()`로 풀어 prop으로 내린다. 클라이언트 컴포넌트에서 부르면 배포에서도 조용히 `defaultHost`(로컬 폴백)로 떨어지고, 화면에는 네트워크 오류로만 보인다.

### 빌드 스킵

**Vercel 프로젝트 설정이 한다.** Settings → Build and Deployment → Root Directory의 **Skip deployment** 스위치이고, 모노레포로 Import하면 기본으로 켜진다. `vercel.json`에 넣는 것이 아니다 — `ignoreCommand`를 넣어도(`npx turbo-ignore`·`exit 1` 둘 다) 이 스킵을 되돌리지 못했다 (2026-08-27 실측, SJO-3). 그 키가 무엇을 하는지는 확인하지 않았다.

판정 근거는 커밋이 건드린 파일이 어느 패키지에 속하는가다. 그래서 아래가 지켜져야 한다.

- `pnpm-workspace.yaml`에 모든 패키지가 등록돼 있을 것
- 각 패키지의 `package.json` `name`이 유일할 것
- 패키지 간 의존이 `package.json`에 명시돼 있을 것 (`apps/web` → `packages/shared`)

`docs/`·`MEMORY.md` 같은 루트 파일은 어느 패키지 소유도 아니라 판정이 서지 않고, 두 프로젝트가 모두 빌드된다. 정상이다.

#### api는 스킵하지 않는다

**`aws-study-api`의 Skip deployment는 꺼 둔다.** 스킵과 「프로젝트 간 URL 연결」이 api 쪽에서 양립하지 않는다.

web 프리뷰는 api의 **브랜치 별칭**(`aws-study-api-git-<브랜치>-…`)을 부른다. 그 브랜치에서 api 빌드를 건너뛰면 별칭이 Vercel의 `Deployment was cancelled` 페이지를 가리키는데, 응답은 200이지만 JSON이 아니고 **`Access-Control-Allow-Origin`이 없어** 브라우저 fetch가 CORS로 막힌다. 화면에는 "api 호출 실패"로만 보인다 (2026-08-27 실측, SJO-3).

부르는 쪽(web)은 스킵돼도 아무도 그 브랜치 별칭에 의존하지 않으므로 켜 둔다. 불리는 쪽(api)은 브랜치마다 살아 있어야 한다 — api 빌드 20~30초가 그 대가다.

## 인증

```
브라우저 ─① Supabase Auth (Google OAuth) ─▶ JWT 획득
        ─② Authorization: Bearer <JWT> ────▶ NestJS
                                              │
                                           ③ JWKS로 서명 검증 (로컬, 네트워크 왕복 없음)
                                           ④ sub 클레임 → user_id
```

Supabase는 **비대칭 JWT 서명**(ES256 · ECC P-256)을 쓴다. Nest는 부팅 시 `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`에서 공개키를 받아 메모리에 캐시하고, 이후 요청마다 `kid`로 키를 골라 로컬 검증한다. 요청당 네트워크 왕복이 없고, 키 교체·폐기를 Nest 재배포 없이 할 수 있다.

브라우저가 Nest를 직접 호출한다. Next.js를 프록시로 두지 않는다. CORS를 한 번 설정하면 되고, 프록시 홉이 하나 줄어든다.

## 데이터베이스 연결

Vercel Functions는 서버리스이므로 **Supavisor 트랜잭션 모드(포트 6543)** 를 쓴다.

```
postgresql://postgres.<ref>:<pw>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
```

**트랜잭션 모드에서는 prepared statement를 끈다.** Drizzle 현행 문서가 Supabase 트랜잭션 풀 모드에 그렇게 지시한다.

다만 **「끄지 않으면 터진다」는 2026-09-04 실측에서 재현되지 않았다** (SJO-13). `prepare: true`로 300회를 태웠는데 한 건도 실패하지 않았다 — 커넥션 10개에 분산 60회, 클라이언트 커넥션 30개로 멀티플렉싱을 강제한 150회, 그 밖 90회. 백엔드가 보는 포트가 5432인 것으로 풀러를 지나는 것은 확인했다. Supavisor가 named prepared statement를 받는 것으로 보인다.

그래도 끈 채로 둔다. 현행 문서가 지시하고, 비용이 0이고, 로컬 프로브가 서버리스의 인스턴스 교체까지 재현했다고 보장할 수 없다. **파괴 사례를 확인해서가 아니라 확인하지 못해서 두는 것이다.**

**트랜잭션과 행 잠금은 트랜잭션 모드에서 그대로 쓴다.** 못 쓰는 것은 **세션 수준** 기능이다 — prepared statement · `SET` · `LISTEN/NOTIFY`(Supabase 「Choose a connection mode」). 행 잠금은 트랜잭션 수명이라 여기 들지 않는다.

2026-09-08 실측(SJO-53): 로컬에서 풀러 6543으로 커넥션 둘을 열어 ① 한쪽이 `select … for update`로 잡은 행은 다른 쪽의 `for update`를 **commit 전까지 막고** ② commit 뒤에는 통과하며 ③ 잠금 없는 `select`는 애초에 안 막힌다 — 3조건 3통과. ③이 음성 대조다: 그것이 없으면 「막혔다」가 그냥 느린 것과 구별되지 않는다. 실제 쓰임은 `docs/05` 「세션 채점」.

ORM은 **Drizzle**을 쓴다. 마이그레이션이 순수 SQL 파일이라 빌드 스텝이 늘지 않고, `postgres-js` 드라이버에 `prepare: false`를 주면 끝난다.

```ts
const client = postgres(process.env.DATABASE_URL!, { prepare: false })
```

## CDN

### 경로 레이아웃

```
s3://<bucket>/aws-saa/<prefix>/      ← 랜덤 프리픽스. 실제 값은 커밋하지 않는다
├─ manifest.json          Cache-Control: public, max-age=300
└─ v1/                    Cache-Control: public, max-age=31536000, immutable
   ├─ questions/
   │  ├─ index.json
   │  └─ chunk-001..011.json
   ├─ notes/
   │  ├─ oneliners.json
   │  └─ comparisons.json
   └─ anatomy/
      ├─ toc.json
      └─ pages/001..061.webp
```

### 버전 경로를 쓰는 이유

데이터를 고치면 `v2/`를 새로 올리고 `manifest.json`의 버전 문자열만 바꾼다.

- **CloudFront invalidation이 영영 필요 없다** — 파일 경로가 바뀌므로
- **롤백이 manifest 한 줄이다** — `v1`은 지우지 않고 그대로 둔다
- **덮어쓰기 사고를 이중으로 막는다** — publish가 같은 버전 재업로드를 기본 거부하고(`--force` 필요), S3 버저닝이 최후 안전망이다. **버저닝 확인은 첫 publish 전 필수다** (이 버킷은 이미 켜져 있었다 — `07-infrastructure.md` §3)

### CORS

**CloudFront에서 주입한다.** S3 버킷 CORS로 처리하면 CloudFront가 `Origin` 헤더를 오리진까지 전달해야 하고, 그러면 Origin별로 캐시가 파편화된다. CloudFront에서 직접 주입하면 캐시가 하나로 유지된다.

주입 수단은 **`viewer-response` CloudFront Function**이다. Response Headers Policy가 아닌 이유는 이 배포가 Free 요금제라 커스텀 정책을 거부하고 관리형 정책은 조건부로만 동작하기 때문이다 — 실측과 재현 절차는 `07-infrastructure.md` 「Response Headers Policy를 쓰지 않는 이유」.

허용 Origin은 **`*`**다. 목록으로 좁혀도 보호가 0이라서다 — 아래 문단이 그 근거이고, 프리뷰 도메인 문제도 함께 사라진다.

CORS는 브라우저의 교차출처만 막고 curl 직접 fetch는 못 막는다. 실질 방어선은 경로의 랜덤 프리픽스이며(`aws-saa/<prefix>/`), 실제 프리픽스 값은 레포·문서·이슈에 적지 않는다.

## 런타임 로깅과 에러 가시성

**Vercel 런타임 로그에 의존한다. 외부 수집기(Sentry 등)를 붙이지 않는다** (2026-09-08 결정, SJO-30).

### 의존한다는 것이 무엇을 뜻하는지부터 쟀다

Vercel 팀 `scent-jo`는 **`hobby`** 플랜이다 (2026-09-08 `list_teams` 실측). 그 플랜에서 **실제로 되짚을 수 있는 창**을 재면 이렇다.

| 요청한 창 | api (`aws-study-api`) | web (`aws-study-web`) |
|---|---|---|
| 30일 | 3건 | **0건** |
| 24시간 | 3건 | — |
| 3시간 | 3건 | — |

**30일을 달라고 해도 3시간 창과 같은 것을 준다.** 2026-09-07에 앱을 써서 `attempts` 14행이 남았고 그 요청이 전부 api를 지났는데, **30일 창에 그 요청이 하나도 없다.**

**음성 대조**: 3시간 창이 0이 아니라 3건이므로 도구가 죽어서 빈 것이 아니다. web의 0건도 같은 도구가 api에는 3건을 준 것과 대비된다 — 「아무것도 안 나온다」가 조회 실패와 구별된다.

그러니 **되짚을 수 있는 것은 사실상 「방금 전」뿐이다.** 다만 **Hobby의 공표된 보존 기간은 Vercel 문서 검색에서 찾지 못했고, 경계값(정확히 몇 시간인가)은 재지 않았다** — 위 표는 실제로 돌려받은 것이지 정책 인용이 아니다.

### 최소 규칙

1. **5xx를 만드는 자리는 원인을 로그로 남긴다.** 로그 없는 5xx는 응답 문구만 남고 원인이 사라진다
2. **4xx는 남기지 않는다. 예외는 인증 실패다** — 소유자 전용 앱이라 401·403은 「사용자 실수」가 아니라 「남이 두드렸다」에 가깝다
3. **로그에 넣지 않는 것: 토큰 · 이메일 · 문항 원문 · CDN URL.** 마지막은 이미 코드에 못박혀 있다 — `catalog.service.ts`의 `fetchJson`이 「URL을 메시지에 넣지 않는다 — 랜덤 프리픽스가 로그로 샌다」로 이 문서를 참조한다. 앞의 셋도 같은 등급이다: 레포가 public이고 로그는 대시보드에 남는다
4. **web은 런타임 로그를 남기지 않는다.** 화면의 오류 표현이 그 일을 한다 (`docs/02` 「API 오류의 화면 표현」)
5. **로그로 알림을 만들지 않는다.** 장애는 사용자가 먼저 안다 — 사용자가 1명이고 그 사람이 소유자라 성립한다

### Nest 기본 필터가 무엇을 찍고 무엇을 안 찍는지 (규칙 1의 전제)

`apps/api/src/main.ts`는 **전역 예외 필터를 등록하지 않는다**(`useGlobalFilters` 0건). 그래서 `BaseExceptionFilter`가 그대로 도는데, 그 원문이 **둘을 갈라 다룬다** (`@nestjs/core@11.2.3`의 `exceptions/base-exception-filter.js`, 2026-09-08 설치본 직접 대조).

- **`HttpException`이면 로그를 찍지 않는다** — 응답만 보내고 끝난다. `ServiceUnavailableException`·`ConflictException`이 여기 든다
- **`HttpException`이 아니면** 500으로 바꾸고 `Logger('ExceptionsHandler').error(exception)`으로 **스택을 찍는다** (`IntrinsicException`만 예외)

그러므로 **`throw new Error(...)`는 로그가 저절로 남고, `throw new ServiceUnavailableException(...)`은 안 남는다.** 규칙 1이 실제로 걸리는 자리는 후자다.

### 준수 현황 — 명시적 5xx **3곳 중 1곳**만 원인을 남긴다

2026-09-08 전수. `apps/api/src`의 `throw new` **29곳**(스펙 제외)을 전부 훑어 5xx로 나가는 것만 골랐다.

| 자리 | 로그 | |
|---|---|---|
| `auth/supabase-jwt.guard.ts:127` `ServiceUnavailableException` | 바로 위에서 `logger.error('JWKS 검증 경로 실패: …')` | ✅ |
| `catalog/catalog.service.ts:101` `ServiceUnavailableException` | **없다** — `catch (error)`의 `error`를 그대로 버린다 | ❌ |
| `catalog/catalog.service.ts:111` `ServiceUnavailableException` | **없다** | ❌ |

**catalog가 첫 요청에서 CDN에 못 닿으면 503이 나가는데 무엇이 왜 실패했는지가 어디에도 안 남는다.** 캐시가 있을 때의 재확인 실패는 같은 파일 103행이 `logger.warn`으로 남기면서 **캐시가 없을 때의 실패만 조용하다** — 더 심각한 쪽이 더 조용하다.

**이 이슈에서 고치지 않는다.** SJO-30은 결정 이슈이고 코드를 건드리지 않는다 — 공백으로 기록하고 아래 「알려진 리스크」에 올린다.

### 잃는 것

- **알림이 없다.** 프로덕션이 죽으면 사용자가 화면에서 먼저 안다
- **어제 난 장애는 되짚을 수 없다.** 위 표대로 30일 창이 3시간 창과 같다. 조사하려면 **그 자리에서** 로그를 봐야 한다
- 규칙 1의 공백 2곳이 남아 있는 동안, catalog 503은 **되짚을 원인 자체가 없다**

### 다시 여는 조건

사용자가 둘 이상이 되거나, **「어제 뭐가 났나」를 물어야 하는 장애가 한 번이라도 생기면** 이 결정을 다시 연다.

## 저장소 정책

레포가 **public**이고 원본 자료는 제3자 저작물이다. 따라서

- 원본 PDF, 추출 JSON, 해부서 판독 결과 중 **어느 것도 git에 커밋하지 않는다**
- `data/`는 `.gitignore`에 있다
- **CDN이 추출 데이터의 유일한 원본이다**
- 새 기기에서는 `pnpm data:pull`로 CDN에서 내려받는다
- 원본 PDF는 로컬 및 소유자의 별도 보관처에만 둔다

git에 들어가는 것은 코드, 문서, 그리고 데이터를 재생성하는 **스크립트**다.

## 알려진 리스크

| 리스크 | 대응 |
|---|---|
| 모노레포 `apps/api`에서 NestJS 제로 설정 감지가 실제로 붙는지 문서만으로 확신 불가 | **기능 개발 전에 빈 Next + 빈 Nest로 배포부터 검증한다.** 실패 시 `vercel.json`에 빌드 커맨드 명시로 우회 |
| 트랜잭션 모드에서 prepared statement 사용 시 런타임 오류 | Drizzle 초기화에 `prepare: false` 강제. 코드 리뷰 체크리스트 항목. **리스크의 크기는 미확인이다** — 2026-09-04 실측 300회에서 재현되지 않았다 (SJO-13, 위 「데이터베이스 연결」) |
| **Vercel Fluid 런타임이 `require(esm)`를 지원하지 않는다** — CommonJS로 컴파일한 `apps/api`가 ESM 전용 패키지를 값으로 import하면 `ERR_REQUIRE_ESM`으로 **부팅에서 죽는다.** 로컬 Node 24는 이것을 허용하므로 **평범한 `node dist/main.js`로는 재현되지 않는다** (2026-09-04 실측: 같은 24.x인데 로컬은 `/health` 200, 프로덕션은 500) | `pnpm --filter @aws-study/api build`가 `--no-experimental-require-module`로 산출물을 띄워 본다 (`docs/06` 「빌드 산출물을 실제로 띄워 본다」). 런타임 의존성을 추가·승급할 때 이 게이트를 통과시킨다 |
| **web의 프리렌더가 api 장애에 끌려 죽는다** — 정적 프리렌더에서는 `useSuspenseQuery`가 **빌드 중에** api를 부르고 그 거절이 export를 깬다. api 500 하나가 **두 프로젝트의 배포를 동시에** 막았다 (SJO-49). `prefetchQuery`를 `await`하거나 서버 prefetch를 지우는 것으로는 막지 못한다 | **api를 읽는 화면은 `dynamic = 'force-dynamic'`으로 둔다.** 빌드가 api를 부르지 않으므로 결합이 사라지고, 화면은 `docs/02` 「API 오류의 화면 표현」의 5xx 경로를 그대로 쓴다 (`.claude/rules/web-state.md`). **검증은 빠른 로컬 스텁으로 한다** — 느린 원격 5xx는 정적 셸이 확정된 뒤에 거절이 도착해 우연히 통과한다 |
| **코드가 필수로 만든 환경변수를 Vercel에 넣지 않으면 배포만 죽는다** — 로컬 게이트가 전부 초록이다. `typecheck`·`test`는 환경을 안 보고, 빌드 스모크는 `smoke.mjs`가 값을 **자체 주입**하도록 일부러 만들어 놓아 기기별 판정 차이를 없앤 대신 이 종류를 못 잡는다. SJO-12가 세 키를 필수로 만들고 등록하지 않아 프로덕션이 500으로 남았다 (2026-09-06 확인, SJO-50) | **`env.ts` 필수 목록에 키를 추가하는 이슈가 같은 이슈에서 Vercel 3환경 등록까지 한다** (`docs/06` 「필수 키를 추가하는 이슈가 Vercel 등록까지 한다」). 등록 후 **재배포**해야 반영된다 — 환경변수는 배포 시점에 묶인다 |
| **잠긴 세션 행을 기다리는 요청이 풀 커넥션을 문다** — SJO-53이 「잠그지 않는 조회」를 「왕복 세 번 동안 유지되는 `for update`」로 바꿨다. postgres-js 기본 `max`는 10이고 대기하는 트랜잭션은 대기 내내 커넥션을 쥔다. 죽은 트랜잭션 하나가 후속 요청을 매달 수 있고 `vercel.json`에 `maxDuration`도 없다. **하네스에서 실제로 관측한 양식이다** (`exam-race.spec.ts` 헤더 — 죽인 실행이 남긴 잠금에 다음 실행이 매달렸다) | **아직 대응하지 않았다.** `lock_timeout`을 걸면 매달림이 빠른 5xx가 되지만, 값을 정할 근거(정상 잠금 유지 시간)를 재지 않았다. 사용자 1명·기기 2대라 동시 요청이 둘을 넘지 않으므로 지금은 크기가 작다 — **재지 않아서 두는 것이지 안전을 확인해서가 아니다** (2026-09-08 리뷰 지적, SJO-53) |
| **catalog가 캐시 없이 CDN에 못 닿으면 503의 원인이 아무 데도 안 남는다** — `catalog.service.ts:101`·`111`이 `ServiceUnavailableException`을 로그 없이 던지고, Nest 기본 필터는 `HttpException`을 안 찍는다 (2026-09-08 원문 대조, 위 「런타임 로깅과 에러 가시성」). 같은 파일 103행은 **덜 심각한** 재확인 실패를 `warn`으로 남긴다 | **아직 대응하지 않았다.** 위 절이 규칙 1로 못박았고 공백으로 기록만 했다 — SJO-30은 결정 이슈라 코드를 안 고친다. 고치는 값은 그 두 줄에 `logger.error`를 붙이는 것이고, Vercel 로그가 「방금 전」만 준다는 점 때문에 **로그가 없으면 그 자리에서도 못 본다** |
| 자동 태깅 오분류 | 카테고리와 함께 `services` 원본을 인덱스에 보존. 분포 검증으로 사전 오류 탐지 |
| `anatomy/toc.json` 유실 | 버전 경로 + S3 버저닝. **손으로 쓴 유일한 산출물이라 재현 불가**다 (`01-requirements.md` 「데이터 보존」). 쪽 이미지는 `data:anatomy`가 다시 만든다 |

## 참고

- [NestJS on Vercel](https://vercel.com/docs/frameworks/backend/nestjs)
- [Vercel Monorepos](https://vercel.com/docs/monorepos)
- [Supabase JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys)
- [Supabase Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
