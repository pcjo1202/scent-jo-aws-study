# 10. 개발 규약

구현을 시작하기 전에 정한 도구·구조 결정과 **그 근거**를 담는다.
지켜야 할 규칙 자체는 여기 없다 — 자동으로 주입되는 곳에 둔다.

## 규칙은 어디 있나

`docs/`는 *왜*를, 규칙 파일은 *하라 / 하지 마라*를 담는다. 같은 내용을 두 번 쓰지 않는다.

| 내용 | 위치 | 로드 시점 |
|---|---|---|
| 범용 코드 규약 — 함수 선언문·네이밍·SSOT·매직넘버·early return·helper·주석·에러·타입 | `.claude/rules/code-conventions.md` | `**/*.{ts,tsx,mjs}`를 읽을 때 자동 |
| web 규칙 — FSD 레이어·배럴 금지·`'use client'`·토큰 | `apps/web/CLAUDE.md` | `apps/web` 파일을 읽을 때 자동 |
| web 상태 관리 — 4단 경계·`queryOptions`·키 팩토리·suspense | `.claude/rules/web-state.md` | `apps/web/**/*.{ts,tsx}`를 읽을 때 자동 |
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

## 상태 관리 — 왜 4단으로 가르나

규칙 자체는 `.claude/rules/web-state.md`에 있다. 여기엔 그 경계를 그렇게 그은 이유만 적는다.

경계가 없으면 화면마다 로딩·에러 분기를 새로 짜게 된다. **이 규약의 동기는 기능이 아니라 보일러플레이트 제거다.**

### 왜 TanStack Query인가

`docs/02-features.md`가 요구하는 것이 캐시·재시도·무효화다 — 오답 복습 세트는 제출할 때마다 갱신되고, 대시보드 통계는 여러 화면에서 같은 값을 본다. 이걸 `useEffect` + `useState`로 각자 짜면 화면 수만큼 같은 코드가 생긴다. Redux/Zustand 계열은 **서버 데이터를 클라이언트 상태로 복사**하게 만들어 캐시가 둘이 되고, 그 순간부터 동기화가 사람 일이 된다.

`fetch` + Next 캐시만으로 가지 않는 이유는 **클라이언트 상호작용 후의 갱신** 때문이다. 답안 제출 → 진도·통계 무효화는 서버 캐시 태그로도 되지만, 그러려면 상호작용마다 서버 왕복이 생긴다.

### 왜 suspense가 기본인가

`useQuery` + `isLoading`/`isError` 분기는 화면 9개에 그대로 9번 복제된다. `useSuspenseQuery`는 `data`가 항상 있는 타입을 주므로 **분기 자체가 사라지고**, 로딩·오류 표현이 경계 컴포넌트 한 곳으로 모인다. `docs/02`의 「정적 데이터(CDN) 실패」가 요구하는 "오류 + 재시도"도 그 한 곳에서 구현된다.

대가는 **폭포수 위험**이다. 형제 컴포넌트가 각자 suspend하면 순차 로딩이 된다. 그래서 서버 컴포넌트가 `prefetchQuery`로 요청을 먼저 띄운다 — 병렬로 출발하고, 클라이언트는 이미 나간 요청을 이어받는다.

`prefetchQuery`를 `await`하지 않는 것은 TTFB 때문이다. `await`하면 페이지 첫 바이트가 api 응답을 기다린다. 대신 `dehydrate`에 pending 쿼리를 포함시켜 스트리밍으로 넘긴다.

### 왜 `getQueryClient`가 `_app`이 아니라 `shared/api`인가

프로바이더는 `_app`이 맞다. 그러나 **`_pages`의 서버 컴포넌트가 prefetch를 위해 같은 클라이언트 팩토리를 부른다.** FSD 경계상 `_pages`는 `_app`을 가져올 수 없고, `import/no-restricted-paths`가 이를 막는다. 팩토리를 `shared/api`로 내리면 프로바이더(`_app`)와 prefetch(`_pages`)가 둘 다 아래로만 가져온다.

### 왜 Jotai를 지금 설치하지 않나

경계는 정하되 **의존성은 첫 사용처가 생길 때 넣는다.** 착수 시점에 전역 UI 상태가 0곳이라, 지금 설치하면 사용처 없는 dependency가 lockfile에 남는다. 4단 경계에서 Jotai 칸을 비워두지 않는 이유는, 규칙이 없으면 그 자리가 Query나 Context로 잘못 채워지기 때문이다.

Jotai를 고른 이유는 **Provider 없이 동작**해서다. Zustand도 가볍지만 store 파일을 만들어야 하고, Context는 값이 바뀔 때마다 구독 트리 전체가 리렌더된다. atom 하나가 곧 상태 하나인 쪽이 이 앱 규모에서 가장 적게 쓴다.

### 왜 오프라인 제출 큐는 Query가 아닌가

`docs/02-features.md` 「백엔드 요청 실패」가 `localStorage` 큐 + `POST /attempts/batch` 재전송을 이미 구체적으로 정했다. 요구가 **탭을 닫아도 살아남는 지속 큐**인데 Query의 mutation 캐시는 메모리다. persister를 붙이면 되지만, 그건 명세가 정한 것보다 큰 장치를 들이는 것이다. Query는 조회 캐시를 맡고 큐는 명세대로 따로 만든다 (SJO-22).

## 스타일 저작 — 왜 Tailwind v4 + `@theme inline`인가

값과 규칙은 `DESIGN.md`가 소유한다. 여기엔 **그 값을 무엇으로 써서 화면에 올리는가**의 근거만 적는다.

### 토큰 계층은 Tailwind 바깥에 둔다

`--ref-*` / `--sys-*`는 `apps/web/src/shared/styles/tokens.css`에 **순수 CSS 커스텀 프로퍼티**로 있다. Tailwind는 그 위에 얹히는 소비자일 뿐이다.

이 순서를 뒤집지 않는 이유는 `DESIGN.md`가 **팔레트 교체 경로를 reference 계층 하나로 한정**했기 때문이다. Material Theme Builder가 뱉는 것도 CSS 변수다. 토큰을 Tailwind 설정 안에 넣으면 교체가 프레임워크 마이그레이션이 된다.

### `@theme`이 아니라 `@theme inline`이다

색 역할은 `[data-theme='dark']`에서 재매핑된다. 일반 `@theme`은 값을 자기 변수로 한 번 복사하므로 `:root` 시점의 라이트 값이 굳고 다크 전환을 따라가지 못한다. `@theme inline`은 `var(--sys-color-*)`를 유틸에 그대로 심어 참조가 살아 있다.

**결과적으로 `dark:` variant를 한 번도 쓰지 않는다.** 색이 토큰 계층에서 뒤집히므로 마크업에 다크 분기가 생기지 않는다 — `DESIGN.md`가 3계층 토큰을 고른 이유가 이 지점에서 회수된다.

### 왜 유틸 프레임워크인가 — 네임스페이스 리셋

`DESIGN.md`의 핵심 제약은 "임의 색·임의 크기·임의 간격을 쓰지 않는다"이고, 유틸 프레임워크는 보통 그 제약과 충돌한다. 여기서는 반대로 **강제 수단**이 된다.

```css
@theme {
  --color-*: initial;   /* bg-red-500 이 존재하지 않는 클래스가 된다 */
  --text-*: initial;    /* text-3xl 도 마찬가지 */
  --radius-*: initial;
}
```

기본 팔레트·스케일을 통째로 지우고 `--sys-*`에서 파생된 것만 남기면, **토큰 밖의 값은 타이핑할 수 없다.** 리뷰가 잡아야 할 일을 빌드가 잡는다. 타입스케일은 `--text-{role}`에 `--line-height`·`--font-weight`·`--letter-spacing` 세 모디파이어가 붙어 한 클래스가 네 속성을 다 나르므로, 「우리 스케일」 8역할이 유틸 8개로 1:1 대응한다.

간격은 설정할 것이 없다. Tailwind 기본 `--spacing`이 4px라 유틸이 내는 값이 전부 4의 배수가 된다. `DESIGN.md`가 열거한 4·8·12·16·24·32·48이 그 안에 들어오지만 `gap-5`(20px) 같은 다른 배수도 유효하다 — **열거 목록까지 강제하지는 않는다.**

브레이크포인트는 반대로 반드시 갈아끼워야 한다. Tailwind 기본 `sm`·`md`·`lg`(640/768/1024)는 `DESIGN.md`의 window size class(600/840)와 **겹치는 값이 하나도 없어서**, 남겨두면 화면이 명세와 다른 지점에서 갈리고 리뷰로는 안 잡힌다. `--breakpoint-*: initial` 뒤에 `medium`·`expanded` 둘만 둔다. 미디어 쿼리는 커스텀 프로퍼티를 읽지 못하므로 그 두 값만 리터럴이고, `tokens.css`는 `theme(--breakpoint-medium)`으로 되받는다.

남는 구멍은 임의값 문법(`bg-[#abc]`·`p-[13px]`) 하나뿐이라 `apps/web/eslint.config.mjs`의 `no-restricted-syntax`로 막는다. 규칙이 하나뿐이라 Tailwind 린트 플러그인을 얹지 않는다.

**셀렉터는 자손 결합자여야 한다.** 직계 자식이면 `className="…"`만 잡고 조건부·템플릿·`cn()` 인자가 전부 빠져나가는데, 상태 분기가 있는 컴포넌트에서는 그쪽이 오히려 주 경로다. 반대로 임의 *variant*(`data-[state=open]:`·`[&>svg]:`)는 값이 아니라 선택자라 통과시킨다.

### 기각한 것

| | 왜 |
|---|---|
| CSS Modules | 임의값을 막을 수단이 리뷰뿐이다. 위의 네임스페이스 리셋에 해당하는 장치가 없다 |
| vanilla-extract·CSS-in-JS | 토큰이 이미 CSS 변수라 런타임·빌드타임 스타일 엔진이 얹을 값이 없다 |
| Tailwind 설정에 팔레트 직접 정의 | 다크 재매핑과 팔레트 교체 경로가 둘 다 프레임워크 안으로 들어간다 |

스캔 루트는 `@import 'tailwindcss' source('../../..')`로 못 박는다. Tailwind의 기본 스캔 기준이 **cwd**라 turbo가 레포 루트에서 돌면 `apps/web`을 통째로 놓친다.

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
| `apps/web/eslint.config.mjs` | `eslint-config-next/core-web-vitals` + `/typescript` + `eslint-config-prettier/flat` + FSD zones |
| `apps/api/eslint.config.mjs` | base + 타입 인지 규칙(`projectService`) |

`packages/shared`는 타입 20줄이라 설정을 두지 않는다. Next 16에서 `next lint`가 제거됐으므로 각 패키지 스크립트는 `eslint .` 이다.

**web은 base를 펼치지 않는다.** `eslint-config-next/typescript`가 `typescript-eslint`의 base·eslint-recommended·recommended를 그대로 품고 있어, base까지 펼치면 `@typescript-eslint` 플러그인이 두 번 정의돼 flat config가 `Cannot redefine plugin`으로 죽는다. web은 next 설정에 prettier와 FSD zones만 얹는다. api는 next 설정이 없으므로 base를 그대로 펼친다.

**ESLint는 9를 쓴다.** `eslint-config-next`가 끌어오는 `eslint-plugin-react`의 peer가 `^9.7`까지이고, 10에서는 `context.getFilename()`이 사라져 `react/display-name` 로딩 자체가 터진다. `typescript-eslint`는 10을 지원하지만 그쪽에 맞출 수 없다. **eslint를 각 앱의 devDependency로도 명시한다** — 루트만 두면 `node_modules/.bin`이 다른 버전을 가리키는 일이 생긴다.

### import 정렬

`import/order`로 그룹 순서를 강제한다 — 외부 → `@aws-study/shared` → `@/shared` → `@/features` → `@/widgets` → `@/_pages` → 상대경로. **읽는 순서가 곧 의존 방향**이라 잘못된 방향의 import가 눈에 띈다.

**web에만 건다.** 이 순서는 FSD 레이어를 그대로 옮긴 것이라 레이어가 없는 api·scripts에는 의미가 없다. api의 모듈 트리는 2단계로 얕아 정렬 규칙이 주는 값보다 설정 비용이 크다.

새 의존성이 아니다. `import/no-restricted-paths`를 쓰려면 `eslint-plugin-import`가 어차피 필요하고, `eslint-config-next`가 이미 번들한다. Prettier는 import를 정렬하지 않으므로 정렬 플러그인 대신 이 규칙을 쓴다.

### Prettier

```json
{ "semi": false, "singleQuote": true, "printWidth": 100, "trailingComma": "all" }
```

`packages/shared/src/index.ts`의 현재 스타일을 성문화한 것이다. `printWidth`만 100으로 올린다 — 한글 주석과 긴 유니온 타입이 80에서 자주 접힌다.

**`*.md`는 대상에서 제외한다.** 위 네 옵션은 전부 코드용이라 md에는 걸리는 게 없는데, prettier는 표를 열 폭에 맞춰 재작성한다. 한글 셀의 폭 계산이 실제 표시와 어긋나 정렬이 오히려 깨지고, 명세 문서의 diff에 내용 변경과 포맷 변경이 섞인다. `.claude/settings.local.json`도 제외한다 — Claude Code가 소유·재작성하는 파일이라 포맷이 유지되지 않는다. `apps/web/next-env.d.ts`는 `.gitignore`에 있어 별도 항목이 필요 없다 — `next dev`와 `next build`가 서로 다른 내용으로 생성하므로 애초에 추적하지 않는다.

## tsconfig

루트 `tsconfig.base.json`에 **strict 계열만** 두고 각 패키지가 상대경로로 extends한다. 별도 `packages/tsconfig` 패키지는 만들지 않는다 — 파일 하나를 위해 워크스페이스 항목을 늘릴 이유가 없다.

담는 것은 `strict` · `noUncheckedIndexedAccess` · `skipLibCheck` 셋뿐이다. `target`·`module`·`moduleResolution`은 각 패키지가 정한다 — Next·Nest·Node 스크립트가 서로 다른 값을 요구하므로 base에 두면 어차피 전부 덮어쓴다.

`noUncheckedIndexedAccess`를 켜는 이유는 **치명 영역이 배열 인덱싱 위에 있기 때문**이다. 파서(`scripts`)와 채점(`api/catalog`)에서 `arr[i]`가 `undefined`일 수 있다는 사실이 타입에 드러나야 한다. 조용히 틀린 결과가 나오는 것보다 옵셔널 체이닝 몇 개가 싸다.

**`verbatimModuleSyntax`는 base에 넣지 않는다.** web·shared는 켜고 **api는 끈다** — 주입 대상을 `import type`으로 가져오면 `emitDecoratorMetadata`가 런타임 토큰을 잃어 Nest DI가 깨진다. base에 넣고 api에서 끄는 형태로 만들면 의도가 보이지 않는다.

## 테스트 — Vitest 루트 단일 설정

`08-testing.md`의 치명 영역 4종은 **파서 픽스처(scripts) · 채점 순수함수(api) · JWT 가드(api) · 기록 정합성(api)** 이다. 컴포넌트 스냅샷과 E2E를 명시적으로 배제했으므로 **web에는 테스트가 없다.**

따라서 projects 분할이나 jsdom 환경이 필요 없다. 루트 `vitest.config.ts` 하나에 `environment: 'node'`, `include: ['apps/api/**/*.spec.ts', 'scripts/**/*.spec.ts']`, NestJS 데코레이터를 위해 `unplugin-swc`를 단다. 루트 스크립트는 `"test": "vitest run"` — turbo를 거치지 않는다.

`passWithNoTests`는 **두지 않는다.** vitest가 대상 0건을 **exit 1**로 취급하는 것이 여기서는 기능이다 — `include` 패턴이 깨지면 `pnpm test`가 조용히 통과하는 대신 실패한다. `exit 0`은 "통과"가 아니라 "오류 없음"이고, 0건 실행과 0건 실패는 똑같이 0을 준다.

초기에는 치명 영역 4종이 전부 없어 대상이 0건이라 이 옵션을 켜 뒀으나, SJO-4 시점에 `apps/api`·`scripts` 양쪽에 실제 대상이 들어와 근거가 사라졌다 (2026-08-28).

Jest를 쓰지 않는 이유는 러너가 둘로 갈리기 때문이다. Nest 공식 기본값이라는 이점이 있지만, `packages/shared`가 ESM(`type: module`)이라 Vitest 쪽이 마찰이 적다.

## turbo

`lint` 태스크를 추가한다. `dependsOn`이 없다 — 빌드 산출물이 필요 없다.

**`format:check`는 turbo에 두지 않는다.** Prettier는 레포 전역을 한 번에 보는 것이 더 싸고, 루트 `prettier --check .`가 이미 그 역할을 한다. 패키지별 `format:check` 스크립트를 두지 않으므로 turbo 태스크는 호출부 없는 죽은 설정이 된다.

**기존 `typecheck: {}`의 빈 설정은 건드리지 않는다.** `07e98ae`에서 죽은 `dependsOn`을 의도적으로 제거한 결과다. `packages/shared`가 `types: ./src/index.ts`로 원본 `.ts`를 노출하므로 소비자가 인라인으로 타입 검사한다.
