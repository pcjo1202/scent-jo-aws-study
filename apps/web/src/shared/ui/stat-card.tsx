const PERCENT = 100

/**
 * 「전체 진도 카드」 규격 (`DESIGN.md` 「대시보드 요소」). 대시보드의 진도와 결과 화면의 점수가
 * 같은 그릇이고, **결과 화면은 같은 규격에서 트랙만 뺀다** — 점수는 진행이 아니라 결과라
 * 「남은 양」이 없다 (2026-09-08, SJO-24).
 *
 * **트랙에 색을 싣지 않는다.** `primary`로 칠하면 대시보드에서 카테고리 정답률 막대
 * (`error`↔`correct`)와 같은 형태로 나란히 서고, `primary`×`error`가 적록색약 식별 한계
 * 아래다 (`DESIGN.md` 「진행 표시」).
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
    <div className="flex flex-col gap-1 rounded-corner-medium border border-outline bg-surface-container-low p-4">
      <p className="text-body-small text-on-surface-variant">{label}</p>
      <p>
        <span className="text-headline-small">{value ?? '—'}</span>{' '}
        <span className="text-body-large text-on-surface-variant">/ {total}</span>
      </p>

      {hasTrack && value !== null && (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={value}
          className="mt-1 h-2 rounded-corner-full bg-surface-container-high"
        >
          {/* 진행률은 계산된 값이라 유틸 클래스로 쓸 수 없다 (`AppBar`의 진행 바와 같다). */}
          <div
            className="h-full rounded-corner-full bg-on-surface-variant"
            style={{ width: `${((value / total) * PERCENT).toFixed(0)}%` }}
          />
        </div>
      )}
    </div>
  )
}
