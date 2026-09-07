import type { ReactNode } from 'react'

import type { ChoiceKey } from '@aws-study/shared'

import type { ChoiceResult } from '@/shared/lib/choice-result'
import { MaterialSymbol, type MaterialSymbolName } from '@/shared/ui/icon/material-symbol'

/**
 * `DESIGN.md` 「채점 결과 · 선택지 표시」의 네 행. **면(채움 / 테두리 / 없음) × 아이콘(체크 /
 * 엑스 / 없음)** 두 축이라 색을 전부 걷어내도 네 경우가 갈린다.
 *
 * 안 고른 정답을 `correct-container` 채움이 아니라 `correct` 테두리로 그리는 것이 중요하다.
 * 선택된 선택지가 `secondary-container`라서 적록색약에서는 "내가 고른 것"과 "정답"이 같은
 * 면색이 된다 (`DESIGN.md` 「색으로만 갈리지 않는 쌍」 — 색각 최악 ΔE 2.2).
 */
const RESULT_STYLE: Record<
  ChoiceResult,
  { surface: string; icon: MaterialSymbolName | null; label: string | null }
> = {
  'chosen-correct': {
    surface: 'border border-transparent bg-correct-container text-on-correct-container',
    icon: 'check_circle',
    label: '정답',
  },
  'chosen-wrong': {
    surface: 'border border-transparent bg-error-container text-on-error-container',
    icon: 'cancel',
    label: '내 선택',
  },
  'missed-correct': {
    surface: 'border-2 border-correct bg-surface-container-low text-on-surface',
    icon: 'check_circle',
    label: '정답',
  },
  'unchosen-wrong': {
    surface: 'border border-outline bg-surface-container-low text-on-surface-variant',
    icon: null,
    label: null,
  },
}

/**
 * 채점 후의 선택지. **해설이 이 카드 안에서 펼쳐진다** (`DESIGN.md` 「해설 블록」) — 오답
 * 해설이 선택지를 문자로 참조하기 때문이다(`B. 각 부서에…` 형식). 따로 쌓아 두면 눈이
 * 위아래를 오간다.
 *
 * `input`을 두지 않는다. 조작이 사라졌고, 비활성 입력을 남기면 채움색 위에 흐려진 표식이
 * 겹쳐 정오 아이콘과 경쟁한다. **정오 라벨도 화면에 그리지 않는다** — 형태만으로 네 경우가
 * 이미 갈리는데 라벨은 선택지 텍스트에서 가로 ~62px를 가져간다 (`DESIGN.md` 「채점 결과」).
 *
 * 전환 애니메이션이 없다. 답을 제출한 직후가 집중이 가장 높은 순간이고 거기에 모션을
 * 끼우면 매번 흐름이 끊긴다 (`DESIGN.md` 「Motion」). 카드가 펼쳐지는 것은 별개다 — 누른
 * 요소가 제자리에서 반응하는 것이라 `short4`가 걸린다.
 */
export function GradedChoiceItem({
  choiceKey,
  text,
  result,
  explanation,
  isDefaultOpen = false,
}: {
  choiceKey: ChoiceKey
  text: string
  result: ChoiceResult
  /** 없으면 펼칠 것이 없는 카드다 — 정답이 둘 이상인 문항의 두 번째 정답 선택지가 그렇다. */
  explanation?: ReactNode
  isDefaultOpen?: boolean
}) {
  const { surface, icon, label } = RESULT_STYLE[result]

  const row = (
    <>
      <span>{choiceKey}</span>
      <span className="flex-1 whitespace-pre-wrap">{text}</span>
      {icon && <MaterialSymbol name={icon} />}
      {label && <span className="sr-only">{label}</span>}
    </>
  )

  if (!explanation) {
    return <div className={`choice-card ${surface}`}>{row}</div>
  }

  // `open`을 React 상태로 들지 않는다. 한 번만 주고 그 뒤의 여닫기는 브라우저가 소유한다.
  return (
    <details className={`graded-choice rounded-corner-medium ${surface}`} open={isDefaultOpen}>
      <summary className="choice-card state-layer cursor-pointer">{row}</summary>
      <div className="px-4 pb-3">{explanation}</div>
    </details>
  )
}
