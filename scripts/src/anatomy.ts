import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { anatomyPageKey } from './artifacts/build-manifest.ts'
import { EXPECTED_ANATOMY_PAGE_COUNT } from './artifacts/verify-artifacts.ts'
import { SOURCE_FILE_NUMBERS, findSourcePdf } from './source-pdfs.ts'

/**
 * 해부서를 쪽 이미지로 만든다 (`04-data-model.md` 「해부서 자산화 진행 방식」).
 *
 * 원본이 Canva 내보내기라 텍스트 추출이 불가능하다 (`01-requirements.md` 「자료 구성」) —
 * 이미지가 유일한 열람 수단이다. `data:extract`에 넣지 않은 이유는 그쪽이 「PDF → JSON」
 * 하나만 하고, 버전을 올릴 때마다 61쪽을 다시 렌더링할 이유가 없어서다.
 *
 * `toc.json`은 여기서 만들지 않는다. 수동 판독물이라 재현할 수 없고, 이 스크립트가
 * `pages/`만 갈아엎는 것이 그 보호막이다 (`01-requirements.md` 「데이터 보존」).
 */

const DATA_DIR = fileURLToPath(new URL('../../data/', import.meta.url))
const PAGES_DIR = `${DATA_DIR}anatomy/pages/`
/** 폰 3x 화면(≈1170px)에 A4 한 쪽이 원본 크기로 들어간다. 110은 확대하면 흐려진다. */
const RENDER_DPI = 150
/** q85와 눈으로 구별되지 않는데 20% 작다 (2026-09-07 실측, 20·40쪽). */
const WEBP_QUALITY = 75

function main() {
  const pdf = findSourcePdf(SOURCE_FILE_NUMBERS.anatomy)
  // 지우기 전에 부른다. cwebp가 없으면 61쪽을 날린 뒤 첫 변환에서 죽는다 —
  // 복구가 `data:pull`뿐이고, poppler만 깔린 기기에서 실제로 일어난다 (`docs/06`).
  execFileSync('cwebp', ['-version'], { stdio: 'ignore' })
  const staging = mkdtempSync(join(tmpdir(), 'anatomy-'))

  try {
    // 쪽마다 부르지 않는다 — 7MB PDF를 61번 다시 파싱한다.
    execFileSync('pdftoppm', ['-r', String(RENDER_DPI), '-png', pdf, `${staging}/page`])
    const rendered = readdirSync(staging)
      .filter((name) => name.endsWith('.png'))
      .sort()
    // 61쪽이 아니면 지우지 않는다. 40쪽만 나온 채 초록으로 끝나면 「그럴듯하게 조금
    // 모자란 수」가 남는데, 그때는 원래 61쪽이 이미 사라진 뒤다 (`CLAUDE.md` 부분 집계).
    if (rendered.length !== EXPECTED_ANATOMY_PAGE_COUNT) {
      throw new Error(`${rendered.length}쪽이 렌더링됐다 — 기대 ${EXPECTED_ANATOMY_PAGE_COUNT}쪽`)
    }

    // 앞선 실행이 남긴 쪽을 지운다. 원본이 짧아지면 남은 쪽이 그대로 배포되는데,
    // 버전 경로는 immutable이라 되돌리는 값이 v2 재배포다.
    rmSync(PAGES_DIR, { recursive: true, force: true })
    mkdirSync(PAGES_DIR, { recursive: true })

    const bytes = rendered
      .map((name, order) => toWebp(`${staging}/${name}`, order + 1))
      .reduce((sum, size) => sum + size, 0)

    console.log(
      `${rendered.length}쪽 · ${RENDER_DPI}dpi · webp q${WEBP_QUALITY} · ${toMb(bytes)}MB (쪽당 평균 ${Math.round(bytes / rendered.length / 1024)}KB)`,
    )
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

/** 파일명은 `001.webp`다. 정렬이 곧 쪽 순서여야 `toc.json`의 `page`가 그대로 경로가 된다. */
function toWebp(pngPath: string, page: number) {
  const target = `${DATA_DIR}${anatomyPageKey(page)}`
  execFileSync('cwebp', ['-quiet', '-q', String(WEBP_QUALITY), pngPath, '-o', target])
  return statSync(target).size
}

function toMb(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1)
}

main()
