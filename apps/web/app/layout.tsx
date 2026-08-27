import type { ReactNode } from 'react'

export const metadata = {
  title: 'AWS SAA-C03 학습',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
