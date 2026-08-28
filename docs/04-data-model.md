# 04. 데이터 모델 (정적 데이터)

CDN에 올라가는 불변 데이터의 스키마다. 가변 데이터(진도·시도)는 `05-database.md`를 본다.

## manifest.json

모든 데이터 접근의 진입점. 여기만 짧은 캐시(`max-age=300`)를 갖는다.

```ts
type Manifest = {
  version: string          // "v1"
  generatedAt: string      // ISO 8601
  base: string             // "https://static-cdn.scent-jo.dev/aws-saa/v1"
  questions: {
    total: number          // 1019
    chunkSize: number      // 100
    chunks: number         // 11
  }
  files: Record<string, { bytes: number; sha256: string }>
}
```

클라이언트는 manifest를 먼저 읽고 `base`를 기준으로 나머지를 받는다. 버전을 올릴 때 `version`과 `base`만 바뀐다.

`sha256`은 `data:verify`가 배포 후 무결성을 확인하는 데 쓴다.

## 문제

### Question

```ts
type ChoiceKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

type Question = {
  id: number                    // 1..1019
  stem: string                  // 지문
  choices: Array<{ key: ChoiceKey; text: string }>
  answer: ChoiceKey[]           // 1~3개
  requirements: string[]        // 원본의 "요구사항/조건" 불릿
  explanation: string           // 정답 해설
  rebuttals: Array<{ key: ChoiceKey; text: string }>   // 선택지별 오답 해설
  categories: string[]          // 파생. 1~3개
  services: string[]            // 파생. 매칭된 서비스명
}
```

**`requirements`를 보존하는 이유**: 원본이 각 문항을 조건 3~5개로 미리 분해해 뒀다. 해부서 PART 3의 "출제자가 묻는 축 하나만 고른다"와 같은 사고 단계다. v1에서 별도 기능으로 쓰지는 않지만, 채점 화면에서 해설보다 먼저 보여주고, 버리면 다시 만들 수 없다.

**`rebuttals`가 `choices`보다 짧을 수 있다**: 원본이 정답 선택지에 대한 오답 해설을 두지 않기 때문이다. 정답 개수만큼 항목이 비는 것이 정상이다.

### chunk-NNN.json

```ts
type Chunk = {
  chunk: number          // 1..11
  from: number           // 첫 문항 id
  to: number             // 마지막 문항 id
  questions: Question[]
}
```

100문항 단위, 파일당 약 180KB. 마지막 청크(011)만 19문항이다.

### index.json

```ts
type IndexEntry = {
  id: number
  chunk: number          // 이 문항이 든 청크 번호
  categories: string[]
  services: string[]
  answer: ChoiceKey[]    // 채점용
}

type QuestionIndex = { entries: IndexEntry[] }
```

1019개, 약 60KB. **필터·목록 렌더링을 전부 이 파일만으로 처리한다.** 모의고사 추첨은 서버 `catalog`가 한다 (`05-database.md`). 실제로 문제를 풀 때만 해당 청크를 받는다.

`chunk`를 인덱스에 넣어 두면 문항 id에서 청크 번호를 계산하지 않아도 되고, 나중에 청크 크기를 바꿔도 클라이언트 코드가 안 깨진다.

`answer`를 인덱스에 넣는 이유는 **NestJS가 이 파일만 캐시하면 서버에서 채점할 수 있기 때문**이다. 클라이언트가 보낸 정오 판정을 믿지 않아도 되고, 통계가 신뢰할 수 있는 값이 된다 (`05-database.md`의 `catalog` 모듈). 단, 정답은 인덱스·청크를 통해 **클라이언트에도 내려간다** — 서버 채점의 목적은 부정행위 방지가 아니라 통계 무결성이며, 시험 중 "정오 미표시"는 UI 차원의 규칙이다. 이 위에 시험 무결성 기능을 쌓지 않는다.

정답을 인덱스에 노출하는 것이 모의고사의 정답 은닉을 깨지는 않는다. 어차피 청크 파일에 해설과 함께 들어 있어 클라이언트는 이미 알 수 있다. 개인 학습용이므로 은닉은 UI 수준의 배려일 뿐이다.

## 노트

### oneliners.json

```ts
type OneLiner = {
  service: string        // "Amazon EC2"
  category: string       // "컴퓨트"
  note: string           // 한줄 설명
}

type OneLiners = { items: OneLiner[] }   // 186개
```

카테고리 분포: 네트워크 32 · 스토리지 30 · 보안 30 · 데이터베이스 21 · 컴퓨트 20 · 메시징 13 · 모니터링 11 · 분석 8 · 운영 8 · AI/ML 7 · 마이그레이션 6

### comparisons.json

```ts
type ComparisonMember = {
  name: string           // "ECS (Elastic Container Service)"
  selectSignals: string  // 선택 신호
  rejectSignals: string  // 탈락 신호
  keyDifference: string  // ★ 결정적 차이
}

type Comparison = {
  id: string             // "ecs-vs-eks"
  title: string          // "ECS vs EKS"
  importance: 1 | 2 | 3  // 원본 ★ 개수
  members: ComparisonMember[]
}

type Comparisons = { items: Comparison[] }   // 48쌍
```

## 해부서

**v1은 구조화하지 않는다.** 원본 61페이지를 이미지 자산(`anatomy/pages/001..061.webp`)으로 올리고, 수동 목차 하나만 만든다 (2026-08-26 리뷰 D8 — 판독 20~40시간의 학습 ROI 없음, 이미지화는 반나절).

```ts
type AnatomyToc = { entries: Array<{ id: string; title: string; page: number }> }  // 21항목 수동 작성, anatomy/toc.json
```

아래 구조화 스키마는 **시험 후 과제**로 보존한다. 재개 시 유일한 재현 불가 산출물이 된다.

### part1-patterns.json

```ts
type Pattern = {
  id: string             // "1-1"
  title: string          // "비용 최적화 문제"
  firstSignals: string[]     // "가장 먼저 판단해야 할 신호"
  eliminations: Array<{      // "무조건 배제해야 하는 선택들"
    rule: string             // "비용 최소화가 보이면, 고급 옵션은 오답일 가능성이 높습니다"
    why: string              // "왜 바로 탈락하는가"
    examples: Array<{ subject: string; reason: string }>
    verdict: string          // "👉 ..." 로 강조된 결론 한 줄
  }>
}

type Part1 = { patterns: Pattern[] }   // 6개
```

### part2-services.json

```ts
type ServiceGuide = {
  id: string             // "2-5"
  title: string          // "Lambda"
  subtitle: string       // "'서버 없이' 이벤트/짧은 작업을 실행하는 컴퓨팅 트리거"
  correctSignals: string[]
  rejectSignals: string[]
  examContexts: string[]     // "시험에서 자주 사용하는 맥락"
  relatedCategories: string[]   // 문항 연결용. 판독 시 수동 지정
}

type Part2 = { guides: ServiceGuide[] }   // 21개
```

`relatedCategories`를 수동으로 넣는 이유: 문항 자동 태깅과 달리 해부서 절은 21개뿐이라 손으로 지정하는 편이 정확하고 빠르다.

### part3-method.json

```ts
type MethodSection = {
  id: string             // "3-1"
  title: string          // "문제를 읽자마자 할 일 3가지"
  blocks: Array<{
    heading: string
    items: string[]      // 중첩 불릿은 "  " 들여쓰기로 평탄화
  }>
}

type Part3 = { sections: MethodSection[] }
```

PART 3은 서술 위주라 구조를 얕게 잡는다. 과도한 구조화는 판독 비용만 늘린다.

## 자동 태깅

문제은행에는 주제 태그가 없다. 노트의 서비스명 186개를 사전으로 삼아 파생시킨다.

### 절차

1. **지문 + 정답 선택지 텍스트**만 스캔한다
   오답 선택지를 포함하면 "Redshift가 오답으로 등장하는 Athena 문제"가 분석 카테고리로 잘못 분류된다
2. 서비스명을 매칭한다. 표기 흔들림을 흡수하는 별칭 테이블을 둔다
   `Amazon S3` / `S3` / `S3 버킷` → `Amazon S3`
   `AWS Lambda` / `Lambda` / `람다` → `AWS Lambda`
3. 매칭된 서비스를 카테고리로 롤업한다
4. 문항당 카테고리 상위 1~3개를 남긴다

### 오분류 대응

자동 태깅은 반드시 일부 틀린다. 두 가지 방어를 둔다.

- **`services`를 인덱스에 원본 그대로 남긴다.** 카테고리가 틀려도 서비스명으로는 찾을 수 있다
- **분포를 검증한다.** 한 카테고리가 900문항이면 별칭 사전이 잘못된 것이다. `data:verify`가 분포를 출력한다

## 추출 파이프라인

```
pnpm data:extract    PDF → data/           (로컬, gitignored)
pnpm data:verify     스키마·개수·분포 검증
pnpm data:publish    manifest 생성 → S3 업로드
pnpm data:pull       CDN → data/ + tests/fixtures/   (새 기기 복구)
```

**anatomy는 optional 자산이다.** 자산화(E2)가 미완이면 `data:publish`가 anatomy를 제외하고 올리고, `data:verify`도 문제·노트만으로 통과한다. anatomy가 완성되면 다음 버전(v2 등)에 포함해 올린다. `/anatomy` 화면(E7)은 anatomy가 포함된 데이터 버전부터 동작한다 — v1 배포와 E5~E8은 판독 완료를 기다리지 않는다.

### data:extract

| 대상 | 방법 |
|---|---|
| 문제 1019 | `pdftotext -layout` → 블록 파싱 |
| 노트 186 + 48 | 모바일 PDF(파일 3) 파싱. 카드 레이아웃이라 열 래핑이 없어 PC판보다 안정적이다 |
| 해부서 | **스크립트 아님.** 페이지를 이미지로 렌더링해 수동 판독 |

### data:verify

파싱은 반드시 어딘가 깨진다. 1019개를 눈으로 볼 수 없으므로 기계가 잡는다.

- 문항 id가 1~1019 연속이고 누락·중복이 없는가
- 모든 문항에 선택지가 4개 이상 있는가
- 모든 문항에 정답이 1개 이상 있고, 정답 키가 존재하는 선택지를 가리키는가
- `answer` 길이가 1~3인가
- `explanation`이 비어 있지 않은가
- `rebuttals`의 키가 선택지에 존재하고 정답 키와 겹치지 않는가
- 카테고리 분포가 한쪽으로 쏠리지 않았는가 (출력해서 눈으로 확인)
- 태깅되지 않은 문항이 몇 개인가 (0이어야 정상은 아님. 비율을 본다)
- 노트 186개, 비교 48쌍이 다 나왔는가

검증 실패는 배포를 막는다.

**내용 정확도 검증** — 구조 검증은 오독을 못 잡는다. 카테고리 층화 표본 **50문항**을 독립 에이전트(또는 사람)가 원본 PDF와 대조한다. 허용 오류 **0건** — 발견 시 파서를 고치고 표본을 다시 뽑는다. 대조 결과는 해당 이슈 코멘트에 기록한다.

### data:publish

1. `data/`에서 청크·인덱스·노트·해부서와 테스트 픽스처(`tests/fixtures/`)를 읽는다
2. 각 파일의 sha256을 계산해 manifest를 만든다
3. `s3://<bucket>/aws-saa/<version>/` 에 업로드한다
   - `v*/**` → `Cache-Control: public, max-age=31536000, immutable`
   - `manifest.json` → `Cache-Control: public, max-age=300`
   - `v*/fixtures/` → 파서 골든 픽스처. `data:pull`이 데이터와 함께 복원한다
4. manifest는 **마지막에** 올린다. 데이터가 다 올라간 뒤에 가리켜야 한다
5. 기존 버전은 삭제하지 않는다

버전을 올릴 때는 `--version v2` 를 준다. 같은 버전에 다시 올리는 것은 기본적으로 거부하고 `--force`를 요구한다.

## 해부서 자산화 진행 방식

v1: `pdftoppm`으로 61장 렌더링 → webp 변환 → `toc.json` 21항목 수동 작성 → publish. 반나절 작업이다.

구조화 판독을 시험 후 재개할 때는 PART 1을 먼저 만들어 구조를 확인받고 PART 2·3을 채운다. 전부 읽은 뒤에 "구조가 다르다"가 나오면 손실이 크다.
