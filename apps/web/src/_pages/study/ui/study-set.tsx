'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'

import type { AttemptResponse, ChoiceKey, IndexEntry, Manifest } from '@aws-study/shared'

import { canSubmit, CHOICE_KEYS, toggleChoice } from '@/shared/lib/choice-selection'
import { toStartIndex } from '@/shared/lib/study-cursor'
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

const SCREEN_NAME = '순차 풀이'

/**
 * 지금 보이는 세트를 순서대로 푼다.
 *
 * **커서를 `key`로 초기화하지 않고 컴포넌트째 다시 마운트한다** — 호출부가 필터를 `key`로
 * 준다. 필터가 바뀌면 세트도 시작 위치도 채점 결과도 전부 새로 시작해야 하는데, 그걸 여러
 * `useEffect`로 맞추면 하나를 빠뜨렸을 때 이전 문항의 채점 결과가 새 세트에 남는다.
 *
 * **되돌아간 문항은 `[대기]`로 연다.** 커서를 옮길 때 채점 결과와 선택을 함께 버리는 것이
 * 그것이다 — 되돌아가는 목적이 다시 푸는 것이고, 답이 이미 보이면 그게 안 된다
 * (`docs/02-features.md` 「`/study` 순차 풀이」).
 */
export function StudySet({
  apiUrl,
  manifest,
  entries,
  lastQuestionId,
  hasFilter,
  notes,
  filterAction,
  appliedChips,
  onClearFilter,
  onSubmitted,
}: {
  apiUrl: string
  manifest: Manifest
  entries: IndexEntry[]
  /** 필터 모드는 `0`이다 — 진행 위치를 저장하지 않으므로 부분집합의 처음부터다. */
  lastQuestionId: number
  hasFilter: boolean
  notes: Map<string, string>
  filterAction: ReactNode
  appliedChips: ReactNode
  onClearFilter: () => void
  /** 제출이 서버에 닿은 뒤. 호출부가 진도 캐시를 무효화해 재진입이 낡은 포인터를 안 쓴다. */
  onSubmitted: () => void
}) {
  const [cursor, setCursor] = useState(
    () =>
      toStartIndex(
        entries.map((entry) => entry.id),
        lastQuestionId,
      ) ?? entries.length,
  )
  const [selected, setSelected] = useState<ChoiceKey[]>([])
  const [graded, setGraded] = useState<AttemptResponse | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)
  const [hasSubmitFailed, setSubmitFailed] = useState(false)
  const [isHelpOpen, setHelpOpen] = useState(false)

  const entry = entries[cursor]
  const answerCount = entry?.answer.length ?? 0
  const isEmpty = entries.length === 0
  const isFinished = !isEmpty && cursor >= entries.length

  function moveTo(nextCursor: number) {
    setCursor(nextCursor)
    setSelected([])
    setGraded(null)
    setSubmitFailed(false)
  }

  function handleToggle(key: ChoiceKey) {
    if (graded || isSubmitting) return

    setSelected((current) => toggleChoice(current, key, { answerCount }))
  }

  /**
   * **제출이 도는 동안은 문항을 옮기지 않는다.** 응답을 기다리는 사이 「이전」이나 `←`로
   * 옮겨 가면 도착한 채점 결과가 **다른 문항의 카드 위에** 그려진다 — 정답 표시도 결과
   * 배너도 이전 문항 것이 된다. 「되돌아간 문항은 `[대기]`로 연다」가 그렇게 깨진다.
   *
   * 이동 경로를 전부 세어 막았다: 「이전」·「다음」 버튼은 `disabled`이거나 `graded`일 때만
   * 뜨고, `←`·`→`·`Enter`는 여기를 지난다. 남는 것은 필터 전환인데 그건 이 컴포넌트를
   * 언마운트하므로 늦게 온 `setGraded`가 아무 데도 닿지 않는다.
   */
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
        source: 'sequential',
        // 필터 모드는 전체 진도 포인터를 건드리지 않는다 (`docs/05-database.md`).
        advancesPointer: !hasFilter,
      })
      setGraded(result)
      onSubmitted()
    } catch {
      // 재전송 큐는 SJO-22다. 여기서는 화면에 남겨 다시 누를 수 있게 한다 — 즉시 채점
      // 모드는 응답이 없으면 그릴 정답이 없어 낙관적으로 진행할 수 없다. 상태 코드로
      // 가르지 않는 이유는 이 자리에 5xx·네트워크만 남기 때문이다: 403·401은 `apiFetch`가
      // 이미 처리하고 400은 정상 경로에서 나오지 않는다 (`docs/02` 「API 오류의 화면 표현」).
      setSubmitFailed(true)
    } finally {
      setSubmitting(false)
    }
  }

  useQuestionShortcuts({
    choiceKeys: entry ? CHOICE_KEYS.slice(0, entry.choiceCount) : [],
    onToggle: handleToggle,
    onSubmit: () => {
      if (graded) moveTo(cursor + 1)
      else void handleSubmit()
    },
    // 완주 화면에는 하단 액션 바가 없다. 화면에 없는 조작이 키보드로만 돌지 않게 한다.
    onPrevious: () => canMove() && !isFinished && cursor > 0 && moveTo(cursor - 1),
    onNext: () => canMove() && graded && moveTo(cursor + 1),
    onShowHelp: () => setHelpOpen(true),
  })

  // 빈 상태·완주에서는 앱바 제목에서 숫자가 빠지고 진행 바와 하단 액션 바를 그리지 않는다
  // (`DESIGN.md` 「빈 상태·완주에서 골격은 어떻게 되나」). 우측 액션은 그대로 둔다 — 필터가
  // 0건일 때 `filter_list`가 없으면 되돌릴 방법이 사라진다.
  if (isEmpty || isFinished) {
    return (
      <>
        <AppBar title={SCREEN_NAME} backHref="/" action={filterAction} />
        <div className="flex min-h-0 flex-1 flex-col">
          {/* 필터 칩은 0건일 때도 상단에 남는다 — 무엇 때문에 0건인지가 보여야 해제할지
              고칠지를 정한다. 필터가 없으면 `AppliedFilterChips`가 `null`이라 빈 줄이다. */}
          {hasFilter && <div className="px-screen pt-4">{appliedChips}</div>}
          {isEmpty ? (
            <EmptyState
              message="조건에 맞는 문제 없음"
              actions={
                <Button variant="filled" onClick={onClearFilter}>
                  필터 해제
                </Button>
              }
            />
          ) : (
            <FinishedState
              hasFilter={hasFilter}
              total={entries.length}
              onClearFilter={onClearFilter}
              onRestart={() => moveTo(0)}
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
        title={`${SCREEN_NAME} ${cursor + 1} / ${entries.length}`}
        backHref="/"
        action={filterAction}
        progress={{ current: cursor + 1, total: entries.length }}
      />

      <main className="action-bar-gutter mx-auto flex w-full max-w-reading flex-col gap-4 px-screen py-4">
        {appliedChips}
        {/* 라이브 리전은 배너보다 먼저 있어야 낭독된다 (`DESIGN.md` 「상태 배너」). */}
        <div aria-live="polite" className="contents">
          {hasSubmitFailed && <StatusBanner kind="error">답안을 저장하지 못했다</StatusBanner>}
        </div>

        <QueryBoundary
          pending={<StatusBanner kind="loading">불러오는 중…</StatusBanner>}
          // 오류 문구에 「청크」를 쓰지 않는다 — 사용자가 못 받은 것은 파일이 아니라 문제다.
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
          <Button variant="filled" onClick={() => moveTo(cursor + 1)}>
            다음
          </Button>
        ) : (
          <>
            {/* 첫 문제에서 「이전」은 비활성이고 숨기지 않는다 — 부재는 「그런 기능이 없다」를
                말하는데 되돌아가기는 이 앱에 있는 기능이다 (`DESIGN.md` 「하단 액션의 버튼 배치」). */}
            <Button
              variant="tonal"
              disabled={cursor === 0 || isSubmitting}
              onClick={() => moveTo(cursor - 1)}
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
 * 완주 화면. **전체(1019)와 부분집합은 형태가 같고 분모만 다르다** (`docs/02-features.md`
 * 「빈 상태」). 문구는 그 표에서 옮긴 것이고 새로 쓰지 않는다.
 */
function FinishedState({
  hasFilter,
  total,
  onClearFilter,
  onRestart,
}: {
  hasFilter: boolean
  total: number
  onClearFilter: () => void
  onRestart: () => void
}) {
  if (hasFilter) {
    return (
      <EmptyState
        message={`조건에 맞는 ${total}문제를 다 풀었다`}
        actions={
          <>
            <Button variant="filled" onClick={onClearFilter}>
              필터 해제
            </Button>
            <Button onClick={onRestart}>다시 풀기</Button>
          </>
        }
      />
    )
  }

  return (
    <EmptyState
      message="전체 완주"
      actions={
        <>
          <Link href="/review" className={buttonClassName('filled')}>
            오답 복습
          </Link>
          <Link href="/exam" className={buttonClassName()}>
            모의고사
          </Link>
        </>
      }
    />
  )
}
