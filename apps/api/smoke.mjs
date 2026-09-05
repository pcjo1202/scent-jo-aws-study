/**
 * `nest build` 산출물을 Node로 실제 띄워 `/health`를 친다. `pnpm test`는 vitest+SWC로
 * 소스를 직접 돌리고 `typecheck`는 emit을 실행하지 않아, dist를 실행하는 경로가 어디에도
 * 없었다 — SJO-12가 넣은 `ERR_REQUIRE_ESM`이 배포에서야 드러난 이유다 (SJO-49).
 *
 * `--no-experimental-require-module`이 이 스크립트의 핵심이다. Vercel Fluid 런타임의
 * 모듈 로더는 Node 24의 `require(esm)`를 구현하지 않는데, 로컬 Node 24는 구현한다 —
 * 플래그 없이 띄우면 프로덕션이 죽는 코드가 여기서는 200을 준다 (2026-09-04 실측).
 *
 * 환경변수를 자체 주입한다. `.env`나 Vercel 등록 상태에 게이트가 좌우되면 안 된다
 * (SJO-12부터 SJO-50까지 인증 변수 3개가 실제로 Vercel에 없었다). URL 형태여야 한다 — `JwksService`가
 * 생성자에서 `new URL()`을, `postgres()`가 접속 문자열을 즉시 파싱한다.
 */
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const PORT = 34917
const BOOT_TIMEOUT_MS = 30_000
const POLL_INTERVAL_MS = 250

const SMOKE_ENV = {
  DATABASE_URL: 'postgres://smoke:smoke@127.0.0.1:5432/smoke',
  SUPABASE_JWKS_URL: 'https://smoke.invalid/auth/v1/.well-known/jwks.json',
  SUPABASE_JWT_ISSUER: 'https://smoke.invalid/auth/v1',
  ALLOWED_EMAIL: 'smoke@invalid',
  CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
  PORT: String(PORT),
}

async function fetchHealth() {
  const response = await fetch(`http://127.0.0.1:${PORT}/health`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  return response.json()
}

async function waitForHealth(child, output) {
  const deadline = Date.now() + BOOT_TIMEOUT_MS

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`부팅 중 프로세스가 죽었다 (exit ${child.exitCode})\n${output.join('')}`)
    }

    try {
      return await fetchHealth()
    } catch {
      // 아직 listen 전이면 연결이 거부된다. deadline까지는 정상이다
      await delay(POLL_INTERVAL_MS)
    }
  }

  throw new Error(`${BOOT_TIMEOUT_MS}ms 안에 /health가 응답하지 않았다\n${output.join('')}`)
}

const output = []
const child = spawn('node', ['--no-experimental-require-module', 'dist/main.js'], {
  cwd: import.meta.dirname,
  // 부모 환경을 물려주지 않는다 — 개발자 셸이나 Vercel 빌드 컨테이너의 변수가 섞이면
  // 게이트의 판정이 기기마다 달라진다. `VERCEL`이 새면 `cors-origins`가 부팅에서 던진다
  env: { PATH: process.env.PATH, ...SMOKE_ENV },
})
child.stdout.on('data', (chunk) => output.push(String(chunk)))
child.stderr.on('data', (chunk) => output.push(String(chunk)))

try {
  const health = await waitForHealth(child, output)
  console.log(`smoke ok — GET /health 200 ${JSON.stringify(health)}`)
} catch (error) {
  console.error(`smoke 실패 — ${error.message}`)
  process.exitCode = 1
} finally {
  child.kill()
}
