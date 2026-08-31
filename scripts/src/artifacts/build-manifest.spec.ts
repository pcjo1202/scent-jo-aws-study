import { describe, expect, it } from 'vitest'
import { buildManifest, digest, toCdnKey } from './build-manifest.ts'

describe('toCdnKey', () => {
  it('평면인 로컬 경로를 CDN 트리로 옮긴다 — publish가 이 표를 쓴다', () => {
    expect(toCdnKey('chunks/chunk-001.json')).toBe('questions/chunk-001.json')
    expect(toCdnKey('index.json')).toBe('questions/index.json')
    expect(toCdnKey('oneliners.json')).toBe('notes/oneliners.json')
    expect(toCdnKey('comparisons.json')).toBe('notes/comparisons.json')
  })

  it('모르는 파일은 조용히 통과시키지 않는다 — 빠진 채로 배포되면 못 찾는다', () => {
    expect(() => toCdnKey('anatomy/toc.json')).toThrow('CDN 경로를 정할 수 없다')
  })
})

describe('digest', () => {
  it('내용이 한 글자만 달라도 해시가 갈린다', () => {
    expect(digest('abc').sha256).not.toBe(digest('abd').sha256)
    expect(digest('abc')).toEqual(digest('abc'))
  })

  it('bytes는 UTF-8 바이트 수다 — 한글은 글자 수와 다르다', () => {
    expect(digest('가나다').bytes).toBe(9)
  })
})

describe('buildManifest', () => {
  it('청크 수를 파일 목록에서 센다 — 따로 받은 숫자를 믿지 않는다', () => {
    const files = Object.fromEntries(
      ['questions/chunk-001.json', 'questions/chunk-002.json', 'questions/index.json'].map(
        (key) => [key, digest(key)],
      ),
    )

    const manifest = buildManifest(files, {
      version: 'v1',
      base: 'https://cdn.example/aws-saa/v1',
      generatedAt: '2026-08-31T00:00:00.000Z',
      questionCount: 1019,
    })

    expect(manifest.questions).toEqual({ total: 1019, chunkSize: 100, chunks: 2 })
    expect(manifest.files).toBe(files)
  })
})
