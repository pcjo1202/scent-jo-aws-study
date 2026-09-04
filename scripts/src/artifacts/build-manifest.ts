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
const CHUNK_CDN_DIR = 'questions/'
const CHUNK_LOCAL_DIR = 'chunks/'
const CHUNK_KEY_PREFIX = `${CHUNK_CDN_DIR}chunk-`

export type FileDigest = { bytes: number; sha256: string }

export function digest(content: Buffer | string): FileDigest {
  const buffer = Buffer.from(content)
  return { bytes: buffer.byteLength, sha256: createHash('sha256').update(buffer).digest('hex') }
}

/** 골든 픽스처의 CDN 키 접두사. `data/` 밖에 있어 `toCdnKey`가 아니라 여기서 붙인다. */
export const FIXTURE_KEY_PREFIX = 'fixtures/questions/'

/** `data/` 기준 상대 경로를 CDN 키로 옮긴다. 픽스처는 `FIXTURE_KEY_PREFIX`가 맡는다. */
export function toCdnKey(localPath: string) {
  if (localPath.startsWith(CHUNK_LOCAL_DIR)) {
    return `${CHUNK_CDN_DIR}${localPath.slice(CHUNK_LOCAL_DIR.length)}`
  }
  if (localPath === 'index.json') return 'questions/index.json'
  if (localPath === 'oneliners.json' || localPath === 'comparisons.json') {
    return `notes/${localPath}`
  }
  throw new Error(`CDN 경로를 정할 수 없다: ${localPath}`)
}

/**
 * manifest 키를 레포 루트 기준 로컬 경로로 되돌린다. `toCdnKey`를 되돌리되
 * **레포 루트 기준이라 `data/`만큼 어긋난다** — 엄밀한 역함수가 아니다.
 * `data/` 밖에 사는 픽스처까지 덮는다: publish·pull이 둘 다 이 표를 쓴다.
 */
export function toLocalPath(cdnKey: string) {
  // 원격 manifest도 이 함수를 거친다 (`pull.ts`) — `..`를 통과시키면 레포 밖에 쓴다.
  if (cdnKey.split('/').includes('..')) throw new Error(`레포 밖을 가리킨다: ${cdnKey}`)
  if (cdnKey.startsWith(FIXTURE_KEY_PREFIX)) return `tests/${cdnKey}`
  if (cdnKey.startsWith(CHUNK_KEY_PREFIX)) {
    return `data/${CHUNK_LOCAL_DIR}${cdnKey.slice(CHUNK_CDN_DIR.length)}`
  }
  if (cdnKey === 'questions/index.json') return 'data/index.json'
  if (cdnKey === 'notes/oneliners.json' || cdnKey === 'notes/comparisons.json') {
    return `data/${cdnKey.slice('notes/'.length)}`
  }
  throw new Error(`로컬 경로를 정할 수 없다: ${cdnKey}`)
}

/**
 * `<root>/<version>` 형태의 base를 둘로 가른다.
 *
 * manifest.json은 버전 경로 **밖**에 있다 (`03-architecture.md` 「경로 레이아웃」) —
 * 롤백이 그 한 파일을 바꾸는 일이라 버전 안에 두면 자기를 가리키지 못한다.
 */
export function splitBase(base: string) {
  const trimmed = base.replace(/\/+$/, '')
  const cut = trimmed.lastIndexOf('/')
  const version = trimmed.slice(cut + 1)
  if (cut < 0 || !version) throw new Error(`base에 버전 경로가 없다: ${base}`)
  return { root: trimmed.slice(0, cut), version }
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
