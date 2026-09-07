import { existsSync, readdirSync } from 'node:fs'
import { isAnatomyKey } from './build-manifest.ts'

/**
 * `data/anatomy/`를 한 번 훑어 **자산과 그 밖의 것**으로 가른다 (`04-data-model.md` 「해부서」).
 *
 * `data:extract`는 `paths`로 manifest를 쓰고 `data:verify`는 같은 `paths`를 디스크에서
 * 다시 잰다 — **둘이 따로 훑으면** 한쪽만 아는 파일이 생겨 「manifest에 없는 산출물」이
 * 거짓으로 뜨거나, 더 나쁘게는 빠진 파일이 양쪽에서 똑같이 안 보인다.
 *
 * 거르는 기준은 경로표의 `isAnatomyKey` 하나다. 확장자로만 거르면 `pages/1.webp` 같은
 * 이름이 목록에 들어가 경로표에서 튕기고, 검사 결과 대신 스택 트레이스가 나온다.
 * 대신 **버리지 않고 `unknown`으로 세어 넘긴다** — 조용히 빠지면 손으로 잘못 넣은 쪽이
 * 배포에서 빠진 것을 아무도 모른다.
 */

export type AnatomyDir = { paths: string[]; unknown: string[] }

export function hasAnatomy(dataDir: string) {
  return existsSync(`${dataDir}anatomy/`)
}

/** 경로는 `data/` 기준 상대 경로다. 정렬 순서가 곧 쪽 순서다. */
export function readAnatomyDir(dataDir: string): AnatomyDir {
  const found = [
    ...fileNames(`${dataDir}anatomy/`).map((name) => `anatomy/${name}`),
    ...fileNames(`${dataDir}anatomy/pages/`).map((name) => `anatomy/pages/${name}`),
  ]

  return {
    paths: found.filter(isAnatomyKey).sort(),
    unknown: found.filter((path) => !isAnatomyKey(path)),
  }
}

/** 파일명에서 읽은 쪽 번호. 목차의 `page`가 이 집합을 가리켜야 한다. */
export function anatomyPageNumbers(paths: string[]) {
  return paths
    .filter((path) => path.startsWith('anatomy/pages/'))
    .map((path) => Number(path.slice('anatomy/pages/'.length, -'.webp'.length)))
}

/**
 * 디렉터리와 `.DS_Store` 같은 숨김 파산물은 애초에 세지 않는다 — 파인더가 만드는 것이라
 * 위반으로 세면 macOS에서 폴더를 열기만 해도 배포가 막힌다 (`extract.ts` 픽스처와 같은 이유).
 */
function fileNames(dir: string) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
}
