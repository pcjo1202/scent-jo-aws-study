'use client'

import { useSuspenseQuery } from '@tanstack/react-query'

import { manifestQuery, questionIndexQuery } from '@/shared/api/cdn'
import { QueryBoundary } from '@/shared/ui/query-boundary'
import { StatusBanner } from '@/shared/ui/status-banner'

import { ChunkPreview } from './chunk-preview'

/**
 * manifest → index → chunk 순서를 실제로 밟는다. 앞의 둘은 바깥 경계가 잡고(전체 실패),
 * 청크만 안쪽 경계로 내린다 (`docs/02` 「정적 데이터(CDN) 실패」).
 *
 * 청크 번호를 문항 id로 계산하지 않고 인덱스 엔트리에서 읽는 것도 여기서 확인된다
 * (`docs/04` 「index.json」).
 */
export function DataSummary() {
  const { data: manifest } = useSuspenseQuery(manifestQuery())
  const { data: index } = useSuspenseQuery(questionIndexQuery(manifest))
  const firstEntry = index.entries[0]
  if (!firstEntry) {
    // 바깥 경계가 잡는다. 1019행이 있어야 할 인덱스가 비었다면 데이터를 못 받은 것과 같다.
    throw new Error('인덱스가 비어 있다')
  }

  return (
    <section className="flex flex-col gap-4">
      {/* 이 줄은 파이프라인 진단이라 내부 단위(청크·인덱스)를 그대로 쓴다. 임시 화면이고
          SJO-27 대시보드가 이 자리를 덮어쓴다. 「문제」는 용어표를 따른다 (`DESIGN.md`
          「Content design」 — 문서에서는 문항, UI에서는 문제). */}
      <p className="text-body-medium">
        데이터 {manifest.version} · {manifest.questions.total}문제 · 청크{' '}
        {manifest.questions.chunks} · 인덱스 {index.entries.length}행
      </p>
      <QueryBoundary
        pending={<StatusBanner kind="loading">불러오는 중…</StatusBanner>}
        // 오류 문구에는 「청크」를 쓰지 않는다 — 사용자가 못 받은 것은 파일이 아니라 문제다
        // (`DESIGN.md` 「상태 배너 · 오류 문구에 기술 문자열을 넣지 않는다」).
        errorMessage="이 부분의 문제를 불러오지 못했다"
        canRetry
      >
        <ChunkPreview manifest={manifest} chunk={firstEntry.chunk} />
      </QueryBoundary>
    </section>
  )
}
