import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Manifest } from '@aws-study/shared'
import { digest, splitBase, toLocalPath } from './artifacts/build-manifest.ts'

/**
 * `data/` + `tests/fixtures/`를 S3의 버전 경로에 올린다 (`04-data-model.md` 「data:publish」).
 *
 * 업로드 목록은 manifest의 `files` 키다 — 로컬 경로 대응표를 겸하므로 따로 두지 않는다.
 * S3 접근은 aws CLI에 맡긴다. 자격은 `aws-saa/*`로 좁힌 IAM 사용자이고
 * `s3:DeleteObject`가 없어 이 스크립트는 구조적으로 지울 수 없다 (`07-infrastructure.md`).
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const MANIFEST_KEY = 'manifest.json'
/** `03-architecture.md` 「경로 레이아웃」. 버전 경로라 내용이 바뀔 일이 없다. */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'
/** manifest만 짧다 — 롤백이 이 한 파일을 바꾸는 일이라 오래 캐시하면 되돌릴 수 없다. */
const MANIFEST_CACHE = 'public, max-age=300'

function main() {
  const isForced = process.argv.includes('--force')
  const bucket = requireEnv('S3_BUCKET')
  const manifest = readManifest()
  const { root, version } = splitBase(manifest.base)

  if (manifest.base !== requireEnv('DATA_CDN_BASE').replace(/\/$/, '')) {
    fail(`manifest의 base가 DATA_CDN_BASE와 다르다 — data:extract를 다시 돌린다`)
    return
  }
  if (version !== manifest.version) {
    fail(`base의 버전(${version})이 manifest(${manifest.version})와 다르다`)
    return
  }

  const rootKey = new URL(root).pathname.replace(/^\//, '')
  const versionKey = `${rootKey}/${version}`
  const keys = Object.keys(manifest.files).sort()

  const mismatched = findDigestMismatches(manifest)
  if (mismatched.length > 0) {
    fail(`디스크와 manifest가 어긋난 파일 ${mismatched.length}개: ${mismatched.join(' · ')}`)
    return
  }
  console.log(`sha256 대조: ${keys.length}개 전부 일치`)

  const existing = listKeys(bucket, `${versionKey}/`)
  if (existing.length > 0 && !isForced) {
    fail(`${manifest.version}에 이미 ${existing.length}개가 올라가 있다 (덮어쓰려면 --force)`)
    return
  }
  if (existing.length > 0) console.warn(`--force: 기존 ${existing.length}개를 덮어쓴다`)

  for (const [uploaded, key] of keys.entries()) {
    putObject(bucket, `${versionKey}/${key}`, toLocalPath(key), IMMUTABLE_CACHE)
    console.log(`[${uploaded + 1}/${keys.length}] ${key}`)
  }

  // manifest는 마지막이다 — 데이터가 다 올라간 뒤에 가리켜야 한다 (`04-data-model.md`).
  putObject(bucket, `${rootKey}/${MANIFEST_KEY}`, `data/${MANIFEST_KEY}`, MANIFEST_CACHE)
  console.log(`[마지막] ${MANIFEST_KEY} (${MANIFEST_CACHE})`)
  console.log(`업로드 ${keys.length + 1}개 — ${manifest.version} 배포 완료`)
}

function readManifest() {
  return JSON.parse(readFileSync(`${ROOT}data/${MANIFEST_KEY}`, 'utf8')) as Manifest
}

/**
 * manifest가 적어 둔 해시를 디스크와 다시 대조한다.
 *
 * `data:verify`가 이미 보지만 그 뒤에 파일이 바뀔 수 있고, 어긋난 채 올라가면
 * 클라이언트가 무결성 검사에서 통째로 막힌다 — 되돌리는 값이 v2 재배포다.
 */
function findDigestMismatches(manifest: Manifest) {
  return Object.entries(manifest.files)
    .filter(([key, expected]) => {
      const actual = digest(readFileSync(`${ROOT}${toLocalPath(key)}`))
      return actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes
    })
    .map(([key]) => key)
}

/**
 * 같은 버전에 이미 올라간 것이 있는지 본다.
 *
 * `head-object`가 아니라 목록이다 — `s3:ListBucket`에 `s3:prefix` 조건이 걸려 있어
 * HEAD는 없는 키에 404가 아니라 403을 돌려준다 (2026-09-04 원문 대조, S3 HeadObject).
 */
function listKeys(bucket: string, prefix: string) {
  const output = aws([
    's3api',
    'list-objects-v2',
    '--bucket',
    bucket,
    '--prefix',
    prefix,
    '--query',
    'Contents[].Key',
    '--output',
    'json',
  ])
  return (JSON.parse(output) as string[] | null) ?? []
}

function putObject(bucket: string, key: string, localPath: string, cacheControl: string) {
  aws([
    's3api',
    'put-object',
    '--bucket',
    bucket,
    '--key',
    key,
    '--body',
    `${ROOT}${localPath}`,
    '--cache-control',
    cacheControl,
    '--content-type',
    contentTypeOf(localPath),
    '--output',
    'json',
  ])
}

/** `.txt` 픽스처가 `application/json`으로 내려가면 브라우저가 파싱하려 든다. */
function contentTypeOf(localPath: string) {
  return localPath.endsWith('.txt') ? 'text/plain; charset=utf-8' : 'application/json'
}

function aws(args: string[]) {
  return execFileSync('aws', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name}이 없다 — scripts/.env (docs/06)`)
  return value
}

function fail(message: string) {
  console.error(`${message} — 배포하지 않는다`)
  process.exitCode = 1
}

main()
