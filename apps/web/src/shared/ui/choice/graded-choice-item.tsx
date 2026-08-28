import type { ChoiceKey } from '@aws-study/shared'

import type { ChoiceResult } from '@/shared/lib/choice-result'
import { MaterialSymbol, type MaterialSymbolName } from '@/shared/ui/icon/material-symbol'

/**
 * `DESIGN.md` 「채점 결과 · 선택지 표시」의 네 행. **색·아이콘·텍스트가 항상 함께 간다** —
 * 셋 중 하나만으로 전달하지 않는다.
 *
 * 안 고른 정답을 `correct-container` 채움이 아니라 `correct` 테두리로 그리는 것이 중요하다.
 * 선택된 선택지가 `secondary-container`라서 적록색약에서는 "내가 고른 것"과 "정답"이 같은
 * 면색이 된다 (`DESIGN.md` 「색으로만 갈리지 않는 쌍」 — 색각 최악 ΔE 2.2). 테두리로 그리면
 * 색으로도 갈린다.
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
 * 채점 후의 선택지. 상호작용이 없으므로 `input`을 두지 않는다 — 비활성 입력을 남기면
 * 채움색 위에 흐려진 표식이 겹쳐 정오 아이콘과 경쟁한다.
 *
 * 전환 애니메이션이 없다. 답을 제출한 직후가 집중이 가장 높은 순간이고 거기에 모션을
 * 끼우면 매번 흐름이 끊긴다 (`DESIGN.md` 「Motion」).
 */
export function GradedChoiceItem({
  choiceKey,
  text,
  result,
}: {
  choiceKey: ChoiceKey
  text: string
  result: ChoiceResult
}) {
  const { surface, icon, label } = RESULT_STYLE[result]

  return (
    <div className={`choice-card ${surface}`}>
      <span>{choiceKey}</span>
      <span className="flex-1 whitespace-pre-wrap">{text}</span>
      {icon && <MaterialSymbol name={icon} />}
      {label && <span className="text-label-medium">{label}</span>}
    </div>
  )
}
