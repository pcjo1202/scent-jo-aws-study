import type { ReactNode } from 'react'

import { QueryProvider } from '@/_app/providers/query-provider'

export const metadata = {
  title: 'AWS SAA-C03 학습',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
