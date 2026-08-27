# 작업 관리 → Linear

작업 관리는 **Linear**에서 한다. 이 파일은 포인터다.

- **프로젝트**: [aws-study](https://linear.app/mustard-fe/project/aws-study-f79b1104b8b5) (팀 `scent-jo`, 이슈 prefix `SJO-`)
- **구조**: 마일스톤 E0~E9 (Epic) → 이슈 SJO-1~29 (Story, 완료 정의 보유) → 이슈 본문 체크리스트 (Task)
- **커밋 참조**: `feat(api): POST /attempts 구현 (SJO-15)` 형식으로 이슈 ID를 커밋 메시지에 남긴다
- **브랜치·PR**: `<type>/sjo-N-<영문-kebab>` → `main`으로 PR. PR 본문에 `Ref SJO-N` (자세한 규약은 `CLAUDE.md` 「브랜치와 PR」)

## 로드맵 요약

E0 배포 검증 → E1 데이터 → E3 백엔드 → E4 디자인 → E5 문제 풀이 → E6 모의고사 → E7 참조 → E8 현황 → E9 출시.
**E2(해부서 판독)는 병렬 가능** — 막혔을 때 채워 넣기 좋다.

## v1 보류 목록

Linear에 이슈로 만들지 않았다. 다시 꺼낼 때 이슈로 승격한다.

| | 뺀 이유 |
|---|---|
| 문제 전문 검색 | 지문 전체(2.7MB)를 받아야 함. 카테고리·서비스 필터로 대체 |
| 모의고사 시간 제한 (130분) | 학습보다 시험 리허설 기능. `started_at`이 있어 나중에 추가 가능 |
| 확신도 표시 ("맞췄지만 찍음") | 학습 효과는 있으나 요구사항에 없었음 |
| 조건만 보고 답 맞히기 훈련 | `requirements` 필드는 보존하되 기능은 만들지 않음 |
| 카테고리 비중 가중 추첨 | 원본에 도메인 비중 정보가 없음 |
| Pretendard 자체 호스팅 | 시스템 폰트로 읽어본 뒤 판단 |
| CI (GitHub Actions) | 솔로. 배포 전 로컬 실행으로 충분 |
| `pnpm-workspace.yaml`의 `catalog:`로 의존성 버전 통일 | `eslint`·`typescript`·`@types/node`가 여러 `package.json`에 같은 리터럴로 흩어져 있다(SSOT 위반). 다만 패키지가 4개라 아직 통증이 작다 — 늘어나면 승격 |
