'use client'

import { getSupabaseClient } from '@/shared/api/supabase'
import { Button } from '@/shared/ui/button'

/**
 * 이 화면에서 클라이언트로 넘어가는 것은 이 버튼 하나다 (`apps/web/CLAUDE.md`
 * 「`'use client'`는 최말단에만」).
 *
 * `redirectTo`를 현재 오리진으로 준다 — 로컬·프리뷰·프로덕션이 각자 자기에게 돌아온다.
 * **Supabase 콘솔의 Redirect URLs에 그 오리진이 없으면 Site URL로 떨어진다.** 검증은 콜백
 * 단계에서 일어나므로 `/auth/v1/authorize`는 어떤 값에도 302를 준다 (2026-09-06 실측).
 */
export function GoogleSignInButton() {
  function handleSignIn() {
    void getSupabaseClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
  }

  return (
    <Button variant="filled" onClick={handleSignIn}>
      Google로 계속하기
    </Button>
  )
}
