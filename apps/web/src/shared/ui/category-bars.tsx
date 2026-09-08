/** 60% 미만 `error` · 이상 `correct`. 두 색 사이를 보간하지 않는다 (`DESIGN.md` 「대시보드 요소」). */
const GOOD_ACCURACY = 0.6

const PERCENT = 100

/** `value`는 화면이 정한다 — 대시보드는 백분율(`62%`), 결과 화면은 `정답 / 문항`(`4 / 6`). */
export type CategoryBar = {
  category: string
  /** 0~1. 막대 폭과 색이 **둘 다** 이 값에서 나온다 — `value`와 갈리지 않게 한다. */
  accuracy: number
  value: string
}

/**
 * 「카테고리별 정답률 막대」 규격 (`DESIGN.md` 「대시보드 요소」). 대시보드와 결과 화면이 같은
 * 규격을 쓰고 **다른 것은 제목과 값의 형식뿐**이다 — 한 세션의 카테고리당 문항이 2~15개라
 * 백분율이 표본 크기를 지우기 때문이다.
 *
 * **여기가 `DESIGN.md` 「색 사용 규칙」의 예외 하나다** — 색이 카테고리가 아니라 값을 나타낸다.
 * 값이 항상 숫자로 병기되므로 색이 나르는 것은 「낮음/높음」 둘뿐이다. 이 예외를 다른 곳으로
 * 넓히지 않는다.
 *
 * 줄 높이 36px은 탭 타겟이 아니다 — 누를 수 없다.
 */
export function CategoryBars({ title, bars }: { title: string; bars: CategoryBar[] }) {
  if (bars.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-title-small">{title}</h2>
      <ul>
        {bars.map(({ category, accuracy, value }) => (
          <li key={category} className="flex h-9 items-center gap-2">
            <span className="w-22 shrink-0 truncate text-body-small">{category}</span>
            <span className="h-2 flex-1 rounded-corner-full bg-surface-container-high">
              <span
                className={`block h-full rounded-corner-full ${accuracy < GOOD_ACCURACY ? 'bg-error' : 'bg-correct'}`}
                style={{ width: `${(accuracy * PERCENT).toFixed(0)}%` }}
              />
            </span>
            <span className="shrink-0 text-right text-body-small">{value}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
