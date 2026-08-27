---
paths:
  - "**/*.{ts,tsx,mjs}"
---

# 코드 작성 규약

루트 `CLAUDE.md`의 「어기기 쉬운 규칙」이 우선한다. 이 파일은 그 위에 얹는 **코드 레벨** 규약이고, 앱별 규칙은 `apps/web/CLAUDE.md`·`apps/api/CLAUDE.md`에 있다. 왜 이렇게 정했는지는 `docs/10-conventions.md`.

## 함수는 선언문으로 쓴다

```ts
// ✅
function gradeAttempt(selected: ChoiceKey[], answer: ChoiceKey[]): boolean { … }

// ❌
const gradeAttempt = (selected: ChoiceKey[], answer: ChoiceKey[]): boolean => { … }
```

호이스팅되어 정의 순서에 자유롭고, 스택 트레이스에 이름이 남고, `function ` 으로 검색된다. React 컴포넌트도 같다 — `export function StudyPage()`.

**화살표를 쓰는 곳** (이 셋뿐이다)

- 인자로 넘기는 익명 콜백 — `items.map((item) => item.id)`
- `useCallback`·`useMemo`가 감싸는 함수
- 즉시 넘기는 한 줄 어댑터 — `onClick={() => handleSelect(key)}`

## 이름이 무엇인지 말하게 한다

| 종류 | 접두사 | 예 |
|---|---|---|
| 불리언 — 상태 | `is` | `isCorrect` · `isSubmitting` · `isFinished` |
| 불리언 — 보유 | `has` | `hasActiveSession` · `hasPendingQueue` |
| 불리언 — 가능 | `can` | `canSubmit` · `canAdvance` |
| 불리언 — 당위 | `should` | `shouldAdvancePointer` |
| 이벤트 핸들러 (정의부) | `handle` | `handleSubmit` · `handleChoiceToggle` |
| 이벤트 핸들러 (props) | `on` | `onSubmit` · `onChoiceToggle` |
| 비동기 조회 | `fetch` · `load` | `fetchChunk` · `loadManifest` |
| 변환 | `to` · `format` | `toExamResult` · `formatAccuracy` |
| 단언 (실패 시 throw) | `assert` | `assertOwnsSession` |

핸들러는 **정의부가 `handle`, props로 넘기는 이름이 `on`** 이다. `onSubmit={handleSubmit}` 이 기본 형태다.

**부정형 이름을 쓰지 않는다.** `isNotFinished`가 아니라 `isFinished`를 두고 필요할 때 `!`를 붙인다. `!isNotFinished` 같은 이중 부정이 생기면 이름이 틀린 것이다.

## 파일과 폴더는 kebab-case

`question-runner.tsx` · `supabase-jwt.guard.ts` · `offline-queue.ts`. 파일 안의 식별자는 별개다 — 컴포넌트·클래스·타입은 `PascalCase`, 함수·변수는 `camelCase`, 상수는 `SCREAMING_SNAKE_CASE`.

파일명이 그 파일의 주된 export를 그대로 가리키게 한다. `question-runner.tsx`가 `QuestionRunner`를 내보낸다.

## export는 named를 기본으로 한다

```ts
// ✅
export function QuestionRunner() { … }

// ❌
export default function QuestionRunner() { … }
```

named export는 자동 import가 이름을 맞춰 주고, 리네임이 참조를 따라가고, 이름으로 grep이 된다.

**예외는 프레임워크가 요구하는 곳뿐이다** — Next의 `app/**/page.tsx`·`layout.tsx`·`error.tsx` 등. 그때도 구현은 named로 두고 라우팅 파일에서 이름을 붙여 내보낸다.

```tsx
// app/study/page.tsx
export { StudyPage as default, metadata } from '@/_pages/study'
```

## SSOT — 같은 사실을 두 곳에 두지 않는다

문항 수·카테고리 11종·선택지 키·API 경로 같은 값은 **한 곳에서 정의하고 import**한다. 도메인 타입은 `packages/shared`, 프론트 상수는 `apps/web/src/shared/config`, 서버 상수는 해당 모듈이 소유한다.

같은 리터럴을 **두 번째 파일에 쓰는 순간**이 상수로 뽑을 때다. 세 번째까지 기다리지 않는다 — 값이 갈라지면 조용히 틀린 결과가 나온다.

## 매직 넘버·문자열에 이름을 준다

```ts
// ✅
const EXAM_QUESTION_COUNT = 65
const TOTAL_QUESTION_COUNT = 1019
const CHUNK_SIZE = 100

// ❌
if (questionIds.length !== 65) …
```

**예외**: 배열 인덱스 `0`·증감 `1`·백분율 `100`처럼 문맥에서 자명한 값.

## early return으로 중첩을 없앤다

가드 절을 먼저 쓰고 본문은 왼쪽에 붙인다. **중첩 3단계를 넘기지 않는다.**

```ts
// ✅
function submitAttempt(input: AttemptInput) {
  if (!input.sessionId) throw new BadRequestException('sessionId required')
  if (session.finishedAt) throw new ConflictException('session already finished')

  return recordAttempt(input)
}
```

`else` 블록 안이 `return`뿐이면 `else`를 지운다.

## helper는 이름이 붙을 때만 뽑는다

정확한 이름을 못 붙이겠으면 뽑지 않는다 — `processData`·`handleStuff`는 안 뽑은 것만 못하다. 아래 중 **둘 이상**이면 뽑는다.

1. 두 곳 이상에서 쓰인다
2. 이름이 본문보다 짧고 정확하다
3. 따로 테스트하고 싶다

한 번만 쓰이는 3줄은 인라인이 낫다.

## 에러를 삼키지 않는다

빈 `catch` 금지. 잡았으면 **처리하거나 다시 던진다.** 폴백 값을 반환한다면 왜 그게 안전한지 주석 한 줄을 남긴다.

```ts
// ❌
try { await saveAttempt(input) } catch {}

// ✅ — 큐가 나중에 재전송한다 (docs/02 「장애 및 오류 처리」)
try {
  await saveAttempt(input)
} catch (error) {
  if (!isNetworkError(error)) throw error
  enqueueAttempt(input)
}
```

## 타입

- **`any` 금지.** 모르면 `unknown`으로 받고 좁힌다
- 반환 타입은 **export 경계에만** 명시한다. 모듈 내부 함수는 추론에 맡긴다
- 타입 단언(`as`)은 좁히기가 불가능할 때만 쓰고 왜 안전한지 주석을 남긴다

## 불리언 파라미터를 받지 않는다

```ts
// ❌ — 호출부에서 true가 무엇인지 안 보인다
renderQuestion(question, true)

// ✅
renderQuestion(question, { revealsAnswer: true })
```
