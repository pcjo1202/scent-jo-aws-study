import { mergeRenderings } from '../text/merge-renderings.ts'

/**
 * 모바일 노트의 한줄노트 카드를 읽는다 (`04-data-model.md` 「oneliners.json」).
 *
 * 카드는 `[카테고리]`와 `[서비스명, ...노트 줄]` 두 그룹으로 나뉘어 나온다.
 * 카테고리가 바뀌는 자리에는 카드 없는 카테고리 그룹이 하나 더 온다(원본의 섹션
 * 구분자). 카드가 **직전 카테고리 그룹**을 쓰게 두면 그 구분자는 다음 그룹에
 * 덮여 저절로 사라진다 — 구분자를 따로 판별하지 않는다.
 *
 * 서비스명은 유일하지 않다. 같은 서비스가 카테고리를 달리해 두 번 실리는 경우가
 * 있다.
 */

export type OneLiner = {
  service: string
  category: string
  note: string
}

/** 한 판본이 읽은 카드. 줄 잇기는 판본을 합칠 때 한다 (`mergeOneLiners`). */
export type OneLinerLines = {
  service: string[]
  category: string
  note: string[]
}

export function parseOneLiners(groups: string[][]): OneLinerLines[] {
  const cards: OneLinerLines[] = []
  let category: string | undefined

  for (const group of groups) {
    const [head, ...rest] = group
    if (head === undefined) continue

    if (rest.length === 0) {
      category = head.trim()
      continue
    }
    if (category === undefined) {
      throw new Error(`카테고리 없이 시작하는 카드: ${head.trim()}`)
    }

    cards.push({ service: [head], category, note: rest })
  }

  return cards
}

/**
 * 여러 판본의 같은 목록을 합쳐 공백까지 복원한다.
 *
 * 판본끼리 개수·순서·카테고리가 어긋나거나 읽어 낸 글자가 다르면 던진다 — 두 판본을
 * 서로의 정답지로 쓰는 대조 검증이고, 이것이 개수를 사실로 만드는 근거다.
 */
export function mergeOneLiners(renderings: OneLinerLines[][]): {
  items: OneLiner[]
  unknownSeams: number
} {
  const [first, ...rest] = renderings
  if (first === undefined) throw new Error('합칠 판본이 없다')

  for (const other of rest) {
    if (other.length !== first.length) {
      throw new Error(`판본의 한줄노트 개수가 다르다: ${first.length} vs ${other.length}`)
    }
  }

  const items: OneLiner[] = []
  let unknownSeams = 0

  for (const [index, card] of first.entries()) {
    const versions = renderings.map((rendering) => rendering[index]!)
    const categories = new Set(versions.map((version) => version.category))
    if (categories.size > 1) {
      throw new Error(`판본의 카테고리가 다르다 (${index}번): ${[...categories].join(' vs ')}`)
    }

    const service = mergeRenderings(versions.map((version) => version.service))
    const note = mergeRenderings(versions.map((version) => version.note))
    unknownSeams += service.unknownSeams + note.unknownSeams

    items.push({ service: service.text, category: card.category, note: note.text })
  }

  return { items, unknownSeams }
}
