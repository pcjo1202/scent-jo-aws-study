# 07. 인프라 셋업 런북

콘솔에서 손으로 한 번 하고 잊어버리는 작업들이다. 6개월 뒤에 왜 이렇게 됐는지 기억하지 못한다.

> **이 문서는 실제로 설정하면서 채운다.** 지금은 뼈대와 결정 사항이고, 콘솔에서 확인한 실제 값(정책 JSON, 정책 ID, ARN)을 그 자리에서 덧붙인다.
> 작업을 마칠 때마다 `MEMORY.md`의 인프라 표를 갱신한다.

## 순서

의존 관계가 있어 순서를 지켜야 한다.

```
1. Supabase 프로젝트          ← 나머지가 여기 참조
2. Google OAuth 클라이언트    ← Supabase 리디렉션 URL이 필요
3. S3 + CloudFront (CORS)     ← 데이터 배포 전제
4. Vercel 프로젝트 2개        ← 도메인이 정해져야 CORS를 좁힐 수 있음
5. Related Projects 연결
```

3번과 4번은 서로를 참조한다. CORS를 먼저 넓게 열고 Vercel 도메인이 정해진 뒤 좁힌다.

---

## 1. Supabase

- [ ] 프로젝트 생성. **리전은 `ap-northeast-2`(서울)** — CDN과 같은 리전
- [ ] **JWT 서명 키를 비대칭으로 전환**

  기본값이 대칭(HS256)이면 Nest가 JWT secret을 들고 있어야 한다. 비대칭으로 바꾸면 공개키만 있으면 되고, 키 교체·폐기를 Nest 재배포 없이 할 수 있다.

  전환 후 `https://<ref>.supabase.co/auth/v1/jwks`가 응답하는지 확인한다.

- [ ] 연결 문자열 확보 — **Supavisor 트랜잭션 모드 `:6543`**

  세션 모드(`:5432`)나 직접 연결이 아니다. 서버리스에서는 트랜잭션 모드다.

  ```
  postgres://postgres.<ref>:<pw>@aws-ap-northeast-2.pooler.supabase.com:6543/postgres
  ```

- [ ] Auth → Google 프로바이더 활성화 (2번 완료 후 client id/secret 입력)
- [ ] Auth → Redirect URLs에 로컬·프리뷰·프로덕션 등록

**RLS는 켜지 않는다.** 근거는 `05-database.md` 설계 원칙 4. 테이블 생성 시 Supabase가 RLS를 기본 활성화하면, 켜둔 채로 정책 없이 두지 말고 명시적으로 끈다. 켜져 있는데 정책이 없으면 service role이 아닌 모든 접근이 조용히 빈 결과를 반환해 디버깅이 어렵다.

- [ ] **Data API(PostgREST) 비활성화** — Settings → API에서 Data API를 끄거나 exposed schema에서 `public`을 제거한다. RLS가 없으므로 이걸 안 끄면 공개된 anon 키만으로 REST 경로가 열린다 (`05-database.md` 설계 원칙 4)

## 2. Google OAuth

- [ ] Google Cloud 프로젝트 생성
- [ ] OAuth 동의 화면 구성 (External, 테스트 사용자에 본인 계정)
- [ ] OAuth 2.0 클라이언트 ID 생성 (웹 애플리케이션)
- [ ] 승인된 리디렉션 URI에 **Supabase 콜백**을 등록

  ```
  https://<ref>.supabase.co/auth/v1/callback
  ```

  앱 도메인이 아니라 Supabase 콜백이다. 여기서 자주 틀린다.

- [ ] client id / secret을 Supabase Auth에 입력

## 3. S3 + CloudFront

기존 자산 `static-cdn.scent-jo.dev` (S3 `ap-northeast-2` + CloudFront)를 재사용한다. 확인된 상태: 정상 서빙 중, **CORS 미설정**.

### S3

- [ ] **버킷 버저닝 활성화**

  추출 데이터가 git에 없으므로 S3가 유일한 원본이다. 버전 경로(`v1`/`v2`)로 덮어쓰기를 구조적으로 막지만, 버저닝은 그 위의 안전망이다. 둘 다 한다.

- [ ] `aws-saa/` 프리픽스 확인 (기존 콘텐츠와 충돌하지 않는지)
- [ ] 업로드용 IAM 사용자 생성. 권한을 좁힌다

  ```json
  {
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
    "Resource": [
      "arn:aws:s3:::<bucket>",
      "arn:aws:s3:::<bucket>/aws-saa/*"
    ]
  }
  ```

  `s3:DeleteObject`를 주지 않는다. 기존 버전을 지울 일이 없다.

- [ ] **버킷 버저닝 활성화 — 첫 `data:publish` 전 필수.** `--force` 덮어쓰기 사고의 최후 안전망이다

### CloudFront — CORS

**Response Headers Policy로 주입한다.** 근거(캐시 파편화 방지)는 `03-architecture.md` CORS 절이 캐논이다.

- [ ] Response Headers Policy 생성
  - `Access-Control-Allow-Origin`: 아래 목록
  - `Access-Control-Allow-Methods`: `GET, HEAD`
  - `Access-Control-Max-Age`: `86400`
  - 자격증명 허용 안 함 (공개 데이터다)
- [ ] `aws-saa/*` 경로 동작(behavior)에 정책 연결

허용 Origin:

```
http://localhost:3000
https://saa.scent-jo.dev            ← 프로덕션 (web)
https://aws-study-*-smelljo.vercel.app     ← 프리뷰 (`docs/06` 「환경별 차이」)
```

> CloudFront Response Headers Policy는 와일드카드 Origin 목록을 직접 지원하지 않는다. 프리뷰 도메인 대응이 안 되면 두 가지 선택지가 있다: (a) 프리뷰에서는 프로덕션 도메인의 데이터를 쓰도록 `NEXT_PUBLIC_DATA_BASE_URL`을 고정, (b) CloudFront Function으로 Origin을 검사해 반사. **(a)를 먼저 시도한다.** 데이터는 어차피 공개 읽기 전용이라 프리뷰가 프로덕션 데이터를 읽어도 문제가 없다.

### CloudFront — 캐시

- [ ] `aws-saa/v*/**` → `Cache-Control: public, max-age=31536000, immutable`
- [ ] `aws-saa/manifest.json` → `Cache-Control: public, max-age=300`

헤더는 업로드 시 S3 객체 메타데이터로 설정한다 (`data:publish`가 넣는다). CloudFront는 오리진 헤더를 존중한다.

**버전 경로를 쓰므로 invalidation은 정상 흐름에 없다.** `manifest.json`만 5분 뒤 자연 만료된다. 급할 때만 manifest 하나를 invalidate 한다.

## 4. Vercel

- [ ] `aws-study-web` 생성 · Root Directory `apps/web`
- [ ] `aws-study-api` 생성 · Root Directory `apps/api`
- [ ] **Functions 리전 `icn1`(서울) — web·api 둘 다.** 기본 `iad1`이면 매 답안 제출이 미 동부를 왕복한다.

  대시보드가 아니라 각 앱의 `vercel.json`에 `"regions": ["icn1"]`로 둔다 — 프로젝트를 다시 만들어도 따라오고 리뷰에 남는다. 빌드·출력은 명시하지 않는다(NestJS 제로 설정 감지를 유지).

- [ ] **프리뷰 SSO 보호(Vercel Authentication) 끄기 — web·api 둘 다.**

  기본값이 `all_except_custom_domains`라 프리뷰 URL이 `vercel.com/sso-api`로 302된다. 브라우저가 api를 **교차출처로 직접 부르는** 구조(`03-architecture.md` §인증)에서는 그 fetch가 SSO 리디렉션을 받고 CORS에 걸려 죽는다. Protection Bypass 시크릿은 브라우저 fetch에 쓰려면 클라이언트 번들에 박아야 해서 같은 노출이 된다.

  ```bash
  vercel project protection disable --sso    # 되돌리기: enable --sso
  ```

  실질 방어선은 앱 자체 인증이다 — Supabase 로그인 + `ALLOWED_EMAIL` 불일치 403 (`06-environment.md`).

- [ ] **NestJS 제로 설정 감지 확인** — `apps/api`가 프레임워크로 NestJS를 인식하는지

  이것이 M0 검증의 핵심이다. 인식하지 못하면 `apps/api/vercel.json`에 빌드·출력 설정을 명시해 우회한다.

- [ ] 각 프로젝트에 환경변수 등록 (`06-environment.md`)
- [ ] 빌드 스킵 조건 충족 확인 — `pnpm-workspace.yaml`, 유일한 패키지명, 명시적 패키지 간 의존
- [ ] CLI 48.4.0 이상 (`vercel dev`, NestJS 지원 최소 버전)

## 5. Related Projects

- [ ] `aws-study-api`의 프로젝트 ID 확인 (Settings → Project ID)
- [ ] `apps/web/vercel.json` 작성

  ```json
  { "relatedProjects": ["prj_<api-project-id>"] }
  ```

- [ ] `pnpm add @vercel/related-projects` (web)
- [ ] 프리뷰 배포에서 `VERCEL_RELATED_PROJECTS`가 실제로 내려오는지 확인

  프리뷰끼리 짝이 맞아야 한다. web 프리뷰가 프로덕션 api를 가리키면 설정이 잘못된 것이다.

## 검증 체크리스트

전부 끝난 뒤 한 번에 확인한다.

- [ ] 브라우저에서 CDN JSON을 fetch — CORS 통과
- [ ] Google 로그인 → JWT 발급 → `sub` 클레임 확인
- [ ] Nest가 JWKS로 그 JWT를 검증 → 200
- [ ] Nest가 Postgres에 연결 (`prepare: false` 확인)
- [ ] web 프리뷰가 api 프리뷰를 가리킴
- [ ] `MEMORY.md` 인프라 표 갱신
