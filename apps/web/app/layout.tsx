import type { ReactNode } from 'react'

import { QueryProvider } from '@/_app/providers/query-provider'
import { DARK_SCHEME_QUERY, THEME_STORAGE_KEY } from '@/shared/lib/theme'

import '@/shared/styles/global.css'

export const metadata = {
  title: 'AWS SAA-C03 학습',
}

/**
 * 첫 페인트 전에 `data-theme`을 확정한다. body 첫 자식의 동기 스크립트라 본문 마크업이
 * 파싱되기 전에 실행되고, 하이드레이션을 기다리지 않으므로 라이트 화면이 번쩍이지 않는다.
 *
 * 여기서 `system`을 light/dark로 해석해 넣기 때문에 CSS는 `[data-theme='dark']` 한 블록만
 * 갖는다 — `prefers-color-scheme` 분기가 CSS와 여기 둘로 갈라지지 않게 하려는 것이다.
 * 키·모드 값은 `shared/lib/theme`이 소유하고 여기서는 심어 쓰기만 한다.
 */
const themeScript = `(function () {
  var mode = 'system'
  try {
    mode = localStorage.getItem('${THEME_STORAGE_KEY}') || 'system'
  } catch (error) {
    mode = 'system'
  }
  var isDark = mode === 'dark' || (mode === 'system' && matchMedia('${DARK_SCHEME_QUERY}').matches)
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
})()`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // 위 스크립트가 data-theme을 서버 마크업에 없던 값으로 채운다.
    <html lang="ko" suppressHydrationWarning>
      <body>
        {/* head에 두면 React가 "scripts inside React components are never executed
            when rendering on the client" 경고를 낸다. body 첫 자식이면 경고가 없고,
            렌더 블로킹 스타일시트 뒤·본문 마크업 앞이라 실행 시점은 같다. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
