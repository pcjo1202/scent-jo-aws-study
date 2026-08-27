const DEFAULT_CORS_ORIGINS = 'http://localhost:3000'
const REGEXP_METACHARACTERS = /[.*+?^${}()|[\]\\]/g

/**
 * 프리뷰 도메인은 배포마다 바뀌므로 `https://aws-study-*-smelljo.vercel.app` 형태를 허용한다
 * (docs/06 「환경별 차이」). `*`는 호스트 레이블 하나만 대체한다 — 점을 넘게 두면
 * `https://aws-study-x.evil.com`이 통과한다.
 */
function toOriginMatcher(pattern: string): string | RegExp {
  if (!pattern.includes('*')) {
    return pattern
  }

  const escaped = pattern.replace(REGEXP_METACHARACTERS, '\\$&')

  return new RegExp(`^${escaped.replaceAll('\\*', '[^.]*')}$`)
}

/**
 * 배포에서는 로컬 폴백을 주지 않는다. 변수를 빠뜨리면 `localhost`만 허용된 채 조용히 부팅하고,
 * 증상은 브라우저 콘솔의 CORS 오류뿐이라 원인을 찾기 어렵다 (docs/06 「검증」).
 */
function readConfiguredOrigins() {
  if (process.env.CORS_ALLOWED_ORIGINS === undefined && process.env.VERCEL) {
    return ''
  }

  return process.env.CORS_ALLOWED_ORIGINS ?? DEFAULT_CORS_ORIGINS
}

export function parseAllowedOrigins(raw = readConfiguredOrigins()): (string | RegExp)[] {
  const patterns = raw
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
