import { color } from '@scent-jo/css'
import { ImageResponse } from 'next/og'

/** 임시 아이콘이다 — 브랜드 색 위에 글자. 정식 아이콘이 나오면 이 파일째 교체한다. */
const ICON_TEXT = 'SAA'
const FONT_SIZE_RATIO = 0.32

/** manifest `icons`가 요구하는 두 크기. `app/icon.tsx`가 크기마다 하나씩 만든다. */
export const ICON_SIZES = [192, 512]

/**
 * `app/icon.tsx`·`app/apple-icon.tsx`가 함께 그린다. PNG라 CSS 변수를 못 쓰므로 DS가 JS로
 * 내보내는 토큰 값을 쓴다 (색 직접 쓰기 금지 규칙의 출구).
 */
export function renderAppIcon(size: number) {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: color.light['bg-brand'],
        color: color.light['fg-on-brand'],
        fontSize: size * FONT_SIZE_RATIO,
      }}
    >
      {ICON_TEXT}
    </div>,
    { width: size, height: size },
  )
}
