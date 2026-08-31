import type { Chunk, IndexEntry, Question } from '@aws-study/shared'

/**
 * 문항을 배포 단위로 자르고 인덱스를 만든다 (`04-data-model.md` 「chunk-NNN.json」·「index.json」).
 *
 * 인덱스의 `categories`·`services`는 새로 계산하지 않고 문항에 붙어 있는 것을
 * 그대로 옮긴다 — 두 곳에서 따로 태깅하면 조용히 갈라진다.
 */

/** `04-data-model.md` 「chunk-NNN.json」. 1019문항이 11청크가 되고 마지막이 19문항이다. */
export const CHUNK_SIZE = 100

export function chunkQuestions(questions: Question[]): Chunk[] {
  // 청크 경계는 id 순서로만 뜻이 있다. 두 PDF를 이어 읽으므로 입력 순서를 믿지 않는다.
  const ordered = [...questions].sort((a, b) => a.id - b.id)

  const chunks: Chunk[] = []
  for (let offset = 0; offset < ordered.length; offset += CHUNK_SIZE) {
    const slice = ordered.slice(offset, offset + CHUNK_SIZE)
    chunks.push({
      chunk: chunks.length + 1,
      from: slice[0]!.id,
      to: slice.at(-1)!.id,
      questions: slice,
    })
  }
  return chunks
}

export function buildIndex(chunks: Chunk[]): IndexEntry[] {
  return chunks.flatMap((chunk) =>
    chunk.questions.map((question) => ({
      id: question.id,
      chunk: chunk.chunk,
      categories: question.categories,
      services: question.services,
      answer: question.answer,
      choiceCount: question.choices.length,
    })),
  )
}

/** `chunk-001.json`. 자릿수를 고정해 CDN 경로가 정렬 순서로 읽힌다. */
export function chunkFileName(chunk: number) {
  return `chunk-${String(chunk).padStart(3, '0')}.json`
}
