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
