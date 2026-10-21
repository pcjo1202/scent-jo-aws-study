import { ListHeader, ProgressBar } from '@scent-jo/react'

/** 60% 미만 `danger` · 이상 `success`. 두 색 사이를 보간하지 않는다 (`DESIGN.md` 「대시보드 요소」). */
const GOOD_ACCURACY = 0.6

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
 * DS `BarChart`가 아니라 `ProgressBar`인 이유: `BarChart`는 세로 막대 아래 X축 라벨을 다는
 * 차트라 「라벨 · 막대 · 값」 한 줄을 그리지 못한다. **막대는 낭독에서 뺀다** — 정답률은 진행이
 * 아닌데 `ProgressBar`는 `role="progressbar"`로 낭독되고, 값은 옆 글자가 이미 나른다(결과
 * 화면의 `4 / 6`은 막대가 백분율로 한 번 더 읽힌다). 누를 수 없는 행이라 `ListRow`가 아니다.
 */
export function CategoryBars({ title, bars }: { title: string; bars: CategoryBar[] }) {
  if (bars.length === 0) return null

  return (
    <section>
      <ListHeader
        size="small"
        verticalPadding="small"
        horizontalPadding="small"
        title={<ListHeader.TitleParagraph>{title}</ListHeader.TitleParagraph>}
      />
      <ul className="px-5">
        {bars.map(({ category, accuracy, value }) => (
          <li key={category} className="flex items-center gap-3 py-2 text-t7">
            <span className="w-22 shrink-0 truncate">{category}</span>
            <ProgressBar
              value={accuracy}
              max={1}
              color={
                accuracy < GOOD_ACCURACY
                  ? 'var(--sj-color-bg-danger)'
                  : 'var(--sj-color-bg-success)'
              }
              className="flex-1"
              aria-hidden
            />
            {/* 폭을 고정한다 — 값 글자 폭을 따라가면 행마다 트랙 길이가 달라져 막대 길이를 비교할 수 없다. */}
            <span className="w-12 shrink-0 text-right">{value}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
