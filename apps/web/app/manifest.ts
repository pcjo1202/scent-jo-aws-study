import type { MetadataRoute } from 'next'

import { APP_SHORT_TITLE, APP_TITLE } from '@/shared/config/app'

import { ICON_SIZES } from '@/_app/app-icon'

/**
 * iPhone 「홈 화면에 추가」로 설치해 주소창 없이 연다 (`docs/01` 「운영 환경」).
 *
 * `theme_color`·`background_color`와 `<meta name="theme-color">`를 두지 않는다. 선언이 없어도
 * iOS 상태 표시줄이 화면 배경을 따라가고(앱 안 테마 토글까지), 선언은 OS 테마 하나로 그 색을
 * 덮어쓸 수 있다 — 2026-10-21 시뮬레이터 실측, SJO-69.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_TITLE,
    short_name: APP_SHORT_TITLE,
    start_url: '/',
    display: 'standalone',
    icons: ICON_SIZES.map((size) => ({
      src: `/icon/${size}`,
      sizes: `${size}x${size}`,
      type: 'image/png',
    })),
  }
}
