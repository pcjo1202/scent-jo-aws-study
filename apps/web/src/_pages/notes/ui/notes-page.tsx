import { AppBar } from '@/shared/ui/app-bar'
import { QueryBoundary } from '@/shared/ui/query-boundary'
import { StatusBanner } from '@/shared/ui/status-banner'

import { NotesScreen } from './notes-screen'

export const metadata = { title: '암기 노트' }

/**
 * 암기 노트 (`docs/02-features.md` 「`/notes` 암기 노트」).
 *
 * **서버 prefetch가 없다.** 이 화면이 읽는 것은 CDN뿐이고, CDN 조회는 `/study`도 서버에서
 * 미리 받지 않는다 — 브라우저가 어차피 같은 파일을 CDN에서 받는데 서버가 먼저 받아 RSC
 * 페이로드에 실으면 68KB를 두 번 나른다.
 *
 * manifest·index는 `(app)/layout.tsx`의 `CatalogGate`가 이미 세워 뒀다. 여기서 세우는 경계는
 * **노트 둘**뿐이고 그래서 문구도 노트 쪽이다 — 두 경계를 하나로 합치면 노트 5xx가
 * 「문제 데이터를 불러오지 못했다」로 나간다.
 */
export function NotesPage() {
  return (
    <QueryBoundary
      pending={
        <>
          <AppBar title="암기 노트" backHref="/" />
          <div className="app-bar-gutter-top">
            <main className="mx-auto max-w-reading px-screen py-6">
              <StatusBanner kind="loading">불러오는 중…</StatusBanner>
            </main>
          </div>
        </>
      }
      errorMessage="암기 노트를 불러오지 못했다"
      canRetry
    >
      <NotesScreen />
    </QueryBoundary>
  )
}
