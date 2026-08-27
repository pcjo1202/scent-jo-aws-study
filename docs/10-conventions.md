# 10. 개발 규약

구현을 시작하기 전에 정한 도구·구조 결정과 **그 근거**를 담는다.
지켜야 할 규칙 자체는 여기 없다 — 자동으로 주입되는 곳에 둔다.

## 규칙은 어디 있나

`docs/`는 *왜*를, 규칙 파일은 *하라 / 하지 마라*를 담는다. 같은 내용을 두 번 쓰지 않는다.

| 내용 | 위치 | 로드 시점 |
|---|---|---|
| 범용 코드 규약 — 함수 선언문·네이밍·SSOT·매직넘버·early return·helper·에러·타입 | `.claude/rules/code-conventions.md` | `**/*.{ts,tsx,mjs}`를 읽을 때 자동 |
| web 규칙 — FSD 레이어·배럴 금지·`'use client'`·토큰 | `apps/web/CLAUDE.md` | `apps/web` 파일을 읽을 때 자동 |
| api 규칙 — 모듈 배치·전역 가드·DTO·오류 응답 | `apps/api/CLAUDE.md` | `apps/api` 파일을 읽을 때 자동 |
| 결정의 근거 | 이 문서 | 사람이 펼침 |

하위 디렉터리 `CLAUDE.md`와 `paths:` 스코프 규칙은 **해당 파일을 읽을 때** 주입되고 `/compact` 후에도 다시 주입된다. 루트 `CLAUDE.md`에 다 넣으면 매 세션 컨텍스트를 먹으므로 이렇게 나눈다. 각 파일은 200줄 이하를 목표로 한다.

## 레이아웃

```
aws-study/
├─ eslint.config.base.mjs        공유 TS 규칙 + prettier off
├─ .prettierrc.json  .prettierignore
├─ tsconfig.base.json
├─ vitest.config.ts              루트 하나
├─ turbo.json  package.json
├─ .claude/rules/                자동 주입 규칙
├─ apps/
│  ├─ web/   app/ (라우팅) · src/ (FSD 5층) · CLAUDE.md
│  └─ api/   src/ (05의 모듈 구성) · CLAUDE.md
├─ packages/shared/              도메인 타입만. 런타임 산출물 없음
├─ scripts/                      데이터 파이프라인 — 워크스페이스 패키지
├─ tests/fixtures/               gitignored, data:pull이 복원
└─ data/                         gitignored
```

**`scripts/`를 워크스페이스 패키지로 올린다.** 지금 `pnpm-workspace.yaml`은 `apps/*`·`packages/*`만 잡아 `scripts/`가 워크스페이스 밖이다. 그대로 두면 PDF 파서·AWS SDK 같은 무거운 의존성이 루트로 새어 web·api 설치에 딸려온다. `pnpm-workspace.yaml`에 `- "scripts"` 한 줄과 `scripts/package.json`을 추가한다 — `03-architecture.md`의 경로는 그대로다.

`scripts/`가 패키지가 되면 `04-data-model.md`의 `pnpm data:*` 명령은 루트에서 위임한다.

```json
"data:extract": "pnpm --filter @aws-study/scripts run extract"
```

명령 이름은 `04`가 정한 그대로 유지한다 — 호출부(문서·이슈·런북)를 바꾸지 않는다.

## apps/web — 왜 FSD인가

화면 9개에 FSD는 과할 수 있다. 공식 문서도 *"대부분의 프로젝트는 Shared·Pages·App만 있으면 된다"*, 별도 가이드는 *"20개 이상 기능으로 성장할 앱에 권장"* 이라고 한다. 그럼에도 쓰는 이유는 **에이전트가 코드를 쓰기 때문**이다 — 배치가 예측 가능하고 임포트 방향이 린터로 강제되면, 세션이 바뀌어도 같은 자리에 같은 것이 놓인다.

**5층을 쓰고 `entities`를 생략한다.** 비즈니스 개념의 타입(`ChoiceKey`·`AttemptSource` 등)이 이미 `packages/shared`에 있어 web의 `entities`는 UI 조각만 남는데, 그건 `shared/ui`나 widget 안에서 충분하다. 모노레포가 entities 층의 역할을 일부 대신한다.

`features`는 남긴다 — 답안 제출(낙관적 UI + 큐)·필터·노트 검색·세션 관리는 실제로 갈리는 상호작용이고, 생략하면 widget이 비대해진다.

**`_app`·`_pages` 개명**은 Next의 `app/`·`pages/`와 충돌을 피하는 FSD 공식 권고이고 공식 린터와도 호환된다. Next 라우팅 폴더는 앱 루트의 `app/`에 두고 FSD는 `src/` 아래 둔다.

### 배럴 금지와 FSD의 공개 API

FSD는 슬라이스마다 `index.ts` 공개 API를 두는 게 관례지만, **공식 문서가 스스로 그 문제를 인정한다** — 트리셰이킹 저해, 개발 서버 지연, 순환 임포트. 대안으로 세그먼트 레벨 index를 생략하고 깊은 경로로 직접 import하는 방식을 제시한다. `react-best-practices` 스킬의 `bundle-barrel-imports`와도 맞으므로 이쪽을 택한다.

### 경계 강제

ESLint `import/no-restricted-paths`의 zone으로 레이어 방향을 막는다. 새 CLI나 새 설정 파일이 없고 에디터에서 즉시 빨간줄로 보이는 게 이유다. 공식 린터 `steiger`는 슬라이스 경계까지 잡지만 별도 CLI라 CI 없는 솔로 환경에선 돌리는 걸 잊기 쉽다.

**한계**: 같은 층 슬라이스 간 import는 이 규칙으로 표현하기 어려워 규약으로 남긴다.

### 경로 별칭

web만 `@/*` → `apps/web/src/*` 하나를 둔다. 레이어별 별칭을 만들지 않는 이유는 `import/no-restricted-paths`의 zone이 실제 경로 기준이라, 별칭이 늘면 경계 검사가 새어 나가기 때문이다.

api·scripts는 별칭을 두지 않는다. 모듈 트리가 얕아 상대경로로 충분하고, 별칭을 붙이면 SWC와 Vitest 양쪽에 해석 설정을 중복으로 넣어야 한다.

## apps/api — 왜 Nest 기본 모듈 구조인가

Nest가 프레임워크 수준에서 정하는 건 **CLI 관용**뿐이다 — 모듈 하나에 폴더 하나, `.module`·`.controller`·`.service` 점 접미사. FSD처럼 레이어 간 의존 방향을 규정하지는 않는다. 그 위 아키텍처는 커뮤니티 선택이고 크게 셋이다.

| | 형태 | 판단 |
|---|---|---|
| **feature-based modular** | 모듈 폴더가 controller·service·dto를 다 가짐 | **채택** |
| layered (Spring MVC식) | `controllers/` `services/` `repositories/`로 기술 계층 분리 | 기각 |
| Clean · Hexagonal · DDD | `api / application / domain / infrastructure` 4계층 | 기각 |

**feature-based modular을 쓴다.** `05-database.md`가 확정한 모듈 목록이 이미 그 형태이고, 부차 목표가 NestJS 학습이라 프레임워크 관용을 벗어날 이유가 없다.

**Clean·DDD를 기각한 이유**: 도메인 로직의 실체가 `catalog`의 채점·추첨 순수함수 두 개다. 4계층을 깔면 인터페이스와 매퍼가 실제 로직보다 많아진다.

**layered를 기각한 이유**: 기술 계층으로 자르면 한 기능을 고치는 데 세 폴더를 오간다. Nest 커뮤니티 가이드가 명시적으로 경고하는 형태다.

프론트가 FSD, 백이 Nest 모듈로 **비대칭인 것은 정상이다.** 프론트는 화면·상호작용이 많아 배치 규칙이 따로 필요하고, 백은 Nest의 모듈 시스템이 이미 그 역할을 한다.

### repository 계층은 둔다

서비스가 `db.provider`를 주입받아 Drizzle을 직접 부르는 쪽이 파일이 적다. 그럼에도 `*.repository.ts`를 두기로 했다.

- 서비스에서 SQL이 사라져 비즈니스 로직만 남는다
- `05`의 도출 쿼리 4개가 각자 주인을 갖는다 (progress · exams · stats)
- 계층 분리를 실제로 해보는 것이 부차 목표(NestJS 학습)에 부합한다

**비용은 감수한다** — 도메인 모듈 4개에 파일 4개가 늘고, 한 곳에서만 쓰이는 쿼리는 얇은 래퍼가 된다.

## 린트·포맷 — 왜 ESLint + Prettier인가

Biome이 단일 도구·고속이라 더 게으르지만, 이 스택에서 잃는 게 크다.

- `eslint-config-next`가 Next 고유 결함(`<img>` 사용, 클라이언트 경계 오용)을 잡는다
- `typescript-eslint`의 타입 인지 규칙 `no-floating-promises`·`no-misused-promises`가 Nest 서비스의 `await` 누락을 잡는다 — **부차 목표가 NestJS 학습**이라 여기서 값이 나온다

포맷 규칙은 ESLint에 두지 않는다. `eslint-config-prettier/flat`을 설정 맨 끝에 두어 충돌 규칙을 끈다.

**설정은 패키지별로 둔다.** 루트 단일 설정으로 하려면 `eslint-config-next`가 내보내는 배열에 `files`를 map으로 주입해야 하는데, 그 배열의 `globalIgnores` 엔트리까지 오염돼 깨진다. 각 패키지에 `eslint.config.mjs`를 두고 `turbo run lint`로 돈다.

| 파일 | 내용 |
|---|---|
| `eslint.config.base.mjs` | `typescript-eslint` recommended + `eslint-config-prettier/flat` |
| `apps/web/eslint.config.mjs` | base + `eslint-config-next/core-web-vitals` + `/typescript` + FSD zones |
| `apps/api/eslint.config.mjs` | base + 타입 인지 규칙(`projectService`) |

`packages/shared`는 타입 20줄이라 설정을 두지 않는다. Next 16에서 `next lint`가 제거됐으므로 각 패키지 스크립트는 `eslint .` 이다.

### import 정렬

`import/order`로 그룹 순서를 강제한다 — 외부 → `@aws-study/shared` → `@/shared` → `@/features` → `@/widgets` → `@/_pages` → 상대경로. **읽는 순서가 곧 의존 방향**이라 잘못된 방향의 import가 눈에 띈다.

새 의존성이 아니다. `import/no-restricted-paths`를 쓰려면 `eslint-plugin-import`가 어차피 필요하고, `eslint-config-next`가 이미 번들한다. Prettier는 import를 정렬하지 않으므로 정렬 플러그인 대신 이 규칙을 쓴다.

### Prettier

```json
{ "semi": false, "singleQuote": true, "printWidth": 100, "trailingComma": "all" }
```

`packages/shared/src/index.ts`의 현재 스타일을 성문화한 것이다. `printWidth`만 100으로 올린다 — 한글 주석과 긴 유니온 타입이 80에서 자주 접힌다.

## tsconfig

루트 `tsconfig.base.json`에 **strict 계열만** 두고 각 패키지가 상대경로로 extends한다. 별도 `packages/tsconfig` 패키지는 만들지 않는다 — 파일 하나를 위해 워크스페이스 항목을 늘릴 이유가 없다.

**`verbatimModuleSyntax`는 base에 넣지 않는다.** web·shared는 켜고 **api는 끈다** — 주입 대상을 `import type`으로 가져오면 `emitDecoratorMetadata`가 런타임 토큰을 잃어 Nest DI가 깨진다. base에 넣고 api에서 끄는 형태로 만들면 의도가 보이지 않는다.

## 테스트 — Vitest 루트 단일 설정

`08-testing.md`의 치명 영역 4종은 **파서 픽스처(scripts) · 채점 순수함수(api) · JWT 가드(api) · 기록 정합성(api)** 이다. 컴포넌트 스냅샷과 E2E를 명시적으로 배제했으므로 **web에는 테스트가 없다.**

따라서 projects 분할이나 jsdom 환경이 필요 없다. 루트 `vitest.config.ts` 하나에 `environment: 'node'`, `include: ['apps/api/**/*.spec.ts', 'scripts/**/*.spec.ts']`, NestJS 데코레이터를 위해 `unplugin-swc`를 단다. 루트 스크립트는 `"test": "vitest run"` — turbo를 거치지 않는다.

Jest를 쓰지 않는 이유는 러너가 둘로 갈리기 때문이다. Nest 공식 기본값이라는 이점이 있지만, `packages/shared`가 ESM(`type: module`)이라 Vitest 쪽이 마찰이 적다.

## turbo

`lint`·`format:check` 태스크를 추가한다. 둘 다 `dependsOn`이 없다 — 빌드 산출물이 필요 없다.

**기존 `typecheck: {}`의 빈 설정은 건드리지 않는다.** `07e98ae`에서 죽은 `dependsOn`을 의도적으로 제거한 결과다. `packages/shared`가 `types: ./src/index.ts`로 원본 `.ts`를 노출하므로 소비자가 인라인으로 타입 검사한다.
