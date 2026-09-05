/**
 * `NEXT_PUBLIC_*`는 빌드 시점에 문자열로 치환된다. **`process.env`를 변수로 인덱싱하면
 * 치환되지 않으므로** 아래처럼 리터럴로만 쓴다 — 목록은 `docs/06` 「전체 목록」.
 *
 * 읽는 시점에 던지는 이유: 모듈 로드 시점에 던지면 값이 없는 환경에서 번들 전체가 죽어
 * 어느 화면이 무엇을 필요로 했는지가 안 보인다. 값이 없는 채로 흘려보내면
 * `undefined/manifest.json`을 부르고 그 404가 CDN 장애와 구별되지 않는다.
 */
function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`환경변수 ${name}이 없다 (docs/06 「전체 목록」)`)
  }

  return value
}

/**
 * CDN 데이터 경로. **버전 세그먼트가 붙지 않은 루트다** — 진입점이 `<이 값>/manifest.json`이고
 * 버전 붙은 경로는 manifest의 `base`가 준다. `scripts/.env`의 `DATA_CDN_BASE`는 `/v1`까지
 * 포함한 다른 값이라 그대로 옮기면 403이다 (`docs/06`).
 */
export function dataBaseUrl(): string {
  return requireEnv('NEXT_PUBLIC_DATA_BASE_URL', process.env.NEXT_PUBLIC_DATA_BASE_URL)
}
