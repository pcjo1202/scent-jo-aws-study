'use client'

import { useSuspenseQuery } from '@tanstack/react-query'

import type { AttemptResponse, ChoiceKey, IndexEntry, Manifest } from '@aws-study/shared'

import { chunkQuery } from '@/shared/api/cdn'

import { QuestionRunner } from '@/widgets/question-runner/ui/question-runner'

/**
 * 청크는 **부분 실패**다 — 못 받으면 이 문항 자리만 오류가 되고 앱바·진행 바·다른 문항은
 * 그대로다 (`docs/02-features.md` 「정적 데이터(CDN) 실패」). 그래서 청크 조회를 이 컴포넌트로
 * 감싸고 호출부가 여기에 경계를 세운다.
 *
 * 청크 번호를 문항 id로 계산하지 않고 인덱스 엔트리에서 읽는다 — 청크 크기를 바꿔도 안
 * 깨지도록 인덱스가 매핑을 들고 있다 (`docs/04-data-model.md` 「index.json」).
 */
export function QuestionSlot({
  manifest,
  entry,
  selected,
  onToggle,
  graded,
  notes,
}: {
  manifest: Manifest
  entry: IndexEntry
  selected: ChoiceKey[]
  onToggle: (key: ChoiceKey) => void
  graded: AttemptResponse | null
  notes: Map<string, string>
}) {
  const { data: chunk } = useSuspenseQuery(chunkQuery(manifest, entry.chunk))
  const question = chunk.questions.find(({ id }) => id === entry.id)

  if (!question) {
    // 인덱스가 가리킨 청크에 그 문항이 없다면 두 파일의 버전이 갈린 것이다. 바깥 경계가
    // 잡아 「이 부분의 문제를 불러오지 못했다」로 나간다 (`docs/04` 「manifest.json」).
    throw new Error(`청크 ${entry.chunk}에 문항 ${entry.id}이 없다`)
  }

  return (
    <QuestionRunner
      question={question}
      selected={selected}
      onToggle={onToggle}
      graded={graded}
      notes={notes}
    />
  )
}
