import type { Manifest } from '@aws-study/shared'
import { toLocalPath } from './build-manifest.ts'

/** `04-data-model.md` 「data:publish」의 업로드 순서와 캐시 헤더. */

export const MANIFEST_KEY = 'manifest.json'
/** `03-architecture.md` 「경로 레이아웃」. 버전 경로라 내용이 바뀔 일이 없다. */
export const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'
/** manifest만 짧다 — 롤백이 이 한 파일을 바꾸는 일이라 오래 캐시하면 되돌릴 수 없다. */
export const MANIFEST_CACHE = 'public, max-age=300'

export type Upload = { key: string; localPath: string; cacheControl: string }

/**
 * 올릴 순서를 정한다. **manifest가 마지막이다** — 데이터가 다 올라간 뒤에 가리켜야
 * 중간에 죽어도 기존 manifest가 옛 버전을 그대로 가리킨다 (`04-data-model.md` 4단계).
 *
 * manifest만 버전 경로 **밖**(`rootKey`)에 올라간다. 자기가 가리키는 버전 안에 있으면
 * 롤백할 때 자기를 못 찾는다 (`03-architecture.md` 「경로 레이아웃」).
 */
export function toUploadPlan(manifest: Manifest, rootKey: string): Upload[] {
  const versionKey = `${rootKey}/${manifest.version}`
  const files = Object.keys(manifest.files)
    .sort()
    .map((key) => ({
      key: `${versionKey}/${key}`,
      localPath: toLocalPath(key),
      cacheControl: IMMUTABLE_CACHE,
    }))

  return [
    ...files,
    {
      key: `${rootKey}/${MANIFEST_KEY}`,
      localPath: `data/${MANIFEST_KEY}`,
      cacheControl: MANIFEST_CACHE,
    },
  ]
}
