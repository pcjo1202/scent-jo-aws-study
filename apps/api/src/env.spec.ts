import { describe, expect, it } from 'vitest'

import { validateEnv } from './env'

const COMPLETE_ENV = {
  DATABASE_URL: 'postgresql://user:pw@pooler.example.com:6543/postgres',
  SUPABASE_JWKS_URL: 'https://ref.supabase.co/auth/v1/.well-known/jwks.json',
  SUPABASE_JWT_ISSUER: 'https://ref.supabase.co/auth/v1',
  ALLOWED_EMAIL: 'owner@example.com',
  DATA_BASE_URL: 'https://cdn.example.com/aws-saa',
}

describe('validateEnv', () => {
  it.each(Object.keys(COMPLETE_ENV))('%s가 없으면 부팅에서 멈춘다', (missingKey) => {
    const config: Record<string, unknown> = { ...COMPLETE_ENV }
    delete config[missingKey]

    expect(() => validateEnv(config)).toThrowError(missingKey)
  })

  it('필수 변수가 다 있으면 설정을 그대로 돌려준다', () => {
    expect(validateEnv({ ...COMPLETE_ENV, PORT: '3001' })).toMatchObject(COMPLETE_ENV)
  })
})
