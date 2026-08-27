import prettier from 'eslint-config-prettier/flat'
import tseslint from 'typescript-eslint'

/**
 * 모든 패키지가 공유하는 TS 규칙.
 * 패키지별 설정(`apps/web`·`apps/api`의 `eslint.config.mjs`)이 이 배열을 펼치고 뒤에 자기 규칙을 붙인다.
 * prettier는 반드시 마지막 — 포맷 규칙을 끄는 역할이라 뒤에 다른 설정이 오면 무의미해진다.
 */
export default [...tseslint.configs.recommended, prettier]
