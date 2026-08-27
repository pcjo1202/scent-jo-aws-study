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

Supabase는 **비대칭 JWT 서명**을 쓴다. Nest는 부팅 시 `https://<ref>.supabase.co/auth/v1/jwks`에서 공개키를 받아 메모리에 캐시하고, 이후 요청마다 `kid`로 키를 골라 로컬 검증한다. 요청당 네트워크 왕복이 없고, 키 교체·폐기를 Nest 재배포 없이 할 수 있다.

브라우저가 Nest를 직접 호출한다. Next.js를 프록시로 두지 않는다. CORS를 한 번 설정하면 되고, 프록시 홉이 하나 줄어든다.

## 데이터베이스 연결

Vercel Functions는 서버리스이므로 **Supavisor 트랜잭션 모드(포트 6543)** 를 쓴다.

```
postgres://postgres.<ref>:<pw>@aws-ap-northeast-2.pooler.supabase.com:6543/postgres
```

**트랜잭션 모드는 prepared statement를 지원하지 않는다.** ORM에서 반드시 꺼야 한다.

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
- **덮어쓰기 사고를 이중으로 막는다** — publish가 같은 버전 재업로드를 기본 거부하고(`--force` 필요), S3 버저닝이 최후 안전망이다. **버저닝 활성화는 첫 publish 전 필수다**

추가로 S3 버킷 버저닝을 활성화해 이중 안전망을 둔다.

### CORS

**CloudFront Response Headers Policy**로 주입한다. S3 버킷 CORS로 처리하면 CloudFront가 `Origin` 헤더를 오리진까지 전달해야 하고, 그러면 Origin별로 캐시가 파편화된다. CloudFront에서 직접 주입하면 캐시가 하나로 유지된다.

허용 Origin: 프로덕션 도메인 + `localhost`. 프리뷰 대응은 `07-infrastructure.md`의 (a)안을 따른다 (CloudFront는 와일드카드 Origin을 직접 지원하지 않는다).

CORS는 브라우저의 교차출처만 막고 curl 직접 fetch는 못 막는다. 실질 방어선은 경로의 랜덤 프리픽스이며(`aws-saa/<prefix>/`), 실제 프리픽스 값은 레포·문서·이슈에 적지 않는다.

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
| 트랜잭션 모드에서 prepared statement 사용 시 런타임 오류 | Drizzle 초기화에 `prepare: false` 강제. 코드 리뷰 체크리스트 항목 |
| 자동 태깅 오분류 | 카테고리와 함께 `services` 원본을 인덱스에 보존. 분포 검증으로 사전 오류 탐지 |
| 해부서 판독 결과 유실 | 버전 경로 + S3 버저닝. 판독 결과는 재현 불가 |

## 참고

- [NestJS on Vercel](https://vercel.com/docs/frameworks/backend/nestjs)
- [Vercel Monorepos](https://vercel.com/docs/monorepos)
- [Supabase JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys)
- [Supabase Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
