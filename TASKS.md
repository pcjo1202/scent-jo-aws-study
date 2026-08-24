# 할 일

마일스톤 단위로만 유지한다. 세부 작업은 세션 안에서 처리한다.
**체크박스가 30개를 넘으면 이 파일이 실패한 것이다.** 쪼개지 말고 묶어라.

현재 상태는 `MEMORY.md`.

## M0 · 배포 가능성 검증 (선행)

기능 코드를 쓰기 전에 한다. 여기서 막히면 아키텍처가 바뀐다.

- [ ] pnpm workspaces + Turborepo 뼈대
- [ ] 빈 Next.js + 빈 NestJS 앱
- [ ] Vercel 프로젝트 2개 생성, Root Directory 설정
- [ ] **NestJS 제로 설정 감지가 `apps/api`에서 실제로 붙는지 확인** ← 이번 검증의 핵심
- [ ] Related Projects 연결, `VERCEL_RELATED_PROJECTS` 수신 확인

## M1 · 데이터 파이프라인

- [ ] `data:extract` — 문제 1019 + 노트 186·48
- [ ] `data:verify` — 개수·스키마·태깅 분포 검증
- [ ] 자동 태깅 (서비스명 별칭 사전)
- [ ] S3 버저닝 활성화 + CloudFront CORS 정책
- [ ] `data:publish` / `data:pull`
- [ ] `v1` 배포

## M2 · 해부서 판독

- [ ] PART 1 판독 → **구조 확인받고 진행**
- [ ] PART 2 (서비스군 21개)
- [ ] PART 3

## M3 · 백엔드

- [ ] Supabase 프로젝트 + 비대칭 JWT 전환 + Google OAuth
- [ ] Drizzle 스키마·마이그레이션 (`prepare: false` 확인)
- [ ] `auth` — JWKS 가드, 전역 적용
- [ ] `catalog` — CDN 인덱스 캐시, 채점, 추첨
- [ ] `attempts` / `progress` / `exams` / `stats`

## M4 · 프론트엔드

- [ ] **`DESIGN.md`를 Material Design 3 구조로 재작성** (토큰 3계층 · 색 역할 · surface container · shape · state layer)
- [ ] 로그인 + 인증 가드
- [ ] 문제 풀이 컴포넌트 (3개 모드 공용)
- [ ] `/study` 순차 + 필터
- [ ] `/review` 오답
- [ ] `/exam` 모의고사 + 결과
- [ ] `/notes` 암기 노트
- [ ] `/anatomy` 해부서
- [ ] `/` 대시보드
- [ ] 오프라인 제출 큐

## M5 · 마무리

- [ ] 테스트 3종 (파서 / 채점 / JWT 가드)
- [ ] Next.js 보안 패치 반영 (2026-08-26 예정 릴리스)
- [ ] 폰 실기기 확인

## 보류

v1에서 뺀 것들. 지우지 않고 여기 둔다.

- 문제 전문 검색
- 모의고사 시간 제한 (130분)
- 확신도 표시 ("맞췄지만 찍음")
- 조건만 보고 답 맞히기 훈련 (`requirements` 활용)
- 카테고리 비중 가중 추첨
