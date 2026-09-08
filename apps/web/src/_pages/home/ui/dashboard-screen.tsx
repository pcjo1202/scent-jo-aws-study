'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useMemo } from 'react'

import { manifestQuery, questionIndexQuery } from '@/shared/api/cdn'
import { examsQuery } from '@/shared/api/exams'
import { progressQuery, statsQuery } from '@/shared/api/me'
import { examSessionHref } from '@/shared/config/exam'
import { toStartIndex } from '@/shared/lib/study-cursor'
import { ActiveSessionCard } from '@/shared/ui/active-session-card'
import { AppBar } from '@/shared/ui/app-bar'
import { buttonClassName } from '@/shared/ui/button'
import { CategoryBars } from '@/shared/ui/category-bars'
import { ExamSessionRow } from '@/shared/ui/exam-session-row'
import { MaterialSymbol } from '@/shared/ui/icon/material-symbol'
import { StatCard } from '@/shared/ui/stat-card'
import { ThemeToggle } from '@/shared/ui/theme-toggle'

import { rankCategories } from '../lib/rank-categories'
import { toResumeLabel } from '../lib/resume-label'

const SCREEN_NAME = 'AWS SAA-C03 학습'

const RECENT_EXAM_COUNT = 3

/**
 * **오답 행이 빠져도 나머지 셋은 남는다.** 이 셋은 대시보드 말고 진입 경로가 없어서, 빼면
 * 상시 네비게이션이 없는 구조에서 그 화면이 **도달 불가능**해진다 (`DESIGN.md` 「네비게이션은
 * 허브-스포크다」). 오답 행만 「빈 상태」가 가린다.
 *
 * `/notes`·`/anatomy`는 라우트가 아직 없다 (E7 · SJO-25 · SJO-26). 규격대로 두면 그 이슈가
 * 붙는 순간 이 화면을 고치지 않아도 살아난다.
 */
const ENTRY_ROWS = [
  { href: '/exam', label: '모의고사' },
  { href: '/notes', label: '암기 노트' },
  { href: '/anatomy', label: '해부서' },
]

/**
 * 허브 화면 (`docs/02-features.md` 「`/` 대시보드」). 블록 순서의 정본은 같은 문서 「화면 구성
 * 요소」의 `/` 행이다 — 여기서 새로 정하지 않는다.
 *
 * **뒤로가기도 우측 액션도 진행 바도 없다.** 허브이고, 진행 바는 문제 풀이 3화면만이다
 * (`DESIGN.md` 「앱바」).
 */
export function DashboardScreen({ apiUrl }: { apiUrl: string }) {
  const { data: manifest } = useSuspenseQuery(manifestQuery())
  const { data: index } = useSuspenseQuery(questionIndexQuery(manifest))
  const { data: progress } = useSuspenseQuery(progressQuery(apiUrl))
  const { data: exams } = useSuspenseQuery(examsQuery(apiUrl))
  const { data: stats } = useSuspenseQuery(statsQuery(apiUrl))

  const { bars, unsolvedCount } = useMemo(() => rankCategories(stats.byCategory), [stats])

  /**
   * 완주 판정을 `/study`와 **같은 함수로** 한다. 각자 세면 한쪽만 완주로 보이고, 그때 이 화면의
   * 버튼은 이어풀 것이 없는 곳으로 보낸다 (`docs/02` 「빈 상태」의 `/study` 행).
   */
  const isFinished = useMemo(
    () =>
      toStartIndex(
        index.entries.map((entry) => entry.id),
        progress.lastQuestionId,
      ) === null,
    [index, progress],
  )

  /** 「시도 0건」 하나가 아래 넷을 한꺼번에 가린다 (`docs/02` 「빈 상태」의 `/` 행). */
  const hasAttempt = progress.solvedCount > 0

  /**
   * 진행 중 세션의 근거를 `GET /exams`로 둔다. `GET /me/progress`의 `activeSessionId`도 같은
   * 사실을 아는데, 카드 문구가 요구하는 시작 시각은 목록에만 있다 — 근거가 둘이면 둘이
   * 어긋났을 때 무엇이 참인지를 또 정해야 한다. `/exam` 목록도 이 목록으로 판정한다.
   */
  const activeSession = exams.sessions.find((session) => session.finishedAt === null)
  const recentSessions = exams.sessions
    .filter((session) => session.finishedAt !== null)
    .slice(0, RECENT_EXAM_COUNT)

  return (
    <>
      <AppBar title={SCREEN_NAME} />

      <div className="app-bar-gutter-top">
        <main className="mx-auto flex w-full max-w-reading flex-col gap-6 px-screen py-4">
          <StatCard
            label="전체 진도"
            value={progress.solvedCount}
            total={manifest.questions.total}
            hasTrack
          />

          {/*
            이어풀기의 목적지는 완주해도 `/study`다 — 거기가 완주 화면(`/review`·`/exam` 유도)을
            그리므로 「전체 완주」가 가리킬 곳이 그 자리다 (`DESIGN.md` 「대시보드 요소」).
          */}
          <Link href="/study" className={`${buttonClassName('filled')} h-14 w-full`}>
            {toResumeLabel({ hasAttempt, isFinished })}
          </Link>

          {hasAttempt && activeSession && (
            <ActiveSessionCard startedAt={activeSession.startedAt}>
              <Link href={examSessionHref(activeSession.id)} className={buttonClassName()}>
                이어풀기
              </Link>
            </ActiveSessionCard>
          )}

          <nav aria-label="다른 화면">
            <ul className="border-t border-outline-variant">
              {hasAttempt && (
                <li>
                  <EntryRow
                    href="/review"
                    label="오답 복습"
                    trailing={`오답 ${progress.wrongCount}문제`}
                  />
                </li>
              )}
              {ENTRY_ROWS.map((row) => (
                <li key={row.href}>
                  <EntryRow href={row.href} label={row.label} />
                </li>
              ))}
            </ul>
          </nav>

          {hasAttempt && (
            <div className="flex flex-col gap-2">
              <CategoryBars title="카테고리별 정답률" bars={bars} />
              {unsolvedCount > 0 && (
                <p className="text-body-small text-on-surface-variant">
                  아직 안 푼 영역 {unsolvedCount}개
                </p>
              )}
            </div>
          )}

          {hasAttempt && recentSessions.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-title-small">최근 모의고사</h2>
              <ul>
                {recentSessions.map((session) => (
                  <li key={session.id}>
                    <ExamSessionRow session={session} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 테마 전환이 있는 화면은 여기 하나다 (`docs/02` 「화면 구성 요소」). */}
          <ThemeToggle />
        </main>
      </div>
    </>
  )
}

/**
 * 「진입 행 ×4」 규격 (`DESIGN.md` 「대시보드 요소」). 위아래 `outline-variant` 1px은 목록의
 * `border-t`와 각 행의 `border-b`가 만든다.
 *
 * **수를 병기하는 것은 오답 행뿐이다** — 나머지 셋은 화면 이름만 갖는다.
 */
function EntryRow({ href, label, trailing }: { href: string; label: string; trailing?: string }) {
  return (
    <Link
      href={href}
      className="state-layer flex min-h-12 items-center gap-4 border-b border-outline-variant px-2 text-body-large"
    >
      <span className="flex-1">{label}</span>
      {trailing && <span className="text-on-surface-variant">{trailing}</span>}
      <MaterialSymbol name="chevron_right" />
    </Link>
  )
}
