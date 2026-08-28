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
// 자손 결합자여야 한다. 직계 자식(`>`)이면 `className="…"` 형태만 잡고,
// `className={cond ? … : …}`·`className={cn(…)}`·템플릿 리터럴이 전부 빠져나간다.
// 조건부 클래스는 선택지 카드의 상태 분기에서 기본형이 되므로 그쪽이 오히려 주 경로다.
//
// `(?!:)`로 임의 **variant**는 통과시킨다 — `data-[state=open]:`·`[&>svg]:`는
// 값이 아니라 선택자라 토큰 체계를 우회하지 않는다. 아코디언이 전자를 쓰게 된다.
const ARBITRARY_VALUE_PATTERN = String.raw`/\[[^\]]+\](?!:)/`

const NO_ARBITRARY_VALUE = {
  selector: [
    `JSXAttribute[name.name="className"] Literal[value=${ARBITRARY_VALUE_PATTERN}]`,
    `JSXAttribute[name.name="className"] TemplateElement[value.raw=${ARBITRARY_VALUE_PATTERN}]`,
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
