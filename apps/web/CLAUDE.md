# apps/web — Next.js + Feature-Sliced Design

루트 `CLAUDE.md`와 `.claude/rules/code-conventions.md`가 먼저 적용된다. 여기엔 **이 앱에만 해당하는 것**만 적는다.

화면 명세는 `docs/02-features.md`, 디자인은 `DESIGN.md`, 이 구조를 고른 근거는 `docs/10-conventions.md`.

## 레이어 — FSD 5층

```
src/
├─ _app/       프로바이더 · 테마 · 전역 스타일 주입
├─ _pages/     화면 9개. 데이터 로드와 widget 조합만
├─ widgets/    자족적인 큰 블록 (question-runner 등)
├─ features/   사용자 상호작용 (submit-answer · filter-questions …)
└─ shared/     ui · api · lib · config · styles
```

`_app`·`_pages`의 밑줄은 Next의 `app/`·`pages/`와 충돌을 피하는 FSD 공식 권고다.

**임포트는 아래로만 흐른다.** ESLint `import/no-restricted-paths`가 강제한다.

| 이 레이어가 | 가져올 수 없는 곳 |
|---|---|
| `shared` | features · widgets · _pages · _app |
| `features` | widgets · _pages · _app |
| `widgets` | _pages · _app |
| `_pages` | _app |

**같은 층 슬라이스끼리도 import하지 않는다** (`features/filter-questions` → `features/submit-answer` 금지). 린터가 못 잡으므로 사람이 지킨다. 둘 다 필요하면 공통 조각을 `shared`로 내리거나 상위 레이어에서 조합한다.

## `app/`은 라우팅만 한다

`app/**/page.tsx`는 **re-export 한 줄**이다. 로직·fetch·useEffect를 두지 않는다.

```tsx
// app/study/page.tsx
export { StudyPage as default, metadata } from '@/_pages/study/ui/study-page'
```

**슬라이스 루트 `index.ts`를 만들지 않는다.** `@/_pages/study`로 짧게 쓰려면 배럴이 필요한데, 아래 「배럴을 만들지 않는다」가 금지하는 그것이다. 경로가 길어지는 것을 받아들인다.

`metadata`는 **화면 컴포넌트와 같은 파일**에서 내보낸다. 별도 세그먼트로 빼면 화면 하나가 두 파일로 갈리고 라우팅 파일의 re-export도 둘이 된다.

## 경로 별칭은 `@/` 하나뿐이다

`@/*` → `apps/web/src/*`. `tsconfig.json`의 `paths`에 이 한 줄만 두고 Next가 그대로 해석한다. 레이어별 별칭(`@shared/*` 등)을 따로 만들지 않는다 — 별칭이 늘면 `import/no-restricted-paths`의 zone 경로와 어긋나 경계 검사가 새어 나간다.

`app/`에서 `src/`를 가리킬 때도 같은 별칭을 쓴다 (`@/_pages/study/ui/study-page`). 상대경로 `../../src`를 쓰지 않는다.

## import 정렬은 레이어 순서를 따른다

`import/order`가 그룹 순서를 강제한다. 외부 패키지 → `@aws-study/shared` → `@/shared` → `@/features` → `@/widgets` → `@/_pages` → 상대경로. **읽는 순서가 곧 의존 방향**이라 잘못된 방향의 import가 눈에 띈다. `pnpm lint --fix`가 정렬한다.

## 배럴을 만들지 않는다

세그먼트 레벨 `index.ts` 재export를 두지 않고 **깊은 경로로 직접 import**한다.

```ts
// ✅
import { ChoiceList } from '@/shared/ui/choice/choice-list'

// ❌
import { ChoiceList } from '@/shared/ui'
```

번들 트리셰이킹과 개발 서버 속도 때문이고, FSD 공식 문서도 이 대안을 권한다.

## 슬라이스 내부 세그먼트

`ui/` (컴포넌트) · `model/` (상태·로직) · `api/` (요청) · `lib/` (순수 유틸) · `config/` (상수). 필요한 것만 만든다 — 빈 폴더를 두지 않는다.

## `'use client'`는 최말단에만

서버 컴포넌트가 기본이다. 상호작용이 필요한 **가장 작은 컴포넌트**에만 `'use client'`를 붙인다. 페이지 최상단에 붙이면 트리 전체가 클라이언트로 넘어간다.

데이터는 서버에서 병렬로 받는다 — 순차 `await` 워터폴을 만들지 않는다 (`react-best-practices` 스킬 §1).

## 스타일은 토큰만 쓴다

`DESIGN.md`가 정의한 `--sys-*` 토큰과 4dp 그리드 값만 쓴다. 임의 색·임의 간격을 쓰지 않는다. 색 역할은 `on-` 쌍으로 가져와 대비가 깨지지 않게 한다.

**Tailwind v4 유틸로 쓴다.** `src/shared/styles/tokens.css`가 `--ref-*`/`--sys-*` 계층을 소유하고, `src/shared/styles/global.css`가 `@theme inline`으로 그것을 유틸에 노출한다. 고른 이유는 `docs/10-conventions.md` 「스타일 저작」.

- **Tailwind 기본 팔레트·타입스케일·radius는 지워져 있다.** `bg-red-500`·`text-3xl`은 존재하지 않는 클래스다. 색은 역할 이름으로 부른다 — `bg-surface-container-low` · `text-on-surface-variant` · `border-outline-variant`
- **임의값 문법을 쓰지 않는다.** `p-[13px]`·`bg-[#abc]`는 린트가 막는다. 필요한 값이 토큰에 없으면 `DESIGN.md`를 먼저 고친다
- **`dark:` variant를 쓰지 않는다.** 색은 토큰 계층에서 뒤집힌다. 마크업에 다크 분기를 만들면 그 자리만 테마를 두 벌 관리하게 된다
- 타입스케일은 역할 클래스 하나가 크기·행간·굵기·자간을 다 나른다 — `text-body-large` 하나면 되고 `leading-*`·`font-*`를 덧붙이지 않는다

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
