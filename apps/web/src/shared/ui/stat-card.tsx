import { ProgressBar } from '@scent-jo/react'

/**
 * 「전체 진도 카드」 규격 (`DESIGN.md` 「대시보드 요소」). 대시보드의 진도와 결과 화면의 점수가
 * 같은 그릇이고, **결과 화면은 같은 규격에서 트랙만 뺀다** — 점수는 진행이 아니라 결과라
 * 「남은 양」이 없다 (2026-09-08, SJO-24).
 *
 * **트랙을 중립색으로 칠한다.** 진도에 `success`·`danger`를 싣지 않는데
 * (`DESIGN.md` 「진행 표시」), DS 기본인 브랜드 주황은 대시보드에서 바로 아래 정답률 막대의
 * `danger` 빨강과 거의 같은 색으로 나란히 서서 「낮음」으로 읽힌다.
 *
 * `value`가 `null`인 자리를 `0`으로 그리지 않는다 — 0점 맞은 것으로 읽힌다.
 */
export function StatCard({
  label,
  value,
  total,
  hasTrack = false,
}: {
  label: string
  value: number | null
  total: number
  /** 진행을 나타내는 카드만 트랙을 갖는다. 결과(점수)는 갖지 않는다. */
  hasTrack?: boolean
}) {
  return (
    <div className="flex flex-col gap-2 rounded-3 border border-default p-5">
      <p className="text-t7 text-secondary">{label}</p>
      <p>
        <span className="text-t3 font-bold">{value ?? '—'}</span>{' '}
        <span className="text-t5 text-secondary">/ {total}</span>
      </p>

      {hasTrack && value !== null && (
        <ProgressBar
          value={value}
          max={total}
          color="var(--sj-color-fg-secondary)"
          aria-label={label}
        />
      )}
    </div>
  )
}
