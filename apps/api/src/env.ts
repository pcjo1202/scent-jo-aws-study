/**
 * 서버리스에서 환경변수 누락은 첫 요청에서야 드러난다. 부팅에서 멈춰 원인을 앞으로 당긴다
 * (docs/06 「검증」). 잡는 것은 **누락까지**다 — 값이 틀린 경우(옛 JWKS 경로 등)는
 * `createRemoteJWKSet`이 첫 검증에서야 네트워크를 타므로 여기서 걸리지 않고,
 * `SupabaseJwtGuard`가 503으로 드러낸다.
 *
 * 값을 실제로 읽는 코드가 생긴 변수만 넣는다 — `DATA_BASE_URL`은 읽는 곳이 없어 지금 넣으면
 * 검증할 수 없는 죽은 설정이 된다 (docs/06 「.env.example」).
 * `CORS_ALLOWED_ORIGINS`는 `cors-origins.ts`가 자기 규칙으로 이미 강제한다.
 */
const REQUIRED_ENV_KEYS = [
  'DATABASE_URL',
  'SUPABASE_JWKS_URL',
  'SUPABASE_JWT_ISSUER',
  'ALLOWED_EMAIL',
] as const

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !config[key])

  if (missing.length > 0) {
    throw new Error(`필수 환경변수가 없다: ${missing.join(', ')} (docs/06 「전체 목록」)`)
  }

  return config
}
