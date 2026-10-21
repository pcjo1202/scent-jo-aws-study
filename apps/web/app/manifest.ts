import type { MetadataRoute } from 'next'

import { APP_TITLE } from '@/shared/config/app'

/** iPhone 「홈 화면에 추가」로 설치해 주소창 없이 연다 (`docs/01` 「운영 환경」). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_TITLE,
    start_url: '/',
    display: 'standalone',
  }
}
