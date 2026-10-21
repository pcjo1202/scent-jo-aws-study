/**
 * 해설 블록 ② — 정답 선택지 카드 **안**에서 펼쳐진다 (`DESIGN.md` 「해설 블록」).
 *
 * **면을 깔지 않는다.** 카드가 이미 정오 면을 깔고 있어, 「안 고른 정답」 카드에서는 해설과 카드의
 * 경계가 사라진다. 카드 안이라는 것이 곧 소속 표시다 (같은 절).
 *
 * 가장 중요한 텍스트이므로 본문과 같은 크기를 쓴다. 해설이라고 작게 만들지 않는다
 * (`DESIGN.md` 「② 정답 해설」).
 *
 * `whitespace-pre-wrap`이 필요하다. 해설에 코드 블록의 줄 구조가 살아 있다
 * (`docs/04-data-model.md` 「파서가 복원할 수 없는 것」).
 */
export function AnswerExplanation({ text }: { text: string }) {
  return (
    <section>
      <h3 className="mb-1 text-t6 font-semibold">정답 해설</h3>
      <p className="whitespace-pre-wrap text-t5">{text}</p>
    </section>
  )
}
