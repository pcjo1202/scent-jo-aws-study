import type { Manifest } from '@aws-study/shared'
import { describe, expect, it } from 'vitest'
import { IMMUTABLE_CACHE, MANIFEST_CACHE, toUploadPlan } from './upload-plan.ts'

function manifestOf(keys: string[]): Manifest {
  return {
    version: 'v1',
    generatedAt: '2026-09-04T00:00:00.000Z',
    base: 'https://cdn.example/aws-saa/abc123/v1',
    questions: { total: 1019, chunkSize: 100, chunks: 11 },
    files: Object.fromEntries(keys.map((key) => [key, { bytes: 1, sha256: 'x' }])),
  }
}

const ROOT_KEY = 'aws-saa/abc123'

describe('toUploadPlan', () => {
  it('manifest를 마지막에 둔다 — 중간에 죽어도 옛 버전을 가리키게 하는 유일한 장치다', () => {
    const plan = toUploadPlan(
      manifestOf(['questions/index.json', 'notes/oneliners.json']),
      ROOT_KEY,
    )

    expect(plan.at(-1)).toEqual({
      key: 'aws-saa/abc123/manifest.json',
      localPath: 'data/manifest.json',
      cacheControl: MANIFEST_CACHE,
    })
    expect(plan.filter((upload) => upload.localPath === 'data/manifest.json')).toHaveLength(1)
  })

  it('manifest만 버전 경로 밖에 올린다 — 안에 두면 롤백할 때 자기를 못 찾는다', () => {
    const plan = toUploadPlan(manifestOf(['questions/index.json']), ROOT_KEY)

    expect(plan[0]?.key).toBe('aws-saa/abc123/v1/questions/index.json')
    expect(plan.at(-1)?.key).toBe('aws-saa/abc123/manifest.json')
  })

  it('데이터는 immutable, manifest만 짧은 캐시다', () => {
    const plan = toUploadPlan(
      manifestOf(['questions/index.json', 'fixtures/questions/1.txt']),
      ROOT_KEY,
    )

    expect(plan.slice(0, -1).map((upload) => upload.cacheControl)).toEqual([
      IMMUTABLE_CACHE,
      IMMUTABLE_CACHE,
    ])
    expect(plan.at(-1)?.cacheControl).toBe(MANIFEST_CACHE)
  })

  it('픽스처는 data/ 밖 로컬 경로로 옮긴다 — 거기서 읽어야 올라간다', () => {
    const plan = toUploadPlan(manifestOf(['fixtures/questions/1.json']), ROOT_KEY)

    expect(plan[0]?.localPath).toBe('tests/fixtures/questions/1.json')
  })
})
