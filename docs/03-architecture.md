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

`packages/shared`에는 **타입만** 둔다. 추출 데이터는 절대 들어가지 않는다.

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

### 빌드 스킵

pnpm workspaces 규약을 지키면 Vercel이 변경되지 않은 앱의 빌드를 자동으로 건너뛴다. 조건은 다음과 같다.

- `pnpm-workspace.yaml`에 모든 패키지가 등록돼 있을 것
- 각 패키지의 `package.json` `name`이 유일할 것
- 패키지 간 의존이 `package.json`에 명시돼 있을 것 (`apps/web` → `packages/shared`)

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
s3://<bucket>/aws-saa/
├─ manifest.json          Cache-Control: public, max-age=300
└─ v1/                    Cache-Control: public, max-age=31536000, immutable
   ├─ questions/
   │  ├─ index.json
   │  └─ chunk-001..011.json
   ├─ notes/
   │  ├─ oneliners.json
   │  └─ comparisons.json
   └─ anatomy/
      ├─ part1-patterns.json
      ├─ part2-services.json
      └─ part3-method.json
```

### 버전 경로를 쓰는 이유

데이터를 고치면 `v2/`를 새로 올리고 `manifest.json`의 버전 문자열만 바꾼다.

- **CloudFront invalidation이 영영 필요 없다** — 파일 경로가 바뀌므로
- **롤백이 manifest 한 줄이다** — `v1`은 지우지 않고 그대로 둔다
- **덮어쓰기 사고가 구조적으로 불가능하다** — 추출 데이터가 git에 없으므로 이 방어가 특히 중요하다

추가로 S3 버킷 버저닝을 활성화해 이중 안전망을 둔다.

### CORS

**CloudFront Response Headers Policy**로 주입한다. S3 버킷 CORS로 처리하면 CloudFront가 `Origin` 헤더를 오리진까지 전달해야 하고, 그러면 Origin별로 캐시가 파편화된다. CloudFront에서 직접 주입하면 캐시가 하나로 유지된다.

허용 Origin: 프로덕션 도메인 + Vercel 프리뷰 도메인 패턴 + `localhost`.

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
| Next.js 16.3 critical 취약점 보안 릴리스가 2026-08-26 예정 | 릴리스 직후 즉시 업그레이드 |
| 트랜잭션 모드에서 prepared statement 사용 시 런타임 오류 | Drizzle 초기화에 `prepare: false` 강제. 코드 리뷰 체크리스트 항목 |
| 자동 태깅 오분류 | 카테고리와 함께 `services` 원본을 인덱스에 보존. 분포 검증으로 사전 오류 탐지 |
| 해부서 판독 결과 유실 | 버전 경로 + S3 버저닝. 판독 결과는 재현 불가 |

## 참고

- [NestJS on Vercel](https://vercel.com/docs/frameworks/backend/nestjs)
- [Vercel Monorepos](https://vercel.com/docs/monorepos)
- [Supabase JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys)
- [Supabase Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
