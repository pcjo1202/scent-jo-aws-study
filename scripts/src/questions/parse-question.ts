import type { Choice, ChoiceKey } from '@aws-study/shared'
import type { QuestionBlock } from './split-blocks.ts'
import { joinWrappedLines } from '../text/join-wrapped-lines.ts'
import type { SeamOracle } from '../text/seam-oracle.ts'

/**
 * 문항 블록 하나를 구조로 바꾼다 (`04-data-model.md` 「Question」).
 *
 * 블록은 항상 같은 순서다. 절이 빠져도 앞뒤 절이 서로 먹지 않게 만든다 —
 * 헤딩을 못 찾으면 빈 구간으로 본다. 현 코퍼스에서는 1019문항 모두 세 절을
 * 갖고 있어 이 경로를 타지 않지만, 방어를 걷으면 v2에서 조용히 깨진다.
 *
 *   <지문>
 *   A. <선택지> …
 *   정답: A, C / 정답 및 해설
 *   요구사항/조건        <불릿>
 *   정답은 A입니다.
 *   정답 해설            <해설>
 *   오답 해설            B. <선택지 재기술> <반박>
 */

const ANSWER_LINE = /^\s*정답:\s*([A-F](?:,\s*[A-F])*)\s*\/\s*정답 및 해설\s*$/
// Q.477처럼 키만 있고 본문이 다음 줄부터 시작하는 선택지가 있다.
const CHOICE_LINE = /^\s{0,4}([A-F])\.(?:\s+(.*))?$/
const REQUIREMENTS_HEADING = '요구사항/조건'
const VERDICT_LINE = /^\s*정답은\s+[A-F].*입니다\.\s*$/
const EXPLANATION_HEADING = '정답 해설'
const REBUTTALS_HEADING = '오답 해설'
const WHITESPACE = /\s/

export type { Choice }

export type ParsedQuestion = {
  id: number
  stem: string
  choices: Choice[]
  answer: ChoiceKey[]
  requirements: string[]
  explanation: string
  rebuttals: Choice[]
}

export function parseQuestion(block: QuestionBlock, seamHasSpace?: SeamOracle): ParsedQuestion {
  function join(lines: string[]) {
    return joinWrappedLines(lines, seamHasSpace)
  }
  const answerIndex = block.lines.findIndex((line) => ANSWER_LINE.test(line))
  if (answerIndex === -1) {
    throw new Error(`Q.${block.id}: 정답 줄을 찾지 못했다`)
  }

  const head = block.lines.slice(0, answerIndex)
  const tail = block.lines.slice(answerIndex + 1)
  const firstChoiceIndex = head.findIndex((line) => CHOICE_LINE.test(line))
  if (firstChoiceIndex === -1) {
    throw new Error(`Q.${block.id}: 선택지를 찾지 못했다`)
  }

  const choices = collectKeyedBlocks(head.slice(firstChoiceIndex)).map((b) => toChoice(b, join))

  return {
    id: block.id,
    stem: join(head.slice(0, firstChoiceIndex)),
    choices,
    answer: parseAnswer(block.lines[answerIndex]!, block.id),
    requirements: parseRequirements(tail, join),
    explanation: parseExplanation(tail, join),
    rebuttals: parseRebuttals(tail, choices, join),
  }
}

function parseAnswer(line: string, id: number) {
  const matched = ANSWER_LINE.exec(line)
  if (!matched) throw new Error(`Q.${id}: 정답을 읽지 못했다`)
  // ANSWER_LINE이 [A-F]만 통과시킨다.
  return matched[1]!.split(',').map((key) => key.trim() as ChoiceKey)
}

type Join = (lines: string[]) => string

/**
 * **인쇄된 줄 하나가 항목 하나다.**
 *
 * 원본의 불릿에는 글머리 기호가 없고, 접힌 줄의 들여쓰기가 앞줄과 같다. 가를
 * 만한 신호를 재 봤지만 쓸 것이 없었다 — 줄 폭은 문항마다 본문 상자가 달라
 * (107~115칸) 임계값이 서지 않고, 종결형은 불릿이 "집계"·"보유"·"것" 같은
 * 명사형으로 끝나 구분되지 않는다.
 *
 * 그래서 접힌 불릿은 두 항목으로 나뉜다 — 1019문항 중 7문항이 해당한다.
 * 표시 전용 필드이고(`04-data-model.md` 「Question」), 서로 다른 두 조건을
 * 잘못 이어 붙여 한 항목으로 만드는 것보다 낫다.
 */
function parseRequirements(tail: string[], join: Join) {
  const section = sliceSection(tail, REQUIREMENTS_HEADING, [EXPLANATION_HEADING, REBUTTALS_HEADING])
  return section
    .filter((line) => line.trim() && !VERDICT_LINE.test(line))
    .map((line) => join([line]))
}

function parseExplanation(tail: string[], join: Join) {
  return join(sliceSection(tail, EXPLANATION_HEADING, [REBUTTALS_HEADING]))
}

function parseRebuttals(tail: string[], choices: Choice[], join: Join) {
  const section = sliceSection(tail, REBUTTALS_HEADING, [])
  const byKey = new Map(choices.map((choice) => [choice.key, choice.text]))

  return collectKeyedBlocks(section).map(({ key, lines }) => ({
    key,
    text: stripRestatedChoice(join(lines), byKey.get(key)),
  }))
}

function withoutWhitespace(text: string) {
  return text.replaceAll(/\s/g, '')
}

/**
 * 오답 해설은 선택지 원문을 다시 적은 뒤 반박을 잇는다. 재기술을 떼지 않으면
 * 선택지 텍스트가 해설에 한 번 더 실려 데이터가 두 배로 부푼다.
 *
 * 두 곳의 줄바꿈 위치가 달라 공백이 어긋난다. 코드 줄이 섞이면 줄바꿈까지 끼므로
 * 공백과 줄바꿈을 모두 지운 문자열로 대조한다.
 */
export function stripRestatedChoice(text: string, choiceText: string | undefined): string {
  if (!choiceText) return text

  const target = withoutWhitespace(choiceText)
  let seen = ''
  for (let i = 0; i < text.length; i += 1) {
    if (!WHITESPACE.test(text[i]!)) seen += text[i]
    if (seen === target) return text.slice(i + 1).trim()
    if (!target.startsWith(seen)) return text
  }
  return text
}

/** `A. …` 로 시작하는 덩어리들. 다음 키가 나올 때까지가 한 덩어리다. */
function collectKeyedBlocks(lines: string[]) {
  const blocks: Array<{ key: ChoiceKey; lines: string[] }> = []
  let current: { key: ChoiceKey; lines: string[] } | undefined

  for (const line of lines) {
    const matched = CHOICE_LINE.exec(line)
    if (matched) {
      // CHOICE_LINE이 [A-F]만 통과시킨다.
      current = { key: matched[1] as ChoiceKey, lines: matched[2] ? [matched[2]] : [] }
      blocks.push(current)
      continue
    }
    if (current && line.trim()) current.lines.push(line)
  }

  return blocks
}

function toChoice({ key, lines }: { key: ChoiceKey; lines: string[] }, join: Join) {
  return { key, text: join(lines) }
}

/** `heading` 다음 줄부터 `stopAt` 중 하나가 나오기 전까지. heading이 없으면 빈 배열. */
function sliceSection(lines: string[], heading: string, stopAt: string[]) {
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start === -1) return []

  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => stopAt.includes(line.trim()))
  return end === -1 ? rest : rest.slice(0, end)
}
