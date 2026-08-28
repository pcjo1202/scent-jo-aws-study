import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

/**
 * 원본 PDF의 위치와 식별.
 *
 * 원본은 저작권 자료라 레포에 두지 않고 기기마다 경로가 다르다
 * (`04-data-model.md` 「data:extract」). 파일 식별은
 * `01-requirements.md` 「자료 구성」의 번호 접두사를 따른다.
 */

/** `01-requirements.md` 「자료 구성」의 파일 번호. */
export const SOURCE_FILE_NUMBERS = {
  anatomy: 1,
  notesDesktop: 2,
  notesMobile: 3,
  questionsFirstHalf: 4,
  questionsSecondHalf: 5,
} as const

export function findSourcePdf(fileNumber: number): string {
  const dir = requireSourcePdfDir()
  const prefix = `${fileNumber}.`
  const matches = readdirSync(dir).filter(
    (name) => name.startsWith(prefix) && name.toLowerCase().endsWith('.pdf'),
  )

  if (matches.length === 0) {
    throw new Error(
      `SOURCE_PDF_DIR에 ${prefix}로 시작하는 PDF가 없다: ${dir}\n` +
        `docs/01-requirements.md 「자료 구성」의 번호 접두사를 그대로 쓴다.`,
    )
  }
  if (matches.length > 1) {
    throw new Error(`${prefix}로 시작하는 PDF가 여러 개다: ${matches.join(', ')}`)
  }

  return join(dir, matches[0]!)
}

/** PDF의 전체 텍스트. 레이아웃을 보존해야 선택지 들여쓰기가 남는다. */
export function readPdfText(path: string): string {
  return execFileSync('pdftotext', ['-layout', path, '-'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
}

function requireSourcePdfDir() {
  const dir = process.env.SOURCE_PDF_DIR
  if (!dir) {
    throw new Error(
      'SOURCE_PDF_DIR이 설정되지 않았다. scripts/.env.example을 복사해 채운다 (docs/06).',
    )
  }
  return dir
}
