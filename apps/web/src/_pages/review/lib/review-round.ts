/**
 * 완주 화면이 「남은 오답이 있다」로 볼지 (`docs/02-features.md` 「빈 상태」의 `/review` 두 행).
 *
 * **필터가 걸리면 언제나 참이다.** 세트는 진입 시 고정한 오답 목록에 필터를 적용한 것이라,
 * 이 회차에서 다 맞혔어도 **필터 밖에 오답이 남았는지를 이 화면은 모른다** — 「복습할 오답이
 * 없다」로 닫으면 「빈 상태」의 `/review` 필터 행이 막으려던 바로 그 거짓말이 된다. 답은
 * 「다시 풀기」가 세트를 새로 고정하면서 가져온다.
 */
export function hasRemainingWrong({
  total,
  correctCount,
  hasFilter,
}: {
  total: number
  correctCount: number
  hasFilter: boolean
}): boolean {
  return hasFilter || correctCount < total
}
