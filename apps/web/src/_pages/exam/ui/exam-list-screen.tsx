'use client'

import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { ExamSessionSummary } from '@aws-study/shared'

import { ApiError } from '@/shared/api/api-client'
import { examKeys, examsQuery } from '@/shared/api/exams'
import { EXAM_QUESTION_COUNT } from '@/shared/config/exam'
import { ActionBar } from '@/shared/ui/action-bar'
import { AppBar } from '@/shared/ui/app-bar'
import { Button, buttonClassName } from '@/shared/ui/button'
import { Chip } from '@/shared/ui/chip'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { EmptyState } from '@/shared/ui/empty-state'
import { StatusBanner } from '@/shared/ui/status-banner'

import { createExam } from '@/features/manage-exam/api/create-exam'
import { deleteExam } from '@/features/manage-exam/api/delete-exam'

import { formatSessionDate } from '../lib/format-session-date'

const CONFLICT = 409

/** 실패는 문구가 다르므로 하나로 뭉치지 않는다 (`DESIGN.md` 「오류 문구에 기술 문자열을 넣지 않는다」). */
const FAILURE_MESSAGE = {
  create: '모의고사를 시작하지 못했다',
  conflict: '진행 중인 모의고사가 있다',
  delete: '진행 중인 모의고사를 포기하지 못했다',
} as const

type Failure = keyof typeof FAILURE_MESSAGE

/**
 * 세션 목록·새 세션 시작·이어가기/포기 (`docs/02-features.md` 「목록 화면」).
 *
 * **진행 중 세션이 있어도 「새 모의고사 시작」을 비활성으로 두지 않는다.** 세션의 단일 원본이
 * 서버라 목록으로 내린 판정은 다른 기기 때문에 틀릴 수 있다 — 눌러서 409를 받으면 목록을 다시
 * 읽고, 이어가기/포기는 그때 서는 카드가 준다.
 */
export function ExamListScreen({ apiUrl }: { apiUrl: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(examsQuery(apiUrl))

  const [prefersUnsolved, setPrefersUnsolved] = useState(false)
  const [isSubmitting, setSubmitting] = useState(false)
  const [isAbandonOpen, setAbandonOpen] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)

  const activeSession = data.sessions.find((session) => session.finishedAt === null)
  const finishedSessions = data.sessions.filter((session) => session.finishedAt !== null)

  async function reloadSessions() {
    await queryClient.invalidateQueries({ queryKey: examKeys.list(apiUrl) })
  }

  async function handleStart() {
    if (isSubmitting) return

    setSubmitting(true)
    setFailure(null)
    try {
      const session = await createExam(apiUrl, { preferUnsolved: prefersUnsolved })
      router.push(`/exam/${session.id}`)
    } catch (error) {
      if (error instanceof ApiError && error.status === CONFLICT) {
        setFailure('conflict')
        await reloadSessions()
        return
      }

      setFailure('create')
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * 포기하면 세션과 답안이 사라진다. **409(그 사이 다른 기기가 종료함)도 목록을 다시 읽는 것으로
   * 끝낸다** — 그 세션을 결과 화면으로 보내는 것은 SJO-24 소관이다 (`docs/02` 「API 오류의 화면
   * 표현」의 `DELETE` 409 행).
   */
  async function handleAbandon() {
    if (!activeSession || isSubmitting) return

    setAbandonOpen(false)
    setSubmitting(true)
    setFailure(null)
    try {
      await deleteExam(apiUrl, activeSession.id)
    } catch (error) {
      if (!(error instanceof ApiError && error.status === CONFLICT)) setFailure('delete')
    } finally {
      await reloadSessions()
      setSubmitting(false)
    }
  }

  const startButton = (
    <Button variant="filled" disabled={isSubmitting} onClick={() => void handleStart()}>
      새 모의고사 시작
    </Button>
  )

  const unsolvedChip = (
    <Chip isSelected={prefersUnsolved} onClick={() => setPrefersUnsolved((current) => !current)}>
      안 푼 문제 우선
    </Chip>
  )

  /**
   * 라이브 리전은 **배너보다 먼저** DOM에 있어야 낭독되므로 비어 있어도 항상 렌더한다
   * (`DESIGN.md` 「상태 배너」). `contents`는 빈 컨테이너가 flex gap 하나를 만들지 않게 한다.
   */
  const banner = (
    <div aria-live="polite" className="contents">
      {failure && <StatusBanner kind="error">{FAILURE_MESSAGE[failure]}</StatusBanner>}
    </div>
  )

  const abandonDialog = (
    <ConfirmDialog
      isOpen={isAbandonOpen}
      title="진행 중인 모의고사를 포기한다"
      description="세션과 지금까지 고른 답이 사라진다. 되돌릴 수 없다."
      confirmLabel="포기"
      onConfirm={() => void handleAbandon()}
      onCancel={() => setAbandonOpen(false)}
    />
  )

  /**
   * **빈 상태에서 사라지는 것은 목록이고 칩이 아니다** (`docs/02` 「빈 상태」). 하단 액션 바도
   * 그리지 않는다 — 액션은 빈 상태의 주 버튼 하나다 (`DESIGN.md` 「빈 상태·완주에서 골격은
   * 어떻게 되나」).
   */
  if (data.sessions.length === 0) {
    return (
      <>
        <AppBar title="모의고사" backHref="/" />
        <div className="app-bar-gutter-top flex min-h-dvh flex-col">
          <div className="px-screen pt-4">{banner}</div>
          <EmptyState
            message="아직 모의고사 기록이 없다"
            options={unsolvedChip}
            actions={startButton}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <AppBar title="모의고사" backHref="/" />

      <div className="app-bar-gutter-top">
        <main className="action-bar-gutter mx-auto flex w-full max-w-reading flex-col gap-6 px-screen py-4">
          {banner}

          {activeSession && (
            <ActiveSessionCard
              session={activeSession}
              onAbandon={() => setAbandonOpen(true)}
              isBusy={isSubmitting}
            />
          )}

          {finishedSessions.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-title-small">지난 모의고사</h2>
              <ul>
                {finishedSessions.map((session) => (
                  <li key={session.id}>
                    <FinishedSessionRow session={session} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex justify-end">{unsolvedChip}</div>
        </main>
      </div>

      <ActionBar>{startButton}</ActionBar>
      {abandonDialog}
    </>
  )
}

/**
 * `DESIGN.md` 「대시보드 요소」의 「진행 중 모의고사 이어풀기」 규격 그대로다 — **상태 배너가
 * 아니다.** 이 화면에서만 액션이 둘이다(이어풀기·포기): 대시보드에는 포기 경로가 없다.
 *
 * 진행 위치(`12 / 65`)를 적지 않는 이유는 `GET /exams`가 `cursor`를 담지 않기 때문이다
 * (`docs/05` — 65개 배열 × N세션을 목록이 읽지 않는다). 없는 값을 화면이 지어내지 않는다.
 */
function ActiveSessionCard({
  session,
  onAbandon,
  isBusy,
}: {
  session: ExamSessionSummary
  onAbandon: () => void
  isBusy: boolean
}) {
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-corner-medium border border-outline bg-surface-container px-4 py-2 text-body-medium">
      <span className="flex-1">
        진행 중인 모의고사 · {formatSessionDate(session.startedAt)} 시작
      </span>
      <Link href={`/exam/${session.id}`} className={buttonClassName()}>
        이어풀기
      </Link>
      <Button disabled={isBusy} onClick={onAbandon}>
        포기
      </Button>
    </div>
  )
}

/** 「최근 모의고사」 행 규격 — 좌측 날짜 · 우측 `47 / 65`(점수만 500) · 최소 48px. */
function FinishedSessionRow({ session }: { session: ExamSessionSummary }) {
  return (
    <Link
      href={`/exam/${session.id}/result`}
      className="state-layer flex min-h-12 items-center justify-between gap-4 rounded-corner-small px-2 text-body-medium"
    >
      <span className="text-on-surface-variant">{formatSessionDate(session.startedAt)}</span>
      <ScoreCell score={session.score} />
    </Link>
  )
}

/**
 * 종료된 세션은 언제나 점수를 갖는다 — `finish`가 같은 문장에서 둘을 쓴다. 그래도 계약이
 * `null`을 허용하므로 자리를 비워 둔다: 없는 점수를 `0`으로 그리면 **0점 맞은 것으로 읽힌다.**
 */
function ScoreCell({ score }: { score: number | null }) {
  if (score === null) return <span className="text-on-surface-variant">—</span>

  return (
    <span>
      <span className="font-medium">{score}</span> / {EXAM_QUESTION_COUNT}
    </span>
  )
}
