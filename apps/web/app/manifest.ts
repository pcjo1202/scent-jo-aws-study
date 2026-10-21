import type { MetadataRoute } from 'next'

import { APP_SHORT_TITLE, APP_TITLE } from '@/shared/config/app'

import { ICON_CONTENT_TYPE, ICON_SIZES } from '@/_app/app-icon'

/**
 * iPhone 「홈 화면에 추가」로 설치해 주소창 없이 연다 (`docs/01` 「운영 환경」).
 * 테마 색 필드를 두지 않는 이유는 `DESIGN.md` 「뒤로가기는 히스토리가 아니라 라우트가 정하는 고정 링크다」.
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
      type: ICON_CONTENT_TYPE,
    })),
  }
}
