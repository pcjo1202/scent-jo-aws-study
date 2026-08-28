# 현재 상태

git이 알 수 없는 외부 상태의 **현재값**만 적는다. 할 일은 `TASKS.md`, 왜 그렇게 정했는지는 `docs/`.

바꿨으면 그 자리에서 덮어쓴다. 이력은 남기지 않는다 (데이터 변경 이력만 `docs/data-changelog.md`).

_최종 갱신: 2026-08-28_

## 인프라

| 항목 | 상태 |
|---|---|
| Vercel `aws-study-web` | **생성됨** · Root `apps/web` · Next.js · `icn1` · SSO 보호 꺼짐 · Skip deployment 켜짐(기본) · `prj_mFYDO5Dgom098rYuHH4fUWK9Fp0d` |
| Vercel `aws-study-api` | **생성됨** · Root `apps/api` · **NestJS 자동 감지** · `icn1` · SSO 보호 꺼짐 · **Skip deployment 꺼짐** · `prj_uVsyAepv8G2t0QwrqN7DcANjYXJu` |
| Related Projects 연결 | **설정됨** — `apps/web/vercel.json`. 프리뷰끼리 짝이 맞는 것 확인 |
| Supabase 프로젝트 | 미생성 |
| Supabase JWT 비대칭 서명 전환 | 미적용 |
| Google OAuth 클라이언트 | 미등록 |
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
| 로컬 `data/` | `questions.json` 1019문항 (3.0MB). `data:extract` 산출물 |
| 원본 PDF 위치 | `~/Downloads/AWS_SAA` (로컬만). `scripts/.env`의 `SOURCE_PDF_DIR`이 가리킨다 |
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
- 한줄노트 **186개**, 비교노트 **48쌍**
- 문제은행 순수 텍스트 2.7MB (gzip 0.66MB), 문항당 평균 3.2KB
- 파일 2(PC판)와 파일 3(모바일판)은 **같은 내용**. 파싱은 파일 3을 쓴다
- 파일 1(해부서)은 Canva 내보내기라 **텍스트 추출 불가** (CID 폰트 유니코드 매핑 손상). 이미지 렌더링 후 수동 판독만 가능
- 문제은행에 **주제 태그 없음**. 서비스명 사전으로 파생시켜야 함
