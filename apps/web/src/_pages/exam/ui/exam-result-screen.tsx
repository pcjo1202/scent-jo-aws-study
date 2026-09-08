'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'

import { manifestQuery, questionIndexQuery } from '@/shared/api/cdn'
import { examQuery } from '@/shared/api/exams'
import { AppBar } from '@/shared/ui/app-bar'

import { ResultGrid } from '@/features/navigate-exam/ui/result-grid'

import { tallyCategories, type CategoryTally } from '../lib/tally-categories'

const SCREEN_NAME = '모의고사 결과'

/** 60% 미만 `error` · 이상 `correct`. 두 색 사이를 보간하지 않는다 (`DESIGN.md` 「대시보드 요소」). */
const GOOD_ACCURACY = 0.6

const PERCENT = 100

/**
 * 점수 · 카테고리별 정오 · 문항별 리뷰 진입 (`docs/02-features.md` 「결과 화면의 구성」).
 *
 * **새 컴포넌트 규격을 만들지 않는다** — 점수 카드는 `DESIGN.md` 「대시보드 요소」의 전체 진도
 * 카드, 막대는 같은 표의 카테고리별 정답률 막대, 65칸은 「문제 이동 그리드」다.
 *
 * `results`가 `null`이면 채점 전이므로 풀던 화면으로 돌려보낸다. 세션 하나는 언제나
 * `/exam/[id]`와 여기 중 정확히 하나에서만 열린다 — 반대 방향은 `ExamSessionScreen`이 맡는다.
 */
export function ExamResultScreen({ apiUrl, sessionId }: { apiUrl: string; sessionId: string }) {
  const router = useRouter()

  const { data: session } = useSuspenseQuery(examQuery(apiUrl, sessionId))
  const { data: manifest } = useSuspenseQuery(manifestQuery())
  const { data: index } = useSuspenseQuery(questionIndexQuery(manifest))

  const results = session.results

  const tallies = useMemo(
    () =>
      results === null
        ? []
        : tallyCategories(
            results,
            new Map(index.entries.map((entry) => [entry.id, entry.categories])),
          ),
    [results, index],
  )

  const isUngraded = results === null

  useEffect(() => {
    if (isUngraded) router.replace(`/exam/${sessionId}`)
  }, [isUngraded, router, sessionId])

  if (results === null) return null

  return (
    <>
      <AppBar title={SCREEN_NAME} backHref="/exam" />

      <div className="app-bar-gutter-top">
        <main className="mx-auto flex w-full max-w-reading flex-col gap-6 px-screen py-4">
          <ScoreCard score={session.score} total={results.length} />
          <CategoryBars tallies={tallies} />
          <ResultGrid results={results} sessionId={sessionId} />
        </main>
      </div>
    </>
  )
}

/**
 * 「전체 진도 카드」 규격 그대로다 (`DESIGN.md` 「대시보드 요소」).
 *
 * 분모는 **서버가 준 문항 수**다. 종료된 세션의 `results`는 65개가 나오지만, 그 값을
 * `EXAM_QUESTION_COUNT`로 다시 쓰면 화면이 서버와 다른 근거로 같은 수를 말하게 된다 — 그
 * 상수의 자리는 `questionIds`를 안 담는 목록 화면뿐이다 (`shared/config/exam`).
 *
 * `score`가 `null`인 자리를 `0`으로 그리지 않는다 — 0점 맞은 것으로 읽힌다.
 */
function ScoreCard({ score, total }: { score: number | null; total: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-corner-medium border border-outline bg-surface-container-low p-4">
      <p className="text-body-small text-on-surface-variant">점수</p>
      <p>
        <span className="text-headline-small">{score ?? '—'}</span>{' '}
        <span className="text-body-large text-on-surface-variant">/ {total}</span>
      </p>
    </div>
  )
}

/**
 * 「카테고리별 정답률 막대」 규격 (`DESIGN.md` 「대시보드 요소」). 이 세션에 나온 카테고리만
 * 그린다 — 안 나온 것을 「0건」으로 세우면 낮은 순 정렬의 맨 위를 차지해 실제로 약한 영역을
 * 가린다 (대시보드가 안 푼 카테고리를 빼는 것과 같은 이유, `docs/02` 「빈 상태」).
 *
 * 값이 백분율이 아니라 `4 / 6`인 것은 한 세션의 카테고리당 문항이 적어서다 — `1 / 2`를
 * 「50%」로 쓰면 표본 크기가 사라진다. 색은 그대로 60% 경계로 가른다.
 */
function CategoryBars({ tallies }: { tallies: CategoryTally[] }) {
  if (tallies.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-title-small">카테고리별 정오</h2>
      <ul>
        {tallies.map(({ category, total, correct }) => {
          const accuracy = correct / total

          return (
            <li key={category} className="flex h-9 items-center gap-2">
              <span className="w-22 shrink-0 truncate text-body-small">{category}</span>
              <span className="h-2 flex-1 rounded-corner-full bg-surface-container-high">
                <span
                  className={`block h-full rounded-corner-full ${accuracy < GOOD_ACCURACY ? 'bg-error' : 'bg-correct'}`}
                  style={{ width: `${(accuracy * PERCENT).toFixed(0)}%` }}
                />
              </span>
              <span className="shrink-0 text-right text-body-small">
                {correct} / {total}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
