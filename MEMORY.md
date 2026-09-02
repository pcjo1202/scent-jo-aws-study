# 현재 상태

git이 알 수 없는 외부 상태의 **현재값**만 적는다. 할 일은 `TASKS.md`, 왜 그렇게 정했는지는 `docs/`.

바꿨으면 그 자리에서 덮어쓴다. 이력은 남기지 않는다 (데이터 변경 이력만 `docs/data-changelog.md`).

_최종 갱신: 2026-09-03_

## 인프라

| 항목 | 상태 |
|---|---|
| Vercel `aws-study-web` | **생성됨** · Root `apps/web` · Next.js · `icn1` · SSO 보호 꺼짐 · Skip deployment 켜짐(기본) · `prj_mFYDO5Dgom098rYuHH4fUWK9Fp0d` |
| Vercel `aws-study-api` | **생성됨** · Root `apps/api` · **NestJS 자동 감지** · `icn1` · SSO 보호 꺼짐 · **Skip deployment 꺼짐** · `prj_uVsyAepv8G2t0QwrqN7DcANjYXJu` |
| Related Projects 연결 | **설정됨** — `apps/web/vercel.json`. 프리뷰끼리 짝이 맞는 것 확인 |
| Supabase 프로젝트 | **생성됨** · ref `xeaucvsadpmaeuxpfokq` · `ap-northeast-2` |
| Supabase JWT 비대칭 서명 전환 | **적용됨** · JWKS `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` 200 · `alg=ES256`(EC P-256) · `kid=c1836c43-1d7a-4131-8008-29a156bee9e1`. **`/auth/v1/jwks`는 JWKS 엔드포인트가 아니다** — apikey를 요구해 401 (SJO-41) |
| Supabase Data API(PostgREST) | **꺼져 있음** — 2026-09-03 사람이 콘솔에서 확인. 이전에 본 `rest/v1/`의 503(PGRST002)은 테이블이 0개라서 나온 것이라 판정 근거가 아니었고, 콘솔 확인으로 대체했다. **SJO-13이 테이블을 만든 뒤 한 번 더 본다** — 테이블이 생기면 503의 의미가 달라지므로 그때는 실측으로도 판정할 수 있다 (`docs/07` §1) |
| Supabase Email 프로바이더 | **열려 있음** (`email: true` · `disable_signup: false`). Google만 쓰므로 끈다 — 콘솔 작업 |
| Google OAuth 클라이언트 | **등록됨** · `authorize` 302 → `accounts.google.com` · `redirect_uri`는 Supabase 콜백 |
| S3 버킷 (`static-cdn.scent-jo.dev`) | **기존 보유** · ap-northeast-2 + CloudFront |
| S3 버저닝 | **미확인** |
| CloudFront CORS Response Headers Policy | **미설정** (확인 완료) |
| Vercel 스코프 | `smelljo`. 프리뷰 URL이 `aws-study-<해시>-smelljo.vercel.app` — 프로젝트명이 아니다 |
| 프로덕션 도메인 (web) | `saa.scent-jo.dev`. DNS는 **Cloudflare**(`*.scent-jo.dev` 와일드카드 프록시) — Vercel 네임서버 아님 |
| 프로덕션 도메인 (api) | 없음. `aws-study-api.vercel.app` 그대로 — Bearer JWT라 커스텀 도메인이 필요 없다 |
| api `CORS_ALLOWED_ORIGINS` | production `https://saa.scent-jo.dev,https://aws-study-web.vercel.app` · preview `https://aws-study-*-smelljo.vercel.app` |
| Linear ↔ GitHub 연동 | **켜짐** (확인 완료 — PR #1이 SJO-31에 자동 첨부) |
| GitHub 레포 | `pcjo1202/scent-jo-aws-study` · **public**. PR 생성은 `pcjo1202` 계정 토큰이 필요하다 (gh 기본 활성 계정은 collaborator가 아니라 `must be a collaborator`로 거부된다) |

## 데이터

| 항목 | 상태 |
|---|---|
| CDN 배포 버전 | 없음 |
| 로컬 `data/` | `chunks/chunk-001..011.json` 1019문항(태그 포함, 56~272KB/파일) · `index.json` 1019행 141KB · `oneliners.json` 203개 · `comparisons.json` 48쌍 · `manifest.json` 26파일. `data:extract` 산출물. **통합본 `questions.json`은 없앴다** (2026-08-31, SJO-7) |
| 로컬 `tests/fixtures/` | 골든 픽스처 6문항 (`1`·`2`·`44`·`242`·`451`·`494`). 이 기기에서 원문을 읽고 다시 작성했다 (2026-08-28, SJO-6) — 다른 PC의 사본과 별개다. gitignored이므로 새 기기는 `data:pull`(SJO-8)로만 복구된다 |
| 원본 PDF 위치 | `~/Downloads/AWS-SAA` (로컬만). `scripts/.env`의 `SOURCE_PDF_DIR`이 가리킨다. 파일명은 **번호 접두사**가 있어야 한다 (`4. aws-saa-c03-q001-500.pdf`) — `findSourcePdf`가 그 번호로 고른다 |
| `pdftotext` (poppler) | **설치됨** 26.08.0 (`brew install poppler`). 없으면 `data:extract`가 ENOENT로 죽는다 |
| 해부서 판독 진행 | **0 / 61쪽** — PART 1·2·3 전부 미판독 |

## 데이터베이스

| 항목 | 상태 |
|---|---|
| 적용된 마이그레이션 | 없음 |

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
