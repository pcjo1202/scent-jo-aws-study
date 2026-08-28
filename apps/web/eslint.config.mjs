import prettier from 'eslint-config-prettier/flat'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

// FSD는 아래로만 흐른다. 각 레이어가 자기보다 위를 가져오지 못하게 막는다 (apps/web/CLAUDE.md).
const LAYERS_ABOVE = {
  shared: ['features', 'widgets', '_pages', '_app'],
  features: ['widgets', '_pages', '_app'],
  widgets: ['_pages', '_app'],
  _pages: ['_app'],
}

const fsdZones = Object.entries(LAYERS_ABOVE).map(([layer, above]) => ({
  target: `./src/${layer}`,
  from: above.map((upper) => `./src/${upper}`),
  message: `FSD: ${layer}는 상위 레이어를 가져올 수 없다.`,
}))

// Tailwind 임의값 문법. 네임스페이스 리셋이 `bg-red-500`·`text-3xl`을 이미 없앴으므로
// 토큰을 벗어날 수 있는 경로는 이것 하나만 남는다 (docs/10 「스타일 저작」).
// 플러그인을 얹지 않는 이유는 필요한 규칙이 이 하나뿐이기 때문이다.
//
// `className` 안으로 범위를 좁히지 않는다. 좁히면 **클래스 문자열을 상수로 뽑는 순간**
// 규칙이 꺼진다 — `const VARIANT_CLASS = { filled: 'bg-[#abc]' }`처럼 상태별 클래스를
// 레코드로 두는 것은 컴포넌트에서 기본형이라 그쪽이 오히려 주 경로다.
// 프로브 6건 중 4건만 잡히던 것을 6건으로 올린 변경이다 (SJO-18).
//
// 대신 유틸 모양을 요구한다 — `<접두사>-[값]`이어야 걸린다. `[값]` 하나만 보면
// 배열 인덱싱이나 정규식 문자열까지 오탐한다.
//
// `(?!:)`로 임의 **variant**는 통과시킨다 — `data-[state=open]:`·`[&>svg]:`는
// 값이 아니라 선택자라 토큰 체계를 우회하지 않는다.
// 선행 하이픈(`-mt-[3px]`·`-z-[1]`)까지 받는다. 음수 유틸을 빼먹은 채로 "6건 중 6건"을
// 세면 그 숫자가 목록의 완전성을 보증하는 것처럼 읽힌다 (2026-08-28 리뷰).
const ARBITRARY_VALUE_PATTERN = String.raw`/(^|\s)-?[a-z][a-z0-9:_-]*-\[[^\]]+\](?!:)/`

const NO_ARBITRARY_VALUE = {
  selector: [
    `Literal[value=${ARBITRARY_VALUE_PATTERN}]`,
    `TemplateElement[value.raw=${ARBITRARY_VALUE_PATTERN}]`,
  ].join(', '),
  message:
    'Tailwind 임의값(예: p-[13px], bg-[#abc])을 쓰지 않는다. 필요한 값이 토큰에 없으면 DESIGN.md를 먼저 고친다. (data-[…]: 같은 임의 variant는 허용된다)',
}

const config = [
  { ignores: ['.next/'] },
  // eslint.config.base.mjs를 펼치지 않는다 — next/typescript가 typescript-eslint recommended를
  // 이미 품고 있어 @typescript-eslint 플러그인이 중복 정의되면 flat config가 깨진다.
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettier,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'import/no-restricted-paths': ['error', { zones: fsdZones }],
      'no-restricted-syntax': ['error', NO_ARBITRARY_VALUE],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [
            { pattern: '@aws-study/**', group: 'internal', position: 'before' },
            { pattern: '@/shared/**', group: 'internal', position: 'after' },
            { pattern: '@/features/**', group: 'internal', position: 'after' },
            { pattern: '@/widgets/**', group: 'internal', position: 'after' },
            { pattern: '@/_pages/**', group: 'internal', position: 'after' },
            { pattern: '@/_app/**', group: 'internal', position: 'after' },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
        },
      ],
    },
  },
]

export default config
