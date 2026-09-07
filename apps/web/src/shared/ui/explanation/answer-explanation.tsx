/**
 * 해설 블록 ② — 정답 선택지 카드 **안**에서 펼쳐진다 (`DESIGN.md` 「해설 블록」).
 *
 * **면색을 주지 않는다.** 정답 선택지 카드가 이미 `correct-container`(내가 고름) 또는
 * `surface-container-low`(안 고름)를 깔고 있어, 후자에서는 해설과 카드가 같은 색이 되어
 * 경계가 사라진다. 좌측 보더만으로 구분한다.
 *
 * 가장 중요한 텍스트이므로 본문과 같은 `body-large`를 쓴다. 해설이라고 작게 만들지 않는다.
 *
 * `whitespace-pre-wrap`이 필요하다. 해설에 코드 블록의 줄 구조가 살아 있다
 * (`docs/04-data-model.md` 「파서가 복원할 수 없는 것」).
 */
export function AnswerExplanation({ text }: { text: string }) {
  return (
    <section className="border-l-4 border-correct pl-4">
      <h3>정답 해설</h3>
      <p className="whitespace-pre-wrap text-body-large">{text}</p>
    </section>
  )
}
