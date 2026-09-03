import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Manifest } from '@aws-study/shared'
import { digest, splitBase, toLocalPath } from './artifacts/build-manifest.ts'
import { MANIFEST_KEY } from './artifacts/upload-plan.ts'

/**
 * CDN에서 `data/`와 `tests/fixtures/`를 복원한다 (`04-data-model.md` 「data:pull」).
 *
 * 추출 데이터는 저작권 자료라 git에 없고 **CDN이 유일한 원본이다**
 * (`03-architecture.md` 「저장소 정책」) — 새 기기는 이 경로로만 복구된다.
 * S3가 아니라 CDN을 읽으므로 AWS 자격이 필요 없다.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url))

async function main() {
  const base = requireEnv('DATA_CDN_BASE').replace(/\/+$/, '')
  const { root, version } = splitBase(base)

  const manifest = (await fetchJson(`${root}/${MANIFEST_KEY}`)) as Manifest
  if (manifest.version !== version) {
    fail(`CDN의 manifest는 ${manifest.version}인데 DATA_CDN_BASE는 ${version}을 가리킨다`)
    return
  }
  if (manifest.base !== base) {
    fail(`CDN의 manifest가 다른 base(${manifest.base})를 가리킨다`)
    return
  }

  const files = Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b))
  const corrupted: string[] = []
  // 전부 받아 검증한 뒤에 쓴다. 받는 족족 쓰면 중간에 하나가 어긋났을 때
  // 「CDN이 유일한 원본」인 트리를 반쯤 갈아엎은 채 끝난다 — 복구 스크립트가
  // 만들면 안 되는 상태다. 26개 · 약 1.5MB라 전부 메모리에 들어간다.
  const verified: Array<[string, Buffer]> = []

  for (const [downloaded, [key, expected]] of files.entries()) {
    const body = Buffer.from(await fetchBytes(`${manifest.base}/${key}`))
    const actual = digest(body)
    if (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes) {
      corrupted.push(key)
      continue
    }
    verified.push([toLocalPath(key), body])
    console.log(`[${downloaded + 1}/${files.length}] ${key} · sha256 일치`)
  }

  if (corrupted.length > 0) {
    fail(`sha256이 어긋난 파일 ${corrupted.length}개: ${corrupted.join(' · ')}`)
    return
  }

  for (const [localPath, body] of verified) write(localPath, body)
  write(`data/${MANIFEST_KEY}`, Buffer.from(JSON.stringify(manifest)))
  console.log(
    `복원 ${files.length}개 + manifest · sha256 ${files.length}/${files.length} 일치 (${manifest.version})`,
  )
}

function write(localPath: string, body: Buffer) {
  const target = `${ROOT}${localPath}`
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, body)
}

async function fetchJson(url: string) {
  return JSON.parse(Buffer.from(await fetchBytes(url)).toString('utf8')) as unknown
}

async function fetchBytes(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${url}`)
  return response.arrayBuffer()
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name}이 없다 — scripts/.env (docs/06)`)
  return value
}

function fail(message: string) {
  console.error(`${message} — 복원하지 않는다`)
  process.exitCode = 1
}

await main()
