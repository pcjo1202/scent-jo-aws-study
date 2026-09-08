'use client'

import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { ChoiceKey } from '@aws-study/shared'

import { ApiError } from '@/shared/api/api-client'
import { manifestQuery, oneLinersQuery, questionIndexQuery } from '@/shared/api/cdn'
import { examKeys, examQuery } from '@/shared/api/exams'
import { CHOICE_KEYS, toggleChoice } from '@/shared/lib/choice-selection'
import { useQuestionShortcuts } from '@/shared/lib/use-question-shortcuts'
import { ActionBar } from '@/shared/ui/action-bar'
import { AppBar } from '@/shared/ui/app-bar'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { QueryBoundary } from '@/shared/ui/query-boundary'
import { MaterialSymbol } from '@/shared/ui/icon/material-symbol'
import { ShortcutHelp } from '@/shared/ui/shortcut-help'
import { StatusBanner } from '@/shared/ui/status-banner'

import { deleteExam } from '@/features/manage-exam/api/delete-exam'
import { finishExam } from '@/features/manage-exam/api/finish-exam'
import { saveCursor } from '@/features/navigate-exam/api/save-cursor'
import { QuestionGrid } from '@/features/navigate-exam/ui/question-grid'
import { submitExamAttempt } from '@/features/submit-answer/api/submit-exam-attempt'

import { QuestionSlot } from '@/widgets/question-runner/ui/question-slot'

import { createSaveQueue } from '../lib/save-queue'

const SCREEN_NAME = '모의고사'

const CONFLICT = 409

const FAILURE_MESSAGE = {
  cursor: '진행 위치를 저장하지 못했다',
  finish: '모의고사를 종료하지 못했다',
  abandon: '모의고사를 포기하지 못했다',
} as const

type Failure = keyof typeof FAILURE_MESSAGE

/**
 * 65문항을 **정오를 모른 채** 푼다 (`docs/02-features.md` 「진행」).
 *
 * 정오를 숨기는 것은 새 부품이 아니라 `graded`에 `null`을 계속 넘기는 것이다 — 같은
 * `QuestionRunner`를 세 화면이 쓰고 채점 시점만 다르다 (「공통: 문제 풀이 컴포넌트」).
 *
 * **위치도 답도 서버가 원본이다.** 화면에 들어올 때 서버 값으로 시작하고, 옮길 때마다 `PATCH`로
 * 위치를, 고를 때마다 `POST /attempts`로 답을 보낸다. 그래야 PC에서 시작한 세션을 폰이 그대로
 * 이어받는다.
 *
 * **되는 것은 「들어올 때」까지다.** 커서·답은 마운트 시점의 서버 값으로 초기화하고 그 뒤의
 * 재조회를 따라가지 않는다 — 화면을 보는 동안 다른 기기가 옮긴 위치는 반영되지 않고, 같은
 * 브라우저에서 캐시가 살아 있는 채로 되돌아오면 그 값으로 선다. 두 기기를 동시에 여는 것을
 * 막지 않기로 한 정책(`docs/02` 「기기 간 동기화 정책」 — 마지막 답이 남는다) 안에서는 손해가
 * 「화면이 조금 낡는다」뿐이라 여기서 동기화를 만들지 않는다.
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
  /**
   * **저장 실패는 문항별로 센다.** 하나로 두면 5번 저장이 실패한 뒤 6번이 성공할 때 배너가
   * 지워져, 채점에 안 들어갈 답이 저장된 것처럼 보인다. 재전송 큐는 SJO-22 소관이고 여기서는
   * 「무엇이 저장 안 됐는지」를 잃지 않는 것까지 한다.
   */
  const [unsavedIds, setUnsavedIds] = useState<number[]>([])
  const [failure, setFailure] = useState<Failure | null>(null)
  const [isFinishOpen, setFinishOpen] = useState(false)
  const [isStaleContentOpen, setStaleContentOpen] = useState(false)
  const [isFinishing, setFinishing] = useState(false)
  const [isHelpOpen, setHelpOpen] = useState(false)
  const [isGridOpen, setGridOpen] = useState(false)

  const enqueueRef = useRef(createSaveQueue())

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

  /**
   * **409는 이 세션이 이미 끝났다는 뜻이다** — 다른 기기가 종료했다. api가 종료된 세션의 답안
   * 제출을 잠금으로 막으므로(SJO-53) 이제 확정적으로 온다. 저장 실패로 표시하지 않고 서버
   * 상태를 다시 읽어 「이미 종료된 모의고사다」로 넘긴다.
   */
  function handleConflict() {
    void queryClient.invalidateQueries({ queryKey: examKeys.detail(apiUrl, sessionId) })
  }

  function isConflict(error: unknown) {
    return error instanceof ApiError && error.status === CONFLICT
  }

  function moveTo(nextCursor: number) {
    if (nextCursor < 0 || nextCursor >= total || nextCursor === cursor || isFinishing) return

    setCursor(nextCursor)
    enqueueRef
      .current(() => saveCursor(apiUrl, sessionId, nextCursor))
      .then(
        () => setFailure((current) => (current === 'cursor' ? null : current)),
        (error: unknown) => (isConflict(error) ? handleConflict() : setFailure('cursor')),
      )
  }

  /**
   * 답은 고르는 즉시 서버로 간다 — 제출 버튼이 없고 마지막 답이 채점 대상이다.
   *
   * **마지막 하나는 해제되지 않는다.** 빈 배열은 계약이 거절하고(`@ArrayMinSize(1)`), 거절된
   * 사이 서버에는 옛 답이 남아 화면과 갈린다. 답을 바꾸려면 다른 선택지를 누른다 — 「미응답으로
   * 되돌리기」는 계약을 넓혀야 하는 별도 이슈다 (`docs/02` 「진행」).
   */
  function handleToggle(key: ChoiceKey) {
    if (!entry || isFinishing) return

    const next = toggleChoice(selected, key, { answerCount: entry.answer.length })
    if (next.length === 0) return

    const answeredId = entry.id
    setAnswers((current) => ({ ...current, [answeredId]: next }))
    enqueueRef
      .current(() => submitExamAttempt(apiUrl, sessionId, answeredId, next))
      .then(
        () => setUnsavedIds((ids) => ids.filter((id) => id !== answeredId)),
        (error: unknown) => {
          if (isConflict(error)) return handleConflict()

          setUnsavedIds((ids) => (ids.includes(answeredId) ? ids : [...ids, answeredId]))
        },
      )
  }

  /**
   * **보낸 답이 먼저 닿은 뒤에 채점한다.** 큐를 기다리지 않으면 마지막에 고른 답이 채점에서
   * 빠진다. 기다리는 것은 **순서**이지 성공이 아니므로, 저장 못 한 답이 있으면 종료 전에
   * 다이얼로그가 그 수를 말한다.
   *
   * `try`는 `finishExam` 한 줄만 감싼다 — 캐시 무효화나 이동이 던졌다고 「종료하지 못했다」를
   * 띄우면, 이미 끝난 세션에 재시도를 유도해 영영 409를 받게 된다.
   *
   * **409는 두 가지인데 오류에는 `status`뿐이다** — 「이미 종료된 세션」과 「`content_version`
   * 불일치」다 (`docs/05` 「오류 응답」). 예외 메시지 문자열로 가르지 않고 **서버 상태를 다시
   * 읽어** `finishedAt`으로 판정한다: 채워져 있으면 다른 기기가 먼저 끝낸 것이라 결과 화면으로
   * 가고, 비어 있으면 채점 자체가 거절된 것이라 포기만 남는다
   * (`docs/02` 「API 오류의 화면 표현」).
   */
  async function handleFinish() {
    setFinishOpen(false)
    setFinishing(true)

    await enqueueRef.current(() => Promise.resolve()).catch(() => undefined)

    try {
      await finishExam(apiUrl, sessionId)
    } catch (error) {
      if (!isConflict(error)) {
        setFailure('finish')
        setFinishing(false)
        return
      }

      if (!(await isFinishedOnServer())) {
        setStaleContentOpen(true)
        setFinishing(false)
        return
      }
    }

    await queryClient.invalidateQueries({ queryKey: examKeys.all })
    router.replace(`/exam/${sessionId}/result`)
  }

  /**
   * 409를 받은 뒤 서버가 이 세션을 종료로 보는지 다시 읽는다. **재조회가 실패하면 종료로 치지
   * 않는다** — 못 읽은 것을 「끝났다」로 읽으면 채점되지 않은 세션을 결과 화면으로 보내고,
   * 그 화면은 `results`가 없어 다시 여기로 되돌린다.
   */
  async function isFinishedOnServer() {
    try {
      const latest = await queryClient.fetchQuery(examQuery(apiUrl, sessionId))

      return latest.finishedAt !== null
    } catch {
      return false
    }
  }

  /** 포기하면 세션과 답안이 사라진다. 채점할 수 없는 세션에 남은 경로는 이것뿐이다. */
  async function handleAbandonStale() {
    setStaleContentOpen(false)
    try {
      await deleteExam(apiUrl, sessionId)
    } catch {
      setFailure('abandon')
      return
    }

    await queryClient.invalidateQueries({ queryKey: examKeys.all })
    router.replace('/exam')
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
   * 종료된 세션을 이 경로로 열면 풀 것이 없다 — 결과 화면으로 보낸다. 세션 하나는 언제나
   * 여기와 `/exam/[id]/result` 중 정확히 하나에서만 열리고, 반대 방향은 `ExamResultScreen`이
   * 맡는다 (`docs/02` 「결과 화면의 구성」).
   *
   * **이 분기가 다른 기기의 종료를 받는 자리이기도 하다** — `handleConflict`가 세션을 다시 읽고
   * 그 결과 `finishedAt`이 채워지면 여기로 온다 (SJO-53 이후 답안 제출 409가 확정적이다).
   */
  const isFinished = session.finishedAt !== null

  useEffect(() => {
    if (isFinished) router.replace(`/exam/${sessionId}/result`)
  }, [isFinished, router, sessionId])

  if (isFinished) return null

  if (!entry) {
    throw new Error(`인덱스에 문항 ${String(questionId)}이 없다`)
  }

  return (
    <>
      <AppBar
        title={`${SCREEN_NAME} ${cursor + 1} / ${total}`}
        backHref="/exam"
        progress={{ current: cursor + 1, total }}
        action={
          <button
            type="button"
            aria-label="문제 이동"
            onClick={() => setGridOpen(true)}
            className="state-layer flex size-12 items-center justify-center rounded-corner-full expanded:hidden"
          >
            <MaterialSymbol name="grid_view" />
          </button>
        }
      />

      <div className="app-bar-gutter-top flex min-h-dvh expanded:flex-row">
        <QuestionGrid
          questionIds={session.questionIds}
          answers={answers}
          cursor={cursor}
          isOpen={isGridOpen}
          onClose={() => setGridOpen(false)}
          onJump={moveTo}
        />

        <main className="action-bar-gutter mx-auto flex w-full min-w-0 max-w-reading flex-1 flex-col gap-4 px-screen py-4">
          {/*
            라이브 리전은 **배너보다 먼저** DOM에 있어야 낭독된다 (`DESIGN.md` 「상태 배너」).
            `contents`를 쓰는 이유는 이 자리가 flex 항목이라 빈 컨테이너가 gap 하나를 만들기
            때문이다 — 최신 Chrome·Safari는 `display: contents` 요소를 접근성 트리에 노출한다
            (`docs/01` 「운영 환경」의 브라우저 전제).
          */}
          <div aria-live="polite" className="contents">
            {unsavedIds.length > 0 && (
              <StatusBanner kind="error">
                답안을 저장하지 못했다 · {unsavedIds.length}문제
              </StatusBanner>
            )}
            {failure && <StatusBanner kind="error">{FAILURE_MESSAGE[failure]}</StatusBanner>}
          </div>

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
      </div>

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
        description={
          unsavedIds.length > 0
            ? `미응답 문제는 오답으로 채점된다. 저장하지 못한 답 ${unsavedIds.length}문제도 채점에 들어가지 않는다.`
            : '미응답 문제는 오답으로 채점된다. 종료한 세션은 다시 풀 수 없다.'
        }
        confirmLabel="종료"
        onConfirm={() => void handleFinish()}
        onCancel={() => setFinishOpen(false)}
      />

      {/*
        `content_version` 409. **채점하지 않고 포기만 제공한다** (`docs/02` 「API 오류의 화면
        표현」) — 이 세션의 정답표가 더는 존재하지 않아 어떤 점수를 내도 근거가 없다.
        65문항을 통째로 잃는 유일한 경로이고, v1은 데이터를 새 버전으로 올리기 전에 진행 중
        세션이 없는지 확인해 운영으로 회피한다.
      */}
      <ConfirmDialog
        isOpen={isStaleContentOpen}
        title="이 모의고사는 채점할 수 없다"
        description="문제 데이터가 갱신되어 이 세션의 정답을 확인할 수 없다. 포기하면 세션과 지금까지 고른 답이 사라진다."
        confirmLabel="포기"
        onConfirm={() => void handleAbandonStale()}
        onCancel={() => setStaleContentOpen(false)}
      />
      <ShortcutHelp isOpen={isHelpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}
