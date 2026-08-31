import { createHash } from 'node:crypto'
import type { Manifest } from '@aws-study/shared'
import { CHUNK_SIZE } from './build-chunks.ts'

/**
 * 배포 파일 목록과 무결성 해시를 만든다 (`04-data-model.md` 「manifest.json」).
 *
 * 로컬 `data/`는 평면이고 CDN은 `questions/`·`notes/`로 갈린다
 * (`03-architecture.md` 「경로 레이아웃」). **그 대응표가 manifest다** — publish는
 * 키를 보고 올리고 클라이언트는 `base` + 키로 받는다. 따로 표를 두지 않는다.
 */

/** `04-data-model.md` 「버전 경로를 쓰는 이유」. 데이터를 고치면 v2를 새로 올린다. */
export const DEFAULT_VERSION = 'v1'
const CHUNK_KEY_PREFIX = 'questions/chunk-'

export type FileDigest = { bytes: number; sha256: string }

export function digest(content: Buffer | string): FileDigest {
  const buffer = Buffer.from(content)
  return { bytes: buffer.byteLength, sha256: createHash('sha256').update(buffer).digest('hex') }
}

/** `data/` 기준 상대 경로를 CDN 키로 옮긴다. 골든 픽스처는 `fixtures/` 아래 그대로 간다. */
export function toCdnKey(localPath: string) {
  if (localPath.startsWith('chunks/')) return `questions/${localPath.slice('chunks/'.length)}`
  if (localPath === 'index.json') return 'questions/index.json'
  if (localPath === 'oneliners.json' || localPath === 'comparisons.json') {
    return `notes/${localPath}`
  }
  throw new Error(`CDN 경로를 정할 수 없다: ${localPath}`)
}

export function buildManifest(
  files: Record<string, FileDigest>,
  options: { version: string; base: string; generatedAt: string; questionCount: number },
): Manifest {
  return {
    version: options.version,
    generatedAt: options.generatedAt,
    base: options.base,
    questions: {
      total: options.questionCount,
      chunkSize: CHUNK_SIZE,
      chunks: Object.keys(files).filter((key) => key.startsWith(CHUNK_KEY_PREFIX)).length,
    },
    files,
  }
}
