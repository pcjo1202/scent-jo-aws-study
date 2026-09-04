# apps/api — NestJS

루트 `CLAUDE.md`의 「어기기 쉬운 규칙」이 그대로 적용된다 — 특히 **`prepare: false`** 와 **채점은 서버가 한다**.
`.claude/rules/code-conventions.md`도 먼저 적용된다. 여기엔 이 앱에만 해당하는 것만 적는다.

**스키마와 API 계약은 `docs/05-database.md`가 정본이다.** 이 파일과 어긋나면 05가 이긴다.

## 모듈 배치

```
src/
├─ main.ts        bootstrap + CORS + ValidationPipe
├─ app.module.ts
├─ auth/          jwks.service · supabase-jwt.guard · current-user.decorator
├─ catalog/       manifest·index 캐시, 채점, 추첨
├─ attempts/  exams/  progress/  stats/
└─ db/            schema.ts · migrations/ · db.provider.ts · db.module.ts
```

도메인 모듈은 **컨트롤러·서비스·DTO를 자기 폴더 안에** 둔다. 공용 타입은 `@aws-study/shared`에서 가져온다.

## 모듈 내부 파일

Nest CLI 관용을 따른다 — **점 접미사로 역할을 표시**한다.

```
src/attempts/
├─ attempts.module.ts
├─ attempts.controller.ts     HTTP 경계. 검증된 DTO를 서비스에 넘긴다
├─ attempts.service.ts        비즈니스 로직. SQL을 쓰지 않는다
├─ attempts.repository.ts     Drizzle 쿼리. SQL이 이 파일 밖으로 새지 않는다
└─ dto/create-attempt.dto.ts
```

- **`entities/`를 만들지 않는다** — Drizzle 스키마가 `db/schema.ts`에 단일 정의로 있다. `nest g resource`가 만들면 지운다
- **`common/`·`core/`를 만들지 않는다** — 전역 장치가 가드 하나뿐이고, `05`의 오류 응답 형태(`{ statusCode, message, error }`)는 Nest 기본 예외 필터가 그대로 준다

## repository가 SQL의 경계다

- **서비스에 SQL을 쓰지 않는다.** Drizzle 쿼리는 전부 `*.repository.ts` 안이다
- repository는 **도메인 타입을 반환**한다. Drizzle row 타입을 컨트롤러까지 흘리지 않는다
- repository에 비즈니스 판단을 넣지 않는다 — 채점·추첨은 `catalog`, 소유권 판정은 서비스
- `05`의 도출 쿼리는 **쓰는 모듈이 소유**한다: 풀이 상태 맵·오답 목록 → `progress`, 세션 채점 → `exams`, 카테고리별 정답률 → `stats`

**경로 별칭을 두지 않는다.** 모듈 트리가 2단계로 얕아 상대경로로 충분하고, 별칭을 붙이면 SWC·Vitest 양쪽에 해석 설정을 중복으로 넣어야 한다. 공용 타입만 `@aws-study/shared`로 가져온다.

## 가드는 전역, 예외만 `@Public()`

`SupabaseJwtGuard`를 전역 가드로 등록하고 `/health`에만 `@Public()`을 붙인다. **엔드포인트마다 가드를 붙이지 않는다** — 붙이는 걸 잊어서 뚫리는 사고를 구조적으로 막는 게 목적이다.

`user_id`는 항상 토큰의 `sub`에서 가져온다. **요청 본문의 `userId`를 신뢰하지 않는다.**

## DTO는 이 앱이 소유한다

`packages/shared`에는 타입만 있고 런타임 산출물이 없다. class-validator DTO 클래스는 `apps/api`에 두고, shared의 interface를 `implements`해 계약 정합을 강제한다.

## `import type`을 주의한다

이 앱은 `verbatimModuleSyntax`를 **끈다.** 주입 대상을 `import type`으로 가져오면 `emitDecoratorMetadata`가 런타임 토큰을 잃어 DI가 깨진다. 생성자에 주입되는 클래스는 **값 import**로 가져온다.

## 오류 응답

`docs/05-database.md`의 표를 따른다. 자주 틀리는 둘:

- **남의 리소스는 404다.** 403이 아니다 — 존재 여부를 흘리지 않는다
- **상태 충돌은 409다** — 진행 중 세션 중복 생성, 종료된 세션에 제출, `content_version` 불일치

## 마이그레이션

이미 적용된 마이그레이션 파일은 **수정하지 않는다.** 새 파일만 추가한다. 스키마 제약(check·부분 유니크 인덱스)은 DB가 강제하게 두고 애플리케이션에서 중복 검사하지 않는다.

## 테스트

`*.spec.ts`를 대상 파일 옆에 둔다. 테스트하는 것은 `docs/08-testing.md`가 정한 치명 영역뿐이다 — 채점 순수함수, JWT 가드 9케이스, 기록 정합성, 소유권. **컨트롤러 라우팅이나 화면은 테스트하지 않는다.**

**예외는 툴링 회귀 테스트다.** 컴파일러·번들러 설정이 깨졌을 때 증상이 "전부 안 됨"으로만 나타나는 것 — 예를 들어 `emitDecoratorMetadata`가 죽으면 DI가 통째로 깨진다. 그때 실패하는 파일이 하나뿐이면 원인을 바로 안다. 이 테스트는 `passWithNoTests: true`(`docs/10` 「테스트」) 아래에서 vitest 배선 자체의 스모크 역할도 겸한다. 라우팅·화면은 여전히 하지 않는다.
