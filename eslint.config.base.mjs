import prettier from 'eslint-config-prettier/flat'
import tseslint from 'typescript-eslint'

// prettier는 마지막 — 포맷 규칙을 끄는 역할이라 뒤에 설정이 오면 무의미해진다.
export default [...tseslint.configs.recommended, prettier]
