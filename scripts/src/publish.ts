import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Manifest } from '@aws-study/shared'
import { digest, splitBase, toLocalPath } from './artifacts/build-manifest.ts'
import { MANIFEST_KEY, type Upload, toUploadPlan } from './artifacts/upload-plan.ts'

/**
 * `data/` + `tests/fixtures/`를 S3의 버전 경로에 올린다 (`04-data-model.md` 「data:publish」).
 *
 * 업로드 목록은 manifest의 `files` 키다 — 로컬 경로 대응표를 겸하므로 따로 두지 않는다.
 * S3 접근은 aws CLI에 맡긴다. 자격은 `aws-saa/*`로 좁힌 IAM 사용자이고
 * `s3:DeleteObject`가 없어 이 스크립트는 구조적으로 지울 수 없다 (`07-infrastructure.md`).
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const VERIFY_SCRIPT = fileURLToPath(new URL('./verify.ts', import.meta.url))
const CONTENT_TYPES: Record<string, string> = {
  json: 'application/json',
  txt: 'text/plain; charset=utf-8',
  webp: 'image/webp',
}

function main() {
  const isForced = process.argv.includes('--force')
  const bucket = requireEnv('S3_BUCKET')
  const manifest = readManifest()
  const { root, version } = splitBase(manifest.base)

  if (manifest.base !== requireEnv('DATA_CDN_BASE').replace(/\/+$/, '')) {
    fail('manifest의 base가 DATA_CDN_BASE와 다르다 — data:extract를 다시 돌린다')
    return
  }
  if (version !== manifest.version) {
    fail(`base의 버전(${version})이 manifest(${manifest.version})와 다르다`)
    return
  }

  const rootKey = new URL(root).pathname.replace(/^\//, '')
  const uploads = toUploadPlan(manifest, rootKey)
  const versionKey = `${rootKey}/${version}`

  // 구조 검증까지 통과한 것만 올린다 (`CLAUDE.md` 「CDN publish 전 data:verify를 통과해야 한다」).
  // sha256만 보면 파서가 구조적으로 깨진 산출물을 그대로 올려 v2 재배포가 된다.
  if (!runVerify()) {
    fail('data:verify가 실패했다')
    return
  }

  const missing = uploads.filter(({ localPath }) => !existsSync(`${ROOT}${localPath}`))
  if (missing.length > 0) {
    fail(`manifest에 있는데 디스크에 없는 파일 ${missing.length}개: ${keysOf(missing)}`)
    return
  }
  const mismatched = findDigestMismatches(manifest)
  if (mismatched.length > 0) {
    fail(`디스크와 manifest가 어긋난 파일 ${mismatched.length}개: ${mismatched.join(' · ')}`)
    return
  }
  console.log(`sha256 대조: ${uploads.length - 1}개 전부 일치`)

  const existing = listKeys(bucket, `${versionKey}/`)
  if (existing.length > 0 && !isForced) {
    fail(refusalMessage(manifest, existing.length))
    return
  }
  if (existing.length > 0) console.warn(`--force: 기존 ${existing.length}개를 덮어쓴다`)

  for (const [uploaded, { key, localPath, cacheControl }] of uploads.entries()) {
    putObject(bucket, key, localPath, cacheControl)
    const label =
      uploaded === uploads.length - 1 ? '마지막' : `${uploaded + 1}/${uploads.length - 1}`
    console.log(`[${label}] ${localPath}`)
  }
  console.log(`업로드 ${uploads.length}개 — ${manifest.version} 배포 완료`)
}

/**
 * `--force`가 무엇을 덮어쓰는지 가른다.
 *
 * 부분 업로드 잔재와 살아 있는 버전이 같은 플래그를 요구하면, 운영자가 양성 실패마다
 * `--force`를 쓰도록 훈련되어 정작 살아 있는 버전을 덮어쓴다.
 */
function refusalMessage(manifest: Manifest, count: number) {
  const live = readLiveVersion()
  const kind =
    live === manifest.version
      ? `manifest가 이미 ${manifest.version}을 가리킨다 — 살아 있는 버전이다. 데이터를 고쳤으면 v2로 올린다`
      : '부분 업로드 잔재로 보인다 (manifest는 아직 이 버전을 가리키지 않는다) — 이어서 올려도 된다'
  return `${manifest.version}에 이미 ${count}개가 올라가 있다. ${kind}. 그래도 덮어쓰려면 --force`
}

function readLiveVersion() {
  const local = `${ROOT}data/${MANIFEST_KEY}`
  if (!existsSync(local)) return null
  // 원격 manifest를 읽으려면 자격이 또 필요하다. 로컬 사본으로 충분한 이유는 이 판정이
  // 「덮어쓸 대상이 무엇인가」를 안내할 뿐 차단은 --force가 하기 때문이다.
  return (JSON.parse(readFileSync(local, 'utf8')) as Manifest).version
}

function readManifest() {
  return JSON.parse(readFileSync(`${ROOT}data/${MANIFEST_KEY}`, 'utf8')) as Manifest
}

function runVerify() {
  try {
    execFileSync('node', [VERIFY_SCRIPT], { stdio: ['ignore', 'inherit', 'inherit'] })
    return true
  } catch {
    return false
  }
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

/** 모르는 확장자를 조용히 넘기지 않는다 — 틀린 타입이 immutable 1년 캐시에 박히면 v2 재배포다. */
function contentTypeOf(localPath: string) {
  const extension = localPath.slice(localPath.lastIndexOf('.') + 1)
  const contentType = CONTENT_TYPES[extension]
  if (!contentType) throw new Error(`Content-Type을 정할 수 없다: .${extension}`)
  return contentType
}

/**
 * 실패 메시지를 다시 쓴다. `execFileSync`는 **인자 배열을 통째로 메시지에 박아** 던지는데,
 * 그 안에 랜덤 프리픽스를 포함한 S3 키가 들어 있다 (`CLAUDE.md` — 실제 CDN 경로 금지).
 * stderr는 `inherit`으로 이미 흘렀으므로 원인은 위에 남는다.
 */
function aws(args: string[]) {
  try {
    return execFileSync('aws', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
  } catch {
    throw new Error(`aws ${args[0]} ${args[1]} 실패 — 원인은 위 stderr에 있다`)
  }
}

function keysOf(uploads: Upload[]) {
  return uploads.map(({ localPath }) => localPath).join(' · ')
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
