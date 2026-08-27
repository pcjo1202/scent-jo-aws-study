const DEFAULT_CORS_ORIGINS = 'http://localhost:3000'
const REGEXP_METACHARACTERS = /[.*+?^${}()|[\]\\]/g

/**
 * 프리뷰 도메인은 배포마다 바뀌므로 `https://aws-study-web-*.vercel.app` 형태를 허용한다
 * (docs/06 「환경별 차이」). `*`는 호스트 레이블 하나만 대체한다 — 점을 넘게 두면
 * `https://aws-study-web-x.evil.com`이 통과한다.
 */
function toOriginMatcher(pattern: string): string | RegExp {
  if (!pattern.includes('*')) {
    return pattern
  }

  const escaped = pattern.replace(REGEXP_METACHARACTERS, '\\$&')

  return new RegExp(`^${escaped.replaceAll('\\*', '[^.]*')}$`)
}

export function parseAllowedOrigins(raw = process.env.CORS_ALLOWED_ORIGINS): (string | RegExp)[] {
  const patterns = (raw ?? DEFAULT_CORS_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  // 빈 항목을 남기면 cors가 완전 일치로만 판정해 모든 Origin이 조용히 차단된다.
  // 로그 없이 죽는 대신 부팅에서 멈춘다 (docs/06 「검증」).
  if (patterns.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS가 비어 있다. 허용할 Origin을 최소 하나 지정한다.')
  }

  return patterns.map(toOriginMatcher)
}
