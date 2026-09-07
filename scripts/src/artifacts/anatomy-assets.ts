import { existsSync, readdirSync } from 'node:fs'

/**
 * `data/anatomy/`에 실제로 있는 파일 목록 (`04-data-model.md` 「해부서」).
 *
 * `data:extract`는 이 목록으로 manifest를 쓰고 `data:verify`는 같은 목록을 디스크에서
 * 다시 잰다 — **둘이 따로 훑으면** 한쪽만 아는 파일이 생겨 「manifest에 없는 산출물」이
 * 거짓으로 뜨거나, 더 나쁘게는 빠진 파일이 양쪽에서 똑같이 안 보인다.
 */

export function hasAnatomy(dataDir: string) {
  return existsSync(`${dataDir}anatomy/`)
}

/** `data/` 기준 상대 경로. 정렬 순서가 곧 쪽 순서다. */
export function anatomyLocalPaths(dataDir: string) {
  const pagesDir = `${dataDir}anatomy/pages/`
  const pages = existsSync(pagesDir)
    ? readdirSync(pagesDir)
        .filter((name) => name.endsWith('.webp'))
        .sort()
        .map((name) => `anatomy/pages/${name}`)
    : []

  return [...(existsSync(`${dataDir}anatomy/toc.json`) ? ['anatomy/toc.json'] : []), ...pages]
}

/** 파일명에서 읽은 쪽 번호. 목차의 `page`가 이 집합을 가리켜야 한다. */
export function anatomyPageNumbers(localPaths: string[]) {
  return localPaths
    .filter((path) => path.startsWith('anatomy/pages/'))
    .map((path) => Number(path.slice('anatomy/pages/'.length, -'.webp'.length)))
}
