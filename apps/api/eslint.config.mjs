import tseslint from 'typescript-eslint'

import base from '../../eslint.config.base.mjs'

export default [
  { ignores: ['dist/'] },
  ...base,
  // 타입 인지 규칙은 tsconfig가 아는 파일에만 건다. 설정 파일 자신은 대상이 아니다.
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['src/**/*.ts'],
  })),
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
]
