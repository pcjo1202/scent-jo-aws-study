import { describe, expect, it } from 'vitest'
import { buildManifest, digest, splitBase, toCdnKey, toLocalPath } from './build-manifest.ts'

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

describe('toLocalPath', () => {
  it('toCdnKey를 되돌린다 — publish·pull이 같은 표를 반대로 읽는다', () => {
    for (const local of [
      'chunks/chunk-001.json',
      'index.json',
      'oneliners.json',
      'comparisons.json',
    ]) {
      expect(toLocalPath(toCdnKey(local))).toBe(`data/${local}`)
    }
  })

  it('픽스처는 data/ 밖으로 되돌린다 — 거기 쓰면 data:verify가 못 찾는다', () => {
    expect(toLocalPath('fixtures/questions/1.json')).toBe('tests/fixtures/questions/1.json')
  })

  it('모르는 키는 조용히 통과시키지 않는다', () => {
    expect(() => toLocalPath('anatomy/toc.json')).toThrow('로컬 경로를 정할 수 없다')
  })
})

describe('splitBase', () => {
  it('버전 경로를 떼어 manifest가 사는 root를 준다', () => {
    expect(splitBase('https://cdn.example/aws-saa/abc123/v1')).toEqual({
      root: 'https://cdn.example/aws-saa/abc123',
      version: 'v1',
    })
  })

  it('끝의 슬래시가 버전을 빈 문자열로 만들지 않는다', () => {
    expect(splitBase('https://cdn.example/aws-saa/abc123/v2/').version).toBe('v2')
  })
})
