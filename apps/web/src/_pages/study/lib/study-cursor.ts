/**
 * 순차 풀이가 어느 문항에서 열리는가 (`docs/02-features.md` 「`/study` 순차 풀이」).
 *
 * 포인터는 **마지막으로 푼 문항**이므로 화면은 그 **다음**에서 연다. `id > lastQuestionId`인
 * 첫 자리를 찾는 것이 그것이고, 문항 번호가 연속이 아니어도(필터가 걸리면 그렇다) 성립한다.
 *
 * **필터 모드는 `lastQuestionId`에 `0`을 넘긴다.** 필터를 건 상태의 진행 위치는 저장하지
 * 않으므로 부분집합의 처음부터다 — 전체 진도 포인터를 여기에 끌어오면 필터 세트의 앞쪽이
 * 통째로 건너뛰어진다 (`docs/02-features.md` 「필터」).
 */
export function toStartIndex(
  questionIds: readonly number[],
  lastQuestionId: number,
): number | null {
  const startIndex = questionIds.findIndex((questionId) => questionId > lastQuestionId)

  return startIndex === -1 ? null : startIndex
}
