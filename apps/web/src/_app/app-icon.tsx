import { color } from '@scent-jo/css'
import { ImageResponse } from 'next/og'

/** 임시 아이콘이다 — 브랜드 색 위에 글자. 정식 아이콘이 나오면 이 파일째 교체한다. */
const ICON_TEXT = 'SAA'
const FONT_SIZE_RATIO = 0.32

/**
 * 웹 앱 manifest 관례(Chrome 설치 기준)의 두 크기. iOS 홈 화면은 `app/apple-icon.tsx`(180)를 쓰고,
 * 이 둘은 지금 manifest `icons`와 탭의 `<link rel="icon">`에만 쓰인다. `app/icon.tsx`가 크기마다
 * `/icon/<크기>`로 하나씩 만든다 — manifest의 `src`가 이 경로를 가정한다.
 */
export const ICON_SIZES = [192, 512]

/** `renderAppIcon`의 출력 형식. 아이콘 라우트의 메타데이터와 manifest `type`이 함께 쓴다. */
export const ICON_CONTENT_TYPE = 'image/png'

/**
 * `app/icon.tsx`·`app/apple-icon.tsx`가 함께 그린다. PNG라 CSS 변수를 못 쓰므로 DS가 JS로
 * 내보내는 토큰 값을 쓴다 (`docs/10` 「CSS 변수를 못 쓰는 자리」).
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
