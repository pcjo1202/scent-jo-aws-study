/**
 * 서버리스에서 환경변수 누락은 첫 요청에서야 드러난다. 부팅에서 멈춰 원인을 앞으로 당긴다
 * (docs/06 「검증」).
 *
 * 값을 실제로 읽는 코드가 생긴 변수만 넣는다 — `DATABASE_URL`·`DATA_BASE_URL`은 읽는 곳이
 * 없어 지금 넣으면 검증할 수 없는 죽은 설정이 된다 (docs/06 「.env.example」).
 * `CORS_ALLOWED_ORIGINS`는 `cors-origins.ts`가 자기 규칙으로 이미 강제한다.
 */
const REQUIRED_ENV_KEYS = ['SUPABASE_JWKS_URL', 'SUPABASE_JWT_ISSUER', 'ALLOWED_EMAIL'] as const

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !config[key])

  if (missing.length > 0) {
    throw new Error(`필수 환경변수가 없다: ${missing.join(', ')} (docs/06 「전체 목록」)`)
  }

  return config
}
