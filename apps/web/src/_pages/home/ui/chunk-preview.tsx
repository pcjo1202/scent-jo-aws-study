'use client'

import { useSuspenseQuery } from '@tanstack/react-query'

import type { Manifest } from '@aws-study/shared'

import { chunkQuery } from '@/shared/api/cdn'

const PREVIEW_COUNT = 3

/**
 * 청크는 **부분 실패**다. 이 컴포넌트만 오류로 바뀌고 위의 인덱스 요약은 남는다
 * (`docs/02` 「정적 데이터(CDN) 실패」). 그래서 경계가 여기 따로 선다.
 */
export function ChunkPreview({ manifest, chunk }: { manifest: Manifest; chunk: number }) {
  const { data } = useSuspenseQuery(chunkQuery(manifest, chunk))

  return (
    <ol className="flex flex-col gap-2">
      {data.questions.slice(0, PREVIEW_COUNT).map((question) => (
        <li key={question.id} className="text-body-medium text-on-surface-variant">
          {question.id}. {question.stem.split('\n')[0]}
        </li>
      ))}
    </ol>
  )
}
