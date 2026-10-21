import type { CSSProperties, ReactNode } from 'react'
import type { IconName } from '@scent-jo/css'
import { Icon } from '@scent-jo/react'

import type { ChoiceKey } from '@aws-study/shared'

import type { ChoiceResult } from '@/shared/lib/choice-result'
import { CHOICE_CARD_CLASS } from '@/shared/ui/choice/choice-card'

/**
 * DS에 semantic 테두리 색은 default·strong·focus뿐이라 success 테두리를 글자색 토큰으로 칠한다.
 * 토큰이 생기면 `border-success`로 바꾼다 (scent-jo-ds#20).
 */
const SUCCESS_BORDER: CSSProperties = { borderColor: 'var(--sj-color-fg-success)' }

/**
 * `DESIGN.md` 「채점 결과 · 선택지 표시」의 네 행. **면(채움 / 테두리 / 없음) × 아이콘(체크 /
 * 엑스 / 없음)** 두 축이라 색을 전부 걷어내도 네 경우가 갈린다 (「색 단독 전달 금지」).
 *
 * 안 고른 정답을 채움이 아니라 테두리로 그리는 것이 중요하다. 채움이면 「내가 고른 정답」과
 * 흑백에서 같은 카드가 된다.
 */
const RESULT_STYLE: Record<
  ChoiceResult,
  {
    surface: string
    style?: CSSProperties
    icon: { name: IconName; className: string } | null
    label: string | null
  }
> = {
  'chosen-correct': {
    surface: 'border border-transparent bg-success-weak',
    icon: { name: 'check', className: 'text-success' },
    label: '정답',
  },
  'chosen-wrong': {
    surface: 'border border-transparent bg-danger-weak',
    icon: { name: 'close', className: 'text-danger' },
    label: '내 선택',
  },
  'missed-correct': {
    surface: 'border-2 bg-default',
    style: SUCCESS_BORDER,
    icon: { name: 'check', className: 'text-success' },
    label: '정답',
  },
  'unchosen-wrong': {
    surface: 'border border-default bg-default text-secondary',
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
 * 이미 갈린다 (`DESIGN.md` 「채점 결과 · 선택지 표시」).
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
  const { surface, style, icon, label } = RESULT_STYLE[result]

  const row = (
    <>
      <span>{choiceKey}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap">{text}</span>
      {icon && <Icon name={icon.name} className={icon.className} />}
      {label && <span className="sr-only">{label}</span>}
    </>
  )

  if (!explanation) {
    return (
      <div className={`${CHOICE_CARD_CLASS} ${surface}`} style={style}>
        {row}
      </div>
    )
  }

  // `open`을 React 상태로 들지 않는다. 한 번만 주고 그 뒤의 여닫기는 브라우저가 소유한다.
  // 펼침 화살표를 두지 않는다 — 카드 전체가 클릭 영역이다 (`DESIGN.md` 「채점 결과 · 선택지 표시」).
  return (
    <details className={`rounded-3 ${surface}`} style={style} open={isDefaultOpen}>
      <summary
        className={`${CHOICE_CARD_CLASS} sj-pressed-overlay cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
      >
        {row}
      </summary>
      {/* 「글자를 낮춘다」는 선택지 글자다. 펼친 해설은 읽을 본문이라 낮추지 않는다. */}
      <div className="px-4 pb-3 text-primary">{explanation}</div>
    </details>
  )
}
