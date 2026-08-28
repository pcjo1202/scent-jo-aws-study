/**
 * 해설 블록 ② — 가장 중요한 텍스트이므로 본문과 같은 `body-large`를 쓴다. 해설이라고
 * 작게 만들지 않는다 (`DESIGN.md` 「해설 블록 · ② 정답 해설」).
 *
 * `whitespace-pre-wrap`이 필요하다. 해설에 코드 블록의 줄 구조가 살아 있다
 * (`docs/04-data-model.md` 「파서가 복원할 수 없는 것」).
 */
export function AnswerExplanation({ text }: { text: string }) {
  return (
    <section className="rounded-corner-medium border-l-4 border-correct bg-surface-container-low px-4 py-3">
      <h3>정답 해설</h3>
      <p className="whitespace-pre-wrap text-body-large">{text}</p>
    </section>
  )
}
