'use client'

import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { ApiError } from '@/shared/api/api-client'
import { examKeys, examsQuery } from '@/shared/api/exams'
import { examResultHref, examSessionHref } from '@/shared/config/exam'
import { ActionBar } from '@/shared/ui/action-bar'
import { ActiveSessionCard } from '@/shared/ui/active-session-card'
import { AppBar } from '@/shared/ui/app-bar'
import { Button, buttonClassName } from '@/shared/ui/button'
import { Chip } from '@/shared/ui/chip'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { EmptyState } from '@/shared/ui/empty-state'
import { ExamSessionRow } from '@/shared/ui/exam-session-row'
import { StatusBanner } from '@/shared/ui/status-banner'

import { createExam } from '@/features/manage-exam/api/create-exam'
import { deleteExam } from '@/features/manage-exam/api/delete-exam'

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
      router.push(examSessionHref(session.id))
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
   * 포기하면 세션과 답안이 사라진다.
   *
   * **409는 그 사이 다른 기기가 종료했다는 뜻이라 결과 화면으로 보낸다** (`docs/02` 「API 오류의
   * 화면 표현」의 `DELETE` 409 행). 실패로 표시하지 않는다 — 사용자가 없애려던 「진행 중 세션」은
   * 실제로 없어졌고, 남은 것은 그 세션의 결과다.
   *
   * 목록 재조회는 이동 여부와 무관하게 한다. 결과 화면으로 가더라도 뒤로 나오면 이 목록이고,
   * 거기 진행 중 카드가 남아 있으면 방금 없어진 것을 다시 권한다.
   */
  async function handleAbandon() {
    if (!activeSession || isSubmitting) return

    const { id } = activeSession
    setAbandonOpen(false)
    setSubmitting(true)
    setFailure(null)
    let isAlreadyFinished = false
    try {
      await deleteExam(apiUrl, id)
    } catch (error) {
      isAlreadyFinished = error instanceof ApiError && error.status === CONFLICT
      if (!isAlreadyFinished) setFailure('delete')
    } finally {
      await reloadSessions()
      setSubmitting(false)
    }

    if (isAlreadyFinished) router.replace(examResultHref(id))
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

          {/* 이 화면에서만 액션이 둘이다 — 대시보드에는 「포기」 경로가 없다. */}
          {activeSession && (
            <ActiveSessionCard startedAt={activeSession.startedAt}>
              <Link href={examSessionHref(activeSession.id)} className={buttonClassName()}>
                이어풀기
              </Link>
              <Button disabled={isSubmitting} onClick={() => setAbandonOpen(true)}>
                포기
              </Button>
            </ActiveSessionCard>
          )}

          {finishedSessions.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-title-small">지난 모의고사</h2>
              <ul>
                {finishedSessions.map((session) => (
                  <li key={session.id}>
                    <ExamSessionRow session={session} />
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
