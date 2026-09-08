/**
 * 이어풀기 버튼의 문구 (`docs/02-features.md` 「빈 상태」의 `/`·`/study` 행). 셋 다 그 표에서
 * 옮긴 것이고 새로 쓰지 않는다.
 *
 * **버튼이 사라지지 않는다.** 시도 0건에도 진도 카드와 주 버튼은 남고, 그래서 대시보드가
 * 「빈 상태」의 가운데 정렬 예외다 (`DESIGN.md` 「빈 상태」). 바뀌는 것은 문구뿐이다.
 *
 * **목적지는 셋 다 `/study`다.** 완주 화면(`/review`·`/exam` 유도)을 그리는 곳이 거기라
 * 「전체 완주」가 가리킬 자리가 그 화면이다.
 */
export function toResumeLabel({
  hasAttempt,
  isFinished,
}: {
  hasAttempt: boolean
  isFinished: boolean
}): string {
  if (!hasAttempt) return '첫 문제 풀기'
  if (isFinished) return '전체 완주'

  return '이어풀기'
}
