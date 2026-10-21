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

화면 10개에 FSD는 과할 수 있다. 공식 문서도 *"대부분의 프로젝트는 Shared·Pages·App만 있으면 된다"*, 별도 가이드는 *"20개 이상 기능으로 성장할 앱에 권장"* 이라고 한다. 그럼에도 쓰는 이유는 **에이전트가 코드를 쓰기 때문**이다 — 배치가 예측 가능하고 임포트 방향이 린터로 강제되면, 세션이 바뀌어도 같은 자리에 같은 것이 놓인다.

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

`useQuery` + `isLoading`/`isError` 분기는 화면 10개에 그대로 10번 복제된다. `useSuspenseQuery`는 `data`가 항상 있는 타입을 주므로 **분기 자체가 사라지고**, 로딩·오류 표현이 경계 컴포넌트 한 곳으로 모인다. `docs/02`의 「정적 데이터(CDN) 실패」가 요구하는 "오류 + 재시도"도 그 한 곳에서 구현된다.

대가는 **폭포수 위험**이다. 형제 컴포넌트가 각자 suspend하면 순차 로딩이 된다. 그래서 서버 컴포넌트가 `prefetchQuery`로 요청을 먼저 띄운다 — 병렬로 출발하고, 클라이언트는 이미 나간 요청을 이어받는다.

`prefetchQuery`를 `await`하지 않는 것은 TTFB 때문이다. `await`하면 페이지 첫 바이트가 api 응답을 기다린다. 대신 `dehydrate`에 pending 쿼리를 포함시켜 스트리밍으로 넘긴다.

### 왜 `getQueryClient`가 `_app`이 아니라 `shared/api`인가

프로바이더는 `_app`이 맞다. 그러나 **`_pages`의 서버 컴포넌트가 prefetch를 위해 같은 클라이언트 팩토리를 부른다.** FSD 경계상 `_pages`는 `_app`을 가져올 수 없고, `import/no-restricted-paths`가 이를 막는다. 팩토리를 `shared/api`로 내리면 프로바이더(`_app`)와 prefetch(`_pages`)가 둘 다 아래로만 가져온다.

### 왜 Jotai를 지금 설치하지 않나

경계는 정하되 **의존성은 첫 사용처가 생길 때 넣는다.** 착수 시점에 전역 UI 상태가 0곳이라, 지금 설치하면 사용처 없는 dependency가 lockfile에 남는다. 4단 경계에서 Jotai 칸을 비워두지 않는 이유는, 규칙이 없으면 그 자리가 Query나 Context로 잘못 채워지기 때문이다.

Jotai를 고른 이유는 **Provider 없이 동작**해서다. Zustand도 가볍지만 store 파일을 만들어야 하고, Context는 값이 바뀔 때마다 구독 트리 전체가 리렌더된다. atom 하나가 곧 상태 하나인 쪽이 이 앱 규모에서 가장 적게 쓴다.

### 왜 오프라인 제출 큐는 Query가 아닌가

`docs/02-features.md` 「백엔드 요청 실패」가 `localStorage` 큐 + `POST /attempts/batch` 재전송을 이미 구체적으로 정했다. 요구가 **탭을 닫아도 살아남는 지속 큐**인데 Query의 mutation 캐시는 메모리다. persister를 붙이면 되지만, 그건 명세가 정한 것보다 큰 장치를 들이는 것이다. Query는 조회 캐시를 맡고 큐는 명세대로 따로 만든다 (SJO-22).

## 스타일 저작 — 왜 scent-jo-ds `tailwind.css`인가

겉모습의 값은 scent-jo-ds가 소유한다. 동작·의미·문구 규칙은 `DESIGN.md`가 소유한다. 여기엔 **DS를 이
앱에 어떻게 붙였고 무엇으로 강제하는가**의 근거만 적는다. 마크업·공개 변수의 정본은 설치된
`@scent-jo/css/MARKUP.md`다.

### 진입점은 두 줄이다

```css
@import 'tailwindcss' source('../../..');
@import '@scent-jo/css/tailwind.css';
```

`apps/web/src/shared/styles/global.css`가 이것뿐이다. `tailwind.css`가 `all.css`(토큰 변수·base·
컴포넌트 CSS)를 품고, 그 위에 Tailwind 테마를 DS 값으로 다시 건다. 사이트가 `@theme`을 따로 두지
않는다 — 두면 테마 소유자가 둘이 된다.

**DS가 지우고 다시 거는 네임스페이스는 여섯이다** — 색·radius·shadow·font(글꼴)·text(글자 크기)·
breakpoint (`tailwind.css` 1.0.0 원문 대조, 2026-10-21). 그래서 `bg-white`·`text-3xl`·`shadow-lg`·`rounded-lg`는
존재하지 않는 클래스이고, 이 여섯 네임스페이스에서 쓸 수 있는 것은 `bg-default`·`text-primary`·`rounded-3`·`shadow-2`·`text-t4`·
`md:` 같은 DS 이름뿐이다. **`bg-red-500` 같은 팔레트 유틸은 있다** — DS가 자기 팔레트(gray·orange·red·blue·green·yellow·
teal·purple·pink)를 같은 이름으로 다시 등록한다. 의미가 있는 자리는 팔레트가 아니라 semantic(`bg-danger-weak` 등)을 쓴다. 토큰 밖의 색·크기는 **타이핑할 수 없다** — 리뷰가 잡아야 할 일을 빌드가 잡는다.

**지우지 않는 것도 있다** — 간격(`--spacing`)·`font-weight`·`leading`·`tracking`·`container`·`ease`·`animate`·
`blur`·`drop-shadow`·`inset-shadow`·`text-shadow`·`aspect`·`perspective`는 Tailwind 기본값이 살아 있고,
`duration-137` 같은 bare 값도 통과한다 (2026-10-21 프로브: 클래스 32개를 실제 컴파일해 존재 여부를 셈 —
`bg-default`·`p-4` 존재, `text-3xl`·`medium:p-4` 부재로 하네스 확인). 간격은 DS도 4px 배수라 의도된 것이다
(`MARKUP.md` 「토큰」). 나머지는 DS가 열어 둔 것이지 권하는 것이 아니다 — `text-*`가 크기와 줄 높이를 함께
나르므로 `leading-*`를 덧붙이지 않고, 모션·그림자는 DS 컴포넌트에 맡긴다.

**`dark:` variant를 쓸 수 있다.** DS가 `data-sj-color-mode`에 묶어 두었다(`system`이면 OS 설정).
다만 색은 semantic 토큰이 먼저 뒤집으므로 `bg-default`·`text-primary`를 쓰면 다크 분기가 필요 없다.
`dark:`는 토큰으로 안 되는 자리에만 쓴다.

스캔 루트는 `source('../../..')`로 못 박는다. Tailwind의 기본 스캔 기준이 **cwd**라 turbo가 레포
루트에서 돌면 `apps/web`을 통째로 놓친다. DS 컴포넌트는 Tailwind 유틸이 아니라 `.sj-*` 클래스라 스캔
대상에 `node_modules`를 넣을 필요가 없다.

### 덮어쓰기 규칙

DS `MARKUP.md` 「덮어쓰기 규칙」을 그대로 따른다. 이 레포가 더하는 것은 없다.

| 고치고 싶은 범위 | 방법 |
|---|---|
| 배치(폭·간격·줄바꿈) | 페이지에서 Tailwind로. DS는 건드리지 않는다 |
| 이 화면의 컴포넌트 하나 | `className`. 컴포넌트 CSS가 `components` 층이라 유틸이 항상 이긴다 |
| 컴포넌트 내부 치수 | 그 컴포넌트가 **공개한** `--sj-<component>-*` 변수만, 값은 DS 토큰으로 |
| 사이트 전체의 해당 컴포넌트 | 같은 공개 변수를 `global.css`의 `:root` 등에 |
| 모든 사이트 | DS를 고쳐서 배포 — 이 레포에서 우회하지 않고 DS 레포에 이슈 |

**DS 내부 구조를 셀렉터로 건드리지 않는다**(`.sj-app-bar__row > …`). 내부 클래스 이름은 공개 계약이
아니라 DS가 패치 버전에서 바꿔도 된다. 그 순간 이 앱만 조용히 깨진다.

### 임의값 금지를 유지하는 이유

네임스페이스 리셋이 이름 있는 유틸을 DS 값으로 좁혔어도 `p-[13px]`·`bg-[#abc]`는 여전히 문법으로
통과한다. 이것 하나가 사이트 코드에 hex·임의 px가 들어오는 경로이고, 그것이 DS의 반목표(브랜드가
흐트러지는 것)다. 필요한 값이 DS에 없으면 이 레포에서 임의값으로 우회하지 않고 DS에 먼저 추가한다.

그래서 `apps/web/eslint.config.mjs`의 `no-restricted-syntax`로 막는다. 규칙이 하나뿐이라 Tailwind 린트 플러그인을 얹지 않는다.

**셀렉터를 `className` 안으로 좁히지 않는다.** 좁히면 클래스 문자열을 상수로 뽑는 순간 규칙이 꺼지는데, 상태별 클래스를 레코드로 두는 것(`const RESULT_STYLE = { … }`)은 컴포넌트에서 기본형이다. 대신 유틸 모양(`[-]<접두사>-[값]`)을 요구해 배열 인덱싱·정규식 문자열을 오탐하지 않게 한다.

우회 경로를 프로브 파일 하나에 담아 센 결과다 (2026-08-28, SJO-18). 정상 케이스 3건(`data-[…]:` · `[&>svg]:` · 토큰 클래스)은 세 차례 모두 오탐 0건.

| 셀렉터 | 검출 |
|---|---|
| `className` 하위로 좁힌 원안 | 6건 중 **4건** — `const X = 'gap-[7px]'`와 `{ a: 'mt-[3px]' }`를 놓친다 |
| 파일 전역 + 유틸 모양 | 6건 중 6건 |
| 〃 + 선행 하이픈 허용 | **7건 중 7건** — 음수 유틸(`-mt-[3px]`)이 그 전까지 새고 있었다 |

**세 번째 줄이 이 표의 요점이다.** "6건 중 6건"은 목록에 없는 경로를 보증하지 않는다. 프로브를 늘리는 것이 규칙을 고치는 것보다 먼저다.

**셀렉터는 자손 결합자여야 한다.** 직계 자식이면 `className="…"`만 잡고 조건부·템플릿·`cn()` 인자가 전부 빠져나가는데, 상태 분기가 있는 컴포넌트에서는 그쪽이 오히려 주 경로다. 반대로 임의 *variant*(`data-[state=open]:`·`[&>svg]:`)는 값이 아니라 선택자라 통과시킨다.

### 기각한 것

| | 왜 |
|---|---|
| `all.css`만 쓰고 Tailwind를 뺀다 | 배치(폭·간격·그리드)를 쓸 수단이 사이트 CSS뿐이 되고, 그 CSS에는 임의값을 막을 장치가 없다 |
| 사이트 `@theme`으로 DS 위에 역할 이름을 한 겹 더 건다 | 테마 소유자가 둘이 되어 DS를 올릴 때마다 매핑을 다시 맞춰야 한다. DS가 이미 semantic 이름을 준다 |
| CSS Modules·CSS-in-JS | 임의값을 막을 수단이 리뷰뿐이다 |

### 토큰 검증

2026-10-20 DS 전환으로 폐기했다. 색 대비는 scent-jo-ds 자체 테스트가 맡는다. 이 앱의 `pnpm tokens:verify`와
`scripts/src/tokens/`, 그 실측 기록(계산기 기지값·게멋 클램프·위생 검사·프로브 11건)은 git 이력
`0ea562b`에 있다.

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
| `scripts/eslint.config.mjs` | base 그대로. 파서가 치명 영역이라 린트 대상에서 빼지 않는다 |

`packages/shared`는 타입 20줄이라 설정을 두지 않는다. `scripts`는 다르다 — `08-testing.md`의 치명 영역 4종 중 추출 파서가 여기 있어 린트가 닿지 않으면 안 된다. Next 16에서 `next lint`가 제거됐으므로 각 패키지 스크립트는 `eslint .` 이다.

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

**게이트는 pre-commit 훅에 건다.** `.githooks/pre-commit`이 `prettier --check .`를 돌리고, 루트 `prepare`가 `git config core.hooksPath .githooks`로 그 훅을 심는다. 새 의존성은 없다 — husky가 하는 일이 정확히 이것이다.

SJO-6이 포맷이 깨진 파일 4개를 머지시킨 원인은 `format:check`를 **부르는 곳이 없었다는 것**이다. `lint`·`typecheck`는 turbo가, `test`는 vitest가 부르는데 format만 사람 손에 남아 있었고, 이 레포에는 CI가 없다.

| 기각한 대안 | 대가 |
|---|---|
| `/done`의 DoD에만 둔다 | 프롬프트 층이다 — 스킬을 안 따르거나 `/done`을 안 부르면 뚫린다. SJO-6이 샌 층위와 같다 |
| 훅만 두고 `/done`은 안 건드린다 | 방어선이 하나뿐이라 `--no-verify` 하나로 통째로 뚫린다 |
| GitHub Actions | 레포에 CI 축이 아예 없어 이 결정보다 크다. 브랜치 보호와 묶으면 **유일하게 우회 불가**라 나중에 다시 볼 값이 있다 |

그래서 훅(커밋 시점)과 `/done` 1단계의 공통 게이트(이슈 종료 시점)를 **둘 다** 건다. **훅만으로는 부족하다** — `pre-commit`은 `git commit` 경로에만 붙어서 무음으로 새는 자리가 넓다.

| 새는 자리 | 왜 |
|---|---|
| `git commit --no-verify` (`-n`) | git이 주는 탈출구라 막을 수 없다 |
| **`git merge`로 만든 머지 커밋** | `pre-commit`이 아예 안 불린다. **이 레포의 유일한 머지 전략이 merge commit이고**, 실제 머지는 `gh pr merge`로 **GitHub 서버**에서 일어나 훅이 존재하지도 않는다 |
| `git rebase` · `git cherry-pick` · `git revert` | 같은 이유로 안 불린다. 워크트리를 여럿 굴리는 이 레포에서 드물지 않다 |
| `pnpm install`을 한 번도 안 돌린 clone | `core.hooksPath`가 안 걸려 훅이 조용히 건너뛰어진다 |
| `pnpm install --ignore-scripts` | 돌려도 `prepare`가 안 뛴다 — **「install을 돌렸으니 훅이 걸렸다」가 성립하지 않는다** |
| `.githooks/`가 없는 커밋에 있는 워크트리 | `core.hooksPath`는 **공유 `.git/config`** 에 저장돼 워크트리 전부에 걸리지만, 디렉터리가 없으면 git이 무음으로 건너뛴다. 당사자는 자기가 무보호인 줄 모른다 |

실제로 막히는 것은 `git commit`(일반) · `git commit --amend` · squash 머지 후의 `git commit` **셋뿐이다** (2026-09-08 격리 레포 실측 — 훅을 `exit 1`로 두고 조작별로 셌다).

**머지 경로가 훅을 아예 안 타므로 `/done`의 공통 게이트가 그 경로의 유일한 방어선이다.** 훅을 「최종 방어선」으로 세지 마라.

우회 경로 7개를 이 레포에서 실제 커밋으로 재서 7개 전부가 기대와 일치했다 (막힘 2 · 통과 5, 오탐 0). 열거는 이렇다.

① 깨진 `.ts` 스테이징 후 커밋 → **막힘** ② 깨진 `.ts` 미스테이징 + 다른 커밋 → **막힘** ③ 깨끗한 트리에서 커밋 → 통과 ④ `--no-verify` → 통과 ⑤ `core.hooksPath` 미설정 → 통과 ⑥ `.prettierignore` 대상(`*.md`) 깨짐 → 통과 ⑦ `.gitignore` 대상(`data/`) 깨짐 → 통과.

⑤가 음성 대조다 — 훅을 끄면 같은 파일이 통과하므로 ①②의 「막힘」이 훅 때문임이 보인다. **다만 이 7개는 전수가 아니었다** — 머지·rebase·cherry-pick·revert·`--ignore-scripts`가 빠져 있었고 위 표는 그것을 뒤늦게 채운 것이다. 숫자만 남기고 열거를 안 적으면 다음 사람이 그 누락을 발견할 수 없다.

**스테이징된 파일만 고르지 않는다.** `--check .`로 레포 전역을 본다. 부분 스테이징일 때 인덱스가 아니라 워킹트리를 검사하게 되는 부정확함이 없고, 2.4초라 골라낼 값이 없다. 대가는 커밋과 무관한 파일이 깨져 있어도 막힌다는 것인데, 커밋 단위가 「verify를 통과한 태스크」라 그 시점에 트리가 깨져 있을 이유가 없다.

**`prepare`는 실패해도 `pnpm install`을 죽이지 않는다.** `.git`이 없는 환경에서 `git config`가 실패하면 install이 통째로 죽는데, Vercel은 소스를 tarball로 받으므로 가드가 없으면 배포가 깨진다.

가드를 `|| true` 하나로 두지 않는 이유는 **그것이 모든 실패를 구분 없이 삼키기 때문**이다. 훅이 안 걸리는데 install은 성공을 보고한다 — `exit 0`은 "통과"가 아니라 "오류 없음"이다. 그래서 `.git`의 유무를 먼저 보고, 그래도 실패하면 **훅이 안 걸렸다는 사실을 한 줄로 남긴다.**

실패 경로 4종을 실측했다 (2026-09-08): `.git` 없음 → 경고 · `.git` **디렉터리**가 읽기 전용 → 잠금 실패 후 경고 · `.git/config`가 깨짐 → 경고 · 정상 → 무음 설치. **`.git/config` 파일만 444로 두는 것은 실패 경로가 아니다** — git이 임시 파일과 rename으로 쓰기 때문에 그대로 성공한다.

```json
"prepare": "git rev-parse --git-dir > /dev/null 2>&1 && git config core.hooksPath .githooks || echo 'prepare: 커밋 훅 미설치 — git 없음 또는 config 실패'"
```

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
