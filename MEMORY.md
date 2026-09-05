# 현재 상태

git이 알 수 없는 외부 상태의 **현재값**만 적는다. 할 일은 `TASKS.md`, 왜 그렇게 정했는지는 `docs/`.

바꿨으면 그 자리에서 덮어쓴다. 이력은 남기지 않는다 (데이터 변경 이력만 `docs/data-changelog.md`).

_최종 갱신: 2026-09-06_

## 인프라

| 항목 | 상태 |
|---|---|
| Vercel `aws-study-web` | **생성됨** · Root `apps/web` · Next.js · `icn1` · SSO 보호 꺼짐 · Skip deployment 켜짐(기본) · `prj_mFYDO5Dgom098rYuHH4fUWK9Fp0d` |
| Vercel `aws-study-api` | **생성됨** · Root `apps/api` · **NestJS 자동 감지** · `icn1` · SSO 보호 꺼짐 · **Skip deployment 꺼짐** · `prj_uVsyAepv8G2t0QwrqN7DcANjYXJu` |
| Related Projects 연결 | **설정됨** — `apps/web/vercel.json`. 프리뷰끼리 짝이 맞는 것 확인 |
| Supabase 프로젝트 | **생성됨** · ref `xeaucvsadpmaeuxpfokq` · `ap-northeast-2` |
| Supabase JWT 비대칭 서명 전환 | **적용됨** · JWKS `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` 200 · `alg=ES256`(EC P-256) · `kid=c1836c43-1d7a-4131-8008-29a156bee9e1`. **`/auth/v1/jwks`는 JWKS 엔드포인트가 아니다** — apikey를 요구해 401 (SJO-41) |
| Supabase Data API(PostgREST) | **꺼져 있음** — 2026-09-04 **실측 확정**(SJO-13). 테이블 3개를 만든 뒤 `exam_sessions`·`attempts`·`study_progress` × publishable·legacy anon 키로 읽기 6건, 쓰기 1건을 쟀고 전부 503(PGRST002)이다. 테이블 0개일 때의 503은 판정 근거가 아니었으나 이제는 갈린다 (`docs/07` §1) |
| Supabase Email 프로바이더 | **열려 있음** (`email: true` · `disable_signup: false`). Google만 쓰므로 끈다 — 콘솔 작업 |
| Google OAuth 클라이언트 | **등록됨** · `authorize` 302 → `accounts.google.com` · `redirect_uri`는 Supabase 콜백 |
| S3 오리진 버킷 | `scent-jo-image-s3-bucket-<account-id>-ap-northeast-2-an` · ap-northeast-2 · OAC 전용(공개 읽기 없음). **실명은 `scripts/.env`의 `S3_BUCKET`에만 둔다** — 이름에 AWS 계정 ID가 들어 있고 이 레포는 public이다. **`static-cdn.scent-jo.dev`는 버킷이 아니라 CloudFront 별칭이다** — 버킷 이름으로 쓰면 `NoSuchBucket` (2026-09-04 실측, SJO-8) |
| CloudFront 배포 | `E2PL85DAAAZTSA` · 별칭 `static-cdn.scent-jo.dev` · OAC `E2L0VPS4ANJ89L` · **Free 요금제** — 커스텀 Response Headers Policy를 거부한다 |
| S3 버저닝 | **Enabled** (2026-09-04 확인 — 이미 켜져 있었다) |
| CloudFront CORS | **`viewer-response` 함수 `aws-saa-cors`** (LIVE) 가 `aws-saa/*` behavior에서 `Access-Control-Allow-Origin: *`를 조건 없이 붙인다. Response Headers Policy는 **쓰지 않는다** — Free 요금제라 커스텀은 거부되고 관리형(`Managed-SimpleCORS`)은 요청에 모르는 헤더가 하나만 붙어도 헤더를 빠뜨린다 (2026-09-04 실측, SJO-8). 크롬은 항상 그런 헤더를 붙이므로 **curl로만 검증하면 통과로 보인다** |
| Vercel 스코프 | `smelljo`. 프리뷰 URL이 `aws-study-<해시>-smelljo.vercel.app` — 프로젝트명이 아니다 |
| 프로덕션 도메인 (web) | `saa.scent-jo.dev`. DNS는 **Cloudflare**(`*.scent-jo.dev` 와일드카드 프록시) — Vercel 네임서버 아님 |
| 프로덕션 도메인 (api) | 없음. `aws-study-api.vercel.app` 그대로 — Bearer JWT라 커스텀 도메인이 필요 없다 |
| api `CORS_ALLOWED_ORIGINS` | production `https://saa.scent-jo.dev,https://aws-study-web.vercel.app` · preview `https://aws-study-*-smelljo.vercel.app` |
| 업로드 IAM 사용자 | `aws-saa-data-publisher` · 인라인 정책 `aws-saa-publish` — `aws-saa/*`의 Get/Put + `s3:prefix` 조건부 ListBucket. **`s3:DeleteObject` 없음.** 키는 `scripts/.env`에만 있다 (`docs/07` §3) |
| api `DATABASE_URL` | **production·preview·development 세 환경 등록됨** (Sensitive). 2026-09-04, SJO-13 |
| api 인증 환경변수 | **`SUPABASE_JWKS_URL`·`SUPABASE_JWT_ISSUER`·`ALLOWED_EMAIL`이 세 환경 어디에도 없다** — `env.ts`가 필수로 요구하므로 부팅이 안 된다. SJO-50 |
| 프로덕션 api 상태 | **500 (`FUNCTION_INVOCATION_FAILED`) — 남은 원인은 환경변수 하나뿐이다.** `ERR_REQUIRE_ESM`은 해소됐다 (SJO-49 / PR #29 머지, `@nestjs/config` 12.0.0→4.0.4). 부팅이 모듈 로딩을 통과해 `ConfigModule.forRoot`까지 들어간 뒤 **`validateEnv`가 `SUPABASE_JWKS_URL`·`SUPABASE_JWT_ISSUER`·`ALLOWED_EMAIL` 누락으로 던진다** — **SJO-50이 그 셋을 넣으면 200이 된다** |
| 프로덕션 web 빌드 | **회복됨** (SJO-49 / PR #29). `bcb3164`부터 전부 ERROR였고 원인은 **api 장애가 아니라 `/`가 정적 프리렌더였던 것**이다 — 프리렌더에서 `useSuspenseQuery`가 빌드 중에 api를 부르고 그 거절이 export를 죽였다. `app/page.tsx`의 `force-dynamic`으로 끊었고, **api가 500인 채로 web이 200을 준다**(프리뷰 실측) |
| Supabase↔Vercel 통합 | **리소스는 남아 있다** — Marketplace store `supabase-scent-jo-aws-study` (`store_7q0XZjyOQqsMm1i6`), api 프로젝트에 연결. 우리 프로젝트 `xeaucvsadpmaeuxpfokq`를 가리킨다(Vercel이 새로 만든 것이 아니다). **리소스 제거는 안 했다** — CLI로는 그것이 Supabase 프로젝트까지 지우는지 확인할 방법이 없다. 대시보드 확인 다이얼로그로만 판단 가능 |
| 통합이 넣었던 변수 16개 | **2026-09-04 전부 삭제** (SJO-13). `POSTGRES_*` 7 · `SUPABASE_URL`·`SUPABASE_ANON_KEY`·`SUPABASE_SERVICE_ROLE_KEY`·`SUPABASE_SECRET_KEY`·`SUPABASE_PUBLISHABLE_KEY`·`SUPABASE_JWT_SECRET` 6 · `NEXT_PUBLIC_SUPABASE_*` 3. **`docs/06` 「전체 목록」이 api에 주는 변수가 아니고**, 코드가 **16개 중 0개**를 참조했다(위생 검사 5/5 검출). `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`는 목록에 있지만 **web의 변수다** — api 프로젝트에 있을 이유가 없어서 지웠고, web에는 SJO-19가 따로 넣는다(아래 줄). **통합이 연결된 채라 재동기화로 되살아날 수 있다** |
| api 환경변수 현재값 | production `CORS_ALLOWED_ORIGINS`·`DATABASE_URL` · preview 같음 · development `DATABASE_URL`만 |
| web 환경변수 현재값 | **`NEXT_PUBLIC_API_URL` 하나뿐** (production·preview). `docs/06`이 web에 요구하는 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`·`NEXT_PUBLIC_DATA_BASE_URL` **셋이 없다.** 읽는 코드가 아직 없어 지금은 안 깨진다 — SJO-19가 인증·데이터 클라이언트를 넣을 때 셋 다 필요하다. **`NEXT_PUBLIC_DATA_BASE_URL`의 값은 이미 있다** (SJO-8이 v1을 올렸다 — `scripts/.env`의 `DATA_CDN_BASE`) |
| Linear ↔ GitHub 연동 | **켜짐** (확인 완료 — PR #1이 SJO-31에 자동 첨부) |
| GitHub 레포 | `pcjo1202/scent-jo-aws-study` · **public**. PR 생성은 `pcjo1202` 계정 토큰이 필요하다 (gh 기본 활성 계정은 collaborator가 아니라 `must be a collaborator`로 거부된다) |

## 데이터

| 항목 | 상태 |
|---|---|
| CDN 배포 버전 | **v1** (2026-09-04, SJO-8) · 27객체 = 데이터 26 + `manifest.json`. 경로는 `aws-saa/<프리픽스>/` — 실제 값은 `scripts/.env`의 `DATA_CDN_BASE`에만 있다 |
| 로컬 `data/` | `chunks/chunk-001..011.json` 1019문항(태그 포함, 56~272KB/파일) · `index.json` 1019행 141KB · `oneliners.json` 203개 · `comparisons.json` 48쌍 · `manifest.json` 26파일. `data:extract` 산출물. **통합본 `questions.json`은 없앴다** (2026-08-31, SJO-7) |
| 로컬 `tests/fixtures/` | 골든 픽스처 6문항 (`1`·`2`·`44`·`242`·`451`·`494`). 이 기기에서 원문을 읽고 다시 작성했다 (2026-08-28, SJO-6) — 다른 PC의 사본과 별개다. gitignored이므로 새 기기는 `data:pull`(SJO-8)로만 복구된다 |
| 원본 PDF 위치 | `~/Downloads/AWS-SAA` (로컬만). `scripts/.env`의 `SOURCE_PDF_DIR`이 가리킨다. 파일명은 **번호 접두사**가 있어야 한다 (`4. aws-saa-c03-q001-500.pdf`) — `findSourcePdf`가 그 번호로 고른다 |
| `pdftotext` (poppler) | **설치됨** 26.08.0 (`brew install poppler`). 없으면 `data:extract`가 ENOENT로 죽는다 |
| 해부서 판독 진행 | **0 / 61쪽** — PART 1·2·3 전부 미판독 |

## 데이터베이스

| 항목 | 상태 |
|---|---|
| 적용된 마이그레이션 | `20260903171754_0000_init` (2026-09-04 적용) — `exam_sessions`·`attempts`·`study_progress`. 원본은 `apps/api/src/db/migrations/0000_init.sql` |
| 테이블 상태 | 3개 · check 제약 9 · FK 1 · 명명 인덱스 4 · **행 0**. RLS 셋 다 꺼짐, 정책 0개 (설계 원칙 4) |
| 제약 우회 프로브 | 2026-09-04 — 위반 11/11 거부(23514 · 23505 · 23503), 정상 5/5 통과 (SJO-13 증거 코멘트) |
| 풀러 호스트 | `aws-0-ap-northeast-2.pooler.supabase.com:6543`. **`aws-0-` 샤드 접두사가 있다** — docs/03·07의 예시에 빠져 있었다 (2026-09-04 정정) |

## 확인된 사실

원본 자료를 실제로 분석해 확인한 값들. 추정이 아니다.

- 문항 **1019개**, `Q.001`~`Q.1019` 연속. 누락·중복 없음
- 정답 개수 분포: **1개 896 / 2개 109 / 3개 14**
- 선택지 개수 분포: **4개 896 / 5개 109 / 6개 14**. 선택지 키는 `A`~`F`, 정답에 `F`가 포함된 문항 8개
- 한줄노트 **203개** (고유 서비스명 202 — 한 서비스가 카테고리 둘에 실린다). 카테고리 분포 네트워크 35 · 보안 34 · 스토리지 33 · 데이터베이스 24 · 컴퓨트 22 · 메시징 14 · 모니터링 11 · 분석 9 · 운영 8 · AI/ML 7 · 마이그레이션 6
- 비교노트 **48쌍**, 구성원 145명. ★ 중요도 3:36 / 2:10 / 1:2 — **파일 2에만 있는 표기다**
- 문제은행 순수 텍스트 2.7MB (gzip 0.66MB), 문항당 평균 3.2KB
- 파일 2(PC판)와 파일 3(모바일판)은 **같은 내용**. 문항 파싱은 파일 3을 쓰고, **노트는 두 판본을 합친다** — 줄을 접는 자리가 달라 이음매 공백이 복원된다 (미결 0곳)
- 파일 1(해부서)은 Canva 내보내기라 **텍스트 추출 불가** (CID 폰트 유니코드 매핑 손상). 이미지 렌더링 후 수동 판독만 가능
- 문제은행에 **주제 태그 없음**. 서비스명 사전으로 파생시켰다 (SJO-6)
- 자동 태깅 실측: 별칭 353개 · 사전 서비스 210개(노트 202 + 루트 보완 8). **미태깅 6문항(0.6%)** — MFA·SAML·STS처럼 노트에 없는 개념만 언급하는 문항이라 사전으로는 닿지 않는다. 루트 별칭을 빼면 미태깅 63(6.2%) · 스토리지 355→151
- 태깅 카테고리 분포: 컴퓨트 416(40.8%) · 스토리지 355(34.8%) · 데이터베이스 242(23.7%) · 네트워크 232(22.8%) · 보안 185(18.2%) · 메시징 113(11.1%) · 모니터링 47(4.6%) · 분석 36(3.5%) · 운영 18(1.8%) · 마이그레이션 12(1.2%) · AI/ML 9(0.9%). 문항당 카테고리 1개 514 · 2개 346 · 3개 153 · 0개 6
