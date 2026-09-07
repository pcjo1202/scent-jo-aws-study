'use client'

import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'

import type { ChoiceKey } from '@aws-study/shared'

import { manifestQuery, oneLinersQuery, questionIndexQuery } from '@/shared/api/cdn'
import { examKeys, examQuery } from '@/shared/api/exams'
import { CHOICE_KEYS, toggleChoice } from '@/shared/lib/choice-selection'
import { useQuestionShortcuts } from '@/shared/lib/use-question-shortcuts'
import { ActionBar } from '@/shared/ui/action-bar'
import { AppBar } from '@/shared/ui/app-bar'
import { Button, buttonClassName } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { EmptyState } from '@/shared/ui/empty-state'
import { QueryBoundary } from '@/shared/ui/query-boundary'
import { ShortcutHelp } from '@/shared/ui/shortcut-help'
import { StatusBanner } from '@/shared/ui/status-banner'

import { finishExam } from '@/features/manage-exam/api/finish-exam'
import { saveCursor } from '@/features/navigate-exam/api/save-cursor'
import { submitExamAttempt } from '@/features/submit-answer/api/submit-exam-attempt'

import { QuestionSlot } from '@/widgets/question-runner/ui/question-slot'

const SCREEN_NAME = '모의고사'

const FAILURE_MESSAGE = {
  answer: '답안을 저장하지 못했다',
  cursor: '진행 위치를 저장하지 못했다',
  finish: '모의고사를 종료하지 못했다',
} as const

type Failure = keyof typeof FAILURE_MESSAGE

/**
 * 65문항을 **정오를 모른 채** 푼다 (`docs/02-features.md` 「진행」).
 *
 * 정오를 숨기는 것은 새 부품이 아니라 `graded`에 `null`을 계속 넘기는 것이다 — 같은
 * `QuestionRunner`를 세 화면이 쓰고 채점 시점만 다르다 (「공통: 문제 풀이 컴포넌트」).
 *
 * **위치도 답도 서버가 원본이다.** 화면에 들어올 때 서버 값으로 시작하고(캐시를 안 쓴다),
 * 옮길 때마다 `PATCH`로 위치를, 고를 때마다 `POST /attempts`로 답을 보낸다. 그래야 PC에서
 * 시작한 세션을 폰이 그대로 이어받는다.
 */
export function ExamSessionScreen({ apiUrl, sessionId }: { apiUrl: string; sessionId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: session } = useSuspenseQuery(examQuery(apiUrl, sessionId))
  const { data: manifest } = useSuspenseQuery(manifestQuery())
  const { data: index } = useSuspenseQuery(questionIndexQuery(manifest))
  const { data: oneLiners } = useSuspenseQuery(oneLinersQuery(manifest))

  const [cursor, setCursor] = useState(() =>
    Math.min(Math.max(session.cursor, 0), session.questionIds.length - 1),
  )
  const [answers, setAnswers] = useState<Record<number, ChoiceKey[]>>(session.answers)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [isFinishOpen, setFinishOpen] = useState(false)
  const [isFinishing, setFinishing] = useState(false)
  const [isHelpOpen, setHelpOpen] = useState(false)

  /**
   * 저장 요청을 **한 줄로 세운다.** 복수정답 문항에서 연달아 고르면 `[A]`와 `[A, B]`가 거의
   * 동시에 나가는데, 뒤엣것이 먼저 커밋되면 마지막 답이 `[A]`로 남아 **채점 대상이 뒤집힌다.**
   * 순서를 지키는 비용이 요청 하나를 기다리는 것뿐이라 낙관적 UI는 그대로 유지된다.
   */
  const pendingRef = useRef<Promise<unknown>>(Promise.resolve())

  const entriesById = useMemo(
    () => new Map(index.entries.map((entry) => [entry.id, entry])),
    [index],
  )
  const notes = useMemo(
    () => new Map(oneLiners.items.map((item) => [item.service, item.note])),
    [oneLiners],
  )

  const total = session.questionIds.length
  const questionId = session.questionIds[cursor]
  const entry = questionId === undefined ? undefined : entriesById.get(questionId)
  const selected = questionId === undefined ? [] : (answers[questionId] ?? [])
  const isLast = cursor === total - 1

  function enqueue(run: () => Promise<unknown>, kind: Failure) {
    pendingRef.current = pendingRef.current
      .catch(() => undefined)
      .then(run)
      .then(
        () => setFailure((current) => (current === kind ? null : current)),
        () => setFailure(kind),
      )

    return pendingRef.current
  }

  function moveTo(nextCursor: number) {
    if (nextCursor < 0 || nextCursor >= total || nextCursor === cursor) return

    setCursor(nextCursor)
    void enqueue(() => saveCursor(apiUrl, sessionId, nextCursor), 'cursor')
  }

  /** 답은 고르는 즉시 서버로 간다 — 제출 버튼이 없고 마지막 답이 채점 대상이다. */
  function handleToggle(key: ChoiceKey) {
    if (!entry || isFinishing) return

    const next = toggleChoice(selected, key, { answerCount: entry.answer.length })
    setAnswers((current) => ({ ...current, [entry.id]: next }))
    void enqueue(() => submitExamAttempt(apiUrl, sessionId, entry.id, next), 'answer')
  }

  /**
   * **보낸 답이 먼저 닿은 뒤에 채점한다.** 대기 중인 저장을 기다리지 않으면 마지막에 고른 답이
   * 채점에서 빠진다. 서버 쪽 경합(`finish`가 읽는 시점과 `POST /attempts` 커밋이 교차하는
   * 것)은 SJO-53이 따로 고친다 — 여기서 할 수 있는 것은 내 요청을 먼저 보내는 것까지다.
   */
  async function handleFinish() {
    setFinishOpen(false)
    setFinishing(true)
    try {
      await pendingRef.current.catch(() => undefined)
      await finishExam(apiUrl, sessionId)
      await queryClient.invalidateQueries({ queryKey: examKeys.all })
      // SJO-24가 `/exam/${sessionId}/result`로 바꾼다. 그 화면이 아직 없어 목록으로 돌려보낸다.
      router.replace('/exam')
    } catch {
      setFailure('finish')
      setFinishing(false)
    }
  }

  useQuestionShortcuts({
    choiceKeys: entry ? CHOICE_KEYS.slice(0, entry.choiceCount) : [],
    onToggle: handleToggle,
    // 「다음」이 마지막에서 「종료」가 되므로 `Enter`도 같은 자리를 누른다.
    onSubmit: () => (isLast ? setFinishOpen(true) : moveTo(cursor + 1)),
    onPrevious: () => moveTo(cursor - 1),
    onNext: () => moveTo(cursor + 1),
    onShowHelp: () => setHelpOpen(true),
  })

  /**
   * 종료된 세션을 이 경로로 열면 풀 것이 없다. **결과 화면으로 보내는 것은 SJO-24 소관**이라
   * 지금은 목록으로 되돌린다 (`docs/02` 「종료 / 결과」).
   */
  if (session.finishedAt !== null) {
    return (
      <>
        <AppBar title={SCREEN_NAME} backHref="/exam" />
        <div className="app-bar-gutter-top flex min-h-dvh flex-col">
          <EmptyState
            message="이미 종료된 모의고사다"
            actions={
              <Link href="/exam" className={buttonClassName('filled')}>
                모의고사 목록
              </Link>
            }
          />
        </div>
      </>
    )
  }

  if (!entry) {
    throw new Error(`인덱스에 문항 ${String(questionId)}이 없다`)
  }

  return (
    <>
      <AppBar
        title={`${SCREEN_NAME} ${cursor + 1} / ${total}`}
        backHref="/exam"
        progress={{ current: cursor + 1, total }}
      />

      <main className="app-bar-gutter-top action-bar-gutter mx-auto flex w-full max-w-reading flex-col gap-4 px-screen py-4">
        {failure && <StatusBanner kind="error">{FAILURE_MESSAGE[failure]}</StatusBanner>}

        <QueryBoundary
          pending={<StatusBanner kind="loading">불러오는 중…</StatusBanner>}
          errorMessage="이 부분의 문제를 불러오지 못했다"
          canRetry
        >
          <QuestionSlot
            manifest={manifest}
            entry={entry}
            selected={selected}
            onToggle={handleToggle}
            graded={null}
            notes={notes}
          />
        </QueryBoundary>
      </main>

      <ActionBar>
        {/* 마지막 문항에서는 주 버튼이 「종료」가 되므로 보조 「종료」를 뺀다 —
            같은 라벨을 한 바에 둘 두지 않는다 (`DESIGN.md` 「하단 액션의 버튼 배치」). */}
        {!isLast && (
          <Button variant="tonal" disabled={isFinishing} onClick={() => setFinishOpen(true)}>
            종료
          </Button>
        )}
        <Button variant="tonal" disabled={cursor === 0} onClick={() => moveTo(cursor - 1)}>
          이전
        </Button>
        {isLast ? (
          <Button variant="filled" disabled={isFinishing} onClick={() => setFinishOpen(true)}>
            종료
          </Button>
        ) : (
          // 답을 고르지 않아도 넘어간다 — 미응답이 허용되고 건너뛴 뒤 돌아올 수 있어야 한다.
          <Button variant="filled" onClick={() => moveTo(cursor + 1)}>
            다음
          </Button>
        )}
      </ActionBar>

      <ConfirmDialog
        isOpen={isFinishOpen}
        title="모의고사를 종료한다"
        description="미응답 문항은 오답으로 채점된다. 종료한 세션은 다시 풀 수 없다."
        confirmLabel="종료"
        onConfirm={() => void handleFinish()}
        onCancel={() => setFinishOpen(false)}
      />
      <ShortcutHelp isOpen={isHelpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}
