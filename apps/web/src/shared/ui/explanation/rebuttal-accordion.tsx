import type { ChoiceKey } from '@aws-study/shared'

import { MaterialSymbol } from '@/shared/ui/icon/material-symbol'

/**
 * 해설 블록 ③ — **전부 펼쳐두지 않는다.** 오답 해설 4개가 한꺼번에 펼쳐지면 화면이 두 배로
 * 길어지고 정작 필요한 하나를 못 찾는다 (`DESIGN.md` 「해설 블록 · ③ 오답 해설」).
 *
 * **내가 고른 오답만 기본 펼침**이다. 정답을 골랐으면 아무것도 펼쳐지지 않는다 —
 * `rebuttals`에는 정답 선택지 항목이 없기 때문이다 (`docs/04-data-model.md`).
 *
 * 네이티브 `details`를 쓰므로 열림 상태·키보드 조작·스크린리더 노출을 직접 구현하지 않는다.
 * `defaultOpen`을 React 상태로 들지 않고 `open` 속성으로 한 번만 주므로, 그 뒤의 여닫기는
 * 브라우저가 소유한다.
 */
export function RebuttalAccordion({
  rebuttals,
  selected,
}: {
  rebuttals: Array<{ key: ChoiceKey; text: string }>
  selected: ChoiceKey[]
}) {
  if (rebuttals.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h3>오답 해설</h3>
      {rebuttals.map((rebuttal) => (
        <details
          key={rebuttal.key}
          className="rebuttal rounded-corner-medium bg-surface-container-low"
          open={selected.includes(rebuttal.key)}
        >
          <summary className="state-layer flex min-h-12 cursor-pointer items-center gap-3 rounded-corner-medium px-4 py-3 text-body-medium">
            <span>{rebuttal.key}</span>
            <span className="line-clamp-1 flex-1">{rebuttal.text}</span>
            <MaterialSymbol name="expand_more" className="rebuttal-marker" />
          </summary>
          <p className="whitespace-pre-wrap px-4 pb-3 text-body-medium">{rebuttal.text}</p>
        </details>
      ))}
    </section>
  )
}
