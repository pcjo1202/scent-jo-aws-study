/**
 * 저장 요청을 **한 줄로 세운다.** 복수정답 문항에서 연달아 고르면 `[A]`와 `[A, B]`가 거의
 * 동시에 나가는데, 뒤엣것이 먼저 커밋되면 마지막 답이 `[A]`로 남아 **채점 대상이 뒤집힌다.**
 * 순서를 지키는 비용이 앞 요청 하나를 기다리는 것뿐이라 낙관적 UI는 그대로다.
 *
 * **앞이 실패해도 뒤는 돈다** — 5번 저장이 끊겨도 6번은 나가야 한다. 대신 돌려주는 promise는
 * 실패를 그대로 던진다: 호출부가 어느 문항이 저장 안 됐는지 세야 하기 때문이다.
 */
export function createSaveQueue() {
  let tail: Promise<unknown> = Promise.resolve()

  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task, task)
    tail = result.catch(() => undefined)

    return result
  }
}
