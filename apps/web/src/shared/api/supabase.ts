import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { supabaseAnonKey, supabaseUrl } from '@/shared/config/env'

let browserClient: SupabaseClient | undefined

/**
 * 브라우저 전용 Supabase 클라이언트. Auth만 쓴다 — DB는 `api`가 맡는다 (`docs/06`).
 *
 * **implicit 플로우다.** 토큰이 URL 프래그먼트로 돌아오고 `detectSessionInUrl`이 그것을 세션에
 * 넣으므로 코드를 교환할 서버 라우트(`/auth/callback`)가 없다. 화면 목록이 9개인 이유가 이것이다
 * (`docs/02` 「화면 구성」, 2026-09-06 결정).
 *
 * 모듈 로드가 아니라 **첫 호출에 만든다.** 서버 렌더에서 만들면 `localStorage`가 없는 환경에
 * 세션 저장소가 붙고, 환경변수 누락이 화면이 아니라 번들 로드에서 터진다.
 */
export function getSupabaseClient(): SupabaseClient {
  browserClient ??= createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true },
  })

  return browserClient
}
