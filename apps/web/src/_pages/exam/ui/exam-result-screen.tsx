'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'

import { manifestQuery, questionIndexQuery } from '@/shared/api/cdn'
import { examQuery } from '@/shared/api/exams'
import { examSessionHref } from '@/shared/config/exam'
import { AppBar } from '@/shared/ui/app-bar'
import { CategoryBars } from '@/shared/ui/category-bars'
import { StatCard } from '@/shared/ui/stat-card'
import { StatusBanner } from '@/shared/ui/status-banner'

import { ResultGrid } from '@/features/navigate-exam/ui/result-grid'

import { tallyCategories } from '../lib/tally-categories'

import { ExamShell } from './exam-shell'

const SCREEN_NAME = '모의고사 결과'

/**
 * 점수 · 카테고리별 정오 · 문항별 리뷰 진입 (`docs/02-features.md` 「결과 화면의 구성」).
 *
 * **새 컴포넌트 규격을 만들지 않는다** — 점수 카드는 `DESIGN.md` 「대시보드 요소」의 전체 진도
 * 카드, 막대는 같은 표의 카테고리별 정답률 막대, 65칸은 「문제 이동 그리드」다.
 *
 * 채점 전 세션이면 풀던 화면으로 돌려보낸다. 세션 하나는 언제나 `/exam/[id]`와 여기 중 정확히
 * 하나에서만 열린다 — 반대 방향은 `ExamSessionScreen`이 맡는다.
 */
export function ExamResultScreen({ apiUrl, sessionId }: { apiUrl: string; sessionId: string }) {
  const router = useRouter()

  const { data: session } = useSuspenseQuery(examQuery(apiUrl, sessionId))
  const { data: manifest } = useSuspenseQuery(manifestQuery())
  const { data: index } = useSuspenseQuery(questionIndexQuery(manifest))

  const results = session.results

  /**
   * **이 세션에 나온 카테고리만 그린다.** 안 나온 것을 「0건」으로 세우면 낮은 순 정렬의 맨
   * 위를 차지해 실제로 약한 영역을 가린다 (대시보드가 안 푼 카테고리를 빼는 것과 같은 이유,
   * `docs/02` 「빈 상태」).
   *
   * 값이 백분율이 아니라 `4 / 6`인 것은 한 세션의 카테고리당 문항이 2~15개라서다 — `1 / 2`를
   * 「50%」로 쓰면 표본 크기가 사라진다 (`DESIGN.md` 「대시보드 요소」). 색 경계는 대시보드와
   * 같은 60%이고 그 판정은 `CategoryBars`가 갖는다.
   */
  const bars = useMemo(
    () =>
      results === null
        ? []
        : tallyCategories(
            results,
            new Map(index.entries.map((entry) => [entry.id, entry.categories])),
          ).map(({ category, total, correct }) => ({
            category,
            accuracy: correct / total,
            value: `${correct} / ${total}`,
          })),
    [results, index],
  )

  /**
   * **판정 필드를 `ExamSessionScreen`과 같은 것으로 맞춘다.** 두 화면이 각각 `finishedAt`과
   * `results`를 보면 왕복을 막는 근거가 서버 불변식(`finishedAt !== null ⟺ results !== null`)
   * 하나뿐인데, 그것이 깨지는 순간 두 라우트가 서로를 무한히 밀어낸다. 같은 필드를 보면 그
   * 결합이 사라진다.
   */
  const isUnfinished = session.finishedAt === null

  useEffect(() => {
    if (isUnfinished) router.replace(examSessionHref(sessionId))
  }, [isUnfinished, router, sessionId])

  if (isUnfinished) {
    return (
      <ExamShell title={SCREEN_NAME} backHref="/exam">
        <StatusBanner kind="loading">진행 중인 모의고사를 여는 중…</StatusBanner>
      </ExamShell>
    )
  }

  // 종료됐는데 `results`가 없으면 계약 위반이다 — 리다이렉트로 감추지 않고 오류 경계로 보낸다.
  if (results === null) {
    throw new Error(`종료된 세션 ${sessionId}에 results가 없다`)
  }

  return (
    <>
      <AppBar title={SCREEN_NAME} backHref="/exam" />

      <div className="app-bar-gutter-top">
        <main className="mx-auto flex w-full max-w-reading flex-col gap-6 px-screen py-4">
          {/*
            분모는 **서버가 준 문항 수**다. 종료된 세션의 `results`는 65개가 나오지만 그 값을
            `EXAM_QUESTION_COUNT`로 다시 쓰면 화면이 서버와 다른 근거로 같은 수를 말하게 된다 —
            그 상수의 자리는 `questionIds`를 안 담는 목록 화면뿐이다 (`shared/config/exam`).
          */}
          <StatCard label="점수" value={session.score} total={results.length} />
          <CategoryBars title="카테고리별 정오" bars={bars} />
          <ResultGrid results={results} sessionId={sessionId} />
        </main>
      </div>
    </>
  )
}
