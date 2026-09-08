import type { ReactNode } from 'react'

import { APP_TITLE } from '@/shared/config/app'

import { QueryProvider } from '@/_app/providers/query-provider'
import { ThemeScript } from '@/_app/theme-script'

import '@/shared/styles/global.css'

export const metadata = {
  title: APP_TITLE,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // ThemeScript가 data-theme을 서버 마크업에 없던 값으로 채운다.
    <html lang="ko" suppressHydrationWarning>
      <body>
        <ThemeScript />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
