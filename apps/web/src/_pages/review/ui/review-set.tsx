'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'

import type { AttemptResponse, ChoiceKey, IndexEntry, Manifest } from '@aws-study/shared'

import { canSubmit, CHOICE_KEYS, toggleChoice } from '@/shared/lib/choice-selection'
import { useQuestionShortcuts } from '@/shared/lib/use-question-shortcuts'
import { ActionBar } from '@/shared/ui/action-bar'
import { AppBar } from '@/shared/ui/app-bar'
import { Button, buttonClassName } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { QueryBoundary } from '@/shared/ui/query-boundary'
import { ShortcutHelp } from '@/shared/ui/shortcut-help'
import { StatusBanner } from '@/shared/ui/status-banner'

import { submitAttempt } from '@/features/submit-answer/api/submit-attempt'

import { QuestionSlot } from '@/widgets/question-runner/ui/question-slot'

import { hasRemainingWrong } from '../lib/review-round'

const SCREEN_NAME = '오답 복습'

/**
 * 고정된 오답 세트를 순서대로 푼다. 진행·채점·되돌아가기 규칙은 `/study`와 같고
 * (`docs/02-features.md` 「모드별 차이」가 둘을 같은 즉시 채점 모드로 둔다), 다른 것은 셋이다.
 *
 * 1. **시작 위치가 언제나 세트의 처음이다** — 진도 포인터를 읽지 않는다
 * 2. **제출의 `source`가 `review`다** — `advancesPointer`는 `sequential` 전용이라 보내지 않는다
 *    (`docs/05-database.md` 「POST /attempts」)
 * 3. **완주 화면이 이번 회차 점수를 준다** — 「M문제 중 N문제 정답」
 *
 * 점수를 **문항 id별 정오 기록**으로 세는 이유는 「이전」으로 되돌아가 다시 풀 수 있기
 * 때문이다. 카운터를 올리면 같은 문항이 두 번 세어져 `N`이 `M`을 넘는다.
 */
export function ReviewSet({
  apiUrl,
  manifest,
  entries,
  hasFilter,
  notes,
  filterAction,
  appliedChips,
  onClearFilter,
  onRestart,
  onSubmitted,
}: {
  apiUrl: string
  manifest: Manifest
  entries: IndexEntry[]
  hasFilter: boolean
  notes: Map<string, string>
  filterAction: ReactNode
  appliedChips: ReactNode
  onClearFilter: () => void
  /** 세트를 새로 고정한다 — 호출부가 오답 목록을 무효화하고 이 컴포넌트를 다시 마운트한다. */
  onRestart: () => void
  /** 제출이 서버에 닿은 뒤. 호출부가 진도 캐시를 무효화한다. */
  onSubmitted: () => void
}) {
  const [position, setPosition] = useState(0)
  const [selected, setSelected] = useState<ChoiceKey[]>([])
  const [graded, setGraded] = useState<AttemptResponse | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)
  const [hasSubmitFailed, setSubmitFailed] = useState(false)
  const [isHelpOpen, setHelpOpen] = useState(false)
  const [roundResults, setRoundResults] = useState<Record<number, boolean>>({})

  const entry = entries[position]
  const answerCount = entry?.answer.length ?? 0
  const isEmpty = entries.length === 0
  const isFinished = !isEmpty && position >= entries.length
  // **분자와 분모가 같은 세트에서 나온다는 전제가 `entries` 고정에 걸려 있다.** 세트가
  // 마운트 중에 줄면 사라진 문항의 정답이 계속 세어져 `N`이 `M`을 넘는다 — 고정을 지키는
  // 것은 `wrongQuestionsQuery`의 재조회 차단과 호출부의 `key`다.
  const correctCount = Object.values(roundResults).filter(Boolean).length

  function moveTo(nextPosition: number) {
    setPosition(nextPosition)
    setSelected([])
    setGraded(null)
    setSubmitFailed(false)
  }

  function handleToggle(key: ChoiceKey) {
    if (graded || isSubmitting) return

    setSelected((current) => toggleChoice(current, key, { answerCount }))
  }

  /** 제출이 도는 동안 문항을 옮기지 않는다 — 이유는 `/study`의 `StudySet`과 같다. */
  function canMove() {
    return !isSubmitting
  }

  async function handleSubmit() {
    if (!entry || graded || isSubmitting || !canSubmit(selected, { answerCount })) return

    setSubmitting(true)
    setSubmitFailed(false)
    try {
      const result = await submitAttempt(apiUrl, {
        questionId: entry.id,
        selected,
        source: 'review',
      })
      setGraded(result)
      setRoundResults((current) => ({ ...current, [entry.id]: result.isCorrect }))
      onSubmitted()
    } catch {
      // 상태 코드로 가르지 않고 배너 하나로 받는 이유는 `/study`의 `StudySet`과 같다 —
      // 즉시 채점 모드라 낙관적으로 진행할 수 없고(화면에 그릴 정답이 응답에만 있다),
      // 사용자가 할 일은 어느 실패든 다시 제출하는 것 하나다.
      setSubmitFailed(true)
    } finally {
      setSubmitting(false)
    }
  }

  useQuestionShortcuts({
    choiceKeys: entry ? CHOICE_KEYS.slice(0, entry.choiceCount) : [],
    onToggle: handleToggle,
    onSubmit: () => {
      if (graded) moveTo(position + 1)
      else void handleSubmit()
    },
    onPrevious: () => canMove() && !isFinished && position > 0 && moveTo(position - 1),
    onNext: () => canMove() && graded && moveTo(position + 1),
    onShowHelp: () => setHelpOpen(true),
  })

  if (isEmpty || isFinished) {
    return (
      <>
        <AppBar title={SCREEN_NAME} backHref="/" action={filterAction} />
        <div className="flex min-h-0 flex-1 flex-col">
          {hasFilter && <div className="px-screen pt-4">{appliedChips}</div>}
          {isEmpty ? (
            <EmptySetState hasFilter={hasFilter} onClearFilter={onClearFilter} />
          ) : (
            <FinishedState
              total={entries.length}
              correctCount={correctCount}
              hasFilter={hasFilter}
              onRestart={onRestart}
            />
          )}
        </div>
      </>
    )
  }

  const isSubmittable = canSubmit(selected, { answerCount })

  return (
    <>
      <AppBar
        title={`${SCREEN_NAME} ${position + 1} / ${entries.length}`}
        backHref="/"
        action={filterAction}
        progress={{ current: position + 1, total: entries.length }}
      />

      <main className="action-bar-gutter mx-auto flex w-full max-w-reading flex-col gap-4 px-screen py-4">
        {appliedChips}
        <div aria-live="polite" className="contents">
          {hasSubmitFailed && <StatusBanner kind="error">답안을 저장하지 못했다</StatusBanner>}
        </div>

        <QueryBoundary
          pending={<StatusBanner kind="loading">불러오는 중…</StatusBanner>}
          errorMessage="이 부분의 문제를 불러오지 못했다"
          canRetry
        >
          {entry && (
            <QuestionSlot
              manifest={manifest}
              entry={entry}
              selected={selected}
              onToggle={handleToggle}
              graded={graded}
              notes={notes}
            />
          )}
        </QueryBoundary>
      </main>

      <ActionBar>
        {graded ? (
          <Button variant="filled" onClick={() => moveTo(position + 1)}>
            다음
          </Button>
        ) : (
          <>
            <Button
              variant="tonal"
              disabled={position === 0 || isSubmitting}
              onClick={() => moveTo(position - 1)}
            >
              이전
            </Button>
            <Button
              variant="filled"
              disabled={!isSubmittable || isSubmitting}
              onClick={() => void handleSubmit()}
            >
              제출
            </Button>
          </>
        )}
      </ActionBar>

      <ShortcutHelp isOpen={isHelpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}

/**
 * 세트가 0건일 때. **두 경우를 가른다** (`docs/02-features.md` 「빈 상태」의 `/review` 두 행).
 * 필터 때문에 0건인데 「복습할 오답이 없다」를 쓰면 오답이 남아 있는데 없다고 말하게 된다.
 */
function EmptySetState({
  hasFilter,
  onClearFilter,
}: {
  hasFilter: boolean
  onClearFilter: () => void
}) {
  if (hasFilter) {
    return (
      <EmptyState
        message="조건에 맞는 문제 없음"
        actions={
          <Button variant="filled" onClick={onClearFilter}>
            필터 해제
          </Button>
        }
      />
    )
  }

  return <NoWrongState />
}

/** 오답이 하나도 없다. **실패가 아니므로 경고 색을 쓰지 않는다** (`DESIGN.md` 「빈 상태」). */
function NoWrongState() {
  return (
    <EmptyState
      message="복습할 오답이 없다"
      actions={
        <Link href="/study" className={buttonClassName('filled')}>
          순차 풀이
        </Link>
      }
    />
  )
}

/**
 * 완주 화면. 문구는 `docs/02-features.md` 「빈 상태」에서 옮긴 것이고 새로 쓰지 않는다.
 *
 * 남은 오답이 0건이면 「복습할 오답이 없다」와 같은 화면이다 — 그 판정은
 * `hasRemainingWrong`이 하고, 필터가 걸렸을 때 세트 밖을 모른다는 것도 거기 적혀 있다.
 */
function FinishedState({
  total,
  correctCount,
  hasFilter,
  onRestart,
}: {
  total: number
  correctCount: number
  hasFilter: boolean
  onRestart: () => void
}) {
  if (!hasRemainingWrong({ total, correctCount, hasFilter })) {
    return <NoWrongState />
  }

  return (
    <EmptyState
      message={`${total}문제 중 ${correctCount}문제 정답`}
      actions={
        <>
          <Button variant="filled" onClick={onRestart}>
            다시 풀기
          </Button>
          <Link href="/study" className={buttonClassName()}>
            순차 풀이
          </Link>
        </>
      }
    />
  )
}
